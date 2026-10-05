import React, { useState } from "react";
import { FitWidth, NumberBoxes, type BoxArrow, type BoxGroup } from "./NumberBoxes";
import { carryArrowAt, devCell, plusDev, rightCells, signed } from "./cells";
import type { Settle } from "./nikhilam";
import { MAX_DIGITS, parseYBase, planCube, planSquare, suggestYBase, type CubeMove } from "./yavadunam";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, arrowIn, groupIn, type Beat, type GlanceCase } from "./beats";

type Mode = "square" | "cube";

const MINUS = "−";
const SQUARE_EXAMPLES: [number, number][] = [
  [96, 100],
  [104, 100],
  [88, 100],
  [997, 1000],
  [1003, 1000],
  [48, 50],
  [88, 90],
  [207, 200],
];
const CUBE_EXAMPLES = [104, 98, 1002, 997, 12, 9];
const MODES: { id: Mode; en: string; hi: string }[] = [
  { id: "square", en: "Square", hi: "वर्ग" },
  { id: "cube", en: "Cube", hi: "घन" },
];
const digitsWord = (n: number, lang: Lang) => (lang === "hi" ? `${n} अंक` : `${n} digit${n > 1 ? "s" : ""}`);

// ─── The animated examples ────────────────────────────────────────────────────

function yavadunamCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const answerBox = (answer: string) => (
    <span className="inline-flex items-center gap-x-3">
      <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
      <span data-anim="yg-a">
        <NumberBoxes groups={[{ digits: answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
      </span>
    </span>
  );
  const deviation = (n: number, base: number, d: number): Beat => ({
    strong: d < 0 ? t(`${n} is ${-d} below ${base}`, `${n}, ${base} से ${-d} कम`) : t(`${n} is ${d} above ${base}`, `${n}, ${base} से ${d} ज़्यादा`),
    rest: d < 0 ? t(`the deficiency is ${-d}`, `कमी ${-d}`) : t(`the surplus is ${d}`, `अधिकता ${d}`),
    visual: (
      <div className="flex items-center gap-3">
        <NumberBoxes groups={[{ digits: String(n) }]} gap={gap} separator={null} size="lg" />
        <span className="text-xl text-slate-300 dark:text-slate-600">→</span>
        <span data-anim="yg-d">
          <NumberBoxes groups={[{ cells: [devCell(d)], caption: t(`from ${base}`, `${base} से`) }]} gap={gap} separator={null} size="lg" />
        </span>
      </div>
    ),
    extra: [{ id: "yg-d", kind: "pop", at: 500 }],
    dur: 1500,
  });

  const square = (n: number, baseValue: number) => (): Beat[] => {
    const { base, d, cross, left, right, width, settle: s } = planSquare(n, baseValue)!;
    const sub = base.multiplier > 1;
    const beats: Beat[] = [
      deviation(n, base.value, d),
      {
        strong: `${plusDev(n, d)} = ${cross}${sub ? `, × ${base.multiplier} = ${left}` : ""}`,
        rest: sub
          ? t(`left part; ${base.value} = ${base.multiplier} × ${base.value / base.multiplier}, so × ${base.multiplier}`, `बायाँ हिस्सा; ${base.value} = ${base.multiplier} × ${base.value / base.multiplier}, तो × ${base.multiplier}`)
          : d < 0
            ? t("left part: lessen it by the deficiency", "बायाँ हिस्सा: कमी जितना घटाओ")
            : t("left part: add the surplus", "बायाँ हिस्सा: अधिकता जोड़ो"),
        visual: (
          <NumberBoxes
            groups={[
              { id: "yg-l", digits: String(left), tone: "done" },
              { id: "yg-r", cells: rightCells(right, width) },
            ]}
            arrows={s.carry ? [{ id: "yg-c", from: 1, to: 0, label: `+${s.carry}`, ...carryArrowAt(String(right).length - width, String(left).length) }] : undefined}
            gap={gap}
            separator="|"
            size="lg"
          />
        ),
        dur: 1500,
      },
      {
        strong: `(${signed(d)})² = ${right}`,
        rest: t(`right part: the deficiency squared, ${width} digit${width > 1 ? "s" : ""}`, `दायाँ हिस्सा: कमी का वर्ग, ${width} अंक`),
        extra: groupIn("yg-r", 0),
      },
    ];
    if (s.carry)
      beats.push({
        strong: `${s.left0} | ${s.right0} → ${s.left} | ${s.rightText}`,
        rest: t(`too many digits: ${s.carry} carries left`, `अंक ज़्यादा: ${s.carry} बाएँ जाता है`),
        extra: arrowIn("yg-c", 100),
        dur: 1500,
      });
    beats.push({
      strong: `${s.left} | ${s.rightText} = ${s.answer}`,
      rest: t(`check: ${n} × ${n} = ${n * n}`, `जाँच: ${n} × ${n} = ${n * n}`),
      visual: answerBox(s.answer),
      extra: [{ id: "yg-a", kind: "pop", at: 400 }],
    });
    return beats;
  };

  const cube = (n: number) => (): Beat[] => {
    const { base, width, d, parts, moves, final, answer } = planCube(n)!;
    const pad = (v: number) => String(v).padStart(width, "0");
    const row = (v: [number, number, number], prefix: string) => (
      <NumberBoxes
        groups={[
          { id: `${prefix}0`, digits: String(v[0]), tone: "done" },
          { id: `${prefix}1`, cells: rightCells(v[1], width) },
          { id: `${prefix}2`, cells: rightCells(v[2], width) },
        ]}
        gap={gap}
        separator="|"
        size="lg"
      />
    );
    const beats: Beat[] = [
      deviation(n, base, d),
      {
        strong: `${n} ${d < 0 ? "−" : "+"} 2 × ${Math.abs(d)} = ${parts[0]}`,
        rest: t("left part: the number + 2 × deviation", "बायाँ हिस्सा: नंबर + 2 × विचलन"),
        visual: row(parts, "yc"),
      },
      { strong: `3 × (${signed(d)})² = ${parts[1]}`, rest: t("middle part: 3 × deviation²", "बीच का हिस्सा: 3 × विचलन²"), extra: groupIn("yc1", 0) },
      { strong: `(${signed(d)})³ = ${signed(parts[2])}`, rest: t("right part: deviation³", "दायाँ हिस्सा: विचलन³"), extra: groupIn("yc2", 0) },
    ];
    if (moves.length)
      beats.push({
        strong: `${final[0]} | ${pad(final[1])} | ${pad(final[2])}`,
        rest: moves
          .map((m) => {
            const part = m.from === 2 ? t("right", "दायाँ") : t("middle", "बीच का");
            return m.amount > 0 ? t(`${part} part carries ${m.amount} left`, `${part} हिस्सा ${m.amount} बाएँ देता है`) : t(`negative ${part} part borrows ${-m.amount}`, `माइनस ${part} हिस्सा ${-m.amount} उधार लेता है`);
          })
          .join(", "),
        visual: row(final, "yf"),
        dur: 1600,
      });
    beats.push({
      strong: `= ${answer}`,
      rest: t(`check: ${n} × ${n} × ${n} = ${n ** 3}`, `जाँच: ${n} × ${n} × ${n} = ${n ** 3}`),
      visual: answerBox(answer),
      extra: [{ id: "yg-a", kind: "pop", at: 400 }],
    });
    return beats;
  };

  return [
    { en: "Below the base", hi: "बेस से कम", sub: "96²", beats: square(96, 100) },
    { en: "With a carry", hi: "हासिल के साथ", sub: "88²", beats: square(88, 100) },
    { en: "Sub-base 50", hi: "उप-बेस 50", sub: "48²", beats: square(48, 50) },
    { en: "Cube", hi: "घन", sub: "98³", beats: cube(98) },
  ];
}

/** Yavadunam: whatever the deficiency, lessen by it, and set up its square. */
export const YavadunamLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("square");
  const [sqN, setSqN] = useState("96");
  const [sqBase, setSqBase] = useState("100");
  const [cuN, setCuN] = useState("104");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const changeSquare = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, MAX_DIGITS);
    setSqN(clean);
    if (clean && Number(clean) > 0) setSqBase(String(suggestYBase(Number(clean))));
  };

  const steps: StepView[] = [];
  let note: string | null = null;

  /** n, then how far it is from the base. */
  const deviationStep = (n: number, base: number, d: number): StepView => ({
    title: d < 0 ? t("How much below the base?", "बेस से कितना कम?") : d > 0 ? t("How much above the base?", "बेस से कितना ज़्यादा?") : t("Right on the base", "ठीक बेस पर"),
    body:
      d < 0
        ? t(`${n} is ${-d} below ${base}: the deficiency is ${-d}.`, `${n}, ${base} से ${-d} कम है: कमी ${-d}।`)
        : d > 0
          ? t(`${n} is ${d} above ${base}: the surplus is ${d}.`, `${n}, ${base} से ${d} ज़्यादा है: अधिकता ${d}।`)
          : t(`${n} is the base itself.`, `${n} ख़ुद बेस है।`),
    visual: (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NumberBoxes groups={[{ digits: String(n) }]} gap={gap} separator={null} />
        <span className="text-xl text-slate-300 dark:text-slate-600">→</span>
        <NumberBoxes groups={[{ cells: [devCell(d)], caption: t(`from ${base}`, `${base} से`) }]} gap={gap} separator={null} />
      </div>
    ),
  });
  const answerVisual = (groups: BoxGroup[], answer: string) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <NumberBoxes groups={groups} gap={gap} separator="|" />
      {/* "=" wraps with the answer; a long answer shrinks to fit a narrow screen. */}
      <span className="flex min-w-0 max-w-full items-center gap-x-4">
        <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
        <div className="min-w-0 flex-1">
          <FitWidth>
            <NumberBoxes groups={[{ digits: answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </FitWidth>
        </div>
      </span>
    </div>
  );
  /** The right part too long: carry to the left (a square's right part is never negative). */
  const carryStep = (s: Settle): StepView | null => {
    if (s.carry === 0) return null;
    // From the carried digit(s) to the last digit of the left part.
    const arrows: BoxArrow[] = [{ from: 1, to: 0, label: `+${s.carry}`, ...carryArrowAt(String(s.right0).length - s.width, String(s.left0).length) }];
    return {
      title: t("Too many digits: carry", "अंक ज़्यादा: हासिल"),
      body: t(
        `${s.right0} has more than ${digitsWord(s.width, lang)}: ${s.carry} moves to the left. ${s.left0} + ${s.carry} = ${s.left}, right ${s.rightText}.`,
        `${s.right0} में ${digitsWord(s.width, lang)} से ज़्यादा: ${s.carry} बाएँ जाएगा। ${s.left0} + ${s.carry} = ${s.left}, दायाँ ${s.rightText}।`,
      ),
      visual: (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <NumberBoxes groups={[{ digits: String(s.left0), tone: "done" }, { cells: rightCells(s.right0, s.width) }]} arrows={arrows} gap={gap} separator="|" />
          <span className="pb-2 text-xl text-slate-300 dark:text-slate-600">→</span>
          <NumberBoxes groups={[{ digits: String(s.left), tone: "done" }, { cells: rightCells(s.right, s.width) }]} gap={gap} separator="|" />
        </div>
      ),
    };
  };

  if (mode === "square") {
    const n = Number(sqN);
    const plan = sqN && sqBase ? planSquare(n, Number(sqBase)) : null;
    if (!sqN || n < 1) note = t("Type a number.", "नंबर लिखो।");
    else if (!plan)
      note = t("The base should be 10, 100, 1000… or a sub-base like 20, 50, 300.", "बेस 10, 100, 1000… या 20, 50, 300 जैसा उप-बेस होना चाहिए।");
    else {
      const { base, d, cross, left, right, width, settle: s } = plan;
      const sub = base.multiplier > 1;
      const unitBase = base.value / base.multiplier;
      steps.push(deviationStep(n, base.value, d));
      steps.push({
        title: d < 0 ? t("Left part: lessen it by the deficiency", "बायाँ हिस्सा: कमी जितना घटाओ") : t("Left part: add the surplus", "बायाँ हिस्सा: अधिकता जोड़ो"),
        body: (
          <>
            <b className={STRONG}>
              {plusDev(n, d)} = {cross}
              {sub && ` · ${cross} × ${base.multiplier} = ${left}`}
            </b>
            {sub && t(`. ${base.value} = ${base.multiplier} × ${unitBase}, so multiply by ${base.multiplier}.`, `। ${base.value} = ${base.multiplier} × ${unitBase}, तो ${base.multiplier} से गुणा।`)}
          </>
        ),
        visual: (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <NumberBoxes groups={[{ digits: String(cross), tone: "done", caption: plusDev(n, d) }]} gap={gap} separator={null} />
            {sub && (
              <>
                <span className="text-xl text-slate-300 dark:text-slate-600">→</span>
                <NumberBoxes groups={[{ digits: String(left), tone: "done", caption: `${cross} × ${base.multiplier}` }]} gap={gap} separator={null} />
              </>
            )}
          </div>
        ),
      });
      steps.push({
        title: t("Right part: square the deficiency", "दायाँ हिस्सा: कमी का वर्ग"),
        body: (
          <>
            <b className={STRONG}>
              ({signed(d)})² = {right}
            </b>
            {t(
              `. ${unitBase} has ${width} zero${width > 1 ? "s" : ""}, so the right part has ${digitsWord(width, lang)}.`,
              `। ${unitBase} में ${width} शून्य, तो दाएँ हिस्से में ${digitsWord(width, lang)}।`,
            )}
          </>
        ),
        visual: <NumberBoxes groups={[{ cells: rightCells(right, width), caption: `(${signed(d)})²` }]} gap={gap} separator={null} />,
      });
      const carry = carryStep(s);
      if (carry) steps.push(carry);
      steps.push({
        title: t("Answer", "जवाब"),
        body: (
          <span className="tabular-nums">
            {s.left} | {s.rightText} → {s.answer}. {t("Check: ", "जाँच: ")}
            {n} × {n} = {n * n} ✓
          </span>
        ),
        visual: answerVisual([{ digits: String(s.left), tone: "done" }, { cells: rightCells(s.right, s.width) }], s.answer),
      });
    }
  }

  if (mode === "cube") {
    const n = Number(cuN);
    const plan = cuN ? planCube(n) : null;
    // A carry leaves from its extra leading digits; both carries and borrows land on the last digit before.
    const moveArrowAt = (m: CubeMove) => {
      const w = plan!.width;
      const v = m.before[m.from];
      const toCells = m.from === 2 ? rightCells(m.before[1], w).length : String(m.before[0]).length;
      return m.amount > 0 ? carryArrowAt(String(v).length - w, toCells) : { toCell: toCells - 1 };
    };
    if (!plan) note = t("Type a number up to 4 digits.", "4 अंकों तक का नंबर लिखो।");
    else {
      const { base, width, d, parts, moves, final, answer } = plan;
      const cells3 = (p: [number, number, number]): BoxGroup[] => [
        { digits: String(p[0]), tone: "done" },
        { cells: rightCells(p[1], width) },
        { cells: rightCells(p[2], width) },
      ];
      steps.push(deviationStep(n, base, d));
      steps.push({
        title: t("Left part: the number + 2 × deviation", "बायाँ हिस्सा: नंबर + 2 × विचलन"),
        body: (
          <b className={STRONG}>
            {n} {d < 0 ? MINUS : "+"} 2 × {Math.abs(d)} = {parts[0]}
          </b>
        ),
        visual: <NumberBoxes groups={[{ digits: String(parts[0]), tone: "done", caption: `${n} ${d < 0 ? MINUS : "+"} 2×${Math.abs(d)}` }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t("Middle part: 3 × deviation²", "बीच का हिस्सा: 3 × विचलन²"),
        body: (
          <b className={STRONG}>
            3 × ({signed(d)})² = {parts[1]}
          </b>
        ),
        visual: <NumberBoxes groups={[{ cells: rightCells(parts[1], width), caption: `3 × (${signed(d)})²` }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t("Right part: deviation³", "दायाँ हिस्सा: विचलन³"),
        body: (
          <>
            <b className={STRONG}>
              ({signed(d)})³ = {signed(parts[2])}
            </b>
            {t(`. Each part after the first has ${digitsWord(width, lang)}, as ${base} has ${width} zero${width > 1 ? "s" : ""}.`, `। पहले के बाद हर हिस्से में ${digitsWord(width, lang)}, क्योंकि ${base} में ${width} शून्य।`)}
          </>
        ),
        visual: <NumberBoxes groups={cells3(parts)} gap={gap} separator="|" />,
      });
      moves.forEach((m) => {
        const part = m.from === 2 ? t("right", "दायाँ") : t("middle", "बीच का");
        const into = m.from === 2 ? t("middle", "बीच") : t("left", "बाएँ");
        const v = m.before[m.from];
        steps.push({
          title:
            m.amount > 0
              ? t(`Carry from the ${part} part`, `${part} हिस्से से हासिल`)
              : t(`Negative ${part} part: borrow`, `${part} हिस्सा माइनस: उधार लो`),
          body:
            m.amount > 0
              ? t(`${v} has too many digits: ${m.amount} moves into the ${into}.`, `${v} में अंक ज़्यादा: ${m.amount} ${into} में जाता है।`)
              : t(
                `${signed(v)} is negative: take ${-m.amount} from the ${into} part (${-m.amount} × ${base} = ${-m.amount * base}), ${signed(v)} + ${-m.amount * base} = ${m.after[m.from]}.`,
                `${signed(v)} माइनस है: ${into} हिस्से से ${-m.amount} लो (${-m.amount} × ${base} = ${-m.amount * base}), ${signed(v)} + ${-m.amount * base} = ${m.after[m.from]}।`,
              ),
          visual: (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <NumberBoxes groups={cells3(m.before)} arrows={[{ from: m.from, to: m.from - 1, label: m.amount > 0 ? `+${m.amount}` : `${MINUS}${-m.amount}`, ...moveArrowAt(m) }]} gap={gap} separator="|" />
              <span className="pb-2 text-xl text-slate-300 dark:text-slate-600">→</span>
              <NumberBoxes groups={cells3(m.after)} gap={gap} separator="|" />
            </div>
          ),
        });
      });
      steps.push({
        title: t("Answer", "जवाब"),
        body: (
          <span className="tabular-nums">
            {final[0]} | {String(final[1]).padStart(width, "0")} | {String(final[2]).padStart(width, "0")} → {answer}. {t("Check: ", "जाँच: ")}
            {n} × {n} × {n} = {answer} ✓
          </span>
        ),
        visual: answerVisual(cells3(final), answer),
      });
    }
  }

  const baseOk = !sqBase || parseYBase(Number(sqBase));

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("yavadunam", lang)}
        subtitle={t("Square or cube a number near a base: lessen it by the deficiency, then set up the square of the deficiency.", "बेस के पास के नंबर का वर्ग या घन: कमी जितना घटाओ, फिर कमी का वर्ग लगाओ।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Whatever the deficiency, lessen it by that much, and set up the square of the deficiency.", "जितनी कमी, उतना और घटाओ, और कमी का वर्ग लगाओ।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="yavadunam" cases={yavadunamCases(t, gap)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>96² → 96 − 4 = 92 | 4² = 16 → 9216</span>
          <span>104² → 104 + 4 = 108 | 4² = 16 → 10816</span>
          <span>104³ → 104 + 2×4 = 112 | 3×4² = 48 | 4³ = 64 → 1124864</span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Yavat means \"as much as\", and Unam \"deficient\": as much as the number falls short of the base, take that much away again. 96 is 4 short of 100, so take away another 4: 92. Its square, 16, fills the rest.",
            "यावत् यानी \"जितना\", और ऊनम् यानी \"कम\": नंबर बेस से जितना कम है, उतना और घटाओ। 96, 100 से 4 कम है, तो 4 और घटाओ: 92। बाकी 4 का वर्ग, 16, भरता है।",
          )}
        </p>
      </Card>

      {/* Your number */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={t("Kind", "प्रकार")} className="flex flex-wrap gap-1.5">
            {MODES.map((m) => {
              const on = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.id)}
                  className={`h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                >
                  {lang === "hi" ? m.hi : m.en}
                </button>
              );
            })}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {mode === "square" ? (
            <>
              <input value={sqN} onChange={(e) => changeSquare(e.target.value)} inputMode="numeric" aria-label={t("Number", "नंबर")} className={`${INPUT} w-24`} />
              <span className="text-xl font-medium text-slate-500 dark:text-slate-400">²</span>
              <label className="ml-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                {t("base", "बेस")}
                <input
                  value={sqBase}
                  onChange={(e) => setSqBase(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  aria-label={t("Base", "बेस")}
                  className={`${INPUT} w-24 ${baseOk ? "" : "border-rose-400"}`}
                />
              </label>
            </>
          ) : (
            <>
              <input value={cuN} onChange={(e) => setCuN(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("Number", "नंबर")} className={`${INPUT} w-24`} />
              <span className="text-xl font-medium text-slate-500 dark:text-slate-400">³</span>
              {cuN && Number(cuN) > 0 && (
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  {t("base", "बेस")} {planCube(Number(cuN))?.base}
                </span>
              )}
            </>
          )}
        </div>
        <div className="mt-3">
          {mode === "square" ? (
            <Examples
              title={t("Examples", "उदाहरण")}
              items={SQUARE_EXAMPLES.map(([n, b]) => ({
                label: `${n}² · ${b}`,
                onClick: () => {
                  setSqN(String(n));
                  setSqBase(String(b));
                },
              }))}
            />
          ) : (
            <Examples title={t("Examples", "उदाहरण")} items={CUBE_EXAMPLES.map((n) => ({ label: `${n}³`, onClick: () => setCuN(String(n)) }))} />
          )}
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Square: left = number ± its deviation, right = deviation², with as many digits as the base has zeros.", "वर्ग: बायाँ = नंबर ± विचलन, दायाँ = विचलन², बेस के शून्यों जितने अंक।")}</li>
          <li>{t("Sub-base (50 = 5 × 10): multiply the left part by 5.", "उप-बेस (50 = 5 × 10): बाएँ हिस्से को 5 से गुणा करो।")}</li>
          <li>{t("Cube: number + 2 × deviation | 3 × deviation² | deviation³.", "घन: नंबर + 2 × विचलन | 3 × विचलन² | विचलन³।")}</li>
        </ul>
      </Card>
    </div>
  );
};
