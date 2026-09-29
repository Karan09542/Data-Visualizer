/**
 * Recentring: what to frame, and how to frame it in the part of the graph the
 * toolbars leave uncovered.
 */
import type { GraphView } from "./simulations";

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Sampled {
  xs: ArrayLike<number>;
  ys: ArrayLike<number>;
}

/**
 * The box around some drawn shapes. A shape spanning more than `maxSpan` is left
 * out: it runs off to infinity (a line, an asymptote), and would only frame
 * however far it happened to be sampled. Null when there's nothing to frame.
 */
export function contentBounds(shapes: Sampled[], maxSpan = 500): Bounds | null {
  let b: Bounds | null = null;
  for (const s of shapes) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < s.xs.length; i++) {
      const x = s.xs[i];
      const y = s.ys[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x0 > x1 || x1 - x0 > maxSpan || y1 - y0 > maxSpan) continue;
    b = b
      ? { x0: Math.min(b.x0, x0), x1: Math.max(b.x1, x1), y0: Math.min(b.y0, y0), y1: Math.max(b.y1, y1) }
      : { x0, x1, y0, y1 };
  }
  return b;
}

export interface Viewport {
  /** The whole graph, in pixels. */
  width: number;
  height: number;
  /** Pixels covered along the left and top edges (toolbars). */
  insetLeft?: number;
  insetTop?: number;
}

/**
 * The view (for Mafs, with padding 0) that shows `b` as large as fits, centred
 * in the uncovered part of the graph, with `margin` (a fraction of the box)
 * around it and at least `minSpan` units across. Its aspect matches the graph's,
 * so Mafs shows it exactly.
 */
export function fitView(b: Bounds, vp: Viewport, margin = 0.12, minSpan = 2): GraphView {
  const W = Math.max(1, vp.width);
  const H = Math.max(1, vp.height);
  const L = Math.min(Math.max(0, vp.insetLeft ?? 0), W * 0.4);
  const T = Math.min(Math.max(0, vp.insetTop ?? 0), H * 0.4);
  const w = W - L;
  const h = H - T;

  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const bw = Math.max(minSpan, (b.x1 - b.x0) * (1 + 2 * margin));
  const bh = Math.max(minSpan, (b.y1 - b.y0) * (1 + 2 * margin));
  // Pixels per unit: the box fits the uncovered area both ways.
  const s = Math.min(w / bw, h / bh);

  // The uncovered area's centre (L + w/2, T + h/2 from the top-left) shows (cx, cy).
  const x0 = cx - (L + w / 2) / s;
  const y1 = cy + (T + h / 2) / s;
  return { x: [x0, x0 + W / s], y: [y1 - H / s, y1] };
}
