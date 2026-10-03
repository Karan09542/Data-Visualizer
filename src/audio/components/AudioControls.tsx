import React from "react";
import {
  SkipForward,
  SkipBack,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
} from "lucide-react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

const formatTime = (secs: number) => {
  const safe = Number.isFinite(secs) && secs > 0 ? secs : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
};

const fill = (pct: number) => ({ "--ap-fill": `${pct}%` }) as React.CSSProperties;

const ICON_BUTTON =
  "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) active:scale-95";

/** Shuffle and repeat: muted when off, accent on a soft tint when on */
const toggleClass = (on: boolean) =>
  `${ICON_BUTTON} ${
    on
      ? "text-(--ap-accent) bg-(--ap-accent-soft)"
      : "text-(--ap-muted) hover:bg-(--ap-hover) hover:text-(--ap-ink)"
  }`;

export const AudioControls: React.FC = () => {
  const {
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

  const canSeek = Number.isFinite(duration) && duration > 0;
  const progressPct = canSeek ? Math.min(100, (progress / duration) * 100) : 0;
  const shownVolume = isMuted ? 0 : volume;
  const VolumeIcon = shownVolume === 0 ? VolumeX : shownVolume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={toggleShuffle}
          title="Shuffle"
          aria-pressed={isShuffle}
          className={toggleClass(isShuffle)}
        >
          <Shuffle size={19} />
        </button>
        <button
          onClick={previous}
          title="Previous"
          aria-label="Previous track"
          className={`${ICON_BUTTON} text-(--ap-ink) hover:bg-(--ap-hover)`}
        >
          <SkipBack size={22} fill="currentColor" />
        </button>
        <button
          onClick={next}
          title="Next"
          aria-label="Next track"
          className={`${ICON_BUTTON} text-(--ap-ink) hover:bg-(--ap-hover)`}
        >
          <SkipForward size={22} fill="currentColor" />
        </button>
        <button
          onClick={toggleLoop}
          title="Repeat"
          aria-pressed={isLooping}
          className={toggleClass(isLooping)}
        >
          <Repeat size={19} />
        </button>
      </div>

      <div>
        <input
          type="range"
          min="0"
          max={canSeek ? duration : 0}
          step="any"
          value={canSeek ? Math.min(progress, duration) : 0}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!canSeek}
          aria-label="Seek"
          aria-valuetext={`${formatTime(progress)} of ${formatTime(duration)}`}
          className="ap-range block"
          style={fill(progressPct)}
        />
        <div className="mt-1 flex justify-between text-xs font-medium tabular-nums text-(--ap-muted)">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          title={shownVolume === 0 ? "Unmute" : "Mute"}
          aria-label={shownVolume === 0 ? "Unmute" : "Mute"}
          className={`${ICON_BUTTON} h-9 w-9 shrink-0 text-(--ap-muted) hover:bg-(--ap-hover) hover:text-(--ap-ink)`}
        >
          <VolumeIcon size={18} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={shownVolume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="ap-range block"
          style={fill(shownVolume * 100)}
        />
      </div>
    </div>
  );
};
