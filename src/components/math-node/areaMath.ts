/**
 * Area and angle measurements for the math node: polygons (exact), definite
 * integrals (numerical, to ~1e-10), and "the region around this point" (on a grid
 * with sub-cell refinement along the boundary, so an estimate: shown with ≈).
 */

export type Vec2 = [number, number];

// ─── Polygons ──────────────────────────────────────────────────────────────────

/** Shoelace formula: positive when the corners go counter-clockwise. */
export function signedPolygonArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

export function polygonPerimeter(pts: Vec2[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    p += Math.hypot(x1 - x0, y1 - y0);
  }
  return p;
}

/** Drops a closing corner that repeats the first one, and exact repeats in a row. */
export function cleanRing(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  if (out.length > 1) {
    const [a, b] = [out[0], out[out.length - 1]];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}

/**
 * The interior angle at each corner, in degrees. Works for concave polygons:
 * a corner that turns against the polygon's winding is reflex (over 180°).
 */
export function polygonInteriorAngles(pts: Vec2[]): number[] {
  const n = pts.length;
  if (n < 3) return [];
  const orientation = Math.sign(signedPolygonArea(pts)) || 1;
  return pts.map((v, i) => {
    const p = pts[(i - 1 + n) % n];
    const q = pts[(i + 1) % n];
    const inX = v[0] - p[0];
    const inY = v[1] - p[1];
    const outX = q[0] - v[0];
    const outY = q[1] - v[1];
    // How far the boundary turns at this corner, in (-180°, 180°].
    const turn = Math.atan2(inX * outY - inY * outX, inX * outX + inY * outY);
    return ((Math.PI - orientation * turn) * 180) / Math.PI;
  });
}

// ─── Definite integrals ────────────────────────────────────────────────────────

/** Adaptive Simpson. Returns NaN if the function isn't finite somewhere it looks. */
export function integrate(f: (x: number) => number, a: number, b: number, tol = 1e-10): number {
  if (a === b) return 0;
  if (a > b) return -integrate(f, b, a, tol);
  let failed = false;
  const F = (x: number) => {
    const v = f(x);
    if (!Number.isFinite(v)) failed = true;
    return v;
  };
  const simpson = (fa: number, fm: number, fb: number, w: number) => (w / 6) * (fa + 4 * fm + fb);
  const rec = (a: number, b: number, fa: number, fm: number, fb: number, whole: number, eps: number, depth: number): number => {
    const m = (a + b) / 2;
    const lm = (a + m) / 2;
    const rm = (m + b) / 2;
    const flm = F(lm);
    const frm = F(rm);
    const left = simpson(fa, flm, fm, m - a);
    const right = simpson(fm, frm, fb, b - m);
    const delta = left + right - whole;
    if (failed || depth <= 0 || Math.abs(delta) <= 15 * eps) return left + right + delta / 15;
    return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
  };
  // Start from several panels so a narrow feature isn't missed by the first estimate.
  const panels = 16;
  const h = (b - a) / panels;
  let total = 0;
  for (let i = 0; i < panels && !failed; i++) {
    const x0 = a + i * h;
    const x1 = i === panels - 1 ? b : x0 + h;
    const f0 = F(x0);
    const fm = F((x0 + x1) / 2);
    const f1 = F(x1);
    total += rec(x0, x1, f0, fm, f1, simpson(f0, fm, f1, x1 - x0), tol / panels, 40);
  }
  return failed ? NaN : total;
}

/**
 * ∫ₐᵇ f as a signed value (parts below the axis count negative) and as the total
 * area (every part counts positive: integrated piecewise between sign changes).
 */
export function definiteArea(f: (x: number) => number, a: number, b: number): { signed: number; area: number } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { signed: NaN, area: NaN };
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const dir = a <= b ? 1 : -1;

  // Split where f changes sign (sampled finely, then bisected).
  const cuts = [lo];
  const N = 512;
  let px = lo;
  let pv = f(lo);
  for (let i = 1; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    const v = f(x);
    if (Number.isFinite(pv) && Number.isFinite(v) && (pv < 0) !== (v < 0) && pv !== 0 && v !== 0) {
      let l = px;
      let r = x;
      let fl = pv;
      for (let k = 0; k < 60; k++) {
        const m = (l + r) / 2;
        const fm = f(m);
        if ((fm < 0) === (fl < 0)) {
          l = m;
          fl = fm;
        } else r = m;
      }
      cuts.push((l + r) / 2);
    }
    px = x;
    pv = v;
  }
  cuts.push(hi);

  let signed = 0;
  let area = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const piece = integrate(f, cuts[i], cuts[i + 1]);
    signed += piece;
    area += Math.abs(piece);
  }
  return { signed: dir * signed, area };
}

