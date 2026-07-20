import * as fabric from "fabric";
import { Command } from "../base/Command";
import { Artboard } from "../../types/artboards";

// TODO(Refactor): Move to src/components/image-workspace/commands/artboard/ArtboardStateCommand.ts
export class ArtboardStateCommand implements Command {
  name: string;
  private beforeBoards: Artboard[];
  private afterBoards: Artboard[];
  private beforeActiveId: string;
  private afterActiveId: string;
  private setArtboardsSnapshot: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveArtboardIdSnapshot: React.Dispatch<React.SetStateAction<string>>;

  constructor(
    name: string,
    beforeBoards: Artboard[],
    afterBoards: Artboard[],
    beforeActiveId: string,
    afterActiveId: string,
    setArtboardsSnapshot: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveArtboardIdSnapshot: React.Dispatch<React.SetStateAction<string>>
  ) {
    this.name = name;
    this.beforeBoards = beforeBoards;
    this.afterBoards = afterBoards;
    this.beforeActiveId = beforeActiveId;
    this.afterActiveId = afterActiveId;
    this.setArtboardsSnapshot = setArtboardsSnapshot;
    this.setActiveArtboardIdSnapshot = setActiveArtboardIdSnapshot;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.afterBoards);
    this.setActiveArtboardIdSnapshot(this.afterActiveId);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.beforeBoards);
    this.setActiveArtboardIdSnapshot(this.beforeActiveId);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.afterBoards);
    this.setActiveArtboardIdSnapshot(this.afterActiveId);
    canvas.requestRenderAll();
  }
}
