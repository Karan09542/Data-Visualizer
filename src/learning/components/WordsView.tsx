import { useMemo, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ClipboardList,
  FolderInput,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearningStore } from "../store/useLearningStore";
import { dayStreak, enumeration, vocabularyStats } from "../services/VocabularyService";
import type { Id, VocabWord, WordProgress, WordSet } from "../types";
import { BulkImport } from "./BulkImport";
import { WordForm } from "./WordForm";
import {
  ActionButton,
  EmptyState,
  MasteryMeter,
  SectionLabel,
  StatTile,
  inputClass,
  useConfirm,
} from "./primitives";

type Mode = "list" | "add" | "import";

export function WordsView() {
  const sets = useLearningStore((s) => s.sets);
  const words = useLearningStore((s) => s.words);
  const progress = useLearningStore((s) => s.progress);
  const history = useLearningStore((s) => s.history);
  const prefs = useLearningStore((s) => s.prefs);
  const active = useLearningStore((s) => s.active);
  const store = useLearningStore.getState;
  const confirm = useConfirm();

  const [mode, setMode] = useState<Mode>("list");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Id | null>(null);
  const [editing, setEditing] = useState<Id | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [setForm, setSetForm] = useState<{ mode: "create" | "rename"; value: string; error?: string } | null>(null);

  const activeSetId = prefs.activeSetId && sets.some((s) => s.id === prefs.activeSetId) ? prefs.activeSetId : null;
  const activeSet = sets.find((s) => s.id === activeSetId) ?? null;
  const [formSetId, setFormSetId] = useState<Id>(activeSetId ?? sets[0]?.id);
  const targetSetId = activeSetId ?? (sets.some((s) => s.id === formSetId) ? formSetId : sets[0]?.id);

  const counts = useMemo(() => {
    const map = new Map<Id, number>();
    words.forEach((w) => map.set(w.setId, (map.get(w.setId) ?? 0) + 1));
    return map;
  }, [words]);

  const scoped = useMemo(() => (activeSetId ? words.filter((w) => w.setId === activeSetId) : words), [words, activeSetId]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return scoped;
    return scoped.filter((w) => w.word.toLocaleLowerCase().includes(q) || w.meaning.toLocaleLowerCase().includes(q));
  }, [scoped, query]);

  const stats = useMemo(() => vocabularyStats(scoped, progress), [scoped, progress]);
  const streak = useMemo(() => dayStreak(history), [history]);

  const chooseSet = (id: Id | null) => {
    store().setPrefs({ activeSetId: id });
    setSelected(new Set());
    setExpanded(null);
    setEditing(null);
    setSetForm(null);
  };

  const submitSetForm = () => {
    if (!setForm) return;
    if (setForm.mode === "create") {
      const result = store().createSet(setForm.value);
      if (result.ok === false) return setSetForm({ ...setForm, error: result.error });
      chooseSet(result.set.id);
      store().notify(`Created “${result.set.name}”.`, "success");
    } else if (activeSet) {
      const error = store().renameSet(activeSet.id, setForm.value);
      if (error) return setSetForm({ ...setForm, error });
    }
    setSetForm(null);
  };

  const removeSet = async (set: WordSet) => {
    const n = counts.get(set.id) ?? 0;
    const ok = await confirm({
      title: `Delete “${set.name}”?`,
      message: n ? `This also deletes its ${n} ${n === 1 ? "word" : "words"} and their progress. Past games stay in your history.` : "The set is empty.",
      confirmText: "Delete set",
    });
    if (!ok) return;
    store().deleteSet(set.id);
    chooseSet(null);
    store().notify(`Deleted “${set.name}”.`);
  };

  const removeWords = async (ids: Id[]) => {
    const one = ids.length === 1 ? words.find((w) => w.id === ids[0]) : null;
    const ok = await confirm({
      title: one ? `Delete “${one.word}”?` : `Delete ${ids.length} words?`,
      message: "Their progress is removed too. Past games stay in your history.",
      confirmText: "Delete",
    });
    if (!ok) return;
    store().deleteWords(ids);
    setSelected(new Set());
    setSelecting(false);
    setExpanded(null);
    store().notify(one ? `Deleted “${one.word}”.` : `Deleted ${ids.length} words.`);
  };

  const moveSelected = (setId: Id) => {
    const ids = [...selected];
    const moved = store().moveWords(ids, setId);
    const name = sets.find((s) => s.id === setId)?.name ?? "set";
    const skipped = ids.length - moved;
    store().notify(
      `Moved ${moved} ${moved === 1 ? "word" : "words"} to “${name}”.` + (skipped ? ` ${skipped} already there or unchanged.` : ""),
      moved ? "success" : "info",
    );
    setSelected(new Set());
    setSelecting(false);
  };

  const toggleSelected = (id: Id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasWords = words.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
        {active && (
          <button
            type="button"
            onClick={() => store().setView("play")}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-3.5 text-left text-white shadow-lg shadow-indigo-600/20 transition-transform hover:-translate-y-px"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
              <Play size={18} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Continue your crossword</span>
              <span className="block truncate text-xs text-indigo-100">{active.title}</span>
            </span>
            <span className="text-sm font-semibold">Resume</span>
          </button>
        )}

        {hasWords && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile label={activeSet ? "Words in set" : "Words"} value={stats.total} />
            <StatTile label="Mastered" value={stats.mastered} hint="Words at full mastery" />
            <StatTile label="Day streak" value={streak} hint="Days in a row with a finished game" />
            <StatTile label="Accuracy" value={stats.accuracy === null ? "–" : `${stats.accuracy}%`} hint="Correct answers across all games" />
          </div>
        )}

        {/* Sets */}
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Word sets</SectionLabel>
        </div>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-5 sm:px-5" role="tablist" aria-label="Word sets">
          <SetChip label="All" count={words.length} selected={!activeSetId} onClick={() => chooseSet(null)} />
          {sets.map((s) => (
            <SetChip key={s.id} label={s.name} count={counts.get(s.id) ?? 0} selected={s.id === activeSetId} onClick={() => chooseSet(s.id)} />
          ))}
          <button
            type="button"
            onClick={() => setSetForm({ mode: "create", value: "" })}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3.5 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
          >
            <Plus size={15} /> New set
          </button>
        </div>

        {setForm && (
          <form
            className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
            onSubmit={(e) => {
              e.preventDefault();
              submitSetForm();
            }}
          >
            <label htmlFor="lg-set-name" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {setForm.mode === "create" ? "New set name" : "Rename set"}
            </label>
            <div className="flex gap-2">
              <input
                id="lg-set-name"
                autoFocus
                value={setForm.value}
                maxLength={40}
                onChange={(e) => setSetForm({ ...setForm, value: e.target.value, error: undefined })}
                placeholder="e.g. GRE words, Spanish verbs"
                className={inputClass}
                aria-invalid={!!setForm.error}
              />
              <ActionButton type="submit" variant="primary">
                Save
              </ActionButton>
              <ActionButton size="icon" variant="ghost" aria-label="Cancel" onClick={() => setSetForm(null)}>
                <X size={18} />
              </ActionButton>
            </div>
            {setForm.error && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{setForm.error}</p>}
          </form>
        )}

        {activeSet && !setForm && (
          <div className="mb-4 flex items-center gap-1">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{activeSet.name}</h2>
            <ActionButton size="icon" variant="ghost" aria-label={`Rename ${activeSet.name}`} title="Rename set" onClick={() => setSetForm({ mode: "rename", value: activeSet.name })}>
              <Pencil size={16} />
            </ActionButton>
            <ActionButton size="icon" variant="ghost" aria-label={`Delete ${activeSet.name}`} title="Delete set" onClick={() => removeSet(activeSet)}>
              <Trash2 size={16} />
            </ActionButton>
          </div>
        )}

        {/* Toolbar */}
        {mode === "list" && hasWords && (
          <div className="mb-3 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search words"
                aria-label="Search words"
                className={`${inputClass} pl-10`}
              />
            </div>
            {!selecting && (
              <>
                <ActionButton variant="primary" onClick={() => setMode("add")} className="px-3.5">
                  <Plus size={17} /> <span className="hidden sm:inline">Add</span>
                </ActionButton>
                <ActionButton size="icon" variant="secondary" title="Paste a list" aria-label="Paste a list" onClick={() => setMode("import")}>
                  <ClipboardList size={17} />
                </ActionButton>
              </>
            )}
            <ActionButton
              size="icon"
              variant={selecting ? "primary" : "secondary"}
              title={selecting ? "Done selecting" : "Select words"}
              aria-label={selecting ? "Done selecting" : "Select words"}
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelected(new Set());
                setEditing(null);
              }}
            >
              {selecting ? <Check size={17} /> : <ListChecks size={17} />}
            </ActionButton>
          </div>
        )}

        {mode === "add" && (
          <Card title="Add a word" onClose={() => setMode("list")}>
            <WordForm
              submitLabel="Add word"
              cancelLabel="Done"
              keepOpen
              sets={activeSetId ? undefined : sets}
              setId={targetSetId}
              onSetChange={setFormSetId}
              onSubmit={(input) => store().addWord(input, targetSetId)}
              onCancel={() => setMode("list")}
            />
          </Card>
        )}

        {mode === "import" && (
          <Card title="Paste a list" onClose={() => setMode("list")}>
            <BulkImport
              sets={sets}
              setId={targetSetId}
              onCancel={() => setMode("list")}
              onImport={(setId, inputs) => {
                const { added, skipped } = store().importWords(inputs, setId);
                store().notify(
                  `Added ${added} ${added === 1 ? "word" : "words"}` + (skipped ? `, skipped ${skipped} already in the set` : "") + ".",
                  added ? "success" : "info",
                );
                if (added) setMode("list");
              }}
            />
          </Card>
        )}

        {/* Words */}
        {!hasWords && mode === "list" ? (
          <EmptyState
            icon={<BookOpenText size={26} />}
            title="Build your word list"
            actions={
              <>
                <ActionButton variant="primary" onClick={() => setMode("add")}>
                  <Plus size={17} /> Add a word
                </ActionButton>
                <ActionButton onClick={() => setMode("import")}>
                  <ClipboardList size={17} /> Paste a list
                </ActionButton>
                <ActionButton variant="ghost" onClick={() => store().addStarterWords()}>
                  <Sparkles size={17} /> Try starter words
                </ActionButton>
              </>
            }
          >
            Add words with their meanings and an example. Meanings become clues when you play.
          </EmptyState>
        ) : scoped.length === 0 && mode === "list" ? (
          <EmptyState
            icon={<BookOpenText size={26} />}
            title="This set is empty"
            actions={
              <ActionButton variant="primary" onClick={() => setMode("add")}>
                <Plus size={17} /> Add a word
              </ActionButton>
            }
          />
        ) : visible.length === 0 && query ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No words match “{query}”.</p>
        ) : (
          <ul className="space-y-2" aria-label="Words">
            {visible.map((w) => (
              <WordRow
                key={w.id}
                word={w}
                progress={progress[w.id]}
                setName={activeSetId ? null : sets.find((s) => s.id === w.setId)?.name ?? null}
                expanded={expanded === w.id}
                editing={editing === w.id}
                selecting={selecting}
                selected={selected.has(w.id)}
                onToggle={() => (selecting ? toggleSelected(w.id) : setExpanded(expanded === w.id ? null : w.id))}
                onEdit={() => setEditing(w.id)}
                onCancelEdit={() => setEditing(null)}
                onSave={(input) => {
                  const result = store().editWord(w.id, input);
                  if (result.ok) setEditing(null);
                  return result;
                }}
                onDelete={() => removeWords([w.id])}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {selecting ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0d1117]/90 sm:px-5">
          <span className="mr-auto text-sm font-semibold text-slate-700 dark:text-slate-200" role="status">
            {selected.size} selected
          </span>
          <ActionButton
            variant="ghost"
            onClick={() => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((w) => w.id)))}
          >
            {selected.size === visible.length && visible.length > 0 ? "Clear" : "Select all"}
          </ActionButton>
          {sets.length > 1 && (
            <label className="relative">
              <span className="sr-only">Move selected words to set</span>
              <FolderInput size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value=""
                disabled={selected.size === 0}
                onChange={(e) => e.target.value && moveSelected(e.target.value)}
                className="min-h-11 appearance-none rounded-xl bg-slate-100 pl-9 pr-4 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Move to…</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ActionButton variant="danger" disabled={selected.size === 0} onClick={() => removeWords([...selected])}>
            <Trash2 size={16} /> Delete
          </ActionButton>
        </div>
      ) : (
        hasWords && (
          <div className="border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0d1117]/90 sm:px-5">
            <ActionButton variant="primary" size="lg" className="w-full" onClick={() => store().setView("create")}>
              Create a game <span aria-hidden>→</span>
            </ActionButton>
          </div>
        )
      )}
    </div>
  );
}

