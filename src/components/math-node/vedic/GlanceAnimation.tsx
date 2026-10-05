/**
 * A short animated example, played with the Web Animations API: each piece of the
 * scene (a box, a group, an arrow, a line of text) gets its own element.animate(),
 * and they all share one timeline, so play, pause, replay and seeking act on all of
 * them together. The browser runs them at the display's frame rate, mostly on the
 * compositor (opacity, translate, scale).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { tr, type Lang } from "./ui";

/** How a piece comes in or is pointed at. */
export type AnimKind =
  | "fadeUp" // appears, rising a little
  | "fade" // appears
  | "pop" // appears, growing with a small overshoot
  | "pulse" // grows and settles back, to point at it
  | "glow" // a brief amber highlight over a box
  | "draw"; // an arrow's line drawing itself

export interface AnimTrack {
  /** The data-anim handle of the element(s) to animate. */
  id: string;
  kind: AnimKind;
  /** When it starts, in ms from the beginning. */
  at: number;
  dur?: number;
}

const DURATION: Record<AnimKind, number> = { fadeUp: 450, fade: 300, pop: 380, pulse: 520, glow: 900, draw: 600 };
const EASING: Record<AnimKind, string> = {
  fadeUp: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  fade: "ease-out",
  pop: "cubic-bezier(0.3, 1.4, 0.5, 1)",
  pulse: "ease-in-out",
  glow: "ease-in-out",
  draw: "cubic-bezier(0.45, 0, 0.2, 1)",
};

/**
 * Keyframes for a kind. They use the separate translate and scale properties, not
 * transform, so a piece can come in and be pulsed without the two fighting, and the
 * Tailwind centring (also translate) on labels is left alone by kinds that don't use it.
 */
function keyframes(kind: AnimKind, el: Element): Keyframe[] {
  switch (kind) {
    case "fadeUp":
      return [
        { opacity: 0, translate: "0 10px" },
        { opacity: 1, translate: "0 0" },
      ];
    case "fade":
      return [{ opacity: 0 }, { opacity: 1 }];
    case "pop":
      return [
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1 },
      ];
    case "pulse":
      return [{ scale: 1 }, { scale: 1.12, offset: 0.45 }, { scale: 1 }];
    case "glow":
      // An inset shadow over the box's own colour: never clipped, nothing to read back.
      return [
        { boxShadow: "inset 0 0 0 999px rgba(251, 191, 36, 0)" },
        { boxShadow: "inset 0 0 0 999px rgba(251, 191, 36, 0.45)", offset: 0.35 },
        { boxShadow: "inset 0 0 0 999px rgba(251, 191, 36, 0)" },
      ];
    case "draw": {
      const length = el instanceof SVGGeometryElement ? el.getTotalLength() : 100;
      (el as SVGElement).style.strokeDasharray = `${length}`;
      // Hidden until it starts: a fully offset dash still shows its round cap as a dot.
      return [
        { strokeDashoffset: length, opacity: 0 },
        { strokeDashoffset: length * 0.97, opacity: 1, offset: 0.03 },
        { strokeDashoffset: 0, opacity: 1 },
      ];
    }
  }
}

interface GlanceAnimationProps {
  tracks: AnimTrack[];
  /** The whole run, in ms. */
  total: number;
  lang: Lang;
  /** The scene: elements carrying the data-anim handles the tracks name. */
  children: React.ReactNode;
}

const fmt = (ms: number) => (ms / 1000).toFixed(1);

