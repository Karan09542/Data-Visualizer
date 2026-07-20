// TODO(Refactor): Move to src/components/image-workspace/utils/color.ts
export const setOpacityOnHex = (colorString: string, opacityPercent: number): string => {
  let r = 0, g = 0, b = 0, a = 1;
  const opacityFactor = (opacityPercent || 100) / 100;
  const safeColor = colorString || "#000000";

  if (safeColor.startsWith('rgba(') || safeColor.startsWith('rgb(')) {
    const parts = safeColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
    if (parts) {
      r = parseInt(parts[1]) || 0;
      g = parseInt(parts[2]) || 0;
      b = parseInt(parts[3]) || 0;
      a = parts[4] ? parseFloat(parts[4]) : 1;
    }
  } else {
    const cleaned = safeColor.replace("#", "");
    if (cleaned.length === 3) {
      r = parseInt(cleaned[0] + cleaned[0], 16) || 0;
      g = parseInt(cleaned[1] + cleaned[1], 16) || 0;
      b = parseInt(cleaned[2] + cleaned[2], 16) || 0;
    } else if (cleaned.length === 6) {
      r = parseInt(cleaned.substring(0, 2), 16) || 0;
      g = parseInt(cleaned.substring(2, 4), 16) || 0;
      b = parseInt(cleaned.substring(4, 6), 16) || 0;
    }
  }

  // Guard against NaN
  r = Number.isNaN(r) ? 0 : r;
  g = Number.isNaN(g) ? 0 : g;
  b = Number.isNaN(b) ? 0 : b;
  a = Number.isNaN(a) ? 1 : a;

  return `rgba(${r}, ${g}, ${b}, ${(a * opacityFactor).toFixed(2)})`;
};
