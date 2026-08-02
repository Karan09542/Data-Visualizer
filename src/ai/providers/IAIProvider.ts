export interface AIModelCapability {
  streaming: boolean;
  vision: boolean;
  reasoning: boolean;
  jsonMode: boolean;
  functionCalling: boolean;
  imageGeneration: boolean;
  embeddings: boolean;
}

export interface AIModel {
  id: string;
  provider: string;
  displayName: string;
  description: string;
  contextLength: number;
  maxOutputTokens: number;
  capabilities: AIModelCapability;
  pricing?: {
    inputCostPer1K?: number;
    outputCostPer1K?: number;
  };
}

export interface AIGenerateOptions {
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningMode?: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  seed?: number | null;
  jsonMode?: boolean;
  tools?: any[]; // For function calling
}

export interface AIGenerationResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface IAIProvider {
  id: string;
  name: string;
  description: string;
  isCloud: boolean;
  isLocal?: boolean;

  initialize(): Promise<void>;
  authenticate(apiKey: string): Promise<boolean>;
  healthCheck(): Promise<boolean>;
  
  /**
   * Discovers and lists available models for this provider.
   */
  listModels(): Promise<AIModel[]>;
  
  /**
   * Generates a complete response (non-streaming).
   */
  generate(
    prompt: string,
    options: AIGenerateOptions,
    signal?: AbortSignal
  ): Promise<AIGenerationResult>;
  
  /**
   * Generates a streaming response.
   */
  stream(
    prompt: string,
    options: AIGenerateOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIGenerationResult>;
}
