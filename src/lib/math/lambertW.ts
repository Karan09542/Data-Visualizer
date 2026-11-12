import { lambertW0 as libLambertW0, W0_LIMIT_POINT } from "lambert-w-function";
import * as mathjs from "mathjs";

type ComplexLike = {
  re: number;
  im: number;
  isComplex?: boolean;
};

const NEG_INV_E = W0_LIMIT_POINT; // -1 / Math.E
const REAL_EPS = 1e-15;
const COMPLEX_TOL = 1e-14;
const MAX_HALLEY_ITERS = 64;

function isBigNumber(v: unknown): v is { isBigNumber: true; toString(): string } {
  return Boolean(v && typeof v === "object" && (v as { isBigNumber?: boolean }).isBigNumber);
}

function isComplexValue(v: unknown): v is ComplexLike {
  return Boolean(
    v &&
      typeof v === "object" &&
      ((v as ComplexLike).isComplex ||
        (typeof (v as ComplexLike).re === "number" && typeof (v as ComplexLike).im === "number")),
  );
}

function isMatrixValue(v: unknown): v is { isMatrix: true; map: (fn: (x: unknown) => unknown) => unknown } {
  return Boolean(v && typeof v === "object" && (v as { isMatrix?: boolean }).isMatrix);
}

function unwrapReal(v: unknown): number {
  if (typeof v === "number") return v;
  if (isBigNumber(v)) return Number(v.toString());
  if (isComplexValue(v)) return v.im === 0 ? v.re : NaN;
  return Number(v);
}

/**
 * Real principal branch W_0(x) backed by `lambert-w-function`, with explicit
 * boundary guards so exact branch-point / zero / infinity inputs never drift.
 */
function realLambertW0(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return 0;
  if (x === Infinity) return Infinity;
  if (x < NEG_INV_E) {
    // Allow tiny floating-point overshoot right at -1/e.
    if (x >= NEG_INV_E - REAL_EPS) return -1;
    return NaN;
  }
  return libLambertW0(x);
}

/**
 * Real secondary branch W_{-1}(x) on [-1/e, 0) using Halley's method.
 */
function realLambertWm1(x: number): number {
  if (Number.isNaN(x) || x > 0) return NaN;
  if (x === 0) return -Infinity;
  if (x < NEG_INV_E) {
    if (x >= NEG_INV_E - REAL_EPS) return -1;
    return NaN;
  }
  if (Math.abs(x - NEG_INV_E) <= REAL_EPS) return -1;

  // Initial guess: branch-point series near -1/e, log-asymptotic near 0^-.
  let w: number;
  if (x < -0.333) {
    const p = -Math.sqrt(Math.max(0, 2 * (Math.E * x + 1)));
    w = -1 + p - (p * p) / 3 + (11 / 72) * p * p * p;
  } else {
    const l1 = Math.log(-x);
    const l2 = Math.log(-l1);
    w = l1 - l2 + l2 / l1;
  }

  for (let i = 0; i < MAX_HALLEY_ITERS; i++) {
    const ew = Math.exp(w);
    const wew = w * ew;
    const f = wew - x;
    const fp = ew * (w + 1);
    if (fp === 0) break;
    const dw = f / (fp - (ew * (w + 2) * f) / (2 * fp));
    w -= dw;
    if (Math.abs(dw) <= COMPLEX_TOL * (1 + Math.abs(w))) break;
  }
  return w;
}

/**
 * Complex Lambert W_k(z) via Halley's method (Corless et al., 1996).
 */
