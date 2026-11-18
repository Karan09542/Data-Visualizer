import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Library, ListMusic, Trash2, X } from "lucide-react";
import { useEngine, useLibrary, type Engine } from "./hooks";
import { GROUPS, TOOLS, tool as toolById, type Tool, type ToolId } from "./tools";
import { EngineSetup, bytes } from "./ui";
import { FxTool } from "./FxTool";
import { MergeTool } from "./MergeTool";
import { SplitTool } from "./SplitTool";
import { MixTool } from "./MixTool";
import { VideoTool } from "./VideoTool";
import { InspectTool } from "./InspectTool";
import { LibraryView } from "./LibraryView";
import type { FxParams } from "./commands";

type View = { kind: "home" } | { kind: "library" } | { kind: "tool"; id: ToolId; file: File | null; start?: Partial<FxParams>; n: number };

// ---------------------------------------------------------------- home

const BigTile: React.FC<{ t: Tool; onOpen: () => void }> = ({ t, onOpen }) => (
  <button
    onClick={onOpen}
    title={t.about}
    className="group flex flex-col items-center justify-center gap-2.5 aspect-[1.3] rounded-2xl bg-slate-100/80 dark:bg-white/[0.05] hover:bg-violet-500/10 dark:hover:bg-violet-500/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
  >
    <t.icon size={26} strokeWidth={1.5} className="text-slate-700 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" />
    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{t.label}</span>
  </button>
);

const Tile: React.FC<{ t: Tool; onOpen: () => void }> = ({ t, onOpen }) => (
  <button
    onClick={onOpen}
    title={t.about}
    className="group flex flex-col items-center justify-center gap-2 aspect-[1.08] px-1 rounded-2xl border border-slate-200 dark:border-white/[0.14] bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-400/60 hover:bg-violet-50/50 dark:hover:bg-violet-500/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
  >
    <t.icon size={22} strokeWidth={1.5} className="text-slate-700 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" />
    <span className="text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight text-center">{t.label}</span>
  </button>
);

