import { TaskPipeline, PipelineExecutionArgs } from '../registry/TaskRegistry';
import { taskRegistry } from '../registry/TaskRegistry';

export class AutoEnhancePipeline implements TaskPipeline {
  async execute(args: PipelineExecutionArgs) {
    const { image, onProgress, options } = args;
    
    const lowLightPipeline = await taskRegistry.getPipeline('low-light');
    const llResult = await lowLightPipeline.execute({
       image,
       options,
       onProgress: (state, progress) => {
         // Scale progress 0-50%
         if (onProgress) onProgress(state, progress / 2);
       }
    });

    if (options?.signal?.aborted) throw new Error('AbortError');
    
    const upscalePipeline = await taskRegistry.getPipeline('upscale');
    const usResult = await upscalePipeline.execute({
       image: llResult.output as any,
       options,
       onProgress: (state, progress) => {
         // Scale progress 50-100%
         if (onProgress) onProgress(state, 50 + (progress / 2));
       }
    });
    
    return usResult;
  }
}
