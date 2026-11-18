/**
 * Hearing the edit while it's made: the decoded sound plays through a Web Audio chain that
 * mirrors the ffmpeg filters (closely, not exactly), and every change is heard at once.
 *
 *   source(speed) → pitch shift → high/low cut → bass/treble → EQ → fades → tremolo
 *     → stereo matrix → 8D panner → volume → loudness → compressor → echo → meter → out
 *
 * "Piece time" (0…length) is the kept part in the order it's heard; with reverse on, the
 * piece plays over a reversed copy of the buffer.
 */
import { EQ_BANDS, NEUTRAL, type FxParams } from "./commands";

/** Granular pitch shifter: two read heads half a grain apart, sin² windows (they sum to 1). */
const PITCH_WORKLET = `
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.1, maxValue: 8, automationRate: 'k-rate' }]; }
  constructor() { super(); this.N = 16384; this.buf = [new Float32Array(this.N), new Float32Array(this.N)]; this.w = 0; this.phase = 0; this.win = Math.round(sampleRate * 0.05); }
  read(b, pos) { const N = this.N; pos = ((pos % N) + N) % N; const i = Math.floor(pos), f = pos - i; return b[i] * (1 - f) + b[(i + 1) % N] * f; }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0], ratio = params.ratio[0], win = this.win;
    const plain = Math.abs(ratio - 1) < 1e-3, step = (1 - ratio) / win;
    for (let i = 0; i < out[0].length; i++) {
      for (let c = 0; c < 2; c++) { const s = inp[c] || inp[0]; this.buf[c][this.w] = s ? s[i] : 0; }
      if (plain) { for (let c = 0; c < out.length; c++) out[c][i] = this.buf[Math.min(c, 1)][this.w]; }
      else {
        const p1 = this.phase; let p2 = p1 + 0.5; if (p2 >= 1) p2 -= 1;
        const s1 = Math.sin(Math.PI * p1), s2 = Math.sin(Math.PI * p2);
        for (let c = 0; c < out.length; c++) {
          const b = this.buf[Math.min(c, 1)];
          out[c][i] = this.read(b, this.w - (p1 * win + 1)) * s1 * s1 + this.read(b, this.w - (p2 * win + 1)) * s2 * s2;
        }
        this.phase += step; if (this.phase >= 1) this.phase -= 1; if (this.phase < 0) this.phase += 1;
      }
      this.w = (this.w + 1) % this.N;
    }
    return true;
  }
}
registerProcessor('pitch-shift', PitchShift);
`;

const db = (v: number) => Math.pow(10, v / 20);

/** L/R mix for each stereo mode: [LL, LR, RL, RR] (out-left from left, out-right from left, …) */
const MATRIX: Record<FxParams["stereo"], [number, number, number, number]> = {
  keep: [1, 0, 0, 1],
  mono: [0.5, 0.5, 0.5, 0.5],
  swap: [0, 1, 1, 0],
  left: [1, 1, 0, 0],
  right: [0, 0, 1, 1],
  wide: [1.75, -0.75, -0.75, 1.75],
  "8d": [1, 0, 0, 1],
};

/** Rough loudness (RMS and peak, dBFS) of a sound, for previewing loudness evening. Cached. */
const loudCache = new WeakMap<AudioBuffer, { rms: number; peak: number }>();
export function measureLoudness(buffer: AudioBuffer) {
  let hit = loudCache.get(buffer);
  if (hit) return hit;
  let s = 0,
    c = 0,
    pk = 0;
  const stride = Math.max(1, Math.floor(buffer.length / 1_000_000));
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i += stride) (s += d[i] * d[i]), c++, (pk = Math.max(pk, Math.abs(d[i])));
  }
  hit = { rms: 20 * Math.log10(Math.sqrt(s / Math.max(1, c)) || 1e-9), peak: 20 * Math.log10(pk || 1e-9) };
  loudCache.set(buffer, hit);
  return hit;
}

/** The loudness gain (dB) the preview uses to approximate EBU R128 evening. */
const normGainDb = (p: FxParams, loud: { rms: number; peak: number }) => Math.max(-20, Math.min(20, p.loudness - loud.rms, -1 - loud.peak));

