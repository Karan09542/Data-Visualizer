import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/object/TransformCommand.ts
export class TransformObjectsCommand implements Command {
  name: string;
  private targetObjects: {
    obj: fabric.Object;
    before: {
      left: number;
      top: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      width: number;
      height: number;
      cropX?: number;
      cropY?: number;
      originX?: string;
      originY?: string;
    };
    after: {
      left: number;
      top: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      width: number;
      height: number;
      cropX?: number;
      cropY?: number;
      originX?: string;
      originY?: string;
    };
  }[];

  constructor(
    name: string,
    targets: {
      obj: fabric.Object;
      before: any;
      after: any;
    }[]
  ) {
    this.name = name;
    this.targetObjects = targets.map(t => ({
      obj: t.obj,
      before: {
        left: t.before.left ?? t.obj.left ?? 0,
        top: t.before.top ?? t.obj.top ?? 0,
        scaleX: t.before.scaleX ?? t.obj.scaleX ?? 1,
        scaleY: t.before.scaleY ?? t.obj.scaleY ?? 1,
        angle: t.before.angle ?? t.obj.angle ?? 0,
        width: t.before.width ?? t.obj.width ?? 0,
        height: t.before.height ?? t.obj.height ?? 0,
        cropX: t.before.cropX,
        cropY: t.before.cropY,
        originX: t.before.originX,
        originY: t.before.originY,
      },
      after: {
        left: t.after.left ?? t.obj.left ?? 0,
        top: t.after.top ?? t.obj.top ?? 0,
        scaleX: t.after.scaleX ?? t.obj.scaleX ?? 1,
        scaleY: t.after.scaleY ?? t.obj.scaleY ?? 1,
        angle: t.after.angle ?? t.obj.angle ?? 0,
        width: t.after.width ?? t.obj.width ?? 0,
        height: t.after.height ?? t.obj.height ?? 0,
        cropX: t.after.cropX,
        cropY: t.after.cropY,
        originX: t.after.originX,
        originY: t.after.originY,
      }
    }));
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  private applyState(t: any) {
    const props: any = {
      left: t.left,
      top: t.top,
      scaleX: t.scaleX,
      scaleY: t.scaleY,
      angle: t.angle,
      width: t.width,
      height: t.height,
    };
    if (t.cropX !== undefined) props.cropX = t.cropX;
    if (t.cropY !== undefined) props.cropY = t.cropY;
    if (t.originX !== undefined) props.originX = t.originX;
    if (t.originY !== undefined) props.originY = t.originY;
    return props;
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set(this.applyState(t.before));
      t.obj.setCoords();
    });
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set(this.applyState(t.after));
      t.obj.setCoords();
    });
    canvas.renderAll();
    updateLayers();
  }
}
