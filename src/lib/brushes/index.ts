import * as fabric from 'fabric';
import { CalligraphyBrush } from './CalligraphyBrush';
import { InkPenBrush } from './InkPenBrush';
import { PixelBrush } from './PixelBrush';
import { SoftRoundBrush } from './SoftRoundBrush';
import { BrushStyle } from './types';

export { OutlineBrush } from './OutlineBrush';
export { StampBrush } from './StampBrush';
export { CalligraphyBrush } from './CalligraphyBrush';
export { InkPenBrush } from './InkPenBrush';
export { PixelBrush } from './PixelBrush';
export { SoftRoundBrush } from './SoftRoundBrush';
export { withAlpha, alphaOf } from './color';
export { DEFAULT_BRUSH_STYLE, effectiveAlpha } from './types';
export type { BrushStyle, StrokePoint, Vec2 } from './types';

/**
 * Brush ids this module implements itself.
 *
 * Everything else stays on fabric's built-in brushes, where a stroked path is
 * already the right answer.
 */
export const CUSTOM_BRUSH_TYPES = [
  'calligraphy',
  'ink',
  'pixel',
  'brush',
] as const;

export type CustomBrushType = (typeof CUSTOM_BRUSH_TYPES)[number];

export const isCustomBrushType = (type: string): type is CustomBrushType =>
  (CUSTOM_BRUSH_TYPES as readonly string[]).includes(type);

/**
 * Builds the brush for a type, or null when fabric's own brushes should handle
 * it. Callers keep their existing code path for the null case.
 */
export const createBrush = (
  type: string,
  canvas: fabric.Canvas,
  style: BrushStyle,
): fabric.BaseBrush | null => {
  switch (type) {
    case 'calligraphy':
      return new CalligraphyBrush(canvas, style);
    case 'ink':
      return new InkPenBrush(canvas, style);
    case 'pixel':
      return new PixelBrush(canvas, style);
    case 'brush':
      // The dropdown's "Art Brush".
      return new SoftRoundBrush(canvas, style);
    default:
      return null;
  }
};
