/**
 * Ready-made physics labs for the math node.
 *
 * Each one is built from ordinary rows, so nothing here is special-cased in the
 * renderer and every part can be opened, read and changed:
 *
 *   - definitions        vx = v0*cos(angle*pi/180)      (named values, not plotted)
 *   - handles            points/arrow tips with dragVars (drag them to set sliders)
 *   - live labels        "R = {{R}} m"                  (readouts that update)
 *   - differential rows  x'' = -(k/m)*x                 (their state x, dx follows time)
 *   - a "Run once" timeline that ends when the motion does (Start / Reset)
 */
import type { MathFunction, MathVariable, VariableGroup } from "./mathTypes";
import type { TimeMode } from "./Timeline";

export interface SimulationTimeline {
  mode: TimeMode;
  min: number;
  max: number;
  /** End time as a formula, e.g. "T" (the flight time). */
  endExpr?: string;
  speed?: number;
  /** Start playing as soon as it loads. Simulations wait for Start by default. */
  autoplay?: boolean;
}

export interface GraphView {
  x: [number, number];
  y: [number, number];
}

export interface SimulationScene {
  functions: MathFunction[];
  variables: MathVariable[];
  groups: VariableGroup[];
  timeline: SimulationTimeline;
  view: GraphView;
}

export interface SimulationPreset {
  key: string;
  title: string;
  topic: string;
  /** One line on what it shows. */
  summary: string;
  /** Things to try, shown on the card. */
  tryThis: string[];
  /** Accent for the card (Tailwind classes). */
  accent: { dot: string; ring: string; text: string };
  build: () => SimulationScene;
}

// ─── Builders ─────────────────────────────────────────────────────────────────

export const INK = "#94a3b8"; // neutral: guides, predicted paths, the world
export const TEXT = "#64748b"; // readable on both the light and the dark canvas
const GROUND = "#16a34a";

export function sceneRows(prefix: string) {
  let n = 0;
  const base = (type: MathFunction["type"], expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
    id: `${prefix}_${++n}`,
    type,
    expr,
    color,
    visible: true,
    ...extra,
  });
  return {
    /** A named value (`T = …`) or helper (`pos(s) = …`): computed, not drawn. */
    define: (expr: string) => base("function", expr, INK),
    point: (expr: string, color: string, extra?: Partial<MathFunction>) => base("point", expr, color, extra),
    arrow: (expr: string, color: string, extra?: Partial<MathFunction>) => base("vector", expr, color, extra),
    shape: (expr: string, color: string, extra?: Partial<MathFunction>) =>
      base("polygon", expr, color, { fillColor: color, fillOpacity: 0.35, fillPattern: "solid", ...extra }),
    path: (expr: string, color: string, tRange: [number, number], extra?: Partial<MathFunction>) =>
      base("parametric", expr, color, { tRange, ...extra }),
    region: (expr: string, color: string, extra?: Partial<MathFunction>) => base("inequality", expr, color, extra),
    ode: (expr: string, color: string, extra?: Partial<MathFunction>) =>
      base("differential", expr, color, { odeAnimate: true, ...extra }),
    /** Text on the canvas with live values: "t = {{clock}} s". */
    readout: (at: string, text: string, color: string, extra?: Partial<MathFunction>) =>
      base("point", at, color, {
        showPoint: false,
        showLabel: true,
        label: text,
        labelPlain: true,
        labelAlignment: "center",
        ...extra,
      }),
  };
}

export function sceneSlider(
  name: string,
  displayName: string,
  value: number,
  [min, max, step]: [number, number, number],
  description: string,
  groupId = "default",
): MathVariable {
  return {
    id: `v_${name}`,
    name,
    displayName,
    description,
    value,
    defaultValue: value,
    min,
    max,
    step,
    groupId,
    showSlider: true,
  };
}

export const sceneGroup = (id: string, name: string): VariableGroup => ({ id, name, isCollapsed: false });

// ─── Projectile ───────────────────────────────────────────────────────────────

