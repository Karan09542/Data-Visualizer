import { useCallback } from 'react';
import * as fabric from 'fabric';
import { ClipboardImportResult } from '../clipboard/clipboardImporter';
import { placeImagesSmartly } from '../services/imagePlacement';

export function useImageImport(
  fabricRef: React.MutableRefObject<fabric.Canvas | null>, 
  artboardsRef: React.MutableRefObject<any[]>,
  activeArtboardId: string,
  addObjectsToCanvas: (objects: fabric.Object[]) => void
) {

  const importAssets = useCallback(async (assets: ClipboardImportResult[]) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const artboard = artboardsRef.current.find(a => a.id === activeArtboardId) || artboardsRef.current[0];
    if (!artboard) return;

    // Start position roughly at the center of the viewport, but relative to the artboard
    let startX = artboard.x + 50;
    let startY = artboard.y + 50;

    const vpt = canvas.viewportTransform;
    if (vpt) {
       // Get center of viewport in canvas coordinates
       const center = canvas.getVpCenter();
       // Check if center is within artboard
       if (
          center.x >= artboard.x && 
          center.x <= artboard.x + artboard.width &&
          center.y >= artboard.y &&
          center.y <= artboard.y + artboard.height
       ) {
          startX = center.x - 100;
          startY = center.y - 100;
       }
    }

    const fabricObjects: fabric.Object[] = [];

    for (const asset of assets) {
      if (asset.type === 'svg') {
        try {
          const { objects, options } = await fabric.loadSVGFromURL(asset.url);
          if (objects && objects.length > 0) {
            const svgObj = fabric.util.groupSVGElements(objects, options);
            svgObj.set({
              id: 'svg_' + Date.now() + Math.random().toString(36).substring(2, 9),
              name: asset.name || 'Imported SVG',
              artboardId: activeArtboardId
            } as any);
            fabricObjects.push(svgObj);
          }
        } catch(e) {
          console.error("Failed to load SVG", e);
        }
      } else {
        try {
          const img = await fabric.Image.fromURL(asset.url, { crossOrigin: 'anonymous' });
          if (img) {
            img.set({
              id: 'img_' + Date.now() + Math.random().toString(36).substring(2, 9),
              name: asset.name || 'Imported Image',
              artboardId: activeArtboardId
            } as any);
            fabricObjects.push(img);
          }
        } catch(e) {
          console.error("Failed to load image", e);
        }
      }
    }

    if (fabricObjects.length > 0) {
      placeImagesSmartly(canvas, fabricObjects, startX, startY, artboard);
      addObjectsToCanvas(fabricObjects);
    }
  }, [fabricRef, artboardsRef, activeArtboardId, addObjectsToCanvas]);

  return { importAssets };
}
