/**
 * The Learning Games store. Components read and act through it; it calls the VocabularyService
 * for rules, the GameGenerator for games, and saves every change through the StorageService on
 * its own, a moment after it happens. There is no save button.
 */
import { create } from "zustand";
import "../games";
import { generateGame, getGame } from "../games";
import type { GenerateHints } from "../games/types";
import { StorageService, requestPersistentStorage } from "../storage/StorageService";
import {
  DEFAULT_SET_NAME,
  STARTER_WORDS,
  applyOutcome,
  createSet,
  createWord,
  newId,
  updateWord,
  validateSetName,
  validateWord,
  wordKey,
  type WordValidation,
} from "../services/VocabularyService";
import type {
  ActiveGame,
  GameRecord,
  GameTypeId,
  Id,
  LearningPrefs,
  LearningView,
  StorageKind,
  VocabWord,
  WordInput,
  WordProgress,
  WordSelection,
  WordSet,
} from "../types";

const DOC = {
  vocabulary: "vocabulary",
  progress: "progress",
  history: "history",
  session: "session",
  prefs: "prefs",
} as const;
type DocKey = (typeof DOC)[keyof typeof DOC];

const HISTORY_LIMIT = 200;
const SAVE_DELAY_MS = 300;

interface VocabularyDoc { version: 1; sets: WordSet[]; words: VocabWord[] }
interface ProgressDoc { version: 1; entries: Record<Id, WordProgress> }
interface HistoryDoc { version: 1; records: GameRecord[] }
interface SessionDoc { version: 1; active: ActiveGame | null }
interface PrefsDoc { version: 1; prefs: LearningPrefs }

export const DEFAULT_PREFS: LearningPrefs = {
  activeSetId: null,
  gameType: "crossword",
  gameSetId: null,
  wordCount: 8,
  selection: "weakest",
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface Notice {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

export type WordResult = { ok: true; word: VocabWord } | { ok: false; errors: WordValidation["errors"] };

export interface StartGameOptions {
  gameType: GameTypeId;
  setId: Id | null;
  wordCount: number;
  selection: WordSelection;
  /** Play exactly these words (e.g. "practice the ones I missed") instead of a set. */
  wordIds?: Id[];
  title?: string;
  hints?: GenerateHints;
}

interface LearningState {
  status: "idle" | "loading" | "ready";
  storageKind: StorageKind | null;
  saveStatus: SaveStatus;
  sets: WordSet[];
  words: VocabWord[];
  progress: Record<Id, WordProgress>;
  history: GameRecord[];
  active: ActiveGame | null;
  prefs: LearningPrefs;
  view: LearningView;
  selectedRecordId: Id | null;
  notice: Notice | null;

  init(): Promise<void>;
  setView(view: LearningView): void;
  openRecord(id: Id, view: "results" | "review"): void;
  notify(message: string, tone?: Notice["tone"]): void;
  dismissNotice(): void;

  addWord(input: WordInput, setId: Id): WordResult;
  editWord(id: Id, input: WordInput): WordResult;
  deleteWords(ids: Id[]): void;
  moveWords(ids: Id[], setId: Id): number;
  importWords(inputs: WordInput[], setId: Id): { added: number; skipped: number };
  addStarterWords(): void;

  createSet(name: string): { ok: true; set: WordSet } | { ok: false; error: string };
  renameSet(id: Id, name: string): string | null;
  deleteSet(id: Id): void;
  setPrefs(patch: Partial<LearningPrefs>): void;

  startGame(options: StartGameOptions): { ok: true } | { ok: false; reason: string };
  saveGameState(state: unknown): void;
  finishGame(state: unknown): GameRecord | null;
  discardGame(): void;

  flush(): Promise<void>;
}

let storage: StorageService | null = null;
const timers = new Map<DocKey, ReturnType<typeof setTimeout>>();
const tabId = newId();
let channel: BroadcastChannel | null = null;
/** True while applying another tab's change, so it is not written straight back. */
let applyingRemote = false;
let noticeSeq = 0;

function docFor(key: DocKey, s: LearningState): unknown {
  switch (key) {
    case DOC.vocabulary: return { version: 1, sets: s.sets, words: s.words } satisfies VocabularyDoc;
    case DOC.progress: return { version: 1, entries: s.progress } satisfies ProgressDoc;
    case DOC.history: return { version: 1, records: s.history } satisfies HistoryDoc;
    case DOC.session: return { version: 1, active: s.active } satisfies SessionDoc;
    case DOC.prefs: return { version: 1, prefs: s.prefs } satisfies PrefsDoc;
  }
}

async function writeNow(key: DocKey) {
  timers.delete(key);
  if (!storage) return;
  useLearningStore.setState({ saveStatus: "saving" });
  try {
    await storage.save(key, docFor(key, useLearningStore.getState()));
    channel?.postMessage({ key, from: tabId });
    if (timers.size === 0) useLearningStore.setState({ saveStatus: "saved" });
  } catch (e) {
    console.error(`[learning] saving "${key}" failed`, e);
    const quota = (e as DOMException)?.name === "QuotaExceededError";
    useLearningStore.setState({ saveStatus: "error" });
    useLearningStore.getState().notify(
      quota ? "Storage is full, so recent changes were not saved." : "Could not save your latest changes.",
      "error",
    );
  }
}

function scheduleSave(key: DocKey) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => void writeNow(key), SAVE_DELAY_MS));
}

