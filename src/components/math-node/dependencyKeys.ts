import * as mathjs from "mathjs";
import type { MathFunction, MathVariable } from "./mathTypes";
import { parseOdeSystemCached } from "../../lib/math/odeSystem";

// Symbols in baseScope whose values never change between renders.
const STABLE_HELPERS = new Set([
  "Line",
  "Vector",
  "Polygon",
  "Point",
  "ln",
  "log10",
  "indexHelper",
]);

const isTimeSymbol = (s: string) => s === "t" || s === "time" || /^t_\w+$/.test(s);

interface ExprInfo {
  used: Set<string>;
  defined: Set<string>;
}

const infoCache = new Map<string, ExprInfo | null>();

function parseTolerant(expr: string): mathjs.MathNode | null {
  try {
    return mathjs.parse(expr);
  } catch {
    // Implicit relations like "x^2 + y^2 = 4" aren't valid assignments; read "=" as "==".
    try {
      return mathjs.parse(expr.replace(/(^|[^<>=!])=(?!=)/g, "$1=="));
    } catch {
      return null;
    }
  }
}

function analyzeExpr(expr: string): ExprInfo | null {
  const cached = infoCache.get(expr);
  if (cached !== undefined) return cached;

  const node = parseTolerant(expr);
  let info: ExprInfo | null = null;
  if (node) {
    const used = new Set<string>();
    const defined = new Set<string>();
    const params = new Set<string>();
    node.traverse((n: any) => {
      if (n.isSymbolNode) used.add(n.name);
      if (n.isAssignmentNode && n.object?.isSymbolNode) defined.add(n.object.name);
      if (n.isFunctionAssignmentNode) {
        defined.add(n.name);
        for (const p of n.params || []) params.add(p);
      }
    });
    for (const p of params) used.delete(p);
    for (const d of defined) used.delete(d);
    info = { used, defined };
  }

  if (infoCache.size > 500) infoCache.clear();
  infoCache.set(expr, info);
  return info;
}

// Symbols a row's own sweep binds per sample, so they aren't dependencies.
function sweepSymbols(f: MathFunction): string[] {
  if (f.type === "differential") {
    // The solver supplies t and every state variable.
    const system = parseOdeSystemCached(f.expr);
    return ["t", ...system.states.map((s) => s.id)];
  }
  switch (f.type) {
    case "function":
    case "implicit":
    case "inequality":
      return ["x", "y"];
    case "parametric":
      return ["t"];
    case "polar":
      return /\btheta\b|θ/.test(f.expr) ? ["theta", "θ", "x"] : ["t", "theta", "θ", "x"];
    default:
      return [];
  }
}

function rowExprs(f: MathFunction): string[] {
  if (f.type === "differential") {
    // ODE syntax isn't plain mathjs; analyze the pieces it compiles down to.
    const system = parseOdeSystemCached(f.expr);
    if (system.error) return [];
    return system.states.flatMap((s) => [s.derivative, s.initial || "0"]);
  }
  return [f.expr, f.expr2].filter((e): e is string => !!e && e.trim() !== "");
}

function rowNames(f: MathFunction): string[] {
  if (f.type === "differential") return []; // state names are internal to the solver
  const names: string[] = [];
  for (const raw of [f.name, f.label]) {
    const m = raw?.match(/^([a-zA-Z_Ͱ-Ͽ][\wͰ-Ͽ]*)/);
    if (m) names.push(m[1]);
  }
  for (const e of rowExprs(f)) {
    const info = analyzeExpr(e);
    if (info) info.defined.forEach((d) => names.push(d));
  }
  return names;
}

let uniqueCounter = 0;

function serialize(v: unknown): string {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v == null) return "∅";
  try {
    const anyV = v as any;
    if (typeof anyV.toArray === "function") return JSON.stringify(anyV.toArray());
    if (anyV.isComplex) return anyV.toString();
    return JSON.stringify(v);
  } catch {
    // Can't key it reliably; make the key unique so the caller recomputes.
    return `#${uniqueCounter++}`;
  }
}

/**
 * A string that changes exactly when anything the row's output depends on changes:
 * values of variables it references (directly, or transitively through other rows that
 * define names it uses, e.g. `k = 2*a` or `g(x) = a*x`), and time if it animates.
 * Rows that can't be analyzed fall back to "all variables + time", which is always safe.
 */
export function dependencyKey(
  f: MathFunction,
  functions: MathFunction[],
  baseScope: Record<string, any>,
  fTime: number,
  variables: MathVariable[],
): string {
  const fallback = () =>
    `ALL|${variables.map((v) => `${v.name}:${v.value}`).join(",")}|${baseScope.time}|${fTime}`;

  const definers = new Map<string, MathFunction>();
  for (const row of functions) {
    for (const n of rowNames(row)) if (!definers.has(n)) definers.set(n, row);
  }

  const leaves = new Set<string>();
  let usesTime = false;
  const visited = new Set<string>();
  const queue: MathFunction[] = [f];
  // Formulas of the other rows pulled in: editing `k = 2*a` must change the key even
  // though the value of `a` didn't.
  const upstreamExprs: string[] = [];

  while (queue.length > 0) {
    const row = queue.pop()!;
    if (visited.has(row.id)) continue;
    visited.add(row.id);

    const exprs = rowExprs(row);
    if (row.id !== f.id) upstreamExprs.push(`${row.id}:${row.type}:${exprs.join("¦")}`);
    if (exprs.length === 0) continue;
    const sweep = new Set(sweepSymbols(row));

    for (const e of exprs) {
      const info = analyzeExpr(e);
      if (!info) return fallback();
      for (const sym of info.used) {
        if (sweep.has(sym) || STABLE_HELPERS.has(sym)) continue;
        if (isTimeSymbol(sym)) {
          usesTime = true;
          leaves.add(sym);
          continue;
        }
        const def = definers.get(sym);
        if (def && def.id !== row.id) queue.push(def);
        else leaves.add(sym);
      }
    }
  }

  const parts: string[] = [];
  for (const sym of Array.from(leaves).sort()) {
    const v = baseScope[sym];
    if (v === undefined) continue; // mathjs builtin (sin, pi, …) or unbound
    if (typeof v === "function") {
      if (definers.has(sym)) continue; // its defining row was traversed above
      return fallback();
    }
    parts.push(`${sym}=${serialize(v)}`);
  }
  if (usesTime) parts.push(`@${fTime}:${baseScope.time}`);
  upstreamExprs.sort();
  return `${parts.join("|")}#${upstreamExprs.join("#")}`;
}
