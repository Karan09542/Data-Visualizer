import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState, DepthEstimationResult } from '../types';
import { LiteRTRuntime } from '../runtime/LiteRTRuntime';

type DepthMode = 'grayscale' | 'colored' | '3d';

export class DepthEstimationPipeline implements TaskPipeline {
  private runtime: LiteRTRuntime | null = null;

  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;

    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };

    if (options?.signal?.aborted) throw new Error('AbortError');

    const modelId = options?.modelId || 'midas_small';
    const depthMode: DepthMode = (options?.metadata?.depthMode as DepthMode) || 'colored';

    this.runtime = await aiSessionManager.getRuntime(modelId, options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);
    const imageData = await imageToImageData(image);

    let inputShape: number[] | undefined;
    try {
      const details = (this.runtime as any).session?.getInputDetails?.();
      if (details && details.length > 0) inputShape = details[0].shape as number[];
    } catch (e) {}

    const inputResult = this.preprocess(imageData, inputShape);
    notify('preparing-image', 100);

    if (options?.signal?.aborted) throw new Error('AbortError');

    notify('inference', 0);
    const outputTensor = await this.runtime.execute(inputResult.data, inputResult.shape);

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 100);

    notify('post-processing', 0);
    const result = this.postprocess(outputTensor, imageData.width, imageData.height, depthMode);
    notify('post-processing', 100);

    notify('encoding', 100);

    return {
      output: result
    };
  }

  private preprocess(imageData: ImageData, inputShape?: number[]): { data: Float32Array; shape: number[] } {
    const { width: targetWidth, height: targetHeight, layout, shape } = this.resolveInputShape(inputShape);

    const resizedData = this.resizeImageData(imageData, targetWidth, targetHeight);
    const float32Data = new Float32Array(targetWidth * targetHeight * 3);

    // MiDaS expects ImageNet-normalized RGB
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
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

    return { data: float32Data, shape };
  }

  private postprocess(
    outputTensor: any,
    width: number,
    height: number,
    depthMode: DepthMode
  ): DepthEstimationResult {
    const tensorData = outputTensor as Float32Array | Uint8Array | Int32Array;
    const { width: outWidth, height: outHeight } = this.resolveOutputSize(tensorData.length);
    const pixelCount = outWidth * outHeight;
    const normalized = this.normalizeDepth(tensorData, pixelCount);

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

    const depthMap = finalCtx.getImageData(0, 0, width, height);

    // Also resize rawDepth to original dimensions via bilinear interpolation
    const rawDepth = this.resizeDepthMap(normalized, outWidth, outHeight, width, height);

    return {
      depthMap,
      rawDepth,
      width,
      height
    };
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
