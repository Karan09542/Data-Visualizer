import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnDef,
  FilterFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search, ChevronDown, ChevronUp, Mail,
  Link as LinkIcon, X, Filter, Check, Copy,
  GripVertical, FileSpreadsheet, FileCode, ClipboardCopy, Pencil,
  BarChart3, TableProperties
} from 'lucide-react';
import { TableChartVisualizer } from './TableChartVisualizer';

interface TableViewProps {
  data: any[];
  title?: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  onSaveData?: (updatedData: any[]) => void;
}

// ------------------------------
// Type Checkers & Highlight Logic
// ------------------------------

const isHexColor = (val: string) => /^#([0-9A-F]{3}){1,2}$/i.test(val);
const isRgb = (val: string) => /^(rgb|rgba)\(/.test(val);
const isUrl = (val: string) => /^https?:\/\//i.test(val);
const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight) return <span>{text}</span>;
  const terms = highlight.toLowerCase().split(' ').filter(Boolean);
  if (terms.length === 0) return <span>{text}</span>;

  const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = terms.includes(part.toLowerCase());
        return isMatch ? (
          <mark key={i} className="bg-emerald-200/90 dark:bg-emerald-500/35 text-emerald-950 dark:text-emerald-100 rounded-xs px-0.5 font-medium">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
};

