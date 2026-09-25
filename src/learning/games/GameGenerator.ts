/**
 * Chooses which words go into a game and asks the right module to build it. Modules register
 * themselves here; nothing else needs to know which games exist.
 */
import type { GameTypeId, Id, VocabWord, WordProgress, WordSelection } from "../types";
import type { GameModule, GenerateHints, GenerateResult } from "./types";

const registry = new Map<GameTypeId, GameModule<any, any>>();

export function registerGame(module: GameModule<any, any>): void {
  registry.set(module.id, module);
}

export function getGame(id: GameTypeId): GameModule | undefined {
  return registry.get(id);
}

export function listGames(): GameModule[] {
  return [...registry.values()];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Orders the candidates for a game.
 * - weakest: lowest mastery first, then least recently practiced, so games drill what needs it
 * - newest: most recently added first
 * - random: any order
 * Ties are shuffled so replays of the same set do not always pick the same words.
 */
export function rankWords(
  words: readonly VocabWord[],
  progress: Record<Id, WordProgress>,
  selection: WordSelection,
  random: () => number,
): VocabWord[] {
  const shuffled = shuffle([...words], random);
  if (selection === "random") return shuffled;
  if (selection === "newest") return shuffled.sort((a, b) => b.createdAt - a.createdAt);
  return shuffled.sort((a, b) => {
    const pa = progress[a.id];
    const pb = progress[b.id];
    const ma = pa?.mastery ?? -1;
    const mb = pb?.mastery ?? -1;
    if (ma !== mb) return ma - mb;
    return (pa?.lastPracticedAt ?? 0) - (pb?.lastPracticedAt ?? 0);
  });
}

export interface GenerateRequest {
  gameType: GameTypeId;
  words: readonly VocabWord[];
  progress: Record<Id, WordProgress>;
  wordCount: number;
  selection: WordSelection;
  random?: () => number;
  hints?: GenerateHints;
}

export type GameGeneration =
  | { ok: true; module: GameModule; puzzle: unknown; state: unknown; wordIds: Id[]; leftOut: VocabWord[] }
  | { ok: false; reason: string };

/**
 * Builds a game from the best-ranked words. When the module cannot fit some of them, unused
 * candidates are offered in their place (a few rounds at most) so the game stays close to the
 * size the player asked for.
 */
export function generateGame(req: GenerateRequest): GameGeneration {
  const module = getGame(req.gameType);
  if (!module) return { ok: false, reason: "This game is not available." };
  const random = req.random ?? Math.random;

  const eligible = req.words.filter((w) => module.isEligible(w));
  if (eligible.length < module.minWords) {
    return {
      ok: false,
      reason: `Add at least ${module.minWords} words to play. ${module.ineligibleReason}`,
    };
  }

  const count = Math.max(module.minWords, Math.min(req.wordCount, module.maxWords, eligible.length));
  const ranked = rankWords(eligible, req.progress, req.selection, random);
  let chosen = ranked.slice(0, count);
  let reserve = ranked.slice(count);
  let best: GenerateResult<unknown> | null = null;

  for (let round = 0; round < 4; round++) {
    const result = module.generate(chosen, random, req.hints);
    if (result.ok && (!best || !best.ok || result.wordIds.length > best.wordIds.length)) best = result;
    else if (!best) best = result;
    if (!result.ok || result.leftOut.length === 0 || reserve.length === 0) break;
    // Swap the words that did not fit for fresh candidates and try again.
    const dropped = new Set(result.leftOut.map((w) => w.id));
    const refill = reserve.slice(0, dropped.size);
    reserve = reserve.slice(dropped.size);
    chosen = [...chosen.filter((w) => !dropped.has(w.id)), ...refill];
  }

  if (!best) return { ok: false, reason: "Could not build a game from these words." };
  if (best.ok === false) return { ok: false, reason: best.reason };
  // Report only chosen words that are genuinely missing from the final game.
  const placed = new Set(best.wordIds);
  const leftOut = ranked.slice(0, count).filter((w) => !placed.has(w.id));
  return {
    ok: true,
    module,
    puzzle: best.puzzle,
    state: module.createState(best.puzzle),
    wordIds: best.wordIds,
    leftOut: leftOut.length > 0 && placed.size < count ? leftOut : [],
  };
}
