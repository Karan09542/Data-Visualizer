/**
 * Refining the cut-out edge of an image, the way Photoshop's Refine Edge does.
 *
 * An automatic cut-out leaves four characteristic problems, and each control here fixes one:
 * stair-stepped edges (Smooth), a hard pasted-on outline (Feather), an edge that sits slightly
 * outside or inside the subject (Shift), and a rim of the old background colour (Defringe).
 *
 * All of it is alpha-channel work apart from Defringe, which repairs colour. Pure and canvas-free -
 * ImageData in, ImageData out - so it can run in a worker and be checked off-browser.
 */

export interface EdgeRefineOptions {
  /** Rounds off jagged steps, in pixels. */
  smooth: number;
  /** Softens the edge into a gradient, in pixels. */
  feather: number;
  /** 0-100. Steepens the alpha ramp, winning back crispness lost to feathering. */
  contrast: number;
  /** Positive grows the cut-out, negative shrinks it, in pixels. */
  shift: number;
  /** Bleeds the subject's own colour outward over the fringe, in pixels. */
  defringe: number;
}

export const EDGE_REFINE_NONE: EdgeRefineOptions = {
  smooth: 0, feather: 0, contrast: 0, shift: 0, defringe: 0
};

export const isEdgeRefineNoOp = (o: EdgeRefineOptions): boolean =>
  !o.smooth && !o.feather && !o.contrast && !o.shift && !o.defringe;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * One separable box-blur pass, using a running sum so cost does not grow with the radius.
 * Three passes approximate a Gaussian closely enough that no one can tell them apart.
 */
const blurPass = (
  src: Float32Array, dst: Float32Array,
  width: number, height: number, radius: number, horizontal: boolean
) => {
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const step = horizontal ? 1 : width;
  const lineStep = horizontal ? width : 1;
  const window = radius * 2 + 1;

  for (let o = 0; o < outer; o++) {
    const base = o * lineStep;
    let sum = 0;
    // Prime the window, clamping at the edge so the border does not fade into nothing.
    for (let i = -radius; i <= radius; i++) {
      sum += src[base + Math.max(0, Math.min(inner - 1, i)) * step];
    }
    for (let i = 0; i < inner; i++) {
      dst[base + i * step] = sum / window;
      const outIdx = Math.max(0, Math.min(inner - 1, i - radius));
      const inIdx = Math.max(0, Math.min(inner - 1, i + radius + 1));
      sum += src[base + inIdx * step] - src[base + outIdx * step];
    }
  }
};

const boxBlur = (
  channel: Float32Array, width: number, height: number, radius: number, passes = 3
): Float32Array => {
  const r = Math.max(1, Math.round(radius));
  let a = channel;
  let b = new Float32Array(channel.length);
  for (let p = 0; p < passes; p++) {
    blurPass(a, b, width, height, r, true);
    blurPass(b, a, width, height, r, false);
  }
  return a;
};

/**
 * Grows the subject's colour outward across the fringe.
 *
 * A cut-out's semi-transparent rim still carries the colour it was blended with - the white or
 * green of whatever it was photographed against - which shows as a halo once the subject is placed
 * on a new background. This floods the subject's own colour outward over that rim, one ring per
 * pass, leaving alpha untouched so the shape does not change.
 *
 * The flood front is tracked explicitly rather than inferred from alpha. Comparing a pixel's alpha
 * against its neighbours' seems natural, but it stalls the moment the fringe has an even alpha -
 * every neighbour then looks equally opaque, nothing qualifies as "further in", and the colour
 * stops spreading after a single ring.
 */
