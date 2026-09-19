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

/**
 * Magenta Arbitrary Image Stylization Pipeline
 * 
 * Two-model pipeline:
 *   1. style_predict  — takes style image [1,256,256,3] → outputs bottleneck [1,1,1,100]
 *   2. style_transform — takes content image [1,384,384,3] + bottleneck [1,1,1,100] → outputs stylized [1,384,384,3]
 *
 * Both models expect float32 input normalised to [0, 1].
 */
export class StyleTransferPipeline implements TaskPipeline {
  async execute(args: PipelineExecutionArgs) {
    const { image, options, onProgress } = args;
    
    const notify = (state: AIProgressState, progress?: number) => {
      if (onProgress) onProgress(state, progress || 0);
    };

    if (options?.signal?.aborted) throw new Error('AbortError');

    const styleImage = options?.metadata?.styleImage;
    if (!styleImage) {
      throw new Error('Style transfer requires a style image in options.metadata.styleImage');
    }

    /* ── Load both models ──────────────────────────────────────────────── */
    const predictRuntime  = await aiSessionManager.getRuntime('style_predict', options?.preferredBackend, notify, options?.signal);
    const transformRuntime = await aiSessionManager.getRuntime('style_transform', options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);
    
    const contentImageData = await imageToImageData(image);
    const styleImageData   = await imageToImageData(styleImage);

    /* ── Step 1: Predict — extract style bottleneck ───────────────────── */

    // Read predict model's input shape (should be [1, 256, 256, 3])
    const predictInputDetails = predictRuntime.getInputDetails();
    const predictInputInfo = this.resolveImageTensorInfo(
      predictInputDetails[0] as TensorInfo | undefined, 256, 256
    );
    
    console.log('[StyleTransfer] Predict model input shape:', predictInputInfo.shape,
      'layout:', predictInputInfo.layout, 'size:', predictInputInfo.width, 'x', predictInputInfo.height);

    const styleTensor = this.preprocess(styleImageData, predictInputInfo);
    
    notify('preparing-image', 100);
    if (options?.signal?.aborted) throw new Error('AbortError');

    notify('inference', 0);
    
    // Run style prediction → bottleneck [1, 1, 1, 100]
    const styleBottleneck = await predictRuntime.execute(styleTensor.data, styleTensor.shape);
    
    console.log('[StyleTransfer] Style bottleneck length:', styleBottleneck.length,
      'type:', styleBottleneck.constructor.name,
      'sample values:', Array.from(styleBottleneck.slice(0, 5)));

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 50);

    /* ── Step 2: Transform — apply style to content ───────────────────── */

    const transformInputDetails = transformRuntime.getInputDetails() as TensorInfo[];
    
    console.log('[StyleTransfer] Transform model inputs:',
      transformInputDetails.map((d, i) => ({
        index: i,
        name: d.name,
        shape: d.shape ? Array.from(d.shape) : 'unknown',
        dtype: d.dtype,
      }))
    );
    
    if (transformInputDetails.length < 2) {
      throw new Error('Style transform model must expose content and style inputs (expected 2 inputs, got ' + transformInputDetails.length + ')');
    }

    // Identify which input is the content image (large shape) and which is the style bottleneck (small shape)
    const contentInputIndex = this.findContentInputIndex(transformInputDetails);
    const styleInputIndex   = transformInputDetails.findIndex((_, i) => i !== contentInputIndex);

    console.log('[StyleTransfer] Content input index:', contentInputIndex, 'Style input index:', styleInputIndex);

    const contentInputInfo = this.resolveImageTensorInfo(
      transformInputDetails[contentInputIndex] as TensorInfo | undefined, 384, 384
    );
    
    console.log('[StyleTransfer] Content input shape:', contentInputInfo.shape,
      'layout:', contentInputInfo.layout, 'size:', contentInputInfo.width, 'x', contentInputInfo.height);
    
    const contentTensor = this.preprocess(contentImageData, contentInputInfo);

    // Build the multi-input arrays in the correct order
    const inputs: RuntimeTensorData[] = [];
    const inputShapes: number[][] = [];

    for (let i = 0; i < transformInputDetails.length; i++) {
      if (i === contentInputIndex) {
        inputs.push(contentTensor.data);
        inputShapes.push(contentTensor.shape);
      } else {
        // This is the style bottleneck input
        // Ensure the bottleneck data matches the expected dtype
        const detail = transformInputDetails[i];
        const expectedShape = detail.shape 
          ? Array.from(detail.shape).map(Number) 
          : [1, 1, 1, styleBottleneck.length];

        // The bottleneck from the predict model should be a Float32Array.
        // Just pass it directly.
        inputs.push(styleBottleneck);
        inputShapes.push(expectedShape);
        
        console.log('[StyleTransfer] Bottleneck input shape:', expectedShape,
          'data length:', styleBottleneck.length,
          'expected elements:', expectedShape.reduce((a, b) => a * Math.max(1, b), 1));
      }
    }

