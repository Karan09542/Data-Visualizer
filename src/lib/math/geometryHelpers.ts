/**
 * Geometry helpers every row can call. They mean the same in radians and in
 * degrees mode, which is why the drawing tools' angle measurements use them:
 *
 *   angleAt(V, P, Q)          the angle at V between VP and VQ, in degrees (0–180)
 *   arcAt(V, P, Q, s, radius) the point a fraction s of the way round that angle's arc
 *   planeNormal(A, B, C), footOnPlane(P, A, B, C), planeAngle(A, B, C, D),
 *   planeArc(A, B, C, D, s, radius), planeEquation(A, B, C)   planes in space
 *   divergence(F, P), curl(F, P)   of a field F(x, y, z) = [P, Q, R], at the point P
 *   linePlane(A, B, C, D, E), nearestOnLines(A, B, C, D, k), lineDistance(A, B, C, D)   lines in space
 *   surfaceArea(f, a, b, c, d)   of z = f(x, y) over a rectangle
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
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A point in space ([x, y] is on the floor). */
const v3 = (A: any): Vec => {
  const a = coords(A);
  return [a[0], a[1], a[2] ?? 0];
};
/** The points on lines AB and CD closest to each other (for parallel lines, any such pair). */
const nearestPair = (A: any, B: any, C: any, D: any): [Vec, Vec] => {
  const [a, b, c, d] = [A, B, C, D].map(v3);
  const u = sub(b, a);
  const v = sub(d, c);
  const w = sub(a, c);
  const uu = dot(u, u), uv = dot(u, v), vv = dot(v, v), uw = dot(u, w), vw = dot(v, w);
  const den = uu * vv - uv * uv;
  let s = 0;
  let t = vv ? vw / vv : 0;
  if (den > 1e-12 * uu * vv) {
    s = (uv * vw - vv * uw) / den;
    t = (uu * vw - uv * uw) / den;
  }
  return [a.map((x, i) => x + s * u[i]), c.map((x, i) => x + t * v[i])];
};

/** The area of z = g(x, y) over a rectangle: Simpson's rule on √(1 + g_x² + g_y²). */
export const surfaceAreaOf = (g: (x: number, y: number) => number, a: number, b: number, c: number, d: number, m = 48): number => {
  const hx = (b - a) / m;
  const hy = (d - c) / m;
  const e = 1e-4 * Math.max(Math.abs(b - a), Math.abs(d - c), 1);
  const w = (k: number) => (k === 0 || k === m ? 1 : k % 2 ? 4 : 2);
  let sum = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= m; j++) {
      const x = a + i * hx;
      const y = c + j * hy;
      const gx = (g(x + e, y) - g(x - e, y)) / (2 * e);
      const gy = (g(x, y + e) - g(x, y - e)) / (2 * e);
      const k = Math.sqrt(1 + gx * gx + gy * gy);
      if (Number.isFinite(k)) sum += w(i) * w(j) * k;
    }
  }
  return (sum * hx * hy) / 9;
};

/** A vector field given as a function F(x, y, z) → [P, Q, R], as plain numbers. */
const fieldFn = (F: any) => (x: number, y: number, z: number): Vec => {
  if (typeof F !== "function") throw new Error("Give the field as a function: F(x, y, z) = [P, Q, R]");
  return v3(F(x, y, z));
};
/**
 * For two planes sharing the edge AB (one through C, one through D): the parts of AC
 * and AD square to the edge, and the edge's middle. The angle between them is the
 * angle between the planes.
 */
