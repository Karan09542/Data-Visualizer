import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, X, Music, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useLongPressMenu } from '../../hooks/useLongPressMenu';

type Vertical = 'top' | 'bottom';
type Horizontal = 'left' | 'right';
interface Corner {
  v: Vertical;
  h: Horizontal;
}

const CORNER_KEY = 'mini-player-corner';
const CORNERS: { v: Vertical; h: Horizontal; label: string }[] = [
  { v: 'top', h: 'left', label: 'Top left' },
  { v: 'top', h: 'right', label: 'Top right' },
  { v: 'bottom', h: 'left', label: 'Bottom left' },
  { v: 'bottom', h: 'right', label: 'Bottom right' },
];

/** The corner chosen on this device; bottom right until someone moves it */
function readCorner(): Corner {
  try {
    const [v, h] = (localStorage.getItem(CORNER_KEY) || '').split('-');
    if ((v === 'top' || v === 'bottom') && (h === 'left' || h === 'right')) return { v, h };
  } catch {
    // Storage blocked (private window, previews): use the default
  }
  return { v: 'bottom', h: 'right' };
}

function saveCorner(c: Corner) {
  try {
    localStorage.setItem(CORNER_KEY, `${c.v}-${c.h}`);
  } catch {
    // Not remembered, but the move still applies for now
  }
}

/** Where to pin it: at the top, just below the app's toolbar; at the bottom, clear of the home bar */
const verticalClass = (v: Vertical) =>
  v === 'top' ? 'top-[calc(env(safe-area-inset-top)+60px)] sm:top-16' : 'bottom-[max(env(safe-area-inset-bottom),16px)] sm:bottom-6';

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
  const [corner, setCorner] = useState<Corner>(readCorner);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const holdHandlers = useLongPressMenu(() => setMenuOpen(true));

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (isPlayerOpen || !currentTrack) return null;

  const moveTo = (next: Corner) => {
    setCorner(next);
    saveCorner(next);
    setMenuOpen(false);
  };

  /** Hold or right-click the player to choose which corner it sits in */
  const positionMenu = menuOpen && (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Move player"
      className={`pointer-events-auto absolute z-10 w-48 rounded-2xl border border-(--ap-line) bg-(--ap-surface) p-2.5 text-(--ap-ink) shadow-xl shadow-black/15 animate-in fade-in zoom-in-95 duration-150 dark:shadow-black/50 ${
        corner.v === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'
      } ${corner.h === 'right' ? 'right-0' : 'left-0'}`}
    >
      <p className="px-1 pb-2 text-[11px] font-medium text-(--ap-muted)">Move player to</p>
      <div className="grid grid-cols-2 gap-1.5">
        {CORNERS.map((c) => {
          const active = c.v === corner.v && c.h === corner.h;
          return (
            <button
              key={c.label}
              role="menuitemradio"
              aria-checked={active}
              aria-label={c.label}
              title={c.label}
              onClick={() => moveTo(c)}
              className={`relative h-14 rounded-lg border transition-colors ${
                active
                  ? 'border-(--ap-accent) bg-(--ap-accent-soft)'
                  : 'border-(--ap-line) bg-(--ap-hover) hover:border-(--ap-accent-line)'
              }`}
            >
              {/* A tiny screen with the player in that corner */}
              <span
                className={`absolute h-2 w-7 rounded-full ${active ? 'bg-(--ap-accent)' : 'bg-(--ap-muted)/60'} ${
                  c.v === 'top' ? 'top-2' : 'bottom-2'
                } ${c.h === 'left' ? 'left-2' : 'right-2'}`}
              />
            </button>
          );
        })}
      </div>
      {!isMinimized && (
        <p className="px-1 pt-2 text-[10.5px] leading-snug text-(--ap-muted) sm:hidden">
          The bar spans the screen on phones; left and right apply once it's minimised.
        </p>
      )}
    </div>
  );

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
      <div
        ref={anchorRef}
        className={`audio-player fixed z-40 animate-in fade-in duration-300 ${verticalClass(corner.v)} ${
          corner.h === 'right' ? 'right-4 slide-in-from-right-8 sm:right-6' : 'left-4 slide-in-from-left-8 sm:left-6'
        }`}
        {...holdHandlers}
      >
        {positionMenu}
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
    <div
      className={`audio-player pointer-events-none fixed inset-x-4 z-40 flex justify-center animate-in fade-in duration-300 sm:inset-x-auto ${verticalClass(corner.v)} ${
        corner.v === 'top' ? 'slide-in-from-top-8' : 'slide-in-from-bottom-8'
      } ${corner.h === 'right' ? 'sm:right-6' : 'sm:left-6'}`}
    >
      <div ref={anchorRef} className="pointer-events-auto relative w-full max-w-[460px] sm:w-[460px]" {...holdHandlers}>
      {positionMenu}
      <div className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-[22px] border border-(--ap-line) bg-(--ap-surface) py-2 pl-2 pr-1.5 text-(--ap-ink) shadow-xl shadow-black/10 dark:shadow-black/50">
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
            title="Minimize (hold or right-click to move)"
            aria-label="Minimize player"
            className={ICON_BUTTON}
          >
            {corner.h === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
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
    </div>
  );
};

export default MiniPlayer;
