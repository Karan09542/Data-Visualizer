import * as mathjs from "mathjs";
import { indexHelper } from "./helpers";
import { MathScope } from "../types";

export function createMathScope(base: Record<string, any> | MathScope): MathScope {
  const scope = {
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
