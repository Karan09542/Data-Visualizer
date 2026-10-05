/**
 * Animated examples told as beats: each beat is a line of explanation with its own
 * picture, and both come in together; pieces inside a picture (or an earlier one) can
 * pop, glow or draw at their own moments. Played by GlanceAnimation, so play, pause,
 * replay and the timeline work as in the other lessons.
 */
import React, { useMemo, useState } from "react";
import { GlanceAnimation, type AnimTrack } from "./GlanceAnimation";
import { BODY, STRONG, type Lang } from "./ui";

export interface Beat {
  /** The line: its bold part and what it means. */
  strong: string;
  rest?: string;
  /** The picture that comes in with the line. */
  visual?: React.ReactNode;
  /** Tracks for pieces with their own data-anim handles, timed from this beat's start. */
  extra?: AnimTrack[];
  /** How long until the next beat, in ms. */
  dur?: number;
}

const BEAT = 1400;

export function beatTracks(beats: Beat[]): { tracks: AnimTrack[]; total: number } {
  const tracks: AnimTrack[] = [];
  let at = 0;
  beats.forEach((b, i) => {
    tracks.push({ id: `line${i}`, kind: "fadeUp", at });
    if (b.visual) tracks.push({ id: `v${i}`, kind: "fadeUp", at: at + 120 });
    for (const x of b.extra ?? []) tracks.push({ ...x, at: at + x.at });
    at += b.dur ?? BEAT;
  });
  return { tracks, total: at + 400 };
}

export const BeatsGlance: React.FC<{ beats: Beat[]; lang: Lang; caseKey: string }> = ({ beats, lang, caseKey }) => {
  // The timing belongs to the case: rebuilt when it changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { tracks, total } = useMemo(() => beatTracks(beats), [caseKey]);
  return (
    <GlanceAnimation key={caseKey} tracks={tracks} total={total} lang={lang}>
      <div className="flex flex-col items-start gap-3 pb-1">
        {beats.map((b, i) =>
          b.visual ? (
            <div key={i} data-anim={`v${i}`} className="max-w-full">
              {b.visual}
            </div>
          ) : null,
        )}
      </div>
      <ul className={`mt-3 flex flex-col gap-1 tabular-nums ${BODY}`}>
        {beats.map((b, i) => (
          <li key={i} data-anim={`line${i}`}>
            <b className={STRONG}>{b.strong}</b>
            {b.rest && <> → {b.rest}</>}
          </li>
        ))}
      </ul>
    </GlanceAnimation>
  );
};

export const chipClass = (on: boolean) =>
  `h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
  }`;

export interface GlanceCase {
  en: string;
  hi: string;
  /** The example itself, shown after the name: "96²", "1/7". */
  sub: string;
  beats: () => Beat[];
}

/** Example chips, and the chosen example played. */
export const AnimatedExamples: React.FC<{ id: string; cases: GlanceCase[]; lang: Lang; gap: number }> = ({ id, cases, lang, gap }) => {
  const [index, setIndex] = useState(0);
  const c = cases[index] ?? cases[0];
  return (
    <div className="mt-4 flex flex-col gap-3">
      {cases.length > 1 && (
        <div role="radiogroup" aria-label={lang === "hi" ? "उदाहरण" : "Example"} className="flex flex-wrap gap-1.5">
          {cases.map((gc, i) => {
            const on = i === index;
            return (
              <button key={i} type="button" role="radio" aria-checked={on} onClick={() => setIndex(i)} className={chipClass(on)}>
                {lang === "hi" ? gc.hi : gc.en}
                <span className={`ml-1.5 tabular-nums ${on ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>{gc.sub}</span>
              </button>
            );
          })}
        </div>
      )}
      <BeatsGlance beats={c.beats()} lang={lang} caseKey={`${id}-${index}-${gap}`} />
    </div>
  );
};

/** Tracks that pop pieces one after another: ids, starting at `at`, `step` apart. */
export const stagger = (ids: string[], at: number, step: number, kind: AnimTrack["kind"] = "pop"): AnimTrack[] =>
  ids.map((id, i) => ({ id, kind, at: at + i * step }));

/** An arrow from NumberBoxes drawing itself in: its line, then its label, then its head. */
export const arrowIn = (id: string, at: number): AnimTrack[] => [
  { id, kind: "draw", at },
  { id: `${id}-label`, kind: "pop", at: at + 200 },
  { id: `${id}-head`, kind: "fade", at: at + 550, dur: 150 },
];

/** A group from NumberBoxes coming in after the rest of its row: the group and its separator. */
export const groupIn = (id: string, at: number): AnimTrack[] => [
  { id: `${id}-sep`, kind: "fade", at },
  { id, kind: "pop", at: at + 100 },
];
