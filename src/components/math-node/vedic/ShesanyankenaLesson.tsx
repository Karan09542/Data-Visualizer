import React, { useState } from "react";
import { NumberBoxes, type BoxCell } from "./NumberBoxes";
import { MAX_DENOMINATOR, planShes } from "./shesanyankena";
import { NumIn, Op, Row, Term } from "./equation";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, stagger, type Beat, type GlanceCase } from "./beats";

const EXAMPLES: [number, number][] = [
  [1, 7],
  [3, 7],
  [1, 13],
  [1, 17],
  [1, 19],
  [5, 21],
  [2, 11],
  [22, 7],
];

/** One column: a remainder, times the last digit, and the digit it gives. */
const Column: React.FC<{ r: number; product: number; digit: number; last: number; gap: number }> = ({ r, product, digit, last, gap }) => {
  const p = String(product);
  return (
    <div className="flex flex-col items-center gap-1">
      <NumberBoxes groups={[{ cells: [String(r)], tone: "added" }]} gap={gap} separator={null} size="sm" />
      <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        ×{last} = {p.slice(0, -1)}
        <b className="font-semibold text-emerald-600 dark:text-emerald-400">{p.slice(-1)}</b>
      </span>
      <NumberBoxes groups={[{ cells: [String(digit)], tone: "done" }]} gap={gap} separator={null} size="sm" />
    </div>
  );
};

// ─── The animated examples ────────────────────────────────────────────────────

function shesCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const fraction = (n: number, d: number) => (): Beat[] => {
    const p = planShes(n, d).plan!;
    const { last, remainders, products, digits } = p;
    const k = remainders.length;
    return [
      {
        strong: `${d} × ${last} = ${p.lastCheck}`,
        rest: t(`the last digit is ${last} (the product ends in 9)`, `आख़िरी अंक ${last} (गुणनफल 9 पर ख़त्म)`),
        visual: (
          <Row>
            <Term cells={[String(d)]} gap={gap} />
            <Op>×</Op>
            <span data-anim="sg-l">
              <Term cells={[String(last)]} tone="active" gap={gap} />
            </span>
            <Op>=</Op>
            <NumberBoxes
              groups={[{ cells: [...String(p.lastCheck)].map((v, i, all): BoxCell => ({ v, tone: i === all.length - 1 ? "done" : "plain", id: i === all.length - 1 ? "sg-9" : undefined })) }]}
              gap={gap}
              separator={null}
            />
          </Row>
        ),
        extra: [
          { id: "sg-l", kind: "pop", at: 400 },
          { id: "sg-9", kind: "glow", at: 800 },
        ],
        dur: 1700,
      },
      {
        strong: remainders.join(", "),
        rest: t(`the remainders: ×10, divide by ${d}, keep what's left`, `शेषफल: ×10, ${d} से भाग, बचा रखो`),
        visual: (
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {remainders.map((r, i) => {
              const pr = String(products[i]);
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  {/* The wrapper pops in; the cell inside glows when it's used. */}
                  <span data-anim={`sg-rw${i}`}>
                    <NumberBoxes groups={[{ cells: [{ v: String(r), id: `sg-r${i}` }], tone: "added" }]} gap={gap} separator={null} size="sm" />
                  </span>
                  <span data-anim={`sg-p${i}`} className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                    ×{last} = {pr.slice(0, -1)}
                    <b className="font-semibold text-emerald-600 dark:text-emerald-400">{pr.slice(-1)}</b>
                  </span>
                  <span data-anim={`sg-d${i}`}>
                    <NumberBoxes groups={[{ cells: [String(digits[i])], tone: "done" }]} gap={gap} separator={null} size="sm" />
                  </span>
                </div>
              );
            })}
          </div>
        ),
        extra: stagger(
          remainders.map((_, i) => `sg-rw${i}`),
          300,
          260,
        ),
        dur: 500 + k * 260 + 300,
      },
      {
        strong: digits.join(", "),
        rest: t(`each remainder × ${last}, keep the last digit`, `हर शेष × ${last}, आख़िरी अंक रखो`),
        extra: remainders.flatMap((_, i) => [
          { id: `sg-r${i}`, kind: "glow" as const, at: 150 + i * 320, dur: 600 },
          { id: `sg-p${i}`, kind: "fade" as const, at: 150 + i * 320 },
          { id: `sg-d${i}`, kind: "pop" as const, at: 300 + i * 320 },
        ]),
        dur: 500 + k * 320 + 300,
      },
      {
        strong: `${n}/${d} = 0.${digits.join("")} ${digits.join("")}…`,
        rest: t(`these ${k} digits repeat`, `ये ${k} अंक दोहराते हैं`),
        visual: (
          <div className="flex items-end gap-1">
            <NumberBoxes groups={[{ digits: String(p.whole), tone: "answer" }]} gap={gap} separator={null} size="lg" />
            <span className="pb-1 text-2xl font-semibold text-slate-500 dark:text-slate-400">.</span>
            <span className="flex flex-col items-stretch gap-1">
              <span data-anim="sg-bar" className="h-0.5 rounded bg-emerald-600 dark:bg-emerald-400" />
              <NumberBoxes groups={[{ cells: digits.map(String), tone: "answer" }]} gap={gap} separator={null} />
            </span>
          </div>
        ),
        extra: [{ id: "sg-bar", kind: "fade", at: 500 }],
      },
    ];
  };
  return [
    { en: "Sevenths", hi: "सातवाँ", sub: "1/7", beats: fraction(1, 7) },
    { en: "Thirteenths", hi: "तेरहवाँ", sub: "1/13", beats: fraction(1, 13) },
  ];
}

