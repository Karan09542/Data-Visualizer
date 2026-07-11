import * as fabric from 'fabric';
import { Artboard } from '../../../types/export';

export class ViewportController {
   private canvas: fabric.Canvas | null = null;
   private getArtboards: () => Artboard[];
   private getActiveArtboardId: () => string;
   private getIsMobile: () => boolean;
   private onZoomChanged: (zoomPercent: number) => void;

   constructor(
      getArtboards: () => Artboard[],
      getActiveArtboardId: () => string,
      getIsMobile: () => boolean,
      onZoomChanged: (zoomPercent: number) => void
   ) {
      this.getArtboards = getArtboards;
      this.getActiveArtboardId = getActiveArtboardId;
      this.getIsMobile = getIsMobile;
      this.onZoomChanged = onZoomChanged;
   }

   public attach(canvas: fabric.Canvas) {
      this.canvas = canvas;
   }

   public detach() {
      this.canvas = null;
   }

   public fitView() {
      if (!this.canvas || this.getArtboards().length === 0) return;

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      const artboards = this.getArtboards();
      const activeArtboardId = this.getActiveArtboardId();
      const isMobile = this.getIsMobile();

      const boards = isMobile
         ? artboards.filter(b => b.id === activeArtboardId)
         : artboards;
      const activeBoardsToFit = boards.length > 0 ? boards : [artboards[0]];

      activeBoardsToFit.forEach(b => {
         minX = Math.min(minX, b.x);
         minY = Math.min(minY, b.y);
         maxX = Math.max(maxX, b.x + b.width);
         maxY = Math.max(maxY, b.y + b.height);
      });

      // Add some padding
      const padding = isMobile ? 32 : 100;
      minX -= padding; minY -= padding;
      maxX += padding; maxY += padding;

      const w = maxX - minX;
      const h = maxY - minY;
      const cw = this.canvas.width!;
      const ch = this.canvas.height!;
      if (cw <= 0 || h <= 0) return;

      // Calculate optimal zoom
      const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
      const vpt = this.canvas.viewportTransform!;

      vpt[0] = zoom;
      vpt[3] = zoom;
      vpt[4] = cw / 2 - zoom * (minX + w / 2);
      vpt[5] = ch / 2 - zoom * (minY + h / 2);

      this.canvas.setViewportTransform(vpt);
      this.canvas.requestRenderAll();
      this.onZoomChanged(Math.round(zoom * 100));
   }

   public validateViewport() {
      if (!this.canvas || this.getArtboards().length === 0) return;

      const artboards = this.getArtboards();
      const activeArtboardId = this.getActiveArtboardId();
      const isMobile = this.getIsMobile();

      if (isMobile) {
         // In mobile mode, the artboard MUST remain centered.
         const activeBoard = artboards.find(b => b.id === activeArtboardId) || artboards[0];
         if (activeBoard) {
            const cw = this.canvas.width!;
            const ch = this.canvas.height!;
            const vpt = this.canvas.viewportTransform!;
            const zoom = this.canvas.getZoom();

            const expectedX = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
            const expectedY = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;

            const isCentered = Math.abs(vpt[4] - expectedX) < 1 && Math.abs(vpt[5] - expectedY) < 1;

            if (!isCentered) {
               this.fitView();
            }
         }
      } else {
         // On desktop, check if the active artboard is completely off-screen.
         const activeBoard = artboards.find(b => b.id === activeArtboardId) || artboards[0];
         if (activeBoard) {
            const cw = this.canvas.width!;
            const ch = this.canvas.height!;
            const vpt = this.canvas.viewportTransform!;
            const zoom = this.canvas.getZoom();

            const boardLeft = activeBoard.x * zoom + vpt[4];
            const boardTop = activeBoard.y * zoom + vpt[5];
            const boardRight = (activeBoard.x + activeBoard.width) * zoom + vpt[4];
            const boardBottom = (activeBoard.y + activeBoard.height) * zoom + vpt[5];

            // If completely outside the visible canvas area, pan back to it
            if (boardRight < 0 || boardLeft > cw || boardBottom < 0 || boardTop > ch) {
               this.fitView();
            }
         }
      }
   }

   public handleWheelZoom(opt: fabric.IEvent<WheelEvent>) {
      if (!this.canvas) return;
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();

      let zoom = this.canvas.getZoom();
      const delta = e.deltaY;

      // More consistent zoom formula
      const zoomStep = 0.05;
      const factor = 1 + (delta > 0 ? -zoomStep * 2 : zoomStep * 2);
      zoom *= factor;

      if (zoom > 20) zoom = 20;
      if (zoom < 0.05) zoom = 0.05;

      const point = new fabric.Point(e.offsetX, e.offsetY);
      this.canvas.zoomToPoint(point, zoom);
      
      this.onZoomChanged(Math.round(zoom * 100));
      this.canvas.requestRenderAll();
      this.validateViewport();
   }
}
