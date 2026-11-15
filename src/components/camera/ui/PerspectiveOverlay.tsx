import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FULL,
  cornersRect,
  fitContain,
  moveRect,
  rectCorners,
  resizeRect,
  type CropHandle,
  type NRect,
} from '../cropGeometry';

export interface Point {
  x: number;
  y: number;
}

interface PerspectiveOverlayProps {
  /** The picture being cropped (already turned): drawn as it is, with no encoding. */
  source: HTMLCanvasElement | HTMLImageElement;
  /** Changes whenever `source` is redrawn in place. */
  sourceVersion: number;
  /** TL, TR, BR, BL, normalised to the picture. */
  corners: Point[];
  onChange: (newCorners: Point[]) => void;
  containerWidth: number;
  containerHeight: number;
  cropMode?: 'perspective' | 'rectangle';
  /** Width / height the frame must keep (straight crops); none for any shape. */
  aspect?: number;
  /** Where the frame may go (normalised): inside a straightened photo's corners. */
  bounds?: NRect;
  /** The full-size picture's size, for the pixel readout while dragging. */
  outputWidth: number;
  outputHeight: number;
}

type Drag =
  | { kind: 'handle'; handle: CropHandle; start: NRect }
  | { kind: 'corner'; index: number }
  | { kind: 'move'; startX: number; startY: number; start: Point[] };

