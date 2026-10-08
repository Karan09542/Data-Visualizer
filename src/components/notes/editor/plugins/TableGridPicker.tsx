import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Table, X } from 'lucide-react';

export interface TableGridPickerProps {
  onSelect: (rows: number, cols: number, includeHeaders: boolean) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

export function TableGridPicker({
  onSelect,
  onClose,
  anchorRect,
}: TableGridPickerProps) {
  const [currentRows, setCurrentRows] = useState(3);
  const [currentCols, setCurrentCols] = useState(3);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Dynamic positioning state: starts offscreen to measure without clipping/flashing
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });

  // Calculate and clamp position strictly within viewport edges
  const updatePosition = useCallback(() => {
    if (!pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    const width = rect.width || 264;
    const height = rect.height || 370;

    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let newLeft = Math.round((vw - width) / 2);
    let newTop = Math.round((vh - height) / 2);

    if (anchorRect) {
      // Horizontal positioning: align to anchor left
      newLeft = anchorRect.left;

      // If overflowing right edge, shift left
      if (newLeft + width + margin > vw) {
        newLeft = vw - width - margin;
      }
      // If overflowing left edge, clamp to margin
      if (newLeft < margin) {
        newLeft = margin;
      }

      // Vertical positioning: check space below vs above
      const spaceBelow = vh - anchorRect.bottom - margin;
      const spaceAbove = anchorRect.top - margin;

      if (spaceBelow >= height) {
        // Fits comfortably below
        newTop = anchorRect.bottom + 6;
      } else if (spaceAbove >= height) {
        // Fits comfortably above
        newTop = anchorRect.top - height - 6;
      } else {
        // Not enough space either way: place where there is more room
        if (spaceBelow >= spaceAbove) {
          newTop = anchorRect.bottom + 6;
        } else {
          newTop = anchorRect.top - height - 6;
        }
      }

      // Strict clamping so popup is NEVER clipped outside any viewport edge
      newTop = Math.max(margin, Math.min(newTop, vh - height - margin));
      newLeft = Math.max(margin, Math.min(newLeft, vw - width - margin));
    }

    setPosition({ top: Math.round(newTop), left: Math.round(newLeft) });
  }, [anchorRect]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    let ro: ResizeObserver | null = null;
    if (pickerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updatePosition();
      });
      ro.observe(pickerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      ro?.disconnect();
    };
  }, [updatePosition]);

  // Click outside and Escape listeners
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Touch drag navigation across grid cells
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const cell = el.closest('[data-grid-cell="true"]');
      if (cell) {
        const r = Number(cell.getAttribute('data-row'));
        const c = Number(cell.getAttribute('data-col'));
        if (r && c) {
          setCurrentRows(r);
          setCurrentCols(c);
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onSelect(currentRows, currentCols, includeHeaders);
    }
  }, [isDragging, onSelect, currentRows, currentCols, includeHeaders]);

  const handleCellClick = (r: number, c: number) => {
    setCurrentRows(r);
    setCurrentCols(c);
    onSelect(r, c, includeHeaders);
  };

  const presets = [
    { label: '1×1', r: 1, c: 1 },
    { label: '2×2', r: 2, c: 2 },
    { label: '3×3', r: 3, c: 3 },
    { label: '4×4', r: 4, c: 4 },
    { label: '5×5', r: 5, c: 5 },
  ];

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Table dimension picker"
      className="fixed z-[110000] w-[268px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto bg-white/95 dark:bg-[#1c1c1f]/95 backdrop-blur-xl border border-black/8 dark:border-white/12 rounded-2xl shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] p-3.5 animate-in fade-in select-none custom-scrollbar sticky-note-scrollbar"
      style={{
        top: position.top,
        left: position.left,
        visibility: position.top === -9999 ? 'hidden' : 'visible',
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/6 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600/10 dark:bg-red-500/15 text-red-600 dark:text-red-400">
            <Table size={14} className="shrink-0" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-black/85 dark:text-white/90 leading-tight">
              {currentRows} × {currentCols} Table
            </span>
            <span className="text-[10px] text-black/40 dark:text-white/40">
              {currentRows} {currentRows === 1 ? 'row' : 'rows'}, {currentCols}{' '}
              {currentCols === 1 ? 'col' : 'cols'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Quick Dimension Presets */}
      <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-0.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleCellClick(preset.r, preset.c)}
            onMouseEnter={() => {
              setCurrentRows(preset.r);
              setCurrentCols(preset.c);
            }}
            className={`px-2 py-0.5 text-[10px] font-mono border rounded-lg cursor-pointer transition-colors ${
              currentRows === preset.r && currentCols === preset.c
                ? 'bg-red-600 text-white border-red-600 font-semibold shadow-xs'
                : 'border-black/8 dark:border-white/12 bg-black/4 dark:bg-white/6 text-black/70 dark:text-white/70 hover:border-black/20 dark:hover:border-white/20'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Interactive Square Grid */}
      <div
        className="p-2 bg-black/3 dark:bg-white/4 border border-black/6 dark:border-white/8 rounded-xl mb-2.5 cursor-crosshair"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => {
          if (isDragging) {
            setIsDragging(false);
          }
        }}
        onTouchStart={() => setIsDragging(true)}
      >
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: MAX_ROWS }).map((_, rowIndex) => {
            const row = rowIndex + 1;
            return Array.from({ length: MAX_COLS }).map((_, colIndex) => {
              const col = colIndex + 1;
              const isSelected = row <= currentRows && col <= currentCols;

              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  data-grid-cell="true"
                  data-row={row}
                  data-col={col}
                  aria-label={`${row} by ${col}`}
                  onMouseEnter={() => {
                    setCurrentRows(row);
                    setCurrentCols(col);
                  }}
                  onClick={() => handleCellClick(row, col)}
                  className={`w-6 h-6 border rounded-md transition-colors ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-600 dark:bg-red-600 dark:border-red-500 shadow-xs'
                      : 'bg-white dark:bg-[#252528] border-black/10 dark:border-white/15 hover:border-black/30'
                  }`}
                />
              );
            });
          })}
        </div>
      </div>

      {/* Custom Dimension Inputs & Options */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/6 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-mono text-black/60 dark:text-white/60 flex items-center gap-1">
            R
            <input
              type="number"
              min={1}
              max={30}
              value={currentRows}
              onChange={(e) =>
                setCurrentRows(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))
              }
              className="w-10 px-1 py-0.5 text-xs text-center border border-black/10 dark:border-white/15 bg-white dark:bg-[#121214] rounded-lg text-black dark:text-white focus:border-red-600 outline-none"
            />
          </label>
          <span className="text-xs text-black/35 dark:text-white/35 font-mono">×</span>
          <label className="text-[11px] font-mono text-black/60 dark:text-white/60 flex items-center gap-1">
            C
            <input
              type="number"
              min={1}
              max={20}
              value={currentCols}
              onChange={(e) =>
                setCurrentCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
              }
              className="w-10 px-1 py-0.5 text-xs text-center border border-black/10 dark:border-white/15 bg-white dark:bg-[#121214] rounded-lg text-black dark:text-white focus:border-red-600 outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onSelect(currentRows, currentCols, includeHeaders)}
          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          Insert
        </button>
      </div>

      {/* Header toggle */}
      <div className="mt-2 pt-1.5 flex items-center">
        <label className="flex items-center gap-1.5 text-[11px] text-black/60 dark:text-white/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeHeaders}
            onChange={(e) => setIncludeHeaders(e.target.checked)}
            className="rounded accent-red-600 cursor-pointer"
          />
          <span>Include header row</span>
        </label>
      </div>
    </div>,
    document.body
  );
}
