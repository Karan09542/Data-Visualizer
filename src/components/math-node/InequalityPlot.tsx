import React, { useMemo, useEffect } from "react";
import { usePaneContext, useTransformContext } from "mafs";
import { det } from "mathjs";
import { getStrokeDasharray } from "./mathTypes";
import type { FillPatternType } from "./mathTypes";

interface InequalityPlotProps {
  compiledLHS: any;
  compiledRHS: any;
  operator: string;
  baseScope: any;
  color: string;
  weight?: number;
  fillColor?: string;
  fillOpacity?: number;
  fillPattern?: FillPatternType;
  patternSpacing?: number;
  patternThickness?: number;
  patternAngle?: number;
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
  onNoSolution?: (id: string, noSolution: boolean) => void;
}

export const InequalityPlot: React.FC<InequalityPlotProps> = ({
  compiledLHS,
  compiledRHS,
  operator,
  baseScope,
  color,
  weight = 3,
  fillColor,
  fillOpacity = 0.3,
  fillPattern = "hatch-diagonal",
  patternSpacing,
  patternThickness,
  patternAngle,
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
  onNoSolution,
}) => {
  let xRange: [number, number] = [-10, 10];
  let yRange: [number, number] = [-10, 10];

  const pane = usePaneContext();
  if (pane && pane.xPaneRange && pane.yPaneRange) {
    xRange = pane.xPaneRange;
    yRange = pane.yPaneRange;
  }

  const patternId = `pattern-${id || Math.random().toString(36).substring(2)}`;
  const maskId = `mask-${id || Math.random().toString(36).substring(2)}`;

  const paths = useMemo(() => {
    if (!compiledLHS) return { fill: "", boundary: "" };

    const GRID_SIZE = Math.max(40, Math.min(300, samplingDepth * 8));
    const xMin = xRange[0];
    const xMax = xRange[1];
    const yMin = yRange[0];
    const yMax = yRange[1];

    const dx = (xMax - xMin) / GRID_SIZE;
    const dy = (yMax - yMin) / GRID_SIZE;

    const isInside = (val: number) => {
      if (isNaN(val)) return false;
      if (operator === "<" || operator === "<=") return val < 0;
      if (operator === ">" || operator === ">=") return val > 0;
      if (operator === "=") return val < 0;
      return val === 0;
    };

    let fillPath = "";
    const scope = { ...baseScope, x: 0, y: 0 };
    if (operator && !(operator === "=" && fillColor === undefined)) {
      for (let j = 0; j <= GRID_SIZE; j++) {
        const y = yMin + j * dy;
        let xStart: number | null = null;

        for (let i = 0; i <= GRID_SIZE; i++) {
          const x = xMin + i * dx;

          // Inverse Transform for Inequality
          let lx = x - tx - px;
          let ly = y - ty - py;
          const nx = lx * Math.cos(-rot) - ly * Math.sin(-rot);
          const ny = lx * Math.sin(-rot) + ly * Math.cos(-rot);
          scope.x = nx / scaleX + px;
          scope.y = ny / scaleY + py;

          let l;
          try { l = compiledLHS.evaluate(scope); } catch { l = NaN; }
          if (l && (l.isMatrix || Array.isArray(l))) {
            try { l = det(l); } catch { l = NaN; }
          }
          let r;
          if (compiledRHS) {
            try { r = compiledRHS.evaluate(scope); } catch { r = NaN; }
          } else { r = 0; }
          if (r && (r.isMatrix || Array.isArray(r))) {
            try { r = det(r); } catch { r = NaN; }
          }
          const val = Number(l) - Number(r);
          const inside = isInside(val);

          if (inside && xStart === null) xStart = x;
          else if (!inside && xStart !== null) {
            fillPath += `M ${xStart - dx / 2} ${y - dy / 2} L ${x - dx / 2} ${y - dy / 2} L ${x - dx / 2} ${y + dy / 2} L ${xStart - dx / 2} ${y + dy / 2} Z `;
            xStart = null;
          }
        }
        if (xStart !== null)
          fillPath += `M ${xStart - dx / 2} ${y - dy / 2} L ${xMax + dx / 2} ${y - dy / 2} L ${xMax + dx / 2} ${y + dy / 2} L ${xStart - dx / 2} ${y + dy / 2} Z `;
      }
    }

    // Boundary using marching squares
    let boundaryPath = "";
    const grid = new Float32Array((GRID_SIZE + 1) * (GRID_SIZE + 1));
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = xMin + i * dx;
      for (let j = 0; j <= GRID_SIZE; j++) {
        const y = yMin + j * dy;
        let lx = x - tx - px;
        let ly = y - ty - py;
        const nx = lx * Math.cos(-rot) - ly * Math.sin(-rot);
        const ny = lx * Math.sin(-rot) + ly * Math.cos(-rot);
        scope.x = nx / scaleX + px;
        scope.y = ny / scaleY + py;

        let l;
        try { l = compiledLHS.evaluate(scope); } catch { l = NaN; }
        if (l && (l.isMatrix || Array.isArray(l))) {
          try { l = det(l); } catch { l = NaN; }
        }
        let r;
        if (compiledRHS) {
          try { r = compiledRHS.evaluate(scope); } catch { r = NaN; }
        } else { r = 0; }
        if (r && (r.isMatrix || Array.isArray(r))) {
          try { r = det(r); } catch { r = NaN; }
        }
        grid[i * (GRID_SIZE + 1) + j] = Number(l) - Number(r);
      }
    }

    const lerp = (p1: number[], p2: number[], val1: number, val2: number) => {
      if (isNaN(val1) || isNaN(val2)) return p1;
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

        const v00 = grid[i * (GRID_SIZE + 1) + j];
        const v10 = grid[(i + 1) * (GRID_SIZE + 1) + j];
        const v11 = grid[(i + 1) * (GRID_SIZE + 1) + (j + 1)];
        const v01 = grid[i * (GRID_SIZE + 1) + (j + 1)];

        if (isNaN(v00) || isNaN(v10) || isNaN(v11) || isNaN(v01)) continue;

        const b00 = v00 > 0 ? 1 : 0;
        const b10 = v10 > 0 ? 1 : 0;
        const b11 = v11 > 0 ? 1 : 0;
        const b01 = v01 > 0 ? 1 : 0;

        const index = (b01 << 3) | (b11 << 2) | (b10 << 1) | b00;
        if (index === 0 || index === 15) continue;

        const p00 = [x0, y0];
        const p10 = [x1, y0];
        const p11 = [x1, y1];
        const p01 = [x0, y1];

        const e0 = lerp(p00, p10, v00, v10);
        const e1 = lerp(p10, p11, v10, v11);
        const e2 = lerp(p01, p11, v01, v11);
        const e3 = lerp(p00, p01, v00, v01);

        switch (index) {
          case 1: boundaryPath += `M${e0[0]},${e0[1]} L${e3[0]},${e3[1]} `; break;
          case 2: boundaryPath += `M${e1[0]},${e1[1]} L${e0[0]},${e0[1]} `; break;
          case 3: boundaryPath += `M${e1[0]},${e1[1]} L${e3[0]},${e3[1]} `; break;
          case 4: boundaryPath += `M${e2[0]},${e2[1]} L${e1[0]},${e1[1]} `; break;
          case 5: boundaryPath += `M${e0[0]},${e0[1]} L${e1[0]},${e1[1]} M${e2[0]},${e2[1]} L${e3[0]},${e3[1]} `; break;
          case 6: boundaryPath += `M${e2[0]},${e2[1]} L${e0[0]},${e0[1]} `; break;
          case 7: boundaryPath += `M${e2[0]},${e2[1]} L${e3[0]},${e3[1]} `; break;
          case 8: boundaryPath += `M${e3[0]},${e3[1]} L${e2[0]},${e2[1]} `; break;
          case 9: boundaryPath += `M${e0[0]},${e0[1]} L${e2[0]},${e2[1]} `; break;
          case 10: boundaryPath += `M${e1[0]},${e1[1]} L${e2[0]},${e2[1]} M${e3[0]},${e3[1]} L${e0[0]},${e0[1]} `; break;
          case 11: boundaryPath += `M${e1[0]},${e1[1]} L${e2[0]},${e2[1]} `; break;
          case 12: boundaryPath += `M${e3[0]},${e3[1]} L${e1[0]},${e1[1]} `; break;
          case 13: boundaryPath += `M${e0[0]},${e0[1]} L${e1[0]},${e1[1]} `; break;
          case 14: boundaryPath += `M${e3[0]},${e3[1]} L${e0[0]},${e0[1]} `; break;
        }
      }
    }

    return { fill: fillPath, boundary: boundaryPath, dy };
  }, [
    compiledLHS, compiledRHS, operator, dependenciesHash || baseScope, samplingDepth,
    xRange[0], xRange[1], yRange[0], yRange[1],
    tx, ty, px, py, rot, scaleX, scaleY,
  ]);

  useEffect(() => {
    if (onNoSolution && id) {
      onNoSolution(id, !paths.fill && !paths.boundary);
    }
  }, [paths, onNoSolution, id]);

  const customDashPattern = lineStyle && lineStyle !== "solid" ? getStrokeDasharray(lineStyle) : undefined;
  const isStrict = operator === "<" || operator === ">";
  const finalStrokeDash = customDashPattern || (isStrict ? "6,6" : "none");

  const pColor = fillColor || color;
  const pSpace = patternSpacing || 15;
  const pSize = pSpace;
  const pThick = Math.max(1, patternThickness || 2);

  let sx = 50;
  let sy = 50;
  try {
    const transform = useTransformContext();
    if (transform && transform.viewTransform) {
      sx = Math.abs(transform.viewTransform[0]);
      sy = Math.abs(transform.viewTransform[3]);
    }
  } catch (e) {}

  const PATTERN_BASE_SCALE = 50;
  const currentScreenSpacing = (pSpace / PATTERN_BASE_SCALE) * sx;
  let adaptiveFactor = 1;
  if (currentScreenSpacing > 0) {
    if (currentScreenSpacing < 6) {
      while (currentScreenSpacing * adaptiveFactor < 12) adaptiveFactor *= 1.5;
    } else if (currentScreenSpacing > 80) {
      while (currentScreenSpacing * adaptiveFactor > 40) adaptiveFactor /= 1.5;
    }
  }

  const finalScaleX = adaptiveFactor / PATTERN_BASE_SCALE;
  const finalScaleY = adaptiveFactor / PATTERN_BASE_SCALE;
  const targetScreenPixels = Math.max(0.5, pThick);
  const strokeThick = targetScreenPixels / (finalScaleX * sx);

  return (
    <g style={{ transform: "var(--mafs-view-transform)", transformOrigin: "0 0" }}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={xRange[0]} y={yRange[0]} width={xRange[1] - xRange[0]} height={yRange[1] - yRange[0]}>
          {paths.fill && (<path d={paths.fill} fill="white" stroke="white" strokeWidth={paths.dy * 0.1} strokeLinejoin="round" />)}
        </mask>
        {fillPattern !== "solid" && (
          <pattern id={patternId} width={pSize} height={pSize} patternUnits="userSpaceOnUse" patternTransform={`scale(${finalScaleX}, ${finalScaleY}) rotate(${patternAngle || 0})`}>
            {fillPattern === "hatch-diagonal" && (<React.Fragment><line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={-1} y1={1} x2={1} y2={-1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={pSize - 1} y1={pSize + 1} x2={pSize + 1} y2={pSize - 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /></React.Fragment>)}
            {fillPattern === "hatch-reverse" && (<React.Fragment><line x1={0} y1={0} x2={pSize} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={-1} y1={pSize - 1} x2={1} y2={pSize + 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={pSize - 1} y1={-1} x2={pSize + 1} y2={1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /></React.Fragment>)}
            {fillPattern === "hatch-cross" && (<React.Fragment><line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={0} y1={0} x2={pSize} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={-1} y1={1} x2={1} y2={-1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={pSize - 1} y1={pSize + 1} x2={pSize + 1} y2={pSize - 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={-1} y1={pSize - 1} x2={1} y2={pSize + 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={pSize - 1} y1={-1} x2={pSize + 1} y2={1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /></React.Fragment>)}
            {fillPattern === "dotted" && (<circle cx={pSize / 2} cy={pSize / 2} r={strokeThick} fill={pColor} fillOpacity={fillOpacity} />)}
            {fillPattern === "grid" && (<React.Fragment><line x1={0} y1={0} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /><line x1={0} y1={0} x2={0} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} /></React.Fragment>)}
            {fillPattern === "dashed" && (<line x1={0} y1={pSize / 2} x2={pSize} y2={pSize / 2} strokeWidth={strokeThick} strokeOpacity={fillOpacity} strokeDasharray={`${Math.max(1, pSize / 2)},${Math.max(1, pSize / 2)}`} style={{ stroke: pColor }} />)}
            {fillPattern === "math-region" && (<line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={Math.max(1, strokeThick * 0.5)} strokeOpacity={Math.min(1, fillOpacity * 1.5)} style={{ stroke: pColor }} />)}
          </pattern>
        )}
      </defs>

      {paths.fill && (
        fillPattern === "solid" ? (
          <rect x={xRange[0]} y={yRange[0]} width={xRange[1] - xRange[0]} height={yRange[1] - yRange[0]} fill={pColor} fillOpacity={fillOpacity} mask={`url(#${maskId})`} />
        ) : (
          <rect x={xRange[0]} y={yRange[0]} width={xRange[1] - xRange[0]} height={yRange[1] - yRange[0]} fill={`url(#${patternId})`} mask={`url(#${maskId})`} />
        )
      )}
      {paths.boundary && (
        <path d={paths.boundary} fill="none" strokeWidth={weight} strokeDasharray={finalStrokeDash} style={{ stroke: color, vectorEffect: "non-scaling-stroke" }} />
      )}
    </g>
  );
};
