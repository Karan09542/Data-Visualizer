import React, { useContext, useEffect, useMemo } from "react";
import { usePaneContext, useTransformContext, vec } from "mafs";
import { definiteArea, type Vec2 } from "./areaMath";
import { setIntegral } from "./measureStore";
import { TraceScopeContext } from "./traceGeometry";

/** A number for a readout: up to 4 decimals, no trailing zeros, exponent when extreme. */
export function formatMeasure(v: number): string {
  if (!Number.isFinite(v)) return "undefined";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return v.toExponential(3).replace(/\.?0+e/, "e");
  const s = v.toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

interface IntegralShadeProps {
  id: string;
  color: string;
  /** The row's function, y = f(x). */
  f: (x: number) => number;
  /** What it's measured against; the x-axis when absent. */
  g?: (x: number) => number;
  againstName: string;
  from: number;
  to: number;
  /** Changes whenever f or g could; results are cached on it. */
  cacheKey: string;
}

/**
 * Shades the area between y = f(x) and the x-axis (or another curve) from `from`
 * to `to`, and labels it with the definite integral.
 */
export function IntegralShade({ id, color, f, g, againstName, from, to, cacheKey }: IntegralShadeProps) {
  const scope = useContext(TraceScopeContext);
  const { viewTransform } = useTransformContext();
  const pane = usePaneContext();
  const [y0, y1] = pane?.yPaneRange ?? [-10, 10];
  const clampY = (y: number) => Math.max(y0 - 1e4, Math.min(y1 + 1e4, y));

  const result = useMemo(() => {
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return null;
    const diff = (x: number) => {
      const top = f(x);
      const base = g ? g(x) : 0;
      return top - base;
    };
    const { signed, area } = definiteArea(diff, from, to);

    // The shaded shape: along f from left to right, back along g, split wherever
    // either is undefined.
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const N = 320;
    const runs: { top: Vec2[]; base: Vec2[] }[] = [];
    let run: { top: Vec2[]; base: Vec2[] } | null = null;
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N;
      const top = f(x);
      const base = g ? g(x) : 0;
      if (Number.isFinite(top) && Number.isFinite(base)) {
        if (!run) runs.push((run = { top: [], base: [] }));
        run.top.push([x, clampY(top)]);
        run.base.push([x, clampY(base)]);
      } else run = null;
    }
    const d = runs
      .filter((r) => r.top.length > 1)
      .map(
        (r) =>
          `M${r.top.map(([x, y]) => `${x} ${y}`).join("L")}L${[...r.base]
            .reverse()
            .map(([x, y]) => `${x} ${y}`)
            .join("L")}Z`,
      )
      .join("");

    const mid = (lo + hi) / 2;
    const midTop = f(mid);
    const midBase = g ? g(mid) : 0;
    const label: Vec2 | null =
      Number.isFinite(midTop) && Number.isFinite(midBase) ? [mid, (midTop + midBase) / 2] : null;

    const edge = (x: number): [Vec2, Vec2] | null => {
      const t = f(x);
      const b = g ? g(x) : 0;
      return Number.isFinite(t) && Number.isFinite(b) ? [[x, clampY(b)], [x, clampY(t)]] : null;
    };
    return { signed, area, d, label, edges: [edge(lo), edge(hi)] };
    // f and g are fresh closures each render; cacheKey stands in for them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, from, to, y0, y1]);

  useEffect(() => {
    setIntegral(
      scope,
      id,
      result ? { from, to, signed: result.signed, area: result.area, against: againstName } : null,
    );
  }, [scope, id, result, from, to, againstName]);

  useEffect(() => () => setIntegral(scope, id, null), [scope, id]);

  if (!result) return null;
  const labelPx = result.label ? (vec.transform(result.label, viewTransform) as Vec2) : null;

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Colours as inline styles: Mafs's stylesheet overrides SVG attributes. */}
      <path
        d={result.d}
        style={{ fill: color, fillOpacity: 0.18, stroke: "none", transform: "var(--mafs-view-transform)" }}
      />
      {result.edges.map((e, i) =>
        e ? (
          <line
            key={i}
            x1={e[0][0]}
            y1={e[0][1]}
            x2={e[1][0]}
            y2={e[1][1]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            style={{ stroke: color, transform: "var(--mafs-view-transform)" }}
          />
        ) : null,
      )}
      {labelPx && (
        <text
          x={labelPx[0]}
          y={labelPx[1]}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          strokeWidth={3.5}
          paintOrder="stroke"
          style={{ fill: color, stroke: "var(--mafs-bg, #fff)", fontVariantNumeric: "tabular-nums" }}
        >
          {Math.abs(result.signed - result.area) < 1e-9
            ? `Area = ${formatMeasure(result.area)}`
            : `∫ = ${formatMeasure(result.signed)} · area ${formatMeasure(result.area)}`}
        </text>
      )}
    </g>
  );
}
