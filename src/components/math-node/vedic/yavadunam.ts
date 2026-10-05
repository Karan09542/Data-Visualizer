/**
 * Yavadunam: "whatever the extent of its deficiency, lessen it by that much, and set up
 * the square of the deficiency".
 *
 * Square, base 100:  96² → 96 − 4 = 92 | 4² = 16 → 9216
 *                    104² → 104 + 4 = 108 | 16 → 10816
 * Sub-base 50 = 5×10: 48² → (48 − 2) × 5 = 230 | 2² = 4 → 2304
 * Cube, base 100:    104³ → 104 + 2·4 = 112 | 3·4² = 48 | 4³ = 64 → 1124864
 */
import { nearestBase, parseSubBase, pow10, settle, zerosOf, type Settle } from "./nikhilam";

export const MAX_DIGITS = 5;

/** A base for Yavadunam: 10, 100… or a sub-base like 50, 300 (multiplier × 10^power). */
export interface YBase {
  value: number;
  multiplier: number;
  power: number;
}

export function parseYBase(v: number): YBase | null {
  if (!Number.isInteger(v) || v < 10) return null;
  if (/^10+$/.test(String(v))) return { value: v, multiplier: 1, power: zerosOf(v) };
  const s = parseSubBase(v);
  return s ? { value: v, ...s } : null;
}

/** The handiest base near n: a power of 10, or a sub-base when that's closer (88 → 90, 48 → 50). */
export function suggestYBase(n: number): number {
  let best = nearestBase(n);
  for (let power = 1; power <= 5; power++)
    for (let m = 2; m <= 9; m++) {
      const s = m * pow10(power);
      if (Math.abs(n - s) < Math.abs(n - best)) best = s;
    }
  return best;
}

export interface SquarePlan {
  n: number;
  base: YBase;
  /** n − base: negative is a deficiency, positive a surplus. */
  d: number;
  /** n + d, before the multiplier. */
  cross: number;
  left: number;
  right: number;
  width: number;
  settle: Settle;
}

export function planSquare(n: number, baseValue: number): SquarePlan | null {
  const base = parseYBase(baseValue);
  if (!base || !Number.isInteger(n) || n < 1 || String(n).length > MAX_DIGITS) return null;
  const d = n - base.value;
  const cross = n + d;
  const left = cross * base.multiplier;
  const right = d * d;
  const width = base.power;
  return { n, base, d, cross, left, right, width, settle: settle(left, right, width) };
}

// ─── Cube ──────────────────────────────────────────────────────────────────────

/** One move while settling L | M | R: a carry or a borrow between two neighbouring parts. */
export interface CubeMove {
  /** 2 = right into middle, 1 = middle into left. */
  from: 1 | 2;
  /** Positive: carried to the left; negative: borrowed from the left. */
  amount: number;
  before: [number, number, number];
  after: [number, number, number];
}

export interface CubePlan {
  n: number;
  base: number;
  width: number;
  d: number;
  /** n + 2d | 3d² | d³ */
  parts: [number, number, number];
  moves: CubeMove[];
  final: [number, number, number];
  answer: string;
}

export function planCube(n: number): CubePlan | null {
  if (!Number.isInteger(n) || n < 1 || String(n).length > 4) return null;
  const base = nearestBase(n);
  const width = zerosOf(base);
  const d = n - base;
  const parts: [number, number, number] = [n + 2 * d, 3 * d * d, d * d * d];
  const moves: CubeMove[] = [];
  const cur: [number, number, number] = [...parts];
  // Right to left: each part keeps `width` digits and is not negative.
  for (const i of [2, 1] as const) {
    const v = cur[i];
    const amount = v >= base ? Math.floor(v / base) : v < 0 ? -Math.ceil(-v / base) : 0;
    if (amount === 0) continue;
    const before: [number, number, number] = [...cur];
    cur[i] -= amount * base;
    cur[i - 1] += amount;
    moves.push({ from: i, amount, before, after: [...cur] });
  }
  const answer = String(cur[0] * base * base + cur[1] * base + cur[2]);
  return { n, base, width, d, parts, moves, final: cur, answer };
}
