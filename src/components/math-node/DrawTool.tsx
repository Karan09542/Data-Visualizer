import React, { useContext, useEffect, useRef, useState } from "react";
import { Line, Point, Polyline, Circle as MafsCircle, useTransformContext, vec } from "mafs";
import type { Vec2 } from "./areaMath";
import { TraceScopeContext, getTraceShape, hitTestTrace } from "./traceGeometry";

/** What each drawing tool makes, and how many clicks it takes. */
export type DrawToolKind =
  | "point"
  | "segment"
  | "vector"
  | "line"
  | "circle"
  | "polygon"
  | "distance"
  | "angle"
  // 3D view only:
  | "plane"
  | "foot"
  | "dihedral"
  | "lineplane"
  | "skew";

/** The tools that only make sense in space (the 3D view). */
export const SPACE_TOOLS = new Set<DrawToolKind>(["plane", "foot", "dihedral", "lineplane", "skew"]);

/**
 * 3D view: what a drawn polygon or circle becomes. Flat; extruded (a prism, or a
 * cylinder); or drawn up to a point (a pyramid, or a cone).
 */
export type SolidMode = "flat" | "extrude" | "apex" | "sphere";

/** A solid's top: the point its base is extruded to, or its apex. */
export interface DrawSolid {
  /** sphere: a ball on a circle, centred where it is, as wide as it is (no top to set). */
  kind: "extrude" | "apex" | "sphere";
  tip: DrawPick;
}

/** A tool in hand on the graph: one that draws, or Select. */
export type GraphTool = DrawToolKind | "select";

export const SELECT_TOOL_HINT = "Click a shape, or drag a box round several, then move, turn, resize or delete them. Shift adds to the selection.";
/** The same in the 3D view, where a drag turns the view and the handles are arrows. */
export const SELECT_TOOL_HINT_3D =
  "Click a shape to select it (Shift-click adds more). Drag the arrows to move it along x, y or z, the yellow handle to turn it, the green one to resize it. Delete removes it.";

export const DRAW_TOOL_CLICKS: Record<DrawToolKind, number> = {
  point: 1,
  segment: 2,
  vector: 2,
  line: 2,
  circle: 2,
  polygon: Infinity, // until the first corner is clicked again
  distance: 2,
  angle: 3,
  plane: 3,
  foot: 4,
  dihedral: 4,
  lineplane: 5,
  skew: 4,
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
  plane: "Click 3 points: draws the flat plane through them and its equation.",
  foot: "Click the point first, then 3 points on the plane: shows the nearest spot on the plane and the distance.",
  dihedral: "Click both ends of the fold line, then 1 point on each side: shows the angle between the two planes.",
  lineplane: "Click 2 points for the line, then 3 for the plane: marks where the line goes through the plane.",
  skew: "Click 2 points on the first line, then 2 on the second: shows the shortest gap between the lines.",
};

/**
 * More for the toolbar's tooltip: what each 3D tool is for, step by step, with an example.
 * Each has a worked scene in the 3D Gallery (Geometry).
 */
export const DRAW_TOOL_TIPS: Partial<Record<DrawToolKind, string>> = {
  plane: [
    "What it does: makes the flat plane that passes through 3 points.",
    "How: 1. click point A  2. click point B  3. click point C",
    "Example: (2, 0, 0), (0, 3, 0), (0, 0, 2) give 3x + 2y + 3z = 6.",
    "Tip: draw two planes to see the line where they cross.",
  ].join("\n"),
  foot: [
    "What it does: drops a perpendicular from a point to a plane, like a plumb line to the floor.",
    "How: 1. click the point P  2-4. click 3 points on the plane",
    "Shows: the foot F (the nearest spot on the plane) and the distance PF.",
    "Example: from (2.5, 2.5, 2.5) to x + y + z = 3 the distance is 4.5/√3 ≈ 2.6.",
  ].join("\n"),
  dihedral: [
    "What it does: measures the angle between two planes that share an edge, like a half-open book or a door.",
    "How: 1-2. click both ends of the shared edge  3. click a point on one plane  4. a point on the other",
    "Example: the floor and a wall meet at 90°; a roof face and its loft floor at the roof's pitch.",
  ].join("\n"),
  lineplane: [
    "What it does: finds where a line passes through a plane.",
    "How: 1-2. click 2 points on the line  3-5. click 3 points on the plane",
    "Shows: the meeting point X and its coordinates (none if the line runs parallel to the plane).",
    "Example: the line from (−2, −1, 3) through (0, 0, 2) meets the plane z = 1 at (2, 1, 1).",
  ].join("\n"),
  skew: [
    "What it does: finds the shortest distance between two lines, even ones that never meet (skew lines).",
    "How: 1-2. click 2 points on the first line  3-4. click 2 points on the second",
    "Shows: the closest points M and N, and MN, which is square to both lines.",
    "Example: a line along the floor and another crossing above it at height 2.5 are 2.5 apart.",
  ].join("\n"),
};

/** The same, short enough for one line on a phone. */
export const DRAW_TOOL_SHORT_HINTS: Record<DrawToolKind, string> = {
  point: "Tap to place a point",
  segment: "Tap two points",
  vector: "Tap the tail, then the tip",
  line: "Tap two points",
  circle: "Tap the centre, then the edge",
  polygon: "Tap corners; tap the first to close",
  distance: "Tap two points to measure",
  angle: "Tap a point, the corner, a point",
  plane: "Tap 3 points for a plane",
  foot: "Tap the point, then 3 on the plane",
  dihedral: "Tap 2 on the fold, then 1 on each side",
  lineplane: "Tap 2 on the line, then 3 on the plane",
  skew: "Tap 2 on each line",
};

export const SELECT_TOOL_SHORT_HINT = "Tap a shape or drag a box";
export const SELECT_TOOL_SHORT_HINT_3D = "Tap a shape to select it";

/** A clicked spot: an existing named point, or a new position. */
export interface DrawPick {
  /**
   * The existing point that was clicked, or "#i" for the i-th click of this same
   * shape (a corner used again). Unset for a new point.
   */
  name?: string;
  x: number;
  y: number;
  /** Height, for a click in the 3D view (0 or missing: on the floor). */
  z?: number;
  /**
   * 3D view: the drawing plane the click landed on, by the axis it is square to:
   * 2 the level XY plane (z = c), 1 the upright XZ plane (y = c), 0 the YZ plane (x = c).
   */
  plane?: 0 | 1 | 2;
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
