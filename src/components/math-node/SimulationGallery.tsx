import React, { useState } from "react";
import { ChevronDown, Hand, Play } from "lucide-react";
import { SIMULATIONS } from "./simulations";

interface SimulationGalleryProps {
  activeKey: string | null;
  onLoad: (key: string) => void;
}

/**
 * Physics labs at the top of the sidebar. Each card says what it shows and what to
 * try, so opening one is a lesson rather than a wall of equations.
 */
export const SimulationGallery: React.FC<SimulationGalleryProps> = ({ activeKey, onLoad }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-semibold tracking-wider"
      >
        <span>Simulations</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <>
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Points with a soft halo can be dragged on the graph. Press play to run.
          </p>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
            {SIMULATIONS.map((sim) => {
              const active = activeKey === sim.key;
              return (
                <button
                  key={sim.key}
                  type="button"
                  onClick={() => onLoad(sim.key)}
                  title={sim.tryThis.join("\n")}
                  className={`group text-left p-2 rounded-lg border shadow-sm transition-all flex flex-col gap-1 ${
                    active
                      ? `bg-slate-50 dark:bg-slate-800 ring-1 ${sim.accent.ring}`
                      : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${sim.accent.dot}`} />
                    <span className={`text-[11px] font-semibold ${sim.accent.text}`}>{sim.title}</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {sim.topic}
                  </span>
                  <span className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                    {sim.summary}
                  </span>
                </button>
              );
            })}
          </div>

          {(() => {
            const sim = SIMULATIONS.find((s) => s.key === activeKey);
            if (!sim) return null;
            return (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  <Hand size={12} className="text-sky-500" />
                  Try this
                </span>
                <ol className="list-decimal pl-4 flex flex-col gap-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                  {sim.tryThis.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ol>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <Play size={10} /> Start and reset are in the Timeline below.
                </span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
