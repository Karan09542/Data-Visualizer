/**
 * Matches what the user said to a registered voice command by meaning, for when annyang's exact
 * phrase templates don't match ("fit center", or "hit center" when speech recognition mishears).
 *
 * Every phrase is embedded once with a sentence-embedding model. A spoken sentence is compared:
 *  - whole, against the phrases with no wildcard ("fit center" ≈ "fit into center"), blended with
 *    a word-by-word spelling match so a misheard word still counts ("hit center" ≈ "fit into center");
 *  - for a phrase with a fixed list of values (layouts, themes, ...), against that phrase filled in
 *    with the value found in the sentence ("radial layout please" ≈ "change layout to radial");
 *  - split into a lead-in and a remainder for a free-text wildcard, the lead-in against the text
 *    before the wildcard and the whole sentence against the phrase filled in with the remainder
 *    ("take me to | users" ≈ "go to users").
 *
 * Pure logic: the embedding function is passed in, so this runs the same in the page and in tests.
 */

export type Embed = (texts: string[]) => Promise<Float32Array[]>;

export interface MatchableCommand {
  phrases: string[];
  /** Other ways of saying it, used only for matching by meaning (annyang never sees them). */
  examples?: string[];
  /** The values a wildcard argument must be one of, if it is restricted. */
  options?: readonly string[];
  /**
   * Words of which at least one must be said for this command to match by meaning. For a command
   * whose phrases lean on a common word: "youtube search" reads as mostly "search" to the model.
   */
  requires?: string[];
}

export interface IntentMatch<C extends MatchableCommand> {
  command: C;
  /** The registered phrase (or example) that matched, e.g. "fit into center" or "go to *node". */
  phrase: string;
  args: string[];
  score: number;
  /** The recognition alternative that matched. */
  heard: string;
}

/** Below this a match is more likely a different command, or not a command at all. */
export const MIN_SCORE = 0.6;
/** Two commands closer than this are a toss-up, so neither is run. */
const MIN_MARGIN = 0.04;
/** Later recognition alternatives are less likely to be what was said. */
const ALTERNATIVE_PENALTY = 0.02;
/** Naming one of a command's fixed values is strong evidence for that command. */
const OPTION_BONUS = 0.05;
/** A free-text split matches loosely ("show me | the info" ≈ "find *node"), so it needs to win clearly. */
const SPLIT_PENALTY = 0.02;
/** Lead-ins this far from a phrase's lead-in aren't worth filling in and embedding. */
const MIN_LEAD_SCORE = 0.35;
/** At most this many filled-in phrases are embedded per sentence. */
const MAX_FILLS = 24;
/** Taken off a phrase that says the opposite of what was said. */
const OPPOSITE_PENALTY = 0.1;

/**
 * Sentence embeddings put opposites close together ("close settings" ≈ "open settings"), since they
 * appear in the same contexts. Saying one of these words rules out phrases with the other.
 */
const OPPOSITES: [string, string][] = [
  ["open", "close"],
  ["show", "hide"],
  ["enable", "disable"],
  ["on", "off"],
  ["in", "out"],
  ["dark", "light"],
  ["darker", "brighter"],
  ["bigger", "smaller"],
  ["closer", "further"],
  ["next", "previous"],
  ["expand", "collapse"],
  ["start", "stop"],
];

const WILDCARD = /\*\w+/;

interface Entry<C> {
  command: C;
  phrase: string;
  /** The text before and after the wildcard, or the whole phrase if it has none. */
  before: string;
  after: string;
  wildcard: boolean;
  words: Set<string>;
  vec?: Float32Array;
}

function oppositePenalty(said: Set<string>, phrase: Set<string>): number {
  for (const [a, b] of OPPOSITES) {
    if ((said.has(a) && !said.has(b) && phrase.has(b) && !phrase.has(a)) || (said.has(b) && !said.has(a) && phrase.has(a) && !phrase.has(b))) {
      return OPPOSITE_PENALTY;
    }
  }
  return 0;
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length];
}

