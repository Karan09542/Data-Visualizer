/**
 * Domain types for Learning Games. Everything here is plain, serialisable data: it is what the
 * StorageService writes to disk and what game modules receive, so no class instances or Sets.
 */

export type Id = string;

/** Identifies a registered game module, e.g. "crossword". */
export type GameTypeId = string;

export interface WordSet {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface VocabWord {
  id: Id;
  setId: Id;
  word: string;
  meaning: string;
  example: string;
  createdAt: number;
  updatedAt: number;
}

/** What the user typed into the word form, before it becomes a VocabWord. */
export interface WordInput {
  word: string;
  meaning: string;
  example: string;
}

/**
 * How a word went in one game:
 * - solved: answered correctly with no help
 * - assisted: answered, but at least one letter came from a hint
 * - revealed: the player asked for the whole answer
 * - missed: the game ended before the word was answered
 */
export type WordOutcome = "solved" | "assisted" | "revealed" | "missed";

export interface WordProgress {
  wordId: Id;
  attempts: number;
  correct: number;
  /** Unaided correct answers in a row. */
  streak: number;
  bestStreak: number;
  /** 0 (new) to MAX_MASTERY (mastered). */
  mastery: number;
  lastPracticedAt: number;
  lastOutcome: WordOutcome | null;
}

/** A snapshot of one word as it was played, so history survives edits and deletes. */
export interface GameRecordWord {
  wordId: Id;
  word: string;
  meaning: string;
  example: string;
  outcome: WordOutcome;
  masteryBefore: number;
  masteryAfter: number;
  mistakes: number;
}

export interface GameRecord {
  id: Id;
  gameType: GameTypeId;
  /** The set played, or null for "all words". */
  setId: Id | null;
  title: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  /** 0 to 100. */
  score: number;
  hintsUsed: number;
  revealsUsed: number;
  /** False when the player ended the game before finishing it. */
  completed: boolean;
  words: GameRecordWord[];
}

/** A game in progress. `puzzle` and `state` belong to the game module named by `gameType`. */
export interface ActiveGame {
  id: Id;
  gameType: GameTypeId;
  setId: Id | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  wordIds: Id[];
  /** The words as they were when the game started, so edits mid-game do not change the record. */
  words: Pick<VocabWord, "id" | "word" | "meaning" | "example">[];
  /** Words chosen for the game that the generator could not fit. */
  leftOut: string[];
  puzzle: unknown;
  state: unknown;
}

export type WordSelection = "weakest" | "random" | "newest";

export interface LearningPrefs {
  /** The set shown in My Words; null means every set. */
  activeSetId: Id | null;
  gameType: GameTypeId;
  gameSetId: Id | null;
  wordCount: number;
  selection: WordSelection;
}

export type LearningView = "words" | "create" | "play" | "results" | "review";

export type StorageKind = "opfs" | "indexeddb" | "memory";
