/**
 * The calculator row: evaluate as you type, exactly enough to trust the digits.
 *
 * Arithmetic runs in mathjs' BigNumber mode (64 significant digits), so
 * 0.1 + 0.2 is 0.3 and 2^64 is 18446744073709551616, not 1.8446744073709552e19.
 * Values from sliders and other rows are ordinary numbers; they are converted on the
 * way in. If something only works in ordinary precision (a helper row defined with
 * plain numbers, say), it is evaluated that way instead and marked approximate.
 */
import { all, create } from "mathjs";
import * as mathjs from "mathjs";

const big = create(all, { number: "BigNumber", precision: 64 });

/** How a number is written: normal digits, ×10^n, or whichever reads better. */
export type CalcNotation = "auto" | "normal" | "scientific";

export interface FormattedNumber {
  /** Plain text, e.g. "1.8446744 × 10^19" or "18,446,744,073,709,551,616". */
  text: string;
  /** KaTeX source for the same. */
  tex: string;
  /** What the copy button puts on the clipboard: no grouping, "e" exponent. */
  copy: string;
  notation: "normal" | "scientific";
}

export type CalcResult =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "number";
      primary: FormattedNumber;
      /** The same value in the other notation, when that helps (big or tiny values). */
      alternate?: FormattedNumber;
      /** Evaluated in ordinary floating point: the last digits may be off. */
      approximate: boolean;
    }
  | { kind: "text"; text: string; copy: string; approximate: boolean };

type Big = any; // Decimal.js instance behind mathjs' BigNumber

const isBig = (v: any): v is Big => v && v.isBigNumber === true;

/** Converts the graph's values (plain numbers) so they mix with BigNumbers. */
function toBigScope(scope: Record<string, any>): Map<string, any> {
  const out = new Map<string, any>();
  for (const key in scope) {
    const v = scope[key];
    if (typeof v === "number") out.set(key, big.bignumber(v));
    else if (v !== undefined) out.set(key, v);
  }
  return out;
}

function toPlainScope(scope: Record<string, any>): Map<string, any> {
  const out = new Map<string, any>();
  for (const key in scope) if (scope[key] !== undefined) out.set(key, scope[key]);
  return out;
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const superscript = (n: number) => String(n).split("").map((c) => SUPERSCRIPT[c] ?? c).join("");

/** 1234567.5 -> "1,234,567.5" (integer part only). */
function groupDigits(s: string): string {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const [int, frac] = body.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (frac !== undefined ? "." + frac : "");
}

function formatScientific(v: Big, digits: number): FormattedNumber {
  if (v.isZero()) return { text: "0", tex: "0", copy: "0", notation: "scientific" };
  const [mantRaw, expRaw] = v.toExponential(Math.max(0, digits - 1)).split("e");
  // Trailing zeros carry no information once the precision is chosen.
  const mant = mantRaw.includes(".") ? mantRaw.replace(/\.?0+$/, "") : mantRaw;
  const exp = Number(expRaw);
  return {
    text: `${mant} × 10${superscript(exp)}`,
    tex: `${mant} \\times 10^{${exp}}`,
    copy: `${mant}e${exp}`,
    notation: "scientific",
  };
}

function formatNormal(v: Big, digits: number): FormattedNumber {
  // Whole numbers are shown exactly (2^64 keeps all 20 digits); anything with a
  // fraction is rounded to the chosen number of significant digits.
  const exact = v.isInteger() && v.abs().lt("1e64");
  const plain = exact ? v.toFixed() : v.toSignificantDigits(digits).toFixed();
  const trimmed = plain.includes(".") ? plain.replace(/\.?0+$/, "") : plain;
  const grouped = groupDigits(trimmed === "-0" ? "0" : trimmed);
  return {
    text: grouped,
    tex: grouped.replace(/,/g, "{,}"),
    copy: trimmed,
    notation: "normal",
  };
}

/** Normal digits while they stay readable, ×10^n beyond that. */
function readableInNormal(v: Big): boolean {
  if (v.isZero()) return true;
  const e = v.e; // decimal exponent: 1234 -> 3, 0.001 -> -3
  return e >= -6 && e < 21;
}

export function formatCalcNumber(value: number | Big, notation: CalcNotation, digits: number): {
  primary: FormattedNumber;
  alternate?: FormattedNumber;
} {
  const v: Big = isBig(value) ? value : big.bignumber(value);
  const useSci = notation === "scientific" || (notation === "auto" && !readableInNormal(v));
  const primary = useSci ? formatScientific(v, digits) : formatNormal(v, digits);

  // Show the other notation too when the number is big or tiny: seeing
  // 18,446,744,073,709,551,616 next to 1.8446744 × 10¹⁹ is the point.
  let alternate: FormattedNumber | undefined;
  if (!v.isZero()) {
    const e = v.e;
    if (primary.notation === "normal" && (e >= 6 || e <= -4)) alternate = formatScientific(v, Math.min(digits, 10));
    else if (primary.notation === "scientific" && readableInNormal(v)) alternate = formatNormal(v, digits);
  }
  return { primary, alternate };
}

function formatOther(value: any, notation: CalcNotation, digits: number): string {
  const options: any = { precision: digits };
  if (notation === "scientific") options.notation = "exponential";
  else if (notation === "normal") options.notation = "fixed";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value === "function") return `function ${value.syntax ?? ""}`.trim();
  try {
    return big.format(value, options);
  } catch {
    return String(value);
  }
}

