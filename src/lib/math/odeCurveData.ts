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

  for (let i = 0; i < rows; i++) {
    const x = at(i, cx.value);
    const y = at(i, cy.value);
    if (!plottable(x, y)) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      parts.push(`M${x} ${y}`);
      penDown = true;
      continue;
    }

    const px = at(i - 1, cx.value);
    const py = at(i - 1, cy.value);
    const h = data[i * cols] - data[(i - 1) * cols];
    const dx0 = at(i - 1, cx.slope);
    const dy0 = at(i - 1, cy.slope);
    const dx1 = at(i, cx.slope);
    const dy1 = at(i, cy.slope);

    if (finite(dx0, dy0, dx1, dy1)) {
      const c1x = px + (h * dx0) / 3;
      const c1y = py + (h * dy0) / 3;
      const c2x = x - (h * dx1) / 3;
      const c2y = y - (h * dy1) / 3;
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
