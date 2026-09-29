import React, { useContext, useEffect, useRef, useState } from "react";
import { usePaneContext, useTransformContext, vec } from "mafs";
import { measureRegion, regionPath, type Vec2 } from "./areaMath";
import { formatMeasure } from "./IntegralShade";
import {
  TraceScopeContext,
  collectSegments,
  subscribeTraceShapes,
} from "./traceGeometry";

const COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6"];
/** Movement that turns a click into a pan. */
const TAP_SLOP_PX = 8;

/** Cells across a region's own grid (its longer side, margin included). */
const HOME_CELLS = 400;

type Box = { x0: number; x1: number; y0: number; y1: number };

const contains = (outer: Box, inner: Box) =>
  inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1;

/** A grid around the region with room to spare, for it to be re-measured on. */
const homeFor = (b: Box): Box => {
  const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.25;
  return { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m };
};

const homeCells = (w: Box) => (HOME_CELLS * (w.x1 - w.x0)) / Math.max(w.x1 - w.x0, w.y1 - w.y0);

interface Region {
  id: number;
  seed: Vec2;
  color: string;
  area: number | null; // null: the click was on a curve
  closed: boolean;
  path: string;
  labelAt: Vec2;
  /**
   * The region's own grid, fixed in graph coordinates once it's found closed.
   * It's re-measured on this rather than on the view's grid, so zooming and
   * panning don't change the result.
   */
  home?: Box;
  /** Its extent when last measured. */
  bounds?: Box;
}

interface AreaToolProps {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Treat the x- and y-axes as boundaries too (e.g. the area under a curve). */
  axesAsWalls: boolean;
  /** Changing this clears every measured region. */
  clearSignal: number;
  onCountChange?: (count: number) => void;
}

/**
 * Click inside any closed region of the graph to measure its area. The region is
 * bounded by whatever is drawn: curves, implicit curves, polygons, segments.
 */
