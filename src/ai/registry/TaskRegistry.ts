import { AITask, AIExecutionOptions, AIExecutionResult } from '../types';

export interface PipelineExecutionArgs {
  image: ImageBitmap | ImageData;
  options?: AIExecutionOptions;
  onProgress?: (state: string, progress: number) => void;
}

export interface TaskPipeline {
  execute(args: PipelineExecutionArgs): Promise<AIExecutionResult>;
  preload?(): Promise<void>;
}

class TaskRegistry {
  private pipelines: Map<AITask, () => Promise<TaskPipeline>> = new Map();

  register(task: AITask, pipelineFactory: () => Promise<TaskPipeline>) {
    this.pipelines.set(task, pipelineFactory);
  }

  async getPipeline(task: AITask): Promise<TaskPipeline> {
    const factory = this.pipelines.get(task);
    if (!factory) {
      throw new Error(`No pipeline registered for task: ${task}`);
    }
    return await factory();
  }

  getAvailableTasks(): AITask[] {
    return Array.from(this.pipelines.keys());
  }
}

export const taskRegistry = new TaskRegistry();
