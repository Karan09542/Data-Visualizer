import { SegmentationEffect, EffectContext } from '../EffectRegistry';

export class RemoveEffect implements SegmentationEffect {
  id = 'remove';
  name = 'Remove Background';
  description = 'Creates a transparent PNG with the background removed.';

  async execute(context: EffectContext): Promise<ImageBitmap | ImageData> {
    const { segmentation, abortSignal } = context;

    if (abortSignal?.aborted) {
      throw new Error('Effect aborted');
    }

    // The segmentation.foreground is exactly the original image masked with transparency!
    // Since we've updated the pipeline to output this natively, the Remove effect 
    // simply returns the already-processed foreground.
    return segmentation.foreground;
  }
}
