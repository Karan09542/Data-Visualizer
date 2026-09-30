/**
 * What the tracer can snap to: every drawn shape publishes the geometry it actually
 * put on screen, in world coordinates with its transform already applied. Tracing
 * against the drawn geometry (instead of re-evaluating expressions with separate
 * transform maths) guarantees the trace point lands on what the user sees.
 */

import { createContext } from "react";

type Vec2 = [number, number];

/**
 * Which graph a shape belongs to. Several math nodes can be open on the canvas, and
 * each one's tracer must only see its own shapes.
 */
export const TraceScopeContext = createContext<string>("");
/** Registry key for a shape of a graph. */
export const scopedTraceKey = (scope: string, key: string) => (scope ? scope + "|" + key : key);

export interface TraceShape {
  /** Graph this geometry belongs to (see TraceScopeContext). */
  scope?: string;
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

/*
 * Every animated curve republishes its geometry each frame. Telling listeners
 * about each of those synchronously re-rendered them once per curve per frame,
 * which made animation stutter. Instead there are two channels:
 *  - "frame": at most once per animation frame, for the trace point, which has
 *    to ride along with a moving curve;
 *  - "slow": at most a few times a second (and once more after changes stop),
 *    for readouts like the roots panel, which nobody can read at 60 Hz anyway.
 */
const frameListeners = new Set<() => void>();
const slowListeners = new Set<() => void>();
let frameVersion = 0;
let slowVersion = 0;
let frameScheduled = false;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
let lastSlowNotify = 0;
const SLOW_INTERVAL_MS = 300;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const flushFrame = () => {
  frameScheduled = false;
  frameVersion++;
  frameListeners.forEach((l) => l());
};

const flushSlow = () => {
  slowTimer = null;
  lastSlowNotify = now();
  slowVersion++;
  slowListeners.forEach((l) => l());
};

const notify = () => {
  if (!frameScheduled) {
    frameScheduled = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(flushFrame);
    else setTimeout(flushFrame, 16);
  }
  if (!slowTimer) {
    // Leading and trailing: the first change shows promptly, and the last one is
    // never lost because the timer always fires after it.
    const wait = Math.max(0, SLOW_INTERVAL_MS - (now() - lastSlowNotify));
    slowTimer = setTimeout(flushSlow, wait);
  }
};

export function setTraceShape(key: string, shape: TraceShape) {
  shapes.set(key, shape);
  notify();
}

export function deleteTraceShape(key: string) {
  if (shapes.delete(key)) notify();
}

export const getTraceShape = (key: string) => shapes.get(key);

/** Changes to the drawn geometry, at most once per animation frame. */
export const subscribeTraceShapes = (listener: () => void) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};
export const traceShapesVersion = () => frameVersion;