export function AreaTool({ active, containerRef, axesAsWalls, clearSignal, onCountChange }: AreaToolProps) {
  const scope = useContext(TraceScopeContext);
  const { viewTransform } = useTransformContext();
  const anchorRef = useRef<SVGGElement>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const nextId = useRef(1);
  const live = useRef({ viewTransform, axesAsWalls, active });
  live.current = { viewTransform, axesAsWalls, active };

  useEffect(() => setRegions([]), [clearSignal]);
  useEffect(() => onCountChange?.(regions.length), [regions.length, onCountChange]);

  const walls = (window: Box) => {
    const segs = collectSegments(scope);
    if (live.current.axesAsWalls) {
      const pad = Math.max(window.x1 - window.x0, window.y1 - window.y0) * 10;
      segs.push(window.x0 - pad, 0, window.x1 + pad, 0, 0, window.y0 - pad, 0, window.y1 + pad);
    }
    return segs;
  };

  /**
   * Measures (or re-measures) a region.
   *
   * It's found in the visible part of the graph, then measured on a grid of its
   * own around it, fixed in graph coordinates — later re-measures (a slider, an
   * animation) use that same grid, so the result doesn't depend on the zoom.
   * While part of it is off screen, the curves there may not be drawn, so the
   * last result is kept.
   *
   * A first click right on a curve reports that. Later, when a moving curve
   * passes over the click point, the point is nudged to the nearest free cell,
   * and if that fails the last result is kept — rather than the label flipping to
   * "on a curve".
   */
  const measure = (r: Pick<Region, "id" | "seed" | "color"> & Partial<Region>, firstTime = false): Region => {
    const previous = !firstTime && r.path !== undefined ? (r as Region) : null;
    const nudge = firstTime ? 1 : 4;
    const view = visibleWindow();

    if (previous?.home && previous.bounds) {
      if (!view || !contains(view.window, previous.bounds)) return previous;
      const result = measureRegion(walls(previous.home), previous.home, r.seed, homeCells(previous.home), 6, nudge);
      if (!result) return previous;
      if (result.closed) {
        return { ...previous, area: result.area, path: regionPath(result), labelAt: result.labelAt, bounds: result.bounds };
      }
      // It grew past its grid, or opened up: look for it in the view again.
    }

    const [sx, sy] = r.seed;
    if (!view || sx < view.window.x0 || sx > view.window.x1 || sy < view.window.y0 || sy > view.window.y1) {
      return previous ?? { ...r, area: null, closed: false, path: "", labelAt: r.seed };
    }
    // About two screen pixels per cell, within sensible bounds.
    const cellsAcross = Math.max(200, Math.min(600, Math.round(view.widthPx / 2)));
    const found = measureRegion(walls(view.window), view.window, r.seed, cellsAcross, 6, nudge);
    if (!found) return previous ?? { ...r, area: null, closed: false, path: "", labelAt: r.seed };
    if (!found.closed) {
      return { ...r, area: found.area, closed: false, path: "", labelAt: found.labelAt, home: undefined, bounds: undefined };
    }

    const home = homeFor(found.bounds);
    const onHome = measureRegion(walls(home), home, r.seed, homeCells(home), 6, nudge);
    const result = onHome?.closed ? onHome : found;
    return {
      ...r,
      area: result.area,
      closed: true,
      path: regionPath(result),
      labelAt: result.labelAt,
      home: onHome?.closed ? home : undefined,
      bounds: result.bounds,
    };
  };

  // Keep measured regions in step with the curves (sliders, edits, animation):
  // re-measured each frame they change, within a time budget, taking turns when
  // there are many, so animation stays smooth.
  const turn = useRef(0);
  useEffect(
    () =>
      subscribeTraceShapes(() => {
        setRegions((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          const budgetMs = 8;
          const t0 = performance.now();
          for (let k = 0; k < next.length; k++) {
            const i = (turn.current + k) % next.length;
            next[i] = measure(next[i]);
            if (performance.now() - t0 > budgetMs) {
              turn.current = i + 1;
              return next;
            }
          }
          return next;
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope],
  );

  // And once the view settles after a zoom or pan: a region that wasn't closed
  // within the view may be now.
  const pane = usePaneContext();
  const viewKey = `${viewTransform.join()}|${pane?.xPaneRange?.join()}|${pane?.yPaneRange?.join()}`;
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setRegions((prev) => (prev.some((r) => r.area !== null && !r.closed) ? prev.map((r) => measure(r)) : prev));
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  // And when the axes toggle changes.
  useEffect(() => {
    setRegions((prev) => (prev.length ? prev.map((r) => measure(r)) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axesAsWalls]);

  // The visible part of the graph, and how many screen pixels it spans.
  const visibleWindow = () => {
    const svg = anchorRef.current?.ownerSVGElement;
    const box = svg?.viewBox?.baseVal;
    const [a, , , , d] = live.current.viewTransform;
    if (!box || !a || !d) return null;
    const x0 = box.x / a;
    const x1 = (box.x + box.width) / a;
    const ya = box.y / d;
    const yb = (box.y + box.height) / d;
    return {
      window: { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(ya, yb), y1: Math.max(ya, yb) },
      widthPx: box.width,
    };
  };

  const toWorld = (clientX: number, clientY: number): Vec2 | null => {
    const svg = anchorRef.current?.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    const inverse = vec.matrixInvert(live.current.viewTransform);
    if (!svg || !ctm || !inverse) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return vec.transform([p.x, p.y], inverse) as Vec2;
  };

  // Clicks and taps on the graph while the tool is on.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !active) return;
    let start: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      const overUI = e.target instanceof Element && e.target.closest("[data-no-trace]");
      start = overUI ? null : { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const from = start;
      start = null;
      if (!from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX) return;
      const seed = toWorld(e.clientX, e.clientY);
      if (!seed || !visibleWindow()) return;
      const id = nextId.current++;
      const region = measure({ id, seed, color: COLORS[(id - 1) % COLORS.length] }, true);
      setRegions((prev) => [...prev.slice(-11), region]);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef, scope]);

  return (
    <g ref={anchorRef}>
      {regions.map((r) => {
        const [lx, ly] = vec.transform(r.labelAt, viewTransform) as Vec2;
        const text =
          r.area === null
            ? "On a curve — click inside a region"
            : r.closed
              ? `Area ≈ ${formatMeasure(r.area)}`
              : "Not closed within the view";
        return (
          <g key={r.id}>
            {r.path && (
              <path
                d={r.path}
                style={{
                  // Inline: Mafs's stylesheet outlines every path with the text colour,
                  // which beats attributes (and scaled up to the screen, that outline
                  // covered the whole region).
                  fill: r.color,
                  fillOpacity: 0.22,
                  stroke: "none",
                  transform: "var(--mafs-view-transform)",
                  pointerEvents: "none",
                }}
              />
            )}
            <foreignObject x={lx - 110} y={ly - 14} width={220} height={28} style={{ overflow: "visible" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                  data-no-trace
                  className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md border bg-white/95 dark:bg-slate-900/95 shadow-md text-[11px] font-medium tabular-nums whitespace-nowrap"
                  style={{
                    borderColor: r.area !== null && r.closed ? r.color : "#f59e0b",
                    color: r.area !== null && r.closed ? r.color : "#d97706",
                  }}
                >
                  {text}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegions((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                    className="h-4 w-4 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}