    const outputTensor = await transformRuntime.executeMultiInput(inputs, inputShapes);

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 100);

    /* ── Post-process ─────────────────────────────────────────────────── */

    notify('post-processing', 0);
    const outputInfo = transformRuntime.getOutputDetails()[0] as TensorInfo | undefined;
    
    console.log('[StyleTransfer] Output tensor length:', outputTensor.length,
      'type:', outputTensor.constructor.name,
      'output info shape:', outputInfo?.shape ? Array.from(outputInfo.shape) : 'unknown');

    const resultImage = this.postprocess(outputTensor, contentImageData.width, contentImageData.height, outputInfo);
    notify('post-processing', 100);

    notify('encoding', 100);

    return { output: resultImage };
  }

  /**
   * Preprocess: resize → normalise to [0, 1] → flatten into Float32Array in NHWC order.
   * 
   * The Magenta models always expect float32 inputs normalised to [0, 1], even for fp16
   * quantised variants (the TFLite runtime handles the fp16 conversion internally).
   */
  private preprocess(
    imageData: ImageData,
    tensorInfo: ReturnType<StyleTransferPipeline['resolveImageTensorInfo']>
  ): { data: Float32Array; shape: number[] } {
    const resizedData = this.resizeImageData(imageData, tensorInfo.width, tensorInfo.height);
    const planeSize = tensorInfo.width * tensorInfo.height;
    const data = new Float32Array(planeSize * 3);

    for (let i = 0; i < planeSize; i++) {
      const r = resizedData.data[i * 4 + 0] / 255;
      const g = resizedData.data[i * 4 + 1] / 255;
      const b = resizedData.data[i * 4 + 2] / 255;

      if (tensorInfo.layout === 'NCHW') {
        data[i]                  = r;
        data[planeSize + i]      = g;
        data[planeSize * 2 + i]  = b;
      } else {
        data[i * 3 + 0] = r;
        data[i * 3 + 1] = g;
        data[i * 3 + 2] = b;
      }
    }
    
    return { data, shape: tensorInfo.shape };
  }

  /**
   * Post-process: convert output tensor → ImageData at the original content dimensions.
   */
  private postprocess(outputTensor: RuntimeTensorData, width: number, height: number, outputInfo?: TensorInfo): ImageData {
    const tensorInfo = this.resolveImageTensorInfo(outputInfo, 384, 384);
    const outWidth  = tensorInfo.width;
    const outHeight = tensorInfo.height;
    const planeSize = outWidth * outHeight;
    const outImageData = new ImageData(outWidth, outHeight);
    
    // Detect if values are in [0, 255] (byte-scaled) or [0, 1] (normalised)
    const byteScaled = !(outputTensor instanceof Float32Array) || this.maxSample(outputTensor) > 2;

    for (let i = 0; i < planeSize; i++) {
      const r = this.readChannel(outputTensor, tensorInfo.layout, i, 0, planeSize);
      const g = this.readChannel(outputTensor, tensorInfo.layout, i, 1, planeSize);
      const b = this.readChannel(outputTensor, tensorInfo.layout, i, 2, planeSize);

      outImageData.data[i * 4 + 0] = this.toByte(r, byteScaled);
      outImageData.data[i * 4 + 1] = this.toByte(g, byteScaled);
      outImageData.data[i * 4 + 2] = this.toByte(b, byteScaled);
      outImageData.data[i * 4 + 3] = 255;
    }
    
    // Resize from model output dimensions to original content dimensions
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
    
    return finalCtx.getImageData(0, 0, width, height);
  }

  /**
   * Read model input metadata and resolve actual width/height/layout.
   */
  private resolveImageTensorInfo(detail: TensorInfo | undefined, fallbackWidth: number, fallbackHeight: number) {
    const shape = detail?.shape ? Array.from(detail.shape).map(Number) : [1, fallbackHeight, fallbackWidth, 3];
    const isNchw = shape.length === 4 && shape[1] === 3;
    const height = isNchw ? shape[2] : shape[1];
    const width  = isNchw ? shape[3] : shape[2];

    return {
      shape,
      layout: isNchw ? 'NCHW' as const : 'NHWC' as const,
      width:  Number(width)  > 0 ? Number(width)  : fallbackWidth,
      height: Number(height) > 0 ? Number(height) : fallbackHeight
    };
  }

  /**
   * Find the content image input (the one with the most elements — images are large, bottlenecks are small).
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

  private toByte(value: number, byteScaled: boolean): number {
    const scaled = byteScaled ? value : value * 255;
    return Math.max(0, Math.min(255, Math.round(scaled)));
  }

  private maxSample(data: RuntimeTensorData): number {
    const limit = Math.min(data.length, 4096);
    let max = -Infinity;
    for (let i = 0; i < limit; i++) max = Math.max(max, Number(data[i]));
    return max;
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
