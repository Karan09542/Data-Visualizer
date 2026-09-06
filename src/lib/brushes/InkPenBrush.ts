import { OutlineBrush } from './OutlineBrush';
import { Vec2, clamp } from './types';

/** Speed, in scene units per ms, at which the line reaches its thinnest. */
const MAX_SPEED = 2.5;
/** Fraction of full width a fast stroke keeps. */
const MIN_WIDTH_FACTOR = 0.25;
/** How many points at each end are tapered into the paper. */
const TAPER_POINTS = 6;

/**
 * A pen whose line thins as the hand moves faster, and that lifts off cleanly
 * at both ends.
 *
 * Real ink lays down less pigment when the nib is dragged quickly, so a fast
 * flick is a fine line and a slow deliberate curve is a heavy one. Because the
 * width changes along the stroke, this has to be a filled outline; the previous
 * version was a constant-width pencil with a 1px drop shadow, which reads as a
 * slightly blurry pencil rather than a pen.
 */
export class InkPenBrush extends OutlineBrush {
  protected offsetAt(index: number): Vec2 {
    const direction = this.directionAt(index);
    const half = Math.max(0.5, this.style.size / 2);
    const factor = this.taperAt(index) * this.speedFactorAt(index);

    // Perpendicular to travel: the pen is round, only its pressure varies.
    return {
      x: -direction.y * half * factor,
      y: direction.x * half * factor,
    };
  }

  /** Averaged over neighbours so a single jittery sample cannot pinch the line. */
  private speedFactorAt(index: number): number {
    let total = 0;
    let samples = 0;

    for (let i = index - 1; i <= index + 1; i++) {
      const current = this.points[i];
      const previous = this.points[i - 1];
      if (!current || !previous) continue;

      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      const elapsed = Math.max(1, current.t - previous.t);
      total += distance / elapsed;
      samples++;
    }

    if (samples === 0) return 1;
    const speed = total / samples;
    return clamp(1 - speed / MAX_SPEED, MIN_WIDTH_FACTOR, 1);
  }

  /** Eases the width to a point at the start and end of the stroke. */
  private taperAt(index: number): number {
    const count = this.points.length;
    if (count < TAPER_POINTS * 2) return 1;

    const fromStart = index;
    const fromEnd = count - 1 - index;
    const edge = Math.min(fromStart, fromEnd);
    if (edge >= TAPER_POINTS) return 1;

    // Square root keeps the taper short and pen-like rather than a long wedge.
    return Math.sqrt((edge + 1) / (TAPER_POINTS + 1));
  }
}
