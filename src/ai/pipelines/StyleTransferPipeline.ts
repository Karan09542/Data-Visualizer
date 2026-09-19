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

    const transformModelId = options?.modelId && options.modelId !== 'style_predict'
      ? options.modelId
      : 'style_transform';

    const predictRuntime = await aiSessionManager.getRuntime('style_predict', options?.preferredBackend, notify, options?.signal);
    const transformRuntime = await aiSessionManager.getRuntime(transformModelId, options?.preferredBackend, notify, options?.signal);

    notify('preparing-image', 0);
    
    const contentImageData = await imageToImageData(image);
    const styleImageData = await imageToImageData(styleImage);

    const predictInput = predictRuntime.getInputDetails()[0] as TensorInfo | undefined;
    const styleTensorInfo = this.resolveImageTensorInfo(predictInput, 256, 256);
    const styleTensor = this.preprocess(styleImageData, styleTensorInfo, predictInput?.dtype);
    
    notify('preparing-image', 100);
    if (options?.signal?.aborted) throw new Error('AbortError');

    notify('inference', 0);
    const styleBottleneck = await predictRuntime.execute(styleTensor.data, styleTensor.shape);
    
    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 50);

    const transformInputs = transformRuntime.getInputDetails() as TensorInfo[];
    if (transformInputs.length < 2) {
      throw new Error('Style transform model must expose content and style inputs.');
    }

    const contentInputIndex = this.findContentInputIndex(transformInputs);
    const styleInputIndex = transformInputs.findIndex((_, index) => index !== contentInputIndex);
    const contentInput = transformInputs[contentInputIndex];
    const contentTensorInfo = this.resolveImageTensorInfo(contentInput, 384, 384);
    const contentTensor = this.preprocess(contentImageData, contentTensorInfo, contentInput?.dtype);

    const inputs = transformInputs.map((_, index) => index === contentInputIndex ? contentTensor.data : styleBottleneck);
    const inputShapes = transformInputs.map((detail, index) => {
      if (index === contentInputIndex) return contentTensor.shape;
      if (index === styleInputIndex) return this.shapeFromDetails(detail, styleBottleneck.length);
      return this.shapeFromDetails(detail, inputs[index]?.length || 1);
    });

    const outputTensor = await transformRuntime.executeMultiInput(inputs, inputShapes);

    if (options?.signal?.aborted) throw new Error('AbortError');
    notify('inference', 100);

    notify('post-processing', 0);
    const outputInfo = transformRuntime.getOutputDetails()[0] as TensorInfo | undefined;
    const resultImage = this.postprocess(outputTensor, contentImageData.width, contentImageData.height, outputInfo);
    notify('post-processing', 100);

    notify('encoding', 100);

    return { output: resultImage };
  }

  private preprocess(
    imageData: ImageData,
    tensorInfo: ReturnType<StyleTransferPipeline['resolveImageTensorInfo']>,
    dtype: string | undefined
  ): { data: RuntimeTensorData; shape: number[] } {
    const resizedData = this.resizeImageData(imageData, tensorInfo.width, tensorInfo.height);
    const planeSize = tensorInfo.width * tensorInfo.height;
    const data = this.createTensorData(dtype, planeSize * 3);

    for (let i = 0; i < planeSize; i++) {
      const r = resizedData.data[i * 4 + 0];
      const g = resizedData.data[i * 4 + 1];
      const b = resizedData.data[i * 4 + 2];
      const values = dtype === 'uint8' || dtype === 'int32' ? [r, g, b] : [r / 255, g / 255, b / 255];

      if (tensorInfo.layout === 'NCHW') {
        data[i] = values[0];
        data[planeSize + i] = values[1];
        data[planeSize * 2 + i] = values[2];
      } else {
        data[i * 3 + 0] = values[0];
        data[i * 3 + 1] = values[1];
        data[i * 3 + 2] = values[2];
      }
    }
    
    return { data, shape: tensorInfo.shape };
  }

  private postprocess(outputTensor: RuntimeTensorData, width: number, height: number, outputInfo?: TensorInfo): ImageData {
    const tensorInfo = this.resolveImageTensorInfo(outputInfo, 384, 384);
    const outWidth = tensorInfo.width;
    const outHeight = tensorInfo.height;
    const planeSize = outWidth * outHeight;
    const outImageData = new ImageData(outWidth, outHeight);
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

  private findContentInputIndex(inputs: TensorInfo[]): number {
    let bestIndex = 0;
    let bestScore = -Infinity;

    inputs.forEach((input, index) => {
      const name = (input.name || '').toLowerCase();
      const count = this.elementCount(input.shape);
      let score = count;
      if (name.includes('content') || name.includes('image')) score += 1_000_000_000;
      if (count > 1000) score += 1_000_000;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private shapeFromDetails(detail: TensorInfo | undefined, fallbackLength: number): number[] {
    const shape = detail?.shape ? Array.from(detail.shape).map(Number) : [];
    const count = shape.reduce((product, value) => product * Math.max(1, value), 1);
    return shape.length > 0 && count === fallbackLength ? shape : [1, fallbackLength];
  }

  private elementCount(shape: ArrayLike<number> | undefined): number {
    if (!shape) return 0;
    return Array.from(shape).reduce((product, value) => product * Math.max(1, Number(value)), 1);
  }

  private createTensorData(dtype: string | undefined, length: number): RuntimeTensorData {
    if (dtype === 'uint8') return new Uint8Array(length);
    if (dtype === 'int32') return new Int32Array(length);
    return new Float32Array(length);
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
