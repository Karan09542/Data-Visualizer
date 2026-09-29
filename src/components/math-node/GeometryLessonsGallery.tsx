import React, { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Hand } from "lucide-react";
import { GEOMETRY_LESSONS, LESSON_CATEGORIES, type LessonCategory } from "./geometryLessons";

interface GeometryLessonsGalleryProps {
  activeKey: string | null;
  onLoad: (key: string) => void;
}

/**
 * Geometry lessons in the sidebar, grouped by topic. The open lesson shows what
 * to learn (its facts) and what to try on the graph.
 */
export const GeometryLessonsGallery: React.FC<GeometryLessonsGalleryProps> = ({ activeKey, onLoad }) => {
  const active = GEOMETRY_LESSONS.find((l) => l.key === activeKey);
  const [open, setOpen] = useState(true);
  const [category, setCategory] = useState<LessonCategory>(active?.category ?? "Circle");

  // Follow a lesson loaded from elsewhere (a saved graph, say) to its topic.
  useEffect(() => {
    if (active) setCategory(active.category);
  }, [active]);

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
            Circles, conics, triangles and polygons you can drag, with every measurement live.
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
            </div>
          )}
        </>
      )}
    </div>
  );
};
