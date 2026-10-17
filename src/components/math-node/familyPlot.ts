export * from "../../lib/math/familyPlot";
import { hexToRgb, rgbToHsl } from "./colorVariations";
import { hslToHex } from "./mathTypes";

/**
 * Generates distinct, harmonious curve colors for each curve in a family.
 * Creates a visually appealing gradient fan in HSL space based on the row's base color.
 */
export function getFamilyCurveColor(
  baseHex: string,
  index: number,
  total: number,
): string {
  if (total <= 1) return baseHex || "#3b82f6";
  const [r, g, b] = hexToRgb(baseHex || "#3b82f6");
  const [h, s] = rgbToHsl(r, g, b);

  const factor = index / (total - 1); // 0 to 1

  // Smooth spread from dark/deep (34%) to bright/luminous (74%)
  const targetL = 0.34 + factor * 0.40;

  // Subtle hue shift (+/- 18 degrees) to give curves visual separation and vibrancy
  const targetH = (h + (factor - 0.5) * 36 + 360) % 360;

  const targetS = Math.max(55, Math.min(95, s * 100));

  return hslToHex(targetH, targetS, targetL * 100);
}
