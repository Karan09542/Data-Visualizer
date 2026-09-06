/**
 * Minimal colour parsing for the brush module.
 *
 * Kept local so the brushes stay independent of the host app's helpers.
 */

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const parse = (color: string): Rgba => {
  const fallback: Rgba = { r: 0, g: 0, b: 0, a: 1 };
  if (!color) return fallback;

  const value = color.trim();

  if (value.startsWith('rgb')) {
    const parts = value.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)/,
    );
    if (!parts) return fallback;
    return {
      r: parseInt(parts[1], 10) || 0,
      g: parseInt(parts[2], 10) || 0,
      b: parseInt(parts[3], 10) || 0,
      a: parts[4] === undefined ? 1 : parseFloat(parts[4]),
    };
  }

  const hex = value.replace('#', '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) || 0,
      g: parseInt(hex[1] + hex[1], 16) || 0,
      b: parseInt(hex[2] + hex[2], 16) || 0,
      a: 1,
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.substring(0, 2), 16) || 0,
      g: parseInt(hex.substring(2, 4), 16) || 0,
      b: parseInt(hex.substring(4, 6), 16) || 0,
      a: hex.length === 8 ? (parseInt(hex.substring(6, 8), 16) || 0) / 255 : 1,
    };
  }

  return fallback;
};

/**
 * The same colour at a given alpha.
 *
 * Soft edges must fade to a transparent version of the brush colour, not to
 * transparent black - fading to black leaves a dark halo around every dab.
 */
export const withAlpha = (color: string, alpha: number): string => {
  const { r, g, b } = parse(color);
  const safe = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${safe})`;
};

/** The colour's own alpha, so a picked rgba() is not silently discarded. */
export const alphaOf = (color: string): number => {
  const { a } = parse(color);
  return Number.isFinite(a) ? a : 1;
};
