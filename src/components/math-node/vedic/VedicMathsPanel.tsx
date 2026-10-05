import React, { Suspense, useEffect, useState } from "react";
import { X } from "lucide-react";
import { VEDIC_METHODS, methodName } from "./methods";
import { BalancingRule } from "./BalancingRule";
import { lazyWithRetry } from "../../../utils/lazyWithRetry";
import { importFresh } from "./importFresh";
import type { Lang } from "./ui";

const METHOD_KEY = "mathNode.vedic.method";
const LANG_KEY = "mathNode.vedic.lang";

type LessonComponent = React.ComponentType<{ lang: Lang }>;

/**
 * The other lessons are downloaded when first opened (the Balancing Rule, the first one
 * shown, comes with the panel). Each loader is kept so a lesson can also be fetched early,
 * when its name is hovered or focused. A retry after a failed download asks for the file
 * afresh (see importFresh), so trying again really tries again.
 */
const LOADERS: Record<string, () => Promise<{ default: LessonComponent }>> = {
  base: () => importFresh(() => import("./BaseLesson"), (m) => m.BaseLesson),
  teens: () => importFresh(() => import("./TeensLesson"), (m) => m.TeensLesson),
  ekadhikena: () => importFresh(() => import("./EkadhikenaPurvena"), (m) => m.EkadhikenaPurvena),
  vilokanam: () => importFresh(() => import("./VilokanamLesson"), (m) => m.Vilokanam),
  nikhilam: () => importFresh(() => import("./NikhilamLesson"), (m) => m.NikhilamLesson),
  urdhva: () => importFresh(() => import("./UrdhvaLesson"), (m) => m.UrdhvaLesson),
  paravartya: () => importFresh(() => import("./ParavartyaLesson"), (m) => m.ParavartyaLesson),
  shunyam: () => importFresh(() => import("./ShunyamLesson"), (m) => m.ShunyamLesson),
  anurupye: () => importFresh(() => import("./AnurupyeLesson"), (m) => m.AnurupyeLesson),
  sankalana: () => importFresh(() => import("./SankalanaLesson"), (m) => m.SankalanaLesson),
  purana: () => importFresh(() => import("./PuranaLesson"), (m) => m.PuranaLesson),
  chalana: () => importFresh(() => import("./ChalanaLesson"), (m) => m.ChalanaLesson),
  yavadunam: () => importFresh(() => import("./YavadunamLesson"), (m) => m.YavadunamLesson),
  vyashti: () => importFresh(() => import("./VyashtiLesson"), (m) => m.VyashtiLesson),
  shesanyankena: () => importFresh(() => import("./ShesanyankenaLesson"), (m) => m.ShesanyankenaLesson),
  sopantya: () => importFresh(() => import("./SopantyaLesson"), (m) => m.SopantyaLesson),
  ekanyunena: () => importFresh(() => import("./EkanyunenaLesson"), (m) => m.EkanyunenaLesson),
  gunita: () => importFresh(() => import("./GunitaLesson"), (m) => m.GunitaLesson),
  gunaka: () => importFresh(() => import("./GunakaLesson"), (m) => m.GunakaLesson),
};

/** Each method’s lesson: retried if the download fails, with a way to try again if it still does. */
const LESSONS: Record<string, LessonComponent> = {
  balancing: BalancingRule,
  ...Object.fromEntries(
    Object.entries(LOADERS).map(([id, load]) => [id, lazyWithRetry(load, `${VEDIC_METHODS.find((m) => m.id === id)?.name ?? id} lesson`)]),
  ),
};

/** Starts a lesson’s download ahead of time; a failure here is ignored (opening it retries). */
const prefetched = new Set<string>();
function prefetch(id: string) {
  const load = LOADERS[id];
  if (!load || prefetched.has(id)) return;
  prefetched.add(id);
  load().catch(() => prefetched.delete(id));
}

