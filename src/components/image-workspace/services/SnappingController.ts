import * as fabric from 'fabric';
import { Artboard } from '../types/artboards';

export interface Guide {
   type: 'v' | 'h';
   pos: number;
}

export class SnappingController {
   private canvas: fabric.Canvas | null = null;
   private getArtboards: () => Artboard[];
   private getIsSnappingEnabled: () => boolean;
   private getSnapTolerance: () => number;
   private getIsAltPressed: () => boolean;
   private onGuidesChanged: (guides: Guide[]) => void;
   private guides: Guide[] = [];

   constructor(
      getArtboards: () => Artboard[],
      getIsSnappingEnabled: () => boolean,
      getSnapTolerance: () => number,
      getIsAltPressed: () => boolean,
      onGuidesChanged: (guides: Guide[]) => void
   ) {
      this.getArtboards = getArtboards;
      this.getIsSnappingEnabled = getIsSnappingEnabled;
      this.getSnapTolerance = getSnapTolerance;
      this.getIsAltPressed = getIsAltPressed;
      this.onGuidesChanged = onGuidesChanged;
      
      this.handleSnapping = this.handleSnapping.bind(this);
      this.renderGuides = this.renderGuides.bind(this);
   }

   public attach(canvas: fabric.Canvas) {
      this.canvas = canvas;
      this.canvas.on('object:moving', this.handleSnapping);
      this.canvas.on('after:render', this.renderGuides);
   }

   public detach() {
      if (this.canvas) {
         this.canvas.off('object:moving', this.handleSnapping);
         this.canvas.off('after:render', this.renderGuides);
         this.canvas = null;
      }
   }

