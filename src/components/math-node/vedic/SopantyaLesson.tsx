import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { xPlusQ } from "./purana";
import { Q } from "./shunyam";
import { MAX_TIMES_DIGITS, planEquation, planTimes, type TimesColumn } from "./sopantya";
import { Answer, Frac, NumIn, Op, Row, Term, num } from "./equation";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, stagger, type Beat, type GlanceCase } from "./beats";

type Mode = "equation" | "times";

const xp = (a: number) => xPlusQ(new Q(a));
const EQ_EXAMPLES: number[][] = [
  [2, 3, 4, 5],
  [1, 3, 5, 7],
  [0, 1, 2, 3],
  [-3, -1, 1, 3],
  [1, 2, 4, 7],
];
const TIMES_EXAMPLES: [string, 11 | 12][] = [
  ["132", 12],
  ["2134", 12],
  ["4789", 12],
  ["35", 11],
  ["9876", 11],
];
const MODES: { id: Mode; en: string; hi: string }[] = [
  { id: "equation", en: "Equation", hi: "समीकरण" },
  { id: "times", en: "Multiply by 11, 12", hi: "11, 12 से गुणा" },
];

/** One column of × 11 / × 12: the digit, the working, the digit written and the carry. */
const TimesCol: React.FC<{ c: TimesColumn; by: 11 | 12; lead: boolean; gap: number; lang: Lang }> = ({ c, by, lead, gap, lang }) => (
  <div className="flex flex-col items-center gap-1">
    <NumberBoxes groups={[{ cells: [String(c.digit)], tone: lead ? "muted" : "active" }]} gap={gap} separator={null} size="sm" />
    <span className="whitespace-nowrap text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
      {by === 12 ? `2×${c.digit}` : c.digit} + {c.neighbour}
      {c.carryIn ? ` + ${c.carryIn}` : ""}
    </span>
    <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">= {c.total}</span>
    <NumberBoxes groups={[{ cells: [String(c.write)], tone: "done" }]} gap={gap} separator={null} size="sm" />
    <span className={`h-3 text-[10px] tabular-nums ${c.carryOut ? "text-rose-600 dark:text-rose-400" : "text-transparent"}`}>
      {lang === "hi" ? "हासिल" : "carry"} {c.carryOut}
    </span>
  </div>
);

// ─── The animated examples ────────────────────────────────────────────────────

