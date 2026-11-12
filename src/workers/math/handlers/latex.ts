import { MathWorkerHandler } from "../types";
import { getParsedNode, parseAndAdjustForCompile } from "../utils/parse";
import {
  parseFamilyExpression,
  evaluateFamilyValues,
  familyToLatex,
} from "../../../lib/math/familyPlot";
import { lambertWToTex } from "../../../lib/math/lambertW";

function createTexHandler(coloredVars?: Record<string, string>) {
  return (node: any, options: any): string | undefined => {
    const lambertTex = lambertWToTex(node, options);
    if (lambertTex !== undefined) return lambertTex;

    if (node.isSymbolNode && coloredVars?.[node.name]) {
      const defaultTex = node.toTex({ handler: undefined });
      return `\\textcolor{${coloredVars[node.name]}}{${defaultTex}}`;
    }
    return undefined;
  };
}

const toTex: MathWorkerHandler<{ expression: string; coloredVars?: Record<string, string> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const node = getParsedNode(context.registry, payload.expression);
  const tex = node.toTex({ handler: createTexHandler(payload.coloredVars) });
  return { tex };
};

const expressionToLatex: MathWorkerHandler<{ expression: string; coloredVars?: Record<string, string> }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const handler = createTexHandler(payload.coloredVars);
  const getLatex = (exprStr: string) => {
    const n = context.math.parse(exprStr);
    return n.toTex({ handler });
  };

  const family = parseFamilyExpression(payload.expression);
  if (family) {
    try {
      let innerLatex = "";
      try {
        innerLatex = getLatex(family.expr);
      } catch {
        innerLatex = family.expr;
      }
      const latex = familyToLatex(family, innerLatex);
      return { latex, hasNode: true };
    } catch (e: any) {
      return { error: e.message || String(e) };
    }
  }

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

  const family = parseFamilyExpression(payload.expression);
  if (family) {
    const { values } = evaluateFamilyValues(family, payload.scope);
    const evalResult = `${values.length} curves (${family.variable} = ${values[0]}..${values[values.length - 1]})`;
    return { ...latexResult, evalResult };
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
