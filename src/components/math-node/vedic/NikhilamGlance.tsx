/**
 * Nikhilam, animated: one board per case (same base, different bases, sub-base,
 * each with a positive or a negative right part), built from the same plans the
 * lesson uses, so the numbers are always right.
 */
import React from "react";
import { NumberBoxes, type BoxCell } from "./NumberBoxes";
import { GlanceAnimation, type AnimTrack } from "./GlanceAnimation";
import { devCell, plusDev, rightCells, signed } from "./cells";
import { planDifferentBases, planSameBase, planSubBase, type Settle } from "./nikhilam";
import { BODY, STRONG, tr, type Lang } from "./ui";

export type NikhilamCase = "same" | "sameNeg" | "diff" | "diffNeg" | "sub" | "subNeg";

export const NIKHILAM_CASES: { id: NikhilamCase; en: string; hi: string; a: number; b: number; sub?: number }[] = [
  { id: "same", en: "Same base", hi: "एक बेस", a: 92, b: 98 },
  { id: "sameNeg", en: "Same base, negative", hi: "एक बेस, माइनस", a: 102, b: 98 },
  { id: "diff", en: "Different bases", hi: "अलग बेस", a: 998, b: 98 },
  { id: "diffNeg", en: "Different bases, negative", hi: "अलग बेस, माइनस", a: 1002, b: 98 },
  { id: "sub", en: "Sub-base", hi: "सब-बेस", a: 22, b: 23, sub: 20 },
  { id: "subNeg", en: "Sub-base, negative", hi: "सब-बेस, माइनस", a: 37, b: 47, sub: 40 },
];

interface Line {
  id: string;
  strong: string;
  rest: string;
}

