import * as fabric from "fabric";
import { AICommand } from "./AICommand";
import { ai } from "../../../../ai";
import { aiEventBus } from "../../../../ai/events/AIEventBus";

export class StyleTransferCommand extends AICommand {
  private styleImage: ImageBitmap | ImageData;
  /** How much of the style to take, 0 to 1; the rest keeps the picture as it was. */
  private strength: number;

  constructor(obj: fabric.Image, styleImage: ImageBitmap | ImageData, modelId?: string, strength: number = 0.5) {
    super('Style Transfer', obj, 'style-transfer', modelId);
    this.styleImage = styleImage;
    this.strength = strength;
  }

  async execute(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.afterSrc) {
      this.redo(canvas, updateLayers);
      return;
    }

    let imageData: ImageData;
    try {
      const src = this.obj.getSrc();
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          img.crossOrigin = '';
          img.src = this.obj.toDataURL({ format: 'png' });
        };
        img.src = src;
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      tempCtx.drawImage(img, 0, 0);
      imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    } catch (e) {
      console.error('[StyleTransferCommand] Failed to extract image data:', e);
      return;
    }

    // Call ai.execute with style image in options.metadata
    const { jobId, promise } = ai.execute(this.task, imageData, { 
      modelId: this.modelId,
      metadata: { styleImage: this.styleImage, styleStrength: this.strength }
    } as any, 5);
    
    const unsubProgress = aiEventBus.subscribe(jobId, (event) => {
      if (this.lastJobId) {
        aiEventBus.emit(this.lastJobId, { ...event });
      }
    });

    let cancelUnsub: (() => void) | undefined;
    let isCancelling = false;
    if (this.lastJobId) {
      cancelUnsub = aiEventBus.subscribe(this.lastJobId, (evt) => {
         if (evt.state === 'cancelled' && !isCancelling) {
            isCancelling = true;
            ai.cancel(jobId);
         }
      });
    }
    
    promise.then(result => {
      unsubProgress();
      if (cancelUnsub) cancelUnsub();
      
      let outputImage: ImageData | ImageBitmap | null = null;
      if (result.output instanceof ImageData || result.output instanceof ImageBitmap) {
        outputImage = result.output;
      }
      
      if (outputImage) {
        const canvasEl = document.createElement('canvas');
        canvasEl.width = outputImage.width;
        canvasEl.height = outputImage.height;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          if (outputImage instanceof ImageData) {
            ctx.putImageData(outputImage, 0, 0);
          } else {
            ctx.drawImage(outputImage, 0, 0);
          }
          this.afterSrc = canvasEl.toDataURL();
          this.applySrc(canvas, this.afterSrc, updateLayers);
        }
      }
    }).catch(e => {
       unsubProgress();
       if (cancelUnsub) cancelUnsub();
       
       if (e === 'AbortError' || (e as Error)?.message === 'AbortError') {
         console.log(`[StyleTransferCommand] Task was cancelled.`);
         return;
       }
       console.error(`[StyleTransferCommand] Task failed:`, e);
       alert(`AI Task Failed: ${e.message || e}`);
    });
  }
}
