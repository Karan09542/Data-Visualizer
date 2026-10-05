/**
 * A number's base: 1 followed by as many zeros as the number has digits
 * (7 → 10, 12 → 100, 123 → 1000), and its complement, base − n, found by
 * "all from 9 and the last from 10": 1000 − 357 → 9−3, 9−5, 10−7 = 643.
 *
 * Decimals work the same way: the base counts the digits before the point
 * (3.456 → 10, 0.375 → 1), and the point stays where it is: 10 − 3.456 = 6.544.
 */

export type ComplementKind = "nine" | "ten" | "zero" | "keep";

export interface ComplementStep {
  digit: number;
  /**
   * 9 − digit; 10 − digit for the last non-zero digit; a trailing 0 that stays 0;
   * or the 0 before the point of a number below 1, which stays 0.
   */
  kind: ComplementKind;
  result: number;
}

export interface BasePlan {
  /** The number as written, tidied: "03.4500" → "3.45". */
  n: string;
  /** Digits before the point, which set the base (0 for a number below 1). */
  digits: number;
  base: string;
  steps: ComplementStep[];
  /** Where the point goes: before steps[point]; null for a whole number. */
  point: number | null;
  /** base − n, with as many digits as n: 997 → 003, 3.456 → 6.544. */
  deficiency: string;
}

export const MAX_DIGITS = 8;
export const MAX_DECIMALS = 6;

export function planBase(text: string): BasePlan | null {
  const m = text.match(new RegExp(`^(\\d{1,${MAX_DIGITS}})(?:\\.(\\d{1,${MAX_DECIMALS}}))?$`));
  if (!m) return null;
  const whole = m[1].replace(/^0+(?=\d)/, "");
  // Zeros at the end of the decimals change nothing: 3.450 is 3.45.
  const frac = (m[2] ?? "").replace(/0+$/, "");
  if (whole === "0" && frac === "") return null;

  const belowOne = whole === "0";
  const all = whole + frac;
  // The last non-zero digit is taken from 10; zeros after it stay zeros.
  const last = all.search(/[1-9]0*$/);
  const steps: ComplementStep[] = [...all].map((ch, i) => {
    const digit = Number(ch);
    if (belowOne && i === 0) return { digit, kind: "keep", result: 0 };
    if (i < last) return { digit, kind: "nine", result: 9 - digit };
    if (i === last) return { digit, kind: "ten", result: 10 - digit };
    return { digit, kind: "zero", result: 0 };
  });
  const point = frac ? whole.length : null;
  const join = (d: string) => (point === null ? d : `${d.slice(0, point)}.${d.slice(point)}`);
  const digits = belowOne ? 0 : whole.length;
  return {
    n: join(all),
    digits,
    base: `1${"0".repeat(digits)}`,
    steps,
    point,
    deficiency: join(steps.map((s) => s.result).join("")),
  };
}
