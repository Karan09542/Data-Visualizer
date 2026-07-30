import { aiHistory } from "../history/AIHistory";
import { aiEventBus } from "../events/AIEventBus";

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AISessionManager {
  private activeSessionId: string | null = null;
  private conversation: ConversationMessage[] = [];
  
  startSession() {
    this.activeSessionId = crypto.randomUUID();
    this.conversation = [];
  }
  
  addMessage(role: "system" | "user" | "assistant", content: string) {
    this.conversation.push({ role, content });
  }

  getConversation(): ConversationMessage[] {
    return [...this.conversation];
  }

  resetSession() {
    this.activeSessionId = null;
    this.conversation = [];
  }

  // Token estimation, context trimming, etc can be implemented here.
  trimContext(maxTokens: number) {
    // Basic trimming logic - would use a tokenizer in production
    // For now, keep the last N messages
    if (this.conversation.length > 10) {
       this.conversation = [
         this.conversation[0], // Keep system prompt
         ...this.conversation.slice(-9) // Keep last 9 messages
       ];
    }
  }
}

export const aiSessionManager = new AISessionManager();
