import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { planDerivative, planQuadratic } from "./chalana";
import { evalPoly, polyText, surdText, type Root } from "./purana";
import { Q } from "./shunyam";
import { NumIn, Op, Row, Term, num } from "./equation";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, stagger, type Beat, type GlanceCase } from "./beats";

type Mode = "solve" | "derivative";

const q = (n: number) => new Q(n);
const poly = (c: number[], v = "x") => polyText(c.map(q), v);
/** One term c·x^p: "3x⁴", "−5x", "7" */
const termText = (c: number, p: number) => poly([c, ...Array(p).fill(0)]);

const SOLVE_EXAMPLES: number[][] = [
  [7, -5, -2],
  [1, -5, 6],
  [2, 7, 3],
  [1, 4, -1],
  [4, -12, 9],
  [3, 2, 1],
];
/** a₄ … a₀, then x. */
const DERIVATIVE_EXAMPLES: number[][] = [
  [0, 0, 1, -4, 3, 2],
  [0, 2, -3, -12, 5, 3],
  [1, 0, -2, 0, 1, 1],
  [3, 0, 0, 5, -7, -1],
];
const MODES: { id: Mode; en: string; hi: string }[] = [
  { id: "solve", en: "Solve a quadratic", hi: "द्विघात हल करो" },
  { id: "derivative", en: "Differentiate", hi: "अवकलन करो" },
];
const POWERS = ["x⁴", "x³", "x²", "x", ""];

// ─── The animated examples ────────────────────────────────────────────────────

const paren = (n: number) => (n < 0 ? `(${num(n)})` : String(n));

function chalanaCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const quadratic = (): Beat[] => {
    const [a, b, c] = [7, -5, -2];
    const plan = planQuadratic(a, b, c)!;
    const eq = poly([a, b, c]);
    const d1 = poly(plan.d1);
    const s = surdText(plan.root!);
    const disc = `${paren(b)}² − 4·${paren(a)}·${paren(c)}`;
    return [
      {
        strong: `${eq} → ${d1}`,
        rest: t("differentiate: each power comes down", "अवकलन: हर घात नीचे आती है"),
        visual: (
          <Row>
            <Term cells={[eq]} gap={gap} />
            <Op>→</Op>
            <span data-anim="cg-d1">
              <Term cells={[d1]} tone="active" gap={gap} />
            </span>
          </Row>
        ),
        extra: [{ id: "cg-d1", kind: "pop", at: 600 }],
        dur: 1700,
      },
      {
        strong: `${disc} = ${plan.disc}`,
        rest: t("the discriminant", "विविक्तकर"),
        visual: (
          <Row>
            <Term cells={[disc]} gap={gap} />
            <Op>=</Op>
            <span data-anim="cg-disc">
              <Term cells={[String(plan.disc)]} tone="added" gap={gap} />
            </span>
          </Row>
        ),
        extra: [{ id: "cg-disc", kind: "pop", at: 600 }],
        dur: 1700,
      },
      {
        strong: `${d1} = ±${s}`,
        rest: t("the derivative is ± its square root", "अवकलज = ± उसका वर्गमूल"),
        visual: (
          <Row>
            <Term cells={[d1]} tone="active" gap={gap} />
            <Op>=</Op>
            <Term cells={[`±${s}`]} tone="added" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `x = ${plan.roots.map((r) => r.text).join(", ")}`,
        rest: t("solve both, one line each", "दोनों हल करो, एक-एक लाइन"),
        visual: (
          <div className="flex flex-col gap-2">
            {plan.cases!.map((k, i) => (
              <Row key={i}>
                <Term cells={[`x = (${k.rhs} ${b < 0 ? "+" : "−"} ${Math.abs(b)}) ÷ ${2 * a}`]} gap={gap} />
                <Op>=</Op>
                <span data-anim={`cg-x${i}`}>
                  <NumberBoxes groups={[{ cells: [k.x.toString()], tone: "answer" }]} gap={gap} separator={null} />
                </span>
              </Row>
            ))}
          </div>
        ),
        extra: stagger(["cg-x0", "cg-x1"], 500, 450),
        dur: 1900,
      },
    ];
  };
  const derivative = (): Beat[] => {
    const coeffs = [0, 2, -3, -12, 5];
    const x0 = 3;
    const plan = planDerivative(coeffs, x0);
    const f = poly(coeffs);
    const n = plan.terms.length;
    return [
      { strong: `f(x) = ${f}`, rest: t("the function", "फलन"), visual: <Term cells={[`f(x) = ${f}`]} gap={gap} />, dur: 1000 },
      {
        strong: t("power × number, power − 1", "घात × नंबर, घात − 1"),
        rest: t("term by term; a plain number becomes 0", "हर टर्म अलग; अकेला नंबर 0 बनता है"),
        visual: (
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {plan.terms.map((tm, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Term cells={[termText(tm.coef, tm.power)]} tone="active" gap={gap} size="sm" />
                <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{tm.power > 0 ? `${tm.power} × ${paren(tm.coef)}` : "→ 0"}</span>
                <span data-anim={`cg-t${i}`}>
                  <Term cells={[tm.power > 0 ? termText(tm.newCoef, tm.power - 1) : "0"]} tone={tm.power > 0 ? "done" : "muted"} gap={gap} size="sm" />
                </span>
              </div>
            ))}
          </div>
        ),
        extra: stagger(plan.terms.map((_, i) => `cg-t${i}`), 500, 380),
        dur: 700 + n * 380 + 500,
      },
      { strong: `f′(x) = ${poly(plan.d1)}`, rest: t("the derivative", "अवकलज"), visual: <Term cells={[`f′(x) = ${poly(plan.d1)}`]} tone="done" gap={gap} /> },
      {
        strong: `f′(${x0}) = ${plan.slope}`,
        rest: plan.slope.n > 0 ? t("the curve is going up here", "यहाँ वक्र ऊपर जा रहा है") : plan.slope.zero ? t("flat: a turning point", "सपाट: मोड़ का बिंदु") : t("the curve is going down here", "यहाँ वक्र नीचे जा रहा है"),
        visual: (
          <Row>
            <Term cells={[`f′(${x0})`]} gap={gap} />
            <Op>=</Op>
            <span data-anim="cg-slope">
              <NumberBoxes groups={[{ cells: [plan.slope.toString()], tone: "answer" }]} gap={gap} separator={null} size="lg" />
            </span>
          </Row>
        ),
        extra: [{ id: "cg-slope", kind: "pop", at: 500 }],
      },
    ];
  };
  return [
    { en: "Solve a quadratic", hi: "द्विघात हल करो", sub: "7x² − 5x − 2 = 0", beats: quadratic },
    { en: "Differentiate", hi: "अवकलन", sub: "2x³ − 3x² − 12x + 5", beats: derivative },
  ];
}

