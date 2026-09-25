import { MathWorkerHandler } from "../types";
import { parseAndAdjustForCompile } from "../utils/parse";
import { formatMathError } from "../utils/helpers";
import { splitRelation } from "../../../lib/math/splitRelation";
import { odeExportName, parseOdeSystem } from "../../../lib/math/odeSystem";

const BUILTINS = ["x", "y", "t", "time", "ln", "log10", "Line", "Vector", "Polygon", "Point", "indexHelper"];
// theta/θ are only implicit (the swept angle) for polar curves; elsewhere a theta is a
// normal variable the user should be offered as a slider.
const POLAR_BUILTINS = ["theta", "θ"];

function buildScope(context: any, payload: any) {
  // theta defaults to 0 first so a user variable named theta overrides it.
  const tempBaseScope: any = { theta: 0 };
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

function extractVariables(
  node: any,
  assignedVars: Set<string>,
  varsToAdd: Set<string>,
  context: any,
  extraBuiltins: string[] = [],
) {
  // Parameters of a definition like pos(s) = A*cos(w*s) are local to it, not sliders.
  const params = new Set<string>();
  node.traverse((n: any) => {
    if (n.isAssignmentNode) {
      if (n.object && n.object.isSymbolNode) assignedVars.add(n.object.name);
      else if (n.name) assignedVars.add(n.name);
    }
    if (n.isFunctionAssignmentNode) {
      assignedVars.add(n.name);
      for (const p of n.params || []) params.add(p);
    }
  });

  node.traverse((n: any) => {
    if (
      n.isSymbolNode &&
      !BUILTINS.includes(n.name) &&
      !extraBuiltins.includes(n.name) &&
      !params.has(n.name) &&
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
        // Split at the first top-level operator (see lib/math/splitRelation), so a
        // comparison nested inside the expression isn't cut in half.
        const split = splitRelation(f.expr, f.type);
        const op = split ? split.operator : f.type === "inequality" ? "<" : "=";
        const lhsStr = (split ? split.lhs : f.expr.trim()) || "0";
        const rhsStr = (split ? split.rhs : "0") || "0";

        const lhs = compileExpression(context, lhsStr);
        const rhs = compileExpression(context, rhsStr);

        if (f.label && !f.label.includes("{{")) assignedVars.add(f.label);
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

      if (f.type === "differential") {
        const system = parseOdeSystem(f.expr);
        if (system.error) return { id: f.id, compiledKey: undefined, error: system.error };

        // State names are solved for, not user variables, so they must not be
        // reported as missing (which would offer to add them as sliders).
        const stateIds = new Set<string>();
        for (const s of system.states) {
          stateIds.add(s.id);
          assignedVars.add(s.id);
          // Published for other rows to follow (x, dx for x'); see math-node/scope.ts.
          assignedVars.add(odeExportName(s));
        }

        let error: string | undefined;
        let firstKey: string | undefined;
        for (const s of system.states) {
          for (const exprStr of [s.derivative, s.initial || "0"]) {
            const compiledPart = compileExpression(context, exprStr);
            if (!firstKey) firstKey = compiledPart.key;
            const node = context.registry.getParsedNode(exprStr);
            if (node) {
              extractVariables(node, assignedVars, varsToAdd, context, Array.from(stateIds));
            }
            if (!error) {
              try {
                const fScope = Object.create(tempBaseScope);
                fScope.t = system.t0;
                for (const id of stateIds) fScope[id] = 0;
                compiledPart.compiled.evaluate(fScope);
              } catch (evalErr: any) {
                error = formatMathError(evalErr.message || String(evalErr));
              }
            }
          }
        }

        // Later rows can use the solved state (x, dx, …); give it a stand-in value so
        // checking those rows here doesn't report it as undefined. Sliders keep theirs.
        for (const s of system.states) {
          const name = odeExportName(s);
          if (!payload.variableNames.includes(name) && !["t", "time", "pi", "e", "i"].includes(name)) {
            tempBaseScope[name] = 0;
          }
        }

        return { id: f.id, compiledKey: firstKey, error };
      }

      const { key, compiled } = compileExpression(context, f.expr);
      if (f.label && !f.label.includes("{{")) assignedVars.add(f.label);
      if (f.name) assignedVars.add(f.name);

      const node = context.registry.getParsedNode(f.expr);
      if (node) {
        extractVariables(
          node,
          assignedVars,
          varsToAdd,
          context,
          f.type === "polar" ? POLAR_BUILTINS : [],
        );
      }

      let error: string | undefined;
      try {
        const fTime = f.hasCustomTimeline ? (f.time !== undefined ? f.time : 0) : payload.time;
        const fScope = Object.create(tempBaseScope);
        fScope.t = fTime;
        fScope.time = payload.time;
        fScope.x = 0;
        fScope.y = 0;
        if (f.type === "polar") fScope.theta = fScope["θ"] = 0;

        const val = compiled.evaluate(fScope);

        for (const scopeKey of Object.keys(fScope)) {
          if (scopeKey !== "t" && scopeKey !== "time" && scopeKey !== "theta" && scopeKey !== "x" && scopeKey !== "y") {
            tempBaseScope[scopeKey] = fScope[scopeKey];
          }
        }

        const refName = f.label && !f.label.includes("{{") ? f.label : f.name;
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
