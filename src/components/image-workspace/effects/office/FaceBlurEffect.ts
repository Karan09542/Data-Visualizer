import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class FaceBlurEffect implements SegmentationEffect {
  id = 'face-blur';
  name = 'Face Blur';
  description = 'Blurs or pixelates detected faces for privacy';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { sourceImage, faceDetection, options, canvas } = context;
    const ctx = canvas.getContext('2d')!;

    // Draw original image
    ctx.drawImage(sourceImage, 0, 0);

    if (!faceDetection || !faceDetection.faces || faceDetection.faces.length === 0) {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    const style = options.style || 'blur';
    const maskSpread = options.blurRadius || 20;
    const strength = options.blurStrength || 100;

    // Create a canvas with the full effect applied to the entire image
    const effectCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const effectCtx = effectCanvas.getContext('2d')!;

    if (style === 'blur') {
      const passes = Math.max(1, Math.ceil(strength / 100));
      const blurPx = Math.max(5, strength / (passes * 1.2)); // Scale blur radius by strength
      
      // Ping-pong between two canvases for multiple blur passes to increase intensity
      let src: ImageBitmap | OffscreenCanvas = sourceImage;
      const tmpCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      const tmpCtx = tmpCanvas.getContext('2d')!;

      for (let i = 0; i < passes; i++) {
        const dest = (i % 2 === 0) ? effectCanvas : tmpCanvas;
        const destCtx = (i % 2 === 0) ? effectCtx : tmpCtx;
        
        destCtx.clearRect(0, 0, canvas.width, canvas.height);
        destCtx.filter = `blur(${blurPx}px)`;
        destCtx.drawImage(src, 0, 0);
        destCtx.filter = 'none';
        
        src = dest;
      }

      // If the final result ended up in tmpCanvas, copy it over
      if (passes % 2 === 0) {
        effectCtx.clearRect(0, 0, canvas.width, canvas.height);
        effectCtx.drawImage(tmpCanvas, 0, 0);
      }
    } else if (style === 'pixelate') {
      // Strength controls the size of the pixel blocks directly
      const pixelSize = Math.max(2, strength / 3);
      const scale = 1 / pixelSize;
      
      const smallCanvas = new OffscreenCanvas(Math.max(1, canvas.width * scale), Math.max(1, canvas.height * scale));
      const smallCtx = smallCanvas.getContext('2d')!;
      smallCtx.imageSmoothingEnabled = true;
      smallCtx.drawImage(sourceImage, 0, 0, smallCanvas.width, smallCanvas.height);
      
      effectCtx.imageSmoothingEnabled = false; // Nearest neighbor for pixelation
      effectCtx.drawImage(smallCanvas, 0, 0, canvas.width, canvas.height);
    }

    // Create a mask canvas with soft radial gradients for faces
    const maskCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const maskCtx = maskCanvas.getContext('2d')!;
    
    // Clear to transparent black
    maskCtx.clearRect(0, 0, canvas.width, canvas.height);

    for (const face of faceDetection.faces) {
      const { boundingBox } = face;
      const bx = Math.round(boundingBox.x);
      const by = Math.round(boundingBox.y);
      const bw = Math.round(boundingBox.width);
      const bh = Math.round(boundingBox.height);

      if (bw <= 0 || bh <= 0) continue;

      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      
      // maskSpread (5 to 100) expands the mask outward
      // Scale spread based on face size so it feels proportional, but give it a solid base
      const spreadPx = maskSpread * Math.max(1, bw / 100);

      const radiusX = (bw / 2 * 1.1) + spreadPx; 
      const radiusY = (bh / 2 * 1.3) + spreadPx; 

      maskCtx.save();
      // Translate to face center and scale to create an elliptical gradient
      maskCtx.translate(cx, cy);
      maskCtx.scale(1, radiusY / radiusX);
      
      // Create radial gradient for smooth feathering
      const gradient = maskCtx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');      // Solid at center
      gradient.addColorStop(0.6, 'rgba(0, 0, 0, 1)');    // Solid up to 60%
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');      // Transparent at edge
      
      maskCtx.fillStyle = gradient;
      // Draw a rect large enough to cover the gradient
      maskCtx.fillRect(-radiusX * 2, -radiusX * 2, radiusX * 4, radiusX * 4);
      maskCtx.restore();
    }

    // Apply the mask to the effect canvas
    effectCtx.globalCompositeOperation = 'destination-in';
    effectCtx.drawImage(maskCanvas, 0, 0);

    // Draw the feathered effect over the original image
    ctx.drawImage(effectCanvas, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
