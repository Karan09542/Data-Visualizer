import { AITask, AIExecutionOptions, AIExecutionResult, AIProgressEvent } from '../types';
import { aiQueue } from '../manager/AIQueue';
import { aiEventBus } from '../events/AIEventBus';
import { generateId } from '../utils';

import { taskRegistry } from '../registry/TaskRegistry';

class AIService {
  public execute(
    task: AITask,
    image: ImageBitmap | ImageData,
    options?: AIExecutionOptions,
    priority: number = 0
  ): { jobId: string, promise: Promise<AIExecutionResult> } {
    const { jobId, promise } = aiQueue.enqueue(task, image, options, priority);
    
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        this.cancel(jobId);
      });
    }

    return { jobId, promise };
  }

  public cancel(jobId: string) {
    aiQueue.cancel(jobId);
  }

  public subscribe(jobId: string, handler: (event: AIProgressEvent & { jobId: string }) => void): () => void {
    return aiEventBus.subscribe(jobId, handler);
  }

  public preloadModel(modelId: string): { jobId: string, promise: Promise<void> } {
    return aiQueue.enqueuePreload(modelId);
  }

  public getAvailableTasks(): AITask[] {
    return taskRegistry.getAvailableTasks();
  }
}

export const aiService = new AIService();
