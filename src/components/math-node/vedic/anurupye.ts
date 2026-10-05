/**
 * Anurupye Shunyamanyat: "if one is in ratio, the other one is zero".
 *
 *   ax + by = p
 *   cx + dy = q
 *
 * If the x numbers are in the same ratio as the right-hand numbers (a : c = p : q),
 * then y = 0 and x = p/a. If the y numbers are (b : d = p : q), then x = 0.
 *   12x + 78y = 12, 16x + 96y = 16:  12 : 16 = 12 : 16  →  y = 0, x = 1
 */
import { Q } from "./shunyam";

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** m : n in lowest terms, with the second number not negative: 12 : 16 → 3 : 4. */
export function reduceRatio(m: number, n: number): [number, number] {
  const g = gcd(Math.abs(m), Math.abs(n)) || 1;
  const s = n < 0 || (n === 0 && m < 0) ? -1 : 1;
  return [(s * m) / g + 0, (s * n) / g + 0];
}

/** m : n and u : v are the same ratio (m·v = n·u). */
export const sameRatio = (m: number, n: number, u: number, v: number) => m * v === n * u;

export interface AnurupyePlan {
  a: number;
  b: number;
  p: number;
  c: number;
  d: number;
  q: number;
  /** ad − bc: zero means no single answer. */
  det: number;
  /** a : c = p : q, so y = 0. */
  xInRatio: boolean;
  /** b : d = p : q, so x = 0. */
  yInRatio: boolean;
  /** Which equation (0 or 1) to put the zero into: the one whose other number isn't 0. */
  use: 0 | 1;
  x: Q | null;
  y: Q | null;
}

export function planAnurupye(a: number, b: number, p: number, c: number, d: number, q: number): AnurupyePlan {
  const det = a * d - b * c;
  const xInRatio = det !== 0 && sameRatio(a, c, p, q);
  const yInRatio = det !== 0 && sameRatio(b, d, p, q);
  let x: Q | null = null;
  let y: Q | null = null;
  let use: 0 | 1 = 0;
  if (det !== 0) {
    if (xInRatio && yInRatio) {
      // Only possible when p = q = 0.
      x = new Q(0);
      y = new Q(0);
    } else if (xInRatio) {
      use = a !== 0 ? 0 : 1;
      x = use === 0 ? new Q(p, a) : new Q(q, c);
      y = new Q(0);
    } else if (yInRatio) {
      use = b !== 0 ? 0 : 1;
      x = new Q(0);
      y = use === 0 ? new Q(p, b) : new Q(q, d);
    } else {
      // The long way: cross-multiplication.
      x = new Q(p * d - b * q, det);
      y = new Q(a * q - p * c, det);
    }
  }
  return { a, b, p, c, d, q, det, xInRatio, yInRatio, use, x, y };
}
