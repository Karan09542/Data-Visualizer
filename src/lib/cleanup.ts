import { db } from './db';
import get from 'lodash.get';

export async function cleanupOrphanedSearchData() {
  try {
    // 1. Gather all active storageKeys
    const activeStorageKeys = new Set<string>();
    
    const docs = await db.documents.toArray();
    
    // We also need to check the current code in localStorage/sessionStorage if any, 
    // or just rely on the stored documents if that's the primary way state is persisted.
    // The main store persists 'code' to localStorage occasionally or its localstate.
    const activeLocalCode = localStorage.getItem('json_visual_engine_code');
    if (activeLocalCode) {
      extractStorageKeysFromCode(activeLocalCode, activeStorageKeys);
    }

    // Checks the actual Zustand store persisted code in localStorage
    try {
      const persistedSettings = localStorage.getItem('json-graph-viewer-settings');
      if (persistedSettings) {
        const parsed = JSON.parse(persistedSettings);
        if (parsed?.state?.code) {
          extractStorageKeysFromCode(parsed.state.code, activeStorageKeys);
        }
      }
    } catch (err) {
      console.error('Error extracting key from json-graph-viewer-settings', err);
    }

    // Checks the dynamic/in-memory Zustand store code as well
    try {
      const { useStore } = await import('../store/useStore');
      const inMemoryCode = useStore.getState().code;
      if (inMemoryCode) {
        extractStorageKeysFromCode(inMemoryCode, activeStorageKeys);
      }
    } catch (err) {
      console.error('Error getting dynamic useStore code during cleanup', err);
    }
    
    for (const doc of docs) {
      if (doc.code) {
        extractStorageKeysFromCode(doc.code, activeStorageKeys);
      }
    }

    // 2. Scan tables to find orphaned keys
    const histories = await db.nodeSearchHistory.toArray();
    const bookmarks = await db.nodeSearchBookmarks.toArray();
    const settings = await db.nodeSearchSettings.toArray();
    
    const knownKeys = new Set([
      ...histories.map(h => h.storageKey),
      ...bookmarks.map(b => b.storageKey),
      ...settings.map(s => s.storageKey)
    ].filter(Boolean));
    
    // 3. Find and delete orphaned keys
    // Safe-guard: If we found absolute zero active storage keys but we have known keys,
    // we should be double careful. Maybe the store has not hydrated or loaded at all.
    // We avoid wiping everything in that scenario.
    if (activeStorageKeys.size === 0 && knownKeys.size > 0) {
      console.warn('[Garbage Collection] Found 0 active storage keys but have saved items. Skipping cleanup to prevent data loss.');
      return;
    }
    
    const orphanedKeys = Array.from(knownKeys).filter(k => !activeStorageKeys.has(k) && k !== undefined);
    
    if (orphanedKeys.length > 0) {
      console.log(`[Garbage Collection] Cleaning up orphaned Search Node data for keys:`, orphanedKeys);
      
      await db.transaction('rw', db.nodeSearchHistory, db.nodeSearchBookmarks, db.nodeSearchSettings, async () => {
        // Find ids to delete
        const historyIds = histories.filter(h => orphanedKeys.includes(h.storageKey)).map(h => h.id!).filter(Boolean);
        const bookmarkIds = bookmarks.filter(b => orphanedKeys.includes(b.storageKey)).map(b => b.id!).filter(Boolean);
        
        if (historyIds.length > 0) await db.nodeSearchHistory.bulkDelete(historyIds);
        if (bookmarkIds.length > 0) await db.nodeSearchBookmarks.bulkDelete(bookmarkIds);
        await db.nodeSearchSettings.bulkDelete(orphanedKeys);
      });
    }
  } catch(err) {
    console.error('[Garbage Collection] Failed to run search data cleanup', err);
  }
}

// Recursively find {"storageKey": "..."} in a JSON string payload efficiently
function extractStorageKeysFromCode(codeStr: string, activeKeysSet: Set<string>) {
  try {
    const parsed = JSON.parse(codeStr);
    traverseForStorageKey(parsed, activeKeysSet);
  } catch(e) {
    // If parsing fails, try regex match as fallback since it's just keys
    const matches = codeStr.match(/"storageKey"\s*:\s*"([^"]+)"/g);
    if (matches) {
       matches.forEach(m => {
          const key = m.split(/:/)[1].replace(/"/g, '').trim();
          if (key) activeKeysSet.add(key);
       });
    }
  }
}

function traverseForStorageKey(obj: any, set: Set<string>) {
  if (typeof obj !== 'object' || obj === null) return;
  
  if (obj.storageKey && typeof obj.storageKey === 'string') {
    set.add(obj.storageKey);
  }
  
  for (const key of Object.keys(obj)) {
    traverseForStorageKey(obj[key], set);
  }
}
