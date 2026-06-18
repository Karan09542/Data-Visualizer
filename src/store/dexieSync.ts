import { db } from '../lib/db';
import { useStore } from './useStore';
import { cleanupOrphanedSearchData } from '../lib/cleanup';

let isInitializing = true;

export const initDexieSync = async () => {
  try {
    // Run cleanup for search node orphaned data
    cleanupOrphanedSearchData().catch(e => console.error(e));

    const allPositions = await db.nodePositions.toArray();
    const overrides: Record<string, {x: number, y: number} | null> = {};
    for (const pos of allPositions) {
      if (typeof pos.x === 'number' && typeof pos.y === 'number') {
        overrides[pos.id] = { x: pos.x, y: pos.y };
      }
    }
    if (Object.keys(overrides).length > 0) {
      useStore.getState().setMultipleDragOverrides(overrides);
    }
  } catch (err) {
    console.error("Failed to load node positions from dexie", err);
  } finally {
    isInitializing = false;
  }
};

let saveTimeout: any;

export const persistPositionsToDexie = () => {
  if (isInitializing) return;
  
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const current = useStore.getState().dragOverrides;
      const toPut = [];
      
      for (const [id, pos] of Object.entries(current)) {
        if (pos) {
          toPut.push({ id, x: pos.x, y: pos.y });
        }
      }
      
      await db.transaction('rw', db.nodePositions, async () => {
        if (Object.keys(current).length === 0) {
           await db.nodePositions.clear();
        } else {
           if (toPut.length > 0) await db.nodePositions.bulkPut(toPut);
        }
      });
    } catch (e) {
      console.error(e);
    }
  }, 500);
};

export const clearPositionsInDexie = async () => {
    try {
      await db.nodePositions.clear();
    } catch(e) {}
};
