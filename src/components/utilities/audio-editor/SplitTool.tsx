import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Split } from "lucide-react";
import { useMedia, usePreview, useJob, fsName, useWaveformVisible } from "./hooks";
import { Slider, ActionBar, Card, CommandLine, FilePick, FileBar, OutputCard, Pills, ResultCard, Transport, card } from "./ui";
import { MiniBar, WaveToggle } from "./ui";
import { Waveform } from "./Waveform";
import { useAccent } from "./palette";
import { runFFmpeg } from "../../../utils/ffmpeg/client";
import { DEFAULT_OUTPUT, NEUTRAL, cutsAtPauses, evenCuts, everyCuts, formatInfo, formatTime, parseSilences, silenceDetectArgs, splitArgs, type OutputSettings } from "./commands";

type Mode = "parts" | "every" | "pauses";

export const SplitTool: React.FC<{ ready: boolean; file: File | null; onFile: (f: File | null) => void; onUse: (f: File) => void; onLibrary: () => void }> = ({ ready, file, onFile, onUse, onLibrary }) => {
  const a = useAccent();
  const { info, sound, error, duration } = useMedia(file, ready);
  const [out, setOut] = useState<OutputSettings>(DEFAULT_OUTPUT);
  const [mode, setMode] = useState<Mode>("parts");
  const [parts, setParts] = useState(3);
  const [every, setEvery] = useState(60);
  const [quiet, setQuiet] = useState(-35);
  const [pause, setPause] = useState(0.8);
  const [minPart, setMinPart] = useState(5);
  const [pauses, setPauses] = useState<{ start: number; end: number }[] | null>(null);
  const [finding, setFinding] = useState(false);
  const preview = usePreview(sound?.buffer ?? null, NEUTRAL);
  const [showWave, setShowWave] = useWaveformVisible();
  const { job, output, run, clear } = useJob();

  // Finding pauses is an ffmpeg pass (silencedetect): run it when the settings settle
  useEffect(() => {
    if (mode !== "pauses" || !file || !ready || error) return;
    let alive = true;
    const t = setTimeout(async () => {
      setFinding(true);
      const name = fsName("detect", file);
      const r = await runFFmpeg(silenceDetectArgs(name, quiet, pause), [{ name, data: file }]).catch(() => null);
      if (alive) setPauses(r ? parseSilences(r.log.join("\n")) : []), setFinding(false);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [mode, file, ready, error, quiet, pause]);

  const cuts = useMemo(
    () => (!duration ? [] : mode === "parts" ? evenCuts(duration, parts) : mode === "every" ? everyCuts(duration, every) : pauses ? cutsAtPauses(pauses, duration, minPart) : []),
    [mode, duration, parts, every, pauses, minPart],
  );
  const fmt = formatInfo(out.format);
  const inName = file ? fsName("input", file) : "input";
  const args = file && info?.hasAudio ? splitArgs(inName, "part_", cuts, out, info) : null;
  const key = JSON.stringify([out, cuts, file?.name]);
  const outdated = !!output && output.key !== key;
  const base = file?.name.replace(/\.[^.]+$/, "") ?? "audio";

  if (!file) return <FilePick onFile={onFile} title="Drop a file to split" subtitle="A long recording, a podcast, an album side…" />;

  return (
    <div className="flex flex-col gap-4">
      <FileBar file={file} info={info} duration={duration} onReplace={(f) => (preview.stop(), clear(), setPauses(null), onFile(f))} onClose={() => (preview.stop(), clear(), onFile(null))} />
      {error ? (
        <div className={`${card} p-4 text-sm text-red-500`}>{error}</div>
      ) : (
        <>
          <div className={`${card} p-3 sm:p-4 flex flex-col gap-3`}>
            <div className="flex justify-end -mt-1 -mb-1">
              <WaveToggle on={showWave} onChange={setShowWave} />
            </div>
            {showWave ? (
              <Waveform peaks={sound?.peaks ?? null} buffer={sound?.buffer} duration={duration} markers={cuts} playhead={sound?.buffer ? preview.position : null} onSeek={preview.seek} />
            ) : (
              <MiniBar duration={duration} position={sound?.buffer ? preview.position : null} onSeek={preview.seek} markers={cuts} />
            )}
            <Transport p={preview} enabled={!!sound?.buffer} time={preview.position} total={duration} />
          </div>
          <Card
            title="Split"
            icon={Split}
            right={
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                {finding && <Loader2 size={12} className="animate-spin" />}
                {cuts.length + 1} parts
              </span>
            }
          >
            <div className="flex flex-col gap-6">
              <Pills<Mode> options={[{ value: "parts", label: "Equal parts" }, { value: "every", label: "Every…" }, { value: "pauses", label: "At pauses" }]} value={mode} onChange={setMode} />
              {mode === "parts" && <Slider label="Number of parts" value={parts} min={2} max={20} onChange={setParts} format={(v) => `${v} parts · ${formatTime(duration / v, 0)} each`} />}
              {mode === "every" && (
                <Slider
                  label="Each part"
                  value={every}
                  min={5}
                  max={Math.max(10, Math.min(1800, Math.ceil(duration)))}
                  step={5}
                  onChange={setEvery}
                  format={(v) => formatTime(v, 0)}
                  marks={[{ value: 30, label: "30 s" }, { value: 60, label: "1 min" }, { value: 300, label: "5 min" }, { value: 600, label: "10 min" }].filter((x) => x.value < duration)}
                />
              )}
              {mode === "pauses" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Slider label="Quiet below" value={quiet} min={-60} max={-20} onChange={setQuiet} format={(v) => `${v} dB`} />
                    <Slider label="Pause at least" value={pause} min={0.2} max={4} step={0.1} onChange={setPause} format={(v) => `${v.toFixed(1)} s`} />
                    <Slider label="Parts at least" value={minPart} min={1} max={120} onChange={setMinPart} format={(v) => formatTime(v, 0)} />
                  </div>
                  {pauses && !finding && (
                    <p className="text-xs text-slate-500">
                      Found {pauses.length} pause{pauses.length === 1 ? "" : "s"}
                      {pauses.length > 0 && !cuts.length && " — none far enough apart; lower “Parts at least”"}.
                    </p>
                  )}
                </>
              )}
              {cuts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[0, ...cuts].map((c, i) => (
                    <button key={i} onClick={() => preview.seek(c)} className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-800 text-[11px] tabular-nums text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" title="Listen from here">
                      <b className={`font-bold ${a.text}`}>{i + 1}</b> {formatTime(c, 0)}–{formatTime(cuts[i] ?? duration, 0)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <OutputCard o={out} set={(x) => setOut((o) => ({ ...o, ...x }))} />
          <CommandLine args={args} />
          {output && <ResultCard output={output} outdated={outdated} onUse={onUse} onLibrary={onLibrary} />}
        </>
      )}
      <ActionBar
        job={job}
        icon={Split}
        canRun={ready && !!args && !finding}
        outdated={outdated}
        label={outdated ? "Split again" : `Split into ${cuts.length + 1}`}
        summary={!ready ? "Set up the engine to split" : !args ? "Reading the file…" : `${cuts.length + 1} parts · ${fmt.label}`}
        onRun={() => {
          if (!args || !file) return;
          preview.stop();
          run({ args, inputs: [{ name: inName, data: file }], outputPrefix: "part_", name: (i) => `${base} - part ${String(i + 1).padStart(2, "0")}.${fmt.ext}`, key, seconds: duration || null, tool: "Split Audio" });
        }}
      />
    </div>
  );
};
