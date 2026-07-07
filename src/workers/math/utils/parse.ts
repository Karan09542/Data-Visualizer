import * as mathjs from "mathjs";
import { Registry } from "../registry";

export function getParsedNode(registry: Registry, expr: string): any {
  const cached = registry.getParsedNode(expr);
  if (cached) return cached;
  const node = mathjs.parse(expr);
  registry.setParsedNode(expr, node);
  return node;
}

export function parseAndAdjustForCompile(registry: Registry, exprStr: string): any {
  const node = getParsedNode(registry, exprStr);
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
