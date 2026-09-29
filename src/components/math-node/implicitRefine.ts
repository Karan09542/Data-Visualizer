/**
 * Puts an implicit curve's traced outline onto the curve itself.
 *
 * Marching squares places each vertex by linear interpolation along a grid edge,
 * and joins vertices with straight chords a grid cell long. Both errors depend
 * on the grid, which follows the view — so areas and lengths measured against
 * that outline change as you zoom. Here each vertex is solved exactly on its
 * edge, and chords that stray from the curve are split at points projected onto
 * it, until the outline is within a small fraction of a cell everywhere.
 */

export type Residual = (x: number, y: number) => number;

/**
 * One marching-squares vertex: it lies on the grid edge a→b, where the residual
 * changes sign (fa, fb are the grid values there).
 */
export interface EdgeVertex {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  fa: number;
  fb: number;
}

/** The root of f on the segment a→b, which it brackets (Illinois false position). */
export function edgeRoot(f: Residual, v: EdgeVertex): [number, number] {
  let { fa, fb } = v;
  const { ax, ay, bx, by } = v;
  const lerp = () => {
    const t = Math.abs(fb - fa) < 1e-300 ? 0.5 : Math.max(0, Math.min(1, fa / (fa - fb)));
    return [ax + t * (bx - ax), ay + t * (by - ay), t] as const;
  };
  if (!(fa * fb < 0) || !Number.isFinite(fa) || !Number.isFinite(fb)) {
    const [x, y] = lerp();
    return [x, y];
  }
  let lo = 0;
  let hi = 1;
  let side = 0;
  let t = lerp()[2];
  for (let k = 0; k < 30; k++) {
    const ft = f(ax + t * (bx - ax), ay + t * (by - ay));
    if (!Number.isFinite(ft)) break;
    if (ft === 0) break;
    if (ft * fa < 0) {
      hi = t;
      fb = ft;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      lo = t;
      fa = ft;
      if (side === 1) fb /= 2;
      side = 1;
    }
    if (hi - lo < 1e-12) break;
    t = lo + (hi - lo) * (fa / (fa - fb));
    if (!(t > lo && t < hi)) t = (lo + hi) / 2;
  }
  return [ax + t * (bx - ax), ay + t * (by - ay)];
}

/**
 * The point of the curve nearest (x, y), by Newton steps along the gradient;
 * null if that doesn't settle within `reach`.
 */
export function projectOntoCurve(f: Residual, x: number, y: number, h: number, reach: number): [number, number] | null {
  let px = x;
  let py = y;
  for (let k = 0; k < 6; k++) {
    const v = f(px, py);
    if (!Number.isFinite(v)) return null;
    const gx = (f(px + h, py) - f(px - h, py)) / (2 * h);
    const gy = (f(px, py + h) - f(px, py - h)) / (2 * h);
    const g2 = gx * gx + gy * gy;
    if (!(g2 > 0) || !Number.isFinite(g2)) return null;
    const sx = (v * gx) / g2;
    const sy = (v * gy) / g2;
    px -= sx;
    py -= sy;
    if (Math.hypot(px - x, py - y) > reach) return null;
    if (sx * sx + sy * sy < h * h * 1e-6) return [px, py];
  }
  return Math.abs(f(px, py)) < Math.abs(f(x, y)) ? [px, py] : null;
}

/**
 * The outline as runs of points (NaN-separated, the tracer's format), from
 * marching-squares segments given as pairs of edge vertices.
 *
 * `cell` is the grid spacing; chords are split until they're within
 * cell × `tolerance` of the curve, at most `maxDepth` times. `maxEvals` caps the
 * work on very long outlines: past it, the rest are only placed on their edges.
 */
export function refineImplicitOutline(
  f: Residual,
  segments: EdgeVertex[],
  cell: number,
  { tolerance = 2e-4, maxDepth = 4, maxEvals = 150_000 } = {},
): { xs: number[]; ys: number[] } {
  let evals = 0;
  const counted: Residual = (x, y) => {
    evals++;
    return f(x, y);
  };

  // Each edge vertex is shared by two cells: solve it once.
  const roots = new Map<string, [number, number]>();
  const root = (v: EdgeVertex) => {
    const key = `${v.ax},${v.ay},${v.bx},${v.by}`;
    let p = roots.get(key);
    if (!p) {
      p = evals < maxEvals ? edgeRoot(counted, v) : edgeRoot(() => NaN, v);
      roots.set(key, p);
    }
    return p;
  };

  const h = cell * 1e-4;
  const tol = cell * tolerance;
  const xs: number[] = [];
  const ys: number[] = [];
  const split = (ax: number, ay: number, bx: number, by: number, depth: number) => {
    if (depth >= maxDepth || evals >= maxEvals) return;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const m = projectOntoCurve(counted, mx, my, h, Math.hypot(bx - ax, by - ay));
    if (!m || Math.hypot(m[0] - mx, m[1] - my) < tol) return;
    split(ax, ay, m[0], m[1], depth + 1);
    xs.push(m[0]);
    ys.push(m[1]);
    split(m[0], m[1], bx, by, depth + 1);
  };

  for (let i = 0; i + 1 < segments.length; i += 2) {
    const a = root(segments[i]);
    const b = root(segments[i + 1]);
    if (xs.length) {
      xs.push(NaN);
      ys.push(NaN);
    }
    xs.push(a[0]);
    ys.push(a[1]);
    split(a[0], a[1], b[0], b[1], 0);
    xs.push(b[0]);
    ys.push(b[1]);
  }
  return { xs, ys };
}
