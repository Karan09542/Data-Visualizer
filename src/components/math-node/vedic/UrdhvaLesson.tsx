import React, { useState } from "react";
import { FitWidth, NumberBoxes, type BoxArrow, type BoxCell, type BoxGroup } from "./NumberBoxes";
import { CrossDiagram, type CrossLine } from "./CrossDiagram";
import { GlanceAnimation, type AnimTrack } from "./GlanceAnimation";
import { planUrdhva, type UrdhvaColumn, type UrdhvaPlan } from "./urdhva";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";

const EXAMPLES: [number, number][] = [
  [23, 41],
  [67, 48],
  [12, 13],
  [123, 456],
  [123, 45],
  [304, 212],
  [999, 999],
];

/** A column's working: "2×1 + 3×4". */
const working = (p: UrdhvaPlan, c: UrdhvaColumn) => c.pairs.map(([i, j]) => `${p.top[i]}×${p.bottom[j]}`).join(" + ");
/** A slash value's boxes: a long one keeps the part that moves left together (443 → 44 | 3). */
const partCells = (part: string, tone?: BoxCell["tone"]): BoxCell[] =>
  part.length >= 3 ? [{ v: part.slice(0, -1), tone }, { v: part.slice(-1), tone }] : [...part].map((v) => ({ v, tone }));

// ─── The example at a glance: 23 × 41 ────────────────────────────────────────

const GLANCE_TRACKS: AnimTrack[] = [
  { id: "t0", kind: "fadeUp", at: 0 },
  { id: "t1", kind: "fadeUp", at: 100 },
  { id: "b0", kind: "fadeUp", at: 250 },
  { id: "b1", kind: "fadeUp", at: 350 },
  // Units: vertically, on the right.
  { id: "line1", kind: "fadeUp", at: 800 },
  { id: "t1", kind: "glow", at: 800 },
  { id: "b1", kind: "glow", at: 800 },
  { id: "l0", kind: "draw", at: 800 },
  { id: "s0", kind: "pop", at: 1350 },
  // Tens: crosswise.
  { id: "line2", kind: "fadeUp", at: 1950 },
  { id: "l1a", kind: "draw", at: 1950 },
  { id: "l1b", kind: "draw", at: 2100 },
  { id: "s0-sep", kind: "fade", at: 2650 },
  { id: "s1", kind: "pop", at: 2700 },
  // Hundreds: vertically, on the left.
  { id: "line3", kind: "fadeUp", at: 3300 },
  { id: "t0", kind: "glow", at: 3300 },
  { id: "b0", kind: "glow", at: 3300 },
  { id: "l2", kind: "draw", at: 3300 },
  { id: "s1-sep", kind: "fade", at: 3850 },
  { id: "s2", kind: "pop", at: 3900 },
  // Balance: 14 sends 1 left.
  { id: "line4", kind: "fadeUp", at: 4500 },
  { id: "bal", kind: "draw", at: 4500 },
  { id: "bal-label", kind: "pop", at: 4700 },
  { id: "bal-head", kind: "fade", at: 5050, dur: 150 },
  { id: "eq", kind: "fade", at: 5250 },
  { id: "ans", kind: "fadeUp", at: 5300 },
  { id: "r0", kind: "pop", at: 5450 },
  { id: "r1", kind: "pop", at: 5560 },
  { id: "r2", kind: "pop", at: 5670 },
];
const GLANCE_TOTAL = 6500;

