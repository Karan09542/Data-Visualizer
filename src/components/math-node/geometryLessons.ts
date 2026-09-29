/**
 * Geometry lessons for the math node: circles and their theorems, the conic
 * sections, triangles (angles, similarity, congruence, the classic theorems) and
 * polygons.
 *
 * Like the physics labs, each is built from ordinary rows, so a student can open
 * any part and see how it's made:
 *
 *   - helpers      ang(V, P, Q) = …           (the angle at V, in degrees)
 *   - handles      A = on(angA) with dragVars   (drag a point along the circle)
 *   - free points  A = [-1, 2.5], draggable     (drag a triangle's corners anywhere)
 *   - live labels  "∠APB = {{ang(P, A, B)}}°"   (measurements that update)
 *
 * Every lesson states its facts, so the numbers on the graph can be checked
 * against them as the shape is dragged around.
 */
import type { MathFunction, MathVariable, VariableGroup } from "./mathTypes";
import { INK, TEXT, sceneGroup, sceneSlider, type SimulationPreset, type SimulationScene } from "./simulations";

export type LessonCategory = "Circle" | "Circle theorems" | "Conics" | "Triangles" | "Polygons";

export const LESSON_CATEGORIES: LessonCategory[] = ["Circle", "Circle theorems", "Conics", "Triangles", "Polygons"];

export interface GeometryLesson extends SimulationPreset {
  category: LessonCategory;
  /** What to learn: definitions, statements and formulas. */
  facts: string[];
}

const BLUE = "#3b82f6";
const PINK = "#ec4899";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const VIOLET = "#8b5cf6";
const RED = "#ef4444";
const SKY = "#0ea5e9";
const TEAL = "#14b8a6";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Small functions the lessons measure with, added as rows so they can be read. */
const HELPERS = {
  len: "len(P, Q) = norm(Q - P)",
  nrm: "nrm(v) = v/norm(v)",
  dir: "dir(V, P) = atan2(P[2] - V[2], P[1] - V[1])",
  // The signed turn from VP to VQ, in (−π, π].
  turn: "turn(V, P, Q) = mod(dir(V, Q) - dir(V, P) + pi, 2*pi) - pi",
  ang: "ang(V, P, Q) = abs(turn(V, P, Q))*180/pi",
  arc: "arc(V, P, Q, s, rad) = V + rad*[cos(dir(V, P) + s*turn(V, P, Q)), sin(dir(V, P) + s*turn(V, P, Q))]",
  cross2: "cross2(u, v) = u[1]*v[2] - u[2]*v[1]",
  on: "on(deg) = r*[cos(deg*pi/180), sin(deg*pi/180)]",
  foot: "foot(P, A, B) = A + dot(P - A, B - A)/dot(B - A, B - A)*(B - A)",
  circum:
    "circum(P, Q, R) = [dot(P, P)*(Q[2] - R[2]) + dot(Q, Q)*(R[2] - P[2]) + dot(R, R)*(P[2] - Q[2]), dot(P, P)*(R[1] - Q[1]) + dot(Q, Q)*(P[1] - R[1]) + dot(R, R)*(Q[1] - P[1])]/(2*(P[1]*(Q[2] - R[2]) + Q[1]*(R[2] - P[2]) + R[1]*(P[2] - Q[2])))",
};
type Helper = keyof typeof HELPERS;
const ANGLES: Helper[] = ["len", "nrm", "dir", "turn", "ang", "arc", "cross2"];

function lessonRows(prefix: string) {
  let n = 0;
  const row = (type: MathFunction["type"], expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
    id: `${prefix}_${++n}`,
    type,
    expr,
    color,
    visible: true,
    ...extra,
  });
  const labelled = (label?: string): Partial<MathFunction> =>
    label ? { showLabel: true, label, labelPlain: true } : {};
  /** Text on the graph, centred on `at`; {{…}} shows live values. */
  const text = (at: string, label: string, color: string = TEXT, extra?: Partial<MathFunction>) =>
    row("point", at, color, {
      showPoint: false,
      showLabel: true,
      label,
      labelPlain: true,
      labelAlignment: "center",
      ...extra,
    });

  return {
    text,
    define: (expr: string) => row("function", expr, INK),
    helpers: (...names: Helper[]) => names.map((k) => row("function", HELPERS[k], INK)),
    point: (expr: string, color: string, label?: string, extra?: Partial<MathFunction>) =>
      row("point", expr, color, { ...labelled(label), ...extra }),
    /** A point that sets sliders when dragged (one slider slides it along its path). */
    handle: (expr: string, color: string, label: string, dragVars: string[], extra?: Partial<MathFunction>) =>
      row("point", expr, color, { ...labelled(label), dragVars, ...extra }),
    /** A point dragged anywhere: its equation holds its position. */
    free: (name: string, [x, y]: [number, number], color: string) =>
      row("point", `${name} = [${x}, ${y}]`, color, { isDraggable: true, ...labelled(name) }),
    polygon: (expr: string, color: string, extra?: Partial<MathFunction>) =>
      row("polygon", expr, color, { fillColor: color, fillOpacity: 0.12, fillPattern: "solid", outlineWidth: 2.5, ...extra }),
    path: (expr: string, color: string, tRange: [number, number], extra?: Partial<MathFunction>) =>
      row("parametric", expr, color, { tRange, outlineWidth: 2.5, ...extra }),
    /** A closed path, filled. */
    fill: (expr: string, color: string, tRange: [number, number], opacity = 0.25, extra?: Partial<MathFunction>) =>
      row("parametric", expr, color, { tRange, fillColor: color, fillOpacity: opacity, fillPattern: "solid", outlineWidth: 1, ...extra }),
    curve: (expr: string, color: string, extra?: Partial<MathFunction>) => row("implicit", expr, color, { outlineWidth: 2.5, ...extra }),
    seg: (from: string, to: string, color: string, extra?: Partial<MathFunction>) =>
      row("parametric", `${from} + t*((${to}) - (${from}))`, color, { tRange: [0, 1], outlineWidth: 2.5, ...extra }),
    /** A whole line through a point, in a direction. */
    line: (through: string, direction: string, color: string, extra?: Partial<MathFunction>) =>
      row("parametric", `${through} + t*nrm(${direction})`, color, { tRange: [-40, 40], outlineWidth: 1.5, ...extra }),
    circle: (centre: string, radius: string, color: string, extra?: Partial<MathFunction>) =>
      row("parametric", `${centre} + ${radius}*[cos(t), sin(t)]`, color, { tRange: [0, 2 * Math.PI], outlineWidth: 2.5, ...extra }),
    /** The angle at V between VP and VQ: an arc and its size. */
    angle: (V: string, P: string, Q: string, color: string, rad = 0.55) => [
      row("parametric", `arc(${V}, ${P}, ${Q}, t, ${rad})`, color, { tRange: [0, 1], outlineWidth: 2 }),
      text(`arc(${V}, ${P}, ${Q}, 0.5, ${rad + 0.5})`, `{{ang(${V}, ${P}, ${Q}):1}}°`, color),
    ],
    /** A right-angle mark at V, between VP and VQ. */
    right: (V: string, P: string, Q: string, color: string, size = 0.3) =>
      row(
        "polygon",
        `[${V}, ${V} + ${size}*nrm((${P}) - (${V})), ${V} + ${size}*(nrm((${P}) - (${V})) + nrm((${Q}) - (${V}))), ${V} + ${size}*nrm((${Q}) - (${V}))]`,
        color,
        { fillColor: color, fillOpacity: 0.12, fillPattern: "solid", outlineWidth: 1.5, showAngles: false },
      ),
  };
}

/** Readouts stacked downwards from `top`, centred on x. */
const stack = (r: ReturnType<typeof lessonRows>, x: number, top: number, lines: string[], color = TEXT, gap = 0.7) =>
  lines.map((line, i) => r.text(`[${x}, ${top - i * gap}]`, line, color));

const still = { mode: "once" as const, min: 0, max: 10, autoplay: false };

/** Rows, possibly grouped (a helper can add several). */
type Rows = MathFunction | Rows[];
const flatten = (rows: Rows[]): MathFunction[] => rows.flatMap((x) => (Array.isArray(x) ? flatten(x) : [x]));

const scene = (
  functions: Rows[],
  variables: MathVariable[],
  groups: VariableGroup[],
  view: SimulationScene["view"],
): SimulationScene => ({ functions: flatten(functions), variables, groups, timeline: still, view });

const radiusSlider = () => sceneSlider("r", "Radius r", 3, [1, 5, 0.1], "The circle's radius.", "circle");
const onCircle = (name: string, label: string, value: number) =>
  sceneSlider(name, label, value, [0, 360, 1], "Degrees round the circle. Drag the point on the graph.", "points");
const circleGroups = () => [sceneGroup("circle", "Circle"), sceneGroup("points", "Points (drag them)")];

