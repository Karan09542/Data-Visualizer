import * as fabric from "fabric";
import { Command } from "../base/Command";

export class DuplicateCommand implements Command {
  name: string;
  private targetObj: fabric.Object | fabric.ActiveSelection;
  private clonedObj: fabric.Object | fabric.ActiveSelection | null = null;
  private activeArtboardId: string | null;

  constructor(name: string, targetObj: fabric.Object | fabric.ActiveSelection, activeArtboardId: string | null = null) {
    this.name = name;
    this.targetObj = targetObj;
    this.activeArtboardId = activeArtboardId;
  }

  execute(canvas: fabric.Canvas) {
    if (this.clonedObj) {
      this.redo(canvas);
      return;
    }

    this.targetObj.clone(['id', 'artboardId']).then((cloned) => {
      this.clonedObj = cloned;
      canvas.discardActiveObject();
      cloned.set({
         left: cloned.left! + 20,
         top: cloned.top! + 20,
         id: Date.now().toString() + Math.random().toString(),
         artboardId: (this.targetObj as any).artboardId || this.activeArtboardId
      });

      if (cloned.type === 'activeSelection') {
         cloned.canvas = canvas;
         (cloned as any).forEachObject((obj: any) => {
            obj.id = Date.now().toString() + Math.random().toString();
            obj.artboardId = obj.artboardId || this.activeArtboardId;
            canvas.add(obj);
         });
         cloned.setCoords();
      } else {
         canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    });
  }

  undo(canvas: fabric.Canvas) {
    if (!this.clonedObj) return;

    if (this.clonedObj.type === 'activeSelection') {
       (this.clonedObj as any).forEachObject((obj: any) => {
          canvas.remove(obj);
       });
    } else {
       canvas.remove(this.clonedObj);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas) {
    if (!this.clonedObj) return;
    
    if (this.clonedObj.type === 'activeSelection') {
       this.clonedObj.canvas = canvas;
       (this.clonedObj as any).forEachObject((obj: any) => {
          canvas.add(obj);
       });
       this.clonedObj.setCoords();
    } else {
       canvas.add(this.clonedObj);
    }
    canvas.setActiveObject(this.clonedObj);
    canvas.requestRenderAll();
  }
}
