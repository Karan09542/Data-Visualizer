/**
 * Multiplying two numbers from 11 to 19.
 *
 *   15 × 18:  15 + 8 = 23  (one number + the other's unit digit)
 *             5 × 8 = 40   (the unit digits multiplied)
 *             23 / 40 → Balancing Rule (one digit on the right): 23 + 4 = 27 / 0 → 270
 *
 * Why: (10 + a)(10 + b) = 10 × (10 + a + b) + a × b.
 */

export const MIN = 11;
export const MAX = 19;

export interface TeensPlan {
  a: number;
  b: number;
  /** The unit digits. */
  ua: number;
  ub: number;
  /** a + ub (the same as b + ua). */
  left: number;
  /** ua × ub, before balancing. */
  right: number;
  /** Balancing: the right part keeps one digit, the rest carries left. */
  carry: number;
  keep: number;
  finalLeft: number;
  answer: number;
}

export function planTeens(a: number, b: number): TeensPlan | null {
  if (![a, b].every((n) => Number.isInteger(n) && n >= MIN && n <= MAX)) return null;
  const ua = a % 10;
  const ub = b % 10;
  const left = a + ub;
  const right = ua * ub;
  const carry = Math.floor(right / 10);
  const keep = right % 10;
  const finalLeft = left + carry;
  return { a, b, ua, ub, left, right, carry, keep, finalLeft, answer: finalLeft * 10 + keep };
}
