import React from "react";
import { useTransformContext, vec } from "mafs";
import type { Vec2 } from "./areaMath";
import { formatAngle } from "./PolygonAngles";

/** `Vector(A, B)` or `v = Vector(A, B)`: an arrow between two named points. */
const NAMED_VECTOR = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?Vector\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/;

/** The names of the two ends of a vector row drawn between named points. */
export function vectorEndNames(expr: string | undefined): [string, string] | null {
  const m = expr?.match(NAMED_VECTOR);
  return m ? [m[1], m[2]] : null;
}

export interface DrawnVector {
  id: string;
  tailName: string;
  tipName: string;
  tail: Vec2;
  tip: Vec2;
  color: string;
}

export interface VectorJoint {
  /** The point two vectors share. */
  at: Vec2;
  /** Their directions (unit vectors), as if both started here. */
  u: Vec2;
  v: Vec2;
  /** The angle between them, 0–180°. */
  degrees: number;
  /**
   * The vector ends here rather than starts, so its direction carries on past
   * its tip: drawn as a dashed extension for the angle to sit against.
   */
  extendU: boolean;
  extendV: boolean;
  color: string;
}

/**
 * The angles between vectors that share an end point by name. Two vectors from a
 * common point give the angle at that point; tip to tail, it's the angle the
 * second turns away from the first. Where several meet, neighbours are paired
 * (the widest gap is left out), so each angle is shown once.
 */
