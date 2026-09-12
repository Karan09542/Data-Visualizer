import React, { useMemo } from "react";
import { usePaneContext, useTransformContext } from "mafs";

type Vec2 = [number, number];

// ─── Identity helpers for cache keys ───────────────────────────────────────────

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

/** Stable small id for an object (e.g. a compiled mathjs expression) to put in a key. */
export function objectId(obj: unknown): number {
  if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return 0;
  let id = objectIds.get(obj as object);
  if (id === undefined) {
    id = nextObjectId++;
    objectIds.set(obj as object, id);
  }
  return id;
}

const valueCache = new Map<string, { key: string; value: unknown }>();

/** Memoize an expensive per-row value (e.g. fill polygon points) across renders. */
export function cachedByKey<T>(slot: string, key: string, compute: () => T): T {
  const hit = valueCache.get(slot);
  if (hit && hit.key === key) return hit.value as T;
  const value = compute();
  if (valueCache.size > 400) valueCache.clear();
  valueCache.set(slot, { key, value });
  return value;
}

// ─── Sampler ───────────────────────────────────────────────────────────────────

// Same split-point hash as Mafs. A plain midpoint split aliases periodic functions
// (e.g. sin(pi*x)) against power-of-2 aligned pane ranges into a flat line.
function cheapHash(min: number, max: number) {
  const r = Math.sin(min * 12.9898 + max * 78.233) * 43758.5453;
  return 0.4 + 0.2 * (r - Math.floor(r));
}

const isFinitePoint = (p: Vec2) => Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Squared on-screen error that triggers subdivision; same visual tolerance as Mafs.
const MAX_ERROR_PX2 = 0.1;

export interface SampleOptions {
  minDepth: number;
  maxDepth: number;
  /** Pixels per world unit on each axis. */
  scaleX: number;
  scaleY: number;
  /** Finite values beyond these bounds are clamped when written (SVG precision). */
  clamp: [number, number, number, number];
}

/**
 * Adaptive sampling like Mafs' `sampleParametric`, but it starts a new path segment
 * (`M`) wherever the curve is undefined (NaN/±Infinity) or jumps (a discontinuity such
 * as tan(x), 1/x, floor(x) or a piecewise step) instead of joining it with a line.
 */
export function sampleCurvePath(
  fn: (t: number) => Vec2,
  domain: Vec2,
  { minDepth, maxDepth, scaleX, scaleY, clamp }: SampleOptions,
): string {
  const [cx0, cx1, cy0, cy1] = clamp;
  const parts: string[] = [];
  let penDown = false;
  let breakNext = false;

  const emit = (p: Vec2) => {
    if (!isFinitePoint(p)) {
      breakNext = true;
      return;
    }
    const x = p[0] < cx0 ? cx0 : p[0] > cx1 ? cx1 : p[0];
    const y = p[1] < cy0 ? cy0 : p[1] > cy1 ? cy1 : p[1];
    parts.push(`${penDown && !breakNext ? "L" : "M"}${x} ${y}`);
    penDown = true;
    breakNext = false;
  };

  const dist2 = (a: Vec2, b: Vec2) => {
    const dx = (a[0] - b[0]) * scaleX;
    const dy = (a[1] - b[1]) * scaleY;
    return dx * dx + dy * dy;
  };

  // Whether the straight segment a→b hides a jump rather than a steep continuous stretch:
  // keep bisecting toward the larger on-screen gap. A continuous curve's gap shrinks
  // quickly; a jump's gap stays about the same size however far we zoom in.
  const isJump = (ta: number, pa: Vec2, tb: number, pb: Vec2) => {
    const g0 = dist2(pa, pb);
    if (g0 < 4) return false; // under 2px, nothing visible to break
    for (let i = 0; i < 12; i++) {
      const tm = (ta + tb) / 2;
      const pm = fn(tm);
      if (!isFinitePoint(pm)) return true;
      const gl = dist2(pa, pm);
      const gr = dist2(pm, pb);
      if (gl >= gr) {
        tb = tm;
        pb = pm;
      } else {
        ta = tm;
        pa = pm;
      }
      // Gap fell below 50% of its starting size (0.25 on squared distances): continuous.
      if (Math.max(gl, gr) < 0.25 * g0) return false;
    }
    return true;
  };

  const subdivide = (a: number, b: number, depth: number, pa: Vec2, pb: Vec2) => {
    const h = cheapHash(a, b);
    const m = a + (b - a) * h;
    const pm = fn(m);
    const fa = isFinitePoint(pa);
    const fb = isFinitePoint(pb);
    const fm = isFinitePoint(pm);

    let deepen = false;
    if (depth < minDepth) {
      deepen = true;
    } else if (fa && fb && fm) {
      const lx = pa[0] + (pb[0] - pa[0]) * h;
      const ly = pa[1] + (pb[1] - pa[1]) * h;
      const tooCoarse = dist2(pm, [lx, ly]) > MAX_ERROR_PX2;
      if (depth < maxDepth) deepen = tooCoarse;
      // At max depth a→b is drawn straight; break it if that line would fake a jump.
      else if (tooCoarse && isJump(a, pa, b, pb)) breakNext = true;
    } else if (depth < maxDepth) {
      // Refine toward where the curve becomes undefined; skip spans undefined throughout.
      deepen = fa || fb || fm;
    } else if (fa && fb) {
      breakNext = true; // tiny undefined hole between two defined points
    }

    if (deepen) {
      subdivide(a, m, depth + 1, pa, pm);
      emit(pm);
      subdivide(m, b, depth + 1, pm, pb);
    }
  };

  const [tMin, tMax] = domain;
  const p0 = fn(tMin);
  const p1 = fn(tMax);
  emit(p0);
  subdivide(tMin, tMax, 0, p0, p1);
  emit(p1);
  return parts.join(" ");
}

