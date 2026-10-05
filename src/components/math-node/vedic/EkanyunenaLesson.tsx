import React, { useState } from "react";
import { FitWidth, NumberBoxes, type BoxCell } from "./NumberBoxes";
import { MAX_DIGITS, planEkan, type ComplementDigit } from "./ekanyunena";
import { Op, Row, Term } from "./equation";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, stagger, type Beat, type GlanceCase } from "./beats";

const NINES = [1, 2, 3, 4, 5];
const EXAMPLES: [string, number][] = [
  ["43", 2],
  ["777", 3],
  ["12", 3],
  ["7", 1],
  ["234", 2],
  ["1234", 2],
  ["340", 2],
  ["98765", 5],
];

/** One digit of the right part: the digit above, how it's taken away, and the result. */
const CompCol: React.FC<{ c: ComplementDigit; gap: number; lang: Lang }> = ({ c, gap, lang }) => (
  <div className="flex flex-col items-center gap-1">
    <NumberBoxes groups={[{ cells: [String(c.from)], tone: "added" }]} gap={gap} separator={null} size="sm" />
    <span className="whitespace-nowrap text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
      {c.kind === "nine" ? `9 − ${c.from}` : c.kind === "ten" ? `10 − ${c.from}` : lang === "hi" ? "0 रहता" : "0 stays"}
    </span>
    <NumberBoxes groups={[{ cells: [String(c.to)], tone: c.kind === "ten" ? "carry" : "active" }]} gap={gap} separator={null} size="sm" />
  </div>
);

// ─── The animated examples ────────────────────────────────────────────────────

function ekanyunenaCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const run = (nText: string, k: number) => (): Beat[] => {
    const p = planEkan(nText, k)!;
    const { n, nines, kase, left, complement, rightText, answer } = p;
    const leftText = String(left).padStart(k, "0");
    // Left | complement, each complement digit popping in turn.
    const parts = (
      <NumberBoxes
        groups={[
          { id: "eg-l", digits: left === 0 ? "0" : String(left), tone: left === 0 ? "muted" : "done" },
          { id: "eg-r", cells: complement.map((c, i): BoxCell => ({ v: String(c.to), tone: c.kind === "ten" ? "carry" : "active", id: `eg-r${i}` })) },
        ]}
        gap={gap}
        separator="|"
        size="lg"
      />
    );
    const complementBeat: Beat = {
      strong:
        kase === "more"
          ? t(`complement of ${p.last} from 1${"0".repeat(k)} = ${rightText}`, `1${"0".repeat(k)} से ${p.last} का पूरक = ${rightText}`)
          : t(`complement of ${leftText} from ${nines} = ${rightText}`, `${nines} से ${leftText} का पूरक = ${rightText}`),
      rest:
        kase === "more"
          ? t("all from 9, the last non-zero from 10", "सब 9 में से, आख़िरी ग़ैर-शून्य 10 में से")
          : t(`each digit from 9; ${leftText} + ${rightText} = ${nines}`, `हर अंक 9 में से; ${leftText} + ${rightText} = ${nines}`),
      extra: [
        { id: "eg-r-sep", kind: "fade", at: 0 },
        { id: "eg-r", kind: "fade", at: 0, dur: 150 },
        ...stagger(
          complement.map((_, i) => `eg-r${i}`),
          150,
          280,
        ),
      ],
      dur: 600 + complement.length * 280 + 300,
    };
    const beats: Beat[] =
      kase === "more"
        ? [
          {
            strong: `${p.first} | ${p.last}`,
            rest: t(`more digits than 9s: split off the last ${k}`, `9 से ज़्यादा अंक: आख़िरी ${k} अलग करो`),
            visual: <NumberBoxes groups={[{ digits: String(p.first), tone: "added" }, { digits: p.last }]} gap={gap} separator="|" size="lg" />,
          },
          {
            strong: `${n} − (${p.first} + 1) = ${left}`,
            rest: t("left part: take away one more than the first part", "बायाँ हिस्सा: पहले हिस्से से एक ज़्यादा घटाओ"),
            visual: parts,
          },
          complementBeat,
        ]
        : [
          {
            strong: `${n} × ${nines}`,
            rest:
              kase === "fewer"
                ? t(`fewer digits: think of ${n} as ${p.padded}`, `कम अंक: ${n} को ${p.padded} मानो`)
                : t(`${k} nines: the right part has ${k} digits`, `${k} नौ: दाएँ हिस्से में ${k} अंक`),
            visual: (
              <Row>
                <NumberBoxes groups={[{ cells: [...p.padded].map((v, i): BoxCell => ({ v, tone: i < k - String(n).length ? "muted" : "plain" })) }]} gap={gap} separator={null} />
                <Op>×</Op>
                <NumberBoxes groups={[{ digits: nines, tone: "added" }]} gap={gap} separator={null} />
              </Row>
            ),
          },
          { strong: `${n} − 1 = ${left}`, rest: t("left part: one less than the number", "बायाँ हिस्सा: नंबर से एक कम"), visual: parts },
          complementBeat,
        ];
    beats.push({
      strong: `${left} | ${rightText} = ${answer}`,
      rest: t(`check: ${n} × ${nines} = ${answer}`, `जाँच: ${n} × ${nines} = ${answer}`),
      visual: (
        <span data-anim="eg-a">
          <NumberBoxes groups={[{ digits: answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </span>
      ),
      extra: [{ id: "eg-a", kind: "pop", at: 300 }],
    });
    return beats;
  };
  return [
    { en: "Same digits", hi: "बराबर अंक", sub: "43 × 99", beats: run("43", 2) },
    { en: "Fewer digits", hi: "कम अंक", sub: "12 × 999", beats: run("12", 3) },
    { en: "More digits", hi: "ज़्यादा अंक", sub: "234 × 99", beats: run("234", 2) },
  ];
}

/** Ekanyunena Purvena: one less than the previous. */
export const EkanyunenaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [nText, setNText] = useState("43");
  const [k, setK] = useState(2);
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const steps: StepView[] = [];
  let note: string | null = null;
  const plan = nText ? planEkan(nText, k) : null;
  if (!plan) note = t("Type a number.", "नंबर लिखो।");
  else {
    const { n, nines, kase, left, complement, rightText, answer } = plan;
    const leftText = String(left).padStart(k, "0");
    const rightCells: BoxCell[] = complement.map((c) => ({ v: String(c.to), tone: "active" }));
    const answerGroups = [{ digits: left === 0 ? "0" : String(left), tone: left === 0 ? ("muted" as const) : ("done" as const) }, { cells: rightCells }];

    if (kase !== "more") {
      steps.push({
        title: t(`Count the 9s: ${k}`, `9 गिनो: ${k}`),
        body:
          kase === "same"
            ? t(`${nines} has ${k} nine${k > 1 ? "s" : ""}, and ${n} has ${k} digit${k > 1 ? "s" : ""}: the right part will have ${k} digit${k > 1 ? "s" : ""}.`, `${nines} में ${k} नौ हैं, और ${n} में ${k} अंक: दाएँ हिस्से में ${k} अंक होंगे।`)
            : t(`${n} has fewer digits than ${nines}: think of it as ${plan.padded}.`, `${n} में ${nines} से कम अंक हैं: इसे ${plan.padded} मानो।`),
        visual: (
          <Row>
            <NumberBoxes groups={[{ cells: [...plan.padded].map((v, i) => ({ v, tone: i < k - String(n).length ? "muted" : "plain" })) }]} gap={gap} separator={null} />
            <Op>×</Op>
            <NumberBoxes groups={[{ digits: nines, tone: "added" }]} gap={gap} separator={null} />
          </Row>
        ),
      });
      steps.push({
        title: t("Left part: one less than the number", "बायाँ हिस्सा: नंबर से एक कम"),
        body: (
          <b className={STRONG}>
            {n} − 1 = {left}
          </b>
        ),
        visual: <NumberBoxes groups={[{ digits: String(left), tone: "done", caption: `${n} − 1` }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t(`Right part: the complement from ${nines}`, `दायाँ हिस्सा: ${nines} से पूरक`),
        body: t(
          `The complement of ${leftText} from ${nines}: each digit from 9, giving ${rightText}. A number and its complement add up to ${nines}: ${leftText} + ${rightText} = ${nines}.`,
          `${nines} से ${leftText} का पूरक: हर अंक 9 में से, मिला ${rightText}। नंबर और उसका पूरक जोड़कर ${nines}: ${leftText} + ${rightText} = ${nines}।`,
        ),
        visual: (
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {complement.map((c, i) => (
              <CompCol key={i} c={c} gap={gap} lang={lang} />
            ))}
          </div>
        ),
      });
    } else {
      const lastValue = Number(plan.last);
      steps.push({
        title: t("More digits than 9s: split", "9 से ज़्यादा अंक: बाँटो"),
        body: t(
          `${nines} has ${k} nine${k > 1 ? "s" : ""}, so split off the last ${k} digit${k > 1 ? "s" : ""}: ${plan.first} | ${plan.last}.`,
          `${nines} में ${k} नौ हैं, तो आख़िरी ${k} अंक अलग करो: ${plan.first} | ${plan.last}।`,
        ),
        visual: <NumberBoxes groups={[{ digits: String(plan.first), tone: "added" }, { digits: plan.last }]} gap={gap} separator="|" />,
      });
      steps.push({
        title: lastValue ? t("Left part: take away one more than the first part", "बायाँ हिस्सा: पहले हिस्से से एक ज़्यादा घटाओ") : t("Left part: take away the first part", "बायाँ हिस्सा: पहला हिस्सा घटाओ"),
        body: (
          <b className={STRONG}>
            {lastValue ? `${n} − (${plan.first} + 1) = ${left}` : `${n} − ${plan.first} = ${left}`}
          </b>
        ),
        visual: <NumberBoxes groups={[{ digits: String(left), tone: "done", caption: lastValue ? `${n} − ${plan.first + 1}` : `${n} − ${plan.first}` }]} gap={gap} separator={null} />,
      });
      steps.push({
        title: t(`Right part: the complement of ${plan.last} from 1${"0".repeat(k)}`, `दायाँ हिस्सा: 1${"0".repeat(k)} से ${plan.last} का पूरक`),
        body: lastValue
          ? t(
            `The complement from 1${"0".repeat(k)}: all from 9, the last non-zero digit from 10; zeros at the end stay.`,
            `1${"0".repeat(k)} से पूरक: सब 9 में से, आख़िरी ग़ैर-शून्य अंक 10 में से; आख़िर के शून्य वैसे ही।`,
          )
          : t("The last part is all zeros, so its complement is too.", "आख़िरी हिस्सा सब शून्य है, तो उसका पूरक भी।"),
        visual: (
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {complement.map((c, i) => (
              <CompCol key={i} c={c} gap={gap} lang={lang} />
            ))}
          </div>
        ),
      });
    }
    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {left} | {rightText} → {answer}. {t("Check: ", "जाँच: ")}
          {n} × {nines} = {(BigInt(n) * BigInt(nines)).toString()} ✓
        </span>
      ),
      visual: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 max-w-full">
            <FitWidth>
              <NumberBoxes groups={answerGroups} gap={gap} separator="|" />
            </FitWidth>
          </div>
          {/* "=" wraps with the answer; a long answer shrinks to fit a narrow screen. */}
          <span className="flex min-w-0 max-w-full items-center gap-x-4">
            <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
            <div className="min-w-0 flex-1">
              <FitWidth>
                <NumberBoxes groups={[{ digits: answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />
              </FitWidth>
            </div>
          </span>
        </div>
      ),
    });
  }

  const chip = (on: boolean) =>
    `h-8 rounded-lg border px-2.5 text-xs font-medium tabular-nums transition-colors ${on
      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("ekanyunena", lang)}
        subtitle={t("Multiply by 9, 99, 999… in two quick parts: one less than the number, and its complement.", "9, 99, 999… से गुणा दो झटपट हिस्सों में: नंबर से एक कम, और उसका पूरक।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>
            {t("Left: one less than the number. Right: the complement of that from 99…9 (each digit from 9).", "बायाँ: नंबर से एक कम। दायाँ: 99…9 से उसका पूरक (हर अंक 9 में से)।")}
          </b>
        </p>
        {animate ? (
          <AnimatedExamples id="ekanyunena" cases={ekanyunenaCases(t, gap)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>43 × 99 → 42 | {t("complement", "पूरक")} 57 → 4257</span>
          <span>12 × 999 → 011 | {t("complement", "पूरक")} 988 → 11988</span>
          <span>
            234 × 99 → 234 − 3 = 231 | {t("complement of 34 from 100", "100 से 34 का पूरक")} = 66 → 23166
          </span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Ekanyunena means \"by one less\", Purvena \"than the previous\": the left part is one less than the number before it. It works because 99 is 100 − 1: 43 × 99 = 4300 − 43.",
            "एकन्यूनेन यानी \"एक कम से\", पूर्वेण यानी \"पहले वाले से\": बायाँ हिस्सा पहले वाले नंबर से एक कम है। ये इसलिए चलता है क्योंकि 99 = 100 − 1: 43 × 99 = 4300 − 43।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("Your numbers", "तुम्हारे नंबर")}</h3>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            value={nText}
            onChange={(e) => setNText(e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS))}
            inputMode="numeric"
            aria-label={t("Number", "नंबर")}
            className={`${INPUT} w-36`}
          />
          <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
          <div role="radiogroup" aria-label={t("Nines", "नौ")} className="flex flex-wrap gap-1.5">
            {NINES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={k === c} onClick={() => setK(c)} className={chip(k === c)}>
                {"9".repeat(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES.map(([n, c]) => ({
              label: `${n} × ${"9".repeat(c)}`,
              onClick: () => {
                setNText(n);
                setK(c);
              },
            }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Right part = the complement of the left part from 99…9; it has as many digits as there are 9s.", "दायाँ हिस्सा = 99…9 से बाएँ हिस्से का पूरक; उसमें उतने अंक जितने 9।")}</li>
          <li>{t("A number + its complement = 99…9 (42 + 57 = 99).", "नंबर + उसका पूरक = 99…9 (42 + 57 = 99)।")}</li>
          <li>{t("Fewer digits: put zeros in front (12 → 012).", "कम अंक: आगे शून्य लगाओ (12 → 012)।")}</li>
          <li>{t("More digits: split; left = number − (first part + 1), right = complement of the last part from 100…", "ज़्यादा अंक: बाँटो; बायाँ = नंबर − (पहला हिस्सा + 1), दायाँ = 100… से आख़िरी हिस्से का पूरक।")}</li>
        </ul>
      </Card>
    </div>
  );
};
