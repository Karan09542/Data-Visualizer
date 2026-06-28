import { getIndexedDbAssets, getBookmarkAssets, GalleryAsset } from '../providers/indexedDbProvider';

export async function discoverAllAssets(): Promise<GalleryAsset[]> {
  try {
    const [idbAssets, bookmarks] = await Promise.all([
      getIndexedDbAssets(),
      getBookmarkAssets(),
    ]);

    // Later we can add workspace nodes provider here
    const all = [...idbAssets, ...bookmarks];
    
    // Sort by most recent
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("Asset discovery failed:", err);
    return [];
  }
}
