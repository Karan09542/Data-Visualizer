import { useMemo, useState } from "react";
import { AlertCircle, CircleDot, Grid3x3, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGame, listGames } from "../games";
import { useLearningStore } from "../store/useLearningStore";
import type { WordSelection } from "../types";
import { ActionButton, EmptyState, SectionLabel, Segmented, formatDuration, useConfirm } from "./primitives";
import { useMediaQuery } from "./hooks";

const GAME_ICONS: Record<string, React.ReactNode> = {
  crossword: <Grid3x3 size={22} />,
  wordwheel: <CircleDot size={22} />,
};

const WHEEL_SIZES = [
  { value: 0, label: "Auto" },
  { value: 8, label: "8" },
  { value: 10, label: "10" },
  { value: 12, label: "12" },
  { value: 15, label: "15" },
];

const SELECTIONS: { value: WordSelection; label: string; description: string }[] = [
  { value: "weakest", label: "Needs practice", description: "Words you know least, and haven't seen in a while" },
  { value: "random", label: "Random", description: "Any words from the set" },
  { value: "newest", label: "Newest", description: "Words you added most recently" },
];


export function CreateGameView() {
  const sets = useLearningStore((s) => s.sets);
  const words = useLearningStore((s) => s.words);
  const prefs = useLearningStore((s) => s.prefs);
  const active = useLearningStore((s) => s.active);
  const store = useLearningStore.getState;
  const confirm = useConfirm();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const games = listGames();
  const game = getGame(prefs.gameType) ?? games[0];
  const setId = prefs.gameSetId && sets.some((s) => s.id === prefs.gameSetId) ? prefs.gameSetId : null;
  const pool = useMemo(() => (setId ? words.filter((w) => w.setId === setId) : words), [words, setId]);
  const eligible = useMemo(() => pool.filter((w) => game.isEligible(w)), [pool, game]);
  const skipped = pool.length - eligible.length;
  const maxCount = Math.min(game.maxWords, eligible.length);
  const sizes = (game.wordCountOptions ?? [4, 6, 8, 12, 16]).filter((n) => n >= game.minWords && n <= game.maxWords);
  const usesWheel = game.id === "wordwheel";
  const count = Math.max(game.minWords, Math.min(prefs.wordCount, maxCount));
  const canPlay = eligible.length >= game.minWords;

  const activeSummary = useMemo(() => {
    if (!active) return null;
    const module = getGame(active.gameType);
    const restored = module?.restore(active.puzzle, active.state);
    return module && restored ? module.summarize(restored.puzzle, restored.state) : null;
  }, [active]);

  const start = async () => {
    if (active) {
      const ok = await confirm({
        title: "Start a new game?",
        message: "Your crossword in progress will be discarded.",
        confirmText: "Start new",
        variant: "warning",
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    // Let the spinner paint before layout generation takes the main thread.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const result = store().startGame({
      gameType: game.id,
      setId,
      wordCount: count,
      selection: prefs.selection,
      // The board sits beside the clue list on wide screens, and above the keyboard on phones.
      hints: { aspect: isDesktop ? 1.15 : 0.8 },
    });
    setBusy(false);
    if (result.ok === false) setError(result.reason);
  };

  const discard = async () => {
    const ok = await confirm({
      title: "Discard this game?",
      message: "Your answers so far will be lost and nothing is added to your history.",
      confirmText: "Discard",
    });
    if (ok) store().discardGame();
  };

  if (words.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <EmptyState
          icon={<Plus size={26} />}
          title="Add words first"
          actions={
            <ActionButton variant="primary" onClick={() => store().setView("words")}>
              Go to My Words
            </ActionButton>
          }
        >
          Games are built from your own vocabulary. Add at least {game.minWords} words with meanings to create one.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
        {active && (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300">In progress</div>
            <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {getGame(active.gameType)?.title} · {active.title}
            </div>
            {activeSummary && (
              <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {activeSummary.done} of {activeSummary.total} words · {formatDuration(activeSummary.elapsedMs)}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <ActionButton variant="primary" onClick={() => store().setView("play")}>
                <Play size={16} fill="currentColor" /> Resume
              </ActionButton>
              <ActionButton variant="ghost" onClick={discard}>
                <Trash2 size={16} /> Discard
              </ActionButton>
            </div>
          </section>
        )}

        <section>
          <SectionLabel className="mb-2.5">Game</SectionLabel>
          <div role="radiogroup" aria-label="Game" className="grid gap-2.5">
            {games.map((g) => {
              const selected = g.id === game.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => store().setPrefs({ gameType: g.id })}
                  className={cn(
                    "flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    selected
                      ? "border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50",
                  )}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
                    {GAME_ICONS[g.id] ?? <Grid3x3 size={22} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">{g.title}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{g.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionLabel className="mb-2.5">Words from</SectionLabel>
          <Segmented
            label="Words from"
            value={setId ?? "__all"}
            onChange={(v) => store().setPrefs({ gameSetId: v === "__all" ? null : v })}
            options={[
              { value: "__all", label: `All words · ${words.length}` },
              ...sets.map((s) => ({ value: s.id, label: `${s.name} · ${words.filter((w) => w.setId === s.id).length}` })),
            ]}
          />
          {skipped > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {skipped} {skipped === 1 ? "word is" : "words are"} left out. {game.ineligibleReason}
            </p>
          )}
        </section>

        {canPlay && (
          <>
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <SectionLabel>{usesWheel ? "Up to how many words" : "How many words"}</SectionLabel>
                <span className="text-xs text-slate-500 dark:text-slate-400">{eligible.length} available</span>
              </div>
              <Segmented
                label="How many words"
                value={count}
                onChange={(n) => store().setPrefs({ wordCount: n })}
                options={[
                  ...sizes.filter((n) => n < maxCount).map((n) => ({ value: n, label: String(n) })),
                  { value: maxCount, label: maxCount === eligible.length && maxCount < game.maxWords ? `All ${maxCount}` : String(maxCount) },
                ]}
              />
            </section>

            {usesWheel && (
              <section>
                <SectionLabel className="mb-2.5">Letters on the wheel</SectionLabel>
                <Segmented
                  label="Letters on the wheel"
                  value={prefs.wheelSize}
                  onChange={(n) => store().setPrefs({ wheelSize: n })}
                  options={WHEEL_SIZES}
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {prefs.wheelSize === 0
                    ? "Auto fits as many of your words as it can, on the smallest wheel that holds them (up to 15 letters)."
                    : "The game picks words from your list that can all be spelled with these letters. A bigger wheel fits more of your words; a smaller one is quicker to scan."}
                </p>
              </section>
            )}

            <section>
              <SectionLabel className="mb-2.5">Focus on</SectionLabel>
              <Segmented
                label="Focus on"
                value={prefs.selection}
                onChange={(v) => store().setPrefs({ selection: v })}
                options={SELECTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {SELECTIONS.find((s) => s.value === prefs.selection)?.description}
              </p>
            </section>
          </>
        )}

        {!canPlay && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            This needs at least {game.minWords} playable words. {game.ineligibleReason}
          </p>
        )}

        {error && (
          <div role="alert" className="flex gap-2.5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0d1117]/90 sm:px-5">
        <ActionButton variant="primary" size="lg" className="w-full" disabled={!canPlay || busy} onClick={start}>
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Building your {game.title.toLowerCase()}…
            </>
          ) : (
            <>Create {game.title.toLowerCase()}</>
          )}
        </ActionButton>
      </div>
    </div>
  );
}
