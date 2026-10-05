import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTransformContext, vec } from "mafs";
import { Check, Copy, CopyPlus, EyeOff, Hand, ListTree, Tag, Trash2, X } from "lucide-react";
import { TraceScopeContext, hitTestDots, type DotHit } from "./traceGeometry";
import { COLORS, type MathFunction } from "./mathTypes";
import { liveCoordinatesLabel, pointRowName } from "../../lib/math/liveLabel";

/** A point picked for its menu, and where on screen it was picked. */
export interface PointMenuTarget extends DotHit {
  clientX: number;
  clientY: number;
}

const RIGHT_CLICK_PX = 14;
const DOUBLE_TAP_PX = 26;
const DOUBLE_TAP_MS = 350;
const TAP_SLOP_PX = 10;

/**
 * Opens a point's menu: right-click it with a mouse (or long-press on Android,
 * which sends the same event), or double-tap it on a touch screen. Lives inside
 * <Mafs>, where the view transform is known; the menu itself is drawn outside.
 */
export function PointMenuTrigger({
  containerRef,
  enabled,
  accept,
  onOpen,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  /** Which rows have a menu (points). */
  accept: (fnId: string) => boolean;
  onOpen: (target: PointMenuTarget) => void;
}) {
  const scope = useContext(TraceScopeContext);
  const { viewTransform } = useTransformContext();
  const anchorRef = useRef<SVGGElement>(null);
  const live = useRef({ viewTransform, accept, onOpen, scope });
  live.current = { viewTransform, accept, onOpen, scope };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    /** The dot within `px` screen pixels of a pointer, if any. */
    const pick = (clientX: number, clientY: number, px: number) => {
      const svg = anchorRef.current?.ownerSVGElement;
      const ctm = svg?.getScreenCTM();
      const { viewTransform: vt, scope: sc, accept: ok } = live.current;
      const inverse = vec.matrixInvert(vt);
      if (!svg || !ctm || !inverse) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const [x, y] = vec.transform([p.x, p.y], inverse);
      // Screen pixels per graph unit, the canvas's own zoom included.
      const zoom = Math.hypot(ctm.a, ctm.b) || 1;
      return hitTestDots(x, y, { sx: Math.abs(vt[0]) * zoom, sy: Math.abs(vt[4]) * zoom }, px, sc, ok);
    };
    const open = (hit: DotHit, e: { clientX: number; clientY: number }) => live.current.onOpen({ ...hit, clientX: e.clientX, clientY: e.clientY });

    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-no-trace]")) return;
      const hit = pick(e.clientX, e.clientY, RIGHT_CLICK_PX);
      if (!hit) return;
      // Ours, not the browser's menu or the canvas's.
      e.preventDefault();
      e.stopPropagation();
      open(hit, e);
    };

    // Two quick taps in the same place; a drag in between doesn't count.
    let down: { x: number; y: number } | null = null;
    let lastTap: { t: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP_PX;
      down = null;
      if (moved) {
        lastTap = null;
        return;
      }
      const now = performance.now();
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX) {
        lastTap = null;
        const hit = pick(e.clientX, e.clientY, DOUBLE_TAP_PX);
        if (hit) open(hit, e);
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    };

    el.addEventListener("contextmenu", onContextMenu, true);
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    return () => {
      el.removeEventListener("contextmenu", onContextMenu, true);
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
    };
  }, [containerRef, enabled]);

  return <g ref={anchorRef} />;
}

// ─── The menu ─────────────────────────────────────────────────────────────────

const NUM = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
/** A point written out as numbers: "A = [1, 2]" or "[1, 2]", which the menu can move. */
const FIXED_POINT = new RegExp(String.raw`^\s*(?:([A-Za-z][A-Za-z0-9_']*)\s*=\s*)?[[(]\s*(${NUM})\s*[,;]\s*(${NUM})\s*[\])]\s*$`, "i");

export const parseFixedPoint = (expr: string) => {
  const m = expr.match(FIXED_POINT);
  return m ? { name: m[1] as string | undefined, x: m[2], y: m[3] } : null;
};
const fmt = (v: number) => {
  const r = Math.round(v * 1e4) / 1e4;
  return Object.is(r, -0) ? "0" : String(r);
};
const parseNum = (s: string) => {
  const t = s.trim().replace(/[−–]/g, "-");
  const v = Number(t);
  return t !== "" && Number.isFinite(v) ? v : null;
};

