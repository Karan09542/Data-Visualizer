import { IAIProvider, AIModel, AIGenerateOptions, AIGenerationResult } from "./IAIProvider";

export class LiteRTProvider implements IAIProvider {
  id = "litert";
  name = "LiteRT";
  description = "Local on-device AI provider using WebGPU/WASM.";
  isCloud = false;

  async initialize(): Promise<void> {
    // Initialize WebGL/WebGPU context if needed
  }

  async authenticate(apiKey: string): Promise<boolean> {
    // Local provider doesn't need authentication
    return true;
  }

  async healthCheck(): Promise<boolean> {
    // Verify WebGPU or WASM support
    return true;
  }

  async listModels(): Promise<AIModel[]> {
    // Return empty array until a local LLM text model weights file is explicitly downloaded/loaded
    return [];
  }

  async generate(
    prompt: string,
    options: AIGenerateOptions,
    signal?: AbortSignal
  ): Promise<AIGenerationResult> {
    throw new Error("LiteRT text generation not fully implemented yet.");
  }

  async stream(
    prompt: string,
    options: AIGenerateOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIGenerationResult> {
    throw new Error("LiteRT streaming text generation not fully implemented yet.");
  }
}
