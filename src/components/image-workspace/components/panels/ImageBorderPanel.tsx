import React, { useEffect, useMemo, useState } from 'react';
import * as fabric from 'fabric';
import { Square, Sticker, Eraser, Info } from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { useSelection } from '../../contexts/SelectionContext';
import { PanelSection, Label, RangeSlider, ColorField } from '../shared/PanelPrimitives';
import {
   buildImageBorderCommand, getImageBorder, getBorderBase, ImageBorderOptions
} from '../../services/image/imageBorder';
import { hasTransparency, BorderMode } from '../../../../utils/imageBorder';

const DEFAULTS: ImageBorderOptions = { mode: 'rectangle', color: '#ffffff', width: 12, radius: 0 };

const MODES: { id: BorderMode; label: string; icon: React.ReactNode; hint: string }[] = [
   { id: 'rectangle', label: 'Frame', icon: <Square size={16} />, hint: 'A border around the whole picture' },
   { id: 'contour', label: 'Sticker', icon: <Sticker size={16} />, hint: "Follows the artwork's own cut-out edge" }
];

/**
 * Borders for an image layer.
 *
 * The border is baked into the layer's pixels, so it exports, crops and selects as part of the
 * picture. Re-rendering always starts from the pristine copy the service keeps, which is why
 * dragging the width does not pile border on border.
 */
export const ImageBorderPanel: React.FC = () => {
   const { fabricRef } = useCanvas();
   const { executeCommand } = useHistory();
   const { activeObj } = useSelection();

   const image = activeObj && (activeObj as any).type === 'image' ? (activeObj as fabric.Image) : null;
   const existing = image ? getImageBorder(image) : null;

   const [options, setOptions] = useState<ImageBorderOptions>(existing || DEFAULTS);

   // Follow the selection: each layer carries its own border settings.
   useEffect(() => {
      setOptions(image ? (getImageBorder(image) || DEFAULTS) : DEFAULTS);
   }, [image]);

   /**
    * Whether a sticker outline has an edge to follow. A fully opaque photo has none, so the two
    * modes would look identical - worth saying before the user assumes the tool is broken.
    */
   const cutOut = useMemo(() => {
      if (!image) return null;
      try {
         const base = getBorderBase(image);
         if (!base) return null;
         const ctx = base.getContext('2d');
         if (!ctx) return null;
         return hasTransparency(ctx.getImageData(0, 0, base.width, base.height));
      } catch {
         // A cross-origin image cannot be inspected; say nothing rather than guess.
         return null;
      }
   }, [image]);

   if (!image) return null;

   const commit = (next: ImageBorderOptions | null) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const cmd = buildImageBorderCommand(image, next);
      if (!cmd) return;
      executeCommand(cmd as any);
   };

   const update = (patch: Partial<ImageBorderOptions>, apply = true) => {
      const next = { ...options, ...patch };
      setOptions(next);
      if (apply) commit(next);
   };

   return (
      <PanelSection
         icon={<Sticker size={14} className="text-teal-500 dark:text-teal-400" />}
         title={
            <div className="flex items-center justify-between w-full gap-2">
               <span>Border</span>
               {existing && (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
                     {existing.mode === 'contour' ? 'Sticker' : 'Frame'}
                  </span>
               )}
            </div>
         }
      >
         <div className="grid grid-cols-2 gap-1.5">
            {MODES.map(m => {
               const active = options.mode === m.id;
               return (
                  <button
                     key={m.id}
                     type="button"
                     title={m.hint}
                     aria-pressed={active}
                     onClick={() => update({ mode: m.id })}
                     className={`h-14 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all active:scale-[0.97] touch-manipulation ${active
                        ? 'bg-teal-600 border-teal-500 text-white shadow-md shadow-teal-500/20'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-teal-400 dark:hover:border-teal-500/60'}`}
                  >
                     {m.icon}
                     {m.label}
                  </button>
               );
            })}
         </div>

         {options.mode === 'contour' && cutOut === false && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
               <Info size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
               <span className="flex-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  This layer has no transparent areas, so a sticker outline will trace its rectangle.
                  Cut the background out first — the AI tools do it in one press.
               </span>
            </div>
         )}

         {/* Applied on release: each change re-renders the layer's bitmap, which is far too much
             work to repeat on every pixel of slider travel. */}
         <RangeSlider
            label="Thickness"
            valueDisplay={options.width}
            displayUnit="px"
            min={0}
            max={80}
            step={1}
            value={options.width}
            onChange={(e) => update({ width: Number(e.target.value) }, false)}
            onPointerUp={() => commit(options)}
            onKeyUp={() => commit(options)}
         />

         <ColorField
            label="Border Colour"
            color={options.color}
            onChange={(c) => update({ color: c })}
         />

         {options.mode === 'rectangle' && (
            <RangeSlider
               label="Corner Radius"
               valueDisplay={options.radius || 0}
               displayUnit="px"
               min={0}
               max={120}
               step={1}
               value={options.radius || 0}
               onChange={(e) => update({ radius: Number(e.target.value) }, false)}
               onPointerUp={() => commit(options)}
               onKeyUp={() => commit(options)}
            />
         )}

         {existing && (
            <button
               type="button"
               onClick={() => { setOptions({ ...options, width: DEFAULTS.width }); commit(null); }}
               title="Put the layer back exactly as it was before the border"
               className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] touch-manipulation"
            >
               <Eraser size={13} /> Remove Border
            </button>
         )}

         <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-relaxed">
            The border becomes part of the layer, so it exports and crops with the picture. Removing
            it restores the original pixels.
         </p>
      </PanelSection>
   );
};
