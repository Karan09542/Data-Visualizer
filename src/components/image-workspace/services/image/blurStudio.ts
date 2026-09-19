/**
 * The pixel work behind Blur Studio: a blurred copy of the image, a mask saying how much of that
 * blur each pixel gets, and the two mixed.
 *
 * Everything here is plain canvas; the hook decides the geometry and where the result goes.
 */

export type BlurType = 'gaussian' | 'radial' | 'linear';

/**
 * Where the sharp area is, in the pixel space of the canvas being blurred.
 *
 * Sizes are fractions of `refSize` - the longer side of the visible image - so the same settings
 * look the same on a thumbnail and on a 6000px photo.
 */
export interface BlurGeometry {
  type: BlurType;
  refSize: number;
  // Iris (radial)
  centerX: number;
  centerY: number;
  /** Radius of the sharp circle, as a fraction of refSize. */
  focusSize: number;
  /** Width of the fade from sharp to fully blurred, outside the circle. */
  feather: number;
  // Tilt-shift (linear)
  bandCenterX: number;
  bandCenterY: number;
  /** Direction the sharp band runs in, radians. */
  bandAngle: number;
  /** Half the band's thickness, as a fraction of refSize. */
  bandWidth: number;
  /** Width of the fade on either side of the band. */
  bandFeather: number;
}

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
};

let filterSupport: boolean | null = null;

/** Whether this browser blurs through `ctx.filter`. Older Safari silently ignores it. */
const supportsCanvasFilter = (): boolean => {
  if (filterSupport !== null) return filterSupport;
  try {
    const c = makeCanvas(5, 5);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.filter = 'blur(1px)';
    ctx.fillStyle = '#000';
    ctx.fillRect(2, 2, 1, 1);
    // A working blur spreads the dot to its neighbour; an ignored filter leaves it untouched.
    filterSupport = ctx.getImageData(1, 2, 1, 1).data[3] > 0;
  } catch {
    filterSupport = false;
  }
  return filterSupport;
};

/**
 * A copy of the image with its outermost pixels repeated outwards by `pad`.
 *
 * Blurring spreads each pixel over its neighbours; at the border there are none, so the edge of a
 * plain blur fades to transparent. Repeating the edge pixels gives the blur something to spread.
 */
const withRepeatedEdges = (source: CanvasImageSource, width: number, height: number, pad: number): HTMLCanvasElement => {
  const out = makeCanvas(width + pad * 2, height + pad * 2);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, pad, pad, width, height);
  if (pad > 0) {
    const w = width;
    const h = height;
    // Sides: a one-pixel strip stretched across the padding.
    ctx.drawImage(out, pad, pad, 1, h, 0, pad, pad, h);
    ctx.drawImage(out, pad + w - 1, pad, 1, h, pad + w, pad, pad, h);
    ctx.drawImage(out, pad, pad, w, 1, pad, 0, w, pad);
    ctx.drawImage(out, pad, pad + h - 1, w, 1, pad, pad + h, w, pad);
    // Corners: the corner pixel stretched over the corner square.
    ctx.drawImage(out, pad, pad, 1, 1, 0, 0, pad, pad);
    ctx.drawImage(out, pad + w - 1, pad, 1, 1, pad + w, 0, pad, pad);
    ctx.drawImage(out, pad, pad + h - 1, 1, 1, 0, pad + h, pad, pad);
    ctx.drawImage(out, pad + w - 1, pad + h - 1, 1, 1, pad + w, pad + h, pad, pad);
  }
  return out;
};

/** One pass of a box blur along rows (horizontal) or columns, on premultiplied RGBA. */
const boxPass = (src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) => {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 4 : w * 4;
  const norm = 1 / (r * 2 + 1);
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w * 4 : line * 4;
    for (let c = 0; c < 4; c++) {
      // Running sum over the window, with the edge value repeated past either end.
      const at = (i: number) => src[base + Math.min(len - 1, Math.max(0, i)) * step + c];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < len; i++) {
        dst[base + i * step + c] = sum * norm;
        sum += at(i + r + 1) - at(i - r);
      }
    }
  }
};

/**
 * Blur without `ctx.filter`: three box blurs approximate a Gaussian. Worked on a smaller copy for
 * large radii - a wide blur has no fine detail to lose - then scaled back up smoothly.
 */
const softwareBlur = (source: HTMLCanvasElement, radius: number): HTMLCanvasElement => {
  const shrink = Math.max(1, radius / 6);
  const sw = Math.max(1, Math.round(source.width / shrink));
  const sh = Math.max(1, Math.round(source.height / shrink));
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, 0, 0, sw, sh);

  const img = sctx.getImageData(0, 0, sw, sh);
  const px = img.data;
  const a = new Float32Array(px.length);
  const b = new Float32Array(px.length);
  // Premultiplied, so transparent pixels do not darken what they are averaged with.
  for (let i = 0; i < px.length; i += 4) {
    const alpha = px[i + 3] / 255;
    a[i] = px[i] * alpha;
    a[i + 1] = px[i + 1] * alpha;
    a[i + 2] = px[i + 2] * alpha;
    a[i + 3] = px[i + 3];
  }
  // Three box passes of this size have about the spread of a Gaussian with sigma = radius.
  const r = Math.max(1, Math.round((radius / shrink) * 0.87));
  for (let pass = 0; pass < 3; pass++) {
    boxPass(a, b, sw, sh, r, true);
    boxPass(b, a, sw, sh, r, false);
  }
  for (let i = 0; i < px.length; i += 4) {
    const alpha = a[i + 3];
    const k = alpha > 0 ? 255 / alpha : 0;
    px[i] = a[i] * k;
    px[i + 1] = a[i + 1] * k;
    px[i + 2] = a[i + 2] * k;
    px[i + 3] = alpha;
  }
  sctx.putImageData(img, 0, 0);

  const out = makeCanvas(source.width, source.height);
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
};

