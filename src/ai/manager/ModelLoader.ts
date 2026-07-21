import { ModelManifest } from '../types';
import { opfsStorage } from './OPFSStorage';
import { ModelDownloader } from './ModelDownloader';
import JSZip from 'jszip';

export class ModelLoader {
  static async load(
    manifest: ModelManifest,
    onProgress?: (state: string, progress?: number) => void
  ): Promise<ArrayBuffer> {
    // 1. Check if model exists in OPFS
    const isLocal = manifest.sources[0]?.type === 'local';
    const hasModel = !isLocal && await opfsStorage.hasModel(manifest);
    
    if (hasModel) {
      if (onProgress) onProgress('loading');
      const data = await opfsStorage.loadModel(manifest);
      if (data) return data;
      // If data is null somehow, fallback to downloading
    }

    // 2. Download Model
    if (onProgress) onProgress('downloading', 0);
    const data = await ModelDownloader.download(manifest, (progress) => {
      if (onProgress) onProgress('downloading', progress);
    });

    let finalData = data;

    // If the source URL indicates a zip file, extract it
    const sourceUrl = manifest.sources[0]?.url || '';
    if (sourceUrl.toLowerCase().endsWith('.zip')) {
      if (onProgress) onProgress('extracting');
      
      const zip = await JSZip.loadAsync(data);
      const tfliteFiles: JSZip.JSZipObject[] = [];
      
      zip.forEach((relativePath, file) => {
        if (!file.dir && relativePath.toLowerCase().endsWith('.tflite') && !relativePath.includes('__MACOSX')) {
          tfliteFiles.push(file);
        }
      });

      if (tfliteFiles.length === 0) {
        throw new Error(`No .tflite files found inside downloaded zip for model ${manifest.id}`);
      }

      // If multiple variants exist, try to pick the best one (prefer fp16/float16, then float, then dynamic, else first)
      let bestFile = tfliteFiles[0];
      if (tfliteFiles.length > 1) {
        const scoreFile = (name: string) => {
          name = name.toLowerCase();
          if (name.includes('fp16') || name.includes('float16')) return 4;
          if (name.includes('fp32') || name.includes('float32') || name.includes('float')) return 3;
          if (name.includes('dynamic')) return 2;
          if (name.includes('int8')) return 1;
          return 0;
        };

        bestFile = tfliteFiles.sort((a, b) => scoreFile(b.name) - scoreFile(a.name))[0];
      }

      finalData = await bestFile.async('arraybuffer');
    }

    // 3. Save to OPFS for future
    if (!isLocal) {
      if (onProgress) onProgress('saving');
      await opfsStorage.saveModel(manifest, finalData);
    }

    return finalData;
  }
}
