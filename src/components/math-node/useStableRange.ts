import { useEffect, useState } from "react";

/**
 * Returns a cached, padded [min, max] range instead of a raw, continuously-changing
 * one (e.g. from a pan/zoom viewport). It only updates — and thus only invalidates
 * anything that depends on it, like an expensive grid recompute — when the live range
 * pans outside the padding, or zooms in enough that the cached span would look
 * visibly coarser than necessary. Ordinary panning/zooming within the padded margin
 * is free: the returned value simply doesn't change.
 */
export function useStableRange(
  liveMin: number,
  liveMax: number,
  padFactor = 0.75,
): [number, number] {
  const [stable, setStable] = useState<[number, number]>(() => {
    const span = liveMax - liveMin;
    const pad = span * padFactor;
    return [liveMin - pad, liveMax + pad];
  });

  useEffect(() => {
    const span = liveMax - liveMin;
    if (!(span > 0)) return;

    const exceedsBounds = liveMin < stable[0] || liveMax > stable[1];
    const stableSpan = stable[1] - stable[0];
    // Zoomed in enough since the last compute that the cached grid would look coarse.
    const zoomedInALot = stableSpan / span > 4;

    if (exceedsBounds || zoomedInALot) {
      const pad = span * padFactor;
      setStable([liveMin - pad, liveMax + pad]);
    }
  }, [liveMin, liveMax, padFactor, stable]);

  return stable;
}
