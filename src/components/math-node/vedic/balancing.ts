/**
 * The Balancing Rule: slash values such as 05/35/15, one part per place, are
 * balanced from right to left. Each place keeps its last digit; the rest moves to
 * the next place on the left. The leftmost place keeps everything.
 */

export const MAX_PARTS = 10;
export const MAX_PART_DIGITS = 6;

/** "5/443/1" → ["5", "443", "1"]; null if it isn't slash values. */
export function parseSlashValues(text: string): string[] | null {
  const parts = text.split("/").map((p) => p.trim());
  if (parts.length < 2 || parts.length > MAX_PARTS) return null;
  if (!parts.every((p) => new RegExp(`^\\d{1,${MAX_PART_DIGITS}}$`).test(p))) return null;
  // "05" and "5" are the same part.
  return parts.map((p) => p.replace(/^0+(?=\d)/, ""));
}

/** Each digit of `n` times `m`: 173 × 5 → ["5", "35", "15"]. */
export const multiplyDigits = (n: string, m: number): string[] => [...n].map((d) => String(Number(d) * m));

/** A single digit gets a 0 in front, so every part shows two digits: 5/3/78 → 05/03/78. */
export const toTwoDigits = (parts: string[]): string[] => parts.map((p) => (p.length === 1 ? `0${p}` : p));

export interface BalanceStep {
  /** Which part, counted from the left. */
  index: number;
  /** The part as written (two-digit form). */
  part: string;
  carryIn: number;
  total: number;
  /** What stays in this place: one digit, or everything at the leftmost place. */
  keep: string;
  /** What moves to the next place on the left (0 at the leftmost). */
  carryOut: number;
}

export interface Balanced {
  padded: string[];
  /** Right to left, the order they're done in. */
  steps: BalanceStep[];
  answer: string;
}

export function balance(parts: string[]): Balanced {
  const padded = toTwoDigits(parts);
  const steps: BalanceStep[] = [];
  let carry = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const total = Number(parts[i]) + carry;
    const leftmost = i === 0;
    const step: BalanceStep = {
      index: i,
      part: padded[i],
      carryIn: carry,
      total,
      keep: leftmost ? String(total) : String(total % 10),
      carryOut: leftmost ? 0 : Math.floor(total / 10),
    };
    steps.push(step);
    carry = step.carryOut;
  }
  const answer = steps
    .map((s) => s.keep)
    .reverse()
    .join("")
    .replace(/^0+(?=\d)/, "");
  return { padded, steps, answer };
}

/** The value the parts stand for, worked out the long way: 5×100 + 443×10 + 1. */
export function placeValue(parts: string[]): bigint {
  return parts.reduce((sum, p) => sum * 10n + BigInt(p), 0n);
}

const PLACES = ["ones", "tens", "hundreds", "thousands", "ten-thousands", "lakhs", "ten-lakhs", "crores"];
const PLACES_HI = ["इकाई", "दहाई", "सैकड़ा", "हज़ार", "दस हज़ार", "लाख", "दस लाख", "करोड़"];
/** The name of the place a part stands for, counted from the right. */
export const placeName = (fromRight: number, hindi = false) =>
  (hindi ? PLACES_HI : PLACES)[fromRight] ?? (hindi ? `${fromRight + 1}वाँ स्थान` : `place ${fromRight + 1}`);
