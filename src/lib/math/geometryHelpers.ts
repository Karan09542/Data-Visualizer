/**
 * Geometry helpers every row can call. They mean the same in radians and in
 * degrees mode, which is why the drawing tools' angle measurements use them:
 *
 *   angleAt(V, P, Q)          the angle at V between VP and VQ, in degrees (0–180)
 *   arcAt(V, P, Q, s, radius) the point a fraction s of the way round that angle's arc
 *
 * Shared by the graph's scope and the worker that checks rows for errors, so a
 * row using them is never reported as calling an unknown function.
 */

type Vec = [number, number];

const DEG = Math.PI / 180;

/** A point as [x, y], whether it arrives as an array or a mathjs matrix. */
const xy = (v: any): Vec => {
  const a = v && typeof v.toArray === "function" ? v.toArray() : v;
  return [Number(a?.[0]), Number(a?.[1])];
};

export const GEOMETRY_HELPERS = {
  angleAt: (V: any, P: any, Q: any): number => {
    const [vx, vy] = xy(V);
    const [px, py] = xy(P);
    const [qx, qy] = xy(Q);
    let d = Math.abs(Math.atan2(qy - vy, qx - vx) - Math.atan2(py - vy, px - vx));
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d / DEG;
  },
  arcAt: (V: any, P: any, Q: any, s: number, radius: number): Vec => {
    const [vx, vy] = xy(V);
    const [px, py] = xy(P);
    const [qx, qy] = xy(Q);
    const a = Math.atan2(py - vy, px - vx);
    let d = Math.atan2(qy - vy, qx - vx) - a;
    d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; // the short way round
    return [vx + radius * Math.cos(a + s * d), vy + radius * Math.sin(a + s * d)];
  },
};

export const GEOMETRY_HELPER_NAMES = Object.keys(GEOMETRY_HELPERS);