function flushTimers(): Promise<void>[] {
  return [...timers.keys()].map((key) => {
    clearTimeout(timers.get(key)!);
    return writeNow(key);
  });
}

/** Drops malformed entries so one bad record cannot break the whole panel. */
function sanitize(vocab: VocabularyDoc | null) {
  let sets = Array.isArray(vocab?.sets) ? vocab!.sets.filter((s) => s && s.id && typeof s.name === "string") : [];
  if (sets.length === 0) sets = [createSet(DEFAULT_SET_NAME)];
  const setIds = new Set(sets.map((s) => s.id));
  const words = (Array.isArray(vocab?.words) ? vocab!.words : [])
    .filter((w) => w && w.id && typeof w.word === "string" && typeof w.meaning === "string")
    .map((w) => ({ ...w, example: w.example ?? "", setId: setIds.has(w.setId) ? w.setId : sets[0].id }));
  return { sets, words };
}

async function hydrate(key: DocKey) {
  if (!storage) return;
  let patch: Partial<LearningState>;
  if (key === DOC.vocabulary) {
    patch = sanitize(await storage.load<VocabularyDoc>(key));
  } else if (key === DOC.progress) {
    patch = { progress: (await storage.load<ProgressDoc>(key))?.entries ?? {} };
  } else if (key === DOC.history) {
    const records = (await storage.load<HistoryDoc>(key))?.records;
    patch = { history: Array.isArray(records) ? records : [] };
  } else if (key === DOC.session) {
    const active = (await storage.load<SessionDoc>(key))?.active ?? null;
    const usable = active && getGame(active.gameType) ? active : null;
    patch = { active: usable };
    if (!usable && useLearningStore.getState().view === "play") patch.view = "create";
  } else {
    patch = { prefs: { ...DEFAULT_PREFS, ...(await storage.load<PrefsDoc>(key))?.prefs } };
  }
  // Only the synchronous update is flagged, so edits made while the read was pending still save.
  applyingRemote = true;
  try {
    useLearningStore.setState(patch);
  } finally {
    applyingRemote = false;
  }
}

function startAutosave() {
  useLearningStore.subscribe((s, prev) => {
    if (applyingRemote || s.status !== "ready" || prev.status !== "ready") return;
    if (s.sets !== prev.sets || s.words !== prev.words) scheduleSave(DOC.vocabulary);
    if (s.progress !== prev.progress) scheduleSave(DOC.progress);
    if (s.history !== prev.history) scheduleSave(DOC.history);
    if (s.active !== prev.active) scheduleSave(DOC.session);
    if (s.prefs !== prev.prefs) scheduleSave(DOC.prefs);
  });

  // Write immediately when the tab is hidden or closed rather than waiting out the delay.
  const flushOnHide = () => {
    if (document.visibilityState === "hidden") void Promise.all(flushTimers());
  };
  document.addEventListener("visibilitychange", flushOnHide);
  window.addEventListener("pagehide", () => void Promise.all(flushTimers()));

  // Another tab saved: reload that document unless this tab has its own change waiting.
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("learning-games");
    channel.onmessage = (event: MessageEvent<{ key: DocKey; from: string }>) => {
      const { key, from } = event.data ?? {};
      if (!key || from === tabId || timers.has(key) || storage?.isBusy(key)) return;
      void hydrate(key);
    };
  }
}

