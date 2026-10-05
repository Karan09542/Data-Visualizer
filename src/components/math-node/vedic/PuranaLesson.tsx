import React, { useState } from "react";
import { NumberBoxes } from "./NumberBoxes";
import { evalPoly, planCube, planSquare, polyText, surdText, xPlusQ, type Root } from "./purana";
import { Q } from "./shunyam";
import { NumIn, Op, Row, Term, num } from "./equation";
import { methodName } from "./methods";
import { BODY, CARD, Card, Examples, GapSwitch, LessonHeader, STRONG, StepList, tr, useBoxGap, type Lang, type StepView } from "./ui";

type Mode = "square" | "cube";

const SQUARE_EXAMPLES: number[][] = [
  [6, -7],
  [-10, 21],
  [5, 6],
  [4, -1],
  [2, 5],
];
const CUBE_EXAMPLES: number[][] = [
  [6, 11, 6],
  [9, 23, 15],
  [-6, 11, -6],
  [12, 39, 28],
  [6, 11, 5],
];

const q = (n: number) => new Q(n);
const squareText = (e: number[]) => `${polyText([q(1), q(e[0]), q(e[1])])} = 0`;
const cubeText = (e: number[]) => `${polyText([q(1), q(e[0]), q(e[1]), q(e[2])])} = 0`;
const MODES: { id: Mode; en: string; hi: string }[] = [
  { id: "square", en: "Complete the square (x²)", hi: "वर्ग पूरा करो (x²)" },
  { id: "cube", en: "Complete the cube (x³)", hi: "घन पूरा करो (x³)" },
];

