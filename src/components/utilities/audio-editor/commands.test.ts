import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseProbe,
  atempoChain,
  fxFilters,
  editArgs,
  codecArgs,
  resultLength,
  mergeArgs,
  mergeLength,
  mixArgs,
  mixLength,
  parseSilences,
  cutsAtPauses,
  evenCuts,
  everyCuts,
  splitArgs,
  videoArgs,
  parseLoudness,
  coverArgs,
  formatCommand,
  formatTime,
  outputName,
  estimateBytes,
  NEUTRAL,
  DEFAULT_OUTPUT,
  DEFAULT_MERGE,
  DEFAULT_MIX,
  DEFAULT_VIDEO,
  type ProbeInfo,
} from "./commands";

const info = (o: Partial<ProbeInfo> = {}): ProbeInfo => ({ duration: 60, sampleRate: 44100, channels: 2, codec: "mp3", bitrate: 192, hasAudio: true, hasVideo: false, hasCover: false, coverCodec: null, tags: {}, ...o });
const fc = (a: string[]) => a[a.indexOf("-filter_complex") + 1];

test("parseProbe: duration, stream, tags; cover art isn't video", () => {
  const p = parseProbe(`Input #0, mp3, from 'in.mp3':
  Metadata:
    title           : Morning Song
    artist          : The Band
  Duration: 00:03:25.47, start: 0.025057, bitrate: 320 kb/s
  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, stereo, fltp, 320 kb/s
  Stream #0:1: Video: mjpeg (Baseline), yuvj420p(pc), 500x500, 90k tbr, 90k tbn (attached pic)`);
  assert.ok(Math.abs(p.duration! - 205.47) < 1e-9);
  assert.deepEqual([p.sampleRate, p.channels, p.codec, p.bitrate, p.hasAudio, p.hasVideo, p.hasCover], [44100, 2, "mp3", 320, true, false, true]);
  assert.deepEqual(p.tags, { title: "Morning Song", artist: "The Band" });
  assert.equal(parseProbe("Stream #0:1[0x2](eng): Audio: ac3, 48000 Hz, 5.1(side), fltp").channels, 6);
  // " (attached pic)" printed on a line of its own still counts as a cover, not a video
  const split = parseProbe("  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 320 kb/s\n  Stream #0:1: Video: png, rgba(pc), 600x600, 90k tbr, 90k tbn\n (attached pic)\n    Metadata:\n      comment : Cover (front)");
  assert.deepEqual([split.hasCover, split.hasVideo, split.coverCodec], [true, false, "png"]);
  const film = parseProbe("  Stream #0:0: Video: h264, yuv420p, 640x360\n  Stream #0:1: Audio: aac, 48000 Hz, stereo");
  assert.deepEqual([film.hasCover, film.hasVideo], [false, true]);
  assert.equal(parseProbe("Stream #0:0: Audio: pcm_s16le, 22050 Hz, 4 channels, s16").channels, 4);
  const v = parseProbe("  Duration: 00:00:05.00, start: 0.0, bitrate: 900 kb/s\n  Stream #0:0: Video: h264, yuv420p, 640x360");
  assert.deepEqual([v.hasAudio, v.hasVideo, v.duration], [false, true, 5]);
});

test("atempo steps", () => {
  assert.deepEqual(atempoChain(1), []);
  assert.deepEqual(atempoChain(4), ["atempo=2", "atempo=2"]);
  assert.deepEqual(atempoChain(0.25), ["atempo=0.5", "atempo=0.5"]);
  assert.deepEqual(atempoChain(3), ["atempo=2", "atempo=1.5"]);
});

test("nothing set → plain conversion", () => {
  assert.deepEqual(fxFilters(NEUTRAL, info()), []);
  assert.deepEqual(editArgs("in.wav", "out.mp3", NEUTRAL, DEFAULT_OUTPUT, info()), ["-hide_banner", "-i", "in.wav", "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", "192k", "-y", "out.mp3"]);
});

test("trim and fades on the kept piece", () => {
  assert.deepEqual(fxFilters({ ...NEUTRAL, trimStart: 10, trimEnd: 40, fadeIn: 2, fadeOut: 3 }, info()), [
    "atrim=start=10:end=40",
    "asetpts=PTS-STARTPTS",
    "afade=t=in:st=0:d=2",
    "afade=t=out:st=27:d=3",
  ]);
  assert.deepEqual(fxFilters({ ...NEUTRAL, trimEnd: 60 }, info()), []);
  assert.equal(resultLength({ ...NEUTRAL, trimStart: 10, trimEnd: 40, speed: 2 }, 60), 15);
});

