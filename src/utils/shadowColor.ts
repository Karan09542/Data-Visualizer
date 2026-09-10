/**
 * Splitting a CSS colour into a hex swatch plus an opacity, and putting it back together.
 *
 * A shadow is almost always a translucent colour, but a colour picker deals in solid swatches.
 * Keeping the two apart in the UI - a swatch and an opacity slider - means the pair has to survive
 * a round trip through whatever fabric happens to have stored: a preset's `rgba(...)`, a picker's
 * `#rrggbb`, or an eight-digit hex from somewhere else.
 */

export interface SplitColor {
  /** Always `#rrggbb`, lower case. */
  hex: string;
  /** 0-1. */
  alpha: number;
}

const FALLBACK: SplitColor = { hex: '#000000', alpha: 0.5 };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const byteToHex = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Parses hex (3, 4, 6 or 8 digit), rgb() and rgba(). Anything else falls back to a soft black. */
export const splitColor = (css: string | null | undefined): SplitColor => {
  if (!css || typeof css !== 'string') return { ...FALLBACK };
  const value = css.trim().toLowerCase();

  if (value === 'transparent') return { hex: '#000000', alpha: 0 };

  if (value.startsWith('#')) {
    const digits = value.slice(1);
    // #rgb and #rgba use one digit per channel, so each is doubled.
    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b, a] = digits.split('');
      if (!/^[0-9a-f]+$/.test(digits)) return { ...FALLBACK };
      return {
        hex: `#${r}${r}${g}${g}${b}${b}`,
        alpha: a === undefined ? 1 : clamp01(parseInt(a + a, 16) / 255)
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      if (!/^[0-9a-f]+$/.test(digits)) return { ...FALLBACK };
      return {
        hex: `#${digits.slice(0, 6)}`,
        alpha: digits.length === 8 ? clamp01(parseInt(digits.slice(6, 8), 16) / 255) : 1
      };
    }
    return { ...FALLBACK };
  }

  const rgb = value.match(/^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)(?:[\s,/]+([0-9.]+%?))?\s*\)$/);
  if (rgb) {
    const [, r, g, b, a] = rgb;
    let alpha = 1;
    if (a !== undefined) {
      alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
      if (!Number.isFinite(alpha)) alpha = 1;
    }
    return {
      hex: `#${byteToHex(parseFloat(r))}${byteToHex(parseFloat(g))}${byteToHex(parseFloat(b))}`,
      alpha: clamp01(alpha)
    };
  }

  return { ...FALLBACK };
};

/** Recombines a hex swatch and an opacity into the `rgba()` fabric stores. */
export const joinColor = (hex: string, alpha: number): string => {
  const { hex: clean } = splitColor(hex);
  const n = parseInt(clean.slice(1), 16);
  const a = Math.round(clamp01(alpha) * 100) / 100;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
