/**
 * The values every row is evaluated against, built once per render:
 * sliders, time, helpers, then each row in order so later rows can use what earlier
 * rows define (`vx = v0*cos(a)`, `B = [vx*t, ...]`).
 *
 * Differential equations take part too: a solved row publishes its state at the
 * current time (x, and x' as dx), so a mass, bob or ball can be drawn wherever the
 * solution says it is.
 *
 * Kept free of React so the drag solver can rebuild it with trial slider values.
 */
import * as mathjs from "mathjs";
import type { MathFunction, MathVariable } from "./mathTypes";
import { indexHelper, normalizeGeometryValue, resolveGeometryPoints } from "./mathHelpers";
import { dependencyKey } from "./dependencyKeys";
import { objectId } from "./SmoothCurve";
import { odeExportName, parseOdeSystemCached } from "../../lib/math/odeSystem";
import { sampleOdeAt, type OdeSolution } from "../../lib/math/odeSolver";
import { odePlaybackTime, solveCompiledOdeCached } from "../../lib/math/odeCurveData";

type Vec2 = [number, number];

/** Names a solved row never publishes: they already mean something everywhere. */
const RESERVED = new Set(["t", "time", "pi", "e", "i"]);

export interface ScopeOptions {
  /** Slider values to use instead of the current ones (the drag solver's guesses). */
  overrides?: Record<string, number>;
  /**
   * Follow the last solution of each differential row instead of solving again. The
   * drag solver evaluates hundreds of guesses per mouse move and can't afford a solve
   * for each; at the start of a run it needs none anyway (starting values are exact).
   */
  reuseOdeSolutions?: boolean;
}

const lastSolution = new Map<string, OdeSolution | null>();

const rowTime = (f: MathFunction, time: number) =>
  f.hasCustomTimeline ? (f.time !== undefined ? f.time : 0) : time;

/** The solved interval of a differential row. */
export function odeRange(f: MathFunction): [number, number] {
  const t0 = f.tRange?.[0] ?? f.compiledOde?.system.t0 ?? 0;
  const t1 = f.tRange?.[1] ?? (f.compiledOde?.system.t0 ?? 0) + 10;
  return [t0, t1];
}

/** Cache key for a differential row's solve; shared with the drawn curve. */
export function odeSolveKey(
  f: MathFunction,
  functions: MathFunction[],
  scope: any,
  fTime: number,
  variables: MathVariable[],
): string {
  const [t0, t1] = odeRange(f);
  return `${f.id}|${objectId(f.compiledOde)}|${dependencyKey(f, functions, scope, fTime, variables)}|${t0},${t1}|${f.odeSteps ?? 1000}`;
}

