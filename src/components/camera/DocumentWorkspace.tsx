import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PerspectiveOverlay, Point } from './ui/PerspectiveOverlay';
import { ToolbarBottom } from './ui/ToolbarBottom';
import { FilterOptions, applyFilters } from '../../utils/image/ImageFilters';
import { WebGLPerspectiveEngine } from '../../utils/image/webgl-engine';
import { FULL, clampInto, cornersRect, fitContain, fitRatio, inscribedBounds, rectCorners, type NRect } from './cropGeometry';

interface DocumentWorkspaceProps {
  imageSrc: string; // Base64 or Blob URL of captured image
  onSave: (finalBlob: Blob) => void;
  onCancel: () => void;
}

/** Longest side of the picture used on screen while editing (the saved one is full size). */
const PREVIEW_MAX = 1400;

/** A picture turned by `deg` degrees, into `out` (made if not given), on a box that holds it all. */
function drawTurned(src: CanvasImageSource & { width: number; height: number }, deg: number, out?: HTMLCanvasElement) {
  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const canvas = out ?? document.createElement('canvas');
  canvas.width = Math.round(src.width * cos + src.height * sin);
  canvas.height = Math.round(src.width * sin + src.height * cos);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return canvas;
}

/** How big a perspective crop comes out: its longest top/bottom and left/right sides. */
function quadSize(c: Point[]) {
  const w = Math.max(Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y), Math.hypot(c[2].x - c[3].x, c[2].y - c[3].y));
  const h = Math.max(Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y), Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y));
  return { w, h };
}

/**
 * Crop (straight or perspective), straighten and adjust a captured photo. Everything on
 * screen works on a downscaled copy drawn into canvases (nothing is encoded while you
 * edit); the full-size photo is processed once, on save.
 */
