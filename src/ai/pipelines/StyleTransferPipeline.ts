import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState } from '../types';
import type { RuntimeTensorData } from '../runtime/LiteRTRuntime';

interface TensorInfo {
  name?: string;
  dtype?: string;
  shape?: ArrayLike<number>;
}

/** The transform model's input is a fixed square; a picture is painted one square at a time. */
const TILE = 384;
/** How far neighbouring squares reach into each other, so the joins can be faded out. */
const OVERLAP = 96;
/** Each square is one model run, so this bounds how long a picture can take. */
const MAX_TILES = 40;

/**
 * Magenta Arbitrary Image Stylization Pipeline
 *
 * Two models:
 *   1. style_predict  - a picture at [1,256,256,3] -> a style bottleneck [1,1,1,100]
 *   2. style_transform - a picture at [1,384,384,3] + a bottleneck [1,1,1,100] -> the painting
 *
 * Both take float32 in [0, 1] and the transform returns the same.
 *
 * Two things the model needs that are easy to miss. The bottleneck handed to the transform is not
 * the style's alone: blending in the bottleneck of the picture being painted is what keeps the
 * subject recognisable, and without it the style paints over everything (this is the
 * `content_blending_ratio` of Magenta's own example). And the transform only ever paints 384x384,
 * so a picture larger than that is painted in overlapping squares at its own size rather than
 * shrunk into one square and blown back up, which leaves nothing but mush.
 */
