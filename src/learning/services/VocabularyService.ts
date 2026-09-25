/**
 * Vocabulary rules: validating and building words and sets, parsing pasted lists, and turning
 * game outcomes into progress. Pure functions only; the store decides when to call them and
 * the StorageService decides where the results go.
 */
import { v4 as uuidv4 } from "uuid";
import type {
  GameRecord,
  Id,
  VocabWord,
  WordInput,
  WordOutcome,
  WordProgress,
  WordSet,
} from "../types";

export const MAX_MASTERY = 5;
export const WORD_MAX_LENGTH = 60;
export const MEANING_MAX_LENGTH = 280;
export const EXAMPLE_MAX_LENGTH = 400;
export const SET_NAME_MAX_LENGTH = 40;
export const DEFAULT_SET_NAME = "My Words";

export const newId = (): Id => uuidv4();

const collapseSpaces = (text: string) => text.replace(/\s+/g, " ").trim();

/** Folds one character to the form games compare: accents dropped, upper case. */
export function foldLetter(ch: string): string {
  return ch.normalize("NFD").replace(/\p{M}/gu, "").toLocaleUpperCase();
}

/**
 * The letters of a word as a grid game uses them: "Déjà vu" becomes "DEJAVU". Spaces, hyphens,
 * apostrophes and digits are dropped.
 */
export function toAnswer(word: string): string {
  return foldLetter(word).replace(/[^\p{L}]/gu, "");
}

/** Letter counts of each part of a phrase, e.g. "give up" -> "4,2"; empty for a single word. */
export function enumeration(word: string): string {
  const parts = word
    .trim()
    .split(/[\s\-–—]+/)
    .map((p) => toAnswer(p).length)
    .filter((n) => n > 0);
  return parts.length > 1 ? parts.join(",") : "";
}

/** Case- and accent-insensitive key for spotting duplicates. */
export const wordKey = (word: string) => collapseSpaces(foldLetter(word));

export interface WordValidation {
  errors: Partial<Record<keyof WordInput, string>>;
  valid: boolean;
}

