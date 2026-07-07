/**
 * mathWorker.ts — Web Worker for heavy mathjs operations.
 *
 * Maintains internal registries for parsed ASTs and compiled expressions
 * so that serialization-hostile objects never cross the worker boundary.
 *
 * Communication protocol:
 *   Request:  { id: number; action: string; payload: unknown }
 *   Response: { id: number; success: true; result: unknown }
 *          or { id: number; success: false; error: { message: string } }
 */
import * as mathjs from "mathjs";

// ─── Registries ───────────────────────────────────────────────────────────────

const parsedRegistry = new Map<string, any>(); // expression string → MathNode
const compiledRegistry = new Map<string, any>(); // key → EvalFunction

let nextCompiledKey = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getParsedNode(expr: string): any {
  const cached = parsedRegistry.get(expr);
  if (cached) return cached;
  const node = mathjs.parse(expr);
  parsedRegistry.set(expr, node);
  return node;
}

function getCompiledKey(expr: string): string {
  // Check if already compiled with the same expression
  for (const [key, entry] of compiledRegistry.entries()) {
    if (entry.__expr === expr) return key;
  }
  const node = getParsedNode(expr);
  const compiled = node.compile();
  const key = `ck_${nextCompiledKey++}`;
  compiled.__expr = expr;
  compiledRegistry.set(key, compiled);
  return key;
}

/**
 * parseAndAdjustForCompile — Pre-processes AST to inline derivatives,
 * simplify, rationalize, and convert AccessorNodes to FunctionNode calls.
 */
