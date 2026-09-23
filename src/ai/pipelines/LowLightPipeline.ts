import { ImagePipeline } from './ImagePipeline';
import { PipelineExecutionArgs } from '../registry/TaskRegistry';
import { ModelConfig, NormalizationType } from '../config/ModelConfig';

/**
 * Low-light enhancement (Zero-DCE, MIRNet and anything shaped like them).
 *
 * These models take a fixed square - 512 for Zero-DCE, 400 for MIRNet - so the picture is
 * letterboxed into it, and what comes back is a brightened copy at that size. Rather than hand
 * that small copy back as the result, which throws away every pixel of a large photo, it is
 * turned into a correction and applied to the picture at its own size.
 *
 * The scale the numbers arrive in is the other half of the job. A model is documented as taking
 * 0-1 or 0-255 and returning one of the two, and a custom model carries the user's answer in its
 * config - but a wrong answer produces a black or blown-out picture rather than an error, so both
 * ends are checked against what the model actually did.
 */
export class LowLightPipeline extends ImagePipeline {
  protected modelId = 'zero_dce';
  protected config?: ModelConfig;

  /** The scale the picture is fed at, and the one to try instead when the result comes back wrong. */
  private normalization: NormalizationType = 'zero_to_one';
  private retryWith: NormalizationType | null = null;
  /** The share of the last result that was not clipped, for choosing between two attempts. */
  private usable = 1;

  async execute(args: PipelineExecutionArgs) {
    if (args.options?.modelId) {
      this.modelId = args.options.modelId;
    }
    const { modelRegistry } = await import('../registry/ModelRegistry');
    const manifest = modelRegistry.get(this.modelId);
    this.config = manifest?.customConfig;
    this.normalization = this.config?.preprocessing?.normalization || 'zero_to_one';
    this.retryWith = null;

    args.options = { ...args.options, preferredBackend: 'wasm' };
    const first = await super.execute(args);
    if (!this.retryWith) return first;

    // Almost everything came back clipped, which is what feeding the picture at the wrong scale
    // looks like. Run it once the other way and keep whichever result survived.
    const firstUsable = this.usable;
    this.normalization = this.retryWith;
    this.retryWith = null;
    const second = await super.execute(args);
    return this.usable > firstUsable ? second : first;
  }

  private baseWidth = 0;
  private baseHeight = 0;
  private isNCHW = false;
  private cropBox = { x: 0, y: 0, w: 0, h: 0 };
  /** The picture as the model saw it: the other half of the correction it returns. */
  private modelInput: ImageData | null = null;

  protected preprocess(imageData: ImageData, inputShape?: number[]): Float32Array {
    let targetH = imageData.height;
    let targetW = imageData.width;
    let isNCHW = false;

    if (inputShape && inputShape.length === 4) {
      if (inputShape[1] === 3) {
        isNCHW = true;
        targetH = inputShape[2] > 0 ? inputShape[2] : targetH;
        targetW = inputShape[3] > 0 ? inputShape[3] : targetW;
      } else {
        targetH = inputShape[1] > 0 ? inputShape[1] : targetH;
        targetW = inputShape[2] > 0 ? inputShape[2] : targetW;
      }
    }

    let targetData = imageData;

    // Preserve aspect ratio by letterboxing (padding with black)
    const scale = Math.min(targetW / imageData.width, targetH / imageData.height);
    const drawW = Math.round(imageData.width * scale);
    const drawH = Math.round(imageData.height * scale);
    const offsetX = Math.floor((targetW - drawW) / 2);
    const offsetY = Math.floor((targetH - drawH) / 2);

    this.cropBox = { x: offsetX, y: offsetY, w: drawW, h: drawH };

    if (targetH !== imageData.height || targetW !== imageData.width) {
      const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
      const origCtx = origCanvas.getContext('2d')!;
      origCtx.putImageData(imageData, 0, 0);

      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, targetW, targetH);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(origCanvas, offsetX, offsetY, drawW, drawH);
      targetData = ctx.getImageData(0, 0, targetW, targetH);
    }

