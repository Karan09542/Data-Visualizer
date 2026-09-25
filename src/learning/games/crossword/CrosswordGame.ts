/**
 * Crossword rules, with no React and no storage. `buildPuzzle` turns words into a numbered grid,
 * and `reduce` applies one player action to the game state and reports what happened (a word
 * solved, a wrong answer, the grid finished) so the UI can give feedback.
 */
import { enumeration, toAnswer, foldLetter } from "../../services/VocabularyService";
import type { Id, VocabWord, WordOutcome } from "../../types";
import type { GameEvaluation, GameModule, GenerateHints, GenerateResult } from "../types";
import { buildLayout, transpose, type Direction, type RawLayout } from "./layout";

export type { Direction };

export const MIN_ANSWER = 2;
export const MAX_ANSWER = 16;

export interface CrosswordEntry {
  /** e.g. "3-across". */
  id: string;
  number: number;
  direction: Direction;
  row: number;
  col: number;
  /** Row-major cell indexes, first letter first. */
  cells: number[];
  answer: string;
  wordId: Id;
  word: string;
  clue: string;
  enumeration: string;
}

export interface CrosswordPuzzle {
  kind: "crossword";
  version: 1;
  rows: number;
  cols: number;
  /** Row-major; null marks a square that is not part of any word. */
  solution: (string | null)[];
  numbers: (number | null)[];
  /** Across entries by number, then down entries by number: the order clues are read in. */
  entries: CrosswordEntry[];
  /**
   * Word Wheel only: the letters on the wheel for the whole game. Every answer can be spelled
   * from them. Absent for a plain crossword, whose wheel follows the active clue.
   */
  wheel?: string[];
}

export type CellMark = "" | "hint" | "reveal";
export type CrosswordStatus = "playing" | "complete" | "ended";

export interface CrosswordState {
  version: 1;
  letters: string[];
  /** Where a letter came from, when it was not typed by the player. */
  marks: CellMark[];
  /** Letters flagged by the last check of a finished word; cleared when the letter changes. */
  wrong: boolean[];
  solved: string[];
  revealed: string[];
  mistakes: Record<string, number>;
  cursor: { cell: number; direction: Direction };
  hintsUsed: number;
  revealsUsed: number;
  elapsedMs: number;
  status: CrosswordStatus;
}

export type CrosswordAction =
  | { type: "select"; cell: number }
  | { type: "selectEntry"; entryId: string }
  | { type: "input"; letter: string }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "move"; dRow: number; dCol: number }
  | { type: "nextEntry"; step: 1 | -1 }
  | { type: "toggleDirection" }
  | { type: "hint" }
  | { type: "revealEntry" }
  /** A whole word from the letter wheel, aimed at `entryId` (the active clue). */
  | { type: "submitWord"; word: string; entryId?: string }
  | { type: "tick"; ms: number }
  | { type: "end" };

export type CrosswordEvent =
  | { type: "correct"; entryId: string }
  | { type: "wrong"; entryId: string }
  | { type: "revealed"; entryId: string }
  /** A wheel word that answers no open clue. `counted` is true when it was a full-length guess. */
  | { type: "rejected"; entryId?: string; word: string; counted: boolean }
  | { type: "complete" };

// ---------------------------------------------------------------------------
// Building a puzzle
// ---------------------------------------------------------------------------

export function isCrosswordEligible(word: VocabWord): boolean {
  const n = toAnswer(word.word).length;
  return n >= MIN_ANSWER && n <= MAX_ANSWER && word.meaning.trim().length > 0;
}

export function buildPuzzle(layout: RawLayout, words: ReadonlyMap<Id, VocabWord>): CrosswordPuzzle {
  const { rows, cols } = layout;
  const solution: (string | null)[] = new Array(rows * cols).fill(null);
  for (const p of layout.placed) {
    for (let k = 0; k < p.answer.length; k++) {
      const r = p.direction === "across" ? p.row : p.row + k;
      const c = p.direction === "across" ? p.col + k : p.col;
      solution[r * cols + c] = p.answer[k];
    }
  }

  // Number start squares in reading order, as printed crosswords do. The generator numbers
  // them in placement order instead.
  const starts = [...new Set(layout.placed.map((p) => p.row * cols + p.col))].sort((a, b) => a - b);
  const numbers: (number | null)[] = new Array(rows * cols).fill(null);
  starts.forEach((cell, i) => (numbers[cell] = i + 1));

  const entries: CrosswordEntry[] = layout.placed.map((p) => {
    const start = p.row * cols + p.col;
    const step = p.direction === "across" ? 1 : cols;
    const word = words.get(p.key)!;
    return {
      id: `${numbers[start]}-${p.direction}`,
      number: numbers[start]!,
      direction: p.direction,
      row: p.row,
      col: p.col,
      cells: Array.from({ length: p.answer.length }, (_, k) => start + k * step),
      answer: p.answer,
      wordId: word.id,
      word: word.word,
      clue: word.meaning,
      enumeration: enumeration(word.word),
    };
  });
  entries.sort((a, b) =>
    a.direction === b.direction ? a.number - b.number : a.direction === "across" ? -1 : 1,
  );

  return { kind: "crossword", version: 1, rows, cols, solution, numbers, entries };
}

