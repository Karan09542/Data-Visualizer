import * as fabric from "fabric";
import { Command } from "../base/Command";
import { Artboard } from "../../types/artboards";

// TODO(Refactor): Move to src/components/image-workspace/commands/artboard/DeleteArtboardCommand.ts
export class DeleteArtboardCommand implements Command {
  name = "Delete Artboard";
  private boardToDelete: Artboard;
  private prevActiveId: string;
  private newActiveId: string;
  private deleteIdx: number;
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveId: React.Dispatch<React.SetStateAction<string>>;

  constructor(
    boardToDelete: Artboard,
    prevActiveId: string,
    newActiveId: string,
    deleteIdx: number,
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveId: React.Dispatch<React.SetStateAction<string>>
  ) {
    this.boardToDelete = boardToDelete;
    this.prevActiveId = prevActiveId;
    this.newActiveId = newActiveId;
    this.deleteIdx = deleteIdx;
    this.setArtboards = setArtboards;
    this.setActiveId = setActiveId;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => prev.filter(b => b.id !== this.boardToDelete.id));
    this.setActiveId(this.newActiveId);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => {
      const copy = [...prev];
      copy.splice(this.deleteIdx, 0, this.boardToDelete);
      return copy;
    });
    this.setActiveId(this.prevActiveId);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.execute(canvas, updateLayers);
  }
}
