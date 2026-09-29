/**
 * Values measured on the graph (a row's definite integral) for the equations
 * panel to show. The graph computes them while drawing; the panel reads them here.
 */

export interface IntegralMeasurement {
  from: number;
  to: number;
  /** ∫ₐᵇ (f − g): parts below the other curve (or the x-axis) count negative. */
  signed: number;
  /** Total area between them: every part counts positive. */
  area: number;
  /** Name of what it's measured against. */
  against: string;
}

const integrals = new Map<string, IntegralMeasurement>();
const listeners = new Set<() => void>();
let version = 0;
let scheduled = false;

const key = (scope: string, fnId: string) => `${scope}|${fnId}`;

// Batched to once per frame: an animated curve measures itself every frame.
const notify = () => {
  if (scheduled) return;
  scheduled = true;
  const flush = () => {
    scheduled = false;
    version++;
    listeners.forEach((l) => l());
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(flush);
  else setTimeout(flush, 16);
};

const same = (a?: IntegralMeasurement, b?: IntegralMeasurement) =>
  !!a && !!b && a.from === b.from && a.to === b.to && a.signed === b.signed && a.area === b.area && a.against === b.against;

export function setIntegral(scope: string, fnId: string, m: IntegralMeasurement | null) {
  const k = key(scope, fnId);
  if (!m) {
    if (integrals.delete(k)) notify();
    return;
  }
  if (same(integrals.get(k), m)) return;
  integrals.set(k, m);
  notify();
}

export const getIntegral = (scope: string, fnId: string) => integrals.get(key(scope, fnId));

export const subscribeMeasurements = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const measurementsVersion = () => version;
