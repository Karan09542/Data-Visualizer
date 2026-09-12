import * as mathjs from "mathjs";
import { splitStatements } from "./odeSystem";

const IDENT_START = "A-Za-z_$\\u00C0-\\u02AF\\u0370-\\u03FF\\u2100-\\u214F";
const IDENT_CHARS = IDENT_START + "0-9";
const STATEMENT_RE = new RegExp(
  `^([${IDENT_START}][${IDENT_CHARS}]*)('*)\\s*(?:\\(([^)]*)\\))?\\s*=\\s*(.+)$`,
);

/**
 * LaTeX for an ODE system as the user typed it, e.g.
 *   theta'' = -(g/L)*sin(theta); theta(0) = 2.5
 * becomes an aligned block of \theta'' = -\frac{g}{L}\sin(\theta) etc.
 *
 * The generic expression-to-LaTeX path can't do this: mathjs reads "'" as transpose and
 * ";" as a statement separator, so it renders the raw text instead.
 * Returns null if the text doesn't look like an ODE system.
 */
export function odeSystemToLatex(expr: string): string | null {
  const statements = splitStatements(expr || "");
  if (statements.length === 0) return null;

  const rows: string[] = [];
  for (const statement of statements) {
    const match = statement.match(STATEMENT_RE);
    if (!match) return null;
    const [, name, primes, arg, rhs] = match;

    let lhs: string;
    try {
      lhs = mathjs.parse(name).toTex();
    } catch {
      lhs = name;
    }
    lhs += primes; // KaTeX renders ' and '' directly in math mode
    if (arg !== undefined) {
      const trimmed = arg.trim();
      lhs += `(${trimmed === "" ? "" : trimmed})`;
    }

    let rhsTex: string;
    try {
      // mathjs reads a prime as conjugate transpose and renders it "^H"; here it means
      // a derivative, so show it as a prime. Real exponents are always braced ("^{H}"),
      // so a bare ^H only ever comes from a prime.
      rhsTex = mathjs.parse(rhs).toTex().replace(/\^H/g, "'");
    } catch {
      return null;
    }

    rows.push(`${lhs} &= ${rhsTex}`);
  }

  return `\\begin{aligned}${rows.join(" \\\\ ")}\\end{aligned}`;
}
