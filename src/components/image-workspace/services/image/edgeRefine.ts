import * as fabric from 'fabric';
import { refineEdges, EdgeRefineOptions, isEdgeRefineNoOp } from '../../../../utils/edgeRefine';
import { captureVisibleLayer } from './layerPixels';
import { hasImageBorder } from './imageBorder';

/**
 * Applying edge refinement to an image layer, undoably.
 *
 * Like the border, the result is baked into the layer's pixels and the layer keeps a pristine copy
 * so every change re-renders from the original. Without that, nudging Feather five times would
 * feather the already-feathered result five times over and the edge would dissolve.
 */

const EDGE_STATE = '__edgeRefine';

interface EdgeState {
  /** The layer's pixels before any refinement. */
  base: HTMLCanvasElement;
  options: EdgeRefineOptions;
}

export const getEdgeRefine = (image: fabric.Image): EdgeRefineOptions | null =>
  ((image as any)[EDGE_STATE] as EdgeState | undefined)?.options ?? null;

/**
 * Refinement reshapes the artwork's own edge, so it has to happen before a border is drawn around
 * that edge. Running it afterwards would feather the border instead of the picture.
 */
export const edgeRefineBlockedByBorder = (image: fabric.Image): boolean => hasImageBorder(image);

interface Snapshot {
  element: CanvasImageSource;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  state: EdgeState | undefined;
}

const snapshot = (image: fabric.Image): Snapshot => ({
  element: image.getElement() as CanvasImageSource,
  width: image.width || 0,
  height: image.height || 0,
  cropX: (image as any).cropX || 0,
  cropY: (image as any).cropY || 0,
  state: (image as any)[EDGE_STATE]
});

const restore = (image: fabric.Image, snap: Snapshot) => {
  // Parent-relative, to match setPositionByOrigin. getCenterPoint() reports scene coordinates, so
  // feeding it back to a parent-space setter displaces anything inside a group by the group's own
  // transform - which is why refining an image in a group threw it across the canvas.
  const centre = image.getRelativeCenterPoint();
  const sizeChanged = snap.width !== (image.width || 0) || snap.height !== (image.height || 0);

  image.setElement(snap.element as any);
  image.set({ cropX: snap.cropX, cropY: snap.cropY, width: snap.width, height: snap.height } as any);
  if (snap.state) (image as any)[EDGE_STATE] = snap.state;
  else delete (image as any)[EDGE_STATE];

  // Refinement keeps the pixel dimensions, so there is nothing to re-centre; touching the position
  // at all could only introduce error.
  if (sizeChanged) image.setPositionByOrigin(centre, 'center', 'center');
  image.setCoords();
  image.dirty = true;
};

/** Runs the refinement into a new canvas of the same size. */
const render = (base: HTMLCanvasElement, options: EdgeRefineOptions): HTMLCanvasElement | null => {
  const source = base.getContext('2d', { willReadFrequently: true });
  if (!source) return null;
  const pixels = source.getImageData(0, 0, base.width, base.height);
  const refined = refineEdges(pixels, options);

  const out = document.createElement('canvas');
  out.width = base.width;
  out.height = base.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(refined, 0, 0);
  return out;
};

/**
 * Builds the undoable change. Pass null, or all-zero options, to restore the original edge.
 * Returns null when there is nothing to do.
 */
export const buildEdgeRefineCommand = (
  image: fabric.Image,
  options: EdgeRefineOptions | null
): { name: string; execute: (c: fabric.Canvas) => void; undo: (c: fabric.Canvas) => void; redo: (c: fabric.Canvas) => void } | null => {
  const before = snapshot(image);
  const existing = (image as any)[EDGE_STATE] as EdgeState | undefined;
  const base = existing?.base ?? captureVisibleLayer(image);
  if (!base) return null;

  let after: Snapshot;

  if (!options || isEdgeRefineNoOp(options)) {
    if (!existing) return null;
    after = { element: base, width: base.width, height: base.height, cropX: 0, cropY: 0, state: undefined };
  } else {
    const rendered = render(base, options);
    if (!rendered) return null;
    after = {
      element: rendered,
      width: rendered.width,
      height: rendered.height,
      cropX: 0,
      cropY: 0,
      state: { base, options }
    };
  }

  const applyAfter = (canvas: fabric.Canvas) => { restore(image, after); canvas.requestRenderAll(); };
  const applyBefore = (canvas: fabric.Canvas) => { restore(image, before); canvas.requestRenderAll(); };

  return {
    name: options && !isEdgeRefineNoOp(options) ? 'Refine Edges' : 'Reset Edges',
    execute: applyAfter,
    undo: applyBefore,
    redo: applyAfter
  };
};