export function vectorJoints(vectors: DrawnVector[]): VectorJoint[] {
  const ends = new Map<string, { vector: DrawnVector; atTail: boolean; dir: Vec2; angle: number }[]>();
  for (const vector of vectors) {
    const dx = vector.tip[0] - vector.tail[0];
    const dy = vector.tip[1] - vector.tail[1];
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-9)) continue;
    const dir: Vec2 = [dx / length, dy / length];
    const angle = Math.atan2(dy, dx);
    for (const [name, atTail] of [[vector.tailName, true], [vector.tipName, false]] as const) {
      const list = ends.get(name) ?? [];
      list.push({ vector, atTail, dir, angle });
      ends.set(name, list);
    }
  }

  const joints: VectorJoint[] = [];
  for (const list of ends.values()) {
    if (list.length < 2) continue;
    let pairs: [number, number][];
    if (list.length === 2) {
      pairs = [[0, 1]];
    } else {
      list.sort((a, b) => a.angle - b.angle);
      const n = list.length;
      const gap = (i: number) => (((list[(i + 1) % n].angle - list[i].angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let widest = 0;
      for (let i = 1; i < n; i++) if (gap(i) > gap(widest)) widest = i;
      pairs = [];
      for (let i = 0; i < n; i++) if (i !== widest) pairs.push([i, (i + 1) % n]);
    }
    for (const [i, j] of pairs) {
      const a = list[i];
      const b = list[j];
      if (a.vector.id === b.vector.id) continue;
      const dot = Math.max(-1, Math.min(1, a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1]));
      joints.push({
        at: a.atTail ? a.vector.tail : a.vector.tip,
        u: a.dir,
        v: b.dir,
        degrees: (Math.acos(dot) * 180) / Math.PI,
        extendU: !a.atTail,
        extendV: !b.atTail,
        color: b.vector.color,
      });
    }
  }
  return joints;
}

const ARC_PX = 24;
const EXTENSION_PX = 46;

/** Draws the angle at each joint: an arc (a square for a right angle) and its size. */
export function VectorAngles({ joints }: { joints: VectorJoint[] }) {
  const { viewTransform } = useTransformContext();
  if (!joints.length) return null;

  return (
    <g style={{ pointerEvents: "none" }}>
      {joints.map((joint, i) => {
        const p = vec.transform(joint.at, viewTransform) as Vec2;
        // Directions on screen (y is flipped there).
        const onScreen = (d: Vec2): Vec2 | null => {
          const q = vec.transform([joint.at[0] + d[0], joint.at[1] + d[1]], viewTransform) as Vec2;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          return len > 1e-9 ? [(q[0] - p[0]) / len, (q[1] - p[1]) / len] : null;
        };
        const u = onScreen(joint.u);
        const v = onScreen(joint.v);
        if (!u || !v) return null;
        const r = ARC_PX;
        const deg = joint.degrees;

        let bx = u[0] + v[0];
        let by = u[1] + v[1];
        let bl = Math.hypot(bx, by);
        if (bl < 1e-6) {
          // Opposite directions: label to one side.
          bx = -u[1];
          by = u[0];
          bl = 1;
        }
        bx /= bl;
        by /= bl;

        let marker: React.ReactNode = null;
        if (Math.abs(deg - 90) < 0.05) {
          const s = r * 0.6;
          marker = (
            <path
              d={`M${p[0] + u[0] * s} ${p[1] + u[1] * s} L${p[0] + (u[0] + v[0]) * s} ${p[1] + (u[1] + v[1]) * s} L${p[0] + v[0] * s} ${p[1] + v[1] * s}`}
              strokeWidth={1.5}
              style={{ fill: "none", stroke: joint.color }}
            />
          );
        } else if (deg > 0.05) {
          const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
          marker = (
            <path
              d={`M${p[0] + u[0] * r} ${p[1] + u[1] * r} A${r} ${r} 0 0 ${sweep} ${p[0] + v[0] * r} ${p[1] + v[1] * r}`}
              strokeWidth={1.5}
              style={{ fill: "none", stroke: joint.color }}
            />
          );
        }

        const extension = (d: Vec2) => (
          <path
            d={`M${p[0]} ${p[1]} L${p[0] + d[0] * EXTENSION_PX} ${p[1] + d[1] * EXTENSION_PX}`}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            style={{ fill: "none", stroke: joint.color, opacity: 0.7 }}
          />
        );

        return (
          <g key={i}>
            {joint.extendU && extension(u)}
            {joint.extendV && extension(v)}
            {marker}
            <text
              x={p[0] + bx * (r + 15)}
              y={p[1] + by * (r + 15)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={600}
              strokeWidth={3}
              paintOrder="stroke"
              // Inline: Mafs's stylesheet sets every text's fill and every path's stroke.
              style={{ fill: joint.color, stroke: "var(--mafs-bg, #fff)", fontVariantNumeric: "tabular-nums" }}
            >
              {formatAngle(deg)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── A vector's own parts, drawn on the graph ─────────────────────────────────

export interface DecoratedVector {
  id: string;
  tail: Vec2;
  tip: Vec2;
  color: string;
  /** The dashed right triangle of its x and y parts. */
  components: boolean;
  /** The angle it makes with the positive x-axis, as an arc from a dashed reference line. */
  direction: boolean;
}

/** A number as a student would write it: two decimals at most, no trailing zeros. */
const tidy = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

const DIRECTION_ARC_PX = 30;

/**
 * Shows what a vector's numbers mean: its components as the two dashed legs of a
 * right triangle (each labelled with its value), and its direction as the arc
 * from the positive x-axis round to the arrow, anticlockwise.
 */
export function VectorDecorations({ vectors }: { vectors: DecoratedVector[] }) {
  const { viewTransform } = useTransformContext();
  const shown = vectors.filter((v) => v.components || v.direction);
  if (!shown.length) return null;
  const toScreen = (p: Vec2) => vec.transform(p, viewTransform) as Vec2;
  const pxPerUnit = Math.abs(viewTransform[0]) || 1;

  const text = (x: number, y: number, value: string, color: string, anchor: "middle" | "start" | "end" = "middle") => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      strokeWidth={3}
      paintOrder="stroke"
      style={{ fill: color, stroke: "var(--mafs-bg, #fff)", fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </text>
  );

  return (
    <g style={{ pointerEvents: "none" }}>
      {shown.map((v) => {
        const dx = v.tip[0] - v.tail[0];
        const dy = v.tip[1] - v.tail[1];
        const length = Math.hypot(dx, dy);
        if (!(length > 1e-9)) return null;
        const a = toScreen(v.tail);
        const b = toScreen(v.tip);
        const corner = toScreen([v.tip[0], v.tail[1]]);
        const dashed = { fill: "none", stroke: v.color, opacity: 0.75 } as const;

        let legs: React.ReactNode = null;
        if (v.components) {
          // Labels on the outside of the triangle: below the base when the arrow goes up.
          const below = dy >= 0 ? 12 : -12;
          const beside = dx >= 0 ? 8 : -8;
          const s = 7; // right-angle mark
          const hx = Math.sign(a[0] - corner[0]) || 1;
          const hy = Math.sign(b[1] - corner[1]) || 1;
          legs = (
            <>
              <path d={`M${a[0]} ${a[1]} L${corner[0]} ${corner[1]} L${b[0]} ${b[1]}`} strokeWidth={1.25} strokeDasharray="4 4" style={dashed} />
              {Math.abs(dx) * pxPerUnit > 14 && Math.abs(dy) * pxPerUnit > 14 && (
                <path
                  d={`M${corner[0] + hx * s} ${corner[1]} L${corner[0] + hx * s} ${corner[1] + hy * s} L${corner[0]} ${corner[1] + hy * s}`}
                  strokeWidth={1}
                  style={dashed}
                />
              )}
              {text((a[0] + corner[0]) / 2, a[1] + below, tidy(dx), v.color)}
              {text(corner[0] + beside, (corner[1] + b[1]) / 2, tidy(dy), v.color, dx >= 0 ? "start" : "end")}
            </>
          );
        }

        let direction: React.ReactNode = null;
        if (v.direction) {
          const angle = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
          const r = Math.min(DIRECTION_ARC_PX, 0.45 * length * pxPerUnit) / pxPerUnit;
          const ref = toScreen([v.tail[0] + Math.max(r * 1.8, 0.6 * Math.abs(dx)), v.tail[1]]);
          // The arc, sampled in graph units so it goes anticlockwise as angles do.
          const steps = Math.max(8, Math.ceil(angle / 0.12));
          let d = "";
          for (let i = 0; i <= steps; i++) {
            const t = (angle * i) / steps;
            const p = toScreen([v.tail[0] + r * Math.cos(t), v.tail[1] + r * Math.sin(t)]);
            d += `${i ? "L" : "M"}${p[0]} ${p[1]} `;
          }
          direction = (
            <>
              <path d={`M${a[0]} ${a[1]} L${ref[0]} ${ref[1]}`} strokeWidth={1.25} strokeDasharray="4 4" style={dashed} />
              {angle > 0.01 && <path d={d} strokeWidth={1.5} style={{ fill: "none", stroke: v.color }} />}
            </>
          );
        }

        return (
          <g key={v.id}>
            {legs}
            {direction}
          </g>
        );
      })}
    </g>
  );
}

// ─── Resultants of joined vectors ─────────────────────────────────────────────

export interface VectorResultant {
  from: Vec2;
  to: Vec2;
  /** Dashed construction lines: the parallelogram's other two sides. */
  guides: [Vec2, Vec2][];
}

/**
 * The resultant wherever drawn vectors are joined by name:
 *  - several from one point: their sum from that point (for exactly two, with
 *    the parallelogram it's the diagonal of);
 *  - tip to tail (A→B then B→C): the arrow that closes the triangle, A→C.
 * A resultant that a drawn vector already is (someone drew A→C) isn't repeated,
 * and neither is one of no length (there and back).
 */
export function vectorResultants(vectors: DrawnVector[]): VectorResultant[] {
  const real = vectors.filter((v) => Math.hypot(v.tip[0] - v.tail[0], v.tip[1] - v.tail[1]) > 1e-9);
  const drawn = new Set(real.map((v) => `${v.tailName}>${v.tipName}`));
  const out: VectorResultant[] = [];
  const add = (r: VectorResultant) => {
    if (Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]) > 1e-9) out.push(r);
  };

  // From a common point.
  const byTail = new Map<string, DrawnVector[]>();
  for (const v of real) byTail.set(v.tailName, [...(byTail.get(v.tailName) ?? []), v]);
  for (const group of byTail.values()) {
    if (group.length < 2) continue;
    const from = group[0].tail;
    const to: Vec2 = [
      from[0] + group.reduce((s, v) => s + v.tip[0] - v.tail[0], 0),
      from[1] + group.reduce((s, v) => s + v.tip[1] - v.tail[1], 0),
    ];
    add({ from, to, guides: group.length === 2 ? [[group[0].tip, to], [group[1].tip, to]] : [] });
  }

  // Tip to tail.
  for (const first of real) {
    for (const second of real) {
      if (first.id === second.id || first.tipName !== second.tailName) continue;
      if (first.tailName === second.tipName) continue; // there and back
      if (drawn.has(`${first.tailName}>${second.tipName}`)) continue;
      add({ from: first.tail, to: second.tip, guides: [] });
    }
  }
  return out;
}

const RESULTANT = "#e11d48";

/** Draws each resultant as an arrow in its own colour, labelled with its length. */
export function VectorResultants({ resultants }: { resultants: VectorResultant[] }) {
  const { viewTransform } = useTransformContext();
  if (!resultants.length) return null;
  const toScreen = (p: Vec2) => vec.transform(p, viewTransform) as Vec2;

  return (
    <g style={{ pointerEvents: "none" }}>
      {resultants.map((r, i) => {
        const a = toScreen(r.from);
        const b = toScreen(r.to);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 2) return null;
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        // Arrowhead: a triangle at the tip.
        const head = Math.min(12, len * 0.4);
        const base: Vec2 = [b[0] - ux * head, b[1] - uy * head];
        const wing = head * 0.45;
        const magnitude = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]);
        // The label beside the middle, on the arrow's left.
        const lx = (a[0] + b[0]) / 2 + uy * 14;
        const ly = (a[1] + b[1]) / 2 - ux * 14;
        return (
          <g key={i}>
            {r.guides.map(([p, q], k) => {
              const s = toScreen(p);
              const e = toScreen(q);
              return (
                <path
                  key={k}
                  d={`M${s[0]} ${s[1]} L${e[0]} ${e[1]}`}
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  style={{ fill: "none", stroke: RESULTANT, opacity: 0.6 }}
                />
              );
            })}
            <path d={`M${a[0]} ${a[1]} L${base[0]} ${base[1]}`} strokeWidth={2.5} style={{ fill: "none", stroke: RESULTANT }} />
            <path
              d={`M${b[0]} ${b[1]} L${base[0] - uy * wing} ${base[1] + ux * wing} L${base[0] + uy * wing} ${base[1] - ux * wing} Z`}
              strokeWidth={1}
              style={{ fill: RESULTANT, stroke: RESULTANT }}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={700}
              strokeWidth={3}
              paintOrder="stroke"
              style={{ fill: RESULTANT, stroke: "var(--mafs-bg, #fff)", fontVariantNumeric: "tabular-nums" }}
            >
              {`R = ${tidy(magnitude)}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
