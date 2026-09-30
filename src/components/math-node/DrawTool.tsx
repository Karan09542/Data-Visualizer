import React, { useContext, useEffect, useRef, useState } from "react";
import { Line, Point, Polyline, Circle as MafsCircle, useTransformContext, vec } from "mafs";
import type { Vec2 } from "./areaMath";
import { TraceScopeContext, getTraceShape, hitTestTrace } from "./traceGeometry";

/** What each drawing tool makes, and how many clicks it takes. */
export type DrawToolKind = "point" | "segment" | "vector" | "line" | "circle" | "polygon" | "distance" | "angle";

/** A tool in hand on the graph: one that draws, or Select. */
export type GraphTool = DrawToolKind | "select";

export const SELECT_TOOL_HINT = "Click a shape, or drag a box round several, then move, turn, resize or delete them. Shift adds to the selection.";

export const DRAW_TOOL_CLICKS: Record<DrawToolKind, number> = {
  point: 1,
  segment: 2,
  vector: 2,
  line: 2,
  circle: 2,
  polygon: Infinity, // until the first corner is clicked again
  distance: 2,
  angle: 3,
};

export const DRAW_TOOL_HINTS: Record<DrawToolKind, string> = {
  point: "Click to place a point. On a shape's outline it attaches to that shape.",
  segment: "Click two points to join them.",
  vector: "Click where the arrow starts, then where it points.",
  line: "Click two points for a line through them.",
  circle: "Click the centre, then a point on the circle.",
  polygon: "Click the corners, then the first corner again to close (or press Enter).",
  distance: "Click two points to measure the distance between them.",
  angle: "Click a point, the corner, then another point to measure the angle.",
};

/** A clicked spot: an existing named point, or a new position. */
export interface DrawPick {
  /**
   * The existing point that was clicked, or "#i" for the i-th click of this same
   * shape (a corner used again). Unset for a new point.
   */
  name?: string;
  x: number;
  y: number;
  /**
   * The shape whose outline was clicked (Point tool only): its row, which
   * segment of its outline, and the curve parameter there when it has one.
   */
  on?: { fnId: string; seg: number; t?: number };
}

interface DrawToolProps {
  tool: DrawToolKind | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Named points on the graph, to snap to. */
  points: { name: string; x: number; y: number }[];
  color: string;
  /** All the clicks for one shape are in. */
  onComplete: (tool: DrawToolKind, picks: DrawPick[]) => void;
  /** Escape with nothing pending: put the tool down. */
  onExit: () => void;
}

const TAP_SLOP_PX = 8;
const SNAP_PX = 12;

/**
 * Click-to-draw on the graph. Clicks near an existing point reuse it, so a
 * triangle through A and B is joined to them; clicks near whole-number grid
 * points land on them exactly. The shape is previewed as you go and handed to
 * `onComplete` when its last click is in.
 */