const Glance: React.FC<{ lang: Lang; gap: number; animate: boolean }> = ({ lang, gap, animate }) => {
  const t = tr(lang);
  const lines: CrossLine[] = [
    { from: 1, to: 1, id: "l0" },
    { from: 0, to: 1, id: "l1a" },
    { from: 1, to: 0, id: "l1b" },
    { from: 0, to: 0, id: "l2" },
  ];
  const scene = (
    <>
      <FitWidth>
        <div className="flex items-center gap-x-4">
          <CrossDiagram
            top={[
              { v: "2", tone: "added", id: "t0" },
              { v: "3", tone: "added", id: "t1" },
            ]}
            bottom={[
              { v: "4", tone: "active", id: "b0" },
              { v: "1", tone: "active", id: "b1" },
            ]}
            lines={lines}
            sign="×"
          />
          <span className="text-2xl text-slate-300 dark:text-slate-600">→</span>
          {/* Left to right 8 / 14 / 3; worked right to left. */}
          <NumberBoxes
            groups={[
              { id: "s2", digits: "8", tone: "done", caption: "2×4" },
              { id: "s1", cells: [{ v: "1", tone: "carry" }, { v: "4", tone: "done" }], caption: "2×1+3×4" },
              { id: "s0", digits: "3", tone: "done", caption: "3×1" },
            ]}
            arrows={[{ id: "bal", from: 1, to: 0, label: "+1" }]}
            gap={gap}
            size="lg"
          />
          <span className="inline-flex items-center gap-x-4 pb-5">
            <span data-anim="eq" className="text-2xl text-slate-300 dark:text-slate-600">
              =
            </span>
            <NumberBoxes
              groups={[
                {
                  id: "ans",
                  tone: "answer",
                  cells: [
                    { v: "9", id: "r0" },
                    { v: "4", id: "r1" },
                    { v: "3", id: "r2" },
                  ],
                },
              ]}
              gap={gap}
              separator={null}
              size="lg"
            />
          </span>
        </div>
      </FitWidth>
      <ul className={`mt-3 flex flex-col gap-1 tabular-nums ${BODY}`}>
        {[
          { id: "line1", strong: "3 × 1 = 3", rest: t("vertically, on the right", "सीधा, दाईं तरफ़") },
          { id: "line2", strong: "2 × 1 + 3 × 4 = 14", rest: t("crosswise", "तिरछा") },
          { id: "line3", strong: "2 × 4 = 8", rest: t("vertically, on the left", "सीधा, बाईं तरफ़") },
          { id: "line4", strong: "8 / 14 / 3", rest: t("balance: 14 keeps 4, sends 1 left → 943", "बैलेंस: 14 अपना 4 रखता है, 1 बाएँ → 943") },
        ].map((l) => (
          <li key={l.id} data-anim={l.id}>
            <b className={STRONG}>{l.strong}</b> → {l.rest}
          </li>
        ))}
      </ul>
    </>
  );
  return animate ? (
    <GlanceAnimation key={gap} tracks={GLANCE_TRACKS} total={GLANCE_TOTAL} lang={lang}>
      {scene}
    </GlanceAnimation>
  ) : (
    <div className="mt-2">{scene}</div>
  );
};

