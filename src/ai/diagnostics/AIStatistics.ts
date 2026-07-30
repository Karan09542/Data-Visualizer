export interface AIStats {
  responseTime: number;
  firstTokenLatency: number;
  streamingDuration: number;
  tokenCount: number;
  requestCount: number;
  failureCount: number;
}

export class AIStatistics {
  private stats: AIStats = {
    responseTime: 0,
    firstTokenLatency: 0,
    streamingDuration: 0,
    tokenCount: 0,
    requestCount: 0,
    failureCount: 0,
  };

  recordSuccess(tokens: number, responseTimeMs: number, firstTokenMs?: number, streamDurationMs?: number) {
    this.stats.requestCount++;
    this.stats.tokenCount += tokens;
    
    // Calculate rolling average for response times
    this.stats.responseTime = (this.stats.responseTime + responseTimeMs) / 2;
    
    if (firstTokenMs) {
      this.stats.firstTokenLatency = (this.stats.firstTokenLatency + firstTokenMs) / 2;
    }
    if (streamDurationMs) {
      this.stats.streamingDuration = (this.stats.streamingDuration + streamDurationMs) / 2;
    }
  }

  recordFailure() {
    this.stats.requestCount++;
    this.stats.failureCount++;
  }

  getStats(): AIStats {
    return { ...this.stats };
  }
}

export const aiStatistics = new AIStatistics();
