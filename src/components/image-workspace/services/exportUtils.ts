import * as fabric from 'fabric';
import { ExportSettings } from '../../../types/export';
import { Artboard } from '../types/artboards';
import ImageWorker from "../../../utils/imageWorker?worker";
import { 
   hasSimd, hasThreads, 
   pngWasmUrl, jpegWasmUrl, webpWasmUrl, webpSimdWasmUrl, 
   avifWasmUrl, avifMtWasmUrl, resizeWasmUrl 
} from "./export/jsquash";

export const generateDirectNativeBlob = async (
   canvas: fabric.Canvas, 
   board: Artboard, 
   settings: ExportSettings
): Promise<Blob> => {
   const targetWidth = settings.resize.enabled && settings.resize.width > 0 ? settings.resize.width : board.width;
   const targetHeight = settings.resize.enabled && settings.resize.height > 0 ? settings.resize.height : board.height;

   const multiplier = targetWidth > 0 && board.width > 0 ? targetWidth / board.width : 1;

   const tempCanvas = document.createElement('canvas');
   tempCanvas.width = targetWidth;
   tempCanvas.height = targetHeight;
   const ctx = tempCanvas.getContext('2d')!;
   ctx.imageSmoothingEnabled = true;
   ctx.imageSmoothingQuality = 'high';

   ctx.save();
   ctx.scale(multiplier, multiplier);

   // 1. Draw background
   if (!board.transparent) {
      ctx.fillStyle = board.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, board.width, board.height);
   } else {
      ctx.clearRect(0, 0, board.width, board.height);
   }

   // 2. Render elements
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

   const format = settings.format;
   let mimeType = 'image/png';
   let quality = 1.0;

   if (format === 'jpeg') {
      mimeType = 'image/jpeg';
      quality = Math.max(0.01, Math.min(1.0, (settings.mozjpeg?.quality ?? 95) / 100));
   } else if (format === 'webp') {
      mimeType = 'image/webp';
      quality = Math.max(0.01, Math.min(1.0, (settings.webp?.quality ?? 95) / 100));
   } else if (format === 'avif') {
      mimeType = 'image/avif';
      quality = Math.max(0.01, Math.min(1.0, 1 - ((settings.avif?.cqLevel ?? 15) / 63)));
   }

   const blob = await new Promise<Blob | null>((resolve) => {
      tempCanvas.toBlob((b) => resolve(b), mimeType, quality);
   });

   // If native toBlob for this format is supported natively, return blob directly
   if (blob && (format === 'png' || blob.type === mimeType || blob.type === `image/${format}`)) {
      return blob;
   }

   // Fallback WASM encoding if browser toBlob doesn't support target mime type natively (e.g. JXL or older AVIF)
   const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
   const { buffer: rawBuffer } = await optimizePixelBuffer(imgData.data.buffer.slice(0), targetWidth, targetHeight, {
      ...settings,
      resize: { ...settings.resize, enabled: false }
   });
   return new Blob([rawBuffer], { type: `image/${format}` });
};

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

         mozjpeg: settings.mozjpeg,
         webp: settings.webp,
         avif: settings.avif,
         png: settings.png,
         jxl: settings.jxl,

         hasSimdResult,
         hasThreadsResult,

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
