import { AIProgressEvent } from '../types';

type EventHandler = (event: AIProgressEvent & { jobId: string }) => void;

class AIEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  subscribe(jobId: string, handler: EventHandler): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(handler);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(jobId);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(jobId);
        }
      }
    };
  }

  emit(jobId: string, event: AIProgressEvent) {
    const set = this.listeners.get(jobId);
    if (set) {
      set.forEach(handler => handler({ ...event, jobId }));
    }
  }

  clear(jobId: string) {
    this.listeners.delete(jobId);
  }
}

export const aiEventBus = new AIEventBus();
