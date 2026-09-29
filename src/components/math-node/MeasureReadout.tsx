import React, { useSyncExternalStore } from "react";
import { Ruler, Sigma } from "lucide-react";
import { cleanRing, polygonInteriorAngles, polygonPerimeter, signedPolygonArea, type Vec2 } from "./areaMath";
import { formatMeasure } from "./IntegralShade";
import { getIntegral, measurementsVersion, subscribeMeasurements } from "./measureStore";
import { formatAngle } from "./PolygonAngles";
import { shapesForFunction, subscribeTraceShapesSlow, traceShapesSlowVersion } from "./traceGeometry";

const ROW = "flex items-start gap-2 text-[11px]";
const LABEL = "flex w-20 shrink-0 items-center gap-1.5 pt-0.5 font-medium text-slate-500 dark:text-slate-400";
const VALUE = "min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono tabular-nums text-slate-700 dark:text-slate-200";

/**
 * Measurements for a row, under its equation: a polygon's area, perimeter and
 * angles, or a function's definite integral when its area is shaded.
 */
export function MeasureReadout({ fnId, type, scope = "" }: { fnId: string; type: string; scope?: string }) {
  useSyncExternalStore(subscribeTraceShapesSlow, traceShapesSlowVersion, traceShapesSlowVersion);
  useSyncExternalStore(subscribeMeasurements, measurementsVersion, measurementsVersion);

  let polygon: { area: number; perimeter: number; angles: number[] } | null = null;
  if (type === "polygon") {
    // The drawn outline (transforms included): its first run is the closed ring.
    const shape = shapesForFunction(fnId, scope).find((s) => s.kind === "curve");
    if (shape) {
      const ring: Vec2[] = [];
      for (let i = 0; i < shape.xs.length; i++) {
        if (!Number.isFinite(shape.xs[i]) || !Number.isFinite(shape.ys[i])) break;
        ring.push([shape.xs[i], shape.ys[i]]);
      }
      const pts = cleanRing(ring);
      if (pts.length >= 3) {
        polygon = {
          area: Math.abs(signedPolygonArea(pts)),
          perimeter: polygonPerimeter(pts),
          angles: polygonInteriorAngles(pts),
        };
      }
    }
  }

  const integral = type === "function" ? getIntegral(scope, fnId) : undefined;
  if (!polygon && !integral) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40 nodrag">
      {polygon && (
        <>
          <div className={ROW}>
            <span className={LABEL}>
              <Ruler size={12} className="text-violet-500" />
              Shape
            </span>
            <span className={VALUE}>
              <span>Area {formatMeasure(polygon.area)}</span>
              <span>Perimeter {formatMeasure(polygon.perimeter)}</span>
            </span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>
              <span className="w-3 text-center text-violet-500">∠</span>
              Angles
            </span>
            <span className={VALUE} title={`Sum ${formatAngle(polygon.angles.reduce((s, a) => s + a, 0))}`}>
              {polygon.angles.map((a, i) => (
                <span key={i}>{formatAngle(a)}</span>
              ))}
            </span>
          </div>
        </>
      )}
      {integral && (
        <div className={ROW}>
          <span className={LABEL}>
            <Sigma size={12} className="text-emerald-500" />
            Area
          </span>
          <span className={VALUE}>
            <span title={`Signed: parts below ${integral.against} count negative`}>
              ∫ = {formatMeasure(integral.signed)}
            </span>
            <span title="Every part counts positive">Area {formatMeasure(integral.area)}</span>
            <span className="font-sans text-slate-400">
              from {formatMeasure(integral.from)} to {formatMeasure(integral.to)} vs {integral.against}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
