/**
 * Geometry for the Box select tool: where each annotation sits on the canvas, and which ones a
 * dragged-out box touches.
 */
import type { Annotation, SelectionRect } from "../store/useAnnotationStore";
import { getAnnotationBounds } from "../components/TransformBox";

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The annotation's box as drawn, transforms included. The renderer applies
 * `translate(t) rotate(r) scale(s)` about the pivot (cx, cy), so a point p lands at
 * pivot + t + R·S·(p − pivot); the box is taken around the four transformed corners.
 */
export function annotationBox(anno: Annotation): Box {
  const b = getAnnotationBounds(anno);
  const cx = anno.centerX ?? b.cx;
  const cy = anno.centerY ?? b.cy;
  const tx = anno.translateX ?? 0;
  const ty = anno.translateY ?? 0;
  const sx = anno.scaleX ?? 1;
  const sy = anno.scaleY ?? 1;
  const rad = ((anno.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    [b.minX, b.minY],
    [b.maxX, b.minY],
    [b.maxX, b.maxY],
    [b.minX, b.maxY],
  ].map(([x, y]) => {
    const lx = (x - cx) * sx;
    const ly = (y - cy) * sy;
    return [cx + tx + lx * cos - ly * sin, cy + ty + lx * sin + ly * cos];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export const rectToBox = (r: SelectionRect): Box => ({
  minX: Math.min(r.x1, r.x2),
  minY: Math.min(r.y1, r.y2),
  maxX: Math.max(r.x1, r.x2),
  maxY: Math.max(r.y1, r.y2),
});

const overlaps = (a: Box, b: Box) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Ids of the annotations the box touches, even partly. A tap (a zero-size box) picks what is under it. */
export function annotationsInRect(annotations: Annotation[], rect: SelectionRect): string[] {
  const box = rectToBox(rect);
  return annotations.filter((a) => a.points.length > 0 && overlaps(annotationBox(a), box)).map((a) => a.id);
}

/**
 * A transform of a whole selection: p ↦ C + A·(p − C) + d, with A = [a, b; c, d] as
 * { a, b, c, d } (row-major). Moving is A = identity; resizing is A = diag(gx, gy); rotating is a
 * rotation matrix; flipping is diag(−1, 1) or diag(1, −1).
 */
export interface GroupTransform {
  cx: number;
  cy: number;
  m: { a: number; b: number; c: number; d: number };
  dx: number;
  dy: number;
}

export const identityMatrix = { a: 1, b: 0, c: 0, d: 1 };

/**
 * The per-annotation updates that apply `t` to each of `annos` (taken as they were when the
 * gesture began). Each annotation keeps its own rotate/scale about its own pivot: its centre is
 * moved exactly, and its rotation and scale are re-derived from A·R·S (a QR split). That is exact
 * for moving, rotating, flipping and even resizing, and for uneven resizing of an unrotated shape;
 * uneven resizing of a rotated shape would need a skew, so it takes the nearest unskewed fit.
 */
export function groupTransformUpdates(annos: Annotation[], t: GroupTransform): Record<string, Partial<Annotation>> {
  const { a, b, c, d } = t.m;
  const apply = (x: number, y: number) => ({
    x: t.cx + a * (x - t.cx) + b * (y - t.cy) + t.dx,
    y: t.cy + c * (x - t.cx) + d * (y - t.cy) + t.dy,
  });
  const updates: Record<string, Partial<Annotation>> = {};

  for (const anno of annos) {
    const bounds = getAnnotationBounds(anno);
    const px = anno.centerX ?? bounds.cx;
    const py = anno.centerY ?? bounds.cy;
    const tx = anno.translateX ?? 0;
    const ty = anno.translateY ?? 0;
    const sx = anno.scaleX ?? 1;
    const sy = anno.scaleY ?? 1;
    const r = ((anno.rotation ?? 0) * Math.PI) / 180;

    // Where the shape's centre is drawn now: pivot + t + R·S·(centre − pivot).
    const lx = (bounds.cx - px) * sx;
    const ly = (bounds.cy - py) * sy;
    const centre = { x: px + tx + lx * Math.cos(r) - ly * Math.sin(r), y: py + ty + lx * Math.sin(r) + ly * Math.cos(r) };
    const next = apply(centre.x, centre.y);

    // New linear part A·R·S, split as R(r')·S(sx', sy') with the skew dropped.
    const ux = a * Math.cos(r) * sx + b * Math.sin(r) * sx;
    const uy = c * Math.cos(r) * sx + d * Math.sin(r) * sx;
    const vx = (-a * Math.sin(r) + b * Math.cos(r)) * sy;
    const vy = (-c * Math.sin(r) + d * Math.cos(r)) * sy;
    const r2 = Math.atan2(uy, ux);
    const sx2 = Math.hypot(ux, uy);
    const sy2 = -vx * Math.sin(r2) + vy * Math.cos(r2);

    // Translate so the centre lands where the group transform puts it.
    const l2x = (bounds.cx - px) * sx2;
    const l2y = (bounds.cy - py) * sy2;
    updates[anno.id] = {
      centerX: px,
      centerY: py,
      rotation: (r2 * 180) / Math.PI,
      scaleX: sx2,
      scaleY: sy2,
      translateX: next.x - px - (l2x * Math.cos(r2) - l2y * Math.sin(r2)),
      translateY: next.y - py - (l2x * Math.sin(r2) + l2y * Math.cos(r2)),
    };
  }
  return updates;
}

/** The box around several annotations, or null if there are none. */
export function unionBox(annotations: Annotation[]): Box | null {
  if (annotations.length === 0) return null;
  const boxes = annotations.map(annotationBox);
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}
