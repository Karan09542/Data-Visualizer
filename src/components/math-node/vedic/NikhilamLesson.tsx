import React, { useState } from "react";
import { NumberBoxes, type BoxArrow, type BoxCell, type BoxGroup } from "./NumberBoxes";
import { carryArrowAt, devCell, plusDev, rightCells, signed } from "./cells";
import {
  nearestBase,
  parseSubBase,
  planDifferentBases,
  planSameBase,
  planSubBase,
  suggestSubBase,
  type Settle,
} from "./nikhilam";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, Segmented, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { NIKHILAM_CASES, NikhilamGlance, type NikhilamCase } from "./NikhilamGlance";

type Mode = "same" | "different" | "sub";

const EXAMPLES: Record<Mode, [number, number, number?][]> = {
  same: [
    [92, 98],
    [102, 98],
    [97, 96],
    [103, 104],
    [998, 997],
    [12, 13],
  ],
  different: [
    [998, 98],
    [1002, 98],
    [997, 95],
    [1003, 102],
  ],
  sub: [
    [22, 23, 20],
    [37, 47, 40],
    [52, 48, 50],
    [198, 204, 200],
  ],
};

const MINUS = "−";

/**
 * The Nikhilam board: each number with its deviation beside it, split by a line,
 * and under a rule the left | right result.
 */
const Board: React.FC<{
  rows: { n: number; dev: number; note?: string }[];
  result?: { left: number; leftNote?: string; right: BoxCell[]; rightNote?: string };
  gap: number;
}> = ({ rows, result, gap }) => (
  <div className="inline-grid grid-cols-[auto_auto] items-center gap-y-1.5">
    {rows.map((r, i) => (
      <React.Fragment key={i}>
        <div className="flex justify-end pr-3">
          <NumberBoxes groups={[{ digits: String(r.n), caption: r.note }]} gap={gap} separator={null} />
        </div>
        <div className="flex items-center self-stretch border-l-2 border-orange-400 pl-3 dark:border-orange-500">
          <NumberBoxes groups={[{ cells: [devCell(r.dev)] }]} gap={gap} separator={null} />
        </div>
      </React.Fragment>
    ))}
    {result && (
      <>
        <div className="col-span-2 my-1 border-t-2 border-slate-300 dark:border-slate-600" />
        <div className="flex justify-end pr-3">
          <NumberBoxes groups={[{ digits: String(result.left), tone: "done", caption: result.leftNote }]} gap={gap} separator={null} />
        </div>
        <div className="flex items-center self-stretch border-l-2 border-orange-400 pl-3 dark:border-orange-500">
          <NumberBoxes groups={[{ cells: result.right, caption: result.rightNote }]} gap={gap} separator={null} />
        </div>
      </>
    )}
  </div>
);

/** Digits on a grid, so one number can be lined up under another: 998 over 98_. */
const DigitGrid: React.FC<{ cols: number; rows: { label?: string; start: number; cells: BoxCell[] }[] }> = ({ cols, rows }) => (
  <div className="inline-grid items-center gap-x-1.5 gap-y-2" style={{ gridTemplateColumns: `auto repeat(${cols}, auto)` }}>
    {rows.map((r, ri) => (
      <React.Fragment key={ri}>
        <span className="pr-1 text-right text-lg text-slate-400 dark:text-slate-500" style={{ gridRow: ri + 1, gridColumn: 1 }}>
          {r.label ?? ""}
        </span>
        {r.cells.map((c, ci) => (
          <div key={ci} style={{ gridRow: ri + 1, gridColumn: r.start + ci + 2 }}>
            <NumberBoxes groups={[{ cells: [c] }]} separator={null} />
          </div>
        ))}
      </React.Fragment>
    ))}
  </div>
);

