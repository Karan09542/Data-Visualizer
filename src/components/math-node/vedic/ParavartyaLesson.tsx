import React, { useState } from "react";
import { FitWidth, NumberBoxes, boxTone, type BoxTone } from "./NumberBoxes";
import { planParavartya, transposeAndApply, type Contribution, type ParavartyaPlan } from "./paravartya";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { GlanceAnimation, type AnimTrack } from "./GlanceAnimation";

const EXAMPLES: [string, number][] = [
  ["1234", 12],
  ["7891", 13],
  ["2025", 11],
  ["12345", 112],
  ["23456", 1013],
  ["98765", 121],
];

const MINUS = "−";
const num = (v: number) => (v < 0 ? `${MINUS}${-v}` : String(v));
const term = (v: number) => (v < 0 ? ` ${MINUS} ${-v}` : ` + ${v}`);

/** One box of the division grid. */
const Cell: React.FC<{ v: string; tone?: BoxTone; dim?: boolean; id?: string }> = ({ v, tone = "plain", dim, id }) => (
  <span
    data-anim={id}
    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-[15px] font-medium tabular-nums transition-opacity ${boxTone(tone)} ${dim ? "opacity-40" : ""}`}
  >
    {v}
  </span>
);

interface GridData {
  divisorLabel: string;
  transposed: number[];
  digits: (number | string)[];
  quotientColumns: number;
  contributions: Contribution[][];
  sums: number[];
}

/**
 * The working, the way it's written by hand: the divisor and its transposed digits
 * on the left, the dividend with its remainder columns split off, the products of
 * each quotient digit under the columns after it, and every column's total.
 */
const DivisionGrid: React.FC<{
  g: GridData;
  /** Quotient columns done so far (their products and totals show). */
  upto: number;
  /** Totals of the remainder columns show. */
  remainderDone?: boolean;
  /** The column being worked on, highlighted. */
  current?: number;
  /** Give every piece a data-anim handle, for the animated example. */
  anim?: boolean;
}> = ({ g, upto, remainderDone, current, anim }) => {
  const id = (name: string) => (anim ? name : undefined);
  const m = g.digits.length;
  const k = g.transposed.length;
  // Columns: divisor, divider, quotient columns, divider, remainder columns.
  const col = (c: number) => (c < g.quotientColumns ? 3 + c : 4 + c);
  const sumRow = k + 3;
  const showSum = (c: number) => (c < g.quotientColumns ? c < upto : !!remainderDone);
  return (
    <div className="inline-grid items-center gap-x-1.5 gap-y-1.5" style={{ gridTemplateColumns: `auto 10px repeat(${g.quotientColumns}, auto) 10px repeat(${k}, auto)` }}>
      {/* The divisor, and under it the transposed digits. */}
      <div style={{ gridRow: 1, gridColumn: 1 }} className="flex justify-end">
        <Cell v={g.divisorLabel} id={id("dv")} />
      </div>
      {g.transposed.map((t, j) => (
        <div key={`t${j}`} style={{ gridRow: j + 2, gridColumn: 1 }} className="flex justify-end">
          <Cell v={num(t)} tone="carry" id={id(`t${j}`)} />
        </div>
      ))}
      <div data-anim={id("dl")} style={{ gridRow: `1 / ${sumRow + 1}`, gridColumn: 2 }} className="mx-auto h-full w-0.5 rounded bg-slate-300 dark:bg-slate-600" />
      <div data-anim={id("dr")} style={{ gridRow: `1 / ${sumRow + 1}`, gridColumn: 3 + g.quotientColumns }} className="mx-auto h-full w-0.5 rounded bg-orange-400 dark:bg-orange-500" />
      {/* The dividend. */}
      {g.digits.map((d, c) => (
        <div key={`d${c}`} style={{ gridRow: 1, gridColumn: col(c) }}>
          <Cell v={String(d)} tone={c === current ? "active" : "plain"} id={id(`d${c}`)} />
        </div>
      ))}
      {/* Products, one row per transposed digit. */}
      {g.contributions.flatMap((list, c) =>
        list
          .filter((x) => x.from < upto)
          .map((x) => (
            <div key={`p${c}-${x.j}`} style={{ gridRow: x.j + 1, gridColumn: col(c) }}>
              <Cell
                v={num(x.value)}
                tone={x.value < 0 ? "carry" : x.value > 0 ? "added" : "muted"}
                dim={current !== undefined && c !== current && x.from !== current}
                id={id(`p${c}-${x.j}`)}
              />
            </div>
          )),
      )}
      <div data-anim={id("rule")} style={{ gridRow: k + 2, gridColumn: `3 / ${4 + m}` }} className="mt-1 self-end border-t-2 border-slate-300 dark:border-slate-600" />
      {/* Column totals. */}
      {g.sums.map((s, c) =>
        showSum(c) ? (
          <div key={`s${c}`} style={{ gridRow: sumRow, gridColumn: col(c) }}>
            <Cell v={num(s)} tone={c < g.quotientColumns ? "done" : "active"} id={id(`s${c}`)} />
          </div>
        ) : null,
      )}
    </div>
  );
};

// ─── The animated example ─────────────────────────────────────────────────────

const GLANCE_CASES: { dividend: string; divisor: number; en: string; hi: string }[] = [
  { dividend: "1234", divisor: 12, en: "One digit, borrow", hi: "एक अंक, उधार" },
  { dividend: "12345", divisor: 112, en: "Two digits", hi: "दो अंक" },
  { dividend: "23456", divisor: 1013, en: "Three digits", hi: "तीन अंक" },
];

/** The script, from the plan: transpose, split, each quotient column, remainder, fix-up, answer. */
function glanceTracks(p: ParavartyaPlan): { tracks: AnimTrack[]; total: number } {
  const m = p.digits.length;
  const tracks: AnimTrack[] = [
    { id: "dv", kind: "fadeUp", at: 0 },
    { id: "lt", kind: "fadeUp", at: 300 },
    { id: "dl", kind: "fade", at: 300 },
    ...p.transposed.map((_, j): AnimTrack => ({ id: `t${j}`, kind: "pop", at: 350 + j * 110 })),
    ...p.digits.map((_, c): AnimTrack => ({ id: `d${c}`, kind: "fadeUp", at: 900 + c * 80 })),
  ];
  const split = 900 + m * 80 + 150;
  tracks.push({ id: "dr", kind: "fade", at: split }, { id: "ls", kind: "fadeUp", at: split }, { id: "rule", kind: "fade", at: split + 200 });
  let at = split + 700;
  for (let c = 0; c < p.quotientColumns; c++) {
    tracks.push({ id: `lc${c}`, kind: "fadeUp", at }, { id: `d${c}`, kind: "glow", at, dur: 800 }, { id: `s${c}`, kind: "pop", at: at + 250 });
    p.transposed.forEach((_, j) => {
      if (c + j + 1 < m) tracks.push({ id: `p${c + j + 1}-${j + 1}`, kind: "pop", at: at + 550 + j * 120 });
    });
    at += 1100;
  }
  tracks.push({ id: "lr", kind: "fadeUp", at });
  for (let c = p.quotientColumns; c < m; c++) tracks.push({ id: `d${c}`, kind: "glow", at, dur: 800 }, { id: `s${c}`, kind: "pop", at: at + 250 + (c - p.quotientColumns) * 110 });
  at += 1000;
  tracks.push({ id: "lf", kind: "fadeUp", at }, { id: "raw", kind: "fadeUp", at }, { id: "rawr-sep", kind: "fade", at }, { id: "rawr", kind: "fadeUp", at });
  if (p.shift !== 0) tracks.push({ id: "fix", kind: "draw", at: at + 300 }, { id: "fix-label", kind: "pop", at: at + 450 }, { id: "fix-head", kind: "fade", at: at + 800, dur: 150 });
  tracks.push({ id: "ans", kind: "fadeUp", at: at + 950 }, { id: "ansr-sep", kind: "fade", at: at + 950 }, { id: "ansr", kind: "fadeUp", at: at + 1000 });
  return { tracks, total: at + 2000 };
}

const ParavartyaGlance: React.FC<{ index: number; lang: Lang; gap: number }> = ({ index, lang, gap }) => {
  const t = tr(lang);
  const c = GLANCE_CASES[index] ?? GLANCE_CASES[0];
  const p = React.useMemo(() => planParavartya(c.dividend, c.divisor).plan!, [c.dividend, c.divisor]);
  const { tracks, total } = React.useMemo(() => glanceTracks(p), [p]);
  const g: GridData = { divisorLabel: String(p.divisor), transposed: p.transposed, digits: p.digits, quotientColumns: p.quotientColumns, contributions: p.contributions, sums: p.sums };
  const extra = String(p.divisor).slice(1);
  const lines: { id: string; strong: string; rest: string }[] = [
    { id: "lt", strong: `${p.divisor} = ${p.base} + ${Number(extra)}`, rest: t(`transpose: ${p.transposed.map(num).join(", ")}`, `पलटो: ${p.transposed.map(num).join(", ")}`) },
    { id: "ls", strong: `${p.dividend.slice(0, p.quotientColumns)} | ${p.dividend.slice(p.quotientColumns)}`, rest: t("split off the remainder columns", "शेषफल वाले कॉलम अलग") },
    ...Array.from({ length: p.quotientColumns }, (_, col) => ({
      id: `lc${col}`,
      strong: col === 0 ? `${p.digits[0]}` : `${p.digits[col]}${p.contributions[col].map((x) => term(x.value)).join("")} = ${num(p.sums[col])}`,
      rest: col === 0 ? t("bring down the first digit", "पहला अंक नीचे") : t(`quotient digit ${col + 1}`, `भागफल का ${col + 1}वाँ अंक`),
    })),
    {
      id: "lr",
      strong: p.digits
        .slice(p.quotientColumns)
        .map((dg, i) => {
          const col = p.quotientColumns + i;
          return `${dg}${p.contributions[col].map((x) => term(x.value)).join("")} = ${num(p.sums[col])}`;
        })
        .join(", "),
      rest: t("the remainder columns", "शेषफल वाले कॉलम"),
    },
    {
      id: "lf",
      strong: `${p.rawQuotient} R ${num(p.rawRemainder)} → ${p.quotient} R ${p.remainder}`,
      rest:
        p.shift < 0
          ? t(`negative remainder: borrow ${-p.shift} × ${p.divisor}`, `शेष माइनस: ${-p.shift} × ${p.divisor} उधार`)
          : p.shift > 0
            ? t(`remainder too big: carry ${p.shift}`, `शेष ज़्यादा: ${p.shift} आगे`)
            : t("already a proper remainder", "शेषफल पहले से ठीक"),
    },
  ];
  return (
    <GlanceAnimation key={`${index}-${gap}`} tracks={tracks} total={total} lang={lang}>
      <FitWidth>
        <div className="flex items-center gap-x-6">
          <DivisionGrid g={g} upto={p.quotientColumns} remainderDone anim />
          <div className="flex flex-col items-start gap-3">
            <NumberBoxes
              groups={[
                { id: "raw", digits: num(p.rawQuotient), tone: "muted" },
                { id: "rawr", digits: num(p.rawRemainder), tone: "muted", sepBefore: "R" },
              ]}
              arrows={p.shift !== 0 ? [{ id: "fix", from: 1, to: 0, label: p.shift < 0 ? `${MINUS}${-p.shift}` : `+${p.shift}` }] : undefined}
              gap={gap}
            />
            <NumberBoxes
              groups={[
                { id: "ans", digits: String(p.quotient), tone: "answer", caption: t("quotient", "भागफल") },
                { id: "ansr", digits: String(p.remainder), tone: "active", sepBefore: "R", caption: t("remainder", "शेषफल") },
              ]}
              gap={gap}
              size="lg"
            />
          </div>
        </div>
      </FitWidth>
      <ul className={`mt-3 flex flex-col gap-1 tabular-nums ${BODY}`}>
        {lines.map((l) => (
          <li key={l.id} data-anim={l.id}>
            <b className={STRONG}>{l.strong}</b> → {l.rest}
          </li>
        ))}
      </ul>
    </GlanceAnimation>
  );
};

/** Paravartya Yojayet: dividing by numbers just above 10, 100, 1000, and other uses. */
export const ParavartyaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [n, setN] = useState("1234");
  const [d, setD] = useState("12");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();
  const [glanceCase, setGlanceCase] = useState(0);

  const res = n && d ? planParavartya(n, Number(d)) : null;
  const plan: ParavartyaPlan | undefined = res?.plan;
  const error = !n || !d
    ? t("Type both numbers.", "दोनों नंबर लिखो।")
    : res?.miss?.reason === "divisor"
      ? t("Use a divisor that starts with 1 and is a little above 10, 100 or 1000: 12, 112, 1013…", "ऐसा भाजक लो जो 1 से शुरू हो और 10, 100 या 1000 से थोड़ा बड़ा हो: 12, 112, 1013…")
      : res?.miss?.reason === "short"
        ? t("The dividend needs more digits than the divisor has after its 1.", "भाज्य में भाजक के 1 के बाद वाले अंकों से ज़्यादा अंक चाहिए।")
        : res?.miss
          ? t("Use whole numbers (dividend up to 8 digits).", "पूरे नंबर लो (भाज्य 8 अंक तक)।")
          : null;

  const steps: StepView[] = [];
  if (plan) {
    const g: GridData = { divisorLabel: String(plan.divisor), transposed: plan.transposed, digits: plan.digits, quotientColumns: plan.quotientColumns, contributions: plan.contributions, sums: plan.sums };
    const extra = String(plan.divisor).slice(1);
    const qPart = plan.dividend.slice(0, plan.quotientColumns);
    const rPart = plan.dividend.slice(plan.quotientColumns);

    steps.push({
      title: t("Transpose the divisor", "भाजक को पलटो"),
      body: t(
        `${plan.divisor} = ${plan.base} + ${Number(extra)}. Write its extra digits ${[...extra].join(", ")} with the sign changed: ${plan.transposed.map(num).join(", ")}.`,
        `${plan.divisor} = ${plan.base} + ${Number(extra)}। इसके ऊपर वाले अंक ${[...extra].join(", ")} को उल्टे चिह्न से लिखो: ${plan.transposed.map(num).join(", ")}।`,
      ),
      visual: (
        <NumberBoxes
          groups={[
            { digits: String(plan.divisor) },
            { digits: String(plan.base), sepBefore: "=", tone: "muted" },
            { digits: extra, sepBefore: "+", tone: "added" },
            { cells: plan.transposed.map((v) => ({ v: num(v), tone: "carry" as BoxTone })), sepBefore: "→" },
          ]}
          gap={gap}
        />
      ),
    });
    steps.push({
      title: t("Split the dividend", "भाज्य को बाँटो"),
      body: t(
        plan.k > 1 ? `${plan.divisor} has ${plan.k} digits after its 1, so the last ${plan.k} digits of ${plan.dividend} go to the remainder: ${qPart} | ${rPart}.` : `${plan.divisor} has 1 digit after its 1, so the last digit of ${plan.dividend} goes to the remainder: ${qPart} | ${rPart}.`,
        `${plan.divisor} में 1 के बाद ${plan.k} अंक हैं, तो ${plan.dividend} के आख़िरी ${plan.k} अंक शेषफल के लिए: ${qPart} | ${rPart}।`,
      ),
      visual: (
        <FitWidth>
          <DivisionGrid g={g} upto={0} />
        </FitWidth>
      ),
    });

    for (let c = 0; c < plan.quotientColumns; c++) {
      const into = plan.contributions[c];
      const sum = plan.sums[c];
      const products = plan.transposed.map((tt) => `${num(sum)} × ${num(tt)} = ${num(sum * tt)}`).join(", ");
      steps.push({
        title: t(`Quotient digit ${c + 1}`, `भागफल का ${c + 1}वाँ अंक`),
        body: (
          <>
            <b className={STRONG}>
              {c === 0 ? t(`Bring down ${plan.digits[0]}.`, `${plan.digits[0]} नीचे लाओ।`) : `${plan.digits[c]}${into.map((x) => term(x.value)).join("")} = ${num(sum)}.`}
            </b>{" "}
            {t(`Multiply it by the transposed digit${plan.k > 1 ? "s" : ""}: ${products}, and write ${plan.k > 1 ? "them" : "it"} under the next column${plan.k > 1 ? "s" : ""}.`, `इसे पलटे अंक${plan.k > 1 ? "ों" : ""} से गुणा करो: ${products}, और अगले कॉलम में नीचे लिखो।`)}
          </>
        ),
        visual: (
          <FitWidth>
            <DivisionGrid g={g} upto={c + 1} current={c} />
          </FitWidth>
        ),
      });
    }

    steps.push({
      title: t("The remainder columns", "शेषफल वाले कॉलम"),
      body: (
        <span className="tabular-nums">
          {plan.digits
            .slice(plan.quotientColumns)
            .map((dg, i) => {
              const c = plan.quotientColumns + i;
              return `${dg}${plan.contributions[c].map((x) => term(x.value)).join("")} = ${num(plan.sums[c])}`;
            })
            .join(";  ")}
        </span>
      ),
      visual: (
        <FitWidth>
          <DivisionGrid g={g} upto={plan.quotientColumns} remainderDone />
        </FitWidth>
      ),
    });

    const qDigits = plan.sums.slice(0, plan.quotientColumns);
    const rDigits = plan.sums.slice(plan.quotientColumns);
    const odd = plan.sums.some((s) => s < 0 || s > 9);
    steps.push({
      title: t("Read off the quotient and remainder", "भागफल और शेषफल पढ़ो"),
      body: (
        <span className="tabular-nums">
          {t("Quotient ", "भागफल ")}
          <b className={STRONG}>{qDigits.map(num).join(" | ")}</b> = {plan.rawQuotient}, {t("remainder ", "शेषफल ")}
          <b className={STRONG}>{rDigits.map(num).join(" | ")}</b> = {plan.rawRemainder}
          {odd ? t(" (read as place values, like the Balancing Rule).", " (स्थानीय मान से पढ़ो, संतुलन नियम की तरह)।") : "."}
        </span>
      ),
      visual: (
        <NumberBoxes
          groups={[
            { digits: num(plan.rawQuotient), tone: "done", caption: t("quotient", "भागफल") },
            { digits: num(plan.rawRemainder), tone: "active", sepBefore: "R", caption: t("remainder", "शेषफल") },
          ]}
          gap={gap}
        />
      ),
    });

    if (plan.shift !== 0) {
      const s = plan.shift;
      steps.push({
        title: s < 0 ? t("Negative remainder: borrow", "शेषफल माइनस: उधार लो") : t("Remainder too big: carry", "शेषफल ज़्यादा: आगे भेजो"),
        body:
          s < 0
            ? t(
              `${plan.rawRemainder} is negative: take ${-s} from the quotient (${plan.rawQuotient} − ${-s} = ${plan.quotient}) and add ${-s} × ${plan.divisor} to the remainder (${plan.rawRemainder} + ${-s * plan.divisor} = ${plan.remainder}).`,
              `${plan.rawRemainder} माइनस है: भागफल से ${-s} लो (${plan.rawQuotient} − ${-s} = ${plan.quotient}) और शेषफल में ${-s} × ${plan.divisor} जोड़ो (${plan.rawRemainder} + ${-s * plan.divisor} = ${plan.remainder})।`,
            )
            : t(
              `${plan.rawRemainder} is ${plan.divisor} or more: it holds ${s} more ${plan.divisor}${s > 1 ? "s" : ""}. Quotient ${plan.rawQuotient} + ${s} = ${plan.quotient}, remainder ${plan.rawRemainder} − ${s * plan.divisor} = ${plan.remainder}.`,
              `${plan.rawRemainder}, ${plan.divisor} या उससे ज़्यादा है: इसमें ${s} और ${plan.divisor} आते हैं। भागफल ${plan.rawQuotient} + ${s} = ${plan.quotient}, शेषफल ${plan.rawRemainder} − ${s * plan.divisor} = ${plan.remainder}।`,
            ),
        visual: (
          <NumberBoxes
            groups={[
              { digits: num(plan.rawQuotient), tone: "muted" },
              { digits: num(plan.rawRemainder), tone: "muted", sepBefore: "R" },
              { digits: String(plan.quotient), tone: "done", sepBefore: "→" },
              { digits: String(plan.remainder), tone: "active", sepBefore: "R" },
            ]}
            arrows={[{ from: 1, to: 0, label: s < 0 ? `${MINUS}${-s}` : `+${s}` }]}
            gap={gap}
          />
        ),
      });
    }

    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {plan.dividend} ÷ {plan.divisor} = {plan.quotient} {t("remainder", "शेष")} {plan.remainder}. {t("Check: ", "जाँच: ")}
          {plan.divisor} × {plan.quotient} + {plan.remainder} = {plan.divisor * plan.quotient + plan.remainder} ✓
        </span>
      ),
      visual: (
        <NumberBoxes
          groups={[
            { digits: String(plan.quotient), tone: "answer", caption: t("quotient", "भागफल") },
            { digits: String(plan.remainder), tone: "active", sepBefore: "R", caption: t("remainder", "शेषफल") },
          ]}
          gap={gap}
          size="lg"
        />
      ),
    });
  }

  // The rule card's example, and the polynomial one.
  const glance = planParavartya("1234", 12).plan!;
  const glanceGrid: GridData = { divisorLabel: "12", transposed: glance.transposed, digits: glance.digits, quotientColumns: glance.quotientColumns, contributions: glance.contributions, sums: glance.sums };
  const poly = transposeAndApply([1, 5, 6], [-2]);
  const polyGrid: GridData = { divisorLabel: "x+2", transposed: [-2], digits: [1, 5, 6], ...poly };

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("paravartya", lang)}
        subtitle={t("Divide by numbers just above 10, 100, 1000 (12, 112, 1013): quotient and remainder in one go.", "10, 100, 1000 से थोड़ा बड़े नंबरों (12, 112, 1013) से भाग: भागफल और शेषफल एक बार में।")}
      />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ol className={`mt-2 flex list-decimal flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("The divisor starts with 1: the rest is how much it is over the base (12 = 10 + 2).", "भाजक 1 से शुरू होता है: बाकी बताता है कि वो बेस से कितना ज़्यादा है (12 = 10 + 2)।")}</li>
          <li>
            <b className={STRONG}>{t("Transpose", "पलटो")}</b>: {t("write those extra digits with the sign changed (2 → −2).", "उन ऊपर वाले अंकों को उल्टे चिह्न से लिखो (2 → −2)।")}
          </li>
          <li>{t("Split the dividend: its last digits (as many as the divisor has after the 1) are for the remainder.", "भाज्य को बाँटो: आख़िरी अंक (जितने भाजक में 1 के बाद) शेषफल के लिए।")}</li>
          <li>
            <b className={STRONG}>{t("Apply", "लगाओ")}</b>:{" "}
            {t("bring down the first digit; multiply each new quotient digit by the transposed digits and write the results under the next columns; add down each column.", "पहला अंक नीचे लाओ; हर नए भागफल अंक को पलटे अंकों से गुणा करके अगले कॉलम में लिखो; हर कॉलम को नीचे की तरफ़ जोड़ो।")}
          </li>
          <li>{t("A negative remainder borrows one divisor from the quotient.", "शेषफल माइनस हो तो भागफल से एक भाजक उधार लो।")}</li>
        </ol>
        {animate ? (
          <div className="mt-4 flex flex-col gap-3">
            <div role="radiogroup" aria-label={t("Example", "उदाहरण")} className="flex flex-wrap gap-1.5">
              {GLANCE_CASES.map((gc, i) => {
                const on = i === glanceCase;
                return (
                  <button
                    key={gc.dividend}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setGlanceCase(i)}
                    className={`h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                      }`}
                  >
                    {lang === "hi" ? gc.hi : gc.en}
                    <span className={`ml-1.5 tabular-nums ${on ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>
                      {gc.dividend} ÷ {gc.divisor}
                    </span>
                  </button>
                );
              })}
            </div>
            <ParavartyaGlance index={glanceCase} lang={lang} gap={gap} />
          </div>
        ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <FitWidth>
            <DivisionGrid g={glanceGrid} upto={glance.quotientColumns} remainderDone />
          </FitWidth>
          <div className={`flex flex-col gap-1 tabular-nums ${BODY}`}>
            <span>
              <b className={STRONG}>1234 ÷ 12</b>
            </span>
            <span>{t("quotient 1 0 3, remainder −2", "भागफल 1 0 3, शेष −2")}</span>
            <span>{t("borrow one 12:", "एक 12 उधार:")}</span>
            <span>
              <b className={STRONG}>{t("102, remainder 10", "102, शेष 10")}</b>
            </span>
          </div>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Paravartya Yojayet means \"transpose and apply\": flip the sign of the divisor's extra part, then apply it to the dividend. Division becomes a few small multiplications and additions.",
            "परावर्त्य योजयेत् यानी \"पलटो और लगाओ\": भाजक के ऊपर वाले हिस्से का चिह्न पलटो, फिर उसे भाज्य पर लगाओ। भाग बस कुछ छोटे गुणा और जोड़ बन जाता है।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" aria-label={t("Dividend", "भाज्य")} className={`${INPUT} w-32`} />
            <span className="text-xl text-slate-400 dark:text-slate-500">÷</span>
            <input value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("Divisor", "भाजक")} className={`${INPUT} w-24`} />
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES.map(([p, q]) => ({
              label: `${p} ÷ ${q}`,
              onClick: () => {
                setN(p);
                setD(String(q));
              },
            }))}
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      {/* Other uses of the same idea */}
      <Card title={t("Other uses", "और कहाँ काम आता है")}>
        <div className="mt-2 grid gap-5 @lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t("Solving equations", "समीकरण हल करना")}</h4>
            <p className={BODY}>{t("Move a term across the = and flip its sign:", "किसी टर्म को = के पार ले जाओ और उसका चिह्न पलट दो:")}</p>
            <div className="flex flex-col gap-1 font-medium tabular-nums text-slate-800 dark:text-slate-200">
              <span>2x + 3 = x + 7</span>
              <span>
                2x <span className="rounded bg-rose-50 px-1 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">− x</span> = 7{" "}
                <span className="rounded bg-rose-50 px-1 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">− 3</span>
              </span>
              <span className="text-emerald-700 dark:text-emerald-300">x = 4</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t("Dividing polynomials", "बहुपद का भाग")}</h4>
            <p className={BODY}>
              {t(
                "(x² + 5x + 6) ÷ (x + 2): transpose +2 → −2 and apply it to the coefficients 1, 5, 6. Quotient x + 3, remainder 0.",
                "(x² + 5x + 6) ÷ (x + 2): +2 को पलटकर −2, और उसे गुणांक 1, 5, 6 पर लगाओ। भागफल x + 3, शेष 0।",
              )}
            </p>
            <FitWidth>
              <DivisionGrid g={polyGrid} upto={polyGrid.quotientColumns} remainderDone />
            </FitWidth>
          </div>
        </div>
      </Card>

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("It suits divisors a little above 10, 100, 1000 that start with 1.", "ये 1 से शुरू होने वाले, 10, 100, 1000 से थोड़ा बड़े भाजकों के लिए है।")}</li>
          <li>{t("The remainder gets as many columns as the divisor has digits after the 1.", "शेषफल को उतने कॉलम मिलते हैं जितने भाजक में 1 के बाद अंक।")}</li>
          <li>{t("Totals can be negative or above 9: read them as place values, then fix the remainder.", "जोड़ माइनस या 9 से ज़्यादा हो सकते हैं: स्थानीय मान से पढ़ो, फिर शेषफल ठीक करो।")}</li>
        </ul>
      </Card>
    </div>
  );
};
