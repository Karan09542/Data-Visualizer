/**
 * Audio Editor: formats, reading what ffmpeg says about a file, and turning settings into
 * ffmpeg commands. No browser APIs here, so all of it is unit-tested.
 */

// ================================================================ formats

export type Format = "mp3" | "m4a" | "ogg" | "opus" | "flac" | "wav";

export interface FormatInfo {
  id: Format;
  label: string;
  ext: string;
  mime: string;
  hint: string;
  bitrates?: number[];
  defaultBitrate?: number;
  /** Sample rates the encoder takes (others are converted to the nearest). */
  rates?: number[];
  maxChannels?: number;
}

export const FORMATS: FormatInfo[] = [
  { id: "mp3", label: "MP3", ext: "mp3", mime: "audio/mpeg", hint: "Plays everywhere", bitrates: [64, 96, 128, 160, 192, 256, 320], defaultBitrate: 192 },
  { id: "m4a", label: "M4A", ext: "m4a", mime: "audio/mp4", hint: "AAC · Apple, phones", bitrates: [64, 96, 128, 160, 192, 256], defaultBitrate: 160 },
  { id: "ogg", label: "OGG", ext: "ogg", mime: "audio/ogg", hint: "Vorbis · open", bitrates: [64, 96, 128, 160, 192, 256, 320], defaultBitrate: 160 },
  { id: "opus", label: "Opus", ext: "opus", mime: "audio/ogg; codecs=opus", hint: "Smallest for voice", bitrates: [16, 24, 32, 48, 64, 96, 128, 160], defaultBitrate: 96, rates: [48000], maxChannels: 2 },
  { id: "flac", label: "FLAC", ext: "flac", mime: "audio/flac", hint: "Lossless · compressed" },
  { id: "wav", label: "WAV", ext: "wav", mime: "audio/wav", hint: "Lossless · for editing" },
];
export const formatInfo = (id: Format) => FORMATS.find((f) => f.id === id)!;

export interface OutputSettings {
  format: Format;
  /** kbps, lossy formats */
  bitrate: number;
  wavBits: 16 | 24;
  /** Hz; 0 = keep */
  sampleRate: number;
  /** 1 or 2; 0 = keep */
  channels: number;
  title: string;
  artist: string;
  album: string;
}

export const DEFAULT_OUTPUT: OutputSettings = { format: "mp3", bitrate: 192, wavBits: 16, sampleRate: 0, channels: 0, title: "", artist: "", album: "" };

/** Encoder, bitrate, rate and channel options for the output. */
export function codecArgs(o: OutputSettings, src: { rate: number | null; channels: number | null }, needRate = false): string[] {
  const f = formatInfo(o.format);
  const a: string[] = [];
  switch (o.format) {
    case "mp3":
      a.push("-c:a", "libmp3lame", "-b:a", `${o.bitrate}k`);
      break;
    case "m4a":
      a.push("-c:a", "aac", "-b:a", `${o.bitrate}k`, "-movflags", "+faststart");
      break;
    case "ogg":
      a.push("-c:a", "libvorbis", "-b:a", `${o.bitrate}k`);
      break;
    case "opus":
      // ffmpeg's own encoder: libopus crashes inside ffmpeg.wasm 0.12
      a.push("-c:a", "opus", "-strict", "-2", "-b:a", `${o.bitrate}k`);
      break;
    case "flac":
      a.push("-c:a", "flac", "-compression_level", "8");
      break;
    case "wav":
      a.push("-c:a", o.wavBits === 24 ? "pcm_s24le" : "pcm_s16le");
      break;
  }
  let rate = o.sampleRate || (needRate || f.rates ? src.rate || 48000 : 0);
  if (rate && f.rates && !f.rates.includes(rate)) rate = f.rates.reduce((b, r) => (Math.abs(r - rate) < Math.abs(b - rate) ? r : b));
  if (rate) a.push("-ar", String(rate));
  const ch = o.channels || (f.maxChannels && src.channels && src.channels > f.maxChannels ? f.maxChannels : 0);
  if (ch) a.push("-ac", String(ch));
  return a;
}

