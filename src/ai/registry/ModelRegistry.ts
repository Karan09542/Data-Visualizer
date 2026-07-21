import { ModelManifest } from '../types';

import modelsData from './models.json';

class ModelRegistry {
  private models: Map<string, ModelManifest> = new Map();

  constructor() {
    this.loadAll();
  }

  private loadAll() {
    this.models.clear();
    // Auto-register models from manifest
    (modelsData as ModelManifest[]).forEach(manifest => {
      this.register(manifest);
    });

    // Load custom models from localStorage
    try {
      const customStr = localStorage.getItem('custom_ai_models');
      if (customStr) {
        const customModels = JSON.parse(customStr) as ModelManifest[];
        customModels.forEach(manifest => {
          this.register(manifest);
        });
      }
    } catch (e) {
      console.warn("Failed to load custom models", e);
    }
  }

  registerCustom(manifest: ModelManifest) {
    this.register(manifest);
    try {
      const customStr = localStorage.getItem('custom_ai_models');
      let customModels: ModelManifest[] = [];
      if (customStr) {
        customModels = JSON.parse(customStr) as ModelManifest[];
      }
      
      const existingIdx = customModels.findIndex(m => m.id === manifest.id);
      if (existingIdx !== -1) {
        customModels[existingIdx] = manifest;
      } else {
        customModels.push(manifest);
      }
      localStorage.setItem('custom_ai_models', JSON.stringify(customModels));
    } catch (e) {
      console.error("Failed to save custom model", e);
    }
  }

  deleteCustom(id: string) {
    try {
      const customStr = localStorage.getItem('custom_ai_models');
      if (customStr) {
        let customModels = JSON.parse(customStr) as ModelManifest[];
        customModels = customModels.filter(m => m.id !== id);
        localStorage.setItem('custom_ai_models', JSON.stringify(customModels));
        // Reload all to restore defaults if they were overwritten
        this.loadAll();
      }
    } catch (e) {
      console.error("Failed to delete custom model", e);
    }
  }

  register(manifest: ModelManifest) {
    this.models.set(manifest.id, manifest);
  }

  get(id: string): ModelManifest | undefined {
    return this.models.get(id);
  }

  getAll(): ModelManifest[] {
    return Array.from(this.models.values());
  }

  getForTask(task: string): ModelManifest[] {
    return this.getAll().filter(m => m.task === task);
  }

  getSupportingEffect(effect: string): ModelManifest[] {
    return this.getAll().filter(m => m.supports?.includes(effect));
  }
}

export const modelRegistry = new ModelRegistry();
