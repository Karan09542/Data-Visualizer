import { MathWorkerHandler } from "../types";
import { getParsedNode, parseAndAdjustForCompile } from "../utils/parse";

const toTex: MathWorkerHandler<{ expression: string; coloredVars?: Record<string, string> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const node = getParsedNode(context.registry, payload.expression);
  if (payload.coloredVars) {
    const tex = node.toTex({
      handler: (n: any) => {
        if (n.isSymbolNode && payload.coloredVars![n.name]) {
          const color = payload.coloredVars![n.name];
          const display = n.name === "theta" ? "\\theta" : n.name.replace("_", "\\_");
          return `\\textcolor{${color}}{${display}}`;
        }
        return undefined;
      },
    });
    return { tex };
  }
  return { tex: node.toTex() };
};

const expressionToLatex: MathWorkerHandler<{ expression: string; coloredVars?: Record<string, string> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const getLatex = (exprStr: string) => {
    const n = context.math.parse(exprStr);
    if (payload.coloredVars) {
      return n.toTex({
        handler: (node: any) => {
          if (node.isSymbolNode && payload.coloredVars![node.name]) {
            const color = payload.coloredVars![node.name];
            const display = node.name === "theta" ? "\\theta" : node.name.replace("_", "\\_");
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
      node = context.math.parse(payload.expression);
      latex = getLatex(payload.expression);
    } catch (parseError: any) {
      const eqIndex = payload.expression.indexOf("=");
      if (
        eqIndex !== -1 &&
        !payload.expression.includes("==") &&
        !payload.expression.includes(">=") &&
        !payload.expression.includes("<=") &&
        !payload.expression.includes("!=")
      ) {
        const lhs = payload.expression.slice(0, eqIndex);
        const rhs = payload.expression.slice(eqIndex + 1);
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
};

const expressionToLatexWithEval: MathWorkerHandler<{ expression: string; coloredVars?: Record<string, string>; scope?: Record<string, any> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const latexResult = expressionToLatex(payload, context);

  if (latexResult.error || !latexResult.hasNode || !payload.scope) {
    return latexResult;
  }

  try {
    const node = context.math.parse(payload.expression);
    let hasAlgebraic = false;
    node.traverse((n: any) => {
      if (n.isFunctionNode && ["derivative", "simplify", "rationalize"].includes(n.fn.name)) {
        hasAlgebraic = true;
      }
    });

    let resStr = "";
    if (hasAlgebraic) {
      const transformed = parseAndAdjustForCompile(context.registry, payload.expression);
      if (transformed) {
        resStr = transformed.toString();
      }
    } else {
      const scope = context.createMathScope(payload.scope);
      const result = node.evaluate(scope);
      if (result !== undefined && typeof result !== "function") {
        resStr = context.math.format(result, { precision: 5 });
      }
    }

    if (resStr && resStr !== payload.expression.trim()) {
      return { ...latexResult, evalResult: resStr };
    }
  } catch (e) {
    // Could happen for unassigned variables in scope
  }

  return latexResult;
};

export default {
  toTex,
  expressionToLatex,
  expressionToLatexWithEval,
};
