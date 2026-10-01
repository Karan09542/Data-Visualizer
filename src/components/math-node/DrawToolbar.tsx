import React, { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  Circle,
  Dot,
  Minus,
  MousePointer2,
  SquareDashedMousePointer,
  PencilRuler,
  Pentagon,
  RulerDimensionLine,
  Slash,
  Triangle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { DRAW_TOOL_HINTS, SELECT_TOOL_HINT, type GraphTool } from "./DrawTool";
import type { VectorOptions } from "./drawRows";

const TOOLS: { id: GraphTool | null; label: string; Icon: React.ElementType }[] = [
  { id: null, label: "Move the graph", Icon: MousePointer2 },
  { id: "select", label: "Select a shape", Icon: SquareDashedMousePointer },
  { id: "point", label: "Point", Icon: Dot },
  { id: "segment", label: "Segment", Icon: Minus },
  { id: "vector", label: "Vector", Icon: ArrowUpRight },
  { id: "line", label: "Line", Icon: Slash },
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "polygon", label: "Polygon", Icon: Pentagon },
  { id: "distance", label: "Measure distance", Icon: RulerDimensionLine },
  { id: "angle", label: "Measure angle", Icon: Triangle },
];

const HIDDEN_KEY = "mathNode.drawToolsHidden";
const OPTIONS_OPEN_KEY = "mathNode.vectorOptionsOpen";

interface DrawToolbarProps {
  tool: GraphTool | null;
  onChange: (tool: GraphTool | null) => void;
  /** What a drawn vector is labelled with, offered beside the tools while Vector is in hand. */
  vectorOptions: VectorOptions;
  onToggleVectorOption: (key: keyof VectorOptions) => void;
  /** Whether the graph shows the angle where two vectors share an end point. */
  vectorAngles: boolean;
  onToggleVectorAngles: () => void;
  /** Whether the graph shows the resultant of vectors that are joined. */
  vectorResultants: boolean;
  onToggleVectorResultants: () => void;
  /** Draw a vector between two positions typed in (rather than clicked). */
  onDrawVector: (tail: [number, number], tip: [number, number]) => void;
}

const FIELD =
  "w-full min-w-0 h-6 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-100 tabular-nums outline-none focus:border-blue-500";

