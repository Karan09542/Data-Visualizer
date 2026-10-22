/**
 * Works out what kind of row an expression is from how it's written, like
 * Desmos: "y = x^2" is a function, "x^2 + y^2 = 4" an implicit curve,
 * "r = 1 + cos(θ)" polar, "[cos(t), sin(t)]" parametric, "A = [1, 2]" a point,
 * "y < sin(x)" a region and "x'' = -x" a differential equation.
 *
 * Returns null while the expression is too unfinished to tell (an empty side,
 * say), so the row keeps its type instead of flickering as you type.
 */
import * as mathjs from "mathjs";
import { splitRelation } from "./splitRelation";
import { parseFamilyExpression } from "./familyPlot";

export type InferredType =
  | "function"
  | "implicit"
  | "polar"
  | "parametric"
  | "point"
  | "vector"
  | "line"
  | "polygon"
  | "inequality"
  | "differential";

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FUNCTION_DEF = /^[A-Za-z_][A-Za-z0-9_]*\s*\([^()]*\)$/;
const ANGLE = new Set(["theta", "θ"]);

function parse(src: string): any | null {
  try {
    return mathjs.parse(src);
  } catch {
    return null;
  }
}

/** The variable names an expression uses (not function names). */
function symbolsOf(src: string, node = parse(src)): Set<string> {
  const names = new Set<string>();
  if (node) {
    node.traverse((n: any, _path: string, parent: any) => {
      if (n.isSymbolNode && !(parent?.isFunctionNode && parent.fn === n)) names.add(n.name);
    });
    return names;
  }
  // Unfinished input: pick out names that aren't followed by "(".
  for (const m of src.matchAll(/([A-Za-zθ_][A-Za-z0-9_]*)(\s*\()?/g)) if (!m[2]) names.add(m[1]);
  return names;
}

/** Whether "?" appears outside brackets: the whole expression is a piecewise choice. */
function hasTopLevelQuestion(expr: string): boolean {
  let depth = 0;
  for (const c of expr) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "?" && depth === 0) return true;
  }
  return false;
}

export function isComplexExpr(src: string, node?: any, scope?: any): boolean {
  if (!node) node = parse(src);
  if (!node) return false;
  const symbols = symbolsOf(src, node);
  if (symbols.has("x") || symbols.has("y")) return false;

  // If symbol i is present (or regex pattern \b[0-9]*i\b / \bi\b)
  if (symbols.has("i") || /\b[0-9]*\.?[0-9]*i\b/.test(src)) {
    return true;
  }

  // Check if expression calls complex functions: conj, complex, re, im, real, imag, arg, cis, polar
  let hasComplexFn = false;
  node.traverse((n: any) => {
    if (n.isFunctionNode && ["conj", "complex", "re", "im", "real", "imag", "arg", "cis", "polar"].includes(n.fn?.name)) {
      hasComplexFn = true;
    }
  });
  if (hasComplexFn) return true;

  // Check if evaluation yields a Complex number (e.g. sqrt(-4), e^(i*pi/4), complex(1, 2), z1 * z2)
  try {
    const evalScope: any = {
      i: mathjs.complex(0, 1),
      e: Math.E,
      pi: Math.PI,
      tau: 2 * Math.PI,
      sqrt: mathjs.sqrt,
      exp: mathjs.exp,
      complex: mathjs.complex,
      conj: mathjs.conj,
      re: mathjs.re,
      im: mathjs.im,
      real: mathjs.re,
      imag: mathjs.im,
      cis: (a: number) => mathjs.complex(Math.cos(a), Math.sin(a)),
      polar: (r: number, a: number) => mathjs.complex({ r, phi: a }),
      arg: mathjs.arg,
      abs: mathjs.abs,
      ...(scope || {}),
    };

    // If any symbol is unknown but looks like a complex variable (z, w, zeta, z1, z2, w1, etc.)
    for (const s of symbols) {
      if (!(s in evalScope) && /^(z|w|zeta|xi|omega)[0-9_]*$/i.test(s)) {
        evalScope[s] = mathjs.complex(1, 1);
      }
    }

    const val = node.compile().evaluate(evalScope);
    if (val && typeof val === "object" && (val.isComplex || ("re" in val && "im" in val))) {
      return Number.isFinite(Number(val.re)) && Number.isFinite(Number(val.im));
    }
  } catch {}
  return false;
}

