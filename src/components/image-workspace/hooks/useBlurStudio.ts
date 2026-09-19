import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as fabric from 'fabric';
import { BlurType, BlurGeometry, blurCanvas, buildBlurMask, composeBlur } from '../services/image/blurStudio';
import { BlurStudioCommand } from '../commands/image/BlurStudioCommand';
import type { SelectionShape } from '../selection/types';
import { sceneShapeToImagePixels } from '../selection/fabricBridge';
import { traceShape } from '../selection/geometry';

export type { BlurType } from '../services/image/blurStudio';

/**
 * Blur Studio: a Gaussian, iris (radial) or tilt-shift blur on one image, previewed live on the
 * canvas and applied as one undoable step.
 *
 * The image being blurred is the "target". It is kept even when a click lands on empty canvas - the
 * iris ring and tilt lines reach past the image, and dragging them must not drop it. Clicking
 * another image makes that one the target.
 *
 * The preview is drawn by the image itself: its displayed pixels are swapped for the previewed ones
 * while the studio is open. It therefore sits in the right place in the layer stack, under the
 * artboard's clipping, with the image's crop, flip and opacity - and nothing extra appears in the
 * layers list. Leaving the studio, holding Compare or applying puts the original back.
 */

/** Previews are worked at up to this size; applying uses the full image. */
const PREVIEW_MAX = 1600;
/** Screen distance, in CSS pixels, within which a handle or a line can be grabbed. */
const HIT_PX = 12;
const HIT_PX_TOUCH = 20;

export const BLUR_DEFAULTS = {
  blurAmount: 16,
  focusSize: 0.2,
  radialFeather: 0.18,
  bandWidth: 0.1,
  bandAngle: 0,
  linearFeather: 0.14,
  center: { x: 0.5, y: 0.5 },
};

type Part =
  | 'radial-center' | 'radial-inner' | 'radial-outer'
  | 'linear-center' | 'linear-rotate' | 'linear-band' | 'linear-feather';

interface Params {
  type: BlurType;
  blurAmount: number;
  radialCenter: { x: number; y: number };
  focusSize: number;
  radialFeather: number;
  linearCenter: { x: number; y: number };
  bandAngle: number;
  bandWidth: number;
  linearFeather: number;
}

/** What is swapped into the image while it previews, and what to put back. */
interface PreviewSwap {
  target: fabric.Image;
  original: CanvasImageSource;
  scaleX: number;
  scaleY: number;
  shown: HTMLCanvasElement | null;
}

const isBlurTarget = (obj: any): obj is fabric.Image =>
  !!obj && obj instanceof fabric.Image && obj.visible !== false;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const elementSize = (el: any) => ({
  width: Number(el?.naturalWidth || el?.videoWidth || el?.width) || 0,
  height: Number(el?.naturalHeight || el?.videoHeight || el?.height) || 0,
});

/** The object's pixels as they are drawn now: its current element, at its own scaling. */
const displayedElement = (obj: fabric.Image): CanvasImageSource | null =>
  ((obj as any)._element as CanvasImageSource) || (obj.getElement?.() as CanvasImageSource) || null;

