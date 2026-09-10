import { SelectionShape, Point, BBox } from './types';
import { traceShape, getWorldBBox } from './geometry';
import { maskToSelection } from './maskToShape';

/**
 * Adding to and subtracting from a selection.
 *
 * Boolean operations on arbitrary polygons - unions that merge, subtractions that punch holes or
 * split one region into several - need a full polygon-clipping library to do directly. This takes
 * the other route: rasterise what is already selected, composite the new piece into the same mask,
 * and re-trace the result. The tracing half is the pipeline the AI selection already uses, so the
 * hard cases (holes, detached fragments, a stroke that cuts a region in two) come out right for
 * free, and there is one code path rather than one per shape-pair.
 *
 * Everything here is scene-space and framework-free; only a 2D canvas is required.
 */

export type BrushMode = 'add' | 'subtract';

export interface BrushStroke {
  /** Scene-space points along the stroke, in order. */
  points: Point[];
  /** Half the brush width, in scene units. */
  radius: number;
}

/** A piece being combined in: how to paint it, and the scene-space area it covers. */
export interface SelectionAddition {
  paint: (ctx: CanvasRenderingContext2D) => void;
  bounds: BBox;
}

export interface CombineOptions {
  /** Longest side of the working mask. Caps the cost of a stroke over a huge selection. */
  maxWorkSize?: number;
  /** Douglas-Peucker tolerance for the re-traced outline, in working-mask pixels. */
  tolerance?: number;
  /** Chaikin passes applied after simplifying. */
  smooth?: number;
}

const DEFAULTS = {
  maxWorkSize: 1400,
  tolerance: 1,
  smooth: 1
};

/**
 * Brush strokes routinely leave small islands on purpose - dotting two separate areas, or cutting
 * a thin bridge - so the speckle filter that suits an AI matte is far too aggressive here.
 */
const BRUSH_RING_FLOOR = 0.002;
const BRUSH_MAX_RINGS = 64;

const unionBBox = (a: BBox, b: BBox): BBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
};

const padBBox = (box: BBox, pad: number): BBox => ({
  x: box.x - pad,
  y: box.y - pad,
  width: box.width + pad * 2,
  height: box.height + pad * 2
});

/** Scene-space extent of a stroke, including the brush's own width. */
export const strokeBounds = (stroke: BrushStroke): BBox => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return padBBox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, stroke.radius);
};

/** Paints a brush stroke, round-capped so it reads as one continuous swipe. */
export const strokeAddition = (stroke: BrushStroke): SelectionAddition => ({
  bounds: strokeBounds(stroke),
  paint: (ctx) => {
    const { points, radius } = stroke;
    if (!points.length) return;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';

    // A tap has no length to stroke, so it is painted as a single dab instead.
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.lineWidth = radius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
});

/** Paints an already-rendered image over the area it occupies, e.g. a rasterised canvas object. */
export const imageAddition = (image: CanvasImageSource, bounds: BBox): SelectionAddition => ({
  bounds,
  paint: (ctx) => {
    ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
  }
});

/** Paints another selection shape, so two selections can be merged or one cut out of the other. */
export const shapeAddition = (shape: SelectionShape): SelectionAddition => ({
  bounds: getWorldBBox(shape),
  paint: (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    traceShape(ctx, shape);
    ctx.fill('evenodd');
  }
});

/**
 * Combines an addition into the current selection and returns the re-traced result.
 *
 * Returns the selection unchanged when the operation cannot do anything - subtracting with nothing
 * selected - and null when a subtraction removed everything, which the caller should treat as a
 * deselect rather than as a failure.
 */
export const combineSelection = (
  current: SelectionShape | null,
  addition: SelectionAddition,
  mode: BrushMode,
  options: CombineOptions = {}
): SelectionShape | null => {
  const opts = { ...DEFAULTS, ...options };

  if (!addition.bounds.width && !addition.bounds.height) return current;
  // Erasing from nothing is a no-op, not an empty selection.
  if (mode === 'subtract' && !current) return current;

  // Adding needs room for both pieces; subtracting can never grow past what is already selected.
  const area = padBBox(
    current
      ? (mode === 'add' ? unionBBox(getWorldBBox(current), addition.bounds) : getWorldBBox(current))
      : addition.bounds,
    2
  );
  if (area.width <= 0 || area.height <= 0) return current;

  // One scale for both axes, so a stroke stays round rather than being squashed into an ellipse.
  const scale = Math.min(1, opts.maxWorkSize / Math.max(area.width, area.height));
  const width = Math.max(1, Math.round(area.width * scale));
  const height = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return current;

  // Work in scene units from here on; the transform maps them into the working mask.
  ctx.setTransform(width / area.width, 0, 0, height / area.height, 0, 0);
  ctx.translate(-area.x, -area.y);

  if (current) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    traceShape(ctx, current);
    ctx.fill('evenodd');
  }

  // destination-out is what makes subtract a true erase: it removes alpha from what is already
  // there, so a stroke through the middle of a region really does split it in two.
  ctx.globalCompositeOperation = mode === 'add' ? 'source-over' : 'destination-out';
  addition.paint(ctx);
  ctx.globalCompositeOperation = 'source-over';

  const mask = ctx.getImageData(0, 0, width, height);

  return maskToSelection(mask, {
    offset: { x: area.x, y: area.y },
    // The mask was rasterised at `scale`, so undo it to land back in scene units.
    scale: 1 / scale,
    tolerance: opts.tolerance,
    smooth: opts.smooth,
    minRingAreaRatio: BRUSH_RING_FLOOR,
    maxRings: BRUSH_MAX_RINGS,
    maxTraceSize: opts.maxWorkSize
  });
};

/** Convenience wrapper for the common case: one brush swipe. */
export const applyBrushStroke = (
  current: SelectionShape | null,
  stroke: BrushStroke,
  mode: BrushMode,
  options?: CombineOptions
): SelectionShape | null =>
  combineSelection(current, strokeAddition(stroke), mode, options);
