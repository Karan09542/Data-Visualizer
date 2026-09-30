import React, { useState } from "react";
import { BookOpen, ChevronRight, Keyboard, Lightbulb, Maximize2, PencilRuler, X } from "lucide-react";

/** Starting points offered on an empty graph: each is just a row, typed for you. */
export const EXAMPLE_ROWS = [
  { label: "y = sin(x)", expr: "y = sin(x)" },
  { label: "x² + y² = 9", expr: "x^2 + y^2 = 9" },
  { label: "r = 1 + cos(θ)", expr: "r = 1 + cos(theta)" },
  { label: "[cos 3t, sin 2t]", expr: "[cos(3t), sin(2t)]" },
  { label: "y < x² − 2", expr: "y < x^2 - 2" },
  { label: "A = [2, 1]", expr: "A = [2, 1]" },
];

interface EmptyGraphProps {
  compact: boolean;
  onType: () => void;
  onDraw: () => void;
  onLessons: () => void;
  onExample: (expr: string) => void;
  onOpen: () => void;
}

/** What an empty graph shows: ways to start, so nobody faces a blank grid. */
export const EmptyGraph: React.FC<EmptyGraphProps> = ({ compact, onType, onDraw, onLessons, onExample, onOpen }) => {
  if (compact) {
    return (
      <div data-no-trace data-capture-exclude className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
        <button
          type="button"
          onClick={onOpen}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:text-blue-600 dark:hover:text-blue-400"
        >
          <Maximize2 size={13} /> Empty graph. Open it to start
        </button>
      </div>
    );
  }

  const action = (Icon: React.ElementType, title: string, hint: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-2.5 p-2.5 rounded-lg text-left border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors"
    >
      <Icon size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="block text-[10px] leading-snug text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </button>
  );

  return (
    <div data-no-trace data-capture-exclude className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Start your graph</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Type any equation and its kind is worked out for you, or draw shapes straight onto the grid.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {action(Keyboard, "Type an equation", "y = …, x² + y² = …, r = …", onType)}
          {action(PencilRuler, "Draw a shape", "Points, circles, polygons", onDraw)}
          {action(BookOpen, "Open a lesson", "Circles, conics, triangles", onLessons)}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Or try one</span>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_ROWS.map((ex) => (
              <button
                key={ex.expr}
                type="button"
                onClick={() => onExample(ex.expr)}
                className="px-2 py-1 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TIPS = [
  "Type anything: y = x², x² + y² = 4, r = 1 + cos(θ), [cos t, sin t] or A = [1, 2]. The kind is detected for you.",
  "Hold Shift and move over a curve to trace it and read its coordinates. On a touch screen, tap the curve.",
  "The tools on the left draw points, segments, circles and polygons, and measure distances and angles.",
  "Select (second tool on the left): click a shape or drag a box round several, then move, turn, resize or delete them.",
  "With the Point tool, click on a shape: a polygon gets a new corner, a circle a point that resizes it, a curve a point that slides along it.",
  "Points with a soft halo can be dragged. Live drag (⚡) keeps everything built on them following.",
  "Area: switch it on, then click inside any closed region to measure it.",
  "Labels can show live values: A = {{xy}}, or r = {{r}} for a slider r.",
  "DEG/RAD sets the angle unit for the equations you type: in degrees, sin(30) = 0.5. Lessons and drawn shapes keep working either way.",
  "The camera in the header saves, copies or adds a picture of the graph to the canvas.",
];

const TIPS_KEY = "mathNode.tipsHidden";

/** A tip at a time along the bottom of the graph, until dismissed. */
export const GraphTips: React.FC = () => {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(TIPS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  if (hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(TIPS_KEY, "1");
    } catch {
      // Still hidden for this visit.
    }
  };

  return (
    <div
      data-no-trace
      data-capture-exclude
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 w-[min(34rem,calc(100%-6rem))] flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-md text-[11px] text-slate-600 dark:text-slate-300"
    >
      <Lightbulb size={13} className="shrink-0 text-amber-500" />
      <span className="flex-1 min-w-0 leading-snug">{TIPS[index]}</span>
      <button
        type="button"
        onClick={() => setIndex((i) => (i + 1) % TIPS.length)}
        title="Next tip"
        className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        Next <ChevronRight size={11} />
      </button>
      <button
        type="button"
        onClick={hide}
        title="Hide tips"
        aria-label="Hide tips"
        className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X size={12} />
      </button>
    </div>
  );
};