/** Nikhilam Navatashcaramam Dashatah: multiplying numbers near a base, in five cases. */
export const NikhilamLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("same");
  const [a, setA] = useState("92");
  const [b, setB] = useState("98");
  const [sub, setSub] = useState("20");
  const [animate, setAnimate] = useAnimate();
  const [glanceCase, setGlanceCase] = useState<NikhilamCase>("same");
  const [spaced, setSpaced, gap] = useBoxGap();

  const load = (m: Mode, [x, y, s]: [number, number, number?]) => {
    setMode(m);
    setA(String(x));
    setB(String(y));
    if (s) setSub(String(s));
  };
  const changeNumber = (set: (v: string) => void, other: string) => (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 5);
    set(clean);
    // A new pair gets the sub-base nearest it.
    if (mode === "sub" && clean && other) setSub(String(suggestSubBase(Number(clean), Number(other))));
  };

  const x = Number(a);
  const y = Number(b);
  const empty = a === "" || b === "" || (mode === "sub" && sub === "");

  // ── The settling step: carry, or complement with 1 less on the left ─────────
  const settleStep = (s: Settle, widthWhy: string): StepView | null => {
    if (s.carry === 0 && s.right0 >= 0) return null;
    const before: BoxGroup[] = [{ digits: String(s.left0), tone: "done" }, { cells: rightCells(s.right0, s.width) }];
    const after: BoxGroup[] = [{ digits: String(s.left), tone: "done" }, { cells: rightCells(s.right, s.width) }];
    const taken = s.borrow + (s.complement !== null ? 1 : 0);
    // A carry leaves from its extra leading digits; both land on the last digit of the left part.
    const leftCells = String(s.left0).length;
    const at = s.carry ? carryArrowAt(String(s.right0).length - s.width, leftCells) : { toCell: leftCells - 1 };
    const arrows: BoxArrow[] = [{ from: 1, to: 0, label: s.carry ? `+${s.carry}` : `${MINUS}${taken}`, ...at }];
    const visual = (
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <NumberBoxes groups={before} arrows={arrows} gap={gap} separator="|" />
        <span className="pb-2 text-xl text-slate-300 dark:text-slate-600">→</span>
        <NumberBoxes groups={after} gap={gap} separator="|" />
      </div>
    );
    if (s.carry)
      return {
        title: t("Too many digits: balance", "अंक ज़्यादा: बैलेंस करो"),
        body: t(
          `${s.right0} has more than ${s.width} digit${s.width > 1 ? "s" : ""} (${widthWhy}): ${s.carry} moves to the left. ${s.left0} + ${s.carry} = ${s.left}, right ${s.rightText}.`,
          `${s.right0} में ${s.width} से ज़्यादा अंक हैं (${widthWhy}): ${s.carry} बाएँ जाएगा। ${s.left0} + ${s.carry} = ${s.left}, दायाँ ${s.rightText}।`,
        ),
        visual,
      };
    const restText = String(s.rest).padStart(s.width, "0");
    return {
      title: t("Negative right part: complement, and 1 less on the left", "दायाँ हिस्सा माइनस: पूरक लो, और बाएँ से 1 कम"),
      body: (
        <>
          {s.borrow > 0 &&
            t(
              `${MINUS}${-s.right0} has more than ${s.width} digit${s.width > 1 ? "s" : ""}: its ${s.borrow} moves left first, ${s.left0} − ${s.borrow} = ${s.left0 - s.borrow}, leaving ${MINUS}${restText}. `,
              `${MINUS}${-s.right0} में ${s.width} से ज़्यादा अंक: पहले इसका ${s.borrow} बाएँ जाता है, ${s.left0} − ${s.borrow} = ${s.left0 - s.borrow}, बचा ${MINUS}${restText}। `,
            )}
          {s.complement !== null &&
            t(
              `Complement from ${s.unit}: ${s.unit} − ${restText} = ${String(s.complement).padStart(s.width, "0")}, and 1 less on the left: ${s.left + 1} − 1 = ${s.left}.`,
              `${s.unit} से पूरक: ${s.unit} − ${restText} = ${String(s.complement).padStart(s.width, "0")}, और बाएँ से 1 कम: ${s.left + 1} − 1 = ${s.left}।`,
            )}
        </>
      ),
      visual,
    };
  };
  const answerStep = (s: Settle, check: string): StepView => ({
    title: t("Answer", "जवाब"),
    body: (
      <span className="tabular-nums">
        {s.left} | {s.rightText} → {s.answer}. {t("Check: ", "जाँच: ")}
        {check} = {x * y} ✓
      </span>
    ),
    visual: (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <NumberBoxes groups={[{ digits: String(s.left), tone: "done" }, { cells: rightCells(s.right, s.width) }]} gap={gap} separator="|" />
        {/* "=" wraps with the answer, never alone. */}
        <span className="inline-flex items-center gap-x-4">
          <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
          <NumberBoxes groups={[{ digits: s.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </span>
      </div>
    ),
  });
  const rightStep = (da: number, db: number, R: number, width: number, why: string): StepView => ({
    title: t("Right part: multiply the deviations", "दायाँ हिस्सा: विचलनों का गुणा"),
    body: (
      <>
        <b className={STRONG}>
          ({signed(da)}) × ({signed(db)}) = {signed(R)}
        </b>
        {t(`. ${why.charAt(0).toUpperCase() + why.slice(1)}, so the right part has ${width} digit${width > 1 ? "s" : ""}.`, `। ${why}, तो दाएँ हिस्से में ${width} अंक।`)}
      </>
    ),
    visual: <NumberBoxes groups={[{ cells: rightCells(R, width), caption: `(${signed(da)}) × (${signed(db)})` }]} gap={gap} separator={null} />,
  });

  // ── The steps for each case ──────────────────────────────────────────────────
  let error: string | null = empty ? t("Type the numbers.", "नंबर लिखो।") : null;
  const steps: StepView[] = [];
  if (!empty && mode === "same") {
    const r = planSameBase(x, y);
    if (r.miss)
      error =
        r.miss.reason === "range"
          ? t("Use whole numbers from 1 to 99999.", "1 से 99999 तक के पूरे नंबर लो।")
          : t(`${x} is near ${nearestBase(x)} but ${y} is near ${nearestBase(y)}: try "Different bases".`, `${x} का बेस ${nearestBase(x)} है पर ${y} का ${nearestBase(y)}: "अलग बेस" आज़माओ।`);
    else {
      const p = r.plan;
      const why = t(`${p.base} has ${p.width} zero${p.width > 1 ? "s" : ""}`, `${p.base} में ${p.width} शून्य`);
      steps.push({
        title: t("Find the base and the deviations", "बेस और विचलन निकालो"),
        body: t(`Both are near ${p.base}: ${x} is ${signed(p.a.dev)}, ${y} is ${signed(p.b.dev)}.`, `दोनों ${p.base} के पास हैं: ${x} है ${signed(p.a.dev)}, ${y} है ${signed(p.b.dev)}।`),
        visual: <Board rows={[{ n: x, dev: p.a.dev, note: `${t("base", "बेस")} ${p.base}` }, { n: y, dev: p.b.dev }]} gap={gap} />,
      });
      steps.push({
        title: t("Left part: cross-operation", "बायाँ हिस्सा: तिरछा हिसाब"),
        body: (
          <>
            <b className={STRONG}>
              {plusDev(x, p.b.dev)} = {p.left}
            </b>
            {t(` (or ${plusDev(y, p.a.dev)} = ${p.left}: the same either way).`, ` (या ${plusDev(y, p.a.dev)} = ${p.left}: दोनों तरफ़ से वही)।`)}
          </>
        ),
        visual: <NumberBoxes groups={[{ digits: String(p.left), tone: "done", caption: plusDev(x, p.b.dev) }]} gap={gap} separator={null} />,
      });
      steps.push(rightStep(p.a.dev, p.b.dev, p.right, p.width, why));
      const s = settleStep(p.settle, why);
      if (s) steps.push(s);
      steps.push(answerStep(p.settle, `${x} × ${y}`));
    }
  } else if (!empty && mode === "different") {
    const r = planDifferentBases(x, y);
    if (r.miss)
      error =
        r.miss.reason === "range"
          ? t("Use whole numbers from 1 to 99999.", "1 से 99999 तक के पूरे नंबर लो।")
          : t(`Both are near ${nearestBase(x)}: try "Same base".`, `दोनों ${nearestBase(x)} के पास हैं: "एक बेस" आज़माओ।`);
    else {
      const p = r.plan;
      const { big, small } = p;
      const why = t(`the lower base ${small.base} has ${p.width} zero${p.width > 1 ? "s" : ""}`, `छोटे बेस ${small.base} में ${p.width} शून्य`);
      steps.push({
        title: t("Find each base and deviation", "हर नंबर का बेस और विचलन"),
        body: t(
          `${big.n} is near ${big.base} (${signed(big.dev)}), ${small.n} is near ${small.base} (${signed(small.dev)}). The right part takes the lower base's ${p.width} digit${p.width > 1 ? "s" : ""}.`,
          `${big.n} का बेस ${big.base} (${signed(big.dev)}), ${small.n} का बेस ${small.base} (${signed(small.dev)})। दायाँ हिस्सा छोटे बेस जितने ${p.width} अंक लेगा।`,
        ),
        visual: (
          <Board
            rows={[
              { n: big.n, dev: big.dev, note: `${t("base", "बेस")} ${big.base}` },
              { n: small.n, dev: small.dev, note: `${t("base", "बेस")} ${small.base}` },
            ]}
            gap={gap}
          />
        ),
      });
      if (p.sameSign) {
        const bigDigits = [...String(big.n)];
        const smallDigits = [...String(small.n)];
        const start = p.column - (smallDigits.length - 1);
        const cols = Math.max(bigDigits.length, start + smallDigits.length);
        steps.push({
          title: t("Line up the smaller number", "छोटे नंबर को नीचे लिखो"),
          body: t(
            `Write ${small.n} under ${big.n} from the left, so ${small.n} ends under the highlighted ${p.digitFrom}.`,
            `${small.n} को ${big.n} के नीचे बाएँ से लिखो, ताकि ${small.n} हाइलाइट वाले ${p.digitFrom} के नीचे ख़त्म हो।`,
          ),
          visual: (
            <DigitGrid
              cols={cols}
              rows={[
                { start: 0, cells: bigDigits.map((v, i): BoxCell => ({ v, tone: i === p.column ? "active" : "plain" })) },
                { start: Math.max(0, start), cells: smallDigits.map((v, i): BoxCell => ({ v, tone: i === smallDigits.length - 1 ? "active" : "muted" })) },
              ]}
            />
          ),
        });
        steps.push({
          title: t("Cross-operation at that digit", "उसी अंक पर तिरछा हिसाब"),
          body:
            p.digitTo !== null ? (
              <>
                <b className={STRONG}>
                  {plusDev(p.digitFrom, small.dev)} = {p.digitTo}
                </b>
                {t(`, so ${big.n} becomes ${p.left}. That's the left part.`, `, तो ${big.n} बन जाता है ${p.left}। ये बायाँ हिस्सा है।`)}
              </>
            ) : (
              <>
                <b className={STRONG}>
                  {plusDev(big.n, small.dev * p.ratio)} = {p.left}
                </b>
                {t(` (the change crosses into the next digit, so do it on the whole number). That's the left part.`, ` (बदलाव अगले अंक तक जाता है, तो पूरे नंबर पर करो)। ये बायाँ हिस्सा है।`)}
              </>
            ),
          visual: (
            <DigitGrid
              cols={Math.max(bigDigits.length, String(p.left).length)}
              rows={[
                { start: 0, cells: bigDigits.map((v, i): BoxCell => ({ v, tone: i === p.column ? "active" : "muted" })) },
                {
                  label: "→",
                  start: Math.max(0, bigDigits.length - String(p.left).length),
                  cells: [...String(p.left)].map((v, i, all): BoxCell => ({ v, tone: i === p.column - (bigDigits.length - all.length) ? "done" : "plain" })),
                },
              ]}
            />
          ),
        });
      } else {
        steps.push({
          title: t("The base ratio", "बेस का अनुपात"),
          body: t(`The signs differ, so use the base ratio: ${big.base} ÷ ${small.base} = ${p.ratio}.`, `चिह्न अलग हैं, तो बेस का अनुपात लो: ${big.base} ÷ ${small.base} = ${p.ratio}।`),
          visual: <NumberBoxes groups={[{ digits: String(big.base) }, { digits: String(small.base), sepBefore: "÷" }, { digits: String(p.ratio), sepBefore: "=", tone: "added" }]} gap={gap} />,
        });
        steps.push({
          title: t("Left part", "बायाँ हिस्सा"),
          body: (
            <b className={STRONG}>
              {small.n} × {p.ratio} = {p.scaled}, {plusDev(p.scaled, big.dev)} = {p.left}
            </b>
          ),
          visual: (
            <NumberBoxes
              groups={[
                { digits: String(p.scaled), tone: "added", caption: `${small.n} × ${p.ratio}` },
                { digits: String(p.left), tone: "done", sepBefore: "→", caption: plusDev(p.scaled, big.dev) },
              ]}
              gap={gap}
            />
          ),
        });
      }
      steps.push(rightStep(big.dev, small.dev, p.right, p.width, why));
      const s = settleStep(p.settle, why);
      if (s) steps.push(s);
      steps.push(answerStep(p.settle, `${x} × ${y}`));
    }
  } else if (!empty && mode === "sub") {
    const r = planSubBase(x, y, Number(sub));
    if (r.miss)
      error =
        r.miss.reason === "range"
          ? t("Use whole numbers from 1 to 99999.", "1 से 99999 तक के पूरे नंबर लो।")
          : t("A sub-base is a digit 2–9 then zeros, like 20, 40 or 300.", "सब-बेस एक अंक (2–9) और फिर शून्य होता है, जैसे 20, 40 या 300।");
    else {
      const p = r.plan;
      const S = Number(sub);
      const ten = 10 ** p.power;
      const why = t(`${S} has ${p.width} zero${p.width > 1 ? "s" : ""}`, `${S} में ${p.width} शून्य`);
      steps.push({
        title: t("The sub-base and the deviations", "सब-बेस और विचलन"),
        body: t(
          `${S} = ${p.multiplier} × ${ten}. From ${S}: ${x} is ${signed(p.a.dev)}, ${y} is ${signed(p.b.dev)}.`,
          `${S} = ${p.multiplier} × ${ten}। ${S} से: ${x} है ${signed(p.a.dev)}, ${y} है ${signed(p.b.dev)}।`,
        ),
        visual: <Board rows={[{ n: x, dev: p.a.dev, note: `${t("base", "बेस")} ${S} = ${p.multiplier}×${ten}` }, { n: y, dev: p.b.dev }]} gap={gap} />,
      });
      steps.push({
        title: t("Left part: cross-operation", "बायाँ हिस्सा: तिरछा हिसाब"),
        body: (
          <b className={STRONG}>
            {plusDev(x, p.b.dev)} = {p.cross}
          </b>
        ),
        visual: <NumberBoxes groups={[{ digits: String(p.cross), tone: "added", caption: plusDev(x, p.b.dev) }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t(`Multiply the left part by ${p.multiplier}`, `बाएँ हिस्से को ${p.multiplier} से गुणा करो`),
        body: (
          <>
            <b className={STRONG}>
              {p.cross} × {p.multiplier} = {p.left}
            </b>
            {t(`, because ${S} = ${p.multiplier} × ${ten}.`, `, क्योंकि ${S} = ${p.multiplier} × ${ten}।`)}
          </>
        ),
        visual: (
          <NumberBoxes
            groups={[
              { digits: String(p.cross), tone: "added" },
              { digits: String(p.left), tone: "done", sepBefore: "→", caption: `× ${p.multiplier}` },
            ]}
            gap={gap}
          />
        ),
      });
      steps.push(rightStep(p.a.dev, p.b.dev, p.right, p.width, why));
      const s = settleStep(p.settle, why);
      if (s) steps.push(s);
      steps.push(answerStep(p.settle, `${x} × ${y}`));
    }
  }

  const glance = planSameBase(92, 98).plan!;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("nikhilam", lang)}
        subtitle={t("Multiply numbers near a base (10, 100, 1000…) using only how far each one is from it.", "बेस (10, 100, 1000…) के पास वाले नंबरों का गुणा, सिर्फ़ ये देखकर कि हर नंबर बेस से कितना दूर है।")}
      />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ol className={`mt-2 flex list-decimal flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Find the base, and each number's deviation: − below it, + above it.", "बेस निकालो, और हर नंबर का विचलन: कम हो तो −, ज़्यादा हो तो +।")}</li>
          <li>
            <b className={STRONG}>{t("Left", "बायाँ")}</b> = {t("cross-operation: one number + the other's deviation.", "तिरछा हिसाब: एक नंबर + दूसरे का विचलन।")}
          </li>
          <li>
            <b className={STRONG}>{t("Right", "दायाँ")}</b> = {t("deviation × deviation, with as many digits as the base has zeros.", "विचलन × विचलन, उतने अंक जितने बेस में शून्य।")}
          </li>
          <li>{t("Negative right part: take its complement from the base, and 1 less on the left.", "दायाँ हिस्सा माइनस हो: बेस से उसका पूरक लो, और बाएँ से 1 कम।")}</li>
        </ol>
        {animate ? (
          <div className="mt-4 flex flex-col gap-3">
            {/* Every case, played one at a time. */}
            <div role="radiogroup" aria-label={t("Case", "केस")} className="flex flex-wrap gap-1.5">
              {NIKHILAM_CASES.map((c) => {
                const on = c.id === glanceCase;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setGlanceCase(c.id)}
                    className={`h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                      }`}
                  >
                    {lang === "hi" ? c.hi : c.en}
                    <span className={`ml-1.5 tabular-nums ${on ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>
                      {c.a}×{c.b}
                    </span>
                  </button>
                );
              })}
            </div>
            <NikhilamGlance caseId={glanceCase} lang={lang} gap={gap} />
          </div>
        ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 overflow-x-auto">
          <span className="text-lg font-medium tabular-nums text-slate-700 dark:text-slate-300">92 × 98</span>
          <Board
            rows={[
              { n: 92, dev: -8, note: `${t("base", "बेस")} 100` },
              { n: 98, dev: -2 },
            ]}
            result={{ left: glance.left, leftNote: "92 − 2", right: rightCells(glance.right, 2), rightNote: "(−8) × (−2)" }}
            gap={gap}
          />
          <span className="inline-flex items-center gap-x-4">
            <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
            <NumberBoxes groups={[{ digits: glance.settle.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "It means \"all from 9 and the last from 10\": the quick way to find how far a number is from its base (see Base). Then you multiply the small deviations instead of the big numbers.",
            "इसका मतलब है \"सब 9 में से, आख़िरी 10 में से\": बेस से दूरी निकालने का जल्दी तरीका (बेस वाला पाठ देखो)। फिर बड़े नंबरों की जगह छोटे विचलनों का गुणा करते हैं।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              load(m, EXAMPLES[m][0]);
            }}
            label="Case"
            options={[
              ["same", t("Same base", "एक बेस")],
              ["different", t("Different bases", "अलग बेस")],
              ["sub", t("Sub-base", "सब-बेस")],
            ]}
          />
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={a} onChange={(e) => changeNumber(setA, b)(e.target.value)} inputMode="numeric" aria-label={t("First number", "पहला नंबर")} className={`${INPUT} w-24`} />
          <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
          <input value={b} onChange={(e) => changeNumber(setB, a)(e.target.value)} inputMode="numeric" aria-label={t("Second number", "दूसरा नंबर")} className={`${INPUT} w-24`} />
          {mode === "sub" && (
            <label className="ml-2 inline-flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400">
              {t("sub-base", "सब-बेस")}
              <input
                value={sub}
                onChange={(e) => setSub(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                aria-label={t("Sub-base", "सब-बेस")}
                className={`${INPUT} w-20 ${sub && !parseSubBase(Number(sub)) ? "border-rose-400" : ""}`}
              />
            </label>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES[mode].map((e) => ({ label: `${e[0]} × ${e[1]}${e[2] ? ` (${e[2]})` : ""}`, onClick: () => load(mode, e) }))}
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Find the right base first.", "पहले सही बेस पहचानो।")}</li>
          <li>{t("Base 10, 100, 1000: the right part has as many digits as the base has zeros (04, 16).", "बेस 10, 100, 1000: दाएँ हिस्से में उतने अंक जितने बेस में शून्य (04, 16)।")}</li>
          <li>
            {t(
              "Different bases: the lower base sets the right part's digits. Same signs: line up and change one digit. Different signs: use the base ratio.",
              "अलग बेस: दाएँ हिस्से के अंक छोटे बेस से। चिह्न एक जैसे: नीचे लिखकर एक अंक बदलो। चिह्न अलग: बेस का अनुपात लो।",
            )}
          </li>
          <li>{t("Sub-base (20, 40…): multiply the left part by its first digit.", "सब-बेस (20, 40…): बाएँ हिस्से को उसके पहले अंक से गुणा करो।")}</li>
          <li>{t("Negative right part: complement, and 1 less on the left. Too many digits: balance.", "दायाँ माइनस: पूरक लो, बाएँ से 1 कम। अंक ज़्यादा: बैलेंस करो।")}</li>
        </ul>
      </Card>
    </div>
  );
};
