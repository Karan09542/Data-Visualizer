import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/object/AddObjectCommand.ts
export class AddObjectCommand implements Command {
  name: string;
  private obj: fabric.Object;

  constructor(name: string, obj: fabric.Object) {
    this.name = name;
    this.obj = obj;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    if (!canvas.getObjects().includes(this.obj)) {
      canvas.add(this.obj);
    }
    canvas.setActiveObject(this.obj);
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    canvas.remove(this.obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    canvas.add(this.obj);
    canvas.setActiveObject(this.obj);
    canvas.renderAll();
    updateLayers();
  }
}
