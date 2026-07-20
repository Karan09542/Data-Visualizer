import * as fabric from "fabric";

// TODO(Refactor): Move to src/components/image-workspace/commands/base/Command.ts
export interface Command {
  name: string;
  execute(canvas: fabric.Canvas, updateLayers: () => void): void;
  undo(canvas: fabric.Canvas, updateLayers: () => void): void;
  redo(canvas: fabric.Canvas, updateLayers: () => void): void;
}
