import React, { useState } from "react";
import { BoxStack, NumberBoxes } from "./NumberBoxes";
import { tensUnitCells, twoDigitCells } from "./cells";
import { planEkadhikena, type EkadhikenaPlan } from "./ekadhikena";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, Segmented, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { EkadhikenaGlance } from "./glances";

type Mode = "square" | "pair";

const SQUARES = ["35", "95", "105"];
const PAIRS: [string, string][] = [
  ["53", "57"],
  ["58", "52"],
  ["15", "15"],
  ["45", "45"],
  ["95", "95"],
  ["123", "127"],
];

/** Ekadhikena Purvena: squares of numbers ending in 5, and products like 53 × 57, in one line. */
export const EkadhikenaPurvena: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("square");
  const [n, setN] = useState("35");
  const [a, setA] = useState("53");
  const [b, setB] = useState("57");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const x = mode === "square" ? Number(n) : Number(a);
  const y = mode === "square" ? Number(n) : Number(b);
  const empty = mode === "square" ? n === "" : a === "" || b === "";
  const check = empty ? null : planEkadhikena(x, y);

  let error: string | null = null;
  if (empty) error = t("Type the numbers.", "नंबर लिखो।");
  else if (mode === "square" && x % 10 !== 5) error = t("Pick a number ending in 5, like 35 or 95.", "5 पर ख़त्म होने वाला नंबर लो, जैसे 35 या 95।");
  else if (check?.miss) {
    const miss = check.miss;
    if (miss.reason === "range") error = t("Use whole numbers from 1 to 9999.", "1 से 9999 तक के पूरे नंबर लो।");
    else if (miss.reason === "tens")
      error = t(`The tens must be the same: ${miss.tensA} and ${miss.tensB} are different.`, `दहाई एक जैसी होनी चाहिए: ${miss.tensA} और ${miss.tensB} अलग हैं।`);
    else {
      const sum = (miss.ua ?? 0) + (miss.ub ?? 0);
      error = t(`The unit digits must add up to 10: ${miss.ua} + ${miss.ub} = ${sum}.`, `इकाई के अंकों का जोड़ 10 होना चाहिए: ${miss.ua} + ${miss.ub} = ${sum}।`);
    }
  }
  const plan: EkadhikenaPlan | null = !error && check?.plan ? check.plan : null;

  const numberRow = (v: number) => {
    const { tens, unit } = tensUnitCells(v);
    return <NumberBoxes groups={[{ cells: tens }, { cells: unit }]} gap={gap} separator="|" />;
  };
  /** left | right, each with how it was made underneath. */
  const parts = (p: EkadhikenaPlan, size: "md" | "lg" = "md") => (
    <NumberBoxes
      groups={[
        { digits: String(p.left), tone: "done", caption: `${p.tens} × ${p.next}` },
        { cells: twoDigitCells(p.right), caption: `${p.ua} × ${p.ub}` },
      ]}
      gap={gap}
      separator="|"
      size={size}
    />
  );

  const steps: StepView[] = [];
  if (plan) {
    const square = mode === "square";
    steps.push({
      title: t("Check the two conditions", "दोनों शर्तें जाँचो"),
      body: (
        <>
          {square && <span>{t(`${plan.a}² means ${plan.a} × ${plan.a}. `, `${plan.a}² यानी ${plan.a} × ${plan.a}। `)}</span>}
          {t("Tens: ", "दहाई: ")}
          <b className={STRONG}>
            {plan.tens} = {plan.tens}
          </b>{" "}
          ✓ · {t("Units: ", "इकाई: ")}
          <b className={STRONG}>
            {plan.ua} + {plan.ub} = 10
          </b>{" "}
          ✓
        </>
      ),
      visual: <BoxStack rows={[{ node: numberRow(plan.a) }, { label: "×", node: numberRow(plan.b) }]} />,
    });
    steps.push({
      title: t("One more than the one before", "पिछले से एक ज़्यादा"),
      body: t(`Ekadhikena: one more than the tens ${plan.tens} is ${plan.next}.`, `एकाधिकेन: दहाई ${plan.tens} से एक ज़्यादा है ${plan.next}।`),
      visual: (
        <NumberBoxes
          groups={[
            { digits: String(plan.tens), tone: "added" },
            { digits: String(plan.next), tone: "carry" },
          ]}
          arrows={[{ from: 0, to: 1, label: "+1" }]}
          gap={gap}
          separator={" "}
        />
      ),
    });
    steps.push({
      title: t("Left part: multiply them", "बायाँ हिस्सा: दोनों का गुणा"),
      body: (
        <b className={STRONG}>
          {plan.tens} × {plan.next} = {plan.left}
        </b>
      ),
      visual: <NumberBoxes groups={[{ digits: String(plan.left), tone: "done", caption: `${plan.tens} × ${plan.next}` }]} gap={gap} separator={null} />,
    });
    steps.push({
      title: t("Right part: multiply the units", "दायाँ हिस्सा: इकाइयों का गुणा"),
      body: (
        <>
          <b className={STRONG}>
            {plan.ua} × {plan.ub} = {plan.right}
          </b>
          {plan.right < 10
            ? t(`, written with two digits: ${plan.rightText}.`, `, दो अंकों में लिखो: ${plan.rightText}।`)
            : t(". It always takes two digits.", "। ये हमेशा दो अंक का होता है।")}
        </>
      ),
      visual: (
        <NumberBoxes
          groups={[{ cells: twoDigitCells(plan.right), caption: `${plan.ua} × ${plan.ub}` }]}
          gap={gap}
          separator={null}
        />
      ),
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

  const glance = planEkadhikena(53, 57);

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("ekadhikena", lang)}
        subtitle={t("A one-line shortcut for 35², 95² and products like 53 × 57.", "35², 95² और 53 × 57 जैसे गुणा का एक लाइन वाला शॉर्टकट।")}
      />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ul className={`mt-2 flex flex-col gap-1 ${BODY}`}>
          <li>
            ✓ {t("The tens are the same", "दहाई एक जैसी हो")} <span className="text-slate-400 dark:text-slate-500">(5_ × 5_)</span>
          </li>
          <li>
            ✓ {t("The unit digits add up to 10", "इकाई के अंकों का जोड़ 10 हो")} <span className="text-slate-400 dark:text-slate-500">(3 + 7)</span>
          </li>
        </ul>
        <div className={`mt-3 grid gap-1 ${BODY}`}>
          <p>
            <b className={STRONG}>{t("Left", "बायाँ")}</b> = {t("tens × (tens + 1)", "दहाई × (दहाई + 1)")}
          </p>
          <p>
            <b className={STRONG}>{t("Right", "दायाँ")}</b> = {t("unit × unit, always two digits", "इकाई × इकाई, हमेशा दो अंक")}
          </p>
        </div>
        {animate ? (
          <div className="mt-4">
            <EkadhikenaGlance lang={lang} gap={gap} animate />
          </div>
        ) : glance.plan && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-x-auto">
            <span className="text-lg font-medium tabular-nums text-slate-700 dark:text-slate-300">53 × 57 =</span>
            {parts(glance.plan, "lg")}
            <span className="inline-flex items-center gap-x-4 pb-5">
              <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
              <NumberBoxes groups={[{ digits: glance.plan.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
            </span>
          </div>
        )}
        <p className={`mt-1 ${BODY}`}>
          {t("Every number ending in 5 fits too (5 + 5 = 10): 35² = 3×4 | 25 = 1225.", "5 पर ख़त्म होने वाला हर नंबर भी फ़िट है (5 + 5 = 10): 35² = 3×4 | 25 = 1225।")}
        </p>
      </Card>

      <div className="grid gap-3 @lg:grid-cols-2">
        <Card title={t("Why this name", "ये नाम क्यों")}>
          <p className={`mt-1 ${BODY}`}>
            {t(
              "Ekadhika means \"one more\" and Purva means \"the one before\". The digit before the unit digit, the tens, is made one more: 5 becomes 6. That is the whole trick.",
              "एकाधिक यानी \"एक ज़्यादा\" और पूर्व यानी \"पहले वाला\"। इकाई से पहले वाला अंक, यानी दहाई, एक ज़्यादा कर दो: 5 बन जाता है 6। बस यही ट्रिक है।",
            )}
          </p>
        </Card>
        <Card title={t("How it's written", "कैसे लिखते हैं")}>
          <p className={`mt-1 ${BODY}`}>{t("Left part | right part. The right part always has two digits.", "बायाँ हिस्सा | दायाँ हिस्सा। दाएँ हिस्से में हमेशा दो अंक।")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 overflow-x-auto">
            <NumberBoxes groups={[{ digits: "30" }, { digits: "21" }]} gap={gap} separator="|" size="sm" />
            <NumberBoxes groups={[{ digits: "30" }, { cells: [{ v: "0", tone: "added" }, { v: "9" }] }]} gap={gap} separator="|" size="sm" />
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
              ["square", t("Square ending in 5", "5 वाले का वर्ग")],
              ["pair", t("Units add to 10", "इकाई का जोड़ 10")],
            ]}
          />
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {mode === "square" ? (
            <>
              <input value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("Number", "नंबर")} className={`${INPUT} w-28`} />
              <span className="text-xl text-slate-400 dark:text-slate-500">²</span>
            </>
          ) : (
            <>
              <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("First number", "पहला नंबर")} className={`${INPUT} w-24`} />
              <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
              <input value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("Second number", "दूसरा नंबर")} className={`${INPUT} w-24`} />
            </>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={[
              ...SQUARES.map((s) => ({
                label: `${s}²`,
                onClick: () => {
                  setMode("square");
                  setN(s);
                },
              })),
              ...PAIRS.map(([p, q]) => ({
                label: `${p} × ${q}`,
                onClick: () => {
                  setMode("pair");
                  setA(p);
                  setB(q);
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
          {t("The right part always has two digits: 51 × 59 = 30 | 09 = 3009, not 309.", "दाएँ हिस्से में हमेशा दो अंक: 51 × 59 = 30 | 09 = 3009, 309 नहीं।")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode("pair");
              setA("51");
              setB("59");
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
