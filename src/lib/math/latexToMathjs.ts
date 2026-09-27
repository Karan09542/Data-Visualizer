/**
 * Reads LaTeX (typed, pasted, or read from a photo by the formula scanner) into the
 * mathjs text the math node's rows use:
 *
 *   y = x \tan\theta - \frac{g x^2}{2 v_0^2 \cos^2\theta}
 *   → y = x*tan(theta) - (g*x^2)/(2v_0^2*cos(theta)^2)
 *
 * LaTeX is written for the eye, so some of its conventions need a reading:
 *   - letters side by side multiply (mgh is m*g*h), digits side by side join (9 0 is 90);
 *   - a function takes the product after it as its argument (\sin 3\theta is sin(3theta));
 *   - \frac{dx}{dt}, \dot x and x' are derivatives, which become a differential-equation row;
 *   - multi-line environments (aligned, array) become one row per line.
 *
 * Every line is also sorted into the kind of row it makes (curve, definition, implicit
 * curve, region, ODE, calculator), since that is how the math node draws it.
 */
import * as mathjs from "mathjs";
import { parseOdeSystem } from "./odeSystem";

export type LatexRowKind =
  | "function" // y = …, or an expression in x
  | "definition" // k = 2, f(x) = …: named, not drawn by itself
  | "implicit" // x^2 + y^2 = 25
  | "inequality" // y <= 2x + 1
  | "point" // [2, 3]
  | "polar" // r = 2 sin(3θ), stored as its right side
  | "differential" // x'' = -k/m*x
  | "calculator"; // 2^10 + 5: a number, not a graph

export interface LatexLine {
  /** The LaTeX this line came from. */
  latex: string;
  /** mathjs text for the row. Missing when the line couldn't be read. */
  expr?: string;
  kind?: LatexRowKind;
  error?: string;
  /** Things worth knowing about the reading (a renamed variable, a guessed meaning). */
  notes: string[];
  /** Names left for sliders: not x, y, t, constants, or names defined on the line. */
  symbols: string[];
  /**
   * Names mathjs already gives a meaning (phi is the golden ratio, tau is 2π, gamma is a
   * function). The formula means a quantity, so they need a slider to mean it.
   */
  shadowed: string[];
  /** For a named function (f(x) = …): a row that draws it. */
  plotExpr?: string;
  /** A name for the row, so other rows can refer to it (the P in P = (2, 3)). */
  name?: string;
}

class ConvertError extends Error {}

// ─── Tokens ──────────────────────────────────────────────────────────────────

type Tok =
  | { t: "cmd"; v: string } // \frac → "frac", \, → ","
  | { t: "num"; v: string }
  | { t: "letter"; v: string }
  | { t: "sym"; v: string }; // + - = ( ) { } ^ _ & | ' ! , ; < > [ ] / * . : and "\\\\" (new row)

/** Spacing, sizing and styling commands: they change how a formula looks, not what it says. */
const IGNORED = new Set([
  ",", ";", ":", "!", " ", ">", "quad", "qquad", "enspace", "thinspace", "medspace", "thickspace",
  "negthinspace", "displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "limits", "nolimits",
  "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr",
  "bigm", "Bigm", "mathstrut", "strut", "nonumber", "notag", "label", "tag", "phantom", "hphantom", "vphantom",
]);

/** Commands whose argument is dropped entirely (\color{red}, \hspace{1em}). */
const DROP_WITH_ARG = new Set(["color", "hspace", "vspace", "hspace*", "label", "tag", "phantom", "hphantom", "vphantom"]);

/** Commands that wrap their argument for looks only (\boxed{x} means x). */
const TRANSPARENT = new Set(["boxed", "underline", "cancel", "bcancel", "xcancel", "underbrace", "overbrace", "mathstrut", "unicode"]);

/** Spellings some writers (and the scanner) use for common symbols. */
const ORTHOGRAPHY: [RegExp, string][] = [
  [/\\infin\b/g, "\\infty"],
  [/\\rarr\b/g, "\\rightarrow"],
  [/\\larr\b/g, "\\leftarrow"],
  [/\\Rarr\b/g, "\\Rightarrow"],
  [/\\harr\b/g, "\\leftrightarrow"],
  [/\\dfrac\b/g, "\\frac"],
  [/\\tfrac\b/g, "\\frac"],
  [/\\cfrac\b/g, "\\frac"],
  [/\\dbinom\b/g, "\\binom"],
  [/\\tbinom\b/g, "\\binom"],
];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  const nextNonSpace = (j: number) => {
    while (j < src.length && /\s/.test(src[j])) j++;
    return j;
  };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c) || c === "~") {
      i++;
      continue;
    }
    if (c === "%") {
      // A LaTeX comment runs to the end of the line.
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "\\") {
      const rest = src.slice(i + 1);
      const word = rest.match(/^[A-Za-z]+\*?/);
      if (word) {
        out.push({ t: "cmd", v: word[0] });
        i += 1 + word[0].length;
      } else if (rest[0] === "\\") {
        out.push({ t: "sym", v: "\\\\" });
        i += 2;
      } else if (rest.length > 0) {
        out.push({ t: "cmd", v: rest[0] });
        i += 2;
      } else i++;
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(src[nextNonSpace(i + 1)]))) {
      // Digits join across spaces: LaTeX ignores the space in "9 0", and the scanner
      // writes every digit as its own token.
      let v = "";
      let j = i;
      while (j < src.length) {
        const k = nextNonSpace(j);
        const ch = src[k];
        if (isDigit(ch)) v += ch;
        else if (ch === "." && !v.includes(".") && isDigit(src[nextNonSpace(k + 1)])) v += ch;
        else break;
        j = k + 1;
      }
      out.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      out.push({ t: "letter", v: c });
      i++;
      continue;
    }
    if (c === "$") {
      i++;
      continue;
    }
    out.push({ t: "sym", v: c });
    i++;
  }
  return out;
}

const isSym = (tok: Tok | undefined, v: string) => !!tok && tok.t === "sym" && tok.v === v;
const isCmd = (tok: Tok | undefined, v: string) => !!tok && tok.t === "cmd" && tok.v === v;

/** Removes styling commands, and the arguments of the ones that only take styling. */
function stripStyling(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.t === "cmd" && DROP_WITH_ARG.has(tok.v)) {
      if (isSym(toks[i + 1], "{")) i = matchBrace(toks, i + 1);
      continue;
    }
    if (tok.t === "cmd" && IGNORED.has(tok.v)) continue;
    if (tok.t === "cmd" && tok.v === "textcolor") {
      // \textcolor{red}{x}: keep x.
      if (isSym(toks[i + 1], "{")) i = matchBrace(toks, i + 1);
      continue;
    }
    out.push(tok);
  }
  return out;
}