const reversedCache = new WeakMap<AudioBuffer, AudioBuffer>();
function reversedOf(buf: AudioBuffer, make: (ch: number, len: number, rate: number) => AudioBuffer) {
  let r = reversedCache.get(buf);
  if (!r) {
    r = make(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
    reversedCache.set(buf, r);
  }
  return r;
}

let workletUrl: string | null = null;
const pitchWorkletUrl = () => (workletUrl ??= URL.createObjectURL(new Blob([PITCH_WORKLET], { type: "text/javascript" })));

/**
 * The edit rendered offline, quickly, for drawing: the same chain as the live preview, at a
 * low sample rate (the waveform only needs the shape). Its timeline is the result's: trimmed,
 * sped up or slowed down, reversed, plus any echo tail.
 */
export async function renderForWaveform(buffer: AudioBuffer, p: FxParams): Promise<AudioBuffer> {
  const start = Math.max(0, p.trimStart);
  const end = p.trimEnd == null ? buffer.duration : Math.min(buffer.duration, p.trimEnd);
  const L = Math.max(0.05, end - start);
  const speed = p.speed || 1;
  const tail = p.echoDecay > 0 ? (p.echoDelay * 2) / 1000 + 0.4 : 0;
  const total = L / speed + tail;
  // about 3 million frames at most, whatever the length
  const rate = Math.round(Math.max(3000, Math.min(8000, 3_000_000 / total)));
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * rate)), rate);
  const gain = (v = 1) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const filter = (type: BiquadFilterType, f: number, g = 0, q?: number) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = Math.min(f, rate / 2 - 10);
    b.gain.value = g;
    if (q) b.Q.value = q;
    return b;
  };

  const src = ctx.createBufferSource();
  src.buffer = p.reverse ? reversedOf(buffer, (c, l, r) => new AudioBuffer({ numberOfChannels: c, length: l, sampleRate: r })) : buffer;
  src.playbackRate.value = speed;

  let node: AudioNode = src;
  const ratio = Math.pow(2, p.pitch / 12) / speed;
  if (Math.abs(ratio - 1) > 1e-3) {
    try {
      await ctx.audioWorklet.addModule(pitchWorkletUrl());
      const shift = new AudioWorkletNode(ctx, "pitch-shift", { outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
      shift.parameters.get("ratio")!.value = Math.max(0.1, Math.min(8, ratio));
      node = node.connect(shift);
    } catch {
      /* drawn without the pitch shift */
    }
  }
  node = node
    .connect(filter("highpass", p.highpass > 0 ? p.highpass : 10, 0, 0.707))
    .connect(filter("lowpass", p.lowpass > 0 ? p.lowpass : 20000, 0, 0.707))
    .connect(filter("lowshelf", 100, p.bass))
    .connect(filter("highshelf", 3000, p.treble));
  EQ_BANDS.forEach((b, i) => p.eq[i] && (node = node.connect(filter("peaking", b.f, p.eq[i], 1.4))));

  // fades, in the result's time
  const fade = gain(1);
  const fi = p.fadeIn / speed;
  const fo = p.fadeOut / speed;
  const len = L / speed;
  if (fi > 0) fade.gain.setValueAtTime(0, 0), fade.gain.linearRampToValueAtTime(1, Math.min(fi, len));
  if (fo > 0) fade.gain.setValueAtTime(1, Math.max(fi, len - fo)), fade.gain.linearRampToValueAtTime(0, len);
  node = node.connect(fade);

  if (p.tremolo > 0) {
    const depth = Math.max(0, Math.min(1, p.tremoloDepth));
    const trem = gain(1 - depth / 2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.tremolo;
    lfo.connect(gain(depth / 2)).connect(trem.gain);
    lfo.start();
    node = node.connect(trem);
  }

  // stereo
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const m = MATRIX[p.stereo];
  node.connect(split);
  split.connect(gain(m[0]), 0).connect(merge, 0, 0);
  split.connect(gain(m[1]), 0).connect(merge, 0, 1);
  split.connect(gain(m[2]), 1).connect(merge, 0, 0);
  split.connect(gain(m[3]), 1).connect(merge, 0, 1);
  node = merge;
  if (p.stereo === "8d") {
    const pan = ctx.createStereoPanner();
    const orbit = ctx.createOscillator();
    orbit.frequency.value = Math.max(0.01, p.orbit);
    orbit.connect(pan.pan);
    orbit.start();
    node = node.connect(pan);
  }

  node = node.connect(gain(Math.pow(10, p.volume / 20)));
  if (p.normalize) node = node.connect(gain(Math.pow(10, normGainDb(p, measureLoudness(buffer)) / 20)));
  if (p.compressor) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    node = node.connect(comp).connect(gain(Math.pow(10, 2 / 20)));
  }
  const out = gain();
  node.connect(out);
  if (p.echoDecay > 0) {
    const k = Math.min(0.9, p.echoDecay);
    const d1 = ctx.createDelay(4);
    const d2 = ctx.createDelay(4);
    d1.delayTime.value = Math.max(0.01, p.echoDelay / 1000);
    d2.delayTime.value = Math.max(0.02, (p.echoDelay * 2) / 1000);
    node.connect(d1).connect(gain(k)).connect(out);
    node.connect(d2).connect(gain(k * 0.55)).connect(out);
  }
  out.connect(ctx.destination);
  src.start(0, p.reverse ? buffer.duration - end : start, L);
  return ctx.startRendering();
}

export class Preview {
  readonly ctx = new AudioContext({ latencyHint: "interactive" });
  readonly analyser: AnalyserNode;
  private buffer: AudioBuffer | null = null;
  private reversed: AudioBuffer | null = null;
  private loud = { rms: -20, peak: 0 };
  private p: FxParams = NEUTRAL;
  private duration = 0;
  private bypass = false;
  loop = false;
  onPlayingChange?: (playing: boolean) => void;

  private src: AudioBufferSourceNode | null = null;
  private token = 0;
  private q0 = 0;
  private t0 = 0;
  private playingNow = false;
  private ready: Promise<void>;
  private shifter: AudioWorkletNode | null = null;
  private meter = new Float32Array(1024);

  private n: {
    input: GainNode;
    hp: BiquadFilterNode;
    lp: BiquadFilterNode;
    bass: BiquadFilterNode;
    treble: BiquadFilterNode;
    eq: BiquadFilterNode[];
    fade: GainNode;
    trem: GainNode;
    tremLfo: OscillatorNode;
    tremDepth: GainNode;
    matrix: GainNode[];
    pan: StereoPannerNode;
    orbit: OscillatorNode;
    orbitDepth: GainNode;
    vol: GainNode;
    norm: GainNode;
    dry: GainNode;
    wet: GainNode;
    d1: DelayNode;
    d2: DelayNode;
    e1: GainNode;
    e2: GainNode;
  };

  constructor() {
    const ctx = this.ctx;
    const gain = (v = 1) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q?: number) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q) b.Q.value = q;
      return b;
    };
    const input = gain();
    const hp = filter("highpass", 10, 0.707);
    const lp = filter("lowpass", 20000, 0.707);
    const bass = filter("lowshelf", 100);
    const treble = filter("highshelf", 3000);
    const eq = EQ_BANDS.map((b) => filter("peaking", b.f, 1.4));
    const fade = gain();
    const trem = gain();
    const tremLfo = ctx.createOscillator();
    const tremDepth = gain(0);
    tremLfo.connect(tremDepth).connect(trem.gain);
    tremLfo.start();

    // stereo matrix
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const matrix = [gain(1), gain(0), gain(0), gain(1)];
    split.connect(matrix[0], 0).connect(merge, 0, 0); // L → L
    split.connect(matrix[1], 0).connect(merge, 0, 1); // L → R
    split.connect(matrix[2], 1).connect(merge, 0, 0); // R → L
    split.connect(matrix[3], 1).connect(merge, 0, 1); // R → R
    const pan = ctx.createStereoPanner();
    const orbit = ctx.createOscillator();
    const orbitDepth = gain(0);
    orbit.connect(orbitDepth).connect(pan.pan);
    orbit.start();

    const vol = gain();
    const norm = gain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    const dry = gain(1);
    const wet = gain(0);
    const makeup = gain(db(2));
    const mix = gain();
    const d1 = ctx.createDelay(4);
    const d2 = ctx.createDelay(4);
    const e1 = gain(0);
    const e2 = gain(0);
    const out = gain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    let chain: AudioNode = hp.connect(lp).connect(bass).connect(treble);
    for (const b of eq) chain = chain.connect(b);
    chain.connect(fade).connect(trem).connect(split);
    merge.connect(pan).connect(vol).connect(norm);
    norm.connect(dry).connect(mix);
    norm.connect(comp).connect(makeup).connect(wet).connect(mix);
    mix.connect(out);
    mix.connect(d1).connect(e1).connect(out);
    mix.connect(d2).connect(e2).connect(out);
    out.connect(this.analyser).connect(ctx.destination);

    input.connect(hp); // until the pitch shifter has loaded
    this.n = { input, hp, lp, bass, treble, eq, fade, trem, tremLfo, tremDepth, matrix, pan, orbit, orbitDepth, vol, norm, dry, wet, d1, d2, e1, e2 };

    const url = URL.createObjectURL(new Blob([PITCH_WORKLET], { type: "text/javascript" }));
    this.ready = ctx.audioWorklet
      .addModule(url)
      .then(() => {
        const node = new AudioWorkletNode(ctx, "pitch-shift", { outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
        input.disconnect();
        input.connect(node).connect(hp);
        this.shifter = node;
        this.apply();
      })
      .catch((e) => console.warn("[audio preview] pitch shifter unavailable", e))
      .finally(() => URL.revokeObjectURL(url));
  }

  // ---------------------------------------------------------------- sound

  setBuffer(buffer: AudioBuffer | null) {
    this.stopSource();
    this.playingNow = false;
    this.buffer = buffer;
    this.reversed = null;
    this.q0 = 0;
    this.duration = buffer?.duration ?? 0;
    if (buffer) this.loud = measureLoudness(buffer);
  }

  get hasSound() {
    return !!this.buffer;
  }
  get playing() {
    return this.playingNow;
  }

  private get eff(): FxParams {
    return this.bypass ? { ...NEUTRAL, trimStart: this.p.trimStart, trimEnd: this.p.trimEnd } : this.p;
  }
  private get start() {
    return Math.max(0, this.p.trimStart);
  }
  private get end() {
    return this.p.trimEnd == null ? this.duration : Math.min(this.duration, this.p.trimEnd);
  }
  private get length() {
    return Math.max(0, this.end - this.start);
  }

  private q() {
    return this.playingNow ? Math.min(this.length, this.q0 + (this.ctx.currentTime - this.t0) * this.eff.speed) : this.q0;
  }

  /** The point of the original file being heard, for the playhead. */
  position() {
    const q = this.q();
    return this.eff.reverse ? this.end - q : this.start + q;
  }

  /** Where in the kept piece, 0…length, in listening order. */
  piecePosition() {
    return this.q();
  }

  private qAt(t: number, reverse = this.eff.reverse) {
    return Math.max(0, Math.min(this.length, reverse ? this.end - t : t - this.start));
  }

  level() {
    if (!this.playingNow) return 0;
    this.analyser.getFloatTimeDomainData(this.meter);
    let pk = 0;
    for (const v of this.meter) pk = Math.max(pk, Math.abs(v));
    return pk;
  }

  // ---------------------------------------------------------------- effects

  private apply() {
    const e = this.eff;
    const n = this.n;
    const now = this.ctx.currentTime;
    const to = (p: AudioParam, v: number) => p.setTargetAtTime(v, now, 0.015);
    const nyq = this.ctx.sampleRate / 2 - 100;
    to(n.hp.frequency, e.highpass > 0 ? e.highpass : 10);
    to(n.lp.frequency, e.lowpass > 0 ? Math.min(e.lowpass, nyq) : Math.min(20000, nyq));
    to(n.bass.gain, e.bass);
    to(n.treble.gain, e.treble);
    n.eq.forEach((b, i) => to(b.gain, e.eq[i] ?? 0));
    // tremolo: gain swings between 1 − depth and 1
    const depth = e.tremolo > 0 ? Math.max(0, Math.min(1, e.tremoloDepth)) : 0;
    to(n.trem.gain, 1 - depth / 2);
    to(n.tremDepth.gain, depth / 2);
    n.tremLfo.frequency.setValueAtTime(Math.max(0.1, e.tremolo || 1), now);
    MATRIX[e.stereo].forEach((v, i) => to(n.matrix[i].gain, v));
    to(n.orbitDepth.gain, e.stereo === "8d" ? 1 : 0);
    n.orbit.frequency.setValueAtTime(Math.max(0.01, e.orbit), now);
    to(n.vol.gain, db(e.volume));
    to(n.norm.gain, e.normalize ? db(normGainDb(e, this.loud)) : 1);
    to(n.wet.gain, e.compressor ? 1 : 0);
    to(n.dry.gain, e.compressor ? 0 : 1);
    const k = Math.max(0, Math.min(0.9, e.echoDecay));
    to(n.e1.gain, k);
    to(n.e2.gain, k * 0.55);
    to(n.d1.delayTime, Math.max(0.01, e.echoDelay / 1000));
    to(n.d2.delayTime, Math.max(0.02, (e.echoDelay * 2) / 1000));
    this.shifter?.parameters.get("ratio")?.setValueAtTime(Math.max(0.1, Math.min(8, Math.pow(2, e.pitch / 12) / (e.speed || 1))), now);
    this.src?.playbackRate.setValueAtTime(e.speed, now);
    this.scheduleFades();
  }

  /** Fades as gain ramps from where playback is to the end of the piece. */
  private scheduleFades() {
    const e = this.eff;
    const g = this.n.fade.gain;
    const now = this.ctx.currentTime;
    const L = this.length;
    const q = this.q();
    const at = (x: number) => Math.max(0, Math.min(1, e.fadeIn > 0 ? x / e.fadeIn : 1, e.fadeOut > 0 ? (L - x) / e.fadeOut : 1));
    g.cancelScheduledValues(now);
    g.setValueAtTime(at(q), now);
    if (!this.playingNow) return;
    const points = new Set([L]);
    if (e.fadeIn > 0) points.add(Math.min(e.fadeIn, L));
    if (e.fadeOut > 0) points.add(Math.max(0, L - e.fadeOut));
    for (const x of [...points].filter((x) => x > q).sort((a, b) => a - b)) g.linearRampToValueAtTime(at(x), now + (x - q) / (e.speed || 1));
  }

  // ---------------------------------------------------------------- transport

  private stopSource() {
    this.token++;
    if (!this.src) return;
    this.src.onended = null;
    try {
      this.src.stop();
    } catch {
      /* never started */
    }
    this.src.disconnect();
    this.src = null;
  }

  private startAt(q: number) {
    this.stopSource();
    const buf = this.buffer;
    const L = this.length;
    if (!buf || L <= 0) return;
    if (q >= L - 0.01) q = 0;
    const e = this.eff;
    if (e.reverse && !this.reversed) {
      const r = this.ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
      this.reversed = r;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = e.reverse ? this.reversed : buf;
    src.playbackRate.value = e.speed;
    src.connect(this.n.input);
    const token = this.token;
    src.onended = () => {
      if (token !== this.token) return;
      this.src = null;
      if (this.loop) return this.startAt(0);
      this.playingNow = false;
      this.q0 = 0;
      this.scheduleFades();
      this.onPlayingChange?.(false);
    };
    this.src = src;
    this.q0 = q;
    this.t0 = this.ctx.currentTime;
    this.playingNow = true;
    src.start(0, e.reverse ? buf.duration - this.end + q : this.start + q, L - q);
    this.apply();
  }

  async play() {
    await this.ready;
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (!this.buffer) return;
    this.startAt(this.q0);
    this.onPlayingChange?.(true);
  }

  pause() {
    if (!this.playingNow) return;
    this.q0 = this.q();
    this.stopSource();
    this.playingNow = false;
    this.scheduleFades();
    this.onPlayingChange?.(false);
  }

  /** Jump to a time in the original file (inside the kept part). */
  seek(t: number) {
    const q = this.qAt(t);
    if (this.playingNow) this.startAt(q);
    else (this.q0 = q), this.scheduleFades();
  }

  rewind() {
    if (this.playingNow) this.startAt(0);
    else this.q0 = 0;
  }

  /** New settings, heard at once; trim or reverse changes restart at the same spot. */
  setParams(next: FxParams) {
    const at = this.position();
    const prevReverse = this.p.reverse;
    const restart = next.trimStart !== this.p.trimStart || next.trimEnd !== this.p.trimEnd || (!this.bypass && next.reverse !== this.p.reverse);
    if (this.playingNow && !restart && !this.bypass && next.speed !== this.p.speed) (this.q0 = this.q()), (this.t0 = this.ctx.currentTime);
    this.p = next;
    if (restart) {
      // reverse flipped while stopped: start from the beginning of the (new) piece
      const flipped = !this.playingNow && next.reverse !== prevReverse;
      const q = flipped ? 0 : this.qAt(Math.max(this.start, Math.min(this.end, at)));
      if (this.playingNow) this.startAt(q);
      else this.q0 = q;
    }
    this.apply();
  }

  /** Original vs. edited, at the same place. */
  setBypass(on: boolean) {
    if (on === this.bypass) return;
    const at = this.position();
    const was = this.playingNow;
    if (was) (this.q0 = this.q()), this.stopSource();
    this.bypass = on;
    const q = this.qAt(at);
    if (was) this.startAt(q);
    else this.q0 = q;
    this.apply();
  }

  dispose() {
    this.stopSource();
    this.ctx.close().catch(() => {});
  }
}
