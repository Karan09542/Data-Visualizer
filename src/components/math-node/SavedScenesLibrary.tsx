import React, { useEffect, useMemo, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { Check, FolderOpen, PlusSquare, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { db, type SavedMathScene } from "../../lib/db";
import { ConfirmModal } from "../ConfirmModal";

export type SceneSnapshot = SavedMathScene["scene"];

interface SavedScenesLibraryProps {
  /** The graph as it is now: what "Save" and "Update" store. */
  getSnapshot: () => SceneSnapshot;
  /** replace: the saved graph takes over. add: its rows and sliders join the current ones. */
  onLoad: (scene: SceneSnapshot, mode: "replace" | "add") => void;
  /** Rows in the current graph; loading over a non-empty graph asks first. */
  currentRowCount: number;
  /** A name to start from, e.g. the example or simulation that was loaded. */
  suggestedName?: string;
  /** Changes when the Save button in the panel header is pressed. */
  saveRequest?: number;
}

const describe = (scene: SceneSnapshot) => {
  const parts = [
    `${scene.functions.length} row${scene.functions.length === 1 ? "" : "s"}`,
    `${scene.variables.length} slider${scene.variables.length === 1 ? "" : "s"}`,
  ];
  if (scene.timeline?.mode === "once") parts.push("simulation");
  else if (scene.functions.some((f: any) => /\b(t|time)\b/.test(f.expr || ""))) parts.push("animated");
  return parts.join(" · ");
};

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Graphs the user saved: the whole set of equations, sliders, timeline and view,
 * loaded back in one click like the examples.
 */
export const SavedScenesLibrary: React.FC<SavedScenesLibraryProps> = ({
  getSnapshot,
  onLoad,
  currentRowCount,
  suggestedName,
  saveRequest,
}) => {
  const [scenes, setScenes] = useState<SavedMathScene[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<
    | { kind: "replace"; scene: SavedMathScene }
    | { kind: "update"; scene: SavedMathScene }
    | { kind: "delete"; scene: SavedMathScene }
    | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sub = liveQuery(() => db.mathScenes.orderBy("updatedAt").reverse().toArray()).subscribe({
      next: setScenes,
      error: () => setScenes([]),
    });
    return () => sub.unsubscribe();
  }, []);

  const openForm = () => {
    setName((n) => n || suggestedName || "");
    setFormOpen(true);
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      nameRef.current?.focus();
      nameRef.current?.select();
    });
  };

  // The header's Save button opens this form.
  const firstRequest = useRef(saveRequest);
  useEffect(() => {
    if (saveRequest === undefined || saveRequest === firstRequest.current) return;
    openForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequest]);

  const trimmed = name.trim();
  const existing = scenes.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());

  const save = async () => {
    if (!trimmed) return;
    const scene = getSnapshot();
    const now = Date.now();
    if (existing?.id !== undefined) {
      // Same name: keep one entry, with the new contents.
      await db.mathScenes.update(existing.id, {
        name: trimmed,
        description: description.trim() || existing.description,
        scene,
        updatedAt: now,
      });
    } else {
      await db.mathScenes.add({
        name: trimmed,
        description: description.trim() || undefined,
        scene,
        createdAt: now,
        updatedAt: now,
      });
    }
    setFormOpen(false);
    setName("");
    setDescription("");
    setJustSaved(trimmed);
    setTimeout(() => setJustSaved(null), 2000);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scenes;
    return scenes.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q),
    );
  }, [scenes, query]);

  const iconBtn =
    "p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors";

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
          My Saved Graphs{scenes.length > 0 ? ` (${scenes.length})` : ""}
        </span>
        <button
          type="button"
          onClick={() => (formOpen ? setFormOpen(false) : openForm())}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
          title="Save all the current equations, sliders, timeline and view"
        >
          <Save size={11} /> Save current graph
        </button>
      </div>

      {justSaved && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
          <Check size={11} /> Saved “{justSaved}”
        </div>
      )}

      {formOpen && (
        <form
          className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Projectile from a cliff"
            maxLength={80}
            className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-blue-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note (optional): what it shows, what to try"
            maxLength={200}
            className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-blue-500"
          />
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Saves {describe(getSnapshot())}, with the timeline and the view.
            {existing && (
              <span className="text-amber-600 dark:text-amber-400"> Replaces your saved “{existing.name}”.</span>
            )}
          </p>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-2.5 py-1 rounded-md text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="px-3 py-1 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
            >
              {existing ? "Replace" : "Save"}
            </button>
          </div>
        </form>
      )}

      {scenes.length === 0 && !formOpen && (
        <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Save the equations, sliders and timeline you've built here, and load them all again later in one click.
        </p>
      )}

      {scenes.length > 5 && (
        <label className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60">
          <Search size={11} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved graphs"
            className="flex-1 bg-transparent text-[11px] outline-none"
          />
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        {visible.map((s) => (
          <div
            key={s.id}
            className="group/saved flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
          >
            <button
              type="button"
              onClick={() =>
                currentRowCount > 0 ? setPending({ kind: "replace", scene: s }) : onLoad(s.scene, "replace")
              }
              className="flex-1 min-w-0 text-left"
              title="Load this graph"
            >
              <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
              {s.description && (
                <div className="text-[10px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                  {s.description}
                </div>
              )}
              <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                {describe(s.scene)} · {formatDate(s.updatedAt)}
              </div>
            </button>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                className={iconBtn}
                title="Load: replaces the current graph"
                onClick={() =>
                  currentRowCount > 0 ? setPending({ kind: "replace", scene: s }) : onLoad(s.scene, "replace")
                }
              >
                <FolderOpen size={13} />
              </button>
              <button
                type="button"
                className={iconBtn}
                title="Add its rows and sliders to the current graph"
                onClick={() => onLoad(s.scene, "add")}
              >
                <PlusSquare size={13} />
              </button>
              <button
                type="button"
                className={iconBtn}
                title="Update: save the current graph over this one"
                onClick={() => setPending({ kind: "update", scene: s })}
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                className={`${iconBtn} hover:!text-red-500`}
                title="Delete"
                onClick={() => setPending({ kind: "delete", scene: s })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={pending !== null}
        title={
          pending?.kind === "delete"
            ? "Delete saved graph"
            : pending?.kind === "update"
              ? "Update saved graph"
              : "Load saved graph"
        }
        message={
          pending?.kind === "delete" ? (
            <>
              Delete <span className="font-bold">“{pending.scene.name}”</span>? This can't be undone.
            </>
          ) : pending?.kind === "update" ? (
            <>
              Save the current graph over <span className="font-bold">“{pending.scene.name}”</span>? What it holds
              now will be replaced.
            </>
          ) : pending ? (
            <>
              Load <span className="font-bold">“{pending.scene.name}”</span>? It replaces the {currentRowCount} row
              {currentRowCount === 1 ? "" : "s"} in the graph now. Save them first if you want to keep them.
            </>
          ) : null
        }
        confirmText={pending?.kind === "delete" ? "Delete" : pending?.kind === "update" ? "Update" : "Load"}
        variant={pending?.kind === "delete" ? "danger" : "primary"}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const p = pending;
          setPending(null);
          if (!p || p.scene.id === undefined) return;
          if (p.kind === "delete") await db.mathScenes.delete(p.scene.id);
          else if (p.kind === "update") {
            await db.mathScenes.update(p.scene.id, { scene: getSnapshot(), updatedAt: Date.now() });
            setJustSaved(p.scene.name);
            setTimeout(() => setJustSaved(null), 2000);
          } else onLoad(p.scene.scene, "replace");
        }}
      />
    </div>
  );
};