/** Index of the "}" matching the "{" at `open`. */
function matchBrace(toks: Tok[], open: number): number {
  let depth = 0;
  for (let i = open; i < toks.length; i++) {
    if (isSym(toks[i], "{")) depth++;
    else if (isSym(toks[i], "}")) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new ConvertError("A “{” has no matching “}”.");
}

/** Index of the \end{name} matching the \begin{name} at `begin`. */
function matchEnv(toks: Tok[], begin: number): number {
  let depth = 0;
  for (let i = begin; i < toks.length; i++) {
    if (isCmd(toks[i], "begin")) depth++;
    else if (isCmd(toks[i], "end")) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new ConvertError("A \\begin has no matching \\end.");
}

/** Letters inside {…}, e.g. \begin{pmatrix} → "pmatrix", \mathrm{a n d} → "and". */
function groupWord(toks: Tok[]): string | null {
  let word = "";
  for (const tok of toks) {
    if (tok.t === "letter" || tok.t === "num") word += tok.v;
    else if (tok.t === "sym" && tok.v === "*") word += "*";
    else return null;
  }
  return word;
}

/** {…} around a whole table cell only groups it: { y = 2x } is y = 2x. */
function unwrapCell(cell: Tok[]): Tok[] {
  let c = cell;
  while (c.length >= 2 && isSym(c[0], "{") && matchBrace(c, 0) === c.length - 1) c = c.slice(1, -1);
  return c;
}

/** Splits at a separator that sits outside any braces or environments. */
function splitTop(toks: Tok[], isSep: (tok: Tok) => boolean): Tok[][] {
  const parts: Tok[][] = [[]];
  let depth = 0;
  for (const tok of toks) {
    if (isSym(tok, "{") || isCmd(tok, "begin") || isCmd(tok, "left")) depth++;
    else if (isSym(tok, "}") || isCmd(tok, "end") || isCmd(tok, "right")) depth--;
    if (depth === 0 && isSep(tok)) parts.push([]);
    else parts[parts.length - 1].push(tok);
  }
  return parts;
}

// ─── Syntax tree ─────────────────────────────────────────────────────────────

type Node =
  | { k: "num"; v: string }
  | { k: "sym"; name: string }
  | { k: "call"; fn: string; args: Node[] }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "neg"; a: Node }
  | { k: "fact"; a: Node }
  | { k: "rel"; ops: string[]; items: Node[] }
  | { k: "list"; rows: Node[][]; matrix: boolean } // [a, b] or [[a, b], [c, d]]
  | { k: "cond"; branches: { value: Node; cond?: Node }[] }
  | { k: "deg"; a: Node }
  | { k: "deriv"; name: string; order: number; at?: Node } // x'' or x'(0)
  | { k: "range"; a: Node; b: Node }
  | { k: "fndef"; name: string; params: string[]; body: Node };

const GREEK: Record<string, string> = {
  alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", epsilon: "epsilon", varepsilon: "epsilon",
  zeta: "zeta", eta: "eta", theta: "theta", vartheta: "theta", iota: "iota", kappa: "kappa", varkappa: "kappa",
  lambda: "lambda", mu: "mu", nu: "nu", xi: "xi", omicron: "omicron", pi: "pi", varpi: "varpi", rho: "rho",
  varrho: "rho", sigma: "sigma", varsigma: "sigma", tau: "tau", upsilon: "upsilon", phi: "phi", varphi: "phi",
  chi: "chi", psi: "psi", omega: "omega",
  Gamma: "Gamma", Delta: "Delta", Theta: "Theta", Lambda: "Lambda", Xi: "Xi", Pi: "Pi", Sigma: "Sigma",
  Upsilon: "Upsilon", Phi: "Phi", Psi: "Psi", Omega: "Omega", ell: "l", hbar: "hbar",
};

/** LaTeX function commands, and what mathjs calls them. */
const FUNCTIONS: Record<string, string> = {
  sin: "sin", cos: "cos", tan: "tan", sec: "sec", csc: "csc", cot: "cot",
  arcsin: "asin", arccos: "acos", arctan: "atan", arcsec: "asec", arccsc: "acsc", arccot: "acot",
  sinh: "sinh", cosh: "cosh", tanh: "tanh", coth: "coth", sech: "sech", csch: "csch",
  arsinh: "asinh", arcosh: "acosh", artanh: "atanh", arcsinh: "asinh", arccosh: "acosh", arctanh: "atanh",
  ln: "ln", log: "log10", lg: "log10", exp: "exp", det: "det", max: "max", min: "min", gcd: "gcd", lcm: "lcm",
  arg: "arg", Re: "re", Im: "im",
};

/** Function names written as words (\operatorname{sgn}, or plain "sin" typed without a backslash). */
const WORD_FUNCTIONS: Record<string, string> = {
  ...FUNCTIONS,
  asin: "asin", acos: "acos", atan: "atan", sgn: "sign", sign: "sign", abs: "abs", floor: "floor",
  ceil: "ceil", round: "round", sqrt: "sqrt", cbrt: "cbrt", erf: "erf", mod: "mod", re: "re", im: "im",
  log10: "log10", log2: "log2", tr: "trace", trace: "trace", rank: "rank", diag: "diag",
};

/** Function names safe to recognise without a backslash or brackets (sin x). */
const TYPED_FUNCTIONS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot", "sinh", "cosh", "tanh", "asin", "acos", "atan",
  "arcsin", "arccos", "arctan", "exp", "log", "sqrt", "abs",
]);

const INVERSE: Record<string, string> = {
  sin: "asin", cos: "acos", tan: "atan", sec: "asec", csc: "acsc", cot: "acot",
  sinh: "asinh", cosh: "acosh", tanh: "atanh",
};

const RELATIONS: Record<string, string> = {
  "=": "=", "<": "<", ">": ">", le: "<=", leq: "<=", leqslant: "<=", ge: ">=", geq: ">=", geqslant: ">=",
  lt: "<", gt: ">", ne: "!=", neq: "!=", approx: "=", equiv: "=", simeq: "=", cong: "=",
};

const UNSUPPORTED: Record<string, string> = {
  int: "Integrals can't be turned into a row yet.",
  iint: "Integrals can't be turned into a row yet.",
  iiint: "Integrals can't be turned into a row yet.",
  oint: "Integrals can't be turned into a row yet.",
  lim: "Limits can't be turned into a row yet.",
  partial: "Partial derivatives can't be turned into a row yet.",
  nabla: "∇ can't be turned into a row yet.",
  pm: "± gives two answers: edit it to + or −.",
  mp: "∓ gives two answers: edit it to + or −.",
  cdots: "“…” can't be turned into a row: write the terms out, or use a sum (Σ).",
  ldots: "“…” can't be turned into a row: write the terms out, or use a sum (Σ).",
  dots: "“…” can't be turned into a row: write the terms out, or use a sum (Σ).",
  vdots: "“⋮” can't be turned into a row.",
  rightarrow: "Arrows (→) can't be turned into a row.",
  to: "Arrows (→) can't be turned into a row.",
  leftarrow: "Arrows can't be turned into a row.",
  Rightarrow: "“⇒” can't be turned into a row.",
  leftrightarrow: "Arrows can't be turned into a row.",
  mapsto: "“↦” can't be turned into a row.",
  forall: "“∀” can't be turned into a row.",
  exists: "“∃” can't be turned into a row.",
  in: "“∈” can't be turned into a row.",
  subset: "Set notation can't be turned into a row.",
  cup: "Set notation can't be turned into a row.",
  cap: "Set notation can't be turned into a row.",
  otimes: "“⊗” can't be turned into a row.",
  oplus: "“⊕” can't be turned into a row.",
  langle: "Angle brackets (⟨ ⟩) can't be turned into a row.",
};

/** Words that join two statements: "x = 1 and y = 2". */
const CONNECTOR_WORDS = new Set(["and", "where", "with", "for", "when", "if", "or", "otherwise", "else"]);

const MATRIX_ENVS: Record<string, string | null> = {
  matrix: null, pmatrix: null, bmatrix: null, Bmatrix: null, smallmatrix: null, vmatrix: "det", Vmatrix: "norm",
};
const LINE_ENVS = new Set([
  "array", "aligned", "align", "align*", "gather", "gather*", "gathered", "eqnarray", "eqnarray*", "split",
  "multline", "multline*", "alignat", "alignat*", "alignedat", "equation", "equation*", "displaymath",
]);

// ─── Parser ──────────────────────────────────────────────────────────────────

interface Shared {
  notes: Set<string>;
  /** Independent variable of a derivative written as d/dx (x), so it can become t. */
  indep: Set<string>;
  /** Names bound inside the formula (sum indices, function parameters). */
  bound: Set<string>;
  sums: number;
}

const CALLABLE_LETTERS = new Set(["f", "g", "h"]);

class Parser {
  private i = 0;
  private absDepth = 0;

  constructor(
    private toks: Tok[],
    private shared: Shared,
  ) {}

  private peek(o = 0) {
    return this.toks[this.i + o];
  }
  private next() {
    return this.toks[this.i++];
  }
  private done() {
    return this.i >= this.toks.length;
  }
  private fail(message: string): never {
    throw new ConvertError(message);
  }
  private describe(tok: Tok | undefined) {
    if (!tok) return "the end";
    return tok.t === "cmd" ? `\\${tok.v}` : `“${tok.v}”`;
  }

  private sub(toks: Tok[]): Node {
    const p = new Parser(toks, this.shared);
    return p.parseAll();
  }

  /** The whole token list as one relation or expression. */
  parseAll(): Node {
    if (this.toks.length === 0) this.fail("Something is missing: an empty group “{ }”.");
    const node = this.parseRelation();
    if (!this.done()) this.fail(`Couldn't read ${this.describe(this.peek())} here.`);
    return node;
  }

  /** {…} as a token list, or the single token that stands for a group (x^2, \frac12). */
  private groupTokens(): Tok[] {
    const tok = this.peek();
    if (!tok) this.fail("Something is missing at the end.");
    if (isSym(tok, "{")) {
      const close = matchBrace(this.toks, this.i);
      const inner = this.toks.slice(this.i + 1, close);
      this.i = close + 1;
      return inner;
    }
    this.i++;
    if (tok.t === "cmd" && (tok.v in GREEK || tok.v === "infty" || tok.v === "circ" || tok.v === "prime")) return [tok];
    if (tok.t === "cmd" && tok.v === "frac") {
      // \frac as a single token argument is unusual but valid: ^\frac12.
      const a = this.groupTokens();
      const b = this.groupTokens();
      return [tok, { t: "sym", v: "{" }, ...a, { t: "sym", v: "}" }, { t: "sym", v: "{" }, ...b, { t: "sym", v: "}" }];
    }
    if (tok.t === "num" && tok.v.length > 1) {
      // \frac12 is \frac{1}{2}: a bare digit argument is one digit.
      this.toks.splice(this.i, 0, { t: "num", v: tok.v.slice(1) });
      return [{ t: "num", v: tok.v[0] }];
    }
    return [tok];
  }

  private relationOp(tok: Tok | undefined): string | null {
    if (!tok) return null;
    if (tok.t === "sym" && (tok.v === "=" || tok.v === "<" || tok.v === ">")) {
      const after = this.peek(1);
      if ((tok.v === "<" || tok.v === ">") && isSym(after, "=")) return tok.v + "=";
      return tok.v;
    }
    if (tok.t === "sym" && tok.v === "!" && isSym(this.peek(1), "=")) return "!=";
    if (tok.t === "cmd" && tok.v in RELATIONS) {
      if (tok.v === "approx") this.shared.notes.add("“≈” was read as “=”.");
      return RELATIONS[tok.v];
    }
    return null;
  }