/**
 * The whole image blurred by `radius` pixels, the same size as the source and without the faded
 * border a plain blur leaves.
 */
export const blurCanvas = (source: HTMLCanvasElement, radius: number): HTMLCanvasElement => {
  const { width, height } = source;
  if (radius <= 0.05) {
    const copy = makeCanvas(width, height);
    copy.getContext('2d')!.drawImage(source, 0, 0);
    return copy;
  }
  const pad = Math.ceil(radius * 3);
  const padded = withRepeatedEdges(source, width, height, pad);

  let blurredPadded: HTMLCanvasElement;
  if (supportsCanvasFilter()) {
    blurredPadded = makeCanvas(padded.width, padded.height);
    const ctx = blurredPadded.getContext('2d')!;
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(padded, 0, 0);
    ctx.filter = 'none';
  } else {
    blurredPadded = softwareBlur(padded, radius);
  }

  const out = makeCanvas(width, height);
  out.getContext('2d')!.drawImage(blurredPadded, pad, pad, width, height, 0, 0, width, height);
  return out;
};

/**
 * Adds a smooth fade to a gradient between two offsets. A straight ramp shows a visible edge where
 * it starts and stops; an eased one blends in, like a real lens.
 */
const addEase = (grad: CanvasGradient, from: number, to: number, fromAlpha: number, toAlpha: number) => {
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    const offset = Math.min(1, Math.max(0, from + (to - from) * t));
    const alpha = fromAlpha + (toAlpha - fromAlpha) * eased;
    grad.addColorStop(offset, `rgba(255,255,255,${alpha.toFixed(4)})`);
  }
};

/**
 * How much blur each pixel gets: white is fully blurred, transparent is sharp.
 * Null means "blur everything" - a Gaussian blur with no selection.
 */
export const buildBlurMask = (
  width: number,
  height: number,
  geom: BlurGeometry,
  selectionMask: HTMLCanvasElement | null,
): HTMLCanvasElement | null => {
  if (geom.type === 'gaussian' && !selectionMask) return null;

  const mask = makeCanvas(width, height);
  const ctx = mask.getContext('2d')!;
  const ref = Math.max(1, geom.refSize);

  if (geom.type === 'gaussian') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  } else if (geom.type === 'radial') {
    const inner = Math.max(0, geom.focusSize * ref);
    const outer = Math.max(inner + 1, (geom.focusSize + geom.feather) * ref);
    // Inside the inner circle the gradient keeps its first colour, beyond the outer its last:
    // one fill covers the whole image.
    const grad = ctx.createRadialGradient(geom.centerX, geom.centerY, inner, geom.centerX, geom.centerY, outer);
    addEase(grad, 0, 1, 0, 1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const half = Math.max(0, geom.bandWidth * ref);
    const spread = Math.max(half + 1, half + geom.bandFeather * ref);
    // The fade runs across the band, at right angles to its direction.
    const px = Math.cos(geom.bandAngle + Math.PI / 2);
    const py = Math.sin(geom.bandAngle + Math.PI / 2);
    const grad = ctx.createLinearGradient(
      geom.bandCenterX - px * spread, geom.bandCenterY - py * spread,
      geom.bandCenterX + px * spread, geom.bandCenterY + py * spread,
    );
    const sharpFrom = 0.5 - half / (spread * 2);
    const sharpTo = 0.5 + half / (spread * 2);
    addEase(grad, 0, sharpFrom, 1, 0);
    addEase(grad, sharpTo, 1, 0, 1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  if (selectionMask) {
    // Blur only happens inside the selection.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(selectionMask, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return mask;
};

/**
 * The original and the blurred copy mixed through the mask: each pixel is
 * original × (1 − mask) + blurred × mask. Drawing one over the other instead would let a sharp
 * edge show through wherever the blurred copy is partly transparent.
 */
export const composeBlur = (
  original: HTMLCanvasElement,
  blurred: HTMLCanvasElement,
  mask: HTMLCanvasElement | null,
): HTMLCanvasElement => {
  const { width, height } = original;
  const out = makeCanvas(width, height);
  const ctx = out.getContext('2d')!;
  if (!mask) {
    ctx.drawImage(blurred, 0, 0);
    return out;
  }

  // The original, with the blurred share taken out.
  ctx.drawImage(original, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(mask, 0, 0);

  // The blurred copy, only its share.
  const share = makeCanvas(width, height);
  const sctx = share.getContext('2d')!;
  sctx.drawImage(mask, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.drawImage(blurred, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(share, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return out;
};
