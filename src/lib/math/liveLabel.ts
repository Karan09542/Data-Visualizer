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

/** Fills each {{…}} with its current value. Unknown or broken expressions show "—". */
export function renderLiveLabel(label: string, scope: any): string {
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
      return formatValue(compiled.evaluate(Object.create(scope)), decimals);
    } catch {
      return "—";
    }
  });
}
