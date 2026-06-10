import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as fabric from "fabric";
import { loadFromDexie, saveToDexie } from "../utils/fabricDexieSync";
import { useStore } from "../store/useStore";
import { resolveAssetUrl, importFile } from "../utils/assetManager";
import { getValueAtPath } from "../utils/pathUtils";
import { 
  Type, Upload, Download, Undo, Redo, 
  Layers, MousePointer2, Brush, Circle, Square, Minus, Edit2, RotateCw, Image as ImageIcon,
  SquareDashed, X, Crop, History, Settings, Trash2, Copy, Move, FlipHorizontal, FlipVertical,
  Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline,
  Sparkles, ChevronUp, ChevronDown, Plus, Power, Activity, Bookmark, Sliders, Check, Grid, Expand,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Pipette, Star, MoreHorizontal
} from "lucide-react";
import JSZip from "jszip";
import { RgbaStringColorPicker } from "react-colorful";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ImageWorker from "../utils/imageWorker?worker";
import { ExportSettings, DEFAULT_EXPORT_SETTINGS } from "../types/export";
import { ExportStudio } from "./export/ExportStudio";

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
    };
    after: {
      left: number;
      top: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      width: number;
      height: number;
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
      },
      after: {
        left: t.after.left ?? t.obj.left ?? 0,
        top: t.after.top ?? t.obj.top ?? 0,
        scaleX: t.after.scaleX ?? t.obj.scaleX ?? 1,
        scaleY: t.after.scaleY ?? t.obj.scaleY ?? 1,
        angle: t.after.angle ?? t.obj.angle ?? 0,
        width: t.after.width ?? t.obj.width ?? 0,
        height: t.after.height ?? t.obj.height ?? 0,
      }
    }));
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set({
        left: t.before.left,
        top: t.before.top,
        scaleX: t.before.scaleX,
        scaleY: t.before.scaleY,
        angle: t.before.angle,
        width: t.before.width,
        height: t.before.height,
      });
      t.obj.setCoords();
    });
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.targetObjects.forEach(t => {
      t.obj.set({
        left: t.after.left,
        top: t.after.top,
        scaleX: t.after.scaleX,
        scaleY: t.after.scaleY,
        angle: t.after.angle,
        width: t.after.width,
        height: t.after.height,
      });
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
  private before: { fill: any; stroke: any };
  private after: { fill: any; stroke: any };

  constructor(name: string, obj: fabric.Object, before: { fill: any; stroke: any }, after: { fill: any; stroke: any }) {
    this.name = name;
    this.obj = obj;
    this.before = before;
    this.after = after;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.redo(canvas, updateLayers);
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set({ fill: this.before.fill, stroke: this.before.stroke });
    canvas.renderAll();
    updateLayers();
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.obj.set({ fill: this.after.fill, stroke: this.after.stroke });
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
    sorted.forEach(item => {
      const obj = canvas.getObjects().find((o: any) => o.id === item.id);
      if (obj) {
        if (typeof (canvas as any).moveObjectTo === 'function') {
          (canvas as any).moveObjectTo(obj, item.idx);
        } else if (typeof (canvas as any).moveTo === 'function') {
          (canvas as any).moveTo(obj, item.idx);
        } else {
          const objs = canvas.getObjects();
          const currIdx = objs.indexOf(obj);
          if (currIdx !== -1) {
            objs.splice(currIdx, 1);
            objs.splice(item.idx, 0, obj);
          }
        }
      }
    });
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
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [snapTolerance, setSnapTolerance] = useState(10);
  const [activeContextMenu, setActiveContextMenu] = useState<{
    x: number;
    y: number;
    obj: fabric.Object | null;
    targets: fabric.Object[];
  } | null>(null);
  const [artboardDropdown, setArtboardDropdown] = useState<{ id: string, x: number, y: number } | null>(null);
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

  const artboardsRef = useRef(artboards);
  const activeArtboardIdRef = useRef(activeArtboardId);

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
    
    artboardsRef.current.forEach(b => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    // Add some padding
    minX -= 60; minY -= 60;
    maxX += 60; maxY += 60;

    const w = maxX - minX;
    const h = maxY - minY;
    const cw = canvas.width!;
    const ch = canvas.height!;
    
    // Calculate optimal zoom
    const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
    const vpt = canvas.viewportTransform!;
    
    vpt[0] = zoom;
    vpt[3] = zoom;
    vpt[4] = cw / 2 - zoom * (minX + w / 2);
    vpt[5] = ch / 2 - zoom * (minY + h / 2);
    
    canvas.requestRenderAll();
    setZoomPercent(Math.round(zoom * 100));
  }, []);

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
  const [activeTab, setActiveTab] = useState<"properties" | "layers" | "history" | "filters" | "export" | "artboards">("properties");

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

  // Consolidated Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

  // Before / After Comparison Workspace Settings
  const [comparisonMode, setComparisonMode] = useState(false);
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

  const viewportTransformRef = useRef<number[]>([1, 0, 0, 1, 0, 0]);
  const guidesRef = useRef<{ type: 'v' | 'h', pos: number }[]>([]);

  const getTargetArtboard = (obj: fabric.Object): Artboard => {
    const placement = (obj as any).artboardId;
    const board = artboardsRef.current.find(b => b.id === placement) || 
                  artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || 
                  artboardsRef.current[0];
    return board;
  };

  const alignSelection = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight') => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) return;

    const objects = activeObject.type === 'activeSelection' 
      ? (activeObject as fabric.ActiveSelection).getObjects() 
      : [activeObject];

    const board = getTargetArtboard(activeObject);
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

    objects.forEach(obj => {
      const bounds = obj.getBoundingRect();
      const objWidth = bounds.width;
      const objHeight = bounds.height;
      const originX = obj.originX;
      const originY = obj.originY;

      // Adjust for scaling and origin
      const currentScaleX = obj.scaleX || 1;
      const currentScaleY = obj.scaleY || 1;

      switch (mode) {
        case 'left':
          obj.set({ left: board.x + (obj.left! - bounds.left) });
          break;
        case 'centerH':
          obj.set({ left: board.x + (board.width - objWidth) / 2 + (obj.left! - bounds.left) });
          break;
        case 'right':
          obj.set({ left: board.x + board.width - objWidth + (obj.left! - bounds.left) });
          break;
        case 'top':
          obj.set({ top: board.y + (obj.top! - bounds.top) });
          break;
        case 'centerV':
          obj.set({ top: board.y + (board.height - objHeight) / 2 + (obj.top! - bounds.top) });
          break;
        case 'bottom':
          obj.set({ top: board.y + board.height - objHeight + (obj.top! - bounds.top) });
          break;
        case 'stretch':
          obj.set({
            left: board.x + (obj.left! - bounds.left),
            top: board.y + (obj.top! - bounds.top),
            scaleX: board.width / (obj.width! * currentScaleX) * currentScaleX,
            scaleY: board.height / (obj.height! * currentScaleY) * currentScaleY,
          });
          break;
        case 'fit': {
          const scale = Math.min(board.width / objWidth, board.height / objHeight);
          obj.set({
            scaleX: currentScaleX * scale,
            scaleY: currentScaleY * scale,
          });
          const newBounds = obj.getBoundingRect();
          obj.set({
            left: board.x + (board.width - newBounds.width) / 2 + (obj.left! - newBounds.left),
            top: board.y + (board.height - newBounds.height) / 2 + (obj.top! - newBounds.top),
          });
          break;
        }
        case 'fill': {
          const scale = Math.max(board.width / objWidth, board.height / objHeight);
          obj.set({
            scaleX: currentScaleX * scale,
            scaleY: currentScaleY * scale,
          });
          const newBounds = obj.getBoundingRect();
          obj.set({
            left: board.x + (board.width - newBounds.width) / 2 + (obj.left! - newBounds.left),
            top: board.y + (board.height - newBounds.height) / 2 + (obj.top! - newBounds.top),
          });
          break;
        }
        case 'fitWidth': {
          const scale = board.width / objWidth;
          obj.set({
            scaleX: currentScaleX * scale,
            scaleY: currentScaleY * scale,
          });
          const newBounds = obj.getBoundingRect();
          obj.set({
            left: board.x + (obj.left! - newBounds.left),
            top: board.y + (board.height - newBounds.height) / 2 + (obj.top! - newBounds.top),
          });
          break;
        }
        case 'fitHeight': {
          const scale = board.height / objHeight;
          obj.set({
            scaleX: currentScaleX * scale,
            scaleY: currentScaleY * scale,
          });
          const newBounds = obj.getBoundingRect();
          obj.set({
            left: board.x + (board.width - newBounds.width) / 2 + (obj.left! - newBounds.left),
            top: board.y + (obj.top! - newBounds.top),
          });
          break;
        }
      }
      obj.setCoords();
    });

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

        const dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
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
      setSelectedLayerId((active as any).id);
      setSelectionType(active.type);
      
      if (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox') {
        const textObj = active as any;
        setTextProps({
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
      } else if (active.type === 'image') {
        const imgObj = active as any;
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
    if (artboards.length <= 1) {
      alert("At least one artboard must remain in the document!");
      return;
    }
    const idx = artboards.findIndex(b => b.id === id);
    const boardToDelete = artboards[idx];
    const prevActiveId = activeArtboardId;
    let newActiveId = activeArtboardId;
    if (activeArtboardId === id) {
      const updated = artboards.filter(b => b.id !== id);
      const nextActive = updated[idx === 0 ? 0 : idx - 1];
      newActiveId = nextActive.id;
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
      width: containerRef.current.clientWidth - 300,
      height: containerRef.current.clientHeight - 48, // minus header
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = canvas;

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
      setIsLoaded(true);
      setTimeout(fitView, 100);
    }).catch(err => {
      console.error("Dexie load error", err);
      setIsLoaded(true);
    });

    // Window resize handler
    let initialFitDone = false;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current && fabricRef.current) {
          const w = entry.contentRect.width - 300;
          const h = entry.contentRect.height - 48;
          
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

      const boards = artboardsRef.current || [];

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

      const boards = artboardsRef.current || [];

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
    });

    // Panning & Zooming events
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e;
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

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const e = opt.e as any;
        if (!e) return;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
          const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
          
          // Fabric requires updating the internal matrix and firing boundary calcs properly
          const newVpt = vpt.slice();
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
      }
      canvas.requestRenderAll();
    });

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
            img.left = board.x + (board.width - (img.width! * (img.scaleX ?? 1))) / 2;
            img.top = board.y + (board.height - (img.height! * (img.scaleY ?? 1))) / 2;
            
            canvas.add(img);
            canvas.setActiveObject(img);
            
            // Fit view after image is added and positioned
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
    
    initImg();

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

      if (isUndo || isRedo || isDelete) {
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
  }, [performUndo, performRedo, brushType, applyBrushSettings]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fabricRef.current) return;

    const pointer = fabricRef.current.getScenePoint(e.nativeEvent);
    const target = fabricRef.current.findTarget(e.nativeEvent);
    const activeObjects = fabricRef.current.getActiveObjects();

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
    if (!fabricRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const activeObj = fabricRef.current.getActiveObject();
    const activeObjects = fabricRef.current.getActiveObjects();

    setActiveContextMenu({
      x: rect.left,
      y: rect.bottom + 5,
      obj: activeObj || null,
      targets: activeObjects
    });
  };

  const closeContextMenu = () => setActiveContextMenu(null);

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  const setTool = (tool: string) => {
    setActiveTool(tool);
    if (!fabricRef.current) return;
    if (tool === "brush" || tool === "eraser") {
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
    }
    fabricRef.current.isDrawingMode = (tool === "brush" || tool === "eraser");
    applyBrushSettings(brushType);
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
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
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
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
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
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
           const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
           
           // Center in visible viewport (not just canvas center)
           const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
           const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];
           
           img.set({
             left: viewCenterX,
             top: viewCenterY,
             originX: 'center',
             originY: 'center'
           });
           
           canvas.add(img);
           canvas.setActiveObject(img);
           canvas.renderAll();
           
           const cmd = new AddObjectCommand("Add Image", img);
           executeCommand(cmd);
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
  
  const getLayersOrder = () => {
    if (!fabricRef.current) return [];
    return fabricRef.current.getObjects().map((obj: any, idx) => ({
      id: obj.id as string,
      idx
    }));
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
  const applyFilter = (filterType: string, value: number) => {
    const obj = fabricRef.current?.getActiveObject() as any;
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
    const obj = fabricRef.current?.getActiveObject() as any;
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

  return (
    <div 
      className="w-full h-full flex flex-col bg-[#121212] text-[#E0E0E0] select-none" 
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      
      {/* Top Toolbar */}
      <div className="h-12 border-b border-[#2C2C2C] bg-[#1E1E1E] flex items-center px-4 gap-3 shrink-0">
        <ImageIcon size={18} className="text-blue-400" />
        <span className="font-semibold text-sm mr-4 tracking-tight">Studio Editor</span>
        
        {/* Action History Tools */}
        <div className="flex border border-[#3A3A3A] rounded shadow-sm bg-[#181818]">
          <button className={`h-8 w-8 flex items-center justify-center transition-colors ${commandIndex >= 0 ? 'text-[#E0E0E0] hover:bg-[#2C2C2C]' : 'text-[#4A4A4A]'}`} onClick={performUndo} title="Undo (Ctrl+Z)">
             <Undo size={14} />
          </button>
          <div className="w-px h-8 bg-[#3A3A3A]" />
          <button className={`h-8 w-8 flex items-center justify-center transition-colors ${commandIndex < commandsList.length - 1 ? 'text-[#E0E0E0] hover:bg-[#2C2C2C]' : 'text-[#4A4A4A]'}`} onClick={performRedo} title="Redo (Ctrl+Y)">
             <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#3A3A3A] mx-1" />

        <button className="h-8 w-8 hover:bg-[#2C2C2C] text-[#A0A0A0] hover:text-white flex items-center justify-center rounded transition-colors" title="Import Image Options" onClick={handleImportImageClick}>
          <Upload size={14} />
        </button>
        <input id="img-upload" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />

        <div className="flex-1" />

        <button onClick={() => setActiveTab('export')} className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded transition shadow">
          Export & Optimize
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Toolbar - Tools */}
        <div className="w-14 border-r border-[#2C2C2C] bg-[#1E1E1E] flex flex-col items-center py-4 gap-2 z-10 shrink-0 shadow-[4px_0_12px_rgba(0,0,0,0.1)]">
            <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move (V)"/>
            <ToolBtn icon={Move} tool="pan" current={activeTool} set={setTool} title="Pan Canvas (H / Hold Space)"/>
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
           <div className="h-10 bg-[#1E1E1E] border-b border-[#2C2C2C] flex items-center px-1.5 shrink-0 overflow-x-auto no-scrollbar gap-1 relative z-20 shadow-sm select-none">
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
                             const newVpt = vpt.slice();
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
                             className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3A3A3A] text-[#A0A0A0] transition-colors"
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

           {/* Dropdown Menu Portal */}
           {artboardDropdown && (
              <div 
                 className="fixed inset-0 z-50 pointer-events-auto"
                 onClick={() => setArtboardDropdown(null)}
              >
                 <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ left: Math.min(artboardDropdown.x, window.innerWidth - 180), top: artboardDropdown.y }}
                    className="absolute bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg shadow-2xl py-1 min-w-[170px]"
                 >
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#666] border-b border-[#252525] mb-1">Artboard</div>
                    <ContextMenuItem icon={Type} label="Rename Artboard" onClick={() => {
                        const board = artboards.find(b => b.id === artboardDropdown.id);
                        if (board) {
                            const newName = window.prompt("Rename Artboard", board.name);
                            if (newName && newName.trim()) {
                                updateArtboardPropDirect(artboardDropdown.id, "name", newName.trim(), true);
                            }
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

          {/* Squoosh-like image comparison viewer */}
          {comparisonMode && (
             <div className="absolute inset-0 z-10 bg-[#090909] flex flex-col p-6 items-center justify-between select-none">
                {/* Visual Header Option Controls */}
                <div className="w-full flex justify-between items-center bg-[#141414] p-3 rounded-xl border border-[#232323] shadow-lg mb-4 shrink-0 z-30">
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-300">Live Optimization Preview</span>
                   </div>
                   
                   {/* Zoom Control */}
                   <div className="flex items-center gap-1.5 px-2 border-r border-[#2D2D2D] mr-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Zoom</span>
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
                                    // Extremely robust way to get state from any version of the library
                                    const inst = instance.instance;
                                    const state = inst?.transformState || inst?.state || (instance as any).state || (instance as any).transformState;
                                    const wrapper = inst?.wrapperComponent || (instance as any).wrapperComponent;
                                    
                                    if (state && wrapper && typeof state.scale === 'number') {
                                       const { scale, positionX, positionY } = state;
                                       const width = wrapper.offsetWidth;
                                       const height = wrapper.offsetHeight;
                                       
                                       // Calculate center relative to current transform
                                       const centerX = (width / 2 - positionX) / scale;
                                       const centerY = (height / 2 - positionY) / scale;
                                       
                                       // Calculate new position to keep center consistent
                                       const newPositionX = width / 2 - centerX * newZoom;
                                       const newPositionY = height / 2 - centerY * newZoom;
                                       
                                       instance.setTransform(newPositionX, newPositionY, newZoom);
                                    } else {
                                       // Simple fallback
                                       instance.zoomToElement(undefined as any, newZoom);
                                    }
                                 }
                              }}
                              className="w-16 h-1 accent-blue-500 cursor-pointer"
                          />
                          <div className="flex items-center gap-1.5 min-w-[75px]">
                             <span className="text-[10px] text-blue-400 font-mono w-8 text-center">{Math.round(comparisonZoom * 100)}%</span>
                             <button 
                                onClick={() => {
                                   if (transformComponentRef.current) {
                                      transformComponentRef.current.resetTransform();
                                      setComparisonZoom(1);
                                   }
                                }}
                                className="text-[9px] bg-[#2D2D2D] hover:bg-[#3D3D3D] text-slate-300 px-1.5 py-0.5 rounded border border-[#3D3D3D] transition-colors font-bold uppercase tracking-tighter cursor-pointer"
                             >
                                Fit
                             </button>
                          </div>
                   </div>

                   {/* Preview Modes Selection */}
                   <div className="flex bg-[#1D1D1D] p-1 rounded-lg border border-[#2D2D2D] gap-1 shrink-0">
                      {(["split", "side-by-side", "original", "optimized"] as const).map(mode => (
                         <button
                           key={mode}
                           onClick={() => setComparisonPreviewMode(mode)}
                           className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition duration-150 capitalize tracking-wide ${comparisonPreviewMode === mode ? 'bg-blue-600 text-white shadow-md font-semibold' : 'text-[#8A8A8A] hover:bg-[#252525] hover:text-white'}`}
                         >
                            {mode.replace("-", " ")}
                         </button>
                      ))}
                   </div>
                </div>

                {/* Central Canvas Viewport Area */}
                <div className="flex-1 w-full flex items-center justify-center relative min-h-0">
                   {comparisonPreviewMode === "split" && (
                      <div 
                        ref={sliderRef}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        tabIndex={0}
                        className="w-full max-w-4xl h-full max-h-[60vh] relative rounded-xl border border-[#222] bg-[#111] overflow-hidden shadow-2xl group flex items-center justify-center outline-none focus:border-blue-500/50"
                        style={{ aspectRatio: (() => {
                           const b = artboards.find(x => x.id === activeArtboardId) || artboards[0];
                           return b ? `${b.width} / ${b.height}` : "1.33";
                        })() }}
                      >
                         {/* OPTIMIZED PREVIEW (Background layer) */}
                         <div className="absolute inset-0 w-full h-full p-4 overflow-hidden flex items-center justify-center">
                             <TransformWrapper
                               ref={transformComponentRef}
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
                         <div className="absolute top-4 left-4 bg-black/75 text-[#A2A2A2] text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 pointer-events-none backdrop-blur-md">
                            Original: <span className="font-mono text-white text-xs">{formatBytes(originalSize || 0)}</span>
                         </div>

                         {/* Right Side Label (Optimized) */}
                         <div className="absolute top-4 right-4 bg-blue-950/70 text-blue-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-500/20 pointer-events-none backdrop-blur-md">
                            Optimized: <span className="font-mono text-white text-xs">{formatBytes(optimizedSize || 0)}</span>
                         </div>
                      </div>
                   )}

                   {comparisonPreviewMode === "side-by-side" && (
                      <div className="w-full h-full max-w-4xl max-h-[60vh] relative">
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
                               <div className="grid grid-cols-2 gap-4 w-full h-full p-4">
                                  <div className="relative rounded-xl border border-[#222] bg-[#111] overflow-hidden flex flex-col items-center justify-center p-3 shadow-xl">
                                     <div className="w-full h-full flex items-center justify-center">
                                        <img src={originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none" />
                                     </div>
                                     <span className="absolute top-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-white font-bold font-mono">Original: {formatBytes(originalSize || 0)}</span>
                                  </div>
                                  <div className="relative rounded-xl border border-blue-500/20 bg-[#111] overflow-hidden flex flex-col items-center justify-center p-3 shadow-xl">
                                     <div className="w-full h-full flex items-center justify-center">
                                        <img src={optimizedImageUrl || originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none" />
                                     </div>
                                     <span className="absolute top-3 left-3 bg-blue-950/70 px-3 py-1.5 rounded-lg border border-blue-500/20 text-[10px] text-blue-300 font-bold font-mono">Optimized: {formatBytes(optimizedSize || 0)}</span>
                                  </div>
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                      </div>
                   )}

                   {comparisonPreviewMode === "original" && (
                      <div className="w-full h-full max-h-[60vh] max-w-4xl relative border border-[#222] rounded-xl bg-[#111] overflow-hidden flex items-center justify-center shadow-2xl">
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
                                  <img src={originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none mx-auto" />
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                         <span className="absolute top-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-white font-bold font-mono">Original Only ({formatBytes(originalSize || 0)})</span>
                      </div>
                   )}

                   {comparisonPreviewMode === "optimized" && (
                      <div className="w-full h-full max-h-[60vh] max-w-4xl relative border border-blue-500/20 rounded-xl bg-[#111] overflow-hidden flex items-center justify-center shadow-2xl">
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
                                  <img src={optimizedImageUrl || originalImageUrl || ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain pointer-events-none mx-auto" />
                               </div>
                            </TransformComponent>
                         </TransformWrapper>
                         <span className="absolute top-3 left-3 bg-blue-950/70 px-3 py-1.5 rounded-lg border border-blue-500/20 text-[10px] text-blue-300 font-bold font-mono">Optimized Only ({formatBytes(optimizedSize || 0)})</span>
                      </div>
                   )}

                   {/* Floating Green Live Size Indicator */}
                   {optimizedSize && originalSize && originalSize > optimizedSize && (
                      <div className="absolute bottom-4 right-4 bg-emerald-600/95 border border-emerald-500 text-white backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl z-25 flex flex-col items-center justify-center font-bold animate-fade-in transition-all">
                         <div className="text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                            <Activity size={12} className="animate-pulse" />
                            {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}% Smaller
                         </div>
                         <div className="text-lg font-mono font-black">{formatBytes(optimizedSize)}</div>
                         <div className="text-[9px] text-[#A7F3D0] uppercase font-mono tracking-wider mt-0.5">Saved {formatBytes(originalSize - optimizedSize)}</div>
                      </div>
                   )}

                   {/* Visual Quality & Diagnostics analysis floating card */}
                   <div className="absolute bottom-4 left-4 bg-[#141414]/90 border border-[#2E2E2E] text-slate-300 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl z-25 flex flex-col gap-1.5 text-xs text-left">
                      <div className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider border-b border-[#232323] pb-1 flex items-center gap-1.5">
                         <Sliders size={11} className="text-blue-400" /> Quality Diagnostics
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
                               if (exportSettings.format === 'png') return exportSettings.png?.paletteReduction ? 'Optimized 8-Bit Index' : 'Uncompressed Perfect';
                               const q = exportSettings.format === 'jpeg' ? exportSettings.mozjpeg.quality : (exportSettings.format === 'webp' ? exportSettings.webp.quality : exportSettings.avif.cqLevel);
                               if (q > 90) return 'Exceptional Quality';
                               if (q > 75) return 'High/Balanced Quality';
                               if (q > 50) return 'Standard Lossy preview';
                               return 'High Compression';
                            })()}
                         </span>
                      </div>
                   </div>

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
                 const newVpt = vpt.slice();
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
                 const newVpt = vpt.slice();
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

        {/* Right Sidebar - Logic Panels */}
        <div className="w-[300px] border-l border-[#2C2C2C] bg-[#1E1E1E] flex flex-col shrink-0 h-full overflow-hidden shadow-[-4px_0_12px_rgba(0,0,0,0.2)] z-10">
          
          <div className="flex w-full bg-[#1A1A1A] border-b border-[#2C2C2C] overflow-x-auto select-none no-scrollbar">
             <TabBtn tab="properties" active={activeTab} set={setActiveTab} label="Props" icon={Settings} />
             <TabBtn tab="artboards" active={activeTab} set={setActiveTab} label="Artboards" icon={SquareDashed} />
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
                                   type="range" min="1" max="150" step="1" value={brushSize} 
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
                         </div>                                                 {/* Typography Module */}
                          {(selectionType === 'i-text' || selectionType === 'text' || selectionType === 'textbox') && (
                             <div className="space-y-4 border-b border-[#2C2C2C] pb-4 animate-fade-in">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                                   <Type size={12}/> Typography
                                </div>
                                
                                <div className="space-y-3">
                                   {/* Font Family selection */}
                                   <div className="flex items-center gap-2">
                                      <span className="text-xs text-[#8A8A8A] w-14 shrink-0">Font</span>
                                      <select 
                                         className="flex-1 h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500" 
                                         value={textProps.fontFamily} 
                                         onChange={(e) => changeTextProp("fontFamily", e.target.value, "Change Font Family")}
                                      >
                                         <option value="Arial">Arial (Sans-Serif)</option>
                                         <option value="Inter">Inter (Classic Modern)</option>
                                         <option value="Times New Roman">Times New Roman (Elegant Class)</option>
                                         <option value="Georgia">Georgia (Serif)</option>
                                         <option value="Courier New">Courier New (Monospace)</option>
                                         <option value="Fira Code">Fira Code (Tech/Code)</option>
                                         <option value="Impact">Impact (Bold/Poster)</option>
                                         <option value="Trebuchet MS">Trebuchet MS (Clean Sans)</option>
                                         <option value="Comic Sans MS">Comic Sans (Playful)</option>
                                         <option value="Playfair Display">Playfair Display (Serif/Editorial)</option>
                                         <option value="Montserrat">Montserrat (Geometric Sans)</option>
                                         <option value="Oswald">Oswald (Condensed Display)</option>
                                         <option value="Caveat">Caveat (Handwritten/Chic)</option>
                                      </select>
                                   </div>

                                   {/* Font Size & Weight */}
                                   <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs text-[#8A8A8A] w-10 shrink-0">Size</span>
                                         <input 
                                            type="number" 
                                            className="w-full h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500" 
                                            value={textProps.fontSize} 
                                            onChange={(e) => {
                                              const val = Math.max(1, Number(e.target.value));
                                              changeTextProp("fontSize", val, "Change Font Size");
                                            }} 
                                         />
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs text-[#8A8A8A] w-12 shrink-0">Weight</span>
                                         <select 
                                            className="w-full h-8 bg-[#181818] border border-[#3A3A3A] rounded text-xs px-2 outline-none text-white focus:border-blue-500" 
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
                         {selectionType === 'image' && (
                            <div>
                               <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 flex items-center gap-2"><Settings size={12}/> Adjustments Non-Destructive</div>
                               <div className="space-y-4">
                                  <FilterSlider label="Brightness" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('brightness', v)} />
                                  <FilterSlider label="Contrast" min="-0.5" max="0.5" step="0.01" onChange={(v) => applyFilter('contrast', v)} />
                                  <FilterSlider label="Saturation" min="-1" max="1" step="0.01" onChange={(v) => applyFilter('saturation', v)} />
                                  <FilterSlider label="Grayscale" min="0" max="1" step="0.01" onChange={(v) => applyFilter('grayscale', v)} />
                               </div>
                            </div>
                         )}

                         {/* Artboard Assignment and Alignment Module */}
                         <div className="space-y-3 pt-4 border-t border-[#2C2C2C] mb-4">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] flex items-center gap-2">
                               <SquareDashed size={12}/> Artboard Snapping & Align
                            </div>

                            {/* Quick alignment buttons targeting assigned or closest artboard */}
                            <div className="space-y-3">
                               <div className="flex flex-col gap-1.5">
                                 <div className="text-[10px] text-[#A0A0A0] flex justify-between items-center">
                                   <span>Snap Alignment</span>
                                   <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 rounded uppercase font-bold tracking-tighter">Artboard</span>
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
                                 <div className="text-[10px] text-[#A0A0A0]">Fitting & Sizing</div>
                                 <div className="grid grid-cols-2 gap-1">
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
                       <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                           <MousePointer2 size={32} className="mb-4" />
                           <span className="text-sm font-medium">No layer selected</span>
                           <span className="text-xs mt-2 w-48">Select an object on the canvas to edit its properties.</span>
                       </div>
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
                                  type="range" min="1" max="150" step="1" value={brushSize} 
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
                <div className="p-4 space-y-6">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                         <SquareDashed size={16} className="text-blue-400"/>
                         <span className="text-sm font-semibold text-[#E0E0E0]">Doc Artboards</span>
                      </div>
                      <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono font-bold">{artboards.length}</span>
                   </div>

                   {/* Add Pre-configured Artboard Dropdown */}
                   <div className="space-y-2 border-[#2C2C2C] pb-4 border-b">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0]">Create Artboard</div>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar border border-[#2D2D2D] p-1.5 rounded bg-[#161616]">
                         {ARTBOARD_PRESETS.map((preset) => (
                           <button 
                             key={preset.name}
                             onClick={() => createArtboard(preset.name)}
                             className="text-[10px] text-left text-[#C0C0C0] truncate px-2 py-1.5 rounded hover:bg-blue-600 hover:text-white transition bg-[#212121]"
                           >
                             {preset.name}
                           </button>
                         ))}
                      </div>
                      <button 
                        onClick={() => createArtboard()}
                        className="w-full h-8 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition"
                      >
                         + Custom Artboard (800x600)
                      </button>
                   </div>

                   {/* List existing artboards */}
                   <div className="space-y-2 border-[#2C2C2C] pb-4 border-b">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0]">Workspace Boards</div>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                         {artboards.map((board) => {
                           const isActive = board.id === activeArtboardId;
                           return (
                             <div 
                               key={board.id}
                               onClick={() => {
                                 setActiveArtboardId(board.id);
                                 // Shift camera zoom / position focus on selected artboard
                                 if (fabricRef.current) {
                                   const cw = fabricRef.current.width!;
                                   const ch = fabricRef.current.height!;
                                   const vpt = fabricRef.current.viewportTransform!;
                                   const newVpt = vpt.slice();
                                   newVpt[4] = cw / 2 - (board.x + board.width / 2) * newVpt[0];
                                   newVpt[5] = ch / 2 - (board.y + board.height / 2) * newVpt[3];
                                   fabricRef.current.setViewportTransform(newVpt);
                                 }
                               }} 
                               className={`flex items-center justify-between p-2 rounded cursor-pointer border select-none transition ${isActive ? 'bg-blue-600/10 text-blue-100 border-blue-500/50' : 'bg-[#181818] border-transparent hover:border-[#2C2C2C]'}`}
                             >
                                <span className="text-xs truncate max-w-[120px] font-medium">{board.name}</span>
                                <div className="flex gap-1">
                                   <button 
                                     title="Duplicate Board" 
                                     onClick={(e) => { e.stopPropagation(); duplicateArtboard(board); }}
                                     className="p-1 hover:bg-[#2C2C2C] text-[#808080] hover:text-white rounded"
                                   >
                                     <Copy size={11} />
                                   </button>
                                   <button 
                                     title="Delete Board" 
                                     onClick={(e) => { e.stopPropagation(); deleteArtboard(board.id); }}
                                     className="p-1 hover:bg-red-500/20 text-[#808080] hover:text-red-400 rounded"
                                   >
                                     <Trash2 size={11} />
                                   </button>
                                </div>
                             </div>
                           )
                         })}
                      </div>
                   </div>

                   {/* Properties of active artboard */}
                   {(() => {
                      const board = artboards.find(b => b.id === activeArtboardId) || artboards[0];
                      if (!board) return null;
                      return (
                         <div className="space-y-4 pt-1 animate-fade-in">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0]">Board Properties</div>
                            
                            <div className="space-y-3 bg-[#181818] p-3 rounded-lg border border-[#2B2B2B]">
                               {/* Edit Name */}
                               <div>
                                  <label className="text-[10px] text-[#808080]">Artboard Name</label>
                                  <input 
                                    type="text" 
                                    className="w-full h-8 bg-[#212121] border border-[#3A3A3A] rounded px-2 mt-1 text-xs text-white outline-none focus:border-blue-500" 
                                    value={board.name} 
                                    onFocus={() => onArtboardPropStart(board.name)}
                                    onChange={(e) => updateArtboardProp(board.id, "name", e.target.value)} 
                                    onBlur={(e) => onArtboardPropCommit(board.id, "name", e.target.value)}
                                  />
                               </div>

                               {/* Dimensions & Orientation */}
                               <div className="grid grid-cols-2 gap-2">
                                  <div>
                                     <label className="text-[10px] text-[#808080]">Width (px)</label>
                                     <input 
                                       type="number" 
                                       className="w-full h-8 bg-[#212121] border border-[#3A3A3A] rounded px-1.5 mt-1 text-xs text-white outline-none focus:border-blue-500" 
                                       value={board.width} 
                                       onFocus={() => onArtboardPropStart(board.width)}
                                       onChange={(e) => updateArtboardProp(board.id, "width", Math.max(10, Number(e.target.value)))} 
                                       onBlur={(e) => onArtboardPropCommit(board.id, "width", Math.max(10, Number(e.target.value)))}
                                     />
                                  </div>
                                  <div>
                                     <label className="text-[10px] text-[#808080]">Height (px)</label>
                                     <input 
                                       type="number" 
                                       className="w-full h-8 bg-[#212121] border border-[#3A3A3A] rounded px-1.5 mt-1 text-xs text-white outline-none focus:border-blue-500" 
                                       value={board.height} 
                                       onFocus={() => onArtboardPropStart(board.height)}
                                       onChange={(e) => updateArtboardProp(board.id, "height", Math.max(10, Number(e.target.value)))} 
                                       onBlur={(e) => onArtboardPropCommit(board.id, "height", Math.max(10, Number(e.target.value)))}
                                     />
                                  </div>
                               </div>

                               {/* Orientation / Swap directions */}
                               <div className="flex items-center justify-between border-t border-[#262626] pt-2">
                                  <span className="text-[10px] text-[#808080]">Orientation</span>
                                  <div className="flex gap-1.5">
                                     <button 
                                       onClick={() => updateArtboardPropDirect(board.id, "orientation", "landscape", true)}
                                       className={`text-[9px] px-2 py-1 rounded transition border ${board.orientation === "landscape" ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-[#252525] border-transparent text-[#707070]"}`}
                                     >
                                       Landscape
                                     </button>
                                     <button 
                                       onClick={() => updateArtboardPropDirect(board.id, "orientation", "portrait", true)}
                                       className={`text-[9px] px-2 py-1 rounded transition border ${board.orientation === "portrait" ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-[#252525] border-transparent text-[#707070]"}`}
                                     >
                                        Portrait
                                     </button>
                                  </div>
                               </div>

                               {/* Artboard Background Settings */}
                               <div className="border-t border-[#262626] pt-3">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-2 font-sans">Artboard Background</span>
                                  <label className="text-[10px] text-[#808080] block mb-1.5">Fill background</label>
                                  <div className="flex items-center gap-2">
                                     <div className="relative">
                                       <ColorPickerTrigger 
                                          color={board.backgroundColor || "#ffffff"}
                                          onChange={(newColor) => updateArtboardProp(board.id, "backgroundColor", newColor)}
                                          onStart={(initialColor) => onArtboardPropStart(initialColor)}
                                          onCommit={(initialColor, finalColor) => {
                                             onArtboardPropStart(initialColor);
                                             onArtboardPropCommit(board.id, "backgroundColor", finalColor);
                                          }}
                                          label="Board Background"
                                          className="w-7 h-7"
                                       />
                                     </div>
                                     <input 
                                        type="text" 
                                        className="h-7 bg-[#212121] border border-[#3A3A3A] rounded px-2 text-xs text-white w-[88px] uppercase font-mono" 
                                        value={board.backgroundColor || "#FFFFFF"} 
                                        onFocus={() => onArtboardPropStart(board.backgroundColor || "#ffffff")}
                                        onChange={(e) => updateArtboardProp(board.id, "backgroundColor", e.target.value)} 
                                        onBlur={(e) => onArtboardPropCommit(board.id, "backgroundColor", e.target.value)}
                                     />
                                     <div className="ml-auto">
                                       <ModernCheckbox 
                                         label="Transparent"
                                         checked={!!board.transparent} 
                                         onChange={(val) => updateArtboardPropDirect(board.id, "transparent", val, true)} 
                                       />
                                     </div>
                                  </div>
                               </div>

                               {/* Artboard Border Settings */}
                               <div className="border-t border-[#262626] pt-3">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-2 font-sans">Artboard Border</span>
                                  <label className="text-[10px] text-[#808080] block mb-1.5">Border color</label>
                                     <div className="flex items-center gap-2">
                                        <div className="relative">
                                           <ColorPickerTrigger 
                                             color={board.borderColor || "#ffffff"}
                                             onChange={(newColor) => updateArtboardProp(board.id, "borderColor", newColor)}
                                             onStart={(initialColor) => onArtboardPropStart(initialColor || "#ffffff")}
                                             onCommit={(initialColor, finalColor) => {
                                                onArtboardPropStart(initialColor);
                                                onArtboardPropCommit(board.id, "borderColor", finalColor);
                                             }}
                                             label="Board Border"
                                             className="w-7 h-7"
                                           />
                                        </div>
                                        <input 
                                           type="text" 
                                           className="h-7 bg-[#212121] border border-[#3A3A3A] rounded px-2 text-xs text-white w-[88px] uppercase font-mono" 
                                           value={board.borderColor || "#FFFFFF"} 
                                           onFocus={() => onArtboardPropStart(board.borderColor || "#ffffff")}
                                           onChange={(e) => updateArtboardProp(board.id, "borderColor", e.target.value)} 
                                           onBlur={(e) => onArtboardPropCommit(board.id, "borderColor", e.target.value)}
                                        />
                                     </div>
                                  </div>
                               </div>

                            {/* Overlays & Overrides */}
                            <div className="space-y-2 bg-[#181818] p-3 rounded-lg border border-[#2B2B2B]">
                               <div className="text-[10px] font-bold text-[#808080] uppercase tracking-wide">Guides & Overlays</div>
                               <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                                  <ModernCheckbox label="Grid Patterns" checked={!!board.showGrid} onChange={val => updateArtboardPropDirect(board.id, "showGrid", val, true)} />
                                  <ModernCheckbox label="Safe Area (5%)" checked={!!board.showSafeArea} onChange={val => updateArtboardPropDirect(board.id, "showSafeArea", val, true)} />
                                  <ModernCheckbox label="Margins (10%)" checked={!!board.showMargins} onChange={val => updateArtboardPropDirect(board.id, "showMargins", val, true)} />
                                  <ModernCheckbox label="Bleed (3%)" checked={!!board.showBleed} onChange={val => updateArtboardPropDirect(board.id, "showBleed", val, true)} />
                                  <div className="col-span-2">
                                     <ModernCheckbox label="Center Crosshair Guides" checked={!!board.showCenter} onChange={val => updateArtboardPropDirect(board.id, "showCenter", val, true)} />
                                  </div>
                               </div>
                            </div>
                         </div>
                      )
                   })()}
                </div>
             )}

             {/* FILTER STUDIO PANEL */}
             {activeTab === 'filters' && (
                <div className="p-4 space-y-6 text-[#C0C0C0]">
                   {selectionType !== 'image' ? (
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
           className="fixed z-[9999] w-52 bg-[#1A1A1A] border border-[#2D2D2D] shadow-[0_12px_48px_rgba(0,0,0,0.7)] rounded-xl overflow-hidden py-1"
           style={{ left: activeContextMenu.x, top: activeContextMenu.y }}
           onClick={(e) => e.stopPropagation()}
         >
            {activeContextMenu.obj ? (
               <>
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Align To Artboard</div>
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
                  <ContextMenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={() => { deleteActiveObject(); closeContextMenu(); }} />
                  <div className="h-px bg-[#252525] my-1" />
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Move To Artboard</div>
                  {artboards.map(b => (
                    <ContextMenuItem 
                      key={b.id} 
                      icon={SquareDashed} 
                      label={b.name} 
                      onClick={() => { 
                         const activeObjects = fabricRef.current?.getActiveObjects() || [];
                         if (activeObjects.length > 0) {
                             fabricRef.current?.discardActiveObject();
                             activeObjects.forEach((o) => {
                                 const obj = o as any;
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
                                     } else {
                                         obj.left = (obj.left ?? 0) + dx;
                                         obj.top = (obj.top ?? 0) + dy;
                                     }
                                 }
                             });
                             fabricRef.current?.renderAll();
                             updateLayersList();
                         }
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

const ContextMenuItem = ({ icon: Icon, label, onClick, danger, shortcut }: any) => (
   <button 
     className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
     onClick={(e) => { e.stopPropagation(); onClick(); }}
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
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-[#8A8A8A] hover:bg-[#2C2C2C] hover:text-[#E0E0E0]'}`}
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
        className={`h-10 flex flex-col items-center justify-center gap-0.5 border-b-2 transition-colors px-6 min-w-[80px] ${isActive ? 'border-blue-500 text-blue-400 bg-[#252525]' : 'border-transparent text-[#8A8A8A] hover:bg-[#222] hover:text-[#C0C0C0]'}`}
      >
         <Icon size={14} />
         <span className="text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap">{label}</span>
      </button>
   )
}

const BtnSelect = ({ label, active, onClick }: any) => (
   <button onClick={onClick} className={`h-8 rounded text-xs font-semibold transition border ${active ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-[#181818] border-[#3A3A3A] text-[#8A8A8A] hover:bg-[#2C2C2C]'}`}>
      {label}
   </button>
);

const FilterSlider = ({ label, min, max, step, onChange }: any) => {
   const [val, setVal] = useState(0);
   return (
      <div>
         <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] mb-1 font-semibold">
           <span>{label}</span>
           <span className="bg-[#181818] px-1.5 py-0.5 rounded border border-[#3A3A3A] min-w-[30px] text-center">{val}</span>
         </div>
         <input 
           type="range" min={min} max={max} step={step} value={val} 
           onClick={(e) => e.stopPropagation()} // in generic react you just let input event fire
           onChange={(e) => {
              const v = Number(e.target.value);
              setVal(v);
              onChange(v);
           }} 
           className="w-full accent-[#A0A0A0] hover:accent-blue-500 h-1" 
         />
      </div>
   )
}