test("the full chain, in order", () => {
  const f = fxFilters(
    {
      ...NEUTRAL,
      reverse: true,
      highpass: 80,
      lowpass: 9000,
      denoise: 50,
      bass: 4,
      eq: [0, 0, -2, 3, 0],
      removeSilence: true,
      pitch: 12,
      speed: 1.25,
      tremolo: 6,
      stereo: "8d",
      echoDecay: 0.4,
      echoDelay: 200,
      volume: -3,
      compressor: true,
      normalize: true,
      loudness: -14,
    },
    info({ sampleRate: 48000 }),
  );
  assert.deepEqual(f, [
    "areverse",
    "highpass=f=80",
    "lowpass=f=9000",
    "afftdn=nr=26:nf=-25",
    "bass=g=4",
    "equalizer=f=910:t=q:w=1:g=-2",
    "equalizer=f=3600:t=q:w=1:g=3",
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2:stop_periods=-1:stop_threshold=-45dB:stop_duration=0.6:stop_silence=0.3",
    "asetrate=96000",
    "aresample=48000",
    "atempo=0.5",
    "atempo=1.25",
    "tremolo=f=6:d=0.5",
    "aformat=channel_layouts=stereo",
    "apulsator=hz=0.12:width=1",
    "aecho=0.8:0.88:200|400:0.4|0.22",
    "volume=-3dB",
    "acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=2",
    "loudnorm=I=-14:TP=-1.5:LRA=11",
  ]);
  assert.deepEqual(fxFilters({ ...NEUTRAL, stereo: "swap" }, info()), ["aformat=channel_layouts=stereo", "pan=stereo|c0=c1|c1=c0"]);
});

test("codec options", () => {
  assert.deepEqual(codecArgs({ ...DEFAULT_OUTPUT, format: "opus", bitrate: 64 }, { rate: 44100, channels: 6 }), ["-c:a", "opus", "-strict", "-2", "-b:a", "64k", "-ar", "48000", "-ac", "2"]);
  assert.deepEqual(codecArgs({ ...DEFAULT_OUTPUT, format: "wav", wavBits: 24, channels: 1 }, { rate: 44100, channels: 2 }), ["-c:a", "pcm_s24le", "-ac", "1"]);
  assert.deepEqual(codecArgs({ ...DEFAULT_OUTPUT, format: "flac" }, { rate: 44100, channels: 2 }, true), ["-c:a", "flac", "-compression_level", "8", "-ar", "44100"]);
  const tagged = editArgs("i", "o.m4a", NEUTRAL, { ...DEFAULT_OUTPUT, format: "m4a", bitrate: 128, title: " Hi ", artist: "Me" }, info());
  assert.deepEqual(tagged.slice(-6), ["-metadata", "title=Hi", "-metadata", "artist=Me", "-y", "o.m4a"]);
});

test("merge: gaps, crossfades, loudness", () => {
  const plain = mergeArgs(["a", "b", "c"], "o.mp3", { ...DEFAULT_MERGE, gap: 1 }, DEFAULT_OUTPUT);
  assert.match(fc(plain), /\[a0\]apad=pad_dur=1\[p0\];\[a1\]apad=pad_dur=1\[p1\];\[p0\]\[p1\]\[a2\]concat=n=3:v=0:a=1\[j\]$/);
  const xf = mergeArgs(["a", "b", "c"], "o.wav", { ...DEFAULT_MERGE, crossfade: 2, normalize: true }, { ...DEFAULT_OUTPUT, format: "wav" });
  assert.match(fc(xf), /\[a0\]\[a1\]acrossfade=d=2:c1=tri:c2=tri\[x1\];\[x1\]\[a2\]acrossfade=d=2:c1=tri:c2=tri\[j\];\[j\]loudnorm=I=-16:TP=-1\.5:LRA=11\[out\]$/);
  assert.equal(xf[xf.indexOf("-map") + 1], "[out]");
  assert.equal(mergeLength([10, 20, 30], { ...DEFAULT_MERGE, crossfade: 2 }), 56);
  assert.equal(mergeLength([10, 20, 30], { ...DEFAULT_MERGE, gap: 1 }), 62);
});

