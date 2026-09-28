import React, { useState, useSyncExternalStore } from "react";
import { Crosshair } from "lucide-react";
import {
  formatTraceNumber,
  interceptsForFunction,
  requestTracePin,
  subscribeTraceShapesSlow,
  traceShapesSlowVersion,
  type TraceIntercept,
} from "./traceGeometry";

/** Chips shown per list before collapsing the rest behind "+N". */
const VISIBLE = 6;

const fmt = (v: number) => formatTraceNumber(v, 1e4);

const Chips: React.FC<{
  scope: string;
  items: TraceIntercept[];
  value: (p: TraceIntercept) => string;
  title: (p: TraceIntercept) => string;
}> = ({ scope, items, value, title }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, VISIBLE);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((p, i) => (
        <button
          key={i}
          type="button"
          onClick={() => requestTracePin(p, scope)}
          title={title(p)}
          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:text-emerald-400"
        >
          {value(p)}
        </button>
      ))}
      {items.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="px-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {expanded ? "less" : `+${items.length - VISIBLE}`}
        </button>
      )}
    </div>
  );
};

/**
 * Where a row's graph crosses the axes: its roots (x-axis) and y-axis crossings,
 * found on the drawn geometry, so it covers every kind of equation. Clicking one
 * places the trace point there.
 */
export const InterceptsReadout: React.FC<{ fnId: string; scope?: string }> = ({
  fnId,
  scope = "",
}) => {
  // Refreshed a few times a second while the graph changes (a slider, a pan,
  // animation) and once more when it settles — never every frame.
  useSyncExternalStore(subscribeTraceShapesSlow, traceShapesSlowVersion, traceShapesSlowVersion);
  const { roots, yIntercepts } = interceptsForFunction(fnId, scope);
  if (roots.length === 0 && yIntercepts.length === 0) return null;

  return (
    <div
      className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40 nodrag"
      title="Axis crossings within the current view"
    >
      {roots.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="flex w-20 shrink-0 items-center gap-1.5 pt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Crosshair size={12} className="text-emerald-500" />
            Roots
            <span className="rounded bg-slate-200 px-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {roots.length}
            </span>
          </span>
          <Chips
            scope={scope}
            items={roots}
            value={(p) => `x = ${fmt(p.x)}`}
            title={(p) => `Root at (${fmt(p.x)}, 0) — click to show it on the graph`}
          />
        </div>
      )}
      {yIntercepts.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="flex w-20 shrink-0 items-center gap-1.5 pt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Crosshair size={12} className="text-sky-500" />
            y-int
          </span>
          <Chips
            scope={scope}
            items={yIntercepts}
            value={(p) => `y = ${fmt(p.y)}`}
            title={(p) => `Crosses the y-axis at (0, ${fmt(p.y)}) — click to show it on the graph`}
          />
        </div>
      )}
    </div>
  );
};
