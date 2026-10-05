/**
 * Ekanyunena Purvena: "by one less than the previous" — multiplying by 9, 99, 999…
 *
 * As many digits as 9s (or fewer):  43 × 99 → 43 − 1 = 42 | each digit from 9: 57 → 4257
 *                                   12 × 999 → 011 | 988 → 11988
 * More digits than 9s:              234 × 99 → split 2 | 34: 234 − (2 + 1) = 231 |
 *                                   100 − 34 = 66 → 23166
 * Why: n × 99…9 = n × 10^k − n.
 */

export const MAX_DIGITS = 8;

export type EkanCase = "same" | "fewer" | "more";

/** How one digit of the right part is made: 9 − d, 10 − d, or a trailing 0 kept. */
export type DigitKind = "nine" | "ten" | "zero";

export interface ComplementDigit {
  from: number;
  kind: DigitKind;
  to: number;
}

export interface EkanPlan {
  n: number;
  /** How many 9s, and the multiplier 99…9. */
  k: number;
  nines: string;
  kase: EkanCase;
  /** "fewer": n with zeros in front, to k digits. */
  padded: string;
  /** "more": n split as first | last k digits. */
  first: number;
  last: string;
  left: number;
  /** The right part's digits, each from the digit above it. */
  complement: ComplementDigit[];
  rightText: string;
  answer: string;
}

/** Each digit from 9 (the same/fewer case): 42 → 57. */
function fromNine(text: string): ComplementDigit[] {
  return [...text].map((c) => ({ from: Number(c), kind: "nine", to: 9 - Number(c) }));
}

/** From 10^k: all from 9, the last non-zero from 10, trailing zeros stay: 34 → 66, 40 → 60. */
function fromTen(text: string): ComplementDigit[] {
  const ds = [...text].map(Number);
  const lastNonZero = ds.reduce((at, d, i) => (d ? i : at), -1);
  return ds.map((d, i) => (i < lastNonZero ? { from: d, kind: "nine", to: 9 - d } : i === lastNonZero ? { from: d, kind: "ten", to: 10 - d } : { from: d, kind: "zero", to: 0 }));
}

export function planEkan(nText: string, k: number): EkanPlan | null {
  if (!/^\d{1,8}$/.test(nText) || !Number.isInteger(k) || k < 1 || k > MAX_DIGITS) return null;
  const n = Number(nText);
  if (n < 1) return null;
  const digits = String(n).length;
  const nines = "9".repeat(k);
  const unit = 10 ** k;
  let kase: EkanCase;
  let left: number;
  let complement: ComplementDigit[];
  let first = 0;
  let last = "";
  const padded = String(n).padStart(k, "0");
  if (digits <= k) {
    kase = digits === k ? "same" : "fewer";
    left = n - 1;
    complement = fromNine(String(left).padStart(k, "0"));
  } else {
    kase = "more";
    first = Math.floor(n / unit);
    last = String(n % unit).padStart(k, "0");
    const lastValue = n % unit;
    left = n - first - (lastValue > 0 ? 1 : 0);
    complement = lastValue > 0 ? fromTen(last) : [...last].map(() => ({ from: 0, kind: "zero" as const, to: 0 }));
  }
  const rightText = complement.map((c) => c.to).join("");
  const answer = (String(left === 0 ? "" : left) + rightText).replace(/^0+(?=\d)/, "");
  return { n, k, nines, kase, padded, first, last, left, complement, rightText, answer };
}
