import { setOpacityOnHex } from "../../utils/color";
import * as fabric from "fabric";
import { Command } from "../base/Command";
import { Artboard } from "../../types/artboards";

// TODO(Refactor): Move to src/components/image-workspace/commands/artboard/ArtboardStateCommand.ts
export class ArtboardPropertyCommand implements Command {
  name: string;
  private boardId: string;
  private prop: keyof Artboard;
  private beforeVal: any;
  private afterVal: any;
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;

  constructor(
    name: string,
    boardId: string,
    prop: keyof Artboard,
    beforeVal: any,
    afterVal: any,
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>
  ) {
    this.name = name;
    this.boardId = boardId;
    this.prop = prop;
    this.beforeVal = beforeVal;
    this.afterVal = afterVal;
    this.setArtboards = setArtboards;
  }

  private applyVal(val: any) {
    this.setArtboards((prev) => {
      return prev.map((board) => {
        if (board.id !== this.boardId) return board;
        let updated = { ...board, [this.prop]: val };
        
        if (this.prop === "width" || this.prop === "height") {
          const w = this.prop === "width" ? val : board.width;
          const h = this.prop === "height" ? val : board.height;
          updated.orientation = w >= h ? "landscape" : "portrait";
        }

        if (this.prop === "orientation") {
          const newOrientation = val as "portrait" | "landscape";
          if (newOrientation === "portrait" && board.width > board.height) {
            updated.width = board.height;
            updated.height = board.width;
          } else if (newOrientation === "landscape" && board.width < board.height) {
            updated.width = board.height;
            updated.height = board.width;
          }
        }

        if (this.prop === "backgroundColor") {
          const color = val as string;
          if (color.startsWith('rgba(')) {
            const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.transparent = true;
            } else {
              updated.transparent = false;
            }
          } else {
            updated.transparent = false;
          }
        }

        if (this.prop === "transparent") {
          const isTransparent = val as boolean;
          const currentColor = board.backgroundColor || "#ffffff";
          if (isTransparent) {
            updated.backgroundColor = setOpacityOnHex(currentColor, 0);
          } else {
            const parts = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.backgroundColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, 1)`;
            }
          }
        }

        return updated;
      });
    });
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.afterVal);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.beforeVal);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.afterVal);
    canvas.requestRenderAll();
  }
}
