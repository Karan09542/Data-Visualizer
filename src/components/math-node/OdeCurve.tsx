import React, { useEffect, useMemo } from "react";
import { Point } from "mafs";
import { sampleOdeAt, type OdeSolution } from "../../lib/math/odeSolver";
import {
  buildOdePath,
  computeOdeExtent,
  odePlaybackTime,
  setOdeExtent,
  solveCompiledOde,
  solveCompiledOdeCached,
} from "../../lib/math/odeCurveData";
import { DEFAULT_IMAGE_WIDTH, PointImage } from "./PointImage";
import type { CompiledOde } from "./mathTypes";

type Vec2 = [number, number];

interface OdeCurveProps {
  /** Function id, so the transform gizmos can find this curve's extent. */
  id?: string;
  compiledOde: CompiledOde;
  /** Per-function scope: variables, time, helpers. */
  scope: any;
  /** Changes whenever the solution could change; the solve is cached on it. */
  sampleKey: string;
  /**
   * Key for the shared solve cache. Rows that follow this solution through the scope
   * solve with the same key, so the work is done once.
   */
  solveKey?: string;
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
  /** Draw this picture at the marker instead of a plain dot. */
  markerImage?: string;
  markerImageWidth?: number;
  markerImageHeight?: number;
  /** Translate/rotate/scale from the function's transform gizmos. */
  transform?: (p: Vec2) => Vec2;
}

const isFiniteAll = (...values: number[]) => values.every((v) => Number.isFinite(v));

export const OdeCurve: React.FC<OdeCurveProps> = ({
  id,
  compiledOde,
  scope,
  sampleKey,
  solveKey,
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
  markerImage,
  markerImageWidth,
  markerImageHeight,
  transform,
}) => {
  const system = compiledOde?.system;
  const stateCount = system?.states.length ?? 0;
  const t0 = tRange?.[0] ?? system?.t0 ?? 0;
  const t1 = tRange?.[1] ?? (system?.t0 ?? 0) + 10;

  const solution = useMemo<OdeSolution | null>(() => {
    if (!system || stateCount === 0) return null;
    if (solveKey) {
      return solveCompiledOdeCached(
        solveKey,
        system,
        compiledOde.derivatives,
        compiledOde.initials,
        scope,
        [t0, t1],
        steps,
      );
    }
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
  }, [sampleKey, solveKey, t0, t1, steps, stateCount]);

  const [axisX, axisY] = axes ?? ["t", system?.states[0]?.display ?? "t"];

  const d = useMemo(
    () => (solution && system ? buildOdePath(solution, system, axisX, axisY, transform) : ""),
    // `transform` is a fresh closure each render; sampleKey covers its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solution, system, axisX, axisY, sampleKey],
  );

  // Publish where the solution lies so the transform handles can be placed around it.
  useEffect(() => {
    if (!id || !solution || !system) return;
    const extent = computeOdeExtent(solution, system, axisX, axisY);
    if (extent) setOdeExtent(id, extent);
  }, [id, solution, system, axisX, axisY]);

  const marker = useMemo<Vec2 | null>(() => {
    if (!animate || !solution || !system) return null;
    // Loop the playback over the solved interval; works for negative times too.
    const looped = odePlaybackTime(markerTime, t0, t1);
    if (!Number.isFinite(looped)) return null;
    const states = sampleOdeAt(solution, looped);
    if (!states) return null;
    const pick = (axis: string) => {
      if (axis === "t") return looped;
      const index = system.states.findIndex((s) => s.display === axis);
      return index < 0 ? NaN : states[index];
    };
    const mx = pick(axisX);
    const my = pick(axisY);
    if (!isFiniteAll(mx, my)) return null;
    const placed = transform ? transform([mx, my]) : ([mx, my] as Vec2);
    return isFiniteAll(placed[0], placed[1]) ? placed : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, solution, system, markerTime, t0, t1, axisX, axisY, sampleKey]);

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
      {marker &&
        (markerImage ? (
          <PointImage
            src={markerImage}
            at={marker}
            width={markerImageWidth ?? DEFAULT_IMAGE_WIDTH}
            height={markerImageHeight ?? DEFAULT_IMAGE_WIDTH}
          />
        ) : (
          <Point x={marker[0]} y={marker[1]} color={color} />
        ))}
    </React.Fragment>
  );
};
