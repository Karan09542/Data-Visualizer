/**
 * Word Wheel: one wheel of letters for the whole game, and a crossword of vocabulary words that
 * can all be spelled from it. The player finds the words in any order.
 *
 * It reuses the crossword's grid, engine and scoring; what is new is choosing words that share
 * letters, and recording the wheel on the puzzle.
 */
import { toAnswer } from "../../services/VocabularyService";
import type { VocabWord } from "../../types";
import type { GameModule, GenerateHints, GenerateResult } from "../types";
import { crosswordModule, generateCrossword, isCrosswordEligible, type CrosswordPuzzle, type CrosswordState } from "./CrosswordGame";

export const WHEEL_MIN = 5;
export const WHEEL_MAX = 15;
/** A wheel size of 0 means "Auto": the game picks the size. */
export const WHEEL_AUTO = 0;
const MIN_WHEEL_ANSWER = 3;

type Counts = Map<string, number>;

const countLetters = (answer: string): Counts => {
  const counts: Counts = new Map();
  for (const ch of answer) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
};

const total = (counts: Counts) => [...counts.values()].reduce((a, b) => a + b, 0);

/** Letters the wheel would need to gain to spell a word. */
const missing = (wheel: Counts, word: Counts) => {
  let n = 0;
  word.forEach((c, ch) => (n += Math.max(0, c - (wheel.get(ch) ?? 0))));
  return n;
};

const merge = (wheel: Counts, word: Counts): Counts => {
  const out = new Map(wheel);
  word.forEach((c, ch) => out.set(ch, Math.max(c, out.get(ch) ?? 0)));
  return out;
};

interface Candidate {
  word: VocabWord;
  answer: string;
  counts: Counts;
  rank: number;
}

export interface WheelPlan {
  words: VocabWord[];
  letters: number;
  /** Lower is better: the average position of the chosen words in the player's ranking. */
  rankCost: number;
}

/**
 * Picks words that can all be spelled from one wheel of at most `wheelSize` letters.
 *
 * Greedy from several starting words: each step adds the word that needs the fewest new
 * letters (words spelled entirely from letters already on the wheel come free), preferring
 * better-ranked words on ties. Plans are ordered by word count, then by how well-ranked their
 * words are, so the player's "needs practice / newest / random" choice still steers the game.
 */
export function planWheels(ranked: readonly VocabWord[], wordCount: number, wheelSize: number, random: () => number): WheelPlan[] {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const word of ranked) {
    const answer = toAnswer(word.word);
    if (answer.length < MIN_WHEEL_ANSWER || answer.length > wheelSize || seen.has(answer)) continue;
    seen.add(answer);
    candidates.push({ word, answer, counts: countLetters(answer), rank: candidates.length });
    if (candidates.length >= 400) break;
  }
  if (candidates.length < 2) return [];

  const seeds = new Set<number>();
  candidates.slice(0, 12).forEach((c) => seeds.add(c.rank));
  [...candidates].sort((a, b) => b.answer.length - a.answer.length).slice(0, 6).forEach((c) => seeds.add(c.rank));
  for (let i = 0; i < 4; i++) seeds.add(Math.floor(random() * candidates.length));

  const plans: WheelPlan[] = [];
  const keys = new Set<string>();
  for (const seed of seeds) {
    const chosen = [candidates[seed]];
    let wheel = candidates[seed].counts;
    const rest = candidates.filter((c) => c.rank !== seed);
    while (chosen.length < wordCount) {
      let best: Candidate | null = null;
      let bestCost = Infinity;
      const size = total(wheel);
      for (const c of rest) {
        const cost = missing(wheel, c.counts);
        if (size + cost > wheelSize) continue;
        if (cost < bestCost || (cost === bestCost && best && c.rank < best.rank)) {
          best = c;
          bestCost = cost;
        }
      }
      if (!best) break;
      chosen.push(best);
      wheel = merge(wheel, best.counts);
      rest.splice(rest.indexOf(best), 1);
    }
    if (chosen.length < 2) continue;
    const key = chosen.map((c) => c.rank).sort((a, b) => a - b).join(",");
    if (keys.has(key)) continue;
    keys.add(key);
    plans.push({
      words: chosen.map((c) => c.word),
      letters: total(wheel),
      rankCost: chosen.reduce((sum, c) => sum + c.rank, 0) / chosen.length,
    });
  }
  return plans.sort((a, b) => b.words.length - a.words.length || a.rankCost - b.rankCost);
}

