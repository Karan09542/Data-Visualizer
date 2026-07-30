import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AIState {
  // Provider settings
  activeProviderId: string;
  activeModelId: string;
  
  // Credentials (keyed by provider id)
  apiKeys: Record<string, string>;
  
  // Generation Options
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  reasoningMode: boolean;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  streamingEnabled: boolean;
  seed: number | null;
  systemPrompt: string;
  
  // Actions
  setActiveProvider: (providerId: string) => void;
  setActiveModel: (modelId: string) => void;
  setApiKey: (providerId: string, key: string) => void;
  removeApiKey: (providerId: string) => void;
  
  updateSettings: (settings: Partial<Pick<AIState, 'temperature' | 'topP' | 'maxTokens' | 'frequencyPenalty' | 'presencePenalty' | 'reasoningMode' | 'reasoningEffort' | 'streamingEnabled' | 'seed' | 'systemPrompt'>>) => void;
  applyPreset: (presetName: 'Fast' | 'Reasoning' | 'JSON Editing' | 'Documentation' | 'Translation') => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      activeProviderId: 'nvidia', // Default to cloud
      activeModelId: 'meta/llama-3.1-70b-instruct',
      
      apiKeys: {},
      
      temperature: 0.7,
      topP: 1,
      maxTokens: 1024,
      frequencyPenalty: 0,
      presencePenalty: 0,
      reasoningMode: false,
      reasoningEffort: 'none',
      streamingEnabled: true,
      seed: null,
      systemPrompt: 'You are an expert JSON manipulation assistant. Follow all instructions carefully.',
      
      setActiveProvider: (providerId) => set({ activeProviderId: providerId }),
      setActiveModel: (modelId) => set({ activeModelId: modelId }),
      setApiKey: (providerId, key) => set((state) => ({ 
        apiKeys: { ...state.apiKeys, [providerId]: key } 
      })),
      removeApiKey: (providerId) => set((state) => {
        const newKeys = { ...state.apiKeys };
        delete newKeys[providerId];
        return { apiKeys: newKeys };
      }),
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      
      applyPreset: (presetName) => set((state) => {
        switch (presetName) {
          case 'Fast':
            return { temperature: 0.5, topP: 0.9, maxTokens: 512, reasoningMode: false, streamingEnabled: true };
          case 'Reasoning':
            return { temperature: 0.2, topP: 0.95, maxTokens: 4096, reasoningMode: true, reasoningEffort: 'high' };
          case 'JSON Editing':
            return { temperature: 0.1, topP: 0.1, maxTokens: 2048, reasoningMode: false, frequencyPenalty: 0, presencePenalty: 0 };
          case 'Documentation':
            return { temperature: 0.7, topP: 0.9, maxTokens: 2048, reasoningMode: false };
          case 'Translation':
            return { temperature: 0.3, topP: 0.9, maxTokens: 2048, reasoningMode: false };
          default:
            return {};
        }
      }),
    }),
    {
      name: 'data-visualizer-ai-storage', // unique name
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // We only persist these fields
        activeProviderId: state.activeProviderId,
        activeModelId: state.activeModelId,
        apiKeys: state.apiKeys,
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
        frequencyPenalty: state.frequencyPenalty,
        presencePenalty: state.presencePenalty,
        reasoningMode: state.reasoningMode,
        reasoningEffort: state.reasoningEffort,
        streamingEnabled: state.streamingEnabled,
        seed: state.seed,
        systemPrompt: state.systemPrompt,
      }),
    }
  )
);
