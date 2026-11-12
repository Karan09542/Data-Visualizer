import * as mathjs from "mathjs";

export interface FunctionDomainSpec {
  /** KaTeX source for the function signature, e.g. "\\sin(x)" */
  signature: string;
  /** KaTeX source for the domain. */
  domain: string;
  /** KaTeX source for the range (image). */
  range: string;
  /** KaTeX source for the codomain. */
  codomain: string;
  /** Optional concise prose/LaTeX note. */
  note?: string;
}

export interface UsedFunctionInfo extends FunctionDomainSpec {
  /** Name as typed in the expression (e.g. "ln", "productLog"). */
  name: string;
}

const R_ALL = String.raw`\mathbb{R} = (-\infty, \infty)`;
const R_OR_C = String.raw`\mathbb{R} \;\text{or}\; \mathbb{C}`;
const TRIG_RECIP_PERIOD_NOTE = "Excludes asymptotes where denominator = 0";

const SPEC_SIN: FunctionDomainSpec = {
  signature: String.raw`\sin(x)`,
  domain: R_ALL,
  range: String.raw`[-1, 1]`,
  codomain: R_OR_C,
  note: "Periodic with period 2π",
};

const SPEC_COS: FunctionDomainSpec = {
  signature: String.raw`\cos(x)`,
  domain: R_ALL,
  range: String.raw`[-1, 1]`,
  codomain: R_OR_C,
  note: "Periodic with period 2π",
};

const SPEC_TAN: FunctionDomainSpec = {
  signature: String.raw`\tan(x)`,
  domain: String.raw`\mathbb{R} \setminus \left\{\tfrac{\pi}{2} + k\pi : k \in \mathbb{Z}\right\}`,
  range: R_ALL,
  codomain: R_OR_C,
  note: "Periodic with period π",
};

const SPEC_LN: FunctionDomainSpec = {
  signature: String.raw`\ln(x)`,
  domain: String.raw`(0, \infty) \;\text{(real)} \;\big|\; \mathbb{C} \setminus \{0\} \;\text{(complex)}`,
  range: R_ALL,
  codomain: R_OR_C,
  note: "Natural logarithm (base e)",
};

const SPEC_LAMBERT_W: FunctionDomainSpec = {
  signature: String.raw`W(x),\; W_k(x)`,
  domain: String.raw`\left[-\tfrac{1}{e}, \infty\right) \;(W_0),\;\; \left[-\tfrac{1}{e}, 0\right) \;(W_{-1}),\;\; \mathbb{C} \;\text{(complex)}`,
  range: String.raw`[-1, \infty) \;(W_0),\;\; (-\infty, -1] \;(W_{-1})`,
  codomain: R_OR_C,
  note: "Inverse of w·e^w = x; principal branch W₀ unless k = -1",
};

const SPEC_SIGN: FunctionDomainSpec = {
  signature: String.raw`\operatorname{sign}(x)`,
  domain: R_ALL,
  range: String.raw`\{-1, 0, 1\}`,
  codomain: String.raw`\mathbb{Z} \subset \mathbb{R}`,
};

const SPEC_RE_IM = (name: string): FunctionDomainSpec => ({
  signature: String.raw`\operatorname{${name}}(z)`,
  domain: String.raw`\mathbb{C} \;\text{or}\; \mathbb{R}`,
  range: R_ALL,
  codomain: String.raw`\mathbb{R}`,
});

const SPEC_MATRIX_SCALAR = (signature: string, range: string = R_ALL, codomain = String.raw`\mathbb{R}`): FunctionDomainSpec => ({
  signature,
  domain: String.raw`\mathbb{R}^{n \times n} \;\text{(square matrices)}`,
  range,
  codomain,
});

const SPEC_STATS = (signature: string): FunctionDomainSpec => ({
  signature,
  domain: String.raw`\mathbb{R}^n \;\text{(lists or matrices)}`,
  range: R_ALL,
  codomain: String.raw`\mathbb{R}`,
});