const EngineStatus: React.FC<{ engine: Engine }> = ({ engine }) => {
  const [confirm, setConfirm] = useState(false);
  if (engine.status === "checking") return null;
  const on = engine.status === "ready";
  return (
    <div className="relative">
      <button
        onClick={() => on && setConfirm(!confirm)}
        className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${on ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10" : "border-slate-200 dark:border-white/10 text-slate-500"}`}
        title={on ? `ffmpeg ${bytes(engine.stored?.bytes ?? 0)} on this device (${engine.stored?.where === "opfs" ? "OPFS" : "IndexedDB"})` : "The audio engine isn't set up"}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : engine.status === "starting" || engine.status === "downloading" ? "bg-amber-400 animate-pulse" : "bg-slate-400"}`} />
        {on ? "Offline ready" : engine.status === "starting" ? "Starting…" : engine.status === "downloading" ? "Downloading…" : "Not set up"}
      </button>
      {confirm && (
        <div className="absolute right-0 top-10 z-20 w-64 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1f2b] shadow-xl text-xs text-slate-600 dark:text-slate-300">
          <p>
            ffmpeg ({bytes(engine.stored?.bytes ?? 0)}) is kept in {engine.stored?.where === "opfs" ? "private app storage (OPFS)" : "the browser database"}, so the tools work offline.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setConfirm(false)} className="h-8 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
              Keep
            </button>
            <button onClick={() => engine.remove().then(() => setConfirm(false))} className="h-8 px-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1.5 font-semibold">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Home: React.FC<{ engine: Engine; open: (id: ToolId) => void; library: () => void }> = ({ engine, open, library }) => {
  const items = useLibrary();
  return (
    <div className="flex flex-col gap-7">
      <EngineSetup engine={engine} />
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="text-[17px] font-medium text-slate-800 dark:text-slate-100 mb-3">{g.title}</h3>
          <div className={`grid gap-2.5 sm:gap-3 ${g.big ? "grid-cols-3" : "grid-cols-4"}`}>
            {g.ids.map((id) => {
              const t = toolById(id);
              return g.big ? <BigTile key={id} t={t} onOpen={() => open(id)} /> : <Tile key={id} t={t} onOpen={() => open(id)} />;
            })}
          </div>
        </section>
      ))}
      <button onClick={library} className="flex items-center gap-4 h-14 px-5 rounded-2xl bg-slate-100/80 dark:bg-transparent dark:border dark:border-white/25 hover:bg-violet-500/10 dark:hover:border-violet-400/60 transition-colors">
        <ListMusic size={22} strokeWidth={1.5} className="text-slate-700 dark:text-slate-200" />
        <span className="text-[17px] text-slate-800 dark:text-slate-100">Library</span>
        {!!items?.length && <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 text-xs font-semibold">{items.length}</span>}
        <ChevronRight size={20} className="ml-auto text-slate-500" />
      </button>
    </div>
  );
};

/** Pick the next tool for a file (from a result or the library). */
const UseIn: React.FC<{ file: File; onPick: (id: ToolId) => void; onClose: () => void }> = ({ file, onPick, onClose }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141922] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Use in another tool</p>
            <p className="text-xs text-slate-500 truncate">{file.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TOOLS.filter((t) => t.id !== "toMp3").map((t) => (
            <Tile key={t.id} t={t} onOpen={() => onPick(t.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- the editor

export const AudioEditor = () => {
  const engine = useEngine();
  const [view, setView] = useState<View>({ kind: "home" });
  const [carry, setCarry] = useState<File | null>(null);
  const open = (id: ToolId, file: File | null = null, start?: Partial<FxParams>) => (setCarry(null), setView({ kind: "tool", id, file, start, n: Date.now() }));
  const library = () => setView({ kind: "library" });
  const t = view.kind === "tool" ? toolById(view.id) : null;
  const setFile = (file: File | null) => setView((v) => (v.kind === "tool" ? { ...v, file } : v));
  const common = { ready: engine.ready, onUse: setCarry, onLibrary: library };

  const body = () => {
    if (view.kind === "home") return <Home engine={engine} open={(id) => open(id)} library={library} />;
    if (view.kind === "library") return <LibraryView onUse={setCarry} />;
    switch (view.id) {
      case "merge":
        return <MergeTool key={view.n} {...common} file={view.file} />;
      case "mix":
        return <MixTool key={view.n} {...common} file={view.file} />;
      case "split":
        return <SplitTool key={view.n} {...common} file={view.file} onFile={setFile} />;
      case "toVideo":
        return <VideoTool key={view.n} ready={engine.ready} file={view.file} onFile={setFile} onLibrary={library} />;
      case "inspect":
        return <InspectTool key={view.n} ready={engine.ready} file={view.file} onFile={setFile} onOpen={open} />;
      default:
        return <FxTool key={view.n} tool={t!} {...common} file={view.file} start={view.start} onFile={setFile} />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full bg-white dark:bg-[#0c0f16]">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-6 flex flex-col gap-5">
        <header className="flex items-center gap-3 min-h-[44px]">
          {view.kind === "home" ? (
            <h2 className="text-2xl sm:text-[26px] font-medium tracking-tight text-slate-900 dark:text-white">Audio Editor</h2>
          ) : (
            <>
              <button onClick={() => setView({ kind: "home" })} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center shrink-0" aria-label="All tools" title="All tools">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 leading-tight">
                  {t ? <t.icon size={18} className="text-violet-500" /> : <Library size={18} className="text-violet-500" />}
                  {t ? t.label : "Library"}
                </h2>
                <p className="text-xs text-slate-500 truncate">{t ? t.about : "Everything you've made, on this device"}</p>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {view.kind === "tool" && (
              <button onClick={library} className="h-8 px-3 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1.5" title="Library">
                <ListMusic size={15} /> <span className="hidden sm:inline">Library</span>
              </button>
            )}
            <EngineStatus engine={engine} />
          </div>
        </header>
        {view.kind !== "home" && <EngineSetup engine={engine} />}
        {body()}
      </div>
      {carry && <UseIn file={carry} onClose={() => setCarry(null)} onPick={(id) => open(id, carry)} />}
    </div>
  );
};
