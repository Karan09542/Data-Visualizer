import * as mathjs from "mathjs";

export interface FamilyRange {
  minExpr: string;
  maxExpr: string;
  stepExpr?: string;
}

export interface FamilyParseResult {
  isFamily: true;
  keyword: "family" | "sequence" | "seq" | "render" | "series" | "curves" | "list";
  variable: string;
  range: FamilyRange;
  expr: string;
  rawInner: string;
  fnSignature?: string;
}

export const FAMILY_KEYWORDS = [
  "family",
  "sequence",
  "seq",
  "render",
  "series",
  "curves",
  "list",
] as const;

/**
 * Splits an argument list by commas at top-level (ignoring commas inside
 * parentheses, brackets, and braces).
 */
export function splitTopLevelArgs(src: string): string[] {
  const args: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let current = "";

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depthParen++;
    else if (c === ")") depthParen = Math.max(0, depthParen - 1);
    else if (c === "[") depthBracket++;
    else if (c === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (c === "{") depthBrace++;
    else if (c === "}") depthBrace = Math.max(0, depthBrace - 1);

    if (c === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Checks if a string looks like a range specification:
 * e.g. "0:n", "0..n", "0:0.5:5", "i = 0:n", "i in 0..5", "0 to 5"
 */
function isRangeSpec(str: string): boolean {
  const s = str.trim();
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*(=|in)\s*.+/.test(s)) return true;
  if (s.includes("..") || s.includes(" to ")) return true;
  if (s.includes(":")) return true;
  return false;
}

/**
 * Parses a range string such as "0:n", "0:0.5:5", "-3:3", "0..n", "0 to 5",
 * or with variable assignment "i = 0:n".
 */
function parseRangeSpec(rangeStr: string): {
  variable?: string;
  minExpr: string;
  maxExpr: string;
  stepExpr?: string;
} | null {
  let s = rangeStr.trim();
  let variable: string | undefined;

  // Check for explicit variable, e.g. "i = 0:n" or "k in -5:5"
  const varMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|in)\s*(.+)$/);
  if (varMatch) {
    variable = varMatch[1].trim();
    s = varMatch[2].trim();
  }

  // Handle double-dot "0..n" or "0..1..10"
  if (s.includes("..")) {
    const parts = s.split(/\.\./).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      return { variable, minExpr: parts[0], maxExpr: parts[1] };
    }
    if (parts.length >= 3) {
      return { variable, minExpr: parts[0], stepExpr: parts[1], maxExpr: parts[2] };
    }
  }

  // Handle "0 to 5"
  if (/\bto\b/i.test(s)) {
    const parts = s.split(/\bto\b/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { variable, minExpr: parts[0], maxExpr: parts[1] };
    }
  }

  // Handle colon ":" separator, being careful with expressions like -3:3 or 0:0.5:5
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      return { variable, minExpr: parts[0], maxExpr: parts[1] };
    }
    if (parts.length >= 3) {
      // start : step : stop
      return { variable, minExpr: parts[0], stepExpr: parts[1], maxExpr: parts[2] };
    }
  }

  return null;
}

/**
 * Extracts free variable names from an expression, excluding standard math builtins and coords.
 */
function findFreeVariables(expr: string): string[] {
  const BUILTIN_IGNORE = new Set([
    "x", "y", "t", "time", "theta", "θ", "pi", "e", "phi",
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
    "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "sec", "csc", "cot", "asec", "acsc", "acot",
    "exp", "log", "ln", "log10", "log2", "sqrt", "cbrt", "abs", "sign",
    "min", "max", "round", "floor", "ceil", "pow", "mod",
  ]);

  const vars: string[] = [];
  const matches = expr.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
  for (const m of matches) {
    const name = m[1];
    if (!BUILTIN_IGNORE.has(name) && !vars.includes(name)) {
      vars.push(name);
    }
  }
  return vars;
}

/**
 * Cleans an expression argument, stripping optional "f(i) = " or "y = " prefix.
 */
function cleanExprSpec(raw: string): { expr: string; fnVar?: string; fnSignature?: string } {
  const s = raw.trim();

  // Pattern: f(i) = sin(x) + i  or  f_i(x) = sin(x) + i
  const fnMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*=\s*(.+)$/);
  if (fnMatch) {
    return {
      fnSignature: `${fnMatch[1]}(${fnMatch[2]})`,
      fnVar: fnMatch[2],
      expr: fnMatch[3].trim(),
    };
  }

  // Pattern: y = sin(x) + i
  const yMatch = s.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*(.+)$/);
  if (yMatch) {
    return {
      expr: yMatch[1].trim(),
    };
  }

  return { expr: s };
}

/**
 * Parses an equation string to see if it represents a family or sequence of curves:
 * e.g.:
 * - render(0:n, f(i) = sin(x) + i)
 * - family(0:n, f(i) = sin(x) + i)
 * - family(0:5, sin(x) + i)
 * - family(i = 0:n, sin(x) + i)
 * - family(0:0.5:5, sin(x) + i)
 * - sequence(0:n, sin(x) + i)
 * - seq(sin(x) + i, i, 0, n)
 */
