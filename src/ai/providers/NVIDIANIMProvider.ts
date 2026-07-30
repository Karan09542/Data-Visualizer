import { IAIProvider, AIModel, AIGenerateOptions, AIGenerationResult } from "./IAIProvider";
import { AxiosTransport } from "../transports/AxiosTransport";

export class NVIDIANIMProvider implements IAIProvider {
  id = "nvidia";
  name = "NVIDIA NIM";
  description = "Cloud AI provider powered by NVIDIA NIM APIs.";
  isCloud = true;
  
  private transport: AxiosTransport;
  private apiKey: string | null = null;
  private baseURL = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/api/nvidia"
    : "https://integrate.api.nvidia.com/v1";

  constructor() {
    this.transport = new AxiosTransport(this.baseURL);
  }

  async initialize(): Promise<void> {
    // Initialization is deferred to authentication
  }

  async authenticate(apiKey: string): Promise<boolean> {
    this.apiKey = apiKey;
    return await this.healthCheck();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.transport.request({
        url: "/models",
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });
      return true;
    } catch (e) {
      return false;
    }
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

    return {
      model: options.modelId || "meta/llama-3.1-70b-instruct",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      seed: options.seed !== null ? options.seed : undefined,
      stream: false,
      response_format: options.jsonMode ? { type: "json_object" } : undefined,
      ...(options.modelId === "mistralai/mistral-medium-3.5-128b" && { reasoning_effort: "high" }),
    };
  }

  async generate(
    prompt: string,
    options: AIGenerateOptions,
    signal?: AbortSignal
  ): Promise<AIGenerationResult> {
    if (!this.apiKey) throw new Error("Not authenticated");

    const payload = this.buildPayload(prompt, options);

    const response = await this.transport.request({
      url: "/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: payload,
      signal,
    });

    const data = response.data;
    const text = data.choices?.[0]?.message?.content || "";
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
    if (!this.apiKey) throw new Error("Not authenticated");

    const payload = { ...this.buildPayload(prompt, options), stream: true };
    let fullText = "";

    await this.transport.stream({
      url: "/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
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