// ─── Circle ───────────────────────────────────────────────────────────────────

function circleParts(): SimulationScene {
  const r = lessonRows("gc_parts");
  return scene(
    [
      r.helpers(...ANGLES, "on"),
      r.define("side(P, Q, d) = (P + Q)/2 + d*[-(Q - P)[2], (Q - P)[1]]/len(P, Q)"),
      r.point("O = [0, 0]", TEXT, "O"),
      r.circle("O", "r", BLUE),
      // Sector AOB
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.fill("t < 1 ? t*A : (t < 2 ? arc(O, A, B, t - 1, r) : (3 - t)*B)", PINK, [0, 3], 0.22),
      r.path("arc(O, A, B, t, r)", PINK, [0, 1], { outlineWidth: 5 }),
      r.text("arc(O, A, B, 0.5, 0.55*r)", "Sector", PINK),
      r.text("arc(O, A, B, 0.5, r + 0.55)", "Arc AB", PINK),
      r.text("side(O, B, -0.35)", "Radius", PINK),
      // Chord CD and the segment it cuts off
      r.handle("C = on(angC)", GREEN, "C", ["angC"]),
      r.handle("D = on(angD)", GREEN, "D", ["angD"]),
      r.fill("t < 1 ? arc(O, C, D, t, r) : D + (t - 1)*(C - D)", GREEN, [0, 2], 0.25),
      r.seg("C", "D", GREEN),
      r.text("0.72*(C + D)/2", "Chord", GREEN),
      r.text("((C + D)/2 + arc(O, C, D, 0.5, r))/2", "Segment", GREEN),
      // Diameter through the centre
      r.handle("E = on(angE)", AMBER, "E", ["angE"]),
      r.seg("-E", "E", AMBER),
      r.text("side(-E, E, 0.35)", "Diameter = 2r", AMBER),
      // Tangent at T
      r.handle("T = on(angT)", VIOLET, "T", ["angT"]),
      r.line("T", "[-T[2], T[1]]", VIOLET, { tRange: [-4, 4] }),
      r.text("T + 2.6*[-T[2], T[1]]/r + 0.35*T/r", "Tangent", VIOLET),
      r.text("[0, r + 0.9]", "Circumference: the whole way round", BLUE),
      stack(r, 0, -4.4, [
        "r = {{r}}    d = 2r = {{2*r}}",
        "Circumference = 2πr = {{2*pi*r}}    Area = πr² = {{pi*r^2}}",
      ]),
    ],
    [
      radiusSlider(),
      onCircle("angA", "Sector: A (°)", 20),
      onCircle("angB", "Sector: B (°)", 80),
      onCircle("angC", "Chord: C (°)", 160),
      onCircle("angD", "Chord: D (°)", 240),
      onCircle("angE", "Diameter: E (°)", 120),
      onCircle("angT", "Tangent at T (°)", 310),
    ],
    circleGroups(),
    { x: [-7.5, 7.5], y: [-6, 5] },
  );
}

function circleMeasures(): SimulationScene {
  const r = lessonRows("gc_measure");
  return scene(
    [
      r.helpers("len", "on"),
      r.point("O = [0, 0]", TEXT, "O"),
      r.circle("O", "r", BLUE),
      r.fill(
        "t < 1 ? t*on(0) : (t < 2 ? r*[cos((t - 1)*theta*pi/180), sin((t - 1)*theta*pi/180)] : (3 - t)*on(theta))",
        PINK,
        [0, 3],
        0.22,
      ),
      r.path("r*[cos(t*theta*pi/180), sin(t*theta*pi/180)]", AMBER, [0, 1], { outlineWidth: 5 }),
      r.handle("S = on(theta)", PINK, "θ", ["theta"]),
      r.seg("[-r, 0]", "[r, 0]", TEXT, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.text("[0, -0.4]", "diameter d = 2r = {{2*r}}", TEXT),
      // The circumference unrolled into a straight line, and the arc's share of it.
      r.seg("[-pi*r, -r - 1.4]", "[pi*r, -r - 1.4]", BLUE, { outlineWidth: 4 }),
      r.seg("[-pi*r, -r - 1.4]", "[-pi*r + theta/360*2*pi*r, -r - 1.4]", AMBER, { outlineWidth: 6 }),
      r.text("[0, -r - 2]", "The circumference unrolled: 2πr = {{2*pi*r}} (amber: the arc)", TEXT),
      stack(r, 0, 5.3, [
        "C = 2πr = {{2*pi*r}}    A = πr² = {{pi*r^2}}",
        "Arc = θ/360 × 2πr = {{theta/360*2*pi*r}}    Sector = θ/360 × πr² = {{theta/360*pi*r^2}}",
        "C ÷ d = {{pi:5}} = π for every circle",
      ]),
    ],
    [
      radiusSlider(),
      sceneSlider("theta", "Sector angle θ (°)", 120, [0, 360, 1], "Drag the pink point round the circle.", "circle"),
    ],
    [sceneGroup("circle", "Circle")],
    { x: [-10, 10], y: [-8, 6.2] },
  );
}

// ─── Circle theorems ──────────────────────────────────────────────────────────

/** The rows every circle theorem starts with: helpers, O and the circle. */
const circleBase = (r: ReturnType<typeof lessonRows>) => [
  r.helpers(...ANGLES, "on"),
  r.point("O = [0, 0]", TEXT, "O"),
  r.circle("O", "r", BLUE),
];
const theoremView = { x: [-7.5, 7.5] as [number, number], y: [-6.5, 4.8] as [number, number] };
const below = (r: ReturnType<typeof lessonRows>, lines: string[]) => stack(r, 0, -4.2, lines);

function angleAtCentre(): SimulationScene {
  const r = lessonRows("gt_centre");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.handle("P = on(angP)", GREEN, "P", ["angP"]),
      // The angle at the centre stands on the arc AB away from P (reflex if P is on the small arc).
      r.define("cturn = cross2(B - A, P - A)*cross2(B - A, O - A) >= 0 ? turn(O, A, B) : turn(O, A, B) - sign(turn(O, A, B))*2*pi"),
      r.define("central = abs(cturn)*180/pi"),
      r.seg("O", "A", PINK),
      r.seg("O", "B", PINK),
      r.seg("P", "A", GREEN),
      r.seg("P", "B", GREEN),
      r.path("O + 0.7*[cos(dir(O, A) + t*cturn), sin(dir(O, A) + t*cturn)]", PINK, [0, 1], { outlineWidth: 2 }),
      r.text("O + 1.3*[cos(dir(O, A) + 0.5*cturn), sin(dir(O, A) + 0.5*cturn)]", "{{central:1}}°", PINK),
      r.angle("P", "A", "B", GREEN),
      below(r, ["∠AOB = {{central:1}}°  =  2 × ∠APB = 2 × {{ang(P, A, B):1}}°"]),
    ],
    [radiusSlider(), onCircle("angA", "A (°)", 215), onCircle("angB", "B (°)", 325), onCircle("angP", "P (°)", 100)],
    circleGroups(),
    theoremView,
  );
}

function angleInSemicircle(): SimulationScene {
  const r = lessonRows("gt_semi");
  return scene(
    [
      circleBase(r),
      r.point("A = on(180)", PINK, "A"),
      r.point("B = on(0)", PINK, "B"),
      r.handle("P = on(angP)", GREEN, "P", ["angP"]),
      r.seg("A", "B", PINK),
      r.polygon("[A, P, B]", GREEN, { fillOpacity: 0.1 }),
      below(r, ["AB is a diameter, so ∠APB = {{ang(P, A, B):1}}° wherever P is"]),
    ],
    [radiusSlider(), onCircle("angP", "P (°)", 60)],
    circleGroups(),
    theoremView,
  );
}

function anglesSameSegment(): SimulationScene {
  const r = lessonRows("gt_same");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.handle("P = on(angP)", GREEN, "P", ["angP"]),
      r.handle("Q = on(angQ)", VIOLET, "Q", ["angQ"]),
      r.seg("A", "B", PINK),
      r.seg("P", "A", GREEN),
      r.seg("P", "B", GREEN),
      r.seg("Q", "A", VIOLET),
      r.seg("Q", "B", VIOLET),
      r.angle("P", "A", "B", GREEN),
      r.angle("Q", "A", "B", VIOLET),
      below(r, [
        "∠APB = {{ang(P, A, B):1}}°   ∠AQB = {{ang(Q, A, B):1}}°",
        "Equal while P and Q are on the same side of AB. Move Q across AB: they add up to 180°.",
      ]),
    ],
    [
      radiusSlider(),
      onCircle("angA", "A (°)", 200),
      onCircle("angB", "B (°)", 340),
      onCircle("angP", "P (°)", 60),
      onCircle("angQ", "Q (°)", 125),
    ],
    circleGroups(),
    theoremView,
  );
}

