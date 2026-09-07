import React from 'react';
import * as fabric from 'fabric';
import {
   Layout, LucideImage, AlignLeft, ChevronUp, AlignJustify, ChevronDown, AlignRight,
   Maximize, FlipHorizontal, FlipVertical, RotateCcw, Trash2, Type
} from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useCollageConfig } from '../../hooks/useCollageConfig';
import { ModernCheckbox } from '../shared/ModernCheckbox';
import { FilterSlider } from '../shared/FilterSlider';
import { PanelSection, Label, RangeSlider, GridButton, ColorField, BorderStylePicker } from '../shared/PanelPrimitives';
import { isActiveSelection } from '../../../../utils/fabric-utils';

const CORNERS = [
   { key: 'rx_tl', label: 'Top Left' },
   { key: 'rx_tr', label: 'Top Right' },
   { key: 'rx_bl', label: 'Bottom Left' },
   { key: 'rx_br', label: 'Bottom Right' },
] as const;

const TEXT_POSITIONS = [
   { id: 'left' as const, label: 'Left', icon: <AlignLeft size={13} /> },
   { id: 'top' as const, label: 'Top', icon: <ChevronUp size={13} /> },
   { id: 'center' as const, label: 'Center', icon: <AlignJustify size={13} /> },
   { id: 'bottom' as const, label: 'Bottom', icon: <ChevronDown size={13} /> },
   { id: 'right' as const, label: 'Right', icon: <AlignRight size={13} /> },
];

