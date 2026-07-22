import * as fabric from "fabric";
import { Command } from "../base/Command";
import { aiEngine } from "../../../../ai/manager/AIEngine";
import { aiInferenceCache } from "../../../../ai/manager/AIInferenceCache";
import { effectRegistry } from "../../effects/EffectRegistry";
import { ai } from "../../../../ai";
import { generateId } from "../../../../ai/utils";
import { aiEventBus } from "../../../../ai/events/AIEventBus";

export class SegmentationCommand implements Command {
  name: string;
  protected obj: fabric.Image;
  protected modelId: string;
  protected effectId: string;
  protected effectOptions: any;
  
  protected beforeSrc: string;
  protected beforeData: any;
  protected afterSrc: string | null = null;
  protected afterData: any = null;
  public lastJobId: string | null = null;
  private abortController: AbortController | null = null;

  constructor(
    obj: fabric.Image,
    modelId: string,
    effectId: string,
    effectOptions: any = {}
  ) {
    this.obj = obj;
    this.modelId = modelId;
    this.effectId = effectId;
    this.effectOptions = effectOptions;
    
    const effect = effectRegistry.get(effectId);
    this.name = effect ? effect.name : 'Segmentation';
    this.beforeSrc = obj.getSrc();
    this.beforeData = { ...((obj as any).data || {}) };
    this.lastJobId = generateId(); // Assign jobId immediately
  }

  private async applySrc(canvas: fabric.Canvas, src: string, updateLayers: () => void, targetData?: any) {
    const obj = this.obj;
    const oldWidth = obj.width || 1;
    const oldHeight = obj.height || 1;
    const oldScaleX = obj.scaleX || 1;
    const oldScaleY = obj.scaleY || 1;
    
    const savedState = {
      left: obj.left,
      top: obj.top,
      angle: obj.angle,
      opacity: obj.opacity,
      filters: [...(obj.filters || [])],
      clipPath: obj.clipPath,
      data: targetData ? { ...targetData } : { ...((obj as any).data || {}) },
      flipX: obj.flipX,
      flipY: obj.flipY,
      skewX: obj.skewX,
      skewY: obj.skewY
    };
    await obj.setSrc(src, { crossOrigin: 'anonymous' } as any);
    const newWidth = obj.width || 1;
    const newHeight = obj.height || 1;
    const scaleX = (oldWidth * oldScaleX) / newWidth;
    const scaleY = (oldHeight * oldScaleY) / newHeight;

    obj.set({
      ...savedState,
      scaleX,
      scaleY
    });
    
    obj.applyFilters();
    obj.setCoords();
    obj.dirty = true;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject === obj) {
      canvas.discardActiveObject();
      canvas.setActiveObject(obj);
    } else if (activeObject) {
      activeObject.setCoords();
    }
    
