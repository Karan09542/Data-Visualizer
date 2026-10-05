/**
 * Shunyam Samyasamuccaye: "when the samuccaya (the common total) is the same, it is
 * zero". Five cases, each found by looking, without expanding:
 *   1. a common factor on both sides, with different coefficients: the factor is 0
 *   2. (x+a)(x+b) = (x+c)(x+d) with ab = cd: x = 0
 *   3. m/D1 + m/D2 = 0 (same numerators): D1 + D2 = 0
 *   4. N1/D1 = N2/D2 with N1 + N2 = D1 + D2: that sum is 0
 *   5. 1/(x+a) + 1/(x+b) = 1/(x+c) + 1/(x+d) with a + b = c + d: that sum is 0
 */

/** An exact fraction, so answers like x = −3/5 stay exact. */
export class Q {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error("divide by zero");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(Math.abs(n), d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x: Q | number) {
    return x instanceof Q ? x : new Q(x);
  }
  add(o: Q | number) {
    const f = Q.of(o);
    return new Q(this.n * f.d + f.n * this.d, this.d * f.d);
  }
  mul(o: Q | number) {
    const f = Q.of(o);
    return new Q(this.n * f.n, this.d * f.d);
  }
  div(o: Q | number) {
    const f = Q.of(o);
    return new Q(this.n * f.d, this.d * f.n);
  }
  get zero() {
    return this.n === 0;
  }
  eq(o: Q | number) {
    const f = Q.of(o);
    return this.n === f.n && this.d === f.d;
  }
  toString() {
    const s = this.d === 1 ? String(Math.abs(this.n)) : `${Math.abs(this.n)}/${this.d}`;
    return this.n < 0 ? `−${s}` : s;
  }
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

const MINUS = "−";
/** "3x − 2", "x + 5", "−x", "7" */
export function lin(a: number, b: number, v = "x"): string {
  const parts: string[] = [];
  if (a !== 0) parts.push(a === 1 ? v : a === -1 ? `${MINUS}${v}` : `${a < 0 ? MINUS : ""}${Math.abs(a)}${v}`);
  if (b !== 0 || parts.length === 0) {
    if (parts.length) parts.push(b < 0 ? `${MINUS} ${-b}` : `+ ${b}`);
    else parts.push(b < 0 ? `${MINUS}${-b}` : String(b));
  }
  return parts.join(" ");
}
/** The value of ax + b at x. */
const at = (a: number, b: number, x: Q) => x.mul(a).add(b);

// ─── 1. A common factor ────────────────────────────────────────────────────────

export interface CommonFactorPlan {
  /** a1·F + a2·F = b1·F + b2·F, with F = x + p. */
  left: number;
  right: number;
  p: number;
  /** Coefficients equal: true for every x. */
  identity: boolean;
  x: Q | null;
}
export function planCommonFactor(a1: number, a2: number, b1: number, b2: number, p: number): CommonFactorPlan {
  const left = a1 + a2;
  const right = b1 + b2;
  const identity = left === right;
  return { left, right, p, identity, x: identity ? null : new Q(-p) };
}

// ─── 2. Products of the number parts ───────────────────────────────────────────

export interface ProductPlan {
  a: number;
  b: number;
  c: number;
  d: number;
  ab: number;
  cd: number;
  /** ab = cd: the shortcut works, x = 0. */
  same: boolean;
  identity: boolean;
  x: Q | null;
}
export function planProducts(a: number, b: number, c: number, d: number): ProductPlan {
  const ab = a * b;
  const cd = c * d;
  const sumL = a + b;
  const sumR = c + d;
  const identity = ab === cd && sumL === sumR;
  // (sumL − sumR)x = cd − ab
  const x = identity || sumL === sumR ? null : new Q(cd - ab, sumL - sumR);
  return { a, b, c, d, ab, cd, same: ab === cd, identity, x };
}

// ─── 3. Same numerators, sum zero ──────────────────────────────────────────────

export interface EqualNumeratorPlan {
  m: number;
  /** D1 = a x + b, D2 = c x + d */
  a: number;
  b: number;
  c: number;
  d: number;
  sumA: number;
  sumB: number;
  x: Q | null;
  /** D1 at the answer: not 0, so the fractions exist. */
  d1: Q | null;
}
export function planEqualNumerators(m: number, a: number, b: number, c: number, d: number): EqualNumeratorPlan {
  const sumA = a + c;
  const sumB = b + d;
  const x = sumA === 0 ? null : new Q(-sumB, sumA);
  return { m, a, b, c, d, sumA, sumB, x, d1: x ? at(a, b, x) : null };
}

// ─── 4. Sum of numerators = sum of denominators ────────────────────────────────

export interface SumPlan {
  /** (n1 x + n2)/(d1 x + d2) = (n3 x + n4)/(d3 x + d4) */
  N1: [number, number];
  D1: [number, number];
  N2: [number, number];
  D2: [number, number];
  nSum: [number, number];
  dSum: [number, number];
  same: boolean;
  x: Q | null;
  /** Both sides' value at x, when it can be worked out. */
  value: Q | null;
}
export function planSumNumDen(N1: [number, number], D1: [number, number], N2: [number, number], D2: [number, number]): SumPlan {
  const nSum: [number, number] = [N1[0] + N2[0], N1[1] + N2[1]];
  const dSum: [number, number] = [D1[0] + D2[0], D1[1] + D2[1]];
  const same = nSum[0] === dSum[0] && nSum[1] === dSum[1];
  const x = same && nSum[0] !== 0 ? new Q(-nSum[1], nSum[0]) : null;
  let value: Q | null = null;
  if (x) {
    const d1 = at(D1[0], D1[1], x);
    const d2 = at(D2[0], D2[1], x);
    if (!d1.zero && !d2.zero) {
      const l = at(N1[0], N1[1], x).div(d1);
      const r = at(N2[0], N2[1], x).div(d2);
      if (l.eq(r)) value = l;
    }
  }
  return { N1, D1, N2, D2, nSum, dSum, same, x, value };
}

// ─── 5. Sum of denominators the same ───────────────────────────────────────────

export interface SumDenPlan {
  a: number;
  b: number;
  c: number;
  d: number;
  left: number;
  right: number;
  same: boolean;
  x: Q | null;
  /** Both sides' value at x (each side is 0 there, unless a denominator vanishes). */
  ok: boolean;
}
export function planSumDen(a: number, b: number, c: number, d: number): SumDenPlan {
  const left = a + b;
  const right = c + d;
  const same = left === right;
  const x = same ? new Q(-left, 2) : null;
  let ok = false;
  if (x) {
    const vals = [a, b, c, d].map((k) => x.add(k));
    if (vals.every((v) => !v.zero)) {
      const inv = (v: Q) => new Q(v.d, v.n);
      ok = inv(vals[0]).add(inv(vals[1])).eq(inv(vals[2]).add(inv(vals[3])));
    }
  }
  return { a, b, c, d, left, right, same, x, ok };
}
