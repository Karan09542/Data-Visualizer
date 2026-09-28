/**
 * Geometry for a zoomable image: where a screen point falls on the picture, and
 * back. Kept apart from the component so it can be tested on its own.
 *
 * All lengths are layout pixels relative to the viewer's container (the space
 * `position: absolute` children use), which stays correct even when an ancestor
 * is CSS-scaled, e.g. a zoomed canvas.
 */

export interface ImageLayout {
  /** The <img> element's untransformed box within the container. */
  boxLeft: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
  /** The picture's own size in pixels. */
  naturalWidth: number;
  naturalHeight: number;
}

export interface ImageTransform {
  /** Pan, applied before the scale (translate3d then scale in CSS). */
  x: number;
  y: number;
  scale: number;
  /** Degrees, clockwise, about the box centre. */
  rotation: number;
}

/**
 * How the picture sits inside its box: `object-fit: contain` letterboxes it. An
 * element sized to its content gives a zero-offset fit, so this covers both.
 */
export function contentFit(l: ImageLayout) {
  const fit = Math.min(l.boxWidth / l.naturalWidth, l.boxHeight / l.naturalHeight);
  const width = l.naturalWidth * fit;
  const height = l.naturalHeight * fit;
  return {
    /** Box pixels per picture pixel at scale 1. */
    fit,
    offsetX: (l.boxWidth - width) / 2,
    offsetY: (l.boxHeight - height) / 2,
  };
}

/** A container point → the picture pixel under it (may fall outside the picture). */
export function containerToImage(px: number, py: number, l: ImageLayout, t: ImageTransform) {
  const { fit, offsetX, offsetY } = contentFit(l);
  const cx = l.boxLeft + l.boxWidth / 2 + t.x;
  const cy = l.boxTop + l.boxHeight / 2 + t.y;
  // Undo translate, scale and rotation (CSS applies them right to left).
  let vx = (px - cx) / t.scale;
  let vy = (py - cy) / t.scale;
  const a = (-t.rotation * Math.PI) / 180;
  [vx, vy] = [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
  const localX = vx + l.boxWidth / 2;
  const localY = vy + l.boxHeight / 2;
  return { x: (localX - offsetX) / fit, y: (localY - offsetY) / fit };
}

/** A picture pixel → where it is in the container right now. */
export function imageToContainer(ix: number, iy: number, l: ImageLayout, t: ImageTransform) {
  const { fit, offsetX, offsetY } = contentFit(l);
  let vx = offsetX + ix * fit - l.boxWidth / 2;
  let vy = offsetY + iy * fit - l.boxHeight / 2;
  const a = (t.rotation * Math.PI) / 180;
  [vx, vy] = [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
  return {
    x: l.boxLeft + l.boxWidth / 2 + t.x + vx * t.scale,
    y: l.boxTop + l.boxHeight / 2 + t.y + vy * t.scale,
  };
}

/** On-screen pixels per picture pixel: 1 means the picture is shown at its real size. */
export const displayRatio = (l: ImageLayout, t: ImageTransform) => contentFit(l).fit * t.scale;

/**
 * The pan that keeps the container point (px, py) fixed while the scale changes
 * from `t.scale` to `nextScale` — zooming toward the pointer.
 */
export function panForZoomAt(px: number, py: number, l: ImageLayout, t: ImageTransform, nextScale: number) {
  const cx = l.boxLeft + l.boxWidth / 2;
  const cy = l.boxTop + l.boxHeight / 2;
  const k = nextScale / t.scale;
  return {
    x: px - cx - (px - cx - t.x) * k,
    y: py - cy - (py - cy - t.y) * k,
  };
}