    canvas.renderAll();
    updateLayers();
  }

  async execute(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.afterSrc) {
      this.redo(canvas, updateLayers);
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    // Emit queued immediately so the UI picks it up
    if (this.lastJobId) {
      aiEventBus.emit(this.lastJobId, { state: 'queued' });
    }

    let imageData: ImageData;
    let originalSrc = (this.obj as any).data?._segOriginalSrc || this.beforeSrc;

    try {
      if (this.lastJobId) aiEventBus.emit(this.lastJobId, { state: 'preparing-image', progress: 0 });
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          img.crossOrigin = '';
          img.src = this.obj.toDataURL({ format: 'png' });
        };
        img.src = originalSrc;
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      tempCtx.drawImage(img, 0, 0);
      imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    } catch (e) {
      console.error('[SegmentationCommand] Failed to extract image data:', e);
      return;
    }

    try {
      // 1. Run AI Inference (via Engine which leverages Cache)
      // Note: We use the existing ai.execute path (which routes to AIQueue for now)
      // In a full implementation AIEngine would completely encapsulate this
      // For now, let's pretend AIEngine handles it
      
      // We will hash the image data to check cache
      const imageHash = await aiInferenceCache.hashImage(imageData);
      const cacheKey = aiInferenceCache.getCacheKey(imageHash, this.modelId);
      
      let segResult = aiInferenceCache.get(cacheKey)?.result;
      
      if (!segResult) {
        // Run AI Inference using the unified service
        const startTime = Date.now();
        
        // Use an internal option to hook into the progress events from the AI Queue
        const { promise, jobId } = ai.execute('background-removal', imageData, { 
          modelId: this.modelId,
          onProgress: (evt: any) => {
            if (this.lastJobId) {
              // Pipe the AI Queue's progress into our SegmentationCommand's Job ID
              aiEventBus.emit(this.lastJobId, { state: evt.state, progress: evt.progress });
            }
          }
        }, 5);
        
        // Wait for the AI model to finish
        const result = await promise;
        
        if (!(result.output instanceof ImageData)) {
          throw new Error('AI Inference did not return ImageData');
        }

        segResult = {
           foreground: result.output,
           alphaMask: result.output,
           boundingBox: new DOMRect(0, 0, imageData.width, imageData.height),
           width: imageData.width,
           height: imageData.height,
           modelId: this.modelId,
           inferenceTime: Date.now() - startTime
        };
        
        aiInferenceCache.set(cacheKey, this.modelId, imageHash, segResult);
      }

      // Execute effect on Web Worker so the UI does not freeze during heavy blurs
      const workerInstance = aiEngine.effectPool.getAvailableWorker();
      if (!workerInstance) {
        throw new Error('No available workers in effect pool');
      }

      aiEngine.effectPool.setWorkerBusy(workerInstance.id, true);

      if (this.lastJobId) {
        aiEventBus.emit(this.lastJobId, { state: 'post-processing', progress: 0 });
      }

      // Convert any HTMLImageElement in options to ImageBitmap before sending to worker
      const safeOptions = { ...this.effectOptions };
      const transferables: Transferable[] = [];
      if (imageData instanceof ImageBitmap) transferables.push(imageData);

      if (safeOptions.image instanceof HTMLImageElement) {
        safeOptions.image = await createImageBitmap(safeOptions.image);
        transferables.push(safeOptions.image);
      }

      const finalImage = await new Promise<ImageBitmap | ImageData>((resolve, reject) => {
        const messageId = Math.random().toString(36).substring(7);
        
        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === messageId) {
            workerInstance.worker.removeEventListener('message', handleMessage);
            aiEngine.effectPool.setWorkerBusy(workerInstance.id, false);
            
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
          }
        };

        workerInstance.worker.addEventListener('message', handleMessage);

        const request = {
          id: messageId,
          effectId: this.effectId,
          sourceImage: imageData,
          segmentation: segResult,
          options: safeOptions
        };

        workerInstance.worker.postMessage(request, transferables);
      });

      if (finalImage instanceof ImageData || finalImage instanceof ImageBitmap) {
        if (this.lastJobId) {
          aiEventBus.emit(this.lastJobId, { state: 'encoding', progress: 50 });
        }
        const canvasEl = document.createElement('canvas');
        canvasEl.width = finalImage.width;
        canvasEl.height = finalImage.height;
        const ctx = canvasEl.getContext('2d')!;
        if (finalImage instanceof ImageData) {
           ctx.putImageData(finalImage, 0, 0);
        } else {
           ctx.drawImage(finalImage, 0, 0);
        }
        
        this.afterSrc = canvasEl.toDataURL();
        this.afterData = { ...this.beforeData, _segOriginalSrc: originalSrc };
        this.applySrc(canvas, this.afterSrc, updateLayers, this.afterData);
        
        if (this.lastJobId) {
          aiEventBus.emit(this.lastJobId, { state: 'completed', progress: 100 });
        }
      }

    } catch (e: any) {
      console.error(`[SegmentationCommand] Effect ${this.effectId} failed:`, e);
      if (this.lastJobId) {
        aiEventBus.emit(this.lastJobId, { state: 'failed', error: e.message || String(e) });
      }
    }
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applySrc(canvas, this.beforeSrc, updateLayers, this.beforeData);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.afterSrc) {
      this.applySrc(canvas, this.afterSrc, updateLayers, this.afterData);
    } else {
      // If we don't have afterSrc (memory cleared), we regenerate!
      this.execute(canvas, updateLayers);
    }
  }
}
