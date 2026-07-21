import { ImagePipeline } from './ImagePipeline';
import { PipelineExecutionArgs } from '../registry/TaskRegistry';

export class LowLightPipeline extends ImagePipeline {
  protected modelId = 'mirnet';
  
  async execute(args: PipelineExecutionArgs) {
    args.options = { ...args.options, preferredBackend: 'wasm' };
    return super.execute(args);
  }
  
  private mirnetBaseWidth = 0;
  private mirnetBaseHeight = 0;
  private mirnetIsNCHW = false;
  private mirnetCropBox = { x: 0, y: 0, w: 0, h: 0 };

  protected preprocess(imageData: ImageData, inputShape?: number[]): Float32Array {
    return this.preprocessMirnet(imageData, inputShape);
  }

  protected postprocess(outputTensor: any, width: number, height: number): ImageData {
    return this.postprocessMirnet(outputTensor);
  }

  private preprocessMirnet(imageData: ImageData, inputShape?: number[]): Float32Array {
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
    
    this.mirnetCropBox = { x: offsetX, y: offsetY, w: drawW, h: drawH };

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
    
    this.mirnetBaseWidth = targetW;
    this.mirnetBaseHeight = targetH;
    this.mirnetIsNCHW = isNCHW;

    const numPixels = targetW * targetH;
    const tensorData = new Float32Array(numPixels * 3);
    
    if (isNCHW) {
      for (let i = 0; i < numPixels; i++) {
        tensorData[i] = targetData.data[i * 4 + 0] / 255.0;
        tensorData[numPixels + i] = targetData.data[i * 4 + 1] / 255.0;
        tensorData[numPixels * 2 + i] = targetData.data[i * 4 + 2] / 255.0;
      }
    } else {
      for (let i = 0; i < numPixels; i++) {
         tensorData[i * 3 + 0] = targetData.data[i * 4 + 0] / 255.0;
         tensorData[i * 3 + 1] = targetData.data[i * 4 + 1] / 255.0;
         tensorData[i * 3 + 2] = targetData.data[i * 4 + 2] / 255.0;
      }
    }
    
    return {
      data: tensorData,
      shape: isNCHW ? [1, 3, targetH, targetW] : [1, targetH, targetW, 3]
    } as any;
  }

  private postprocessMirnet(outputTensor: any): ImageData {
    const numPixels = outputTensor.length / 3;
    const outW = this.mirnetBaseWidth;
    const outH = this.mirnetBaseHeight;
    
    const outImageData = new ImageData(outW, outH);
    const outData = outImageData.data;
    
    if (this.mirnetIsNCHW) {
      for (let i = 0; i < numPixels; i++) {
        outData[i * 4 + 0] = Math.max(0, Math.min(255, outputTensor[i] * 255.0));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, outputTensor[numPixels + i] * 255.0));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, outputTensor[numPixels * 2 + i] * 255.0));
        outData[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < numPixels; i++) {
        outData[i * 4 + 0] = Math.max(0, Math.min(255, outputTensor[i * 3 + 0] * 255.0));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, outputTensor[i * 3 + 1] * 255.0));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, outputTensor[i * 3 + 2] * 255.0));
        outData[i * 4 + 3] = 255;
      }
    }
    
    // Crop back the active region to restore exact original aspect ratio
    if (this.mirnetCropBox.w > 0 && this.mirnetCropBox.h > 0 && 
        (this.mirnetCropBox.w !== outW || this.mirnetCropBox.h !== outH)) {
      const croppedCanvas = new OffscreenCanvas(this.mirnetCropBox.w, this.mirnetCropBox.h);
      const croppedCtx = croppedCanvas.getContext('2d')!;
      const fullCanvas = new OffscreenCanvas(outW, outH);
      const fullCtx = fullCanvas.getContext('2d')!;
      
      fullCtx.putImageData(outImageData, 0, 0);
      croppedCtx.drawImage(
        fullCanvas, 
        this.mirnetCropBox.x, this.mirnetCropBox.y, this.mirnetCropBox.w, this.mirnetCropBox.h,
        0, 0, this.mirnetCropBox.w, this.mirnetCropBox.h
      );
      return croppedCtx.getImageData(0, 0, this.mirnetCropBox.w, this.mirnetCropBox.h);
    }
    
    return outImageData;
  }
}
