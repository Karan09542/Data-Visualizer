import type { BoxCell } from "./NumberBoxes";

/** A number's boxes with its tens part (blue) and unit digit (amber) apart: 53 → 5 | 3. */
export function tensUnitCells(n: number): { tens: BoxCell[]; unit: BoxCell[] } {
  const s = String(n);
  return {
    tens: s.length > 1 ? [{ v: s.slice(0, -1), tone: "added" }] : [{ v: "0", tone: "muted" }],
    unit: [{ v: s.slice(-1), tone: "active" }],
  };
}

/** A two-digit right part's boxes, its added leading 0 marked: 9 → 0 9. */
export const twoDigitCells = (value: number): BoxCell[] =>
  [...String(value).padStart(2, "0")].map((v, i) => ({ v, tone: value < 10 && i === 0 ? "added" : "active" }));

const MINUS = "−";
/** −8, +2, 0 */
export const signed = (d: number) => (d < 0 ? `${MINUS}${-d}` : d > 0 ? `+${d}` : "0");
/** "92 − 2" / "92 + 2" */
export const plusDev = (n: number, d: number) => (d < 0 ? `${n} ${MINUS} ${-d}` : `${n} + ${d}`);

/** A deviation in one box: rose below the base, green above. */
export const devCell = (d: number): BoxCell => ({ v: signed(d), tone: d < 0 ? "carry" : d > 0 ? "done" : "muted" });

/** The right part with its digit count kept: 4 → 04, −4 → −04. */
export function rightCells(value: number, width: number): BoxCell[] {
  const digits = String(Math.abs(value)).padStart(width, "0");
  const lead = Math.max(0, width - String(Math.abs(value)).length);
  const cells: BoxCell[] = [...digits].map((v, i) => ({ v, tone: i < lead ? "added" : value < 0 ? "carry" : "active" }));
  return value < 0 ? [{ v: MINUS, tone: "carry" }, ...cells] : cells;
}

/**
 * Where a carry arrow leaves and lands: from the extra leading digits of a part that is
 * too long (144 with 2 digits allowed: the 1), to the last digit of the part before it.
 */
export function carryArrowAt(extraDigits: number, toCells: number): { fromCells: [number, number]; toCell: number } {
  return { fromCells: [0, Math.max(0, extraDigits - 1)], toCell: toCells - 1 };
}
