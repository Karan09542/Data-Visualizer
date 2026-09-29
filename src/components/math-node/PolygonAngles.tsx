import React from "react";
import { useTransformContext, vec } from "mafs";
import { cleanRing, polygonInteriorAngles, type Vec2 } from "./areaMath";

/** Arc radius in screen pixels, so arcs stay the same size at any zoom. */
const ARC_PX = 18;

export const formatAngle = (deg: number) => {
  const r = Math.round(deg * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}°`;
};

/**
 * The interior angle at every corner of a polygon: an arc (a small square for a
 * right angle) and its value in degrees. Drawn in screen pixels, so a rotated or
 * stretched polygon still gets round arcs of a readable size.
 */
export function PolygonAngles({ points, color }: { points: Vec2[]; color: string }) {
  const { viewTransform } = useTransformContext();
  const ring = cleanRing(points);
  if (ring.length < 3) return null;

  const angles = polygonInteriorAngles(ring);
  // Screen space flips y; angles are measured in graph space, which is what the
  // labels report, and the drawing uses screen-space directions.
  const screen = ring.map((p) => vec.transform(p, viewTransform) as Vec2);
  const n = ring.length;

  return (
    <g style={{ pointerEvents: "none" }}>
      {screen.map((v, i) => {
        const p = screen[(i - 1 + n) % n];
        const q = screen[(i + 1) % n];
        const lenA = Math.hypot(p[0] - v[0], p[1] - v[1]);
        const lenB = Math.hypot(q[0] - v[0], q[1] - v[1]);
        if (lenA < 1 || lenB < 1) return null;
        const ua: Vec2 = [(p[0] - v[0]) / lenA, (p[1] - v[1]) / lenA];
        const ub: Vec2 = [(q[0] - v[0]) / lenB, (q[1] - v[1]) / lenB];
        // Keep the arc inside short edges.
        const r = Math.min(ARC_PX, 0.4 * Math.min(lenA, lenB));
        const deg = angles[i];

        // The interior bisector: between the two edges, flipped for reflex corners.
        let bx = ua[0] + ub[0];
        let by = ua[1] + ub[1];
        let bl = Math.hypot(bx, by);
        if (bl < 1e-9) {
          // Straight corner: perpendicular to the edge.
          bx = -ua[1];
          by = ua[0];
          bl = 1;
        }
        bx /= bl;
        by /= bl;
        if (deg > 180) {
          bx = -bx;
          by = -by;
        }

        const isRight = Math.abs(deg - 90) < 0.05;
        const a0: Vec2 = [v[0] + ua[0] * r, v[1] + ua[1] * r];
        const a1: Vec2 = [v[0] + ub[0] * r, v[1] + ub[1] * r];
        let marker: React.ReactNode;
        if (isRight) {
          const s = r * 0.7;
          marker = (
            <path
              d={`M${v[0] + ua[0] * s} ${v[1] + ua[1] * s} L${v[0] + (ua[0] + ub[0]) * s} ${v[1] + (ua[1] + ub[1]) * s} L${v[0] + ub[0] * s} ${v[1] + ub[1] * s}`}
              strokeWidth={1.5}
              style={{ fill: "none", stroke: color }}
            />
          );
        } else {
          // Sweep the interior side: the side the bisector points to.
          const cross = ua[0] * ub[1] - ua[1] * ub[0];
          const large = deg > 180 ? 1 : 0;
          const sweep = (cross > 0) !== (deg > 180) ? 1 : 0;
          marker = (
            <path
              d={`M${a0[0]} ${a0[1]} A${r} ${r} 0 ${large} ${sweep} ${a1[0]} ${a1[1]}`}
              strokeWidth={1.5}
              style={{ fill: color, fillOpacity: 0.12, stroke: color }}
            />
          );
        }

        const labelR = r + 13;
        const lx = v[0] + bx * labelR;
        const ly = v[1] + by * labelR;
        const text = formatAngle(deg);
        return (
          <g key={i}>
            {marker}
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={600}
              strokeWidth={3}
              paintOrder="stroke"
              // Inline: Mafs's stylesheet sets every text's fill and every path's stroke.
              style={{ fill: color, stroke: "var(--mafs-bg, #fff)", fontVariantNumeric: "tabular-nums" }}
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
