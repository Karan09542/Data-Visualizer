/**
 * Reconciling a text object's scale with its font size.
 *
 * Pure and fabric-free - it only reads a few plain properties - so the rule can be exercised
 * off-browser instead of being re-derived by eye.
 */

const TEXT_TYPES = ['i-text', 'text', 'textbox'];

export const isTextObject = (obj: any): boolean => !!obj && TEXT_TYPES.includes(obj.type);

/** Anything below this is not type any more, and a font size that small cannot be edited back. */
const MIN_FONT_SIZE = 1;

/**
 * Rewrites a text object's scale as a font size.
 *
 * Fitting and filling resize by setting scaleX/scaleY, which is right for a picture but wrong for
 * type: glyphs are drawn at `fontSize * scale`, so the number the Typography panel shows stops
 * describing the canvas the moment a fit runs. Folding the scale back in leaves one meaning for
 * "size".
 *
 * Returns the properties to apply, or null when the scale cannot be expressed as a font size - in
 * which case the object is left exactly as it was rather than reflowed behind the user's back.
 */
export const textScaleAsFontSize = (obj: any): Record<string, number> | null => {
  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;
  if (!(sy > 0) || !(sx > 0)) return null;
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return null;

  const fontSize = (obj.fontSize || 0) * sy;
  // Fabric clamps a scale of 0 to its minScaleLimit of 0.0001 rather than storing 0, so a
  // degenerate scale arrives here looking legitimate and would bake in a font size of ~0.004.
  // Leaving the scale alone keeps the object recoverable by resizing it again.
  if (!Number.isFinite(fontSize) || fontSize < MIN_FONT_SIZE) return null;

  const uniform = Math.abs(sx - sy) <= 1e-6 * Math.max(sx, sy, 1);

  if (obj.type === 'textbox') {
    // A textbox wraps at its own width, so only a uniform scale keeps the line breaks - and with
    // them the height - exactly where they were.
    if (!uniform) return null;
    return { fontSize, width: (obj.width || 0) * sx, scaleX: 1, scaleY: 1 };
  }

  // Auto-width text: any leftover horizontal stretch stays as scaleX, which reproduces the old box
  // exactly, since width scales with font size: W(F*sy) * (sx/sy) === W(F) * sx.
  return { fontSize, scaleX: sx / sy, scaleY: 1 };
};
