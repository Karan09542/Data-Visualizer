import { ImagePipeline } from './ImagePipeline';

export class BackgroundRemovalPipeline extends ImagePipeline {
  protected modelId = 'ormbg';

  protected lastTargetWidth = 1024;
  protected lastTargetHeight = 1024;
  protected isNCHW = false;

  // BRIA and U2-Net stretch the image into the input square; ORMBG letterboxes
  // it. That decides how the mask is mapped back, so postprocess checks it too.
  protected get usesStretchResize(): boolean {
    return this.modelId === 'u2netp' || this.modelId.startsWith('bria');
  }

  protected preprocess(imageData: ImageData, inputShape?: number[]): any {
    if (this.modelId === 'u2netp') {
      return this.preprocessU2netp(imageData, inputShape);
    }
    if (this.modelId.startsWith('bria')) {
      return this.preprocessBria(imageData, inputShape);
    }
    return this.preprocessOrmbg(imageData, inputShape);
  }

  protected postprocess(outputTensor: any, width: number, height: number, originalImageData?: ImageData): ImageData {
    const maskData = outputTensor instanceof Float32Array ? outputTensor : null;

    if (!maskData || maskData.length === 0) {
      console.warn("Background Removal model returned empty output.");
      return originalImageData || new ImageData(width, height);
    }

    let maskImageData: ImageData;

    if (this.usesStretchResize) {
      // The image was stretched into the input square, so the mask is already
      // in the original aspect ratio - stretch it back to width/height.
      maskImageData = this.postprocessU2netp(maskData);
      const outW = maskImageData.width;
      const outH = maskImageData.height;
      
      const maskCanvas = new OffscreenCanvas(outW, outH);
      maskCanvas.getContext('2d')!.putImageData(maskImageData, 0, 0);
      
      const croppedMaskCanvas = new OffscreenCanvas(width, height);
      const croppedCtx = croppedMaskCanvas.getContext('2d')!;
      croppedCtx.imageSmoothingEnabled = true;
      croppedCtx.imageSmoothingQuality = 'high';
      
      // Directly stretch the mask to original dimensions
      croppedCtx.drawImage(maskCanvas, 0, 0, outW, outH, 0, 0, width, height);
      const resizedMaskData = croppedCtx.getImageData(0, 0, width, height);
      
      const result = new ImageData(width, height);
      if (originalImageData) {
        for (let i = 0; i < width * height; i++) {
          const origAlpha = originalImageData.data[i * 4 + 3];
          const maskAlpha = resizedMaskData.data[i * 4 + 3];
          result.data[i * 4] = originalImageData.data[i * 4];
          result.data[i * 4 + 1] = originalImageData.data[i * 4 + 1];
          result.data[i * 4 + 2] = originalImageData.data[i * 4 + 2];
          result.data[i * 4 + 3] = Math.round((origAlpha * maskAlpha) / 255);
        }
        return result;
      }
      return resizedMaskData;
    }

    maskImageData = this.postprocessOrmbg(maskData);

    // Un-letterbox and resize mask back to original width/height for ORMBG
    const outW = maskImageData.width;
    const outH = maskImageData.height;

    const maskCanvas = new OffscreenCanvas(outW, outH);
    maskCanvas.getContext('2d')!.putImageData(maskImageData, 0, 0);

    const croppedMaskCanvas = new OffscreenCanvas(width, height);
    const croppedCtx = croppedMaskCanvas.getContext('2d')!;

    // Use high-quality smoothing for upscaling the mask to prevent jagged edges
    croppedCtx.imageSmoothingEnabled = true;
    croppedCtx.imageSmoothingQuality = 'high';

    const renderScale = Math.min(outW / width, outH / height);
    const renderNewWidth = width * renderScale;
    const renderNewHeight = height * renderScale;
    const renderOffsetX = (outW - renderNewWidth) / 2;
    const renderOffsetY = (outH - renderNewHeight) / 2;

    croppedCtx.drawImage(
      maskCanvas,
      renderOffsetX, renderOffsetY, renderNewWidth, renderNewHeight,
      0, 0, width, height
    );

    const resizedMaskData = croppedCtx.getImageData(0, 0, width, height);

    // Pixel-by-pixel compositing
    const result = new ImageData(width, height);
    if (originalImageData) {
      for (let i = 0; i < width * height; i++) {
        const origAlpha = originalImageData.data[i * 4 + 3];
        const maskAlpha = resizedMaskData.data[i * 4 + 3];

        result.data[i * 4] = originalImageData.data[i * 4];
        result.data[i * 4 + 1] = originalImageData.data[i * 4 + 1];
        result.data[i * 4 + 2] = originalImageData.data[i * 4 + 2];
        result.data[i * 4 + 3] = Math.round((origAlpha * maskAlpha) / 255);
      }
      return result;
    }

    return resizedMaskData;
  }


