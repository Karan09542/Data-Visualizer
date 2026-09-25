import { memo, useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  activeEntry,
  entryAt,
  type CrosswordEntry,
  type CrosswordPuzzle,
  type CrosswordState,
} from "../../games/crossword/CrosswordGame";

export const clueLength = (e: CrosswordEntry) => `(${e.enumeration || e.cells.length})`;

interface ClueListProps {
  puzzle: CrosswordPuzzle;
  state: CrosswordState;
  onSelect: (entryId: string) => void;
  /** Keep the active clue in view inside this list's own scroll area. */
  autoScroll: boolean;
  className?: string;
}

export const ClueList = memo(function ClueList({ puzzle, state, onSelect, autoScroll, className }: ClueListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const active = activeEntry(puzzle, state);
  const crossing = entryAt(puzzle, state.cursor.cell, state.cursor.direction === "across" ? "down" : "across");

  useEffect(() => {
    // Scroll only this list; scrollIntoView would also move the panel and the board with it.
    const container = containerRef.current;
    const el = active && container?.querySelector<HTMLElement>(`[data-entry="${active.id}"]`);
    if (!autoScroll || !container || !el) return;
    const top = el.offsetTop;
    if (top < container.scrollTop + 8) container.scrollTo({ top: top - 40, behavior: "smooth" });
    else if (top + el.offsetHeight > container.scrollTop + container.clientHeight - 8) {
      container.scrollTo({ top: top + el.offsetHeight - container.clientHeight + 40, behavior: "smooth" });
    }
  }, [active, autoScroll]);

  return (
    <div ref={containerRef} className={cn("relative space-y-5", className)}>
      {(["across", "down"] as const).map((direction) => {
        const list = puzzle.entries.filter((e) => e.direction === direction);
        if (list.length === 0) return null;
        return (
          <section key={direction} aria-label={direction === "across" ? "Across clues" : "Down clues"}>
            <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              {direction === "across" ? "Across" : "Down"}
            </h3>
            <ol className="space-y-0.5">
              {list.map((e) => {
                const solved = state.solved.includes(e.id);
                const isActive = active?.id === e.id;
                const isCrossing = crossing?.id === e.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      data-entry={e.id}
                      aria-current={isActive || undefined}
                      onClick={() => onSelect(e.id)}
                      onMouseDown={(ev) => ev.preventDefault()}
                      className={cn(
                        "flex min-h-11 w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm leading-snug transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        isActive
                          ? "bg-indigo-600 text-white"
                          : isCrossing
                            ? "bg-indigo-50 text-slate-800 dark:bg-indigo-500/10 dark:text-slate-100"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70",
                      )}
                    >
                      <span className={cn("w-6 shrink-0 pt-px text-right text-xs font-bold tabular-nums", isActive ? "text-indigo-100" : "text-slate-400")}>
                        {e.number}
                      </span>
                      <span className={cn("min-w-0 flex-1", solved && !isActive && "text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600")}>
                        {e.clue} <span className={cn("whitespace-nowrap text-xs", isActive ? "text-indigo-100" : "text-slate-400")}>{clueLength(e)}</span>
                      </span>
                      {solved && (
                        <Check size={16} strokeWidth={2.5} className={cn("mt-px shrink-0", isActive ? "text-white" : "text-emerald-500")} aria-label="Solved" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
});

interface ClueBarProps {
  puzzle: CrosswordPuzzle;
  state: CrosswordState;
  onStep: (step: 1 | -1) => void;
  onToggle: () => void;
}

/** The active clue, always in view, with previous and next buttons. */
export function ClueBar({ puzzle, state, onStep, onToggle }: ClueBarProps) {
  const entry = activeEntry(puzzle, state);
  const btn =
    "flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white";
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-indigo-50 p-1 dark:bg-indigo-500/10">
      <button type="button" className={btn} onClick={() => onStep(-1)} onMouseDown={(e) => e.preventDefault()} aria-label="Previous clue">
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={(e) => e.preventDefault()}
        className="min-h-11 min-w-0 flex-1 px-1 py-1.5 text-left"
        aria-label={entry ? `${entry.number} ${entry.direction}: ${entry.clue}. Tap to switch direction.` : "No clue selected"}
      >
        {entry && (
          <span className="flex items-baseline gap-2">
            <span className="shrink-0 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {entry.number}
              {entry.direction === "across" ? "A" : "D"}
            </span>
            <span className="line-clamp-2 text-[15px] font-medium leading-snug text-slate-900 dark:text-white">
              {entry.clue} <span className="whitespace-nowrap text-sm font-normal text-slate-500 dark:text-slate-400">{clueLength(entry)}</span>
            </span>
          </span>
        )}
      </button>
      <button type="button" className={btn} onClick={() => onStep(1)} onMouseDown={(e) => e.preventDefault()} aria-label="Next clue">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