/** A vector from typed numbers: a start, then its components or its length and angle. */
const VectorByNumbers: React.FC<{ onDraw: DrawToolbarProps["onDrawVector"] }> = ({ onDraw }) => {
  const [mode, setMode] = useState<"parts" | "polar">("parts");
  const [from, setFrom] = useState(["0", "0"]);
  const [parts, setParts] = useState(["3", "4"]);
  const [polar, setPolar] = useState(["5", "30"]);
  const values = mode === "parts" ? parts : polar;
  const setValues = mode === "parts" ? setParts : setPolar;

  const x0 = Number(from[0]);
  const y0 = Number(from[1]);
  const p = Number(values[0]);
  const q = Number(values[1]);
  // Components as given; length and angle (degrees from +x, anticlockwise) turned into them.
  const dx = mode === "parts" ? p : p * Math.cos((q * Math.PI) / 180);
  const dy = mode === "parts" ? q : p * Math.sin((q * Math.PI) / 180);
  const filled = [...from, ...values].every((s) => s.trim() !== "");
  const valid = filled && [x0, y0, dx, dy].every(Number.isFinite) && (dx !== 0 || dy !== 0);

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex-1 min-w-0 flex items-center gap-1">
      <span className="shrink-0 text-[10px] text-slate-400">{label}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && valid) onDraw([x0, y0], [x0 + dx, y0 + dy]);
        }}
        className={FIELD}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex gap-1.5">
        {field("from x", from[0], (v) => setFrom([v, from[1]]))}
        {field("y", from[1], (v) => setFrom([from[0], v]))}
      </div>
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800" role="radiogroup" aria-label="Given as">
        {(
          [
            ["parts", "⟨x, y⟩"],
            ["polar", "length, angle"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${mode === id
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {field(mode === "parts" ? "x" : "len", values[0], (v) => setValues([v, values[1]]))}
        {field(mode === "parts" ? "y" : "∠°", values[1], (v) => setValues([values[0], v]))}
      </div>
      <button
        type="button"
        disabled={!valid}
        onClick={() => onDraw([x0, y0], [x0 + dx, y0 + dy])}
        className="h-6 rounded-md bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Draw vector
      </button>
    </div>
  );
};

const VECTOR_OPTIONS: { key: keyof VectorOptions; label: string; example: string }[] = [
  { key: "magnitude", label: "Magnitude", example: "its length: |AB| = 5.00" },
  { key: "components", label: "Components", example: "how far along x and y: ⟨3, 4⟩" },
  { key: "direction", label: "Direction", example: "its angle from the +x axis: 53.1°" },
];

const SHELL =
  "absolute left-2 top-1/2 -translate-y-1/2 z-40 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30";

/**
 * The drawing tools, down the left edge of the graph. They fold away to a
 * single button (remembered per browser) for anyone who only types equations.
 */
export const DrawToolbar: React.FC<DrawToolbarProps> = ({
  tool,
  onChange,
  vectorOptions,
  onToggleVectorOption,
  vectorAngles,
  onToggleVectorAngles,
  vectorResultants,
  onToggleVectorResultants,
  onDrawVector,
}) => {
  // The vector options fold away to one button: shut at first on a phone, where the
  // graph needs the room; open at first on a wider screen. Remembered once changed.
  const [optionsOpen, setOptionsOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(OPTIONS_OPEN_KEY);
      if (saved === "1" || saved === "0") return saved === "1";
    } catch {
      // Fall through to the screen size.
    }
    return typeof window === "undefined" || window.matchMedia?.("(min-width: 768px)").matches !== false;
  });
  const setOptionsOpen = (open: boolean) => {
    setOptionsOpenState(open);
    try {
      localStorage.setItem(OPTIONS_OPEN_KEY, open ? "1" : "0");
    } catch {
      // Still applies for this visit.
    }
  };

  const checkRow = (key: string, on: boolean, toggle: () => void, label: string, example: string) => (
    <button
      key={key}
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={toggle}
      className="flex items-center gap-2 px-1.5 py-1 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      <span
        className={`size-3.5 shrink-0 rounded border flex items-center justify-center ${on
          ? "bg-blue-600 border-blue-600 text-white"
          : "border-slate-300 dark:border-slate-600"
          }`}
      >
        {on && <Check size={10} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="block text-[10px] leading-snug text-slate-400">{example}</span>
      </span>
    </button>
  );

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
    <>
    <div
      data-no-trace
      data-capture-exclude
      data-graph-inset="left"
      role="toolbar"
      aria-label="Drawing tools"
      // On a short graph the tools scroll rather than run off its top and bottom.
      className={`${SHELL} flex flex-col gap-0.5 p-1 max-h-[calc(100%-1rem)] overflow-y-auto no-scrollbar`}
    >
      {TOOLS.map(({ id, label, Icon }, i) => {
        const active = tool === id;
        return (
          <React.Fragment key={label}>
            {(i === 2 || id === "distance") && <div className="h-px mx-1 my-0.5 bg-slate-200 dark:bg-slate-700" />}
            <button
              type="button"
              onClick={() => onChange(active && id ? null : id)}
              aria-pressed={active}
              title={`${label}\n${id === "select" ? SELECT_TOOL_HINT : id ? DRAW_TOOL_HINTS[id] : "Drag to pan, scroll to zoom"}`}
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
    {tool === "vector" && !optionsOpen && (
      <button
        type="button"
        data-no-trace
        data-capture-exclude
        onClick={() => setOptionsOpen(true)}
        title="Vector options: labels, angles, resultant, draw by numbers"
        className="absolute left-14 top-1/2 -translate-y-1/2 z-40 h-8 inline-flex items-center gap-1.5 pl-2 pr-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <SlidersHorizontal size={13} />
        Options
        {VECTOR_OPTIONS.some((o) => vectorOptions[o.key]) && <span className="size-1.5 rounded-full bg-blue-500" />}
      </button>
    )}
    {tool === "vector" && optionsOpen && (
      <div
        data-no-trace
        data-capture-exclude
        role="group"
        aria-label="Vector options"
        className="absolute left-14 top-1/2 -translate-y-1/2 z-40 w-52 max-h-[calc(100%-1rem)] overflow-y-auto no-scrollbar p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30 flex flex-col gap-1"
      >
        <div className="flex items-center justify-between pl-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vector: show</span>
          <button
            type="button"
            onClick={() => setOptionsOpen(false)}
            title="Fold the options away"
            aria-label="Close vector options"
            className="size-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        {VECTOR_OPTIONS.map(({ key, label, example }) =>
          checkRow(key, !!vectorOptions[key], () => onToggleVectorOption(key), label, example),
        )}
        <p className="px-1 text-[10px] leading-snug text-slate-400">
          {VECTOR_OPTIONS.some((o) => vectorOptions[o.key]) ? "Added as a live label beside the arrow." : "None ticked: a plain arrow."}
        </p>
        <div className="h-px mx-1 my-0.5 bg-slate-200 dark:bg-slate-700" />
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">On the graph</div>
        {checkRow("angles", vectorAngles, onToggleVectorAngles, "Angle between vectors", "where two share a point")}
        {checkRow("resultants", vectorResultants, onToggleVectorResultants, "Resultant", "the sum of joined vectors, in red")}
        <div className="h-px mx-1 my-0.5 bg-slate-200 dark:bg-slate-700" />
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">By numbers</div>
        <VectorByNumbers onDraw={onDrawVector} />
      </div>
    )}
    </>
  );
};