/** Words that sound alike often differ by one letter: "hit"/"fit", "centre"/"center". */
const wordsAlike = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= 3 && editDistance(a, b) <= (Math.min(a.length, b.length) >= 6 ? 2 : 1));

/** How much of the phrase was said and how much of what was said is the phrase, by spelling (F1). */
function spellingScore(said: string[], phrase: string[]): number {
  if (!said.length || !phrase.length) return 0;
  const used = new Set<number>();
  let hits = 0;
  for (const p of phrase) {
    const i = said.findIndex((s, k) => !used.has(k) && wordsAlike(s, p));
    if (i >= 0) {
      used.add(i);
      hits++;
    }
  }
  return (2 * hits) / (said.length + phrase.length);
}

/**
 * The option named in `text`, comparing runs of one to three words with spaces and punctuation
 * dropped ("angled step" → "angled-step", "org chart" → "orgChart"), allowing one wrong letter in
 * longer names since speech recognition misspells them ("circles" → "circle").
 */
export function findOption(text: string, options: readonly string[]): string | null {
  const words = normalize(text).split(" ").filter(Boolean);
  const runs: string[] = [];
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) runs.push(squash(words.slice(i, i + len).join("")));
  }
  for (const run of runs) {
    const exact = options.find((o) => squash(o) === run);
    if (exact) return exact;
  }
  for (const run of runs) {
    if (run.length < 5) continue;
    const near = options.find((o) => editDistance(squash(o), run) <= 1);
    if (near) return near;
  }
  return null;
}

/**
 * The command whose wildcard phrase was said without its argument ("search", "go to"), as happens
 * when the speaker pauses and the recognizer ends the sentence there. Only phrases that end in the
 * wildcard count: "use" alone could be "use *layout layout" or "use *theme theme". Needs no model.
 */
export function findLeadIn<C extends MatchableCommand>(alternatives: string[], commands: C[]): { command: C; phrase: string } | null {
  for (const heard of alternatives.map(normalize)) {
    for (const command of commands) {
      for (const phrase of command.phrases) {
        const [before, after] = phrase.split(WILDCARD);
        if (after === undefined || after.trim()) continue;
        if (normalize(before) === heard) return { command, phrase };
      }
    }
  }
  return null;
}

const cosine = (a: Float32Array, b: Float32Array) => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // the embeddings are normalized
};

const fill = (e: Entry<unknown>, value: string) => normalize(`${e.before} ${value} ${e.after}`);

export class IntentIndex<C extends MatchableCommand> {
  private entries: Entry<C>[] = [];

  constructor(private embed: Embed) {}

  async build(commands: C[]) {
    const entries: Entry<C>[] = commands.flatMap((command) =>
      [...command.phrases, ...(command.examples ?? [])].map((phrase) => {
        const [before, after = ""] = phrase.split(WILDCARD);
        const words = new Set(normalize(`${before} ${after}`).split(" "));
        return { command, phrase, before: normalize(before), after: normalize(after), wildcard: WILDCARD.test(phrase), words };
      }),
    );
    const vecs = await this.embed(entries.map((e) => (e.wildcard ? normalize(`${e.before} ${e.after}`) : e.before)));
    entries.forEach((e, i) => (e.vec = vecs[i]));
    this.entries = entries;
  }

  get isBuilt() {
    return this.entries.length > 0;
  }

  /**
   * The best command for any of the recognition alternatives. `match` is null when nothing is close
   * enough, or when two commands are about equally close ("neon" is both a theme and an edge style):
   * `candidates` then holds them, to ask which was meant rather than guess.
   */
  async match(alternatives: string[], minScore = MIN_SCORE): Promise<{ match: IntentMatch<C> | null; candidates: IntentMatch<C>[] }> {
    const ranked = await this.rank(alternatives);
    const [top, next] = ranked;
    if (!top || top.score < minScore) return { match: null, candidates: [] };
    if (next && top.score - next.score < MIN_MARGIN) {
      return { match: null, candidates: ranked.filter((m) => top.score - m.score < MIN_MARGIN) };
    }
    return { match: top, candidates: [top] };
  }

