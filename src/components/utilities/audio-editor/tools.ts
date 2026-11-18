/**
 * The Audio Editor's tools. Effect tools are described here (their controls and starting
 * values) and drawn by one screen, FxTool; the others have screens of their own.
 */
import type React from "react";
import {
  Scissors,
  Combine,
  Split,
  Layers,
  Gauge,
  Piano,
  Waves,
  SlidersVertical,
  Undo2,
  Video,
  Clapperboard,
  Volume2,
  Blend,
  MicVocal,
  Activity,
  Speaker,
  Orbit,
  Drama,
  Eraser,
  FileAudio,
  Headphones,
  BoomBox,
  ScanSearch,
} from "lucide-react";
import { EQ_BANDS, NEUTRAL, type FxParams, type Format } from "./commands";
import type { Hue } from "./palette";

type NumKey = { [K in keyof FxParams]: FxParams[K] extends number ? K : never }[keyof FxParams];
type BoolKey = { [K in keyof FxParams]: FxParams[K] extends boolean ? K : never }[keyof FxParams];

export type Control = { when?: (p: FxParams) => boolean } & (
  | { type: "slider"; key: NumKey; label: string; min: number; max: number; step: number; format: (v: number) => string; ends?: [string, string]; marks?: { value: number; label: string }[]; badge?: string }
  | { type: "toggle"; key: BoolKey; label: string; hint?: string; badge?: string }
  | { type: "presets"; label?: string; options: { label: string; set: Partial<FxParams> }[] }
  | { type: "choice"; key: "stereo" | "loudness"; label: string; options: { label: string; value: string | number }[] }
  | { type: "eq" }
);

export type ToolId =
  | "trim" | "merge" | "split"
  | "mix" | "speed" | "pitch" | "echo" | "eq" | "reverse" | "toVideo" | "toMp3"
  | "volume" | "fade" | "denoise" | "loudness" | "bass" | "8d" | "voice" | "silence"
  | "convert" | "channels" | "ringtone" | "inspect";

export interface Tool {
  id: ToolId;
  label: string;
  /** One line under the title */
  about: string;
  icon: React.ElementType;
  /** Effect tools: the controls to show */
  controls?: Control[];
  /** Effect tools: the values to start with */
  start?: Partial<FxParams>;
  /** Handles on the waveform to keep a part */
  trim?: boolean;
  format?: Format;
  videoOnly?: boolean;
  /** Added to the result's name */
  suffix?: string;
  /** Its own colour (tile icon, and accents inside the tool) */
  color?: Hue;
}

/** Each tool's colour: light, distinct within its group. */
const COLORS: Record<ToolId, Hue> = {
  trim: "sky",
  merge: "indigo",
  split: "orange",
  mix: "teal",
  speed: "amber",
  pitch: "pink",
  echo: "cyan",
  eq: "violet",
  reverse: "rose",
  toVideo: "red",
  toMp3: "lime",
  volume: "blue",
  fade: "fuchsia",
  denoise: "emerald",
  loudness: "green",
  bass: "orange",
  "8d": "purple",
  voice: "pink",
  silence: "sky",
  convert: "blue",
  channels: "cyan",
  ringtone: "rose",
  inspect: "indigo",
};

const dB = (v: number) => (v === 0 ? "0 dB" : `${v > 0 ? "+" : ""}${v} dB`);
const sec = (v: number) => (v ? `${v.toFixed(1)} s` : "Off");
const LOUDNESS: Control = {
  type: "choice",
  key: "loudness",
  label: "Target",
  when: (p) => p.normalize,
  options: [
    { label: "Podcast · −16 LUFS", value: -16 },
    { label: "Music apps · −14", value: -14 },
    { label: "Broadcast · −23", value: -23 },
  ],
};
const FADES: Control[] = [
  { type: "slider", key: "fadeIn", label: "Fade in", min: 0, max: 10, step: 0.1, format: sec },
  { type: "slider", key: "fadeOut", label: "Fade out", min: 0, max: 10, step: 0.1, format: sec },
];