export function DrawTool({ tool, containerRef, points, color, onComplete, onExit }: DrawToolProps) {
  const { viewTransform } = useTransformContext();
  const scope = useContext(TraceScopeContext);
  const anchorRef = useRef<SVGGElement>(null);
  const [picks, setPicks] = useState<DrawPick[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const live = useRef({ viewTransform, points, picks, tool, onComplete, onExit });
  live.current = { viewTransform, points, picks, tool, onComplete, onExit };

  // A new tool starts a new shape.
  useEffect(() => setPicks([]), [tool]);

  const toWorld = (clientX: number, clientY: number): Vec2 | null => {
    const svg = anchorRef.current?.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    const inverse = vec.matrixInvert(live.current.viewTransform);
    if (!svg || !ctm || !inverse) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return vec.transform([p.x, p.y], inverse) as Vec2;
  };

  /** Where a click lands: a point to reuse, a grid point, or just there (rounded). */
  const snap = (w: Vec2): DrawPick => {
    const [a, , , , d] = live.current.viewTransform;
    const px = Math.abs(a) || 1;
    const py = Math.abs(d) || 1;
    const dist = (x: number, y: number) => Math.hypot((x - w[0]) * px, (y - w[1]) * py);
    const candidates = [
      ...live.current.picks.map((p, i) => ({ ...p, pending: i })),
      ...live.current.points.map((p) => ({ ...p, pending: -1 })),
    ];
    let best: (typeof candidates)[number] | null = null;
    let bestD = SNAP_PX;
    for (const c of candidates) {
      const dd = dist(c.x, c.y);
      if (dd < bestD) {
        bestD = dd;
        best = c;
      }
    }
    // A corner of this shape counts as itself (an existing point keeps its name).
    if (best) return { name: best.name && !best.name.startsWith("#") ? best.name : `#${best.pending}`, x: best.x, y: best.y };
    // A point placed on a shape's outline belongs to that shape.
    if (live.current.tool === "point") {
      const hit = hitTestTrace(w[0], w[1], { sx: px, sy: py }, SNAP_PX, scope);
      const shape = hit && getTraceShape(hit.key);
      if (hit && shape && shape.kind === "curve") {
        return { x: hit.x, y: hit.y, on: { fnId: shape.fnId, seg: hit.seg, t: hit.t } };
      }
    }
    const gx = Math.round(w[0]);
    const gy = Math.round(w[1]);
    if (dist(gx, gy) < SNAP_PX * 0.8) return { x: gx, y: gy };
    // Round to what a pixel is worth, so coordinates stay readable.
    const digits = Math.max(0, Math.min(4, Math.ceil(Math.log10(px))));
    const round = (v: number) => Number(v.toFixed(digits));
    return { x: round(w[0]), y: round(w[1]) };
  };

  const finish = (all: DrawPick[]) => {
    const t = live.current.tool;
    if (!t) return;
    live.current.onComplete(t, all);
    setPicks([]);
  };

  // Clicks, taps, the preview and the keyboard, while a tool is in hand.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !tool) return;
    let start: { x: number; y: number } | null = null;
    let frame = 0;

    const onDown = (e: PointerEvent) => {
      const overUI = e.target instanceof Element && e.target.closest("[data-no-trace]");
      start = overUI ? null : { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const from = start;
      start = null;
      if (!from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX) return;
      const w = toWorld(e.clientX, e.clientY);
      const t = live.current.tool;
      if (!w || !t) return;
      const pick = snap(w);
      const prev = live.current.picks;

      if (t === "polygon") {
        // Back on the first corner: closed.
        const isFirst = pick.name === "#0" || (!!prev[0]?.name && pick.name === prev[0].name);
        if (prev.length >= 3 && isFirst) return finish(prev);
        // Another corner already in this shape: ignore.
        if (pick.name?.startsWith("#") || (pick.name && prev.some((p) => p.name === pick.name))) return;
        return setPicks([...prev, pick]);
      }
      // The same point twice makes nothing.
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.x - pick.x) < 1e-9 && Math.abs(last.y - pick.y) < 1e-9) return;
      const next = [...prev, pick];
      if (next.length >= DRAW_TOOL_CLICKS[t]) finish(next);
      else setPicks(next);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      const { clientX, clientY } = e;
      frame = requestAnimationFrame(() => {
        const w = toWorld(clientX, clientY);
        if (!w) return;
        const s = snap(w);
        setHover([s.x, s.y]);
      });
    };
    const onLeave = () => setHover(null);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key === "Escape") {
        if (live.current.picks.length) setPicks([]);
        else live.current.onExit();
      } else if (e.key === "Enter" && live.current.tool === "polygon" && live.current.picks.length >= 3) {
        finish(live.current.picks);
      } else if (e.key === "Backspace" && live.current.picks.length) {
        setPicks((p) => p.slice(0, -1));
      }
    };

    // Capture: a draggable point handles its own pointer events, and clicking one
    // must still pick it.
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("pointerup", onUp, true);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("pointerup", onUp, true);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, containerRef]);

  if (!tool) return <g ref={anchorRef} />;

  const placed: Vec2[] = picks.map((p) => {
    const i = p.name?.startsWith("#") ? Number(p.name.slice(1)) : -1;
    return i >= 0 ? [picks[i].x, picks[i].y] : [p.x, p.y];
  });
  const withHover = hover ? [...placed, hover] : placed;

  return (
    <g ref={anchorRef} style={{ pointerEvents: "none" }}>
      {tool === "circle" && placed.length === 1 && hover && (
        <MafsCircle
          center={placed[0]}
          radius={Math.hypot(hover[0] - placed[0][0], hover[1] - placed[0][1])}
          color={color}
          fillOpacity={0.06}
          strokeStyle="dashed"
        />
      )}
      {tool === "line" && placed.length === 1 && hover && (
        <Line.ThroughPoints point1={placed[0]} point2={hover} color={color} opacity={0.7} style="dashed" />
      )}
      {(tool === "segment" || tool === "vector" || tool === "distance" || tool === "angle" || tool === "polygon") && withHover.length >= 2 && (
        <Polyline points={withHover} color={color} strokeOpacity={0.7} strokeStyle="dashed" weight={2} />
      )}
      {placed.map((p, i) => (
        <Point key={i} x={p[0]} y={p[1]} color={color} />
      ))}
      {hover && <Point x={hover[0]} y={hover[1]} color={color} opacity={0.5} />}
    </g>
  );
}
