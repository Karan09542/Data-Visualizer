/**
 * Laying things out along a drawn path.
 *
 * A selection is a set of points in scene units. This turns it into a route with a measured
 * length, picks places along that route, and builds what sits at each one - a shape, an emoji, a
 * picture - or runs a line of text along it.
 *
 * Placement is worked out from the route alone, so what the preview draws and what Apply adds to
 * the canvas can never drift apart.
 */
import * as fabric from 'fabric';
import type { Point, SelectionShape } from '../../selection/types';
import { flattenShape } from '../../selection/geometry';

export interface PathGeometry {
  points: Point[];
  closed: boolean;
  /** Distance from the start to each point; the last entry is the whole length. */
  cumulative: number[];
  length: number;
}

/** One spot on the route: where it is, which way the route runs there, and how big to draw. */
export interface Placement {
  x: number;
  y: number;
  /** Direction of travel, in radians. */
  angle: number;
  scale: number;
}

export interface SpreadOptions {
  /** `spacing` keeps a fixed gap; `count` fits a number of items to the route. */
  mode: 'spacing' | 'count';
  spacing: number;
  count: number;
  /** How far in from each end to start and stop, 0-0.45 of the route. */
  startTrim: number;
  endTrim: number;
  /** Slides everything along the route. */
  offsetAlong: number;
  /** Moves everything to one side of the route. */
  sideOffset: number;
  /** Puts every other item on the other side. */
  alternate: boolean;
  jitterPosition: number;
  jitterSize: number;
  jitterAngle: number;
  seed: number;
  maxItems: number;
}

export type AlongShapeId =
  | 'circle' | 'square' | 'triangle' | 'diamond' | 'star'
  | 'heart' | 'hexagon' | 'plus' | 'arrow' | 'dash';

export interface ItemOptions {
  kind: 'shape' | 'emoji' | 'image';
  shapeId: AlongShapeId;
  emoji: string;
  image: HTMLImageElement | HTMLCanvasElement | null;
  /** Longest side of one item, in scene units. */
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  /** Turn each item to follow the route. */
  rotateWithPath: boolean;
  /** Turned this much further, in degrees. */
  extraAngle: number;
}

export interface PathTextOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  /** Extra space between letters, in thousandths of an em - fabric's own unit. */
  charSpacing: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  /** Which side of the line the letters sit on. */
  side: 'left' | 'right';
  align: 'left' | 'center' | 'right';
  /** Slides the text along the route. */
  startOffset: number;
}

/** Repeatable randomness: the same seed gives the same scatter, so a preview can be trusted. */
const randomiser = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** Twice the signed area of a ring: tiny means the points are a line rather than an outline. */
export const ringArea = (points: Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
};

/**
 * A shape as a route. `closed` joins the last point back to the first, which is what an outline
 * wants and a drawn line does not.
 */
export const geometryFromShape = (
  shape: SelectionShape | null,
  options: { closed: boolean; reverse: boolean },
): PathGeometry | null => {
  if (!shape) return null;
  const flat = flattenShape(shape, 96);
  let points = flat.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 2) return null;
  if (options.reverse) points = [...points].reverse();

  const cumulative: number[] = [0];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumulative.push(length);
  }
  if (options.closed) {
    const first = points[0];
    const last = points[points.length - 1];
    length += Math.hypot(first.x - last.x, first.y - last.y);
    cumulative.push(length);
  }
  if (length <= 0) return null;
  return { points, closed: options.closed, cumulative, length };
};

/** Where the route is at `distance` along it, and which way it points there. */
export const pointAt = (geom: PathGeometry, distance: number): Placement => {
  const { points, cumulative, length, closed } = geom;
  let d = distance;
  if (closed) {
    d = ((d % length) + length) % length;
  } else {
    d = Math.min(length, Math.max(0, d));
  }

  let i = 1;
  while (i < cumulative.length && cumulative[i] < d) i++;
  const from = points[i - 1];
  const to = points[i % points.length] ?? points[points.length - 1];
  const segStart = cumulative[i - 1];
  const segLength = (cumulative[i] ?? length) - segStart || 1;
  const t = (d - segStart) / segLength;

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    angle: Math.atan2(to.y - from.y, to.x - from.x),
    scale: 1,
  };
};

