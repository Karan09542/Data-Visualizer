/**
 * Turns raw mathjs error text into something a person can act on.
 * Shared by the main thread (components/math-node/mathTypes.ts) and the math worker
 * (workers/math/utils/helpers.ts) so both report problems the same way.
 */

// Common mathjs functions, for "did you mean" suggestions.
const KNOWN_FUNCTIONS = [
  "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh", "cbrt", "ceil",
  "cos", "cosh", "cot", "csc", "det", "exp", "floor", "gamma", "hypot", "inv", "log",
  "log10", "log2", "max", "mean", "median", "min", "mod", "norm", "nthRoot", "pow",
  "random", "round", "sec", "sign", "simplify", "sin", "sinh", "sqrt", "square",
  "std", "sum", "tan", "tanh", "transpose", "derivative",
];

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function nearestFunction(name: string): string | null {
  const lower = name.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of KNOWN_FUNCTIONS) {
    const d = editDistance(lower, candidate.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  // Only suggest something genuinely close.
  return best && bestDist <= Math.max(1, Math.floor(name.length / 3)) ? best : null;
}

export function friendlyMathError(errMessage: string): string {
  if (!errMessage) return errMessage;

  const undefinedFn = errMessage.match(/Undefined function\s+([^\s(]+)/i);
  if (undefinedFn) {
    const name = undefinedFn[1];
    const suggestion = nearestFunction(name);
    return suggestion
      ? `There's no function called "${name}". Did you mean ${suggestion}()?`
      : `There's no function called "${name}".`;
  }

  const undefinedSymbol =
    errMessage.match(/Undefined symbol\s+([^\s]+)/i) ||
    errMessage.match(/Symbol\s+([^\s]+)\s+is undefined/i);
  if (undefinedSymbol) {
    return `"${undefinedSymbol[1]}" isn't defined yet — add it as a variable, or check the spelling.`;
  }

  const parenthesis = errMessage.match(/Parenthesis\s+(\)|\])\s+expected/i);
  if (parenthesis) {
    return `Missing a closing "${parenthesis[1]}".`;
  }

  if (/Unexpected end of expression/i.test(errMessage)) {
    return "The expression looks unfinished — something is missing at the end.";
  }

  if (/False part of conditional expression expected/i.test(errMessage)) {
    return 'A piecewise needs an "otherwise" value: condition ? value : otherwise';
  }

  if (/Value expected/i.test(errMessage)) {
    return "Something is missing here — check for a stray operator or an empty bracket.";
  }

  if (/Unexpected operator/i.test(errMessage)) {
    return "Two operators in a row — check for a typo like ** or +*.";
  }

  if (/Invalid left hand side of assignment/i.test(errMessage)) {
    return 'Only a name can go on the left of "=", e.g. y = x^2 (for a curve through x and y, use the Implicit type).';
  }

  if (/Dimension mismatch/i.test(errMessage)) {
    return "These values have different sizes, so they can't be combined.";
  }

  return errMessage;
}
