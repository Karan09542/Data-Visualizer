import { MathWorkerHandler } from "../types";
import { getParsedNode } from "../utils/parse";

const parse: MathWorkerHandler<{ expression: string }> = (payload, context) => {
  getParsedNode(context.registry, payload.expression);
  return { parsed: true };
};

const format: MathWorkerHandler<{ value: any; options?: { precision?: number } }> = (payload, context) => {
  return { formatted: context.math.format(payload.value, payload.options || { precision: 5 }) };
};

const dispose: MathWorkerHandler<{ key: string }> = (payload, context) => {
  context.registry.deleteCompiled(payload.key);
  return { disposed: true };
};

const disposeAll: MathWorkerHandler<void> = (payload, context) => {
  context.registry.clear();
  return { disposed: true };
};

export default {
  parse,
  format,
  dispose,
  disposeAll,
};
