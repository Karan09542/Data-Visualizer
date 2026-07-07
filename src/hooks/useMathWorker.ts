/**
 * useMathWorker — React hook that manages the math Web Worker lifecycle
 * and exposes a clean API to components.
 *
 * Architecture:
 *   React Components → useMathWorker (hook) → MathWorkerClient (transport) → mathWorker.ts (computation)
 */
import { useEffect, useRef, useCallback } from "react";
import { MathWorkerClient } from "../workers/MathWorkerClient";

// Singleton client — shared across all component instances to avoid
// spawning multiple workers. Reference-counted for cleanup.
let sharedClient: MathWorkerClient | null = null;
let refCount = 0;

function acquireClient(): MathWorkerClient {
  if (!sharedClient || sharedClient.isTerminated) {
    sharedClient = new MathWorkerClient();
  }
  refCount++;
  return sharedClient;
}

function releaseClient() {
  refCount--;
  if (refCount <= 0 && sharedClient) {
    sharedClient.terminate();
    sharedClient = null;
    refCount = 0;
  }
}

export function useMathWorker() {
  const clientRef = useRef<MathWorkerClient | null>(null);

  useEffect(() => {
    const client = acquireClient();
    clientRef.current = client;
    return () => {
      releaseClient();
      clientRef.current = null;
    };
  }, []);

  const getClient = useCallback((): MathWorkerClient => {
    if (!clientRef.current) {
      // Fallback: acquire a new client if somehow missing
      const client = acquireClient();
      clientRef.current = client;
      return client;
    }
    return clientRef.current;
  }, []);

  // ─── Exposed API ──────────────────────────────────────────────────────────

  const parse = useCallback(
    (expression: string) => getClient().parse(expression),
    [getClient],
  );

  const compile = useCallback(
    (expression: string) => getClient().compile(expression),
    [getClient],
  );

  const toTex = useCallback(
    (expression: string, coloredVars?: Record<string, string>) =>
      getClient().toTex(expression, coloredVars),
    [getClient],
  );

  const evaluate = useCallback(
    (expression: string, scope: Record<string, any>) =>
      getClient().evaluate(expression, scope),
    [getClient],
  );

  const format = useCallback(
    (value: any, options?: { precision?: number }) =>
      getClient().format(value, options),
    [getClient],
  );

  const determinant = useCallback(
    (matrix: any) => getClient().determinant(matrix),
    [getClient],
  );

  const parseEvaluateFormat = useCallback(
    (expression: string, scope: Record<string, any>, precision?: number) =>
      getClient().parseEvaluateFormat(expression, scope, precision),
    [getClient],
  );

  const expressionToLatex = useCallback(
    (expression: string, coloredVars?: Record<string, string>) =>
      getClient().expressionToLatex(expression, coloredVars),
    [getClient],
  );

  const expressionToLatexWithEval = useCallback(
    (
      expression: string,
      coloredVars?: Record<string, string>,
      scope?: Record<string, any>,
    ) => getClient().expressionToLatexWithEval(expression, coloredVars, scope),
    [getClient],
  );

  const extractSymbols = useCallback(
    (expression: string) => getClient().extractSymbols(expression),
    [getClient],
  );

  const compileFunctions = useCallback(
    (payload: Parameters<MathWorkerClient["compileFunctions"]>[0]) =>
      getClient().compileFunctions(payload),
    [getClient],
  );

  const evaluateCompiled = useCallback(
    (key: string, scope: Record<string, any>) =>
      getClient().evaluateCompiled(key, scope),
    [getClient],
  );

  const batchEvaluate = useCallback(
    (
      key: string,
      baseScope: Record<string, any>,
      variable: string,
      values: Float64Array | number[],
    ) => getClient().batchEvaluate(key, baseScope, variable, values),
    [getClient],
  );

  const derivative = useCallback(
    (expression: string, variable: string) =>
      getClient().derivative(expression, variable),
    [getClient],
  );

  const simplify = useCallback(
    (expression: string) => getClient().simplify(expression),
    [getClient],
  );

  const validate = useCallback(
    (expression: string) => getClient().validate(expression),
    [getClient],
  );

  const dispose = useCallback(
    (key: string) => getClient().dispose(key),
    [getClient],
  );

  const disposeAll = useCallback(
    () => getClient().disposeAll(),
    [getClient],
  );

  return {
    parse,
    compile,
    toTex,
    evaluate,
    format,
    determinant,
    parseEvaluateFormat,
    expressionToLatex,
    expressionToLatexWithEval,
    extractSymbols,
    compileFunctions,
    evaluateCompiled,
    batchEvaluate,
    derivative,
    simplify,
    validate,
    dispose,
    disposeAll,
  };
}
