import { db, FabricObject, Artboard } from '../lib/db';
import * as fabric from 'fabric';
import { resolveAssetUrl } from './assetManager';

export const saveToDexie = async (documentId: string, artboards: any[], canvas: fabric.Canvas) => {
  if (!canvas || !documentId) return;

  // Gather all objects, including those inside an active selection
  const rawObjects = canvas.getObjects();
  const fabricObjects: any[] = [];
  
  rawObjects.forEach(obj => {
    if (obj.type === 'activeSelection') {
      const activeSelItems = (obj as any).getObjects();
      activeSelItems.forEach((innerObj: any) => {
          // Temporarily attach canvas to compute absolute transformations
          const origCanvas = innerObj.canvas;
          innerObj.canvas = canvas;
          const matrix = innerObj.calcTransformMatrix();
          const options = fabric.util.qrDecompose(matrix);
          const center = new fabric.Point(options.translateX, options.translateY);
          const absolutePos = innerObj.translateToOriginPoint(center, innerObj.originX, innerObj.originY);
          
          fabricObjects.push({
             ...innerObj,
             left: absolutePos.x,
             top: absolutePos.y,
             scaleX: options.scaleX,
             scaleY: options.scaleY,
             angle: options.angle,
             toObject: (props: string[]) => {
                 const objData = innerObj.toObject(props);
                 // Override with absolute coords
                 objData.left = absolutePos.x;
                 objData.top = absolutePos.y;
                 objData.scaleX = options.scaleX;
                 objData.scaleY = options.scaleY;
                 objData.angle = options.angle;
                 return objData;
             }
          });
          innerObj.canvas = origCanvas;
      });
    } else {
      fabricObjects.push(obj);
    }
  });
  
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

  let orderIdx = 0;
  for (const obj of fabricObjects) {
    if (!(obj as any).id) (obj as any).id = Date.now().toString() + Math.random().toString();
    const objId = (obj as any).id as string;
    
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

    const data = obj.toObject([
      'id', 
      'artboardId', 
      'layerId', 
      'assetId',
      'customFilters', 
      'name', 
      'customName', 
      'locked', 
      'selectable', 
      'evented', 
      'isFrameGroup', 
      'frameType',
      'isCollageBlock',
      'cornerRoundingPercent',
      'useIndividualCorners',
      'cornerTopLeftPercent',
      'cornerTopRightPercent',
      'cornerBottomLeftPercent',
      'cornerBottomRightPercent',
      'strokeLineJoin',
      'strokeLineCap'
    ]);
    
    toPutObjects.push({
      id: objId,
      documentId,
      artboardId: assignedArtboardId,
      layerId: (obj as any).layerId || 'default',
      type: obj.type || 'unknown',
      order: orderIdx++,
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
  // Sort primarily by order to preserve z-index layer positioning
  objectRecords.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let loadedArtboards: any[] = [];

  if (artboardRecords.length > 0) {
    loadedArtboards = artboardRecords.map(a => a.data);
  }

  return new Promise((resolve) => {
    if (objectRecords.length === 0) {
      resolve(loadedArtboards);
      return;
    }

    const orderedData = objectRecords.map((record) => {
      const parentBoard = loadedArtboards.find(b => b.id === record.artboardId);
      const objData = record.data;
      if (parentBoard) {
        objData.left = parentBoard.x + record.relativeX;
        objData.top = parentBoard.y + record.relativeY;
      }
      return objData;
    });

    // Pre-resolve asset URLs for objects that have an assetId (e.g. pasted/imported images)
    // We must do this sequentially before passing to fabric.util.enlivenObjects
    Promise.all(orderedData.map(async (objData) => {
      if (objData.assetId) {
         try {
            const url = await resolveAssetUrl(objData.assetId);
            if (url) {
               objData.src = url;
            }
         } catch(e) {
            console.error("Failed to resolve asset URL for", objData.assetId, e);
         }
      }
      return objData;
    })).then((resolvedData) => {
      fabric.util.enlivenObjects(resolvedData).then((enlivenedObjects: any[]) => {
        if (enlivenedObjects && enlivenedObjects.length > 0) {
        enlivenedObjects.forEach((enlObj, index) => {
          if (!enlObj) return;
          const record = objectRecords[index];
          enlObj.id = record.id;
          enlObj.artboardId = record.artboardId;
          
          // Force selectability based on lock state to recover from mid-pan refreshes
          enlObj.selectable = !record.data.locked;
          enlObj.evented = !record.data.locked;
          
          if (record.data.customName) enlObj.customName = record.data.customName;
          if (record.data.layerId) enlObj.layerId = record.data.layerId;
          if (record.data.assetId) enlObj.assetId = record.data.assetId;
          if (record.data.isFrameGroup) enlObj.set('isFrameGroup', record.data.isFrameGroup);
          if (record.data.frameType) enlObj.set('frameType', record.data.frameType);
          
          if (record.data.isCollageBlock) {
             enlObj.isCollageBlock = true;
             (enlObj as any).isCollageBlock = true;
          }
          if (record.data.cornerRoundingPercent !== undefined) {
             (enlObj as any).cornerRoundingPercent = record.data.cornerRoundingPercent;
          }
          if (record.data.useIndividualCorners !== undefined) {
             (enlObj as any).useIndividualCorners = record.data.useIndividualCorners;
          }
          if (record.data.cornerTopLeftPercent !== undefined) {
             (enlObj as any).cornerTopLeftPercent = record.data.cornerTopLeftPercent;
          }
          if (record.data.cornerTopRightPercent !== undefined) {
             (enlObj as any).cornerTopRightPercent = record.data.cornerTopRightPercent;
          }
          if (record.data.cornerBottomLeftPercent !== undefined) {
             (enlObj as any).cornerBottomLeftPercent = record.data.cornerBottomLeftPercent;
          }
          if (record.data.cornerBottomRightPercent !== undefined) {
             (enlObj as any).cornerBottomRightPercent = record.data.cornerBottomRightPercent;
          }
          
          if (record.data.customFilters) {
            enlObj.customFilters = record.data.customFilters;
          }
          canvas.add(enlObj);
        });
      }
      canvas.requestRenderAll();
      resolve(loadedArtboards);
    }).catch((e: any) => {
      console.error("Failed to enliven objects:", e);
      canvas.requestRenderAll();
      resolve(loadedArtboards);
    });
    });
  });
};
