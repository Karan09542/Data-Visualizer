export interface RelationSplit {
  lhs: string;
  rhs: string;
  operator: string;
}

/**
 * Splits "x^2 + y^2 = 4" or "y < sin(x)" into sides, at the first *top-level* operator —
 * one that isn't nested inside (), [] or {}. A naive split breaks expressions that
 * contain comparisons inside them, e.g. a piecewise region `y < (x < 0 ? 1 : 2)`.
 * Returns null when the expression has no relation operator at the top level.
 */
export function splitRelation(
  expr: string,
  type: "implicit" | "inequality",
): RelationSplit | null {
  let depth = 0;

  const at = (index: number, length: number, operator: string): RelationSplit => ({
    lhs: expr.slice(0, index).trim(),
    rhs: expr.slice(index + length).trim(),
    operator,
  });

  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      continue;
    }
    if (depth !== 0) continue;

    const two = expr.slice(i, i + 2);
    if (type === "inequality") {
      if (two === "<=" || two === ">=") return at(i, 2, two);
      if ((c === "<" || c === ">") && expr[i + 1] !== "=") return at(i, 1, c);
    } else {
      // Skip comparison operators that merely contain "=".
      if (two === "==" || two === "<=" || two === ">=" || two === "!=") {
        i++;
        continue;
      }
      if (c === "=") return at(i, 1, "=");
    }
  }

  return null;
}
