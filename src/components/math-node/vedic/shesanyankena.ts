/**
 * Shesanyankena Charamena: "the remainders by the last digit".
 *
 * 1/7: the decimal's last digit is 7 (7 × 7 = 49 ends in 9). The remainders, each ×10
 * and divided by 7, are 3, 2, 6, 4, 5, 1. Multiply each by 7 and keep the last digit:
 * 21 → 1, 14 → 4, 42 → 2, 28 → 8, 35 → 5, 7 → 7. So 1/7 = 0.142857 142857…
 *
 * Why: 10·r(k−1) = digit·D + r(k), so digit·D ≡ −r(k) (mod 10). The last digit L has
 * L·D ending in 9, i.e. L·D ≡ −1, so digit ≡ L·r(k) (mod 10).
 */

export const MAX_DENOMINATOR = 199;
export const MAX_NUMERATOR = 9999;

export interface ShesPlan {
  n: number;
  d: number;
  /** n ÷ d = whole and rem0/d. */
  whole: number;
  rem0: number;
  /** The decimal's last digit: L·d ends in 9. */
  last: number;
  /** L × d, which ends in 9. */
  lastCheck: number;
  /** One full cycle of remainders r1 … rp (rp = rem0 again). */
  remainders: number[];
  /** L × r for each remainder, and its last digit: the decimal's digits. */
  products: number[];
  digits: number[];
  /** The two halves add up to 99…9, when the cycle splits that way. */
  halves: { first: string; second: string; sum: string } | null;
}

export type ShesMiss = { reason: "range" | "denominator" };

export function planShes(n: number, d: number): { plan?: ShesPlan; miss?: ShesMiss } {
  if (!Number.isInteger(n) || !Number.isInteger(d) || n < 1 || n > MAX_NUMERATOR || d < 3 || d > MAX_DENOMINATOR) return { miss: { reason: "range" } };
  if (d % 2 === 0 || d % 5 === 0) return { miss: { reason: "denominator" } };
  const whole = Math.floor(n / d);
  const rem0 = n % d;
  // 1 → 9, 3 → 3, 7 → 7, 9 → 1
  const last = [0, 9, 0, 3, 0, 0, 0, 7, 0, 1][d % 10];
  const remainders: number[] = [];
  if (rem0 !== 0) {
    let r = rem0;
    do {
      r = (r * 10) % d;
      remainders.push(r);
    } while (r !== rem0);
  }
  const products = remainders.map((r) => r * last);
  const digits = products.map((p) => p % 10);
  let halves: ShesPlan["halves"] = null;
  const p = digits.length;
  if (p >= 2 && p % 2 === 0) {
    const first = digits.slice(0, p / 2).join("");
    const second = digits.slice(p / 2).join("");
    if (digits.slice(0, p / 2).every((x, i) => x + digits[p / 2 + i] === 9)) halves = { first, second, sum: "9".repeat(p / 2) };
  }
  return { plan: { n, d, whole, rem0, last, lastCheck: last * d, remainders, products, digits, halves } };
}
