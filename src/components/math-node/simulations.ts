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
  /** The lab laid out in space, loaded in place of `build` while the graph is in 3D. */
  build3d?: () => SimulationScene;
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

// ─── The same labs in space (loaded while the graph is in 3D) ─────────────────
//
// Up is the z-axis, so gravity pulls down it. Each lab stands above the floor, and
// its graph against time is drawn on the floor beneath, time running along x. The
// handles work as they do on the flat graph: dragging one sets its sliders.

type Rows = ReturnType<typeof sceneRows>;

/** A point of space: what the 3D view draws as a dot (or a handle, with dragVars). */
const spacePoint = (r: Rows, expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
  ...r.define(expr),
  color,
  isDraggable: false,
  ...extra,
});

/** A line of text pinned to the corner of the 3D view, with live values. */
const note = (r: Rows, text: string, color: string, scale = 1): MathFunction =>
  r.readout("[0, 0, 0]", text, color, { labelPinned: true, labelScale: scale });

/** The six faces of a box from corner `lo` to corner `hi` (expressions per coordinate). */
function box(r: Rows, lo: [string, string, string], hi: [string, string, string], color: string, opacity = 0.45): MathFunction[] {
  const p = (i: number, j: number, k: number) => `[${i ? hi[0] : lo[0]}, ${j ? hi[1] : lo[1]}, ${k ? hi[2] : lo[2]}]`;
  const face = (...c: [number, number, number][]) =>
    r.shape(`[${c.map((v) => p(...v)).join(", ")}]`, color, { fillOpacity: opacity, outlineWidth: 2, showAngles: false });
  return [
    face([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]),
    face([0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]),
    face([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]),
    face([0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]),
    face([0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]),
    face([1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]),
  ];
}

