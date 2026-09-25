/**
 * The contract every learning game implements. A module owns its puzzle and state formats and
 * all of its rules; the store only stores what the module hands back, and the UI finds a player
 * component for the module's id. Adding a game (matching, fill-in-the-blank, unscramble) means
 * writing one of these plus a player, then registering both.
 */
import type { GameTypeId, Id, VocabWord, WordOutcome } from "../types";

export type GenerateResult<P> =
  | { ok: true; puzzle: P; wordIds: Id[]; leftOut: VocabWord[] }
  | { ok: false; reason: string; leftOut: VocabWord[] };

export interface GameEvaluation {
  outcomes: Record<Id, WordOutcome>;
  mistakes: Record<Id, number>;
  hintsUsed: number;
  revealsUsed: number;
  /** 0 to 100. */
  score: number;
  elapsedMs: number;
  /** False when the game was ended before every word was answered. */
  completed: boolean;
}

export interface GenerateHints {
  /** Width divided by height of the space the game will be shown in. */
  aspect?: number;
  /** How many words the player asked for; passed to modules that pick their own words. */
  wordCount?: number;
  /** Most letters a letter wheel may hold, for games built around one; 0 means choose automatically. */
  wheelSize?: number;
}

export interface GameModule<P = unknown, S = unknown> {
  id: GameTypeId;
  title: string;
  description: string;
  minWords: number;
  maxWords: number;
  defaultWordCount: number;
  /** Choices offered for "how many words". */
  wordCountOptions?: number[];
  /**
   * When true the module receives every eligible word, best first, and chooses its own subset
   * (e.g. words that share one set of letters) instead of being handed the top few.
   */
  selectsOwnWords?: boolean;
  /** Whether a word can appear in this game at all. */
  isEligible(word: VocabWord): boolean;
  /** Shown next to words the game has to skip. */
  ineligibleReason: string;
  /** `random` lets generation vary between runs; pass a seeded one for repeatable puzzles. */
  generate(words: VocabWord[], random: () => number, hints?: GenerateHints): GenerateResult<P>;
  createState(puzzle: P): S;
  /** Validates persisted data from an earlier session; null means it cannot be resumed. */
  restore(puzzle: unknown, state: unknown): { puzzle: P; state: S } | null;
  isFinished(puzzle: P, state: S): boolean;
  evaluate(puzzle: P, state: S): GameEvaluation;
  /** A one-line status for the resume card, e.g. "4 of 9 words". */
  summarize(puzzle: P, state: S): { done: number; total: number; elapsedMs: number };
}
