import React, { useEffect, useState } from 'react';
import * as fabric from 'fabric';
import { Scan, RotateCcw, Info } from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { useSelection } from '../../contexts/SelectionContext';
import { PanelSection, RangeSlider } from '../shared/PanelPrimitives';
import {
   buildEdgeRefineCommand, getEdgeRefine, edgeRefineBlockedByBorder
} from '../../services/image/edgeRefine';
import { EdgeRefineOptions, EDGE_REFINE_NONE, isEdgeRefineNoOp } from '../../../../utils/edgeRefine';

/** Starting points for the three things people actually reach for after a cut-out. */
const RECIPES: { id: string; label: string; hint: string; values: EdgeRefineOptions }[] = [
   {
      id: 'cleanup', label: 'Clean Up', hint: 'Round off jagged edges and kill the colour halo',
      values: { smooth: 2, feather: 0.6, contrast: 40, shift: -1, defringe: 2 }
   },
   {
      id: 'soft', label: 'Soft', hint: 'A gentle blended edge for compositing',
      values: { smooth: 1, feather: 4, contrast: 0, shift: 0, defringe: 2 }
   },
   {
      id: 'crisp', label: 'Crisp', hint: 'Tighten to a hard, clean cut',
      values: { smooth: 2, feather: 0, contrast: 90, shift: -1, defringe: 3 }
   }
];

/**
 * Photoshop-style edge refinement for a cut-out layer.
 *
 * Every change re-renders the whole layer, so the sliders commit on release rather than on each
 * step - a 3 megapixel layer takes a couple of hundred milliseconds per pass, which is fine once
 * per gesture and unusable per pixel of slider travel.
 */
export const EdgeRefinePanel: React.FC = () => {
   const { fabricRef } = useCanvas();
   const { executeCommand } = useHistory();
   const { activeObj } = useSelection();

   const image = activeObj && (activeObj as any).type === 'image' ? (activeObj as fabric.Image) : null;
   const existing = image ? getEdgeRefine(image) : null;
   const blocked = image ? edgeRefineBlockedByBorder(image) : false;

   const [options, setOptions] = useState<EdgeRefineOptions>(existing || EDGE_REFINE_NONE);

   useEffect(() => {
      setOptions(image ? (getEdgeRefine(image) || EDGE_REFINE_NONE) : EDGE_REFINE_NONE);
   }, [image]);

   if (!image) return null;

   const commit = (next: EdgeRefineOptions | null) => {
      const canvas = fabricRef.current;
      if (!canvas || blocked) return;
      const cmd = buildEdgeRefineCommand(image, next);
      if (!cmd) return;
      executeCommand(cmd as any);
   };

   const update = (patch: Partial<EdgeRefineOptions>, apply = true) => {
      const next = { ...options, ...patch };
      setOptions(next);
      if (apply) commit(next);
   };

   const slider = (
      label: string, key: keyof EdgeRefineOptions,
      min: number, max: number, step: number, unit = 'px'
   ) => (
      <RangeSlider
         label={label}
         valueDisplay={options[key]}
         displayUnit={unit}
         min={min}
         max={max}
         step={step}
         value={options[key]}
         onChange={(e) => update({ [key]: Number(e.target.value) } as Partial<EdgeRefineOptions>, false)}
         onPointerUp={() => commit(options)}
         onKeyUp={() => commit(options)}
      />
   );

   return (
      <PanelSection
         icon={<Scan size={14} className="text-purple-500 dark:text-purple-400" />}
         title={
            <div className="flex items-center justify-between w-full gap-2">
               <span>Refine Edges</span>
               {existing && !isEdgeRefineNoOp(existing) && (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                     Refined
                  </span>
               )}
            </div>
         }
      >
         {blocked ? (
            <div className="flex items-start gap-2 p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
               <Info size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
               <span className="flex-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Remove the border first. Refining reshapes the artwork's own edge, so it has to
                  happen before a border is drawn around that edge.
               </span>
            </div>
         ) : (
            <>
               <div className="grid grid-cols-3 gap-1.5">
                  {RECIPES.map(r => (
                     <button
                        key={r.id}
                        type="button"
                        title={r.hint}
                        onClick={() => { setOptions(r.values); commit(r.values); }}
                        className="h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-purple-400 dark:hover:border-purple-500/60 transition-all active:scale-[0.97] touch-manipulation"
                     >
                        {r.label}
                     </button>
                  ))}
               </div>

               {slider('Smooth', 'smooth', 0, 12, 1)}
               {slider('Feather', 'feather', 0, 20, 0.5)}
               {slider('Contrast', 'contrast', 0, 100, 1, '%')}
               {slider('Shift Edge', 'shift', -12, 12, 1)}
               {slider('Defringe', 'defringe', 0, 8, 1)}

               {existing && !isEdgeRefineNoOp(existing) && (
                  <button
                     type="button"
                     onClick={() => { setOptions(EDGE_REFINE_NONE); commit(null); }}
                     title="Put the original edge back"
                     className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] touch-manipulation"
                  >
                     <RotateCcw size={13} /> Reset Edges
                  </button>
               )}

               <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-relaxed">
                  Best after removing a background. <b>Defringe</b> pulls the subject's own colour
                  over the halo left by the old background; <b>Shift Edge</b> nudges the cut in or
                  out by a pixel or two.
               </p>
            </>
         )}
      </PanelSection>
   );
};