export function parseFamilyExpression(raw: string): FamilyParseResult | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  const kwPattern = new RegExp(
    `^\\s*(${FAMILY_KEYWORDS.join("|")})\\s*\\(([\\s\\S]*)\\)\\s*$`,
    "i",
  );
  const kwMatch = trimmed.match(kwPattern);
  if (!kwMatch) return null;

  const keyword = kwMatch[1].toLowerCase() as FamilyParseResult["keyword"];
  const inner = kwMatch[2].trim();
  if (!inner) return null;

  const args = splitTopLevelArgs(inner);
  if (args.length === 0) return null;

  // Case 1: CAS syntax - sequence(expr, var, min, max, [step])
  if (args.length >= 4) {
    const exprArg = args[0];
    const varName = args[1].trim();
    const minExpr = args[2].trim();
    const maxExpr = args[3].trim();
    const stepExpr = args[4] ? args[4].trim() : undefined;

    const { expr, fnSignature } = cleanExprSpec(exprArg);
    return {
      isFamily: true,
      keyword,
      variable: varName || "i",
      range: { minExpr, maxExpr, stepExpr },
      expr,
      rawInner: inner,
      fnSignature,
    };
  }

  // Case 2: 2 arguments - (range, expr) or (expr, range)
  if (args.length === 2) {
    let rangeArg: string;
    let exprArg: string;

    if (isRangeSpec(args[0])) {
      rangeArg = args[0];
      exprArg = args[1];
    } else if (isRangeSpec(args[1])) {
      rangeArg = args[1];
      exprArg = args[0];
    } else {
      // Default: arg[0] is range, arg[1] is expr
      rangeArg = args[0];
      exprArg = args[1];
    }

    const parsedRange = parseRangeSpec(rangeArg);
    if (!parsedRange) return null;

    const { expr, fnVar, fnSignature } = cleanExprSpec(exprArg);

    // Determine the parameter variable
    let chosenVar = parsedRange.variable;
    if (!chosenVar && fnVar && !["x", "y", "t", "theta", "θ"].includes(fnVar)) {
      chosenVar = fnVar;
    }
    if (!chosenVar) {
      const freeVars = findFreeVariables(expr);
      if (freeVars.includes("i")) {
        chosenVar = "i";
      } else if (freeVars.length > 0) {
        chosenVar = freeVars[0];
      } else {
        chosenVar = "i";
      }
    }

    return {
      isFamily: true,
      keyword,
      variable: chosenVar,
      range: {
        minExpr: parsedRange.minExpr,
        maxExpr: parsedRange.maxExpr,
        stepExpr: parsedRange.stepExpr,
      },
      expr,
      rawInner: inner,
      fnSignature,
    };
  }

  // Case 3: 1 argument - e.g. family(0:5) without expr (unfinished input)
  return null;
}

/**
 * Evaluates the family's range in the current scope (e.g. evaluating dynamic
 * variables like `n`), returning the list of numeric values for the index variable.
 */
export function evaluateFamilyValues(
  family: FamilyParseResult,
  scope: any,
  maxCurves: number = 40,
): { values: number[]; error?: string } {
  try {
    const s = scope || {};

    let minVal = 0;
    try {
      const v = Number(mathjs.evaluate(family.range.minExpr, s));
      if (Number.isFinite(v)) minVal = v;
    } catch {
      minVal = 0;
    }

    let maxVal = 5;
    try {
      const v = Number(mathjs.evaluate(family.range.maxExpr, s));
      if (Number.isFinite(v)) maxVal = v;
    } catch {
      maxVal = 5;
    }

    let stepVal = 1;
    if (family.range.stepExpr) {
      try {
        const v = Number(mathjs.evaluate(family.range.stepExpr, s));
        if (Number.isFinite(v) && v !== 0) stepVal = Math.abs(v);
      } catch {
        stepVal = 1;
      }
    }

    let ascending = true;
    if (minVal > maxVal) {
      ascending = false;
      const tmp = minVal;
      minVal = maxVal;
      maxVal = tmp;
    }

    const values: number[] = [];
    const eps = 1e-9;
    for (
      let v = minVal;
      v <= maxVal + eps && values.length < maxCurves;
      v += stepVal
    ) {
      values.push(Math.round(v * 1e6) / 1e6);
    }

    if (values.length === 0) {
      values.push(minVal);
    }

    if (!ascending) {
      values.reverse();
    }

    return { values };
  } catch (err: any) {
    return { values: [0], error: err?.message || String(err) };
  }
}

/**
 * Typesets a family expression into clean LaTeX for preview.
 */
export function familyToLatex(
  family: FamilyParseResult,
  innerLatex?: string,
): string {
  const rangePart = family.range.stepExpr
    ? `${family.variable} = ${family.range.minExpr} : ${family.range.stepExpr} : ${family.range.maxExpr}`
    : `${family.variable} = ${family.range.minExpr} \\dots ${family.range.maxExpr}`;

  const body = innerLatex || family.expr;
  const label = family.fnSignature ? `${family.fnSignature} = ` : "";

  return `\\left\\{ ${label}${body} \\;\\middle|\\; ${rangePart} \\right\\}`;
}
