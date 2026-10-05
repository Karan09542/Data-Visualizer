import React from "react";
import { NumberBoxes, type BoxCell, type BoxTone } from "./NumberBoxes";
import type { Q } from "./shunyam";

/** Small pieces to write equations with, in number boxes. */

/** One term in boxes; a string is one box. */
export const Term: React.FC<{ cells: (string | BoxCell)[]; tone?: BoxTone; gap: number; size?: "sm" | "md" }> = ({ cells, tone, gap, size = "md" }) => (
  <NumberBoxes groups={[{ cells, tone }]} gap={gap} separator={null} size={size} />
);
export const Op: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="px-0.5 text-xl text-slate-400 dark:text-slate-500">{children}</span>;
/** A fraction: numerator over denominator, with a bar between. */
export const Frac: React.FC<{ num: React.ReactNode; den: React.ReactNode }> = ({ num, den }) => (
  <span className="inline-flex flex-col items-center gap-1">
    {num}
    <span className="h-0.5 w-full min-w-10 rounded bg-slate-400 dark:bg-slate-500" />
    {den}
  </span>
);
export const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="flex flex-wrap items-center gap-x-2 gap-y-2">{children}</div>;
/** "x = −3/5", the answer in a filled box. */
export const Answer: React.FC<{ x: Q; gap: number; name?: string }> = ({ x, gap, name = "x" }) => (
  <Row>
    <Term cells={[name]} gap={gap} size="md" />
    <Op>=</Op>
    <NumberBoxes groups={[{ cells: [x.toString()], tone: "answer" }]} gap={gap} separator={null} size="lg" />
  </Row>
);

/** A small signed number box to type into. */
export const NumIn: React.FC<{ label: string; value: string; onChange: (v: string) => void; hideLabel?: boolean; maxLength?: number }> = ({ label, value, onChange, hideLabel, maxLength = 4 }) => (
  <label className="flex flex-col items-center gap-0.5">
    {!hideLabel && <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[−–]/g, "-").replace(/[^\d-]/g, "").replace(/(?!^)-/g, "").slice(0, maxLength))}
      inputMode="text"
      aria-label={label}
      className="h-10 w-14 rounded-lg border border-slate-300 bg-white text-center text-base font-medium tabular-nums text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300 dark:focus:ring-slate-700"
    />
  </label>
);

export const MINUS = "−";
export const num = (n: number) => (n < 0 ? `${MINUS}${-n}` : String(n));
/** "12x + 78y = 12", "3x − y = 1" */
export function eqText(a: number, b: number, p: number) {
  const term = (k: number, v: string) => (k === 1 ? v : k === -1 ? `${MINUS}${v}` : `${num(k)}${v}`);
  const left = a === 0 ? term(b, "y") : b === 0 ? term(a, "x") : `${term(a, "x")} ${b < 0 ? MINUS : "+"} ${term(Math.abs(b), "y")}`;
  return `${left} = ${num(p)}`;
}


/** "45·2 − 23·(−1) = 113": a, b and p with values put in for x and y. */
export function checkText(a: number, b: number, p: number, x: string, y: string) {
  const paren = (s: string) => (s.startsWith(MINUS) ? `(${s})` : s);
  return `${num(a)}·${paren(x)} ${b < 0 ? MINUS : "+"} ${Math.abs(b)}·${paren(y)} = ${num(p)}`;
}

/** ax + by = p in boxes: the x number, the y number (its sign as the operator), the right side. */
export const LinEq: React.FC<{ a: number; b: number; p: number; gap: number; tones?: [BoxTone, BoxTone, BoxTone] }> = ({ a, b, p, gap, tones = ["active", "added", "carry"] }) => (
  <Row>
    <Term cells={[{ v: num(a), tone: tones[0] }, "x"]} gap={gap} />
    <Op>{b < 0 ? MINUS : "+"}</Op>
    <Term cells={[{ v: String(Math.abs(b)), tone: tones[1] }, "y"]} gap={gap} />
    <Op>=</Op>
    <Term cells={[num(p)]} tone={tones[2]} gap={gap} />
  </Row>
);
