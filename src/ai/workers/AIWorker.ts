import { WorkerRequest, WorkerResponse, AIProgressState } from '../types';
import { taskRegistry } from '../registry/TaskRegistry';
import { registerTasks } from '../tasks';
import { modelRegistry } from '../registry/ModelRegistry';

// Initialize the registry within the worker environment
registerTasks();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  
  try {
    if (request.type === 'EXECUTE_TASK' && request.task && request.image) {
      const pipeline = await taskRegistry.getPipeline(request.task);
      
      const result = await pipeline.execute({
        image: request.image,
        options: request.options,
        onProgress: (state: string, progress: number) => {
          self.postMessage({
            id: request.id,
            type: 'PROGRESS_UPDATE',
            progressEvent: { state: state as AIProgressState, progress }
          } as WorkerResponse);
        }
      });

      // Transfer the output if possible (e.g. if ImageBitmap or ArrayBuffer)
      const transferables: Transferable[] = [];
      if (result.output instanceof ImageBitmap) {
        transferables.push(result.output);
      } else if (result.output instanceof ImageData) {
        transferables.push(result.output.data.buffer);
      }

      self.postMessage({
        id: request.id,
        type: 'EXECUTION_COMPLETE',
        result
      } as WorkerResponse, transferables);
      
    } else if (request.type === 'PRELOAD_MODEL' && request.modelId) {
      const manifest = modelRegistry.get(request.modelId);
      if (!manifest) throw new Error(`Model ${request.modelId} not found in registry`);
      
      const pipeline = await taskRegistry.getPipeline(manifest.task);
      if (pipeline.preload) {
        await pipeline.preload();
      }
      
      self.postMessage({
        id: request.id,
        type: 'EXECUTION_COMPLETE',
        result: { output: null }
      } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: 'EXECUTION_ERROR',
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
};
