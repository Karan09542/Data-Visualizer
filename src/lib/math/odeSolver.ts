/** Result rows are [t, ...states, ...derivatives] so curves can be drawn as smooth
 *  Hermite segments without re-evaluating anything. */
export interface OdeSolution {
  data: Float64Array;
  /** Values per row: 1 + 2 * n. */
  cols: number;
  rows: number;
  /** Number of state variables. */
  n: number;
  /** True if the solution ran off to infinity (or undefined) before the end. */
  blewUp: boolean;
}

export type OdeDerivative = (t: number, y: Float64Array, out: Float64Array) => void;

/**
 * Keeps a solve responsive while a slider is being dragged: states × steps stays within
 * this budget. Each step evaluates every equation four times (RK4), and a mathjs
 * evaluation costs roughly 2µs, so this lands around 30ms in the worst case.
 */
export const ODE_WORK_BUDGET = 8000;

export function clampOdeSteps(steps: number, stateCount: number): number {
  const requested = Number.isFinite(steps) ? Math.round(steps) : 1000;
  const capped = Math.min(requested, Math.floor(ODE_WORK_BUDGET / Math.max(1, stateCount)));
  return Math.max(10, capped);
}

/**
 * Classic fixed-step Runge–Kutta (RK4). Once a value stops being finite the rest of the
 * solution is filled with NaN, which the renderer draws as the end of the curve.
 */
export function solveOdeRK4(
  deriv: OdeDerivative,
  y0: number[],
  t0: number,
  t1: number,
  steps: number,
): OdeSolution {
  const n = y0.length;
  const cols = 1 + 2 * n;
  const rows = steps + 1;
  const data = new Float64Array(rows * cols);

  const y = Float64Array.from(y0);
  const k1 = new Float64Array(n);
  const k2 = new Float64Array(n);
  const k3 = new Float64Array(n);
  const k4 = new Float64Array(n);
  const tmp = new Float64Array(n);

  const h = steps > 0 ? (t1 - t0) / steps : 0;
  let blewUp = false;

  const allFinite = (a: Float64Array) => {
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
    return true;
  };

  for (let step = 0; step < rows; step++) {
    const t = t0 + h * step;
    const rowStart = step * cols;

    if (blewUp || !allFinite(y)) {
      blewUp = true;
      data[rowStart] = t;
      for (let i = 1; i < cols; i++) data[rowStart + i] = NaN;
      continue;
    }

    deriv(t, y, k1);
    data[rowStart] = t;
    for (let i = 0; i < n; i++) {
      data[rowStart + 1 + i] = y[i];
      data[rowStart + 1 + n + i] = k1[i];
    }

    if (step === rows - 1) break;

    for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k1[i];
    deriv(t + h / 2, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k2[i];
    deriv(t + h / 2, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    deriv(t + h, tmp, k4);

    for (let i = 0; i < n; i++) {
      y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
  }

  return { data, cols, rows, n, blewUp };
}

/** State values at an arbitrary time, linearly interpolated between solved rows. */
export function sampleOdeAt(solution: OdeSolution, t: number): number[] | null {
  const { data, cols, rows, n } = solution;
  if (rows < 2) return null;
  const t0 = data[0];
  const t1 = data[(rows - 1) * cols];
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 === t0) return null;

  const clamped = Math.max(Math.min(t, Math.max(t0, t1)), Math.min(t0, t1));
  const pos = ((clamped - t0) / (t1 - t0)) * (rows - 1);
  const i = Math.max(0, Math.min(rows - 2, Math.floor(pos)));
  const frac = pos - i;

  const out: number[] = [];
  for (let s = 0; s < n; s++) {
    const a = data[i * cols + 1 + s];
    const b = data[(i + 1) * cols + 1 + s];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    out.push(a + (b - a) * frac);
  }
  return out;
}
