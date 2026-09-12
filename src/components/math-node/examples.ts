import { MathFunction, MathVariable, COLORS } from "./mathTypes";

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
      hint: "A sine wave with a dot oscillating along it",
      activeClass: "bg-teal-500/10 border-teal-400 dark:border-teal-500 ring-1 ring-teal-400/50",
      labelClass: "text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300",
    },
    {
      key: "ProjectileMotion", category: "Physics", label: "Projectile Motion",
      hint: "The classic parabola, with launch speed and angle",
      activeClass: "bg-rose-500/10 border-rose-400 dark:border-rose-500 ring-1 ring-rose-400/50",
      labelClass: "text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300",
    },
    {
      key: "ProjectileDrag", category: "Physics · ODE", label: "Projectile + Air Drag",
      hint: "Solved numerically, shown against the vacuum parabola (dashed)",
      activeClass: "bg-rose-500/10 border-rose-400 dark:border-rose-500 ring-1 ring-rose-400/50",
      labelClass: "text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300",
    },
    {
      key: "DampedOscillator", category: "Physics · ODE", label: "Damped Oscillator",
      hint: "x'' = -k·x - c·x', solved numerically",
      activeClass: "bg-teal-500/10 border-teal-400 dark:border-teal-500 ring-1 ring-teal-400/50",
      labelClass: "text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300",
    },
    {
      key: "Pendulum", category: "Physics · ODE", label: "Pendulum (phase)",
      hint: "A real pendulum, no small-angle approximation",
      activeClass: "bg-cyan-500/10 border-cyan-400 dark:border-cyan-500 ring-1 ring-cyan-400/50",
      labelClass: "text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
    },
    {
      key: "Orbit", category: "Physics · ODE", label: "Planetary Orbit",
      hint: "Inverse-square gravity; change the speed for an ellipse",
      activeClass: "bg-violet-500/10 border-violet-400 dark:border-violet-500 ring-1 ring-violet-400/50",
      labelClass: "text-violet-600 dark:text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300",
    },
    {
      key: "CircularMotion", category: "Physics", label: "Circular Motion",
      hint: "A point moving around a circle",
      activeClass: "bg-cyan-500/10 border-cyan-400 dark:border-cyan-500 ring-1 ring-cyan-400/50",
      labelClass: "text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
    },
    {
      key: "Wave", category: "Physics", label: "Traveling Wave",
      hint: "A wave moving over time",
      activeClass: "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50",
      labelClass: "text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300",
    },
    {
      key: "Beats", category: "Physics", label: "Beats",
      hint: "Two close frequencies added together",
      activeClass: "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50",
      labelClass: "text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300",
    },
    {
      key: "PredatorPrey", category: "Biology · ODE", label: "Predator & Prey",
      hint: "Lotka–Volterra cycles",
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
      hint: "Sine waves adding into a square wave",
      activeClass: "bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50",
      labelClass: "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
    },
    {
      key: "Statistics", category: "Statistics", label: "Normal Dist.",
      hint: "The bell curve",
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

export const MATH_EXAMPLES: Record<string, { functions: MathFunction[]; variables: MathVariable[] }> = {
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
  Fourier: {
    functions: [
      {
        id: "f1",
        expr: "4/pi * (sin(x) + sin(3*x)/3 + sin(5*x)/5 + sin(7*x)/7)",
        type: "function",
        color: COLORS[2],
        visible: true,
      },
    ],
    variables: [],
  },
  Wave: {
    functions: [
      {
        id: "f1",
        expr: "A * sin(k*x - w*t + phi)",
        type: "function",
        color: COLORS[3],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1",
        name: "A",
        displayName: "Amplitude",
        description: "",
        value: 2,
        defaultValue: 2,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v2",
        name: "k",
        displayName: "Wave Number",
        description: "",
        value: 2,
        defaultValue: 2,
        min: 0,
        max: 10,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v3",
        name: "w",
        displayName: "Angular Freq",
        description: "",
        value: 3,
        defaultValue: 3,
        min: 0,
        max: 10,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v4",
        name: "phi",
        displayName: "Phase String",
        description: "",
        value: 0,
        defaultValue: 0,
        min: 0,
        max: 6.28,
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
  Statistics: {
    functions: [
      {
        id: "f1",
        expr: "(1/(sigma * sqrt(2*pi))) * e^(-0.5 * ((x - mu)/sigma)^2)",
        type: "function",
        color: COLORS[4],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1",
        name: "mu",
        displayName: "Mean",
        description: "Center of distribution",
        value: 0,
        defaultValue: 0,
        min: -10,
        max: 10,
        step: 0.5,
        groupId: "default",
      },
      {
        id: "v2",
        name: "sigma",
        displayName: "Standard Dev",
        description: "Spread of distribution",
        value: 1,
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
    ],
  },
  SimpleHarmonicMotion: {
    functions: [
      {
        id: "f1",
        expr: "A * sin(w*x + phi)",
        type: "function",
        color: COLORS[0],
        visible: true,
      },
      {
        id: "f2",
        expr: "P = [0, A * sin(w*time + phi)]",
        type: "point",
        color: COLORS[1],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1",
        name: "A",
        displayName: "Amplitude",
        description: "How far the oscillation swings from center",
        value: 2,
        defaultValue: 2,
        min: 0,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v2",
        name: "w",
        displayName: "Angular Frequency",
        description: "How fast it oscillates (rad/s)",
        value: 2,
        defaultValue: 2,
        min: 0,
        max: 10,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v3",
        name: "phi",
        displayName: "Phase",
        description: "Starting offset of the oscillation",
        value: 0,
        defaultValue: 0,
        min: 0,
        max: Math.PI * 2,
        step: 0.1,
        groupId: "default",
      },
    ],
  },
  ProjectileMotion: {
    functions: [
      {
        id: "f1",
        expr: "[v0*cos(theta)*t, v0*sin(theta)*t - 0.5*g*t^2]",
        type: "parametric",
        color: COLORS[3],
        visible: true,
        tRange: [0, 2.9],
      },
    ],
    variables: [
      {
        id: "v1",
        name: "v0",
        displayName: "Launch Speed",
        description: "Initial speed at launch (m/s)",
        value: 20,
        defaultValue: 20,
        min: 0,
        max: 40,
        step: 0.5,
        groupId: "default",
      },
      {
        id: "v2",
        name: "theta",
        displayName: "Launch Angle",
        description: "Angle above the horizontal (radians)",
        value: Math.PI / 4,
        defaultValue: Math.PI / 4,
        min: 0,
        max: Math.PI / 2,
        step: 0.01,
        groupId: "default",
      },
      {
        id: "v3",
        name: "g",
        displayName: "Gravity",
        description: "Gravitational acceleration (m/s²)",
        value: 9.8,
        defaultValue: 9.8,
        min: 1,
        max: 20,
        step: 0.1,
        groupId: "default",
      },
    ],
  },
  DampedOscillator: {
    functions: [
      {
        id: "f1",
        expr: "x'' = -k*x - c*x'; x(0) = 1; x'(0) = 0",
        type: "differential",
        color: COLORS[0],
        visible: true,
        tRange: [0, 20],
        odeAxes: ["t", "x"],
        odeAnimate: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "k", displayName: "Spring Constant", description: "Stiffness of the spring",
        value: 1, defaultValue: 1, min: 0, max: 10, step: 0.1, groupId: "default",
      },
      {
        id: "v2", name: "c", displayName: "Damping", description: "Energy lost to friction",
        value: 0.2, defaultValue: 0.2, min: 0, max: 2, step: 0.05, groupId: "default",
      },
    ],
  },
  Pendulum: {
    functions: [
      {
        id: "f1",
        expr: "theta'' = -(g/L)*sin(theta); theta(0) = 2.5; theta'(0) = 0",
        type: "differential",
        color: COLORS[2],
        visible: true,
        tRange: [0, 20],
        odeAxes: ["theta", "theta'"],
        odeAnimate: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "g", displayName: "Gravity", description: "Gravitational acceleration (m/s²)",
        value: 9.8, defaultValue: 9.8, min: 1, max: 20, step: 0.1, groupId: "default",
      },
      {
        id: "v2", name: "L", displayName: "Length", description: "Length of the pendulum (m)",
        value: 1, defaultValue: 1, min: 0.1, max: 5, step: 0.1, groupId: "default",
      },
    ],
  },
  ProjectileDrag: {
    functions: [
      {
        id: "f1",
        expr:
          "x'' = -k*x'*sqrt(x'^2 + y'^2); y'' = -g - k*y'*sqrt(x'^2 + y'^2); x(0) = 0; y(0) = 0; x'(0) = v0*cos(theta); y'(0) = v0*sin(theta)",
        type: "differential",
        color: COLORS[1],
        visible: true,
        tRange: [0, 4],
        odeAxes: ["x", "y"],
        odeAnimate: true,
      },
      {
        id: "f2",
        expr: "[v0*cos(theta)*t, v0*sin(theta)*t - 0.5*g*t^2]",
        type: "parametric",
        color: COLORS[4],
        visible: true,
        tRange: [0, 2.9],
        lineStyle: "dashed",
      },
    ],
    variables: [
      {
        id: "v1", name: "v0", displayName: "Launch Speed", description: "Initial speed (m/s)",
        value: 20, defaultValue: 20, min: 0, max: 40, step: 0.5, groupId: "default",
      },
      {
        id: "v2", name: "theta", displayName: "Launch Angle", description: "Angle above the horizontal (radians)",
        value: Math.PI / 4, defaultValue: Math.PI / 4, min: 0, max: Math.PI / 2, step: 0.01, groupId: "default",
      },
      {
        id: "v3", name: "g", displayName: "Gravity", description: "Gravitational acceleration (m/s²)",
        value: 9.8, defaultValue: 9.8, min: 1, max: 20, step: 0.1, groupId: "default",
      },
      {
        id: "v4", name: "k", displayName: "Air Drag", description: "Drag coefficient (0 = vacuum)",
        value: 0.02, defaultValue: 0.02, min: 0, max: 0.2, step: 0.005, groupId: "default",
      },
    ],
  },
  Orbit: {
    functions: [
      {
        id: "f1",
        expr:
          "x'' = -mu*x/(x^2 + y^2)^1.5; y'' = -mu*y/(x^2 + y^2)^1.5; x(0) = 1; y(0) = 0; x'(0) = 0; y'(0) = v0",
        type: "differential",
        color: COLORS[3],
        visible: true,
        tRange: [0, 20],
        odeSteps: 2000,
        odeAxes: ["x", "y"],
        odeAnimate: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "mu", displayName: "Gravity Strength", description: "Mass of the central body",
        value: 1, defaultValue: 1, min: 0.1, max: 3, step: 0.05, groupId: "default",
      },
      {
        id: "v2", name: "v0", displayName: "Orbital Speed", description: "1 gives a circle; less or more gives an ellipse",
        value: 1, defaultValue: 1, min: 0.3, max: 1.4, step: 0.01, groupId: "default",
      },
    ],
  },
  PredatorPrey: {
    functions: [
      {
        id: "f1",
        expr: "R' = a*R - b*R*F; F' = c*R*F - d*F; R(0) = 10; F(0) = 5",
        type: "differential",
        color: COLORS[2],
        visible: true,
        tRange: [0, 40],
        odeSteps: 2500,
        odeAxes: ["t", "R"],
        odeAnimate: false,
      },
      {
        id: "f2",
        expr: "R' = a*R - b*R*F; F' = c*R*F - d*F; R(0) = 10; F(0) = 5",
        type: "differential",
        color: COLORS[1],
        visible: true,
        tRange: [0, 40],
        odeSteps: 2500,
        odeAxes: ["t", "F"],
        odeAnimate: false,
      },
    ],
    variables: [
      {
        id: "v1", name: "a", displayName: "Prey Growth", description: "How fast prey breed",
        value: 1.1, defaultValue: 1.1, min: 0, max: 3, step: 0.05, groupId: "default",
      },
      {
        id: "v2", name: "b", displayName: "Predation Rate", description: "How often predators catch prey",
        value: 0.4, defaultValue: 0.4, min: 0, max: 2, step: 0.05, groupId: "default",
      },
      {
        id: "v3", name: "c", displayName: "Predator Growth", description: "Prey eaten turned into predators",
        value: 0.1, defaultValue: 0.1, min: 0, max: 1, step: 0.02, groupId: "default",
      },
      {
        id: "v4", name: "d", displayName: "Predator Death", description: "Predator death rate",
        value: 0.4, defaultValue: 0.4, min: 0, max: 2, step: 0.05, groupId: "default",
      },
    ],
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
  },
  Beats: {
    functions: [
      {
        id: "f1",
        expr: "sin(w1*x) + sin(w2*x)",
        type: "function",
        color: COLORS[0],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "w1", displayName: "Frequency 1", description: "First wave's frequency",
        value: 10, defaultValue: 10, min: 0, max: 30, step: 0.1, groupId: "default",
      },
      {
        id: "v2", name: "w2", displayName: "Frequency 2", description: "Close to the first gives beats",
        value: 11, defaultValue: 11, min: 0, max: 30, step: 0.1, groupId: "default",
      },
    ],
  },
  CircularMotion: {
    functions: [
      {
        id: "f1",
        expr: "[r*cos(t), r*sin(t)]",
        type: "parametric",
        color: COLORS[4],
        visible: true,
        tRange: [0, 2 * Math.PI],
      },
      {
        id: "f2",
        expr: "P = [r*cos(w*time), r*sin(w*time)]",
        type: "point",
        color: COLORS[1],
        visible: true,
      },
    ],
    variables: [
      {
        id: "v1", name: "r", displayName: "Radius", description: "Radius of the circle",
        value: 2, defaultValue: 2, min: 0.1, max: 5, step: 0.1, groupId: "default",
      },
      {
        id: "v2", name: "w", displayName: "Angular Speed", description: "Radians per second",
        value: 1, defaultValue: 1, min: 0, max: 5, step: 0.1, groupId: "default",
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
};
