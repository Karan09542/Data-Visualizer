// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MathFunction {
  id: string;
  name?: string;
  expr: string;
  color: string;
  visible: boolean;
  type:
    | "function"
    | "parametric"
    | "point"
    | "implicit"
    | "differential"
    | "polar"
    | "vector"
    | "polygon"
    | "inequality"
    | "line";
  compiled?: any;
  expr2?: string; // For parametric x/y or polar r/theta
  compiled2?: any;
  operator?: string;
  error?: string;
  showLabel?: boolean;
  label?: string;
  labelPosition?: [number, number];
  labelRotation?: number; // degrees
  labelScale?: number; // scale factor
  labelFlipX?: boolean;
  labelFlipY?: boolean;
  showLabelPoint?: boolean;
  labelAlignment?: "center" | "above" | "below" | "left" | "right" | "custom";
  fillColor?: string;
  fillOpacity?: number;
  fillPattern?:
    | "solid"
    | "hatch-diagonal"
    | "hatch-reverse"
    | "hatch-cross"
    | "dotted"
    | "grid"
    | "dashed"
    | "math-region";
  patternSpacing?: number;
  patternThickness?: number;
  patternAngle?: number;
  lineStyle?: "solid" | "dashed" | "dotted" | "dashdot";
  outlineWidth?: number;

  // Behaviors
  isDraggable?: boolean;
  isTransformable?: boolean;
  isRotatable?: boolean;
  isResizable?: boolean;
  isPivotEnabled?: boolean;
  showPoint?: boolean;

  // Transform States
  transformTranslate?: [number, number]; // [x, y]
  transformRotate?: number; // radians
  transformScale?: [number, number]; // [sx, sy]
  transformPivot?: [number, number]; // [px, py]

  // Individual Timeline Support
  hasCustomTimeline?: boolean;
  time?: number;
  isPlaying?: boolean;
  timeMin?: number;
  timeMax?: number;
  timeSpeed?: number;
  timeMode?: "loop" | "bounce" | "continuous";
  direction?: number;
}

export interface MathVariable {
  id: string;
  name: string;
  displayName: string;
  description: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  groupId: string;
  showSlider?: boolean;
}

export interface VariableGroup {
  id: string;
  name: string;
  isCollapsed: boolean;
}

export interface MathNodeRendererProps {
  nodeId: string;
  data: any;
  isExpanded: boolean;
  width?: number;
  height?: number;
}

