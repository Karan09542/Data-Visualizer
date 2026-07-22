import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class AvatarCropEffect implements SegmentationEffect {
  id = 'avatar-crop';
  name = 'Avatar Crop';
  description = 'Creates a centered avatar from the detected face';

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

    const cx = x + width / 2;
    const cy = y + height / 2;

    // Determine a crop size that encapsulates the face with generous padding
    const paddingMultiplier = options.padding || 2.0;
    const outSize = Math.round(Math.max(width, height) * paddingMultiplier);

    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d')!;

    const shape = options.shape || 'circle';

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (shape === 'rounded') {
      const radius = outSize * 0.15;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(outSize - radius, 0);
      ctx.quadraticCurveTo(outSize, 0, outSize, radius);
      ctx.lineTo(outSize, outSize - radius);
      ctx.quadraticCurveTo(outSize, outSize, outSize - radius, outSize);
      ctx.lineTo(radius, outSize);
      ctx.quadraticCurveTo(0, outSize, 0, outSize - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.clip();
    }

    const drawX = (outSize / 2) - cx;
    const drawY = (outSize / 2) - cy;

    ctx.drawImage(sourceImage, drawX, drawY);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
