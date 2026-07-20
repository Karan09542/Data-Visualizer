import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/object/DeleteObjectCommand.ts
export class DeleteObjectCommand implements Command {
  name: string;
  private objects: fabric.Object[];

  constructor(name: string, objects: fabric.Object[]) {
    this.name = name;
    this.objects = [...objects];
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.objects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.objects.forEach(obj => {
      if (!canvas.getObjects().includes(obj)) {
        canvas.add(obj);
      }
    });
    if (this.objects.length === 1) {
      canvas.setActiveObject(this.objects[0]);
    } else if (this.objects.length > 1) {
      const sel = new fabric.ActiveSelection(this.objects, { canvas });
      canvas.setActiveObject(sel);
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.execute(canvas, updateLayers);
  }
}
