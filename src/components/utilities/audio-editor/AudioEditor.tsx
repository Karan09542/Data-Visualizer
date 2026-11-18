import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ListMusic, Trash2, X } from "lucide-react";
import { useEngine, useLibrary, type Engine } from "./hooks";
import { GROUPS, TOOLS, tool as toolById, type Tool, type ToolId } from "./tools";
import { ACCENTS, AccentProvider } from "./palette";
import { EngineSetup, IconButton, bytes, card, muted } from "./ui";
import { FxTool } from "./FxTool";
import { MergeTool } from "./MergeTool";
import { SplitTool } from "./SplitTool";
import { MixTool } from "./MixTool";
import { VideoTool } from "./VideoTool";
import { InspectTool } from "./InspectTool";
import { LibraryView } from "./LibraryView";
import type { FxParams } from "./commands";

type View = { kind: "home" } | { kind: "library" } | { kind: "tool"; id: ToolId; file: File | null; start?: Partial<FxParams>; n: number };

const accentOf = (t: Tool | null) => ACCENTS[t?.color ?? "indigo"];

// ---------------------------------------------------------------- home

/** Large card: coloured icon, name and a line about it. */
const FeatureTile: React.FC<{ t: Tool; onOpen: () => void }> = ({ t, onOpen }) => {
  const a = accentOf(t);
  return (
    <button onClick={onOpen} className={`${card} group h-[118px] p-4 flex flex-col justify-between text-left hover:shadow-md hover:-translate-y-px transition-all focus:outline-none focus-visible:ring-2 ${a.ring} ${a.hover}`}>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.icon}`}>
        <t.icon size={20} strokeWidth={1.9} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t.label}</span>
        <span className={`block text-xs leading-snug line-clamp-1 ${muted}`}>{t.about}</span>
      </span>
    </button>
  );
};

const Tile: React.FC<{ t: Tool; onOpen: () => void }> = ({ t, onOpen }) => {
  const a = accentOf(t);
  return (
    <button onClick={onOpen} title={t.about} className={`${card} group h-[96px] px-1 flex flex-col items-center justify-center gap-2 hover:shadow-md hover:-translate-y-px transition-all focus:outline-none focus-visible:ring-2 ${a.ring} ${a.hover}`}>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${a.icon}`}>
        <t.icon size={19} strokeWidth={1.9} />
      </span>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight text-center">{t.label}</span>
    </button>
  );
};

/** Engine state pill. `compact`: on phones only the dot shows (the text is in the tooltip). */
const EngineStatus: React.FC<{ engine: Engine; compact?: boolean }> = ({ engine, compact }) => {
  const [open, setOpen] = useState(false);
  if (engine.status === "checking") return null;
  const on = engine.status === "ready";
  const busy = engine.status === "starting" || engine.status === "downloading";
  const label = on ? "Works offline" : engine.status === "starting" ? "Starting…" : engine.status === "downloading" ? "Downloading…" : "Not set up";
  return (
    <div className="relative">
      <button
        onClick={() => on && setOpen(!open)}
        title={label}
        aria-label={label}
        className={`h-7 ${compact ? "w-7 justify-center sm:w-auto sm:px-2.5" : "px-2.5"} rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${on ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : busy ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : busy ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
        <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
      </button>
      {open && (
        <div className={`${card} !shadow-lg absolute right-0 top-9 z-20 w-64 p-3 text-xs text-slate-600 dark:text-slate-400`}>
          <p>ffmpeg ({bytes(engine.stored?.bytes ?? 0)}) is kept in {engine.stored?.where === "opfs" ? "private app storage (OPFS)" : "the browser database"}, so these tools work without internet.</p>
          <div className="mt-3 flex justify-end gap-1">
            <button onClick={() => setOpen(false)} className="h-7 px-2.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              Close
            </button>
            <button onClick={() => engine.remove().then(() => setOpen(false))} className="h-7 px-2.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1 font-semibold">
              <Trash2 size={12} /> Remove
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
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">{g.title}</h3>
          <div className={`grid gap-2.5 ${g.big ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
            {g.ids.map((id) => (g.big ? <FeatureTile key={id} t={toolById(id)} onOpen={() => open(id)} /> : <Tile key={id} t={toolById(id)} onOpen={() => open(id)} />))}
          </div>
        </section>
      ))}
      <button onClick={library} className={`${card} h-16 px-4 flex items-center gap-3 hover:shadow-md transition-shadow ${ACCENTS.indigo.hover}`}>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACCENTS.indigo.icon}`}>
          <ListMusic size={19} />
        </span>
        <span className="text-left">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Library</span>
          <span className={`block text-xs ${muted}`}>{items?.length ? `${items.length} file${items.length === 1 ? "" : "s"} saved on this device` : "Everything you make is kept here"}</span>
        </span>
        <ChevronRight size={18} className="ml-auto text-slate-400" />
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
      <div className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0f16] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Open in another tool</p>
            <p className={`text-xs truncate ${muted}`}>{file.name}</p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
  const a = accentOf(t);
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
    <AccentProvider value={a}>
      <div className="flex-1 overflow-y-auto w-full">
        <div className="w-full max-w-3xl min-h-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex flex-col gap-5 pb-6">
          <header className="flex items-center gap-3 min-h-11">
            {view.kind === "home" ? (
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Audio Editor</h2>
                <p className={`text-sm ${muted}`}>{TOOLS.length} tools · runs on your device, nothing is uploaded</p>
              </div>
            ) : (
              <>
                <IconButton label="All tools" onClick={() => setView({ kind: "home" })} className={`${card} !h-10 !min-w-10 !rounded-xl`}>
                  <ArrowLeft size={17} />
                </IconButton>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>{t ? <t.icon size={19} /> : <ListMusic size={19} />}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 leading-tight">{t ? t.label : "Library"}</h2>
                  <p className={`text-xs truncate ${muted}`}>{t ? t.about : "Everything you've made, kept on this device"}</p>
                </div>
              </>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {view.kind === "tool" && (
                <IconButton label="Library" onClick={library}>
                  <ListMusic size={16} />
                </IconButton>
              )}
              <EngineStatus engine={engine} compact={view.kind !== "home"} />
            </div>
          </header>
          {view.kind !== "home" && <EngineSetup engine={engine} />}
          {body()}
        </div>
        {carry && <UseIn file={carry} onClose={() => setCarry(null)} onPick={(id) => open(id, carry)} />}
      </div>
    </AccentProvider>
  );
};
