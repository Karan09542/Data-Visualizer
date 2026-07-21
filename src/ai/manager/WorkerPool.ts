import { generateId } from '../utils';

export interface PoolWorker {
  id: string;
  worker: Worker;
  isBusy: boolean;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private poolSize: number;
  private workerUrl: string | URL;

  constructor(workerUrl: string | URL, maxSize?: number) {
    this.workerUrl = workerUrl;
    // 2-core CPU -> 1 worker
    // 4-core CPU -> 3 workers
    // 8/16-core CPU -> 4 workers max
    const concurrency = navigator.hardwareConcurrency || 4;
    this.poolSize = maxSize || Math.max(1, Math.min(4, concurrency - 1));
    console.log(`[WorkerPool] Initialized with max size: ${this.poolSize}`);
  }

  private createWorker(): PoolWorker {
    const worker = new Worker(this.workerUrl, { type: 'module' });
    const poolWorker: PoolWorker = { id: generateId(), worker, isBusy: false };
    this.workers.push(poolWorker);
    return poolWorker;
  }

  public getAvailableWorker(): PoolWorker | null {
    const available = this.workers.find(w => !w.isBusy);
    if (available) return available;
    
    if (this.workers.length < this.poolSize) {
      return this.createWorker();
    }
    
    return null;
  }

  public setWorkerBusy(id: string, isBusy: boolean) {
    const poolWorker = this.workers.find(w => w.id === id);
    if (poolWorker) {
      poolWorker.isBusy = isBusy;
    }
  }

  public removeWorker(id: string) {
    const index = this.workers.findIndex(w => w.id === id);
    if (index !== -1) {
      this.workers[index].worker.terminate();
      this.workers.splice(index, 1);
    }
  }

  public terminateAll() {
    this.workers.forEach(w => w.worker.terminate());
    this.workers = [];
  }
}
