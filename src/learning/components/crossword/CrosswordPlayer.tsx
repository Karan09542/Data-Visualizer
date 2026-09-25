import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Flag, Lightbulb, PartyPopper, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  activeEntry,
  reduce,
  restore,
  type CrosswordAction,
  type CrosswordPuzzle,
  type CrosswordState,
} from "../../games/crossword/CrosswordGame";
import type { GamePlayerProps } from "../PlayView";
import { useGameClock, useMediaQuery, useTransient } from "../hooks";
import { ActionButton, EmptyState, formatDuration, useConfirm } from "../primitives";
import { CrosswordBoard, type BoardFlash } from "./CrosswordBoard";
import { ClueBar, ClueList, clueLength } from "./ClueList";
import { LetterKeyboard } from "./LetterKeyboard";

const CONFETTI_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9"];

export function CrosswordPlayer(props: GamePlayerProps) {
  const initial = useMemo(() => restore(props.game.puzzle, props.game.state), [props.game.id]);
  if (!initial) {
    return (
      <EmptyState
        icon={<Flag size={24} />}
        title="This game can't be resumed"
        actions={
          <ActionButton variant="primary" onClick={props.onDiscard}>
            Start a new game
          </ActionButton>
        }
      >
        The saved puzzle is from an older version or was damaged.
      </EmptyState>
    );
  }
  return <Player {...props} puzzle={initial.puzzle} initialState={initial.state} />;
}

