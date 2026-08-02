import { createWorker } from 'tesseract.js';

export interface TesseractConfig {
  langs: string[];
  whitelist?: string;
  psm?: string;
  oem?: number;
  onProgress?: (progress: any) => void;
}

// We load the traineddata directly from OPFS, so we don't need a langPath or Service Worker proxy.

/**
 * Downloads a language model from the official CDN and stores it in OPFS.
 */
export async function downloadLanguage(langCode: string, onProgress?: (percent: number) => void): Promise<void> {
  const url = `https://tessdata.projectnaptha.com/4.0.0/${langCode}.traineddata.gz`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download language data for ${langCode}`);

  const contentLength = Number(response.headers.get('content-length')) || 0;
  let receivedLength = 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedLength += value.length;
      if (contentLength && onProgress) {
        onProgress(Math.round((receivedLength / contentLength) * 100));
      }
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: 'application/x-gzip' });
  const opfsRoot = await navigator.storage.getDirectory();
  const fileHandle = await opfsRoot.getFileHandle(`${langCode}.traineddata.gz`, { create: true });
  
  // createWritable is part of the File System Access API
  const writable = await (fileHandle as any).createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Deletes a downloaded language from OPFS.
 */
export async function deleteLanguage(langCode: string): Promise<void> {
  const opfsRoot = await navigator.storage.getDirectory();
  try {
    await opfsRoot.removeEntry(`${langCode}.traineddata.gz`);
  } catch (err) {
    console.warn(`Could not delete ${langCode}:`, err);
  }
}

/**
 * Lists all languages currently stored in OPFS.
 */
export async function getDownloadedLanguages(): Promise<string[]> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const langs: string[] = [];
    // @ts-ignore
    for await (const [name, handle] of opfsRoot.entries()) {
      if (name.endsWith('.traineddata.gz')) {
        langs.push(name.replace('.traineddata.gz', ''));
      }
    }
    return langs;
  } catch (e) {
    console.error('Failed to get downloaded languages:', e);
    return [];
  }
}

/**
 * Extracts text from an image using the local Tesseract.js engine and OPFS cached models.
 */
export async function recognizeText(
  image: File | string | HTMLImageElement | HTMLCanvasElement,
  config: TesseractConfig
): Promise<string> {
  const { langs, whitelist, psm, oem, onProgress } = config;
  if (!langs || langs.length === 0) {
    throw new Error('No languages specified for OCR.');
  }

  const langStr = langs.join('+');
  
  // Verify languages are downloaded in OPFS
  const downloaded = await getDownloadedLanguages();
  for (const langCode of langs) {
    if (!downloaded.includes(langCode)) {
      throw new Error(`Language data for ${langCode} not found in local storage. Please download it first.`);
    }
  }

  const worker = await createWorker(langStr, oem ?? 1, {
    workerPath: '/tesseract/custom-worker.js',
    corePath: '/tesseract',
    langPath: '/opfs-tessdata/', // MUST HAVE TRAILING SLASH so it requests /opfs-tessdata/eng.traineddata.gz
    logger: onProgress,
    cacheMethod: 'none', // Bypassing built-in cache to strictly use our OPFS proxy via Service Worker
    workerBlobURL: false, // Required for Service Worker to intercept fetches inside the worker
  });

  const params: any = {};
  if (whitelist) params.tessedit_char_whitelist = whitelist;
  if (psm) params.tessedit_pageseg_mode = psm;
  
  if (Object.keys(params).length > 0) {
    await worker.setParameters(params);
  }

  try {
    // Resize image to prevent WASM Out-Of-Memory crashes with complex layout analysis on large photos
    const resizedImage = await resizeImageForOCR(image);
    
    const { data: { text } } = await worker.recognize(resizedImage);
    return text;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    // Tesseract WASM crashes (std::bad_alloc or abort) on layout analysis if text is too large
    if (!['7', '8', '10'].includes(psm || '3')) {
      throw new Error(`OCR Engine crashed during layout analysis. This usually happens if the image only contains a single large word or line. Try changing the 'Text Layout' option to 'Single Word' or 'Single Line'.\n\nOriginal Error: ${errorMsg}`);
    }
    throw err;
  } finally {
    await worker.terminate();
  }
}

// Helper to scale down images that are too large
async function resizeImageForOCR(image: any): Promise<any> {
  if (typeof window === 'undefined') return image;
  
  return new Promise((resolve) => {
    let src = image;
    if (image instanceof File || image instanceof Blob) {
      src = URL.createObjectURL(image);
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (image instanceof File || image instanceof Blob) {
        URL.revokeObjectURL(src);
      }
      
      const MAX_DIM = 1000;
      let { width, height } = img;
      
      if (width <= MAX_DIM && height <= MAX_DIM) {
        // If we don't need to resize, return the original image
        // But if it's a Canvas, tesseract might prefer a Blob, let's just return original
        resolve(image); 
        return;
      }
      
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(image);
        return;
      }
      
      // Use better smoothing for OCR
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Return blob instead of canvas to avoid any thread cloning issues with large canvases
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else resolve(canvas); // fallback to canvas
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => resolve(image); // Fallback
    img.src = src;
  });
}
