import React, { useState } from "react";
import { FitWidth, NumberBoxes, type BoxCell, type BoxGroup, type BoxTone } from "./NumberBoxes";
import { planBase, type BasePlan } from "./base";
import { methodName } from "./methods";
import { BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, StepList, tr, useBoxGap, type Lang, type StepView } from "./ui";

const EXAMPLES = ["7", "12", "88", "357", "997", "350", "3.456", "45.78", "0.375"];
/** Complement examples: n → base − n. */
const COMPLEMENTS = ["12", "7", "357", "997", "3.456"];
const RULE_ROWS = ["7", "12", "123", "4567"];

/** A number as boxes, its decimal point (if any) between the whole part and the decimals. */
const numberGroups = (text: string, tone?: BoxTone, sepBefore?: string | null, caption?: string): BoxGroup[] => {
  const [whole, frac] = text.split(".");
  return frac === undefined
    ? [{ digits: whole, tone, sepBefore, caption }]
    : [
      { digits: whole, tone, sepBefore },
      { digits: frac, tone, sepBefore: ".", caption },
    ];
};

/** The base as boxes: a 1, then one blue zero for each digit of the number. */
const baseCells = (digits: number): BoxCell[] => [{ v: "1" }, ...Array.from({ length: digits }, (): BoxCell => ({ v: "0", tone: "added" }))];