const now = () => Date.now();

export const useLearningStore = create<LearningState>()((set, get) => ({
  status: "idle",
  storageKind: null,
  saveStatus: "idle",
  sets: [],
  words: [],
  progress: {},
  history: [],
  active: null,
  prefs: DEFAULT_PREFS,
  view: "words",
  selectedRecordId: null,
  notice: null,

  async init() {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    storage = await StorageService.create(Object.values(DOC));
    set({ storageKind: storage.kind });
    await Promise.all(Object.values(DOC).map((key) => hydrate(key)));
    set({ status: "ready" });
    startAutosave();
  },

  setView(view) {
    set({ view });
  },

  openRecord(id, view) {
    set({ selectedRecordId: id, view });
  },

  notify(message, tone = "info") {
    set({ notice: { id: ++noticeSeq, message, tone } });
  },

  dismissNotice() {
    set({ notice: null });
  },

  addWord(input, setId) {
    const { words } = get();
    const check = validateWord(input, words.filter((w) => w.setId === setId));
    if (!check.valid) return { ok: false, errors: check.errors };
    const word = createWord(input, setId);
    set({ words: [word, ...words] });
    return { ok: true, word };
  },

  editWord(id, input) {
    const { words } = get();
    const current = words.find((w) => w.id === id);
    if (!current) return { ok: false, errors: { word: "This word no longer exists." } };
    const check = validateWord(input, words.filter((w) => w.setId === current.setId), id);
    if (!check.valid) return { ok: false, errors: check.errors };
    const word = updateWord(current, input);
    set({ words: words.map((w) => (w.id === id ? word : w)) });
    return { ok: true, word };
  },

  deleteWords(ids) {
    const drop = new Set(ids);
    const progress = { ...get().progress };
    ids.forEach((id) => delete progress[id]);
    set({ words: get().words.filter((w) => !drop.has(w.id)), progress });
  },

  moveWords(ids, setId) {
    const move = new Set(ids);
    const { words } = get();
    // Words already in the target set would become duplicates; those stay where they are.
    const taken = new Set(words.filter((w) => w.setId === setId).map((w) => wordKey(w.word)));
    let moved = 0;
    const next = words.map((w) => {
      if (!move.has(w.id) || w.setId === setId || taken.has(wordKey(w.word))) return w;
      taken.add(wordKey(w.word));
      moved++;
      return { ...w, setId, updatedAt: now() };
    });
    set({ words: next });
    return moved;
  },

  importWords(inputs, setId) {
    let added = 0;
    let skipped = 0;
    const created: VocabWord[] = [];
    const inSet = get().words.filter((w) => w.setId === setId);
    for (const input of inputs) {
      if (!validateWord(input, [...inSet, ...created]).valid) {
        skipped++;
        continue;
      }
      created.push(createWord(input, setId, now() + added));
      added++;
    }
    if (created.length) set({ words: [...created.reverse(), ...get().words] });
    return { added, skipped };
  },

  addStarterWords() {
    const { sets } = get();
    const existing = sets.find((s) => s.name === "Starter words");
    const target = existing ?? createSet("Starter words");
    if (!existing) set({ sets: [...sets, target] });
    const { added } = get().importWords(STARTER_WORDS, target.id);
    get().setPrefs({ activeSetId: target.id });
    get().notify(added ? `Added ${added} starter words.` : "Starter words are already in your list.", "success");
  },

  createSet(name) {
    const error = validateSetName(name, get().sets);
    if (error) return { ok: false, error };
    const s = createSet(name);
    set({ sets: [...get().sets, s] });
    return { ok: true, set: s };
  },

  renameSet(id, name) {
    const error = validateSetName(name, get().sets, id);
    if (error) return error;
    set({ sets: get().sets.map((s) => (s.id === id ? { ...s, name: name.replace(/\s+/g, " ").trim(), updatedAt: now() } : s)) });
    return null;
  },

  deleteSet(id) {
    const { sets, words, progress, prefs } = get();
    const removed = words.filter((w) => w.setId === id).map((w) => w.id);
    const nextProgress = { ...progress };
    removed.forEach((wid) => delete nextProgress[wid]);
    let nextSets = sets.filter((s) => s.id !== id);
    if (nextSets.length === 0) nextSets = [createSet(DEFAULT_SET_NAME)];
    set({
      sets: nextSets,
      words: words.filter((w) => w.setId !== id),
      progress: nextProgress,
      prefs: {
        ...prefs,
        activeSetId: prefs.activeSetId === id ? null : prefs.activeSetId,
        gameSetId: prefs.gameSetId === id ? null : prefs.gameSetId,
      },
    });
  },

  setPrefs(patch) {
    set({ prefs: { ...get().prefs, ...patch } });
  },

  startGame(options) {
    const { words, progress, sets } = get();
    const pool = options.wordIds
      ? words.filter((w) => options.wordIds!.includes(w.id))
      : options.setId
        ? words.filter((w) => w.setId === options.setId)
        : words;
    const result = generateGame({
      gameType: options.gameType,
      words: pool,
      progress,
      wordCount: options.wordCount,
      selection: options.selection,
      hints: options.hints,
    });
    if (!result.ok) return result;

    const byId = new Map(words.map((w) => [w.id, w]));
    const title = options.title ?? (options.setId ? sets.find((s) => s.id === options.setId)?.name : undefined) ?? "All words";
    const active: ActiveGame = {
      id: newId(),
      gameType: options.gameType,
      setId: options.setId,
      title,
      createdAt: now(),
      updatedAt: now(),
      wordIds: result.wordIds,
      words: result.wordIds.map((id) => {
        const w = byId.get(id)!;
        return { id, word: w.word, meaning: w.meaning, example: w.example };
      }),
      leftOut: result.leftOut.map((w) => w.word),
      puzzle: result.puzzle,
      state: result.state,
    };
    set({ active, view: "play" });
    return { ok: true };
  },

  saveGameState(state) {
    const { active } = get();
    if (!active) return;
    set({ active: { ...active, state, updatedAt: now() } });
  },

  finishGame(state) {
    const { active, progress, history, words } = get();
    if (!active) return null;
    const module = getGame(active.gameType);
    const restored = module?.restore(active.puzzle, state);
    if (!module || !restored) return null;

    const result = module.evaluate(restored.puzzle, restored.state);
    const finishedAt = now();
    const existing = new Set(words.map((w) => w.id));
    const nextProgress = { ...progress };
    const snapshot = new Map(active.words.map((w) => [w.id, w]));

    const record: GameRecord = {
      id: newId(),
      gameType: active.gameType,
      setId: active.setId,
      title: active.title,
      startedAt: active.createdAt,
      finishedAt,
      durationMs: result.elapsedMs,
      score: result.score,
      hintsUsed: result.hintsUsed,
      revealsUsed: result.revealsUsed,
      completed: result.completed,
      words: active.wordIds.map((wordId) => {
        const outcome = result.outcomes[wordId] ?? "missed";
        const before = progress[wordId]?.mastery ?? 0;
        let after = before;
        // Words deleted during the game are still recorded, but have no progress to update.
        if (existing.has(wordId)) {
          nextProgress[wordId] = applyOutcome(progress[wordId], wordId, outcome, finishedAt);
          after = nextProgress[wordId].mastery;
        }
        const w = snapshot.get(wordId);
        return {
          wordId,
          word: w?.word ?? "",
          meaning: w?.meaning ?? "",
          example: w?.example ?? "",
          outcome,
          masteryBefore: before,
          masteryAfter: after,
          mistakes: result.mistakes[wordId] ?? 0,
        };
      }),
    };

    set({
      progress: nextProgress,
      history: [record, ...history].slice(0, HISTORY_LIMIT),
      active: null,
      selectedRecordId: record.id,
    });
    // Ask once there is progress worth keeping; some browsers show a prompt for this.
    if (history.length === 0) void requestPersistentStorage();
    return record;
  },

  discardGame() {
    set({ active: null, view: get().view === "play" ? "create" : get().view });
  },

  async flush() {
    await Promise.all(flushTimers());
    await storage?.flush();
  },
}));

