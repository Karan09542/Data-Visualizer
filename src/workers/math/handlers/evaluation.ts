import { MathWorkerHandler } from "../types";
import { getParsedNode } from "../utils/parse";

const evaluate: MathWorkerHandler<{ expression: string; scope: Record<string, any> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const scope = context.createMathScope(payload.scope);
  const result = context.math.evaluate(payload.expression, scope);
  if (result !== undefined && typeof result !== "function") {
    if (result && typeof result.toArray === "function") {
      return { result: result.toArray() };
    }
    return { result };
  }
  return { result: undefined };
};

const parseEvaluateFormat: MathWorkerHandler<{ expression: string; scope: Record<string, any>; precision?: number }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const node = getParsedNode(context.registry, payload.expression);
  const scope = context.createMathScope(payload.scope);
  const result = node.evaluate(scope);
  if (result !== undefined && typeof result !== "function") {
    return {
      formatted: context.math.format(result, { precision: payload.precision || 5 }),
      result:
        typeof result === "number"
          ? result
          : result?.toArray
            ? result.toArray()
            : result,
    };
  }
  return { formatted: undefined, result: undefined };
};

const evaluateCompiled: MathWorkerHandler<{ key: string; scope: Record<string, any> }> = (payload, context) => {
  const compiled = context.registry.getCompiled(payload.key);
  if (!compiled) throw new Error(`Compiled key "${payload.key}" not found in registry`);
  
  const scopeWithHelpers = context.createMathScope(payload.scope);
  const result = compiled.evaluate(scopeWithHelpers);
  
  if (result && typeof result.toArray === "function") {
    return { result: result.toArray() };
  }
  return { result };
};

const batchEvaluate: MathWorkerHandler<{ key: string; baseScope: Record<string, any>; variable: string; values: Float64Array | number[] }> = (payload, context) => {
  const compiled = context.registry.getCompiled(payload.key);
  if (!compiled) throw new Error(`Compiled key "${payload.key}" not found in registry`);

  const scopeWithHelpers = context.createMathScope(payload.baseScope);
  const results = new Float64Array(payload.values.length);
  
  for (let i = 0; i < payload.values.length; i++) {
    if (i % 1000 === 0) {
      context.cancellationToken.throwIfCancelled();
    }
    scopeWithHelpers[payload.variable] = payload.values[i];
    try {
      const r = compiled.evaluate(scopeWithHelpers);
      results[i] = typeof r === "number" ? r : Number(r);
    } catch {
      results[i] = NaN;
    }
  }
  return { results };
};

export default {
  evaluate,
  parseEvaluateFormat,
  evaluateCompiled,
  batchEvaluate,
};
