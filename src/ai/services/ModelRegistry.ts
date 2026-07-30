import { AIModel } from "../providers/IAIProvider";

export class ModelRegistry {
  private models = new Map<string, AIModel>();

  registerModel(model: AIModel) {
    this.models.set(model.id, model);
  }

  registerModels(models: AIModel[]) {
    models.forEach((m) => this.registerModel(m));
  }

  getModel(id: string): AIModel | undefined {
    return this.models.get(id);
  }

  getAllModels(): AIModel[] {
    return Array.from(this.models.values());
  }

  getModelsByProvider(providerId: string): AIModel[] {
    return this.getAllModels().filter((m) => m.provider === providerId);
  }

  clearProviderModels(providerId: string) {
    for (const [id, model] of this.models.entries()) {
      if (model.provider === providerId) {
        this.models.delete(id);
      }
    }
  }
}

export const modelRegistry = new ModelRegistry();