function sopantyaCases(t: (en: string, hi: string) => string, gap: number, lang: Lang): GlanceCase[] {
  const equation = (): Beat[] => {
    const [p, q, r, s] = [2, 3, 4, 5];
    const plan = planEquation(p, q, r, s);
    const pair = (a: number, b: number) => `(${xp(a)})(${xp(b)})`;
    const frac = (a: number, b: number, tone: "active" | "added") => (
      <Frac num={<Term cells={["1"]} gap={gap} size="sm" />} den={<Term cells={[pair(a, b)]} tone={tone} gap={gap} size="sm" />} />
    );
    const lin = `3x ${plan.constant < 0 ? "−" : "+"} ${Math.abs(plan.constant)}`;
    return [
      {
        strong: `${xp(p)}, ${xp(q)}, ${xp(r)}, ${xp(s)}`,
        rest: t(`four factors, stepping by ${plan.step}`, `चार गुणनखंड, ${plan.step} के क़दम`),
        visual: (
          <Row>
            {frac(p, q, "active")}
            <Op>+</Op>
            {frac(p, r, "active")}
            <Op>=</Op>
            {frac(p, s, "added")}
            <Op>+</Op>
            {frac(q, r, "added")}
          </Row>
        ),
        dur: 1600,
      },
      {
        strong: `(${xp(s)}) + 2(${xp(r)}) = 0`,
        rest: t("the ultimate + twice the penultimate", "अंतिम + दोगुना उपांतिम"),
        visual: (
          <Row>
            <span data-anim="og-u">
              <Term cells={[xp(s)]} tone="done" gap={gap} />
            </span>
            <Op>+</Op>
            <span data-anim="og-p">
              <Term cells={[`2(${xp(r)})`]} tone="active" gap={gap} />
            </span>
            <Op>=</Op>
            <Term cells={["0"]} gap={gap} />
          </Row>
        ),
        extra: stagger(["og-u", "og-p"], 350, 450),
        dur: 1800,
      },
      { strong: `${lin} = 0`, rest: t("one line", "एक लाइन"), visual: <Term cells={[`${lin} = 0`]} tone="done" gap={gap} /> },
      {
        strong: `x = ${plan.x}`,
        rest: t(`check: both sides become ${plan.value}`, `जाँच: दोनों तरफ़ ${plan.value}`),
        visual: (
          <span data-anim="og-x">
            <Answer x={plan.x!} gap={gap} />
          </span>
        ),
        extra: [{ id: "og-x", kind: "pop", at: 300 }],
      },
    ];
  };

  const times = (n: string, by: 11 | 12) => (): Beat[] => {
    const plan = planTimes(n, by)!;
    const cols = plan.columns;
    const step = 480;
    // From the right: the last column goes first.
    const order = cols.map((_, i) => cols.length - 1 - i);
    return [
      {
        strong: `0${plan.n} × ${by}`,
        rest: t("put a 0 in front", "आगे 0 लगाओ"),
        visual: (
          <div className="flex flex-wrap gap-x-3 gap-y-3">
            {cols.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <NumberBoxes groups={[{ cells: [String(c.digit)], tone: i === 0 ? "muted" : "active" }]} gap={gap} separator={null} size="sm" />
                <span data-anim={`og-w${i}`} className="whitespace-nowrap text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                  {by === 12 ? `2×${c.digit}` : c.digit} + {c.neighbour}
                  {c.carryIn ? ` + ${c.carryIn}` : ""} = {c.total}
                </span>
                <span data-anim={`og-r${i}`}>
                  <NumberBoxes groups={[{ cells: [String(c.write)], tone: "done" }]} gap={gap} separator={null} size="sm" />
                </span>
                <span data-anim={`og-c${i}`} className={`h-3 text-[10px] tabular-nums ${c.carryOut ? "text-rose-600 dark:text-rose-400" : "text-transparent"}`}>
                  {lang === "hi" ? "हासिल" : "carry"} {c.carryOut}
                </span>
              </div>
            ))}
          </div>
        ),
        dur: 1100,
      },
      {
        strong: by === 12 ? t("2 × digit + right neighbour", "2 × अंक + दायाँ पड़ोसी") : t("digit + right neighbour", "अंक + दायाँ पड़ोसी"),
        rest: t("from the right; write the last digit, carry the rest", "दाएँ से; आख़िरी अंक लिखो, बाकी हासिल"),
        extra: order.flatMap((i, k) => [
          { id: `og-w${i}`, kind: "fade" as const, at: 200 + k * step },
          { id: `og-r${i}`, kind: "pop" as const, at: 350 + k * step },
          { id: `og-c${i}`, kind: "fade" as const, at: 450 + k * step },
        ]),
        dur: 500 + cols.length * step + 300,
      },
      {
        strong: `${plan.n} × ${by} = ${plan.answer}`,
        rest: t("read the digits left to right", "अंक बाएँ से दाएँ पढ़ो"),
        visual: (
          <span data-anim="og-a">
            <NumberBoxes groups={[{ digits: plan.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        ),
        extra: [{ id: "og-a", kind: "pop", at: 300 }],
      },
    ];
  };

  return [
    { en: "Equation", hi: "समीकरण", sub: "x + 2 … x + 5", beats: equation },
    { en: "× 12", hi: "× 12", sub: "132 × 12", beats: times("132", 12) },
    { en: "× 11", hi: "× 11", sub: "9876 × 11", beats: times("9876", 11) },
  ];
}

/** Sopantyadvayamantyam: the ultimate and twice the penultimate. */
export const SopantyaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("equation");
  const [eqRaw, setEqRaw] = useState<string[]>(() => EQ_EXAMPLES[0].map(String));
  const [timesN, setTimesN] = useState("132");
  const [by, setBy] = useState<11 | 12>(12);
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const steps: StepView[] = [];
  let note: string | null = null;

  if (mode === "equation") {
    const valid = eqRaw.every((s) => /^-?\d+$/.test(s));
    if (!valid) note = t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");
    else {
      const [p, q, r, s] = eqRaw.map(Number);
      const plan = planEquation(p, q, r, s);
      const pair = (a: number, b: number) => `(${xp(a)})(${xp(b)})`;
      const frac = (a: number, b: number, tone: "active" | "added") => (
        <Frac num={<Term cells={["1"]} gap={gap} size="sm" />} den={<Term cells={[pair(a, b)]} tone={tone} gap={gap} size="sm" />} />
      );
      steps.push({
        title: t("The equation", "समीकरण"),
        body: plan.even
          ? t(`Four factors ${xp(p)}, ${xp(q)}, ${xp(r)}, ${xp(s)}: they step evenly, by ${num(plan.step)}.`, `चार गुणनखंड ${xp(p)}, ${xp(q)}, ${xp(r)}, ${xp(s)}: बराबर क़दम, ${num(plan.step)} से।`)
          : t(`Four factors ${xp(p)}, ${xp(q)}, ${xp(r)}, ${xp(s)}: they don't step evenly.`, `चार गुणनखंड ${xp(p)}, ${xp(q)}, ${xp(r)}, ${xp(s)}: बराबर क़दम नहीं।`),
        visual: (
          <Row>
            {frac(p, q, "active")}
            <Op>+</Op>
            {frac(p, r, "active")}
            <Op>=</Op>
            {frac(p, s, "added")}
            <Op>+</Op>
            {frac(q, r, "added")}
          </Row>
        ),
      });
      if (!plan.x) note = t("All four factors are the same, so there's nothing to solve.", "चारों गुणनखंड एक जैसे हैं, तो हल करने को कुछ नहीं।");
      else if (plan.even) {
        const lin = `3x ${plan.constant < 0 ? "−" : "+"} ${Math.abs(plan.constant)}`;
        steps.push({
          title: t("Ultimate + twice the penultimate = 0", "अंतिम + दोगुना उपांतिम = 0"),
          body: t(
            `The last factor (the ultimate) is ${xp(s)}, the one before it (the penultimate) is ${xp(r)}.`,
            `आख़िरी गुणनखंड (अंतिम) ${xp(s)} है, उससे पहले वाला (उपांतिम) ${xp(r)}।`,
          ),
          visual: (
            <Row>
              <Term cells={[xp(s)]} tone="done" gap={gap} />
              <Op>+</Op>
              <Term cells={[`2(${xp(r)})`]} tone="active" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
          ),
        });
        steps.push({
          title: t("Solve one line", "एक लाइन हल करो"),
          body: (
            <b className={STRONG}>
              {xp(s)} + {2}x {2 * r < 0 ? "−" : "+"} {Math.abs(2 * r)} = {lin} = 0 → x = {plan.x.toString()}
            </b>
          ),
          visual: (
            <Row>
              <Term cells={[lin]} tone="done" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
          ),
        });
        if (plan.blocked) note = t(`x = ${plan.x} makes a factor 0, so it doesn't count: no answer.`, `x = ${plan.x} से कोई गुणनखंड 0 हो जाता है, तो ये नहीं चलेगा: कोई जवाब नहीं।`);
        else
          steps.push({
            title: t("Answer", "जवाब"),
            body: t(`x = ${plan.x}. Check: both sides become ${plan.value} ✓`, `x = ${plan.x}। जाँच: दोनों तरफ़ ${plan.value} ✓`),
            visual: <Answer x={plan.x} gap={gap} />,
          });
      } else if (plan.blocked) note = t(`The long way gives x = ${plan.x}, but it makes a factor 0: no answer.`, `लंबे तरीके से x = ${plan.x}, पर इससे कोई गुणनखंड 0 हो जाता है: कोई जवाब नहीं।`);
      else
        steps.push({
          title: t("No shortcut: the long way", "शॉर्टकट नहीं: लंबा तरीका"),
          body: t(
            `Clearing the fractions gives x = ${plan.x} (both sides ${plan.value}). Make the factors step evenly to use the sutra!`,
            `भिन्न हटाने पर x = ${plan.x} (दोनों तरफ़ ${plan.value})। सूत्र के लिए गुणनखंड बराबर क़दम में रखो!`,
          ),
          visual: <Answer x={plan.x} gap={gap} />,
        });
    }
  }

  if (mode === "times") {
    const plan = timesN ? planTimes(timesN, by) : null;
    if (!plan) note = t("Type a number.", "नंबर लिखो।");
    else {
      const [last, prev] = [...plan.columns].reverse();
      const rule = by === 12 ? t("2 × the digit + its right neighbour", "2 × अंक + दायाँ पड़ोसी") : t("the digit + its right neighbour", "अंक + दायाँ पड़ोसी");
      steps.push({
        title: t("Put a 0 in front", "आगे 0 लगाओ"),
        body: t(`0${plan.n}: the answer can be one digit longer.`, `0${plan.n}: जवाब एक अंक लंबा हो सकता है।`),
        visual: <NumberBoxes groups={[{ cells: [{ v: "0", tone: "muted" }, ...[...plan.n].map((v) => ({ v, tone: "active" as const }))] }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t(`From the right: ${rule}`, `दाएँ से: ${rule}`),
        body: t(
          `The last digit has no neighbour: ${by === 12 ? `2×${last.digit}` : last.digit} + 0 = ${last.total}${prev ? `. Next: ${by === 12 ? `2×${prev.digit}` : prev.digit} + ${prev.neighbour}${prev.carryIn ? ` + ${prev.carryIn}` : ""} = ${prev.total}` : ""}… Write the last digit, carry the rest.`,
          `आख़िरी अंक का कोई पड़ोसी नहीं: ${by === 12 ? `2×${last.digit}` : last.digit} + 0 = ${last.total}${prev ? `। फिर: ${by === 12 ? `2×${prev.digit}` : prev.digit} + ${prev.neighbour}${prev.carryIn ? ` + ${prev.carryIn}` : ""} = ${prev.total}` : ""}… आख़िरी अंक लिखो, बाकी हासिल।`,
        ),
        visual: (
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {plan.columns.map((c, i) => (
              <TimesCol key={i} c={c} by={by} lead={i === 0} gap={gap} lang={lang} />
            ))}
          </div>
        ),
      });
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(`${plan.n} × ${by} = ${plan.answer}. Check: ${plan.n} × ${by} = ${(BigInt(plan.n) * BigInt(by)).toString()} ✓`, `${plan.n} × ${by} = ${plan.answer}। जाँच: ${plan.n} × ${by} = ${(BigInt(plan.n) * BigInt(by)).toString()} ✓`),
        visual: (
          <Row>
            <Term cells={[`${plan.n} × ${by}`]} gap={gap} />
            <Op>=</Op>
            <NumberBoxes groups={[{ digits: plan.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </Row>
        ),
      });
    }
  }

  const chip = (on: boolean) =>
    `h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
    }`;
  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("sopantya", lang)}
        subtitle={t("The last and twice the one before it: solve a fraction equation in one line, and multiply by 12 digit by digit.", "आख़िरी और उससे पहले वाले का दोगुना: भिन्न वाला समीकरण एक लाइन में, और 12 से गुणा अंक-दर-अंक।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("The ultimate and twice the penultimate.", "अंतिम और दोगुना उपांतिम।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="sopantya" cases={sopantyaCases(t, gap, lang)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>1/((x+2)(x+3)) + 1/((x+2)(x+4)) = 1/((x+2)(x+5)) + 1/((x+3)(x+4))</span>
          <span>(x + 5) + 2(x + 4) = 0 → 3x + 13 = 0 → x = −13/3</span>
          <span>132 × 12: 2×2 = 4, 2×3 + 2 = 8, 2×1 + 3 = 5, 0 + 1 = 1 → 1584</span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Sa-upantya-dvayam-antyam: antyam is \"the last\" (the ultimate), upantya \"the one before the last\" (the penultimate), dvayam \"twice\". The last one plus twice the one before it: that's all you need.",
            "स-उपान्त्य-द्वयम्-अन्त्यम्: अन्त्यम् यानी \"आख़िरी\" (अंतिम), उपान्त्य यानी \"आख़िरी से पहले वाला\" (उपांतिम), द्वयम् यानी \"दोगुना\"। आख़िरी और उससे पहले वाले का दोगुना: बस इतना चाहिए।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={t("Kind", "प्रकार")} className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} onClick={() => setMode(m.id)} className={chip(m.id === mode)}>
                {lang === "hi" ? m.hi : m.en}
              </button>
            ))}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        {mode === "equation" ? (
          <>
            <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">{t("The four factors:", "चार गुणनखंड:")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
              {[0, 1, 2, 3].map((i) => (
                <React.Fragment key={i}>
                  {label("(x +")}
                  <NumIn label={"pqrs"[i]} value={eqRaw[i]} onChange={(v) => setEqRaw((all) => all.map((x, j) => (j === i ? v : x)))} hideLabel />
                  {label(")")}
                </React.Fragment>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <input
              value={timesN}
              onChange={(e) => setTimesN(e.target.value.replace(/\D/g, "").slice(0, MAX_TIMES_DIGITS))}
              inputMode="numeric"
              aria-label={t("Number", "नंबर")}
              className={`${INPUT} w-36`}
            />
            <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
            <div role="radiogroup" aria-label={t("Multiply by", "किससे गुणा")} className="flex gap-1.5">
              {([11, 12] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={by === k} onClick={() => setBy(k)} className={chip(by === k)}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3">
          {mode === "equation" ? (
            <Examples
              title={t("Examples", "उदाहरण")}
              items={EQ_EXAMPLES.map((e) => ({ label: e.map(xp).join(", "), onClick: () => setEqRaw(e.map(String)) }))}
            />
          ) : (
            <Examples
              title={t("Examples", "उदाहरण")}
              items={TIMES_EXAMPLES.map(([n, k]) => ({
                label: `${n} × ${k}`,
                onClick: () => {
                  setTimesN(n);
                  setBy(k);
                },
              }))}
            />
          )}
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Equation: the factors must step evenly (x + 2, x + 3, x + 4, x + 5).", "समीकरण: गुणनखंड बराबर क़दम में हों (x + 2, x + 3, x + 4, x + 5)।")}</li>
          <li>{t("Then last factor + 2 × the one before it = 0.", "फिर आख़िरी गुणनखंड + 2 × उससे पहले वाला = 0।")}</li>
          <li>{t("× 12: 2 × digit + right neighbour; × 11: digit + right neighbour.", "× 12: 2 × अंक + दायाँ पड़ोसी; × 11: अंक + दायाँ पड़ोसी।")}</li>
        </ul>
      </Card>
    </div>
  );
};
