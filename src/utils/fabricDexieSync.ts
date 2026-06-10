import { db, FabricObject, Artboard } from '../lib/db';
import * as fabric from 'fabric';

export const saveToDexie = async (documentId: string, artboards: any[], canvas: fabric.Canvas) => {
  if (!canvas || !documentId) return;

  const fabricObjects = canvas.getObjects().filter(o => o.type !== 'activeSelection');
  
  const toPutArtboards = artboards.map((b, i) => ({
    id: b.id,
    documentId,
    name: b.name,
    width: b.width,
    height: b.height,
    fill: b.backgroundColor,
    order: i,
    data: b
  }));

  const toPutObjects: FabricObject[] = [];

  for (const obj of fabricObjects) {
    if (!obj.id) (obj as any).id = Date.now().toString() + Math.random().toString();
    const objId = obj.id as string;
    
    // Find artboard context
    // If object doesn't have an artboardId, try to assign it based on intersection, or active default
    let assignedArtboardId = (obj as any).artboardId;
    if (!assignedArtboardId && (obj as any).targetArtboard) {
       assignedArtboardId = (obj as any).targetArtboard;
       (obj as any).artboardId = assignedArtboardId;
    }

    if (!assignedArtboardId) {
      // Find intersecting artboard
      let bestBoard = artboards[0];
      for (const b of artboards) {
         if (obj.left! >= b.x && obj.left! <= b.x + b.width && obj.top! >= b.y && obj.top! <= b.y + b.height) {
            bestBoard = b;
            break;
         }
      }
      assignedArtboardId = bestBoard ? bestBoard.id : 'unknown';
      (obj as any).artboardId = assignedArtboardId; 
    }

    const artboard = artboards.find(b => b.id === assignedArtboardId);
    let relativeX = obj.left || 0;
    let relativeY = obj.top || 0;
    if (artboard) {
      relativeX = (obj.left || 0) - artboard.x;
      relativeY = (obj.top || 0) - artboard.y;
    }

    const data = obj.toObject(['id', 'artboardId', 'layerId', 'customFilters', 'name', 'locked', 'selectable', 'evented']);
    
    toPutObjects.push({
      id: objId,
      documentId,
      artboardId: assignedArtboardId,
      layerId: (obj as any).layerId || 'default',
      type: obj.type || 'unknown',
      data: data,
      relativeX,
      relativeY,
      rotation: obj.angle || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
    });
  }

  await db.transaction('rw', db.artboards, db.objects, async () => {
    await db.artboards.where('documentId').equals(documentId).delete();
    await db.objects.where('documentId').equals(documentId).delete();

    if (toPutArtboards.length > 0) {
      await db.artboards.bulkPut(toPutArtboards);
    }
    if (toPutObjects.length > 0) {
      await db.objects.bulkPut(toPutObjects);
    }
  });
};

export const loadFromDexie = async (documentId: string, canvas: fabric.Canvas): Promise<any[]> => {
  if (!canvas || !documentId) return [];

  const artboardRecords = await db.artboards.where('documentId').equals(documentId).sortBy('order');
  const objectRecords = await db.objects.where('documentId').equals(documentId).toArray();

  let loadedArtboards: any[] = [];

  if (artboardRecords.length > 0) {
    loadedArtboards = artboardRecords.map(a => a.data);
  }

  return new Promise((resolve) => {
    if (objectRecords.length === 0) {
      resolve(loadedArtboards);
      return;
    }

    const groupedObjRecords = objectRecords.reduce((acc, curr) => {
      acc[curr.artboardId] = acc[curr.artboardId] || [];
      acc[curr.artboardId].push(curr);
      return acc;
    }, {} as Record<string, FabricObject[]>);

    let itemsProcessed = 0;

    for (const record of objectRecords) {
      const parentBoard = loadedArtboards.find(b => b.id === record.artboardId);
      
      const objData = record.data;
      if (parentBoard) {
        objData.left = parentBoard.x + record.relativeX;
        objData.top = parentBoard.y + record.relativeY;
      }

      fabric.util.enlivenObjects([objData]).then((enlivenedObjects: any[]) => {
        if (enlivenedObjects.length > 0) {
          const enlObj = enlivenedObjects[0];
          enlObj.id = record.id;
          enlObj.artboardId = record.artboardId;
          if (record.data.customFilters) {
            enlObj.customFilters = record.data.customFilters;
            const filtersObj = (fabric as any).Image?.filters || (fabric as any).filters;
            // NOTE: rebuildFabricFilters requires ImageWorkspace.tsx context but we can just let it render later
            // We can do it broadly here if needed
          }
          canvas.add(enlObj);
        }
        itemsProcessed++;
        if (itemsProcessed === objectRecords.length) {
          canvas.requestRenderAll();
          resolve(loadedArtboards);
        }
      }).catch((e: any) => {
        console.error("Failed to enliven object:", record.id, e);
        itemsProcessed++;
        if (itemsProcessed === objectRecords.length) {
          canvas.requestRenderAll();
          resolve(loadedArtboards);
        }
      });
    }
  });
};
