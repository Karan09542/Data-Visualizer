import { useMemo, useState } from "react";
import { ChevronRight, History, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGame } from "../games";
import { enumeration } from "../services/VocabularyService";
import { useLearningStore } from "../store/useLearningStore";
import { ActionButton, EmptyState, MasteryMeter, OutcomeBadge, SectionLabel, Segmented, formatDate } from "./primitives";
import { MasteryChange, useSelectedRecord } from "./ResultsView";
import { useMediaQuery } from "./hooks";

type Filter = "all" | "work";

export function ReviewView() {
  const record = useSelectedRecord();
  const history = useLearningStore((s) => s.history);
  const words = useLearningStore((s) => s.words);
  const progress = useLearningStore((s) => s.progress);
  const store = useLearningStore.getState;
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(words.map((w) => w.id)), [words]);
  const needsWork = useMemo(() => record?.words.filter((w) => w.outcome !== "solved") ?? [], [record]);
  const shown = filter === "work" ? needsWork : record?.words ?? [];

  if (!record) {
    return (
      <EmptyState
        icon={<History size={26} />}
        title="Nothing to review yet"
        actions={
          <ActionButton variant="primary" onClick={() => store().setView("create")}>
            Create a game
          </ActionButton>
        }
      >
        After each game, the words you played are collected here with their meanings and examples.
      </EmptyState>
    );
  }

  const module = getGame(record.gameType);
  // Practice the words that were not answered unaided; if there are too few, the whole game.
  const practiceSource = needsWork.length >= (module?.minWords ?? 2) ? needsWork : record.words;
  const practiceIds = practiceSource.map((w) => w.wordId).filter((id) => existing.has(id));
  const canPractice = !!module && practiceIds.length >= module.minWords;

  const practice = async () => {
    if (!module) return;
    setBusy(true);
    setError(null);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const result = store().startGame({
      gameType: record.gameType,
      setId: record.setId,
      wordIds: practiceIds,
      wordCount: practiceIds.length,
      selection: "weakest",
      title: `Practice · ${record.title}`,
      hints: { aspect: isDesktop ? 1.15 : 0.8 },
    });
    setBusy(false);
    if (result.ok === false) setError(result.reason);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{record.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {module?.title ?? "Game"} · {formatDate(record.finishedAt)} · score {record.score}
          </p>
        </div>

        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          className="mb-4"
          options={[
            { value: "all", label: `All words · ${record.words.length}` },
            { value: "work", label: `Needs work · ${needsWork.length}`, disabled: needsWork.length === 0 },
          ]}
        />

        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Every word was answered without help. Nice.</p>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((w) => {
              const enumText = enumeration(w.word);
              return (
                <li key={w.wordId} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{w.word}</span>
                        {enumText && <span className="text-xs text-slate-400">({enumText})</span>}
                      </div>
                      <p className="mt-0.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{w.meaning}</p>
                    </div>
                    <OutcomeBadge outcome={w.outcome} />
                  </div>
                  {w.example && (
                    <p className="mt-2.5 border-l-2 border-indigo-200 pl-3 text-sm italic leading-relaxed text-slate-600 dark:border-indigo-500/40 dark:text-slate-400">
                      {w.example}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {existing.has(w.wordId) ? (
                      <>
                        <MasteryMeter progress={progress[w.wordId]} />
                        <MasteryChange before={w.masteryBefore} after={w.masteryAfter} />
                      </>
                    ) : (
                      <span>Deleted from your words</span>
                    )}
                    {w.mistakes > 0 && (
                      <span>
                        {w.mistakes} wrong {w.mistakes === 1 ? "try" : "tries"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        )}

        {history.length > 1 && (
          <section className="mt-8">
            <SectionLabel className="mb-2">Recent games</SectionLabel>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
              {history.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      store().openRecord(r.id, "review");
                      setFilter("all");
                    }}
                    aria-current={r.id === record.id || undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                      r.id === record.id && "bg-indigo-50/60 dark:bg-indigo-500/10",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(r.finishedAt)} · {r.words.length} words
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.score}</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0d1117]/90 sm:px-5">
        <ActionButton variant="primary" size="lg" className="w-full" onClick={practice} disabled={!canPractice || busy}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Target size={17} />}
          {practiceSource === needsWork ? `Practice ${practiceIds.length} weak words` : "Practice these words again"}
        </ActionButton>
      </div>
    </div>
  );
}
