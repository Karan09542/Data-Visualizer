import * as fabric from 'fabric';
import { CropShape, isShapeCrop, maskCanvasToShape } from '../../../../utils/cropShapes';
import { captureVisibleLayer } from './layerPixels';

/**
 * Cutting a layer's pixels to a shape, undoably.
 *
 * Used to finish a shape crop: the rectangular crop has already run, so the layer's pixels *are*
 * the crop box and the shape simply fills it. Baked into the bitmap rather than kept as a clipPath,
 * so the cut-out exports, selects and takes a sticker border like any other transparent artwork.
 */

interface Snapshot {
  element: CanvasImageSource;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
}

const snapshot = (image: fabric.Image): Snapshot => ({
  element: image.getElement() as CanvasImageSource,
  width: image.width || 0,
  height: image.height || 0,
  cropX: (image as any).cropX || 0,
  cropY: (image as any).cropY || 0
});

const restore = (image: fabric.Image, snap: Snapshot) => {
  // Parent-relative, to match setPositionByOrigin: getCenterPoint() is scene space and would
  // displace a grouped layer by the group's transform.
  const centre = image.getRelativeCenterPoint();
  const sizeChanged = snap.width !== (image.width || 0) || snap.height !== (image.height || 0);

  image.setElement(snap.element as any);
  image.set({ cropX: snap.cropX, cropY: snap.cropY, width: snap.width, height: snap.height } as any);
  if (sizeChanged) image.setPositionByOrigin(centre, 'center', 'center');
  image.setCoords();
  image.dirty = true;
};

/** Returns null for a rectangular crop, which needs no mask at all. */
export const buildShapeMaskCommand = (
  image: fabric.Image,
  shape: CropShape
): { name: string; execute: (c: fabric.Canvas) => void; undo: (c: fabric.Canvas) => void; redo: (c: fabric.Canvas) => void } | null => {
  if (!isShapeCrop(shape)) return null;

  const before = snapshot(image);
  const base = captureVisibleLayer(image);
  if (!base) return null;

  const masked = maskCanvasToShape(base, base.width, base.height, shape);
  if (!masked) return null;

  const after: Snapshot = {
    element: masked,
    width: masked.width,
    height: masked.height,
    // The mask is baked at the crop's own resolution, so the crop offsets have been consumed.
    cropX: 0,
    cropY: 0
  };

  const applyAfter = (canvas: fabric.Canvas) => { restore(image, after); canvas.requestRenderAll(); };
  const applyBefore = (canvas: fabric.Canvas) => { restore(image, before); canvas.requestRenderAll(); };

  return {
    name: 'Shape Crop',
    execute: applyAfter,
    undo: applyBefore,
    redo: applyAfter
  };
};