  parseRelation(): Node {
    const items = [this.parseExpr()];
    const ops: string[] = [];
    for (;;) {
      const op = this.relationOp(this.peek());
      if (!op) break;
      const tok = this.next();
      if (tok.t === "sym" && (op.length === 2)) this.next(); // "<=" written as two symbols
      ops.push(op);
      items.push(this.parseExpr());
    }
    return ops.length ? { k: "rel", ops, items } : items[0];
  }

  parseExpr(): Node {
    let negate = false;
    while (isSym(this.peek(), "+") || isSym(this.peek(), "-")) {
      if (this.next().v === "-") negate = !negate;
    }
    let node = this.parseTerm();
    if (negate) node = { k: "neg", a: node };
    for (;;) {
      const tok = this.peek();
      if (isSym(tok, "+") || isSym(tok, "-")) {
        this.next();
        let rhsNeg = tok!.v === "-";
        while (isSym(this.peek(), "+") || isSym(this.peek(), "-")) if (this.next().v === "-") rhsNeg = !rhsNeg;
        const rhs = this.parseTerm();
        node = { k: "bin", op: rhsNeg ? "-" : "+", a: node, b: rhs };
      } else if (tok?.t === "cmd" && (tok.v === "pm" || tok.v === "mp")) {
        this.fail(UNSUPPORTED[tok.v]);
      } else break;
    }
    return node;
  }

  /** Can this token begin a factor, so that it multiplies what came before? */
  private startsFactor(tok: Tok | undefined): boolean {
    if (!tok) return false;
    if (tok.t === "num" || tok.t === "letter") return true;
    if (tok.t === "sym") {
      if (tok.v === "(" || tok.v === "[" || tok.v === "{") return true;
      if (tok.v === "|") return this.absDepth === 0;
      return false;
    }
    const v = tok.v;
    if (v in RELATIONS || v === "cdot" || v === "times" || v === "div" || v === "ast" || v === "pm" || v === "mp") return false;
    if (v === "right" || v === "end" || v === "rfloor" || v === "rceil" || v === "rvert" || v === "rVert") return false;
    if (v === "vert" || v === "|" || v === "lvert") return this.absDepth === 0;
    if (v === "text" || v === "mathrm" || v === "textrm" || v === "operatorname") {
      // \text{and} joins statements rather than multiplying.
      const word = this.peekWordArg();
      if (word && CONNECTOR_WORDS.has(word)) return false;
    }
    return true;
  }

  private peekWordArg(): string | null {
    if (!isSym(this.peek(1), "{")) return null;
    try {
      const close = matchBrace(this.toks, this.i + 1);
      return groupWord(this.toks.slice(this.i + 2, close));
    } catch {
      return null;
    }
  }

  parseTerm(): Node {
    let node = this.parsePostfix();
    for (;;) {
      const tok = this.peek();
      if (isSym(tok, "*") || isCmd(tok, "cdot") || isCmd(tok, "times") || isCmd(tok, "ast")) {
        this.next();
        node = { k: "bin", op: "*", a: node, b: this.parsePostfix() };
      } else if (isSym(tok, "/") || isCmd(tok, "div")) {
        this.next();
        node = { k: "bin", op: "/", a: node, b: this.parsePostfix() };
      } else if (this.startsFactor(tok)) {
        node = { k: "bin", op: "*", a: node, b: this.parsePostfix() };
      } else break;
    }
    return node;
  }

