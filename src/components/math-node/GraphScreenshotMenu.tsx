import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ClipboardCopy, Download, ImagePlus, Loader2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { addImagesToCanvas, canvasToBlob } from "../utilities/AddToCanvasButton";

/**
 * Anything inside the graph marked with this attribute is left out of a
 * screenshot: toolbars, panels, close buttons. What's drawn stays in, including
 * labels, measured areas and pinned trace points.
 */
export const CAPTURE_EXCLUDE = "data-capture-exclude";

type Action = "download" | "copy" | "canvas";

interface GraphScreenshotMenuProps {
  /** The graph area to capture. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Used for the file and node name. */
  name: string;
  /** The graph's background, so the picture isn't transparent where the graph isn't. */
  background: string;
  buttonClassName: string;
}

const SCALES = [1, 2, 3] as const;

/** Renders the graph to a canvas with snapdom, leaving out the interface around it. */
async function captureGraph(el: HTMLElement, scale: number, background: string): Promise<HTMLCanvasElement> {
  const { snapdom } = await import("@zumer/snapdom");
  return snapdom.toCanvas(el, {
    scale,
    embedFonts: true,
    backgroundColor: background,
    exclude: [`[${CAPTURE_EXCLUDE}]`],
    // Removed, not hidden: "hide" leaves a same-sized box in the page flow, and for a
    // toolbar floating over the graph that box pushes the whole graph down.
    excludeMode: "remove",
  } as any);
}

/** A camera button in the node header: download, copy, or put the graph on the canvas. */
export const GraphScreenshotMenu: React.FC<GraphScreenshotMenuProps> = ({ targetRef, name, background, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [done, setDone] = useState<Action | null>(null);
  const [scale, setScale] = useState<(typeof SCALES)[number]>(2);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Below the button, kept on screen.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const width = 224;
      setPos({
        top: Math.min(r.bottom + 6, window.innerHeight - 240),
        left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fileBase = `${name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "graph"}`;

  const run = async (action: Action) => {
    const el = targetRef.current;
    if (!el || busy) return;
    setBusy(action);
    const notify = useStore.getState().setNotification;
    try {
      // Let the menu close and the frame settle, so the picture is of a still graph.
      setOpen(false);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      const canvas = await captureGraph(el, scale, background);

      if (action === "copy") {
        if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no-clipboard");
        const blob = canvasToBlob(canvas, "image/png").then((b) => {
          if (!b) throw new Error("encode");
          return b;
        });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob as unknown as Blob })]);
        notify({ type: "success", message: "Graph copied as an image" });
      } else {
        const blob = await canvasToBlob(canvas, "image/png");
        if (!blob) throw new Error("encode");
        if (action === "download") {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${fileBase}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notify({ type: "success", message: "Graph screenshot saved" });
        } else {
          await addImagesToCanvas([{ blob, name: `${fileBase}_screenshot` }]);
        }
      }
      setDone(action);
      setTimeout(() => setDone(null), 1800);
    } catch (err: any) {
      console.error("Graph screenshot failed", err);
      notify({
        type: "error",
        message:
          err?.message === "no-clipboard"
            ? "This browser can't copy images. Use Download instead."
            : "Couldn't take the screenshot.",
      });
    } finally {
      setBusy(null);
    }
  };

  const item = (action: Action, Icon: React.ElementType, label: string, hint: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => run(action)}
      disabled={!!busy}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
    >
      <Icon size={15} className="shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </button>
  );

  const ButtonIcon = busy ? Loader2 : done ? Check : Camera;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Screenshot of the graph"
        className={`${buttonClassName} ${done ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        <ButtonIcon size={15} className={busy ? "animate-spin" : ""} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 224, zIndex: 10000 }}
            className="nodrag nowheel p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/10 dark:shadow-black/40"
          >
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Screenshot of the graph
            </div>
            {item("download", Download, "Download PNG", "Save the picture to your device")}
            {item("copy", ClipboardCopy, "Copy image", "Paste it anywhere")}
            {item("canvas", ImagePlus, "Add to canvas", "As a new image node")}
            <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Resolution</span>
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800" role="radiogroup">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={scale === s}
                    onClick={() => setScale(s)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums transition-colors ${
                      scale === s
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
