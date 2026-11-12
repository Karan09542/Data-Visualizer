/**
 * Turns a drag on the canvas back into slider values.
 *
 * A handle is any point whose position is a formula of some variables, e.g. the tip of
 * a launch arrow at [v0*cos(a), v0*sin(a)]. When it is dragged to a new spot we look for
 * the variable values that put the formula there. That is a small least-squares problem,
 * solved with damped Gauss–Newton (Levenberg–Marquardt) on a finite-difference Jacobian,
 * so it works for any formula without the user writing the inverse by hand:
 *
 *   - two variables and a point → usually an exact solve (polar arrow, free point)
 *   - one variable → the handle slides along the path that variable traces
 *     (a bob on its circle, a cart on its track)
 *
 * Values are kept inside each variable's slider range, so a handle stops at the edge
 * of what the slider allows instead of running off.
 */

export interface DragVariable {
  value: number;
  min: number;
  max: number;
  step?: number;
}

/** A point of the plane or of space. */
type Vec = number[];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Solves the small symmetric system A·x = b by Gaussian elimination; null if singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-300) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Variable values that bring `evaluate(values)` as close as possible to `target`.
 * Returns null when the handle's position can't be evaluated at all.
 */
export function solveDrag(
  evaluate: (values: number[]) => Vec | null,
  vars: DragVariable[],
  target: Vec,
  maxIterations = 40,
): number[] | null {
  const n = vars.length;
  if (n === 0) return null;

  const lo = vars.map((v) => Math.min(v.min, v.max));
  const hi = vars.map((v) => Math.max(v.min, v.max));
  const project = (x: number[]) => x.map((v, i) => clamp(v, lo[i], hi[i]));

  const dims = target.length;
  const residual = (x: number[]): Vec | null => {
    const p = evaluate(x);
    if (!p || p.length < dims) return null;
    const out: number[] = [];
    for (let d = 0; d < dims; d++) {
      if (!Number.isFinite(p[d])) return null;
      out.push(p[d] - target[d]);
    }
    return out;
  };
  const dot = (a: Vec, b: Vec) => {
    let sum = 0;
    for (let d = 0; d < dims; d++) sum += a[d] * b[d];
    return sum;
  };
  const cost = (r: Vec) => dot(r, r);
  const scaled = (a: Vec, b: Vec, h: number) => a.map((v, d) => (v - b[d]) / h);

  let x = project(vars.map((v) => (Number.isFinite(v.value) ? v.value : 0)));
  let r = residual(x);
  if (!r) return null;
  let c = cost(r);
  let lambda = 1e-3;

  for (let iter = 0; iter < maxIterations && c > 1e-14; iter++) {
    // Jacobian columns by central differences, sized to each slider's range.
    const J: Vec[] = [];
    for (let i = 0; i < n; i++) {
      const span = hi[i] - lo[i];
      const h = Math.max(1e-7, (Number.isFinite(span) && span > 0 ? span : Math.abs(x[i]) + 1) * 1e-5);
      const xp = [...x];
      const xm = [...x];
      xp[i] += h;
      xm[i] -= h;
      const rp = residual(xp);
      const rm = residual(xm);
      if (rp && rm) J.push(scaled(rp, rm, 2 * h));
      else if (rp) J.push(scaled(rp, r!, h));
      else if (rm) J.push(scaled(r!, rm, h));
      else J.push(new Array(dims).fill(0));
    }

    // Normal equations (JᵀJ + λ·diag(JᵀJ)) δ = -Jᵀr
    const JtJ: number[][] = [];
    const Jtr: number[] = [];
    for (let i = 0; i < n; i++) {
      JtJ.push([]);
      for (let j = 0; j < n; j++) JtJ[i].push(dot(J[i], J[j]));
      Jtr.push(-dot(J[i], r));
    }
    if (JtJ.every((row, i) => Math.abs(row[i]) < 1e-18)) break; // handle doesn't move with these variables

    let improved = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const A = JtJ.map((row, i) =>
        row.map((v, j) => (i === j ? v + lambda * (v + 1e-12) : v)),
      );
      const delta = solveLinear(A, Jtr);
      if (!delta) {
        lambda *= 10;
        continue;
      }
      const next = project(x.map((v, i) => v + delta[i]));
      const rNext = residual(next);
      if (rNext && cost(rNext) < c) {
        x = next;
        r = rNext;
        c = cost(rNext);
        lambda = Math.max(lambda / 3, 1e-9);
        improved = true;
        break;
      }
      lambda *= 4;
    }
    if (!improved) break;
  }

  return x;
}

/** Rounds to the slider's step (so readouts stay tidy) without leaving its range. */
export function snapToStep(value: number, v: DragVariable): number {
  const lo = Math.min(v.min, v.max);
  const hi = Math.max(v.min, v.max);
  const step = v.step && v.step > 0 ? v.step : 0;
  let out = value;
  if (step) {
    out = lo + Math.round((value - lo) / step) * step;
    // Trim float noise like 0.30000000000000004 using the step's own precision.
    const decimals = Math.min(10, (String(step).split(".")[1] || "").length + 2);
    out = Number(out.toFixed(decimals));
  }
  return clamp(out, lo, hi);
}