export const metadataArgs = (o: Pick<OutputSettings, "title" | "artist" | "album">) =>
  (["title", "artist", "album"] as const).flatMap((k) => (o[k].trim() ? ["-metadata", `${k}=${o[k].trim()}`] : []));

// ================================================================ reading a file

export interface ProbeInfo {
  duration: number | null;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  /** kbps of the whole file */
  bitrate: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  /** An embedded cover picture (album art) */
  hasCover: boolean;
  /** Its format as stored, e.g. "mjpeg", "png" */
  coverCodec: string | null;
  tags: Record<string, string>;
}

/** Reads `ffmpeg -i file`'s description of the input. */
export function parseProbe(log: string): ProbeInfo {
  const p: ProbeInfo = { duration: null, sampleRate: null, channels: null, codec: null, bitrate: null, hasAudio: false, hasVideo: false, hasCover: false, coverCodec: null, tags: {} };
  const d = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log);
  if (d) p.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];
  const br = /Duration:[^\n]*bitrate:\s*(\d+)\s*kb\/s/.exec(log);
  if (br) p.bitrate = +br[1];
  const a = /Stream #\d+:\d+[^:]*: Audio:\s*([^,\s(]+)[^\n]*/.exec(log);
  if (a) {
    p.hasAudio = true;
    p.codec = a[1];
    const hz = /(\d+)\s*Hz/.exec(a[0]);
    if (hz) p.sampleRate = +hz[1];
    const layout = /Hz,\s*([^,]+)/.exec(a[0])?.[1].trim();
    if (layout) {
      const named: Record<string, number> = { mono: 1, stereo: 2, "2.1": 3, quad: 4, "4.0": 4, "5.0": 5, "5.1": 6, "5.1(side)": 6, "6.1": 7, "7.1": 8 };
      p.channels = named[layout] ?? (/(\d+)\s*channels/.exec(layout) ? +/(\d+)\s*channels/.exec(layout)![1] : null);
    }
  }
  // Look at each stream's block: ffmpeg may print " (attached pic)" on its own line
  const videos = log.split(/(?=Stream #\d+:\d+)/).filter((b) => /^Stream #\d+:\d+[^:\n]*: Video:/.test(b));
  const coverBlock = videos.find((b) => /\(attached pic\)/.test(b.split(/\n\s*(?:Stream #|Metadata:|At least one)/)[0]));
  p.hasCover = !!coverBlock;
  p.coverCodec = coverBlock ? /Video:\s*([^,\s(]+)/.exec(coverBlock)?.[1] ?? null : null;
  p.hasVideo = videos.some((b) => !/\(attached pic\)/.test(b.split(/\n\s*(?:Stream #|Metadata:|At least one)/)[0]));
  const meta = /Input #0[\s\S]*?Metadata:\n([\s\S]*?)\n\s*Duration:/.exec(log);
  for (const line of meta?.[1].split("\n") ?? []) {
    const m = /^\s*(\w+)\s*:\s?(.*)$/.exec(line);
    if (m && m[2].trim()) p.tags[m[1].toLowerCase()] = m[2].trim();
  }
  return p;
}

// ================================================================ effects

export type Stereo = "keep" | "mono" | "swap" | "left" | "right" | "wide" | "8d";
export type Loudness = -14 | -16 | -23;

/** Every effect a tool can set; each tool shows a few of them. */
export interface FxParams {
  /** Seconds; end null = to the end */
  trimStart: number;
  trimEnd: number | null;
  /** dB */
  volume: number;
  normalize: boolean;
  loudness: Loudness;
  fadeIn: number;
  fadeOut: number;
  /** 0.5–2, pitch kept */
  speed: number;
  /** semitones, length kept */
  pitch: number;
  reverse: boolean;
  /** ms; echo is on when echoDecay > 0 */
  echoDelay: number;
  echoDecay: number;
  /** dB per EQ_BANDS */
  eq: number[];
  /** dB, shelf around 100 Hz / 3 kHz */
  bass: number;
  treble: number;
  /** Hz; 0 = off */
  highpass: number;
  lowpass: number;
  /** 0–100 */
  denoise: number;
  compressor: boolean;
  removeSilence: boolean;
  /** dB below which counts as silence */
  silenceDb: number;
  /** Hz; 0 = off */
  tremolo: number;
  /** 0–1 */
  tremoloDepth: number;
  stereo: Stereo;
  /** Hz: turns per second for 8D */
  orbit: number;
}

export const EQ_BANDS = [
  { f: 60, label: "Sub" },
  { f: 230, label: "Bass" },
  { f: 910, label: "Mid" },
  { f: 3600, label: "Presence" },
  { f: 14000, label: "Air" },
];

export const NEUTRAL: FxParams = {
  trimStart: 0,
  trimEnd: null,
  volume: 0,
  normalize: false,
  loudness: -16,
  fadeIn: 0,
  fadeOut: 0,
  speed: 1,
  pitch: 0,
  reverse: false,
  echoDelay: 180,
  echoDecay: 0,
  eq: [0, 0, 0, 0, 0],
  bass: 0,
  treble: 0,
  highpass: 0,
  lowpass: 0,
  denoise: 0,
  compressor: false,
  removeSilence: false,
  silenceDb: -45,
  tremolo: 0,
  tremoloDepth: 0.5,
  stereo: "keep",
  orbit: 0.12,
};

/** Short numbers for filter strings: 1.5, 0.25, 12 */
const n = (v: number, d = 4) => String(Number(v.toFixed(d)));

/** atempo is best between 0.5 and 2 per step; bigger changes are split into steps. */
export function atempoChain(factor: number): string[] {
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-6) return [];
  const out: string[] = [];
  let f = factor;
  while (f > 2) out.push("atempo=2"), (f /= 2);
  while (f < 0.5) out.push("atempo=0.5"), (f /= 0.5);
  if (Math.abs(f - 1) > 1e-6) out.push(`atempo=${n(f)}`);
  return out;
}

/** The length of the result (before silence removal, which can't be known ahead). */
export function resultLength(p: FxParams, source: number | null): number | null {
  if (source == null) return null;
  const end = p.trimEnd == null ? source : Math.min(p.trimEnd, source);
  return Math.max(0, end - Math.max(0, p.trimStart)) / (p.speed || 1);
}

const STEREO_FILTERS: Record<Exclude<Stereo, "keep" | "wide" | "8d">, string> = {
  mono: "pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1",
  swap: "pan=stereo|c0=c1|c1=c0",
  left: "pan=stereo|c0=c0|c1=c0",
  right: "pan=stereo|c0=c1|c1=c1",
};

/** The effect chain, in a sensible order. Empty = nothing to change. */
export function fxFilters(p: FxParams, src: { duration: number | null; sampleRate: number | null }): string[] {
  const f: string[] = [];
  const end = p.trimEnd == null ? src.duration : Math.min(p.trimEnd, src.duration ?? p.trimEnd);
  if (p.trimStart > 0 || (p.trimEnd != null && (src.duration == null || p.trimEnd < src.duration))) {
    f.push(`atrim=start=${n(Math.max(0, p.trimStart))}${p.trimEnd != null ? `:end=${n(p.trimEnd)}` : ""}`, "asetpts=PTS-STARTPTS");
  }
  if (p.reverse) f.push("areverse");
  const piece = end != null ? Math.max(0, end - Math.max(0, p.trimStart)) : null;
  if (p.fadeIn > 0) f.push(`afade=t=in:st=0:d=${n(p.fadeIn)}`);
  if (p.fadeOut > 0 && piece != null) f.push(`afade=t=out:st=${n(Math.max(0, piece - p.fadeOut))}:d=${n(Math.min(p.fadeOut, piece))}`);

  if (p.highpass > 0) f.push(`highpass=f=${Math.round(p.highpass)}`);
  if (p.lowpass > 0) f.push(`lowpass=f=${Math.round(p.lowpass)}`);
  if (p.denoise > 0) f.push(`afftdn=nr=${n(6 + (Math.min(100, p.denoise) / 100) * 40, 1)}:nf=-25`);
  if (p.bass) f.push(`bass=g=${n(p.bass, 1)}`);
  if (p.treble) f.push(`treble=g=${n(p.treble, 1)}`);
  p.eq.forEach((g, i) => g && EQ_BANDS[i] && f.push(`equalizer=f=${EQ_BANDS[i].f}:t=q:w=1:g=${n(g, 1)}`));
  if (p.removeSilence) {
    const t = `${Math.round(p.silenceDb)}dB`;
    f.push(`silenceremove=start_periods=1:start_threshold=${t}:start_silence=0.2:stop_periods=-1:stop_threshold=${t}:stop_duration=0.6:stop_silence=0.3`);
  }
  if (p.pitch) {
    const rate = src.sampleRate || 44100;
    const k = Math.pow(2, p.pitch / 12);
    f.push(`asetrate=${Math.round(rate * k)}`, `aresample=${rate}`, ...atempoChain(1 / k));
  }
  f.push(...atempoChain(p.speed));
  if (p.tremolo > 0) f.push(`tremolo=f=${n(p.tremolo, 2)}:d=${n(Math.max(0.01, Math.min(1, p.tremoloDepth)), 2)}`);
  if (p.stereo !== "keep") {
    f.push("aformat=channel_layouts=stereo");
    if (p.stereo === "wide") f.push("extrastereo=m=2.5");
    else if (p.stereo === "8d") f.push(`apulsator=hz=${n(p.orbit, 3)}:width=1`);
    else f.push(STEREO_FILTERS[p.stereo]);
  }
  if (p.echoDecay > 0) {
    const d = Math.max(10, Math.round(p.echoDelay));
    const k = Math.min(0.9, p.echoDecay);
    f.push(`aecho=0.8:0.88:${d}|${d * 2}:${n(k, 2)}|${n(k * 0.55, 2)}`);
  }
  if (p.volume) f.push(`volume=${n(p.volume, 1)}dB`);
  if (p.compressor) f.push("acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=2");
  if (p.normalize) f.push(`loudnorm=I=${p.loudness}:TP=-1.5:LRA=11`);
  return f;
}

/** One file through the effects. */
export function editArgs(input: string, output: string, p: FxParams, o: OutputSettings, info: ProbeInfo): string[] {
  const f = fxFilters(p, info);
  return [
    "-hide_banner",
    "-i",
    input,
    "-map",
    "0:a:0",
    "-vn",
    ...(f.length ? ["-af", f.join(",")] : []),
    ...codecArgs(o, { rate: info.sampleRate, channels: info.channels }, p.normalize),
    ...metadataArgs(o),
    "-y",
    output,
  ];
}

// ================================================================ merge

export interface MergeSettings {
  /** Seconds of overlap; 0 = one after another */
  crossfade: number;
  /** Seconds of silence between (without crossfade) */
  gap: number;
  normalize: boolean;
  loudness: Loudness;
}
export const DEFAULT_MERGE: MergeSettings = { crossfade: 0, gap: 0, normalize: false, loudness: -16 };

const COMMON = (rate: number, layout: string) => `aresample=${rate},aformat=sample_fmts=fltp:channel_layouts=${layout}`;

export function mergeArgs(inputs: string[], output: string, m: MergeSettings, o: OutputSettings): string[] {
  const rate = o.sampleRate || 48000;
  const parts = inputs.map((_, i) => `[${i}:a:0]${COMMON(rate, o.channels === 1 ? "mono" : "stereo")}[a${i}]`);
  let last = "a0";
  if (inputs.length > 1 && m.crossfade > 0) {
    for (let i = 1; i < inputs.length; i++) {
      const out = i === inputs.length - 1 ? "j" : `x${i}`;
      parts.push(`[${last}][a${i}]acrossfade=d=${n(m.crossfade)}:c1=tri:c2=tri[${out}]`);
      last = out;
    }
  } else if (inputs.length > 1) {
    const labels = inputs.map((_, i) => {
      if (m.gap > 0 && i < inputs.length - 1) {
        parts.push(`[a${i}]apad=pad_dur=${n(m.gap)}[p${i}]`);
        return `[p${i}]`;
      }
      return `[a${i}]`;
    });
    parts.push(`${labels.join("")}concat=n=${inputs.length}:v=0:a=1[j]`);
    last = "j";
  }
  if (m.normalize) parts.push(`[${last}]loudnorm=I=${m.loudness}:TP=-1.5:LRA=11[out]`), (last = "out");
  return [
    "-hide_banner",
    ...inputs.flatMap((i) => ["-i", i]),
    "-filter_complex",
    parts.join(";"),
    "-map",
    `[${last}]`,
    ...codecArgs({ ...o, sampleRate: rate }, { rate, channels: 2 }),
    ...metadataArgs(o),
    "-y",
    output,
  ];
}

export const mergeLength = (lengths: number[], m: MergeSettings) =>
  lengths.reduce((a, b) => a + b, 0) + Math.max(0, lengths.length - 1) * (m.crossfade > 0 ? -m.crossfade : m.gap);

// ================================================================ mix (voice + music)

export interface MixSettings {
  /** dB */
  voiceVolume: number;
  musicVolume: number;
  /** seconds before the music starts */
  musicDelay: number;
  loopMusic: boolean;
  /** music dips while the voice plays */
  duck: boolean;
  /** 2–20 */
  duckAmount: number;
  /** seconds */
  musicFadeOut: number;
  length: "voice" | "longest";
  normalize: boolean;
  loudness: Loudness;
}
export const DEFAULT_MIX: MixSettings = { voiceVolume: 0, musicVolume: -12, musicDelay: 0, loopMusic: true, duck: true, duckAmount: 8, musicFadeOut: 3, length: "voice", normalize: false, loudness: -16 };

export function mixLength(m: MixSettings, voice: number | null, music: number | null): number | null {
  if (voice == null) return null;
  return m.length === "voice" || m.loopMusic || music == null ? voice : Math.max(voice, music + m.musicDelay);
}

export function mixArgs(voice: string, music: string, output: string, m: MixSettings, o: OutputSettings, voiceLen: number | null, musicLen: number | null): string[] {
  const c = COMMON(48000, "stereo");
  const parts = [`[0:a:0]${c},volume=${n(m.voiceVolume, 1)}dB${m.duck ? ",asplit=2[v][key]" : "[v]"}`];
  const total = mixLength(m, voiceLen, musicLen);
  const music_ = [c, `volume=${n(m.musicVolume, 1)}dB`];
  if (m.musicDelay > 0) music_.push(`adelay=${Math.round(m.musicDelay * 1000)}:all=1`);
  if (m.musicFadeOut > 0 && total != null && total > m.musicFadeOut) music_.push(`afade=t=out:st=${n(total - m.musicFadeOut)}:d=${n(m.musicFadeOut)}`);
  parts.push(`[1:a:0]${music_.join(",")}[m]`);
  let bed = "m";
  if (m.duck) parts.push(`[m][key]sidechaincompress=threshold=0.02:ratio=${n(Math.max(1, Math.min(20, m.duckAmount)), 1)}:attack=20:release=400[md]`), (bed = "md");
  parts.push(`[v][${bed}]amix=inputs=2:duration=${m.length === "voice" || m.loopMusic ? "first" : "longest"}:dropout_transition=0:normalize=0[mix]`);
  let last = "mix";
  if (m.normalize) parts.push(`[mix]loudnorm=I=${m.loudness}:TP=-1.5:LRA=11[out]`), (last = "out");
  return [
    "-hide_banner",
    "-i",
    voice,
    ...(m.loopMusic ? ["-stream_loop", "-1"] : []),
    "-i",
    music,
    "-filter_complex",
    parts.join(";"),
    "-map",
    `[${last}]`,
    ...(total != null ? ["-t", n(total, 3)] : []),
    ...codecArgs({ ...o, sampleRate: o.sampleRate || 48000 }, { rate: 48000, channels: 2 }),
    ...metadataArgs(o),
    "-y",
    output,
  ];
}

// ================================================================ split

/** "silence_start: 12.3" … "silence_end: 14.1 | silence_duration: 1.8" → pauses */
export function parseSilences(log: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (const line of log.split("\n")) {
    const a = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (a) open = Math.max(0, +a[1]);
    const b = /silence_end:\s*([\d.]+)/.exec(line);
    if (b && open != null) out.push({ start: open, end: +b[1] }), (open = null);
  }
  return out;
}

/** Cut in the middle of pauses, keeping every part at least `minPart` long. */
export function cutsAtPauses(pauses: { start: number; end: number }[], duration: number, minPart = 1): number[] {
  const cuts: number[] = [];
  let last = 0;
  for (const p of pauses) {
    const mid = (p.start + p.end) / 2;
    if (p.start <= 0.05 || p.end >= duration - 0.05) continue;
    if (mid - last >= minPart && duration - mid >= minPart) cuts.push(+mid.toFixed(3)), (last = mid);
  }
  return cuts;
}

export const evenCuts = (duration: number, parts: number) => Array.from({ length: Math.max(0, Math.floor(parts) - 1) }, (_, i) => +(((i + 1) * duration) / parts).toFixed(3));

export function everyCuts(duration: number, seconds: number) {
  const cuts: number[] = [];
  for (let t = seconds; t < duration - 0.05 && cuts.length < 999; t += seconds) cuts.push(+t.toFixed(3));
  return cuts;
}

export const silenceDetectArgs = (input: string, db: number, minPause: number) => ["-hide_banner", "-i", input, "-map", "0:a:0", "-af", `silencedetect=noise=${Math.round(db)}dB:d=${n(minPause, 2)}`, "-f", "null", "-"];

const SEGMENT_FORMAT: Record<Format, string> = { mp3: "mp3", m4a: "ipod", ogg: "ogg", opus: "opus", flac: "flac", wav: "wav" };

/** Cuts one file at the given times into prefix000.ext, prefix001.ext… */
export function splitArgs(input: string, prefix: string, cuts: number[], o: OutputSettings, info: ProbeInfo): string[] {
  return [
    "-hide_banner",
    "-i",
    input,
    "-map",
    "0:a:0",
    "-vn",
    ...codecArgs(o, { rate: info.sampleRate, channels: info.channels }),
    "-f",
    "segment",
    "-segment_format",
    SEGMENT_FORMAT[o.format],
    ...(cuts.length ? ["-segment_times", cuts.join(",")] : ["-segment_time", "86400"]),
    "-reset_timestamps",
    "1",
    `${prefix}%03d.${formatInfo(o.format).ext}`,
  ];
}

// ================================================================ audio → video

export type Visual = "waves" | "bars" | "spectrum" | "none";
export interface VideoSettings {
  visual: Visual;
  size: "1280x720" | "1920x1080" | "1080x1080" | "1080x1920";
  /** hex, no # */
  color: string;
  background: string;
  fps: number;
}
export const DEFAULT_VIDEO: VideoSettings = { visual: "waves", size: "1280x720", color: "ffffff", background: "0a0a0a", fps: 25 };

const hex = (c: string) => c.replace(/^#/, "").slice(0, 6).padEnd(6, "0");

/** An MP4 of the sound over a picture and/or a moving visual. */
export function videoArgs(audio: string, image: string | null, output: string, v: VideoSettings): string[] {
  const [W, H] = v.size.split("x").map(Number);
  const fps = Math.max(1, Math.min(30, Math.round(v.fps)));
  const visual: Visual = !image && v.visual === "none" ? "waves" : v.visual;
  const a = image ? 1 : 0;
  const still = visual === "none";
  const parts = [
    image
      ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x${hex(v.background)},setsar=1,fps=${still ? 1 : fps}[bg]`
      : `color=c=0x${hex(v.background)}:s=${W}x${H}:r=${fps}[bg]`,
  ];
  const vh = Math.round(H / 6) * 2;
  const y = image ? H - vh - Math.round(H * 0.06) : Math.round((H - vh) / 2);
  let last = "bg";
  if (visual === "waves") {
    parts.push(`[${a}:a:0]showwaves=s=${W}x${vh}:mode=cline:rate=${fps}:colors=0x${hex(v.color)},format=rgba[viz]`, `[bg][viz]overlay=0:${y}:shortest=1[v0]`);
    last = "v0";
  } else if (visual === "bars") {
    parts.push(
      `[${a}:a:0]showfreqs=s=${W}x${vh}:mode=bar:ascale=log:fscale=log:win_size=2048:colors=0x${hex(v.color)},fps=${fps},format=rgba,colorkey=0x000000:0.1:0[viz]`,
      `[bg][viz]overlay=0:${y}:shortest=1[v0]`,
    );
    last = "v0";
  } else if (visual === "spectrum") {
    parts.push(`[${a}:a:0]showspectrum=s=${W}x${H}:slide=scroll:mode=combined:color=intensity:scale=log,fps=${fps}[v0]`);
    last = "v0";
  }
  parts.push(`[${last}]format=yuv420p[v]`);
  return [
    "-hide_banner",
    ...(image ? ["-loop", "1", "-framerate", String(still ? 1 : fps), "-i", image] : []),
    "-i",
    audio,
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[v]",
    "-map",
    `${a}:a:0`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "26",
    ...(still ? ["-tune", "stillimage"] : []),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    "-y",
    output,
  ];
}

// ================================================================ inspect

export interface LoudnessReport {
  integrated: number | null;
  range: number | null;
  truePeak: number | null;
  meanVolume: number | null;
  maxVolume: number | null;
}

/** Loudness (EBU R128) and volume, as a summary in the log. */
export const inspectArgs = (input: string) => ["-hide_banner", "-i", input, "-map", "0:a:0", "-af", "ebur128=peak=true:framelog=verbose,volumedetect", "-f", "null", "-"];

/**
 * Takes the embedded cover picture out (no audio is decoded, so it's quick). JPEG and PNG
 * covers are copied exactly as stored; anything else becomes a PNG. `-update 1` writes one
 * image properly (without it ffmpeg aborts at the end, which can break the next command).
 */
export function coverArgs(input: string, codec: string | null): { args: string[]; output: string; mime: string } {
  const ext = codec === "mjpeg" ? "jpg" : "png";
  const copy = codec === "mjpeg" || codec === "png";
  const output = `cover.${ext}`;
  return {
    args: ["-hide_banner", "-i", input, "-an", "-map", "0:v:0", "-frames:v", "1", "-update", "1", "-c:v", copy ? "copy" : "png", "-y", output],
    output,
    mime: ext === "jpg" ? "image/jpeg" : "image/png",
  };
}

export function parseLoudness(log: string): LoudnessReport {
  const sum = log.slice(Math.max(0, log.lastIndexOf("Summary:")));
  const num = (text: string, re: RegExp) => (re.exec(text) ? +re.exec(text)![1] : null);
  return {
    integrated: num(sum, /I:\s*(-?[\d.]+)\s*LUFS/),
    range: num(sum, /LRA:\s*(-?[\d.]+)\s*LU\b/),
    truePeak: num(sum, /Peak:\s*(-?[\d.]+)\s*dBFS/),
    meanVolume: num(log, /mean_volume:\s*(-?[\d.]+)\s*dB/),
    maxVolume: num(log, /max_volume:\s*(-?[\d.]+)\s*dB/),
  };
}

// ================================================================ helpers

/** A command as one line for a terminal. */
export const formatCommand = (args: string[]) => ["ffmpeg", ...args.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `"${a.replace(/(["\\$`])/g, "\\$1")}"`))].join(" ");

/** "song.wav" + "mp3" + " (fast)" → "song (fast).mp3" */
export function outputName(name: string, ext: string, suffix = "") {
  const dot = name.lastIndexOf(".");
  return `${(dot > 0 ? name.slice(0, dot) : name).trim() || "audio"}${suffix}.${ext}`;
}

/** 205.47 → "3:25.5" */
export function formatTime(sec: number, decimals = 1) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const ss = (sec - m * 60).toFixed(decimals).padStart(decimals ? 3 + decimals : 2, "0");
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Rough size of the result, for lossy formats and WAV. */
export function estimateBytes(o: OutputSettings, seconds: number | null, rate: number | null, channels: number | null) {
  if (seconds == null || o.format === "flac") return null;
  if (o.format === "wav") return Math.round(44 + seconds * (o.sampleRate || rate || 44100) * (o.channels || channels || 2) * (o.wavBits / 8));
  return Math.round((o.bitrate * 1000 * seconds) / 8);
}
