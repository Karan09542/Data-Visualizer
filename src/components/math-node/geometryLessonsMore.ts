/**
 * More geometry lessons, built with the same kit as the first ones: lines and
 * angles, coordinate geometry, more triangle and circle theorems, quadrilaterals,
 * vectors, trigonometry and transformations. Also the challenges and step-by-step
 * proofs added to the first lessons.
 *
 * GEOMETRY_LESSONS (at the bottom) is the full list the gallery shows.
 */
import { INK, TEXT, sceneGroup, sceneSlider, type SimulationScene } from "./simulations";
import {
  ANGLES,
  AMBER,
  BLUE,
  CORE_LESSONS,
  GREEN,
  PINK,
  POLYGON_ACCENT,
  THEOREM_ACCENT,
  TRIANGLE_ACCENT,
  VIOLET,
  accent,
  below,
  circleBase,
  circleGroups,
  lessonRows,
  onCircle,
  radiusSlider,
  scene,
  sides,
  stack,
  theoremView,
  triangle,
  triangleView,
  type GeometryLesson,
} from "./geometryLessons";

const LINES_ACCENT = accent("bg-sky-500", "ring-sky-400/60 border-sky-400", "text-sky-600 dark:text-sky-400");
const COORD_ACCENT = accent("bg-teal-500", "ring-teal-400/60 border-teal-400", "text-teal-600 dark:text-teal-400");
const VECTOR_ACCENT = accent("bg-indigo-500", "ring-indigo-400/60 border-indigo-400", "text-indigo-600 dark:text-indigo-400");
const TRIG_ACCENT = accent("bg-rose-500", "ring-rose-400/60 border-rose-400", "text-rose-600 dark:text-rose-400");
const TRANSFORM_ACCENT = accent("bg-lime-500", "ring-lime-400/60 border-lime-400", "text-lime-600 dark:text-lime-400");

type Kit = ReturnType<typeof lessonRows>;
const dashed = { lineStyle: "dashed" as const, outlineWidth: 1.5 };
const dotted = { lineStyle: "dotted" as const, outlineWidth: 1 };

// ─── Lines & angles ───────────────────────────────────────────────────────────

function anglesOnLines(): SimulationScene {
  const r = lessonRows("gl_pair");
  return scene(
    [
      r.helpers(...ANGLES),
      r.point("O = [0, 0]", TEXT, "O"),
      r.free("P", [4, 1], BLUE),
      r.free("Q", [1.5, 3.5], GREEN),
      r.point("P2 = -P", BLUE, "P′"),
      r.point("Q2 = -Q", GREEN, "Q′"),
      r.line("O", "P", BLUE, { outlineWidth: 2 }),
      r.line("O", "Q", GREEN, { outlineWidth: 2 }),
      r.angle("O", "P", "Q", PINK, 0.8),
      r.angle("O", "P2", "Q2", PINK, 0.8),
      r.angle("O", "Q", "P2", AMBER, 1.25),
      stack(r, 0, -4.4, [
        "Vertically opposite: ∠POQ = {{ang(O, P, Q):1}}° = ∠P′OQ′ = {{ang(O, P2, Q2):1}}°",
        "On a straight line: ∠POQ + ∠QOP′ = {{ang(O, P, Q) + ang(O, Q, P2):1}}°",
        "Round the point, all four: {{ang(O, P, Q) + ang(O, Q, P2) + ang(O, P2, Q2) + ang(O, Q2, P):1}}°",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 5] },
  );
}

function parallelLines(): SimulationScene {
  const r = lessonRows("gl_parallel");
  const dir = "[cos(th*pi/180), sin(th*pi/180)]";
  return scene(
    [
      r.helpers(...ANGLES),
      r.path("[t, 0]", BLUE, [-16, 16]),
      r.path("[t, d]", BLUE, [-16, 16]),
      r.handle("P = [x0, 0]", TEXT, "P", ["x0"]),
      r.point(`Q = P + d/sin(th*pi/180)*${dir}`, TEXT, "Q"),
      r.handle(`R = Q + 1.8*${dir}`, AMBER, "R", ["th"]),
      r.line("P", "Q - P", TEXT, { outlineWidth: 2 }),
      r.define("E1 = P + [1, 0]"),
      r.define("E2 = Q + [1, 0]"),
      r.define("W2 = Q - [1, 0]"),
      r.angle("P", "E1", "Q", BLUE, 0.7),
      r.angle("Q", "E2", "R", BLUE, 0.7),
      r.angle("Q", "W2", "P", GREEN, 0.7),
      r.angle("Q", "E2", "P", AMBER, 1.15),
      stack(r, 0, -1.5, [
        "Corresponding (blue, blue): {{ang(P, E1, Q):1}}° = {{ang(Q, E2, R):1}}°",
        "Alternate (blue at P, green at Q): {{ang(P, E1, Q):1}}° = {{ang(Q, W2, P):1}}°",
        "Co-interior (blue at P, amber at Q): {{ang(P, E1, Q):1}}° + {{ang(Q, E2, P):1}}° = {{ang(P, E1, Q) + ang(Q, E2, P):1}}°",
      ]),
    ],
    [
      sceneSlider("th", "Transversal angle (°)", 60, [15, 165, 1], "Drag the amber point to turn it.", "lines"),
      sceneSlider("d", "Gap between the lines", 3, [1, 5, 0.1], "How far apart the parallel lines are.", "lines"),
      sceneSlider("x0", "Where it crosses", 0, [-5, 5, 0.1], "Drag P along the lower line.", "lines"),
    ],
    [sceneGroup("lines", "Lines")],
    { x: [-7, 7], y: [-4.5, 6] },
  );
}

function perpendicularBisector(): SimulationScene {
  const r = lessonRows("gl_bisector");
  return scene(
    [
      r.helpers(...ANGLES),
      r.free("A", [-3, -1], BLUE),
      r.free("B", [3, 0.5], BLUE),
      r.seg("A", "B", BLUE),
      r.point("M = (A + B)/2", TEXT, "M"),
      r.define("across = nrm([-(B - A)[2], (B - A)[1]])"),
      r.line("M", "across", VIOLET, dashed),
      r.right("M", "B", "M + across", VIOLET),
      r.handle("P = M + s*across", PINK, "P", ["s"]),
      r.seg("P", "A", PINK, { outlineWidth: 1.5 }),
      r.seg("P", "B", PINK, { outlineWidth: 1.5 }),
      stack(r, 0, -3.4, [
        "PA = {{len(P, A)}}   PB = {{len(P, B)}}: every point of the bisector is as far from A as from B",
        "AM = MB = {{len(A, M)}}, and the bisector meets AB at {{ang(M, B, M + across):1}}°",
      ]),
    ],
    [sceneSlider("s", "P along the bisector", 2.5, [-5, 5, 0.05], "Drag P up and down the dashed line.", "point")],
    [sceneGroup("point", "Point")],
    { x: [-7, 7], y: [-5, 5.5] },
  );
}

// ─── Coordinates ──────────────────────────────────────────────────────────────

const coordView = { x: [-7, 7] as [number, number], y: [-6, 5] as [number, number] };
const legs = (r: Kit) => [
  r.seg("A", "[B[1], A[2]]", TEXT, dashed),
  r.seg("[B[1], A[2]]", "B", TEXT, dashed),
];

function distanceFormula(): SimulationScene {
  const r = lessonRows("gco_distance");
  return scene(
    [
      r.helpers("len"),
      r.free("A", [-3, -1], BLUE),
      r.free("B", [2, 3], BLUE),
      legs(r),
      r.seg("A", "B", PINK),
      r.text("[(A[1] + B[1])/2, A[2] - 0.45]", "Δx = {{B[1] - A[1]}}", TEXT),
      r.text("[B[1] + 0.8, (A[2] + B[2])/2]", "Δy = {{B[2] - A[2]}}", TEXT),
      stack(r, 0, -3.8, [
        "AB = √((x₂ − x₁)² + (y₂ − y₁)²)",
        "= √(({{B[1] - A[1]}})² + ({{B[2] - A[2]}})²) = √{{(B[1] - A[1])^2 + (B[2] - A[2])^2}} = {{len(A, B)}}",
      ]),
    ],
    [],
    [],
    coordView,
  );
}

function sectionFormula(): SimulationScene {
  const r = lessonRows("gco_section");
  return scene(
    [
      r.helpers("len"),
      r.free("A", [-4, -2], BLUE),
      r.free("B", [4, 2], BLUE),
      r.point("P = (n*A + m*B)/(m + n)", PINK, "P"),
      r.seg("A", "P", GREEN, { outlineWidth: 4 }),
      r.seg("P", "B", AMBER, { outlineWidth: 4 }),
      stack(r, 0, -3.6, [
        "P divides AB in the ratio m : n = {{m:0}} : {{n:0}}",
        "P = ((n·x₁ + m·x₂) ÷ (m + n), (n·y₁ + m·y₂) ÷ (m + n)) = ({{P[1]}}, {{P[2]}})",
        "AP : PB = {{len(A, P)}} : {{len(P, B)}}",
      ]),
    ],
    [
      sceneSlider("m", "m (the AP part)", 2, [1, 6, 1], "How many parts from A to P.", "ratio"),
      sceneSlider("n", "n (the PB part)", 1, [1, 6, 1], "How many parts from P to B.", "ratio"),
    ],
    [sceneGroup("ratio", "Ratio")],
    coordView,
  );
}

function slopeAndLine(): SimulationScene {
  const r = lessonRows("gco_line");
  return scene(
    [
      r.helpers("len", "nrm"),
      r.free("A", [-3, -1], BLUE),
      r.free("B", [2, 2], BLUE),
      r.define("slope = (B[2] - A[2])/(B[1] - A[1])"),
      r.define("icpt = A[2] - slope*A[1]"),
      r.line("A", "B - A", BLUE, { outlineWidth: 2 }),
      legs(r),
      r.text("[(A[1] + B[1])/2, A[2] - 0.45]", "run = {{B[1] - A[1]}}", TEXT),
      r.text("[B[1] + 0.9, (A[2] + B[2])/2]", "rise = {{B[2] - A[2]}}", TEXT),
      r.point("[0, icpt]", AMBER, "(0, c)"),
      stack(r, 0, -3.6, [
        "Slope m = rise ÷ run = {{B[2] - A[2]}} ÷ {{B[1] - A[1]}} = {{slope}}",
        "y-intercept c = {{icpt}} (where it crosses the y-axis)",
        "Equation: y = {{slope}}x + {{icpt}}",
      ]),
    ],
    [],
    [],
    coordView,
  );
}

function parallelPerpendicular(): SimulationScene {
  const r = lessonRows("gco_perp");
  return scene(
    [
      r.helpers(...ANGLES, "foot"),
      r.free("A", [-4, -1], BLUE),
      r.free("B", [2, 1], BLUE),
      r.free("C", [1, 3], PINK),
      r.define("m1 = (B[2] - A[2])/(B[1] - A[1])"),
      r.define("m2 = -1/m1"),
      r.line("A", "B - A", BLUE, { outlineWidth: 2 }),
      r.line("C", "B - A", GREEN, dashed),
      r.line("C", "[-(B - A)[2], (B - A)[1]]", PINK, { outlineWidth: 2 }),
      r.point("F = foot(C, A, B)", PINK, "F"),
      r.right("F", "C", "B", PINK),
      stack(r, 0, -3.6, [
        "Line AB: slope m₁ = {{m1}}",
        "Parallel through C (green): the same slope, {{m1}}",
        "Perpendicular through C (pink): slope m₂ = −1 ÷ m₁ = {{m2}}, and m₁ × m₂ = {{m1*m2}}",
      ]),
    ],
    [],
    [],
    coordView,
  );
}

function areaFromCoordinates(): SimulationScene {
  const r = lessonRows("gco_area");
  const box = "[[min(A[1], B[1], C[1]), min(A[2], B[2], C[2])], [max(A[1], B[1], C[1]), min(A[2], B[2], C[2])], [max(A[1], B[1], C[1]), max(A[2], B[2], C[2])], [min(A[1], B[1], C[1]), max(A[2], B[2], C[2])]]";
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-3, -1], [3, -2], [1, 3], BLUE, false),
      r.define("area = abs(A[1]*(B[2] - C[2]) + B[1]*(C[2] - A[2]) + C[1]*(A[2] - B[2]))/2"),
      r.polygon(box, TEXT, { fillOpacity: 0, lineStyle: "dashed", outlineWidth: 1, showAngles: false }),
      stack(r, 0, -3.4, [
        "Area = ½ |x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|",
        "= ½ |{{A[1]*(B[2] - C[2])}} + {{B[1]*(C[2] - A[2])}} + {{C[1]*(A[2] - B[2])}}| = {{area}}",
      ]),
    ],
    [],
    [],
    coordView,
  );
}

