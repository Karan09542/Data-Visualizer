import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/object/PropertyCommand.ts
export class PropertyChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private propertyName: string;
  private beforeValue: any;
  private afterValue: any;

  constructor(name: string, obj: fabric.Object, propertyName: string, beforeValue: any, afterValue: any) {
    this.name = name;
    this.obj = obj;
    this.propertyName = propertyName;
    this.beforeValue = beforeValue;
    this.afterValue = afterValue;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.propertyName as any, this.beforeValue);
    if (this.propertyName === 'visible') {
      if (!this.beforeValue) canvas.discardActiveObject();
    }
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      this.obj.setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.propertyName as any, this.afterValue);
    if (this.propertyName === 'visible') {
      if (!this.afterValue) canvas.discardActiveObject();
    }
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      this.obj.setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }
}
