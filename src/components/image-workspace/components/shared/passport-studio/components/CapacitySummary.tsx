import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { SheetLayout } from '../types';
import { cx } from '../ui/primitives';

/** Pinned at the top of the sidebar: how many photos print and how full the sheet is. */
export const CapacitySummary: React.FC<{ layout: SheetLayout }> = ({ layout }) => {
  const fits = layout.maxCapacity > 0;
  const fill = fits ? Math.min(100, (layout.activePhotoCount / layout.maxCapacity) * 100) : 0;

  return (
    <div className="px-4 py-3.5 border-b border-slate-200 dark:border-white/[0.06]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-zinc-100">
              {layout.activePhotoCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              of {layout.maxCapacity} {layout.activePhotoCount === 1 ? 'photo' : 'photos'} on sheet
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] font-mono leading-tight text-slate-500 dark:text-zinc-400">
          <div>{layout.cols} × {layout.rows} grid</div>
          <div>{layout.phWidth}×{layout.phHeight} mm</div>
        </div>
      </div>

      <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-white/[0.06]">
        <div
          className={cx('h-full rounded-full transition-all duration-300', fits ? 'bg-blue-600 dark:bg-blue-500' : 'bg-rose-500')}
          style={{ width: `${fits ? fill : 100}%` }}
        />
      </div>

      {!fits && (
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-rose-600 dark:text-rose-400">
          <AlertCircle size={13} className="shrink-0" />
          <span>Dimensions or margins exceed available paper space.</span>
        </div>
      )}
    </div>
  );
};