export const GlanceAnimation: React.FC<GlanceAnimationProps> = ({ tracks, total, lang, children }) => {
  const t = tr(lang);
  const sceneRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const anims = useRef<Animation[]>([]);
  const playingRef = useRef(false);
  const [playing, setPlayingState] = useState(false);
  const [ready, setReady] = useState(false);

  const setPlaying = (on: boolean) => {
    playingRef.current = on;
    setPlayingState(on);
  };
  const now = () => Number(anims.current[0]?.currentTime ?? 0);
  const showTime = (ms: number) => {
    if (timeRef.current) timeRef.current.textContent = `${fmt(ms)} / ${fmt(total)} s`;
    sliderRef.current?.setAttribute("aria-valuenow", String(Math.round((ms / total) * 100)));
  };

  /** (Re)creates every animation, at `time`, playing or not. */
  const build = useCallback(
    (time: number, play: boolean) => {
      const scene = sceneRef.current;
      if (!scene || !barRef.current || !thumbRef.current) return false;
      anims.current.forEach((a) => a.cancel());
      const list: Animation[] = [];
      // The timeline itself first: it is the clock the others are read against.
      for (const el of [barRef.current, thumbRef.current]) {
        list.push(el.animate([{ translate: "-100% 0" }, { translate: "0 0" }], { duration: total, fill: "both", easing: "linear" }));
      }
      for (const track of tracks) {
        const dur = track.dur ?? DURATION[track.kind];
        scene.querySelectorAll(`[data-anim="${track.id}"]`).forEach((el) => {
          list.push(
            el.animate(keyframes(track.kind, el), {
              delay: track.at,
              duration: dur,
              // Every animation ends with the run, so they stay in step when seeking.
              endDelay: Math.max(0, total - track.at - dur),
              // Highlights leave nothing behind; everything else holds its start and end.
              fill: track.kind === "glow" ? "none" : "both",
              easing: EASING[track.kind],
            }),
          );
        });
      }
      for (const a of list) {
        a.pause();
        a.currentTime = time;
        if (play) a.play();
      }
      list[0].onfinish = () => {
        setPlaying(false);
        showTime(total);
      };
      anims.current = list;
      showTime(time);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, total],
  );

  // Built once the scene is laid out (its arrows are measured a frame after mounting);
  // plays straight away unless the reader prefers less motion.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = () => {
      const missing = tracks.some((tk) => !sceneRef.current?.querySelector(`[data-anim="${tk.id}"]`));
      if (missing && tries++ < 10) {
        raf = requestAnimationFrame(start);
        return;
      }
      if (build(reduce ? total : 0, !reduce)) {
        setPlaying(!reduce);
        setReady(true);
      }
    };
    raf = requestAnimationFrame(start);
    return () => {
      cancelAnimationFrame(raf);
      anims.current.forEach((a) => a.cancel());
      anims.current = [];
    };
  }, [build, total, tracks]);

  // When the scene changes size its arrows are redrawn: rebuild where we were.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    let raf = 0;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      cancelAnimationFrame(raf);
      // Two frames: the boxes re-measure their arrows first.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => build(now(), playingRef.current));
      });
    });
    ro.observe(scene);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, build]);

  // The time readout follows along while playing (the bar animates by itself).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      showTime(now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const seek = (ms: number) => {
    const time = Math.max(0, Math.min(total, ms));
    for (const a of anims.current) a.currentTime = time;
    showTime(time);
  };
  const play = () => {
    if (now() >= total - 1) seek(0);
    anims.current.forEach((a) => a.play());
    setPlaying(true);
  };
  const pause = () => {
    anims.current.forEach((a) => a.pause());
    setPlaying(false);
    showTime(now());
  };
  const replay = () => {
    seek(0);
    anims.current.forEach((a) => a.play());
    setPlaying(true);
  };

  // Click or drag anywhere on the timeline to go there; playing carries on after.
  const onSliderDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const wasPlaying = playingRef.current;
    anims.current.forEach((a) => a.pause());
    const at = (clientX: number) => {
      const r = el.getBoundingClientRect();
      seek(((clientX - r.left) / r.width) * total);
    };
    at(e.clientX);
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => at(ev.clientX);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (wasPlaying && now() < total) anims.current.forEach((a) => a.play());
      else setPlaying(false);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const onSliderKey = (e: React.KeyboardEvent) => {
    const step = total / 20;
    if (e.key === "ArrowRight") seek(now() + step);
    else if (e.key === "ArrowLeft") seek(now() - step);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(total);
    else return;
    e.preventDefault();
  };

  const button =
    "grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden for the frame or two before the animations hold everything at its start. */}
      <div ref={sceneRef} className="overflow-x-auto" style={{ visibility: ready ? "visible" : "hidden" }}>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={playing ? pause : play} aria-label={playing ? t("Pause", "रोको") : t("Play", "चलाओ")} className={button}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" onClick={replay} aria-label={t("Replay", "फिर से")} title={t("Replay", "फिर से")} className={button}>
          <RotateCcw size={14} />
        </button>
        <div
          ref={sliderRef}
          role="slider"
          tabIndex={0}
          aria-label={t("Timeline", "टाइमलाइन")}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={onSliderDown}
          onKeyDown={onSliderKey}
          className="group relative flex h-8 flex-1 cursor-pointer touch-none items-center outline-none"
        >
          <div className="relative h-1.5 w-full rounded-full bg-slate-200 group-focus-visible:ring-2 group-focus-visible:ring-slate-400 dark:bg-slate-800">
            {/* The played part, moved (not stretched) so it stays smooth. */}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div ref={barRef} className="absolute inset-0 rounded-full bg-slate-900 dark:bg-slate-100" style={{ translate: "-100% 0" }} />
            </div>
            {tracks
              .filter((tk) => tk.kind === "fadeUp" && tk.id.startsWith("line"))
              .map((tk) => (
                <span key={tk.id} className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 dark:bg-slate-500" style={{ left: `${(tk.at / total) * 100}%` }} />
              ))}
            <div ref={thumbRef} className="pointer-events-none absolute inset-0" style={{ translate: "-100% 0" }}>
              <span className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-slate-900 bg-white shadow-sm dark:border-slate-100 dark:bg-slate-900" />
            </div>
          </div>
        </div>
        <span ref={timeRef} className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
          0.0 / {fmt(total)} s
        </span>
      </div>
    </div>
  );
};
