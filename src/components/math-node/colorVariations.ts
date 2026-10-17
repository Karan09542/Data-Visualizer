import { COLORS } from "./mathTypes";
import type { MathFunction } from "./mathTypes";

export type ColorVariationMode = "none" | "tint" | "shade";

export interface ColorVariationOptions {
  mode: ColorVariationMode;
  targetColor?: string;
  baseColor?: string;
  existingColors?: string[];
  fallbackIndex?: number;
}

/**
 * Converts a hex string (#rgb, #rrggbb, #rrggbbaa) to [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  if (!hex || typeof hex !== "string") return [59, 130, 246];
  let c = hex.trim().replace(/^#/, "");
  if (c.length === 3 || c.length === 4) {
    c = c
      .slice(0, 3)
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (c.length >= 6) {
    const num = parseInt(c.slice(0, 6), 16);
    if (!isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  return [59, 130, 246];
}

/**
 * Converts [r, g, b] to #rrggbb.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGB to HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

/**
 * Computes angular difference between two hues in degrees [0, 180].
 */
export function getHueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  return d > 180 ? 360 - d : d;
}

export const TINT_STEPS = [0, 0.18, 0.32, 0.46, 0.60, 0.72, 0.82];
export const SHADE_STEPS = [0, 0.16, 0.30, 0.44, 0.58, 0.70, 0.80];

/**
 * Generates an array of tints (mixing with white) from baseHex.
 * Index 0 is the base color itself.
 */
export function generateTints(baseHex: string): string[] {
  const [r, g, b] = hexToRgb(baseHex);
  return TINT_STEPS.map((t) =>
    rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t).toLowerCase(),
  );
}

/**
 * Generates an array of shades (mixing with black) from baseHex.
 * Index 0 is the base color itself.
 */
export function generateShades(baseHex: string): string[] {
  const [r, g, b] = hexToRgb(baseHex);
  return SHADE_STEPS.map((s) =>
    rgbToHex(r * (1 - s), g * (1 - s), b * (1 - s)).toLowerCase(),
  );
}

/**
 * Computes simple Manhattan color distance in RGB space.
 */
export function colorDist(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/**
 * Identifies the root base color of a hue family among existing colors.
 * For tints: the deepest/darkest member (lowest L).
 * For shades: the brightest/lightest member (highest L).
 */
export function findRootColor(
  targetColor: string,
  existingColors: string[] = [],
  mode: "tint" | "shade",
): string {
  const [tr, tg, tb] = hexToRgb(targetColor);
  const [th] = rgbToHsl(tr, tg, tb);

  const family = existingColors
    .map((c) => {
      const [r, g, b] = hexToRgb(c);
      const [h, s, l] = rgbToHsl(r, g, b);
      return { hex: c, h, s, l };
    })
    .filter((item) => getHueDiff(item.h, th) < 25);

  if (family.length === 0) return targetColor;

  if (mode === "tint") {
    family.sort((a, b) => a.l - b.l);
    return family[0].hex;
  } else {
    family.sort((a, b) => b.l - a.l);
    return family[0].hex;
  }
}

/**
 * Given the current mode and context, calculates the color for a new,
 * duplicated, or inserted function node.
 */
export function getNextVariationColor({
  mode,
  targetColor,
  baseColor,
  existingColors = [],
  fallbackIndex = 0,
}: ColorVariationOptions): string {
  if (mode === "none") {
    return COLORS[fallbackIndex % COLORS.length];
  }

  const rawTarget = targetColor || baseColor || COLORS[0];
  const rootColor = findRootColor(rawTarget, existingColors, mode);
  const palette = mode === "tint" ? generateTints(rootColor) : generateShades(rootColor);

  let closestStep = 0;
  let minDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDist(rawTarget, palette[i]);
    if (d < minDist) {
      minDist = d;
      closestStep = i;
    }
  }

  const existingSet = new Set(existingColors.map((c) => c.toLowerCase()));

  // 1. Preference: next step after closestStep that is unused
  for (let offset = 1; offset < palette.length; offset++) {
    const idx = (closestStep + offset) % palette.length;
    if (idx !== 0 && !existingSet.has(palette[idx])) {
      return palette[idx];
    }
  }

  // 2. Preference: any step in palette that is unused
  for (let i = 1; i < palette.length; i++) {
    if (!existingSet.has(palette[i])) {
      return palette[i];
    }
  }

  // 3. Fallback: next sequential step
  const nextIdx = ((closestStep + 1) % (palette.length - 1)) + 1;
  return palette[nextIdx];
}

/**
 * Harmonizes an array of MathFunctions to a unified tint or shade progression.
 */
export function harmonizeFunctions(
  functions: MathFunction[],
  mode: ColorVariationMode,
  baseColor?: string,
): MathFunction[] {
  if (mode === "none" || functions.length === 0) return functions;

  const root = baseColor || functions[0].color || COLORS[0];
  const palette = mode === "tint" ? generateTints(root) : generateShades(root);

  return functions.map((fn, index) => {
    const color = palette[index % palette.length];
    return { ...fn, color };
  });
}
