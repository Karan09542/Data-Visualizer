import { IAIProvider } from "../providers/IAIProvider";
import { aiEventBus } from "../events/AIEventBus";

export class ProviderRegistry {
  private providers = new Map<string, IAIProvider>();

  registerProvider(provider: IAIProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): IAIProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  removeProvider(id: string) {
    this.providers.delete(id);
  }
}

export const providerRegistry = new ProviderRegistry();
