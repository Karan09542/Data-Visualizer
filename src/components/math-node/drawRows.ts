/**
 * Turns a shape drawn with the drawing tools into ordinary rows, the same ones a
 * user could type: points `A = [1, 2]` (draggable), and a shape that refers to
 * them by name (`[A, B, C]`), so dragging a corner reshapes everything built on it.
 *
 * Angles use the angleAt/arcAt helpers and circles `cos(t rad)`, so they read
 * the same whether the graph works in radians or degrees.
 */
import * as mathjs from "mathjs";
import type { MathFunction } from "./mathTypes";
import type { DrawPick, DrawSolid, DrawToolKind } from "./DrawTool";
import { pinnedAngleUnit } from "./scope";

const NAME = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/;

/** Names already in use: row names and labels, and slider names. */
export function takenNames(functions: MathFunction[], variableNames: string[]): Set<string> {
  const taken = new Set(variableNames);
  for (const f of functions) {
    const m = f.expr?.match(NAME);
    if (m) taken.add(m[1]);
    if (f.name) taken.add(f.name);
    if (f.label && !f.label.includes("{{")) taken.add(f.label.trim());
  }
  return taken;
}

/** The next free point names: A, B, … Z, then A1, B1, … */
export function nextPointNames(taken: Set<string>, count: number): string[] {
  const out: string[] = [];
  for (let round = 0; out.length < count; round++) {
    for (let c = 0; c < 26 && out.length < count; c++) {
      const name = String.fromCharCode(65 + c) + (round ? String(round) : "");
      if (!taken.has(name)) {
        taken.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

const fmt = (v: number) => String(Number(v.toFixed(6)));

/** A point's coordinates, with its height only when it has one (so flat points still show in 2D). */
const coordsOf = (p: DrawPick, spatial: boolean) =>
  spatial && (p.z ?? 0) !== 0 ? `[${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z!)}]` : `[${fmt(p.x)}, ${fmt(p.y)}]`;

/**
 * Drawn off the floor, or on an upright plane, in the 3D view: the shape's rows are
 * written for space.
 */
const isSpatial = (picks: DrawPick[]) => picks.some((p) => (p.z ?? 0) !== 0 || (p.plane !== undefined && p.plane !== 2));

/** The two axes that run along each drawing plane (by the axis it is square to). */
const PLANE_AXES: Record<0 | 1 | 2, [number, number]> = { 2: [0, 1], 1: [0, 2], 0: [1, 2] };

/** `[a, b]` along a drawing plane, as a vector in space. */
const inPlane = (plane: 0 | 1 | 2, a: string, b: string) =>
  plane === 2 ? `[${a}, ${b}, 0]` : plane === 1 ? `[${a}, 0, ${b}]` : `[0, ${a}, ${b}]`;

const POLYGON_ADJECTIVES: Record<number, string> = {
  3: "Triangular",
  4: "Quadrilateral",
  5: "Pentagonal",
  6: "Hexagonal",
  7: "Heptagonal",
  8: "Octagonal",
  9: "Nonagonal",
  10: "Decagonal",
};

/** The solid's top point: the one clicked on, or a new draggable point there. */
function solidTip(solid: DrawSolid, opts: BuildOptions): { name: string; rows: MathFunction[] } {
  if (solid.tip.name && !solid.tip.name.startsWith("#")) return { name: solid.tip.name, rows: [] };
  const [name] = nextPointNames(opts.taken, 1);
  return {
    name,
    rows: [
      makeRow(opts, "point", `${name} = ${coordsOf(solid.tip, true)}`, opts.pointColor, {
        isDraggable: true,
        showLabel: true,
        label: name,
      }),
    ],
  };
}

/**
 * A prism or pyramid on a polygon of named corners. The top point sets it: a prism's
 * top is the base moved so its middle lands there (slanted when it isn't straight
 * above), a pyramid's apex is that point. Drag it, or any corner, to reshape it.
 */
function polygonSolidRows(corners: string[], solid: DrawSolid, opts: BuildOptions): MathFunction[] {
  const n = corners.length;
  const tip = solidTip(solid, opts);
  const T = `p3(${tip.name})`;
  const pc = corners.map((c) => `p3(${c})`);
  const face = (expr: string, opacity: number) =>
    makeRow(opts, "polygon", expr, opts.color, {
      fillColor: opts.color,
      fillOpacity: opacity,
      fillPattern: "solid",
      showAngles: false,
    });
  const rows = [...tip.rows];
  const adjective = POLYGON_ADJECTIVES[n] ?? `${n}-sided`;
  let label: string;
  if (solid.kind === "extrude") {
    const middle = `((${pc.join(" + ")})/${n})`;
    const d = `(${T} - ${middle})`;
    rows.push(face(`[${pc.map((c) => `${c} + ${d}`).join(", ")}]`, 0.22));
    for (let i = 0; i < n; i++) {
      const a = pc[i];
      const b = pc[(i + 1) % n];
      rows.push(face(`[${a}, ${b}, ${b} + ${d}, ${a} + ${d}]`, 0.12));
    }
    label = `${adjective} prism · V = ${2 * n}, E = ${3 * n}, F = ${n + 2} · V − E + F = 2`;
  } else {
    for (let i = 0; i < n; i++) rows.push(face(`[${pc[i]}, ${pc[(i + 1) % n]}, ${T}]`, 0.14));
    label = `${adjective} pyramid · V = ${n + 1}, E = ${2 * n}, F = ${n + 1} · V − E + F = 2`;
  }
  rows.push(
    makeRow(opts, "point", `${T} + [0, 0, 0.5]`, opts.color, {
      showPoint: false,
      showLabel: true,
      label,
      labelPlain: true,
      labelAlignment: "center",
    }),
  );
  return rows;
}

/**
 * A cylinder or cone on a circle round `centre` (an expression for a point in space)
 * of radius `radius`, in the drawing plane `plane`; its top point sets the top.
 */
function circleSolidRows(
  centre: string,
  radius: string,
  plane: 0 | 1 | 2,
  solid: DrawSolid,
  opts: BuildOptions,
): MathFunction[] {
  const tip = solidTip(solid, opts);
  const T = `p3(${tip.name})`;
  const R = `(${radius})`;
  const round = (a: string, b: string) => inPlane(plane, a, b);
  const surface = (expr: string, opacity: number) =>
    // u runs round, v up the side (both 0 to 2π, as the 3D view sweeps them).
    makeRow(opts, "function", expr, opts.color, { fillColor: opts.color, fillOpacity: opacity });
  const rows = [...tip.rows];
  const up = `(v/(2*pi))`;
  // How far the top is from the base, square to it: the solid's height.
  const height = `abs((${T} - ${centre})[${plane + 1}])`;
  rows.push(surface(`${centre} + ${up}*${R}*${round("cos(u)", "sin(u)")}`, 0.3));
  if (solid.kind === "extrude") {
    rows.push(surface(`${centre} + ${R}*${round("cos(u)", "sin(u)")} + ${up}*(${T} - ${centre})`, 0.4));
    rows.push(surface(`${T} + ${up}*${R}*${round("cos(u)", "sin(u)")}`, 0.3));
    rows.push(makeRow(opts, "parametric", `${T} + ${R}*${round("cos(t rad)", "sin(t rad)")}`, opts.color, { tRange: [0, 2 * Math.PI] }));
  } else {
    rows.push(surface(`(1 - ${up})*(${centre} + ${R}*${round("cos(u)", "sin(u)")}) + ${up}*${T}`, 0.4));
  }
  const name = solid.kind === "extrude" ? "Cylinder" : "Cone";
  const volume = solid.kind === "extrude" ? `pi*${R}^2*${height}` : `pi*${R}^2*${height}/3`;
  rows.push(
    makeRow(opts, "point", `${T} + [0, 0, 0.5]`, opts.color, {
      showPoint: false,
      showLabel: true,
      label: `${name} · r = {{${radius}}}, h = {{${height}}} · volume {{${volume}}}`,
      labelPlain: true,
      labelAlignment: "center",
    }),
  );
  return rows;
}

/** The plane a shape was drawn on (level when it doesn't say). */
const planeOf = (picks: DrawPick[]): 0 | 1 | 2 => picks.find((p) => p.plane !== undefined)?.plane ?? 2;
interface BuildOptions {
  taken: Set<string>;
  /** For the shape (and its readouts). */
  color: string;
  /** For new points. */
  pointColor: string;
  newId: () => string;
  /** The row a point was placed on (Point tool on a shape's outline). */
  rowById?: (id: string) => MathFunction | undefined;
  /** Slider names, to tell a circle with a radius slider from one through a point. */
  sliderNames?: Set<string>;
  /** What a drawn vector is labelled with. */
  vector?: VectorOptions;
  /** Write points with their height even when this shape alone wouldn't need it. */
  spatialHint?: boolean;
  /** 3D view: make the polygon or circle into a solid up to this top. */
  solid?: DrawSolid;
}

/** Live readouts beside a drawn vector; with none, it's a plain arrow. */
export interface VectorOptions {
  /** Its length: |AB| = 5.00 */
  magnitude?: boolean;
  /** Its x and y parts: ⟨3.00, 4.00⟩ */
  components?: boolean;
  /** Its direction, anticlockwise from the positive x-axis: 53.1° */
  direction?: boolean;
}

/** A slider a drawn shape needs (a circle's radius). */
export interface DrawnSlider {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
}

export interface DrawnShape {
  rows: MathFunction[];
  sliders: DrawnSlider[];
  /** Changes to rows already on the graph (a polygon gaining a corner). */
  updates?: { id: string; patch: Partial<MathFunction> }[];
  /** Put the new rows just before this row, which now depends on them (default: at the end). */
  insertBefore?: string;
}

/** The rows for one drawn shape: its new points first, then the shape itself. */
export function buildDrawnRows(tool: DrawToolKind, picks: DrawPick[], opts: BuildOptions): MathFunction[] {
  return buildDrawnShape(tool, picks, opts).rows;
}

/**
 * A circle drawn with a new rim point gets a radius slider, and the rim point
 * becomes a handle kept at that distance from the centre: dragging the centre
 * moves the whole circle, dragging the rim point resizes it. A circle drawn
 * through an existing point goes through that point, as asked.
 */
export function buildDrawnShape(tool: DrawToolKind, picks: DrawPick[], opts: BuildOptions): DrawnShape {
  if (tool === "point" && picks[0]?.on && !picks[0].name) {
    const source = opts.rowById?.(picks[0].on.fnId);
    const attached = source && attachPoint(picks[0], source, opts);
    if (attached) return attached;
  }
  const shape = buildShape(tool, picks, opts);
  // Everything but its free corner points (which other shapes may share) is one group.
  const group = opts.newId();
  return {
    ...shape,
    rows: shape.rows.map((r) => (r.type === "point" && r.isDraggable ? r : { ...r, drawGroup: group })),
  };
}

function buildShape(tool: DrawToolKind, picks: DrawPick[], opts: BuildOptions): DrawnShape {
  const spatial = isSpatial(picks) || !!opts.solid;
  // In space a name is wrapped in p3(…), so a flat point (no height) and a point in space add up.
  const P = (name: string) => (spatial ? `p3(${name})` : name);
  if (tool === "circle" && picks.length === 2 && !picks[1].name) {
    const [c, rim] = picks;
    // A circle round the centre in the plane it was drawn on, through the rim.
    const plane = planeOf(picks);
    const [ua, va] = PLANE_AXES[plane];
    const cv = [c.x, c.y, c.z ?? 0];
    const rv = [rim.x, rim.y, rim.z ?? 0];
    const radius = Math.hypot(rv[ua] - cv[ua], rv[va] - cv[va]);
    if (radius > 0) {
      const centreOnly = buildShape("point", [c], { ...opts, spatialHint: spatial, solid: undefined });
      const centre = c.name && !c.name.startsWith("#") ? c.name : centreOnly.rows[0]?.label!;
      const rows = c.name ? [] : centreOnly.rows;
      const [rimName] = nextPointNames(opts.taken, 1);
      // r_A, not rA: mathjs would read a missing rA as a unit (ronto-amperes).
      let sliderName = `r_${centre}`;
      for (let n = 2; opts.taken.has(sliderName); n++) sliderName = `r_${centre}_${n}`;
      opts.taken.add(sliderName);
      // The direction it was drawn in, kept as plain numbers.
      const ux = fmt((rv[ua] - cv[ua]) / radius);
      const uy = fmt((rv[va] - cv[va]) / radius);
      const base = { id: "", visible: true, autoType: false, angleUnit: "rad" } as const;
      rows.push(
        {
          ...base,
          id: opts.newId(),
          type: "parametric",
          expr: spatial
            ? `${P(centre)} + ${sliderName}*${inPlane(plane, "cos(t rad)", "sin(t rad)")}`
            : `${centre} + ${sliderName}*[cos(t rad), sin(t rad)]`,
          color: opts.color,
          tRange: [0, 2 * Math.PI],
        },
        {
          ...base,
          id: opts.newId(),
          type: "point",
          expr: spatial
            ? `${rimName} = ${P(centre)} + ${sliderName}*${inPlane(plane, ux, uy)}`
            : `${rimName} = ${centre} + ${sliderName}*[${ux}, ${uy}]`,
          color: opts.pointColor,
          showLabel: true,
          label: rimName,
          dragVars: [sliderName],
        },
      );
      if (opts.solid) rows.push(...circleSolidRows(P(centre), sliderName, plane, opts.solid, opts));
      const step = radius < 1 ? 0.001 : 0.01;
      return {
        rows,
        sliders: [
          {
            name: sliderName,
            value: Number(radius.toFixed(step < 0.01 ? 3 : 2)),
            min: 0,
            max: Math.max(10, Math.ceil(radius * 3)),
            step,
            description: `Radius of the circle round ${centre}. Drag ${rimName} to change it.`,
          },
        ],
      };
    }
  }
  return { rows: buildShapeRows(tool, picks, opts), sliders: [] };
}

function buildShapeRows(tool: DrawToolKind, picks: DrawPick[], opts: BuildOptions): MathFunction[] {
  const rows: MathFunction[] = [];
  const row = (type: MathFunction["type"], expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
    id: opts.newId(),
    type,
    expr,
    color,
    visible: true,
    autoType: false,
    // Drawn shapes read the same in either mode; pinned so the DEG switch never touches them.
    angleUnit: "rad",
    ...extra,
  });

  const spatial = !!opts.spatialHint || isSpatial(picks) || !!opts.solid;
  const P = (name: string) => (spatial ? `p3(${name})` : name);
  // Name every click: an existing point keeps its name, "#i" is this shape's i-th click again.
  const fresh = picks.filter((p) => !p.name).length;
  const names = nextPointNames(opts.taken, fresh);
  const named: string[] = [];
  let k = 0;
  picks.forEach((p) => {
    if (p.name?.startsWith("#")) {
      named.push(named[Number(p.name.slice(1))]);
      return;
    }
    if (p.name) {
      named.push(p.name);
      return;
    }
    const name = names[k++];
    named.push(name);
    rows.push(
      row("point", `${name} = ${coordsOf(p, spatial)}`, opts.pointColor, {
        isDraggable: true,
        showLabel: true,
        label: name,
      }),
    );
  });

  const [A, B, C] = named;
  const readout = (at: string, label: string, extra: Partial<MathFunction> = {}) =>
    row("point", at, opts.color, {
      showPoint: false,
      showLabel: true,
      label,
      labelPlain: true,
      labelAlignment: "center",
      ...extra,
    });

  switch (tool) {
    case "point":
      break;
    case "segment":
      // In space every corner as [x, y, z]: a list can't mix flat points and points in space.
      rows.push(row("line", `[${P(A)}, ${P(B)}]`, opts.color));
      break;
    case "vector":
      // From A (its tail) to B (its tip): drag either to change it.
      rows.push(...vectorRows(A, B, opts.color, { ...opts, spatial }));
      break;
    case "line":
      rows.push(row("parametric", `${P(A)} + t*(${P(B)} - ${P(A)})/norm(${P(B)} - ${P(A)})`, opts.color, { tRange: [-500, 500] }));
      break;
    case "circle":
      rows.push(
        row("parametric", spatial
          // A circle round A in the plane it was drawn on, as wide as A is from B.
          ? `${P(A)} + norm(${P(B)} - ${P(A)})*${inPlane(planeOf(picks), "cos(t rad)", "sin(t rad)")}`
          : `${A} + norm(${B} - ${A})*[cos(t rad), sin(t rad)]`, opts.color, {
          tRange: [0, 2 * Math.PI],
        }),
      );
      if (opts.solid) rows.push(...circleSolidRows(P(A), `norm(${P(B)} - ${P(A)})`, planeOf(picks), opts.solid, opts));
      break;
    case "polygon":
      rows.push(
        row("polygon", `[${named.map(P).join(", ")}]`, opts.color, {
          fillColor: opts.color,
          fillOpacity: 0.15,
          fillPattern: "solid",
          ...(opts.solid ? { showAngles: false } : {}),
        }),
      );
      if (opts.solid) rows.push(...polygonSolidRows(named, opts.solid, opts));
      break;
    case "distance":
      rows.push(row("parametric", `${P(A)} + t*(${P(B)} - ${P(A)})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(
        readout(
          spatial
            ? `(${P(A)} + ${P(B)})/2 + [0, 0, 0.35]`
            : `(${A} + ${B})/2 + 0.35*[-(${B} - ${A})[2], (${B} - ${A})[1]]/norm(${B} - ${A})`,
          `${A}${B} = {{norm(${P(B)} - ${P(A)})}}`,
        ),
      );
      break;
    case "angle":
      // A, then the corner B, then C: the angle ∠ABC.
      rows.push(row("parametric", `${P(B)} + t*(${P(A)} - ${P(B)})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(row("parametric", `${P(B)} + t*(${P(C)} - ${P(B)})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(row("parametric", `arcAt(${P(B)}, ${P(A)}, ${P(C)}, t, 0.6)`, opts.color, { tRange: [0, 1] }));
      rows.push(readout(`arcAt(${P(B)}, ${P(A)}, ${P(C)}, 0.5, 1.15)`, `∠${A}${B}${C} = {{angleAt(${B}, ${A}, ${C}):1}}°`));
      break;
  }
  return rows;
}

// ─── A point placed on a shape ────────────────────────────────────────────────

/** `[A, B, C]` or `tri = [A, B, C]`: corners given by name. */
const NAME_LIST =
  /^\s*(?:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?\[\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)+)\s*\]\s*$/;
/** A circle drawn as centre + radius·[cos, sin]; group 1 is the radius. */
const CIRCLE = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*\+\s*(.+?)\s*\*\s*\[\s*cos\(t rad\)\s*,\s*sin\(t rad\)\s*\]\s*$/;

export function makeRow(
  opts: BuildOptions,
  type: MathFunction["type"],
  expr: string,
  color: string,
  extra: Partial<MathFunction> = {},
): MathFunction {
  return { id: opts.newId(), type, expr, color, visible: true, autoType: false, angleUnit: "rad", ...extra };
}

export function freeName(taken: Set<string>, base: string): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  taken.add(name);
  return name;
}

/**
 * What a row draws, with its running variable (`x` of y = f(x), `t` of a curve)
 * replaced by `replacement`: the row's own formula, evaluated at one place.
 */
function substitute(expr: string, symbol: string, replacement: string): string | null {
  try {
    let node: any = mathjs.parse(expr);
    if (node.isFunctionAssignmentNode) {
      symbol = node.params?.[0] ?? symbol; // f(x) = …: its own parameter
      node = node.expr;
    } else if (node.isAssignmentNode) {
      node = node.value; // y = …, c = [...]
    }
    const swapped = node.transform((n: any) =>
      n.isSymbolNode && n.name === symbol ? new (mathjs as any).SymbolNode(replacement) : n,
    );
    return swapped.toString();
  } catch {
    return null;
  }
}

/**
 * A point placed on a shape's outline becomes part of that shape:
 *
 *  - on a polygon's side: a new corner there (drag it to reshape the polygon);
 *  - on a segment: the segment becomes two, joined at the point (drag to bend it);
 *  - on a circle with a radius slider: a point of the circle that, dragged,
 *    takes the circle with it (the radius follows);
 *  - on any other curve, a line, or a graph y = f(x): a point that slides along
 *    it, and moves with it when the curve changes.
 *
 * Null when the shape can't take a point (a region, a curve with no parameter):
 * the caller then places an ordinary free point where it was clicked.
 */
function attachPoint(pick: DrawPick, src: MathFunction, opts: BuildOptions): DrawnShape | null {
  const on = pick.on!;
  const [name] = nextPointNames(opts.taken, 1);
  const label = { showLabel: true, label: name };
  const giveUp = () => {
    opts.taken.delete(name);
    return null;
  };

  if (src.type === "polygon" || src.type === "line") {
    const m = src.expr.match(NAME_LIST);
    if (!m) return giveUp();
    const prefix = m[1] ? `${m[1]} = ` : "";
    const corners = m[2].split(",").map((c) => c.trim());
    const point = makeRow(opts, "point", `${name} = [${fmt(pick.x)}, ${fmt(pick.y)}]`, opts.pointColor, {
      isDraggable: true,
      ...label,
    });

    if (src.type === "polygon") {
      // The outline's segment i runs from corner i to corner i + 1.
      const i = Math.max(0, Math.min(corners.length - 1, on.seg));
      corners.splice(i + 1, 0, name);
      return {
        rows: [point],
        sliders: [],
        // Before the polygon, which now needs the point to exist.
        insertBefore: src.id,
        updates: [{ id: src.id, patch: { expr: `${prefix}[${corners.join(", ")}]` } }],
      };
    }

    if (corners.length !== 2) return giveUp();
    // The second half keeps the segment's look.
    const { id: _id, expr: _expr, name: _name, label: _label, compiled: _c, compiled2: _c2, compiledKey: _k, error: _e, ...look } =
      src as any;
    return {
      rows: [point, { ...look, id: opts.newId(), expr: `[${name}, ${corners[1]}]` }],
      sliders: [],
      insertBefore: src.id,
      updates: [{ id: src.id, patch: { expr: `${prefix}[${corners[0]}, ${name}]` } }],
    };
  }

  if (src.type === "parametric" && on.t !== undefined && Number.isFinite(on.t)) {
    const slider = freeName(opts.taken, `t_${name}`);
    const body = substitute(src.expr, "t", slider);
    if (!body) {
      opts.taken.delete(slider);
      return giveUp();
    }
    const [t0, t1] = src.tRange ?? [0, 2 * Math.PI];
    let lo = Math.min(t0, t1);
    let hi = Math.max(t0, t1);
    const circle = src.expr.match(CIRCLE);
    // Round a circle the point may be dragged past where the curve starts and ends.
    if (circle) {
      lo -= 2 * Math.PI;
      hi += 2 * Math.PI;
    }
    const radius = circle && opts.sliderNames?.has(circle[1]) ? circle[1] : null;
    const span = hi - lo;
    return {
      rows: [
        makeRow(opts, "point", `${name} = ${body}`, opts.pointColor, {
          ...label,
          // With the radius too, the point goes wherever it's dragged and the circle follows.
          dragVars: radius ? [radius, slider] : [slider],
          // Its trig must mean what the curve's does.
          angleUnit: pinnedAngleUnit(src),
        }),
      ],
      sliders: [
        {
          name: slider,
          // Kept precise, so the point starts exactly where it was placed.
          value: Number(Math.max(lo, Math.min(hi, on.t)).toFixed(8)),
          min: Number(lo.toFixed(4)),
          max: Number(hi.toFixed(4)),
          // Fine enough that a dragged point keeps up with the pointer (sliders snap to their step).
          step: span > 100 ? 0.01 : Number((span / 20000).toPrecision(1)),
          description: radius
            ? `Where ${name} is on its circle. Drag ${name}: the circle resizes to follow.`
            : `Where ${name} is along its curve. Drag ${name} to slide it.`,
        },
      ],
    };
  }

  if (src.type === "function") {
    const slider = freeName(opts.taken, `x_${name}`);
    const body = substitute(src.expr, "x", slider);
    if (!body) {
      opts.taken.delete(slider);
      return giveUp();
    }
    const x = on.t !== undefined && Number.isFinite(on.t) ? on.t : pick.x;
    return {
      rows: [
        makeRow(opts, "point", `${name} = [${slider}, ${body}]`, opts.pointColor, {
          ...label,
          dragVars: [slider],
          angleUnit: pinnedAngleUnit(src),
        }),
      ],
      sliders: [
        {
          name: slider,
          value: Number(x.toFixed(6)),
          min: Math.floor(x - 20),
          max: Math.ceil(x + 20),
          step: 0.01,
          description: `Where ${name} is along the graph. Drag ${name} to slide it.`,
        },
      ],
    };
  }

  return giveUp();
}

// ─── Vectors ──────────────────────────────────────────────────────────────────

/**
 * The arrow from point `A` to point `B`, with the label its options ask for:
 * its name written as a vector (the two ends under an arrow), then its length,
 * its x and y parts and its direction, each live.
 */
export function vectorRows(
  A: string,
  B: string,
  color: string,
  opts: Pick<BuildOptions, "newId" | "vector"> & { spatial?: boolean },
): MathFunction[] {
  const { magnitude, components } = opts.vector ?? {};
  // A direction from the +x axis means little for an arrow in space.
  const direction = opts.vector?.direction && !opts.spatial;
  const S = (name: string) => (opts.spatial ? `p3(${name})` : name);
  const base = { visible: true, autoType: false, angleUnit: "rad" as const };
  const rows: MathFunction[] = [
    {
      ...base,
      id: opts.newId(),
      type: "vector",
      expr: `Vector(${A}, ${B})`,
      color,
      // Drawn on the graph as well as written in the label.
      vectorComponents: !!components && !opts.spatial,
      vectorDirection: !!direction,
    },
  ];

  const v = `(${S(B)} - ${S(A)})`;
  // LaTeX, written raw (String.raw), so each backslash here is one in the label.
  const name = String.raw`\overrightarrow{${A}${B}}`;
  const parts: string[] = [];
  if (magnitude) parts.push(`|${name}| = {{norm(${v})}}`);
  if (components) {
    const pair = opts.spatial
      ? String.raw`\langle {{${v}[1]}},\, {{${v}[2]}},\, {{${v}[3]}} \rangle`
      : String.raw`\langle {{${v}[1]}},\, {{${v}[2]}} \rangle`;
    parts.push(magnitude ? pair : `${name} = ${pair}`);
  }
  // Radians here whatever the graph's switch says (drawn rows are pinned), so ×180/π is right.
  if (direction) {
    const angle = String.raw`{{mod(atan2(${v}[2], ${v}[1])*180/pi, 360):1}}^\circ`;
    // On its own: the vector and its angle, as in polar form.
    parts.push(magnitude || components ? angle : String.raw`${name}\ \angle\ ${angle}`);
  }
  if (parts.length) {
    rows.push({
      ...base,
      id: opts.newId(),
      type: "point",
      // Beside the arrow's middle, clear of the line.
      expr: opts.spatial ? `(${S(A)} + ${S(B)})/2 + [0, 0, 0.4]` : `(${A} + ${B})/2 + 0.4*[-${v}[2], ${v}[1]]/norm(${v})`,
      color,
      showPoint: false,
      showLabel: true,
      // LaTeX, for the arrow over the name.
      label: parts.join(String.raw` \;\cdot\; `),
      labelLatex: true,
      labelAlignment: "center",
    });
  }
  return rows;
}
