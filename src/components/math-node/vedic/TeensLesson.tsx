import React, { useState } from "react";
import { NumberBoxes, type BoxCell } from "./NumberBoxes";
import { carryArrowAt } from "./cells";
import { MAX, MIN, planTeens, type TeensPlan } from "./teens";
import { NumIn, Op, Row } from "./equation";
import { methodName } from "./methods";
import { AnimatedExamples, arrowIn, groupIn, stagger, type Beat, type GlanceCase } from "./beats";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";

const EXAMPLES: [number, number][] = [
  [15, 18],
  [12, 13],
  [14, 16],
  [17, 19],
  [19, 19],
  [11, 17],
];

/** A number with its unit digit picked out: 15 → 1 [5]. */
const unitCells = (n: number, id?: string): BoxCell[] => [
  { v: String(Math.floor(n / 10)) },
  { v: String(n % 10), tone: "active", id },
];

/** left / right, the right part's digits apart, with the carry arrow when there is one. */
const partsRow = (p: TeensPlan, gap: number, ids?: { left: string; right: string; arrow: string }) => (
  <NumberBoxes
    groups={[
      { id: ids?.left, digits: String(p.left), tone: "done" },
      { id: ids?.right, cells: [...String(p.right)].map((v) => ({ v, tone: "carry" as const })) },
    ]}
    arrows={p.carry ? [{ id: ids?.arrow, from: 1, to: 0, label: `+${p.carry}`, ...carryArrowAt(String(p.right).length - 1, String(p.left).length) }] : undefined}
    gap={gap}
    separator="/"
    size="lg"
  />
);
const finalRow = (p: TeensPlan, gap: number) => (
  <NumberBoxes
    groups={[
      { digits: String(p.finalLeft), tone: "done" },
      { digits: String(p.keep), tone: "carry" },
    ]}
    gap={gap}
    separator="/"
    size="lg"
  />
);

// ─── The animated examples ────────────────────────────────────────────────────

function teensCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const run = (a: number, b: number) => (): Beat[] => {
    const p = planTeens(a, b)!;
    const beats: Beat[] = [
      {
        strong: `${a} + ${p.ub} = ${p.left}`,
        rest: t(`first: ${a} + the unit digit of ${b}`, `पहले: ${a} + ${b} का इकाई अंक`),
        visual: (
          <Row>
            <NumberBoxes groups={[{ digits: String(a) }]} gap={gap} separator={null} />
            <Op>+</Op>
            <NumberBoxes groups={[{ cells: unitCells(b, "tg-ub") }]} gap={gap} separator={null} />
          </Row>
        ),
        extra: [{ id: "tg-ub", kind: "glow", at: 300 }],
      },
      {
        strong: `${p.ua} × ${p.ub} = ${p.right}`,
        rest: t("second: multiply the unit digits", "दूसरा: इकाई अंकों का गुणा"),
        visual: partsRow(p, gap, { left: "tg-l", right: "tg-r", arrow: "tg-c" }),
        extra: groupIn("tg-r", 600),
        dur: 1700,
      },
    ];
    if (p.carry)
      beats.push({
        strong: `${p.left} / ${p.right} → ${p.finalLeft} / ${p.keep}`,
        rest: t(`balancing rule: keep ${p.keep}, carry ${p.carry} left`, `संतुलन नियम: ${p.keep} रखो, ${p.carry} बाएँ भेजो`),
        visual: finalRow(p, gap),
        extra: arrowIn("tg-c", 0),
        dur: 1800,
      });
    beats.push({
      strong: `${a} × ${b} = ${p.answer}`,
      rest: t("the answer", "जवाब"),
      visual: (
        <span data-anim="tg-a">
          <NumberBoxes groups={[{ digits: String(p.answer), tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </span>
      ),
      extra: stagger(["tg-a"], 300, 0),
    });
    return beats;
  };
  return [
    { en: "With a carry", hi: "हासिल के साथ", sub: "15 × 18", beats: run(15, 18) },
    { en: "No carry", hi: "बिना हासिल", sub: "12 × 13", beats: run(12, 13) },
    { en: "Big carry", hi: "बड़ा हासिल", sub: "19 × 19", beats: run(19, 19) },
  ];
}

/** Multiplying two numbers from 11 to 19 in two short steps and the Balancing Rule. */
export const TeensLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [raw, setRaw] = useState<string[]>(["15", "18"]);
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();
  const [a, b] = raw.map(Number);
  const plan = raw.every((s) => /^\d+$/.test(s)) ? planTeens(a, b) : null;

  const steps: StepView[] = [];
  const note = plan ? null : t(`Type two numbers from ${MIN} to ${MAX}.`, `${MIN} से ${MAX} तक के दो नंबर लिखो।`);

  if (plan) {
    const p = plan;
    steps.push({
      title: t("First: one number + the other's unit digit", "पहले: एक नंबर + दूसरे का इकाई अंक"),
      body: t(
        `${a} + ${p.ub} = ${p.left}. Either way round gives the same: ${b} + ${p.ua} = ${p.left}.`,
        `${a} + ${p.ub} = ${p.left}। उलटा भी वही: ${b} + ${p.ua} = ${p.left}।`,
      ),
      visual: (
        <Row>
          <NumberBoxes groups={[{ digits: String(a) }]} gap={gap} separator={null} />
          <Op>+</Op>
          <NumberBoxes groups={[{ cells: unitCells(b) }]} gap={gap} separator={null} />
          <Op>=</Op>
          <NumberBoxes groups={[{ digits: String(p.left), tone: "done" }]} gap={gap} separator={null} />
        </Row>
      ),
    });
    steps.push({
      title: t("Second: multiply the unit digits", "दूसरा: इकाई अंकों का गुणा"),
      body: (
        <b className={STRONG}>
          {p.ua} × {p.ub} = {p.right}
        </b>
      ),
      visual: (
        <Row>
          <NumberBoxes groups={[{ cells: unitCells(a) }]} gap={gap} separator={null} />
          <Op>×</Op>
          <NumberBoxes groups={[{ cells: unitCells(b) }]} gap={gap} separator={null} />
          <Op>→</Op>
          <NumberBoxes groups={[{ digits: String(p.right), tone: "carry" }]} gap={gap} separator={null} />
        </Row>
      ),
    });
    steps.push({
      title: t("Put them together", "दोनों साथ लिखो"),
      body: t(`${p.left} / ${p.right}: the right part may keep only one digit.`, `${p.left} / ${p.right}: दाएँ हिस्से में सिर्फ़ एक अंक रह सकता है।`),
      visual: partsRow({ ...p, carry: 0 }, gap),
    });
    if (p.carry)
      steps.push({
        title: t("Apply the Balancing Rule", "संतुलन नियम लगाओ"),
        body: t(
          `${p.right} has two digits: keep ${p.keep}, send ${p.carry} left. ${p.left} + ${p.carry} = ${p.finalLeft}.`,
          `${p.right} में दो अंक: ${p.keep} रखो, ${p.carry} बाएँ भेजो। ${p.left} + ${p.carry} = ${p.finalLeft}।`,
        ),
        visual: (
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            {partsRow(p, gap)}
            <span className="pb-2 text-xl text-slate-300 dark:text-slate-600">→</span>
            {finalRow(p, gap)}
          </div>
        ),
      });
    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {p.finalLeft} / {p.keep} → {p.answer}. {t("Check: ", "जाँच: ")}
          {a} × {b} = {a * b} ✓
        </span>
      ),
      visual: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {finalRow(p, gap)}
          <span className="inline-flex items-center gap-x-4">
            <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
            <NumberBoxes groups={[{ digits: String(p.answer), tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        </div>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("teens", lang)}
        subtitle={t(`Multiply any two numbers from ${MIN} to ${MAX} in your head: one addition, one small multiplication.`, `${MIN} से ${MAX} तक के कोई भी दो नंबर मन में गुणा करो: एक जोड़, एक छोटा गुणा।`)}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ol className={`mt-2 flex list-decimal flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("One number + the other's unit digit.", "एक नंबर + दूसरे का इकाई अंक।")}</li>
          <li>{t("Multiply the unit digits.", "इकाई अंकों का गुणा करो।")}</li>
          <li>{t("Write them as left / right and apply the Balancing Rule (one digit on the right).", "बायाँ / दायाँ लिखो और संतुलन नियम लगाओ (दाएँ एक अंक)।")}</li>
        </ol>
        {animate ? (
          <AnimatedExamples id="teens" cases={teensCases(t, gap)} lang={lang} gap={gap} />
        ) : (
          <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
            <span>15 × 18: 15 + 8 = 23, 5 × 8 = 40</span>
            <span>23 / 40 → 23 + 4 = 27 / 0 → 270</span>
          </div>
        )}
      </Card>

      <Card title={t("Why it works", "ये क्यों चलता है")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Both numbers are 10 + their unit digit: (10 + 5)(10 + 8) = 10 × (10 + 5 + 8) + 5 × 8 = 10 × 23 + 40. The left part counts tens, the right part ones, which is why the right part keeps one digit. It is Nikhilam with base 10.",
            "दोनों नंबर 10 + इकाई अंक हैं: (10 + 5)(10 + 8) = 10 × (10 + 5 + 8) + 5 × 8 = 10 × 23 + 40। बायाँ हिस्सा दहाई गिनता है, दायाँ इकाई, इसीलिए दाएँ एक अंक रहता है। ये 10 बेस वाला निखिलम् है।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("Your numbers", "तुम्हारे नंबर")}</h3>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <NumIn label={t("First number", "पहला नंबर")} value={raw[0]} onChange={(v) => setRaw(([, y]) => [v.replace(/\D/g, "").slice(0, 2), y])} hideLabel />
          <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
          <NumIn label={t("Second number", "दूसरा नंबर")} value={raw[1]} onChange={(v) => setRaw(([x]) => [x, v.replace(/\D/g, "").slice(0, 2)])} hideLabel />
        </div>
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map(([x, y]) => ({ label: `${x} × ${y}`, onClick: () => setRaw([String(x), String(y)]) }))} />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Left: number + the other's unit digit.", "बायाँ: नंबर + दूसरे का इकाई अंक।")}</li>
          <li>{t("Right: unit × unit, one digit only; carry the rest left.", "दायाँ: इकाई × इकाई, सिर्फ़ एक अंक; बाकी बाएँ भेजो।")}</li>
          <li>{t("The biggest carry is 8 (9 × 9 = 81).", "सबसे बड़ा हासिल 8 है (9 × 9 = 81)।")}</li>
        </ul>
      </Card>
    </div>
  );
};
