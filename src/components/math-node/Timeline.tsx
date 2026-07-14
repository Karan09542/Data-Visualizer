import React, { useState } from "react";
import { Crosshair, SkipBack, Pause, Play, Settings } from "lucide-react";

interface TimelineProps {
  tracePoints: boolean;
  setTracePoints: (trace: boolean) => void;
  timeBounds: { min: number; max: number; speed: number };
  setTimeBounds: React.Dispatch<
    React.SetStateAction<{ min: number; max: number; speed: number }>
  >;
  time: number;
  setTime: (t: number) => void;
  timeRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  timeMode: "continuous" | "loop" | "bounce";
  setTimeMode: (mode: "continuous" | "loop" | "bounce") => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracePoints,
  setTracePoints,
  timeBounds,
  setTimeBounds,
  time,
  setTime,
  timeRef,
  isPlaying,
  setIsPlaying,
  timeMode,
  setTimeMode,
}) => {
  const [showTimeSettings, setShowTimeSettings] = useState(false);

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
          Timeline
        </h3>
        <button
          onClick={() => setTracePoints(!tracePoints)}
          className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${tracePoints ? "bg-emerald-500/20 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          title="Trace Points"
        >
          <Crosshair size={12} /> Trace
        </button>
      </div>

      <div className="flex items-center gap-2 justify-center bg-slate-50 dark:bg-slate-900/50 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
        <button
          onClick={() => {
            setTime(timeBounds.min);
            timeRef.current = timeBounds.min;
          }}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-905 dark:hover:text-white transition-colors"
          title="Reset Time"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2.5 rounded-full text-white shadow-md transition-transform hover:scale-105 ${isPlaying ? "bg-slate-600 hover:bg-slate-500" : "bg-blue-600 hover:bg-blue-500"}`}
        >
          {isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <button
          onClick={() => setShowTimeSettings(!showTimeSettings)}
          className={`p-1.5 rounded transition-colors ${showTimeSettings ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"}`}
          title="Timeline Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showTimeSettings && (
        <div className="flex flex-col gap-2 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-705 dark:text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Range
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={timeBounds.min}
                onChange={(e) =>
                  setTimeBounds((prev) => ({
                    ...prev,
                    min: Number(e.target.value),
                  }))
                }
                className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                title="Start Time"
              />
              <span className="text-slate-500 text-[10px]">to</span>
              <input
                type="number"
                value={timeBounds.max}
                onChange={(e) =>
                  setTimeBounds((prev) => ({
                    ...prev,
                    max: Number(e.target.value),
                  }))
                }
                className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                title="End Time"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Mode
            </span>
            <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded border border-slate-300 dark:border-slate-700">
              {(["continuous", "loop", "bounce"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTimeMode(m)}
                  className={`px-2 py-0.5 rounded capitalize ${timeMode === m ? "bg-blue-600 text-white shadow-xs" : "hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Speed
            </span>
            <input
              type="number"
              step="0.1"
              value={timeBounds.speed}
              onChange={(e) =>
                setTimeBounds((prev) => ({
                  ...prev,
                  speed: Number(e.target.value),
                }))
              }
              className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
              title="Playback Speed"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
        <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 font-mono">
          <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
            time
          </span>
          <span>{time.toFixed(2)}</span>
        </div>

        {timeMode !== "continuous" && (
          <div className="w-full flex items-center justify-center">
            <input
              type="range"
              min={timeBounds.min}
              max={timeBounds.max}
              step={(timeBounds.max - timeBounds.min) / 1000}
              value={time}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTime(val);
                timeRef.current = val;
              }}
              onMouseDown={() => setIsPlaying(false)}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors accent-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
