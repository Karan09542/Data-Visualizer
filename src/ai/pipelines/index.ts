import { taskRegistry } from '../registry/TaskRegistry';

export * from './ImagePipeline';
export * from './BackgroundRemovalPipeline';
export * from './UpscalePipeline';
export * from './LowLightPipeline';
export * from './FaceDetectionPipeline';
export * from './AutoEnhancePipeline';

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

taskRegistry.register('depth-estimation', async () => {
  const { DepthEstimationPipeline } = await import('./DepthEstimationPipeline');
  return new DepthEstimationPipeline();
});

taskRegistry.register('style-transfer', async () => {
  const { StyleTransferPipeline } = await import('./StyleTransferPipeline');
  return new StyleTransferPipeline();
});

taskRegistry.register('auto-enhance', async () => {
  const { AutoEnhancePipeline } = await import('./AutoEnhancePipeline');
  return new AutoEnhancePipeline();
});

