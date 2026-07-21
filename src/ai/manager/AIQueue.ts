import { generateId } from '../utils';
import { AITask, AIExecutionOptions, AIExecutionResult, AIProgressState } from '../types';
import { aiEventBus } from '../events/AIEventBus';
import { taskRegistry } from '../registry/TaskRegistry';
import { modelRegistry } from '../registry/ModelRegistry';

export interface AIJob {
  id: string;
  type: 'EXECUTE_TASK' | 'PRELOAD_MODEL';
  task?: AITask;
  modelId?: string;
  image?: ImageBitmap | ImageData;
  options?: AIExecutionOptions;
  resolve: (result: AIExecutionResult) => void;
  reject: (error: Error) => void;
  isCancelled: boolean;
  priority: number;
}

/**
 * AIQueue now executes pipelines on the main thread.
 * 
 * Reason: @litertjs/core uses importScripts() internally to load its WASM
 * companion files. ES module Web Workers (type: 'module') do not support
 * importScripts(), which causes a fatal error. Running inference on the main
 * thread avoids this entirely. The preprocessing and postprocessing canvas
 * operations are fast enough that the UI impact is negligible for single
 * inference jobs.
 */
class AIQueue {
  private queue: AIJob[] = [];
  private activeJobs: Map<string, AIJob> = new Map();
  private isProcessing = false;
  private maxConcurrent = 1; // Process one job at a time to avoid OOM with large models

  public enqueue(
    task: AITask,
    image: ImageBitmap | ImageData,
    options?: AIExecutionOptions,
    priority: number = 0
  ): { jobId: string, promise: Promise<AIExecutionResult> } {
    const jobId = generateId();
    
    const promise = new Promise<AIExecutionResult>((resolve, reject) => {
      const job: AIJob = {
        id: jobId,
        type: 'EXECUTE_TASK',
        task,
        image,
        options,
        resolve,
        reject,
        isCancelled: false,
        priority
      };
      
      this.queue.push(job);
      this.queue.sort((a, b) => b.priority - a.priority);
      
      aiEventBus.emit(jobId, { state: 'queued' });
      this.processQueue();
    });

    return { jobId, promise };
  }

  public enqueuePreload(modelId: string, priority: number = 10): { jobId: string, promise: Promise<void> } {
    const jobId = generateId();
    
    const promise = new Promise<void>((resolve, reject) => {
      const job: AIJob = {
        id: jobId,
        type: 'PRELOAD_MODEL',
        modelId,
        resolve: () => resolve(),
        reject,
        isCancelled: false,
        priority
      };
      
      this.queue.push(job);
      this.queue.sort((a, b) => b.priority - a.priority);
      
      this.processQueue();
    });

    return { jobId, promise };
  }

  public cancel(jobId: string) {
    // 1. Remove from queue if pending
    const index = this.queue.findIndex(j => j.id === jobId);
    if (index !== -1) {
      const [job] = this.queue.splice(index, 1);
      job.isCancelled = true;
      job.reject(new Error('Job cancelled'));
      aiEventBus.emit(jobId, { state: 'cancelled' });
      return;
    }

    // 2. Mark active job as cancelled (it will check this flag)
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.isCancelled = true;
      aiEventBus.emit(jobId, { state: 'cancelled' });
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (this.activeJobs.size >= this.maxConcurrent) return;

    const job = this.queue.shift();
    if (!job) return;

    if (job.isCancelled) {
      this.processQueue();
      return;
    }

    this.isProcessing = true;
    this.activeJobs.set(job.id, job);

    try {
      if (job.type === 'EXECUTE_TASK' && job.task && job.image) {
        const pipeline = await taskRegistry.getPipeline(job.task);

        const result = await pipeline.execute({
          image: job.image,
          options: job.options,
          onProgress: (state: string, progress: number) => {
            if (job.isCancelled) return;
            aiEventBus.emit(job.id, { state: state as AIProgressState, progress });
            if (job.options?.onProgress) {
              job.options.onProgress({ state: state as AIProgressState, progress });
            }
          }
        });

        if (!job.isCancelled) {
          aiEventBus.emit(job.id, { state: 'completed', progress: 100 });
          job.resolve(result);
        }

      } else if (job.type === 'PRELOAD_MODEL' && job.modelId) {
        const manifest = modelRegistry.get(job.modelId);
        if (!manifest) throw new Error(`Model ${job.modelId} not found in registry`);

        const pipeline = await taskRegistry.getPipeline(manifest.task);
        if (pipeline.preload) {
          await pipeline.preload();
        }

        if (!job.isCancelled) {
          aiEventBus.emit(job.id, { state: 'completed', progress: 100 });
          job.resolve({ output: null });
        }
      }
    } catch (error) {
      if (!job.isCancelled) {
        const errMsg = error instanceof Error ? error.message : String(error);
        aiEventBus.emit(job.id, { state: 'failed', error: errMsg });
        job.reject(error instanceof Error ? error : new Error(errMsg));
      }
    } finally {
      this.activeJobs.delete(job.id);
      this.isProcessing = false;
      // Process next in queue
      this.processQueue();
    }
  }
}

export const aiQueue = new AIQueue();
