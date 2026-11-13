/**
 * Marks drawn over an image: what they are, how they are drawn, and how a point is
 * found on them. Pure geometry, kept apart from React so it can be tested.
 *
 * Everything is stored in the picture's own pixels, so marks stay on the spot they
 * were drawn on however the image is zoomed, panned, turned or resized.
 *
 * Sizes are given in pt, measured against the picture: one pt is 1/600 of its long
 * side. A 4 pt line is then about as thick on a small screenshot as on a large photo,
 * and roughly 4 screen pixels thick when the image fills a typical view.
 */

export type MarkupTool =
  | "select"
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "check"
  | "cross"
  | "star"
  | "badge"
  | "eraser";

/** Drawn by dragging: a stroke or a box. */
export type StrokeKind = "pen" | "highlighter";
export type SpanKind = "line" | "arrow" | "rect" | "circle";
/** Placed with a tap (or dragged out to a size): a symbol of a given size. */
export type StampKind = "check" | "cross" | "star" | "badge";

interface Base {
  id: string;
  color: string;
  /** Line thickness, in pt. */
  size: number;
}
export interface StrokeShape extends Base {
  kind: StrokeKind;
  /** x0, y0, x1, y1, … in picture pixels. */
  points: number[];
}
export interface SpanShape extends Base {
  kind: SpanKind;
  /** Line and arrow: from (x1, y1) to (x2, y2). Rectangle: two corners. Circle: the centre, then a point on it. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fill?: boolean;
}
export interface StampShape extends Base {
  kind: StampKind;
  cx: number;
  cy: number;
  /** How big it is across, in pt. */
  stamp: number;
  fill?: boolean;
  /** The number on a badge. */
  n?: number;
}
export type MarkupShape = StrokeShape | SpanShape | StampShape;

export const STROKE_KINDS = new Set<string>(["pen", "highlighter"]);
export const SPAN_KINDS = new Set<string>(["line", "arrow", "rect", "circle"]);
export const STAMP_KINDS = new Set<string>(["check", "cross", "star", "badge"]);
/** Shapes that can be filled in. */
export const FILLABLE = new Set<string>(["rect", "circle", "star", "badge"]);

export const isStroke = (s: MarkupShape): s is StrokeShape => STROKE_KINDS.has(s.kind);
export const isSpan = (s: MarkupShape): s is SpanShape => SPAN_KINDS.has(s.kind);
export const isStamp = (s: MarkupShape): s is StampShape => STAMP_KINDS.has(s.kind);

/** Picture pixels per pt. */
export const ptUnit = (naturalWidth: number, naturalHeight: number) => Math.max(naturalWidth, naturalHeight, 1) / 600;

export const SIZE_RANGE = { min: 1, max: 40 } as const;
export const STAMP_RANGE = { min: 8, max: 160 } as const;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Fewer points along a freehand line, keeping its shape (Ramer–Douglas–Peucker). */
export function simplify(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return points.map(r1);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = points[a * 2], ay = points[a * 2 + 1];
    const bx = points[b * 2], by = points[b * 2 + 1];
    let worst = -1;
    let worstD = tol2;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(points[i * 2], points[i * 2 + 1], ax, ay, bx, by);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(r1(points[i * 2]), r1(points[i * 2 + 1]));
  return out;
}

/** Squared distance from (px, py) to the segment (ax, ay)–(bx, by). */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}

/** A smooth path through freehand points (midpoint quadratic curves). */
export function strokePath(points: number[]): string {
  const n = points.length / 2;
  if (n === 0) return "";
  if (n === 1) return `M${points[0]} ${points[1]}l0.01 0`;
  if (n === 2) return `M${points[0]} ${points[1]}L${points[2]} ${points[3]}`;
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 1; i < n - 1; i++) {
    const x = points[i * 2], y = points[i * 2 + 1];
    const mx = (x + points[i * 2 + 2]) / 2;
    const my = (y + points[i * 2 + 3]) / 2;
    d += `Q${x} ${y} ${r1(mx)} ${r1(my)}`;
  }
  return d + `L${points[(n - 1) * 2]} ${points[(n - 1) * 2 + 1]}`;
}

/** The arrow's head: a triangle at (x2, y2), sized to the line. */
export function arrowHead(s: SpanShape, unit: number): string {
  const w = s.size * unit;
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  const head = Math.min(Math.max(w * 4, 6 * unit), len * 0.6 || w * 4);
  const ux = len ? (s.x2 - s.x1) / len : 1;
  const uy = len ? (s.y2 - s.y1) / len : 0;
  const bx = s.x2 - ux * head;
  const by = s.y2 - uy * head;
  const half = head * 0.55;
  return `${r1(s.x2)},${r1(s.y2)} ${r1(bx - uy * half)},${r1(by + ux * half)} ${r1(bx + uy * half)},${r1(by - ux * half)}`;
}