export type FillPatternType =
  | "solid"
  | "hatch-diagonal"
  | "hatch-reverse"
  | "hatch-cross"
  | "dotted"
  | "grid"
  | "dashed"
  | "math-region";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export const MATH_COMPLETIONS = [
  // Basic & Algebraic
  { name: "sin", desc: "Sine of x", insert: "sin(" },
  { name: "cos", desc: "Cosine of x", insert: "cos(" },
  { name: "tan", desc: "Tangent of x", insert: "tan(" },
  { name: "asin", desc: "Inverse sine (arcsin)", insert: "asin(" },
  { name: "acos", desc: "Inverse cosine (arccos)", insert: "acos(" },
  { name: "atan", desc: "Inverse tangent (arctan)", insert: "atan(" },
  { name: "atan2", desc: "Four-quadrant inverse tangent", insert: "atan2(" },
  { name: "exp", desc: "Exponential e^x", insert: "exp(" },
  { name: "log", desc: "Natural logarithm (ln)", insert: "log(" },
  { name: "ln", desc: "Natural logarithm", insert: "ln(" },
  { name: "log10", desc: "Base 10 logarithm", insert: "log10(" },
  { name: "log2", desc: "Base 2 logarithm", insert: "log2(" },
  { name: "sqrt", desc: "Square root", insert: "sqrt(" },
  { name: "cbrt", desc: "Cube root", insert: "cbrt(" },
  { name: "abs", desc: "Absolute value", insert: "abs(" },
  { name: "sign", desc: "Sign of a value (-1, 0, 1)", insert: "sign(" },
  { name: "signum", desc: "Signum / sign of a value", insert: "sign(" },
  { name: "pow", desc: "Calculate base to exponent power", insert: "pow(" },
  { name: "mod", desc: "Modulus/remainder of division", insert: "mod(" },

  // Hyperbolic
  { name: "sinh", desc: "Hyperbolic sine", insert: "sinh(" },
  { name: "cosh", desc: "Hyperbolic cosine", insert: "cosh(" },
  { name: "tanh", desc: "Hyperbolic tangent", insert: "tanh(" },
  { name: "asinh", desc: "Inverse hyperbolic sine", insert: "asinh(" },
  { name: "acosh", desc: "Inverse hyperbolic cosine", insert: "acosh(" },
  { name: "atanh", desc: "Inverse hyperbolic tangent", insert: "atanh(" },

  // Reciprocal Trig
  { name: "sec", desc: "Secant of x", insert: "sec(" },
  { name: "csc", desc: "Cosecant of x", insert: "csc(" },
  { name: "cot", desc: "Cotangent of x", insert: "cot(" },
  { name: "asec", desc: "Inverse secant of x", insert: "asec(" },
  { name: "acsc", desc: "Inverse cosecant of x", insert: "acsc(" },
  { name: "acot", desc: "Inverse cotangent of x", insert: "acot(" },

  // Hyperbolic Reciprocals
  { name: "sech", desc: "Hyperbolic secant", insert: "sech(" },
  { name: "csch", desc: "Hyperbolic cosecant", insert: "csch(" },
  { name: "coth", desc: "Hyperbolic cotangent", insert: "coth(" },

  // Matrices & Linear Algebra
  {
    name: "det",
    desc: "Matrix determinant (e.g. [[x,y,1],[2,3,1],[-1,-3,1]])",
    insert: "det(",
  },
  { name: "matrix", desc: "Create a matrix / 2D array", insert: "matrix(" },
  { name: "cross", desc: "Cross product of 2 vectors", insert: "cross(" },
  { name: "dot", desc: "Dot product of 2 vectors", insert: "dot(" },
  {
    name: "transpose",
    desc: "Transpose a matrix (flip rows/columns)",
    insert: "transpose(",
  },
  { name: "inv", desc: "Inverse of a square matrix", insert: "inv(" },
  {
    name: "identity",
    desc: "Create an identity matrix of size n",
    insert: "identity(",
  },
  { name: "ones", desc: "Create a matrix filled with ones", insert: "ones(" },
  {
    name: "zeros",
    desc: "Create a matrix filled with zeros",
    insert: "zeros(",
  },
  { name: "size", desc: "Get matrix dimensions/length", insert: "size(" },
  {
    name: "concat",
    desc: "Concatenate matrices along an axis",
    insert: "concat(",
  },
  {
    name: "subset",
    desc: "Get or set a subset of a matrix",
    insert: "subset(",
  },
  {
    name: "flatten",
    desc: "Flatten a multi-dimensional matrix",
    insert: "flatten(",
  },
  {
    name: "diag",
    desc: "Extract diagonal or create diagonal matrix",
    insert: "diag(",
  },
  { name: "trace", desc: "Calculate trace of a matrix", insert: "trace(" },
  { name: "kron", desc: "Kronecker product of two matrices", insert: "kron(" },

  // Statistics & Sampling
  { name: "mean", desc: "Mean / average of values", insert: "mean(" },
  { name: "median", desc: "Median of values", insert: "median(" },
  { name: "std", desc: "Standard deviation of values", insert: "std(" },
  { name: "variance", desc: "Variance of values", insert: "variance(" },
  { name: "sum", desc: "Sum of values or matrix", insert: "sum(" },
  { name: "prod", desc: "Product of values or matrix", insert: "prod(" },
  { name: "min", desc: "Minimum value", insert: "min(" },
  { name: "max", desc: "Maximum value", insert: "max(" },

  // Probability, Calculus & Higher Math
  {
    name: "derivative",
    desc: "Symbolic/numerical derivative",
    insert: "derivative(",
  },
  { name: "factorial", desc: "Factorial of an integer", insert: "factorial(" },
  { name: "gamma", desc: "Euler gamma function", insert: "gamma(" },
  { name: "gcd", desc: "Greatest common divisor", insert: "gcd(" },
  { name: "lcm", desc: "Least common multiple", insert: "lcm(" },
  {
    name: "random",
    desc: "Generate a random float in [0, 1)",
    insert: "random(",
  },
  {
    name: "randomInt",
    desc: "Generate a random integer",
    insert: "randomInt(",
  },
  {
    name: "combinations",
    desc: "Number of combinations (nCr)",
    insert: "combinations(",
  },
  {
    name: "permutations",
    desc: "Number of permutations (nPr)",
    insert: "permutations(",
  },

  // Numeric Utility Functions
  { name: "round", desc: "Round to nearest integer", insert: "round(" },
  { name: "floor", desc: "Round down", insert: "floor(" },
  { name: "ceil", desc: "Round up", insert: "ceil(" },
  { name: "fix", desc: "Round towards zero", insert: "fix(" },
  { name: "square", desc: "Square of x (x^2)", insert: "square(" },
  { name: "cube", desc: "Cube of x (x^3)", insert: "cube(" },
  { name: "isPrime", desc: "Checks if number is prime", insert: "isPrime(" },

  // Complex numbers
  { name: "complex", desc: "Create a complex number", insert: "complex(" },
  { name: "conj", desc: "Conjugate of a complex number", insert: "conj(" },
  { name: "re", desc: "Real part of complex number", insert: "re(" },
  { name: "im", desc: "Imaginary part of complex number", insert: "im(" },
  { name: "arg", desc: "Argument / phase of complex number", insert: "arg(" },

  // Constants
  { name: "pi", desc: "Constant π (3.14159...)", insert: "pi" },
  { name: "e", desc: "Constant e (2.71828...)", insert: "e" },
  { name: "phi", desc: "Golden ratio (1.61803...)", insert: "phi" },
  { name: "i", desc: "Imaginary unit constant", insert: "i" },
  { name: "LN2", desc: "Natural log of 2", insert: "LN2" },
  { name: "LN10", desc: "Natural log of 10", insert: "LN10" },
  { name: "LOG2E", desc: "Log base 2 of e", insert: "LOG2E" },
  { name: "LOG10E", desc: "Log base 10 of e", insert: "LOG10E" },
  { name: "SQRT1_2", desc: "Square root of 1/2", insert: "SQRT1_2" },
  { name: "SQRT2", desc: "Square root of 2", insert: "SQRT2" },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

export const generateSafeId = () => {
  return (
    "id_" +
    Math.random().toString(36).substring(2, 11) +
    "_" +
    Date.now().toString(36)
  );
};

export const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const getVarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 85, 65);
};