function cyclicQuadrilateral(): SimulationScene {
  const r = lessonRows("gt_cyclic");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.handle("C = on(angC)", PINK, "C", ["angC"]),
      r.handle("D = on(angD)", PINK, "D", ["angD"]),
      r.polygon("[A, B, C, D]", PINK),
      below(r, [
        "∠A + ∠C = {{ang(A, D, B):1}}° + {{ang(C, B, D):1}}° = {{ang(A, D, B) + ang(C, B, D):1}}°",
        "∠B + ∠D = {{ang(B, A, C):1}}° + {{ang(D, C, A):1}}° = {{ang(B, A, C) + ang(D, C, A):1}}°",
        "(keep A, B, C, D in order round the circle)",
      ]),
    ],
    [
      radiusSlider(),
      onCircle("angA", "A (°)", 110),
      onCircle("angB", "B (°)", 200),
      onCircle("angC", "C (°)", 300),
      onCircle("angD", "D (°)", 25),
    ],
    circleGroups(),
    theoremView,
  );
}

function alternateSegment(): SimulationScene {
  const r = lessonRows("gt_alt");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", GREEN, "B", ["angB"]),
      r.handle("C = on(angC)", VIOLET, "C", ["angC"]),
      // The tangent at A, and a point T on it on the other side of AB from C.
      r.define("tA = [-A[2], A[1]]/r"),
      r.define("sT = cross2(B - A, tA)*cross2(B - A, C - A) > 0 ? -1 : 1"),
      r.point("T = A + 2.6*sT*tA", PINK, "T"),
      r.line("A", "tA", PINK, { tRange: [-5, 5] }),
      r.seg("A", "B", GREEN),
      r.seg("C", "A", VIOLET),
      r.seg("C", "B", VIOLET),
      r.angle("A", "T", "B", PINK, 0.7),
      r.angle("C", "A", "B", VIOLET),
      below(r, [
        "Tangent–chord angle ∠TAB = {{ang(A, T, B):1}}°",
        "= ∠ACB = {{ang(C, A, B):1}}°, the angle in the alternate segment",
      ]),
    ],
    [radiusSlider(), onCircle("angA", "A, the tangent point (°)", 270), onCircle("angB", "B (°)", 20), onCircle("angC", "C (°)", 140)],
    circleGroups(),
    theoremView,
  );
}

function tangentRadius(): SimulationScene {
  const r = lessonRows("gt_tr");
  return scene(
    [
      circleBase(r),
      r.handle("P = on(angP)", PINK, "P", ["angP"]),
      r.handle("Q = on(angQ)", VIOLET, "Q", ["angQ"]),
      r.seg("O", "P", PINK),
      r.line("P", "[-P[2], P[1]]", PINK, { tRange: [-5, 5], outlineWidth: 2.5 }),
      r.right("P", "O", "P + [-P[2], P[1]]", PINK),
      r.line("P", "Q - P", VIOLET, { tRange: [-9, 9], lineStyle: "dashed" }),
      below(r, [
        "The tangent at P meets the radius OP at {{ang(P, O, P + [-P[2], P[1]]):1}}°",
        "Secant PQ is {{ang(P, Q, P + [-P[2], P[1]]):1}}° from the tangent: drag Q onto P and it becomes the tangent",
      ]),
    ],
    [radiusSlider(), onCircle("angP", "P (°)", 50), onCircle("angQ", "Q (°)", 150)],
    circleGroups(),
    theoremView,
  );
}

function tangentLengths(): SimulationScene {
  const r = lessonRows("gt_tl");
  return scene(
    [
      circleBase(r),
      r.handle("T = [tx, ty]", AMBER, "T", ["tx", "ty"]),
      r.define("dT = norm(T)"),
      r.define("beta = dT > r ? acos(r/dT) : NaN"),
      r.define("phi = atan2(ty, tx)"),
      r.point("A = r*[cos(phi + beta), sin(phi + beta)]", PINK, "A"),
      r.point("B = r*[cos(phi - beta), sin(phi - beta)]", GREEN, "B"),
      r.seg("T", "A", PINK),
      r.seg("T", "B", GREEN),
      r.seg("O", "A", TEXT, { outlineWidth: 1.5 }),
      r.seg("O", "B", TEXT, { outlineWidth: 1.5 }),
      r.seg("O", "T", TEXT, { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.right("A", "O", "T", PINK),
      r.right("B", "O", "T", GREEN),
      below(r, [
        "TA = {{len(T, A)}}   TB = {{len(T, B)}}   both √(OT² − r²) = {{dT > r ? sqrt(dT^2 - r^2) : NaN}}",
        "OT bisects ∠ATB: {{ang(T, A, O):1}}° and {{ang(T, O, B):1}}°   (keep T outside the circle)",
      ]),
    ],
    [
      radiusSlider(),
      sceneSlider("tx", "T: x", 5.5, [-7, 7, 0.05], "Drag T on the graph.", "points"),
      sceneSlider("ty", "T: y", 1.2, [-5, 5, 0.05], "Drag T on the graph.", "points"),
    ],
    circleGroups(),
    theoremView,
  );
}

function perpendicularToChord(): SimulationScene {
  const r = lessonRows("gt_perp");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.point("M = (A + B)/2", GREEN, "M"),
      r.seg("A", "B", PINK),
      r.seg("O", "M", GREEN),
      r.right("M", "O", "B", GREEN),
      below(r, [
        "AM = {{len(A, M)}} = MB = {{len(M, B)}}    OM ⟂ AB ({{ang(M, O, B):1}}°)",
        "OM = √(r² − (AB/2)²) = {{sqrt(max(0, r^2 - (len(A, B)/2)^2))}}",
      ]),
    ],
    [radiusSlider(), onCircle("angA", "A (°)", 200), onCircle("angB", "B (°)", 320)],
    circleGroups(),
    theoremView,
  );
}

// ─── Conics ───────────────────────────────────────────────────────────────────

