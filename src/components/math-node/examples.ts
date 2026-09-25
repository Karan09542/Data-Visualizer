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
}

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
      key: "Geometry", category: "Geometry", label: "Vectors & Polygons",
      hint: "Draggable points, vectors and shapes",
      activeClass: "bg-pink-500/10 border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/50",
      labelClass: "text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300",
    },
    {
      key: "Matrix", category: "Matrices", label: "Matrix & Det. Eq.",
      hint: "A line through two draggable points via a determinant",
      activeClass: "bg-indigo-500/10 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/50",
      labelClass: "text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
    },
  ];

const TAU = 2 * Math.PI;
const BLUE = "#3b82f6";
const RED = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const PURPLE = "#8b5cf6";
const SKY = "#0ea5e9";
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
  Geometry: {
    functions: [
      {
        id: "f1",
        expr: "A = [2, 3]",
        type: "point",
        color: COLORS[0],
        visible: true,
      },
      {
        id: "f2",
        expr: "B = [-1, 2]",
        type: "point",
        color: COLORS[1],
        visible: true,
      },
      {
        id: "f3",
        expr: "C = [1, -2]",
        type: "point",
        color: COLORS[2],
        visible: true,
      },
      {
        id: "f4",
        expr: "[A, B, C]",
        type: "polygon",
        color: COLORS[3],
        visible: true,
      },
      {
        id: "f5",
        expr: "v = A - B",
        type: "vector",
        color: COLORS[4],
        visible: true,
      },
      {
        id: "f6",
        expr: "[r * cos(t), r * sin(t)]",
        type: "parametric",
        color: COLORS[5],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1",
        name: "r",
        displayName: "Circle Radius",
        description: "Radius of implicit circle",
        value: 2,
        defaultValue: 2,
        min: 0.1,
        max: 10,
        step: 0.1,
        groupId: "default",
      },
    ],
  },
  Matrix: {
    functions: [
      {
        id: "f1",
        expr: "A = [2, 3]",
        type: "point",
        color: COLORS[0],
        visible: true,
        isDraggable: true,
      },
      {
        id: "f2",
        expr: "B = [-2, -1]",
        type: "point",
        color: COLORS[1],
        visible: true,
        isDraggable: true,
      },
      {
        id: "f3",
        expr: "[[x, y, 1], [A[1], A[2], 1], [B[1], B[2], 1]] = 0",
        type: "implicit",
        color: COLORS[2],
        visible: true,
      },
    ],
    variables: [],
  },
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
};
