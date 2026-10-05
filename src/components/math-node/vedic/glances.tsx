/**
 * The animated "at a glance" examples: one scene per method, the same boxes the
 * lessons use, with a script (tracks) saying when each piece comes in.
 */
import React from "react";
import { FitWidth, NumberBoxes } from "./NumberBoxes";
import { GlanceAnimation, type AnimTrack } from "./GlanceAnimation";
import { twoDigitCells } from "./cells";
import { BODY, STRONG, tr, type Lang } from "./ui";

interface Line {
  id: string;
  strong: string;
  rest: string;
}

const Lines: React.FC<{ lines: Line[] }> = ({ lines }) => (
  <ul className={`mt-3 flex flex-col gap-1 tabular-nums ${BODY}`}>
    {lines.map((l) => (
      <li key={l.id} data-anim={l.id}>
        <b className={STRONG}>{l.strong}</b> → {l.rest}
      </li>
    ))}
  </ul>
);

const EQUALS = "text-2xl text-slate-300 dark:text-slate-600";

// ─── Balancing Rule: 173 × 5 → 05/35/15 → 865 ────────────────────────────────

const BALANCING_TRACKS: AnimTrack[] = [
  { id: "g0", kind: "fadeUp", at: 0 },
  { id: "g1-sep", kind: "fade", at: 100 },
  { id: "g1", kind: "fadeUp", at: 120 },
  { id: "g2-sep", kind: "fade", at: 220 },
  { id: "g2", kind: "fadeUp", at: 240 },
  { id: "eq", kind: "fade", at: 600 },
  { id: "ans", kind: "fadeUp", at: 650 },
  // Ones: 15 keeps 5, sends 1 left.
  { id: "line1", kind: "fadeUp", at: 1000 },
  { id: "g2", kind: "pulse", at: 1000 },
  { id: "r2", kind: "pop", at: 1350 },
  { id: "a1", kind: "draw", at: 1650 },
  { id: "a1-label", kind: "pop", at: 1850 },
  { id: "a1-head", kind: "fade", at: 2200, dur: 150 },
  // Tens: 35 + 1 = 36 keeps 6, sends 3 left.
  { id: "line2", kind: "fadeUp", at: 2550 },
  { id: "g1", kind: "pulse", at: 2550 },
  { id: "r1", kind: "pop", at: 2900 },
  { id: "a2", kind: "draw", at: 3200 },
  { id: "a2-label", kind: "pop", at: 3400 },
  { id: "a2-head", kind: "fade", at: 3750, dur: 150 },
  // Hundreds: 05 + 3 = 8.
  { id: "line3", kind: "fadeUp", at: 4100 },
  { id: "g0", kind: "pulse", at: 4100 },
  { id: "r0", kind: "pop", at: 4450 },
];

export const BalancingGlance: React.FC<{ lang: Lang; gap: number; animate: boolean }> = ({ lang, gap, animate }) => {
  const t = tr(lang);
  const scene = (
    <>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 pb-1">
        <NumberBoxes
          groups={[
            { id: "g0", cells: [{ v: "0" }, { v: "5" }] },
            { id: "g1", cells: [{ v: "3", tone: "carry" }, { v: "5" }] },
            { id: "g2", cells: [{ v: "1", tone: "carry" }, { v: "5" }] },
          ]}
          arrows={[
            { id: "a1", from: 2, to: 1, label: "+1" },
            { id: "a2", from: 1, to: 0, label: "+3" },
          ]}
          gap={gap}
          size="lg"
        />
        {/* "=" wraps with the answer, never alone. */}
        <span className="inline-flex items-center gap-x-5">
          <span data-anim="eq" className={EQUALS}>
            =
          </span>
          <NumberBoxes
            groups={[
              {
                id: "ans",
                tone: "answer",
                cells: [
                  { v: "8", id: "r0" },
                  { v: "6", id: "r1" },
                  { v: "5", id: "r2" },
                ],
              },
            ]}
            separator={null}
            gap={gap}
            size="lg"
          />
        </span>
      </div>
      <Lines
        lines={[
          { id: "line1", strong: "15", rest: t("keep 5, send 1 left", "5 रखो, 1 बाएँ भेजो") },
          { id: "line2", strong: "35 + 1 = 36", rest: t("keep 6, send 3 left", "6 रखो, 3 बाएँ भेजो") },
          { id: "line3", strong: "05 + 3 = 8", rest: t("write 8", "8 लिखो") },
        ]}
      />
    </>
  );
  return animate ? (
    <GlanceAnimation key={gap} tracks={BALANCING_TRACKS} total={5200} lang={lang}>
      {scene}
    </GlanceAnimation>
  ) : (
    <div className="mt-2 overflow-x-auto">{scene}</div>
  );
};

// ─── Ekadhikena Purvena and Vilokanam: a × b = left | right = answer ─────────

interface PairScene {
  a: [string, string];
  b: [string, string];
  left: string;
  leftHow: string;
  right: number;
  rightHow: string;
  answer: string;
  lines: Line[];
}

