import { IAIProvider, AIModel } from "../providers/IAIProvider";
import { modelRegistry } from "./ModelRegistry";
import { providerRegistry } from "./ProviderRegistry";

export class CapabilityResolver {
  /**
   * Checks if a specific model supports a capability.
   */
  hasCapability(modelId: string, capability: keyof AIModel['capabilities']): boolean {
    const model = modelRegistry.getModel(modelId);
    if (!model) return false;
    return !!model.capabilities[capability];
  }

  /**
   * Checks if a provider has at least one model with a specific capability.
   */
  providerHasCapability(providerId: string, capability: keyof AIModel['capabilities']): boolean {
    const models = modelRegistry.getModelsByProvider(providerId);
    return models.some((m) => m.capabilities[capability]);
  }

  /**
   * Returns a list of models that support all requested capabilities.
   */
  resolveModelsByCapabilities(capabilities: Array<keyof AIModel['capabilities']>): AIModel[] {
    return modelRegistry.getAllModels().filter((model) => 
      capabilities.every((cap) => model.capabilities[cap])
    );
  }
}

export const capabilityResolver = new CapabilityResolver();