/** A ball launched in any direction: aim it round as well as up. */
function projectile3D(): SimulationScene {
  const r = sceneRows("proj3");
  const ACCENT = "#ec4899";
  const HANDLE = "#0ea5e9";
  const MARK = "#f59e0b";
  return {
    functions: [
      r.define("el = angle*pi/180"),
      r.define("az = aim*pi/180"),
      r.define("vh = v0*cos(el)"),
      r.define("vx = vh*cos(az)"),
      r.define("vy = vh*sin(az)"),
      r.define("vz = v0*sin(el)"),
      r.define("T = (vz + sqrt(vz^2 + 2*g*h0))/g"),
      r.define("clock = min(time, T)"),
      r.define("R = vh*T"),
      r.define("H = h0 + max(vz, 0)^2/(2*g)"),
      r.shape("[[-2, -8, 0], [14, -8, 0], [14, 8, 0], [-2, 8, 0]]", GROUND, { fillOpacity: 0.14, outlineWidth: 1, showAngles: false }),
      // Where it will go, where it has been, and its shadow on the ground.
      r.path("[vx*t*T, vy*t*T, h0 + vz*t*T - g*(t*T)^2/2]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 2 }),
      r.path("[vx*t*T, vy*t*T, 0]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.path("[vx*t*clock, vy*t*clock, h0 + vz*t*clock - g*(t*clock)^2/2]", ACCENT, [0, 1], { outlineWidth: 3.5 }),
      spacePoint(r, "ball = [vx*clock, vy*clock, h0 + vz*clock - g*clock^2/2]", ACCENT),
      r.path("[vx*clock, vy*clock, t*(h0 + vz*clock - g*clock^2/2)]", ACCENT, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.arrow("Vector(ball, ball + [vx, vy, vz - g*clock]/4)", "#f472b6", { outlineWidth: 2 }),
      // Handles: the launch arrow (speed, elevation and aim) and the launch height.
      r.path("[0, 0, t*h0]", HANDLE, [0, 1], { outlineWidth: 2 }),
      r.arrow("Vector([0, 0, h0], [0, 0, h0] + [vx, vy, vz]/4)", HANDLE, { dragVars: ["v0", "angle", "aim"], outlineWidth: 3.5 }),
      spacePoint(r, "[0, 0, h0]", HANDLE, { dragVars: ["h0"] }),
      spacePoint(r, "[R*cos(az), R*sin(az), 0]", MARK, { showLabel: true, label: "R = {{R}} m", labelPlain: true }),
      spacePoint(r, "[vx*max(vz, 0)/g, vy*max(vz, 0)/g, H]", MARK, { showLabel: true, label: "H = {{H}} m", labelPlain: true }),
      note(r, "t = {{clock}} / {{T}} s", ACCENT, 1.1),
      note(r, "v₀ = {{v0:1}} m/s,  {{angle:0}}° up,  aimed {{aim:0}}° round", HANDLE),
      note(r, "Drag the blue arrow to aim; the blue dot sets the height", TEXT, 0.9),
    ],
    variables: [
      sceneSlider("v0", "Launch speed (m/s)", 10, [0, 16, 0.1], "How fast it leaves. Drag the blue arrow.", "launch"),
      sceneSlider("angle", "Launch angle (°)", 50, [0, 90, 1], "Degrees above the ground.", "launch"),
      sceneSlider("aim", "Aim (°)", 20, [-90, 90, 1], "Which way round it is fired. Drag the blue arrow sideways.", "launch"),
      sceneSlider("h0", "Launch height (m)", 0, [0, 6, 0.1], "Drag the blue dot up to launch from a cliff.", "launch"),
      sceneSlider("g", "Gravity (m/s²)", 9.8, [0.5, 25, 0.1], "Earth 9.8, Moon 1.6, Mars 3.7, Jupiter 24.8", "world"),
    ],
    groups: [sceneGroup("launch", "Launch"), sceneGroup("world", "World")],
    timeline: { mode: "once", min: 0, max: 5, endExpr: "T" },
    view: { x: [-2, 14], y: [-8, 8] },
  };
}

/** A mass on a coiled spring, with its position against time drawn on the floor beneath. */
function spring3D(): SimulationScene {
  const r = sceneRows("spring3");
  const MASS = "#3b82f6";
  const VEL = "#f59e0b";
  // The spring runs along y at height 2, from a wall at y = -5; at rest the mass is at y = 0.
  // On the floor, x(t) is drawn with time along x, so the mass moves the way its graph does.
  return {
    functions: [
      r.ode("x'' = -(k/m)*x - (c/m)*x'; x(0) = x0; x'(0) = v0", MASS, {
        tRange: [0, 12],
        odeAxes: ["t", "x"],
        odeSteps: 1500,
      }),
      r.define("clock = min(max(time, 0), 12)"),
      r.shape("[[-3, -5, 0.8], [-1, -5, 0.8], [-1, -5, 3.2], [-3, -5, 3.2]]", INK, { fillOpacity: 0.45, showAngles: false }),
      // The coil: nine turns, stretched to wherever the mass is.
      r.path("[-2 + 0.32*cos(2*pi*9*t), -5 + (x + 4.5)*t, 2 + 0.32*sin(2*pi*9*t)]", INK, [0, 1], { outlineWidth: 2.5 }),
      ...box(r, ["-2.5", "x - 0.5", "1.5"], ["-1.5", "x + 0.5", "2.5"], MASS),
      // Rest position, and the line from the mass down to where its graph has reached.
      r.path("[-2, 0, 2*t]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[-2 + (clock + 2)*t, x, 2 - 2*t]", MASS, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.arrow("Vector([-2, x, 3], [-2, x + dx/2, 3])", VEL, { outlineWidth: 2.5 }),
      spacePoint(r, "[-2, x, 2]", MASS, { dragVars: ["x0"] }),
      note(r, "x = {{x}} m    v = {{dx}} m/s", MASS, 1.1),
      note(r, "Energy = ½kx² + ½mv² = {{0.5*k*x^2 + 0.5*m*dx^2}} J", TEXT),
      note(r, "Undamped period 2π√(m/k) = {{2*pi*sqrt(m/k)}} s", TEXT),
      note(r, "Drag the mass to stretch the spring, then Start", TEXT, 0.9),
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
    view: { x: [-3, 13], y: [-8, 8] },
  };
}

/** A pendulum swinging above the graph of its angle against time. */
function pendulum3D(): SimulationScene {
  const r = sceneRows("pend3");
  const BOB = "#ef4444";
  // The pivot is at (-2, 0, 4.5); the bob swings in the plane x = -2, so its sideways
  // swing runs along y, the same way as the angle on the floor graph (time along x).
  return {
    functions: [
      r.ode("theta'' = -(g/L)*sin(theta) - c*theta'; theta(0) = th0*pi/180; theta'(0) = 0", BOB, {
        tRange: [0, 10],
        odeAxes: ["t", "theta"],
        odeSteps: 1500,
      }),
      r.define("clock = min(max(time, 0), 10)"),
      // The stand it hangs from.
      r.path("[-2, -1 + 2*t, 4.5]", INK, [0, 1], { outlineWidth: 3 }),
      r.path("[-2, L*sin(t), 4.5 - L*cos(t)]", INK, [0, 2 * Math.PI], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[-2, 0, 4.5 - L*t]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      r.path("[-2, t*L*sin(theta), 4.5 - t*L*cos(theta)]", TEXT, [0, 1], { outlineWidth: 3 }),
      // The angle, as an arc at the pivot.
      r.path("[-2, 0.7*sin(t*theta), 4.5 - 0.7*cos(t*theta)]", BOB, [0, 1], { outlineWidth: 1.5 }),
      // From the bob down to the floor, and across to where its graph has reached.
      r.path("[-2, L*sin(theta), (4.5 - L*cos(theta))*(1 - t)]", BOB, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.path("[-2 + (clock + 2)*t, L*sin(theta) + (theta - L*sin(theta))*t, 0]", BOB, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      spacePoint(r, "[-2, 0, 4.5]", INK),
      spacePoint(r, "bob = [-2, L*sin(theta), 4.5 - L*cos(theta)]", BOB, { dragVars: ["th0"] }),
      note(r, "θ = {{theta*180/pi:0}}°    ω = {{dtheta}} rad/s", BOB, 1.1),
      note(r, "Small-swing period 2π√(L/g) = {{2*pi*sqrt(L/g)}} s", TEXT),
      note(r, "Drag the bob, then Start", TEXT, 0.9),
    ],
    variables: [
      sceneSlider("th0", "Release angle (°)", 60, [-170, 170, 1], "Drag the bob. Wide swings take longer than the formula says.", "start"),
      sceneSlider("L", "Length L (m)", 2.5, [0.5, 4, 0.1], "Longer pendulums swing slower.", "pendulum"),
      sceneSlider("g", "Gravity (m/s²)", 9.8, [0.5, 25, 0.1], "Earth 9.8, Moon 1.6", "pendulum"),
      sceneSlider("c", "Air drag", 0, [0, 1, 0.02], "Slows the swing down over time.", "pendulum"),
    ],
    groups: [sceneGroup("start", "Release"), sceneGroup("pendulum", "Pendulum")],
    timeline: { mode: "once", min: 0, max: 10 },
    view: { x: [-3, 11], y: [-7, 7] },
  };
}

/** One curve in space whose shadows are the position graph and the velocity graph. */
function motionGraphs3D(): SimulationScene {
  const r = sceneRows("kin3");
  const CAR = "#3b82f6";
  const VEL = "#f59e0b";
  const BOTH = "#8b5cf6";
  // The cart runs along y on a track at x = -2. Time runs along x. The purple curve is
  // (t, position, velocity): its shadow on the floor is x(t), on the back wall v(t).
  return {
    functions: [
      r.define("pos(s) = x0 + v0*s + a*s^2/2"),
      r.define("vel(s) = v0 + a*s"),
      r.path("[-2, -6 + 13*t, 0.35]", INK, [0, 1], { outlineWidth: 3 }),
      ...box(r, ["-2.5", "pos(time) - 0.45", "0.35"], ["-1.5", "pos(time) + 0.45", "1.05"], CAR),
      // The whole journey, and how far it has got.
      r.path("[8*t, pos(8*t), 0]", INK, [0, 1], { lineStyle: "dashed", outlineWidth: 1 }),
      r.path("[time*t, pos(time*t), 0]", CAR, [0, 1], { outlineWidth: 3 }),
      r.path("[time*t, 7, vel(time*t)]", VEL, [0, 1], { outlineWidth: 3 }),
      r.path("[time*t, pos(time*t), vel(time*t)]", BOTH, [0, 1], { outlineWidth: 2.5 }),
      r.path("[8*t, 7, 0]", INK, [0, 1], { outlineWidth: 1 }),
      // From the moving point down to each of its shadows, and from the cart to its graph.
      r.path("[time, pos(time), vel(time)*t]", CAR, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.path("[time, pos(time) + (7 - pos(time))*t, vel(time)]", VEL, [0, 1], { lineStyle: "dotted", outlineWidth: 1.5 }),
      r.path("[-2 + (time + 2)*t, pos(time), 0]", INK, [0, 1], { lineStyle: "dotted", outlineWidth: 1 }),
      spacePoint(r, "[time, pos(time), 0]", CAR, { showLabel: true, label: "x(t)", labelPlain: true }),
      spacePoint(r, "[time, 7, vel(time)]", VEL, { showLabel: true, label: "v(t)", labelPlain: true }),
      spacePoint(r, "[time, pos(time), vel(time)]", BOTH),
      // Handles: the cart sets where it starts, the arrow how fast.
      r.arrow("Vector([-2, pos(time), 1.5], [-2, pos(time) + vel(time)/2, 1.5])", VEL, { dragVars: ["v0"], outlineWidth: 3 }),
      spacePoint(r, "[-2, pos(time), 0.7]", CAR, { dragVars: ["x0"] }),
      note(r, "x = {{pos(time)}} m    v = {{vel(time)}} m/s    a = {{a}} m/s²", CAR, 1.1),
      note(r, "Purple: (time, position, velocity)", BOTH),
      note(r, "Floor shadow: x(t).  Back wall: v(t)", TEXT),
      note(r, "Drag the cart and its arrow, then Start", TEXT, 0.9),
    ],
    variables: [
      sceneSlider("x0", "Start position x₀ (m)", -3, [-5, 5, 0.1], "Drag the cart along the track.", "start"),
      sceneSlider("v0", "Start velocity v₀ (m/s)", 3, [-4, 4, 0.1], "Drag the orange arrow on the cart.", "start"),
      sceneSlider("a", "Acceleration a (m/s²)", -0.6, [-2, 2, 0.05], "Constant. Negative slows a cart moving forwards.", "motion"),
    ],
    groups: [sceneGroup("start", "At t = 0"), sceneGroup("motion", "Motion")],
    timeline: { mode: "once", min: 0, max: 8 },
    view: { x: [-4, 10], y: [-7, 7] },
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
    build3d: projectile3D,
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
    build3d: spring3D,
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
    build3d: pendulum3D,
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
    build3d: motionGraphs3D,
  },
];
