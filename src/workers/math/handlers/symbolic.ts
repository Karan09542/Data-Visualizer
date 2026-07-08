import { MathWorkerHandler } from "../types";
import { getParsedNode } from "../utils/parse";

const derivative: MathWorkerHandler<{ expression: string; variable: string }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const expr = context.math.parse(payload.expression);
  const varNode = context.math.parse(payload.variable);
  const result = (context.math as any).derivative(expr, varNode);
  return { result: result.toString(), tex: result.toTex() };
};

const simplify: MathWorkerHandler<{ expression: string }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const result = (context.math as any).simplify(payload.expression);
  return { result: result.toString(), tex: result.toTex() };
};

const validate: MathWorkerHandler<{ expression: string }> = (payload, context) => {
  try {
    context.math.parse(payload.expression);
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
};

const extractSymbols: MathWorkerHandler<{ expression: string }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const node = getParsedNode(context.registry, payload.expression);
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
};

export default {
  derivative,
  simplify,
  validate,
  extractSymbols,
};