export function useBlurStudio(
  canvas: fabric.Canvas | null,
  activeTab: string,
  executeCommand: (cmd: any) => void
) {
  const isOpen = activeTab === 'blur-studio';

  /* ── Settings ─────────────────────────────────────────────────────────── */
  const [activeBlurType, setActiveBlurTypeRaw] = useState<BlurType>('gaussian');
  const [blurAmount, setBlurAmountRaw] = useState<number>(BLUR_DEFAULTS.blurAmount);
  const [radialCenter, setRadialCenter] = useState(BLUR_DEFAULTS.center);
  const [focusSize, setFocusSizeRaw] = useState(BLUR_DEFAULTS.focusSize);
  const [radialFeather, setRadialFeatherRaw] = useState(BLUR_DEFAULTS.radialFeather);
  const [linearCenter, setLinearCenter] = useState(BLUR_DEFAULTS.center);
  const [bandAngle, setBandAngleRaw] = useState(BLUR_DEFAULTS.bandAngle);
  const [bandWidth, setBandWidthRaw] = useState(BLUR_DEFAULTS.bandWidth);
  const [linearFeather, setLinearFeatherRaw] = useState(BLUR_DEFAULTS.linearFeather);

  /* ── Target, selection, preview state ────────────────────────────────── */
  const [target, setTarget] = useState<fabric.Image | null>(null);
  const [selectionShape, setSelectionShape] = useState<SelectionShape | null>(null);
  const [limitToSelection, setLimitToSelection] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  /** Set once a blur is applied: the image already carries it, so the preview waits for a change. */
  const [previewPaused, setPreviewPaused] = useState(false);

  // Any change of setting resumes the preview after an apply.
  const resume = <T,>(set: (v: T) => void) => (v: T) => {
    setPreviewPaused(false);
    set(v);
  };
  const setActiveBlurType = useMemo(() => resume(setActiveBlurTypeRaw), []);
  const setBlurAmount = useMemo(() => resume(setBlurAmountRaw), []);
  const setFocusSize = useMemo(() => resume(setFocusSizeRaw), []);
  const setRadialFeather = useMemo(() => resume(setRadialFeatherRaw), []);
  const setBandAngle = useMemo(() => resume(setBandAngleRaw), []);
  const setBandWidth = useMemo(() => resume(setBandWidthRaw), []);
  const setLinearFeather = useMemo(() => resume(setLinearFeatherRaw), []);

  /* ── Refs read by canvas handlers, which are registered once per mode ── */
  const params: Params = {
    type: activeBlurType, blurAmount, radialCenter, focusSize, radialFeather,
    linearCenter, bandAngle, bandWidth, linearFeather,
  };
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const targetRef = useRef<fabric.Image | null>(null);
  targetRef.current = target;
  const dragRef = useRef<Part | null>(null);
  const hoverRef = useRef<Part | null>(null);
  const swapRef = useRef<PreviewSwap | null>(null);
  const blurCacheRef = useRef<{ source: CanvasImageSource; scale: number; radius: number; original: HTMLCanvasElement; blurred: HTMLCanvasElement } | null>(null);

  const activeSelection = limitToSelection ? selectionShape : null;

  /* ======================================================================
   *  Preview swap: the image draws the previewed pixels, then gets its own back
   * ==================================================================== */
  const restorePreview = useCallback(() => {
    const swap = swapRef.current;
    if (!swap) return;
    const img = swap.target as any;
    // Only put the original back if nothing else replaced the pixels meanwhile (an undo, say).
    if (swap.shown && img._element === swap.shown) {
      img._element = swap.original;
      img._filterScalingX = swap.scaleX;
      img._filterScalingY = swap.scaleY;
      img.dirty = true;
    }
    swapRef.current = null;
    canvas?.requestRenderAll();
  }, [canvas]);

  const showPreview = useCallback((obj: fabric.Image, pixels: HTMLCanvasElement, scale: number) => {
    const img = obj as any;
    let swap = swapRef.current;
    if (swap && swap.target !== obj) {
      restorePreview();
      swap = null;
    }
    // New target, or the image's own pixels changed underneath (undo, redo): start from those.
    if (!swap || (swap.shown && img._element !== swap.shown)) {
      swap = {
        target: obj,
        original: img._element,
        scaleX: img._filterScalingX ?? 1,
        scaleY: img._filterScalingY ?? 1,
        shown: null,
      };
      swapRef.current = swap;
    }
    img._element = pixels;
    img._filterScalingX = swap.scaleX * scale;
    img._filterScalingY = swap.scaleY * scale;
    img.dirty = true;
    swap.shown = pixels;
    canvas?.requestRenderAll();
  }, [canvas, restorePreview]);

  /** The image's own pixels, whether or not a preview is currently shown in their place. */
  const pristineFor = useCallback((obj: fabric.Image) => {
    const swap = swapRef.current;
    const img = obj as any;
    if (swap && swap.target === obj && swap.shown && img._element === swap.shown) {
      return { source: swap.original, scaleX: swap.scaleX, scaleY: swap.scaleY };
    }
    return { source: displayedElement(obj), scaleX: img._filterScalingX ?? 1, scaleY: img._filterScalingY ?? 1 };
  }, []);

  /* ======================================================================
   *  EFFECT 1 — which image is being blurred
   * ==================================================================== */
  useEffect(() => {
    if (!canvas || !isOpen) {
      setTarget(null);
      return;
    }
    const active = canvas.getActiveObject();
    setTarget(isBlurTarget(active) ? active : null);

    const onSelect = (e: any) => {
      const picked = e?.selected?.[0] ?? canvas.getActiveObject();
      if (isBlurTarget(picked)) setTarget(picked);
    };
    const onRemoved = (e: any) => {
      if (e?.target && e.target === targetRef.current) setTarget(null);
    };
    canvas.on('selection:created', onSelect);
    canvas.on('selection:updated', onSelect);
    canvas.on('object:removed', onRemoved);
    return () => {
      canvas.off('selection:created', onSelect);
      canvas.off('selection:updated', onSelect);
      canvas.off('object:removed', onRemoved);
    };
  }, [canvas, isOpen]);

  /* ======================================================================
   *  EFFECT 2 — keep the image selected, and the on-canvas handles
   * ==================================================================== */
  useEffect(() => {
    if (!canvas || !isOpen || !target) return;
    const c = canvas as any;
    const directional = activeBlurType !== 'gaussian';

    // A click on empty canvas would drop the image; in the studio it stays the one being blurred.
    const hadOwnClear = Object.prototype.hasOwnProperty.call(c, '_shouldClearSelection');
    const prevClear = c._shouldClearSelection;
    c._shouldClearSelection = (e: any, t: any) => (t ? prevClear.call(canvas, e, t) : false);

    const prev = {
      skipTargetFind: canvas.skipTargetFind,
      selection: canvas.selection,
      defaultCursor: canvas.defaultCursor,
      hasControls: target.hasControls,
    };
    if (directional) {
      // Handles need every drag: the image must not move, rotate or lose its selection under them.
      canvas.skipTargetFind = true;
      canvas.selection = false;
      target.hasControls = false;
    }
    if (canvas.getActiveObject() !== target) canvas.setActiveObject(target);
    canvas.requestRenderAll();

    /* ── Geometry helpers: object-local ⇄ screen (CSS pixels) ───────── */
    const w = target.width || 1;
    const h = target.height || 1;
    const ref = Math.max(w, h);
    const matrix = () => fabric.util.multiplyTransformMatrices(canvas.viewportTransform, target.calcTransformMatrix());
    const toScreen = (lx: number, ly: number) => fabric.util.transformPoint(new fabric.Point(lx, ly), matrix());
    const toLocal = (screen: fabric.Point) => fabric.util.transformPoint(screen, fabric.util.invertTransform(matrix()));
    const normToLocal = (p: { x: number; y: number }) => ({ x: (p.x - 0.5) * w, y: (p.y - 0.5) * h });
    const localToNorm = (lx: number, ly: number) => ({ x: clamp(lx / w + 0.5, 0, 1), y: clamp(ly / h + 0.5, 0, 1) });
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const screenPoint = (e: any) => canvas.getViewportPoint(e.e);
    const hitRadius = (e: any) => (e?.e?.pointerType === 'touch' || e?.e?.type?.startsWith?.('touch') ? HIT_PX_TOUCH : HIT_PX);
    /** Where the rotate knob sits, along the band from its centre. */
    const knobReach = () => Math.min(w, h) * 0.32;

    /** The handle, ring or line under the pointer, nearest first. */
    const hitTest = (sp: fabric.Point, tol: number): Part | null => {
      const p = paramsRef.current;
      const local = toLocal(sp);
      if (p.type === 'radial') {
        const c0 = normToLocal(p.radialCenter);
        if (dist(toScreen(c0.x, c0.y), sp) < tol) return 'radial-center';
        const r = Math.hypot(local.x - c0.x, local.y - c0.y) || 1e-6;
        const ux = (local.x - c0.x) / r;
        const uy = (local.y - c0.y) / r;
        const onRing = (radius: number) => dist(toScreen(c0.x + ux * radius, c0.y + uy * radius), sp);
        const inner = onRing(p.focusSize * ref);
        const outer = onRing((p.focusSize + p.radialFeather) * ref);
        if (Math.min(inner, outer) < tol) return inner <= outer ? 'radial-inner' : 'radial-outer';
        return null;
      }
      if (p.type === 'linear') {
        const c0 = normToLocal(p.linearCenter);
        if (dist(toScreen(c0.x, c0.y), sp) < tol) return 'linear-center';
        const dx = Math.cos(p.bandAngle);
        const dy = Math.sin(p.bandAngle);
        const knob = toScreen(c0.x + dx * knobReach(), c0.y + dy * knobReach());
        if (dist(knob, sp) < tol + 4) return 'linear-rotate';
        // Distance across the band, and the matching point on each line, for a screen distance.
        const nx = -dy;
        const ny = dx;
        const along = (local.x - c0.x) * dx + (local.y - c0.y) * dy;
        const across = (local.x - c0.x) * nx + (local.y - c0.y) * ny;
        const side = across >= 0 ? 1 : -1;
        const onLine = (offset: number) =>
          dist(toScreen(c0.x + dx * along + nx * offset * side, c0.y + dy * along + ny * offset * side), sp);
        const band = onLine(p.bandWidth * ref);
        const feather = onLine((p.bandWidth + p.linearFeather) * ref);
        if (Math.min(band, feather) < tol) return band <= feather ? 'linear-band' : 'linear-feather';
        return null;
      }
      return null;
    };

    const cursorFor = (part: Part | null): string => {
      switch (part) {
        case 'radial-center':
        case 'linear-center': return 'move';
        case 'linear-rotate': return 'grab';
        case 'radial-inner':
        case 'radial-outer':
        case 'linear-band':
        case 'linear-feather': return 'ew-resize';
        default: return 'crosshair';
      }
    };
    const setCursor = (cursor: string) => {
      canvas.defaultCursor = cursor;
      canvas.setCursor(cursor);
    };

    /** Another image under the pointer, topmost first - clicking it makes it the target. */
    const imageUnder = (e: any): fabric.Image | null => {
      const scene = canvas.getScenePoint(e.e);
      const objects = canvas.getObjects();
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (isBlurTarget(o) && o.evented !== false && o.containsPoint(scene)) return o;
      }
      return null;
    };

    const dragTo = (part: Part, e: any) => {
      const sp = screenPoint(e);
      const local = toLocal(sp);
      const p = paramsRef.current;
      setPreviewPaused(false);
      if (part === 'radial-center') {
        setRadialCenter(localToNorm(local.x, local.y));
      } else if (part === 'linear-center') {
        setLinearCenter(localToNorm(local.x, local.y));
      } else if (part === 'radial-inner' || part === 'radial-outer') {
        const c0 = normToLocal(p.radialCenter);
        const r = Math.hypot(local.x - c0.x, local.y - c0.y) / ref;
        if (part === 'radial-inner') setFocusSizeRaw(clamp(r, 0.02, 0.9));
        else setRadialFeatherRaw(clamp(r - p.focusSize, 0.01, 0.8));
      } else if (part === 'linear-band' || part === 'linear-feather') {
        const c0 = normToLocal(p.linearCenter);
        const across = Math.abs((local.x - c0.x) * -Math.sin(p.bandAngle) + (local.y - c0.y) * Math.cos(p.bandAngle)) / ref;
        if (part === 'linear-band') setBandWidthRaw(clamp(across, 0.005, 0.6));
        else setLinearFeatherRaw(clamp(across - p.bandWidth, 0.01, 0.6));
      } else if (part === 'linear-rotate') {
        const c0 = normToLocal(p.linearCenter);
        let angle = Math.atan2(local.y - c0.y, local.x - c0.x);
        // Shift snaps to 15°, for dead-level or square bands.
        if (e?.e?.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        setBandAngleRaw(angle);
      }
    };

    const onMouseDown = (e: any) => {
      if (!directional) return;
      const sp = screenPoint(e);
      const part = hitTest(sp, hitRadius(e));
      if (part) {
        dragRef.current = part;
        setCursor(part === 'linear-rotate' ? 'grabbing' : cursorFor(part));
        canvas.requestRenderAll();
        return;
      }
      const scene = canvas.getScenePoint(e.e);
      if (target.containsPoint(scene)) {
        // Anywhere else on the image: the sharp area jumps there, and follows the drag.
        const moved: Part = activeBlurType === 'radial' ? 'radial-center' : 'linear-center';
        dragRef.current = moved;
        dragTo(moved, e);
        setCursor('move');
        return;
      }
      const other = imageUnder(e);
      if (other && other !== target) {
        canvas.setActiveObject(other);
        setTarget(other);
      }
    };

    const onMouseMove = (e: any) => {
      if (!directional) return;
      if (dragRef.current) {
        dragTo(dragRef.current, e);
        return;
      }
      const part = hitTest(screenPoint(e), hitRadius(e));
      if (part !== hoverRef.current) {
        hoverRef.current = part;
        canvas.requestRenderAll();
      }
      setCursor(cursorFor(part));
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setCursor(cursorFor(hoverRef.current));
      canvas.requestRenderAll();
    };

    /* ── The handles, drawn after the canvas, in screen pixels ───────── */
    const onAfterRender = () => {
      if (!directional || !canvas.getObjects().includes(target)) return;
      const p = paramsRef.current;
      const ctx = canvas.getContext();
      const m = matrix();
      const active = dragRef.current ?? hoverRef.current;
      const ACCENT = '#3b82f6';
      const stroke = (part: Part, dashed: boolean) => {
        const on = active === part;
        const width = on ? 2.5 : 1.5;
        ctx.setLineDash(dashed ? [6, 5] : []);
        ctx.shadowBlur = 0;
        // A dark outline under the line keeps it visible on light and busy images alike.
        ctx.lineWidth = width + 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.stroke();
        ctx.lineWidth = width;
        ctx.strokeStyle = on ? ACCENT : dashed ? 'rgba(255,255,255,0.85)' : '#ffffff';
        ctx.stroke();
      };
      /** Builds a path in the image's own space, so circles follow its scale and rotation. */
      const localPath = (draw: () => void) => {
        ctx.save();
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.beginPath();
        draw();
        ctx.restore();
      };
      const pin = (x: number, y: number, on: boolean) => {
        ctx.setLineDash([]);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x, y, on ? 9 : 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = ACCENT;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
      };
      const knob = (x: number, y: number, on: boolean) => {
        ctx.setLineDash([]);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x, y, on ? 7 : 6, 0, Math.PI * 2);
        ctx.fillStyle = on ? ACCENT : '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = on ? '#ffffff' : ACCENT;
        ctx.stroke();
      };

      ctx.save();
      if (p.type === 'radial') {
        const c0 = normToLocal(p.radialCenter);
        const inner = p.focusSize * ref;
        const outer = (p.focusSize + p.radialFeather) * ref;
        localPath(() => ctx.arc(c0.x, c0.y, Math.max(1, outer), 0, Math.PI * 2));
        stroke('radial-outer', true);
        localPath(() => ctx.arc(c0.x, c0.y, Math.max(1, inner), 0, Math.PI * 2));
        stroke('radial-inner', false);
        // Grab points on each ring, so they are easy to find.
        const onInner = toScreen(c0.x + inner, c0.y);
        const onOuter = toScreen(c0.x + outer * Math.SQRT1_2, c0.y + outer * Math.SQRT1_2);
        knob(onInner.x, onInner.y, active === 'radial-inner');
        knob(onOuter.x, onOuter.y, active === 'radial-outer');
        const cs = toScreen(c0.x, c0.y);
        pin(cs.x, cs.y, active === 'radial-center');
      } else if (p.type === 'linear') {
        const c0 = normToLocal(p.linearCenter);
        const dx = Math.cos(p.bandAngle);
        const dy = Math.sin(p.bandAngle);
        const nx = -dy;
        const ny = dx;
        const len = Math.hypot(w, h) * 1.5;
        const line = (offset: number) => localPath(() => {
          ctx.moveTo(c0.x + nx * offset - dx * len, c0.y + ny * offset - dy * len);
          ctx.lineTo(c0.x + nx * offset + dx * len, c0.y + ny * offset + dy * len);
        });
        const band = p.bandWidth * ref;
        const spread = (p.bandWidth + p.linearFeather) * ref;
        // Clipped to the image, so the lines do not run across the rest of the artboard.
        ctx.save();
        localPath(() => ctx.rect(-w / 2, -h / 2, w, h));
        ctx.clip();
        for (const s of [-1, 1]) { line(spread * s); stroke('linear-feather', true); }
        for (const s of [-1, 1]) { line(band * s); stroke('linear-band', false); }
        ctx.restore();
        // The rotate knob, on a stalk along the band.
        const cs = toScreen(c0.x, c0.y);
        const ks = toScreen(c0.x + dx * knobReach(), c0.y + dy * knobReach());
        ctx.beginPath();
        ctx.moveTo(cs.x, cs.y);
        ctx.lineTo(ks.x, ks.y);
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = active === 'linear-rotate' ? ACCENT : 'rgba(255,255,255,0.9)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.stroke();
        knob(ks.x, ks.y, active === 'linear-rotate');
        pin(cs.x, cs.y, active === 'linear-center');
      }
      ctx.restore();
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('after:render', onAfterRender);
    if (directional) setCursor('crosshair');

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('after:render', onAfterRender);
      dragRef.current = null;
      hoverRef.current = null;
      if (hadOwnClear) c._shouldClearSelection = prevClear;
      else delete c._shouldClearSelection;
      canvas.skipTargetFind = prev.skipTargetFind;
      canvas.selection = prev.selection;
      canvas.defaultCursor = prev.defaultCursor;
      canvas.setCursor(prev.defaultCursor || 'default');
      target.hasControls = prev.hasControls;
      canvas.requestRenderAll();
    };
  }, [canvas, isOpen, target, activeBlurType]);

  // Handles redraw as the settings change.
  useEffect(() => {
    if (canvas && isOpen && activeBlurType !== 'gaussian') canvas.requestRenderAll();
  }, [canvas, isOpen, activeBlurType, radialCenter, focusSize, radialFeather, linearCenter, bandAngle, bandWidth, linearFeather]);

  /* ======================================================================
   *  Rendering the blur
   * ==================================================================== */

  /** The selection, as a mask in the image's pixel grid (drawn at `scale`), or null. */
  const selectionMaskFor = useCallback((obj: fabric.Image, width: number, height: number, scale: number) => {
    if (!activeSelection) return null;
    const local = sceneShapeToImagePixels(activeSelection, obj);
    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const ctx = mask.getContext('2d')!;
    ctx.scale(scale, scale);
    // The shape is in the visible image's pixels; the element may be larger when it is cropped.
    ctx.translate((obj as any).cropX || 0, (obj as any).cropY || 0);
    ctx.beginPath();
    traceShape(ctx, local);
    ctx.fillStyle = '#fff';
    ctx.fill();
    return mask;
  }, [activeSelection]);

  /** Geometry in the pixel space of a canvas holding the element at `scale`. */
  const geometryFor = useCallback((obj: fabric.Image, scale: number, p: Params): BlurGeometry => {
    const w = obj.width || 1;
    const h = obj.height || 1;
    const cropX = (obj as any).cropX || 0;
    const cropY = (obj as any).cropY || 0;
    return {
      type: p.type,
      refSize: Math.max(w, h) * scale,
      centerX: (cropX + p.radialCenter.x * w) * scale,
      centerY: (cropY + p.radialCenter.y * h) * scale,
      focusSize: p.focusSize,
      feather: p.radialFeather,
      bandCenterX: (cropX + p.linearCenter.x * w) * scale,
      bandCenterY: (cropY + p.linearCenter.y * h) * scale,
      bandAngle: p.bandAngle,
      bandWidth: p.bandWidth,
      bandFeather: p.linearFeather,
    };
  }, []);

  /**
   * Blur radius in the element's pixels. The slider is in canvas pixels, so the same strength looks
   * the same whether the image was placed at full size or scaled down onto the artboard.
   */
  const radiusFor = (obj: fabric.Image, amount: number, elementScale: number) => {
    const shown = (Math.abs(obj.scaleX || 1) + Math.abs(obj.scaleY || 1)) / 2;
    return (amount / Math.max(0.0001, shown)) / Math.max(0.0001, elementScale);
  };

  /* ======================================================================
   *  EFFECT 3 — live preview
   * ==================================================================== */
  useEffect(() => {
    if (!canvas || !isOpen || !target || comparing || previewPaused) {
      restorePreview();
      return;
    }
    let frame = 0;
    frame = requestAnimationFrame(() => {
      const pristine = pristineFor(target);
      if (!pristine.source) return;
      const { width: ew, height: eh } = elementSize(pristine.source);
      if (!ew || !eh) return;
      const scale = Math.min(1, PREVIEW_MAX / Math.max(ew, eh));
      // Pixels per object unit in the working copy: the element's own scaling, then the reduction.
      const unit = pristine.scaleX * scale;
      const radius = radiusFor(target, blurAmount, 1) * unit;

      let cache = blurCacheRef.current;
      if (!cache || cache.source !== pristine.source || cache.scale !== scale || Math.abs(cache.radius - radius) > 0.01) {
        const original = document.createElement('canvas');
        original.width = Math.max(1, Math.round(ew * scale));
        original.height = Math.max(1, Math.round(eh * scale));
        const octx = original.getContext('2d')!;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(pristine.source, 0, 0, original.width, original.height);
        const reuseOriginal = cache && cache.source === pristine.source && cache.scale === scale ? cache.original : original;
        cache = { source: pristine.source, scale, radius, original: reuseOriginal, blurred: blurCanvas(reuseOriginal, radius) };
        blurCacheRef.current = cache;
      }

      const geom = geometryFor(target, unit, paramsRef.current);
      const mask = buildBlurMask(cache.original.width, cache.original.height, geom, selectionMaskFor(target, cache.original.width, cache.original.height, unit));
      const result = composeBlur(cache.original, cache.blurred, mask);
      showPreview(target, result, scale);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    canvas, isOpen, target, comparing, previewPaused,
    activeBlurType, blurAmount, radialCenter, focusSize, radialFeather,
    linearCenter, bandAngle, bandWidth, linearFeather,
    selectionMaskFor, geometryFor, pristineFor, showPreview, restorePreview,
  ]);

  // Leaving the studio, or unmounting, gives the image its own pixels back.
  useEffect(() => () => restorePreview(), [restorePreview]);

  /* ======================================================================
   *  Apply — bake the blur into the image at full resolution, undoably
   * ==================================================================== */
  const applyBlur = useCallback(async () => {
    const obj = targetRef.current;
    if (!canvas || !obj || isApplying) return;
    setIsApplying(true);
    // Let the button show it is working before the heavy lifting.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      restorePreview();
      const img = obj as any;
      // Pristine pixels, before any fabric filter: filters are applied again on top afterwards.
      // Those are at the image's own resolution; only the filtered copy can be resized.
      const usingOriginal = !!img._originalElement;
      const source = (usingOriginal ? img._originalElement : img._element) as HTMLImageElement | HTMLCanvasElement;
      const { width: ew, height: eh } = elementSize(source);
      if (!ew || !eh) return;

      const original = document.createElement('canvas');
      original.width = ew;
      original.height = eh;
      original.getContext('2d')!.drawImage(source, 0, 0);

      const unit = usingOriginal ? 1 : (img._filterScalingX ?? 1);
      const p = paramsRef.current;
      const blurred = blurCanvas(original, radiusFor(obj, p.blurAmount, 1) * unit);
      const mask = buildBlurMask(ew, eh, geometryFor(obj, unit, p), selectionMaskFor(obj, ew, eh, unit));
      const result = composeBlur(original, blurred, mask);

      blurCacheRef.current = null;
      executeCommand(new BlurStudioCommand(obj, source, result));
      setPreviewPaused(true);
      canvas.requestRenderAll();
    } finally {
      setIsApplying(false);
    }
  }, [canvas, isApplying, restorePreview, geometryFor, selectionMaskFor, executeCommand]);

  /** Back to the defaults, with the sharp area centred. */
  const resetBlur = useCallback(() => {
    setPreviewPaused(false);
    setBlurAmountRaw(BLUR_DEFAULTS.blurAmount);
    setFocusSizeRaw(BLUR_DEFAULTS.focusSize);
    setRadialFeatherRaw(BLUR_DEFAULTS.radialFeather);
    setBandWidthRaw(BLUR_DEFAULTS.bandWidth);
    setBandAngleRaw(BLUR_DEFAULTS.bandAngle);
    setLinearFeatherRaw(BLUR_DEFAULTS.linearFeather);
    setRadialCenter(BLUR_DEFAULTS.center);
    setLinearCenter(BLUR_DEFAULTS.center);
  }, []);

  return {
    activeBlurType,
    setActiveBlurType,
    blurAmount,
    setBlurAmount,
    // Radial
    focusSize,
    setFocusSize,
    radialFeather,
    setRadialFeather,
    // Linear
    bandWidth,
    setBandWidth,
    bandAngle,
    setBandAngle,
    linearFeather,
    setLinearFeather,
    // Target and selection
    hasTarget: !!target,
    targetName: target ? ((target as any).name || (target as any).layerName || 'Image') as string : null,
    hasSelection: !!selectionShape,
    limitToSelection,
    setLimitToSelection: (v: boolean) => { setPreviewPaused(false); setLimitToSelection(v); },
    setSelectionShape,
    // Preview and actions
    comparing,
    setComparing,
    previewPaused,
    isApplying,
    applyBlur,
    resetBlur,
  };
}

export type BlurStudioApi = ReturnType<typeof useBlurStudio>;
