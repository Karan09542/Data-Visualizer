import React, { useEffect, useRef, useState } from "react";
import { ColorPickerTrigger } from "../image-workspace/components/shared/ColorPickers";
import {
  Check,
  ChevronUp,
  Circle,
  Download,
  Eraser,
  Hash,
  Highlighter,
  Loader2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Pipette,
  Plus,
  Redo2,
  Square,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  FILLABLE,
  SIZE_RANGE,
  STAMP_KINDS,
  STAMP_RANGE,
  isStamp,
  shapesToSvg,
  type MarkupShape,
  type MarkupTool,
} from "./markupModel";
import type { ImageMarkupState } from "./useImageMarkup";
import { isAndroidOrTabletDevice, isMobileDevice } from "../../lib/deviceInfo";

const TOOLS: { id: MarkupTool; label: string; key: string; Icon: React.ElementType }[] = [
  { id: "select", label: "Select and move a mark", key: "V", Icon: MousePointer2 },
  { id: "pen", label: "Pen", key: "P", Icon: PenLine },
  { id: "highlighter", label: "Highlighter", key: "H", Icon: Highlighter },
  { id: "line", label: "Line", key: "L", Icon: Minus },
  { id: "arrow", label: "Arrow", key: "A", Icon: MoveUpRight },
  { id: "rect", label: "Rectangle (drag corner to corner)", key: "R", Icon: Square },
  { id: "circle", label: "Circle (drag from the centre)", key: "O", Icon: Circle },
  { id: "check", label: "Check mark (tap, or drag to size)", key: "K", Icon: Check },
  { id: "cross", label: "Cross (tap, or drag to size)", key: "X", Icon: X },
  { id: "star", label: "Star (tap, or drag to size)", key: "S", Icon: Star },
  { id: "badge", label: "Numbered badge: 1, 2, 3… (tap)", key: "N", Icon: Hash },
  { id: "eraser", label: "Eraser: drag over marks to remove them", key: "E", Icon: Eraser },
];
export const TOOL_KEYS = new Map(TOOLS.map((t) => [t.key.toLowerCase(), t.id]));

const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#0ea5e9", "#6366f1", "#ec4899", "#ffffff", "#111827"];


/** Loads a picture for drawing onto a canvas. */
const loadImage = (src: string, cors: boolean) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = src;
  });