/**
 * Auto wheel size: tries every size, finds the most words any wheel can hold, and returns the
 * plans for the smallest wheel that still holds that many. Fewer letters are quicker to scan,
 * so size only grows when it brings in more of the player's words.
 */
export function autoPlans(ranked: readonly VocabWord[], wordCount: number, random: () => number): WheelPlan[] {
  const bySize: WheelPlan[][] = [];
  let most = 0;
  for (let size = WHEEL_MIN; size <= WHEEL_MAX; size++) {
    const plans = planWheels(ranked, wordCount, size, random);
    bySize.push(plans);
    most = Math.max(most, plans[0]?.words.length ?? 0);
    // Nothing can beat a plan that already has every word asked for.
    if (most >= wordCount) break;
  }
  return bySize.find((plans) => (plans[0]?.words.length ?? 0) === most && most > 0) ?? [];
}

/** The smallest set of letters that spells every answer, in a fixed order. */
export function wheelFor(answers: readonly string[]): string[] {
  let wheel: Counts = new Map();
  answers.forEach((a) => (wheel = merge(wheel, countLetters(a))));
  return [...wheel.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([ch, n]) => Array(n).fill(ch));
}

export function generateWordWheel(
  ranked: VocabWord[],
  random: () => number,
  hints: GenerateHints = {},
): GenerateResult<CrosswordPuzzle> {
  const wordCount = Math.max(2, hints.wordCount ?? 10);
  const requested = Math.round(hints.wheelSize ?? WHEEL_AUTO);
  const plans =
    requested === WHEEL_AUTO
      ? autoPlans(ranked, wordCount, random)
      : planWheels(ranked, wordCount, Math.max(WHEEL_MIN, Math.min(WHEEL_MAX, requested)), random);
  if (plans.length === 0) {
    const size = Math.max(WHEEL_MIN, Math.min(WHEEL_MAX, requested));
    return {
      ok: false,
      reason:
        requested === WHEEL_AUTO
          ? `Your words don't share enough letters to make a wheel of up to ${WHEEL_MAX} letters. Add a few more words and try again.`
          : `Your words don't share enough letters for ${/^(8|11|18)$/.test(String(size)) ? "an" : "a"} ${size}-letter wheel. Choose Auto or a bigger wheel, or add more words.`,
      leftOut: [],
    };
  }

  // A plan's words usually cross each other easily (they share letters), but keep the next best
  // plans in reserve for the rare set the layout cannot connect.
  let best: GenerateResult<CrosswordPuzzle> | null = null;
  for (const plan of plans.slice(0, 4)) {
    const result = generateCrossword(plan.words, random, hints);
    if (result.ok && (!best || !best.ok || result.wordIds.length > best.wordIds.length)) best = result;
    if (result.ok && result.wordIds.length === plan.words.length) break;
  }
  if (!best || best.ok === false) {
    return {
      ok: false,
      reason: "These words have too few letters in common to cross each other in a grid. Add a few more words and try again.",
      leftOut: [],
    };
  }
  // Only the letters the placed words need, so every letter on the wheel is useful.
  const wheel = wheelFor(best.puzzle.entries.map((e) => e.answer));
  return { ...best, puzzle: { ...best.puzzle, wheel }, leftOut: [] };
}

export const wordWheelModule: GameModule<CrosswordPuzzle, CrosswordState> = {
  ...crosswordModule,
  id: "wordwheel",
  title: "Word Wheel",
  description: "One wheel of letters for the whole game. Find your words in it to fill the grid.",
  minWords: 2,
  maxWords: 20,
  defaultWordCount: 10,
  wordCountOptions: [5, 8, 10, 15, 20],
  selectsOwnWords: true,
  isEligible: (w) => isCrosswordEligible(w) && toAnswer(w.word).length >= MIN_WHEEL_ANSWER && toAnswer(w.word).length <= WHEEL_MAX,
  ineligibleReason: `Word Wheel answers need ${MIN_WHEEL_ANSWER}–${WHEEL_MAX} letters and a meaning.`,
  generate: generateWordWheel,
};
