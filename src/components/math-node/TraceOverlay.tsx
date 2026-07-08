import React, { useState, useEffect, useCallback } from "react";
import { Point, useTransformContext, usePaneContext, Text, vec } from "mafs";
import { MathFunction } from "./mathTypes";
import { computePCA } from "./mathHelpers";

interface TraceOverlayProps {
  functions: MathFunction[];
  baseScope: any;
  time: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const TraceOverlay: React.FC<TraceOverlayProps> = ({
  functions,
  baseScope,
  time,
  containerRef,
}) => {
  const pane = usePaneContext();
  const { viewTransform } = useTransformContext();
  
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    label: string;
    color: string;
  } | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!e.shiftKey) {
        setHoverData(null);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const xRange = pane && pane.xPaneRange ? pane.xPaneRange : [-5, 5];
      const yRange = pane && pane.yPaneRange ? pane.yPaneRange : [-5, 5];

      const viewBoxX = (xRange[0] / (xRange[1] - xRange[0])) * rect.width;
      const viewBoxY = (yRange[1] / (yRange[0] - yRange[1])) * rect.height;

      const inverseViewTransform = vec.matrixInvert(viewTransform);
      if (!inverseViewTransform) return;

      const [mathX, mathY] = vec.transform(
        [px + viewBoxX, py + viewBoxY],
        inverseViewTransform
      );

      // viewTransform is [a, c, tx, b, d, ty]. Index 0 is scaleX, Index 4 is scaleY.
      const pixelsPerUnitX = Math.abs(viewTransform[0]);
      const pixelsPerUnitY = Math.abs(viewTransform[4]);
      
      const MAX_PIXEL_DIST = 20; // max hover distance in pixels

      let closestMatch = null;
      let minPixelDistSq = MAX_PIXEL_DIST * MAX_PIXEL_DIST;

      const scope = Object.create(baseScope);
      scope.time = time;

      const distSq = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = (x2 - x1) * pixelsPerUnitX;
        const dy = (y2 - y1) * pixelsPerUnitY;
        return dx * dx + dy * dy;
      };

      const getInverseTransformHelper = (f: any, pts: number[][]) => {
        if (!f.isTransformable) return (pt: number[]) => pt;
        
        const pca = computePCA((pts && pts.length > 0 ? pts : [[0,0]]) as [number, number][]);
        const baseAngle = Math.atan2(pca.u[1], pca.u[0]);
        const px = (f.isPivotEnabled && f.transformPivot) ? f.transformPivot[0] : pca.center[0];
        const py = (f.isPivotEnabled && f.transformPivot) ? f.transformPivot[1] : pca.center[1];
        
        const tx = f.transformTranslate?.[0] || 0;
        const ty = f.transformTranslate?.[1] || 0;
        const sx = f.transformScale?.[0] || 1;
        const sy = f.transformScale?.[1] || 1;
        const rot = f.transformRotate || 0;
        
        return (pt: number[]) => {
          let x = pt[0] - px - tx;
          let y = pt[1] - py - ty;
          
          let x1 = x * Math.cos(-(rot + baseAngle)) - y * Math.sin(-(rot + baseAngle));
          let y1 = x * Math.sin(-(rot + baseAngle)) + y * Math.cos(-(rot + baseAngle));
          
          if (sx !== 0) x1 /= sx; 
          if (sy !== 0) y1 /= sy;
          
          let lx = x1 * Math.cos(baseAngle) - y1 * Math.sin(baseAngle);
          let ly = x1 * Math.sin(baseAngle) + y1 * Math.cos(baseAngle);
          
          return [lx + px, ly + py];
        };
      };

      const getTransformHelper = (f: any, pts: number[][]) => {
        if (!f.isTransformable) return (pt: number[]) => pt;
        
        const pca = computePCA((pts && pts.length > 0 ? pts : [[0,0]]) as [number, number][]);
        const baseAngle = Math.atan2(pca.u[1], pca.u[0]);
        const px = (f.isPivotEnabled && f.transformPivot) ? f.transformPivot[0] : pca.center[0];
        const py = (f.isPivotEnabled && f.transformPivot) ? f.transformPivot[1] : pca.center[1];
        
        const tx = f.transformTranslate?.[0] || 0;
        const ty = f.transformTranslate?.[1] || 0;
        const sx = f.transformScale?.[0] || 1;
        const sy = f.transformScale?.[1] || 1;
        const rot = f.transformRotate || 0;
        
        return (pt: number[]) => {
          let lx = pt[0] - px;
          let ly = pt[1] - py;
          let x1 = lx * Math.cos(-baseAngle) - ly * Math.sin(-baseAngle);
          let y1 = lx * Math.sin(-baseAngle) + ly * Math.cos(-baseAngle);
          x1 *= sx; y1 *= sy;
          let x2 = x1 * Math.cos(rot + baseAngle) - y1 * Math.sin(rot + baseAngle);
          let y2 = x1 * Math.sin(rot + baseAngle) + y1 * Math.cos(rot + baseAngle);
          return [x2 + px + tx, y2 + py + ty];
        };
      };

      const checkPoint = (x: number, y: number, color: string, label?: string) => {
        if (isNaN(x) || isNaN(y)) return;
        const d2 = distSq(x, y, mathX, mathY);
        if (d2 < minPixelDistSq) {
          minPixelDistSq = d2;
          closestMatch = {
            x,
            y,
            label: label || `(${x.toFixed(2)}, ${y.toFixed(2)})`,
            color
          };
        }
      };

      const getPoints = (f: any) => {
        try {
          const res = f.compiled.evaluate(scope);
          if (!res) return [];
          const arr = res.toArray ? res.toArray() : [res];
          return arr.map((pt: any) => {
            if (pt && pt.toArray) return pt.toArray();
            if (Array.isArray(pt)) return pt;
            return [pt, 0];
          });
        } catch (e) { return []; }
      };

      const checkSegment = (p1: number[], p2: number[], color: string) => {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const l2 = dx*dx + dy*dy;
        if (l2 === 0) return checkPoint(p1[0], p1[1], color);
        let t = ((mathX - p1[0]) * dx + (mathY - p1[1]) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        checkPoint(p1[0] + t * dx, p1[1] + t * dy, color);
      };

      const checkLine = (p1: number[], p2: number[], color: string) => {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const l2 = dx*dx + dy*dy;
        if (l2 === 0) return checkPoint(p1[0], p1[1], color);
        let t = ((mathX - p1[0]) * dx + (mathY - p1[1]) * dy) / l2;
        checkPoint(p1[0] + t * dx, p1[1] + t * dy, color);
      };

      const checkRay = (p1: number[], p2: number[], color: string) => {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const l2 = dx*dx + dy*dy;
        if (l2 === 0) return checkPoint(p1[0], p1[1], color);
        let t = ((mathX - p1[0]) * dx + (mathY - p1[1]) * dy) / l2;
        t = Math.max(0, t);
        checkPoint(p1[0] + t * dx, p1[1] + t * dy, color);
      };

      for (const f of functions) {
        if (!f.visible || !f.compiled) continue;

        try {
          if (f.type === "point") {
            const rawPts = getPoints(f);
            const transform = getTransformHelper(f, rawPts);
            const pts = rawPts.map((pt: number[]) => transform(pt));
            if (pts.length > 0) checkPoint(pts[0][0], pts[0][1], f.color, f.label);
          } else if (f.type === "vector") {
            const rawPts = getPoints(f);
            const transform = getTransformHelper(f, rawPts);
            const pts = rawPts.map((pt: number[]) => transform(pt));
            if (pts.length > 0) checkSegment(transform([0, 0]), pts[0], f.color);
          } else if (f.type === "line" || (f.type as any) === "segment" || (f.type as any) === "ray") {
            const rawPts = getPoints(f);
            const transform = getTransformHelper(f, rawPts);
            const pts = rawPts.map((pt: number[]) => transform(pt));
            if (pts.length >= 2) {
              if ((f.type as any) === "segment") checkSegment(pts[0], pts[1], f.color);
              else if ((f.type as any) === "ray") checkRay(pts[0], pts[1], f.color);
              else checkSegment(pts[0], pts[1], f.color); // MathNodeRenderer treats most generic lines as segments visually based on points
            }
          } else if (f.type === "polygon") {
            const rawPts = getPoints(f);
            const transform = getTransformHelper(f, rawPts);
            const pts = rawPts.map((pt: number[]) => transform(pt));
            for (let i = 0; i < pts.length; i++) {
              checkSegment(pts[i], pts[(i + 1) % pts.length], f.color);
            }
          } else if (f.type === "function" || f.type === "differential") {
            const transform = getTransformHelper(f, []);
            const inverse = getInverseTransformHelper(f, []);
            const localMouse = inverse([mathX, mathY]);
            
            const rangeX = 30 / pixelsPerUnitX;
            let bestX = localMouse[0];
            let bestY = 0;
            let minDist = Infinity;
            
            for (let i = 0; i <= 50; i++) {
              const x = localMouse[0] - rangeX + 2 * rangeX * (i / 50);
              scope.x = x;
              const y = Number(f.compiled.evaluate(scope));
              if (isNaN(y)) continue;
              const globalPt = transform([x, y]);
              const d2 = distSq(globalPt[0], globalPt[1], mathX, mathY);
              if (d2 < minDist) { minDist = d2; bestX = x; bestY = y; }
            }
            
            if (minDist < Infinity) {
              let searchRadius = rangeX / 25;
              for (let iter = 0; iter < 3; iter++) {
                let localBestX = bestX;
                let localBestY = bestY;
                let localMinDist = minDist;
                for (let i = 0; i <= 20; i++) {
                  const x = bestX - searchRadius + 2 * searchRadius * (i / 20);
                  scope.x = x;
                  const y = Number(f.compiled.evaluate(scope));
                  if (isNaN(y)) continue;
                  const globalPt = transform([x, y]);
                  const d2 = distSq(globalPt[0], globalPt[1], mathX, mathY);
                  if (d2 < localMinDist) { localMinDist = d2; localBestX = x; localBestY = y; }
                }
                minDist = localMinDist; bestX = localBestX; bestY = localBestY;
                searchRadius /= 10;
              }
              const finalGlobal = transform([bestX, bestY]);
              checkPoint(finalGlobal[0], finalGlobal[1], f.color);
            }
          } else if (f.type === "parametric" || f.type === "polar") {
            const isPolar = f.type === "polar";
            const tMin = (f as any).tRange ? (f as any).tRange[0] : 0;
            const tMax = (f as any).tRange ? (f as any).tRange[1] : (isPolar ? 12 * Math.PI : 2 * Math.PI);
            const samples = isPolar ? 300 : 100;
            
            const transform = getTransformHelper(f, []);
            
            let bestT = tMin;
            let bestPt = [0, 0];
            let minDist = Infinity;
            
            for (let i = 0; i <= samples; i++) {
              const t = tMin + (tMax - tMin) * (i / samples);
              scope.theta = t;
              scope.t = t;
              scope.x = t; // fallback if user used x
              let pt = [0, 0];
              if (isPolar) {
                 const r = Number(f.compiled.evaluate(scope));
                 pt = [r * Math.cos(t), r * Math.sin(t)];
              } else {
                 const res = f.compiled.evaluate(scope);
                 const arr = res && res.toArray ? res.toArray() : res;
                 if (Array.isArray(arr) && arr.length >= 2) {
                   pt = [Number(arr[0]), Number(arr[1])];
                 } else continue;
              }
              if (isNaN(pt[0]) || isNaN(pt[1])) continue;
              const globalPt = transform(pt);
              const d2 = distSq(globalPt[0], globalPt[1], mathX, mathY);
              if (d2 < minDist) { minDist = d2; bestT = t; bestPt = pt; }
            }
            
            if (minDist < Infinity) {
              let searchRadius = (tMax - tMin) / (samples / 2);
              for (let iter = 0; iter < 3; iter++) {
                let localBestT = bestT;
                let localBestPt = bestPt;
                let localMinDist = minDist;
                for (let i = 0; i <= 20; i++) {
                  const t = bestT - searchRadius + 2 * searchRadius * (i / 20);
                  scope.theta = t;
                  scope.t = t;
                  scope.x = t;
                  let pt = [0, 0];
                  if (isPolar) {
                     const r = Number(f.compiled.evaluate(scope));
                     pt = [r * Math.cos(t), r * Math.sin(t)];
                  } else {
                     const res = f.compiled.evaluate(scope);
                     const arr = res && res.toArray ? res.toArray() : res;
                     if (Array.isArray(arr) && arr.length >= 2) {
                       pt = [Number(arr[0]), Number(arr[1])];
                     } else continue;
                  }
                  if (isNaN(pt[0]) || isNaN(pt[1])) continue;
                  const globalPt = transform(pt);
                  const d2 = distSq(globalPt[0], globalPt[1], mathX, mathY);
                  if (d2 < localMinDist) { localMinDist = d2; localBestT = t; localBestPt = pt; }
                }
                minDist = localMinDist; bestT = localBestT; bestPt = localBestPt;
                searchRadius /= 10;
              }
              const finalGlobal = transform(bestPt);
              checkPoint(finalGlobal[0], finalGlobal[1], f.color);
            }
          } else if (f.type === "implicit" || f.type === "inequality") {
            const transform = getTransformHelper(f, []);
            const inverse = getInverseTransformHelper(f, []);
            const localMouse = inverse([mathX, mathY]);
            
            let currX = localMouse[0];
            let currY = localMouse[1];
            const EPSILON = 1e-4;
            
            for (let iter = 0; iter < 5; iter++) {
               scope.x = currX; scope.y = currY;
               const lhs = Number(f.compiled.evaluate(scope));
               const compiled2 = (f as any).compiled2;
               const rhs = compiled2 ? Number(compiled2.evaluate(scope)) : 0;
               const val = lhs - rhs;
               
               if (Math.abs(val) < 1e-6) break;
               
               scope.x = currX + EPSILON; scope.y = currY;
               const dxLhs = Number(f.compiled.evaluate(scope));
               const dxRhs = compiled2 ? Number(compiled2.evaluate(scope)) : 0;
               const dx = (dxLhs - dxRhs - val) / EPSILON;
               
               scope.x = currX; scope.y = currY + EPSILON;
               const dyLhs = Number(f.compiled.evaluate(scope));
               const dyRhs = compiled2 ? Number(compiled2.evaluate(scope)) : 0;
               const dy = (dyLhs - dyRhs - val) / EPSILON;
               
               const gradMagSq = dx * dx + dy * dy;
               if (gradMagSq < 1e-12) break;
               
               currX -= val * dx / gradMagSq;
               currY -= val * dy / gradMagSq;
            }
            
            scope.x = currX; scope.y = currY;
            const compiled2 = (f as any).compiled2;
            const finalVal = Number(f.compiled.evaluate(scope)) - (compiled2 ? Number(compiled2.evaluate(scope)) : 0);
            if (Math.abs(finalVal) < 0.1) {
              const finalGlobal = transform([currX, currY]);
              checkPoint(finalGlobal[0], finalGlobal[1], f.color);
            }
          }
        } catch (err) {
          // Ignore evaluation errors during hover
        }
      }

      setHoverData(closestMatch);
    },
    [containerRef, pane, functions, baseScope, time]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("pointermove", handlePointerMove);
    const handleLeave = () => setHoverData(null);
    el.addEventListener("pointerleave", handleLeave);

    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handleLeave);
    };
  }, [containerRef, handlePointerMove]);

  if (!hoverData) return null;

  return (
    <React.Fragment>
      <Point 
        x={hoverData.x} 
        y={hoverData.y} 
        color={hoverData.color} 
        opacity={0.8}
        svgCircleProps={{ style: { filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))" } }}
      />
      <Text
        x={hoverData.x}
        y={hoverData.y}
        attach="ne"
        attachDistance={12}
        color={hoverData.color}
        size={14}
        svgTextProps={{ 
           style: { 
             pointerEvents: "none", 
             fontWeight: "bold",
             textShadow: "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white"
           } 
        }}
      >
        {hoverData.label}
      </Text>
    </React.Fragment>
  );
};
