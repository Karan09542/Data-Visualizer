import { LiteRTRuntime } from './LiteRTRuntime';
import { ModelLoader } from '../manager/ModelLoader';
import { modelRegistry } from '../registry/ModelRegistry';
import { AIBackend } from '../types';

interface SessionEntry {
  modelId: string;
  runtime: LiteRTRuntime;
  lastUsed: number;
}

class AISessionManager {
  private sessions: Map<string, SessionEntry> = new Map();
  private maxSessions = 2; // Keep at most 2 models loaded in memory to prevent OOM

  async getRuntime(
    modelId: string, 
    preferredBackend?: AIBackend, 
    onProgress?: (state: string, progress?: number) => void
  ): Promise<LiteRTRuntime> {
    if (this.sessions.has(modelId)) {
      const entry = this.sessions.get(modelId)!;
      entry.lastUsed = Date.now();
      return entry.runtime;
    }

    // Need to load a new session
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest();
    }

    const manifest = modelRegistry.get(modelId);
    if (!manifest) throw new Error(`Model ${modelId} not registered in registry.`);

    const runtime = new LiteRTRuntime();
    
    if (onProgress) onProgress('loading-model', 0);
    const buffer = await ModelLoader.load(manifest, (state, progress) => {
      // Map ModelLoader states ('downloading', 'loading') to new progress states if needed
      if (state === 'downloading' || state === 'saving') {
        if (onProgress) onProgress('downloading', progress);
      }
    });
    await runtime.loadModel(buffer, preferredBackend);
    if (onProgress) onProgress('loading-model', 100);

    this.sessions.set(modelId, {
      modelId,
      runtime,
      lastUsed: Date.now()
    });

    return runtime;
  }

  private evictOldest() {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.sessions.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldest = id;
      }
    }

    if (oldest) {
      const entry = this.sessions.get(oldest)!;
      entry.runtime.dispose();
      this.sessions.delete(oldest);
      console.log(`[AISessionManager] Evicted model session: ${oldest}`);
    }
  }
}

export const aiSessionManager = new AISessionManager();
