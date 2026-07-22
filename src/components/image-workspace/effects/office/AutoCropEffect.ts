import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class AutoCropEffect implements SegmentationEffect {
  id = 'auto-crop';
  name = 'Auto Crop';
  description = 'Smartly crops image keeping face and shoulders in frame';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { sourceImage, faceDetection, options, canvas } = context;

    if (!faceDetection || !faceDetection.faces || faceDetection.faces.length === 0) {
      // No face found — return original
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

    const cx = x + width / 2;
    const cy = y + height / 2;

    // Auto crop: face takes about 35-40% of final height, include shoulders below
    const paddingTop = height * 0.7;     // headroom above face
    const paddingBottom = height * 1.6;  // shoulders below face bottom
    const paddingSide = width * 0.8;     // padding on each side

    // We don't clamp the crop size, we want the exact framing every time
    const cropW = Math.round(width + paddingSide * 2);
    const cropH = Math.round(height + paddingTop + paddingBottom);

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d')!;

    // Where should the face center land in our new canvas?
    // In our theoretical crop box, face center was at `paddingSide + width/2` on X, and `paddingTop + height/2` on Y
    const desiredFaceCx = paddingSide + width / 2;
    const desiredFaceCy = paddingTop + height / 2;

    const drawX = desiredFaceCx - cx;
    const drawY = desiredFaceCy - cy;

    ctx.drawImage(sourceImage, drawX, drawY);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