/** The picture with its marks, as a PNG at the picture's own size. */
export async function renderMarkedImage(src: string, shapes: MarkupShape[]): Promise<Blob> {
  const img = await loadImage(src, !/^(blob:|data:)/.test(src));
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  // Very large pictures are scaled down to what a browser canvas can hold.
  const k = Math.min(1, 8192 / Math.max(w, h), Math.sqrt(40e6 / (w * h)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const svg = shapesToSvg(shapes, w, h);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const marks = await loadImage(url, false);
    ctx.drawImage(marks, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the picture"))), "image/png"),
  );
}

interface Props {
  markup: ImageMarkupState;
  src: string;
  fileName: string;
  onDone: () => void;
  onMessage?: (message: string, type: "success" | "error") => void;
}

/** A styled range: a filled track and a round thumb, the same in every browser. */
const RANGE_CSS = `
.mk-range{-webkit-appearance:none;appearance:none;height:28px;background:transparent;cursor:pointer;touch-action:none}
.mk-range:focus{outline:none}
.mk-range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(to right,var(--mk-fill) 0,var(--mk-fill) var(--mk-pct),rgba(255,255,255,.18) var(--mk-pct),rgba(255,255,255,.18) 100%)}
.mk-range::-moz-range-track{height:6px;border-radius:999px;background:rgba(255,255,255,.18)}
.mk-range::-moz-range-progress{height:6px;border-radius:999px;background:var(--mk-fill)}
.mk-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-7px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px color-mix(in srgb,var(--mk-fill) 35%,transparent),0 2px 6px rgba(0,0,0,.45);transition:transform .12s ease}
.mk-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px color-mix(in srgb,var(--mk-fill) 35%,transparent),0 2px 6px rgba(0,0,0,.45)}
.mk-range:active::-webkit-slider-thumb,.mk-range:focus-visible::-webkit-slider-thumb{transform:scale(1.15)}
`;

/** A phone or tablet (by its user agent): always the touch layout, whatever its width. */
const TOUCH_DEVICE = typeof navigator !== "undefined" && (isMobileDevice() || isAndroidOrTabletDevice());

/**
 * Whether the draw tools take the touch layout: one bar along the bottom, in reach of a
 * thumb, with panels above it. Always on phones and tablets; elsewhere when the window
 * is phone-narrow.
 */
export function useCompactMarkup() {
  const query = "(max-width: 639px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return TOUCH_DEVICE || narrow;
}

/** The size: a slider, − and + for a finger, and the value in pt (typed on a desktop). */
function SizeControl({
  label,
  value,
  range,
  color,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  color: string;
  onChange: (v: number) => void;
  compact: boolean;
}) {
  const v = Math.round(value);
  const set = (n: number) => onChange(Math.min(range.max, Math.max(range.min, Math.round(n))));
  const pct = ((v - range.min) / (range.max - range.min)) * 100;
  // A very light or very dark colour would vanish against the track: the fill falls back to blue.
  const fill = (() => {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color.startsWith("#") || color.startsWith("rgb") ? color : "#3b82f6";
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.85 || lum < 0.15 ? "#3b82f6" : color;
  })();
  const step = (dir: 1 | -1) => set(v + dir * (v >= 40 ? 4 : v >= 12 ? 2 : 1));
  const stepBtn =
    "shrink-0 size-8 inline-flex items-center justify-center rounded-full bg-white/10 text-slate-100 hover:bg-white/20 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition";
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span className="shrink-0 text-[11px] font-medium text-slate-300 w-10">{label}</span>
      {compact && (
        <button type="button" className={stepBtn} onClick={() => step(-1)} disabled={v <= range.min} aria-label="Smaller">
          <Minus size={14} />
        </button>
      )}
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={1}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        className="mk-range min-w-0 flex-1 sm:w-36 sm:flex-none"
        style={{ ["--mk-fill" as any]: fill, ["--mk-pct" as any]: `${pct}%` }}
        aria-label={`${label} in pt`}
      />
      {compact ? (
        <>
          <button type="button" className={stepBtn} onClick={() => step(1)} disabled={v >= range.max} aria-label="Bigger">
            <Plus size={14} />
          </button>
          <span className="shrink-0 w-12 text-right text-[12px] font-semibold tabular-nums text-white">{v} pt</span>
        </>
      ) : (
        <label className="shrink-0 flex items-center gap-1 h-7 pl-2 pr-2 rounded-full bg-white/10 border border-white/10 focus-within:ring-1 focus-within:ring-blue-400">
          <input
            type="number"
            min={range.min}
            max={range.max}
            value={v}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && e.target.value !== "") set(n);
            }}
            className="w-8 bg-transparent text-right text-[12px] font-semibold tabular-nums text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Size in pt"
          />
          <span className="text-[11px] text-slate-400">pt</span>
        </label>
      )}
    </div>
  );
}

function Swatches({ color, onPick, big }: { color: string; onPick: (c: string) => void; big: boolean }) {
  const size = big ? "size-8" : "size-6";
  const isCustom = !COLORS.some((c) => c.toLowerCase() === color.toLowerCase());

  return (
    <div className={big ? "grid grid-cols-5 gap-2.5 justify-items-center" : "flex items-center gap-1"} role="radiogroup" aria-label="Colour">
      {COLORS.map((c) => {
        const on = color.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c}
            onClick={() => onPick(c)}
            title={c}
            className={`shrink-0 ${size} rounded-full border transition-transform ${
              on ? "ring-2 ring-white ring-offset-2 ring-offset-black/70 border-transparent" : "border-white/25 hover:scale-110"
            }`}
            style={{ background: c }}
          />
        );
      })}
      <ColorPickerTrigger
        color={color}
        onChange={onPick}
        presets={COLORS}
        className={`shrink-0 relative ${size} rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-transform flex items-center justify-center p-0 aspect-square ${
          isCustom
            ? "ring-2 ring-white ring-offset-2 ring-offset-black/70 shadow-md"
            : "hover:ring-1 hover:ring-white/60"
        }`}
        style={{
          background: isCustom
            ? color
            : "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)",
          backgroundOrigin: "border-box",
          backgroundClip: "border-box",
          backgroundRepeat: "no-repeat",
          boxShadow: isCustom
            ? undefined
            : "0 0 0 1px rgba(255, 255, 255, 0.3), inset 0 0 2px rgba(0, 0, 0, 0.25)",
        }}
        label="Custom colour picker"
        title="Custom colour picker"
      >
        <Pipette
          size={big ? 13 : 11}
          className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] pointer-events-none"
          strokeWidth={2.4}
        />
      </ColorPickerTrigger>
    </div>
  );
}

