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

/** A point of the plane or of space. */
type Vec = number[];

const DEG = Math.PI / 180;

/** A point as [x, y] or [x, y, z], whether it arrives as an array, a matrix or a complex number. */
const coords = (v: any): Vec => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if (v.isComplex || ("re" in v && "im" in v)) {
      return [Number(v.re), Number(v.im)];
    }
  }
  const a = v && typeof v.toArray === "function" ? v.toArray() : v;
  const flat = (c: any) => Number(Array.isArray(c) ? c[0] : c);
  return Array.isArray(a) && a.length >= 3 ? [flat(a[0]), flat(a[1]), flat(a[2])] : [flat(a?.[0]), flat(a?.[1])];
};

/** Both points with as many coordinates as the longer one (a missing height is 0). */
const pair = (P: any, Q: any): [Vec, Vec] => {
  const p = coords(P);
  const q = coords(Q);
  const n = Math.max(p.length, q.length);
  while (p.length < n) p.push(0);
  while (q.length < n) q.push(0);
  return [p, q];
};

const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
const len = (a: Vec) => Math.sqrt(dot(a, a));

export const GEOMETRY_HELPERS = {
  /** The angle at V between VP and VQ, in degrees (0–180); in the plane or in space. */
  angleAt: (V: any, P: any, Q: any): number => {
    const [v, p] = pair(V, P);
    const [, q] = pair(v, Q);
    const [pp, qq] = pair(sub(p, v.slice(0, p.length)), sub(q, v.slice(0, q.length)));
    const c = dot(pp, qq) / (len(pp) * len(qq));
    return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
  },
  /**
   * The point a fraction s of the way round the angle at V (from VP towards VQ, the
   * short way), at `radius` from V. Works in the plane and in space.
   */
  arcAt: (V: any, P: any, Q: any, s: number, radius: number): Vec => {
    const [v0, p0] = pair(V, P);
    const [v, q] = pair(v0, Q);
    const [p] = pair(p0, q);
    const u = sub(p, v);
    const w0 = sub(q, v);
    const lu = len(u) || 1;
    const lw = len(w0) || 1;
    const e1 = u.map((x) => x / lu);
    const e2raw = w0.map((x) => x / lw);
    const c = Math.max(-1, Math.min(1, dot(e1, e2raw)));
    const theta = Math.acos(c);
    // A unit vector at right angles to VP, in the plane of the angle.
    const perp = e2raw.map((x, i) => x - c * e1[i]);
    const lp = len(perp);
    const e2 = lp > 1e-12 ? perp.map((x) => x / lp) : perp.map(() => 0);
    const a = s * theta;
    return v.map((x, i) => x + radius * (Math.cos(a) * e1[i] + Math.sin(a) * e2[i]));
  },
  distance: (A: any, B: any): number => {
    const [a, b] = pair(A, B);
    return len(sub(b, a));
  },
  dist: (A: any, B: any): number => {
    const [a, b] = pair(A, B);
    return len(sub(b, a));
  },
  midpoint: (A: any, B: any): Vec => {
    const [a, b] = pair(A, B);
    return a.map((x, i) => (x + b[i]) / 2);
  },
  /**
   * field([P, Q, R]): a vector field, drawn as arrows by the 3D view. Elsewhere it is
   * just its value at the point.
   */
  field: (...parts: any[]) => (parts.length === 1 ? parts[0] : parts),
  /**
   * revolve(f(x), a, b[, "y"]): y = f(x) turned round an axis into a solid by the 3D
   * view. On the flat graph it is the curve y = f(x) itself.
   */
  revolve: (fx: any) => fx,
  /** A point in space: [x, y] becomes [x, y, 0]. Shapes drawn in 3D use it to join points of either kind. */
  p3: (A: any): Vec => {
    const a = coords(A);
    return [a[0], a[1], a[2] ?? 0];
  },
};

export const GEOMETRY_HELPER_NAMES = Object.keys(GEOMETRY_HELPERS);
