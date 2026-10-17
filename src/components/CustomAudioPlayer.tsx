import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, Volume1, Volume2, VolumeX, Repeat, Ellipsis, Loader2, AlertCircle, Check } from 'lucide-react';

export interface CustomAudioPlayerProps {
  src: string;
  duration?: number;
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

export default function CustomAudioPlayer({
  src,
  duration: initialDuration,
  onDelete,
  className = '',
  isDark,
}: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(
    typeof initialDuration === 'number' && isFinite(initialDuration) && initialDuration > 0
      ? initialDuration
      : 0,
  );
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(false);

  const isSeekingRef = useRef(false);
  const lastSrcRef = useRef(resolvedSrc);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Support resolving asset IDs (e.g. img_..., thumb_..., asset_...) if passed directly
  useEffect(() => {
    let active = true;
    if (src && (src.startsWith('img_') || src.startsWith('thumb_') || src.startsWith('asset_'))) {
      import('../utils/assetManager').then(({ resolveAssetUrl }) => {
        resolveAssetUrl(src).then((url) => {
          if (active && url) setResolvedSrc(url);
        }).catch(() => {
          if (active) setFailed(true);
        });
      });
    } else {
      setResolvedSrc(src);
    }
    return () => {
      active = false;
    };
  }, [src]);

  // Probe duration using a background Audio element with Chromium WebM/blob seek trick
  useEffect(() => {
    if (!resolvedSrc) return;
    let active = true;

    // If already have a valid duration, keep it unless source changed
    if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(audioRef.current.duration);
      return;
    }

    const probe = new Audio(resolvedSrc);
    probe.preload = 'metadata';

    const onDurationChange = () => {
      if (!active) return;
      if (isFinite(probe.duration) && probe.duration > 0) {
        setDuration(probe.duration);
        cleanup();
      }
    };

    const onLoaded = () => {
      if (!active) return;
      if (isFinite(probe.duration) && probe.duration > 0) {
        setDuration(probe.duration);
        cleanup();
      } else {
        // Chromium quirk: setting currentTime = 1e99 triggers duration calculation for WebM & blob streams
        probe.currentTime = 1e99;
        probe.addEventListener('durationchange', onDurationChange, { once: true });
      }
    };

    const cleanup = () => {
      probe.removeEventListener('loadedmetadata', onLoaded);
      probe.removeEventListener('durationchange', onDurationChange);
      probe.src = '';
    };

    probe.addEventListener('loadedmetadata', onLoaded);

    return () => {
      active = false;
      cleanup();
    };
  }, [resolvedSrc]);

  // Source change & cleanup: only reset if source actually changed
  useEffect(() => {
    if (lastSrcRef.current !== resolvedSrc) {
      lastSrcRef.current = resolvedSrc;
      const el = audioRef.current;
      setProgress(0);
      setDuration(
        typeof initialDuration === 'number' && isFinite(initialDuration) && initialDuration > 0
          ? initialDuration
          : 0,
      );
      setIsPlaying(false);
      setIsBuffering(false);
      setFailed(false);

      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [resolvedSrc, initialDuration]);

  // Listen for pointerup globally so dragging the slider never gets stuck
  useEffect(() => {
    const onPointerUp = () => {
      isSeekingRef.current = false;
    };
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Pause when another node player starts playing
  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      const customEv = e as CustomEvent<{ src: string }>;
      if (customEv.detail?.src !== resolvedSrc && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('antigravity:audio-play', onOtherPlay);
    return () => {
      window.removeEventListener('antigravity:audio-play', onOtherPlay);
    };
  }, [resolvedSrc]);

  // Keep audio element properties in sync with state
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.playbackRate = speed;
      el.volume = volume;
      el.muted = volume === 0;
      el.loop = isLooping;
    }
  }, [speed, volume, isLooping]);

  // Smooth 60fps playhead tracking while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused && !isSeekingRef.current) {
        setProgress(el.currentTime);
        // If duration was not yet set, take it from active element if finite
        if (isFinite(el.duration) && el.duration > 0) {
          setDuration((prev) => (prev > 0 ? prev : el.duration));
        }
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  };

  const handleDurationChange = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || isSeekingRef.current) return;
    setProgress(el.currentTime);
    if (isFinite(el.duration) && el.duration > 0) {
      setDuration((prev) => (prev > 0 ? prev : el.duration));
    }
  };

  const handleEnded = () => {
    if (isLooping) {
      const el = audioRef.current;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => {});
      }
    } else {
      setIsPlaying(false);
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    }
  };

  const handleError = () => {
    if (!resolvedSrc) return;
    setFailed(true);
    setIsBuffering(false);
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el || failed) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      setIsBuffering(true);
      try {
        window.dispatchEvent(new CustomEvent('antigravity:audio-play', { detail: { src: resolvedSrc } }));
        await el.play();
        setIsPlaying(true);
        if (isFinite(el.duration) && el.duration > 0) {
          setDuration((prev) => (prev > 0 ? prev : el.duration));
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Audio playback error:', err);
        }
      } finally {
        setIsBuffering(false);
      }
    }
  };

  const seek = (value: number) => {
    if (!isFinite(value)) return;
    setProgress(value);
    const el = audioRef.current;
    if (el) {
      el.currentTime = value;
    }
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
      audioRef.current.muted = value === 0;
    }
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (audioRef.current) {
      audioRef.current.playbackRate = value;
    }
  };

  const cycleSpeed = () => changeSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 2 : speed === 2 ? 0.5 : 1);

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

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

  const theme = isDark === undefined ? undefined : isDark ? 'dark' : 'light';

  if (!src) {
    return (
      <div className="cap my-2 flex h-12 w-full max-w-md items-center justify-center rounded-xl border border-(--cp-line) bg-(--cp-bg) text-xs text-(--cp-muted)" data-theme={theme}>
        Loading audio…
      </div>
    );
  }

  const canSeek = isFinite(duration) && duration > 0;
  const pct = canSeek ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const speedLabel = `${speed}×`;

  return (
    <div
      className={`cap nodrag group relative my-2 flex w-full max-w-md ${className}`}
      data-theme={theme}
      contentEditable={false}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={resolvedSrc}
        preload="metadata"
        playsInline
        className="hidden"
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        onWaiting={() => {
          setIsBuffering(true);
        }}
        onPlaying={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onCanPlay={() => {
          setIsBuffering(false);
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />

      <div className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-(--cp-line) bg-(--cp-bg) pl-2 pr-1 text-(--cp-text)">
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
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
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isSeekingRef.current = true;
                }}
                onPointerUp={() => {
                  isSeekingRef.current = false;
                }}
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
          onClick={(e) => {
            e.stopPropagation();
            cycleSpeed();
          }}
          className={`${ICON_BUTTON} w-auto min-w-8 px-1.5 text-[11px] font-semibold tabular-nums ${speed !== 1 ? 'text-(--ap-accent)' : ''}`}
          aria-label={`Playback speed ${speedLabel}`}
          title="Playback speed"
        >
          {speedLabel}
        </button>

        <button
          ref={menuBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className={`${ICON_BUTTON} ${menuOpen ? 'bg-(--cp-hover) text-(--cp-text)' : ''}`}
          aria-label="More audio options"
          aria-expanded={menuOpen}
          title="More options"
        >
          <Ellipsis size={16} />
        </button>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    changeSpeed(s);
                  }}
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
              onClick={(e) => {
                e.stopPropagation();
                toggleLoop();
              }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  changeVolume(volume === 0 ? 1 : 0);
                }}
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
