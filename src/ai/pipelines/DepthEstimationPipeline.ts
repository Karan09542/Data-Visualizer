import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState, DepthEstimationResult } from '../types';
import { LiteRTRuntime } from '../runtime/LiteRTRuntime';
import { modelRegistry } from '../registry/ModelRegistry';
import { DepthModelConfig } from '../types';

/** Where the picture itself sits inside the model's input, once it has been fitted to it. */
interface ContentRect { x: number; y: number; width: number; height: number }

interface FittedInput {
  width: number;
  height: number;
  content: ContentRect;
}

type DepthMode = 'grayscale' | 'colored' | '3d' | 'portrait-blur' | 'relighting' | 'fog';

export class DepthEstimationPipeline implements TaskPipeline {
  private runtime: LiteRTRuntime | null = null;

  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;

    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };

    if (options?.signal?.aborted) throw new Error('AbortError');

    const modelId = options?.modelId || 'depth_anything_v2';
    const depthMode: DepthMode = (options?.metadata?.depthMode as DepthMode) || 'colored';
    // Each checkpoint has its own input shape, scaling and sense of which way depth runs.
    const config: DepthModelConfig = modelRegistry.get(modelId)?.depth ?? {};

    this.runtime = await aiSessionManager.getRuntime(modelId, options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);
    const imageData = await imageToImageData(image);

    let inputShape: number[] | undefined;
    try {
      const details = (this.runtime as any).session?.getInputDetails?.();
      if (details && details.length > 0) inputShape = details[0].shape as number[];
    } catch (e) {}

    const inputResult = this.preprocess(imageData, inputShape, config);
    notify('preparing-image', 100);

    if (options?.signal?.aborted) throw new Error('AbortError');

    notify('inference', 0);
    const outputTensor = await this.runtime.execute(inputResult.data, inputResult.shape);

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 100);

    notify('post-processing', 0);
    const result = this.postprocess(outputTensor, imageData, depthMode, config, inputResult.input);
    notify('post-processing', 100);

    notify('encoding', 100);

    return {
      output: result
    };
  }

  private preprocess(
    imageData: ImageData,
    inputShape: number[] | undefined,
    config: DepthModelConfig
  ): { data: Float32Array; shape: number[]; input: FittedInput } {
    const { width: targetWidth, height: targetHeight, layout, shape } = this.resolveInputShape(inputShape);

    const fitted = this.fitImage(imageData, targetWidth, targetHeight, this.resolveFit(imageData, targetWidth, targetHeight, config));
    const resizedData = fitted.pixels;
    const float32Data = new Float32Array(targetWidth * targetHeight * 3);

    // Both MiDaS and the Depth Anything exports take ImageNet-normalized RGB; a checkpoint that
    // wants plain [0,1] says so in its manifest.
    const imagenet = (config.normalization ?? 'imagenet') === 'imagenet';
    const mean = imagenet ? [0.485, 0.456, 0.406] : [0, 0, 0];
    const std = imagenet ? [0.229, 0.224, 0.225] : [1, 1, 1];
    const planeSize = targetWidth * targetHeight;

    for (let i = 0; i < planeSize; i++) {
      const r = (resizedData.data[i * 4 + 0] / 255.0 - mean[0]) / std[0];
      const g = (resizedData.data[i * 4 + 1] / 255.0 - mean[1]) / std[1];
      const b = (resizedData.data[i * 4 + 2] / 255.0 - mean[2]) / std[2];

      if (layout === 'NCHW') {
        float32Data[i] = r;
        float32Data[planeSize + i] = g;
        float32Data[planeSize * 2 + i] = b;
      } else {
        float32Data[i * 3 + 0] = r;
        float32Data[i * 3 + 1] = g;
        float32Data[i * 3 + 2] = b;
      }
    }

    return {
      data: float32Data,
      shape,
      input: { width: targetWidth, height: targetHeight, content: fitted.content },
    };
  }

  /**
   * Squash the picture to the model's input, or keep its proportions and pad.
   *
   * Squashing is what most exports expect and it gives the picture the whole frame. It only hurts
   * when the two shapes are far apart - a 16:9 photo squeezed into a 9:16 input is stretched to
   * about three times its height, and the depth that comes back is of that distorted scene.
   * Measured over several photos, padding wins clearly in that case and loses slightly in milder
   * ones, so `auto` pads only past the point where the distortion is severe.
   */
  private resolveFit(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    config: DepthModelConfig
  ): 'stretch' | 'contain' {
    const requested = config.fit ?? 'stretch';
    if (requested !== 'auto') return requested;
    const imageAspect = imageData.width / Math.max(1, imageData.height);
    const inputAspect = targetWidth / Math.max(1, targetHeight);
    const mismatch = Math.max(imageAspect / inputAspect, inputAspect / imageAspect);
    return mismatch > 2 ? 'contain' : 'stretch';
  }

  /**
   * Puts the picture into the model's input rectangle.
   *
   * `stretch` fills it, which is what a model exported that way expects. `contain` keeps the
   * picture's proportions and fills the rest by repeating the edge pixels - a model with a fixed
   * portrait input would otherwise see a landscape photo squeezed to a third of its width, and
   * predict depth for that distorted scene. The area the picture actually occupies is returned so
   * the padding can be cut off the result.
   */
  private fitImage(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    fit: 'stretch' | 'contain'
  ): { pixels: ImageData; content: ContentRect } {
    const source = document.createElement('canvas');
    source.width = imageData.width;
    source.height = imageData.height;
    source.getContext('2d')!.putImageData(imageData, 0, 0);

    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (fit === 'stretch') {
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
      return {
        pixels: ctx.getImageData(0, 0, targetWidth, targetHeight),
        content: { x: 0, y: 0, width: targetWidth, height: targetHeight },
      };
    }

    const scale = Math.min(targetWidth / imageData.width, targetHeight / imageData.height);
    const w = Math.max(1, Math.round(imageData.width * scale));
    const h = Math.max(1, Math.round(imageData.height * scale));
    const x = Math.floor((targetWidth - w) / 2);
    const y = Math.floor((targetHeight - h) / 2);
    ctx.drawImage(source, x, y, w, h);

    // Repeat the outermost row and column outwards. Black bars would read as a wall at the edge
    // of the scene and pull the whole prediction towards it.
    if (x > 0) {
      ctx.drawImage(out, x, y, 1, h, 0, y, x, h);
      ctx.drawImage(out, x + w - 1, y, 1, h, x + w, y, targetWidth - x - w, h);
    }
    if (y > 0) {
      ctx.drawImage(out, x, y, w, 1, x, 0, w, y);
      ctx.drawImage(out, x, y + h - 1, w, 1, x, y + h, w, targetHeight - y - h);
    }
    if (x > 0 && y > 0) {
      ctx.drawImage(out, x, y, 1, 1, 0, 0, x, y);
      ctx.drawImage(out, x + w - 1, y, 1, 1, x + w, 0, targetWidth - x - w, y);
      ctx.drawImage(out, x, y + h - 1, 1, 1, 0, y + h, x, targetHeight - y - h);
      ctx.drawImage(out, x + w - 1, y + h - 1, 1, 1, x + w, y + h, targetWidth - x - w, targetHeight - y - h);
    }

    return {
      pixels: ctx.getImageData(0, 0, targetWidth, targetHeight),
      content: { x, y, width: w, height: h },
    };
  }

  private postprocess(
    outputTensor: any,
    originalImage: ImageData,
    depthMode: DepthMode,
    config: DepthModelConfig,
    input: FittedInput
  ): DepthEstimationResult {
    const width = originalImage.width;
    const height = originalImage.height;
    const tensorData = outputTensor as Float32Array | Uint8Array | Int32Array;
    const full = this.resolveOutputSize(tensorData.length);

    // Cut away whatever padding was added to fit the picture, before anything is measured: the
    // repeated edge pixels are not part of the scene and would skew the depth range.
    const { values, width: outWidth, height: outHeight } = this.cropToContent(tensorData, full, input);
    const pixelCount = outWidth * outHeight;
    const normalized = this.normalizeDepth(values, pixelCount);

    // Everything downstream reads larger as nearer, the MiDaS convention. A model that returns
    // metric depth means the opposite, so it is flipped once, here.
    if ((config.polarity ?? 'inverse') === 'metric') {
      for (let i = 0; i < pixelCount; i++) {
        normalized[i] = 1.0 - normalized[i];
      }
    }

    // Generate the depth map image according to mode
    const outImageData = new ImageData(outWidth, outHeight);

    if (depthMode === 'colored' || depthMode === '3d') {
      // Viridis-inspired colormap for beautiful depth visualization
      for (let i = 0; i < pixelCount; i++) {
        const t = Math.max(0, Math.min(1, normalized[i]));
        const [r, g, b] = this.viridisColor(t);
        outImageData.data[i * 4 + 0] = r;
        outImageData.data[i * 4 + 1] = g;
        outImageData.data[i * 4 + 2] = b;
        outImageData.data[i * 4 + 3] = 255;
      }
    } else {
      // Grayscale mode
      for (let i = 0; i < pixelCount; i++) {
        const value = Math.max(0, Math.min(255, Math.round(normalized[i] * 255)));
        outImageData.data[i * 4 + 0] = value;
        outImageData.data[i * 4 + 1] = value;
        outImageData.data[i * 4 + 2] = value;
        outImageData.data[i * 4 + 3] = 255;
      }
    }

    // Resize to original dimensions
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outWidth;
    tempCanvas.height = outHeight;
    tempCanvas.getContext('2d')!.putImageData(outImageData, 0, 0);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.drawImage(tempCanvas, 0, 0, width, height);

    let depthMap = finalCtx.getImageData(0, 0, width, height);

    // Also resize rawDepth to original dimensions via bilinear interpolation
    const rawDepth = this.resizeDepthMap(normalized, outWidth, outHeight, width, height);

    // Apply advanced depth effects if selected
    if (depthMode === 'portrait-blur') {
      depthMap = this.applyPortraitBlur(originalImage, rawDepth, width, height);
    } else if (depthMode === 'relighting') {
      depthMap = this.applyRelighting(originalImage, rawDepth, width, height);
    } else if (depthMode === 'fog') {
      depthMap = this.applyFog(originalImage, rawDepth, width, height);
    }

    return {
      depthMap,
      rawDepth,
      width,
      height
    };
  }

  private applyPortraitBlur(original: ImageData, rawDepth: Float32Array, width: number, height: number): ImageData {
    // Render blurred version of original image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Put original image on a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext('2d')!.putImageData(original, 0, 0);
    
    // Draw with strong blur
    ctx.filter = 'blur(12px)';
    ctx.drawImage(tempCanvas, 0, 0);
    
    const blurredData = ctx.getImageData(0, 0, width, height);
    const outData = new ImageData(width, height);
    
    // Blend based on depth (closest objects = sharp, furthest = blurred)
    // MiDaS depth: larger values = closer to camera. So normalized=1 is very close, 0 is very far.
    const pixelCount = width * height;
    for (let i = 0; i < pixelCount; i++) {
      // invert depth: 1 = far (blur), 0 = close (sharp)
      const blurBlend = Math.max(0, Math.min(1, 1.0 - rawDepth[i]));
      
      outData.data[i * 4 + 0] = original.data[i * 4 + 0] * (1 - blurBlend) + blurredData.data[i * 4 + 0] * blurBlend;
      outData.data[i * 4 + 1] = original.data[i * 4 + 1] * (1 - blurBlend) + blurredData.data[i * 4 + 1] * blurBlend;
      outData.data[i * 4 + 2] = original.data[i * 4 + 2] * (1 - blurBlend) + blurredData.data[i * 4 + 2] * blurBlend;
      outData.data[i * 4 + 3] = 255;
    }
    
    return outData;
  }

  private applyRelighting(original: ImageData, rawDepth: Float32Array, width: number, height: number): ImageData {
    const outData = new ImageData(width, height);
    
    // Virtual Light vector (coming from top-left, slightly forward)
    const lx = -0.5, ly = -0.5, lz = 1.0;
    const lMag = Math.sqrt(lx*lx + ly*ly + lz*lz);
    const nLx = lx/lMag, nLy = ly/lMag, nLz = lz/lMag;
    
    // Depth scaling factor for normals
    const depthScale = 15.0; 
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        
        // Calculate gradients for surface normal
        const right = x < width - 1 ? rawDepth[y * width + (x + 1)] : rawDepth[i];
        const left = x > 0 ? rawDepth[y * width + (x - 1)] : rawDepth[i];
        const down = y < height - 1 ? rawDepth[(y + 1) * width + x] : rawDepth[i];
        const up = y > 0 ? rawDepth[(y - 1) * width + x] : rawDepth[i];
        
        // dx, dy from depth map
        const dx = (right - left) * depthScale;
        const dy = (down - up) * depthScale;
        
        // Normal vector: (-dx, -dy, 1)
        const nx = -dx, ny = -dy, nz = 1.0;
        const nMag = Math.sqrt(nx*nx + ny*ny + nz*nz);
        const nNx = nx/nMag, nNy = ny/nMag, nNz = nz/nMag;
        
        // Diffuse reflection (dot product of Normal and Light)
        let intensity = Math.max(0, nNx * nLx + nNy * nLy + nNz * nLz);
        
        // Add ambient light and scale
        intensity = 0.3 + intensity * 0.9;
        
        // Multiply blend
        outData.data[i * 4 + 0] = Math.min(255, original.data[i * 4 + 0] * intensity);
        outData.data[i * 4 + 1] = Math.min(255, original.data[i * 4 + 1] * intensity);
        outData.data[i * 4 + 2] = Math.min(255, original.data[i * 4 + 2] * intensity);
        outData.data[i * 4 + 3] = 255;
      }
    }
    
    return outData;
  }

  private applyFog(original: ImageData, rawDepth: Float32Array, width: number, height: number): ImageData {
    const outData = new ImageData(width, height);
    const fogColor = [220, 230, 240]; // Light cool gray/blue
    
    const pixelCount = width * height;
    for (let i = 0; i < pixelCount; i++) {
      // invert depth: 1 = far (max fog), 0 = close (no fog)
      // Apply a curve to make fog denser further back
      let fogBlend = Math.max(0, Math.min(1, 1.0 - rawDepth[i]));
      fogBlend = Math.pow(fogBlend, 1.5); // Exponential fog dropoff
      
      outData.data[i * 4 + 0] = original.data[i * 4 + 0] * (1 - fogBlend) + fogColor[0] * fogBlend;
      outData.data[i * 4 + 1] = original.data[i * 4 + 1] * (1 - fogBlend) + fogColor[1] * fogBlend;
      outData.data[i * 4 + 2] = original.data[i * 4 + 2] * (1 - fogBlend) + fogColor[2] * fogBlend;
      outData.data[i * 4 + 3] = 255;
    }
    
    return outData;
  }

  /**
   * Viridis-inspired colormap: dark purple → blue → teal → green → yellow
   * Maps normalized depth [0..1] to vivid RGB colors.
   */
  private viridisColor(t: number): [number, number, number] {
    // Simplified viridis LUT with 5 control points
    const stops: [number, number, number, number][] = [
      [0.0,  68,   1, 84],
      [0.25, 59,  82, 139],
      [0.5,  33, 145, 140],
      [0.75, 94, 201,  98],
      [1.0, 253, 231,  37],
    ];

    // Find surrounding stops
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }

    const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
    return [
      Math.round(lo[1] + f * (hi[1] - lo[1])),
      Math.round(lo[2] + f * (hi[2] - lo[2])),
      Math.round(lo[3] + f * (hi[3] - lo[3])),
    ];
  }

  /** The part of the model's output that covers the picture, with any padding dropped. */
  private cropToContent(
    data: Float32Array | Uint8Array | Int32Array,
    full: { width: number; height: number },
    input: FittedInput
  ): { values: Float32Array; width: number; height: number } {
    const scaleX = full.width / Math.max(1, input.width);
    const scaleY = full.height / Math.max(1, input.height);
    const x = Math.max(0, Math.round(input.content.x * scaleX));
    const y = Math.max(0, Math.round(input.content.y * scaleY));
    const width = Math.max(1, Math.min(full.width - x, Math.round(input.content.width * scaleX)));
    const height = Math.max(1, Math.min(full.height - y, Math.round(input.content.height * scaleY)));

    if (x === 0 && y === 0 && width === full.width && height === full.height) {
      return { values: Float32Array.from(data as any), width: full.width, height: full.height };
    }

    const values = new Float32Array(width * height);
    for (let row = 0; row < height; row++) {
      const from = (y + row) * full.width + x;
      for (let col = 0; col < width; col++) {
        values[row * width + col] = Number(data[from + col]);
      }
    }
    return { values, width, height };
  }

  private resizeDepthMap(
    src: Float32Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): Float32Array {
    const dst = new Float32Array(dstW * dstH);
    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const sx = x * xRatio;
        const sy = y * yRatio;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, srcW - 1);
        const y1 = Math.min(y0 + 1, srcH - 1);
        const fx = sx - x0;
        const fy = sy - y0;

        const v00 = src[y0 * srcW + x0];
        const v10 = src[y0 * srcW + x1];
        const v01 = src[y1 * srcW + x0];
        const v11 = src[y1 * srcW + x1];

        dst[y * dstW + x] =
          v00 * (1 - fx) * (1 - fy) +
          v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy +
          v11 * fx * fy;
      }
    }

    return dst;
  }

  private resolveInputShape(inputShape?: number[]) {
    const shape = inputShape ? Array.from(inputShape as ArrayLike<number>) : [1, 256, 256, 3];
    const isNchw = shape.length === 4 && shape[1] === 3;
    const height = isNchw ? shape[2] : shape[1];
    const width = isNchw ? shape[3] : shape[2];

    return {
      shape,
      layout: isNchw ? 'NCHW' as const : 'NHWC' as const,
      width: Number(width) || 256,
      height: Number(height) || 256
    };
  }

  private resolveOutputSize(length: number): { width: number; height: number } {
    try {
      const details = this.runtime?.getOutputDetails?.()[0];
      const shape = details?.shape ? Array.from(details.shape as ArrayLike<number>).filter(n => n > 1) : [];
      if (shape.length >= 2) {
        return { height: shape[shape.length - 2], width: shape[shape.length - 1] };
      }
    } catch {
      // Fall through to square inference.
    }

    const side = Math.max(1, Math.round(Math.sqrt(length)));
    return { width: side, height: Math.max(1, Math.floor(length / side)) };
  }

  private normalizeDepth(data: Float32Array | Uint8Array | Int32Array, pixelCount: number): Float32Array {
    const values: number[] = [];
    const limit = Math.min(pixelCount, data.length);

    for (let i = 0; i < limit; i++) {
      const value = Number(data[i]);
      if (Number.isFinite(value)) values.push(value);
    }

    if (values.length === 0) return new Float32Array(pixelCount);

    const sorted = [...values].sort((a, b) => a - b);
    const low = sorted[Math.floor((sorted.length - 1) * 0.02)];
    const high = sorted[Math.floor((sorted.length - 1) * 0.98)];
    const range = high - low || 1;
    const normalized = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const value = i < data.length && Number.isFinite(Number(data[i])) ? Number(data[i]) : low;
      normalized[i] = Math.max(0, Math.min(1, (value - low) / range));
    }

    return normalized;
  }

  private resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tempCanvas, 0, 0, width, height);

    return ctx.getImageData(0, 0, width, height);
  }
}
