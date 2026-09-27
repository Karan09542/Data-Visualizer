import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download } from 'lucide-react';
import { EXPORT_FORMATS } from '../constants';
import type { ExportFormat } from '../types';
import { cx } from '../ui/primitives';

/** Export button with a format picker; choosing a format downloads immediately. */
export const ExportMenu: React.FC<{
  format: ExportFormat;
  onExport: (format: ExportFormat) => void;
}> = ({ format, onExport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Download image"
        className={cx(
          'inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors',
          'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
          'dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08] dark:border-white/[0.08]',
          open && 'bg-slate-50 dark:bg-white/[0.08]',
        )}
      >
        <Download size={15} />
        <span className="hidden sm:inline">Export</span>
        <span className="hidden sm:inline text-[10px] font-mono font-semibold uppercase px-1 rounded bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-zinc-400">
          {format}
        </span>
        <ChevronDown size={13} className={cx('text-slate-400 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            'absolute right-0 top-full mt-1.5 w-64 rounded-xl border p-1 z-50 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100',
            'bg-white border-slate-200 shadow-slate-900/10',
            'dark:bg-[#1A1A1D] dark:border-white/[0.08] dark:shadow-black/50',
          )}
        >
          <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
            Download as
          </div>
          {EXPORT_FORMATS.map((item) => {
            const active = format === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onExport(item.id); }}
                className={cx(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors',
                  'hover:bg-slate-100 dark:hover:bg-white/[0.06]',
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className={cx('block text-xs font-semibold', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-zinc-200')}>
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">{item.desc}</span>
                </span>
                {active
                  ? <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  : <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600 shrink-0">{item.ext}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
