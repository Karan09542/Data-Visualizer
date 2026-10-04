import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, Volume1, Volume2, VolumeX, Repeat, Ellipsis, Loader2, AlertCircle, Check } from 'lucide-react';

export interface CustomAudioPlayerProps {
  src: string;
  onDelete?: (e: React.MouseEvent) => void;
  className?: string;
  /** Forces a theme; left out, the player follows the app's dark class */
  isDark?: boolean;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const formatTime = (seconds: number) => {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--cp-muted) transition-colors hover:bg-(--cp-hover) hover:text-(--cp-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-soft) nodrag';

export default function CustomAudioPlayer({ src, onDelete, className = '', isDark }: CustomAudioPlayerProps) {
  const [howl, setHowl] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const requestRef = useRef<number | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load with Howler (HTML5 audio, so long files stream instead of downloading first)
  useEffect(() => {
    let sound: any = null;
    let tempAudio: HTMLAudioElement | null = null;
    let cancelled = false;
    setFailed(false);
    setProgress(0);
    setDuration(0);
    setIsPlaying(false);

    if (src) {
      import('howler').then(({ Howl }) => {
        if (cancelled) return;
        sound = new Howl({
          src: [src],
          html5: true,
          format: ['webm', 'mp3', 'ogg', 'wav', 'm4a', 'mp4'],
          onload: () => {
            const d = sound.duration();
            if (d && isFinite(d) && d > 0) setDuration(d);
          },
          onloaderror: () => setFailed(true),
          onplayerror: () => {
            setIsBuffering(false);
            // Mobile browsers may refuse until audio is unlocked by a tap; retry then
            sound.once('unlock', () => sound.play());
          },
          onplay: () => {
            setIsPlaying(true);
            setIsBuffering(false);
          },
          onpause: () => setIsPlaying(false),
          onstop: () => setIsPlaying(false),
          onend: () => {
            if (!sound.loop()) {
              setIsPlaying(false);
              setProgress(0);
            }
          },
          onseek: () => setProgress(sound.seek() as number),
        });
        setHowl(sound);

        // A plain <audio> reads the length of WebM recordings, which often report Infinity
        tempAudio = new Audio(src);
        tempAudio.preload = 'metadata';
        tempAudio.addEventListener('loadedmetadata', () => {
          if (!tempAudio) return;
          if (tempAudio.duration === Infinity || isNaN(tempAudio.duration)) {
            tempAudio.currentTime = 1e99;
            tempAudio.addEventListener(
              'durationchange',
              () => {
                if (!tempAudio) return;
                tempAudio.currentTime = 0;
                if (isFinite(tempAudio.duration)) setDuration(tempAudio.duration);
              },
              { once: true },
            );
          } else if (isFinite(tempAudio.duration)) {
            setDuration(tempAudio.duration);
          }
        });
      });
    }

    return () => {
      cancelled = true;
      if (sound) sound.unload();
      if (tempAudio) {
        tempAudio.src = '';
        tempAudio.load();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Follow the playhead while playing
  useEffect(() => {
    if (!isPlaying || !howl) return;
    const tick = () => {
      if (howl.playing()) setProgress(howl.seek() as number);
      requestRef.current = requestAnimationFrame(tick);
    };
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, howl]);

  // Place the menu by its button, above it when there is room, and close it on outside clicks
  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const rect = menuBtnRef.current.getBoundingClientRect();
    const width = 232;
    const height = menuRef.current?.offsetHeight ?? 200;
    const above = rect.top > height + 16;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setMenuPos({ top: above ? rect.top - 8 : rect.bottom + 8, left, above });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen]);

  const togglePlay = () => {
    if (!howl || failed) return;
    if (isPlaying) {
      howl.pause();
    } else {
      setIsBuffering(true);
      howl.play();
    }
  };

  const seek = (value: number) => {
    setProgress(value);
    howl?.seek(value);
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    howl?.volume(value);
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    howl?.rate(value);
  };

  /** The chip steps through the common speeds; the menu offers all of them */
  const cycleSpeed = () => changeSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 2 : speed === 2 ? 0.5 : 1);

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    howl?.loop(next);
  };

  const theme = isDark === undefined ? undefined : isDark ? 'dark' : 'light';

  if (!src) {
    return (
      <div className="cap my-2 flex h-12 w-full max-w-md items-center justify-center rounded-xl border border-(--cp-line) bg-(--cp-bg) text-xs text-(--cp-muted)" data-theme={theme}>
        Loading audio…
      </div>
    );
  }

  const canSeek = isFinite(duration) && duration > 0;
  const pct = canSeek ? Math.min(100, (progress / duration) * 100) : 0;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const speedLabel = `${speed}×`;

  return (
    <div
      className={`cap nodrag group relative my-2 flex w-full max-w-md ${className}`}
      data-theme={theme}
      contentEditable={false}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-(--cp-line) bg-(--cp-bg) pl-2 pr-1 text-(--cp-text)">
        <button
          onClick={togglePlay}
          disabled={failed}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--ap-accent) text-(--cp-on-accent) transition-transform hover:brightness-110 active:scale-95 disabled:opacity-40 nodrag"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering && !isPlaying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={14} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {failed ? (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={13} /> This audio can't be played
            </p>
          ) : (
            <>
              <input
                type="range"
                min={0}
                max={canSeek ? duration : 0}
                step="any"
                value={canSeek ? Math.min(progress, duration) : 0}
                onChange={(e) => seek(parseFloat(e.target.value))}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!canSeek}
                aria-label="Seek"
                aria-valuetext={`${formatTime(progress)} of ${formatTime(duration)}`}
                className="ap-range block h-4 nodrag"
                style={{ '--ap-fill': `${pct}%` } as React.CSSProperties}
              />
              <div className="-mt-0.5 flex items-center justify-between text-[10.5px] font-medium tabular-nums text-(--cp-muted)">
                <span>{formatTime(progress)}</span>
                <span className="flex items-center gap-1">
                  {isLooping && <Repeat size={10} className="text-(--ap-accent)" aria-label="Repeat on" />}
                  {canSeek ? formatTime(duration) : '--:--'}
                </span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={cycleSpeed}
          className={`${ICON_BUTTON} w-auto min-w-8 px-1.5 text-[11px] font-semibold tabular-nums ${speed !== 1 ? 'text-(--ap-accent)' : ''}`}
          aria-label={`Playback speed ${speedLabel}`}
          title="Playback speed"
        >
          {speedLabel}
        </button>

