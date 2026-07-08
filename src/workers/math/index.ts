import * as mathjs from "mathjs";
import { Registry } from "./registry";
import { MathWorkerContext, CancellationToken } from "./context";
import { createMathScope } from "./utils/scope";

import coreHandlers from "./handlers/core";
import compilationHandlers from "./handlers/compilation";
import evaluationHandlers from "./handlers/evaluation";
import latexHandlers from "./handlers/latex";
import symbolicHandlers from "./handlers/symbolic";
import matrixHandlers from "./handlers/matrix";
import { MathWorkerHandler } from "./types";

const registry = new Registry();

const allHandlers: Record<string, MathWorkerHandler> = {
  ...coreHandlers,
  ...compilationHandlers,
  ...evaluationHandlers,
  ...latexHandlers,
  ...symbolicHandlers,
  ...matrixHandlers,
};

const activeRequests = new Map<string, { cancelled: boolean }>();

self.onmessage = (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  // Simple cancellation logic: if a UI sends an action with the same 'action' type, 
  // we might cancel the previous one? 
  // Actually, standard MathWorkerClient uses an incrementing ID. It doesn't send cancel events natively yet.
  // But we can support a generic cancel action if the UI wants to send it.
  if (action === "cancel" && payload && payload.id) {
    const req = activeRequests.get(String(payload.id));
    if (req) {
      req.cancelled = true;
    }
    return;
  }

  const handler = allHandlers[action];
  if (!handler) {
    (self as any).postMessage({ id, success: false, error: { message: `Unknown action: ${action}` } });
    return;
  }

  const reqState = { cancelled: false };
  activeRequests.set(String(id), reqState);

  const cancellationToken: CancellationToken = {
    get isCancelled() {
      return reqState.cancelled;
    },
    throwIfCancelled() {
      if (reqState.cancelled) {
        throw new Error("Request cancelled");
      }
    }
  };

  const context: MathWorkerContext = {
    registry,
    math: mathjs,
    createMathScope,
    cancellationToken,
  };

  try {
    const result = handler(payload || {}, context);

    if (reqState.cancelled) {
      // Do nothing if cancelled
      activeRequests.delete(String(id));
      return;
    }

    // Check if result contains transferable buffers
    const transferables: Transferable[] = [];
    if (result && result.results instanceof Float64Array) {
      transferables.push(result.results.buffer);
    }

    (self as any).postMessage({ id, success: true, result }, transferables);
  } catch (err: any) {
    if (err.message === "Request cancelled") {
      // Silently ignore or send a cancelled response
    } else {
      (self as any).postMessage({
        id,
        success: false,
        error: { message: err.message || String(err) },
      });
    }
  } finally {
    activeRequests.delete(String(id));
  }
};
