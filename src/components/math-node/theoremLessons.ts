/**
 * More theorems, built with the geometry lesson kit: triangle theorems (angle
 * bisector, midpoint, triangle inequality, the altitude on the hypotenuse, the
 * nine-point circle, Viviani), circle theorems (Simson line, Brahmagupta's formula),
 * coordinate formulas (distance to a line, the equation of a circle) and a first
 * look at calculus (the derivative as a slope, Riemann sums, the mean value theorem).
 *
 * Every number on the graph is live, so each statement can be checked by dragging.
 */
import { INK, TEXT, sceneGroup, sceneSlider, type SimulationScene } from "./simulations";
import {
  ANGLES,
  AMBER,
  BLUE,
  GREEN,
  PINK,
  RED,
  SKY,
  THEOREM_ACCENT,
  TRIANGLE_ACCENT,
  VIOLET,
  accent,
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

const COORD_ACCENT = accent("bg-teal-500", "ring-teal-400/60 border-teal-400", "text-teal-600 dark:text-teal-400");
const CALCULUS_ACCENT = accent("bg-fuchsia-500", "ring-fuchsia-400/60 border-fuchsia-400", "text-fuchsia-600 dark:text-fuchsia-400");

const dashed = { lineStyle: "dashed" as const, outlineWidth: 1.5 };
const dotted = { lineStyle: "dotted" as const, outlineWidth: 1 };

// ─── Triangles ────────────────────────────────────────────────────────────────

function angleBisector(): SimulationScene {
  const r = lessonRows("gtr_bisector");
  return scene(
    [
      r.helpers(...ANGLES, "meet"),
      triangle(r, [-1, 3], [-4, -2], [4, -2], BLUE, false),
      sides(r),
      // The bisector's direction: the two sides from A, each made one long, added.
      r.define("bis = nrm(B - A) + nrm(C - A)"),
      r.point("D = meet(A, A + bis, B, C)", PINK, "D"),
      r.seg("A", "D", PINK),
      r.angle("A", "B", "D", AMBER, 0.8),
      r.angle("A", "D", "C", AMBER, 1.15),
      stack(r, 0, -3, [
        "AD bisects ∠A: ∠BAD = {{ang(A, B, D):1}}° = ∠DAC = {{ang(A, D, C):1}}°",
        "BD ÷ DC = {{len(B, D)}} ÷ {{len(D, C)}} = {{len(B, D)/len(D, C):3}}",
        "AB ÷ AC = {{sc}} ÷ {{sb}} = {{sc/sb:3}}: the same ratio",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function midpointTheorem(): SimulationScene {
  const r = lessonRows("gtr_midpoint");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [-0.5, 3], [-4, -2], [4, -2], BLUE, false),
      r.point("D = (A + B)/2", PINK, "D"),
      r.point("E = (A + C)/2", PINK, "E"),
      r.polygon("[A, D, E]", PINK, { fillOpacity: 0.15, showAngles: false }),
      r.seg("D", "E", PINK, { outlineWidth: 3.5 }),
      stack(r, 0, -3, [
        "D and E are the midpoints of AB and AC",
        "DE = {{len(D, E)}} = ½ × BC = ½ × {{len(B, C)}}",
        "DE ∥ BC: the angle between them is {{asin(min(1, abs(cross2(nrm(E - D), nrm(C - B)))))*180/pi:1}}°",
        "Area of ADE = {{abs(cross2(D - A, E - A))/2}} = ¼ of ABC ({{abs(cross2(B - A, C - A))/2}})",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function triangleInequality(): SimulationScene {
  const r = lessonRows("gtr_inequality");
  return scene(
    [
      r.helpers(...ANGLES),
      triangle(r, [0.5, 2.5], [-3.5, -1.5], [3.5, -1.5], BLUE, false),
      sides(r),
      r.define("slack = min(sb + sc - sa, sc + sa - sb, sa + sb - sc)"),
      // The detour B → A → C, laid flat along BC, against the straight way.
      r.seg("B", "B + (sc + sb)*nrm(C - B)", AMBER, { lineStyle: "dashed", outlineWidth: 2 }),
      r.text("B + (sc + sb)*nrm(C - B) + [0.2, -0.5]", "c + b", AMBER),
      stack(r, 0, -2.8, [
        "a = {{sa}} < b + c = {{sb + sc}}",
        "b = {{sb}} < c + a = {{sc + sa}}",
        "c = {{sc}} < a + b = {{sa + sb}}",
        "Smallest gap: {{slack}} (0 only when the triangle is squashed flat)",
      ]),
    ],
    [],
    [],
    triangleView,
  );
}

function altitudeOnHypotenuse(): SimulationScene {
  const r = lessonRows("gtr_altitude");
  return scene(
    [
      r.helpers(...ANGLES),
      r.point("B = [-r, 0]", BLUE, "B"),
      r.point("C = [r, 0]", BLUE, "C"),
      r.path("r*[cos(t), sin(t)]", INK, [0, Math.PI], dotted),
      r.handle("A = r*[cos(th*pi/180), sin(th*pi/180)]", BLUE, "A", ["th"]),
      r.polygon("[A, B, C]", BLUE, { showAngles: false }),
      r.point("D = [A[1], 0]", PINK, "D"),
      r.seg("A", "D", PINK),
      r.right("A", "B", "C", BLUE),
      r.right("D", "C", "A", PINK),
      stack(r, 0, -1.3, [
        "AD² = {{len(A, D)^2}} = BD × DC = {{len(B, D)}} × {{len(D, C)}} = {{len(B, D)*len(D, C)}}",
        "AB² = {{len(A, B)^2}} = BD × BC = {{len(B, D)*len(B, C)}}",
        "AC² = {{len(A, C)^2}} = DC × BC = {{len(D, C)*len(B, C)}}",
      ]),
    ],
    [
      sceneSlider("r", "Half the hypotenuse", 3, [2, 5, 0.1], "BC = 2 × this.", "shape"),
      sceneSlider("th", "Where A is (°)", 60, [5, 175, 1], "Drag A round the semicircle: the angle at A stays 90°.", "shape"),
    ],
    [sceneGroup("shape", "Triangle")],
    { x: [-7, 7], y: [-4.2, 5.8] },
  );
}

function ninePointCircle(): SimulationScene {
  const r = lessonRows("gtr_ninepoint");
  return scene(
    [
      r.helpers(...ANGLES, "circum", "foot"),
      triangle(r, [-0.8, 3], [-3.5, -1.5], [3.5, -1.5], BLUE, false),
      r.define("Oc = circum(A, B, C)"),
      r.define("H = A + B + C - 2*Oc"),
      r.define("Rn = len(Oc, A)/2"),
      r.point("N = (Oc + H)/2", VIOLET, "N"),
      r.circle("N", "Rn", VIOLET, { outlineWidth: 2 }),
      r.point("Oc", SKY, "O"),
      r.point("H", RED, "H"),
      r.seg("Oc", "H", INK, dotted),
      // The nine points.
      r.point("(B + C)/2", PINK),
      r.point("(C + A)/2", PINK),
      r.point("(A + B)/2", PINK),
      r.point("foot(A, B, C)", GREEN),
      r.point("foot(B, C, A)", GREEN),
      r.point("foot(C, A, B)", GREEN),
      r.point("(A + H)/2", AMBER),
      r.point("(B + H)/2", AMBER),
      r.point("(C + H)/2", AMBER),
      r.seg("A", "foot(A, B, C)", GREEN, dotted),
      r.seg("B", "foot(B, C, A)", GREEN, dotted),
      r.seg("C", "foot(C, A, B)", GREEN, dotted),
      stack(r, 0, -3, [
        "Pink: midpoints of the sides   Green: feet of the altitudes   Amber: midpoints of AH, BH, CH",
        "All nine are {{Rn}} from N, the midpoint of OH: radius = R ÷ 2 = {{2*Rn}} ÷ 2",
        "From N: {{len(N, (B + C)/2)}}, {{len(N, foot(A, B, C))}}, {{len(N, (A + H)/2)}}",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 6] },
  );
}

function viviani(): SimulationScene {
  const r = lessonRows("gtr_viviani");
  return scene(
    [
      r.helpers(...ANGLES, "foot"),
      r.define("h = s*sqrt(3)/2"),
      r.point("A = [0, 2*h/3]", BLUE, "A"),
      r.point("B = [-s/2, -h/3]", BLUE, "B"),
      r.point("C = [s/2, -h/3]", BLUE, "C"),
      r.polygon("[A, B, C]", BLUE, { showAngles: false }),
      r.free("P", [0.4, 0.2], PINK),
      r.point("D = foot(P, B, C)", PINK),
      r.point("E = foot(P, C, A)", PINK),
      r.point("F = foot(P, A, B)", PINK),
      r.seg("P", "D", PINK),
      r.seg("P", "E", GREEN),
      r.seg("P", "F", AMBER),
      r.right("D", "C", "P", PINK, 0.22),
      r.right("E", "A", "P", GREEN, 0.22),
      r.right("F", "B", "P", AMBER, 0.22),
      r.define("inside = cross2(C - B, P - B) > 0 and cross2(A - C, P - C) > 0 and cross2(B - A, P - A) > 0"),
      r.define("dsum = len(P, D) + len(P, E) + len(P, F)"),
      stack(r, 0, -2.8, [
        "PD + PE + PF = {{len(P, D)}} + {{len(P, E)}} + {{len(P, F)}} = {{dsum}}",
        "The triangle's height = {{h}}: the same wherever P is inside",
      ]),
    ],
    [sceneSlider("s", "Side", 5, [2, 7, 0.1], "The equilateral triangle's side.", "shape")],
    [sceneGroup("shape", "Triangle")],
    { x: [-6, 6], y: [-5, 4.5] },
  );
}

// ─── Circle theorems ──────────────────────────────────────────────────────────

function simsonLine(): SimulationScene {
  const r = lessonRows("gt_simson");
  return scene(
    [
      circleBase(r),
      r.helpers("foot"),
      r.handle("A = on(angA)", BLUE, "A", ["angA"]),
      r.handle("B = on(angB)", BLUE, "B", ["angB"]),
      r.handle("C = on(angC)", BLUE, "C", ["angC"]),
      r.polygon("[A, B, C]", BLUE, { showAngles: false, fillOpacity: 0.06 }),
      r.line("B", "C - B", INK, dotted),
      r.line("C", "A - C", INK, dotted),
      r.line("A", "B - A", INK, dotted),
      r.handle("P = (r + off)*[cos(angP*pi/180), sin(angP*pi/180)]", PINK, "P", ["angP"]),
      r.point("D = foot(P, B, C)", GREEN, "D"),
      r.point("E = foot(P, C, A)", GREEN, "E"),
      r.point("F = foot(P, A, B)", GREEN, "F"),
      r.seg("P", "D", PINK, dashed),
      r.seg("P", "E", PINK, dashed),
      r.seg("P", "F", PINK, dashed),
      r.line("D", "F - D", VIOLET, { outlineWidth: 2 }),
      stack(r, 0, -4.2, [
        "D, E, F: the feet of the perpendiculars from P to the three sides",
        "Area of triangle DEF = {{abs(cross2(E - D, F - D))/2:4}}: 0 means they lie on one line",
      ]),
    ],
    [
      radiusSlider(),
      onCircle("angA", "A (°)", 110),
      onCircle("angB", "B (°)", 215),
      onCircle("angC", "C (°)", 330),
      onCircle("angP", "P (°)", 165),
      sceneSlider("off", "P off the circle", 0, [-1.5, 1.5, 0.05], "0 puts P on the circle.", "points"),
    ],
    circleGroups(),
    theoremView,
  );
}

function brahmagupta(): SimulationScene {
  const r = lessonRows("gt_brahmagupta");
  return scene(
    [
      circleBase(r),
      r.handle("A = on(angA)", PINK, "A", ["angA"]),
      r.handle("B = on(angB)", PINK, "B", ["angB"]),
      r.handle("C = on(angC)", PINK, "C", ["angC"]),
      r.handle("D = on(angD)", PINK, "D", ["angD"]),
      r.polygon("[A, B, C, D]", PINK, { showAngles: false }),
      r.define("qa = len(A, B)"),
      r.define("qb = len(B, C)"),
      r.define("qc = len(C, D)"),
      r.define("qd = len(D, A)"),
      r.define("qs = (qa + qb + qc + qd)/2"),
      r.define("brahma = sqrt(max(0, (qs - qa)*(qs - qb)*(qs - qc)*(qs - qd)))"),
      stack(r, 0, -4.2, [
        "Sides a = {{qa}}, b = {{qb}}, c = {{qc}}, d = {{qd}}; s = {{qs}}",
        "√((s − a)(s − b)(s − c)(s − d)) = {{brahma}}",
        "Area measured from the diagonals = {{abs(cross2(C - A, D - B))/2}} (corners in order round the circle)",
      ]),
    ],
    [radiusSlider(), onCircle("angA", "A (°)", 20), onCircle("angB", "B (°)", 100), onCircle("angC", "C (°)", 200), onCircle("angD", "D (°)", 290)],
    circleGroups(),
    theoremView,
  );
}

// ─── Coordinates ──────────────────────────────────────────────────────────────

function pointToLine(): SimulationScene {
  const r = lessonRows("gc_pointline");
  return scene(
    [
      r.helpers(...ANGLES, "foot"),
      r.free("A", [-4, -1], BLUE),
      r.free("B", [3, 2], BLUE),
      r.line("A", "B - A", BLUE, { outlineWidth: 2 }),
      r.free("P", [-1, 3], PINK),
      // The line through A and B as ax + by + c = 0.
      r.define("la = B[2] - A[2]"),
      r.define("lb = A[1] - B[1]"),
      r.define("lc = -(la*A[1] + lb*A[2])"),
      r.define("dist = abs(la*P[1] + lb*P[2] + lc)/sqrt(la^2 + lb^2)"),
      r.point("F = foot(P, A, B)", GREEN, "F"),
      r.seg("P", "F", PINK, { outlineWidth: 2.5 }),
      r.right("F", "B", "P", GREEN, 0.3),
      stack(r, 0, -3.4, [
        "Line AB: ax + by + c = 0 with a = {{la}}, b = {{lb}}, c = {{lc}}",
        "d = |a·x₀ + b·y₀ + c| ÷ √(a² + b²) = |{{la*P[1] + lb*P[2] + lc}}| ÷ {{sqrt(la^2 + lb^2)}} = {{dist}}",
        "Measured: PF = {{len(P, F)}} (the shortest way to the line meets it at 90°)",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6, 5] },
  );
}

function circleEquation(): SimulationScene {
  const r = lessonRows("gc_circle_eq");
  return scene(
    [
      r.helpers("len"),
      r.curve("(x - h)^2 + (y - k)^2 = rr^2", BLUE),
      r.handle("Cn = [h, k]", BLUE, "centre (h, k)", ["h", "k"]),
      r.handle("P = [h, k] + rr*[cos(th*pi/180), sin(th*pi/180)]", PINK, "P", ["th"]),
      r.seg("Cn", "P", PINK, dashed),
      stack(r, 0, -3.6, [
        "(x − h)² + (y − k)² = r²:  (x − {{h}})² + (y − {{k}})² = {{rr^2}}",
        "Expanded: x² + y² + Dx + Ey + F = 0 with D = {{-2*h}}, E = {{-2*k}}, F = {{h^2 + k^2 - rr^2}}",
        "P = ({{P[1]}}, {{P[2]}}): ({{P[1] - h}})² + ({{P[2] - k}})² = {{(P[1] - h)^2 + (P[2] - k)^2}} = r²",
      ]),
    ],
    [
      sceneSlider("h", "Centre x (h)", 1, [-4, 4, 0.1], "Drag the centre.", "circle"),
      sceneSlider("k", "Centre y (k)", 0.5, [-3, 3, 0.1], "Drag the centre.", "circle"),
      sceneSlider("rr", "Radius r", 2.5, [0.5, 4, 0.1], "The circle's radius.", "circle"),
      sceneSlider("th", "P round the circle (°)", 40, [0, 360, 1], "Drag P round the circle.", "circle"),
    ],
    [sceneGroup("circle", "Circle")],
    { x: [-7, 7], y: [-6, 5] },
  );
}

// ─── Calculus ─────────────────────────────────────────────────────────────────

/** The curve the calculus lessons use, and its derivative. */
const curveRows = (r: ReturnType<typeof lessonRows>) => [
  r.helpers("nrm"),
  r.define("f(x) = 0.2*x^3 - x"),
  r.define("df(x) = 0.6*x^2 - 1"),
  r.path("[t, f(t)]", BLUE, [-4, 4]),
];
const calculusView = { x: [-6, 6] as [number, number], y: [-5.5, 5] as [number, number] };

function derivativeSlope(): SimulationScene {
  const r = lessonRows("gk_slope");
  return scene(
    [
      curveRows(r),
      r.handle("P = [a, f(a)]", PINK, "P", ["a"]),
      r.point("Q = [a + hh, f(a + hh)]", AMBER, "Q"),
      r.line("P", "Q - P", AMBER, { outlineWidth: 1.5 }),
      r.line("P", "[1, df(a)]", PINK, { outlineWidth: 2.5 }),
      r.seg("P", "[a + hh, f(a)]", INK, dotted),
      r.seg("[a + hh, f(a)]", "Q", INK, dotted),
      stack(r, 0, -3.4, [
        "f(x) = 0.2x³ − x",
        "Secant PQ: (f(a + h) − f(a)) ÷ h = {{(f(a + hh) - f(a))/hh}}",
        "Tangent at P: f′(a) = 0.6a² − 1 = {{df(a)}}",
      ]),
    ],
    [
      sceneSlider("a", "a (where P is)", 2, [-3.2, 3.2, 0.01], "Drag P along the curve.", "calc"),
      sceneSlider("hh", "h (how far Q is)", 1, [0.01, 2.5, 0.01], "Shrink it towards 0.", "calc"),
    ],
    [sceneGroup("calc", "Curve")],
    calculusView,
  );
}

const POS = "#22c55e";

function riemannSums(): SimulationScene {
  const r = lessonRows("gk_riemann");
  // Every bar in one polygon: for each bar, (x, 0) → (x, h) → (x + Δx, h) → (x + Δx, 0).
  // kron spreads each left edge, right edge and height over its bar's four corners.
  const bars = (heights: string) =>
    `transpose([kron(barL, [1, 1, 0, 0]) + kron(barL + dx, [0, 0, 1, 1]), kron(${heights}, [0, 1, 1, 0])])`;
  return scene(
    [
      r.define("g(x) = sin(3*x) + x^2/20 + lift"),
      r.define("G(x) = (x^3 - 20*cos(3*x))/60 + lift*x"),
      r.define("dx = (b - a)/n"),
      // The bars' left edges, and their heights at the sample point (0 left, 0.5 middle, 1 right).
      r.define("barL = a + dx*range(0, n - 1)"),
      r.define("barH = map(barL + s*dx, g)"),
      r.define("riemann = sum(barH)*dx"),
      r.define("exact = G(b) - G(a)"),
      // Above the axis adds (green), below takes away (red).
      r.polygon(bars("(barH + abs(barH))/2"), POS, { fillOpacity: 0.35, outlineWidth: 1.2, showAngles: false }),
      r.polygon(bars("(barH - abs(barH))/2"), RED, { fillOpacity: 0.35, outlineWidth: 1.2, showAngles: false }),
      r.path("[t, g(t)]", BLUE, [-4, 15]),
      // Labelled "x = a": a plain "a" would name the point and hide the slider a.
      r.handle("[a, 0]", PINK, "x = a", ["a"]),
      r.handle("[b, 0]", PINK, "x = b", ["b"]),
      r.handle("Lf = [0, lift]", PINK, "lift ↕", ["lift"]),
      // Centred over the open space above the curve.
      r.text("[5, 8.3]", "Riemann sum: {{riemann:4}}", TEXT, { labelScale: 1.35 }),
      r.text("[5, 7.3]", "True area: {{exact:4}}", TEXT, { labelScale: 1.35 }),
      r.text("[5, 6.4]", "{{n:0}} bars, width {{dx:3}}, sample point s = {{s:1}}", TEXT),
      r.text("[5, 5.7]", "Green adds, red (below the axis) takes away", TEXT),
    ],
    [
      sceneSlider("n", "Bars n", 40, [1, 200, 1], "More, thinner bars fit the curve better.", "area"),
      sceneSlider("s", "Sample point: 0 left, 0.5 middle, 1 right", 0.5, [0, 1, 0.5], "Where each bar meets the curve.", "area"),
      sceneSlider("a", "Start a", 1, [-3, 5, 0.1], "Drag a along the x-axis.", "area"),
      sceneSlider("b", "End b", 11, [5.5, 13, 0.1], "Drag b along the x-axis.", "area"),
      sceneSlider("lift", "Lift the curve", -1, [-3, 3, 0.05], "Drag the lift point up and down.", "area"),
    ],
    [sceneGroup("area", "Area")],
    { x: [-3, 13.5], y: [-4, 9.2] },
  );
}

function meanValue(): SimulationScene {
  const r = lessonRows("gk_mvt");
  return scene(
    [
      curveRows(r),
      r.handle("A = [a, f(a)]", PINK, "A", ["a"]),
      r.handle("B = [b, f(b)]", PINK, "B", ["b"]),
      r.define("m = (f(b) - f(a))/(b - a)"),
      // f′(c) = m: 0.6c² − 1 = m. Of the two answers ±c₀, take one between a and b.
      r.define("c0 = sqrt((m + 1)/0.6)"),
      r.define("c = c0 > a and c0 < b ? c0 : -c0"),
      r.point("Ct = [c, f(c)]", GREEN, "at c"),
      r.line("A", "B - A", AMBER, { outlineWidth: 2 }),
      r.line("Ct", "[1, df(c)]", GREEN, { outlineWidth: 2 }),
      r.seg("[c, 0]", "Ct", INK, dotted),
      stack(r, 0, -3.4, [
        "Average slope from a to b: (f(b) − f(a)) ÷ (b − a) = {{m}}",
        "At c = {{c}}: f′(c) = {{df(c)}}, the same slope (green ∥ amber)",
      ]),
    ],
    [
      sceneSlider("a", "a", -2.5, [-3.5, 0, 0.01], "Drag A along the curve.", "calc"),
      sceneSlider("b", "b", 2.5, [0.5, 3.5, 0.01], "Drag B along the curve.", "calc"),
    ],
    [sceneGroup("calc", "Curve")],
    calculusView,
  );
}

// ─── The lessons ──────────────────────────────────────────────────────────────

export const THEOREM_LESSONS: GeometryLesson[] = [
  {
    key: "geo_tri_bisector",
    category: "Triangles",
    title: "Angle Bisector Theorem",
    topic: "Triangle",
    summary: "The bisector of an angle splits the opposite side in the ratio of the other two sides.",
    facts: [
      "If AD bisects ∠A of triangle ABC (D on BC), then BD ÷ DC = AB ÷ AC.",
      "So the bisector meets BC at its midpoint only when AB = AC (an isosceles triangle).",
      "Used to find lengths, and to locate the incentre (where the three bisectors meet).",
    ],
    tryThis: ["Drag A: both halves of ∠A stay equal, and the two ratios stay equal.", "Make AB = AC: D moves to the middle of BC."],
    challenges: [{ text: "Make the bisector land on the midpoint of BC", check: "abs(len(B, D) - len(D, C)) < 0.03" }],
    proof: [
      "Triangles ABD and ADC have the same height from A, so their areas are in the ratio BD : DC.",
      "Each area is also ½ × side × AD × sin(½∠A): ½·AB·AD·sin(½A) and ½·AC·AD·sin(½A).",
      "So their ratio is AB : AC as well, which gives BD ÷ DC = AB ÷ AC.",
    ],
    accent: TRIANGLE_ACCENT,
    build: angleBisector,
  },
  {
    key: "geo_tri_midpoint",
    category: "Triangles",
    title: "Midpoint Theorem",
    topic: "Triangle",
    summary: "The segment joining two midpoints is parallel to the third side and half as long.",
    facts: [
      "If D and E are the midpoints of AB and AC, then DE ∥ BC and DE = ½ BC.",
      "Converse: a line through the midpoint of one side, parallel to another, bisects the third.",
      "Triangle ADE is similar to ABC with ratio ½, so its area is ¼ of ABC's.",
    ],
    tryThis: ["Drag any corner: DE stays parallel to BC and exactly half as long."],
    challenges: [{ text: "Make DE exactly 3 long", check: "abs(len(D, E) - 3) < 0.03" }],
    proof: [
      "AD ÷ AB = AE ÷ AC = ½, and the angle at A is shared.",
      "So triangle ADE is similar to ABC (SAS) with ratio ½: DE = ½ BC.",
      "Corresponding angles ∠ADE = ∠ABC are equal, so DE ∥ BC.",
    ],
    accent: TRIANGLE_ACCENT,
    build: midpointTheorem,
  },
  {
    key: "geo_tri_inequality",
    category: "Triangles",
    title: "Triangle Inequality",
    topic: "Triangle",
    summary: "Any two sides together are longer than the third.",
    facts: [
      "In every triangle: a < b + c, b < c + a and c < a + b.",
      "Equivalently |b − c| < a < b + c.",
      "Three lengths make a triangle only if the longest is shorter than the other two added; equality means the points lie on a line.",
    ],
    tryThis: ["Drag A towards side BC: the dashed detour c + b gets closer to a.", "Squash the triangle flat and watch the smallest gap reach 0."],
    challenges: [{ text: "Squash the triangle almost flat (smallest gap below 0.1)", check: "slack < 0.1" }],
    proof: [
      "A straight segment is the shortest path between two points.",
      "Going from B to C through A is a detour, so BA + AC ≥ BC, with equality only if A lies on BC.",
      "The same holds for every side.",
    ],
    accent: TRIANGLE_ACCENT,
    build: triangleInequality,
  },
  {
    key: "geo_tri_altitude",
    category: "Triangles",
    title: "Altitude on the Hypotenuse",
    topic: "Triangle",
    summary: "In a right triangle the altitude is the geometric mean of the two pieces of the hypotenuse.",
    facts: [
      "In a right triangle with the right angle at A and altitude AD: AD² = BD × DC.",
      "Also AB² = BD × BC and AC² = DC × BC (adding these two gives Pythagoras).",
      "Every angle in a semicircle is 90°, so A can slide round it and the triangle stays right-angled.",
    ],
    tryThis: ["Slide A round the semicircle: all three equations keep holding.", "Put A at the top: BD = DC and AD equals the radius."],
    challenges: [{ text: "Make BD exactly 1", check: "abs(len(B, D) - 1) < 0.02" }],
    proof: [
      "Triangles DBA, DAC and ABC all have a right angle and share an angle with each other, so all three are similar (AA).",
      "From DBA ~ DAC: BD ÷ AD = AD ÷ DC, so AD² = BD × DC.",
      "From DBA ~ ABC: BD ÷ AB = AB ÷ BC, so AB² = BD × BC; likewise AC² = DC × BC.",
    ],
    accent: TRIANGLE_ACCENT,
    build: altitudeOnHypotenuse,
  },
  {
    key: "geo_tri_ninepoint",
    category: "Triangles",
    title: "Nine-Point Circle",
    topic: "Triangle",
    summary: "Nine special points of any triangle lie on one circle.",
    facts: [
      "The midpoints of the three sides, the feet of the three altitudes, and the midpoints of AH, BH and CH (H = orthocentre) lie on one circle.",
      "Its centre N is the midpoint of OH (O = circumcentre), on the Euler line.",
      "Its radius is half the circumradius: R ÷ 2.",
    ],
    tryThis: ["Drag the corners: all nine points stay on the violet circle.", "Make an obtuse triangle: some feet move outside the sides, still on the circle."],
    challenges: [{ text: "Make a right angle at A: the orthocentre H lands on A", check: "len(H, A) < 0.05" }],
    proof: [
      "The midpoints of AB, AC, HC and HB form a rectangle (each pair of sides is parallel to BC or to AH, and AH ⟂ BC); so do those of AB, BC, HC, HA.",
      "Both rectangles share a diagonal, so all six midpoints lie on one circle whose diameters are those diagonals.",
      "Each foot of an altitude sees one of those diameters at a right angle, so it lies on the same circle.",
    ],
    accent: TRIANGLE_ACCENT,
    build: ninePointCircle,
  },
  {
    key: "geo_tri_viviani",
    category: "Triangles",
    title: "Viviani's Theorem",
    topic: "Triangle",
    summary: "In an equilateral triangle, the distances from any inside point to the three sides add up to the height.",
    facts: [
      "For any point P inside an equilateral triangle, PD + PE + PF = the triangle's height.",
      "So the sum doesn't depend on where P is.",
      "Outside the triangle it no longer holds (one distance would have to count as negative).",
    ],
    tryThis: ["Drag P around inside: the three lengths change but their sum doesn't.", "Change the side: the sum follows the new height."],
    challenges: [{ text: "Put P at the centre: all three distances equal", check: "abs(len(P, D) - len(P, E)) < 0.03 and abs(len(P, E) - len(P, F)) < 0.03" }],
    proof: [
      "Join P to A, B and C: the triangle splits into PBC, PCA and PAB.",
      "Their areas are ½·s·PD, ½·s·PE and ½·s·PF, and together they make ½·s·h.",
      "Divide by ½·s: PD + PE + PF = h.",
    ],
    accent: TRIANGLE_ACCENT,
    build: viviani,
  },
  {
    key: "geo_th_simson",
    category: "Circle theorems",
    title: "Simson Line",
    topic: "Circle",
    summary: "From a point on the circumcircle, the feet of the perpendiculars to the sides line up.",
    facts: [
      "If P lies on the circumcircle of triangle ABC, the feet of the perpendiculars from P to BC, CA and AB lie on one straight line: the Simson line.",
      "If P is off the circle, the three feet form a real triangle.",
      "Some feet land on the sides extended, not on the sides themselves.",
    ],
    tryThis: ["Move P round the circle: the three feet always line up.", "Move P off the circle with the slider: the feet spread into a triangle."],
    challenges: [{ text: "Move P off the circle until the feet make a triangle of area 0.2", check: "abs(cross2(E - D, F - D))/2 > 0.2" }],
    proof: [
      "P, D, C, E are concyclic (∠PDC = ∠PEC = 90°), and so are P, E, A, F.",
      "Using those circles, ∠PED and ∠PEF turn out supplementary exactly when ABPC is cyclic.",
      "Two angles at E adding to 180° mean D, E and F lie on a straight line.",
    ],
    accent: THEOREM_ACCENT,
    build: simsonLine,
  },
  {
    key: "geo_th_brahmagupta",
    category: "Circle theorems",
    title: "Brahmagupta's Formula",
    topic: "Circle",
    summary: "The area of a cyclic quadrilateral from its four sides alone.",
    facts: [
      "For a quadrilateral with all corners on a circle: Area = √((s − a)(s − b)(s − c)(s − d)), s = (a + b + c + d)/2.",
      "Found by the Indian mathematician Brahmagupta (628 CE).",
      "Let one side shrink to 0 and it becomes Heron's formula for a triangle.",
    ],
    tryThis: ["Drag the corners round the circle (keep them in order): the two areas agree.", "Bring D onto A: it becomes Heron's formula."],
    challenges: [{ text: "Make the biggest quadrilateral this circle allows (a square, area 2r²)", check: "abs(brahma - 2*r^2) < 0.05" }],
    proof: [
      "A diagonal splits it into two triangles; opposite angles of a cyclic quadrilateral add to 180°, so their sines are equal and their cosines opposite.",
      "Area = ½(ab + cd) sin B, and the cosine rule on the diagonal gives cos B in terms of a, b, c, d.",
      "Putting sin²B = 1 − cos²B and factorising gives (s − a)(s − b)(s − c)(s − d).",
    ],
    accent: THEOREM_ACCENT,
    build: brahmagupta,
  },
  {
    key: "geo_coord_point_line",
    category: "Coordinates",
    title: "Distance from a Point to a Line",
    topic: "Coordinates",
    summary: "d = |ax₀ + by₀ + c| ÷ √(a² + b²).",
    facts: [
      "The distance from (x₀, y₀) to the line ax + by + c = 0 is |ax₀ + by₀ + c| ÷ √(a² + b²).",
      "It is measured along the perpendicular: the shortest way to the line.",
      "The sign of ax₀ + by₀ + c tells which side of the line the point is on.",
    ],
    tryThis: ["Drag P: the formula and the measured length agree.", "Drag P across the line: ax₀ + by₀ + c changes sign."],
    challenges: [{ text: "Put P on the line (d = 0)", check: "dist < 0.03" }],
    proof: [
      "Twice the area of triangle PAB is |AB| × d (base × height).",
      "From coordinates it is also |(B − A) × (P − A)|, which works out to |ax₀ + by₀ + c|.",
      "And |AB| = √(a² + b²), so d = |ax₀ + by₀ + c| ÷ √(a² + b²).",
    ],
    accent: COORD_ACCENT,
    build: pointToLine,
  },
  {
    key: "geo_coord_circle",
    category: "Coordinates",
    title: "Equation of a Circle",
    topic: "Coordinates",
    summary: "(x − h)² + (y − k)² = r², and its expanded form.",
    facts: [
      "A circle with centre (h, k) and radius r: (x − h)² + (y − k)² = r² (Pythagoras for every point on it).",
      "Expanded: x² + y² + Dx + Ey + F = 0, with D = −2h, E = −2k, F = h² + k² − r².",
      "From the expanded form: centre (−D/2, −E/2), radius √(D²/4 + E²/4 − F).",
    ],
    tryThis: ["Drag the centre and P: P always satisfies the equation.", "Put the centre at the origin: it becomes x² + y² = r²."],
    challenges: [
      { text: "Make the circle pass through the origin", check: "abs(h^2 + k^2 - rr^2) < 0.05" },
      { text: "Make it x² + y² = 9", check: "abs(h) < 0.01 and abs(k) < 0.01 and abs(rr - 3) < 0.01" },
    ],
    proof: [
      "A point (x, y) is on the circle when its distance from (h, k) is r.",
      "By the distance formula that is √((x − h)² + (y − k)²) = r.",
      "Squaring both sides gives (x − h)² + (y − k)² = r².",
    ],
    accent: COORD_ACCENT,
    build: circleEquation,
  },
  {
    key: "geo_calc_slope",
    category: "Calculus",
    title: "Derivative as a Slope",
    topic: "Calculus",
    summary: "The tangent's slope is the limit of the secant's slope as h → 0.",
    facts: [
      "The slope of the secant through (a, f(a)) and (a + h, f(a + h)) is (f(a + h) − f(a)) ÷ h.",
      "As h shrinks to 0 it approaches the slope of the tangent: the derivative f′(a).",
      "f′(a) > 0: the curve is going up; f′(a) < 0: down; f′(a) = 0: a flat point (often a maximum or minimum).",
      "Power rule: the derivative of xⁿ is n·xⁿ⁻¹, so f(x) = 0.2x³ − x has f′(x) = 0.6x² − 1.",
    ],
    tryThis: ["Shrink h: the amber secant turns onto the pink tangent.", "Drag P to the top of the hump: the tangent goes flat."],
    challenges: [
      { text: "Find a flat point (f′(a) = 0)", check: "abs(df(a)) < 0.02" },
      { text: "Bring the secant's slope within 0.05 of the tangent's", check: "abs((f(a + hh) - f(a))/hh - df(a)) < 0.05" },
    ],
    proof: [
      "f(a + h) − f(a) = 0.2(3a²h + 3ah² + h³) − h.",
      "Divide by h: 0.6a² + 0.6ah + 0.2h² − 1.",
      "Let h → 0: the h terms vanish, leaving f′(a) = 0.6a² − 1.",
    ],
    accent: CALCULUS_ACCENT,
    build: derivativeSlope,
  },
  {
    key: "geo_calc_riemann",
    category: "Calculus",
    title: "Riemann Sums & Area",
    topic: "Calculus",
    summary: "Thin bars under a curve add up to the integral; below the axis counts as negative.",
    facts: [
      "Split [a, b] into n strips of width Δx = (b − a)/n; each bar is as tall as f at a sample point in its strip.",
      "Their total Σ f(xᵢ)·Δx approaches the exact area ∫ₐᵇ f(x) dx as n grows.",
      "It is a signed area: bars above the axis add (green), bars below take away (red).",
      "The exact area comes from an antiderivative: ∫ₐᵇ f(x) dx = F(b) − F(a) (the fundamental theorem of calculus).",
      "Midpoints usually give a much better estimate than left or right ends.",
    ],
    tryThis: [
      "Raise n: the bars hug the curve and the sum closes in on the true area.",
      "Drag the lift point: more of the curve dips below the axis and turns red.",
      "Switch the sample point to the left (0) or right (1): the midpoint is usually closest.",
    ],
    challenges: [
      { text: "Get within 0.001 of the true area", check: "abs(riemann - exact) < 0.001" },
      { text: "Make green and red cancel: a total of 0", check: "abs(riemann) < 0.05" },
      { text: "Lift the curve until no bar is red", check: "min(barH) > 0" },
    ],
    proof: [
      "Each rectangle's height lies between the smallest and largest value of f on its strip.",
      "So the sum lies between the lower and upper sums, which squeeze together as the strips get thinner.",
      "Their common limit is the area, ∫ₐᵇ f(x) dx = F(b) − F(a) with F′ = f.",
    ],
    accent: CALCULUS_ACCENT,
    build: riemannSums,
  },
  {
    key: "geo_calc_mvt",
    category: "Calculus",
    title: "Mean Value Theorem",
    topic: "Calculus",
    summary: "Somewhere between a and b the curve's slope equals its average slope.",
    facts: [
      "If f is smooth on [a, b], there is a c between a and b with f′(c) = (f(b) − f(a)) ÷ (b − a).",
      "In pictures: some tangent is parallel to the chord AB.",
      "Rolle's theorem is the case f(a) = f(b): somewhere the tangent is flat.",
      "Example: average speed 60 km/h over a trip means the speedometer showed exactly 60 at some moment.",
    ],
    tryThis: ["Drag A and B: a green tangent parallel to the chord is always there.", "Make the chord flat: that's Rolle's theorem."],
    challenges: [{ text: "Make the chord flat (Rolle's theorem)", check: "abs(m) < 0.01" }],
    proof: [
      "Subtract the chord: g(x) = f(x) − (the line through A and B). Then g(a) = g(b) = 0.",
      "A smooth g that starts and ends at 0 has a highest or lowest point c inside, where g′(c) = 0.",
      "g′(c) = f′(c) − (slope of AB) = 0, so f′(c) equals the chord's slope.",
    ],
    accent: CALCULUS_ACCENT,
    build: meanValue,
  },
];