    this.baseWidth = targetW;
    this.baseHeight = targetH;
    this.isNCHW = isNCHW;
    this.modelInput = targetData;

    const numPixels = targetW * targetH;
    const tensorData = new Float32Array(numPixels * 3);
    const norm = this.normalization;

    const normalizePixel = (p: number) => {
      if (norm === 'raw_255') return p;
      if (norm === 'minus_one_to_one') return (p / 127.5) - 1.0;
      return p / 255.0;
    };

    if (isNCHW) {
      for (let i = 0; i < numPixels; i++) {
        tensorData[i] = normalizePixel(targetData.data[i * 4 + 0]);
        tensorData[numPixels + i] = normalizePixel(targetData.data[i * 4 + 1]);
        tensorData[numPixels * 2 + i] = normalizePixel(targetData.data[i * 4 + 2]);
      }
    } else {
      for (let i = 0; i < numPixels; i++) {
        tensorData[i * 3 + 0] = normalizePixel(targetData.data[i * 4 + 0]);
        tensorData[i * 3 + 1] = normalizePixel(targetData.data[i * 4 + 1]);
        tensorData[i * 3 + 2] = normalizePixel(targetData.data[i * 4 + 2]);
      }
    }

    return {
      data: tensorData,
      shape: isNCHW ? [1, 3, targetH, targetW] : [1, targetH, targetW, 3]
    } as any;
  }

  protected postprocess(outputTensor: any, width: number, height: number, original?: ImageData): ImageData {
    const scaleFactor = this.outputScale(outputTensor);
    const enhanced = this.toImageData(outputTensor, scaleFactor);
    const cropped = this.cropLetterbox(enhanced);

    this.usable = this.usableShare(cropped);
    // A result that is almost entirely black or entirely white is what the wrong input scale
    // looks like; ask for one more attempt at the other scale.
    if (this.usable < 0.5 && this.normalization !== 'minus_one_to_one') {
      this.retryWith = this.normalization === 'raw_255' ? 'zero_to_one' : 'raw_255';
    }

    if (!original || !this.modelInput) return cropped;
    return this.applyToFullSize(original, cropped);
  }

  /**
   * Whether the model's numbers are 0-1 or already 0-255.
   *
   * The two are far enough apart to tell by looking: a model returning 0-1 rarely passes 2 even
   * where it overshoots, and one returning 0-255 is nowhere near that low. The setting only
   * decides the cases in between, because a wrong setting here turns a good result into a black
   * picture and says nothing about it.
   */
  private outputScale(outputTensor: any): number {
    const configured = (this.config?.postprocessing?.outputNormalized ?? true) ? 255 : 1;
    let peak = 0;
    const step = Math.max(1, Math.floor(outputTensor.length / 60000));
    for (let i = 0; i < outputTensor.length; i += step) {
      const v = Math.abs(Number(outputTensor[i]));
      if (v > peak) peak = v;
    }
    if (peak <= 2.5) return 255;
    if (peak > 20) return 1;
    return configured;
  }

  private toImageData(outputTensor: any, scaleFactor: number): ImageData {
    const numPixels = this.baseWidth * this.baseHeight;
    const out = new ImageData(this.baseWidth, this.baseHeight);
    const isBGR = this.config?.postprocessing?.channelOrder === 'BGR';
    const rIdx = isBGR ? 2 : 0;
    const bIdx = isBGR ? 0 : 2;

    for (let i = 0; i < numPixels; i++) {
      const r = this.isNCHW ? outputTensor[i] : outputTensor[i * 3 + 0];
      const g = this.isNCHW ? outputTensor[numPixels + i] : outputTensor[i * 3 + 1];
      const b = this.isNCHW ? outputTensor[numPixels * 2 + i] : outputTensor[i * 3 + 2];
      out.data[i * 4 + rIdx] = Math.max(0, Math.min(255, r * scaleFactor));
      out.data[i * 4 + 1] = Math.max(0, Math.min(255, g * scaleFactor));
      out.data[i * 4 + bIdx] = Math.max(0, Math.min(255, b * scaleFactor));
      out.data[i * 4 + 3] = 255;
    }
    return out;
  }

  /** Drops the black bars the picture was padded with to reach the model's square. */
  private cropLetterbox(imageData: ImageData): ImageData {
    const { x, y, w, h } = this.cropBox;
    if (w <= 0 || h <= 0 || (w === imageData.width && h === imageData.height)) return imageData;
    const full = new OffscreenCanvas(imageData.width, imageData.height);
    full.getContext('2d')!.putImageData(imageData, 0, 0);
    const cut = new OffscreenCanvas(w, h);
    const ctx = cut.getContext('2d')!;
    ctx.drawImage(full, x, y, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  /**
   * The share of the result that carries detail rather than sitting flat against black or white.
   *
   * Counted per colour, because the wrong input scale sends a model's numbers so far out of range
   * that most of them clip - measured at about a third usable, against three quarters for a good
   * result, so the two do not overlap.
   */
  private usableShare(imageData: ImageData): number {
    let usable = 0;
    const pixels = imageData.width * imageData.height;
    for (let i = 0; i < pixels; i++) {
      for (let c = 0; c < 3; c++) {
        const v = imageData.data[i * 4 + c];
        if (v > 0 && v < 255) usable++;
      }
    }
    return pixels ? usable / (pixels * 3) : 1;
  }

  /**
   * Puts the enhancement back on the picture at its own size.
   *
   * The model works at 400 or 512 pixels, so returning its output as the result shrinks a photo
   * to that and loses everything finer. What the model changed, though, is a smooth thing - how
   * much each part of the picture is lifted, and towards what colour - and that survives being
   * scaled up. So the lift is measured against what the model was given, stretched back over the
   * picture, and the picture's own detail is carried through it:
   *
   *     result = lifted + lift x (picture - what the model saw)
   *
   * which keeps the model's brightness and colour exactly while the detail stays as sharp as the
   * photo it came from.
   */
  private applyToFullSize(original: ImageData, enhanced: ImageData): ImageData {
    const seen = this.cropLetterbox(this.modelInput!);
    if (seen.width !== enhanced.width || seen.height !== enhanced.height) return enhanced;

    const width = original.width;
    const height = original.height;
    // The lift each pixel was given, kept in an 8-bit carrier so it can be stretched by the
    // canvas along with the two pictures. MAX_LIFT is the darkness a photo can be rescued from.
    const MAX_LIFT = 16;
    const SOFTEN = 2;
    const lift = new ImageData(enhanced.width, enhanced.height);
    for (let i = 0; i < lift.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const ratio = (enhanced.data[i + c] + SOFTEN) / (seen.data[i + c] + SOFTEN);
        lift.data[i + c] = Math.max(0, Math.min(255, (ratio / MAX_LIFT) * 255));
      }
      lift.data[i + 3] = 255;
    }

    const stretch = (source: ImageData) => {
      const from = new OffscreenCanvas(source.width, source.height);
      from.getContext('2d')!.putImageData(source, 0, 0);
      const to = new OffscreenCanvas(width, height);
      const ctx = to.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(from, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height);
    };

    const liftFull = stretch(lift);
    const enhancedFull = stretch(enhanced);
    const seenFull = stretch(seen);

    const out = new ImageData(width, height);
    for (let i = 0; i < out.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const ratio = (liftFull.data[i + c] / 255) * MAX_LIFT;
        const detail = original.data[i + c] - seenFull.data[i + c];
        out.data[i + c] = Math.max(0, Math.min(255, enhancedFull.data[i + c] + ratio * detail));
      }
      // Enhancing a cut-out must not fill it back in.
      out.data[i + 3] = original.data[i + 3];
    }
    return out;
  }
}