/** Every spot an item goes, in order along the route. */
export const spreadAlong = (geom: PathGeometry, options: SpreadOptions): Placement[] => {
  const start = geom.length * Math.min(0.45, Math.max(0, options.startTrim));
  const end = geom.length - geom.length * Math.min(0.45, Math.max(0, options.endTrim));
  const span = Math.max(0, end - start);
  if (span <= 0) return [];

  let step: number;
  let total: number;
  if (options.mode === 'count') {
    total = Math.max(1, Math.round(options.count));
    // On a loop the last item would land on the first, so a loop divides the whole way round.
    step = geom.closed ? span / total : total > 1 ? span / (total - 1) : 0;
  } else {
    step = Math.max(1, options.spacing);
    total = Math.max(1, Math.floor(span / step) + (geom.closed ? 0 : 1));
  }
  total = Math.min(total, Math.max(1, options.maxItems));

  const random = randomiser(options.seed);
  const placements: Placement[] = [];
  for (let i = 0; i < total; i++) {
    const wobble = options.jitterPosition ? (random() * 2 - 1) * options.jitterPosition : 0;
    const distance = start + options.offsetAlong + i * step + wobble;
    if (!geom.closed && (distance < -1 || distance > geom.length + 1)) continue;

    const spot = pointAt(geom, distance);
    const side = options.alternate && i % 2 === 1 ? -1 : 1;
    const across = options.sideOffset * side;
    // At right angles to the route, so an offset follows the curve rather than a fixed direction.
    const nx = -Math.sin(spot.angle);
    const ny = Math.cos(spot.angle);

    placements.push({
      x: spot.x + nx * across,
      y: spot.y + ny * across,
      angle: spot.angle + (options.jitterAngle ? (random() * 2 - 1) * options.jitterAngle * Math.PI / 180 : 0),
      scale: 1 + (options.jitterSize ? (random() * 2 - 1) * options.jitterSize : 0),
    });
  }
  return placements;
};

