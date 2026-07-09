import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/object/PropertyCommand.ts
export class StyleChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private before: any;
  private after: any;

  constructor(name: string, obj: fabric.Object, before: any, after: any) {
    this.name = name;
    this.obj = obj;
    this.before = before;
    this.after = after;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.before);
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      (this.obj as any).setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.after);
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      (this.obj as any).setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }
}
