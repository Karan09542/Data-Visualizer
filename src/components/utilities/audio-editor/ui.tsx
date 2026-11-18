/**
 * Building blocks for the Audio Editor, in the app's own look (slate surfaces, #161b22 cards in
 * dark mode). Each tool has its own light colour (see palette.ts): its waveform, sliders,
 * switches, chips and main button all take it from the AccentProvider around the tool.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Archive, AudioWaveform, Check, EyeOff, ChevronDown, ChevronsUpDown, Copy, Download, FileAudio, Film, HardDrive, Library, Loader2, Pause, Play, Repeat, Replace, RotateCcw, SkipBack, WandSparkles, X } from "lucide-react";
import { FileDropzoneUpload } from "../FileDropzoneUpload";
import { cancelFFmpeg } from "../../../utils/ffmpeg/client";
import { CORE_BYTES } from "../../../utils/ffmpeg/coreStore";
import { FORMATS, formatInfo, formatCommand, formatTime, type OutputSettings, type ProbeInfo } from "./commands";
import { useAccent } from "./palette";
import type { Engine, JobOutput, JobState, PreviewControls } from "./hooks";

export const ACCEPT_MEDIA = "audio/*,video/*,.mp3,.m4a,.aac,.flac,.ogg,.oga,.opus,.wav,.wma,.aif,.aiff,.amr,.webm,.mkv,.mp4,.mov,.3gp,.avi,.m4v";
export const ACCEPT_VIDEO = "video/*,.mp4,.mov,.mkv,.webm,.avi,.3gp,.m4v";

export const bytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(b < 104857600 ? 1 : 0)} MB`);

export const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------------------------------------------------------------- tokens (the app's surfaces)

export const card = "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#161b22] dark:shadow-none";
export const input =
  "w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0d1117] dark:text-slate-100";
export const secondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors";
export const muted = "text-slate-500 dark:text-slate-400";
const solidBase = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/** Follows the app's light/dark switch (for canvases). */
export function useDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const mo = new MutationObserver(() => setDark(el.classList.contains("dark")));
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

// ---------------------------------------------------------------- small pieces