// ─── Region around a point ─────────────────────────────────────────────────────

export interface RegionResult {
  /** Estimated area in graph units². */
  area: number;
  /** False when the region reaches the edge of the searched window. */
  closed: boolean;
  /** Filled cells, row by row (row 0 at the bottom). */
  mask: Uint8Array;
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  cellW: number;
  cellH: number;
  /** Where to put the label: the region's centre of mass, if it lies inside. */
  labelAt: Vec2;
  /** The extent of the region (band included), in graph coordinates. */
  bounds: { x0: number; x1: number; y0: number; y1: number };
}

/** Whether segments p1p2 and p3p4 cross (touching counts). */
function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

/**
 * The area of the region containing `seed`, bounded by the given segments
 * (x0, y0, x1, y1 repeated) inside the window.
 *
 * Every cell a segment touches is a wall; the rest are flood-filled from the
 * seed. Through the walls the flood goes on at sub-cell resolution without
 * crossing a segment, so the region is followed up to the curve itself — the
 * error is a fraction of a sub-cell along the boundary, the same on every side.
 */
export function measureRegion(
  segments: ArrayLike<number>,
  window: { x0: number; x1: number; y0: number; y1: number },
  seed: Vec2,
  cellsAcross = 360,
  subsamples = 6,
  /** How far (in cells) to look for a free cell when the seed lands on a wall. */
  seedNudgeCells = 2,
): RegionResult | null {
  const w = window.x1 - window.x0;
  const h = window.y1 - window.y0;
  if (!(w > 0) || !(h > 0)) return null;
  // Square cells a power of two in size, on a grid through the origin: the axes,
  // and lines at whole (or half, quarter…) numbers, then lie exactly on cell
  // edges, so a region bounded by one gets no rounding along it — and regions on
  // either side of it measure alike.
  const cell = 2 ** Math.round(Math.log2(w / Math.max(8, cellsAcross)));
  const gx = Math.floor(window.x0 / cell) * cell;
  const gy = Math.floor(window.y0 / cell) * cell;
  const cols = Math.max(8, Math.ceil((window.x1 - gx) / cell));
  const rows = Math.max(8, Math.ceil((window.y1 - gy) / cell));
  window = { x0: gx, x1: gx + cols * cell, y0: gy, y1: gy + rows * cell };
  const cellW = cell;
  const cellH = cell;
  const idx = (c: number, r: number) => r * cols + c;

  // Walls, and which segments cross each wall cell.
  const wall = new Uint8Array(cols * rows);
  const cellSegs = new Map<number, number[]>();
  const nSeg = Math.floor(segments.length / 4);
  for (let s = 0; s < nSeg; s++) {
    const ax = segments[4 * s];
    const ay = segments[4 * s + 1];
    const bx = segments[4 * s + 2];
    const by = segments[4 * s + 3];
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    // Clip to the window (Liang–Barsky).
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    let visible = true;
    for (const [p, q] of [[-dx, ax - window.x0], [dx, window.x1 - ax], [-dy, ay - window.y0], [dy, window.y1 - ay]]) {
      if (p === 0) {
        if (q < 0) visible = false;
        continue;
      }
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (!visible || t0 > t1) continue;
    const mark = (c: number, r: number) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      const i = idx(c, r);
      wall[i] = 1;
      const list = cellSegs.get(i);
      if (!list) cellSegs.set(i, [s]);
      else if (list[list.length - 1] !== s) list.push(s);
    };
    // Every cell the segment touches (a grid traversal, both side cells where it
    // passes through a corner), so no crossing of it can go unnoticed later.
    const gx0 = (ax + dx * t0 - window.x0) / cellW;
    const gy0 = (ay + dy * t0 - window.y0) / cellH;
    const gdx = (dx * (t1 - t0)) / cellW;
    const gdy = (dy * (t1 - t0)) / cellH;
    let c = Math.min(cols - 1, Math.floor(gx0));
    let r = Math.min(rows - 1, Math.floor(gy0));
    const stepC = gdx > 0 ? 1 : gdx < 0 ? -1 : 0;
    const stepR = gdy > 0 ? 1 : gdy < 0 ? -1 : 0;
    const tDeltaX = stepC ? 1 / Math.abs(gdx) : Infinity;
    const tDeltaY = stepR ? 1 / Math.abs(gdy) : Infinity;
    let tMaxX = stepC > 0 ? (c + 1 - gx0) * tDeltaX : stepC < 0 ? (gx0 - c) * tDeltaX : Infinity;
    let tMaxY = stepR > 0 ? (r + 1 - gy0) * tDeltaY : stepR < 0 ? (gy0 - r) * tDeltaY : Infinity;
    mark(c, r);
    while (Math.min(tMaxX, tMaxY) <= 1) {
      if (tMaxX < tMaxY) {
        c += stepC;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxX) {
        r += stepR;
        tMaxY += tDeltaY;
      } else {
        mark(c + stepC, r);
        mark(c, r + stepR);
        c += stepC;
        r += stepR;
        tMaxX += tDeltaX;
        tMaxY += tDeltaY;
      }
      mark(c, r);
    }
  }

  let sc = Math.floor((seed[0] - window.x0) / cellW);
  let sr = Math.floor((seed[1] - window.y0) / cellH);
  if (sc < 0 || sr < 0 || sc >= cols || sr >= rows) return null;
  // A point just beside a curve can fall in one of its (cell-wide) wall cells:
  // start from the nearest free cell instead, if one is within a few cells.
  if (wall[idx(sc, sr)]) {
    let best = -1;
    let bestD = Infinity;
    for (let dr = -seedNudgeCells; dr <= seedNudgeCells; dr++) {
      for (let dc = -seedNudgeCells; dc <= seedNudgeCells; dc++) {
        const c = sc + dc;
        const r = sr + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows || wall[idx(c, r)]) continue;
        const d = Math.hypot(window.x0 + (c + 0.5) * cellW - seed[0], window.y0 + (r + 0.5) * cellH - seed[1]);
        if (d < bestD) {
          bestD = d;
          best = idx(c, r);
        }
      }
    }
    if (best < 0) return null;
    sc = best % cols;
    sr = (best - sc) / cols;
  }

  // Free cells are flooded whole (4-connected). Through the wall cells the flood
  // continues on a finer grid — S × S sub-cells each — stepping between
  // neighbouring sub-cell centres only where no segment is crossed. It follows
  // the region right up to the curve, however many cells thick the band of wall
  // cells is. A step stays inside the two cells it joins, so testing the segments
  // listed for those two cells is exact.
  const mask = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  queue[tail++] = idx(sc, sr);
  mask[idx(sc, sr)] = 1;
  let closed = true;
  let count = 0;
  let sumX = 0;
  let sumY = 0;

  const S = Math.max(2, Math.round(subsamples));
  const SS = S * S;
  const reached = new Map<number, Uint8Array>();
  const subQueue: number[] = []; // cell * SS + v * S + u
  const blocked = (ax: number, ay: number, bx: number, by: number, cellA: number, cellB: number) => {
    const a = cellSegs.get(cellA);
    if (a) {
      for (const s of a) {
        if (segmentsCross(ax, ay, bx, by, segments[4 * s], segments[4 * s + 1], segments[4 * s + 2], segments[4 * s + 3])) return true;
      }
    }
    const b = cellA === cellB ? undefined : cellSegs.get(cellB);
    if (b) {
      for (const s of b) {
        if (segmentsCross(ax, ay, bx, by, segments[4 * s], segments[4 * s + 1], segments[4 * s + 2], segments[4 * s + 3])) return true;
      }
    }
    return false;
  };
  // Step from the point (fx, fy) in cell `from` to sub-cell (u, v) of cell `to`.
  const step = (from: number, fx: number, fy: number, to: number, u: number, v: number) => {
    const tc = to % cols;
    const tr = (to - tc) / cols;
    const px = window.x0 + (tc + (u + 0.5) / S) * cellW;
    const py = window.y0 + (tr + (v + 0.5) / S) * cellH;
    if (!wall[to]) {
      // Out of the band into a free cell: it belongs to the region whole (this
      // is how the region gets through gaps narrower than a cell).
      if (!mask[to] && !blocked(fx, fy, px, py, from, to)) {
        mask[to] = 1;
        queue[tail++] = to;
      }
      return;
    }
    let flags = reached.get(to);
    const k = v * S + u;
    if (flags && flags[k]) return;
    if (blocked(fx, fy, px, py, from, to)) return;
    if (!flags) reached.set(to, (flags = new Uint8Array(SS)));
    flags[k] = 1;
    subQueue.push(to * SS + k);
  };

  let minC = cols;
  let maxC = -1;
  let minR = rows;
  let maxR = -1;
  let entered = 0;
  let sq = 0;
  while (head < tail) {
    while (head < tail) {
      const i = queue[head++];
      const c = i % cols;
      const r = (i - c) / cols;
      count++;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      sumX += c;
      sumY += r;
      if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) closed = false;
      const neighbours = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1];
      for (const j of neighbours) {
        if (j >= 0 && !mask[j] && !wall[j]) {
          mask[j] = 1;
          queue[tail++] = j;
        }
      }
    }
    // Into the band from each newly filled cell, across the shared edge.
    for (; entered < tail; entered++) {
      const i = queue[entered];
      const c = i % cols;
      const r = (i - c) / cols;
      for (let k = 0; k < S; k++) {
        const along = (k + 0.5) / S;
        if (c > 0 && wall[i - 1]) step(i, window.x0 + (c + 0.5 / S) * cellW, window.y0 + (r + along) * cellH, i - 1, S - 1, k);
        if (c < cols - 1 && wall[i + 1]) step(i, window.x0 + (c + 1 - 0.5 / S) * cellW, window.y0 + (r + along) * cellH, i + 1, 0, k);
        if (r > 0 && wall[i - cols]) step(i, window.x0 + (c + along) * cellW, window.y0 + (r + 0.5 / S) * cellH, i - cols, k, S - 1);
        if (r < rows - 1 && wall[i + cols]) step(i, window.x0 + (c + along) * cellW, window.y0 + (r + 1 - 0.5 / S) * cellH, i + cols, k, 0);
      }
    }
    for (; sq < subQueue.length; sq++) {
      const code = subQueue[sq];
      const cell = Math.floor(code / SS);
      const k = code - cell * SS;
      const u = k % S;
      const v = (k - u) / S;
      const c = cell % cols;
      const r = (cell - c) / cols;
      const px = window.x0 + (c + (u + 0.5) / S) * cellW;
      const py = window.y0 + (r + (v + 0.5) / S) * cellH;
      if ((c === 0 && u === 0) || (r === 0 && v === 0) || (c === cols - 1 && u === S - 1) || (r === rows - 1 && v === S - 1)) {
        closed = false;
      }
      if (u > 0) step(cell, px, py, cell, u - 1, v);
      else if (c > 0) step(cell, px, py, cell - 1, S - 1, v);
      if (u < S - 1) step(cell, px, py, cell, u + 1, v);
      else if (c < cols - 1) step(cell, px, py, cell + 1, 0, v);
      if (v > 0) step(cell, px, py, cell, u, v - 1);
      else if (r > 0) step(cell, px, py, cell - cols, u, S - 1);
      if (v < S - 1) step(cell, px, py, cell, u, v + 1);
      else if (r < rows - 1) step(cell, px, py, cell + cols, u, 0);
    }
  }

  const cellArea = cellW * cellH;
  let partial = 0;
  for (const [cell, flags] of reached) {
    const bc = cell % cols;
    const br = (cell - bc) / cols;
    if (bc < minC) minC = bc;
    if (bc > maxC) maxC = bc;
    if (br < minR) minR = br;
    if (br > maxR) maxR = br;
    let n = 0;
    for (let k = 0; k < SS; k++) n += flags[k];
    partial += n / SS;
    // Draw the band cells that are mostly inside, so the fill meets the curve.
    if (n * 2 >= SS) mask[cell] = 1;
  }

  const cx = Math.round(sumX / count);
  const cy = Math.round(sumY / count);
  const centreInside = cx >= 0 && cy >= 0 && cx < cols && cy < rows && mask[idx(cx, cy)];
  return {
    area: (count + partial) * cellArea,
    closed,
    mask,
    cols,
    rows,
    x0: window.x0,
    y0: window.y0,
    cellW,
    cellH,
    bounds: {
      x0: window.x0 + minC * cellW,
      x1: window.x0 + (maxC + 1) * cellW,
      y0: window.y0 + minR * cellH,
      y1: window.y0 + (maxR + 1) * cellH,
    },
    labelAt: centreInside
      ? [window.x0 + (cx + 0.5) * cellW, window.y0 + (cy + 0.5) * cellH]
      : seed,
  };
}

/** The filled cells as one SVG path (runs merged row by row), in graph coordinates. */
export function regionPath(r: RegionResult): string {
  const parts: string[] = [];
  for (let row = 0; row < r.rows; row++) {
    let col = 0;
    while (col < r.cols) {
      if (!r.mask[row * r.cols + col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < r.cols && r.mask[row * r.cols + col]) col++;
      const x = r.x0 + start * r.cellW;
      const y = r.y0 + row * r.cellH;
      const wdt = (col - start) * r.cellW;
      parts.push(`M${x} ${y}h${wdt}v${r.cellH}h${-wdt}z`);
    }
  }
  return parts.join("");
}
