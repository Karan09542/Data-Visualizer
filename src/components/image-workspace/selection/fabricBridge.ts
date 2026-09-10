import * as fabric from 'fabric';
import { SelectionShape, SelectionOperation, Point } from './types';
import { transformShape } from './geometry';
import { applyOperation, extractSelection, RasterTarget } from './rasterOps';

/**
 * The only file in the selection module that knows about fabric. Everything else works on plain
 * shapes and canvases, so swapping the renderer means replacing this file alone.
 */

/**
 * Maps a shape from scene coordinates into the target object's own pixel space.
 *
 * A selection is drawn against the canvas, but the pixels being edited live inside the image at
 * its natural resolution, under whatever scale and rotation the object carries. Inverting the
 * object's transform handles all of that; the half-size offset converts fabric's centre-relative
 * local space into top-left pixel coordinates.
 */
export const sceneShapeToImagePixels = (
  shape: SelectionShape,
  target: fabric.Object
): SelectionShape => {
  const matrix = target.calcTransformMatrix();
  const inverted = fabric.util.invertTransform(matrix);
  const halfW = (target.width || 0) / 2;
  const halfH = (target.height || 0) / 2;

  return transformShape(shape, (p: Point) => {
    const local = fabric.util.transformPoint(new fabric.Point(p.x, p.y), inverted);
    return { x: local.x + halfW, y: local.y + halfH };
  });
};

/**
 * The inverse of `sceneShapeToImagePixels`: takes a shape expressed in the image's own pixel grid
 * and puts it back on the canvas. An AI mask is produced in pixel space, so this is what places
 * the resulting selection over the artwork, correct through the object's scale and rotation.
 */
export const imagePixelsToSceneShape = (
  shape: SelectionShape,
  target: fabric.Object
): SelectionShape => {
  const matrix = target.calcTransformMatrix();
  const halfW = (target.width || 0) / 2;
  const halfH = (target.height || 0) / 2;

  return transformShape(shape, (p: Point) => {
    const scene = fabric.util.transformPoint(
      new fabric.Point(p.x - halfW, p.y - halfH),
      matrix
    );
    return { x: scene.x, y: scene.y };
  });
};

/**
 * Reads an image object's pixels for a model to segment, optionally just a crop of them.
 *
 * Cropping is what turns whole-image saliency into a per-object tool: narrowing the frame to one
 * object is what makes the model pick that object rather than whichever is most prominent overall.
 * `offset` is the crop's origin, so the mask it produces can be placed back correctly.
 */
export const readImagePixels = (
  image: fabric.Image,
  region?: { x: number; y: number; width: number; height: number } | null
): { pixels: ImageData; offset: Point } | null => {
  const element = image.getElement?.() as CanvasImageSource | undefined;
  if (!element) return null;

  const fullW = image.width || Number((element as any).naturalWidth) || 0;
  const fullH = image.height || Number((element as any).naturalHeight) || 0;
  if (!fullW || !fullH) return null;

  // Clamp the crop to the image, so a box dragged past the edge still yields valid pixels.
  const x = region ? Math.max(0, Math.min(fullW - 1, Math.floor(region.x))) : 0;
  const y = region ? Math.max(0, Math.min(fullH - 1, Math.floor(region.y))) : 0;
  const width = region ? Math.max(1, Math.min(fullW - x, Math.round(region.width))) : fullW;
  const height = region ? Math.max(1, Math.min(fullH - y, Math.round(region.height))) : fullH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Source rect, not a scaled draw: on a cropped fabric image the element is larger than
  // width/height, and cropX/cropY are where the object's own pixel space begins inside it.
  const cropX = (image as any).cropX || 0;
  const cropY = (image as any).cropY || 0;
  ctx.drawImage(element, cropX + x, cropY + y, width, height, 0, 0, width, height);

  return { pixels: ctx.getImageData(0, 0, width, height), offset: { x, y } };
};

/**
 * Renders any canvas object into its own bitmap, in scene coordinates.
 *
 * This is what lets a shape drawn with the paint brush - or any other object - become a selection:
 * whatever the object paints is the mask, so a brush stroke, a polygon and a piece of text all
 * convert through the same path with no per-type handling.
 */