export const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-1.5 py-px rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">{children}</span>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{label}</span>
    {children}
  </div>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({ label, className = "", children, ...rest }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={`h-8 min-w-8 px-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/** The tool's main button, in its colour. */
export const SolidButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...rest }) => {
  const a = useAccent();
  return (
    <button type="button" className={`${solidBase} ${a.solid} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => {
  const a = useAccent();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors focus:outline-none focus-visible:ring-2 ${a.ring} ${checked ? a.fill : "bg-slate-200 dark:bg-slate-700"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
};

export const ToggleRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; badge?: string }> = ({ label, hint, checked, onChange, badge }) => (
  <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-50 dark:bg-[#0d1117] border border-slate-100 dark:border-slate-800">
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {badge && <Badge>{badge}</Badge>}
      </p>
      {hint && <p className={`text-xs ${muted}`}>{hint}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} label={label} />
  </div>
);

/** Choice chips, the chosen one in the tool's colour. */
export function Pills<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  const a = useAccent();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors ${
            o.value === value ? a.soft : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A range slider in the tool's colour. Native input underneath (keyboard, touch, screen readers). */
export const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  ends?: [string, string];
  marks?: { value: number; label: string }[];
  badge?: string;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, format, ends, marks, badge, disabled }) => {
  const a = useAccent();
  const id = useId();
  const p = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  return (
    <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
          {label}
          {badge && <Badge>{badge}</Badge>}
        </label>
        <span className={`text-xs font-semibold tabular-nums ${a.text}`}>{format ? format(value) : value}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/70" />
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full ${a.fill}`} style={{ width: `calc(${p * 100}% + ${9 - p * 18}px)` }} />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={format ? format(value) : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer focus:outline-none ${a.thumb}
            [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-full
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:shadow
            [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[3px]`}
        />
      </div>
      {ends && (
        <div className={`flex justify-between mt-1 text-[11px] ${muted}`}>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
      {marks && marks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {marks.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(m.value)}
              className={`h-6 px-2 rounded-md border text-[11px] font-medium transition-colors ${m.value === value ? a.soft : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** A dropdown in the tool's colour: arrows / Enter / Escape / type-ahead, opens upward when there's no room below. */
export function Select<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  const a = useAccent();
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[hi]?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  const show = () => {
    const r = root.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < Math.min(260, options.length * 36 + 16) && r.top > window.innerHeight - r.bottom);
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    root.current!.querySelector("button")?.focus(); // arrows and Enter work however it was opened
  };
  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setHi((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open ? pick(hi) : show();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // close the list, not the tools window
      setOpen(false);
    } else if (open && e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setHi(i);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`w-full h-9 pl-3 pr-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 ${a.ring} ${
          open ? `${a.border} bg-white dark:bg-[#0d1117]` : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-[#0d1117] dark:hover:border-slate-600"
        } text-slate-800 dark:text-slate-100`}
      >
        <span className="flex-1 truncate">{current?.label ?? "—"}</span>
        <ChevronsUpDown size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          className={`absolute z-30 left-0 right-0 ${up ? "bottom-full mb-1" : "top-full mt-1"} max-h-64 overflow-auto p-1 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1c222b]`}
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={on}
                onPointerEnter={() => setHi(i)}
                onClick={() => pick(i)}
                className={`h-8 px-2.5 rounded-lg flex items-center gap-2 text-[13px] cursor-pointer ${on ? `font-semibold ${a.text}` : "text-slate-700 dark:text-slate-200"} ${i === hi ? (on ? a.soft : "bg-slate-100 dark:bg-slate-800") : ""}`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {on && <Check size={14} className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A titled card; optionally folds. */
export const Card: React.FC<{ title: string; icon?: React.ElementType; right?: React.ReactNode; children: React.ReactNode; fold?: boolean; open?: boolean }> = ({ title, icon: Icon, right, children, fold, open: initial = true }) => {
  const a = useAccent();
  const [open, setOpen] = useState(initial);
  return (
    <section className={card}>
      <div className={`flex items-center gap-2 px-4 sm:px-5 h-12 ${open ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
        <button type="button" disabled={!fold} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:cursor-default">
          {Icon && (
            <span className={`w-6 h-6 rounded-md flex items-center justify-center ${a.icon}`}>
              <Icon size={14} />
            </span>
          )}
          {title}
          {fold && <ChevronDown size={15} className="text-slate-400 transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />}
        </button>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      {open && <div className="p-4 sm:p-5">{children}</div>}
    </section>
  );
};

export const ResetButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
  <IconButton label="Reset" onClick={onClick} disabled={disabled}>
    <RotateCcw size={13} /> Reset
  </IconButton>
);

// ---------------------------------------------------------------- engine

export const EngineSetup: React.FC<{ engine: Engine }> = ({ engine }) => {
  const a = useAccent();
  if (["ready", "starting", "checking"].includes(engine.status)) return null;
  const { progress, error } = engine;
  const mb = Math.round(CORE_BYTES / 1e6);
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>
          <HardDrive size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Set up the audio engine</p>
          <p className={`text-[13px] mt-1 leading-relaxed ${muted}`}>
            The tools run ffmpeg in your browser — nothing is uploaded. It's a one-time {mb} MB download, kept on this device for offline use.
          </p>
          {engine.status === "downloading" ? (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full transition-[width] ${a.fill}`} style={{ width: `${progress ? (progress.loaded / progress.total) * 100 : 0}%` }} />
              </div>
              <div className={`mt-2 flex items-center justify-between gap-2 text-xs tabular-nums ${muted}`}>
                <span className="truncate">{progress ? `${bytes(progress.loaded)} of ${bytes(progress.total)} · ${progress.source} → ${progress.where === "opfs" ? "OPFS" : "IndexedDB"}` : "Connecting…"}</span>
                <button onClick={engine.cancel} className="font-semibold hover:text-slate-800 dark:hover:text-slate-100">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertCircle size={13} className="mt-px shrink-0" /> {error}
                </p>
              )}
              <SolidButton onClick={engine.download} className="mt-4 h-9 px-4 text-[13px]">
                <Download size={15} /> {error ? "Try again" : `Download · ${mb} MB`}
              </SolidButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- files

export const FilePick: React.FC<{ onFile: (f: File) => void; title: string; subtitle: string; accept?: string }> = ({ onFile, title, subtitle, accept = ACCEPT_MEDIA }) => (
  <FileDropzoneUpload onFileSelected={onFile} accept={accept} title={title} subtitle={subtitle} accentColor="blue" enableCamera={false} enableClipboard={false} />
);

/** The open file: name, one line of details, replace, close. */
export const FileBar: React.FC<{ file: File; info: ProbeInfo | null; duration: number; label?: string; accept?: string; onReplace: (f: File) => void; onClose: () => void }> = ({
  file,
  info,
  duration,
  label,
  accept = ACCEPT_MEDIA,
  onReplace,
  onClose,
}) => {
  const a = useAccent();
  const pick = useRef<HTMLInputElement>(null);
  const details = [
    duration > 0 && formatTime(duration, 0),
    info?.codec?.toUpperCase(),
    info?.sampleRate && `${(info.sampleRate / 1000).toFixed(1)} kHz`,
    info?.channels && (info.channels === 1 ? "Mono" : info.channels === 2 ? "Stereo" : `${info.channels} ch`),
    bytes(file.size),
  ].filter(Boolean);
  return (
    <div className={`${card} px-3 py-2.5 flex items-center gap-3 min-w-0`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>{info?.hasVideo ? <Film size={18} /> : <FileAudio size={18} />}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={file.name}>
          {label && <span className={`font-semibold ${a.text}`}>{label} · </span>}
          {file.name}
        </p>
        <p className={`text-xs truncate tabular-nums ${muted}`}>{details.join(" · ")}</p>
      </div>
      <input ref={pick} type="file" accept={accept} className="hidden" onChange={(e) => (e.target.files?.[0] && onReplace(e.target.files[0]), (e.target.value = ""))} />
      <IconButton label="Replace file" onClick={() => pick.current?.click()}>
        <Replace size={15} />
      </IconButton>
      <IconButton label="Close file" onClick={onClose} className="hover:!text-red-500">
        <X size={15} />
      </IconButton>
    </div>
  );
};

// ---------------------------------------------------------------- waveform stand-ins

/** Show / hide the waveform. */
export const WaveToggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <IconButton label={on ? "Hide waveform (lighter on slow devices)" : "Show waveform"} onClick={() => onChange(!on)} aria-pressed={on}>
    {on ? <EyeOff size={15} /> : <AudioWaveform size={15} />}
    <span className="hidden sm:inline">{on ? "Hide wave" : "Show wave"}</span>
  </IconButton>
);

/** A slim seek bar used while the waveform is hidden: position, kept part, split points. */
export const MiniBar: React.FC<{ duration: number; position: number | null; onSeek?: (t: number) => void; start?: number; end?: number; markers?: number[] }> = ({ duration, position, onSeek, start, end, markers }) => {
  const a = useAccent();
  const pct = (t: number) => `${duration ? Math.max(0, Math.min(100, (t / duration) * 100)) : 0}%`;
  return (
    <div
      className="relative h-6 cursor-pointer"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek?.(Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration)));
      }}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
      {start != null && end != null && <div className={`absolute top-1/2 -translate-y-1/2 h-1.5 opacity-30 ${a.fill}`} style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />}
      {position != null && <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full ${a.fill}`} style={{ width: pct(position) }} />}
      {markers?.map((m, i) => <div key={i} className={`absolute top-0.5 bottom-0.5 w-0.5 ${a.fill}`} style={{ left: pct(m) }} />)}
      {position != null && <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 ${a.border}`} style={{ left: pct(position) }} />}
    </div>
  );
};

// ---------------------------------------------------------------- transport

export const LevelMeter: React.FC<{ level: number }> = ({ level }) => {
  const d = 20 * Math.log10(Math.max(level, 1e-4));
  return (
    <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" title={level ? `Peak ${d.toFixed(1)} dB` : "Level"}>
      <div className={`h-full transition-[width] duration-75 ${level >= 0.99 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(0, Math.min(100, ((d + 48) / 48) * 100))}%` }} />
    </div>
  );
};

export const PlayButton: React.FC<{ playing: boolean; disabled?: boolean; onClick: () => void }> = ({ playing, disabled, onClick }) => {
  const a = useAccent();
  return (
    <button onClick={onClick} disabled={disabled} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 ${a.solid}`} title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"}>
      {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
    </button>
  );
};

export const Transport: React.FC<{ p: PreviewControls; enabled: boolean; time: number; total: number; compare?: boolean }> = ({ p, enabled, time, total, compare }) => {
  const a = useAccent();
  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
      <PlayButton playing={p.playing} disabled={!enabled} onClick={p.toggle} />
      <IconButton label="Back to start" onClick={p.rewind} disabled={!enabled}>
        <SkipBack size={15} />
      </IconButton>
      <IconButton label="Loop" onClick={() => p.setLoop(!p.loop)} disabled={!enabled} aria-pressed={p.loop} className={p.loop ? `border ${a.soft}` : ""}>
        <Repeat size={15} />
      </IconButton>
      <span className="ml-1 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">
        {formatTime(time)} <span className="text-slate-400">/ {formatTime(total)}</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <LevelMeter level={p.level} />
        {compare && (
          <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#0d1117] text-xs font-semibold" role="radiogroup" aria-label="Compare">
            {[false, true].map((b) => (
              <button
                key={String(b)}
                role="radio"
                aria-checked={p.bypass === b}
                disabled={!enabled}
                onClick={() => p.setBypass(b)}
                className={`h-7 px-2.5 rounded-md transition-colors ${p.bypass === b ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                {b ? "Original" : "Edited"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- output

const RATES = [
  ["0", "Keep original"],
  ["8000", "8 kHz · phone"],
  ["16000", "16 kHz · voice"],
  ["22050", "22.05 kHz"],
  ["44100", "44.1 kHz · CD"],
  ["48000", "48 kHz · video"],
].map(([value, label]) => ({ value, label }));
const CHANNELS = [
  ["0", "Keep original"],
  ["1", "Mono"],
  ["2", "Stereo"],
].map(([value, label]) => ({ value, label }));

export const OutputCard: React.FC<{ o: OutputSettings; set: (p: Partial<OutputSettings>) => void; open?: boolean; autoRate?: string }> = ({ o, set, open = false, autoRate }) => {
  const a = useAccent();
  const f = formatInfo(o.format);
  const rates = f.bitrates ?? [];
  const idx = Math.max(0, rates.indexOf(o.bitrate));
  return (
    <Card title="Format & tags" icon={FileAudio} fold open={open} right={<span className={`text-xs font-medium tabular-nums ${muted}`}>{f.label}{f.bitrates ? ` · ${o.bitrate} kbps` : ""}</span>}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="radiogroup" aria-label="Format">
          {FORMATS.map((x) => {
            const on = x.id === o.format;
            return (
              <button
                key={x.id}
                role="radio"
                aria-checked={on}
                onClick={() => set({ format: x.id, bitrate: x.defaultBitrate ?? o.bitrate })}
                className={`relative px-3 py-2 rounded-lg border text-left transition-colors ${on ? a.soft : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:hover:bg-slate-800/60"}`}
              >
                <span className={`block text-[13px] font-bold ${on ? "" : "text-slate-800 dark:text-slate-100"}`}>{x.label}</span>
                <span className={`block text-[11px] leading-tight truncate ${on ? "opacity-80" : muted}`}>{x.hint}</span>
                {on && <Check size={12} className="absolute top-2 right-2" />}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          {rates.length ? (
            <Slider label="Bitrate" value={idx} min={0} max={rates.length - 1} onChange={(i) => set({ bitrate: rates[i] })} format={(i) => `${rates[i]} kbps`} ends={["Smaller", "Better"]} />
          ) : o.format === "wav" ? (
            <Field label="Bit depth">
              <Select label="Bit depth" value={o.wavBits} onChange={(v) => set({ wavBits: v })} options={[{ label: "16-bit · CD", value: 16 as const }, { label: "24-bit · studio", value: 24 as const }]} />
            </Field>
          ) : (
            <p className={`text-xs self-center ${muted}`}>FLAC keeps every detail at about half the size of WAV.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sample rate">
              <Select label="Sample rate" value={String(o.sampleRate)} onChange={(v) => set({ sampleRate: Number(v) })} options={RATES.map((r) => (r.value === "0" && autoRate ? { ...r, label: autoRate } : r))} />
            </Field>
            <Field label="Channels">
              <Select label="Channels" value={String(o.channels)} onChange={(v) => set({ channels: Number(v) })} options={CHANNELS} />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
          {(["title", "artist", "album"] as const).map((k) => (
            <label key={k}>
              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 capitalize">{k}</span>
              <input value={o[k]} onChange={(e) => set({ [k]: e.target.value })} className={input} />
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
};

export const CommandLine: React.FC<{ args: string[] | null }> = ({ args }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!args) return null;
  const text = formatCommand(args);
  return (
    <div className="text-xs">
      <button onClick={() => setOpen(!open)} className={`flex items-center gap-1 font-medium hover:text-slate-800 dark:hover:text-slate-200 ${muted}`}>
        ffmpeg command <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div className="relative mt-2">
          <pre className="text-[11px] leading-relaxed font-mono p-3 pr-10 rounded-lg bg-[#0d1117] text-slate-300 border border-slate-800 whitespace-pre-wrap break-all max-h-48 overflow-auto">{text}</pre>
          <button onClick={() => navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))} className="absolute top-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10" title="Copy">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- results

export const ResultCard: React.FC<{ output: JobOutput; outdated: boolean; onUse?: (f: File) => void; onLibrary?: () => void }> = ({ output, outdated, onUse, onLibrary }) => {
  const [zipping, setZipping] = useState(false);
  const one = output.files.length === 1 ? output.files[0] : null;
  const total = output.files.reduce((n, f) => n + f.blob.size, 0);
  return (
    <div className={`${card} p-4 transition-opacity ${outdated ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Check size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{one ? one.name : `${output.files.length} files`}</p>
          <p className={`text-xs ${muted}`}>
            {bytes(total)} ·{" "}
            {outdated ? (
              "made with earlier settings"
            ) : (
              <button onClick={onLibrary} className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-2">
                <Library size={11} /> Saved to Library
              </button>
            )}
          </p>
        </div>
        {one && onUse && !one.blob.type.startsWith("video/") && (
          <button onClick={() => onUse(new File([one.blob], one.name, { type: one.blob.type }))} className={`${secondary} h-8 px-3 text-xs`}>
            <WandSparkles size={13} /> Use in…
          </button>
        )}
        {one ? (
          <SolidButton onClick={() => download(one.blob, one.name)} className="h-8 px-3.5 text-xs">
            <Download size={14} /> Download
          </SolidButton>
        ) : (
          <SolidButton
            disabled={zipping}
            onClick={async () => {
              setZipping(true);
              try {
                const { default: JSZip } = await import("jszip");
                const zip = new JSZip();
                output.files.forEach((f) => zip.file(f.name, f.blob));
                download(await zip.generateAsync({ type: "blob", compression: "STORE" }), `${output.files[0].name.replace(/ - part \d+\.[^.]+$/, "")}.zip`);
              } finally {
                setZipping(false);
              }
            }}
            className="h-8 px-3.5 text-xs"
          >
            {zipping ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} Download all
          </SolidButton>
        )}
      </div>
      {one ? (
        one.blob.type.startsWith("video/") ? (
          <video src={one.url} controls className="mt-3 w-full max-h-80 rounded-lg bg-black" />
        ) : (
          <audio src={one.url} controls className="mt-3 w-full h-10" />
        )
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
          {output.files.map((f) => (
            <li key={f.url} className="flex items-center gap-2 py-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-32 sm:w-48 shrink-0">{f.name}</span>
              <audio src={f.url} controls preload="none" className="h-8 flex-1 min-w-0" />
              <IconButton label={`Download ${f.name}`} onClick={() => download(f.blob, f.name)}>
                <Download size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Footer: what will be made, and the button (or progress). */
export const ActionBar: React.FC<{ job: JobState; summary: React.ReactNode; label: string; icon?: React.ElementType; canRun: boolean; outdated: boolean; onRun: () => void }> = ({
  job,
  summary,
  label,
  icon: Icon,
  canRun,
  onRun,
}) => {
  const a = useAccent();
  const [details, setDetails] = useState(false);
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-auto px-4 sm:px-6 pt-3 pb-4 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#0c0f16] dark:via-[#0c0f16]/95">
      {job.error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span className="min-w-0 break-words">{job.error}</span>
            {job.log.length > 0 && (
              <button onClick={() => setDetails(!details)} className="ml-auto shrink-0 underline">
                {details ? "Hide" : "Details"}
              </button>
            )}
          </div>
          {details && <pre className="mt-2 max-h-40 overflow-auto p-2 rounded bg-[#0d1117] text-slate-300 text-[10px] whitespace-pre-wrap">{job.log.slice(-60).join("\n")}</pre>}
        </div>
      )}
      <div className={`${card} !shadow-md p-2.5 pl-4 flex items-center gap-4`}>
        <div className={`min-w-0 flex-1 text-xs tabular-nums truncate ${muted}`}>
          {job.running ? (
            <div className="flex items-center gap-3">
              <span className={`font-semibold shrink-0 ${a.text}`}>Processing {Math.round(job.ratio * 100)}%</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full transition-[width] ${a.fill}`} style={{ width: `${job.ratio * 100}%` }} />
              </div>
            </div>
          ) : (
            summary
          )}
        </div>
        {job.running ? (
          <button onClick={cancelFFmpeg} className={`${secondary} h-9 px-4 text-[13px]`}>
            Cancel
          </button>
        ) : (
          <SolidButton onClick={onRun} disabled={!canRun} className="h-9 px-4 text-[13px] shrink-0">
            {Icon && <Icon size={15} />}
            {label}
          </SolidButton>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- equaliser

export const EqFader: React.FC<{ label: string; freq: number; value: number; onChange: (v: number) => void }> = ({ label, freq, value, onChange }) => {
  const a = useAccent();
  const track = useRef<HTMLDivElement>(null);
  const fromY = (y: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(Math.max(-12, Math.min(12, (1 - (y - r.top) / r.height) * 24 - 12)));
  };
  const p = (value + 12) / 24;
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span className={`text-[11px] font-semibold tabular-nums ${value ? a.text : "text-slate-400"}`}>{`${value > 0 ? "+" : ""}${value}`}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={`${label}, ${freq} Hz`}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={value}
        aria-valuetext={`${value} dB`}
        className="relative w-9 h-36 cursor-pointer touch-none focus:outline-none group"
        onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), onChange(fromY(e.clientY)))}
        onPointerMove={(e) => e.buttons && onChange(fromY(e.clientY))}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(e) => {
          const next = e.key === "ArrowUp" ? value + 1 : e.key === "ArrowDown" ? value - 1 : e.key === "Home" ? 0 : null;
          if (next == null) return;
          e.preventDefault();
          onChange(Math.max(-12, Math.min(12, next)));
        }}
      >
        <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700/70" />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-4 h-px bg-slate-300 dark:bg-slate-600" />
        <div className={`absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full ${a.fill}`} style={value >= 0 ? { bottom: "50%", height: `${(p - 0.5) * 100}%` } : { top: "50%", height: `${(0.5 - p) * 100}%` }} />
        <div className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-3.5 rounded-md bg-white border-[3px] shadow ${a.border}`} style={{ top: `${(1 - p) * 100}%` }} />
      </div>
      <div className="text-center leading-tight">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-400 tabular-nums">{freq >= 1000 ? `${freq / 1000}k` : freq}</p>
      </div>
    </div>
  );
};
