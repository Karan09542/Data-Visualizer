import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, X, Music, ChevronRight, ChevronLeft, GripVertical, RotateCcw } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useDraggable } from '../../hooks/useDraggable';

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

const formatTime = (secs: number) => {
  const safe = Number.isFinite(secs) && secs > 0 ? secs : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--ap-muted) transition-colors hover:bg-(--ap-hover) hover:text-(--ap-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) active:scale-95 cursor-pointer';

/** Radius of the progress ring around the minimised bubble, in a 48×48 box */
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, next, previous, isPlayerOpen, togglePlayer, stop, progress, duration } = useAudioPlayer();
  const [isMinimized, setIsMinimized] = useState(false);
  const [corner, setCorner] = useState<Corner>(readCorner);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    position,
    setAndSavePosition,
    resetPosition,
    isDragging,
    targetRef,
    dragProps,
    docking,
  } = useDraggable({
    storageKey: 'mini-player-position',
    edgePadding: 16,
    dragThreshold: 4,
    defaultPosition: () => {
      const initialCorner = readCorner();
      const isTop = initialCorner.v === 'top';
      const isLeft = initialCorner.h === 'left';
      const w = 420;
      const h = 64;
      return {
        x: typeof window !== 'undefined'
          ? isLeft ? 16 : Math.max(16, window.innerWidth - w - 24)
          : 24,
        y: typeof window !== 'undefined'
          ? isTop ? 70 : Math.max(16, window.innerHeight - h - 24)
          : 24,
      };
    },
    onLongPress: () => setMenuOpen(true),
    onContextMenu: () => setMenuOpen(true),
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || targetRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, targetRef]);

  if (isPlayerOpen || !currentTrack) return null;

  const moveTo = (next: Corner) => {
    const el = targetRef.current;
    const w = el?.getBoundingClientRect().width || (isMinimized ? 56 : 420);
    const h = el?.getBoundingClientRect().height || (isMinimized ? 56 : 64);
    const padding = 16;
    const x = next.h === 'right' ? Math.max(padding, window.innerWidth - w - padding) : padding;
    const y = next.v === 'bottom' ? Math.max(padding, window.innerHeight - h - padding) : (padding + 56);
    setAndSavePosition({ x, y });
    setCorner(next);
    saveCorner(next);
    setMenuOpen(false);
  };

  /** Hold or right-click the player to choose options / snap corner */
  const positionMenu = menuOpen && (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Player options"
      className={`pointer-events-auto absolute z-50 w-52 rounded-2xl border border-(--ap-line) bg-(--ap-surface) p-2.5 text-(--ap-ink) shadow-xl shadow-black/15 animate-in fade-in zoom-in-95 duration-150 dark:shadow-black/50 ${
        docking.isTop ? 'top-full mt-2' : 'bottom-full mb-2'
      } ${docking.isLeft ? 'left-0' : 'right-0'}`}
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[11px] font-semibold text-(--ap-muted) uppercase tracking-wider">Player Options</span>
        <button
          role="menuitem"
          onClick={() => {
            resetPosition();
            setMenuOpen(false);
          }}
          title="Reset to default position"
          className="text-[11px] text-(--ap-accent) hover:underline flex items-center gap-1 font-medium transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>
      <p className="px-1 pb-1.5 text-[11px] font-medium text-(--ap-muted)">Snap to corner</p>
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
              className={`relative h-12 rounded-lg border transition-colors ${
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
      <p className="px-1 pt-2 text-[10.5px] leading-snug text-(--ap-muted)">
        💡 Freely drag and reposition player anywhere on screen.
      </p>
      <div className="-mx-2.5 my-2 h-px bg-(--ap-line)" aria-hidden />
      {/* Close button */}
      <button
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          stop();
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
      >
        <X size={15} />
        Close player
      </button>
    </div>
  );

  // Until the engine has loaded the file, fall back to the length read from its tags
  const total = Number.isFinite(duration) && duration > 0 ? duration : currentTrack.duration ?? 0;
  const pct = total > 0 ? Math.min(1, progress / total) : 0;
  const time = total > 0 ? `${formatTime(progress)} / ${formatTime(total)}` : progress > 0 ? formatTime(progress) : '';

  const artwork = (size: string, shape: string) => (
    <div className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden ${shape} bg-(--ap-accent-soft) pointer-events-none select-none`}>
      {currentTrack.thumbnail ? (
        <img
          src={currentTrack.thumbnail}
          alt=""
          className="h-full w-full object-cover pointer-events-none select-none"
          draggable={false}
        />
      ) : (
        <Music className="h-[45%] w-[45%] text-(--ap-accent) pointer-events-none" />
      )}
    </div>
  );

  if (isMinimized) {
    return (
      <div
        ref={targetRef}
        {...dragProps}
        style={{
          ...dragProps.style,
          zIndex: 40,
        }}
        className="audio-player fixed select-none"
      >
        {positionMenu}
        <button
          onClick={() => setIsMinimized(false)}
          title="Show player · Drag to move · Right-click or hold for options"
          aria-label={`Show player: ${currentTrack.title}`}
          draggable={false}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border border-(--ap-line) bg-(--ap-surface) shadow-lg shadow-black/10 ${
            isDragging ? 'scale-105 shadow-2xl ring-2 ring-(--ap-accent)/50' : 'hover:scale-105 active:scale-95 transition-transform'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) dark:shadow-black/40 cursor-grab active:cursor-grabbing`}
        >
          {/* How far through the track, drawn as a ring around the cover */}
          <svg viewBox="0 0 48 48" className="absolute inset-1 -rotate-90 pointer-events-none select-none" aria-hidden>
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
          <span className={`pointer-events-none select-none ${isPlaying ? 'ap-breathe' : ''}`}>{artwork('h-9 w-9', 'rounded-full')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={targetRef}
      {...dragProps}
      style={{
        ...dragProps.style,
        zIndex: 40,
      }}
      className="audio-player fixed select-none w-[calc(100vw-32px)] max-w-[420px] sm:w-[420px]"
    >
      {positionMenu}
      <div className={`relative flex w-full items-center gap-2 sm:gap-2.5 overflow-hidden rounded-2xl border border-(--ap-line) bg-(--ap-surface) p-2 pr-2.5 text-(--ap-ink) shadow-lg shadow-black/10 dark:shadow-black/40 ${
        isDragging ? 'shadow-2xl ring-2 ring-(--ap-accent)/50' : 'transition-shadow'
      }`}>
        {/* Subtle Grip Drag Handle */}
        <div
          className="flex items-center justify-center pl-1 text-(--ap-muted) opacity-60 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 select-none"
          title="Drag anywhere on player to reposition"
          aria-hidden="true"
        >
          <GripVertical size={16} />
        </div>

        {/* Cover and title open the full player */}
        <button
          onClick={togglePlayer}
          draggable={false}
          title="Open player · Drag bar to reposition"
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) cursor-pointer select-none"
        >
          {artwork('h-10 w-10', 'rounded-xl')}
          <span className="min-w-0 pointer-events-none select-none">
            <span className="block truncate text-[13px] font-semibold leading-5 group-hover:underline group-hover:decoration-(--ap-line) group-hover:underline-offset-2">
              {currentTrack.title}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-(--ap-muted)">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${isPlaying ? 'bg-(--ap-accent) ap-breathe' : 'bg-(--ap-track)'}`}
                aria-hidden
              />
              <span className="truncate">{currentTrack.artist || (isPlaying ? 'Playing' : 'Paused')}</span>
              {time && (
                <>
                  <span aria-hidden>·</span>
                  <span className="shrink-0 tabular-nums">{time}</span>
                </>
              )}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={previous}
            draggable={false}
            title="Previous"
            aria-label="Previous track"
            className={`${ICON_BUTTON} hidden text-(--ap-ink) sm:flex`}
          >
            <SkipBack size={15} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            draggable={false}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ap-accent) text-(--ap-surface) transition-[transform,filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) focus-visible:ring-offset-2 focus-visible:ring-offset-(--ap-surface) active:scale-95 cursor-pointer"
          >
            {isPlaying ? (
              <Pause size={15} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={15} fill="currentColor" strokeWidth={0} className="ml-0.5" />
            )}
          </button>
          <button
            onClick={next}
            draggable={false}
            title="Next"
            aria-label="Next track"
            className={`${ICON_BUTTON} text-(--ap-ink)`}
          >
            <SkipForward size={15} fill="currentColor" />
          </button>

          <span className="mx-1 hidden h-5 w-px bg-(--ap-line) sm:block" aria-hidden />

          <button
            onClick={() => setIsMinimized(true)}
            draggable={false}
            title="Minimize"
            aria-label="Minimize player"
            className={ICON_BUTTON}
          >
            {docking.isLeft ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <button
            onClick={stop}
            draggable={false}
            title="Stop and close"
            aria-label="Stop playback"
            className={`${ICON_BUTTON} hidden hover:bg-red-500/10 hover:text-red-500 sm:flex`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Thin progress line along the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-(--ap-track) pointer-events-none" aria-hidden>
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