const acrossEdge = (A: any, B: any, C: any, D: any): [Vec, Vec, Vec] => {
  const [a, b] = [v3(A), v3(B)];
  const e = sub(b, a);
  const ee = dot(e, e) || 1;
  const off = (X: any) => {
    const x = sub(v3(X), a);
    const k = dot(x, e) / ee;
    return x.map((v, i) => v - k * e[i]);
  };
  return [off(C), off(D), a.map((v, i) => (v + b[i]) / 2)];
};

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
  /**
   * volumeUnder(f(x, y), a, b, c, d[, n]): the volume under a surface over a rectangle,
   * drawn with n × n boxes by the 3D view. Elsewhere it is f itself.
   */
  volumeUnder: (fxy: any) => fxy,
  /**
   * divergence(F, P): ∇·F at the point P, for a field written as a function,
   * F(x, y, z) = [P, Q, R]. Positive where the flow spreads out, negative where it gathers.
   */
  divergence: (F: any, P: any): number => {
    const [x, y, z] = v3(P);
    const f = fieldFn(F);
    const h = 1e-4;
    return (
      (f(x + h, y, z)[0] - f(x - h, y, z)[0]) / (2 * h) +
      (f(x, y + h, z)[1] - f(x, y - h, z)[1]) / (2 * h) +
      (f(x, y, z + h)[2] - f(x, y, z - h)[2]) / (2 * h)
    );
  },
  /** curl(F, P): ∇×F at the point P, the axis (and twice the rate) the flow spins round there. */
  curl: (F: any, P: any): Vec => {
    const [x, y, z] = v3(P);
    const f = fieldFn(F);
    const h = 1e-4;
    const d = (axis: number, comp: number) => {
      const a = [x, y, z];
      const b = [x, y, z];
      a[axis] += h;
      b[axis] -= h;
      return (f(a[0], a[1], a[2])[comp] - f(b[0], b[1], b[2])[comp]) / (2 * h);
    };
    return [d(1, 2) - d(2, 1), d(2, 0) - d(0, 2), d(0, 1) - d(1, 0)];
  },
  /** The normal of the plane through A, B and C: AB × AC. */
  planeNormal: (A: any, B: any, C: any): Vec => {
    const [a, b, c] = [v3(A), v3(B), v3(C)];
    return cross(sub(b, a), sub(c, a));
  },
  /** The foot of the perpendicular from P to the plane through A, B and C. */
  footOnPlane: (P: any, A: any, B: any, C: any): Vec => {
    const [p, a, b, c] = [v3(P), v3(A), v3(B), v3(C)];
    const n = cross(sub(b, a), sub(c, a));
    const k = dot(sub(p, a), n) / dot(n, n);
    return p.map((v, i) => v - k * n[i]);
  },
  /**
   * The angle between two planes that share the edge AB, one through C and one
   * through D, in degrees (0–180).
   */
  planeAngle: (A: any, B: any, C: any, D: any): number => {
    const [u, w] = acrossEdge(A, B, C, D);
    const cosine = dot(u, w) / (len(u) * len(w));
    return Math.acos(Math.max(-1, Math.min(1, cosine))) / DEG;
  },
  /** A point a fraction s of the way round that angle, drawn at the middle of AB, `radius` out. */
  planeArc: (A: any, B: any, C: any, D: any, s: number, radius: number): Vec => {
    const [u, w, m] = acrossEdge(A, B, C, D);
    return GEOMETRY_HELPERS.arcAt(m, m.map((v, i) => v + u[i]), m.map((v, i) => v + w[i]), s, radius);
  },
  /** The plane through A, B and C as an equation: "4x − 5y + 16z = 18". */
  planeEquation: (A: any, B: any, C: any, decimals = 2): string => {
    const [a, b, c] = [v3(A), v3(B), v3(C)];
    let n = cross(sub(b, a), sub(c, a));
    let d0 = dot(n, a);
    // In its simplest form: leading term positive, then whole numbers over their
    // common factor (4x − 6y = 2 → 2x − 3y = 1), or else the smallest term made 1.
    const lead = n.find((v) => Math.abs(v) > 1e-9) ?? 1;
    const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
    const gcd = (p: number, q: number): number => (q ? gcd(q, p % q) : p);
    let k = Math.sign(lead);
    if ([...n, d0].every(whole)) {
      k /= [...n, d0].map((v) => Math.abs(Math.round(v))).reduce(gcd, 0) || 1;
    } else {
      k /= Math.min(...n.filter((v) => Math.abs(v) > 1e-9).map(Math.abs));
    }
    n = n.map((v) => v * k);
    d0 *= k;
    const num = (v: number) => {
      const t = Number(v.toFixed(decimals));
      return Object.is(t, -0) ? 0 : t;
    };
    let out = "";
    n.forEach((v, i) => {
      const k = num(v);
      if (k === 0) return;
      const mag = Math.abs(k) === 1 ? "" : String(Math.abs(k));
      out += out ? (k < 0 ? " − " : " + ") : k < 0 ? "−" : "";
      out += mag + "xyz"[i];
    });
    const d = num(d0);
    return out ? `${out} = ${d < 0 ? "−" : ""}${Math.abs(d)}` : "—";
  },
  /**
   * surfaceArea(f, a, b, c, d): the area of the surface z = f(x, y) over the rectangle
   * a ≤ x ≤ b, c ≤ y ≤ d, for f written as a function, f(x, y) = ….
   */
  surfaceArea: (f: any, a: number, b: number, c: number, d: number): number => {
    if (typeof f !== "function") throw new Error("Give the surface as a function: f(x, y) = …");
    return surfaceAreaOf((x, y) => Number(f(x, y)), a, b, c, d);
  },
  /** Where the line through A and B meets the plane through C, D and E (NaN if they are parallel). */
  linePlane: (A: any, B: any, C: any, D: any, E: any): Vec => {
    const [a, b, c, d, e] = [A, B, C, D, E].map(v3);
    const u = sub(b, a);
    const n = cross(sub(d, c), sub(e, c));
    const den = dot(u, n);
    if (Math.abs(den) < 1e-12 * (len(u) * len(n) || 1)) return [NaN, NaN, NaN];
    const t = dot(sub(c, a), n) / den;
    return a.map((v, i) => v + t * u[i]);
  },
  /**
   * The two points, one on line AB and one on line CD, that are closest together:
   * nearestOnLines(A, B, C, D, 0) is on AB, (…, 1) on CD. The segment between them
   * is square to both lines.
   */
  nearestOnLines: (A: any, B: any, C: any, D: any, which: number): Vec => {
    const [p, q] = nearestPair(A, B, C, D);
    return which ? q : p;
  },
  /** The shortest distance between the lines AB and CD (skew, crossing or parallel). */
  lineDistance: (A: any, B: any, C: any, D: any): number => {
    const [p, q] = nearestPair(A, B, C, D);
    return len(sub(q, p));
  },
  /** A point in space: [x, y] becomes [x, y, 0]. Shapes drawn in 3D use it to join points of either kind. */
  p3: (A: any): Vec => {
    const a = coords(A);
    return [a[0], a[1], a[2] ?? 0];
  },
};

export const GEOMETRY_HELPER_NAMES = Object.keys(GEOMETRY_HELPERS);