export function validateWord(
  input: WordInput,
  siblings: readonly VocabWord[],
  editingId?: Id,
): WordValidation {
  const errors: WordValidation["errors"] = {};
  const word = collapseSpaces(input.word);
  const meaning = collapseSpaces(input.meaning);

  if (!word) errors.word = "Enter a word.";
  else if (word.length > WORD_MAX_LENGTH) errors.word = `Keep it under ${WORD_MAX_LENGTH} characters.`;
  else if (!toAnswer(word)) errors.word = "Use at least one letter.";
  else if (siblings.some((w) => w.id !== editingId && wordKey(w.word) === wordKey(word))) {
    errors.word = "This word is already in the set.";
  }

  if (!meaning) errors.meaning = "Add a meaning. It becomes the clue.";
  else if (meaning.length > MEANING_MAX_LENGTH) errors.meaning = `Keep it under ${MEANING_MAX_LENGTH} characters.`;

  if (input.example.trim().length > EXAMPLE_MAX_LENGTH) {
    errors.example = `Keep it under ${EXAMPLE_MAX_LENGTH} characters.`;
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

export function cleanInput(input: WordInput): WordInput {
  return {
    word: collapseSpaces(input.word),
    meaning: collapseSpaces(input.meaning),
    example: input.example.trim(),
  };
}

export function createWord(input: WordInput, setId: Id, now = Date.now()): VocabWord {
  return { id: newId(), setId, ...cleanInput(input), createdAt: now, updatedAt: now };
}

export function updateWord(word: VocabWord, input: WordInput, now = Date.now()): VocabWord {
  return { ...word, ...cleanInput(input), updatedAt: now };
}

export function validateSetName(name: string, sets: readonly WordSet[], editingId?: Id): string | null {
  const clean = collapseSpaces(name);
  if (!clean) return "Give the set a name.";
  if (clean.length > SET_NAME_MAX_LENGTH) return `Keep it under ${SET_NAME_MAX_LENGTH} characters.`;
  if (sets.some((s) => s.id !== editingId && s.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    return "A set with this name already exists.";
  }
  return null;
}

export function createSet(name: string, now = Date.now()): WordSet {
  return { id: newId(), name: collapseSpaces(name), createdAt: now, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Pasted lists
// ---------------------------------------------------------------------------

export interface ParsedLine {
  line: number;
  input: WordInput;
  error?: string;
}

/** Separators tried in order; the first one found on a line splits it. */
const SEPARATORS = ["\t", " | ", "|", " — ", " – ", " - ", ": ", ";", "="];

/**
 * Parses one entry per line: `word - meaning - example`. Tabs (spreadsheet paste), pipes, dashes,
 * colons, semicolons and "=" all work as separators.
 */
export function parseWordList(text: string): ParsedLine[] {
  const result: ParsedLine[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) return;
    const sep = SEPARATORS.find((s) => line.includes(s));
    if (!sep) {
      result.push({ line: index + 1, input: { word: line, meaning: "", example: "" }, error: "No meaning found" });
      return;
    }
    const [word, meaning = "", ...rest] = line.split(sep);
    const input = { word: word.trim(), meaning: meaning.trim(), example: rest.join(sep).trim() };
    result.push({
      line: index + 1,
      input,
      error: !input.word ? "No word found" : !input.meaning ? "No meaning found" : undefined,
    });
  });
  return result;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function emptyProgress(wordId: Id): WordProgress {
  return {
    wordId,
    attempts: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    mastery: 0,
    lastPracticedAt: 0,
    lastOutcome: null,
  };
}

/**
 * Mastery moves up one step for an unaided answer, holds when a hint was needed, and drops one
 * step when the answer was revealed or missed. Only unaided answers extend the streak.
 */
export function applyOutcome(progress: WordProgress | undefined, wordId: Id, outcome: WordOutcome, now = Date.now()): WordProgress {
  const p = progress ?? emptyProgress(wordId);
  const correct = outcome === "solved" || outcome === "assisted";
  const streak = outcome === "solved" ? p.streak + 1 : 0;
  const delta = outcome === "solved" ? 1 : outcome === "assisted" ? 0 : -1;
  return {
    ...p,
    attempts: p.attempts + 1,
    correct: p.correct + (correct ? 1 : 0),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    mastery: Math.min(MAX_MASTERY, Math.max(0, p.mastery + delta)),
    lastPracticedAt: now,
    lastOutcome: outcome,
  };
}

export type MasteryLevel = "new" | "learning" | "familiar" | "mastered";

export function masteryLevel(progress: WordProgress | undefined): MasteryLevel {
  if (!progress || progress.attempts === 0) return "new";
  if (progress.mastery >= MAX_MASTERY) return "mastered";
  if (progress.mastery >= 3) return "familiar";
  return "learning";
}

export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  new: "New",
  learning: "Learning",
  familiar: "Familiar",
  mastered: "Mastered",
};

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Consecutive days, ending today or yesterday, with at least one finished game. */
export function dayStreak(history: readonly GameRecord[], now = Date.now()): number {
  const days = new Set(history.map((r) => dayKey(r.finishedAt)));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface VocabularyStats {
  total: number;
  mastered: number;
  practiced: number;
  accuracy: number | null;
}

export function vocabularyStats(words: readonly VocabWord[], progress: Record<Id, WordProgress>): VocabularyStats {
  let mastered = 0;
  let practiced = 0;
  let attempts = 0;
  let correct = 0;
  for (const w of words) {
    const p = progress[w.id];
    if (!p || p.attempts === 0) continue;
    practiced++;
    attempts += p.attempts;
    correct += p.correct;
    if (p.mastery >= MAX_MASTERY) mastered++;
  }
  return {
    total: words.length,
    mastered,
    practiced,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
  };
}

/** A small set so a first-time user can try a game before typing their own list. */
export const STARTER_WORDS: WordInput[] = [
  { word: "Candid", meaning: "Truthful and straightforward; frank", example: "She gave a candid account of what went wrong." },
  { word: "Resilient", meaning: "Able to recover quickly from difficulties", example: "Children are often more resilient than adults expect." },
  { word: "Meticulous", meaning: "Showing great attention to detail", example: "He kept meticulous notes on every experiment." },
  { word: "Ephemeral", meaning: "Lasting for a very short time", example: "Fashion trends are ephemeral." },
  { word: "Pragmatic", meaning: "Dealing with things sensibly and realistically", example: "We need a pragmatic solution, not a perfect one." },
  { word: "Eloquent", meaning: "Fluent or persuasive in speaking or writing", example: "Her eloquent speech moved the audience." },
  { word: "Ambiguous", meaning: "Open to more than one interpretation", example: "The instructions were ambiguous." },
  { word: "Tenacious", meaning: "Holding firmly to a purpose; persistent", example: "A tenacious reporter chased the story for months." },
  { word: "Serene", meaning: "Calm, peaceful and untroubled", example: "The lake looked serene at dawn." },
  { word: "Novel", meaning: "New or unusual in an interesting way", example: "They tried a novel approach to the problem." },
];