/** Changes to the drawn geometry, at most every few hundred milliseconds. */
export const subscribeTraceShapesSlow = (listener: () => void) => {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
};
export const traceShapesSlowVersion = () => slowVersion;

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
  scope = "",
): TraceHit | null {
  const POINT_BONUS_PX = 8;
  let best: TraceHit | null = null;
  let bestScore = maxPx;

  for (const [key, shape] of shapes) {
    if ((shape.scope ?? "") !== scope) continue;
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
  const decimals = Math.max(0, Math.min(8, Math.ceil(Math.log10(Math.max(pixelsPerUnit, 1)))));
  // Smaller than the last digit shown: rounding noise (1.7e-27), so 0.
  if (abs < 0.5 * 10 ** -decimals) return "0";
  if (abs >= 1e7) return value.toExponential(3).replace(/\.?0+e/, "e");
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

// ─── Axis intercepts ───────────────────────────────────────────────────────────

/** Where a drawn shape crosses or touches an axis. */
export interface TraceIntercept {
  key: string;
  /** "x": a root (crosses the x-axis, y = 0). "y": crosses the y-axis (x = 0). */
  axis: "x" | "y";
  x: number;
  y: number;
  seg: number;
  t?: number;
}

const MAX_INTERCEPTS = 200;

/** Bisection on a sign change; returns null if it homes in on a pole, not a root. */
function bisectRoot(g: (t: number) => number, a: number, b: number): number | null {
  let ga = g(a);
  let gb = g(b);
  if (ga === 0) return a;
  if (gb === 0) return b;
  if (!finite(ga) || !finite(gb) || (ga < 0) === (gb < 0)) return null;
  const scale = Math.abs(ga) + Math.abs(gb);
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (m === a || m === b) break;
    const gm = g(m);
    if (!finite(gm)) return null;
    if (gm === 0) return m;
    if ((gm < 0) === (ga < 0)) {
      a = m;
      ga = gm;
    } else {
      b = m;
      gb = gm;
    }
  }
  const t = Math.abs(ga) < Math.abs(gb) ? a : b;
  // A sign change across a pole (tan, 1/x without a drawn break) converges to
  // where the value blows up; a real root converges to where it vanishes.
  return Math.abs(g(t)) <= 1e-9 * (1 + scale) ? t : null;
}

/** Minimum of |g| near a touching point (e.g. x² at 0); null unless it reaches 0. */
function touchRoot(g: (t: number) => number, a: number, b: number, tol: number): number | null {
  const cost = (t: number) => {
    const v = Math.abs(g(t));
    return finite(v) ? v : Infinity;
  };
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = cost(c);
  let fd = cost(d);
  for (let i = 0; i < 60; i++) {
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
  return cost(t) <= tol ? t : null;
}

function computeIntercepts(key: string, shape: TraceShape): TraceIntercept[] {
  if (shape.kind !== "curve") return [];
  const { xs, ys, ts, at, residual } = shape;
  const n = Math.min(xs.length, ys.length);
  const out: TraceIntercept[] = [];

  for (const axis of ["x", "y"] as const) {
    // Crossing the x-axis means y = 0, so the component that vanishes is y.
    const comp = axis === "x" ? 1 : 0;
    const vals = comp === 1 ? ys : xs;
    const other = comp === 1 ? xs : ys;
    const place = (v: number, seg: number, t?: number) => {
      // A crossing at the origin comes out as ~1e-17 rather than 0 (bisection stops
      // a hair from the other axis). Anything that small beside the curve's own
      // sampling scale is 0.
      const near =
        seg + 1 < n
          ? Math.max(Math.abs(xs[seg + 1] - xs[seg]), Math.abs(ys[seg + 1] - ys[seg]))
          : 0;
      if (Math.abs(v) <= 1e-9 * Math.max(finite(near) ? near : 0, 1e-3)) v = 0;
      out.push(
        axis === "x"
          ? { key, axis, x: v, y: 0, seg, t }
          : { key, axis, x: 0, y: v, seg, t },
      );
    };
    // An implicit curve's vertices are straight-line guesses along grid edges;
    // solve F(v, 0) = 0 (or F(0, v) = 0) along the axis for the exact crossing.
    // A segment nearly parallel to the axis spans almost nothing along it, so the
    // bracket widens until the sign changes, but not far enough to reach another
    // crossing. `cell` is the size of the segment the guess came from.
    const refineOnAxis = (v: number, cell: number) => {
      if (!residual) return v;
      const h = (s: number) => (comp === 1 ? residual(s, 0) : residual(0, s));
      cell = Math.max(cell, 1e-12);
      for (let w = cell; w <= cell * 16; w *= 2) {
        const lo = h(v - w);
        const hi = h(v + w);
        if (!finite(lo) || !finite(hi) || (lo < 0) === (hi < 0)) continue;
        const refined = bisectRoot(h, v - w, v + w);
        return refined !== null && Math.abs(refined - v) <= 4 * cell ? refined : v;
      }
      return v;
    };
    const segSize = (i: number, j: number) =>
      Math.max(Math.abs(xs[j] - xs[i]), Math.abs(ys[j] - ys[i]));

    // A run can start or end on the axis — a closed curve drawn from t = 0 often
    // does (a circle through (r, 0)). No sign change marks it, and the far end may
    // miss zero by rounding (sin 2π ≈ -2e-16), so check run ends directly.
    for (let i = 0; i < n && out.length < MAX_INTERCEPTS; i++) {
      const v = vals[i];
      const o = other[i];
      if (!finite(v) || !finite(o)) continue;
      const startsRun = i === 0 || !finite(vals[i - 1]) || !finite(other[i - 1]);
      const endsRun = i === n - 1 || !finite(vals[i + 1]) || !finite(other[i + 1]);
      if (!startsRun && !endsRun) continue;
      const neighbour = startsRun && i + 1 < n ? vals[i + 1] : i > 0 ? vals[i - 1] : 0;
      const tol = 1e-12 * (1 + Math.abs(o) + (finite(neighbour) ? Math.abs(neighbour) : 0));
      if (Math.abs(v) <= tol && neighbour !== 0) {
        const j = startsRun && i + 1 < n ? i + 1 : Math.max(0, i - 1);
        place(refineOnAxis(o, segSize(i, j)), Math.min(i, n - 2), ts?.[i]);
      }
    }

    for (let i = 0; i < n - 1 && out.length < MAX_INTERCEPTS; i++) {
      const a = vals[i];
      const b = vals[i + 1];
      if (!finite(a) || !finite(b) || !finite(other[i]) || !finite(other[i + 1])) continue;
      // Entering zero counts once; a stretch lying on the axis (y = 0 itself) has
      // infinitely many "roots" and counts none.
      const crosses = (a < 0 && b > 0) || (a > 0 && b < 0) || (b === 0 && a !== 0);

      if (crosses) {
        if (at && ts && finite(ts[i]) && finite(ts[i + 1])) {
          const t = bisectRoot((s) => at(s)[comp], ts[i], ts[i + 1]);
          if (t === null) continue;
          place(at(t)[1 - comp], i, t);
        } else {
          // Straight segment: linear interpolation is exact.
          const u = a / (a - b);
          const v = other[i] + u * (other[i + 1] - other[i]);
          place(refineOnAxis(v, segSize(i, i + 1)), i);
        }
        continue;
      }

      // Touching without crossing (x² at 0, a circle resting on the axis): |value|
      // has a local minimum between two same-signed neighbours. Only a curve with an
      // exact evaluator can confirm it really reaches zero.
      if (at && ts && i > 0 && a !== 0) {
        const prev = vals[i - 1];
        if (
          finite(prev) && finite(ts[i - 1]) && finite(ts[i + 1]) &&
          (prev < 0) === (a < 0) && (b < 0) === (a < 0) &&
          Math.abs(a) <= Math.abs(prev) && Math.abs(a) <= Math.abs(b) &&
          // Only near the axis: at a touching root the dip's depth is small next
          // to how much the neighbours differ (at most a quarter for a parabola
          // sampled anywhere near its vertex). A curve that stays well away from
          // zero, like sin(x) + 2 at its troughs, fails this and skips the search.
          Math.abs(a) <= 0.25 * (Math.abs(prev - a) + Math.abs(b - a))
        ) {
          const tol = 1e-9 * (1 + Math.abs(prev) + Math.abs(b));
          const t = touchRoot((s) => at(s)[comp], ts[i - 1], ts[i + 1], tol);
          if (t !== null) place(at(t)[1 - comp], i, t);
        }
      }
    }
  }

  // Neighbouring segments can report the same crossing; keep one of each.
  out.sort((p, q) => (p.axis === q.axis ? (p.axis === "x" ? p.x - q.x : p.y - q.y) : p.axis < q.axis ? -1 : 1));
  return out.filter((p, i) => {
    const q = out[i - 1];
    if (!q || q.axis !== p.axis) return true;
    const v = p.axis === "x" ? p.x : p.y;
    const w = q.axis === "x" ? q.x : q.y;
    return Math.abs(v - w) > 1e-8 * Math.max(1, Math.abs(v));
  });
}

const interceptCache = new WeakMap<TraceShape, TraceIntercept[]>();
const lastIntercepts = new Map<string, { at: number; list: TraceIntercept[] }>();
/**
 * A shape that keeps changing (an animated curve gets new geometry every frame)
 * has its crossings recomputed at most this often; in between, the latest result
 * is reused. Root-finding every frame was what made animation stutter.
 */
const INTERCEPT_MAX_AGE_MS = 250;

/** Axis crossings of one drawn shape, cached per version of its geometry. */
export function shapeIntercepts(key: string): TraceIntercept[] {
  const shape = shapes.get(key);
  if (!shape) return [];
  const cached = interceptCache.get(shape);
  if (cached) return cached;

  const t = now();
  const recent = lastIntercepts.get(key);
  if (recent && t - recent.at < INTERCEPT_MAX_AGE_MS) return recent.list;

  const list = computeIntercepts(key, shape);
  interceptCache.set(shape, list);
  if (lastIntercepts.size > 500) lastIntercepts.clear();
  lastIntercepts.set(key, { at: t, list });
  return list;
}

/** Roots (x-axis crossings) and y-axis crossings of everything a row draws. */
export function interceptsForFunction(fnId: string, scope = ""): {
  roots: TraceIntercept[];
  yIntercepts: TraceIntercept[];
} {
  const roots: TraceIntercept[] = [];
  const yIntercepts: TraceIntercept[] = [];
  for (const [key, shape] of shapes) {
    if (shape.fnId !== fnId || (shape.scope ?? "") !== scope) continue;
    for (const p of shapeIntercepts(key)) (p.axis === "x" ? roots : yIntercepts).push(p);
  }
  roots.sort((p, q) => p.x - q.x);
  yIntercepts.sort((p, q) => p.y - q.y);
  return { roots, yIntercepts };
}

/** A hit moved onto an axis crossing of its shape when it's within `radiusPx`. */
export function snapToIntercept(hit: TraceHit, { sx, sy }: TraceScale, radiusPx: number): TraceHit {
  let best: TraceIntercept | null = null;
  let bestD = radiusPx;
  for (const p of shapeIntercepts(hit.key)) {
    const d = Math.hypot((p.x - hit.x) * sx, (p.y - hit.y) * sy);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ? { ...hit, x: best.x, y: best.y, seg: best.seg, t: best.t } : hit;
}

/** Which axes a point on a shape is a crossing of (both, at the origin). */
export function interceptAxesAt(
  key: string,
  x: number,
  y: number,
  { sx, sy }: TraceScale,
): { x: boolean; y: boolean } {
  const found = { x: false, y: false };
  for (const p of shapeIntercepts(key)) {
    if (Math.hypot((p.x - x) * sx, (p.y - y) * sy) < 0.75) found[p.axis] = true;
  }
  return found;
}

// Lets the equations panel place the trace point, e.g. on a root chip click.
// One tracer per graph listens; a pin asked for while none is mounted (the graph is
// remounting to pan somewhere) waits until one is.
const pinListeners = new Map<string, (hit: TraceHit) => void>();
const pendingPins = new Map<string, TraceHit>();

export function requestTracePin(p: TraceIntercept, scope = "") {
  const hit: TraceHit = { key: p.key, x: p.x, y: p.y, seg: p.seg, t: p.t, d2: 0 };
  const listener = pinListeners.get(scope);
  if (listener) listener(hit);
  else pendingPins.set(scope, hit);
}

/** Queue a pin for the next tracer of this graph to mount. */
export const deferTracePin = (hit: TraceHit, scope = "") => pendingPins.set(scope, hit);

export const onTracePinRequest = (listener: (hit: TraceHit) => void, scope = "") => {
  pinListeners.set(scope, listener);
  const pending = pendingPins.get(scope);
  if (pending) {
    pendingPins.delete(scope);
    listener(pending);
  }
  return () => {
    if (pinListeners.get(scope) === listener) pinListeners.delete(scope);
  };
};

/** A view, in graph coordinates, to move the camera to. */
export interface TraceView {
  x: [number, number];
  y: [number, number];
}

// The graph owning a scope moves its camera when the tracer needs a point in view.
const revealHandlers = new Map<string, (view: TraceView) => void>();

export const onTraceReveal = (handler: (view: TraceView) => void, scope = "") => {
  revealHandlers.set(scope, handler);
  return () => {
    if (revealHandlers.get(scope) === handler) revealHandlers.delete(scope);
  };
};

/** Returns false when no graph handles it (the caller should just pin in place). */
export function requestTraceReveal(view: TraceView, scope = ""): boolean {
  const handler = revealHandlers.get(scope);
  if (!handler) return false;
  handler(view);
  return true;
}

// ─── For measurements ──────────────────────────────────────────────────────────

/**
 * Every drawn curve of a graph as flat segments (x0, y0, x1, y1, …): the walls
 * the Area tool fills between. Dots aren't walls.
 */
export function collectSegments(scope = ""): number[] {
  const out: number[] = [];
  for (const shape of shapes.values()) {
    if ((shape.scope ?? "") !== scope || shape.kind !== "curve") continue;
    const { xs, ys } = shape;
    const n = Math.min(xs.length, ys.length);
    for (let i = 0; i < n - 1; i++) {
      const x0 = xs[i];
      const y0 = ys[i];
      const x1 = xs[i + 1];
      const y1 = ys[i + 1];
      if (finite(x0) && finite(y0) && finite(x1) && finite(y1)) out.push(x0, y0, x1, y1);
    }
  }
  return out;
}

/** The drawn shapes of one row. */
export function shapesForFunction(fnId: string, scope = ""): TraceShape[] {
  const out: TraceShape[] = [];
  for (const shape of shapes.values()) {
    if (shape.fnId === fnId && (shape.scope ?? "") === scope) out.push(shape);
  }
  return out;
}

/**
 * Rows of one graph drawn entirely inside a box (for selecting by dragging one
 * out). A curve that runs on past the box isn't in it, however much of it shows.
 */
export function rowsInsideBox(box: { x0: number; x1: number; y0: number; y1: number }, scope = ""): string[] {
  const inside = new Map<string, boolean>();
  for (const shape of shapes.values()) {
    if ((shape.scope ?? "") !== scope) continue;
    let any = false;
    let all = true;
    for (let i = 0; i < shape.xs.length && all; i++) {
      const x = shape.xs[i];
      const y = shape.ys[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      any = true;
      if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) all = false;
    }
    if (!any) continue;
    inside.set(shape.fnId, (inside.get(shape.fnId) ?? true) && all);
  }
  return [...inside].filter(([, ok]) => ok).map(([id]) => id);
}