// ─── Triangles: more theorems ─────────────────────────────────────────────────

const sideLabels = (r: Kit) => [
  r.text("(B + C)/2 - 0.45*nrm(A - (B + C)/2)", "a = {{sa}}", BLUE),
  r.text("(C + A)/2 - 0.45*nrm(B - (C + A)/2)", "b = {{sb}}", BLUE),
  r.text("(A + B)/2 - 0.45*nrm(C - (A + B)/2)", "c = {{sc}}", BLUE),
];

function heron(): SimulationScene {
  const r = lessonRows("gtr_heron");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-3, -1.5], [3, -1.5], [0.5, 2.5], BLUE, false),
      sides(r),
      r.define("s = (sa + sb + sc)/2"),
      r.define("heronArea = sqrt(max(0, s*(s - sa)*(s - sb)*(s - sc)))"),
      sideLabels(r),
      stack(r, 0, -3, [
        "s = (a + b + c) ÷ 2 = {{s}}",
        "Area = √(s(s − a)(s − b)(s − c))",
        "= √({{s}} × {{s - sa}} × {{s - sb}} × {{s - sc}}) = {{heronArea}}",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function ceva(): SimulationScene {
  const r = lessonRows("gtr_ceva");
  return scene(
    [
      r.helpers(...ANGLES, "meet"),
      triangle(r, [-1, 3], [-4, -2], [4, -2], BLUE, false),
      r.free("P", [-0.2, 0.2], PINK),
      r.point("D = meet(A, P, B, C)", PINK, "D"),
      r.point("E = meet(B, P, C, A)", PINK, "E"),
      r.point("F = meet(C, P, A, B)", PINK, "F"),
      r.seg("A", "D", PINK, { outlineWidth: 1.5 }),
      r.seg("B", "E", PINK, { outlineWidth: 1.5 }),
      r.seg("C", "F", PINK, { outlineWidth: 1.5 }),
      r.define("cevaProduct = (len(B, D)/len(D, C))*(len(C, E)/len(E, A))*(len(A, F)/len(F, B))"),
      stack(r, 0, -3.2, [
        "BD ÷ DC = {{len(B, D)/len(D, C):3}}   CE ÷ EA = {{len(C, E)/len(E, A):3}}   AF ÷ FB = {{len(A, F)/len(F, B):3}}",
        "Their product = {{cevaProduct:4}}: always 1 when AD, BE and CF meet at one point",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function menelaus(): SimulationScene {
  const r = lessonRows("gtr_menelaus");
  return scene(
    [
      r.helpers(...ANGLES, "meet"),
      triangle(r, [-0.5, 3], [-3, -2], [3, -2], BLUE, false),
      r.line("B", "C - B", TEXT, dotted),
      r.line("C", "A - C", TEXT, dotted),
      r.line("A", "B - A", TEXT, dotted),
      r.free("U", [-5, 2.2], VIOLET),
      r.free("V", [5, -0.6], VIOLET),
      r.line("U", "V - U", VIOLET, { outlineWidth: 2 }),
      r.point("D = meet(U, V, B, C)", PINK, "D"),
      r.point("E = meet(U, V, C, A)", PINK, "E"),
      r.point("F = meet(U, V, A, B)", PINK, "F"),
      r.define("menelausProduct = (len(B, D)/len(D, C))*(len(C, E)/len(E, A))*(len(A, F)/len(F, B))"),
      stack(r, 0, -3.2, [
        "BD ÷ DC = {{len(B, D)/len(D, C):3}}   CE ÷ EA = {{len(C, E)/len(E, A):3}}   AF ÷ FB = {{len(A, F)/len(F, B):3}}",
        "Their product = {{menelausProduct:4}}: 1 for any straight line across the triangle's sides",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function stewart(): SimulationScene {
  const r = lessonRows("gtr_stewart");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-1, 3], [-3.5, -1.5], [3.5, -1.5], BLUE, false),
      sides(r),
      r.handle("D = B + u*(C - B)", PINK, "D", ["u"]),
      r.seg("A", "D", PINK),
      r.define("dd = len(A, D)"),
      r.define("mm = len(B, D)"),
      r.define("nn = len(D, C)"),
      stack(r, 0, -2.8, [
        "Stewart: b²m + c²n = a(d² + mn)   (m = BD = {{mm}}, n = DC = {{nn}}, d = AD = {{dd}})",
        "{{sb^2*mm + sc^2*nn}} = {{sa*(dd^2 + mm*nn)}}",
        "Apollonius, when D is the midpoint: b² + c² = 2(d² + m²): {{sb^2 + sc^2}} and {{2*(dd^2 + mm^2)}}",
      ]),
    ],
    [sceneSlider("u", "D along BC", 0.35, [0.05, 0.95, 0.01], "Drag D along BC.", "cevian")],
    [sceneGroup("cevian", "Cevian")],
    triangleView,
  );
}

// ─── Circle theorems: more ────────────────────────────────────────────────────

function ptolemy(): SimulationScene {
  const r = lessonRows("gt_ptolemy");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.handle("C = on(angC)", PINK, "C", ["angC"]),
      r.handle("D = on(angD)", PINK, "D", ["angD"]),
      r.polygon("[A, B, C, D]", PINK, { showAngles: false }),
      r.seg("A", "C", VIOLET, { outlineWidth: 1.5 }),
      r.seg("B", "D", VIOLET, { outlineWidth: 1.5 }),
      below(r, [
        "Diagonals: AC × BD = {{len(A, C)*len(B, D)}}",
        "Sides: AB × CD + AD × BC = {{len(A, B)*len(C, D) + len(A, D)*len(B, C)}}   (keep A, B, C, D in order)",
      ]),
    ],
    [radiusSlider(), onCircle("angA", "A (°)", 110), onCircle("angB", "B (°)", 200), onCircle("angC", "C (°)", 300), onCircle("angD", "D (°)", 25)],
    circleGroups(),
    theoremView,
  );
}

function intersectingChords(): SimulationScene {
  const r = lessonRows("gt_chords");
  return scene(
    [
      circleBase(r),
      r.helpers("meet"),
      r.handle("A = on(angA)", BLUE, "A", ["angA"]),
      r.handle("B = on(angB)", BLUE, "B", ["angB"]),
      r.handle("C = on(angC)", GREEN, "C", ["angC"]),
      r.handle("D = on(angD)", GREEN, "D", ["angD"]),
      r.seg("A", "B", BLUE),
      r.seg("C", "D", GREEN),
      r.point("P = meet(A, B, C, D)", PINK, "P"),
      below(r, ["PA × PB = {{len(P, A)}} × {{len(P, B)}} = {{len(P, A)*len(P, B)}}", "PC × PD = {{len(P, C)}} × {{len(P, D)}} = {{len(P, C)*len(P, D)}}"]),
    ],
    [radiusSlider(), onCircle("angA", "A (°)", 150), onCircle("angB", "B (°)", 330), onCircle("angC", "C (°)", 60), onCircle("angD", "D (°)", 250)],
    circleGroups(),
    theoremView,
  );
}

function tangentSecant(): SimulationScene {
  const r = lessonRows("gt_power");
  const su = "[cos(phi + pi + alpha*pi/180), sin(phi + pi + alpha*pi/180)]";
  return scene(
    [
      circleBase(r),
      r.handle("T = [tx, ty]", AMBER, "T", ["tx", "ty"]),
      r.define("dT = norm(T)"),
      r.define("beta = dT > r ? acos(r/dT) : NaN"),
      r.define("phi = atan2(ty, tx)"),
      r.point("A = r*[cos(phi + beta), sin(phi + beta)]", PINK, "A"),
      r.define(`su = ${su}`),
      r.define("tu = dot(T, su)"),
      r.define("disc = tu^2 - dot(T, T) + r^2"),
      r.point("B = disc >= 0 ? T + (-tu - sqrt(disc))*su : [NaN, NaN]", GREEN, "B"),
      r.point("C = disc >= 0 ? T + (-tu + sqrt(disc))*su : [NaN, NaN]", GREEN, "C"),
      r.seg("T", "A", PINK),
      r.seg("T", "C", GREEN),
      r.right("A", "O", "T", PINK),
      below(r, [
        "Tangent: TA² = {{dT > r ? len(T, A)^2 : NaN}}",
        "Secant: TB × TC = {{disc >= 0 ? len(T, B)*len(T, C) : NaN}}   (the outside part times the whole)",
      ]),
    ],
    [
      radiusSlider(),
      sceneSlider("tx", "T: x", 6, [-7, 7, 0.05], "Drag T.", "points"),
      sceneSlider("ty", "T: y", 1, [-5, 5, 0.05], "Drag T.", "points"),
      sceneSlider("alpha", "Secant turn (°)", 12, [-25, 25, 0.1], "Turns the secant about T.", "points"),
    ],
    circleGroups(),
    theoremView,
  );
}

// ─── Quadrilaterals ───────────────────────────────────────────────────────────

function parallelogram(): SimulationScene {
  const r = lessonRows("gp_parallelogram");
  const kind =
    '{{abs(len(A, B) - len(A, D)) < 0.02 ? (abs(dot(B - A, D - A)) < 0.05 ? "A square" : "A rhombus: all sides equal") : (abs(dot(B - A, D - A)) < 0.05 ? "A rectangle: all angles 90°" : "A parallelogram")}}';
  return scene(
    [
      r.helpers(...ANGLES),
      r.free("A", [-3, -1.5], BLUE),
      r.free("B", [2, -1.5], BLUE),
      r.free("D", [-1, 2], BLUE),
      r.point("C = B + D - A", BLUE, "C"),
      r.polygon("[A, B, C, D]", BLUE),
      r.seg("A", "C", TEXT, dotted),
      r.seg("B", "D", TEXT, dotted),
      r.point("M = (A + C)/2", PINK, "M"),
      stack(r, 0, -3, [
        "Opposite sides: AB = DC = {{len(A, B)}}   AD = BC = {{len(A, D)}}",
        "Opposite angles: ∠A = ∠C = {{ang(A, B, D):1}}°   ∠B = ∠D = {{ang(B, A, C):1}}°",
        "The diagonals bisect each other at M: AM = MC = {{len(A, M)}}   BM = MD = {{len(B, M)}}",
        kind,
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function trapezium(): SimulationScene {
  const r = lessonRows("gp_trapezium");
  return scene(
    [
      r.helpers("len", "cross2"),
      r.define("Q1 = [-a/2, 0]"),
      r.define("Q2 = [a/2, 0]"),
      r.define("Q3 = [-a/2 + off + b, h]"),
      r.define("Q4 = [-a/2 + off, h]"),
      r.polygon("[Q1, Q2, Q3, Q4]", AMBER, { fillOpacity: 0.15 }),
      r.handle("Q2", AMBER, "", ["a"], { showPoint: true }),
      r.handle("Q3", AMBER, "", ["b", "h"], { showPoint: true }),
      r.seg("Q4", "[Q4[1], 0]", TEXT, dashed),
      r.text("[0, -0.45]", "a = {{a}}", AMBER),
      r.text("[(Q3[1] + Q4[1])/2, h + 0.45]", "b = {{b}}", AMBER),
      r.text("[Q4[1] - 0.6, h/2]", "h = {{h}}", TEXT),
      r.define("trap = (a + b)*h/2"),
      stack(r, 0, -1.6, [
        "Area = ½(a + b) × h = ½({{a}} + {{b}}) × {{h}} = {{trap}}",
        "The average of the two parallel sides, times the distance between them",
      ]),
    ],
    [
      sceneSlider("a", "Bottom side a", 6, [1, 9, 0.1], "Drag the lower right corner.", "shape"),
      sceneSlider("b", "Top side b", 3, [0, 9, 0.1], "Drag the upper right corner.", "shape"),
      sceneSlider("h", "Height h", 3, [0.5, 6, 0.1], "Drag the upper right corner.", "shape"),
      sceneSlider("off", "Slant", 1, [-4, 4, 0.1], "Slides the top side along.", "shape"),
    ],
    [sceneGroup("shape", "Trapezium")],
    { x: [-6, 6], y: [-3.5, 7] },
  );
}

function midpointQuadrilateral(): SimulationScene {
  const r = lessonRows("gp_varignon");
  return scene(
    [
      r.helpers(...ANGLES),
      r.free("A", [-4, -1], BLUE),
      r.free("B", [-1, -3], BLUE),
      r.free("C", [4, -0.5], BLUE),
      r.free("D", [0.5, 3], BLUE),
      r.polygon("[A, B, C, D]", BLUE, { showAngles: false, fillOpacity: 0.06 }),
      r.seg("A", "C", TEXT, dotted),
      r.seg("B", "D", TEXT, dotted),
      r.point("P = (A + B)/2", PINK, "P"),
      r.point("Q = (B + C)/2", PINK, "Q"),
      r.point("R = (C + D)/2", PINK, "R"),
      r.point("S = (D + A)/2", PINK, "S"),
      r.polygon("[P, Q, R, S]", PINK, { fillOpacity: 0.18, showAngles: false }),
      r.define("sarea(W, X, Y, Z) = (cross2(X - W, Y - W) + cross2(Y - W, Z - W))/2"),
      stack(r, 0, -3.8, [
        "The midpoints always make a parallelogram: PQ = SR = {{len(P, Q)}}, QR = PS = {{len(Q, R)}}",
        "PQ is half of AC: {{len(P, Q)}} = ½ × {{len(A, C)}}",
        "Area PQRS = {{abs(sarea(P, Q, R, S))}} = ½ × area ABCD = ½ × {{abs(sarea(A, B, C, D))}}",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6.5, 5] },
  );
}

// ─── Vectors ──────────────────────────────────────────────────────────────────

function addingVectors(): SimulationScene {
  const r = lessonRows("gv_add");
  const beside = (a: string, b: string) => `(${a} + ${b})/2 + 0.45*nrm([-(${b} - ${a})[2], (${b} - ${a})[1]])`;
  return scene(
    [
      r.helpers("len", "nrm"),
      r.free("O", [-3, -2], TEXT),
      r.free("A", [1.5, -1], BLUE),
      r.free("B", [-1.5, 1.5], GREEN),
      r.point("S = A + B - O", PINK, "S"),
      r.arrow("Vector(O, A)", BLUE),
      r.arrow("Vector(O, B)", GREEN),
      r.arrow("Vector(O, S)", PINK),
      r.seg("A", "S", GREEN, dashed),
      r.seg("B", "S", BLUE, dashed),
      r.text(beside("O", "A"), "a", BLUE),
      r.text(beside("B", "O"), "b", GREEN),
      r.text(beside("O", "S"), "a + b", PINK),
      stack(r, 0, -3.6, [
        "a = ⟨{{(A - O)[1]}}, {{(A - O)[2]}}⟩   b = ⟨{{(B - O)[1]}}, {{(B - O)[2]}}⟩",
        "a + b = ⟨{{(S - O)[1]}}, {{(S - O)[2]}}⟩: add the x parts, then the y parts",
        "|a| = {{len(O, A)}}   |b| = {{len(O, B)}}   |a + b| = {{len(O, S)}}",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 5] },
  );
}

function resolvingVectors(): SimulationScene {
  const r = lessonRows("gv_components");
  return scene(
    [
      r.helpers("len"),
      r.point("O = [0, 0]", TEXT, "O"),
      r.handle("P = mag*[cos(th*pi/180), sin(th*pi/180)]", BLUE, "P", ["mag", "th"]),
      r.arrow("Vector(O, P)", BLUE),
      r.arrow("Vector(O, [P[1], 0])", PINK, { outlineWidth: 2.5 }),
      r.arrow("Vector([P[1], 0], P)", GREEN, { outlineWidth: 2.5 }),
      r.path("0.9*[cos(t*th*pi/180), sin(t*th*pi/180)]", AMBER, [0, 1], { outlineWidth: 2 }),
      r.text("[P[1]/2, P[2] >= 0 ? -0.4 : 0.4]", "v₁ (x part)", PINK),
      r.text("[P[1] + (P[1] >= 0 ? 0.45 : -0.45), P[2]/2]", "v₂ (y part)", GREEN),
      stack(r, 0, -4.4, [
        "|v| = {{mag}}   θ = {{th:0}}°",
        "v₁ = |v| cos θ = {{P[1]}}   v₂ = |v| sin θ = {{P[2]}}",
        "And back: |v| = √(v₁² + v₂²) = {{sqrt(P[1]^2 + P[2]^2)}}",
      ]),
    ],
    [
      sceneSlider("mag", "Length |v|", 4, [0.5, 6, 0.05], "Drag P.", "vector"),
      sceneSlider("th", "Direction θ (°)", 35, [0, 360, 1], "Drag P round.", "vector"),
    ],
    [sceneGroup("vector", "Vector")],
    { x: [-7, 7], y: [-6.5, 6] },
  );
}

function dotProduct(): SimulationScene {
  const r = lessonRows("gv_dot");
  const status =
    '{{abs(dot(A, B)) < 0.05 ? "Perpendicular: a · b = 0" : (dot(A, B) > 0 ? "Less than 90° apart: a · b is positive" : "More than 90° apart: a · b is negative")}}';
  return scene(
    [
      r.helpers(...ANGLES),
      r.point("O = [0, 0]", TEXT, "O"),
      r.free("A", [4, 1], BLUE),
      r.free("B", [1.5, 3], GREEN),
      r.arrow("Vector(O, A)", BLUE),
      r.arrow("Vector(O, B)", GREEN),
      r.angle("O", "A", "B", AMBER, 0.9),
      stack(r, 0, -3.6, [
        "a · b = a₁b₁ + a₂b₂ = {{A[1]}}×{{B[1]}} + {{A[2]}}×{{B[2]}} = {{dot(A, B)}}",
        "= |a||b| cos θ = {{norm(A)}} × {{norm(B)}} × cos {{ang(O, A, B):1}}° = {{norm(A)*norm(B)*cos(ang(O, A, B)*pi/180)}}",
        status,
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 5] },
  );
}

// ─── Trigonometry ─────────────────────────────────────────────────────────────

function unitCircle(): SimulationScene {
  const r = lessonRows("gtg_unit");
  return scene(
    [
      r.point("O = [0, 0]", TEXT),
      r.path("[cos(t), sin(t)]", TEXT, [0, 2 * Math.PI], { outlineWidth: 2 }),
      r.handle("P = [cos(th*pi/180), sin(th*pi/180)]", PINK, "P", ["th"]),
      r.seg("O", "P", TEXT, { outlineWidth: 2 }),
      r.seg("[0, 0]", "[P[1], 0]", BLUE, { outlineWidth: 4 }),
      r.seg("[P[1], 0]", "P", PINK, { outlineWidth: 4 }),
      r.path("0.25*[cos(t*th*pi/180), sin(t*th*pi/180)]", AMBER, [0, 1], { outlineWidth: 2 }),
      r.text("[P[1]/2, P[2] >= 0 ? -0.15 : 0.15]", "cos θ", BLUE),
      r.text("[P[1] + (P[1] >= 0 ? 0.3 : -0.3), P[2]/2]", "sin θ", PINK),
      stack(
        r,
        0,
        -1.35,
        [
          "θ = {{th:0}}°   P = (cos θ, sin θ) = ({{P[1]:3}}, {{P[2]:3}})",
          "tan θ = sin θ ÷ cos θ = {{P[2]/P[1]:3}}",
          "sin²θ + cos²θ = {{P[1]^2 + P[2]^2:3}}",
        ],
        TEXT,
        0.24,
      ),
    ],
    [sceneSlider("th", "Angle θ (°)", 35, [0, 360, 1], "Drag P round the circle.", "angle")],
    [sceneGroup("angle", "Angle")],
    { x: [-2.4, 2.4], y: [-2.2, 1.5] },
  );
}

function sineWave(): SimulationScene {
  const r = lessonRows("gtg_wave");
  const c = "[-2.2, 0]";
  return scene(
    [
      r.path(`${c} + [cos(t), sin(t)]`, TEXT, [0, 2 * Math.PI], { outlineWidth: 2 }),
      r.handle(`P = ${c} + [cos(th*pi/180), sin(th*pi/180)]`, PINK, "P", ["th"]),
      r.seg(c, "P", TEXT),
      r.path("[t, sin(t)]", INK, [0, 2 * Math.PI], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.path("[t*th*pi/180, sin(t*th*pi/180)]", PINK, [0, 1], { outlineWidth: 3 }),
      r.point("W = [th*pi/180, sin(th*pi/180)]", PINK),
      r.seg("P", "W", AMBER, dashed),
      r.text("[pi/2, -1.3]", "90°", TEXT),
      r.text("[pi, -1.3]", "180°", TEXT),
      r.text("[3*pi/2, -1.3]", "270°", TEXT),
      r.text("[2*pi, -1.3]", "360°", TEXT),
      stack(
        r,
        2,
        -1.85,
        [
          "θ = {{th:0}}° = {{th*pi/180:3}} rad   sin θ = {{sin(th*pi/180):3}}",
          "The point's height on the circle is the height of the wave",
        ],
        TEXT,
        0.32,
      ),
    ],
    [sceneSlider("th", "Angle θ (°)", 60, [0, 360, 1], "Drag P round the circle and watch the wave grow.", "angle")],
    [sceneGroup("angle", "Angle")],
    { x: [-3.6, 7], y: [-2.6, 1.8] },
  );
}

function trigRatios(): SimulationScene {
  const r = lessonRows("gtg_ratios");
  return scene(
    [
      r.helpers("len", "nrm"),
      r.point("A = [-3, -2]", BLUE, "A"),
      r.point("B = A + [hyp*cos(th*pi/180), 0]", BLUE, "B"),
      r.handle("C = B + [0, hyp*sin(th*pi/180)]", BLUE, "C", ["hyp", "th"]),
      r.polygon("[A, B, C]", BLUE),
      r.text("(A + C)/2 + 0.45*nrm([-(C - A)[2], (C - A)[1]])", "hypotenuse {{hyp}}", PINK),
      r.text("(A + B)/2 - [0, 0.45]", "adjacent {{len(A, B)}}", GREEN),
      r.text("(B + C)/2 + [1.1, 0]", "opposite {{len(B, C)}}", AMBER),
      stack(r, 0, -3.3, [
        "sin θ = opposite ÷ hypotenuse = {{len(B, C)/len(A, C):3}}",
        "cos θ = adjacent ÷ hypotenuse = {{len(A, B)/len(A, C):3}}",
        "tan θ = opposite ÷ adjacent = {{len(B, C)/len(A, B):3}}   (the same for any size)",
      ]),
    ],
    [
      sceneSlider("th", "Angle θ (°)", 35, [5, 85, 1], "Drag C.", "triangle"),
      sceneSlider("hyp", "Hypotenuse", 5, [1, 7, 0.1], "Drag C: the ratios don't change.", "triangle"),
    ],
    [sceneGroup("triangle", "Triangle")],
    { x: [-5, 6], y: [-6, 4.5] },
  );
}

// ─── Transformations ──────────────────────────────────────────────────────────

const image = (r: Kit, f: string, color = PINK) => [
  r.point(`A2 = ${f}(A)`, color, "A′"),
  r.point(`B2 = ${f}(B)`, color, "B′"),
  r.point(`C2 = ${f}(C)`, color, "C′"),
  r.polygon("[A2, B2, C2]", color, { showAngles: false, fillOpacity: 0.18 }),
];

function reflection(): SimulationScene {
  const r = lessonRows("gtf_reflect");
  return scene(
    [
      r.helpers(...ANGLES, "refl"),
      triangle(r, [-4, 1], [-2, -1], [-1.5, 2.5], BLUE, false),
      r.free("U", [1, -3], VIOLET),
      r.free("V", [0.5, 3], VIOLET),
      r.line("U", "V - U", VIOLET, { outlineWidth: 2 }),
      r.define("mirror(P) = refl(P, U, V)"),
      image(r, "mirror"),
      r.seg("A", "A2", TEXT, dotted),
      r.seg("B", "B2", TEXT, dotted),
      r.seg("C", "C2", TEXT, dotted),
      stack(r, 0, -3.6, [
        "Each point and its image: the same distance from the mirror, on a line at right angles to it",
        "Lengths don't change: A′B′ = {{len(A2, B2)}} = AB = {{len(A, B)}}",
        '{{cross2(B - A, C - A) > 0 ? "ABC runs anticlockwise, A′B′C′ clockwise: flipped over" : "ABC runs clockwise, A′B′C′ anticlockwise: flipped over"}}',
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 5] },
  );
}

function rotation(): SimulationScene {
  const r = lessonRows("gtf_rotate");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [1, 1], [3, 0.5], [2, 3], BLUE, false),
      r.free("O", [-1, -1], TEXT),
      r.define("turnAbout(P) = O + [[cos(q*pi/180), -sin(q*pi/180)], [sin(q*pi/180), cos(q*pi/180)]]*(P - O)"),
      image(r, "turnAbout"),
      r.path("O + len(O, A)*[cos(dir(O, A) + t*q*pi/180), sin(dir(O, A) + t*q*pi/180)]", AMBER, [0, 1], dashed),
      r.seg("O", "A", TEXT, dotted),
      r.seg("O", "A2", TEXT, dotted),
      stack(r, 0, -3.6, [
        "Turned {{q:0}}° about O (anticlockwise when positive)",
        "OA = OA′ = {{len(O, A)}}: every point keeps its distance from O",
        "∠AOA′ = {{ang(O, A, A2):1}}°: every point turns through the same angle",
      ]),
    ],
    [sceneSlider("q", "Turn (°)", 90, [-180, 180, 1], "Positive turns anticlockwise.", "turn")],
    [sceneGroup("turn", "Rotation")],
    { x: [-7, 7], y: [-6, 5] },
  );
}

function enlargement(): SimulationScene {
  const r = lessonRows("gtf_enlarge");
  const kind =
    '{{k < 0 ? "Negative k: on the other side of O, upside down" : (abs(k) < 1 ? "Between 0 and 1: smaller" : "Bigger than 1: larger")}}';
  return scene(
    [
      r.helpers("len", "nrm"),
      triangle(r, [1, 1], [2.5, 0.5], [1.8, 2.2], BLUE, false),
      r.free("O", [-2, -1], TEXT),
      r.define("scaleAbout(P) = O + k*(P - O)"),
      image(r, "scaleAbout"),
      r.line("O", "A - O", TEXT, dotted),
      r.line("O", "B - O", TEXT, dotted),
      r.line("O", "C - O", TEXT, dotted),
      stack(r, 0, -3.6, [
        "Scale factor k = {{k}}: OA′ = |k| × OA ({{len(O, A2)}} = {{abs(k)}} × {{len(O, A)}})",
        "Lengths × |k|: A′B′ = {{len(A2, B2)}}   Area × k² = × {{k^2}}",
        kind,
      ]),
    ],
    [sceneSlider("k", "Scale factor k", 2, [-3, 3, 0.05], "Negative k turns the image upside down.", "scale")],
    [sceneGroup("scale", "Enlargement")],
    { x: [-7, 8], y: [-6, 6] },
  );
}

// ─── The new lessons ──────────────────────────────────────────────────────────

const MORE_LESSONS: GeometryLesson[] = [
  {
    key: "geo_lines_pair",
    category: "Lines & angles",
    title: "Angles at a Crossing",
    topic: "Lines & angles",
    summary: "Vertically opposite angles, angles on a line, angles round a point.",
    facts: [
      "Vertically opposite angles are equal.",
      "Angles on a straight line add up to 180° (a linear pair).",
      "Angles round a point add up to 360°.",
    ],
    tryThis: ["Drag P and Q: the pink angles stay equal.", "Watch the line sum stay at 180° and the full turn at 360°."],
    challenges: [
      { text: "Make the lines perpendicular: all four angles 90°", check: "abs(ang(O, P, Q) - 90) < 0.5" },
      { text: "Make ∠POQ exactly 30°", check: "abs(ang(O, P, Q) - 30) < 0.5" },
    ],
    proof: [
      "∠POQ and ∠QOP′ sit on the straight line POP′, so they add to 180°.",
      "∠QOP′ and ∠P′OQ′ sit on the straight line QOQ′, so they also add to 180°.",
      "Both ∠POQ and ∠P′OQ′ equal 180° − ∠QOP′, so they are equal.",
    ],
    accent: LINES_ACCENT,
    build: anglesOnLines,
  },
  {
    key: "geo_lines_parallel",
    category: "Lines & angles",
    title: "Parallel Lines & a Transversal",
    topic: "Lines & angles",
    summary: "Corresponding and alternate angles are equal; co-interior angles make 180°.",
    facts: [
      "A transversal is a line crossing two (or more) lines.",
      "With parallel lines, corresponding angles are equal (an F shape).",
      "Alternate angles are equal (a Z shape).",
      "Co-interior angles add up to 180° (a C shape).",
    ],
    tryThis: ["Drag the amber point to turn the transversal.", "Change the gap: none of the angles change."],
    challenges: [
      { text: "Make the transversal perpendicular: every angle 90°", check: "abs(th - 90) < 0.5" },
      { text: "Make the alternate angles 50°", check: "abs(ang(P, E1, Q) - 50) < 0.5" },
    ],
    proof: [
      "Slide the lower line up along the transversal until it lies on the upper one: the angle at P lands on the angle at Q. So corresponding angles are equal.",
      "At Q, the corresponding angle and the alternate angle are vertically opposite, so the alternate angles are equal too.",
      "The alternate angle and the co-interior angle at Q lie on a straight line, so co-interior angles add to 180°.",
    ],
    accent: LINES_ACCENT,
    build: parallelLines,
  },
  {
    key: "geo_lines_bisector",
    category: "Lines & angles",
    title: "Perpendicular Bisector",
    topic: "Lines & angles",
    summary: "Every point on it is the same distance from both ends.",
    facts: [
      "The perpendicular bisector of AB passes through its midpoint M at 90°.",
      "Every point on it is equidistant from A and B, and every such point lies on it (it is a locus).",
      "So the centre of any circle through A and B lies on it.",
    ],
    tryThis: ["Drag P along the dashed line: PA and PB stay equal.", "Drag A or B: the bisector follows."],
    challenges: [{ text: "Make triangle PAB equilateral", check: "abs(len(P, A) - len(A, B)) < 0.03" }],
    proof: [
      "Triangles PMA and PMB share PM, have MA = MB, and both have a right angle at M.",
      "So they are congruent (SAS), and PA = PB.",
    ],
    accent: LINES_ACCENT,
    build: perpendicularBisector,
  },
  {
    key: "geo_coord_distance",
    category: "Coordinates",
    title: "Distance Between Points",
    topic: "Coordinate geometry",
    summary: "AB = √((x₂ − x₁)² + (y₂ − y₁)²): Pythagoras on the grid.",
    facts: ["Distance AB = √((x₂ − x₁)² + (y₂ − y₁)²).", "It is Pythagoras on the right triangle with legs Δx and Δy."],
    tryThis: ["Drag A and B.", "Make a 3-4-5 triangle on the grid lines."],
    challenges: [
      {
        text: "Make AB exactly 5 with A and B not level (a 3-4-5 triangle)",
        check: "abs(len(A, B) - 5) < 0.02 and abs(B[2] - A[2]) > 0.5 and abs(B[1] - A[1]) > 0.5",
      },
      { text: "Put B level with A: then AB is just Δx", check: "abs(B[2] - A[2]) < 0.01" },
    ],
    proof: ["Go across from A, then up to B: a right triangle with legs Δx and Δy.", "Pythagoras: AB² = Δx² + Δy².", "So AB = √(Δx² + Δy²)."],
    accent: COORD_ACCENT,
    build: distanceFormula,
  },
  {
    key: "geo_coord_section",
    category: "Coordinates",
    title: "Midpoint & Section Formula",
    topic: "Coordinate geometry",
    summary: "The point dividing AB in a ratio m : n.",
    facts: [
      "P dividing AB in m : n is ((n·x₁ + m·x₂)/(m + n), (n·y₁ + m·y₂)/(m + n)).",
      "The midpoint (m = n) is the average: ((x₁ + x₂)/2, (y₁ + y₂)/2).",
    ],
    tryThis: ["Change m and n.", "Set them equal for the midpoint."],
    challenges: [
      { text: "Find the midpoint (m = n)", check: "m == n" },
      { text: "Put P a quarter of the way from A to B", check: "abs(m/(m + n) - 0.25) < 1e-9" },
    ],
    accent: COORD_ACCENT,
    build: sectionFormula,
  },
  {
    key: "geo_coord_line",
    category: "Coordinates",
    title: "Slope & y = mx + c",
    topic: "Coordinate geometry",
    summary: "Slope as rise over run, and the line's equation.",
    facts: [
      "Slope m = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁).",
      "y = mx + c, where c is where the line crosses the y-axis.",
      "Positive slope goes uphill, negative downhill; a horizontal line has slope 0, a vertical one none.",
    ],
    tryThis: ["Drag A and B and watch m and c.", "Make the line horizontal."],
    challenges: [
      { text: "Make a line going downhill with slope −½", check: "abs(slope + 0.5) < 0.02" },
      { text: "Make it pass through the origin (c = 0)", check: "abs(icpt) < 0.02" },
    ],
    accent: COORD_ACCENT,
    build: slopeAndLine,
  },
  {
    key: "geo_coord_perp",
    category: "Coordinates",
    title: "Parallel & Perpendicular Lines",
    topic: "Coordinate geometry",
    summary: "Parallel lines share a slope; perpendicular slopes multiply to −1.",
    facts: ["Parallel lines have equal slopes.", "Perpendicular lines have slopes m₁ and m₂ with m₁ × m₂ = −1 (so m₂ = −1/m₁)."],
    tryThis: ["Drag A, B and C.", "Make AB horizontal: the perpendicular becomes vertical."],
    challenges: [
      {
        text: "Make the perpendicular through C pass through the origin",
        check: "abs(cross2(nrm([-(B - A)[2], (B - A)[1]]), -C)) < 0.03",
      },
      { text: "Make line AB horizontal", check: "abs(m1) < 0.01" },
    ],
    accent: COORD_ACCENT,
    build: parallelPerpendicular,
  },
  {
    key: "geo_coord_area",
    category: "Coordinates",
    title: "Area from Coordinates",
    topic: "Coordinate geometry",
    summary: "A triangle's area straight from its corners' coordinates.",
    facts: ["Area = ½ |x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|.", "Area 0 means the three points lie on one line."],
    tryThis: ["Drag the corners.", "Line them up and watch the area go to 0."],
    challenges: [
      { text: "Make the area exactly 6", check: "abs(area - 6) < 0.05" },
      { text: "Make the area 0: put the three points in a line", check: "area < 0.02" },
    ],
    proof: [
      "Draw the rectangle round the triangle (dashed).",
      "Take away the three right triangles at its corners: what's left is our triangle.",
      "Writing those areas in coordinates and simplifying gives ½|x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|.",
    ],
    accent: COORD_ACCENT,
    build: areaFromCoordinates,
  },
  {
    key: "geo_tri_heron",
    category: "Triangles",
    title: "Heron's Formula",
    topic: "Triangle",
    summary: "A triangle's area from its three sides alone.",
    facts: ["s = (a + b + c) ÷ 2, the semi-perimeter.", "Area = √(s(s − a)(s − b)(s − c)).", "No height needed: just the three sides."],
    tryThis: ["Drag the corners.", "Flatten the triangle: one bracket reaches 0."],
    challenges: [
      { text: "Make a 3-4-5 right triangle: its area is 6", check: "abs(heronArea - 6) < 0.05 and abs(max(sa, sb, sc) - 5) < 0.05" },
      { text: "Make an equilateral triangle with sides 4", check: "abs(sa - 4) < 0.05 and abs(sb - 4) < 0.05 and abs(sc - 4) < 0.05" },
    ],
    accent: TRIANGLE_ACCENT,
    build: heron,
  },
  {
    key: "geo_tri_ceva",
    category: "Triangles",
    title: "Ceva's Theorem",
    topic: "Triangle",
    summary: "Three lines from the corners meet at one point exactly when a product of ratios is 1.",
    facts: [
      "Lines AD, BE and CF (cevians) meet at one point if and only if (BD/DC)·(CE/EA)·(AF/FB) = 1.",
      "Medians (all ratios 1), angle bisectors and altitudes all meet: each satisfies Ceva.",
    ],
    tryThis: ["Drag P: the three ratios change, their product doesn't.", "Put P at the centroid."],
    challenges: [{ text: "Put P where every ratio is 1 (the centroid)", check: "abs(len(B, D)/len(D, C) - 1) < 0.02 and abs(len(C, E)/len(E, A) - 1) < 0.02" }],
    proof: [
      "Triangles ABD and ACD have the same height from A, so BD ÷ DC = area(ABD) ÷ area(ACD).",
      "The same holds for ABP and ACP, so BD ÷ DC = area(ABP) ÷ area(ACP).",
      "Likewise CE ÷ EA = area(BCP) ÷ area(BAP) and AF ÷ FB = area(CAP) ÷ area(CBP).",
      "Multiplying the three, every area cancels: the product is 1.",
    ],
    accent: TRIANGLE_ACCENT,
    build: ceva,
  },
  {
    key: "geo_tri_menelaus",
    category: "Triangles",
    title: "Menelaus' Theorem",
    topic: "Triangle",
    summary: "A straight line across a triangle's sides: the ratios multiply to 1.",
    facts: [
      "A line meeting BC, CA and AB (or their extensions) at D, E, F gives (BD/DC)·(CE/EA)·(AF/FB) = 1.",
      "With signs (direction along each side) the product is −1; here the lengths are used.",
      "It is the test for three points being in a straight line.",
    ],
    tryThis: ["Drag U and V to move the line.", "Let it cross a side's extension, outside the triangle."],
    challenges: [{ text: "Make the line cross AB at its midpoint", check: "abs(len(A, F) - len(F, B)) < 0.03" }],
    accent: TRIANGLE_ACCENT,
    build: menelaus,
  },
  {
    key: "geo_tri_stewart",
    category: "Triangles",
    title: "Stewart's & Apollonius'",
    topic: "Triangle",
    summary: "The length of a line from a corner to the opposite side.",
    facts: [
      "Stewart: for D on BC with BD = m, DC = n, AD = d: b²m + c²n = a(d² + mn).",
      "Apollonius (D the midpoint): b² + c² = 2(d² + m²), so a median's length is fixed by the sides.",
    ],
    tryThis: ["Drag D along BC.", "Put D in the middle for Apollonius."],
    challenges: [{ text: "Make D the midpoint: Apollonius' theorem", check: "abs(u - 0.5) < 0.005" }],
    accent: TRIANGLE_ACCENT,
    build: stewart,
  },
  {
    key: "geo_th_ptolemy",
    category: "Circle theorems",
    title: "Ptolemy's Theorem",
    topic: "Circle theorem",
    summary: "In a cyclic quadrilateral, the diagonals' product equals the sum of opposite sides' products.",
    facts: ["For ABCD on a circle: AC × BD = AB × CD + AD × BC.", "For a rectangle it becomes Pythagoras."],
    tryThis: ["Drag the corners round (keep them in order).", "Make a rectangle."],
    challenges: [{ text: "Make ABCD a rectangle: Ptolemy becomes Pythagoras", check: "abs(ang(A, B, D) - 90) < 0.5 and abs(ang(B, A, C) - 90) < 0.5" }],
    proof: [
      "Choose E on BD so that ∠BAE = ∠CAD.",
      "Triangles ABE and ACD are similar (∠ABE = ∠ACD, same segment), so AB·CD = AC·BE.",
      "Triangles ADE and ACB are similar too, so AD·BC = AC·DE.",
      "Adding: AB·CD + AD·BC = AC·(BE + DE) = AC·BD.",
    ],
    accent: THEOREM_ACCENT,
    build: ptolemy,
  },
  {
    key: "geo_th_chords",
    category: "Circle theorems",
    title: "Intersecting Chords",
    topic: "Circle theorem",
    summary: "Where two chords cross, the products of their parts are equal.",
    facts: ["If chords AB and CD meet at P: PA × PB = PC × PD.", "Through the centre, both equal r² (the products are 'the power of P')."],
    tryThis: ["Drag the four ends round the circle.", "Make the chords cross at the centre."],
    challenges: [{ text: "Make the chords cross at the centre", check: "len(P, O) < 0.05" }],
    proof: [
      "∠APC = ∠DPB (vertically opposite).",
      "∠PAC = ∠PDB (angles in the same segment, standing on arc BC).",
      "So triangles PAC and PDB are similar, and PA ÷ PD = PC ÷ PB.",
      "Cross-multiplying: PA × PB = PC × PD.",
    ],
    accent: THEOREM_ACCENT,
    build: intersectingChords,
  },
  {
    key: "geo_th_power",
    category: "Circle theorems",
    title: "Tangent & Secant",
    topic: "Circle theorem",
    summary: "The tangent squared equals the outside part times the whole secant.",
    facts: ["From an outside point T: TA² = TB × TC, where TA is a tangent and TBC a secant.", "It is the intersecting-chords result with P outside the circle."],
    tryThis: ["Drag T.", "Turn the secant: TB × TC stays equal to TA²."],
    challenges: [{ text: "Turn the secant until B and C almost meet: it becomes the tangent (TB ≈ TC ≈ TA)", check: "disc >= 0 and abs(len(T, B) - len(T, C)) < 0.6" }],
    accent: THEOREM_ACCENT,
    build: tangentSecant,
  },
  {
    key: "geo_poly_parallelogram",
    category: "Polygons",
    title: "Parallelogram Family",
    topic: "Quadrilateral",
    summary: "Parallelograms, rhombuses, rectangles and squares, and what they share.",
    facts: [
      "Parallelogram: opposite sides parallel and equal, opposite angles equal, diagonals bisect each other.",
      "Rhombus: also all four sides equal (its diagonals cross at 90°).",
      "Rectangle: also all angles 90° (its diagonals are equal).",
      "Square: both.",
    ],
    tryThis: ["Drag A, B and D (C follows).", "Turn it into a rhombus, then a rectangle, then a square."],
    challenges: [
      { text: "Make it a rhombus", check: "abs(len(A, B) - len(A, D)) < 0.02" },
      { text: "Make it a rectangle", check: "abs(ang(A, B, D) - 90) < 0.5" },
      { text: "Make it a square", check: "abs(len(A, B) - len(A, D)) < 0.02 and abs(ang(A, B, D) - 90) < 0.5" },
    ],
    accent: POLYGON_ACCENT,
    build: parallelogram,
  },
  {
    key: "geo_poly_trapezium",
    category: "Polygons",
    title: "Trapezium Area",
    topic: "Quadrilateral",
    summary: "½(a + b)·h: the average of the parallel sides times the height.",
    facts: ["A trapezium has one pair of parallel sides, a and b.", "Area = ½(a + b) × h, h being the distance between them."],
    tryThis: ["Drag the corners and the slant: only a, b and h matter."],
    challenges: [
      { text: "Make it a parallelogram (b = a)", check: "abs(a - b) < 0.05" },
      { text: "Shrink the top to nothing: a triangle, area ½ah", check: "b < 0.05" },
    ],
    proof: [
      "Cut along the diagonal: two triangles with the same height h.",
      "One has base a, the other base b: areas ½ah and ½bh.",
      "Together: ½(a + b)h.",
    ],
    accent: POLYGON_ACCENT,
    build: trapezium,
  },
  {
    key: "geo_poly_varignon",
    category: "Polygons",
    title: "Midpoint Quadrilateral",
    topic: "Quadrilateral",
    summary: "Join the midpoints of any quadrilateral: always a parallelogram, half the area.",
    facts: ["The midpoints of any quadrilateral's sides form a parallelogram (Varignon's theorem).", "Its sides are half the diagonals, and its area is half the quadrilateral's."],
    tryThis: ["Drag the four corners anywhere, even into a dent."],
    challenges: [{ text: "Make the inner shape a rectangle", check: "abs(dot(Q - P, S - P)) < 0.03" }],
    proof: [
      "In triangle ABC, PQ joins the midpoints of AB and BC, so PQ ∥ AC and PQ = ½AC (midpoint theorem).",
      "In triangle ACD, SR is parallel to AC and half of it too.",
      "So PQ and SR are equal and parallel: PQRS is a parallelogram.",
    ],
    accent: POLYGON_ACCENT,
    build: midpointQuadrilateral,
  },
  {
    key: "geo_vec_add",
    category: "Vectors",
    title: "Adding Vectors",
    topic: "Vectors",
    summary: "Tip to tail, or the parallelogram's diagonal.",
    facts: [
      "Triangle law: put b's tail at a's tip; a + b goes from a's tail to b's tip.",
      "Parallelogram law: from a common start, a + b is the diagonal.",
      "In components: add the x parts and the y parts.",
    ],
    tryThis: ["Drag the tips A and B, and the start O.", "Point a and b the same way, then opposite ways."],
    challenges: [
      { text: "Make |a + b| = |a| + |b|", check: "abs(len(O, S) - len(O, A) - len(O, B)) < 0.03" },
      { text: "Make a + b = 0", check: "len(O, S) < 0.05" },
    ],
    accent: VECTOR_ACCENT,
    build: addingVectors,
  },
  {
    key: "geo_vec_components",
    category: "Vectors",
    title: "Resolving into Components",
    topic: "Vectors",
    summary: "v₁ = |v| cos θ (x part) and v₂ = |v| sin θ (y part).",
    facts: ["A vector of length |v| at angle θ has an x part v₁ = |v| cos θ and a y part v₂ = |v| sin θ.", "And back again: |v| = √(v₁² + v₂²), tan θ = v₂ ÷ v₁."],
    tryThis: ["Drag P: watch the pink and green parts.", "Point it into each quadrant: the signs change."],
    challenges: [
      { text: "Make the x and y parts equal (and positive)", check: "abs(P[1] - P[2]) < 0.02 and P[1] > 0" },
      { text: "Point it straight down", check: "abs(P[1]) < 0.02 and P[2] < 0" },
    ],
    accent: VECTOR_ACCENT,
    build: resolvingVectors,
  },
  {
    key: "geo_vec_dot",
    category: "Vectors",
    title: "Dot Product & Angle",
    topic: "Vectors",
    summary: "a · b = a₁b₁ + a₂b₂ = |a||b| cos θ.",
    facts: [
      "For a = (a₁, a₂) and b = (b₁, b₂): a · b = a₁b₁ + a₂b₂, and also = |a||b| cos θ.",
      "So cos θ = (a · b) ÷ (|a||b|): the angle between two vectors.",
      "a · b = 0 exactly when they are perpendicular.",
    ],
    tryThis: ["Drag the tips.", "Make them perpendicular, then more than 90° apart."],
    challenges: [
      { text: "Make a · b = 0", check: "abs(dot(A, B)) < 0.05" },
      { text: "Make a · b negative", check: "dot(A, B) < -0.5" },
    ],
    accent: VECTOR_ACCENT,
    build: dotProduct,
  },
  {
    key: "geo_trig_unit",
    category: "Trigonometry",
    title: "The Unit Circle",
    topic: "Trigonometry",
    summary: "cos θ and sin θ as the coordinates of a point going round a circle.",
    facts: [
      "On a circle of radius 1, the point at angle θ is (cos θ, sin θ).",
      "tan θ = sin θ ÷ cos θ.",
      "sin²θ + cos²θ = 1 (Pythagoras).",
      "Signs by quadrant: all positive, then sin, then tan, then cos (All Students Take Coffee).",
    ],
    tryThis: ["Drag P round.", "Watch where cos θ and sin θ turn negative."],
    challenges: [
      { text: "Find an angle where sin θ = cos θ", check: "abs(P[1] - P[2]) < 0.01" },
      { text: "Make sin θ = ½", check: "abs(P[2] - 0.5) < 0.01" },
      { text: "Find where cos θ = −½", check: "abs(P[1] + 0.5) < 0.01" },
    ],
    accent: TRIG_ACCENT,
    build: unitCircle,
  },
  {
    key: "geo_trig_wave",
    category: "Trigonometry",
    title: "Sine Wave from a Circle",
    topic: "Trigonometry",
    summary: "The height of a point going round a circle traces the sine graph.",
    facts: ["y = sin θ is the height of the point at angle θ on a unit circle.", "One full turn (360° = 2π) is one full wave.", "It peaks at 90°, crosses at 180°, bottoms out at 270°."],
    tryThis: ["Drag P round the circle and watch the wave grow."],
    challenges: [
      { text: "Find the lowest point of the wave", check: "abs(th - 270) < 1" },
      { text: "Find an angle past 90° with sin θ = ½", check: "th > 90 and abs(sin(th*pi/180) - 0.5) < 0.01" },
    ],
    accent: TRIG_ACCENT,
    build: sineWave,
  },
  {
    key: "geo_trig_ratios",
    category: "Trigonometry",
    title: "SOH CAH TOA",
    topic: "Trigonometry",
    summary: "sin, cos and tan as ratios of a right triangle's sides.",
    facts: [
      "sin θ = opposite ÷ hypotenuse (SOH).",
      "cos θ = adjacent ÷ hypotenuse (CAH).",
      "tan θ = opposite ÷ adjacent (TOA).",
      "They depend only on θ, not on the triangle's size.",
    ],
    tryThis: ["Change the hypotenuse: the ratios stay put.", "Change θ: they change."],
    challenges: [
      { text: "Make tan θ = 1", check: "abs(th - 45) < 0.5" },
      { text: "Make the opposite side half the hypotenuse", check: "abs(th - 30) < 0.5" },
    ],
    accent: TRIG_ACCENT,
    build: trigRatios,
  },
  {
    key: "geo_tf_reflect",
    category: "Transformations",
    title: "Reflection",
    topic: "Transformations",
    summary: "A mirror image: same size and shape, flipped over.",
    facts: [
      "Each point and its image are the same distance from the mirror line, on a line at right angles to it.",
      "Lengths and angles are kept; the shape is flipped (its orientation reverses).",
      "Points on the mirror stay where they are.",
    ],
    tryThis: ["Drag the mirror's ends U and V.", "Drag a corner onto the mirror."],
    challenges: [
      { text: "Make the mirror the y-axis", check: "abs(U[1]) < 0.05 and abs(V[1]) < 0.05" },
      { text: "Put a corner on the mirror: it stays put", check: "len(A, A2) < 0.05 or len(B, B2) < 0.05 or len(C, C2) < 0.05" },
    ],
    accent: TRANSFORM_ACCENT,
    build: reflection,
  },
  {
    key: "geo_tf_rotate",
    category: "Transformations",
    title: "Rotation",
    topic: "Transformations",
    summary: "Turning about a centre: every point through the same angle.",
    facts: ["Every point keeps its distance from the centre O and turns through the same angle.", "Positive angles turn anticlockwise.", "Lengths, angles and orientation are kept."],
    tryThis: ["Change the angle.", "Drag the centre O, even inside the triangle."],
    challenges: [
      { text: "Turn it half a turn", check: "abs(abs(q) - 180) < 0.5" },
      { text: "Put O on a corner: that corner stays put", check: "len(O, A) < 0.05 or len(O, B) < 0.05 or len(O, C) < 0.05" },
    ],
    accent: TRANSFORM_ACCENT,
    build: rotation,
  },
  {
    key: "geo_tf_enlarge",
    category: "Transformations",
    title: "Enlargement",
    topic: "Transformations",
    summary: "Scaling from a centre by a factor k.",
    facts: [
      "Each image point is on the line from O through the point, k times as far.",
      "Lengths multiply by |k|, areas by k²; angles are kept (the image is similar).",
      "Negative k puts the image on the other side of O, upside down.",
    ],
    tryThis: ["Change k, including below 0.", "Drag the centre O."],
    challenges: [
      { text: "Make the image the same size, upside down", check: "abs(k + 1) < 0.02" },
      { text: "Make the image half the size", check: "abs(k - 0.5) < 0.02" },
    ],
    accent: TRANSFORM_ACCENT,
    build: enlargement,
  },
];

// ─── Challenges and proofs for the first lessons ──────────────────────────────

const CORE_EXTRAS: Record<string, Pick<GeometryLesson, "challenges" | "proof">> = {
  geo_circle_parts: { challenges: [{ text: "Turn chord CD into a diameter (through O)", check: "abs(cross2(C, D)) < 0.05 and dot(C, D) < 0" }] },
  geo_circle_measure: {
    challenges: [
      { text: "Make the sector a quarter of the circle", check: "abs(theta - 90) < 0.5" },
      { text: "Find the radius where area = circumference", check: "abs(r - 2) < 0.01" },
    ],
  },
  geo_th_centre: {
    challenges: [{ text: "Make ∠APB = 45°", check: "abs(ang(P, A, B) - 45) < 0.5" }],
    proof: [
      "Join P to O and carry the line on through. OA = OP = OB (radii), so triangles OAP and OBP are isosceles.",
      "In triangle OAP the base angles are equal (x), so the exterior angle at O is 2x. Likewise 2y in OBP.",
      "∠APB = x + y and ∠AOB = 2x + 2y: twice as big.",
    ],
  },
  geo_th_semicircle: {
    challenges: [{ text: "Make the triangle isosceles (P at the top)", check: "abs(len(P, A) - len(P, B)) < 0.02" }],
    proof: [
      "OA = OP = OB (radii), so triangles OAP and OBP are isosceles.",
      "Call their base angles x and y. Then triangle APB has angles x, y and x + y.",
      "They add to 180°: 2x + 2y = 180°, so ∠APB = x + y = 90°.",
    ],
  },
  geo_th_same_segment: {
    challenges: [{ text: "Make both angles 60°", check: "abs(ang(P, A, B) - 60) < 0.5 and abs(ang(Q, A, B) - 60) < 0.5" }],
    proof: ["Both ∠APB and ∠AQB stand on the same arc AB.", "Each is half the angle AB makes at the centre.", "So they are equal."],
  },
  geo_th_cyclic: {
    challenges: [{ text: "Make ∠A = 120°", check: "abs(ang(A, D, B) - 120) < 0.5" }],
    proof: [
      "∠A is half the angle at the centre standing on arc BCD.",
      "∠C is half the angle at the centre standing on arc BAD.",
      "Those two angles at the centre make a full turn, 360°, so ∠A + ∠C = 180°.",
    ],
  },
  geo_th_alternate: { challenges: [{ text: "Make the tangent–chord angle 50°", check: "abs(ang(A, T, B) - 50) < 0.5" }] },
  geo_th_tangent_radius: { challenges: [{ text: "Drag Q onto P: the secant becomes the tangent", check: "len(P, Q) < 0.1" }] },
  geo_th_tangent_lengths: {
    challenges: [{ text: "Make the two tangents meet at 60°", check: "dT > r and abs(ang(T, A, B) - 60) < 0.5" }],
    proof: [
      "OA = OB (radii), OT is shared, and both ∠OAT and ∠OBT are 90° (tangent ⟂ radius).",
      "So triangles OAT and OBT are congruent (RHS).",
      "Hence TA = TB, and OT bisects ∠ATB.",
    ],
  },
  geo_th_chord: {
    challenges: [{ text: "Make AB a diameter: M is then the centre", check: "len(M, O) < 0.05" }],
    proof: ["OA = OB (radii), AM = MB, OM is shared: triangles OAM and OBM are congruent (SSS).", "So ∠OMA = ∠OMB. They add to 180°, so each is 90°."],
  },
  geo_conic_ellipse: {
    challenges: [
      { text: "Make it a circle (e = 0)", check: "abs(a - b) < 0.05" },
      { text: "Make the eccentricity 0.8", check: "abs(e - 0.8) < 0.01" },
    ],
  },
  geo_conic_parabola: { challenges: [{ text: "Put P at the vertex: PF = a", check: "abs(p) < 0.05" }] },
  geo_conic_hyperbola: { challenges: [{ text: "Make the asymptotes perpendicular", check: "abs(a - b) < 0.05" }] },
  geo_conic_family: {
    challenges: [
      { text: "Make it a parabola", check: "abs(e - 1) < 0.005" },
      { text: "Make it a circle", check: "e < 0.005" },
    ],
  },
  geo_tri_sum: {
    challenges: [
      { text: "Make a right angle at C", check: "abs(ang(C, A, B) - 90) < 0.5" },
      { text: "Make it equilateral", check: "abs(ang(A, B, C) - 60) < 0.5 and abs(ang(B, A, C) - 60) < 0.5" },
    ],
    proof: [
      "Draw the line through A parallel to BC (dotted).",
      "The angles it makes with AB and AC are alternate angles to ∠B and ∠C, so they equal them.",
      "Those two and ∠A make a straight line at A, so ∠A + ∠B + ∠C = 180°.",
    ],
  },
  geo_tri_isosceles: {
    challenges: [{ text: "Make it equilateral", check: "abs(h - w*sqrt(3)) < 0.02" }],
    proof: ["Draw the line from A to the middle of BC.", "It splits the triangle into two congruent halves (SSS).", "So ∠B = ∠C."],
  },
  geo_tri_pythagoras: {
    challenges: [{ text: "Make a = 3 and c = 5", check: "abs(a - 3) < 0.01 and abs(len(A, B) - 5) < 0.01" }],
    proof: [
      "Put four copies of the triangle inside a square of side a + b, leaving a tilted square of side c in the middle.",
      "Big square = four triangles + c²: (a + b)² = 4 × ½ab + c².",
      "a² + 2ab + b² = 2ab + c², so a² + b² = c².",
    ],
  },
  geo_tri_area: {
    challenges: [{ text: "Make the area exactly 8", check: "abs(sa*len(A, D)/2 - 8) < 0.05" }],
    proof: ["The height splits the triangle into two right triangles.", "Each is half of a rectangle: together ½ × base × height."],
  },
  geo_tri_similar: { challenges: [{ text: "Make the copy exactly twice as big", check: "abs(k - 2) < 0.01" }] },
  geo_tri_congruent: { challenges: [{ text: "Turn the copy upside down (180°)", check: "abs(abs(q) - 180) < 0.5" }] },
  geo_tri_bpt: {
    challenges: [{ text: "Make DE one third of BC", check: "abs(lam - 1/3) < 0.01" }],
    proof: [
      "Triangles BDE and CED have the same base DE and the same height (DE ∥ BC), so they have equal areas.",
      "AD ÷ DB = area(ADE) ÷ area(BDE) and AE ÷ EC = area(ADE) ÷ area(CED) (same heights).",
      "The right-hand sides are equal, so AD ÷ DB = AE ÷ EC.",
    ],
  },
  geo_tri_laws: { challenges: [{ text: "Make ∠C = 90°: the cosine rule becomes Pythagoras", check: "abs(angC - 90) < 0.5" }] },
  geo_tri_centres: { challenges: [{ text: "Make it equilateral: all four centres meet", check: "len(G, H) < 0.05" }] },
  geo_poly_rectangle: { challenges: [{ text: "Make a square of area 16", check: "abs(w - 4) < 0.01 and abs(h - 4) < 0.01" }] },
  geo_poly_regular: {
    challenges: [
      { text: "Find the polygon whose angles are 135°", check: "n == 8" },
      { text: "Find the polygon whose angles add up to 1800°", check: "n == 12" },
    ],
  },
  geo_poly_quad: {
    challenges: [
      {
        text: "Give it a dent (a reflex corner): the sum stays 360°",
        check: "inner(D, A, B) > 180 or inner(A, B, C) > 180 or inner(B, C, D) > 180 or inner(C, D, A) > 180",
      },
    ],
  },
};

/** Every lesson the gallery offers. */
export const GEOMETRY_LESSONS: GeometryLesson[] = [
  ...CORE_LESSONS.map((lesson) => ({ ...lesson, ...CORE_EXTRAS[lesson.key] })),
  ...MORE_LESSONS,
];

