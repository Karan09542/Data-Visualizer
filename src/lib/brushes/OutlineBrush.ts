import * as fabric from 'fabric';
import { BrushStyle, StrokePoint, Vec2, effectiveAlpha } from './types';

/**
 * Base for brushes whose width varies along the stroke.
 *
 * A fabric Path carries one stroke width for its whole length, so a nib that
 * goes thick and thin cannot be expressed as a stroked path at all. These
 * brushes build the stroke as a filled outline instead: walk up one side of the
 * centreline offsetting each point, then back down the other. Subclasses decide
 * only what that offset is at each point, which is the entire difference
 * between a calligraphy nib and a pen that tapers with speed.
 */
export abstract class OutlineBrush extends fabric.BaseBrush {
  protected style: BrushStyle;
  protected points: StrokePoint[] = [];
  private drawing = false;

  constructor(canvas: fabric.Canvas, style: BrushStyle) {
    super(canvas);
    this.style = style;
    this.color = style.color;
    this.width = style.size;
  }

  setStyle(style: BrushStyle): void {
    this.style = style;
    this.color = style.color;
    this.width = style.size;
  }

  /** Half-width offset vector at a point; the shape of the brush lives here. */
  protected abstract offsetAt(index: number): Vec2;

  /** Minimum travel before a point is recorded, in scene units. */
  protected minStep(): number {
    // Smoothing thins the sample rate, which is what irons out hand jitter.
    return 1 + (this.style.smoothing / 100) * 3;
  }

  onMouseDown(pointer: fabric.Point): void {
    this.drawing = true;
    this.points = [{ x: pointer.x, y: pointer.y, t: performance.now() }];
    this._render();
  }

  onMouseMove(pointer: fabric.Point): void {
    if (!this.drawing) return;
    const last = this.points[this.points.length - 1];
    if (Math.hypot(pointer.x - last.x, pointer.y - last.y) < this.minStep()) return;
    this.points.push({ x: pointer.x, y: pointer.y, t: performance.now() });
    this._render();
  }

  onMouseUp(): boolean {
    if (!this.drawing) return false;
    this.drawing = false;

    const outline = this.buildOutline();
    this.canvas.clearContext(this.canvas.contextTop);

    if (outline.length >= 3) {
      const shape = new fabric.Polygon(outline, {
        fill: this.style.color,
        stroke: undefined,
        strokeWidth: 0,
        opacity: effectiveAlpha(this.style),
        objectCaching: true,
      });

      this.canvas.add(shape);
      // Reuse the host's existing stroke pipeline (naming, artboard, history)
      // rather than inventing a second one.
      this.canvas.fire('path:created' as any, { path: shape } as any);
      this.canvas.requestRenderAll();
    }

    this.points = [];
    return false;
  }

  _render(): void {
    const ctx = this.canvas.contextTop;
    if (!ctx) return;

    this.canvas.clearContext(ctx);
    const outline = this.buildOutline();
    if (outline.length < 3) return;

    ctx.save();
    this._saveAndTransform(ctx);
    ctx.globalAlpha = effectiveAlpha(this.style);
    ctx.fillStyle = this.style.color;
    ctx.beginPath();
    ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) {
      ctx.lineTo(outline[i].x, outline[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Unit vector along the stroke at a point, averaged over its neighbours. */
  protected directionAt(index: number): Vec2 {
    const previous = this.points[Math.max(0, index - 1)];
    const next = this.points[Math.min(this.points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return { x: 1, y: 0 };
    return { x: dx / length, y: dy / length };
  }

  private buildOutline(): Vec2[] {
    const count = this.points.length;
    if (count === 0) return [];

    if (count === 1) {
      // A tap still leaves the nib's own footprint.
      const point = this.points[0];
      const offset = this.offsetAt(0);
      const tip = { x: -offset.y * 0.15, y: offset.x * 0.15 };
      return [
        { x: point.x + offset.x + tip.x, y: point.y + offset.y + tip.y },
        { x: point.x + offset.x - tip.x, y: point.y + offset.y - tip.y },
        { x: point.x - offset.x - tip.x, y: point.y - offset.y - tip.y },
        { x: point.x - offset.x + tip.x, y: point.y - offset.y + tip.y },
      ];
    }

    const near: Vec2[] = [];
    const far: Vec2[] = [];
    for (let i = 0; i < count; i++) {
      const point = this.points[i];
      const offset = this.offsetAt(i);
      near.push({ x: point.x + offset.x, y: point.y + offset.y });
      far.push({ x: point.x - offset.x, y: point.y - offset.y });
    }

    return near.concat(far.reverse());
  }
}
