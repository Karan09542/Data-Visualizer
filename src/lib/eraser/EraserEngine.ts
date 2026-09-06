import {
  DEFAULT_ERASER_SETTINGS,
  EraseStroke,
  ErasePoint,
  EraserSettings,
} from './types';

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

let strokeSeq = 0;
const nextStrokeId = () =>
  'erase_' + Date.now().toString(36) + '_' + (strokeSeq++).toString(36);

/**
 * Destructive-looking eraser built on a non-destructive model.
 *
 * The source image is never modified. The engine keeps an alpha mask built from
 * an ordered list of strokes and publishes an output canvas of "source with the
 * mask punched out". Because history is a list of strokes rather than a stack
 * of bitmaps, undo/redo costs almost no memory and any point in the history can
 * be rebuilt by replaying.
 */
export class EraserEngine {
  readonly width: number;
  readonly height: number;

  private source: CanvasImageSource;

  /** Published canvas: source composited with the mask. */
  private output: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;

  /** Flattened alpha removed by every committed stroke. */
  private committed: HTMLCanvasElement;
  private committedCtx: CanvasRenderingContext2D;

  /**
   * The in-progress erase stroke, drawn at full alpha and composited with the
   * stroke's opacity only once. Without this buffer, overlapping stamps inside
   * a single stroke would compound and a 30% eraser would punch straight
   * through wherever the user painted slowly.
   */
  private strokeLayer: HTMLCanvasElement;
  private strokeCtx: CanvasRenderingContext2D;

  private strokes: EraseStroke[] = [];
  private current: EraseStroke | null = null;
  private lastPoint: ErasePoint | null = null;

