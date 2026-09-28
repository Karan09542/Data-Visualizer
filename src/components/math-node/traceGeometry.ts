/**
 * What the tracer can snap to: every drawn shape publishes the geometry it actually
 * put on screen, in world coordinates with its transform already applied. Tracing
 * against the drawn geometry (instead of re-evaluating expressions with separate
 * transform maths) guarantees the trace point lands on what the user sees.
 */

type Vec2 = [number, number];

export interface TraceShape {
  /** Row this geometry belongs to. */
  fnId: string;
  color: string;
  /**
   * "curve": polyline runs. "point": isolated vertices (a dot has no locus to slide
   * along, so it only shows its value).
   */
  kind: "curve" | "point";
  /** Vertices. A non-finite coordinate ends a run; the next vertex starts a new one. */
  xs: ArrayLike<number>;
  ys: ArrayLike<number>;
  /** Curve parameter at each vertex (x for y = f(x); t, θ or time otherwise). */
  ts?: ArrayLike<number>;
  /** Exact point at a parameter; polishes a hit from the polyline onto the true curve. */
  at?: (t: number) => Vec2;
  /** The curve is this function's zero set (implicit curves); polishes the same way. */
  residual?: (x: number, y: number) => number;
  /** Parameter shown alongside the coordinates, e.g. "t" or "θ". */
  paramName?: string;
  /**
   * Unordered segment pairs (marching squares) rather than connected runs, so
   * following a branch by walking neighbours means nothing.
   */
  soup?: boolean;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

const shapes = new Map<string, TraceShape>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export function setTraceShape(key: string, shape: TraceShape) {
  shapes.set(key, shape);
  notify();
}

export function deleteTraceShape(key: string) {
  if (shapes.delete(key)) notify();
}

export const getTraceShape = (key: string) => shapes.get(key);
export const subscribeTraceShapes = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const traceShapesVersion = () => version;

// ─── Search ────────────────────────────────────────────────────────────────────

export interface TraceHit {
  key: string;
  x: number;
  y: number;
  /** Index of the first vertex of the segment the hit lies on. */
  seg: number;
  /** Curve parameter at the hit, when the shape has one. */
  t?: number;
  /** Squared on-screen distance to the query point, in px². */
  d2: number;
}

/** Pixels per world unit on each axis — distances are measured on screen. */
export interface TraceScale {
  sx: number;
  sy: number;
}

const finite = (v: number) => Number.isFinite(v);

/** Nearest point on segments [from, to) of a shape, or on its vertices for dots. */
function scan(
  key: string,
  shape: TraceShape,
  mx: number,
  my: number,
  { sx, sy }: TraceScale,
  from: number,
  to: number,
): TraceHit | null {
  const { xs, ys, ts } = shape;
  const n = Math.min(xs.length, ys.length);
  from = Math.max(0, from);
  to = Math.min(n, to);
  let best: TraceHit | null = null;
  const MX = mx * sx;
  const MY = my * sy;

  if (shape.kind === "point") {
    for (let i = from; i < to; i++) {
      const x = xs[i];
      const y = ys[i];
      if (!finite(x) || !finite(y)) continue;
      const dx = x * sx - MX;
      const dy = y * sy - MY;
      const d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2) best = { key, x, y, seg: i, d2 };
    }
    return best;
  }

  for (let i = from; i < to - 1; i++) {
    const x0 = xs[i];
    const y0 = ys[i];
    const x1 = xs[i + 1];
    const y1 = ys[i + 1];
    if (!finite(x0) || !finite(y0) || !finite(x1) || !finite(y1)) continue;
    const ax = x0 * sx;
    const ay = y0 * sy;
    const dx = x1 * sx - ax;
    const dy = y1 * sy - ay;
    const l2 = dx * dx + dy * dy;
    let u = l2 > 0 ? ((MX - ax) * dx + (MY - ay) * dy) / l2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ex = ax + u * dx - MX;
    const ey = ay + u * dy - MY;
    const d2 = ex * ex + ey * ey;
    if (!best || d2 < best.d2) {
      best = {
        key,
        x: x0 + u * (x1 - x0),
        y: y0 + u * (y1 - y0),
        seg: i,
        t: ts ? ts[i] + u * (ts[i + 1] - ts[i]) : undefined,
        d2,
      };
    }
  }
  return best;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * Moves a hit from the drawn polyline onto the true curve: a golden-section search
 * over the segment's parameter range, or Newton steps onto an implicit curve.
 * The polyline is within a fraction of a pixel of the curve, so a polish that moves
 * the point more than a few pixels means the curve isn't what was drawn (e.g. a
 * clamped value); the polyline point is kept then.
 */
