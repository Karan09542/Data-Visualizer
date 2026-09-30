import React, { useState } from "react";
import {
  ChevronLeft,
  Circle,
  Dot,
  Minus,
  MousePointer2,
  PencilRuler,
  Pentagon,
  RulerDimensionLine,
  Slash,
  Triangle,
} from "lucide-react";
import { DRAW_TOOL_HINTS, type DrawToolKind } from "./DrawTool";

const TOOLS: { id: DrawToolKind | null; label: string; Icon: React.ElementType }[] = [
  { id: null, label: "Move the graph", Icon: MousePointer2 },
  { id: "point", label: "Point", Icon: Dot },
  { id: "segment", label: "Segment", Icon: Minus },
  { id: "line", label: "Line", Icon: Slash },
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "polygon", label: "Polygon", Icon: Pentagon },
  { id: "distance", label: "Measure distance", Icon: RulerDimensionLine },
  { id: "angle", label: "Measure angle", Icon: Triangle },
];

const HIDDEN_KEY = "mathNode.drawToolsHidden";

interface DrawToolbarProps {
  tool: DrawToolKind | null;
  onChange: (tool: DrawToolKind | null) => void;
}

const SHELL =
  "absolute left-2 top-1/2 -translate-y-1/2 z-40 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30";

/**
 * The drawing tools, down the left edge of the graph. They fold away to a
 * single button (remembered per browser) for anyone who only types equations.
 */
export const DrawToolbar: React.FC<DrawToolbarProps> = ({ tool, onChange }) => {
  const [hidden, setHiddenState] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const setHidden = (value: boolean) => {
    setHiddenState(value);
    // Putting the tools away puts down whichever one is in hand.
    if (value) onChange(null);
    try {
      localStorage.setItem(HIDDEN_KEY, value ? "1" : "0");
    } catch {
      // Still applies for this visit.
    }
  };

  // A tool picked up elsewhere ("Draw a shape" on an empty graph) shows the tools again.
  if (hidden && !tool) {
    return (
      <button
        type="button"
        data-no-trace
        data-capture-exclude
        onClick={() => setHidden(false)}
        title="Show the drawing tools"
        aria-label="Show the drawing tools"
        className={`${SHELL} size-8 inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-70 hover:opacity-100 transition-opacity`}
      >
        <PencilRuler size={15} />
      </button>
    );
  }

  return (
    <div
      data-no-trace
      data-capture-exclude
      data-graph-inset="left"
      role="toolbar"
      aria-label="Drawing tools"
      className={`${SHELL} flex flex-col gap-0.5 p-1`}
    >
      {TOOLS.map(({ id, label, Icon }, i) => {
        const active = tool === id;
        return (
          <React.Fragment key={label}>
            {i === 6 && <div className="h-px mx-1 my-0.5 bg-slate-200 dark:bg-slate-700" />}
            <button
              type="button"
              onClick={() => onChange(active && id ? null : id)}
              aria-pressed={active}
              title={`${label}\n${id ? DRAW_TOOL_HINTS[id] : "Drag to pan, scroll to zoom"}`}
              className={`size-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={16} strokeWidth={id === "point" ? 4 : 2} />
            </button>
          </React.Fragment>
        );
      })}
      <div className="h-px mx-1 my-0.5 bg-slate-200 dark:bg-slate-700" />
      <button
        type="button"
        onClick={() => setHidden(true)}
        title="Hide the drawing tools"
        aria-label="Hide the drawing tools"
        className="h-6 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
    </div>
  );
};
