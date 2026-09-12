import React, { useMemo } from "react";
import { Point } from "mafs";
import { sampleOdeAt, type OdeSolution } from "../../lib/math/odeSolver";
import { buildOdePath, solveCompiledOde } from "../../lib/math/odeCurveData";
import type { CompiledOde } from "./mathTypes";

type Vec2 = [number, number];

interface OdeCurveProps {
  compiledOde: CompiledOde;
  /** Per-function scope: variables, time, helpers. */
  scope: any;
  /** Changes whenever the solution could change; the solve is cached on it. */
  sampleKey: string;
  tRange?: [number, number];
  steps?: number;
  /** Which quantities go on each axis: "t" or a state's display name (x, x', …). */
  axes?: [string, string];
  color?: string;
  weight?: number;
  opacity?: number;
  style?: "solid" | "dashed";
  svgPathProps?: React.SVGProps<SVGPathElement>;
  /** Draw a dot at the current time. */
  animate?: boolean;
  markerTime?: number;
}

const isFiniteAll = (...values: number[]) => values.every((v) => Number.isFinite(v));

export const OdeCurve: React.FC<OdeCurveProps> = ({
  compiledOde,
  scope,
  sampleKey,
  tRange,
  steps = 1000,
  axes,
  color,
  weight = 3,
  opacity = 1,
  style = "solid",
  svgPathProps = {},
  animate = false,
  markerTime = 0,
}) => {
  const system = compiledOde?.system;
  const stateCount = system?.states.length ?? 0;
  const t0 = tRange?.[0] ?? system?.t0 ?? 0;
  const t1 = tRange?.[1] ?? (system?.t0 ?? 0) + 10;

  const solution = useMemo<OdeSolution | null>(() => {
    if (!system || stateCount === 0) return null;
    return solveCompiledOde(
      system,
      compiledOde.derivatives,
      compiledOde.initials,
      scope,
      [t0, t1],
      steps,
    );
    // `scope` is covered by sampleKey (see dependencyKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey, t0, t1, steps, stateCount]);

  const [axisX, axisY] = axes ?? ["t", system?.states[0]?.display ?? "t"];

  const d = useMemo(
    () => (solution && system ? buildOdePath(solution, system, axisX, axisY) : ""),
    [solution, system, axisX, axisY],
  );

  const marker = useMemo<Vec2 | null>(() => {
    if (!animate || !solution || !system) return null;
    const span = t1 - t0;
    if (!(span > 0)) return null;
    // Loop the playback over the solved interval; works for negative times too.
    const looped = t0 + (((markerTime - t0) % span) + span) % span;
    const states = sampleOdeAt(solution, looped);
    if (!states) return null;
    const pick = (axis: string) => {
      if (axis === "t") return looped;
      const index = system.states.findIndex((s) => s.display === axis);
      return index < 0 ? NaN : states[index];
    };
    const mx = pick(axisX);
    const my = pick(axisY);
    return isFiniteAll(mx, my) ? [mx, my] : null;
  }, [animate, solution, system, markerTime, t0, t1, axisX, axisY]);

  if (!d) return null;

  return (
    <React.Fragment>
      <path
        d={d}
        strokeWidth={weight}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...svgPathProps}
        style={{
          stroke: color || "var(--mafs-fg)",
          strokeOpacity: opacity,
          strokeDasharray: style === "dashed" ? "var(--mafs-line-stroke-dash-style)" : undefined,
          vectorEffect: "non-scaling-stroke",
          transform: "var(--mafs-view-transform)",
          ...(svgPathProps.style || {}),
        }}
      />
      {marker && <Point x={marker[0]} y={marker[1]} color={color} />}
    </React.Fragment>
  );
};
