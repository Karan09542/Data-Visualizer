/**
 * Urdhva Tiryagbhyam: vertically and crosswise. Line the numbers up (a 0 in front
 * of the shorter one), then, one column at a time from the right, multiply the
 * digit pairs that meet there, straight down and across, and add them:
 *   23 × 41: 3×1 = 3 | 2×1 + 3×4 = 14 | 2×4 = 8  →  8/14/3  →  balance → 943
 */
import { balance, type Balanced } from "./balancing";

export interface UrdhvaColumn {
  /** Counted from the right: 0 is the units column. */
  k: number;
  /** The digit pairs that meet here, as indexes from the left of the top and bottom numbers. */
  pairs: [number, number][];
  products: number[];
  sum: number;
}

export interface UrdhvaPlan {
  a: number;
  b: number;
  /** Both numbers as digits, the shorter one with 0s in front. */
  top: number[];
  bottom: number[];
  /** How many 0s were put in front of each. */
  padTop: number;
  padBottom: number;
  /** Right to left, the order they're worked out in. */
  columns: UrdhvaColumn[];
  /** The column totals left to right, as slash values: ["8", "14", "3"]. */
  parts: string[];
  balanced: Balanced;
  answer: string;
}

export const MAX_DIGITS = 4;

export function planUrdhva(a: number, b: number): UrdhvaPlan | null {
  if (![a, b].every((x) => Number.isInteger(x) && x >= 1 && x < 10 ** MAX_DIGITS)) return null;
  const n = Math.max(String(a).length, String(b).length);
  const top = [...String(a).padStart(n, "0")].map(Number);
  const bottom = [...String(b).padStart(n, "0")].map(Number);
  const columns: UrdhvaColumn[] = [];
  for (let k = 0; k <= 2 * n - 2; k++) {
    const pairs: [number, number][] = [];
    // Index from the right i in the top meets j = k − i in the bottom.
    for (let i = 0; i < n; i++) {
      const j = k - i;
      if (j >= 0 && j < n) pairs.push([n - 1 - i, n - 1 - j]);
    }
    const products = pairs.map(([i, j]) => top[i] * bottom[j]);
    columns.push({ k, pairs, products, sum: products.reduce((s, p) => s + p, 0) });
  }
  const parts = [...columns].reverse().map((c) => String(c.sum));
  const balanced = balance(parts);
  return {
    a,
    b,
    top,
    bottom,
    padTop: n - String(a).length,
    padBottom: n - String(b).length,
    columns,
    parts,
    balanced,
    answer: balanced.answer,
  };
}