test("mix: ducking, delay, loop, fade, length", () => {
  const a = mixArgs("voice.wav", "music.mp3", "o.mp3", { ...DEFAULT_MIX, musicDelay: 2 }, DEFAULT_OUTPUT, 30, 10);
  assert.deepEqual(a.slice(0, 7), ["-hide_banner", "-i", "voice.wav", "-stream_loop", "-1", "-i", "music.mp3"]);
  assert.match(fc(a), /volume=0dB,asplit=2\[v\]\[key\];\[1:a:0\][^;]*volume=-12dB,adelay=2000:all=1,afade=t=out:st=27:d=3\[m\];\[m\]\[key\]sidechaincompress=[^;]*ratio=8[^;]*\[md\];\[v\]\[md\]amix=inputs=2:duration=first:dropout_transition=0:normalize=0\[mix\]$/);
  assert.deepEqual(a.slice(a.indexOf("-map"), a.indexOf("-map") + 4), ["-map", "[mix]", "-t", "30"]);
  const s = { ...DEFAULT_MIX, duck: false, loopMusic: false, length: "longest" as const, musicFadeOut: 0 };
  assert.equal(mixLength(s, 30, 40), 40);
  assert.ok(!mixArgs("v", "m", "o", s, DEFAULT_OUTPUT, 30, 40).includes("-stream_loop"));
});

test("split", () => {
  const pauses = parseSilences(`silence_start: -0.01\nsilence_end: 0.8 | silence_duration: 0.81\nsilence_start: 10.2\nsilence_end: 11.0 | x\nsilence_start: 10.9\nsilence_start: 20.5\nsilence_end: 21.5 | x`);
  assert.deepEqual(pauses, [{ start: 0, end: 0.8 }, { start: 10.2, end: 11 }, { start: 20.5, end: 21.5 }]);
  assert.deepEqual(cutsAtPauses(pauses, 30), [10.6, 21]);
  assert.deepEqual(cutsAtPauses(pauses, 30, 10), [10.6]);
  assert.deepEqual(evenCuts(30, 3), [10, 20]);
  assert.deepEqual(everyCuts(25, 10), [10, 20]);
  assert.deepEqual(splitArgs("in.wav", "part_", [10, 20], { ...DEFAULT_OUTPUT, bitrate: 128 }, info()).slice(-9), [
    "-f", "segment", "-segment_format", "mp3", "-segment_times", "10,20", "-reset_timestamps", "1", "part_%03d.mp3",
  ]);
});

test("audio to video", () => {
  const pic = videoArgs("a.mp3", "cover.jpg", "o.mp4", { ...DEFAULT_VIDEO, visual: "none" });
  assert.deepEqual(pic.slice(1, 7), ["-loop", "1", "-framerate", "1", "-i", "cover.jpg"]);
  assert.ok(pic.includes("stillimage") && pic.includes("1:a:0"));
  assert.match(fc(videoArgs("a", null, "o.mp4", DEFAULT_VIDEO)), /^color=c=0x0a0a0a:s=1280x720:r=25\[bg\];\[0:a:0\]showwaves=s=1280x240:mode=cline:rate=25:colors=0xffffff,format=rgba\[viz\];\[bg\]\[viz\]overlay=0:240:shortest=1\[v0\];\[v0\]format=yuv420p\[v\]$/);
  assert.match(fc(videoArgs("a", null, "o.mp4", { ...DEFAULT_VIDEO, visual: "none" })), /showwaves/);
});

test("inspect", () => {
  const log = `[Parsed_ebur128_0 @ 0x1] Summary:\n  Integrated loudness:\n    I:         -19.6 LUFS\n  Loudness range:\n    LRA:         3.8 LU\n  True peak:\n    Peak:       -1.2 dBFS\n[Parsed_volumedetect_1] mean_volume: -21.3 dB\n[Parsed_volumedetect_1] max_volume: -1.5 dB`;
  assert.deepEqual(parseLoudness(log), { integrated: -19.6, range: 3.8, truePeak: -1.2, meanVolume: -21.3, maxVolume: -1.5 });
  assert.deepEqual(coverArgs("in.mp3", "mjpeg"), {
    args: ["-hide_banner", "-i", "in.mp3", "-an", "-map", "0:v:0", "-frames:v", "1", "-update", "1", "-c:v", "copy", "-y", "cover.jpg"],
    output: "cover.jpg",
    mime: "image/jpeg",
  });
  assert.equal(coverArgs("in.m4a", "png").args.includes("copy"), true);
  assert.equal(coverArgs("in.ogg", "bmp").output, "cover.png");
});

test("helpers", () => {
  assert.equal(formatCommand(["-i", "my song.mp3", "-af", "volume=3dB"]), 'ffmpeg -i "my song.mp3" -af volume=3dB');
  assert.equal(formatTime(205.47), "3:25.5");
  assert.equal(formatTime(3725, 0), "1:02:05");
  assert.equal(outputName("talk.final.wav", "mp3", " (fast)"), "talk.final (fast).mp3");
  assert.equal(estimateBytes({ ...DEFAULT_OUTPUT, bitrate: 128 }, 60, null, null), 960000);
  assert.equal(estimateBytes({ ...DEFAULT_OUTPUT, format: "flac" }, 60, 44100, 2), null);
});
