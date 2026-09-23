import * as fabric from "fabric";
import { Command } from "../base/Command";

export interface LayerVisibilityTarget {
  id: string;
  prevVisible: boolean;
  nextVisible: boolean;
}

export class LayerVisibilityCommand implements Command {
  name: string;
  private targets: LayerVisibilityTarget[];

  constructor(name: string, targets: LayerVisibilityTarget[]) {
    this.name = name;
    this.targets = targets;
  }

  private applyVisibility(canvas: fabric.Canvas, visibleMap: Map<string, boolean>, updateLayers: () => void) {
    const canvasObjects = canvas.getObjects() as any[];
    let activeObjs = canvas.getActiveObjects() as any[];
    let selectionChanged = false;

    this.targets.forEach(({ id }) => {
      const obj = canvasObjects.find(o => o.id === id);
      if (!obj) return;

      const nextVisible = visibleMap.get(id);
      if (nextVisible === undefined) return;

      obj.visible = nextVisible;
      obj.hidden = !nextVisible;

      if (!nextVisible) {
        // If hidden, remove from active selection and disable interactivity
        obj.selectable = false;
        obj.evented = false;
        if (activeObjs.includes(obj)) {
          activeObjs = activeObjs.filter(o => o !== obj);
          selectionChanged = true;
        }
      } else {
        // Restored to visible
        obj.selectable = !obj.locked;
        obj.evented = !obj.locked;
      }
    });

    if (selectionChanged) {
      canvas.discardActiveObject();
      if (activeObjs.length === 1) {
        canvas.setActiveObject(activeObjs[0]);
      } else if (activeObjs.length > 1) {
        canvas.setActiveObject(new fabric.ActiveSelection(activeObjs, { canvas }));
      }
    }

    canvas.requestRenderAll();
    updateLayers();
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    const map = new Map<string, boolean>();
    this.targets.forEach(t => map.set(t.id, t.prevVisible));
    this.applyVisibility(canvas, map, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    const map = new Map<string, boolean>();
    this.targets.forEach(t => map.set(t.id, t.nextVisible));
    this.applyVisibility(canvas, map, updateLayers);
  }
}
