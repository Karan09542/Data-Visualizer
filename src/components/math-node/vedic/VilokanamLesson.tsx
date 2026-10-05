import React, { useState } from "react";
import { BoxStack, NumberBoxes } from "./NumberBoxes";
import { tensUnitCells, twoDigitCells } from "./cells";
import { planVilokanam, type VilokanamPlan } from "./vilokanam";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, Segmented, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { VilokanamGlance } from "./glances";

type Mode = "pair" | "square";

const PAIRS: [string, string][] = [
  ["44", "64"],
  ["37", "77"],
  ["23", "83"],
  ["91", "11"],
];
const SQUARES = ["51", "53", "57", "59"];

/** Vilokanam: units the same and tens adding up to 10 (44 × 64), and squares from 51 to 59. */
export const Vilokanam: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("pair");
  const [a, setA] = useState("44");
  const [b, setB] = useState("64");
  const [n, setN] = useState("53");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const square = mode === "square";
  const x = square ? Number(n) : Number(a);
  const y = square ? Number(n) : Number(b);
  const empty = square ? n === "" : a === "" || b === "";
  const check = empty ? null : planVilokanam(x, y);

  let error: string | null = null;
  if (empty) error = t("Type the numbers.", "नंबर लिखो।");
  else if (square && (x < 51 || x > 59)) error = t("Pick a number from 51 to 59.", "51 से 59 तक का कोई नंबर लो।");
  else if (check?.miss) {
    const miss = check.miss;
    if (miss.reason === "range") error = t("Use two-digit numbers, 10 to 99.", "दो अंकों के नंबर लो, 10 से 99 तक।");
    else if (miss.reason === "units")
      error = t(`The unit digits must be the same: ${miss.ua} and ${miss.ub} are different.`, `इकाई के अंक एक जैसे होने चाहिए: ${miss.ua} और ${miss.ub} अलग हैं।`);
    else {
      const sum = (miss.ta ?? 0) + (miss.tb ?? 0);
      error = t(`The tens must add up to 10: ${miss.ta} + ${miss.tb} = ${sum}.`, `दहाई का जोड़ 10 होना चाहिए: ${miss.ta} + ${miss.tb} = ${sum}।`);
    }
  }
  const plan: VilokanamPlan | null = !error && check?.plan ? check.plan : null;

  const numberRow = (v: number) => {
    const { tens, unit } = tensUnitCells(v);
    return <NumberBoxes groups={[{ cells: tens }, { cells: unit }]} gap={gap} separator="|" />;
  };
  /** left | right, each with how it was made underneath. */
  const parts = (p: VilokanamPlan, size: "md" | "lg" = "md") => (
    <NumberBoxes
      groups={[
        { digits: String(p.left), tone: "done", caption: `${p.ta}×${p.tb} + ${p.unit}` },
        { cells: twoDigitCells(p.right), caption: `${p.unit} × ${p.unit}` },
      ]}
      gap={gap}
      separator="|"
      size={size}
    />
  );

  const steps: StepView[] = [];
  if (plan) {
    steps.push({
      title: t("Check the two conditions", "दोनों शर्तें जाँचो"),
      body: (
        <>
          {square && <span>{t(`${plan.a}² means ${plan.a} × ${plan.a}. `, `${plan.a}² यानी ${plan.a} × ${plan.a}। `)}</span>}
          {t("Units: ", "इकाई: ")}
          <b className={STRONG}>
            {plan.unit} = {plan.unit}
          </b>{" "}
          ✓ · {t("Tens: ", "दहाई: ")}
          <b className={STRONG}>
            {plan.ta} + {plan.tb} = 10
          </b>{" "}
          ✓
        </>
      ),
      visual: <BoxStack rows={[{ node: numberRow(plan.a) }, { label: "×", node: numberRow(plan.b) }]} />,
    });
    steps.push({
      title: t("Multiply the tens", "दहाई का गुणा करो"),
      body: (
        <b className={STRONG}>
          {plan.ta} × {plan.tb} = {plan.product}
        </b>
      ),
      visual: <NumberBoxes groups={[{ digits: String(plan.product), tone: "added", caption: `${plan.ta} × ${plan.tb}` }]} gap={gap} separator={null} />,
    });
    steps.push({
      title: t("Add the unit digit: the left part", "इकाई का अंक जोड़ो: बायाँ हिस्सा"),
      body: (
        <b className={STRONG}>
          {plan.product} + {plan.unit} = {plan.left}
        </b>
      ),
      visual: (
        <NumberBoxes
          groups={[
            { digits: String(plan.product), tone: "added" },
            { digits: String(plan.left), tone: "done" },
          ]}
          arrows={[{ from: 0, to: 1, label: `+${plan.unit}` }]}
          gap={gap}
          separator={" "}
        />
      ),
    });
    steps.push({
      title: t("Right part: unit × unit", "दायाँ हिस्सा: इकाई × इकाई"),
      body: (
        <>
          <b className={STRONG}>
            {plan.unit} × {plan.unit} = {plan.right}
          </b>
          {plan.right < 10 ? t(`, written with two digits: ${plan.rightText}.`, `, दो अंकों में लिखो: ${plan.rightText}।`) : t(". It always takes two digits.", "। ये हमेशा दो अंक का होता है।")}
        </>
      ),
      visual: <NumberBoxes groups={[{ cells: twoDigitCells(plan.right), caption: `${plan.unit} × ${plan.unit}` }]} gap={gap} separator={null} />,
    });
    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {plan.left} | {plan.rightText} → {plan.answer}. {t("Check: ", "जाँच: ")}
          {square ? `${plan.a}²` : `${plan.a} × ${plan.b}`} = {plan.a * plan.b} ✓
        </span>
      ),
      visual: (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BoxStack rows={[{ node: numberRow(plan.a) }, { label: "×", node: numberRow(plan.b) }, { rule: true, node: parts(plan) }]} />
          <span className="inline-flex items-center gap-x-4">
            <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
            <NumberBoxes groups={[{ digits: plan.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        </div>
      ),
    });
  }

  const glance = planVilokanam(44, 64).plan;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader title={methodName("vilokanam", lang)} subtitle={t("Products like 44 × 64 and squares from 51 to 59, just by looking.", "44 × 64 जैसे गुणा और 51 से 59 तक के वर्ग, बस देखकर।")} />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ul className={`mt-2 flex flex-col gap-1 ${BODY}`}>
          <li>
            ✓ {t("The unit digits are the same", "इकाई के अंक एक जैसे हों")} <span className="text-slate-400 dark:text-slate-500">(_4 × _4)</span>
          </li>
          <li>
            ✓ {t("The tens add up to 10", "दहाई का जोड़ 10 हो")} <span className="text-slate-400 dark:text-slate-500">(4 + 6)</span>
          </li>
        </ul>
        <div className={`mt-3 grid gap-1 ${BODY}`}>
          <p>
            <b className={STRONG}>{t("Left", "बायाँ")}</b> = {t("tens × tens + unit", "दहाई × दहाई + इकाई")}
          </p>
          <p>
            <b className={STRONG}>{t("Right", "दायाँ")}</b> = {t("unit × unit, always two digits", "इकाई × इकाई, हमेशा दो अंक")}
          </p>
        </div>
        {animate ? (
          <div className="mt-4">
            <VilokanamGlance lang={lang} gap={gap} animate />
          </div>
        ) : glance && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-x-auto">
            <span className="text-lg font-medium tabular-nums text-slate-700 dark:text-slate-300">44 × 64 =</span>
            {parts(glance, "lg")}
            <span className="inline-flex items-center gap-x-4 pb-5">
              <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
              <NumberBoxes groups={[{ digits: glance.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
            </span>
          </div>
        )}
        <p className={`mt-1 ${BODY}`}>
          {t(
            "It's the reverse of Ekadhikena Purvena, where the tens match and the units add up to 10.",
            "ये एकाधिकेन पूर्वेण का उल्टा है, जहाँ दहाई एक जैसी होती है और इकाई का जोड़ 10।",
          )}
        </p>
      </Card>

      {/* The 51–59 shortcut */}
      <Card title={t("Squares from 51 to 59", "51 से 59 तक के वर्ग")}>
        <p className={`mt-1 ${BODY}`}>
          {t("5 + 5 = 10, so every square from 51 to 59 fits. 5 × 5 is always 25, so:", "5 + 5 = 10, तो 51 से 59 तक हर वर्ग फ़िट है। 5 × 5 हमेशा 25, तो:")}{" "}
          <b className={STRONG}>{t("left = 25 + unit, right = unit²", "बायाँ = 25 + इकाई, दायाँ = इकाई²")}</b>
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 overflow-x-auto">
          {[53, 57].map((v) => {
            const p = planVilokanam(v, v).plan!;
            return (
              <span key={v} className="inline-flex items-center gap-x-3">
                <span className="text-[15px] font-medium tabular-nums text-slate-700 dark:text-slate-300">{v}² =</span>
                <NumberBoxes
                  groups={[
                    { digits: String(p.left), tone: "done", caption: `25 + ${p.unit}` },
                    { cells: twoDigitCells(p.right), caption: `${p.unit}²` },
                  ]}
                  gap={gap}
                  separator="|"
                  size="sm"
                />
              </span>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 @lg:grid-cols-2">
        <Card title={t("Why this name", "ये नाम क्यों")}>
          <p className={`mt-1 ${BODY}`}>
            {t(
              "Vilokanam means \"by just looking\". You spot the pattern (same units, tens that make 10) and write the answer straight away, with no long multiplication.",
              "विलोकनम् यानी \"बस देखकर\"। पैटर्न पहचानो (इकाई एक जैसी, दहाई का जोड़ 10) और सीधा जवाब लिख दो, लंबे गुणा की ज़रूरत नहीं।",
            )}
          </p>
        </Card>
        <Card title={t("How it's written", "कैसे लिखते हैं")}>
          <p className={`mt-1 ${BODY}`}>{t("Left part | right part. The right part always has two digits.", "बायाँ हिस्सा | दायाँ हिस्सा। दाएँ हिस्से में हमेशा दो अंक।")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 overflow-x-auto">
            <NumberBoxes groups={[{ digits: "28" }, { digits: "16" }]} gap={gap} separator="|" size="sm" />
            <NumberBoxes groups={[{ digits: "28" }, { cells: [{ v: "0", tone: "added" }, { v: "9" }] }]} gap={gap} separator="|" size="sm" />
          </div>
        </Card>
      </div>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            label="Case"
            options={[
              ["pair", t("Tens add to 10", "दहाई का जोड़ 10")],
              ["square", t("Squares 51–59", "51–59 के वर्ग")],
            ]}
          />
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {square ? (
            <>
              <input value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label={t("Number", "नंबर")} className={`${INPUT} w-20`} />
              <span className="text-xl text-slate-400 dark:text-slate-500">²</span>
            </>
          ) : (
            <>
              <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label={t("First number", "पहला नंबर")} className={`${INPUT} w-20`} />
              <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
              <input value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label={t("Second number", "दूसरा नंबर")} className={`${INPUT} w-20`} />
            </>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={[
              ...PAIRS.map(([p, q]) => ({
                label: `${p} × ${q}`,
                onClick: () => {
                  setMode("pair");
                  setA(p);
                  setB(q);
                },
              })),
              ...SQUARES.map((s) => ({
                label: `${s}²`,
                onClick: () => {
                  setMode("square");
                  setN(s);
                },
              })),
            ]}
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <p className={`mt-1 ${BODY}`}>
          {t("The right part always has two digits: 53² = 28 | 09 = 2809, not 289.", "दाएँ हिस्से में हमेशा दो अंक: 53² = 28 | 09 = 2809, 289 नहीं।")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode("square");
              setN("53");
            }}
            className="font-medium text-slate-900 underline underline-offset-2 dark:text-slate-100"
          >
            {t("Try it", "आज़माओ")}
          </button>
        </p>
      </Card>
    </div>
  );
};
