import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { planGunaka, type GunakaPlan, type SumTerm } from "./gunaka";
import type { Factor } from "./gunita";
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
/** One term of the sum: the left-out factor's x number × the other factors. */
const termText = (tm: SumTerm) => `${tm.p === 1 ? "" : `${tm.p}`}${tm.others.map(factorText).join("")}`;
const times = (vals: number[]) => vals.map((v) => (v < 0 ? `(${num(v)})` : String(v))).join(" × ");

interface Example {
  factors: [number, number][];
  claim: number[];
}
const EXAMPLES: Example[] = [
  { factors: [[1, 2], [1, 3]], claim: [1, 5, 6] },
  { factors: [[1, 1], [1, 2], [1, 3]], claim: [1, 6, 11, 6] },
  { factors: [[2, 1], [1, 3]], claim: [2, 7, 3] },
  { factors: [[1, -1], [1, 2], [1, 4]], claim: [1, 5, 2, -8] },
  { factors: [[1, 2], [1, 4]], claim: [1, 5, 8] },
  { factors: [[1, 2], [1, 3]], claim: [1, 5, 7] },
];
const exampleText = (e: Example) => `${e.factors.map(([p, qq]) => factorText({ p, q: qq })).join("")} = ${poly(e.claim)}`;

/** "sum of the factors" for two, "sum of the products in pairs" for three. */
const sumName = (n: number, t: (en: string, hi: string) => string) => (n === 2 ? t("the sum of the factors", "गुणनखंडों का जोड़") : t("the sum of the products in pairs", "जोड़ियों के गुणनफलों का जोड़"));

function verdict(plan: GunakaPlan, t: (en: string, hi: string) => string): string {
  const truth = poly(plan.truth);
  if (plan.correct) return t("Both checks pass: the factorisation is right ✓", "दोनों जाँच सही: गुणनखंड सही हैं ✓");
  if (!plan.d1Ok && !plan.constOk) return t(`Both checks caught it. The product is ${truth}.`, `दोनों जाँचों ने पकड़ा। गुणनफल ${truth} है।`);
  if (!plan.d1Ok) return t(`The derivative check caught it. The product is ${truth}.`, `अवकलज की जाँच ने पकड़ा। गुणनफल ${truth} है।`);
  return t(`The derivative matches, but the plain number is off. The product is ${truth}.`, `अवकलज मिलता है, पर अकेला नंबर ग़लत है। गुणनफल ${truth} है।`);
}

