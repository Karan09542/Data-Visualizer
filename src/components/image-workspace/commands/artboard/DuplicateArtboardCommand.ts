import * as fabric from "fabric";
import { Command } from "../base/Command";
import { Artboard } from "../../types/artboards";

// TODO(Refactor): Move to src/components/image-workspace/commands/artboard/DuplicateArtboardCommand.ts
export class DuplicateArtboardCommand implements Command {
  name = "Duplicate Artboard";
  private boardToDuplicate: Artboard;
  private newBoard: Artboard;
  private canvasObjectsToClone: fabric.Object[] = [];
  private clonedObjects: fabric.Object[] = [];
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveId: React.Dispatch<React.SetStateAction<string>>;
  private updateLayersList: () => void;
  private isLoaded = false;

  constructor(
    boardToDuplicate: Artboard,
    newBoard: Artboard,
    canvasObjectsToClone: fabric.Object[],
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveId: React.Dispatch<React.SetStateAction<string>>,
    updateLayersList: () => void
  ) {
    this.boardToDuplicate = boardToDuplicate;
    this.newBoard = newBoard;
    this.canvasObjectsToClone = canvasObjectsToClone;
    this.setArtboards = setArtboards;
    this.setActiveId = setActiveId;
    this.updateLayersList = updateLayersList;
  }

  async execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => [...prev, this.newBoard]);
    this.setActiveId(this.newBoard.id);

    if (!this.isLoaded) {
      const clonePromises = this.canvasObjectsToClone.map(o => {
        return o.clone(['id', 'artboardId']).then((cloned) => {
          (cloned as any).id = Date.now().toString() + Math.random().toString();
          const dx = this.newBoard.x - this.boardToDuplicate.x;
          cloned.left = (o.left ?? 0) + dx;
          cloned.top = o.top ?? 0;
          (cloned as any).artboardId = this.newBoard.id;
          return cloned;
        });
      });

      const clonedList = await Promise.all(clonePromises);
      this.clonedObjects = clonedList;
      this.isLoaded = true;
    }

    this.clonedObjects.forEach(obj => {
      canvas.add(obj);
    });

    canvas.requestRenderAll();
    this.updateLayersList();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => prev.filter(b => b.id !== this.newBoard.id));
    this.clonedObjects.forEach(obj => {
      canvas.remove(obj);
    });
    canvas.requestRenderAll();
    this.updateLayersList();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => [...prev, this.newBoard]);
    this.setActiveId(this.newBoard.id);
    this.clonedObjects.forEach(obj => {
      canvas.add(obj);
    });
    canvas.requestRenderAll();
    this.updateLayersList();
  }
}
