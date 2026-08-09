import * as fabric from "fabric";
import { Command } from "../base/Command";
import { aiEngine } from "../../../../ai/manager/AIEngine";
import { aiInferenceCache } from "../../../../ai/manager/AIInferenceCache";
import { effectRegistry } from "../../effects/EffectRegistry";
import { ai } from "../../../../ai";
import { generateId } from "../../../../ai/utils";
import { aiEventBus } from "../../../../ai/events/AIEventBus";

export class FaceUtilityCommand implements Command {
  name: string;
  protected obj: fabric.Image;
  protected modelId: string;
  protected effectId: string;
  protected effectOptions: any;
  
  protected beforeSrc: string;
  protected beforeData: any;
  protected beforeTransform: any;
  protected afterSrc: string | null = null;
  protected afterData: any = null;
  protected afterTransform: any = null;
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
    this.name = effect ? effect.name : 'Face Utility';
    this.beforeSrc = obj.getSrc();
    this.beforeData = { ...((obj as any).data || {}) };
    this.beforeTransform = {
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      left: obj.left,
      top: obj.top
    };
    this.lastJobId = generateId(); // Assign pseudo jobId immediately
  }

  private async applySrc(canvas: fabric.Canvas, src: string, updateLayers: () => void, targetData?: any, targetTransform?: any) {
    const obj = this.obj;
    const oldWidth = obj.width || 1;
    const oldHeight = obj.height || 1;
    const oldScaleX = obj.scaleX || 1;
    const oldScaleY = obj.scaleY || 1;
    
    const savedState = {
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
    
    let finalScaleX = 1;
    let finalScaleY = 1;
    let finalLeft = obj.left;
    let finalTop = obj.top;

    if (targetTransform) {
      finalScaleX = targetTransform.scaleX;
      finalScaleY = targetTransform.scaleY;
      finalLeft = targetTransform.left;
      finalTop = targetTransform.top;
    } else {
      let scaleX = (oldWidth * oldScaleX) / newWidth;
      let scaleY = (oldHeight * oldScaleY) / newHeight;

      if (this.effectId.includes('crop')) {
        const oldVisualWidth = oldWidth * oldScaleX;
        const oldVisualHeight = oldHeight * oldScaleY;
        
        const fitScaleW = oldVisualWidth / newWidth;
        const fitScaleH = oldVisualHeight / newHeight;
        
        const uniformScale = Math.min(fitScaleW, fitScaleH);
        
        scaleX = uniformScale;
        scaleY = uniformScale;
      }
      
      finalScaleX = scaleX;
      finalScaleY = scaleY;
      
      // Save it as afterTransform if we haven't already
      if (!this.afterTransform) {
        this.afterTransform = {
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          left: finalLeft,
          top: finalTop
        };
      }
    }

    obj.set({
      ...savedState,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
      left: finalLeft,
      top: finalTop
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

    if (this.lastJobId) {
      aiEventBus.emit(this.lastJobId, { state: 'queued' });
    }

    let imageData: ImageData;
    let originalSrc = (this.obj as any).data?._faceOriginalSrc || this.beforeSrc;

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
      console.error('[FaceUtilityCommand] Failed to extract image data:', e);
      return;
    }

    try {
      const imageHash = await aiInferenceCache.hashImage(imageData);
      const cacheKey = aiInferenceCache.getCacheKey(imageHash, this.modelId);
      
      let detectionResult = aiInferenceCache.get(cacheKey)?.result;
      
      if (!detectionResult) {
        const { promise, jobId } = ai.execute('face-detection', imageData, { 
          modelId: this.modelId,
          onProgress: (evt: any) => {
            if (this.lastJobId) {
              aiEventBus.emit(this.lastJobId, { state: evt.state, progress: evt.progress });
            }
          }
        }, 5);
        
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
        
        let result;
        try {
          result = await promise;
        } catch (e: any) {
          if (cancelUnsub) cancelUnsub();
          if (this.lastJobId) {
             aiEventBus.emit(this.lastJobId, { state: e.message?.includes('cancelled') ? 'cancelled' : 'failed' });
          }
          console.warn('[FaceUtilityCommand] Inference failed or cancelled:', e);
          return;
        }
        if (cancelUnsub) cancelUnsub();
        
        detectionResult = result.output;
        aiInferenceCache.set(cacheKey, this.modelId, imageHash, detectionResult);
      }

      // Special logic: passport-crop requires background removal
      let finalSourceImageData = imageData;
      if (this.effectId === 'passport-crop') {
        if (this.lastJobId) {
          aiEventBus.emit(this.lastJobId, { state: 'inference', progress: 0 });
        }
        try {
          const bgHash = await aiInferenceCache.hashImage(imageData);
          // We don't strictly know the exact model ID here, so we use a generic 'background-removal' cache key
          const bgCacheKey = aiInferenceCache.getCacheKey(bgHash, 'bg_rm_default');
          let bgResult = aiInferenceCache.get(bgCacheKey)?.result;

          if (!bgResult) {
            // Using default background removal model
            const { promise } = ai.execute('background-removal', imageData, {}, 5);
            const res = await promise;
            bgResult = res.output;
            aiInferenceCache.set(bgCacheKey, 'bg_rm_default', bgHash, bgResult);
          }
          if (bgResult instanceof ImageData) {
            finalSourceImageData = bgResult;
          }
        } catch (e) {
          console.warn('[FaceUtilityCommand] Background removal failed for passport crop, proceeding without it', e);
        }
      }

      // Execute effect on Web Worker
      const workerInstance = aiEngine.effectPool.getAvailableWorker();
      if (!workerInstance) {
        throw new Error('No available workers in effect pool');
      }

      aiEngine.effectPool.setWorkerBusy(workerInstance.id, true);

      if (this.lastJobId) {
        aiEventBus.emit(this.lastJobId, { state: 'post-processing', progress: 0 });
      }

      const safeOptions = { ...this.effectOptions };
      const transferables: Transferable[] = [];
      
      const imageBitmap = await createImageBitmap(finalSourceImageData);
      transferables.push(imageBitmap);

      if (safeOptions.image instanceof HTMLImageElement) {
        safeOptions.image = await createImageBitmap(safeOptions.image);
        transferables.push(safeOptions.image);
      }
      
      if (safeOptions.backgroundImage instanceof HTMLImageElement) {
        safeOptions.backgroundImage = await createImageBitmap(safeOptions.backgroundImage);
        transferables.push(safeOptions.backgroundImage);
      }

      const finalImage = await new Promise<ImageBitmap | ImageData | null>((resolve, reject) => {
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
          sourceImage: imageBitmap,
          faceDetection: detectionResult,
          options: safeOptions
        };

        workerInstance.worker.postMessage(request, transferables);
      });

      // Special case: Batch Crop effect might return null and generate new canvases/artboards instead.
      if (!finalImage) {
        if (this.lastJobId) {
          aiEventBus.emit(this.lastJobId, { state: 'completed', progress: 100 });
        }
        return;
      }

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
        this.afterData = { ...this.beforeData, _faceOriginalSrc: originalSrc };
        try {
          await this.applySrc(canvas, this.afterSrc, updateLayers, this.afterData);
          if (this.lastJobId) {
            aiEventBus.emit(this.lastJobId, { state: 'completed', progress: 100 });
          }
        } catch (applyErr) {
          console.error('[FaceUtilityCommand] Error applying cropped image:', applyErr);
          if (this.lastJobId) {
            aiEventBus.emit(this.lastJobId, { state: 'failed', progress: 0 });
          }
        }
      }
      
    } catch (error) {
      console.error('[FaceUtilityCommand]', error);
      if (this.lastJobId) {
        aiEventBus.emit(this.lastJobId, { state: 'failed', progress: 0 });
      }
    }
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.beforeSrc) {
      this.applySrc(canvas, this.beforeSrc, updateLayers, this.beforeData, this.beforeTransform);
    }
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.afterSrc) {
      this.applySrc(canvas, this.afterSrc, updateLayers, this.afterData, this.afterTransform);
    }
  }
}