/** = or ≠, and a ✓ or ✗. */
const Mark: React.FC<{ ok: boolean; anim?: string }> = ({ ok, anim }) => (
  <span data-anim={anim} className={`text-2xl font-semibold ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
    {ok ? "✓" : "✗"}
  </span>
);

// ─── The animated examples ────────────────────────────────────────────────────

function gunakaCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const run = (e: Example) => (): Beat[] => {
    const factors = e.factors.map(([p, qq]) => ({ p, q: qq }));
    const plan = planGunaka(factors, e.claim)!;
    const d1 = poly(plan.d1);
    const sum = poly(plan.sum);
    return [
      {
        strong: `${factors.map(factorText).join("")} = ${poly(e.claim)}?`,
        rest: t("is this factorisation right?", "क्या ये गुणनखंड सही हैं?"),
        visual: <Term cells={[`${factors.map(factorText).join("")} = ${poly(e.claim)}`]} gap={gap} />,
        dur: 1000,
      },
      {
        strong: `${poly(e.claim)} → ${d1}`,
        rest: t("differentiate the polynomial", "बहुपद का अवकलन"),
        visual: (
          <Row>
            <span className="w-14 text-xs text-slate-500 dark:text-slate-400">{t("derivative", "अवकलज")}</span>
            <span data-anim="kg-d">
              <Term cells={[d1]} tone="active" gap={gap} />
            </span>
          </Row>
        ),
        extra: [{ id: "kg-d", kind: "pop", at: 400 }],
      },
      {
        strong: `${plan.terms.map(termText).join(" + ")} = ${sum}`,
        rest: sumName(factors.length, t),
        visual: (
          <Row>
            <span className="w-14 text-xs text-slate-500 dark:text-slate-400">{t("sum", "जोड़")}</span>
            <span data-anim="kg-s">
              <Term cells={[sum]} tone="added" gap={gap} />
            </span>
            <span data-anim="kg-eq" className="px-1 text-xl text-slate-400 dark:text-slate-500">
              {plan.d1Ok ? "=" : "≠"}
            </span>
            <span data-anim="kg-d2">
              <Term cells={[d1]} tone="active" gap={gap} />
            </span>
            <Mark ok={plan.d1Ok} anim="kg-ok" />
          </Row>
        ),
        extra: [
          { id: "kg-s", kind: "pop", at: 400 },
          { id: "kg-eq", kind: "fade", at: 900 },
          { id: "kg-d2", kind: "pop", at: 1000 },
          { id: "kg-ok", kind: "pop", at: 1300 },
        ],
        dur: 1900,
      },
      {
        strong: `${times(factors.map((f) => f.q))} = ${plan.constFactors}`,
        rest: t(`the plain number: ${plan.constOk ? "matches" : `not ${plan.constClaim}`}`, `अकेला नंबर: ${plan.constOk ? "मिलता है" : `${plan.constClaim} नहीं`}`),
        visual: (
          <Row>
            <span className="w-14 text-xs text-slate-500 dark:text-slate-400">{t("number", "नंबर")}</span>
            <Term cells={[num(plan.constFactors)]} tone="added" gap={gap} />
            <span className="px-1 text-xl text-slate-400 dark:text-slate-500">{plan.constOk ? "=" : "≠"}</span>
            <Term cells={[num(plan.constClaim)]} tone="active" gap={gap} />
            <Mark ok={plan.constOk} anim="kg-ok2" />
          </Row>
        ),
        extra: [{ id: "kg-ok2", kind: "pop", at: 700 }],
        dur: 1600,
      },
      {
        strong: plan.correct ? t("Right ✓", "सही ✓") : `${factors.map(factorText).join("")} = ${poly(plan.truth)}`,
        rest: verdict(plan, t),
        visual: plan.correct ? undefined : (
          <span data-anim="kg-t">
            <NumberBoxes groups={[{ cells: [poly(plan.truth)], tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        ),
        extra: plan.correct ? undefined : [{ id: "kg-t", kind: "pop", at: 400 }],
      },
    ];
  };
  return [
    { en: "Two factors", hi: "दो गुणनखंड", sub: "(x + 2)(x + 3)", beats: run(EXAMPLES[0]) },
    { en: "Three factors", hi: "तीन गुणनखंड", sub: "(x + 1)(x + 2)(x + 3)", beats: run(EXAMPLES[1]) },
    { en: "Caught", hi: "पकड़ी", sub: "x² + 5x + 8", beats: run(EXAMPLES[4]) },
  ];
}

/** Gunaka Samuccaya: the factors of the sum equal the sum of the factors. */
export const GunakaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [count, setCount] = useState(2);
  const [fRaw, setFRaw] = useState<string[]>(["1", "2", "1", "3", "1", "4"]);
  const [claims, setClaims] = useState<Record<number, string[]>>({ 2: ["1", "5", "6"], 3: ["1", "6", "11", "6"] });
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
  const plan = valid ? planGunaka(factors, claim) : null;
  if (valid && !plan) note = t("The x number in a factor can't be 0.", "गुणनखंड में x वाला नंबर 0 नहीं हो सकता।");

  if (plan) {
    const d1 = poly(plan.d1);
    const sum = poly(plan.sum);
    steps.push({
      title: t("The factorisation to check", "जाँचने हैं ये गुणनखंड"),
      body: t("Are these the factors of the polynomial?", "क्या ये बहुपद के गुणनखंड हैं?"),
      visual: <Term cells={[`${poly(claim)} = ${factors.map(factorText).join("")}`]} gap={gap} />,
    });
    steps.push({
      title: t("Differentiate the polynomial", "बहुपद का अवकलन करो"),
      body: t("Each power comes down and drops by one (Chalana Kalanabhyam).", "हर घात नीचे आती है और एक कम होती है (चलनकलनाभ्याम्)।"),
      visual: (
        <Row>
          <Term cells={[poly(claim)]} gap={gap} />
          <Op>→</Op>
          <Term cells={[d1]} tone="active" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: count === 2 ? t("Add the factors", "गुणनखंड जोड़ो") : t("Add the products in pairs", "जोड़ियों के गुणनफल जोड़ो"),
      body: factors.some((f) => f.p !== 1)
        ? t("Leave out one factor at a time; multiply its x number by the others.", "एक-एक गुणनखंड छोड़ो; उसके x वाले नंबर को बाकियों से गुणा करो।")
        : count === 2
          ? t("Each factor is what's left when the other is left out.", "हर गुणनखंड वो है जो दूसरे को छोड़ने पर बचता है।")
          : t("Leave out one factor at a time and multiply the other two.", "एक-एक गुणनखंड छोड़ो और बाकी दो का गुणा करो।"),
      visual: (
        <div className="flex flex-col gap-2">
          {plan.terms.map((tm, i) => (
            <Row key={i}>
              {i > 0 && <Op>+</Op>}
              <Term cells={[termText(tm)]} tone="added" gap={gap} size="sm" />
              <Op>=</Op>
              <Term cells={[poly(tm.product)]} gap={gap} size="sm" />
            </Row>
          ))}
          <Row>
            <Op>=</Op>
            <Term cells={[sum]} tone="added" gap={gap} />
          </Row>
        </div>
      ),
    });
    steps.push({
      title: t("The factors of the sum = the sum of the factors?", "जोड़ के गुणनखंड = गुणनखंडों का जोड़?"),
      body: plan.d1Ok
        ? t(`The derivative ${d1} equals ${sumName(count, t)} ✓`, `अवकलज ${d1}, ${sumName(count, t)} के बराबर ✓`)
        : t(`The derivative ${d1} is not ${sum} ✗`, `अवकलज ${d1}, ${sum} नहीं ✗`),
      visual: (
        <Row>
          <Term cells={[d1]} tone="active" gap={gap} />
          <span className="px-1 text-xl text-slate-400 dark:text-slate-500">{plan.d1Ok ? "=" : "≠"}</span>
          <Term cells={[sum]} tone="added" gap={gap} />
          <Mark ok={plan.d1Ok} />
        </Row>
      ),
    });
    steps.push({
      title: t("The plain number", "अकेला नंबर"),
      body: t(
        `The derivative can't see it, so check it on its own: ${times(factors.map((f) => f.q))} = ${plan.constFactors}.`,
        `अवकलज इसे नहीं देखता, तो इसे अलग से जाँचो: ${times(factors.map((f) => f.q))} = ${plan.constFactors}।`,
      ),
      visual: (
        <Row>
          <Term cells={[num(plan.constFactors)]} tone="added" gap={gap} />
          <span className="px-1 text-xl text-slate-400 dark:text-slate-500">{plan.constOk ? "=" : "≠"}</span>
          <Term cells={[num(plan.constClaim)]} tone="active" gap={gap} />
          <Mark ok={plan.constOk} />
        </Row>
      ),
    });
    steps.push({
      title: t("Verdict", "नतीजा"),
      body: verdict(plan, t),
      visual: <NumberBoxes groups={[{ cells: [`${poly(plan.truth)} = ${factors.map(factorText).join("")}`], tone: plan.correct ? "answer" : "done" }]} gap={gap} separator={null} />,
    });
  }

  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;
  const power = (k: number) => (k === 0 ? "" : k === 1 ? "x" : `x${"⁰¹²³"[k]}`);

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("gunaka", lang)}
        subtitle={t("Check a factorisation with the derivative: it equals the sum of the factors.", "गुणनखंड अवकलज से जाँचो: वो गुणनखंडों के जोड़ के बराबर है।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("The factors of the sum (the derivative) = the sum of the factors.", "जोड़ के गुणनखंड (अवकलज) = गुणनखंडों का जोड़।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="gunaka" cases={gunakaCases(t, gap)} lang={lang} gap={gap} />
        ) : (
          <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
            <span>x² + 5x + 6 = (x + 2)(x + 3)</span>
            <span>2x + 5 = (x + 2) + (x + 3) ✓</span>
            <span>x³ + 6x² + 11x + 6 = (x + 1)(x + 2)(x + 3)</span>
            <span>3x² + 12x + 11 = (x + 2)(x + 3) + (x + 1)(x + 3) + (x + 1)(x + 2) ✓</span>
          </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Gunaka means \"the factors\", Samuccaya \"the sum\": the factors of the sum equal the sum of the factors. Here the \"sum\" is the first derivative: for a product of two factors it is just their sum, for three it is the sum of their products in pairs.",
            "गुणक यानी \"गुणनखंड\", समुच्चय यानी \"जोड़\": जोड़ के गुणनखंड = गुणनखंडों का जोड़। यहाँ \"जोड़\" पहला अवकलज है: दो गुणनखंडों के गुणनफल का अवकलज उनका जोड़ है, तीन का उनकी जोड़ियों के गुणनफलों का जोड़।",
          )}
        </p>
      </Card>

      {/* Your factorisation */}
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
          {claimRaw.map((v, i) => {
            const k = count - i;
            return (
              <React.Fragment key={i}>
                <NumIn label={`c${k}`} value={v} onChange={(nv) => setClaims((all) => ({ ...all, [count]: all[count].map((x, j) => (j === i ? nv : x)) }))} hideLabel />
                {label(`${power(k)}${i < claimRaw.length - 1 ? " +" : ""}`)}
              </React.Fragment>
            );
          })}
          {label("=")}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
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
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map((e) => ({ label: exampleText(e), onClick: () => load(e) }))} />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Two factors: derivative = factor + factor.", "दो गुणनखंड: अवकलज = गुणनखंड + गुणनखंड।")}</li>
          <li>{t("Three factors: derivative = sum of the products in pairs.", "तीन गुणनखंड: अवकलज = जोड़ियों के गुणनफलों का जोड़।")}</li>
          <li>{t("Check the plain number too: the product of the factors' numbers.", "अकेला नंबर भी जाँचो: गुणनखंडों के नंबरों का गुणनफल।")}</li>
        </ul>
      </Card>
    </div>
  );
};
