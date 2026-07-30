export interface AIHistoryEntry {
  id: string;
  timestamp: number;
  providerId: string;
  modelId: string;
  prompt: string;
  response: string;
  affectedNodes?: string[];
}

export class AIHistory {
  private entries: AIHistoryEntry[] = [];
  
  // Persist to local storage or an external DB if necessary.
  
  addEntry(entry: Omit<AIHistoryEntry, "id" | "timestamp">) {
    const fullEntry: AIHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    this.entries.unshift(fullEntry);
  }

  getEntries(): AIHistoryEntry[] {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}

export const aiHistory = new AIHistory();