/** Shesanyankena Charamena: the remainders by the last digit. */
export const ShesanyankenaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [raw, setRaw] = useState<string[]>(["1", "7"]);
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();
  const valid = raw.every((s) => /^\d+$/.test(s));
  const [n, d] = raw.map(Number);
  const setAt = (i: number, v: string) => setRaw((all) => all.map((x, j) => (j === i ? v.replace(/\D/g, "") : x)));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill both boxes with whole numbers.", "दोनों डिब्बों में पूरे नंबर लिखो।");
  const res = valid ? planShes(n, d) : null;
  if (res?.miss)
    note =
      res.miss.reason === "denominator"
        ? t("The bottom number should end in 1, 3, 7 or 9: those make a decimal that repeats forever.", "नीचे का नंबर 1, 3, 7 या 9 पर ख़त्म हो: उनसे दशमलव हमेशा दोहराता है।")
        : t(`Top 1–9999, bottom 3–${MAX_DENOMINATOR}.`, `ऊपर 1–9999, नीचे 3–${MAX_DENOMINATOR}।`);
  const plan = res?.plan;

  if (plan) {
    const { whole, rem0, last, remainders, products, digits } = plan;
    if (whole > 0)
      steps.push({
        title: t("Whole part first", "पहले पूरा हिस्सा"),
        body: t(`${n} ÷ ${d} = ${whole}, remainder ${rem0}: now work with ${rem0}/${d}.`, `${n} ÷ ${d} = ${whole}, शेष ${rem0}: अब ${rem0}/${d} पर काम करो।`),
        visual: (
          <Row>
            <Term cells={[`${n} ÷ ${d}`]} gap={gap} />
            <Op>=</Op>
            <Term cells={[String(whole)]} tone="done" gap={gap} />
            <Op>+</Op>
            <Term cells={[`${rem0}/${d}`]} tone="added" gap={gap} />
          </Row>
        ),
      });
    if (rem0 === 0) {
      steps.push({
        title: t("Answer", "जवाब"),
        body: t(`${d} goes into ${n} exactly: no decimal part.`, `${d}, ${n} में पूरा जाता है: कोई दशमलव नहीं।`),
        visual: <NumberBoxes groups={[{ digits: String(whole), tone: "answer" }]} gap={gap} separator={null} size="lg" />,
      });
    } else {
      steps.push({
        title: t("The last digit", "आख़िरी अंक"),
        body: t(
          `${d} ends in ${d % 10}. The decimal ends in the digit that makes ${d} × it end in 9: ${d} × ${last} = ${plan.lastCheck}. So the last digit is ${last}.`,
          `${d} का आख़िरी अंक ${d % 10} है। दशमलव उस अंक पर ख़त्म होता है जिससे ${d} × वो, 9 पर ख़त्म हो: ${d} × ${last} = ${plan.lastCheck}। तो आख़िरी अंक ${last}।`,
        ),
        visual: (
          <Row>
            <Term cells={[String(d)]} gap={gap} />
            <Op>×</Op>
            <Term cells={[String(last)]} tone="active" gap={gap} />
            <Op>=</Op>
            <NumberBoxes
              groups={[{ cells: [...String(plan.lastCheck)].map((v, i, all): BoxCell => ({ v, tone: i === all.length - 1 ? "done" : "plain" })) }]}
              gap={gap}
              separator={null}
            />
          </Row>
        ),
      });
      const [r1, r2] = remainders;
      steps.push({
        title: t("The remainders", "शेषफल"),
        body: t(
          `Start with ${rem0}. Each time, ×10 and keep the remainder after dividing by ${d}: ${rem0 * 10} ÷ ${d} leaves ${r1}${r2 !== undefined ? `, ${r1 * 10} ÷ ${d} leaves ${r2}` : ""}… until ${rem0} comes back.`,
          `${rem0} से शुरू करो। हर बार ×10 करो और ${d} से भाग देकर शेष रखो: ${rem0 * 10} ÷ ${d} से ${r1} बचता है${r2 !== undefined ? `, ${r1 * 10} ÷ ${d} से ${r2}` : ""}… जब तक ${rem0} वापस न आए।`,
        ),
        visual: (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {remainders.map((r, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-xs text-slate-300 dark:text-slate-600">→</span>}
                <NumberBoxes groups={[{ cells: [String(r)], tone: i === remainders.length - 1 ? "muted" : "added" }]} gap={gap} separator={null} size="sm" />
              </React.Fragment>
            ))}
          </div>
        ),
      });
      steps.push({
        title: t(`Each remainder × ${last}: keep the last digit`, `हर शेष × ${last}: आख़िरी अंक रखो`),
        body: t(
          `${r1} × ${last} = ${products[0]} → ${digits[0]}${r2 !== undefined ? `, ${r2} × ${last} = ${products[1]} → ${digits[1]}` : ""}… These are the digits of the decimal, in order.`,
          `${r1} × ${last} = ${products[0]} → ${digits[0]}${r2 !== undefined ? `, ${r2} × ${last} = ${products[1]} → ${digits[1]}` : ""}… यही दशमलव के अंक हैं, क्रम से।`,
        ),
        visual: (
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {remainders.map((r, i) => (
              <Column key={i} r={r} product={products[i]} digit={digits[i]} last={last} gap={gap} />
            ))}
          </div>
        ),
      });
      const cycle = digits.join("");
      const check = digits.length <= 12 ? BigInt(cycle) * BigInt(d) : null;
      steps.push({
        title: t("Answer", "जवाब"),
        body: (
          <span className="flex flex-col gap-0.5 tabular-nums">
            <span>
              {n}/{d} = {whole}.{cycle} {cycle}…{" "}
              {t(`(${digits.length} digits repeat)`, `(${digits.length} अंक दोहराते हैं)`)}
            </span>
            {check !== null && (
              <span>
                {t("Check", "जाँच")}: {cycle} × {d} = {check.toString()} = {rem0} × {"9".repeat(digits.length)} ✓
              </span>
            )}
            {plan.halves && (
              <span>
                {t("Bonus: the halves add to all 9s", "बोनस: दोनों आधे जोड़कर सब 9")}: {plan.halves.first} + {plan.halves.second} = {plan.halves.sum}
              </span>
            )}
          </span>
        ),
        visual: (
          <div className="flex flex-wrap items-end gap-1">
            <NumberBoxes groups={[{ digits: String(whole), tone: "answer" }]} gap={gap} separator={null} size="lg" />
            <span className="pb-1 text-2xl font-semibold text-slate-500 dark:text-slate-400">.</span>
            {/* The repeating digits, with the bar that marks them as repeating. */}
            <span className="flex flex-col items-stretch gap-1">
              <span className="h-0.5 rounded bg-emerald-600 dark:bg-emerald-400" />
              <span className="flex flex-wrap gap-0.5">
                {digits.map((x, i) => (
                  <NumberBoxes key={i} groups={[{ cells: [String(x)], tone: "answer" }]} gap={gap} separator={null} />
                ))}
              </span>
            </span>
          </div>
        ),
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("shesanyankena", lang)}
        subtitle={t("A fraction's recurring decimal, digit by digit, from its remainders, without long division.", "भिन्न का दोहराता दशमलव, अंक-दर-अंक, शेषफलों से, बिना लंबे भाग के।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Multiply the remainders by the last digit; their last digits are the decimal.", "शेषफलों को आख़िरी अंक से गुणा करो; उनके आख़िरी अंक ही दशमलव हैं।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="shesanyankena" cases={shesCases(t, gap)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>1/7: {t("last digit", "आख़िरी अंक")} 7 (7 × 7 = 49)</span>
          <span>{t("Remainders", "शेषफल")}: 3, 2, 6, 4, 5, 1</span>
          <span>× 7: 21, 14, 42, 28, 35, 7 → 1, 4, 2, 8, 5, 7</span>
          <span>1/7 = 0.142857 142857…</span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Sheshani means \"the remainders\", Ankena \"by the digit\", Charamena \"the last\": the remainders, by the last digit. Each digit of the decimal is hidden in a remainder; multiplying by the last digit brings it out.",
            "शेषाणि यानी \"शेषफल\", अङ्केन यानी \"अंक से\", चरमेण यानी \"आख़िरी\": शेषफल, आख़िरी अंक से। दशमलव का हर अंक एक शेषफल में छिपा है; आख़िरी अंक से गुणा करने पर वो बाहर आता है।",
          )}
        </p>
      </Card>

      {/* Your fraction */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("Your fraction", "तुम्हारी भिन्न")}</h3>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <NumIn label={t("Top", "ऊपर")} value={raw[0]} onChange={(v) => setAt(0, v)} hideLabel />
          <span className="text-2xl font-light text-slate-400 dark:text-slate-500">/</span>
          <NumIn label={t("Bottom", "नीचे")} value={raw[1]} onChange={(v) => setAt(1, v)} hideLabel />
        </div>
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map(([a, b]) => ({ label: `${a}/${b}`, onClick: () => setRaw([String(a), String(b)]) }))} />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Last digit: bottom ends in 1 → 9, 3 → 3, 7 → 7, 9 → 1 (so that the product ends in 9).", "आख़िरी अंक: नीचे 1 पर → 9, 3 → 3, 7 → 7, 9 → 1 (ताकि गुणनफल 9 पर ख़त्म हो)।")}</li>
          <li>{t("Remainders: ×10, then the remainder after dividing by the bottom number.", "शेषफल: ×10, फिर नीचे वाले नंबर से भाग का शेष।")}</li>
          <li>{t("The cycle ends when the first remainder comes back.", "चक्र तब ख़त्म होता है जब पहला शेष वापस आता है।")}</li>
        </ul>
      </Card>
    </div>
  );
};
