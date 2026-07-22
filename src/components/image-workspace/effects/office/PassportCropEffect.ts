import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class PassportCropEffect implements SegmentationEffect {
  id = 'passport-crop';
  name = 'Passport Crop';
  description = 'Automatically crops and frames for passport photos';

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

    // Passport photo ratios: 35mm × 45mm (width:height = 35:45 ≈ 0.778)
    const ratio = options.ratio || (35 / 45);

    // The face box (eyes/nose/mouth) should take about 40-45% of the passport photo height
    // This leaves room for hair on top and neck/shoulders below.
    const faceHeightRatio = options.faceHeightRatio || 0.45;

    const targetHeight = Math.round(height / faceHeightRatio);
    const targetWidth = Math.round(targetHeight * ratio);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;

    if (options.backgroundImage) {
      const bg = options.backgroundImage;
      const bgRatio = bg.width / bg.height;
      const targetRatio = canvas.width / canvas.height;
      
      let drawW = canvas.width;
      let drawH = canvas.height;
      let bgX = 0;
      let bgY = 0;

      if (bgRatio > targetRatio) {
        // Background is wider than the target ratio (e.g. landscape image on portrait passport)
        drawW = bg.width * (canvas.height / bg.height);
        bgX = (canvas.width - drawW) / 2;
      } else {
        // Background is taller than target ratio
        drawH = bg.height * (canvas.width / bg.width);
        bgY = (canvas.height - drawH) / 2;
      }

      ctx.drawImage(bg, bgX, bgY, drawW, drawH);
    } else {
      // Fill background color (white by default for passport)
      ctx.fillStyle = options.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const faceCx = x + width / 2;
    const faceCy = y + height / 2;

    // We want the face center to be slightly above the vertical middle of the passport photo
    // Passport photos usually have the eyes around the upper 1/3 to 1/2.
    // So faceCy should be at ~ 45% of the targetHeight
    const desiredFaceCy = targetHeight * 0.45;

    // Calculate where to draw the source image so the face lands exactly at our desired coordinates
    const drawX = (targetWidth / 2) - faceCx;
    const drawY = desiredFaceCy - faceCy;

    ctx.drawImage(sourceImage, drawX, drawY);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
