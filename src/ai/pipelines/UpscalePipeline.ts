import { ImagePipeline } from './ImagePipeline';


export class UpscalePipeline extends ImagePipeline {
  protected modelId = 'vdsr';
  private bicubicData: ImageData | null = null;
  private targetChannels = 3;

  protected preprocess(imageData: ImageData, inputShape?: number[]): Float32Array {
    if (this.modelId === 'esrgan') {
      return this.preprocessEsrgan(imageData, inputShape);
    }
    return this.preprocessVdsr(imageData, inputShape);
  }

  protected postprocess(outputTensor: any, width: number, height: number): ImageData {
    if (this.modelId === 'esrgan') {
      return this.postprocessEsrgan(outputTensor);
    }
    return this.postprocessVdsr(outputTensor);
  }

  private esrganBaseWidth = 0;
  private esrganBaseHeight = 0;

  private preprocessEsrgan(imageData: ImageData, inputShape?: number[]): Float32Array {
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
    
    this.esrganBaseWidth = targetW;
    this.esrganBaseHeight = targetH;

    const numPixels = targetW * targetH;
    const tensorData = new Float32Array(numPixels * 3);
    
    for (let i = 0; i < numPixels; i++) {
       tensorData[i * 3 + 0] = targetData.data[i * 4 + 0] / 255.0;
       tensorData[i * 3 + 1] = targetData.data[i * 4 + 1] / 255.0;
       tensorData[i * 3 + 2] = targetData.data[i * 4 + 2] / 255.0;
    }
    return {
      data: tensorData,
      shape: [1, targetH, targetW, 3]
    } as any;
  }

  private postprocessEsrgan(outputTensor: any): ImageData {
    const numPixels = outputTensor.length / 3;
    const scale = Math.round(Math.sqrt(numPixels / (this.esrganBaseWidth * this.esrganBaseHeight)));
    const outW = this.esrganBaseWidth * (scale || 1);
    const outH = this.esrganBaseHeight * (scale || 1);
    
    const outImageData = new ImageData(outW, outH);
    const outData = outImageData.data;
    
    for (let i = 0; i < numPixels; i++) {
      outData[i * 4 + 0] = Math.max(0, Math.min(255, outputTensor[i * 3 + 0] * 255.0));
      outData[i * 4 + 1] = Math.max(0, Math.min(255, outputTensor[i * 3 + 1] * 255.0));
      outData[i * 4 + 2] = Math.max(0, Math.min(255, outputTensor[i * 3 + 2] * 255.0));
      outData[i * 4 + 3] = 255;
    }
    
    return outImageData;
  }

  private preprocessVdsr(imageData: ImageData, inputShape?: number[]): Float32Array {
    // Expected shape: [1, Height, Width, Channels]
    const targetH = inputShape && inputShape.length === 4 ? inputShape[1] : 256;
    const targetW = inputShape && inputShape.length === 4 ? inputShape[2] : 256;
    this.targetChannels = inputShape && inputShape.length === 4 ? inputShape[3] : 3;

    // Use OffscreenCanvas to bicubic resize to target dimensions
    const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const origCtx = origCanvas.getContext('2d')!;
    origCtx.putImageData(imageData, 0, 0);

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d')!;
    // Enable high-quality image smoothing for bicubic-like interpolation
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
        // Luminance (Y) channel only for VDSR
        let y = 0.299 * r + 0.587 * g + 0.114 * b;
        tensorData[i] = y / 255.0;
      } else {
        // RGB
        tensorData[i * 3 + 0] = r / 255.0;
        tensorData[i * 3 + 1] = g / 255.0;
        tensorData[i * 3 + 2] = b / 255.0;
      }
    }
    return {
      data: tensorData,
      shape: [1, targetH, targetW, this.targetChannels]
    } as any;
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
        // Reconstruct RGB from AI-predicted Y and Original Cb/Cr
        let r = origData[i * 4 + 0];
        let g = origData[i * 4 + 1];
        let b = origData[i * 4 + 2];

        // Standard RGB to YCbCr conversion
        let cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        let cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

        // The VDSR TFLite model already includes the residual addition in its graph.
        // The output is the final high-res Y channel normalized to [0, 1].
        let y = outputTensor[i] * 255.0;

        // Convert back to RGB
        let newR = y + 1.402 * (cr - 128);
        let newG = y - 0.34414 * (cb - 128) - 0.71414 * (cr - 128);
        let newB = y + 1.772 * (cb - 128);

        outData[i * 4 + 0] = Math.max(0, Math.min(255, newR));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, newG));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, newB));
      } else {
        // Reconstruct RGB directly
        outData[i * 4 + 0] = Math.max(0, Math.min(255, outputTensor[i * 3 + 0] * 255.0));
        outData[i * 4 + 1] = Math.max(0, Math.min(255, outputTensor[i * 3 + 1] * 255.0));
        outData[i * 4 + 2] = Math.max(0, Math.min(255, outputTensor[i * 3 + 2] * 255.0));
      }
      
      outData[i * 4 + 3] = 255; // Alpha
    }

    return outImageData;
  }
}
