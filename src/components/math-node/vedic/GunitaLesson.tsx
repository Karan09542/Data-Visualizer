import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { planGunita, type CheckAt, type Factor } from "./gunita";
import { polyText } from "./purana";
import { Q } from "./shunyam";
import { NumIn, Op, Row, Term, num } from "./equation";
import { methodName } from "./methods";
import { AnimatedExamples, chipClass, type Beat, type GlanceCase } from "./beats";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";

const q = (n: number) => new Q(n);
const poly = (c: number[]) => polyText(c.map(q));
/** "(x + 3)", "(2x − 5)" */
const factorText = (f: Factor) => `(${poly([f.p, f.q])})`;
/** The coefficients added, as written: "1 + 7 + 12", "1 − 7 + 12". */
const sumText = (values: number[]) => values.map((v, i) => (i === 0 ? num(v) : `${v < 0 ? "−" : "+"} ${Math.abs(v)}`)).join(" ");
/** Each coefficient with the sign it has at x = −1. */
const altValues = (coeffs: number[]) => coeffs.map((c, i) => c * (-1) ** (coeffs.length - 1 - i));
/** A factor at x = 1 or −1, written out: "(1 + 3)", "(−1 + 3)", "(2 − 5)". */
const factorAt = (f: Factor, x: 1 | -1) => `(${sumText([f.p * x, f.q])})`;
const times = (vals: number[]) => vals.map((v) => (v < 0 ? `(${num(v)})` : String(v))).join(" × ");

interface Example {
  factors: [number, number][];
  claim: number[];
}
const EXAMPLES: Example[] = [
  { factors: [[1, 3], [1, 4]], claim: [1, 7, 12] },
  { factors: [[1, 1], [1, 2], [1, 3]], claim: [1, 6, 11, 6] },
  { factors: [[2, 3], [1, -5]], claim: [2, -7, -15] },
  { factors: [[1, 3], [1, 4]], claim: [1, 7, 13] },
  { factors: [[1, 2], [1, 5]], claim: [1, 6, 11] },
  { factors: [[1, 1], [1, -2], [1, 3]], claim: [1, 2, -5, -6] },
];
const exampleText = (e: Example) => `${e.factors.map(([p, qq]) => factorText({ p, q: qq })).join("")} = ${poly(e.claim)}`;

// ─── The animated examples ────────────────────────────────────────────────────

function gunitaCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const run = (e: Example) => (): Beat[] => {
    const factors = e.factors.map(([p, qq]) => ({ p, q: qq }));
    const plan = planGunita(factors, e.claim)!;
    const check = (c: CheckAt, prefix: string): Beat[] => {
      const claimVals = c.x === 1 ? e.claim : altValues(e.claim);
      return [
        {
          strong: `${factors.map((f) => factorAt(f, c.x)).join("")} = ${times(c.factors)} = ${c.product}`,
          rest: c.x === 1 ? t("x = 1: each factor's coefficients added, then multiplied", "x = 1: हर गुणनखंड के गुणांक जोड़ो, फिर गुणा") : t("x = −1: signs alternate", "x = −1: चिह्न बदलते जाते हैं"),
          visual: (
            <Row>
              <Term cells={[times(c.factors)]} tone="active" gap={gap} />
              <Op>=</Op>
              <span data-anim={`${prefix}-p`}>
                <Term cells={[num(c.product)]} tone="active" gap={gap} />
              </span>
              <span data-anim={`${prefix}-eq`} className="px-1 text-xl text-slate-400 dark:text-slate-500">
                {c.ok ? "=" : "≠"}
              </span>
              <span data-anim={`${prefix}-c`}>
                <Term cells={[num(c.claim)]} tone="added" gap={gap} />
              </span>
              <span data-anim={`${prefix}-ok`} className={`text-2xl font-semibold ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {c.ok ? "✓" : "✗"}
              </span>
            </Row>
          ),
          extra: [
            { id: `${prefix}-p`, kind: "pop", at: 500 },
            { id: `${prefix}-eq`, kind: "fade", at: 2000 },
            { id: `${prefix}-c`, kind: "pop", at: 1600 },
            { id: `${prefix}-ok`, kind: "pop", at: 2300 },
          ],
          dur: 1500,
        },
        { strong: `${sumText(claimVals)} = ${c.claim}`, rest: t("the product's coefficients", "गुणनफल के गुणांक"), dur: 1500 },
      ];
    };
    return [
      { strong: `${factors.map(factorText).join("")} = ${poly(e.claim)}?`, rest: t("is this product right?", "क्या ये गुणनफल सही है?"), visual: <Term cells={[`${factors.map(factorText).join("")} = ${poly(e.claim)}`]} gap={gap} />, dur: 1000 },
      ...check(plan.one, "g1"),
      ...check(plan.minusOne, "g2"),
      {
        strong: plan.correct ? t("Right ✓", "सही ✓") : `${factors.map(factorText).join("")} = ${poly(plan.truth)}`,
        rest: plan.correct
          ? t("both checks pass", "दोनों जाँच सही")
          : plan.one.ok
            ? t("x = 1 missed the mistake; x = −1 caught it", "x = 1 से ग़लती छूटी; x = −1 ने पकड़ी")
            : t("caught: this is the real product", "पकड़ी गई: असली गुणनफल ये है"),
        visual: plan.correct ? undefined : (
          <span data-anim="gg-t">
            <NumberBoxes groups={[{ cells: [poly(plan.truth)], tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        ),
        extra: plan.correct ? undefined : [{ id: "gg-t", kind: "pop", at: 400 }],
      },
    ];
  };
  return [
    { en: "Right", hi: "सही", sub: "(x + 3)(x + 4)", beats: run(EXAMPLES[0]) },
    { en: "Caught at x = 1", hi: "x = 1 पर पकड़ी", sub: "x² + 7x + 13", beats: run(EXAMPLES[3]) },
    { en: "Caught at x = −1", hi: "x = −1 पर पकड़ी", sub: "x² + 6x + 11", beats: run(EXAMPLES[4]) },
  ];
}

/** Gunita Samuccaya: the product of the sums equals the sum of the product. */
export const GunitaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [count, setCount] = useState(2);
  const [fRaw, setFRaw] = useState<string[]>(["1", "3", "1", "4", "1", "5"]);
  const [claims, setClaims] = useState<Record<number, string[]>>({ 2: ["1", "7", "12"], 3: ["1", "6", "11", "6"] });
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const claimRaw = claims[count];
  const raw = [...fRaw.slice(0, 2 * count), ...claimRaw];
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const factors: Factor[] = Array.from({ length: count }, (_, i) => ({ p: Number(fRaw[2 * i]), q: Number(fRaw[2 * i + 1]) }));
  const claim = claimRaw.map(Number);

  const load = (e: Example) => {
    setCount(e.factors.length);
    setFRaw((all) => all.map((v, i) => (i < 2 * e.factors.length ? String(e.factors[Math.floor(i / 2)][i % 2]) : v)));
    setClaims((all) => ({ ...all, [e.factors.length]: e.claim.map(String) }));
  };

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");
  const plan = valid ? planGunita(factors, claim) : null;
  if (valid && !plan) note = t("The x number in a factor can't be 0.", "गुणनखंड में x वाला नंबर 0 नहीं हो सकता।");

  if (plan) {
    const checkSteps = (c: CheckAt) => {
      const claimVals = c.x === 1 ? claim : altValues(claim);
      const one = c.x === 1;
      steps.push({
        title: one ? t("Sum of the coefficients in each factor", "हर गुणनखंड के गुणांकों का जोड़") : t("Again at x = −1: signs alternate", "फिर x = −1 पर: चिह्न बदलते जाते हैं"),
        body: t(
          `${factors.map((f) => factorAt(f, c.x)).join(" × ")} = ${times(c.factors)} = ${c.product}.`,
          `${factors.map((f) => factorAt(f, c.x)).join(" × ")} = ${times(c.factors)} = ${c.product}।`,
        ),
        visual: (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {factors.map((f, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="pb-2 text-xl text-slate-400 dark:text-slate-500">×</span>}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{factorText(f)}</span>
                  <Term cells={[num(c.factors[i])]} tone="active" gap={gap} />
                </div>
              </React.Fragment>
            ))}
            <span className="pb-2 text-xl text-slate-400 dark:text-slate-500">=</span>
            <Term cells={[num(c.product)]} tone="active" gap={gap} />
          </div>
        ),
      });
      steps.push({
        title: one ? t("Sum of the coefficients in the product", "गुणनफल के गुणांकों का जोड़") : t("The product at x = −1", "x = −1 पर गुणनफल"),
        body: (
          <b className={STRONG}>
            {sumText(claimVals)} = {c.claim}
          </b>
        ),
        visual: (
          <Row>
            <Term cells={[num(c.product)]} tone="active" gap={gap} />
            <span className="px-1 text-xl text-slate-400 dark:text-slate-500">{c.ok ? "=" : "≠"}</span>
            <Term cells={[num(c.claim)]} tone="added" gap={gap} />
            <span className={`text-2xl font-semibold ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{c.ok ? "✓" : "✗"}</span>
          </Row>
        ),
      });
    };
    steps.push({
      title: t("The product to check", "जाँचना है ये गुणनफल"),
      body: t("Is this multiplication right?", "क्या ये गुणा सही है?"),
      visual: <Term cells={[`${factors.map(factorText).join("")} = ${poly(claim)}`]} gap={gap} />,
    });
    checkSteps(plan.one);
    checkSteps(plan.minusOne);
    const truth = poly(plan.truth);
    steps.push({
      title: t("Verdict", "नतीजा"),
      body: plan.correct
        ? t("Both checks pass, and the product is right ✓", "दोनों जाँच सही, और गुणनफल सही है ✓")
        : plan.one.ok && plan.minusOne.ok
          ? t(`Both checks pass, yet it's wrong: a check can miss some mistakes. The product is ${truth}.`, `दोनों जाँच सही, फिर भी ग़लत: जाँच कुछ ग़लतियाँ छोड़ सकती है। गुणनफल ${truth} है।`)
          : plan.one.ok
            ? t(`x = 1 missed it, but x = −1 caught the mistake. The product is ${truth}.`, `x = 1 से छूटी, पर x = −1 ने ग़लती पकड़ी। गुणनफल ${truth} है।`)
            : t(`The check caught a mistake. The product is ${truth}.`, `जाँच ने ग़लती पकड़ी। गुणनफल ${truth} है।`),
      visual: <NumberBoxes groups={[{ cells: [truth], tone: plan.correct ? "answer" : "done" }]} gap={gap} separator={null} size="lg" />,
    });
  }

  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;
  const power = (k: number) => (k === 0 ? "" : k === 1 ? "x" : `x${"⁰¹²³"[k]}`);

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("gunita", lang)}
        subtitle={t("Check a multiplication in seconds: the sums of the coefficients multiply like the expressions do.", "गुणा सेकंडों में जाँचो: गुणांकों के जोड़ वैसे ही गुणा होते हैं जैसे व्यंजक।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>
            {t("The product of the sums of the coefficients in the factors = the sum of the coefficients in the product.", "गुणनखंडों के गुणांकों के जोड़ों का गुणनफल = गुणनफल के गुणांकों का जोड़।")}
          </b>
        </p>
        {animate ? (
          <AnimatedExamples id="gunita" cases={gunitaCases(t, gap)} lang={lang} gap={gap} />
        ) : (
          <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
            <span>(x + 3)(x + 4) = x² + 7x + 12</span>
            <span>(1 + 3)(1 + 4) = 20, 1 + 7 + 12 = 20 ✓</span>
            <span>
              {t("Also at x = −1", "x = −1 पर भी")}: (−1 + 3)(−1 + 4) = 6, 1 − 7 + 12 = 6 ✓
            </span>
          </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Gunita means \"the product\", Samuccaya \"the sum (of the coefficients)\": the sum in the product equals the product of the sums. Adding the coefficients is the same as putting x = 1, and both sides of a true equation stay equal for every x.",
            "गुणित यानी \"गुणनफल\", समुच्चय यानी \"(गुणांकों का) जोड़\": गुणनफल का जोड़ = जोड़ों का गुणनफल। गुणांक जोड़ना x = 1 रखने जैसा है, और सही समीकरण के दोनों तरफ़ हर x के लिए बराबर रहते हैं।",
          )}
        </p>
      </Card>

      {/* Your product */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={t("Factors", "गुणनखंड")} className="flex flex-wrap gap-1.5">
            {[2, 3].map((c) => (
              <button key={c} type="button" role="radio" aria-checked={count === c} onClick={() => setCount(c)} className={chipClass(count === c)}>
                {t(`${c} factors`, `${c} गुणनखंड`)}
              </button>
            ))}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          {Array.from({ length: count }, (_, i) => (
            <React.Fragment key={i}>
              {label("(")}
              <NumIn label={`p${i + 1}`} value={fRaw[2 * i]} onChange={(v) => setFRaw((all) => all.map((x, j) => (j === 2 * i ? v : x)))} hideLabel />
              {label("x +")}
              <NumIn label={`q${i + 1}`} value={fRaw[2 * i + 1]} onChange={(v) => setFRaw((all) => all.map((x, j) => (j === 2 * i + 1 ? v : x)))} hideLabel />
              {label(")")}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
          {label("=")}
          {claimRaw.map((v, i) => {
            const k = count - i;
            return (
              <React.Fragment key={i}>
                <NumIn label={`c${k}`} value={v} onChange={(nv) => setClaims((all) => ({ ...all, [count]: all[count].map((x, j) => (j === i ? nv : x)) }))} hideLabel />
                {label(`${power(k)}${i < claimRaw.length - 1 ? " +" : ""}`)}
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map((e) => ({ label: exampleText(e), onClick: () => load(e) }))} />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Add each factor's coefficients, multiply them; add the product's coefficients. They must match.", "हर गुणनखंड के गुणांक जोड़ो, गुणा करो; गुणनफल के गुणांक जोड़ो। दोनों बराबर हों।")}</li>
          <li>{t("Also try x = −1 (alternate the signs): it catches mistakes x = 1 misses.", "x = −1 भी आज़माओ (चिह्न बदलते हुए): ये वो ग़लतियाँ पकड़ता है जो x = 1 से छूटती हैं।")}</li>
          <li>{t("A match doesn't prove it right; a mismatch proves it wrong.", "मेल होना सही होने का सबूत नहीं; मेल न होना ग़लत होने का सबूत है।")}</li>
        </ul>
      </Card>
    </div>
  );
};
