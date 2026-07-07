import React from "react";
import { useTransformContext } from "mafs";
import type { FillPatternType } from "./mathTypes";

interface CurvePatternDefsProps {
  id: string;
  color: string;
  fillColor?: string;
  fillOpacity?: number;
  fillPattern?: FillPatternType;
  patternSpacing?: number;
  patternThickness?: number;
  patternAngle?: number;
}

export const CurvePatternDefs: React.FC<CurvePatternDefsProps> = ({
  id,
  color,
  fillColor,
  fillOpacity = 0.3,
  fillPattern = "hatch-diagonal",
  patternSpacing,
  patternThickness,
  patternAngle,
}) => {
  const transform = useTransformContext();
  let sx = 50;
  let sy = 50;
  if (transform && transform.viewTransform) {
    sx = Math.abs(transform.viewTransform[0]);
    sy = Math.abs(transform.viewTransform[3]);
  }

  const pColor = fillColor || color;
  const pSpace = Math.max(5, patternSpacing || 15);
  const pThick = Math.max(1, patternThickness || 2);

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
  const pSize = pSpace;
  const patternId = `curve-pattern-${id}`;

  if (fillPattern === "solid") return null;

  return (
    <g style={{ display: "none" }}>
      <defs>
        <pattern
          id={patternId}
          width={pSize}
          height={pSize}
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${finalScaleX}, ${finalScaleY}) rotate(${patternAngle || 0})`}
        >
          {fillPattern === "hatch-diagonal" && (
            <React.Fragment>
              <line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={-1} y1={1} x2={1} y2={-1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={pSize - 1} y1={pSize + 1} x2={pSize + 1} y2={pSize - 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
            </React.Fragment>
          )}
          {fillPattern === "hatch-reverse" && (
            <React.Fragment>
              <line x1={0} y1={0} x2={pSize} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={-1} y1={pSize - 1} x2={1} y2={pSize + 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={pSize - 1} y1={-1} x2={pSize + 1} y2={1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
            </React.Fragment>
          )}
          {fillPattern === "hatch-cross" && (
            <React.Fragment>
              <line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={0} y1={0} x2={pSize} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={-1} y1={1} x2={1} y2={-1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={pSize - 1} y1={pSize + 1} x2={pSize + 1} y2={pSize - 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={-1} y1={pSize - 1} x2={1} y2={pSize + 1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={pSize - 1} y1={-1} x2={pSize + 1} y2={1} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
            </React.Fragment>
          )}
          {fillPattern === "dotted" && (
            <circle cx={pSize / 2} cy={pSize / 2} r={strokeThick} fill={pColor} fillOpacity={fillOpacity} />
          )}
          {fillPattern === "grid" && (
            <React.Fragment>
              <line x1={0} y1={0} x2={pSize} y2={0} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
              <line x1={0} y1={0} x2={0} y2={pSize} strokeWidth={strokeThick} strokeOpacity={fillOpacity} style={{ stroke: pColor }} />
            </React.Fragment>
          )}
          {fillPattern === "dashed" && (
            <line x1={0} y1={pSize / 2} x2={pSize} y2={pSize / 2} strokeWidth={strokeThick} strokeOpacity={fillOpacity} strokeDasharray={`${Math.max(1, pSize / 2)},${Math.max(1, pSize / 2)}`} style={{ stroke: pColor }} />
          )}
          {fillPattern === "math-region" && (
            <line x1={0} y1={pSize} x2={pSize} y2={0} strokeWidth={Math.max(1, strokeThick * 0.5)} strokeOpacity={Math.min(1, fillOpacity * 1.5)} style={{ stroke: pColor }} />
          )}
        </pattern>
      </defs>
    </g>
  );
};
