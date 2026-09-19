import { taskRegistry } from '../registry/TaskRegistry';

export function registerTasks() {
  taskRegistry.register('background-removal', async () => {
    const { BackgroundRemovalPipeline } = await import('../pipelines/BackgroundRemovalPipeline');
    return new BackgroundRemovalPipeline();
  });

  taskRegistry.register('upscale', async () => {
    const { UpscalePipeline } = await import('../pipelines/UpscalePipeline');
    return new UpscalePipeline();
  });

  taskRegistry.register('low-light', async () => {
    const { LowLightPipeline } = await import('../pipelines/LowLightPipeline');
    return new LowLightPipeline();
  });

  taskRegistry.register('auto-enhance', async () => {
    const { AutoEnhancePipeline } = await import('../pipelines/AutoEnhancePipeline');
    return new AutoEnhancePipeline();
  });

  taskRegistry.register('face-detection', async () => {
    const { FaceDetectionPipeline } = await import('../pipelines/FaceDetectionPipeline');
    return new FaceDetectionPipeline();
  });

  taskRegistry.register('depth-estimation', async () => {
    const { DepthEstimationPipeline } = await import('../pipelines/DepthEstimationPipeline');
    return new DepthEstimationPipeline();
  });

  taskRegistry.register('style-transfer', async () => {
    const { StyleTransferPipeline } = await import('../pipelines/StyleTransferPipeline');
    return new StyleTransferPipeline();
  });
}
