import React, { useState } from "react";
import { NumberBoxes, type BoxTone } from "./NumberBoxes";
import { Answer, Frac, NumIn, Op, Row, Term } from "./equation";
import { Q, lin, planCommonFactor, planEqualNumerators, planProducts, planSumDen, planSumNumDen } from "./shunyam";
import { methodName } from "./methods";
import { BODY, CARD, Card, Examples, GapSwitch, LessonHeader, STRONG, StepList, tr, useBoxGap, type Lang, type StepView } from "./ui";

type CaseId = "factor" | "product" | "numerator" | "sums" | "denominators";

const MINUS = "−";
const sg = (n: number) => (n < 0 ? `${MINUS}${-n}` : `+${n}`);
/** A number in a product: 6, (−9). */
const pn = (n: number) => (n < 0 ? `(${MINUS}${-n})` : String(n));
/** "x + 6", "x − 9" */
const xPlus = (a: number) => (a === 0 ? "x" : `x ${a < 0 ? MINUS : "+"} ${Math.abs(a)}`);
/** The common factor written as it appears: x, or (x + 1). */
const factorText = (p: number) => (p === 0 ? "x" : `(${xPlus(p)})`);

// ─── The five cases ───────────────────────────────────────────────────────────

interface CaseDef {
  id: CaseId;
  en: string;
  hi: string;
  form: string;
  keys: string[];
  labels: string[];
  examples: number[][];
}

const CASES: CaseDef[] = [
  { id: "factor", en: "Common factor", hi: "साझा गुणनखंड", form: "a₁·F + a₂·F = b₁·F + b₂·F,  F = x + p", keys: ["a1", "a2", "b1", "b2", "p"], labels: ["a₁", "a₂", "b₁", "b₂", "p"], examples: [[3, 5, 6, 4, 0], [4, 0, 5, 0, 1], [7, 0, 2, 0, -3]] },
  { id: "product", en: "Products equal", hi: "गुणनफल बराबर", form: "(x + a)(x + b) = (x + c)(x + d)", keys: ["a", "b", "c", "d"], labels: ["a", "b", "c", "d"], examples: [[6, 3, -9, -2], [7, 9, 3, 21], [4, 6, 3, 8]] },
  { id: "numerator", en: "Same numerators", hi: "अंश बराबर", form: "m/(ax + b) + m/(cx + d) = 0", keys: ["m", "a", "b", "c", "d"], labels: ["m", "a", "b", "c", "d"], examples: [[6, 3, -2, 2, 5], [1, 1, 4, 3, -1], [5, 2, 1, 4, 3]] },
  { id: "sums", en: "Sums equal", hi: "जोड़ बराबर", form: "(n₁x + n₂)/(d₁x + d₂) = (n₃x + n₄)/(d₃x + d₄)", keys: ["n1", "n2", "d1", "d2", "n3", "n4", "d3", "d4"], labels: ["n₁", "n₂", "d₁", "d₂", "n₃", "n₄", "d₃", "d₄"], examples: [[6, 3, 9, 4, 8, 3, 5, 2], [2, 5, 3, 1, 4, 1, 3, 5]] },
  { id: "denominators", en: "Denominators add up", hi: "हरों का जोड़", form: "1/(x + a) + 1/(x + b) = 1/(x + c) + 1/(x + d)", keys: ["a", "b", "c", "d"], labels: ["a", "b", "c", "d"], examples: [[8, 4, 5, 7], [3, 9, 5, 7], [1, 10, 4, 7]] },
];

const toStrings = (vals: number[]) => vals.map(String);