/** Shown while a lesson downloads: its outline, after a moment so quick loads don’t flash. */
const LessonSkeleton: React.FC<{ lang: Lang }> = ({ lang }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  const bar = "rounded-md bg-slate-200/80 dark:bg-slate-800";
  return (
    <div role="status" aria-busy="true" className={`flex flex-col gap-6 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}>
      <span className="sr-only">{lang === "hi" ? "पाठ लोड हो रहा है…" : "Loading the lesson…"}</span>
      <div className="flex animate-pulse flex-col gap-2.5">
        <div className={`h-7 w-2/3 ${bar}`} />
        <div className={`h-4 w-full ${bar}`} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse flex-col gap-3 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <div className={`h-4 w-1/4 ${bar}`} />
          <div className={`h-3.5 w-11/12 ${bar}`} />
          <div className={`h-3.5 w-3/4 ${bar}`} />
        </div>
      ))}
    </div>
  );
};

function read(key: string, ok: (v: string) => boolean, fallback: string) {
  try {
    const v = localStorage.getItem(key);
    if (v !== null && ok(v)) return v;
  } catch {
    // Private mode: use the default.
  }
  return fallback;
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Still applies for this visit.
  }
}

/**
 * Vedic Maths inside the math node: the methods by their original names, each
 * with a short lesson worked on your own numbers. Fills the node, follows its
 * light or dark theme, and lays itself out by the node's size, not the screen's.
 */
const VedicMathsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [methodId, setMethodId] = useState(() => read(METHOD_KEY, (v) => VEDIC_METHODS.some((m) => m.id === v), "balancing"));
  const [lang, setLang] = useState<Lang>(() => read(LANG_KEY, (v) => v === "en" || v === "hi", "en") as Lang);
  const method = VEDIC_METHODS.find((m) => m.id === methodId) ?? VEDIC_METHODS[0];
  const Lesson = LESSONS[method.id];

  const choose = (id: string) => {
    setMethodId(id);
    save(METHOD_KEY, id);
  };
  const chooseLang = (l: Lang) => {
    setLang(l);
    save(LANG_KEY, l);
  };

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const item = (m: (typeof VEDIC_METHODS)[number], compact: boolean) => {
    const on = m.id === method.id;
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => choose(m.id)}
        onPointerEnter={() => prefetch(m.id)}
        onFocus={() => prefetch(m.id)}
        aria-current={on}
        className={
          compact
            ? `h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors ${on
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
            }`
            : `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${on
              ? "bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`
        }
      >
        <span lang={lang === "hi" ? "hi" : undefined} className="truncate">{methodName(m.id, lang)}</span>
        {!compact && !m.ready && <span className={`shrink-0 text-[10px] font-medium ${on ? "opacity-70" : "text-slate-400 dark:text-slate-500"}`}>{lang === "hi" ? "जल्द" : "Soon"}</span>}
      </button>
    );
  };

  return (
    <div
      className="@container absolute inset-0 z-400 flex flex-col bg-white font-sans text-slate-900 nodrag nowheel nopan cursor-default dark:bg-slate-950 dark:text-slate-100"
      role="dialog"
      aria-label="Vedic Maths"
      // Inline too: above the graph's toolbars, and sized for its container queries,
      // even before the stylesheet has caught up with these classes.
      style={{ zIndex: 400, containerType: "inline-size" }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
        <h1 className="flex-1 text-[15px] font-semibold tracking-tight">{lang === "hi" ? "वैदिक गणित" : "Vedic Maths"}</h1>
        <div role="radiogroup" aria-label="Language" className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {(
            [
              ["en", "EN"],
              ["hi", "हिंदी"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={lang === id}
              onClick={() => chooseLang(id)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${lang === id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Vedic Maths"
          title="Close (Esc)"
          className="grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col @2xl:flex-row">
        <nav aria-label="Methods" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-200 px-4 py-2.5 @2xl:hidden dark:border-slate-800">
          {VEDIC_METHODS.map((m) => item(m, true))}
        </nav>
        <nav aria-label="Methods" className="hidden w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 p-2 @2xl:flex dark:border-slate-800">
          {VEDIC_METHODS.map((m) => item(m, false))}
        </nav>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6 @md:px-8">
            {Lesson ? (
              <Suspense key={method.id} fallback={<LessonSkeleton lang={lang} />}>
                <Lesson lang={lang} />
              </Suspense>
            ) : (
              <div className="flex flex-col gap-2 py-10 text-center">
                <h2 className="text-2xl font-semibold tracking-tight">{methodName(method.id, lang)}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{lang === "hi" ? "इसका पाठ जल्द आएगा।" : "This lesson is coming soon."}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default VedicMathsPanel;
