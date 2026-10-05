import React, { useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, Hand, Lightbulb, Target } from "lucide-react";
import { LESSON_CATEGORIES, type LessonCategory } from "./geometryLessons";
import { GEOMETRY_LESSONS } from "./geometryLessonsMore";

interface GeometryLessonsGalleryProps {
  activeKey: string | null;
  onLoad: (key: string) => void;
  /** Whether a challenge's condition holds on the graph right now. */
  evaluateCheck?: (expr: string) => boolean;
}

/**
 * Geometry lessons in the sidebar, grouped by topic. The open lesson shows what
 * to learn (its facts) and what to try on the graph.
 */
export const GeometryLessonsGallery: React.FC<GeometryLessonsGalleryProps> = ({ activeKey, onLoad, evaluateCheck }) => {
  const active = GEOMETRY_LESSONS.find((l) => l.key === activeKey);
  const [open, setOpen] = useState(true);
  const [category, setCategory] = useState<LessonCategory>(active?.category ?? "Circle");
  // How many steps of the proof are showing (0: folded away).
  const [proofSteps, setProofSteps] = useState(0);

  // Follow a lesson loaded from elsewhere (a saved graph, say) to its topic.
  useEffect(() => {
    if (active) setCategory(active.category);
    setProofSteps(0);
  }, [active]);

  const challenges = (active?.challenges ?? []).map((c) => ({ ...c, done: !!evaluateCheck?.(c.check) }));
  const doneCount = challenges.filter((c) => c.done).length;
  const proof = active?.proof ?? [];

  const lessons = GEOMETRY_LESSONS.filter((l) => l.category === category);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-semibold tracking-wider"
      >
        <span>Geometry lessons</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <>
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Lines, coordinates, triangles, circles, conics, vectors, trigonometry, transformations, calculus and optics you can
            drag, with every measurement live.
          </p>

          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Geometry topics">
            {LESSON_CATEGORIES.map((c) => {
              const selected = c === category;
              const count = GEOMETRY_LESSONS.filter((l) => l.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setCategory(c)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    selected
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {c} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
            {lessons.map((lesson) => {
              const isActive = lesson.key === activeKey;
              return (
                <button
                  key={lesson.key}
                  type="button"
                  onClick={() => onLoad(lesson.key)}
                  className={`text-left p-2 rounded-lg border shadow-sm transition-all flex flex-col gap-1 ${
                    isActive
                      ? `bg-slate-50 dark:bg-slate-800 ring-1 ${lesson.accent.ring}`
                      : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${lesson.accent.dot}`} />
                    <span className={`text-[11px] font-semibold ${lesson.accent.text}`}>{lesson.title}</span>
                  </span>
                  <span className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">{lesson.summary}</span>
                </button>
              );
            })}
          </div>

          {active && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  <BookOpen size={12} className="text-violet-500" />
                  {active.title}: key facts
                </span>
                <ul className="list-disc pl-4 flex flex-col gap-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                  {active.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  <Hand size={12} className="text-sky-500" />
                  Try this
                </span>
                <ol className="list-decimal pl-4 flex flex-col gap-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                  {active.tryThis.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ol>
              </div>

              {challenges.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    <Target size={12} className="text-amber-500" />
                    Challenges
                    <span
                      className={`ml-auto px-1.5 rounded-full tabular-nums font-medium ${
                        doneCount === challenges.length
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {doneCount}/{challenges.length}
                    </span>
                  </span>
                  <ul className="flex flex-col gap-1">
                    {challenges.map((c) => (
                      <li
                        key={c.text}
                        className={`flex items-start gap-1.5 text-[10px] leading-snug transition-colors ${
                          c.done ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-px size-3.5 shrink-0 inline-flex items-center justify-center rounded-full border transition-colors ${
                            c.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {c.done && <Check size={9} strokeWidth={3.5} />}
                        </span>
                        <span>
                          {c.text}
                          <span className="sr-only">{c.done ? " (done)" : " (not yet)"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span className="text-[9.5px] text-slate-400 dark:text-slate-500">
                    Drag the shape: each one ticks itself off when the graph shows it.
                  </span>
                </div>
              )}

              {proof.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {proofSteps === 0 ? (
                    <button
                      type="button"
                      onClick={() => setProofSteps(1)}
                      className="self-start inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
                    >
                      <Lightbulb size={12} className="text-violet-500" />
                      Show why
                    </button>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        <Lightbulb size={12} className="text-violet-500" />
                        Why it's true
                        <button
                          type="button"
                          onClick={() => setProofSteps(0)}
                          className="ml-auto font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          Hide
                        </button>
                      </span>
                      <ol className="list-decimal pl-4 flex flex-col gap-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                        {proof.slice(0, proofSteps).map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      {proofSteps < proof.length && (
                        <button
                          type="button"
                          onClick={() => setProofSteps((n) => n + 1)}
                          className="self-start h-6 px-2 rounded-md bg-violet-500/10 text-[10px] font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-colors"
                        >
                          Next step ({proofSteps}/{proof.length})
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
