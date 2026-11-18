import { useCallback, useEffect, useRef, useState } from "react";
import { downloadCore, getStoredCore, removeStoredCore, type CoreProgress, type StoredCore } from "../../../utils/ffmpeg/coreStore";
import { startFFmpeg, isFFmpegRunning, stopFFmpeg, runFFmpeg, errorFromLog, Cancelled } from "../../../utils/ffmpeg/client";
import { parseProbe, type FxParams, type ProbeInfo } from "./commands";
import { Preview, renderForWaveform } from "./preview";
import { saveToLibrary, listLibrary, onLibraryChange, type LibraryItem } from "./library";

// ================================================================ engine

export type EngineStatus = "checking" | "missing" | "downloading" | "starting" | "ready" | "error";

/** Whether ffmpeg is on the device; downloading it once; starting it; removing it. */
export function useEngine() {
  const [status, setStatus] = useState<EngineStatus>("checking");
  const [stored, setStored] = useState<StoredCore | null>(null);
  const [progress, setProgress] = useState<CoreProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    setStatus("starting");
    try {
      await startFFmpeg();
      setStatus("ready");
    } catch (e: any) {
      setError(`The audio engine couldn't start: ${e?.message || e}`);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getStoredCore().then((s) => {
      if (!alive) return;
      setStored(s);
      if (!s) setStatus("missing");
      else if (isFFmpegRunning()) setStatus("ready");
      else start();
    });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [start]);

  const download = useCallback(async () => {
    const ctrl = (abort.current = new AbortController());
    setError(null);
    setProgress(null);
    setStatus("downloading");
    try {
      setStored(await downloadCore(setProgress, ctrl.signal));
      await start();
    } catch (e: any) {
      if (ctrl.signal.aborted || e?.name === "AbortError") setStatus("missing");
      else setError(e?.message || String(e)), setStatus("error");
    } finally {
      abort.current = null;
    }
  }, [start]);

  const remove = useCallback(async () => {
    stopFFmpeg();
    await removeStoredCore();
    setStored(null);
    setStatus("missing");
  }, []);

  return { status, ready: status === "ready", stored, progress, error, download, cancel: () => abort.current?.abort(), remove };
}
export type Engine = ReturnType<typeof useEngine>;

// ================================================================ files

/** A safe name inside ffmpeg's file system, keeping the extension (some formats need it). */
export const fsName = (prefix: string, file: File) => `${prefix}.${(/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] || "bin").toLowerCase()}`;

/** Longer sounds aren't kept decoded for live listening (an hour decoded is over 1 GB). */
const LIVE_MAX_SECONDS = 30 * 60;

export interface Sound {
  /** 0–1 loudness per slice, for the waveform */
  peaks: Float32Array;
  duration: number;
  /** For live listening; null when too long */
  buffer: AudioBuffer | null;
}

export function peaksOf(buffer: AudioBuffer, bars = 1600): Float32Array {
  const out = new Float32Array(bars);
  const per = Math.max(1, Math.floor(buffer.length / bars));
  const stride = Math.max(1, Math.floor(per / 300));
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  let top = 0;
  for (let b = 0; b < bars; b++) {
    let m = 0;
    for (let i = b * per, end = Math.min(buffer.length, i + per); i < end; i += stride) for (const ch of chans) m = Math.max(m, Math.abs(ch[i]));
    out[b] = m;
    top = Math.max(top, m);
  }
  if (top > 0) for (let b = 0; b < bars; b++) out[b] /= top;
  return out;
}

export async function probe(file: File): Promise<ProbeInfo> {
  const name = fsName("probe", file);
  return parseProbe((await runFFmpeg(["-hide_banner", "-i", name], [{ name, data: file }])).log.join("\n"));
}

