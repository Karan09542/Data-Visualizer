import * as fabric from "fabric";
import { Command } from "../base/Command";
import { ai } from "../../../../ai";
import { AITask, DepthEstimationResult } from "../../../../ai/types";
import { generateId } from "../../../../ai/utils";
import { aiEventBus } from "../../../../ai/events/AIEventBus";

export type DepthMode = 'grayscale' | 'colored' | '3d' | 'portrait-blur' | 'relighting' | 'fog';

export class DepthEstimationCommand implements Command {
  name = 'Depth Estimation';
  private obj: fabric.Image;
  private beforeSrc: string;
  private afterSrc: string | null = null;
  private task: AITask = 'depth-estimation';
  private modelId?: string;
  private depthMode: DepthMode;
  /** How strong the look is, for the effects that have one. */
  private strength: number;
  public lastJobId: string | null = null;

  // Store the depth result for the 3D viewer
  private depthResult: DepthEstimationResult | null = null;
  private originalImageData: ImageData | null = null;

  // Callback for opening 3D viewer (set by the panel)
  public on3DViewReady?: (
    depthResult: DepthEstimationResult,
    originalImage: ImageData,
    sourceObj: fabric.Image,
    canvas: fabric.Canvas,
    updateLayers: () => void
  ) => void;

  constructor(obj: fabric.Image, modelId?: string, depthMode: DepthMode = 'colored', strength: number = 1) {
    this.obj = obj;
    this.modelId = modelId;
    this.depthMode = depthMode;
    this.strength = strength;
    this.beforeSrc = obj.getSrc();
    this.lastJobId = generateId();
  }

  private async applySrc(canvas: fabric.Canvas, src: string, updateLayers: () => void) {
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
      data: { ...((obj as any).data || {}) },
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

    let imageData: ImageData;
    try {
      const src = this.obj.getSrc();
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve) => {
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
      console.error('[DepthEstimationCommand] Failed to extract image data:', e);
      return;
    }

    // Save original image data for 3D viewer
    this.originalImageData = imageData;

    const { jobId, promise } = ai.execute(this.task, imageData, {
      modelId: this.modelId,
      metadata: { depthMode: this.depthMode, effectStrength: this.strength }
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

      const depthResult = result.output as DepthEstimationResult;
      if (!depthResult?.depthMap) return;

      this.depthResult = depthResult;

      if (this.depthMode === '3d') {
        // For 3D mode, open the 3D viewer modal instead of replacing the image
        if (this.on3DViewReady && this.originalImageData) {
          this.on3DViewReady(depthResult, this.originalImageData, this.obj, canvas, updateLayers);
        }
        // Also generate a colored depth map as afterSrc for undo/redo
        const canvasEl = document.createElement('canvas');
        canvasEl.width = depthResult.depthMap.width;
        canvasEl.height = depthResult.depthMap.height;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.putImageData(depthResult.depthMap, 0, 0);
          this.afterSrc = canvasEl.toDataURL();
        }
      } else {
        // For grayscale/colored mode, replace the image with the depth map
        const canvasEl = document.createElement('canvas');
        canvasEl.width = depthResult.depthMap.width;
        canvasEl.height = depthResult.depthMap.height;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.putImageData(depthResult.depthMap, 0, 0);
          this.afterSrc = canvasEl.toDataURL();
          this.applySrc(canvas, this.afterSrc, updateLayers);
        }
      }
    }).catch(e => {
      unsubProgress();
      if (cancelUnsub) cancelUnsub();

      if (e === 'AbortError' || (e as Error)?.message === 'AbortError') {
        console.log(`[DepthEstimationCommand] Task was cancelled.`);
        return;
      }
      console.error(`[DepthEstimationCommand] Task failed:`, e);
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