function Player({
  game,
  puzzle,
  initialState,
  onSave,
  onFinish,
  onContinue,
}: GamePlayerProps & { puzzle: CrosswordPuzzle; initialState: CrosswordState }) {
  const confirm = useConfirm();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const touch = useMediaQuery("(pointer: coarse)");
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const clock = useGameClock(state.status === "playing");
  const [flash, showFlash] = useTransient<BoardFlash>(700);
  const [announcement, setAnnouncement] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const entry = activeEntry(puzzle, state);
  const solvedCount = state.solved.length;
  const total = puzzle.entries.length;

  const extraLetters = useMemo(
    () => [...new Set(puzzle.solution.filter((l): l is string => !!l && !/^[A-Z]$/.test(l)))].sort(),
    [puzzle],
  );

  const dispatch = useCallback(
    (action: CrosswordAction) => {
      const base = { ...stateRef.current, elapsedMs: stateRef.current.elapsedMs + clock.take() };
      const { state: next, events } = reduce(puzzle, base, action);
      stateRef.current = next;
      setState(next);
      onSave(next);

      for (const event of events) {
        const e = "entryId" in event ? puzzle.entries.find((x) => x.id === event.entryId) : null;
        if (event.type === "correct" && e) {
          showFlash({ entryId: e.id, kind: "correct" });
          setAnnouncement(`Correct: ${e.word}.`);
        } else if (event.type === "wrong" && e) {
          showFlash({ entryId: e.id, kind: "wrong" });
          setAnnouncement(`${e.number} ${e.direction} is not quite right. Check the highlighted letters.`);
        } else if (event.type === "revealed" && e) {
          setAnnouncement(`Revealed: ${e.word}.`);
        } else if (event.type === "complete") {
          setCelebrating(true);
          setAnnouncement("Crossword complete!");
          onFinish(next);
        }
      }
      return next;
    },
    [puzzle, clock, onSave, onFinish, showFlash],
  );

  // Bank the time played when leaving the game (closing the panel, switching views).
  useEffect(
    () => () => {
      if (stateRef.current.status === "playing") {
        const ms = clock.take();
        if (ms > 0) onSave({ ...stateRef.current, elapsedMs: stateRef.current.elapsedMs + ms });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  // Keep the cursor visible when the board is taller than the screen.
  useEffect(() => {
    document.getElementById(`lg-cell-${state.cursor.cell}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [state.cursor.cell]);

  useEffect(() => {
    if (entry && !celebrating) setAnnouncement(`${entry.number} ${entry.direction}: ${entry.clue}, ${clueLength(entry).slice(1, -1)} letters.`);
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.nativeEvent.isComposing) return;
      const arrows: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      let action: CrosswordAction | null = null;
      if (arrows[e.key]) action = { type: "move", dRow: arrows[e.key][0], dCol: arrows[e.key][1] };
      else if (e.key === "Backspace") action = { type: "backspace" };
      else if (e.key === "Delete") action = { type: "delete" };
      // Tab is left alone so keyboard users can move on to the buttons and clue list.
      else if (e.key === "Enter") action = { type: "nextEntry", step: e.shiftKey ? -1 : 1 };
      else if (e.key === " ") action = { type: "toggleDirection" };
      else if ([...e.key].length === 1 && /\p{L}/u.test(e.key)) action = { type: "input", letter: e.key };
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    },
    [dispatch],
  );

  const select = useCallback((cell: number) => {
    dispatch({ type: "select", cell });
    boardRef.current?.focus({ preventScroll: true });
  }, [dispatch]);
  const selectEntry = useCallback((entryId: string) => {
    dispatch({ type: "selectEntry", entryId });
    boardRef.current?.focus({ preventScroll: true });
  }, [dispatch]);
  const letter = useCallback((l: string) => dispatch({ type: "input", letter: l }), [dispatch]);
  const backspace = useCallback(() => dispatch({ type: "backspace" }), [dispatch]);
  const toggle = useCallback(() => dispatch({ type: "toggleDirection" }), [dispatch]);
  const step = useCallback((s: 1 | -1) => dispatch({ type: "nextEntry", step: s }), [dispatch]);

  const endGame = async () => {
    const left = total - solvedCount;
    const ok = await confirm({
      title: "End this game?",
      message: `${left} unanswered ${left === 1 ? "word counts" : "words count"} as missed. You can review ${left === 1 ? "it" : "them"} afterwards.`,
      confirmText: "End game",
      variant: "warning",
    });
    if (!ok) return;
    const next = dispatch({ type: "end" });
    onFinish(next);
    onContinue();
  };

  const playing = state.status === "playing";
  const elapsed = state.elapsedMs + clock.peek();
  const percent = total ? Math.round((solvedCount / total) * 100) : 0;

  const header = (
    <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{game.title}</h2>
            <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {solvedCount}/{total} words
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-label="Words solved"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={solvedCount}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400" aria-label={`Time ${formatDuration(elapsed)}`}>
          <Timer size={15} /> {formatDuration(elapsed)}
        </span>
      </div>
      {playing && (
        <div className="mt-3 flex gap-2">
          <ActionButton className="flex-1 sm:flex-none" onClick={() => dispatch({ type: "hint" })} title="Fill in one letter">
            <Lightbulb size={16} /> Hint
          </ActionButton>
          <ActionButton className="flex-1 sm:flex-none" onClick={() => dispatch({ type: "revealEntry" })} disabled={!entry || state.solved.includes(entry.id)} title="Show the whole word">
            <Eye size={16} />
            <span>
              Reveal<span className="hidden sm:inline"> word</span>
            </span>
          </ActionButton>
          <ActionButton variant="ghost" className="flex-1 sm:ml-auto sm:flex-none" onClick={endGame}>
            <Flag size={16} /> End
          </ActionButton>
        </div>
      )}
    </div>
  );

  const board = (
    // Full width on purpose: the board measures itself against this box (container queries),
    // so a shrink-to-fit wrapper would collapse it.
    <div className="relative w-full">
      <CrosswordBoard
        puzzle={puzzle}
        state={state}
        flash={flash}
        celebrating={celebrating}
        maxHeight={isDesktop ? "calc(100dvh - 330px)" : undefined}
        onSelect={select}
        onKeyDown={onKeyDown}
        boardRef={boardRef}
      />
      {celebrating && <Celebration elapsedMs={state.elapsedMs} total={total} onContinue={onContinue} />}
    </div>
  );

  const keyboard = touch && playing && (
    <LetterKeyboard extraLetters={extraLetters} onLetter={letter} onBackspace={backspace} onToggleDirection={toggle} />
  );

  const clueBar = !celebrating && <ClueBar puzzle={puzzle} state={state} onStep={step} onToggle={toggle} />;

  return (
    <div className="flex h-full flex-col">
      {header}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {game.leftOut.length > 0 && playing && solvedCount === 0 && (
        <p className="mx-4 mt-3 rounded-xl bg-amber-50 px-3.5 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 sm:mx-5">
          {game.leftOut.length === 1 ? `“${game.leftOut[0]}” didn't fit` : `${game.leftOut.length} words didn't fit`} in this grid. Try it in another game.
        </p>
      )}

      {isDesktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(15rem,1fr)] gap-5 p-5">
          <div className="flex min-h-0 flex-col gap-4">
            {clueBar}
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">{board}</div>
            {keyboard}
            {!touch && playing && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Type to fill · Arrows move · Space switches direction · Enter goes to the next clue
              </p>
            )}
          </div>
          <ClueList puzzle={puzzle} state={state} onSelect={selectEntry} autoScroll className="min-h-0 overflow-y-auto overscroll-contain pr-1" />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
            {board}
            <ClueList puzzle={puzzle} state={state} onSelect={selectEntry} autoScroll={false} className="mt-6" />
          </div>
          {(clueBar || keyboard) && (
            <div className={cn("space-y-2 border-t border-slate-200 bg-white px-3 pt-2 dark:border-slate-800 dark:bg-[#0d1117]", "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
              {clueBar}
              {keyboard}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Celebration({ elapsedMs, total, onContinue }: { elapsedMs: number; total: number; onContinue: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${(i % 12) * 0.06}s`,
        t: `${1.4 + ((i * 7) % 10) / 10}s`,
        dx: `${((i * 53) % 120) - 60}px`,
        r: `${((i * 71) % 2 ? 1 : -1) * (180 + ((i * 37) % 360))}deg`,
      })),
    [],
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => buttonRef.current?.focus({ preventScroll: true }), 700);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="lg-confetti" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{ left: p.left, background: p.color, "--delay": p.delay, "--t": p.t, "--dx": p.dx, "--r": p.r } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="lg-card-in relative mx-4 w-full max-w-xs rounded-3xl border border-white/60 bg-white/90 p-6 text-center shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
          <PartyPopper size={26} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Crossword complete!</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {total} words in {formatDuration(elapsedMs)}
        </p>
        <ActionButton ref={buttonRef} variant="primary" className="mt-5 w-full" onClick={onContinue}>
          See results
        </ActionButton>
      </div>
    </div>
  );
}
