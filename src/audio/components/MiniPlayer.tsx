import React, { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, X, Music, ChevronRight } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const formatTime = (secs: number) => {
  const safe = Number.isFinite(secs) && secs > 0 ? secs : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const ICON_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--ap-muted) transition-colors hover:bg-(--ap-hover) hover:text-(--ap-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) active:scale-95';

/** Radius of the progress ring around the minimised bubble, in a 48×48 box */
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, next, previous, isPlayerOpen, togglePlayer, stop, progress, duration } = useAudioPlayer();
  const [isMinimized, setIsMinimized] = useState(false);

  if (isPlayerOpen || !currentTrack) return null;

  const pct = Number.isFinite(duration) && duration > 0 ? Math.min(1, progress / duration) : 0;

  const artwork = (size: string) => (
    <div className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--ap-accent-soft)`}>
      {currentTrack.thumbnail ? (
        <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <Music className="h-[45%] w-[45%] text-(--ap-accent)" />
      )}
    </div>
  );

  if (isMinimized) {
    return (
      <div className="audio-player fixed bottom-[max(env(safe-area-inset-bottom),16px)] right-4 z-40 animate-in slide-in-from-right-8 fade-in duration-300 sm:bottom-6 sm:right-6">
        <button
          onClick={() => setIsMinimized(false)}
          title="Show player"
          aria-label={`Show player: ${currentTrack.title}`}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border border-(--ap-line) bg-(--ap-surface) shadow-lg shadow-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) active:scale-95 dark:shadow-black/40"
        >
          {/* How far through the track, drawn as a ring around the cover */}
          <svg viewBox="0 0 48 48" className="absolute inset-1 -rotate-90" aria-hidden>
            <circle cx="24" cy="24" r={RING_R} fill="none" strokeWidth="2.5" className="stroke-(--ap-track)" />
            <circle
              cx="24"
              cy="24"
              r={RING_R}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - pct)}
              className="stroke-(--ap-accent) transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <span className={isPlaying ? 'ap-breathe' : ''}>{artwork('h-9 w-9')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="audio-player pointer-events-none fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)] z-40 flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300 sm:inset-x-auto sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto relative flex w-full max-w-[460px] items-center gap-2.5 overflow-hidden rounded-[22px] border border-(--ap-line) bg-(--ap-surface) py-2 pl-2 pr-1.5 text-(--ap-ink) shadow-xl shadow-black/10 sm:w-[460px] dark:shadow-black/50">
        {/* Cover and title open the full player */}
        <button
          onClick={togglePlayer}
          title="Open player"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line)"
        >
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className={`absolute inset-0 rounded-full bg-(--ap-ring-2) ${isPlaying ? 'ap-breathe' : ''}`} />
            {artwork('h-10 w-10')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{currentTrack.title}</span>
            <span className="mt-0.5 block truncate text-xs text-(--ap-muted)">
              {currentTrack.artist || (isPlaying ? 'Now playing' : 'Paused')}
              <span className="tabular-nums"> · {formatTime(progress)} / {formatTime(duration)}</span>
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={previous}
            title="Previous"
            aria-label="Previous track"
            className={`${ICON_BUTTON} hidden text-(--ap-ink) sm:flex`}
          >
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="mx-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--ap-button) text-(--ap-on-button) shadow-(--ap-button-shadow) ring-1 ring-(--ap-line) transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) active:scale-95"
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />
            )}
          </button>
          <button
            onClick={next}
            title="Next"
            aria-label="Next track"
            className={`${ICON_BUTTON} text-(--ap-ink)`}
          >
            <SkipForward size={17} fill="currentColor" />
          </button>

          <span className="mx-1 hidden h-6 w-px bg-(--ap-line) sm:block" />

          <button
            onClick={stop}
            title="Stop"
            aria-label="Stop playback"
            className={`${ICON_BUTTON} hidden hover:text-red-500 sm:flex`}
          >
            <X size={17} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize"
            aria-label="Minimize player"
            className={ICON_BUTTON}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Thin progress line along the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-(--ap-track)" aria-hidden>
          <div
            className="h-full bg-(--ap-accent) transition-[width] duration-300 ease-linear"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