  private preprocessOrmbg(imageData: ImageData, inputShape?: number[]): Float32Array {
    let targetWidth = 1024;
    let targetHeight = 1024;
    this.isNCHW = false;

    if (inputShape && inputShape.length === 4) {
      if (inputShape[1] === 3 || inputShape[1] === 1) {
        this.isNCHW = true;
        targetHeight = inputShape[2];
        targetWidth = inputShape[3];
      } else {
        targetHeight = inputShape[1];
        targetWidth = inputShape[2];
      }
    }

    this.lastTargetWidth = targetWidth;
    this.lastTargetHeight = targetHeight;

    const { resizedData } = this.letterboxImage(imageData, targetWidth, targetHeight);

    const float32Data = new Float32Array(targetWidth * targetHeight * 3);
    const numPixels = targetWidth * targetHeight;

    for (let p = 0; p < numPixels; p++) {
      const srcIdx = p * 4;
      // Standard / ORMBG Normalization: val / 255.0 -> [0, 1]
      const r = resizedData.data[srcIdx] / 255.0;
      const g = resizedData.data[srcIdx + 1] / 255.0;
      const b = resizedData.data[srcIdx + 2] / 255.0;

      if (this.isNCHW) {
        float32Data[p] = r;
        float32Data[numPixels + p] = g;
        float32Data[numPixels * 2 + p] = b;
      } else {
        const dstIdx = p * 3;
        float32Data[dstIdx] = r;
        float32Data[dstIdx + 1] = g;
        float32Data[dstIdx + 2] = b;
      }
    }

    return float32Data;
  }

  private preprocessBria(imageData: ImageData, inputShape?: number[]): Float32Array {
    let targetWidth = 1024;
    let targetHeight = 1024;
    this.isNCHW = false;

    if (inputShape && inputShape.length === 4) {
      if (inputShape[1] === 3 || inputShape[1] === 1) {
        this.isNCHW = true;
        targetHeight = inputShape[2];
        targetWidth = inputShape[3];
      } else {
        targetHeight = inputShape[1];
        targetWidth = inputShape[2];
      }
    }

    this.lastTargetWidth = targetWidth;
    this.lastTargetHeight = targetHeight;

    // RMBG-1.4 resizes with a plain bilinear interpolate, not a letterbox.
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    origCanvas.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.drawImage(origCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);

    const float32Data = new Float32Array(targetWidth * targetHeight * 3);
    const numPixels = targetWidth * targetHeight;

    for (let p = 0; p < numPixels; p++) {
      const srcIdx = p * 4;
      // RMBG-1.4 normalization: val / 255 then mean 0.5 / std 1.0 -> [-0.5, 0.5]
      const r = resizedData.data[srcIdx] / 255.0 - 0.5;
      const g = resizedData.data[srcIdx + 1] / 255.0 - 0.5;
      const b = resizedData.data[srcIdx + 2] / 255.0 - 0.5;

      if (this.isNCHW) {
        float32Data[p] = r;
        float32Data[numPixels + p] = g;
        float32Data[numPixels * 2 + p] = b;
      } else {
        const dstIdx = p * 3;
        float32Data[dstIdx] = r;
        float32Data[dstIdx + 1] = g;
        float32Data[dstIdx + 2] = b;
      }
    }

    return float32Data;
  }

  private preprocessU2netp(imageData: ImageData, inputShape?: number[]): Float32Array {
    let targetWidth = 320;
    let targetHeight = 320;
    this.isNCHW = false;

    if (inputShape && inputShape.length === 4) {
      if (inputShape[1] === 3 || inputShape[1] === 1) {
        this.isNCHW = true;
        targetHeight = inputShape[2];
        targetWidth = inputShape[3];
      } else {
        this.isNCHW = false;
        targetHeight = inputShape[1];
        targetWidth = inputShape[2];
      }
    }

    this.lastTargetWidth = targetWidth;
    this.lastTargetHeight = targetHeight;

    // U2-Net expects the image to be stretched to the target size, not letterboxed
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    origCanvas.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.drawImage(origCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);
    
    const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);

    const float32Data = new Float32Array(targetWidth * targetHeight * 3);
    const numPixels = targetWidth * targetHeight;

    // U2-Net typical normalization: (val/max - mean) / std
    // Where mean=[0.485, 0.456, 0.406] and std=[0.229, 0.224, 0.225]
    let maxVal = 0;
    for (let i = 0; i < resizedData.data.length; i += 4) {
      if (resizedData.data[i] > maxVal) maxVal = resizedData.data[i];
      if (resizedData.data[i + 1] > maxVal) maxVal = resizedData.data[i + 1];
      if (resizedData.data[i + 2] > maxVal) maxVal = resizedData.data[i + 2];
    }
    const denom = maxVal > 0 ? maxVal : 255.0;

