import { taskRegistry } from '../registry/TaskRegistry';

export * from './ImagePipeline';
export * from './BackgroundRemovalPipeline';
export * from './UpscalePipeline';
export * from './LowLightPipeline';
export * from './FaceDetectionPipeline';

taskRegistry.register('background-removal', async () => {
  const { BackgroundRemovalPipeline } = await import('./BackgroundRemovalPipeline');
  return new BackgroundRemovalPipeline();
});

taskRegistry.register('upscale', async () => {
  const { UpscalePipeline } = await import('./UpscalePipeline');
  return new UpscalePipeline();
});

taskRegistry.register('low-light', async () => {
  const { LowLightPipeline } = await import('./LowLightPipeline');
  return new LowLightPipeline();
});

taskRegistry.register('face-detection', async () => {
  const { FaceDetectionPipeline } = await import('./FaceDetectionPipeline');
  return new FaceDetectionPipeline();
});