function projectile(): SimulationScene {
  const r = sceneRows("proj");
  const ACCENT = "#ec4899";
  const HANDLE = "#0ea5e9";
  const MARK = "#f59e0b";

  return {
    functions: [
      r.define("vx = v0*cos(angle*pi/180)"),
      r.define("vy = v0*sin(angle*pi/180)"),
      r.define("T = (vy + sqrt(vy^2 + 2*g*h0))/g"),
      r.define("clock = min(time, T)"),
      r.define("R = vx*T"),
      r.define("H = h0 + max(vy, 0)^2/(2*g)"),
      r.region("y <= 0", GROUND, { fillColor: GROUND, fillOpacity: 0.18, fillPattern: "solid", outlineWidth: 2 }),
      r.path("[vx*t*T, h0 + vy*t*T - g*(t*T)^2/2]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 2 }),
      r.path("[vx*t*clock, h0 + vy*t*clock - g*(t*clock)^2/2]", ACCENT, [0, 1]),
      r.point("ball = [vx*clock, h0 + vy*clock - g*clock^2/2]", ACCENT),
      r.arrow("Vector(ball, ball + [vx, vy - g*clock]/4)", "#f472b6", { outlineWidth: 2 }),
      r.arrow("Vector([0, h0], [0, h0] + [vx, vy]/4)", HANDLE, { dragVars: ["v0", "angle"] }),
      r.point("[0, h0]", HANDLE, { dragVars: ["h0"] }),
      r.readout("[0, h0] + [vx, vy]/4 + [0.2, 0.45]", "v₀ = {{v0:1}} m/s at {{angle:0}}°", HANDLE),
      r.point("[R, 0]", MARK, { showLabel: true, label: "R = {{R}} m", labelAlignment: "below" }),
      r.point("[vx*max(vy, 0)/g, H]", MARK, { showLabel: true, label: "H = {{H}} m", labelAlignment: "above" }),
      r.readout("[R/2, -1.3]", "t = {{clock}} / {{T}} s", TEXT),
    ],
    variables: [
      sceneSlider("v0", "Launch speed (m/s)", 10, [0, 20, 0.1], "How fast it leaves. Drag the blue arrow.", "launch"),
      sceneSlider("angle", "Launch angle (°)", 45, [0, 90, 1], "Degrees above the ground. 45° goes furthest on flat ground.", "launch"),
      sceneSlider("h0", "Launch height (m)", 0, [0, 10, 0.1], "Drag the blue dot up to launch from a cliff.", "launch"),
      sceneSlider("g", "Gravity (m/s²)", 9.8, [0.5, 25, 0.1], "Earth 9.8, Moon 1.6, Mars 3.7, Jupiter 24.8", "world"),
    ],
    groups: [sceneGroup("launch", "Launch"), sceneGroup("world", "World")],
    timeline: { mode: "once", min: 0, max: 5, endExpr: "T" },
    view: { x: [-2, 14], y: [-3, 8] },
  };
}

// ─── Spring ───────────────────────────────────────────────────────────────────

function spring(): SimulationScene {
  const r = sceneRows("spring");
  const MASS = "#3b82f6";
  const VEL = "#f59e0b";
  // The spring hangs off a wall at x = 0 on the line y = 5; at rest the mass sits at 4.
  // Below it, the solution x(t) is drawn on the real axes: time across, stretch up.
  return {
    functions: [
      r.ode("x'' = -(k/m)*x - (c/m)*x'; x(0) = x0; x'(0) = v0", MASS, {
        tRange: [0, 12],
        odeAxes: ["t", "x"],
        odeSteps: 1500,
      }),
      r.define("pos = 4 + x"),
      r.shape("[[-0.4, 3.9], [0, 3.9], [0, 6.1], [-0.4, 6.1]]", INK, { fillOpacity: 0.5 }),
      r.path("[4, 3.7 + 2.6*t]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[(pos - 0.5)*t, 5 + 0.25*asin(sin(2*pi*9*t))*2/pi]", INK, [0, 1], { outlineWidth: 2 }),
      r.shape("[[pos - 0.5, 4.5], [pos + 0.5, 4.5], [pos + 0.5, 5.5], [pos - 0.5, 5.5]]", MASS),
      r.point("[pos, 5]", MASS, { dragVars: ["x0"] }),
      r.arrow("Vector([pos, 5.9], [pos + dx/2, 5.9])", VEL, { outlineWidth: 2 }),
      r.readout("[4, 6.7]", "x = {{x}} m    v = {{dx}} m/s", TEXT),
      r.readout("[6, -3.2]", "Energy = ½kx² + ½mv² = {{0.5*k*x^2 + 0.5*m*dx^2}} J", TEXT),
      r.readout("[6, -3.9]", "Undamped period 2π√(m/k) = {{2*pi*sqrt(m/k)}} s", TEXT),
    ],
    variables: [
      sceneSlider("k", "Stiffness k (N/m)", 4, [0.5, 20, 0.1], "Stiffer springs pull harder and swing faster.", "spring"),
      sceneSlider("m", "Mass m (kg)", 1, [0.1, 5, 0.1], "Heavier masses swing slower.", "spring"),
      sceneSlider("c", "Damping c (kg/s)", 0.2, [0, 3, 0.05], "Friction that drains energy. 0 swings forever.", "spring"),
      sceneSlider("x0", "Pulled to x₀ (m)", 1.5, [-2.5, 2.5, 0.05], "Where it's released. Drag the mass.", "start"),
      sceneSlider("v0", "Pushed at v₀ (m/s)", 0, [-5, 5, 0.1], "A starting push.", "start"),
    ],
    groups: [sceneGroup("spring", "Spring"), sceneGroup("start", "Release")],
    timeline: { mode: "once", min: 0, max: 12 },
    view: { x: [-1.5, 13], y: [-4.5, 7.5] },
  };
}

// ─── Pendulum ─────────────────────────────────────────────────────────────────

function pendulum(): SimulationScene {
  const r = sceneRows("pend");
  const BOB = "#ef4444";
  // Pivot at (5, 7.5). Below it, θ(t) is drawn on the real axes (radians).
  return {
    functions: [
      r.ode("theta'' = -(g/L)*sin(theta) - c*theta'; theta(0) = th0*pi/180; theta'(0) = 0", BOB, {
        tRange: [0, 10],
        odeAxes: ["t", "theta"],
        odeSteps: 1500,
      }),
      r.define("bob = [5 + L*sin(theta), 7.5 - L*cos(theta)]"),
      r.path("[5 + L*sin(t), 7.5 - L*cos(t)]", INK, [0, 2 * Math.PI], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[5, 7.5] + t*(bob - [5, 7.5])", TEXT, [0, 1], { outlineWidth: 2 }),
      r.point("[5, 7.5]", INK),
      r.point("bob", BOB, { dragVars: ["th0"] }),
      r.readout("[5, 11]", "θ = {{theta*180/pi:0}}°    ω = {{dtheta}} rad/s", TEXT),
      r.readout("[5, -3.3]", "Small-swing period 2π√(L/g) = {{2*pi*sqrt(L/g)}} s", TEXT),
    ],
    variables: [
      sceneSlider("th0", "Release angle (°)", 60, [-170, 170, 1], "Drag the bob. Wide swings take longer than the formula says.", "start"),
      sceneSlider("L", "Length L (m)", 2, [0.5, 3, 0.1], "Longer pendulums swing slower.", "pendulum"),
      sceneSlider("g", "Gravity (m/s²)", 9.8, [0.5, 25, 0.1], "Earth 9.8, Moon 1.6", "pendulum"),
      sceneSlider("c", "Air drag", 0, [0, 1, 0.02], "Slows the swing down over time.", "pendulum"),
    ],
    groups: [sceneGroup("start", "Release"), sceneGroup("pendulum", "Pendulum")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-1, 11], y: [-4, 11.5] },
  };
}

// ─── Motion graphs ────────────────────────────────────────────────────────────

function motionGraphs(): SimulationScene {
  const r = sceneRows("kin");
  const CAR = "#3b82f6";
  const VEL = "#f59e0b";
  // The cart rides a vertical track left of the axes, so its height IS its position:
  // the blue curve is the cart's journey unrolled over time.
  return {
    functions: [
      r.define("pos(s) = x0 + v0*s + a*s^2/2"),
      r.define("vel(s) = v0 + a*s"),
      r.path("[-1.5, -6 + 18*t]", INK, [0, 1], { outlineWidth: 2 }),
      r.shape("[[-1.9, pos(time) - 0.3], [-1.1, pos(time) - 0.3], [-1.1, pos(time) + 0.3], [-1.9, pos(time) + 0.3]]", CAR),
      r.point("[-1.5, pos(time)]", CAR, { dragVars: ["x0"] }),
      r.arrow("Vector([-2.4, pos(time)], [-2.4, pos(time) + vel(time)/2])", VEL, { dragVars: ["v0"] }),
      r.path("[8*t, pos(8*t)]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[-1.5 + (time + 1.5)*t, pos(time)]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.path("[time*t, pos(time*t)]", CAR, [0, 1]),
      r.path("[time*t, vel(time*t)]", VEL, [0, 1], { outlineWidth: 2 }),
      r.path("[time + t, pos(time) + vel(time)*t]", VEL, [-0.8, 0.8], { outlineWidth: 2, lineStyle: "dashed" }),
      r.point("[time, pos(time)]", CAR),
      r.point("[time, vel(time)]", VEL),
      r.readout("[4, 7.4]", "x = {{pos(time)}} m    v = {{vel(time)}} m/s    a = {{a}} m/s²", TEXT),
    ],
    variables: [
      sceneSlider("x0", "Start position x₀ (m)", 1, [-4, 6, 0.1], "Drag the cart up or down the track.", "start"),
      sceneSlider("v0", "Start velocity v₀ (m/s)", 2, [-4, 4, 0.1], "Drag the orange arrow on the cart.", "start"),
      sceneSlider("a", "Acceleration a (m/s²)", -0.5, [-2, 2, 0.05], "Constant. Negative slows an upward-moving cart.", "motion"),
    ],
    groups: [sceneGroup("start", "At t = 0"), sceneGroup("motion", "Motion")],
    timeline: { mode: "once", min: 0, max: 8 },
    view: { x: [-3.5, 9], y: [-6.5, 8] },
  };
}

export const SIMULATIONS: SimulationPreset[] = [
  {
    key: "sim_projectile",
    title: "Projectile Launcher",
    topic: "Kinematics in 2D",
    summary: "Launch a ball, watch its path, range and peak height.",
    tryThis: [
      "Drag the blue arrow to aim and set the speed.",
      "Which angle lands furthest? Try 30° and 60°.",
      "Set gravity to 1.6 for the Moon.",
    ],
    accent: { dot: "bg-pink-500", ring: "ring-pink-400/60 border-pink-400", text: "text-pink-600 dark:text-pink-400" },
    build: projectile,
  },
  {
    key: "sim_spring",
    title: "Spring & Mass",
    topic: "Oscillations",
    summary: "Pull the mass, let go, and graph its position over time.",
    tryThis: [
      "Drag the mass to stretch the spring, then Start.",
      "Set damping to 0: the energy stays constant.",
      "Double the mass: how does the period change?",
    ],
    accent: { dot: "bg-blue-500", ring: "ring-blue-400/60 border-blue-400", text: "text-blue-600 dark:text-blue-400" },
    build: spring,
  },
  {
    key: "sim_pendulum",
    title: "Pendulum",
    topic: "Oscillations",
    summary: "A real swing, solved step by step, with its angle graphed.",
    tryThis: [
      "Drag the bob to a small angle, then a wide one.",
      "Compare the real period with the formula below.",
      "Add air drag and watch the swing die away.",
    ],
    accent: { dot: "bg-red-500", ring: "ring-red-400/60 border-red-400", text: "text-red-600 dark:text-red-400" },
    build: pendulum,
  },
  {
    key: "sim_motion_graphs",
    title: "Motion Graphs",
    topic: "Kinematics in 1D",
    summary: "A cart's position and velocity drawn as it moves.",
    tryThis: [
      "Drag the cart and its arrow, then Start.",
      "Blue is position x(t), orange is velocity v(t).",
      "Where the blue curve peaks, the orange one crosses 0.",
      "Set a = 0 for a straight line.",
    ],
    accent: { dot: "bg-amber-500", ring: "ring-amber-400/60 border-amber-400", text: "text-amber-600 dark:text-amber-400" },
    build: motionGraphs,
  },
];
