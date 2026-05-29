import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  Search, ChevronDown, ChevronUp, Hash, Calendar, Mail, FileText, 
  Link as LinkIcon, DollarSign, Smartphone, X, Filter, Check, Copy 
} from 'lucide-react';

interface TableViewProps {
  data: any[];
  title?: string;
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
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
};

const CellRenderer = ({ value, globalFilter }: { value: any; globalFilter: string }) => {
  if (value === null || value === undefined) return <span className="text-slate-400 dark:text-slate-500 italic text-xs">null</span>;
  
  if (typeof value === 'boolean') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
         {value ? 'True' : 'False'}
      </span>
    );
  }
  
  if (typeof value === 'object') {
    return <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">{'{...}'}</span>;
  }
  
  const strVal = String(value);

  if (isHexColor(strVal) || isRgb(strVal)) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded shadow-sm border border-slate-200 dark:border-slate-700 flex-shrink-0" style={{ backgroundColor: strVal }} />
        <span className="font-mono text-xs truncate w-full"><HighlightText text={strVal} highlight={globalFilter} /></span>
      </div>
    );
  }

  if (isUrl(strVal)) {
    const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(strVal);
    if (isImage) {
      return (
        <div className="flex items-center gap-2 group/img relative w-full">
          <img src={strVal} alt="" className="w-6 h-6 object-cover rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0" loading="lazy" />
          <span className="text-xs truncate text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"><HighlightText text={strVal} highlight={globalFilter} /></span>
        </div>
      );
    }
    return (
      <a href={strVal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline text-xs max-w-full" onClick={e => e.stopPropagation()}>
        <LinkIcon size={12} className="flex-shrink-0" />
        <span className="truncate"><HighlightText text={strVal} highlight={globalFilter} /></span>
      </a>
    );
  }

  if (isEmail(strVal)) {
    return (
      <a href={`mailto:${strVal}`} className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline text-xs max-w-full" onClick={e => e.stopPropagation()}>
        <Mail size={12} className="flex-shrink-0" />
        <span className="truncate"><HighlightText text={strVal} highlight={globalFilter} /></span>
      </a>
    );
  }

  return <span className="truncate block w-full"><HighlightText text={strVal} highlight={globalFilter} /></span>;
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
export function TableView({ data, title }: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  // Column specific filters
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

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

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    // Allows resizing
    columnResizeMode: 'onChange',
    globalFilterFn: multiTermGlobalFilter,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();
  const parentRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#0d1117] overflow-hidden relative text-slate-800 dark:text-slate-200">
      
      {/* Search and Summary Bar */}
      <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
              {title || "Data Explorer"}
            </h2>
            <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700" />
            
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                 {data.length.toLocaleString()} Rows
               </span>
               <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                 {totalCols} Columns
               </span>
               {isFiltered && (
                 <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/30">
                   {rows.length.toLocaleString()} Filtered
                 </span>
               )}
            </div>
          </div>
          
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search all data..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-64 md:w-80 shadow-sm transition-all placeholder:text-slate-400"
            />
            {globalFilter && (
                <button 
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <X size={14} />
                </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Data Grid */}
      <div 
         className="flex-1 overflow-auto relative custom-scrollbar bg-white dark:bg-[#0d1117]" 
         ref={parentRef}
      >
        <div 
          style={{ 
            height: `${virtualizer.getTotalSize() + 40}px`, 
            width: table.getTotalSize(), 
            position: 'relative' 
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm">
            {table.getHeaderGroups().map(headerGroup => (
              <React.Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className="group relative flex items-center px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div 
                       className="flex-1 flex items-center justify-between overflow-hidden cursor-pointer"
                       onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 data-[active=true]:opacity-100 text-blue-500 transition-opacity" data-active={header.column.getIsSorted() !== false}>
                        {{
                          asc: <ChevronUp size={14} />,
                          desc: <ChevronDown size={14} />
                        }[header.column.getIsSorted() as string] ?? <ChevronUp size={14} className="opacity-30" />}
                      </span>
                    </div>

                    {/* Resize handle */}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-4 cursor-col-resize flex justify-center opacity-0 group-hover:opacity-100 select-none touch-none ${header.column.getIsResizing() ? 'opacity-100 bg-blue-500/10' : ''}`}
                    >
                      <div className={`w-[2px] h-full ${header.column.getIsResizing() ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="relative w-full">
            {rows.length === 0 ? (
                <div className="absolute top-[40px] left-0 w-full flex flex-col items-center justify-center p-10 text-slate-500 dark:text-slate-400">
                    <Filter size={32} className="opacity-20 mb-3" />
                    <p className="text-sm">No matching rows found</p>
                </div>
            ) : (
              virtualRows.map(virtualRow => {
                const row = rows[virtualRow.index];
                return (
                  <div 
                    key={row.id}
                    className="absolute top-0 left-0 flex w-full border-b border-slate-100 dark:border-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors group/row"
                    style={{
                      transform: `translateY(${virtualRow.start + 36}px)`,
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <div 
                        key={cell.id} 
                        className="px-3 py-2 flex items-center overflow-hidden border-r border-slate-100 dark:border-slate-800/80 last:border-r-0 text-slate-700 dark:text-slate-300 text-xs text-ellipsis"
                        style={{ width: cell.column.getSize() }}
                        title={typeof cell.getValue() === 'string' ? String(cell.getValue()) : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                    <div className="absolute right-0 top-0 h-full hidden group-hover/row:flex items-center px-4 bg-gradient-to-l from-blue-50 via-blue-50 to-transparent dark:from-blue-900/40 dark:via-blue-900/40 z-10 space-x-2 w-32 justify-end">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(row.original, null, 2));
                          setCopiedRowId(row.id);
                          setTimeout(() => setCopiedRowId(null), 2000);
                        }}
                        className={`p-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold rounded border shadow-sm transition-all ${
                          copiedRowId === row.id 
                            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800/50 dark:text-green-400"
                            : "text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
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

    </div>
  );
}
