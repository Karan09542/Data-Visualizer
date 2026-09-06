import { StampBrush } from './StampBrush';
import { withAlpha } from './color';
import { clamp } from './types';

/**
 * The Art Brush: a soft round tip whose edge is controlled by Hardness.
 *
 * Hardness used to be faked with a fabric Shadow, which draws a blurred copy of
 * the whole stroke behind itself. That reads as a glow around a hard-edged
 * line, not as a soft brush - the centre stays crisp and the halo sits outside
 * the shape. A real soft brush has no crisp centre to begin with: each dab
 * fades from opaque core to nothing at its rim, and the stroke is the union of
 * those dabs.
 */
export class SoftRoundBrush extends StampBrush {
  protected spacing(): number {
    // Soft dabs need to overlap heavily or the stroke looks beaded.
    return Math.max(0.5, this.style.size * 0.06);
  }

  protected padding(): number {
    return this.style.size;
  }

  protected stamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const radius = Math.max(0.5, this.style.size / 2);
    const hardness = clamp(this.style.hardness, 0, 100) / 100;

    if (hardness >= 0.999) {
      ctx.fillStyle = this.style.color;
    } else {
      const gradient = ctx.createRadialGradient(
        x,
        y,
        radius * hardness,
        x,
        y,
        radius,
      );
      gradient.addColorStop(0, this.style.color);
      // Fade to a transparent version of the same colour; fading to
      // transparent black would ring every dab with a dark halo.
      gradient.addColorStop(1, withAlpha(this.style.color, 0));
      ctx.fillStyle = gradient;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
