import React, { useCallback, useEffect, useRef, useState } from "react";
import { Layers, Mic, Music } from "lucide-react";
import { useMedia, useJob, fsName, useWaveformVisible } from "./hooks";
import { Select, Slider, PlayButton, ActionBar, Badge, Card, CommandLine, Field, FilePick, FileBar, IconButton, LevelMeter, OutputCard, ResultCard, ToggleRow, bytes, card } from "./ui";
import { MiniBar, WaveToggle } from "./ui";
import { Waveform } from "./Waveform";
import { useAccent } from "./palette";
import { DEFAULT_MIX, DEFAULT_OUTPUT, estimateBytes, formatInfo, formatTime, mixArgs, mixLength, type MixSettings, type OutputSettings } from "./commands";
import { SkipBack } from "lucide-react";

/** Both tracks playing together, following the mix settings; ducking follows the voice level live. */
class MixPlayer {
  ctx = new AudioContext({ latencyHint: "interactive" });
  voice: AudioBuffer | null = null;
  music: AudioBuffer | null = null;
  m: MixSettings = DEFAULT_MIX;
  playing = false;
  private vGain = this.ctx.createGain();
  private mGain = this.ctx.createGain();
  private duck = this.ctx.createGain();
  private fade = this.ctx.createGain();
  private vMeter = this.ctx.createAnalyser();
  readonly out = this.ctx.createAnalyser();
  private srcs: AudioBufferSourceNode[] = [];
  private t0 = 0;
  private p0 = 0;
  private buf = new Float32Array(1024);
  onEnd?: () => void;

  constructor() {
    this.vMeter.fftSize = this.out.fftSize = 1024;
    this.vGain.connect(this.vMeter).connect(this.out);
    this.mGain.connect(this.duck).connect(this.fade).connect(this.out);
    this.out.connect(this.ctx.destination);
  }
  get length() {
    return mixLength(this.m, this.voice?.duration ?? null, this.music?.duration ?? null) ?? 0;
  }
  position() {
    return this.playing ? Math.min(this.length, this.p0 + this.ctx.currentTime - this.t0) : this.p0;
  }
  private stopAll() {
    this.srcs.forEach((s) => {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* never started */
      }
      s.disconnect();
    });
    this.srcs = [];
  }
  apply() {
    const now = this.ctx.currentTime;
    this.vGain.gain.setTargetAtTime(Math.pow(10, this.m.voiceVolume / 20), now, 0.02);
    this.mGain.gain.setTargetAtTime(Math.pow(10, this.m.musicVolume / 20), now, 0.02);
    const g = this.fade.gain;
    const L = this.length;
    const p = this.position();
    const f = this.m.musicFadeOut;
    g.cancelScheduledValues(now);
    g.setValueAtTime(f > 0 ? Math.max(0, Math.min(1, (L - p) / f)) : 1, now);
    if (this.playing && f > 0) {
      if (p < L - f) g.setValueAtTime(1, now + (L - f - p));
      g.linearRampToValueAtTime(0, now + Math.max(0.01, L - p));
    }
  }
  start(at: number) {
    this.stopAll();
    if (!this.voice || this.length <= 0) return;
    if (at >= this.length - 0.02) at = 0;
    const now = this.ctx.currentTime + 0.02;
    const v = this.ctx.createBufferSource();
    v.buffer = this.voice;
    v.connect(this.vGain);
    if (at < this.voice.duration) v.start(now, at);
    this.srcs.push(v);
    if (this.music) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.music;
      s.loop = this.m.loopMusic;
      s.connect(this.mGain);
      const into = at - this.m.musicDelay;
      if (into < 0) s.start(now - into, 0);
      else if (this.m.loopMusic || into < this.music.duration) s.start(now, this.m.loopMusic ? into % this.music.duration : into);
      this.srcs.push(s);
    }
    this.t0 = now;
    this.p0 = at;
    this.playing = true;
    this.apply();
  }
  async play() {
    if (this.ctx.state !== "running") await this.ctx.resume();
    this.start(this.p0);
  }
  pause() {
    if (!this.playing) return;
    this.p0 = this.position();
    this.stopAll();
    this.playing = false;
    this.apply();
  }
  seek(t: number) {
    if (this.playing) this.start(t);
    else this.p0 = Math.max(0, Math.min(this.length, t));
  }
  /** Each frame: duck the music while the voice is heard; stop at the end. */
  tick() {
    if (!this.playing) return;
    if (this.position() >= this.length - 0.01) {
      this.stopAll();
      this.playing = false;
      this.p0 = 0;
      this.apply();
      return this.onEnd?.();
    }
    let target = 1;
    if (this.m.duck) {
      this.vMeter.getFloatTimeDomainData(this.buf);
      let s = 0;
      for (const x of this.buf) s += x * x;
      if (Math.sqrt(s / this.buf.length) > 0.02) target = Math.pow(10, -Math.min(24, this.m.duckAmount * 2) / 20);
    }
    this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, target < this.duck.gain.value ? 0.03 : 0.3);
  }
  level() {
    if (!this.playing) return 0;
    this.out.getFloatTimeDomainData(this.buf);
    return this.buf.reduce((a, x) => Math.max(a, Math.abs(x)), 0);
  }
  dispose() {
    this.stopAll();
    this.ctx.close().catch(() => {});
  }
}