function ellipse(): SimulationScene {
  const r = lessonRows("gk_ellipse");
  return scene(
    [
      r.helpers("len", "nrm"),
      r.define("c = sqrt(abs(a^2 - b^2))"),
      r.define("major = max(a, b)"),
      r.define("e = c/major"),
      r.define("hh = (a - b)^2/(a + b)^2"),
      r.path("[a*cos(t), b*sin(t)]", BLUE, [0, 2 * Math.PI]),
      r.point("F1 = a >= b ? [-c, 0] : [0, -c]", PINK, "F₁"),
      r.point("F2 = -F1", PINK, "F₂"),
      r.handle("P = [a*cos(u*pi/180), b*sin(u*pi/180)]", GREEN, "P", ["u"]),
      r.seg("P", "F1", GREEN),
      r.seg("P", "F2", GREEN),
      r.seg("[-a, 0]", "[a, 0]", TEXT, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.seg("[0, -b]", "[0, b]", TEXT, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.text("[a/2, -0.35]", "a = {{a}}", TEXT),
      r.text("[0.55, b/2]", "b = {{b}}", TEXT),
      // Directrices: at distance a/e from the centre, across the major axis.
      r.path("a >= b ? [major^2/c, t] : [t, major^2/c]", VIOLET, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("a >= b ? [-major^2/c, t] : [t, -major^2/c]", VIOLET, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      stack(r, 0, -3.4, [
        "PF₁ + PF₂ = {{len(P, F1)}} + {{len(P, F2)}} = {{len(P, F1) + len(P, F2)}} = 2 × {{major}}",
        "c = √(a² − b²) = {{c}}    Eccentricity e = c/a = {{e:3}}",
        "Area = πab = {{pi*a*b}}    Circumference ≈ {{pi*(a + b)*(1 + 3*hh/(10 + sqrt(4 - 3*hh)))}}",
        "Latus rectum = 2b²/a = {{2*min(a, b)^2/major}}    Directrices (violet) at ±a/e = ±{{major/e}}",
      ]),
    ],
    [
      sceneSlider("a", "a (along x)", 4, [0.5, 6, 0.1], "Half the width.", "shape"),
      sceneSlider("b", "b (along y)", 2.5, [0.5, 6, 0.1], "Half the height. Make it equal to a for a circle.", "shape"),
      sceneSlider("u", "P (°)", 60, [0, 360, 1], "Drag P round the ellipse.", "points"),
    ],
    [sceneGroup("shape", "Ellipse"), sceneGroup("points", "Points (drag them)")],
    { x: [-8.5, 8.5], y: [-6.5, 5] },
  );
}

function parabola(): SimulationScene {
  const r = lessonRows("gk_parabola");
  return scene(
    [
      r.helpers("len", "nrm"),
      r.path("[t, t^2/(4*a)]", BLUE, [-8, 8]),
      r.point("F = [0, a]", PINK, "F (focus)"),
      r.path("[t, -a]", VIOLET, [-10, 10], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.text("[5, -a - 0.45]", "directrix y = −a", VIOLET),
      r.handle("P = [p, p^2/(4*a)]", GREEN, "P", ["p"]),
      r.point("D = [p, -a]", VIOLET, "D"),
      r.seg("P", "F", GREEN),
      r.seg("P", "D", GREEN),
      r.right("D", "P", "D + [1, 0]", VIOLET),
      r.seg("[-2*a, a]", "[2*a, a]", AMBER, { outlineWidth: 2 }),
      r.text("[0, a + 0.45]", "latus rectum 4a = {{4*a}}", AMBER),
      // Light coming in parallel to the axis reflects through the focus.
      r.seg("P + [0, 5]", "P", AMBER, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.line("P", "[1, p/(2*a)]", TEXT, { tRange: [-2.5, 2.5], outlineWidth: 1 }),
      stack(r, 0, -3.4, [
        "PF = {{len(P, F)}}  =  PD = {{len(P, D)}}",
        "Every point is as far from the focus as from the directrix, so e = 1",
        "x² = 4ay with focus (0, a) = (0, {{a}})",
      ]),
    ],
    [
      sceneSlider("a", "Focal length a", 1, [0.25, 3, 0.05], "Distance from the vertex to the focus.", "shape"),
      sceneSlider("p", "P: x", 2.5, [-6, 6, 0.05], "Drag P along the parabola.", "points"),
    ],
    [sceneGroup("shape", "Parabola"), sceneGroup("points", "Points (drag them)")],
    { x: [-8, 8], y: [-6, 8] },
  );
}

function hyperbola(): SimulationScene {
  const r = lessonRows("gk_hyperbola");
  return scene(
    [
      r.helpers("len", "nrm"),
      r.define("c = sqrt(a^2 + b^2)"),
      r.define("e = c/a"),
      r.path("[a*cosh(t), b*sinh(t)]", BLUE, [-3, 3]),
      r.path("[-a*cosh(t), b*sinh(t)]", BLUE, [-3, 3]),
      r.path("[t, b/a*t]", TEXT, [-12, 12], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("[t, -b/a*t]", TEXT, [-12, 12], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.polygon("[[a, b], [-a, b], [-a, -b], [a, -b]]", TEXT, { fillOpacity: 0, lineStyle: "dashed", outlineWidth: 1, showAngles: false }),
      r.point("F1 = [-c, 0]", PINK, "F₁"),
      r.point("F2 = [c, 0]", PINK, "F₂"),
      r.handle("P = [a*cosh(u), b*sinh(u)]", GREEN, "P", ["u"]),
      r.seg("P", "F1", GREEN),
      r.seg("P", "F2", GREEN),
      r.path("[a^2/c, t]", VIOLET, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("[-a^2/c, t]", VIOLET, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      stack(r, 0, -3.6, [
        "|PF₁ − PF₂| = |{{len(P, F1)}} − {{len(P, F2)}}| = {{abs(len(P, F1) - len(P, F2))}} = 2a",
        "c = √(a² + b²) = {{c}}    e = c/a = {{e:3}} (always more than 1)",
        "Asymptotes y = ±(b/a)x = ±{{b/a:3}}x    Directrices x = ±a²/c = ±{{a^2/c}}",
      ]),
    ],
    [
      sceneSlider("a", "a", 2, [0.5, 5, 0.1], "Half the distance between the vertices.", "shape"),
      sceneSlider("b", "b", 1.5, [0.3, 5, 0.1], "Sets how steep the asymptotes are.", "shape"),
      sceneSlider("u", "P (position)", 0.8, [-2.5, 2.5, 0.01], "Drag P along the right branch.", "points"),
    ],
    [sceneGroup("shape", "Hyperbola"), sceneGroup("points", "Points (drag them)")],
    { x: [-9, 9], y: [-6.5, 6] },
  );
}

function conicFamily(): SimulationScene {
  const r = lessonRows("gk_family");
  return scene(
    [
      r.helpers("len"),
      // Focus at the origin, directrix x = l/e: distance to F = e × distance to the directrix.
      r.curve("x^2 + y^2 = (l - e*x)^2", BLUE),
      r.point("F = [0, 0]", PINK, "F (focus)"),
      r.path("[l/e, t]", VIOLET, [-10, 10], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.define("rr = l/(1 + e*cos(th*pi/180))"),
      r.handle("P = rr*[cos(th*pi/180), sin(th*pi/180)]", GREEN, "P", ["th"]),
      r.point("D = [l/e, P[2]]", VIOLET, "D"),
      r.seg("P", "F", GREEN),
      r.seg("P", "D", VIOLET, { lineStyle: "dashed" }),
      stack(r, 0, 5.6, [
        'e = {{e:2}}: {{e < 0.005 ? "a circle" : (e < 0.995 ? "an ellipse" : (e < 1.005 ? "a parabola" : "a hyperbola"))}}',
        "PF ÷ PD = {{len(P, F)}} ÷ {{len(P, D)}} = {{len(P, F)/len(P, D):3}} = e",
      ]),
    ],
    [
      sceneSlider("e", "Eccentricity e", 0.6, [0, 2, 0.01], "0 circle, below 1 ellipse, 1 parabola, above 1 hyperbola.", "shape"),
      sceneSlider("l", "Size l", 2, [0.5, 4, 0.1], "The semi-latus rectum: half the width through the focus.", "shape"),
      sceneSlider("th", "P (°)", 110, [0, 360, 1], "Drag P along the curve.", "points"),
    ],
    [sceneGroup("shape", "Conic"), sceneGroup("points", "Points (drag them)")],
    { x: [-9, 9], y: [-6.5, 6.5] },
  );
}

// ─── Triangles ────────────────────────────────────────────────────────────────

/** Three draggable corners and the triangle through them. */
const triangle = (r: ReturnType<typeof lessonRows>, A: [number, number], B: [number, number], C: [number, number], color = BLUE, angles = true) => [
  r.free("A", A, color),
  r.free("B", B, color),
  r.free("C", C, color),
  r.polygon("[A, B, C]", color, { showAngles: angles }),
];
const triangleView = { x: [-7, 7] as [number, number], y: [-6.5, 5] as [number, number] };
const sides = (r: ReturnType<typeof lessonRows>) => [
  r.define("sa = len(B, C)"),
  r.define("sb = len(C, A)"),
  r.define("sc = len(A, B)"),
];

function angleSum(): SimulationScene {
  const r = lessonRows("gtr_sum");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-1, 2.5], [-3.5, -1.5], [2.5, -1.5]),
      // Extend BC past C: the exterior angle at C.
      r.point("D = C + 2.8*nrm(C - B)", TEXT, "D"),
      r.seg("C", "D", TEXT, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.angle("C", "D", "A", AMBER, 0.8),
      // The line through A parallel to BC shows why: alternate angles.
      r.line("A", "C - B", VIOLET, { tRange: [-4, 4], lineStyle: "dotted" }),
      stack(r, 0, -2.8, [
        "∠A + ∠B + ∠C = {{ang(A, B, C):1}}° + {{ang(B, A, C):1}}° + {{ang(C, A, B):1}}° = {{ang(A, B, C) + ang(B, A, C) + ang(C, A, B):1}}°",
        "Exterior angle ∠ACD = {{ang(C, D, A):1}}° = ∠A + ∠B = {{ang(A, B, C) + ang(B, A, C):1}}°",
        "The dotted line through A is parallel to BC: its alternate angles are ∠B and ∠C",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function isosceles(): SimulationScene {
  const r = lessonRows("gtr_iso");
  const tick = (P: string, Q: string) =>
    r.path(`(${P} + ${Q})/2 + t*0.28*[-(${Q} - ${P})[2], (${Q} - ${P})[1]]/len(${P}, ${Q})`, PINK, [-1, 1], { outlineWidth: 2 });
  return scene(
    [
      r.helpers(...ANGLES),
      r.handle("A = [0, h]", BLUE, "A", ["h"]),
      r.point("B = [-w, 0]", BLUE, "B"),
      r.handle("C = [w, 0]", BLUE, "C", ["w"]),
      r.polygon("[A, B, C]", BLUE),
      tick("A", "B"),
      tick("A", "C"),
      stack(r, 0, -1.3, [
        "AB = {{len(A, B)}} = AC = {{len(A, C)}}",
        "Base angles ∠B = {{ang(B, A, C):1}}° = ∠C = {{ang(C, A, B):1}}°",
        "Equilateral at height {{w*sqrt(3)}}: all sides {{2*w}}, all angles 60°",
      ]),
    ],
    [
      sceneSlider("h", "Height", 3.5, [0.3, 7, 0.05], "Drag A up and down.", "shape"),
      sceneSlider("w", "Half the base", 2, [0.3, 5, 0.05], "Drag C along the base.", "shape"),
    ],
    [sceneGroup("shape", "Triangle")],
    { x: [-7, 7], y: [-4.5, 7.5] },
  );
}

function pythagoras(): SimulationScene {
  const r = lessonRows("gtr_pyth");
  return scene(
    [
      r.helpers("len"),
      r.point("C = [0, 0]", TEXT, "C"),
      r.handle("A = [a, 0]", BLUE, "A", ["a"]),
      r.handle("B = [0, b]", GREEN, "B", ["b"]),
      r.polygon("[C, A, B]", TEXT, { fillOpacity: 0.08 }),
      r.polygon("[[0, 0], [a, 0], [a, -a], [0, -a]]", BLUE, { fillOpacity: 0.22, showAngles: false }),
      r.polygon("[[0, 0], [0, b], [-b, b], [-b, 0]]", GREEN, { fillOpacity: 0.22, showAngles: false }),
      r.polygon("[A, B, B + [b, a], A + [b, a]]", PINK, { fillOpacity: 0.22, showAngles: false }),
      r.text("[a/2, -a/2]", "a² = {{a^2}}", BLUE),
      r.text("[-b/2, b/2]", "b² = {{b^2}}", GREEN),
      r.text("(A + B)/2 + [b, a]/2", "c² = {{len(A, B)^2}}", PINK),
      stack(r, 0, -5.6, [
        "a² + b² = {{a^2}} + {{b^2}} = {{a^2 + b^2}} = c²,  so c = {{len(A, B)}}",
      ]),
    ],
    [
      sceneSlider("a", "Leg a", 3, [0.5, 4.5, 0.05], "Drag A.", "shape"),
      sceneSlider("b", "Leg b", 2, [0.5, 4.5, 0.05], "Drag B.", "shape"),
    ],
    [sceneGroup("shape", "Right triangle")],
    { x: [-6, 9], y: [-6.5, 7] },
  );
}

function triangleArea(): SimulationScene {
  const r = lessonRows("gtr_area");
  return scene(
    [
      r.helpers(...ANGLES, "foot"),
      triangle(r, [0.5, 3], [-3, -1], [3.5, -1], BLUE, false),
      sides(r),
      r.define("s = (sa + sb + sc)/2"),
      r.point("D = foot(A, B, C)", AMBER, "D"),
      r.line("B", "C - B", TEXT, { tRange: [-4, 12], lineStyle: "dotted", outlineWidth: 1 }),
      r.seg("A", "D", AMBER, { lineStyle: "dashed" }),
      r.right("D", "A", "C", AMBER),
      r.text("(A + D)/2 + [0.45, 0]", "h = {{len(A, D)}}", AMBER),
      stack(r, 0, -2.4, [
        "½ × base × height = ½ × {{sa}} × {{len(A, D)}} = {{sa*len(A, D)/2}}",
        "Heron: s = {{s}},  √(s(s − a)(s − b)(s − c)) = {{sqrt(max(0, s*(s - sa)*(s - sb)*(s - sc)))}}",
        "½ab·sin C = ½ × {{sa}} × {{sb}} × sin {{ang(C, A, B):1}}° = {{0.5*sa*sb*sin(ang(C, A, B)*pi/180)}}",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

/** A second triangle: ABC scaled by k, turned by q°, flipped when m = 1, and moved to (mx, my). */
function transformedCopy(prefix: string, similar: boolean): SimulationScene {
  const r = lessonRows(prefix);
  const scale = similar ? "k" : "1";
  const ratio = (P: string, Q: string, P2: string, Q2: string) =>
    similar ? `{{len(${P2}, ${Q2})/len(${P}, ${Q}):3}}` : `{{len(${P2}, ${Q2})}} = {{len(${P}, ${Q})}}`;
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-4.5, 1], [-5.5, -2], [-1.5, -1.5]),
      r.define("G = (A + B + C)/3"),
      r.define(
        `S(P) = [mx, my] + ${scale}*[[cos(q*pi/180), -sin(q*pi/180)], [sin(q*pi/180), cos(q*pi/180)]]*([[1, 0], [0, 1 - 2*m]]*(P - G))`,
      ),
      r.point("A2 = S(A)", PINK, "A′"),
      r.point("B2 = S(B)", PINK, "B′"),
      r.point("C2 = S(C)", PINK, "C′"),
      r.polygon("[A2, B2, C2]", PINK),
      r.handle("[mx, my]", PINK, "move", ["mx", "my"], { showPoint: true }),
      stack(r, 0, -3.6, similar
        ? [
          "A′B′ ÷ AB = " + ratio("A", "B", "A2", "B2") + "   B′C′ ÷ BC = " + ratio("B", "C", "B2", "C2") + "   C′A′ ÷ CA = " + ratio("C", "A", "C2", "A2"),
          "∠A = ∠A′ = {{ang(A2, B2, C2):1}}°   ∠B = ∠B′ = {{ang(B2, A2, C2):1}}°   ∠C = ∠C′ = {{ang(C2, A2, B2):1}}°",
          "Area ratio = k² = {{k^2:3}}",
        ]
        : [
          "A′B′ = " + ratio("A", "B", "A2", "B2") + "   B′C′ = " + ratio("B", "C", "B2", "C2") + "   C′A′ = " + ratio("C", "A", "C2", "A2"),
          "∠A′ = {{ang(A2, B2, C2):1}}°   ∠B′ = {{ang(B2, A2, C2):1}}°   ∠C′ = {{ang(C2, A2, B2):1}}°: the same as ABC",
        ]),
    ],
    [
      ...(similar ? [sceneSlider("k", "Scale factor k", 1.5, [0.2, 3, 0.05], "How much bigger the copy is.", "copy")] : []),
      sceneSlider("q", "Turn (°)", 35, [-180, 180, 1], "Rotates the copy.", "copy"),
      sceneSlider("m", "Mirror", 0, [0, 1, 1], "1 flips the copy over.", "copy"),
      sceneSlider("mx", "Copy at x", 3, [-6, 8, 0.05], "Drag the pink 'move' point.", "copy"),
      sceneSlider("my", "Copy at y", 0.5, [-5, 5, 0.05], "Drag the pink 'move' point.", "copy"),
    ],
    [sceneGroup("copy", similar ? "The similar copy" : "The congruent copy")],
    { x: [-7, 7], y: [-6.5, 5] },
  );
}

function proportionality(): SimulationScene {
  const r = lessonRows("gtr_bpt");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [0, 3], [-3.5, -2], [3, -2]),
      r.handle("D = A + lam*(B - A)", PINK, "D", ["lam"]),
      r.point("E = A + lam*(C - A)", PINK, "E"),
      r.seg("D", "E", PINK),
      stack(r, 0, -3, [
        "AD ÷ DB = {{len(A, D)/len(D, B):3}}  =  AE ÷ EC = {{len(A, E)/len(E, C):3}}",
        "DE ÷ BC = {{len(D, E)/len(B, C):3}}  =  AD ÷ AB = {{lam:3}}    DE ∥ BC ({{acos(min(1, abs(dot(nrm(E - D), nrm(C - B)))))*180/pi:1}}° apart)",
        "At the midpoints (½), DE = ½ BC: the midpoint theorem",
      ]),
    ],
    [sceneSlider("lam", "D along AB", 0.5, [0.05, 0.95, 0.01], "Drag D along AB.", "cut")],
    [sceneGroup("cut", "The parallel cut")],
    triangleView,
  );
}

function sineCosine(): SimulationScene {
  const r = lessonRows("gtr_laws");
  return scene(
    [
      r.helpers(...ANGLES, "circum"),
      triangle(r, [-0.5, 2.5], [-3, -1.5], [3, -1]),
      sides(r),
      r.define("angA = ang(A, B, C)"),
      r.define("angB = ang(B, A, C)"),
      r.define("angC = ang(C, A, B)"),
      r.define("Oc = circum(A, B, C)"),
      r.circle("Oc", "len(Oc, A)", TEXT, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.text("(B + C)/2 - 0.45*nrm(A - (B + C)/2)", "a = {{sa}}", BLUE),
      r.text("(C + A)/2 - 0.45*nrm(B - (C + A)/2)", "b = {{sb}}", BLUE),
      r.text("(A + B)/2 - 0.45*nrm(C - (A + B)/2)", "c = {{sc}}", BLUE),
      stack(r, 0, -3, [
        "a ÷ sin A = {{sa/sin(angA*pi/180)}}   b ÷ sin B = {{sb/sin(angB*pi/180)}}   c ÷ sin C = {{sc/sin(angC*pi/180)}}",
        "All equal 2R, the circumcircle's diameter: {{2*len(Oc, A)}}",
        "c² = {{sc^2}}  =  a² + b² − 2ab·cos C = {{sa^2 + sb^2 - 2*sa*sb*cos(angC*pi/180)}}",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function triangleCentres(): SimulationScene {
  const r = lessonRows("gtr_centres");
  return scene(
    [
      r.helpers(...ANGLES, "circum"),
      triangle(r, [-1, 3], [-3.5, -1.5], [3.5, -1.5], BLUE, false),
      sides(r),
      r.define("Oc = circum(A, B, C)"),
      r.define("Rc = len(Oc, A)"),
      r.define("ri = abs(cross2(B - A, C - A))/(sa + sb + sc)"),
      r.point("G = (A + B + C)/3", VIOLET, "G centroid"),
      r.point("Oc", SKY, "O circumcentre"),
      r.point("H = A + B + C - 2*Oc", RED, "H orthocentre"),
      r.point("I = (sa*A + sb*B + sc*C)/(sa + sb + sc)", GREEN, "I incentre"),
      r.circle("Oc", "Rc", SKY, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.circle("I", "ri", GREEN, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.seg("A", "(B + C)/2", VIOLET, { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.seg("B", "(C + A)/2", VIOLET, { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.seg("C", "(A + B)/2", VIOLET, { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.line("Oc", "H - Oc", RED, { tRange: [-15, 15], lineStyle: "dashed", outlineWidth: 1 }),
      stack(r, 0, -3.2, [
        "Euler line (red): O, G and H line up, with GH = {{len(G, H)}} = 2 × OG = 2 × {{len(Oc, G)}}",
        "Circumradius R = {{Rc}}    inradius r = {{ri}}",
        "Euler's formula OI² = R(R − 2r): {{len(Oc, I)^2}} = {{Rc*(Rc - 2*ri)}}",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6.5, 6] },
  );
}

// ─── Polygons ─────────────────────────────────────────────────────────────────

function rectangle(): SimulationScene {
  const r = lessonRows("gp_rect");
  return scene(
    [
      r.helpers("len"),
      r.polygon("[[0, 0], [w, 0], [w, h], [0, h]]", BLUE),
      r.handle("[w, h]", BLUE, "drag", ["w", "h"]),
      r.seg("[0, 0]", "[w, h]", PINK, { lineStyle: "dashed", outlineWidth: 2 }),
      r.seg("[w, 0]", "[0, h]", PINK, { lineStyle: "dashed", outlineWidth: 2 }),
      r.point("M = [w/2, h/2]", PINK, "M"),
      r.text("[w/2, -0.45]", "w = {{w}}", BLUE),
      r.text("[-0.6, h/2]", "h = {{h}}", BLUE),
      stack(r, 3, -1.4, [
        "Area = w × h = {{w*h}}    Perimeter = 2(w + h) = {{2*(w + h)}}",
        "Diagonals = √(w² + h²) = {{sqrt(w^2 + h^2)}}, equal, and they bisect each other at M",
        '{{abs(w - h) < 0.001 ? "w = h: a square (its diagonals also cross at 90°)" : "Make w = h for a square"}}',
      ]),
    ],
    [
      sceneSlider("w", "Width w", 5, [0.5, 8, 0.05], "Drag the corner.", "shape"),
      sceneSlider("h", "Height h", 3, [0.5, 6, 0.05], "Drag the corner.", "shape"),
    ],
    [sceneGroup("shape", "Rectangle")],
    { x: [-3, 10], y: [-4.5, 7] },
  );
}

function regularPolygon(): SimulationScene {
  const r = lessonRows("gp_regular");
  return scene(
    [
      r.define("vtx(k) = R*[cos(2*pi*k/n + pi/2), sin(2*pi*k/n + pi/2)]"),
      // Round the outline: vertex floor(s), then along the side to the next one.
      r.fill(
        "vtx(floor(min(t, n))) + (min(t, n) - floor(min(t, n)))*(vtx(floor(min(t, n)) + 1) - vtx(floor(min(t, n))))",
        BLUE,
        [0, 15],
        0.18,
        { outlineWidth: 2.5 },
      ),
      r.circle("[0, 0]", "R", TEXT, { lineStyle: "dashed", outlineWidth: 1 }),
      r.polygon("[[0, 0], vtx(0), vtx(1)]", PINK, { fillOpacity: 0.15 }),
      r.seg("[0, 0]", "(vtx(0) + vtx(1))/2", AMBER, { lineStyle: "dashed", outlineWidth: 1.5 }),
      // Not labelled "R": a label names the point, which would hide the slider R.
      r.handle("vtx(0)", BLUE, "corner", ["R"]),
      stack(r, 0, -3.9, [
        "n = {{n:0}} sides    Interior angle = (n − 2) × 180° ÷ n = {{(n - 2)*180/n:2}}°",
        "Angle sum = (n − 2) × 180° = {{(n - 2)*180:0}}°    Exterior angle = 360° ÷ n = {{360/n:2}}°",
        "Side = 2R·sin(180°/n) = {{2*R*sin(pi/n)}}    Perimeter = {{2*n*R*sin(pi/n)}}",
        "Area = ½nR²·sin(360°/n) = {{0.5*n*R^2*sin(2*pi/n)}}  → πR² = {{pi*R^2}} as n grows",
      ]),
    ],
    [
      sceneSlider("n", "Sides n", 6, [3, 12, 1], "3 is a triangle, 4 a square, 6 a hexagon…", "shape"),
      sceneSlider("R", "Radius R", 3, [1, 5, 0.05], "From the centre to a corner. Drag the top corner.", "shape"),
    ],
    [sceneGroup("shape", "Regular polygon")],
    { x: [-7.5, 7.5], y: [-8, 5] },
  );
}

function quadrilateral(): SimulationScene {
  const r = lessonRows("gp_quad");
  return scene(
    [
      r.helpers(...ANGLES),
      r.free("A", [-3, 2], BLUE),
      r.free("B", [-3.5, -2], BLUE),
      r.free("C", [3, -2.2], BLUE),
      r.free("D", [2, 2.5], BLUE),
      r.polygon("[A, B, C, D]", BLUE),
      r.seg("A", "C", TEXT, { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.seg("B", "D", TEXT, { lineStyle: "dotted", outlineWidth: 1.5 }),
      // Interior angles that stay right for a dent (reflex) corner too.
      r.define("ex(P, V, Q) = mod(dir(V, Q) - dir(P, V) + pi, 2*pi) - pi"),
      r.define("o = sign(ex(D, A, B) + ex(A, B, C) + ex(B, C, D) + ex(C, D, A))"),
      r.define("inner(P, V, Q) = 180 - o*ex(P, V, Q)*180/pi"),
      stack(r, 0, -3.2, [
        "∠A + ∠B + ∠C + ∠D = {{inner(D, A, B):1}}° + {{inner(A, B, C):1}}° + {{inner(B, C, D):1}}° + {{inner(C, D, A):1}}° = {{inner(D, A, B) + inner(A, B, C) + inner(B, C, D) + inner(C, D, A):1}}°",
        "A diagonal splits it into two triangles: 2 × 180° = 360°",
        "Area = {{abs(cross2(B - A, C - A) + cross2(C - A, D - A))/2}}",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

// ─── The lessons ──────────────────────────────────────────────────────────────

const accent = (dot: string, ring: string, text: string) => ({ dot, ring, text });
const CIRCLE_ACCENT = accent("bg-blue-500", "ring-blue-400/60 border-blue-400", "text-blue-600 dark:text-blue-400");
const THEOREM_ACCENT = accent("bg-pink-500", "ring-pink-400/60 border-pink-400", "text-pink-600 dark:text-pink-400");
const CONIC_ACCENT = accent("bg-violet-500", "ring-violet-400/60 border-violet-400", "text-violet-600 dark:text-violet-400");
const TRIANGLE_ACCENT = accent("bg-emerald-500", "ring-emerald-400/60 border-emerald-400", "text-emerald-600 dark:text-emerald-400");
const POLYGON_ACCENT = accent("bg-amber-500", "ring-amber-400/60 border-amber-400", "text-amber-600 dark:text-amber-400");

export const GEOMETRY_LESSONS: GeometryLesson[] = [
  // Circle
  {
    key: "geo_circle_parts",
    category: "Circle",
    title: "Parts of a Circle",
    topic: "Circle",
    summary: "Centre, radius, diameter, chord, arc, sector, segment and tangent.",
    facts: [
      "Centre O: the point every part of the circle is the same distance from.",
      "Radius r: from the centre to the circle. Diameter d = 2r: across, through the centre.",
      "Chord: a segment joining two points of the circle. The diameter is the longest chord.",
      "Arc: part of the circle between two points.",
      "Sector: the slice between two radii and their arc.",
      "Segment: the region between a chord and its arc.",
      "Tangent: a line that touches the circle at exactly one point.",
      "Circumference: the distance round the circle, 2πr.",
    ],
    tryThis: [
      "Drag A and B to widen the sector.",
      "Drag C and D until the chord passes through O: it becomes a diameter.",
      "Drag T round the circle: the tangent always just touches it.",
    ],
    accent: CIRCLE_ACCENT,
    build: circleParts,
  },
  {
    key: "geo_circle_measure",
    category: "Circle",
    title: "Area & Circumference",
    topic: "Circle",
    summary: "C = 2πr, A = πr², arc length and sector area.",
    facts: [
      "Circumference C = 2πr = πd.",
      "Area A = πr².",
      "π = C ÷ d ≈ 3.14159 for every circle.",
      "Arc length = (θ/360°) × 2πr.",
      "Sector area = (θ/360°) × πr².",
      "In radians: arc = rθ, sector = ½r²θ.",
    ],
    tryThis: [
      "Double r: C doubles, but A becomes 4 times as big.",
      "Drag θ to 180°: the sector is half the circle.",
      "Compare the amber arc with the amber part of the unrolled line.",
    ],
    accent: CIRCLE_ACCENT,
    build: circleMeasures,
  },
  // Circle theorems
  {
    key: "geo_th_centre",
    category: "Circle theorems",
    title: "Angle at the Centre",
    topic: "Circle theorem",
    summary: "The angle at the centre is twice the angle at the circumference.",
    facts: [
      "The angle an arc makes at the centre is twice the angle it makes at any point on the rest of the circle: ∠AOB = 2∠APB.",
    ],
    tryThis: [
      "Drag P anywhere on the big arc: ∠APB never changes.",
      "Drag P onto the small arc: the angle at the centre becomes the reflex one, and it still holds.",
    ],
    accent: THEOREM_ACCENT,
    build: angleAtCentre,
  },
  {
    key: "geo_th_semicircle",
    category: "Circle theorems",
    title: "Angle in a Semicircle",
    topic: "Circle theorem",
    summary: "An angle standing on a diameter is always 90°.",
    facts: [
      "The angle in a semicircle is a right angle: if AB is a diameter, ∠APB = 90°.",
      "It's the angle at the centre theorem with ∠AOB = 180°.",
    ],
    tryThis: ["Drag P round the circle: the right-angle mark stays at P."],
    accent: THEOREM_ACCENT,
    build: angleInSemicircle,
  },
  {
    key: "geo_th_same_segment",
    category: "Circle theorems",
    title: "Angles in the Same Segment",
    topic: "Circle theorem",
    summary: "Angles standing on the same chord, on the same side, are equal.",
    facts: [
      "Angles in the same segment are equal: ∠APB = ∠AQB when P and Q are on the same side of chord AB.",
      "On opposite sides they add up to 180° (a cyclic quadrilateral).",
    ],
    tryThis: ["Drag P and Q around the big arc.", "Drag Q onto the other side of AB and add the two angles."],
    accent: THEOREM_ACCENT,
    build: anglesSameSegment,
  },
  {
    key: "geo_th_cyclic",
    category: "Circle theorems",
    title: "Cyclic Quadrilateral",
    topic: "Circle theorem",
    summary: "Opposite angles of a quadrilateral in a circle add up to 180°.",
    facts: [
      "A cyclic quadrilateral has all four corners on a circle.",
      "Its opposite angles add up to 180°: ∠A + ∠C = ∠B + ∠D = 180°.",
      "An exterior angle equals the interior angle opposite it.",
    ],
    tryThis: ["Drag any corner round the circle: both sums stay at 180°.", "Keep the corners in order (A, B, C, D) round the circle, or the shape crosses itself."],
    accent: THEOREM_ACCENT,
    build: cyclicQuadrilateral,
  },
  {
    key: "geo_th_alternate",
    category: "Circle theorems",
    title: "Alternate Segment",
    topic: "Circle theorem",
    summary: "The tangent–chord angle equals the angle in the other segment.",
    facts: [
      "The angle between a tangent and a chord equals the angle the chord makes in the alternate segment: ∠TAB = ∠ACB.",
    ],
    tryThis: ["Drag C around its arc: ∠ACB stays equal to the tangent–chord angle.", "Drag B to change both together."],
    accent: THEOREM_ACCENT,
    build: alternateSegment,
  },
  {
    key: "geo_th_tangent_radius",
    category: "Circle theorems",
    title: "Tangent ⟂ Radius",
    topic: "Circle theorem",
    summary: "A tangent meets the radius at its point of contact at 90°.",
    facts: [
      "The tangent at a point is perpendicular to the radius drawn to that point.",
      "So the tangent at P is the line through P at right angles to OP.",
    ],
    tryThis: ["Drag P: the right angle moves with it.", "Drag Q towards P and watch the secant turn into the tangent."],
    accent: THEOREM_ACCENT,
    build: tangentRadius,
  },
  {
    key: "geo_th_tangent_lengths",
    category: "Circle theorems",
    title: "Tangents from a Point",
    topic: "Circle theorem",
    summary: "The two tangents from an outside point are the same length.",
    facts: [
      "Tangents drawn from an external point to a circle are equal in length: TA = TB.",
      "OT bisects the angle between them, and each meets its radius at 90°.",
      "Each length is √(OT² − r²), by Pythagoras in triangle OAT.",
    ],
    tryThis: ["Drag T around outside the circle.", "Bring T close to the circle: the tangents shrink to nothing."],
    accent: THEOREM_ACCENT,
    build: tangentLengths,
  },
  {
    key: "geo_th_chord",
    category: "Circle theorems",
    title: "Perpendicular to a Chord",
    topic: "Circle theorem",
    summary: "The perpendicular from the centre bisects the chord.",
    facts: [
      "The perpendicular from the centre to a chord bisects the chord.",
      "And the line from the centre to a chord's midpoint is perpendicular to it.",
      "Equal chords are the same distance from the centre.",
    ],
    tryThis: ["Drag A and B: M stays in the middle and the angle stays 90°."],
    accent: THEOREM_ACCENT,
    build: perpendicularToChord,
  },
  // Conics
  {
    key: "geo_conic_ellipse",
    category: "Conics",
    title: "Ellipse",
    topic: "Conic section",
    summary: "x²/a² + y²/b² = 1: foci, eccentricity, area and perimeter.",
    facts: [
      "x²/a² + y²/b² = 1, with semi-axes a and b.",
      "Foci at (±c, 0) with c² = a² − b² (a ≥ b).",
      "For every point P: PF₁ + PF₂ = 2a.",
      "Eccentricity e = c/a, between 0 (a circle) and 1.",
      "Area = πab. Perimeter has no simple formula: Ramanujan's ≈ π(a + b)(1 + 3h/(10 + √(4 − 3h))), h = (a − b)²/(a + b)².",
      "Latus rectum = 2b²/a. Directrices x = ±a/e.",
    ],
    tryThis: ["Drag P round the ellipse: the green lengths always add to 2a.", "Set b = a: the foci meet at the centre and it's a circle."],
    accent: CONIC_ACCENT,
    build: ellipse,
  },
  {
    key: "geo_conic_parabola",
    category: "Conics",
    title: "Parabola",
    topic: "Conic section",
    summary: "x² = 4ay: focus, directrix and the reflecting property.",
    facts: [
      "x² = 4ay: vertex at the origin, focus (0, a), directrix y = −a.",
      "Every point is the same distance from the focus as from the directrix (e = 1).",
      "Latus rectum = 4a.",
      "Rays parallel to the axis reflect through the focus (dish aerials, torches).",
    ],
    tryThis: ["Drag P: PF and PD stay equal.", "Change a: a bigger a gives a wider parabola."],
    accent: CONIC_ACCENT,
    build: parabola,
  },
  {
    key: "geo_conic_hyperbola",
    category: "Conics",
    title: "Hyperbola",
    topic: "Conic section",
    summary: "x²/a² − y²/b² = 1: two branches, foci and asymptotes.",
    facts: [
      "x²/a² − y²/b² = 1: two branches, vertices (±a, 0).",
      "Foci at (±c, 0) with c² = a² + b².",
      "For every point P: |PF₁ − PF₂| = 2a.",
      "Asymptotes y = ±(b/a)x: the branches get ever closer to them.",
      "Eccentricity e = c/a > 1. Directrices x = ±a²/c.",
    ],
    tryThis: ["Drag P along the branch: the difference stays 2a.", "Set a = b: the asymptotes are at 90° (a rectangular hyperbola)."],
    accent: CONIC_ACCENT,
    build: hyperbola,
  },
  {
    key: "geo_conic_family",
    category: "Conics",
    title: "Conics by Eccentricity",
    topic: "Conic section",
    summary: "One rule, PF = e × PD, gives every conic.",
    facts: [
      "A conic is the set of points whose distance to a focus is e times their distance to a directrix.",
      "e = 0: circle. 0 < e < 1: ellipse. e = 1: parabola. e > 1: hyperbola.",
      "They're the curves you get by slicing a cone at different angles.",
    ],
    tryThis: ["Slide e from 0 to 2 and watch the curve change type.", "Drag P: PF ÷ PD is always e."],
    accent: CONIC_ACCENT,
    build: conicFamily,
  },
  // Triangles
  {
    key: "geo_tri_sum",
    category: "Triangles",
    title: "Angle Sum & Exterior Angle",
    topic: "Triangle",
    summary: "The angles add to 180°; an exterior angle is the sum of the two opposite.",
    facts: [
      "Triangle sum theorem: ∠A + ∠B + ∠C = 180°.",
      "Exterior angle theorem: an exterior angle equals the sum of the two interior angles opposite it.",
      "Why: a line through A parallel to BC makes alternate angles equal to ∠B and ∠C.",
    ],
    tryThis: ["Drag the corners anywhere: the sum stays 180°.", "Make a right angle at C and see the other two add to 90°."],
    accent: TRIANGLE_ACCENT,
    build: angleSum,
  },
  {
    key: "geo_tri_isosceles",
    category: "Triangles",
    title: "Isosceles & Equilateral",
    topic: "Triangle",
    summary: "Equal sides face equal angles.",
    facts: [
      "Isosceles triangle theorem: the angles opposite equal sides are equal (∠B = ∠C when AB = AC).",
      "The converse holds too: equal angles face equal sides.",
      "Equilateral: all sides equal, all angles 60°.",
    ],
    tryThis: ["Drag A up and down: the base angles change together.", "Set the height to the value shown for an equilateral triangle."],
    accent: TRIANGLE_ACCENT,
    build: isosceles,
  },
  {
    key: "geo_tri_pythagoras",
    category: "Triangles",
    title: "Pythagoras' Theorem",
    topic: "Triangle",
    summary: "a² + b² = c², shown with squares on every side.",
    facts: [
      "In a right triangle, the square on the hypotenuse equals the sum of the squares on the other two sides: a² + b² = c².",
      "Converse: if a² + b² = c², the angle opposite c is 90°.",
      "Triples like 3-4-5 and 5-12-13 are whole-number solutions.",
    ],
    tryThis: ["Set a = 3 and b = 4: c comes out as 5.", "Compare the pink area with the blue and green together."],
    accent: TRIANGLE_ACCENT,
    build: pythagoras,
  },
  {
    key: "geo_tri_area",
    category: "Triangles",
    title: "Area of a Triangle",
    topic: "Triangle",
    summary: "½ × base × height, Heron's formula and ½ab·sin C agree.",
    facts: [
      "Area = ½ × base × height (the height is perpendicular to the base).",
      "Heron's formula: Area = √(s(s − a)(s − b)(s − c)), s = (a + b + c)/2.",
      "Area = ½ab·sin C, from two sides and the angle between them.",
    ],
    tryThis: ["Drag A parallel to BC: the height, and so the area, stays the same.", "Drag A past C: the foot of the height leaves the base."],
    accent: TRIANGLE_ACCENT,
    build: triangleArea,
  },
  {
    key: "geo_tri_similar",
    category: "Triangles",
    title: "Similar Triangles",
    topic: "Triangle",
    summary: "Same shape, any size: equal angles, sides in one ratio.",
    facts: [
      "Similar triangles have equal angles and sides in the same ratio k.",
      "AA: two pairs of equal angles are enough.",
      "SSS: all three pairs of sides in the same ratio.",
      "SAS: two pairs of sides in the same ratio, and the angle between them equal.",
      "Areas are in the ratio k².",
    ],
    tryThis: ["Change k: every side ratio follows it, the angles don't change.", "Turn or mirror the copy: it's still similar."],
    accent: TRIANGLE_ACCENT,
    build: () => transformedCopy("gtr_similar", true),
  },
  {
    key: "geo_tri_congruent",
    category: "Triangles",
    title: "Congruent Triangles",
    topic: "Triangle",
    summary: "Same shape and size: moved, turned or flipped.",
    facts: [
      "Congruent triangles match exactly: all sides and all angles equal.",
      "SSS: three pairs of equal sides.",
      "SAS: two pairs of sides and the angle between them.",
      "ASA: two angles and the side between them.",
      "AAS: two angles and a side not between them.",
      "RHS (HL): right angle, equal hypotenuses and one other equal side.",
    ],
    tryThis: ["Drag the corners of ABC: the copy changes with it.", "Mirror it (1): it's still congruent."],
    accent: TRIANGLE_ACCENT,
    build: () => transformedCopy("gtr_congruent", false),
  },
  {
    key: "geo_tri_bpt",
    category: "Triangles",
    title: "Basic Proportionality",
    topic: "Triangle",
    summary: "A line parallel to one side divides the other two in the same ratio.",
    facts: [
      "Basic proportionality (Thales): if DE ∥ BC, then AD/DB = AE/EC.",
      "Converse: if AD/DB = AE/EC, then DE ∥ BC.",
      "Midpoint theorem: joining the midpoints of two sides gives a segment parallel to the third and half as long.",
    ],
    tryThis: ["Drag D along AB.", "Set it to 0.5 for the midpoint theorem."],
    accent: TRIANGLE_ACCENT,
    build: proportionality,
  },
  {
    key: "geo_tri_laws",
    category: "Triangles",
    title: "Sine & Cosine Rules",
    topic: "Triangle",
    summary: "a/sin A = b/sin B = c/sin C = 2R, and c² = a² + b² − 2ab·cos C.",
    facts: [
      "Sine rule: a/sin A = b/sin B = c/sin C = 2R (R: the circumradius).",
      "Cosine rule: c² = a² + b² − 2ab·cos C.",
      "With C = 90° the cosine rule is Pythagoras.",
      "Side a is opposite angle A, and so on.",
    ],
    tryThis: ["Drag the corners: the three ratios stay equal.", "Make ∠C 90°: the −2ab·cos C term vanishes."],
    accent: TRIANGLE_ACCENT,
    build: sineCosine,
  },
  {
    key: "geo_tri_centres",
    category: "Triangles",
    title: "Triangle Centres",
    topic: "Triangle",
    summary: "Centroid, circumcentre, incentre, orthocentre and the Euler line.",
    facts: [
      "Centroid G: where the medians meet; it divides each median 2 : 1.",
      "Circumcentre O: centre of the circle through all three corners (perpendicular bisectors meet).",
      "Incentre I: centre of the circle touching all three sides (angle bisectors meet).",
      "Orthocentre H: where the altitudes meet.",
      "Euler line: O, G and H are always in a line, with GH = 2·OG.",
    ],
    tryThis: ["Drag a corner to make an obtuse triangle: O and H move outside it.", "Make it equilateral: all four centres meet."],
    accent: TRIANGLE_ACCENT,
    build: triangleCentres,
  },
  // Polygons
  {
    key: "geo_poly_rectangle",
    category: "Polygons",
    title: "Rectangle & Square",
    topic: "Quadrilateral",
    summary: "Area, perimeter and diagonals.",
    facts: [
      "Area = w × h. Perimeter = 2(w + h).",
      "Diagonals are equal, √(w² + h²), and bisect each other.",
      "A square (w = h): the diagonals also cross at 90°.",
      "All four angles are 90°.",
    ],
    tryThis: ["Drag the corner.", "Make w = h."],
    accent: POLYGON_ACCENT,
    build: rectangle,
  },
  {
    key: "geo_poly_regular",
    category: "Polygons",
    title: "Regular Polygons",
    topic: "Polygon",
    summary: "Angles, perimeter and area for any number of sides.",
    facts: [
      "Sum of interior angles of any n-gon = (n − 2) × 180°.",
      "Regular n-gon: each interior angle = (n − 2) × 180° ÷ n.",
      "Exterior angles always add to 360°: each is 360° ÷ n.",
      "Area = ½nR²·sin(360°/n), with R from the centre to a corner.",
      "The pink triangle: the centre angle is 360° ÷ n.",
    ],
    tryThis: ["Slide n from 3 to 12.", "Watch the area approach πR² as n grows."],
    accent: POLYGON_ACCENT,
    build: regularPolygon,
  },
  {
    key: "geo_poly_quad",
    category: "Polygons",
    title: "Any Quadrilateral",
    topic: "Quadrilateral",
    summary: "The four angles always add up to 360°.",
    facts: [
      "The angles of any quadrilateral add up to 360°.",
      "A diagonal splits it into two triangles: 2 × 180°.",
      "Parallelogram: opposite sides parallel and equal, opposite angles equal, diagonals bisect each other.",
      "Rhombus: all sides equal, diagonals cross at 90°. Trapezium: one pair of parallel sides.",
    ],
    tryThis: ["Drag a corner inwards to make a dent: the sum is still 360°."],
    accent: POLYGON_ACCENT,
    build: quadrilateral,
  },
];
