/**
 * Ekadhikena Purvena for two numbers whose tens parts are the same and whose unit
 * digits add up to 10 (every square of a number ending in 5 is one):
 *   left  = tens × (tens + 1)
 *   right = unit × unit, always written with two digits
 *   53 × 57 = 5×6 | 3×7 = 30 | 21 = 3021
 */

export interface EkadhikenaPlan {
  a: number;
  b: number;
  /** The part before the unit digit: 5 in 53, 12 in 123. */
  tens: number;
  ua: number;
  ub: number;
  /** One more than the tens part: the "ekadhika". */
  next: number;
  left: number;
  right: number;
  /** The right part with its two digits: 9 → "09". */
  rightText: string;
  answer: string;
}

/** Why two numbers don't fit, with the numbers that show it. */
export interface EkadhikenaMiss {
  reason: "range" | "tens" | "units";
  tensA?: number;
  tensB?: number;
  ua?: number;
  ub?: number;
}

export type EkadhikenaCheck = { ok: true; plan: EkadhikenaPlan; miss?: undefined } | { ok: false; plan?: undefined; miss: EkadhikenaMiss };

export const MAX_NUMBER = 9999;

export function planEkadhikena(a: number, b: number): EkadhikenaCheck {
  if (![a, b].every((x) => Number.isInteger(x) && x >= 1 && x <= MAX_NUMBER)) return { ok: false, miss: { reason: "range" } };
  const tens = Math.floor(a / 10);
  const tensB = Math.floor(b / 10);
  if (tens !== tensB) return { ok: false, miss: { reason: "tens", tensA: tens, tensB } };
  const ua = a % 10;
  const ub = b % 10;
  if (ua + ub !== 10) return { ok: false, miss: { reason: "units", ua, ub } };
  const next = tens + 1;
  const left = tens * next;
  const right = ua * ub;
  const rightText = String(right).padStart(2, "0");
  // 5 × 5: the left part is 0, so the answer is just the right part.
  const answer = left === 0 ? String(right) : `${left}${rightText}`;
  return { ok: true, plan: { a, b, tens, ua, ub, next, left, right, rightText, answer } };
}
