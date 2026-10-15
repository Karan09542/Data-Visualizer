/**
 * Safely extracts pointer coordinates [x, y] in the coordinate space of the container element.
 * Fully compatible with TouchEvent on mobile devices, PointerEvent, MouseEvent, and D3DragEvent.
 * Prevents "Failed to set the 'x' property on 'SVGPoint': The provided float value is non-finite"
 * which occurs when standard d3.pointer tries to read clientX/clientY directly from TouchEvent objects.
 */
export function getSafePointer(
  event: any,
  container: Element | SVGSVGElement | null
): [number, number] {
  if (!container) return [0, 0];

  // 1. Unwrap sourceEvent chain if present (e.g. from D3 drag events)
  let evt = event;
  while (evt && evt.sourceEvent) {
    evt = evt.sourceEvent;
  }

  // 2. Extract clientX and clientY reliably across TouchEvent, PointerEvent, MouseEvent
  let clientX = evt?.clientX;
  let clientY = evt?.clientY;

  // In TouchEvent, clientX/clientY are on touches[0] or changedTouches[0]
  if ((clientX === undefined || isNaN(clientX)) && evt?.touches && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  }
  if ((clientX === undefined || isNaN(clientX)) && evt?.changedTouches && evt.changedTouches.length > 0) {
    clientX = evt.changedTouches[0].clientX;
    clientY = evt.changedTouches[0].clientY;
  }
  if ((clientX === undefined || isNaN(clientX)) && evt?.targetTouches && evt.targetTouches.length > 0) {
    clientX = evt.targetTouches[0].clientX;
    clientY = evt.targetTouches[0].clientY;
  }

  // Fallback to D3's calculated x/y if clientX/clientY are still missing/non-finite
  if (typeof clientX !== 'number' || !isFinite(clientX) || typeof clientY !== 'number' || !isFinite(clientY)) {
    if (typeof event?.x === 'number' && isFinite(event.x) && typeof event?.y === 'number' && isFinite(event.y)) {
      return [event.x, event.y];
    }
    return [0, 0];
  }

  // 3. Transform to SVG coordinate space of container using getScreenCTM
  try {
    const svg = (container as SVGElement).ownerSVGElement || (container as SVGSVGElement);
    if (svg && typeof svg.createSVGPoint === 'function' && typeof (container as any).getScreenCTM === 'function') {
      const ctm = (container as any).getScreenCTM();
      if (ctm) {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const transformed = point.matrixTransform(ctm.inverse());
        if (isFinite(transformed.x) && isFinite(transformed.y)) {
          return [transformed.x, transformed.y];
        }
      }
    }
  } catch (err) {
    // Matrix inversion can fail if element is unmounted or has singular transform
  }

  // 4. Fallback: getBoundingClientRect
  try {
    if (typeof container.getBoundingClientRect === 'function') {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (isFinite(x) && isFinite(y)) {
        return [x, y];
      }
    }
  } catch (err) {
    // Ignore fallback errors
  }

  return [clientX, clientY];
}