/** Base: the power of 10 a number is measured from, and its complement, base − n. */
export const BaseLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [n, setN] = useState("12");
  const [spaced, setSpaced, gap] = useBoxGap();

  const plan: BasePlan | null = planBase(n);
  const error =
    n === ""
      ? t("Type a number.", "कोई नंबर लिखो।")
      : !plan
        ? t("Type a number above 0, like 357 or 3.456 (up to 8 digits, 6 decimals).", "0 से बड़ा कोई नंबर लिखो, जैसे 357 या 3.456 (8 अंक तक, 6 दशमलव तक)।")
        : null;
  const digitWord = (k: number) => (k === 1 ? t("1 digit", "1 अंक") : t(`${k} digits`, `${k} अंक`));
  const zeroWord = (k: number) => (k === 1 ? t("1 zero", "1 शून्य") : t(`${k} zeros`, `${k} शून्य`));

  /** One column per digit: 9 − 3 (or 10 − 7) over the result; the decimal point keeps its place. */
  const columns = (p: BasePlan) => (
    <div className="flex items-start gap-2 @md:gap-3">
      {p.steps.map((s, i) => (
        <React.Fragment key={i}>
          {p.point === i && (
            // The point, level with the digits above and below.
            <div className="flex flex-col items-center gap-1" aria-label="decimal point">
              <span className="text-xs">&nbsp;</span>
              <span className="flex h-8 items-end text-2xl font-semibold leading-none text-slate-500 @md:h-10 dark:text-slate-400">.</span>
              <span className="text-xs">&nbsp;</span>
              <span className="flex h-8 items-end text-2xl font-semibold leading-none text-slate-500 @md:h-10 dark:text-slate-400">.</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            <span className={`text-xs font-semibold tabular-nums ${s.kind === "ten" ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
              {s.kind === "nine" ? "9 −" : s.kind === "ten" ? "10 −" : s.kind === "keep" ? t("stays", "वैसा ही") : "0"}
            </span>
            <NumberBoxes groups={[{ digits: String(s.digit), tone: s.kind === "keep" ? "muted" : "added" }]} gap={gap} separator={null} />
            <span className="text-xs text-slate-300 dark:text-slate-600">↓</span>
            <NumberBoxes groups={[{ digits: String(s.result), tone: s.kind === "zero" || s.kind === "keep" ? "muted" : "done" }]} gap={gap} separator={null} />
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  const steps: StepView[] = [];
  if (plan) {
    const decimal = plan.point !== null;
    steps.push({
      title: decimal ? t("Count the digits before the point", "दशमलव से पहले के अंक गिनो") : t("Count the digits", "अंक गिनो"),
      body:
        plan.digits === 0
          ? t(`${plan.n} is less than 1: no digits before the point.`, `${plan.n}, 1 से कम है: दशमलव से पहले कोई अंक नहीं।`)
          : decimal
            ? t(`${plan.n} has ${digitWord(plan.digits)} before the point. Only those count for the base.`, `${plan.n} में दशमलव से पहले ${digitWord(plan.digits)} हैं। बेस के लिए बस वही गिने जाते हैं।`)
            : t(`${plan.n} has ${digitWord(plan.digits)}.`, `${plan.n} में ${digitWord(plan.digits)} हैं।`),
      visual: (
        <NumberBoxes
          groups={decimal ? [{ digits: plan.n.split(".")[0], tone: "added", caption: digitWord(plan.digits) }, { digits: plan.n.split(".")[1], tone: "muted", sepBefore: "." }] : [{ digits: plan.n, tone: "added", caption: digitWord(plan.digits) }]}
          gap={gap}
          separator={null}
        />
      ),
    });
    steps.push({
      title: plan.digits === 0 ? t("The base: 1", "बेस: 1") : t(`The base: 1 and ${zeroWord(plan.digits)}`, `बेस: 1 और ${zeroWord(plan.digits)}`),
      body:
        plan.digits === 0
          ? t("No digits before the point, so no zeros: the base is 1.", "दशमलव से पहले कोई अंक नहीं, तो कोई शून्य नहीं: बेस है 1।")
          : t(`One zero for each digit: the base is ${plan.base}.`, `हर अंक के लिए एक शून्य: बेस है ${plan.base}।`),
      visual: <NumberBoxes groups={[{ cells: baseCells(plan.digits), caption: zeroWord(plan.digits) }]} gap={gap} separator={null} />,
    });
    steps.push({
      title: t("The complement: all from 9, the last from 10", "पूरक: सब 9 में से, आख़िरी 10 में से"),
      body: (
        <>
          {plan.steps
            .filter((s) => s.kind === "nine" || s.kind === "ten")
            .map((s) => `${s.kind === "ten" ? 10 : 9} − ${s.digit} = ${s.result}`)
            .join(", ")}
          {plan.steps.some((s) => s.kind === "zero") && t(". A 0 at the end stays 0.", "। आख़िर का 0, 0 ही रहता है।")}
          {decimal && t(". The point stays where it is.", "। दशमलव अपनी जगह पर ही रहता है।")}
        </>
      ),
      visual: columns(plan),
    });
    const leadingZeros = !decimal && /^0/.test(plan.deficiency);
    steps.push({
      title: t("Complement = base − n", "पूरक = बेस − n"),
      body: (
        <span className="tabular-nums">
          <b className={STRONG}>
            {plan.base} − {plan.n} = {plan.deficiency}
          </b>
          {leadingZeros && t(`: keep the zeros, as many digits as the base has zeros. `, `: शून्य रहने दो, जितने बेस में शून्य उतने अंक। `)}
          {!leadingZeros && ". "}
          {t("Check: ", "जाँच: ")}
          {plan.n} + {plan.deficiency} = {plan.base} ✓
        </span>
      ),
      visual: <NumberBoxes groups={numberGroups(plan.deficiency, "answer")} gap={gap} separator={null} size="lg" />,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("base", lang)}
        subtitle={t("The 10, 100 or 1000 a number is measured from, and its complement: base − n.", "वो 10, 100 या 1000 जिससे किसी नंबर को नापते हैं, और उसका पूरक: बेस − n।")}
      />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Base = 1 followed by one zero for each digit.", "बेस = 1, और हर अंक के लिए एक शून्य।")}</b>
        </p>
        {/* Number → base, the count of digits and zeros under the base: fits a phone too. */}
        <div className="mt-3 grid w-max max-w-full grid-cols-[auto_auto_auto] items-start gap-x-3 gap-y-1 overflow-x-auto">
          {RULE_ROWS.map((num) => (
            <React.Fragment key={num}>
              <div className="flex justify-end">
                <NumberBoxes groups={[{ digits: num, tone: "added" }]} gap={gap} separator={null} size="sm" />
              </div>
              <span className="pt-1 text-slate-400 dark:text-slate-500">→</span>
              <NumberBoxes
                groups={[{ cells: baseCells(num.length), caption: `${digitWord(num.length)} → ${zeroWord(num.length)}` }]}
                gap={gap}
                separator={null}
                size="sm"
              />
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* The complement: base − n */}
      <Card title={t("Complement", "पूरक")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Complement = base(n) − n", "पूरक = बेस(n) − n")}</b>
          {t(": how much n is short of its base. For n = 12 the base is 100, so the complement is 100 − 12 = 88.", ": n अपने बेस से कितना कम है। n = 12 का बेस 100 है, तो पूरक = 100 − 12 = 88।")}
        </p>
        {/* Scaled as one block on a narrow screen, so every row keeps the same size. */}
        <div className="mt-3">
        <FitWidth>
        <div className="flex flex-col gap-2">
          {COMPLEMENTS.map((num) => {
            const p = planBase(num)!;
            return (
              <div key={num} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-[13px] tabular-nums text-slate-500 dark:text-slate-400">n = {num}</span>
                <NumberBoxes
                  groups={[...numberGroups(p.base), ...numberGroups(p.n, "added", "−"), ...numberGroups(p.deficiency, "done", "=")]}
                  gap={gap}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
        </FitWidth>
        </div>
      </Card>

      <div className="grid gap-3 @lg:grid-cols-2">
        <Card title={t("Why a base", "बेस क्यों")}>
          <p className={`mt-1 ${BODY}`}>
            {t(
              "Many Vedic shortcuts (like Nikhilam) measure each number from a base; the complement says how much less it is. A base is easy to work with, because multiplying by it only adds zeros.",
              "कई वैदिक शॉर्टकट (जैसे निखिलम्) हर नंबर को बेस से नापते हैं; पूरक बताता है कि नंबर कितना कम है। बेस के साथ काम आसान है, क्योंकि उससे गुणा करने पर बस शून्य जुड़ते हैं।",
            )}
          </p>
        </Card>
        <Card title={t("Quick complement: all from 9, the last from 10", "पूरक जल्दी: सब 9 में से, आख़िरी 10 में से")}>
          <p className={`mt-1 ${BODY}`}>
            {t("No subtracting from 1000: take every digit from 9, and the last one from 10. 357 → 643.", "1000 में से घटाना नहीं पड़ता: हर अंक 9 में से घटाओ, और आख़िरी 10 में से। 357 → 643।")}
          </p>
          <div className="mt-3 overflow-x-auto">{columns(planBase("357")!)}</div>
          <p className={`mt-4 ${BODY}`}>
            {t("Decimals too: 10 − 3.456 = 6.544. Take 3, 4, 5 from 9 and the last 6 from 10; the point stays where it is.", "दशमलव में भी: 10 − 3.456 = 6.544। 3, 4, 5 को 9 में से और आख़िरी 6 को 10 में से घटाओ; दशमलव अपनी जगह पर रहता है।")}
          </p>
          <div className="mt-3 overflow-x-auto">{columns(planBase("3.456")!)}</div>
        </Card>
      </div>

      {/* Your number */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              value={n}
              // Digits and one decimal point.
              onChange={(e) => {
                const [whole = "", ...rest] = e.target.value.replace(/[^\d.]/g, "").split(".");
                setN(rest.length ? `${whole.slice(0, 8)}.${rest.join("").slice(0, 6)}` : whole.slice(0, 8));
              }}
              inputMode="decimal"
              aria-label={t("Number", "नंबर")}
              className={`${INPUT} w-36`}
            />
            {plan && (
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                → {t("base", "बेस")} {plan.base}, {t("complement", "पूरक")} <b className={STRONG}>{plan.deficiency}</b>
              </span>
            )}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map((e) => ({ label: e, onClick: () => setN(e) }))} />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      {/* Numbers a little over a base */}
      <Card title={t("Just above a base", "बेस से थोड़ा ऊपर")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "A number a little more than a base is measured from that base instead: 104 is 100 + 4. Below a base we say \"less\" (97 = 100 − 3), above it \"more\" (104 = 100 + 4).",
            "जो नंबर किसी बेस से थोड़ा ज़्यादा हो, उसे उसी बेस से नापते हैं: 104 = 100 + 4। बेस से कम हो तो \"कम\" (97 = 100 − 3), ज़्यादा हो तो \"ज़्यादा\" (104 = 100 + 4)।",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 overflow-x-auto">
          {(
            [
              ["97", "100", "−", "3"],
              ["104", "100", "+", "4"],
              ["1003", "1000", "+", "3"],
            ] as const
          ).map(([num, base, sign, diff]) => (
            <NumberBoxes
              key={num}
              groups={[
                { digits: num },
                { digits: base, sepBefore: "=", tone: "added" },
                { digits: diff, sepBefore: sign, tone: sign === "−" ? "carry" : "done" },
              ]}
              gap={gap}
              size="sm"
            />
          ))}
        </div>
      </Card>

      <Card title={t("Remember", "याद रखो")}>
        <p className={`mt-1 ${BODY}`}>
          {t("The complement has as many digits as the base has zeros: 1000 − 997 = 003, not 3.", "पूरक में उतने अंक जितने बेस में शून्य: 1000 − 997 = 003, सिर्फ़ 3 नहीं।")}{" "}
          <button type="button" onClick={() => setN("997")} className="font-medium text-slate-900 underline underline-offset-2 dark:text-slate-100">
            {t("Try it", "आज़माओ")}
          </button>
        </p>
      </Card>
    </div>
  );
};
