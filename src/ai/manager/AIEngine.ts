import { AITask, AIExecutionOptions, AIExecutionResult, WorkerRequest, WorkerResponse } from '../types';
import { generateId } from '../utils';
import { WorkerPool } from './WorkerPool';

class AIEngine {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function, reject: Function, onProgress?: Function }> = new Map();
  
  // Dedicated pool for heavy Canvas Offscreen operations
  public effectPool = new WorkerPool(new URL('../workers/EffectWorker.ts', import.meta.url), 2);

  private getWorker(): Worker {
    if (!this.worker) {
      // Initialize Web Worker using Vite's worker syntax
      this.worker = new Worker(new URL('../workers/AIWorker.ts', import.meta.url), { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };
      
      this.worker.onerror = (error) => {
        console.error('AIWorker Error:', error);
      };
    }
    return this.worker;
  }

  private handleWorkerMessage(response: WorkerResponse) {
    const request = this.pendingRequests.get(response.id);
    if (!request) return;

    switch (response.type) {
      case 'PROGRESS_UPDATE':
        if (request.onProgress && response.progressEvent) {
          request.onProgress(response.progressEvent);
        }
        break;
        
      case 'EXECUTION_COMPLETE':
        request.resolve(response.result);
        this.pendingRequests.delete(response.id);
        break;
        
      case 'EXECUTION_ERROR':
        request.reject(new Error(response.error || 'Unknown AI execution error'));
        this.pendingRequests.delete(response.id);
        break;
    }
  }

  public async execute(
    task: AITask,
    image: ImageBitmap | ImageData,
    options?: AIExecutionOptions
  ): Promise<AIExecutionResult> {
    const worker = this.getWorker();
    const id = generateId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        onProgress: options?.onProgress
      });

      const request: WorkerRequest = {
        id,
        type: 'EXECUTE_TASK',
        task,
        image,
        options: {
          preferredBackend: options?.preferredBackend,
          modelId: options?.modelId
        }
      };

      // Transfer image buffer if possible
      const transferables: Transferable[] = [];
      if (image instanceof ImageBitmap) {
        transferables.push(image);
      } else if (image instanceof ImageData) {
        transferables.push(image.data.buffer);
      }

      worker.postMessage(request, transferables);
    });
  }

  public async preloadModel(modelId: string): Promise<void> {
    const worker = this.getWorker();
    const id = generateId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const request: WorkerRequest = {
        id,
        type: 'PRELOAD_MODEL',
        modelId
      };
      
      worker.postMessage(request);
    });
  }
}

export const aiEngine = new AIEngine();