  /** A factor with what follows it: powers, !, primes, %, degrees. */
  parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      const tok = this.peek();
      if (isSym(tok, "^")) {
        this.next();
        const exp = this.groupTokens();
        if (exp.length > 0 && exp.every((e) => isCmd(e, "circ"))) {
          node = { k: "deg", a: node };
          continue;
        }
        if (exp.length > 0 && exp.every((e) => isCmd(e, "prime") || isSym(e, "'"))) {
          node = this.derivative(node, exp.length);
          continue;
        }
        node = { k: "bin", op: "^", a: node, b: this.sub(exp) };
      } else if (isSym(tok, "'")) {
        let order = 0;
        while (isSym(this.peek(), "'")) {
          this.next();
          order++;
        }
        node = this.derivative(node, order);
      } else if (isCmd(tok, "prime")) {
        this.next();
        node = this.derivative(node, 1);
      } else if (isSym(tok, "!") && !isSym(this.peek(1), "=")) {
        this.next();
        node = { k: "fact", a: node };
      } else if (isCmd(tok, "%")) {
        this.next();
        node = { k: "bin", op: "/", a: node, b: { k: "num", v: "100" } };
      } else if (isCmd(tok, "circ") && (node.k === "num" || node.k === "sym")) {
        this.next();
        node = { k: "deg", a: node };
      } else if (isSym(tok, "_")) {
        this.fail("A subscript here (like the bar in f|ₓ₌₁) can't be turned into a row.");
      } else if (node.k === "deriv" && !node.at && isSym(tok, "(")) {
        // x'(0) = 1: a starting value for a differential equation.
        const inner = this.bracketed("(", ")");
        node = { ...node, at: this.sub(inner) };
      } else break;
    }
    return node;
  }

  private derivative(node: Node, order: number): Node {
    if (node.k === "sym") return { k: "deriv", name: node.name, order };
    if (node.k === "deriv") return { ...node, order: node.order + order };
    return this.fail("A prime (′) can only follow a name, like x′ or y″.");
  }

  /** Tokens between an opening bracket at the cursor and its match. */
  private bracketed(open: string, close: string): Tok[] {
    const start = this.i;
    let depth = 0;
    for (let j = start; j < this.toks.length; j++) {
      const tok = this.toks[j];
      if (isSym(tok, "{")) {
        j = matchBrace(this.toks, j);
        continue;
      }
      if (isSym(tok, open)) depth++;
      else if (isSym(tok, close)) {
        depth--;
        if (depth === 0) {
          this.i = j + 1;
          return this.toks.slice(start + 1, j);
        }
      }
    }
    return this.fail(`A “${open}” has no matching “${close}”.`);
  }

  /** (a, b) or [a, b]: a grouped expression, or a point/vector when it has commas. */
  private grouped(inner: Tok[]): Node {
    const parts = splitTop(inner, (t) => isSym(t, ",")).filter((p) => p.length > 0);
    if (parts.length > 1) return { k: "list", rows: [parts.map((p) => this.sub(p))], matrix: false };
    return this.sub(inner);
  }

  /** An identifier: a letter or Greek name, with an optional subscript (v_0, x_{max}). */
  private identifier(base: string): Node {
    let name = base;
    if (isSym(this.peek(), "_")) {
      this.next();
      const subToks = this.groupTokens();
      let suffix = "";
      for (const s of subToks) {
        if (s.t === "letter" || s.t === "num") suffix += s.v;
        else if (s.t === "cmd" && s.v in GREEK) suffix += GREEK[s.v];
        else if (s.t === "cmd" && (s.v === "mathrm" || s.v === "text" || s.v === "rm")) continue;
        else if (isSym(s, "{") || isSym(s, "}")) continue;
        else if (isSym(s, ",")) suffix += "_";
        else return this.fail(`The subscript in ${base}_{…} can't be part of a name.`);
      }
      if (suffix) name = `${base}_${suffix}`;
    }
    return { k: "sym", name };
  }

  private word(toks: Tok[]): string | null {
    return groupWord(toks.filter((t) => !isSym(t, "{") && !isSym(t, "}")));
  }

  parsePrimary(): Node {
    const tok = this.peek();
    if (!tok) return this.fail("Something is missing at the end.");

    if (tok.t === "num") {
      this.next();
      return { k: "num", v: tok.v };
    }

    if (tok.t === "letter") {
      // Plain words typed without a backslash: sin x, sqrt(2). Letters side by side
      // otherwise multiply, so only well-known names followed by "(" or 3+ letters count.
      let run = "";
      for (let j = this.i; this.toks[j]?.t === "letter"; j++) run += this.toks[j].v;
      const bracketNext = isSym(this.toks[this.i + run.length], "(");
      if (run in WORD_FUNCTIONS && ((run.length >= 3 && TYPED_FUNCTIONS.has(run)) || (run.length >= 2 && bracketNext))) {
        this.i += run.length;
        return this.applyFunction(WORD_FUNCTIONS[run]);
      }
      const start = this.i;
      this.next();
      const node = this.identifier(tok.v);
      if (node.k === "sym" && isSym(this.peek(), "(") && this.isCallable(node.name, start)) {
        const inner = this.bracketed("(", ")");
        const args = splitTop(inner, (t) => isSym(t, ",")).map((p) => this.sub(p));
        return { k: "call", fn: node.name, args };
      }
      return node;
    }

    if (tok.t === "sym") {
      switch (tok.v) {
        case "(": {
          const inner = this.bracketed("(", ")");
          return this.grouped(inner);
        }
        case "[": {
          const inner = this.bracketed("[", "]");
          return this.grouped(inner);
        }
        case "{": {
          const close = matchBrace(this.toks, this.i);
          const inner = this.toks.slice(this.i + 1, close);
          this.i = close + 1;
          if (inner.length === 0) return this.parsePrimary();
          return this.sub(inner);
        }
        case "|": {
          this.next();
          return this.absolute("|");
        }
        case "-": {
          this.next();
          return { k: "neg", a: this.parsePostfix() };
        }
        case "+": {
          this.next();
          return this.parsePostfix();
        }
      }
      return this.fail(`Couldn't read ${this.describe(tok)} here.`);
    }

    // Commands
    const v = tok.v;
    this.next();

    if (v in GREEK) return this.identifier(GREEK[v]);
    if (v in FUNCTIONS) return this.applyFunction(FUNCTIONS[v]);
    if (v in UNSUPPORTED) return this.fail(UNSUPPORTED[v]);

    switch (v) {
      case "frac":
        return this.fraction();
      case "sqrt": {
        let index: Tok[] | null = null;
        if (isSym(this.peek(), "[")) index = this.bracketed("[", "]");
        const radicand = this.sub(this.groupTokens());
        if (!index) return { k: "call", fn: "sqrt", args: [radicand] };
        const n = this.sub(index);
        if (n.k === "num" && n.v === "2") return { k: "call", fn: "sqrt", args: [radicand] };
        if (n.k === "num" && n.v === "3") return { k: "call", fn: "cbrt", args: [radicand] };
        return { k: "call", fn: "nthRoot", args: [radicand, n] };
      }
      case "binom": {
        const n = this.sub(this.groupTokens());
        const k = this.sub(this.groupTokens());
        return { k: "call", fn: "combinations", args: [n, k] };
      }
      case "infty":
        return { k: "sym", name: "Infinity" };
      case "left":
        return this.leftRight();
      case "vert":
      case "lvert":
      case "|":
        return this.absolute(v === "|" ? "\\|" : "|");
      case "lVert":
        return this.absolute("\\|");
      case "lfloor":
        return { k: "call", fn: "floor", args: [this.sub(this.until("rfloor"))] };
      case "lceil":
        return { k: "call", fn: "ceil", args: [this.sub(this.until("rceil"))] };
      case "{": {
        // \{ … \} as brackets
        const inner = this.untilCmd("}");
        return this.grouped(inner);
      }
      case "sum":
      case "prod":
        return this.bigOperator(v);
      case "begin":
        return this.environment();
      case "dot":
      case "ddot":
      case "dddot": {
        const inner = this.sub(this.groupTokens());
        if (inner.k !== "sym") return this.fail(`\\${v} can only mark a name, like \\dot{x}.`);
        return { k: "deriv", name: inner.name, order: v === "dot" ? 1 : v === "ddot" ? 2 : 3 };
      }
      case "vec":
      case "overrightarrow":
      case "mathbf":
      case "boldsymbol":
      case "bm":
      case "mathbb":
      case "mathcal":
      case "mathit":
      case "mathsf":
      case "mathtt":
      case "mathnormal":
        return this.styled(this.groupTokens());
      case "hat":
      case "widehat":
      case "bar":
      case "overline":
      case "tilde":
      case "widetilde": {
        const inner = this.sub(this.groupTokens());
        if (inner.k !== "sym") return inner;
        const suffix = v.includes("hat") ? "hat" : v.includes("tilde") ? "tilde" : "bar";
        return { k: "sym", name: `${inner.name}_${suffix}` };
      }
      case "operatorname":
      case "operatorname*":
      case "mathrm":
      case "textrm":
      case "text":
      case "textit":
      case "rm":
        return this.named(this.groupTokens());
      case "circ":
        return this.fail("“∘” can only mark degrees, like 30^\\circ.");
      case "prime":
        return this.fail("A prime (′) can only follow a name, like x′.");
    }
    if (TRANSPARENT.has(v)) return this.sub(this.groupTokens());
    if (IGNORED.has(v)) return this.parsePrimary();
    return this.fail(`\\${v} isn't something a row can use.`);
  }

  /** Letters that are called with brackets: f(x), and names defined as functions on this line. */
  private isCallable(name: string, start: number): boolean {
    if (CALLABLE_LETTERS.has(name)) return true;
    // At the start of a line, "x(t) = …" defines a function.
    if (this.toks.slice(0, start).every((t) => isSym(t, "{"))) {
      const close = this.findClose(this.i);
      if (close !== -1) {
        const inside = this.toks.slice(this.i + 1, close);
        const after = this.toks[close + 1];
        const params = splitTop(inside, (t) => isSym(t, ","));
        const simple = params.every((p) => p.length === 1 && (p[0].t === "letter" || (p[0].t === "cmd" && p[0].v in GREEK)));
        const numeric = params.length === 1 && params[0].length >= 1 && params[0].every((t) => t.t === "num" || isSym(t, "-") || isSym(t, "."));
        if ((simple || numeric) && isSym(after, "=")) return true;
      }
    }
    return false;
  }

  private findClose(open: number): number {
    let depth = 0;
    for (let j = open; j < this.toks.length; j++) {
      if (isSym(this.toks[j], "(")) depth++;
      else if (isSym(this.toks[j], ")")) {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  }

  /** Tokens up to the closing command (\rfloor, \rceil), which is consumed. */
  private until(closeCmd: string): Tok[] {
    const start = this.i;
    for (let j = start; j < this.toks.length; j++) {
      if (isCmd(this.toks[j], closeCmd)) {
        this.i = j + 1;
        return this.toks.slice(start, j);
      }
    }
    return this.fail(`A \\${closeCmd} is missing.`);
  }

  private untilCmd(closeCmd: string): Tok[] {
    return this.until(closeCmd);
  }

  /** |x|, or ‖v‖ when `bar` is "\\|". */
  private absolute(bar: "|" | "\\|"): Node {
    this.absDepth++;
    const inner = this.parseExpr();
    this.absDepth--;
    const tok = this.next();
    const closes =
      bar === "|"
        ? isSym(tok, "|") || isCmd(tok, "vert") || isCmd(tok, "rvert")
        : isCmd(tok, "|") || isCmd(tok, "rVert");
    if (!closes) this.fail(`An absolute value “|…|” isn't closed.`);
    return { k: "call", fn: bar === "|" ? "abs" : "norm", args: [inner] };
  }

  /** \left( … \right), with any pair of delimiters. */
  private leftRight(): Node {
    const open = this.next();
    if (!open) this.fail("\\left needs a bracket after it.");
    const start = this.i;
    let depth = 1;
    let j = start;
    for (; j < this.toks.length; j++) {
      if (isCmd(this.toks[j], "left")) depth++;
      else if (isCmd(this.toks[j], "right")) {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= this.toks.length) this.fail("A \\left has no matching \\right.");
    const inner = this.toks.slice(start, j);
    this.i = j + 2; // \right and its delimiter
    const o = open.t === "cmd" ? `\\${open.v}` : open.v;
    if (o === "|" || o === "\\vert" || o === "\\lvert") return { k: "call", fn: "abs", args: [this.sub(inner)] };
    if (o === "\\|" || o === "\\Vert" || o === "\\lVert") return { k: "call", fn: "norm", args: [this.sub(inner)] };
    if (o === "\\lfloor") return { k: "call", fn: "floor", args: [this.sub(inner)] };
    if (o === "\\lceil") return { k: "call", fn: "ceil", args: [this.sub(inner)] };
    if (o === "\\langle") this.fail(UNSUPPORTED.langle);
    if (o === ".") {
      // \left. f \right|_{x=1}: evaluation at a point.
      if (isSym(this.peek(), "_") || isSym(this.peek(), "^")) this.fail("Evaluating at a point (…|ₓ₌₁) can't be turned into a row.");
      return this.sub(inner);
    }
    return this.grouped(inner);
  }

  private fraction(): Node {
    const num = this.groupTokens();
    const den = this.groupTokens();
    const d = this.derivativeParts(num, den);
    if (d) return d;
    const a = this.sub(num);
    const b = this.sub(den);
    return { k: "bin", op: "/", a, b };
  }

  /** \frac{dx}{dt}, \frac{d^2 x}{dt^2}, \frac{\mathrm{d} y}{\mathrm{d} x} → x', x'', y'. */
  private derivativeParts(num: Tok[], den: Tok[]): Node | null {
    const strip = (toks: Tok[]) => toks.filter((t) => !isSym(t, "{") && !isSym(t, "}") && !isCmd(t, "mathrm") && !isCmd(t, "rm") && !isCmd(t, "text"));
    const n = strip(num);
    const d = strip(den);
    const isD = (t: Tok | undefined) => !!t && t.t === "letter" && t.v === "d";
    if (!isD(n[0]) || !isD(d[0])) return null;
    const readOrder = (toks: Tok[], at: number): [number, number] => {
      if (isSym(toks[at], "^") && toks[at + 1]?.t === "num") return [Number(toks[at + 1].v), at + 2];
      return [1, at];
    };
    const [order, afterOrder] = readOrder(n, 1);
    const target = n.slice(afterOrder);
    if (target.length === 0) {
      return this.fail("d/dx of an expression can't be turned into a row: write it as y′ = … instead.");
    }
    if (target.length !== 1 || !(target[0].t === "letter" || (target[0].t === "cmd" && target[0].v in GREEK))) return null;
    const indepTok = d[1];
    if (!indepTok || !(indepTok.t === "letter" || (indepTok.t === "cmd" && indepTok.v in GREEK))) return null;
    const [denOrder, end] = readOrder(d, 2);
    if (end !== d.length || denOrder !== order) return null;
    const name = target[0].t === "letter" ? target[0].v : GREEK[target[0].v];
    const indep = indepTok.t === "letter" ? indepTok.v : GREEK[indepTok.v];
    this.shared.indep.add(indep);
    return { k: "deriv", name, order };
  }

  /** \sin x, \log_2 x, \sin^2 x, \sin^{-1} x, \max(a, b). */
  private applyFunction(fn: string): Node {
    let power: Tok[] | null = null;
    let base: Node | null = null;
    for (let guard = 0; guard < 2; guard++) {
      if (isSym(this.peek(), "^")) {
        this.next();
        power = this.groupTokens();
      } else if (isSym(this.peek(), "_")) {
        this.next();
        const sub = this.groupTokens();
        if (fn !== "log10") this.fail(`A subscript on ${fn} can't be turned into a row.`);
        base = this.sub(sub);
      }
    }
    while (isCmd(this.peek(), "limits") || isCmd(this.peek(), "nolimits")) this.next();

    let name = fn;
    const inverse = power && this.word(power.filter((t) => !isSym(t, "-"))) === "1" && isSym(power[0], "-");
    if (inverse) {
      if (!(fn in INVERSE)) this.fail(`${fn}^{-1} can't be turned into a row.`);
      name = INVERSE[fn];
      power = null;
    }

    let args: Node[];
    const tok = this.peek();
    if (isSym(tok, "(") || isSym(tok, "[")) {
      const inner = tok!.v === "(" ? this.bracketed("(", ")") : this.bracketed("[", "]");
      args = splitTop(inner, (t) => isSym(t, ",")).map((p) => this.sub(p));
    } else if (isCmd(tok, "left") && (isSym(this.peek(1), "(") || isSym(this.peek(1), "["))) {
      this.next();
      const node = this.leftRight();
      args = node.k === "list" && !node.matrix ? node.rows[0] : [node];
    } else {
      // Without brackets the argument is the product that follows: \sin 3\theta.
      const factors: Node[] = [];
      while (this.startsFactor(this.peek()) && !this.startsFunction(this.peek())) {
        factors.push(this.parsePostfix());
      }
      if (factors.length === 0) this.fail(`${fn} is missing its argument.`);
      args = [factors.reduce((a, b) => ({ k: "bin", op: "*", a, b }))];
    }

    if (name === "log10" && base) {
      name = "log";
      args = [...args, base];
      if (base.k === "num" && base.v === "10") {
        name = "log10";
        args = args.slice(0, 1);
      } else if (base.k === "num" && base.v === "2") {
        name = "log2";
        args = args.slice(0, 1);
      } else if (base.k === "sym" && base.name === "e") {
        name = "ln";
        args = args.slice(0, 1);
      }
    }
    if (fn === "log10" && !base) this.shared.notes.add("“log” was read as log base 10; use ln for the natural log.");
    const call: Node = { k: "call", fn: name, args };
    return power ? { k: "bin", op: "^", a: call, b: this.sub(power) } : call;
  }

  private startsFunction(tok: Tok | undefined): boolean {
    if (!tok || tok.t !== "cmd") return false;
    if (tok.v in FUNCTIONS) return true;
    if (tok.v === "operatorname" || tok.v === "operatorname*") return true;
    return tok.v === "sum" || tok.v === "prod";
  }

  /** \mathbf{v} → v, \mathbb{R} → R; anything bigger is read as an expression. */
  private styled(toks: Tok[]): Node {
    const word = this.word(toks);
    if (word && /^[A-Za-z]$/.test(word)) return this.identifier(word);
    if (toks.length === 1 && toks[0].t === "cmd" && toks[0].v in GREEK) return this.identifier(GREEK[toks[0].v]);
    return this.sub(toks);
  }

  /** \mathrm{…}, \text{…}, \operatorname{…}: a function name, a multi-letter name, or d. */
  private named(toks: Tok[]): Node {
    const word = this.word(toks);
    if (word === null) return this.sub(toks);
    const bare = word.replace(/\*$/, "");
    if (bare === "") return this.parsePrimary();
    if (bare === "lim") return this.fail(UNSUPPORTED.lim);
    if (bare in WORD_FUNCTIONS) return this.applyFunction(WORD_FUNCTIONS[bare]);
    if (/^[A-Za-z]$/.test(bare)) return this.identifier(bare);
    if (CONNECTOR_WORDS.has(bare)) return this.fail(`The word “${bare}” can't be part of a formula.`);
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(bare)) return this.identifier(bare);
    return this.fail(`The text “${bare}” can't be part of a formula.`);
  }

  /** \sum_{i=1}^{n} term → sum(map(1:n, _s1(i) = term)). */
  private bigOperator(op: "sum" | "prod"): Node {
    let lower: Tok[] | null = null;
    let upper: Tok[] | null = null;
    for (let guard = 0; guard < 3; guard++) {
      while (isCmd(this.peek(), "limits") || isCmd(this.peek(), "nolimits")) this.next();
      if (isSym(this.peek(), "_")) {
        this.next();
        lower = this.groupTokens();
      } else if (isSym(this.peek(), "^")) {
        this.next();
        upper = this.groupTokens();
      }
    }
    const symbol = op === "sum" ? "Σ" : "Π";
    if (!lower || !upper) this.fail(`A ${symbol} needs both limits, like ${symbol} from i = 1 to n.`);
    const eq = lower!.findIndex((t) => isSym(t, "="));
    if (eq !== 1 || lower![0].t !== "letter") this.fail(`The lower limit of ${symbol} should look like i = 1.`);
    const index = lower![0].v;
    const from = this.sub(lower!.slice(eq + 1));
    const to = this.sub(upper!);
    this.shared.bound.add(index);
    // The term is the product that follows, as for a function argument.
    const factors: Node[] = [];
    while (this.startsFactor(this.peek())) factors.push(this.parsePostfix());
    if (factors.length === 0) this.fail(`${symbol} is missing the term to add up.`);
    const body = factors.reduce((a, b) => ({ k: "bin", op: "*", a, b }) as Node);
    const helper = `_${op}${++this.shared.sums}`;
    this.shared.bound.add(helper);
    return {
      k: "call",
      fn: op,
      args: [{ k: "call", fn: "map", args: [{ k: "range", a: from, b: to }, { k: "fndef", name: helper, params: [index], body }] }],
    };
  }

  private environment(): Node {
    const nameToks = this.groupTokens();
    const env = groupWord(nameToks) ?? "";
    // The whole environment, up to its \end{…}.
    const beginAt = this.i - nameToks.length - 3;
    const endAt = matchEnv(this.toks, beginAt);
    let body = this.toks.slice(this.i, endAt);
    this.i = endAt + 1;
    if (isSym(this.peek(), "{")) this.groupTokens(); // \end{name}

    if (env === "array" && isSym(body[0], "{")) body = body.slice(matchBrace(body, 0) + 1);
    const rows = splitTop(body, (t) => isSym(t, "\\\\"))
      .map((row) => splitTop(row, (t) => isSym(t, "&")).map(unwrapCell))
      .filter((cells) => cells.some((c) => c.some((t) => !isSym(t, "{") && !isSym(t, "}"))));

    if (env === "cases" || env === "dcases") return this.cases(rows);
    if (env in MATRIX_ENVS || env === "array") {
      if (rows.length === 1 && rows[0].length === 1) return this.sub(rows[0][0]);
      const matrix: Node = { k: "list", matrix: true, rows: rows.map((cells) => cells.map((c) => this.sub(c))) };
      const wrap = MATRIX_ENVS[env];
      return wrap ? { k: "call", fn: wrap, args: [matrix] } : matrix;
    }
    if (LINE_ENVS.has(env)) {
      if (rows.length === 1) return this.sub(rows[0].flat());
      return this.fail("Several lines inside one formula: add them one line at a time.");
    }
    return this.fail(`The ${env} environment can't be turned into a row.`);
  }

  /** \begin{cases} x^2 & x < 0 \\ 2x & \text{otherwise} \end{cases} → x < 0 ? x^2 : 2x. */
  private cases(rows: Tok[][][]): Node {
    const branches = rows.map((cells) => {
      const value = this.sub(cells[0]);
      // The condition cell: drop "if", "for", commas; "otherwise" marks the default.
      const condToks = cells.slice(1).flat();
      const kept: Tok[] = [];
      const words: string[] = [];
      for (let j = 0; j < condToks.length; j++) {
        const t = condToks[j];
        if ((isCmd(t, "text") || isCmd(t, "mathrm") || isCmd(t, "textrm") || isCmd(t, "operatorname")) && isSym(condToks[j + 1], "{")) {
          const close = matchBrace(condToks, j + 1);
          const word = groupWord(condToks.slice(j + 2, close));
          if (word !== null && (word === "" || CONNECTOR_WORDS.has(word))) {
            if (word) words.push(word);
            j = close;
            continue;
          }
        }
        if (isSym(t, ",")) continue;
        kept.push(t);
      }
      const cond = unwrapCell(kept);
      const isDefault = words.includes("otherwise") || words.includes("else") || !cond.some((t) => !isSym(t, "{") && !isSym(t, "}"));
      return { value, cond: isDefault ? undefined : this.sub(cond) };
    });
    return { k: "cond", branches };
  }
}

// ─── Printing ────────────────────────────────────────────────────────────────

const PREC = { cond: 0, rel: 1, range: 1.5, add: 2, mul: 3, neg: 4, pow: 5, fact: 6, atom: 7 } as const;

function precedence(n: Node): number {
  switch (n.k) {
    case "rel":
      return PREC.rel;
    case "cond":
      return PREC.cond;
    case "range":
      return PREC.range;
    case "bin":
      return n.op === "+" || n.op === "-" ? PREC.add : n.op === "^" ? PREC.pow : PREC.mul;
    case "neg":
      return PREC.neg;
    case "deg":
      return PREC.mul;
    case "fact":
      return PREC.fact;
    case "num":
      return PREC.atom;
    default:
      return PREC.atom;
  }
}

const wrap = (s: string) => `(${s})`;

function print(n: Node): string {
  switch (n.k) {
    case "num":
      return n.v.replace(/\.$/, "");
    case "sym":
      return n.name;
    case "deriv":
      return n.name + "'".repeat(n.order) + (n.at ? `(${print(n.at)})` : "");
    case "call":
      return `${n.fn}(${n.args.map(print).join(", ")})`;
    case "fndef":
      return `${n.name}(${n.params.join(", ")}) = ${print(n.body)}`;
    case "range":
      return `${operand(n.a, PREC.add)}:${operand(n.b, PREC.add)}`;
    case "list":
      if (n.matrix) return `[${n.rows.map((r) => `[${r.map(print).join(", ")}]`).join(", ")}]`;
      return `[${n.rows[0].map(print).join(", ")}]`;
    case "deg":
      return `${operand(n.a, PREC.pow)} deg`;
    case "fact":
      return `${operand(n.a, PREC.atom)}!`;
    case "neg":
      return `-${operand(n.a, PREC.mul)}`;
    case "rel":
      return n.items.map((item, i) => (i === 0 ? "" : ` ${n.ops[i - 1]} `) + operand(item, PREC.add)).join("");
    case "cond": {
      let out = "NaN";
      let hasDefault = false;
      const last = n.branches[n.branches.length - 1];
      if (last && !last.cond) {
        out = operand(last.value, PREC.rel);
        hasDefault = true;
      }
      const conditional = hasDefault ? n.branches.slice(0, -1) : n.branches;
      for (let i = conditional.length - 1; i >= 0; i--) {
        const b = conditional[i];
        const rest = i === conditional.length - 1 ? out : wrap(out);
        out = `${operand(b.cond!, PREC.rel)} ? ${operand(b.value, PREC.rel)} : ${rest}`;
      }
      return out;
    }
    case "bin":
      return printBinary(n);
  }
}

/** A child printed inside a parent that needs at least precedence `min`. */
function operand(n: Node, min: number): string {
  const s = print(n);
  return precedence(n) < min ? wrap(s) : s;
}

function startsWithLetter(s: string) {
  return /^[A-Za-z_(]/.test(s) && !/^[eE]/.test(s);
}

function printBinary(n: Extract<Node, { k: "bin" }>): string {
  const { op, a, b } = n;
  if (op === "+") {
    if (b.k === "neg") return `${operand(a, PREC.add)} - ${operand(b.a, PREC.mul)}`;
    return `${operand(a, PREC.add)} + ${operand(b, PREC.add)}`;
  }
  if (op === "-") {
    if (b.k === "neg") return `${operand(a, PREC.add)} + ${operand(b.a, PREC.mul)}`;
    return `${operand(a, PREC.add)} - ${operand(b, PREC.mul)}`;
  }
  if (op === "^") {
    const base = operand(a, PREC.atom);
    const atomicExp = (b.k === "num" && !b.v.includes(".")) || b.k === "sym";
    return `${base}^${atomicExp ? print(b) : wrap(print(b))}`;
  }
  if (op === "/") {
    // A product in the denominator keeps its brackets: 1/(2x), not 1/2x.
    const top = a.k === "bin" && a.op === "/" ? wrap(print(a)) : operand(a, PREC.mul);
    const bottom = operand(b, PREC.neg);
    return `${top}/${bottom}`;
  }
  // "*": a number before a name reads as a coefficient: 3x, 2pi, 4sin(x).
  const left = a.k === "bin" && a.op === "/" ? wrap(print(a)) : operand(a, PREC.mul);
  const rightNode = b.k === "bin" && b.op === "/" ? null : b;
  const right = rightNode ? operand(b, PREC.neg) : wrap(print(b));
  if (a.k === "num" && precedence(b) >= PREC.pow && startsWithLetter(right) && !(b.k === "bin" && b.op === "^" && b.a.k === "num")) {
    return `${left}${right}`;
  }
  return `${left}*${right}`;
}

// ─── Lines and kinds ─────────────────────────────────────────────────────────

function walk(n: Node, visit: (n: Node) => void) {
  visit(n);
  switch (n.k) {
    case "call":
      n.args.forEach((a) => walk(a, visit));
      break;
    case "bin":
      walk(n.a, visit);
      walk(n.b, visit);
      break;
    case "neg":
    case "fact":
    case "deg":
      walk(n.a, visit);
      break;
    case "rel":
      n.items.forEach((a) => walk(a, visit));
      break;
    case "list":
      n.rows.forEach((r) => r.forEach((a) => walk(a, visit)));
      break;
    case "cond":
      n.branches.forEach((b) => {
        walk(b.value, visit);
        if (b.cond) walk(b.cond, visit);
      });
      break;
    case "range":
      walk(n.a, visit);
      walk(n.b, visit);
      break;
    case "fndef":
      walk(n.body, visit);
      break;
    case "deriv":
      if (n.at) walk(n.at, visit);
      break;
  }
}

function rename(n: Node, from: string, to: string): Node {
  const r = (x: Node) => rename(x, from, to);
  switch (n.k) {
    case "sym":
      return n.name === from ? { k: "sym", name: to } : n;
    case "call":
      return { ...n, args: n.args.map(r) };
    case "bin":
      return { ...n, a: r(n.a), b: r(n.b) };
    case "neg":
    case "fact":
    case "deg":
      return { ...n, a: r(n.a) } as Node;
    case "rel":
      return { ...n, items: n.items.map(r) };
    case "list":
      return { ...n, rows: n.rows.map((row) => row.map(r)) };
    case "cond":
      return { ...n, branches: n.branches.map((b) => ({ value: r(b.value), cond: b.cond && r(b.cond) })) };
    case "range":
      return { ...n, a: r(n.a), b: r(n.b) };
    case "fndef":
      return { ...n, body: r(n.body) };
    default:
      return n;
  }
}

function uses(n: Node, name: string): boolean {
  let found = false;
  walk(n, (x) => {
    if (x.k === "sym" && x.name === name) found = true;
  });
  return found;
}

function hasDerivative(n: Node): boolean {
  let found = false;
  walk(n, (x) => {
    if (x.k === "deriv") found = true;
  });
  return found;
}

const CONSTANTS = new Set(["x", "y", "t", "time", "pi", "e", "i", "Infinity", "NaN", "true", "false", "deg"]);

/** Names in the expression a slider could stand for. */
function freeSymbols(expr: string, bound: Set<string>): { symbols: string[]; shadowed: string[] } {
  const symbols = new Set<string>();
  const shadowed = new Set<string>();
  let node: mathjs.MathNode;
  try {
    node = mathjs.parse(expr);
  } catch {
    return { symbols: [], shadowed: [] };
  }
  const defined = new Set<string>(bound);
  node.traverse((n: any) => {
    if (n.isFunctionAssignmentNode) {
      defined.add(n.name);
      for (const p of n.params) defined.add(p);
    }
    if (n.isAssignmentNode && n.object?.isSymbolNode) defined.add(n.object.name);
  });
  node.traverse((n: any, _path: string, parent: any) => {
    if (!n.isSymbolNode) return;
    if (parent?.isFunctionNode && parent.fn === n) return; // the name of a called function
    const name = n.name;
    if (CONSTANTS.has(name) || defined.has(name)) return;
    if (name in mathjs) {
      if (Object.values(GREEK).includes(name)) shadowed.add(name);
      return;
    }
    symbols.add(name);
  });
  return { symbols: [...symbols, ...shadowed], shadowed: [...shadowed] };
}

/** The terms of a sum, each with its sign: a - b + c → [+a, -b, +c]. */
function terms(n: Node, sign = 1, out: { sign: number; node: Node }[] = []) {
  if (n.k === "bin" && (n.op === "+" || n.op === "-")) {
    terms(n.a, sign, out);
    terms(n.b, n.op === "-" ? -sign : sign, out);
  } else if (n.k === "neg") terms(n.a, -sign, out);
  else out.push({ sign, node: n });
  return out;
}

/** The factors of a product: 2*zeta*omega*x' → [2, zeta, omega, x']. */
function factors(n: Node, out: Node[] = []): Node[] {
  if (n.k === "bin" && n.op === "*") {
    factors(n.a, out);
    factors(n.b, out);
  } else out.push(n);
  return out;
}

const product = (list: Node[]): Node =>
  list.length === 0 ? { k: "num", v: "1" } : list.reduce((a, b) => ({ k: "bin", op: "*", a, b }));

const sum = (list: { sign: number; node: Node }[]): Node => {
  let out: Node | null = null;
  for (const { sign, node } of list) {
    if (!out) out = sign < 0 ? { k: "neg", a: node } : node;
    else out = { k: "bin", op: sign < 0 ? "-" : "+", a: out, b: node };
  }
  return out ?? { k: "num", v: "0" };
};

/**
 * Differential rows are written x'' = …. An equation in another arrangement,
 * like x'' + 2ζωx' + ω²x = 0, is solved for its highest derivative when that
 * derivative appears as a plain term (times a coefficient).
 */
function solveForHighestDerivative(rel: Extract<Node, { k: "rel" }>): Node {
  const [lhs, rhs] = rel.items;
  if (lhs.k === "deriv" && !lhs.at && !hasDerivativeOf(rhs, lhs.name, lhs.order)) return rel;
  let top: { name: string; order: number } | null = null;
  walk(rel, (n) => {
    if (n.k === "deriv" && !n.at && (!top || n.order > top.order)) top = { name: n.name, order: n.order };
  });
  if (!top) return rel;
  const target = top as { name: string; order: number };
  const all = [...terms(lhs), ...terms(rhs, -1)];
  const coefficient: { sign: number; node: Node }[] = [];
  const rest: { sign: number; node: Node }[] = [];
  for (const term of all) {
    const fs = factors(term.node);
    const at = fs.findIndex((f) => f.k === "deriv" && f.name === target.name && f.order === target.order && !f.at);
    if (at === -1) {
      if (hasDerivativeOf(term.node, target.name, target.order)) throw new ConvertError("Couldn't solve this differential equation for its highest derivative; write it as x″ = ….");
      rest.push(term);
      continue;
    }
    const others = fs.filter((_, i) => i !== at);
    if (others.some((f) => hasDerivativeOf(f, target.name, target.order))) throw new ConvertError("Couldn't solve this differential equation for its highest derivative; write it as x″ = ….");
    coefficient.push({ sign: term.sign, node: product(others) });
  }
  if (coefficient.length === 0) return rel;
  // a·x'' + rest = 0  →  x'' = -rest / a
  const nonZero = rest.filter((r) => !(r.node.k === "num" && Number(r.node.v) === 0));
  const minusRest = sum(nonZero.map((r) => ({ sign: -r.sign, node: r.node })));
  const a = sum(coefficient);
  const isOne = a.k === "num" && a.v === "1";
  const isMinusOne = a.k === "neg" && a.a.k === "num" && a.a.v === "1";
  const value: Node = isOne ? minusRest : isMinusOne ? sum(nonZero) : { k: "bin", op: "/", a: minusRest, b: a };
  return { k: "rel", ops: ["="], items: [{ k: "deriv", name: target.name, order: target.order }, value] };
}

function hasDerivativeOf(n: Node, name: string, order: number): boolean {
  let found = false;
  walk(n, (x) => {
    if (x.k === "deriv" && x.name === name && x.order === order && !x.at) found = true;
  });
  return found;
}

function convertLine(toks: Tok[], latex: string): LatexLine {
  const shared: Shared = { notes: new Set(), indep: new Set(), bound: new Set(), sums: 0 };
  const line: LatexLine = { latex, notes: [], symbols: [], shadowed: [] };
  try {
    let node = new Parser(toks, shared).parseAll();
    let kind: LatexRowKind;
    let plotExpr: string | undefined;

    if (node.k === "rel" && node.ops.length === 1 && node.ops[0] === "=") {
      const [lhs, rhs] = node.items;
      if (hasDerivative(lhs) || hasDerivative(rhs)) {
        // A differential equation: its independent variable is always t in the math node.
        for (const v of shared.indep) {
          if (v !== "t") {
            node = rename(node, v, "t");
            shared.notes.add(`The derivative is with respect to ${v}; the row uses t for it.`);
          }
        }
        node = solveForHighestDerivative(node as Extract<Node, { k: "rel" }>);
        kind = "differential";
      } else if (lhs.k === "call" && lhs.args.every((a) => a.k === "num" || a.k === "neg")) {
        // x(0) = 1 on its own line: a starting value for a differential equation.
        kind = "differential";
      } else if (rhs.k === "sym" && rhs.name === "y" && !(lhs.k === "sym")) {
        node = { k: "rel", ops: ["="], items: [rhs, lhs] };
        kind = "function";
      } else if (lhs.k === "sym" && lhs.name === "y") {
        kind = "function";
      } else if (lhs.k === "call" && lhs.args.every((a) => a.k === "sym") && /^[A-Za-z]/.test(lhs.fn)) {
        const params = lhs.args.map((a) => (a as { name: string }).name);
        if (lhs.fn === "x" || lhs.fn === "y") {
          // x(t) = …: plotted against its parameter, which goes along the x axis.
          let body = rhs;
          if (params[0] !== "x") {
            body = rename(body, params[0], "x");
            shared.notes.add(`${lhs.fn}(${params[0]}) is drawn with ${params[0]} along the horizontal axis.`);
          }
          node = { k: "rel", ops: ["="], items: [{ k: "sym", name: "y" }, body] };
          kind = "function";
        } else {
          kind = "definition";
          params.forEach((p) => shared.bound.add(p));
          if (params.length === 1) plotExpr = `y = ${lhs.fn}(x)`;
        }
      } else if (lhs.k === "sym" && lhs.name === "r" && uses(rhs, "theta") && !uses(rhs, "x") && !uses(rhs, "y")) {
        kind = "polar";
      } else if (lhs.k === "sym" && lhs.name !== "x") {
        kind = uses(rhs, "x") || uses(rhs, "y") ? "function" : "definition";
        if (rhs.k === "list" && !rhs.matrix && rhs.rows[0].length === 2) kind = "point";
      } else {
        kind = "implicit";
        if (!uses(node, "x") && !uses(node, "y")) shared.notes.add("It has no x or y, so there's nothing to draw.");
      }
    } else if (node.k === "rel") {
      if (node.ops.includes("!=")) throw new ConvertError("“≠” can't be drawn: rows need =, <, >, ≤ or ≥.");
      if (node.ops.includes("=")) throw new ConvertError("A chain like a = b = c can't be one row.");
      kind = uses(node, "x") || uses(node, "y") ? "inequality" : "calculator";
    } else if (hasDerivative(node)) {
      throw new ConvertError("A derivative needs an equation, like x′ = −k·x.");
    } else if (node.k === "list" && !node.matrix && node.rows[0].length === 2) {
      kind = "point";
    } else {
      kind = uses(node, "x") ? "function" : "calculator";
    }

    let name: string | undefined;
    if (kind === "point" && node.k === "rel") {
      // P = (2, 3): the point, named P so other rows can use it.
      name = (node.items[0] as { name: string }).name;
      node = node.items[1];
    }
    if (kind === "polar" && node.k === "rel") {
      node = node.items[1];
      shared.bound.add("theta");
    }

    const expr = print(node);
    // Differential rows are checked once their starting values have joined them. The
    // sides of an equation are checked one at a time: mathjs reads "=" as assignment.
    if (kind !== "differential") {
      const parts = node.k === "rel" && kind !== "function" && kind !== "definition" ? node.items.map(print) : [expr];
      for (const part of parts) {
        try {
          mathjs.parse(part);
        } catch (e: any) {
          throw new ConvertError(`The result isn't valid math: ${e?.message || e}`);
        }
      }
    }

    const free = freeSymbols(kind === "differential" ? "0" : expr, shared.bound);
    line.expr = expr;
    line.kind = kind;
    line.plotExpr = plotExpr;
    line.name = name;
    line.symbols = free.symbols;
    line.shadowed = free.shadowed;
    // x and X side by side is more often a misread letter than two quantities.
    const singles = new Set<string>();
    walk(node, (n) => {
      if (n.k === "sym" && n.name.length === 1) singles.add(n.name);
      if (n.k === "deriv") singles.add(n.name);
    });
    for (const letter of singles) {
      const other = letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase();
      if (letter < other && singles.has(other)) shared.notes.add(`Both ${other} and ${letter} appear: check that one wasn't misread.`);
    }
    for (const name of free.shadowed) {
      shared.notes.add(
        `${name} also means ${name === "phi" ? "the golden ratio" : name === "tau" ? "2π" : "a built-in function"} in mathjs; a slider named ${name} makes it a value you set.`,
      );
    }
  } catch (e: any) {
    line.error = e instanceof ConvertError ? e.message : `Couldn't read this formula (${e?.message || e}).`;
  }
  line.notes = [...shared.notes];
  return line;
}

/** Turns tokens back into LaTeX, for showing one line of a multi-line formula. */
function toLatex(toks: Tok[]): string {
  let out = "";
  for (const tok of toks) {
    const s = tok.t === "cmd" ? `\\${tok.v}` : tok.v;
    if (tok.t === "cmd" && /^[A-Za-z]/.test(tok.v)) out += (out && !/[\s{(]$/.test(out) ? " " : "") + s;
    else if (tok.t === "letter" && /\\[A-Za-z]+$/.test(out)) out += " " + s;
    else out += s;
  }
  return out;
}

/** Splits a formula into the lines it holds: environment rows, "\\", ";", "and". */
function splitLines(toks: Tok[]): Tok[][] {
  let body = toks;
  // Punctuation at the end of a displayed formula belongs to the sentence around it.
  while (body.length && (isSym(body[body.length - 1], ".") || isSym(body[body.length - 1], ","))) body = body.slice(0, -1);

  // One environment around everything: its rows are the lines.
  if (isCmd(body[0], "begin") && isSym(body[1], "{")) {
    const close = matchBrace(body, 1);
    const env = groupWord(body.slice(2, close)) ?? "";
    const end = matchEnv(body, 0);
    const after = body.slice(end + 1);
    const tail = isSym(after[0], "{") ? after.slice(matchBrace(after, 0) + 1) : after;
    if (LINE_ENVS.has(env) && tail.every((t) => isSym(t, ".") || isSym(t, ","))) {
      let inner = body.slice(close + 1, end);
      if (env === "array" && isSym(inner[0], "{")) inner = inner.slice(matchBrace(inner, 0) + 1);
      if (env.startsWith("alignat") && isSym(inner[0], "{")) inner = inner.slice(matchBrace(inner, 0) + 1);
      const rows = splitTop(inner, (t) => isSym(t, "\\\\")).map((row) => {
        const cells = splitTop(row, (t) => isSym(t, "&")).map(unwrapCell);
        return cells.flat();
      });
      return carryLeftSides(rows.flatMap(splitStatements));
    }
  }
  return carryLeftSides(splitTop(body, (t) => isSym(t, "\\\\")).flatMap(splitStatements));
}

/** Splits one line at ";", and at "and" / "," between two equations. */
function splitStatements(toks: Tok[]): Tok[][] {
  const trimmed = (p: Tok[]) => {
    let s = p;
    while (s.length && (isSym(s[s.length - 1], ".") || isSym(s[s.length - 1], ","))) s = s.slice(0, -1);
    return s;
  };
  const meaningful = (p: Tok[]) => p.some((t) => !isSym(t, "{") && !isSym(t, "}"));
  const parts = splitTop(toks, (t) => isSym(t, ";")).flatMap((part) => {
    // "\text{and}" and "\quad" between equations separate them.
    const pieces: Tok[][] = [[]];
    let depth = 0;
    for (let i = 0; i < part.length; i++) {
      const tok = part[i];
      if (isSym(tok, "{") || isCmd(tok, "begin") || isCmd(tok, "left")) depth++;
      else if (isSym(tok, "}") || isCmd(tok, "end") || isCmd(tok, "right")) depth--;
      if (depth === 0 && (isCmd(tok, "text") || isCmd(tok, "mathrm") || isCmd(tok, "textrm")) && isSym(part[i + 1], "{")) {
        const close = matchBrace(part, i + 1);
        const word = groupWord(part.slice(i + 2, close));
        if (word && CONNECTOR_WORDS.has(word)) {
          pieces.push([]);
          i = close;
          continue;
        }
      }
      pieces[pieces.length - 1].push(tok);
    }
    return pieces;
  });
  // A top-level comma separates statements only when both sides are equations.
  const out: Tok[][] = [];
  for (const part of parts) {
    const byComma = splitTop(part, (t) => isSym(t, ","));
    const isEquation = (p: Tok[]) => p.some((t) => isSym(t, "=") || isSym(t, "<") || isSym(t, ">") || (t.t === "cmd" && t.v in RELATIONS));
    if (byComma.length > 1 && byComma.every((p) => meaningful(p) && isEquation(p))) out.push(...byComma);
    else out.push(part);
  }
  return out.map(trimmed).filter(meaningful);
}

/** "a &= b \\ &= c": a line that starts with "=" continues the left side above it. */
function carryLeftSides(lines: Tok[][]): Tok[][] {
  let lhs: Tok[] | null = null;
  return lines.map((line) => {
    const firstReal = line.findIndex((t) => !isSym(t, "{") && !isSym(t, "}"));
    const first = line[firstReal];
    const startsWithRelation = !!first && ((first.t === "sym" && (first.v === "=" || first.v === "<" || first.v === ">")) || (first.t === "cmd" && first.v in RELATIONS));
    if (startsWithRelation && lhs) return [...lhs, ...line];
    const eq = splitTop(line, (t) => isSym(t, "="));
    if (eq.length > 1) lhs = eq[0];
    return line;
  });
}

/** Differential-equation lines and their starting values belong in one row. */
function mergeDifferential(lines: LatexLine[]): LatexLine[] {
  const out: LatexLine[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line.kind === "differential" && prev?.kind === "differential" && line.expr && prev.expr) {
      prev.expr = `${prev.expr}; ${line.expr}`;
      prev.latex = `${prev.latex} \\\\ ${line.latex}`;
      prev.notes = [...new Set([...prev.notes, ...line.notes])];
      continue;
    }
    out.push(line);
  }
  // A lone starting value, with no equation to go with it, is not a row.
  for (const line of out) {
    if (line.kind === "differential" && line.expr && !line.expr.includes("'")) {
      line.error = "This is a starting value, like x(0) = 1: it needs the differential equation with it.";
      line.expr = undefined;
      line.kind = undefined;
    }
    if (line.kind === "differential" && line.expr) {
      const system = parseOdeSystem(line.expr);
      if (system.error) {
        line.error = system.error;
        line.expr = undefined;
        line.kind = undefined;
      } else {
        const states = new Set(system.states.map((s) => s.display.replace(/'+$/, "")));
        line.symbols = freeOdeSymbols(line.expr, states);
        line.shadowed = line.symbols.filter((s) => s in mathjs);
      }
    }
  }
  return out;
}

/** Slider names in a differential row: everything except its states and t. */
function freeOdeSymbols(expr: string, states: Set<string>): string[] {
  const names = new Set<string>();
  for (const statement of expr.split(";")) {
    const clean = statement.replace(/([A-Za-z_]\w*)'+/g, "$1").replace(/^\s*[A-Za-z_]\w*\([^)]*\)\s*=/, "0 =");
    const eq = clean.indexOf("=");
    const rhs = eq >= 0 ? clean.slice(eq + 1) : clean;
    try {
      mathjs.parse(rhs).traverse((n: any, _p: string, parent: any) => {
        if (!n.isSymbolNode) return;
        if (parent?.isFunctionNode && parent.fn === n) return;
        if (states.has(n.name) || CONSTANTS.has(n.name)) return;
        if (n.name in mathjs && !Object.values(GREEK).includes(n.name)) return;
        names.add(n.name);
      });
    } catch {
      /* the ODE parser has already accepted it */
    }
  }
  return [...names];
}

/** Removes $…$, \[…\], \(…\) and equation environments around a formula. */
function stripDelimiters(latex: string): string {
  let s = latex.trim();
  for (const [open, close] of [["$$", "$$"], ["$", "$"], ["\\[", "\\]"], ["\\(", "\\)"]]) {
    if (s.startsWith(open) && s.endsWith(close) && s.length >= open.length + close.length) {
      s = s.slice(open.length, s.length - close.length).trim();
    }
  }
  return s;
}

/**
 * Converts LaTeX to rows for the math node: one entry per line of the formula, each
 * with its mathjs text and the kind of row it makes, or the reason it couldn't be read.
 */
export function latexToMathjs(latex: string): LatexLine[] {
  let src = stripDelimiters(latex);
  for (const [re, to] of ORTHOGRAPHY) src = src.replace(re, to);
  if (!src.trim()) return [];
  let toks: Tok[];
  try {
    toks = stripStyling(tokenize(src));
  } catch (e: any) {
    return [{ latex: src, notes: [], symbols: [], shadowed: [], error: e?.message || String(e) }];
  }
  let lines: Tok[][];
  try {
    lines = splitLines(toks);
  } catch (e: any) {
    return [{ latex: src, notes: [], symbols: [], shadowed: [], error: e instanceof ConvertError ? e.message : String(e) }];
  }
  const converted = lines.map((line) => convertLine(line, lines.length === 1 ? src : toLatex(line)));
  return mergeDifferential(converted);
}