/** The columns' pattern for 2- and 3-digit numbers, with letters: a b × c d. */
const Pattern: React.FC<{ digits: 2 | 3 }> = ({ digits }) => {
  const top = (digits === 2 ? ["a", "b"] : ["a", "b", "c"]).map((v): BoxCell => ({ v, tone: "added" }));
  const bottom = (digits === 2 ? ["c", "d"] : ["d", "e", "f"]).map((v): BoxCell => ({ v, tone: "active" }));
  const plan = planUrdhva(digits === 2 ? 11 : 111, digits === 2 ? 11 : 111)!;
  // Left to right, as the answer is written.
  const columns = [...plan.columns].reverse();
  return (
    <div className="flex flex-wrap items-start gap-4">
      {columns.map((c) => (
        <div key={c.k} className="flex flex-col items-center gap-1">
          <CrossDiagram top={top} bottom={bottom} lines={c.pairs.map(([i, j]) => ({ from: i, to: j }))} size="sm" />
          <span className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {c.pairs.map(([i, j]) => `${top[i].v}${bottom[j].v}`).join(" + ")}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Urdhva Tiryagbhyam: any multiplication, vertically and crosswise, one column at a time. */
export const UrdhvaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [a, setA] = useState("23");
  const [b, setB] = useState("41");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const x = Number(a);
  const y = Number(b);
  const plan = a && b ? planUrdhva(x, y) : null;
  const error = !a || !b ? t("Type the numbers.", "नंबर लिखो।") : !plan ? t("Use whole numbers from 1 to 9999.", "1 से 9999 तक के पूरे नंबर लो।") : null;

  const steps: StepView[] = [];
  if (plan) {
    const n = plan.top.length;
    const digitCells = (digits: number[], pad: number, tone: BoxCell["tone"], used?: Set<number>): BoxCell[] =>
      digits.map((d, i) => ({ v: String(d), tone: i < pad ? "muted" : used && !used.has(i) ? "plain" : tone }));

    if (plan.padTop || plan.padBottom) {
      const shorter = plan.padTop ? x : y;
      const padded = (plan.padTop ? plan.top : plan.bottom).join("");
      steps.push({
        title: t("Line them up", "दोनों को बराबर करो"),
        body: t(`${shorter} has fewer digits: write it as ${padded}, so both have ${n}.`, `${shorter} में अंक कम हैं: उसे ${padded} लिखो, ताकि दोनों में ${n} अंक हों।`),
        visual: <CrossDiagram top={digitCells(plan.top, plan.padTop, "added")} bottom={digitCells(plan.bottom, plan.padBottom, "active")} lines={[]} sign="×" />,
      });
    }

    plan.columns.forEach((c, idx) => {
      const vertical = c.pairs.length === 1;
      const usedTop = new Set(c.pairs.map(([i]) => i));
      const usedBottom = new Set(c.pairs.map(([, j]) => j));
      steps.push({
        title: vertical
          ? t(`Column ${idx + 1}: vertically`, `कॉलम ${idx + 1}: सीधा`)
          : t(`Column ${idx + 1}: crosswise (${c.pairs.length} pairs)`, `कॉलम ${idx + 1}: तिरछा (${c.pairs.length} जोड़े)`),
        body: (
          <b className={STRONG}>
            {working(plan, c)} = {c.sum}
          </b>
        ),
        visual: (
          <FitWidth>
            <div className="flex items-center gap-x-4">
              <CrossDiagram
                top={digitCells(plan.top, plan.padTop, "added", usedTop)}
                bottom={digitCells(plan.bottom, plan.padBottom, "active", usedBottom)}
                lines={c.pairs.map(([i, j]) => ({ from: i, to: j }))}
                sign="×"
              />
              <span className="text-2xl text-slate-300 dark:text-slate-600">=</span>
              <NumberBoxes groups={[{ digits: String(c.sum), tone: "done", caption: working(plan, c) }]} gap={gap} separator={null} />
            </div>
          </FitWidth>
        ),
      });
    });

    steps.push({
      title: t("Write the column totals", "कॉलम के जोड़ लिखो"),
      body: t(`Left to right, with slashes: ${plan.parts.join(" / ")}.`, `बाएँ से दाएँ, स्लैश के साथ: ${plan.parts.join(" / ")}।`),
      visual: <NumberBoxes groups={plan.parts.map((p) => ({ cells: partCells(p, "done") }))} gap={gap} />,
    });

    const { balanced } = plan;
    if (plan.parts.length > 1) {
      const arrows: BoxArrow[] = balanced.steps.filter((s) => s.index > 0 && s.carryOut > 0).map((s) => ({ from: s.index, to: s.index - 1, label: `+${s.carryOut}` }));
      steps.push({
        title: t("Balance (Balancing Rule)", "बैलेंस करो (संतुलन नियम)"),
        body: (
          <ul className="flex flex-col gap-0.5 tabular-nums">
            {balanced.steps.map((s) => (
              <li key={s.index}>
                <b className={STRONG}>{s.carryIn ? `${s.part.replace(/^0(?=\d)/, "")} + ${s.carryIn} = ${s.total}` : s.part.replace(/^0(?=\d)/, "")}</b>{" "}
                →{" "}
                {s.index === 0
                  ? t(`write ${s.keep}`, `${s.keep} लिखो`)
                  : s.carryOut
                    ? t(`keep ${s.keep}, send ${s.carryOut} left`, `${s.keep} रखो, ${s.carryOut} बाएँ भेजो`)
                    : t(`keep ${s.keep}`, `${s.keep} रखो`)}
              </li>
            ))}
          </ul>
        ),
        visual: <NumberBoxes groups={plan.parts.map((p): BoxGroup => ({ cells: partCells(p) }))} arrows={arrows} gap={gap} />,
      });
    }

    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {plan.parts.join(" / ")} → {plan.answer}. {t("Check: ", "जाँच: ")}
          {x} × {y} = {x * y} ✓
        </span>
      ),
      visual: <NumberBoxes groups={[{ digits: plan.answer, tone: "answer" }]} gap={gap} separator={null} size="lg" />,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("urdhva", lang)}
        subtitle={t("Multiply any two numbers, vertically and crosswise, one column at a time.", "कोई भी दो नंबरों का गुणा, सीधा और तिरछा, एक-एक कॉलम करके।")}
      />

      {/* The rule first */}
      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <ol className={`mt-2 flex list-decimal flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Write one number under the other (0s in front of the shorter one).", "एक नंबर के नीचे दूसरा लिखो (छोटे वाले के आगे 0 लगाकर)।")}</li>
          <li>
            {t("One column at a time from the right, multiply the digits that meet there, ", "दाईं तरफ़ से एक-एक कॉलम: वहाँ मिलने वाले अंकों का गुणा करो, ")}
            <b className={STRONG}>{t("straight down and across", "सीधा और तिरछा")}</b>
            {t(", and add them.", ", और जोड़ दो।")}
          </li>
          <li>{t("Write the totals as slash values, then use the Balancing Rule.", "जोड़ों को स्लैश के साथ लिखो, फिर संतुलन नियम लगाओ।")}</li>
        </ol>
        <div className="mt-4">
          <Glance lang={lang} gap={gap} animate={animate} />
        </div>
      </Card>

      <div className="grid gap-3 @lg:grid-cols-2">
        <Card title={t("Why this name", "ये नाम क्यों")}>
          <p className={`mt-1 ${BODY}`}>
            {t(
              "Urdhva means \"vertically\" and Tiryak \"crosswise\": the digits are multiplied straight down and across. It works for any two numbers, the general way of Vedic multiplication.",
              "ऊर्ध्व यानी \"सीधा\" (ऊपर-नीचे) और तिर्यक यानी \"तिरछा\": अंकों का गुणा सीधा और तिरछा होता है। ये कोई भी दो नंबरों के लिए चलता है, वैदिक गुणा का आम तरीका।",
            )}
          </p>
        </Card>
        <Card title={t("How it's written", "कैसे लिखते हैं")}>
          <p className={`mt-1 ${BODY}`}>{t("One slash value per column, left to right: 23 × 41 → 8 / 14 / 3 → 943.", "हर कॉलम का एक हिस्सा, बाएँ से दाएँ: 23 × 41 → 8 / 14 / 3 → 943।")}</p>
          <div className="mt-3 overflow-x-auto">
            <NumberBoxes groups={[{ digits: "8" }, { cells: [{ v: "1", tone: "carry" }, { v: "4" }] }, { digits: "3" }]} gap={gap} size="sm" />
          </div>
        </Card>
      </div>

      {/* The patterns */}
      <Card title={t("The pattern", "पैटर्न")}>
        <p className={`mt-1 ${BODY}`}>{t("2 digits: 3 columns, | X |", "2 अंक: 3 कॉलम, | X |")}</p>
        <div className="mt-2 overflow-x-auto">
          <Pattern digits={2} />
        </div>
        <p className={`mt-4 ${BODY}`}>{t("3 digits: 5 columns, | X ✳ X |", "3 अंक: 5 कॉलम, | X ✳ X |")}</p>
        <div className="mt-2 overflow-x-auto">
          <Pattern digits={3} />
        </div>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("First number", "पहला नंबर")} className={`${INPUT} w-24`} />
            <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
            <input value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label={t("Second number", "दूसरा नंबर")} className={`${INPUT} w-24`} />
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES.map(([p, q]) => ({
              label: `${p} × ${q}`,
              onClick: () => {
                setA(String(p));
                setB(String(q));
              },
            }))}
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Work from the right; each column adds every pair that meets there.", "दाईं तरफ़ से काम करो; हर कॉलम में वहाँ मिलने वाले सारे जोड़े जुड़ते हैं।")}</li>
          <li>{t("n digits make 2n − 1 columns: 2 digits → 3, 3 digits → 5.", "n अंक से 2n − 1 कॉलम: 2 अंक → 3, 3 अंक → 5।")}</li>
          <li>{t("Totals bigger than 9 are fine: the Balancing Rule settles them at the end.", "9 से बड़े जोड़ भी ठीक हैं: आख़िर में संतुलन नियम उन्हें ठीक कर देता है।")}</li>
        </ul>
      </Card>
    </div>
  );
};
