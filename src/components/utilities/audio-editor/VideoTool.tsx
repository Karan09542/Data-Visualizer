import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { ColorPickerTrigger } from "../../image-workspace/components/shared/ColorPickers";
import { parseSolidColor, rgbToHex } from "../imageFormatEncoders";
import { useMedia, usePreview, useJob, fsName } from "./hooks";
import { Slider, ActionBar, Card, CommandLine, Field, FilePick, FileBar, Pills, ResultCard, Transport, card } from "./ui";
import { DEFAULT_VIDEO, NEUTRAL, formatTime, videoArgs, type VideoSettings, type Visual } from "./commands";

const SIZES: { value: VideoSettings["size"]; label: string }[] = [
  { value: "1280x720", label: "16:9 · 720p" },
  { value: "1920x1080", label: "16:9 · 1080p" },
  { value: "1080x1080", label: "Square" },
  { value: "1080x1920", label: "9:16 · Stories" },
];

/** Draws roughly what the video will look like, live from what's playing. */
function useLiveCanvas(canvas: React.RefObject<HTMLCanvasElement | null>, v: VideoSettings, image: HTMLImageElement | null, analyser: () => AnalyserNode | null, playing: boolean, peaks: Float32Array | null) {
  const trail = useRef(document.createElement("canvas"));
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const [W, H] = v.size.split("x").map(Number);
    const k = Math.min(1, 640 / W);
    const w = (c.width = Math.round(W * k));
    const h = (c.height = Math.round(H * k));
    const g = c.getContext("2d")!;
    const t = trail.current;
    t.width = w;
    t.height = h;
    const tg = t.getContext("2d")!;
    tg.fillStyle = "#000";
    tg.fillRect(0, 0, w, h);
    const visual: Visual = !image && v.visual === "none" ? "waves" : v.visual;
    const time = new Float32Array(1024);
    const freq = new Uint8Array(512);
    let raf = 0;
    const frame = () => {
      const an = playing ? analyser() : null;
      if (visual === "spectrum") {
        if (an) {
          an.getByteFrequencyData(freq);
          tg.drawImage(t, -2, 0);
          for (let y = 0; y < h; y++) {
            const x = freq[Math.floor(Math.pow((h - y) / h, 2) * (freq.length - 1))] / 255;
            tg.fillStyle = `hsl(${280 - x * 220},90%,${x * 55}%)`;
            tg.fillRect(w - 2, y, 2, 1);
          }
        }
        g.drawImage(t, 0, 0);
      } else {
        g.fillStyle = `#${v.background}`;
        g.fillRect(0, 0, w, h);
        if (image) {
          const s = Math.min(w / image.naturalWidth, h / image.naturalHeight);
          g.drawImage(image, (w - image.naturalWidth * s) / 2, (h - image.naturalHeight * s) / 2, image.naturalWidth * s, image.naturalHeight * s);
        }
        const vh = h / 3;
        const top = image ? h - vh - h * 0.06 : (h - vh) / 2;
        g.fillStyle = `#${v.color}`;
        if (visual === "waves") {
          if (an) an.getFloatTimeDomainData(time);
          for (let x = 0; x < w; x++) {
            const a = an ? Math.abs(time[Math.floor((x / w) * time.length)]) : peaks ? peaks[Math.floor((x / w) * peaks.length)] * 0.35 : 0.05;
            const hh = Math.max(1, a * vh);
            g.fillRect(x, top + vh / 2 - hh / 2, 1, hh);
          }
        } else if (visual === "bars") {
          if (an) an.getByteFrequencyData(freq);
          const n = 64;
          for (let i = 0; i < n; i++) {
            const lo = Math.floor(Math.pow(i / n, 2) * (freq.length - 1));
            const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / n, 2) * (freq.length - 1)));
            let x = 0;
            for (let j = lo; j < hi; j++) x = Math.max(x, freq[j]);
            const bh = an ? (x / 255) * vh : 3;
            g.fillRect((i * w) / n + 1, top + vh - bh, Math.max(1, w / n - 2), bh);
          }
        }
      }
      if (playing) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [canvas, v, image, analyser, playing, peaks]);
}

const toHex = (c: string) => rgbToHex(parseSolidColor(c) ?? [0, 0, 0]).slice(1);

