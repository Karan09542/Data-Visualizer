/// <reference lib="webworker" />

import { effectRegistry } from '../../components/image-workspace/effects/EffectRegistry';
import { SegmentationResult } from '../types';

export interface EffectWorkerRequest {
  id: string;
  effectId: string;
  sourceImage: ImageBitmap;
  segmentation: SegmentationResult;
  options: any;
}

export interface EffectWorkerResponse {
  id: string;
  result?: ImageBitmap;
  error?: string;
}

// Ensure the registry has loaded all plugins
// The registry is automatically populated when imported
// because the plugins are registered in the constructor!

self.onmessage = async (e: MessageEvent<EffectWorkerRequest>) => {
  const req = e.data;

  try {
    const effect = effectRegistry.get(req.effectId);
    if (!effect) {
      throw new Error(`Effect ${req.effectId} not found in registry`);
    }

    const canvas = new OffscreenCanvas(req.segmentation.width, req.segmentation.height);

    const resultData = await effect.execute({
      sourceImage: req.sourceImage,
      segmentation: req.segmentation,
      options: req.options,
      canvas: canvas,
      // Note: We don't have abort signal over postMessage natively,
      // but we could implement a secondary message listener to trigger abort
    });

    let resultBitmap: ImageBitmap;
    if (resultData instanceof ImageData) {
      resultBitmap = await createImageBitmap(resultData);
    } else {
      resultBitmap = resultData;
    }

    const response: EffectWorkerResponse = {
      id: req.id,
      result: resultBitmap
    };

    self.postMessage(response, [resultBitmap]);

  } catch (err: any) {
    const response: EffectWorkerResponse = {
      id: req.id,
      error: err.message || 'Unknown effect error'
    };
    self.postMessage(response);
  }
};
