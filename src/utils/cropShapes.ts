/**
 * Shapes a crop can take: circles, stars, hexagons and the rest.
 *
 * Every shape is inscribed in the crop box rather than kept regular, so a star in a wide box is a
 * wide star. That is what people expect from a crop frame - the handles say what the result will
 * be, and a shape that refused to follow them would feel broken.
 *
 * Pure geometry plus one canvas helper, so the shapes can be checked off-browser and the same
 * definitions drive the on-canvas preview, the picker thumbnails and the final mask.
 */

export type CropShapeId =
  | 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'polygon';

export interface CropShape {
  id: CropShapeId;
  /** Corner count for `polygon`, or point count for `star`. */
  sides?: number;
  /** Star only: the inner radius as a fraction of the outer. */
  innerRatio?: number;
}

export interface Box { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }

export const CROP_SHAPES: { id: CropShapeId; label: string; adjustable?: boolean }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star', adjustable: true },
  { id: 'polygon', label: 'Polygon', adjustable: true }
];

export const isShapeCrop = (shape: CropShape): boolean => shape.id !== 'rect';

/** How many corners a shape has, before the star doubles it. */
const cornerCount = (shape: CropShape): number => {
  switch (shape.id) {
    case 'triangle': return 3;
    case 'diamond': return 4;
    case 'pentagon': return 5;
    case 'hexagon': return 6;
    case 'star':
    case 'polygon': return Math.max(3, Math.min(20, Math.round(shape.sides || 5)));
    default: return 4;
  }
};

/**
 * Stretches a point set so its bounding box exactly fills `box`.
 *
 * A regular polygon inscribed in an ellipse does not fill the rectangle around it: a pointy-top
 * hexagon leaves a gap either side, a pentagon leaves one along the bottom. In a crop tool that
 * reads as the frame lying about what it will keep, so the shape is stretched to meet the handles.
 */
const fillBox = (points: Point[], box: Box): Point[] => {
  if (points.length < 2) return points;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // A degenerate span has no shape to stretch; leave it rather than divide by zero.
  const scaleX = spanX > 1e-9 ? box.width / spanX : 1;
  const scaleY = spanY > 1e-9 ? box.height / spanY : 1;

  return points.map(p => ({
    x: box.x + (p.x - minX) * scaleX,
    y: box.y + (p.y - minY) * scaleY
  }));
};

/** Points of the shape inscribed in `box`, clockwise from the top. Ellipses are polygonised. */
export const cropShapePoints = (shape: CropShape, box: Box, ellipseSegments = 72): Point[] => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2;
  const ry = box.height / 2;

  if (shape.id === 'rect') {
    return [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      { x: box.x, y: box.y + box.height }
    ];
  }

  // Start at the top and go clockwise, so a triangle points up and a diamond sits on a corner
  // rather than arriving at whatever angle the maths happened to begin at.
  const start = -Math.PI / 2;

  if (shape.id === 'ellipse') {
    const points: Point[] = [];
    for (let i = 0; i < ellipseSegments; i++) {
      const angle = start + (i / ellipseSegments) * Math.PI * 2;
      points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return points;
  }

  const corners = cornerCount(shape);

  if (shape.id === 'star') {
    const inner = Math.max(0.1, Math.min(0.9, shape.innerRatio ?? 0.42));
    const points: Point[] = [];
    // Twice the corner count: outer and inner radius alternating.
    for (let i = 0; i < corners * 2; i++) {
      const angle = start + (i / (corners * 2)) * Math.PI * 2;
      const scale = i % 2 === 0 ? 1 : inner;
      points.push({ x: cx + Math.cos(angle) * rx * scale, y: cy + Math.sin(angle) * ry * scale });
    }
    return fillBox(points, box);
  }

  const points: Point[] = [];
  for (let i = 0; i < corners; i++) {
    const angle = start + (i / corners) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return fillBox(points, box);
};

/** Writes the shape into a 2D path. Ellipses use the real curve rather than the polygonised one. */
export const traceCropShape = (
  ctx: CanvasRenderingContext2D | Path2D,
  shape: CropShape,
  box: Box
): void => {
  if (shape.id === 'ellipse') {
    ctx.ellipse(
      box.x + box.width / 2, box.y + box.height / 2,
      Math.max(0, box.width / 2), Math.max(0, box.height / 2),
      0, 0, Math.PI * 2
    );
    return;
  }

  const points = cropShapePoints(shape, box);
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
};

/**
 * Returns a copy of `source` with everything outside the shape erased.
 *
 * The shape fills the whole canvas, because by this point the rectangular crop has already run and
 * the canvas *is* the crop box.
 */
export const maskCanvasToShape = (
  source: CanvasImageSource,
  width: number,
  height: number,
  shape: CropShape
): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (shape.id === 'rect') {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  ctx.save();
  ctx.beginPath();
  traceCropShape(ctx, shape, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  ctx.clip();
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas;
};
