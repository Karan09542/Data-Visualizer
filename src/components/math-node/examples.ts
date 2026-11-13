import { MathFunction, MathVariable, VariableGroup, COLORS } from "./mathTypes";
import {
  INK,
  TEXT,
  sceneGroup,
  sceneRows,
  sceneSlider,
  type GraphView,
  type SimulationTimeline,
} from "./simulations";
import type { Graph3DOptions } from "./Graph3D";

/**
 * An example graph. Plain examples are just rows and sliders; the richer ones also
 * bring slider groups, a timeline and a starting view, like the Simulations do.
 */
export interface ExampleScene {
  functions: MathFunction[];
  variables: MathVariable[];
  groups?: VariableGroup[];
  timeline?: SimulationTimeline;
  view?: GraphView;
  gridType?: "cartesian" | "polar" | "none";
  axisComplexNotationY?: boolean;
  /** How the 3D view is dressed for this scene (height colours, contours, turning…). */
  view3d?: Partial<Graph3DOptions>;
}

/**
 * The scene to load for a gallery entry: its 3D version ("<key>3D") while the graph
 * is in 3D, if it has one.
 */
export function exampleScene(key: string, mode: "2d" | "3d"): ExampleScene | undefined {
  return (mode === "3d" ? MATH_EXAMPLES[`${key}3D`] : undefined) ?? MATH_EXAMPLES[key];
}

/** Whether a gallery entry has a version made for the 3D view. */
export const hasExample3D = (key: string) => `${key}3D` in MATH_EXAMPLES;


/** What the Examples Gallery shows, in order. `key` must exist in MATH_EXAMPLES. */
export const EXAMPLE_GALLERY: {
  key: string;
  category: string;
  label: string;
  hint: string;
  activeClass: string;
  labelClass: string;
}[] = [
    {
      key: "SimpleHarmonicMotion", category: "Physics", label: "Harmonic Motion",
      hint: "A point going round a circle, seen from the side, is a sine wave. Drag the point",
      activeClass: "bg-teal-500/10 border-teal-400 dark:border-teal-500 ring-1 ring-teal-400/50",
      labelClass: "text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300",
    },
    {
      key: "CircularMotion", category: "Physics", label: "Circular Motion",
      hint: "Velocity along the circle, acceleration toward the centre. Drag the point",
      activeClass: "bg-cyan-500/10 border-cyan-400 dark:border-cyan-500 ring-1 ring-cyan-400/50",
      labelClass: "text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
    },
    {
      key: "DampedOscillator", category: "Physics · ODE", label: "Damped Oscillator",
      hint: "Underdamped, critically damped or overdamped: change the damping and see",
      activeClass: "bg-teal-500/10 border-teal-400 dark:border-teal-500 ring-1 ring-teal-400/50",
      labelClass: "text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300",
    },
    {
      key: "Wave", category: "Physics", label: "Traveling Wave",
      hint: "The wave moves sideways, the rope only up and down. Drag the red crest",
      activeClass: "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50",
      labelClass: "text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300",
    },
    {
      key: "Beats", category: "Physics", label: "Beats",
      hint: "Two close notes add into a sound that swells and fades",
      activeClass: "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50",
      labelClass: "text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300",
    },
    {
      key: "Orbit", category: "Physics · ODE", label: "Planetary Orbit",
      hint: "Drag the launch arrow: circle, ellipse, or escape",
      activeClass: "bg-violet-500/10 border-violet-400 dark:border-violet-500 ring-1 ring-violet-400/50",
      labelClass: "text-violet-600 dark:text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300",
    },
    {
      key: "PredatorPrey", category: "Biology · ODE", label: "Predator & Prey",
      hint: "Rabbits and foxes rise and fall in turn. Drag the starting numbers",
      activeClass: "bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50",
      labelClass: "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
    },
    {
      key: "Lorenz", category: "Chaos · ODE", label: "Lorenz Attractor",
      hint: "The butterfly; tiny changes diverge",
      activeClass: "bg-fuchsia-500/10 border-fuchsia-400 dark:border-fuchsia-500 ring-1 ring-fuchsia-400/50",
      labelClass: "text-fuchsia-600 dark:text-fuchsia-400 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300",
    },
    {
      key: "Lissajous", category: "Animation", label: "Lissajous Curves",
      hint: "Two perpendicular oscillations",
      activeClass: "bg-blue-500/10 border-blue-400 dark:border-blue-500 ring-1 ring-blue-400/50",
      labelClass: "text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300",
    },
    {
      key: "Fourier", category: "Mathematics", label: "Fourier Series",
      hint: "Add sine waves one at a time until they make a square wave",
      activeClass: "bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50",
      labelClass: "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
    },
    {
      key: "Statistics", category: "Statistics", label: "Normal Dist.",
      hint: "The bell curve and the 68-95-99.7 rule. Drag the peak",
      activeClass: "bg-purple-500/10 border-purple-400 dark:border-purple-500 ring-1 ring-purple-400/50",
      labelClass: "text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300",
    },
    {
      key: "Geometry", category: "Geometry", label: "Triangle Centres",
      hint: "Drag the corners: centroid, circumcircle, incircle, orthocentre and the Euler line",
      activeClass: "bg-pink-500/10 border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/50",
      labelClass: "text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300",
    },
    {
      key: "Matrix", category: "Matrices", label: "Linear Transformations",
      hint: "Drag the basis arrows: the determinant is the purple area, eigenvectors stay on their lines",
      activeClass: "bg-indigo-500/10 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/50",
      labelClass: "text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
    },
    {
      key: "CubeRootsOfUnity", category: "Complex Algebra", label: "Cube Roots of Unity",
      hint: "1, ω, ω²: equilateral triangle, 1 + ω + ω² = 0, and ω · ω² = 1",
      activeClass: "bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50",
      labelClass: "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
    },
    {
      key: "EulerFormula", category: "Complex Analysis", label: "Euler's Formula",
      hint: "e^(iθ) = cos(θ) + i·sin(θ): phasor rotation, projections onto real and imaginary axes, and polar form",
      activeClass: "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50",
      labelClass: "text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300",
    },
    {
      key: "EulerIdentity", category: "Complex Analysis", label: "Euler's Identity",
      hint: "e^(iπ) + 1 = 0: uniting e, i, π, 1, and 0 via semicircle path and vector addition",
      activeClass: "bg-rose-500/10 border-rose-400 dark:border-rose-500 ring-1 ring-rose-400/50",
      labelClass: "text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300",
    },
    {
      key: "DeMoivre", category: "Complex Analysis", label: "De Moivre's Theorem",
      hint: "(cos θ + i·sin θ)ⁿ = cos(nθ) + i·sin(nθ): repeated rotation and power spiral",
      activeClass: "bg-indigo-500/10 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/50",
      labelClass: "text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
    },
    {
      key: "RootsOfUnity", category: "Complex Algebra", label: "Roots of Unity",
      hint: "Solutions to z⁶ = 1: symmetric roots forming regular polygons on the complex unit circle",
      activeClass: "bg-purple-500/10 border-purple-400 dark:border-purple-500 ring-1 ring-purple-400/50",
      labelClass: "text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300",
    },
    {
      key: "ComplexMultiplication", category: "Complex Geometry", label: "Complex Multiplication",
      hint: "Multiplying complex numbers multiplies lengths and adds angles: dilation and rotation",
      activeClass: "bg-cyan-500/10 border-cyan-400 dark:border-cyan-500 ring-1 ring-cyan-400/50",
      labelClass: "text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
    },
    {
      key: "EulerPolyhedra", category: "Geometry · Topology", label: "Euler's Polyhedra",
      hint: "V − E + F = 2: 3D rotating polyhedron demonstrating Euler's formula for vertices, edges and faces",
      activeClass: "bg-indigo-500/10 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/50",
      labelClass: "text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
    },
    {
      key: "MongeTheorem", category: "Geometry", label: "Monge's Theorem",
      hint: "Three circles: the meeting points of each pair's outer tangents lie on one line. In 3D: the proof with cones",
      activeClass: "bg-red-500/10 border-red-400 dark:border-red-500 ring-1 ring-red-400/50",
      labelClass: "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300",
    },
  ];

const TAU = 2 * Math.PI;
const BLUE = "#3b82f6";
const RED = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const PURPLE = "#8b5cf6";
const SKY = "#0ea5e9";
const INDIGO = "#6366f1";
const PINK = "#ec4899";
const fill = (color: string, opacity = 1) =>
  ({ fillColor: color, fillOpacity: opacity, fillPattern: "solid" as const });

// ─── Harmonic motion: the circle behind the sine wave ─────────────────────────

