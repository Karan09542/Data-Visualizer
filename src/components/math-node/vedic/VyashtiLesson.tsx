import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { polyText, sqrtQ, surdText, xPlusQ, type Root } from "./purana";
import { Q } from "./shunyam";
import { planFourth, planPairs, planProduct } from "./vyashti";
import { NumIn, Op, Row, Term, num } from "./equation";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, Card, Examples, GapSwitch, LessonHeader, StepList, STRONG, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { AnimatedExamples, stagger, type Beat, type GlanceCase } from "./beats";

type Mode = "product" | "fourth" | "pairs";

const q = (n: number) => new Q(n);
const xp = (a: number) => xPlusQ(q(a));
/** An exact half or quarter as a decimal: 101/2 → 50.5. */
const dec = (v: Q) => String(v.n / v.d).replace("-", "−");
/** "(x + 1)(x + 2)(x + 3)(x + 4) = 120" */
const pairsText = (e: number[]) => `${e.slice(0, 4).map((a) => `(${xp(a)})`).join("")} = ${num(e[4])}`;
const fourthText = (e: number[]) => `(${xp(e[0])})⁴ + (${xp(e[1])})⁴ = ${num(e[2])}`;

const EXAMPLES: Record<Mode, number[][]> = {
  product: [
    [47, 53],
    [98, 102],
    [36, 44],
    [59, 61],
    [23, 27],
    [46, 55],
  ],
  fourth: [
    [7, 5, 706],
    [4, 2, 82],
    [1, 5, 82],
    [3, 1, 16],
  ],
  pairs: [
    [1, 2, 3, 4, 120],
    [-1, 2, 3, 6, 160],
    [1, 3, 5, 7, 9],
    [1, 2, 4, 7, 10],
  ],
};
const MODES: { id: Mode; en: string; hi: string }[] = [
  { id: "product", en: "Multiply by the average", hi: "औसत से गुणा" },
  { id: "fourth", en: "Two fourth powers", hi: "दो चौथी घात" },
  { id: "pairs", en: "Four factors", hi: "चार गुणनखंड" },
];

// ─── The animated examples ────────────────────────────────────────────────────