function SetChip({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-10 max-w-[14rem] shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        selected
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("text-xs tabular-nums", selected ? "opacity-70" : "text-slate-500 dark:text-slate-400")}>{count}</span>
    </button>
  );
}

function Card({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60" aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </section>
  );
}

interface WordRowProps {
  word: VocabWord;
  progress: WordProgress | undefined;
  setName: string | null;
  expanded: boolean;
  editing: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: React.ComponentProps<typeof WordForm>["onSubmit"];
  onDelete: () => void;
}

function WordRow({ word, progress, setName, expanded, editing, selecting, selected, onToggle, onEdit, onCancelEdit, onSave, onDelete }: WordRowProps) {
  const enumText = enumeration(word.word);

  if (editing) {
    return (
      <li className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-500/40 dark:bg-slate-900/60">
        <WordForm
          initial={{ word: word.word, meaning: word.meaning, example: word.example }}
          submitLabel="Save"
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-2xl border bg-white transition-colors dark:bg-slate-900/40",
        selected ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-400/60 dark:bg-indigo-500/10" : "border-slate-200/80 dark:border-slate-800",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={selecting ? undefined : expanded}
        aria-pressed={selecting ? selected : undefined}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        {selecting && (
          <span
            aria-hidden
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-600",
            )}
          >
            {selected && <Check size={13} strokeWidth={3} />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{word.word}</span>
            {enumText && <span className="shrink-0 text-xs text-slate-400">({enumText})</span>}
          </span>
          <span className={cn("block text-sm text-slate-500 dark:text-slate-400", !expanded && "truncate")}>{word.meaning}</span>
        </span>
        <MasteryMeter progress={progress} className="shrink-0" />
        {!selecting && (
          <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
        )}
      </button>

      {expanded && !selecting && (
        <div className="px-4 pb-3.5">
          {word.example && (
            <p className="mb-3 border-l-2 border-indigo-200 pl-3 text-sm italic leading-relaxed text-slate-600 dark:border-indigo-500/40 dark:text-slate-300">
              {word.example}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {setName && <span>In {setName}</span>}
            {progress && progress.attempts > 0 ? (
              <>
                <span>
                  {progress.correct} of {progress.attempts} correct
                </span>
                <span>Streak {progress.streak}</span>
              </>
            ) : (
              <span>Not practiced yet</span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <ActionButton variant="secondary" onClick={onEdit}>
              <Pencil size={15} /> Edit
            </ActionButton>
            <ActionButton variant="ghost" onClick={onDelete} className="text-rose-600 hover:text-rose-700 dark:text-rose-400">
              <Trash2 size={15} /> Delete
            </ActionButton>
          </div>
        </div>
      )}
    </li>
  );
}