export const VideoTool: React.FC<{ ready: boolean; file: File | null; onFile: (f: File | null) => void; onLibrary: () => void }> = ({ ready, file, onFile, onLibrary }) => {
  const { info, sound, error, duration } = useMedia(file, ready);
  const [v, setV] = useState<VideoSettings>(DEFAULT_VIDEO);
  const set = (x: Partial<VideoSettings>) => setV((s) => ({ ...s, ...x }));
  const [picture, setPicture] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const preview = usePreview(sound?.buffer ?? null, NEUTRAL);
  const { job, output, run, clear } = useJob();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picture) return setImage(null);
    const url = URL.createObjectURL(picture);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [picture]);
  useLiveCanvas(canvas, v, image, preview.analyser, preview.playing, sound?.peaks ?? null);

  const aName = file ? fsName("audio", file) : "audio";
  const iName = picture ? fsName("cover", picture) : null;
  const args = file && info?.hasAudio ? videoArgs(aName, iName, "video.mp4", v) : null;
  const key = JSON.stringify([v, file?.name, picture?.name]);
  const outdated = !!output && output.key !== key;
  const [W, H] = v.size.split("x").map(Number);

  if (!file) return <FilePick onFile={onFile} title="Drop the audio for your video" subtitle="A song, podcast or voice note → an MP4 for YouTube, Instagram, WhatsApp…" />;

  return (
    <div className="flex flex-col gap-4">
      <FileBar file={file} info={info} duration={duration} onReplace={(f) => (preview.stop(), clear(), onFile(f))} onClose={() => (preview.stop(), clear(), onFile(null))} />
      {error ? (
        <div className={`${card} p-4 text-sm text-red-500`}>{error}</div>
      ) : (
        <>
          <div className={`${card} p-3 sm:p-4 flex flex-col gap-3`}>
            <div className="flex justify-center rounded-lg bg-slate-100 dark:bg-[#0d1117] border border-slate-100 dark:border-slate-800 p-3">
              <canvas ref={canvas} className="rounded-md max-h-[340px] max-w-full" style={{ aspectRatio: `${W} / ${H}` }} />
            </div>
            <Transport p={preview} enabled={!!sound?.buffer} time={preview.position} total={duration} />
          </div>
          <Card title="Look" icon={Video}>
            <div className="flex flex-col gap-6">
              <Field label="Cover picture (optional)">
                <div className="flex items-center gap-3 flex-wrap">
                  <input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => (setPicture(e.target.files?.[0] ?? null), (e.target.value = ""))} />
                  {picture && image && (
                    <div className="flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]">
                      <img src={image.src} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{picture.name}</span>
                      <button onClick={() => setPicture(null)} className="p-1 text-slate-400 hover:text-red-500" aria-label="Remove picture">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <button onClick={() => pick.current?.click()} className="h-8 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5">
                    <ImagePlus size={14} /> {picture ? "Change" : "Add a picture"}
                  </button>
                </div>
              </Field>
              <Field label="Moving visual">
                <Pills<Visual>
                  options={[{ value: "waves", label: "Waveform" }, { value: "bars", label: "Frequency bars" }, { value: "spectrum", label: "Spectrum" }, ...(picture ? [{ value: "none" as Visual, label: "Picture only" }] : [])]}
                  value={!picture && v.visual === "none" ? "waves" : v.visual}
                  onChange={(x) => set({ visual: x })}
                />
              </Field>
              <Field label="Size">
                <Pills options={SIZES} value={v.size} onChange={(x) => set({ size: x })} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 items-center">
                <div className="flex items-center gap-6">
                  {(
                    [
                      ["color", "Visual"],
                      ["background", "Background"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <ColorPickerTrigger color={`#${v[k]}`} onChange={(c: string) => set({ [k]: toHex(c) })} title={label} className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/20 shadow-inner" style={{ backgroundColor: `#${v[k]}` }} />
                      {label}
                    </label>
                  ))}
                </div>
                <Slider label="Frame rate" value={v.fps} min={10} max={30} step={5} onChange={(x) => set({ fps: x })} format={(x) => `${x} fps`} ends={["Quicker to make", "Smoother"]} disabled={v.visual === "none" && !!picture} />
              </div>
              <p className="text-[11px] text-slate-500">Encoded in your browser (H.264 + AAC). A moving visual takes about as long as the sound; a still picture is much quicker.</p>
            </div>
          </Card>
          <CommandLine args={args} />
          {output && <ResultCard output={output} outdated={outdated} onLibrary={onLibrary} />}
        </>
      )}
      <ActionBar
        job={job}
        icon={Video}
        canRun={ready && !!args}
        outdated={outdated}
        label={outdated ? "Make again" : "Make video"}
        summary={!ready ? "Set up the engine to make videos" : !args ? "Reading the file…" : `MP4 · ${v.size.replace("x", "×")} · ${formatTime(duration, 0)}`}
        onRun={() => {
          if (!args || !file) return;
          preview.stop();
          run({ args, inputs: [{ name: aName, data: file }, ...(picture && iName ? [{ name: iName, data: picture }] : [])], outputs: ["video.mp4"], name: () => `${file.name.replace(/\.[^.]+$/, "")}.mp4`, key, seconds: duration || null, tool: "Audio to MP4" });
        }}
      />
    </div>
  );
};
