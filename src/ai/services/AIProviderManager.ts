import { IAIProvider, AIGenerateOptions } from "../providers/IAIProvider";
import { providerRegistry } from "./ProviderRegistry";
import { aiEventBus } from "../events/AIEventBus";
import { aiStatistics } from "../diagnostics/AIStatistics";
import { useAIStore } from "../../store/useAIStore";

export class AIProviderManager {
  private activeProviderId: string | null = null;
  private activeModelId: string | null = null;

  setActiveProvider(providerId: string) {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    this.activeProviderId = providerId;
    aiEventBus.emit("providerChanged", { providerId });
  }

  setActiveModel(modelId: string) {
    this.activeModelId = modelId;
    aiEventBus.emit("modelChanged", { modelId });
  }

  getActiveProvider(): IAIProvider | null {
    const storeState = useAIStore.getState();
    const providerId = this.activeProviderId || storeState.activeProviderId;
    if (!providerId) return null;

    const provider = providerRegistry.getProvider(providerId);
    if (provider) {
      const apiKey = storeState.apiKeys[providerId];
      if (apiKey) {
        provider.authenticate(apiKey);
      }
    }
    return provider || null;
  }

  getActiveModelId(): string | null {
    return this.activeModelId || useAIStore.getState().activeModelId;
  }

  async generate(prompt: string, options: AIGenerateOptions, signal?: AbortSignal) {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No active provider set. Please select an AI provider in Settings.");

    if (provider.isCloud) {
      const storeState = useAIStore.getState();
      const apiKey = storeState.apiKeys[provider.id];
      if (!apiKey || !apiKey.trim()) {
        throw new Error(`API key for ${provider.name} is missing. Please enter your API key in AI Settings.`);
      }
    }

    const finalOptions = {
      ...options,
      modelId: options.modelId || this.getActiveModelId() || '',
    };

    const startTime = performance.now();
    try {
      aiEventBus.emit("generationStarted", { providerId: provider.id, modelId: finalOptions.modelId, prompt });
      const result = await provider.generate(prompt, finalOptions, signal);

      const duration = performance.now() - startTime;
      aiStatistics.recordSuccess(result.usage?.totalTokens || 0, duration);

      aiEventBus.emit("generationCompleted", { result: result.text, usage: result.usage });
      return result;
    } catch (e: any) {
      aiStatistics.recordFailure();
      if (e.message === "Request cancelled" || e.name === "AbortError") {
        aiEventBus.emit("cancelled", { reason: "User cancelled" });
      } else {
        aiEventBus.emit("error", { source: provider.id, error: e });
      }
      throw e;
    }
  }

  async stream(prompt: string, options: AIGenerateOptions, onChunk: (chunk: string) => void, signal?: AbortSignal) {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No active provider set. Please select an AI provider in Settings.");

    if (provider.isCloud) {
      const storeState = useAIStore.getState();
      const apiKey = storeState.apiKeys[provider.id];
      if (!apiKey || !apiKey.trim()) {
        throw new Error(`API key for ${provider.name} is missing. Please enter your API key in AI Settings.`);
      }
    }

    const finalOptions = {
      ...options,
      modelId: options.modelId || this.getActiveModelId() || '',
    };

    const startTime = performance.now();
    let firstTokenTime: number | null = null;

    try {
      aiEventBus.emit("generationStarted", { providerId: provider.id, modelId: finalOptions.modelId, prompt });

      const wrappedOnChunk = (chunk: string) => {
        if (!firstTokenTime) firstTokenTime = performance.now();
        aiEventBus.emit("tokenReceived", { chunk });
        onChunk(chunk);
      };

      const result = await provider.stream(prompt, finalOptions, wrappedOnChunk, signal);

      const endTime = performance.now();
      aiStatistics.recordSuccess(
        result.usage?.totalTokens || 0,
        endTime - startTime,
        firstTokenTime ? firstTokenTime - startTime : undefined,
        firstTokenTime ? endTime - firstTokenTime : undefined
      );

      aiEventBus.emit("generationCompleted", { result: result.text, usage: result.usage });
      return result;
    } catch (e: any) {
      aiStatistics.recordFailure();
      if (e.message === "Request cancelled" || e.name === "AbortError") {
        aiEventBus.emit("cancelled", { reason: "User cancelled" });
      } else {
        aiEventBus.emit("error", { source: provider.id, error: e });
      }
      throw e;
    }
  }
}

export const aiProviderManager = new AIProviderManager();
