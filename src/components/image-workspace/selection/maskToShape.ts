import { Point, PathSelection } from './types';

/**
 * Turns a raster mask into an editable vector selection.
 *
 * This is what makes an AI segmentation usable as a *selection* rather than as a one-shot cut-out:
 * once the mask is a polygon it flows through every existing operation - move, scale, rotate,
 * delete, fill, mask, region filters - with no special casing anywhere else.
 *
 * Pure by design. It takes an ImageData whose alpha channel is the mask and returns plain points,
 * so it can run in a worker, be unit tested off-browser, or be fed by a different model entirely.
 */

export interface MaskToShapeOptions {
  /** Alpha above which a pixel counts as inside the object. */
  threshold?: number;
  /**
   * Longest side of the grid the contours are traced on. A 12 MP mask holds no more real detail
   * than the 320px model that produced it, so tracing full-res only buys jagged, huge polygons.
   */
  maxTraceSize?: number;
  /** Douglas-Peucker tolerance, in traced-grid pixels. Higher is smoother and lighter. */
  tolerance?: number;
  /** Rings smaller than this fraction of the largest ring are dropped as speckle. */
  minRingAreaRatio?: number;
  /** Hard cap on rings kept, largest first, so hit-testing stays cheap. */
  maxRings?: number;
  /** Chaikin passes run after simplifying, to take the stair-steps off the outline. */
  smooth?: number;
  /** Keep only the blob containing this point, in source-mask pixels. */
  seed?: Point | null;
  /** Added to every output coordinate, for a mask that came from a crop of a larger image. */
  offset?: Point;
  /**
   * Multiplies every output coordinate before the offset is added. Lets a mask rasterised at a
   * reduced resolution report its outline in the caller's own units.
   */
  scale?: number;
}

const DEFAULTS = {
  threshold: 128,
  maxTraceSize: 1024,
  tolerance: 1.2,
  minRingAreaRatio: 0.015,
  maxRings: 24,
  smooth: 1
};

export interface MaskGrid {
  /** 1 inside, 0 outside. Row-major, `width * height` entries. */
  data: Uint8Array;
  width: number;
  height: number;
  /** Multiply a grid coordinate by this to get back to source-mask pixels. */
  scaleX: number;
  scaleY: number;
}

/**
 * Thresholds the alpha channel into a binary grid, box-averaging down to `maxSize` on the way.
 *
 * Averaging before thresholding rather than after is deliberate: it anti-aliases the edge so a
 * soft matte lands on a stable boundary instead of dissolving into speckle.
 */
export const alphaToMask = (
  mask: ImageData,
  threshold = DEFAULTS.threshold,
  maxSize = DEFAULTS.maxTraceSize
): MaskGrid => {
  const { width: sw, height: sh, data } = mask;
  const step = Math.max(1, Math.ceil(Math.max(sw, sh) / Math.max(1, maxSize)));
  const width = Math.max(1, Math.floor(sw / step));
  const height = Math.max(1, Math.floor(sh / step));
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = y * step;
    const y1 = Math.min(sh, y0 + step);
    for (let x = 0; x < width; x++) {
      const x0 = x * step;
      const x1 = Math.min(sw, x0 + step);
      let sum = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        let idx = (sy * sw + x0) * 4 + 3;
        for (let sx = x0; sx < x1; sx++, idx += 4) {
          sum += data[idx];
          n++;
        }
      }
      out[y * width + x] = n > 0 && sum / n >= threshold ? 1 : 0;
    }
  }

  return { data: out, width, height, scaleX: sw / width, scaleY: sh / height };
};

/**
 * Reduces the grid to the single blob under `seed`, which is how clicking one object out of
 * several works. Returns null when the seed landed on background.
 */
export const isolateBlobAt = (grid: MaskGrid, seed: Point): MaskGrid | null => {
  const { data, width, height } = grid;
  const sx = Math.round(seed.x / grid.scaleX);
  const sy = Math.round(seed.y / grid.scaleY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  if (!data[sy * width + sx]) return null;

  const out = new Uint8Array(width * height);
  // Explicit stack; a recursive flood fill blows the call stack on a large blob.
  const stack: number[] = [sy * width + sx];
  out[stack[0]] = 1;

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0 && data[p - 1] && !out[p - 1]) { out[p - 1] = 1; stack.push(p - 1); }
    if (x < width - 1 && data[p + 1] && !out[p + 1]) { out[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && data[p - width] && !out[p - width]) { out[p - width] = 1; stack.push(p - width); }
    if (y < height - 1 && data[p + width] && !out[p + width]) { out[p + width] = 1; stack.push(p + width); }
  }

  return { ...grid, data: out };
};

const EDGES = ['T', 'R', 'B', 'L'] as const;
type Edge = typeof EDGES[number];

/**
 * Marching-squares segment table, keyed by the four corners of a cell (TL=1, TR=2, BR=4, BL=8).
 *
 * Every segment is oriented so the filled side is on its right, which is what lets the segments be
 * chained into closed rings by matching each end point to the next start point. Entries 5 and 10
 * are the saddles, where the two crossings are kept apart rather than joined.
 */
const SEGMENTS: Array<Array<[Edge, Edge]>> = [
  [],                          // 0  empty
  [['T', 'L']],                // 1  TL
  [['R', 'T']],                // 2  TR
  [['R', 'L']],                // 3  TL TR
  [['B', 'R']],                // 4  BR
  [['T', 'L'], ['B', 'R']],    // 5  TL BR (saddle)
  [['B', 'T']],                // 6  TR BR
  [['B', 'L']],                // 7  TL TR BR
  [['L', 'B']],                // 8  BL
  [['T', 'B']],                // 9  TL BL
  [['R', 'T'], ['L', 'B']],    // 10 TR BL (saddle)
  [['R', 'B']],                // 11 TL TR BL
  [['L', 'R']],                // 12 BR BL
  [['T', 'R']],                // 13 TL BR BL
  [['L', 'T']],                // 14 TR BR BL
  []                           // 15 full
];

