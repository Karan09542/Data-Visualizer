/**
 * Building blocks every Vedic lesson shares, light and dark: cards, inputs, the
 * on/off switch, example chips and the list of steps.
 */
import React, { useState } from "react";

export type Lang = "en" | "hi";
/** Picks the text for the language. */
export const tr = (lang: Lang) => (en: string, hi: string) => (lang === "hi" ? hi : en);

export const CARD = "rounded-xl border border-slate-200 p-4 dark:border-slate-800";
export const CARD_TITLE = "text-[13px] font-semibold text-slate-900 dark:text-slate-100";
export const BODY = "text-sm leading-relaxed text-slate-600 dark:text-slate-400";
export const STRONG = "font-semibold tabular-nums text-slate-900 dark:text-slate-100";
export const INPUT =
  "h-11 rounded-lg border border-slate-300 bg-white px-3 text-lg font-medium tabular-nums text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300 dark:focus:ring-slate-700";
/** A worked sum shown inline: "7 × 5 = 35". */
export const SUM_CHIP = "rounded-md bg-white px-2 py-0.5 text-[13px] tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700";

export const LessonHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <header className="flex flex-col gap-1.5">
    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
    <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
  </header>
);

export const Card: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = "" }) => (
  <section className={`${CARD} ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3">
        {title && <h3 className={CARD_TITLE}>{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </section>
);

/** A small on/off switch. */
export const Switch: React.FC<{ on: boolean; onChange: (on: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-200 dark:bg-slate-700"}`}
  >
    <span
      className={`absolute left-0.5 size-4 rounded-full shadow-sm transition-transform ${on ? "translate-x-4 bg-white dark:bg-slate-900" : "translate-x-0 bg-white dark:bg-slate-300"}`}
    />
  </button>
);

/** Two or three options side by side, one chosen. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors ${value === id
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export const Examples: React.FC<{ title: string; items: { label: string; onClick: () => void }[] }> = ({ title, items }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-xs text-slate-400 dark:text-slate-500">{title}</span>
    {items.map((e) => (
      <button
        key={e.label}
        type="button"
        onClick={e.onClick}
        className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium tabular-nums text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
      >
        {e.label}
      </button>
    ))}
  </div>
);

export interface StepView {
  title: string;
  body: React.ReactNode;
  /** The picture for the step: number boxes. */
  visual: React.ReactNode;
}

/** Every step, one after another, joined by a line; the last one is the answer. */
export const StepList: React.FC<{ steps: StepView[] }> = ({ steps }) => (
  <ol className="flex flex-col">
    {steps.map((s, i) => {
      const last = i === steps.length - 1;
      return (
        <li key={i} className="relative flex gap-3 pb-6 last:pb-0">
          {!last && <span className="absolute bottom-1 left-3 top-7 w-px bg-slate-200 dark:bg-slate-800" aria-hidden />}
          <span
            className={`relative z-1 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${last ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              }`}
          >
            {last ? "✓" : i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h4 className="pt-0.5 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{s.title}</h4>
            <div className={BODY}>{s.body}</div>
            <div className="overflow-x-auto rounded-xl bg-slate-50 px-4 py-4 dark:bg-slate-900/60">{s.visual}</div>
          </div>
        </li>
      );
    })}
  </ol>
);

/** An on/off preference shared by every lesson and remembered. */
function useStoredFlag(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const set = (value: boolean) => {
    setOn(value);
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Still applies for this visit.
    }
  };
  return [on, set];
}

/** Whether the boxes sit apart. */
export function useBoxGap(): [boolean, (on: boolean) => void, number] {
  const [spaced, set] = useStoredFlag("mathNode.vedic.boxGap");
  return [spaced, set, spaced ? 6 : 0];
}

/** Whether the "at a glance" example plays as an animation. */
export const useAnimate = () => useStoredFlag("mathNode.vedic.animate");

/** The "Animate" switch on a lesson's example. */
export const AnimateSwitch: React.FC<{ on: boolean; onChange: (on: boolean) => void; lang: Lang }> = ({ on, onChange, lang }) => {
  const label = tr(lang)("Animate", "एनिमेशन");
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}
      <Switch on={on} onChange={onChange} label={label} />
    </span>
  );
};

/** The "Space between digits" switch with its label. */
export const GapSwitch: React.FC<{ spaced: boolean; onChange: (on: boolean) => void; lang: Lang }> = ({ spaced, onChange, lang }) => {
  const label = tr(lang)("Space between digits", "अंकों के बीच जगह");
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400">
      {label}
      <Switch on={spaced} onChange={onChange} label={label} />
    </span>
  );
};
