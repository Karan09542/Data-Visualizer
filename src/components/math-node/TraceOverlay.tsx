import React, { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTransformContext, vec } from "mafs";
import {
  TraceScopeContext,
  deferTracePin,
  deleteTraceShape,
  formatTraceNumber,
  getTraceShape,
  hitTestTrace,
  interceptAxesAt,
  onTracePinRequest,
  projectOntoShape,
  relocateOnShape,
  requestTraceReveal,
  scopedTraceKey,
  setTraceShape,
  shapeIntercepts,
  snapToIntercept,
  subscribeTraceShapes,
  subscribeTraceShapesSlow,
  traceShapesSlowVersion,
  traceShapesVersion,
  type TraceHit,
  type TraceShape,
} from "./traceGeometry";

// UI floating over the graph (toolbar, settings panel, inspector) opts out of tracing,
// so tapping a button doesn't also trace the curve underneath it.
const isOverOverlayUI = (e: PointerEvent) =>
  e.target instanceof Element && e.target.closest("[data-no-trace]") !== null;

/** Pick radius around the pointer, in on-screen pixels. */
const MOUSE_PICK_PX = 20;
const TOUCH_PICK_PX = 28;
/** How close to an axis crossing the point snaps onto it, in on-screen pixels. */
const SNAP_PX = 12;
/** Movement that turns a tap/click into a pan. */
const TAP_SLOP_PX = 10;

/**
 * Publishes a shape for the tracer while mounted. It re-publishes only when the
 * geometry actually changes, so re-rendering every animation frame costs nothing.
 */
export const TraceShapeRegistrar: React.FC<{
  shapeKey: string;
  shape: TraceShape | null;
}> = ({ shapeKey, shape }) => {
  const signature = shape
    ? [
      shape.kind,
      shape.color,
      Array.prototype.join.call(shape.xs, ","),
      Array.prototype.join.call(shape.ys, ","),
    ].join("|")
    : "";
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const scope = useContext(TraceScopeContext);

  useEffect(() => {
    const current = shapeRef.current;
    if (!current) return;
    const key = scopedTraceKey(scope, shapeKey);
    setTraceShape(key, { ...current, scope });
    return () => deleteTraceShape(key);
  }, [shapeKey, signature, scope]);

  return null;
};

interface TraceOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Another tool (the Area tool) owns clicks on the graph for now. */
  disabled?: boolean;
}

/**
 * Shows the value at a point on any drawn shape, and lets it be dragged along the
 * shape's path.
 *
 * - Desktop: hold Shift and hover; the point follows the nearest shape. Release
 *   Shift and it stays, so it can be grabbed and slid along the curve. A plain
 *   click on the graph or Escape dismisses it.
 * - Touch: tap a shape to place the point, drag it along the curve, tap empty
 *   space to dismiss.
 */
