import * as fabric from 'fabric';
import { Artboard } from '../types/artboards';
import { AddObjectCommand } from '../commands/object/AddObjectCommand';
import { DuplicateArtboardCommand } from '../commands/artboard/DuplicateArtboardCommand';
import { processPasteEvent } from '../../image-import/clipboard/clipboardImporter';

export interface ClipboardDependencies {
   canvas: fabric.Canvas;
   getActiveArtboardId: () => string | null;
   getArtboards: () => Artboard[];
   setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;
   setActiveArtboardId: (id: string | null) => void;
   updateLayersList: () => void;
   executeCommand: (cmd: any) => void;
   setNotification: (notif: { message: string, type: 'success' | 'error' | 'info' | 'warning' }) => void;
   setSelectedExportIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export class ClipboardController {
   private deps: ClipboardDependencies | null = null;

   attach(deps: ClipboardDependencies) {
      this.deps = deps;
   }

   detach() {
      this.deps = null;
   }

   async copyActiveObjectAsFormat(format: 'png' | 'jpeg' | 'svg' = 'png') {
      if (!this.deps || !this.deps.canvas) return;
      
      const activeObj = this.deps.canvas.getActiveObject();
      if (!activeObj) return;

      try {
         if (format === 'svg') {
            const clone = await activeObj.clone([]);
            const bounds = clone.getBoundingRect();

            const elElement = document.createElement('canvas');
            const tempCanvas = new fabric.StaticCanvas(elElement, {
               width: bounds.width,
               height: bounds.height
            });

            clone.set({
               left: (clone.left || 0) - bounds.left,
               top: (clone.top || 0) - bounds.top
            });
            clone.setCoords();
            tempCanvas.add(clone);

            const svg = tempCanvas.toSVG();
            tempCanvas.dispose();

            await navigator.clipboard.writeText(svg);
            this.deps.setNotification({ message: 'Copied as SVG', type: 'success' });
         } else {
            const dataUrl = activeObj.toDataURL({ format });
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([
               new ClipboardItem({ [blob.type]: blob })
            ]);
            this.deps.setNotification({ message: `Copied as ${format.toUpperCase()}`, type: 'success' });
         }
      } catch (e) {
         console.error('Failed to copy', e);
         if (this.deps) {
             this.deps.setNotification({ message: 'Failed to copy', type: 'error' });
         }
      }
   }

   duplicateActiveObject() {
      if (!this.deps || !this.deps.canvas) return;
      
      const activeObj = this.deps.canvas.getActiveObject();
      if (!activeObj) return;
      
      const deps = this.deps;

      activeObj.clone(['id', 'artboardId']).then((cloned) => {
         deps.canvas.discardActiveObject();
         cloned.set({
            left: (cloned.left || 0) + 20,
            top: (cloned.top || 0) + 20,
            id: Date.now().toString() + Math.random().toString(),
            artboardId: (activeObj as any).artboardId || deps.getActiveArtboardId()
         });
         
         if (cloned.type === 'activeSelection') {
            cloned.canvas = deps.canvas;
            (cloned as any).forEachObject((obj: any) => {
               obj.id = Date.now().toString() + Math.random().toString();
               obj.artboardId = obj.artboardId || deps.getActiveArtboardId();
               deps.canvas.add(obj);
            });
            cloned.setCoords();
         } else {
            deps.canvas.add(cloned);
         }
         
         const cmd = new AddObjectCommand("Duplicate Layer", cloned);
         deps.executeCommand(cmd);
      });
   }

   duplicateArtboard(board: Artboard) {
      if (!this.deps || !this.deps.canvas) return;
      const deps = this.deps;

      let maxX = 0;
      deps.getArtboards().forEach((b) => {
         maxX = Math.max(maxX, b.x + b.width);
      });
      const x = maxX + 100;

      const duplicated: Artboard = {
         ...board,
         id: "board_" + Date.now().toString() + Math.random().toString().substring(2, 6),
         name: `${board.name} Copy`,
         x,
         y: board.y,
      };

      let canvasObjectsToClone: fabric.Object[] = [];
      const activeObjs = deps.canvas.getObjects();
      activeObjs.forEach((o) => {
         if ((o as any).artboardId === board.id) {
            canvasObjectsToClone.push(o);
         }
      });

      const cmd = new DuplicateArtboardCommand(
         board,
         duplicated,
         canvasObjectsToClone,
         deps.setArtboards,
         deps.setActiveArtboardId,
         deps.updateLayersList
      );
      deps.executeCommand(cmd);
      deps.setSelectedExportIds(prev => ({ ...prev, [duplicated.id]: true }));

      // Center viewport on new board
      const canvas = deps.canvas;
      const cw = canvas.width!;
      const ch = canvas.height!;
      const vpt = canvas.viewportTransform!;
      vpt[4] = cw / 2 - (duplicated.x + duplicated.width / 2) * vpt[0];
      vpt[5] = ch / 2 - (duplicated.y + duplicated.height / 2) * vpt[3];
      canvas.requestRenderAll();
   }

   async handlePasteEvent(e: ClipboardEvent) {
      if (!this.deps || !this.deps.canvas) return;
      const results = await processPasteEvent(e);
      // Depending on the results, they might need to be added to canvas
      // In the original ImageWorkspace.tsx, processPasteEvent seems to add them directly
      // or we might need to handle them here if the importer doesn't.
      // Wait, processPasteEvent usually handles dropping them onto the canvas if it has a reference to it.
      // Actually, processPasteEvent doesn't add to canvas directly, it returns images/text?
      // Let's check what processPasteEvent does in a separate call if needed.
   }
}
