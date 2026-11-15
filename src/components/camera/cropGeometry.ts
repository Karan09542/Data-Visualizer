/**
 * Geometry for the photo crop screen. Positions are normalised to the picture being
 * cropped: (0, 0) its top-left corner, (1, 1) its bottom-right. Pure, so it can be tested.
 */

export interface NRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Which handle is held. */
export type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const FULL: NRect = { x0: 0, y0: 0, x1: 1, y1: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where a picture of this size sits when fitted (object-fit: contain) in a box. */
export function fitContain(imgW: number, imgH: number, boxW: number, boxH: number) {
  if (!(imgW > 0 && imgH > 0 && boxW > 0 && boxH > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  const k = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * k;
  const height = imgH * k;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

/**
 * The largest upright rectangle inside a w × h picture turned by `angle` radians: the
 * part of a straightened photo with no empty corners. Returned centred, normalised to the
 * turned picture's bounding box (which is what the crop screen shows).
 */
export function inscribedBounds(w: number, h: number, angle: number): NRect {
  const a = Math.abs(angle) % Math.PI;
  const t = a > Math.PI / 2 ? Math.PI - a : a;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  if (sin < 1e-9) return FULL;
  // The turned picture's box.
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  // Largest axis-aligned rectangle within the turned w × h rectangle (known closed form).
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  let rw: number;
  let rh: number;
  if (short <= 2 * sin * cos * long || Math.abs(sin - cos) < 1e-10) {
    // Half-constrained: two corners of the inner rectangle touch the long side.
    const x = 0.5 * short;
    [rw, rh] = w >= h ? [x / sin, x / cos] : [x / cos, x / sin];
  } else {
    const cos2 = cos * cos - sin * sin;
    rw = (w * cos - h * sin) / cos2;
    rh = (h * cos - w * sin) / cos2;
  }
  const nx = rw / bw / 2;
  const ny = rh / bh / 2;
  return { x0: 0.5 - nx, y0: 0.5 - ny, x1: 0.5 + nx, y1: 0.5 + ny };
}

/** The frame kept inside `b`: moved in if it can be, shrunk if it is bigger. */
export function clampInto(r: NRect, b: NRect): NRect {
  const w = Math.min(r.x1 - r.x0, b.x1 - b.x0);
  const h = Math.min(r.y1 - r.y0, b.y1 - b.y0);
  const x0 = clamp(r.x0, b.x0, b.x1 - w);
  const y0 = clamp(r.y0, b.y0, b.y1 - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** The frame moved by (dx, dy), staying inside `b`. */
export function moveRect(r: NRect, dx: number, dy: number, b: NRect): NRect {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const x0 = clamp(r.x0 + dx, b.x0, b.x1 - w);
  const y0 = clamp(r.y0 + dy, b.y0, b.y1 - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/**
 * The frame with one handle dragged to `p`; the opposite side or corner stays put.
 * `ratio` is width / height *in normalised units* (for a picture W × H and a wanted
 * shape A, that is A · H / W); null for a free shape. Never smaller than `min` (normalised),
 * never outside `b`.
 */
export function resizeRect(
  r: NRect,
  handle: CropHandle,
  p: { x: number; y: number },
  ratio: number | null,
  b: NRect,
  min = 0.04,
): NRect {
  const px = clamp(p.x, b.x0, b.x1);
  const py = clamp(p.y, b.y0, b.y1);
  let { x0, y0, x1, y1 } = r;
  const W = handle.includes("w");
  const E = handle.includes("e");
  const N = handle.includes("n");
  const S = handle.includes("s");

  if (!ratio) {
    if (W) x0 = Math.min(px, x1 - min);
    if (E) x1 = Math.max(px, x0 + min);
    if (N) y0 = Math.min(py, y1 - min);
    if (S) y1 = Math.max(py, y0 + min);
    return { x0, y0, x1, y1 };
  }

  const shrinkToFit = (w: number, h: number, roomW: number, roomH: number) => {
    const k = Math.min(1, roomW / w, roomH / h);
    w *= k;
    h *= k;
    if (w < min || h < min) {
      const g = Math.max(min / w, min / h);
      w *= g;
      h *= g;
    }
    return [w, h];
  };

  if ((W || E) && (N || S)) {
    // A corner: the opposite corner stays; the bigger move sets the size, in shape.
    const ax = W ? x1 : x0;
    const ay = N ? y1 : y0;
    let w = Math.abs(px - ax);
    let h = Math.abs(py - ay);
    if (w / ratio > h) h = w / ratio;
    else w = h * ratio;
    [w, h] = shrinkToFit(w, h, W ? ax - b.x0 : b.x1 - ax, N ? ay - b.y0 : b.y1 - ay);
    return { x0: W ? ax - w : ax, y0: N ? ay - h : ay, x1: W ? ax : ax + w, y1: N ? ay : ay + h };
  }
  if (W || E) {
    // A side: its own length from the pointer, the other way about the middle.
    const ax = W ? x1 : x0;
    const cy = (y0 + y1) / 2;
    let w = Math.max(min, Math.abs(px - ax));
    let h = w / ratio;
    [w, h] = shrinkToFit(w, h, W ? ax - b.x0 : b.x1 - ax, 2 * Math.min(cy - b.y0, b.y1 - cy));
    return { x0: W ? ax - w : ax, y0: cy - h / 2, x1: W ? ax : ax + w, y1: cy + h / 2 };
  }
  const ay = N ? y1 : y0;
  const cx = (x0 + x1) / 2;
  let h = Math.max(min, Math.abs(py - ay));
  let w = h * ratio;
  [w, h] = shrinkToFit(w, h, 2 * Math.min(cx - b.x0, b.x1 - cx), N ? ay - b.y0 : b.y1 - ay);
  return { x0: cx - w / 2, y0: N ? ay - h : ay, x1: cx + w / 2, y1: N ? ay : ay + h };
}

/** The largest frame of this shape (normalised ratio) inside `b`, centred on `around`. */
export function fitRatio(ratio: number, b: NRect, around?: NRect): NRect {
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  let w = bw;
  let h = w / ratio;
  if (h > bh) {
    h = bh;
    w = h * ratio;
  }
  const cx = around ? (around.x0 + around.x1) / 2 : (b.x0 + b.x1) / 2;
  const cy = around ? (around.y0 + around.y1) / 2 : (b.y0 + b.y1) / 2;
  const x0 = clamp(cx - w / 2, b.x0, b.x1 - w);
  const y0 = clamp(cy - h / 2, b.y0, b.y1 - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** A rectangle as the four corners the perspective tools use (TL, TR, BR, BL). */
export const rectCorners = (r: NRect) => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
];

/** The box round four corners. */
export const cornersRect = (c: { x: number; y: number }[]): NRect => ({
  x0: Math.min(...c.map((p) => p.x)),
  y0: Math.min(...c.map((p) => p.y)),
  x1: Math.max(...c.map((p) => p.x)),
  y1: Math.max(...c.map((p) => p.y)),
});
