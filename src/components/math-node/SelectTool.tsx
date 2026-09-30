import React, { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Circle as MafsCircle, MovablePoint, Polygon, useTransformContext, vec } from "mafs";
import type { Vec2 } from "./areaMath";
import type { Motion } from "./selection";
import {
  TraceScopeContext,
  getTraceShape,
  hitTestTrace,
  rowsInsideBox,
  shapesForFunction,
  subscribeTraceShapes,
  traceShapesVersion,
} from "./traceGeometry";

const TAP_SLOP_PX = 6;
const PICK_PX = 12;
const MIN_RING_PX = 44;

export const SELECT_MOVE = "#3b82f6";
export const SELECT_ROTATE = "#f59e0b";
export const SELECT_RESIZE = "#10b981";

export interface SelectToolSelection {
  rowIds: string[];
  /** The fixed point of turning and resizing; null hides the handles (delete only). */
  centre: Vec2 | null;
  canRotate: boolean;
  canResize: boolean;
}

interface SelectToolProps {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selection: SelectToolSelection | null;
  /**
   * What was picked: one row by a click, several by dragging a box round them,
   * none by a click on empty space. `add` (Shift) adds to or takes from what's
   * already selected. `middle` is the middle of what's visible of a clicked row,
   * for one that needs a point to turn about.
   */
  onSelect: (fnIds: string[], middle: Vec2 | null, add: boolean) => void;
  onMotion: (motion: Motion) => void;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Click a shape to select it, or drag a box round several. Then drag the blue
 * handle to move the selection, the amber one to turn it and the green one to
 * resize it. The motions are reported as small steps taken from the pointer
 * itself, so nothing drifts however fast the graph keeps up.
 *
 * The graph doesn't pan while this tool is in hand (a drag draws the box), so
 * the caller turns panning off; scrolling still zooms.
 */
export function SelectTool({ active, containerRef, selection, onSelect, onMotion }: SelectToolProps) {
  const scope = useContext(TraceScopeContext);
  const { viewTransform } = useTransformContext();
  const anchorRef = useRef<SVGGElement>(null);
  useSyncExternalStore(subscribeTraceShapes, traceShapesVersion, traceShapesVersion);

  // How far the selection has been turned since it was selected: where the handles sit.
  const [turned, setTurned] = useState(0);
  const selectionKey = selection?.rowIds.join("|") ?? "";
  useEffect(() => setTurned(0), [selectionKey]);

  // The box being dragged out, corner to corner.
  const [box, setBox] = useState<{ a: Vec2; b: Vec2 } | null>(null);

  // Where each handle's drag was last seen; cleared when a new drag starts.
  const last = useRef<{ move: Vec2 | null; angle: number | null; distance: number | null }>({
    move: null,
    angle: null,
    distance: null,
  });
  const live = useRef({ viewTransform, onSelect, scope });
  live.current = { viewTransform, onSelect, scope };

  const pxPerUnit = () => {
    const [a, , , , d] = live.current.viewTransform;
    return { sx: Math.abs(a) || 1, sy: Math.abs(d) || 1 };
  };

  /** The visible part of the graph, in graph units. */
  const visible = () => {
    const vb = anchorRef.current?.ownerSVGElement?.viewBox?.baseVal;
    const [a, , , , d] = live.current.viewTransform;
    if (!vb || !a || !d) return null;
    const xs = [vb.x / a, (vb.x + vb.width) / a];
    const ys = [vb.y / d, (vb.y + vb.height) / d];
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  const toWorld = (clientX: number, clientY: number): Vec2 | null => {
    const svg = anchorRef.current?.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    const inverse = vec.matrixInvert(live.current.viewTransform);
    if (!svg || !ctm || !inverse) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return vec.transform([p.x, p.y], inverse) as Vec2;
  };

  /** The middle of the part of a row's drawing that's on screen. */
  const middleOf = (fnId: string): Vec2 | null => {
    const view = visible();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of shapesForFunction(fnId, live.current.scope)) {
      for (let i = 0; i < s.xs.length; i++) {
        const x = s.xs[i];
        const y = s.ys[i];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (view && (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1)) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return x0 <= x1 ? [(x0 + x1) / 2, (y0 + y1) / 2] : null;
  };

  // A click picks the shape under it; a drag from empty space draws a box and
  // picks what's inside. A press on a handle or a draggable point is theirs.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !active) return;
    // onPoint: the press landed on a draggable point, which takes the drag itself.
    let start: { x: number; y: number; world: Vec2; onPoint: boolean; onHandle: boolean } | null = null;
    let dragging = false;

    const onDown = (e: PointerEvent) => {
      last.current = { move: null, angle: null, distance: null };
      start = null;
      dragging = false;
      if (e.button !== 0 || !e.isPrimary) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-no-trace]")) return;
      const world = toWorld(e.clientX, e.clientY);
      if (!world) return;
      start = {
        x: e.clientX,
        y: e.clientY,
        world,
        onPoint: !!target?.closest(".mafs-movable-point"),
        onHandle: !!target?.closest("[data-select-handle]"),
      };
    };
    const onMove = (e: PointerEvent) => {
      if (!start || start.onPoint) return;
      if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= TAP_SLOP_PX) return;
      dragging = true;
      const b = toWorld(e.clientX, e.clientY);
      if (b) setBox({ a: start.world, b });
    };
    const onUp = (e: PointerEvent) => {
      const from = start;
      const wasDragging = dragging;
      start = null;
      dragging = false;
      setBox(null);
      if (!from) return;
      // The selection's own handles aren't shapes; a point that was dragged was moved, not picked.
      if (from.onHandle) return;
      if (from.onPoint && Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX) return;
      const w = toWorld(e.clientX, e.clientY);
      if (!w) return;
      if (wasDragging) {
        const ids = rowsInsideBox(
          {
            x0: Math.min(from.world[0], w[0]),
            x1: Math.max(from.world[0], w[0]),
            y0: Math.min(from.world[1], w[1]),
            y1: Math.max(from.world[1], w[1]),
          },
          live.current.scope,
        );
        live.current.onSelect(ids, null, e.shiftKey);
        return;
      }
      const hit = hitTestTrace(w[0], w[1], pxPerUnit(), PICK_PX, live.current.scope);
      const shape = hit && getTraceShape(hit.key);
      live.current.onSelect(shape ? [shape.fnId] : [], shape ? middleOf(shape.fnId) : null, e.shiftKey);
    };
    const onCancel = () => {
      start = null;
      dragging = false;
      setBox(null);
    };

    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setBox(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);

  const marquee = box && (
    <g style={{ pointerEvents: "none" }}>
      <Polygon
        points={[box.a, [box.b[0], box.a[1]], box.b, [box.a[0], box.b[1]]]}
        color={SELECT_MOVE}
        fillOpacity={0.1}
        strokeStyle="dashed"
        weight={1.5}
      />
    </g>
  );

  const centre = active && selection ? selection.centre : null;
  if (!active || !selection || !centre) return <g ref={anchorRef}>{active && marquee}</g>;

  // The ring: as far out as the selection reaches, kept on screen and big enough to grab.
  const { sx, sy } = pxPerUnit();
  let reach = 0;
  for (const id of selection.rowIds) {
    for (const s of shapesForFunction(id, scope)) {
      for (let i = 0; i < s.xs.length; i++) {
        const d = Math.hypot(s.xs[i] - centre[0], s.ys[i] - centre[1]);
        if (Number.isFinite(d) && d > reach) reach = d;
      }
    }
  }
  const view = visible();
  const most = view ? 0.32 * Math.min(view.x1 - view.x0, view.y1 - view.y0) : Infinity;
  const ring = Math.max(MIN_RING_PX / Math.min(sx, sy), Math.min(reach * 1.12, most));

  const at = (angle: number): Vec2 => [centre[0] + ring * Math.cos(angle), centre[1] + ring * Math.sin(angle)];
  const rotateAngle = Math.PI / 2 + turned;
  const resizeAngle = -Math.PI / 4 + turned;

  return (
    <g ref={anchorRef}>
      <g style={{ pointerEvents: "none" }}>
        <MafsCircle center={centre} radius={ring} color={SELECT_MOVE} fillOpacity={0.04} strokeStyle="dashed" weight={1.5} />
      </g>
      {marquee}
      <g data-select-handle>
      <MovablePoint
        point={centre}
        color={SELECT_MOVE}
        onMove={(pt) => {
          const from = last.current.move ?? centre;
          last.current.move = [pt[0], pt[1]];
          const dx = pt[0] - from[0];
          const dy = pt[1] - from[1];
          if (dx || dy) onMotion({ kind: "move", dx, dy });
        }}
      />
      {selection.canRotate && (
        <MovablePoint
          point={at(rotateAngle)}
          color={SELECT_ROTATE}
          onMove={(pt) => {
            const angle = Math.atan2(pt[1] - centre[1], pt[0] - centre[0]);
            const step = wrap(angle - (last.current.angle ?? rotateAngle));
            last.current.angle = angle;
            if (!step) return;
            setTurned((t) => t + step);
            onMotion({ kind: "rotate", angle: step, centre });
          }}
        />
      )}
      {selection.canResize && (
        <MovablePoint
          point={at(resizeAngle)}
          color={SELECT_RESIZE}
          onMove={(pt) => {
            const distance = Math.hypot(pt[0] - centre[0], pt[1] - centre[1]);
            const from = last.current.distance ?? ring;
            // Too near the centre to mean a size.
            if (distance < ring * 0.05 || from <= 0) return;
            last.current.distance = distance;
            const factor = distance / from;
            if (factor !== 1) onMotion({ kind: "scale", factor, centre });
          }}
        />
      )}
      </g>
    </g>
  );
}
