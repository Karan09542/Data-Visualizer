import { ImagePipeline } from './ImagePipeline';
import { ModelConfig } from '../config/ModelConfig';
import { PipelineExecutionArgs } from '../registry/TaskRegistry';
import { aiSessionManager } from '../runtime/AISessionManager';
import { imageToImageData } from '../utils';
import { AIProgressState } from '../types';

export class UpscalePipeline extends ImagePipeline {
  protected modelId = 'vdsr';
  private bicubicData: ImageData | null = null;
  private config?: ModelConfig;

  public setModelConfig(config: ModelConfig) {
    this.config = config;
  }

  // Fallback default config for the original ESRGAN model if no custom config is provided
  private get defaultEsrganConfig(): ModelConfig {
    return {
      id: 'esrgan',
      name: 'ESRGAN',
      requiresTiling: false,
      preprocessing: {
        normalization: 'raw_255',
        channels: 3
      },
      postprocessing: {
        outputNormalized: false,
        channelOrder: 'RGB'
      }
    };
  }

  protected preprocess(imageData: ImageData, inputShape?: number[]): any {
    if (this.modelId === 'vdsr') {
      return this.preprocessVdsr(imageData, inputShape);
    }
    return this.preprocessDynamic(imageData, inputShape);
  }

  protected postprocess(outputTensor: any, width: number, height: number): ImageData {
    if (this.modelId === 'vdsr') {
      return this.postprocessVdsr(outputTensor);
    }
    return this.postprocessDynamic(outputTensor, width, height);
  }

  private preprocessDynamic(imageData: ImageData, inputShape?: number[]): any {
    const config = this.config || this.defaultEsrganConfig;
    let targetH = imageData.height;
    let targetW = imageData.width;

    if (inputShape && inputShape.length === 4 && inputShape[1] > 0 && inputShape[2] > 0) {
      targetH = inputShape[1];
      targetW = inputShape[2];
    }

    let targetData = imageData;
    if (targetH !== imageData.height || targetW !== imageData.width) {
      const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
      const origCtx = origCanvas.getContext('2d')!;
      origCtx.putImageData(imageData, 0, 0);

      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(origCanvas, 0, 0, targetW, targetH);
      targetData = ctx.getImageData(0, 0, targetW, targetH);
    }

    const numPixels = targetW * targetH;
    const channels = config.preprocessing.channels;
    const tensorData = new Float32Array(numPixels * channels);
    const norm = config.preprocessing.normalization;

    for (let i = 0; i < numPixels; i++) {
      let r = targetData.data[i * 4 + 0];
      let g = targetData.data[i * 4 + 1];
      let b = targetData.data[i * 4 + 2];

      if (norm === 'zero_to_one') {
        r /= 255.0;
        g /= 255.0;
        b /= 255.0;
      } else if (norm === 'minus_one_to_one') {
        r = r / 127.5 - 1.0;
        g = g / 127.5 - 1.0;
        b = b / 127.5 - 1.0;
      }

      const isBGR = config.postprocessing.channelOrder === 'BGR';

      tensorData[i * channels + 0] = isBGR ? b : r;
      if (channels > 1) {
        tensorData[i * channels + 1] = g;
        tensorData[i * channels + 2] = isBGR ? r : b;
      }
      if (channels > 3) {
        tensorData[i * channels + 3] = targetData.data[i * 4 + 3] / (norm === 'zero_to_one' ? 255.0 : norm === 'minus_one_to_one' ? 127.5 - 1.0 : 1.0);
      }
    }

    return {
      data: tensorData,
      shape: [1, targetH, targetW, channels]
    };
  }

