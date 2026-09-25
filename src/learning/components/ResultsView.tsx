import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, RotateCcw, Trophy } from "lucide-react";
import { getGame } from "../games";
import { MASTERY_LABEL, MAX_MASTERY } from "../services/VocabularyService";
import { useLearningStore } from "../store/useLearningStore";
import type { GameRecord } from "../types";
import { ActionButton, EmptyState, OutcomeBadge, StatTile, formatDate, formatDuration } from "./primitives";
import { useMediaQuery } from "./hooks";

export function useSelectedRecord(): GameRecord | null {
  const history = useLearningStore((s) => s.history);
  const id = useLearningStore((s) => s.selectedRecordId);
  return history.find((r) => r.id === id) ?? history[0] ?? null;
}

const headline = (r: GameRecord) => {
  if (!r.completed) return "Game ended early";
  if (r.score === 100) return "Perfect grid!";
  if (r.score >= 80) return "Great work!";
  if (r.score >= 50) return "Nice progress";
  return "Every round counts";
};

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#6366f1" : "#f59e0b";
  return (
    <div className="relative size-36" role="img" aria-label={`Score ${score} percent`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">{score}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">score</span>
      </div>
    </div>
  );
}

export function MasteryChange({ before, after }: { before: number; after: number }) {
  if (after === before) return <span className="text-xs text-slate-400">{after}/{MAX_MASTERY}</span>;
  const up = after > before;
  const label = after >= MAX_MASTERY ? MASTERY_LABEL.mastered : `${after}/${MAX_MASTERY}`;
  return (
    <span className={up ? "inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400" : "inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400"}>
      {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />} {label}
    </span>
  );
}

export function ResultsView() {
  const record = useSelectedRecord();
  const prefs = useLearningStore((s) => s.prefs);
  const store = useLearningStore.getState;
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!record) {
    return (
      <EmptyState
        icon={<Trophy size={26} />}
        title="No results yet"
        actions={
          <ActionButton variant="primary" onClick={() => store().setView("create")}>
            Create a game
          </ActionButton>
        }
      >
        Finish a game and your score, time and word-by-word results show up here.
      </EmptyState>
    );
  }

  const solved = record.words.filter((w) => w.outcome === "solved" || w.outcome === "assisted").length;

  const playAgain = async () => {
    setBusy(true);
    setError(null);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const result = store().startGame({
      gameType: record.gameType,
      setId: record.setId,
      wordCount: prefs.wordCount,
      selection: prefs.selection,
      title: record.title,
      hints: { aspect: isDesktop ? 1.15 : 0.8 },
    });
    setBusy(false);
    if (result.ok === false) setError(result.reason);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-6 sm:px-5">
        <div className="flex flex-col items-center text-center">
          <ScoreRing score={record.score} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{headline(record)}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {getGame(record.gameType)?.title ?? "Game"} · {record.title} · {formatDate(record.finishedAt)}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label="Time" value={formatDuration(record.durationMs)} />
          <StatTile label="Answered" value={`${solved}/${record.words.length}`} />
          <StatTile label="Hints" value={record.hintsUsed} />
          <StatTile label="Revealed" value={record.revealsUsed} />
        </div>

        <h3 className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Words</h3>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
          {record.words.map((w) => (
            <li key={w.wordId} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-white">{w.word}</span>
                <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{w.meaning}</span>
              </span>
              <MasteryChange before={w.masteryBefore} after={w.masteryAfter} />
              <OutcomeBadge outcome={w.outcome} />
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0d1117]/90 sm:flex-row sm:px-5">
        <ActionButton variant="primary" size="lg" className="flex-1" onClick={() => store().openRecord(record.id, "review")}>
          Review words
        </ActionButton>
        <ActionButton size="lg" className="flex-1" onClick={playAgain} disabled={busy}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />} Play again
        </ActionButton>
      </div>
    </div>
  );
}
