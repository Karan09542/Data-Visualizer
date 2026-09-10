import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CopyPlus, Minus, Plus } from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { PanelSection } from '../shared/PanelPrimitives';

type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Step-and-repeat duplication.
 *
 * The keyboard route is Shift+Alt+Arrow; this is the same action for touch, where there is no
 * keyboard at all. Each press places a copy beside the selection - its own size plus the gap away -
 * and selects the copy, so pressing again builds a row or column.
 */
export const DuplicatePanel: React.FC = () => {
   const { duplicateInDirection, duplicateActiveObject, duplicateGap = 20, setDuplicateGap } = useCanvas();
   if (!duplicateInDirection) return null;

   const pad = (dir: Direction, icon: React.ReactNode, label: string) => (
      <button
         type="button"
         onClick={() => duplicateInDirection(dir)}
         title={`Duplicate ${label}`}
         aria-label={`Duplicate ${label}`}
         className="h-10 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center transition-all active:scale-[0.96] touch-manipulation"
      >
         {icon}
      </button>
   );

   const setGap = (n: number) => setDuplicateGap?.(Math.max(0, Math.min(500, Math.round(n))));

   return (
      <PanelSection title="Duplicate" icon={<CopyPlus size={14} className="text-emerald-500 dark:text-emerald-400" />}>
         <div className="grid grid-cols-3 gap-1.5">
            <span />
            {pad('up', <ArrowUp size={16} />, 'above')}
            <span />
            {pad('left', <ArrowLeft size={16} />, 'to the left')}
            <button
               type="button"
               onClick={() => duplicateActiveObject()}
               title="Duplicate in place (Ctrl+D)"
               aria-label="Duplicate in place"
               className="h-10 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 flex items-center justify-center transition-all active:scale-[0.96] touch-manipulation"
            >
               <CopyPlus size={16} />
            </button>
            {pad('right', <ArrowRight size={16} />, 'to the right')}
            <span />
            {pad('down', <ArrowDown size={16} />, 'below')}
            <span />
         </div>

         <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">Gap</span>
            <div className="flex items-center h-7 rounded-md border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 overflow-hidden">
               <button
                  type="button"
                  onClick={() => setGap(duplicateGap - 5)}
                  title="Smaller gap"
                  className="w-7 h-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
               >
                  <Minus size={11} />
               </button>
               <input
                  type="number"
                  min={0}
                  value={duplicateGap}
                  onChange={(e) => setGap(Number(e.target.value) || 0)}
                  aria-label="Gap between copies in pixels"
                  className="w-10 h-full bg-transparent text-center text-[11px] font-mono font-semibold text-slate-800 dark:text-white outline-none"
               />
               <span className="pr-1 text-[9px] font-mono text-slate-400 dark:text-zinc-500">px</span>
               <button
                  type="button"
                  onClick={() => setGap(duplicateGap + 5)}
                  title="Larger gap"
                  className="w-7 h-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
               >
                  <Plus size={11} />
               </button>
            </div>
         </div>

         <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-relaxed">
            Each press places a copy beside the selection and selects it, so repeating builds a row.
            On a keyboard: <kbd className="px-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono">Shift</kbd>
            +<kbd className="px-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono">Alt</kbd>
            +<kbd className="px-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono">Arrow</kbd>
         </p>
      </PanelSection>
   );
};