export const rasterizeObject = (
  obj: fabric.Object,
  maxSize = 1400
): { canvas: HTMLCanvasElement; bounds: { x: number; y: number; width: number; height: number } } | null => {
  const rect = obj.getBoundingRect();
  if (!rect.width || !rect.height) return null;

  const scale = Math.min(1, maxSize / Math.max(rect.width, rect.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // The object renders through its own transform matrix, which is in scene space, so shifting the
  // origin to the bounding rect is all that is needed to bring it into view.
  ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
  ctx.translate(-rect.left, -rect.top);
  obj.render(ctx);

  return { canvas, bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } };
};

const getRasterTarget = (image: fabric.Image): RasterTarget | null => {
  const element = image.getElement?.() as CanvasImageSource | undefined;
  if (!element) return null;
  // Fabric's width/height are the element's natural size unless the image was cropped, which is
  // exactly the pixel grid the shape was just mapped into.
  const width = image.width || Number((element as any).naturalWidth) || 0;
  const height = image.height || Number((element as any).naturalHeight) || 0;
  if (!width || !height) return null;
  return { source: element, width, height };
};

/** Runs an operation against a fabric image, returning the edited pixels as a data URL. */
export const applyOperationToImage = (
  image: fabric.Image,
  sceneShape: SelectionShape,
  op: SelectionOperation
): string | null => {
  const target = getRasterTarget(image);
  if (!target) return null;
  const localShape = sceneShapeToImagePixels(sceneShape, image);
  const result = applyOperation(target, localShape, op);
  return result.toDataURL();
};

/** Lifts the selected region out of a fabric image as a standalone data URL. */
export const extractFromImage = (
  image: fabric.Image,
  sceneShape: SelectionShape
): { dataUrl: string; width: number; height: number } | null => {
  const target = getRasterTarget(image);
  if (!target) return null;
  const localShape = sceneShapeToImagePixels(sceneShape, image);
  const cropped = extractSelection(target, localShape);
  if (!cropped) return null;
  return { dataUrl: cropped.toDataURL(), width: cropped.width, height: cropped.height };
};

/**
 * Replaces an image object's pixels in place, keeping its position, scale and rotation.
 * Returns the previous source so the caller can build an undo entry.
 */
export const swapImageSource = async (
  image: fabric.Image,
  dataUrl: string
): Promise<string | null> => {
  const previous = image.getSrc?.() || null;
  const el = await new Promise<HTMLImageElement | null>((resolve) => {
    const next = new Image();
    next.crossOrigin = 'anonymous';
    next.onload = () => resolve(next);
    next.onerror = () => resolve(null);
    next.src = dataUrl;
  });
  if (!el) return null;

  image.setElement(el);
  image.set({ dirty: true });
  image.setCoords();
  return previous;
};

const MASK_STATE = '__regionFilterMask';

interface MaskState {
  base: () => void;
  getShape: () => SelectionShape | null;
  /** How the layer looked when the selection was made; everything outside the region keeps this. */
  baseline: HTMLCanvasElement | null;
}

/** Freezes a source into its own canvas, since fabric overwrites `_element` on every filter pass. */
const snapshot = (source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null => {
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const elementSize = (image: fabric.Image): { width: number; height: number } => {
  const img = image as any;
  const pristine = img._originalElement;
  const width = image.width || Number(pristine?.naturalWidth) || Number(pristine?.width) || 0;
  const height = image.height || Number(pristine?.naturalHeight) || Number(pristine?.height) || 0;
  return { width, height };
};

/**
 * Confines an image's fabric filter stack to a region, live and non-destructively.
 *
 * fabric filters are object-wide: applyFilters() rebuilds `_element` from the pristine
 * `_originalElement` every time, so a filter always covered the whole layer. Wrapping applyFilters
 * lets the normal pipeline run untouched and then composites its result back through the selection.
 * Because each pass still starts from `_originalElement`, sliders stay adjustable and nothing
 * compounds.
 *
 * The baseline snapshot is what keeps this honest. Compositing against the pristine pixels would
 * strip any filter the layer already had and re-apply it inside the region only - so a whole-image
 * filter appeared to jump into the selection the moment one was drawn. Freezing the layer's current
 * appearance at attach time means existing filters stay across the whole image, and only changes
 * made while the selection is live are confined to it.
 */
export const attachRegionFilterMask = (
  image: fabric.Image,
  getShape: () => SelectionShape | null
): void => {
  const img = image as any;

  if (img[MASK_STATE]) {
    // Already wrapped; just point it at the current shape.
    (img[MASK_STATE] as MaskState).getShape = getShape;
    image.applyFilters();
    return;
  }

  const { width, height } = elementSize(image);
  const current = (img._element || img._originalElement) as CanvasImageSource | undefined;

  const state: MaskState = {
    base: image.applyFilters.bind(image),
    getShape,
    baseline: current ? snapshot(current, width, height) : null
  };
  img[MASK_STATE] = state;

  // Own property shadowing the prototype method, so detaching is a plain delete.
  img.applyFilters = function (...args: any[]) {
    state.base.apply(image, args as []);

    const shape = state.getShape();
    const baseline = state.baseline;
    if (!shape || !baseline) return;

    const filtered = img._element as CanvasImageSource | undefined;
    if (!filtered) return;

    const size = elementSize(image);
    if (!size.width || !size.height) return;

    const local = sceneShapeToImagePixels(shape, image);
    img._element = applyOperation(
      { source: baseline, width: size.width, height: size.height },
      local,
      { type: 'composite', source: filtered }
    );
  };

  image.applyFilters();
};

/** Restores whole-object filtering and re-renders without the mask. */
export const detachRegionFilterMask = (image: fabric.Image): void => {
  const img = image as any;
  if (!img[MASK_STATE]) return;
  delete img[MASK_STATE];
  delete img.applyFilters;
  image.applyFilters();
};

/** True while the image is rendering its filters through a region mask. */
export const hasRegionFilterMask = (image: fabric.Image): boolean =>
  !!(image as any)[MASK_STATE];
