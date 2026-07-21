import { ModelManifest } from '../types';

class OPFSStorage {
  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    return await navigator.storage.getDirectory();
  }

  private async getModelDirectory(manifest: ModelManifest): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRoot();
    const modelsDir = await root.getDirectoryHandle('models', { create: true });
    const modelDir = await modelsDir.getDirectoryHandle(manifest.id, { create: true });
    const versionDir = await modelDir.getDirectoryHandle(manifest.version, { create: true });
    return versionDir;
  }

  async saveModel(manifest: ModelManifest, modelData: ArrayBuffer): Promise<void> {
    const dir = await this.getModelDirectory(manifest);
    const fileHandle = await dir.getFileHandle('model.tflite', { create: true });
    
    // Use createWritable if supported (standard in modern browsers for OPFS)
    const writable = await (fileHandle as any).createWritable();
    await writable.write(modelData);
    await writable.close();
  }

  async loadModel(manifest: ModelManifest): Promise<ArrayBuffer | null> {
    try {
      const dir = await this.getModelDirectory(manifest);
      const fileHandle = await dir.getFileHandle('model.tflite', { create: false });
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    } catch (e) {
      // File or directory does not exist
      return null;
    }
  }

  async hasModel(manifest: ModelManifest): Promise<boolean> {
    try {
      const dir = await this.getModelDirectory(manifest);
      await dir.getFileHandle('model.tflite', { create: false });
      return true;
    } catch (e) {
      return false;
    }
  }

  async deleteModel(manifest: ModelManifest): Promise<boolean> {
    try {
      const root = await this.getRoot();
      const modelsDir = await root.getDirectoryHandle('models', { create: false });
      const modelDir = await modelsDir.getDirectoryHandle(manifest.id, { create: false });
      
      // Delete the specific version dir
      await modelDir.removeEntry(manifest.version, { recursive: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getModelSize(manifest: ModelManifest): Promise<number | null> {
    try {
      const dir = await this.getModelDirectory(manifest);
      const fileHandle = await dir.getFileHandle('model.tflite', { create: false });
      const file = await fileHandle.getFile();
      return file.size;
    } catch (e) {
      return null;
    }
  }
}

export const opfsStorage = new OPFSStorage();