/** Where the arrow's line stops, so its round end doesn't poke through the head's tip. */
export function arrowShaftEnd(s: SpanShape, unit: number): [number, number] {
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  if (!len) return [s.x2, s.y2];
  const head = Math.min(Math.max(s.size * unit * 4, 6 * unit), len * 0.6);
  const back = head * 0.7;
  return [s.x2 - ((s.x2 - s.x1) / len) * back, s.y2 - ((s.y2 - s.y1) / len) * back];
}

/** The five-pointed star, as polygon points round (cx, cy). */
export function starPoints(cx: number, cy: number, r: number): string {
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    out.push(`${r1(cx + rr * Math.cos(a))},${r1(cy + rr * Math.sin(a))}`);
  }
  return out.join(" ");
}

/** A tick inside a box of half-width r round (cx, cy). */
export const checkPath = (cx: number, cy: number, r: number) =>
  `M${r1(cx - 0.78 * r)} ${r1(cy + 0.02 * r)}L${r1(cx - 0.25 * r)} ${r1(cy + 0.55 * r)}L${r1(cx + 0.8 * r)} ${r1(cy - 0.6 * r)}`;

export const crossPath = (cx: number, cy: number, r: number) => {
  const k = 0.62 * r;
  return `M${r1(cx - k)} ${r1(cy - k)}L${r1(cx + k)} ${r1(cy + k)}M${r1(cx + k)} ${r1(cy - k)}L${r1(cx - k)} ${r1(cy + k)}`;
};

/** A rectangle from two corners, either way round. */
export const rectOf = (s: SpanShape) => ({
  x: Math.min(s.x1, s.x2),
  y: Math.min(s.y1, s.y2),
  w: Math.abs(s.x2 - s.x1),
  h: Math.abs(s.y2 - s.y1),
});

export const circleRadius = (s: SpanShape) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);

/** The box round a shape, in picture pixels (line thickness included). */
export function bounds(s: MarkupShape, unit: number) {
  const pad = (s.size * unit) / 2;
  if (isStroke(s)) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < s.points.length; i += 2) {
      x0 = Math.min(x0, s.points[i]);
      x1 = Math.max(x1, s.points[i]);
      y0 = Math.min(y0, s.points[i + 1]);
      y1 = Math.max(y1, s.points[i + 1]);
    }
    const p = s.kind === "highlighter" ? pad * 1 : pad;
    return { x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p };
  }
  if (isSpan(s)) {
    if (s.kind === "circle") {
      const r = circleRadius(s) + pad;
      return { x: s.x1 - r, y: s.y1 - r, w: 2 * r, h: 2 * r };
    }
    const r = rectOf(s);
    const p = s.kind === "arrow" ? pad * 5 : pad;
    return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p };
  }
  const half = (s.stamp * unit) / 2 + pad;
  return { x: s.cx - half, y: s.cy - half, w: 2 * half, h: 2 * half };
}

/**
 * Whether (x, y) is on the shape: within `slop` picture pixels of what is drawn,
 * or anywhere inside it when it is filled (or a stamp, which is small).
 */
