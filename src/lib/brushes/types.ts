/**
 * Shared types for the brush module.
 *
 * The brushes here are fabric brushes, but nothing in this folder knows about
 * React or about the image workspace, so they can be attached to any fabric
 * canvas.
 */

export interface BrushStyle {
  /** Any CSS colour string; alpha inside it is respected. */
  color: string;
  /** Stroke width in canvas (scene) units. */
  size: number;
  /** 0-100 overall stroke strength. */
  opacity: number;
  /** 0-100; 100 is a hard edge, 0 a fully feathered one. */
  hardness: number;
  /** 0-100 paint density, multiplied into opacity like the brush engine does. */
  flow: number;
  /** 0-100; how aggressively input jitter is smoothed away. */
  smoothing: number;
  /** Nib angle in degrees, for brushes that have a nib. */
  angle?: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  /** Timestamp in ms, used by brushes whose width responds to speed. */
  t: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export const DEFAULT_BRUSH_STYLE: BrushStyle = {
  color: 'rgba(0, 0, 0, 1)',
  size: 10,
  opacity: 100,
  hardness: 100,
  flow: 100,
  smoothing: 40,
  angle: 45,
};

/** Paint density the way applyBrushSettings computes it, as a 0-1 factor. */
export const effectiveAlpha = (style: BrushStyle): number =>
  Math.max(0, Math.min(1, (style.opacity / 100) * (style.flow / 100)));

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
