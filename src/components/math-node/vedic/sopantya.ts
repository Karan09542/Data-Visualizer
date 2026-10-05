/**
 * Sopantyadvayamantyam: "the ultimate and twice the penultimate".
 *
 * Equation, four factors that step evenly (x + 2, x + 3, x + 4, x + 5):
 *   1/((x+2)(x+3)) + 1/((x+2)(x+4)) = 1/((x+2)(x+5)) + 1/((x+3)(x+4))
 *   ultimate + 2 × penultimate = 0: (x + 5) + 2(x + 4) = 0 → 3x + 13 = 0 → x = −13/3
 *   Why: clearing the fractions leaves d·(3A + 7d) = 0, and 3A + 7d = D + 2C.
 *
 * Multiply by 12: each digit of the answer is 2 × the digit + its right neighbour (+ carry).
 *   132 × 12: 2×2 = 4, 2×3 + 2 = 8, 2×1 + 3 = 5, 0 + 1 = 1 → 1584. (× 11: digit + neighbour.)
 */
import { Q } from "./shunyam";

// ─── Equation ──────────────────────────────────────────────────────────────────

export interface EquationPlan {
  /** Factors x + p, x + q, x + r, x + s. */
  f: [number, number, number, number];
  /** They step evenly by `step` (≠ 0): the sutra applies. */
  even: boolean;
  step: number;
  /** (x + s) + 2(x + r) = 3x + (s + 2r) */
  constant: number;
  x: Q | null;
  /** Both sides at x, when no factor is 0 there. */
  value: Q | null;
  /** A factor is 0 at x, so the answer doesn't count. */
  blocked: boolean;
}

/** Left side − right side of the equation at x, or null when a factor is 0. */
function sides(f: [number, number, number, number], x: Q): [Q, Q] | null {
  const [A, B, C, D] = f.map((k) => x.add(k));
  if ([A, B, C, D].some((v) => v.zero)) return null;
  const inv = (v: Q) => new Q(v.d, v.n);
  return [inv(A.mul(B)).add(inv(A.mul(C))), inv(A.mul(D)).add(inv(B.mul(C)))];
}

export function planEquation(p: number, q: number, r: number, s: number): EquationPlan {
  const f: [number, number, number, number] = [p, q, r, s];
  const step = q - p;
  const even = step !== 0 && r - q === step && s - r === step;
  const constant = s + 2 * r;
  let x: Q | null = null;
  let value: Q | null = null;
  let blocked = false;
  if (even) x = new Q(-constant, 3);
  else if (s !== p) {
    // Cleared of fractions it is linear: (s − p)x + s(q + r − p) − qr = 0.
    x = new Q(q * r - s * (q + r - p), s - p);
  }
  if (x) {
    const both = sides(f, x);
    if (both && both[0].eq(both[1])) value = both[0];
    else blocked = true;
  }
  return { f, even, step, constant, x, value, blocked };
}

// ─── Multiply by 11 or 12 ──────────────────────────────────────────────────────

export interface TimesColumn {
  /** The digit (the ultimate) and its right neighbour (the penultimate, 0 past the end). */
  digit: number;
  neighbour: number;
  carryIn: number;
  total: number;
  write: number;
  carryOut: number;
}

export interface TimesPlan {
  n: string;
  by: 11 | 12;
  /** Columns left to right, over the number with a 0 in front. */
  columns: TimesColumn[];
  /** Left over after the leading 0's column. */
  extra: number;
  answer: string;
}

export const MAX_TIMES_DIGITS = 9;

export function planTimes(text: string, by: 11 | 12): TimesPlan | null {
  if (!/^\d{1,9}$/.test(text)) return null;
  const n = text.replace(/^0+(?=\d)/, "");
  const ds = [0, ...[...n].map(Number)];
  const mult = by === 12 ? 2 : 1;
  const columns: TimesColumn[] = [];
  let carry = 0;
  for (let i = ds.length - 1; i >= 0; i--) {
    const neighbour = ds[i + 1] ?? 0;
    const total = mult * ds[i] + neighbour + carry;
    columns.unshift({ digit: ds[i], neighbour, carryIn: carry, total, write: total % 10, carryOut: Math.floor(total / 10) });
    carry = Math.floor(total / 10);
  }
  const answer = ((carry ? String(carry) : "") + columns.map((c) => c.write).join("")).replace(/^0+(?=\d)/, "");
  return { n, by, columns, extra: carry, answer };
}
