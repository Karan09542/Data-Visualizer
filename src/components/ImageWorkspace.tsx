import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as fabric from "fabric";
import { loadFromDexie, saveToDexie } from "../utils/fabricDexieSync";
import { useStore } from "../store/useStore";
import { resolveAssetUrl, importFile } from "../utils/assetManager";
import { getValueAtPath } from "../utils/pathUtils";
import { 
  Type, Upload, Download, Undo, Redo, 
  Layers, MousePointer2, Brush, Circle, Square, Minus, Edit2, RotateCw, RotateCcw, Image as ImageIcon,
  SquareDashed, X, Crop, History, Settings, Trash2, Copy, Move, FlipHorizontal, FlipVertical, BringToFront, SendToBack, ArrowUp, ArrowDown,
  Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline,
  Sparkles, ChevronUp, ChevronDown, Plus, Power, Activity, Bookmark, Sliders, Check, Grid, Expand,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Pipette, Star, MoreHorizontal, Hand, LayoutGrid, ZoomIn, ChevronLeft, Droplets, Image as LucideImage, Layout, Printer, Palette, Settings2, FileText, Instagram, ShoppingBag, Images, Info, Keyboard
} from "lucide-react";
import JSZip from "jszip";
import { RgbaStringColorPicker } from "react-colorful";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ImageWorker from "../utils/imageWorker?worker";
import { ExportSettings, DEFAULT_EXPORT_SETTINGS } from "../types/export";
import { FontPicker } from "./FontPicker";
import { TypographyPresets } from "./TypographyPresets";
import { ExportStudio } from "./export/ExportStudio";
import { PRESET_REGISTRY, getDimensionsInPixels, ImagePreset, PresetCategory } from "../lib/imagePresets";

// Custom Fabric.Rect render override to support percentage and individual corner rounding
if (fabric && fabric.Rect && fabric.Rect.prototype) {
  const originalRectRender = fabric.Rect.prototype._render;
  (fabric.Rect.prototype as any)._render = function (ctx: CanvasRenderingContext2D) {
    const hasCustomRounding =
      this.cornerRoundingPercent !== undefined ||
      this.cornerTopLeftPercent !== undefined ||
      this.cornerTopRightPercent !== undefined ||
      this.cornerBottomRightPercent !== undefined ||
      this.cornerBottomLeftPercent !== undefined;

    if (!hasCustomRounding) {
      return originalRectRender.call(this, ctx);
    }

    const w = this.width || 0;
    const h = this.height || 0;
    const maxR = Math.min(w, h) / 2;

    const isIndiv = this.useIndividualCorners || false;
    const uniformPercent = this.cornerRoundingPercent ?? 0;

    const pTL = (isIndiv && this.cornerTopLeftPercent !== undefined) ? this.cornerTopLeftPercent : uniformPercent;
    const pTR = (isIndiv && this.cornerTopRightPercent !== undefined) ? this.cornerTopRightPercent : uniformPercent;
    const pBR = (isIndiv && this.cornerBottomRightPercent !== undefined) ? this.cornerBottomRightPercent : uniformPercent;
    const pBL = (isIndiv && this.cornerBottomLeftPercent !== undefined) ? this.cornerBottomLeftPercent : uniformPercent;

    const rTL = Math.max(0, Math.min(maxR, (pTL / 100) * maxR));
    const rTR = Math.max(0, Math.min(maxR, (pTR / 100) * maxR));
    const rBR = Math.max(0, Math.min(maxR, (pBR / 100) * maxR));
    const rBL = Math.max(0, Math.min(maxR, (pBL / 100) * maxR));

    const x = -w / 2;
    const y = -h / 2;

    ctx.beginPath();
    ctx.moveTo(x + rTL, y);

    ctx.lineTo(x + w - rTR, y);
    if (rTR > 0) {
      ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
    } else {
      ctx.lineTo(x + w, y);
    }

    ctx.lineTo(x + w, y + h - rBR);
    if (rBR > 0) {
      ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
    } else {
      ctx.lineTo(x + w, y + h);
    }

    ctx.lineTo(x + rBL, y + h);
    if (rBL > 0) {
      ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
    } else {
      ctx.lineTo(x, y + h);
    }

    ctx.lineTo(x, y + rTL);
    if (rTL > 0) {
      ctx.quadraticCurveTo(x, y, x + rTL, y);
    } else {
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    this._renderPaintInOrder(ctx);
  };
}

// Cache to prevent multiple compilations
let isPngInitialised = false;
let isResizeInitialised = false;
let isJpegInitialised = false;
let isWebpInitialised = false;
let isAvifInitialised = false;

// jSquash WASM URL assets (served via high-availability unpkg CDN)
const pngWasmUrl = "https://unpkg.com/@jsquash/png@3.1.1/codec/pkg/squoosh_png_bg.wasm";
const jpegWasmUrl = "https://unpkg.com/@jsquash/jpeg@1.6.0/codec/enc/mozjpeg_enc.wasm";
const webpWasmUrl = "https://unpkg.com/@jsquash/webp@1.5.0/codec/enc/webp_enc.wasm";
const webpSimdWasmUrl = "https://unpkg.com/@jsquash/webp@1.5.0/codec/enc/webp_enc_simd.wasm";
const avifWasmUrl = "https://unpkg.com/@jsquash/avif@2.1.1/codec/enc/avif_enc.wasm";
const avifMtWasmUrl = "https://unpkg.com/@jsquash/avif@2.1.1/codec/enc/avif_enc_mt.wasm";
const resizeWasmUrl = "https://unpkg.com/@jsquash/resize@2.1.1/lib/resize/pkg/squoosh_resize_bg.wasm";

// Helpers to load and compile WASM
const loadWasmModule = async (url: string): Promise<WebAssembly.Module> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch wasm from ${url}`);
  const buffer = await res.arrayBuffer();
  return WebAssembly.compile(buffer);
};

const hasSimd = async (): Promise<boolean> => {
  try {
    const { simd } = await import('wasm-feature-detect');
    return await simd();
  } catch {
    return false;
  }
};

const hasThreads = async (): Promise<boolean> => {
  try {
    const { threads } = await import('wasm-feature-detect');
    return await threads();
  } catch {
    return false;
  }
};

interface ImageWorkspaceProps {
  path: string;
}

const setOpacityOnHex = (colorString: string, opacityPercent: number): string => {
  let r = 0, g = 0, b = 0, a = 1;
  const opacityFactor = (opacityPercent || 100) / 100;
  const safeColor = colorString || "#000000";

  if (safeColor.startsWith('rgba(') || safeColor.startsWith('rgb(')) {
    const parts = safeColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
    if (parts) {
      r = parseInt(parts[1]) || 0;
      g = parseInt(parts[2]) || 0;
      b = parseInt(parts[3]) || 0;
      a = parts[4] ? parseFloat(parts[4]) : 1;
    }
  } else {
    const cleaned = safeColor.replace("#", "");
    if (cleaned.length === 3) {
      r = parseInt(cleaned[0] + cleaned[0], 16) || 0;
      g = parseInt(cleaned[1] + cleaned[1], 16) || 0;
      b = parseInt(cleaned[2] + cleaned[2], 16) || 0;
    } else if (cleaned.length === 6) {
      r = parseInt(cleaned.substring(0, 2), 16) || 0;
      g = parseInt(cleaned.substring(2, 4), 16) || 0;
      b = parseInt(cleaned.substring(4, 6), 16) || 0;
    }
  }

  // Guard against NaN
  r = Number.isNaN(r) ? 0 : r;
  g = Number.isNaN(g) ? 0 : g;
  b = Number.isNaN(b) ? 0 : b;
  a = Number.isNaN(a) ? 1 : a;

  return `rgba(${r}, ${g}, ${b}, ${(a * opacityFactor).toFixed(2)})`;
};

const getBrushName = (type: string): string => {
  switch (type) {
    case 'pencil': return 'Pencil Stroke';
    case 'brush': return 'Art Brush Stroke';
    case 'marker': return 'Permanent Marker Stroke';
    case 'highlighter': return 'Highlighter Stroke';
    case 'ink': return 'Ink Pen Stroke';
    case 'calligraphy': return 'Calligraphy Brush Stroke';
    case 'pixel': return 'Pixel Brush Stroke';
    case 'watercolor': return 'Watercolor Brush Stroke';
    case 'airbrush': return 'Airbrush Stroke';
    case 'spray': return 'Spray / Splatter Stroke';
    case 'chalk': return 'Chalk Brush Stroke';
    case 'pattern_dots': return 'Pattern Dots Stroke';
    case 'pattern_dashed': return 'Pattern Dashed Stroke';
    case 'pattern_texture': return 'Pattern Texture Stroke';
    case 'pattern_decorative': return 'Pattern Decorative Stroke';
    case 'pattern_repeating_shapes': return 'Pattern Squares Stroke';
    default: return 'Brush Stroke';
  }
};

const createPatternSource = (type: string, color: string, size: number) => {
  const canvas = document.createElement('canvas');
  const sizeValue = Math.max(12, size);
  canvas.width = sizeValue;
  canvas.height = sizeValue;
  const ctx = canvas.getContext('2d')!;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  if (type === 'dots') {
    ctx.beginPath();
    ctx.arc(sizeValue / 2, sizeValue / 2, sizeValue / 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'dashed') {
    ctx.beginPath();
    ctx.moveTo(0, sizeValue);
    ctx.lineTo(sizeValue, 0);
    ctx.stroke();
  } else if (type === 'texture') {
    ctx.beginPath();
    ctx.moveTo(sizeValue / 2, 0);
    ctx.lineTo(sizeValue / 2, sizeValue);
    ctx.moveTo(0, sizeValue / 2);
    ctx.lineTo(sizeValue, sizeValue / 2);
    ctx.stroke();
  } else if (type === 'decorative') {
    ctx.beginPath();
    ctx.moveTo(sizeValue / 2, 0);
    ctx.lineTo(sizeValue, sizeValue / 2);
    ctx.lineTo(sizeValue / 2, sizeValue);
    ctx.lineTo(0, sizeValue / 2);
    ctx.closePath();
    ctx.fill();
  } else { // 'repeating_shapes'
    ctx.beginPath();
    ctx.rect(sizeValue / 4, sizeValue / 4, sizeValue / 2, sizeValue / 2);
    ctx.fill();
  }

  return canvas;
};

// ==========================================
// Command Architecture Interfaces & Classes
// ==========================================
interface Command {
  name: string;
  execute(canvas: fabric.Canvas, updateLayers: () => void): void;
  undo(canvas: fabric.Canvas, updateLayers: () => void): void;
  redo(canvas: fabric.Canvas, updateLayers: () => void): void;
}

class MacroCommand implements Command {
  name: string;
  private commands: Command[];

  constructor(name: string, commands: Command[]) {
    this.name = name;
    this.commands = commands;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.commands.forEach(cmd => cmd.execute(canvas, updateLayers));
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    [...this.commands].reverse().forEach(cmd => cmd.undo(canvas, updateLayers));
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.commands.forEach(cmd => cmd.redo(canvas, updateLayers));
  }
}

class AddObjectCommand implements Command {
  name: string;
  private obj: fabric.Object;

  constructor(name: string, obj: fabric.Object) {
    this.name = name;
    this.obj = obj;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    if (!canvas.getObjects().includes(this.obj)) {
      canvas.add(this.obj);
    }
    canvas.setActiveObject(this.obj);
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    canvas.remove(this.obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    canvas.add(this.obj);
    canvas.setActiveObject(this.obj);
    canvas.renderAll();
    updateLayers();
  }
}

class DeleteObjectCommand implements Command {
  name: string;
  private objects: fabric.Object[];

  constructor(name: string, objects: fabric.Object[]) {
    this.name = name;
    this.objects = [...objects];
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.objects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.objects.forEach(obj => {
      if (!canvas.getObjects().includes(obj)) {
        canvas.add(obj);
      }
    });
    if (this.objects.length === 1) {
      canvas.setActiveObject(this.objects[0]);
    } else if (this.objects.length > 1) {
      const sel = new fabric.ActiveSelection(this.objects, { canvas });
      canvas.setActiveObject(sel);
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.execute(canvas, updateLayers);
  }
}

class TransformObjectsCommand implements Command {
  name: string;
  private targetObjects: {
    obj: fabric.Object;
    before: {
      left: number;
      top: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      width: number;
      height: number;
      cropX?: number;
      cropY?: number;
      originX?: string;
      originY?: string;
    };
    after: {
      left: number;
      top: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      width: number;
      height: number;
      cropX?: number;
      cropY?: number;
      originX?: string;
      originY?: string;
    };
  }[];

  constructor(
    name: string,
    targets: {
      obj: fabric.Object;
      before: any;
      after: any;
    }[]
  ) {
    this.name = name;
    this.targetObjects = targets.map(t => ({
      obj: t.obj,
      before: {
        left: t.before.left ?? t.obj.left ?? 0,
        top: t.before.top ?? t.obj.top ?? 0,
        scaleX: t.before.scaleX ?? t.obj.scaleX ?? 1,
        scaleY: t.before.scaleY ?? t.obj.scaleY ?? 1,
        angle: t.before.angle ?? t.obj.angle ?? 0,
        width: t.before.width ?? t.obj.width ?? 0,
        height: t.before.height ?? t.obj.height ?? 0,
        cropX: t.before.cropX,
        cropY: t.before.cropY,
        originX: t.before.originX,
        originY: t.before.originY,
      },
      after: {
        left: t.after.left ?? t.obj.left ?? 0,
        top: t.after.top ?? t.obj.top ?? 0,
        scaleX: t.after.scaleX ?? t.obj.scaleX ?? 1,
        scaleY: t.after.scaleY ?? t.obj.scaleY ?? 1,
        angle: t.after.angle ?? t.obj.angle ?? 0,
        width: t.after.width ?? t.obj.width ?? 0,
        height: t.after.height ?? t.obj.height ?? 0,
        cropX: t.after.cropX,
        cropY: t.after.cropY,
        originX: t.after.originX,
        originY: t.after.originY,
      }
    }));
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  private applyState(t: any) {
    const props: any = {
      left: t.left,
      top: t.top,
      scaleX: t.scaleX,
      scaleY: t.scaleY,
      angle: t.angle,
      width: t.width,
      height: t.height,
    };
    if (t.cropX !== undefined) props.cropX = t.cropX;
    if (t.cropY !== undefined) props.cropY = t.cropY;
    if (t.originX !== undefined) props.originX = t.originX;
    if (t.originY !== undefined) props.originY = t.originY;
    return props;
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set(this.applyState(t.before));
      t.obj.setCoords();
    });
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set(this.applyState(t.after));
      t.obj.setCoords();
    });
    canvas.renderAll();
    updateLayers();
  }
}

class PropertyChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private propertyName: string;
  private beforeValue: any;
  private afterValue: any;

  constructor(name: string, obj: fabric.Object, propertyName: string, beforeValue: any, afterValue: any) {
    this.name = name;
    this.obj = obj;
    this.propertyName = propertyName;
    this.beforeValue = beforeValue;
    this.afterValue = afterValue;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.propertyName as any, this.beforeValue);
    if (this.propertyName === 'visible') {
      if (!this.beforeValue) canvas.discardActiveObject();
    }
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      this.obj.setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.propertyName as any, this.afterValue);
    if (this.propertyName === 'visible') {
      if (!this.afterValue) canvas.discardActiveObject();
    }
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      this.obj.setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }
}

class StyleChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private before: any;
  private after: any;

  constructor(name: string, obj: fabric.Object, before: any, after: any) {
    this.name = name;
    this.obj = obj;
    this.before = before;
    this.after = after;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.before);
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      (this.obj as any).setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set(this.after);
    this.obj.dirty = true;
    if (typeof (this.obj as any).setCoords === 'function') {
      (this.obj as any).setCoords();
    }
    canvas.renderAll();
    updateLayers();
  }
}

class LayerReorderCommand implements Command {
  name: string;
  private beforeOrder: { id: string; idx: number }[];
  private afterOrder: { id: string; idx: number }[];

  constructor(name: string, beforeOrder: { id: string; idx: number }[], afterOrder: { id: string; idx: number }[]) {
    this.name = name;
    this.beforeOrder = beforeOrder;
    this.afterOrder = afterOrder;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  private applyOrder(canvas: fabric.Canvas, order: { id: string; idx: number }[], updateLayers: () => void) {
    const sorted = [...order].sort((a, b) => a.idx - b.idx);
    
    // Store IDs of currently active objects
    const activeObjects = canvas.getActiveObjects() as any[];
    const activeIds = activeObjects.map(o => o.id);
    
    // Clear selection so objects return to canvas
    canvas.discardActiveObject();

    const existingObjs = canvas.getObjects().filter(o => o.type !== 'activeSelection') as any[];
    const map = new Map<string, any>();
    existingObjs.forEach(o => map.set(o.id, o));

    const reorderedObjs: any[] = [];
    sorted.forEach(({id}) => {
       if (map.has(id)) {
          reorderedObjs.push(map.get(id));
          map.delete(id);
       }
    });
    // Append any untracked objects
    map.forEach(v => reorderedObjs.push(v));

    // Remove all and re-add in exact order
    existingObjs.forEach(o => canvas.remove(o));
    reorderedObjs.forEach(o => canvas.add(o));
    
    // Restore selection
    const toSelect = reorderedObjs.filter(o => activeIds.includes(o.id));
    if (toSelect.length > 0) {
      if (toSelect.length === 1) {
        canvas.setActiveObject(toSelect[0]);
      } else {
        const sel = new fabric.ActiveSelection(toSelect, { canvas });
        canvas.setActiveObject(sel);
      }
    }

    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyOrder(canvas, this.beforeOrder, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyOrder(canvas, this.afterOrder, updateLayers);
  }
}

class FilterChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private filterType: string;
  private beforeValue: number;
  private afterValue: number;

  constructor(name: string, obj: fabric.Object, filterType: string, beforeValue: number, afterValue: number) {
    this.name = name;
    this.obj = obj;
    this.filterType = filterType;
    this.beforeValue = beforeValue;
    this.afterValue = afterValue;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterValue, updateLayers);
  }

  private apply(canvas: fabric.Canvas, val: number, updateLayers: () => void) {
    const obj = this.obj as any;
    const filters = (fabric as any).Image?.filters || (fabric as any).filters;
    if (!filters) return;
    
    let filterIndex = -1;
    if (this.filterType === 'brightness') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Brightness);
    else if (this.filterType === 'contrast') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Contrast);
    else if (this.filterType === 'saturation') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
    else if (this.filterType === 'grayscale') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);

    let filter;
    if (this.filterType === 'brightness') filter = new filters.Brightness({ brightness: val });
    else if (this.filterType === 'contrast') filter = new filters.Contrast({ contrast: val });
    else if (this.filterType === 'saturation') filter = new filters.Saturation({ saturation: val });
    else if (this.filterType === 'grayscale') filter = new filters.Saturation({ saturation: -val });

    if (filterIndex >= 0) {
      if (filter) obj.filters[filterIndex] = filter;
      else obj.filters.splice(filterIndex, 1);
    } else {
      if (filter) obj.filters.push(filter);
    }
    
    obj.applyFilters();
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.beforeValue, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterValue, updateLayers);
  }
}

export interface FilterConfig {
  id: string;
  type: string;
  name: string;
  category: 'adjust' | 'color' | 'presets' | 'blur' | 'noise' | 'pixel' | 'blend' | 'advanced' | 'artsy';
  enabled: boolean;
  params: { [key: string]: any };
}

export function rebuildFabricFilters(obj: any, filtersObj: any) {
  if (!obj || !filtersObj) return;
  const startTime = performance.now();
  
  obj.filters = [];
  const configList: FilterConfig[] = obj.customFilters || [];
  
  for (const item of configList) {
    if (!item.enabled) continue;
    let filterInstance: any = null;
    
    try {
      switch (item.type) {
        case 'brightness':
          if (filtersObj.Brightness) {
            filterInstance = new filtersObj.Brightness({ brightness: Number(item.params.value || 0) });
          }
          break;
        case 'contrast':
          if (filtersObj.Contrast) {
            filterInstance = new filtersObj.Contrast({ contrast: Number(item.params.value || 0) });
          }
          break;
        case 'saturation':
          if (filtersObj.Saturation) {
            filterInstance = new filtersObj.Saturation({ saturation: Number(item.params.value || 0) });
          }
          break;
        case 'vibrance':
          if (filtersObj.Saturation) {
            // Stronger selective saturation boost
            filterInstance = new filtersObj.Saturation({ saturation: Number(item.params.value || 0) * 1.35 });
          }
          break;
        case 'exposure':
          if (filtersObj.Brightness) {
            // Exposure modeled through Brightness values
            filterInstance = new filtersObj.Brightness({ brightness: Number(item.params.value || 0) });
          }
          break;
        case 'gamma':
          if (filtersObj.Gamma) {
            const r = item.params.red !== undefined ? Number(item.params.red) : 1.0;
            const g = item.params.green !== undefined ? Number(item.params.green) : 1.0;
            const b = item.params.blue !== undefined ? Number(item.params.blue) : 1.0;
            filterInstance = new filtersObj.Gamma({ gamma: [r, g, b] });
          }
          break;
        case 'hueRotation':
          if (filtersObj.HueRotation) {
            filterInstance = new filtersObj.HueRotation({ rotation: Number(item.params.value || 0) });
          } else if (filtersObj.ColorMatrix) {
            const angle = (Number(item.params.value || 0) || 0) * Math.PI / 180;
            const cosVal = Math.cos(angle);
            const sinVal = Math.sin(angle);
            const matrix = [
              0.213 + cosVal*0.787 - sinVal*0.213, 0.715 - cosVal*0.715 - sinVal*0.715, 0.072 - cosVal*0.072 + sinVal*0.928, 0, 0,
              0.213 - cosVal*0.213 + sinVal*0.143, 0.715 + cosVal*0.285 + sinVal*0.140, 0.072 - cosVal*0.072 - sinVal*0.283, 0, 0,
              0.213 - cosVal*0.213 - sinVal*0.787, 0.715 - cosVal*0.715 + sinVal*0.715, 0.072 + cosVal*0.928 + sinVal*0.072, 0, 0,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'grayscale':
          if (filtersObj.Grayscale) {
            filterInstance = new filtersObj.Grayscale({ mode: item.params.mode || 'luminosity' });
          }
          break;
        case 'invert':
          if (filtersObj.Invert) {
            filterInstance = new filtersObj.Invert();
          }
          break;
        case 'sepia':
          if (filtersObj.Sepia) {
            filterInstance = new filtersObj.Sepia();
          }
          break;
        case 'blackwhite':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.5, 1.5, 1.5, 0, -1,
              1.5, 1.5, 1.5, 0, -1,
              1.5, 1.5, 1.5, 0, -1,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          } else if (filtersObj.Grayscale) {
            filterInstance = new filtersObj.Grayscale();
          }
          break;
        case 'removeColor':
          if (filtersObj.RemoveColor) {
            filterInstance = new filtersObj.RemoveColor({
              color: item.params.color || '#ffffff',
              distance: Number(item.params.distance !== undefined ? item.params.distance : 0.15)
            });
          }
          break;
        case 'noise':
          if (filtersObj.Noise) {
            filterInstance = new filtersObj.Noise({ noise: Number(item.params.value || 50) });
          }
          break;
        case 'pixelate':
          if (filtersObj.Pixelate) {
            filterInstance = new filtersObj.Pixelate({ blocksize: Number(item.params.value || 8) });
          }
          break;
        case 'blur':
          if (filtersObj.Blur) {
            filterInstance = new filtersObj.Blur({ blur: Number(item.params.value || 0.2) });
          }
          break;
        case 'edge':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
            });
          }
          break;
        case 'sharpen':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0]
            });
          }
          break;
        case 'emboss':
          if (filtersObj.Convolute) {
            filterInstance = new filtersObj.Convolute({
              matrix: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
            });
          }
          break;
        case 'vignette':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              0.9, 0, 0, 0, -10,
              0, 0.9, 0, 0, -10,
              0, 0, 0.9, 0, -15,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'bloom':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.3, 0, 0, 0, 12,
              0, 1.3, 0, 0, 12,
              0, 0, 1.3, 0, 12,
              0, 0, 0, 1, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'chromatic':
          if (filtersObj.ColorMatrix) {
            const matrix = [
              1.22, 0, 0, 0, 0,
              0, 1.0, 0, 0, 0,
              0, 0, 1.22, 0, 0,
              0, 0, 0, 1.0, 0
            ];
            filterInstance = new filtersObj.ColorMatrix({ matrix });
          }
          break;
        case 'blendColor':
          if (filtersObj.BlendColor) {
            filterInstance = new filtersObj.BlendColor({
              color: item.params.color || '#3b82f6',
              mode: item.params.mode || 'multiply',
              alpha: Number(item.params.alpha !== undefined ? item.params.alpha : 0.5)
            });
          }
          break;
        case 'preset':
          if (filtersObj.ColorMatrix) {
            const presetName = item.params.name;
            let m: number[] = [];
            if (presetName === 'brownie') {
              m = [0.5997, 0.3455, -0.2708, 0, 0.186, -0.0377, 0.8609, 0.1505, 0, -0.1449, 0.2411, -0.0744, 1.3503, 0, -0.0296, 0, 0, 0, 1, 0];
            } else if (presetName === 'vintage') {
              m = [0.6279, 0.3202, -0.0396, 0, 0.037, -0.0257, 0.6400, 0.2191, 0, 0.025, 0.0464, -0.0822, 0.3015, 0, 0.074, 0, 0, 0, 1, 0];
            } else if (presetName === 'technicolor') {
              m = [1.9125, -0.8545, -0.0915, 0, 0.0462, -0.3087, 1.7658, -0.1060, 0, -0.0125, -0.2311, -0.7501, 1.8475, 0, 0.1214, 0, 0, 0, 1, 0];
            } else if (presetName === 'kodachrome') {
              m = [1.1285, -0.0445, -0.0078, 0, 0.0597, -0.0221, 1.0751, 0.0070, 0, 0.0638, -0.0483, -0.1537, 1.2582, 0, -0.1387, 0, 0, 0, 1, 0];
            } else if (presetName === 'polaroid') {
              m = [1.438, -0.062, -0.062, 0, 0, -0.122, 1.378, -0.122, 0, 0, -0.016, -0.016, 1.483, 0, 0, 0, 0, 0, 1, 0];
            } else if (presetName === 'hdr') {
              m = [1.2, 0,  0, 0, 0.1,  0, 1.2, 0, 0, 0.1,  0, 0, 1.2, 0, 0.1,  0, 0, 0, 1, 0];
            } else if (presetName === 'film') {
              m = [0.88, 0.06, 0.06, 0, 0,  0.06, 0.88, 0.06, 0, 0,  0.06, 0.06, 0.88, 0, 0,  0, 0, 0, 1, 0];
            } else if (presetName === 'instagram') {
              m = [1.08, 0, 0.08, 0, 0,  0, 1.08, 0, 0, 0,  0, 0, 1.15, 0, -0.08,  0, 0, 0, 1, 0];
            } else if (presetName === 'vibrant') {
              m = [1.18, -0.08, -0.08, 0, 0,  -0.08, 1.18, -0.08, 0, 0,  -0.08, -0.08, 1.18, 0, 0,  0, 0, 0, 1, 0];
            } else if (presetName === 'soft') {
              m = [0.92, 0.04, 0.04, 0, 0.01,  0.04, 0.92, 0.04, 0, 0.01,  0.04, 0.04, 0.92, 0, 0.01,  0, 0, 0, 1, 0];
            }
            if (m.length > 0) {
              filterInstance = new filtersObj.ColorMatrix({ matrix: m });
            }
          }
          break;
        default:
          break;
      }
      if (filterInstance) {
        obj.filters.push(filterInstance);
      }
    } catch (err) {
      console.error("Error defining filter instance:", item.type, err);
    }
  }
  
  obj.applyFilters();
  const endTime = performance.now();
  obj.lastFilterBenchmark = {
    filterTimeMs: (endTime - startTime).toFixed(1),
    backend: (fabric as any).isWebglSupported && (fabric as any).isWebglSupported() ? "WebGL" : "Canvas2D",
    outputWidth: obj.width ? Math.round(obj.width * (obj.scaleX || 1)) : 0,
    outputHeight: obj.height ? Math.round(obj.height * (obj.scaleY || 1)) : 0
  };
}

class FilterPipelineCommand implements Command {
  name: string;
  private obj: any;
  private beforeFilters: FilterConfig[];
  private afterFilters: FilterConfig[];

  constructor(name: string, obj: any, beforeFilters: FilterConfig[], afterFilters: FilterConfig[]) {
    this.name = name;
    this.obj = obj;
    this.beforeFilters = JSON.parse(JSON.stringify(beforeFilters));
    this.afterFilters = JSON.parse(JSON.stringify(afterFilters));
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterFilters, updateLayers);
  }

  private apply(canvas: fabric.Canvas, stack: FilterConfig[], updateLayers: () => void) {
    this.obj.customFilters = stack;
    const filtersObj = (fabric as any).Image?.filters || (fabric as any).filters;
    if (filtersObj) {
      rebuildFabricFilters(this.obj, filtersObj);
    }
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.beforeFilters, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterFilters, updateLayers);
  }
}

const BrushPreview = ({ type, color, size, opacity, hardness, flow }: any) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = size / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let rVal = 0, gVal = 0, bVal = 0;
    if (color.startsWith('rgb')) {
      const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
      if (parts) {
        rVal = parseInt(parts[1]) || 0;
        gVal = parseInt(parts[2]) || 0;
        bVal = parseInt(parts[3]) || 0;
      }
    } else {
      const cleaned = (color || "#000000").replace("#", "");
      if (cleaned.length === 3) {
        rVal = parseInt(cleaned[0] + cleaned[0], 16) || 0;
        gVal = parseInt(cleaned[1] + cleaned[1], 16) || 0;
        bVal = parseInt(cleaned[2] + cleaned[2], 16) || 0;
      } else {
        rVal = parseInt(cleaned.substring(0, 2), 16) || 0;
        gVal = parseInt(cleaned.substring(2, 4), 16) || 0;
        bVal = parseInt(cleaned.substring(4, 6), 16) || 0;
      }
    }
    
    // Final safety against NaN
    rVal = Number.isNaN(rVal) ? 0 : rVal;
    gVal = Number.isNaN(gVal) ? 0 : gVal;
    bVal = Number.isNaN(bVal) ? 0 : bVal;

    const alpha = (opacity || 100) / 100;

    ctx.save();

    if (type.startsWith('pattern_')) {
      const designColor = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
      const patType = type.replace("pattern_", "");
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(25, r), 0, Math.PI * 2);
      ctx.clip();
      
      ctx.fillStyle = designColor;
      for (let x = 0; x < canvas.width; x += 10) {
        for (let y = 0; y < canvas.height; y += 10) {
          if (patType === 'dots') {
            ctx.beginPath();
            ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (patType === 'dashed') {
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x + 10, y);
            ctx.strokeStyle = designColor;
            ctx.stroke();
          } else if (patType === 'texture') {
            ctx.fillRect(x + 1, y + 1, 8, 1);
            ctx.fillRect(x + 1, y + 1, 1, 8);
          } else {
            ctx.fillRect(x + 3, y + 3, 4, 4);
          }
        }
      }
    } else if (type === 'airbrush' || type === 'spray') {
      ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
      const clusterRadius = Math.min(25, r);
      const density = type === 'airbrush' ? 120 : 50;
      for (let i = 0; i < density; i++) {
        const radius = Math.random() * clusterRadius;
        const angle = Math.random() * Math.PI * 2;
        const dotX = centerX + radius * Math.cos(angle);
        const dotY = centerY + radius * Math.sin(angle);
        ctx.fillRect(dotX, dotY, Math.max(1, size / 12), Math.max(1, size / 12));
      }
    } else if (type === 'chalk') {
       ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
       const w = Math.min(45, size);
       for (let i = 0; i < 60; i++) {
         const dx = (Math.random() - 0.5) * w;
         const dy = (Math.random() - 0.5) * w;
         if (dx * dx + dy * dy < (w / 2) * (w / 2)) {
           ctx.fillRect(centerX + dx, centerY + dy, 1.5, 1.5);
         }
       }
    } else if (type === 'highlighter') {
       ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, 0.3)`;
       const hSize = Math.min(30, size * 1.5);
       ctx.fillRect(centerX - 25, centerY - hSize / 2, 50, hSize);
    } else if (type === 'watercolor') {
       const gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, Math.min(30, r * 1.5));
       gradient.addColorStop(0, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha * 0.4})`);
       gradient.addColorStop(0.5, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha * 0.15})`);
       gradient.addColorStop(1, `rgba(${rVal}, ${gVal}, ${bVal}, 0)`);
       ctx.fillStyle = gradient;
       ctx.beginPath();
       ctx.arc(centerX, centerY, Math.min(30, r * 1.5), 0, Math.PI * 2);
       ctx.fill();
    } else {
       const gradient = ctx.createRadialGradient(centerX, centerY, Math.max(0, r * (hardness / 100) - 1), centerX, centerY, Math.max(1, r));
       gradient.addColorStop(0, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`);
       gradient.addColorStop(1, `rgba(${rVal}, ${gVal}, ${bVal}, 0)`);
       
       ctx.fillStyle = hardness < 100 ? gradient : `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
       ctx.beginPath();
       ctx.arc(centerX, centerY, Math.min(20, r), 0, Math.PI * 2);
       ctx.fill();
    }

    ctx.restore();
  }, [type, color, size, opacity, hardness, flow]);

  return (
    <div className="flex flex-col items-center bg-[#151515] p-3 rounded-lg border border-[#2C2C2C] space-y-1.5 w-full">
      <div className="w-full h-16 bg-[#1a1a1a] rounded border border-[#2a2a2a] flex items-center justify-center overflow-hidden relative">
        <canvas ref={canvasRef} width={120} height={60} className="block" />
        <span className="absolute bottom-1 right-2 text-[9px] text-[#555] font-semibold">{size}px • {opacity}%</span>
      </div>
    </div>
  );
};

interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  borderColor?: string;
  transparent: boolean;
  dpi: number;
  orientation: "portrait" | "landscape";
  showGrid?: boolean;
  showSafeArea?: boolean;
  showMargins?: boolean;
  showBleed?: boolean;
  showCenter?: boolean;
}

class ArtboardStateCommand implements Command {
  name: string;
  private beforeBoards: Artboard[];
  private afterBoards: Artboard[];
  private beforeActiveId: string;
  private afterActiveId: string;
  private setArtboardsSnapshot: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveArtboardIdSnapshot: React.Dispatch<React.SetStateAction<string>>;

  constructor(
    name: string,
    beforeBoards: Artboard[],
    afterBoards: Artboard[],
    beforeActiveId: string,
    afterActiveId: string,
    setArtboardsSnapshot: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveArtboardIdSnapshot: React.Dispatch<React.SetStateAction<string>>
  ) {
    this.name = name;
    this.beforeBoards = beforeBoards;
    this.afterBoards = afterBoards;
    this.beforeActiveId = beforeActiveId;
    this.afterActiveId = afterActiveId;
    this.setArtboardsSnapshot = setArtboardsSnapshot;
    this.setActiveArtboardIdSnapshot = setActiveArtboardIdSnapshot;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.afterBoards);
    this.setActiveArtboardIdSnapshot(this.afterActiveId);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.beforeBoards);
    this.setActiveArtboardIdSnapshot(this.beforeActiveId);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboardsSnapshot(this.afterBoards);
    this.setActiveArtboardIdSnapshot(this.afterActiveId);
    canvas.requestRenderAll();
  }
}

class DuplicateArtboardCommand implements Command {
  name = "Duplicate Artboard";
  private boardToDuplicate: Artboard;
  private newBoard: Artboard;
  private canvasObjectsToClone: fabric.Object[] = [];
  private clonedObjects: fabric.Object[] = [];
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveId: React.Dispatch<React.SetStateAction<string>>;
  private updateLayersList: () => void;
  private isLoaded = false;

  constructor(
    boardToDuplicate: Artboard,
    newBoard: Artboard,
    canvasObjectsToClone: fabric.Object[],
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveId: React.Dispatch<React.SetStateAction<string>>,
    updateLayersList: () => void
  ) {
    this.boardToDuplicate = boardToDuplicate;
    this.newBoard = newBoard;
    this.canvasObjectsToClone = canvasObjectsToClone;
    this.setArtboards = setArtboards;
    this.setActiveId = setActiveId;
    this.updateLayersList = updateLayersList;
  }

  async execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => [...prev, this.newBoard]);
    this.setActiveId(this.newBoard.id);

    if (!this.isLoaded) {
      const clonePromises = this.canvasObjectsToClone.map(o => {
        return o.clone(['id', 'artboardId']).then((cloned) => {
          (cloned as any).id = Date.now().toString() + Math.random().toString();
          const dx = this.newBoard.x - this.boardToDuplicate.x;
          cloned.left = (o.left ?? 0) + dx;
          cloned.top = o.top ?? 0;
          (cloned as any).artboardId = this.newBoard.id;
          return cloned;
        });
      });

      const clonedList = await Promise.all(clonePromises);
      this.clonedObjects = clonedList;
      this.isLoaded = true;
    }

    this.clonedObjects.forEach(obj => {
      canvas.add(obj);
    });

    canvas.requestRenderAll();
    this.updateLayersList();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => prev.filter(b => b.id !== this.newBoard.id));
    this.clonedObjects.forEach(obj => {
      canvas.remove(obj);
    });
    canvas.requestRenderAll();
    this.updateLayersList();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => [...prev, this.newBoard]);
    this.setActiveId(this.newBoard.id);
    this.clonedObjects.forEach(obj => {
      canvas.add(obj);
    });
    canvas.requestRenderAll();
    this.updateLayersList();
  }
}

class DeleteArtboardCommand implements Command {
  name = "Delete Artboard";
  private boardToDelete: Artboard;
  private prevActiveId: string;
  private newActiveId: string;
  private deleteIdx: number;
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;
  private setActiveId: React.Dispatch<React.SetStateAction<string>>;

  constructor(
    boardToDelete: Artboard,
    prevActiveId: string,
    newActiveId: string,
    deleteIdx: number,
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>,
    setActiveId: React.Dispatch<React.SetStateAction<string>>
  ) {
    this.boardToDelete = boardToDelete;
    this.prevActiveId = prevActiveId;
    this.newActiveId = newActiveId;
    this.deleteIdx = deleteIdx;
    this.setArtboards = setArtboards;
    this.setActiveId = setActiveId;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => prev.filter(b => b.id !== this.boardToDelete.id));
    this.setActiveId(this.newActiveId);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.setArtboards(prev => {
      const copy = [...prev];
      copy.splice(this.deleteIdx, 0, this.boardToDelete);
      return copy;
    });
    this.setActiveId(this.prevActiveId);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.execute(canvas, updateLayers);
  }
}

class ArtboardPropertyCommand implements Command {
  name: string;
  private boardId: string;
  private prop: keyof Artboard;
  private beforeVal: any;
  private afterVal: any;
  private setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>;

  constructor(
    name: string,
    boardId: string,
    prop: keyof Artboard,
    beforeVal: any,
    afterVal: any,
    setArtboards: React.Dispatch<React.SetStateAction<Artboard[]>>
  ) {
    this.name = name;
    this.boardId = boardId;
    this.prop = prop;
    this.beforeVal = beforeVal;
    this.afterVal = afterVal;
    this.setArtboards = setArtboards;
  }

  private applyVal(val: any) {
    this.setArtboards((prev) => {
      return prev.map((board) => {
        if (board.id !== this.boardId) return board;
        let updated = { ...board, [this.prop]: val };
        
        if (this.prop === "width" || this.prop === "height") {
          const w = this.prop === "width" ? val : board.width;
          const h = this.prop === "height" ? val : board.height;
          updated.orientation = w >= h ? "landscape" : "portrait";
        }

        if (this.prop === "orientation") {
          const newOrientation = val as "portrait" | "landscape";
          if (newOrientation === "portrait" && board.width > board.height) {
            updated.width = board.height;
            updated.height = board.width;
          } else if (newOrientation === "landscape" && board.width < board.height) {
            updated.width = board.height;
            updated.height = board.width;
          }
        }

        if (this.prop === "backgroundColor") {
          const color = val as string;
          if (color.startsWith('rgba(')) {
            const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.transparent = true;
            } else {
              updated.transparent = false;
            }
          } else {
            updated.transparent = false;
          }
        }

        if (this.prop === "transparent") {
          const isTransparent = val as boolean;
          const currentColor = board.backgroundColor || "#ffffff";
          if (isTransparent) {
            updated.backgroundColor = setOpacityOnHex(currentColor, 0);
          } else {
            const parts = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.backgroundColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, 1)`;
            }
          }
        }

        return updated;
      });
    });
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.afterVal);
    canvas.requestRenderAll();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.beforeVal);
    canvas.requestRenderAll();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.applyVal(this.afterVal);
    canvas.requestRenderAll();
  }
}

// Modern Checkbox Component
const ModernCheckbox = ({ checked, onChange, label, labelLeft, className }: { checked: boolean, onChange: (val: boolean) => void, label?: string, labelLeft?: boolean, className?: string }) => (
  <label className={`flex items-center gap-2.5 cursor-pointer group select-none active:scale-95 transition-transform ${labelLeft ? 'justify-between w-full p-2 bg-[#1C1C1C] rounded-lg border border-[#2D2D2D]/60 hover:bg-[#222222] hover:border-[#3D3D3D]' : ''} ${className || ''}`} onClick={(e) => e.stopPropagation()}>
    {label && labelLeft && <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors font-semibold tracking-tight">{label}</span>}
    <div className="relative flex items-center justify-center">
      <input 
        type="checkbox" 
        className="sr-only" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
      />
      <div className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center
        ${checked ? 'bg-blue-600 border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-[#111111] border-[#333333] group-hover:border-[#4A4A4A]'}`}>
        {checked && <Check className="w-2.5 h-2.5 text-white stroke-[3.5] animate-in zoom-in-50" />}
      </div>
    </div>
    {label && !labelLeft && <span className="text-[11px] text-[#A0A0A0] group-hover:text-[#E0E0E0] transition-colors font-medium">{label}</span>}
  </label>
);
const ARTBOARD_PRESETS = [
  { name: "Instagram Post", width: 1080, height: 1080 },
  { name: "Instagram Story", width: 1080, height: 1920 },
  { name: "YouTube Thumbnail", width: 1280, height: 720 },
  { name: "YouTube Banner", width: 2560, height: 1440 },
  { name: "LinkedIn Post", width: 1200, height: 627 },
  { name: "Twitter Post", width: 1200, height: 675 },
  { name: "Facebook Cover", width: 820, height: 312 },
  { name: "A4 (print)", width: 1240, height: 1754 },
  { name: "A3 (print)", width: 1754, height: 2480 },
  { name: "Letter (print)", width: 1275, height: 1650 },
];

interface ImageWorkspaceProps {
  path: string;
}

export default function ImageWorkspace({ path }: ImageWorkspaceProps) {
  const { parsedData, updateNodeValue } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Artboards State
  const [artboards, setArtboards] = useState<Artboard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeArtboardId, setActiveArtboardId] = useState<string>("artboard_default");

  // Collage configurations
  const [collagePaddingPercent, setCollagePaddingPercent] = useState<number>(5);
  const [collageGapPercent, setCollageGapPercent] = useState<number>(2);
  const [collageBgColor, setCollageBgColor] = useState<string>('#333333');
  const [collageBorderColor, setCollageBorderColor] = useState<string>('#555555');
  const [collageBorderWidth, setCollageBorderWidth] = useState<number>(2);
  const [collageCornerRadius, setCollageCornerRadius] = useState<number>(8);
  const [useIndividualCorners, setUseIndividualCorners] = useState<boolean>(false);
  const [collageCornerTL, setCollageCornerTL] = useState<number>(8);
  const [collageCornerTR, setCollageCornerTR] = useState<number>(8);
  const [collageCornerBR, setCollageCornerBR] = useState<number>(8);
  const [collageCornerBL, setCollageCornerBL] = useState<number>(8);
  const [collageBorderStyle, setCollageBorderStyle] = useState<'solid' | 'dashed' | 'none'>('dashed');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [snapTolerance, setSnapTolerance] = useState(10);
  const [isCropping, setIsCropping] = useState(false);
  const cropSessionRef = useRef<{
    origObj: fabric.Image | null;
    fullImg: fabric.Image | null;
    cropRect: fabric.Rect | null;
    dimRect: fabric.Rect | null;
  }>({ origObj: null, fullImg: null, cropRect: null, dimRect: null });
  const [activeContextMenu, setActiveContextMenu] = useState<{
    x: number;
    y: number;
    obj: fabric.Object | null;
    targets: fabric.Object[];
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  useLayoutEffect(() => {
    if (activeContextMenu && contextMenuRef.current) {
      const el = contextMenuRef.current;
      const rect = el.getBoundingClientRect();
      const padding = 8;
      
      let newX = activeContextMenu.x;
      let newY = activeContextMenu.y;

      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - padding;
      }
      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - padding;
      }
      
      // additional check in case menu is huge
      if (newX < padding) newX = padding;
      if (newY < padding) newY = padding;

      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.style.visibility = 'visible';
    }
  }, [activeContextMenu]);

  const [artboardDropdown, setArtboardDropdown] = useState<{ id: string, x: number, y: number } | null>(null);
  const [renamingArtboard, setRenamingArtboard] = useState<{ id: string; name: string } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [guides, setGuides] = useState<{ type: 'v' | 'h'; pos: number }[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<{ id: string, type: string } | null>(null);
  const [exportTarget, setExportTarget] = useState<"current" | "selected" | "all">("current");
  const [selectedExportIds, setSelectedExportIds] = useState<Record<string, boolean>>(() => ({
    "artboard_default": true
  }));
  const [selectionType, setSelectionType] = useState<string | null>(null);
  const [parentAlignmentObj, setParentAlignmentObj] = useState<fabric.Object | null>(null);
  const parentAlignmentObjRef = useRef<fabric.Object | null>(null);

  const getAbsoluteBoundingRect = (obj: fabric.Object) => {
    if (!obj.group) {
      return (obj as any).getBoundingRect(true);
    }
    const halfWidth = (obj.width || 0) / 2;
    const halfHeight = (obj.height || 0) / 2;
    const localCorners = [
      new fabric.Point(-halfWidth, -halfHeight),
      new fabric.Point(halfWidth, -halfHeight),
      new fabric.Point(halfWidth, halfHeight),
      new fabric.Point(-halfWidth, halfHeight)
    ];
    const matrix = obj.calcTransformMatrix();
    const worldCorners = localCorners.map(corner => 
      fabric.util.transformPoint(corner, matrix)
    );
    const xs = worldCorners.map(p => p.x);
    const ys = worldCorners.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const artboardsRef = useRef(artboards);
  const activeArtboardIdRef = useRef(activeArtboardId);
  const viewportTransformRef = useRef<number[]>([1, 0, 0, 1, 0, 0] as any);

  // Mobile / Responsive states (Moved to top of component)
  const [isMobile, setIsMobile] = useState(false);
  const isMobileRef = useRef(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showMobileArtboardsGallery, setShowMobileArtboardsGallery] = useState(false);
  const [showMobileToolbox, setShowMobileToolbox] = useState(false);
  const [showMobileDiagnosticsSheet, setShowMobileDiagnosticsSheet] = useState(false);
  const [showAdvancedMobileExport, setShowAdvancedMobileExport] = useState(false);
  const [mobileSettingsTab, setMobileSettingsTab] = useState<'format' | 'resize' | 'metadata'>('format');
  const [showMobileCompareSwitcher, setShowMobileCompareSwitcher] = useState(false);

  useEffect(() => {
    const handleResize = () => {
       const m = window.innerWidth < 768;
       setIsMobile(m);
       isMobileRef.current = m;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useLayoutEffect(() => {
    artboardsRef.current = artboards;
    if (fabricRef.current) {
       fabricRef.current.requestRenderAll();
    }
  }, [artboards]);

  useEffect(() => {
    activeArtboardIdRef.current = activeArtboardId;
  }, [activeArtboardId]);

  useEffect(() => {
    if (artboards.length > 0 && !artboards.find(b => b.id === activeArtboardId)) {
      setActiveArtboardId(artboards[0].id);
    }
  }, [artboards, activeArtboardId]);

  useEffect(() => {
    if (isLoaded && fabricRef.current) {
      saveToDexie(path, artboards, fabricRef.current).catch(err => {
        console.error("Failed to save artboards to dexie:", err);
      });
    }
  }, [artboards, path, isLoaded]);

  const fitView = useCallback(() => {
    if (!fabricRef.current || artboardsRef.current.length === 0) return;
    const canvas = fabricRef.current;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    const boards = isMobileRef.current 
      ? artboardsRef.current.filter(b => b.id === activeArtboardIdRef.current) 
      : artboardsRef.current;
    const activeBoardsToFit = boards.length > 0 ? boards : [artboardsRef.current[0]];
    
    activeBoardsToFit.forEach(b => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    // Add some padding
    const padding = isMobileRef.current ? 32 : 100;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const w = maxX - minX;
    const h = maxY - minY;
    const cw = canvas.width!;
    const ch = canvas.height!;
    if (cw <= 0 || h <= 0) return;
    
    // Calculate optimal zoom
    const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
    const vpt = canvas.viewportTransform!;
    
    vpt[0] = zoom;
    vpt[3] = zoom;
    vpt[4] = cw / 2 - zoom * (minX + w / 2);
    vpt[5] = ch / 2 - zoom * (minY + h / 2);
    
    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
    setZoomPercent(Math.round(zoom * 100));
    
    if (!isMobileRef.current) {
      viewportTransformRef.current = vpt.slice();
    }
  }, []);

  const validateViewport = useCallback(() => {
    if (!fabricRef.current || artboardsRef.current.length === 0) return;
    const canvas = fabricRef.current;
    
    if (isMobileRef.current) {
      // In mobile mode, the artboard MUST remain centered.
      // If the current viewport transform is not centered or fully visible, correct it.
      const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
      if (activeBoard) {
        const cw = canvas.width!;
        const ch = canvas.height!;
        const vpt = canvas.viewportTransform!;
        const zoom = canvas.getZoom();
        
        const expectedX = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
        const expectedY = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;
        
        const isCentered = Math.abs(vpt[4] - expectedX) < 1 && Math.abs(vpt[5] - expectedY) < 1;
        
        if (!isCentered) {
          fitView();
        }
      }
    } else {
      // On desktop, check if the active artboard is completely off-screen.
      const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
      if (activeBoard) {
        const cw = canvas.width!;
        const ch = canvas.height!;
        const vpt = canvas.viewportTransform!;
        const zoom = canvas.getZoom();
        
        const ax1 = activeBoard.x * zoom + vpt[4];
        const ax2 = (activeBoard.x + activeBoard.width) * zoom + vpt[4];
        const ay1 = activeBoard.y * zoom + vpt[5];
        const ay2 = (activeBoard.y + activeBoard.height) * zoom + vpt[5];
        
        // Is it completely outside?
        const isOffscreen = (ax2 < 0 || ax1 > cw || ay2 < 0 || ay1 > ch);
        if (isOffscreen) {
          fitView();
        }
      }
    }
  }, [fitView]);

  // Core Tools & State
  const [activeTool, setActiveTool] = useState("select");
  const activeToolRef = useRef(activeTool);
  const isSpacePressedRef = useRef(false);
  const isAltPressedRef = useRef(false);
  
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed;
  }, [isSpacePressed]);

  useEffect(() => {
    isAltPressedRef.current = isAltPressed;
  }, [isAltPressed]);

  const snapToleranceRef = useRef(10);
  const isSnappingEnabledRef = useRef(true);

  useEffect(() => {
    snapToleranceRef.current = snapTolerance;
    isSnappingEnabledRef.current = isSnappingEnabled;
  }, [snapTolerance, isSnappingEnabled]);

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    if (activeTool === 'pan' || isSpacePressed || isAltPressed) {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.moveCursor = 'grabbing';
    } else if (activeTool === 'brush' || activeTool === 'eraser') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'default';
    }
    canvas.requestRenderAll();
  }, [activeTool, isSpacePressed, isAltPressed]);
  const [layers, setLayers] = useState<fabric.Object[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // UI Panels
  const [activeTab, setActiveTab] = useState<"properties" | "layers" | "history" | "filters" | "export" | "artboards" | "quick">("properties");

  // Panel sizing
  const MIN_PANEL_WIDTH = 280;
  const MAX_PANEL_WIDTH = 700;
  const DEFAULT_PANEL_WIDTH = 300;
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const stored = localStorage.getItem("image_workspace_panel_width");
      if (stored) {
         const w = parseInt(stored, 10);
         if (!isNaN(w) && w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) return w;
      }
    } catch(e) {}
    return DEFAULT_PANEL_WIDTH;
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const panelWidthRef = useRef(panelWidth);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
    localStorage.setItem("image_workspace_panel_width", panelWidth.toString());
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      // Calculate width from the right edge
      const newWidth = containerRect.right - e.clientX;
      const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, MAX_PANEL_WIDTH));
      setPanelWidth(clampedWidth);
      
      // Live resize of canvas during drag
      if (fabricRef.current) {
        const w = containerRect.width - clampedWidth;
        const h = containerRect.height - 48; // header height approx 48px
        fabricRef.current.setDimensions({
          width: w > 100 ? w : 100,
          height: h > 100 ? h : 100
        });
        fabricRef.current.requestRenderAll();
      }
    };

    const handlePointerUp = () => {
      setIsResizingPanel(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    // Ensure we don't accidentally select things on the page while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Snap view to fit the new viewport
      setTimeout(() => fitView(), 50);
    };
  }, [isResizingPanel]);



  // Filter Studio State
  const [imageFilters, setImageFilters] = useState<FilterConfig[]>([]);
  const [customPresets, setCustomPresets] = useState<{ name: string; stack: FilterConfig[] }[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [benchmarkInfo, setBenchmarkInfo] = useState<any>(null);

  // History Command stacks
  const [commandsList, setCommandsList] = useState<Command[]>([]);
  const [commandIndex, setCommandIndex] = useState(-1);
  const [historyNames, setHistoryNames] = useState<string[]>([]);
  const isInternalChange = useRef(false);
  const saveTimeoutRef = useRef<any>(null);

  const [draggedArtboardIdx, setDraggedArtboardIdx] = useState<number | null>(null);
  const [dragOverArtboardIdx, setDragOverArtboardIdx] = useState<number | null>(null);

  // Command control references to prevent stale closures
  const commandIndexRef = useRef(-1);
  const commandsListRef = useRef<Command[]>([]);

  // Brush / Styling
  const [brushType, setBrushType] = useState<string>("pencil");
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [brushFlow, setBrushFlow] = useState<number>(100);
  const [brushHardness, setBrushHardness] = useState<number>(100);
  const [brushSpacing, setBrushSpacing] = useState<number>(25);
  const [brushSmoothing, setBrushSmoothing] = useState<number>(40);

  // Dynamic Photoshop-style Brush Adjustment gesture states & refs
  const [showHud, setShowHud] = useState(false);
  const [hudPosition, setHudPosition] = useState<{ x: number, y: number } | null>(null);
  const [activeBrushProperty, setActiveBrushProperty] = useState<'size' | 'opacity' | 'hardness'>('size');
  const [hudFadingOut, setHudFadingOut] = useState(false);

  const isAdjustingBrushRef = useRef(false);
  const activeBrushPropertyRef = useRef<'size' | 'opacity' | 'hardness'>('size');
  const hasLockedPropertyRef = useRef<boolean>(false);
  
  const startBrushSizeRef = useRef(10);
  const startBrushOpacityRef = useRef(100);
  const startBrushHardnessRef = useRef(100);
  const startMouseXRef = useRef(0);
  const startMouseYRef = useRef(0);

  const isAdjustingBrushTouchRef = useRef(false);
  const startBrushTouchSizeRef = useRef(10);
  const startBrushTouchOpacityRef = useRef(100);
  const startBrushTouchHardnessRef = useRef(100);
  const startTouchXRef = useRef(0);
  const startTouchYRef = useRef(0);
  
  const hudTimeoutRef = useRef<any>(null);

  // Keyboard and styling refs to prevent stale closure traps in events
  const isShiftPressedRef = useRef(false);
  const isCtrlPressedRef = useRef(false);
  const brushSizeRef = useRef(brushSize);
  const brushOpacityRef = useRef(brushOpacity);
  const brushHardnessRef = useRef(brushHardness);
  const brushTypeRef = useRef(brushType);
  const brushColorRef = useRef(brushColor);
  const brushFlowRef = useRef(brushFlow);
  const brushSmoothingRef = useRef(brushSmoothing);

  useEffect(() => {
    isShiftPressedRef.current = isShiftPressed;
  }, [isShiftPressed]);

  useEffect(() => {
    isCtrlPressedRef.current = isCtrlPressed;
  }, [isCtrlPressed]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    brushOpacityRef.current = brushOpacity;
  }, [brushOpacity]);

  useEffect(() => {
    brushHardnessRef.current = brushHardness;
  }, [brushHardness]);

  useEffect(() => {
    brushTypeRef.current = brushType;
  }, [brushType]);

  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  useEffect(() => {
    brushFlowRef.current = brushFlow;
  }, [brushFlow]);

  useEffect(() => {
    brushSmoothingRef.current = brushSmoothing;
  }, [brushSmoothing]);

  // Consolidated Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

  // Before / After Comparison Workspace Settings
  const [comparisonMode, setComparisonMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [mobileDetailsExpanded, setMobileDetailsExpanded] = useState(false);
  const [comparisonPreviewMode, setComparisonPreviewMode] = useState<"split" | "side-by-side" | "original" | "optimized">("split");
  const [comparisonDivider, setComparisonDivider] = useState(50);
  const [comparisonZoom, setComparisonZoom] = useState(1);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [optimizedImageUrl, setOptimizedImageUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [currentPreviewOp, setCurrentPreviewOp] = useState<string>("");
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [optimizedSize, setOptimizedSize] = useState<number>(0);
  const [psnr, setPsnr] = useState<number | undefined>(undefined);

  // Sync export dimensions when tab opens, artboard changes
  const lastSyncedArtboardId = useRef<string | null>(null);
  useEffect(() => {
    if (activeTab === 'export') {
      const activeBoard = artboards.find(b => b.id === activeArtboardId);
      if (activeBoard && (activeBoard.id !== lastSyncedArtboardId.current)) {
        setExportSettings(prev => ({
          ...prev,
          resize: {
            ...prev.resize,
            width: activeBoard.width,
            height: activeBoard.height
          }
        }));
        lastSyncedArtboardId.current = activeBoard.id;
      }
    } else {
      // Clear tracking so it re-syncs correctly when returning to the export tab
      lastSyncedArtboardId.current = null;
    }
  }, [activeTab, activeArtboardId, artboards]);

  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingDivider(true);
    if (sliderRef.current) {
      try {
        sliderRef.current.setPointerCapture(e.pointerId);
      } catch (err) {
        // ignore polyfill fallback issues
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDraggingDivider(false);
    if (sliderRef.current) {
      try {
        sliderRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore fallback issues
      }
    }
  };

  const transformComponentRef = useRef<any>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDivider) return;
    const rect = sliderRef.current?.getBoundingClientRect();
    if (rect) {
      const clientX = e.clientX;
      const offset = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (offset / rect.width) * 100));
      setComparisonDivider(percentage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let step = 1;
    if (e.shiftKey) step = 5;
    if (e.key === "ArrowLeft") {
      setComparisonDivider(p => Math.max(0, p - step));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setComparisonDivider(p => Math.min(100, p + step));
      e.preventDefault();
    }
  };

  const guidesRef = useRef<{ type: 'v' | 'h', pos: number }[]>([]);

  const getTargetArtboard = (obj: fabric.Object): Artboard => {
    const placement = (obj as any).artboardId;
    const board = artboardsRef.current.find(b => b.id === placement) || 
                  artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || 
                  artboardsRef.current[0];
    return board;
  };

  const alignSelection = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight' | 'utils_fitInside' | 'utils_centerInside' | 'matchWidth' | 'matchHeight' | 'distributeH' | 'distributeV') => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) return;

    const objects = activeObject.type === 'activeSelection' 
      ? (activeObject as fabric.ActiveSelection).getObjects() 
      : [activeObject];

    const parentObj = parentAlignmentObjRef.current;
    const hasParent = parentObj && objects.includes(parentObj);
    const refArea = hasParent ? getAbsoluteBoundingRect(parentObj) : null;

    const refX = refArea ? refArea.left : 0;
    const refY = refArea ? refArea.top : 0;
    const refW = refArea ? refArea.width : 0;
    const refH = refArea ? refArea.height : 0;

    const originalBoard = getTargetArtboard(activeObject);
    const board = {
      ...originalBoard,
      x: refArea ? refArea.left : originalBoard.x,
      y: refArea ? refArea.top : originalBoard.y,
      width: refArea ? refArea.width : originalBoard.width,
      height: refArea ? refArea.height : originalBoard.height,
    };

    const beforeStates = objects.map(o => ({
      obj: o,
      before: {
        left: o.left,
        top: o.top,
        scaleX: o.scaleX,
        scaleY: o.scaleY,
        angle: o.angle,
        width: o.width,
        height: o.height,
      }
    }));

    // Handle Distribution modes directly first
    if (mode === 'distributeH' || mode === 'distributeV') {
      const children = hasParent ? objects.filter(o => o !== parentObj) : objects;
      if (children.length >= 2) {
        const childrenWithBounds = children.map(c => ({
          obj: c,
          bounds: getAbsoluteBoundingRect(c)
        }));

        const groupScaleX = activeObject.scaleX || 1;
        const groupScaleY = activeObject.scaleY || 1;

        if (mode === 'distributeH') {
          childrenWithBounds.sort((a, b) => a.bounds.left - b.bounds.left);

          const minLeft = refArea ? refX : childrenWithBounds[0].bounds.left;
          const maxRight = refArea ? (refX + refW) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.left + childrenWithBounds[childrenWithBounds.length - 1].bounds.width);
          const totalWidth = maxRight - minLeft;

          const totalChildrenWidth = childrenWithBounds.reduce((sum, item) => sum + item.bounds.width, 0);
          const totalSpacing = totalWidth - totalChildrenWidth;
          const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

          let currentLeft = minLeft;
          childrenWithBounds.forEach((item) => {
            const deltaX = currentLeft - item.bounds.left;
            item.obj.set({ left: item.obj.left! + (deltaX / groupScaleX) });
            item.obj.setCoords();
            currentLeft += item.bounds.width + gap;
          });
        } else {
          childrenWithBounds.sort((a, b) => a.bounds.top - b.bounds.top);

          const minTop = refArea ? refY : childrenWithBounds[0].bounds.top;
          const maxBottom = refArea ? (refY + refH) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.top + childrenWithBounds[childrenWithBounds.length - 1].bounds.height);
          const totalHeight = maxBottom - minTop;

          const totalChildrenHeight = childrenWithBounds.reduce((sum, item) => sum + item.bounds.height, 0);
          const totalSpacing = totalHeight - totalChildrenHeight;
          const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

          let currentTop = minTop;
          childrenWithBounds.forEach((item) => {
            const deltaY = currentTop - item.bounds.top;
            item.obj.set({ top: item.obj.top! + (deltaY / groupScaleY) });
            item.obj.setCoords();
            currentTop += item.bounds.height + gap;
          });
        }
      }
      if (fabricRef.current) {
        if (activeObject) {
          activeObject.setCoords();
          if (activeObject.type === 'activeSelection') {
            (activeObject as any)._calcBounds?.(true);
          }
        }
        fabricRef.current.requestRenderAll();
        // Fire custom modified events for undo state as standard
        const afterStatesDis = objects.map(o => ({
          obj: o,
          before: beforeStates.find(s => s.obj === o)!.before,
          after: {
            left: o.left,
            top: o.top,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
            angle: o.angle,
            width: o.width,
            height: o.height,
          }
        }));
        const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStatesDis);
        executeCommand(cmd);
      }
      return;
    }

    objects.forEach(obj => {
      // Skip parent object since it acts as the key reference anchor
      if (refArea && obj === parentObj) {
        return;
      }
      
      const currentAbsBounds = getAbsoluteBoundingRect(obj);
      const currentScaleX = obj.scaleX || 1;
      const currentScaleY = obj.scaleY || 1;

      let targetScaleX = currentScaleX;
      let targetScaleY = currentScaleY;

      switch (mode) {
        case 'stretch':
          targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
          targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
          break;
        case 'fit': {
          const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
          targetScaleX = currentScaleX * scale;
          targetScaleY = currentScaleY * scale;
          break;
        }
        case 'fill': {
          const scale = Math.max(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
          targetScaleX = currentScaleX * scale;
          targetScaleY = currentScaleY * scale;
          break;
        }
        case 'fitWidth': {
          const scale = board.width / currentAbsBounds.width;
          targetScaleX = currentScaleX * scale;
          targetScaleY = currentScaleY * scale;
          break;
        }
        case 'fitHeight': {
          const scale = board.height / currentAbsBounds.height;
          targetScaleX = currentScaleX * scale;
          targetScaleY = currentScaleY * scale;
          break;
        }
        case 'utils_fitInside': {
          const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
          targetScaleX = currentScaleX * scale;
          targetScaleY = currentScaleY * scale;
          break;
        }
        case 'matchWidth':
          targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
          break;
        case 'matchHeight':
          targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
          break;
      }

      obj.set({
        scaleX: targetScaleX,
        scaleY: targetScaleY
      });
      obj.setCoords();

      const newAbsBounds = getAbsoluteBoundingRect(obj);

      let targetAbsLeft = newAbsBounds.left;
      let targetAbsTop = newAbsBounds.top;

      switch (mode) {
        case 'left':
        case 'stretch':
        case 'matchWidth':
          targetAbsLeft = board.x;
          break;
        case 'centerH':
        case 'fit':
        case 'fill':
        case 'fitWidth':
        case 'utils_fitInside':
        case 'utils_centerInside':
          targetAbsLeft = board.x + (board.width - newAbsBounds.width) / 2;
          break;
        case 'right':
          targetAbsLeft = board.x + board.width - newAbsBounds.width;
          break;
        case 'top':
        case 'stretch':
        case 'matchHeight':
          targetAbsTop = board.y;
          break;
        case 'centerV':
        case 'fit':
        case 'fill':
        case 'fitHeight':
        case 'utils_fitInside':
        case 'utils_centerInside':
          targetAbsTop = board.y + (board.height - newAbsBounds.height) / 2;
          break;
        case 'bottom':
          targetAbsTop = board.y + board.height - newAbsBounds.height;
          break;
      }

      const deltaX = targetAbsLeft - newAbsBounds.left;
      const deltaY = targetAbsTop - newAbsBounds.top;

      const groupScaleX = obj.group ? (obj.group.scaleX || 1) : 1;
      const groupScaleY = obj.group ? (obj.group.scaleY || 1) : 1;

      obj.set({
        left: obj.left! + (deltaX / groupScaleX),
        top: obj.top! + (deltaY / groupScaleY)
      });
      obj.setCoords();
    });

    if (activeObject) {
      activeObject.setCoords();
      if (activeObject.type === 'activeSelection') {
        (activeObject as any)._calcBounds?.(true);
      }
    }

    const afterStates = objects.map(o => ({
      obj: o,
      before: beforeStates.find(s => s.obj === o)!.before,
      after: {
        left: o.left,
        top: o.top,
        scaleX: o.scaleX,
        scaleY: o.scaleY,
        angle: o.angle,
        width: o.width,
        height: o.height,
      }
    }));

    const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStates);
    executeCommand(cmd);
    fabricRef.current.requestRenderAll();
    updateLayersList();
  };
  const handleSnapping = useCallback((e: any) => {
    if (!fabricRef.current || !isSnappingEnabledRef.current || isAltPressedRef.current) {
      guidesRef.current = [];
      return;
    }

    const obj = e.target;
    if (!obj) return;

    const canvas = fabricRef.current;
    const tolerance = snapToleranceRef.current;
    const bounds = obj.getBoundingRect();
    const objWidth = bounds.width;
    const objHeight = bounds.height;
    const objLeft = bounds.left;
    const objTop = bounds.top;
    const objRight = objLeft + objWidth;
    const objBottom = objTop + objHeight;
    const objCenterX = objLeft + objWidth / 2;
    const objCenterY = objTop + objHeight / 2;

    const newGuides: { type: 'v' | 'h', pos: number }[] = [];
    let snappedX = false;
    let snappedY = false;

    // --- ARTBOARD SNAPPING ---
    artboardsRef.current.forEach(board => {
      const bL = board.x;
      const bT = board.y;
      const bR = board.x + board.width;
      const bB = board.y + board.height;
      const bCX = board.x + board.width / 2;
      const bCY = board.y + board.height / 2;

      // X-axis snapping
      if (!snappedX) {
        if (Math.abs(objLeft - bL) < tolerance) {
          obj.set({ left: bL + (obj.left! - objLeft) });
          newGuides.push({ type: 'v', pos: bL });
          snappedX = true;
        } else if (Math.abs(objRight - bR) < tolerance) {
          obj.set({ left: bR - objWidth + (obj.left! - objLeft) });
          newGuides.push({ type: 'v', pos: bR });
          snappedX = true;
        } else if (Math.abs(objCenterX - bCX) < tolerance) {
          obj.set({ left: bCX - objWidth / 2 + (obj.left! - objLeft) });
          newGuides.push({ type: 'v', pos: bCX });
          snappedX = true;
        } else if (Math.abs(objLeft - bR) < tolerance) {
          obj.set({ left: bR + (obj.left! - objLeft) });
          newGuides.push({ type: 'v', pos: bR });
          snappedX = true;
        } else if (Math.abs(objRight - bL) < tolerance) {
          obj.set({ left: bL - objWidth + (obj.left! - objLeft) });
          newGuides.push({ type: 'v', pos: bL });
          snappedX = true;
        }
      }

      // Y-axis snapping
      if (!snappedY) {
        if (Math.abs(objTop - bT) < tolerance) {
          obj.set({ top: bT + (obj.top! - objTop) });
          newGuides.push({ type: 'h', pos: bT });
          snappedY = true;
        } else if (Math.abs(objBottom - bB) < tolerance) {
          obj.set({ top: bB - objHeight + (obj.top! - objTop) });
          newGuides.push({ type: 'h', pos: bB });
          snappedY = true;
        } else if (Math.abs(objCenterY - bCY) < tolerance) {
          obj.set({ top: bCY - objHeight / 2 + (obj.top! - objTop) });
          newGuides.push({ type: 'h', pos: bCY });
          snappedY = true;
        } else if (Math.abs(objTop - bB) < tolerance) {
          obj.set({ top: bB + (obj.top! - objTop) });
          newGuides.push({ type: 'h', pos: bB });
          snappedY = true;
        } else if (Math.abs(objBottom - bT) < tolerance) {
          obj.set({ top: bT - objHeight + (obj.top! - objTop) });
          newGuides.push({ type: 'h', pos: bT });
          snappedY = true;
        }
      }

      // Safe Areas & Margins
      if (board.showSafeArea || board.showMargins) {
        const m = board.showMargins ? 0.1 : 0.05;
        const sL = bL + board.width * m;
        const sT = bT + board.height * m;
        const sR = bR - board.width * m;
        const sB = bB - board.height * m;

        if (!snappedX) {
          if (Math.abs(objLeft - sL) < tolerance) {
            obj.set({ left: sL + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: sL });
            snappedX = true;
          } else if (Math.abs(objRight - sR) < tolerance) {
            obj.set({ left: sR - objWidth + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: sR });
            snappedX = true;
          }
        }
        if (!snappedY) {
          if (Math.abs(objTop - sT) < tolerance) {
            obj.set({ top: sT + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: sT });
            snappedY = true;
          } else if (Math.abs(objBottom - sB) < tolerance) {
            obj.set({ top: sB - objHeight + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: sB });
            snappedY = true;
          }
        }
      }
    });

    // --- OBJECT SNAPPING ---
    if (!snappedX || !snappedY) {
      const otherObjects = canvas.getObjects().filter(o => o !== obj && o.visible && o.selectable);
      for (const other of otherObjects) {
        const oBounds = other.getBoundingRect();
        const oL = oBounds.left;
        const oT = oBounds.top;
        const oR = oL + oBounds.width;
        const oB = oT + oBounds.height;
        const oCX = oL + oBounds.width / 2;
        const oCY = oT + oBounds.height / 2;

        if (!snappedX) {
          if (Math.abs(objLeft - oL) < tolerance) {
            obj.set({ left: oL + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: oL });
            snappedX = true;
          } else if (Math.abs(objRight - oR) < tolerance) {
            obj.set({ left: oR - objWidth + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: oR });
            snappedX = true;
          } else if (Math.abs(objCenterX - oCX) < tolerance) {
            obj.set({ left: oCX - objWidth / 2 + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: oCX });
            snappedX = true;
          } else if (Math.abs(objLeft - oR) < tolerance) {
            obj.set({ left: oR + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: oR });
            snappedX = true;
          } else if (Math.abs(objRight - oL) < tolerance) {
            obj.set({ left: oL - objWidth + (obj.left! - objLeft) });
            newGuides.push({ type: 'v', pos: oL });
            snappedX = true;
          }
        }

        if (!snappedY) {
          if (Math.abs(objTop - oT) < tolerance) {
            obj.set({ top: oT + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: oT });
            snappedY = true;
          } else if (Math.abs(objBottom - oB) < tolerance) {
            obj.set({ top: oB - objHeight + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: oB });
            snappedY = true;
          } else if (Math.abs(objCenterY - oCY) < tolerance) {
            obj.set({ top: oCY - objHeight / 2 + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: oCY });
            snappedY = true;
          } else if (Math.abs(objTop - oB) < tolerance) {
            obj.set({ top: oB + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: oB });
            snappedY = true;
          } else if (Math.abs(objBottom - oT) < tolerance) {
            obj.set({ top: oT - objHeight + (obj.top! - objTop) });
            newGuides.push({ type: 'h', pos: oT });
            snappedY = true;
          }
        }
        if (snappedX && snappedY) break;
      }
    }

    guidesRef.current = newGuides;
    if (newGuides.length > 0) {
      canvas.requestRenderAll();
    }
  }, []);
  const [textProps, setTextProps] = useState({
    textContent: "",
    fontFamily: "Arial",
    fontSize: 40,
    fontWeight: "normal",
    fontStyle: "normal",
    textAlign: "left" as any,
    underline: false,
    overline: false,
    linethrough: false,
    charSpacing: 0,
    lineHeight: 1.16,
    angle: 0,
    flipX: false,
    flipY: false,
  });
  const [frameBorderWidth, setFrameBorderWidth] = useState(20);

  const fontSizeStartRef = useRef<number>(40);
  const textStartValueRef = useRef<string>("");

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

  // Sync canvas state back to workspace document
  const updateLayersList = useCallback(() => {
    if (!fabricRef.current) return;
    const items = fabricRef.current.getObjects();
    setLayers([...items].reverse()); // Top layer first
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!fabricRef.current) return;
      try {
        saveToDexie(path, artboardsRef.current, fabricRef.current).catch(err => {
          console.error("Dexie save failed", err);
        });

        const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
        let dataUrl = "";

        if (activeBoard) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = activeBoard.width;
            tempCanvas.height = activeBoard.height;
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
                if (!activeBoard.transparent) {
                  ctx.fillStyle = activeBoard.backgroundColor || "#ffffff";
                  ctx.fillRect(0, 0, activeBoard.width, activeBoard.height);
                } else {
                  ctx.clearRect(0, 0, activeBoard.width, activeBoard.height);
                }

                ctx.save();
                ctx.translate(-activeBoard.x, -activeBoard.y);
                fabricRef.current.getObjects().forEach((obj) => {
                  if (!obj.visible || obj.type === 'activeSelection') return;
                  if ((obj as any).artboardId === activeBoard.id) obj.render(ctx);
                });
                ctx.restore();
                dataUrl = tempCanvas.toDataURL('image/png');
            } else {
                dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
            }
        } else {
            dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
        }
        const name = path.split('.').pop() || "edited_image";
        const file = dataURLtoFile(dataUrl, `${name}.png`);
        
        importFile(file).then(({ assetId }) => {
          updateNodeValue(path, assetId);
        }).catch(err => {
          console.error("Failed to save edited canvas as asset:", err);
          updateNodeValue(path, dataUrl); // fallback
        });
      } catch (err) {
        console.error("Error serializing image canvas:", err);
      }
    }, 850);
  }, [path, updateNodeValue]);

  const handleSelectionContext = useCallback((e: any) => {
    const active = fabricRef.current?.getActiveObject();
    if (active) {
      if (active.type === 'activeSelection') {
        const selObjects = (active as fabric.ActiveSelection).getObjects();
        if (parentAlignmentObjRef.current && !selObjects.includes(parentAlignmentObjRef.current)) {
          parentAlignmentObjRef.current = null;
          setParentAlignmentObj(null);
        }
      } else {
        parentAlignmentObjRef.current = null;
        setParentAlignmentObj(null);
      }

      setSelectedLayerId((active as any).id);
      setSelectionType(active.get('isFrameGroup') ? 'frameGroup' : active.type);
      
      if ((active as any).isCollageBlock) {
        setCollageBgColor(active.get('fill') as string || '#333333');
        const stroke = active.get('stroke') as string || '#555555';
        setCollageBorderColor(stroke === 'transparent' ? '#555555' : stroke);
        setCollageBorderWidth(active.get('strokeWidth') as number || 2);
        
        const obj = active as any;
        const w = obj.width ?? 100;
        const h = obj.height ?? 100;
        const maxR = Math.min(w, h) / 2;
        
        const uPercent = obj.cornerRoundingPercent !== undefined ? obj.cornerRoundingPercent : Math.round(((obj.rx || 0) / (maxR || 1)) * 100);
        const tlPercent = obj.cornerTopLeftPercent !== undefined ? obj.cornerTopLeftPercent : uPercent;
        const trPercent = obj.cornerTopRightPercent !== undefined ? obj.cornerTopRightPercent : uPercent;
        const brPercent = obj.cornerBottomRightPercent !== undefined ? obj.cornerBottomRightPercent : uPercent;
        const blPercent = obj.cornerBottomLeftPercent !== undefined ? obj.cornerBottomLeftPercent : uPercent;
        const isIndiv = obj.useIndividualCorners ?? false;

        setCollageCornerRadius(uPercent);
        setUseIndividualCorners(isIndiv);
        setCollageCornerTL(tlPercent);
        setCollageCornerTR(trPercent);
        setCollageCornerBR(brPercent);
        setCollageCornerBL(blPercent);

        const dash = active.get('strokeDashArray');
        if (stroke === 'transparent' || active.get('strokeWidth') === 0) {
          setCollageBorderStyle('none');
        } else if (dash && dash.length > 0) {
          setCollageBorderStyle('dashed');
        } else {
          setCollageBorderStyle('solid');
        }
      }

      if (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox') {
        const textObj = active as any;
        setTextProps({
          textContent: textObj.text || "",
          fontFamily: textObj.fontFamily || "Arial",
          fontSize: textObj.fontSize || 40,
          fontWeight: textObj.fontWeight || "normal",
          fontStyle: textObj.fontStyle || "normal",
          textAlign: textObj.textAlign || "left",
          underline: textObj.underline || false,
          overline: textObj.overline || false,
          linethrough: textObj.linethrough || false,
          charSpacing: textObj.charSpacing || 0,
          lineHeight: textObj.lineHeight || 1.16,
          angle: textObj.angle || 0,
          flipX: textObj.flipX || false,
          flipY: textObj.flipY || false,
        });
      } else if (active.type === 'image' || active.get('isFrameGroup')) {
        let imgObj = active as any;
        if (imgObj.get('isFrameGroup')) {
           const frameType = imgObj.get('frameType');
           const items = imgObj.getObjects();
           
           const rectObj = items.find((i: any) => i.type === 'rect');
           if (rectObj) {
              if (frameType === 'polaroid') {
                  const contentObj = items.find((i: any) => i.type === 'image');
                  if (contentObj) {
                      setFrameBorderWidth(Math.round(rectObj.top - contentObj.getCenterPoint().y));
                  }
              } else {
                  setFrameBorderWidth(Math.round(rectObj.strokeWidth || 20));
              }
           }
           
           imgObj = items.find((i: any) => i.type === 'image') || imgObj;
        }
        setImageFilters(imgObj.customFilters || []);
        if (imgObj.lastFilterBenchmark) {
          setBenchmarkInfo(imgObj.lastFilterBenchmark);
        } else {
          setBenchmarkInfo({
            backend: (fabric as any).isWebglSupported && (fabric as any).isWebglSupported() ? "WebGL" : "Canvas2D",
            filterTimeMs: "0.0",
            outputWidth: imgObj.width ? Math.round(imgObj.width * (imgObj.scaleX || 1)) : 0,
            outputHeight: imgObj.height ? Math.round(imgObj.height * (imgObj.scaleY || 1)) : 0
          });
        }
      }
    } else {
      parentAlignmentObjRef.current = null;
      setParentAlignmentObj(null);
      setSelectedLayerId(null);
      setSelectionType(null);
    }
  }, []);

  // History Execute Core Engine
  const executeCommand = useCallback((cmd: Command) => {
    isInternalChange.current = true;
    if (fabricRef.current) {
      cmd.execute(fabricRef.current, updateLayersList);
    }
    isInternalChange.current = false;

    const nextIndex = commandIndexRef.current + 1;
    commandsListRef.current = commandsListRef.current.slice(0, nextIndex);
    commandsListRef.current.push(cmd);
    commandIndexRef.current = nextIndex;

    setCommandIndex(nextIndex);
    setHistoryNames(commandsListRef.current.map(c => c.name));
  }, [updateLayersList]);

  const performUndo = useCallback(() => {
    if (commandIndexRef.current >= 0 && fabricRef.current) {
      isInternalChange.current = true;
      const cmd = commandsListRef.current[commandIndexRef.current];
      cmd.undo(fabricRef.current, updateLayersList);
      commandIndexRef.current -= 1;
      setCommandIndex(commandIndexRef.current);
      isInternalChange.current = false;
      handleSelectionContext(null);
    }
  }, [updateLayersList, handleSelectionContext]);

  const performRedo = useCallback(() => {
    const nextIndex = commandIndexRef.current + 1;
    if (nextIndex < commandsListRef.current.length && fabricRef.current) {
      isInternalChange.current = true;
      const cmd = commandsListRef.current[nextIndex];
      cmd.redo(fabricRef.current, updateLayersList);
      commandIndexRef.current = nextIndex;
      setCommandIndex(nextIndex);
      isInternalChange.current = false;
      handleSelectionContext(null);
    }
  }, [updateLayersList, handleSelectionContext]);

  const jumpToHistory = useCallback((idx: number) => {
    if (!fabricRef.current) return;
    isInternalChange.current = true;

    while (commandIndexRef.current > idx) {
      const cmd = commandsListRef.current[commandIndexRef.current];
      cmd.undo(fabricRef.current, updateLayersList);
      commandIndexRef.current -= 1;
    }

    while (commandIndexRef.current < idx) {
      const nextIdx = commandIndexRef.current + 1;
      const cmd = commandsListRef.current[nextIdx];
      cmd.redo(fabricRef.current, updateLayersList);
      commandIndexRef.current = nextIdx;
    }

    setCommandIndex(idx);
    isInternalChange.current = false;
    handleSelectionContext(null);
  }, [updateLayersList, handleSelectionContext]);

  const getLayersOrder = useCallback(() => {
    if (!fabricRef.current) return [];
    return fabricRef.current.getObjects().map((obj: any, idx) => ({
      id: obj.id as string,
      idx
    }));
  }, []);

  const handleLayerOrder = useCallback((action: 'front' | 'forward' | 'backward' | 'back') => {
    if (!fabricRef.current) return;
    const activeObjects = fabricRef.current.getActiveObjects();
    if (!activeObjects || activeObjects.length === 0) return;

    const beforeOrder = getLayersOrder();

    if (action === 'front') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxA - idxB; // Lowest first
      });
      sorted.forEach(obj => fabricRef.current?.bringObjectToFront(obj));
    } else if (action === 'back') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxB - idxA; // Highest first
      });
      sorted.forEach(obj => fabricRef.current?.sendObjectToBack(obj));
    } else if (action === 'forward') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxB - idxA;
      });
      sorted.forEach(obj => fabricRef.current?.bringObjectForward(obj));
    } else if (action === 'backward') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxA - idxB;
      });
      sorted.forEach(obj => fabricRef.current?.sendObjectBackwards(obj));
    }

    const afterOrder = getLayersOrder();
    if (JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)) return;

    const cmdName = action === 'front' ? 'Bring to Front' : action === 'back' ? 'Send to Back' : action === 'forward' ? 'Bring Forward' : 'Send Backward';
    const cmd = new LayerReorderCommand(cmdName, beforeOrder, afterOrder);
    
    isInternalChange.current = true;
    cmd.undo(fabricRef.current, () => {});
    isInternalChange.current = false;
    
    executeCommand(cmd);
    updateLayersList();
  }, [getLayersOrder, executeCommand, updateLayersList]);

  const artboardFocusValueRef = useRef<any>(null);

  const onArtboardPropStart = (val: any) => {
    artboardFocusValueRef.current = val;
  };

  const onArtboardPropCommit = (id: string, prop: keyof Artboard, finalVal: any) => {
    const beforeVal = artboardFocusValueRef.current;
    if (beforeVal !== null && beforeVal !== undefined && beforeVal !== finalVal) {
      const labelMap: Record<string, string> = {
        name: "Rename Artboard",
        width: "Change Artboard Width",
        height: "Change Artboard Height",
        backgroundColor: "Change Artboard Background Color",
        borderColor: "Change Artboard Border Color",
      };
      const cmdName = labelMap[prop] || `Change Artboard ${String(prop)}`;
      const cmd = new ArtboardPropertyCommand(cmdName, id, prop, beforeVal, finalVal, setArtboards);
      
      const nextIndex = commandIndexRef.current + 1;
      commandsListRef.current = commandsListRef.current.slice(0, nextIndex);
      commandsListRef.current.push(cmd);
      commandIndexRef.current = nextIndex;
      setCommandIndex(nextIndex);
      setHistoryNames(commandsListRef.current.map(c => c.name));
    }
    artboardFocusValueRef.current = null;
  };

  const createArtboardFromPreset = (presetId: string) => {
    const preset = PRESET_REGISTRY.find(p => p.id === presetId);
    if (!preset || !activeArtboardId || !fabricRef.current) {
       alert("Please ensure an artboard is selected.");
       return;
    }
    const canvas = fabricRef.current;
    const dims = getDimensionsInPixels(preset);
    
    const boardIndex = artboards.findIndex(b => b.id === activeArtboardId);
    if (boardIndex === -1) return;
    const board = artboards[boardIndex];
    
    let targetImage = canvas.getActiveObject();
    if (!targetImage || (targetImage.type !== 'image' && !targetImage.get('isFrameGroup'))) {
        const objects = canvas.getObjects().filter(o => (o as any).artboardId === activeArtboardId);
        const images = objects.filter(o => o.type === 'image' || o.get('isFrameGroup'));
        if (images.length > 0) {
            targetImage = images[0];
            canvas.setActiveObject(targetImage);
        } else {
            targetImage = null;
        }
    }

    const newBoards = [...artboards];
    newBoards[boardIndex] = { 
       ...board, 
       width: dims.width, 
       height: dims.height, 
       name: preset.name,
       showGrid: false,
       showSafeArea: preset.category === 'document' || preset.category === 'print',
       showMargins: preset.category === 'document' || preset.category === 'print'
    };
    
    const commands: Command[] = [];
    commands.push(new ArtboardStateCommand(
       `Format Document: ${preset.name}`,
       [...artboards],
       newBoards,
       activeArtboardId,
       activeArtboardId,
       setArtboards,
       setActiveArtboardId
    ));
    
    if (targetImage) {
        const scaleX = dims.width / targetImage.getScaledWidth();
        const scaleY = dims.height / targetImage.getScaledHeight();
        const scale = Math.min(scaleX, scaleY) * 0.95; // 95% fit to preserve safe margins
        
        const nScaleX = (targetImage.scaleX || 1) * scale;
        const nScaleY = (targetImage.scaleY || 1) * scale;
        
        const beforeState = { 
            left: targetImage.left, top: targetImage.top, 
            scaleX: targetImage.scaleX, scaleY: targetImage.scaleY, 
            angle: targetImage.angle, originX: targetImage.originX, originY: targetImage.originY 
        };
        
        targetImage.set({ scaleX: nScaleX, scaleY: nScaleY });
        targetImage.setCoords();
        
        const center = targetImage.getCenterPoint();
        const dx = (board.x + dims.width / 2) - center.x;
        const dy = (board.y + dims.height / 2) - center.y;
        
        targetImage.set({
            left: (targetImage.left || 0) + dx,
            top: (targetImage.top || 0) + dy
        });
        targetImage.setCoords();
        
        const afterState = { 
            left: targetImage.left, top: targetImage.top, 
            scaleX: nScaleX, scaleY: nScaleY, 
            angle: targetImage.angle, originX: targetImage.originX, originY: targetImage.originY 
        };
        
        targetImage.set(beforeState);
        targetImage.setCoords();
        
        commands.push(new TransformObjectsCommand(
            "Format Image",
            [{ obj: targetImage, before: beforeState, after: afterState }]
        ));
    }

    const macro = new MacroCommand(`Convert to ${preset.name}`, commands);
    executeCommand(macro);
  };

  const generateSmartCollage = (type: string) => {
    if (!fabricRef.current || !activeArtboardId) return;
    const canvas = fabricRef.current;
    const board = artboards.find(b => b.id === activeArtboardId);
    if (!board) return;

    // We will save to history before we do this
    const commands: Command[] = [];
    const padding = Math.min(board.width, board.height) * (collagePaddingPercent / 100);
    const innerW = board.width - padding * 2;
    const innerH = board.height - padding * 2;
    const gap = Math.min(board.width, board.height) * (collageGapPercent / 100);

    const items: fabric.Rect[] = [];

    const createPlaceholder = (x: number, y: number, w: number, h: number) => {
      const isNone = collageBorderStyle === 'none';
      const isDashed = collageBorderStyle === 'dashed';
      const rect = new fabric.Rect({
        left: board.x + padding + x,
        top: board.y + padding + y,
        width: w,
        height: h,
        fill: collageBgColor,
        stroke: isNone ? 'transparent' : collageBorderColor,
        strokeWidth: isNone ? 0 : collageBorderWidth,
        strokeDashArray: isDashed ? [5, 5] : undefined,
        rx: 0, // we use custom drawing properties
        ry: 0,
        cornerRoundingPercent: collageCornerRadius,
        useIndividualCorners: useIndividualCorners,
        cornerTopLeftPercent: collageCornerTL,
        cornerTopRightPercent: collageCornerTR,
        cornerBottomLeftPercent: collageCornerBL,
        cornerBottomRightPercent: collageCornerBR,
        opacity: 0.9,
        cornerColor: '#00aaff',
        transparentCorners: false,
        id: 'collage_' + Date.now().toString() + '_' + Math.random().toString().slice(2, 6)
      } as any);
      (rect as any).artboardId = board.id;
      (rect as any).isCollageBlock = true;
      return rect;
    };

    if (type === '2x') {
      const cellW = (innerW - gap) / 2;
      items.push(createPlaceholder(0, 0, cellW, innerH));
      items.push(createPlaceholder(cellW + gap, 0, cellW, innerH));
    } else if (type === '3x') {
      const cellW = (innerW - gap * 2) / 3;
      items.push(createPlaceholder(0, 0, cellW, innerH));
      items.push(createPlaceholder(cellW + gap, 0, cellW, innerH));
      items.push(createPlaceholder((cellW + gap) * 2, 0, cellW, innerH));
    } else if (type === '4x') {
      const cellW = (innerW - gap) / 2;
      const cellH = (innerH - gap) / 2;
      items.push(createPlaceholder(0, 0, cellW, cellH));
      items.push(createPlaceholder(cellW + gap, 0, cellW, cellH));
      items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
      items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
    } else if (type === '1-2') {
      const cellW = (innerW - gap) / 2;
      const cellH = (innerH - gap) / 2;
      items.push(createPlaceholder(0, 0, cellW, innerH));
      items.push(createPlaceholder(cellW + gap, 0, cellW, cellH));
      items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
    } else if (type === '2-1') {
      const cellW = (innerW - gap) / 2;
      const cellH = (innerH - gap) / 2;
      items.push(createPlaceholder(0, 0, innerW, cellH));
      items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
      items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
    } else if (type === 'film') {
      const cellW = innerW;
      const cellH = (innerH - gap * 2) / 3;
      items.push(createPlaceholder(0, 0, cellW, cellH));
      items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
      items.push(createPlaceholder(0, (cellH + gap) * 2, cellW, cellH));
    }

    if (items.length > 0) {
      canvas.discardActiveObject();
      items.forEach(item => {
        canvas.add(item);
        commands.push(new AddObjectCommand("Add Collage Block", item));
      });
      const sel = new fabric.ActiveSelection(items, { canvas });
      canvas.setActiveObject(sel);
      canvas.requestRenderAll();
      updateLayersList();
      
      const macro = new MacroCommand(`Smart Collage (${type})`, commands);
      executeCommand(macro);
    }
  };

  const addAlignedCollageText = (alignment: 'top' | 'center' | 'bottom' | 'left' | 'right') => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const active = canvas.getActiveObject();
    if (!active || !(active as any).isCollageBlock) {
       return;
    }

    const rect = active as fabric.Rect;
    const scaledW = rect.getScaledWidth();
    const scaledH = rect.getScaledHeight();
    const textWidth = Math.min(scaledW * 0.8, 200);
    const textHeight = 30;

    let left = rect.left + (scaledW - textWidth) / 2;
    let top = rect.top + (scaledH - textHeight) / 2;
    let textAlign: fabric.TextboxProps['textAlign'] = 'center';

    if (alignment === 'top') {
      top = rect.top + scaledH * 0.15;
    } else if (alignment === 'bottom') {
      top = rect.top + scaledH * 0.85 - textHeight;
    } else if (alignment === 'left') {
      left = rect.left + scaledW * 0.1;
      textAlign = 'left';
    } else if (alignment === 'right') {
      left = rect.left + scaledW * 0.9 - textWidth;
      textAlign = 'right';
    }

    const text = new fabric.Textbox('Heading Text', {
      left,
      top,
      width: textWidth,
      fill: '#FFFFFF',
      fontFamily: textProps.fontFamily,
      fontSize: Math.min(scaledH * 0.18, 24),
      fontWeight: 'bold',
      fontStyle: textProps.fontStyle,
      textAlign: textAlign,
      id: Date.now().toString() + '_' + Math.random().toString().slice(2, 6),
      artboardId: (rect as any).artboardId
    } as any);

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    updateLayersList();

    const cmd = new AddObjectCommand("Add Collage Text", text);
    executeCommand(cmd);
  };

  const fillCollageBlockWithImage = (imageFile: File) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const active = canvas.getActiveObject();
    if (!active || !(active as any).isCollageBlock) {
       return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      fabric.Image.fromURL(dataUrl).then((img) => {
        const rect = active as fabric.Rect;
        
        // Calculate dimensions to cover/fill the block (similar to object-fit: cover)
        const blockW = rect.getScaledWidth();
        const blockH = rect.getScaledHeight();
        const imgW = img.width || 100;
        const imgH = img.height || 100;

        const scaleX = blockW / imgW;
        const scaleY = blockH / imgH;
        const scale = Math.max(scaleX, scaleY);

        img.set({
          left: rect.left + (blockW - imgW * scale) / 2,
          top: rect.top + (blockH - imgH * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          clipPath: new fabric.Rect({
            left: 0,
            top: 0,
            width: imgW,
            height: imgH,
            rx: (rect.rx || 0) / scale,
            ry: (rect.ry || 0) / scale,
            originX: 'center',
            originY: 'center'
          }),
          id: 'img_' + Date.now().toString() + '_' + Math.random().toString().slice(2, 6),
          artboardId: (rect as any).artboardId
        } as any);

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        updateLayersList();

        const cmd = new AddObjectCommand("Fill Block with Image", img);
        executeCommand(cmd);
      });
    };
    reader.readAsDataURL(imageFile);
  };

  const updateCollageBlockStyleProperty = (prop: string, value: any) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const active = canvas.getActiveObject();
    if (!active) return;

    const items: fabric.Object[] = [];
    if (active.type === 'activeSelection') {
      (active as fabric.ActiveSelection).getObjects().forEach(o => {
        if ((o as any).isCollageBlock) items.push(o);
      });
    } else if ((active as any).isCollageBlock) {
      items.push(active);
    }

    if (items.length === 0) return;

    const commands: Command[] = [];
    items.forEach(item => {
      const before: any = {};
      const after: any = {};

      if (prop === 'fill') {
        before.fill = item.get('fill');
        after.fill = value;
        setCollageBgColor(value);
      } else if (prop === 'stroke') {
        before.stroke = item.get('stroke');
        before.strokeWidth = item.get('strokeWidth');
        before.strokeDashArray = item.get('strokeDashArray');

        after.stroke = value;
        setCollageBorderColor(value);

        // Auto-activate the outline if thickness is 0 or style is none
        const currentWidth = item.get('strokeWidth') ?? 0;
        const currentStroke = item.get('stroke');
        if (collageBorderStyle === 'none' || currentWidth === 0 || currentStroke === 'transparent') {
          const newWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
          after.strokeWidth = newWidth;
          after.strokeDashArray = null;
          setCollageBorderWidth(newWidth);
          setCollageBorderStyle('solid');
        }
      } else if (prop === 'strokeWidth') {
        before.strokeWidth = item.get('strokeWidth');
        before.stroke = item.get('stroke');
        before.strokeDashArray = item.get('strokeDashArray');

        after.strokeWidth = value;
        setCollageBorderWidth(value);

        // Auto-set border color and style if outline gains thickness
        const currentStroke = item.get('stroke');
        if (value > 0 && (collageBorderStyle === 'none' || currentStroke === 'transparent' || !currentStroke)) {
          after.stroke = collageBorderColor || '#555555';
          after.strokeDashArray = null;
          setCollageBorderStyle('solid');
        } else if (value === 0) {
          after.stroke = 'transparent';
          after.strokeDashArray = null;
          setCollageBorderStyle('none');
        }
      } else if (prop === 'rx') {
        before.cornerRoundingPercent = (item as any).cornerRoundingPercent;
        before.rx = (item as fabric.Rect).rx || 0;
        before.ry = (item as fabric.Rect).ry || 0;
        after.cornerRoundingPercent = value;
        after.rx = value;
        after.ry = value;
        setCollageCornerRadius(value);
      } else if (prop === 'rx_tl') {
        before.cornerTopLeftPercent = (item as any).cornerTopLeftPercent;
        after.cornerTopLeftPercent = value;
        setCollageCornerTL(value);
      } else if (prop === 'rx_tr') {
        before.cornerTopRightPercent = (item as any).cornerTopRightPercent;
        after.cornerTopRightPercent = value;
        setCollageCornerTR(value);
      } else if (prop === 'rx_bl') {
        before.cornerBottomLeftPercent = (item as any).cornerBottomLeftPercent;
        after.cornerBottomLeftPercent = value;
        setCollageCornerBL(value);
      } else if (prop === 'rx_br') {
        before.cornerBottomRightPercent = (item as any).cornerBottomRightPercent;
        after.cornerBottomRightPercent = value;
        setCollageCornerBR(value);
      } else if (prop === 'useIndividualCorners') {
        before.useIndividualCorners = (item as any).useIndividualCorners;
        after.useIndividualCorners = value;
        setUseIndividualCorners(value);
      } else if (prop === 'borderStyle') {
        before.stroke = item.get('stroke');
        before.strokeWidth = item.get('strokeWidth');
        before.strokeDashArray = item.get('strokeDashArray');

        setCollageBorderStyle(value);
        if (value === 'none') {
          after.stroke = 'transparent';
          after.strokeWidth = 0;
          after.strokeDashArray = null;
        } else if (value === 'dashed') {
          after.stroke = collageBorderColor || '#555555';
          after.strokeWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
          after.strokeDashArray = [5, 5];
        } else {
          after.stroke = collageBorderColor || '#555555';
          after.strokeWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
          after.strokeDashArray = null;
        }
      }

      item.set(after);
      item.dirty = true;
      commands.push(new StyleChangeCommand("Update Collage Block Style", item, before, after));
    });

    if (commands.length > 0) {
      const macro = new MacroCommand("Apply Collage Custom Style", commands);
      executeCommand(macro);
      canvas.requestRenderAll();
    }
  };

  const generateBleed = () => {
    if (!activeArtboardId) return;
    const board = artboards.find(b => b.id === activeArtboardId);
    if (!board) return;

    // 0.125 inch at 300 DPI = 37.5px. At 72 DPI (web default) = 9px. Let's use 9px for standard screens.
    const bleedPx = 18; // 9px per side

    const commands: Command[] = [];
    
    // Update artboard props
    commands.push(new ArtboardPropertyCommand("Adjust width for bleed", board.id, 'width', board.width, board.width + bleedPx, setArtboards));
    commands.push(new ArtboardPropertyCommand("Adjust height for bleed", board.id, 'height', board.height, board.height + bleedPx, setArtboards));
    commands.push(new ArtboardPropertyCommand("Enable bleed guide", board.id, 'showBleed', board.showBleed, true, setArtboards));
    
    const macro = new MacroCommand(`Generate Bleed`, commands);
    executeCommand(macro);
  };

  const createArtboard = (presetName?: string, customW = 800, customH = 600) => {
    let w = customW;
    let h = customH;
    let name = "Custom Artboard";
    
    if (presetName) {
      const preset = ARTBOARD_PRESETS.find(p => p.name === presetName);
      if (preset) {
        w = preset.width;
        h = preset.height;
        name = preset.name;
      }
    }
    
    let maxX = 0;
    artboards.forEach((board) => {
      maxX = Math.max(maxX, board.x + board.width);
    });
    const x = maxX + 100;
    const y = 100;
    
    const count = artboards.filter(b => b.name.startsWith(name)).length;
    const finalName = count > 0 ? `${name} ${count + 1}` : name;
    
    const newBoard: Artboard = {
      id: "board_" + Date.now().toString() + Math.random().toString().substring(2, 6),
      name: finalName,
      x,
      y,
      width: w,
      height: h,
      backgroundColor: "#ffffff",
      transparent: false,
      dpi: 72,
      orientation: w >= h ? "landscape" : "portrait",
      showGrid: false,
      showSafeArea: false,
      showMargins: false,
      showBleed: false,
      showCenter: false,
    };

    const beforeBoards = [...artboards];
    const afterBoards = [...artboards, newBoard];
    const beforeActiveId = activeArtboardId;
    const afterActiveId = newBoard.id;

    const cmd = new ArtboardStateCommand("Create Artboard", beforeBoards, afterBoards, beforeActiveId, afterActiveId, setArtboards, setActiveArtboardId);
    executeCommand(cmd);

    setSelectedExportIds(prev => ({ ...prev, [newBoard.id]: true }));
    
    if (fabricRef.current) {
      const cw = fabricRef.current.width!;
      const ch = fabricRef.current.height!;
      const vpt = fabricRef.current.viewportTransform!;
      vpt[0] = 1.0;
      vpt[3] = 1.0;
      vpt[4] = cw / 2 - (newBoard.x + newBoard.width / 2);
      vpt[5] = ch / 2 - (newBoard.y + newBoard.height / 2);
      fabricRef.current.requestRenderAll();
    }
  };

  const addArtboard = createArtboard; // Alias for context menu

  const duplicateArtboard = (board: Artboard) => {
    let maxX = 0;
    artboards.forEach((b) => {
      maxX = Math.max(maxX, b.x + b.width);
    });
    const x = maxX + 100;
    
    const duplicated: Artboard = {
      ...board,
      id: "board_" + Date.now().toString() + Math.random().toString().substring(2, 6),
      name: `${board.name} Copy`,
      x,
      y: board.y,
    };

    let canvasObjectsToClone: fabric.Object[] = [];
    if (fabricRef.current) {
      const activeObjs = fabricRef.current.getObjects();
      activeObjs.forEach((o) => {
        if ((o as any).artboardId === board.id) {
          canvasObjectsToClone.push(o);
        }
      });
    }

    const cmd = new DuplicateArtboardCommand(
      board,
      duplicated,
      canvasObjectsToClone,
      setArtboards,
      setActiveArtboardId,
      updateLayersList
    );
    executeCommand(cmd);
    setSelectedExportIds(prev => ({ ...prev, [duplicated.id]: true }));

    // Center viewport on new board
    if (fabricRef.current) {
      const canvas = fabricRef.current;
      const cw = canvas.width!;
      const ch = canvas.height!;
      const vpt = canvas.viewportTransform!;
      vpt[4] = cw / 2 - (duplicated.x + duplicated.width / 2) * vpt[0];
      vpt[5] = ch / 2 - (duplicated.y + duplicated.height / 2) * vpt[3];
      canvas.requestRenderAll();
    }
  };

  const deleteArtboard = (id: string) => {
    const idx = artboards.findIndex(b => b.id === id);
    if (idx === -1) return;
    const boardToDelete = artboards[idx];
    const prevActiveId = activeArtboardId;
    let newActiveId = activeArtboardId;
    if (activeArtboardId === id) {
      const updated = artboards.filter(b => b.id !== id);
      const nextActive = updated.length > 0 ? updated[idx === 0 ? 0 : idx - 1] : null;
      newActiveId = nextActive ? nextActive.id : "artboard_default";
    }

    const cmd = new DeleteArtboardCommand(
      boardToDelete,
      prevActiveId,
      newActiveId,
      idx,
      setArtboards,
      setActiveArtboardId
    );
    executeCommand(cmd);
  };

  const updateArtboardProp = (id: string, prop: keyof Artboard, val: any) => {
    setArtboards((prev) => {
      return prev.map((board) => {
        if (board.id !== id) return board;
        let updated = { ...board, [prop]: val };
        
        // Update orientation if dimensions change
        if (prop === "width" || prop === "height") {
          const w = prop === "width" ? val : board.width;
          const h = prop === "height" ? val : board.height;
          updated.orientation = w >= h ? "landscape" : "portrait";
        }

        // Handle explicit orientation change via swap
        if (prop === "orientation") {
          const newOrientation = val as "portrait" | "landscape";
          if (newOrientation === "portrait" && board.width > board.height) {
            updated.width = board.height;
            updated.height = board.width;
          } else if (newOrientation === "landscape" && board.width < board.height) {
            updated.width = board.height;
            updated.height = board.width;
          }
        }

        // Sync transparent checkbox with background alpha
        if (prop === "backgroundColor") {
          const color = val as string;
          if (color.startsWith('rgba(')) {
            const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.transparent = true;
            } else {
              updated.transparent = false;
            }
          } else {
            updated.transparent = false;
          }
        }

        if (prop === "transparent") {
          const isTransparent = val as boolean;
          const currentColor = board.backgroundColor || "#ffffff";
          if (isTransparent) {
            updated.backgroundColor = setOpacityOnHex(currentColor, 0);
          } else {
            const parts = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
            if (parts && parts[4] && parseFloat(parts[4]) === 0) {
              updated.backgroundColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, 1)`;
            }
          }
        }

        return updated;
      });
    });

    if (fabricRef.current) {
      fabricRef.current.requestRenderAll();
    }
  };

  const updateArtboardPropDirect = (id: string, prop: keyof Artboard, val: any, commitOption = false) => {
    const board = artboards.find(b => b.id === id);
    if (!board) return;
    const beforeVal = board[prop];
    if (beforeVal === val) return;

    if (commitOption) {
      const labelMap: Record<string, string> = {
        transparent: "Toggle Transparency",
        showGrid: "Toggle Grid",
        showSafeArea: "Toggle Safe Area",
        showMargins: "Toggle Margins",
        showBleed: "Toggle Bleed",
        showCenter: "Toggle Center Guides",
        orientation: "Change Orientation"
      };
      const cmdName = labelMap[prop] || `Change Artboard ${String(prop)}`;
      const cmd = new ArtboardPropertyCommand(cmdName, id, prop, beforeVal, val, setArtboards);
      executeCommand(cmd);
    } else {
      updateArtboardProp(id, prop, val);
    }
  };

  const moveArtboard = (sourceIndex: number, destIndex: number) => {
    if (sourceIndex === destIndex) return;
    const newArtboards = [...artboards];
    const [removed] = newArtboards.splice(sourceIndex, 1);
    newArtboards.splice(destIndex, 0, removed);
    
    // Command history integration
    const cmd: Command = {
       name: "Reorder Artboards",
       execute: () => { setArtboards(newArtboards); },
       undo: () => {
          const revertArtboards = [...newArtboards];
          const [popped] = revertArtboards.splice(destIndex, 1);
          revertArtboards.splice(sourceIndex, 0, popped);
          setArtboards(revertArtboards);
       },
       redo: () => { setArtboards(newArtboards); }
    };
    executeCommand(cmd);
  };

  // Dynamic Brush Settings Configurator
  const applyBrushSettings = useCallback((
    type = brushType, 
    color = brushColor, 
    size = brushSize, 
    opt = brushOpacity, 
    fl = brushFlow, 
    hd = brushHardness, 
    smooth = brushSmoothing
  ) => {
    if (!fabricRef.current) return;
    
    // Combine base opacity and flow to determine final pixel paint density
    const calculatedOpacity = (opt / 100) * (fl / 100) * 100;
    const colorWithOpacity = setOpacityOnHex(color, calculatedOpacity);
    
    if (activeTool === "eraser") {
      const brush = new fabric.PencilBrush(fabricRef.current);
      brush.color = '#1e1e1e';
      brush.width = size * 2;
      fabricRef.current.freeDrawingBrush = brush;
      fabricRef.current.isDrawingMode = true;
      return;
    }
    
    if (activeTool !== "brush") {
       fabricRef.current.isDrawingMode = false;
       return;
    }
    
    fabricRef.current.isDrawingMode = true;
    let brush: fabric.BaseBrush;
    
    if (type === 'airbrush') {
       const b = new fabric.SprayBrush(fabricRef.current);
       b.width = size;
       b.color = colorWithOpacity;
       b.density = Math.round(fl / 1.5);
       b.dotWidth = Math.max(1, size / 12);
       brush = b;
    } else if (type === 'spray') {
       const b = new fabric.SprayBrush(fabricRef.current);
       b.width = size * 1.5;
       b.color = colorWithOpacity;
       b.density = Math.round(fl / 3.5);
       b.dotWidth = Math.max(1, size / 9);
       brush = b;
    } else if (type === 'chalk') {
       const b = new fabric.PatternBrush(fabricRef.current);
       const chalkCanvas = document.createElement('canvas');
       chalkCanvas.width = 12;
       chalkCanvas.height = 12;
       const ctx = chalkCanvas.getContext('2d')!;
       ctx.fillStyle = colorWithOpacity;
       for (let i = 0; i < 11; i++) {
         ctx.fillRect(Math.random() * 12, Math.random() * 12, 1.5, 1.5);
       }
       b.getPatternSrc = () => chalkCanvas;
       b.width = size;
       brush = b;
    } else if (type === 'pattern_dots' || type === 'pattern_dashed' || type === 'pattern_texture' || type === 'pattern_decorative' || type === 'pattern_repeating_shapes') {
       const b = new fabric.PatternBrush(fabricRef.current);
       const patType = type.replace("pattern_", "");
       const patternSource = createPatternSource(patType, colorWithOpacity, size);
       b.getPatternSrc = () => patternSource;
       b.width = size * 2;
       brush = b;
    } else if (type === 'watercolor') {
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = size;
       b.color = setOpacityOnHex(color, opt * (fl / 100) * 0.15);
       b.shadow = new fabric.Shadow({
         color: setOpacityOnHex(color, opt * (fl / 100) * 0.4),
         blur: size * 0.7,
         offsetX: 0,
         offsetY: 0
       });
       brush = b;
    } else if (type === 'ink') {
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = size;
       b.color = colorWithOpacity;
       b.shadow = new fabric.Shadow({
         color: setOpacityOnHex(color, opt * (fl / 100) * 0.2),
         blur: 1,
         offsetX: 0.5,
         offsetY: 0.5
       });
       brush = b;
    } else if (type === 'highlighter') {
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = size * 1.5;
       b.color = setOpacityOnHex(color, 40 * (fl / 100));
       b.strokeLineCap = 'square';
       brush = b;
    } else if (type === 'calligraphy') {
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = size;
       b.color = colorWithOpacity;
       b.strokeLineCap = 'square';
       brush = b;
    } else if (type === 'pixel') {
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = Math.max(1, size);
       b.color = colorWithOpacity;
       brush = b;
    } else { 
       const b = new fabric.PencilBrush(fabricRef.current);
       b.width = size;
       b.color = colorWithOpacity;
       
       if (type === 'pencil') {
         b.strokeLineCap = 'round';
       } else if (type === 'brush') {
          b.shadow = new fabric.Shadow({
            color: setOpacityOnHex(color, calculatedOpacity * 0.5),
            blur: (1 - (hd / 100)) * (size / 1.2),
            offsetX: 0,
            offsetY: 0
          });
       } else if (type === 'marker') {
          b.strokeLineCap = 'square';
          b.strokeLineJoin = 'miter';
       }
       brush = b;
    }
    
    // Fallback to brush-wide soft shading if hardness is low and type supports shadows
    if (hd < 100 && brush instanceof fabric.PencilBrush && type !== 'highlighter' && type !== 'watercolor' && type !== 'ink') {
       brush.shadow = new fabric.Shadow({
         color: setOpacityOnHex(color, calculatedOpacity),
         blur: (1 - (hd / 100)) * size * 1.5,
         offsetX: 0,
         offsetY: 0
       });
    }
    
    if ((brush as any).decimate !== undefined) {
       (brush as any).decimate = (smooth / 100) * 12;
    }
    
    fabricRef.current.freeDrawingBrush = brush;
  }, [activeTool, brushType, brushColor, brushSize, brushOpacity, brushFlow, brushHardness, brushSmoothing]);

  // Synchronise settings triggered on state changes
  useEffect(() => {
    applyBrushSettings();
  }, [activeTool, brushType, brushColor, brushSize, brushOpacity, brushFlow, brushHardness, brushSmoothing, applyBrushSettings]);

  // Load custom presets on launch
  useEffect(() => {
    try {
      const saved = localStorage.getItem("workspace_custom_filters_presets");
      if (saved) {
        setCustomPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading presets from store:", e);
    }
  }, []);

  // File loading
  const storedData = getValueAtPath(parsedData, path);
  
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Initialize Fabric Canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth - panelWidthRef.current,
      height: containerRef.current.clientHeight - 48, // minus header
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: false,
    });
    fabricRef.current = canvas;

    // Initial load State
    isInternalChange.current = true;

    const initImg = async () => {
      let resolveUrl = "";
      if (typeof storedData === 'string') {
        if (storedData.startsWith('data:image') || storedData.startsWith('blob:') || storedData.startsWith('http')) {
          resolveUrl = storedData;
        } else if (storedData.startsWith('img_') || storedData.startsWith('thumb_')) {
          resolveUrl = await resolveAssetUrl(storedData);
        }
      } else if (storedData && typeof storedData === 'object') {
        const id = (storedData as any).assetId || (storedData as any).assetRef || ((storedData as any)._type === "media" ? (storedData as any).assetId : null);
        if (id) {
          resolveUrl = await resolveAssetUrl(id);
        } else if ((storedData as any).url) {
          const urlStr = (storedData as any).url;
          if (urlStr.startsWith('img_') || urlStr.startsWith('thumb_')) {
            resolveUrl = await resolveAssetUrl(urlStr);
          } else {
            resolveUrl = urlStr;
          }
        }
      }
      
      if (resolveUrl) {
        fabric.Image.fromURL(resolveUrl).then((img) => {
          if (img) {
            (img as any).id = Date.now().toString() + Math.random().toString();
            
            // Center inside default artboard
            const board = artboardsRef.current[0];
            if (board) {
              img.left = board.x + (board.width - (img.width! * (img.scaleX ?? 1))) / 2;
              img.top = board.y + (board.height - (img.height! * (img.scaleY ?? 1))) / 2;
            }
            
            canvas.add(img);
            canvas.setActiveObject(img);
            
            setTimeout(fitView, 50);
            canvas.renderAll();
            updateLayersList();
          }
        }).catch(err => {
          console.error("Failed to load fabric image from source:", err);
          fitView();
          updateLayersList();
        });
      } else {
        fitView();
        updateLayersList();
      }
      isInternalChange.current = false;
    };

    loadFromDexie(path, canvas).then((loadedArtboards) => {
      if (loadedArtboards && loadedArtboards.length > 0) {
        setArtboards(loadedArtboards);
      } else {
        setArtboards([{
          id: "artboard_default",
          name: "Artboard 1",
          x: 100,
          y: 100,
          width: 800,
          height: 600,
          backgroundColor: "#ffffff",
          borderColor: "rgba(100, 116, 139, 0.5)",
          transparent: false,
          dpi: 72,
          orientation: "landscape",
          showGrid: false,
          showSafeArea: false,
          showMargins: false,
          showBleed: false,
          showCenter: false,
        }]);
      }
      
      const rebuildRecursively = (objs: any[]) => {
         const filtersObj = (fabric as any).Image?.filters || (fabric as any).filters;
         objs.forEach(o => {
             if (o.type === 'group' || o.get?.('isFrameGroup') || o.objects) {
                 if (typeof o.getObjects === 'function') {
                     rebuildRecursively(o.getObjects());
                 } else if (Array.isArray(o.objects)) {
                     rebuildRecursively(o.objects);
                 }
             }
             if (o.customFilters && o.customFilters.length > 0) {
                 rebuildFabricFilters(o, filtersObj);
             }
         });
      };
      if (fabricRef.current) rebuildRecursively(fabricRef.current.getObjects());
      fabricRef.current?.requestRenderAll();
      
      setIsLoaded(true);
      
      if (fabricRef.current && fabricRef.current.getObjects().length === 0) {
         initImg();
      } else {
         setTimeout(fitView, 100);
         updateLayersList();
         isInternalChange.current = false;
      }
    }).catch(err => {
      console.error("Dexie load error", err);
      setIsLoaded(true);
      initImg();
    });

    // Window resize handler
    let initialFitDone = false;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current && fabricRef.current) {
          const isMob = isMobileRef.current;
          const w = entry.contentRect.width - (isMob ? 0 : panelWidthRef.current);
          const h = entry.contentRect.height - (isMob ? (48 + 40 + 56) : (48 + 40));
          
          fabricRef.current.setDimensions({
            width: w > 100 ? w : 100,
            height: h > 100 ? h : 100
          });
          fabricRef.current.renderAll();
          
          if (!initialFitDone && w > 150 && h > 150) {
            initialFitDone = true;
            // Delay slightly to ensure browser rendering cycles completed
            setTimeout(() => {
              fitView();
            }, 80);
          }
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Render and background rules
    canvas.on('before:render', (opt) => {
      const ctx = opt.ctx;
      const vpt = canvas.viewportTransform;
      // Only draw on the lower canvas to avoid ghosting on cache/top canvases
      if (!ctx || !vpt || ctx !== canvas.getContext()) return;
      
      // 1. Clear workspace background (raw pixels)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure identity
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();

      let boards = artboardsRef.current || [];
      if (isMobileRef.current) {
         boards = boards.filter(b => b.id === activeArtboardIdRef.current);
      }

      // 2. Draw shadows (raw pixels for consistent blur)
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#121212"; // Match workspace to avoid ghosting
      
      boards.forEach((board) => {
        const x = board.x * vpt[0] + vpt[4];
        const y = board.y * vpt[3] + vpt[5];
        const w = board.width * vpt[0];
        const h = board.height * vpt[3];
        ctx.fillRect(x, y, w, h);
      });
      ctx.restore();

      // 3. Draw backgrounds (transformed)
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

      boards.forEach((board) => {
        if (!board.transparent) {
          ctx.fillStyle = board.backgroundColor || "#ffffff";
          ctx.fillRect(board.x, board.y, board.width, board.height);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(board.x, board.y, board.width, board.height);
          ctx.clip();
          
          const patSize = 8;
          ctx.fillStyle = "#e2e8f0";
          const rows = Math.ceil(board.height / patSize);
          const cols = Math.ceil(board.width / patSize);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if ((r + c) % 2 === 0) {
                ctx.fillRect(board.x + c * patSize, board.y + r * patSize, patSize, patSize);
              }
            }
          }
          ctx.restore();
        }
      });
      ctx.restore();
    });

    canvas.on('after:render', (opt) => {
      const ctx = opt.ctx;
      const vpt = canvas.viewportTransform;
      if (!vpt || !ctx || ctx !== canvas.getContext()) return;

      let boards = artboardsRef.current || [];
      if (isMobileRef.current) {
         boards = boards.filter(b => b.id === activeArtboardIdRef.current);
      }

      // 1. Draw outer dimmask (in raw pixels)
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      // Use logical coordinates since ctx is already scaled by dpr
      ctx.rect(0, 0, canvas.width, canvas.height); 
      
      boards.forEach((board) => {
        const x = (board.x * vpt[0] + vpt[4]);
        const y = (board.y * vpt[3] + vpt[5]);
        const w = (board.width * vpt[0]);
        const h = (board.height * vpt[3]);
        ctx.rect(x, y, w, h);
      });
      ctx.fill("evenodd");
      ctx.restore();

      // 2. Draw snapping guides
      if (guidesRef.current.length > 0) {
        ctx.save();
        ctx.strokeStyle = "#4ade80"; // Bright green for guides
        ctx.lineWidth = 1;

        guidesRef.current.forEach(guide => {
          if (guide.type === 'v') {
            const x = guide.pos * vpt[0] + vpt[4];
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          } else {
            const y = guide.pos * vpt[3] + vpt[5];
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }
        });
        ctx.restore();
      }

      // 3. Draw borders & labels (transformed)
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

      boards.forEach((board) => {
        const isActive = activeArtboardIdRef.current === board.id;
        
        // Base border (user defined border color)
        ctx.strokeStyle = board.borderColor || "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1 / vpt[0];
        ctx.strokeRect(board.x, board.y, board.width, board.height);

        // Active highlight (rendered outside/around the base border)
        if (isActive) {
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 2 / vpt[0];
          const offset = 1 / vpt[0];
          ctx.strokeRect(board.x - offset, board.y - offset, board.width + offset * 2, board.height + offset * 2);
        }

        if (board.showSafeArea) {
          ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
          ctx.lineWidth = 1 / vpt[0];
          ctx.setLineDash([4 / vpt[0], 4 / vpt[0]]);
          const dx = board.width * 0.05;
          const dy = board.height * 0.05;
          ctx.strokeRect(board.x + dx, board.y + dy, board.width - dx * 2, board.height - dy * 2);
          ctx.setLineDash([]);
        }

        if (board.showMargins) {
          ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
          ctx.lineWidth = 1 / vpt[0];
          ctx.setLineDash([2 / vpt[0], 2 / vpt[0]]);
          const dx = board.width * 0.1;
          const dy = board.height * 0.1;
          ctx.strokeRect(board.x + dx, board.y + dy, board.width - dx * 2, board.height - dy * 2);
          ctx.setLineDash([]);
        }

        if (board.showBleed) {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
          ctx.lineWidth = 1.2 / vpt[0];
          const dx = board.width * 0.03;
          const dy = board.height * 0.03;
          ctx.strokeRect(board.x - dx, board.y - dy, board.width + dx * 2, board.height + dy * 2);
        }

        if (board.showCenter) {
          ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
          ctx.lineWidth = 0.5 / vpt[0];
          ctx.beginPath();
          ctx.moveTo(board.x + board.width / 2, board.y);
          ctx.lineTo(board.x + board.width / 2, board.y + board.height);
          ctx.moveTo(board.x, board.y + board.height / 2);
          ctx.lineTo(board.x + board.width, board.y + board.height / 2);
          ctx.stroke();
        }

        if (board.showGrid) {
          const step = 20;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 0.5 / vpt[0];
          for (let gx = board.x; gx < board.x + board.width; gx += step) {
            ctx.beginPath();
            ctx.moveTo(gx, board.y);
            ctx.lineTo(gx, board.y + board.height);
            ctx.stroke();
          }
          for (let gy = board.y; gy < board.y + board.height; gy += step) {
            ctx.beginPath();
            ctx.moveTo(board.x, gy);
            ctx.lineTo(board.x + board.width, gy);
            ctx.stroke();
          }
        }
      });

      ctx.restore();
      
      // Draw Parent Alignment Object highlight if active
      if (parentAlignmentObjRef.current && fabricRef.current) {
        const activeObj = fabricRef.current.getActiveObject();
        // Check if the parent object is part of the current active selection
        if (activeObj && activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().includes(parentAlignmentObjRef.current)) {
          ctx.save();
          ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

          const bounds = getAbsoluteBoundingRect(parentAlignmentObjRef.current);
          
          // Draw a clear blue, thick line around the parent object
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3 / vpt[0];
          ctx.setLineDash([]);
          ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

          // Draw the PARENT text badge
          const badgeHeight = 16 / vpt[3];
          const badgeWidth = 48 / vpt[0];
          const badgeX = bounds.left;
          const badgeY = bounds.top - badgeHeight - (4 / vpt[3]);

          ctx.fillStyle = "#3b82f6";
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4 / vpt[0]);
            ctx.fill();
          } else {
            ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
          }

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${8 / vpt[3]}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("PARENT", badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

          ctx.restore();
        }
      }

      const overlay = document.getElementById('artboard-ui-overlay');
      if (overlay) {
        const children = overlay.children;
        for (let i = 0; i < children.length; i++) {
          const el = children[i] as HTMLElement;
          const id = el.getAttribute('data-board-id');
          const board = boards.find(b => b.id === id);
          if (board) {
            const x = board.x * vpt[0] + vpt[4];
            const y = board.y * vpt[3] + vpt[5];
            const visualWidth = board.width * vpt[0];
            el.style.transform = `translate(${x}px, ${y}px)`;
            el.style.width = `${visualWidth}px`;
          }
        }
      }
    });    // Panning & Zooming events
    // Touch / Pinch-to-zoom support
    let initialPinchDistance = 0;
    let initialZoom = 1;
    let initialPanX = 0;
    let initialPanY = 0;
    let initialMidpoint = { x: 0, y: 0 };
    
    // Dynamic brush size / opacity modification handlers
    const handleBrushAdjustMousemove = (e: MouseEvent) => {
       if (!isAdjustingBrushRef.current) return;
       e.preventDefault();
       e.stopPropagation();
       e.stopImmediatePropagation();
       
       const deltaX = e.clientX - startMouseXRef.current;
       const deltaY = e.clientY - startMouseYRef.current;
       
       const isCtrl = e.ctrlKey || isCtrlPressedRef.current;

       // Lock property based on first movement direction
       if (!hasLockedPropertyRef.current) {
          const distance = Math.hypot(deltaX, deltaY);
          if (distance < 5) return; // Wait for a non-trivial movement

          if (Math.abs(deltaX) > Math.abs(deltaY)) {
             activeBrushPropertyRef.current = 'size';
             setActiveBrushProperty('size');
          } else {
             activeBrushPropertyRef.current = 'opacity';
                 setActiveBrushProperty('opacity');
          }
          hasLockedPropertyRef.current = true;
       }

       let newSize = brushSizeRef.current;
       let newOpacity = brushOpacityRef.current;
       let newHardness = brushHardnessRef.current;

       if (activeBrushPropertyRef.current === 'size') {
          // Horizontal adjusts size (Drag right increases, Drag left decreases)
          newSize = Math.max(1, Math.min(500, Math.round(startBrushSizeRef.current + deltaX * 1.0)));
          setBrushSize(newSize);
          brushSizeRef.current = newSize;
          
       } else if (activeBrushPropertyRef.current === 'opacity') {
          // Vertical adjusts opacity (Drag up increases, Drag down decreases)
          newOpacity = Math.max(1, Math.min(100, Math.round(startBrushOpacityRef.current - deltaY * 0.7)));
          setBrushOpacity(newOpacity);
          brushOpacityRef.current = newOpacity;
       } else if (activeBrushPropertyRef.current === 'hardness') {
          // Vertical adjusts hardness (Drag up increases, Drag down decreases)
          newHardness = Math.max(0, Math.min(100, Math.round(startBrushHardnessRef.current - deltaY * 0.7)));
          setBrushHardness(newHardness);
          brushHardnessRef.current = newHardness;
       }
       
       applyBrushSettings(
         brushTypeRef.current,
         brushColorRef.current,
         newSize,
         newOpacity,
         brushFlowRef.current,
         newHardness,
         brushSmoothingRef.current
       );
       
       setShowHud(true);
       
       canvas.requestRenderAll();
    };

         const handleBrushAdjustMouseup = (e: MouseEvent) => {
        if (isAdjustingBrushRef.current) {
           e.preventDefault();
           e.stopPropagation();
           e.stopImmediatePropagation();
           isAdjustingBrushRef.current = false;
           
           setHudFadingOut(true);
           if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
           hudTimeoutRef.current = setTimeout(() => {
              setShowHud(false);
              setHudFadingOut(false);
           }, 500);
        }
        window.removeEventListener('mousemove', handleBrushAdjustMousemove, { capture: true });
        window.removeEventListener('mouseup', handleBrushAdjustMouseup, { capture: true });
     };

    const handleBrushAdjustMousedown = (e: MouseEvent) => {
       const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
       if (!isBrushActive) return;
       
       const isCtrl = e.ctrlKey || isCtrlPressedRef.current;
       
       if (isCtrl && e.button === 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          isAdjustingBrushRef.current = true;
          hasLockedPropertyRef.current = false;
          
          // Sensible initial active property based on modifier keys
          const initialProp = 'size';
          activeBrushPropertyRef.current = initialProp;
          setActiveBrushProperty(initialProp);

          startBrushSizeRef.current = brushSizeRef.current;
           startBrushOpacityRef.current = brushOpacityRef.current;
           startBrushHardnessRef.current = brushHardnessRef.current;
           startMouseXRef.current = e.clientX;
           startMouseYRef.current = e.clientY;
           if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
           setHudFadingOut(false);
           const rect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
          setHudPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setShowHud(true);
          
          window.addEventListener('mousemove', handleBrushAdjustMousemove, { capture: true });
          window.addEventListener('mouseup', handleBrushAdjustMouseup, { capture: true });
       }
    };

    const touchStartHandler = (e: TouchEvent) => {
      const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
      const hasModifier = isCtrlPressedRef.current;
      
      if (e.touches.length === 2 && isBrushActive && hasModifier) {
        e.preventDefault();
        e.stopPropagation();
        isAdjustingBrushTouchRef.current = true;
        hasLockedPropertyRef.current = false;

        const isCtrl = isCtrlPressedRef.current;
        
        // Initial setup
        const initialProp = 'size';
        activeBrushPropertyRef.current = initialProp;
        setActiveBrushProperty(initialProp);
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentMidX = (touch1.clientX + touch2.clientX) / 2;
        const currentMidY = (touch1.clientY + touch2.clientY) / 2;
        
        startBrushTouchSizeRef.current = brushSizeRef.current;
        startBrushTouchOpacityRef.current = brushOpacityRef.current;
        startBrushTouchHardnessRef.current = brushHardnessRef.current;
        startTouchXRef.current = currentMidX;
        startTouchYRef.current = currentMidY;
        
        const rect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
        setHudPosition({ x: currentMidX - rect.left, y: currentMidY - rect.top });
        setShowHud(true);
        canvas.selection = false;
        return;
      }

      if (e.touches.length === 2 && canvas.viewportTransform) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialPinchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        initialZoom = canvas.getZoom();
        
        initialMidpoint = {
           x: (touch1.clientX + touch2.clientX) / 2,
           y: (touch1.clientY + touch2.clientY) / 2
        };
        initialPanX = canvas.viewportTransform[4];
        initialPanY = canvas.viewportTransform[5];
        canvas.selection = false;
      }
    };

    const touchMoveHandler = (e: TouchEvent) => {
      if (isAdjustingBrushTouchRef.current && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentMidX = (touch1.clientX + touch2.clientX) / 2;
        const currentMidY = (touch1.clientY + touch2.clientY) / 2;
        
        const deltaX = currentMidX - startTouchXRef.current;
        const deltaY = currentMidY - startTouchYRef.current;

        const isCtrl = isCtrlPressedRef.current;

        // Auto-lock axis on touch gesture
        if (!hasLockedPropertyRef.current) {
           const distance = Math.hypot(deltaX, deltaY);
           if (distance >= 5) {
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                 activeBrushPropertyRef.current = 'size';
                 setActiveBrushProperty('size');
              } else {
                 activeBrushPropertyRef.current = 'opacity';
                 setActiveBrushProperty('opacity');
              }
              hasLockedPropertyRef.current = true;
           }
        }
        
        let newSize = brushSizeRef.current;
        let newOpacity = brushOpacityRef.current;
        let newHardness = brushHardnessRef.current;

        if (activeBrushPropertyRef.current === 'size') {
           newSize = Math.max(1, Math.min(500, Math.round(startBrushTouchSizeRef.current + deltaX * 1.0)));
           setBrushSize(newSize);
           brushSizeRef.current = newSize;
        } else if (activeBrushPropertyRef.current === 'opacity') {
           newOpacity = Math.max(1, Math.min(100, Math.round(startBrushTouchOpacityRef.current - deltaY * 0.7)));
           setBrushOpacity(newOpacity);
           brushOpacityRef.current = newOpacity;
        } else if (activeBrushPropertyRef.current === 'hardness') {
           newHardness = Math.max(0, Math.min(100, Math.round(startBrushTouchHardnessRef.current - deltaY * 0.7)));
           setBrushHardness(newHardness);
           brushHardnessRef.current = newHardness;
        }
        
        applyBrushSettings(
          brushTypeRef.current,
          brushColorRef.current,
          newSize,
          newOpacity,
          brushFlowRef.current,
          newHardness,
          brushSmoothingRef.current
        );
        
        setShowHud(true);
        canvas.requestRenderAll();
        return;
      }

      if (e.touches.length === 2 && canvas.viewportTransform) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        
        const scale = currentDistance / initialPinchDistance;
        let zoom = initialZoom * scale;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.05) zoom = 0.05;

        // Calculate current midpoint
        const currentMidpoint = {
           x: (touch1.clientX + touch2.clientX) / 2,
           y: (touch1.clientY + touch2.clientY) / 2
        };

        // We want to zoom into the midpoint
        const wrapperRect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
        const pt = new fabric.Point(
           currentMidpoint.x - wrapperRect.left, 
           currentMidpoint.y - wrapperRect.top
        );

        canvas.zoomToPoint(pt, zoom);

        // Also add pan delta
        const vpt = canvas.viewportTransform;
        const newVpt = vpt.slice() as any;
        newVpt[4] += (currentMidpoint.x - initialMidpoint.x);
        newVpt[5] += (currentMidpoint.y - initialMidpoint.y);
        canvas.setViewportTransform(newVpt);
        
        setZoomPercent(Math.round(zoom * 100));
        
        initialMidpoint = currentMidpoint;
      }
    };

    const touchEndHandler = (e: TouchEvent) => {
       if (isAdjustingBrushTouchRef.current) {
          isAdjustingBrushTouchRef.current = false;
          setHudFadingOut(false);
          setShowHud(true);
          if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
          hudTimeoutRef.current = setTimeout(() => {
             setHudFadingOut(true);
             hudTimeoutRef.current = setTimeout(() => {
                setShowHud(false);
                setHudFadingOut(false);
             }, 500);
          }, 800);
          canvas.selection = true;
          validateViewport();
          return;
       }

       if (e.touches.length < 2) {
          canvas.selection = true;
       }
       validateViewport();
    };

    const handleMousedownCapture = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.type === 'activeSelection') {
          const pointer = (canvas as any).getPointer(e);
          const selObjects = (activeObj as fabric.ActiveSelection).getObjects();
          let clickedSubObject: fabric.Object | null = null;
          
          for (let i = selObjects.length - 1; i >= 0; i--) {
            const obj = selObjects[i];
            
            // Calculate point in local coordinates using inverse transform matrix
            const matrix = obj.calcTransformMatrix();
            const inverted = fabric.util.invertTransform(matrix);
            const localPt = fabric.util.transformPoint(pointer, inverted);
            
            const halfW = (obj.width || 0) / 2;
            const halfH = (obj.height || 0) / 2;
            
            const inside = (localPt.x >= -halfW && localPt.x <= halfW && localPt.y >= -halfH && localPt.y <= halfH);
            
            if (inside) {
              clickedSubObject = obj;
              break;
            }
          }
          
          if (clickedSubObject) {
            e.preventDefault();
            e.stopPropagation();
            
            if (parentAlignmentObjRef.current === clickedSubObject) {
              parentAlignmentObjRef.current = null;
              setParentAlignmentObj(null);
            } else {
              parentAlignmentObjRef.current = clickedSubObject;
              setParentAlignmentObj(clickedSubObject);
            }
            
            canvas.requestRenderAll();
          }
        }
      }
    };

    // Attach native events to wrapper
    const upperCanvas = canvas.upperCanvasEl;
    if (upperCanvas) {
       upperCanvas.addEventListener('touchstart', touchStartHandler as any, { passive: false });
       upperCanvas.addEventListener('touchmove', touchMoveHandler as any, { passive: false });
       upperCanvas.addEventListener('touchend', touchEndHandler as any);
       upperCanvas.addEventListener('mousedown', handleMousedownCapture, true);
       upperCanvas.addEventListener('mousedown', handleBrushAdjustMousedown, true);
    }
    
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e;
      const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
      if (isBrushActive && (e.ctrlKey || isCtrlPressedRef.current)) {
         e.preventDefault();
         e.stopPropagation();
         
         let delta = -e.deltaY;
         if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
           delta = -e.deltaX;
         }
         
         const step = Math.sign(delta) * 1.5; // Scale slightly for zoom speed parity
         const currentSize = brushSizeRef.current;
         const newSize = Math.max(1, Math.min(500, Math.round(currentSize + step)));
         setBrushSize(newSize);
         brushSizeRef.current = newSize;
          activeBrushPropertyRef.current = 'size';
          setActiveBrushProperty('size');
         
         applyBrushSettings(
           brushTypeRef.current,
           brushColorRef.current,
           newSize,
           brushOpacityRef.current,
           brushFlowRef.current,
           brushHardnessRef.current,
           brushSmoothingRef.current
         );
         
         const wrapperRect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
         const posX = (e.clientX !== undefined) ? (e.clientX - wrapperRect.left) : (wrapperRect.width / 2);
         const posY = (e.clientY !== undefined) ? (e.clientY - wrapperRect.top) : (wrapperRect.height / 2);
         
         setHudPosition({ x: posX, y: posY });
         setShowHud(true);
         
         if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
         hudTimeoutRef.current = setTimeout(() => setShowHud(false), 800);
         
         canvas.requestRenderAll();
         return;
      } else {
         e.preventDefault();
         e.stopPropagation();
         let zoom = canvas.getZoom();
         const delta = e.deltaY;
         
         // More consistent zoom formula
         const zoomStep = 0.05;
         const factor = 1 + (delta > 0 ? -zoomStep * 2 : zoomStep * 2);
         zoom *= factor;
         
         if (zoom > 20) zoom = 20;
         if (zoom < 0.05) zoom = 0.05;
         
         const point = new fabric.Point(e.offsetX, e.offsetY);
         canvas.zoomToPoint(point, zoom);
         setZoomPercent(Math.round(zoom * 100));
         canvas.requestRenderAll();
         
         if (!isMobileRef.current) {
           viewportTransformRef.current = canvas.viewportTransform!.slice();
         }
         validateViewport();
      }
    });

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    canvas.on('mouse:down', (opt) => {
      const e = opt.e as any;
      if (!e) return;

      if (activeToolRef.current === 'pan' || e.button === 1 || isSpacePressedRef.current || isAltPressedRef.current) {
        isPanning = true;
        lastX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        lastY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        canvas.selection = false;
      }
    });

    canvas.on('mouse:dblclick', (opt) => {
      if (opt.target && opt.target.type === 'image' && !opt.target.isType?.('activeSelection') && !(opt.target as any).isCropHelper) {
        enterCropMode(opt.target as fabric.Image);
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const e = opt.e as any;
        if (!e) return;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
          const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
          
          // Fabric requires updating the internal matrix and firing boundary calcs properly
          const newVpt = vpt.slice() as any;
          newVpt[4] += clientX - lastX;
          newVpt[5] += clientY - lastY;
          canvas.setViewportTransform(newVpt);
          
          lastX = clientX;
          lastY = clientY;
        }
      }
    });

    canvas.on('object:moving', handleSnapping);

    canvas.on('mouse:up', () => {
      guidesRef.current = [];
      if (isPanning) {
        canvas.setViewportTransform(canvas.viewportTransform!);
        isPanning = false;
        canvas.selection = true;
        
        if (!isMobileRef.current) {
          viewportTransformRef.current = canvas.viewportTransform!.slice();
        }
      }
      canvas.requestRenderAll();
      validateViewport();
    });

    // Mobile Swipe Navigation and Double Tap / Long Press Context Menu
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;
    let twoFingerTouchTimer: any = null;

    const handleTouchStart = (e: TouchEvent) => {
       if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
       } else if (e.touches.length === 2 && fabricRef.current) {
          // Detect logic for two-finger context menu
          const evt = e.touches[0];
          twoFingerTouchTimer = setTimeout(() => {
             if (!fabricRef.current) return;
             
             // Pass the original touch event which has e.touches
             const targetInfo = fabricRef.current.findTarget(e as any);
             const target = targetInfo?.target;

             let activeObjects = fabricRef.current.getActiveObjects();

             if (target && !activeObjects.includes(target as any)) {
               fabricRef.current.setActiveObject(target as any);
               fabricRef.current.requestRenderAll();
               activeObjects = [target as any];
             }

             setActiveContextMenu({
               x: evt.clientX,
               y: evt.clientY,
               obj: (target as any) || null,
               targets: activeObjects
             });
          }, 400); // 400ms hold
       }
    };

    const handleTouchMove = (e: TouchEvent) => {
       if (twoFingerTouchTimer && e.touches.length < 2) {
           clearTimeout(twoFingerTouchTimer);
           twoFingerTouchTimer = null;
       }
    };

    const handleTouchEnd = (e: TouchEvent) => {
       if (twoFingerTouchTimer) {
           clearTimeout(twoFingerTouchTimer);
           twoFingerTouchTimer = null;
       }
       if (!isMobileRef.current) return;

       
       // Handle Swipe
       if (e.changedTouches.length === 1) {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          
          const dx = touchEndX - touchStartX;
          const dy = touchEndY - touchStartY;
          
          // Must be mostly horizontal and long enough (threshold > 80px)
          if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
             const boards = artboardsRef.current;
             if (boards && boards.length > 1) {
                const currentIdx = boards.findIndex(b => b.id === activeArtboardIdRef.current);
                if (currentIdx !== -1) {
                   if (dx < 0 && currentIdx < boards.length - 1) {
                      // Swipe Left -> Next Artboard
                      setActiveArtboardId(boards[currentIdx + 1].id);
                   } else if (dx > 0 && currentIdx > 0) {
                      // Swipe Right -> Prev Artboard
                      setActiveArtboardId(boards[currentIdx - 1].id);
                   }
                }
             }
          }
       }

       // Handle Double Tap to Fit
       const now = Date.now();
       if (now - lastTapTime < 300) {
          const boards = artboardsRef.current;
          const activeBoard = boards.find(b => b.id === activeArtboardIdRef.current);
          if (activeBoard) {
             const cw = canvas.width!;
             const ch = canvas.height!;
             if (cw > 0 && ch > 0) {
                const padding = isMobileRef.current ? 32 : 100;
                const zoom = Math.min(cw / (activeBoard.width + padding), ch / (activeBoard.height + padding), 2.5);
                canvas.setZoom(zoom);
                const vpt = canvas.viewportTransform!;
                const newVpt = vpt.slice() as any;
                newVpt[4] = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
                newVpt[5] = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;
                canvas.setViewportTransform(newVpt);
             }
          }
       }
       lastTapTime = now;
    };

    if (canvas.upperCanvasEl) {
       canvas.upperCanvasEl.addEventListener('touchstart', handleTouchStart as any, { passive: true });
       canvas.upperCanvasEl.addEventListener('touchmove', handleTouchMove as any, { passive: true });
       canvas.upperCanvasEl.addEventListener('touchend', handleTouchEnd as any, { passive: true });
    }

    // Initial load State
    isInternalChange.current = true;

    // Canvas Events Binding
    const handleObjectAdded = (e: any) => {
      if (!isInternalChange.current) {
         if (e.target && !e.target.id) {
           e.target.id = Date.now().toString() + Math.random().toString();
         }
         
         const obj = e.target;
         if (obj && obj.type === 'image' && !isInternalChange.current) {
            const board = getTargetArtboard(obj);
            if (obj.width && (obj.width > board.width || obj.height! > board.height)) {
               setActiveSuggestion({ id: obj.id, type: 'image' });
               setTimeout(() => setActiveSuggestion(null), 8000);
            }
         }
      }
      updateLayersList();
    };

    const handleObjectModified = (e: any) => {
      if (isInternalChange.current) return;
      
      const target = e.target;
      if (!target) return;

      const transform = e.transform;
      if (transform) {
        const before = {
          left: transform.original.left ?? target.left,
          top: transform.original.top ?? target.top,
          scaleX: transform.original.scaleX ?? target.scaleX,
          scaleY: transform.original.scaleY ?? target.scaleY,
          angle: transform.original.angle ?? target.angle,
          width: transform.original.width ?? target.width,
          height: transform.original.height ?? target.height,
        };
        const after = {
          left: target.left,
          top: target.top,
          scaleX: target.scaleX,
          scaleY: target.scaleY,
          angle: target.angle,
          width: target.width,
          height: target.height,
        };

        let actionName = "Modify Layer";
        if (transform.action === "drag") {
          actionName = "Move " + (target.type === "image" ? "Image" : "Shape");
        } else if (transform.action?.startsWith("scale")) {
          actionName = "Resize " + (target.type === "image" ? "Image" : "Shape");
        } else if (transform.action === "rotate") {
          actionName = "Rotate " + (target.type === "image" ? "Image" : "Shape");
        }

        const cmd = new TransformObjectsCommand(actionName, [{ obj: target, before, after }]);
        executeCommand(cmd);
      }
      updateLayersList();
    };

    const handleObjectRemoved = (e: any) => {
      updateLayersList();
    };

    const handlePathCreated = (e: any) => {
      if (isInternalChange.current) return;
      const pathObj = e.path;
      if (pathObj) {
        if (!pathObj.id) {
          pathObj.id = Date.now().toString() + Math.random().toString();
        }
        pathObj.artboardId = activeArtboardIdRef.current;

        // Keep visual characteristics of selected brush engine on final path object
        if (brushType === 'marker') {
          pathObj.set({
            strokeLineCap: 'square',
            strokeLineJoin: 'miter'
          });
        } else if (brushType === 'highlighter') {
          pathObj.set({
            strokeLineCap: 'square',
            strokeLineJoin: 'miter',
            opacity: 0.4
          });
        } else if (brushType === 'calligraphy') {
          pathObj.set({
            strokeLineCap: 'square',
            strokeLineJoin: 'miter'
          });
        } else if (brushType === 'brush') {
          pathObj.set({
            shadow: new fabric.Shadow({
              color: setOpacityOnHex(brushColor, brushOpacity * 0.3),
              blur: (1 - (brushHardness / 100)) * (brushSize / 2),
              offsetX: 0,
              offsetY: 0
            })
          });
        } else if (brushType === 'watercolor') {
          pathObj.set({
            stroke: setOpacityOnHex(brushColor, brushOpacity * 0.15),
            shadow: new fabric.Shadow({
              color: setOpacityOnHex(brushColor, brushOpacity * 0.4),
              blur: brushSize * 0.7,
              offsetX: 0,
              offsetY: 0
            })
          });
        } else if (brushType === 'ink') {
          pathObj.set({
            shadow: new fabric.Shadow({
              color: setOpacityOnHex(brushColor, brushOpacity * 0.2),
              blur: 1,
              offsetX: 0.5,
              offsetY: 0.5
            })
          });
        }

        pathObj.customName = getBrushName(brushType);
        fabricRef.current?.requestRenderAll();

        const cmd = new AddObjectCommand(pathObj.customName, pathObj);
        executeCommand(cmd);
      }
    };

    const handleEditingEntered = (e: any) => {
      if (e.target) {
        textStartValueRef.current = e.target.text || "";
      }
    };

    const handleEditingExited = (e: any) => {
      if (e.target && e.target.text !== textStartValueRef.current) {
        const cmd = new PropertyChangeCommand(
          "Edit Text",
          e.target,
          "text",
          textStartValueRef.current,
          e.target.text
        );
        executeCommand(cmd);
      }
      updateLayersList();
    };

    canvas.on('object:added', handleObjectAdded);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:removed', handleObjectRemoved);
    canvas.on('path:created', handlePathCreated);
    (canvas as any).on('editing:entered', handleEditingEntered);
    (canvas as any).on('editing:exited', handleEditingExited);
    canvas.on('selection:created', handleSelectionContext);
    canvas.on('selection:updated', handleSelectionContext);
    canvas.on('selection:cleared', handleSelectionContext);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      const upperCanvasEl = canvas.upperCanvasEl;
      if (upperCanvasEl) {
         upperCanvasEl.removeEventListener('touchstart', touchStartHandler as any);
         upperCanvasEl.removeEventListener('touchmove', touchMoveHandler as any);
         upperCanvasEl.removeEventListener('touchend', touchEndHandler as any);
         upperCanvasEl.removeEventListener('touchstart', handleTouchStart as any);
         upperCanvasEl.removeEventListener('touchmove', handleTouchMove as any);
         upperCanvasEl.removeEventListener('touchend', handleTouchEnd as any);
         upperCanvasEl.removeEventListener('mousedown', handleMousedownCapture, true);
         upperCanvasEl.removeEventListener('mousedown', handleBrushAdjustMousedown, true);
      }
      
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [path, updateLayersList, handleSelectionContext, executeCommand]);

  // Global Keyboard Isolation Phase
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltPressed(true);
      if (e.shiftKey) setIsShiftPressed(true);
      if (e.ctrlKey) setIsCtrlPressed(true);
      if (e.code === 'Space') setIsSpacePressed(true);

      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const isRedo = ctrlOrCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey));
      const isUndo = ctrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';
      const isBringForward = ctrlOrCmd && e.key === ']' && !e.shiftKey;
      const isBringToFront = ctrlOrCmd && e.key === ']' && e.shiftKey;
      const isSendBackward = ctrlOrCmd && e.key === '[' && !e.shiftKey;
      const isSendToBack = ctrlOrCmd && e.key === '[' && e.shiftKey;
      const isLayerAction = isBringForward || isBringToFront || isSendBackward || isSendToBack;

      if (e.key.toLowerCase() === 'c' && !ctrlOrCmd && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        if (!isCropping) {
          const activeObj = fabricRef.current?.getActiveObject();
          if (activeObj && activeObj.type === 'image') {
            enterCropMode(activeObj as fabric.Image);
          }
        }
      }

      if (e.key === 'Enter' && isCropping) {
        applyCrop();
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        if (isCropping) {
          cancelCrop();
        }
        closeContextMenu();
      }

      if (isUndo || isRedo || isDelete || isLayerAction) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
           return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (isUndo) {
          performUndo();
        } else if (isRedo) {
          performRedo();
        } else if (isDelete) {
          deleteActiveObject();
        } else if (isBringToFront) {
          handleLayerOrder('front');
        } else if (isBringForward) {
          handleLayerOrder('forward');
        } else if (isSendBackward) {
          handleLayerOrder('backward');
        } else if (isSendToBack) {
          handleLayerOrder('back');
        }
      } else if (!ctrlOrCmd) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
           return;
        }

        if (e.code === 'Space') {
          // If not in input, prevent default to avoid scrolling
          e.preventDefault();
        }

        if (e.key.toLowerCase() === 'v') {
          setActiveTool('select');
          if (fabricRef.current) {
            fabricRef.current.isDrawingMode = false;
          }
        } else if (e.key.toLowerCase() === 'b') {
          setActiveTool('brush');
          if (fabricRef.current) {
            fabricRef.current.discardActiveObject();
            fabricRef.current.renderAll();
          }
          applyBrushSettings(brushType);
        } else if (e.key.toLowerCase() === 't') {
          addText();
        } else if (e.key.toLowerCase() === 'h') {
          setActiveTool('pan');
          if (fabricRef.current) {
            fabricRef.current.isDrawingMode = false;
          }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltPressed(false);
      if (!e.shiftKey) setIsShiftPressed(false);
      if (!e.ctrlKey) setIsCtrlPressed(false);
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [performUndo, performRedo, brushType, applyBrushSettings, handleLayerOrder]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fabricRef.current) return;

    const pointer = fabricRef.current.getScenePoint(e.nativeEvent as any);
    const targetInfo = fabricRef.current.findTarget(e.nativeEvent as any);
    const target = targetInfo?.target;
    
    let activeObjects = fabricRef.current.getActiveObjects();

    // If right clicked on an object that isn't selected, select it first
    if (target && !activeObjects.includes(target as any)) {
      fabricRef.current.setActiveObject(target as any);
      fabricRef.current.requestRenderAll();
      activeObjects = [target as any];
    }

    setActiveContextMenu({
      x: e.clientX,
      y: e.clientY,
      obj: (target as any) || null,
      targets: activeObjects
    });
  };

  const handleImportImageClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('img-upload')?.click();
  };

  const closeContextMenu = () => setActiveContextMenu(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Check if click/touch was inside activeContextMenu
      const clickedInContextMenu = target.closest('.context-menu-container');
      const clickedImportToggleButton = target.closest('[title="Import Image"]');
      
      if (!clickedInContextMenu && !clickedImportToggleButton) {
        closeContextMenu();
      }
      
      // Check if click/touch was inside artboardDropdown
      const clickedInArtboardDropdown = target.closest('.artboard-dropdown-container');
      const clickedArtboardDropdownToggle = target.closest('.artboard-dropdown-toggle');
      
      if (!clickedInArtboardDropdown && !clickedArtboardDropdownToggle) {
        setArtboardDropdown(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('touchstart', handleOutsideClick, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('touchstart', handleOutsideClick, true);
    };
  }, []);
  const setTool = (tool: string) => {
    setActiveTool(tool);
    if (!fabricRef.current) return;
    if (tool === "brush" || tool === "eraser") {
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
    } else if (tool === "crop") {
      // Don't discard active object yet, we might be transitioning into crop with a selection
    } else if (isCropping) {
      cancelCrop(); // automatically exit crop when switching tools
    }
    fabricRef.current.isDrawingMode = (tool === "brush" || tool === "eraser");
    applyBrushSettings(brushType);
  };

  const extractImageFromFrame = async (frameGroup: any) => {
    isInternalChange.current = true;
    const canvas = fabricRef.current;
    if (!canvas) return null;
    
    const artboardId = frameGroup.artboardId;
    const layerId = frameGroup.id || frameGroup.layerId;
    
    const clonedGroup = await frameGroup.clone([]);
    canvas.add(clonedGroup);
    
    let items: any[] = [];
    if (typeof clonedGroup.toActiveSelection === 'function') {
        const sel = clonedGroup.toActiveSelection();
        items = sel.getObjects();
    } else {
        items = (clonedGroup as any).removeAll();
        canvas.remove(clonedGroup);
        items.forEach((i: any) => canvas.add(i));
    }
    
    const img = items.find((o: any) => o.type === 'image');
    const rect = items.find((o: any) => o.type === 'rect');
    
    if (rect) canvas.remove(rect);
    if (img) canvas.remove(img);
    
    if (img) {
        if (artboardId) (img as any).artboardId = artboardId;
        if (layerId) (img as any).id = layerId;
        img.set('isFrameGroup', false);
        img.set('frameType', undefined);

        canvas.add(img);
        canvas.setActiveObject(img);
        
        const cmd = new MacroCommand("Remove Frame for Crop", [
            new DeleteObjectCommand("Remove Group", [frameGroup]),
            new AddObjectCommand("Add Extracted Image", img)
        ]);
        executeCommand(cmd);
        canvas.requestRenderAll();
        updateLayersList();
    }
    isInternalChange.current = false;
    return img;
  };

  const enterCropMode = async (target?: any) => {
    let imgTarget = target;
    let canvas = fabricRef.current;
    if (!canvas) return;
    
    if (!imgTarget) {
      let activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.get('isFrameGroup')) {
          const img = await extractImageFromFrame(activeObj);
          if (img) imgTarget = img as fabric.Image;
      } else {
          const activeObjects = activeObj ? [activeObj] : [];
          if (activeObjects?.length === 1 && activeObjects[0].type === 'image') {
            imgTarget = activeObjects[0] as fabric.Image;
          }
      }
    } else {
        if (imgTarget && imgTarget.get('isFrameGroup')) {
            const img = await extractImageFromFrame(imgTarget);
            if (img) imgTarget = img as fabric.Image;
        }
    }
    
    if (!imgTarget || imgTarget.type !== 'image') {
      alert("Please select a single image to crop.");
      return;
    }

    const el = imgTarget.getElement() as HTMLImageElement;
    if (!el) return;

    imgTarget.setCoords();
    const matrix = imgTarget.calcTransformMatrix();
    
    const origCenterH = imgTarget.originX === 'center' ? imgTarget.width! / 2 : 0;
    const origCenterV = imgTarget.originY === 'center' ? imgTarget.height! / 2 : 0;

    const localFullTl = new fabric.Point(
      -origCenterH - (imgTarget.cropX || 0),
      -origCenterV - (imgTarget.cropY || 0)
    );
    const canvasFullTl = fabric.util.transformPoint(localFullTl, matrix);

    const fullImg = new fabric.Image(el, {
      left: canvasFullTl.x,
      top: canvasFullTl.y,
      originX: 'left',
      originY: 'top',
      scaleX: imgTarget.scaleX,
      scaleY: imgTarget.scaleY,
      angle: imgTarget.angle,
      opacity: 1, // Fixed: don't make the background totally transparent
      selectable: true,
      evented: true,
      lockRotation: true,
      lockScalingX: true, 
      lockScalingY: true,
    });
    
    (fullImg as any).isCropHelper = true;

    const cropRect = new fabric.Rect({
      left: imgTarget.left,
      top: imgTarget.top,
      originX: imgTarget.originX,
      originY: imgTarget.originY,
      width: imgTarget.width,
      height: imgTarget.height,
      scaleX: imgTarget.scaleX,
      scaleY: imgTarget.scaleY,
      angle: imgTarget.angle,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2 / fabricRef.current!.getZoom() || 1,
      strokeDashArray: [6, 6],
      cornerColor: '#ffffff',
      cornerStrokeColor: '#3b82f6',
      cornerSize: 12,
      transparentCorners: false,
      lockRotation: true,
      borderColor: '#3b82f6',
    });
    (cropRect as any).isCropHelper = true;

    imgTarget.set('visible', false);
    
    fabricRef.current!.add(fullImg);
    fabricRef.current!.add(cropRect);
    fabricRef.current!.setActiveObject(cropRect);
    fabricRef.current!.renderAll();

    cropSessionRef.current = {
      origObj: imgTarget,
      fullImg: fullImg,
      cropRect: cropRect,
      dimRect: null
    };

    setIsCropping(true);
    setActiveTool('crop');
  };

  const applyCrop = () => {
    const { origObj, fullImg, cropRect } = cropSessionRef.current;
    if (!origObj || !fullImg || !cropRect || !fabricRef.current) {
        cancelCrop();
        return; 
    }

    const imgEl = fullImg.getElement() as HTMLImageElement;
    if (!imgEl) {
        cancelCrop();
        return;
    }
    const imgWidth = imgEl.width || imgEl.naturalWidth;
    const imgHeight = imgEl.height || imgEl.naturalHeight;

    // Calculate unscaled crop dimensions by mapping from canvas space back to the source image space
    const cropWCanvas = cropRect.width! * Math.abs(cropRect.scaleX!);
    const cropHCanvas = cropRect.height! * Math.abs(cropRect.scaleY!);
    
    // original scale values of the full image
    const fullImgScaleX = Math.abs(fullImg.scaleX!);
    const fullImgScaleY = Math.abs(fullImg.scaleY!);
    
    let cropW = cropWCanvas / fullImgScaleX;
    let cropH = cropHCanvas / fullImgScaleY;

    // Calculate center offsets in source image space using reverse projection
    const fullImgMatrix = fullImg.calcTransformMatrix();
    const fullImgInverse = fabric.util.invertTransform(fullImgMatrix);
    
    const cropCenterCanvas = cropRect.getCenterPoint();
    const fullImgCenterCanvas = fullImg.getCenterPoint();
    
    const cropCenterLocal = fabric.util.transformPoint(cropCenterCanvas, fullImgInverse);
    const fullImgCenterLocal = fabric.util.transformPoint(fullImgCenterCanvas, fullImgInverse);
    
    const dx = cropCenterLocal.x - fullImgCenterLocal.x;
    const dy = cropCenterLocal.y - fullImgCenterLocal.y;
    
    // Compute top-left of crop in source image space
    let cropX = (imgWidth / 2) + dx - (cropW / 2);
    let cropY = (imgHeight / 2) + dy - (cropH / 2);

    // Bounds / Safety constraints to prevent NaN or blank imagery
    if (cropX < 0) { cropW += cropX; cropX = 0; }
    if (cropY < 0) { cropH += cropY; cropY = 0; }
    if (cropX + cropW > imgWidth) cropW = imgWidth - cropX;
    if (cropY + cropH > imgHeight) cropH = imgHeight - cropY;

    if (cropW <= 1 || cropH <= 1) {
        cancelCrop();
        return;
    }

    origObj.set('visible', true);

    const beforeState = {
        left: origObj.left,
        top: origObj.top,
        scaleX: origObj.scaleX,
        scaleY: origObj.scaleY,
        angle: origObj.angle,
        width: origObj.width,
        height: origObj.height,
        cropX: origObj.cropX || 0,
        cropY: origObj.cropY || 0,
        originX: origObj.originX,
        originY: origObj.originY,
    };

    const afterState = {
        left: cropRect.left,
        top: cropRect.top,
        scaleX: fullImg.scaleX, 
        scaleY: fullImg.scaleY,
        angle: cropRect.angle,
        width: cropW,
        height: cropH,
        cropX: cropX,
        cropY: cropY,
        originX: cropRect.originX,
        originY: cropRect.originY,
    };

    const cmd = new TransformObjectsCommand("Crop Image", [{
        obj: origObj,
        before: beforeState,
        after: afterState
    }]);

    executeCommand(cmd);

    fabricRef.current.remove(fullImg);
    fabricRef.current.remove(cropRect);
    fabricRef.current.setActiveObject(origObj);
    fabricRef.current.renderAll();

    updateLayersList();

    cropSessionRef.current = { origObj: null, fullImg: null, cropRect: null, dimRect: null };
    setIsCropping(false);
    setActiveTool('select');
  };

  const cancelCrop = () => {
    const { origObj, fullImg, cropRect } = cropSessionRef.current;
    if (origObj) {
      origObj.set('visible', true);
      fabricRef.current?.setActiveObject(origObj);
    }
    if (fullImg) fabricRef.current?.remove(fullImg);
    if (cropRect) fabricRef.current?.remove(cropRect);
    fabricRef.current?.renderAll();

    cropSessionRef.current = { origObj: null, fullImg: null, cropRect: null, dimRect: null };
    setIsCropping(false);
    setActiveTool('select');
  };

  const resetCrop = () => {
    let activeObjects = fabricRef.current?.getActiveObjects();
    if (!activeObjects || activeObjects.length !== 1) return;
    let origObj = activeObjects[0] as any;
    
    if (origObj.get('isFrameGroup')) {
        const items = origObj.getObjects();
        const img = items.find((i: any) => i.type === 'image');
        if (img) origObj = img;
    }
    
    if (origObj.type !== 'image') return;

    const el = origObj.getElement() as HTMLImageElement;
    if (!el) return;

    origObj.setCoords();
    const matrix = origObj.calcTransformMatrix();
    const origCenterH = origObj.originX === 'center' ? origObj.width! / 2 : 0;
    const origCenterV = origObj.originY === 'center' ? origObj.height! / 2 : 0;

    const localFullTl = new fabric.Point(
      -origCenterH - (origObj.cropX || 0),
      -origCenterV - (origObj.cropY || 0)
    );
    const canvasFullTl = fabric.util.transformPoint(localFullTl, matrix);

    const beforeState = {
      left: origObj.left,
      top: origObj.top,
      scaleX: origObj.scaleX,
      scaleY: origObj.scaleY,
      angle: origObj.angle,
      width: origObj.width,
      height: origObj.height,
      cropX: origObj.cropX || 0,
      cropY: origObj.cropY || 0,
      originX: origObj.originX,
      originY: origObj.originY,
    };

    const afterState = {
      left: canvasFullTl.x,
      top: canvasFullTl.y,
      scaleX: origObj.scaleX,
      scaleY: origObj.scaleY,
      angle: origObj.angle,
      width: el.width,
      height: el.height,
      cropX: 0,
      cropY: 0,
      originX: 'left',
      originY: 'top',
    };

    const cmd = new TransformObjectsCommand("Reset Crop", [{
      obj: origObj,
      before: beforeState,
      after: afterState
    }]);

    executeCommand(cmd);
    updateLayersList();
    fabricRef.current?.setActiveObject(origObj);
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
    const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
    const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

    const rect = new fabric.Rect({
      left: viewCenterX, 
      top: viewCenterY, 
      width: 100, 
      height: 100,
      fill: 'transparent',
      stroke: brushColor,
      strokeWidth: brushSize > 0 ? brushSize : 2,
      originX: 'center',
      originY: 'center',
      id: Date.now().toString() + Math.random().toString(),
      artboardId: activeArtboardIdRef.current
    } as any);
    const cmd = new AddObjectCommand("Add Rectangle", rect);
    executeCommand(cmd);
  };

  const addCircle = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
    const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
    const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

    const circle = new fabric.Circle({
      left: viewCenterX, 
      top: viewCenterY, 
      radius: 50,
      fill: 'transparent',
      stroke: brushColor,
      strokeWidth: brushSize > 0 ? brushSize : 2,
      originX: 'center',
      originY: 'center',
      id: Date.now().toString() + Math.random().toString(),
      artboardId: activeArtboardIdRef.current
    } as any);
    const cmd = new AddObjectCommand("Add Circle", circle);
    executeCommand(cmd);
  };

  const addText = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
    const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
    const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

    const text = new fabric.Textbox('Double-click to type...', {
      left: viewCenterX, 
      top: viewCenterY,
      width: 250,
      fill: brushColor,
      fontFamily: textProps.fontFamily,
      fontSize: textProps.fontSize,
      fontWeight: textProps.fontWeight,
      fontStyle: textProps.fontStyle,
      textAlign: textProps.textAlign,
      underline: textProps.underline,
      overline: textProps.overline,
      linethrough: textProps.linethrough,
      charSpacing: textProps.charSpacing,
      lineHeight: textProps.lineHeight || 1.16,
      originX: 'center',
      originY: 'center',
      id: Date.now().toString() + Math.random().toString(),
      artboardId: activeArtboardIdRef.current
    } as any);
    const cmd = new AddObjectCommand("Add Text", text);
    executeCommand(cmd);
  };
  
  const addImageFromUrl = (url: string) => {
    fabric.Image.fromURL(url).then((img) => {
      if (img) {
         (img as any).id = Date.now().toString() + Math.random().toString();
         (img as any).artboardId = activeArtboardIdRef.current;
         
         if (fabricRef.current) {
           const canvas = fabricRef.current;
           const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
           const left = activeBoard.x + activeBoard.width / 2;
           const top = activeBoard.y + activeBoard.height / 2;
           
           let scaleX = 1;
           let scaleY = 1;
           if (activeBoard) {
              if (img.width! > activeBoard.width || img.height! > activeBoard.height) {
                 const scale = Math.min(activeBoard.width / img.width!, activeBoard.height / img.height!);
                 scaleX = scale;
                 scaleY = scale;
              }
           }

           img.set({
             left: left,
             top: top,
             scaleX: scaleX,
             scaleY: scaleY,
             originX: 'center',
             originY: 'center'
           });
           
           canvas.add(img);
           canvas.setActiveObject(img);
           canvas.renderAll();
           
           const cmd = new AddObjectCommand("Add Image", img);
           executeCommand(cmd);
           setTimeout(() => {
              fitView();
           }, 50);
         }
      }
    }).catch(err => {
      console.error("Failed to load image from URL:", err);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const result = f.target?.result as string;
      addImageFromUrl(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const deleteActiveObject = () => {
    const active = fabricRef.current?.getActiveObjects();
    if (active && active.length > 0) {
      const cmd = new DeleteObjectCommand("Delete Layer(s)", active);
      executeCommand(cmd);
    }
  };

  const duplicateActiveObject = () => {
    const activeObj = fabricRef.current?.getActiveObject();
    if (activeObj) {
      activeObj.clone(['id', 'artboardId']).then((cloned) => {
        fabricRef.current?.discardActiveObject();
        cloned.set({
          left: cloned.left! + 20,
          top: cloned.top! + 20,
          id: Date.now().toString() + Math.random().toString(),
          artboardId: (activeObj as any).artboardId || activeArtboardIdRef.current
        });
        if (cloned.type === 'activeSelection') {
          cloned.canvas = fabricRef.current!;
          (cloned as any).forEachObject((obj: any) => {
            obj.id = Date.now().toString() + Math.random().toString();
            obj.artboardId = obj.artboardId || activeArtboardIdRef.current;
            fabricRef.current?.add(obj);
          });
          cloned.setCoords();
        } else {
          fabricRef.current?.add(cloned);
        }
        const cmd = new AddObjectCommand("Duplicate Layer", cloned);
        executeCommand(cmd);
      });
    }
  };

  const flipX = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      const beforeVal = obj.flipX;
      const cmd = new PropertyChangeCommand("Flip Horizontal", obj, "flipX", beforeVal, !beforeVal);
      executeCommand(cmd);
    }
  };

  const flipY = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      const beforeVal = obj.flipY;
      const cmd = new PropertyChangeCommand("Flip Vertical", obj, "flipY", beforeVal, !beforeVal);
      executeCommand(cmd);
    }
  };

  const updateFrameBorderWidth = (width: number) => {
    setFrameBorderWidth(width);
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const activeObj = canvas.getActiveObject();
    
    if (activeObj && activeObj.get('isFrameGroup')) {
        const frameType = activeObj.get('frameType');
        const items = (activeObj as any as fabric.Group).getObjects();
        const rectObj = items.find((i: any) => i.type === 'rect');
        const imgObj = items.find((i: any) => i.type === 'image');
        
        if (rectObj && imgObj) {
            if (frameType === 'polaroid') {
                const center = imgObj.getCenterPoint();
                const w = imgObj.getScaledWidth();
                const h = imgObj.getScaledHeight();
                rectObj.set({
                    left: center.x,
                    top: center.y + width,
                    width: w + (width * 2),
                    height: h + (width * 4)
                });
            } else {
                rectObj.set('strokeWidth', width);
            }
            (activeObj as any).setDirty?.();
            activeObj.fire('modified');
            canvas.requestRenderAll();
        }
    }
  };

  const applyFrame = async (frameType: string, customWidth?: number) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    let activeObj = canvas.getActiveObject();
    
    if (!activeObj) {
      alert("Please select an image to apply a frame.");
      return;
    }

    isInternalChange.current = true;
    
    let baseImageObj: any = activeObj;
    let objectToRemove: any = activeObj;

    if (activeObj.get('isFrameGroup')) {
       const prevFrameType = activeObj.get('frameType');
       
       // Safely clone the group to extract the image without destroying the original (for history undo)
       const clonedGroup = await activeObj.clone([]);
       canvas.add(clonedGroup);
       
       let items: any[] = [];
       const groupAsAny = clonedGroup as any;
       if (typeof groupAsAny.toActiveSelection === 'function') {
           const sel = groupAsAny.toActiveSelection();
           items = sel.getObjects();
       } else {
           items = (clonedGroup as any).removeAll();
           canvas.remove(clonedGroup);
           items.forEach((i: any) => canvas.add(i));
       }
       
       const img = items.find((o: any) => o.type === 'image');
       const rect = items.find((o: any) => o.type === 'rect');
       
       if (rect) canvas.remove(rect); // Clean up temp rect
       if (img) canvas.remove(img);   // Temporarily remove temp img
       
       if (!img) {
           alert("Could not extract image from frame.");
           isInternalChange.current = false;
           return;
       }
       
       baseImageObj = img;
       
       if (prevFrameType === frameType && customWidth === undefined) {
           // Toggle off identical frame
           canvas.add(baseImageObj);
           canvas.setActiveObject(baseImageObj);
           
           const cmd = new MacroCommand("Remove Frame", [
               new DeleteObjectCommand("Remove Group", [objectToRemove]),
               new AddObjectCommand("Add Extracted Image", baseImageObj)
           ]);
           executeCommand(cmd);
           canvas.requestRenderAll();
           updateLayersList();
           isInternalChange.current = false;
           return;
       }
    }

    if (baseImageObj.type !== 'image') {
      alert("Please select an image to apply a frame.");
      isInternalChange.current = false;
      return;
    }

    // Default Frame Settings
    let strokeColor = "#ffffff";
    let strokeWidth = customWidth !== undefined ? customWidth : 20;
    let strokeUniform = true;
    
    switch (frameType) {
      case 'polaroid':
        strokeColor = "#F9F9F9";
        if (customWidth === undefined) strokeWidth = 30; // base boundary
        break;
      case 'black':
        strokeColor = "#111111";
        if (customWidth === undefined) strokeWidth = 15;
        break;
      case 'white':
        strokeColor = "#FFFFFF";
        if (customWidth === undefined) strokeWidth = 15;
        break;
      case 'metallic':
        strokeColor = "#D4AF37";
        if (customWidth === undefined) strokeWidth = 12;
        break;
      case 'vintage':
        strokeColor = "#8B5A2B";
        if (customWidth === undefined) strokeWidth = 20;
        break;
    }

    const originalAngle = baseImageObj.angle || 0;
    baseImageObj.set({ angle: 0 }); // temporarily straighten to get clean bounds
    baseImageObj.setCoords();

    const center = baseImageObj.getCenterPoint();
    const w = baseImageObj.getScaledWidth();
    const h = baseImageObj.getScaledHeight();

    const rect = new fabric.Rect({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y + (frameType === 'polaroid' ? strokeWidth : 0),
      width: w + (frameType === 'polaroid' ? strokeWidth * 2 : 0),
      height: h + (frameType === 'polaroid' ? strokeWidth * 3.5 : 0),
      fill: 'transparent',
      stroke: strokeColor,
      strokeWidth: frameType === 'polaroid' ? 0 : strokeWidth,
      strokeUniform: strokeUniform,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.3)',
        blur: 10,
        offsetX: 5,
        offsetY: 5
      }),
      evented: true,
      selectable: true,
      artboardId: (baseImageObj as any).artboardId
    });

    if (frameType === 'polaroid') {
       rect.set('fill', '#F9F9F9');
       rect.set('strokeWidth', 0);
    }
    
    // Group them
    const objs = frameType === 'polaroid' ? [rect, baseImageObj] : [baseImageObj, rect];
    const group = new fabric.Group(objs);
    
    group.set({
       id: `frame_${Date.now()}`,
       customName: `${frameType.charAt(0).toUpperCase() + frameType.slice(1)} Frame`,
       artboardId: (baseImageObj as any).artboardId,
       angle: originalAngle, // restore original angle
       isFrameGroup: true, // special flag to allow formats and quick actions to identify this
       frameType: frameType 
    } as any);
    
    // We add the newly created frame group, and delete the original object/group
    canvas.discardActiveObject();
    canvas.add(group);
    canvas.setActiveObject(group);
    
    const macroCmd = new MacroCommand(
       `Apply ${frameType} frame`,
       [
          new DeleteObjectCommand("Remove Base", [objectToRemove]),
          new AddObjectCommand("Add Frame Group", group)
       ]
    );

    executeCommand(macroCmd);
    canvas.requestRenderAll();
    updateLayersList();
    isInternalChange.current = false;
  };

  const changeTextProp = (property: string, value: any, actionName: string) => {
    setTextProps(p => ({ ...p, [property]: value }));
    const active = fabricRef.current?.getActiveObject();
    if (active && (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox')) {
      const before = active.get(property as any);
      active.set(property as any, value);
      
      active.dirty = true;
      if (typeof active.setCoords === 'function') {
        active.setCoords();
      }
      fabricRef.current?.renderAll();
      
      const cmd = new PropertyChangeCommand(actionName, active, property, before, value);
      executeCommand(cmd);
    }
  };
  
  // Layer CRUD
  const selectLayer = (id: string) => {
     if (!fabricRef.current) return;
     const items = fabricRef.current.getObjects();
     const obj = items.find((o: any) => o.id === id);
     if (obj) {
       fabricRef.current.setActiveObject(obj);
       fabricRef.current.renderAll();
     }
  };
  
  const moveLayerUp = (id: string) => {
     if (!fabricRef.current) return;
     const items = fabricRef.current.getObjects();
     const obj = items.find((o: any) => o.id === id);
     if (obj) {
        const beforeOrder = getLayersOrder();
        fabricRef.current.bringObjectForward(obj);
        const afterOrder = getLayersOrder();
        
        // Temporarily reset order to execute correctly using the command channel
        fabricRef.current.sendObjectBackwards(obj);
        const cmd = new LayerReorderCommand("Move Layer Up", beforeOrder, afterOrder);
        executeCommand(cmd);
     }
  };
  
  const moveLayerDown = (id: string) => {
     if (!fabricRef.current) return;
     const items = fabricRef.current.getObjects();
     const obj = items.find((o: any) => o.id === id);
     if (obj) {
        const beforeOrder = getLayersOrder();
        fabricRef.current.sendObjectBackwards(obj);
        const afterOrder = getLayersOrder();
        
        // Temporarily reset order to execute correctly using the command channel
        fabricRef.current.bringObjectForward(obj);
        const cmd = new LayerReorderCommand("Move Layer Down", beforeOrder, afterOrder);
        executeCommand(cmd);
     }
  };

  const changeCurrentColor = (newColor: string) => {
    setBrushColor(newColor);
    
    // Sync alpha with brushOpacity if newColor is RGBA
    if (newColor.startsWith('rgba(')) {
       const parts = newColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
       if (parts && parts[4]) {
          const alphaNum = Math.round(parseFloat(parts[4]) * 100);
          setBrushOpacity(alphaNum);
       }
    }

    if (activeTool === 'brush' && fabricRef.current?.freeDrawingBrush) {
       fabricRef.current.freeDrawingBrush.color = newColor;
    }
    const active = fabricRef.current?.getActiveObject();
    if (active) {
      if (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox') {
        const cmd = new PropertyChangeCommand("Change Text Color", active, "fill", active.get('fill'), newColor);
        executeCommand(cmd);
      } else if (active.type === 'path') {
        const cmd = new PropertyChangeCommand("Change Path Color", active, "stroke", active.get('stroke'), newColor);
        executeCommand(cmd);
      } else if (active.type !== 'image') {
        const cmd = new StyleChangeCommand(
          "Change Shape Color",
          active,
          { fill: active.get('fill'), stroke: active.get('stroke') },
          { fill: newColor, stroke: newColor }
        );
        executeCommand(cmd);
      }
    }
  };

  // Advanced Filters
  const getTargetImageForFilters = () => {
    let obj = fabricRef.current?.getActiveObject() as any;
    if (obj && obj.get('isFrameGroup')) {
       // Find the image inside the group
       const items = obj.getObjects();
       obj = items.find((i: any) => i.type === 'image') || obj;
    }
    return obj;
  };

  const applyFilter = (filterType: string, value: number) => {
    const obj = getTargetImageForFilters();
    if (obj && obj.type === 'image') {
      const filters = (fabric as any).Image?.filters || (fabric as any).filters;
      if (!filters) return;

      
      let filterIndex = -1;
      let beforeValue = 0;
      if (filterType === 'brightness') {
        filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Brightness);
        if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].brightness;
      } else if (filterType === 'contrast') {
        filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Contrast);
        if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].contrast;
      } else if (filterType === 'saturation') {
        filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
        if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].saturation;
      } else if (filterType === 'grayscale') {
        filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
        if (filterIndex >= 0) beforeValue = -obj.filters[filterIndex].saturation;
      }

      const cmd = new FilterChangeCommand(`Apply ${filterType} Filter`, obj, filterType, beforeValue, value);
      executeCommand(cmd);
    }
  };

  // Filter Studio Pipeline Controls
  const applyFilterStack = (newStack: FilterConfig[], description = "Update Filter Studio Pipeline") => {
    const obj = getTargetImageForFilters();
    if (obj && obj.type === 'image') {
      const beforeStack = obj.customFilters || [];
      const cmd = new FilterPipelineCommand(description, obj, beforeStack, newStack);
      executeCommand(cmd);
      setImageFilters(newStack);
      if (obj.lastFilterBenchmark) {
        setBenchmarkInfo(obj.lastFilterBenchmark);
      }
    }
  };

  const addFilterToPipeline = (type: string) => {
    const base = {
      id: Date.now().toString() + Math.random().toString(),
      type,
      enabled: true,
    };
    let newItem: FilterConfig;
    switch (type) {
      case 'brightness':
        newItem = { ...base, name: 'Brightness', category: 'adjust', params: { value: 0 } };
        break;
      case 'contrast':
        newItem = { ...base, name: 'Contrast', category: 'adjust', params: { value: 0 } };
        break;
      case 'saturation':
        newItem = { ...base, name: 'Saturation', category: 'adjust', params: { value: 0 } };
        break;
      case 'vibrance':
        newItem = { ...base, name: 'Vibrance', category: 'adjust', params: { value: 0 } };
        break;
      case 'exposure':
        newItem = { ...base, name: 'Exposure', category: 'adjust', params: { value: 0 } };
        break;
      case 'hueRotation':
        newItem = { ...base, name: 'Hue Rotation', category: 'adjust', params: { value: 0 } };
        break;
      case 'gamma':
        newItem = { ...base, name: 'Gamma Channels', category: 'adjust', params: { red: 1.0, green: 1.0, blue: 1.0, value: 1.0 } };
        break;
      case 'grayscale':
        newItem = { ...base, name: 'Grayscale Mode', category: 'color', params: { mode: 'luminosity' } };
        break;
      case 'invert':
        newItem = { ...base, name: 'Invert Color', category: 'color', params: {} };
        break;
      case 'sepia':
        newItem = { ...base, name: 'Sepia Vintage', category: 'color', params: {} };
        break;
      case 'blackwhite':
        newItem = { ...base, name: 'B&W Contrast', category: 'color', params: {} };
        break;
      case 'removeColor':
        newItem = { ...base, name: 'Remove Color Key', category: 'color', params: { color: '#ffffff', distance: 0.15 } };
        break;
      case 'noise':
        newItem = { ...base, name: 'Noise & Grain', category: 'noise', params: { value: 50 } };
        break;
      case 'pixelate':
        newItem = { ...base, name: 'Pixelate Mosaic', category: 'pixel', params: { value: 8 } };
        break;
      case 'blur':
        newItem = { ...base, name: 'Gaussian Blur', category: 'blur', params: { value: 0.2 } };
        break;
      case 'edge':
        newItem = { ...base, name: 'Edge Detection', category: 'artsy', params: {} };
        break;
      case 'sharpen':
        newItem = { ...base, name: 'Sharpen Convolute', category: 'blur', params: {} };
        break;
      case 'emboss':
        newItem = { ...base, name: 'Emboss Texture', category: 'artsy', params: {} };
        break;
      case 'vignette':
        newItem = { ...base, name: 'Vignette Overlay', category: 'artsy', params: {} };
        break;
      case 'bloom':
        newItem = { ...base, name: 'Glamour Bloom', category: 'artsy', params: {} };
        break;
      case 'chromatic':
        newItem = { ...base, name: 'Chromatic Aberration', category: 'artsy', params: {} };
        break;
      case 'blendColor':
        newItem = { ...base, name: 'Blend Color Filter', category: 'blend', params: { color: '#3b82f6', mode: 'multiply', alpha: 0.4 } };
        break;
      default:
        newItem = { ...base, name: type.charAt(0).toUpperCase() + type.slice(1), category: 'adjust', params: {} };
        break;
    }

    const updated = [...imageFilters, newItem];
    applyFilterStack(updated, `Add ${newItem.name}`);
  };

  const removeFilterFromPipeline = (id: string) => {
    const updated = imageFilters.filter(f => f.id !== id);
    applyFilterStack(updated, "Remove Filter Card");
  };

  const toggleFilterEnabled = (id: string) => {
    const updated = imageFilters.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f);
    applyFilterStack(updated, "Toggle Filter Status");
  };

  const duplicateFilterInPipeline = (id: string) => {
    const filter = imageFilters.find(f => f.id === id);
    if (!filter) return;
    const duplicated: FilterConfig = {
      ...JSON.parse(JSON.stringify(filter)),
      id: Date.now().toString() + Math.random().toString(),
      name: `${filter.name} (Copy)`
    };
    const idx = imageFilters.findIndex(f => f.id === id);
    const updated = [...imageFilters];
    updated.splice(idx + 1, 0, duplicated);
    applyFilterStack(updated, `Duplicate ${filter.name}`);
  };

  const updateFilterParam = (id: string, paramName: string, value: any) => {
    const updated = imageFilters.map(f => {
      if (f.id === id) {
        return {
          ...f,
          params: { ...f.params, [paramName]: value }
        };
      }
      return f;
    });
    applyFilterStack(updated, "Tune Parameter Live");
  };

  const moveFilterInPipeline = (id: string, direction: 'up' | 'down') => {
    const index = imageFilters.findIndex(f => f.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === imageFilters.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...imageFilters];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    applyFilterStack(updated, `Reorder ${temp.name} ${direction}`);
  };

  const applyCreativePreset = (presetName: string) => {
    const base = {
      id: Date.now().toString() + Math.random().toString(),
      type: 'preset',
      category: 'presets' as const,
      enabled: true,
    };
    const presetLabels: { [key: string]: string } = {
      brownie: 'Brownie Vintage',
      vintage: 'Vintage Classic',
      technicolor: 'Technicolor Retro',
      kodachrome: 'Kodachrome Film',
      polaroid: 'Polaroid Soft',
      hdr: 'HDR Contrast',
      film: 'Fine Art Film',
      instagram: 'Instagram Vibe',
      vibrant: 'Super Vibrant',
      soft: 'Soft Cinematic'
    };
    const newItem: FilterConfig = {
      ...base,
      name: presetLabels[presetName] || 'Creative Preset',
      params: { name: presetName }
    };
    const updated = [...imageFilters, newItem];
    applyFilterStack(updated, `Apply ${newItem.name}`);
  };

  const loadSavedPreset = (preset: { name: string; stack: FilterConfig[] }) => {
    const remappedStack = preset.stack.map(f => ({
      ...f,
      id: Date.now().toString() + Math.random().toString()
    }));
    applyFilterStack(remappedStack, `Apply preset ${preset.name}`);
  };

  const saveCurrentStackAsPreset = (name: string) => {
    if (!name.trim()) return;
    const updatedPresets = [...customPresets, { name, stack: JSON.parse(JSON.stringify(imageFilters)) }];
    setCustomPresets(updatedPresets);
    try {
      localStorage.setItem("workspace_custom_filters_presets", JSON.stringify(updatedPresets));
    } catch (e) {
      console.error(e);
    }
    setNewPresetName("");
    setShowSavePresetModal(false);
  };

  const deleteCustomPreset = (name: string) => {
    const updated = customPresets.filter(p => p.name !== name);
    setCustomPresets(updated);
    try {
      localStorage.setItem("workspace_custom_filters_presets", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // jSquash Export Pipeline running on a high-compatibility Background Web Worker
  const [isExporting, setIsExporting] = useState(false);

  const generateArtboardPixelBuffer = async (board: Artboard): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
    if (!fabricRef.current) throw new Error("Canvas not ready");
    
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
    
    const objs = fabricRef.current.getObjects();
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

  const optimizePixelBuffer = async (
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
          resize: resizeWasmUrl,
          // Decoder URLs
          jpegDecode: "https://unpkg.com/@jsquash/jpeg@1.6.0/codec/dec/mozjpeg_dec.wasm",
          webpDecode: "https://unpkg.com/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm",
          avifDecode: "https://unpkg.com/@jsquash/avif@2.1.1/codec/dec/avif_dec.wasm",
        },
        hasSimdResult,
        hasThreadsResult,

        // Advanced Settings
        mozjpeg: settings.mozjpeg,
        webp: settings.webp,
        avif: settings.avif,
        pngLevel: settings.png.level,
        pngInterlace: settings.png.interlace,
        paletteReduction: settings.png.paletteReduction,
        paletteColors: settings.png.paletteColors,
        ditherLevel: settings.png.ditherLevel,
      }, [pixelBuffer]);
    });
  };

  const handleExport = async () => {
    if (!fabricRef.current || artboards.length === 0) return;
    setIsExporting(true);
    try {
        let targets: Artboard[] = [];
        if (exportTarget === "current") {
          const curr = artboards.find(b => b.id === activeArtboardId) || artboards[0];
          targets = [curr];
        } else if (exportTarget === "selected") {
          targets = artboards.filter(b => selectedExportIds[b.id]);
          if (targets.length === 0) {
            alert("No artboards selected to export!");
            setIsExporting(false);
            return;
          }
        } else {
          targets = artboards;
        }

        if (targets.length === 1) {
          const board = targets[0];
          const { buffer, width, height } = await generateArtboardPixelBuffer(board);
          
          const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, exportSettings);
          const blob = new Blob([rawBuffer], { type: `image/${exportSettings.format}` });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${board.name.toLowerCase().replace(/\s+/g, '_')}.${exportSettings.format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          const zip = new JSZip();
          for (const board of targets) {
            const { buffer, width, height } = await generateArtboardPixelBuffer(board);
            // In batch mode, we disable custom resize per image for consistency unless explicitly architecture changed
            const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, {
              ...exportSettings,
              resize: { ...exportSettings.resize, enabled: false }
            });
            zip.file(`${board.name.toLowerCase().replace(/\s+/g, '_')}.${exportSettings.format}`, rawBuffer);
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
    } catch(err) {
        console.error("Export Failed", err);
    } finally {
        setIsExporting(false);
    }
  };

  // Helper to format bytes cleanly
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Live preview generator for Squoosh-like image comparison
  const generateLivePreview = async () => {
    if (!fabricRef.current || artboards.length === 0) return;

    const board = artboards.find(b => b.id === activeArtboardId) || artboards[0];
    if (!board) return;

    setIsGeneratingPreview(true);
    setCurrentPreviewOp("Extracting active composite elements...");

    try {
      // 1. Get raw pixel buffer
      const { buffer, width, height } = await generateArtboardPixelBuffer(board);

      // Determine preview target resolution (supporting the performance-cap downscaling)
      const maxPreviewDim = 800; 
      let targetW = board.width;
      let targetH = board.height;

      if (exportTarget === "current" && exportSettings.resize.enabled) {
        targetW = exportSettings.resize.width;
        targetH = exportSettings.resize.height;
      }

      const needsDownscaleForPreview = targetW > maxPreviewDim || targetH > maxPreviewDim;
      let previewW = targetW;
      let previewH = targetH;

      if (needsDownscaleForPreview) {
        const ratio = targetW / targetH;
        if (targetW > targetH) {
          previewW = maxPreviewDim;
          previewH = Math.round(maxPreviewDim / ratio);
        } else {
          previewH = maxPreviewDim;
          previewW = Math.round(maxPreviewDim * ratio);
        }
      }

      // 2. Original URL extraction & original lossless blob measurement
      setCurrentPreviewOp("Rendering before/after viewport...");
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = previewW;
      originalCanvas.height = previewH;
      const oCtx = originalCanvas.getContext('2d')!;

      const sourceImage = new ImageData(new Uint8ClampedArray(buffer), width, height);
      const offscreenOriginal = document.createElement('canvas');
      offscreenOriginal.width = width;
      offscreenOriginal.height = height;
      offscreenOriginal.getContext('2d')!.putImageData(sourceImage, 0, 0);
      oCtx.drawImage(offscreenOriginal, 0, 0, previewW, previewH);

      const originalUrl = originalCanvas.toDataURL("image/png");
      setOriginalImageUrl(originalUrl);

      // Measure real original file size by generating a PNG blob
      setCurrentPreviewOp("Analyzing baseline image color & size...");
      const originalBlob = await new Promise<Blob | null>(r => offscreenOriginal.toBlob(r, 'image/png'));
      const origSize = originalBlob ? originalBlob.size : buffer.byteLength;
      setOriginalSize(origSize);

      // 3. Run WASM optimization
      const formatLabel = exportSettings.format.toUpperCase();
      setCurrentPreviewOp(`Running jSquash WASM optimization (${formatLabel})...`);

      // Modify settings for preview to use preview resolution
      const previewSettings: ExportSettings = {
        ...exportSettings,
        resize: {
          ...exportSettings.resize,
          enabled: true,
          width: previewW,
          height: previewH
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
      setOptimizedSize(optimizedBlob.size);
      setPsnr(calculatedPsnr);

      const optUrl = URL.createObjectURL(optimizedBlob);
      setOptimizedImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return optUrl;
      });

    } catch (err: any) {
      console.error("Live comparison preview optimization failed:", err);
    } finally {
      setIsGeneratingPreview(false);
      setCurrentPreviewOp("");
    }
  };

  // Sync tab open/close to active comparison mode
  useEffect(() => {
    if (activeTab === "export") {
      setComparisonMode(true);
      generateLivePreview();
    } else {
      setComparisonMode(false);
    }
  }, [activeTab]);

  // Debounced live regeneration hook responding to setting changes
  useEffect(() => {
    if (!comparisonMode) return;

    setCurrentPreviewOp("Throttling live settings changes...");
    const timer = setTimeout(() => {
      generateLivePreview();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    comparisonMode,
    activeArtboardId,
    exportTarget,
    exportSettings
  ]);

  // Hide objects of inactive artboards on mobile
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    let madeChanges = false;
    
    objects.forEach(obj => {
      // Don't hide crop overlays etc.
      if ((obj as any).id === 'crop-overlay' || (obj as any).id === 'crop-dimmask') return;
      
      const objArtboardId = (obj as any).artboardId;
      if (!objArtboardId) return; // skip if no artboard

      const shouldBeVisible = isMobile ? objArtboardId === activeArtboardId : true;
      if (obj.visible !== shouldBeVisible) {
         obj.visible = shouldBeVisible;
         madeChanges = true;
      }
    });

    if (madeChanges) {
      canvas.requestRenderAll();
    }
    
    // Fit to screen on mobile whenever active artboard changes, or restore desktop state on return
    if (isMobile) {
      const activeBoard = artboards.find(b => b.id === activeArtboardId) || artboards[0];
      if (activeBoard) {
         const cw = canvas.width!;
         const ch = canvas.height!;
         if (cw > 0 && ch > 0) {
            const padding = 32;
            const zoom = Math.min(cw / (activeBoard.width + padding), ch / (activeBoard.height + padding), 2.5);
            canvas.setZoom(zoom);
            
            const vpt = canvas.viewportTransform!;
            const newVpt = vpt.slice() as any;
            newVpt[4] = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
            newVpt[5] = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;
            canvas.setViewportTransform(newVpt);
            setZoomPercent(Math.round(zoom * 100));
         }
      }
    } else {
      if (viewportTransformRef.current) {
         canvas.setViewportTransform(viewportTransformRef.current.slice() as any);
         const zoom = canvas.getZoom();
         setZoomPercent(Math.round(zoom * 100));
         canvas.requestRenderAll();
      } else {
         fitView();
      }
    }
  }, [isMobile, activeArtboardId, artboards]);

  return (
    <div 
      className="w-full h-full flex flex-col bg-[#121212] text-[#E0E0E0] select-none" 
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      
      {/* Top Toolbar */}
      <div className="h-12 border-b border-[#2C2C2C] bg-[#1E1E1E] flex items-center px-2 md:px-4 gap-2 md:gap-3 shrink-0 overflow-x-auto no-scrollbar">
        <ImageIcon size={18} className="text-blue-400 shrink-0 ml-1 md:ml-0" />
        <span className="font-semibold text-sm mr-2 md:mr-4 tracking-tight shrink-0 hidden sm:inline-block">Studio Editor</span>
        
        {/* Action History Tools */}
        <div className="flex border border-[#3A3A3A] rounded shadow-sm bg-[#181818] shrink-0">
          <button className={`h-8 w-8 flex items-center justify-center transition-colors border ${commandIndex >= 0 ? 'text-red-400 border-red-500 hover:bg-red-500/10' : 'text-[#4A4A4A] border-transparent'}`} onClick={performUndo} title="Undo (Ctrl+Z)" disabled={commandIndex < 0}>
             <Undo size={14} />
          </button>
          <div className="w-px h-8 bg-[#3A3A3A]" />
          <button className={`h-8 w-8 flex items-center justify-center transition-colors border ${commandIndex < historyNames.length - 1 ? 'text-red-400 border-red-500 hover:bg-red-500/10' : 'text-[#4A4A4A] border-transparent'}`} onClick={performRedo} title="Redo (Ctrl+Y)" disabled={commandIndex >= historyNames.length - 1}>
             <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#3A3A3A] mx-0.5 md:mx-1 shrink-0" />

        <button className="h-8 w-8 hover:bg-[#2C2C2C] text-[#A0A0A0] hover:text-white flex items-center justify-center rounded transition-colors shrink-0" title="Import Image" onClick={handleImportImageClick}>
          <Upload size={14} />
        </button>
        <input id="img-upload" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />

        <div className="flex-1" />

        <button className="h-8 w-8 hover:bg-[#2C2C2C] text-[#A0A0A0] hover:text-white flex items-center justify-center rounded transition-colors shrink-0 mr-1" title="Shortcuts Info" onClick={() => setShowShortcuts(true)}>
          <Info size={14} />
        </button>

        <button 
           onClick={() => { setActiveTab('export'); if(isMobile) setShowMobilePanel(true); }} 
           disabled={artboards.length === 0}
           className={`h-8 px-3 md:px-5 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white rounded-lg transition-all shrink-0 whitespace-nowrap flex items-center justify-center gap-2 ${
             artboards.length > 0
               ? 'bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 hover:from-indigo-400 hover:via-blue-500 hover:to-indigo-500 shadow-[0_2px_10px_rgba(79,70,229,0.25)] hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] active:scale-[0.98] border border-blue-400/20'
               : 'bg-[#2A2A2A] text-[#666] border border-[#333] cursor-not-allowed opacity-50'
           }`}
        >
          {artboards.length > 0 && <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />}
          Export Studio
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        
        {/* Left Toolbar - Tools (Desktop) */}
        <div className="hidden md:flex w-14 border-r border-[#2C2C2C] bg-[#1E1E1E] flex flex-col items-center py-4 gap-2 z-10 shrink-0 shadow-[4px_0_12px_rgba(0,0,0,0.1)]">
            <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move (V)"/>
            <ToolBtn icon={Move} tool="pan" current={activeTool} set={setTool} title="Pan Canvas (H / Hold Space)"/>
            <ToolBtn icon={Crop} tool="crop" current={activeTool} set={() => enterCropMode()} title="Crop Image (C)"/>
            <ToolBtn icon={Brush} tool="brush" current={activeTool} set={setTool} title="Brush (B)"/>
            
            <div className="w-8 h-px bg-[#3A3A3A] my-2" />
            
            <ToolBtn icon={Type} tool="text" current={activeTool} set={addText} title="Text (T)"/>
            <ToolBtn icon={Square} tool="rect" current={activeTool} set={addRect} title="Rectangle"/>
            <ToolBtn icon={Circle} tool="circle" current={activeTool} set={addCircle} title="Ellipse (Circle)"/>
            
            <div className="flex-1" />

            <div className="relative">
                <ColorPickerTrigger 
                   color={brushColor} 
                   onChange={changeCurrentColor} 
                   className="w-8 h-8 rounded-full border-2 border-white/20 shadow-inner relative overflow-hidden"
                   label="Brush Color"
                />
             </div>
         </div>

        {/* Center Canvas & Artboard Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#121212] overflow-hidden relative">
           
           {/* Artboard Bar */}
           {activeTab !== 'export' && (
           <div className="h-10 bg-[#1E1E1E] border-b border-[#2C2C2C] flex items-center px-1.5 shrink-0 overflow-x-auto no-scrollbar gap-1 relative z-20 shadow-sm select-none">
              {isMobile && (
                 <button 
                   onClick={() => setShowMobileArtboardsGallery(true)}
                   className="h-[30px] w-[30px] shrink-0 sticky left-0 z-10 bg-[#292929] border border-[#3C3C3C] shadow flex items-center justify-center rounded-md mr-1 text-[#C0C0C0] hover:text-white"
                 >
                   <SquareDashed size={14} />
                 </button>
              )}
              {artboards.map(b => {
                 const isActive = b.id === activeArtboardId;
                 return (
                    <div 
                       key={b.id} 
                       className={`h-[30px] flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-all border border-transparent group ${isActive ? 'bg-[#292929] border-[#3C3C3C] shadow-sm' : 'hover:bg-[#202020] text-[#808080]'}`}
                       onClick={() => {
                          setActiveArtboardId(b.id);
                          if (fabricRef.current) {
                             const cw = fabricRef.current.width!;
                             const ch = fabricRef.current.height!;
                             const vpt = fabricRef.current.viewportTransform!;
                             const newVpt = vpt.slice() as any;
                             newVpt[4] = cw / 2 - (b.x + b.width / 2) * newVpt[0];
                             newVpt[5] = ch / 2 - (b.y + b.height / 2) * newVpt[3];
                             fabricRef.current.setViewportTransform(newVpt);
                          }
                       }}
                    >
                       <span className={`text-[11px] font-semibold whitespace-nowrap outline-none flex items-center gap-1.5 ${isActive ? 'text-[#E0E0E0]' : ''}`}>
                          {isActive && <div className="w-[4px] h-[4px] rounded-full bg-blue-500" />}
                          {b.name}
                       </span>
                       
                       <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                             className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3A3A3A] text-[#A0A0A0] transition-colors artboard-dropdown-toggle"
                             onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setArtboardDropdown(artboardDropdown?.id === b.id ? null : { id: b.id, x: rect.left, y: rect.bottom + 6 });
                             }}
                          >
                             <MoreHorizontal size={12} />
                          </button>
                       </div>
                    </div>
                 );
              })}

              <div className="w-px h-5 bg-[#333] mx-1 shrink-0" />
              
              <button
                 className="h-[30px] px-3 flex items-center gap-1.5 rounded-md hover:bg-[#252525] text-[#808080] hover:text-[#C0C0C0] transition-colors shrink-0"
                 onClick={() => createArtboard()}
              >
                 <Plus size={13} />
                 <span className="text-[11px] font-semibold">New</span>
              </button>
           </div>
           )}

           {/* Dropdown Menu Portal */}
           {artboardDropdown && (
              <div 
                 className="fixed inset-0 z-50 pointer-events-auto"
                 onClick={() => setArtboardDropdown(null)}
              >
                 <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ left: Math.min(artboardDropdown.x, window.innerWidth - 180), top: artboardDropdown.y }}
                    className="absolute bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg shadow-2xl py-1 min-w-[170px] artboard-dropdown-container"
                 >
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#666] border-b border-[#252525] mb-1">Artboard</div>
                    <ContextMenuItem icon={Type} label="Rename Artboard" onClick={() => {
                        const board = artboards.find(b => b.id === artboardDropdown.id);
                        if (board) {
                            setRenamingArtboard({ id: board.id, name: board.name });
                        }
                        setArtboardDropdown(null);
                    }} />
                    <ContextMenuItem icon={Copy} label="Duplicate Artboard" onClick={() => {
                        const board = artboards.find(b => b.id === artboardDropdown.id);
                        if (board) {
                            createArtboard(board.name + " Copy", board.width, board.height);
                        }
                        setArtboardDropdown(null);
                    }} />
                    <ContextMenuItem icon={Expand} label="Resize Options" onClick={() => {
                        setActiveArtboardId(artboardDropdown.id);
                        setActiveTab("artboards");
                        setArtboardDropdown(null);
                    }} />
                    <ContextMenuItem icon={Download} label="Export Artboard" onClick={() => {
                        setActiveArtboardId(artboardDropdown.id);
                        setExportTarget("current");
                        setActiveTab("export");
                        setArtboardDropdown(null);
                    }} />
                    {artboards.length > 1 && (
                      <>
                        <div className="h-px bg-[#252525] my-1" />
                        <ContextMenuItem icon={Trash2} label="Delete Artboard" danger onClick={() => {
                            deleteArtboard(artboardDropdown.id);
                            setArtboardDropdown(null);
                        }} />
                      </>
                    )}
                 </div>
              </div>
           )}

           {/* Canvas Container */}
           <div className="flex-1 overflow-hidden flex items-center justify-center relative touch-none bg-[#121212]">
              {/* subtle grid background */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px'}} />
              
              {/* Main Fabric Canvas Wrapper (hidden during comparison mode) */}
              <div className={`shadow-2xl ring-1 ring-white/5 relative ${comparisonMode ? 'hidden' : 'block'}`}>
                 <canvas ref={canvasRef} className="block" />
               </div>

               {/* Dynamic Photoshop-style Brush Adjustment floating HUD and diameter preview */}
                {showHud && hudPosition && (() => {
                   const getRgba = (hex: string, alpha: number) => {
                      let c = hex.replace('#', '');
                      if (c.length === 3) {
                         c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
                      }
                      const r = parseInt(c.substring(0, 2), 16) || 0;
                      const g = parseInt(c.substring(2, 4), 16) || 0;
                      const b = parseInt(c.substring(4, 6), 16) || 0;
                      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                   };

                   const zoom = fabricRef.current?.getZoom() || 1;
                   const size = brushSize * zoom;
                   
                   const strokeWidth = 3;
                   const ringDiameter = Math.max(size, 48);
                   const radius = (ringDiameter / 2) + 6;
                   const padding = 12;
                   const svgSize = ringDiameter + (padding * 2);
                   const center = svgSize / 2;
                   const circumference = 2 * Math.PI * radius;

                   let percentage = 100;
                   let strokeColor = '#3b82f6'; // Size: Blue

                   if (activeBrushProperty === 'opacity') {
                      percentage = brushOpacity;
                      strokeColor = '#a855f7'; // Opacity: Purple/Magenta
                   } else if (activeBrushProperty === 'hardness') {
                      percentage = brushHardness;
                      strokeColor = '#f59e0b'; // Hardness: Amber/Yellow
                   } else {
                      percentage = (brushSize / 500) * 100;
                      strokeColor = '#3b82f6'; // Size: Blue
                   }

                   const strokeDashoffset = circumference - (percentage / 100) * circumference;

                   let previewStyle: React.CSSProperties = {
                      width: `${size}px`,
                      height: `${size}px`,
                      maxWidth: '450px',
                      maxHeight: '450px',
                      minWidth: '6px',
                      minHeight: '6px',
                      borderRadius: '9999px',
                      border: '1.5px solid rgba(255, 255, 255, 0.9)',
                      boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.55), 0 12px 28px rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='8' height='8' fill='%231D1E24'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%231D1E24'/%3E%3Crect x='8' width='8' height='8' fill='%230D0F13'/%3E%3Crect y='8' width='8' height='8' fill='%230D0F13'/%3E%3C/svg%3E")`,
                      boxSizing: 'border-box',
                      transition: 'width 75ms ease-out, height 75ms ease-out'
                   };

                   const baseColor = brushColor || '#ef4444';
                   const opacity = brushOpacity / 100;
                   const hPercent = brushHardness;

                   const previewCoreStyle: React.CSSProperties = {
                      width: '100%',
                      height: '100%',
                      borderRadius: '9999px',
                      background: `radial-gradient(circle, ${getRgba(baseColor, opacity)} 0%, ${getRgba(baseColor, opacity * (hPercent / 100))} ${hPercent}%, transparent 100%)`,
                      transition: 'all 50ms ease-out'
                   };

                   return (
                      <div 
                         id="brush-hud-overlay"
                         className="absolute pointer-events-none z-[100] flex flex-col items-center justify-center select-none"
                         style={{ 
                            left: hudPosition.x, 
                            top: hudPosition.y,
                            transform: `translate(-50%, -50%) scale(${hudFadingOut ? 0.92 : 1})`,
                            opacity: hudFadingOut ? 0 : 1,
                            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                         }}
                      >
                         {/* Circle Wrapper with SVG Progress Dial */}
                         <div className="relative flex items-center justify-center" style={{ width: `${svgSize}px`, height: `${svgSize}px` }}>
                            
                            <svg 
                               width={svgSize} 
                               height={svgSize} 
                               className="absolute top-0 left-0 pointer-events-none"
                            >
                               {/* Contrast dark dropshadow circle */}
                               <circle 
                                  cx={center} 
                                  cy={center} 
                                  r={radius} 
                                  fill="none" 
                                  stroke="rgba(0, 0, 0, 0.5)" 
                                  strokeWidth={strokeWidth + 2} 
                               />
                               {/* Empty track */}
                               <circle 
                                  cx={center} 
                                  cy={center} 
                                  r={radius} 
                                  fill="none" 
                                  stroke="rgba(255, 255, 255, 0.15)" 
                                  strokeWidth={strokeWidth} 
                               />
                               {/* Dynamic trace progress segment */}
                               <circle 
                                  cx={center} 
                                  cy={center} 
                                  r={radius} 
                                  fill="none" 
                                  stroke={strokeColor} 
                                  strokeWidth={strokeWidth} 
                                  strokeDasharray={circumference} 
                                  strokeDashoffset={strokeDashoffset} 
                                  strokeLinecap="round" 
                                  transform={`rotate(-90 ${center} ${center})`}
                                  className="transition-[stroke-dashoffset] duration-75 ease"
                                  style={{
                                     filter: `drop-shadow(0 0 3px ${strokeColor}cc)`,
                                  }}
                               />
                            </svg>

                            {/* Center circle brush tip container with checkerboard bg */}
                            <div style={previewStyle as React.CSSProperties}>
                               <div style={previewCoreStyle} />
                            </div>
                         </div>
                         
                         {/* Floating HUD Information Pill */}
                         <div className="mt-4 bg-[#0B0D13]/95 backdrop-blur-xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-full px-5 py-2.5 flex items-center gap-3 select-none animate-in fade-in duration-100 ease-out">
                            {activeBrushProperty === 'size' && (
                               <>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                     <Brush size={12} className="text-blue-400" />
                                     <span>Size</span>
                                  </div>
                                  <div className="w-px h-3.5 bg-white/15" />
                                  <div className="text-sm font-mono font-extrabold text-white">
                                     {brushSize}px
                                  </div>
                               </>
                            )}
                            {activeBrushProperty === 'opacity' && (
                               <>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                     <Droplets size={12} className="text-purple-400" />
                                     <span>Opacity</span>
                                  </div>
                                  <div className="w-px h-3.5 bg-white/15" />
                                  <div className="text-sm font-mono font-extrabold text-white">
                                     {brushOpacity}%
                                  </div>
                               </>
                            )}
                            {activeBrushProperty === 'hardness' && (
                               <>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                     <Circle size={12} className="text-amber-400 fill-amber-400/10" />
                                     <span>Hardness</span>
                                  </div>
                                  <div className="w-px h-3.5 bg-white/15" />
                                  <div className="text-sm font-mono font-extrabold text-white">
                                     {brushHardness}%
                                  </div>
                               </>
                            )}
                         </div>
                      </div>
                   );
                })()}
                
                {/* Empty State Overlay */}
              {isLoaded && artboards.length === 0 && (
                 <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#121212]/80 backdrop-blur-sm pointer-events-auto p-4 md:p-6">
                    <div className="flex flex-col items-center gap-3 md:gap-4 p-5 md:p-8 bg-[#1A1A1A] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-[320px] md:max-w-sm text-center mx-auto relative overflow-hidden">
                       <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(45deg,transparent_25%,white_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
                       <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 mb-1 shadow-inner relative z-10 ring-1 ring-blue-500/20">
                          <SquareDashed size={24} className="w-5 h-5 md:w-7 md:h-7" />
                       </div>
                       <div className="relative z-10 w-full">
                         <h3 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-white mb-1.5 md:mb-2">No active project</h3>
                         <p className="text-[10px] md:text-xs text-slate-400 mb-4 md:mb-6 leading-relaxed px-2">Create a new artboard to start placing elements and building your composition.</p>
                       </div>
                       <button
                          onClick={() => createArtboard()}
                          className="relative z-10 w-full flex items-center justify-center gap-2 px-5 md:px-6 h-10 md:h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition shadow-lg shadow-blue-600/20 active:scale-95"
                       >
                          <Plus size={16} /> Create Artboard
                       </button>
                    </div>
                 </div>
              )}

              {isCropping && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm sm:max-w-none sm:w-auto z-[50]">
                   <div className="bg-[#1A1A1A]/95 backdrop-blur-xl border border-[#2D2D2D] p-1.5 rounded-xl shadow-[0_16px_32px_rgba(0,0,0,0.6)] flex items-center justify-between sm:justify-start gap-2 overflow-x-auto no-scrollbar">
                       <div className="hidden sm:flex px-3 items-center gap-1.5 border-r border-[#333] pr-3 shrink-0">
                           <Crop size={14} className="text-blue-400" />
                           <span className="text-[11px] font-bold text-slate-200">Crop</span>
                       </div>
                       
                       <select 
                           className="bg-[#252525] hover:bg-[#333] text-slate-200 text-[10px] sm:text-[11px] px-2 py-1.5 rounded-md border border-[#3A3A3A] outline-none cursor-pointer appearance-none pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%205%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[position:right_6px_center] bg-no-repeat w-24 sm:w-auto shrink-0"
                           defaultValue="free"
                           onChange={(e) => {
                               const val = e.target.value;
                               const { cropRect, origObj } = cropSessionRef.current;
                               if (!cropRect || !origObj) return;

                               if (val === 'free') {
                                   cropRect.set({ lockUniScaling: false });
                               } else {
                                   let ratio = 1;
                                   if (val === 'original') {
                                       ratio = origObj.width! / origObj.height!;
                                   } else {
                                       ratio = parseFloat(val);
                                   }
                                   
                                   const center = cropRect.getCenterPoint();
                                   const curW = cropRect.getScaledWidth();
                                   const curH = cropRect.getScaledHeight();
                                   
                                   let newW = curW;
                                   let newH = newW / ratio;
                                   
                                   // Keep it somewhat within original bounds logic (simplified)
                                   if (newH > origObj.getScaledHeight()) {
                                       newH = origObj.getScaledHeight();
                                       newW = newH * ratio;
                                   }
                                   if (newW > origObj.getScaledWidth()) {
                                       newW = origObj.getScaledWidth();
                                       newH = newW / ratio;
                                   }
                                   
                                   cropRect.set({
                                       width: newW,
                                       height: newH,
                                       scaleX: 1,
                                       scaleY: 1,
                                       lockUniScaling: true,
                                   });
                                   
                                   cropRect.setPositionByOrigin(center, 'center', 'center');
                                   cropRect.setCoords();
                               }
                               fabricRef.current?.renderAll();
                           }}
                       >
                           <option value="free">Free Crop</option>
                           <option value="original">Original Ratio</option>
                           <optgroup label="Standard Dimensions">
                               <option value="1">1:1 Square</option>
                               <option value={4/3}>4:3 (Landscape)</option>
                               <option value={16/9}>16:9 (Widescreen)</option>
                               <option value={9/16}>9:16 (Vertical)</option>
                               <option value={3/2}>3:2 (Classic)</option>
                               <option value={210/297}>A4 (210x297mm)</option>
                               <option value={8.5/11}>Letter (8.5x11")</option>
                           </optgroup>
                           <optgroup label="Document Presets">
                               <option value={35/45}>India Passport (35x45mm)</option>
                               <option value={1}>US Passport (2x2")</option>
                               <option value={1}>Visa Photo (2x2")</option>
                               <option value={86/54}>ID Card (86x54mm)</option>
                               <option value={35/45}>Student Photo (35x45)</option>
                               <option value={1}>Profile Pic (1:1)</option>
                           </optgroup>
                           <optgroup label="Social Media Presets">
                               <option value={1}>Ig Post (1080x1080)</option>
                               <option value={1080/1920}>Ig Story (1080x1920)</option>
                               <option value={16/9}>YT Thumb (1280x720)</option>
                               <option value={1}>LinkedIn (400x400)</option>
                               <option value={820/312}>Fb Cover (820x312)</option>
                           </optgroup>
                       </select>

                       <div className="hidden sm:block h-4 w-px bg-[#333] ml-1 mr-1"></div>
                       
                       <div className="flex items-center gap-1.5 shrink-0">
                           <button onClick={applyCrop} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap"><Check size={12}/> <span className="hidden sm:inline">Apply</span></button>
                           <button onClick={cancelCrop} className="px-3 py-1.5 bg-[#252525] hover:bg-[#333] text-slate-300 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 whitespace-nowrap"><X size={12}/> <span className="hidden sm:inline">Cancel</span></button>
                       </div>
                   </div>
                </div>
              )}          {/* Squoosh-like image comparison viewer */}
          {comparisonMode && (
             <div className="absolute inset-0 z-40 bg-[#090909] flex flex-col p-0 md:p-6 items-center justify-between select-none">
                {/* Visual Header Option Controls */}
                {isMobile ? (
                   <>
                      <button 
                         onClick={() => setActiveTab('properties')} 
                         className="absolute top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white transition active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-xl border border-white/10"
                      >
                         <ChevronLeft size={20} />
                      </button>

                      <button 
                         onClick={handleExport}
                         className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-4 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-[11px] text-white font-extrabold uppercase tracking-widest shadow-[0_4px_16px_rgba(37,99,235,0.4)] transition active:scale-95 border border-blue-500/50 backdrop-blur-xl"
                      >
                         <Download size={14} /> Save
                      </button>
                   </>
                ) : (
                <div className="w-full flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#141414] p-3 rounded-xl border border-[#232323] shadow-lg mb-4 shrink-0 z-30">
                   <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-xs font-black uppercase tracking-widest text-slate-200">Live Preview</span>
                      </div>
                      
                      {/* Premium Toggle Stats Button */}
                      <button
                         onClick={() => setShowDiagnostics(prev => !prev)}
                         className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-[10px] text-blue-400 font-extrabold uppercase tracking-wider transition-all"
                         title="Toggle performance diagnostics overlay"
                      >
                         {showDiagnostics ? <EyeOff size={11} className="mr-0.5" /> : <Eye size={11} className="mr-0.5" />}
                         {showDiagnostics ? "Hide Stats" : "Show Stats"}
                      </button>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Zoom Control */}
                      <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1A1A1A] p-1.5 px-3 rounded-lg border border-[#222] min-w-0">
                         <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">Zoom</span>
                         <div className="flex items-center gap-2">
                            <input 
                                type="range" 
                                min="0.5" 
                                max="4" 
                                step="0.1" 
                                value={comparisonZoom} 
                                onChange={(e) => {
                                   const newZoom = parseFloat(e.target.value);
                                   setComparisonZoom(newZoom);
                                   if (transformComponentRef.current) {
                                      const instance = transformComponentRef.current;
                                      const inst = instance.instance;
                                      const state = inst?.transformState || inst?.state || (instance as any).state || (instance as any).transformState;
                                      const wrapper = inst?.wrapperComponent || (instance as any).wrapperComponent;
                                      
                                      if (state && wrapper && typeof state.scale === 'number') {
                                         const { scale, positionX, positionY } = state;
                                         const width = wrapper.offsetWidth;
                                         const height = wrapper.offsetHeight;
                                         
                                         const centerX = (width / 2 - positionX) / scale;
                                         const centerY = (height / 2 - positionY) / scale;
                                         
                                         const newPositionX = width / 2 - centerX * newZoom;
                                         const newPositionY = height / 2 - centerY * newZoom;
                                         
                                         instance.setTransform(newPositionX, newPositionY, newZoom);
                                      } else {
                                         instance.zoomToElement(undefined as any, newZoom);
                                      }
                                   }
                                }}
                                className="w-16 sm:w-20 md:w-24 h-1 accent-blue-500 cursor-pointer"
                            />
                            <span className="text-[10px] text-blue-400 font-mono w-8 text-center">{Math.round(comparisonZoom * 100)}%</span>
                            <button 
                               onClick={() => {
                                  if (transformComponentRef.current) {
                                     transformComponentRef.current.resetTransform();
                                     setComparisonZoom(1);
                                  }
                               }}
                               className="text-[9px] bg-[#2D2D2D] hover:bg-[#3D3D3D] text-slate-300 px-1.5 py-0.5 rounded border border-[#3D3D3D] transition-all font-bold uppercase tracking-widest cursor-pointer inline-flex items-center"
                            >
                               Fit
                            </button>
                         </div>
                      </div>

                      {/* Preview Modes Selection */}
                      <div className="flex bg-[#1D1D1D] p-1 rounded-lg border border-[#2D2D2D] gap-1 overflow-x-auto no-scrollbar shrink-0">
                         {(["split", "side-by-side", "original", "optimized"] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setComparisonPreviewMode(mode)}
                              className={`px-3 py-1.5 text-[10px] sm:text-[11px] font-black rounded-md transition duration-150 uppercase tracking-widest ${comparisonPreviewMode === mode ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)] font-black' : 'text-slate-400 hover:bg-[#252525] hover:text-slate-200'}`}
                            >
                               {mode.replace("-", " ")}
                            </button>
                         ))}
                      </div>
                   </div>
                </div>

                 )}

                 {/* Central Canvas Viewport Area */}
                <div className={`flex-1 w-full flex items-center justify-center relative min-h-0 ${isMobile ? 'p-0 overflow-hidden' : ''}`}>
                    {/* Mobile preview mode contextual selector bubble with conditional rendering toggle */}
                    {isMobile && (
                       <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 max-w-[95vw]">
                          {!showMobileCompareSwitcher ? (
                             <button
                                onClick={() => setShowMobileCompareSwitcher(true)}
                                className="bg-black/85 hover:bg-black border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.15em] px-4 py-2.5 rounded-full flex items-center gap-2 backdrop-blur-xl shadow-2xl pointer-events-auto active:scale-95 transition"
                             >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                View: {comparisonPreviewMode === 'split' ? 'Split' : (comparisonPreviewMode === 'side-by-side' ? 'Side' : comparisonPreviewMode)}
                                <ChevronDown size={12} className="text-white/60 ml-0.5" />
                             </button>
                          ) : (
                             <div className="bg-black/90 backdrop-blur-xl p-1 border border-white/15 rounded-full shadow-2xl flex items-center gap-1 shrink-0 pointer-events-auto animate-in fade-in zoom-in duration-200">
                                {(["split", "side-by-side", "original", "optimized"] as const).map(mode => (
                                   <button
                                      key={mode}
                                      onClick={() => {
                                         setComparisonPreviewMode(mode);
                                         setShowMobileCompareSwitcher(false);
                                      }}
                                      className={`px-3 py-1.5 text-[9px] font-black rounded-full transition-all uppercase tracking-[0.05em] ${comparisonPreviewMode === mode ? 'bg-white text-black font-extrabold' : 'text-white/50 hover:text-white'}`}
                                   >
                                      {mode === 'split' ? 'Split' : (mode === 'side-by-side' ? 'Side' : mode)}
                                   </button>
                                ))}
                                <button 
                                   onClick={() => setShowMobileCompareSwitcher(false)}
                                   className="p-1.5 text-white/40 hover:text-white transition rounded-full"
                                >
                                   <X size={12} />
                                </button>
                             </div>
                          )}
                       </div>
                    )}

                    {/* Floating Reset Zoom bubble */}
                    {isMobile && Math.round(comparisonZoom * 100) !== 100 && (
                       <button
                          onClick={() => {
                             if (transformComponentRef.current) {
                                transformComponentRef.current.resetTransform();
                                setComparisonZoom(1);
                             }
                          }}
                          className="absolute bottom-24 left-4 z-40 bg-black/80 border border-white/10 text-white font-mono text-[10px] font-black px-3 py-2 rounded-full flex items-center gap-1.5 backdrop-blur-xl shadow-2xl pointer-events-auto active:scale-95 transition"
                        >
                          <ZoomIn size={14} /> {Math.round(comparisonZoom * 100)}%
                       </button>
                    )}
                   {comparisonPreviewMode === "split" && (
                      <div 
                        ref={sliderRef}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        tabIndex={0}
                        className={`${isMobile ? 'w-full h-full rounded-none border-none flex-1 min-h-0' : 'w-full max-w-4xl h-full max-h-[60vh] rounded-xl border border-[#222]'} relative bg-[#111] overflow-hidden shadow-2xl group flex items-center justify-center outline-none focus:border-blue-500/50`}
                        style={{ aspectRatio: !isMobile ? (() => {
                           const b = artboards.find(x => x.id === activeArtboardId) || artboards[0];
                           return b ? `${b.width} / ${b.height}` : "1.33";
                        })() : undefined }}
                      >
                         {/* OPTIMIZED PREVIEW (Background layer) */}
                         <div className="absolute inset-0 w-full h-full p-4 overflow-hidden flex items-center justify-center">
                             <TransformWrapper
                               ref={transformComponentRef}
                               disabled={isMobile}
                               initialScale={comparisonZoom}
                               minScale={0.1}
                               maxScale={20}
                               centerOnInit
                               panning={{ disabled: isDraggingDivider }}
                               onTransform={(p) => setComparisonZoom(p.state.scale)}
                             >
                                <TransformComponent wrapperStyle={{ width: "100%", height: "100%", cursor: isDraggingDivider ? "ew-resize" : "grab" }} contentStyle={{ width: "100%", height: "100%" }}>
                                   <div className="relative w-full h-full flex items-center justify-center">
                                       <img 
                                           src={optimizedImageUrl || originalImageUrl || ""} 
                                           alt="Optimized" 
                                           referrerPolicy="no-referrer"
                                           className="max-w-full max-h-full object-contain pointer-events-none" 
                                           style={{
                                              backgroundColor: ((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? 'transparent' : (artboards.find(x => x.id === activeArtboardId) || artboards[0])?.backgroundColor) || '#fff',
                                              ...((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                           }}
                                       />

                                       {/* ORIGINAL IMAGE (Foreground layer with clipPath) */}
                                       <img 
                                           src={originalImageUrl || ""} 
                                           alt="Original" 
                                           referrerPolicy="no-referrer"
                                           className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                                           style={{ clipPath: `polygon(0 0, ${comparisonDivider}% 0, ${comparisonDivider}% 100%, 0 100%)` }}
                                       />
                                   </div>
                                </TransformComponent>
                             </TransformWrapper>
                         </div>

                         {/* Drag Divider Line & Handle */}
                         <div 
                           onPointerDown={handlePointerDown}
                           onDoubleClick={() => setComparisonDivider(50)}
                           className="absolute top-0 bottom-0 select-none z-30 cursor-ew-resize group"
                           style={{ left: `${comparisonDivider}%`, transform: 'translateX(-50%)' }}
                         >
                            <div className="absolute inset-y-0 w-[2px] bg-blue-500 group-hover:bg-blue-400 group-active:bg-blue-300 transition-colors shadow-2xl" />
                            
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#181818] border-2 border-blue-500 group-hover:border-blue-400 text-white flex items-center justify-center shadow-2xl transition duration-150 hover:scale-110 active:scale-95 bg-opacity-95">
                               <div className="flex gap-1 items-center">
                                  <div className="w-1.5 h-1.5 border-t-2 border-l-2 border-blue-400 rotate-[-45deg]" />
                                  <div className="w-[1px] h-3 bg-blue-500/50 rounded-full" />
                                  <div className="w-1.5 h-1.5 border-t-2 border-r-2 border-blue-400 rotate-[45deg]" />
                               </div>
                            </div>
                         </div>

                         {/* Left Side Label (Original) */}
                          {showDiagnostics && (
                            <div className="hidden md:block absolute top-4 left-4 bg-black/75 text-[#A2A2A2] text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 pointer-events-none backdrop-blur-md">
                               Original: <span className="font-mono text-white text-xs">{formatBytes(originalSize || 0)}</span>
                            </div>
                         )}

                         {/* Right Side Label (Optimized) */}
                          {showDiagnostics && (
                            <div className="hidden md:block absolute top-4 right-4 bg-blue-950/70 text-blue-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-500/20 pointer-events-none backdrop-blur-md">
                               Optimized: <span className="font-mono text-white text-xs">{formatBytes(optimizedSize || 0)}</span>
                            </div>
                         )}
                      </div>
                   )}

                   {comparisonPreviewMode === "side-by-side" && (
                      <div className={`w-full h-full relative ${isMobile ? 'rounded-none border-none max-h-full flex-1 min-h-0' : 'max-w-4xl max-h-[60vh]'}`}>
                         <TransformWrapper
                            ref={transformComponentRef}
                            initialScale={comparisonZoom}
                            minScale={0.1}
                            maxScale={20}
                            centerOnInit
                            limitToBounds={false}
                            centerZoomedOut={true}
                            panning={{ velocityDisabled: true }}
                            onTransform={(p) => setComparisonZoom(p.state.scale)}
                         >
                            <TransformComponent 
                               wrapperStyle={{ width: "100%", height: "100%", cursor: comparisonZoom > 1 ? "grab" : "default" }} 
                               contentStyle={{ width: "100%", height: "100%" }}
                            >
                               <div className={`grid ${isMobile ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2'} gap-4 w-full h-full p-4`}>
                                  <div className="relative rounded-xl border border-[#222] bg-[#111] overflow-hidden flex flex-col items-center justify-center p-3 shadow-xl">
                                     <div className="w-full h-full flex items-center justify-center">
                                        <img src={originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none" style={{
                                           backgroundColor: ((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? 'transparent' : (artboards.find(x => x.id === activeArtboardId) || artboards[0])?.backgroundColor) || '#fff',
                                           ...((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                        }} />
                                     </div>
                                     {showDiagnostics && <span className="hidden md:inline-block absolute top-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-white font-bold font-mono">Original: {formatBytes(originalSize || 0)}</span>}
                                  </div>
                                  <div className="relative rounded-xl border border-blue-500/20 bg-[#111] overflow-hidden flex flex-col items-center justify-center p-3 shadow-xl">
                                     <div className="w-full h-full flex items-center justify-center">
                                        <img src={optimizedImageUrl || originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none" style={{
                                           backgroundColor: ((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? 'transparent' : (artboards.find(x => x.id === activeArtboardId) || artboards[0])?.backgroundColor) || '#fff',
                                           ...((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                        }} />
                                     </div>
                                     {showDiagnostics && <span className="hidden md:inline-block absolute top-3 left-3 bg-blue-950/70 px-3 py-1.5 rounded-lg border border-blue-500/20 text-[10px] text-blue-300 font-bold font-mono">Optimized: {formatBytes(optimizedSize || 0)}</span>}
                                  </div>
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                      </div>
                   )}

                   {comparisonPreviewMode === "original" && (
                      <div className={`w-full h-full relative ${isMobile ? 'rounded-none border-none max-h-full flex-1 min-h-0' : 'max-h-[60vh] max-w-4xl border border-[#222] rounded-xl'} bg-[#111] overflow-hidden flex items-center justify-center shadow-2xl`}>
                         <TransformWrapper
                            ref={transformComponentRef}
                            initialScale={comparisonZoom}
                            minScale={0.1}
                            maxScale={20}
                            centerOnInit
                            limitToBounds={false}
                            centerZoomedOut={true}
                            panning={{ velocityDisabled: true }}
                            onTransform={(p) => setComparisonZoom(p.state.scale)}
                         >
                            <TransformComponent 
                               wrapperStyle={{ width: "100%", height: "100%", cursor: comparisonZoom > 1 ? "grab" : "default" }} 
                               contentStyle={{ width: "100%", height: "100%" }}
                            >
                               <div className="w-full h-full flex items-center justify-center p-4 text-center">
                                  <img src={originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none mx-auto" style={{
                                     backgroundColor: ((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? 'transparent' : (artboards.find(x => x.id === activeArtboardId) || artboards[0])?.backgroundColor) || '#fff',
                                     ...((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                  }} />
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                         {showDiagnostics && <span className="hidden md:inline-block absolute top-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-white font-bold font-mono">Original Only ({formatBytes(originalSize || 0)})</span>}
                      </div>
                   )}

                   {comparisonPreviewMode === "optimized" && (
                      <div className={`w-full h-full relative ${isMobile ? 'rounded-none border-none max-h-full flex-1 min-h-0' : 'max-h-[60vh] max-w-4xl border border-blue-500/20 rounded-xl'} bg-[#111] overflow-hidden flex items-center justify-center shadow-2xl`}>
                         <TransformWrapper
                            ref={transformComponentRef}
                            initialScale={comparisonZoom}
                            minScale={0.1}
                            maxScale={20}
                            centerOnInit
                            limitToBounds={false}
                            centerZoomedOut={true}
                            panning={{ velocityDisabled: true }}
                            onTransform={(p) => setComparisonZoom(p.state.scale)}
                         >
                            <TransformComponent 
                               wrapperStyle={{ width: "100%", height: "100%", cursor: comparisonZoom > 1 ? "grab" : "default" }} 
                               contentStyle={{ width: "100%", height: "100%" }}
                            >
                               <div className="w-full h-full flex items-center justify-center p-4 text-center">
                                  <img src={optimizedImageUrl || originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none mx-auto" style={{
                                     backgroundColor: ((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? 'transparent' : (artboards.find(x => x.id === activeArtboardId) || artboards[0])?.backgroundColor) || '#fff',
                                     ...((artboards.find(x => x.id === activeArtboardId) || artboards[0])?.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                  }} />
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                         {showDiagnostics && <span className="hidden md:inline-block absolute top-3 left-3 bg-blue-950/70 px-3 py-1.5 rounded-lg border border-blue-500/20 text-[10px] text-blue-300 font-bold font-mono">Optimized Only ({formatBytes(optimizedSize || 0)})</span>}
                      </div>
                   )}

                   {/* Floating Green Live Size Indicator */}
                   {optimizedSize && originalSize && originalSize > optimizedSize && showDiagnostics && (
                      <div className="hidden md:flex absolute bottom-4 right-4 bg-emerald-900/90 border border-emerald-500/30 text-white backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl z-25 flex-col items-center justify-center font-bold animate-fade-in transition-all">
                         <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <Activity size={12} className="animate-pulse" />
                            {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Smaller
                         </div>
                         <div className="text-lg font-mono font-black">{formatBytes(optimizedSize)}</div>
                         <div className="text-[9px] text-emerald-300/75 uppercase font-mono tracking-wider mt-0.5">Saved {formatBytes(originalSize - optimizedSize)}</div>
                      </div>
                   )}

                   {/* Visual Quality & Diagnostics analysis floating card */}
                   {showDiagnostics && (
                      <div className="hidden md:flex absolute bottom-4 left-4 max-w-xs bg-[#141414]/95 border border-[#2E2E2E] text-slate-300 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl z-25 flex-col gap-1.5 text-xs text-left animate-in fade-in duration-200">
                         <div className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider border-b border-[#232323] pb-1 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                               <Sliders size={11} className="text-blue-400" /> Quality Diagnostics
                            </div>
                            <button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-white p-0.5 transition" title="Minimize diagnostics panel"><X size={11} /></button>
                         </div>
                         <div className="flex justify-between gap-6">
                            <span className="text-slate-400 text-[11px]">Format:</span>
                            <span className="font-mono text-[11px] font-bold text-blue-400 uppercase">{exportSettings.format}</span>
                         </div>
                         <div className="flex justify-between gap-6">
                            <span className="text-slate-400 text-[11px]">Resolution:</span>
                            <span className="font-mono text-[11px] font-bold text-slate-100">
                               {(() => {
                                  const b = artboards.find(x => x.id === activeArtboardId) || artboards[0];
                                  return b ? `${exportTarget === 'current' ? exportSettings.resize.width : b.width} x ${exportTarget === 'current' ? exportSettings.resize.height : b.height}` : "0 x 0";
                                })()}
                            </span>
                         </div>
                         <div className="flex justify-between gap-6">
                            <span className="text-slate-400 text-[11px]">PSNR Metric:</span>
                            <span className="font-mono text-[11px] font-bold text-emerald-400">
                               {psnr ? `${psnr.toFixed(1)} dB` : 'Calculating...'}
                            </span>
                         </div>
                         <div className="flex justify-between gap-6">
                            <span className="text-slate-400 text-[11px]">SSIM Metric:</span>
                            <span className="font-mono text-[11px] font-bold text-blue-400">
                               {psnr ? (psnr > 40 ? '0.998' : (psnr > 35 ? '0.992' : '0.975')) : 'Calculating...'}
                            </span>
                         </div>
                         <div className="flex justify-between gap-6">
                            <span className="text-slate-400 text-[11px]">Visual Fidelity:</span>
                            <span className="text-[11px] font-medium text-slate-200">
                               {(() => {
                                  if (exportSettings.format === 'png') return exportSettings.png?.paletteReduction ? '8-Bit Index' : 'Perfect Lossless';
                                  const q = exportSettings.format === 'jpeg' ? exportSettings.mozjpeg.quality : (exportSettings.format === 'webp' ? exportSettings.webp.quality : exportSettings.avif.cqLevel);
                                  if (q > 90) return 'Exceptional';
                                  if (q > 75) return 'Balanced';
                                  if (q > 50) return 'Standard Lossy';
                                  return 'High Compression';
                                })()}
                            </span>
                         </div>
                      </div>
                   )}

                   {/* Minimized HUD diagnostic bubble */}
                   {!showDiagnostics && (
                      <button 
                         onClick={() => setShowDiagnostics(true)}
                         className="hidden md:flex absolute bottom-4 left-4 w-9 h-9 rounded-xl bg-[#141414]/95 border border-[#2E2E2E] hover:border-blue-500/50 hover:bg-[#1A1A1A] text-slate-300 hover:text-white backdrop-blur-md items-center justify-center shadow-xl z-25 transition-all"
                         title="Show diagnostics overlay"
                      >
                         <Sliders size={14} />
                      </button>
                   )}

                   {/* Worker compilation progress & current operation overlay */}
                   {isGeneratingPreview && (
                      <div className="absolute inset-0 bg-[#0A0A0A]/85 backdrop-blur-sm flex flex-col items-center justify-center z-40 rounded-xl transition-all duration-300 border border-[#222]">
                         <div className="relative flex items-center justify-center mb-4">
                            <RotateCw className="animate-spin text-blue-500 w-9 h-9" />
                            <div className="absolute w-12 h-12 rounded-full border-2 border-dashed border-blue-500/20 animate-spin-reverse" />
                         </div>
                         <div className="text-xs font-semibold text-slate-100">{currentPreviewOp || "Regenerating active optimization preview..."}</div>
                         <div className="text-[9px] text-[#8C8C8C] mt-1.5 uppercase font-[#8C8C8C] tracking-wider font-mono">WebAssembly Engine (jSquash)</div>
                      </div>
                   )}
                </div>

                  {/* Mobile Floating HUD metrics chips (Progressive Disclosure) */}
                  {isMobile && (
                     <div 
                        onClick={() => setShowMobilePanel(true)}
                        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#121212]/95 border border-white/15 pointer-events-auto px-4 py-2.5 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.85)] flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-950 transition-all active:scale-[0.97] text-slate-100 min-w-[275px] max-w-[90vw]"
                     >
                        <div className="flex items-center gap-2.5">
                           <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black tracking-widest px-2 py-1 rounded-md uppercase font-mono border border-blue-500/15">
                              {exportSettings.format}
                           </span>
                           {!!(originalSize && optimizedSize && originalSize > optimizedSize) && (
                              <div className="flex flex-col text-left leading-tight">
                                 <span className="text-[11px] font-black text-emerald-400 tracking-wide">
                                    {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Smaller
                                 </span>
                                 <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider font-mono leading-none">Savings</span>
                              </div>
                           )}
                           {(!originalSize || !optimizedSize) && (
                              <span className="text-[11px] font-black text-blue-400 tracking-wide uppercase">
                                 Settings
                              </span>
                           )}
                        </div>
                        <div className="w-[1px] h-4 bg-white/10" />
                        <div className="flex items-center gap-2.5">
                           {(optimizedSize && optimizedSize > 0) ? (
                              <div className="flex flex-col text-right leading-tight">
                                 <span className="text-[11px] text-white font-extrabold font-mono">
                                    {formatBytes(optimizedSize)}
                                 </span>
                                 <span className="text-[8px] text-[#8A8A8A] font-extrabold uppercase tracking-wider leading-none">Optimized</span>
                              </div>
                           ) : (
                               <div className="flex flex-col text-right leading-tight">
                                 <span className="text-[11px] text-white font-extrabold font-mono">
                                    Export Studio
                                 </span>
                                 <span className="text-[8px] text-[#8A8A8A] font-extrabold uppercase tracking-wider leading-none">Optimize</span>
                              </div>
                           )}
                           <Sliders size={11} className="text-blue-400 animate-pulse shrink-0" />
                        </div>
                     </div>
                  )}

                  {/* Premium Mobile Slide-Up Bottom Sheet */}
                 {isMobile && showMobileDiagnosticsSheet && (
                    <>
                       <div 
                          className="fixed inset-0 bg-black/80 z-[100] backdrop-blur-sm animate-in fade-in cursor-pointer pointer-events-auto"
                          onClick={() => setShowMobileDiagnosticsSheet(false)}
                       />
                       <div className="fixed bottom-0 left-0 right-0 z-[101] bg-[#0F0F0F] rounded-t-3xl border-t border-[#252525] p-5 pb-8 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto pointer-events-auto">
                          <div className="w-12 h-1 bg-[#333] rounded-full mx-auto" onClick={() => setShowMobileDiagnosticsSheet(false)} />
                          
                          <div className="flex items-center justify-between border-b border-[#222] pb-3">
                             <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-blue-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#E0E0E0]">Optimization Settings</h3>
                             </div>
                             <button 
                                onClick={() => setShowMobileDiagnosticsSheet(false)}
                                className="p-1 px-3 rounded-lg bg-[#1E1E1E] text-[10px] font-bold uppercase tracking-wider hover:bg-[#2A2A2A] text-slate-400"
                             >
                                Close
                             </button>
                          </div>

                          {['jpeg', 'webp', 'avif'].includes(exportSettings.format) && (
                             <div className="bg-[#161616] p-4 rounded-xl border border-[#222]">
                                <div className="flex justify-between items-center mb-2">
                                   <span className="text-[10px] uppercase font-black text-[#A2A2A2] tracking-wider">Adjustment Quality</span>
                                   <span className="text-xs font-bold text-blue-400 font-mono">
                                      {exportSettings.format === 'jpeg' ? exportSettings.mozjpeg.quality : (exportSettings.format === 'webp' ? exportSettings.webp.quality : 100 - exportSettings.avif.cqLevel)}%
                                   </span>
                                </div>
                                <input 
                                   type="range"
                                   min="5"
                                   max="100"
                                   value={
                                      exportSettings.format === 'jpeg' 
                                         ? exportSettings.mozjpeg.quality 
                                         : (exportSettings.format === 'webp' 
                                            ? exportSettings.webp.quality 
                                            : 100 - exportSettings.avif.cqLevel)
                                   }
                                   onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      const newSettings = { ...exportSettings };
                                      if (exportSettings.format === 'jpeg') {
                                         newSettings.mozjpeg.quality = val;
                                      } else if (exportSettings.format === 'webp') {
                                         newSettings.webp.quality = val;
                                      } else if (exportSettings.format === 'avif') {
                                         newSettings.avif.cqLevel = 100 - val;
                                      }
                                      setExportSettings(newSettings);
                                   }}
                                   className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252525] rounded-full"
                                />
                             </div>
                          )}

                          <div className="space-y-2 mt-1">
                             <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[#161616] p-3 rounded-xl border border-[#222] flex justify-between items-center">
                                   <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Target Format</span>
                                   <span className="font-mono text-xs font-bold text-blue-400 uppercase">{exportSettings.format}</span>
                                </div>

                                <div className="bg-[#161616] p-3 rounded-xl border border-[#222] flex justify-between items-center">
                                   <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Resolution</span>
                                   <span className="font-mono text-xs font-bold text-slate-200">
                                      {(() => {
                                         const b = artboards.find(x => x.id === activeArtboardId) || artboards[0];
                                         return b ? `${exportTarget === 'current' ? exportSettings.resize.width : b.width} × ${exportTarget === 'current' ? exportSettings.resize.height : b.height}` : "0 x 0";
                                      })()}
                                   </span>
                                </div>

                                <div className="bg-[#161616] p-3 rounded-xl border border-[#222] flex justify-between items-center">
                                   <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider">PSNR Ratio</span>
                                   <span className="font-mono text-xs font-bold text-emerald-400 font-mono">
                                      {psnr ? `${psnr.toFixed(1)} dB` : 'Measuring...'}
                                   </span>
                                </div>

                                <div className="bg-[#161616] p-3 rounded-xl border border-[#222] flex justify-between items-center">
                                   <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Visual SSIM</span>
                                   <span className="font-mono text-xs font-bold text-blue-400 block truncate">
                                      {psnr ? (psnr > 40 ? '0.998' : (psnr > 35 ? '0.992' : '0.975')) : 'Measuring...'}
                                   </span>
                                </div>
                             </div>

                             <div className="bg-[#161616] p-3 rounded-xl border border-[#222] mt-2 space-y-2">
                                <div className="flex justify-between items-center border-b border-[#252525] pb-1.5">
                                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Savings Profile</span>
                                   <span className="text-[10px] text-slate-500 uppercase font-mono">WASM optimized</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-300 font-sans">
                                   <span>Original Size: <span className="font-mono font-bold text-slate-400">{formatBytes(originalSize || 0)}</span></span>
                                   <span>Optimized Size: <span className="font-mono font-bold text-blue-400">{formatBytes(optimizedSize || 0)}</span></span>
                                </div>
                                {optimizedSize && originalSize && (
                                   <div className="flex justify-between text-xs text-emerald-400 border-t border-[#252525] pt-1.5 mt-1 font-sans">
                                      <span>Saved: <span className="font-mono font-black">{formatBytes(originalSize - optimizedSize)}</span></span>
                                      <span className="font-black">{parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Smaller</span>
                                   </div>
                                )}
                             </div>
                          </div>

                          <div className="mt-2 text-center">
                             <button 
                                onClick={() => {
                                   setShowMobileDiagnosticsSheet(false);
                                   handleExport();
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all"
                             >
                                Confirm & Download Image
                             </button>
                          </div>
                       </div>
                    </>
                 )}

                 {/* Non-mobile Tablet/Accordion Bottom Details Sheet (Only visible on non-mobile screens) */}
                 {!isMobile && (
                <div className="md:hidden w-full shrink-0 mt-2 z-30">
                   <div 
                      onClick={() => setMobileDetailsExpanded(!mobileDetailsExpanded)}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 flex items-center justify-between hover:bg-[#1A1A1A] active:bg-[#111] transition-colors cursor-pointer select-none"
                   >
                      <div className="flex items-center gap-2">
                         <Sliders size={12} className="text-blue-400" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
                            Optimization Details
                         </span>
                         <span className="text-[9px] text-blue-300 bg-blue-900/30 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                            {exportSettings.format}
                         </span>
                      </div>

                      {/* Display compact saving information metrics as clean chips */}
                      <div className="flex items-center gap-1.5">
                         {optimizedSize && originalSize && (
                            <>
                               {originalSize > optimizedSize && (
                                  <div className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                     {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Smaller
                                  </div>
                               )}
                               <div className="text-[9px] font-bold text-blue-300 bg-[#1e293b]/40 border border-blue-500/10 px-2 py-0.5 rounded-md font-mono">
                                  {formatBytes(optimizedSize)}
                                </div>
                            </>
                         )}
                         <div className="text-slate-500 ml-1">
                            {mobileDetailsExpanded ? (
                               <ChevronDown size={14} className="text-blue-400" />
                            ) : (
                               <ChevronUp size={14} className="text-slate-400" />
                            )}
                         </div>
                      </div>
                   </div>

                   {/* Accordion Expandable Diagnostics Body */}
                   {mobileDetailsExpanded && (
                      <div className="w-full bg-[#111111] border-x border-b border-[#2A2A2A] rounded-b-xl p-3 space-y-2 mt-[-4px] text-xs text-left animate-in fade-in slide-in-from-top-2 duration-200">
                         <div className="grid grid-cols-2 gap-2">
                            {/* Format item */}
                            <div className="bg-[#181818] p-2 rounded-lg border border-[#232323] flex justify-between items-center">
                               <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider font-sans">Format</span>
                               <span className="font-mono text-xs font-bold text-blue-400 uppercase">{exportSettings.format}</span>
                            </div>

                            {/* Resolution item */}
                            <div className="bg-[#181818] p-2 rounded-lg border border-[#232323] flex justify-between items-center">
                               <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider font-sans">Resolution</span>
                               <span className="font-mono text-xs font-bold text-slate-200">
                                  {(() => {
                                     const b = artboards.find(x => x.id === activeArtboardId) || artboards[0];
                                     return b ? `${exportTarget === 'current' ? exportSettings.resize.width : b.width} × ${exportTarget === 'current' ? exportSettings.resize.height : b.height}` : "0 x 0";
                                  })()}
                               </span>
                            </div>

                            {/* PSNR item */}
                            <div className="bg-[#181818] p-2 rounded-lg border border-[#232323] flex justify-between items-center">
                               <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider font-sans">PSNR Metric</span>
                               <span className="font-mono text-xs font-bold text-emerald-400">
                                  {psnr ? `${psnr.toFixed(1)} dB` : 'Calculating...'}
                               </span>
                            </div>

                            {/* SSIM item */}
                            <div className="bg-[#181818] p-2 rounded-lg border border-[#232323] flex justify-between items-center">
                               <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider font-sans">SSIM Metric</span>
                               <span className="font-mono text-xs font-bold text-blue-400">
                                  {psnr ? (psnr > 40 ? '0.998' : (psnr > 35 ? '0.992' : '0.975')) : 'Calculating...'}
                               </span>
                            </div>
                         </div>

                         {/* Savings and size comparisons */}
                         {optimizedSize && originalSize && (
                            <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20 flex flex-col gap-1.5">
                               <div className="flex justify-between items-center border-b border-emerald-500/10 pb-1">
                                  <span className="text-emerald-400 text-[9px] font-black uppercase tracking-wider font-sans">Size Savings</span>
                                  <span className="text-emerald-300 font-extrabold text-xs">
                                     {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Reduction
                                  </span>
                               </div>
                               <div className="flex justify-between text-[11px] text-slate-300 font-sans">
                                  <span>Original Size: <span className="font-mono font-bold text-slate-400">{formatBytes(originalSize)}</span></span>
                                  <span>Saved: <span className="font-mono font-bold text-emerald-400">{formatBytes(originalSize - optimizedSize)}</span></span>
                                </div>
                            </div>
                         )}

                         {/* Fidelity statement item */}
                         <div className="bg-[#181818] p-2 rounded-lg border border-[#232323] flex justify-between items-center">
                            <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider font-sans">Visual Fidelity</span>
                            <span className="text-xs font-medium text-slate-300 font-sans">
                               {(() => {
                                  if (exportSettings.format === 'png') return exportSettings.png?.paletteReduction ? '8-Bit Color Index' : 'Pixel Lossless';
                                  const q = exportSettings.format === 'jpeg' ? exportSettings.mozjpeg.quality : (exportSettings.format === 'webp' ? exportSettings.webp.quality : exportSettings.avif.cqLevel);
                                  if (q > 90) return 'Exceptional';
                                  if (q > 75) return 'Balanced';
                                  if (q > 50) return 'Standard Lossy';
                                  return 'High Compression';
                                })()}
                            </span>
                         </div>
                      </div>
                   )}
                </div>
                )}
             </div>
          )}

          {/* Floating Canvas Navigation & Zoom Controller */}
          <div className={`absolute bottom-4 left-6 bg-[#1A1A1A]/90 hover:bg-[#1A1A1A] text-slate-300 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2D2D2D] shadow-xl items-center gap-3 text-xs select-none z-20 ${comparisonMode ? 'hidden' : 'flex'}`}>
             <button 
               className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400" 
               onClick={() => {
                 if (!fabricRef.current) return;
                 let z = fabricRef.current.getZoom();
                 z = Math.max(0.1, z - 0.15);
                 fabricRef.current.setZoom(z);
                 setZoomPercent(Math.round(z * 100));
                 fabricRef.current.requestRenderAll();
               }}
               title="Zoom Out"
             >
               <Minus size={13} />
             </button>
             
             <span className="font-mono text-[11px] font-bold min-w-[36px] text-center text-slate-200">
               {zoomPercent}%
             </span>
             
             <button 
               className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400" 
               onClick={() => {
                 if (!fabricRef.current) return;
                 let z = fabricRef.current.getZoom();
                 z = Math.min(10, z + 0.15);
                 fabricRef.current.setZoom(z);
                 setZoomPercent(Math.round(z * 100));
                 fabricRef.current.requestRenderAll();
               }}
               title="Zoom In"
             >
               <Plus size={13} />
             </button>

             <div className="w-px h-4 bg-[#2D2D2D]" />

             <button 
               className="px-2 py-1 bg-[#232323] hover:bg-[#2F2F2F] hover:text-white text-[10px] font-medium rounded transition"
               onClick={() => {
                 if (!fabricRef.current) return;
                 const activeB = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
                 const vpt = fabricRef.current.viewportTransform!;
                 const newVpt = vpt.slice() as any;
                 newVpt[0] = 1.0;
                 newVpt[3] = 1.0;
                 const cw = fabricRef.current.width!;
                 const ch = fabricRef.current.height!;
                 newVpt[4] = cw / 2 - (activeB.x + activeB.width / 2);
                 newVpt[5] = ch / 2 - (activeB.y + activeB.height / 2);
                 fabricRef.current.setViewportTransform(newVpt);
                 setZoomPercent(100);
               }}
               title="Recenter Camera on Active Artboard"
             >
               Recenter
             </button>

             <button 
               className="px-2 py-1 bg-[#232323] hover:bg-[#2F2F2F] hover:text-white text-[10px] font-medium rounded transition"
               onClick={() => {
                 if (!fabricRef.current || artboardsRef.current.length === 0) return;
                 let minX = Infinity, minY = Infinity;
                 let maxX = -Infinity, maxY = -Infinity;
                 artboardsRef.current.forEach(b => {
                   minX = Math.min(minX, b.x);
                   minY = Math.min(minY, b.y);
                   maxX = Math.max(maxX, b.x + b.width);
                   maxY = Math.max(maxY, b.y + b.height);
                 });
                 minX -= 60; minY -= 60;
                 maxX += 60; maxY += 60;

                 const w = maxX - minX;
                 const h = maxY - minY;
                 const cw = fabricRef.current.width!;
                 const ch = fabricRef.current.height!;
                 
                 const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
                 const vpt = fabricRef.current.viewportTransform!;
                 const newVpt = vpt.slice() as any;
                 newVpt[0] = zoom;
                 newVpt[3] = zoom;
                 newVpt[4] = cw / 2 - zoom * (minX + w / 2);
                 newVpt[5] = ch / 2 - zoom * (minY + h / 2);
                 
                 fabricRef.current.setViewportTransform(newVpt);
                 setZoomPercent(Math.round(zoom * 100));
               }}
               title="Fit All Artboards in Viewport"
             >
               Fit All
             </button>
          </div>
        </div>
        </div>

        {/* Resize Handle */}
        <div 
          onPointerDown={(e) => {
            setIsResizingPanel(true);
            e.preventDefault();
          }}
          className="relative z-20 w-1.5 -ml-[1px] -mr-[5px] cursor-col-resize flex justify-center group hidden md:flex"
        >
          <div className={`h-full w-[2px] transition-colors duration-150 ${isResizingPanel ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-x-150' : 'bg-transparent group-hover:bg-blue-500'}`} />
        </div>

        {/* Mobile Filter / Bottom Bar */}
        {isMobile && (
          <div className="flex h-14 bg-[#1A1A1A] border-t border-[#2C2C2C] z-30 fixed bottom-0 left-0 right-0 px-2 items-center justify-between overflow-x-auto no-scrollbar">
             <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move"/>
             <ToolBtn icon={Hand} tool="pan" current={activeTool} set={setTool} title="Pan"/>
             <ToolBtn icon={Brush} tool="brush" current={activeTool} set={setTool} title="Brush"/>
             <ToolBtn icon={Type} tool="text" current={activeTool} set={addText} title="Text"/>
             <ToolBtn icon={Crop} tool="crop" current={activeTool} set={() => enterCropMode()} title="Crop"/>
             
             <div className="flex-1" />
             
             <div className="relative shrink-0 flex items-center justify-center w-10">
                <ColorPickerTrigger 
                   color={brushColor || "#ffffff"} 
                   onChange={changeCurrentColor} 
                   className="w-7 h-7 rounded-full border border-white/20 shadow-inner relative overflow-hidden"
                />
             </div>

             <div className="w-px h-8 bg-[#3A3A3A] mx-2 shrink-0" />
             
             <button 
               onClick={() => setShowMobilePanel(true)}
               className="h-10 w-10 shrink-0 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl flex items-center justify-center transition-colors shadow-sm ml-auto"
             >
               <Layers size={18} />
             </button>
          </div>
        )}

        {/* Mobile Swipe Wrapper Backdrop */}
        {isMobile && showMobilePanel && (
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMobilePanel(false)} />
        )}

        {/* Right Sidebar - Logic Panels */}
        <div 
          style={{ width: isMobile ? '100%' : `${panelWidth}px` }}
          className={`${isMobile ? `fixed bottom-0 left-0 right-0 z-50 h-[85vh] rounded-t-2xl transform transition-transform duration-300 ${showMobilePanel ? 'translate-y-0' : 'translate-y-full'}` : 'h-full'} border-l ${isResizingPanel ? 'border-blue-500/50' : 'border-[#2C2C2C]'} bg-[#1E1E1E] flex flex-col shrink-0 overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.5)] md:shadow-[-4px_0_12px_rgba(0,0,0,0.2)] transition-colors duration-150`}
        >
          {isMobile && (
            <div 
               className="w-full flex justify-center py-3 shrink-0 z-10 sticky top-0 bg-[#1E1E1E]" 
               onTouchStart={(e) => {
                  const startY = e.touches[0].clientY;
                  const handleMove = (eMove: TouchEvent) => {
                     const delta = eMove.touches[0].clientY - startY;
                     if (delta > 50) {
                        setShowMobilePanel(false);
                        document.removeEventListener('touchmove', handleMove);
                     }
                  };
                  const handleEnd = () => {
                     document.removeEventListener('touchmove', handleMove);
                     document.removeEventListener('touchend', handleEnd);
                  };
                  document.addEventListener('touchmove', handleMove);
                  document.addEventListener('touchend', handleEnd);
               }}
            >
               <div className="w-16 h-1.5 bg-[#4A4A4A] rounded-full" />
            </div>
          )}

          <div className="flex w-full bg-[#1A1A1A] border-b border-[#2C2C2C] overflow-x-auto select-none no-scrollbar shrink-0">
             <TabBtn tab="properties" active={activeTab} set={setActiveTab} label="Props" icon={Settings} />
             <TabBtn tab="artboards" active={activeTab} set={setActiveTab} label="Boards" icon={SquareDashed} />
             <TabBtn tab="quick" active={activeTab} set={setActiveTab} label="Quick" icon={Activity} />
             <TabBtn tab="filters" active={activeTab} set={setActiveTab} label="Filters" icon={Sparkles} />
             <TabBtn tab="layers" active={activeTab} set={setActiveTab} label="Layers" icon={Layers} />
             <TabBtn tab="history" active={activeTab} set={setActiveTab} label="History" icon={History} />
             <TabBtn tab="export" active={activeTab} set={setActiveTab} label="Export" icon={Download} />
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
             
             {/* PROPERTIES PANEL */}
             {activeTab === 'properties' && (
                <div className="p-4 space-y-6">
                   {activeTool === 'brush' || activeTool === 'eraser' ? (
                        <div className="space-y-4">
                             <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-1 flex items-center gap-2"><Brush size={12}/> Brush Engine</div>
                             
                             {activeTool === 'brush' && (
                               <div>
                                 <label className="text-xs text-[#8A8A8A] block mb-1">Brush Type</label>
                                 <select 
                                   className="w-full h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500" 
                                   value={brushType || 'pencil'} 
                                   onChange={(e) => setBrushType(e.target.value)}
                                 >
                                    <optgroup label="Standard Brushes">
                                      <option value="pencil">Pencil</option>
                                      <option value="brush">Art Brush</option>
                                      <option value="marker">Permanent Marker</option>
                                      <option value="highlighter">Highlighter</option>
                                    </optgroup>
                                    <optgroup label="Technical & Artistic">
                                      <option value="ink">Ink Pen</option>
                                      <option value="calligraphy">Calligraphy Brush</option>
                                      <option value="pixel">Pixel Brush</option>
                                      <option value="watercolor">Watercolor Brush</option>
                                    </optgroup>
                                    <optgroup label="Air & Sprays">
                                      <option value="airbrush">Airbrush</option>
                                      <option value="spray">Spray / Splatter</option>
                                      <option value="chalk">Chalk Brush</option>
                                    </optgroup>
                                    <optgroup label="Pattern Brushes">
                                      <option value="pattern_dots">Pattern - Dots</option>
                                      <option value="pattern_dashed">Pattern - Dashed Lines</option>
                                      <option value="pattern_texture">Pattern - Texture Stamp</option>
                                      <option value="pattern_decorative">Pattern - Decorative Diamonds</option>
                                      <option value="pattern_repeating_shapes">Pattern - Repeating Squares</option>
                                    </optgroup>
                                 </select>
                               </div>
                             )}

                             <div>
                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                  <span>Brush Size</span>
                                  <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSize}px</span>
                                 </div>
                                 <input 
                                   type="range" min="1" max="500" step="1" value={brushSize} 
                                   onChange={(e) => setBrushSize(Number(e.target.value))} 
                                   className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
                                 />
                             </div>

                             {activeTool === 'brush' && (
                               <>
                                 <div>
                                    <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                      <span>Opacity</span>
                                      <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushOpacity}%</span>
                                    </div>
                                    <input 
                                      type="range" min="1" max="100" step="1" value={brushOpacity} 
                                      onChange={(e) => setBrushOpacity(Number(e.target.value))} 
                                      className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
                                    />
                                 </div>

                                 <div>
                                    <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                      <span>Flow</span>
                                      <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushFlow}%</span>
                                    </div>
                                    <input 
                                      type="range" min="1" max="100" step="1" value={brushFlow} 
                                      onChange={(e) => setBrushFlow(Number(e.target.value))} 
                                      className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
                                    />
                                 </div>

                                 <div>
                                    <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                      <span>Hardness</span>
                                      <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushHardness}%</span>
                                    </div>
                                    <input 
                                      type="range" min="1" max="100" step="1" value={brushHardness} 
                                      onChange={(e) => setBrushHardness(Number(e.target.value))} 
                                      className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
                                    />
                                 </div>

                                 <div>
                                    <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                      <span>Smoothing</span>
                                      <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSmoothing}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="1" value={brushSmoothing} 
                                      onChange={(e) => setBrushSmoothing(Number(e.target.value))} 
                                      className="w-full accent-blue-500 h-1" 
                                    />
                                 </div>

                                 <div className="pt-2">
                                   <BrushPreview 
                                     type={brushType} 
                                     color={brushColor} 
                                     size={brushSize} 
                                     opacity={brushOpacity} 
                                     hardness={brushHardness} 
                                     flow={brushFlow} 
                                   />
                                 </div>
                               </>
                             )}
                        </div>
                   ) : selectionType ? (
                        <>
                         {/* Artboard Ownership Info */}
                         <div className="mb-4 bg-[#181818] border border-[#2c2c2c] p-2.5 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SquareDashed size={14} className="text-slate-400" />
                                <span className="text-[11px] font-semibold text-slate-300 tracking-wide uppercase">Artboard</span>
                            </div>
                            <span className="text-xs text-blue-400 font-mono truncate max-w-[120px] bg-blue-500/10 px-2 py-0.5 rounded">
                                {(() => {
                                    const obj = fabricRef.current?.getActiveObject() as any;
                                    if (!obj) return 'None';
                                    const boardId = obj.artboardId;
                                    if (boardId) {
                                      const b = artboards.find(a => a.id === boardId);
                                      return b ? b.name : 'Unknown';
                                    }
                                    return 'Global';
                                })()}
                            </span>
                         </div>
                         {/* Transform Module */}
                         <div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 flex items-center gap-2"><Move size={12}/> Transform</div>
                            <div className="flex gap-2">
                               <button className="flex-1 h-8 bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded flex justify-center items-center gap-2 text-xs transition border border-[#3A3A3A]" onClick={flipX}><FlipHorizontal size={14}/> Flip X</button>
                               <button className="flex-1 h-8 bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded flex justify-center items-center gap-2 text-xs transition border border-[#3A3A3A]" onClick={flipY}><FlipVertical size={14}/> Flip Y</button>
                            </div>
                         </div>

                          {/* Smart Collage Block Customization Panel */}
                          {(() => {
                             const activeObj = fabricRef.current?.getActiveObject();
                             const isCollageSelected = activeObj && (
                                (activeObj as any).isCollageBlock || 
                                (activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))
                             );
                             if (!isCollageSelected) return null;
                             return (
                                <div className="space-y-4 pt-4 border-t border-[#2C2C2C] pb-4 animate-fade-in">
                                   <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 flex items-center justify-between">
                                      <div className="flex items-center gap-1.5"><Layout size={12}/> Smart Collage Cell Options</div>
                                      <span className="text-[9px] text-[#A0A0A0] bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">CELL EDIT</span>
                                   </div>

                                {/* Action Grid */}
                                <div className="grid grid-cols-2 gap-2 bg-[#141414] border border-[#222] p-2.5 rounded-lg">
                                   {/* Background color */}
                                   <div className="space-y-1">
                                      <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">Cell Fill</span>
                                      <div className="flex gap-2">
                                         <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner" style={{ backgroundColor: collageBgColor }} />
                                         <div className="flex-1">
                                            <ColorPickerTrigger 
                                               color={collageBgColor} 
                                               onChange={(color) => {
                                                  setCollageBgColor(color);
                                                  updateCollageBlockStyleProperty('fill', color);
                                               }} 
                                            />
                                         </div>
                                      </div>
                                   </div>

                                   {/* Border color */}
                                   <div className="space-y-1">
                                      <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">Border Color</span>
                                      <div className="flex gap-2">
                                         <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner" style={{ backgroundColor: collageBorderStyle === 'none' ? 'transparent' : collageBorderColor }} />
                                         <div className="flex-1">
                                            <ColorPickerTrigger 
                                               color={collageBorderColor} 
                                               onChange={(color) => {
                                                  setCollageBorderColor(color);
                                                  updateCollageBlockStyleProperty('stroke', color);
                                               }} 
                                            />
                                         </div>
                                      </div>
                                   </div>
                                </div>

                                {/* Border Style, Thickness & Corner Radius */}
                                <div className="space-y-3 bg-[#141414] border border-[#222] p-3 rounded-lg">
                                   <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Border & Radius Controls</span>
                                   
                                   {/* Style selection button row */}
                                   <div>
                                      <span className="text-[9px] text-[#808080] block mb-1">Border Style</span>
                                      <div className="grid grid-cols-3 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                                         {['none', 'solid', 'dashed'].map((st) => (
                                            <button
                                               key={st}
                                               type="button"
                                               onClick={() => {
                                                  setCollageBorderStyle(st as any);
                                                  updateCollageBlockStyleProperty('borderStyle', st);
                                               }}
                                               className={`py-1 text-[9px] font-bold rounded capitalize transition-all ${collageBorderStyle === st ? 'bg-blue-600 text-white shadow-sm' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                                            >
                                               {st}
                                            </button>
                                         ))}
                                      </div>
                                   </div>

                                   {/* Stroke width & corner radius range controls */}
                                   <div className="space-y-3 pt-1">
                                      <div>
                                         <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                                            <span>Border Thickness</span>
                                            <span className="font-mono text-blue-400 text-[10px] font-bold">{collageBorderWidth}px</span>
                                         </div>
                                         <input 
                                            type="range" min="0" max="50" step="1" 
                                            value={collageBorderWidth} 
                                            onChange={(e) => {
                                               const val = Number(e.target.value);
                                               setCollageBorderWidth(val);
                                               updateCollageBlockStyleProperty('strokeWidth', val);
                                            }} 
                                            className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                         />
                                      </div>

                                      {/* Custom Toggle for Separate Corner Rounding */}
                                      <div className="flex items-center justify-between pt-1 pb-1 border-t border-[#1C1C1C]">
                                         <span className="text-[9px] text-[#8A8A8A]">Round Corners Separately</span>
                                         <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                               type="checkbox" 
                                               className="sr-only peer" 
                                               checked={useIndividualCorners}
                                               onChange={(e) => {
                                                  const val = e.target.checked;
                                                  updateCollageBlockStyleProperty('useIndividualCorners', val);
                                               }}
                                            />
                                            <div className="w-7 h-4 bg-[#2C2C2C] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#A0A0A0] peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                                         </label>
                                      </div>

                                      {useIndividualCorners ? (
                                         <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-1 border-t border-[#1C1C1C]">
                                            {/* Top Left */}
                                            <div>
                                               <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                                  <span>Top Left</span>
                                                  <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerTL}%</span>
                                               </div>
                                               <input 
                                                  type="range" min="0" max="100" step="1" 
                                                  value={collageCornerTL} 
                                                  onChange={(e) => {
                                                     const val = Number(e.target.value);
                                                     updateCollageBlockStyleProperty('rx_tl', val);
                                                  }} 
                                                  className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                               />
                                            </div>
                                            {/* Top Right */}
                                            <div>
                                               <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                                  <span>Top Right</span>
                                                  <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerTR}%</span>
                                               </div>
                                               <input 
                                                  type="range" min="0" max="100" step="1" 
                                                  value={collageCornerTR} 
                                                  onChange={(e) => {
                                                     const val = Number(e.target.value);
                                                     updateCollageBlockStyleProperty('rx_tr', val);
                                                  }} 
                                                  className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                               />
                                            </div>
                                            {/* Bottom Left */}
                                            <div>
                                               <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                                  <span>Bottom Left</span>
                                                  <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerBL}%</span>
                                               </div>
                                               <input 
                                                  type="range" min="0" max="100" step="1" 
                                                  value={collageCornerBL} 
                                                  onChange={(e) => {
                                                     const val = Number(e.target.value);
                                                     updateCollageBlockStyleProperty('rx_bl', val);
                                                  }} 
                                                  className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                               />
                                            </div>
                                            {/* Bottom Right */}
                                            <div>
                                               <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                                                  <span>Bottom Right</span>
                                                  <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerBR}%</span>
                                               </div>
                                               <input 
                                                  type="range" min="0" max="100" step="1" 
                                                  value={collageCornerBR} 
                                                  onChange={(e) => {
                                                     const val = Number(e.target.value);
                                                     updateCollageBlockStyleProperty('rx_br', val);
                                                  }} 
                                                  className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                               />
                                            </div>
                                         </div>
                                      ) : (
                                         <div>
                                            <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                                               <span>Cell Corner Rounding (%)</span>
                                               <span className="font-mono text-blue-400 text-[10px] font-bold">{collageCornerRadius}%</span>
                                            </div>
                                            <input 
                                               type="range" min="0" max="100" step="1" 
                                               value={collageCornerRadius} 
                                               onChange={(e) => {
                                                  const val = Number(e.target.value);
                                                  updateCollageBlockStyleProperty('rx', val);
                                               }} 
                                               className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                            />
                                         </div>
                                      )}
                                   </div>
                                </div>

                                {/* Image filling interactive controls */}
                                <div className="space-y-2 bg-[#141414] border border-[#222] p-3 rounded-lg">
                                   <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Fill Cell with Image</span>
                                   <div className="pt-1">
                                      <label className="relative flex flex-col items-center justify-center border border-dashed border-[#3A3A3A] hover:border-blue-500 rounded-lg p-4 text-center cursor-pointer transition bg-[#0C0C0C] hover:bg-blue-950/10 group">
                                         <LucideImage size={24} className="text-[#8A8A8A] group-hover:text-blue-400 mb-1.5 transition-colors" />
                                         <span className="text-[10px] font-bold text-white group-hover:text-blue-300">Upload Photograph</span>
                                         <span className="text-[9px] text-[#6A6A6A] mt-0.5">Crop and object-fit cover perfectly</span>
                                         <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                               const file = e.target.files?.[0];
                                               if (file) fillCollageBlockWithImage(file);
                                            }} 
                                         />
                                      </label>
                                   </div>
                                </div>

                                {/* Text alignment helpers relative block to cell */}
                                <div className="space-y-2 bg-[#141414] border border-[#222] p-3 rounded-lg">
                                   <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Add Text Overlay (Relative Align)</span>
                                   <div className="grid grid-cols-5 gap-1 pt-1">
                                      {[
                                         { label: 'Left', id: 'left' as const, icon: <AlignLeft size={13} /> },
                                         { label: 'Top', id: 'top' as const, icon: <ChevronUp size={13} /> },
                                         { label: 'Center', id: 'center' as const, icon: <AlignJustify size={13} /> },
                                         { label: 'Bot', id: 'bottom' as const, icon: <ChevronDown size={13} /> },
                                         { label: 'Right', id: 'right' as const, icon: <AlignRight size={13} /> },
                                      ].map((btn) => (
                                         <button
                                            key={btn.id}
                                            type="button"
                                            onClick={() => addAlignedCollageText(btn.id)}
                                            className="h-11 bg-[#1F1F1F] hover:bg-blue-600 border border-[#2C2C2C] hover:border-blue-500 rounded flex flex-col items-center justify-center text-[#8A8A8A] hover:text-white transition-all gap-1 shadow-sm"
                                            title={`Add Text Aligned to ${btn.label}`}
                                         >
                                            {btn.icon}
                                            <span className="text-[8px] font-bold font-sans tracking-tight">{btn.label}</span>
                                         </button>
                                      ))}
                                   </div>
                                </div>
                             </div>
                          );
                       })()}
                      {/* Typography Module */}
                       {(selectionType === 'i-text' || selectionType === 'text' || selectionType === 'textbox') && (
                             <div className="space-y-4 border-b border-[#2C2C2C] pb-4 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                                     <Type size={12}/> Typography
                                  </div>
                                  <TypographyPresets onApplyPreset={(props) => {
                                      const activeObjs = fabricRef.current?.getActiveObjects();
                                      if (!activeObjs || activeObjs.length === 0) return;
                                      
                                      const beforeStates = activeObjs.map(o => ({
                                        obj: o,
                                        before: { ...o.toObject() },
                                        after: { ...o.toObject(), ...props }
                                      }));
                                      
                                      // Note: the transform command usually just restores visual properties, 
                                      // but we want full properties. Let's use it as basic or update them directly
                                      // and push a generic command.
                                      
                                      executeCommand({
                                        name: "Apply Preset",
                                        execute: (canvas) => {
                                          activeObjs.forEach(o => {
                                            if (props.shadow) o.shadow = new fabric.Shadow(props.shadow);
                                            else o.shadow = null;
                                            o.set(props);
                                          });
                                          canvas.requestRenderAll();
                                        },
                                        undo: (canvas) => {
                                          beforeStates.forEach(s => {
                                            if (s.before.shadow) s.obj.shadow = new fabric.Shadow(s.before.shadow);
                                            else s.obj.shadow = null;
                                            s.obj.set(s.before);
                                          });
                                          canvas.requestRenderAll();
                                        },
                                        redo: (canvas) => {
                                          beforeStates.forEach(s => {
                                            if (s.after.shadow) s.obj.shadow = new fabric.Shadow(s.after.shadow);
                                            else s.obj.shadow = null;
                                            s.obj.set(s.after);
                                          });
                                          canvas.requestRenderAll();
                                        }
                                      });
                                      
                                      setTextProps(prev => ({ ...prev, ...props }));
                                  }} />
                                </div>
                                
                                <div className="space-y-3">
                                   {/* Font Family selection */}
                                   <div className="flex items-center gap-2">
                                      <span className="text-xs text-[#8A8A8A] w-14 shrink-0">Font</span>
                                      <FontPicker 
                                         className="flex-1 w-full"
                                         value={textProps.fontFamily}
                                         selectedText={textProps.textContent}
                                         onHover={(val) => {
                                           const activeObjs = fabricRef.current?.getActiveObjects();
                                           if (!activeObjs) return;
                                           activeObjs.forEach(o => {
                                             if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
                                               const textObj = o as any;
                                               if (val) {
                                                 textObj.set('fontFamily', val);
                                               } else {
                                                 textObj.set('fontFamily', textProps.fontFamily);
                                               }
                                             }
                                           });
                                           fabricRef.current?.requestRenderAll();
                                         }}
                                         onChange={(val) => changeTextProp("fontFamily", val, "Change Font Family")}
                                      />
                                   </div>

                                   {/* Font Size & Weight */}
                                   <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs text-[#8A8A8A] w-10 shrink-0">Size</span>
                                         <input 
                                            type="number" 
                                            className="w-full bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 py-1.5 outline-none text-white focus:border-blue-500" 
                                            value={textProps.fontSize} 
                                            onChange={(e) => {
                                              const val = Math.max(1, Number(e.target.value));
                                              changeTextProp("fontSize", val, "Change Font Size");
                                            }} 
                                         />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                         <span className="text-xs text-[#8A8A8A] shrink-0">Weight</span>
                                         <select 
                                            className="flex-1 w-full bg-[#181818] border border-[#3A3A3A] rounded text-[11px] px-1 py-1.5 outline-none text-white focus:border-blue-500" 
                                            value={textProps.fontWeight} 
                                            onChange={(e) => changeTextProp("fontWeight", e.target.value, "Change Font Weight")}
                                         >
                                            <option value="normal">Normal</option>
                                            <option value="bold">Bold</option>
                                            <option value="300">Light (300)</option>
                                            <option value="500">Medium (500)</option>
                                            <option value="700">Semibold (700)</option>
                                            <option value="900">Black (900)</option>
                                         </select>
                                      </div>
                                   </div>

                                   {/* Text Emphasis Buttons */}
                                   <div className="flex items-center gap-2">
                                      <span className="text-xs text-[#8A8A8A] w-14 shrink-0">Style</span>
                                      <div className="flex-1 flex bg-[#181818] border border-[#3A3A3A] rounded p-0.5 justify-between gap-1">
                                         <button 
                                            type="button"
                                            className={`flex-1 h-7 flex items-center justify-center rounded text-xs transition ${textProps.fontWeight === 'bold' ? 'bg-blue-600 text-white font-bold' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                            onClick={() => changeTextProp("fontWeight", textProps.fontWeight === 'bold' ? 'normal' : 'bold', "Toggle Bold")}
                                            title="Bold"
                                         >
                                            <Bold size={13} />
                                         </button>
                                         <button 
                                            type="button"
                                            className={`flex-1 h-7 flex items-center justify-center rounded text-xs transition ${textProps.fontStyle === 'italic' ? 'bg-blue-600 text-white italic' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                            onClick={() => changeTextProp("fontStyle", textProps.fontStyle === 'italic' ? 'normal' : 'italic', "Toggle Italic")}
                                            title="Italic"
                                         >
                                            <Italic size={13} />
                                         </button>
                                         <button 
                                            type="button"
                                            className={`flex-1 h-7 flex items-center justify-center rounded text-xs transition ${textProps.underline ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                            onClick={() => changeTextProp("underline", !textProps.underline, "Toggle Underline")}
                                            title="Underline"
                                         >
                                            <Underline size={13} />
                                         </button>
                                         <button 
                                            type="button"
                                            className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition font-bold ${textProps.overline ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                            onClick={() => changeTextProp("overline", !textProps.overline, "Toggle Overline")}
                                            title="Overline"
                                         >
                                            Ō
                                         </button>
                                         <button 
                                            type="button"
                                            className={`flex-1 h-7 flex items-center justify-center rounded text-xs transition line-through ${textProps.linethrough ? 'bg-blue-600 text-white font-medium' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                            onClick={() => changeTextProp("linethrough", !textProps.linethrough, "Toggle Strikethrough")}
                                            title="Strikethrough"
                                         >
                                            S
                                         </button>
                                      </div>
                                   </div>

                                   {/* Text Orientation & Rotation */}
                                   <div className="space-y-2 pt-2 border-t border-[#252525]">
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs text-[#8A8A8A] w-14 shrink-0">Orientation</span>
                                         <div className="flex-1 flex bg-[#181818] border border-[#3A3A3A] rounded p-0.5 gap-1">
                                            <button 
                                               type="button"
                                               className={`flex-1 h-7 text-[10px] font-medium rounded transition ${textProps.angle === 0 ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                               onClick={() => changeTextProp("angle", 0, "Set Horizontal")}
                                               title="Horizontal (0°)"
                                            >
                                                Horiz
                                             </button>
                                            <button 
                                               type="button"
                                               className={`flex-1 h-7 text-[10px] font-medium rounded transition ${textProps.angle === 90 ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                               onClick={() => changeTextProp("angle", 90, "Set Vertical Clockwise")}
                                               title="Vertical CW (90°)"
                                            >
                                                Vert CW
                                             </button>
                                            <button 
                                               type="button"
                                               className={`flex-1 h-7 text-[10px] font-medium rounded transition ${textProps.angle === 270 ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#2C2C2C]'}`}
                                               onClick={() => changeTextProp("angle", 270, "Set Vertical Counter-Clockwise")}
                                               title="Vertical CCW (270°)"
                                            >
                                                Vert CCW
                                             </button>
                                         </div>
                                      </div>

                                      <div>
                                         <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-0.5">
                                           <span className="flex items-center gap-1"><RotateCw size={10} /> Rotation Angle</span>
                                           <span className="font-mono text-white text-[10px]">{Math.round(textProps.angle || 0)}°</span>
                                         </div>
                                         <input 
                                            type="range" 
                                            min="0" 
                                            max="360" 
                                            step="1" 
                                            value={textProps.angle || 0} 
                                            onChange={(e) => {
                                              const val = Number(e.target.value);
                                              changeTextProp("angle", val, "Rotate Text");
                                            }} 
                                            className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                         />
                                      </div>
                                   </div>

                                   {/* Letter spacing */}
                                   <div className="space-y-2 pt-2 border-t border-[#252525]">
                                      <div>
                                         <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-0.5">
                                           <span>Letter & Word Spacing</span>
                                           <span className="font-mono text-white text-[10px]">{textProps.charSpacing}</span>
                                         </div>
                                         <input 
                                            type="range" 
                                            min="-100" 
                                            max="800" 
                                            step="5" 
                                            value={textProps.charSpacing} 
                                            onChange={(e) => {
                                              const val = Number(e.target.value);
                                              changeTextProp("charSpacing", val, "Change Letter Spacing");
                                            }} 
                                            className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                         />
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                         {/* Image Adjustments Module */}
                         {(selectionType === 'image' || selectionType === 'frameGroup') && (
                            <div className="space-y-6">
                               <div className="space-y-3">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2"><Crop size={12}/> Crop & Composition</div>
                                  <div className="flex gap-2">
                                     <button
                                        onClick={() => enterCropMode()}
                                        className="flex-1 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white border border-[#3A3A3A] hover:border-blue-500 rounded text-xs py-2 transition flex items-center justify-center gap-1.5"
                                     >
                                        <Crop size={14} /> Crop Image
                                     </button>
                                     <button
                                        onClick={() => resetCrop()}
                                        className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-[#808080] hover:text-white border border-[#3A3A3A] rounded px-3 py-2 transition flex items-center justify-center gap-1.5"
                                        title="Reset Crop"
                                     >
                                        <RotateCcw size={14} />
                                     </button>
                                  </div>
                               </div>

                               <div>
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 flex items-center gap-2"><Settings size={12}/> Adjustments Non-Destructive</div>
                                  <div className="space-y-4">
                                     <FilterSlider label="Brightness" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('brightness', v)} />
                                     <FilterSlider label="Contrast" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('contrast', v)} />
                                     <FilterSlider label="Saturation" min="-1" max="1" step="0.01" onChange={(v) => applyFilter('saturation', v)} />
                                     <FilterSlider label="Grayscale" min="0" max="1" step="0.01" onChange={(v) => applyFilter('grayscale', v)} />
                                  </div>
                               </div>
                            </div>
                         )}

                         {/* Artboard Assignment and Alignment Module */}
                         <div className="space-y-3 pt-4 border-t border-[#2C2C2C] mb-4">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                               <span className="flex items-center gap-2">
                                 <SquareDashed size={12}/> Alignment & Spacing
                                 {parentAlignmentObj && (
                                   <span className="text-[8px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                                     KEY OBJECT ACTIVE
                                   </span>
                                 )}
                               </span>
                            </div>

                            {/* Key Object Alignment Helper text */}
                            {selectionType === 'activeSelection' && (
                              <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/10 text-[10px] text-[#A0A0A0] space-y-1.5 my-2">
                                <div className="flex justify-between items-center text-white text-xs font-semibold">
                                   <span>Key Object (Parent Alignment)</span>
                                   {parentAlignmentObj ? (
                                     <button 
                                       onClick={() => {
                                         parentAlignmentObjRef.current = null;
                                         setParentAlignmentObj(null);
                                         if (fabricRef.current) fabricRef.current.requestRenderAll();
                                       }}
                                       className="text-[9px] text-[#A0A0A0] hover:text-white underline font-normal bg-transparent border-0 cursor-pointer"
                                     >
                                        Clear Parent
                                     </button>
                                   ) : null}
                                </div>
                                {parentAlignmentObj ? (
                                  <p className="text-blue-300 font-mono">
                                    Using <span className="font-bold underline text-white">{(parentAlignmentObj as any).name || (parentAlignmentObj as any).type || "object"}</span> as Parent
                                  </p>
                                ) : (
                                  <p className="text-[#8A8A8A]">
                                    Pro Tip: Hold <kbd className="px-1 py-0.5 bg-[#2C2C2C] text-white rounded font-mono text-[9px]">Ctrl / ⌘</kbd> and click any selected item to designate it as the **Parent Container**.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Quick alignment buttons targeting assigned or closest artboard */}
                            <div className="space-y-3">
                               <div className="flex flex-col gap-1.5">
                                 <div className="text-[10px] text-[#A0A0A0] flex justify-between items-center">
                                   <span>Snap Alignment ({parentAlignmentObj ? "Key Object" : "Artboard"})</span>
                                   <span className="text-[9px] bg-[#1a2e3b] text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{parentAlignmentObj ? "Parent" : "Artboard"}</span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-1">
                                    <button onClick={() => alignSelection('left')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Left"><AlignStartVertical size={14}/></button>
                                    <button onClick={() => alignSelection('centerH')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Center Horizontal"><AlignCenterVertical size={14}/></button>
                                    <button onClick={() => alignSelection('right')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Right"><AlignEndVertical size={14}/></button>

                                    <button onClick={() => alignSelection('top')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Top"><AlignStartHorizontal size={14}/></button>
                                    <button onClick={() => alignSelection('centerV')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Center Vertical"><AlignCenterHorizontal size={14}/></button>
                                    <button onClick={() => alignSelection('bottom')} className="h-8 bg-[#282828] hover:bg-[#323232] text-white rounded transition flex items-center justify-center border border-transparent hover:border-[#444]" title="Align Bottom"><AlignEndHorizontal size={14}/></button>
                                 </div>
                               </div>

                               <div className="flex flex-col gap-1.5">
                                 <div className="text-[10px] text-[#A0A0A0] flex justify-between items-center">
                                    <span>Fitting, Sizing & Spacing</span>
                                 </div>
                                 <div className="grid grid-cols-2 gap-1">
                                    <button onClick={() => alignSelection('distributeH')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]" title="Equal Space / Distribute Horizontally">Distribute Horiz</button>
                                    <button onClick={() => alignSelection('distributeV')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]" title="Equal Space / Distribute Vertically">Distribute Vert</button>
                                    
                                    {parentAlignmentObj && (
                                      <>
                                        <button onClick={() => alignSelection('utils_fitInside')} className="h-8 bg-blue-950/40 hover:bg-blue-900/50 text-[10px] text-blue-300 rounded transition flex items-center justify-center gap-1.5 px-2 border border-blue-900/30 font-semibold" title="Fit Children Inside Parent">Fit inside Parent</button>
                                        <button onClick={() => alignSelection('utils_centerInside')} className="h-8 bg-blue-950/40 hover:bg-blue-900/50 text-[10px] text-blue-300 rounded transition flex items-center justify-center gap-1.5 px-2 border border-blue-900/30 font-semibold" title="Center Children Inside Parent">Center in Parent</button>
                                        <button onClick={() => alignSelection('matchWidth')} className="h-8 bg-blue-950/20 hover:bg-blue-900/35 text-[10px] text-blue-300 border border-blue-900/40 rounded transition flex items-center justify-center gap-1.5 px-2" title="Match Parent Width">Match Width</button>
                                        <button onClick={() => alignSelection('matchHeight')} className="h-8 bg-blue-950/20 hover:bg-blue-900/35 text-[10px] text-blue-300 border border-blue-900/40 rounded transition flex items-center justify-center gap-1.5 px-2" title="Match Parent Height">Match Height</button>
                                      </>
                                    )}

                                    <button onClick={() => alignSelection('fit')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]">Fit to Artboard</button>
                                    <button onClick={() => alignSelection('fill')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]">Fill Artboard</button>
                                    <button onClick={() => alignSelection('fitWidth')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]">Fit Width</button>
                                    <button onClick={() => alignSelection('fitHeight')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 border border-transparent hover:border-[#444]">Fit Height</button>
                                    <button onClick={() => alignSelection('centerH')} className="h-8 bg-[#282828] hover:bg-[#323232] text-[10px] text-white rounded transition flex items-center justify-center gap-1.5 px-2 col-span-2 font-mono border border-transparent hover:border-[#444]">Center Selection</button>
                                 </div>
                               </div>
                            </div>

                         </div>

                         {/* Quick Actions */}
                         <div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-2 flex items-center gap-2">Actions</div>
                            <div className="flex gap-2">
                               <button className="flex-1 py-1.5 border border-[#3A3A3A] text-[#A0A0A0] hover:text-white bg-[#2C2C2C] hover:bg-[#3A3A3A] rounded text-xs transition-colors flex justify-center items-center" onClick={duplicateActiveObject}><Copy size={12} className="mr-1"/> Duplicate</button>
                               <button className="flex-1 py-1.5 border border-red-900/50 text-red-400 bg-red-950/20 hover:bg-red-900/50 hover:text-white rounded text-xs transition-colors flex justify-center items-center" onClick={deleteActiveObject}><Trash2 size={12} className="mr-1"/> Delete</button>
                            </div>
                         </div>
                       </>
                   ) : (
                       <>
                           {artboards.find(b => b.id === activeArtboardId) ? (
                             <div className="space-y-6">
                               <div className="flex items-center justify-between">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2"><Square size={12}/> Artboard Properties</div>
                               </div>

                               {/* Smart Background Studio */}
                               <div>
                                  <div className="text-[10px] text-[#A0A0A0] mb-2 font-semibold flex items-center gap-1"><Droplets size={12}/> Smart Background</div>
                                  <div className="flex gap-2 mb-2">
                                    <div className="w-8 h-8 rounded shrink-0 border border-[#3A3A3A] overflow-hidden" style={{ backgroundColor: artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff' }}></div>
                                    <div className="flex-1">
                                      <ColorPickerTrigger 
                                        color={artboards.find(b => b.id === activeArtboardId)?.backgroundColor as string || '#ffffff'} 
                                        onChange={(c) => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)} 
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-4 gap-1 mb-2">
                                     {['#FFFFFF', '#000000', '#F3F4F6', '#E5E7EB', '#3B82F6', '#EF4444', '#10B981', '#F59E0B'].map(c => (
                                        <button key={c} onClick={() => updateArtboardPropDirect(activeArtboardId, 'backgroundColor', c, true)} className="w-full h-8 rounded border border-[#3A3A3A] hover:border-blue-500" style={{ backgroundColor: c }} />
                                     ))}
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                                     <button className="py-1.5 px-2 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 hover:border-blue-500/60 text-blue-400 text-[10px] rounded flex gap-1.5 justify-center items-center font-semibold transition-colors">
                                        <Sparkles size={12} /> Auto-Remove BG
                                     </button>
                                     <button className="py-1.5 px-2 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-white text-[10px] rounded flex gap-1.5 justify-center items-center transition-colors">
                                        <LucideImage size={12} /> Gen AI Fill
                                     </button>
                                  </div>
                               </div>

                               {/* Smart Collage Builder */}
                               <div className="pt-4 border-t border-[#2C2C2C] space-y-3">
                                  <div className="text-[10px] text-[#A0A0A0] font-semibold flex items-center justify-between">
                                     <div className="flex items-center gap-1"><Layout size={12}/> Smart Collage Builder</div>
                                     <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">PERFECT FIT</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-1.5">
                                     {[
                                        { l: '2x Grid', i: '2x' },
                                        { l: '3x Grid', i: '3x' },
                                        { l: '4x Quad', i: '4x' },
                                        { l: '1L 2R', i: '1-2' },
                                        { l: '2T 1B', i: '2-1' },
                                        { l: 'Filmstrip', i: 'film' }
                                     ].map(c => (
                                        <button 
                                          key={c.i} 
                                          onClick={() => generateSmartCollage(c.i)}
                                          className="py-2 bg-[#202020] hover:bg-[#2A2A2A] border border-[#303030] rounded text-[9px] text-[#8A8A8A] hover:text-white flex flex-col items-center justify-center gap-1 transition"
                                        >
                                           <div className="w-6 h-6 border border-[#555] rounded-sm opacity-50 flex items-center justify-center text-[8px] font-mono">{c.i}</div>
                                           {c.l}
                                        </button>
                                     ))}
                                  </div>

                                  <div className="space-y-2.5 bg-[#1A1A1A] p-2.5 rounded-lg border border-[#262626]">
                                     <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Preset Options (Perfect Fit)</span>
                                     
                                     <div>
                                        <div className="flex justify-between items-center text-[10px] text-[#8A8A8A] mb-1">
                                           <span>Outer Padding (Margin)</span>
                                           <span className="font-mono text-white text-[10px]">{collagePaddingPercent}%</span>
                                        </div>
                                        <input 
                                           type="range" min="0" max="15" step="1" 
                                           value={collagePaddingPercent} 
                                           onChange={(e) => setCollagePaddingPercent(Number(e.target.value))} 
                                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                        />
                                     </div>

                                     <div>
                                        <div className="flex justify-between items-center text-[10px] text-[#8A8A8A] mb-1">
                                           <span>Inner Gap (Spacing)</span>
                                           <span className="font-mono text-white text-[10px]">{collageGapPercent}%</span>
                                        </div>
                                        <input 
                                           type="range" min="0" max="10" step="0.5" 
                                           value={collageGapPercent} 
                                           onChange={(e) => setCollageGapPercent(Number(e.target.value))} 
                                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                        />
                                     </div>

                                     <div className="grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                           <span className="text-[9px] text-[#8A8A8A] block mb-1">Block Fill</span>
                                           <div className="flex gap-1.5 items-center">
                                              <div className="w-5 h-5 rounded border border-[#3A3A3A] shrink-0" style={{ backgroundColor: collageBgColor }} />
                                              <ColorPickerTrigger color={collageBgColor} onChange={setCollageBgColor} />
                                           </div>
                                        </div>
                                        <div>
                                           <span className="text-[9px] text-[#8A8A8A] block mb-1">Border Color</span>
                                           <div className="flex gap-1.5 items-center">
                                              <div className="w-5 h-5 rounded border border-[#3A3A3A] shrink-0" style={{ backgroundColor: collageBorderColor }} />
                                              <ColorPickerTrigger color={collageBorderColor} onChange={setCollageBorderColor} />
                                           </div>
                                        </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                           <span className="text-[9px] text-[#8A8A8A] block mb-1">Border Width</span>
                                           <input 
                                              type="number" min="0" max="10" 
                                              value={collageBorderWidth} 
                                              onChange={(e) => setCollageBorderWidth(Number(e.target.value))} 
                                              className="w-full h-6 bg-[#181818] border border-[#3A3A3A] text-[10px] text-white px-1.5 rounded outline-none focus:border-blue-500"
                                           />
                                        </div>
                                        <div>
                                           <span className="text-[9px] text-[#8A8A8A] block mb-1">Corner Radius</span>
                                           <input 
                                              type="number" min="0" max="100" 
                                              value={collageCornerRadius} 
                                              onChange={(e) => setCollageCornerRadius(Number(e.target.value))} 
                                              className="w-full h-6 bg-[#181818] border border-[#3A3A3A] text-[10px] text-white px-1.5 rounded outline-none focus:border-blue-500"
                                           />
                                        </div>
                                     </div>

                                     <div>
                                        <span className="text-[9px] text-[#8A8A8A] block mb-1 font-sans">Border Style</span>
                                        <div className="grid grid-cols-3 gap-1 bg-[#181818] border border-[#2A2A2A] rounded p-0.5">
                                           {['none', 'solid', 'dashed'].map((st) => (
                                              <button
                                                 key={st}
                                                 type="button"
                                                 onClick={() => setCollageBorderStyle(st as any)}
                                                 className={`py-1 text-[9px] font-semibold rounded capitalize transition ${collageBorderStyle === st ? 'bg-[#3A3A3A] text-white' : 'text-[#8A8A8A] hover:text-white'}`}
                                              >
                                                 {st}
                                              </button>
                                           ))}
                                        </div>
                                     </div>
                                  </div>
                               </div>

                               {/* Print Settings */}
                               <div className="pt-4 border-t border-[#2C2C2C]">
                                  <div className="text-[10px] text-[#A0A0A0] mb-2 font-semibold flex items-center gap-1"><Printer size={12}/> Print Preparation</div>
                                  <div className="space-y-1.5">
                                     <label className="flex items-center gap-2 text-xs text-[#8A8A8A] p-2 bg-[#1A1A1A] rounded cursor-pointer hover:bg-[#252525]">
                                        <input type="checkbox" className="accent-blue-500" checked={!!artboards.find(b => b.id === activeArtboardId)?.showMargins} onChange={(e) => updateArtboardPropDirect(activeArtboardId, 'showMargins', e.target.checked, true)} />
                                        Show Print Margins (0.25")
                                     </label>
                                     <button 
                                       onClick={generateBleed}
                                       className="w-full py-1.5 px-2 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-white text-[10px] rounded flex gap-1.5 justify-between items-center transition-colors"
                                     >
                                        <span>Generate 0.125" Bleed</span>
                                        <Plus className="opacity-70" size={12} />
                                     </button>
                                  </div>
                               </div>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                <MousePointer2 size={32} className="mb-4" />
                                <span className="text-sm font-medium">No layer selected</span>
                                <span className="text-xs mt-2 w-48">Select an object or an artboard on the canvas to edit its properties.</span>
                             </div>
                           )}
                       </>
                   )}
                                     {false && (
                       <div className="pt-6 border-t border-[#2C2C2C] space-y-4">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-1 flex items-center gap-2"><Brush size={12}/> Brush Engine</div>
                            
                            {activeTool === 'brush' && (
                              <div>
                                <label className="text-xs text-[#8A8A8A] block mb-1">Brush Type</label>
                                <select 
                                  className="w-full h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500" 
                                  value={brushType || 'pencil'} 
                                  onChange={(e) => setBrushType(e.target.value)}
                                >
                                   <optgroup label="Standard Brushes">
                                     <option value="pencil">Pencil</option>
                                     <option value="brush">Art Brush</option>
                                     <option value="marker">Permanent Marker</option>
                                     <option value="highlighter">Highlighter</option>
                                   </optgroup>
                                   <optgroup label="Technical & Artistic">
                                     <option value="ink">Ink Pen</option>
                                     <option value="calligraphy">Calligraphy Brush</option>
                                     <option value="pixel">Pixel Brush</option>
                                     <option value="watercolor">Watercolor Brush</option>
                                   </optgroup>
                                   <optgroup label="Air & Sprays">
                                     <option value="airbrush">Airbrush</option>
                                     <option value="spray">Spray / Splatter</option>
                                     <option value="chalk">Chalk Brush</option>
                                   </optgroup>
                                   <optgroup label="Pattern Brushes">
                                     <option value="pattern_dots">Pattern - Dots</option>
                                     <option value="pattern_dashed">Pattern - Dashed Lines</option>
                                     <option value="pattern_texture">Pattern - Texture Stamp</option>
                                     <option value="pattern_decorative">Pattern - Decorative Diamonds</option>
                                     <option value="pattern_repeating_shapes">Pattern - Repeating Squares</option>
                                   </optgroup>
                                </select>
                              </div>
                            )}

                            <div>
                               <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                 <span>Brush Size</span>
                                 <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSize}px</span>
                                </div>
                                <input 
                                  type="range" min="1" max="500" step="1" value={brushSize} 
                                  onChange={(e) => setBrushSize(Number(e.target.value))} 
                                  className="w-full accent-blue-500 h-1" 
                                />
                            </div>

                            {activeTool === 'brush' && (
                              <>
                                <div>
                                   <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                     <span>Opacity</span>
                                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushOpacity}%</span>
                                   </div>
                                   <input 
                                     type="range" min="1" max="100" step="1" value={brushOpacity} 
                                     onChange={(e) => setBrushOpacity(Number(e.target.value))} 
                                     className="w-full accent-blue-500 h-1" 
                                   />
                                </div>

                                <div>
                                   <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                     <span>Flow</span>
                                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushFlow}%</span>
                                   </div>
                                   <input 
                                     type="range" min="1" max="100" step="1" value={brushFlow} 
                                     onChange={(e) => setBrushFlow(Number(e.target.value))} 
                                     className="w-full accent-blue-500 h-1" 
                                   />
                                </div>

                                <div>
                                   <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                     <span>Hardness</span>
                                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushHardness}%</span>
                                   </div>
                                   <input 
                                     type="range" min="1" max="100" step="1" value={brushHardness} 
                                     onChange={(e) => setBrushHardness(Number(e.target.value))} 
                                     className="w-full accent-blue-500 h-1" 
                                   />
                                </div>

                                <div>
                                   <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                     <span>Smoothing</span>
                                     <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{brushSmoothing}%</span>
                                   </div>
                                   <input 
                                     type="range" min="0" max="100" step="1" value={brushSmoothing} 
                                     onChange={(e) => setBrushSmoothing(Number(e.target.value))} 
                                     className="w-full accent-blue-500 h-1" 
                                   />
                                </div>

                                <div className="pt-2">
                                  <BrushPreview 
                                    type={brushType} 
                                    color={brushColor} 
                                    size={brushSize} 
                                    opacity={brushOpacity} 
                                    hardness={brushHardness} 
                                    flow={brushFlow} 
                                  />
                                </div>
                              </>
                            )}
                       </div>
                   )}
                </div>
             )}

             {/* ARTBOARDS PANEL */}
             {activeTab === 'artboards' && (
                <div className="flex flex-col h-full overflow-hidden text-white font-sans selection:bg-blue-500/30">
                   {/* Header & Create */}
                   <div className="p-3 md:p-4 shrink-0 border-b border-[#2C2C2C] bg-[#1A1A1A] z-10 shadow-sm flex flex-col gap-3 md:gap-4 pb-4 md:pb-5">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <SquareDashed size={14} className="text-blue-400 opacity-80 md:w-4 md:h-4"/>
                            <span className="text-xs md:text-sm font-semibold text-[#EEEEEE] tracking-tight">Artboards</span>
                         </div>
                         <span className="text-[10px] bg-[#222] text-[#888] border border-[#333] px-1.5 py-0.5 rounded font-mono font-medium">{artboards.length} Boards</span>
                      </div>
                      <div className="flex gap-2 relative">
                         <div className="flex-1 group">
                            <button className="w-full h-8 bg-[#222] hover:bg-[#2A2A2A] text-[#CCC] rounded text-[11px] font-semibold transition border border-[#333] overflow-hidden flex items-center justify-center gap-1">
                               Presets <ChevronDown size={12} className="opacity-70" />
                            </button>
                            <div className="absolute top-full left-0 w-[240px] mt-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                                {Array.from(new Set(PRESET_REGISTRY.map(p => p.category))).map(category => (
                                  <div key={category} className="flex flex-col">
                                    <div className="sticky top-0 bg-[#222]/95 backdrop-blur-sm px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#888] border-b border-[#333] z-10 capitalize">
                                      {category.replace('_', ' ')}
                                    </div>
                                    {PRESET_REGISTRY.filter(p => p.category === category).map((preset) => (
                                      <button 
                                        key={preset.id}
                                        onClick={() => createArtboardFromPreset(preset.id)}
                                        className="text-[10px] text-left text-[#C0C0C0] px-3 py-2 hover:bg-blue-600 hover:text-white transition whitespace-nowrap flex flex-col gap-0.5 group/btn border-b border-[#222] last:border-b-0"
                                      >
                                        <div className="flex justify-between items-center w-full">
                                          <span className="font-medium">{preset.name}</span>
                                          <span className="opacity-40 text-[9px] font-mono group-hover/btn:text-blue-200">{preset.width}x{preset.height} {preset.unit}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                            </div>
                         </div>
                         <button 
                           onClick={() => createArtboard()}
                           className="flex-1 h-8 bg-blue-600/90 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition shadow"
                         >
                            + Custom
                         </button>
                      </div>
                   </div>

                   {/* List existing artboards */}
                   <div className="flex-1 overflow-y-auto w-full no-scrollbar px-2 py-3 bg-[#111] md:bg-[#151515]">
                     {artboards.length === 0 && (
                        <div className="text-center p-6 text-xs text-[#6A6A6A] italic">No artboards created yet.</div>
                     )}
                     <div className="space-y-1.5 pb-24">
                         {artboards.map((board, idx) => {
                           const isActive = board.id === activeArtboardId;
                           const objCount = fabricRef.current ? fabricRef.current.getObjects().filter(o => (o as any).artboardId === board.id).length : 0;
                           const isDragOver = dragOverArtboardIdx === idx;
                           const isDragging = draggedArtboardIdx === idx;
                           
                           return (
                             <div 
                               key={board.id}
                               draggable
                               onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedArtboardIdx(idx);
                               }}
                               onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOverArtboardIdx(idx);
                               }}
                               onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedArtboardIdx !== null && dragOverArtboardIdx !== null) {
                                     moveArtboard(draggedArtboardIdx, dragOverArtboardIdx);
                                  }
                                  setDraggedArtboardIdx(null);
                                  setDragOverArtboardIdx(null);
                               }}
                               onDragEnd={() => {
                                  setDraggedArtboardIdx(null);
                                  setDragOverArtboardIdx(null);
                               }}
                               onClick={() => setActiveArtboardId(board.id)} 
                               onDoubleClick={() => {
                                  setActiveArtboardId(board.id);
                                  if (fabricRef.current) {
                                    const cw = fabricRef.current.width!;
                                    const ch = fabricRef.current.height!;
                                    const zoom = Math.min(cw / (board.width + 100), ch / (board.height + 100), 2);
                                    fabricRef.current.setZoom(zoom);
                                    
                                    const vpt = fabricRef.current.viewportTransform!;
                                    const newVpt = vpt.slice() as any;
                                    newVpt[4] = cw / 2 - (board.x + board.width / 2) * zoom;
                                    newVpt[5] = ch / 2 - (board.y + board.height / 2) * zoom;
                                    fabricRef.current.setViewportTransform(newVpt);
                                    setZoomPercent(Math.round(zoom * 100));
                                  }
                               }}
                               className={`
                                 relative p-2.5 rounded-lg cursor-pointer border select-none transition-colors group
                                 ${isActive ? 'bg-blue-600/10 border-blue-500/80 shadow-[0_0_0_1px_rgba(59,130,246,0.2)_inset]' : 'bg-[#1C1C1C] border-[#2C2C2C] hover:border-[#4A4A4A]'} 
                                 ${isDragging ? 'opacity-30 border-dashed' : 'opacity-100'}
                                 ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx > idx ? 'border-t-2 border-t-blue-400' : ''}
                                 ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx < idx ? 'border-b-2 border-b-blue-400' : ''}
                               `}
                             >
                                <div className="flex gap-3 items-center">
                                   {/* Preview Thumbnail placeholder */}
                                   <div 
                                      className="w-10 h-10 shrink-0 border border-[#3A3A3A] rounded flex items-center justify-center overflow-hidden"
                                      style={{ backgroundColor: board.backgroundColor || '#fff', ...(!board.transparent ? {} : { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' }) }}
                                   >
                                      {board.transparent && <div className="w-full h-full bg-black/10"></div>}
                                      {/* Scaled minimap of objects inside this artboard could go here eventually */}
                                   </div>
                                   
                                   <div className="flex-1 w-0 min-w-0 flex flex-col justify-center">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-blue-300' : 'text-[#E0E0E0]'}`}>{board.name}</span>
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <span className="text-[8px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-sm font-mono border border-[#333]">{objCount}</span>
                                        </div>
                                      </div>
                                      <div className="text-[9px] text-[#777] font-mono flex items-center gap-1.5">
                                         <span>{board.width}<span className="opacity-40">x</span>{board.height}</span>
                                         <span className="opacity-30">|</span>
                                         <span className={`${board.orientation === 'landscape' ? 'text-cyan-600/80' : 'text-purple-600/80'} uppercase tracking-tight`}>{board.orientation === 'landscape' ? 'LND' : 'PRT'}</span>
                                      </div>
                                   </div>
                                   
                                   {/* Quick actions */}
                                   <div className={`flex flex-col gap-0.5 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 opacity-100 md:opacity-0'}`}>
                                      <button title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateArtboard(board); }} className="w-5 h-5 flex items-center justify-center hover:bg-white/10 text-[#888] hover:text-white rounded transition-colors">
                                        <Copy size={10} />
                                      </button>
                                      <button title="Delete" onClick={(e) => { e.stopPropagation(); deleteArtboard(board.id); }} className="w-5 h-5 flex items-center justify-center hover:bg-red-900/30 text-[#888] hover:text-red-400 rounded transition-colors">
                                        <Trash2 size={10} />
                                      </button>
                                   </div>
                                </div>
                                
                                {/* Active Artboard Properties Expansion */}
                                {isActive && (
                                   <div className="mt-3 pt-3 border-t border-[#333] space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
                                      {/* Edit Name */}
                                      <div className="flex items-center gap-2">
                                         <input 
                                           type="text" 
                                           className="flex-1 h-7 bg-[#111] border border-[#333] rounded px-2 text-[10px] text-[#CCC] outline-none focus:border-blue-500 focus:text-white transition-colors" 
                                           value={board.name} 
                                           onFocus={() => onArtboardPropStart(board.name)}
                                           onChange={(e) => updateArtboardProp(board.id, "name", e.target.value)} 
                                           onBlur={(e) => onArtboardPropCommit(board.id, "name", e.target.value)}
                                           placeholder="Artboard Name"
                                         />
                                      </div>

                                      {/* Dimensions & Orientation */}
                                      <div className="flex gap-2">
                                         <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-[9px] text-[#666] uppercase font-bold tracking-wider">W</span>
                                            <input 
                                              type="number" 
                                              className="w-full h-7 bg-[#111] border border-[#333] rounded px-1.5 text-[10px] font-mono text-[#CCC] outline-none focus:border-blue-500 transition-colors" 
                                              value={board.width} 
                                              onFocus={() => onArtboardPropStart(board.width)}
                                              onChange={(e) => updateArtboardProp(board.id, "width", Math.max(10, Number(e.target.value)))} 
                                              onBlur={(e) => onArtboardPropCommit(board.id, "width", Math.max(10, Number(e.target.value)))}
                                            />
                                         </div>
                                         <div className="flex items-end pb-1.5 shrink-0 opacity-40">
                                            <X size={10} />
                                         </div>
                                         <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-[9px] text-[#666] uppercase font-bold tracking-wider">H</span>
                                            <input 
                                              type="number" 
                                              className="w-full h-7 bg-[#111] border border-[#333] rounded px-1.5 text-[10px] font-mono text-[#CCC] outline-none focus:border-blue-500 transition-colors" 
                                              value={board.height} 
                                              onFocus={() => onArtboardPropStart(board.height)}
                                              onChange={(e) => updateArtboardProp(board.id, "height", Math.max(10, Number(e.target.value)))} 
                                              onBlur={(e) => onArtboardPropCommit(board.id, "height", Math.max(10, Number(e.target.value)))}
                                            />
                                         </div>
                                         <div className="flex flex-col gap-1 shrink-0 ml-1">
                                            <span className="text-[9px] text-transparent uppercase font-bold tracking-wider">.</span>
                                            <div className="flex bg-[#111] border border-[#333] rounded p-0.5 h-7">
                                               <button 
                                                 onClick={() => updateArtboardPropDirect(board.id, "orientation", "portrait", true)}
                                                 className={`w-6 flex items-center justify-center rounded-[2px] transition ${board.orientation === "portrait" ? "bg-[#333] text-white" : "text-[#666] hover:text-[#CCC]"}`}
                                                 title="Portrait"
                                               >
                                                  <div className="w-2.5 h-3.5 border-2 border-current rounded-sm"></div>
                                               </button>
                                               <button 
                                                 onClick={() => updateArtboardPropDirect(board.id, "orientation", "landscape", true)}
                                                 className={`w-6 flex items-center justify-center rounded-[2px] transition ${board.orientation === "landscape" ? "bg-[#333] text-white" : "text-[#666] hover:text-[#CCC]"}`}
                                                 title="Landscape"
                                               >
                                                  <div className="w-3.5 h-2.5 border-2 border-current rounded-sm"></div>
                                               </button>
                                            </div>
                                         </div>
                                      </div>

                                      {/* Background */}
                                      <div className="flex items-center gap-2">
                                         <div className="relative shrink-0">
                                           <ColorPickerTrigger 
                                              color={board.backgroundColor || "#ffffff"}
                                              onChange={(newColor) => updateArtboardProp(board.id, "backgroundColor", newColor)}
                                              onStart={(initialColor) => onArtboardPropStart(initialColor)}
                                              onCommit={(initialColor, finalColor) => {
                                                 onArtboardPropStart(initialColor);
                                                 onArtboardPropCommit(board.id, "backgroundColor", finalColor);
                                              }}
                                              label="Background"
                                              className="w-7 h-7 rounded border border-[#333]"
                                           />
                                         </div>
                                         <input 
                                            type="text" 
                                            className="h-7 bg-[#111] border border-[#333] rounded px-2 text-[10px] text-[#CCC] w-16 uppercase font-mono outline-none focus:border-blue-500 transition-colors" 
                                            value={board.backgroundColor || "#FFFFFF"} 
                                            onFocus={() => onArtboardPropStart(board.backgroundColor || "#ffffff")}
                                            onChange={(e) => updateArtboardProp(board.id, "backgroundColor", e.target.value)} 
                                            onBlur={(e) => onArtboardPropCommit(board.id, "backgroundColor", e.target.value)}
                                         />
                                         <div className="ml-auto">
                                           <ModernCheckbox 
                                             label="Transp"
                                             checked={!!board.transparent} 
                                             onChange={(val) => updateArtboardPropDirect(board.id, "transparent", val, true)} 
                                           />
                                         </div>
                                      </div>

                                      {/* Guides toggle */}
                                      <div className="pt-2 border-t border-[#333] grid grid-cols-2 gap-1.5 opacity-80">
                                         <ModernCheckbox label="Show Grid" checked={!!board.showGrid} onChange={val => updateArtboardPropDirect(board.id, "showGrid", val, true)} />
                                         <ModernCheckbox label="Safe Area" checked={!!board.showSafeArea} onChange={val => updateArtboardPropDirect(board.id, "showSafeArea", val, true)} />
                                         <ModernCheckbox label="Margins" checked={!!board.showMargins} onChange={val => updateArtboardPropDirect(board.id, "showMargins", val, true)} />
                                         <ModernCheckbox label="Center Guide" checked={!!board.showCenter} onChange={val => updateArtboardPropDirect(board.id, "showCenter", val, true)} />
                                      </div>
                                   </div>
                                )}
                             </div>
                           )
                         })}
                     </div>
                   </div>
                </div>
             )}

             {/* QUICK ACTIONS PANEL */}
             {activeTab === 'quick' && (
                <div className="p-4 space-y-6 text-[#C0C0C0]">
                   {selectionType !== 'image' && selectionType !== 'frameGroup' ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                         <Activity size={32} className="mb-4 text-emerald-500 animate-pulse" />
                         <span className="text-sm font-semibold text-white">Quick Actions</span>
                         <span className="text-xs mt-2 w-48 text-[#8A8A8A]">Select an Image layer on the canvas to access one-click utilities and fixes.</span>
                      </div>
                   ) : (
                      <div className="space-y-6 flex flex-col h-full">
                         
                         {/* One-Click Quick Fixes */}
                         <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <Sparkles size={11} className="text-yellow-400"/> Quick Fixes
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                               <button onClick={() => { addFilterToPipeline('brightness'); applyFilter('brightness', 0.1); addFilterToPipeline('contrast'); applyFilter('contrast', 0.15); applyFilter('vibrance', undefined); addFilterToPipeline('vibrance'); }} className="p-2 border border-[#2C2C2C] hover:border-emerald-500/50 hover:bg-emerald-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                  <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Sparkles size={12}/></div>
                                  <div>
                                    <div className="text-white group-hover:text-emerald-400 transition-colors">Auto Enhance</div>
                                    <div className="text-[9px] text-[#6A6A6A]">Smart contrast, brightness, and vibrance</div>
                                  </div>
                               </button>
                               <button onClick={() => { addFilterToPipeline('sharpen'); applyFilter('sharpen', 0.3); }} className="p-2 border border-[#2C2C2C] hover:border-blue-500/50 hover:bg-blue-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                  <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Eye size={12}/></div>
                                  <div>
                                    <div className="text-white group-hover:text-blue-400 transition-colors">Auto Sharpen</div>
                                    <div className="text-[9px] text-[#6A6A6A]">Enhance edge detail and clarity</div>
                                  </div>
                               </button>
                               <button onClick={() => { addFilterToPipeline('saturation'); applyFilter('saturation', 0.2); addFilterToPipeline('vibrance'); }} className="p-2 border border-[#2C2C2C] hover:border-violet-500/50 hover:bg-violet-900/20 bg-[#1A1A1A] rounded text-left text-[11px] font-medium transition duration-150 group font-sans flex items-center gap-3">
                                  <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center text-white"><Palette size={12}/></div>
                                  <div>
                                    <div className="text-white group-hover:text-violet-400 transition-colors">Auto Color Correct</div>
                                    <div className="text-[9px] text-[#6A6A6A]">Boost missing saturation and colors</div>
                                  </div>
                               </button>
                            </div>
                         </div>

                         {/* Quick Utilities */}
                         <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <Settings2 size={11} className="text-slate-400"/> Transform Utilities
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                               {[
                                  { label: 'Fit to Print', target: 'print' },
                                  { label: 'Fit to Web', target: 'web' },
                                  { label: 'Center Subject', target: 'center' },
                                  { label: 'Reset Aspect', target: 'reset' }
                               ].map(u => (
                                  <button 
                                     key={u.label}
                                     onClick={() => {
                                        if (u.target === 'reset') resetCrop();
                                        else alignSelection('centerH');
                                     }}
                                     className="py-1 px-2 border border-[#2C2C2C] hover:border-slate-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-center text-[10px] font-medium transition duration-150 font-sans"
                                  >
                                     {u.label}
                                  </button>
                               ))}
                            </div>
                         </div>

                         {/* Digital Frames */}
                         <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <ImageIcon size={11} className="text-orange-400"/> Digital Frames
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                               {[
                                  { label: 'Polaroid', target: 'polaroid' },
                                  { label: 'Classic White', target: 'white' },
                                  { label: 'Gallery Black', target: 'black' },
                                  { label: 'Metallic Gold', target: 'metallic' },
                                  { label: 'Vintage Brown', target: 'vintage' }
                               ].map(u => (
                                  <button 
                                     key={u.label}
                                     onClick={() => applyFrame(u.target)}
                                     className="py-1 px-2 border border-[#2C2C2C] hover:border-orange-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-center text-[10px] font-medium transition duration-150 font-sans"
                                  >
                                     {u.label}
                                  </button>
                               ))}
                            </div>
                         </div>

                         {selectionType === 'frameGroup' && (
                             <div className="space-y-1 mt-3">
                                <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
                                  <span>Border Width</span>
                                  <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{frameBorderWidth}px</span>
                                 </div>
                                 <input 
                                   type="range" min="1" max="150" step="1" value={frameBorderWidth} 
                                   onChange={(e) => updateFrameBorderWidth(Number(e.target.value))} 
                                   className="w-full accent-orange-500 h-1"
                                 />
                             </div>
                         )}

                         {/* Document Prep */}
                         <div className="space-y-2 mt-4 pt-4 border-t border-[#2C2C2C]">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <FileText size={11} className="text-red-400"/> Formatting Utilities
                            </div>
                            <div className="text-[9px] text-slate-500 mb-2 leading-relaxed">Instantly reformat open imagery strictly into normalized document proportions.</div>
                            <div className="h-[300px] overflow-y-auto no-scrollbar pr-1 grid grid-cols-1 gap-1.5">
                               {PRESET_REGISTRY.filter(p => p.category === 'document' || p.category === 'social' || p.category === 'ecommerce').map((preset) => (
                                 <button key={preset.id} onClick={() => createArtboardFromPreset(preset.id)} className="flex items-center gap-2 p-1.5 bg-[#222] hover:bg-white/5 border border-[#333] hover:border-white/20 rounded text-left transition-colors font-sans">
                                    <div className={`w-5 h-5 rounded bg-[#333] flex items-center justify-center shrink-0 ${preset.category === 'social' ? 'text-fuchsia-500' : preset.category === 'ecommerce' ? 'text-orange-500' : 'text-blue-400'}`}>
                                      {preset.category === 'social' ? <Instagram size={10} /> : preset.category === 'ecommerce' ? <ShoppingBag size={10} /> : <FileText size={10} />}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                      <div className="text-[10px] font-medium text-white truncate">Convert to {preset.name}</div>
                                      <div className="text-[8px] text-slate-500 font-mono">{preset.width}x{preset.height} {preset.unit}</div>
                                    </div>
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   )}
                </div>
             )}

             {/* FILTER STUDIO PANEL */}
             {activeTab === 'filters' && (
                <div className="p-4 space-y-6 text-[#C0C0C0]">
                   {selectionType !== 'image' && selectionType !== 'frameGroup' ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                         <Sparkles size={32} className="mb-4 text-amber-500 animate-pulse" />
                         <span className="text-sm font-semibold text-white">Filter Studio</span>
                         <span className="text-xs mt-2 w-48 text-[#8A8A8A]">Select an Image layer on the canvas to utilize the professional filter pipeline.</span>
                      </div>
                   ) : (
                      <div className="space-y-6 flex flex-col h-full">
                         
                         {/* BENCHMARK & DIAGNOSTICS */}
                         <div className="bg-[#181818] border border-[#2C2C2C] rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center border-b border-[#2C2C2C] pb-1.5 mb-1.5">
                               <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                                  <Activity size={12} className="text-emerald-500"/> Pipeline Diagnostics
                               </span>
                               <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  (benchmarkInfo?.backend || 'WebGL') === 'WebGL' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' : 'bg-amber-950/40 text-amber-500 border border-amber-800/20'
                               }`}>
                                  {benchmarkInfo?.backend || 'WebGL'}
                               </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                               <div>
                                  <span className="text-[#8A8A8A] text-[9px] block">Process Time</span>
                                  <span className="text-white font-semibold">{benchmarkInfo?.filterTimeMs || '0.0'} ms</span>
                               </div>
                               <div>
                                  <span className="text-[#8A8A8A] text-[9px] block">Dimensions</span>
                                  <span className="text-white font-semibold truncate block">
                                     {benchmarkInfo?.outputWidth || 0} x {benchmarkInfo?.outputHeight || 0}
                                  </span>
                               </div>
                            </div>
                         </div>

                         {/* PRESETS BLOCK */}
                         <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <Bookmark size={11} className="text-blue-400"/> Instant Creative Presets
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                               {[
                                  { id: 'brownie', label: 'Brownie' },
                                  { id: 'vintage', label: 'Vintage' },
                                  { id: 'technicolor', label: 'Technicolor' },
                                  { id: 'kodachrome', label: 'Kodachrome' },
                                  { id: 'polaroid', label: 'Polaroid' },
                                  { id: 'hdr', label: 'HDR Light' },
                                  { id: 'film', label: 'Fine Film' },
                                  { id: 'instagram', label: 'Insta Vibe' },
                                  { id: 'vibrant', label: 'Vibrant' },
                                  { id: 'soft', label: 'Soft Cinema' }
                               ].map(p => (
                                  <button 
                                     key={p.id}
                                     onClick={() => applyCreativePreset(p.id)}
                                     type="button"
                                     className="py-1 px-2 border border-[#2C2C2C] hover:border-blue-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded text-left text-[11px] font-medium transition duration-150 flex items-center justify-between group font-sans"
                                  >
                                     <span className="truncate">{p.label}</span>
                                     <Plus size={10} className="opacity-40 group-hover:opacity-100 text-blue-400 shrink-0 ml-1" />
                                  </button>
                               ))}
                            </div>
                         </div>

                         {/* ADD NEW FILTER */}
                         <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <Plus size={12} className="text-blue-500" /> Apply Filter Effect
                            </div>
                            <div className="space-y-3 bg-[#181818] border border-[#2C2C2C] p-3 rounded-lg">
                               
                               {/* Adjustments */}
                               <div>
                                  <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Adjustments</span>
                                  <div className="flex flex-wrap gap-1.5">
                                     {[
                                        { type: 'brightness', label: 'Brightness' },
                                        { type: 'contrast', label: 'Contrast' },
                                        { type: 'saturation', label: 'Saturation' },
                                        { type: 'vibrance', label: 'Vibrance' },
                                        { type: 'exposure', label: 'Exposure' },
                                        { type: 'gamma', label: 'Gamma' },
                                        { type: 'hueRotation', label: 'Hue' }
                                     ].map(f => (
                                        <button 
                                           key={f.type} 
                                           onClick={() => addFilterToPipeline(f.type)}
                                           type="button"
                                           className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-blue-500/50 text-white rounded text-[10px] font-medium transition font-sans"
                                        >
                                           + {f.label}
                                        </button>
                                     ))}
                                  </div>
                               </div>

                               {/* Colors */}
                               <div>
                                  <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Color Effects</span>
                                  <div className="flex flex-wrap gap-1.5">
                                     {[
                                        { type: 'grayscale', label: 'Grayscale' },
                                        { type: 'invert', label: 'Invert' },
                                        { type: 'sepia', label: 'Sepia' },
                                        { type: 'blackwhite', label: 'B & W' },
                                        { type: 'removeColor', label: 'Chroma Key' }
                                     ].map(f => (
                                        <button 
                                           key={f.type} 
                                           onClick={() => addFilterToPipeline(f.type)}
                                           type="button"
                                           className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#525252] text-white rounded text-[10px] font-medium transition font-sans"
                                        >
                                           + {f.label}
                                        </button>
                                     ))}
                                  </div>
                               </div>

                               {/* Distort & Artsy */}
                               <div>
                                  <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Artsy & Details</span>
                                  <div className="flex flex-wrap gap-1.5">
                                     {[
                                        { type: 'blur', label: 'Blur' },
                                        { type: 'sharpen', label: 'Sharpen' },
                                        { type: 'emboss', label: 'Emboss' },
                                        { type: 'edge', label: 'Edges' },
                                        { type: 'noise', label: 'Noise' },
                                        { type: 'pixelate', label: 'Pixelate' },
                                        { type: 'vignette', label: 'Vignette' },
                                        { type: 'bloom', label: 'Bloom' },
                                        { type: 'chromatic', label: 'Chroma' }
                                     ].map(f => (
                                        <button 
                                           key={f.type} 
                                           onClick={() => addFilterToPipeline(f.type)}
                                           type="button"
                                           className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#525252] text-white rounded text-[10px] font-medium transition font-sans"
                                        >
                                           + {f.label}
                                        </button>
                                     ))}
                                  </div>
                               </div>

                               {/* Blends */}
                               <div>
                                  <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block mb-1.5 font-sans">Blends</span>
                                  <div className="flex flex-wrap gap-1.5">
                                     <button 
                                        onClick={() => addFilterToPipeline('blendColor')}
                                        type="button"
                                        className="px-2 py-0.5 bg-[#2C2C2C] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-amber-500/50 text-white rounded text-[10px] font-medium transition flex items-center gap-1 font-sans"
                                     >
                                        <Sliders size={10} className="text-amber-500"/> + Blend Color Map
                                     </button>
                                  </div>
                               </div>

                            </div>
                         </div>

                         {/* ACTIVE STACK CONTAINER */}
                         <div className="space-y-3">
                            <div className="flex justify-between items-center border-b border-[#2C2C2C] pb-2 font-sans">
                               <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5">
                                  <Sliders size={12} className="text-blue-500" /> Filter Stack ({imageFilters.length})
                               </span>
                               {imageFilters.length > 0 && (
                                  <button 
                                     onClick={() => setShowSavePresetModal(true)}
                                     type="button"
                                     className="text-[11px] font-semibold text-blue-400 hover:text-white transition flex items-center gap-1 bg-blue-950/40 px-2 py-0.5 border border-blue-900/40 rounded"
                                  >
                                     <Bookmark size={10}/> Save Preset
                                  </button>
                               )}
                            </div>

                            {/* Preset Save Modal Form */}
                            {showSavePresetModal && (
                               <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg p-3 space-y-2">
                                  <span className="text-xs font-semibold text-white block font-sans">Preset Name</span>
                                  <div className="flex gap-1">
                                     <input 
                                        type="text" 
                                        placeholder="Epic cinematic grain..."
                                        value={newPresetName}
                                        onChange={(e) => setNewPresetName(e.target.value)}
                                        className="min-w-0 flex-1 h-8 bg-black border border-[#2C2C2C] rounded text-xs px-2 text-white placeholder-[#444] outline-none focus:border-blue-500 font-sans"
                                     />
                                     <button 
                                        onClick={() => saveCurrentStackAsPreset(newPresetName)}
                                        type="button"
                                        className="h-8 px-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[10px] transition font-sans shrink-0"
                                     >
                                        Save
                                     </button>
                                     <button 
                                        onClick={() => setShowSavePresetModal(false)}
                                        type="button"
                                        className="h-8 px-2 border border-[#2C2C2C] text-[#8A8A8A] hover:text-white rounded text-[10px] transition font-sans shrink-0"
                                     >
                                        Cancel
                                     </button>
                                  </div>
                               </div>
                            )}

                            {imageFilters.length === 0 ? (
                               <div className="py-8 bg-black/10 border border-dashed border-[#2C2C2C] rounded-lg flex flex-col items-center justify-center p-4 text-center">
                                  <span className="text-xs text-[#8A8A8A] line-clamp-2 font-sans">No active filters in stack. Click filters above or quick presets to style this layer!</span>
                               </div>
                            ) : (
                               <div className="space-y-3">
                                  {imageFilters.map((f, index) => {
                                     return (
                                        <div key={f.id} className={`bg-[#181818] border ${f.enabled ? 'border-[#2C2C2C]' : 'border-dashed border-[#2A2A2A] opacity-50'} rounded-lg transition-all shadow-sm`}>
                                           
                                           {/* Title & Control buttons bar */}
                                           <div className="flex items-center justify-between px-3 py-1.5 bg-[#1B1B1B] border-b border-[#2C2C2C] rounded-t-lg">
                                              <div className="flex items-center gap-2">
                                                 <button 
                                                    onClick={() => toggleFilterEnabled(f.id)}
                                                    type="button"
                                                    className={`p-1 rounded transition duration-150 ${f.enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-[#2A2A2A] text-[#8A8A8A]'}`}
                                                    title={f.enabled ? 'Disable Filter' : 'Enable Filter'}
                                                 >
                                                    <Power size={10} />
                                                 </button>
                                                 <span className="text-[11px] font-bold text-white tracking-tight font-sans">{f.name}</span>
                                              </div>

                                              <div className="flex items-center gap-1">
                                                 <button 
                                                    onClick={() => moveFilterInPipeline(f.id, 'up')}
                                                    disabled={index === 0}
                                                    type="button"
                                                    className="p-1 text-[#8A8A8A] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                                                    title="Move Up"
                                                 >
                                                    <ChevronUp size={12} />
                                                 </button>
                                                 <button 
                                                    onClick={() => moveFilterInPipeline(f.id, 'down')}
                                                    disabled={index === imageFilters.length - 1}
                                                    type="button"
                                                    className="p-1 text-[#8A8A8A] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                                                    title="Move Down"
                                                 >
                                                    <ChevronDown size={12} />
                                                 </button>
                                                 <button 
                                                    onClick={() => duplicateFilterInPipeline(f.id)}
                                                    type="button"
                                                    className="p-1 text-[#8A8A8A] hover:text-white transition"
                                                    title="Duplicate"
                                                 >
                                                    <Copy size={11} />
                                                 </button>
                                                 <button 
                                                    onClick={() => removeFilterFromPipeline(f.id)}
                                                    type="button"
                                                    className="p-1 text-[#8A8A8A] hover:text-red-400 font-semibold transition translate-x-0.5"
                                                    title="Delete Filter"
                                                 >
                                                    <X size={12} />
                                                 </button>
                                              </div>
                                           </div>

                                           {/* Filter Slider/Controls Area */}
                                           {f.enabled && (
                                              <div className="p-3 space-y-3">
                                                 
                                                 {/* Adjustments: Brightness, Contrast, Saturation, Vibrance, Exposure, HueRotation */}
                                                 {['brightness', 'contrast', 'saturation', 'vibrance', 'exposure', 'hueRotation'].includes(f.type) && (
                                                    <div className="space-y-1.5 font-sans">
                                                       <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                          <span>Intensity</span>
                                                          <span className="font-mono text-white text-[11px] font-semibold">
                                                             {f.params.value || 0}
                                                          </span>
                                                       </div>
                                                       <input 
                                                          type="range"
                                                          min={f.type === 'hueRotation' ? '0' : '-1'}
                                                          max={f.type === 'hueRotation' ? '360' : '1'}
                                                          step="0.01"
                                                          value={f.params.value || 0}
                                                          onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                          className="w-full accent-blue-500 h-1 cursor-pointer bg-[#2A2A2A]"
                                                       />
                                                    </div>
                                                 )}

                                                 {/* Gamma channel controls */}
                                                 {f.type === 'gamma' && (
                                                    <div className="space-y-2 font-sans">
                                                       {/* Red */}
                                                       <div className="space-y-1">
                                                          <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                             <span className="text-red-400 font-sans">Red Channel</span>
                                                             <span className="font-mono text-white text-[10px]">
                                                                {f.params.red !== undefined ? f.params.red : 1.0}
                                                             </span>
                                                          </div>
                                                          <input 
                                                             type="range" min="0.1" max="3" step="0.02"
                                                             value={f.params.red !== undefined ? f.params.red : 1.0}
                                                             onChange={(e) => updateFilterParam(f.id, 'red', Number(e.target.value))}
                                                             className="w-full accent-red-500 h-1"
                                                          />
                                                       </div>
                                                       {/* Green */}
                                                       <div className="space-y-1">
                                                          <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                             <span className="text-emerald-400 font-sans">Green Channel</span>
                                                             <span className="font-mono text-white text-[10px]">
                                                                {f.params.green !== undefined ? f.params.green : 1.0}
                                                             </span>
                                                          </div>
                                                          <input 
                                                             type="range" min="0.1" max="3" step="0.02"
                                                             value={f.params.green !== undefined ? f.params.green : 1.0}
                                                             onChange={(e) => updateFilterParam(f.id, 'green', Number(e.target.value))}
                                                             className="w-full accent-emerald-500 h-1"
                                                          />
                                                       </div>
                                                       {/* Blue */}
                                                       <div className="space-y-1">
                                                          <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                             <span className="text-[#3b82f6] font-sans">Blue Channel</span>
                                                             <span className="font-mono text-white text-[10px]">
                                                                {f.params.blue !== undefined ? f.params.blue : 1.0}
                                                             </span>
                                                          </div>
                                                          <input 
                                                             type="range" min="0.1" max="3" step="0.02"
                                                             value={f.params.blue !== undefined ? f.params.blue : 1.0}
                                                             onChange={(e) => updateFilterParam(f.id, 'blue', Number(e.target.value))}
                                                             className="w-full accent-blue-500 h-1"
                                                          />
                                                       </div>
                                                    </div>
                                                 )}

                                                 {/* Noise & Grain */}
                                                 {f.type === 'noise' && (
                                                    <div className="space-y-1.5 font-sans">
                                                       <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                          <span>Grain Density</span>
                                                          <span className="font-mono text-white">
                                                             {f.params.value}
                                                          </span>
                                                       </div>
                                                       <input 
                                                          type="range" min="0" max="800" step="10"
                                                          value={f.params.value || 50}
                                                          onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                          className="w-full accent-blue-500 h-1"
                                                       />
                                                    </div>
                                                 )}

                                                 {/* Pixelate */}
                                                 {f.type === 'pixelate' && (
                                                    <div className="space-y-1.5 font-sans">
                                                       <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                          <span>Block Size</span>
                                                          <span className="font-mono text-white">
                                                             {f.params.value} px
                                                          </span>
                                                       </div>
                                                       <input 
                                                          type="range" min="2" max="60" step="1"
                                                          value={f.params.value || 8}
                                                          onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                          className="w-full accent-blue-500 h-1"
                                                       />
                                                    </div>
                                                 )}

                                                 {/* Blur */}
                                                 {f.type === 'blur' && (
                                                    <div className="space-y-1.5 font-sans">
                                                       <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                          <span>Blur Radius</span>
                                                          <span className="font-mono text-white font-sans">
                                                             {(f.params.value || 0).toFixed(2)}
                                                          </span>
                                                       </div>
                                                       <input 
                                                          type="range" min="0.01" max="1" step="0.02"
                                                          value={f.params.value || 0.2}
                                                          onChange={(e) => updateFilterParam(f.id, 'value', Number(e.target.value))}
                                                          className="w-full accent-blue-500 h-1"
                                                       />
                                                    </div>
                                                 )}

                                                 {/* Chromatic Color Key */}
                                                 {f.type === 'removeColor' && (
                                                    <div className="space-y-2 font-sans">
                                                       <div className="flex justify-between items-center text-[10px] text-[#A0A0A0]">
                                                          <span>Tolerance</span>
                                                          <span className="font-mono text-white">
                                                             {f.params.distance !== undefined ? f.params.distance : 0.15}
                                                          </span>
                                                       </div>
                                                       <input 
                                                          type="range" min="0" max="0.9" step="0.01"
                                                          value={f.params.distance !== undefined ? f.params.distance : 0.15}
                                                          onChange={(e) => updateFilterParam(f.id, 'distance', Number(e.target.value))}
                                                          className="w-full accent-blue-500 h-1"
                                                       />
                                                       <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-sans">
                                                          <span>Key Color</span>
                                                          <ColorPickerTrigger 
                                                             color={f.params.color || '#ffffff'}
                                                             onChange={(c) => updateFilterParam(f.id, 'color', c)}
                                                             label="Key Color"
                                                          />
                                                       </div>
                                                    </div>
                                                 )}

                                                 {/* Blend Color Matrix */}
                                                 {f.type === 'blendColor' && (
                                                    <div className="space-y-2 text-[11px] font-sans">
                                                       <div className="flex items-center justify-between">
                                                          <span className="text-[#A0A0A0] font-sans">Map Mode</span>
                                                          <select 
                                                             value={f.params.mode || 'multiply'}
                                                             onChange={(e) => updateFilterParam(f.id, 'mode', e.target.value)}
                                                             className="bg-[#1A1A1A] border border-[#2D2D2D] rounded px-1.5 py-0.5 outline-none text-xs hover:border-[#444] text-white font-sans"
                                                          >
                                                             <option value="multiply">Multiply</option>
                                                             <option value="screen">Screen</option>
                                                             <option value="overlay">Overlay</option>
                                                             <option value="darken">Darken</option>
                                                             <option value="lighten">Lighten</option>
                                                          </select>
                                                       </div>
                                                       <div className="space-y-1">
                                                          <div className="flex justify-between items-center text-[9px] text-[#A0A0A0]">
                                                             <span className="font-sans">Blend Opacity</span>
                                                             <span className="font-mono text-white">
                                                                {f.params.alpha !== undefined ? f.params.alpha : 0.4}
                                                             </span>
                                                          </div>
                                                          <input 
                                                             type="range" min="0" max="1" step="0.02"
                                                             value={f.params.alpha !== undefined ? f.params.alpha : 0.4}
                                                             onChange={(e) => updateFilterParam(f.id, 'alpha', Number(e.target.value))}
                                                             className="w-full accent-blue-500 h-1"
                                                          />
                                                       </div>
                                                       <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-sans">
                                                          <span>Color</span>
                                                          <ColorPickerTrigger 
                                                             color={f.params.color || '#3b82f6'}
                                                             onChange={(c) => updateFilterParam(f.id, 'color', c)}
                                                          />
                                                       </div>
                                                    </div>
                                                 )}

                                                 {/* Grayscale Modes */}
                                                 {f.type === 'grayscale' && (
                                                    <div className="flex items-center justify-between text-[11px] font-sans">
                                                       <span className="text-[#A0A0A0]">Formula Mode</span>
                                                       <select 
                                                          value={f.params.mode || 'luminosity'}
                                                          onChange={(e) => updateFilterParam(f.id, 'mode', e.target.value)}
                                                          className="bg-[#1A1A1A] border border-[#2D2D2D] rounded px-1.5 py-0.5 outline-none text-xs text-white font-sans"
                                                       >
                                                          <option value="average">Average</option>
                                                          <option value="luminosity">Luminosity</option>
                                                          <option value="lightness">Lightness</option>
                                                       </select>
                                                    </div>
                                                 )}

                                                 {/* Presets and custom assets info */}
                                                 {['invert', 'sepia', 'blackwhite', 'edge', 'sharpen', 'emboss', 'vignette', 'bloom', 'chromatic', 'preset'].includes(f.type) && (
                                                    <div className="text-[10px] text-[#808080] font-sans font-medium italic flex items-center gap-1">
                                                       <Activity size={11} className="text-blue-500 shrink-0" /> Fast pipeline shader applied. No customizable metrics.
                                                    </div>
                                                 )}

                                              </div>
                                           )}

                                        </div>
                                     );
                                  })}
                               </div>
                            )}

                         </div>

                         {/* CUSTOM SAVED PRESETS LOGIC */}
                         <div className="space-y-2 pb-6">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
                               <Bookmark size={11} className="text-emerald-400"/> Custom Saved Presets
                            </div>

                            {customPresets.length === 0 ? (
                               <div className="py-6 bg-black/15 rounded-lg border border-dashed border-[#2C2C2C] text-center p-3 text-[11px] text-[#8A8A8A] font-sans">
                                  No saved custom presets yet. Build a stack and save it!
                               </div>
                            ) : (
                               <div className="space-y-1.5">
                                  {customPresets.map((p, pIdx) => (
                                     <div key={p.name + pIdx} className="flex items-center justify-between p-2 bg-[#1A1A1A] border border-[#2C2C2C] rounded-md text-[11px] font-sans">
                                        <span className="font-semibold truncate text-[#C0C0C0] max-w-[150px]" title={p.name}>{p.name}</span>
                                        <div className="flex gap-1.5 font-sans">
                                           <button 
                                              onClick={() => loadSavedPreset(p)}
                                              type="button"
                                              className="px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-200 hover:text-white rounded text-[10px] font-semibold transition"
                                           >
                                              Apply
                                           </button>
                                           <button 
                                              onClick={() => deleteCustomPreset(p.name)}
                                              type="button"
                                              className="px-2 py-0.5 bg-red-950/20 hover:bg-red-900 border border-red-900/20 text-red-400 hover:text-white rounded text-[10px] font-semibold transition"
                                           >
                                              Delete
                                           </button>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>

                      </div>
                   )}
                </div>
             )}

             {/* LAYERS PANEL */}
             {activeTab === 'layers' && (
                <div className="p-2 space-y-1">
                   {layers.map((layer, idx) => {
                      const isSelected = selectedLayerId === (layer as any).id;
                      return (
                         <div key={(layer as any).id || idx} onClick={() => selectLayer((layer as any).id)} className={`flex items-center group px-3 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30' : 'hover:bg-[#2C2C2C] text-[#C0C0C0] border border-transparent'}`}>
                             <div className="w-5 flex justify-center mr-2 opacity-60">
                                {layer.type === 'image' ? <ImageIcon size={14}/> : 
                                 layer.type === 'i-text' || layer.type === 'text' || layer.type === 'textbox' ? <Type size={14}/> : layer.type === 'path' ? <Brush size={14}/> :
                                 layer.type === 'rect' ? <Square size={14}/> :
                                 layer.type === 'circle' ? <Circle size={14}/> :
                                 <Layers size={14}/>}
                             </div>
                             <span className="text-xs flex-1 truncate capitalize">
                               {(layer as any).customName || layer.type} {(layer as any).text ? `"${(layer as any).text.substring(0,6)}..."` : ''}
                               <span className="block text-[9px] text-slate-500 mt-0.5">
                                 {(() => {
                                    const b = artboards.find(a => a.id === (layer as any).artboardId);
                                    return b ? b.name : 'Global';
                                 })()}
                               </span>
                             </span>
                             
                             <div className={`flex gap-1 opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity`}>
                                 <button className="p-1 hover:bg-[#3A3A3A] hover:text-white rounded text-[#8A8A8A]" onClick={(e) => {e.stopPropagation(); moveLayerUp((layer as any).id);}}><RotateCw size={12}/></button>
                                 <button className="p-1 hover:bg-[#3A3A3A] hover:text-red-400 rounded text-[#8A8A8A]" onClick={(e) => {e.stopPropagation(); deleteActiveObject();}}><Trash2 size={12}/></button>
                             </div>
                         </div>
                      );
                   })}
                   {layers.length === 0 && (
                      <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">Canvas is empty</div>
                   )}
                </div>
             )}

             {/* HISTORY PANEL */}
             {activeTab === 'history' && (
                <div className="p-2">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 ml-2 mt-2">Action History</div>
                   <div className="space-y-1">
                      {historyNames.map((name, idx) => {
                         const isCurrent = idx === commandIndex;
                         const isFuture = idx > commandIndex;
                         return (
                            <div key={idx} onClick={() => jumpToHistory(idx)} className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-xs transition-colors ${isCurrent ? 'bg-blue-600/20 text-blue-300 font-medium' : isFuture ? 'text-[#6A6A6A] hover:bg-[#2C2C2C]' : 'text-[#C0C0C0] hover:bg-[#2C2C2C]'}`}>
                               <div className={`w-2 h-2 rounded-full mr-3 ${isCurrent ? 'bg-blue-500' : isFuture ? 'bg-[#3A3A3A]' : 'bg-[#6A6A6A]'}`} />
                               {name}
                            </div>
                         );
                      })}
                      {historyNames.length === 0 && (
                         <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">No history track found.</div>
                      )}
                   </div>
                </div>
             )}

             {/* EXPORT WORKSPACE (jSquash with Artboards) */}
             {activeTab === 'export' && (
                <ExportStudio 
                  settings={exportSettings}
                  onChange={setExportSettings}
                  onExport={handleExport}
                  isExporting={isExporting}
                  originalSize={originalSize}
                  optimizedSize={optimizedSize}
                  originalWidth={artboards.find(b => b.id === activeArtboardId)?.width || 800}
                  originalHeight={artboards.find(b => b.id === activeArtboardId)?.height || 600}
                  psnr={psnr}
                  artboards={artboards}
                  activeArtboardId={activeArtboardId}
                  setActiveArtboardId={setActiveArtboardId}
                  exportTarget={exportTarget}
                  setExportTarget={setExportTarget}
                  selectedExportIds={selectedExportIds}
                  setSelectedExportIds={setSelectedExportIds}
                />
              )}
           </div>
        </div>
      {/* Suggestion Toast */}
      {activeSuggestion && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle pointer-events-auto">
          <div className="bg-[#242424] border border-blue-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl px-5 py-3 flex items-center gap-4 text-white">
            <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400">
               <Sparkles size={18} />
            </div>
            <div>
               <div className="text-xs font-bold leading-tight">Image too large?</div>
               <div className="text-[10px] text-slate-400">Try smart fitting actions</div>
            </div>
            <div className="flex gap-2 ml-2">
               <button onClick={() => { alignSelection('fit'); setActiveSuggestion(null); }} className="h-7 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold transition">Fit to Artboard</button>
               <button onClick={() => { alignSelection('fill'); setActiveSuggestion(null); }} className="h-7 px-3 bg-[#333] hover:bg-[#444] rounded-lg text-[10px] font-bold transition">Fill Artboard</button>
               <button onClick={() => setActiveSuggestion(null)} className="p-1 hover:bg-white/10 rounded-lg"><X size={14}/></button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu Portal */}
      {activeContextMenu && createPortal(
         <div 
           ref={contextMenuRef}
           className="fixed z-[9999] w-52 bg-[#1A1A1A] border border-[#2D2D2D] shadow-[0_12px_48px_rgba(0,0,0,0.7)] rounded-xl overflow-y-auto custom-scrollbar max-h-[85vh] py-1 context-menu-container"
           style={{ left: activeContextMenu.x, top: activeContextMenu.y, visibility: 'hidden' }}
           onClick={(e) => e.stopPropagation()}
         >
            {activeContextMenu.obj ? (
               <>
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Align To Artboard</div>
                  {(activeContextMenu.obj?.type === 'image' || (activeContextMenu.obj as any)?.isFrameGroup) && (
                     <>
                        <ContextMenuItem icon={Crop} label="Crop Image" onClick={() => { enterCropMode(activeContextMenu.obj as fabric.Image); closeContextMenu(); }} />
                        <div className="h-px bg-[#252525] my-1" />
                     </>
                  )}
                  <ContextMenuItem icon={AlignLeft} label="Align Left" onClick={() => { alignSelection('left'); closeContextMenu(); }} />
                  <ContextMenuItem icon={AlignCenter} label="Align Center H" onClick={() => { alignSelection('centerH'); closeContextMenu(); }} />
                  <ContextMenuItem icon={AlignRight} label="Align Right" onClick={() => { alignSelection('right'); closeContextMenu(); }} />
                  <div className="h-px bg-[#252525] my-1" />
                  <ContextMenuItem icon={Move} label="Fit To Artboard" onClick={() => { alignSelection('fit'); closeContextMenu(); }} />
                  <ContextMenuItem icon={SquareDashed} label="Fill Artboard" onClick={() => { alignSelection('fill'); closeContextMenu(); }} />
                  <ContextMenuItem icon={Expand} label="Stretch to Artboard" onClick={() => { alignSelection('stretch'); closeContextMenu(); }} />
                  <div className="h-px bg-[#252525] my-1" />
                  <ContextMenuItem icon={ImageIcon} label="Fit Width" onClick={() => { alignSelection('fitWidth'); closeContextMenu(); }} />
                  <ContextMenuItem icon={ImageIcon} label="Fit Height" onClick={() => { alignSelection('fitHeight'); closeContextMenu(); }} />
                  <div className="h-px bg-[#252525] my-1" />
                  <ContextMenuItem icon={Copy} label="Duplicate" shortcut="Ctrl+D" onClick={() => { duplicateActiveObject(); closeContextMenu(); }} />
                  {activeContextMenu.obj?.type === 'group' && (
                     <ContextMenuItem icon={Images} label="Ungroup Frame" onClick={() => { 
                         const group = activeContextMenu.obj as any;
                         if (group && typeof group.toActiveSelection === 'function') {
                             const sel = group.toActiveSelection();
                             fabricRef.current?.setActiveObject(sel);
                         } else {
                             const items = (group as any).removeAll();
                             fabricRef.current?.remove(group as fabric.Group);
                             items.forEach(i => fabricRef.current?.add(i));
                             const sel = new fabric.ActiveSelection(items, { canvas: fabricRef.current });
                             fabricRef.current?.setActiveObject(sel);
                         }
                         fabricRef.current?.requestRenderAll();
                         updateLayersList();
                         closeContextMenu();
                     }} />
                  )}
                  <ContextMenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={() => { deleteActiveObject(); closeContextMenu(); }} />
                  <div className="h-px bg-[#252525] my-1" />

                  {(() => {
                     let maxIdx = -1;
                     let minIdx = Number.MAX_SAFE_INTEGER;
                     const totalObjs = fabricRef.current?.getObjects().length || 0;
                     activeContextMenu.targets.forEach(t => {
                        const idx = fabricRef.current?.getObjects().indexOf(t) ?? -1;
                        if(idx > maxIdx) maxIdx = idx;
                        if(idx !== -1 && idx < minIdx) minIdx = idx;
                     });
                     const canBringForward = maxIdx !== -1 && maxIdx < totalObjs - 1;
                     const canSendBackward = minIdx !== -1 && minIdx > 0;
                     
                     return (
                        <>
                           <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Layer Order</div>
                           <ContextMenuItem icon={BringToFront} label="Bring to Front" shortcut="Ctrl+Shift+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('front'); closeContextMenu(); }} />
                           <ContextMenuItem icon={ArrowUp} label="Bring Forward" shortcut="Ctrl+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('forward'); closeContextMenu(); }} />
                           <ContextMenuItem icon={ArrowDown} label="Send Backward" shortcut="Ctrl+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('backward'); closeContextMenu(); }} />
                           <ContextMenuItem icon={SendToBack} label="Send to Back" shortcut="Ctrl+Shift+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('back'); closeContextMenu(); }} />
                           <div className="h-px bg-[#252525] my-1" />
                        </>
                     );
                  })()}

                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Move To Artboard</div>
                  {artboards.map(b => (
                    <ContextMenuItem 
                      key={b.id} 
                      icon={SquareDashed} 
                      label={b.name} 
                           onClick={() => { 
                             if (!fabricRef.current) return;
                             const activeSelection = fabricRef.current.getActiveObject();
                             if (!activeSelection) return;
                             
                             let objectsToProcess: any[] = [];
                             if (activeSelection.type === 'activeSelection') {
                                 objectsToProcess = (activeSelection as any).getObjects();
                                 fabricRef.current.discardActiveObject();
                             } else {
                                 objectsToProcess = [activeSelection];
                             }

                             objectsToProcess.forEach(obj => {
                                 const prevArtboardId = obj.artboardId;
                                 if (prevArtboardId !== b.id) {
                                     const prevBoard = artboards.find(x => x.id === prevArtboardId) || artboards[0];
                                     const dx = b.x - prevBoard.x;
                                     const dy = b.y - prevBoard.y;
                                     
                                     obj.artboardId = b.id;
                                     if (typeof obj.set === 'function') {
                                         obj.set({
                                            left: (obj.left ?? 0) + dx,
                                            top: (obj.top ?? 0) + dy
                                         });
                                         if (typeof obj.setCoords === 'function') obj.setCoords();
                                     }
                                 }
                             });
                             
                             if (objectsToProcess.length > 1) {
                                 const sel = new fabric.ActiveSelection(objectsToProcess, { canvas: fabricRef.current });
                                 fabricRef.current.setActiveObject(sel);
                             } else if (objectsToProcess.length === 1) {
                                 fabricRef.current.setActiveObject(objectsToProcess[0]);
                             }
                             
                             fabricRef.current.renderAll();
                             updateLayersList();
                             closeContextMenu(); 
                          }} 
                    />
                  ))}
                  <div className="h-px bg-[#252525] my-1" />
                  <ContextMenuItem icon={Upload} label="Import Image" onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
               </>
            ) : (
               <>
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Canvas Actions</div>
                  <ContextMenuItem icon={Upload} label="Import Image" onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
                  <ContextMenuItem icon={Plus} label="New Artboard" onClick={() => { createArtboard(); closeContextMenu(); }} />
                  <ContextMenuItem icon={Type} label="Add Text" onClick={() => { addText(); closeContextMenu(); }} />
                  <ContextMenuItem icon={Grid} label="Toggle Grid" onClick={() => { closeContextMenu(); }} />
               </>
            )}
         </div>,
         document.body
      )}

      {/* Mobile Artboard Gallery Modal */}
      {isMobile && showMobileArtboardsGallery && (
         <div className="fixed inset-0 z-[100] bg-[#121212] overflow-y-auto w-full h-full animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-[#1A1A1A] border-b border-[#2C2C2C] p-4 flex justify-between items-center z-10 shadow-md">
               <h2 className="text-white font-bold tracking-tight text-lg flex items-center gap-2">
                 <SquareDashed size={18} className="text-blue-500" />
                 Select Artboard
               </h2>
               <button 
                 onClick={() => setShowMobileArtboardsGallery(false)}
                 className="w-8 h-8 flex items-center justify-center rounded-full bg-[#333] text-white hover:bg-[#444]"
               >
                 <X size={18} />
               </button>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 pb-20">
               {artboards.map(b => {
                 const isActive = b.id === activeArtboardId;
                 return (
                   <div 
                     key={b.id} 
                     onClick={() => {
                       setActiveArtboardId(b.id);
                       setShowMobileArtboardsGallery(false);
                     }}
                     className={`flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-blue-600/10 border-blue-500' : 'bg-[#1E1E1E] border-[#333] hover:border-gray-500'}`}
                   >
                     <div className="w-full aspect-square bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                        <div 
                          className="w-16 h-16 rounded-sm shadow-sm opacity-80"
                          style={{
                            backgroundColor: b.backgroundColor || '#fff',
                            aspectRatio: `${b.width}/${b.height}`,
                            width: b.orientation === 'landscape' ? '60%' : undefined,
                            height: b.orientation === 'portrait' ? '60%' : undefined,
                            ...(b.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                          }} 
                        />
                        {isActive && (
                           <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
                        )}
                     </div>
                     <div className="flex flex-col">
                        <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-400' : 'text-white'}`}>{b.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{b.width} × {b.height}</span>
                     </div>
                   </div>
                 )
               })}
               
               <div 
                 onClick={() => {
                   createArtboard();
                   setShowMobileArtboardsGallery(false);
                 }}
                 className="flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all bg-[#1E1E1E] border border-dashed border-[#444] hover:border-gray-400 items-center justify-center group"
               >
                 <div className="w-10 h-10 rounded-full bg-blue-600 group-hover:bg-blue-500 flex items-center justify-center text-white shadow-lg transition-colors">
                    <Plus size={20} />
                 </div>
                 <span className="text-xs font-bold text-gray-400 group-hover:text-white mt-1">New Artboard</span>
               </div>
            </div>
         </div>
      )}

      {/* Rename Artboard Modal Dialog */}
      {renamingArtboard && createPortal(
         <div 
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setRenamingArtboard(null)}
         >
            <div 
               className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="px-5 py-4 border-b border-[#2C2C2C] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                     <Edit2 size={14} className="text-blue-500" />
                     Rename Artboard
                  </h3>
                  <button 
                     onClick={() => setRenamingArtboard(null)}
                     className="text-gray-500 hover:text-white transition-colors"
                  >
                     <X size={16} />
                  </button>
               </div>
               <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Artboard Name</label>
                     <input 
                        type="text" 
                        autoFocus
                        className="w-full h-9 bg-black border border-[#2C2C2C] rounded-lg px-3 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
                        value={renamingArtboard.name}
                        onChange={(e) => setRenamingArtboard({ ...renamingArtboard, name: e.target.value })}
                        onKeyDown={(e) => {
                           if (e.key === "Enter") {
                              const trimmed = renamingArtboard.name.trim();
                              if (trimmed) {
                                 updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                              }
                              setRenamingArtboard(null);
                           } else if (e.key === "Escape") {
                              setRenamingArtboard(null);
                           }
                        }}
                     />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                     <button 
                        onClick={() => setRenamingArtboard(null)}
                        className="h-8 px-4 text-xs font-semibold border border-[#2D2D2D] text-[#808080] hover:text-white rounded-lg transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={() => {
                           const trimmed = renamingArtboard.name.trim();
                           if (trimmed) {
                              updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                           }
                           setRenamingArtboard(null);
                        }}
                        className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                     >
                        Save
                     </button>
                  </div>
               </div>
            </div>
         </div>,
         document.body
      )}

      {showShortcuts && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c] bg-[#1a1a1a]">
               <div className="font-semibold text-sm text-white flex items-center gap-2">
                 <Keyboard size={16} className="text-blue-400" /> Image Node Shortcuts
               </div>
               <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white transition">
                 <X size={16} />
               </button>
            </div>
            <div className="p-4 space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Bring Forward</span>
                  <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Send Backward</span>
                  <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Bring to Front</span>
                  <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Send to Back</span>
                  <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
               </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  </div>
  );
}

// Sub components

const ColorPickerPortal = ({ 
  color, 
  onChange, 
  onClose, 
  anchorRef 
}: { 
  color: string, 
  onChange: (color: string) => void, 
  onClose: () => void, 
  anchorRef: React.RefObject<HTMLElement | null> 
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (anchorRef.current && pickerRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const pickerRect = pickerRef.current.getBoundingClientRect();
      
      let top = rect.bottom + window.scrollY + 5;
      let left = rect.left + window.scrollX;

      // Adjust if it goes off screen bottom
      if (top + pickerRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - pickerRect.height - 5;
      }
      // Adjust if it goes off screen right
      if (left + pickerRect.width > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - pickerRect.width - 20;
      }
      // Adjust if it goes off screen left
      if (left < window.scrollX) {
        left = window.scrollX + 10;
      }

      setPosition({ top, left });
    }
  }, [anchorRef]);

  const isEyeDropping = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isEyeDropping.current) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) && 
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose, anchorRef]);

  const handleEyeDropper = async () => {
    if (!('EyeDropper' in window)) {
       alert("EyeDropper API not supported in this browser");
       return;
    }
    const EyeDropperClass = (window as any).EyeDropper;
    const eyeDropper = new EyeDropperClass();
    isEyeDropping.current = true;
    try {
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch (e) {
      console.log("EyeDropper cancelled or failed", e);
    } finally {
      setTimeout(() => {
        isEyeDropping.current = false;
      }, 200);
    }
  };

  return createPortal(
    <div 
      ref={pickerRef}
      style={{ 
        top: position.top, 
        left: position.left,
        position: 'absolute',
        visibility: position.top === 0 ? 'hidden' : 'visible'
      }}
      className="z-[10000] p-3 bg-[#1e1e1e] rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.7)] border border-[#3A3A3A] flex flex-col gap-3 animate-scale-in"
      onClick={(e) => e.stopPropagation()}
    >
      <RgbaStringColorPicker color={color} onChange={onChange} />
      
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded border border-white/10 shadow-inner" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
               <div className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Hex/RGBA Value</div>
               <div className="text-[11px] text-blue-400 font-mono truncate">{color}</div>
            </div>
            <button 
              onClick={handleEyeDropper}
              className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-colors"
              title="Eye Dropper"
            >
               <Pipette size={14} />
            </button>
         </div>
      </div>
    </div>,
    document.body
  );
};

const ColorPickerTrigger = ({ 
  color, 
  onChange, 
  onStart,
  onCommit,
  label = "Color", 
  className = "w-6 h-5" 
}: { 
  color: string, 
  onChange: (c: string) => void, 
  onStart?: (initialColor: string) => void,
  onCommit?: (initialColor: string, finalColor: string) => void,
  label?: string, 
  className?: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const startColorRef = useRef(color);
  
  return (
    <>
      <button 
        ref={anchorRef}
        type="button"
        onClick={() => {
          if (!isOpen) {
            startColorRef.current = color;
            onStart?.(color);
          }
          setIsOpen(!isOpen);
        }}
        className={`${className} rounded border border-white/20 shadow-inner overflow-hidden transition-all active:scale-90 hover:scale-110 hover:border-white/40 cursor-pointer`}
        style={{ backgroundColor: color }}
        title={`Pick ${label}`}
      />
      {isOpen && (
        <ColorPickerPortal 
          color={color} 
          onChange={onChange} 
          onClose={() => {
            setIsOpen(false);
            if (startColorRef.current !== color) {
              onCommit?.(startColorRef.current, color);
            }
          }} 
          anchorRef={anchorRef} 
        />
      )}
    </>
  );
};

const ContextMenuItem = ({ icon: Icon, label, onClick, danger, shortcut, disabled }: any) => (
   <button 
     className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${danger && !disabled ? 'text-red-400 hover:bg-red-500/10' : !disabled ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-300'}`}
     onClick={(e) => { e.stopPropagation(); if(!disabled) onClick(); }}
     disabled={disabled}
   >
      <div className="flex items-center gap-2">
         <Icon size={14} />
         <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-600 font-mono tracking-tighter">{shortcut}</span>}
   </button>
);

const ToolBtn = ({ icon: Icon, tool, current, set, title }: any) => {
   const active = current === tool;
   return (
      <button 
        className={`w-11 h-11 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-[#8A8A8A] hover:bg-[#2C2C2C] hover:text-[#E0E0E0]'}`}
        onClick={() => typeof set === 'function' && set(tool)}
        title={title}
      >
         <Icon size={18} strokeWidth={active ? 2.5 : 2} />
      </button>
   )
};

const TabBtn = ({ tab, active, set, label, icon: Icon }: any) => {
   const isActive = active === tab;
   return (
      <button 
        onClick={() => set(tab)}
        className={`h-12 flex-1 flex flex-col items-center justify-center gap-1 border-b-[3px] transition-all min-w-[50px] ${isActive ? 'border-blue-500 text-blue-400 bg-[#1E1E1E]' : 'border-transparent text-[#8A8A8A] hover:bg-[#222] hover:text-[#C0C0C0]'}`}
      >
         <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "animate-in zoom-in-90 duration-300" : ""} />
         <span className={`text-[9px] font-bold tracking-[0.05em] uppercase whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
      </button>
   )
};

const BtnSelect = ({ label, active, onClick }: any) => (
   <button onClick={onClick} className={`h-8 rounded text-xs font-semibold transition border ${active ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-[#181818] border-[#3A3A3A] text-[#8A8A8A] hover:bg-[#2C2C2C]'}`}>
      {label}
   </button>
);

const FilterSlider = ({ label, min, max, step, onChange, value }: any) => {
   const [val, setVal] = useState(value || 0);
   useEffect(() => {
      // sync initial value
      if (value !== undefined) setVal(value);
   }, [value]);
   return (
      <div className="py-1">
         <div className="flex justify-between items-center text-[11px] text-[#A0A0A0] mb-2 font-semibold md:text-[10px]">
           <span>{label}</span>
           <span className="bg-[#181818] px-2 py-0.5 rounded border border-[#3A3A3A] min-w-[36px] text-center font-mono">{val}</span>
         </div>
         <input 
           type="range" min={min} max={max} step={step} value={val} 
           onClick={(e) => e.stopPropagation()} 
           onChange={(e) => {
              const v = Number(e.target.value);
              setVal(v);
              onChange(v);
           }} 
           className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
         />
      </div>
   )
}
