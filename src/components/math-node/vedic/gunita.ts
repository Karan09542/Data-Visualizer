/**
 * Gunita Samuccaya: "the product of the sums of the coefficients in the factors equals
 * the sum of the coefficients in the product" — a quick check of a multiplication.
 *
 *   (x + 3)(x + 4) = x² + 7x + 12:   (1 + 3)(1 + 4) = 20 = 1 + 7 + 12 ✓
 *
 * The sum of the coefficients is the value at x = 1. The same check at x = −1 (signs
 * alternating) catches mistakes the first one misses:
 *   (x + 2)(x + 5) = x² + 6x + 11?   3 × 6 = 18 = 1 + 6 + 11, but 1 × 4 = 4 ≠ 1 − 6 + 11 = 6 ✗
 */

/** A factor p·x + q. */
export interface Factor {
  p: number;
  q: number;
}

/** The factors multiplied out: coefficients, highest power first. */
export function expand(factors: Factor[]): number[] {
  let poly = [1];
  for (const { p, q } of factors) {
    const next = Array(poly.length + 1).fill(0);
    poly.forEach((c, i) => {
      next[i] += c * p;
      next[i + 1] += c * q;
    });
    poly = next;
  }
  return poly;
}

/** The polynomial at x = 1 (the sum of its coefficients) or x = −1 (signs alternating). */
export const at = (coeffs: number[], x: 1 | -1) => coeffs.reduce((s, c, i) => s + c * x ** (coeffs.length - 1 - i), 0);

export interface CheckAt {
  x: 1 | -1;
  /** Each factor's value there: p + q, or −p + q. */
  factors: number[];
  product: number;
  claim: number;
  ok: boolean;
}

export interface GunitaPlan {
  factors: Factor[];
  claim: number[];
  one: CheckAt;
  minusOne: CheckAt;
  truth: number[];
  /** The claimed product really is the product. */
  correct: boolean;
}

function checkAt(factors: Factor[], claim: number[], x: 1 | -1): CheckAt {
  const values = factors.map((f) => f.p * x + f.q);
  const product = values.reduce((a, b) => a * b, 1);
  const c = at(claim, x);
  return { x, factors: values, product, claim: c, ok: product === c };
}

export function planGunita(factors: Factor[], claim: number[]): GunitaPlan | null {
  if (!factors.length || claim.length !== factors.length + 1 || factors.some((f) => f.p === 0)) return null;
  const truth = expand(factors);
  return {
    factors,
    claim,
    one: checkAt(factors, claim, 1),
    minusOne: checkAt(factors, claim, -1),
    truth,
    correct: truth.every((c, i) => c === claim[i]),
  };
}
