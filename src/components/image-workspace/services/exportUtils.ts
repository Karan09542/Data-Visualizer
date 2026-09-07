import * as fabric from 'fabric';
import { ExportSettings } from '../../../types/export';
import { Artboard } from '../types/artboards';
import ImageWorker from "../../../utils/imageWorker?worker";
import { 
   hasSimd, hasThreads, 
   pngWasmUrl, jpegWasmUrl, webpWasmUrl, webpSimdWasmUrl, 
   avifWasmUrl, avifMtWasmUrl, resizeWasmUrl 
} from "./export/jsquash";
import { isActiveSelection } from '../../../utils/fabric-utils';

/** Every object on the canvas, group children included. */
const flattenObjects = (objs: fabric.Object[]): fabric.Object[] =>
   objs.flatMap(o => {
      const children = (o as any)._objects as fabric.Object[] | undefined;
      return children && children.length ? [o, ...flattenObjects(children)] : [o];
   });

/**
 * Renders for export with two interactive-only fabric behaviours switched off.
 *
 * 1. objectCaching. fabric draws a cached bitmap whose resolution comes from
 *    getTotalObjectScaling() = objectScale * canvas.getZoom() * retinaScaling - i.e. the LIVE
 *    editor zoom. Exporting while zoomed out to 38% baked a 0.38x bitmap and then stretched it
 *    up to full artboard size, which is why exports looked soft while editing looked sharp.
 * 2. skipOffscreen (fabric default: true). FabricObject.render() bails early for anything outside
 *    the current viewport, so objects scrolled out of view were silently missing from the export.
 *
 * Both are restored afterwards, and the caches are invalidated on the way in and out so the
 * editor does not keep an export-scale bitmap.
 */
const withFullResolutionRender = <T,>(canvas: fabric.Canvas, draw: () => T): T => {
   const objects = flattenObjects(canvas.getObjects());
   const previousSkipOffscreen = canvas.skipOffscreen;
   const previousCaching = objects.map(o => o.objectCaching);

   canvas.skipOffscreen = false;
   objects.forEach(o => { o.objectCaching = false; o.dirty = true; });

   try {
      return draw();
   } finally {
      canvas.skipOffscreen = previousSkipOffscreen;
      objects.forEach((o, i) => { o.objectCaching = previousCaching[i]; o.dirty = true; });
   }
};

/**
 * Largest multiplier that still buys real detail: how far the highest-resolution image on this
 * artboard is being scaled down for display. Returns 1 when nothing would gain from a bigger render.
 */
export const getNativeScaleForBoard = (canvas: fabric.Canvas, board: Artboard, cap = 4): number => {
   let needed = 1;
   flattenObjects(canvas.getObjects()).forEach(obj => {
      if ((obj as any).artboardId !== board.id && !obj.group) return;
      const el = (obj as any).getElement?.() as (HTMLImageElement | HTMLCanvasElement | undefined);
      const sourceWidth = (el as any)?.naturalWidth || (el as any)?.width;
      if (!sourceWidth) return;
      const renderedWidth = (obj.width || 0) * (obj.scaleX || 1);
      if (renderedWidth <= 0) return;
      needed = Math.max(needed, sourceWidth / renderedWidth);
   });
   return Math.min(cap, Math.max(1, Math.round(needed * 100) / 100));
};

export const generateDirectNativeBlob = async (
   canvas: fabric.Canvas, 
   board: Artboard, 
   settings: ExportSettings
): Promise<Blob> => {
   // An explicit resize wins; otherwise render at the requested multiple of the artboard size.
   const scale = Math.max(1, settings.exportScale || 1);
   const targetWidth = settings.resize.enabled && settings.resize.width > 0 ? settings.resize.width : Math.round(board.width * scale);
   const targetHeight = settings.resize.enabled && settings.resize.height > 0 ? settings.resize.height : Math.round(board.height * scale);

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
   withFullResolutionRender(canvas, () => {
      canvas.getObjects().forEach((obj) => {
         if (!obj.visible || isActiveSelection(obj)) return;
         const assignedId = (obj as any).artboardId;
         if (assignedId === board.id) {
            obj.render(ctx);
         }
      });
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

export const generateArtboardPixelBuffer = async (
   canvas: fabric.Canvas,
   board: Artboard,
   scale: number = 1
): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
   const renderScale = Math.max(1, scale || 1);
   const outWidth = Math.max(1, Math.round(board.width * renderScale));
   const outHeight = Math.max(1, Math.round(board.height * renderScale));

   const tempCanvas = document.createElement('canvas');
   tempCanvas.width = outWidth;
   tempCanvas.height = outHeight;
   const ctx = tempCanvas.getContext('2d')!;
   // Without this the context resamples at the browser default of 'low', which visibly softens
   // any image drawn at a size other than its natural one.
   ctx.imageSmoothingEnabled = true;
   ctx.imageSmoothingQuality = 'high';

   // 1. Draw background
   if (!board.transparent) {
      ctx.fillStyle = board.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, outWidth, outHeight);
   } else {
      ctx.clearRect(0, 0, outWidth, outHeight);
   }

   // 2. Draw elements assigned to this artboard
   ctx.save();
   ctx.scale(renderScale, renderScale);
   ctx.translate(-board.x, -board.y);

   withFullResolutionRender(canvas, () => {
      canvas.getObjects().forEach((obj) => {
         if (!obj.visible || isActiveSelection(obj)) return;

         const assignedId = (obj as any).artboardId;
         if (assignedId === board.id) {
            obj.render(ctx);
         }
      });
   });

   ctx.restore();

   const imgData = ctx.getImageData(0, 0, outWidth, outHeight);
   return {
      buffer: imgData.data.buffer,
      width: outWidth,
      height: outHeight
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