export const TOOLS: Tool[] = [
  // ------------------------------------------------ mixing
  { id: "trim", label: "Trim Audio", about: "Keep just the part you want", icon: Scissors, trim: true, controls: FADES, suffix: " (trimmed)" },
  { id: "merge", label: "Merge Audio", about: "Join files one after another", icon: Combine },
  { id: "split", label: "Split Audio", about: "Cut into parts by time or at pauses", icon: Split },

  // ------------------------------------------------ processing
  { id: "mix", label: "Mix", about: "Music under a voice, with auto-ducking", icon: Layers },
  {
    id: "speed",
    label: "Speed",
    about: "Faster or slower, same pitch",
    icon: Gauge,
    start: { speed: 1.25 },
    suffix: " (speed)",
    controls: [
      { type: "presets", options: [0.5, 0.75, 1.25, 1.5, 2].map((v) => ({ label: `${v}×`, set: { speed: v } })) },
      { type: "slider", key: "speed", label: "Speed", min: 0.5, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×`, ends: ["Slower", "Faster"] },
    ],
  },
  {
    id: "pitch",
    label: "Pitch",
    about: "Higher or lower, same length",
    icon: Piano,
    start: { pitch: 3 },
    suffix: " (pitch)",
    controls: [
      { type: "presets", options: [["−1 octave", -12], ["Deep", -5], ["Bright", 5], ["+1 octave", 12]].map(([label, v]) => ({ label: label as string, set: { pitch: v as number } })) },
      { type: "slider", key: "pitch", label: "Pitch", min: -12, max: 12, step: 1, format: (v) => (v ? `${v > 0 ? "+" : ""}${v} semitones` : "Original"), ends: ["Lower", "Higher"] },
    ],
  },
  {
    id: "echo",
    label: "Echo",
    about: "Room, hall or canyon echoes",
    icon: Waves,
    start: { echoDelay: 220, echoDecay: 0.45 },
    suffix: " (echo)",
    controls: [
      {
        type: "presets",
        options: [
          { label: "Room", set: { echoDelay: 40, echoDecay: 0.3 } },
          { label: "Slapback", set: { echoDelay: 120, echoDecay: 0.5 } },
          { label: "Hall", set: { echoDelay: 220, echoDecay: 0.45 } },
          { label: "Canyon", set: { echoDelay: 600, echoDecay: 0.5 } },
        ],
      },
      { type: "slider", key: "echoDelay", label: "Distance", min: 20, max: 1000, step: 10, format: (v) => `${v} ms`, ends: ["Close", "Far"] },
      { type: "slider", key: "echoDecay", label: "Strength", min: 0, max: 0.9, step: 0.05, format: (v) => (v ? `${Math.round(v * 100)}%` : "Off"), ends: ["Off", "Strong"] },
    ],
  },
  {
    id: "eq",
    label: "Equalizer",
    about: "Shape the sound across five bands",
    icon: SlidersVertical,
    suffix: " (eq)",
    controls: [
      {
        type: "presets",
        options: [
          ["Flat", [0, 0, 0, 0, 0]],
          ["Bass boost", [6, 4, 0, 0, 0]],
          ["Vocal", [-6, -2, 2, 4, 1]],
          ["Podcast", [-4, 1, 0, 3, 2]],
          ["Bright", [0, 0, 0, 3, 6]],
          ["Warm", [2, 3, 0, -2, -3]],
          ["Lo-fi", [-12, -4, 6, 0, -12]],
        ].map(([label, eq]) => ({ label: label as string, set: { eq: eq as number[] } })),
      },
      { type: "eq" },
    ],
  },
  { id: "reverse", label: "Reverse", about: "Play it backwards", icon: Undo2, start: { reverse: true }, suffix: " (reversed)", controls: [{ type: "toggle", key: "reverse", label: "Reverse", hint: "Plays from the end to the start" }] },
  { id: "toVideo", label: "Audio to MP4", about: "A video with a picture or moving waveform", icon: Video },
  { id: "toMp3", label: "Video to MP3", about: "Take the sound out of a video", icon: Clapperboard, format: "mp3", videoOnly: true, suffix: "" },

  // ------------------------------------------------ enhance & effects
  {
    id: "volume",
    label: "Volume",
    about: "Louder or quieter",
    icon: Volume2,
    start: { volume: 6 },
    suffix: " (volume)",
    controls: [
      { type: "presets", options: [-6, 3, 6, 10].map((v) => ({ label: dB(v), set: { volume: v } })) },
      { type: "slider", key: "volume", label: "Volume", min: -30, max: 20, step: 0.5, format: dB, ends: ["Quieter", "Louder"] },
      { type: "toggle", key: "compressor", label: "Limit peaks", hint: "Keeps loud moments from distorting" },
    ],
  },
  { id: "fade", label: "Fade", about: "Smooth starts and endings", icon: Blend, start: { fadeIn: 2, fadeOut: 3 }, suffix: " (fade)", controls: FADES },
  {
    id: "denoise",
    label: "Noise Reduce",
    about: "Less hiss, hum and room noise",
    icon: MicVocal,
    start: { denoise: 45, highpass: 80 },
    suffix: " (clean)",
    controls: [
      { type: "slider", key: "denoise", label: "Noise reduction", min: 0, max: 100, step: 5, format: (v) => (v ? `${v}%` : "Off"), ends: ["Off", "Strong"], badge: "on save" },
      { type: "slider", key: "highpass", label: "Cut rumble & hum below", min: 0, max: 400, step: 10, format: (v) => (v ? `${v} Hz` : "Off") },
      { type: "slider", key: "lowpass", label: "Cut hiss above", min: 0, max: 16000, step: 500, format: (v) => (v ? `${(v / 1000).toFixed(1)} kHz` : "Off") },
      { type: "toggle", key: "compressor", label: "Even out the voice", hint: "Quiet words louder, loud ones softer" },
    ],
  },
  {
    id: "loudness",
    label: "Normalize",
    about: "Standard loudness for podcasts & music",
    icon: Activity,
    start: { normalize: true },
    suffix: " (normalized)",
    controls: [{ type: "toggle", key: "normalize", label: "Even out loudness", hint: "EBU R128 — measured over the whole file", badge: "approx. live" }, LOUDNESS],
  },
  {
    id: "bass",
    label: "Bass Boost",
    about: "Deeper, fuller low end",
    icon: Speaker,
    start: { bass: 8 },
    suffix: " (bass)",
    controls: [
      { type: "presets", options: [["Light", 4], ["Strong", 8], ["Extreme", 14]].map(([label, v]) => ({ label: label as string, set: { bass: v as number } })) },
      { type: "slider", key: "bass", label: "Bass", min: -12, max: 20, step: 1, format: dB },
      { type: "slider", key: "treble", label: "Treble", min: -12, max: 12, step: 1, format: dB },
    ],
  },
  {
    id: "8d",
    label: "8D Audio",
    about: "Sound circling around your head",
    icon: Orbit,
    start: { stereo: "8d", orbit: 0.12, echoDelay: 90, echoDecay: 0.2 },
    suffix: " (8D)",
    controls: [
      { type: "slider", key: "orbit", label: "Circling speed", min: 0.03, max: 0.5, step: 0.01, format: (v) => `${(1 / v).toFixed(1)} s per turn`, ends: ["Slow", "Fast"] },
      { type: "slider", key: "echoDecay", label: "Room", min: 0, max: 0.6, step: 0.05, format: (v) => (v ? `${Math.round(v * 100)}%` : "Dry") },
    ],
  },
  {
    id: "voice",
    label: "Voice Changer",
    about: "Chipmunk, robot, phone, radio…",
    icon: Drama,
    start: { pitch: 7 },
    suffix: " (voice)",
    controls: [
      {
        type: "presets",
        label: "Voice",
        options: [
          { label: "Chipmunk", set: { ...NEUTRAL, pitch: 7 } },
          { label: "Deep", set: { ...NEUTRAL, pitch: -6, bass: 4 } },
          { label: "Robot", set: { ...NEUTRAL, pitch: -2, tremolo: 40, tremoloDepth: 0.9, echoDelay: 20, echoDecay: 0.3 } },
          { label: "Telephone", set: { ...NEUTRAL, highpass: 400, lowpass: 3400, compressor: true } },
          { label: "Old radio", set: { ...NEUTRAL, highpass: 250, lowpass: 5000, eq: [0, 0, 6, 2, 0], compressor: true } },
          { label: "Megaphone", set: { ...NEUTRAL, highpass: 600, lowpass: 3200, volume: 4, compressor: true } },
          { label: "Cave", set: { ...NEUTRAL, pitch: -2, echoDelay: 300, echoDecay: 0.5 } },
          { label: "Alien", set: { ...NEUTRAL, pitch: 4, tremolo: 8, tremoloDepth: 0.6 } },
        ],
      },
      { type: "slider", key: "pitch", label: "Fine-tune pitch", min: -12, max: 12, step: 1, format: (v) => `${v > 0 ? "+" : ""}${v} st` },
    ],
  },
  {
    id: "silence",
    label: "Silence Remover",
    about: "Cut out the pauses",
    icon: Eraser,
    start: { removeSilence: true },
    suffix: " (no pauses)",
    controls: [
      { type: "toggle", key: "removeSilence", label: "Remove pauses", hint: "Pauses over about half a second are cut", badge: "on save" },
      { type: "slider", key: "silenceDb", label: "Quiet below", min: -70, max: -20, step: 1, format: (v) => `${v} dB`, ends: ["Only silence", "Soft sounds too"] },
    ],
  },

  // ------------------------------------------------ convert & analyze
  { id: "convert", label: "Convert", about: "MP3, M4A, OGG, Opus, FLAC or WAV", icon: FileAudio, suffix: "" },
  {
    id: "channels",
    label: "Channels",
    about: "Mono, swap sides, wider stereo",
    icon: Headphones,
    start: { stereo: "mono" },
    suffix: " (channels)",
    controls: [
      {
        type: "choice",
        key: "stereo",
        label: "Channels",
        options: [
          { label: "Mono (both sides the same)", value: "mono" },
          { label: "Swap left and right", value: "swap" },
          { label: "Left only, on both sides", value: "left" },
          { label: "Right only, on both sides", value: "right" },
          { label: "Wider stereo", value: "wide" },
          { label: "Unchanged", value: "keep" },
        ],
      },
    ],
  },
  { id: "ringtone", label: "Ringtone", about: "A 30-second clip with soft fades", icon: BoomBox, trim: true, format: "m4a", start: { trimEnd: 30, fadeIn: 0.5, fadeOut: 2 }, suffix: " (ringtone)", controls: FADES },
  { id: "inspect", label: "Inspect", about: "Loudness, peaks and the cover picture", icon: ScanSearch },
];

export const GROUPS: { title: string; ids: ToolId[]; big?: boolean }[] = [
  { title: "Audio Mixing", ids: ["trim", "merge", "split"], big: true },
  { title: "Audio Processing", ids: ["mix", "speed", "pitch", "echo", "eq", "reverse", "toVideo", "toMp3"] },
  { title: "Enhance & Effects", ids: ["volume", "fade", "denoise", "loudness", "bass", "8d", "voice", "silence"] },
  { title: "Convert & Analyze", ids: ["convert", "channels", "ringtone", "inspect"] },
];

TOOLS.forEach((t) => (t.color = COLORS[t.id]));

export const tool = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
export const EQ_LABELS = EQ_BANDS;
