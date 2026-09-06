import * as fabric from 'fabric';
import { BrushStyle, StrokePoint, clamp, effectiveAlpha } from './types';

/** Upper bound on the offscreen buffer, so a huge stroke cannot exhaust memory. */
const MAX_BUFFER_EDGE = 4096;

/**
 * Base for brushes made of stamped dabs rather than a stroked path.
 *
 * Grain, soft falloff and hard pixel edges are all properties of the dab, and a
 * vector path has no dabs to give them to. These brushes stamp onto an
 * offscreen canvas and commit a fabric.Image, so the stroke is raster - the
 * trade for texture a path cannot represent.
 *
 * Dabs are laid down at full alpha and the stroke's opacity is applied once to
 * the finished object. Stamping them at partial alpha instead would compound at
 * every overlap and a 30% brush would come out solid wherever the hand slowed.
 */
export abstract class StampBrush extends fabric.BaseBrush {
  protected style: BrushStyle;
  protected points: StrokePoint[] = [];
  private drawing = false;
  /** Extra pixels per scene unit, so a stroke drawn while zoomed in stays sharp. */
  private resolution = 1;

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

  /** Draws one dab, in stroke-local coordinates. */
  protected abstract stamp(ctx: CanvasRenderingContext2D, x: number, y: number): void;

  /** Distance between dabs, in scene units. */
  protected spacing(): number {
    return Math.max(0.5, this.style.size * 0.15);
  }

  /** Half-width of the footprint, used to size the buffer. */
  protected padding(): number {
    return this.style.size;
  }

  /** Applied to the committed fabric.Image. */
  protected imageOptions(): Record<string, unknown> {
    return {};
  }

  onMouseDown(pointer: fabric.Point): void {
    this.drawing = true;
    this.resolution = clamp(this.canvas.getZoom() || 1, 1, 3);
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

    this.canvas.clearContext(this.canvas.contextTop);
    const image = this.buildImage();

    if (image) {
      this.canvas.add(image);
      this.canvas.fire('path:created' as any, { path: image } as any);
      this.canvas.requestRenderAll();
    }

    this.points = [];
    return false;
  }

  _render(): void {
    const ctx = this.canvas.contextTop;
    if (!ctx || this.points.length === 0) return;

    this.canvas.clearContext(ctx);
    ctx.save();
    this._saveAndTransform(ctx);
    ctx.globalAlpha = effectiveAlpha(this.style);
    this.paint(ctx);
    ctx.restore();
  }

  protected minStep(): number {
    return Math.max(0.5, this.spacing() * 0.9);
  }

  /** Hook for per-pass state; paint() runs for each preview frame and again
   *  when the stroke is committed, so anything accumulated must reset here. */
  protected beginPaint(): void {
    /* no-op by default */
  }

  /** Walks the centreline laying dabs at even spacing. */
  private paint(ctx: CanvasRenderingContext2D): void {
    this.beginPaint();
    const spacing = this.spacing();

    if (this.points.length === 1) {
      this.stamp(ctx, this.points[0].x, this.points[0].y);
      return;
    }

    for (let i = 1; i < this.points.length; i++) {
      const from = this.points[i - 1];
      const to = this.points[i];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(distance / spacing));

      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        this.stamp(ctx, from.x + dx * t, from.y + dy * t);
      }
    }
  }

  private buildImage(): fabric.Image | null {
    if (this.points.length === 0) return null;

    const pad = this.padding();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    const sceneWidth = Math.max(1, maxX - minX);
    const sceneHeight = Math.max(1, maxY - minY);

    // Drop resolution rather than the stroke if the buffer would be enormous.
    const resolution = Math.min(
      this.resolution,
      MAX_BUFFER_EDGE / Math.max(sceneWidth, sceneHeight),
    );
    const scale = Math.max(0.25, resolution);

    const buffer = document.createElement('canvas');
    buffer.width = Math.max(1, Math.round(sceneWidth * scale));
    buffer.height = Math.max(1, Math.round(sceneHeight * scale));

    const ctx = buffer.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);
    this.paint(ctx);

    return new fabric.Image(buffer, {
      // Fabric 7 defaults originX/originY to 'center', so left/top would put
      // the buffer's middle at the stroke's top-left corner and the finished
      // stroke would land half its own size up and to the left of where it was
      // drawn. The buffer is addressed from its corner, so say so.
      originX: 'left',
      originY: 'top',
      left: minX,
      top: minY,
      scaleX: 1 / scale,
      scaleY: 1 / scale,
      opacity: effectiveAlpha(this.style),
      objectCaching: true,
      ...this.imageOptions(),
    });
  }
}
