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
    <div className="flex flex-col gap-3 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          Timeline
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTracePoints(!tracePoints)}
            className={`px-2 py-1 rounded-md transition-all text-xs flex items-center gap-1.5 font-medium border shadow-sm ${tracePoints ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750"}`}
            title="Trace Points"
          >
            <Crosshair size={13} className={tracePoints ? "text-emerald-500" : "text-slate-400"} /> Trace
          </button>
          <button
            onClick={() => setShowTimeSettings(!showTimeSettings)}
            className={`p-1.5 rounded-md transition-all border shadow-sm ${showTimeSettings ? "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-400" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750"}`}
            title="Timeline Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showTimeSettings && (
        <div className="flex flex-col gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner origin-top animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Time Range
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={timeBounds.min}
                onChange={(e) =>
                  setTimeBounds((prev) => ({
                    ...prev,
                    min: Number(e.target.value),
                  }))
                }
                className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center shadow-sm"
                title="Start Time"
              />
              <span className="text-slate-400 italic">to</span>
              <input
                type="number"
                value={timeBounds.max}
                onChange={(e) =>
                  setTimeBounds((prev) => ({
                    ...prev,
                    max: Number(e.target.value),
                  }))
                }
                className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center shadow-sm"
                title="End Time"
              />
            </div>
          </div>

          <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50" />

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Playback Mode
            </span>
            <div className="flex gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-700 shadow-inner">
              {(["continuous", "loop", "bounce"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTimeMode(m)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${timeMode === m ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "hover:bg-slate-300/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50" />

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Animation Speed
            </span>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={timeBounds.speed}
                onChange={(e) =>
                  setTimeBounds((prev) => ({
                    ...prev,
                    speed: Number(e.target.value),
                  }))
                }
                className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-md pl-2 pr-6 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-right shadow-sm"
                title="Playback Speed"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">x</span>
            </div>
          </div>
        </div>
      )}

      {/* Playback & Timeline Unified Bar */}
      <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          {/* Controls Group */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <button
              onClick={() => {
                setTime(timeBounds.min);
                timeRef.current = timeBounds.min;
              }}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-none hover:shadow-sm"
              title="Reset Time"
            >
              <SkipBack size={15} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1.5 rounded-md text-white shadow-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isPlaying ? "bg-slate-600 hover:bg-slate-500 dark:bg-slate-600" : "bg-blue-600 hover:bg-blue-500 dark:bg-blue-600"}`}
              style={{ width: '28px', height: '28px' }}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={14} fill="currentColor" />
              ) : (
                <Play size={14} className="ml-0.5" fill="currentColor" />
              )}
            </button>
          </div>

          {/* Time Display & Slider */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Time
              </span>
              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/80 shadow-inner">
                {time.toFixed(2)}
              </span>
            </div>
            {timeMode !== "continuous" ? (
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
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:shadow-sm hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95 [&::-moz-range-thumb]:transition-transform"
              />
            ) : (
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                <div className={`absolute top-0 bottom-0 left-0 bg-blue-500/40 dark:bg-blue-400/40 w-full transition-opacity ${isPlaying ? "animate-pulse" : "opacity-50"}`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
