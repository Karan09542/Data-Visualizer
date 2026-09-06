import * as fabric from 'fabric';
import { EraserEngine } from './EraserEngine';
import { EraseStroke } from './types';

/**
 * The shape a host application's undo stack is expected to consume. Declared
 * here rather than imported so the module has no dependency on any particular
 * editor - anything with this signature can hold an EraseStrokeCommand.
 */
export interface CanvasHistoryCommand {
  name: string;
  execute(canvas: fabric.Canvas, updateLayers: () => void): void;
  undo(canvas: fabric.Canvas, updateLayers: () => void): void;
  redo(canvas: fabric.Canvas, updateLayers: () => void): void;
}

/**
 * One erase stroke, as an undoable command.
 *
 * Holds only the stroke's point list, so a long erasing session costs a few
 * kilobytes of history rather than a full bitmap per step.
 */
export class EraseStrokeCommand implements CanvasHistoryCommand {
  name: string;

  private image: fabric.Image;
  private engine: EraserEngine;
  private stroke: EraseStroke;

  constructor(
    image: fabric.Image,
    engine: EraserEngine,
    stroke: EraseStroke,
    name?: string,
  ) {
    this.image = image;
    this.engine = engine;
    this.stroke = stroke;
    this.name = name ?? (stroke.settings.mode === 'restore' ? 'Restore' : 'Erase');
  }

  /**
   * The stroke is already on screen by the time it reaches the history stack,
   * and applyStroke ignores a stroke it already holds, so this is a no-op on
   * the initial push and a genuine re-apply when replayed.
   */
  execute(canvas: fabric.Canvas, updateLayers: () => void): void {
    this.engine.applyStroke(this.stroke);
    this.refresh(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void): void {
    this.engine.removeStroke(this.stroke.id);
    this.refresh(canvas, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void): void {
    this.engine.applyStroke(this.stroke);
    this.refresh(canvas, updateLayers);
  }

  private refresh(canvas: fabric.Canvas, updateLayers: () => void): void {
    this.image.set({ dirty: true });
    canvas.requestRenderAll();
    updateLayers();
  }
}
