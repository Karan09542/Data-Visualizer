// Color palette extraction worker (median-cut quantization, like Color Thief's MMCQ).
// Runs off the main thread so large images never stall the canvas.

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  /** Share of sampled pixels that belong to this color, 0..1 */
  share: number;
}

export interface PaletteRequest {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  colorCount?: number;
}

export type PaletteResponse =
  | { success: true; colors: PaletteColor[] }
  | { success: false; error: string };

const SIGBITS = 5;
const RSHIFT = 8 - SIGBITS;
const HIST_SIZE = 1 << (3 * SIGBITS);
/** Bin index for 5-bit-per-channel color */
const binIndex = (r: number, g: number, b: number) => (r << (2 * SIGBITS)) + (g << SIGBITS) + b;

interface Box {
  r1: number; r2: number;
  g1: number; g2: number;
  b1: number; b2: number;
  count: number;
  splittable: boolean;
}

const toHex = (n: number) => n.toString(16).padStart(2, '0');

self.onmessage = (event: MessageEvent<PaletteRequest>) => {
  try {
    const { pixels, width, height } = event.data;
    const colorCount = Math.max(2, Math.min(16, event.data.colorCount ?? 8));
    const data = new Uint8ClampedArray(pixels);
    const total = width * height;

    // Sample at most ~40k pixels
    const step = Math.max(1, Math.floor(total / 40000));

    const hist = new Uint32Array(HIST_SIZE);
    const sumR = new Float64Array(HIST_SIZE);
    const sumG = new Float64Array(HIST_SIZE);
    const sumB = new Float64Array(HIST_SIZE);
    let sampled = 0;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;

    for (let p = 0; p < total; p += step) {
      const i = p * 4;
      if (data[i + 3] < 125) continue; // ignore transparent pixels
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const rq = r >> RSHIFT, gq = g >> RSHIFT, bq = b >> RSHIFT;
      const idx = binIndex(rq, gq, bq);
      hist[idx]++;
      sumR[idx] += r; sumG[idx] += g; sumB[idx] += b;
      sampled++;
      if (rq < rMin) rMin = rq; if (rq > rMax) rMax = rq;
      if (gq < gMin) gMin = gq; if (gq > gMax) gMax = gq;
      if (bq < bMin) bMin = bq; if (bq > bMax) bMax = bq;
    }

    if (sampled === 0) {
      (self as any).postMessage({ success: true, colors: [] } satisfies PaletteResponse);
      return;
    }

    const countBox = (box: Box) => {
      let count = 0;
      for (let r = box.r1; r <= box.r2; r++)
        for (let g = box.g1; g <= box.g2; g++)
          for (let b = box.b1; b <= box.b2; b++) count += hist[binIndex(r, g, b)];
      return count;
    };

    const volume = (box: Box) => (box.r2 - box.r1 + 1) * (box.g2 - box.g1 + 1) * (box.b2 - box.b1 + 1);

    /** Split a box at the median of its longest axis */
    const split = (box: Box): [Box, Box] | null => {
      const rw = box.r2 - box.r1, gw = box.g2 - box.g1, bw = box.b2 - box.b1;
      if (rw === 0 && gw === 0 && bw === 0) return null;
      const axis = rw >= gw && rw >= bw ? 'r' : gw >= bw ? 'g' : 'b';
      const lo = box[`${axis}1` as const];
      const hi = box[`${axis}2` as const];

      // Pixel count per slice along the axis
      const slices = new Uint32Array(hi - lo + 1);
      for (let r = box.r1; r <= box.r2; r++)
        for (let g = box.g1; g <= box.g2; g++)
          for (let b = box.b1; b <= box.b2; b++) {
            const v = axis === 'r' ? r : axis === 'g' ? g : b;
            slices[v - lo] += hist[binIndex(r, g, b)];
          }

      const half = box.count / 2;
      let running = 0;
      let cut = lo;
      for (let v = lo; v < hi; v++) {
        running += slices[v - lo];
        cut = v;
        if (running >= half) break;
      }

      const left: Box = { ...box, [`${axis}2`]: cut, count: 0, splittable: true } as Box;
      const right: Box = { ...box, [`${axis}1`]: cut + 1, count: 0, splittable: true } as Box;
      left.count = countBox(left);
      right.count = countBox(right);
      if (left.count === 0 || right.count === 0) return null;
      return [left, right];
    };

    const boxes: Box[] = [{ r1: rMin, r2: rMax, g1: gMin, g2: gMax, b1: bMin, b2: bMax, count: sampled, splittable: true }];

    // Split by population first, then by population × volume for better variety
    const iterate = (target: number, score: (box: Box) => number) => {
      while (boxes.length < target) {
        let bestIndex = -1;
        let bestScore = -1;
        boxes.forEach((box, index) => {
          if (!box.splittable) return;
          const s = score(box);
          if (s > bestScore) { bestScore = s; bestIndex = index; }
        });
        if (bestIndex === -1) return;
        const parts = split(boxes[bestIndex]);
        if (!parts) { boxes[bestIndex].splittable = false; continue; }
        boxes.splice(bestIndex, 1, parts[0], parts[1]);
      }
    };
    // Extra boxes give room to merge near-duplicates below
    const targetBoxes = colorCount + 4;
    iterate(Math.ceil(targetBoxes * 0.75), (box) => box.count);
    iterate(targetBoxes, (box) => box.count * volume(box));

    // Average actual pixel colors inside each box
    let colors = boxes.map((box) => {
      let n = 0, r = 0, g = 0, b = 0;
      for (let ri = box.r1; ri <= box.r2; ri++)
        for (let gi = box.g1; gi <= box.g2; gi++)
          for (let bi = box.b1; bi <= box.b2; bi++) {
            const idx = binIndex(ri, gi, bi);
            const c = hist[idx];
            if (!c) continue;
            n += c; r += sumR[idx]; g += sumG[idx]; b += sumB[idx];
          }
      return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), count: n } : null;
    }).filter((c): c is { r: number; g: number; b: number; count: number } => !!c);

    colors.sort((a, b) => b.count - a.count);

    // Merge colors that look almost the same (keeps the more dominant one)
    const merged: typeof colors = [];
    for (const color of colors) {
      const near = merged.find((m) => Math.hypot(m.r - color.r, m.g - color.g, m.b - color.b) < 18);
      if (near) near.count += color.count;
      else merged.push({ ...color });
    }
    merged.sort((a, b) => b.count - a.count);
    colors = merged.slice(0, colorCount);

    const result: PaletteColor[] = colors.map((c) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      hex: `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`,
      share: c.count / sampled,
    }));

    (self as any).postMessage({ success: true, colors: result } satisfies PaletteResponse);
  } catch (err: any) {
    (self as any).postMessage({ success: false, error: err?.message || String(err) } satisfies PaletteResponse);
  }
};
