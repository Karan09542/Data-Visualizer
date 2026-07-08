import * as mathjs from "mathjs";
import { Registry } from "./registry";
import { MathScope } from "./types";

export interface CancellationToken {
  readonly isCancelled: boolean;
  throwIfCancelled(): void;
}

export interface MathWorkerContext {
  registry: Registry;
  math: typeof mathjs;
  createMathScope(base: Record<string, any> | MathScope): MathScope;
  cancellationToken: CancellationToken;
}
