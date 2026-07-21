import { ModelManifest } from '../types';

export class ModelDownloader {
  static async download(
    manifest: ModelManifest, 
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const url = manifest.sources[0]?.url;
    if (!url) {
      throw new Error(`No download source found for model ${manifest.id}`);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download model ${manifest.id}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : manifest.size || 0;
    
    if (total === 0 || !response.body) {
      // If we don't have length or streams aren't fully supported, fallback to arrayBuffer
      if (onProgress) onProgress(100);
      return await response.arrayBuffer();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedLength += value.length;
        if (onProgress && total > 0) {
          // Send progress as 0 to 100
          onProgress((receivedLength / total) * 100);
        }
      }
    }

    const result = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.length;
    }

    return result.buffer;
  }
}
