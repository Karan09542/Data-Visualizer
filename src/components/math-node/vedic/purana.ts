/**
 * Puranapuranabhyam: "by completion or non-completion".
 *
 * Square:  x² + 6x − 7 = 0. x² + 6x needs +9 to be complete: (x + 3)² = 9 + 7 = 16,
 *          x + 3 = ±4, x = 1 or −7.
 * Cube:    x³ + 6x² + 11x + 6 = 0. (x + 2)³ = x³ + 6x² + 12x + 8, so the equation is
 *          (x + 2)³ − (x + 2) = 0. With y = x + 2: y³ = y, y = 0, ±1, x = −2, −1, −3.
 */
import { Q } from "./shunyam";

const MINUS = "−";

function isqrt(n: number): number | null {
  const r = Math.round(Math.sqrt(n));
  return r * r === n ? r : null;
}

/** coef·√rad, with rad square-free; rad = 1 means a plain number. */
export interface Surd {
  coef: Q;
  rad: number;
}

/** √v for v ≥ 0, simplified: √8 = 2√2, √(1/4) = 1/2, √(13/4) = √13/2. */
export function sqrtQ(v: Q): Surd {
  if (v.zero) return { coef: new Q(0), rad: 1 };
  // √(n/d) = √(n·d) / d
  let inside = v.n * v.d;
  let out = 1;
  for (let f = 2; f * f <= inside; f++)
    while (inside % (f * f) === 0) {
      inside /= f * f;
      out *= f;
    }
  return { coef: new Q(out, v.d), rad: inside };
}

/** "4", "√5", "2√2", "√13/2", "3√5/2" */
export function surdText(s: Surd): string {
  if (s.rad === 1) return s.coef.toString();
  const top = s.coef.n === 1 ? `√${s.rad}` : `${s.coef.n}√${s.rad}`;
  return s.coef.d === 1 ? top : `${top}/${s.coef.d}`;
}

/** "x + 2", "x − 1/3", "x" */
export function xPlusQ(h: Q): string {
  if (h.zero) return "x";
  return h.n < 0 ? `x ${MINUS} ${h.mul(-1)}` : `x + ${h}`;
}

/** A polynomial from its coefficients, highest power first: [1, 6, 11, 6] → "x³ + 6x² + 11x + 6". */
export function polyText(coeffs: Q[], v = "x"): string {
  const deg = coeffs.length - 1;
  const pow = (k: number) => (k === 0 ? "" : k === 1 ? v : `${v}${[...String(k)].map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]).join("")}`);
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    const k = deg - i;
    if (c.zero) return;
    const abs = c.n < 0 ? c.mul(-1) : c;
    const body = k > 0 && abs.eq(1) ? pow(k) : `${abs}${pow(k)}`;
    if (!parts.length) parts.push(c.n < 0 ? `${MINUS}${body}` : body);
    else parts.push(c.n < 0 ? `${MINUS} ${body}` : `+ ${body}`);
  });
  return parts.length ? parts.join(" ") : "0";
}

/** A root: either exact, or h ± a square root. */
export interface Root {
  text: string;
  value: Q | null;
}

export function rootsAround(center: Q, s: Surd): Root[] {
  if (s.coef.zero) return [{ text: center.toString(), value: center }];
  if (s.rad === 1) {
    const hi = center.add(s.coef);
    const lo = center.add(s.coef.mul(-1));
    return [hi, lo].map((v) => ({ text: v.toString(), value: v }));
  }
  const c = center.zero ? "" : `${center} `;
  return [
    { text: `${c}${center.zero ? "" : "+ "}${surdText(s)}`, value: null },
    { text: `${c}${MINUS}${center.zero ? "" : " "}${surdText(s)}`, value: null },
  ];
}

// ─── Square ────────────────────────────────────────────────────────────────────

export interface SquarePlan {
  b: number;
  c: number;
  /** Half the x number. */
  h: Q;
  /** What completes the square: h². */
  need: Q;
  /** (x + h)² = D */
  D: Q;
  /** √D, when D ≥ 0. */
  root: Surd | null;
  roots: Root[];
}

export function planSquare(b: number, c: number): SquarePlan {
  const h = new Q(b, 2);
  const need = h.mul(h);
  const D = need.add(-c);
  const root = D.n >= 0 ? sqrtQ(D) : null;
  const roots = root ? rootsAround(h.mul(-1), root) : [];
  return { b, c, h, need, D, root, roots };
}

// ─── Cube ──────────────────────────────────────────────────────────────────────

export interface CubePlan {
  a: number;
  b: number;
  c: number;
  /** A third of the x² number. */
  h: Q;
  /** (x + h)³ = x³ + 3h·x² + 3h²·x + h³ */
  cube: [Q, Q, Q];
  /** Equation − (x + h)³ = k·x + rest */
  k: Q;
  rest: Q;
  /** rest = k·h: the equation is (x + h)³ + k(x + h). */
  complete: boolean;
  /** y² = −k, when it has real roots. */
  ySq: Q;
  y: Surd | null;
  roots: Root[];
}

export function planCube(a: number, b: number, c: number): CubePlan {
  const h = new Q(a, 3);
  const cube: [Q, Q, Q] = [h.mul(3), h.mul(h).mul(3), h.mul(h).mul(h)];
  const k = new Q(b).add(cube[1].mul(-1));
  const rest = new Q(c).add(cube[2].mul(-1));
  const complete = rest.eq(k.mul(h));
  const ySq = k.mul(-1);
  const y = complete && ySq.n >= 0 ? sqrtQ(ySq) : null;
  const minusH = h.mul(-1);
  let roots: Root[] = [];
  if (complete) {
    roots = [{ text: minusH.toString(), value: minusH }];
    if (y && !y.coef.zero) roots.push(...rootsAround(minusH, y));
  }
  return { a, b, c, h, cube, k, rest, complete, ySq, y, roots };
}

/** p(x) for coefficients highest first. */
export function evalPoly(coeffs: Q[], x: Q): Q {
  return coeffs.reduce((acc, c) => acc.mul(x).add(c), new Q(0));
}
