import React, { useState } from "react";
import type { BoxTone } from "./NumberBoxes";
import { fromSumAndDifference, planSankalana, type Combined } from "./sankalana";
import type { Q } from "./shunyam";
import { Answer, LinEq, NumIn, Op, Row, Term, checkText, eqText, num } from "./equation";
import { methodName } from "./methods";
import { BODY, CARD, Card, Examples, GapSwitch, LessonHeader, STRONG, StepList, tr, useBoxGap, type Lang, type StepView } from "./ui";

const EXAMPLES: number[][] = [
  [45, -23, 113, 23, -45, 91],
  [3, 5, 21, 5, 3, 19],
  [37, 29, 95, 29, 37, 103],
  [1955, -476, 2482, 476, -1955, -4913],
  [2, 3, 8, 3, -1, 1],
];
const LABELS = ["a", "b", "p", "c", "d", "q"];
const SUM_DIFF_EXAMPLES: [number, number][] = [
  [50, 14],
  [100, 36],
  [17, 5],
];

/** "x + y" or "x − y" */
const pm = (sign: 1 | -1) => (sign === 1 ? "x + y" : "x − y");

/** Sankalana Vyavakalanabhyam: by addition and by subtraction. */
export const SankalanaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [raw, setRaw] = useState<string[]>(() => EXAMPLES[0].map(String));
  const [sd, setSd] = useState<string[]>(() => SUM_DIFF_EXAMPLES[0].map(String));
  const [spaced, setSpaced, gap] = useBoxGap();
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const [a, b, p, c, d, q] = raw.map(Number);
  const setAt = (i: number, v: string) => setRaw((all) => all.map((x, j) => (j === i ? v : x)));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  // (k)x ± (k)y = r  →  ÷ k  →  x ± y = value
  const combinedVisual = (cmb: Combined, tone: BoxTone) => (
    <div className="flex flex-col gap-2">
      <LinEq a={cmb.k} b={cmb.l} p={cmb.r} gap={gap} tones={[tone, tone, "carry"]} />
      <Row>
        <Term cells={[pm(cmb.sign)]} tone={tone} gap={gap} />
        <Op>=</Op>
        <Term cells={[`${num(cmb.r)} ÷ ${num(cmb.k)}`]} gap={gap} />
        <Op>=</Op>
        <Term cells={[cmb.value.toString()]} tone="done" gap={gap} />
      </Row>
    </div>
  );
  // ( s ± t ) ÷ 2 = v
  const halfVisual = (name: string, s: Q, tt: Q, plus: boolean, v: Q, tones: [BoxTone, BoxTone]) => (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 @md:gap-x-2">
      <Term cells={[name]} gap={gap} size="sm" />
      <Op>=</Op>
      <Op>(</Op>
      <Term cells={[s.toString()]} tone={tones[0]} gap={gap} size="sm" />
      <Op>{plus ? "+" : "−"}</Op>
      <Term cells={[tt.toString()]} tone={tones[1]} gap={gap} size="sm" />
      <Op>) ÷ 2 =</Op>
      <Term cells={[v.toString()]} tone="done" gap={gap} size="sm" />
    </div>
  );
  const bothAnswers = (x: Q, y: Q) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Answer x={x} gap={gap} name="x" />
      <Answer x={y} gap={gap} name="y" />
    </div>
  );

  if (valid) {
    const plan = planSankalana(a, b, p, c, d, q);
    const signsChanged = plan.swapped && c === -b && d === -a && b !== 0;
    steps.push({
      title: plan.swapped ? t("The x and y numbers are swapped", "x और y के नंबर अदला-बदली हैं") : t("Two equations", "दो समीकरण"),
      body: plan.swapped
        ? signsChanged
          ? t(`${num(a)}, ${num(b)} on top; ${num(c)}, ${num(d)} below: swapped, with the signs changed.`, `ऊपर ${num(a)}, ${num(b)}; नीचे ${num(c)}, ${num(d)}: अदला-बदली, चिह्न बदलकर।`)
          : t(`${num(a)}, ${num(b)} on top; ${num(c)}, ${num(d)} below: swapped.`, `ऊपर ${num(a)}, ${num(b)}; नीचे ${num(c)}, ${num(d)}: अदला-बदली।`)
        : t("Look for the x and y numbers swapped between the two equations.", "देखो, क्या दोनों समीकरणों में x और y के नंबर अदला-बदली हैं।"),
      visual: (
        <div className="flex flex-col gap-2">
          <LinEq a={a} b={b} p={p} gap={gap} tones={["active", "added", "carry"]} />
          <LinEq a={c} b={d} p={q} gap={gap} tones={plan.swapped ? ["added", "active", "carry"] : ["active", "added", "carry"]} />
        </div>
      ),
    });

    if (plan.det === 0) {
      note = t("The x and y numbers are in the same ratio: the lines never meet or are the same line, no single answer.", "x और y के नंबर एक ही अनुपात में हैं: रेखाएँ मिलती नहीं या एक ही हैं, कोई एक जवाब नहीं।");
    } else if (plan.swapped) {
      const add = plan.add!;
      const sub = plan.sub!;
      steps.push({
        title: t("Add the two equations", "दोनों समीकरण जोड़ो"),
        body: t(
          `Divide by ${num(add.k)}: ${pm(add.sign)} = ${add.value}.`,
          `${num(add.k)} से भाग दो: ${pm(add.sign)} = ${add.value}।`,
        ),
        visual: combinedVisual(add, "active"),
      });
      steps.push({
        title: plan.subFlipped ? t("Subtract: second − first", "घटाओ: दूसरा − पहला") : t("Subtract: first − second", "घटाओ: पहला − दूसरा"),
        body: t(`Divide by ${num(sub.k)}: ${pm(sub.sign)} = ${sub.value}.`, `${num(sub.k)} से भाग दो: ${pm(sub.sign)} = ${sub.value}।`),
        visual: combinedVisual(sub, "added"),
      });
      const sum = plan.sum!;
      const diff = plan.diff!;
      // Each keeps the colour of the step it came from: adding is yellow, subtracting blue.
      const halfTones: [BoxTone, BoxTone] = add.sign === 1 ? ["active", "added"] : ["added", "active"];
      steps.push({
        title: t("From x + y and x − y", "x + y और x − y से"),
        body: (
          <span className="flex flex-col gap-0.5 tabular-nums">
            <b className={STRONG}>{t("x = (sum + difference) ÷ 2", "x = (जोड़ + अंतर) ÷ 2")}</b>
            <b className={STRONG}>{t("y = (sum − difference) ÷ 2", "y = (जोड़ − अंतर) ÷ 2")}</b>
          </span>
        ),
        visual: (
          <div className="flex flex-col gap-2">
            {halfVisual("x", sum, diff, true, plan.x!, halfTones)}
            {halfVisual("y", sum, diff, false, plan.y!, halfTones)}
          </div>
        ),
      });
      const xv = plan.x!.toString();
      const yv = plan.y!.toString();
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(
          `x = ${xv}, y = ${yv}. Check: ${checkText(a, b, p, xv, yv)} ✓, ${checkText(c, d, q, xv, yv)} ✓`,
          `x = ${xv}, y = ${yv}। जाँच: ${checkText(a, b, p, xv, yv)} ✓, ${checkText(c, d, q, xv, yv)} ✓`,
        ),
        visual: bothAnswers(plan.x!, plan.y!),
      });
    } else {
      steps.push({
        title: t("Not swapped: the long way", "अदला-बदली नहीं: लंबा तरीका"),
        body: t(
          `Adding and subtracting don't give x + y and x − y here. Cross-multiplying gives x = ${plan.x}, y = ${plan.y}. Try swapping the numbers in the second equation!`,
          `यहाँ जोड़ने-घटाने से x + y और x − y नहीं मिलते। क्रॉस-गुणा से x = ${plan.x}, y = ${plan.y}। दूसरे समीकरण में नंबर अदला-बदली करके देखो!`,
        ),
        visual: bothAnswers(plan.x!, plan.y!),
      });
    }
  }

  // One row of the input: [a] x + [b] y = [p]
  const inputRow = (i: number) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <NumIn label={LABELS[i]} value={raw[i]} onChange={(v) => setAt(i, v)} hideLabel maxLength={5} />
      <span className="text-base font-medium text-slate-700 dark:text-slate-300">x +</span>
      <NumIn label={LABELS[i + 1]} value={raw[i + 1]} onChange={(v) => setAt(i + 1, v)} hideLabel maxLength={5} />
      <span className="text-base font-medium text-slate-700 dark:text-slate-300">y =</span>
      <NumIn label={LABELS[i + 2]} value={raw[i + 2]} onChange={(v) => setAt(i + 2, v)} hideLabel maxLength={5} />
    </div>
  );

  // Other use: two numbers from their sum and difference.
  const sdValid = sd.every((s) => /^-?\d+$/.test(s));
  const [S, D] = sd.map(Number);
  const two = sdValid ? fromSumAndDifference(S, D) : null;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("sankalana", lang)}
        subtitle={t("When the x and y numbers are swapped, add once and subtract once: two equations solved in two lines.", "जब x और y के नंबर अदला-बदली हों, एक बार जोड़ो और एक बार घटाओ: दो समीकरण दो लाइन में हल।")}
      />

      <Card title={t("The rule", "नियम")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Add the equations and subtract them: you get x + y and x − y.", "समीकरण जोड़ो और घटाओ: x + y और x − y मिल जाते हैं।")}</b>
        </p>
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>45x − 23y = 113, 23x − 45y = 91</span>
          <span>{t("Add", "जोड़ो")}: 68x − 68y = 204 → x − y = 3</span>
          <span>{t("Subtract", "घटाओ")}: 22x + 22y = 22 → x + y = 1</span>
          <span>x = (1 + 3) ÷ 2 = 2, y = (1 − 3) ÷ 2 = −1</span>
        </div>
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Sankalana means \"addition\", Vyavakalana \"subtraction\", and -abhyam \"by both\". By adding and by subtracting, the swapped numbers come together into one number for x + y and one for x − y.",
            "संकलन यानी \"जोड़\", व्यवकलन यानी \"घटाव\", और -आभ्याम् यानी \"दोनों से\"। जोड़ने और घटाने से अदला-बदली वाले नंबर मिलकर x + y और x − y के लिए एक-एक नंबर बन जाते हैं।",
          )}
        </p>
      </Card>

      {/* Your equations */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("Your equations", "तुम्हारे समीकरण")}</h3>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {inputRow(0)}
          {inputRow(3)}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES.map((e) => ({ label: `${eqText(e[0], e[1], e[2])}, ${eqText(e[3], e[4], e[5])}`, onClick: () => setRaw(e.map(String)) }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Other use: two numbers from their sum and difference", "दूसरा उपयोग: जोड़ और अंतर से दो नंबर")}>
        <p className={`mt-1 ${BODY}`}>
          {t("The last step on its own: if you know the sum and the difference of two numbers, add and halve, subtract and halve.", "सिर्फ़ आख़िरी कदम: दो नंबरों का जोड़ और अंतर पता हो, तो जोड़कर आधा करो, घटाकर आधा करो।")}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <NumIn label={t("Sum", "जोड़")} value={sd[0]} onChange={(v) => setSd(([, y]) => [v, y])} maxLength={5} />
          <NumIn label={t("Difference", "अंतर")} value={sd[1]} onChange={(v) => setSd(([x]) => [x, v])} maxLength={5} />
        </div>
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={SUM_DIFF_EXAMPLES.map((e) => ({ label: `${e[0]}, ${e[1]}`, onClick: () => setSd(e.map(String)) }))} />
        </div>
        {two ? (
          <div className="mt-4 flex flex-col gap-2">
            <Row>
              <span className="basis-full text-xs font-medium text-slate-500 @md:w-24 @md:shrink-0 @md:basis-auto dark:text-slate-400">{t("Bigger", "बड़ा")}</span>
              <Op>(</Op>
              <Term cells={[num(S)]} tone="active" gap={gap} size="sm" />
              <Op>+</Op>
              <Term cells={[num(D)]} tone="added" gap={gap} size="sm" />
              <Op>) ÷ 2 =</Op>
              <Term cells={[two.big.toString()]} tone="done" gap={gap} size="sm" />
            </Row>
            <Row>
              <span className="basis-full text-xs font-medium text-slate-500 @md:w-24 @md:shrink-0 @md:basis-auto dark:text-slate-400">{t("Smaller", "छोटा")}</span>
              <Op>(</Op>
              <Term cells={[num(S)]} tone="active" gap={gap} size="sm" />
              <Op>−</Op>
              <Term cells={[num(D)]} tone="added" gap={gap} size="sm" />
              <Op>) ÷ 2 =</Op>
              <Term cells={[two.small.toString()]} tone="done" gap={gap} size="sm" />
            </Row>
            <p className="text-[13px] tabular-nums text-slate-500 dark:text-slate-400">
              {t("Check", "जाँच")}: {two.big.toString()} + {two.small.toString()} = {num(S)} ✓, {two.big.toString()} − {two.small.toString()} = {num(D)} ✓
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{t("Fill both boxes with whole numbers.", "दोनों डिब्बों में पूरे नंबर लिखो।")}</p>
        )}
      </Card>

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Spot it: the x number of one equation is the y number of the other.", "पहचानो: एक समीकरण का x वाला नंबर दूसरे का y वाला है।")}</li>
          <li>{t("Add once, subtract once, and divide: x + y and x − y.", "एक बार जोड़ो, एक बार घटाओ, और भाग दो: x + y और x − y।")}</li>
          <li>{t("x = (sum + difference) ÷ 2, y = (sum − difference) ÷ 2.", "x = (जोड़ + अंतर) ÷ 2, y = (जोड़ − अंतर) ÷ 2।")}</li>
        </ul>
      </Card>
    </div>
  );
};
