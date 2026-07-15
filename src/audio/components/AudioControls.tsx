import React from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
} from "lucide-react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

export const AudioControls: React.FC = () => {
  const {
    isPlaying,
    togglePlay,
    next,
    previous,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isLooping,
    toggleLoop,
    isShuffle,
    toggleShuffle,
    progress,
    duration,
    seek,
  } = useAudioPlayer();

  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 p-3 sm:p-4">
      <div className="flex w-full items-center gap-3 text-[11px] font-bold tabular-nums text-slate-500">
        <span className="w-10 text-right text-slate-500 dark:text-slate-400">{formatTime(progress)}</span>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          aria-label="Audio progress"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-800 accent-cyan-400 dark:accent-cyan-300"
        />
        <span className="w-10 text-slate-500 dark:text-slate-400">{formatTime(duration)}</span>
      </div>

      <div className="flex flex-col items-center justify-between gap-5 sm:flex-row sm:gap-4">
        <div className="order-2 flex w-full items-center justify-center gap-2 sm:order-1 sm:w-auto sm:justify-start">
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
              isShuffle
                ? "border-cyan-400 bg-cyan-100 text-cyan-700 shadow-[0_0_18px_rgba(34,211,238,0.3)] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200 dark:shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-slate-200"
            }`}
          >
            <Shuffle size={18} />
          </button>
          <button
            onClick={toggleLoop}
            title="Repeat"
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
              isLooping
                ? "border-amber-400 bg-amber-100 text-amber-700 shadow-[0_0_18px_rgba(251,191,36,0.3)] dark:border-amber-200/30 dark:bg-amber-200/10 dark:text-amber-100 dark:shadow-[0_0_18px_rgba(251,191,36,0.10)]"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-slate-200"
            }`}
          >
            <Repeat size={18} />
          </button>
        </div>

        <div className="order-1 flex w-full items-center justify-center gap-3 sm:order-2 sm:w-auto">
          <button
            onClick={previous}
            title="Previous"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
          >
            <SkipBack size={22} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            title={isPlaying ? "Pause" : "Play"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400 dark:bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/20 transition-all hover:bg-cyan-300 dark:hover:bg-cyan-200 hover:scale-[1.03] active:scale-95"
          >
            {isPlaying ? (
              <Pause size={30} fill="currentColor" />
            ) : (
              <Play size={30} className="ml-1" fill="currentColor" />
            )}
          </button>
          <button
            onClick={next}
            title="Next"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>

        <div className="order-3 flex w-full items-center justify-center gap-3 px-2 sm:w-32 sm:justify-end sm:px-0">
          <button
            onClick={toggleMute}
            title={isMuted || volume === 0 ? "Unmute" : "Mute"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolume}
            aria-label="Volume"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-800 accent-emerald-400 dark:accent-emerald-300"
          />
        </div>
      </div>
    </div>
  );
};
