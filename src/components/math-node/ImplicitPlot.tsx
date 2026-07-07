import React, { useMemo } from "react";
import { usePaneContext } from "mafs";
import { Line } from "mafs";
import { det } from "mathjs";
import { getStrokeDasharray } from "./mathTypes";

interface ImplicitPlotProps {
  compiledLHS: any;
  compiledRHS: any;
  baseScope: any;
  color: string;
  weight?: number;
  opacity?: number;
  tx?: number;
  ty?: number;
  rot?: number;
  scaleX?: number;
  scaleY?: number;
  px?: number;
  py?: number;
  lineStyle?: string;
  samplingDepth?: number;
  id?: string;
  dependenciesHash?: string;
}

export const ImplicitPlot: React.FC<ImplicitPlotProps> = ({
  compiledLHS,
  compiledRHS,
  baseScope,
  color,
  weight = 3,
  opacity = 1,
  tx = 0,
  ty = 0,
  rot = 0,
  scaleX = 1,
  scaleY = 1,
  px = 0,
  py = 0,
  lineStyle,
  samplingDepth = 14,
  id,
  dependenciesHash,
}) => {
  let xRange: [number, number] = [-10, 10];
  let yRange: [number, number] = [-10, 10];

  const pane = usePaneContext();
  if (pane && pane.xPaneRange && pane.yPaneRange) {
    xRange = pane.xPaneRange;
    yRange = pane.yPaneRange;
  }

  const GRID_SIZE = Math.max(20, Math.min(200, samplingDepth * 6));

  const segments = useMemo(() => {
    if (!compiledLHS) return [];

    const xMin = xRange[0];
    const xMax = xRange[1];
    const yMin = yRange[0];
    const yMax = yRange[1];

    const dx = (xMax - xMin) / GRID_SIZE;
    const dy = (yMax - yMin) / GRID_SIZE;

    const evalF = (x: number, y: number): number => {
      try {
        let lx = x - tx - px;
        let ly = y - ty - py;
        const nx = lx * Math.cos(-rot) - ly * Math.sin(-rot);
        const ny = lx * Math.sin(-rot) + ly * Math.cos(-rot);
        const sx = nx / scaleX + px;
        const sy = ny / scaleY + py;

        const scope = { ...baseScope, x: sx, y: sy };

        let lhsVal = compiledLHS.evaluate(scope);
        let rhsVal = compiledRHS ? compiledRHS.evaluate(scope) : 0;

        const isMatrixLike = (val: any) => {
          if (!val) return false;
          if (Array.isArray(val)) return true;
          if (typeof val === "object" && (val.isMatrix || val.constructor?.name === "Matrix" || Array.isArray(val.toArray?.()))) return true;
          return false;
        };

        if (isMatrixLike(lhsVal)) {
          try { lhsVal = det(lhsVal); } catch {}
        }
        if (isMatrixLike(rhsVal)) {
          try { rhsVal = det(rhsVal); } catch {}
        }

        const lhs = Number(lhsVal);
        const rhs = Number(rhsVal);
        return lhs - rhs;
      } catch {
        return NaN;
      }
    };

    const grid: number[][] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      grid[i] = [];
      const x = xMin + i * dx;
      for (let j = 0; j <= GRID_SIZE; j++) {
        const y = yMin + j * dy;
        grid[i][j] = evalF(x, y);
      }
    }

    const localSegments: { p1: [number, number]; p2: [number, number] }[] = [];

    const lerp = (p1: [number, number], p2: [number, number], val1: number, val2: number): [number, number] => {
      if (Math.abs(val1 - val2) < 1e-9) return p1;
      const t = -val1 / (val2 - val1);
      const clampedT = Math.max(0, Math.min(1, t));
      return [
        p1[0] + clampedT * (p2[0] - p1[0]),
        p1[1] + clampedT * (p2[1] - p1[1]),
      ];
    };

    for (let i = 0; i < GRID_SIZE; i++) {
      const x0 = xMin + i * dx;
      const x1 = x0 + dx;
      for (let j = 0; j < GRID_SIZE; j++) {
        const y0 = yMin + j * dy;
        const y1 = y0 + dy;

        const v00 = grid[i][j];
        const v10 = grid[i + 1][j];
        const v11 = grid[i + 1][j + 1];
        const v01 = grid[i][j + 1];

        if (isNaN(v00) || isNaN(v10) || isNaN(v11) || isNaN(v01)) continue;

        const s0 = v00 >= 0 ? 1 : 0;
        const s1 = v10 >= 0 ? 1 : 0;
        const s2 = v11 >= 0 ? 1 : 0;
        const s3 = v01 >= 0 ? 1 : 0;

        const index = (s0 << 3) | (s1 << 2) | (s2 << 1) | s3;

        if (index === 0 || index === 15) continue;

        const p00: [number, number] = [x0, y0];
        const p10: [number, number] = [x1, y0];
        const p11: [number, number] = [x1, y1];
        const p01: [number, number] = [x0, y1];

        const getEdgePoint = (edge: number): [number, number] => {
          switch (edge) {
            case 0: return lerp(p00, p10, v00, v10);
            case 1: return lerp(p10, p11, v10, v11);
            case 2: return lerp(p01, p11, v01, v11);
            case 3: return lerp(p00, p01, v00, v01);
            default: return p00;
          }
        };

        const addSegment = (e1: number, e2: number) => {
          localSegments.push({ p1: getEdgePoint(e1), p2: getEdgePoint(e2) });
        };

        switch (index) {
          case 1: addSegment(2, 3); break;
          case 2: addSegment(1, 2); break;
          case 3: addSegment(1, 3); break;
          case 4: addSegment(0, 1); break;
          case 5: addSegment(0, 3); addSegment(1, 2); break;
          case 6: addSegment(0, 2); break;
          case 7: addSegment(0, 3); break;
          case 8: addSegment(0, 3); break;
          case 9: addSegment(0, 2); break;
          case 10: addSegment(0, 1); addSegment(2, 3); break;
          case 11: addSegment(0, 1); break;
          case 12: addSegment(1, 3); break;
          case 13: addSegment(1, 2); break;
          case 14: addSegment(2, 3); break;
        }
      }
    }

    return localSegments;
  }, [
    compiledLHS, compiledRHS, dependenciesHash || baseScope, samplingDepth,
    xRange[0], xRange[1], yRange[0], yRange[1],
    tx, ty, px, py, rot, scaleX, scaleY,
  ]);

  const isSpecialDashed = lineStyle && lineStyle !== "solid";
  const customDashPattern = getStrokeDasharray(lineStyle);

  const renderedSegments = segments.map((s, idx) => (
    <Line.Segment
      key={idx}
      point1={s.p1}
      point2={s.p2}
      color={color}
      weight={weight}
      opacity={opacity}
      style={isSpecialDashed ? "dashed" : "solid"}
    />
  ));

  return (
    <React.Fragment>
      {isSpecialDashed ? (
        <g style={{ "--mafs-line-stroke-dash-style": customDashPattern } as React.CSSProperties}>
          {renderedSegments}
        </g>
      ) : (
        renderedSegments
      )}
    </React.Fragment>
  );
};
