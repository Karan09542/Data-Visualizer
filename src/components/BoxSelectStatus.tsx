import { Lock, Trash2, X } from "lucide-react";
import { useAnnotationStore } from "../store/useAnnotationStore";

/**
 * Shown on the canvas while the Box select tool is on: the canvas is locked, how many shapes are
 * selected, and buttons to delete or deselect them (on a phone there is no Delete or Esc key).
 */
export function BoxSelectStatus() {
  const isActive = useAnnotationStore((s) => s.isToolbarVisible && s.activeTool === "box-select");
  const count = useAnnotationStore((s) => s.selectedAnnotationIds.length);
  if (!isActive) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const remove = () => {
    const { selectedAnnotationIds, removeAnnotations, commitAction } = useAnnotationStore.getState();
    removeAnnotations(selectedAnnotationIds);
    commitAction();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // data-canvas-ui: the drawing system leaves taps here alone; without it, pressing Delete
      // first reached the canvas as a tap on empty space and cleared the selection it was to delete.
      // Sits just under the node search bar (top-4, about 46 px tall), which would otherwise cover it.
      // Only its buttons take taps: the rest lets them through, so a selection's handles moved under
      // the chip can still be grabbed.
      data-canvas-ui
      onPointerDown={stop}
      onClick={stop}
      className="pointer-events-none absolute left-1/2 top-18 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-blue-500/30 bg-white/95 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-md dark:bg-slate-900/90 dark:text-slate-200"
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
      <span>
        Canvas locked ·{" "}
        {count === 0 ? (
          <span className="text-slate-500 dark:text-slate-400">drag to select</span>
        ) : (
          <span className="font-semibold text-blue-600 dark:text-blue-400">{count} selected</span>
        )}
      </span>
      {count > 0 && (
        <>
          <button
            onClick={remove}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-red-600 hover:bg-red-500/10 dark:text-red-400"
            title="Delete selected (Delete)"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={() => useAnnotationStore.getState().setSelectedAnnotations([])}
            className="pointer-events-auto rounded-full p-1 text-slate-500 hover:bg-slate-500/10 dark:text-slate-400"
            title="Deselect (Esc)"
            aria-label="Deselect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
