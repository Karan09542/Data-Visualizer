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
import type { DrawPick, DrawToolKind } from "./DrawTool";
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
  if (tool === "circle" && picks.length === 2 && !picks[1].name) {
    const [c, rim] = picks;
    const radius = Math.hypot(rim.x - c.x, rim.y - c.y);
    if (radius > 0) {
      const centreOnly = buildShape("point", [c], opts);
      const centre = c.name && !c.name.startsWith("#") ? c.name : centreOnly.rows[0]?.label!;
      const rows = c.name ? [] : centreOnly.rows;
      const [rimName] = nextPointNames(opts.taken, 1);
      // r_A, not rA: mathjs would read a missing rA as a unit (ronto-amperes).
      let sliderName = `r_${centre}`;
      for (let n = 2; opts.taken.has(sliderName); n++) sliderName = `r_${centre}_${n}`;
      opts.taken.add(sliderName);
      // The direction it was drawn in, kept as plain numbers.
      const ux = fmt((rim.x - c.x) / radius);
      const uy = fmt((rim.y - c.y) / radius);
      const base = { id: "", visible: true, autoType: false, angleUnit: "rad" } as const;
      rows.push(
        {
          ...base,
          id: opts.newId(),
          type: "parametric",
          expr: `${centre} + ${sliderName}*[cos(t rad), sin(t rad)]`,
          color: opts.color,
          tRange: [0, 2 * Math.PI],
        },
        {
          ...base,
          id: opts.newId(),
          type: "point",
          expr: `${rimName} = ${centre} + ${sliderName}*[${ux}, ${uy}]`,
          color: opts.pointColor,
          showLabel: true,
          label: rimName,
          dragVars: [sliderName],
        },
      );
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
      row("point", `${name} = [${fmt(p.x)}, ${fmt(p.y)}]`, opts.pointColor, {
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
      rows.push(row("line", `[${A}, ${B}]`, opts.color));
      break;
    case "vector":
      // From A (its tail) to B (its tip): drag either to change it.
      rows.push(...vectorRows(A, B, opts.color, opts));
      break;
    case "line":
      rows.push(row("parametric", `${A} + t*(${B} - ${A})/norm(${B} - ${A})`, opts.color, { tRange: [-500, 500] }));
      break;
    case "circle":
      rows.push(
        row("parametric", `${A} + norm(${B} - ${A})*[cos(t rad), sin(t rad)]`, opts.color, {
          tRange: [0, 2 * Math.PI],
        }),
      );
      break;
    case "polygon":
      rows.push(
        row("polygon", `[${named.join(", ")}]`, opts.color, {
          fillColor: opts.color,
          fillOpacity: 0.15,
          fillPattern: "solid",
        }),
      );
      break;
    case "distance":
      rows.push(row("parametric", `${A} + t*(${B} - ${A})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(
        readout(
          `(${A} + ${B})/2 + 0.35*[-(${B} - ${A})[2], (${B} - ${A})[1]]/norm(${B} - ${A})`,
          `${A}${B} = {{norm(${B} - ${A})}}`,
        ),
      );
      break;
    case "angle":
      // A, then the corner B, then C: the angle ∠ABC.
      rows.push(row("parametric", `${B} + t*(${A} - ${B})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(row("parametric", `${B} + t*(${C} - ${B})`, opts.color, { tRange: [0, 1], lineStyle: "dashed" }));
      rows.push(row("parametric", `arcAt(${B}, ${A}, ${C}, t, 0.6)`, opts.color, { tRange: [0, 1] }));
      rows.push(readout(`arcAt(${B}, ${A}, ${C}, 0.5, 1.15)`, `∠${A}${B}${C} = {{angleAt(${B}, ${A}, ${C}):1}}°`));
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
  opts: Pick<BuildOptions, "newId" | "vector">,
): MathFunction[] {
  const { magnitude, components, direction } = opts.vector ?? {};
  const base = { visible: true, autoType: false, angleUnit: "rad" as const };
  const rows: MathFunction[] = [
    {
      ...base,
      id: opts.newId(),
      type: "vector",
      expr: `Vector(${A}, ${B})`,
      color,
      // Drawn on the graph as well as written in the label.
      vectorComponents: !!components,
      vectorDirection: !!direction,
    },
  ];

  const v = `(${B} - ${A})`;
  // LaTeX, written raw (String.raw), so each backslash here is one in the label.
  const name = String.raw`\overrightarrow{${A}${B}}`;
  const parts: string[] = [];
  if (magnitude) parts.push(`|${name}| = {{norm(${v})}}`);
  if (components) {
    const pair = String.raw`\langle {{${v}[1]}},\, {{${v}[2]}} \rangle`;
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
      expr: `(${A} + ${B})/2 + 0.4*[-${v}[2], ${v}[1]]/norm(${v})`,
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