function vyashtiCases(t: (en: string, hi: string) => string, gap: number): GlanceCase[] {
  const answerRow = (items: string[], prefix: string) => (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((v, i) => (
        <Row key={i}>
          <Term cells={[items.length > 1 ? `x${"₁₂₃₄"[i]}` : "x"]} gap={gap} />
          <Op>=</Op>
          <span data-anim={`${prefix}${i}`}>
            <NumberBoxes groups={[{ cells: [v], tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        </Row>
      ))}
    </div>
  );

  const product = (): Beat[] => {
    const [a, b] = [47, 53];
    const p = planProduct(a, b);
    return [
      {
        strong: `(${a} + ${b}) ÷ 2 = ${p.mean}`,
        rest: t("the whole: the average", "समष्टि: औसत"),
        visual: (
          <Row>
            <Term cells={[String(a)]} tone="active" gap={gap} />
            <Term cells={[String(b)]} tone="active" gap={gap} />
            <Op>→</Op>
            <span data-anim="vg-m">
              <Term cells={[p.mean.toString()]} tone="done" gap={gap} />
            </span>
          </Row>
        ),
        extra: [{ id: "vg-m", kind: "pop", at: 600 }],
        dur: 1600,
      },
      {
        strong: `${a} = ${p.mean} − ${p.half}, ${b} = ${p.mean} + ${p.half}`,
        rest: t("the parts: the whole ± a little", "व्यष्टि: पूरा ± थोड़ा"),
        visual: (
          <Row>
            <Term cells={[`${p.mean} − ${p.half}`]} tone="active" gap={gap} />
            <Op>×</Op>
            <Term cells={[`${p.mean} + ${p.half}`]} tone="active" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `${p.mean}² − ${p.half}² = ${p.meanSq} − ${p.halfSq}`,
        rest: t("whole² − part²", "समष्टि² − व्यष्टि²"),
        visual: (
          <Row>
            <Term cells={[p.meanSq.toString()]} tone="done" gap={gap} />
            <Op>−</Op>
            <Term cells={[p.halfSq.toString()]} tone="carry" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `${a} × ${b} = ${p.product}`,
        rest: t("the answer", "जवाब"),
        visual: (
          <span data-anim="vg-a">
            <NumberBoxes groups={[{ digits: p.product.toString(), tone: "answer" }]} gap={gap} separator={null} size="lg" />
          </span>
        ),
        extra: [{ id: "vg-a", kind: "pop", at: 300 }],
      },
    ];
  };

  const fourth = (): Beat[] => {
    const [a, b, c] = [7, 5, 706];
    const p = planFourth(a, b, c);
    const k = p.k.n < 0 ? p.k.mul(-1) : p.k;
    const yEq = polyText([q(2), q(0), p.B.mul(2), q(0), k.mul(k).mul(k).mul(k).mul(2)], "y");
    const ys = p.Ys!;
    return [
      {
        strong: `y = ${xPlusQ(p.m)}`,
        rest: t(`the whole: the middle of ${xp(a)} and ${xp(b)}`, `समष्टि: ${xp(a)} और ${xp(b)} का बीच`),
        visual: (
          <Row>
            <Term cells={["y"]} tone="done" gap={gap} />
            <Op>=</Op>
            <Term cells={[xPlusQ(p.m)]} tone="done" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `(y + ${k})⁴ + (y − ${k})⁴ = ${c}`,
        rest: t(`the parts are y ± ${k}`, `हिस्से y ± ${k} हैं`),
        visual: <Term cells={[`(y + ${k})⁴ + (y − ${k})⁴ = ${c}`]} tone="active" gap={gap} />,
      },
      { strong: `${yEq} = ${c}`, rest: t("the odd powers cancel", "विषम घातें कट जाती हैं"), visual: <Term cells={[`${yEq} = ${c}`]} tone="active" gap={gap} /> },
      {
        strong: `y² = ${ys.map((y) => y.Y.toString()).join(t(" or ", " या "))}`,
        rest: t("a quadratic in y²; a negative y² gives no real y", "y² में द्विघात; माइनस y² से असली y नहीं"),
        visual: (
          <Row>
            {ys.map((y, i) => (
              <Term key={i} cells={[`y² = ${y.Y}`]} tone={y.real ? "done" : "muted"} gap={gap} />
            ))}
          </Row>
        ),
      },
      {
        strong: `x = ${p.roots.map((r) => r.text).join(", ")}`,
        rest: t(`y = ±${surdText(sqrtQ(ys.find((y) => y.real)!.Y))}, x = y − ${p.m}`, `y = ±${surdText(sqrtQ(ys.find((y) => y.real)!.Y))}, x = y − ${p.m}`),
        visual: answerRow(
          p.roots.map((r) => r.text),
          "vg-x",
        ),
        extra: stagger(
          p.roots.map((_, i) => `vg-x${i}`),
          400,
          350,
        ),
        dur: 1700,
      },
    ];
  };

  const pairs = (): Beat[] => {
    const f: [number, number, number, number] = [1, 2, 3, 4];
    const e = 120;
    const p = planPairs(f, e);
    const [[i, j], [k, l]] = p.pairs!;
    const z = polyText([q(1), q(p.s), q(0)]);
    return [
      {
        strong: `${f[i]} + ${f[j]} = ${f[k]} + ${f[l]} = ${p.s}`,
        rest: t("pair the parts with the same sum", "बराबर जोड़ वाले हिस्सों की जोड़ी"),
        visual: (
          <Row>
            <Term cells={[`(${xp(f[i])})(${xp(f[j])})`]} tone="active" gap={gap} />
            <Term cells={[`(${xp(f[k])})(${xp(f[l])})`]} tone="added" gap={gap} />
            <Op>=</Op>
            <Term cells={[String(e)]} tone="carry" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `z = ${z}`,
        rest: t("the whole both pairs share", "दोनों जोड़ियों का साझा पूरा"),
        visual: (
          <Row>
            <Term cells={[`(z + ${p.p1})`]} tone="active" gap={gap} />
            <Term cells={[`(z + ${p.p2})`]} tone="added" gap={gap} />
            <Op>=</Op>
            <Term cells={[String(e)]} tone="carry" gap={gap} />
          </Row>
        ),
      },
      {
        strong: `z = ${p.zs!.map((s) => s.z.toString()).join(t(" or ", " या "))}`,
        rest: `${polyText([q(1), q(p.p1 + p.p2), q(p.p1 * p.p2 - e)], "z")} = 0`,
        visual: (
          <Row>
            {p.zs!.map((s, n) => (
              <Term key={n} cells={[`z = ${s.z}`]} tone="done" gap={gap} />
            ))}
          </Row>
        ),
      },
      {
        strong: `x = ${p.roots.map((r) => r.text).join(", ")}`,
        rest: t(`${z} = z for each z`, `हर z के लिए ${z} = z`),
        visual: answerRow(
          p.roots.map((r) => r.text),
          "vg-p",
        ),
        extra: stagger(
          p.roots.map((_, n) => `vg-p${n}`),
          400,
          350,
        ),
        dur: 1700,
      },
    ];
  };

  return [
    { en: "Multiply", hi: "गुणा", sub: "47 × 53", beats: product },
    { en: "Fourth powers", hi: "चौथी घात", sub: "(x + 7)⁴ + (x + 5)⁴ = 706", beats: fourth },
    { en: "Four factors", hi: "चार गुणनखंड", sub: "(x+1)(x+2)(x+3)(x+4) = 120", beats: pairs },
  ];
}

/** Vyashti Samashti: part and whole. */
export const VyashtiLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("product");
  const [inputs, setInputs] = useState<Record<Mode, string[]>>(() => ({
    product: EXAMPLES.product[0].map(String),
    fourth: EXAMPLES.fourth[0].map(String),
    pairs: EXAMPLES.pairs[0].map(String),
  }));
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();
  const raw = inputs[mode];
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const nums = raw.map(Number);
  const setAt = (i: number, v: string) => setInputs((all) => ({ ...all, [mode]: all[mode].map((x, j) => (j === i ? v : x)) }));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  const answers = (roots: Root[]) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {roots.map((r, i) => (
        <Row key={i}>
          <Term cells={[roots.length > 1 ? `x${"₁₂₃₄"[i]}` : "x"]} gap={gap} />
          <Op>=</Op>
          <NumberBoxes groups={[{ cells: [r.text], tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </Row>
      ))}
    </div>
  );

  if (valid && mode === "product") {
    const [a, b] = nums;
    const plan = planProduct(a, b);
    // Halves and quarters read best as decimals: 50.5² = 2550.25.
    const mean = dec(plan.mean);
    const half = dec(plan.half);
    const meanSq = dec(plan.meanSq);
    const halfSq = dec(plan.halfSq);
    steps.push({
      title: t("The whole: the average", "समष्टि: औसत"),
      body: t(`(${num(a)} + ${num(b)}) ÷ 2 = ${mean}: both numbers sit around it.`, `(${num(a)} + ${num(b)}) ÷ 2 = ${mean}: दोनों नंबर इसके आसपास हैं।`),
      visual: (
        <Row>
          <Term cells={[num(a)]} tone="active" gap={gap} />
          <Op>,</Op>
          <Term cells={[num(b)]} tone="active" gap={gap} />
          <Op>→</Op>
          <Term cells={[mean]} tone="done" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("The parts: how far each one is", "व्यष्टि: हर एक कितना दूर"),
      body: t(`${num(Math.min(a, b))} = ${mean} − ${half} and ${num(Math.max(a, b))} = ${mean} + ${half}.`, `${num(Math.min(a, b))} = ${mean} − ${half} और ${num(Math.max(a, b))} = ${mean} + ${half}।`),
      visual: (
        <Row>
          <Term cells={[`${mean} − ${half}`]} tone="active" gap={gap} />
          <Op>×</Op>
          <Term cells={[`${mean} + ${half}`]} tone="active" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("Whole² − part²", "समष्टि² − व्यष्टि²"),
      body: (
        <b className={STRONG}>
          {mean}² = {meanSq}, {half}² = {halfSq}
        </b>
      ),
      visual: (
        <Row>
          <Term cells={[meanSq]} tone="done" gap={gap} />
          <Op>−</Op>
          <Term cells={[halfSq]} tone="carry" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("Answer", "जवाब"),
      body: t(`${meanSq} − ${halfSq} = ${plan.product}. Check: ${num(a)} × ${num(b)} = ${a * b} ✓`, `${meanSq} − ${halfSq} = ${plan.product}। जाँच: ${num(a)} × ${num(b)} = ${a * b} ✓`),
      visual: (
        <Row>
          <Term cells={[`${num(a)} × ${num(b)}`]} gap={gap} />
          <Op>=</Op>
          <NumberBoxes groups={[{ digits: plan.product.toString(), tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </Row>
      ),
    });
  }

  if (valid && mode === "fourth") {
    const [a, b, c] = nums;
    const plan = planFourth(a, b, c);
    const { m, k } = plan;
    const kAbs = k.n < 0 ? k.mul(-1) : k;
    const yEq = polyText([q(2), q(0), plan.B.mul(2), q(0), kAbs.mul(kAbs).mul(kAbs).mul(kAbs).mul(2)], "y");
    steps.push({
      title: t("The whole: the average", "समष्टि: औसत"),
      body: t(
        `The middle of ${xp(a)} and ${xp(b)} is ${xPlusQ(m)}. Call it y: the parts are y + ${kAbs} and y − ${kAbs}.`,
        `${xp(a)} और ${xp(b)} का बीच ${xPlusQ(m)} है। इसे y कहो: हिस्से y + ${kAbs} और y − ${kAbs} हैं।`,
      ),
      visual: (
        <div className="flex flex-col gap-2">
          <Row>
            <Term cells={["y"]} tone="done" gap={gap} />
            <Op>=</Op>
            <Term cells={[xPlusQ(m)]} tone="done" gap={gap} />
          </Row>
          <Row>
            <Term cells={[`(y + ${kAbs})⁴`]} tone="active" gap={gap} />
            <Op>+</Op>
            <Term cells={[`(y − ${kAbs})⁴`]} tone="active" gap={gap} />
            <Op>=</Op>
            <Term cells={[num(c)]} tone="carry" gap={gap} />
          </Row>
        </div>
      ),
    });
    steps.push({
      title: t("Open it up: the odd powers cancel", "खोलो: विषम घातें कट जाती हैं"),
      body: t("The + and − parts cancel y³ and y, leaving only even powers.", "+ और − वाले हिस्से y³ और y को काट देते हैं, बस सम घातें बचती हैं।"),
      visual: (
        <Row>
          <Term cells={[yEq]} tone="active" gap={gap} />
          <Op>=</Op>
          <Term cells={[num(c)]} tone="carry" gap={gap} />
        </Row>
      ),
    });
    const quad = polyText([q(1), plan.B, plan.C], "Y");
    if (!plan.root) note = t("This has no real answer: the two fourth powers can't add up to that.", "इसका कोई असली जवाब नहीं: दो चौथी घातें जोड़कर इतना नहीं बन सकतीं।");
    else if (!plan.Ys)
      note = t(
        `√${plan.disc} isn't a whole number, so this one doesn't come out neatly. Try an example.`,
        `√${plan.disc} पूरा नंबर नहीं, तो ये साफ़ नहीं निकलता। कोई उदाहरण आज़माओ।`,
      );
    else {
      steps.push({
        title: t("A quadratic in Y = y²", "Y = y² में द्विघात"),
        body: t(
          `Halve and move ${num(c)} across: ${quad} = 0, so Y = ${plan.B.mul(-1).div(2)} ± √${plan.disc} = ${plan.Ys.map((y) => y.Y.toString()).join(" or ")}.`,
          `आधा करो और ${num(c)} को उस पार ले जाओ: ${quad} = 0, तो Y = ${plan.B.mul(-1).div(2)} ± √${plan.disc} = ${plan.Ys.map((y) => y.Y.toString()).join(" या ")}।`,
        ),
        visual: (
          <div className="flex flex-col gap-2">
            <Row>
              <Term cells={[quad]} tone="active" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
            <Row>
              {plan.Ys.map((y, i) => (
                <Term key={i} cells={[`y² = ${y.Y}`]} tone={y.real ? "done" : "muted"} gap={gap} />
              ))}
            </Row>
          </div>
        ),
      });
      const real = plan.Ys.filter((y) => y.real);
      if (!real.length) note = t("Both values of y² are negative, so there's no real answer.", "y² के दोनों मान माइनस हैं, तो कोई असली जवाब नहीं।");
      else
        steps.push({
          title: t(`Back to x: x = y ${m.n < 0 ? "+" : "−"} ${m.n < 0 ? m.mul(-1) : m}`, `वापस x: x = y ${m.n < 0 ? "+" : "−"} ${m.n < 0 ? m.mul(-1) : m}`),
          body: t(
            `${real.map((y) => `y = ±${surdText(sqrtQ(y.Y))}`).join(", ")}${plan.Ys.some((y) => !y.real) ? " (a negative y² gives no real y)" : ""}. x = ${plan.roots.map((r) => r.text).join(", ")}.`,
            `${real.map((y) => `y = ±${surdText(sqrtQ(y.Y))}`).join(", ")}${plan.Ys.some((y) => !y.real) ? " (माइनस y² से असली y नहीं)" : ""}। x = ${plan.roots.map((r) => r.text).join(", ")}।`,
          ),
          visual: answers(plan.roots),
        });
    }
  }

  if (valid && mode === "pairs") {
    const f = nums.slice(0, 4) as [number, number, number, number];
    const e = nums[4];
    const plan = planPairs(f, e);
    if (!plan.pairs)
      note = t(
        "No two factors add up to the same as the other two, so this shortcut doesn't fit. Try 1, 2, 3, 4: 1 + 4 = 2 + 3.",
        "कोई दो गुणनखंड बाकी दो के बराबर नहीं जुड़ते, तो ये शॉर्टकट नहीं लगेगा। 1, 2, 3, 4 आज़माओ: 1 + 4 = 2 + 3।",
      );
    else {
      const [[i, j], [k, l]] = plan.pairs;
      const z = polyText([q(1), q(plan.s), q(0)]);
      steps.push({
        title: t("Pair the parts with the same sum", "बराबर जोड़ वाले हिस्सों की जोड़ी"),
        body: t(`${num(f[i])} + ${num(f[j])} = ${num(f[k])} + ${num(f[l])} = ${plan.s}.`, `${num(f[i])} + ${num(f[j])} = ${num(f[k])} + ${num(f[l])} = ${plan.s}।`),
        visual: (
          <Row>
            <Term cells={[`(${xp(f[i])})(${xp(f[j])})`]} tone="active" gap={gap} />
            <Term cells={[`(${xp(f[k])})(${xp(f[l])})`]} tone="added" gap={gap} />
            <Op>=</Op>
            <Term cells={[num(e)]} tone="carry" gap={gap} />
          </Row>
        ),
      });
      steps.push({
        title: t(`The whole: z = ${z}`, `समष्टि: z = ${z}`),
        body: t(
          `Each pair multiplies out to ${z} plus a number: ${polyText([q(1), q(plan.s), q(plan.p1)])} and ${polyText([q(1), q(plan.s), q(plan.p2)])}.`,
          `हर जोड़ी गुणा होकर ${z} और एक नंबर बनती है: ${polyText([q(1), q(plan.s), q(plan.p1)])} और ${polyText([q(1), q(plan.s), q(plan.p2)])}।`,
        ),
        visual: (
          <Row>
            <Term cells={[`(${xPlusQ(q(plan.p1)).replace("x", "z")})`]} tone="active" gap={gap} />
            <Term cells={[`(${xPlusQ(q(plan.p2)).replace("x", "z")})`]} tone="added" gap={gap} />
            <Op>=</Op>
            <Term cells={[num(e)]} tone="carry" gap={gap} />
          </Row>
        ),
      });
      const zq = polyText([q(1), q(plan.p1 + plan.p2), q(plan.p1 * plan.p2 - e)], "z");
      const zPlan = plan.zPlan!;
      if (!zPlan.root) note = t(`${zq} = 0 has no real answer, so neither does the equation.`, `${zq} = 0 का कोई असली जवाब नहीं, तो समीकरण का भी नहीं।`);
      else if (!plan.zs) note = t(`z = ${zPlan.roots.map((r) => r.text).join(" or ")} isn't a plain number, so this one doesn't come out neatly. Try an example.`, `z = ${zPlan.roots.map((r) => r.text).join(" या ")} साफ़ नंबर नहीं, तो ये साफ़ नहीं निकलता। कोई उदाहरण आज़माओ।`);
      else {
        steps.push({
          title: t("Solve for z", "z निकालो"),
          body: t(`${zq} = 0, so z = ${plan.zs.map((s) => s.z.toString()).join(" or ")}.`, `${zq} = 0, तो z = ${plan.zs.map((s) => s.z.toString()).join(" या ")}।`),
          visual: (
            <div className="flex flex-col gap-2">
              <Row>
                <Term cells={[zq]} tone="active" gap={gap} />
                <Op>=</Op>
                <Term cells={["0"]} gap={gap} />
              </Row>
              <Row>
                {plan.zs.map((s, n) => (
                  <Term key={n} cells={[`z = ${s.z}`]} tone="done" gap={gap} />
                ))}
              </Row>
            </div>
          ),
        });
        steps.push({
          title: t("Back to x: one small quadratic for each z", "वापस x: हर z के लिए एक छोटा द्विघात"),
          body: (
            <span className="flex flex-col gap-0.5 tabular-nums">
              {plan.zs.map((s, n) => (
                <span key={n}>
                  {z} = {s.z.toString()} →{" "}
                  {s.x.roots.length ? `x = ${s.x.roots.map((r) => r.text).join(t(" or ", " या "))}` : t("no real x", "कोई असली x नहीं")}
                </span>
              ))}
            </span>
          ),
          visual: plan.roots.length ? answers(plan.roots) : <Term cells={[t("no real answer", "कोई असली जवाब नहीं")]} tone="muted" gap={gap} />,
        });
      }
    }
  }

  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;
  const box = (i: number, name: string) => <NumIn label={name} value={raw[i]} onChange={(v) => setAt(i, v)} hideLabel />;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("vyashti", lang)}
        subtitle={t("Replace the parts by their whole, the average, and the rest becomes simple.", "हिस्सों की जगह उनका पूरा, यानी औसत, रखो, और बाकी आसान हो जाता है।")}
      />

      <Card title={t("The rule", "नियम")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Work from the whole (the average), and see each part as the whole ± a little.", "पूरे (औसत) से काम करो, और हर हिस्से को पूरा ± थोड़ा देखो।")}</b>
        </p>
        {animate ? (
          <AnimatedExamples id="vyashti" cases={vyashtiCases(t, gap)} lang={lang} gap={gap} />
        ) : (
        <div className={`mt-3 flex flex-col gap-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200 ${BODY}`}>
          <span>47 × 53 = 50² − 3² = 2500 − 9 = 2491</span>
          <span>(x + 7)⁴ + (x + 5)⁴ = 706: y = x + 6 → 2y⁴ + 12y² + 2 = 706 → y² = 16 → x = −2, −10</span>
          <span>(x + 1)(x + 2)(x + 3)(x + 4) = 120: z = x² + 5x → (z + 4)(z + 6) = 120 → x = 1, −6</span>
        </div>
        )}
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Vyashti means \"the part\" (the individual), Samashti \"the whole\" (the total). Instead of working with each part on its own, work from the whole they share: their average. Each part is then the whole plus or minus a little, and the pluses and minuses cancel.",
            "व्यष्टि यानी \"हिस्सा\" (अकेला), समष्टि यानी \"पूरा\" (कुल)। हर हिस्से से अलग-अलग काम करने के बजाय, उनके साझा पूरे से काम करो: उनका औसत। तब हर हिस्सा पूरा ± थोड़ा है, और प्लस-माइनस कट जाते हैं।",
          )}
        </p>
      </Card>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={t("Kind", "प्रकार")} className="flex flex-wrap gap-1.5">
            {MODES.map((md) => {
              const on = md.id === mode;
              return (
                <button
                  key={md.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(md.id)}
                  className={`h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${on
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                >
                  {lang === "hi" ? md.hi : md.en}
                </button>
              );
            })}
          </div>
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          {mode === "product" && (
            <>
              {box(0, "a")}
              {label("×")}
              {box(1, "b")}
            </>
          )}
          {mode === "fourth" && (
            <>
              {label("(x +")}
              {box(0, "a")}
              {label(")⁴ + (x +")}
              {box(1, "b")}
              {label(")⁴ =")}
              {box(2, "c")}
            </>
          )}
          {mode === "pairs" && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <React.Fragment key={i}>
                  {label("(x +")}
                  {box(i, "abcd"[i])}
                  {label(")")}
                </React.Fragment>
              ))}
              {label("=")}
              {box(4, "e")}
            </>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={EXAMPLES[mode].map((e) => ({
              label: mode === "product" ? `${e[0]} × ${e[1]}` : mode === "fourth" ? fourthText(e) : pairsText(e),
              onClick: () => setInputs((all) => ({ ...all, [mode]: e.map(String) })),
            }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Find the whole: the average of the parts.", "पूरा ढूँढो: हिस्सों का औसत।")}</li>
          <li>{t("Each part is the whole ± a little; the ± pieces cancel or square away.", "हर हिस्सा पूरा ± थोड़ा है; ± वाले टुकड़े कट जाते हैं या वर्ग बन जाते हैं।")}</li>
          <li>{t("a × b = average² − (half the difference)².", "a × b = औसत² − (अंतर का आधा)²।")}</li>
        </ul>
      </Card>
    </div>
  );
};