export const getHexWithAlpha = (baseHex: string, alpha: number) => {
  if (!baseHex) return "#ffffff33";
  let cleanHex = baseHex;
  if (baseHex.startsWith("#")) {
    if (baseHex.length === 9) {
      cleanHex = baseHex.substring(0, 7);
    } else if (baseHex.length === 5) {
      cleanHex =
        "#" +
        baseHex[1] +
        baseHex[1] +
        baseHex[2] +
        baseHex[2] +
        baseHex[3] +
        baseHex[3];
    } else if (baseHex.length === 4) {
      cleanHex =
        "#" +
        baseHex[1] +
        baseHex[1] +
        baseHex[2] +
        baseHex[2] +
        baseHex[3] +
        baseHex[3];
    }
  } else {
    return baseHex;
  }
  const rounded = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  const hexAlpha = rounded.toString(16).padStart(2, "0");
  return `${cleanHex}${hexAlpha}`;
};

export const stripAlpha = (hex: string) => {
  if (hex && hex.startsWith("#") && hex.length === 9) {
    return hex.substring(0, 7);
  }
  return hex;
};

export const getStrokeDasharray = (style?: string) => {
  if (style === "dashed") return "8, 6";
  if (style === "dotted") return "2, 4";
  if (style === "dashdot") return "10, 4, 2, 4";
  return undefined; // solid or undefined
};

export const formatMathError = (errMessage: string): string => {
  if (!errMessage) return errMessage;
  const match =
    errMessage.match(/Undefined symbol\s+([a-zA-Z0-9_]+)/i) ||
    errMessage.match(/Symbol\s+([a-zA-Z0-9_]+)\s+is undefined/i);
  if (match) {
    return `Unknown geometry reference "${match[1]}".`;
  }
  return errMessage;
};
