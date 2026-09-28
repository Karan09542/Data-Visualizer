import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Crosshair, Maximize, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import {
  containerToImage,
  contentFit,
  displayRatio,
  imageToContainer,
  panForZoomAt,
  type ImageLayout,
} from "./imageViewMath";

interface InteractiveZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  rotation?: number;
  /** Adds the point tool: hover or tap to read pixel coordinates, click to pin. */
  enableCoordinates?: boolean;
  /** Replaces the default container background and corners. */
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  /** Reports the picture's real size once it loads. */
  onNaturalSize?: (width: number, height: number) => void;
}

/** Zoom limits, relative to the picture fitted into the view. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 32;
const STEP = 1.25;
/** Movement that turns a click or tap into a drag. */
const DRAG_SLOP = 4;
/** Always keep this much of the picture on screen while panning. */
const KEEP_VISIBLE = 48;

type CoordMode = "image" | "view";
type Pin = { id: number; x: number; y: number };

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function InteractiveZoomImage({
  src,
  alt,
  className = "",
  rotation = 0,
  enableCoordinates = false,
  containerClassName = "bg-slate-100 dark:bg-transparent rounded-2xl",
  containerStyle,
  onNaturalSize,
}: InteractiveZoomImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [layout, setLayout] = useState<ImageLayout | null>(null);

  const [coordsOn, setCoordsOn] = useState(false);
  const [coordMode, setCoordMode] = useState<CoordMode>("image");
  const [hover, setHover] = useState<{ cx: number; cy: number; x: number; y: number } | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
    moved: boolean;
    pinchDist: number;
    pinchScale: number;
    pinchPos: { x: number; y: number };
    pinchMid: { x: number; y: number };
  } | null>(null);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  const nextPinId = useRef(1);

  // Latest values for native listeners.
  const live = useRef({ scale, position, layout });
  live.current = { scale, position, layout };

  const transform = { x: position.x, y: position.y, scale, rotation };

  // Reset when the picture changes.
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setPins([]);
    setHover(null);
  }, [src]);

  // ─── Layout ──────────────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    setLayout({
      boxLeft: img.offsetLeft,
      boxTop: img.offsetTop,
      boxWidth: img.offsetWidth,
      boxHeight: img.offsetHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  /** Client coordinates → container layout pixels (correct under CSS-scaled ancestors). */
  const toContainer = (clientX: number, clientY: number) => {
    const el = containerRef.current!;
    const rect = el.getBoundingClientRect();
    const k = el.offsetWidth ? rect.width / el.offsetWidth : 1;
    return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k };
  };

  const containerCenter = () => {
    const el = containerRef.current;
    return el ? { x: el.offsetWidth / 2, y: el.offsetHeight / 2 } : { x: 0, y: 0 };
  };

  /** Keeps at least a strip of the picture on screen. */
  const boundPosition = (x: number, y: number, s = live.current.scale) => {
    const el = containerRef.current;
    const l = live.current.layout;
    if (!el || !l) return { x, y };
    const { fit } = contentFit(l);
    const halfW = (l.naturalWidth * fit * s) / 2;
    const halfH = (l.naturalHeight * fit * s) / 2;
    const limitX = Math.max(0, el.offsetWidth / 2 + halfW - KEEP_VISIBLE);
    const limitY = Math.max(0, el.offsetHeight / 2 + halfH - KEEP_VISIBLE);
    return { x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y)) };
  };

  /** Zooms so the container point (px, py) stays over the same pixel. */
  const zoomTo = (nextScale: number, px?: number, py?: number) => {
    const { scale: s, position: pos, layout: l } = live.current;
    const target = clampScale(nextScale);
    if (!l) {
      setScale(target);
      return;
    }
    const at = px === undefined || py === undefined ? containerCenter() : { x: px, y: py };
    const pan = panForZoomAt(at.x, at.y, l, { ...pos, scale: s, rotation }, target);
    setScale(target);
    setPosition(boundPosition(pan.x, pan.y, target));
  };

  const fitView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  /** Shows the picture at its real size (one screen pixel per picture pixel). */
  const actualSize = () => {
    if (!layout) return;
    zoomTo(1 / contentFit(layout).fit);
  };

  // Ctrl + wheel and trackpad pinch (which reports ctrlKey), toward the pointer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) >= 50) return; // plain mouse wheel scrolls the page
      e.preventDefault();
      const p = toContainer(e.clientX, e.clientY);
      // Smooth, proportional to how far the wheel or pinch moved.
      const factor = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.01);
      zoomTo(live.current.scale * factor, p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation]);

  // ─── Pointer: pan, pinch, tap ────────────────────────────────────────────────

  const pixelAt = (px: number, py: number) => {
    if (!layout) return null;
    const p = containerToImage(px, py, layout, transform);
    const inside = p.x >= 0 && p.y >= 0 && p.x < layout.naturalWidth && p.y < layout.naturalHeight;
    return inside ? p : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-zoom-ui]")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toContainer(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        startX: p.x,
        startY: p.y,
        startPos: position,
        moved: true,
        pinchDist: Math.hypot(a.x - b.x, a.y - b.y),
        pinchScale: scale,
        pinchPos: position,
        pinchMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      setIsGesturing(true);
      return;
    }
    gesture.current = {
      startX: p.x,
      startY: p.y,
      startPos: position,
      moved: false,
      pinchDist: 0,
      pinchScale: scale,
      pinchPos: position,
      pinchMid: p,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = toContainer(e.clientX, e.clientY);

    // Hover readout (mouse and pen) while the point tool is on.
    if (coordsOn && e.pointerType !== "touch") {
      const px = pixelAt(p.x, p.y);
      setHover(px ? { cx: p.x, cy: p.y, x: px.x, y: px.y } : null);
    }

    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;

    if (pointers.current.size >= 2 && g.pinchDist > 0) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = clampScale(g.pinchScale * (dist / g.pinchDist));
      if (layout) {
        const pan = panForZoomAt(g.pinchMid.x, g.pinchMid.y, layout, { ...g.pinchPos, scale: g.pinchScale, rotation }, next);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        setPosition(boundPosition(pan.x + mid.x - g.pinchMid.x, pan.y + mid.y - g.pinchMid.y, next));
      }
      setScale(next);
      return;
    }

    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!g.moved) {
      g.moved = true;
      setIsGesturing(true);
    }
    setPosition(boundPosition(g.startPos.x + dx, g.startPos.y + dy));
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const had = pointers.current.delete(e.pointerId);
    if (!had) return;
    const g = gesture.current;
    if (pointers.current.size > 0) return; // still pinching or panning with another finger
    gesture.current = null;
    setIsGesturing(false);
    if (!g || g.moved || e.type === "pointercancel") return;

    // A click or tap.
    const p = toContainer(e.clientX, e.clientY);
    if (coordsOn) {
      const px = pixelAt(p.x, p.y);
      if (px) {
        const pin = { id: nextPinId.current++, x: px.x, y: px.y };
        setPins((prev) => [...prev.slice(-19), pin]);
        if (e.pointerType === "touch") setHover({ cx: p.x, cy: p.y, x: px.x, y: px.y });
      }
      return;
    }
    // Double tap / double click: fit ↔ zoomed in at that point.
    const now = Date.now();
    const last = lastTap.current;
    if (now - last.time < 300 && Math.hypot(p.x - last.x, p.y - last.y) < 24) {
      if (scale > 1.01 || scale < 0.99) fitView();
      else zoomTo(2.5, p.x, p.y);
      lastTap.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTap.current = { time: now, x: p.x, y: p.y };
    }
  };

  // ─── Keyboard ────────────────────────────────────────────────────────────────

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "+" || e.key === "=") zoomTo(scale * STEP);
    else if (e.key === "-" || e.key === "_") zoomTo(scale / STEP);
    else if (e.key === "0") fitView();
    else if (e.key === "1") actualSize();
    else if (e.key.toLowerCase() === "c" && enableCoordinates) setCoordsOn((v) => !v);
    else if (e.key === "Escape" && coordsOn) setCoordsOn(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // ─── Readouts ────────────────────────────────────────────────────────────────

  const ratio = layout ? displayRatio(layout, transform) : scale;
  const percent = Math.round(ratio * 100);

  /** A picture pixel in the chosen unit: the image's own pixels, or on-screen pixels at this zoom. */
  const fmt = (x: number, y: number) =>
    coordMode === "image"
      ? { x: Math.floor(x), y: Math.floor(y) }
      : { x: Math.round(x * ratio), y: Math.round(y * ratio) };

  const extent = layout
    ? coordMode === "image"
      ? `${layout.naturalWidth} × ${layout.naturalHeight}`
      : `${Math.round(layout.naturalWidth * ratio)} × ${Math.round(layout.naturalHeight * ratio)}`
    : "";

  const copyPin = async (pin: Pin) => {
    const v = fmt(pin.x, pin.y);
    try {
      await navigator.clipboard.writeText(`${v.x}, ${v.y}`);
      setCopiedId(pin.id);
      setTimeout(() => setCopiedId((id) => (id === pin.id ? null : id)), 1200);
    } catch {
      /* clipboard blocked: the value is still on screen */
    }
  };

  const barButton =
    "h-7 min-w-7 px-1.5 inline-flex items-center justify-center gap-1 rounded-full text-[11px] font-medium text-slate-200 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative w-full h-full overflow-hidden select-none flex items-center justify-center outline-none touch-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${containerClassName} ${
        coordsOn ? "cursor-crosshair" : isGesturing ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={containerStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") setHover(null);
      }}
      onKeyDown={onKeyDown}
      aria-label={`${alt}. Zoom ${percent}%.`}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        draggable={false}
        onLoad={(e) => {
          measure();
          onNaturalSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
        }}
        className={`max-w-full max-h-full object-contain shadow-md select-none pointer-events-none ${className}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: "center center",
          transition: isGesturing ? "none" : "transform 90ms ease-out",
          // Crisp pixels when zoomed well past real size, for reading coordinates.
          imageRendering: ratio >= 4 ? "pixelated" : undefined,
        }}
      />

      {/* Pinned points */}
      {coordsOn &&
        layout &&
        pins.map((pin) => {
          const c = imageToContainer(pin.x, pin.y, layout, transform);
          const v = fmt(pin.x, pin.y);
          return (
            <div key={pin.id} className="absolute z-10 pointer-events-none" style={{ left: c.x, top: c.y }}>
              <span className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full border-2 border-white bg-rose-500 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
              <button
                type="button"
                data-zoom-ui
                onClick={() => copyPin(pin)}
                title="Copy coordinates"
                className="pointer-events-auto absolute left-2.5 top-1.5 whitespace-nowrap inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-900/85 text-white text-[10px] font-mono tabular-nums shadow hover:bg-slate-900"
              >
                {copiedId === pin.id ? <Check size={10} className="text-emerald-400" /> : null}
                {v.x}, {v.y}
              </button>
            </div>
          );
        })}

      {/* Live readout next to the pointer */}
      {coordsOn && hover && (() => {
        const v = fmt(hover.x, hover.y);
        const el = containerRef.current;
        const flipX = el ? hover.cx > el.offsetWidth - 150 : false;
        const flipY = el ? hover.cy > el.offsetHeight - 60 : false;
        return (
          <div
            className="absolute z-20 pointer-events-none px-2 py-1 rounded-md bg-slate-900/90 text-white shadow-lg font-mono text-[11px] tabular-nums leading-tight"
            style={{
              left: hover.cx + (flipX ? -12 : 14),
              top: hover.cy + (flipY ? -12 : 14),
              transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
            }}
          >
            <div>
              x {v.x} · y {v.y}
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              {coordMode === "image" ? "image px" : `px at ${percent}%`}
            </div>
          </div>
        );
      })()}

      {/* Point tool options */}
      {coordsOn && (
        <div
          data-zoom-ui
          className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-2 max-w-[calc(100%-1.5rem)]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center p-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-[11px]">
            {(
              [
                ["image", "Image px"],
                ["view", "Zoomed px"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCoordMode(mode)}
                aria-pressed={coordMode === mode}
                title={
                  mode === "image"
                    ? "Coordinates in the image's own pixels"
                    : "Coordinates in on-screen pixels at the current zoom"
                }
                className={`h-6 px-2.5 rounded-full font-medium transition-colors ${
                  coordMode === mode ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="h-7 px-2.5 inline-flex items-center rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 font-mono tabular-nums">
            {extent}
          </span>
          {pins.length > 0 ? (
            <button
              type="button"
              onClick={() => setPins([])}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-[11px] text-slate-200 hover:text-white"
            >
              <Trash2 size={11} />
              Clear {pins.length}
            </button>
          ) : (
            <span className="h-7 px-2.5 inline-flex items-center rounded-full bg-black/50 backdrop-blur-md text-[11px] text-slate-300">
              Click the image to pin a point
            </span>
          )}
        </div>
      )}

      {/* Zoom and tools */}
      <div
        data-zoom-ui
        className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={() => zoomTo(scale / STEP)} disabled={scale <= MIN_SCALE + 1e-6} className={barButton} title="Zoom out (−)">
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={actualSize}
          className={`${barButton} w-12 font-mono tabular-nums`}
          title="Zoom level (100% = real size). Click for real size (1)"
        >
          {percent}%
        </button>
        <button type="button" onClick={() => zoomTo(scale * STEP)} disabled={scale >= MAX_SCALE - 1e-6} className={barButton} title="Zoom in (+)">
          <ZoomIn size={15} />
        </button>
        <span className="w-px h-4 bg-white/20 mx-0.5" />
        <button type="button" onClick={fitView} className={barButton} title="Fit to view (0)">
          <Maximize size={13} />
        </button>
        {enableCoordinates && (
          <button
            type="button"
            onClick={() => {
              setCoordsOn((v) => !v);
              setHover(null);
            }}
            aria-pressed={coordsOn}
            className={`${barButton} ${coordsOn ? "bg-blue-500 text-white hover:bg-blue-500" : ""}`}
            title={coordsOn ? "Turn off the point tool (C)" : "Point tool: read pixel coordinates (C)"}
          >
            <Crosshair size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