export function generateCrossword(
  words: VocabWord[],
  random: () => number,
  hints: GenerateHints = {},
): GenerateResult<CrosswordPuzzle> {
  const byId = new Map(words.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const items: { key: string; answer: string }[] = [];
  const duplicates: VocabWord[] = [];
  for (const w of words) {
    const answer = toAnswer(w.word);
    // Two words spelling the same answer would make their clues interchangeable.
    if (seen.has(answer)) duplicates.push(w);
    else {
      seen.add(answer);
      items.push({ key: w.id, answer });
    }
  }

  let layout = buildLayout(items);
  const leftOut = [...duplicates, ...layout.unplaced.map((id) => byId.get(id)!)];
  if (layout.placed.length < 2) {
    return {
      ok: false,
      reason: "These words don't share enough letters to cross each other. Add a few more words and try again.",
      leftOut,
    };
  }

  // A layout can be flipped across its diagonal. Pick whichever shape is closer to the space it
  // will be shown in (tall on a phone, wide beside a clue list); near-square boards flip at
  // random for variety.
  const target = Math.log(hints.aspect && hints.aspect > 0 ? hints.aspect : 1);
  const misfit = (rows: number, cols: number) => Math.abs(Math.log(cols / rows) - target);
  const asIs = misfit(layout.rows, layout.cols);
  const flipped = misfit(layout.cols, layout.rows);
  if (Math.abs(asIs - flipped) < 0.1 ? random() < 0.5 : flipped < asIs) {
    layout = transpose(layout);
  }

  const puzzle = buildPuzzle(layout, byId);
  return { ok: true, puzzle, wordIds: puzzle.entries.map((e) => e.wordId), leftOut };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

interface CellLinks {
  across: number;
  down: number;
}

const linkCache = new WeakMap<CrosswordPuzzle, CellLinks[]>();

/** For every cell, the index of its across and down entries (-1 where there is none). */
export function cellLinks(puzzle: CrosswordPuzzle): CellLinks[] {
  let links = linkCache.get(puzzle);
  if (!links) {
    links = puzzle.solution.map(() => ({ across: -1, down: -1 }));
    puzzle.entries.forEach((e, i) => e.cells.forEach((c) => (links![c][e.direction] = i)));
    linkCache.set(puzzle, links);
  }
  return links;
}

export function entryAt(puzzle: CrosswordPuzzle, cell: number, direction: Direction): CrosswordEntry | null {
  const i = cellLinks(puzzle)[cell]?.[direction] ?? -1;
  return i >= 0 ? puzzle.entries[i] : null;
}

export function activeEntry(puzzle: CrosswordPuzzle, state: CrosswordState): CrosswordEntry | null {
  return entryAt(puzzle, state.cursor.cell, state.cursor.direction);
}

const other = (d: Direction): Direction => (d === "across" ? "down" : "across");

function isLocked(puzzle: CrosswordPuzzle, s: CrosswordState, cell: number): boolean {
  if (s.marks[cell]) return true;
  const links = cellLinks(puzzle)[cell];
  return [links.across, links.down].some((i) => i >= 0 && s.solved.includes(puzzle.entries[i].id));
}

function firstOpenCell(s: CrosswordState, entry: CrosswordEntry): number {
  return entry.cells.find((c) => !s.letters[c]) ?? entry.cells[0];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createState(puzzle: CrosswordPuzzle): CrosswordState {
  const size = puzzle.rows * puzzle.cols;
  const first = puzzle.entries[0];
  return {
    version: 1,
    letters: new Array(size).fill(""),
    marks: new Array(size).fill(""),
    wrong: new Array(size).fill(false),
    solved: [],
    revealed: [],
    mistakes: {},
    cursor: { cell: first?.cells[0] ?? 0, direction: first?.direction ?? "across" },
    hintsUsed: 0,
    revealsUsed: 0,
    elapsedMs: 0,
    status: "playing",
  };
}

/** Checks the entries through `cells` that are now full, marking them solved or wrong. */
function checkEntries(puzzle: CrosswordPuzzle, s: CrosswordState, cells: number[], events: CrosswordEvent[]) {
  const links = cellLinks(puzzle);
  const touched = new Set<number>();
  for (const c of cells) {
    if (links[c].across >= 0) touched.add(links[c].across);
    if (links[c].down >= 0) touched.add(links[c].down);
  }
  for (const i of touched) {
    const entry = puzzle.entries[i];
    if (s.solved.includes(entry.id)) continue;
    if (!entry.cells.every((c) => s.letters[c])) continue;
    const wrongCells = entry.cells.filter((c) => s.letters[c] !== puzzle.solution[c]);
    if (wrongCells.length === 0) {
      s.solved = [...s.solved, entry.id];
      events.push({ type: "correct", entryId: entry.id });
    } else {
      wrongCells.forEach((c) => (s.wrong[c] = true));
      s.mistakes = { ...s.mistakes, [entry.id]: (s.mistakes[entry.id] ?? 0) + 1 };
      events.push({ type: "wrong", entryId: entry.id });
    }
  }
  if (s.status === "playing" && s.solved.length === puzzle.entries.length) {
    s.status = "complete";
    events.push({ type: "complete" });
  }
}

/** Where the cursor goes after a letter lands in `cell`. */
function advance(puzzle: CrosswordPuzzle, s: CrosswordState, cell: number) {
  const entry = entryAt(puzzle, cell, s.cursor.direction) ?? entryAt(puzzle, cell, other(s.cursor.direction));
  if (!entry) return;
  if (s.solved.includes(entry.id)) {
    moveToNextEntry(puzzle, s, entry, 1);
    return;
  }
  const pos = entry.cells.indexOf(cell);
  const next =
    entry.cells.slice(pos + 1).find((c) => !s.letters[c]) ??
    entry.cells.find((c) => !s.letters[c]) ??
    entry.cells.find((c) => s.wrong[c]) ??
    entry.cells[Math.min(pos + 1, entry.cells.length - 1)];
  s.cursor = { cell: next, direction: entry.direction };
}

function moveToNextEntry(puzzle: CrosswordPuzzle, s: CrosswordState, from: CrosswordEntry | null, step: 1 | -1) {
  const list = puzzle.entries;
  if (list.length === 0) return;
  const n = list.length;
  const at = (i: number) => list[((i % n) + n) % n];
  const start = from ? list.indexOf(from) : -1;
  let target = at(start + step);
  for (let k = 1; k <= n; k++) {
    const candidate = at(start + k * step);
    if (!s.solved.includes(candidate.id)) {
      target = candidate;
      break;
    }
  }
  s.cursor = { cell: firstOpenCell(s, target), direction: target.direction };
}

function setLetter(s: CrosswordState, cell: number, letter: string) {
  if (s.letters[cell] === letter) return;
  s.letters[cell] = letter;
  s.wrong[cell] = false;
}

/**
 * Applies one action. The state passed in is never modified; a new one is returned along with
 * the events the action caused.
 */
export function reduce(
  puzzle: CrosswordPuzzle,
  state: CrosswordState,
  action: CrosswordAction,
): { state: CrosswordState; events: CrosswordEvent[] } {
  const events: CrosswordEvent[] = [];
  const s: CrosswordState = {
    ...state,
    letters: [...state.letters],
    marks: [...state.marks],
    wrong: [...state.wrong],
    cursor: { ...state.cursor },
  };
  const links = cellLinks(puzzle);
  const cur = s.cursor.cell;
  const entry = activeEntry(puzzle, s);

  if (action.type === "tick") {
    s.elapsedMs += Math.max(0, action.ms);
    return { state: s, events };
  }

  // Selection and navigation still work on a finished grid, so it can be looked over.
  switch (action.type) {
    case "select": {
      if (puzzle.solution[action.cell] == null) break;
      if (action.cell === cur) {
        if (entryAt(puzzle, cur, other(s.cursor.direction))) s.cursor.direction = other(s.cursor.direction);
      } else {
        s.cursor.cell = action.cell;
        if (!entryAt(puzzle, action.cell, s.cursor.direction)) s.cursor.direction = other(s.cursor.direction);
      }
      return { state: s, events };
    }
    case "selectEntry": {
      const target = puzzle.entries.find((e) => e.id === action.entryId);
      if (target) s.cursor = { cell: firstOpenCell(s, target), direction: target.direction };
      return { state: s, events };
    }
    case "toggleDirection": {
      if (entryAt(puzzle, cur, other(s.cursor.direction))) s.cursor.direction = other(s.cursor.direction);
      return { state: s, events };
    }
    case "move": {
      const wanted: Direction = action.dCol !== 0 ? "across" : "down";
      // Arrowing across a down word first turns to face the new direction, as in most crossword apps.
      if (wanted !== s.cursor.direction && entryAt(puzzle, cur, wanted)) {
        s.cursor.direction = wanted;
        return { state: s, events };
      }
      let r = Math.floor(cur / puzzle.cols) + action.dRow;
      let c = (cur % puzzle.cols) + action.dCol;
      while (r >= 0 && r < puzzle.rows && c >= 0 && c < puzzle.cols) {
        const cell = r * puzzle.cols + c;
        if (puzzle.solution[cell] != null) {
          s.cursor.cell = cell;
          if (!entryAt(puzzle, cell, s.cursor.direction)) s.cursor.direction = other(s.cursor.direction);
          break;
        }
        r += action.dRow;
        c += action.dCol;
      }
      return { state: s, events };
    }
    case "nextEntry": {
      moveToNextEntry(puzzle, s, entry, action.step);
      return { state: s, events };
    }
  }

  if (s.status !== "playing") return { state: s, events };

  switch (action.type) {
    case "input": {
      const letter = foldLetter(action.letter);
      if (!/^\p{L}$/u.test(letter)) break;
      if (!isLocked(puzzle, s, cur)) {
        setLetter(s, cur, letter);
        checkEntries(puzzle, s, [cur], events);
      }
      advance(puzzle, s, cur);
      break;
    }
    case "backspace": {
      if (s.letters[cur] && !isLocked(puzzle, s, cur)) {
        setLetter(s, cur, "");
        break;
      }
      if (!entry) break;
      const pos = entry.cells.indexOf(cur);
      if (pos > 0) {
        const prev = entry.cells[pos - 1];
        s.cursor.cell = prev;
        if (!isLocked(puzzle, s, prev)) setLetter(s, prev, "");
      }
      break;
    }
    case "delete": {
      if (!isLocked(puzzle, s, cur)) setLetter(s, cur, "");
      break;
    }
    case "hint": {
      if (!entry) break;
      const target = [cur, ...entry.cells].find((c) => !isLocked(puzzle, s, c) && s.letters[c] !== puzzle.solution[c]);
      if (target === undefined) break;
      setLetter(s, target, puzzle.solution[target]!);
      s.marks[target] = "hint";
      s.hintsUsed += 1;
      s.cursor.cell = target;
      checkEntries(puzzle, s, [target], events);
      advance(puzzle, s, target);
      break;
    }
    case "revealEntry": {
      if (!entry || s.solved.includes(entry.id)) break;
      // Only letters that change are marked, so a crossing word the player typed correctly
      // does not count as helped.
      const changed = entry.cells.filter((c) => s.letters[c] !== puzzle.solution[c]);
      changed.forEach((c) => {
        setLetter(s, c, puzzle.solution[c]!);
        s.marks[c] = "reveal";
      });
      s.revealed = [...s.revealed, entry.id];
      s.revealsUsed += 1;
      s.solved = [...s.solved, entry.id];
      events.push({ type: "revealed", entryId: entry.id });
      checkEntries(puzzle, s, changed, events);
      if (s.status === "playing") moveToNextEntry(puzzle, s, entry, 1);
      break;
    }
    case "submitWord": {
      const word = [...action.word].map(foldLetter).join("");
      const open = puzzle.entries.filter((e) => !s.solved.includes(e.id) && e.answer === word);
      // The active clue first; otherwise any open clue with exactly this answer (anagrams of the
      // wheel letters can belong to another word).
      const target = open.find((e) => e.id === action.entryId) ?? open[0];
      if (!target) {
        const aimed = puzzle.entries.find((e) => e.id === action.entryId);
        const counted = !!aimed && !s.solved.includes(aimed.id) && [...word].length === aimed.cells.length;
        if (counted) s.mistakes = { ...s.mistakes, [aimed!.id]: (s.mistakes[aimed!.id] ?? 0) + 1 };
        events.push({ type: "rejected", entryId: aimed?.id, word, counted });
        break;
      }
      target.cells.forEach((c, i) => {
        if (!isLocked(puzzle, s, c)) setLetter(s, c, target.answer[i]);
      });
      checkEntries(puzzle, s, target.cells, events);
      if (s.status === "playing") moveToNextEntry(puzzle, s, target, 1);
      break;
    }
    case "end": {
      s.status = "ended";
      break;
    }
  }

  // Keep the cursor on a square that belongs to a word in its direction.
  if (links[s.cursor.cell] && links[s.cursor.cell][s.cursor.direction] < 0) {
    s.cursor.direction = other(s.cursor.direction);
  }
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function outcomeOf(puzzle: CrosswordPuzzle, s: CrosswordState, entry: CrosswordEntry): WordOutcome {
  if (s.revealed.includes(entry.id)) return "revealed";
  if (!s.solved.includes(entry.id)) return "missed";
  return entry.cells.some((c) => s.marks[c]) ? "assisted" : "solved";
}

export function evaluate(puzzle: CrosswordPuzzle, s: CrosswordState): GameEvaluation {
  const outcomes: Record<Id, WordOutcome> = {};
  const mistakes: Record<Id, number> = {};
  let points = 0;
  for (const e of puzzle.entries) {
    const outcome = outcomeOf(puzzle, s, e);
    outcomes[e.wordId] = outcome;
    mistakes[e.wordId] = s.mistakes[e.id] ?? 0;
    points += outcome === "solved" ? 1 : outcome === "assisted" ? 0.5 : 0;
  }
  return {
    outcomes,
    mistakes,
    hintsUsed: s.hintsUsed,
    revealsUsed: s.revealsUsed,
    score: puzzle.entries.length ? Math.round((points / puzzle.entries.length) * 100) : 0,
    elapsedMs: s.elapsedMs,
    completed: s.status === "complete",
  };
}

// ---------------------------------------------------------------------------
// Resuming saved games
// ---------------------------------------------------------------------------

const isArrayOf = (v: unknown, n: number) => Array.isArray(v) && v.length === n;

export function restore(puzzle: unknown, state: unknown): { puzzle: CrosswordPuzzle; state: CrosswordState } | null {
  const p = puzzle as CrosswordPuzzle;
  const s = state as CrosswordState;
  if (!p || p.kind !== "crossword" || p.version !== 1 || !Array.isArray(p.entries)) return null;
  const size = p.rows * p.cols;
  if (!(size > 0) || !isArrayOf(p.solution, size) || !isArrayOf(p.numbers, size)) return null;
  if (!p.entries.every((e) => Array.isArray(e.cells) && e.cells.every((c) => p.solution[c] != null))) return null;
  if (!s || s.version !== 1 || !isArrayOf(s.letters, size) || !isArrayOf(s.marks, size) || !isArrayOf(s.wrong, size)) {
    return null;
  }
  if (p.solution[s.cursor?.cell] == null) return null;
  if (p.wheel !== undefined && !(Array.isArray(p.wheel) && p.wheel.every((l) => typeof l === "string"))) return null;
  return {
    puzzle: p,
    state: {
      ...s,
      solved: Array.isArray(s.solved) ? s.solved : [],
      revealed: Array.isArray(s.revealed) ? s.revealed : [],
      mistakes: s.mistakes ?? {},
      elapsedMs: Number(s.elapsedMs) || 0,
    },
  };
}

export const crosswordModule: GameModule<CrosswordPuzzle, CrosswordState> = {
  id: "crossword",
  title: "Crossword",
  description: "Meanings become clues. Fill the grid with your words.",
  minWords: 2,
  maxWords: 16,
  defaultWordCount: 8,
  wordCountOptions: [4, 6, 8, 12, 16],
  isEligible: isCrosswordEligible,
  ineligibleReason: `Crossword answers need ${MIN_ANSWER}–${MAX_ANSWER} letters and a meaning.`,
  generate: generateCrossword,
  createState,
  restore,
  isFinished: (_p, s) => s.status !== "playing",
  evaluate,
  summarize: (p, s) => ({ done: s.solved.length, total: p.entries.length, elapsedMs: s.elapsedMs }),
};