    for (let p = 0; p < numPixels; p++) {
      const srcIdx = p * 4;
      const r = (resizedData.data[srcIdx] / denom - 0.485) / 0.229;
      const g = (resizedData.data[srcIdx + 1] / denom - 0.456) / 0.224;
      const b = (resizedData.data[srcIdx + 2] / denom - 0.406) / 0.225;

      if (this.isNCHW) {
        float32Data[p] = r;
        float32Data[numPixels + p] = g;
        float32Data[numPixels * 2 + p] = b;
      } else {
        const dstIdx = p * 3;
        float32Data[dstIdx] = r;
        float32Data[dstIdx + 1] = g;
        float32Data[dstIdx + 2] = b;
      }
    }

    return float32Data;
  }

  private letterboxImage(imageData: ImageData, targetWidth: number, targetHeight: number) {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const scale = Math.min(targetWidth / imageData.width, targetHeight / imageData.height);
    const newWidth = imageData.width * scale;
    const newHeight = imageData.height * scale;
    const offsetX = (targetWidth - newWidth) / 2;
    const offsetY = (targetHeight - newHeight) / 2;

    const origCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    origCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

    ctx.drawImage(origCanvas, 0, 0, imageData.width, imageData.height, offsetX, offsetY, newWidth, newHeight);
    return {
      resizedData: ctx.getImageData(0, 0, targetWidth, targetHeight),
      scale, offsetX, offsetY, newWidth, newHeight
    };
  }

  private postprocessOrmbg(maskData: Float32Array): ImageData {
    // ORMBG usually outputs 1xHxWx1 in [0, 1] range (sigmoid applied or requires sigmoid)
    let outW = this.lastTargetWidth;
    let outH = this.lastTargetHeight;
    const numPixels = outW * outH;

    const stride = 1;
    const offset = 0;

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let px = 0; px < numPixels; px++) {
      let v = maskData[px * stride + offset];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    const needsSigmoid = (minVal < -2.0 || maxVal > 2.0) && (maxVal <= 50);

    let minA = Infinity;
    let maxA = -Infinity;
    if (needsSigmoid) {
      minA = 1 / (1 + Math.exp(-minVal));
      maxA = 1 / (1 + Math.exp(-maxVal));
    } else {
      minA = minVal;
      maxA = maxVal;
    }

    const range = maxA - minA;
    const scale = range > 0.001 ? (1.0 / range) : 0;

    const maskImageData = new ImageData(outW, outH);

    for (let px = 0; px < numPixels; px++) {
      let alpha = maskData[px * stride + offset];
      if (needsSigmoid) alpha = 1 / (1 + Math.exp(-alpha));
      if (scale > 0) alpha = (alpha - minA) * scale;
      alpha = Math.max(0, Math.min(1, alpha));

      const idx = px * 4;
      maskImageData.data[idx] = 255;
      maskImageData.data[idx + 1] = 255;
      maskImageData.data[idx + 2] = 255;
      maskImageData.data[idx + 3] = alpha * 255;
    }
    return maskImageData;
  }

  private postprocessU2netp(maskData: Float32Array): ImageData {
    let outW = this.lastTargetWidth;
    let outH = this.lastTargetHeight;
    let numPixels = outW * outH;

    if (maskData.length !== numPixels) {
      // In case litert gives a different output shape dynamically
      const dim = Math.sqrt(maskData.length);
      if (Number.isInteger(dim)) {
        outW = dim; outH = dim; numPixels = outW * outH;
      }
    }

    let minVal = Infinity, maxVal = -Infinity;
    for (let px = 0; px < numPixels; px++) {
      const v = maskData[px];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    // U2-Net applies Sigmoid, so values are in [0, 1].
    // If it outputs logits, we apply sigmoid dynamically.
    const needsSigmoid = (minVal < -2.0 || maxVal > 2.0) && (maxVal <= 100);

    let minA = needsSigmoid ? 1 / (1 + Math.exp(-minVal)) : minVal;
    let maxA = needsSigmoid ? 1 / (1 + Math.exp(-maxVal)) : maxVal;
    const scale = (maxA - minA) > 0.001 ? (1.0 / (maxA - minA)) : 0;

    const maskImageData = new ImageData(outW, outH);
    for (let px = 0; px < numPixels; px++) {
      let alpha = maskData[px];
      if (needsSigmoid) alpha = 1 / (1 + Math.exp(-alpha));
      
      // Normalize to [0, 1] range based on min/max to enhance contrast
      if (scale > 0) alpha = (alpha - minA) * scale;
      alpha = Math.max(0, Math.min(1, alpha));

      const idx = px * 4;
      maskImageData.data[idx] = 255;
      maskImageData.data[idx + 1] = 255;
      maskImageData.data[idx + 2] = 255;
      maskImageData.data[idx + 3] = alpha * 255;
    }

    return maskImageData;
  }
}
