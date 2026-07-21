import { ModelManifest } from '../types';
import { modelRegistry } from '../registry/ModelRegistry';
import { ModelLoader } from './ModelLoader';
import { opfsStorage } from './OPFSStorage';

export class ModelManager {
  
  async getManifest(modelId: string): Promise<ModelManifest> {
    const manifest = modelRegistry.get(modelId);
    if (!manifest) throw new Error(`Model ${modelId} not registered`);
    return manifest;
  }

  async isDownloaded(modelId: string): Promise<boolean> {
    const manifest = await this.getManifest(modelId);
    if (manifest.sources[0]?.type === 'local') return true;
    return await opfsStorage.hasModel(manifest);
  }

  async download(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    const manifest = await this.getManifest(modelId);
    if (await this.isDownloaded(modelId)) return;
    
    // ModelLoader.load handles downloading and caching to OPFS
    await ModelLoader.load(manifest, (state, p) => {
       if (state === 'downloading' && onProgress && p !== undefined) onProgress(p);
    });
  }

  async delete(modelId: string): Promise<void> {
    const manifest = await this.getManifest(modelId);
    await opfsStorage.deleteModel(manifest);
  }

  async load(modelId: string, onProgress?: (state: string, p?: number) => void): Promise<ArrayBuffer> {
    const manifest = await this.getManifest(modelId);
    return await ModelLoader.load(manifest, onProgress);
  }

  async getDownloadedModels(): Promise<ModelManifest[]> {
    const all = modelRegistry.getAll();
    const downloaded: ModelManifest[] = [];
    for (const m of all) {
      if (m.sources[0]?.type === 'local' || await opfsStorage.hasModel(m)) {
        downloaded.push(m);
      }
    }
    return downloaded;
  }
}

export const modelManager = new ModelManager();