function polish(
  shape: TraceShape,
  hit: TraceHit,
  mx: number,
  my: number,
  { sx, sy }: TraceScale,
): TraceHit {
  const screenD2 = (x: number, y: number) => {
    const dx = (x - mx) * sx;
    const dy = (y - my) * sy;
    return dx * dx + dy * dy;
  };
  const movedPx = (x: number, y: number) =>
    Math.hypot((x - hit.x) * sx, (y - hit.y) * sy);

  const { at, ts, residual } = shape;

  if (at && ts && hit.seg + 1 < ts.length) {
    let a = ts[hit.seg];
    let b = ts[hit.seg + 1];
    if (finite(a) && finite(b) && a !== b) {
      const cost = (t: number) => {
        const p = at(t);
        return finite(p[0]) && finite(p[1]) ? screenD2(p[0], p[1]) : Infinity;
      };
      let c = b - GOLDEN * (b - a);
      let d = a + GOLDEN * (b - a);
      let fc = cost(c);
      let fd = cost(d);
      for (let i = 0; i < 28; i++) {
        if (fc < fd) {
          b = d;
          d = c;
          fd = fc;
          c = b - GOLDEN * (b - a);
          fc = cost(c);
        } else {
          a = c;
          c = d;
          fc = fd;
          d = a + GOLDEN * (b - a);
          fd = cost(d);
        }
      }
      const t = (a + b) / 2;
      const p = at(t);
      if (finite(p[0]) && finite(p[1]) && movedPx(p[0], p[1]) < 4) {
        return { ...hit, x: p[0], y: p[1], t, d2: screenD2(p[0], p[1]) };
      }
    }
    return hit;
  }

  if (residual) {
    // Newton projection onto residual = 0, with a step size of a hundredth of a pixel
    // for the numeric gradient.
    const hx = 0.01 / sx;
    const hy = 0.01 / sy;
    let x = hit.x;
    let y = hit.y;
    let r = residual(x, y);
    for (let i = 0; i < 6 && finite(r) && r !== 0; i++) {
      const gx = (residual(x + hx, y) - r) / hx;
      const gy = (residual(x, y + hy) - r) / hy;
      const g2 = gx * gx + gy * gy;
      if (!finite(g2) || g2 === 0) break;
      const nx = x - (r * gx) / g2;
      const ny = y - (r * gy) / g2;
      const nr = residual(nx, ny);
      if (!finite(nr) || Math.abs(nr) >= Math.abs(r)) break;
      x = nx;
      y = ny;
      r = nr;
    }
    if (movedPx(x, y) < 4) return { ...hit, x, y, d2: screenD2(x, y) };
  }

  return hit;
}

/**
 * The shape under a point: the nearest one within `maxPx` on screen. Dots win a
 * near-tie against the curves they sit on, so a point on a curve stays pickable.
 */
export function hitTestTrace(
  mx: number,
  my: number,
  scale: TraceScale,
  maxPx: number,
): TraceHit | null {
  const POINT_BONUS_PX = 8;
  let best: TraceHit | null = null;
  let bestScore = maxPx;

  for (const [key, shape] of shapes) {
    const hit = scan(key, shape, mx, my, scale, 0, shape.xs.length);
    if (!hit) continue;
    const d = Math.sqrt(hit.d2);
    const score = shape.kind === "point" ? Math.max(0, d - POINT_BONUS_PX) : d;
    if (d <= maxPx && score < bestScore) {
      best = hit;
      bestScore = score;
    }
  }

  return best ? polish(shapes.get(best.key)!, best, mx, my, scale) : null;
}

/**
 * Where on one locked shape a dragged handle goes. It follows the branch it's on:
 * the search looks along the curve near the previous position first, so crossing
 * another part of the same curve (a rose's centre, a figure-eight) doesn't make it
 * jump. It only jumps when the pointer is clearly nearer somewhere else.
 */