interface PointMenuProps {
  fn: MathFunction;
  target: PointMenuTarget;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPatch: (patch: Partial<MathFunction>) => void;
  /** A copy next to it; given where the point is now. */
  onDuplicate: (at: { x: number; y: number }) => void;
  onShowInList: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const SECTION = "text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";
const FIELD =
  "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 text-[13px] text-slate-800 outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-blue-900/50";
const chip = (on = false) =>
  `h-7 px-2 inline-flex items-center gap-1 rounded-md border text-[11px] font-medium transition-colors ${on
    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

/**
 * Everything to do with one point, next to it: its label, its position, how it
 * looks, and copy, duplicate, find in the list or delete. On a narrow graph it
 * comes up from the bottom instead.
 */
export function PointMenu({ fn, target, containerRef, onPatch, onDuplicate, onShowInList, onDelete, onClose }: PointMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fixed = parseFixedPoint(fn.expr);
  const name = pointRowName(fn.expr);
  // Where it is now: a written-out point follows its own edits; a worked-out one is where it was picked.
  const now = fixed && Number.isFinite(Number(fixed.x)) && Number.isFinite(Number(fixed.y)) ? { x: Number(fixed.x), y: Number(fixed.y) } : { x: target.x, y: target.y };
  const handle = !!fn.dragVars?.length;

  const [label, setLabel] = useState(fn.label ?? "");
  const [x, setX] = useState(fixed?.x ?? fmt(target.x));
  const [y, setY] = useState(fixed?.y ?? fmt(target.y));
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // On a narrow graph: a sheet along the bottom, or the top when the point is low down.
  const [sheet, setSheet] = useState<"top" | "bottom" | null>(null);
  // Never taller than the room on the far side of the point, so the point stays in view.
  const [sheetMax, setSheetMax] = useState<number | undefined>(undefined);

  // Follow changes made elsewhere (dragging the point) unless the box is being typed in.
  useEffect(() => {
    const typing = (id: string) => menuRef.current?.querySelector(`[data-field="${id}"]`) === document.activeElement;
    if (!typing("x") && fixed) setX(fixed.x);
    if (!typing("y") && fixed) setY(fixed.y);
    if (!typing("label")) setLabel(fn.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn.expr, fn.label]);

  // Placed before the first paint: next to the point and inside the graph, or as a
  // sheet on a narrow graph. Until then it's invisible, so it never shows anywhere else.
  const placed = sheet !== null || pos !== null;
  useLayoutEffect(() => {
    const box = containerRef.current;
    const menu = menuRef.current;
    if (!box || !menu) return;
    const rect = box.getBoundingClientRect();
    // The canvas may be zoomed: work in the graph's own pixels.
    const scale = rect.width / (box.offsetWidth || rect.width) || 1;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const px = (target.clientX - rect.left) / scale;
    const py = (target.clientY - rect.top) / scale;
    if (w < 440) {
      const low = py > h / 2;
      setSheet(low ? "top" : "bottom");
      setSheetMax(Math.max(160, (low ? py : h - py) - 28));
      return;
    }
    setSheet(null);
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = px + 14;
    if (left + mw > w - 8) left = px - mw - 14;
    let top = py - 20;
    if (top + mh > h - 8) top = h - mh - 8;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [target.clientX, target.clientY, containerRef]);

  // Closes on Esc or a press anywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    // Next tick: the press that opened the menu mustn't close it.
    const id = window.setTimeout(() => window.addEventListener("pointerdown", onDown, true), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const setPosition = (nx: string, ny: string) => {
    setX(nx);
    setY(ny);
    const vx = parseNum(nx);
    const vy = parseNum(ny);
    if (!fixed || vx === null || vy === null) return;
    onPatch({ expr: `${fixed.name ? `${fixed.name} = ` : ""}[${vx}, ${vy}]` });
  };
  const setLabelText = (text: string) => {
    setLabel(text);
    onPatch({ label: text, showLabel: text.trim() ? true : fn.showLabel });
  };
  const copy = async () => {
    const text = `(${fmt(now.x)}, ${fmt(now.y)})`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard permission: nothing else to do.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const liveLabel = liveCoordinatesLabel(fn.label, name);
  const shownX = fixed ? x : fmt(target.x);
  const shownY = fixed ? y : fmt(target.y);

  return (
    <div
      ref={menuRef}
      data-no-trace
      data-capture-exclude
      role="dialog"
      aria-label={`Point ${name ?? ""} options`}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className={`nodrag nowheel absolute z-[70] flex flex-col overflow-hidden border border-slate-200 bg-white/95 text-slate-800 shadow-2xl shadow-slate-900/15 backdrop-blur-md transition-none dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 ${placed ? "animate-in fade-in zoom-in-95 duration-150" : "invisible"} ${sheet === "bottom" ? "inset-x-2 bottom-2 max-h-[62%] rounded-2xl slide-in-from-bottom-4" : sheet === "top" ? "inset-x-2 top-2 max-h-[62%] rounded-2xl slide-in-from-top-4" : "w-[264px] max-h-[calc(100%-16px)] rounded-xl"
        }`}
      // transition-none: duration-150 (meant for the fade-in) would also glide left/top into place.
      style={sheet ? { maxHeight: sheetMax } : { left: pos?.left ?? 0, top: pos?.top ?? 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <span className="size-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ background: fn.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{name ? `Point ${name}` : "Point"}</div>
          <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            ({fmt(now.x)}, {fmt(now.y)})
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3 custom-scrollbar">
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={SECTION}>Label</span>
            <button
              type="button"
              onClick={() => onPatch({ showLabel: !fn.showLabel })}
              aria-pressed={!!fn.showLabel}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400"
            >
              <Tag size={11} /> {fn.showLabel ? "Shown" : "Hidden"}
            </button>
          </div>
          <input
            data-field="label"
            value={label}
            onChange={(e) => setLabelText(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder={name ? `e.g. ${name} or ${name}{{xy}}` : "Label"}
            spellCheck={false}
            className={FIELD}
          />
          <div className="flex flex-wrap gap-1.5">
            {name && (
              <button type="button" onClick={() => setLabelText(name)} className={chip(label === name)}>
                {name}
              </button>
            )}
            <button type="button" onClick={() => setLabelText(liveLabel)} className={chip(label === liveLabel)} title="Shows the coordinates, kept up to date as it moves">
              <span className="font-mono">{name ?? ""}(x, y)</span>
            </button>
            {label && (
              <button type="button" onClick={() => setLabelText("")} className={chip()}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Position */}
        <div className="flex flex-col gap-1.5">
          <span className={SECTION}>Position</span>
          <div className="flex items-center gap-2">
            {(
              [
                ["x", shownX, (v: string) => setPosition(v, y)],
                ["y", shownY, (v: string) => setPosition(x, v)],
              ] as const
            ).map(([axis, value, set]) => (
              <label key={axis} className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="font-mono text-[12px] text-slate-400">{axis}</span>
                <input
                  data-field={axis}
                  value={value}
                  readOnly={!fixed}
                  onChange={(e) => set(e.target.value)}
                  onFocus={(e) => fixed && e.target.select()}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  inputMode="decimal"
                  spellCheck={false}
                  aria-label={`${axis} coordinate`}
                  className={`${FIELD} font-mono ${fixed ? "" : "cursor-default opacity-70"} ${fixed && parseNum(value) === null ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                />
              </label>
            ))}
          </div>
          {!fixed && (
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {handle ? "Set by its sliders: drag it on the graph, or change the sliders." : (
                <>
                  Worked out from <code className="rounded bg-slate-100 px-1 font-mono text-[10px] dark:bg-slate-800">{fn.expr.length > 34 ? `${fn.expr.slice(0, 34)}…` : fn.expr}</code>. Edit it in the list, or duplicate it as a free point.
                </>
              )}
            </p>
          )}
        </div>

        {/* Look */}
        <div className="flex flex-col gap-1.5">
          <span className={SECTION}>Look</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onPatch({ color: c })}
                aria-label={`Colour ${c}`}
                aria-pressed={fn.color.toLowerCase() === c}
                className={`grid size-6 place-items-center rounded-full transition-transform hover:scale-110 ${fn.color.toLowerCase() === c ? "ring-2 ring-offset-2 ring-slate-400 ring-offset-white dark:ring-offset-slate-900" : ""}`}
                style={{ background: c }}
              >
                {fn.color.toLowerCase() === c && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fixed && (
              <button type="button" onClick={() => onPatch({ isDraggable: !fn.isDraggable })} aria-pressed={!!fn.isDraggable} className={chip(!!fn.isDraggable)}>
                <Hand size={12} /> Draggable
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onPatch({ visible: false });
                onClose();
              }}
              className={chip()}
              title="Hide it on the graph (show it again from the list)"
            >
              <EyeOff size={12} /> Hide
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-4 border-t border-slate-100 dark:border-slate-800">
        {(
          [
            { label: copied ? "Copied" : "Copy", Icon: copied ? Check : Copy, run: copy, title: "Copy the coordinates" },
            { label: "Duplicate", Icon: CopyPlus, run: () => onDuplicate(now), title: "A free copy next to it" },
            { label: "In list", Icon: ListTree, run: onShowInList, title: "Show its row in Functions & Equations" },
            { label: "Delete", Icon: Trash2, run: onDelete, title: "Delete this point", danger: true },
          ] as const
        ).map(({ label: text, Icon, run, title, ...rest }) => (
          <button
            key={text}
            type="button"
            onClick={run}
            title={title}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${"danger" in rest
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
          >
            <Icon size={15} />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
