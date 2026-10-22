/**
 * mathHelpers.ts — Pure math/geometry helper functions extracted from MathNodeRenderer.
 * These are used both on the main thread and potentially reused elsewhere.
 */
import * as mathjs from "mathjs";
import { MathFunction, formatMathError } from "./mathTypes";
import { parseFamilyExpression } from "./familyPlot";

// ─── AST helpers ──────────────────────────────────────────────────────────────

export const resolveNestedValue = (val: any): any => {
  if (!val) return val;
  if (typeof val.toArray === "function") {
    val = val.toArray();
  }
  if (Array.isArray(val)) {
    return val.map((item) => resolveNestedValue(item));
  }
  return val;
};

export const indexHelper = (obj: any, ...indices: any[]) => {
  let current = obj;
  if (current && typeof current.toArray === "function") {
    current = current.toArray();
  }
  current = resolveNestedValue(current);

  for (let idx of indices) {
    if (idx && typeof idx.toArray === "function") {
      idx = idx.toArray();
    }
    if (Array.isArray(current)) {
      const numIdx = Number(idx);
      if (!isNaN(numIdx)) {
        current = current[numIdx - 1];
      } else {
        return undefined;
      }
    } else if (current && typeof current === "object") {
      current = current[idx];
    } else {
      return undefined;
    }
  }
  return current;
};

// ─── Expression compilation ───────────────────────────────────────────────────

export const parseAndAdjustForCompile = (exprStr: string): any => {
  const family = parseFamilyExpression(exprStr);
  const targetExpr = family ? family.expr : exprStr;
  const node = mathjs.parse(targetExpr);
  const transformNode = (n: any): any => {
    let mapped = n.map(transformNode);
    if (mapped.isFunctionNode) {
      try {
        if (mapped.fn.name === "derivative") {
           let arg0 = mapped.args[0];
           let arg1 = mapped.args[1];
           if (arg0 && arg0.isConstantNode && typeof arg0.value === 'string') {
             arg0 = mathjs.parse(arg0.value);
           }
           if (arg1 && arg1.isConstantNode && typeof arg1.value === 'string') {
             arg1 = mathjs.parse(arg1.value);
           }
           const res = (mathjs as any).derivative(arg0, arg1);
           if (res && (res.isNode || res.type)) {
             mapped = res.map(transformNode);
           }
        } else if (mapped.fn.name === "simplify") {
           const res = (mathjs as any).simplify(mapped.args[0]);
           if (res && (res.isNode || res.type)) {
             mapped = res.map(transformNode);
           }
        } else if (mapped.fn.name === "rationalize") {
           const res = (mathjs as any).rationalize(mapped.args[0]);
           if (res && (res.isNode || res.type)) {
             mapped = res.map(transformNode);
           }
        }
      } catch (e) {
        // Ignore errors during pre-evaluation
      }
    }
    if (mapped.type === "AccessorNode" || mapped.isAccessorNode) {
      return new (mathjs as any).FunctionNode("indexHelper", [
        mapped.object,
        ...mapped.index.dimensions,
      ]);
    }
    return mapped;
  };
  return transformNode(node);
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const getNumericCoordinate = (val: any): number | null => {
  while (Array.isArray(val) && val.length === 1) {
    val = val[0];
  }
  return typeof val === "number" && Number.isFinite(val) ? val : null;
};

export const extractPointsFromValue = (val: any): [number, number][] => {
  if (val == null) return [];

  // mathjs Complex number or object with re and im
  if (typeof val === "object" && !Array.isArray(val)) {
    if (val.isComplex || ("re" in val && "im" in val)) {
      const re = Number(val.re);
      const im = Number(val.im);
      if (Number.isFinite(re) && Number.isFinite(im)) {
        return [[re, im]];
      }
    }
  }

  if (Array.isArray(val) && val.length === 2) {
    const x = getNumericCoordinate(val[0]);
    const y = getNumericCoordinate(val[1]);
    if (x !== null && y !== null) {
      return [[x, y]];
    }
  }

  if (Array.isArray(val)) {
    const points: [number, number][] = [];
    for (const item of val) {
      points.push(...extractPointsFromValue(item));
    }
    return points;
  }

  return [];
};

export const normalizeGeometryValue = (val: any): any => {
  const resolved = resolveNestedValue(val);
  // Keep mathjs Complex objects intact so subsequent expressions can use complex math
  if (
    resolved &&
    typeof resolved === "object" &&
    (resolved.isComplex || ("re" in resolved && "im" in resolved))
  ) {
    return resolved;
  }
  const points = extractPointsFromValue(resolved);
  if (points.length === 1) return points[0];
  if (points.length > 1) return points;
  return resolved;
};

export const deduplicatePoints = (pts: [number, number][]): [number, number][] => {
  const result: [number, number][] = [];
  for (const p of pts) {
    if (result.length === 0) {
      result.push(p);
    } else {
      const last = result[result.length - 1];
      const isDuplicate = Math.abs(last[0] - p[0]) < 1e-5 && Math.abs(last[1] - p[1]) < 1e-5;
      if (!isDuplicate) {
        result.push(p);
      }
    }
  }
  if (result.length > 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-5 && Math.abs(first[1] - last[1]) < 1e-5) {
      result.pop();
    }
  }
  return result;
};

