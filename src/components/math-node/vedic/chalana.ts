/**
 * Chalana Kalanabhyam: "by motion (change) and calculation" — the Vedic calculus.
 *
 * Quadratic: the first derivative equals ± the square root of the discriminant.
 *   7x² − 5x − 2 = 0:  14x − 5 = ±√(25 + 56) = ±9  →  x = 1 or −2/7
 * Derivative: each term's power comes down as a multiplier, and the power drops by one.
 *   3x⁴ → 12x³
 */
import { evalPoly, rootsAround, sqrtQ, type Root, type Surd } from "./purana";
import { Q } from "./shunyam";

// ─── Quadratic ─────────────────────────────────────────────────────────────────

export interface QuadraticPlan {
  a: number;
  b: number;
  c: number;
  /** The derivative 2a·x + b. */
  d1: [number, number];
  /** b² − 4ac */
  disc: number;
  /** √disc, when it is not negative. */
  root: Surd | null;
  /** The two cases d1 = +√disc and d1 = −√disc, when √disc is a plain number. */
  cases: { rhs: Q; x: Q }[] | null;
  roots: Root[];
}

export function planQuadratic(a: number, b: number, c: number): QuadraticPlan | null {
  if (a === 0) return null;
  const disc = b * b - 4 * a * c;
  const root = disc >= 0 ? sqrtQ(new Q(disc)) : null;
  let cases: QuadraticPlan["cases"] = null;
  let roots: Root[] = [];
  if (root) {
    // 2a·x + b = ±√disc  →  x = (−b ± √disc) / 2a
    const center = new Q(-b, 2 * a);
    roots = rootsAround(center, { coef: root.coef.div(Math.abs(2 * a)), rad: root.rad });
    if (root.rad === 1)
      cases = (root.coef.zero ? [root.coef] : [root.coef, root.coef.mul(-1)]).map((rhs) => ({ rhs, x: rhs.add(-b).div(2 * a) }));
  }
  return { a, b, c, d1: [2 * a, b], disc, root, cases, roots };
}

// ─── Derivative ────────────────────────────────────────────────────────────────

export interface TermStep {
  /** coef·x^power → (power·coef)·x^(power − 1) */
  coef: number;
  power: number;
  newCoef: number;
}

export interface DerivativePlan {
  /** Coefficients, highest power first. */
  coeffs: number[];
  terms: TermStep[];
  /** The derivative's coefficients, highest power first. */
  d1: number[];
  x0: number;
  /** f(x0) and f'(x0). */
  value: Q;
  slope: Q;
}

export function planDerivative(coeffs: number[], x0: number): DerivativePlan {
  const deg = coeffs.length - 1;
  const terms: TermStep[] = [];
  coeffs.forEach((coef, i) => {
    const power = deg - i;
    if (coef !== 0) terms.push({ coef, power, newCoef: coef * power });
  });
  const d1 = coeffs.slice(0, deg).map((coef, i) => coef * (deg - i));
  const x = new Q(x0);
  return {
    coeffs,
    terms,
    d1: d1.length ? d1 : [0],
    x0,
    value: evalPoly(coeffs.map((n) => new Q(n)), x),
    slope: evalPoly((d1.length ? d1 : [0]).map((n) => new Q(n)), x),
  };
}
