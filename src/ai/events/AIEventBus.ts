import { AIProgressEvent } from '../types';

type EventHandler = (event: AIProgressEvent & { jobId: string }) => void;

type TextEventHandler<T = any> = (payload: T) => void;

export interface AIEventMap {
  generationStarted: { providerId: string; modelId: string; prompt: string };
  tokenReceived: { chunk: string };
  reasoningReceived: { chunk: string };
  generationCompleted: { result: string; usage?: any };
  cancelled: { reason?: string };
  providerChanged: { providerId: string };
  modelChanged: { modelId: string };
  authenticationChanged: { providerId: string; authenticated: boolean };
  error: { source: string; error: Error };
}

class AIEventBus {
  // Legacy Image Processing Event Listeners
  private listeners: Map<string, Set<EventHandler>> = new Map();
  // New Text AI Event Listeners
  private textListeners: { [K in keyof AIEventMap]?: TextEventHandler<AIEventMap[K]>[] } = {};

  // --- Legacy Image Processing API ---
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

  emitLegacy(jobId: string, event: AIProgressEvent) {
    const set = this.listeners.get(jobId);
    if (set) {
      set.forEach(handler => handler({ ...event, jobId }));
    }
  }

  clear(jobId: string) {
    this.listeners.delete(jobId);
  }

  // --- New Text AI Architecture API ---
  on<K extends keyof AIEventMap>(event: K, handler: TextEventHandler<AIEventMap[K]>) {
    if (!this.textListeners[event]) {
      this.textListeners[event] = [];
    }
    this.textListeners[event]!.push(handler);
  }

  off<K extends keyof AIEventMap>(event: K, handler: TextEventHandler<AIEventMap[K]>) {
    if (!this.textListeners[event]) return;
    this.textListeners[event] = this.textListeners[event]!.filter(h => h !== handler);
  }

  emit<K extends keyof AIEventMap>(event: K, payload: AIEventMap[K]) {
    if (!this.textListeners[event]) return;
    this.textListeners[event]!.forEach(handler => {
      try {
        handler(payload);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }
}

export const aiEventBus = new AIEventBus();
