/**
 * Vyashti Samashti: "part and whole". Replace the parts by their whole, the average,
 * and what's left is simple.
 *
 * Product:        47 × 53 = 50² − 3² = 2500 − 9 = 2491
 * Fourth powers:  (x + 7)⁴ + (x + 5)⁴ = 706. With y = x + 6 (the average),
 *                 (y + 1)⁴ + (y − 1)⁴ = 2y⁴ + 12y² + 2 = 706 → y² = 16 → y = ±4 → x = −2, −10
 * Four factors:   (x + 1)(x + 2)(x + 3)(x + 4) = 120. Pair 1 + 4 = 2 + 3 = 5, z = x² + 5x:
 *                 (z + 4)(z + 6) = 120 → z = 6 or −16 → x = 1, −6
 */
import { planQuadratic, type QuadraticPlan } from "./chalana";
import { rootsAround, sqrtQ, type Root, type Surd } from "./purana";
import { Q } from "./shunyam";

// ─── Product by the average ────────────────────────────────────────────────────

export interface ProductPlan {
  a: number;
  b: number;
  /** The whole: (a + b) ÷ 2. */
  mean: Q;
  /** The parts' distance from it: (a − b) ÷ 2, not negative. */
  half: Q;
  meanSq: Q;
  halfSq: Q;
  product: Q;
}

export function planProduct(a: number, b: number): ProductPlan {
  const mean = new Q(a + b, 2);
  const half = new Q(Math.abs(a - b), 2);
  const meanSq = mean.mul(mean);
  const halfSq = half.mul(half);
  return { a, b, mean, half, meanSq, halfSq, product: meanSq.add(halfSq.mul(-1)) };
}

// ─── (x + a)⁴ + (x + b)⁴ = c ───────────────────────────────────────────────────

export interface FourthPlan {
  a: number;
  b: number;
  c: number;
  /** y = x + m, and the two parts are y + k and y − k. */
  m: Q;
  k: Q;
  /** 2y⁴ + 12k²·y² + 2k⁴ = c, i.e. Y² + B·Y + C = 0 with Y = y². */
  B: Q;
  C: Q;
  /** (B/2)² − C = 8k⁴ + c/2: its square root gives Y = −B/2 ± √. */
  disc: Q;
  root: Surd | null;
  /** The values of y² (when the root is a plain number), and whether each gives real y. */
  Ys: { Y: Q; real: boolean }[] | null;
  roots: Root[];
}

export function planFourth(a: number, b: number, c: number): FourthPlan {
  const m = new Q(a + b, 2);
  const k = new Q(a - b, 2);
  const k2 = k.mul(k);
  const k4 = k2.mul(k2);
  const B = k2.mul(6);
  const C = k4.add(new Q(-c, 2));
  const disc = k4.mul(8).add(new Q(c, 2));
  const root = disc.n >= 0 ? sqrtQ(disc) : null;
  let Ys: FourthPlan["Ys"] = null;
  const roots: Root[] = [];
  if (root && root.rad === 1) {
    const center = k2.mul(-3);
    const vals = root.coef.zero ? [center] : [center.add(root.coef), center.add(root.coef.mul(-1))];
    Ys = vals.map((Y) => ({ Y, real: Y.n >= 0 }));
    for (const { Y, real } of Ys) if (real) roots.push(...rootsAround(m.mul(-1), sqrtQ(Y)));
  }
  return { a, b, c, m, k, B, C, disc, root, Ys, roots };
}

// ─── (x + a)(x + b)(x + c)(x + d) = e ──────────────────────────────────────────

export interface PairPlan {
  factors: [number, number, number, number];
  e: number;
  /** Two pairs with the same sum, as indexes into factors; null when none pair up. */
  pairs: [[number, number], [number, number]] | null;
  /** The shared sum s, and each pair's product: (z + p1)(z + p2) = e with z = x² + s·x. */
  s: number;
  p1: number;
  p2: number;
  /** z² + (p1 + p2)z + (p1·p2 − e) = 0 */
  zPlan: QuadraticPlan | null;
  /** Each z that is a plain number, with x² + s·x = z solved. */
  zs: { z: Q; x: QuadraticPlan }[] | null;
  roots: Root[];
}

const PAIRINGS: [[number, number], [number, number]][] = [
  [[0, 3], [1, 2]],
  [[0, 2], [1, 3]],
  [[0, 1], [2, 3]],
];

export function planPairs(factors: [number, number, number, number], e: number): PairPlan {
  const pairs = PAIRINGS.find(([[i, j], [k, l]]) => factors[i] + factors[j] === factors[k] + factors[l]) ?? null;
  const base = { factors, e, pairs, s: 0, p1: 0, p2: 0, zPlan: null, zs: null, roots: [] as Root[] };
  if (!pairs) return base;
  const [[i, j], [k, l]] = pairs;
  const s = factors[i] + factors[j];
  const p1 = factors[i] * factors[j];
  const p2 = factors[k] * factors[l];
  const zPlan = planQuadratic(1, p1 + p2, p1 * p2 - e)!;
  let zs: PairPlan["zs"] = null;
  const roots: Root[] = [];
  if (zPlan.roots.every((r) => r.value)) {
    // x² + s·x − z = 0, cleared of fractions: d·x² + d·s·x − n = 0 for z = n/d.
    zs = zPlan.roots.map((r) => ({ z: r.value!, x: planQuadratic(r.value!.d, r.value!.d * s, -r.value!.n)! }));
    for (const { x } of zs) roots.push(...x.roots.filter((r) => !roots.some((o) => o.text === r.text)));
  }
  return { factors, e, pairs, s, p1, p2, zPlan, zs, roots };
}
