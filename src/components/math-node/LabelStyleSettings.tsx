import React from "react";
import { FlipHorizontal2, FlipVertical2, RotateCcw } from "lucide-react";
import type { MathFunction } from "./mathTypes";
import { SETTINGS_SUBLABEL } from "./SettingsControls";

interface LabelStyleSettingsProps {
  f: MathFunction;
  onPatch: (patch: Partial<MathFunction> | ((fn: MathFunction) => Partial<MathFunction>)) => void;
}

const POSITIONS = [
  { id: undefined, label: "Auto", title: "Beside the shape (drag the label on the graph to place it)" },
  { id: "center", label: "Centre", title: "Exactly on the shape" },
  { id: "above", label: "Above", title: "Above the shape" },
  { id: "below", label: "Below", title: "Below the shape" },
  { id: "left", label: "Left", title: "To the left" },
  { id: "right", label: "Right", title: "To the right" },
] as const;

const ANGLES = [0, 90, 180, 270];

const RANGE = "flex-1 min-w-0 h-1.5 appearance-none rounded-full cursor-pointer accent-blue-500 bg-slate-200 dark:bg-slate-700";
const SEGMENTS = "flex gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800";
const segment = (on: boolean) =>
  `flex-1 h-6 px-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium transition-colors ${on
    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
  }`;
const toggle = (on: boolean) =>
  `h-7 px-2 inline-flex items-center gap-1.5 rounded-lg border text-[10px] font-medium transition-colors ${on
    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
    : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
  }`;

/** How a row's label sits on the graph: where, at what angle and size, flipped or not. */
export const LabelStyleSettings: React.FC<LabelStyleSettingsProps> = ({ f, onPatch }) => {
  const rotation = f.labelRotation ?? 0;
  const scale = f.labelScale ?? 1;
  // "custom" is a label that was dragged to its own place: shown as Auto.
  const position = f.labelAlignment && f.labelAlignment !== "custom" ? f.labelAlignment : undefined;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-2.5">
      <div className="flex items-center justify-between">
        <span className={SETTINGS_SUBLABEL}>Label style</span>
        <button
          type="button"
          onClick={() =>
            onPatch({
              labelRotation: 0,
              labelScale: 1.0,
              labelFlipX: false,
              labelFlipY: false,
              labelPosition: undefined,
              labelAlignment: undefined,
            })
          }
          title="Reset the label's style and position"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">Position</span>
        <div className={SEGMENTS} role="radiogroup" aria-label="Label position">
          {POSITIONS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={position === p.id}
              title={p.title}
              onClick={() => onPatch({ labelAlignment: p.id as MathFunction["labelAlignment"] })}
              className={segment(position === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span>Rotation</span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">{rotation}°</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="360"
            value={rotation}
            onChange={(e) => onPatch({ labelRotation: parseInt(e.target.value, 10) })}
            aria-label="Label rotation"
            className={RANGE}
          />
          <div className={`${SEGMENTS} shrink-0`}>
            {ANGLES.map((a) => (
              <button key={a} type="button" onClick={() => onPatch({ labelRotation: a })} className={`${segment(rotation === a)} min-w-8`}>
                {a}°
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span>Size</span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">{scale.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={scale}
          onChange={(e) => onPatch({ labelScale: parseFloat(e.target.value) })}
          aria-label="Label size"
          className={RANGE}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!!f.labelFlipX} onClick={() => onPatch((fn) => ({ labelFlipX: !fn.labelFlipX }))} className={toggle(!!f.labelFlipX)}>
          <FlipHorizontal2 size={12} /> Flip X
        </button>
        <button type="button" aria-pressed={!!f.labelFlipY} onClick={() => onPatch((fn) => ({ labelFlipY: !fn.labelFlipY }))} className={toggle(!!f.labelFlipY)}>
          <FlipVertical2 size={12} /> Flip Y
        </button>
        <button
          type="button"
          aria-pressed={!!f.showLabelPoint}
          onClick={() => onPatch((fn) => ({ showLabelPoint: !fn.showLabelPoint }))}
          title="Show a dot where the label is anchored"
          className={toggle(!!f.showLabelPoint)}
        >
          <span className="size-1.5 rounded-full bg-current" /> Anchor dot
        </button>
      </div>
    </div>
  );
};
