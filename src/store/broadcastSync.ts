import { v4 as uuidv4 } from "uuid";

export interface SyncEvent {
  type: string;
  nodeId?: string;
  workspaceId?: string;
  timestamp: number;
  payload?: any;
}

export type SyncEventHandler = (event: SyncEvent) => void;

class BroadcastSyncService {
  private channel: BroadcastChannel | null = null;
  private tabId: string = uuidv4();
  private listeners: Map<string, Set<SyncEventHandler>> = new Map();
  private throttleTimers: Map<string, { timer: any; lastRun: number }> = new Map();

  // Internal guard to prevent rebroadcasting
  public isReceivingSync = false;

  constructor(private channelName: string = "app-sync-channel") {}

  init() {
    if (typeof window === "undefined" || !window.BroadcastChannel) return;
    this.connect();
  }

  private connect() {
    if (this.channel) {
      this.channel.close();
    }
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data;
    if (!data || data.sender === this.tabId) return;

    const syncEvent: SyncEvent = data.event;
    
    this.isReceivingSync = true;
    try {
      const handlers = this.listeners.get(syncEvent.type);
      if (handlers) {
        handlers.forEach((handler) => handler(syncEvent));
      }
      
      const catchAllHandlers = this.listeners.get("*");
      if (catchAllHandlers) {
        catchAllHandlers.forEach((handler) => handler(syncEvent));
      }
    } finally {
      this.isReceivingSync = false;
    }
  }

  subscribe(type: string, handler: SyncEventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type: string, handler: SyncEventHandler) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  broadcast(event: Omit<SyncEvent, "timestamp">, throttleMs?: number) {
    if (this.isReceivingSync || !this.channel) return;

    const fullEvent: SyncEvent = {
      ...event,
      timestamp: Date.now(),
    };

    if (throttleMs) {
      const throttleKey = `${event.type}-${event.nodeId || 'global'}`;
      const existing = this.throttleTimers.get(throttleKey);
      const now = Date.now();

      if (existing) {
        const timeSinceLastRun = now - existing.lastRun;
        if (timeSinceLastRun >= throttleMs) {
          this.emitToChannel(fullEvent);
          existing.lastRun = now;
          clearTimeout(existing.timer);
        } else {
          clearTimeout(existing.timer);
          existing.timer = setTimeout(() => {
            this.emitToChannel(fullEvent);
            existing.lastRun = Date.now();
          }, throttleMs - timeSinceLastRun);
        }
      } else {
        this.emitToChannel(fullEvent);
        this.throttleTimers.set(throttleKey, { timer: null, lastRun: now });
      }
    } else {
      this.emitToChannel(fullEvent);
    }
  }

  private emitToChannel(event: SyncEvent) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          sender: this.tabId,
          event,
        });
      } catch (err) {
        console.warn("BroadcastChannel postMessage failed:", err);
      }
    }
  }

  cleanup() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
    this.throttleTimers.forEach(({ timer }) => clearTimeout(timer));
    this.throttleTimers.clear();
  }
}

export const syncService = new BroadcastSyncService();