export function hitTest(s: MarkupShape, x: number, y: number, unit: number, slop: number): boolean {
  const reach = (s.size * unit) / 2 + slop;
  const reach2 = reach * reach;
  if (isStroke(s)) {
    const p = s.points;
    if (p.length === 2) return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= reach2;
    for (let i = 0; i + 3 < p.length; i += 2) if (segDist2(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach2) return true;
    return false;
  }
  if (isSpan(s)) {
    if (s.kind === "line" || s.kind === "arrow") return segDist2(x, y, s.x1, s.y1, s.x2, s.y2) <= reach2 * (s.kind === "arrow" ? 2 : 1);
    if (s.kind === "circle") {
      const d = Math.hypot(x - s.x1, y - s.y1);
      const r = circleRadius(s);
      return s.fill ? d <= r + reach : Math.abs(d - r) <= reach;
    }
    const r = rectOf(s);
    const inside = x >= r.x - reach && x <= r.x + r.w + reach && y >= r.y - reach && y <= r.y + r.h + reach;
    if (!inside) return false;
    if (s.fill) return true;
    const nearEdge =
      Math.abs(x - r.x) <= reach || Math.abs(x - (r.x + r.w)) <= reach || Math.abs(y - r.y) <= reach || Math.abs(y - (r.y + r.h)) <= reach;
    return nearEdge;
  }
  const half = (s.stamp * unit) / 2 + slop;
  return Math.abs(x - s.cx) <= half && Math.abs(y - s.cy) <= half;
}

/** The topmost shape at (x, y), if any. */
export function shapeAt(shapes: MarkupShape[], x: number, y: number, unit: number, slop: number): MarkupShape | null {
  for (let i = shapes.length - 1; i >= 0; i--) if (hitTest(shapes[i], x, y, unit, slop)) return shapes[i];
  return null;
}

/** The shape moved by (dx, dy). */
export function moveShape<T extends MarkupShape>(s: T, dx: number, dy: number): T {
  if (isStroke(s)) return { ...s, points: s.points.map((v, i) => r1(v + (i % 2 ? dy : dx))) };
  if (isSpan(s)) return { ...s, x1: r1(s.x1 + dx), y1: r1(s.y1 + dy), x2: r1(s.x2 + dx), y2: r1(s.y2 + dy) };
  return { ...s, cx: r1((s as StampShape).cx + dx), cy: r1((s as StampShape).cy + dy) };
}

/** The next free number for a badge. */
export const nextBadgeNumber = (shapes: MarkupShape[]) =>
  shapes.reduce((m, s) => (s.kind === "badge" && typeof (s as StampShape).n === "number" ? Math.max(m, (s as StampShape).n!) : m), 0) + 1;

/** Whether something read back from storage is a list of shapes this version can draw. */
export function validShapes(value: unknown): MarkupShape[] {
  if (!Array.isArray(value)) return [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return value.filter((s: any): s is MarkupShape => {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.color !== "string" || !num(s.size)) return false;
    if (STROKE_KINDS.has(s.kind)) return Array.isArray(s.points) && s.points.length >= 2 && s.points.every(num);
    if (SPAN_KINDS.has(s.kind)) return [s.x1, s.y1, s.x2, s.y2].every(num);
    if (STAMP_KINDS.has(s.kind)) return [s.cx, s.cy, s.stamp].every(num);
    return false;
  });
}

/** Opacity a kind is drawn with. */
export const HIGHLIGHTER_OPACITY = 0.38;
/** A highlighter is this many times thicker than its size says, so the same slider suits both. */
export const HIGHLIGHTER_SCALE = 3;
/** Fill opacity of a filled rectangle or circle (a filled star or badge is solid). */
export const AREA_FILL_OPACITY = 0.3;

/** The line thickness actually drawn, in picture pixels. */
export const strokeWidth = (s: MarkupShape, unit: number) => s.size * unit * (s.kind === "highlighter" ? HIGHLIGHTER_SCALE : 1);

/**
 * The marks as an SVG document over a picture of the given size: used to save the
 * image with its marks. The badge's number uses a plain font stack.
 */
export function shapesToSvg(shapes: MarkupShape[], width: number, height: number): string {
  const unit = ptUnit(width, height);
  const esc = (v: string) => v.replace(/[^#a-zA-Z0-9(),.%\s-]/g, "");
  const parts = shapes.map((s) => {
    const c = esc(s.color);
    const w = r1(strokeWidth(s, unit));
    const line = `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    if (isStroke(s)) {
      return `<path d="${strokePath(s.points)}" ${line}${s.kind === "highlighter" ? ` stroke-opacity="${HIGHLIGHTER_OPACITY}"` : ""}/>`;
    }
    if (isSpan(s)) {
      if (s.kind === "line") return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${line}/>`;
      if (s.kind === "arrow") {
        const [ex, ey] = arrowShaftEnd(s, unit);
        return `<line x1="${s.x1}" y1="${s.y1}" x2="${r1(ex)}" y2="${r1(ey)}" ${line}/><polygon points="${arrowHead(s, unit)}" fill="${c}" stroke="${c}" stroke-width="${r1(w / 2)}" stroke-linejoin="round"/>`;
      }
      const fill = s.fill ? `fill="${c}" fill-opacity="${AREA_FILL_OPACITY}"` : `fill="none"`;
      const edge = `stroke="${c}" stroke-width="${w}" stroke-linejoin="round"`;
      if (s.kind === "circle") return `<circle cx="${s.x1}" cy="${s.y1}" r="${r1(circleRadius(s))}" ${fill} ${edge}/>`;
      const r = rectOf(s);
      return `<rect x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(r.w)}" height="${r1(r.h)}" ${fill} ${edge}/>`;
    }
    const half = (s.stamp * unit) / 2;
    if (s.kind === "check") return `<path d="${checkPath(s.cx, s.cy, half)}" ${line}/>`;
    if (s.kind === "cross") return `<path d="${crossPath(s.cx, s.cy, half)}" ${line}/>`;
    if (s.kind === "star")
      return `<polygon points="${starPoints(s.cx, s.cy, half)}" fill="${s.fill ? c : "none"}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>`;
    const r = r1(half - w / 2);
    const text = `<text x="${s.cx}" y="${s.cy}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="700" font-size="${r1(half * 1.05)}" fill="${s.fill ? "#fff" : c}">${s.n ?? ""}</text>`;
    return `<circle cx="${s.cx}" cy="${s.cy}" r="${r}" fill="${s.fill ? c : "none"}" stroke="${c}" stroke-width="${w}"/>${text}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}
