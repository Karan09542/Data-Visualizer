import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, Table, X } from 'lucide-react';

export interface TableGridPickerProps {
  onSelect: (rows: number, cols: number, includeHeaders: boolean) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

/** The grid shown; bigger tables are set with the steppers. */
const GRID_ROWS = 8;
const GRID_COLS = 8;
const MAX_ROWS = 30;
const MAX_COLS = 20;
const CELL = 26;
const GAP = 4;
const PRESETS = [
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [3, 5],
] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Whether the main pointer is a finger: then a tap chooses a size and Insert confirms it. */
const useCoarsePointer = () => {
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
};

/**
 * Picks a table's size. With a mouse, point at a cell to see the size and click to
 * insert. With a finger, tap or drag across the grid to choose, then press Insert.
 * The steppers go past the grid (up to 30 rows, 20 columns); the arrow keys and
 * Enter work too.
 */
export function TableGridPicker({ onSelect, onClose, anchorRect }: TableGridPickerProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const coarse = useCoarsePointer();
  const pickerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; type: string } | null>(null);

  // ─── Placement: by the menu item, kept inside the screen ────────────────────
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const updatePosition = useCallback(() => {
    const el = pickerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = (vw - width) / 2;
    let top = (vh - height) / 2;
    if (anchorRect) {
      left = anchorRect.left;
      const below = vh - anchorRect.bottom - margin;
      const above = anchorRect.top - margin;
      top = below >= height || below >= above ? anchorRect.bottom + 6 : anchorRect.top - height - 6;
    }
    setPosition({
      top: Math.round(clamp(top, margin, Math.max(margin, vh - height - margin))),
      left: Math.round(clamp(left, margin, Math.max(margin, vw - width - margin))),
    });
  }, [anchorRect]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (pickerRef.current) ro?.observe(pickerRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      ro?.disconnect();
    };
  }, [updatePosition]);

  const insert = useCallback(
    (r = rows, c = cols) => onSelect(clamp(r, 1, MAX_ROWS), clamp(c, 1, MAX_COLS), includeHeaders),
    [rows, cols, includeHeaders, onSelect],
  );

  // ─── Closing, and the keyboard ──────────────────────────────────────────────
  useEffect(() => {
    // A touch or click anywhere else closes it (pointerdown: mouse and touch alike).
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
      let handled = true;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') insert();
      else if (typing) handled = false;
      else if (e.key === 'ArrowRight') setCols((c) => clamp(c + 1, 1, MAX_COLS));
      else if (e.key === 'ArrowLeft') setCols((c) => clamp(c - 1, 1, MAX_COLS));
      else if (e.key === 'ArrowDown') setRows((r) => clamp(r + 1, 1, MAX_ROWS));
      else if (e.key === 'ArrowUp') setRows((r) => clamp(r - 1, 1, MAX_ROWS));
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose, insert]);

  // ─── The grid: one set of pointer handlers for mouse, pen and finger ────────
  /** The cell under a point, worked out from the grid's geometry (no hit-testing). */
  const cellAt = (clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    // On a zoomed page a screen pixel isn't a layout pixel.
    const k = el.offsetWidth ? box.width / el.offsetWidth : 1;
    const x = (clientX - box.left) / k;
    const y = (clientY - box.top) / k;
    return {
      r: clamp(Math.floor(y / (CELL + GAP)) + 1, 1, GRID_ROWS),
      c: clamp(Math.floor(x / (CELL + GAP)) + 1, 1, GRID_COLS),
    };
  };
  const show = (cell: { r: number; c: number } | null) => {
    if (!cell) return;
    setRows(cell.r);
    setCols(cell.c);
  };

  const onGridDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not every browser captures every pointer */
    }
    press.current = { id: e.pointerId, type: e.pointerType };
    show(cellAt(e.clientX, e.clientY));
  };
  const onGridMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pressing = press.current?.id === e.pointerId;
    // A mouse previews as it hovers; a finger or pen only while pressed.
    if (pressing || e.pointerType === 'mouse') show(cellAt(e.clientX, e.clientY));
  };
  const onGridUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (e.type === 'pointercancel') return;
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    show(cell);
    // A click inserts straight away; a finger chooses, and Insert confirms.
    if (p.type === 'mouse') insert(cell.r, cell.c);
  };

  const stepper = (label: string, value: number, max: number, set: (v: number) => void) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-medium text-black/60 dark:text-white/60">{label}</span>
      <div className="flex items-center rounded-xl border border-black/8 dark:border-white/12 bg-black/[0.03] dark:bg-white/[0.04] p-0.5">
        <button
          type="button"
          onClick={() => set(clamp(value - 1, 1, max))}
          disabled={value <= 1}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-black/60 dark:text-white/60 hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v)) set(clamp(v, 1, max));
          }}
          aria-label={label}
          className="w-9 bg-transparent text-center text-[13px] font-semibold tabular-nums text-black/85 dark:text-white/90 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(clamp(value + 1, 1, max))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-black/60 dark:text-white/60 hover:bg-black/6 dark:hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );

  const gridWidth = GRID_COLS * CELL + (GRID_COLS - 1) * GAP;

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Insert a table"
      className="fixed z-[110000] w-[300px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-black/8 dark:border-white/12 bg-white/97 dark:bg-[#1c1c1f]/97 backdrop-blur-xl shadow-[0_24px_48px_-16px_rgba(0,0,0,0.45)] p-3 select-none sticky-note-scrollbar"
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, visibility: position ? 'visible' : 'hidden' }}
    >
      {/* Title and the size chosen */}
      <div className="flex items-center gap-2 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
          <Table size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-black/85 dark:text-white/90 leading-tight">Insert table</div>
          <div className="text-[11px] text-black/45 dark:text-white/45 leading-tight">
            {coarse ? 'Tap or drag to choose a size' : 'Click a cell to insert'}
          </div>
        </div>
        <span
          className="shrink-0 rounded-lg bg-black/5 dark:bg-white/8 px-2 py-1 text-[12px] font-semibold tabular-nums text-black/80 dark:text-white/85"
          aria-live="polite"
        >
          {rows} × {cols}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Presets */}
      <div className="flex items-center gap-1.5 pb-3" role="radiogroup" aria-label="Common sizes">
        {PRESETS.map(([r, c]) => {
          const on = rows === r && cols === c;
          return (
            <button
              key={`${r}x${c}`}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setRows(r);
                setCols(c);
              }}
              className={`h-7 flex-1 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                on
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-black/60 dark:text-white/65 hover:bg-black/8 dark:hover:bg-white/12'
              }`}
            >
              {r}×{c}
            </button>
          );
        })}
      </div>

      {/* The grid */}
      <div className="flex justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.035] border border-black/6 dark:border-white/8 py-3">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Table size: ${rows} rows by ${cols} columns`}
          className="relative grid touch-none cursor-pointer"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`, gap: GAP, width: gridWidth }}
          onPointerDown={onGridDown}
          onPointerMove={onGridMove}
          onPointerUp={onGridUp}
          onPointerCancel={onGridUp}
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
            const r = Math.floor(i / GRID_COLS) + 1;
            const c = (i % GRID_COLS) + 1;
            const on = r <= rows && c <= cols;
            const header = on && includeHeaders && r === 1;
            return (
              <div
                key={i}
                aria-hidden
                className={`rounded-[6px] border transition-colors duration-75 ${
                  header
                    ? 'bg-red-600 border-red-600'
                    : on
                      ? 'bg-red-500/80 border-red-500/80'
                      : 'bg-white dark:bg-[#26262a] border-black/10 dark:border-white/10'
                }`}
                style={{ height: CELL }}
              />
            );
          })}
        </div>
      </div>
      {(rows > GRID_ROWS || cols > GRID_COLS) && (
        <p className="pt-1.5 text-center text-[10px] text-black/45 dark:text-white/45">Bigger than the grid: set with the steppers below.</p>
      )}

      {/* Exact size and options */}
      <div className="flex flex-col gap-2 pt-3">
        {stepper('Rows', rows, MAX_ROWS, setRows)}
        {stepper('Columns', cols, MAX_COLS, setCols)}
        <label className="flex items-center justify-between gap-2 cursor-pointer pt-0.5">
          <span className="text-[12px] font-medium text-black/60 dark:text-white/60">Header row</span>
          <button
            type="button"
            role="switch"
            aria-checked={includeHeaders}
            onClick={() => setIncludeHeaders((v) => !v)}
            className={`relative h-6 w-10 rounded-full transition-colors ${includeHeaders ? 'bg-red-500' : 'bg-black/15 dark:bg-white/20'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${includeHeaders ? 'translate-x-4' : ''}`}
            />
          </button>
        </label>
      </div>

      <button
        type="button"
        onClick={() => insert()}
        className="mt-3 h-10 w-full rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-[13px] font-semibold text-white shadow-sm transition-colors"
      >
        Insert {rows} × {cols} table
      </button>
    </div>,
    document.body,
  );
}
