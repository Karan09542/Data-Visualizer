/** Building blocks shared by the Audio Editor's tools. */
import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  AudioLines,
  Check,
  ChevronDown,
  Copy,
  Download,
  Film,
  HardDrive,
  Library,
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Replace,
  RotateCcw,
  SkipBack,
  WandSparkles,
  X,
} from "lucide-react";
import { ModernSlider } from "../ModernSlider";
import CustomSelect from "../../CustomSelect";
import { ToggleSwitch } from "../../image-workspace/components/shared/PanelPrimitives";
import { FileDropzoneUpload } from "../FileDropzoneUpload";
import { cancelFFmpeg } from "../../../utils/ffmpeg/client";
import { CORE_BYTES } from "../../../utils/ffmpeg/coreStore";
import { FORMATS, formatInfo, formatCommand, formatTime, type OutputSettings, type ProbeInfo } from "./commands";
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

export const card = "rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#12161f]";
export const input =
  "w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500/40";

// ---------------------------------------------------------------- small pieces

export const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-1.5 py-px rounded text-[9px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 whitespace-nowrap">
    {children}
  </span>
);

export const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{children}</span>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{label}</span>
    {children}
  </div>
);

export const ToggleRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; badge?: string }> = ({ label, hint, checked, onChange, badge }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05]">
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        {label}
        {badge && <Badge>{badge}</Badge>}
      </p>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
    <ToggleSwitch checked={checked} onChange={onChange} showState={false} title={label} />
  </div>
);

