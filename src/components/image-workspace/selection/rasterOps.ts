import { SelectionShape, SelectionOperation, Point, BBox, RegionFilter } from './types';
import { traceShape, getShapeBBox, transformShape } from './geometry';

/**
 * Applies a selection to raster pixels.
 *
 * Everything here works on plain canvases, so it is reusable outside this workspace: give it a
 * source image, a shape already mapped into that image's pixel space, and an operation.
 */

export interface RasterTarget {
  /** The pixels to edit. */
  source: CanvasImageSource;
  /** Natural pixel size of `source`. */
  width: number;
  height: number;
}

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const clipTo = (ctx: CanvasRenderingContext2D, shape: SelectionShape) => {
  ctx.beginPath();
  traceShape(ctx, shape);
  // Even-odd, so a path carrying sub-rings cuts holes instead of filling over them. For a single
  // simple ring it is identical to the default non-zero rule, so nothing else changes behaviour.
  ctx.clip('evenodd');
};

/** Draws `image` into `box` honouring the requested fit, used by the replace/mask operation. */
const drawFitted = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  box: BBox,
  fit: 'cover' | 'contain' | 'stretch'
) => {
  const iw = Number((image as any).naturalWidth ?? (image as any).width) || 1;
  const ih = Number((image as any).naturalHeight ?? (image as any).height) || 1;

  if (fit === 'stretch') {
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    return;
  }

  const scale = fit === 'cover'
    ? Math.max(box.width / iw, box.height / ih)
    : Math.min(box.width / iw, box.height / ih);

  const w = iw * scale;
  const h = ih * scale;
  // Centre it in the selection so a cover crop takes from the middle rather than a corner.
  ctx.drawImage(image, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h);
};

/**
 * Canvas 2D accepts the CSS filter grammar, which covers every region filter we expose without
 * hand-rolling pixel loops.
 * `value` is a percentage for the colour filters and a pixel radius for blur.
 */
const cssFilter = (filter: RegionFilter, value: number): string => {
  switch (filter) {
    case 'brightness': return `brightness(${value}%)`;
    case 'contrast': return `contrast(${value}%)`;
    case 'saturate': return `saturate(${value}%)`;
    case 'grayscale': return `grayscale(${Math.max(0, Math.min(100, value))}%)`;
    case 'sepia': return `sepia(${Math.max(0, Math.min(100, value))}%)`;
    case 'invert': return `invert(${Math.max(0, Math.min(100, value))}%)`;
    case 'blur': return `blur(${Math.max(0, value)}px)`;
    default: return 'none';
  }
};

/**
 * Returns a new canvas with the operation applied inside `shape`.
 * `shape` must already be expressed in the target's pixel coordinates.
 */
export const applyOperation = (
  target: RasterTarget,
  shape: SelectionShape,
  op: SelectionOperation
): HTMLCanvasElement => {
  const out = makeCanvas(target.width, target.height);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(target.source, 0, 0, target.width, target.height);

  if (op.type === 'delete') {
    // Punch a hole rather than painting over it, so the result keeps real transparency.
    ctx.save();
    clipTo(ctx, shape);
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.restore();
    return out;
  }

  if (op.type === 'fill') {
    ctx.save();
    clipTo(ctx, shape);
    ctx.fillStyle = op.color;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.restore();
    return out;
  }

  if (op.type === 'filter') {
    // Clear first so the filtered pixels replace rather than composite over the originals. The
    // filter still samples the full source, so a blur blends with neighbours instead of fading
    // to transparency at the selection edge.
    ctx.save();
    clipTo(ctx, shape);
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.filter = cssFilter(op.filter, op.value);
    ctx.drawImage(target.source, 0, 0, target.width, target.height);
    ctx.filter = 'none';
    ctx.restore();
    return out;
  }

  if (op.type === 'composite') {
    // The source is already a full-size render of this image (e.g. the fabric filter stack
    // applied), so it lines up 1:1 and only needs clipping to the region.
    ctx.save();
    clipTo(ctx, shape);
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(op.source, 0, 0, target.width, target.height);
    ctx.restore();
    return out;
  }

  // replace: the selection becomes a window onto another image.
  ctx.save();
  clipTo(ctx, shape);
  const box = getShapeBBox(shape);
  // Clear first so a transparent replacement does not composite over the old pixels.
  ctx.clearRect(0, 0, out.width, out.height);
  drawFitted(ctx, op.image, box, op.fit);
  ctx.restore();
  return out;
};

/**
 * Extracts just the selected pixels, cropped to the shape's bounding box, on transparency.
 * Used for copy and for lifting a region into its own layer.
 */
export const extractSelection = (
  target: RasterTarget,
  shape: SelectionShape
): HTMLCanvasElement | null => {
  const box = getShapeBBox(shape);
  if (box.width < 1 || box.height < 1) return null;

  const out = makeCanvas(box.width, box.height);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Move the shape to the crop's origin so the clip lines up with the cropped output.
  const local = transformShape(shape, (p: Point) => ({ x: p.x - box.x, y: p.y - box.y }));
  ctx.save();
  clipTo(ctx, local);
  ctx.drawImage(target.source, -box.x, -box.y, target.width, target.height);
  ctx.restore();

  return out;
};
