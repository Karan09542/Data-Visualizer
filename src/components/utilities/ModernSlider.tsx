import React, { useId, useState } from "react";

export interface SliderMark {
  value: number;
  label: string;
}

interface ModernSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Shown at the right of the label and in the bubble while dragging; the number if left out. */
  format?: (value: number) => string;
  /** Words under each end, e.g. "Smaller file" / "Better quality". */
  ends?: [string, string];
  /** Quick picks shown as chips under the track. */
  marks?: SliderMark[];
  disabled?: boolean;
}

/**
 * A range slider with a filled track, a round thumb and a value bubble while it's dragged. It is
 * a real <input type="range"> underneath, so keyboard, screen readers and touch work as usual.
 */
export const ModernSlider: React.FC<ModernSliderProps> = ({ label, value, min, max, step = 1, onChange, format, ends, marks, disabled }) => {
  const id = useId();
  const [active, setActive] = useState(false);
  const p = max > min ? (value - min) / (max - min) : 0;
  const shown = format ? format(value) : String(value);
  // The thumb is 20px wide and travels the track minus its own width: keep fill and bubble on its centre
  const at = `calc(${p * 100}% + ${10 - p * 20}px)`;

  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}
        </label>
        <span className="text-xs font-semibold tabular-nums text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
          {shown}
        </span>
      </div>

      <div className="relative h-6 select-none">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
          style={{ width: at }}
        />
        {/* bubble while dragging */}
        <div
          className={`absolute -top-8 -translate-x-1/2 px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-semibold tabular-nums shadow-lg pointer-events-none transition-opacity duration-100 ${active ? "opacity-100" : "opacity-0"}`}
          style={{ left: at }}
          aria-hidden
        >
          {shown}
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={shown}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onPointerCancel={() => setActive(false)}
          onBlur={() => setActive(false)}
          className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer focus:outline-none
            [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100 active:[&::-webkit-slider-thumb]:scale-110
            focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-violet-500/30
            [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-violet-500 [&::-moz-range-thumb]:shadow-md"
        />
      </div>

      {ends && (
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}

      {marks && marks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {marks.map((m) => {
            const on = m.value === value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => onChange(m.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  on
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