  /** Every candidate, best first (one per command), for debugging and tuning. */
  async rank(alternatives: string[]): Promise<IntentMatch<C>[]> {
    const heard = [...new Set(alternatives.map(normalize).filter(Boolean))];
    if (!heard.length || !this.entries.length) return [];

    // First pass: every whole sentence and every lead-in of every alternative.
    const texts: string[] = [];
    const plan = heard.map((sentence) => {
      const words = sentence.split(" ");
      return {
        sentence,
        words,
        whole: texts.push(sentence) - 1,
        leads: words.slice(0, -1).map((_, i) => ({
          text: words.slice(0, i + 1).join(" "),
          at: texts.push(words.slice(0, i + 1).join(" ")) - 1,
          rest: words.slice(i + 1).join(" "),
        })),
      };
    });
    const vecs = await this.embed(texts);

    const best = new Map<C, IntentMatch<C>>();
    const argLength = (m: IntentMatch<C>) => m.args.join(" ").length;
    const offer = (m: IntentMatch<C>) => {
      const had = best.get(m.command);
      // On a tie the phrase that explains more of the sentence wins: "search for | x" over "search | for x".
      // Batch padding moves the embeddings a little, so equal texts can differ by ~0.02. Both phrases
      // belong to the same command here, so the generous window can't hand the match to another one.
      const tie = had && Math.abs(m.score - had.score) < 0.03 && argLength(m) !== argLength(had);
      if (!had || (tie ? argLength(m) < argLength(had) : m.score > had.score)) best.set(m.command, m);
    };

    // Second pass: phrases filled in with a value, compared with the whole sentence.
    const fills: { sentence: number; text: string; prior: number; score: (sim: number) => number; match: Omit<IntentMatch<C>, "score"> }[] = [];

    plan.forEach(({ sentence, words, whole, leads }, rank) => {
      const rankPenalty = rank * ALTERNATIVE_PENALTY;
      const said = new Set(words);
      const sentenceFills: typeof fills = [];
      for (const e of this.entries) {
        const { command, phrase } = e;
        if (command.requires && !command.requires.some((r) => words.some((w) => wordsAlike(w, r)))) continue;
        const penalty = rankPenalty + oppositePenalty(said, e.words);
        if (!e.wildcard) {
          const meaning = cosine(vecs[whole], e.vec!);
          const spelling = spellingScore(words, e.before.split(" "));
          const score = Math.max(meaning, (meaning + spelling) / 2) - penalty;
          offer({ command, phrase, args: [], score, heard: sentence });
          continue;
        }
        if (command.options) {
          const option = findOption(sentence, command.options);
          if (option) {
            sentenceFills.push({
              sentence: whole,
              text: fill(e, option),
              prior: 1,
              score: (sim) => sim + OPTION_BONUS - penalty,
              match: { command, phrase, args: [option], heard: sentence },
            });
          }
          continue;
        }
        for (const lead of leads) {
          const leadScore = cosine(vecs[lead.at], e.vec!);
          if (leadScore < MIN_LEAD_SCORE) continue;
          // Only the lead-in is the command: "go to open source" isn't "open".
          const leadPenalty = rankPenalty + oppositePenalty(new Set(lead.text.split(" ")), e.words) + SPLIT_PENALTY;
          sentenceFills.push({
            sentence: whole,
            text: fill(e, lead.rest),
            prior: leadScore,
            // Both halves have to agree: the filled phrase alone always looks like the sentence,
            // since it repeats the remainder word for word.
            score: (sim) => (sim + leadScore) / 2 - leadPenalty,
            match: { command, phrase, args: [lead.rest], heard: sentence },
          });
        }
      }
      sentenceFills.sort((a, b) => b.prior - a.prior);
      fills.push(...sentenceFills.slice(0, MAX_FILLS));
    });

    if (fills.length) {
      const fillVecs = await this.embed(fills.map((f) => f.text));
      fills.forEach((f, i) => offer({ ...f.match, score: f.score(cosine(vecs[f.sentence], fillVecs[i])) }));
    }

    return [...best.values()].sort((a, b) => b.score - a.score);
  }
}