const parseCache = new Map<string, { node: any; error?: string }>();
function parse(expr: string) {
  const hit = parseCache.get(expr);
  if (hit) return hit;
  let entry: { node: any; error?: string };
  try {
    entry = { node: big.parse(expr) };
  } catch (e: any) {
    entry = { node: null, error: e?.message || String(e) };
  }
  if (parseCache.size > 300) parseCache.clear();
  parseCache.set(expr, entry);
  return entry;
}

/** mathjs returns a ResultSet for "a = 2; a^2"; the answer is the last entry. */
const lastValue = (v: any) => (v && v.isResultSet ? v.entries[v.entries.length - 1] : v);

/**
 * Evaluates a calculator row. `scope` is the graph's scope (sliders, definitions,
 * time); assignments inside the row (`r = 2; pi*r^2`) stay local to it.
 */
export function calculate(
  expr: string,
  scope: Record<string, any>,
  notation: CalcNotation = "auto",
  digits = 15,
): CalcResult {
  if (!expr || !expr.trim()) return { kind: "empty" };
  const parsed = parse(expr);
  if (!parsed.node) return { kind: "error", message: friendlyCalcError(parsed.error || "") };

  let value: any;
  let approximate = false;
  try {
    value = lastValue(parsed.node.compile().evaluate(toBigScope(scope)));
  } catch (bigError: any) {
    try {
      value = lastValue(mathjs.evaluate(expr, toPlainScope(scope)));
      approximate = true;
    } catch {
      return { kind: "error", message: friendlyCalcError(bigError?.message || String(bigError)) };
    }
  }

  if (isBig(value) || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      const text = Number.isNaN(value) ? "not a number" : value > 0 ? "∞" : "-∞";
      return { kind: "text", text, copy: String(value), approximate };
    }
    if (isBig(value) && !value.isFinite()) {
      const text = value.isNaN() ? "not a number" : value.isPositive() ? "∞" : "-∞";
      return { kind: "text", text, copy: text, approximate };
    }
    // A plain number that came back from the fallback: still exact to its 17 digits.
    return { kind: "number", ...formatCalcNumber(value, notation, digits), approximate: approximate || typeof value === "number" };
  }
  if (value === undefined) return { kind: "empty" };
  const text = formatOther(value, notation, digits);
  return { kind: "text", text, copy: text, approximate };
}

/** mathjs messages, in plainer words. */
export function friendlyCalcError(message: string): string {
  const undefinedSymbol = message.match(/Undefined symbol (\w+)/);
  if (undefinedSymbol) return `"${undefinedSymbol[1]}" isn't defined. Add it as a slider, or check the spelling.`;
  if (/Unexpected end of expression/.test(message)) return "The expression isn't finished yet.";
  if (/Parenthesis \) expected/.test(message)) return "A bracket is missing: add “)”.";
  if (/Value expected/.test(message)) return "A number or name is missing here.";
  if (/Units do not match/.test(message)) return "Those units can't be converted into each other.";
  return message.replace(/\s*\(char \d+\)/, "");
}