export const SmartCollageBlockCustomizationPanel: React.FC = () => {
   const {
      fabricRef, updateCollageBlockStyleProperty, fillCollageBlockWithImage, addAlignedCollageText,
      fitCollageToArtboard
   } = useCanvas();

   const activeObj = fabricRef.current?.getActiveObject();

   const {
      collageBgColor, setCollageBgColor, collageBorderColor, setCollageBorderColor,
      collageBorderWidth, setCollageBorderWidth, collageCornerRadius, setCollageCornerRadius,
      collageBorderStyle, setCollageBorderStyle,
      useIndividualCorners, collageCornerTL, collageCornerTR, collageCornerBL, collageCornerBR
   } = useCollageConfig();

   const isCollageSelected = activeObj && (
      (activeObj as any).isCollageBlock ||
      (isActiveSelection(activeObj) && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))
   );
   if (!isCollageSelected) return null;

   const selectedBlocks: fabric.Object[] = isActiveSelection(activeObj)
      ? (activeObj as fabric.ActiveSelection).getObjects().filter(o => (o as any).isCollageBlock)
      : [activeObj];

   const cornerValues: Record<string, number> = {
      rx_tl: collageCornerTL, rx_tr: collageCornerTR,
      rx_bl: collageCornerBL, rx_br: collageCornerBR,
   };

   const hasImage = !!(activeObj as any)?.collageImageSrc;
   const currentFit = (activeObj as any)?.collageImageFit || 'cover';
   const currentZoom = (activeObj as any)?.collageImageZoom || 1;
   const currentPanX = (activeObj as any)?.collageImagePanX || 0;
   const currentPanY = (activeObj as any)?.collageImagePanY || 0;
   const currentRot = (activeObj as any)?.collageImageRotation || 0;
   const currentOpacity = (activeObj as any)?.collageImageOpacity !== undefined ? (activeObj as any).collageImageOpacity : 1;
   const currentFlipX = (activeObj as any)?.collageImageFlipX || false;
   const currentFlipY = (activeObj as any)?.collageImageFlipY || false;

   const handleResetImageTransforms = () => {
      updateCollageBlockStyleProperty('collageImageFit', 'cover');
      updateCollageBlockStyleProperty('collageImageZoom', 1);
      updateCollageBlockStyleProperty('collageImagePanX', 0);
      updateCollageBlockStyleProperty('collageImagePanY', 0);
      updateCollageBlockStyleProperty('collageImageRotation', 0);
      updateCollageBlockStyleProperty('collageImageOpacity', 1);
      updateCollageBlockStyleProperty('collageImageFlipX', false);
      updateCollageBlockStyleProperty('collageImageFlipY', false);
   };

   return (
      <div className="space-y-4 animate-fade-in">
         <PanelSection
            title={
               <div className="flex items-center justify-between w-full gap-2">
                  <span>Collage Cell</span>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                     {selectedBlocks.length > 1 ? `${selectedBlocks.length} cells` : '1 cell'}
                  </span>
               </div>
            }
            icon={<Layout size={14} className="text-blue-500 dark:text-blue-400" />}
         >
            {selectedBlocks.length > 1 && (
               <div className="space-y-1.5">
                  <button
                     type="button"
                     onClick={fitCollageToArtboard}
                     className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 border border-blue-400/20 shadow-sm active:scale-[0.98] transition-all"
                  >
                     <Maximize size={13} strokeWidth={2.5} />
                     Fit Collage to Artboard
                  </button>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-snug">
                     Scales the grid proportionally and centres it inside the outer padding. Applies to
                     every cell on this artboard, not only the selected ones.
                  </p>
               </div>
            )}

            <div className="grid grid-cols-2 gap-3">
               <ColorField
                  label="Cell Fill"
                  color={collageBgColor}
                  onChange={(c) => { setCollageBgColor(c); updateCollageBlockStyleProperty('fill', c); }}
               />
               <ColorField
                  label="Border Color"
                  color={collageBorderColor}
                  muted={collageBorderStyle === 'none'}
                  onChange={(c) => { setCollageBorderColor(c); updateCollageBlockStyleProperty('stroke', c); }}
               />
            </div>
         </PanelSection>

         <PanelSection title="Border & Corners" icon={<Layout size={14} className="text-slate-500 dark:text-zinc-400" />}>
            <div>
               <Label>Border Style</Label>
               <BorderStylePicker
                  value={collageBorderStyle}
                  onChange={(st) => { setCollageBorderStyle(st); updateCollageBlockStyleProperty('borderStyle', st); }}
               />
            </div>

            <RangeSlider
               label="Border Thickness" min="0" max="50" step="1"
               value={collageBorderWidth} valueDisplay={collageBorderWidth} displayUnit="px"
               onChange={(e) => {
                  const v = Number(e.target.value);
                  setCollageBorderWidth(v);
                  updateCollageBlockStyleProperty('strokeWidth', v);
               }}
            />

            <div className="pt-3 border-t border-slate-200 dark:border-white/5 space-y-4">
               <ModernCheckbox
                  checked={useIndividualCorners}
                  onChange={(val) => updateCollageBlockStyleProperty('useIndividualCorners', val)}
                  label="Round Corners Separately"
                  labelLeft
               />

               {useIndividualCorners ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                     {CORNERS.map(c => (
                        <RangeSlider
                           key={c.key}
                           label={c.label} min="0" max="100" step="1"
                           value={cornerValues[c.key]} valueDisplay={cornerValues[c.key]} displayUnit="%"
                           onChange={(e) => updateCollageBlockStyleProperty(c.key, Number(e.target.value))}
                        />
                     ))}
                  </div>
               ) : (
                  <RangeSlider
                     label="Corner Rounding" min="0" max="100" step="1"
                     value={collageCornerRadius} valueDisplay={collageCornerRadius} displayUnit="%"
                     onChange={(e) => {
                        const v = Number(e.target.value);
                        setCollageCornerRadius(v);
                        updateCollageBlockStyleProperty('rx', v);
                     }}
                  />
               )}
            </div>
         </PanelSection>

         <PanelSection title="Cell Image" icon={<LucideImage size={14} className="text-slate-500 dark:text-zinc-400" />}>
            <div className="flex gap-2">
               <label className="flex-1 relative flex items-center justify-center gap-2 h-10 border border-dashed border-slate-300 dark:border-[#3A3A3A] hover:border-blue-500 rounded-lg text-center cursor-pointer transition-colors bg-slate-50 dark:bg-[#0C0C0C] hover:bg-blue-50 dark:hover:bg-blue-950/10 group">
                  <LucideImage size={15} className="text-slate-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                     {hasImage ? 'Replace Image' : 'Upload Image'}
                  </span>
                  <input
                     type="file"
                     accept="image/*"
                     className="hidden"
                     onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) fillCollageBlockWithImage(file);
                     }}
                  />
               </label>
               {hasImage && (
                  <button
                     type="button"
                     onClick={() => updateCollageBlockStyleProperty('collageImageSrc', undefined)}
                     title="Remove image"
                     className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-colors"
                  >
                     <Trash2 size={14} />
                  </button>
               )}
            </div>

            {!hasImage && (
               <p className="text-[9px] text-slate-400 dark:text-zinc-500 -mt-1">
                  The image is cropped to the cell and object-fitted automatically.
               </p>
            )}

            {hasImage && (
               <>
                  <div>
                     <Label>Fit Mode</Label>
                     <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg p-1">
                        {['cover', 'contain', 'stretch', 'original'].map((mode) => (
                           <GridButton
                              key={mode}
                              active={currentFit === mode}
                              onClick={() => updateCollageBlockStyleProperty('collageImageFit', mode)}
                              className="capitalize"
                           >
                              {mode}
                           </GridButton>
                        ))}
                     </div>
                  </div>

                  <FilterSlider label="Zoom" min={0.1} max={3} step={0.1} value={currentZoom} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageZoom', v)} />

                  <div className="grid grid-cols-2 gap-3">
                     <FilterSlider label="Pan X" min={-500} max={500} step={10} value={currentPanX} onChange={(v: any) => updateCollageBlockStyleProperty('collageImagePanX', v)} />
                     <FilterSlider label="Pan Y" min={-500} max={500} step={10} value={currentPanY} onChange={(v: any) => updateCollageBlockStyleProperty('collageImagePanY', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <FilterSlider label="Rotation" min={-180} max={180} step={5} value={currentRot} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageRotation', v)} />
                     <FilterSlider label="Opacity" min={0} max={1} step={0.1} value={currentOpacity} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageOpacity', v)} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-white/5">
                     <GridButton
                        active={currentFlipX}
                        onClick={() => updateCollageBlockStyleProperty('collageImageFlipX', !currentFlipX)}
                        className="flex items-center justify-center gap-1.5 h-9"
                     >
                        <FlipHorizontal size={13} /> Flip X
                     </GridButton>
                     <GridButton
                        active={currentFlipY}
                        onClick={() => updateCollageBlockStyleProperty('collageImageFlipY', !currentFlipY)}
                        className="flex items-center justify-center gap-1.5 h-9"
                     >
                        <FlipVertical size={13} /> Flip Y
                     </GridButton>
                     <GridButton
                        onClick={handleResetImageTransforms}
                        className="flex items-center justify-center gap-1.5 h-9"
                        title="Reset zoom, pan, rotation, opacity and flips"
                     >
                        <RotateCcw size={13} /> Reset
                     </GridButton>
                  </div>
               </>
            )}
         </PanelSection>

         <PanelSection title="Text Overlay" icon={<Type size={14} className="text-slate-500 dark:text-zinc-400" />}>
            <div>
               <Label>Add Heading Aligned To</Label>
               <div className="grid grid-cols-5 gap-1.5">
                  {TEXT_POSITIONS.map((btn) => (
                     <GridButton
                        key={btn.id}
                        onClick={() => addAlignedCollageText(btn.id)}
                        className="flex flex-col items-center justify-center gap-1 h-12"
                        title={`Add text aligned to the ${btn.label.toLowerCase()} of the cell`}
                     >
                        {btn.icon}
                        <span className="text-[9px]">{btn.label}</span>
                     </GridButton>
                  ))}
               </div>
            </div>
         </PanelSection>
      </div>
   );
};