export const resolveGeometryPoints = (
  f: MathFunction,
  baseScope: any,
): { points: [number, number][]; error?: string } => {
  if (!f.compiled) {
    return { points: [], error: f.error };
  }

  try {
    const evaluated = f.compiled.evaluate(baseScope);
    const rawData = resolveNestedValue(evaluated);
    const points = extractPointsFromValue(rawData);
    const cleanedPoints = deduplicatePoints(points);

    if (cleanedPoints.length === 0) {
      return { points: [], error: "No valid geometry coordinates found." };
    }

    return { points: cleanedPoints };
  } catch (e: any) {
    const formattedError = formatMathError(e.message || String(e));
    return { points: [], error: formattedError };
  }
};

export const computePCA = (points: [number, number][]) => {
  if (points.length < 2)
    return {
      center: points[0] || ([0, 0] as [number, number]),
      u: [1, 0] as [number, number],
      v: [0, 1] as [number, number],
    };

  let cx = 0,
    cy = 0;
  for (let p of points) {
    cx += p[0];
    cy += p[1];
  }
  cx /= points.length;
  cy /= points.length;

  let cxx = 0,
    cxy = 0,
    cyy = 0;
  for (let p of points) {
    let dx = p[0] - cx;
    let dy = p[1] - cy;
    cxx += dx * dx;
    cxy += dx * dy;
    cyy += dy * dy;
  }
  cxx /= points.length;
  cxy /= points.length;
  cyy /= points.length;

  let trace = cxx + cyy;
  let det = cxx * cyy - cxy * cxy;
  let desc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  let lambda1 = trace / 2 + desc;

  let ux = 0,
    uy = 0;
  if (Math.abs(cxy) > 1e-6) {
    ux = lambda1 - cyy;
    uy = cxy;
  } else {
    ux = 1;
    uy = 0;
    if (cyy > cxx) {
      ux = 0;
      uy = 1;
    }
  }
  let uLen = Math.sqrt(ux * ux + uy * uy);
  if (uLen > 0) {
    ux /= uLen;
    uy /= uLen;
  } else {
    ux = 1;
    uy = 0;
  }

  let vx = -uy,
    vy = ux;
  return {
    center: [cx, cy] as [number, number],
    u: [ux, uy] as [number, number],
    v: [vx, vy] as [number, number],
  };
};