const HANDLES: { id: CropHandle; ux: number; uy: number; cursor: string }[] = [
  { id: 'nw', ux: 0, uy: 0, cursor: 'nwse-resize' },
  { id: 'n', ux: 0.5, uy: 0, cursor: 'ns-resize' },
  { id: 'ne', ux: 1, uy: 0, cursor: 'nesw-resize' },
  { id: 'e', ux: 1, uy: 0.5, cursor: 'ew-resize' },
  { id: 'se', ux: 1, uy: 1, cursor: 'nwse-resize' },
  { id: 's', ux: 0.5, uy: 1, cursor: 'ns-resize' },
  { id: 'sw', ux: 0, uy: 1, cursor: 'nesw-resize' },
  { id: 'w', ux: 0, uy: 0.5, cursor: 'ew-resize' },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * The crop frame over the photo. Straight crops get corner brackets and side handles and
 * keep their shape when one is chosen; perspective crops move each corner on its own.
 * Outside the frame is darkened; a thirds grid helps line things up.
 */
export function PerspectiveOverlay({
  source,
  sourceVersion,
  corners,
  onChange,
  containerWidth,
  containerHeight,
  cropMode = 'perspective',
  aspect,
  bounds = FULL,
  outputWidth,
  outputHeight,
}: PerspectiveOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  // Where the picture sits: worked out from its real size, so the frame always matches it.
  const pic = useMemo(
    () => fitContain(source.width, source.height, containerWidth, containerHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, sourceVersion, containerWidth, containerHeight],
  );

  // The picture, drawn from the canvas it already is (no image encoding).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !pic.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(pic.width * dpr));
    c.height = Math.max(1, Math.round(pic.height * dpr));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, c.width, c.height);
  }, [source, sourceVersion, pic.width, pic.height]);

  const toNorm = (clientX: number, clientY: number): Point => {
    const box = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - box.left - pic.x) / pic.width, y: (clientY - box.top - pic.y) / pic.height };
  };
  // The shape in normalised units: a W × H picture wanting A (width / height) needs A · H / W.
  const normRatio = aspect ? (aspect * source.height) / source.width : null;

  const begin = (d: Drag, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    drag.current = d;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !pic.width) return;
    const p = toNorm(e.clientX, e.clientY);
    if (d.kind === 'handle') {
      onChange(rectCorners(resizeRect(d.start, d.handle, p, normRatio, bounds)));
    } else if (d.kind === 'corner') {
      const next = corners.map((c) => ({ ...c }));
      next[d.index] = { x: clamp(p.x, bounds.x0, bounds.x1), y: clamp(p.y, bounds.y0, bounds.y1) };
      onChange(next);
    } else {
      const box = cornersRect(d.start);
      const moved = moveRect(box, p.x - d.startX, p.y - d.startY, bounds);
      const dx = moved.x0 - box.x0;
      const dy = moved.y0 - box.y0;
      onChange(d.start.map((c) => ({ x: c.x + dx, y: c.y + dy })));
    }
  };

  const end = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  if (!pic.width) return <div ref={containerRef} className="relative w-full h-full" />;

  const sp = (c: Point) => ({ x: pic.x + c.x * pic.width, y: pic.y + c.y * pic.height });
  const pts = corners.map(sp);
  const poly = pts.map((c) => `${c.x},${c.y}`).join(' ');
  const rect = cornersRect(corners);
  const straight = cropMode === 'rectangle';

  // Thirds: straight lines for a rectangle, lines between the sides for a perspective quad.
  const grid: [Point, Point][] = [];
  for (const t of [1 / 3, 2 / 3]) {
    grid.push([sp(lerp(corners[0], corners[1], t)), sp(lerp(corners[3], corners[2], t))]);
    grid.push([sp(lerp(corners[0], corners[3], t)), sp(lerp(corners[1], corners[2], t))]);
  }

  // The size it will come out at.
  const outW = straight
    ? (rect.x1 - rect.x0) * outputWidth
    : Math.max(Math.hypot((corners[1].x - corners[0].x) * outputWidth, (corners[1].y - corners[0].y) * outputHeight), Math.hypot((corners[2].x - corners[3].x) * outputWidth, (corners[2].y - corners[3].y) * outputHeight));
  const outH = straight
    ? (rect.y1 - rect.y0) * outputHeight
    : Math.max(Math.hypot((corners[3].x - corners[0].x) * outputWidth, (corners[3].y - corners[0].y) * outputHeight), Math.hypot((corners[2].x - corners[1].x) * outputWidth, (corners[2].y - corners[1].y) * outputHeight));
  const top = Math.min(...pts.map((p) => p.y));
  const midX = pts.reduce((s, p) => s + p.x, 0) / 4;

  // Straight crops: L-shaped brackets at the corners and short bars on the sides.
  const L = Math.max(14, Math.min(26, Math.min(pts[1].x - pts[0].x, pts[3].y - pts[0].y) / 3));
  const brackets = straight
    ? [
        `M${pts[0].x},${pts[0].y + L}V${pts[0].y}H${pts[0].x + L}`,
        `M${pts[1].x - L},${pts[1].y}H${pts[1].x}V${pts[1].y + L}`,
        `M${pts[2].x},${pts[2].y - L}V${pts[2].y}H${pts[2].x - L}`,
        `M${pts[3].x + L},${pts[3].y}H${pts[3].x}V${pts[3].y - L}`,
        `M${(pts[0].x + pts[1].x) / 2 - 11},${pts[0].y}h22`,
        `M${(pts[3].x + pts[2].x) / 2 - 11},${pts[3].y}h22`,
        `M${pts[0].x},${(pts[0].y + pts[3].y) / 2 - 11}v22`,
        `M${pts[1].x},${(pts[1].y + pts[2].y) / 2 - 11}v22`,
      ].join('')
    : '';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none touch-none"
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{ left: pic.x, top: pic.y, width: pic.width, height: pic.height }}
        aria-label="Photo to crop"
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        {/* Darken what is cut away */}
        <path
          d={`M0,0H${containerWidth}V${containerHeight}H0Z M${poly.split(' ').join(' L')}Z`}
          fill="rgba(0,0,0,0.62)"
          fillRule="evenodd"
        />
        {/* Grid */}
        {grid.map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="white"
            strokeOpacity={dragging ? 0.55 : 0.28}
            strokeWidth={1}
          />
        ))}
        {/* Frame (also what is dragged to move it) */}
        <polygon
          points={poly}
          fill="transparent"
          stroke="white"
          strokeOpacity={0.9}
          strokeWidth={1.5}
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onPointerDown={(e) => {
            const p = toNorm(e.clientX, e.clientY);
            begin({ kind: 'move', startX: p.x, startY: p.y, start: corners.map((c) => ({ ...c })) }, e);
          }}
        />
        {straight ? (
          <path d={brackets} fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          pts.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={9} fill="white" fillOpacity={0.2} stroke="white" strokeWidth={2.5} />
          ))
        )}
      </svg>

      {/* Handles: big enough for a finger, larger than what is drawn */}
      {straight
        ? HANDLES.map((h) => {
            const x = pic.x + (rect.x0 + (rect.x1 - rect.x0) * h.ux) * pic.width;
            const y = pic.y + (rect.y0 + (rect.y1 - rect.y0) * h.uy) * pic.height;
            return (
              <div
                key={h.id}
                role="slider"
                aria-label={`Crop edge ${h.id}`}
                className="absolute w-11 h-11 -ml-[22px] -mt-[22px]"
                style={{ left: x, top: y, cursor: h.cursor, touchAction: 'none' }}
                onPointerDown={(e) => begin({ kind: 'handle', handle: h.id, start: rect }, e)}
              />
            );
          })
        : pts.map((c, i) => (
            <div
              key={i}
              role="slider"
              aria-label={`Crop corner ${i + 1}`}
              className="absolute w-11 h-11 -ml-[22px] -mt-[22px] cursor-move"
              style={{ left: c.x, top: c.y, touchAction: 'none' }}
              onPointerDown={(e) => begin({ kind: 'corner', index: i }, e)}
            />
          ))}

      {/* The size it will come out at, while dragging */}
      {dragging && (
        <div
          className="absolute -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/75 text-white text-[11px] font-semibold tabular-nums pointer-events-none"
          style={{ left: midX, top: Math.max(4, top - 28) }}
        >
          {Math.round(outW)} × {Math.round(outH)}
        </div>
      )}
    </div>
  );
}
