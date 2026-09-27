import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Eraser, PenLine, Redo2, Trash2, Undo2 } from "lucide-react";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; width: number; erase: boolean };

export interface FormulaSketchPadHandle {
  clear: () => void;
  /** Hands the drawing over now (skipping the rest delay) and returns it; null when the pad is empty. */
  flush: () => Promise<Blob | null>;
}

interface FormulaSketchPadProps {
  /** Called with the ink as a PNG (black on white, trimmed to the writing), or null once the pad is empty. */
  onInkChange: (image: Blob | null) => void;
  /** How long the pen has to rest before the drawing is handed over, in ms. */
  settleMs?: number;
  className?: string;
  /** Size of the writing area; defaults to a tall pad. */
  padClassName?: string;
}

const PEN_WIDTHS = [2.5, 4, 6];
/** Space kept around the writing in the exported image; the reader does better with a margin. */
const EXPORT_PADDING = 28;
/** Exported ink is drawn at this scale so thin strokes survive the reader's downscaling. */
const EXPORT_SCALE = 2;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, ink: string, offset: Point = { x: 0, y: 0 }, scale = 1) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = (stroke.erase ? stroke.width * 4 : stroke.width) * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const px = (p: Point) => (p.x - offset.x) * scale;
  const py = (p: Point) => (p.y - offset.y) * scale;

  if (pts.length === 1) {
    // A tap: a dot (decimal points, the dot of an i).
    ctx.beginPath();
    ctx.arc(px(pts[0]), py(pts[0]), ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Quadratic curves through the midpoints give a smooth line without lag.
    ctx.beginPath();
    ctx.moveTo(px(pts[0]), py(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(px(pts[i]), py(pts[i]), (mx - offset.x) * scale, (my - offset.y) * scale);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(px(last), py(last));
    ctx.stroke();
  }
  ctx.restore();
}

/** Bounding box of the pen strokes (eraser strokes can only shrink it, so they are ignored). */
function inkBounds(strokes: Stroke[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    if (s.erase) continue;
    for (const p of s.points) {
      minX = Math.min(minX, p.x - s.width);
      minY = Math.min(minY, p.y - s.width);
      maxX = Math.max(maxX, p.x + s.width);
      maxY = Math.max(maxY, p.y + s.width);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Renders the strokes black on white, cropped to the writing, for the formula reader. */
function exportInk(strokes: Stroke[]): Promise<Blob | null> {
  const bounds = inkBounds(strokes);
  if (!bounds) return Promise.resolve(null);
  const w = bounds.maxX - bounds.minX + EXPORT_PADDING * 2;
  const h = bounds.maxY - bounds.minY + EXPORT_PADDING * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * EXPORT_SCALE);
  canvas.height = Math.ceil(h * EXPORT_SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // Ink goes on a transparent layer first so the eraser only removes ink, then onto white.
  const ink = document.createElement("canvas");
  ink.width = canvas.width;
  ink.height = canvas.height;
  const inkCtx = ink.getContext("2d")!;
  const offset = { x: bounds.minX - EXPORT_PADDING, y: bounds.minY - EXPORT_PADDING };
  for (const s of strokes) drawStroke(inkCtx, s, "#000", offset, EXPORT_SCALE);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(ink, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/**
 * A handwriting pad for formulas. Works with a mouse, finger or stylus; the drawing is handed
 * to `onInkChange` shortly after the pen lifts, so the formula is read while you write.
 */
export const FormulaSketchPad = forwardRef<FormulaSketchPadHandle, FormulaSketchPadProps>(
  ({ onInkChange, settleMs = 650, className = "", padClassName = "h-[200px] sm:h-[220px]" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const redoRef = useRef<Stroke[]>([]);
    const activeRef = useRef<Stroke | null>(null);
    const settleTimer = useRef<number | null>(null);
    const onInkChangeRef = useRef(onInkChange);
    onInkChangeRef.current = onInkChange;

    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
    const [counts, setCounts] = useState({ strokes: 0, redo: 0 });

    const inkColor = () =>
      document.documentElement.classList.contains("dark") ? "#e2e8f0" : "#0f172a";

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = inkColor();
      for (const s of strokesRef.current) drawStroke(ctx, s, color);
      if (activeRef.current) drawStroke(ctx, activeRef.current, color);
    }, []);

    // Size the canvas to its box (and the screen's pixel density), keeping the drawing.
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const { width, height } = container.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        redraw();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      return () => observer.disconnect();
    }, [redraw]);

    // Redraw in the right ink colour when the theme flips.
    useEffect(() => {
      const observer = new MutationObserver(redraw);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }, [redraw]);

    useEffect(() => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    }, []);

    const syncCounts = () => setCounts({ strokes: strokesRef.current.length, redo: redoRef.current.length });

    /** Hands the drawing over once the pen has rested, or right away (undo, clear). */
    const publish = (immediate = false) => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      const run = () => {
        exportInk(strokesRef.current).then((blob) => onInkChangeRef.current(blob));
      };
      if (immediate) run();
      else settleTimer.current = window.setTimeout(run, settleMs);
    };

    const pointFrom = (e: React.PointerEvent): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      // A stylus eraser end (button 5) erases whatever tool is picked.
      const erase = tool === "eraser" || (e.buttons & 32) !== 0;
      activeRef.current = { points: [pointFrom(e)], width: penWidth, erase };
      redraw();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const active = activeRef.current;
      if (!active) return;
      // Coalesced events keep fast strokes smooth on devices that batch them.
      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
      const rect = canvasRef.current!.getBoundingClientRect();
      for (const ev of events) active.points.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
      redraw();
    };

    const finishStroke = () => {
      const active = activeRef.current;
      if (!active) return;
      activeRef.current = null;
      strokesRef.current = [...strokesRef.current, active];
      redoRef.current = [];
      syncCounts();
      redraw();
      publish();
    };

    const undo = () => {
      const last = strokesRef.current[strokesRef.current.length - 1];
      if (!last) return;
      strokesRef.current = strokesRef.current.slice(0, -1);
      redoRef.current = [...redoRef.current, last];
      syncCounts();
      redraw();
      publish(true);
    };

    const redo = () => {
      const next = redoRef.current[redoRef.current.length - 1];
      if (!next) return;
      redoRef.current = redoRef.current.slice(0, -1);
      strokesRef.current = [...strokesRef.current, next];
      syncCounts();
      redraw();
      publish(true);
    };

    const clear = () => {
      strokesRef.current = [];
      redoRef.current = [];
      activeRef.current = null;
      syncCounts();
      redraw();
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      onInkChangeRef.current(null);
    };

    const flush = async () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      const blob = await exportInk(strokesRef.current);
      onInkChangeRef.current(blob);
      return blob;
    };

    useImperativeHandle(ref, () => ({ clear, flush }));

    // Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) while the pad is on screen.
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    });

    const toolBtn = (active: boolean) =>
      `h-7 px-2 flex items-center gap-1 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
      }`;
    const iconBtn =
      "h-7 w-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors";

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/70">
            <button type="button" onClick={() => setTool("pen")} className={toolBtn(tool === "pen")} aria-pressed={tool === "pen"} title="Pen">
              <PenLine size={13} /> Pen
            </button>
            <button type="button" onClick={() => setTool("eraser")} className={toolBtn(tool === "eraser")} aria-pressed={tool === "eraser"} title="Eraser">
              <Eraser size={13} /> Eraser
            </button>
          </div>

          <div className="flex items-center gap-1" role="radiogroup" aria-label="Pen size">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={penWidth === w}
                onClick={() => { setPenWidth(w); setTool("pen"); }}
                title={`Pen size ${w}`}
                className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                  penWidth === w && tool === "pen"
                    ? "bg-blue-50 dark:bg-blue-500/15 ring-1 ring-blue-500/40"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="rounded-full bg-slate-700 dark:bg-slate-200" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            <button type="button" onClick={undo} disabled={counts.strokes === 0} className={iconBtn} title="Undo (Ctrl+Z)">
              <Undo2 size={14} />
            </button>
            <button type="button" onClick={redo} disabled={counts.redo === 0} className={iconBtn} title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={counts.strokes === 0}
              className={`${iconBtn} hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-500/10`}
              title="Clear the pad"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Pad */}
        <div
          ref={containerRef}
          className={`relative ${padClassName} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden touch-none`}
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(148,163,184,0.25) calc(50% - 0.5px), rgba(148,163,184,0.25) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            className={`absolute inset-0 touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
            aria-label="Drawing pad: write a formula"
          />
          {counts.strokes === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none text-center px-6">
              <PenLine size={22} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400 dark:text-slate-500">Write your formula here</p>
              <p className="text-[10px] text-slate-400/80 dark:text-slate-600">e.g. y = x^2 + 3x − 1 — it is read as you write</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);

FormulaSketchPad.displayName = "FormulaSketchPad";