/** What a value on its own draws as: a point, a list of points, a curve… */
function classifyValue(src: string, scope?: any): InferredType | null {
  const node = parse(src);
  if (!node) return null;
  let n = node;
  while (n.isParenthesisNode) n = n.content;

  if (n.isFunctionNode) {
    const fn = n.fn?.name;
    if (fn === "Vector") return "vector";
    if (fn === "Polygon") return "polygon";
    if (fn === "Line") return "line";
    if (fn === "Point") return "point";
  }
  if (n.isArrayNode) {
    const items: any[] = n.items;
    const symbols = symbolsOf(src, node);
    if (items.length >= 1 && items.every((i) => i.isArrayNode)) {
      return items.length === 2 ? "line" : items.length >= 3 ? "polygon" : "point";
    }
    // Check if items are complex numbers or nested arrays
    const allPointsOrComplex = items.length >= 1 && items.every(
      (item) => item.isArrayNode || isComplexExpr(item.toString(), undefined, scope)
    );
    if (allPointsOrComplex) {
      return items.length === 2 ? "line" : items.length >= 3 ? "polygon" : "point";
    }
    if (items.length === 2) {
      // A pair: a curve if it runs over a parameter, otherwise a point.
      if (symbols.has("t") || [...symbols].some((s) => ANGLE.has(s))) return "parametric";
      return "point";
    }
    // [A, B, C]: named points joined up.
    if (items.length >= 3 && items.every((i) => i.isSymbolNode)) return "polygon";
  }

  // Complex number expressions
  if (isComplexExpr(src, node, scope)) {
    const symbols = symbolsOf(src, node);
    const usesAngle = [...symbols].some((s) => ANGLE.has(s));
    if (usesAngle && !symbols.has("x") && !symbols.has("y")) {
      return "polar";
    }
    if (symbols.has("t")) {
      return "parametric";
    }
    return "point";
  }

  return null;
}

export function inferType(raw: string, scope?: any): InferredType | null {
  const expr = (raw ?? "").trim();
  if (!expr) return null;

  const family = parseFamilyExpression(expr);
  if (family) {
    return inferType(family.expr, scope) ?? "function";
  }

  // x' = …, x'' = … (a prime after a name): a differential equation.
  if (/[A-Za-z_θ][A-Za-z0-9_]*'+/.test(expr) && /=/.test(expr)) return "differential";

  const eq = splitRelation(expr, "implicit");
  if (eq) {
    const lhs = eq.lhs;
    const rhs = eq.rhs;
    if (!lhs || !rhs) return null;
    const rhsSymbols = symbolsOf(rhs);

    if (FUNCTION_DEF.test(lhs)) {
      const usesAngle = [...rhsSymbols].some((s) => ANGLE.has(s)) || lhs.includes("(theta)") || lhs.includes("(θ)");
      if (usesAngle && !rhsSymbols.has("x") && !rhsSymbols.has("y")) {
        return "polar";
      }
      if (isComplexExpr(rhs, undefined, scope) && (rhsSymbols.has("t") || lhs.includes("(t)"))) {
        return "parametric";
      }
      return "function"; // f(x) = …, a helper
    }
    if (NAME.test(lhs)) {
      if (lhs === "y") return rhsSymbols.has("y") ? "implicit" : "function";
      if (lhs === "x") return "implicit"; // x = f(y)
      if (lhs === "r" && !rhsSymbols.has("x") && !rhsSymbols.has("y")) return "polar";
      const usesAngle = [...rhsSymbols].some((s) => ANGLE.has(s));
      if (usesAngle && !rhsSymbols.has("x") && !rhsSymbols.has("y")) return "polar";
      const drawn = classifyValue(rhs, scope);
      if (drawn) return drawn;
      if (isComplexExpr(rhs, undefined, scope)) {
        if (rhsSymbols.has("t")) return "parametric";
        return "point";
      }
      if (rhsSymbols.has("x") && rhsSymbols.has("y")) return "implicit";
      return "function"; // a curve in x, or a named value (k = 2)
    }
    return "implicit"; // both sides are expressions: x^2 + y^2 = 4
  }

  // Top-level "?": a piecewise function, whatever its condition compares.
  if (hasTopLevelQuestion(expr)) return "function";

  if (splitRelation(expr, "inequality")) return "inequality";

  const drawn = classifyValue(expr, scope);
  if (drawn) return drawn;

  const symbols = symbolsOf(expr);
  const usesAngle = [...symbols].some((s) => ANGLE.has(s));
  if (usesAngle && !symbols.has("x") && !symbols.has("y")) return "polar";

  if (isComplexExpr(expr, undefined, scope)) {
    if (symbols.has("t")) return "parametric";
    return "point";
  }
  if (symbols.has("x") && symbols.has("y")) return "implicit"; // f(x, y) = 0
  if (symbols.has("y") && !symbols.has("x")) return "implicit";
  return "function";
}

/** How each type reads in the row's type menu. */
export const TYPE_LABELS: Record<InferredType, string> = {
  function: "y =",
  implicit: "XY =",
  polar: "r =",
  parametric: "[x,y] =",
  point: "P =",
  vector: "V =",
  line: "Line =",
  polygon: "Poly =",
  inequality: "Ineq =",
  differential: "x′ =",
};