interface Scene {
  rows: { n: number; dev: number; note: string }[];
  left: number;
  leftHow: string;
  right: number;
  width: number;
  settle: Settle;
  lines: Line[];
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** The settle line: how a negative right part (or a too-long one) is put right. */
function settleLine(s: Settle, t: (en: string, hi: string) => string): Line | null {
  if (s.carry)
    return { id: "line4", strong: `${s.left0} + ${s.carry} = ${s.left}`, rest: t(`too many digits: ${s.carry} moves left`, `अंक ज़्यादा: ${s.carry} बाएँ गया`) };
  if (s.right0 >= 0) return null;
  const rest = pad(s.rest, s.width);
  const borrow = s.borrow ? `${s.left0} − ${s.borrow} = ${s.left0 - s.borrow}, ` : "";
  return {
    id: "line4",
    strong: `${borrow}${s.unit} − ${rest} = ${pad(s.complement ?? 0, s.width)}, ${s.left + 1} − 1 = ${s.left}`,
    rest: t("negative: complement, and 1 less on the left", "माइनस: पूरक, और बाएँ से 1 कम"),
  };
}

function buildScene(c: (typeof NIKHILAM_CASES)[number], t: (en: string, hi: string) => string): Scene | null {
  const base = t("base", "बेस");
  if (c.id === "same" || c.id === "sameNeg") {
    const p = planSameBase(c.a, c.b).plan;
    if (!p) return null;
    const lines: Line[] = [
      { id: "line1", strong: `${c.a} = ${signed(p.a.dev)}, ${c.b} = ${signed(p.b.dev)}`, rest: t(`deviations from ${p.base}`, `${p.base} से विचलन`) },
      { id: "line2", strong: `${plusDev(c.a, p.b.dev)} = ${p.left}`, rest: t("left: cross-operation", "बायाँ: तिरछा हिसाब") },
      { id: "line3", strong: `(${signed(p.a.dev)}) × (${signed(p.b.dev)}) = ${signed(p.right)}`, rest: t(`right: ${p.width} digits`, `दायाँ: ${p.width} अंक`) },
    ];
    return {
      rows: [
        { n: c.a, dev: p.a.dev, note: `${base} ${p.base}` },
        { n: c.b, dev: p.b.dev, note: "" },
      ],
      left: p.left,
      leftHow: plusDev(c.a, p.b.dev),
      right: p.right,
      width: p.width,
      settle: p.settle,
      lines,
    };
  }
  if (c.id === "diff" || c.id === "diffNeg") {
    const p = planDifferentBases(c.a, c.b).plan;
    if (!p) return null;
    const { big, small } = p;
    const how = p.sameSign
      ? p.digitTo !== null
        ? `${plusDev(p.digitFrom, small.dev)} = ${p.digitTo} → ${p.left}`
        : `${plusDev(big.n, small.dev * p.ratio)} = ${p.left}`
      : `${small.n}×${p.ratio} ${big.dev < 0 ? "−" : "+"} ${Math.abs(big.dev)} = ${p.left}`;
    const lines: Line[] = [
      {
        id: "line1",
        strong: `${big.n} = ${signed(big.dev)}, ${small.n} = ${signed(small.dev)}`,
        rest: t(`bases ${big.base} and ${small.base}; right part: ${p.width} digits`, `बेस ${big.base} और ${small.base}; दायाँ: ${p.width} अंक`),
      },
      {
        id: "line2",
        strong: how,
        rest: p.sameSign
          ? t(`left: ${small.n} lined up under ${big.n}, one digit changed`, `बायाँ: ${small.n} को ${big.n} के नीचे लिखकर, एक अंक बदला`)
          : t(`left: base ratio ${big.base} ÷ ${small.base} = ${p.ratio}`, `बायाँ: बेस अनुपात ${big.base} ÷ ${small.base} = ${p.ratio}`),
      },
      { id: "line3", strong: `(${signed(big.dev)}) × (${signed(small.dev)}) = ${signed(p.right)}`, rest: t(`right: ${p.width} digits`, `दायाँ: ${p.width} अंक`) },
    ];
    return {
      rows: [
        { n: big.n, dev: big.dev, note: `${base} ${big.base}` },
        { n: small.n, dev: small.dev, note: `${base} ${small.base}` },
      ],
      left: p.left,
      leftHow: p.sameSign ? (p.digitTo !== null ? `${p.digitFrom} → ${p.digitTo}` : plusDev(big.n, small.dev * p.ratio)) : `${small.n}×${p.ratio} ${big.dev < 0 ? "−" : "+"} ${Math.abs(big.dev)}`,
      right: p.right,
      width: p.width,
      settle: p.settle,
      lines,
    };
  }
  const p = planSubBase(c.a, c.b, c.sub!).plan;
  if (!p) return null;
  const ten = 10 ** p.power;
  const lines: Line[] = [
    { id: "line1", strong: `${c.a} = ${signed(p.a.dev)}, ${c.b} = ${signed(p.b.dev)}`, rest: t(`sub-base ${c.sub} = ${p.multiplier} × ${ten}`, `सब-बेस ${c.sub} = ${p.multiplier} × ${ten}`) },
    { id: "line2", strong: `${plusDev(c.a, p.b.dev)} = ${p.cross}, × ${p.multiplier} = ${p.left}`, rest: t("left: cross, then × the multiplier", "बायाँ: तिरछा, फिर गुणक से गुणा") },
    { id: "line3", strong: `(${signed(p.a.dev)}) × (${signed(p.b.dev)}) = ${signed(p.right)}`, rest: t(`right: ${p.width} digit${p.width > 1 ? "s" : ""}`, `दायाँ: ${p.width} अंक`) },
  ];
  return {
    rows: [
      { n: c.a, dev: p.a.dev, note: `${base} ${c.sub}` },
      { n: c.b, dev: p.b.dev, note: "" },
    ],
    left: p.left,
    leftHow: `(${plusDev(c.a, p.b.dev)}) × ${p.multiplier}`,
    right: p.right,
    width: p.width,
    settle: p.settle,
    lines,
  };
}

/** The script: deviations, then left, then right, then (if needed) settling, then the answer. */
function buildTracks(settles: boolean, answerLength: number): { tracks: AnimTrack[]; total: number } {
  const tracks: AnimTrack[] = [
    { id: "na", kind: "fadeUp", at: 0 },
    { id: "line1", kind: "fadeUp", at: 250 },
    { id: "da", kind: "pop", at: 300 },
    { id: "nb", kind: "fadeUp", at: 500 },
    { id: "db", kind: "pop", at: 750 },
    // Left: one number with the other's deviation, across.
    { id: "rule", kind: "fade", at: 1300 },
    { id: "line2", kind: "fadeUp", at: 1300 },
    { id: "na", kind: "pulse", at: 1350 },
    { id: "db-c", kind: "glow", at: 1350 },
    { id: "left", kind: "fadeUp", at: 1800 },
    // Right: the deviations multiplied.
    { id: "line3", kind: "fadeUp", at: 2700 },
    { id: "da-c", kind: "glow", at: 2700 },
    { id: "db-c", kind: "glow", at: 2700 },
    { id: "right", kind: "fadeUp", at: 3150 },
  ];
  let next = 4000;
  if (settles) {
    tracks.push(
      { id: "line4", kind: "fadeUp", at: 4000 },
      { id: "right", kind: "pulse", at: 4000 },
      { id: "settle-mark", kind: "fade", at: 4300 },
      { id: "left2", kind: "fadeUp", at: 4450 },
      { id: "right2", kind: "fadeUp", at: 4550 },
    );
    next = 5400;
  }
  tracks.push({ id: "line5", kind: "fadeUp", at: next }, { id: "eq", kind: "fade", at: next }, { id: "ans", kind: "fadeUp", at: next + 50 });
  for (let i = 0; i < answerLength; i++) tracks.push({ id: `r${i}`, kind: "pop", at: next + 200 + i * 110 });
  return { tracks, total: next + 200 + answerLength * 110 + 700 };
}

const ResultRow: React.FC<{ left: number; right: BoxCell[]; leftId: string; rightId: string; leftNote?: string; rightNote?: string; gap: number; mark?: boolean }> = ({
  left,
  right,
  leftId,
  rightId,
  leftNote,
  rightNote,
  gap,
  mark,
}) => (
  <>
    <div data-anim={leftId} className="flex items-center justify-end gap-2 pr-3">
      {mark && (
        <span data-anim="settle-mark" className="text-lg text-slate-400 dark:text-slate-500">
          →
        </span>
      )}
      <NumberBoxes groups={[{ digits: String(left), tone: "done", caption: leftNote }]} gap={gap} separator={null} />
    </div>
    <div data-anim={rightId} className="flex items-center self-stretch border-l-2 border-orange-400 pl-3 dark:border-orange-500">
      <NumberBoxes groups={[{ cells: right, caption: rightNote }]} gap={gap} separator={null} />
    </div>
  </>
);

export const NikhilamGlance: React.FC<{ caseId: NikhilamCase; lang: Lang; gap: number }> = ({ caseId, lang, gap }) => {
  const t = tr(lang);
  // Built once per case and language: new tracks would restart the animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = React.useMemo(() => buildScene(NIKHILAM_CASES.find((x) => x.id === caseId) ?? NIKHILAM_CASES[0], t), [caseId, lang]);
  const settles = !!s && (s.settle.carry > 0 || s.settle.right0 < 0);
  const answerLength = s?.settle.answer.length ?? 0;
  const { tracks, total } = React.useMemo(() => buildTracks(settles, answerLength), [settles, answerLength]);
  if (!s) return null;
  const extra = settleLine(s.settle, t);
  const lines: Line[] = [...s.lines, ...(extra ? [extra] : []), { id: "line5", strong: `${s.settle.left} | ${s.settle.rightText}`, rest: s.settle.answer }];
  const ids = ["a", "b"] as const;

  return (
    <GlanceAnimation key={`${caseId}-${gap}`} tracks={tracks} total={total} lang={lang}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="inline-grid grid-cols-[auto_auto] items-center gap-y-1.5">
          {s.rows.map((r, i) => (
            <React.Fragment key={i}>
              <div className="flex justify-end pr-3">
                <NumberBoxes groups={[{ id: `n${ids[i]}`, digits: String(r.n), caption: r.note || undefined }]} gap={gap} separator={null} />
              </div>
              <div data-anim={`d${ids[i]}`} className="flex items-center self-stretch border-l-2 border-orange-400 pl-3 dark:border-orange-500">
                <NumberBoxes groups={[{ cells: [{ ...devCell(r.dev), id: `d${ids[i]}-c` }] }]} gap={gap} separator={null} />
              </div>
            </React.Fragment>
          ))}
          <div data-anim="rule" className="col-span-2 my-1 border-t-2 border-slate-300 dark:border-slate-600" />
          <ResultRow left={s.left} right={rightCells(s.right, s.width)} leftId="left" rightId="right" leftNote={s.leftHow} rightNote={`(${signed(s.rows[0].dev)}) × (${signed(s.rows[1].dev)})`} gap={gap} />
          {settles && <ResultRow left={s.settle.left} right={rightCells(s.settle.right, s.width)} leftId="left2" rightId="right2" gap={gap} mark />}
        </div>
        {/* "=" wraps with the answer, never alone. */}
        <span className="inline-flex items-center gap-x-4">
          <span data-anim="eq" className="text-2xl text-slate-300 dark:text-slate-600">
            =
          </span>
          <NumberBoxes groups={[{ id: "ans", tone: "answer", cells: [...s.settle.answer].map((v, i) => ({ v, id: `r${i}` })) }]} gap={gap} separator={null} size="lg" />
        </span>
      </div>
      <ul className={`mt-3 flex flex-col gap-1 tabular-nums ${BODY}`}>
        {lines.map((l) => (
          <li key={l.id} data-anim={l.id}>
            <b className={STRONG}>{l.strong}</b> → {l.rest}
          </li>
        ))}
      </ul>
    </GlanceAnimation>
  );
};
