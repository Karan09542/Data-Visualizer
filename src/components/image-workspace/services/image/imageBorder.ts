import * as fabric from 'fabric';
import { renderBorderedImage, BorderMode } from '../../../../utils/imageBorder';
import { captureVisibleLayer } from './layerPixels';

/**
 * Applying and removing an image border, undoably.
 *
 * The border is baked into the layer's bitmap rather than drawn as a separate object. That keeps it
 * part of the picture everywhere it matters - export, crop, the selection tools, saving - instead of
 * a companion object that has to be dragged, grouped and z-ordered in step with it.
 *
 * Baking would normally be a one-way door, so the layer keeps the pixels it had before its first
 * border in `BORDER_STATE`. Every later change re-renders from that pristine copy, which is what
 * stops widths compounding when the slider is dragged and lets the border be removed outright.
 */

const BORDER_STATE = '__imageBorder';

export interface ImageBorderOptions {
  mode: BorderMode;
  color: string;
  /** In scene pixels, so the border looks the width the user asked for at the layer's scale. */
  width: number;
  radius?: number;
}

interface BorderState {
  /** The layer's visible pixels before any border was applied. */
  base: HTMLCanvasElement;
  options: ImageBorderOptions;
}

export const getImageBorder = (image: fabric.Image): ImageBorderOptions | null =>
  ((image as any)[BORDER_STATE] as BorderState | undefined)?.options ?? null;

export const hasImageBorder = (image: fabric.Image): boolean => !!(image as any)[BORDER_STATE];

/** The pristine pixels, for asking whether the artwork has an alpha edge worth tracing. */
export const getBorderBase = (image: fabric.Image): HTMLCanvasElement | null => {
  const state = (image as any)[BORDER_STATE] as BorderState | undefined;
  return state ? state.base : captureVisibleLayer(image);
};

interface Snapshot {
  element: CanvasImageSource;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  state: BorderState | undefined;
  centre: fabric.Point;
}

const snapshot = (image: fabric.Image): Snapshot => ({
  element: image.getElement() as CanvasImageSource,
  width: image.width || 0,
  height: image.height || 0,
  cropX: (image as any).cropX || 0,
  cropY: (image as any).cropY || 0,
  state: (image as any)[BORDER_STATE],
  // Parent-relative, to match setPositionByOrigin below. getCenterPoint() is scene space, and
  // handing that to a parent-space setter displaces a grouped layer by the group's transform.
  centre: image.getRelativeCenterPoint()
});

const restore = (image: fabric.Image, snap: Snapshot) => {
  image.setElement(snap.element as any);
  image.set({ cropX: snap.cropX, cropY: snap.cropY, width: snap.width, height: snap.height } as any);
  if (snap.state) (image as any)[BORDER_STATE] = snap.state;
  else delete (image as any)[BORDER_STATE];
  // The layer changes size, so pin the centre rather than the corner - otherwise adding a border
  // shunts the picture down and to the right by the border width.
  image.setPositionByOrigin(snap.centre, 'center', 'center');
  image.setCoords();
  image.dirty = true;
};

/**
 * Builds the undoable change. Pass null for `options` to strip the border.
 * Returns null when there is nothing to do.
 */
export const buildImageBorderCommand = (
  image: fabric.Image,
  options: ImageBorderOptions | null
): { name: string; execute: (c: fabric.Canvas) => void; undo: (c: fabric.Canvas) => void; redo: (c: fabric.Canvas) => void } | null => {
  const before = snapshot(image);

  const existing = (image as any)[BORDER_STATE] as BorderState | undefined;
  const base = existing?.base ?? captureVisibleLayer(image);
  if (!base) return null;

  let after: Snapshot;

  if (!options || options.width <= 0) {
    if (!existing) return null;
    after = {
      element: base,
      width: base.width,
      height: base.height,
      cropX: 0,
      cropY: 0,
      state: undefined,
      centre: before.centre
    };
  } else {
    // The layer's own scale decides how many source pixels a scene-pixel border is worth, so the
    // result looks the requested thickness on canvas whatever the layer has been scaled to.
    const scale = (Math.abs(image.scaleX || 1) + Math.abs(image.scaleY || 1)) / 2 || 1;
    const sourceWidth = Math.max(1, Math.round(options.width / scale));
    const sourceRadius = options.radius ? Math.max(0, Math.round(options.radius / scale)) : 0;

    const rendered = renderBorderedImage(base, base.width, base.height, {
      mode: options.mode,
      color: options.color,
      width: sourceWidth,
      radius: sourceRadius
    });
    if (!rendered) return null;

    after = {
      element: rendered,
      width: rendered.width,
      height: rendered.height,
      cropX: 0,
      cropY: 0,
      state: { base, options },
      centre: before.centre
    };
  }

  const applyAfter = (canvas: fabric.Canvas) => { restore(image, after); canvas.requestRenderAll(); };
  const applyBefore = (canvas: fabric.Canvas) => { restore(image, before); canvas.requestRenderAll(); };

  return {
    name: options ? `${options.mode === 'contour' ? 'Sticker' : 'Frame'} Border` : 'Remove Border',
    execute: applyAfter,
    undo: applyBefore,
    redo: applyAfter
  };
};
