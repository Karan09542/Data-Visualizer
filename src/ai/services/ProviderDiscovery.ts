import { providerRegistry } from "./ProviderRegistry";
import { modelRegistry } from "./ModelRegistry";
import { IAIProvider } from "../providers/IAIProvider";
import { aiEventBus } from "../events/AIEventBus";

export class ProviderDiscovery {
  /**
   * Initializes all discovered providers.
   * This is where new providers are instantiated and registered.
   */
  async discoverAndRegister(): Promise<void> {
    // We will dynamically import the providers to keep the main bundle clean
    // or register them manually here.
    
    // In the future, this could scan a directory or check a plugin registry.
    // For now, we manually register the known ones.
    
    try {
      const { LiteRTProvider } = await import("../providers/LiteRTProvider");
      const liteRt = new LiteRTProvider();
      await this.registerAndValidate(liteRt);
    } catch (e) {
      console.warn("Failed to discover LiteRT Provider", e);
    }

    try {
      const { NVIDIANIMProvider } = await import("../providers/NVIDIANIMProvider");
      const nvidia = new NVIDIANIMProvider();
      await this.registerAndValidate(nvidia);
    } catch (e) {
      console.warn("Failed to discover NVIDIA NIM Provider", e);
    }
  }

  private async registerAndValidate(provider: IAIProvider) {
    providerRegistry.registerProvider(provider);
    
    try {
      await provider.initialize();
      const isHealthy = await provider.healthCheck();
      if (isHealthy) {
        const models = await provider.listModels();
        modelRegistry.registerModels(models);
      }
    } catch (e) {
      console.error(`Failed to initialize provider ${provider.id}:`, e);
      aiEventBus.emit("error", {
        source: provider.id,
        error: new Error(`Failed to initialize ${provider.name}`),
      });
    }
  }
}

export const providerDiscovery = new ProviderDiscovery();
