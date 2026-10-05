/**
 * Gunaka Samuccaya: "the factors of the sum equal the sum of the factors" — the first
 * derivative of a product of factors is their sum (two factors), or the sum of their
 * products in pairs (three):
 *
 *   x² + 5x + 6 = (x + 2)(x + 3):          2x + 5 = (x + 2) + (x + 3) ✓
 *   x³ + 6x² + 11x + 6 = (x+1)(x+2)(x+3):  3x² + 12x + 11 = (x+2)(x+3) + (x+1)(x+3) + (x+1)(x+2) ✓
 *
 * With an x number other than 1, each term is that number times the other factors:
 *   (2x + 1)(x + 3): 4x + 7 = 2(x + 3) + 1(2x + 1).
 * The derivative can't see the plain number, so that is checked on its own: the
 * product of the factors' numbers. Both together check the whole factorisation.
 */
import { expand, type Factor } from "./gunita";

/** The first derivative, highest power first. */
export function derivative(coeffs: number[]): number[] {
  const n = coeffs.length - 1;
  return n === 0 ? [0] : coeffs.slice(0, n).map((c, i) => c * (n - i));
}

/** Add polynomials (highest power first), lined up on the right. */
function addPolys(polys: number[][]): number[] {
  const len = Math.max(...polys.map((p) => p.length));
  const out = Array(len).fill(0);
  for (const p of polys) p.forEach((c, i) => (out[len - p.length + i] += c));
  return out;
}

export interface SumTerm {
  /** The factor left out, by its x number, times the others multiplied out. */
  p: number;
  others: Factor[];
  product: number[];
}

export interface GunakaPlan {
  factors: Factor[];
  claim: number[];
  /** The claimed polynomial's derivative. */
  d1: number[];
  /** Each factor's x number × the other factors, and their sum. */
  terms: SumTerm[];
  sum: number[];
  d1Ok: boolean;
  /** The plain number: the claim's, and the product of the factors' numbers. */
  constClaim: number;
  constFactors: number;
  constOk: boolean;
  truth: number[];
  correct: boolean;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function planGunaka(factors: Factor[], claim: number[]): GunakaPlan | null {
  if (factors.length < 2 || claim.length !== factors.length + 1 || factors.some((f) => f.p === 0)) return null;
  const terms: SumTerm[] = factors.map((f, i) => {
    const others = factors.filter((_, j) => j !== i);
    return { p: f.p, others, product: expand(others).map((c) => c * f.p) };
  });
  const sum = addPolys(terms.map((tm) => tm.product));
  const d1 = derivative(claim);
  const constClaim = claim[claim.length - 1];
  const constFactors = factors.reduce((a, f) => a * f.q, 1);
  const truth = expand(factors);
  return {
    factors,
    claim,
    d1,
    terms,
    sum,
    d1Ok: same(d1, sum),
    constClaim,
    constFactors,
    constOk: constClaim === constFactors,
    truth,
    correct: same(truth, claim),
  };
}
