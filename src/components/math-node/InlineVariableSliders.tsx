import React, { useEffect, useRef } from "react";
import { Sliders, RotateCcw } from "lucide-react";
import { getVarColor, type MathVariable } from "./mathTypes";

interface InlineVariableSlidersProps {
  /** Only the variables this equation actually uses. */
  variables: MathVariable[];
  open: boolean;
  onToggle: () => void;
  /** Writes straight to the global variables, so both views stay in sync. */
  onUpdate: (id: string, updates: Partial<MathVariable>) => void;
  /** Opens the full editor for a variable. */
  onEdit?: (variable: MathVariable) => void;
}

/**
 * Sliders for the parameters used in one equation, shown under its input. They edit the
 * same variables as the Variables Manager — this is a view of them, not a copy.
 */
export const InlineVariableSliders: React.FC<InlineVariableSlidersProps> = ({
  variables,
  open,
  onToggle,
  onUpdate,
  onEdit,
}) => {
  // Dragging fires faster than the screen refreshes; commit once per frame.
  const pendingRef = useRef<{ id: string; value: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const commit = (id: string, value: number) => {
    pendingRef.current = { id, value };
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) onUpdate(pending.id, { value: pending.value });
    });
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  if (variables.length === 0) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 nodrag">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
        title={open ? "Hide parameter sliders" : "Show sliders for this equation's parameters"}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <Sliders size={12} />
          Parameters
          <span className="rounded bg-slate-200 px-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {variables.length}
          </span>
        </span>
        <span
          className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${open ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-700"}`}
        >
          <span
            className={`inline-block size-3 transform rounded-full bg-white shadow transition-transform ${open ? "translate-x-3.5" : "translate-x-0.5"}`}
          />
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-2.5 py-2 dark:border-slate-800">
          {variables.map((v) => {
            const color = getVarColor(v.name);
            return (
              <div key={v.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit?.(v)}
                  title={v.displayName || `Edit ${v.name}`}
                  className="w-12 shrink-0 truncate text-left font-mono text-[11px] font-semibold hover:underline"
                  style={{ color }}
                >
                  {v.name}
                </button>
                <input
                  type="range"
                  min={v.min}
                  max={v.max}
                  step={v.step}
                  value={v.value}
                  onChange={(e) => commit(v.id, parseFloat(e.target.value))}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 outline-none dark:bg-slate-700"
                  style={{ color, accentColor: color }}
                />
                <input
                  type="number"
                  step={v.step}
                  value={Number(v.value.toFixed(4))}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    if (!isNaN(next)) onUpdate(v.id, { value: next });
                  }}
                  className="w-14 shrink-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-right font-mono text-[10px] text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => onUpdate(v.id, { value: v.defaultValue })}
                  title={`Reset ${v.name} to ${v.defaultValue}`}
                  className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