export const TraceOverlay: React.FC<TraceOverlayProps> = ({ containerRef, disabled = false }) => {
  const { viewTransform } = useTransformContext();
  const scope = useContext(TraceScopeContext);
  const anchorRef = useRef<SVGGElement>(null);
  const handleRef = useRef<SVGCircleElement>(null);
  const [pin, setPin] = useState<TraceHit | null>(null);
  const [dragging, setDragging] = useState(false);

  // While a point is shown, re-render when shapes are redrawn (at most once a
  // frame) so it rides along with animation, and once more after changes settle
  // so its crossing markers are current. With no point there is nothing to
  // update: hovering and tapping read the shapes directly when they happen.
  const hasPin = !!pin;
  const subscribeFrame = useCallback(
    (listener: () => void) => (hasPin ? subscribeTraceShapes(listener) : () => {}),
    [hasPin],
  );
  const subscribeSlow = useCallback(
    (listener: () => void) => (hasPin ? subscribeTraceShapesSlow(listener) : () => {}),
    [hasPin],
  );
  useSyncExternalStore(subscribeFrame, traceShapesVersion, traceShapesVersion);
  useSyncExternalStore(subscribeSlow, traceShapesSlowVersion, traceShapesSlowVersion);

  const scale = {
    sx: Math.abs(viewTransform[0]) || 1,
    sy: Math.abs(viewTransform[4]) || 1,
  };

  // The pin re-evaluated against the current geometry: a parametrised curve keeps
  // its parameter, so the point moves with the curve as it animates.
  const shape = pin ? getTraceShape(pin.key) : undefined;
  const shown = pin && shape ? relocateOnShape(pin.key, pin, scale) : null;

  // Latest values for the native listeners below, which are attached once.
  const live = useRef({ viewTransform, scale, shown, dragging: false });
  live.current.viewTransform = viewTransform;
  live.current.scale = scale;
  live.current.shown = shown;

  // Its shape went away (row hidden, deleted, or no longer drawn): drop the pin.
  useEffect(() => {
    if (pin && !shape) setPin(null);
  }, [pin, shape]);

  // Pointer → world coordinates through the SVG's own screen matrix. Unlike
  // arithmetic on bounding boxes and pane ranges, this is exact whatever the page or
  // the canvas around the node is scaled by.
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = anchorRef.current?.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    const inverse = vec.matrixInvert(live.current.viewTransform);
    if (!svg || !ctm || !inverse) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const [x, y] = vec.transform([p.x, p.y], inverse);
    // Screen pixels per SVG pixel, to keep pick radii constant on screen.
    const zoom = Math.hypot(ctm.a, ctm.b) || 1;
    return { x, y, zoom };
  }, []);

  const pickAt = useCallback(
    (clientX: number, clientY: number, radiusPx: number) => {
      const w = toWorld(clientX, clientY);
      if (!w) return null;
      const hit = hitTestTrace(w.x, w.y, live.current.scale, radiusPx / w.zoom, scope);
      return hit ? snapToIntercept(hit, live.current.scale, SNAP_PX / w.zoom) : null;
    },
    [toWorld, scope],
  );

  // The visible part of the graph, in graph coordinates, read off the SVG's viewBox.
  const visibleView = useCallback(() => {
    const svg = anchorRef.current?.ownerSVGElement;
    const box = svg?.viewBox?.baseVal;
    const [a, , , , d] = live.current.viewTransform;
    if (!box || !a || !d) return null;
    const x0 = box.x / a;
    const x1 = (box.x + box.width) / a;
    const y0 = box.y / d;
    const y1 = (box.y + box.height) / d;
    return {
      x: [Math.min(x0, x1), Math.max(x0, x1)] as [number, number],
      y: [Math.min(y0, y1), Math.max(y0, y1)] as [number, number],
    };
  }, []);

  // The equations panel can place the point too (clicking a root). If it's out of
  // view, the graph first pans to centre it, keeping the zoom; the pin waits for
  // the remounted graph's tracer.
  useEffect(
    () =>
      onTracePinRequest((hit) => {
        const view = visibleView();
        if (view) {
          const w = view.x[1] - view.x[0];
          const h = view.y[1] - view.y[0];
          const inside =
            hit.x >= view.x[0] + w * 0.05 && hit.x <= view.x[1] - w * 0.05 &&
            hit.y >= view.y[0] + h * 0.05 && hit.y <= view.y[1] - h * 0.05;
          if (!inside) {
            deferTracePin(hit, scope);
            const moved = requestTraceReveal(
              { x: [hit.x - w / 2, hit.x + w / 2], y: [hit.y - h / 2, hit.y + h / 2] },
              scope,
            );
            if (moved) return;
          }
        }
        setPin(hit);
      }, scope),
    [scope, visibleView],
  );

  // Hover, tap and click on the graph.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;

    const onMove = (e: PointerEvent) => {
      if (disabled || e.pointerType === "touch" || live.current.dragging) return;
      // Without Shift the point stays where it was left, ready to be dragged.
      if (!e.shiftKey || isOverOverlayUI(e)) return;
      setPin(pickAt(e.clientX, e.clientY, MOUSE_PICK_PX));
    };

    const onDown = (e: PointerEvent) => {
      start = isOverOverlayUI(e) ? null : { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: PointerEvent) => {
      const from = start;
      start = null;
      if (disabled || !from || live.current.dragging) return;
      const moved = Math.hypot(e.clientX - from.x, e.clientY - from.y);
      if (moved > TAP_SLOP_PX) return; // a pan, not a tap

      if (e.pointerType === "touch") {
        // A tap places the point on the nearest shape, or clears it on empty space.
        setPin(pickAt(e.clientX, e.clientY, TOUCH_PICK_PX));
      } else if (e.shiftKey) {
        setPin(pickAt(e.clientX, e.clientY, MOUSE_PICK_PX));
      } else {
        setPin(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPin(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [containerRef, pickAt, disabled]);

  // Dragging the point along its shape.
  const draggable = !!shown && shape?.kind === "curve";
  useEffect(() => {
    const handle = handleRef.current;
    if (!draggable || !handle) return;

    const onDown = (e: PointerEvent) => {
      // Keep the graph from panning and the node from being dragged.
      e.stopPropagation();
      e.preventDefault();
      const pointerId = e.pointerId;
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        /* capture is best-effort */
      }
      live.current.dragging = true;
      setDragging(true);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        ev.preventDefault();
        const current = live.current.shown;
        const w = toWorld(ev.clientX, ev.clientY);
        if (!current || !w) return;
        const hit = projectOntoShape(current.key, w.x, w.y, live.current.scale, current);
        if (hit) setPin(snapToIntercept(hit, live.current.scale, SNAP_PX / w.zoom));
      };
      const onEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        live.current.dragging = false;
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    };

    handle.addEventListener("pointerdown", onDown);
    return () => handle.removeEventListener("pointerdown", onDown);
  }, [draggable, toWorld]);

  let content: React.ReactNode = null;
  if (shown && shape) {
    const [ux, uy] = vec.transform([shown.x, shown.y], viewTransform);
    if (Number.isFinite(ux) && Number.isFinite(uy)) {
      const color = shape.color;
      // Keep the readout inside the view: flip it left near the right edge and
      // below near the top.
      const box = anchorRef.current?.ownerSVGElement?.viewBox?.baseVal;
      const flipX = !!box && ux > box.x + box.width - 220;
      const flipY = !!box && uy < box.y + 60;
      const LABEL_W = 260;
      const LABEL_H = 40;

      const onAxis = interceptAxesAt(shown.key, shown.x, shown.y, scale);
      // On a root y is 0 by definition, and on a y-axis crossing x is; show that
      // rather than whatever rounding the curve's evaluation left (-6.7e-16).
      const xText = onAxis.y ? "0" : formatTraceNumber(shown.x, scale.sx);
      const yText = onAxis.x ? "0" : formatTraceNumber(shown.y, scale.sy);
      const badge =
        onAxis.x && onAxis.y ? "Root · y-intercept" : onAxis.x ? "Root" : onAxis.y ? "y-intercept" : null;
      const paramText =
        shape.paramName && shown.t !== undefined && Number.isFinite(shown.t)
          ? `${shape.paramName} = ${formatTraceNumber(shown.t, 1000)}`
          : null;

      // Every axis crossing of the selected shape, as hollow dots the point snaps to.
      const crossings = shapeIntercepts(shown.key).map((p, i) => {
        const [cx, cy] = vec.transform([p.x, p.y], viewTransform);
        return Number.isFinite(cx) && Number.isFinite(cy) ? (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={4}
            fill="var(--mafs-bg, #fff)"
            stroke={color}
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
        ) : null;
      });

      content = (
        <React.Fragment>
        {crossings}
        <g transform={`translate(${ux} ${uy})`}>
          <circle
            r={dragging ? 13 : 10}
            fill={color}
            fillOpacity={0.18}
            style={{ pointerEvents: "none" }}
          />
          {badge && (
            <circle
              r={9}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              style={{ pointerEvents: "none" }}
            />
          )}
          <circle
            r={dragging ? 6.5 : 5.5}
            fill={color}
            stroke="var(--mafs-bg, #fff)"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
          {draggable && (
            // Larger than it looks, so it's easy to grab with a finger.
            <circle
              ref={handleRef}
              r={20}
              fill="transparent"
              data-no-trace
              style={{
                pointerEvents: "all",
                cursor: dragging ? "grabbing" : "grab",
                touchAction: "none",
              }}
            />
          )}
          <foreignObject
            x={flipX ? -16 - LABEL_W : 16}
            y={flipY ? 12 : -12 - LABEL_H}
            width={LABEL_W}
            height={LABEL_H}
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                justifyContent: flipX ? "flex-end" : "flex-start",
                alignItems: flipY ? "flex-start" : "flex-end",
              }}
            >
              <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white/95 px-2 py-1 font-mono text-[11px] leading-none text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {badge && (
                  <span className="rounded bg-emerald-500/15 px-1 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    {badge}
                  </span>
                )}
                <span>
                  ({xText}, {yText})
                </span>
                {paramText && (
                  <span className="text-slate-400 dark:text-slate-500">· {paramText}</span>
                )}
              </div>
            </div>
          </foreignObject>
        </g>
        </React.Fragment>
      );
    }
  }

  // The anchor is always mounted: it's how the pointer is mapped into the SVG.
  return <g ref={anchorRef}>{content}</g>;
};
