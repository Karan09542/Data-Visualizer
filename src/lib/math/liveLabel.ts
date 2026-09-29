/**
 * Live readouts inside labels: "t = {{tau}} / {{T}} s" shows the current values.
 *
 * Double braces keep it clear of LaTeX, which uses single braces everywhere. An optional
 * ":N" at the end sets the decimals ("{{v0:1}}"); the default is 2.
 */
import * as mathjs from "mathjs";

const PLACEHOLDER = /\{\{([^{}]+?)\}\}/g;

const compiledCache = new Map<string, { evaluate: (scope: any) => any } | null>();

function compile(expr: string) {
  if (compiledCache.has(expr)) return compiledCache.get(expr)!;
  let compiled: { evaluate: (scope: any) => any } | null = null;
  try {
    compiled = mathjs.compile(expr);
  } catch {
    compiled = null;
  }
  if (compiledCache.size > 300) compiledCache.clear();
  compiledCache.set(expr, compiled);
  return compiled;
}

export const hasLiveValues = (label: string | undefined): boolean =>
  !!label && /\{\{[^{}]+?\}\}/.test(label);

function formatValue(value: any, decimals: number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return value > 0 ? "∞" : value < 0 ? "-∞" : "—";
    const fixed = value.toFixed(decimals);
    // "-0.00" reads as a bug.
    return /^-0(\.0+)?$/.test(fixed) ? fixed.slice(1) : fixed;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const arr = value && typeof value.toArray === "function" ? value.toArray() : value;
  if (Array.isArray(arr)) {
    return `(${arr.map((v: any) => formatValue(Array.isArray(v) && v.length === 1 ? v[0] : v, decimals)).join(", ")})`;
  }
  if (value && value.isComplex) return value.format({ precision: decimals + 2 });
  return value == null ? "—" : String(value);
}

/** A point's own position, for its label: {{xy}} → "(1.00, 2.00)", {{x}}, {{y}}. */
export const pointLabelLocals = (x: number, y: number) => ({ x, y, xy: [x, y] });

/** A label that just shows the point's position. */
export const POINT_COORDINATES_LABEL = "{{xy}}";

/** Written-out coordinates in a label: "[4,4]", "(1.5, -2)", "[1;2]". */
const FIXED_PAIR = /[[(]\s*-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*[,;]\s*-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*[\])]/i;

/** Whether a label spells out coordinates as fixed numbers, which won't follow the point. */
export const hasFixedCoordinates = (label: string | undefined): boolean =>
  !!label && !hasLiveValues(label) && FIXED_PAIR.test(label);

/** The name a point row assigns ("A = [1, 2]" → "A"), if any. */
export const pointRowName = (expr: string | undefined): string | undefined =>
  expr?.match(/^\s*([A-Za-z][A-Za-z0-9_']*)\s*=(?!=)/)?.[1];

/**
 * A label that follows the point: written-out coordinates become live ones
 * ("A = [4,4]" → "A = {{xy}}"); otherwise the coordinates are added to what's
 * there ("A" → "A{{xy}}", showing "A(1.75, 1.86)"); with no label, the point's
 * name is used.
 */
export function liveCoordinatesLabel(label: string | undefined, name?: string): string {
  const text = (label ?? "").trim();
  if (/\{\{\s*(xy|x|y)\b/.test(text)) return text;
  if (FIXED_PAIR.test(text)) return text.replace(FIXED_PAIR, POINT_COORDINATES_LABEL);
  const base = text || name || "";
  if (!base) return POINT_COORDINATES_LABEL;
  // A name reads as A(1, 2); anything longer gets a space.
  return /^[A-Za-z][A-Za-z0-9_']*$/.test(base) ? `${base}${POINT_COORDINATES_LABEL}` : `${base} ${POINT_COORDINATES_LABEL}`;
}

/**
 * Fills each {{…}} with its current value. Unknown or broken expressions show "—".
 * `locals` adds names for this label only, over the scope — e.g. a point's own
 * position as x, y and xy.
 */
export function renderLiveLabel(label: string, scope: any, locals?: Record<string, unknown>): string {
  let evalScope = scope;
  if (locals) {
    evalScope = Object.create(scope ?? null);
    Object.assign(evalScope, locals);
  }
  return label.replace(PLACEHOLDER, (_, body: string) => {
    let expr = body.trim();
    let decimals = 2;
    const m = expr.match(/^(.*?):\s*(\d{1,2})$/);
    if (m && m[1].trim()) {
      expr = m[1].trim();
      decimals = Number(m[2]);
    }
    const compiled = compile(expr);
    if (!compiled) return "—";
    try {
      return formatValue(compiled.evaluate(Object.create(evalScope)), decimals);
    } catch {
      return "—";
    }
  });
}
