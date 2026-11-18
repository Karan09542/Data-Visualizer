import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Image as ImageIcon, Loader2, MicVocal, RefreshCw, ScanSearch, Activity } from "lucide-react";
import { useMedia, fsName } from "./hooks";
import { Card, FilePick, FileBar, bytes, card, download, secondary } from "./ui";
import { useAccent } from "./palette";
import { runFFmpeg, errorFromLog, Cancelled } from "../../../utils/ffmpeg/client";
import { coverArgs, formatTime, inspectArgs, parseLoudness, type FxParams, type LoudnessReport } from "./commands";
import type { ToolId } from "./tools";

const TARGETS = [
  { label: "Podcasts & streaming", lufs: -16 as const },
  { label: "Music apps", lufs: -14 as const },
  { label: "TV & broadcast", lufs: -23 as const },
];

const Stat: React.FC<{ label: string; value: string; hint: string; tone?: "good" | "warn" }> = ({ label, value, hint, tone }) => (
  <div className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
    <p className="text-[11px] font-medium text-slate-500">{label}</p>
    <p className={`mt-1 text-lg font-semibold tracking-tight tabular-nums ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
  </div>
);

export const InspectTool: React.FC<{ ready: boolean; file: File | null; onFile: (f: File | null) => void; onOpen: (id: ToolId, f: File, start?: Partial<FxParams>) => void }> = ({ ready, file, onFile, onOpen }) => {
  const a = useAccent();
  const { info, error, duration } = useMedia(file, ready);
  const [report, setReport] = useState<LoudnessReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [again, setAgain] = useState(0);
  const [cover, setCover] = useState<{ url: string; blob: Blob; w: number; h: number } | null | "none" | "reading">(null);
  const hasAudio = !!info?.hasAudio;
  const hasCover = !!info?.hasCover;

  // Loudness: one quick pass (well under a second per minute of audio). Cancelled — or skipped
  // if still waiting its turn — when the file changes or the tool closes.
  useEffect(() => {
    setReport(null);
    setFailed(null);
    setProgress(0);
    if (!file || !ready || !hasAudio) return;
    const stop = new AbortController();
    const name = fsName("inspect", file);
    setBusy(true);
    runFFmpeg(inspectArgs(name), [{ name, data: file }], {
      signal: stop.signal,
      onProgress: (ratio, secs) => !stop.signal.aborted && setProgress(Math.min(0.99, duration ? secs / duration : ratio)),
    })
      .then((r) => {
        if (stop.signal.aborted) return;
        const rep = parseLoudness(r.log.join("\n"));
        if (rep.integrated == null && rep.maxVolume == null) setFailed(r.code === 0 ? "Couldn't measure this file." : errorFromLog(r.log));
        else setReport(rep);
      })
      .catch((e) => {
        if (!stop.signal.aborted && !(e instanceof Cancelled)) setFailed(`The engine stopped while reading this file (${e?.message || e}).`);
      })
      .finally(() => !stop.signal.aborted && setBusy(false));
    return () => stop.abort();
  }, [file, ready, hasAudio, again]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cover picture: copied out of the file (no audio decoding), when it has one
  useEffect(() => {
    setCover(null);
    if (!file || !ready || !info) return;
    const stop = new AbortController();
    let url: string | null = null;
    const name = fsName("cover_in", file);
    const job = coverArgs(name, info.coverCodec);
    setCover("reading");
    runFFmpeg(job.args, [{ name, data: file }], { outputs: [job.output], signal: stop.signal })
      .then((r) => {
        if (stop.signal.aborted) return;
        const d = r.files[0]?.data;
        if (!d) {
          // a file without a picture simply has no video stream to take; anything else is worth a note
          if (r.code !== 0 && !r.log.some((l) => /matches no streams/.test(l))) console.warn("[audio editor] couldn't take the cover picture out:", errorFromLog(r.log));
          return setCover("none");
        }
        const blob = new Blob([d as BlobPart], { type: job.mime });
        url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => !stop.signal.aborted && setCover({ url: url!, blob, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => {
          console.warn("[audio editor] the cover picture couldn't be shown");
          if (!stop.signal.aborted) setCover("none");
        };
        img.src = url;
      })
      .catch((e) => {
        if (stop.signal.aborted || e instanceof Cancelled) return;
        console.warn("[audio editor] reading the cover picture failed", e);
        setCover("none");
      });
    return () => {
      stop.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, ready, info, hasCover]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => setAgain((n) => n + 1);
  const pct = `${Math.round(progress * 100)}%`;
  /** What the cards say while there's nothing to show yet. */
  const waiting = !ready ? "Set up the audio engine to inspect files." : !info ? "Reading the file…" : busy ? (progress > 0 ? `Measuring the whole file… ${pct}` : "Waiting for the engine…") : null;

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
                <span className="text-xs text-slate-500 flex items-center gap-1.5 tabular-nums">
                  <Loader2 size={12} className="animate-spin" /> {progress > 0 ? pct : "Waiting"}
                </span>
              ) : report || failed ? (
                <button onClick={retry} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1">
                  <RefreshCw size={12} /> Measure again
                </button>
              ) : null
            }
          >
            {!report ? (
              failed ? (
                <div className="h-32 flex flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={15} /> {failed}
                  </p>
                  <button onClick={retry} className={`${secondary} h-8 px-3 text-xs`}>
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center gap-3">
                  <p className="text-sm text-slate-500">{waiting ?? "—"}</p>
                  {busy && (
                    <div className="w-56 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full transition-[width] ${a.fill} ${progress === 0 ? "w-1/3 animate-pulse" : ""}`} style={progress ? { width: pct } : undefined} />
                    </div>
                  )}
                  {busy && duration > 600 && <p className="text-[11px] text-slate-400">Long recordings take a little while — the whole file is listened to.</p>}
                </div>
              )
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
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-sky-200 via-emerald-300 to-rose-300 dark:from-sky-500/30 dark:via-emerald-500/40 dark:to-rose-500/40" />
                    {TARGETS.map((t) => (
                      <div key={t.lufs} className="absolute -top-1" style={{ left: at(t.lufs) }}>
                        <div className="w-px h-4 bg-slate-400/70" />
                        <span className="absolute top-5 -translate-x-1/2 text-[9px] text-slate-400">{t.lufs}</span>
                      </div>
                    ))}
                    <div className={`absolute -top-[5px] -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-[#161b22] ${a.fill}`} style={{ left: at(I) }} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {TARGETS.map((t) => {
                    const diff = I != null ? t.lufs - I : 0;
                    const ok = Math.abs(diff) <= 1.5;
                    return (
                      <div key={t.lufs} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                        <p className="min-w-0 flex-1 text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{t.label}</span>
                          <span className="text-slate-500"> · {t.lufs} LUFS · </span>
                          <span className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{ok ? "right level" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} dB`}</span>
                        </p>
                        {!ok && (
                          <button onClick={() => onOpen("loudness", file, { normalize: true, loudness: t.lufs })} className={`${secondary} h-7 px-2.5 text-xs shrink-0`}>
                            Fix
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => onOpen("denoise", file)} className="self-start text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline-offset-2 hover:underline flex items-center gap-1.5">
                  <MicVocal size={13} /> Noisy recording? Open in Noise Reduce
                </button>
              </div>
            )}
          </Card>
          <Card title="Cover picture" icon={ImageIcon}>
            {cover && typeof cover === "object" ? (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <img src={cover.url} alt="Cover picture" className="w-full sm:w-56 aspect-square object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-[#0d1117]" />
                <div className="flex flex-col gap-3 text-[13px]">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                    <dt className="text-slate-500">Size</dt>
                    <dd className="text-slate-800 dark:text-slate-100 tabular-nums">
                      {cover.w} × {cover.h} px
                    </dd>
                    {info?.tags.title && (
                      <>
                        <dt className="text-slate-500">Title</dt>
                        <dd className="text-slate-800 dark:text-slate-100">{info.tags.title}</dd>
                      </>
                    )}
                    {info?.tags.artist && (
                      <>
                        <dt className="text-slate-500">Artist</dt>
                        <dd className="text-slate-800 dark:text-slate-100">{info.tags.artist}</dd>
                      </>
                    )}
                    {info?.tags.album && (
                      <>
                        <dt className="text-slate-500">Album</dt>
                        <dd className="text-slate-800 dark:text-slate-100">{info.tags.album}</dd>
                      </>
                    )}
                  </dl>
                  <button onClick={() => download(cover.blob, `${file.name.replace(/\.[^.]+$/, "")} cover.${cover.blob.type === "image/png" ? "png" : "jpg"}`)} className={`${secondary} h-8 px-3 text-xs self-start`}>
                    <Download size={13} /> Save picture
                  </button>
                </div>
              </div>
            ) : ready && cover !== "none" ? (
              // still finding out (until the answer is in, "no cover" would be a guess)
              <div className="flex items-center gap-4" aria-busy="true">
                <div className="w-32 aspect-square rounded-xl bg-slate-100 dark:bg-[#0d1117] animate-pulse" />
                <p className="text-sm text-slate-500">Reading the cover picture…</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                  <ImageIcon size={24} />
                </div>
                <p className="text-sm text-slate-500">{!ready ? "Set up the audio engine to read the file." : "This file has no cover picture."}</p>
              </div>
            )}
          </Card>
          <Card title="Details" icon={ScanSearch} fold open={false}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
              {[
                ["Length", formatTime(duration, 2)],
                ["Codec", info?.codec],
                ["Sample rate", info?.sampleRate && `${info.sampleRate} Hz`],
                ["Channels", info?.channels],
                ["Bitrate", info?.bitrate && `${info.bitrate} kbps`],
                ["Size", bytes(file.size)],
                ...Object.entries(info?.tags ?? {}),
              ]
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <React.Fragment key={String(k)}>
                    <dt className="text-slate-500 dark:text-slate-400 capitalize">{k}</dt>
                    <dd className="text-slate-900 dark:text-slate-100 truncate">{String(v)}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </Card>
        </>
      )}
    </div>
  );
};