/** Puranapuranabhyam: by completion or non-completion. */
export const PuranaLesson: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = tr(lang);
  const [mode, setMode] = useState<Mode>("square");
  const [sqRaw, setSqRaw] = useState<string[]>(() => SQUARE_EXAMPLES[0].map(String));
  const [cuRaw, setCuRaw] = useState<string[]>(() => CUBE_EXAMPLES[0].map(String));
  const [spaced, setSpaced, gap] = useBoxGap();
  const raw = mode === "square" ? sqRaw : cuRaw;
  const setRaw = mode === "square" ? setSqRaw : setCuRaw;
  const valid = raw.every((s) => /^-?\d+$/.test(s));
  const nums = raw.map(Number);
  const setAt = (i: number, v: string) => setRaw((all) => all.map((x, j) => (j === i ? v : x)));

  const steps: StepView[] = [];
  let note: string | null = valid ? null : t("Fill every box with a whole number.", "हर डिब्बे में पूरा नंबर लिखो।");

  const answers = (roots: Root[]) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {roots.map((r, i) => (
        <Row key={i}>
          <Term cells={[roots.length > 1 ? `x${"₁₂₃"[i]}` : "x"]} gap={gap} />
          <Op>=</Op>
          <NumberBoxes groups={[{ cells: [r.text], tone: "answer" }]} gap={gap} separator={null} size="lg" />
        </Row>
      ))}
    </div>
  );
  /** "Check: each root makes it 0", worked out exactly when the roots are plain numbers. */
  const checkLine = (coeffs: number[], roots: Root[]) => {
    const exact = roots.every((r) => r.value && evalPoly(coeffs.map(q), r.value).zero);
    return exact ? t(" Check: each one makes the equation 0 ✓", " जाँच: हर एक से समीकरण 0 होता है ✓") : "";
  };

  if (valid && mode === "square") {
    const [b, c] = nums;
    const plan = planSquare(b, c);
    const xh = xPlusQ(plan.h);
    const half = polyText([q(1), q(b), q(0)]);
    steps.push({
      title: t("Half the x number", "x वाले नंबर का आधा"),
      body: t(`${num(b)} ÷ 2 = ${plan.h}, so look at (${xh})².`, `${num(b)} ÷ 2 = ${plan.h}, तो (${xh})² देखो।`),
      visual: (
        <Row>
          <Term cells={[`(${xh})²`]} tone="active" gap={gap} />
          <Op>=</Op>
          <Term cells={[polyText([q(1), q(b), plan.need])]} tone="active" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("Complete it", "पूरा करो"),
      body: t(
        `${half} needs ${plan.need} to be complete. Add ${plan.need} to both sides and move ${num(c)} across.`,
        `${half} को पूरा होने के लिए ${plan.need} चाहिए। दोनों तरफ़ ${plan.need} जोड़ो और ${num(c)} को उस पार ले जाओ।`,
      ),
      visual: (
        <div className="flex flex-col gap-2">
          <Row>
            <Term cells={[half]} gap={gap} />
            <Op>+</Op>
            <Term cells={[plan.need.toString()]} tone="done" gap={gap} />
            <Op>=</Op>
            <Term cells={[plan.need.toString()]} tone="done" gap={gap} />
            {c !== 0 && (
              <>
                <Op>{c > 0 ? "−" : "+"}</Op>
                <Term cells={[String(Math.abs(c))]} tone="carry" gap={gap} />
              </>
            )}
          </Row>
          <Row>
            <Term cells={[`(${xh})²`]} tone="active" gap={gap} />
            <Op>=</Op>
            <Term cells={[plan.D.toString()]} tone="carry" gap={gap} />
          </Row>
        </div>
      ),
    });
    if (!plan.root) note = t(`(${xh})² = ${plan.D}: a square can't be negative, so there's no real answer.`, `(${xh})² = ${plan.D}: वर्ग माइनस नहीं हो सकता, तो कोई असली जवाब नहीं।`);
    else {
      const s = surdText(plan.root);
      const zero = plan.root.coef.zero;
      steps.push({
        title: t("Take the square root", "वर्गमूल लो"),
        body: zero
          ? t(`${xh} = 0: both answers are the same.`, `${xh} = 0: दोनों जवाब एक जैसे।`)
          : t(`${xh} = ±${s}, then move ${plan.h} across.`, `${xh} = ±${s}, फिर ${plan.h} को उस पार ले जाओ।`),
        visual: (
          <Row>
            <Term cells={[xh]} tone="active" gap={gap} />
            <Op>=</Op>
            <Term cells={[zero ? "0" : `±${s}`]} tone="done" gap={gap} />
          </Row>
        ),
      });
      steps.push({
        title: t("Answer", "जवाब"),
        body: `x = ${plan.roots.map((r) => r.text).join(t(" or ", " या "))}.${checkLine([1, b, c], plan.roots)}`,
        visual: answers(plan.roots),
      });
    }
  }

  if (valid && mode === "cube") {
    const [a, b, c] = nums;
    const plan = planCube(a, b, c);
    const xh = xPlusQ(plan.h);
    const yours = polyText([q(1), q(a), q(b), q(c)]);
    const cube = polyText([q(1), ...plan.cube]);
    const left = polyText([plan.k, plan.rest]);
    steps.push({
      title: t("A third of the x² number", "x² वाले नंबर का तिहाई"),
      body: t(`${num(a)} ÷ 3 = ${plan.h}, so look at (${xh})³.`, `${num(a)} ÷ 3 = ${plan.h}, तो (${xh})³ देखो।`),
      visual: (
        <Row>
          <Term cells={[`(${xh})³`]} tone="added" gap={gap} />
          <Op>=</Op>
          <Term cells={[cube]} tone="added" gap={gap} />
        </Row>
      ),
    });
    steps.push({
      title: t("What's not complete", "क्या पूरा नहीं"),
      body: t(`Take (${xh})³ away from your equation: ${left} is left.`, `अपने समीकरण से (${xh})³ घटाओ: ${left} बचता है।`),
      visual: (
        <div className="flex flex-col gap-2">
          <Row>
            <Term cells={[yours]} tone="active" gap={gap} />
            <Op>−</Op>
            <Term cells={[`(${xh})³`]} tone="added" gap={gap} />
            <Op>=</Op>
            <Term cells={[left]} tone="carry" gap={gap} />
          </Row>
          {plan.complete && !plan.k.zero && (
            <Row>
              <Term cells={[left]} tone="carry" gap={gap} />
              <Op>=</Op>
              <Term cells={[`${plan.k.eq(-1) ? "−" : plan.k.eq(1) ? "" : plan.k.toString()}(${xh})`]} tone="done" gap={gap} />
            </Row>
          )}
        </div>
      ),
    });
    if (!plan.complete)
      note = t(
        `${left} isn't a multiple of (${xh}), so this shortcut doesn't fit. It fits when the three answers are evenly spaced, like −1, −2, −3.`,
        `${left}, (${xh}) का गुणज नहीं, तो ये शॉर्टकट नहीं लगेगा। ये तब लगता है जब तीनों जवाब बराबर दूरी पर हों, जैसे −1, −2, −3।`,
      );
    else {
      const yEq = polyText([q(1), q(0), plan.k, q(0)], "y");
      const ys = plan.y && !plan.y.coef.zero ? surdText(plan.y) : null;
      steps.push({
        title: t(`Call ${xh} = y`, `${xh} = y मानो`),
        body: plan.k.zero
          ? t("y³ = 0, so y = 0.", "y³ = 0, तो y = 0।")
          : ys
            ? t(`${yEq} = 0 → y(y² ${plan.k.n < 0 ? "−" : "+"} ${plan.k.n < 0 ? plan.k.mul(-1) : plan.k}) = 0 → y = 0 or y² = ${plan.ySq}, y = ±${ys}.`, `${yEq} = 0 → y = 0 या y² = ${plan.ySq}, y = ±${ys}।`)
            : t(`${yEq} = 0 → y = 0 or y² = ${plan.ySq}; a square can't be negative, so only y = 0.`, `${yEq} = 0 → y = 0 या y² = ${plan.ySq}; वर्ग माइनस नहीं हो सकता, तो सिर्फ़ y = 0।`),
        visual: (
          <div className="flex flex-col gap-2">
            <Row>
              <Term cells={[yEq]} tone="done" gap={gap} />
              <Op>=</Op>
              <Term cells={["0"]} gap={gap} />
            </Row>
            <Row>
              <Term cells={["y = 0"]} tone="done" gap={gap} />
              {ys && <Term cells={[`y = ${ys}`]} tone="done" gap={gap} />}
              {ys && <Term cells={[`y = −${ys}`]} tone="done" gap={gap} />}
            </Row>
          </div>
        ),
      });
      steps.push({
        title: t(`Back to x: x = y ${plan.h.n < 0 ? "+" : "−"} ${plan.h.n < 0 ? plan.h.mul(-1) : plan.h}`, `वापस x: x = y ${plan.h.n < 0 ? "+" : "−"} ${plan.h.n < 0 ? plan.h.mul(-1) : plan.h}`),
        body: `x = ${plan.roots.map((r) => r.text).join(", ")}.${checkLine([1, a, b, c], plan.roots)}`,
        visual: answers(plan.roots),
      });
    }
  }

  const examples = mode === "square" ? SQUARE_EXAMPLES : CUBE_EXAMPLES;
  const label = (s: string) => <span className="text-base font-medium text-slate-700 dark:text-slate-300">{s}</span>;

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("purana", lang)}
        subtitle={t("Add what's missing to make a perfect square or cube, then solve in a line.", "जो कम है उसे जोड़कर पूरा वर्ग या घन बनाओ, फिर एक लाइन में हल करो।")}
      />

      <Card title={t("The rule", "नियम")}>
        <p className={`mt-1 ${BODY}`}>
          <b className={STRONG}>{t("Complete it, and see what's not complete.", "पूरा करो, और देखो क्या पूरा नहीं।")}</b>
        </p>
        <ol className={`mt-3 flex list-decimal flex-col gap-2 pl-5 ${BODY}`}>
          <li>
            {t("Square: half the x number.", "वर्ग: x वाले नंबर का आधा।")}
            <div className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">x² + 6x − 7 = 0 → (x + 3)² = 9 + 7 = 16 → x + 3 = ±4 → x = 1, −7</div>
          </li>
          <li>
            {t("Cube: a third of the x² number.", "घन: x² वाले नंबर का तिहाई।")}
            <div className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">x³ + 6x² + 11x + 6 = (x + 2)³ − (x + 2) → y³ = y → y = 0, ±1 → x = −2, −1, −3</div>
          </li>
        </ol>
      </Card>

      <Card title={t("Why this name", "ये नाम क्यों")}>
        <p className={`mt-1 ${BODY}`}>
          {t(
            "Purana means \"completion\", Apurana \"non-completion\", and -abhyam \"by both\". Complete the square or cube with what's missing, and the part that isn't complete is what's left to solve.",
            "पूरण यानी \"पूरा करना\", अपूरण यानी \"पूरा न होना\", और -आभ्याम् यानी \"दोनों से\"। जो कम है उससे वर्ग या घन पूरा करो, और जो पूरा नहीं वही हल करने को बचता है।",
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
          {mode === "square" ? (
            <>
              {label("x² +")}
              <NumIn label="b" value={raw[0]} onChange={(v) => setAt(0, v)} hideLabel />
              {label("x +")}
              <NumIn label="c" value={raw[1]} onChange={(v) => setAt(1, v)} hideLabel />
              {label("= 0")}
            </>
          ) : (
            <>
              {label("x³ +")}
              <NumIn label="a" value={raw[0]} onChange={(v) => setAt(0, v)} hideLabel />
              {label("x² +")}
              <NumIn label="b" value={raw[1]} onChange={(v) => setAt(1, v)} hideLabel />
              {label("x +")}
              <NumIn label="c" value={raw[2]} onChange={(v) => setAt(2, v)} hideLabel />
              {label("= 0")}
            </>
          )}
        </div>
        <div className="mt-3">
          <Examples
            title={t("Examples", "उदाहरण")}
            items={examples.map((e) => ({ label: mode === "square" ? squareText(e) : cubeText(e), onClick: () => setRaw(e.map(String)) }))}
          />
        </div>
        {note && <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{note}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      <Card title={t("Remember", "याद रखो")}>
        <ul className={`mt-2 flex list-disc flex-col gap-1 pl-5 ${BODY}`}>
          <li>{t("Square: half the x number, h. Cube: a third of the x² number, h.", "वर्ग: x वाले नंबर का आधा, h। घन: x² वाले नंबर का तिहाई, h।")}</li>
          <li>{t("(x + h)² or (x + h)³ is the complete part; the rest is what's not complete.", "(x + h)² या (x + h)³ पूरा हिस्सा है; बाकी जो पूरा नहीं।")}</li>
          <li>{t("For cubes it works in one line when the three answers are evenly spaced.", "घन में ये एक लाइन में तब चलता है जब तीनों जवाब बराबर दूरी पर हों।")}</li>
        </ul>
      </Card>
    </div>
  );
};