/** The tracks are the same story for both: check, left part, right part, answer. */
const pairTracks = (answerLength: number): AnimTrack[] => [
  { id: "n1", kind: "fadeUp", at: 0 },
  { id: "n2-sep", kind: "fade", at: 120 },
  { id: "n2", kind: "fadeUp", at: 150 },
  // Check the two conditions.
  { id: "line1", kind: "fadeUp", at: 650 },
  { id: "t1", kind: "glow", at: 650 },
  { id: "t2", kind: "glow", at: 650 },
  { id: "u1", kind: "glow", at: 1100 },
  { id: "u2", kind: "glow", at: 1100 },
  // Left part, from the tens.
  { id: "line2", kind: "fadeUp", at: 1950 },
  { id: "t1", kind: "glow", at: 1950 },
  { id: "t2", kind: "glow", at: 1950 },
  { id: "a1", kind: "draw", at: 2050 },
  { id: "a1-label", kind: "pop", at: 2250 },
  { id: "a1-head", kind: "fade", at: 2600, dur: 150 },
  { id: "left-sep", kind: "fade", at: 2550 },
  { id: "left", kind: "fadeUp", at: 2600 },
  // Right part, from the units.
  { id: "line3", kind: "fadeUp", at: 3200 },
  { id: "u1", kind: "glow", at: 3200 },
  { id: "u2", kind: "glow", at: 3200 },
  { id: "right-sep", kind: "fade", at: 3500 },
  { id: "right", kind: "fadeUp", at: 3550 },
  // Side by side: the answer.
  { id: "line4", kind: "fadeUp", at: 4150 },
  { id: "ans-sep", kind: "fade", at: 4150 },
  { id: "ans", kind: "fadeUp", at: 4200 },
  ...Array.from({ length: answerLength }, (_, i): AnimTrack => ({ id: `r${i}`, kind: "pop", at: 4350 + i * 110 })),
];
const PAIR_TOTAL = 5400;

const PairGlance: React.FC<{ s: PairScene; tracks: AnimTrack[]; lang: Lang; gap: number; animate: boolean }> = ({ s, tracks, lang, gap, animate }) => {
  const scene = (
    <>
      <FitWidth>
      <NumberBoxes
        groups={[
          {
            id: "n1",
            cells: [
              { v: s.a[0], tone: "added", id: "t1" },
              { v: s.a[1], tone: "active", id: "u1" },
            ],
          },
          {
            id: "n2",
            sepBefore: "×",
            cells: [
              { v: s.b[0], tone: "added", id: "t2" },
              { v: s.b[1], tone: "active", id: "u2" },
            ],
          },
          { id: "left", sepBefore: "=", digits: s.left, tone: "done", caption: s.leftHow },
          { id: "right", sepBefore: "|", cells: twoDigitCells(s.right), caption: s.rightHow },
          { id: "ans", sepBefore: "=", tone: "answer", cells: [...s.answer].map((v, i) => ({ v, id: `r${i}` })) },
        ]}
        // From the tens box (the first quarter of the group) to the left part.
        arrows={[{ id: "a1", from: 0, to: 2, label: s.leftHow, fromAt: 0.25, toAt: 0.4 }]}
        gap={gap}
        size="md"
      />
      </FitWidth>
      <Lines lines={s.lines} />
    </>
  );
  return animate ? (
    <GlanceAnimation key={gap} tracks={tracks} total={PAIR_TOTAL} lang={lang}>
      {scene}
    </GlanceAnimation>
  ) : (
    <div className="mt-2 overflow-x-auto">{scene}</div>
  );
};

const EKADHIKENA_TRACKS = pairTracks(4);
export const EkadhikenaGlance: React.FC<{ lang: Lang; gap: number; animate: boolean }> = ({ lang, gap, animate }) => {
  const t = tr(lang);
  return (
    <PairGlance
      s={{
        a: ["5", "3"],
        b: ["5", "7"],
        left: "30",
        leftHow: "5 × 6",
        right: 21,
        rightHow: "3 × 7",
        answer: "3021",
        lines: [
          { id: "line1", strong: "5 = 5, 3 + 7 = 10", rest: t("same tens, units make 10 ✓", "दहाई एक जैसी, इकाई का जोड़ 10 ✓") },
          { id: "line2", strong: "5 × (5 + 1) = 30", rest: t("the left part", "बायाँ हिस्सा") },
          { id: "line3", strong: "3 × 7 = 21", rest: t("the right part", "दायाँ हिस्सा") },
          { id: "line4", strong: "30 | 21", rest: "3021" },
        ],
      }}
      tracks={EKADHIKENA_TRACKS}
      lang={lang}
      gap={gap}
      animate={animate}
    />
  );
};

const VILOKANAM_TRACKS = pairTracks(4);
export const VilokanamGlance: React.FC<{ lang: Lang; gap: number; animate: boolean }> = ({ lang, gap, animate }) => {
  const t = tr(lang);
  return (
    <PairGlance
      s={{
        a: ["4", "4"],
        b: ["6", "4"],
        left: "28",
        leftHow: "4×6 + 4",
        right: 16,
        rightHow: "4 × 4",
        answer: "2816",
        lines: [
          { id: "line1", strong: "4 + 6 = 10, 4 = 4", rest: t("tens make 10, same units ✓", "दहाई का जोड़ 10, इकाई एक जैसी ✓") },
          { id: "line2", strong: "4 × 6 + 4 = 28", rest: t("the left part", "बायाँ हिस्सा") },
          { id: "line3", strong: "4 × 4 = 16", rest: t("the right part", "दायाँ हिस्सा") },
          { id: "line4", strong: "28 | 16", rest: "2816" },
        ],
      }}
      tracks={VILOKANAM_TRACKS}
      lang={lang}
      gap={gap}
      animate={animate}
    />
  );
};
