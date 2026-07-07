import { MathWorkerHandler } from "../types";

const determinant: MathWorkerHandler<{ matrix: any }> = (payload, context) => {
  context.cancellationToken.throwIfCancelled();
  return { result: context.math.det(payload.matrix) };
};

export default {
  determinant,
};
