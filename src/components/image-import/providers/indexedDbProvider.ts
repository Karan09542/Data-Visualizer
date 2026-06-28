import { db } from '../../../lib/db';

export interface GalleryAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  source: string;
  createdAt: number;
}

export async function getIndexedDbAssets(): Promise<GalleryAsset[]> {
  const assets: GalleryAsset[] = [];
  
  try {
    const dbAssets = await db.assets.toArray();
    
    // First pass: collect thumbnails
    const thumbnailsMap = new Map<string, Blob>();
    for (const a of dbAssets) {
      if (a.assetId.startsWith('thumb_')) {
        let blob: Blob;
        if (a.data instanceof Blob) {
          blob = a.data;
        } else {
          blob = new Blob([a.data], { type: a.mimeType });
        }
        thumbnailsMap.set(a.assetId, blob);
      }
    }
    
    for (const a of dbAssets) {
      // Ignore standalone thumbnail records to prevent duplicates
      if (a.mimeType.startsWith('image/') && !a.assetId.startsWith('thumb_')) {
        let blob: Blob;
        if (a.data instanceof Blob) {
          blob = a.data;
        } else {
          blob = new Blob([a.data], { type: a.mimeType });
        }
        
        let thumbnailUrl: string | undefined;
        if (a.thumbnailId && thumbnailsMap.has(a.thumbnailId)) {
          thumbnailUrl = URL.createObjectURL(thumbnailsMap.get(a.thumbnailId)!);
        }
        
        assets.push({
          id: a.assetId,
          url: URL.createObjectURL(blob),
          thumbnailUrl: thumbnailUrl,
          filename: a.filename || 'Unnamed Asset',
          mimeType: a.mimeType,
          size: a.size,
          width: a.width,
          height: a.height,
          source: 'IndexedDB',
          createdAt: a.createdAt,
        });
      }
    }
  } catch (err) {
    console.error("Failed to load IndexedDB assets", err);
  }

  return assets;
}

export async function getBookmarkAssets(): Promise<GalleryAsset[]> {
  const assets: GalleryAsset[] = [];
  
  try {
    const bookmarks = await db.nodeSearchImageBookmarks.toArray();
    
    for (const b of bookmarks) {
      assets.push({
        id: `bookmark_${b.id}`,
        url: b.imageUrl,
        thumbnailUrl: b.thumbnail,
        filename: b.title || 'Search Bookmark',
        mimeType: 'image/*',
        source: 'Search Bookmarks',
        createdAt: b.timestamp,
      });
    }
  } catch (err) {
    console.error("Failed to load Search Bookmark assets", err);
  }

  return assets;
}