function publishOdeState(
  f: MathFunction,
  scope: any,
  fTime: number,
  functions: MathFunction[],
  variables: MathVariable[],
  taken: Set<string>,
  options: ScopeOptions,
) {
  const ode = f.compiledOde;
  if (!ode || ode.system.error || ode.system.states.length === 0) return;
  const [t0, t1] = odeRange(f);
  const at = odePlaybackTime(fTime, t0, t1);
  if (!Number.isFinite(at)) return;

  let values: number[] | null = null;
  if (at - t0 < 1e-9) {
    // At the start the state is just the starting values: no solve needed.
    const work = Object.create(scope);
    values = ode.initials.map((c) => {
      try {
        const v = Number(c.evaluate(work));
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    });
  } else {
    let solution: OdeSolution | null | undefined;
    if (options.reuseOdeSolutions) {
      solution = lastSolution.get(f.id);
    } else {
      solution = solveCompiledOdeCached(
        odeSolveKey(f, functions, scope, fTime, variables),
        ode.system,
        ode.derivatives,
        ode.initials,
        scope,
        [t0, t1],
        f.odeSteps ?? 1000,
      );
      if (lastSolution.size > 100) lastSolution.clear();
      lastSolution.set(f.id, solution);
    }
    values = solution ? sampleOdeAt(solution, at) : null;
  }
  if (!values) return;

  ode.system.states.forEach((state, i) => {
    const name = odeExportName(state);
    if (taken.has(name) || RESERVED.has(name)) return;
    taken.add(name);
    scope[name] = values![i];
  });
}

/** Everything rows are evaluated against at `time`. */
export function buildBaseScope(
  functions: MathFunction[],
  variables: MathVariable[],
  time: number,
  options: ScopeOptions = {},
): any {
  // theta defaults to 0 so non-polar expressions that mention it still evaluate, but a
  // user variable named theta must win (polar sweeps bind theta per sample anyway).
  const baseScope: any = { theta: 0 };
  const overrides = options.overrides;
  for (const v of variables) {
    baseScope[v.name] = overrides && v.name in overrides ? overrides[v.name] : v.value;
  }
  baseScope.t = time;
  baseScope.time = time;
  baseScope.ln = mathjs.log;
  baseScope.log10 = mathjs.log10;
  baseScope.indexHelper = indexHelper;

  // Geometry constructors
  baseScope.Line = (...args: any[]) => args;
  baseScope.Vector = (...args: any[]) => args;
  baseScope.Polygon = (...args: any[]) => args;
  baseScope.Point = (...args: any[]) => args;

  // Individual timelines as pre-defined variables (t_1, t_2, t_<name>)
  functions.forEach((f, idx) => {
    const fTime = rowTime(f, time);
    baseScope[`t_${idx + 1}`] = fTime;
    if (f.name) {
      const match = f.name.match(/^([a-zA-Z0-9_]+)/);
      const fnId = match ? match[1] : f.name;
      if (fnId && fnId !== "t" && fnId !== "time") {
        baseScope[`t_${fnId}`] = fTime;
      }
    }
  });

  // Names a solved row may not claim: sliders always win.
  const taken = new Set(variables.map((v) => v.name));

  // Evaluate rows in order so definitions are available to the rows after them.
  functions.forEach((f) => {
    const fTime = rowTime(f, time);
    if (f.type === "differential") {
      publishOdeState(f, baseScope, fTime, functions, variables, taken, options);
      return;
    }
    if (!f.compiled) return;
    try {
      const fScope = Object.create(baseScope);
      fScope.t = fTime;
      fScope.time = time;

      const val = f.compiled.evaluate(fScope);

      // Propagate names the row assigned (k = 2, f(s) = …) to later rows.
      for (const key of Object.keys(fScope)) {
        if (key !== "t" && key !== "time" && key !== "theta" && key !== "x" && key !== "y") {
          baseScope[key] = fScope[key];
        }
      }

      // A live readout label ("t = {{clock}} s") is text, not a name.
      const refName = f.label && !f.label.includes("{{") ? f.label : f.name;
      if (refName) {
        baseScope[refName] = ["point", "line", "vector", "polygon"].includes(f.type)
          ? normalizeGeometryValue(val)
          : val;
      }
    } catch (e) { }
  });

  return baseScope;
}

// ─── Row kinds ────────────────────────────────────────────────────────────────

const parseCache = new Map<string, any>();

function parseCached(expr: string): any {
  if (parseCache.has(expr)) return parseCache.get(expr);
  let node: any = null;
  try {
    node = mathjs.parse(expr);
  } catch {
    node = null;
  }
  if (parseCache.size > 500) parseCache.clear();
  parseCache.set(expr, node);
  return node;
}

/** Names the differential rows publish (x, dx, theta, …). */
export function publishedOdeNames(functions: MathFunction[]): Set<string> {
  const names = new Set<string>();
  for (const f of functions) {
    if (f.type !== "differential") continue;
    const system = parseOdeSystemCached(f.expr);
    if (system.error) continue;
    for (const s of system.states) names.add(odeExportName(s));
  }
  return names;
}

/**
 * The name a "function" row defines instead of plotting, like Desmos: `T = 2*v0/g`
 * or `pos(s) = A*cos(w*s)`. `y = …`, and anything using x, still plot as curves,
 * unless x is a solved quantity a differential row publishes (`pos = 4 + x`).
 */
export function definitionName(f: MathFunction, functions: MathFunction[] = []): string | null {
  if (f.type !== "function" || !f.expr) return null;
  const node = parseCached(f.expr);
  if (!node) return null;
  if (node.isFunctionAssignmentNode) return `${node.name}(${(node.params || []).join(", ")})`;
  if (node.isAssignmentNode && node.object?.isSymbolNode) {
    const name = node.object.name;
    if (name === "y" || name === "x") return null;
    const solved = publishedOdeNames(functions);
    let usesXY = false;
    node.value.traverse((n: any) => {
      if (n.isSymbolNode && (n.name === "x" || n.name === "y") && !solved.has(n.name)) usesXY = true;
    });
    return usesXY ? null : name;
  }
  return null;
}

export const isDefinitionRow = (f: MathFunction, functions: MathFunction[] = []) =>
  definitionName(f, functions) !== null;

/** `Vector(tail, tip)`: an arrow that starts somewhere other than the origin. */
export function isTailTipVector(f: MathFunction): boolean {
  if (f.type !== "vector" || !f.expr) return false;
  let node = parseCached(f.expr);
  if (!node) return false;
  if (node.isAssignmentNode) node = node.value;
  return !!(node.isFunctionNode && node.fn?.name === "Vector" && node.args?.length === 2);
}

/**
 * Where a row's drag handle sits: a point itself, or the tip of an arrow.
 * Null if the row can't be a handle or doesn't evaluate.
 */
export function handlePosition(f: MathFunction, scope: any): Vec2 | null {
  if (f.type !== "point" && f.type !== "vector") return null;
  const { points } = resolveGeometryPoints(f, scope);
  if (points.length === 0) return null;
  if (f.type === "point" && points.length !== 1) return null;
  const tip = points[points.length - 1];
  return Number.isFinite(tip[0]) && Number.isFinite(tip[1]) ? tip : null;
}
