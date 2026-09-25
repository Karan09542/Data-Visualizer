import React, { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

export type WheelResult = "correct" | "wrong";

interface LetterWheelProps {
  /** The letters around the rim, in display order. Duplicates are separate letters. */
  letters: string[];
  /** Length of the answer being looked for; a tapped word is checked once it gets this long. */
  targetLength: number;
  disabled?: boolean;
  /** Shown in the middle when the wheel is disabled. */
  disabledLabel?: string;
  onSubmit: (word: string) => WheelResult;
  onShuffle: () => void;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/** Letter diameter as a percentage of the wheel, smaller as the ring gets crowded. */
const letterSize = (n: number) => (n <= 5 ? 25 : n <= 7 ? 22 : n <= 9 ? 19 : n <= 12 ? 16 : 13.5);

/**
 * Letters on a circle: swipe across them to spell a word, or tap them one by one. Sliding back
 * onto the previous letter takes it off again. Coordinates are percentages of the wheel, so it
 * scales with whatever width it is given.
 */
export function LetterWheel({ letters, targetLength, disabled, disabledLabel, onSubmit, onShuffle, className }: LetterWheelProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const [path, setPathState] = useState<number[]>([]);
  const pathRef = useRef<number[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [feedback, setFeedback] = useState<WheelResult | null>(null);
  const drag = useRef<{ moved: boolean; removeOnTap: boolean } | null>(null);
  const feedbackTimer = useRef<number | undefined>(undefined);
  /** When the last pointer press happened; the click that follows it must not count again. */
  const lastPointerAt = useRef(0);

  const n = letters.length;
  const size = letterSize(n);
  const radius = 50 - size / 2 - 4;
  // How close a drag must pass to pick a letter up. A straight drag between letters two apart
  // passes the letter between them at radius * (1 - cos(step)); staying under that keeps a
  // direct line from grabbing its neighbour on a crowded ring.
  const dragReach = Math.min(size * 0.42, radius * (1 - Math.cos((2 * Math.PI) / Math.max(n, 3))) * 0.8);
  const centers = letters.map((_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  });

  const setPath = useCallback((next: number[]) => {
    pathRef.current = next;
    setPathState(next);
  }, []);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  const reset = useCallback(() => {
    window.clearTimeout(feedbackTimer.current);
    setFeedback(null);
    setPath([]);
  }, [setPath]);

  const submit = useCallback(
    (indexes: number[]) => {
      if (indexes.length === 0) return;
      const result = onSubmit(indexes.map((i) => letters[i]).join(""));
      setFeedback(result);
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => {
        setFeedback(null);
        setPath([]);
      }, result === "correct" ? 550 : 480);
    },
    [letters, onSubmit, setPath],
  );

  const toLocal = (e: React.PointerEvent): Point => {
    const rect = discRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
  };

  const hit = (p: Point, reach: number) => {
    let best = -1;
    let bestDistance = reach;
    centers.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    return best;
  };

  /** Adds a letter, or takes the last one off when it is tapped again. */
  const tapLetter = (i: number) => {
    if (disabled) return;
    if (feedback) reset();
    const current = feedback ? [] : pathRef.current;
    if (current[current.length - 1] === i) return setPath(current.slice(0, -1));
    if (current.includes(i)) return;
    const next = [...current, i];
    setPath(next);
    if (next.length >= targetLength) submit(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerAt.current = performance.now();
    if (disabled || e.button > 0) return;
    const p = toLocal(e);
    const i = hit(p, size * 0.62);
    if (i < 0) return;
    e.preventDefault();
    discRef.current?.setPointerCapture(e.pointerId);
    if (feedback) reset();
    const current = feedback ? [] : pathRef.current;
    const isLast = current[current.length - 1] === i;
    drag.current = { moved: false, removeOnTap: isLast };
    if (!current.includes(i)) setPath([...current, i]);
    setPointer(p);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const p = toLocal(e);
    setPointer(p);
    const i = hit(p, dragReach);
    if (i < 0) return;
    const current = pathRef.current;
    if (!current.includes(i)) {
      setPath([...current, i]);
      drag.current.moved = true;
    } else if (current.length > 1 && i === current[current.length - 2]) {
      setPath(current.slice(0, -1));
      drag.current.moved = true;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPointer(null);
    if (!d) return;
    const current = pathRef.current;
    if (d.moved) submit(current);
    else if (d.removeOnTap) setPath(current.slice(0, -1));
    else if (current.length >= targetLength) submit(current);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setPointer(null);
  };

  const word = path.map((i) => letters[i]).join("");
  const line = [...path.map((i) => centers[i]), ...(pointer && path.length ? [pointer] : [])];
  const inner = 100 - 2 * size - 12;

  const sideButton =
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white";

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <button type="button" className={sideButton} onClick={() => { reset(); onShuffle(); }} disabled={disabled} aria-label="Shuffle letters" title="Shuffle letters">
        <Shuffle size={18} />
      </button>

      <div
        ref={discRef}
        role="group"
        aria-label="Letter wheel. Swipe across the letters, or tap them in order, to spell the answer."
        className={cn(
          "lg-wheel relative aspect-square min-w-0 flex-1 rounded-full bg-white shadow-[0_8px_30px_rgb(15_23_42/0.10)] ring-1 ring-slate-200 dark:bg-slate-800/80 dark:shadow-none dark:ring-slate-700",
          disabled && "opacity-60",
          feedback === "wrong" && "lg-wheel-shake",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {line.length > 1 && (
            <polyline
              points={line.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              strokeWidth={size * 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "transition-colors",
                feedback === "correct" ? "stroke-emerald-500" : feedback === "wrong" ? "stroke-rose-500" : "stroke-indigo-500",
              )}
              opacity={0.85}
            />
          )}
        </svg>

        <div
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center"
          style={{ width: `${inner}%` }}
        >
          {disabled ? (
            <span className="text-[6.5cqw] font-semibold text-emerald-600 dark:text-emerald-400">{disabledLabel}</span>
          ) : word ? (
            <span
              className={cn(
                "rounded-full px-[4cqw] py-[1.5cqw] font-bold tracking-[0.08em] text-white shadow-sm transition-colors",
                feedback === "correct" ? "lg-pop bg-emerald-500" : feedback === "wrong" ? "bg-rose-500" : "bg-indigo-600",
              )}
              style={{ fontSize: `${Math.min(8, (inner * 1.35) / Math.max(word.length, 3))}cqw` }}
            >
              {word}
            </span>
          ) : (
            <span className="text-[6cqw] font-medium text-slate-400 dark:text-slate-500">{targetLength} letters</span>
          )}
        </div>

        {letters.map((letter, i) => {
          const selected = path.includes(i);
          return (
            <button
              key={i}
              type="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Letter ${letter}`}
              aria-pressed={selected}
              // Pointer input is handled on the wheel. A click right after a press is that same
              // press; only keyboard activation (Enter or Space) gets through here.
              onClick={() => performance.now() - lastPointerAt.current > 800 && tapLetter(i)}
              className={cn(
                "absolute flex items-center justify-center rounded-full font-bold uppercase transition-[background-color,color,transform] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800",
                selected
                  ? cn("scale-105 text-white shadow-md", feedback === "correct" ? "bg-emerald-500" : feedback === "wrong" ? "bg-rose-500" : "bg-indigo-600")
                  : "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700",
              )}
              style={{
                left: `${centers[i].x - size / 2}%`,
                top: `${centers[i].y - size / 2}%`,
                width: `${size}%`,
                height: `${size}%`,
                fontSize: `${size * 0.52}cqw`,
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={sideButton}
        onClick={() => setPath(pathRef.current.slice(0, -1))}
        disabled={disabled || path.length === 0}
        aria-label="Remove last letter"
        title="Remove last letter"
      >
        <Delete size={18} />
      </button>
    </div>
  );
}