export class StyleTransferPipeline implements TaskPipeline {
  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;

    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };
    const stopIfCancelled = () => {
      if (options?.signal?.aborted) throw new Error('AbortError');
    };

    stopIfCancelled();

    const styleImage = options?.metadata?.styleImage;
    if (!styleImage) {
      throw new Error('Style transfer requires a style image in options.metadata.styleImage');
    }
    // How much of the style to take: 1 is the style alone, which loses the picture entirely.
    const styleStrength = Math.min(1, Math.max(0, Number(options?.metadata?.styleStrength ?? 0.5)));

    /* -- Load both models ---------------------------------------------- */
    const predictRuntime = await aiSessionManager.getRuntime('style_predict', options?.preferredBackend, notify, options?.signal);
    const transformRuntime = await aiSessionManager.getRuntime('style_transform', options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);

    const contentImageData = await imageToImageData(image);
    const styleImageData = await imageToImageData(styleImage);
    // A cut-out's transparent pixels usually hold black, which the model paints as a dark shape
    // bleeding over the edge. Carry the picture's own colour through them instead.
    const paintable = this.fillTransparent(contentImageData);

    notify('preparing-image', 100);
    stopIfCancelled();
    notify('inference', 0);

    /* -- Step 1: the bottleneck the painting is made from --------------- */

    const predictInfo = this.resolveImageTensorInfo(
      predictRuntime.getInputDetails()[0] as TensorInfo | undefined, 256, 256
    );

    const styleBottleneck = await this.predict(predictRuntime, styleImageData, predictInfo);
    stopIfCancelled();
    const contentBottleneck = await this.predict(predictRuntime, paintable, predictInfo);
    stopIfCancelled();

    const bottleneck = new Float32Array(styleBottleneck.length);
    for (let i = 0; i < bottleneck.length; i++) {
      bottleneck[i] = styleStrength * Number(styleBottleneck[i]) + (1 - styleStrength) * Number(contentBottleneck[i]);
    }

    notify('inference', 20);

    /* -- Step 2: paint the picture -------------------------------------- */

    const transformInputDetails = transformRuntime.getInputDetails() as TensorInfo[];
    if (transformInputDetails.length < 2) {
      throw new Error('Style transform model must expose content and style inputs (expected 2 inputs, got ' + transformInputDetails.length + ')');
    }

    const contentInputIndex = this.findContentInputIndex(transformInputDetails);
    const contentInputInfo = this.resolveImageTensorInfo(
      transformInputDetails[contentInputIndex] as TensorInfo | undefined, TILE, TILE
    );
    const outputInfo = transformRuntime.getOutputDetails()[0] as TensorInfo | undefined;
    const outputLayout = this.resolveImageTensorInfo(outputInfo, TILE, TILE).layout;

    const [workWidth, workHeight] = this.workingSize(
      paintable.width, paintable.height, contentInputInfo.width, contentInputInfo.height
    );
    const work = this.scaleTo(paintable, workWidth, workHeight);

    const painted = await this.paintInTiles(
      work,
      { runtime: transformRuntime, details: transformInputDetails, contentInputIndex, contentInputInfo, outputLayout, bottleneck },
      (done, total) => notify('inference', 20 + Math.round((done / total) * 80)),
      stopIfCancelled
    );

    notify('inference', 100);

    /* -- Post-process --------------------------------------------------- */

    notify('post-processing', 0);
    const resized = this.scaleTo(painted, contentImageData.width, contentImageData.height);
    // The painting is opaque everywhere; a cut-out has to stay cut out.
    for (let i = 3; i < resized.data.length; i += 4) resized.data[i] = contentImageData.data[i];
    notify('post-processing', 100);

    notify('encoding', 100);

    return { output: resized };
  }

  /** Runs the style encoder on one picture, squared off the way the model was trained. */
  private async predict(
    runtime: { execute(data: Float32Array, shape: number[]): Promise<RuntimeTensorData> },
    imageData: ImageData,
    info: ReturnType<StyleTransferPipeline['resolveImageTensorInfo']>
  ): Promise<RuntimeTensorData> {
    // Squashing a wide picture into the square input stretches its brush strokes, and the
    // bottleneck then describes that distorted texture. The middle square keeps them as they are.
    const squared = this.centreSquare(imageData, info.width);
    const tensor = new Float32Array(info.width * info.height * 3);
    this.writePixels(squared, tensor, info.layout, info.width * info.height);
    return runtime.execute(tensor, info.shape);
  }

  /**
   * Paints a picture as overlapping squares, fading the joins out.
   *
   * Each square is painted on its own, so two of them never agree exactly where they meet. Letting
   * them share a wide band and weighting each pixel by how far it sits from its own square's edge
   * turns that disagreement into a gradient rather than a line.
   */
  private async paintInTiles(
    work: ImageData,
    model: {
      runtime: { executeMultiInput(inputs: RuntimeTensorData[], shapes?: number[][]): Promise<RuntimeTensorData> };
      details: TensorInfo[];
      contentInputIndex: number;
      contentInputInfo: ReturnType<StyleTransferPipeline['resolveImageTensorInfo']>;
      outputLayout: 'NHWC' | 'NCHW';
      bottleneck: Float32Array;
    },
    onTile: (done: number, total: number) => void,
    stopIfCancelled: () => void
  ): Promise<ImageData> {
    const { width, height } = work;
    const tileWidth = model.contentInputInfo.width;
    const tileHeight = model.contentInputInfo.height;
    const planeSize = tileWidth * tileHeight;

    const columns = this.tileStarts(width, tileWidth);
    const rows = this.tileStarts(height, tileHeight);
    const total = columns.length * rows.length;

    const colour = new Float32Array(width * height * 3);
    const weight = new Float32Array(width * height);
    const rampX = this.featherRamp(tileWidth);
    const rampY = this.featherRamp(tileHeight);

    const bottleneckDetail = model.details[1 - model.contentInputIndex];
    const bottleneckShape = bottleneckDetail?.shape
      ? Array.from(bottleneckDetail.shape).map(Number)
      : [1, 1, 1, model.bottleneck.length];

    const tile = new Float32Array(planeSize * 3);
    let done = 0;

    for (const top of rows) {
      for (const left of columns) {
        stopIfCancelled();
        this.readTile(work, left, top, tileWidth, tileHeight, tile, model.contentInputInfo.layout);

        const inputs: RuntimeTensorData[] = [];
        const shapes: number[][] = [];
        for (let i = 0; i < model.details.length; i++) {
          if (i === model.contentInputIndex) {
            inputs.push(tile);
            shapes.push(model.contentInputInfo.shape);
          } else {
            inputs.push(model.bottleneck);
            shapes.push(bottleneckShape);
          }
        }

        const out = await model.runtime.executeMultiInput(inputs, shapes);
        const byteScaled = this.isByteScaled(out);

        for (let y = 0; y < tileHeight; y++) {
          const row = (top + y) * width;
          for (let x = 0; x < tileWidth; x++) {
            const w = rampX[x] * rampY[y];
            const from = y * tileWidth + x;
            const to = row + left + x;
            for (let c = 0; c < 3; c++) {
              const v = this.readChannel(out, model.outputLayout, from, c, planeSize);
              colour[to * 3 + c] += (byteScaled ? v / 255 : v) * w;
            }
            weight[to] += w;
          }
        }

        onTile(++done, total);
      }
    }

    const painted = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const w = weight[i] || 1;
      painted.data[i * 4 + 0] = this.toByte(colour[i * 3 + 0] / w);
      painted.data[i * 4 + 1] = this.toByte(colour[i * 3 + 1] / w);
      painted.data[i * 4 + 2] = this.toByte(colour[i * 3 + 2] / w);
      painted.data[i * 4 + 3] = 255;
    }
    return painted;
  }

  /**
   * The size the picture is painted at.
   *
   * Big enough that every part of it gets the model's full 384 pixels of attention, small enough
   * that the number of squares - one model run each - stays reasonable.
   */
  private workingSize(width: number, height: number, tileWidth: number, tileHeight: number): [number, number] {
    // A picture smaller than one square has to be scaled up to fill it either way.
    const minScale = Math.max(tileWidth / width, tileHeight / height);
    let scale = Math.max(1, minScale);
    while (scale > minScale) {
      const tiles = this.tileStarts(Math.round(width * scale), tileWidth).length
        * this.tileStarts(Math.round(height * scale), tileHeight).length;
      if (tiles <= MAX_TILES) break;
      scale = Math.max(minScale, scale * 0.85);
    }
    return [Math.max(tileWidth, Math.round(width * scale)), Math.max(tileHeight, Math.round(height * scale))];
  }

  /** Where each square starts along one side; the last is pulled back to end flush with the edge. */
  private tileStarts(total: number, tile: number): number[] {
    if (total <= tile) return [0];
    const step = Math.max(1, tile - OVERLAP);
    const starts: number[] = [];
    for (let at = 0; at + tile < total; at += step) starts.push(at);
    starts.push(total - tile);
    return starts;
  }

  /** 0 at a square's edge rising to 1 past the shared band, never quite 0 so a lone square counts. */
  private featherRamp(length: number): Float32Array {
    const ramp = new Float32Array(length);
    const band = Math.max(1, Math.min(OVERLAP, Math.floor(length / 2)));
    for (let i = 0; i < length; i++) {
      const fromEdge = Math.min(i, length - 1 - i);
      ramp[i] = 0.001 + 0.999 * Math.min(1, fromEdge / band);
    }
    return ramp;
  }

  private readTile(
    source: ImageData, left: number, top: number, tileWidth: number, tileHeight: number,
    out: Float32Array, layout: 'NHWC' | 'NCHW'
  ) {
    const planeSize = tileWidth * tileHeight;
    for (let y = 0; y < tileHeight; y++) {
      const row = (top + y) * source.width;
      for (let x = 0; x < tileWidth; x++) {
        const from = (row + left + x) * 4;
        const at = y * tileWidth + x;
        const r = source.data[from] / 255;
        const g = source.data[from + 1] / 255;
        const b = source.data[from + 2] / 255;
        if (layout === 'NCHW') {
          out[at] = r;
          out[planeSize + at] = g;
          out[planeSize * 2 + at] = b;
        } else {
          out[at * 3] = r;
          out[at * 3 + 1] = g;
          out[at * 3 + 2] = b;
        }
      }
    }
  }

  private writePixels(source: ImageData, out: Float32Array, layout: 'NHWC' | 'NCHW', planeSize: number) {
    for (let i = 0; i < planeSize; i++) {
      const r = source.data[i * 4] / 255;
      const g = source.data[i * 4 + 1] / 255;
      const b = source.data[i * 4 + 2] / 255;
      if (layout === 'NCHW') {
        out[i] = r;
        out[planeSize + i] = g;
        out[planeSize * 2 + i] = b;
      } else {
        out[i * 3] = r;
        out[i * 3 + 1] = g;
        out[i * 3 + 2] = b;
      }
    }
  }

  /** Replaces what sits behind transparent pixels with the picture's own average colour. */
  private fillTransparent(imageData: ImageData): ImageData {
    let clear = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 255) { clear = true; break; }
    }
    if (!clear) return imageData;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] < 16) continue;
      r += imageData.data[i];
      g += imageData.data[i + 1];
      b += imageData.data[i + 2];
      count++;
    }
    if (!count) return imageData;
    r /= count; g /= count; b /= count;

    const filled = new ImageData(imageData.width, imageData.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3] / 255;
      filled.data[i] = imageData.data[i] * a + r * (1 - a);
      filled.data[i + 1] = imageData.data[i + 1] * a + g * (1 - a);
      filled.data[i + 2] = imageData.data[i + 2] * a + b * (1 - a);
      filled.data[i + 3] = 255;
    }
    return filled;
  }

  /** The middle square of a picture, at the size asked for. */
  private centreSquare(imageData: ImageData, size: number): ImageData {
    const scale = size / Math.min(imageData.width, imageData.height);
    const width = Math.max(size, Math.round(imageData.width * scale));
    const height = Math.max(size, Math.round(imageData.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.toCanvas(imageData), Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
    return ctx.getImageData(0, 0, size, size);
  }

  private scaleTo(imageData: ImageData, width: number, height: number): ImageData {
    if (imageData.width === width && imageData.height === height) return imageData;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.toCanvas(imageData), 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  }

  private toCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    return canvas;
  }

  /** Reads a model's input or output metadata and resolves its size and channel order. */
  private resolveImageTensorInfo(detail: TensorInfo | undefined, fallbackWidth: number, fallbackHeight: number) {
    const shape = detail?.shape ? Array.from(detail.shape).map(Number) : [1, fallbackHeight, fallbackWidth, 3];
    const isNchw = shape.length === 4 && shape[1] === 3;
    const height = isNchw ? shape[2] : shape[1];
    const width = isNchw ? shape[3] : shape[2];

    return {
      shape,
      layout: isNchw ? 'NCHW' as const : 'NHWC' as const,
      width: Number(width) > 0 ? Number(width) : fallbackWidth,
      height: Number(height) > 0 ? Number(height) : fallbackHeight
    };
  }

  /**
   * Find the content image input (the one with the most elements - images are large, bottlenecks are small).
   */
  private findContentInputIndex(inputs: TensorInfo[]): number {
    let bestIndex = 0;
    let bestScore = -Infinity;

    inputs.forEach((input, index) => {
      const name = (input.name || '').toLowerCase();
      const count = this.elementCount(input.shape);
      let score = count;
      // Bonus for name hints
      if (name.includes('content') || name.includes('image') || name.includes('input')) score += 1_000_000_000;
      // Large tensors are almost certainly image data
      if (count > 1000) score += 1_000_000;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private elementCount(shape: ArrayLike<number> | undefined): number {
    if (!shape) return 0;
    return Array.from(shape).reduce((product, value) => product * Math.max(1, Number(value)), 1);
  }

  private readChannel(data: RuntimeTensorData, layout: 'NHWC' | 'NCHW', pixelIndex: number, channel: number, planeSize: number): number {
    const index = layout === 'NCHW' ? channel * planeSize + pixelIndex : pixelIndex * 3 + channel;
    return Number(data[index] ?? 0);
  }

  private toByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value * 255)));
  }

  /** Whether the model hands back 0-255 rather than the 0-1 this one is documented to return. */
  private isByteScaled(data: RuntimeTensorData): boolean {
    if (!(data instanceof Float32Array)) return true;
    const limit = Math.min(data.length, 4096);
    for (let i = 0; i < limit; i++) if (Number(data[i]) > 2) return true;
    return false;
  }
}
