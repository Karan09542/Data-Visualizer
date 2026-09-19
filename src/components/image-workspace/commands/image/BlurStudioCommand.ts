import * as fabric from "fabric";
import { Command } from "../base/Command";

/**
 * Swaps an image's pixels for their blurred version, and back on undo.
 *
 * The image keeps its size: `setElement` would otherwise take the new element's full size and drop
 * any crop the image has.
 */
export class BlurStudioCommand implements Command {
  name = "Blur Studio";
  private obj: fabric.Image;
  private beforeElement: HTMLImageElement | HTMLCanvasElement;
  private afterElement: HTMLImageElement | HTMLCanvasElement;
  private size: { width: number; height: number };

  constructor(
    obj: fabric.Image,
    beforeElement: HTMLImageElement | HTMLCanvasElement,
    afterElement: HTMLImageElement | HTMLCanvasElement
  ) {
    this.obj = obj;
    this.beforeElement = beforeElement;
    this.afterElement = afterElement;
    this.size = { width: obj.width || 0, height: obj.height || 0 };
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterElement, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.beforeElement, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterElement, updateLayers);
  }

  private apply(
    canvas: fabric.Canvas,
    element: HTMLImageElement | HTMLCanvasElement,
    updateLayers: () => void
  ) {
    this.obj.setElement(element, this.size.width && this.size.height ? this.size : {});
    this.obj.set({ dirty: true });
    this.obj.setCoords();
    canvas.requestRenderAll();
    updateLayers();
  }
}