const defringeColors = (
  rgb: Uint8ClampedArray, alpha: Float32Array,
  width: number, height: number, radius: number
) => {
  const count = width * height;
  const passes = Math.max(1, Math.round(radius));

  // Pixels whose colour is trusted: the solid subject to begin with, growing outward each pass.
  const known = new Uint8Array(count);
  for (let i = 0; i < count; i++) known[i] = alpha[i] >= 0.9 ? 1 : 0;

  const next = new Uint8ClampedArray(rgb.length);
  const settled: number[] = [];

  for (let p = 0; p < passes; p++) {
    next.set(rgb);
    settled.length = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        // Already trusted, or too faint ever to be seen.
        if (known[i] || alpha[i] <= 0.004) continue;

        let wr = 0, wg = 0, wb = 0, total = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
            const j = ny * width + nx;
            if (!known[j]) continue;
            // More opaque sources carry more of the subject, so they weigh more.
            const weight = Math.max(alpha[j], 0.05);
            wr += rgb[j * 3] * weight;
            wg += rgb[j * 3 + 1] * weight;
            wb += rgb[j * 3 + 2] * weight;
            total += weight;
          }
        }
        if (total <= 0) continue;

        next[i * 3] = wr / total;
        next[i * 3 + 1] = wg / total;
        next[i * 3 + 2] = wb / total;
        settled.push(i);
      }
    }

    if (!settled.length) break;
    rgb.set(next);
    // Only after the whole pass, so a ring is filled from the previous front rather than from
    // pixels corrected moments earlier in the same sweep - which would smear along scan order.
    for (const i of settled) known[i] = 1;
  }
};

/**
 * Returns a new ImageData with the edge refined. The original is never modified, and with every
 * control at zero the output is a faithful copy.
 */
export const refineEdges = (pixels: ImageData, options: EdgeRefineOptions): ImageData => {
  const { width, height, data } = pixels;
  const count = width * height;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);

  if (isEdgeRefineNoOp(options)) return out;

  const alpha = new Float32Array(count);
  for (let i = 0; i < count; i++) alpha[i] = data[i * 4 + 3] / 255;

  let working = alpha;

  // Smooth and Shift share one blur: both are answered by where the level is cut, so doing them
  // together avoids blurring twice and losing detail that neither asked to lose.
  const smooth = Math.max(0, options.smooth);
  const shift = options.shift || 0;
  if (smooth > 0 || shift !== 0) {
    const radius = Math.max(1, smooth, Math.abs(shift));
    const blurred = boxBlur(Float32Array.from(working), width, height, radius);
    // A blurred alpha reads as "what fraction of the neighbourhood is subject", so cutting above
    // the halfway mark eats into the shape and below it grows outward.
    const centre = clamp01(0.5 - shift / (2 * radius + 1));
    // Steep enough to give back a defined edge after the blur that rounded the jaggies off.
    const slope = 10;
    const next = new Float32Array(count);
    for (let i = 0; i < count; i++) next[i] = clamp01((blurred[i] - centre) * slope + 0.5);
    working = next;
  }

  if (options.feather > 0) {
    working = boxBlur(Float32Array.from(working), width, height, options.feather);
  }

  if (options.contrast > 0) {
    const slope = 1 + (Math.min(100, options.contrast) / 100) * 9;
    for (let i = 0; i < count; i++) working[i] = clamp01((working[i] - 0.5) * slope + 0.5);
  }

  if (options.defringe > 0) {
    const rgb = new Uint8ClampedArray(count * 3);
    for (let i = 0; i < count; i++) {
      rgb[i * 3] = data[i * 4];
      rgb[i * 3 + 1] = data[i * 4 + 1];
      rgb[i * 3 + 2] = data[i * 4 + 2];
    }
    defringeColors(rgb, working, width, height, options.defringe);
    for (let i = 0; i < count; i++) {
      out.data[i * 4] = rgb[i * 3];
      out.data[i * 4 + 1] = rgb[i * 3 + 1];
      out.data[i * 4 + 2] = rgb[i * 3 + 2];
    }
  }

  for (let i = 0; i < count; i++) out.data[i * 4 + 3] = Math.round(working[i] * 255);

  return out;
};