/** Shunyam Samyasamuccaye: five ways to see that something is zero. */
export const ShunyamLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [caseId, setCaseId] = useState<CaseId>("factor");
  const [inputs, setInputs] = useState<Record<CaseId, string[]>>(
    () => Object.fromEntries(CASES.map((c) => [c.id, toStrings(c.examples[0])])) as Record<CaseId, string[]>,
  );
  const [spaced, setSpaced, gap] = useBoxGap();
  const def = CASES.find((c) => c.id === caseId)!;
  const raw = inputs[caseId];
  const nums = raw.map((s) => Number(s));
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const setAt = (i: number, v: string) => setInputs((all) => ({ ...all, [caseId]: all[caseId].map((x, j) => (j === i ? v : x)) }));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  if (valid && caseId === "factor") {
    const [a1, a2, b1, b2, p] = nums;
    const plan = planCommonFactor(a1, a2, b1, b2, p);
    const F = factorText(p);
    const term = (a: number) => <Term cells={[{ v: String(a), tone: "added" }, { v: F, tone: "active" }]} gap={gap} />;
    const side = (x: number, y: number) => (
      <>
        {term(x)}
        {y !== 0 && (
          <>
            <Op>+</Op>
            {term(y)}
          </>
        )}
      </>
    );
    steps.push({
      title: t("Spot the common factor", "साझा गुणनखंड पहचानो"),
      body: t(`Every term has ${F} in it.`, `हर टर्म में ${F} है।`),
      visual: (
        <Row>
          {side(a1, a2)}
          <Op>=</Op>
          {side(b1, b2)}
        </Row>
      ),
    });
    if (a2 !== 0 || b2 !== 0)
      steps.push({
        title: t("Add up each side", "हर तरफ़ जोड़ो"),
        body: t(`${a1} + ${a2} = ${plan.left} and ${b1} + ${b2} = ${plan.right}.`, `${a1} + ${a2} = ${plan.left} और ${b1} + ${b2} = ${plan.right}।`),
        visual: (
          <Row>
            {term(plan.left)}
            <Op>=</Op>
            {term(plan.right)}
          </Row>
        ),
      });
    if (plan.identity) note = t(`Both sides are ${plan.left}${F}: true for every x.`, `दोनों तरफ़ ${plan.left}${F}: हर x के लिए सही।`);
    else {
      steps.push({
        title: t("Different numbers in front: the factor is zero", "आगे के नंबर अलग: गुणनखंड शून्य"),
        body: t(
          `${plan.left}·${F} = ${plan.right}·${F} can only be true if ${F} = 0 (${plan.left} ≠ ${plan.right}).`,
          `${plan.left}·${F} = ${plan.right}·${F} तभी सही जब ${F} = 0 (${plan.left} ≠ ${plan.right})।`,
        ),
        visual: (
          <Row>
            <Term cells={[{ v: F, tone: "active" }]} gap={gap} />
            <Op>=</Op>
            <Term cells={["0"]} tone="done" gap={gap} />
          </Row>
        ),
      });
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(`x = ${plan.x}. Check: both sides are 0 ✓`, `x = ${plan.x}। जाँच: दोनों तरफ़ 0 ✓`),
        visual: <Answer x={plan.x!} gap={gap} />,
      });
    }
  }

  if (valid && caseId === "product") {
    const [a, b, c, d] = nums;
    const plan = planProducts(a, b, c, d);
    const factor = (k: number, tone: BoxTone) => <Term cells={["x", { v: sg(k), tone }]} gap={gap} />;
    steps.push({
      title: t("Look at the number parts", "नंबर वाले हिस्से देखो"),
      body: t(`(${xPlus(a)})(${xPlus(b)}) = (${xPlus(c)})(${xPlus(d)})`, `(${xPlus(a)})(${xPlus(b)}) = (${xPlus(c)})(${xPlus(d)})`),
      visual: (
        <Row>
          {factor(a, "active")}
          {factor(b, "active")}
          <Op>=</Op>
          {factor(c, "carry")}
          {factor(d, "carry")}
        </Row>
      ),
    });
    steps.push({
      title: t("Multiply them on each side", "हर तरफ़ गुणा करो"),
      body: (
        <b className={STRONG}>
          {pn(a)} × {pn(b)} = {plan.ab},  {pn(c)} × {pn(d)} = {plan.cd}
        </b>
      ),
      visual: (
        <Row>
          <Term cells={[String(plan.ab)]} tone="active" gap={gap} />
          <Op>{plan.same ? "=" : "≠"}</Op>
          <Term cells={[String(plan.cd)]} tone="carry" gap={gap} />
        </Row>
      ),
    });
    if (plan.identity) note = t("The two sides are the same: true for every x.", "दोनों तरफ़ एक जैसे: हर x के लिए सही।");
    else if (plan.same)
      steps.push({
        title: t("Same products: x is zero", "गुणनफल बराबर: x शून्य"),
        body: t(`Both are ${plan.ab}. The x² and the ${plan.ab} cancel, leaving only x terms: x = 0. Check: both sides are ${plan.ab} ✓`, `दोनों ${plan.ab}। x² और ${plan.ab} कट जाते हैं, बस x वाले टर्म बचते हैं: x = 0। जाँच: दोनों तरफ़ ${plan.ab} ✓`),
        visual: <Answer x={new Q(0)} gap={gap} />,
      });
    else if (plan.x)
      steps.push({
        title: t("Not the same: no shortcut here", "बराबर नहीं: यहाँ शॉर्टकट नहीं"),
        body: t(`${plan.ab} ≠ ${plan.cd}, so x isn't 0. The long way gives x = ${plan.x}. Try making the products equal!`, `${plan.ab} ≠ ${plan.cd}, तो x शून्य नहीं। लंबे तरीके से x = ${plan.x}। गुणनफल बराबर करके देखो!`),
        visual: <Answer x={plan.x} gap={gap} />,
      });
    else note = t("These two sides never meet: no answer.", "ये दोनों तरफ़ कभी बराबर नहीं: कोई जवाब नहीं।");
  }

  if (valid && caseId === "numerator") {
    const [m, a, b, c, d] = nums;
    const plan = planEqualNumerators(m, a, b, c, d);
    const D1 = lin(a, b);
    const D2 = lin(c, d);
    steps.push({
      title: t("The numerators are the same", "अंश एक जैसे हैं"),
      body: t(`Both fractions have ${m} on top.`, `दोनों भिन्नों के ऊपर ${m} है।`),
      visual: (
        <Row>
          <Frac num={<Term cells={[String(m)]} tone="active" gap={gap} size="sm" />} den={<Term cells={[D1]} tone="added" gap={gap} size="sm" />} />
          <Op>+</Op>
          <Frac num={<Term cells={[String(m)]} tone="active" gap={gap} size="sm" />} den={<Term cells={[D2]} tone="added" gap={gap} size="sm" />} />
          <Op>=</Op>
          <Term cells={["0"]} gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("So the denominators add up to zero", "तो हरों का जोड़ शून्य"),
      body: (
        <b className={STRONG}>
          ({D1}) + ({D2}) = {lin(plan.sumA, plan.sumB)} = 0
        </b>
      ),
      visual: (
        <Row>
          <Term cells={[D1]} tone="added" gap={gap} />
          <Op>+</Op>
          <Term cells={[D2]} tone="added" gap={gap} />
          <Op>=</Op>
          <Term cells={[lin(plan.sumA, plan.sumB)]} tone="done" gap={gap} />
          <Op>=</Op>
          <Term cells={["0"]} gap={gap} />
        </Row>
      ),
    });
    if (!plan.x) note = t("The x's cancel when the denominators are added: no answer this way.", "हर जोड़ने पर x कट जाते हैं: इस तरीके से जवाब नहीं।");
    else if (plan.d1 && plan.d1.zero) note = t(`That makes both denominators 0, which isn't allowed: no answer.`, `इससे दोनों हर 0 हो जाते हैं, जो नहीं चलता: कोई जवाब नहीं।`);
    else
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(
          `x = ${plan.x}. Check: the denominators become ${plan.d1} and ${new Q(0).add(plan.d1!).mul(-1)}, opposites, so the fractions cancel ✓`,
          `x = ${plan.x}। जाँच: हर बनते हैं ${plan.d1} और ${new Q(0).add(plan.d1!).mul(-1)}, उल्टे, तो भिन्न कट जाते हैं ✓`,
        ),
        visual: <Answer x={plan.x} gap={gap} />,
      });
  }

  if (valid && caseId === "sums") {
    const [n1, n2, d1, d2, n3, n4, d3, d4] = nums;
    const plan = planSumNumDen([n1, n2], [d1, d2], [n3, n4], [d3, d4]);
    const N1 = lin(n1, n2);
    const N2 = lin(n3, n4);
    const D1 = lin(d1, d2);
    const D2 = lin(d3, d4);
    steps.push({
      title: t("The equation", "समीकरण"),
      body: t("Two fractions equal to each other.", "दो भिन्न जो आपस में बराबर हैं।"),
      visual: (
        <Row>
          <Frac num={<Term cells={[N1]} tone="active" gap={gap} size="sm" />} den={<Term cells={[D1]} tone="added" gap={gap} size="sm" />} />
          <Op>=</Op>
          <Frac num={<Term cells={[N2]} tone="active" gap={gap} size="sm" />} den={<Term cells={[D2]} tone="added" gap={gap} size="sm" />} />
        </Row>
      ),
    });
    steps.push({
      title: t("Add the numerators, add the denominators", "अंश जोड़ो, हर जोड़ो"),
      body: (
        <span className="flex flex-col gap-0.5 tabular-nums">
          <b className={STRONG}>
            ({N1}) + ({N2}) = {lin(plan.nSum[0], plan.nSum[1])}
          </b>
          <b className={STRONG}>
            ({D1}) + ({D2}) = {lin(plan.dSum[0], plan.dSum[1])}
          </b>
        </span>
      ),
      visual: (
        <Row>
          <Term cells={[lin(plan.nSum[0], plan.nSum[1])]} tone="active" gap={gap} />
          <Op>{plan.same ? "=" : "≠"}</Op>
          <Term cells={[lin(plan.dSum[0], plan.dSum[1])]} tone="added" gap={gap} />
        </Row>
      ),
    });
    if (!plan.same) note = t("The two sums are different, so this shortcut doesn't fit. Make them match!", "दोनों जोड़ अलग हैं, तो ये शॉर्टकट नहीं लगेगा। उन्हें बराबर करके देखो!");
    else if (!plan.x) note = t("The sum has no x in it: no answer from this shortcut.", "जोड़ में x नहीं: इस शॉर्टकट से जवाब नहीं।");
    else
      steps.push(
        {
          title: t("The same sum: it is zero", "जोड़ एक जैसा: वो शून्य"),
          body: (
            <b className={STRONG}>
              {lin(plan.nSum[0], plan.nSum[1])} = 0
            </b>
          ),
          visual: (
            <Row>
              <Term cells={[lin(plan.nSum[0], plan.nSum[1])]} tone="done" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
          ),
        },
        {
          title: t("Answer", "जवाब"),
          body: plan.value
            ? t(`x = ${plan.x}. Check: both sides become ${plan.value} ✓`, `x = ${plan.x}। जाँच: दोनों तरफ़ ${plan.value} ✓`)
            : t(`x = ${plan.x}, but it makes a denominator 0, so it doesn't count here.`, `x = ${plan.x}, पर इससे कोई हर 0 हो जाता है, तो यहाँ नहीं चलेगा।`),
          visual: <Answer x={plan.x} gap={gap} />,
        },
      );
  }

  if (valid && caseId === "denominators") {
    const [a, b, c, d] = nums;
    const plan = planSumDen(a, b, c, d);
    const unit = (k: number, tone: BoxTone) => <Frac num={<Term cells={["1"]} gap={gap} size="sm" />} den={<Term cells={[xPlus(k)]} tone={tone} gap={gap} size="sm" />} />;
    steps.push({
      title: t("The equation", "समीकरण"),
      body: t("Every numerator is 1.", "हर अंश 1 है।"),
      visual: (
        <Row>
          {unit(a, "active")}
          <Op>+</Op>
          {unit(b, "active")}
          <Op>=</Op>
          {unit(c, "added")}
          <Op>+</Op>
          {unit(d, "added")}
        </Row>
      ),
    });
    steps.push({
      title: t("Add the denominators on each side", "हर तरफ़ के हर जोड़ो"),
      body: (
        <span className="flex flex-col gap-0.5 tabular-nums">
          <b className={STRONG}>
            ({xPlus(a)}) + ({xPlus(b)}) = {lin(2, plan.left)}
          </b>
          <b className={STRONG}>
            ({xPlus(c)}) + ({xPlus(d)}) = {lin(2, plan.right)}
          </b>
        </span>
      ),
      visual: (
        <Row>
          <Term cells={[lin(2, plan.left)]} tone="active" gap={gap} />
          <Op>{plan.same ? "=" : "≠"}</Op>
          <Term cells={[lin(2, plan.right)]} tone="added" gap={gap} />
        </Row>
      ),
    });
    if (!plan.same) note = t("The two sums are different, so this shortcut doesn't fit. Make a + b = c + d!", "दोनों जोड़ अलग हैं, तो ये शॉर्टकट नहीं लगेगा। a + b = c + d करके देखो!");
    else
      steps.push(
        {
          title: t("The same sum: it is zero", "जोड़ एक जैसा: वो शून्य"),
          body: (
            <b className={STRONG}>
              {lin(2, plan.left)} = 0
            </b>
          ),
          visual: (
            <Row>
              <Term cells={[lin(2, plan.left)]} tone="done" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
          ),
        },
        {
          title: t("Answer", "जवाब"),
          body: plan.ok
            ? t(`x = ${plan.x}. Check: both sides become 0 ✓`, `x = ${plan.x}। जाँच: दोनों तरफ़ 0 ✓`)
            : t(`x = ${plan.x}, but it makes a denominator 0, so it doesn't count here.`, `x = ${plan.x}, पर इससे कोई हर 0 हो जाता है, तो यहाँ नहीं चलेगा।`),
          visual: <Answer x={plan.x!} gap={gap} />,
        },
      );
  }

  // The rule card: each case with its example, in one line.
  const RULES: { en: string; hi: string; example: string; exampleHi?: string }[] = [
    { en: "A common factor with different numbers in front: the factor is zero.", hi: "साझा गुणनखंड, आगे के नंबर अलग: वो गुणनखंड शून्य।", example: "3x + 5x = 6x + 4x → x = 0;  4(x + 1) = 5(x + 1) → x + 1 = 0 → x = −1" },
    { en: "The products of the number parts are the same: x is zero.", hi: "नंबर वाले हिस्सों का गुणनफल एक जैसा: x शून्य।", example: "(x + 6)(x + 3) = (x − 9)(x − 2): 6×3 = 18 = (−9)×(−2) → x = 0" },
    { en: "The numerators are the same: the sum of the denominators is zero.", hi: "अंश एक जैसे: हरों का जोड़ शून्य।", example: "6/(3x − 2) + 6/(2x + 5) = 0 → 5x + 3 = 0 → x = −3/5" },
    { en: "Sum of numerators = sum of denominators: that sum is zero.", hi: "अंशों का जोड़ = हरों का जोड़: वो जोड़ शून्य।", example: "(6x + 3)/(9x + 4) = (8x + 3)/(5x + 2): both sums 14x + 6 → x = −3/7", exampleHi: "(6x + 3)/(9x + 4) = (8x + 3)/(5x + 2): दोनों जोड़ 14x + 6 → x = −3/7" },
    { en: "The denominators add up to the same on both sides: that sum is zero.", hi: "दोनों तरफ़ हरों का जोड़ एक जैसा: वो जोड़ शून्य।", example: "1/(x + 8) + 1/(x + 4) = 1/(x + 5) + 1/(x + 7): both 2x + 12 → x = −6", exampleHi: "1/(x + 8) + 1/(x + 4) = 1/(x + 5) + 1/(x + 7): दोनों 2x + 12 → x = −6" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader title={methodName("shunyam", lang)} subtitle={t("Five ways to see at a glance that something is zero, and solve an equation in one line.", "पाँच तरीके, एक नज़र में ये पहचानने के कि कुछ शून्य है, और समीकरण एक लाइन में हल करने के।")} />

      <Card title={t("The rule", "नियम")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("When the samuccaya (the common total) is the same on both sides, it is zero.", "जब समुच्चय (साझा जोड़) दोनों तरफ़ एक जैसा हो, तो वो शून्य है।")}</b>
        </p>
        <ol className={`mt-3 flex list-decimal flex-col gap-2 pl-5 ${BODY}`}>
          {RULES.map((r) => (
            <li key={r.example}>
              {lang === "hi" ? r.hi : r.en}
              <div className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">{lang === "hi" ? (r.exampleHi ?? r.example) : r.example}</div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Shunyam means \"zero\", Samya \"the same\", Samuccaye \"in the samuccaya\" (the common total). When that total is the same on both sides, the only way the equation holds is for it to be zero.",
            "शून्यम् यानी \"शून्य\", साम्य यानी \"एक जैसा\", समुच्चये यानी \"समुच्चय में\" (साझा जोड़)। जब ये जोड़ दोनों तरफ़ एक जैसा हो, तो समीकरण तभी सही है जब वो शून्य हो।",
          )}
        </p>
      </Card>

      {/* Your equation */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={t("Case", "केस")} className="flex flex-wrap gap-1.5">
            {CASES.map((c, i) => {
              const on = c.id === caseId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCaseId(c.id)}
                  className={`h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                >
                  <span className={`mr-1.5 tabular-nums ${on ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>{i + 1}</span>
                  {lang === "hi" ? c.hi : c.en}
                </button>
              );
            })}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <p className="mt-3 text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-300">{def.form}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {def.labels.map((label, i) => (
            <NumIn key={def.keys[i]} label={label} value={raw[i]} onChange={(v) => setAt(i, v)} />
          ))}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={def.examples.map((e) => ({
              label: e.join(", "),
              onClick: () => setInputs((all) => ({ ...all, [caseId]: toStrings(e) })),
            }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Look before you expand: find the part that's the same on both sides.", "फैलाने से पहले देखो: वो हिस्सा ढूँढो जो दोनों तरफ़ एक जैसा है।")}</li>
          <li>{t("That same part is set to zero, and you solve one short line.", "उसी हिस्से को शून्य रखो, और बस एक छोटी लाइन हल करो।")}</li>
          <li>{t("Always check the answer doesn't make a denominator zero.", "हमेशा देखो कि जवाब से कोई हर शून्य न हो जाए।")}</li>
        </ul>
      </Card>
    </div>
  );
};
