import { AITask } from '../types';

export interface CachedAIResult<T = any> {
  modelId: string;
  imageHash: string;
  timestamp: number;
  result: T;
}

export class AIInferenceCache {
  private cache: Map<string, CachedAIResult> = new Map();
  private readonly MAX_ENTRIES = 10;

  /**
   * Generates a fast SHA-like hash from image data
   */
  public async hashImage(imageData: ImageData): Promise<string> {
    // Instead of hashing the entire massive pixel array, we sample it
    // combined with width and height for a fast, mostly-unique hash.
    const { width, height, data } = imageData;
    
    // Sample pixels (e.g., center, corners, and a few points in between)
    const samples = [
      data[0], data[1], data[2], // top-left
      data[(width - 1) * 4], data[(width - 1) * 4 + 1], // top-right
      data[(height - 1) * width * 4], // bottom-left
      data[(height * width - 1) * 4], // bottom-right
      data[Math.floor(data.length / 2)], // middle
    ];

    const str = `${width}x${height}-${samples.join('-')}`;
    
    // Quick crypto hash if available
    if (crypto && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    return str; // Fallback
  }

  public getCacheKey(imageHash: string, modelId: string): string {
    return `v6_${modelId}_${imageHash}`;
  }

  public get<T>(key: string): CachedAIResult<T> | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Update access time for LRU
      item.timestamp = Date.now();
      // Re-insert to move to back of Map (which maintains insertion order)
      this.cache.delete(key);
      this.cache.set(key, item);
      return item as CachedAIResult<T>;
    }
    return undefined;
  }

  public set<T>(key: string, modelId: string, imageHash: string, result: T): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      // Map iterator returns elements in insertion order (oldest first)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      modelId,
      imageHash,
      timestamp: Date.now(),
      result
    });
  }

  public clear() {
    this.cache.clear();
  }
}

export const aiInferenceCache = new AIInferenceCache();
