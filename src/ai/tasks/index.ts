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
    throw new Error('Auto Enhance is a placeholder for a future composite AI pipeline.');
  });
}
