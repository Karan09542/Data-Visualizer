import * as fabric from "fabric";
import { Command } from "../base/Command";

/**
 * Adds several objects as one step, and leaves them selected together.
 *
 * A macro of single AddObjectCommands does the same job one object at a time: each add selects its
 * own object, redraws the whole canvas and rebuilds the layer list, so adding ten copies meant ten
 * selection changes and ten redraws. This does each of those once.
 */
export class AddObjectsCommand implements Command {
  name: string;
  private objects: fabric.Object[];

  constructor(name: string, objects: fabric.Object[]) {
    this.name = name;
    this.objects = [...objects];
  }

  private select(canvas: fabric.Canvas) {
    if (this.objects.length === 1) {
      canvas.setActiveObject(this.objects[0]);
    } else if (this.objects.length > 1) {
      canvas.setActiveObject(new fabric.ActiveSelection(this.objects, { canvas }));
    }
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    const present = new Set(canvas.getObjects());
    const missing = this.objects.filter(o => !present.has(o));
    if (missing.length) canvas.add(...missing);
    this.select(canvas);
    canvas.requestRenderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    // Dissolve any selection holding them first, so each is removed at its real canvas position.
    canvas.discardActiveObject();
    canvas.remove(...this.objects);
    canvas.requestRenderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.execute(canvas, updateLayers);
  }
}
