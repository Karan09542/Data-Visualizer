import React, { useCallback, useRef, useState } from "react";
import {
  AREA_FILL_OPACITY,
  HIGHLIGHTER_OPACITY,
  STAMP_RANGE,
  arrowHead,
  arrowShaftEnd,
  bounds,
  checkPath,
  circleRadius,
  crossPath,
  isSpan,
  isStamp,
  isStroke,
  moveShape,
  rectOf,
  shapeAt,
  simplify,
  starPoints,
  strokePath,
  strokeWidth,
  type MarkupShape,
  type SpanKind,
  type StampKind,
  type StrokeKind,
} from "./markupModel";
import type { ImageMarkupState } from "./useImageMarkup";

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** One mark, drawn in the picture's pixels. */
function ShapeView({ s, unit }: { s: MarkupShape; unit: number }) {
  const w = strokeWidth(s, unit);
  const line = {
    fill: "none",
    stroke: s.color,
    strokeWidth: w,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (isStroke(s)) {
    return (
      <path
        d={strokePath(s.points)}
        {...line}
        strokeOpacity={s.kind === "highlighter" ? HIGHLIGHTER_OPACITY : undefined}
        style={s.kind === "highlighter" ? { mixBlendMode: "multiply" } : undefined}
      />
    );
  }
  if (isSpan(s)) {
    if (s.kind === "line") return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...line} />;
    if (s.kind === "arrow") {
      const [ex, ey] = arrowShaftEnd(s, unit);
      return (
        <g>
          <line x1={s.x1} y1={s.y1} x2={ex} y2={ey} {...line} />
          <polygon points={arrowHead(s, unit)} fill={s.color} stroke={s.color} strokeWidth={w / 2} strokeLinejoin="round" />
        </g>
      );
    }
    const area = {
      fill: s.fill ? s.color : "none",
      fillOpacity: s.fill ? AREA_FILL_OPACITY : undefined,
      stroke: s.color,
      strokeWidth: w,
      strokeLinejoin: "round" as const,
    };
    if (s.kind === "circle") return <circle cx={s.x1} cy={s.y1} r={circleRadius(s)} {...area} />;
    const r = rectOf(s);
    return <rect x={r.x} y={r.y} width={r.w} height={r.h} {...area} />;
  }
  const half = (s.stamp * unit) / 2;
  if (s.kind === "check") return <path d={checkPath(s.cx, s.cy, half)} {...line} />;
  if (s.kind === "cross") return <path d={crossPath(s.cx, s.cy, half)} {...line} />;
  if (s.kind === "star")
    return <polygon points={starPoints(s.cx, s.cy, half)} fill={s.fill ? s.color : "none"} stroke={s.color} strokeWidth={w} strokeLinejoin="round" />;
  return (
    <g>
      <circle cx={s.cx} cy={s.cy} r={Math.max(half - w / 2, 0)} fill={s.fill ? s.color : "none"} stroke={s.color} strokeWidth={w} />
      <text
        x={s.cx}
        y={s.cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        fontWeight={700}
        fontSize={half * 1.05}
        fill={s.fill ? "#fff" : s.color}
      >
        {s.n}
      </text>
    </g>
  );
}

/**
 * The marks over the picture: an SVG in the picture's own pixels. It is placed and
 * turned by the viewer with the image, so it never has to know about zoom or pan.
 */
export function MarkupSvg({
  shapes,
  draft,
  width,
  height,
  unit,
  selectedId,
  screenPx,
}: {
  shapes: MarkupShape[];
  draft: MarkupShape | null;
  width: number;
  height: number;
  unit: number;
  selectedId: string | null;
  /** Picture pixels per screen pixel: outlines that keep their size on screen. */
  screenPx: number;
}) {
  const selected = selectedId ? shapes.find((s) => s.id === selectedId) : undefined;
  const box = selected ? bounds(selected, unit) : null;
  const pad = 4 * screenPx;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className="absolute inset-0 overflow-visible pointer-events-none"
      aria-hidden
    >
      {shapes.map((s) => (
        <ShapeView key={s.id} s={s} unit={unit} />
      ))}
      {draft && <ShapeView s={draft} unit={unit} />}
      {box && (
        <rect
          x={box.x - pad}
          y={box.y - pad}
          width={box.w + 2 * pad}
          height={box.h + 2 * pad}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5 * screenPx}
          strokeDasharray={`${5 * screenPx} ${4 * screenPx}`}
          rx={3 * screenPx}
        />
      )}
    </svg>
  );
}

type Drag =
  | { mode: "move"; id: string; start: { x: number; y: number }; before: MarkupShape[]; after: MarkupShape[] | null }
  | { mode: "erase"; before: MarkupShape[]; removed: Set<string>; last: { x: number; y: number } }
  | { mode: "draw"; start: { x: number; y: number } };

