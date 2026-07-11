import * as fabric from 'fabric';
import { Artboard } from '../../../types/export';
import { getAbsoluteBoundingRect } from '../../../utils/fabric-utils';
import { Command } from '../commands/base/Command';
import { TransformObjectsCommand } from '../commands/object/TransformCommand';

export type AlignmentMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight' | 'utils_fitInside' | 'utils_centerInside' | 'matchWidth' | 'matchHeight' | 'distributeH' | 'distributeV';

export class AlignmentController {
   private canvas: fabric.Canvas | null = null;
   private getActiveArtboardId: () => string;
   private getArtboards: () => Artboard[];
   private getParentAlignmentObj: () => fabric.Object | null;
   private executeCommand: (cmd: Command) => void;
   private updateLayersList: () => void;

   constructor(
      getActiveArtboardId: () => string,
      getArtboards: () => Artboard[],
      getParentAlignmentObj: () => fabric.Object | null,
      executeCommand: (cmd: Command) => void,
      updateLayersList: () => void
   ) {
      this.getActiveArtboardId = getActiveArtboardId;
      this.getArtboards = getArtboards;
      this.getParentAlignmentObj = getParentAlignmentObj;
      this.executeCommand = executeCommand;
      this.updateLayersList = updateLayersList;
   }

   public attach(canvas: fabric.Canvas) {
      this.canvas = canvas;
   }

   public detach() {
      this.canvas = null;
   }

   private getTargetArtboard(obj: fabric.Object): Artboard {
      const artboardId = (obj as any).artboardId || this.getActiveArtboardId();
      const artboards = this.getArtboards();
      return artboards.find(b => b.id === artboardId) || artboards[0];
   }

   public alignSelection(mode: AlignmentMode) {
      if (!this.canvas) return;
      const activeObject = this.canvas.getActiveObject();
      if (!activeObject) return;

      const objects = activeObject.type === 'activeSelection'
         ? (activeObject as fabric.ActiveSelection).getObjects()
         : [activeObject];

      const parentObj = this.getParentAlignmentObj();
      const hasParent = parentObj && objects.includes(parentObj);
      const refArea = hasParent ? getAbsoluteBoundingRect(parentObj!) : null;

      const refX = refArea ? refArea.left : 0;
      const refY = refArea ? refArea.top : 0;
      const refW = refArea ? refArea.width : 0;
      const refH = refArea ? refArea.height : 0;

      const originalBoard = this.getTargetArtboard(activeObject);
      const board = {
         ...originalBoard,
         x: refArea ? refArea.left : originalBoard.x,
         y: refArea ? refArea.top : originalBoard.y,
         width: refArea ? refArea.width : originalBoard.width,
         height: refArea ? refArea.height : originalBoard.height,
      };

      const beforeStates = objects.map(o => ({
         obj: o,
         before: {
            left: o.left,
            top: o.top,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
            angle: o.angle,
            width: o.width,
            height: o.height,
         }
      }));

      // Handle Distribution modes directly first
      if (mode === 'distributeH' || mode === 'distributeV') {
         const children = hasParent ? objects.filter(o => o !== parentObj) : objects;
         if (children.length >= 2) {
            const childrenWithBounds = children.map(c => ({
               obj: c,
               bounds: getAbsoluteBoundingRect(c)
            }));

            const groupScaleX = activeObject.scaleX || 1;
            const groupScaleY = activeObject.scaleY || 1;

            if (mode === 'distributeH') {
               childrenWithBounds.sort((a, b) => a.bounds.left - b.bounds.left);

               const minLeft = refArea ? refX : childrenWithBounds[0].bounds.left;
               const maxRight = refArea ? (refX + refW) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.left + childrenWithBounds[childrenWithBounds.length - 1].bounds.width);
               const totalWidth = maxRight - minLeft;

               const totalChildrenWidth = childrenWithBounds.reduce((sum, item) => sum + item.bounds.width, 0);
               const totalSpacing = totalWidth - totalChildrenWidth;
               const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

               let currentLeft = minLeft;
               childrenWithBounds.forEach((item) => {
                  const deltaX = currentLeft - item.bounds.left;
                  item.obj.set({ left: item.obj.left! + (deltaX / groupScaleX) });
                  item.obj.setCoords();
                  currentLeft += item.bounds.width + gap;
               });
            } else {
               childrenWithBounds.sort((a, b) => a.bounds.top - b.bounds.top);

               const minTop = refArea ? refY : childrenWithBounds[0].bounds.top;
               const maxBottom = refArea ? (refY + refH) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.top + childrenWithBounds[childrenWithBounds.length - 1].bounds.height);
               const totalHeight = maxBottom - minTop;

               const totalChildrenHeight = childrenWithBounds.reduce((sum, item) => sum + item.bounds.height, 0);
               const totalSpacing = totalHeight - totalChildrenHeight;
               const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

               let currentTop = minTop;
               childrenWithBounds.forEach((item) => {
                  const deltaY = currentTop - item.bounds.top;
                  item.obj.set({ top: item.obj.top! + (deltaY / groupScaleY) });
                  item.obj.setCoords();
                  currentTop += item.bounds.height + gap;
               });
            }
         }
         
