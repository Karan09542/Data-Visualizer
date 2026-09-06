import { OutlineBrush } from './OutlineBrush';
import { Vec2 } from './types';

/**
 * A real calligraphy nib.
 *
 * The nib is a flat edge held at a fixed angle, and it does not rotate as the
 * hand moves. Its offset is therefore constant, which is the whole trick: a
 * stroke travelling perpendicular to the nib exposes its full width and comes
 * out thick, while a stroke travelling along the nib exposes only its thin edge
 * and comes out hairline. Everything between varies smoothly, giving the
 * thick/thin modulation that makes a hand look calligraphic.
 *
 * The previous implementation only set strokeLineCap to 'square', which left a
 * uniform-width stroke with blunt ends - nothing a nib does.
 */
export class CalligraphyBrush extends OutlineBrush {
  protected offsetAt(): Vec2 {
    const degrees = this.style.angle ?? 45;
    const radians = (degrees * Math.PI) / 180;
    const half = Math.max(0.5, this.style.size / 2);

    return {
      x: Math.cos(radians) * half,
      y: Math.sin(radians) * half,
    };
  }
}
