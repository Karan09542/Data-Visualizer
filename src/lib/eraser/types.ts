/**
 * Shared types for the eraser module.
 *
 * The module is deliberately free of React and fabric imports so the same
 * engine can drive a fabric canvas, a bare <canvas>, or an offscreen render.
 */

export type EraseMode = 'erase' | 'restore';

export interface ErasePoint {
  /** X in source-image pixel space (not screen space). */
  x: number;
  /** Y in source-image pixel space (not screen space). */
  y: number;
  /** 0..1 pen pressure; defaults to 1 for mouse/touch input. */
  pressure?: number;
}

export interface EraserSettings {
  /** Brush diameter in source-image pixels. */
  size: number;
  /** 0 = fully feathered edge, 100 = hard edge. */
  hardness: number;
  /** 0..100 strength of the whole stroke. */
  opacity: number;
  /** 'restore' paints previously erased pixels back in. */
  mode: EraseMode;
}

export interface EraseStroke {
  id: string;
  points: ErasePoint[];
  settings: EraserSettings;
}

export const DEFAULT_ERASER_SETTINGS: EraserSettings = {
  size: 40,
  hardness: 60,
  opacity: 100,
  mode: 'erase',
};
