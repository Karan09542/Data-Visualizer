import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Loader2, MicVocal, RefreshCw, ScanSearch, Activity } from "lucide-react";
import { useMedia, fsName } from "./hooks";
import { Card, Chip, FilePick, FileBar, bytes, card } from "./ui";
import { runFFmpeg, errorFromLog } from "../../../utils/ffmpeg/client";
import { formatTime, inspectArgs, parseLoudness, picturesArgs, type FxParams, type LoudnessReport } from "./commands";
import type { ToolId } from "./tools";

const TARGETS = [
  { label: "Podcasts & streaming", lufs: -16 as const },
  { label: "Music apps", lufs: -14 as const },
  { label: "TV & broadcast", lufs: -23 as const },
];

const Stat: React.FC<{ label: string; value: string; hint: string; tone?: "good" | "warn" }> = ({ label, value, hint, tone }) => (
  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
    <p className="text-[11px] font-medium text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
  </div>
);

export const InspectTool: React.FC<{ ready: boolean; file: File | null; onFile: (f: File | null) => void; onOpen: (id: ToolId, f: File, start?: Partial<FxParams>) => void }> = ({ ready, file, onFile, onOpen }) => {
  const { info, error, duration } = useMedia(file, ready);
  const [report, setReport] = useState<LoudnessReport | null>(null);
  const [pics, setPics] = useState<{ spectrum: string; wave: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    setReport(null);
    setPics(null);
    setFailed(null);
    if (!file || !ready || !info?.hasAudio) return;
    let alive = true;
    const urls: string[] = [];
    (async () => {
      setBusy(true);
      const name = fsName("inspect", file);
      try {
        const r = await runFFmpeg(inspectArgs(name), [{ name, data: file }]);
        if (!alive) return;
        const rep = parseLoudness(r.log.join("\n"));
        if (rep.integrated == null && rep.maxVolume == null) setFailed(errorFromLog(r.log));
        setReport(rep);
        const p = await runFFmpeg(picturesArgs(name, "spectrum.png", "wave.png"), [{ name, data: file }], { outputs: ["spectrum.png", "wave.png"] });
        if (!alive) return;
        const get = (n: string) => p.files.find((f) => f.name === n)?.data;
        const s = get("spectrum.png");
        const w = get("wave.png");
        if (s && w) {
          const url = (d: Uint8Array) => (urls.push(URL.createObjectURL(new Blob([d as BlobPart], { type: "image/png" }))), urls[urls.length - 1]);
          setPics({ spectrum: url(s), wave: url(w) });
        }
      } catch (e: any) {
        if (alive) setFailed(e?.message || String(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file, ready, info, again]);

  if (!file) return <FilePick onFile={onFile} title="Drop a file to inspect" subtitle="How loud it is, whether it clips, and what's in it" />;

  const I = report?.integrated ?? null;
  const tp = report?.truePeak ?? null;
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v + 40) / 40) * 100))}%`;

  return (
    <div className="flex flex-col gap-4">
      <FileBar file={file} info={info} duration={duration} onReplace={onFile} onClose={() => onFile(null)} />
      {error ? (
        <div className={`${card} p-4 text-sm text-red-500`}>{error}</div>
      ) : (
        <>
          <Card
            title="Loudness"
            icon={Activity}
            right={
              busy ? (
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Measuring…
                </span>
              ) : (
                <button onClick={() => setAgain((n) => n + 1)} className="text-xs text-slate-500 hover:text-violet-600 flex items-center gap-1">
                  <RefreshCw size={12} /> Again
                </button>
              )
            }
          >
            {!report ? (
              <p className="h-32 flex items-center justify-center text-sm text-slate-500">{!ready ? "Set up the engine to inspect files" : failed ?? "Listening to the whole file…"}</p>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Loudness" value={I != null ? `${I.toFixed(1)} LUFS` : "—"} hint="Average over the file" />
                  <Stat label="True peak" value={tp != null ? `${tp.toFixed(1)} dBTP` : "—"} hint={tp != null && tp > -1 ? "Too near 0: may distort" : "Headroom is fine"} tone={tp != null && tp > -1 ? "warn" : "good"} />
                  <Stat label="Range" value={report.range != null ? `${report.range.toFixed(1)} LU` : "—"} hint={report.range == null ? "" : report.range > 15 ? "Very dynamic" : report.range < 5 ? "Even, compressed" : "Natural"} />
                  <Stat label="Average volume" value={report.meanVolume != null ? `${report.meanVolume.toFixed(1)} dB` : "—"} hint={report.maxVolume != null ? `Loudest ${report.maxVolume.toFixed(1)} dB` : ""} />
                </div>
                {I != null && (
                  <div className="relative mt-2 mb-6">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-sky-500/50 via-emerald-500/60 via-70% to-red-500/70" />
                    {TARGETS.map((t) => (
                      <div key={t.lufs} className="absolute -top-1" style={{ left: at(t.lufs) }}>
                        <div className="w-px h-4 bg-slate-400/70" />
                        <span className="absolute top-5 -translate-x-1/2 text-[9px] text-slate-400">{t.lufs}</span>
                      </div>
                    ))}
                    <div className="absolute -top-1.5 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-white border-2 border-violet-600 shadow" style={{ left: at(I) }} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {TARGETS.map((t) => {
                    const diff = I != null ? t.lufs - I : 0;
                    const ok = Math.abs(diff) <= 1.5;
                    return (
                      <div key={t.lufs} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                        {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                        <p className="min-w-0 flex-1 text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{t.label}</span>
                          <span className="text-slate-500"> · {t.lufs} LUFS · </span>
                          <span className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{ok ? "right level" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} dB`}</span>
                        </p>
                        {!ok && (
                          <button onClick={() => onOpen("loudness", file, { normalize: true, loudness: t.lufs })} className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shrink-0">
                            Fix
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => onOpen("denoise", file)} className="self-start text-xs font-medium text-violet-600 dark:text-violet-300 hover:underline flex items-center gap-1.5">
                  <MicVocal size={13} /> Noisy recording? Open in Noise Reduce
                </button>
              </div>
            )}
          </Card>
          <Card title="Picture of the sound" icon={ImageIcon}>
            {pics ? (
              <div className="flex flex-col gap-4">
                <figure>
                  <img src={pics.wave} alt="Waveform" className="w-full rounded-lg bg-[#0a0d14]" />
                  <figcaption className="mt-1.5 text-[11px] text-slate-500">Waveform · {info?.channels === 1 ? "mono" : "left above, right below"}</figcaption>
                </figure>
                <figure>
                  <img src={pics.spectrum} alt="Spectrogram" className="w-full rounded-lg bg-black" />
                  <figcaption className="mt-1.5 text-[11px] text-slate-500">Spectrogram · time across, pitch up, brightness = loudness</figcaption>
                </figure>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-400">{busy ? <Loader2 size={18} className="animate-spin" /> : "—"}</div>
            )}
          </Card>
          <Card title="Details" icon={ScanSearch} fold open={false}>
            <div className="flex flex-wrap gap-2">
              <Chip>{formatTime(duration, 2)}</Chip>
              {info?.codec && <Chip>codec {info.codec}</Chip>}
              {info?.sampleRate && <Chip>{info.sampleRate} Hz</Chip>}
              {info?.channels && <Chip>{info.channels} channel{info.channels > 1 ? "s" : ""}</Chip>}
              {info?.bitrate && <Chip>{info.bitrate} kbps</Chip>}
              <Chip>{bytes(file.size)}</Chip>
              {Object.entries(info?.tags ?? {}).map(([k, val]) => (
                <Chip key={k}>
                  {k}: {val}
                </Chip>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
