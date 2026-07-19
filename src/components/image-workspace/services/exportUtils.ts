import * as fabric from 'fabric';
import { ExportSettings } from '../../../types/export';
import { Artboard } from '../types/artboards';
import ImageWorker from "../../../utils/imageWorker?worker";
import { 
   hasSimd, hasThreads, 
   pngWasmUrl, jpegWasmUrl, webpWasmUrl, webpSimdWasmUrl, 
   avifWasmUrl, avifMtWasmUrl, resizeWasmUrl 
} from "./export/jsquash";

export const generateArtboardPixelBuffer = async (canvas: fabric.Canvas, board: Artboard): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
   // Create an offscreen canvas of the exact artboard dimensions
   const tempCanvas = document.createElement('canvas');
   tempCanvas.width = board.width;
   tempCanvas.height = board.height;
   const ctx = tempCanvas.getContext('2d')!;

   // 1. Draw background
   if (!board.transparent) {
      ctx.fillStyle = board.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, board.width, board.height);
   } else {
      ctx.clearRect(0, 0, board.width, board.height);
   }

   // 2. Draw elements assigned to this artboard
   ctx.save();
   ctx.translate(-board.x, -board.y);

   const objs = canvas.getObjects();
   objs.forEach((obj) => {
      if (!obj.visible || obj.type === 'activeSelection') return;

      const assignedId = (obj as any).artboardId;
      if (assignedId === board.id) {
         obj.render(ctx);
      }
   });

   ctx.restore();

   const imgData = ctx.getImageData(0, 0, board.width, board.height);
   return {
      buffer: imgData.data.buffer,
      width: board.width,
      height: board.height
   };
};

export const optimizePixelBuffer = async (
   pixelBuffer: ArrayBuffer,
   width: number,
   height: number,
   settings: ExportSettings,
   isLivePreview: boolean = false
): Promise<{ buffer: ArrayBuffer, psnr?: number }> => {
   const hasSimdResult = await hasSimd();
   const hasThreadsResult = await hasThreads();

   const worker = new ImageWorker();

   return await new Promise<{ buffer: ArrayBuffer, psnr?: number }>((resolve, reject) => {
      worker.onmessage = (e) => {
         if (e.data.success) {
            resolve({ buffer: e.data.resultBuffer, psnr: e.data.psnr });
         } else {
            reject(new Error(e.data.error || "Background processing failed"));
         }
         worker.terminate();
      };
      worker.onerror = (err) => {
         reject(err);
         worker.terminate();
      };

      worker.postMessage({
         pixelBuffer,
         width,
         height,
         exportWidth: settings.resize.enabled ? settings.resize.width : width,
         exportHeight: settings.resize.enabled ? settings.resize.height : height,
         exportResizeMethod: settings.resize.method,
         exportResizePremul: settings.resize.premul,
         exportResizeLinearRGB: settings.resize.linearRGB,
         exportFormat: settings.format,
         exportQuality: settings.format === 'jpeg' ? settings.mozjpeg.quality : settings.webp.quality,

         calculateMetrics: isLivePreview,

         wasmUrls: {
            png: pngWasmUrl,
            jpeg: jpegWasmUrl,
            webp: webpWasmUrl,
            webpSimd: webpSimdWasmUrl,
            avif: avifWasmUrl,
            avifMt: avifMtWasmUrl,
            resize: resizeWasmUrl
         }
      });
   });
};
