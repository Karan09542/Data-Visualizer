import { SelectionShape, Point, BBox, PathSelection, pathRings } from './types';

/**
 * Pure geometry for selection shapes. No canvas, no fabric, no React - every function here takes
 * plain data and returns plain data, which is what makes the module testable outside a browser.
 */

export const getShapeBBox = (shape: SelectionShape): BBox => {
  if (shape.kind === 'rect' || shape.kind === 'ellipse') {
    // Normalise so a rectangle dragged up/left still reports a positive width and height.
    return {
      x: Math.min(shape.x, shape.x + shape.width),
      y: Math.min(shape.y, shape.y + shape.height),
      width: Math.abs(shape.width),
      height: Math.abs(shape.height)
    };
  }

  if (shape.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of pathRings(shape)) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * Rewrites every ring of a path with `fn`. Centralised because a shape can now carry holes and
 * detached pieces: any transform that touched `points` alone would tear them apart.
 */
export const mapPathPoints = (shape: PathSelection, fn: (p: Point) => Point): PathSelection => ({
  ...shape,
  points: shape.points.map(fn),
  subpaths: shape.subpaths ? shape.subpaths.map(ring => ring.map(fn)) : undefined
});

export const translateShape = (shape: SelectionShape, dx: number, dy: number): SelectionShape => {
  if (shape.kind === 'path') {
    return mapPathPoints(shape, p => ({ x: p.x + dx, y: p.y + dy }));
  }
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
};

/** Scales a shape about an arbitrary origin, used when mapping scene units into image pixels. */
export const transformShape = (
  shape: SelectionShape,
  fn: (p: Point) => Point
): SelectionShape => {
  if (shape.kind === 'path') {
    return mapPathPoints(shape, fn);
  }
  const a = fn({ x: shape.x, y: shape.y });
  const b = fn({ x: shape.x + shape.width, y: shape.y + shape.height });
  return { ...shape, x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
};

export const getShapeAngle = (shape: SelectionShape): number => shape.angle || 0;

/** Centre of the shape's own unrotated box; rotation always happens about this point. */
export const getShapeCentre = (shape: SelectionShape): Point => {
  const b = getShapeBBox(shape);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

export const rotatePoint = (p: Point, centre: Point, degrees: number): Point => {
  if (!degrees) return p;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
};

/** Takes a scene point into the shape's unrotated frame, so plain axis-aligned maths applies. */
export const toLocalPoint = (shape: SelectionShape, point: Point): Point =>
  rotatePoint(point, getShapeCentre(shape), -getShapeAngle(shape));

/** The four corners of the shape's box after rotation, in scene space. */
export const getRotatedCorners = (shape: SelectionShape): Point[] => {
  const b = getShapeBBox(shape);
  const c = getShapeCentre(shape);
  const a = getShapeAngle(shape);
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height }
  ].map(p => rotatePoint(p, c, a));
};

/** Axis-aligned bounds that still contain the shape once rotated. */
export const getWorldBBox = (shape: SelectionShape): BBox => {
  if (!getShapeAngle(shape)) return getShapeBBox(shape);
  const pts = getRotatedCorners(shape);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** Even-odd ray casting. Used for hit-testing a click against a closed path. */
const pointInPolygon = (point: Point, points: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const shapeContainsPoint = (shape: SelectionShape, scenePoint: Point): boolean => {
  // Un-rotate the probe instead of rotating the shape: one transform rather than many.
  const point = toLocalPoint(shape, scenePoint);
  const box = getShapeBBox(shape);

  if (shape.kind === 'rect') {
    return point.x >= box.x && point.x <= box.x + box.width
      && point.y >= box.y && point.y <= box.y + box.height;
  }

  if (shape.kind === 'ellipse') {
    const rx = box.width / 2;
    const ry = box.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (point.x - (box.x + rx)) / rx;
    const ny = (point.y - (box.y + ry)) / ry;
    return nx * nx + ny * ny <= 1;
  }

  if (!shape.closed || shape.points.length < 3) return false;
  // Even-odd across every ring: a point inside a hole crosses two rings and so counts as outside.
  let inside = false;
  for (const ring of pathRings(shape)) {
    if (ring.length >= 3 && pointInPolygon(point, ring)) inside = !inside;
  }
  return inside;
};

/**
 * Writes the shape into a 2D path. Shared by the on-canvas outline and the raster mask, so what
 * the user sees and what gets cut can never drift apart.
 */
export const traceShape = (ctx: CanvasRenderingContext2D | Path2D, shape: SelectionShape): void => {
  const angle = getShapeAngle(shape);
  const centre = getShapeCentre(shape);

  if (shape.kind === 'rect') {
    if (!angle) {
      const b = getShapeBBox(shape);
      ctx.rect(b.x, b.y, b.width, b.height);
      return;
    }
    // A rotated rect has to be emitted as four lines; ctx.rect is axis-aligned only.
    const corners = getRotatedCorners(shape);
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    return;
  }

  if (shape.kind === 'ellipse') {
    const b = getShapeBBox(shape);
    // ctx.ellipse takes a rotation directly, so no polygonising is needed here.
    ctx.ellipse(
      b.x + b.width / 2, b.y + b.height / 2,
      b.width / 2, b.height / 2,
      (angle * Math.PI) / 180, 0, Math.PI * 2
    );
    return;
  }

  if (shape.points.length === 0) return;
  for (const ring of pathRings(shape)) {
    if (!ring.length) continue;
    const pts = angle ? ring.map(p => rotatePoint(p, centre, angle)) : ring;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    // Sub-rings are always closed; only the outer ring can still be an open pen path.
    if (shape.closed || ring !== shape.points) ctx.closePath();
  }
};

/** Distance from a point to the pen path's first vertex, for the "click to close" affordance. */
export const distanceToFirstPoint = (shape: PathSelection, point: Point): number => {
  if (shape.points.length === 0) return Infinity;
  const first = shape.points[0];
  return Math.hypot(first.x - point.x, first.y - point.y);
};

export const isDegenerate = (shape: SelectionShape, minSize = 2): boolean => {
  if (shape.kind === 'path') return !shape.closed || shape.points.length < 3;
  const b = getShapeBBox(shape);
  return b.width < minSize || b.height < minSize;
};

/**
 * Converts any shape into an equivalent polygon. Rotating a rect or ellipse cannot keep it
 * axis-aligned, so those become paths first; this is the single place that conversion happens.
 */
export const shapeToPolygon = (shape: SelectionShape, segments = 64): PathSelection => {
  if (shape.kind === 'path') return { ...shape, closed: true };

  const b = getShapeBBox(shape);
  if (shape.kind === 'rect') {
    return {
      kind: 'path',
      closed: true,
      points: [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height }
      ]
    };
  }

  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rx = b.width / 2;
  const ry = b.height / 2;
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return { kind: 'path', closed: true, points };
};

/**
 * Polygonises a shape and bakes its rotation into the points, returning an unrotated path.
 *
 * Needed whenever shapes are combined: two shapes can each carry their own angle, but a single
 * combined path has only one, so the angles have to be resolved into coordinates first.
 */
export const flattenShape = (shape: SelectionShape, segments = 64): PathSelection => {
  const angle = getShapeAngle(shape);
  const poly = shapeToPolygon(shape, segments);
  if (!angle) return { ...poly, angle: 0 };
  // The same centre traceShape rotates about, so the flattened points land exactly where the
  // rotated shape was drawn.
  const centre = getShapeCentre(shape);
  return { ...mapPathPoints(poly, p => rotatePoint(p, centre, angle)), angle: 0 };
};

/**
 * Everything inside `bounds` except the shape.
 *
 * The inversion is pure composition: the bounds become the outer ring and the shape's rings become
 * sub-rings, so the even-odd fill rule turns the old selection into a hole. That means invert costs
 * nothing extra in rendering, hit-testing or clipping - they already handle multiple rings - and
 * inverting twice returns something equivalent to where it started.
 */
export const invertShape = (shape: SelectionShape, bounds: Point[]): PathSelection | null => {
  if (bounds.length < 3) return null;
  const flat = flattenShape(shape);
  if (flat.points.length < 3) return null;
  return {
    kind: 'path',
    closed: true,
    points: bounds,
    subpaths: [flat.points, ...(flat.subpaths || [])]
  };
};

/** Scales about the shape's own centre, so growing a selection keeps it in place. */
export const scaleShape = (shape: SelectionShape, factor: number): SelectionShape => {
  if (factor <= 0) return shape;
  const b = getShapeBBox(shape);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  if (shape.kind === 'path') {
    return mapPathPoints(shape, p => ({
      x: cx + (p.x - cx) * factor,
      y: cy + (p.y - cy) * factor
    }));
  }
  const width = b.width * factor;
  const height = b.height * factor;
  return { ...shape, x: cx - width / 2, y: cy - height / 2, width, height };
};

/** Grows (or shrinks, when negative) the shape by an absolute distance on every side. */
export const expandShape = (shape: SelectionShape, amount: number): SelectionShape => {
  const b = getShapeBBox(shape);
  const smallest = Math.min(b.width, b.height);
  if (smallest <= 0) return shape;
  // Convert the absolute inset into a scale factor about the centre.
  return scaleShape(shape, Math.max(0.01, (smallest + amount * 2) / smallest));
};

/**
 * Rotates by adjusting the angle rather than moving points. Baking rotation into coordinates grew
 * the axis-aligned box on every turn, which is why the transform handles drifted away from the
 * shape and resizing then stretched it along the wrong axes.
 */
export const rotateShape = (shape: SelectionShape, degrees: number): SelectionShape => ({
  ...shape,
  angle: (getShapeAngle(shape) + degrees) % 360
});

export const setShapeAngle = (shape: SelectionShape, degrees: number): SelectionShape => ({
  ...shape,
  angle: degrees % 360
});

/** Transform handles around a selection, named by compass point plus a rotate grip. */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot';

export const HANDLE_IDS: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * Handle positions for a bounding box. `rotateOffset` is supplied in scene units by the caller,
 * which converts it from a fixed screen distance so the grip sits the same distance away at
 * every zoom level.
 */
export const getHandlePositions = (box: BBox, rotateOffset = 0): Record<HandleId, Point> => {
  const { x, y, width: w, height: h } = box;
  const midX = x + w / 2;
  const midY = y + h / 2;
  return {
    nw: { x, y },
    n: { x: midX, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: midY },
    se: { x: x + w, y: y + h },
    s: { x: midX, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: midY },
    rot: { x: midX, y: y - rotateOffset }
  };
};

/** Handle positions in scene space, rotated with the shape so they hug its real outline. */
export const getShapeHandlePositions = (
  shape: SelectionShape,
  rotateOffset = 0
): Record<HandleId, Point> => {
  const local = getHandlePositions(getShapeBBox(shape), rotateOffset);
  const angle = getShapeAngle(shape);
  if (!angle) return local;
  const centre = getShapeCentre(shape);
  const out = {} as Record<HandleId, Point>;
  (Object.keys(local) as HandleId[]).forEach(id => {
    out[id] = rotatePoint(local[id], centre, angle);
  });
  return out;
};

/** Nearest handle within `tolerance`, or null. Corners win ties so they stay easy to grab. */
export const hitTestShapeHandle = (
  shape: SelectionShape,
  point: Point,
  tolerance: number,
  rotateOffset = 0
): HandleId | null => hitTestHandlePositions(getShapeHandlePositions(shape, rotateOffset), point, tolerance);

export const hitTestHandlePositions = (
  positions: Record<HandleId, Point>,
  point: Point,
  tolerance: number
): HandleId | null => {
  const order: HandleId[] = ['rot', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  let best: HandleId | null = null;
  let bestDist = tolerance;
  for (const id of order) {
    const p = positions[id];
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d <= bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
};

/** Kept for callers that already work with a plain box. */
export const hitTestHandle = (
  box: BBox,
  point: Point,
  tolerance: number,
  rotateOffset = 0
): HandleId | null => hitTestHandlePositions(getHandlePositions(box, rotateOffset), point, tolerance);

/** New bounding box after dragging `handle` to `point`, anchored on the opposite side. */
export const resizeBBox = (start: BBox, handle: HandleId, point: Point): BBox => {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes('w')) left = point.x;
  if (handle.includes('e')) right = point.x;
  if (handle.includes('n')) top = point.y;
  if (handle.includes('s')) bottom = point.y;

  // Normalising lets a handle be dragged past its opposite edge without inverting the shape.
  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top)
  };
};

/** Remaps a shape so its bounding box becomes `box`, preserving its internal proportions. */
export const fitShapeToBBox = (shape: SelectionShape, box: BBox): SelectionShape => {
  if (shape.kind !== 'path') {
    return { ...shape, x: box.x, y: box.y, width: box.width, height: box.height };
  }
  const from = getShapeBBox(shape);
  // A zero-width source has no proportions to preserve; translating is the only sane answer.
  const sx = from.width === 0 ? 1 : box.width / from.width;
  const sy = from.height === 0 ? 1 : box.height / from.height;
  return mapPathPoints(shape, p => ({
    x: box.x + (p.x - from.x) * sx,
    y: box.y + (p.y - from.y) * sy
  }));
};

/** Signed angle in degrees from the box centre to a point, measured from straight up. */
export const angleFromCentre = (box: BBox, point: Point): number => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI + 90;
};

/** The CSS cursor that matches a handle, accounting for how far the shape has been rotated. */
export const cursorForHandle = (handle: HandleId, angle = 0): string => {
  if (handle === 'rot') return 'grab';
  const base: Record<string, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
  // Rotate into one of four cursor directions; each covers a 45 degree band.
  const dir = (((base[handle] ?? 0) + angle) % 360 + 360) % 360;
  const idx = Math.round(dir / 45) % 8;
  return ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize',
          'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'][idx];
};
