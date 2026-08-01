import { IAIProvider, AIModel, AIGenerateOptions, AIGenerationResult } from "./IAIProvider";
import { AxiosTransport } from "../transports/AxiosTransport";
import { useAIStore } from "../../store/useAIStore";

export class NVIDIANIMProvider implements IAIProvider {
  id = "nvidia";
  name = "NVIDIA NIM";
  description = "Cloud AI provider powered by NVIDIA NIM APIs.";
  isCloud = true;
  
  private transport: AxiosTransport;
  private apiKey: string | null = null;
  private baseURL = "https://yts-tau.vercel.app";

  constructor() {
    this.transport = new AxiosTransport(this.baseURL);
  }

  private getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    try {
      const storeState = useAIStore.getState();
      return storeState?.apiKeys?.[this.id] || storeState?.apiKeys?.["nvidia"] || null;
    } catch {
      return null;
    }
  }

  async initialize(): Promise<void> {
    // Initialization deferred
  }

  async authenticate(apiKey: string): Promise<boolean> {
    this.apiKey = apiKey;
    return await this.healthCheck();
  }

  async healthCheck(): Promise<boolean> {
    // Proxy backend is available; authenticates with user key or server key
    return true;
  }

  async listModels(): Promise<AIModel[]> {
    return [
      {
        id: "openai/gpt-oss-120b",
        provider: "nvidia",
        displayName: "GPT OSS 120B",
        description: "OpenAI's flagship open-weight 120B parameter reasoning model.",
        contextLength: 128000,
        maxOutputTokens: 4096,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "openai/gpt-oss-20b",
        provider: "nvidia",
        displayName: "GPT OSS 20B",
        description: "OpenAI's fast open-weight 20B parameter reasoning model.",
        contextLength: 128000,
        maxOutputTokens: 4096,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "meta/llama-3.1-70b-instruct",
        provider: "nvidia",
        displayName: "Llama 3.1 70B Instruct",
        description: "Meta's powerful 70B parameter model optimized for instruction following.",
        contextLength: 128000,
        maxOutputTokens: 4096,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: false,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "meta/llama-3.3-70b-instruct",
        provider: "nvidia",
        displayName: "Llama 3.3 70B Instruct",
        description: "State-of-the-art open model from Meta with 128K context window.",
        contextLength: 128000,
        maxOutputTokens: 4096,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "deepseek-ai/deepseek-r1",
        provider: "nvidia",
        displayName: "DeepSeek R1",
        description: "Advanced reasoning model with chain-of-thought problem solving capabilities.",
        contextLength: 64000,
        maxOutputTokens: 8192,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: false,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "nvidia/nemotron-4-340b-instruct",
        provider: "nvidia",
        displayName: "Nemotron 4 340B Instruct",
        description: "NVIDIA's flagship 340B parameter model for complex data processing.",
        contextLength: 4096,
        maxOutputTokens: 4096,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "nvidia/nemotron-nano-12b-v2-vl",
        provider: "nvidia",
        displayName: "Nemotron Nano 12B VL",
        description: "Fast, vision-enabled multimodal model.",
        contextLength: 4096,
        maxOutputTokens: 1024,
        capabilities: {
          streaming: true,
          vision: true,
          reasoning: false,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "mistralai/mistral-medium-3.5-128b",
        provider: "nvidia",
        displayName: "Mistral Medium 3.5 128B",
        description: "Advanced model from Mistral AI with 128K context window.",
        contextLength: 128000,
        maxOutputTokens: 16384,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: true,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      },
      {
        id: "minimaxai/minimax-m3",
        provider: "nvidia",
        displayName: "Minimax M3",
        description: "Advanced Minimax M3 model for high performance text generation.",
        contextLength: 32000,
        maxOutputTokens: 8192,
        capabilities: {
          streaming: true,
          vision: false,
          reasoning: false,
          jsonMode: true,
          functionCalling: true,
          imageGeneration: false,
          embeddings: false,
        }
      }
    ];
  }

  private buildPayload(prompt: string, options: AIGenerateOptions) {
    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const userKey = this.getApiKey();

    return {
      model: options.modelId || "meta/llama-3.1-70b-instruct",
      messages,
      temperature: options.temperature ?? 0.7,
      stream: false,
      ...(userKey ? { apiKey: userKey } : {}),
    };
  }

  async generate(
    prompt: string,
    options: AIGenerateOptions,
    signal?: AbortSignal
  ): Promise<AIGenerationResult> {
    const userKey = this.getApiKey();
    if (!userKey || !userKey.trim()) {
      throw new Error("NVIDIA API Key is missing. Please set your API key in AI Settings.");
    }

    const payload = this.buildPayload(prompt, options);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-nvidia-api-key": userKey,
    };

    const response = await this.transport.request({
      url: "/api/nvidia/chat",
      method: "POST",
      headers,
      body: payload,
      signal,
    });

    const data = response.data;
    const text = data.choices?.[0]?.message?.content || data.text || "";
    return {
      text,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  async stream(
    prompt: string,
    options: AIGenerateOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIGenerationResult> {
    const userKey = this.getApiKey();
    if (!userKey || !userKey.trim()) {
      throw new Error("NVIDIA API Key is missing. Please set your API key in AI Settings.");
    }

    const payload = { ...this.buildPayload(prompt, options), stream: true };
    let fullText = "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-nvidia-api-key": userKey,
    };

    await this.transport.stream({
      url: "/api/nvidia/chat",
      method: "POST",
      headers,
      body: payload,
      signal,
      onChunk: (chunkData) => {
        // SSE lines look like "data: {...}"
        const lines = chunkData.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch {
              // Ignore parse errors from partial chunks
            }
          }
        }
      }
    });

    return { text: fullText };
  }
}