export const MixTool: React.FC<{ ready: boolean; file: File | null; onUse: (f: File) => void; onLibrary: () => void }> = ({ ready, file, onUse, onLibrary }) => {
  const a = useAccent();
  const [voiceFile, setVoiceFile] = useState<File | null>(file);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const voice = useMedia(voiceFile, ready);
  const music = useMedia(musicFile, ready);
  const [m, setM] = useState<MixSettings>(DEFAULT_MIX);
  const [showWave, setShowWave] = useWaveformVisible();
  const [out, setOut] = useState<OutputSettings>(DEFAULT_OUTPUT);
  const set = (x: Partial<MixSettings>) => setM((s) => ({ ...s, ...x }));
  const { job, output, run, clear } = useJob();

  const player = useRef<MixPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [level, setLevel] = useState(0);
  const get = useCallback(() => {
    if (!player.current) (player.current = new MixPlayer()).onEnd = () => (setPlaying(false), setPos(0));
    return player.current;
  }, []);
  useEffect(() => () => player.current?.dispose(), []);
  useEffect(() => {
    const p = get();
    p.pause();
    setPlaying(false);
    p.voice = voice.sound?.buffer ?? null;
    p.music = music.sound?.buffer ?? null;
  }, [voice.sound, music.sound, get]);
  useEffect(() => {
    const p = get();
    const restart = p.playing && (p.m.musicDelay !== m.musicDelay || p.m.loopMusic !== m.loopMusic || p.m.length !== m.length);
    p.m = m;
    restart ? p.start(p.position()) : p.apply();
  }, [m, get]);
  useEffect(() => {
    if (!playing) return setLevel(0);
    let raf = 0;
    const tick = () => {
      const p = player.current!;
      p.tick();
      setPos(p.position());
      setLevel(p.level());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const toggle = async () => {
    const p = get();
    if (!p.voice) return;
    p.playing ? p.pause() : await p.play();
    setPlaying(p.playing);
    setPos(p.position());
  };

  const total = mixLength(m, voice.info?.duration ?? (voice.duration || null), music.info?.duration ?? (music.duration || null));
  const fmt = formatInfo(out.format);
  const vName = voiceFile ? fsName("voice", voiceFile) : "voice";
  const mName = musicFile ? fsName("music", musicFile) : "music";
  const args = voice.info?.hasAudio && music.info?.hasAudio ? mixArgs(vName, mName, `mix.${fmt.ext}`, m, out, voice.info.duration, music.info.duration) : null;
  const key = JSON.stringify([m, out, voiceFile?.name, musicFile?.name]);
  const est = estimateBytes({ ...out, sampleRate: out.sampleRate || 48000 }, total, 48000, 2);
  const outdated = !!output && output.key !== key;

  const slot = (label: string, Icon: React.ElementType, f: File | null, media: typeof voice, setF: (f: File | null) => void, hint: string) =>
    f ? (
      <FileBar file={f} info={media.info} duration={media.duration} label={label} onReplace={(x) => (clear(), setF(x))} onClose={() => (clear(), setF(null))} />
    ) : (
      <div className={`${card} p-2`}>
        <p className="flex items-center gap-2 px-2 pt-1 pb-2 text-[13px] font-medium text-slate-900 dark:text-slate-100">
          <Icon size={14} className={a.text} /> {label}
        </p>
        <FilePick onFile={setF} title={`Drop the ${label.toLowerCase()}`} subtitle={hint} />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {slot("Voice", Mic, voiceFile, voice, setVoiceFile, "The main track: speech, vocals, a video's sound")}
        {slot("Music", Music, musicFile, music, setMusicFile, "Plays underneath, quieter")}
      </div>
      {(voice.error || music.error) && <div className={`${card} p-4 text-sm text-red-500`}>{voice.error || music.error}</div>}

      {voiceFile && musicFile && (
        <>
          <div className={`${card} p-3 sm:p-4 flex flex-col gap-2`}>
            <div className="flex justify-end -mt-1 -mb-1">
              <WaveToggle on={showWave} onChange={setShowWave} />
            </div>
            {showWave ? (
              <>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Mic size={12} /> Voice
            </p>
            <Waveform peaks={voice.sound?.peaks ?? null} buffer={voice.sound?.buffer} duration={voice.duration} playhead={voice.sound?.buffer ? Math.min(pos, voice.duration) : null} onSeek={(t) => (get().seek(t), setPos(t))} height={72} ruler={false} />
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
              <Music size={12} /> Music {m.musicDelay > 0 && <span className="normal-case tracking-normal font-normal">· from {formatTime(m.musicDelay)}</span>}
            </p>
            <div style={{ paddingLeft: total ? `${(Math.min(m.musicDelay, total) / total) * 100}%` : 0 }}>
              <Waveform peaks={music.sound?.peaks ?? null} buffer={music.sound?.buffer} duration={music.duration} height={56} ruler={false} />
            </div>
              </>
            ) : (
              <MiniBar duration={total ?? voice.duration} position={voice.sound?.buffer ? pos : null} onSeek={(t) => (get().seek(t), setPos(t))} />
            )}
            <div className="mt-2 flex items-center gap-2">
              <IconButton label="Back to start" onClick={() => (get().seek(0), setPos(0))} disabled={!voice.sound?.buffer}>
                <SkipBack size={16} />
              </IconButton>
              <PlayButton playing={playing} disabled={!voice.sound?.buffer} onClick={toggle} />
              <span className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-200 ml-1">
                {formatTime(pos)}
                <span className="text-slate-400"> / {formatTime(total ?? 0)}</span>
              </span>
              <span className="ml-auto">
                <LevelMeter level={level} />
              </span>
            </div>
          </div>

          <Card title="Mix" icon={Layers}>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <Slider label="Voice volume" value={m.voiceVolume} min={-20} max={12} step={0.5} onChange={(v) => set({ voiceVolume: v })} format={(v) => `${v > 0 ? "+" : ""}${v} dB`} />
                <Slider label="Music volume" value={m.musicVolume} min={-40} max={6} step={0.5} onChange={(v) => set({ musicVolume: v })} format={(v) => `${v > 0 ? "+" : ""}${v} dB`} ends={["Quiet", "Loud"]} />
                <Slider label="Music starts at" value={m.musicDelay} min={0} max={Math.max(1, Math.min(60, Math.floor(voice.duration)))} step={0.5} onChange={(v) => set({ musicDelay: v })} format={(v) => (v ? formatTime(v) : "The start")} />
                <Slider label="Music fades out" value={m.musicFadeOut} min={0} max={10} step={0.5} onChange={(v) => set({ musicFadeOut: v })} format={(v) => (v ? `${v} s` : "Off")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ToggleRow label="Auto-duck" hint="Music dips while the voice speaks" checked={m.duck} onChange={(v) => set({ duck: v })} badge={m.duck ? "approx. live" : undefined} />
                <ToggleRow label="Loop the music" hint="Repeat until the voice ends" checked={m.loopMusic} onChange={(v) => set({ loopMusic: v })} />
                {m.duck && <Slider label="Duck amount" value={m.duckAmount} min={2} max={20} onChange={(v) => set({ duckAmount: v })} format={(v) => (v < 6 ? "Gentle" : v < 12 ? "Medium" : "Strong")} />}
                {!m.loopMusic && (
                  <Field label="Length">
                    <Select label="Length" value={m.length} onChange={(v) => set({ length: v })} options={[{ label: "End with the voice", value: "voice" as const }, { label: "Until both end", value: "longest" as const }]} />
                  </Field>
                )}
                <ToggleRow label="Even out loudness" hint="The final mix at a standard level" checked={m.normalize} onChange={(v) => set({ normalize: v })} />
              </div>
            </div>
          </Card>
          <OutputCard o={out} set={(x) => setOut((o) => ({ ...o, ...x }))} autoRate="Automatic · 48 kHz" />
          <CommandLine args={args} />
          {output && <ResultCard output={output} outdated={outdated} onUse={onUse} onLibrary={onLibrary} />}
        </>
      )}

      {voiceFile && musicFile && (
        <ActionBar
          job={job}
          icon={Layers}
          canRun={ready && !!args}
          outdated={outdated}
          label={outdated ? "Mix again" : `Mix into ${fmt.label}`}
          summary={
            !ready ? (
              "Set up the engine to mix"
            ) : !args ? (
              "Reading the files…"
            ) : (
              <span className="flex items-center gap-2">
                {fmt.label}
                {total != null && ` · ${formatTime(total, 0)}`}
                {est != null && ` · ~${bytes(est)}`}
                {m.duck && <Badge>ducking</Badge>}
              </span>
            )
          }
          onRun={() => {
            if (!args || !voiceFile || !musicFile) return;
            get().pause();
            setPlaying(false);
            run({ args, inputs: [{ name: vName, data: voiceFile }, { name: mName, data: musicFile }], outputs: [`mix.${fmt.ext}`], name: () => `${voiceFile.name.replace(/\.[^.]+$/, "")} (mix).${fmt.ext}`, key, seconds: total, tool: "Mix" });
          }}
        />
      )}
    </div>
  );
};
