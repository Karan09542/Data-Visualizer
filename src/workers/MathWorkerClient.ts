/**
 * MathWorkerClient — Promise-based transport layer for the math Web Worker.
 *
 * Handles request/response routing, message IDs, error propagation,
 * and transferable buffer management. Reusable outside of React.
 */

export interface MathWorkerRequest {
  id: number;
  action: string;
  payload: unknown;
}

export interface MathWorkerResponse {
  id: number;
  success: boolean;
  result?: any;
  error?: { message: string };
}

export class MathWorkerClient {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private _terminated = false;

  constructor() {
    this.worker = new Worker(
      new URL("../workers/mathWorker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  private handleMessage(e: MessageEvent<MathWorkerResponse>) {
    const { id, success, result, error } = e.data;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error?.message || "Unknown worker error"));
    }
  }

  private handleError(e: ErrorEvent) {
    // Reject all pending requests on worker crash
    for (const [, { reject }] of this.pending) {
      reject(new Error(e.message || "Worker error"));
    }
    this.pending.clear();
  }

  /**
   * Send a request to the worker and return a promise for the result.
   */
  request<T = any>(
    action: string,
    payload?: unknown,
    transferables?: Transferable[],
  ): Promise<T> {
    if (this._terminated) {
      return Promise.reject(new Error("Worker has been terminated"));
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const message: MathWorkerRequest = { id, action, payload };

      if (transferables && transferables.length > 0) {
        this.worker.postMessage(message, transferables);
      } else {
        this.worker.postMessage(message);
      }
    });
  }

  // ─── Typed API Methods ────────────────────────────────────────────────────

  parse(expression: string) {
    return this.request<{ parsed: boolean }>("parse", { expression });
  }

  compile(expression: string) {
    return this.request<{ key: string }>("compile", { expression });
  }

  toTex(expression: string, coloredVars?: Record<string, string>) {
    return this.request<{ tex: string }>("toTex", { expression, coloredVars });
  }

  evaluate(expression: string, scope: Record<string, any>) {
    return this.request<{ result: any }>("evaluate", { expression, scope });
  }

  format(value: any, options?: { precision?: number }) {
    return this.request<{ formatted: string }>("format", { value, options });
  }

  determinant(matrix: any) {
    return this.request<{ result: number }>("determinant", { matrix });
  }

  parseEvaluateFormat(
    expression: string,
    scope: Record<string, any>,
    precision?: number,
  ) {
    return this.request<{ formatted?: string; result?: any }>(
      "parseEvaluateFormat",
      { expression, scope, precision },
    );
  }

  expressionToLatex(
    expression: string,
    coloredVars?: Record<string, string>,
  ) {
    return this.request<{ latex?: string; hasNode?: boolean; error?: string }>(
      "expressionToLatex",
      { expression, coloredVars },
    );
  }

  expressionToLatexWithEval(
    expression: string,
    coloredVars?: Record<string, string>,
    scope?: Record<string, any>,
  ) {
    return this.request<{
      latex?: string;
      hasNode?: boolean;
      evalResult?: string;
      error?: string;
    }>("expressionToLatexWithEval", { expression, coloredVars, scope });
  }

  extractSymbols(expression: string) {
    return this.request<{ symbols: string[]; assignedVars: string[] }>(
      "extractSymbols",
      { expression },
    );
  }

  compileFunctions(payload: {
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
    return this.request<{
      results: Array<{
        id: string;
        compiledKey?: string;
        compiled2Key?: string;
        operator?: string;
        error?: string;
      }>;
      missingVars: string[];
    }>("compileFunctions", payload);
  }

  evaluateCompiled(key: string, scope: Record<string, any>) {
    return this.request<{ result: any }>("evaluateCompiled", { key, scope });
  }

  batchEvaluate(
    key: string,
    baseScope: Record<string, any>,
    variable: string,
    values: Float64Array | number[],
  ) {
    const transferables: Transferable[] = [];
    if (values instanceof Float64Array) {
      transferables.push(values.buffer);
    }
    return this.request<{ results: Float64Array }>(
      "batchEvaluate",
      { key, baseScope, variable, values },
      transferables,
    );
  }

  derivative(expression: string, variable: string) {
    return this.request<{ result: string; tex: string }>("derivative", {
      expression,
      variable,
    });
  }

  simplify(expression: string) {
    return this.request<{ result: string; tex: string }>("simplify", {
      expression,
    });
  }

  validate(expression: string) {
    return this.request<{ valid: boolean; error?: string }>("validate", {
      expression,
    });
  }

  dispose(key: string) {
    return this.request<{ disposed: boolean }>("dispose", { key });
  }

  disposeAll() {
    return this.request<{ disposed: boolean }>("disposeAll");
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  terminate() {
    this._terminated = true;
    // Reject any remaining pending requests
    for (const [, { reject }] of this.pending) {
      reject(new Error("Worker terminated"));
    }
    this.pending.clear();
    this.worker.terminate();
  }

  get isTerminated() {
    return this._terminated;
  }
}
