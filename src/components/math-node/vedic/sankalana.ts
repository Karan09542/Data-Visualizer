/**
 * Sankalana Vyavakalanabhyam: "by addition and by subtraction".
 *
 * When the x and y numbers of two equations are swapped,
 *   45x − 23y = 113
 *   23x − 45y = 91
 * adding gives 68x − 68y = 204 → x − y = 3, subtracting gives 22x + 22y = 22 → x + y = 1,
 * and then x = (1 + 3) ÷ 2 = 2, y = (1 − 3) ÷ 2 = −1.
 */
import { Q } from "./shunyam";

/** One combined equation: kx + ly = r, where |k| = |l|, so it reads x ± y = r/k. */
export interface Combined {
  k: number;
  l: number;
  r: number;
  /** +1: it gives x + y; −1: it gives x − y. */
  sign: 1 | -1;
  value: Q;
}

export interface SankalanaPlan {
  a: number;
  b: number;
  p: number;
  c: number;
  d: number;
  q: number;
  det: number;
  /** The x and y numbers are swapped (b, a) or swapped with signs changed (−b, −a). */
  swapped: boolean;
  add: Combined | null;
  sub: Combined | null;
  /** The subtraction is done as (2) − (1), so its x number is positive. */
  subFlipped: boolean;
  /** x + y and x − y. */
  sum: Q | null;
  diff: Q | null;
  x: Q | null;
  y: Q | null;
}

function combine(k: number, l: number, r: number): Combined | null {
  if (k === 0 || Math.abs(k) !== Math.abs(l)) return null;
  return { k, l, r, sign: l === k ? 1 : -1, value: new Q(r, k) };
}

export function planSankalana(a: number, b: number, p: number, c: number, d: number, q: number): SankalanaPlan {
  const det = a * d - b * c;
  const add = det !== 0 ? combine(a + c, b + d, p + q) : null;
  const subFlipped = a - c < 0;
  const sub = det !== 0 ? (subFlipped ? combine(c - a, d - b, q - p) : combine(a - c, b - d, p - q)) : null;
  // With det ≠ 0, both combine only for a swapped pair, and then one gives x + y, the other x − y.
  const swapped = !!add && !!sub && add.sign !== sub.sign;
  let sum: Q | null = null;
  let diff: Q | null = null;
  let x: Q | null = null;
  let y: Q | null = null;
  if (swapped) {
    sum = add!.sign === 1 ? add!.value : sub!.value;
    diff = add!.sign === 1 ? sub!.value : add!.value;
    x = sum.add(diff).div(2);
    y = sum.add(diff.mul(-1)).div(2);
  } else if (det !== 0) {
    x = new Q(p * d - b * q, det);
    y = new Q(a * q - p * c, det);
  }
  return { a, b, p, c, d, q, det, swapped, add: swapped ? add : null, sub: swapped ? sub : null, subFlipped, sum, diff, x, y };
}

/** Two numbers from their sum and difference: (s + t) ÷ 2 and (s − t) ÷ 2. */
export function fromSumAndDifference(s: number, t: number) {
  return { big: new Q(s + t, 2), small: new Q(s - t, 2) };
}
