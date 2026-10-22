import * as mathjs from "mathjs";
import { indexHelper } from "./helpers";
import { MathScope } from "../types";

export function createMathScope(base: Record<string, any> | MathScope): MathScope {
  const scope = {
    theta: 0,
    i: mathjs.complex(0, 1),
    e: Math.E,
    pi: Math.PI,
    tau: 2 * Math.PI,
    re: mathjs.re,
    im: mathjs.im,
    real: mathjs.re,
    imag: mathjs.im,
    conj: mathjs.conj,
    arg: mathjs.arg,
    complex: mathjs.complex,
    cis: (angle: number) => mathjs.complex(Math.cos(angle), Math.sin(angle)),
    polar: (r: number, theta: number) => mathjs.complex({ r, phi: theta }),
    ...base,
    ln: mathjs.log,
    log10: mathjs.log10,
    indexHelper,
    Line: (...args: any[]) => args,
    Vector: (...args: any[]) => args,
    Polygon: (...args: any[]) => args,
    Point: (...args: any[]) => args,
  } as MathScope;
  return scope;
}