/** Decodes the sound: the browser first, ffmpeg for what the browser can't read. */
async function decode(file: File, engineReady: boolean): Promise<Sound | null> {
  const fromBytes = async (data: ArrayBuffer): Promise<Sound> => {
    const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(data);
    return { peaks: peaksOf(buf), duration: buf.duration, buffer: buf.duration <= LIVE_MAX_SECONDS ? buf : null };
  };
  try {
    return await fromBytes(await file.arrayBuffer());
  } catch {
    if (!engineReady) return null;
    const name = fsName("decode", file);
    const r = await runFFmpeg(["-hide_banner", "-i", name, "-vn", "-ac", "2", "-ar", "44100", "-f", "wav", "decoded.wav"], [{ name, data: file }], { outputs: ["decoded.wav"] }).catch(() => null);
    const wav = r?.files[0]?.data;
    return wav ? fromBytes(wav.slice().buffer).catch(() => null) : null;
  }
}

/** A file open in a tool: what ffmpeg says about it, and its decoded sound. */
export function useMedia(file: File | null, ready: boolean) {
  const [info, setInfo] = useState<ProbeInfo | null>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setInfo(null);
    setSound(null);
    setError(null);
    if (!file) return;
    let alive = true;
    setReading(true);
    decode(file, ready)
      .then((s) => alive && setSound(s))
      .finally(() => alive && setReading(false));
    if (ready)
      probe(file)
        .then((p) => {
          if (!alive) return;
          if (!p.hasAudio) setError(p.hasVideo ? "This video has no sound track." : "No sound found — is this an audio or video file?");
          setInfo(p);
        })
        .catch((e) => alive && setError(e?.message || String(e)));
    return () => {
      alive = false;
    };
  }, [file, ready]);
  return { info, sound, reading, error, duration: info?.duration ?? sound?.duration ?? 0 };
}

// ================================================================ live listening