  constructor(source: CanvasImageSource, width: number, height: number) {
    this.source = source;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));

    this.output = createCanvas(this.width, this.height);
    this.outputCtx = this.output.getContext('2d')!;
    this.committed = createCanvas(this.width, this.height);
    this.committedCtx = this.committed.getContext('2d')!;
    this.strokeLayer = createCanvas(this.width, this.height);
    this.strokeCtx = this.strokeLayer.getContext('2d')!;

    this.recomposite();
  }

  /** The canvas to display. Stable across strokes, so it can be bound once. */
  get canvas(): HTMLCanvasElement {
    return this.output;
  }

  /** True once anything has actually been erased. */
  get hasEdits(): boolean {
    return this.strokes.length > 0;
  }

  getStrokes(): EraseStroke[] {
    return this.strokes.map((s) => ({ ...s, points: [...s.points] }));
  }

  // ---------------------------------------------------------------- painting

  beginStroke(point: ErasePoint, settings: Partial<EraserSettings> = {}): void {
    const resolved: EraserSettings = { ...DEFAULT_ERASER_SETTINGS, ...settings };
    this.current = { id: nextStrokeId(), points: [point], settings: resolved };
    this.lastPoint = point;

    this.strokeCtx.clearRect(0, 0, this.width, this.height);

    if (resolved.mode === 'restore') {
      // Restore subtracts from the mask, so there is no full-alpha buffer to
      // composite later - it writes straight into the committed mask.
      this.paintRestore(point, point, resolved);
    } else {
      this.stampSegment(this.strokeCtx, point, point, resolved);
    }

    this.recomposite(this.dirtyRect(point, point, resolved.size));
  }

  extendStroke(point: ErasePoint): void {
    if (!this.current || !this.lastPoint) return;

    const from = this.lastPoint;
    const settings = this.current.settings;

    if (settings.mode === 'restore') {
      this.paintRestore(from, point, settings);
    } else {
      this.stampSegment(this.strokeCtx, from, point, settings);
    }

    this.current.points.push(point);
    this.lastPoint = point;
    this.recomposite(this.dirtyRect(from, point, settings.size));
  }

  /** Commits the stroke and returns it, or null if nothing was drawn. */
  endStroke(): EraseStroke | null {
    const stroke = this.current;
    this.current = null;
    this.lastPoint = null;
    if (!stroke) return null;

    if (stroke.settings.mode !== 'restore') {
      this.flatten(stroke);
    }
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    this.strokes.push(stroke);
    this.recomposite();
    return stroke;
  }

  /** Drops an in-progress stroke without committing it. */
  cancelStroke(): void {
    if (!this.current) return;
    const wasRestore = this.current.settings.mode === 'restore';
    this.current = null;
    this.lastPoint = null;
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    // A restore stroke already wrote into the committed mask, so the only way
    // back is a replay of the strokes that are actually committed.
    if (wasRestore) this.replay();
    else this.recomposite();
  }

  // ----------------------------------------------------------------- history

  /** Re-applies a previously committed stroke (redo). */
  applyStroke(stroke: EraseStroke): void {
    if (this.strokes.some((s) => s.id === stroke.id)) return;
    this.strokes.push(stroke);
    // Appending is only equivalent to a replay when the stroke lands back on
    // the end of the list, which is exactly what a linear redo does.
    this.flatten(stroke);
    this.recomposite();
  }

  /** Removes a committed stroke (undo). */
  removeStroke(strokeId: string): void {
    const next = this.strokes.filter((s) => s.id !== strokeId);
    if (next.length === this.strokes.length) return;
    this.strokes = next;
    this.replay();
  }

  /** Replaces the whole stroke list, e.g. when restoring a saved document. */
  setStrokes(strokes: EraseStroke[]): void {
    this.strokes = strokes.map((s) => ({ ...s, points: [...s.points] }));
    this.replay();
  }

  clear(): void {
    this.strokes = [];
    this.current = null;
    this.lastPoint = null;
    this.replay();
  }

  // ------------------------------------------------------------------ output

  toDataURL(type = 'image/png', quality?: number): string {
    return this.output.toDataURL(type, quality);
  }

  /** Swaps in a new source of the same pixel size, keeping the erase history. */
  setSource(source: CanvasImageSource): void {
    this.source = source;
    this.recomposite();
  }

  destroy(): void {
    this.output.width = this.output.height = 0;
    this.committed.width = this.committed.height = 0;
    this.strokeLayer.width = this.strokeLayer.height = 0;
    this.strokes = [];
    this.current = null;
  }

  // ----------------------------------------------------------------- drawing

  private radiusFor(settings: EraserSettings, pressure = 1): number {
    return Math.max(0.5, (settings.size * clamp(pressure, 0.05, 1)) / 2);
  }

  /** Lays one soft dab of alpha down at a point. */
  private stamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hardness: number,
  ): void {
    const hard = clamp(hardness, 0, 100) / 100;

    if (hard >= 0.999) {
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      const gradient = ctx.createRadialGradient(x, y, radius * hard, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Walks the segment laying overlapping dabs. Stamping rather than stroking a
   * path is what gives a soft-edged brush even density around curves.
   */
  private stampSegment(
    ctx: CanvasRenderingContext2D,
    from: ErasePoint,
    to: ErasePoint,
    settings: EraserSettings,
  ): void {
    const radius = this.radiusFor(settings, to.pressure ?? 1);
    const spacing = Math.max(0.5, radius * 0.2);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.stamp(ctx, from.x + dx * t, from.y + dy * t, radius, settings.hardness);
    }
  }

  /** Restore mode subtracts from the committed mask instead of adding to it. */
  private paintRestore(
    from: ErasePoint,
    to: ErasePoint,
    settings: EraserSettings,
  ): void {
    const ctx = this.committedCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
    this.stampSegment(ctx, from, to, settings);
    ctx.restore();
  }

  /** Bakes one stroke into the committed mask at its own opacity. */
  private flatten(stroke: EraseStroke): void {
    const { settings, points } = stroke;
    if (points.length === 0) return;

    const drawInto = (ctx: CanvasRenderingContext2D) => {
      if (points.length === 1) {
        this.stampSegment(ctx, points[0], points[0], settings);
        return;
      }
      for (let i = 1; i < points.length; i++) {
        this.stampSegment(ctx, points[i - 1], points[i], settings);
      }
    };

    if (settings.mode === 'restore') {
      const ctx = this.committedCtx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
      drawInto(ctx);
      ctx.restore();
      return;
    }

    // Erase: render the stroke at full alpha in isolation, then lay it down
    // once at the stroke's opacity so overlaps inside the stroke do not stack.
    const layer = createCanvas(this.width, this.height);
    drawInto(layer.getContext('2d')!);

    this.committedCtx.save();
    this.committedCtx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
    this.committedCtx.drawImage(layer, 0, 0);
    this.committedCtx.restore();
  }

  /** Rebuilds the mask from scratch. Used by undo and by setStrokes. */
  private replay(): void {
    this.committedCtx.clearRect(0, 0, this.width, this.height);
    this.strokes.forEach((stroke) => this.flatten(stroke));
    this.recomposite();
  }

  /** Bounding box a segment touches, so live drawing only repaints that area. */
  private dirtyRect(from: ErasePoint, to: ErasePoint, size: number) {
    const pad = size / 2 + 2;
    return {
      x: Math.min(from.x, to.x) - pad,
      y: Math.min(from.y, to.y) - pad,
      w: Math.abs(to.x - from.x) + pad * 2,
      h: Math.abs(to.y - from.y) + pad * 2,
    };
  }

  private recomposite(rect?: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.outputCtx;
    const area = rect ?? { x: 0, y: 0, w: this.width, h: this.height };

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();

    ctx.clearRect(area.x, area.y, area.w, area.h);
    ctx.drawImage(this.source, 0, 0, this.width, this.height);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.committed, 0, 0);

    if (this.current && this.current.settings.mode === 'erase') {
      ctx.globalAlpha = clamp(this.current.settings.opacity, 0, 100) / 100;
      ctx.drawImage(this.strokeLayer, 0, 0);
    }

    ctx.restore();
  }
}