function complexLambertW(k: number, re: number, im: number) {
  if (Number.isNaN(re) || Number.isNaN(im)) {
    return mathjs.complex(NaN, NaN);
  }
  if (re === 0 && im === 0) {
    return k === 0 ? mathjs.complex(0, 0) : mathjs.complex(-Infinity, 0);
  }

  let wr: number;
  let wi: number;

  // Pick a branch-aware initial guess.
  const distBranch = Math.hypot(re - NEG_INV_E, im);
  if (distBranch < 0.25 && (k === 0 || k === -1)) {
    // p = sqrt(2*(e*z + 1)), using -p for k = -1 when on/below cut.
    const a = 2 * (Math.E * re + 1);
    const b = 2 * Math.E * im;
    const mag = Math.hypot(a, b);
    let pr = Math.sqrt(0.5 * (mag + a));
    let pi = (b >= 0 ? 1 : -1) * Math.sqrt(0.5 * (mag - a));
    if (k === -1) {
      pr = -pr;
      pi = -pi;
    }
    wr = -1 + pr - (pr * pr - pi * pi) / 3;
    wi = pi - (2 * pr * pi) / 3;
  } else if (k === 0 && Math.hypot(re, im) < 0.5) {
    wr = re * (1 - re);
    wi = im * (1 - 2 * re);
  } else {
    // Asymptotic log(z) + 2*pi*i*k - log(log(z) + 2*pi*i*k)
    const lr = Math.log(Math.hypot(re, im));
    const li = Math.atan2(im, re) + 2 * Math.PI * k;
    const llr = Math.log(Math.hypot(lr, li));
    const lli = Math.atan2(li, lr);
    wr = lr - llr;
    wi = li - lli;
  }

  for (let i = 0; i < MAX_HALLEY_ITERS; i++) {
    const expR = Math.exp(wr);
    const cosI = Math.cos(wi);
    const sinI = Math.sin(wi);
    const er = expR * cosI;
    const ei = expR * sinI;

    // f = w*e^w - z
    const fr = wr * er - wi * ei - re;
    const fi = wr * ei + wi * er - im;

    // wp1 = w + 1, f' = e^w * (w + 1)
    const wp1r = wr + 1;
    const wp1i = wi;
    const fpr = er * wp1r - ei * wp1i;
    const fpi = er * wp1i + ei * wp1r;
    const fpMag2 = fpr * fpr + fpi * fpi;
    if (fpMag2 === 0) break;

    // Halley correction: f / (f' - f''*f / (2*f')) where f'' = e^w * (w + 2)
    // Equivalent scaled form: w - f / (f' - ((w + 2) / (2*(w + 1))) * f)
    const wp2r = wr + 2;
    const wp2i = wi;
    const wp1Mag2 = wp1r * wp1r + wp1i * wp1i;
    const rr = (wp2r * wp1r + wp2i * wp1i) / (2 * wp1Mag2);
    const ri = (wp2i * wp1r - wp2r * wp1i) / (2 * wp1Mag2);

    const dr = fpr - (rr * fr - ri * fi);
    const di = fpi - (rr * fi + ri * fr);
    const dMag2 = dr * dr + di * di;
    if (dMag2 === 0) break;

    const dwr = (fr * dr + fi * di) / dMag2;
    const dwi = (fi * dr - fr * di) / dMag2;
    wr -= dwr;
    wi -= dwi;

    if (Math.hypot(dwr, dwi) <= COMPLEX_TOL * (1 + Math.hypot(wr, wi))) break;
  }

  return mathjs.complex(wr, Math.abs(wi) < 1e-15 ? 0 : wi);
}

function evalScalar(k: number, z: unknown): unknown {
  if (!Number.isInteger(k)) return NaN;

  if (isComplexValue(z)) {
    return complexLambertW(k, z.re, z.im);
  }

  const x = unwrapReal(z);
  if (k === 0) return realLambertW0(x);
  if (k === -1) return realLambertWm1(x);
  return NaN;
}

/**
 * Evaluates the Lambert W / ProductLog function.
 * Supports 1-argument `productLog(z)` (principal branch k = 0) and
 * 2-argument `productLog(k, z)` (branch k, supporting k = 0, k = -1, and complex z).
 */
export function productLog(arg1: unknown, arg2?: unknown): unknown {
  if (arg2 === undefined) {
    if (Array.isArray(arg1)) return arg1.map((item) => productLog(item));
    if (isMatrixValue(arg1)) return arg1.map((item) => productLog(item));
    return evalScalar(0, arg1);
  }

  const k = Math.trunc(unwrapReal(arg1));
  if (Array.isArray(arg2)) return arg2.map((item) => evalScalar(k, item));
  if (isMatrixValue(arg2)) return arg2.map((item) => evalScalar(k, item));
  return evalScalar(k, arg2);
}

/**
 * Real principal branch Lambert W_0(x), exported directly for explicit W_0 calls.
 */
export function lambertW0(z: unknown): unknown {
  return productLog(z);
}

/**
 * Shared mathjs scope entries exposed across main-thread, worker, and calculator evaluation.
 */
export const LAMBERT_W_SCOPE = {
  productLog,
  productlog: productLog,
  lambertW: productLog,
  lambertw: productLog,
  lambertW0,
} as const;

export const LAMBERT_W_NAMES = Object.keys(LAMBERT_W_SCOPE);

/**
 * Formats Lambert W / ProductLog FunctionNodes into standard mathematical LaTeX (`W(...)` / `W_k(...)`).
 */
export function lambertWToTex(node: any, options?: any): string | undefined {
  if (!node?.isFunctionNode) return undefined;
  const fnName = node.fn?.name;
  if (!fnName || !(fnName in LAMBERT_W_SCOPE)) return undefined;
  const args = Array.isArray(node.args) ? node.args : [];
  if (fnName === "lambertW0" && args.length >= 1) {
    return `W_{0}\\left(${args[0].toTex(options)}\\right)`;
  }
  if (args.length === 2) {
    return `W_{${args[0].toTex(options)}}\\left(${args[1].toTex(options)}\\right)`;
  }
  if (args.length >= 1) {
    return `W\\left(${args[0].toTex(options)}\\right)`;
  }
  return undefined;
}
