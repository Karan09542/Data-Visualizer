import { StampBrush } from './StampBrush';

/**
 * A pixel-art brush: chunky, aliased, grid-aligned.
 *
 * What makes a pixel brush a pixel brush is that paint lands on a coarse grid
 * and every edge is a hard step. The previous implementation was a plain
 * antialiased round pencil, so nothing about it was pixelated. Here each dab is
 * snapped to a cell of the grid and filled as a square, cells are painted at
 * most once per pass so overlaps cannot darken, and the committed image has
 * smoothing disabled so zooming in shows crisp blocks rather than a blur.
 */
export class PixelBrush extends StampBrush {
  private painted = new Set<string>();

  /** Grid cell edge in scene units; a few cells across the brush width. */
  private cell(): number {
    return Math.max(1, Math.round(this.style.size / 4));
  }

  protected spacing(): number {
    // Step by half a cell so diagonals stay connected.
    return Math.max(0.5, this.cell() / 2);
  }

  protected padding(): number {
    return this.cell() * 2;
  }

  protected imageOptions(): Record<string, unknown> {
    return { imageSmoothing: false };
  }

  /** Each pass repaints the whole stroke, so the visited cells reset with it. */
  protected beginPaint(): void {
    this.painted = new Set();
  }

  protected stamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const cell = this.cell();
    const gridX = Math.floor(x / cell) * cell;
    const gridY = Math.floor(y / cell) * cell;

    const key = gridX + ':' + gridY;
    if (this.painted.has(key)) return;
    this.painted.add(key);

    ctx.fillStyle = this.style.color;
    ctx.fillRect(gridX, gridY, cell, cell);
  }
}
