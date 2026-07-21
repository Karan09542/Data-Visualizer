import { SegmentationResult } from '../../../ai/types';

export interface EffectContext {
  sourceImage: ImageBitmap | ImageData;
  segmentation: SegmentationResult;
  options: any;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  abortSignal?: AbortSignal;
}

export interface SegmentationEffect {
  id: string;
  name: string;
  description: string;
  execute(context: EffectContext): Promise<ImageBitmap | ImageData>;
}

import { RemoveEffect } from './plugins/RemoveEffect';
import { PortraitEffect } from './plugins/PortraitEffect';
import { PassportEffect } from './plugins/PassportEffect';
import { BackgroundReplaceEffect } from './plugins/BackgroundReplaceEffect';

class EffectRegistry {
  private effects: Map<string, SegmentationEffect> = new Map();

  constructor() {
    this.register(new RemoveEffect());
    this.register(new PortraitEffect());
    this.register(new PassportEffect());
    this.register(new BackgroundReplaceEffect());
  }

  register(effect: SegmentationEffect) {
    this.effects.set(effect.id, effect);
  }

  get(id: string): SegmentationEffect | undefined {
    return this.effects.get(id);
  }

  getAll(): SegmentationEffect[] {
    return Array.from(this.effects.values());
  }
}

export const effectRegistry = new EffectRegistry();
