import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export interface PortraitOptions {
  blurRadius: number;
  featherRadius?: number;
}

export class PortraitEffect implements SegmentationEffect {
  id = 'portrait';
  name = 'Portrait Mode';
  description = 'Creates a DSLR-like depth of field by blurring the background.';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { sourceImage, segmentation, options, abortSignal } = context;
    const portraitOpts = options as PortraitOptions;
    const blur = portraitOpts.blurRadius || 8;
    
    if (abortSignal?.aborted) throw new Error('Effect aborted');

    const canvas = new OffscreenCanvas(segmentation.width, segmentation.height);
    const ctx = canvas.getContext('2d')!;

    // We need to convert sourceImage and foreground to ImageBitmap if they are ImageData
    let src: ImageBitmap | ImageData = sourceImage;
    if (src instanceof ImageData) {
      src = await createImageBitmap(src);
    }
    
    let fg: ImageBitmap | ImageData = segmentation.foreground;
    if (fg instanceof ImageData) {
      fg = await createImageBitmap(fg);
    }

    // 1. Draw the blurred original background
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';

    // 2. Draw the crisp foreground subject on top
    // (A more advanced implementation would use the alphaMask to feather the edges here
    // before drawing the foreground, but drawing the pre-masked foreground works great for now)
    ctx.drawImage(fg, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
