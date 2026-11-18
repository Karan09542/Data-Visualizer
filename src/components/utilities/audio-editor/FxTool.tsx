import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMedia, usePreview, useJob, fsName, useWaveformVisible, useEditedWaveform } from "./hooks";
import { Select, Slider, ACCEPT_MEDIA, ACCEPT_VIDEO, ActionBar, Card, CommandLine, EqFader, Field, FilePick, FileBar, OutputCard, Pills, ResetButton, ResultCard, ToggleRow, Transport, bytes, card, input } from "./ui";
import { MiniBar, WaveToggle } from "./ui";
import { Waveform } from "./Waveform";
import { DEFAULT_OUTPUT, EQ_BANDS, NEUTRAL, editArgs, estimateBytes, formatInfo, formatTime, outputName, resultLength, type FxParams, type OutputSettings } from "./commands";
import type { Control, Tool } from "./tools";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One control from a tool's description. */
function ControlView({ c, p, set }: { c: Control; p: FxParams; set: (x: Partial<FxParams>) => void }) {
  if (c.when && !c.when(p)) return null;
  switch (c.type) {
    case "slider":
      return <Slider label={c.label} value={p[c.key]} min={c.min} max={c.max} step={c.step} onChange={(v) => set({ [c.key]: v })} format={c.format} ends={c.ends} marks={c.marks} badge={c.badge} />;
    case "toggle":
      return <ToggleRow label={c.label} hint={c.hint} checked={p[c.key]} onChange={(v) => set({ [c.key]: v })} badge={c.badge} />;
    case "presets": {
      const on = c.options.findIndex((o) => Object.entries(o.set).every(([k, v]) => same(p[k as keyof FxParams], v)));
      return (
        <div>
          {c.label && <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{c.label}</p>}
          <Pills options={c.options.map((o, i) => ({ value: i, label: o.label }))} value={on >= 0 ? on : null} onChange={(i) => set(c.options[i].set)} />
        </div>
      );
    }
    case "choice":
      return (
        <Field label={c.label}>
          <Select label={c.label} value={String(p[c.key])} onChange={(v) => set({ [c.key]: c.key === "loudness" ? Number(v) : v } as Partial<FxParams>)} options={c.options.map((o) => ({ label: o.label, value: String(o.value) }))} />
        </Field>
      );
    case "eq":
      return (
        <div>
          <div className="flex justify-between sm:justify-around px-2 py-4 rounded-lg border border-slate-100 dark:border-slate-800">
            {EQ_BANDS.map((b, i) => (
              <EqFader key={b.f} label={b.label} freq={b.f} value={p.eq[i]} onChange={(v) => set({ eq: p.eq.map((g, j) => (j === i ? v : g)) })} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">Drag a fader or use ↑ ↓. Double-click resets it.</p>
        </div>
      );
  }
}

export const FxTool: React.FC<{
  tool: Tool;
  ready: boolean;
  file: File | null;
  /** Values to start with instead of the tool's own (e.g. "Fix" from Inspect) */
  start?: Partial<FxParams>;
  onFile: (f: File | null) => void;
  onUse: (f: File) => void;
  onLibrary: () => void;
}> = ({ tool, ready, file, start, onFile, onUse, onLibrary }) => {
  const [startFx] = useState<FxParams>(() => ({ ...NEUTRAL, ...tool.start, ...start }));
  const [fx, setFx] = useState<FxParams>(startFx);
  const [out, setOut] = useState<OutputSettings>(() => ({ ...DEFAULT_OUTPUT, ...(tool.format ? { format: tool.format, bitrate: formatInfo(tool.format).defaultBitrate ?? 192 } : {}) }));
  const set = (x: Partial<FxParams>) => setFx((p) => ({ ...p, ...x }));
  const { info, sound, reading, error, duration } = useMedia(file, ready);
  const { job, output, run, clear } = useJob();

  // tags from the file, once
  const [tagged, setTagged] = useState<File | null>(null);
  if (info && file && tagged !== file) {
    setTagged(file);
    setOut((o) => ({ ...o, title: info.tags.title ?? "", artist: info.tags.artist ?? "", album: info.tags.album ?? "" }));
  }

  const end = fx.trimEnd == null ? duration : Math.min(fx.trimEnd, duration);
  const fxFor = useMemo(() => ({ ...fx, trimEnd: fx.trimEnd != null && duration && fx.trimEnd >= duration ? null : fx.trimEnd }), [fx, duration]);
  const preview = usePreview(sound?.buffer ?? null, fxFor);
  // Waveform: hidden saves work; shown, effect tools draw the result (re-rendered after a pause in changes)
  const [showWave, setShowWave] = useWaveformVisible();
  const drawResult = showWave && !!tool.controls?.length && !tool.trim && !preview.bypass;
  const { edited, busy: drawing } = useEditedWaveform(sound?.buffer ?? null, fxFor, drawResult);
  const controls = tool.controls ?? [];
  const hasFx = controls.length > 0;
  const changed = !same(fx, startFx);

  const inName = file ? fsName("input", file) : "input";
  const fmt = formatInfo(out.format);
  const outName = `output.${fmt.ext}`;
  const args = file && info?.hasAudio ? editArgs(inName, outName, fxFor, out, info.duration == null ? { ...info, duration } : info) : null;
  const key = JSON.stringify([fxFor, out, file?.name]);
  const len = info ? resultLength(fxFor, info.duration ?? duration) : null;
  const est = estimateBytes(out, len, info?.sampleRate ?? null, info?.channels ?? null);
  const outdated = !!output && output.key !== key;
  const time = preview.piece;
  const total = Math.max(0, end - fx.trimStart);

  if (!file)
    return (
      <FilePick
        onFile={onFile}
        accept={tool.videoOnly ? ACCEPT_VIDEO : ACCEPT_MEDIA}
        title={tool.videoOnly ? "Drop a video" : "Drop an audio or video file"}
        subtitle={tool.videoOnly ? "MP4, MOV, MKV, WebM… · the sound track is saved as audio" : "MP3, WAV, M4A, FLAC, OGG, Opus, MP4, MOV… · works offline, nothing is uploaded"}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <FileBar file={file} info={info} duration={duration} accept={tool.videoOnly ? ACCEPT_VIDEO : ACCEPT_MEDIA} onReplace={(f) => (preview.stop(), clear(), onFile(f))} onClose={() => (preview.stop(), clear(), onFile(null))} />

      {error ? (
        <div className={`${card} p-4 text-sm text-red-500`}>{error}</div>
      ) : (
        <>
          <div className={`${card} p-3 sm:p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between gap-2 -mt-1 -mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {!showWave ? "Waveform hidden" : edited ? "Result, with effects" : "Original"}
                {drawing && <Loader2 size={11} className="animate-spin" />}
              </span>
              <WaveToggle on={showWave} onChange={setShowWave} />
            </div>
            {!showWave ? (
              <MiniBar
                duration={duration}
                position={sound?.buffer ? preview.position : null}
                onSeek={preview.seek}
                start={tool.trim ? fx.trimStart : undefined}
                end={tool.trim ? end : undefined}
              />
            ) : edited ? (
              // the result's own timeline: trimmed, sped up or slowed, reversed
              <Waveform
                peaks={null}
                buffer={edited}
                duration={edited.duration}
                normalize={false}
                playhead={sound?.buffer ? preview.piece / (fxFor.speed || 1) : null}
                onSeek={(t) => {
                  const q = Math.min(total, t * (fxFor.speed || 1));
                  preview.seek(fxFor.reverse ? end - q : fx.trimStart + q);
                }}
              />
            ) : (
              <Waveform
                peaks={sound?.peaks ?? null}
                buffer={sound?.buffer}
                duration={duration}
                normalize={!tool.controls?.length || !!tool.trim}
                start={tool.trim ? fx.trimStart : 0}
                end={tool.trim ? end : duration}
                onTrim={tool.trim ? (a, b) => set({ trimStart: +a.toFixed(2), trimEnd: b >= duration - 0.01 ? null : +b.toFixed(2) }) : undefined}
                playhead={sound?.buffer ? preview.position : null}
                onSeek={preview.seek}
              />
            )}
            <Transport p={preview} enabled={!!sound?.buffer} time={time} total={total} compare={hasFx && !tool.trim} />
            {tool.trim && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-3 gap-3 items-end">
                {(["Start", "End"] as const).map((l) => (
                  <label key={l}>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">{l} · seconds</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={duration}
                      value={+(l === "Start" ? fx.trimStart : end).toFixed(2)}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(duration, +e.target.value || 0));
                        set(l === "Start" ? { trimStart: Math.min(v, end - 0.05) } : { trimEnd: v >= duration ? null : Math.max(v, fx.trimStart + 0.05) });
                      }}
                      className={input}
                    />
                  </label>
                ))}
                <p className="pb-2 text-xs text-slate-500">
                  Keeping <b className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{formatTime(total)}</b>
                </p>
              </div>
            )}
            {sound && !sound.buffer && <p className="text-[11px] text-slate-500">Live listening is off for sounds over 30 minutes — the file can still be made.</p>}
            {!sound && !reading && <p className="text-[11px] text-slate-500">{ready ? "This file can't be played here, but it can still be converted." : "Set up the engine to open this file."}</p>}
          </div>

          {hasFx && (
            <Card title={tool.label} icon={tool.icon} right={<ResetButton onClick={() => setFx((p) => ({ ...startFx, trimStart: p.trimStart, trimEnd: p.trimEnd }))} disabled={!changed} />}>
              <div className="flex flex-col gap-6">
                {controls.map((c, i) => (
                  <ControlView key={i} c={c} p={fx} set={set} />
                ))}
              </div>
            </Card>
          )}

          <OutputCard o={out} set={(x) => setOut((o) => ({ ...o, ...x }))} open={!hasFx} />
          <CommandLine args={args} />
          {output && <ResultCard output={output} outdated={outdated} onUse={onUse} onLibrary={onLibrary} />}
        </>
      )}

      <ActionBar
        job={job}
        icon={tool.icon}
        canRun={ready && !!args}
        outdated={outdated}
        label={outdated ? "Save again" : `Save as ${fmt.label}`}
        summary={
          !ready ? "Set up the engine to save files" : !args ? (error ? "This file can't be used" : "Reading the file…") : `${fmt.label}${fmt.bitrates ? ` · ${out.bitrate} kbps` : ""}${len != null ? ` · ${formatTime(len, 0)}` : ""}${est != null ? ` · ~${bytes(est)}` : ""}`
        }
        onRun={() => {
          if (!args || !file) return;
          preview.stop();
          run({ args, inputs: [{ name: inName, data: file }], outputs: [outName], name: () => outputName(file.name, fmt.ext, tool.suffix ?? ""), key, seconds: len, tool: tool.label });
        }}
      />
    </div>
  );
};
