import { useEffect } from "react";
import { GraduationCap, Loader2, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { setFallbackWasShown } from "../preload";

export default function LearningGamesLoadingFallback() {
  const close = () => {
    useStore.getState().setIsLearningGamesOpen(false);
  };

  useEffect(() => {
    setFallbackWasShown(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9000]"
      role="dialog"
      aria-modal="true"
      aria-label="Loading Learning Games"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px] dark:bg-black/50 transition-opacity animate-in fade-in duration-200"
        onClick={close}
        aria-hidden
      />

      {/* Slide-in panel matching LearningGamesPanel */}
      <div
        className="absolute flex flex-col overflow-hidden bg-white text-slate-800 shadow-2xl outline-none dark:bg-[#0d1117] dark:text-slate-200 bottom-2 right-2 top-2 rounded-3xl border border-slate-200/80 dark:border-slate-800 max-md:inset-x-0 max-md:bottom-0 max-md:top-[max(0.75rem,env(safe-area-inset-top))] max-md:rounded-t-[1.75rem] animate-in slide-in-from-right duration-250 max-md:slide-in-from-bottom"
        style={{ width: "min(540px, calc(100vw - 1rem))" }}
      >
        {/* Header */}
        <header className="shrink-0 border-b border-slate-200/80 px-4 pb-3 pt-2 dark:border-slate-800 sm:px-5 md:pt-4">
          <div
            className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden"
            aria-hidden
          />
          <div className="mb-2 flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
              <GraduationCap size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                Learning Games
              </h1>
              <p className="flex items-center gap-1.5 truncate text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                <Loader2 size={11} className="animate-spin shrink-0" />
                <span className="truncate">Loading learning panel…</span>
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close Learning Games"
              className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Stepper Skeleton placeholder */}
          <div className="flex items-center gap-1 pt-1 overflow-x-auto [scrollbar-width:none]">
            {["My Words", "Create", "Play", "Results", "Review"].map((tab, idx) => (
              <div
                key={tab}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  idx === 0
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 font-semibold"
                    : "text-slate-400 dark:text-slate-500 opacity-60"
                }`}
              >
                <span>{tab}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Loading Main Body */}
        <main className="relative min-h-0 flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-inner">
            <GraduationCap size={28} className="animate-pulse" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Opening Learning Games…
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[280px]">
            Loading your words, custom sets, and crossword generator
          </p>

          <div className="mt-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            <Loader2 size={13} className="animate-spin text-indigo-500 shrink-0" />
            <span className="font-medium">Getting everything ready…</span>
          </div>
        </main>
      </div>
    </div>
  );
}
