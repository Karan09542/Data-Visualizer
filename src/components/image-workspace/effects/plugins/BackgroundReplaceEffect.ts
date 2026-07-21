import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export interface BackgroundReplaceOptions {
  image: ImageBitmap | HTMLImageElement;
  fit?: 'cover' | 'contain';
  blur?: number;
}

export class BackgroundReplaceEffect implements SegmentationEffect {
  id = 'change-bg';
  name = 'Change Background';
  description = 'Composites the subject onto a custom uploaded background.';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { segmentation, options, abortSignal } = context;
    const bgOpts = options as BackgroundReplaceOptions;
    
    if (!bgOpts.image) throw new Error('Background image not provided');
    if (abortSignal?.aborted) throw new Error('Effect aborted');

    const canvas = new OffscreenCanvas(segmentation.width, segmentation.height);
    const ctx = canvas.getContext('2d')!;

    // 1. Draw custom background
    // Basic "cover" implementation
    const bgImg = bgOpts.image;
    const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
    const x = (canvas.width / scale - bgImg.width) / 2;
    const y = (canvas.height / scale - bgImg.height) / 2;
    
    ctx.save();
    if (bgOpts.blur) {
      ctx.filter = `blur(${bgOpts.blur}px)`;
    }
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(scale, scale);
    ctx.drawImage(bgImg, -bgImg.width/2, -bgImg.height/2);
    ctx.restore();

    // 2. Draw crisp foreground
    let fg: ImageBitmap | ImageData = segmentation.foreground;
    if (fg instanceof ImageData) {
      fg = await createImageBitmap(fg);
    }
    ctx.drawImage(fg, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