const FUNCTION_CATALOG: Record<string, FunctionDomainSpec> = {
  // Trigonometric & inverse trigonometric
  sin: SPEC_SIN,
  cos: SPEC_COS,
  tan: SPEC_TAN,
  asin: {
    signature: String.raw`\arcsin(x)`,
    domain: String.raw`[-1, 1] \;\text{(real)} \;\big|\; \mathbb{C} \;\text{(complex)}`,
    range: String.raw`\left[-\tfrac{\pi}{2}, \tfrac{\pi}{2}\right]`,
    codomain: R_OR_C,
  },
  acos: {
    signature: String.raw`\arccos(x)`,
    domain: String.raw`[-1, 1] \;\text{(real)} \;\big|\; \mathbb{C} \;\text{(complex)}`,
    range: String.raw`[0, \pi]`,
    codomain: R_OR_C,
  },
  atan: {
    signature: String.raw`\arctan(x)`,
    domain: R_ALL,
    range: String.raw`\left(-\tfrac{\pi}{2}, \tfrac{\pi}{2}\right)`,
    codomain: R_OR_C,
  },
  atan2: {
    signature: String.raw`\operatorname{atan2}(y, x)`,
    domain: String.raw`\mathbb{R}^2 \setminus \{(0, 0)\} \;\text{(0 at origin)}`,
    range: String.raw`(-\pi, \pi]`,
    codomain: String.raw`\mathbb{R}`,
  },
  sec: {
    signature: String.raw`\sec(x)`,
    domain: String.raw`\mathbb{R} \setminus \left\{\tfrac{\pi}{2} + k\pi : k \in \mathbb{Z}\right\}`,
    range: String.raw`(-\infty, -1] \cup [1, \infty)`,
    codomain: R_OR_C,
    note: TRIG_RECIP_PERIOD_NOTE,
  },
  csc: {
    signature: String.raw`\csc(x)`,
    domain: String.raw`\mathbb{R} \setminus \{k\pi : k \in \mathbb{Z}\}`,
    range: String.raw`(-\infty, -1] \cup [1, \infty)`,
    codomain: R_OR_C,
    note: TRIG_RECIP_PERIOD_NOTE,
  },
  cot: {
    signature: String.raw`\cot(x)`,
    domain: String.raw`\mathbb{R} \setminus \{k\pi : k \in \mathbb{Z}\}`,
    range: R_ALL,
    codomain: R_OR_C,
    note: TRIG_RECIP_PERIOD_NOTE,
  },
  asec: {
    signature: String.raw`\operatorname{asec}(x)`,
    domain: String.raw`(-\infty, -1] \cup [1, \infty)`,
    range: String.raw`\left[0, \tfrac{\pi}{2}\right) \cup \left(\tfrac{\pi}{2}, \pi\right]`,
    codomain: R_OR_C,
  },
  acsc: {
    signature: String.raw`\operatorname{acsc}(x)`,
    domain: String.raw`(-\infty, -1] \cup [1, \infty)`,
    range: String.raw`\left[-\tfrac{\pi}{2}, 0\right) \cup \left(0, \tfrac{\pi}{2}\right]`,
    codomain: R_OR_C,
  },
  acot: {
    signature: String.raw`\operatorname{acot}(x)`,
    domain: R_ALL,
    range: String.raw`\left(-\tfrac{\pi}{2}, 0\right) \cup \left(0, \tfrac{\pi}{2}\right]`,
    codomain: R_OR_C,
  },

  // Hyperbolic & inverse hyperbolic
  sinh: {
    signature: String.raw`\sinh(x)`,
    domain: R_ALL,
    range: R_ALL,
    codomain: R_OR_C,
  },
  cosh: {
    signature: String.raw`\cosh(x)`,
    domain: R_ALL,
    range: String.raw`[1, \infty)`,
    codomain: R_OR_C,
  },
  tanh: {
    signature: String.raw`\tanh(x)`,
    domain: R_ALL,
    range: String.raw`(-1, 1)`,
    codomain: R_OR_C,
  },
  sech: {
    signature: String.raw`\operatorname{sech}(x)`,
    domain: R_ALL,
    range: String.raw`(0, 1]`,
    codomain: R_OR_C,
  },
  csch: {
    signature: String.raw`\operatorname{csch}(x)`,
    domain: String.raw`\mathbb{R} \setminus \{0\}`,
    range: String.raw`\mathbb{R} \setminus \{0\}`,
    codomain: R_OR_C,
  },
  coth: {
    signature: String.raw`\coth(x)`,
    domain: String.raw`\mathbb{R} \setminus \{0\}`,
    range: String.raw`(-\infty, -1) \cup (1, \infty)`,
    codomain: R_OR_C,
  },
  asinh: {
    signature: String.raw`\operatorname{asinh}(x)`,
    domain: R_ALL,
    range: R_ALL,
    codomain: R_OR_C,
  },
  acosh: {
    signature: String.raw`\operatorname{acosh}(x)`,
    domain: String.raw`[1, \infty) \;\text{(real)} \;\big|\; \mathbb{C} \;\text{(complex)}`,
    range: String.raw`[0, \infty)`,
    codomain: R_OR_C,
  },
  atanh: {
    signature: String.raw`\operatorname{atanh}(x)`,
    domain: String.raw`(-1, 1) \;\text{(real)} \;\big|\; \mathbb{C} \setminus \{-1, 1\} \;\text{(complex)}`,
    range: R_ALL,
    codomain: R_OR_C,
  },

  // Exponential, logarithmic, powers & roots
  exp: {
    signature: String.raw`e^x`,
    domain: String.raw`\mathbb{R} \;\text{or}\; \mathbb{C}`,
    range: String.raw`(0, \infty) \;\text{(real)}`,
    codomain: String.raw`\mathbb{R} \;\text{or}\; \mathbb{C} \setminus \{0\}`,
  },
  log: SPEC_LN,
  ln: SPEC_LN,
  log10: {
    signature: String.raw`\log_{10}(x)`,
    domain: String.raw`(0, \infty) \;\text{(real)} \;\big|\; \mathbb{C} \setminus \{0\} \;\text{(complex)}`,
    range: R_ALL,
    codomain: R_OR_C,
  },
  log2: {
    signature: String.raw`\log_{2}(x)`,
    domain: String.raw`(0, \infty) \;\text{(real)} \;\big|\; \mathbb{C} \setminus \{0\} \;\text{(complex)}`,
    range: R_ALL,
    codomain: R_OR_C,
  },
  sqrt: {
    signature: String.raw`\sqrt{x}`,
    domain: String.raw`[0, \infty) \;\text{(real)} \;\big|\; \mathbb{C} \;\text{(complex)}`,
    range: String.raw`[0, \infty) \;\text{(real)}`,
    codomain: R_OR_C,
  },
  cbrt: {
    signature: String.raw`\sqrt[3]{x}`,
    domain: R_ALL,
    range: R_ALL,
    codomain: String.raw`\mathbb{R}`,
  },
  nthRoot: {
    signature: String.raw`\sqrt[n]{x}`,
    domain: String.raw`[0, \infty) \;\text{(even } n\text{)} \;\big|\; \mathbb{R} \;\text{(odd } n\text{)}`,
    range: String.raw`[0, \infty) \;\text{(even } n\text{)} \;\big|\; \mathbb{R} \;\text{(odd } n\text{)}`,
    codomain: String.raw`\mathbb{R}`,
  },
  pow: {
    signature: String.raw`x^y`,
    domain: String.raw`x \ge 0 \;\text{for non-integer real } y`,
    range: R_OR_C,
    codomain: R_OR_C,
  },
  square: {
    signature: String.raw`x^2`,
    domain: R_ALL,
    range: String.raw`[0, \infty)`,
    codomain: String.raw`\mathbb{R}`,
  },
  cube: {
    signature: String.raw`x^3`,
    domain: R_ALL,
    range: R_ALL,
    codomain: String.raw`\mathbb{R}`,
  },

  // Lambert W / ProductLog
  productLog: SPEC_LAMBERT_W,
  productlog: SPEC_LAMBERT_W,
  lambertW: SPEC_LAMBERT_W,
  lambertw: SPEC_LAMBERT_W,
  lambertW0: {
    signature: String.raw`W_0(x)`,
    domain: String.raw`\left[-\tfrac{1}{e}, \infty\right)`,
    range: String.raw`[-1, \infty)`,
    codomain: String.raw`\mathbb{R}`,
    note: "Principal real branch W₀",
  },

  // Special & discrete math
  abs: {
    signature: String.raw`|x|`,
    domain: R_OR_C,
    range: String.raw`[0, \infty)`,
    codomain: String.raw`\mathbb{R}`,
  },
  sign: SPEC_SIGN,
  signum: SPEC_SIGN,
  mod: {
    signature: String.raw`x \bmod y`,
    domain: String.raw`\mathbb{R} \times (\mathbb{R} \setminus \{0\})`,
    range: String.raw`[0, |y|) \;\text{(sign matches } y\text{)}`,
    codomain: String.raw`\mathbb{R}`,
  },
  round: {
    signature: String.raw`\operatorname{round}(x)`,
    domain: R_ALL,
    range: String.raw`\mathbb{Z}`,
    codomain: String.raw`\mathbb{Z} \subset \mathbb{R}`,
  },
  floor: {
    signature: String.raw`\lfloor x \rfloor`,
    domain: R_ALL,
    range: String.raw`\mathbb{Z}`,
    codomain: String.raw`\mathbb{Z} \subset \mathbb{R}`,
  },
  ceil: {
    signature: String.raw`\lceil x \rceil`,
    domain: R_ALL,
    range: String.raw`\mathbb{Z}`,
    codomain: String.raw`\mathbb{Z} \subset \mathbb{R}`,
  },
  fix: {
    signature: String.raw`\operatorname{fix}(x)`,
    domain: R_ALL,
    range: String.raw`\mathbb{Z}`,
    codomain: String.raw`\mathbb{Z} \subset \mathbb{R}`,
    note: "Truncates toward zero",
  },
  gamma: {
    signature: String.raw`\Gamma(x)`,
    domain: String.raw`\mathbb{R} \setminus \{0, -1, -2, \dots\}`,
    range: String.raw`\mathbb{R} \setminus \{0\}`,
    codomain: String.raw`\mathbb{R}`,
    note: "Extends factorial: Γ(n) = (n - 1)!",
  },
  factorial: {
    signature: String.raw`n!`,
    domain: String.raw`\mathbb{Z}_{\ge 0} = \{0, 1, 2, \dots\}`,
    range: String.raw`\{1, 2, 6, 24, \dots\} \subset \mathbb{N}`,
    codomain: String.raw`\mathbb{Z}_{\ge 1}`,
  },
  erf: {
    signature: String.raw`\operatorname{erf}(x)`,
    domain: R_ALL,
    range: String.raw`(-1, 1)`,
    codomain: String.raw`\mathbb{R}`,
  },
  gcd: {
    signature: String.raw`\gcd(a, b)`,
    domain: String.raw`\mathbb{Z} \times \mathbb{Z}`,
    range: String.raw`\mathbb{Z}_{\ge 0}`,
    codomain: String.raw`\mathbb{Z}_{\ge 0}`,
  },
  lcm: {
    signature: String.raw`\operatorname{lcm}(a, b)`,
    domain: String.raw`\mathbb{Z} \times \mathbb{Z}`,
    range: String.raw`\mathbb{Z}_{\ge 0}`,
    codomain: String.raw`\mathbb{Z}_{\ge 0}`,
  },
  combinations: {
    signature: String.raw`\binom{n}{k}`,
    domain: String.raw`\mathbb{Z}_{\ge 0}^2 \;\text{with}\; 0 \le k \le n`,
    range: String.raw`\mathbb{Z}_{\ge 1}`,
    codomain: String.raw`\mathbb{Z}_{\ge 1}`,
  },
  permutations: {
    signature: String.raw`P(n, k)`,
    domain: String.raw`\mathbb{Z}_{\ge 0}^2 \;\text{with}\; 0 \le k \le n`,
    range: String.raw`\mathbb{Z}_{\ge 1}`,
    codomain: String.raw`\mathbb{Z}_{\ge 1}`,
  },
  isPrime: {
    signature: String.raw`\operatorname{isPrime}(n)`,
    domain: String.raw`\mathbb{Z}`,
    range: String.raw`\{\text{true}, \text{false}\}`,
    codomain: String.raw`\{\text{true}, \text{false}\}`,
  },
  random: {
    signature: String.raw`\operatorname{random}(a, b)`,
    domain: String.raw`a < b \in \mathbb{R} \;\text{(optional bounds)}`,
    range: String.raw`[a, b) \;\text{(default } [0, 1)\text{)}`,
    codomain: String.raw`\mathbb{R}`,
  },
  randomInt: {
    signature: String.raw`\operatorname{randomInt}(a, b)`,
    domain: String.raw`\mathbb{Z} \times \mathbb{Z} \;(a < b)`,
    range: String.raw`\{a, a + 1, \dots, b - 1\}`,
    codomain: String.raw`\mathbb{Z}`,
  },

  // Complex functions
  complex: {
    signature: String.raw`\operatorname{complex}(x, y)`,
    domain: String.raw`\mathbb{R} \times \mathbb{R}`,
    range: String.raw`\mathbb{C}`,
    codomain: String.raw`\mathbb{C}`,
  },
  re: SPEC_RE_IM("Re"),
  real: SPEC_RE_IM("Re"),
  im: SPEC_RE_IM("Im"),
  imag: SPEC_RE_IM("Im"),
  conj: {
    signature: String.raw`\overline{z}`,
    domain: String.raw`\mathbb{C}`,
    range: String.raw`\mathbb{C}`,
    codomain: String.raw`\mathbb{C}`,
  },
  arg: {
    signature: String.raw`\arg(z)`,
    domain: String.raw`\mathbb{C} \setminus \{0\} \;\text{(0 at origin)}`,
    range: String.raw`(-\pi, \pi]`,
    codomain: String.raw`\mathbb{R}`,
  },
  cis: {
    signature: String.raw`\operatorname{cis}(\theta)`,
    domain: R_ALL,
    range: String.raw`\{z \in \mathbb{C} : |z| = 1\}`,
    codomain: String.raw`\mathbb{C}`,
    note: "Unit circle e^(iθ)",
  },
  polar: {
    signature: String.raw`\operatorname{polar}(r, \theta)`,
    domain: String.raw`\mathbb{R}_{\ge 0} \times \mathbb{R}`,
    range: String.raw`\mathbb{C}`,
    codomain: String.raw`\mathbb{C}`,
  },

  // Statistics & vectors/matrices
  min: SPEC_STATS(String.raw`\min(\dots)`),
  max: SPEC_STATS(String.raw`\max(\dots)`),
  mean: SPEC_STATS(String.raw`\operatorname{mean}(\dots)`),
  median: SPEC_STATS(String.raw`\operatorname{median}(\dots)`),
  std: {
    signature: String.raw`\sigma(\dots)`,
    domain: String.raw`\mathbb{R}^n \;\text{(lists or matrices)}`,
    range: String.raw`[0, \infty)`,
    codomain: String.raw`\mathbb{R}`,
  },
  variance: {
    signature: String.raw`\operatorname{Var}(\dots)`,
    domain: String.raw`\mathbb{R}^n \;\text{(lists or matrices)}`,
    range: String.raw`[0, \infty)`,
    codomain: String.raw`\mathbb{R}`,
  },
  sum: SPEC_STATS(String.raw`\sum(\dots)`),
  prod: SPEC_STATS(String.raw`\prod(\dots)`),
  det: SPEC_MATRIX_SCALAR(String.raw`\det(A)`),
  trace: SPEC_MATRIX_SCALAR(String.raw`\operatorname{tr}(A)`),
  dot: {
    signature: String.raw`\mathbf{u} \cdot \mathbf{v}`,
    domain: String.raw`\mathbb{R}^n \times \mathbb{R}^n`,
    range: R_ALL,
    codomain: String.raw`\mathbb{R}`,
  },
  cross: {
    signature: String.raw`\mathbf{u} \times \mathbf{v}`,
    domain: String.raw`\mathbb{R}^3 \times \mathbb{R}^3`,
    range: String.raw`\mathbb{R}^3`,
    codomain: String.raw`\mathbb{R}^3`,
  },
  inv: {
    signature: String.raw`A^{-1}`,
    domain: String.raw`\{A \in \mathbb{R}^{n \times n} : \det(A) \neq 0\}`,
    range: String.raw`\operatorname{GL}_n(\mathbb{R})`,
    codomain: String.raw`\mathbb{R}^{n \times n}`,
  },
  transpose: {
    signature: String.raw`A^{\mathsf{T}}`,
    domain: String.raw`\mathbb{R}^{m \times n}`,
    range: String.raw`\mathbb{R}^{n \times m}`,
    codomain: String.raw`\mathbb{R}^{n \times m}`,
  },
  hypot: {
    signature: String.raw`\operatorname{hypot}(\dots)`,
    domain: String.raw`\mathbb{R}^n`,
    range: String.raw`[0, \infty)`,
    codomain: String.raw`\mathbb{R}`,
  },
};

