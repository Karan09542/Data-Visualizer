import React from "react";
import { Circle, Dot, Minus, MousePointer2, Pentagon, RulerDimensionLine, Slash, Triangle } from "lucide-react";
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

interface DrawToolbarProps {
  tool: DrawToolKind | null;
  onChange: (tool: DrawToolKind | null) => void;
}

/** The drawing tools, down the left edge of the graph. */
export const DrawToolbar: React.FC<DrawToolbarProps> = ({ tool, onChange }) => (
  <div
    data-no-trace
    data-capture-exclude
    data-graph-inset="left"
    role="toolbar"
    aria-label="Drawing tools"
    className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-0.5 p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30"
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
  </div>
);