         if (activeObject) {
            activeObject.setCoords();
            if (activeObject.type === 'activeSelection') {
               (activeObject as any)._calcBounds?.(true);
            }
         }
         this.canvas.requestRenderAll();
         
         // Fire custom modified events for undo state as standard
         const afterStatesDis = objects.map(o => ({
            obj: o,
            before: beforeStates.find(s => s.obj === o)!.before,
            after: {
               left: o.left,
               top: o.top,
               scaleX: o.scaleX,
               scaleY: o.scaleY,
               angle: o.angle,
               width: o.width,
               height: o.height,
            }
         }));
         const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStatesDis);
         this.executeCommand(cmd);
         
         return;
      }

      objects.forEach(obj => {
         // Skip parent object since it acts as the key reference anchor
         if (refArea && obj === parentObj) {
            return;
         }

         const currentAbsBounds = getAbsoluteBoundingRect(obj);
         const currentScaleX = obj.scaleX || 1;
         const currentScaleY = obj.scaleY || 1;

         let targetScaleX = currentScaleX;
         let targetScaleY = currentScaleY;

         switch (mode) {
            case 'stretch':
               targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
               targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
               break;
            case 'fit': {
               const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fill': {
               const scale = Math.max(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fitWidth': {
               const scale = board.width / currentAbsBounds.width;
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fitHeight': {
               const scale = board.height / currentAbsBounds.height;
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'utils_fitInside': {
               const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'matchWidth':
               targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
               break;
            case 'matchHeight':
               targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
               break;
         }

         obj.set({
            scaleX: targetScaleX,
            scaleY: targetScaleY
         });
         obj.setCoords();

         const newAbsBounds = getAbsoluteBoundingRect(obj);

         let targetAbsLeft = newAbsBounds.left;
         let targetAbsTop = newAbsBounds.top;

         switch (mode) {
            case 'left':
               targetAbsLeft = board.x;
               break;
            case 'centerH':
            case 'utils_centerInside':
               targetAbsLeft = board.x + board.width / 2 - newAbsBounds.width / 2;
               break;
            case 'right':
               targetAbsLeft = board.x + board.width - newAbsBounds.width;
               break;
            case 'top':
               targetAbsTop = board.y;
               break;
            case 'centerV':
            case 'utils_centerInside':
               targetAbsTop = board.y + board.height / 2 - newAbsBounds.height / 2;
               break;
            case 'bottom':
               targetAbsTop = board.y + board.height - newAbsBounds.height;
               break;
            case 'fit':
            case 'fill':
            case 'stretch':
            case 'utils_fitInside':
               targetAbsLeft = board.x + board.width / 2 - newAbsBounds.width / 2;
               targetAbsTop = board.y + board.height / 2 - newAbsBounds.height / 2;
               break;
         }

         const deltaX = targetAbsLeft - newAbsBounds.left;
         const deltaY = targetAbsTop - newAbsBounds.top;

         const groupScaleX = activeObject.scaleX || 1;
         const groupScaleY = activeObject.scaleY || 1;

         obj.set({
            left: obj.left! + (deltaX / groupScaleX),
            top: obj.top! + (deltaY / groupScaleY)
         });
         obj.setCoords();
      });

      if (activeObject) {
         activeObject.setCoords();
         if (activeObject.type === 'activeSelection') {
            (activeObject as any)._calcBounds?.(true);
         }
      }
      this.canvas.requestRenderAll();

      const afterStates = objects.map(o => ({
         obj: o,
         before: beforeStates.find(s => s.obj === o)!.before,
         after: {
            left: o.left,
            top: o.top,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
            angle: o.angle,
            width: o.width,
            height: o.height,
         }
      }));
      const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStates);
      this.executeCommand(cmd);
   }
}