export const decoupleGeometry = (f: MathFunction, baseScope: any) => {
  if (
    f.type !== "point" &&
    f.type !== "vector" &&
    f.type !== "polygon" &&
    f.type !== "line"
  ) {
    return { newExpr: f.expr, changed: false };
  }
  let changed = false;
  let newExpr = f.expr;
  if (f.compiled) {
    try {
      const node = mathjs.parse(f.expr) as any;
      let rightSide = node.isAssignmentNode ? node.value : node;

      let hasSymbol = false;
      rightSide.traverse((n: any) => {
        if (n.isSymbolNode) hasSymbol = true;
      });

      if (hasSymbol) {
        const data = f.compiled.evaluate(baseScope);
        const arr = data.toArray ? data.toArray() : data;

        if (Array.isArray(arr) && arr.length > 0) {
          let isSinglePoint = false;
          let ptsToTransform = arr;

          if (!Array.isArray(arr[0])) {
            isSinglePoint = true;
            ptsToTransform = [arr];
          } else if (
            Array.isArray(arr[0]) &&
            arr[0].length === 1 &&
            typeof arr[0][0] === "number"
          ) {
            if (arr.length === 2 && arr[1] && arr[1].length === 1) {
              isSinglePoint = true;
              ptsToTransform = [[arr[0][0], arr[1][0]]];
            }
          }

          const match = f.expr.match(/^([^=]+=\s*)/);
          const prefix = match ? match[1] : "";

          if (isSinglePoint) {
            const p = ptsToTransform[0];
            if (f.expr.includes("[[")) {
              newExpr = `${prefix}[[${p[0].toFixed(2)}], [${p[1].toFixed(2)}]]`;
            } else {
              newExpr = `${prefix}[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`;
            }
          } else {
            const ptStrs = ptsToTransform
              .map((p: any) => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`)
              .join(", ");
            newExpr = `${prefix}[${ptStrs}]`;
          }
          changed = true;
        }
      }
    } catch (e) {}
  }
  return { newExpr, changed };
};

/**
 * Normalizes user-typed filter expressions into mathjs-compatible syntax.
 * Supports:
 * - filter(...) or filter: ... prefixes
 * - '===' / '!==' to '==' / '!='
 * - standalone '=' to '=='
 * - '&&' / '||' to 'and' / 'or'
 */
export function normalizeFilter(str: string): string {
  let s = str.trim();
  const filterMatch = s.match(/^filter\s*[:(]\s*(.*?)\s*\)?$/i);
  if (filterMatch) {
    s = filterMatch[1];
  }
  s = s.replace(/===/g, "==").replace(/!==/g, "!=");
  s = s.replace(/(?<![=<>!])=(?!=)/g, "==");
  s = s.replace(/&&/g, " and ").replace(/\|\|/g, " or ");
  return s;
}

export interface EvaluatedStepResult {
  valid: boolean;
  value: number;
  formattedValue?: string;
  filterExpr?: string;
  isFilter?: boolean;
}

/**
 * Evaluates an axis step size expression into a positive real number or a filter expression.
 * Supports:
 * - Numbers ("0.5", "2"), fractions ("1/2", "3/4"), constants ("pi", "π", "tau", "τ", "e")
 * - Implicit multiplication ("2pi", "0.5pi", "2π", "3pi/2", "2sqrt(3)")
 * - Functions ("sqrt(2)", "2^0.5") and variables in extraScope
 * - Filters ("n%5 == 0", "n%5=0", "filter(n%5 == 0)", "n > 0", "n%2 == 0", "abs(n) <= 5")
 * - Combined step and filter ("1; n%5 == 0", "2, n%4 == 0", "pi/2; n%2 == 0")
 */
export function evaluateStepExpression(
  exprStr: string,
  extraScope?: Record<string, any>
): EvaluatedStepResult {
  if (!exprStr || !exprStr.trim()) {
    return { valid: false, value: 1 };
  }

  const trimmed = exprStr.trim();
  let stepStr = "";
  let filterStr = "";

  // Check for combined 'step; filter' or 'filter; step' (also allowing comma or pipe)
  const sepMatch = trimmed.match(/^([^;,|]+)[;,|](.+)$/);
  if (sepMatch) {
    let p1 = sepMatch[1].trim();
    let p2 = sepMatch[2].trim();
    if (/(^filter\s*[:(]|==|!=|<=|>=|<|>|\b[nxyk]\s*%|%\s*\d|\b[nxyk]\b)/i.test(p1)) {
      filterStr = p1;
      stepStr = p2.replace(/^step\s*[:=]\s*/i, "");
    } else {
      stepStr = p1.replace(/^step\s*[:=]\s*/i, "");
      filterStr = p2.replace(/^filter\s*[:=]\s*/i, "");
    }
  } else {
    // Single expression: check if it represents a filter condition
    if (/(^filter\s*[:(]|==|!=|<=|>=|<|>|(?<![=<>!])=(?!=)|\b[nxyk]\s*%|%\s*\d|\b[nxyk]\b)/i.test(trimmed)) {
      filterStr = trimmed;
      stepStr = "1";
    } else {
      stepStr = trimmed;
    }
  }

  let filterValid = false;
  let normalizedFilter = "";
  if (filterStr) {
    try {
      normalizedFilter = normalizeFilter(filterStr);
      const compiled = mathjs.compile(normalizedFilter);
      // Verify evaluation across sample tick values
      const scope0 = { n: 0, x: 0, y: 0, k: 0, pi: Math.PI, e: Math.E, ...extraScope };
      const scope1 = { n: 1, x: 1, y: 1, k: 1, pi: Math.PI, e: Math.E, ...extraScope };
      const scope5 = { n: 5, x: 5, y: 5, k: 5, pi: Math.PI, e: Math.E, ...extraScope };
      compiled.evaluate(scope0);
      compiled.evaluate(scope1);
      compiled.evaluate(scope5);
      filterValid = true;
    } catch {
      filterValid = false;
    }
  }

  // Evaluate step numeric value
  let stepValid = false;
  let stepVal = 1;
  let stepFormatted = "";

  let normalizedStep = stepStr
    .trim()
    .replace(/π/g, "pi")
    .replace(/τ/g, "tau")
    .replace(/√\s*(\d+(\.\d+)?|[a-zA-Z]+|\([^)]+\))/g, "sqrt($1)")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");

  normalizedStep = normalizedStep
    .replace(/(\d)\s*(pi|tau|e|sqrt|[a-zA-Z]|\()/gi, "$1*$2")
    .replace(/\)\s*(\d|pi|tau|e|sqrt|[a-zA-Z]|\()/gi, ")*$1");

  const scope = {
    pi: Math.PI,
    PI: Math.PI,
    tau: 2 * Math.PI,
    TAU: 2 * Math.PI,
    e: Math.E,
    E: Math.E,
    ...extraScope,
  };

  try {
    const res = mathjs.evaluate(normalizedStep, scope);
    const num = Number(res);
    if (typeof num === "number" && isFinite(num) && num > 0) {
      stepValid = true;
      stepVal = num;
      stepFormatted = num % 1 === 0 ? num.toString() : parseFloat(num.toFixed(4)).toString();
    }
  } catch {
    try {
      const res = mathjs.evaluate(stepStr, scope);
      const num = Number(res);
      if (typeof num === "number" && isFinite(num) && num > 0) {
        stepValid = true;
        stepVal = num;
        stepFormatted = num % 1 === 0 ? num.toString() : parseFloat(num.toFixed(4)).toString();
      }
    } catch {}
  }

  if (filterStr) {
    if (filterValid && (stepValid || !stepStr)) {
      const stepDisplay = stepVal !== 1 ? ` (step ${stepFormatted})` : "";
      return {
        valid: true,
        value: stepVal,
        filterExpr: normalizedFilter,
        isFilter: true,
        formattedValue: `Filter: ${filterStr.trim()}${stepDisplay}`,
      };
    }
    return { valid: false, value: 1 };
  }

  if (stepValid) {
    return {
      valid: true,
      value: stepVal,
      formattedValue: stepFormatted,
      isFilter: false,
    };
  }

  return { valid: false, value: 1 };
}


