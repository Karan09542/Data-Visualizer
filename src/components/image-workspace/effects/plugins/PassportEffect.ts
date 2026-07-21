import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export interface PassportOptions {
  backgroundColor: string; // e.g., '#ffffff', '#3b82f6'
  outputWidth?: number;
  outputHeight?: number;
  centerFace?: boolean;
}

export class PassportEffect implements SegmentationEffect {
  id = 'passport';
  name = 'Passport Photo';
  description = 'Composites the subject onto a solid professional background.';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { segmentation, options, abortSignal } = context;
    const passportOpts = options as PassportOptions;
    
    if (abortSignal?.aborted) throw new Error('Effect aborted');

    // Prepare a canvas to do the compositing
    const canvas = new OffscreenCanvas(segmentation.width, segmentation.height);
    const ctx = canvas.getContext('2d')!;

    // 1. Draw solid background
    ctx.fillStyle = passportOpts.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw foreground over it
    // If segmentation.foreground is ImageData, we need to convert to ImageBitmap to draw
    let fg: ImageBitmap | ImageData = segmentation.foreground;
    if (fg instanceof ImageData) {
      fg = await createImageBitmap(fg);
    }
    
    ctx.drawImage(fg, 0, 0);

    // Note: Future feature can read options.centerFace and use segmentation.boundingBox
    // to dynamically scale/crop the image here!

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