function parseAndAdjustForCompile(exprStr: string): any {
  const node = mathjs.parse(exprStr);
  const transformNode = (n: any): any => {
    let mapped = n.map(transformNode);
    if (mapped.isFunctionNode) {
      try {
        if (mapped.fn.name === "derivative") {
          let arg0 = mapped.args[0];
          let arg1 = mapped.args[1];
          if (arg0 && arg0.isConstantNode && typeof arg0.value === "string") {
            arg0 = mathjs.parse(arg0.value);
          }
          if (arg1 && arg1.isConstantNode && typeof arg1.value === "string") {
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
}

const resolveNestedValue = (val: any): any => {
  if (!val) return val;
  if (typeof val.toArray === "function") {
    val = val.toArray();
  }
  if (Array.isArray(val)) {
    return val.map((item: any) => resolveNestedValue(item));
  }
  return val;
};

const indexHelper = (obj: any, ...indices: any[]) => {
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
        current = current[numIdx];
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

const formatMathError = (errMessage: string): string => {
  if (!errMessage) return errMessage;
  const match =
    errMessage.match(/Undefined symbol\s+([a-zA-Z0-9_]+)/i) ||
    errMessage.match(/Symbol\s+([a-zA-Z0-9_]+)\s+is undefined/i);
  if (match) {
    return `Unknown geometry reference "${match[1]}".`;
  }
  return errMessage;
};

// ─── Action Handlers ──────────────────────────────────────────────────────────

const handlers: Record<string, (payload: any) => any> = {
  /**
   * parse — Parse expression, cache AST, return success.
   */
  parse({ expression }: { expression: string }) {
    getParsedNode(expression);
    return { parsed: true };
  },

  /**
   * compile — Parse, adjust, compile expression. Store in registry.
   * Returns a key handle to reference the compiled object.
   */
  compile({ expression }: { expression: string }) {
    const node = parseAndAdjustForCompile(expression);
    const compiled = node.compile();
    const key = `ck_${nextCompiledKey++}`;
    compiled.__expr = expression;
    compiledRegistry.set(key, compiled);
    return { key };
  },

  /**
   * toTex — Convert expression to LaTeX string.
   * Supports optional handler for colorizing variables.
   */
  toTex({
    expression,
    coloredVars,
  }: {
    expression: string;
    coloredVars?: Record<string, string>;
  }) {
    const node = getParsedNode(expression);
    if (coloredVars) {
      const tex = node.toTex({
        handler: (n: any) => {
          if (n.isSymbolNode && coloredVars[n.name]) {
            const color = coloredVars[n.name];
            const display =
              n.name === "theta"
                ? "\\theta"
                : n.name.replace("_", "\\_");
            return `\\textcolor{${color}}{${display}}`;
          }
          return undefined;
        },
      });
      return { tex };
    }
    return { tex: node.toTex() };
  },

  /**
   * evaluate — Evaluate an expression with a scope.
   */
  evaluate({
    expression,
    scope,
  }: {
    expression: string;
    scope: Record<string, any>;
  }) {
    const result = mathjs.evaluate(expression, scope);
    // Attempt to serialize result
    if (result !== undefined && typeof result !== "function") {
      if (result && typeof result.toArray === "function") {
        return { result: result.toArray() };
      }
      return { result };
    }
    return { result: undefined };
  },

  /**
   * format — Format a value using mathjs.format.
   */
  format({
    value,
    options,
  }: {
    value: any;
    options?: { precision?: number };
  }) {
    return { formatted: mathjs.format(value, options || { precision: 5 }) };
  },

  /**
   * determinant — Compute determinant of a matrix.
   */
  determinant({ matrix }: { matrix: any }) {
    return { result: mathjs.det(matrix) };
  },

  /**
   * parseEvaluateFormat — Parse, evaluate, and format in one round-trip.
   * Used for "Copy Result" and inline result display.
   */
  parseEvaluateFormat({
    expression,
    scope,
    precision,
  }: {
    expression: string;
    scope: Record<string, any>;
    precision?: number;
  }) {
    const node = getParsedNode(expression);
    const result = node.evaluate(scope);
    if (result !== undefined && typeof result !== "function") {
      return {
        formatted: mathjs.format(result, { precision: precision || 5 }),
        result:
          typeof result === "number"
            ? result
            : result?.toArray
              ? result.toArray()
              : result,
      };
    }
    return { formatted: undefined, result: undefined };
  },

  /**
   * expressionToLatex — Full LaTeX conversion for an expression,
   * handling equations (lhs = rhs) and optional colored variables.
   */
  expressionToLatex({
    expression,
    coloredVars,
  }: {
    expression: string;
    coloredVars?: Record<string, string>;
  }) {
    const getLatex = (exprStr: string) => {
      const n = mathjs.parse(exprStr);
      if (coloredVars) {
        return n.toTex({
          handler: (node: any) => {
            if (node.isSymbolNode && coloredVars[node.name]) {
              const color = coloredVars[node.name];
              const display =
                node.name === "theta"
                  ? "\\theta"
                  : node.name.replace("_", "\\_");
              return `\\textcolor{${color}}{${display}}`;
            }
            return undefined;
          },
        });
      }
      return n.toTex();
    };

    try {
      let latex = "";
      let node: any = null;

      try {
        node = mathjs.parse(expression);
        latex = getLatex(expression);
      } catch (parseError: any) {
        const eqIndex = expression.indexOf("=");
        if (
          eqIndex !== -1 &&
          !expression.includes("==") &&
          !expression.includes(">=") &&
          !expression.includes("<=") &&
          !expression.includes("!=")
        ) {
          const lhs = expression.slice(0, eqIndex);
          const rhs = expression.slice(eqIndex + 1);
          if (lhs.trim() && rhs.trim()) {
            const lhsLatex = getLatex(lhs);
            const rhsLatex = getLatex(rhs);
            latex = `${lhsLatex} = ${rhsLatex}`;
            node = null;
          } else {
            throw parseError;
          }
        } else {
          throw parseError;
        }
      }

      return { latex, hasNode: !!node };
    } catch (e: any) {
      return { error: e.message || String(e) };
    }
  },

  /**
   * expressionToLatexWithEval — Full LaTeX + evaluation in one call.
   * Combines expressionToLatex + evaluation for EquationInput preview.
   */
  expressionToLatexWithEval({
    expression,
    coloredVars,
    scope,
  }: {
    expression: string;
    coloredVars?: Record<string, string>;
    scope?: Record<string, any>;
  }) {
    const latexResult = handlers.expressionToLatex({ expression, coloredVars });

    if (latexResult.error || !latexResult.hasNode || !scope) {
      return latexResult;
    }

    try {
      const node = mathjs.parse(expression);
      const result = node.evaluate(scope);
      if (result !== undefined && typeof result !== "function") {
        const resStr = mathjs.format(result, { precision: 5 });
        if (resStr !== expression.trim()) {
          return { ...latexResult, evalResult: resStr };
        }
      }
    } catch (e) {
      // Could happen for unassigned variables in scope
    }

    return latexResult;
  },

  /**
   * extractSymbols — Extract variable symbols from an expression AST.
   */
  extractSymbols({ expression }: { expression: string }) {
    const node = getParsedNode(expression);
    const symbols = new Set<string>();
    const assignedVars = new Set<string>();

    node.traverse((n: any) => {
      if (n.isAssignmentNode) {
        if (n.object && n.object.isSymbolNode) assignedVars.add(n.object.name);
        else if (n.name) assignedVars.add(n.name);
      }
      if (n.isFunctionAssignmentNode) assignedVars.add(n.name);
    });

    node.traverse((n: any) => {
      if (n.isSymbolNode) symbols.add(n.name);
    });

    return {
      symbols: Array.from(symbols),
      assignedVars: Array.from(assignedVars),
    };
  },

  /**
   * compileFunctions — The big batch operation. Parses, adjusts, compiles,
   * and test-evaluates ALL math functions. Returns compiled keys + errors +
   * missing variables.
   *
   * This replaces the entire "Compile functions & extract variables" useEffect.
   */
  compileFunctions({
    functions,
    variableNames,
    variableValues,
    time,
    functionTimelines,
  }: {
    functions: Array<{
      id: string;
      expr: string;
      type: string;
      name?: string;
      label?: string;
      hasCustomTimeline?: boolean;
      time?: number;
    }>;
    variableNames: string[];
    variableValues: number[];
    time: number;
    functionTimelines: Array<{ time: number }>;
  }) {
    const varsToAdd = new Set<string>();
    const assignedVars = new Set<string>();

    // Build base scope
    const tempBaseScope: any = {};
    for (let i = 0; i < variableNames.length; i++) {
      tempBaseScope[variableNames[i]] = variableValues[i];
    }
    tempBaseScope.t = time;
    tempBaseScope.time = time;
    tempBaseScope.ln = mathjs.log;
    tempBaseScope.log10 = mathjs.log10;
    tempBaseScope.theta = 0;
    tempBaseScope.indexHelper = indexHelper;

    // Register geometry functions
    tempBaseScope.Line = (...args: any[]) => args;
    tempBaseScope.Vector = (...args: any[]) => args;
    tempBaseScope.Polygon = (...args: any[]) => args;
    tempBaseScope.Point = (...args: any[]) => args;

    // Pre-populate t_... variables
    functions.forEach((f, idx) => {
      const fTime = f.hasCustomTimeline
        ? f.time !== undefined
          ? f.time
          : 0
        : time;
      tempBaseScope[`t_${idx + 1}`] = fTime;
      if (f.name) {
        const match = f.name.match(/^([a-zA-Z0-9_]+)/);
        const fnId = match ? match[1] : f.name;
        if (fnId && fnId !== "t" && fnId !== "time") {
          tempBaseScope[`t_${fnId}`] = fTime;
        }
      }
    });

    const BUILTINS = [
      "x", "y", "t", "time", "theta", "ln", "log10",
      "Line", "Vector", "Polygon", "Point", "indexHelper",
    ];

    const results = functions.map((f) => {
      try {
        if (f.type === "implicit" || f.type === "inequality") {
          let op = "=";
          let parts = f.expr.split("=");

          if (f.type === "inequality") {
            const match = f.expr.match(/(<=|>=|<|>)/);
            if (match) {
              op = match[1];
              parts = f.expr.split(op);
            }
          }

          const lhsStr = parts[0].trim();
          const rhsStr = parts[1] ? parts[1].trim() : "0";

          const lhsNode = parseAndAdjustForCompile(lhsStr);
          const rhsNode = parseAndAdjustForCompile(rhsStr);
          const compiledLHS = lhsNode.compile();
          const compiledRHS = rhsNode.compile();

          // Store compiled in registry
          const lhsKey = `ck_${nextCompiledKey++}`;
          compiledLHS.__expr = lhsStr;
          compiledRegistry.set(lhsKey, compiledLHS);

          const rhsKey = `ck_${nextCompiledKey++}`;
          compiledRHS.__expr = rhsStr;
          compiledRegistry.set(rhsKey, compiledRHS);

          if (f.label) assignedVars.add(f.label);
          if (f.name) assignedVars.add(f.name);

          const extractSymbols = (node: any) => {
            node.traverse((n: any) => {
              if (
                n.isSymbolNode &&
                !BUILTINS.includes(n.name) &&
                !n.name.startsWith("t_") &&
                !(mathjs as any)[n.name] &&
                !assignedVars.has(n.name)
              ) {
                varsToAdd.add(n.name);
              }
            });
          };
          extractSymbols(lhsNode);
          extractSymbols(rhsNode);

          // Verify evaluation
          let error: string | undefined;
          try {
            const fScope = Object.create(tempBaseScope);
            fScope.x = 0;
            fScope.y = 0;
            compiledLHS.evaluate(fScope);
            compiledRHS.evaluate(fScope);
          } catch (evalErr: any) {
            error = formatMathError(evalErr.message || String(evalErr));
          }

          return {
            id: f.id,
            compiledKey: lhsKey,
            compiled2Key: rhsKey,
            operator: op,
            error,
          };
        }

        // Standard expression
        const node = parseAndAdjustForCompile(f.expr);
        const compiled = node.compile();

        const key = `ck_${nextCompiledKey++}`;
        compiled.__expr = f.expr;
        compiledRegistry.set(key, compiled);

        if (f.label) assignedVars.add(f.label);
        if (f.name) assignedVars.add(f.name);

        // Find assigned variables
        node.traverse((n: any, _path: string, _parent: any) => {
          if (n.isAssignmentNode) {
            if (n.object && n.object.isSymbolNode) assignedVars.add(n.object.name);
            else if (n.name) assignedVars.add(n.name);
          }
          if (n.isFunctionAssignmentNode) assignedVars.add(n.name);
        });

        // Auto-extract variables
        node.traverse((n: any) => {
          if (
            n.isSymbolNode &&
            !BUILTINS.includes(n.name) &&
            !n.name.startsWith("t_") &&
            !(mathjs as any)[n.name] &&
            !assignedVars.has(n.name)
          ) {
            varsToAdd.add(n.name);
          }
        });

        // Test evaluate
        let error: string | undefined;
        try {
          const fTime = f.hasCustomTimeline
            ? f.time !== undefined
              ? f.time
              : 0
            : time;
          const fScope = Object.create(tempBaseScope);
          fScope.t = fTime;
          fScope.time = time;
          fScope.x = 0;
          fScope.y = 0;

          const val = compiled.evaluate(fScope);

          // Propagate variables back
          for (const scopeKey of Object.keys(fScope)) {
            if (
              scopeKey !== "t" &&
              scopeKey !== "time" &&
              scopeKey !== "x" &&
              scopeKey !== "y"
            ) {
              tempBaseScope[scopeKey] = fScope[scopeKey];
            }
          }

          const refName = f.label || f.name;
          if (refName) tempBaseScope[refName] = val;
        } catch (evalErr: any) {
          error = formatMathError(evalErr.message || String(evalErr));
        }

        return { id: f.id, compiledKey: key, error };
      } catch (e: any) {
        return {
          id: f.id,
          compiledKey: undefined,
          error: formatMathError(e.message || String(e)),
        };
      }
    });

    const currentVarNames = new Set(variableNames);
    const missing = Array.from(varsToAdd).filter(
      (v) => !currentVarNames.has(v) && !assignedVars.has(v),
    );

    return { results, missingVars: missing };
  },

  /**
   * evaluateCompiled — Evaluate a previously compiled expression by key.
   */
  evaluateCompiled({
    key,
    scope,
  }: {
    key: string;
    scope: Record<string, any>;
  }) {
    const compiled = compiledRegistry.get(key);
    if (!compiled) throw new Error(`Compiled key "${key}" not found in registry`);
    const scopeWithHelpers: any = { ...scope };
    scopeWithHelpers.ln = mathjs.log;
    scopeWithHelpers.log10 = mathjs.log10;
    scopeWithHelpers.indexHelper = indexHelper;
    scopeWithHelpers.Line = (...args: any[]) => args;
    scopeWithHelpers.Vector = (...args: any[]) => args;
    scopeWithHelpers.Polygon = (...args: any[]) => args;
    scopeWithHelpers.Point = (...args: any[]) => args;

    const result = compiled.evaluate(scopeWithHelpers);
    if (result && typeof result.toArray === "function") {
      return { result: result.toArray() };
    }
    return { result };
  },

  /**
   * batchEvaluate — Evaluate a compiled expression with many scopes.
   * Returns Float64Array for performance.
   */
  batchEvaluate({
    key,
    baseScope,
    variable,
    values,
  }: {
    key: string;
    baseScope: Record<string, any>;
    variable: string;
    values: Float64Array | number[];
  }) {
    const compiled = compiledRegistry.get(key);
    if (!compiled) throw new Error(`Compiled key "${key}" not found in registry`);

    const scopeWithHelpers: any = { ...baseScope };
    scopeWithHelpers.ln = mathjs.log;
    scopeWithHelpers.log10 = mathjs.log10;
    scopeWithHelpers.indexHelper = indexHelper;
    scopeWithHelpers.Line = (...args: any[]) => args;
    scopeWithHelpers.Vector = (...args: any[]) => args;
    scopeWithHelpers.Polygon = (...args: any[]) => args;
    scopeWithHelpers.Point = (...args: any[]) => args;

    const results = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) {
      scopeWithHelpers[variable] = values[i];
      try {
        const r = compiled.evaluate(scopeWithHelpers);
        results[i] = typeof r === "number" ? r : Number(r);
      } catch {
        results[i] = NaN;
      }
    }
    return { results };
  },

  /**
   * dispose — Remove a compiled expression from the registry.
   */
  dispose({ key }: { key: string }) {
    compiledRegistry.delete(key);
    return { disposed: true };
  },

  /**
   * disposeAll — Clear all registries.
   */
  disposeAll() {
    compiledRegistry.clear();
    parsedRegistry.clear();
    nextCompiledKey = 0;
    return { disposed: true };
  },

  /**
   * derivative — Compute symbolic derivative.
   */
  derivative({
    expression,
    variable,
  }: {
    expression: string;
    variable: string;
  }) {
    const expr = mathjs.parse(expression);
    const varNode = mathjs.parse(variable);
    const result = (mathjs as any).derivative(expr, varNode);
    return { result: result.toString(), tex: result.toTex() };
  },

  /**
   * simplify — Simplify an expression.
   */
  simplify({ expression }: { expression: string }) {
    const result = (mathjs as any).simplify(expression);
    return { result: result.toString(), tex: result.toTex() };
  },

  /**
   * validate — Check if expression is valid.
   */
  validate({ expression }: { expression: string }) {
    try {
      mathjs.parse(expression);
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  },
};

// ─── Message Router ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  const handler = handlers[action];
  if (!handler) {
    (self as any).postMessage({
      id,
      success: false,
      error: { message: `Unknown action: ${action}` },
    });
    return;
  }

  try {
    const result = handler(payload || {});

    // Check if result contains transferable buffers
    const transferables: Transferable[] = [];
    if (result && result.results instanceof Float64Array) {
      transferables.push(result.results.buffer);
    }

    (self as any).postMessage({ id, success: true, result }, transferables);
  } catch (err: any) {
    (self as any).postMessage({
      id,
      success: false,
      error: { message: err.message || String(err) },
    });
  }
};