function collectFromExpressionSegment(seg: string, found: Set<string>) {
  const trimmed = seg.trim();
  if (!trimmed) return;

  try {
    // Allow single "=" equations by turning them into "==" before mathjs.parse.
    const normalized = trimmed.replace(/(^|[^<>=!])=(?!=)/g, "$1==");
    const node = mathjs.parse(normalized);
    node.traverse((n: any) => {
      if (n.isFunctionNode && typeof n.fn?.name === "string" && n.fn.name in FUNCTION_CATALOG) {
        found.add(n.fn.name);
      }
    });
    return;
  } catch {
    // Fall back to token scan while the expression is mid-edit or uses family syntax.
    for (const match of trimmed.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const name = match[1];
      if (name in FUNCTION_CATALOG) found.add(name);
    }
  }
}

/**
 * Extracts distinct built-in math functions referenced in an input expression
 * and returns their KaTeX-formatted Domain, Range, and Codomain metadata.
 */
export function getUsedFunctionsDomainInfo(expr: string): UsedFunctionInfo[] {
  if (!expr || !expr.trim()) return [];
  const names = new Set<string>();
  for (const part of expr.split(";")) {
    collectFromExpressionSegment(part, names);
  }

  const seenSpecs = new Set<FunctionDomainSpec>();
  const result: UsedFunctionInfo[] = [];
  for (const name of names) {
    const spec = FUNCTION_CATALOG[name];
    if (!spec) continue;
    // Deduplicate exact aliases within the same input (e.g. productLog + lambertw).
    if (seenSpecs.has(spec)) continue;
    seenSpecs.add(spec);
    result.push({ name, ...spec });
  }
  return result;
}

/** Expose all catalog entries so callers/tests can validate KaTeX compilation. */
export const FUNCTION_DOMAIN_CATALOG: Readonly<Record<string, FunctionDomainSpec>> = FUNCTION_CATALOG;