/**
 * Traces every boundary in the grid as a closed ring of points, in grid coordinates.
 *
 * The grid is treated as if surrounded by a ring of empty pixels, so an object running off the
 * edge of the image still closes into a usable ring instead of an open curve.
 */
export const traceMaskContours = (grid: MaskGrid): Point[][] => {
  const { data, width, height } = grid;
  // Sample (i,j) is pixel (i-1, j-1); index 0 and the last row/column are the empty border.
  const at = (i: number, j: number): number =>
    i <= 0 || j <= 0 || i > width || j > height ? 0 : data[(j - 1) * width + (i - 1)];

  // Coordinates land on halves, so doubling them gives exact integer keys to match ends to starts.
  const span = 2 * (width + 3);
  const key = (p: Point) => Math.round(p.x * 2) * span + Math.round(p.y * 2);

  const starts: Point[] = [];
  const ends: Point[] = [];
  const byStart = new Map<number, number[]>();

  const midpoint = (edge: Edge, i: number, j: number): Point => {
    switch (edge) {
      case 'T': return { x: i + 0.5, y: j };
      case 'R': return { x: i + 1, y: j + 0.5 };
      case 'B': return { x: i + 0.5, y: j + 1 };
      default: return { x: i, y: j + 0.5 };
    }
  };

  for (let j = 0; j <= height; j++) {
    for (let i = 0; i <= width; i++) {
      const code = at(i, j) | (at(i + 1, j) << 1) | (at(i + 1, j + 1) << 2) | (at(i, j + 1) << 3);
      const segs = SEGMENTS[code];
      for (let s = 0; s < segs.length; s++) {
        const from = midpoint(segs[s][0], i, j);
        const to = midpoint(segs[s][1], i, j);
        const index = starts.length;
        starts.push(from);
        ends.push(to);
        const k = key(from);
        const list = byStart.get(k);
        if (list) list.push(index); else byStart.set(k, [index]);
      }
    }
  }

  const used = new Uint8Array(starts.length);
  const rings: Point[][] = [];

  for (let seed = 0; seed < starts.length; seed++) {
    if (used[seed]) continue;
    const ring: Point[] = [];
    let current = seed;

    // Follow ends to starts until the walk arrives back where it began.
    while (current >= 0 && !used[current]) {
      used[current] = 1;
      ring.push(starts[current]);
      const candidates = byStart.get(key(ends[current]));
      let next = -1;
      if (candidates) {
        for (const c of candidates) if (!used[c]) { next = c; break; }
      }
      current = next;
    }

    if (ring.length >= 3) rings.push(ring);
  }

  // Shift from sample space to pixel-corner space: sample (i,j) sits at pixel corner (i-0.5, j-0.5).
  return rings.map(ring => ring.map(p => ({ x: p.x - 0.5, y: p.y - 0.5 })));
};

/** Signed area of a closed ring; the sign gives winding, the magnitude ranks rings by size. */
export const ringArea = (points: Point[]): number => {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j].x * points[i].y) - (points[i].x * points[j].y);
  }
  return sum / 2;
};

const perpendicularDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy));
};

/** Douglas-Peucker, iterative so a long contour cannot overflow the stack. */
export const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3 || tolerance <= 0) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (index > 0 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
};

/** Chaikin corner cutting on a closed ring; takes the stair-steps off a pixel-traced outline. */
export const smoothRing = (points: Point[], passes: number): Point[] => {
  let ring = points;
  for (let n = 0; n < passes && ring.length >= 3; n++) {
    const out: Point[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    ring = out;
  }
  return ring;
};

/**
 * Full pipeline: alpha mask in, one selection out.
 *
 * Extra rings ride along in `subpaths` and are filled even-odd, so holes stay holes and a subject
 * that segments into several pieces comes back as one selection rather than several.
 */
export const maskToSelection = (
  mask: ImageData,
  options: MaskToShapeOptions = {}
): PathSelection | null => {
  const opts = { ...DEFAULTS, ...options };
  const offset = options.offset || { x: 0, y: 0 };
  const scale = options.scale ?? 1;

  let grid = alphaToMask(mask, opts.threshold, opts.maxTraceSize);
  if (options.seed) {
    const isolated = isolateBlobAt(grid, options.seed);
    // A seed on background means the click missed the subject; fall back to the whole mask rather
    // than returning nothing, which would read as the tool having silently failed.
    if (isolated) grid = isolated;
  }

  const rings = traceMaskContours(grid);
  if (!rings.length) return null;

  const measured = rings
    .map(points => ({ points, area: Math.abs(ringArea(points)) }))
    .sort((a, b) => b.area - a.area);

  const largest = measured[0].area;
  if (largest < 4) return null;

  const kept = measured
    .filter(r => r.area >= largest * opts.minRingAreaRatio)
    .slice(0, opts.maxRings)
    .map(r => {
      const simplified = simplifyPath(r.points, opts.tolerance);
      const smoothed = opts.smooth > 0 ? smoothRing(simplified, opts.smooth) : simplified;
      return smoothed.map(p => ({
        x: p.x * grid.scaleX * scale + offset.x,
        y: p.y * grid.scaleY * scale + offset.y
      }));
    })
    .filter(r => r.length >= 3);

  if (!kept.length) return null;

  return {
    kind: 'path',
    points: kept[0],
    subpaths: kept.length > 1 ? kept.slice(1) : undefined,
    closed: true
  };
};