   private renderGuides(e: any) {
      if (!this.canvas || this.guides.length === 0) return;

      const ctx = e.ctx || this.canvas.getContext();
      const vpt = this.canvas.viewportTransform;
      if (!ctx || !vpt) return;

      const cw = this.canvas.width || 0;
      const ch = this.canvas.height || 0;

      ctx.save();
      ctx.strokeStyle = "#4ade80"; // Bright green for guides
      ctx.lineWidth = 1 / Math.max(vpt[0], 0.1);
      ctx.setLineDash([5 / vpt[0], 5 / vpt[0]]);
      
      this.guides.forEach(guide => {
         if (guide.type === 'v') {
            const x = guide.pos * vpt[0] + vpt[4];
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ch);
            ctx.stroke();
         } else {
            const y = guide.pos * vpt[3] + vpt[5];
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cw, y);
            ctx.stroke();
         }
      });
      ctx.restore();
   }

   public clearSnapping() {
      this.guides = [];
      this.onGuidesChanged([]);
      if (this.canvas) {
         this.canvas.requestRenderAll();
      }
   }

   private handleSnapping(e: any) {
      if (!this.canvas || !this.getIsSnappingEnabled() || this.getIsAltPressed()) {
         this.clearSnapping();
         return;
      }

      const obj = e.target;
      if (!obj) return;

      const tolerance = this.getSnapTolerance();
      const bounds = obj.getBoundingRect();
      const objWidth = bounds.width;
      const objHeight = bounds.height;
      const objLeft = bounds.left;
      const objTop = bounds.top;
      const objRight = objLeft + objWidth;
      const objBottom = objTop + objHeight;
      const objCenterX = objLeft + objWidth / 2;
      const objCenterY = objTop + objHeight / 2;

      const newGuides: Guide[] = [];
      let snappedX = false;
      let snappedY = false;

      // --- ARTBOARD SNAPPING ---
      const artboards = this.getArtboards();
      artboards.forEach(board => {
         const bL = board.x;
         const bT = board.y;
         const bR = board.x + board.width;
         const bB = board.y + board.height;
         const bCX = board.x + board.width / 2;
         const bCY = board.y + board.height / 2;

         // X-axis snapping
         if (!snappedX) {
            if (Math.abs(objLeft - bL) < tolerance) {
               obj.set({ left: bL + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bL });
               snappedX = true;
            } else if (Math.abs(objRight - bR) < tolerance) {
               obj.set({ left: bR - objWidth + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bR });
               snappedX = true;
            } else if (Math.abs(objCenterX - bCX) < tolerance) {
               obj.set({ left: bCX - objWidth / 2 + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bCX });
               snappedX = true;
            } else if (Math.abs(objLeft - bR) < tolerance) {
               obj.set({ left: bR + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bR });
               snappedX = true;
            } else if (Math.abs(objRight - bL) < tolerance) {
               obj.set({ left: bL - objWidth + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bL });
               snappedX = true;
            }
         }

         // Y-axis snapping
         if (!snappedY) {
            if (Math.abs(objTop - bT) < tolerance) {
               obj.set({ top: bT + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bT });
               snappedY = true;
            } else if (Math.abs(objBottom - bB) < tolerance) {
               obj.set({ top: bB - objHeight + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bB });
               snappedY = true;
            } else if (Math.abs(objCenterY - bCY) < tolerance) {
               obj.set({ top: bCY - objHeight / 2 + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bCY });
               snappedY = true;
            } else if (Math.abs(objTop - bB) < tolerance) {
               obj.set({ top: bB + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bB });
               snappedY = true;
            } else if (Math.abs(objBottom - bT) < tolerance) {
               obj.set({ top: bT - objHeight + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bT });
               snappedY = true;
            }
         }

         // Safe Areas & Margins
         if (board.showSafeArea || board.showMargins) {
            const m = board.showMargins ? 0.1 : 0.05;
            const sL = bL + board.width * m;
            const sT = bT + board.height * m;
            const sR = bR - board.width * m;
            const sB = bB - board.height * m;

            if (!snappedX) {
               if (Math.abs(objLeft - sL) < tolerance) {
                  obj.set({ left: sL + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: sL });
                  snappedX = true;
               } else if (Math.abs(objRight - sR) < tolerance) {
                  obj.set({ left: sR - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: sR });
                  snappedX = true;
               }
            }
            if (!snappedY) {
               if (Math.abs(objTop - sT) < tolerance) {
                  obj.set({ top: sT + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: sT });
                  snappedY = true;
               } else if (Math.abs(objBottom - sB) < tolerance) {
                  obj.set({ top: sB - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: sB });
                  snappedY = true;
               }
            }
         }
      });

      // --- OBJECT SNAPPING ---
      if (!snappedX || !snappedY) {
         const otherObjects = this.canvas.getObjects().filter(o => o !== obj && o.visible && o.selectable);
         for (const other of otherObjects) {
            const oBounds = other.getBoundingRect();
            const oL = oBounds.left;
            const oT = oBounds.top;
            const oR = oL + oBounds.width;
            const oB = oT + oBounds.height;
            const oCX = oL + oBounds.width / 2;
            const oCY = oT + oBounds.height / 2;

            if (!snappedX) {
               if (Math.abs(objLeft - oL) < tolerance) {
                  obj.set({ left: oL + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oL });
                  snappedX = true;
               } else if (Math.abs(objRight - oR) < tolerance) {
                  obj.set({ left: oR - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oR });
                  snappedX = true;
               } else if (Math.abs(objCenterX - oCX) < tolerance) {
                  obj.set({ left: oCX - objWidth / 2 + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oCX });
                  snappedX = true;
               } else if (Math.abs(objLeft - oR) < tolerance) {
                  obj.set({ left: oR + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oR });
                  snappedX = true;
               } else if (Math.abs(objRight - oL) < tolerance) {
                  obj.set({ left: oL - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oL });
                  snappedX = true;
               }
            }

            if (!snappedY) {
               if (Math.abs(objTop - oT) < tolerance) {
                  obj.set({ top: oT + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oT });
                  snappedY = true;
               } else if (Math.abs(objBottom - oB) < tolerance) {
                  obj.set({ top: oB - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oB });
                  snappedY = true;
               } else if (Math.abs(objCenterY - oCY) < tolerance) {
                  obj.set({ top: oCY - objHeight / 2 + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oCY });
                  snappedY = true;
               } else if (Math.abs(objTop - oB) < tolerance) {
                  obj.set({ top: oB + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oB });
                  snappedY = true;
               } else if (Math.abs(objBottom - oT) < tolerance) {
                  obj.set({ top: oT - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oT });
                  snappedY = true;
               }
            }
            if (snappedX && snappedY) break;
         }
      }

      this.guides = newGuides;
      this.onGuidesChanged(newGuides);
      if (newGuides.length > 0) {
         this.canvas.requestRenderAll();
      }
   }
}
