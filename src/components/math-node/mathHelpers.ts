/**
 * mathHelpers.ts — Pure math/geometry helper functions extracted from MathNodeRenderer.
 * These are used both on the main thread and potentially reused elsewhere.
 */
import * as mathjs from "mathjs";
import { MathFunction, formatMathError } from "./mathTypes";

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
  const node = mathjs.parse(exprStr);
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
