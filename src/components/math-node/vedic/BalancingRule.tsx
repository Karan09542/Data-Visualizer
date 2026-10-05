import React, { useState } from "react";
import { NumberBoxes, type BoxArrow, type BoxCell, type BoxGroup } from "./NumberBoxes";
import { balance, multiplyDigits, parseSlashValues, placeName, placeValue } from "./balancing";
import { methodName } from "./methods";
import { AnimateSwitch, BODY, CARD, CARD_TITLE, Card, Examples, GapSwitch, INPUT, LessonHeader, STRONG, SUM_CHIP, Segmented, StepList, tr, useAnimate, useBoxGap, type Lang, type StepView } from "./ui";
import { BalancingGlance } from "./glances";

type Mode = "multiply" | "slash";

const EXAMPLES: { mode: Mode; num?: string; mul?: string; slash?: string; label: string }[] = [
  { mode: "multiply", num: "173", mul: "5", label: "173 × 5" },
  { mode: "multiply", num: "4826", mul: "7", label: "4826 × 7" },
  { mode: "slash", slash: "5/3/78", label: "5/3/78" },
  { mode: "slash", slash: "5/443/1", label: "5/443/1" },
  { mode: "slash", slash: "72/82/97/08", label: "72/82/97/08" },
];

/**
 * A part's boxes as written: one per digit, except that a part of three or more
 * digits keeps everything before its last digit together, since that moves left
 * as one (443 → 44 | 3). A single digit gets its added 0 marked.
 */
