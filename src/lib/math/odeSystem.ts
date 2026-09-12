/**
 * Parses a differential-equation system written the way it's written on paper:
 *
 *   x'' = -k*x - c*x'; x(0) = 1; x'(0) = 0
 *
 * Equations of any order are allowed, separated by ";" or new lines. Higher-order
 * equations are reduced to first order internally: x'' introduces the states x and x'.
 * Starting values default to 0.
 */

const IDENT_START = "A-Za-z_$\\u00C0-\\u02AF\\u0370-\\u03FF\\u2100-\\u214F";
const IDENT_CHARS = IDENT_START + "0-9";
const IDENT_RE = new RegExp(`^[${IDENT_START}][${IDENT_CHARS}]*`);

export interface OdeState {
  /** Identifier used inside the rewritten expressions, e.g. "x" or "x__d1". */
  id: string;
  /** How it is shown to the user, e.g. "x" or "x'". */
  display: string;
  /** Expression for this state's derivative, in terms of state ids, t and variables. */
  derivative: string;
  /** Expression for this state's value at t0. */
  initial: string;
}

export interface OdeSystem {
  states: OdeState[];
  t0: number;
  error?: string;
}

const stateId = (name: string, order: number) => (order === 0 ? name : `${name}__d${order}`);
const stateDisplay = (name: string, order: number) => name + "'".repeat(order);

/** Split on ";" and newlines, ignoring separators inside brackets (e.g. a matrix [1;2]). */
export function splitStatements(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (quote) {
      current += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      // A quote directly after an identifier, ")" or another prime is a derivative
      // mark, not the start of a string (x'' is two marks, not an empty string).
      const prev = current.trimEnd().slice(-1);
      const isDerivativeMark = c === "'" && prev !== "" && /[\w)\]']/.test(prev);
      if (!isDerivativeMark) quote = c;
      current += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;

    if (depth === 0 && (c === ";" || c === "\n")) {
      out.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * Rewrites derivative marks on declared states into plain identifiers
 * (x' -> x__d1), leaving string literals alone. mathjs reads "'" as transpose, so any
 * mark left behind would silently evaluate to something else and must be rejected.
 */
function rewriteDerivativeMarks(
  expr: string,
  orderOf: Map<string, number>,
): { text: string; leftover: string | null } {
  let out = "";
  let leftover: string | null = null;
  let i = 0;
  let quote: string | null = null;

  while (i < expr.length) {
    const c = expr[i];

    if (quote) {
      out += c;
      if (c === quote) quote = null;
      i++;
      continue;
    }

    const identMatch = expr.slice(i).match(IDENT_RE);
    if (identMatch) {
      const name = identMatch[0];
      let j = i + name.length;
      let primes = 0;
      while (expr[j] === "'") {
        primes++;
        j++;
      }
      if (primes > 0) {
        if (orderOf.has(name)) out += stateId(name, primes);
        else {
          out += name + "'".repeat(primes);
          leftover = name;
        }
      } else {
        out += name;
      }
      i = j;
      continue;
    }

    if (c === '"') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "'") {
      // A mark not attached to an identifier (or an opening string quote).
      leftover = leftover ?? "'";
      out += c;
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return { text: out, leftover };
}

const fail = (error: string): OdeSystem => ({ states: [], t0: 0, error });

export function parseOdeSystem(expr: string): OdeSystem {
  const statements = splitStatements(expr || "");
  if (statements.length === 0) {
    return fail("Write an equation like  x' = v;  or  x'' = -k*x");
  }

  const derivatives = new Map<string, { order: number; rhs: string }>();
  const initials = new Map<string, string>();
  const initialTimes: number[] = [];

  for (let s = 0; s < statements.length; s++) {
    const statement = statements[s];
    const where = statements.length > 1 ? `Line ${s + 1}: ` : "";

    const initialMatch = statement.match(
      new RegExp(`^([${IDENT_START}][${IDENT_CHARS}]*)('*)\\s*\\(([^)]*)\\)\\s*=\\s*(.+)$`),
    );
    if (initialMatch) {
      const [, name, primes, at, value] = initialMatch;
      const t0 = Number(at.trim());
      if (!Number.isFinite(t0)) {
        return fail(`${where}starting values look like  ${name}${primes}(0) = 1`);
      }
      initialTimes.push(t0);
      initials.set(`${name}|${primes.length}`, value.trim());
      continue;
    }

    const derivativeMatch = statement.match(
      new RegExp(`^([${IDENT_START}][${IDENT_CHARS}]*)('+)\\s*=\\s*(.+)$`),
    );
    if (derivativeMatch) {
      const [, name, primes, rhs] = derivativeMatch;
      if (name === "t" || name === "time") {
        return fail(`${where}"${name}" is time itself, so it can't be solved for.`);
      }
      const existing = derivatives.get(name);
      if (existing) {
        return fail(`${where}"${name}" already has an equation.`);
      }
      derivatives.set(name, { order: primes.length, rhs: rhs.trim() });
      continue;
    }

    return fail(
      `${where}expected an equation like  x' = v  or  x'' = -k*x, or a starting value like  x(0) = 1`,
    );
  }

  if (derivatives.size === 0) {
    return fail("Add an equation like  x' = v  (a starting value alone isn't enough)");
  }

  if (initialTimes.length > 0) {
    const first = initialTimes[0];
    if (initialTimes.some((t) => t !== first)) {
      return fail("All starting values must be given at the same time, e.g. x(0) and x'(0)");
    }
  }
  const t0 = initialTimes.length > 0 ? initialTimes[0] : 0;

  const orderOf = new Map<string, number>();
  for (const [name, { order }] of derivatives) orderOf.set(name, order);

  // Starting values may only refer to states the equations actually introduce.
  for (const key of initials.keys()) {
    const [name, orderStr] = key.split("|");
    const order = Number(orderStr);
    const declared = orderOf.get(name);
    if (declared === undefined) {
      return fail(`"${name}" has a starting value but no equation (add ${name}' = …)`);
    }
    if (order >= declared) {
      return fail(
        `${stateDisplay(name, order)}(${t0}) isn't needed — ${stateDisplay(name, declared)} is what the equation defines`,
      );
    }
  }

  const states: OdeState[] = [];
  for (const [name, { order, rhs }] of derivatives) {
    for (let k = 0; k < order; k++) {
      const isLast = k === order - 1;
      const rawDerivative = isLast ? rhs : stateDisplay(name, k + 1);
      const rewritten = rewriteDerivativeMarks(rawDerivative, orderOf);
      if (rewritten.leftover) {
        return fail(
          `"${rewritten.leftover}${rewritten.leftover === "'" ? "" : "'"}" has no equation — every primed name needs one (e.g. ${rewritten.leftover}' = …)`,
        );
      }
      const rawInitial = initials.get(`${name}|${k}`) ?? "0";
      const initialRewritten = rewriteDerivativeMarks(rawInitial, orderOf);
      states.push({
        id: stateId(name, k),
        display: stateDisplay(name, k),
        derivative: rewritten.text,
        initial: initialRewritten.text,
      });
    }
  }

  return { states, t0 };
}

const systemCache = new Map<string, OdeSystem>();

/** parseOdeSystem, cached by expression text (it runs on every render). */
export function parseOdeSystemCached(expr: string): OdeSystem {
  const hit = systemCache.get(expr);
  if (hit) return hit;
  const parsed = parseOdeSystem(expr);
  if (systemCache.size > 200) systemCache.clear();
  systemCache.set(expr, parsed);
  return parsed;
}