// ─── Component ─────────────────────────────────────────────────────────────────

const quantize = (s: number) => 2 ** Math.round(Math.log2(Math.abs(s) || 1));

interface SmoothCurveProps {
  xy: (t: number) => Vec2;
  t: Vec2;
  /**
   * Must change whenever `xy`'s output could change. Samples are cached on it, so the
   * curve isn't re-sampled on every render (animation frame, unrelated slider, …).
   */
  sampleKey: string;
  color?: string;
  weight?: number;
  opacity?: number;
  style?: "solid" | "dashed";
  minSamplingDepth?: number;
  maxSamplingDepth?: number;
  svgPathProps?: React.SVGProps<SVGPathElement>;
}

/** Drop-in replacement for Mafs `Plot.Parametric` with caching and discontinuity breaks. */
export const SmoothCurve: React.FC<SmoothCurveProps> = ({
  xy,
  t,
  sampleKey,
  color,
  weight = 2,
  opacity = 1,
  style = "solid",
  minSamplingDepth = 8,
  maxSamplingDepth = 14,
  svgPathProps = {},
}) => {
  const { viewTransform } = useTransformContext();
  const pane = usePaneContext();
  const [xp0, xp1] = pane?.xPaneRange ?? [-10, 10];
  const [yp0, yp1] = pane?.yPaneRange ?? [-10, 10];

  // Quantized to powers of 2 so continuous wheel-zooming doesn't re-sample every tick.
  const scaleX = quantize(viewTransform[0]);
  const scaleY = quantize(viewTransform[4]);

  const d = useMemo(() => {
    const w = xp1 - xp0;
    const h = yp1 - yp0;
    return sampleCurvePath(xy, t, {
      minDepth: minSamplingDepth,
      maxDepth: maxSamplingDepth,
      scaleX,
      scaleY,
      clamp: [
        xp0 - Math.max(100, w * 10),
        xp1 + Math.max(100, w * 10),
        yp0 - Math.max(100, h * 10),
        yp1 + Math.max(100, h * 10),
      ],
    });
    // `xy` is deliberately not a dependency: `sampleKey` stands in for its output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey, t[0], t[1], minSamplingDepth, maxSamplingDepth, scaleX, scaleY, xp0, xp1, yp0, yp1]);

  if (!d) return null;

  return (
    <path
      d={d}
      strokeWidth={weight}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...svgPathProps}
      style={{
        stroke: color || "var(--mafs-fg)",
        strokeOpacity: opacity,
        strokeDasharray: style === "dashed" ? "var(--mafs-line-stroke-dash-style)" : undefined,
        vectorEffect: "non-scaling-stroke",
        transform: "var(--mafs-view-transform)",
        ...(svgPathProps.style || {}),
      }}
    />
  );
};
