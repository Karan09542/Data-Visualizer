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
        id: "z-ai/glm-5.2",
        provider: "nvidia",
        displayName: "GLM 5.2",
        description: "Z-AI flagship model with thinking/reasoning capability.",
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
        id: "stepfun-ai/step-3.7-flash",
        provider: "nvidia",
        displayName: "Step 3.7 Flash",
        description: "Fast, highly efficient StepFun AI model.",
        contextLength: 128000,
        maxOutputTokens: 16384,
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
        id: "deepseek-ai/deepseek-v4-flash",
        provider: "nvidia",
        displayName: "DeepSeek V4 Flash",
        description: "High-performance DeepSeek model with thinking and high reasoning effort.",
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
        id: "deepseek-ai/deepseek-v4-pro",
        provider: "nvidia",
        displayName: "DeepSeek V4 Pro",
        description: "DeepSeek flagship professional model.",
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
        id: "google/gemma-4-31b-it",
        provider: "nvidia",
        displayName: "Gemma 4 31B IT",
        description: "Google's Gemma 4 instruction-tuned model with thinking support.",
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
        id: "nvidia/nemotron-3-nano-30b-a3b",
        provider: "nvidia",
        displayName: "Nemotron 3 Nano 30B A3B",
        description: "NVIDIA Nemotron 3 30B model with dedicated reasoning budget.",
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
    const modelId = options.modelId || "meta/llama-3.1-70b-instruct";

    const payload: any = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: false,
      ...(userKey ? { apiKey: userKey } : {}),
    };

    if (options.maxTokens) payload.max_tokens = options.maxTokens;
    if (options.topP !== undefined) payload.top_p = options.topP;

    // Model specific custom kwargs & settings provided by user
    switch (modelId) {
      case "z-ai/glm-5.2":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 1;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.seed = 42;
        payload.chat_template_kwargs = { enable_thinking: true, clear_thinking: false };
        break;

      case "stepfun-ai/step-3.7-flash":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 0.95;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.seed = 42;
        break;

      case "deepseek-ai/deepseek-v4-flash":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 0.95;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.chat_template_kwargs = { thinking: true, reasoning_effort: "high" };
        break;

      case "deepseek-ai/deepseek-v4-pro":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 0.95;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.chat_template_kwargs = { thinking: false };
        break;

      case "google/gemma-4-31b-it":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 0.95;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.chat_template_kwargs = { enable_thinking: true };
        break;

      case "nvidia/nemotron-3-nano-30b-a3b":
        payload.temperature = options.temperature ?? 1;
        payload.top_p = options.topP ?? 1;
        payload.max_tokens = options.maxTokens ?? 16384;
        payload.reasoning_budget = 16384;
        payload.chat_template_kwargs = { enable_thinking: true };
        break;
    }

    return payload;
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
    const msg = data.choices?.[0]?.message;
    const reasoning = msg?.reasoning || msg?.reasoning_content || "";
    const content = msg?.content || data.text || "";
    const text = reasoning ? `<think>\n${reasoning}\n</think>\n\n${content}` : content;

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
    let sseBuffer = "";

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
        sseBuffer += chunkData;
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta;
              const reasoning = delta?.reasoning_content || delta?.reasoning;
              const content = delta?.content;

              if (reasoning) {
                fullText += reasoning;
                onChunk(reasoning);
              }
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

    if (sseBuffer.trim().startsWith("data: ") && sseBuffer.trim() !== "data: [DONE]") {
      try {
        const parsed = JSON.parse(sseBuffer.trim().slice(6));
        const delta = parsed.choices?.[0]?.delta;
        const reasoning = delta?.reasoning_content || delta?.reasoning;
        const content = delta?.content;

        if (reasoning) {
          fullText += reasoning;
          onChunk(reasoning);
        }
        if (content) {
          fullText += content;
          onChunk(content);
        }
      } catch { }
    }

    return { text: fullText };
  }
}
