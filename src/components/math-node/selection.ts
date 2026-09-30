/**
 * What the Select tool works on, and how a selection is moved, turned, resized
 * and deleted.
 *
 * Shapes made with the drawing tools are built on named points (`[A, B, C]`,
 * `A + r_A*[cos(t rad), sin(t rad)]`). Transforming such a shape means moving
 * those points (and scaling its radius slider): the shape, its labels and
 * measurements, and any point attached to it all follow, and nothing comes apart.
 * A row with no points behind it (a typed equation, a polygon typed as numbers)
 * is transformed through its own translate/rotate/scale settings instead.
 */
import type { MathFunction, MathVariable } from "./mathTypes";

const NUM = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
/** `A = [1, 2]`: a point whose equation is its position. */
const FREE_POINT = new RegExp(String.raw`^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[\s*(${NUM})\s*,\s*(${NUM})\s*\]\s*$`, "i");
const ASSIGNED = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*=(?!=)/;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
/** `[A, B, C]` or `tri = [A, B, C]`. */
const NAME_LIST =
  /^(\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?)\[\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*\]\s*$/;
/** The radius of a circle drawn as centre + radius·[cos, sin]. */
const CIRCLE_RADIUS = /\+\s*([A-Za-z_][A-Za-z0-9_]*)\s*\*\s*\[\s*cos\(/;

export interface SelectedPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Selection {
  /** The rows selected together: the clicked one and the rest of its drawn shape. */
  rowIds: string[];
  /** The free points the selection is built on; empty for a row with none. */
  points: SelectedPoint[];
  /** Length sliders that scale with it (a drawn circle's radius). */
  sliders: string[];
}

const fmt = (v: number) => String(Number(v.toFixed(6)));
const namesIn = (text: string | undefined) => new Set(text?.match(IDENT) ?? []);
const definedName = (f: MathFunction) => f.expr?.match(ASSIGNED)?.[1];

export function freePoint(f: MathFunction): SelectedPoint | null {
  if (f.type !== "point") return null;
  const m = f.expr?.match(FREE_POINT);
  return m ? { id: f.id, name: m[1], x: Number(m[2]), y: Number(m[3]) } : null;
}

/** The rows that make up the drawn shape `fnId` belongs to. */
export function groupOf(fnId: string, functions: MathFunction[]): string[] {
  const row = functions.find((f) => f.id === fnId);
  if (!row) return [];
  if (!row.drawGroup) return [row.id];
  return functions.filter((f) => f.drawGroup === row.drawGroup).map((f) => f.id);
}

/** What selecting row `fnId` selects: its shape, and the free points under it. */
export function describeSelection(fnId: string, functions: MathFunction[], variables: MathVariable[]): Selection | null {
  const rowIds = groupOf(fnId, functions);
  if (!rowIds.length) return null;
  const selected = functions.filter((f) => rowIds.includes(f.id));
  const byName = new Map<string, MathFunction>();
  for (const f of functions) {
    const n = definedName(f);
    if (n && !byName.has(n)) byName.set(n, f);
  }
  const sliderNames = new Set(variables.map((v) => v.name));

  const points = new Map<string, SelectedPoint>();
  const seen = new Set<string>();
  const queue = [...selected];
  while (queue.length) {
    const row = queue.pop()!;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const self = freePoint(row);
    if (self) {
      points.set(self.id, self);
      continue;
    }
    // A derived row (a point riding on a curve, a named value): look under it.
    for (const name of namesIn(row.expr)) {
      const dep = byName.get(name);
      if (dep && !seen.has(dep.id)) queue.push(dep);
    }
  }

  const sliders = new Set<string>();
  for (const row of selected) {
    const r = row.expr?.match(CIRCLE_RADIUS)?.[1];
    if (r && sliderNames.has(r)) sliders.add(r);
  }
  return { rowIds, points: [...points.values()], sliders: [...sliders] };
}

/** Where the selection's points are: their average, the fixed point of turning and resizing. */
export function selectionCentre(sel: Selection): [number, number] | null {
  if (!sel.points.length) return null;
  const n = sel.points.length;
  return [sel.points.reduce((s, p) => s + p.x, 0) / n, sel.points.reduce((s, p) => s + p.y, 0) / n];
}

export type Motion =
  | { kind: "move"; dx: number; dy: number }
  | { kind: "rotate"; angle: number; centre: [number, number] }
  | { kind: "scale"; factor: number; centre: [number, number] };

const moved = (m: Motion, x: number, y: number): [number, number] => {
  if (m.kind === "move") return [x + m.dx, y + m.dy];
  const [cx, cy] = m.centre;
  if (m.kind === "scale") return [cx + (x - cx) * m.factor, cy + (y - cy) * m.factor];
  const c = Math.cos(m.angle);
  const s = Math.sin(m.angle);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

/**
 * A selection built on points, transformed: the new equations of its points, and
 * the new values of its sliders (a radius grows with a resize).
 */
export function transformPoints(
  sel: Selection,
  motion: Motion,
  variables: MathVariable[],
): { exprs: Map<string, string>; sliderValues: Map<string, number> } {
  const exprs = new Map<string, string>();
  for (const p of sel.points) {
    const [x, y] = moved(motion, p.x, p.y);
    exprs.set(p.id, `${p.name} = [${fmt(x)}, ${fmt(y)}]`);
  }
  const sliderValues = new Map<string, number>();
  if (motion.kind === "scale") {
    for (const name of sel.sliders) {
      const v = variables.find((s) => s.name === name);
      if (v) sliderValues.set(name, Number((v.value * motion.factor).toFixed(6)));
    }
  }
  return { exprs, sliderValues };
}

/**
 * A row with no points behind it, transformed through its own settings. It turns
 * and resizes about `pivot` (in the row's own coordinates), which the caller
 * fixes when the row is first selected.
 */
export function transformRow(f: MathFunction, motion: Motion): Partial<MathFunction> {
  const [tx, ty] = f.transformTranslate ?? [0, 0];
  if (motion.kind === "move") return { transformTranslate: [tx + motion.dx, ty + motion.dy] };
  if (motion.kind === "rotate") return { transformRotate: (f.transformRotate ?? 0) + motion.angle };
  const [sx, sy] = f.transformScale ?? [1, 1];
  return { transformScale: [sx * motion.factor, sy * motion.factor] };
}

/**
 * Deletes rows, and with them what only they needed:
 *  - their handles (a circle's rim point, a point set to resize it);
 *  - anything built on a name they defined, except that a polygon or segment
 *    just loses that corner while it still has enough left;
 *  - the free points they stood on, if nothing else uses them;
 *  - sliders nothing uses any more.
 */
export function deleteRows(
  functions: MathFunction[],
  variables: MathVariable[],
  rowIds: string[],
): { functions: MathFunction[]; variables: MathVariable[] } {
  const sliderNames = new Set(variables.map((v) => v.name));
  const removed = new Map<string, MathFunction>();
  let rows = functions;
  const remove = (ids: Iterable<string>) => {
    const set = new Set(ids);
    for (const f of rows) if (set.has(f.id)) removed.set(f.id, f);
    rows = rows.filter((f) => !set.has(f.id));
  };
  remove(rowIds);

  // Handles that set a slider the deleted shape was drawn with.
  const shapeSliders = new Set<string>();
  for (const f of removed.values()) for (const n of namesIn(f.expr)) if (sliderNames.has(n)) shapeSliders.add(n);
  remove(rows.filter((f) => f.dragVars?.some((v) => shapeSliders.has(v))).map((f) => f.id));
  // What was asked for: only its own points are cleaned up afterwards, not those of
  // shapes that fall as a consequence (delete a triangle's corner and the other two stay).
  const asked = [...removed.values()];

  // Whatever was built on a deleted name goes too; polygons and segments shed the corner.
  for (let guard = 0; guard < 50; guard++) {
    const gone = new Set<string>();
    for (const f of removed.values()) {
      const n = definedName(f);
      if (n) gone.add(n);
    }
    const stillDefined = new Set(rows.map(definedName).filter(Boolean) as string[]);
    for (const n of stillDefined) gone.delete(n);
    if (!gone.size) break;

    const orphans: string[] = [];
    let changed = false;
    rows = rows.map((f) => {
      if (![...namesIn(f.expr)].some((n) => gone.has(n))) return f;
      const list = (f.type === "polygon" || f.type === "line") && f.expr.match(NAME_LIST);
      if (list) {
        const left = list[2].split(",").map((s) => s.trim()).filter((n) => !gone.has(n));
        if (left.length >= (f.type === "polygon" ? 3 : 2)) {
          changed = true;
          return { ...f, expr: `${list[1]}[${left.join(", ")}]`, compiled: undefined, compiledKey: undefined };
        }
      }
      orphans.push(f.id);
      return f;
    });
    if (!orphans.length && !changed) break;
    remove(orphans);
    if (!orphans.length) break;
  }

  // Free points the deleted rows stood on, if nothing left mentions them.
  const used = new Set<string>();
  const noteUse = () => {
    used.clear();
    for (const f of rows) {
      for (const n of namesIn(f.expr)) used.add(n);
      for (const n of namesIn(f.label?.includes("{{") ? f.label : "")) used.add(n);
      for (const n of f.dragVars ?? []) used.add(n);
    }
  };
  noteUse();
  const stoodOn = new Set<string>();
  for (const f of asked) for (const n of namesIn(f.expr)) stoodOn.add(n);
  const unusedPoints = rows.filter((f) => {
    const p = freePoint(f);
    if (!p || !stoodOn.has(p.name)) return false;
    // Its own equation mentions its name; look at everything else.
    return !rows.some((o) => o !== f && (namesIn(o.expr).has(p.name) || (o.label?.includes("{{") && namesIn(o.label).has(p.name))));
  });
  remove(unusedPoints.map((f) => f.id));

  noteUse();
  const everUsed = new Set<string>();
  for (const f of removed.values()) {
    for (const n of namesIn(f.expr)) everUsed.add(n);
    for (const n of f.dragVars ?? []) everUsed.add(n);
  }
  return {
    functions: rows,
    variables: variables.filter((v) => !(everUsed.has(v.name) && !used.has(v.name))),
  };
}

/** Several rows selected together: their shapes, points and sliders, each counted once. */
export function describeSelections(ids: string[], functions: MathFunction[], variables: MathVariable[]): Selection | null {
  const rowIds = new Set<string>();
  const points = new Map<string, SelectedPoint>();
  const sliders = new Set<string>();
  for (const id of ids) {
    const one = describeSelection(id, functions, variables);
    if (!one) continue;
    one.rowIds.forEach((r) => rowIds.add(r));
    one.points.forEach((p) => points.set(p.id, p));
    one.sliders.forEach((s) => sliders.add(s));
  }
  if (!rowIds.size) return null;
  return { rowIds: [...rowIds], points: [...points.values()], sliders: [...sliders] };
}
