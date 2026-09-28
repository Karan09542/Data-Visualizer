import { clampOdeSteps, solveOdeRK4, type OdeSolution } from "./odeSolver";
import type { OdeSystem } from "./odeSystem";

/** Solves a compiled system against a scope of variable values. */
export function solveCompiledOde(
  system: OdeSystem,
  derivatives: any[],
  initials: any[],
  scope: any,
  tRange: [number, number],
  steps: number,
): OdeSolution | null {
  const n = system.states.length;
  if (n === 0) return null;

  const work: any = Object.create(scope ?? {});

  const y0 = initials.map((compiled) => {
    try {
      const v = Number(compiled.evaluate(work));
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  });

  const deriv = (t: number, y: Float64Array, out: Float64Array) => {
    work.t = t;
    for (let i = 0; i < n; i++) work[system.states[i].id] = y[i];
    for (let i = 0; i < n; i++) {
      try {
        const v = Number(derivatives[i].evaluate(work));
        out[i] = Number.isFinite(v) ? v : NaN;
      } catch {
        out[i] = NaN;
      }
    }
  };

  return solveOdeRK4(deriv, y0, tRange[0], tRange[1], clampOdeSteps(steps, n));
}

/**
 * Where playback is on a solved interval [t0, t1]. It loops, but lands on t1 exactly
 * when time does, so a run that stops at the end shows the end, not the start again.
 */
export function odePlaybackTime(time: number, t0: number, t1: number): number {
  const span = t1 - t0;
  if (!(span > 0) || !Number.isFinite(time)) return NaN;
  const offset = (time - t0) % span;
  if (time > t0 && offset === 0) return t1;
  return t0 + ((offset + span) % span);
}

const solveCache = new Map<string, OdeSolution | null>();

/**
 * solveCompiledOde, cached by a key that changes whenever the solution could change.
 * The curve and the rows that follow the solution (see scope.ts) share one solve.
 */
export function solveCompiledOdeCached(
  cacheKey: string,
  system: OdeSystem,
  derivatives: any[],
  initials: any[],
  scope: any,
  tRange: [number, number],
  steps: number,
): OdeSolution | null {
  if (solveCache.has(cacheKey)) return solveCache.get(cacheKey)!;
  const solution = solveCompiledOde(system, derivatives, initials, scope, tRange, steps);
  if (solveCache.size > 60) solveCache.delete(solveCache.keys().next().value as string);
  solveCache.set(cacheKey, solution);
  return solution;
}

/** Where a drawn solution sits, in its own (untransformed) coordinates. */
export interface OdeExtent {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

// Published by the curve so the transform gizmos can be sized to the actual solution.
// Without it they fall back to a default radius, which makes resizing wildly sensitive.
const odeExtents = new Map<string, OdeExtent>();

export const setOdeExtent = (id: string, extent: OdeExtent) => {
  if (odeExtents.size > 200) odeExtents.clear();
  odeExtents.set(id, extent);
};

export const getOdeExtent = (id: string) => odeExtents.get(id);

export function computeOdeExtent(
  solution: OdeSolution,
  system: OdeSystem,
  axisX: string,
  axisY: string,
): OdeExtent | null {
  const cx = odeAxisColumns(system, axisX);
  const cy = odeAxisColumns(system, axisY);
  if (!cx || !cy) return null;

  const { data, cols, rows } = solution;
  const at = (row: number, col: number) => (col < 0 ? 1 : data[row * cols + col]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < rows; i++) {
    const x = at(i, cx.value);
    const y = at(i, cy.value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: Math.max((maxX - minX) / 2, 1e-6),
    ry: Math.max((maxY - minY) / 2, 1e-6),
  };
}

/** Column of a quantity's value and of its time-derivative, for one axis choice. */
export function odeAxisColumns(
  system: OdeSystem,
  axis: string,
): { value: number; slope: number } | null {
  if (axis === "t") return { value: 0, slope: -1 }; // dt/dt = 1
  const index = system.states.findIndex((s) => s.display === axis);
  if (index < 0) return null;
  return { value: 1 + index, slope: 1 + system.states.length + index };
}

/**
 * SVG path for a solution, as cubic Hermite segments (the slopes are known, so few
 * points draw a smooth curve). Starts a new segment wherever values stop being finite.
 */
export function buildOdePath(
  solution: OdeSolution,
  system: OdeSystem,
  axisX: string,
  axisY: string,
  /**
   * Optional translate/rotate/scale. It's affine, so applying it to the Bézier control
   * points transforms the curve exactly — no re-sampling needed.
   */
  transform?: (p: [number, number]) => [number, number],
): string {
  const cx = odeAxisColumns(system, axisX);
  const cy = odeAxisColumns(system, axisY);
  if (!cx || !cy) return "";

  const { data, cols, rows } = solution;
  const at = (row: number, col: number) => (col < 0 ? 1 : data[row * cols + col]);
  const finite = (...v: number[]) => v.every((n) => Number.isFinite(n));
  // A solution that runs away reaches enormous finite values before it becomes
  // infinite. Such coordinates can fail to render at all (and zooming multiplies
  // them), so treat anything past this as off the plot and end the segment.
  const PLOTTABLE_LIMIT = 1e6;
  const plottable = (...v: number[]) =>
    v.every((n) => Number.isFinite(n) && Math.abs(n) <= PLOTTABLE_LIMIT);

  const parts: string[] = [];
  let penDown = false;
  const map = (ax: number, ay: number): [number, number] =>
    transform ? transform([ax, ay]) : [ax, ay];

  for (let i = 0; i < rows; i++) {
    const [x, y] = map(at(i, cx.value), at(i, cy.value));
    if (!plottable(x, y)) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      parts.push(`M${x} ${y}`);
      penDown = true;
      continue;
    }

    const [px, py] = map(at(i - 1, cx.value), at(i - 1, cy.value));
    const h = data[i * cols] - data[(i - 1) * cols];
    const dx0 = at(i - 1, cx.slope);
    const dy0 = at(i - 1, cy.slope);
    const dx1 = at(i, cx.slope);
    const dy1 = at(i, cy.slope);

    if (finite(dx0, dy0, dx1, dy1)) {
      const [rawPx, rawPy] = [at(i - 1, cx.value), at(i - 1, cy.value)];
      const [rawX, rawY] = [at(i, cx.value), at(i, cy.value)];
      const [c1x, c1y] = map(rawPx + (h * dx0) / 3, rawPy + (h * dy0) / 3);
      const [c2x, c2y] = map(rawX - (h * dx1) / 3, rawY - (h * dy1) / 3);
      const span = Math.hypot(x - px, y - py) || 1e-9;
      const overshoot =
        Math.max(Math.hypot(c1x - px, c1y - py), Math.hypot(c2x - x, c2y - y)) / span;
      if (overshoot < 10 && plottable(c1x, c1y, c2x, c2y)) {
        parts.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`);
        continue;
      }
    }
    parts.push(`L${x} ${y}`);
  }

  return parts.join(" ");
}

/**
 * The drawn solution as tracer geometry: one vertex per solved row, plus the exact
 * point at any time. That point comes from the same cubic Hermite interpolation the
 * path is drawn with (a Bézier with controls p ± h·p'/3 is that Hermite cubic), so a
 * traced point sits on the drawn curve rather than on the chord between two rows.
 */
export function odeTraceGeometry(
  solution: OdeSolution,
  system: OdeSystem,
  axisX: string,
  axisY: string,
  transform?: (p: [number, number]) => [number, number],
): {
  xs: number[];
  ys: number[];
  ts: number[];
  at: (t: number) => [number, number];
} | null {
  const cx = odeAxisColumns(system, axisX);
  const cy = odeAxisColumns(system, axisY);
  if (!cx || !cy) return null;

  const { data, cols, rows } = solution;
  const at = (row: number, col: number) => (col < 0 ? 1 : data[row * cols + col]);
  const PLOTTABLE_LIMIT = 1e6;
  const map = (x: number, y: number): [number, number] =>
    transform ? transform([x, y]) : [x, y];

  const xs: number[] = [];
  const ys: number[] = [];
  const ts: number[] = [];
  for (let i = 0; i < rows; i++) {
    const [x, y] = map(at(i, cx.value), at(i, cy.value));
    const ok =
      Number.isFinite(x) && Number.isFinite(y) &&
      Math.abs(x) <= PLOTTABLE_LIMIT && Math.abs(y) <= PLOTTABLE_LIMIT;
    xs.push(ok ? x : NaN);
    ys.push(ok ? y : NaN);
    ts.push(data[i * cols]);
  }

  const hermite = (col: { value: number; slope: number }, i: number, s: number, h: number) => {
    const p0 = at(i, col.value);
    const p1 = at(i + 1, col.value);
    const m0 = at(i, col.slope);
    const m1 = at(i + 1, col.slope);
    if (!Number.isFinite(m0) || !Number.isFinite(m1)) return p0 + (p1 - p0) * s;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * p0 +
      (s3 - 2 * s2 + s) * h * m0 +
      (-2 * s3 + 3 * s2) * p1 +
      (s3 - s2) * h * m1
    );
  };

  const pointAt = (t: number): [number, number] => {
    if (rows < 2 || !Number.isFinite(t)) return [NaN, NaN];
    // Rows are in time order (the step can be negative for a backwards range).
    const first = data[0];
    const last = data[(rows - 1) * cols];
    const forward = last >= first;
    let lo = 0;
    let hi = rows - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const tm = data[mid * cols];
      if (forward ? tm <= t : tm >= t) lo = mid;
      else hi = mid;
    }
    const t0 = data[lo * cols];
    const h = data[hi * cols] - t0;
    if (h === 0) return map(at(lo, cx.value), at(lo, cy.value));
    const s = Math.max(0, Math.min(1, (t - t0) / h));
    const vx = axisX === "t" ? t0 + s * h : hermite(cx, lo, s, h);
    const vy = axisY === "t" ? t0 + s * h : hermite(cy, lo, s, h);
    return map(vx, vy);
  };

  return { xs, ys, ts, at: pointAt };
}
