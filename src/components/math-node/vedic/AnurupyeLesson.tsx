import React, { useState } from "react";
import type { BoxTone } from "./NumberBoxes";
import { planAnurupye, reduceRatio, sameRatio } from "./anurupye";
import { Answer, LinEq, NumIn, Op, Row, Term, checkText, eqText, num } from "./equation";
import { methodName } from "./methods";
import { BODY, CARD, Card, Examples, GapSwitch, LessonHeader, STRONG, StepList, tr, useBoxGap, type Lang, type StepView } from "./ui";

const EXAMPLES: number[][] = [
  [12, 78, 12, 16, 96, 16],
  [3, 7, 2, 4, 21, 6],
  [523, 147, 1046, 343, 649, 686],
  [5, 9, 18, 3, 12, 24],
  [2, 3, 8, 3, -1, 1],
];
const LABELS = ["a", "b", "p", "c", "d", "q"];

/** Anurupye Shunyamanyat: if one is in ratio, the other one is zero. */
export const AnurupyeLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [raw, setRaw] = useState<string[]>(() => EXAMPLES[0].map(String));
  const [spaced, setSpaced, gap] = useBoxGap();
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const [a, b, p, c, d, q] = raw.map(Number);
  const setAt = (i: number, v: string) => setRaw((all) => all.map((x, j) => (j === i ? v : x)));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  if (valid) {
    const plan = planAnurupye(a, b, p, c, d, q);
    // Which column is in ratio decides the colours: that column and the constants go green.
    const xTone: BoxTone = plan.xInRatio ? "done" : "active";
    const yTone: BoxTone = plan.yInRatio ? "done" : "added";
    const pTone: BoxTone = plan.xInRatio || plan.yInRatio ? "done" : "carry";
    const equation = (k: number, l: number, r: number) => <LinEq a={k} b={l} p={r} gap={gap} />;

    steps.push({
      title: t("Two equations", "दो समीकरण"),
      body: t("Look at the x numbers, the y numbers, and the numbers on the right.", "x वाले नंबर, y वाले नंबर, और दाईं तरफ़ के नंबर देखो।"),
      visual: (
        <div className="flex flex-col gap-2">
          {equation(a, b, p)}
          {equation(c, d, q)}
        </div>
      ),
    });

    // Each pair as a ratio, in lowest terms.
    const ratioRow = (label: string, m: number, n: number, tone: BoxTone) => {
      const [rm, rn] = reduceRatio(m, n);
      const reduced = rm !== m || rn !== n;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="basis-full text-xs font-medium text-slate-500 @md:w-20 @md:shrink-0 @md:basis-auto dark:text-slate-400">{label}</span>
          <Term cells={[num(m)]} tone={tone} gap={gap} size="sm" />
          <Op>:</Op>
          <Term cells={[num(n)]} tone={tone} gap={gap} size="sm" />
          {reduced && (
            <>
              <Op>=</Op>
              <Term cells={[num(rm)]} tone={tone} gap={gap} size="sm" />
              <Op>:</Op>
              <Term cells={[num(rn)]} tone={tone} gap={gap} size="sm" />
            </>
          )}
        </div>
      );
    };
    const [pm, pn] = reduceRatio(p, q);
    steps.push({
      title: t("Compare the ratios", "अनुपात मिलाओ"),
      body: plan.xInRatio
        ? t(`The x numbers are in the same ratio as the right side: ${pm} : ${pn}.`, `x वाले नंबर दाईं तरफ़ के अनुपात में हैं: ${pm} : ${pn}।`)
        : plan.yInRatio
          ? t(`The y numbers are in the same ratio as the right side: ${pm} : ${pn}.`, `y वाले नंबर दाईं तरफ़ के अनुपात में हैं: ${pm} : ${pn}।`)
          : t("Neither column is in the same ratio as the right side.", "कोई भी कॉलम दाईं तरफ़ के अनुपात में नहीं।"),
      visual: (
        <div className="flex flex-col gap-2">
          {ratioRow(t("x numbers", "x वाले"), a, c, xTone)}
          {ratioRow(t("y numbers", "y वाले"), b, d, yTone)}
          {ratioRow(t("right side", "दाईं तरफ़"), p, q, pTone)}
        </div>
      ),
    });

    if (plan.det === 0) {
      note = sameRatio(a, c, p, q) && sameRatio(b, d, p, q)
        ? t("Both equations are the same line: every point on it works, no single answer.", "दोनों समीकरण एक ही रेखा हैं: उस पर हर बिंदु सही, कोई एक जवाब नहीं।")
        : t("The x and y numbers are in the same ratio as each other: the lines never meet, no answer.", "x और y वाले नंबर आपस में एक ही अनुपात में हैं: रेखाएँ कभी नहीं मिलतीं, कोई जवाब नहीं।");
      steps.length = 1;
    } else if (plan.xInRatio || plan.yInRatio) {
      const zero = plan.xInRatio ? "y" : "x";
      const other = plan.xInRatio ? "x" : "y";
      const [k, r] = plan.use === 0 ? [plan.xInRatio ? a : b, p] : [plan.xInRatio ? c : d, q];
      const value = plan.xInRatio ? plan.x! : plan.y!;
      const [eqA, eqB, eqP] = plan.use === 0 ? [a, b, p] : [c, d, q];
      const [chkA, chkB, chkP] = plan.use === 0 ? [c, d, q] : [a, b, p];
      if (!(plan.xInRatio && plan.yInRatio)) {
        steps.push({
          title: t(`One is in ratio, so the other one, ${zero}, is zero`, `एक अनुपात में है, तो दूसरा, ${zero}, शून्य`),
          body: t(`${other} is in ratio, so ${zero} = 0.`, `${other} अनुपात में है, तो ${zero} = 0।`),
          visual: (
            <Row>
              <Term cells={[zero]} gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} tone="done" gap={gap} />
            </Row>
          ),
        });
        steps.push({
          title: t(`Put ${zero} = 0 into equation ${plan.use + 1}`, `समीकरण ${plan.use + 1} में ${zero} = 0 रखो`),
          body: (
            <span className="flex flex-col gap-0.5 tabular-nums">
              <b className={STRONG}>{eqText(eqA, eqB, eqP)}</b>
              <b className={STRONG}>
                {num(k)}
                {other} = {num(r)} → {other} = {num(r)} ÷ {num(k)} = {value.toString()}
              </b>
            </span>
          ),
          visual: (
            <Row>
              <Term cells={[{ v: num(k), tone: "done" }, other]} gap={gap} />
              <Op>=</Op>
              <Term cells={[num(r)]} tone="done" gap={gap} />
            </Row>
          ),
        });
      }
      const xv = plan.x!.toString();
      const yv = plan.y!.toString();
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(
          `x = ${xv}, y = ${yv}. Check in the other equation: ${checkText(chkA, chkB, chkP, xv, yv)} ✓`,
          `x = ${xv}, y = ${yv}। दूसरे समीकरण में जाँच: ${checkText(chkA, chkB, chkP, xv, yv)} ✓`,
        ),
        visual: (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Answer x={plan.x!} gap={gap} name="x" />
            <Answer x={plan.y!} gap={gap} name="y" />
          </div>
        ),
      });
    } else {
      const xv = plan.x!.toString();
      const yv = plan.y!.toString();
      steps.push({
        title: t("No shortcut: the long way", "शॉर्टकट नहीं: लंबा तरीका"),
        body: t(
          `Cross-multiplying gives x = ${xv}, y = ${yv}; neither is 0. Try making one column match the right side's ratio!`,
          `क्रॉस-गुणा से x = ${xv}, y = ${yv}; कोई शून्य नहीं। एक कॉलम को दाईं तरफ़ के अनुपात में करके देखो!`,
        ),
        visual: (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Answer x={plan.x!} gap={gap} name="x" />
            <Answer x={plan.y!} gap={gap} name="y" />
          </div>
        ),
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

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("anurupye", lang)}
        subtitle={t("Solve two equations at a glance, when one column is in the same ratio as the right side.", "दो समीकरण एक नज़र में हल करो, जब कोई कॉलम दाईं तरफ़ के अनुपात में हो।")}
      />

      <Card title={t("The rule", "नियम")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("If one is in ratio, the other one is zero.", "अगर एक अनुपात में है, तो दूसरा शून्य है।")}</b>
        </p>
        <ol className={`mt-3 flex list-decimal flex-col gap-2 pl-5 ${BODY}`}>
          <li>
            {t("x numbers in the same ratio as the right side → y = 0.", "x वाले नंबर दाईं तरफ़ के अनुपात में → y = 0।")}
            <div className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">12x + 78y = 12, 16x + 96y = 16: 12 : 16 = 12 : 16 → y = 0, x = 1</div>
          </li>
          <li>
            {t("y numbers in the same ratio as the right side → x = 0.", "y वाले नंबर दाईं तरफ़ के अनुपात में → x = 0।")}
            <div className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">3x + 7y = 2, 4x + 21y = 6: 7 : 21 = 2 : 6 → x = 0, y = 2/7</div>
          </li>
        </ol>
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Anurupye means \"in proportion\" (in the same ratio), Shunyam \"zero\", Anyat \"the other\". When one unknown's numbers are in proportion with the right side, that unknown alone makes the answer, and the other unknown is zero.",
            "आनुरूप्ये यानी \"अनुपात में\", शून्यम् यानी \"शून्य\", अन्यत् यानी \"दूसरा\"। जब एक अज्ञात के नंबर दाईं तरफ़ के अनुपात में हों, तो वही अकेला जवाब बनाता है, और दूसरा अज्ञात शून्य होता है।",
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

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Before solving, compare each column's ratio with the right side's ratio.", "हल करने से पहले, हर कॉलम का अनुपात दाईं तरफ़ के अनुपात से मिलाओ।")}</li>
          <li>{t("The column that matches stays; the other unknown is 0.", "जो कॉलम मिलता है वो रहता है; दूसरा अज्ञात 0 है।")}</li>
          <li>{t("Then one division gives the answer: x = p ÷ a (or y = p ÷ b).", "फिर एक भाग से जवाब: x = p ÷ a (या y = p ÷ b)।")}</li>
        </ul>
      </Card>
    </div>
  );
};
