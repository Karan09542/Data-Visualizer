import { MathWorkerHandler } from "../types";
import { parseAndAdjustForCompile } from "../utils/parse";
import { formatMathError } from "../utils/helpers";

const BUILTINS = ["x", "y", "t", "time", "theta", "ln", "log10", "Line", "Vector", "Polygon", "Point", "indexHelper"];

function buildScope(context: any, payload: any) {
  const tempBaseScope: any = {};
  for (let i = 0; i < payload.variableNames.length; i++) {
    tempBaseScope[payload.variableNames[i]] = payload.variableValues[i];
  }
  tempBaseScope.t = payload.time;
  tempBaseScope.time = payload.time;
  
  const scopeWithHelpers = context.createMathScope(tempBaseScope);

  payload.functions.forEach((f: any, idx: number) => {
    const fTime = f.hasCustomTimeline ? (f.time !== undefined ? f.time : 0) : payload.time;
    scopeWithHelpers[`t_${idx + 1}`] = fTime;
    if (f.name) {
      const match = f.name.match(/^([a-zA-Z0-9_]+)/);
      const fnId = match ? match[1] : f.name;
      if (fnId && fnId !== "t" && fnId !== "time") {
        scopeWithHelpers[`t_${fnId}`] = fTime;
      }
    }
  });

  return scopeWithHelpers;
}

function compileExpression(context: any, exprStr: string) {
  let key = context.registry.getCompiledKey(exprStr);
  let compiled: any;
  if (!key) {
    const node = parseAndAdjustForCompile(context.registry, exprStr);
    compiled = node.compile();
    key = context.registry.registerCompiled(exprStr, compiled);
  } else {
    compiled = context.registry.getCompiled(key);
  }
  return { key, compiled };
}

function extractVariables(node: any, assignedVars: Set<string>, varsToAdd: Set<string>, context: any) {
  node.traverse((n: any) => {
    if (n.isAssignmentNode) {
      if (n.object && n.object.isSymbolNode) assignedVars.add(n.object.name);
      else if (n.name) assignedVars.add(n.name);
    }
    if (n.isFunctionAssignmentNode) assignedVars.add(n.name);
  });

  node.traverse((n: any) => {
    if (
      n.isSymbolNode &&
      !BUILTINS.includes(n.name) &&
      !n.name.startsWith("t_") &&
      !(context.math as any)[n.name] &&
      !assignedVars.has(n.name)
    ) {
      varsToAdd.add(n.name);
    }
  });
}

const compile: MathWorkerHandler<{ expression: string }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  const { key } = compileExpression(context, payload.expression);
  return { key };
};

const compileFunctions: MathWorkerHandler<any> = (payload, context) => {
  const varsToAdd = new Set<string>();
  const assignedVars = new Set<string>();
  const tempBaseScope = buildScope(context, payload);

  const results = payload.functions.map((f: any, idx: number) => {
    if (idx % 10 === 0) {
      context.cancellationToken.throwIfCancelled();
    }
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

        const lhs = compileExpression(context, lhsStr);
        const rhs = compileExpression(context, rhsStr);

        if (f.label) assignedVars.add(f.label);
        if (f.name) assignedVars.add(f.name);

        const lhsNode = context.registry.getParsedNode(lhsStr);
        const rhsNode = context.registry.getParsedNode(rhsStr);
        if (lhsNode) extractVariables(lhsNode, assignedVars, varsToAdd, context);
        if (rhsNode) extractVariables(rhsNode, assignedVars, varsToAdd, context);

        let error: string | undefined;
        try {
          const fScope = Object.create(tempBaseScope);
          fScope.x = 0;
          fScope.y = 0;
          lhs.compiled.evaluate(fScope);
          rhs.compiled.evaluate(fScope);
        } catch (evalErr: any) {
          error = formatMathError(evalErr.message || String(evalErr));
        }

        return { id: f.id, compiledKey: lhs.key, compiled2Key: rhs.key, operator: op, error };
      }

      const { key, compiled } = compileExpression(context, f.expr);
      if (f.label) assignedVars.add(f.label);
      if (f.name) assignedVars.add(f.name);

      const node = context.registry.getParsedNode(f.expr);
      if (node) extractVariables(node, assignedVars, varsToAdd, context);

      let error: string | undefined;
      try {
        const fTime = f.hasCustomTimeline ? (f.time !== undefined ? f.time : 0) : payload.time;
        const fScope = Object.create(tempBaseScope);
        fScope.t = fTime;
        fScope.time = payload.time;
        fScope.x = 0;
        fScope.y = 0;

        const val = compiled.evaluate(fScope);

        for (const scopeKey of Object.keys(fScope)) {
          if (scopeKey !== "t" && scopeKey !== "time" && scopeKey !== "x" && scopeKey !== "y") {
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
      return { id: f.id, compiledKey: undefined, error: formatMathError(e.message || String(e)) };
    }
  });

  const currentVarNames = new Set(payload.variableNames as string[]);
  const missingVars = Array.from(varsToAdd).filter(v => !currentVarNames.has(v) && !assignedVars.has(v));

  return { results, missingVars };
};

export default {
  compile,
  compileFunctions,
};