function FillToggle({ fill, onChange, wide = false }: { fill: boolean; onChange: (v: boolean) => void; wide?: boolean }) {
  return (
    <div className={`shrink-0 flex items-center p-0.5 rounded-full bg-white/10 text-[11px] ${wide ? "*:flex-1" : ""}`} role="radiogroup" aria-label="Fill">
      {(
        [
          [false, "Outline"],
          [true, "Filled"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={fill === value}
          onClick={() => onChange(value)}
          className={`h-7 px-3 rounded-full font-medium transition-colors ${fill === value ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The draw mode's tools. On a desktop: two rows along the top of the image (tools and
 * actions; colour, size and fill). On a phone: one bar along the bottom, in reach of a
 * thumb, whose buttons open panels above it for the tool, the style and the rest.
 */
export function ImageMarkupToolbar({ markup, src, fileName, onDone, onMessage }: Props) {
  const { style, setStyle, selectedId, shapes } = markup;
  const selected = selectedId ? shapes.find((s) => s.id === selectedId) : undefined;
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const compact = useCompactMarkup();
  const [sheet, setSheet] = useState<"tools" | "style" | "more" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmClear) return;
    const t = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmClear]);

  // A touch anywhere else (drawing, say) closes an open panel.
  useEffect(() => {
    if (!sheet) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setSheet(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [sheet]);
  useEffect(() => {
    if (!compact) setSheet(null);
  }, [compact]);

  // What the size slider sets: a symbol's size, or a line's thickness.
  const stampish = selected ? isStamp(selected) : STAMP_KINDS.has(style.tool);
  const fillable = selected ? FILLABLE.has(selected.kind) : FILLABLE.has(style.tool);
  const color = selected?.color ?? style.color;
  const size = selected ? (stampish ? (selected as any).stamp : selected.size) : stampish ? style.stamp : style.size;
  const fill = selected ? !!(selected as any).fill : style.fill;
  const range = stampish ? STAMP_RANGE : SIZE_RANGE;

  // A change of style sets the next mark, and the selected one with it.
  const change = (patch: { color?: string; size?: number; stamp?: number; fill?: boolean }) => {
    setStyle(patch);
    if (selected) markup.restyle(patch);
  };
  const setSize = (v: number) => change(stampish ? { stamp: v } : { size: v });
  const pickTool = (id: MarkupTool) => {
    setStyle({ tool: id });
    if (id !== "select") markup.setSelectedId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const blob = await renderMarkedImage(src, shapes);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName.replace(/\.[a-z0-9]{2,5}$/i, "") || "image"}-marked.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      onMessage?.("Saved the image with its marks", "success");
    } catch {
      onMessage?.("Could not save this image with marks (it may block copying)", "error");
    } finally {
      setSaving(false);
    }
  };
  const clear = () => {
    if (!confirmClear) return setConfirmClear(true);
    setConfirmClear(false);
    markup.clear();
    setSheet(null);
    onMessage?.("Cleared all marks (Undo brings them back)", "success");
  };

  const panel = "pointer-events-auto rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 text-white shadow-lg";
  const current = TOOLS.find((t) => t.id === style.tool) ?? TOOLS[1];
  const sizeLabel = stampish ? "Size" : "Width";
  const stop = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  if (compact) {
    const barBtn =
      "shrink-0 h-11 min-w-11 inline-flex flex-col items-center justify-center gap-0.5 rounded-xl text-slate-200 active:bg-white/15 disabled:opacity-35 disabled:pointer-events-none transition-colors";
    const caption = "text-[9px] leading-none font-medium text-slate-400";
    return (
      <div
        ref={rootRef}
        data-zoom-ui
        // Full width on a phone; on a tablet a phone-wide bar in the middle, not stretched.
        className="absolute inset-x-2 bottom-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(30rem,calc(100%-1rem))] z-40 flex flex-col gap-2 pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        {...stop}
      >
        <style>{RANGE_CSS}</style>

        {sheet === "tools" && (
          <div className={`${panel} p-2 grid grid-cols-4 gap-1`} role="toolbar" aria-label="Drawing tools">
            {TOOLS.map(({ id, label, Icon }) => {
              const on = style.tool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    pickTool(id);
                    setSheet(null);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    pickTool(id);
                    setSheet(null);
                  }}
                  aria-pressed={on}
                  aria-label={label}
                  className={`h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    on ? "bg-white text-slate-900" : "text-slate-200 active:bg-white/15"
                  }`}
                >
                  <Icon size={18} strokeWidth={id === "badge" ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium leading-none ${on ? "text-slate-700" : "text-slate-400"}`}>
                    {SHORT[id]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {sheet === "style" && (
          <div className={`${panel} p-3 flex flex-col gap-3`}>
            <Swatches color={color} onPick={(c) => change({ color: c })} big />
            <SizeControl label={sizeLabel} value={size} range={range} color={color} onChange={setSize} compact />
            {fillable && <FillToggle fill={fill} onChange={(v) => change({ fill: v })} wide />}
            {selected && (
              <p className="text-[10px] text-slate-400">Changes apply to the selected mark.</p>
            )}
          </div>
        )}

        {sheet === "more" && (
          <div className={`${panel} p-1.5 flex flex-col`}>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  markup.remove([selected.id]);
                  setSheet(null);
                }}
                className="h-11 px-3 flex items-center gap-3 rounded-xl text-[13px] text-red-300 active:bg-white/10"
              >
                <Trash2 size={16} /> Delete the selected mark
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!shapes.length || saving}
              className="h-11 px-3 flex items-center gap-3 rounded-xl text-[13px] text-slate-100 active:bg-white/10 disabled:opacity-40"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Save image with marks
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={!shapes.length}
              className={`h-11 px-3 flex items-center gap-3 rounded-xl text-[13px] disabled:opacity-40 ${
                confirmClear ? "bg-red-500 text-white" : "text-red-300 active:bg-white/10"
              }`}
            >
              <Trash2 size={16} /> {confirmClear ? "Tap again to clear all marks" : "Clear all marks"}
            </button>
            {!markup.persistent && (
              <p className="px-3 py-2 text-[11px] text-amber-300">This image has no lasting address, so its marks won't be kept.</p>
            )}
          </div>
        )}

        <div className={`${panel} h-14 px-1.5 flex items-center justify-between gap-1`}>
          <button
            type="button"
            onClick={() => setSheet(sheet === "tools" ? null : "tools")}
            aria-expanded={sheet === "tools"}
            aria-label={`Tool: ${current.label}. Change tool`}
            className={`${barBtn} px-2 ${sheet === "tools" ? "bg-white/15" : ""}`}
          >
            <span className="flex items-center gap-0.5">
              <current.Icon size={18} strokeWidth={current.id === "badge" ? 2.5 : 2} />
              <ChevronUp size={12} className={`transition-transform ${sheet === "tools" ? "" : "rotate-180"}`} />
            </span>
            <span className={caption}>{SHORT[current.id]}</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet(sheet === "style" ? null : "style")}
            aria-expanded={sheet === "style"}
            aria-label="Colour and size"
            className={`${barBtn} px-2 ${sheet === "style" ? "bg-white/15" : ""}`}
          >
            <span className="size-5 rounded-full ring-2 ring-white/80 ring-offset-1 ring-offset-black" style={{ background: color }} />
            <span className={`${caption} tabular-nums`}>{Math.round(size)} pt</span>
          </button>
          <span className="w-px h-7 bg-white/15" />
          <button type="button" onClick={markup.undo} disabled={!markup.canUndo} className={barBtn} aria-label="Undo">
            <Undo2 size={18} />
            <span className={caption}>Undo</span>
          </button>
          <button type="button" onClick={markup.redo} disabled={!markup.canRedo} className={barBtn} aria-label="Redo">
            <Redo2 size={18} />
            <span className={caption}>Redo</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet(sheet === "more" ? null : "more")}
            aria-expanded={sheet === "more"}
            aria-label="More: delete, save, clear"
            className={`${barBtn} ${sheet === "more" ? "bg-white/15" : ""}`}
          >
            <MoreHorizontal size={18} />
            <span className={caption}>More</span>
          </button>
          <button
            type="button"
            onClick={onDone}
            className="shrink-0 h-10 px-3.5 ml-0.5 inline-flex items-center rounded-xl bg-blue-500 active:bg-blue-400 text-[13px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const BTN =
    "shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full text-slate-200 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors";
  const TOOL_BTN =
    "shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer";
  return (
    <div
      ref={rootRef}
      data-zoom-ui
      // Clear of the corner buttons a hidden header leaves at the top right.
      className="absolute top-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-11rem)] z-40 flex flex-col items-center gap-1.5 pointer-events-none"
      {...stop}
    >
      <style>{RANGE_CSS}</style>
      {/* Tools and actions */}
      <div className={`${panel} max-w-full flex items-center gap-0.5 p-1 overflow-x-auto no-scrollbar`} role="toolbar" aria-label="Drawing tools">
        {TOOLS.map(({ id, label, key, Icon }) => {
          const on = style.tool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => pickTool(id)}
              onPointerDown={(e) => {
                e.stopPropagation();
                pickTool(id);
              }}
              aria-pressed={on}
              title={`${label} (${key})`}
              aria-label={label}
              className={`${TOOL_BTN} ${
                on
                  ? "bg-white text-slate-900 shadow-xs hover:bg-white hover:text-slate-900"
                  : "text-slate-200 hover:text-white hover:bg-white/10 active:bg-white/20"
              }`}
            >
              <Icon size={16} strokeWidth={id === "badge" ? 2.5 : 2} />
            </button>
          );
        })}
        <span className="shrink-0 w-px h-5 bg-white/20 mx-1" />
        <button type="button" onClick={markup.undo} disabled={!markup.canUndo} className={BTN} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={markup.redo} disabled={!markup.canRedo} className={BTN} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!shapes.length}
          className={`shrink-0 h-8 inline-flex items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors disabled:opacity-35 disabled:pointer-events-none ${
            confirmClear ? "bg-red-500 text-white" : "text-slate-200 hover:text-white hover:bg-white/10"
          }`}
          title="Clear every mark on this image"
          aria-label={confirmClear ? "Tap again to clear all marks" : "Clear all marks"}
        >
          <Trash2 size={15} />
          {confirmClear && <span>Clear all?</span>}
        </button>
        <button type="button" onClick={save} disabled={!shapes.length || saving} className={BTN} title="Save the image with its marks (PNG)" aria-label="Save with marks">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Download size={16} />}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 h-8 ml-0.5 px-3 inline-flex items-center rounded-full bg-blue-500 hover:bg-blue-400 text-[12px] font-semibold text-white"
          title="Leave draw mode (Esc)"
        >
          Done
        </button>
      </div>

      {/* Colour, size, fill */}
      <div className={`${panel} max-w-full flex items-center gap-3 px-3 py-1.5 overflow-x-auto no-scrollbar`}>
        <Swatches color={color} onPick={(c) => change({ color: c })} big={false} />
        <span className="shrink-0 w-px h-5 bg-white/20" />
        <div className="shrink-0">
          <SizeControl label={sizeLabel} value={size} range={range} color={color} onChange={setSize} compact={false} />
        </div>
        {fillable && (
          <>
            <span className="shrink-0 w-px h-5 bg-white/20" />
            <FillToggle fill={fill} onChange={(v) => change({ fill: v })} />
          </>
        )}
        {selected && (
          <>
            <span className="shrink-0 w-px h-5 bg-white/20" />
            <button
              type="button"
              onClick={() => markup.remove([selected.id])}
              className="shrink-0 h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-red-300 hover:text-white hover:bg-red-500/80"
              title="Delete the selected mark (Delete)"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </>
        )}
        {!markup.persistent && (
          <span className="shrink-0 text-[10px] text-amber-300 whitespace-nowrap" title="This image has no lasting address, so its marks can't be kept">
            Not saved
          </span>
        )}
      </div>
    </div>
  );
}

/** One-word names, under the icons on a phone. */
const SHORT: Record<MarkupTool, string> = {
  select: "Select",
  pen: "Pen",
  highlighter: "Marker",
  line: "Line",
  arrow: "Arrow",
  rect: "Box",
  circle: "Circle",
  check: "Tick",
  cross: "Cross",
  star: "Star",
  badge: "Number",
  eraser: "Eraser",
};
