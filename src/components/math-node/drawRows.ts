/**
 * Turns a shape drawn with the drawing tools into ordinary rows, the same ones a
 * user could type: points `A = [1, 2]` (draggable), and a shape that refers to
 * them by name (`[A, B, C]`), so dragging a corner reshapes everything built on it.
 *
 * Angles use the angleAt/arcAt helpers and circles `cos(t rad)`, so they read
 * the same whether the graph works in radians or degrees.
 */
import type { MathFunction } from "./mathTypes";
import type { DrawPick, DrawToolKind } from "./DrawTool";

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
  if (tool === "circle" && picks.length === 2 && !picks[1].name) {
    const [c, rim] = picks;
    const radius = Math.hypot(rim.x - c.x, rim.y - c.y);
    if (radius > 0) {
      const centreOnly = buildDrawnShape("point", [c], opts);
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
      const base = { id: "", visible: true, autoType: false } as const;
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
  const readout = (at: string, label: string) =>
    row("point", at, opts.color, {
      showPoint: false,
      showLabel: true,
      label,
      labelPlain: true,
      labelAlignment: "center",
    });

  switch (tool) {
    case "point":
      break;
    case "segment":
      rows.push(row("line", `[${A}, ${B}]`, opts.color));
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