export function usePreview(buffer: AudioBuffer | null, params: FxParams) {
  const ref = useRef<Preview | null>(null);
  const [playing, setPlaying] = useState(false);
  const [bypass, setBypassState] = useState(false);
  const [loop, setLoopState] = useState(false);
  const [position, setPosition] = useState(0);
  const [piece, setPiece] = useState(0);
  const [level, setLevel] = useState(0);

  const get = useCallback(() => {
    if (!ref.current) {
      const p = (ref.current = new Preview());
      p.onPlayingChange = (on) => {
        setPlaying(on);
        setPosition(p.position());
        setPiece(p.piecePosition());
      };
    }
    return ref.current;
  }, []);
  const sync = () => {
    const p = ref.current;
    if (p) setPosition(p.position()), setPiece(p.piecePosition());
  };
  useEffect(() => () => ref.current?.dispose(), []);
  useEffect(() => {
    if (!buffer && !ref.current) return;
    get().setBuffer(buffer);
    setPlaying(false);
    sync();
  }, [buffer]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!buffer) return;
    get().setParams(params);
    sync();
  }, [key, buffer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return setLevel(0);
    let raf = 0;
    const tick = () => {
      sync();
      setLevel(ref.current?.level() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = useCallback(async () => {
    const p = get();
    if (!p.hasSound) return;
    if (p.playing) p.pause();
    else await p.play();
    setPlaying(p.playing);
  }, [get]);

  // Space plays and pauses (not while typing or on a control)
  useEffect(() => {
    if (!buffer) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== "Space" || t?.closest?.("input,textarea,button,[role=slider],[role=listbox],[contenteditable=true]")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buffer, toggle]);

  return {
    playing,
    toggle,
    position,
    piece,
    level,
    bypass,
    loop,
    seek: (t: number) => (get().seek(t), sync()),
    rewind: () => (get().rewind(), sync()),
    stop: () => (ref.current?.pause(), setPlaying(false)),
    setBypass: (on: boolean) => (get().setBypass(on), setBypassState(on), sync()),
    setLoop: (on: boolean) => ((get().loop = on), setLoopState(on)),
    analyser: () => ref.current?.analyser ?? null,
  };
}
export type PreviewControls = ReturnType<typeof usePreview>;

// ================================================================ making files

const MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/ogg; codecs=opus", flac: "audio/flac", wav: "audio/wav", mp4: "video/mp4", png: "image/png" };
export const mimeOf = (name: string) => MIME[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""] ?? "application/octet-stream";

export interface OutputFile {
  blob: Blob;
  url: string;
  name: string;
}
export interface JobOutput {
  files: OutputFile[];
  /** The settings it was made with */
  key: string;
}
export interface JobState {
  running: boolean;
  ratio: number;
  error: string | null;
  log: string[];
}

export interface JobSpec {
  args: string[];
  inputs: { name: string; data: Blob }[];
  outputs?: string[];
  outputPrefix?: string;
  /** The name each result gets */
  name: (index: number) => string;
  key: string;
  /** Length of the result, for progress */
  seconds: number | null;
  /** Shown in the library */
  tool: string;
}

/** Runs a command; results become downloadable files and go to the library. */
export function useJob() {
  const [job, setJob] = useState<JobState>({ running: false, ratio: 0, error: null, log: [] });
  const [output, setOutput] = useState<JobOutput | null>(null);
  useEffect(() => () => output?.files.forEach((f) => URL.revokeObjectURL(f.url)), [output]);

  const run = async (spec: JobSpec) => {
    setJob({ running: true, ratio: 0, error: null, log: [] });
    try {
      const r = await runFFmpeg(spec.args, spec.inputs, {
        outputs: spec.outputs,
        outputPrefix: spec.outputPrefix,
        onProgress: (ratio, secs) => setJob((j) => ({ ...j, ratio: Math.min(0.99, spec.seconds ? secs / spec.seconds : ratio) })),
      });
      if (r.code !== 0 || !r.files.length) return setJob({ running: false, ratio: 0, error: errorFromLog(r.log), log: r.log });
      const files = r.files.map((f, i) => {
        const blob = new Blob([f.data as BlobPart], { type: mimeOf(f.name) });
        return { blob, url: URL.createObjectURL(blob), name: spec.name(i) };
      });
      for (const f of files) await saveToLibrary(f.blob, f.name, spec.tool).catch(() => {});
      setOutput({ files, key: spec.key });
      setJob({ running: false, ratio: 0, error: null, log: [] });
    } catch (e: any) {
      setJob({ running: false, ratio: 0, error: e instanceof Cancelled ? null : `The engine stopped: ${e?.message || e}. Try again.`, log: [] });
    }
  };
  return { job, output, run, clear: () => setOutput(null) };
}

// ================================================================ library

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  useEffect(() => {
    const load = () => listLibrary().then(setItems, () => setItems([]));
    load();
    return onLibraryChange(load);
  }, []);
  return items;
}

// ================================================================ waveform

const WAVE_KEY = "audio-editor:waveform";
const waveListeners = new Set<(on: boolean) => void>();

/** Show or hide waveforms (hidden saves work on slow devices). Remembered, and shared by every tool. */
export function useWaveformVisible(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(WAVE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    waveListeners.add(setOn);
    return () => void waveListeners.delete(setOn);
  }, []);
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(WAVE_KEY, v ? "on" : "off");
    } catch {
      /* private mode */
    }
    waveListeners.forEach((l) => l(v));
  }, []);
  return [on, set];
}

/**
 * The result's waveform: the edit rendered offline, `delay` ms after the settings stop
 * changing. Keeps the last one while the next is worked out; does nothing while `enabled` is off.
 */
export function useEditedWaveform(buffer: AudioBuffer | null, params: FxParams, enabled: boolean, delay = 300) {
  const [rendered, setRendered] = useState<{ buffer: AudioBuffer; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!buffer || !enabled) return;
    if (rendered?.key === key) {
      setBusy(false);
      return;
    }
    const me = ++run.current;
    setBusy(true);
    const t = window.setTimeout(() => {
      renderForWaveform(buffer, params)
        .then((b) => me === run.current && setRendered({ buffer: b, key }))
        .catch((e) => console.warn("[audio editor] couldn't draw the result waveform", e))
        .finally(() => me === run.current && setBusy(false));
    }, delay);
    return () => window.clearTimeout(t);
  }, [buffer, key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  // a new sound: forget the old drawing
  useEffect(() => setRendered(null), [buffer]);
  return { edited: enabled ? rendered?.buffer ?? null : null, busy: enabled && busy };
}
