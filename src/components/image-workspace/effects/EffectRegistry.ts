import { SegmentationResult, FaceDetectionResult } from '../../../ai/types';

export interface EffectContext {
  sourceImage: ImageBitmap;
  segmentation?: SegmentationResult;
  faceDetection?: FaceDetectionResult;
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

import { FaceHighlightEffect } from './office/FaceHighlightEffect';
import { FaceBlurEffect } from './office/FaceBlurEffect';
import { AvatarCropEffect } from './office/AvatarCropEffect';
import { PassportCropEffect } from './office/PassportCropEffect';
import { ThumbnailCropEffect } from './office/ThumbnailCropEffect';
import { AutoCropEffect } from './office/AutoCropEffect';

class EffectRegistry {
  private effects: Map<string, SegmentationEffect> = new Map();

  constructor() {
    this.register(new RemoveEffect());
    this.register(new PortraitEffect());
    this.register(new PassportEffect());
    this.register(new BackgroundReplaceEffect());
    
    // Office Utilities
    this.register(new FaceHighlightEffect());
    this.register(new FaceBlurEffect());
    this.register(new AvatarCropEffect());
    this.register(new PassportCropEffect());
    this.register(new ThumbnailCropEffect());
    this.register(new AutoCropEffect());
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