  private postprocessDynamic(outputTensor: any, width: number, height: number): ImageData {
    const config = this.config || this.defaultEsrganConfig;
    const rawData: Float32Array = outputTensor.data ? outputTensor.data : outputTensor;
    
    const rawNumPixels = rawData.length / config.preprocessing.channels;
    let outW = width;
    let outH = height;
    
    if (outW * outH !== rawNumPixels) {
      const scale = Math.round(Math.sqrt(rawNumPixels / (width * height)));
      outW = width * (scale || 1);
      outH = height * (scale || 1);
    }
    
    const outImageData = new ImageData(outW, outH);
    const outData = outImageData.data;

    const multiplier = config.postprocessing.outputNormalized ? 255.0 : 1.0;

    // Failsafe: if the user misconfigured the output normalization, try to auto-detect it.
    // If output is clearly [0, 1] but they didn't check it, force 255.0.
    let finalMultiplier = multiplier;
    if (rawNumPixels > 10) {
      const sampleMax = Math.max(Math.abs(rawData[0]), Math.abs(rawData[5]), Math.abs(rawData[10]));
      if (sampleMax <= 1.0 && !config.postprocessing.outputNormalized) {
        finalMultiplier = 255.0; 
      } else if (sampleMax > 5.0 && config.postprocessing.outputNormalized) {
        finalMultiplier = 1.0;
      }
    }

    const isBGR = config.postprocessing.channelOrder === 'BGR';

    for (let i = 0; i < rawNumPixels; i++) {
      let r = rawData[i * 3 + (isBGR ? 2 : 0)] * finalMultiplier;
      let g = rawData[i * 3 + 1] * finalMultiplier;
      let b = rawData[i * 3 + (isBGR ? 0 : 2)] * finalMultiplier;

      outData[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(r)));
      outData[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      outData[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      outData[i * 4 + 3] = 255;
    }

    return outImageData;
  }

  public async execute(args: PipelineExecutionArgs) {
    if (args.options?.modelId) {
      this.modelId = args.options.modelId;
    }

    const { modelRegistry } = await import('../registry/ModelRegistry');
    const manifest = modelRegistry.get(this.modelId);
    if (manifest?.customConfig) {
      this.config = manifest.customConfig;
    }

    if (this.modelId === 'vdsr' || (!this.config?.requiresTiling)) {
      return super.execute(args);
    }

    const notify = (state: AIProgressState, progress?: number) => {
      if (args.onProgress) args.onProgress(state, progress || 0);
    };

    this.runtime = await aiSessionManager.getRuntime(this.modelId, args.options?.preferredBackend, notify);

    // Auto-detect if the model has a hardcoded fixed input shape (e.g. [1, 64, 64, 3])
    // If so, force the tiling engine to use those exact dimensions to prevent tensor size mismatch crashes.
    try {
      const details = (this.runtime as any).session?.getInputDetails?.();
      if (details && details.length > 0) {
        const expectedShape = details[0].shape as number[];
        if (expectedShape.length === 4 && expectedShape[1] > 1 && expectedShape[2] > 1) {
          if (this.config?.tileSize) {
            this.config.tileSize.inputHeight = expectedShape[1];
            this.config.tileSize.inputWidth = expectedShape[2];
          }
        }
      }
    } catch (e) {
      console.warn("Could not read model input details for dynamic tile sizing.");
    }

    const { inputWidth, inputHeight, outputScaleFactor } = this.config.tileSize!;

    notify('preparing-image', 0);
    const src = await imageToImageData(args.image);
    notify('preparing-image', 100);

    const outWidth = src.width * outputScaleFactor;
    const outHeight = src.height * outputScaleFactor;

    const outputCanvas = new OffscreenCanvas(outWidth, outHeight);
    const outputCtx = outputCanvas.getContext('2d')!;

    const srcCanvas = new OffscreenCanvas(src.width, src.height);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(src, 0, 0);

    notify('inference', 0);
    const overlap = this.config.tileSize?.overlap ?? 16;
    const strideX = Math.max(1, inputWidth - overlap * 2);
    const strideY = Math.max(1, inputHeight - overlap * 2);
    const totalTiles = Math.ceil(src.height / strideY) * Math.ceil(src.width / strideX);
    let tilesDone = 0;

    for (let y = 0; y < src.height; y += strideY) {
      for (let x = 0; x < src.width; x += strideX) {
        // Yield to event loop to process UI clicks (like Cancel button) and allow React to render
        await new Promise(resolve => setTimeout(resolve, 5));

        if (args.options?.signal?.aborted) {
          throw new Error('AbortError');
        }

        // 1. Calculate the target "box" we want to fill in the original image
        const boxW = Math.min(strideX, src.width - x);
        const boxH = Math.min(strideY, src.height - y);

        // 2. Clamp the 128x128 extraction window inside the source image bounds
        let extractX = x - overlap;
        let extractY = y - overlap;

        if (src.width >= inputWidth) {
          extractX = Math.max(0, Math.min(src.width - inputWidth, extractX));
        } else {
          extractX = 0;
        }

        if (src.height >= inputHeight) {
          extractY = Math.max(0, Math.min(src.height - inputHeight, extractY));
        } else {
          extractY = 0;
        }

        const tileCanvas = new OffscreenCanvas(inputWidth, inputHeight);
        const tileCtx = tileCanvas.getContext('2d')!;
        
        // Handle images smaller than the input window by stretching them to fit.
        // This avoids padding with black borders that cause artifacts.
        if (src.width < inputWidth || src.height < inputHeight) {
           tileCtx.drawImage(srcCanvas, 0, 0, src.width, src.height, 0, 0, inputWidth, inputHeight);
        } else {
           tileCtx.drawImage(
             srcCanvas, 
             extractX, extractY, inputWidth, inputHeight, 
             0, 0, inputWidth, inputHeight
           );
        }

        const tileImageData = tileCtx.getImageData(0, 0, inputWidth, inputHeight);
        
        const inputResult = this.preprocessDynamic(tileImageData, [1, inputHeight, inputWidth, this.config.preprocessing.channels]);
        const inputTensor = inputResult.data;
        const actualShape = inputResult.shape;

        const rawOutput = await this.runtime.execute(inputTensor, actualShape);

        const targetTileWidth = inputWidth * outputScaleFactor;
        const targetTileHeight = inputHeight * outputScaleFactor;
        const processedTile = this.postprocessDynamic(rawOutput, targetTileWidth, targetTileHeight);

        const tileOutputCanvas = new OffscreenCanvas(targetTileWidth, targetTileHeight);
        tileOutputCanvas.getContext('2d')!.putImageData(processedTile, 0, 0);

        // 5. Calculate internal crop offsets relative to the clamped extraction point
        const internalX = x - extractX;
        const internalY = y - extractY;
        
        if (src.width < inputWidth || src.height < inputHeight) {
           // If we stretched a smaller image, we draw the whole output canvas scaled to the target bounds
           outputCtx.drawImage(tileOutputCanvas, 0, 0, targetTileWidth, targetTileHeight, 0, 0, outWidth, outHeight);
        } else {
           const cropX = internalX * outputScaleFactor;
           const cropY = internalY * outputScaleFactor;
           const cropW = boxW * outputScaleFactor;
           const cropH = boxH * outputScaleFactor;

           outputCtx.drawImage(
             tileOutputCanvas,
             cropX, cropY, cropW, cropH,
             x * outputScaleFactor, y * outputScaleFactor, cropW, cropH
           );
        }

        tilesDone++;
        notify('inference', Math.round((tilesDone / totalTiles) * 100));
      }
    }

    notify('post-processing', 100);
    notify('encoding', 100);

    return { output: outputCtx.getImageData(0, 0, outWidth, outHeight) };
  }

  // --- VDSR Implementation below (kept for legacy support) ---
  private targetChannels = 3;
  private preprocessVdsr(imageData: ImageData, inputShape?: number[]): any {
    const targetH = inputShape && inputShape.length === 4 ? inputShape[1] : 256;
    const targetW = inputShape && inputShape.length === 4 ? inputShape[2] : 256;
    this.targetChannels = inputShape && inputShape.length === 4 ? inputShape[3] : 3;

    const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const origCtx = origCanvas.getContext('2d')!;
    origCtx.putImageData(imageData, 0, 0);

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origCanvas, 0, 0, targetW, targetH);
    
    this.bicubicData = ctx.getImageData(0, 0, targetW, targetH);
    const numPixels = targetW * targetH;

    const tensorData = new Float32Array(numPixels * this.targetChannels);

    for (let i = 0; i < numPixels; i++) {
      let r = this.bicubicData.data[i * 4 + 0];
      let g = this.bicubicData.data[i * 4 + 1];
      let b = this.bicubicData.data[i * 4 + 2];

      if (this.targetChannels === 1) {
        let y = 0.299 * r + 0.587 * g + 0.114 * b;
        tensorData[i] = y / 255.0;
      } else {
        tensorData[i * 3 + 0] = r / 255.0;
        tensorData[i * 3 + 1] = g / 255.0;
        tensorData[i * 3 + 2] = b / 255.0;
      }
    }
    return { data: tensorData, shape: [1, targetH, targetW, this.targetChannels] };
  }