export function DocumentWorkspace({ imageSrc, onSave, onCancel }: DocumentWorkspaceProps) {
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');
  const [corners, setCorners] = useState<Point[]>(rectCorners(FULL));
  const [cropMode, setCropMode] = useState<'perspective' | 'rectangle'>('rectangle');
  const [filters, setFilters] = useState<FilterOptions>({ type: 'none', brightness: 0, contrast: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Turned in quarter turns (the button) plus a fine angle (the slider, -45° to 45°).
  const [quarter, setQuarter] = useState(0);
  const [fine, setFine] = useState(0);
  const rotation = quarter * 90 + fine;
  const [aspect, setAspect] = useState<number | undefined>(undefined);

  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  /** The downscaled photo, and the same turned: what the crop frame is drawn over. */
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const workingRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [workingVersion, setWorkingVersion] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const webglEngineRef = useRef<WebGLPerspectiveEngine | null>(null);
  const pipRef = useRef<HTMLCanvasElement>(null);
  const adjustRef = useRef<HTMLCanvasElement>(null);

  // Load the photo, and make the downscaled copy used while editing.
  useEffect(() => {
    webglEngineRef.current = new WebGLPerspectiveEngine();
    const img = new Image();
    img.onload = () => {
      setBaseImage(img);
      const scale = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      previewRef.current = c;
      drawTurned(c, 0, workingRef.current);
      setCorners(rectCorners(FULL));
      setWorkingVersion((v) => v + 1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Where the frame may go: inside the turned photo, clear of the empty corners.
  const bounds: NRect = useMemo(() => {
    const p = previewRef.current;
    if (!p || !fine) return FULL;
    // The fine angle is applied after the quarter turns: measure on the quarter-turned photo.
    const [w, h] = quarter % 2 ? [p.height, p.width] : [p.width, p.height];
    return inscribedBounds(w, h, (fine * Math.PI) / 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fine, quarter, workingVersion]);

  // Turning: redraw the working picture (at most once a frame while the slider moves).
  const turnFrame = useRef(0);
  /** A quarter turn swapped the sides: fit the frame again once the picture is redrawn. */
  const refitAfterTurn = useRef(false);
  const aspectRef = useRef<number | undefined>(undefined);
  aspectRef.current = aspect;
  useEffect(() => {
    const p = previewRef.current;
    if (!p) return;
    cancelAnimationFrame(turnFrame.current);
    turnFrame.current = requestAnimationFrame(() => {
      drawTurned(p, rotation, workingRef.current);
      if (refitAfterTurn.current) {
        refitAfterTurn.current = false;
        const a = aspectRef.current;
        const w = workingRef.current;
        setCorners(rectCorners(a ? fitRatio((a * w.height) / w.width, FULL) : FULL));
      }
      setWorkingVersion((v) => v + 1);
    });
    return () => cancelAnimationFrame(turnFrame.current);
  }, [rotation]);

  // A shape's ratio in the working picture's normalised units.
  const normRatio = useCallback(
    (a: number) => (a * workingRef.current.height) / workingRef.current.width,
    [],
  );

  // Keep the frame where it may be when the angle changes.
  useEffect(() => {
    setCorners((c) => {
      const box = cornersRect(c);
      const inside = box.x0 >= bounds.x0 - 1e-9 && box.y0 >= bounds.y0 - 1e-9 && box.x1 <= bounds.x1 + 1e-9 && box.y1 <= bounds.y1 + 1e-9;
      if (inside) return c;
      if (cropMode === 'rectangle' && aspect) return rectCorners(fitRatio(normRatio(aspect), bounds, box));
      if (cropMode === 'rectangle') return rectCorners(clampInto(box, bounds));
      return c.map((p) => ({
        x: Math.min(bounds.x1, Math.max(bounds.x0, p.x)),
        y: Math.min(bounds.y1, Math.max(bounds.y0, p.y)),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  const handleSetAspect = (newAspect?: number) => {
    setAspect(newAspect);
    if (cropMode !== 'rectangle') setCropMode('rectangle');
    if (!newAspect) return;
    setCorners((c) => rectCorners(fitRatio(normRatio(newAspect), bounds, cornersRect(c))));
  };

  const turnQuarter = () => {
    // A quarter turn swaps the sides: the frame starts over, in the same shape.
    refitAfterTurn.current = true;
    setQuarter((q) => (q + 1) % 4);
  };

  // Track the space the photo has.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ w: r.width, h: r.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [tab]);

  // Live preview of a perspective crop, and the adjust preview: drawn into canvases,
  // at most once a frame.
  const previewFrame = useRef(0);
  useEffect(() => {
    const engine = webglEngineRef.current;
    const src = workingRef.current;
    if (!engine || !src.width) return;
    cancelAnimationFrame(previewFrame.current);
    previewFrame.current = requestAnimationFrame(() => {
      const px = corners.map((c) => ({ x: c.x * src.width, y: c.y * src.height }));
      const { w, h } = quadSize(px);
      if (w < 1 || h < 1) return;
      if (tab === 'crop' && cropMode === 'perspective') {
        const out = pipRef.current;
        if (!out) return;
        const k = Math.min(1, 220 / Math.max(w, h));
        const warped = engine.warp(src, px, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
        out.width = warped.width;
        out.height = warped.height;
        out.getContext('2d')!.drawImage(warped, 0, 0);
      } else if (tab === 'adjust') {
        const out = adjustRef.current;
        if (!out) return;
        const k = Math.min(1, 1000 / Math.max(w, h));
        const ow = Math.max(1, Math.round(w * k));
        const oh = Math.max(1, Math.round(h * k));
        let cut: HTMLCanvasElement;
        if (cropMode === 'rectangle') {
          const r = cornersRect(corners);
          cut = document.createElement('canvas');
          cut.width = ow;
          cut.height = oh;
          cut.getContext('2d')!.drawImage(src, r.x0 * src.width, r.y0 * src.height, (r.x1 - r.x0) * src.width, (r.y1 - r.y0) * src.height, 0, 0, ow, oh);
        } else {
          cut = engine.warp(src, px, ow, oh);
        }
        const filtered = applyFilters(cut, filters);
        out.width = filtered.width;
        out.height = filtered.height;
        out.getContext('2d')!.drawImage(filtered, 0, 0);
      }
    });
    return () => cancelAnimationFrame(previewFrame.current);
  }, [tab, cropMode, filters, corners, workingVersion]);

  const handleSave = async () => {
    if (!baseImage || !webglEngineRef.current) return;
    setIsProcessing(true);
    try {
      // Full size, turned: drawn straight into a canvas (no re-encoding in between).
      const full = drawTurned(baseImage, rotation);
      let cut: HTMLCanvasElement;
      if (cropMode === 'rectangle') {
        // A straight crop is a plain copy of those pixels: exact, and no size limit.
        const r = cornersRect(corners);
        const sx = Math.round(r.x0 * full.width);
        const sy = Math.round(r.y0 * full.height);
        const sw = Math.max(1, Math.round((r.x1 - r.x0) * full.width));
        const sh = Math.max(1, Math.round((r.y1 - r.y0) * full.height));
        cut = document.createElement('canvas');
        cut.width = sw;
        cut.height = sh;
        cut.getContext('2d')!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
      } else {
        const px = corners.map((c) => ({ x: c.x * full.width, y: c.y * full.height }));
        const { w, h } = quadSize(px);
        cut = webglEngineRef.current.warp(full, px, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      }
      const out = filters.type === 'none' && !filters.brightness && !filters.contrast ? cut : applyFilters(cut, filters);
      out.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (blob) onSave(blob);
          else onCancel();
        },
        'image/jpeg',
        0.92,
      );
    } catch (e) {
      console.error('Save failed:', e);
      setIsProcessing(false);
      onCancel();
    }
  };

  const working = workingRef.current;
  const ready = !!previewRef.current && working.width > 0;
  // Where the adjust preview sits, to size its canvas like an image.
  const adjustFit = fitContain(adjustRef.current?.width || 1, adjustRef.current?.height || 1, containerSize.w, containerSize.h);

  return (
    <div className="absolute inset-0 flex flex-col bg-black overflow-hidden z-[9999]">
      <div className="flex-1 min-h-0 relative p-4 sm:p-6">
        <div className="relative w-full h-full" ref={containerRef}>
          {tab === 'crop' && ready && containerSize.w > 0 && (
            <PerspectiveOverlay
              source={working}
              sourceVersion={workingVersion}
              corners={corners}
              onChange={setCorners}
              containerWidth={containerSize.w}
              containerHeight={containerSize.h}
              cropMode={cropMode}
              aspect={cropMode === 'rectangle' ? aspect : undefined}
              bounds={bounds}
              outputWidth={baseImage ? Math.round(baseImage.width * Math.abs(Math.cos((rotation * Math.PI) / 180)) + baseImage.height * Math.abs(Math.sin((rotation * Math.PI) / 180))) : working.width}
              outputHeight={baseImage ? Math.round(baseImage.width * Math.abs(Math.sin((rotation * Math.PI) / 180)) + baseImage.height * Math.abs(Math.cos((rotation * Math.PI) / 180))) : working.height}
            />
          )}

          {/* Live preview of a perspective crop: the flattened result */}
          {tab === 'crop' && cropMode === 'perspective' && (
            <div className="absolute top-2 right-2 z-10 pointer-events-none rounded-xl overflow-hidden ring-1 ring-white/25 shadow-2xl bg-black/60 backdrop-blur flex flex-col items-center p-1.5 gap-1">
              <canvas ref={pipRef} className="block max-w-24 max-h-24 sm:max-w-32 sm:max-h-32 rounded-md" />
              <span className="text-[9px] uppercase tracking-widest font-semibold text-white/70">Result</span>
            </div>
          )}

          {tab === 'adjust' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <canvas
                ref={adjustRef}
                className="shadow-2xl rounded-sm"
                style={{ width: adjustFit.width || undefined, height: adjustFit.height || undefined, maxWidth: '100%', maxHeight: '100%' }}
              />
            </div>
          )}
        </div>
      </div>

      <ToolbarBottom
        currentTab={tab}
        setTab={setTab}
        filters={filters}
        setFilters={setFilters}
        onSave={handleSave}
        onCancel={onCancel}
        onResetCrop={() => {
          setQuarter(0);
          setFine(0);
          setAspect(undefined);
          setCorners(rectCorners(FULL));
        }}
        isProcessing={isProcessing}
        onSetAspect={handleSetAspect}
        aspect={aspect}
        originalAspect={
          previewRef.current
            ? quarter % 2
              ? previewRef.current.height / previewRef.current.width
              : previewRef.current.width / previewRef.current.height
            : undefined
        }
        onRotate90={turnQuarter}
        rotation={fine}
        onRotateCustom={setFine}
        cropMode={cropMode}
        onSetCropMode={(mode) => {
          if (mode === cropMode) return;
          setCropMode(mode);
          if (mode === 'rectangle') {
            // Snap to the box round the corners, in the chosen shape.
            const box = clampInto(cornersRect(corners), bounds);
            setCorners(rectCorners(aspect ? fitRatio(normRatio(aspect), bounds, box) : box));
          } else {
            setAspect(undefined);
          }
        }}
      />
    </div>
  );
}
