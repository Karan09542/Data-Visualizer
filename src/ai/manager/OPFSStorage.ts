import { ModelManifest } from '../types';

const MODEL_FILE = 'model.tflite';

class OPFSStorage {
  /** OPFS is unavailable in some contexts (older Safari, non-secure origins, some in-app browsers). */
  get isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.storage
      && typeof navigator.storage.getDirectory === 'function';
  }

  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    return await navigator.storage.getDirectory();
  }

  /**
   * Resolves models/<id>/<version>/. Reads pass create=false: with create=true even a miss left
   * behind an empty directory tree, so probing for models that were never cached slowly littered
   * OPFS. Keying on version means bumping a manifest version invalidates the cache for free.
   */
  private async getModelDirectory(manifest: ModelManifest, create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRoot();
    const modelsDir = await root.getDirectoryHandle('models', { create });
    const modelDir = await modelsDir.getDirectoryHandle(manifest.id, { create });
    return await modelDir.getDirectoryHandle(manifest.version, { create });
  }

  async saveModel(manifest: ModelManifest, modelData: ArrayBuffer): Promise<void> {
    if (!this.isSupported) throw new Error('OPFS is not available in this browser');
    const dir = await this.getModelDirectory(manifest, true);
    const fileHandle = await dir.getFileHandle(MODEL_FILE, { create: true });

    // Use createWritable if supported (standard in modern browsers for OPFS)
    const writable = await (fileHandle as any).createWritable();
    try {
      await writable.write(modelData);
      await writable.close();
    } catch (e) {
      // Leaving a half-written file behind would make hasModel() report a cache hit forever.
      try { await writable.abort?.(); } catch { /* already closed */ }
      try { await dir.removeEntry(MODEL_FILE); } catch { /* nothing to clean up */ }
      throw e;
    }
  }

  async loadModel(manifest: ModelManifest): Promise<ArrayBuffer | null> {
    if (!this.isSupported) return null;
    try {
      const dir = await this.getModelDirectory(manifest, false);
      const fileHandle = await dir.getFileHandle(MODEL_FILE, { create: false });
      const file = await fileHandle.getFile();
      if (file.size === 0) return null;
      return await file.arrayBuffer();
    } catch (e) {
      // File or directory does not exist
      return null;
    }
  }

  async hasModel(manifest: ModelManifest): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      const dir = await this.getModelDirectory(manifest, false);
      const fileHandle = await dir.getFileHandle(MODEL_FILE, { create: false });
      const file = await fileHandle.getFile();
      // A zero-byte file means an interrupted write, not a usable cache entry.
      return file.size > 0;
    } catch (e) {
      return false;
    }
  }

  async deleteModel(manifest: ModelManifest): Promise<boolean> {
    if (!this.isSupported) return false;
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

  /**
   * Every model file in storage, whether or not it is still offered.
   *
   * Everything else here is keyed by a manifest, so a model dropped from the registry keeps its
   * download forever with nothing able to name it. This is how those are found.
   */
  async listCached(): Promise<{ id: string; version: string; size: number }[]> {
    if (!this.isSupported) return [];
    const found: { id: string; version: string; size: number }[] = [];
    try {
      const root = await this.getRoot();
      const modelsDir = await root.getDirectoryHandle('models', { create: false });
      for await (const [id, modelDir] of (modelsDir as any).entries()) {
        if (modelDir.kind !== 'directory') continue;
        for await (const [version, versionDir] of modelDir.entries()) {
          if (versionDir.kind !== 'directory') continue;
          try {
            const file = await (await versionDir.getFileHandle(MODEL_FILE, { create: false })).getFile();
            found.push({ id, version, size: file.size });
          } catch {
            // No model file under this version: nothing cached here.
          }
        }
      }
    } catch {
      // Nothing has been downloaded yet.
    }
    return found;
  }

  /** Removes one cached version by name, for models the registry no longer knows about. */
  async deleteCached(id: string, version: string): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      const root = await this.getRoot();
      const modelsDir = await root.getDirectoryHandle('models', { create: false });
      const modelDir = await modelsDir.getDirectoryHandle(id, { create: false });
      await modelDir.removeEntry(version, { recursive: true });
      // A model directory with no versions left is just clutter.
      let empty = true;
      for await (const _ of (modelDir as any).keys()) { empty = false; break; }
      if (empty) await modelsDir.removeEntry(id, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async getModelSize(manifest: ModelManifest): Promise<number | null> {
    if (!this.isSupported) return null;
    try {
      const dir = await this.getModelDirectory(manifest, false);
      const fileHandle = await dir.getFileHandle(MODEL_FILE, { create: false });
      const file = await fileHandle.getFile();
      return file.size;
    } catch (e) {
      return null;
    }
  }
}

export const opfsStorage = new OPFSStorage();
