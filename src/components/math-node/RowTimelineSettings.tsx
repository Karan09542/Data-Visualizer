import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, Clock, Copy, Infinity as InfinityIcon, Pause, Play, Repeat, RotateCcw } from "lucide-react";
import type { MathFunction } from "./mathTypes";
import { FIELD_CLASS, SETTINGS_CARD, SETTINGS_SUBLABEL, SettingsTitle } from "./SettingsControls";

interface RowTimelineSettingsProps {
  f: MathFunction;
  /** The row's position in the list (1-based): its clock is readable as t_<index>. */
  index: number;
  onPatch: (patch: Partial<MathFunction> | ((fn: MathFunction) => Partial<MathFunction>)) => void;
}

const MODES = [
  { id: "loop", label: "Loop", Icon: Repeat, title: "Start again from the beginning" },
  { id: "bounce", label: "Bounce", Icon: ArrowLeftRight, title: "Run forwards, then backwards" },
  { id: "continuous", label: "Forever", Icon: InfinityIcon, title: "Keep counting up past the end" },
] as const;

/** A number field that keeps what is being typed until it parses, then reports it. */
const NumberField: React.FC<{
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}> = ({ label, value, step, onChange, suffix }) => (
  <label className="flex-1 min-w-0 flex flex-col gap-1">
    <span className={SETTINGS_SUBLABEL}>{label}</span>
    <div className="relative">
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${FIELD_CLASS} text-center ${suffix ? "pr-5" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{suffix}</span>
      )}
    </div>
  </label>
);

/**
 * A row's own clock: it can play, pause and loop separately from the graph's
 * timeline. Inside the row its time is `t`; other rows read it as `t_<n>`.
 */
export const RowTimelineSettings: React.FC<RowTimelineSettingsProps> = ({ f, index, onPatch }) => {
  const on = !!f.hasCustomTimeline;
  const min = f.timeMin ?? 0;
  const max = f.timeMax ?? 10;
  const time = f.time ?? 0;
  const mode = f.timeMode || "loop";

  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const copy = (name: string) => {
    navigator.clipboard?.writeText(name).catch(() => { });
    setCopied(name);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  };

  const toggle = () =>
    onPatch((fn) =>
      on
        ? {
          hasCustomTimeline: false,
          time: undefined,
          isPlaying: undefined,
          timeMin: undefined,
          timeMax: undefined,
          timeSpeed: undefined,
          timeMode: undefined,
          direction: undefined,
        }
        : {
          hasCustomTimeline: true,
          time: fn.time ?? 0,
          isPlaying: fn.isPlaying ?? true,
          timeMin: fn.timeMin ?? 0,
          timeMax: fn.timeMax ?? 10,
          timeSpeed: fn.timeSpeed ?? 1,
          timeMode: fn.timeMode || "loop",
          direction: fn.direction ?? 1,
        },
    );

  const cleanName = f.name?.match(/^([a-zA-Z0-9_]+)/)?.[1];
  const names: { name: string; where: string }[] = [
    { name: "t", where: "in this row" },
    { name: `t_${index}`, where: "in any row" },
    ...(cleanName && cleanName !== "t" && cleanName !== "time" ? [{ name: `t_${cleanName}`, where: "in any row" }] : []),
  ];

  // Forever mode runs past the end, so the scrubber shows where in the range it last was.
  const span = max - min;
  const shown = span > 0 ? Math.max(min, Math.min(max, time)) : min;
  const progress = span > 0 ? ((shown - min) / span) * 100 : 0;

  return (
    <div className={SETTINGS_CARD}>
      <SettingsTitle
        icon={Clock}
        hint={on ? "Runs on its own clock" : "Follows the graph's timeline"}
        right={
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Give this row its own timeline"
            onClick={toggle}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${on ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"}`}
          >
            <span className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow transition duration-200 ${on ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        }
      >
        Own timeline
      </SettingsTitle>

      {on && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          {/* Transport: play, where it is, back to the start */}
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 p-1.5">
            <button
              type="button"
              onClick={() => onPatch((fn) => ({ isPlaying: !fn.isPlaying }))}
              title={f.isPlaying ? "Pause" : "Play"}
              aria-label={f.isPlaying ? "Pause" : "Play"}
              className={`size-7 shrink-0 inline-flex items-center justify-center rounded-full text-white transition-all active:scale-95 ${f.isPlaying ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-500"}`}
            >
              {f.isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
            </button>
            <input
              type="range"
              min={min}
              max={span > 0 ? max : min + 1}
              step={span > 0 ? span / 500 : 0.01}
              value={shown}
              onChange={(e) => onPatch({ time: parseFloat(e.target.value) })}
              aria-label="Time"
              className="flex-1 min-w-0 h-1.5 appearance-none rounded-full cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${progress}%, rgba(148,163,184,0.35) ${progress}%)`,
              }}
            />
            <label className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-slate-400">
              t
              <input
                type="number"
                step="0.01"
                value={Number(time.toFixed(3))}
                onChange={(e) => onPatch({ time: parseFloat(e.target.value) || 0 })}
                className="w-14 h-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-[11px] font-mono tabular-nums text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={() => onPatch((fn) => ({ time: fn.timeMin ?? 0, direction: 1 }))}
              title="Back to the start"
              aria-label="Back to the start"
              className="size-6 shrink-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <div className="flex gap-2">
            <NumberField label="From" value={min} step={0.1} onChange={(v) => onPatch({ timeMin: v })} />
            <NumberField label="To" value={max} step={0.1} onChange={(v) => onPatch({ timeMax: v })} />
            <NumberField label="Speed" value={f.timeSpeed ?? 1} step={0.1} suffix="×" onChange={(v) => onPatch({ timeSpeed: v })} />
          </div>

          <div className="flex flex-col gap-1">
            <span className={SETTINGS_SUBLABEL}>At the end</span>
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800" role="radiogroup" aria-label="At the end">
              {MODES.map(({ id, label, Icon, title }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  title={title}
                  onClick={() => onPatch({ timeMode: id as MathFunction["timeMode"] })}
                  className={`flex-1 h-7 inline-flex items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${mode === id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={SETTINGS_SUBLABEL}>Use its time in a formula</span>
            <div className="flex flex-wrap gap-1.5">
              {names.map(({ name, where }) => {
                const done = copied === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => copy(name)}
                    title={`Copy ${name}`}
                    className={`inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2 rounded-lg border text-[10px] transition-colors ${done
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700"
                      }`}
                  >
                    <code className={`px-1 py-0.5 rounded font-mono font-bold ${done ? "" : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"}`}>
                      {name}
                    </code>
                    <span>{done ? "copied" : where}</span>
                    {done ? <Check size={11} /> : <Copy size={10} className="opacity-60" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
