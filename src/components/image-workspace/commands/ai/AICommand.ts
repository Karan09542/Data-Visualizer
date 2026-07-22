import * as fabric from "fabric";
import { Command } from "../base/Command";
import { ai } from "../../../../ai";
import { AITask } from "../../../../ai/types";

export abstract class AICommand implements Command {
  name: string;
  protected obj: fabric.Image;
  protected beforeSrc: string;
  protected afterSrc: string | null = null;
  protected task: AITask;
  protected modelId?: string;
  public lastJobId: string | null = null;

  constructor(name: string, obj: fabric.Image, task: AITask, modelId?: string) {
    this.name = name;
    this.obj = obj;
    this.task = task;
    this.modelId = modelId;
    this.beforeSrc = obj.getSrc();
  }

  private async applySrc(canvas: fabric.Canvas, src: string, updateLayers: () => void) {
    const obj = this.obj;
    const oldWidth = obj.width || 1;
    const oldHeight = obj.height || 1;
    const oldScaleX = obj.scaleX || 1;
    const oldScaleY = obj.scaleY || 1;
    
    // Save properties we want to literally preserve
    const savedState = {
      left: obj.left,
      top: obj.top,
      angle: obj.angle,
      opacity: obj.opacity,
      filters: [...(obj.filters || [])],
      clipPath: obj.clipPath,
      data: { ...((obj as any).data || {}) },
      flipX: obj.flipX,
      flipY: obj.flipY,
      skewX: obj.skewX,
      skewY: obj.skewY
    };

    await obj.setSrc(src, { crossOrigin: 'anonymous' } as any);
    
    // Adjust scale to maintain visual size if the image dimensions changed
    const newWidth = obj.width || 1;
    const newHeight = obj.height || 1;
    const scaleX = (oldWidth * oldScaleX) / newWidth;
    const scaleY = (oldHeight * oldScaleY) / newHeight;

    obj.set({
      ...savedState,
      scaleX,
      scaleY
    });
    
    // Re-apply filters and force canvas re-render
    obj.applyFilters();
    
    // Force Fabric to update the cache and bounding boxes
    obj.setCoords();
    obj.dirty = true;
    
    // If it's the active object, rebuild the selection to force controls to update visually
    const activeObject = canvas.getActiveObject();
    if (activeObject === obj) {
      canvas.discardActiveObject();
      canvas.setActiveObject(obj);
    } else if (activeObject) {
      activeObject.setCoords();
    }
    
    canvas.renderAll(); // Use synchronous render to guarantee it happens immediately
    updateLayers();
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
      img.crossOrigin = 'anonymous'; // Prevents tainted canvas if URL is cross-origin
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          // If crossOrigin fails, fallback to object's dataURL which Fabric resolves
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
      console.error('[AICommand] Failed to extract image data:', e);
      return;
    }

    const { jobId, promise } = ai.execute(this.task, imageData, { modelId: this.modelId }, 5);
    this.lastJobId = jobId;
    
    promise.then(result => {
      if (result.output instanceof ImageData) {
        const canvasEl = document.createElement('canvas');
        canvasEl.width = result.output.width;
        canvasEl.height = result.output.height;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.putImageData(result.output, 0, 0);
          this.afterSrc = canvasEl.toDataURL();
          this.applySrc(canvas, this.afterSrc, updateLayers);
        }
      }
    }).catch(e => {
       console.error(`[AICommand] Task ${this.task} failed:`, e);
       alert(`AI Task Failed: ${e.message || e}`);
    });
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applySrc(canvas, this.beforeSrc, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    if (this.afterSrc) {
      this.applySrc(canvas, this.afterSrc, updateLayers);
    }
  }
}