/** A row of pill choices. */
export function Pills<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
            o.value === value
              ? "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/30"
              : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({ label, className = "", children, ...rest }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={`h-9 min-w-9 px-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-30 ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/** A titled card; optionally folds. */
export const Card: React.FC<{ title: string; icon?: React.ElementType; right?: React.ReactNode; children: React.ReactNode; fold?: boolean; open?: boolean }> = ({
  title,
  icon: Icon,
  right,
  children,
  fold,
  open: initial = true,
}) => {
  const [open, setOpen] = useState(initial);
  return (
    <section className={card}>
      <div className={`flex items-center gap-2 px-4 sm:px-5 h-12 ${open ? "border-b border-slate-100 dark:border-white/[0.06]" : ""}`}>
        <button type="button" disabled={!fold} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:cursor-default">
          {Icon && <Icon size={16} className="text-violet-500" />}
          {title}
          {fold && <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />}
        </button>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      {open && <div className="p-4 sm:p-5">{children}</div>}
    </section>
  );
};

export const ResetButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="h-7 px-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none">
    <RotateCcw size={12} /> Reset
  </button>
);

// ---------------------------------------------------------------- engine

export const EngineSetup: React.FC<{ engine: Engine }> = ({ engine }) => {
  if (["ready", "starting", "checking"].includes(engine.status)) return null;
  const { progress, error } = engine;
  const pct = progress ? (progress.loaded / progress.total) * 100 : 0;
  const mb = Math.round(CORE_BYTES / 1e6);
  return (
    <div className={`${card} p-5 relative overflow-hidden`}>
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25">
          <HardDrive size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Set up the audio engine</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Every tool runs ffmpeg inside your browser — your audio never leaves this device. A one-time {mb} MB download, kept on this device and available
            offline.
          </p>
          {engine.status === "downloading" ? (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                <span className="truncate">{progress ? `${bytes(progress.loaded)} of ${bytes(progress.total)} · ${progress.source} → ${progress.where === "opfs" ? "OPFS" : "IndexedDB"}` : "Connecting…"}</span>
                <button onClick={engine.cancel} className="font-semibold hover:text-red-500">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <p className="mt-3 text-xs text-red-500 flex items-start gap-1.5">
                  <AlertCircle size={13} className="mt-px shrink-0" /> {error}
                </p>
              )}
              <button onClick={engine.download} className="mt-4 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-violet-600/25 active:scale-[0.98] transition">
                <Download size={16} /> {error ? "Try again" : `Download engine · ${mb} MB`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- files

export const FilePick: React.FC<{ onFile: (f: File) => void; title: string; subtitle: string; accept?: string }> = ({ onFile, title, subtitle, accept = ACCEPT_MEDIA }) => (
  <FileDropzoneUpload onFileSelected={onFile} accept={accept} title={title} subtitle={subtitle} accentColor="purple" enableCamera={false} enableClipboard={false} />
);

/** The open file: name and details, replace, close. */
export const FileBar: React.FC<{ file: File; info: ProbeInfo | null; duration: number; label?: string; accept?: string; onReplace: (f: File) => void; onClose: () => void }> = ({
  file,
  info,
  duration,
  label,
  accept = ACCEPT_MEDIA,
  onReplace,
  onClose,
}) => {
  const pick = useRef<HTMLInputElement>(null);
  return (
    <div className={`${card} p-3 flex items-center gap-3`}>
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0">{info?.hasVideo ? <Film size={20} /> : <Music2 size={20} />}</div>
      <div className="min-w-0 flex-1">
        {label && <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">{label}</p>}
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={file.name}>
          {file.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {duration > 0 && <Chip>{formatTime(duration, 0)}</Chip>}
          {info?.codec && <Chip>{info.codec}</Chip>}
          {info?.sampleRate && <Chip>{(info.sampleRate / 1000).toFixed(1)} kHz</Chip>}
          {info?.channels && <Chip>{info.channels === 1 ? "Mono" : info.channels === 2 ? "Stereo" : `${info.channels} ch`}</Chip>}
          <Chip>{bytes(file.size)}</Chip>
        </div>
      </div>
      <input ref={pick} type="file" accept={accept} className="hidden" onChange={(e) => (e.target.files?.[0] && onReplace(e.target.files[0]), (e.target.value = ""))} />
      <IconButton label="Open another file" onClick={() => pick.current?.click()}>
        <Replace size={15} />
        <span className="hidden sm:inline">Replace</span>
      </IconButton>
      <IconButton label="Close file" onClick={onClose} className="hover:!text-red-500">
        <X size={16} />
      </IconButton>
    </div>
  );
};

// ---------------------------------------------------------------- waveform

const tickStep = (dur: number, width: number) => [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].find((s) => s >= (dur / Math.max(1, width)) * 80) ?? 3600;

export const Waveform: React.FC<{
  peaks: Float32Array | null;
  duration: number;
  start?: number;
  end?: number;
  /** Handles to keep only a part */
  onTrim?: (start: number, end: number) => void;
  playhead?: number | null;
  onSeek?: (t: number) => void;
  /** Lines across, e.g. split points */
  markers?: number[];
  height?: number;
  ruler?: boolean;
}> = ({ peaks, duration, start = 0, end = duration, onTrim, playhead, onSeek, markers, height = 104, ruler = true }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ mode: "s" | "e" | "new"; anchor: number; moved: boolean } | null>(null);
  const live = useRef({ start, end });
  live.current = { start, end };

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    g.fillStyle = "rgba(148,163,184,0.18)";
    g.fillRect(0, height / 2, width, 1);
    if (!peaks) return;
    const bars = Math.floor(width / 3);
    const grad = g.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#d946ef");
    grad.addColorStop(0.5, "#8b5cf6");
    grad.addColorStop(1, "#d946ef");
    const s = duration ? start / duration : 0;
    const e = duration ? end / duration : 1;
    for (let i = 0; i < bars; i++) {
      const v = peaks[Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length))];
      const h = Math.max(1.5, v * (height - 12));
      const pos = (i + 0.5) / bars;
      g.fillStyle = pos >= s && pos <= e ? grad : "rgba(148,163,184,0.3)";
      g.fillRect(i * 3, (height - h) / 2, 2, h);
    }
  }, [peaks, width, start, end, duration, height]);

  const at = (x: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((x - r.left) / r.width) * duration));
  };
  const pct = (t: number) => `${duration ? (t / duration) * 100 : 0}%`;
  const step = tickStep(duration, width);
  const ticks = duration ? Array.from({ length: Math.min(200, Math.floor(duration / step) + 1) }, (_, i) => i * step) : [];

  return (
    <div className="select-none">
      {ruler && (
        <div className="relative h-5 text-[10px] tabular-nums text-slate-400">
          {ticks.map((t) => (
            <div key={t} className="absolute top-0" style={{ left: pct(t) }}>
              <div className="w-px h-1.5 bg-slate-300 dark:bg-white/15" />
              {t > 0 && t < duration - step / 2 && <span className="absolute top-1.5 -translate-x-1/2">{formatTime(t, step < 1 ? 1 : 0)}</span>}
            </div>
          ))}
        </div>
      )}
      <div
        ref={wrap}
        className="relative rounded-xl bg-slate-50 dark:bg-[#0a0d14] ring-1 ring-slate-200 dark:ring-white/5 overflow-hidden touch-none cursor-pointer"
        style={{ height }}
        onPointerDown={(e) => {
          if (!duration) return;
          const t = at(e.clientX);
          if (!onTrim) return onSeek?.(t);
          const px = (v: number) => (v / duration) * wrap.current!.clientWidth;
          const x = e.clientX - wrap.current!.getBoundingClientRect().left;
          drag.current = { mode: Math.abs(x - px(start)) < 12 ? "s" : Math.abs(x - px(end)) < 12 ? "e" : "new", anchor: t, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !onTrim) return;
          const t = at(e.clientX);
          if (!d.moved && Math.abs(t - d.anchor) < duration * 0.004) return;
          d.moved = true;
          const { start: s, end: en } = live.current;
          if (d.mode === "s") onTrim(Math.min(t, en - 0.05), en);
          else if (d.mode === "e") onTrim(s, Math.max(t, s + 0.05));
          else onTrim(Math.min(d.anchor, t), Math.max(d.anchor, t, Math.min(d.anchor, t) + 0.05));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const t = at(e.clientX);
            if (t >= start && t <= end) onSeek?.(t);
          }
        }}
      >
        <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
        {onTrim && (
          <>
            <div className="absolute inset-y-0 left-0 bg-slate-900/[0.05] dark:bg-black/45 pointer-events-none" style={{ width: pct(start) }} />
            <div className="absolute inset-y-0 right-0 bg-slate-900/[0.05] dark:bg-black/45 pointer-events-none" style={{ left: pct(end) }} />
            {[start, end].map((t, i) => (
              <div key={i} className="absolute inset-y-0 -translate-x-1/2 w-5 flex justify-center cursor-ew-resize" style={{ left: pct(t) }}>
                <div className="w-0.5 h-full bg-violet-500" />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-8 rounded-full bg-white border-2 border-violet-500 shadow-md" />
                <span className={`absolute ${i ? "bottom-1 right-3" : "top-1 left-3"} px-1 rounded bg-violet-600 text-white text-[9px] font-semibold tabular-nums whitespace-nowrap`}>{formatTime(t)}</span>
              </div>
            ))}
          </>
        )}
        {markers?.map((m, i) => (
          <div key={i} className="absolute inset-y-0 w-px bg-fuchsia-500 pointer-events-none" style={{ left: pct(m) }}>
            <span className="absolute top-1 left-1 px-1 rounded bg-fuchsia-500 text-white text-[9px] font-bold">{i + 2}</span>
          </div>
        ))}
        {playhead != null && (
          <div className="absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.9)] pointer-events-none" style={{ left: pct(playhead) }} />
        )}
        {!peaks && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Reading the sound…</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- transport

export const LevelMeter: React.FC<{ level: number }> = ({ level }) => {
  const d = 20 * Math.log10(Math.max(level, 1e-4));
  return (
    <div className="flex items-center gap-1.5" title={level ? `${d.toFixed(1)} dB` : "Silent"}>
      <div className="w-16 sm:w-24 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 via-70% to-amber-400 transition-[width] duration-75" style={{ width: `${Math.max(0, Math.min(100, ((d + 48) / 48) * 100))}%` }} />
      </div>
      <span className={`w-1.5 h-1.5 rounded-full ${level >= 0.99 ? "bg-red-500" : "bg-slate-300 dark:bg-white/15"}`} />
    </div>
  );
};

export const Transport: React.FC<{ p: PreviewControls; enabled: boolean; time: number; total: number; compare?: boolean }> = ({ p, enabled, time, total, compare }) => (
  <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
    <IconButton label="Back to start" onClick={p.rewind} disabled={!enabled} className="rounded-full">
      <SkipBack size={16} />
    </IconButton>
    <button
      onClick={p.toggle}
      disabled={!enabled}
      className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 active:scale-95 transition disabled:opacity-40 disabled:shadow-none"
      title={p.playing ? "Pause (Space)" : "Play (Space)"}
      aria-label={p.playing ? "Pause" : "Play"}
    >
      {p.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
    </button>
    <IconButton label="Loop" onClick={() => p.setLoop(!p.loop)} disabled={!enabled} className={`rounded-full ${p.loop ? "!text-violet-600 dark:!text-violet-300 bg-violet-500/10" : ""}`} aria-pressed={p.loop}>
      <Repeat size={16} />
    </IconButton>
    <span className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-200 ml-1">
      {formatTime(time)}
      <span className="text-slate-400"> / {formatTime(total)}</span>
    </span>
    <div className="ml-auto flex items-center gap-3">
      <LevelMeter level={p.level} />
      {compare && (
        <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-xs font-semibold" role="radiogroup" aria-label="Compare">
          {[false, true].map((b) => (
            <button
              key={String(b)}
              role="radio"
              aria-checked={p.bypass === b}
              disabled={!enabled}
              onClick={() => p.setBypass(b)}
              className={`h-7 px-2.5 rounded-md transition-colors ${p.bypass === b ? "bg-white dark:bg-[#232a38] text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              {b ? "Original" : "Edited"}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

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
  const f = formatInfo(o.format);
  const rates = f.bitrates ?? [];
  const idx = Math.max(0, rates.indexOf(o.bitrate));
  return (
    <Card title="Format & tags" icon={AudioLines} fold open={open} right={<span className="text-xs text-slate-500 tabular-nums">{f.label}{f.bitrates ? ` · ${o.bitrate} kbps` : ""}</span>}>
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
                className={`relative px-3 py-2.5 rounded-xl border text-left transition-all ${on ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]" : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}`}
              >
                <span className={`block text-sm font-bold ${on ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-100"}`}>{x.label}</span>
                <span className="block text-[10px] leading-tight text-slate-500 dark:text-slate-400 truncate">{x.hint}</span>
                {on && <Check size={12} className="absolute top-2 right-2 text-violet-500" />}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          {rates.length ? (
            <ModernSlider label="Quality" value={idx} min={0} max={rates.length - 1} onChange={(i) => set({ bitrate: rates[i] })} format={(i) => `${rates[i]} kbps`} ends={["Smaller file", "Better sound"]} />
          ) : o.format === "wav" ? (
            <Field label="Bit depth">
              <CustomSelect value={String(o.wavBits)} onChange={(v) => set({ wavBits: Number(v) as 16 | 24 })} options={[{ label: "16-bit · CD", value: "16" }, { label: "24-bit · studio", value: "24" }]} className="w-full" />
            </Field>
          ) : (
            <p className="text-xs text-slate-500 self-center">FLAC keeps every detail at about half the size of WAV.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sample rate">
              <CustomSelect value={String(o.sampleRate)} onChange={(v) => set({ sampleRate: Number(v) })} options={RATES.map((r) => (r.value === "0" && autoRate ? { ...r, label: autoRate } : r))} className="w-full" />
            </Field>
            <Field label="Channels">
              <CustomSelect value={String(o.channels)} onChange={(v) => set({ channels: Number(v) })} options={CHANNELS} className="w-full" />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 dark:border-white/[0.06]">
          {(["title", "artist", "album"] as const).map((k) => (
            <label key={k}>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 capitalize">{k}</span>
              <input value={o[k]} onChange={(e) => set({ [k]: e.target.value })} className={input} placeholder={k === "title" ? "Name in music players" : ""} />
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
    <div className="px-1 text-xs">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <span className="font-mono">&gt;_</span> ffmpeg command <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="relative mt-2">
          <pre className="text-[11px] leading-relaxed font-mono p-3 pr-10 rounded-xl bg-[#0a0d14] text-slate-200 ring-1 ring-white/10 whitespace-pre-wrap break-all max-h-48 overflow-auto">{text}</pre>
          <button onClick={() => navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))} className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white" title="Copy">
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
    <div className={`${card} p-4 transition-opacity ${outdated ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Check size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{one ? one.name : `${output.files.length} files`}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {bytes(total)} ·{" "}
            {outdated ? (
              "made with earlier settings"
            ) : (
              <button onClick={onLibrary} className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                <Library size={11} /> saved in Library
              </button>
            )}
          </p>
        </div>
        {one && onUse && !one.blob.type.startsWith("video/") && (
          <IconButton label="Use in another tool" onClick={() => onUse(new File([one.blob], one.name, { type: one.blob.type }))} className="border border-slate-200 dark:border-white/10">
            <WandSparkles size={14} /> <span className="hidden sm:inline">Use in…</span>
          </IconButton>
        )}
        {one ? (
          <button onClick={() => download(one.blob, one.name)} className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/20">
            <Download size={15} /> Download
          </button>
        ) : (
          <button
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
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {zipping ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} All as ZIP
          </button>
        )}
      </div>
      {one ? (
        one.blob.type.startsWith("video/") ? (
          <video src={one.url} controls className="mt-3 w-full max-h-80 rounded-xl bg-black" />
        ) : (
          <audio src={one.url} controls className="mt-3 w-full h-10" />
        )
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {output.files.map((f) => (
            <li key={f.url} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate w-28 sm:w-44 shrink-0">{f.name}</span>
              <audio src={f.url} controls preload="none" className="h-8 flex-1 min-w-0" />
              <IconButton label={`Download ${f.name}`} onClick={() => download(f.blob, f.name)}>
                <Download size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Bottom bar: what will be made, and the button or progress. */
export const ActionBar: React.FC<{ job: JobState; summary: React.ReactNode; label: string; icon: React.ElementType; canRun: boolean; outdated: boolean; onRun: () => void }> = ({
  job,
  summary,
  label,
  icon: Icon,
  canRun,
  outdated,
  onRun,
}) => {
  const [details, setDetails] = useState(false);
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-4 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#0c0f16] dark:via-[#0c0f16]/95">
      {job.error && (
        <div className="mb-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span className="min-w-0 break-words">{job.error}</span>
            {job.log.length > 0 && (
              <button onClick={() => setDetails(!details)} className="ml-auto shrink-0 underline text-slate-500">
                {details ? "Hide" : "Details"}
              </button>
            )}
          </div>
          {details && <pre className="mt-2 max-h-40 overflow-auto p-2 rounded bg-slate-900 text-slate-200 text-[10px] whitespace-pre-wrap">{job.log.slice(-60).join("\n")}</pre>}
        </div>
      )}
      <div className={`${card} shadow-lg shadow-slate-900/5 p-2.5 pl-4 flex items-center gap-3`}>
        <div className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400 truncate">
          {job.running ? <span className="font-semibold text-violet-600 dark:text-violet-300">Processing… {Math.round(job.ratio * 100)}%</span> : summary}
        </div>
        {job.running ? (
          <div className="flex items-center gap-2 w-1/2 max-w-xs">
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width]" style={{ width: `${job.ratio * 100}%` }} />
            </div>
            <IconButton label="Cancel" onClick={cancelFFmpeg} className="hover:!text-red-500">
              <X size={15} /> Cancel
            </IconButton>
          </div>
        ) : (
          <button
            onClick={onRun}
            disabled={!canRun}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-600/25 active:scale-[0.98] transition flex items-center gap-2 shrink-0 disabled:bg-slate-200 dark:disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none"
          >
            {outdated ? <RefreshCw size={16} /> : <Icon size={16} />}
            {label}
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- equaliser

export const EqFader: React.FC<{ label: string; freq: number; value: number; onChange: (v: number) => void }> = ({ label, freq, value, onChange }) => {
  const track = useRef<HTMLDivElement>(null);
  const fromY = (y: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(Math.max(-12, Math.min(12, (1 - (y - r.top) / r.height) * 24 - 12)));
  };
  const p = (value + 12) / 24;
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span className={`text-[11px] font-semibold tabular-nums ${value ? "text-violet-600 dark:text-violet-300" : "text-slate-400"}`}>{`${value > 0 ? "+" : ""}${value}`}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={`${label}, ${freq} Hz`}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={value}
        aria-valuetext={`${value} dB`}
        className="relative w-10 h-40 cursor-pointer touch-none focus:outline-none group"
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
        <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-1.5 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-5 h-px bg-slate-300 dark:bg-white/20" />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-500"
          style={value >= 0 ? { bottom: "50%", height: `${(p - 0.5) * 100}%` } : { top: "50%", height: `${(0.5 - p) * 100}%` }}
        />
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-4 rounded-md bg-white border-2 border-violet-500 shadow group-focus-visible:ring-4 group-focus-visible:ring-violet-500/30" style={{ top: `${(1 - p) * 100}%` }} />
      </div>
      <div className="text-center leading-tight">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        <p className="text-[10px] text-slate-400 tabular-nums">{freq >= 1000 ? `${freq / 1000}k` : freq} Hz</p>
      </div>
    </div>
  );
};