const CellRenderer = ({ value, globalFilter }: { value: any; globalFilter: string }) => {
  if (value === null || value === undefined) return <span className="text-slate-400 dark:text-emerald-700/60 italic text-xs">null</span>;

  if (typeof value === 'boolean') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${value ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold' : 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-400'}`}>
        {value ? 'True' : 'False'}
      </span>
    );
  }

  if (typeof value === 'object') {
    return <span className="text-slate-400 dark:text-emerald-700/80 font-mono text-xs">{'{...}'}</span>;
  }

  const strVal = String(value);

  // Truncate at JavaScript level to avoid huge DOM text nodes which cause 
  // severe lag and memory issues on mobile, even if visually clipped via CSS.
  const MAX_RENDER_LEN = 1000;
  const displayVal = strVal.length > MAX_RENDER_LEN ? strVal.substring(0, MAX_RENDER_LEN) + '...' : strVal;

  if (isHexColor(strVal) || isRgb(strVal)) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded shadow-sm border border-slate-200 dark:border-slate-700 flex-shrink-0" style={{ backgroundColor: strVal }} />
        <span className="font-mono text-xs truncate w-full"><HighlightText text={displayVal} highlight={globalFilter} /></span>
      </div>
    );
  }

  if (isUrl(strVal)) {
    const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(strVal);
    if (isImage) {
      return (
        <div className="flex items-center gap-2 group/img relative w-full">
          <img src={strVal} alt="" className="w-6 h-6 object-cover rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0" loading="lazy" />
          <span className="text-xs truncate text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"><HighlightText text={displayVal} highlight={globalFilter} /></span>
        </div>
      );
    }
    return (
      <a href={strVal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline text-xs max-w-full" onClick={e => e.stopPropagation()}>
        <LinkIcon size={12} className="flex-shrink-0" />
        <span className="truncate"><HighlightText text={displayVal} highlight={globalFilter} /></span>
      </a>
    );
  }

  if (isEmail(strVal)) {
    return (
      <a href={`mailto:${strVal}`} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline text-xs max-w-full" onClick={e => e.stopPropagation()}>
        <Mail size={12} className="flex-shrink-0" />
        <span className="truncate"><HighlightText text={displayVal} highlight={globalFilter} /></span>
      </a>
    );
  }

  return <span className="truncate block w-full"><HighlightText text={displayVal} highlight={globalFilter} /></span>;
};

// ------------------------------
// Custom Filter Function
// ------------------------------
const multiTermGlobalFilter: FilterFn<any> = (row, columnId, filterValue) => {
  const terms = String(filterValue).toLowerCase().split(' ').filter(Boolean);
  if (terms.length === 0) return true;

  // Combine all visible cell string values into a single lowercase string for easy partial matching
  const rowValues = row.getVisibleCells().map(cell => String(cell.getValue() ?? '').toLowerCase());
  const combinedRowText = rowValues.join(' ');

  // Check if ALL terms match somewhere in the row
  return terms.every(term => combinedRowText.includes(term));
};

// ------------------------------
// Table Component
// ------------------------------
export function TableView({ data, title, isMaximized, onToggleMaximize, onClose, onSaveData }: TableViewProps) {
  const [tableData, setTableData] = useState<any[]>(() => (Array.isArray(data) ? [...data] : []));
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  useEffect(() => {
    setTableData(Array.isArray(data) ? [...data] : []);
  }, [data]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  // Column specific filters
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  // Column reorder state
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null);
  const [dropColSide, setDropColSide] = useState<'left' | 'right'>('left');
  const isDraggingCol = useRef(false);

  // Row reorder state
  const [draggedRowIdx, setDraggedRowIdx] = useState<number | null>(null);
  const [dropTargetRowIdx, setDropTargetRowIdx] = useState<number | null>(null);
  const [dropRowSide, setDropRowSide] = useState<'above' | 'below'>('above');

  // Excel-style Cell/Range Selection state
  const [selection, setSelection] = useState<{
    anchor: { row: number; colIdx: number };
    focus: { row: number; colIdx: number };
  } | null>(null);
  const isSelectingRef = useRef(false);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  // Inline cell editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
    value: string;
  } | null>(null);
  const lastTapRef = useRef<{ row: number; colId: string; time: number } | null>(null);

  const startEditing = useCallback((rowIndex: number, columnId: string, initialValue: any) => {
    let strVal = '';
    if (initialValue !== null && initialValue !== undefined) {
      strVal = typeof initialValue === 'object' ? JSON.stringify(initialValue) : String(initialValue);
    }
    setEditingCell({
      rowIndex,
      columnId,
      value: strVal,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell) return;
    const { rowIndex, columnId, value } = editingCell;

    let parsedVal: any = value;
    if (value.toLowerCase() === 'true') parsedVal = true;
    else if (value.toLowerCase() === 'false') parsedVal = false;
    else if (value !== '' && !isNaN(Number(value)) && (!value.startsWith('0') || value === '0')) {
      parsedVal = Number(value);
    }

    setTableData((prev) => {
      const updated = [...prev];
      if (updated[rowIndex]) {
        updated[rowIndex] = { ...updated[rowIndex], [columnId]: parsedVal };
      }
      onSaveData?.(updated);
      return updated;
    });

    setEditingCell(null);
  }, [editingCell, onSaveData]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || data.length === 0) return [];

    const sampleSize = Math.min(data.length, 50);
    const allKeys = new Set<string>();
    for (let i = 0; i < sampleSize; i++) {
      const row = data[i];
      if (typeof row === 'object' && row !== null) {
        Object.keys(row).forEach(k => allKeys.add(k));
      }
    }

    return Array.from(allKeys).map(key => {
      return {
        accessorKey: key,
        header: () => (
          <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="truncate">{key}</span>
          </div>
        ),
        cell: info => {
          return <CellRenderer value={info.getValue()} globalFilter={globalFilter} />;
        },
        size: Math.max(120, Math.min(400, key.length * 10 + 60))
      };
    });
  }, [data, globalFilter]);

  useEffect(() => {
    if (columns.length > 0) {
      setColumnOrder((prev) => {
        if (prev.length === 0) {
          return columns.map((c) => (c as any).accessorKey || c.id);
        }
        const newCols = columns
          .map((c) => (c as any).accessorKey || c.id)
          .filter((id) => !prev.includes(id));
        return [...prev, ...newCols];
      });
    }
  }, [columns]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnOrder,
    },
    // Allows resizing
    columnResizeMode: 'onChange',
    globalFilterFn: multiTermGlobalFilter,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();
  const parentRef = useRef<HTMLDivElement>(null);

  // Selection bounding box calculation
  const selectionBounds = useMemo(() => {
    if (!selection || rows.length === 0 || visibleColumns.length === 0) return null;
    const minRow = Math.max(0, Math.min(selection.anchor.row, selection.focus.row));
    const maxRow = Math.min(rows.length - 1, Math.max(selection.anchor.row, selection.focus.row));
    const minCol = Math.max(0, Math.min(selection.anchor.colIdx, selection.focus.colIdx));
    const maxCol = Math.min(visibleColumns.length - 1, Math.max(selection.anchor.colIdx, selection.focus.colIdx));

    if (minRow > maxRow || minCol > maxCol) return null;

    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const cellCount = rowCount * colCount;

    return { minRow, maxRow, minCol, maxCol, rowCount, colCount, cellCount };
  }, [selection, rows.length, visibleColumns.length]);

  const isCellSelected = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!selectionBounds) return false;
      return (
        rowIdx >= selectionBounds.minRow &&
        rowIdx <= selectionBounds.maxRow &&
        colIdx >= selectionBounds.minCol &&
        colIdx <= selectionBounds.maxCol
      );
    },
    [selectionBounds]
  );

  // Structured matrix of selected data
  const getSelectedDataMatrix = useCallback(() => {
    if (!selectionBounds) return { headers: [], matrix: [] };
    const { minRow, maxRow, minCol, maxCol } = selectionBounds;
    const selectedCols = visibleColumns.slice(minCol, maxCol + 1);
    const headers = selectedCols.map(c => {
      return String(c.id || (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id));
    });

    const matrix: string[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row = rows[r];
      if (!row) continue;
      const rowValues = selectedCols.map(c => {
        const val = row.getValue(c.id);
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
      matrix.push(rowValues);
    }
    return { headers, matrix };
  }, [selectionBounds, visibleColumns, rows]);

  // Multi-format copy logic
  const copyFormatted = useCallback(
    (format: 'table' | 'csv' | 'json' | 'tsv') => {
      const { headers, matrix } = getSelectedDataMatrix();
      if (headers.length === 0 || matrix.length === 0) return;

      let textToCopy = '';

      if (format === 'table') {
        // ASCII Boxed Table surrounded with + and -
        const colWidths = headers.map((h, colIdx) => {
          let max = h.length;
          for (const row of matrix) {
            const cellLen = (row[colIdx] ?? '').length;
            if (cellLen > max) max = cellLen;
          }
          return Math.max(max, 1);
        });

        const borderLine = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
        const headerLine = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |';
        const dataLines = matrix.map(row => {
          return '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |';
        });

        textToCopy = [borderLine, headerLine, borderLine, ...dataLines, borderLine].join('\n');
      } else if (format === 'csv') {
        const escapeCsv = (val: string) => {
          if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        textToCopy = [
          headers.map(escapeCsv).join(','),
          ...matrix.map(row => row.map(escapeCsv).join(','))
        ].join('\n');
      } else if (format === 'json') {
        const jsonObjects = matrix.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            const val = row[i];
            if (val === 'true') obj[h] = true;
            else if (val === 'false') obj[h] = false;
            else if (val !== '' && !isNaN(Number(val))) obj[h] = Number(val);
            else obj[h] = val;
          });
          return obj;
        });
        textToCopy = JSON.stringify(jsonObjects, null, 2);
      } else if (format === 'tsv') {
        textToCopy = [
          headers.join('\t'),
          ...matrix.map(row => row.join('\t'))
        ].join('\n');
      }

      navigator.clipboard.writeText(textToCopy);
      const labelMap = {
        table: 'Table (+/-)',
        csv: 'CSV',
        json: 'JSON',
        tsv: 'Excel (TSV)'
      };
      setCopiedFeedback(`Copied as ${labelMap[format]}!`);
      setTimeout(() => setCopiedFeedback(null), 2500);
    },
    [getSelectedDataMatrix]
  );

  // Global mouseup to finish drag-select
  useEffect(() => {
    const handleMouseUp = () => {
      isSelectingRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Keyboard shortcuts (Ctrl+C, Ctrl+A, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        if (rows.length > 0 && visibleColumns.length > 0) {
          e.preventDefault();
          setSelection({
            anchor: { row: 0, colIdx: 0 },
            focus: { row: rows.length - 1, colIdx: visibleColumns.length - 1 }
          });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (!selectionBounds) return;
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0 && !parentRef.current?.contains(sel.anchorNode)) {
          return;
        }
        e.preventDefault();
        copyFormatted('tsv');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionBounds, rows.length, visibleColumns.length, copyFormatted]);

  // Touch Move handler for mobile drag-selection
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSelectingRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const cellEl = target.closest('[data-cell-row]');
    if (cellEl) {
      const r = parseInt(cellEl.getAttribute('data-cell-row') || '', 10);
      const c = parseInt(cellEl.getAttribute('data-cell-col') || '', 10);
      if (!isNaN(r) && !isNaN(c)) {
        setSelection(prev => (prev ? { ...prev, focus: { row: r, colIdx: c } } : null));
      }
    }
  };

  const handleSelectAll = () => {
    if (rows.length === 0 || visibleColumns.length === 0) return;
    if (
      selectionBounds &&
      selectionBounds.rowCount === rows.length &&
      selectionBounds.colCount === visibleColumns.length
    ) {
      setSelection(null);
    } else {
      setSelection({
        anchor: { row: 0, colIdx: 0 },
        focus: { row: rows.length - 1, colIdx: visibleColumns.length - 1 }
      });
    }
  };

  const handleColumnHeaderClick = (colIdx: number, e: React.MouseEvent) => {
    if (rows.length === 0) return;
    if (e.shiftKey && selection) {
      setSelection({
        anchor: selection.anchor,
        focus: { row: rows.length - 1, colIdx }
      });
    } else {
      setSelection({
        anchor: { row: 0, colIdx },
        focus: { row: rows.length - 1, colIdx }
      });
    }
  };

  const handleRowHeaderClick = (rowIdx: number, e: React.MouseEvent) => {
    if (visibleColumns.length === 0) return;
    if (e.shiftKey && selection) {
      setSelection({
        anchor: selection.anchor,
        focus: { row: rowIdx, colIdx: visibleColumns.length - 1 }
      });
    } else {
      setSelection({
        anchor: { row: rowIdx, colIdx: 0 },
        focus: { row: rowIdx, colIdx: visibleColumns.length - 1 }
      });
    }
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const totalCols = columns.length;
  const isFiltered = globalFilter || columnFilters.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#f8faf9] dark:bg-[#0a0f0d] overflow-hidden relative text-slate-800 dark:text-emerald-50">

      {/* Search and Summary Bar */}
      <div className="flex flex-col border-b border-slate-200/80 dark:border-emerald-950/60 bg-white/95 dark:bg-[#0d1613]/95 backdrop-blur-md z-20 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3">
          {/* Summary Badges & Title */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0">
            {title && (
              <>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-emerald-100 truncate max-w-[130px] sm:max-w-[220px] shrink-0" title={title}>
                  {title}
                </h3>
                <div className="h-3.5 w-[1px] bg-slate-300 dark:bg-emerald-800/60 shrink-0" />
              </>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/40 shrink-0 font-mono">
                {data.length.toLocaleString()} Rows
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/40 shrink-0 font-mono">
                {totalCols} Columns
              </span>
              {isFiltered && (
                <span className="text-[11px] sm:text-xs font-semibold text-white bg-emerald-600 dark:bg-emerald-500 px-2 py-0.5 rounded-md shadow-xs shrink-0">
                  {rows.length.toLocaleString()} Filtered
                </span>
              )}
              {(columnOrder.length > 0 || tableData !== data) && (
                <button
                  onClick={() => {
                    setColumnOrder(columns.map((c) => (c as any).accessorKey || c.id));
                    setTableData(Array.isArray(data) ? [...data] : []);
                    setSorting([]);
                  }}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline decoration-emerald-300 dark:decoration-emerald-700 underline-offset-2 px-1 transition-colors shrink-0"
                  title="Reset columns and rows to original order"
                >
                  Reset Order
                </button>
              )}
            </div>
          </div>

          {/* Controls: View Toggle & Search Input */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* View Mode Segmented Toggle: Table vs Chart */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#121f19] rounded-lg border border-slate-200/80 dark:border-emerald-900/40 shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Grid Table View"
              >
                <TableProperties size={13} />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'chart'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
                }`}
                title="Visualize Data with Interactive D3 Charts"
              >
                <BarChart3 size={13} />
                <span>Visualize (D3)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56 md:w-72 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-emerald-600 pointer-events-none" />
              <input
                type="text"
                placeholder="Search all data..."
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50/90 dark:bg-[#121d18] border border-slate-200 dark:border-emerald-900/50 rounded-lg text-slate-800 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs transition-all placeholder:text-slate-400 dark:placeholder:text-emerald-700"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-emerald-300 p-0.5"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content: Either Interactive D3 Chart or Table Data Grid */}
      {viewMode === 'chart' ? (
        <div className="flex-1 w-full overflow-hidden">
          <TableChartVisualizer
            data={rows.map((r) => r.original)}
            title={title}
          />
        </div>
      ) : (
        /* Table Data Grid */
        <div
          className="flex-1 overflow-auto relative custom-scrollbar bg-[#fafcfb] dark:bg-[#0a0f0d]"
          ref={parentRef}
          onTouchMove={handleTouchMove}
        >
        <div
          style={{
            height: `${virtualizer.getTotalSize() + 40}px`,
            width: table.getTotalSize() + 44,
            position: 'relative'
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200/80 dark:border-emerald-950/70 bg-[#f4f7f5]/95 dark:bg-[#0e1714]/95 backdrop-blur-md shadow-xs">
            {/* Sticky Row # / Select All header */}
            <div
              onClick={handleSelectAll}
              className={`sticky left-0 z-30 w-11 shrink-0 px-2 py-2 flex items-center justify-center text-[11px] font-mono font-semibold select-none cursor-pointer transition-colors border-r border-slate-200/80 dark:border-emerald-950/70 ${
                selectionBounds &&
                selectionBounds.rowCount === rows.length &&
                selectionBounds.colCount === visibleColumns.length
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#ebf2ee] dark:bg-[#0b1310] text-slate-500 dark:text-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 hover:text-emerald-700'
              }`}
              title="Click to select all cells (Ctrl+A)"
            >
              #
            </div>
            {table.getHeaderGroups().map(headerGroup => (
              <React.Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header, colIdx) => {
                  const isThisColDragged = draggedColId === header.column.id;
                  const isThisDropTarget = dropTargetColId === header.column.id;
                  const isColSelected =
                    selectionBounds !== null &&
                    colIdx >= selectionBounds.minCol &&
                    colIdx <= selectionBounds.maxCol;

                  return (
                    <div
                      key={header.id}
                      draggable={!header.column.getIsResizing()}
                      onClick={(e) => {
                        if (isDraggingCol.current) return;
                        if ((e.target as HTMLElement).closest('[data-sort-trigger], [data-resize-handle]')) return;
                        handleColumnHeaderClick(colIdx, e);
                      }}
                      onDragStart={(e) => {
                        isDraggingCol.current = true;
                        setDraggedColId(header.column.id);
                        e.dataTransfer.setData('text/column-id', header.column.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setTimeout(() => {
                          isDraggingCol.current = false;
                        }, 50);
                        setDraggedColId(null);
                        setDropTargetColId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (!draggedColId || draggedColId === header.column.id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midX = rect.left + rect.width / 2;
                        const side = e.clientX < midX ? 'left' : 'right';
                        setDropTargetColId(header.column.id);
                        setDropColSide(side);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (dropTargetColId === header.column.id) {
                            setDropTargetColId(null);
                          }
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceColId = e.dataTransfer.getData('text/column-id') || draggedColId;
                        if (!sourceColId || sourceColId === header.column.id) {
                          setDraggedColId(null);
                          setDropTargetColId(null);
                          return;
                        }

                        setColumnOrder((prevOrder) => {
                          const order = prevOrder.length > 0 ? [...prevOrder] : columns.map(c => (c as any).accessorKey || c.id);
                          const fromIdx = order.indexOf(sourceColId);
                          let toIdx = order.indexOf(header.column.id);
                          if (fromIdx === -1 || toIdx === -1) return prevOrder;

                          order.splice(fromIdx, 1);
                          if (dropColSide === 'right') {
                            toIdx = order.indexOf(header.column.id) + 1;
                          } else {
                            toIdx = order.indexOf(header.column.id);
                          }
                          order.splice(toIdx, 0, sourceColId);
                          return order;
                        });

                        setDraggedColId(null);
                        setDropTargetColId(null);
                      }}
                      className={`group relative flex items-center shrink-0 px-2.5 py-2 text-xs font-semibold select-none border-r border-slate-200/80 dark:border-emerald-950/70 transition-colors cursor-pointer ${
                        isThisColDragged
                          ? 'opacity-30 bg-emerald-100/50 dark:bg-emerald-900/30'
                          : isColSelected
                          ? 'bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'text-slate-700 dark:text-emerald-100/90 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30'
                      } ${isThisDropTarget && dropColSide === 'left' ? 'border-l-2 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/30' : ''
                        } ${isThisDropTarget && dropColSide === 'right' ? 'border-r-2 border-r-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/30' : ''
                        }`}
                      style={{ width: header.getSize() }}
                      title="Click to select column, drag to reorder"
                    >
                      <GripVertical
                        size={12}
                        className="text-slate-400 dark:text-emerald-600/70 opacity-0 group-hover:opacity-90 transition-opacity mr-1 shrink-0 cursor-grab active:cursor-grabbing"
                      />
                      <div className="flex-1 flex items-center justify-between overflow-hidden">
                        <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        <button
                          data-sort-trigger="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            header.column.getToggleSortingHandler()?.(e);
                          }}
                          className="flex-shrink-0 ml-1.5 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
                          title="Toggle sort"
                        >
                          {{
                            asc: <ChevronUp size={14} />,
                            desc: <ChevronDown size={14} />
                          }[header.column.getIsSorted() as string] ?? <ChevronUp size={14} className="opacity-30 hover:opacity-100" />}
                        </button>
                      </div>

                      {/* Resize handle */}
                      <div
                        data-resize-handle="true"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          header.getResizeHandler()(e);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          header.getResizeHandler()(e);
                        }}
                        draggable={false}
                        className={`absolute right-0 top-0 h-full w-4 translate-x-1/2 cursor-col-resize flex justify-center z-20 select-none touch-none group/resizer ${header.column.getIsResizing() ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                      >
                        <div
                          className={`w-[2px] h-full transition-colors ${header.column.getIsResizing()
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                              : 'bg-slate-400/80 dark:bg-emerald-700/60 group-hover/resizer:bg-emerald-500'
                            }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="relative w-full">
            {rows.length === 0 ? (
              <div className="absolute top-[40px] left-0 w-full flex flex-col items-center justify-center p-10 text-slate-500 dark:text-emerald-600">
                <Filter size={32} className="opacity-25 mb-3 text-emerald-500" />
                <p className="text-sm font-medium">No matching rows found</p>
              </div>
            ) : (
              virtualRows.map(virtualRow => {
                const row = rows[virtualRow.index];
                const isThisRowDragged = draggedRowIdx === virtualRow.index;
                const isThisRowDropTarget = dropTargetRowIdx === virtualRow.index;
                const isRowSelected =
                  selectionBounds !== null &&
                  virtualRow.index >= selectionBounds.minRow &&
                  virtualRow.index <= selectionBounds.maxRow;

                return (
                  <div
                    key={row.id}
                    className={`absolute top-0 left-0 flex w-full border-b border-slate-100 dark:border-emerald-950/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors group/row ${isThisRowDragged ? 'opacity-30 bg-emerald-100/50 dark:bg-emerald-950/40' : ''
                      } ${isThisRowDropTarget && dropRowSide === 'above' ? 'border-t-2 border-t-emerald-500' : ''
                      } ${isThisRowDropTarget && dropRowSide === 'below' ? 'border-b-2 border-b-emerald-500' : ''
                      }`}
                    style={{
                      transform: `translateY(${virtualRow.start + 36}px)`,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedRowIdx === null || draggedRowIdx === virtualRow.index) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      setDropTargetRowIdx(virtualRow.index);
                      setDropRowSide(e.clientY < midY ? 'above' : 'below');
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dropTargetRowIdx === virtualRow.index) {
                          setDropTargetRowIdx(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceIdxStr = e.dataTransfer.getData('text/row-index');
                      const sourceIdx = sourceIdxStr ? parseInt(sourceIdxStr, 10) : draggedRowIdx;
                      if (sourceIdx === null || isNaN(sourceIdx) || sourceIdx === virtualRow.index) {
                        setDraggedRowIdx(null);
                        setDropTargetRowIdx(null);
                        return;
                      }

                      setTableData(prev => {
                        const next = [...prev];
                        const [movedItem] = next.splice(sourceIdx, 1);
                        let targetIdx = virtualRow.index;
                        if (dropRowSide === 'below') {
                          targetIdx = targetIdx + (sourceIdx < targetIdx ? 0 : 1);
                        } else {
                          targetIdx = targetIdx - (sourceIdx < targetIdx ? 1 : 0);
                        }
                        next.splice(Math.max(0, Math.min(next.length, targetIdx)), 0, movedItem);
                        return next;
                      });

                      if (sorting.length > 0) {
                        setSorting([]);
                      }

                      setDraggedRowIdx(null);
                      setDropTargetRowIdx(null);
                    }}
                  >
                    {/* Sticky Row # / Drag handle & Row Select cell */}
                    <div
                      onClick={(e) => {
                        handleRowHeaderClick(virtualRow.index, e);
                      }}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/row-index', String(virtualRow.index));
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedRowIdx(virtualRow.index);
                      }}
                      onDragEnd={() => {
                        setDraggedRowIdx(null);
                        setDropTargetRowIdx(null);
                      }}
                      className={`sticky left-0 z-10 w-11 shrink-0 px-1 py-2 flex items-center justify-center border-r border-slate-100 dark:border-emerald-950/50 text-[11px] font-mono select-none cursor-pointer group-hover/row:text-emerald-500 transition-colors ${
                        isRowSelected
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'bg-[#fafcfb] dark:bg-[#0c1411] text-slate-400 dark:text-emerald-700/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 hover:text-emerald-600'
                      }`}
                      title="Click to select row, drag handle to reorder"
                    >
                      <span className="group-hover/row:hidden">{virtualRow.index + 1}</span>
                      <GripVertical size={13} className="hidden group-hover/row:block cursor-grab active:cursor-grabbing" />
                    </div>

                    {row.getVisibleCells().map((cell, colIdx) => {
                      const isSelected = isCellSelected(virtualRow.index, colIdx);
                      const isTopEdge = isSelected && selectionBounds?.minRow === virtualRow.index;
                      const isBottomEdge = isSelected && selectionBounds?.maxRow === virtualRow.index;
                      const isLeftEdge = isSelected && selectionBounds?.minCol === colIdx;
                      const isRightEdge = isSelected && selectionBounds?.maxCol === colIdx;
                      const isEditing = editingCell?.rowIndex === virtualRow.index && editingCell?.columnId === cell.column.id;

                      return (
                        <div
                          key={cell.id}
                          data-cell-row={virtualRow.index}
                          data-cell-col={colIdx}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(virtualRow.index, cell.column.id, cell.getValue());
                          }}
                          onMouseDown={(e) => {
                            if (isEditing) return;
                            if ((e.target as HTMLElement).closest('a, button, input')) return;
                            if (e.shiftKey && selection) {
                              setSelection({
                                anchor: selection.anchor,
                                focus: { row: virtualRow.index, colIdx }
                              });
                            } else {
                              setSelection({
                                anchor: { row: virtualRow.index, colIdx },
                                focus: { row: virtualRow.index, colIdx }
                              });
                            }
                            isSelectingRef.current = true;
                          }}
                          onMouseEnter={() => {
                            if (isSelectingRef.current && !isEditing) {
                              setSelection(prev =>
                                prev ? { ...prev, focus: { row: virtualRow.index, colIdx } } : null
                              );
                            }
                          }}
                          onTouchStart={() => {
                            if (isEditing) return;
                            setSelection({
                              anchor: { row: virtualRow.index, colIdx },
                              focus: { row: virtualRow.index, colIdx }
                            });
                            isSelectingRef.current = true;
                          }}
                          onTouchEnd={() => {
                            isSelectingRef.current = false;
                            // Mobile double-tap detection
                            const now = Date.now();
                            if (
                              lastTapRef.current &&
                              lastTapRef.current.row === virtualRow.index &&
                              lastTapRef.current.colId === cell.column.id &&
                              now - lastTapRef.current.time < 350
                            ) {
                              startEditing(virtualRow.index, cell.column.id, cell.getValue());
                              lastTapRef.current = null;
                            } else {
                              lastTapRef.current = { row: virtualRow.index, colId: cell.column.id, time: now };
                            }
                          }}
                          className={`group/cell relative px-3 py-2 flex items-center shrink-0 overflow-hidden text-slate-700 dark:text-emerald-100 text-xs text-ellipsis select-none transition-colors border-r border-slate-100/90 dark:border-emerald-950/40 ${
                            isSelected
                              ? 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-950 dark:text-emerald-50 font-medium'
                              : 'hover:bg-emerald-50/20 dark:hover:bg-emerald-950/15'
                          } ${isTopEdge ? 'border-t-2 border-t-emerald-500' : ''} ${
                            isBottomEdge ? 'border-b-2 border-b-emerald-500' : ''
                          } ${isLeftEdge ? 'border-l-2 border-l-emerald-500' : ''} ${
                            isRightEdge ? 'border-r-2 border-r-emerald-500' : ''
                          }`}
                          style={{ width: cell.column.getSize() }}
                          title={!isEditing && typeof cell.getValue() === 'string' ? String(cell.getValue()) : undefined}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell((prev) => (prev ? { ...prev, value: e.target.value } : null))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveEdit();
                                } else if (e.key === 'Escape') {
                                  cancelEdit();
                                }
                              }}
                              onBlur={saveEdit}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full h-full -mx-1 px-2 py-1 text-xs font-mono bg-white dark:bg-[#121f19] text-slate-900 dark:text-emerald-50 border-2 border-emerald-500 rounded outline-none shadow-sm z-30"
                            />
                          ) : (
                            <>
                              <div className="flex-1 overflow-hidden truncate">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                              {/* Hover Edit Icon: ONLY accessible/visible on big devices (desktop), completely hidden on small/mobile devices */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(virtualRow.index, cell.column.id, cell.getValue());
                                }}
                                className="hidden sm:group-hover/cell:flex absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 opacity-0 group-hover/cell:opacity-100 transition-all z-10"
                                title="Edit cell (or double click)"
                              >
                                <Pencil size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    <div className="absolute right-0 top-0 h-full hidden group-hover/row:flex items-center px-4 bg-gradient-to-l from-emerald-50 via-emerald-50 to-transparent dark:from-[#091511] dark:via-[#091511] z-10 space-x-2 w-32 justify-end pointer-events-none">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(row.original, null, 2));
                          setCopiedRowId(row.id);
                          setTimeout(() => setCopiedRowId(null), 2000);
                        }}
                        className={`pointer-events-auto p-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold rounded-md border shadow-xs transition-all ${copiedRowId === row.id
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-white bg-white dark:bg-[#121e19] border-slate-200 dark:border-emerald-900/60"
                          }`}
                      >
                        {copiedRowId === row.id ? (
                          <>
                            <Check size={12} strokeWidth={2.5} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}

      {/* Floating Selection & Structured Export Bar (Only in Table Mode) */}
      {viewMode === 'table' && selectionBounds && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-[#091511]/95 dark:bg-[#06100c]/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl shadow-emerald-950/30 border border-emerald-500/30 max-w-[95vw] overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-300 border-r border-emerald-800/60 shrink-0 font-mono">
            <span className="font-bold text-white">{selectionBounds.rowCount}</span>
            <span>×</span>
            <span className="font-bold text-white">{selectionBounds.colCount}</span>
            <span className="hidden md:inline text-emerald-400/80 text-[11px] ml-1">({selectionBounds.cellCount} cells)</span>
          </div>

          {/* Copy Table (+/-) */}
          <button
            onClick={() => copyFormatted('table')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shrink-0 shadow-sm shadow-emerald-600/30"
            title="Copy as ASCII Table surrounded with + and -"
          >
            <Copy size={13} />
            <span>Table (+/-)</span>
          </button>

          {/* Copy CSV */}
          <button
            onClick={() => copyFormatted('csv')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 rounded-lg transition-colors shrink-0 border border-emerald-700/50"
            title="Copy as Comma-Separated Values (CSV)"
          >
            <FileSpreadsheet size={13} />
            <span>CSV</span>
          </button>

          {/* Copy JSON */}
          <button
            onClick={() => copyFormatted('json')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 rounded-lg transition-colors shrink-0 border border-emerald-700/50"
            title="Copy as JSON Array"
          >
            <FileCode size={13} />
            <span>JSON</span>
          </button>

          {/* Copy Excel TSV */}
          <button
            onClick={() => copyFormatted('tsv')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 rounded-lg transition-colors shrink-0 border border-emerald-700/50"
            title="Copy for Excel / Sheets paste"
          >
            <ClipboardCopy size={13} />
            <span>Excel</span>
          </button>

          {/* Clear selection */}
          <button
            onClick={() => setSelection(null)}
            className="p-1 text-emerald-400 hover:text-white rounded-md hover:bg-emerald-900/60 transition-colors shrink-0 ml-0.5"
            title="Deselect (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {copiedFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg shadow-emerald-600/30 border border-emerald-400/40 animate-in fade-in zoom-in-95 duration-150">
          <Check size={14} strokeWidth={3} />
          <span>{copiedFeedback}</span>
        </div>
      )}
    </div>
  );
}