function harmonicMotion(): ExampleScene {
  const r = sceneRows("shm");
  // Circle centred at (-4, 0); the graph of y against time starts at the origin.
  return {
    functions: [
      r.define("T = 2*pi/w"),
      r.define("ang = w*time + phi"),
      r.define("P = [-4 + A*cos(ang), A*sin(ang)]"),
      r.path("[-4 + A*cos(t), A*sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[-4, 0] + t*(P - [-4, 0])", TEXT, [0, 1], { outlineWidth: 2 }),
      r.path("[2*T*t, A*sin(w*2*T*t + phi)]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[time*t, A*sin(w*time*t + phi)]", BLUE, [0, 1]),
      r.path("[P[1] + (time - P[1])*t, P[2]]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.point("[time, A*sin(ang)]", BLUE),
      r.point("P", RED, { dragVars: ["A", "phi"] }),
      r.readout("[4, 3.5]", "y = A·sin(ωt + φ) = {{A*sin(ang)}}", TEXT),
      r.readout("[4, -3.5]", "Period T = 2π/ω = {{T}} s    frequency 1/T = {{1/T}} Hz", TEXT),
    ],
    variables: [
      sceneSlider("A", "Amplitude A", 2, [0.5, 3, 0.05], "Radius of the circle = height of the wave. Drag the red point.", "wave"),
      sceneSlider("w", "Angular speed ω (rad/s)", 2, [1, 5, 0.1], "How fast the point goes round.", "wave"),
      sceneSlider("phi", "Phase φ (rad)", 0, [0, TAU, 0.01], "Where on the circle it starts.", "wave"),
    ],
    groups: [sceneGroup("wave", "Oscillation")],
    // Two full periods, then round again.
    timeline: { mode: "loop", min: 0, max: 10, endExpr: "2*T" },
    view: { x: [-7.5, 13.5], y: [-4.2, 4.2] },
  };
}

// ─── Circular motion ──────────────────────────────────────────────────────────

function circularMotion(): ExampleScene {
  const row = sceneRows("circ");
  return {
    functions: [
      row.define("ang = w*time + phi"),
      row.define("P = r*[cos(ang), sin(ang)]"),
      row.path("[r*cos(t), r*sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      row.path("t*P", TEXT, [0, 1], { outlineWidth: 2 }),
      row.arrow("Vector(P, P + r*w*[-sin(ang), cos(ang)]/2)", GREEN),
      row.arrow("Vector(P, P - r*w^2*[cos(ang), sin(ang)]/2)", RED),
      row.point("[0, 0]", INK),
      row.point("P", PURPLE, { dragVars: ["r", "phi"] }),
      row.readout("[0, 4.6]", "One lap takes T = 2π/ω = {{2*pi/w}} s", TEXT),
      row.readout("[0, -4.5]", "Green, velocity along the circle: v = rω = {{r*w}}", GREEN),
      row.readout("[0, -5.1]", "Red, acceleration toward the centre: a = rω² = v²/r = {{r*w^2}}", RED),
    ],
    variables: [
      sceneSlider("r", "Radius r", 2, [0.5, 4, 0.05], "Drag the purple point in or out.", "motion"),
      sceneSlider("w", "Angular speed ω (rad/s)", 1, [0.2, 4, 0.05], "Double it: v doubles, a goes up 4×.", "motion"),
      sceneSlider("phi", "Start angle φ (rad)", 0, [0, TAU, 0.01], "Drag the point round the circle.", "motion"),
    ],
    groups: [sceneGroup("motion", "Motion")],
    timeline: { mode: "loop", min: 0, max: 10, endExpr: "2*pi/w" },
    view: { x: [-5.5, 5.5], y: [-5.6, 5.1] },
  };
}

// ─── Damped oscillator ────────────────────────────────────────────────────────

function dampedOscillator(): ExampleScene {
  const r = sceneRows("damp");
  // Mass on a vertical track at x = -2; its position x(t) is graphed to the right.
  return {
    functions: [
      r.ode("x'' = -k*x - c*x'; x(0) = x0; x'(0) = v0", BLUE, {
        tRange: [0, 20],
        odeAxes: ["t", "x"],
        odeSteps: 1500,
      }),
      r.define("z = c/(2*sqrt(k))"),
      r.define("wd = sqrt(k - c^2/4)"),
      r.define("R0 = sqrt(x0^2 + ((v0 + c*x0/2)/wd)^2)"),
      r.path("[20*t, R0*exp(-c*10*t)]", AMBER, [0, 1], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("[20*t, -R0*exp(-c*10*t)]", AMBER, [0, 1], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("[-2, -3.6 + 7.2*t]", INK, [0, 1], { outlineWidth: 1 }),
      r.shape("[[-2.4, x - 0.35], [-1.6, x - 0.35], [-1.6, x + 0.35], [-2.4, x + 0.35]]", BLUE),
      r.point("[-2, x]", BLUE, { dragVars: ["x0"] }),
      r.path("[-2 + (time + 2)*t, x]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.readout(
        "[10, 3.5]",
        'ζ = c/(2√k) = {{z}}: {{z < 0.995 ? "underdamped, it swings" : (z <= 1.005 ? "critically damped, the fastest settle" : "overdamped, it creeps back")}}',
        TEXT,
      ),
      r.readout("[10, -3.5]", "Dashed: the envelope R·e^(−ct/2) the swings shrink inside (only while it swings)", TEXT),
    ],
    variables: [
      sceneSlider("k", "Stiffness k", 1, [0.1, 10, 0.05], "Spring strength.", "system"),
      sceneSlider("c", "Damping c", 0.3, [0, 5, 0.05], "Try 2√k for critical damping.", "system"),
      sceneSlider("x0", "Start position x₀", 2, [-3, 3, 0.05], "Drag the block.", "start"),
      sceneSlider("v0", "Start velocity v₀", 0, [-5, 5, 0.1], "A starting push.", "start"),
    ],
    groups: [sceneGroup("system", "Spring"), sceneGroup("start", "Start")],
    timeline: { mode: "once", min: 0, max: 20 },
    view: { x: [-3.5, 21], y: [-4.2, 4.2] },
  };
}

// ─── Traveling wave ───────────────────────────────────────────────────────────

function travelingWave(): ExampleScene {
  const r = sceneRows("wave");
  return {
    functions: [
      r.define("lam = 2*pi/k"),
      r.define("v = w/k"),
      // A crest rides along at speed v; wrapped so it stays near the middle.
      r.define("xc = mod(lam/4 + v*time + lam, 2*lam) - lam"),
      { id: "wave_curve", type: "function", expr: "A*sin(k*x - w*time)", color: AMBER, visible: true },
      r.arrow("Vector([xc, A + 0.6], [xc + lam, A + 0.6])", TEXT, { outlineWidth: 1.5 }),
      r.readout("[xc + lam/2, A + 1.1]", "λ = {{lam}}", TEXT),
      r.path("[0, -A + 2*A*t]", BLUE, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.point("[0, A*sin(-w*time)]", BLUE),
      r.readout("[0, -A - 0.6]", "This bit of rope only moves up and down", BLUE),
      r.point("[xc, A]", RED, { dragVars: ["k", "A"] }),
      r.readout("[0, -3.7]", "T = 2π/ω = {{2*pi/w}} s    wave speed v = ω/k = λ/T = {{v}}", TEXT),
    ],
    variables: [
      sceneSlider("A", "Amplitude A", 1.5, [0.2, 2.5, 0.05], "Drag the red crest up or down.", "wave"),
      sceneSlider("k", "Wave number k", 2, [0.5, 4, 0.05], "λ = 2π/k. Drag the red crest sideways.", "wave"),
      sceneSlider("w", "Angular frequency ω", 3, [0.5, 8, 0.1], "Faster shaking: shorter period, faster wave.", "wave"),
    ],
    groups: [sceneGroup("wave", "Wave")],
    // Four periods: the crest moves exactly 4λ, so the loop joins up seamlessly.
    timeline: { mode: "loop", min: 0, max: 10, endExpr: "8*pi/w" },
    view: { x: [-7, 7], y: [-4.2, 4] },
  };
}

// ─── Beats ────────────────────────────────────────────────────────────────────

function beats(): ExampleScene {
  const r = sceneRows("beats");
  const fn = (id: string, expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction =>
    ({ id, type: "function", expr, color, visible: true, ...extra });
  // Across is time, so the pattern scrolls past like a recording.
  return {
    functions: [
      fn("beats_note1", "sin(w1*(x - time)) + 7", BLUE, { outlineWidth: 2 }),
      fn("beats_note2", "sin(w2*(x - time)) + 4.2", RED, { outlineWidth: 2 }),
      fn("beats_sum", "sin(w1*(x - time)) + sin(w2*(x - time))", PURPLE),
      fn("beats_env1", "2*cos((w2 - w1)*(x - time)/2)", AMBER, { lineStyle: "dashed", outlineWidth: 1.5 }),
      fn("beats_env2", "-2*cos((w2 - w1)*(x - time)/2)", AMBER, { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.readout("[1.6, 8.5]", "note 1: ω₁ = {{w1:1}}", BLUE),
      r.readout("[1.6, 5.7]", "note 2: ω₂ = {{w2:1}}", RED),
      r.readout("[1.6, 2.6]", "added together", PURPLE),
      r.readout(
        "[6, -3]",
        "Loud-quiet {{abs(w1 - w2):1}} rad/s: one beat every 2π/|ω₁ − ω₂| = {{2*pi/abs(w1 - w2)}} s",
        TEXT,
      ),
    ],
    variables: [
      sceneSlider("w1", "Frequency ω₁", 10, [1, 30, 0.1], "First note.", "notes"),
      sceneSlider("w2", "Frequency ω₂", 11, [1, 30, 0.1], "Closer to ω₁ means slower beats.", "notes"),
    ],
    groups: [sceneGroup("notes", "Notes")],
    timeline: { mode: "continuous", min: 0, max: 10, speed: 0.5 },
    view: { x: [-0.5, 12.5], y: [-3.6, 9.2] },
  };
}

// ─── Planetary orbit ──────────────────────────────────────────────────────────

function orbit(): ExampleScene {
  const r = sceneRows("orbit");
  return {
    functions: [
      r.ode(
        "x'' = -mu*x/(x^2 + y^2)^1.5; y'' = -mu*y/(x^2 + y^2)^1.5; x(0) = r0; y(0) = 0; x'(0) = 0; y'(0) = v0",
        PURPLE,
        { tRange: [0, 25], odeSteps: 2000, odeAxes: ["x", "y"] },
      ),
      r.path("[0.12*cos(t), 0.12*sin(t)]", AMBER, [0, TAU], fill(AMBER)),
      r.path("t*[x, y]", TEXT, [0, 1], { outlineWidth: 1, lineStyle: "dashed" }),
      r.arrow("Vector([x, y], [x + dx, y + dy])", GREEN, { outlineWidth: 2 }),
      r.arrow("Vector([r0, 0], [r0, v0])", SKY, { dragVars: ["v0"], lineStyle: "dashed", outlineWidth: 2 }),
      r.point("[r0, 0]", SKY, { dragVars: ["r0"] }),
      r.define("E = v0^2/2 - mu/r0"),
      r.readout(
        "[-0.5, -3.1]",
        'Energy v²/2 − μ/r = {{E}}: {{E < 0 ? "bound, it keeps orbiting" : "it escapes and never returns"}}',
        TEXT,
      ),
      r.readout("[-0.5, -3.6]", "circle at v₀ = √(μ/r₀) = {{sqrt(mu/r0)}}    escape at √(2μ/r₀) = {{sqrt(2*mu/r0)}}", TEXT),
    ],
    variables: [
      sceneSlider("v0", "Launch speed v₀", 1, [0.3, 1.6, 0.01], "Drag the blue arrow's tip.", "launch"),
      sceneSlider("r0", "Start distance r₀", 1, [0.5, 2, 0.01], "Drag the blue dot.", "launch"),
      sceneSlider("mu", "Sun's pull μ", 1, [0.2, 3, 0.05], "Mass of the Sun (times G).", "sun"),
    ],
    groups: [sceneGroup("launch", "Launch"), sceneGroup("sun", "Sun")],
    timeline: { mode: "loop", min: 0, max: 25 },
    view: { x: [-4, 3], y: [-4, 2.6] },
  };
}

// ─── Predator & prey ──────────────────────────────────────────────────────────

function predatorPrey(): ExampleScene {
  const r = sceneRows("lv");
  const system = "R' = a*R - b*R*F; F' = c*R*F - d*F; R(0) = R0; F(0) = F0";
  return {
    functions: [
      r.ode(system, GREEN, { tRange: [0, 40], odeSteps: 2500, odeAxes: ["t", "R"] }),
      r.ode(system, RED, { tRange: [0, 40], odeSteps: 2500, odeAxes: ["t", "F"] }),
      r.path("[40*t, d/c]", GREEN, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[40*t, a/b]", RED, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[time, -1 + 25*t]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.point("[0, R0]", GREEN, { dragVars: ["R0"] }),
      r.point("[0, F0]", RED, { dragVars: ["F0"] }),
      r.readout("[20, 23]", "Rabbits R = {{R:1}}    Foxes F = {{F:1}}", TEXT),
      r.readout("[20, -1.8]", "Dashed: the balance point R* = d/c = {{d/c:1}}, F* = a/b = {{a/b:1}}. Start there and nothing changes", TEXT),
    ],
    variables: [
      sceneSlider("R0", "Rabbits at start", 10, [0.5, 25, 0.1], "Drag the green dot.", "start"),
      sceneSlider("F0", "Foxes at start", 5, [0.5, 15, 0.1], "Drag the red dot.", "start"),
      sceneSlider("a", "Rabbit birth rate a", 1.1, [0, 3, 0.05], "How fast rabbits breed.", "rates"),
      sceneSlider("b", "Catch rate b", 0.4, [0.05, 2, 0.05], "How often a fox catches a rabbit.", "rates"),
      sceneSlider("c", "Fox growth c", 0.1, [0.02, 1, 0.01], "Rabbits eaten that become foxes.", "rates"),
      sceneSlider("d", "Fox death rate d", 0.4, [0, 2, 0.05], "How fast foxes die without food.", "rates"),
    ],
    groups: [sceneGroup("start", "Start"), sceneGroup("rates", "Rates")],
    timeline: { mode: "once", min: 0, max: 40, speed: 4 },
    view: { x: [-2, 42], y: [-3, 24.5] },
  };
}

// ─── Fourier series ───────────────────────────────────────────────────────────

function fourier(): ExampleScene {
  const r = sceneRows("fourier");
  const fn = (id: string, expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction =>
    ({ id, type: "function", expr, color, visible: true, ...extra });
  return {
    functions: [
      r.define("sq(s, m) = m < 1 ? 0 : sin((2*m - 1)*s)/(2*m - 1) + sq(s, m - 1)"),
      fn("fourier_target", "sign(sin(x))", TEXT, { lineStyle: "dashed", outlineWidth: 1 }),
      fn("fourier_last", "4/pi*sin((2*N - 1)*x)/(2*N - 1)", AMBER, { outlineWidth: 1.5 }),
      fn("fourier_sum", "4/pi*sq(x, N)", GREEN),
      r.readout("[0, 2]", "Green: the first {{N:0}} odd sine waves added. Orange: the last one added", TEXT),
      r.readout("[0, -1.9]", "The overshoot at each jump never goes away: about 9% (the Gibbs effect)", TEXT),
    ],
    variables: [
      sceneSlider("N", "Number of waves N", 4, [1, 30, 1], "More waves, sharper corners.", "series"),
    ],
    groups: [sceneGroup("series", "Series")],
    view: { x: [-7, 7], y: [-2.4, 2.5] },
  };
}

// ─── Normal distribution ──────────────────────────────────────────────────────

function normalDistribution(): ExampleScene {
  const r = sceneRows("norm");
  return {
    functions: [
      r.define("pdf(s) = exp(-0.5*((s - mu)/sigma)^2)/(sigma*sqrt(2*pi))"),
      r.define("lo = mu - n*sigma"),
      r.define("hi = mu + n*sigma"),
      // The shaded band's outline: up the left edge, along the curve, down the right.
      r.path(
        "t < 1 ? [lo, t*pdf(lo)] : (t < 2 ? [lo + (t - 1)*(hi - lo), pdf(lo + (t - 1)*(hi - lo))] : [hi, (3 - t)*pdf(hi)])",
        PURPLE,
        [0, 3],
        { ...fill(PURPLE, 0.25), outlineWidth: 1 },
      ),
      { id: "norm_curve", type: "function", expr: "pdf(x)", color: PURPLE, visible: true },
      r.point("[mu, pdf(mu)]", PURPLE, { dragVars: ["mu", "sigma"] }),
      r.readout("[mu, pdf(mu) + 0.2]", "Within ±{{n:1}}σ of the mean: {{100*erf(n/sqrt(2)):1}}% of all values", TEXT),
    ],
    variables: [
      sceneSlider("mu", "Mean μ", 0, [-1.5, 1.5, 0.05], "The centre. Drag the peak sideways.", "shape"),
      sceneSlider("sigma", "Standard deviation σ", 0.5, [0.2, 1.2, 0.01], "The spread. Drag the peak up or down.", "shape"),
      sceneSlider("n", "Shaded band (σ)", 1, [0.1, 3, 0.1], "1, 2 and 3 give 68%, 95%, 99.7%.", "band"),
    ],
    groups: [sceneGroup("shape", "Shape"), sceneGroup("band", "Shaded band")],
    view: { x: [-2.2, 2.2], y: [-0.3, 1.25] },
  };
}


// ─── Geometry: the centres of a triangle ──────────────────────────────────────

function triangleCentres(): ExampleScene {
  const r = sceneRows("tri");
  const PINK = "#ec4899";
  const vertex = (name: string, vars: [string, string]) =>
    r.point(name, PINK, {
      dragVars: vars,
      showLabel: true,
      label: name,
      labelPlain: true,
      labelAlignment: "above",
    });
  const centre = (expr: string, color: string, label: string) =>
    r.point(expr, color, { showLabel: true, label, labelPlain: true, labelPosition: [0.3, 0.3], labelAlignment: "custom" });
  return {
    functions: [
      r.define("A = [ax, ay]"),
      r.define("B = [bx, by]"),
      r.define("C = [cx, cy]"),
      // Side lengths, opposite each corner
      r.define("a = norm(B - C)"),
      r.define("b = norm(C - A)"),
      r.define("c = norm(A - B)"),
      r.define("Area = abs((bx - ax)*(cy - ay) - (cx - ax)*(by - ay))/2"),
      // Centroid: where the medians meet
      r.define("G = (A + B + C)/3"),
      // Circumcentre: equally far from all three corners
      r.define("D = 2*(ax*(by - cy) + bx*(cy - ay) + cx*(ay - by))"),
      r.define(
        "O = [((ax^2 + ay^2)*(by - cy) + (bx^2 + by^2)*(cy - ay) + (cx^2 + cy^2)*(ay - by))/D, ((ax^2 + ay^2)*(cx - bx) + (bx^2 + by^2)*(ax - cx) + (cx^2 + cy^2)*(bx - ax))/D]",
      ),
      r.define("R = norm(A - O)"),
      // Incentre: equally far from all three sides
      r.define("I = (a*A + b*B + c*C)/(a + b + c)"),
      r.define("rin = 2*Area/(a + b + c)"),
      // Orthocentre: where the altitudes meet. Always H = 3G - 2O (the Euler line)
      r.define("H = 3*G - 2*O"),
      r.shape("[A, B, C]", PINK, { fillOpacity: 0.12, outlineWidth: 2 }),
      r.path("O + R*[cos(t), sin(t)]", SKY, [0, TAU], { outlineWidth: 1.5 }),
      r.path("I + rin*[cos(t), sin(t)]", GREEN, [0, TAU], { outlineWidth: 1.5 }),
      r.path("A + t*((B + C)/2 - A)", AMBER, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.path("B + t*((C + A)/2 - B)", AMBER, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.path("C + t*((A + B)/2 - C)", AMBER, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.path("O + t*(H - O)", PURPLE, [-0.6, 1.6], { lineStyle: "dashed", outlineWidth: 2 }),
      centre("O", SKY, "O"),
      centre("G", AMBER, "G"),
      centre("I", GREEN, "I"),
      centre("H", RED, "H"),
      vertex("A", ["ax", "ay"]),
      vertex("B", ["bx", "by"]),
      vertex("C", ["cx", "cy"]),
      r.readout(
        "[0.5, -5.5]",
        "O circumcentre · G centroid · I incentre · H orthocentre",
        TEXT,
      ),
      r.readout(
        "[0.5, -6.1]",
        "Area = {{Area}}    Perimeter = {{a + b + c}}    Angles: A = {{acos((b^2 + c^2 - a^2)/(2*b*c))*180/pi:1}}°, B = {{acos((c^2 + a^2 - b^2)/(2*c*a))*180/pi:1}}°, C = {{acos((a^2 + b^2 - c^2)/(2*a*b))*180/pi:1}}°",
        TEXT,
      ),
      r.readout(
        "[0.5, -6.8]",
        "Euler line (dashed): O, G and H always line up, with GH = 2·OG ({{norm(H - G)}} = 2 × {{norm(G - O)}})",
        PURPLE,
      ),
    ],
    variables: [
      sceneSlider("ax", "A: x", -4, [-6, 6, 0.05], "Drag corner A.", "corners"),
      sceneSlider("ay", "A: y", -2, [-6, 6, 0.05], "", "corners"),
      sceneSlider("bx", "B: x", 4.5, [-6, 6, 0.05], "Drag corner B.", "corners"),
      sceneSlider("by", "B: y", -1.5, [-6, 6, 0.05], "", "corners"),
      sceneSlider("cx", "C: x", 2.5, [-6, 6, 0.05], "Drag corner C.", "corners"),
      sceneSlider("cy", "C: y", 2.8, [-6, 6, 0.05], "", "corners"),
    ],
    groups: [sceneGroup("corners", "Corners (drag them on the graph)")],
    view: { x: [-6.8, 7.8], y: [-7.4, 5] },
  };
}

// ─── Matrices: a 2×2 matrix as a transformation of the plane ──────────────────

function linearTransformation(): ExampleScene {
  const r = sceneRows("lin");
  return {
    functions: [
      r.define("M = [[a, b], [c, d]]"),
      // s blends from doing nothing (the identity) to the full matrix
      r.define("Ms = (1 - s)*[[1, 0], [0, 1]] + s*M"),
      r.define("i2 = Ms*[1, 0]"),
      r.define("j2 = Ms*[0, 1]"),
      r.define("dt = a*d - b*c"),
      r.define("tr = a + d"),
      r.define("disc = tr^2/4 - dt"),
      r.define("l1 = tr/2 + sqrt(max(disc, 0))"),
      r.define("l2 = tr/2 - sqrt(max(disc, 0))"),
      // An eigenvector for each eigenvalue (drawn only when they're real)
      r.define("e1 = disc < 0 ? [NaN, NaN] : (abs(b) > 1e-9 ? [b, l1 - a] : (abs(c) > 1e-9 ? [l1 - d, c] : [1, 0]))"),
      r.define("e2 = disc < 0 ? [NaN, NaN] : (abs(b) > 1e-9 ? [b, l2 - a] : (abs(c) > 1e-9 ? [l2 - d, c] : [0, 1]))"),
      r.shape("[[0, 0], [1, 0], [1, 1], [0, 1]]", INK, { fillOpacity: 0.12, outlineWidth: 1, lineStyle: "dashed" }),
      r.path("[cos(t), sin(t)]", INK, [0, TAU], { outlineWidth: 1, lineStyle: "dashed" }),
      r.shape("[[0, 0], i2, i2 + j2, j2]", PURPLE, { fillOpacity: 0.3, outlineWidth: 2 }),
      r.path("Ms*[cos(t), sin(t)]", PURPLE, [0, TAU], { outlineWidth: 1.5 }),
      r.path("t*e1/norm(e1)", AMBER, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.path("t*e2/norm(e2)", AMBER, [-8, 8], { lineStyle: "dashed", outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], Ms*[vx, vy])", SKY, { outlineWidth: 2 }),
      r.arrow("Vector([0, 0], [vx, vy])", TEXT, { dragVars: ["vx", "vy"], outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], i2)", GREEN, { dragVars: ["a", "c"] }),
      r.arrow("Vector([0, 0], j2)", RED, { dragVars: ["b", "d"] }),
      r.readout("[0, 3.7]", "M = ( {{a}}  {{b}} ; {{c}}  {{d}} )    green = first column, red = second", TEXT),
      r.readout(
        "[0, -3.3]",
        'det M = ad − bc = {{dt}}: the purple area{{dt < 0 ? " (negative: the plane is flipped over)" : (abs(dt) < 1e-9 ? " (zero: the plane is squashed onto a line)" : "")}}',
        PURPLE,
      ),
      r.readout(
        "[0, -3.9]",
        'Eigenvalues {{disc < 0 ? "are complex: no line stays put (a rotation)" : concat("λ₁ = ", format(l1, 3), ", λ₂ = ", format(l2, 3), ": vectors on the orange lines only stretch")}}',
        AMBER,
      ),
    ],
    variables: [
      sceneSlider("a", "a (top left)", 1.5, [-3, 3, 0.05], "Drag the green arrow.", "matrix"),
      sceneSlider("b", "b (top right)", 0.5, [-3, 3, 0.05], "Drag the red arrow.", "matrix"),
      sceneSlider("c", "c (bottom left)", 0.5, [-3, 3, 0.05], "Drag the green arrow.", "matrix"),
      sceneSlider("d", "d (bottom right)", 1, [-3, 3, 0.05], "Drag the red arrow.", "matrix"),
      sceneSlider("s", "Blend from identity", 1, [0, 1, 0.01], "0 = do nothing, 1 = the full matrix.", "show"),
      sceneSlider("vx", "Test vector v: x", 1.2, [-3, 3, 0.05], "Drag the grey arrow. Blue is M·v.", "show"),
      sceneSlider("vy", "Test vector v: y", -0.8, [-3, 3, 0.05], "", "show"),
    ],
    groups: [sceneGroup("matrix", "Matrix M"), sceneGroup("show", "Explore")],
    view: { x: [-4.2, 4.2], y: [-4.4, 4.2] },
  };
}

// ─── Complex numbers and polyhedra ────────────────────────────────────────────
//
// Each of these keeps its figure on the left and a short column of notes on the
// right, clear of the axes. The notes are LaTeX with live values. Each also has a
// version for the 3D view (below), loaded in its place while the graph is in 3D.

type Rows = ReturnType<typeof sceneRows>;
type Note = [text: string, color: string];

/** A column of LaTeX notes, top to bottom from `top`; the first line is the heading. */
const notes = (r: Rows, x: number, top: number, step: number, lines: Note[], hasAxes = true): MathFunction[] => {
  let shift = 0;
  return lines.map(([text, color], i) => {
    let y = top - i * step - shift;
    // Step over the x-axis and the tick numbers under it.
    if (hasAxes && y < 0.45 * step && y > -0.75 * step) {
      shift += y + 0.75 * step;
      y = -0.75 * step;
    }
    return r.readout(`[${x}, ${Number(y.toFixed(3))}]`, text, color, {
      labelLatex: true,
      labelPlain: false,
      labelScale: i === 0 ? 1.15 : 0.92,
    });
  });
};

/** A LaTeX label standing on its own at `at`: for labels that keep clear of what they name. */
const mark = (r: Rows, at: string, text: string, color: string, scale = 1): MathFunction =>
  r.readout(at, text, color, { labelLatex: true, labelPlain: false, labelScale: scale });

/** The same for the 3D view: notes pinned to the corner of the view, in this order. */
const notes3 = (r: Rows, at: [number, number], top: number, step: number, lines: Note[]): MathFunction[] =>
  lines.map(([text, color], i) =>
    r.readout(`[${at[0]}, ${at[1]}, ${Number((top - i * step).toFixed(3))}]`, text, color, {
      labelLatex: true,
      labelPlain: false,
      labelPinned: true,
      labelScale: i === 0 ? 1.15 : 0.95,
    }),
  );

/** A LaTeX label on a point, nudged to `at` (graph units from the point). */
const tex = (label: string, at?: [number, number]): Partial<MathFunction> => ({
  label,
  showLabel: true,
  labelLatex: true,
  ...(at ? { labelPosition: at, labelAlignment: "custom" as const } : {}),
});

/** A point of space (three coordinates): what the 3D view draws as a dot. */
const spacePoint = (r: Rows, expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
  ...r.define(expr),
  color,
  isDraggable: false,
  ...extra,
});

/** A surface z = f(x, y) for the 3D view. */
const surface = (r: Rows, expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
  ...r.define(expr),
  type: "implicit",
  color,
  ...extra,
});

// ─── Cube roots of unity ──────────────────────────────────────────────────────

function cubeRootsOfUnity(): ExampleScene {
  const r = sceneRows("cuberoot");
  return {
    functions: [
      r.define("w = exp(i * 2*pi / 3)"),
      r.define("z0 = R * exp(i * phi)"),
      r.define("z1 = z0 * w"),
      r.define("z2 = z0 * w^2"),
      r.path("R * [cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      r.shape("[z0, z1, z2]", GREEN, { fillOpacity: 0.14, outlineWidth: 2, showAngles: false }),
      // 120° between neighbours.
      r.path("0.6 * [cos(phi + t), sin(phi + t)]", GREEN, [0, TAU / 3], { outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], z0)", SKY, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], z1)", GREEN, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], z2)", PURPLE, { outlineWidth: 2.5 }),
      r.readout("0.95 * [cos(phi + pi/3), sin(phi + pi/3)]", String.raw`120^\circ`, GREEN, { labelLatex: true, labelPlain: false, labelScale: 0.85 }),
      r.point("z0", SKY, { dragVars: ["R", "phi"] }),
      r.point("z1", GREEN),
      r.point("z2", PURPLE),
      mark(r, "z0 * (1 + 0.42/R)", "1", SKY, 1.1),
      mark(r, "z1 * (1 + 0.42/R)", String.raw`\omega`, GREEN, 1.1),
      mark(r, "z2 * (1 + 0.42/R)", String.raw`\omega^2`, PURPLE, 1.1),
      ...notes(r, 5.3, 2.4, 0.8, [
        [String.raw`z^3 = 1`, GREEN],
        [String.raw`\omega = e^{2\pi i/3} = -\tfrac12 + \tfrac{\sqrt3}{2}\,i`, GREEN],
        [String.raw`\omega^2 = \bar{\omega} = -\tfrac12 - \tfrac{\sqrt3}{2}\,i`, PURPLE],
        [String.raw`1 + \omega + \omega^2 = 0`, SKY],
        [String.raw`\omega \cdot \omega^2 = \omega^3 = 1`, AMBER],
        [String.raw`\text{Drag the blue point}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("R", "Radius R", 2, [0.6, 2.6, 0.05], "Radius of the circle. Drag the blue root.", "cube"),
      sceneSlider("phi", "Rotation angle φ", 0, [0, TAU, 0.02], "Turns all three roots together. Drag the blue root round.", "cube"),
    ],
    groups: [sceneGroup("cube", "Cube Roots of Unity")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3.2, 8], y: [-3.3, 3.3] },
    axisComplexNotationY: true,
  };
}

// ─── Euler's formula ──────────────────────────────────────────────────────────

function eulerFormula(): ExampleScene {
  const r = sceneRows("euler");
  return {
    functions: [
      r.define("ang = theta + time"),
      r.define("phi = ang - 2*pi*floor(ang/(2*pi))"),
      // Not "z": inside a label that name means the label's own position.
      r.define("zc = R * exp(i * ang)"),
      r.define("re_z = real(zc)"),
      r.define("im_z = imag(zc)"),
      r.path("R * [cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[re_z, t * im_z]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.path("[t * re_z, im_z]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], [re_z, 0])", BLUE, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], [0, im_z])", RED, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], zc)", AMBER, { outlineWidth: 3 }),
      r.path("0.5 * [cos(t * phi), sin(t * phi)]", AMBER, [0, 1], { outlineWidth: 1.5 }),
      r.readout("0.85 * [cos(phi/2), sin(phi/2)]", String.raw`\theta`, AMBER, { labelLatex: true, labelPlain: false }),
      r.point("[re_z, 0]", BLUE),
      r.point("[0, im_z]", RED),
      r.point("zc", AMBER, { dragVars: ["R", "theta"] }),
      // Each label on the far side of its axis from the point, and e^(iθ) outside the circle.
      mark(r, "[re_z, im_z > 0 ? -0.36 : 0.36]", String.raw`\cos\theta`, BLUE),
      mark(r, "[re_z > 0 ? -0.62 : 0.62, im_z]", String.raw`i\sin\theta`, RED),
      mark(r, "zc * (1 + 0.5/R)", String.raw`e^{i\theta}`, AMBER, 1.1),
      ...notes(r, 5.6, 2.4, 0.8, [
        [String.raw`e^{i\theta} = \cos\theta + i\,\sin\theta`, AMBER],
        [String.raw`z = R\,e^{i\theta} = {{zc}}`, AMBER],
        [String.raw`\cos\theta = {{cos(phi)}}`, BLUE],
        [String.raw`\sin\theta = {{sin(phi)}}`, RED],
        [String.raw`\theta = {{phi}}\ \text{rad} = {{phi*180/pi:0}}^\circ`, TEXT],
        [String.raw`|z| = R = {{R}}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("R", "Radius |z|", 2.2, [0.5, 3, 0.05], "Magnitude of the complex number. Drag the point.", "euler"),
      sceneSlider("theta", "Angle θ (rad)", 1.05, [0, TAU, 0.02], "Phase angle / argument. Drag the point round.", "euler"),
    ],
    groups: [sceneGroup("euler", "Complex Phasor")],
    timeline: { mode: "loop", min: 0, max: TAU, speed: 0.5 },
    view: { x: [-3.4, 8.2], y: [-3.4, 3.4] },
    axisComplexNotationY: true,
  };
}

// ─── Euler's identity ─────────────────────────────────────────────────────────

function eulerIdentity(): ExampleScene {
  const r = sceneRows("eident");
  return {
    functions: [
      r.define("theta = time > 0.01 ? min(time, pi) : th"),
      r.define("ez = exp(i * theta)"),
      r.define("P = [cos(theta), sin(theta)]"),
      r.path("[cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      // How far e^(iθ) has come from 1.
      r.path("[cos(t * theta), sin(t * theta)]", PINK, [0, 1], { outlineWidth: 3.5 }),
      r.arrow("Vector([0, 0], P)", PINK, { outlineWidth: 2.5 }),
      // The "+ 1" that carries −1 back to 0.
      r.arrow("Vector([-1, -0.12], [0, -0.12])", AMBER, { outlineWidth: 3 }),
      r.readout("[-0.5, -0.3]", "+1", AMBER, { labelLatex: true, labelPlain: false, labelScale: 0.9 }),
      r.point("[1, 0]", SKY, tex(String.raw`e^{0} = 1`, [0.32, 0.14])),
      r.point("[0, 1]", PURPLE, tex(String.raw`e^{i\pi/2} = i`, [0.3, 0.16])),
      r.point("[-1, 0]", RED, tex(String.raw`e^{i\pi} = -1`, [-0.45, 0.16])),
      r.point("P", PINK, { dragVars: ["th"] }),
      ...notes(r, 3.15, 1.05, 0.36, [
        [String.raw`e^{i\pi} + 1 = 0`, PINK],
        [String.raw`e^{i\theta} = {{ez}}`, PINK],
        [String.raw`\theta = {{theta}}\ \text{rad} = {{theta*180/pi:0}}^\circ`, TEXT],
        [String.raw`\text{at } \theta = \pi:\quad e^{i\pi} = -1`, RED],
        [String.raw`\text{add } 1:\quad -1 + 1 = 0`, AMBER],
        [String.raw`\text{five constants: } e,\ i,\ \pi,\ 1,\ 0`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("th", "Angle θ (rad)", Math.PI, [0, Math.PI, 0.02], "Sweep e^(iθ) from 1 to −1 along the circle, or press Play.", "euler_id"),
    ],
    groups: [sceneGroup("euler_id", "Euler's Identity")],
    timeline: { mode: "loop", min: 0, max: Math.PI + 1.2, speed: 0.6 },
    view: { x: [-1.7, 4.6], y: [-1.5, 1.5] },
    axisComplexNotationY: true,
  };
}

// ─── De Moivre's theorem ──────────────────────────────────────────────────────

function deMoivre(): ExampleScene {
  const r = sceneRows("demoivre");
  const power = (k: number, color: string) =>
    [
      r.point(`n >= ${k} ? r0^${k} * exp(i * ${k}*theta) : [NaN, NaN]`, color),
      mark(r, `n >= ${k} ? (r0^${k} + 0.3) * exp(i * ${k}*theta) : [NaN, NaN]`, `z^${k}`, color),
    ];
  return {
    functions: [
      r.define("z1 = r0 * exp(i * theta)"),
      r.define("zn = r0^n * exp(i * n*theta)"),
      r.path("[cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      // Every power lies on this spiral: (r^t) e^(i t θ).
      r.path("(r0^(t*n)) * [cos(t*n*theta), sin(t*n*theta)]", INDIGO, [0, 1], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.path("0.45 * [cos(t * theta), sin(t * theta)]", SKY, [0, 1], { outlineWidth: 1.5 }),
      r.path("0.7 * [cos(t * n * theta), sin(t * n * theta)]", RED, [0, 1], { outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], z1)", SKY, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], zn)", RED, { outlineWidth: 3 }),
      r.point("[1, 0]", INK, tex("1", [0.2, -0.3])),
      ...power(2, GREEN),
      ...power(3, AMBER),
      ...power(4, PURPLE),
      ...power(5, PINK),
      r.point("z1", SKY, { dragVars: ["r0", "theta"] }),
      mark(r, "(r0 + 0.3) * exp(i * theta)", "z", SKY),
      ...notes(r, 4.9, 1.75, 0.58, [
        [String.raw`(\cos\theta + i\sin\theta)^n = \cos n\theta + i\sin n\theta`, RED],
        [String.raw`z = {{z1}}`, SKY],
        [String.raw`z^{{{n:0}}} = {{zn}}`, RED],
        [String.raw`|z^n| = r^n = {{r0^n}}`, TEXT],
        [String.raw`\arg z^n = n\theta = {{n:0}} \times {{theta*180/pi:0}}^\circ = {{n*theta*180/pi:0}}^\circ`, TEXT],
        [String.raw`\text{lengths: power } n \qquad \text{angles: times } n`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("n", "Power n", 3, [1, 5, 1], "Exponent in zⁿ.", "demoivre"),
      sceneSlider("theta", "Angle θ (rad)", 0.7, [0, TAU, 0.02], "Angle of z. Drag the blue point.", "demoivre"),
      sceneSlider("r0", "Radius r", 1.08, [0.8, 1.15, 0.01], "Length of z. At 1 every power stays on the unit circle.", "demoivre"),
    ],
    groups: [sceneGroup("demoivre", "De Moivre Powers")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-2.4, 7.6], y: [-2.4, 2.4] },
    axisComplexNotationY: true,
  };
}

// ─── Roots of unity ───────────────────────────────────────────────────────────

function rootsOfUnity(): ExampleScene {
  const r = sceneRows("roots");
  const root = (k: number, color: string) =>
    [r.point(`z0 * w^${k}`, color), mark(r, `z0 * w^${k} * (1 + 0.42/R)`, `z_${k}`, color)];
  return {
    functions: [
      r.define("w = exp(i * 2*pi / 6)"),
      r.define("z0 = R * exp(i * phi)"),
      r.path("R * [cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      // The six roots, and the cube roots among them.
      r.shape("[z0, z0*w, z0*w^2, z0*w^3, z0*w^4, z0*w^5]", PURPLE, { fillOpacity: 0.12, outlineWidth: 2, showAngles: false }),
      r.shape("[z0, z0*w^2, z0*w^4]", AMBER, { fillOpacity: 0.16, outlineWidth: 2, showAngles: false }),
      r.path("0.55 * [cos(phi + t), sin(phi + t)]", PURPLE, [0, TAU / 6], { outlineWidth: 1.5 }),
      r.readout("0.9 * [cos(phi + pi/6), sin(phi + pi/6)]", String.raw`60^\circ`, PURPLE, { labelLatex: true, labelPlain: false, labelScale: 0.8 }),
      r.arrow("Vector([0, 0], z0)", PURPLE, { outlineWidth: 2 }),
      r.arrow("Vector([0, 0], z0 * w)", PURPLE, { outlineWidth: 1.5 }),
      ...root(1, PURPLE),
      ...root(2, AMBER),
      ...root(3, PURPLE),
      ...root(4, AMBER),
      ...root(5, PURPLE),
      r.point("z0", AMBER, { dragVars: ["R", "phi"] }),
      mark(r, "z0 * (1 + 0.42/R)", "z_0", AMBER),
      ...notes(r, 5.6, 2.2, 0.8, [
        [String.raw`z^6 = 1`, PURPLE],
        [String.raw`z_k = e^{2\pi i k/6}, \quad k = 0, \dots, 5`, PURPLE],
        [String.raw`z_0 + z_1 + \dots + z_5 = 0`, TEXT],
        [String.raw`z_0,\ z_2,\ z_4:\ \text{the cube roots}`, AMBER],
        [String.raw`z_3 = -z_0`, TEXT],
        [String.raw`\text{Drag } z_0`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("R", "Radius R", 2.2, [0.8, 2.8, 0.05], "Radius of the circle. Drag z₀.", "roots"),
      sceneSlider("phi", "Rotation angle φ", 0, [0, TAU, 0.02], "Turns every root together. Drag z₀ round.", "roots"),
    ],
    groups: [sceneGroup("roots", "Roots of Unity")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3.3, 8.3], y: [-3.3, 3.3] },
    axisComplexNotationY: true,
  };
}

// ─── Complex multiplication ───────────────────────────────────────────────────

function complexMultiplication(): ExampleScene {
  const r = sceneRows("cmul");
  return {
    functions: [
      r.define("z1 = r1 * exp(i * th1)"),
      r.define("z2 = r2 * exp(i * th2)"),
      r.define("z3 = z1 * z2"),
      r.define("r3 = r1 * r2"),
      r.define("th3 = th1 + th2"),
      r.path("[cos(t), sin(t)]", INK, [0, TAU], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("0.5 * [cos(t * th1), sin(t * th1)]", SKY, [0, 1], { outlineWidth: 1.5 }),
      r.path("0.75 * [cos(t * th2), sin(t * th2)]", AMBER, [0, 1], { outlineWidth: 1.5 }),
      r.path("1.0 * [cos(t * th3), sin(t * th3)]", PURPLE, [0, 1], { outlineWidth: 1.5 }),
      r.arrow("Vector([0, 0], z1)", SKY, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], z2)", AMBER, { outlineWidth: 2.5 }),
      r.arrow("Vector([0, 0], z3)", PURPLE, { outlineWidth: 3 }),
      r.point("z1", SKY, { dragVars: ["r1", "th1"] }),
      r.point("z2", AMBER, { dragVars: ["r2", "th2"] }),
      r.point("z3", PURPLE),
      mark(r, "(r1 + 0.4) * exp(i * th1)", "z_1", SKY, 1.1),
      mark(r, "(r2 + 0.4) * exp(i * th2)", "z_2", AMBER, 1.1),
      mark(r, "(r3 + 0.55) * exp(i * th3)", "z_1 z_2", PURPLE, 1.1),
      ...notes(r, 6.6, 2.7, 0.9, [
        [String.raw`\text{lengths multiply, angles add}`, PURPLE],
        [String.raw`z_1 = {{z1}}`, SKY],
        [String.raw`z_2 = {{z2}}`, AMBER],
        [String.raw`z_1 z_2 = {{z3}}`, PURPLE],
        [String.raw`|z_1|\,|z_2| = {{r1}} \times {{r2}} = {{r3}}`, TEXT],
        [String.raw`\theta_1 + \theta_2 = {{th1*180/pi:0}}^\circ + {{th2*180/pi:0}}^\circ = {{th3*180/pi:0}}^\circ`, TEXT],
        [String.raw`\text{Drag } z_1 \text{ or } z_2`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("r1", "Length |z₁|", 1.5, [0.3, 2, 0.05], "Magnitude of z₁. Drag the blue point.", "mult"),
      sceneSlider("th1", "Angle θ₁ (rad)", 0.65, [0, TAU, 0.02], "Argument of z₁. Drag the blue point.", "mult"),
      sceneSlider("r2", "Length |z₂|", 1.4, [0.3, 2, 0.05], "Magnitude of z₂. Drag the amber point.", "mult"),
      sceneSlider("th2", "Angle θ₂ (rad)", 1.15, [0, TAU, 0.02], "Argument of z₂. Drag the amber point.", "mult"),
    ],
    groups: [sceneGroup("mult", "Multiplication Factors")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4.1, 10], y: [-4.1, 4.1] },
    axisComplexNotationY: true,
  };
}

// ─── Euler's formula for polyhedra ────────────────────────────────────────────

function eulerPolyhedra(): ExampleScene {
  const r = sceneRows("poly");
  const edge = (a: string, b: string, color: string) => r.path(`${a} + t*(${b} - ${a})`, color, [0, 1], { outlineWidth: 2 });
  const corner = (name: string, color: string, extra: Partial<MathFunction> = {}) =>
    [r.point(name, color, extra), mark(r, `${name} * (1 + 0.3/sqrt(${name}[1]^2 + ${name}[2]^2 + 0.01))`, `v_${name.slice(1)}`, color, 0.85)];
  return {
    functions: [
      // A cube seen from (yaw, pitch); it tumbles gently while the clock runs.
      r.define("yaw = yaw0 + 0.7 * time"),
      r.define("pitch = pitch0 + 0.2 * sin(0.8 * time)"),
      r.define("cy = cos(yaw)"),
      r.define("sy = sin(yaw)"),
      r.define("cp = cos(pitch)"),
      r.define("sp = sin(pitch)"),
      r.define("v1 = S * [-cy + sy, -cp - (-sy - cy)*sp]"),
      r.define("v2 = S * [ cy + sy, -cp - ( sy - cy)*sp]"),
      r.define("v3 = S * [ cy - sy, -cp - ( sy + cy)*sp]"),
      r.define("v4 = S * [-cy - sy, -cp - (-sy + cy)*sp]"),
      r.define("v5 = S * [-cy + sy,  cp - (-sy - cy)*sp]"),
      r.define("v6 = S * [ cy + sy,  cp - ( sy - cy)*sp]"),
      r.define("v7 = S * [ cy - sy,  cp - ( sy + cy)*sp]"),
      r.define("v8 = S * [-cy - sy,  cp - (-sy + cy)*sp]"),
      // 6 faces
      r.shape("[v1, v2, v3, v4]", INDIGO, { fillOpacity: 0.14, outlineWidth: 0, showAngles: false }),
      r.shape("[v5, v6, v7, v8]", SKY, { fillOpacity: 0.16, outlineWidth: 0, showAngles: false }),
      r.shape("[v1, v2, v6, v5]", BLUE, { fillOpacity: 0.1, outlineWidth: 0, showAngles: false }),
      r.shape("[v2, v3, v7, v6]", PURPLE, { fillOpacity: 0.1, outlineWidth: 0, showAngles: false }),
      r.shape("[v3, v4, v8, v7]", BLUE, { fillOpacity: 0.1, outlineWidth: 0, showAngles: false }),
      r.shape("[v4, v1, v5, v8]", PURPLE, { fillOpacity: 0.1, outlineWidth: 0, showAngles: false }),
      // 12 edges
      edge("v1", "v2", INDIGO), edge("v2", "v3", INDIGO), edge("v3", "v4", INDIGO), edge("v4", "v1", INDIGO),
      edge("v5", "v6", SKY), edge("v6", "v7", SKY), edge("v7", "v8", SKY), edge("v8", "v5", SKY),
      edge("v1", "v5", PURPLE), edge("v2", "v6", PURPLE), edge("v3", "v7", PURPLE), edge("v4", "v8", PURPLE),
      // 8 vertices
      ...corner("v1", INDIGO), ...corner("v2", INDIGO), ...corner("v3", INDIGO), ...corner("v4", INDIGO),
      ...corner("v5", SKY), ...corner("v6", SKY), ...corner("v8", SKY),
      ...corner("v7", PINK, { dragVars: ["yaw0", "pitch0"] }),
      ...notes(r, 6.3, 2.6, 0.82, [
        [String.raw`V - E + F = 2`, INDIGO],
        [String.raw`\text{Cube: } 8 - 12 + 6 = 2`, SKY],
        [String.raw`\text{Tetrahedron: } 4 - 6 + 4 = 2`, TEXT],
        [String.raw`\text{Octahedron: } 6 - 12 + 8 = 2`, TEXT],
        [String.raw`\text{Dodecahedron: } 20 - 30 + 12 = 2`, TEXT],
        [String.raw`\text{Icosahedron: } 12 - 30 + 20 = 2`, TEXT],
        [String.raw`\text{Drag the pink corner to turn it}`, PINK],
      ], false),
    ],
    variables: [
      sceneSlider("yaw0", "Turn", 0.65, [-3.14, 3.14, 0.02], "Turn the cube about its upright axis. Or drag the pink corner.", "poly"),
      sceneSlider("pitch0", "Tilt", 0.45, [-1.5, 1.5, 0.02], "Tilt the cube towards you. Or drag the pink corner.", "poly"),
      sceneSlider("S", "Size", 1.4, [0.8, 1.8, 0.05], "How big the cube is drawn.", "poly"),
    ],
    groups: [sceneGroup("poly", "Euler's Polyhedron (V − E + F = 2)")],
    timeline: { mode: "loop", min: 0, max: 10 * TAU, speed: 0.5 },
    view: { x: [-3.8, 9.6], y: [-3.8, 3.8] },
    gridType: "none",
  };
}

// ─── The same ideas in space (loaded while the graph is in 3D) ────────────────

/** e^(iθ) as a helix: θ runs up the z-axis; its shadows on the walls are cos and sin. */
function eulerFormula3D(): ExampleScene {
  const r = sceneRows("euler3");
  const H = "(2*a/pi - 2.4)"; // height of angle a: two turns fill the box
  const h = (a: string) => H.replace("a", a);
  return {
    functions: [
      r.define("ang = mod(theta + time, 4*pi)"),
      r.define(`zh = ${h("ang")}`),
      r.define("px = R*cos(ang)"),
      r.define("py = R*sin(ang)"),
      // The helix, and its shadows: a cosine on the back wall, a sine on the side wall.
      r.path(`[R*cos(t), R*sin(t), ${h("t")}]`, AMBER, [0, 2 * TAU], { outlineWidth: 3.5 }),
      r.path(`[R*cos(t), W, ${h("t")}]`, BLUE, [0, 2 * TAU], { outlineWidth: 2 }),
      r.path(`[-W, R*sin(t), ${h("t")}]`, RED, [0, 2 * TAU], { outlineWidth: 2 }),
      r.path("[R*cos(t), R*sin(t), -3]", INK, [0, TAU], { outlineWidth: 1.5, lineStyle: "dashed" }),
      // From the moving point to each shadow, and down to the circle on the floor.
      r.path("[px, py + t*(W - py), zh]", BLUE, [0, 1], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.path("[px + t*(-W - px), py, zh]", RED, [0, 1], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.path("[px, py, zh + t*(-3 - zh)]", INK, [0, 1], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.arrow("Vector([0, 0, zh], [px, py, zh])", AMBER, { outlineWidth: 3 }),
      spacePoint(r, "[px, py, zh]", AMBER, tex(String.raw`e^{i\theta}`)),
      spacePoint(r, "[px, W, zh]", BLUE, tex(String.raw`\cos\theta`)),
      spacePoint(r, "[-W, py, zh]", RED, tex(String.raw`\sin\theta`)),
      spacePoint(r, "[px, py, -3]", INK),
      ...notes3(r, [3, -3], 2.9, 0.5, [
        [String.raw`e^{i\theta} = \cos\theta + i\,\sin\theta`, AMBER],
        [String.raw`\theta = {{ang}}\ \text{rad}`, TEXT],
        [String.raw`\cos\theta = {{cos(ang)}}`, BLUE],
        [String.raw`\sin\theta = {{sin(ang)}}`, RED],
      ]),
    ],
    variables: [
      sceneSlider("R", "Radius |z|", 1.6, [0.5, 2.2, 0.05], "Radius of the helix.", "euler"),
      sceneSlider("theta", "Angle θ (rad)", 1.05, [0, 2 * TAU, 0.02], "Where on the helix the point starts.", "euler"),
      sceneSlider("W", "Wall distance", 3, [2.4, 3, 0.05], "How far away the walls with the cos and sin shadows are.", "euler"),
    ],
    groups: [sceneGroup("euler", "Helix of e^(iθ): height is θ")],
    timeline: { mode: "loop", min: 0, max: 2 * TAU, speed: 0.6 },
    view: { x: [-3, 3], y: [-3, 3] },
  };
}

/** e^(iθ) climbing half a turn from 1 to −1, then the step +1 back to the axis. */
function eulerIdentity3D(): ExampleScene {
  const r = sceneRows("eident3");
  return {
    functions: [
      r.define("theta = time > 0.01 ? min(time, pi) : th"),
      r.define("ez = exp(i * theta)"),
      r.define("zh = 3*theta/pi - 1.5"),
      r.path("[1.6*cos(t), 1.6*sin(t), -1.5]", INK, [0, TAU], { outlineWidth: 1.5, lineStyle: "dashed" }),
      r.path("[1.6*cos(t), 1.6*sin(t), 3*t/pi - 1.5]", INK, [0, Math.PI], { outlineWidth: 1.5, lineStyle: "dotted" }),
      r.path("[1.6*cos(t*theta), 1.6*sin(t*theta), 3*t*theta/pi - 1.5]", PINK, [0, 1], { outlineWidth: 4 }),
      r.arrow("Vector([0, 0, zh], [1.6*cos(theta), 1.6*sin(theta), zh])", PINK, { outlineWidth: 2.5 }),
      r.arrow("Vector([-1.6, 0, 1.5], [0, 0, 1.5])", AMBER, { outlineWidth: 3 }),
      spacePoint(r, "[1.6, 0, -1.5]", SKY, tex(String.raw`e^{0} = 1`)),
      spacePoint(r, "[0, 1.6, 0]", PURPLE, tex(String.raw`e^{i\pi/2} = i`)),
      spacePoint(r, "[-1.6, 0, 1.5]", RED, tex(String.raw`e^{i\pi} = -1`)),
      spacePoint(r, "[0, 0, 1.5]", AMBER, tex(String.raw`-1 + 1 = 0`)),
      spacePoint(r, "[1.6*cos(theta), 1.6*sin(theta), zh]", PINK),
      ...notes3(r, [2, -2], 1.9, 0.36, [
        [String.raw`e^{i\pi} + 1 = 0`, PINK],
        [String.raw`e^{i\theta} = {{ez}}`, PINK],
        [String.raw`\theta = {{theta*180/pi:0}}^\circ \ \text{(height)}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("th", "Angle θ (rad)", Math.PI, [0, Math.PI, 0.02], "Climb from 1 to −1, or press Play.", "euler_id"),
    ],
    groups: [sceneGroup("euler_id", "Euler's Identity: height is θ")],
    timeline: { mode: "loop", min: 0, max: Math.PI + 1.2, speed: 0.6 },
    view: { x: [-2, 2], y: [-2, 2] },
  };
}

/** The powers of z as a spiral staircase: zᵏ stands at height k. */
function deMoivre3D(): ExampleScene {
  const r = sceneRows("demoivre3");
  const h = (k: string) => `(0.8*${k} - 2)`;
  const COLORS_K = [SKY, GREEN, AMBER, PURPLE, PINK];
  const steps = [1, 2, 3, 4, 5].flatMap((k) => {
    const x = `r0^${k}*cos(${k}*theta)`;
    const y = `r0^${k}*sin(${k}*theta)`;
    const z = `(n >= ${k} ? ${h(String(k))} : NaN)`;
    return [
      r.arrow(`Vector([0, 0, ${z}], [${x}, ${y}, ${z}])`, COLORS_K[k - 1], { outlineWidth: 2.5 }),
      spacePoint(r, `[${x}, ${y}, ${z}]`, COLORS_K[k - 1], tex(k === 1 ? "z" : `z^${k}`)),
    ];
  });
  return {
    functions: [
      r.path(`[cos(t), sin(t), -2]`, INK, [0, TAU], { outlineWidth: 1.5, lineStyle: "dashed" }),
      // Every power lies on this spiral.
      r.path(`[r0^(t*n)*cos(t*n*theta), r0^(t*n)*sin(t*n*theta), ${h("(t*n)")}]`, INDIGO, [0, 1], { outlineWidth: 2.5 }),
      r.path(`[0, 0, -2 + t*(${h("n")} + 2)]`, INK, [0, 1], { outlineWidth: 1.5 }),
      spacePoint(r, "[1, 0, -2]", INK, tex("1")),
      ...steps,
      ...notes3(r, [2.5, -2.5], 2.4, 0.42, [
        [String.raw`z^n = r^n e^{i n\theta}`, RED],
        [String.raw`z^k \text{ stands at height } k`, TEXT],
        [String.raw`\text{each step turns by } \theta = {{theta*180/pi:0}}^\circ`, SKY],
        [String.raw`|z^n| = {{r0^n}} \qquad \arg z^n = {{n*theta*180/pi:0}}^\circ`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("n", "Power n", 5, [1, 5, 1], "How many powers to climb.", "demoivre"),
      sceneSlider("theta", "Angle θ (rad)", 0.9, [0, TAU, 0.02], "The turn between one power and the next.", "demoivre"),
      sceneSlider("r0", "Radius r", 1.08, [0.8, 1.15, 0.01], "Length of z. Above 1 the staircase widens as it climbs.", "demoivre"),
    ],
    groups: [sceneGroup("demoivre", "De Moivre: a spiral staircase")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-2.5, 2.5], y: [-2.5, 2.5] },
  };
}

/** |zⁿ − 1| as a landscape over the complex plane: it touches the floor at the roots. */
function rootsLandscape(prefix: string, n: number, title: string): ExampleScene {
  const r = sceneRows(prefix);
  const COLORS_K = [SKY, GREEN, PURPLE, AMBER, PINK, RED, INDIGO, BLUE];
  return {
    functions: [
      surface(r, "z = abs((x + i*y)^n - 1) - 1.8", PURPLE, { fillOpacity: 0.8 }),
      r.path("[cos(t), sin(t), -1.8]", INK, [0, TAU], { outlineWidth: 2, lineStyle: "dashed" }),
      // One marker per root; those beyond n are left out.
      ...COLORS_K.map((color, k) =>
        spacePoint(r, `[cos(2*pi*${k}/n), sin(2*pi*${k}/n), n > ${k} ? -1.8 : NaN]`, color, tex(k === 0 ? "1" : `z_${k}`)),
      ),
      ...notes3(r, [1.8, -1.8], 1.75, 0.34, [
        [String.raw`\text{height} = |z^n - 1|`, PURPLE],
        [String.raw`\text{it touches the floor where } z^n = 1`, TEXT],
        [String.raw`n = {{n:0}} \text{ roots, } {{360/n:0}}^\circ \text{ apart}`, AMBER],
      ]),
    ],
    variables: [
      sceneSlider("n", "Roots n", n, [2, 8, 1], "zⁿ = 1 has n roots, evenly spaced on the unit circle.", "roots"),
    ],
    groups: [sceneGroup("roots", title)],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-1.8, 1.8], y: [-1.8, 1.8] },
    view3d: { colorMode: "height", contours: true },
  };
}

/** Multiplying on the spiral ramp of the argument: heights (angles) add. */
function complexMultiplication3D(): ExampleScene {
  const r = sceneRows("cmul3");
  const h = (a: string) => `(${a}/pi*2 - 2)`; // angle 0..2π → height −2..2
  const at = (rho: string, th: string) => `[${rho}*cos(${th}), ${rho}*sin(${th}), ${h(th)}]`;
  return {
    functions: [
      r.define("r3 = r1 * r2"),
      r.define("th3 = th1 + th2"),
      // The ramp: a point at angle u sits at height u.
      { ...r.define(`[(0.15 + 0.45*v)*cos(u), (0.15 + 0.45*v)*sin(u), ${h("u")}]`), color: INK, fillOpacity: 0.35 },
      r.arrow(`Vector([0, 0, ${h("th1")}], ${at("r1", "th1")})`, SKY, { outlineWidth: 3 }),
      r.arrow(`Vector([0, 0, ${h("th2")}], ${at("r2", "th2")})`, AMBER, { outlineWidth: 3 }),
      r.arrow(`Vector([0, 0, ${h("th3")}], ${at("r3", "th3")})`, PURPLE, { outlineWidth: 3.5 }),
      spacePoint(r, at("r1", "th1"), SKY, tex("z_1")),
      spacePoint(r, at("r2", "th2"), AMBER, tex("z_2")),
      spacePoint(r, at("r3", "th3"), PURPLE, tex("z_1 z_2")),
      ...notes3(r, [3, -3], 2.9, 0.5, [
        [String.raw`\text{angles add: heights add}`, PURPLE],
        [String.raw`\theta_1 + \theta_2 = {{th1*180/pi:0}}^\circ + {{th2*180/pi:0}}^\circ = {{th3*180/pi:0}}^\circ`, TEXT],
        [String.raw`|z_1|\,|z_2| = {{r1}} \times {{r2}} = {{r3}}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("r1", "Length |z₁|", 1.5, [0.3, 1.7, 0.05], "Magnitude of z₁.", "mult"),
      sceneSlider("th1", "Angle θ₁ (rad)", 1.1, [0, Math.PI, 0.02], "Argument of z₁: its height on the ramp.", "mult"),
      sceneSlider("r2", "Length |z₂|", 1.4, [0.3, 1.7, 0.05], "Magnitude of z₂.", "mult"),
      sceneSlider("th2", "Angle θ₂ (rad)", 1.9, [0, Math.PI, 0.02], "Argument of z₂: its height on the ramp.", "mult"),
    ],
    groups: [sceneGroup("mult", "Multiplication on the ramp of angles")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3, 3], y: [-3, 3] },
  };
}

/** A real cube: turn it and count 8 corners, 12 edges, 6 faces. */
function eulerPolyhedra3D(): ExampleScene {
  const r = sceneRows("poly3");
  const P: [number, number, number][] = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ];
  const v = (i: number) => `S*[${P[i].join(", ")}]`;
  const face = (ids: number[], color: string) =>
    r.shape(`S*[${ids.map((i) => `[${P[i].join(", ")}]`).join(", ")}]`, color, { fillOpacity: 0.22, outlineWidth: 3, showAngles: false });
  return {
    functions: [
      face([0, 1, 2, 3], INDIGO),
      face([4, 5, 6, 7], SKY),
      face([0, 1, 5, 4], BLUE),
      face([1, 2, 6, 5], PURPLE),
      face([2, 3, 7, 6], BLUE),
      face([3, 0, 4, 7], PURPLE),
      ...P.map((_, i) => spacePoint(r, v(i), i < 4 ? INDIGO : SKY, tex(`v_${i + 1}`))),
      ...notes3(r, [3, -3], 2.9, 0.5, [
        [String.raw`V - E + F = 2`, INDIGO],
        [String.raw`\text{Cube: } 8 - 12 + 6 = 2`, SKY],
        [String.raw`\text{Drag to turn it and count}`, TEXT],
      ]),
    ],
    variables: [sceneSlider("S", "Size", 1.5, [0.6, 2.2, 0.05], "Half the length of an edge.", "poly")],
    groups: [sceneGroup("poly", "Euler's Polyhedron (V − E + F = 2)")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3, 3], y: [-3, 3] },
    view3d: { autoRotate: true },
  };
}

/** The Lorenz butterfly as it really is: a curve in (x, y, z). */
function lorenz3D(): ExampleScene {
  const r = sceneRows("lorenz3");
  return {
    functions: [
      // w = z − 25, so the butterfly sits in the middle of the box.
      r.ode("x' = s*(y - x); y' = x*(r - 25 - w) - y; w' = x*y - b*(w + 25); x(0) = 1; y(0) = 1; w(0) = -24", PINK, {
        tRange: [0, 40],
        odeSteps: 5000,
        odeAxes: ["x", "y"],
        outlineWidth: 1.5,
      }),
      ...notes3(r, [28, -28], 27, 4.6, [
        [String.raw`\dot x = \sigma(y - x), \quad \dot y = x(\rho - z) - y, \quad \dot z = xy - \beta z`, PINK],
        [String.raw`\text{height shown is } z - 25`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("s", "Sigma σ", 10, [0, 20, 0.5], "Prandtl number."),
      sceneSlider("r", "Rho ρ", 28, [0, 50, 0.5], "Rayleigh number (28 is chaotic)."),
      sceneSlider("b", "Beta β", 2.667, [0, 5, 0.05], "Geometry factor."),
    ],
    timeline: { mode: "loop", min: 0, max: 40, speed: 1 },
    view: { x: [-28, 28], y: [-28, 28] },
    view3d: { autoRotate: true },
  };
}

/** Three perpendicular oscillations: a Lissajous knot. */
function lissajous3D(): ExampleScene {
  const r = sceneRows("liss3");
  return {
    functions: [
      r.path("[A*sin(a*t + d + time), A*sin(b*t), A*sin(c*t)]", COLORS[0], [0, TAU], { outlineWidth: 3 }),
      // Its three shadows are ordinary Lissajous curves.
      r.path("[A*sin(a*t + d + time), A*sin(b*t), -4]", INK, [0, TAU], { outlineWidth: 1.5 }),
      r.path("[A*sin(a*t + d + time), 4, A*sin(c*t)]", INK, [0, TAU], { outlineWidth: 1.5 }),
      r.path("[-4, A*sin(b*t), A*sin(c*t)]", INK, [0, TAU], { outlineWidth: 1.5 }),
    ],
    variables: [
      sceneSlider("A", "Amplitude", 2.8, [0.5, 3.6, 0.1], "Size of all three oscillations."),
      sceneSlider("a", "Freq X", 3, [1, 7, 1], "Oscillations along x."),
      sceneSlider("b", "Freq Y", 4, [1, 7, 1], "Oscillations along y."),
      sceneSlider("c", "Freq Z", 5, [1, 7, 1], "Oscillations along z."),
      sceneSlider("d", "Phase", Math.PI / 2, [0, TAU, 0.1], "Phase of the x oscillation."),
    ],
    timeline: { mode: "continuous", min: 0, max: 10, speed: 0.4, autoplay: true },
    view: { x: [-4, 4], y: [-4, 4] },
  };
}

/** A wave on water: rings spreading from the middle. */
function wave3D(): ExampleScene {
  const r = sceneRows("wave3");
  return {
    functions: [
      r.define("lam = 2*pi/k"),
      surface(r, "z = A*sin(k*sqrt(x^2 + y^2) - w*time) / (1 + 0.12*sqrt(x^2 + y^2))", SKY),
      ...notes3(r, [6, -6], 5.4, 0.9, [
        [String.raw`z = A\sin(kr - \omega t)`, SKY],
        [String.raw`\lambda = 2\pi/k = {{lam}} \qquad v = \omega/k = {{w/k}}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("A", "Amplitude A", 1.2, [0.2, 2.5, 0.05], "Height of the crests.", "wave"),
      sceneSlider("k", "Wave number k", 2, [0.5, 4, 0.05], "λ = 2π/k: bigger k packs the rings closer.", "wave"),
      sceneSlider("w", "Angular frequency ω", 3, [0.5, 8, 0.1], "Faster shaking: the rings travel faster.", "wave"),
    ],
    groups: [sceneGroup("wave", "Wave")],
    timeline: { mode: "loop", min: 0, max: 10, endExpr: "8*pi/w" },
    view: { x: [-6, 6], y: [-6, 6] },
    view3d: { colorMode: "height" },
  };
}

/** The bell curve in two variables: a hill whose spread is σ. */
function normalDistribution3D(): ExampleScene {
  const r = sceneRows("norm3");
  return {
    functions: [
      surface(r, "z = 4*exp(-0.5*(((x - mu)^2 + y^2)/sigma^2)) - 2", PURPLE),
      // One standard deviation out, on the floor.
      r.path("[mu + sigma*cos(t), sigma*sin(t), -2]", AMBER, [0, TAU], { outlineWidth: 2.5 }),
      r.path("[mu + 2*sigma*cos(t), 2*sigma*sin(t), -2]", AMBER, [0, TAU], { outlineWidth: 1.5, lineStyle: "dashed" }),
      ...notes3(r, [3, -3], 2.9, 0.5, [
        [String.raw`f(x, y) \propto e^{-\frac{(x-\mu)^2 + y^2}{2\sigma^2}}`, PURPLE],
        [String.raw`\text{rings: } 1\sigma \text{ and } 2\sigma \text{ from the mean}`, AMBER],
        [String.raw`\mu = {{mu}} \qquad \sigma = {{sigma}}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("mu", "Mean μ", 0, [-1.5, 1.5, 0.05], "Where the hill stands.", "shape"),
      sceneSlider("sigma", "Standard deviation σ", 0.9, [0.3, 1.6, 0.01], "How widely it spreads.", "shape"),
    ],
    groups: [sceneGroup("shape", "Shape")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3, 3], y: [-3, 3] },
    view3d: { colorMode: "height", contours: true },
  };
}

// ─── Monge's theorem ──────────────────────────────────────────────────────────
//
// For three circles of different sizes, the outer tangents of each pair meet at a
// point (their external centre of similitude); the three points lie on one line.

/** Where the outer tangents of circles (P, rP) and (Q, rQ) meet. */
const outerCentre = (P: string, rP: string, Q: string, rQ: string) => `((${rQ}*${P} - ${rP}*${Q})/(${rQ} - ${rP}))`;

const MONGE_CIRCLES: { name: string; at: [number, number]; r: number; color: string }[] = [
  { name: "A", at: [-4, 0], r: 2, color: BLUE },
  { name: "B", at: [0, 2], r: 1.2, color: GREEN },
  { name: "C", at: [1, -2], r: 0.7, color: PURPLE },
];

/** Each pair of circles, with the name of its meeting point. */
const MONGE_PAIRS: [number, number, string][] = [
  [0, 1, "AB"],
  [1, 2, "BC"],
  [2, 0, "CA"],
];

function mongeTheorem(): ExampleScene {
  const r = sceneRows("monge");
  const rad = (i: number) => `r_${MONGE_CIRCLES[i].name}`;
  const E = (i: number, j: number) => outerCentre(MONGE_CIRCLES[i].name, rad(i), MONGE_CIRCLES[j].name, rad(j));
  const [e1, e2, e3] = MONGE_PAIRS.map(([i, j]) => E(i, j));
  return {
    functions: [
      // The direction of a tangent from E to the circle (P, r): s = 1 or −1 for each side.
      r.define("tdir(E, P, r, s) = [(P - E)[1]*cos(s*asin(r/norm(P - E))) - (P - E)[2]*sin(s*asin(r/norm(P - E))), (P - E)[1]*sin(s*asin(r/norm(P - E))) + (P - E)[2]*cos(s*asin(r/norm(P - E)))]/norm(P - E)"),
      // The centres first (drag them): before anything uses A, B, C, which mathjs
      // would otherwise read as units (ampere, byte, coulomb).
      ...MONGE_CIRCLES.map((c) => r.point(`${c.name} = [${c.at[0]}, ${c.at[1]}]`, c.color, { isDraggable: true, ...tex(c.name, [0.25, 0.3]) })),
      ...MONGE_CIRCLES.map((c, i) =>
        r.path(`${c.name} + ${rad(i)}*[cos(t), sin(t)]`, c.color, [0, TAU], { outlineWidth: 2.5, ...fill(c.color, 0.08) }),
      ),
      // Each pair's two outer tangents, from where they meet past both circles.
      ...MONGE_PAIRS.flatMap(([i, j]) =>
        [1, -1].map((s) =>
          r.path(`${E(i, j)} + t*tdir(${E(i, j)}, ${MONGE_CIRCLES[i].name}, ${rad(i)}, ${s})`, INK, [0, 30], { outlineWidth: 1.2 }),
        ),
      ),
      // The line they all lie on.
      r.path(`${e1} + t*(${e2} - ${e1})/norm(${e2} - ${e1})`, RED, [-60, 60], { outlineWidth: 2.5, lineStyle: "dashed" }),
      ...MONGE_PAIRS.map(([i, j, name]) => r.point(E(i, j), AMBER, tex(`E_{${name}}`, [0.3, 0.35]))),
      ...notes(r, -4, -4.6, 0.85, [
        [String.raw`\text{Monge's theorem}`, RED],
        [String.raw`\text{the outer tangents of each pair meet at } E`, TEXT],
        [String.raw`E_{AB}, E_{BC}, E_{CA} \text{ lie on one line}`, AMBER],
        [String.raw`E_{AB} = \dfrac{r_B\,A - r_A\,B}{r_B - r_A}`, TEXT],
        [String.raw`\text{area of } E_{AB}E_{BC}E_{CA} = {{abs((${e2} - ${e1})[1]*(${e3} - ${e1})[2] - (${e2} - ${e1})[2]*(${e3} - ${e1})[1])/2:4}}`, TEXT],
        [String.raw`\text{Drag the centres, change the radii}`, TEXT],
      ], false),
    ],
    variables: MONGE_CIRCLES.map((c, i) =>
      sceneSlider(rad(i), `Radius of ${c.name}`, c.r, [0.2, 3, 0.05], `Size of circle ${c.name}. Equal radii send its meeting points off to infinity.`, "monge"),
    ),
    groups: [sceneGroup("monge", "Three circles")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-9, 10], y: [-10.5, 7] },
  };
}

/**
 * The proof in space: stand a cone on each circle with its tip as high as the circle
 * is wide. The line through two tips meets the floor exactly at those two circles'
 * meeting point E. So every E lies on the plane through the three tips and on the
 * floor: on the line where those two planes cross.
 */
function mongeTheorem3D(): ExampleScene {
  const r = sceneRows("monge3");
  const rad = (i: number) => `r_${MONGE_CIRCLES[i].name}`;
  const P = (i: number) => `p3(${MONGE_CIRCLES[i].name})`;
  const tip = (i: number) => `(${P(i)} + [0, 0, ${rad(i)}])`;
  const E = (i: number, j: number) => outerCentre(P(i), rad(i), P(j), rad(j));
  const [e1, e2] = MONGE_PAIRS.map(([i, j]) => E(i, j));
  // u, v run 0 to 2π: the plane through the three tips, a little past them.
  const s = "(u/pi*1.6 - 0.6)";
  const w = "(v/pi*1.6 - 0.6)";
  return {
    functions: [
      // As in 2D: the direction of a tangent from E to the circle (P, r), here laid on
      // the floor (s = 1 or −1 for each side).
      r.define("tdir(E, P, r, s) = [(P - E)[1]*cos(s*asin(r/norm(P - E))) - (P - E)[2]*sin(s*asin(r/norm(P - E))), (P - E)[1]*sin(s*asin(r/norm(P - E))) + (P - E)[2]*cos(s*asin(r/norm(P - E)))]/norm(P - E)"),
      r.define("tfloor(E, P, r, s) = [tdir(E, P, r, s)[1], tdir(E, P, r, s)[2], 0]"),
      // The centres first, so A, B, C are never read as units.
      ...MONGE_CIRCLES.map((c) => r.point(`${c.name} = [${c.at[0]}, ${c.at[1]}]`, c.color, { isDraggable: true, ...tex(c.name) })),
      ...MONGE_CIRCLES.flatMap((c, i) => [
        r.path(`${P(i)} + ${rad(i)}*[cos(t), sin(t), 0]`, c.color, [0, TAU], { outlineWidth: 3 }),
        // A cone as tall as the circle is wide.
        { ...r.define(`(1 - v/(2*pi))*(${P(i)} + ${rad(i)}*[cos(u), sin(u), 0]) + (v/(2*pi))*${tip(i)}`), color: c.color, fillColor: c.color, fillOpacity: 0.35 },
        spacePoint(r, tip(i), c.color),
      ]),
      // The plane through the three tips.
      { ...r.define(`${tip(0)} + ${s}*(${tip(1)} - ${tip(0)}) + ${w}*(${tip(2)} - ${tip(0)})`), color: AMBER, fillColor: AMBER, fillOpacity: 0.16 },
      // The 2D picture on the floor: each pair's two outer tangents, meeting at E.
      ...MONGE_PAIRS.flatMap(([i, j]) =>
        [1, -1].map((sd) =>
          r.path(`${E(i, j)} + t*tfloor(${E(i, j)}, ${P(i)}, ${rad(i)}, ${sd})`, SKY, [0, 30], { outlineWidth: 1.5 }),
        ),
      ),
      // The three tips are NOT in a line: they mark out a triangle, which fixes the plane.
      r.path(`${tip(0)} + t*(${tip(1)} - ${tip(0)})`, AMBER, [0, 1], { outlineWidth: 2.5 }),
      r.path(`${tip(1)} + t*(${tip(2)} - ${tip(1)})`, AMBER, [0, 1], { outlineWidth: 2.5 }),
      r.path(`${tip(2)} + t*(${tip(0)} - ${tip(2)})`, AMBER, [0, 1], { outlineWidth: 2.5 }),
      // From one tip, through the other, down to the floor at E.
      ...MONGE_PAIRS.map(([i, j]) => r.path(`${tip(i)} + t*(${E(i, j)} - ${tip(i)})`, INK, [0, 1], { outlineWidth: 1.5, lineStyle: "dashed" })),
      ...MONGE_PAIRS.map(([i, j, name]) => spacePoint(r, E(i, j), AMBER, tex(`E_{${name}}`))),
      // Where the tip plane meets the floor: Monge's line.
      r.path(`${e1} + t*(${e2} - ${e1})/norm(${e2} - ${e1})`, RED, [-40, 40], { outlineWidth: 3.5 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\text{Monge's theorem: why it is true}`, RED],
        [String.raw`\text{blue on the floor: the outer tangents from 2D, meeting at each } E`, SKY],
        [String.raw`\text{a cone on each circle, as tall as it is wide}`, TEXT],
        [String.raw`\text{the tips are not in a line: their triangle fixes the amber plane}`, AMBER],
        [String.raw`\text{the line through two tips meets the floor at that pair's } E`, TEXT],
        [String.raw`\text{so each } E \text{ is on the amber plane and on the floor}`, AMBER],
        [String.raw`\text{two planes meet in a line: the } E\text{'s are collinear}`, RED],
      ]),
    ],
    variables: MONGE_CIRCLES.map((c, i) =>
      sceneSlider(rad(i), `Radius of ${c.name}`, c.r, [0.2, 3, 0.05], `Size of circle ${c.name}, and the height of its cone.`, "monge"),
    ),
    groups: [sceneGroup("monge", "Three circles")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-8, 8], y: [-8, 8] },
  };
}

// ─── 3D Gallery: scenes made for the 3D view ──────────────────────────────────
//
// Each is a well-known surface, solid or curve with sliders to explore it and notes
// pinned in the corner. They load straight into the 3D view.

/** A parametric surface: u and v each run from 0 to 2π. */
const uvSurface = (r: Rows, expr: string, color: string, opacity = 0.75, extra: Partial<MathFunction> = {}): MathFunction => ({
  ...r.define(expr),
  color,
  fillColor: color,
  fillOpacity: opacity,
  ...extra,
});

/** z = a·x² + b·y²: bowl, saddle or trough, by the signs of a and b. */
function quadricSurfaces(): ExampleScene {
  const r = sceneRows("g3quad");
  return {
    functions: [
      surface(r, "z = a*x^2 + b*y^2", BLUE),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`z = a\,x^2 + b\,y^2`, BLUE],
        [String.raw`a = {{a}}, \quad b = {{b}}`, TEXT],
        [String.raw`a, b \text{ same sign: a bowl (elliptic paraboloid)}`, GREEN],
        [String.raw`a, b \text{ opposite signs: a saddle (hyperbolic paraboloid)}`, AMBER],
        [String.raw`\text{one of them } 0\text{: a trough (parabolic cylinder)}`, PURPLE],
      ]),
    ],
    variables: [
      sceneSlider("a", "a (along x)", 0.3, [-1, 1, 0.05], "How it curves along x.", "shape"),
      sceneSlider("b", "b (along y)", -0.3, [-1, 1, 0.05], "How it curves along y.", "shape"),
    ],
    groups: [sceneGroup("shape", "Quadric surface")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { colorMode: "height", contours: true },
  };
}

/** x² + y² − z² = s: one sheet, a double cone, or two sheets. */
function hyperboloids(): ExampleScene {
  const r = sceneRows("g3hyp");
  return {
    functions: [
      surface(r, "x^2 + y^2 - z^2 = s", PURPLE, { fillOpacity: 0.8 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`x^2 + y^2 - z^2 = s`, PURPLE],
        [String.raw`s = {{s}}`, TEXT],
        [String.raw`s > 0\text{: hyperboloid of one sheet}`, GREEN],
        [String.raw`s = 0\text{: a double cone}`, AMBER],
        [String.raw`s < 0\text{: hyperboloid of two sheets}`, PINK],
      ]),
    ],
    variables: [sceneSlider("s", "s", 2, [-4, 4, 0.1], "Slide through 0 to watch one sheet pinch into a cone, then split in two.", "shape")],
    groups: [sceneGroup("shape", "Hyperboloid")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { colorMode: "height" },
  };
}

/** sin(kr)/(kr): ripples that die away from the middle. */
function sombrero(): ExampleScene {
  const r = sceneRows("g3sinc");
  return {
    functions: [
      surface(r, "z = 6*sin(k*sqrt(x^2 + y^2) + 0.000001)/(k*sqrt(x^2 + y^2) + 0.000001) - 1.5", SKY),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`z = \dfrac{\sin(k r)}{k r}, \quad r = \sqrt{x^2 + y^2}`, SKY],
        [String.raw`\text{a ripple from a stone dropped at the origin}`, TEXT],
        [String.raw`\text{rings every } \pi/k = {{pi/k}}`, AMBER],
      ]),
    ],
    variables: [sceneSlider("k", "Ripple number k", 1.8, [0.5, 4, 0.05], "Bigger k packs the rings closer.", "shape")],
    groups: [sceneGroup("shape", "Sinc ripples")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-6, 6], y: [-6, 6] },
    view3d: { colorMode: "height", contours: true },
  };
}

/** z = (x³ − 3xy²)/c: a saddle with three dips. */
function monkeySaddle(): ExampleScene {
  const r = sceneRows("g3monkey");
  return {
    functions: [
      surface(r, "z = (x^3 - 3*x*y^2)/c", AMBER),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`z = \dfrac{x^3 - 3xy^2}{c} = \dfrac{\mathrm{Re}\,(x + iy)^3}{c}`, AMBER],
        [String.raw`\text{three dips: two for the legs, one for the tail}`, TEXT],
        [String.raw`\text{flat at the origin, yet neither a top nor a bottom}`, PURPLE],
      ]),
    ],
    variables: [sceneSlider("c", "Flatten by c", 4, [1, 10, 0.1], "Bigger c flattens it.", "shape")],
    groups: [sceneGroup("shape", "Monkey saddle")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3, 3], y: [-3, 3] },
    view3d: { colorMode: "height", contours: true },
  };
}

/** A point on a surface with its tangent plane and its gradient, the way uphill. */
function tangentPlane(): ExampleScene {
  const r = sceneRows("g3tan");
  const f = (x: string, y: string) => `A*sin(${x})*cos(${y})`;
  // In brackets: they are squared and multiplied below.
  const fx = "(A*cos(a)*cos(b))";
  const fy = "(-A*sin(a)*sin(b))";
  // A patch of the plane round P, 1.4 each way.
  const s = "(u/pi - 1)*1.4";
  const w = "(v/pi - 1)*1.4";
  // The plane's unit normal, pointing up.
  const lift = `[-(${fx}), -(${fy}), 1]/sqrt((${fx})^2 + (${fy})^2 + 1)`;
  return {
    functions: [
      surface(r, `z = ${f("x", "y")}`, BLUE, { fillOpacity: 0.75 }),
      uvSurface(r, `[a + ${s}, b + ${w}, ${f("a", "b")} + ${fx}*${s} + ${fy}*${w}]`, AMBER, 0.3),
      // Uphill along the plane, lifted a hair off it (along its normal) so it shows on top.
      r.arrow(
        `Vector([a, b, ${f("a", "b")}] + 0.12*${lift}, [a + 0.8*${fx}, b + 0.8*${fy}, ${f("a", "b")} + 0.8*(${fx}^2 + ${fy}^2)] + 0.12*${lift})`,
        PINK,
        { outlineWidth: 5 },
      ),
      spacePoint(r, `[a, b, ${f("a", "b")}]`, RED, { dragVars: ["a", "b"] }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`f(x, y) = A \sin x \cos y`, BLUE],
        [String.raw`\nabla f = \left(f_x, f_y\right) = ({{${fx}}},\ {{${fy}}})`, PINK],
        [String.raw`z = f(a, b) + f_x\,(x - a) + f_y\,(y - b)`, AMBER],
        [String.raw`\text{Drag the point; the pink arrow points uphill}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("a", "Point a (x)", 1.2, [-3, 3, 0.05], "Where P is along x. Drag P.", "point"),
      sceneSlider("b", "Point b (y)", -1.2, [-3, 3, 0.05], "Where P is along y. Drag P.", "point"),
      sceneSlider("A", "Height A", 2, [0.5, 3, 0.1], "How tall the hills are.", "surface"),
    ],
    groups: [sceneGroup("point", "Point P"), sceneGroup("surface", "Surface")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3.5, 3.5], y: [-3.5, 3.5] },
  };
}

/** A sphere cut by a level plane: the cut is a circle. */
function spherePlane(): ExampleScene {
  const r = sceneRows("g3sph");
  return {
    functions: [
      surface(r, "x^2 + y^2 + z^2 = R^2", SKY, { fillOpacity: 0.4 }),
      uvSurface(r, "[(u/pi - 1)*4.2, (v/pi - 1)*4.2, c]", AMBER, 0.18),
      r.path("[sqrt(max(R^2 - c^2, 0))*cos(t), sqrt(max(R^2 - c^2, 0))*sin(t), c]", RED, [0, TAU], { outlineWidth: 4 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`x^2 + y^2 + z^2 = R^2`, SKY],
        [String.raw`\text{cut by the plane } z = c = {{c}}`, AMBER],
        [String.raw`\text{the cut: a circle of radius } \sqrt{R^2 - c^2} = {{sqrt(max(R^2 - c^2, 0))}}`, RED],
      ]),
    ],
    variables: [
      sceneSlider("R", "Sphere radius R", 3, [1, 4, 0.1], "Size of the sphere.", "shape"),
      sceneSlider("c", "Plane height c", 1.5, [-4, 4, 0.05], "Move the cut up and down: the circle shrinks to a point at the poles.", "shape"),
    ],
    groups: [sceneGroup("shape", "Sphere and plane")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4.5, 4.5], y: [-4.5, 4.5] },
  };
}

/** The Möbius strip: one side, one edge. */
function mobius(): ExampleScene {
  const r = sceneRows("g3mob");
  const s = "((v/pi - 1)*w)";
  return {
    functions: [
      uvSurface(r, `[(2.5 + ${s}*cos(u/2))*cos(u), (2.5 + ${s}*cos(u/2))*sin(u), ${s}*sin(u/2)]`, PURPLE, 0.8),
      r.path("[(2.5 + w*cos(t/2))*cos(t), (2.5 + w*cos(t/2))*sin(t), w*sin(t/2)]", AMBER, [0, 2 * TAU], { outlineWidth: 4 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\text{Möbius strip: a band with half a twist}`, PURPLE],
        [String.raw`\text{one side and one edge}`, TEXT],
        [String.raw`\text{the amber edge goes round twice before it closes}`, AMBER],
      ]),
    ],
    variables: [sceneSlider("w", "Half-width w", 1, [0.2, 1.6, 0.05], "How wide the band is.", "shape")],
    groups: [sceneGroup("shape", "Möbius strip")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { autoRotate: true },
  };
}

/** The Klein bottle (figure-8 form): no inside and no outside. */
function kleinBottle(): ExampleScene {
  const r = sceneRows("g3klein");
  const ring = "(R + cos(u/2)*sin(v) - sin(u/2)*sin(2*v))";
  return {
    functions: [
      uvSurface(r, `[${ring}*cos(u), ${ring}*sin(u), sin(u/2)*sin(v) + cos(u/2)*sin(2*v)]`, PINK, 0.6),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\text{Klein bottle (figure-8 form)}`, PINK],
        [String.raw`\text{no inside and no outside: one closed side}`, TEXT],
        [String.raw`\text{in 3D it must pass through itself}`, PURPLE],
      ]),
    ],
    variables: [sceneSlider("R", "Ring radius R", 2.2, [1.6, 3, 0.05], "Size of the ring the tube runs round.", "shape")],
    groups: [sceneGroup("shape", "Klein bottle")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { autoRotate: true },
  };
}

/** A (p, q) torus knot, wound round a faint torus. */
function torusKnot(): ExampleScene {
  const r = sceneRows("g3knot");
  return {
    functions: [
      uvSurface(r, "[(2.5 + cos(v))*cos(u), (2.5 + cos(v))*sin(u), sin(v)]", INK, 0.12),
      r.path("[(2.5 + cos(q*t))*cos(p*t), (2.5 + cos(q*t))*sin(p*t), sin(q*t)]", AMBER, [0, TAU], { outlineWidth: 4 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`(p, q) = ({{p:0}}, {{q:0}}) \text{ torus knot}`, AMBER],
        [String.raw`\text{round the hole } p \text{ times, through it } q \text{ times}`, TEXT],
        [String.raw`(2, 3)\text{: the trefoil} \qquad (2, 5)\text{: the cinquefoil}`, PURPLE],
        [String.raw`p, q \text{ with no common factor: one closed knot}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("p", "Turns round p", 2, [1, 7, 1], "Times round the hole.", "knot"),
      sceneSlider("q", "Turns through q", 3, [1, 9, 1], "Times through the hole.", "knot"),
    ],
    groups: [sceneGroup("knot", "Torus knot")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { autoRotate: true },
  };
}

/** Two helices half a turn apart, joined by rungs: DNA's shape. */
function dnaHelix(): ExampleScene {
  const r = sceneRows("g3dna");
  const z = (a: string) => `(${a})*7/(4*pi) - 3.5`;
  return {
    functions: [
      r.define("spin = 0.5*time"),
      r.path(`[R*cos(t + spin), R*sin(t + spin), ${z("t")}]`, BLUE, [0, 2 * TAU], { outlineWidth: 4 }),
      r.path(`[R*cos(t + pi + spin), R*sin(t + pi + spin), ${z("t")}]`, RED, [0, 2 * TAU], { outlineWidth: 4 }),
      // The rungs: one every 1/8 of a turn, across from strand to strand.
      r.path(`family(0:15, [R*(2*t - 1)*cos(i*pi/4 + spin), R*(2*t - 1)*sin(i*pi/4 + spin), ${z("i*pi/4")}])`, AMBER, [0, 1], { outlineWidth: 2.5 }),
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\text{a double helix: two strands half a turn apart}`, BLUE],
        [String.raw`\text{strand: } (R\cos t,\ R\sin t,\ h\,t)`, TEXT],
        [String.raw`\text{rungs join the strands across the middle}`, AMBER],
      ]),
    ],
    variables: [sceneSlider("R", "Radius R", 1.5, [0.6, 2.5, 0.05], "How wide the helix is.", "shape")],
    groups: [sceneGroup("shape", "Double helix")],
    timeline: { mode: "continuous", min: 0, max: 10, autoplay: true },
    view: { x: [-4, 4], y: [-4, 4] },
  };
}

/** A vector field: a swirl round the z-axis, spreading out and lifting. */
function vectorField3D(): ExampleScene {
  const r = sceneRows("g3field");
  return {
    functions: [
      { ...r.define("F = field([-y + a*x, x + a*y, c + a*z])"), color: SKY },
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\vec F(x, y, z) = (-y + a x,\ x + a y,\ c + a z)`, SKY],
        [String.raw`\nabla\cdot\vec F = 3a = {{3*a}} \quad (\text{spreading out})`, AMBER],
        [String.raw`\nabla\times\vec F = (0, 0, 2) \quad (\text{spinning round } z)`, PINK],
        [String.raw`\text{arrows: blue weak, red strong; lines follow the flow}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("a", "Spread a", 0, [-0.5, 0.5, 0.05], "Positive: the flow spreads out (a source). Negative: it sinks in.", "field"),
      sceneSlider("c", "Lift c", 1, [-2, 2, 0.1], "How fast the flow rises along z.", "field"),
    ],
    groups: [sceneGroup("field", "Vector field")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
  };
}

/** y = k·x^p turned round the x-axis: cylinder, cone, paraboloid, and its volume. */
function solidOfRevolution(): ExampleScene {
  const r = sceneRows("g3rev");
  return {
    functions: [
      { ...r.define("revolve(k*x^p, 0, b)"), color: BLUE, fillColor: BLUE, fillOpacity: 0.45 },
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`y = k\,x^{p} = {{k}}\,x^{ {{p}} },\quad 0 \le x \le {{b}}`, BLUE],
        [String.raw`p = 0\text{: cylinder}\quad p = 1\text{: cone}\quad p = \tfrac12\text{: paraboloid}`, TEXT],
        [String.raw`\text{each white ring is a disc of area } \pi f(x)^2`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("k", "Scale k", 1, [0.2, 2, 0.05], "How tall the curve is.", "curve"),
      sceneSlider("p", "Power p", 0.5, [0, 2, 0.05], "The shape of the curve y = k·xᵖ.", "curve"),
      sceneSlider("b", "Length b", 4, [0.5, 5, 0.1], "Where the solid ends.", "curve"),
    ],
    groups: [sceneGroup("curve", "The curve")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-5, 5], y: [-5, 5] },
  };
}

/** ρ = f(θ, φ) in spherical coordinates: a bumpy sphere. */
function sphericalSurface(): ExampleScene {
  const r = sceneRows("g3sphr");
  return {
    functions: [
      { ...r.define("rho = 2 + a*sin(m*theta)*sin(phi)^m"), type: "polar", color: PURPLE, fillColor: PURPLE, fillOpacity: 0.75 },
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`\rho = 2 + a\,\sin(m\theta)\,\sin^{m}\varphi`, PURPLE],
        [String.raw`(x, y, z) = (\rho\sin\varphi\cos\theta,\ \rho\sin\varphi\sin\theta,\ \rho\cos\varphi)`, TEXT],
        [String.raw`\theta \text{ round the } z\text{-axis},\ \varphi \text{ down from the top}`, TEXT],
      ]),
    ],
    variables: [
      sceneSlider("a", "Bump a", 0.8, [0, 1.5, 0.05], "How big the bumps are.", "shape"),
      sceneSlider("m", "Bumps m", 3, [1, 8, 1], "How many bumps round the middle (2m of them).", "shape"),
    ],
    groups: [sceneGroup("shape", "Spherical surface")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
    view3d: { autoRotate: true },
  };
}

/** r = f(θ, z) in cylindrical coordinates: a fluted vase. */
function cylindricalSurface(): ExampleScene {
  const r = sceneRows("g3cyl");
  return {
    functions: [
      { ...r.define("r = 1 + 0.12*z^2 + a*cos(m*theta + w*z)"), type: "polar", color: SKY, fillColor: SKY, fillOpacity: 0.75 },
      ...notes3(r, [0, 0], 0, 0, [
        [String.raw`r = 1 + 0.12\,z^2 + a\cos(m\theta + w z)`, SKY],
        [String.raw`(x, y, z) = (r\cos\theta,\ r\sin\theta,\ z)`, TEXT],
        [String.raw`w \ne 0 \text{ twists the flutes as they rise}`, AMBER],
      ]),
    ],
    variables: [
      sceneSlider("a", "Flute depth a", 0.25, [0, 0.6, 0.01], "How deep the flutes are.", "shape"),
      sceneSlider("m", "Flutes m", 6, [0, 12, 1], "How many flutes round the vase.", "shape"),
      sceneSlider("w", "Twist w", 0.5, [-1.5, 1.5, 0.05], "How much the flutes turn as they rise.", "shape"),
    ],
    groups: [sceneGroup("shape", "Vase")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-4, 4], y: [-4, 4] },
  };
}

/** The 3D Gallery: scenes made for the 3D view, in order. `key` must exist in MATH_EXAMPLES. */
export const EXAMPLE_GALLERY_3D: {
  key: string;
  category: string;
  label: string;
  hint: string;
  accent: string;
}[] = [
  { key: "Space_Quadrics", category: "Surfaces", label: "Quadric Surfaces", hint: "z = ax² + by²: bowl, saddle or trough by the signs of a and b", accent: "text-blue-600 dark:text-blue-400" },
  { key: "Space_Hyperboloids", category: "Surfaces", label: "Hyperboloids & Cone", hint: "x² + y² − z² = s: one sheet, a double cone, two sheets", accent: "text-violet-600 dark:text-violet-400" },
  { key: "Space_Sombrero", category: "Surfaces", label: "Sinc Ripples", hint: "sin(kr)/(kr): ripples dying away from the middle", accent: "text-sky-600 dark:text-sky-400" },
  { key: "Space_MonkeySaddle", category: "Surfaces", label: "Monkey Saddle", hint: "x³ − 3xy²: a saddle with three dips", accent: "text-amber-600 dark:text-amber-400" },
  { key: "Space_VectorField", category: "Calculus", label: "Vector Field & Flow", hint: "Arrows of F(x, y, z) and the lines a particle would follow", accent: "text-sky-600 dark:text-sky-400" },
  { key: "Space_Revolution", category: "Calculus", label: "Solids of Revolution", hint: "Spin y = k·xᵖ round the x-axis: discs and the volume π∫f²", accent: "text-blue-600 dark:text-blue-400" },
  { key: "Space_Spherical", category: "Coordinates", label: "Spherical ρ(θ, φ)", hint: "ρ = f(θ, φ): a bumpy sphere in spherical coordinates", accent: "text-purple-600 dark:text-purple-400" },
  { key: "Space_Cylindrical", category: "Coordinates", label: "Cylindrical r(θ, z)", hint: "r = f(θ, z): a twisted, fluted vase", accent: "text-sky-600 dark:text-sky-400" },
  { key: "Space_TangentPlane", category: "Calculus", label: "Tangent Plane & Gradient", hint: "Drag a point over a surface: its tangent plane and the way uphill", accent: "text-red-600 dark:text-red-400" },
  { key: "Space_SpherePlane", category: "Geometry", label: "Sphere Cross-Section", hint: "A plane cuts a sphere in a circle of radius √(R² − c²)", accent: "text-cyan-600 dark:text-cyan-400" },
  { key: "Space_Mobius", category: "Topology", label: "Möbius Strip", hint: "A band with half a twist: one side and one edge", accent: "text-purple-600 dark:text-purple-400" },
  { key: "Space_Klein", category: "Topology", label: "Klein Bottle", hint: "No inside or outside; it has to pass through itself in 3D", accent: "text-pink-600 dark:text-pink-400" },
  { key: "Space_TorusKnot", category: "Knots", label: "Torus Knots", hint: "(p, q) knots on a torus: the trefoil, the cinquefoil…", accent: "text-orange-600 dark:text-orange-400" },
  { key: "Space_DNA", category: "Curves", label: "Double Helix", hint: "Two helices half a turn apart, joined by rungs", accent: "text-emerald-600 dark:text-emerald-400" },
];

/** Whether a gallery entry only makes sense in the 3D view. */
export const isExample3DOnly = (key: string) => key.startsWith("Space_");

export const MATH_EXAMPLES: Record<string, ExampleScene> = {
  Lissajous: {
    functions: [
      {
        id: "f1",
        expr: "[A * sin(a*t + d + time), B * sin(b*t)]",
        type: "parametric",
        color: COLORS[0],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1",
        name: "A",
        displayName: "Amplitude X",
        description: "",
        value: 3,
        defaultValue: 3,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v2",
        name: "B",
        displayName: "Amplitude Y",
        description: "",
        value: 3,
        defaultValue: 3,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v3",
        name: "a",
        displayName: "Freq X",
        description: "",
        value: 3,
        defaultValue: 3,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v4",
        name: "b",
        displayName: "Freq Y",
        description: "",
        value: 4,
        defaultValue: 4,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v5",
        name: "d",
        displayName: "Phase",
        description: "",
        value: Math.PI / 2,
        defaultValue: Math.PI / 2,
        min: 0,
        max: Math.PI * 2,
        step: 0.1,
        groupId: "default",
      },
    ],
  },
  Geometry: triangleCentres(),
  Matrix: linearTransformation(),
  Lorenz: {
    functions: [
      {
        id: "f1",
        expr:
          "x' = s*(y - x); y' = x*(r - z) - y; z' = x*y - b*z; x(0) = 1; y(0) = 1; z(0) = 1",
        type: "differential",
        color: COLORS[5],
        visible: true,
        tRange: [0, 30],
        odeSteps: 2600,
        odeAxes: ["x", "z"],
        odeAnimate: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "s", displayName: "Sigma", description: "Prandtl number",
        value: 10, defaultValue: 10, min: 0, max: 20, step: 0.5, groupId: "default",
      },
      {
        id: "v2", name: "r", displayName: "Rho", description: "Rayleigh number (28 is chaotic)",
        value: 28, defaultValue: 28, min: 0, max: 50, step: 0.5, groupId: "default",
      },
      {
        id: "v3", name: "b", displayName: "Beta", description: "Geometry factor",
        value: 2.667, defaultValue: 2.667, min: 0, max: 5, step: 0.05, groupId: "default",
      },
    ],
    // The attractor spans roughly x ±20 and z 0..50; the default ±5 view shows a tangle.
    view: { x: [-26, 26], y: [-2, 52] },
  },
  SimpleHarmonicMotion: harmonicMotion(),
  CircularMotion: circularMotion(),
  DampedOscillator: dampedOscillator(),
  Wave: travelingWave(),
  Beats: beats(),
  Orbit: orbit(),
  PredatorPrey: predatorPrey(),
  Fourier: fourier(),
  Statistics: normalDistribution(),
  CubeRootsOfUnity: cubeRootsOfUnity(),
  EulerFormula: eulerFormula(),
  EulerIdentity: eulerIdentity(),
  DeMoivre: deMoivre(),
  RootsOfUnity: rootsOfUnity(),
  ComplexMultiplication: complexMultiplication(),
  EulerPolyhedra: eulerPolyhedra(),
  MongeTheorem: mongeTheorem(),
  MongeTheorem3D: mongeTheorem3D(),
  // Versions for the 3D view, loaded in place of the ones above while the graph is in 3D.
  CubeRootsOfUnity3D: rootsLandscape("cuberoot3", 3, "Cube roots: where |z³ − 1| touches the floor"),
  RootsOfUnity3D: rootsLandscape("roots3", 6, "Roots of unity: where |zⁿ − 1| touches the floor"),
  EulerFormula3D: eulerFormula3D(),
  EulerIdentity3D: eulerIdentity3D(),
  DeMoivre3D: deMoivre3D(),
  ComplexMultiplication3D: complexMultiplication3D(),
  EulerPolyhedra3D: eulerPolyhedra3D(),
  Lorenz3D: lorenz3D(),
  Lissajous3D: lissajous3D(),
  Wave3D: wave3D(),
  Statistics3D: normalDistribution3D(),
  // The 3D Gallery
  Space_Quadrics: quadricSurfaces(),
  Space_Hyperboloids: hyperboloids(),
  Space_Sombrero: sombrero(),
  Space_MonkeySaddle: monkeySaddle(),
  Space_TangentPlane: tangentPlane(),
  Space_SpherePlane: spherePlane(),
  Space_Mobius: mobius(),
  Space_Klein: kleinBottle(),
  Space_TorusKnot: torusKnot(),
  Space_VectorField: vectorField3D(),
  Space_Revolution: solidOfRevolution(),
  Space_Spherical: sphericalSurface(),
  Space_Cylindrical: cylindricalSurface(),
  Space_DNA: dnaHelix(),
};