/**
 * Turns a drag on the picture into a mark, by the tool in hand. Points come in
 * picture pixels; `slop` is how near (in picture pixels) counts as on a mark.
 */
export function useMarkupGestures(markup: ImageMarkupState, unit: number) {
  const [draft, setDraft] = useState<MarkupShape | null>(null);
  const drag = useRef<Drag | null>(null);
  const draftRef = useRef<MarkupShape | null>(null);
  const live = useRef(markup);
  live.current = markup;

  const show = (s: MarkupShape | null) => {
    draftRef.current = s;
    setDraft(s);
  };

  const eraseAlong = (from: { x: number; y: number }, to: { x: number; y: number }, slop: number) => {
    const d = drag.current;
    if (!d || d.mode !== "erase") return;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(slop, 1e-6)));
    let changed = false;
    const left = d.before.filter((s) => !d.removed.has(s.id));
    for (let i = 0; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      const hit = shapeAt(left, x, y, unit, slop);
      if (hit && !d.removed.has(hit.id)) {
        d.removed.add(hit.id);
        changed = true;
      }
    }
    if (changed) live.current.preview(d.before.filter((s) => !d.removed.has(s.id)));
  };

  const begin = useCallback(
    (p: { x: number; y: number }, slop: number) => {
      const m = live.current;
      const { tool, color, size, stamp, fill } = m.style;
      if (tool === "select") {
        const hit = shapeAt(m.shapes, p.x, p.y, unit, slop);
        m.setSelectedId(hit?.id ?? null);
        drag.current = hit ? { mode: "move", id: hit.id, start: p, before: m.shapes, after: null } : null;
        return;
      }
      m.setSelectedId(null);
      if (tool === "eraser") {
        drag.current = { mode: "erase", before: m.shapes, removed: new Set(), last: p };
        eraseAlong(p, p, slop);
        return;
      }
      drag.current = { mode: "draw", start: p };
      const base = { id: newId(), color, size };
      if (tool === "pen" || tool === "highlighter") show({ ...base, kind: tool as StrokeKind, points: [p.x, p.y] });
      else if (tool === "line" || tool === "arrow" || tool === "rect" || tool === "circle")
        show({ ...base, kind: tool as SpanKind, x1: p.x, y1: p.y, x2: p.x, y2: p.y, fill });
      else
        show({
          ...base,
          kind: tool as StampKind,
          cx: p.x,
          cy: p.y,
          stamp,
          fill,
          ...(tool === "badge" ? { n: m.nextBadge() } : {}),
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unit],
  );

  const move = useCallback(
    (p: { x: number; y: number }, slop: number) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "move") {
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (!d.after && Math.hypot(dx, dy) < slop * 0.5) return;
        d.after = d.before.map((s) => (s.id === d.id ? moveShape(s, dx, dy) : s));
        live.current.preview(d.after);
        return;
      }
      if (d.mode === "erase") {
        eraseAlong(d.last, p, slop);
        d.last = p;
        return;
      }
      const s = draftRef.current;
      if (!s) return;
      if (isStroke(s)) {
        const n = s.points.length;
        // A new point once it's a little way from the last (about a screen pixel).
        if (Math.hypot(p.x - s.points[n - 2], p.y - s.points[n - 1]) < slop * 0.12) return;
        show({ ...s, points: [...s.points, p.x, p.y] });
      } else if (isSpan(s)) {
        show({ ...s, x2: p.x, y2: p.y });
      } else if (isStamp(s)) {
        // Dragged out: as big as the drag (tap for the size set below).
        const across = (2 * Math.hypot(p.x - d.start.x, p.y - d.start.y)) / unit;
        if (across * unit < slop * 2) return;
        show({ ...s, stamp: Math.round(Math.min(STAMP_RANGE.max, Math.max(STAMP_RANGE.min, across))) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unit],
  );

  const end = useCallback(
    (slop: number) => {
      const d = drag.current;
      drag.current = null;
      const m = live.current;
      if (!d) return;
      if (d.mode === "move") {
        if (d.after) m.finish(d.before, d.after);
        return;
      }
      if (d.mode === "erase") {
        if (d.removed.size) m.finish(d.before, d.before.filter((s) => !d.removed.has(s.id)));
        return;
      }
      const s = draftRef.current;
      show(null);
      if (!s) return;
      if (isStroke(s)) {
        // A tap leaves a dot.
        m.add({ ...s, points: simplify(s.points, slop * 0.08) });
      } else if (isSpan(s)) {
        // Too short to mean anything: a stray tap.
        if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < slop * 0.6) return;
        m.add(s);
      } else m.add(s);
    },
    [],
  );

  /** A second finger came down (to pinch): forget what this drag was doing. */
  const cancel = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    show(null);
    if (d && (d.mode === "move" || d.mode === "erase")) live.current.preview(d.before);
  }, []);

  return { draft, begin, move, end, cancel };
}