/** The route as SVG path data, which is what fabric's text-on-a-path wants. */
export const pathToSvg = (geom: PathGeometry): string => {
  const [first, ...rest] = geom.points;
  const body = rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${body}${geom.closed ? ' Z' : ''}`;
};

/** Points of a regular polygon or star, drawn in a 100 x 100 box. */
const polygonPath = (sides: number, innerRatio = 1, rotation = -Math.PI / 2): string => {
  const steps = innerRatio === 1 ? sides : sides * 2;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const radius = 46 * (innerRatio === 1 || i % 2 === 0 ? 1 : innerRatio);
    const a = rotation + (i / steps) * Math.PI * 2;
    parts.push(`${(50 + Math.cos(a) * radius).toFixed(2)} ${(50 + Math.sin(a) * radius).toFixed(2)}`);
  }
  return `M ${parts.join(' L ')} Z`;
};

/** The shapes on offer, each drawn in the same 100 x 100 box so sizes match across them. */
export const ALONG_SHAPES: { id: AlongShapeId; label: string; d: string }[] = [
  { id: 'circle', label: 'Dot', d: 'M 50 4 A 46 46 0 1 1 49.9 4 Z' },
  { id: 'square', label: 'Square', d: 'M 8 8 H 92 V 92 H 8 Z' },
  { id: 'triangle', label: 'Triangle', d: polygonPath(3) },
  { id: 'diamond', label: 'Diamond', d: polygonPath(4) },
  { id: 'hexagon', label: 'Hexagon', d: polygonPath(6) },
  { id: 'star', label: 'Star', d: polygonPath(5, 0.42) },
  { id: 'heart', label: 'Heart', d: 'M 50 90 C 16 66 4 46 4 30 C 4 14 16 6 28 6 C 38 6 46 12 50 20 C 54 12 62 6 72 6 C 84 6 96 14 96 30 C 96 46 84 66 50 90 Z' },
  { id: 'plus', label: 'Cross', d: 'M 38 6 H 62 V 38 H 94 V 62 H 62 V 94 H 38 V 62 H 6 V 38 H 38 Z' },
  { id: 'arrow', label: 'Arrow', d: 'M 10 14 L 90 50 L 10 86 L 30 50 Z' },
  { id: 'dash', label: 'Dash', d: 'M 6 38 H 94 A 12 12 0 0 1 94 62 H 6 A 12 12 0 0 1 6 38 Z' },
];

const SHAPE_BY_ID = new Map(ALONG_SHAPES.map((s) => [s.id, s]));

/** One item, ready to draw at its spot on the route. */
const buildItem = (place: Placement, item: ItemOptions): fabric.Object | null => {
  const size = Math.max(1, item.size * Math.max(0.05, place.scale));
  const angle = (item.rotateWithPath ? (place.angle * 180) / Math.PI : 0) + item.extraAngle;
  const shared = {
    left: place.x,
    top: place.y,
    originX: 'center' as const,
    originY: 'center' as const,
    angle,
    opacity: item.opacity,
    objectCaching: false,
  };

  if (item.kind === 'emoji') {
    if (!item.emoji.trim()) return null;
    return new fabric.FabricText(item.emoji, { ...shared, fontSize: size, fill: item.fill });
  }

  if (item.kind === 'image') {
    if (!item.image) return null;
    const source = item.image as any;
    const w = Number(source.naturalWidth || source.width) || 1;
    const h = Number(source.naturalHeight || source.height) || 1;
    const scale = size / Math.max(w, h);
    return new fabric.FabricImage(item.image as any, { ...shared, scaleX: scale, scaleY: scale });
  }

  const shape = SHAPE_BY_ID.get(item.shapeId) ?? ALONG_SHAPES[0];
  const path = new fabric.Path(shape.d, {
    ...shared,
    fill: item.fill,
    stroke: item.strokeWidth > 0 ? item.stroke : undefined,
    strokeWidth: item.strokeWidth > 0 ? (item.strokeWidth * 100) / size : 0,
    strokeUniform: true,
  });
  // The shapes are drawn in a 100 unit box, so one scale brings any of them to the chosen size.
  path.set({ scaleX: size / 100, scaleY: size / 100 });
  return path;
};

/** Everything that goes along the route, in order. */
export const buildItems = (placements: Placement[], item: ItemOptions): fabric.Object[] =>
  placements.map((p) => buildItem(p, item)).filter((o): o is fabric.Object => !!o);

/**
 * A line of text that runs along the route.
 *
 * fabric draws each letter at its distance along the path, measured from the path's own centre, so
 * the text object is placed at that centre to land the letters on the drawn line.
 */
export const buildTextOnPath = (geom: PathGeometry, options: PathTextOptions): fabric.Object | null => {
  if (!options.text.trim()) return null;
  const path = new fabric.Path(pathToSvg(geom), {
    fill: '',
    stroke: '',
    objectCaching: false,
  });

  return new fabric.FabricText(options.text, {
    path,
    pathSide: options.side,
    pathAlign: 'center',
    pathStartOffset: options.startOffset,
    textAlign: options.align,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    charSpacing: options.charSpacing,
    fill: options.fill,
    stroke: options.strokeWidth > 0 ? options.stroke : undefined,
    strokeWidth: options.strokeWidth,
    paintFirst: 'stroke',
    opacity: options.opacity,
    originX: 'center',
    originY: 'center',
    left: path.pathOffset.x,
    top: path.pathOffset.y,
    objectCaching: false,
  });
};
