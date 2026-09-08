import { ModelManifest } from '../types';

export class ModelDownloader {
  static async download(
    manifest: ModelManifest,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<ArrayBuffer> {
    const url = manifest.sources[0]?.url;
    if (!url) {
      throw new Error(`No download source found for model ${manifest.id}`);
    }

    if (signal?.aborted) {
      throw new DOMException('Model download cancelled', 'AbortError');
    }

    // Handing the signal to fetch is what actually tears down the connection; without it a
    // "cancel" could only stop updating the UI while the bytes kept arriving.
    const response = await fetch(url, { signal });
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal?.aborted) {
          throw new DOMException('Model download cancelled', 'AbortError');
        }
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          if (onProgress && total > 0) {
            // Send progress as 0 to 100
            onProgress((receivedLength / total) * 100);
          }
        }
      }
    } catch (e) {
      // Release the stream so the connection is not held open by a half-read body.
      try { await reader.cancel(); } catch { /* already torn down */ }
      throw e;
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
