import { friendlyMathError } from "../../../lib/math/friendlyErrors";

export const resolveNestedValue = (val: any): any => {
  if (!val) return val;
  if (typeof val.toArray === "function") {
    val = val.toArray();
  }
  if (Array.isArray(val)) {
    return val.map((item: any) => resolveNestedValue(item));
  }
  return val;
};

export const indexHelper = (obj: any, ...indices: any[]) => {
  let current = obj;
  if (current && typeof current.toArray === "function") {
    current = current.toArray();
  }
  current = resolveNestedValue(current);

  for (let idx of indices) {
    if (idx && typeof idx.toArray === "function") {
      idx = idx.toArray();
    }
    if (Array.isArray(current)) {
      const numIdx = Number(idx);
      if (!isNaN(numIdx)) {
        current = current[numIdx - 1];
      } else {
        return undefined;
      }
    } else if (current && typeof current === "object") {
      current = current[idx];
    } else {
      return undefined;
    }
  }
  return current;
};

export const formatMathError = (errMessage: string): string =>
  friendlyMathError(errMessage);