        <button
          ref={menuBtnRef}
          onClick={() => setMenuOpen((o) => !o)}
          className={`${ICON_BUTTON} ${menuOpen ? 'bg-(--cp-hover) text-(--cp-text)' : ''}`}
          aria-label="More audio options"
          aria-expanded={menuOpen}
          title="More options"
        >
          <Ellipsis size={16} />
        </button>

        {onDelete && (
          <button
            onClick={onDelete}
            className={`${ICON_BUTTON} hover:bg-red-500/10 hover:text-red-500 [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex`}
            aria-label="Remove audio"
            title="Remove audio"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="cap fixed z-[999999] w-58 rounded-xl border border-(--cp-line) bg-(--cp-menu) p-3 text-(--cp-text) shadow-xl shadow-black/15 nodrag"
            data-theme={theme}
            style={{
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              transform: menuPos?.above ? 'translateY(-100%)' : undefined,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[11px] font-medium text-(--cp-muted)">Speed</p>
            <div className="mb-3 grid grid-cols-6 gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`h-7 rounded-md text-[11px] font-semibold tabular-nums transition-colors ${
                    s === speed ? 'bg-(--ap-accent) text-(--cp-on-accent)' : 'bg-(--cp-hover) hover:text-(--ap-accent)'
                  }`}
                  aria-pressed={s === speed}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={toggleLoop}
              className="mb-2 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[13px] transition-colors hover:bg-(--cp-hover)"
              aria-pressed={isLooping}
            >
              <span className="flex items-center gap-2">
                <Repeat size={14} className={isLooping ? 'text-(--ap-accent)' : 'text-(--cp-muted)'} />
                Repeat
              </span>
              {isLooping && <Check size={14} className="text-(--ap-accent)" />}
            </button>

            <div className="flex items-center gap-2 border-t border-(--cp-line) pt-2.5">
              <button
                onClick={() => changeVolume(volume === 0 ? 1 : 0)}
                className={`${ICON_BUTTON} h-7 w-7`}
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon size={15} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                aria-label="Volume"
                className="ap-range block flex-1"
                style={{ '--ap-fill': `${volume * 100}%` } as React.CSSProperties}
              />
              <span className="w-8 text-right text-[11px] tabular-nums text-(--cp-muted)">{Math.round(volume * 100)}%</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
