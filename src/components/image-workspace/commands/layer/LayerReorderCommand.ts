import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/layer/LayerReorderCommand.ts
export class LayerReorderCommand implements Command {
  name: string;
  private beforeOrder: { id: string; idx: number }[];
  private afterOrder: { id: string; idx: number }[];

  constructor(name: string, beforeOrder: { id: string; idx: number }[], afterOrder: { id: string; idx: number }[]) {
    this.name = name;
    this.beforeOrder = beforeOrder;
    this.afterOrder = afterOrder;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  private applyOrder(canvas: fabric.Canvas, order: { id: string; idx: number }[], updateLayers: () => void) {
    const sorted = [...order].sort((a, b) => a.idx - b.idx);
    
    // Store IDs of currently active objects
    const activeObjects = canvas.getActiveObjects() as any[];
    const activeIds = activeObjects.map(o => o.id);
    
    // Clear selection so objects return to canvas
    canvas.discardActiveObject();

    const existingObjs = canvas.getObjects().filter(o => o.type !== 'activeSelection') as any[];
    const map = new Map<string, any>();
    existingObjs.forEach(o => map.set(o.id, o));

    const reorderedObjs: any[] = [];
    sorted.forEach(({id}) => {
       if (map.has(id)) {
          reorderedObjs.push(map.get(id));
          map.delete(id);
       }
    });
    // Append any untracked objects
    map.forEach(v => reorderedObjs.push(v));

    // Remove all and re-add in exact order
    existingObjs.forEach(o => canvas.remove(o));
    reorderedObjs.forEach(o => canvas.add(o));
    
    // Restore selection
    const toSelect = reorderedObjs.filter(o => activeIds.includes(o.id));
    if (toSelect.length > 0) {
      if (toSelect.length === 1) {
        canvas.setActiveObject(toSelect[0]);
      } else {
        const sel = new fabric.ActiveSelection(toSelect, { canvas });
        canvas.setActiveObject(sel);
      }
    }

    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyOrder(canvas, this.beforeOrder, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyOrder(canvas, this.afterOrder, updateLayers);
  }
}
