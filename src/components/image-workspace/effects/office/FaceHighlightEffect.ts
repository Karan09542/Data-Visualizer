import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class FaceHighlightEffect implements SegmentationEffect {
  id = 'face-highlight';
  name = 'Face Highlight';
  description = 'Draws outlines and highlights over detected faces';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { sourceImage, faceDetection, options, canvas } = context;
    const ctx = canvas.getContext('2d')!;

    // Draw original image
    ctx.drawImage(sourceImage, 0, 0);

    if (!faceDetection || !faceDetection.faces || faceDetection.faces.length === 0) {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    const color = options.color || '#3b82f6';
    const thickness = options.thickness || 3;

    for (const face of faceDetection.faces) {
      const { boundingBox, keypoints, score } = face;
      const bx = Math.round(boundingBox.x);
      const by = Math.round(boundingBox.y);
      const bw = Math.round(boundingBox.width);
      const bh = Math.round(boundingBox.height);

      // Draw bounding box with rounded corners
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      const radius = Math.min(bw, bh) * 0.1;
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + bw - radius, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
      ctx.lineTo(bx + bw, by + bh - radius);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
      ctx.lineTo(bx + radius, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
      ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by);
      ctx.closePath();
      ctx.stroke();

      // Draw confidence score label
      const scoreText = `${Math.round(score * 100)}%`;
      ctx.font = `bold ${Math.max(12, bw * 0.08)}px sans-serif`;
      const textMetrics = ctx.measureText(scoreText);
      const labelH = Math.max(16, bw * 0.1);
      
      ctx.fillStyle = color;
      ctx.fillRect(bx, by - labelH - 2, textMetrics.width + 8, labelH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(scoreText, bx + 4, by - 5);

      // Draw keypoints
      if (keypoints && keypoints.length > 0) {
        ctx.fillStyle = color;
        const dotRadius = Math.max(2, thickness * 1.2);

        for (const pt of keypoints) {
          ctx.beginPath();
          ctx.arc(Math.round(pt.x), Math.round(pt.y), dotRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
