import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class ThumbnailCropEffect implements SegmentationEffect {
  id = 'thumbnail-crop';
  name = 'Thumbnail Crop';
  description = 'Crops keeping face in the safe area for thumbnails';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { sourceImage, faceDetection, options, canvas } = context;

    if (!faceDetection || !faceDetection.faces || faceDetection.faces.length === 0) {
      canvas.width = sourceImage.width;
      canvas.height = sourceImage.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(sourceImage, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // Use the largest face
    const face = faceDetection.faces.reduce((prev, current) =>
      (prev.boundingBox.width * prev.boundingBox.height > current.boundingBox.width * current.boundingBox.height) ? prev : current
    );

    const { x, y, width, height } = face.boundingBox;

    // Thumbnail aspect ratio (16:9 by default)
    const targetRatio = options.ratio || (16 / 9);
    const align = options.align || 'right'; // Face on the right, text space on left

    const cx = x + width / 2;
    const cy = y + height / 2;

    // 1. Determine the maximum possible crop box size that fits in the source image
    // while maintaining targetRatio. We don't want to zoom in tightly on the face;
    // we want a large thumbnail that includes the background/body.
    let cropW = sourceImage.width;
    let cropH = Math.round(cropW / targetRatio);

    if (cropH > sourceImage.height) {
      cropH = sourceImage.height;
      cropW = Math.round(cropH * targetRatio);
    }

    // 2. We want to position this box over the source image.
    // The target point for the face within the crop box:
    let desiredFaceXInCrop: number;
    if (align === 'right') {
      desiredFaceXInCrop = cropW * 0.7; // Face in right third
    } else if (align === 'left') {
      desiredFaceXInCrop = cropW * 0.3; // Face in left third
    } else {
      desiredFaceXInCrop = cropW / 2;
    }
    const desiredFaceYInCrop = cropH / 2; // Center vertically

    // 3. Calculate the top-left corner of the crop box on the source image
    let startX = cx - desiredFaceXInCrop;
    let startY = cy - desiredFaceYInCrop;

    // 4. Clamp the crop box so it doesn't go outside the source image bounds
    if (startX < 0) startX = 0;
    if (startY < 0) startY = 0;
    if (startX + cropW > sourceImage.width) startX = sourceImage.width - cropW;
    if (startY + cropH > sourceImage.height) startY = sourceImage.height - cropH;

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d')!;

    // Draw the portion of the source image onto the canvas
    ctx.drawImage(sourceImage, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
