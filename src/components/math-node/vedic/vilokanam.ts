/**
 * Vilokanam for two two-digit numbers whose unit digits are the same and whose
 * tens digits add up to 10 (every square from 51 to 59 is one):
 *   left  = tens × tens + unit
 *   right = unit × unit, always written with two digits
 *   44 × 64 = 4×6 + 4 | 4×4 = 28 | 16 = 2816
 * since (10a + c)(10b + c) = 100(ab + c) + c² when a + b = 10.
 */

export interface VilokanamPlan {
  a: number;
  b: number;
  ta: number;
  tb: number;
  unit: number;
  /** tens × tens */
  product: number;
  /** tens × tens + unit */
  left: number;
  /** unit × unit */
  right: number;
  rightText: string;
  answer: string;
}

/** Why two numbers don't fit, with the numbers that show it. */
export interface VilokanamMiss {
  reason: "range" | "units" | "tens";
  ua?: number;
  ub?: number;
  ta?: number;
  tb?: number;
}

export type VilokanamCheck = { ok: true; plan: VilokanamPlan; miss?: undefined } | { ok: false; plan?: undefined; miss: VilokanamMiss };

export function planVilokanam(a: number, b: number): VilokanamCheck {
  if (![a, b].every((x) => Number.isInteger(x) && x >= 10 && x <= 99)) return { ok: false, miss: { reason: "range" } };
  const ua = a % 10;
  const ub = b % 10;
  if (ua !== ub) return { ok: false, miss: { reason: "units", ua, ub } };
  const ta = Math.floor(a / 10);
  const tb = Math.floor(b / 10);
  if (ta + tb !== 10) return { ok: false, miss: { reason: "tens", ta, tb } };
  const product = ta * tb;
  const left = product + ua;
  const right = ua * ua;
  const rightText = String(right).padStart(2, "0");
  return { ok: true, plan: { a, b, ta, tb, unit: ua, product, left, right, rightText, answer: `${left}${rightText}` } };
}