  private postprocessVdsr(outputTensor: any): ImageData {
    if (!this.bicubicData) {
      throw new Error("Missing bicubic data from preprocess step.");
    }
    const outW = this.bicubicData.width;
    const outH = this.bicubicData.height;
    const numPixels = outW * outH;
    const outImageData = new ImageData(outW, outH);
    const outData = outImageData.data;
    const origData = this.bicubicData.data;

    for (let i = 0; i < numPixels; i++) {
      if (this.targetChannels === 1) {
        let r = origData[i * 4 + 0];
        let g = origData[i * 4 + 1];
        let b = origData[i * 4 + 2];

        let cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        let cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
        let y = outputTensor[i] * 255.0;

        let newR = y + 1.402 * (cr - 128);
        let newG = y - 0.34414 * (cb - 128) - 0.71414 * (cr - 128);
        let newB = y + 1.772 * (cb - 128);

        outData[i * 4 + 0] = Math.max(0, Math.min(255, newR));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, newG));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, newB));
      } else {
        outData[i * 4 + 0] = Math.max(0, Math.min(255, outputTensor[i * 3 + 0] * 255.0));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, outputTensor[i * 3 + 1] * 255.0));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, outputTensor[i * 3 + 2] * 255.0));
      }
      outData[i * 4 + 3] = 255;
    }
    return outImageData;
  }
}
