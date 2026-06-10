import { db, Asset } from "../lib/db";

/**
 * Computes a standard SHA-256 hex string hash from an ArrayBuffer natively.
 */
export async function computeHash(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an image dimensions object from a Blob.
 */
export function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Generates a lightweight JPEG thumbnail from any image Blob with a custom width/height ceiling.
 */
export function generateThumbnail(blob: Blob, maxWidth = 160, maxHeight = 160): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If it is SVG or not a standard format, we might not need/want canvas resize, but let's handle gracefully.
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(blob);
        return;
      }
      
      try {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (thumbnailBlob) => {
            if (thumbnailBlob) {
              resolve(thumbnailBlob);
            } else {
              resolve(blob);
            }
          },
          "image/jpeg",
          0.7
        );
      } catch (err) {
        resolve(blob);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Imports a file into the database.
 * Computes hashing for deduplication, saves both original and lightweight thumbnail,
 * and returns the lightweight asset reference.
 */
export async function importFile(file: File): Promise<{ assetId: string; thumbnailId?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hash = await computeHash(arrayBuffer);
    
    // 1. Deduplication Check
    const existing = await db.assets.where("hash").equals(hash).first();
    if (existing) {
      return { assetId: existing.assetId, thumbnailId: existing.thumbnailId };
    }
    
    // 2. Setup original Blob
    const originalBlob = new Blob([arrayBuffer], { type: file.type });
    const dims = await getImageDimensions(originalBlob);
    
    // 3. Generate IDs
    const randomHex = () => Math.random().toString(36).substring(2, 10);
    const assetId = `img_${randomHex()}`;
    const thumbnailId = `thumb_${randomHex()}`;
    
    // 4. Generate Thumbnail
    let thumbnailBlob: Blob;
    try {
      thumbnailBlob = await generateThumbnail(originalBlob);
    } catch {
      thumbnailBlob = originalBlob; // fallback
    }
    
    // 5. Store both original and thumbnail
    const originalAsset: Asset = {
      assetId,
      thumbnailId,
      hash,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      width: dims.width,
      height: dims.height,
      data: originalBlob,
      createdAt: Date.now()
    };
    
    const thumbnailAsset: Asset = {
      assetId: thumbnailId,
      mimeType: "image/jpeg",
      size: thumbnailBlob.size,
      data: thumbnailBlob,
      createdAt: Date.now()
    };
    
    await db.assets.add(originalAsset);
    await db.assets.add(thumbnailAsset);
    
    return { assetId, thumbnailId };
  } catch (err) {
    console.error("AssetManager import failed", err);
    throw err;
  }
}

/**
 * Retrieves the Blob for an given assetId.
 */
export async function getAssetBlob(assetId: string): Promise<Blob | null> {
  try {
    const asset = await db.assets.get(assetId);
    if (!asset) return null;
    if (asset.data instanceof Blob) {
      return asset.data;
    }
    return new Blob([asset.data], { type: asset.mimeType });
  } catch {
    return null;
  }
}

// Memory-friendly Object URL caching to prevent multiple recreations of URLs
const urlCache = new Map<string, string>();

/**
 * Resolves an asset ID to a temporary, cacheable Object URL.
 */
export async function resolveAssetUrl(assetId: string): Promise<string> {
  if (!assetId) return "";
  if (urlCache.has(assetId)) {
    return urlCache.get(assetId)!;
  }
  
  const blob = await getAssetBlob(assetId);
  if (!blob) return "";
  
  const url = URL.createObjectURL(blob);
  urlCache.set(assetId, url);
  return url;
}

/**
 * Clears the Object URL cache.
 */
export function revokeAllUrls() {
  for (const url of urlCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  urlCache.clear();
}

/**
 * Recursively scans any JSON graph state (parsedData) to accumulate referenced assetId/assetRef values.
 */
export function collectReferencedAssetIds(obj: any): Set<string> {
  const ids = new Set<string>();
  
  function traverse(current: any) {
    if (!current) return;
    if (typeof current === "object") {
      if (typeof current.assetId === "string" && current.assetId) {
        ids.add(current.assetId);
      }
      if (typeof current.assetRef === "string" && current.assetRef) {
        ids.add(current.assetRef);
      }
      // Or if a string itself is an asset ID, match prefix as fallback
      if (typeof current === "string" && (current.startsWith("img_") || current.startsWith("thumb_"))) {
        ids.add(current);
      }
      
      for (const key of Object.keys(current)) {
        traverse(current[key]);
      }
    } else if (typeof current === "string") {
      if (current.startsWith("img_") || current.startsWith("thumb_")) {
        ids.add(current);
      }
    }
  }
  
  traverse(obj);
  return ids;
}

/**
 * Garbage-collects/deletes any IndexedDB assets that are no longer referenced in the graph state.
 */
export async function deleteUnusedAssets(parsedData: any): Promise<number> {
  try {
    const referencedIds = collectReferencedAssetIds(parsedData);
    const allAssets = await db.assets.toArray();
    
    const toDelete: string[] = [];
    const keepThumbnailIds = new Set<string>();
    
    // First pass: map which thumbnails to keep
    for (const asset of allAssets) {
      if (asset.assetId.startsWith("img_") && referencedIds.has(asset.assetId)) {
        if (asset.thumbnailId) {
          keepThumbnailIds.add(asset.thumbnailId);
        }
      }
    }
    
    // Second pass: identify obsolete ones
    for (const asset of allAssets) {
      const isOriginal = asset.assetId.startsWith("img_");
      const isThumbnail = asset.assetId.startsWith("thumb_");
      
      if (isOriginal) {
        if (!referencedIds.has(asset.assetId)) {
          toDelete.push(asset.assetId);
          if (asset.thumbnailId) {
            toDelete.push(asset.thumbnailId);
          }
        }
      } else if (isThumbnail) {
        if (!keepThumbnailIds.has(asset.assetId) && !referencedIds.has(asset.assetId)) {
          toDelete.push(asset.assetId);
        }
      }
    }
    
    if (toDelete.length > 0) {
      await db.assets.bulkDelete(toDelete);
    }
    return toDelete.length;
  } catch (err) {
    console.error("Cleanup of unused assets failed", err);
    return 0;
  }
}