/** Chalana Kalanabhyam: by motion and calculation. */
export const ChalanaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("solve");
  const [solveRaw, setSolveRaw] = useState<string[]>(() => SOLVE_EXAMPLES[0].map(String));
  const [derivRaw, setDerivRaw] = useState<string[]>(() => DERIVATIVE_EXAMPLES[0].map(String));
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();
  const raw = mode === "solve" ? solveRaw : derivRaw;
  const setRaw = mode === "solve" ? setSolveRaw : setDerivRaw;
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const nums = raw.map(Number);
  const setAt = (i: number, v: string) => setRaw((all) => all.map((x, j) => (j === i ? v : x)));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  const answers = (roots: Root[]) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {roots.map((r, i) => (
        <Row key={i}>
          <Term cells={[roots.length > 1 ? `x${"₁₂"[i]}` : "x"]} gap={gap} />
          <Op>=</Op>
          <NumberBoxes groups={[{ cells: [r.text], tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </Row>
      ))}
    </div>
  );

  if (valid && mode === "solve") {
    const [a, b, c] = nums;
    const plan = planQuadratic(a, b, c);
    if (!plan) note = t("The x² number can't be 0: then it isn't a quadratic.", "x² वाला नंबर 0 नहीं हो सकता: तब ये द्विघात नहीं।");
    else {
      const eq = poly([a, b, c]);
      const d1 = poly(plan.d1);
      steps.push({
        title: t("Differentiate (Chalana)", "अवकलन करो (चलन)"),
        body: t(
          `Each power comes down as a multiplier: ${termText(a, 2)} → ${termText(2 * a, 1)}, ${termText(b, 1)} → ${num(b)}, ${num(c)} → 0.`,
          `हर घात गुणक बनकर नीचे आती है: ${termText(a, 2)} → ${termText(2 * a, 1)}, ${termText(b, 1)} → ${num(b)}, ${num(c)} → 0।`,
        ),
        visual: (
          <Row>
            <Term cells={[eq]} gap={gap} />
            <Op>→</Op>
            <Term cells={[d1]} tone="active" gap={gap} />
          </Row>
        ),
      });
      steps.push({
        title: t("The discriminant (Kalana)", "विविक्तकर (कलन)"),
        body: <b className={STRONG}>b² − 4ac = {b < 0 ? `(${num(b)})` : b}² − 4·{a < 0 ? `(${num(a)})` : a}·{c < 0 ? `(${num(c)})` : c} = {num(plan.disc)}</b>,
        visual: (
          <Row>
            <Term cells={[`${b < 0 ? `(${num(b)})` : b}²`]} gap={gap} />
            <Op>−</Op>
            <Term cells={[`4·${a < 0 ? `(${num(a)})` : a}·${c < 0 ? `(${num(c)})` : c}`]} gap={gap} />
            <Op>=</Op>
            <Term cells={[num(plan.disc)]} tone="added" gap={gap} />
          </Row>
        ),
      });
      if (!plan.root) note = t(`The discriminant is ${num(plan.disc)}, below 0: no real square root, so no real answer.`, `विविक्तकर ${num(plan.disc)} है, 0 से कम: असली वर्गमूल नहीं, तो कोई असली जवाब नहीं।`);
      else {
        const s = surdText(plan.root);
        const zero = plan.root.coef.zero;
        steps.push({
          title: t("Derivative = ± its square root", "अवकलज = ± उसका वर्गमूल"),
          body: zero
            ? t(`√0 = 0: ${d1} = 0, and both answers are the same.`, `√0 = 0: ${d1} = 0, और दोनों जवाब एक जैसे।`)
            : t(`√${plan.disc} = ${s}, so ${d1} = ±${s}.`, `√${plan.disc} = ${s}, तो ${d1} = ±${s}।`),
          visual: (
            <Row>
              <Term cells={[d1]} tone="active" gap={gap} />
              <Op>=</Op>
              <Term cells={[zero ? "0" : `±${s}`]} tone="added" gap={gap} />
            </Row>
          ),
        });
        if (plan.cases && plan.cases.length > 1)
          steps.push({
            title: t("Solve both", "दोनों हल करो"),
            body: t("One line each.", "हर एक एक लाइन में।"),
            visual: (
              <div className="flex flex-col gap-2">
                {plan.cases.map((k, i) => (
                  <Row key={i}>
                    <Term cells={[d1]} tone="active" gap={gap} />
                    <Op>=</Op>
                    <Term cells={[k.rhs.toString()]} tone="added" gap={gap} />
                    <Op>→</Op>
                    <Term cells={[`x = (${k.rhs} ${b < 0 ? "+" : "−"} ${Math.abs(b)}) ÷ ${num(2 * a)}`]} gap={gap} />
                    <Op>=</Op>
                    <Term cells={[k.x.toString()]} tone="done" gap={gap} />
                  </Row>
                ))}
              </div>
            ),
          });
        const exact = plan.roots.every((r) => r.value && evalPoly([a, b, c].map(q), r.value).zero);
        steps.push({
          title: t("Answer", "जवाब"),
          body: `x = ${plan.roots.map((r) => r.text).join(t(" or ", " या "))}.${exact ? t(" Check: each one makes the equation 0 ✓", " जाँच: हर एक से समीकरण 0 होता है ✓") : ""}`,
          visual: answers(plan.roots),
        });
      }
    }
  }

  if (valid && mode === "derivative") {
    const coeffs = nums.slice(0, 5);
    const x0 = nums[5];
    const plan = planDerivative(coeffs, x0);
    const f = poly(coeffs);
    const d1 = poly(plan.d1);
    steps.push({
      title: t("Term by term", "हर टर्म अलग"),
      body: t("The power comes down and multiplies; the power drops by one. A plain number becomes 0.", "घात नीचे आकर गुणा करती है; घात एक कम होती है। अकेला नंबर 0 बनता है।"),
      visual: (
        <div className="flex flex-col gap-2">
          {plan.terms.map((tm) => (
            <Row key={tm.power}>
              <Term cells={[termText(tm.coef, tm.power)]} tone="active" gap={gap} />
              <Op>→</Op>
              <span className="w-20 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {tm.power > 0 ? `${tm.power} × ${tm.coef < 0 ? `(${num(tm.coef)})` : tm.coef}` : t("number", "नंबर")}
              </span>
              <Term cells={[tm.power > 0 ? termText(tm.newCoef, tm.power - 1) : "0"]} tone={tm.power > 0 ? "done" : "muted"} gap={gap} />
            </Row>
          ))}
        </div>
      ),
    });
    steps.push({
      title: t("The derivative", "अवकलज"),
      body: t("Put the new terms together.", "नए टर्म एक साथ लिखो।"),
      visual: (
        <Row>
          <Term cells={[`f(x) = ${f}`]} gap={gap} />
          <Op>→</Op>
          <Term cells={[`f′(x) = ${d1}`]} tone="done" gap={gap} />
        </Row>
      ),
    });
    const slope = plan.slope;
    steps.push({
      title: t(`Slope at x = ${num(x0)}`, `x = ${num(x0)} पर ढलान`),
      body: slope.zero
        ? t(`f′(${num(x0)}) = 0: the curve is flat here, a turning point.`, `f′(${num(x0)}) = 0: यहाँ वक्र सपाट है, मोड़ का बिंदु।`)
        : slope.n > 0
          ? t(`f′(${num(x0)}) = ${slope}: the curve is going up here.`, `f′(${num(x0)}) = ${slope}: यहाँ वक्र ऊपर जा रहा है।`)
          : t(`f′(${num(x0)}) = ${slope}: the curve is going down here.`, `f′(${num(x0)}) = ${slope}: यहाँ वक्र नीचे जा रहा है।`),
      visual: (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Row>
            <Term cells={[`f(${num(x0)})`]} gap={gap} />
            <Op>=</Op>
            <Term cells={[plan.value.toString()]} gap={gap} />
          </Row>
          <Row>
            <Term cells={[`f′(${num(x0)})`]} gap={gap} />
            <Op>=</Op>
            <NumberBoxes groups={[{ cells: [slope.toString()], tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </Row>
        </div>
      ),
    });
  }

  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("chalana", lang)}
        subtitle={t("The Vedic calculus: differentiate term by term, and solve a quadratic from its derivative.", "वैदिक कलन: हर टर्म का अवकलन करो, और अवकलज से द्विघात हल करो।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("The first derivative equals ± the square root of the discriminant.", "पहला अवकलज = ± विविक्तकर का वर्गमूल।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="chalana" cases={chalanaCases(t, gap)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>7x² − 5x − 2 = 0</span>
          <span>
            {t("Derivative", "अवकलज")}: 14x − 5 · {t("discriminant", "विविक्तकर")}: 25 + 56 = 81
          </span>
          <span>14x − 5 = ±9 → x = 1, −2/7</span>
        </div>
        )}
        <p className={`mt-3 ${BODY}`}>
          {t("Derivative of a term: the power comes down and the power drops by one.", "टर्म का अवकलज: घात नीचे आती है और घात एक कम होती है।")}{" "}
          <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">3x⁴ → 12x³, 5x → 5, 7 → 0</span>
        </p>
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Chalana means \"motion\" (change), Kalana \"calculation\", and -abhyam \"by both\". Chalana-kalana is the Sanskrit name for calculus: how fast something changes. At the middle of a quadratic's two answers the change is zero, and the answers sit ±√discriminant away from it.",
            "चलन यानी \"गति\" (बदलाव), कलन यानी \"गणना\", और -आभ्याम् यानी \"दोनों से\"। चलन-कलन, कैलकुलस का संस्कृत नाम है: कुछ कितनी तेज़ी से बदलता है। द्विघात के दोनों जवाबों के बीच बदलाव शून्य है, और जवाब उससे ±√विविक्तकर दूर हैं।",
          )}
        </p>
      </Card>

      {/* Your equation */}
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
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          {mode === "solve" ? (
            <>
              <NumIn label="a" value={raw[0]} onChange={(v) => setAt(0, v)} hideLabel />
              {label("x² +")}
              <NumIn label="b" value={raw[1]} onChange={(v) => setAt(1, v)} hideLabel />
              {label("x +")}
              <NumIn label="c" value={raw[2]} onChange={(v) => setAt(2, v)} hideLabel />
              {label("= 0")}
            </>
          ) : (
            <>
              {POWERS.map((pw, i) => (
                <React.Fragment key={i}>
                  <NumIn label={`a${"₄₃₂₁₀"[i]}`} value={raw[i]} onChange={(v) => setAt(i, v)} hideLabel />
                  {label(i < 4 ? `${pw} +` : "")}
                </React.Fragment>
              ))}
              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{t("slope at x =", "ढलान, x =")}</span>
              <NumIn label="x" value={raw[5]} onChange={(v) => setAt(5, v)} hideLabel />
            </>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={(mode === "solve" ? SOLVE_EXAMPLES : DERIVATIVE_EXAMPLES).map((e) => ({
              label: mode === "solve" ? `${poly(e)} = 0` : `${poly(e.slice(0, 5))}, x = ${num(e[5])}`,
              onClick: () => setRaw(e.map(String)),
            }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Derivative of ax² + bx + c is 2ax + b.", "ax² + bx + c का अवकलज 2ax + b है।")}</li>
          <li>{t("Then 2ax + b = ±√(b² − 4ac): two one-line equations.", "फिर 2ax + b = ±√(b² − 4ac): दो एक-लाइन समीकरण।")}</li>
          <li>{t("Where the derivative is 0, the curve turns: x = −b ÷ 2a, exactly between the two answers.", "जहाँ अवकलज 0 है, वक्र मुड़ता है: x = −b ÷ 2a, दोनों जवाबों के ठीक बीच।")}</li>
        </ul>
      </Card>
    </div>
  );
};