export function projectOntoShape(
  key: string,
  mx: number,
  my: number,
  scale: TraceScale,
  prev?: { seg: number; x: number; y: number },
): TraceHit | null {
  const shape = shapes.get(key);
  if (!shape) return null;
  const n = shape.xs.length;
  const global = scan(key, shape, mx, my, scale, 0, n);
  if (!global) return null;

  let chosen = global;
  if (prev && !shape.soup && shape.kind === "curve" && prev.seg >= 0 && prev.seg < n - 1) {
    const { xs, ys } = shape;
    const { sx, sy } = scale;
    // Walk the curve in both directions from the previous segment, covering a
    // generous multiple of how far the pointer is from the handle.
    const reach =
      60 + 3 * Math.hypot((mx - prev.x) * sx, (my - prev.y) * sy);
    const segLen = (i: number) => Math.hypot((xs[i + 1] - xs[i]) * sx, (ys[i + 1] - ys[i]) * sy);
    let lo = prev.seg;
    for (let walked = 0; lo > 0; lo--) {
      const len = segLen(lo - 1);
      if (!finite(len)) break;
      walked += len;
      if (walked > reach) break;
    }
    let hi = prev.seg + 1;
    for (let walked = 0; hi < n - 1; hi++) {
      const len = segLen(hi);
      if (!finite(len)) break;
      walked += len;
      if (walked > reach) break;
    }
    const local = scan(key, shape, mx, my, scale, lo, hi + 1);
    const JUMP_PX = 24;
    if (local && Math.sqrt(local.d2) - Math.sqrt(global.d2) <= JUMP_PX) chosen = local;
  }

  return polish(shape, chosen, mx, my, scale);
}

/**
 * The same hit after the shape was redrawn (animation, a slider, a transform).
 * A curve with a parameter keeps the parameter, so the point rides along with it;
 * anything else stays at the nearest point to where it was.
 */
export function relocateOnShape(
  key: string,
  pin: { seg: number; x: number; y: number; t?: number },
  scale: TraceScale,
): TraceHit | null {
  const shape = shapes.get(key);
  if (!shape) return null;

  if (shape.at && pin.t !== undefined && finite(pin.t)) {
    const p = shape.at(pin.t);
    if (finite(p[0]) && finite(p[1])) {
      const ts = shape.ts;
      let seg = pin.seg;
      if (ts) {
        // The parameter's segment, for following the branch when dragging resumes.
        for (let i = 0; i < ts.length - 1; i++) {
          const a = ts[i];
          const b = ts[i + 1];
          if ((a <= pin.t && pin.t <= b) || (b <= pin.t && pin.t <= a)) {
            seg = i;
            break;
          }
        }
      }
      return { key, x: p[0], y: p[1], seg, t: pin.t, d2: 0 };
    }
  }

  return projectOntoShape(key, pin.x, pin.y, scale, pin);
}

// ─── Formatting ────────────────────────────────────────────────────────────────

/**
 * A coordinate with as many decimals as the zoom level can resolve (about one
 * pixel), without trailing zeros.
 */
export function formatTraceNumber(value: number, pixelsPerUnit: number): string {
  if (!finite(value)) return "undefined";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e7 || abs < 1e-6)) {
    return value.toExponential(3).replace(/\.?0+e/, "e");
  }
  const decimals = Math.max(0, Math.min(8, Math.ceil(Math.log10(Math.max(pixelsPerUnit, 1)))));
  let text = value.toFixed(decimals);
  if (text.includes(".")) text = text.replace(/\.?0+$/, "");
  if (/^-0(\.0*)?$/.test(text)) text = "0";
  return text;
}

/** A shape from separate runs of vertices (a polygon's closed ring, a set of arrows…). */
export function runsShape(
  fnId: string,
  color: string,
  kind: TraceShape["kind"],
  runs: Vec2[][],
): TraceShape {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const run of runs) {
    if (run.length === 0) continue;
    if (xs.length > 0) {
      xs.push(NaN);
      ys.push(NaN);
    }
    for (const [x, y] of run) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { fnId, color, kind, xs, ys };
}