function partCells(part: string, padded: string): BoxCell[] {
  if (part.length === 1) return [{ v: "0", tone: "added" }, { v: part }];
  if (padded.length >= 3) return [{ v: padded.slice(0, -1) }, { v: padded.slice(-1) }];
  return [...padded].map((v) => ({ v }));
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The Balancing Rule: one example at a glance, why it's called that, and every step for your own numbers. */
export const BalancingRule: React.FC<{ lang: Lang }> = ({ lang }) => {
  const hi = lang === "hi";
  const t = tr(lang);

  const [mode, setMode] = useState<Mode>("multiply");
  const [num, setNum] = useState("173");
  const [mul, setMul] = useState("5");
  const [slash, setSlash] = useState("5/443/1");
  const [spaced, setSpaced, gap] = useBoxGap();
  const [animate, setAnimate] = useAnimate();

  const load = (e: (typeof EXAMPLES)[number]) => {
    setMode(e.mode);
    if (e.num) setNum(e.num);
    if (e.mul) setMul(e.mul);
    if (e.slash) setSlash(e.slash);
  };

  // What to balance, or why there's nothing to.
  const m = Number(mul);
  const numOk = /^\d{1,8}$/.test(num);
  const mulOk = /^\d{1,2}$/.test(mul) && m >= 1;
  const parts = mode === "multiply" ? (numOk && mulOk ? multiplyDigits(num, m) : null) : parseSlashValues(slash);
  const error =
    mode === "multiply"
      ? !numOk
        ? t("Type a whole number, up to 8 digits.", "कोई पूरा नंबर लिखो, 8 अंकों तक।")
        : !mulOk
          ? t("Multiply by a number from 1 to 99.", "1 से 99 तक के नंबर से गुणा करो।")
          : null
      : !parts
        ? t("Write 2 to 10 parts split by /, like 5/443/1.", "/ से अलग 2 से 10 हिस्से लिखो, जैसे 5/443/1।")
        : null;

  const boxes = (groups: BoxGroup[], arrows?: BoxArrow[], size: "md" | "lg" = "md", separator: string | null = "/") => (
    <NumberBoxes groups={groups} arrows={arrows} gap={gap} separator={separator} size={size} />
  );

  const steps: StepView[] = [];
  if (parts) {
    const result = balance(parts);
    const { padded } = result;
    const n = parts.length;

    if (mode === "multiply") {
      steps.push({
        title: t(`Multiply each digit by ${m}`, `हर अंक को ${m} से गुणा करो`),
        body: (
          <div className="flex flex-wrap gap-1.5">
            {[...num].map((d, i) => (
              <span key={i} className={SUM_CHIP}>
                {d} × {m} = <b className={STRONG}>{parts[i]}</b>
              </span>
            ))}
          </div>
        ),
        visual: boxes(parts.map((p) => ({ digits: p }))),
      });
    }

    const singles = parts.filter((p) => p.length === 1);
    const long = parts.filter((p) => p.length >= 3);
    steps.push({
      title: t("Give every part two digits", "हर हिस्से को दो अंक का बनाओ"),
      body: (
        <>
          {singles.length
            ? t(`A single digit gets a 0 in front: ${singles.map((p) => `${p} → 0${p}`).join(", ")}.`, `अकेले अंक के आगे 0 लगाओ: ${singles.map((p) => `${p} → 0${p}`).join(", ")}।`)
            : t("Every part already has two digits.", "हर हिस्से में पहले से दो अंक हैं।")}
          {long.length > 0 &&
            t(
              ` ${long.join(", ")} has more: its last digit stays, and ${long.map((p) => p.slice(0, -1)).join(", ")} moves left together, so they share one box.`,
              ` ${long.join(", ")} में ज़्यादा अंक हैं: आख़िरी अंक यहीं रहेगा, और ${long.map((p) => p.slice(0, -1)).join(", ")} एक साथ बाएँ जाएगा, इसलिए एक ही डिब्बे में।`,
            )}
        </>
      ),
      visual: boxes(parts.map((p, i) => ({ cells: partCells(p, padded[i]) }))),
    });

    result.steps.forEach((s) => {
      const leftmost = s.index === 0;
      const place = placeName(n - 1 - s.index, hi);
      const sum = s.carryIn ? `${s.part} + ${s.carryIn} = ${s.total}` : s.part;
      const groups: BoxGroup[] = padded.map((digits, j) => {
        if (j < s.index) return { cells: partCells(parts[j], digits) };
        if (j > s.index) return { digits: result.steps.find((x) => x.index === j)!.keep, tone: "done" };
        if (leftmost) return { digits: String(s.total), tone: "active" };
        // The last digit stays (amber); everything before it moves left as one box (rose).
        const shown = String(s.total).padStart(2, "0");
        return {
          cells: [
            { v: shown.slice(0, -1), tone: s.carryOut ? "carry" : "muted" },
            { v: shown.slice(-1), tone: "active" },
          ],
        };
      });
      steps.push({
        title: hi ? `${place} की जगह` : `${cap(place)} place`,
        body: (
          <>
            <span className={STRONG}>{sum}</span>
            <span className="text-slate-400 dark:text-slate-500"> → </span>
            {leftmost
              ? t(`the last place on the left, so write all of it: ${s.keep}.`, `ये सबसे बाईं जगह है, तो पूरा लिख दो: ${s.keep}।`)
              : s.carryOut
                ? t(`keep ${s.keep}, carry ${s.carryOut} to the left.`, `${s.keep} यहीं रखो, ${s.carryOut} बाएँ भेजो।`)
                : t(`keep ${s.keep}, nothing to carry.`, `${s.keep} यहीं रखो, आगे कुछ नहीं जाता।`)}
          </>
        ),
        visual: boxes(groups, !leftmost && s.carryOut ? [{ from: s.index, to: s.index - 1, label: `+${s.carryOut}` }] : undefined),
      });
    });

    const check =
      mode === "multiply"
        ? `${num} × ${m} = ${(BigInt(num) * BigInt(m)).toString()} ✓`
        : `${parts.map((p, i) => (i === n - 1 ? p : `${p}×${"1" + "0".repeat(n - 1 - i)}`)).join(" + ")} = ${placeValue(parts).toString()} ✓`;
    steps.push({
      title: t("Answer", "जवाब"),
      body: (
        <span className="tabular-nums">
          {t("Check: ", "जाँच: ")}
          {check}
        </span>
      ),
      visual: boxes([{ digits: result.answer, tone: "answer" }], undefined, "lg", null),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader
        title={methodName("balancing", lang)}
        subtitle={t(
          "Turns slash values like 05/35/15, which a Vedic multiplication gives you, into the final answer.",
          "वैदिक गुणा से जो स्लैश वाले नंबर आते हैं, जैसे 05/35/15, उन्हें आख़िरी जवाब में बदलता है।",
        )}
      />

      {/* The whole rule in one picture, still or played. */}
      <Card title={t("At a glance: 173 × 5", "एक नज़र में: 173 × 5")} action={<AnimateSwitch on={animate} onChange={setAnimate} lang={lang} />}>
        <BalancingGlance lang={lang} gap={gap} animate={animate} />
      </Card>

      <div className="grid gap-3 @lg:grid-cols-2">
        <Card title={t("Why this name", "ये नाम क्यों")}>
          <p className={`mt-1 ${BODY}`}>
            {t(
              "Each part between the slashes is one place: hundreds, tens, ones. A place can hold only one digit, so a part like 35 is too heavy. It keeps one digit and passes the rest to the left, until every place is balanced.",
              "स्लैश के बीच का हर हिस्सा एक जगह है: सैकड़ा, दहाई, इकाई। एक जगह में एक ही अंक रह सकता है, तो 35 जैसा हिस्सा भारी है। वो एक अंक रखता है और बाकी बाएँ भेज देता है, जब तक हर जगह बैलेंस न हो जाए।",
            )}
          </p>
        </Card>
        <Card title={t("How it's written", "कैसे लिखते हैं")}>
          <p className={`mt-1 ${BODY}`}>{t("One part per place, split by /. Balance it from right to left.", "हर जगह का एक हिस्सा, / से अलग। दाएँ से बाएँ बैलेंस करो।")}</p>
          <div className="mt-3 overflow-x-auto">
            <NumberBoxes groups={[{ digits: "05" }, { digits: "35" }, { digits: "15" }]} gap={gap} size="sm" />
          </div>
        </Card>
      </div>

      {/* Your numbers */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            label="Input"
            options={[
              ["multiply", t("Multiply", "गुणा")],
              ["slash", t("Slash values", "स्लैश वाले नंबर")],
            ]}
          />
          <GapSwitch spaced={spaced} onChange={setSpaced} lang={lang} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {mode === "multiply" ? (
            <>
              <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" aria-label={t("Number", "नंबर")} className={`${INPUT} w-32`} />
              <span className="text-xl text-slate-400 dark:text-slate-500">×</span>
              <input value={mul} onChange={(e) => setMul(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label={t("Multiply by", "किससे गुणा")} className={`${INPUT} w-16 text-center`} />
            </>
          ) : (
            <input
              value={slash}
              onChange={(e) => setSlash(e.target.value.replace(/[^\d/ ]/g, ""))}
              inputMode="text"
              spellCheck={false}
              aria-label={t("Slash values", "स्लैश वाले नंबर")}
              placeholder="5/443/1"
              className={`${INPUT} w-full max-w-64 tracking-wide`}
            />
          )}
        </div>

        <div className="mt-3">
          <Examples title={t("Examples", "उदाहरण")} items={EXAMPLES.map((e) => ({ label: e.label, onClick: () => load(e) }))} />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {steps.length > 0 && <StepList steps={steps} />}

      {/* The two things to remember */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("Two things to remember", "दो बातें याद रखो")}</h3>
        <div className="grid gap-3 @lg:grid-cols-2">
          {(
            [
              {
                title: t("Single digit → two digits", "एक अंक → दो अंक"),
                from: ["5", "3", "78"],
                note: t("Add a 0 in front of a single digit.", "अकेले अंक के आगे 0 लगाओ।"),
                slash: "5/3/78",
              },
              {
                title: t("Three or more digits → two-digit groups", "तीन या ज़्यादा अंक → दो-दो के ग्रुप"),
                from: ["5", "443", "1"],
                note: t("443 keeps 3 and sends 44 left: 44 + 5 = 49.", "443 अपना 3 रखता है और 44 बाएँ भेजता है: 44 + 5 = 49।"),
                slash: "5/443/1",
              },
            ] as const
          ).map((rule) => (
            <div key={rule.slash} className={`flex flex-col gap-3 ${CARD}`}>
              <div className="flex items-start justify-between gap-2">
                <h4 className={CARD_TITLE}>{rule.title}</h4>
                <button
                  type="button"
                  onClick={() => load({ mode: "slash", slash: rule.slash, label: rule.slash })}
                  className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
                >
                  {t("Try it", "आज़माओ")}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                <NumberBoxes groups={rule.from.map((d) => ({ digits: d }))} gap={gap} size="sm" />
                <span className="text-slate-400 dark:text-slate-500">→</span>
                <NumberBoxes groups={rule.from.map((d) => ({ cells: partCells(d, d.length === 1 ? `0${d}` : d) }))} gap={gap} size="sm" />
              </div>
              <p className="text-[13px] text-slate-600 dark:text-slate-400">{rule.note}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
