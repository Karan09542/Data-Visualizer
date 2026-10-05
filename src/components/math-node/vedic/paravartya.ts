/**
 * Paravartya Yojayet ("transpose and apply") for division by a number just above
 * a base: 12, 112, 1013 — a 1 followed by a few digits.
 *
 *   12 = 10 + 2  → transpose: −2
 *   1234 ÷ 12:   columns 1 2 3 | 4  (one remainder column, as 12 has one digit after the 1)
 *     1                     → 1, and 1 × −2 = −2 goes under the next column
 *     2 − 2 = 0             → 0, and 0 × −2 = 0
 *     3 + 0 = 3             → 3, and 3 × −2 = −6
 *     4 − 6 = −2            → the remainder column
 *   quotient 103, remainder −2 → borrow one 12: 102 remainder 10.
 */

export interface Contribution {
  /** The quotient column it came from, and which transposed digit (1-based) made it. */
  from: number;
  j: number;
  value: number;
}

export interface ParavartyaPlan {
  dividend: string;
  divisor: number;
  /** Digits after the divisor's leading 1: the number of remainder columns. */
  k: number;
  base: number;
  /** The divisor's extra digits with the sign changed: 112 → [−1, −2]. */
  transposed: number[];
  digits: number[];
  /** How many columns make the quotient (the rest make the remainder). */
  quotientColumns: number;
  /** What is added into each column from earlier quotient digits. */
  contributions: Contribution[][];
  /** Each column's total: quotient digits first, then remainder columns. */
  sums: number[];
  /** The quotient and remainder as read off (they may still need fixing). */
  rawQuotient: number;
  rawRemainder: number;
  /** How many divisors were moved between remainder and quotient: −1 borrows, +1 carries. */
  shift: number;
  quotient: number;
  remainder: number;
}

export type ParavartyaMiss = { reason: "range" | "divisor" | "short" };

/**
 * The column work itself, for any row of digits (or coefficients) and transposed
 * digits: add down each column; each quotient column's total, times the transposed
 * digits, goes under the columns after it. The last transposed.length columns are
 * the remainder's.
 */
export function transposeAndApply(digits: number[], transposed: number[]) {
  const m = digits.length;
  const quotientColumns = m - transposed.length;
  const contributions: Contribution[][] = digits.map(() => []);
  const sums: number[] = [];
  for (let c = 0; c < m; c++) {
    const sum = digits[c] + contributions[c].reduce((s, x) => s + x.value, 0);
    sums.push(sum);
    if (c < quotientColumns)
      transposed.forEach((t, idx) => {
        const target = c + idx + 1;
        if (target < m) contributions[target].push({ from: c, j: idx + 1, value: t * sum });
      });
  }
  return { quotientColumns, contributions, sums };
}

export const MAX_DIVIDEND_DIGITS = 8;

export function planParavartya(dividendText: string, divisor: number): { plan?: ParavartyaPlan; miss?: ParavartyaMiss } {
  if (!/^\d{1,8}$/.test(dividendText) || !Number.isInteger(divisor)) return { miss: { reason: "range" } };
  const dividend = dividendText.replace(/^0+(?=\d)/, "");
  const ds = String(divisor);
  // A 1 and then at least one digit: 11–19, 101–199, 1001–1999…
  if (!/^1\d{1,3}$/.test(ds)) return { miss: { reason: "divisor" } };
  const k = ds.length - 1;
  const base = 10 ** k;
  const transposed = [...ds.slice(1)].map((d) => -Number(d));
  const digits = [...dividend].map(Number);
  const m = digits.length;
  if (m <= k) return { miss: { reason: "short" } };
  const { quotientColumns, contributions, sums } = transposeAndApply(digits, transposed);
  const place = (vals: number[]) => vals.reduce((acc, v) => acc * 10 + v, 0);
  const rawQuotient = place(sums.slice(0, quotientColumns));
  const rawRemainder = place(sums.slice(quotientColumns));
  // Bring the remainder into 0 … divisor − 1, moving whole divisors to or from the quotient.
  const shift = Math.floor(rawRemainder / divisor);
  const quotient = rawQuotient + shift;
  const remainder = rawRemainder - shift * divisor;
  return {
    plan: {
      dividend,
      divisor,
      k,
      base,
      transposed,
      digits,
      quotientColumns,
      contributions,
      sums,
      rawQuotient,
      rawRemainder,
      shift,
      quotient,
      remainder,
    },
  };
}
