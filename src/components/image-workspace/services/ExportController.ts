import { Artboard } from '../types/artboards';
import { ExportSettings } from '../../../types/export';
import { optimizePixelBuffer, generateArtboardPixelBuffer } from './exportUtils';
import JSZip from 'jszip';
import * as fabric from 'fabric';

export interface PreviewData {
   originalUrl: string;
   optimizedUrl: string;
   origSize: number;
   optSize: number;
   psnr: number | null;
   origTargetW: number;
   origTargetH: number;
   optTargetW: number;
   optTargetH: number;
}

export class ExportController {
   public async export(
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string,
      exportTarget: "current" | "selected" | "all",
      selectedExportIds: { [key: string]: boolean },
      exportSettings: ExportSettings
   ): Promise<void> {
      let targets: Artboard[] = [];
      if (exportTarget === "current") {
         const curr = artboards.find(b => b.id === activeArtboardId) || artboards[0];
         targets = [curr];
      } else if (exportTarget === "selected") {
         targets = artboards.filter(b => selectedExportIds[b.id]);
         if (targets.length === 0) {
            throw new Error("No artboards selected to export!");
         }
      } else {
         targets = artboards;
      }

      if (targets.length === 1) {
         const board = targets[0];
         const { buffer, width, height } = await generateArtboardPixelBuffer(canvas, board);

         const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, exportSettings);
         const blob = new Blob([rawBuffer], { type: `image/${exportSettings.format}` });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${board.name.toLowerCase().replace(/\\s+/g, '_')}.${exportSettings.format}`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
      } else {
         const zip = new JSZip();
         for (const board of targets) {
            const { buffer, width, height } = await generateArtboardPixelBuffer(canvas, board);
            const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, {
               ...exportSettings,
               resize: { ...exportSettings.resize, enabled: false }
            });
            zip.file(`${board.name.toLowerCase().replace(/\\s+/g, '_')}.${exportSettings.format}`, rawBuffer);
         }
         const zipContent = await zip.generateAsync({ type: "blob" });
         const url = URL.createObjectURL(zipContent);
         const a = document.createElement('a');
         a.href = url;
         a.download = `artboards_export.zip`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
      }
   }

   public async generateLivePreview(
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string,
      exportTarget: "current" | "selected" | "all",
      exportSettings: ExportSettings,
      onProgress: (op: string) => void
   ): Promise<PreviewData | null> {
      if (artboards.length === 0) return null;

      const board = artboards.find(b => b.id === activeArtboardId) || artboards[0];
      if (!board) return null;

      onProgress("Extracting active composite elements...");

      const { buffer, width, height } = await generateArtboardPixelBuffer(canvas, board);

      let origTargetW = board.width;
      let origTargetH = board.height;

      let optTargetW = origTargetW;
      let optTargetH = origTargetH;
      if (exportTarget === "current" && exportSettings.resize.enabled) {
         optTargetW = exportSettings.resize.width;
         optTargetH = exportSettings.resize.height;
      }

      let previewScale = 1;
      const maxTargetDim = Math.max(origTargetW, origTargetH, optTargetW, optTargetH);
      if (maxTargetDim > 1200) {
         previewScale = 1200 / maxTargetDim;
      }

      const origPreviewW = Math.max(1, Math.round(origTargetW * previewScale));
      const origPreviewH = Math.max(1, Math.round(origTargetH * previewScale));

      const optPreviewW = Math.max(1, Math.round(optTargetW * previewScale));
      const optPreviewH = Math.max(1, Math.round(optTargetH * previewScale));

      onProgress("Rendering before/after viewport...");
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = origPreviewW;
      originalCanvas.height = origPreviewH;
      const oCtx = originalCanvas.getContext('2d')!;

      const sourceImage = new ImageData(new Uint8ClampedArray(buffer), width, height);
      const offscreenOriginal = document.createElement('canvas');
      offscreenOriginal.width = width;
      offscreenOriginal.height = height;
      offscreenOriginal.getContext('2d')!.putImageData(sourceImage, 0, 0);
      oCtx.drawImage(offscreenOriginal, 0, 0, origPreviewW, origPreviewH);

      const originalUrl = originalCanvas.toDataURL("image/png");

      onProgress("Analyzing baseline image color & size...");
      const originalBlob = await new Promise<Blob | null>(r => offscreenOriginal.toBlob(r, 'image/png'));
      const origSize = originalBlob ? originalBlob.size : buffer.byteLength;

      const formatLabel = exportSettings.format.toUpperCase();
      onProgress(`Running jSquash WASM optimization (${formatLabel})...`);

      const previewSettings: ExportSettings = {
         ...exportSettings,
         resize: {
            ...exportSettings.resize,
            enabled: true,
            width: optPreviewW,
            height: optPreviewH
         }
      };

      const { buffer: optimizedBuffer, psnr: calculatedPsnr } = await optimizePixelBuffer(
         buffer.slice(0),
         width,
         height,
         previewSettings,
         true
      );

      const optimizedBlob = new Blob([optimizedBuffer], { type: `image/${exportSettings.format}` });
      const projectedOptimizedSize = previewScale < 1 ? Math.round(optimizedBlob.size / (previewScale * previewScale)) : optimizedBlob.size;
      const optUrl = URL.createObjectURL(optimizedBlob);

      return {
         originalUrl,
         optimizedUrl: optUrl,
         origSize,
         optSize: projectedOptimizedSize,
         psnr: calculatedPsnr,
         origTargetW,
         origTargetH,
         optTargetW,
         optTargetH
      };
   }
}
