import { ImagePipeline } from './ImagePipeline';

export class BackgroundRemovalPipeline extends ImagePipeline {
  protected modelId = 'ormbg';

  protected lastTargetWidth = 1024;
  protected lastTargetHeight = 1024;
  protected isNCHW = false;

  protected preprocess(imageData: ImageData, inputShape?: number[]): any {
    if (this.modelId === 'sinet') {
      return this.preprocessSinet(imageData, inputShape);
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

    if (this.modelId === 'sinet') {
      maskImageData = this.postprocessSinet(maskData);
    } else {
      maskImageData = this.postprocessOrmbg(maskData);
    }

    // Un-letterbox and resize mask back to original width/height
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

  private preprocessSinet(imageData: ImageData, inputShape?: number[]): Float32Array {
    let targetWidth = 324;
    let targetHeight = 324;
    this.isNCHW = false; // Assume NHWC like UpscalePipeline by default

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

    const { resizedData } = this.letterboxImage(imageData, targetWidth, targetHeight);

    const float32Data = new Float32Array(targetWidth * targetHeight * 3);
    const numPixels = targetWidth * targetHeight;

    for (let p = 0; p < numPixels; p++) {
      const srcIdx = p * 4;
      // [0, 1] Normalization just like UpscalePipeline!
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

  private postprocessSinet(maskData: Float32Array): ImageData {
    // SINet specific decoding
    // Try to infer dimensions in case it's different from input shape
    let outW = this.lastTargetWidth;
    let outH = this.lastTargetHeight;
    let numPixels = outW * outH;

    if (maskData.length !== numPixels && maskData.length !== numPixels * 2 && maskData.length !== numPixels * 4) {
      const dim1 = Math.sqrt(maskData.length);
      const dim2 = Math.sqrt(maskData.length / 2);
      if (Number.isInteger(dim1)) {
        outW = dim1; outH = dim1; numPixels = outW * outH;
      } else if (Number.isInteger(dim2)) {
        outW = dim2; outH = dim2; numPixels = outW * outH;
      }
    }

    let stride = 1;
    let offset = 0;

    const getFgScore = (cStride: number, cOffset: number) => {
      let centerSum = 0, centerCount = 0, cornerSum = 0, cornerCount = 0;
      const marginX = Math.floor(outW * 0.1), marginY = Math.floor(outH * 0.1);
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const val = maskData[(y * outW + x) * cStride + cOffset];
          const isCorner = (x < marginX || x >= outW - marginX) && (y < marginY || y >= outH - marginY);
          const isCenter = (x > outW * 0.35 && x < outW * 0.65) && (y > outH * 0.35 && y < outH * 0.65);
          if (isCorner) { cornerSum += val; cornerCount++; }
          if (isCenter) { centerSum += val; centerCount++; }
        }
      }
      return (centerSum / Math.max(1, centerCount)) - (cornerSum / Math.max(1, cornerCount));
    };

    if (maskData.length === numPixels * 4) {
      stride = 4;
      offset = 3;
    } else if (maskData.length === numPixels * 2) {
      // 2-channel mask: Pick the channel with highest foreground score
      let s0 = this.isNCHW ? 1 : 2, o0 = 0;
      let s1 = this.isNCHW ? 1 : 2, o1 = this.isNCHW ? numPixels : 1;

      const score0 = getFgScore(s0, o0);
      const score1 = getFgScore(s1, o1);
      if (score0 > score1) { stride = s0; offset = o0; }
      else { stride = s1; offset = o1; }
    } else {
      // 1-channel mask
      stride = 1;
      offset = 0;
    }

    let minVal = Infinity, maxVal = -Infinity;
    for (let px = 0; px < numPixels; px++) {
      const v = maskData[px * stride + offset];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    // SINet explicitly outputs raw logits, so we MUST apply Sigmoid
    const needsSigmoid = true;

    let minA = needsSigmoid ? 1 / (1 + Math.exp(-minVal)) : minVal;
    let maxA = needsSigmoid ? 1 / (1 + Math.exp(-maxVal)) : maxVal;
    const scale = (maxA - minA) > 0.001 ? (1.0 / (maxA - minA)) : 0;

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
}
