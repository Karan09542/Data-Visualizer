/**
 * Nikhilam Navatashcaramam Dashatah: multiplying numbers near a base.
 *
 *   same base (10, 100, 1000…):  left = a + (b's deviation), right = da × db
 *   different bases, same sign:  left = A + db × ratio, worked as one digit of A
 *                                changed where the smaller number ends
 *   different bases, signs differ: left = b × ratio + da (the base-ratio way)
 *   sub-base (20, 40, 200…):     left = (a + db) × multiplier, right = da × db
 *
 * The right part keeps as many digits as the (lower) base has zeros. It is then
 * settled: extra digits carry left; a negative right part sends its whole tens
 * left, and what's left becomes its complement with 1 less on the left.
 */

export const pow10 = (k: number) => 10 ** k;

/** The power of 10 a number is closest to (12 → 10, 92 → 100, 1002 → 1000). */
export function nearestBase(n: number): number {
  let best = 10;
  for (let b = 10; b <= 1e6; b *= 10) if (Math.abs(n - b) < Math.abs(n - best)) best = b;
  return best;
}
export const zerosOf = (base: number) => Math.round(Math.log10(base));

/** How L | R becomes a proper answer, one move at a time. */
export interface Settle {
  /** Before: left, and right as worked out (it may be too long or negative). */
  left0: number;
  right0: number;
  width: number;
  /** Right part 10, 100…: one more than the largest number its digits can hold. */
  unit: number;
  /** R too long: this much moved to the left. */
  carry: number;
  /** R negative with extra digits: their value taken from the left (−21 → 2). */
  borrow: number;
  /** R negative: the part that becomes a complement (−21 → 1, −04 → 4). */
  rest: number;
  /** unit − rest, with 1 taken from the left; null when nothing was negative. */
  complement: number | null;
  left: number;
  right: number;
  rightText: string;
  answer: string;
}

export function settle(L: number, R: number, width: number): Settle {
  const unit = pow10(width);
  let left = L;
  let right = R;
  let carry = 0;
  let borrow = 0;
  let rest = 0;
  let complement: number | null = null;
  if (R >= unit) {
    carry = Math.floor(R / unit);
    left += carry;
    right = R - carry * unit;
  } else if (R < 0) {
    borrow = Math.floor(-R / unit);
    rest = -R - borrow * unit;
    left -= borrow;
    if (rest > 0) {
      complement = unit - rest;
      left -= 1;
      right = complement;
    } else right = 0;
  }
  const rightText = String(right).padStart(width, "0");
  return { left0: L, right0: R, width, unit, carry, borrow, rest, complement, left, right, rightText, answer: String(left * unit + right) };
}

export interface Dev {
  n: number;
  base: number;
  dev: number;
}
const dev = (n: number, base: number): Dev => ({ n, base, dev: n - base });

export interface SameBasePlan {
  kind: "same";
  a: Dev;
  b: Dev;
  base: number;
  width: number;
  left: number;
  right: number;
  settle: Settle;
}

export interface DifferentBasePlan {
  kind: "different";
  /** The number with the bigger base, and the other. */
  big: Dev;
  small: Dev;
  ratio: number;
  width: number;
  /** Signs alike: the smaller number lines up under the bigger, and one digit changes. */
  sameSign: boolean;
  /** Where the change happens, counted from the left of the bigger number. */
  column: number;
  /** That digit, and what it becomes; null if it borrows or carries across digits. */
  digitFrom: number;
  digitTo: number | null;
  /** Signs differ: smaller × ratio, then + the bigger one's deviation. */
  scaled: number;
  left: number;
  right: number;
  settle: Settle;
}

export interface SubBasePlan {
  kind: "sub";
  a: Dev;
  b: Dev;
  /** 40 = 4 × 10: the multiplier and the power of 10. */
  multiplier: number;
  power: number;
  width: number;
  cross: number;
  left: number;
  right: number;
  settle: Settle;
}

export type Miss = { reason: "range" | "notSameBase" | "notDifferentBase" | "subBase" };
export type Result<P> = { plan: P; miss?: undefined } | { plan?: undefined; miss: Miss };

const MAX = 99999;
const okNumber = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX;

export function planSameBase(a: number, b: number): Result<SameBasePlan> {
  if (!okNumber(a) || !okNumber(b)) return { miss: { reason: "range" } };
  const base = nearestBase(a);
  if (nearestBase(b) !== base) return { miss: { reason: "notSameBase" } };
  const width = zerosOf(base);
  const da = dev(a, base);
  const db = dev(b, base);
  const left = a + db.dev;
  const right = da.dev * db.dev;
  return { plan: { kind: "same", a: da, b: db, base, width, left, right, settle: settle(left, right, width) } };
}

export function planDifferentBases(a: number, b: number): Result<DifferentBasePlan> {
  if (!okNumber(a) || !okNumber(b)) return { miss: { reason: "range" } };
  const ba = nearestBase(a);
  const bb = nearestBase(b);
  if (ba === bb) return { miss: { reason: "notDifferentBase" } };
  const big = ba > bb ? dev(a, ba) : dev(b, bb);
  const small = ba > bb ? dev(b, bb) : dev(a, ba);
  const ratio = big.base / small.base;
  const width = zerosOf(small.base);
  const sameSign = big.dev * small.dev >= 0;
  // The digit of the bigger number that sits where the smaller number ends.
  const digits = String(big.n);
  const column = digits.length - 1 - zerosOf(ratio);
  const digitFrom = Number(digits[column] ?? 0);
  const to = digitFrom + small.dev;
  const scaled = small.n * ratio;
  const left = big.n + small.dev * ratio; // = scaled + big.dev
  const right = big.dev * small.dev;
  return {
    plan: {
      kind: "different",
      big,
      small,
      ratio,
      width,
      sameSign,
      column,
      digitFrom,
      digitTo: column >= 0 && to >= 0 && to <= 9 ? to : null,
      scaled,
      left,
      right,
      settle: settle(left, right, width),
    },
  };
}

/** A sub-base like 20, 40, 300: a digit 2–9 then zeros. */
export function parseSubBase(s: number): { multiplier: number; power: number } | null {
  if (!Number.isInteger(s) || s < 20) return null;
  const m = String(s).match(/^([2-9])(0+)$/);
  return m ? { multiplier: Number(m[1]), power: m[2].length } : null;
}

export function planSubBase(a: number, b: number, sub: number): Result<SubBasePlan> {
  if (!okNumber(a) || !okNumber(b)) return { miss: { reason: "range" } };
  const p = parseSubBase(sub);
  if (!p) return { miss: { reason: "subBase" } };
  const da = dev(a, sub);
  const db = dev(b, sub);
  const cross = a + db.dev;
  const left = cross * p.multiplier;
  const right = da.dev * db.dev;
  return { plan: { kind: "sub", a: da, b: db, multiplier: p.multiplier, power: p.power, width: p.power, cross, left, right, settle: settle(left, right, p.power) } };
}

/** The sub-base nearest two numbers: 22, 23 → 20; 37, 47 → 40. */
export function suggestSubBase(a: number, b: number): number {
  const mid = (a + b) / 2;
  let best = 20;
  for (let power = 1; power <= 4; power++)
    for (let m = 2; m <= 9; m++) {
      const s = m * pow10(power);
      if (Math.abs(mid - s) < Math.abs(mid - best)) best = s;
    }
  return best;
}
