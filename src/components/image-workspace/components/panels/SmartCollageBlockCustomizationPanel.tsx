import React from 'react';
import * as fabric from 'fabric';
import { Layout, LucideImage, AlignLeft, ChevronUp, AlignJustify, ChevronDown, AlignRight } from 'lucide-react';
import { useCanvas } from '../../contexts/CanvasContext';
import { useCollageConfig } from '../../hooks/useCollageConfig';
import { ColorPickerTrigger } from '../shared/ColorPickers';
import { ModernCheckbox } from '../shared/ModernCheckbox';
import { FilterSlider } from '../shared/FilterSlider';
import { FlipHorizontal, FlipVertical } from 'lucide-react';

export const SmartCollageBlockCustomizationPanel: React.FC = () => {
   const {
      fabricRef, updateCollageBlockStyleProperty, fillCollageBlockWithImage, addAlignedCollageText
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
      (activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))
   );
   if (!isCollageSelected) return null;

   const hasImage = !!(activeObj as any)?.collageImageSrc;
   const currentFit = (activeObj as any)?.collageImageFit || 'cover';
   const currentZoom = (activeObj as any)?.collageImageZoom || 1;
   const currentPanX = (activeObj as any)?.collageImagePanX || 0;
   const currentPanY = (activeObj as any)?.collageImagePanY || 0;
   const currentRot = (activeObj as any)?.collageImageRotation || 0;
   const currentOpacity = (activeObj as any)?.collageImageOpacity !== undefined ? (activeObj as any).collageImageOpacity : 1;
   const currentFlipX = (activeObj as any)?.collageImageFlipX || false;
   const currentFlipY = (activeObj as any)?.collageImageFlipY || false;

   return (
      <div className="space-y-4 pt-4 border-t border-[#2C2C2C] pb-4 animate-fade-in">
         <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Layout size={12} /> Smart Collage Cell Options</div>
            <span className="text-[9px] text-[#A0A0A0] bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">CELL EDIT</span>
         </div>

         {/* Action Grid */}
         <div className="grid grid-cols-2 gap-2 bg-[#141414] border border-[#222] p-2.5 rounded-lg">
            {/* Background color */}
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">Cell Fill</span>
               <div className="flex gap-2">
                  <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner relative" style={{ backgroundColor: collageBgColor }}>
                     <ColorPickerTrigger
                        color={collageBgColor}
                        onChange={(color) => {
                           setCollageBgColor(color);
                           updateCollageBlockStyleProperty('fill', color);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     />
                  </div>
               </div>
            </div>

            {/* Border color */}
            <div className="space-y-1">
               <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block font-bold">Border Color</span>
               <div className="flex gap-2">
                  <div className="w-8 h-8 rounded shrink-0 border border-[#2a2a2a] shadow-inner relative" style={{ backgroundColor: collageBorderStyle === 'none' ? 'transparent' : collageBorderColor }}>
                     <ColorPickerTrigger
                        color={collageBorderColor}
                        onChange={(color) => {
                           setCollageBorderColor(color);
                           updateCollageBlockStyleProperty('stroke', color);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     />
                  </div>
               </div>
            </div>
         </div>

         {/* Border Style, Thickness & Corner Radius */}
         <div className="space-y-3 bg-[#141414] border border-[#222] p-3 rounded-lg">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Border & Radius Controls</span>

            {/* Style selection button row */}
            <div>
               <span className="text-[9px] text-[#808080] block mb-1">Border Style</span>
               <div className="grid grid-cols-3 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                  {['none', 'solid', 'dashed'].map((st) => (
                     <button
                        key={st}
                        type="button"
                        onClick={() => {
                           setCollageBorderStyle(st as any);
                           updateCollageBlockStyleProperty('borderStyle', st);
                        }}
                        className={`py-1 text-[9px] font-bold rounded capitalize transition-all ${collageBorderStyle === st ? 'bg-blue-600 text-white shadow-sm' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                     >
                        {st}
                     </button>
                  ))}
               </div>
            </div>

            {/* Stroke width & corner radius range controls */}
            <div className="space-y-3 pt-1">
               <div>
                  <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                     <span>Border Thickness</span>
                     <span className="font-mono text-blue-400 text-[10px] font-bold">{collageBorderWidth}px</span>
                  </div>
                  <input
                     type="range" min="0" max="50" step="1"
                     value={collageBorderWidth}
                     onChange={(e) => {
                        const val = Number(e.target.value);
                        setCollageBorderWidth(val);
                        updateCollageBlockStyleProperty('strokeWidth', val);
                     }}
                     className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
               </div>

               {/* Custom Toggle for Separate Corner Rounding */}
               <div className="pt-1 pb-1 border-t border-[#1C1C1C]">
                  <ModernCheckbox
                     checked={useIndividualCorners}
                     onChange={(val) => updateCollageBlockStyleProperty('useIndividualCorners', val)}
                     label="Round Corners Separately"
                     labelLeft
                  />
               </div>

               {useIndividualCorners ? (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-1 border-t border-[#1C1C1C]">
                     {/* Top Left */}
                     <div>
                        <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                           <span>Top Left</span>
                           <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerTL}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1"
                           value={collageCornerTL}
                           onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCollageBlockStyleProperty('rx_tl', val);
                           }}
                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                     {/* Top Right */}
                     <div>
                        <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                           <span>Top Right</span>
                           <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerTR}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1"
                           value={collageCornerTR}
                           onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCollageBlockStyleProperty('rx_tr', val);
                           }}
                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                     {/* Bottom Left */}
                     <div>
                        <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                           <span>Bottom Left</span>
                           <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerBL}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1"
                           value={collageCornerBL}
                           onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCollageBlockStyleProperty('rx_bl', val);
                           }}
                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                     {/* Bottom Right */}
                     <div>
                        <div className="flex justify-between items-center text-[8px] text-[#8A8A8A] mb-0.5">
                           <span>Bottom Right</span>
                           <span className="font-mono text-blue-400 text-[8px] font-bold">{collageCornerBR}%</span>
                        </div>
                        <input
                           type="range" min="0" max="100" step="1"
                           value={collageCornerBR}
                           onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCollageBlockStyleProperty('rx_br', val);
                           }}
                           className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                  </div>
               ) : (
                  <div>
                     <div className="flex justify-between items-center text-[9px] text-[#8A8A8A] mb-1">
                        <span>Cell Corner Rounding (%)</span>
                        <span className="font-mono text-blue-400 text-[10px] font-bold">{collageCornerRadius}%</span>
                     </div>
                     <input
                        type="range" min="0" max="100" step="1"
                        value={collageCornerRadius}
                        onChange={(e) => {
                           const val = Number(e.target.value);
                           updateCollageBlockStyleProperty('rx', val);
                        }}
                        className="w-full h-1 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer accent-blue-500"
                     />
                  </div>
               )}
            </div>
         </div>

         {/* Image filling interactive controls */}
         <div className="space-y-2 bg-[#141414] border border-[#222] p-3 rounded-lg">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Fill Cell with Image</span>
            <div className="pt-1">
               <label className="relative flex flex-col items-center justify-center border border-dashed border-[#3A3A3A] hover:border-blue-500 rounded-lg p-4 text-center cursor-pointer transition bg-[#0C0C0C] hover:bg-blue-950/10 group">
                  <LucideImage size={24} className="text-[#8A8A8A] group-hover:text-blue-400 mb-1.5 transition-colors" />
                  <span className="text-[10px] font-bold text-white group-hover:text-blue-300">{hasImage ? 'Replace Image' : 'Upload Photograph'}</span>
                  <span className="text-[9px] text-[#6A6A6A] mt-0.5">Crop and object-fit perfectly</span>
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
            </div>

            {hasImage && (
               <div className="pt-3 space-y-3 border-t border-[#222]">
                  <div>
                     <span className="text-[9px] text-[#808080] block mb-1">Image Fit Mode</span>
                     <div className="grid grid-cols-4 gap-0.5 bg-[#090909] rounded p-0.5 border border-[#222]">
                        {['cover', 'contain', 'stretch', 'original'].map((mode) => (
                           <button
                              key={mode} type="button"
                              onClick={() => updateCollageBlockStyleProperty('collageImageFit', mode)}
                              className={`py-1 text-[8px] font-bold rounded capitalize transition-all ${currentFit === mode ? 'bg-blue-600 text-white' : 'text-[#8A8A8A] hover:text-white hover:bg-[#1C1C1C]'}`}
                           >
                              {mode}
                           </button>
                        ))}
                     </div>
                  </div>
                  
                  <div className="space-y-1">
                     <FilterSlider label="Zoom" min={0.1} max={3} step={0.1} value={currentZoom} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageZoom', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <FilterSlider label="Pan X" min={-500} max={500} step={10} value={currentPanX} onChange={(v: any) => updateCollageBlockStyleProperty('collageImagePanX', v)} />
                     <FilterSlider label="Pan Y" min={-500} max={500} step={10} value={currentPanY} onChange={(v: any) => updateCollageBlockStyleProperty('collageImagePanY', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <FilterSlider label="Rotation" min={-180} max={180} step={5} value={currentRot} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageRotation', v)} />
                     <FilterSlider label="Opacity" min={0} max={1} step={0.1} value={currentOpacity} onChange={(v: any) => updateCollageBlockStyleProperty('collageImageOpacity', v)} />
                  </div>

                  <div className="pt-2 border-t border-[#222]">
                     <span className="text-[10px] text-[#A0A0A0] font-semibold block mb-2">Flip Image</span>
                     <div className="flex gap-2">
                        <button 
                           type="button"
                           onClick={() => updateCollageBlockStyleProperty('collageImageFlipX', !currentFlipX)} 
                           className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded text-[9px] font-bold transition-all border ${currentFlipX ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-[#181818] text-[#8A8A8A] border-[#3A3A3A] hover:bg-[#222] hover:text-white'}`}
                        >
                           <FlipHorizontal size={13} /> FLIP X
                        </button>
                        <button 
                           type="button"
                           onClick={() => updateCollageBlockStyleProperty('collageImageFlipY', !currentFlipY)} 
                           className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded text-[9px] font-bold transition-all border ${currentFlipY ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-[#181818] text-[#8A8A8A] border-[#3A3A3A] hover:bg-[#222] hover:text-white'}`}
                        >
                           <FlipVertical size={13} /> FLIP Y
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* Text alignment helpers relative block to cell */}
         <div className="space-y-2 bg-[#141414] border border-[#222] p-3 rounded-lg">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#909090] block pb-1 border-b border-[#222]">Add Text Overlay (Relative Align)</span>
            <div className="grid grid-cols-5 gap-1 pt-1">
               {[
                  { label: 'Left', id: 'left' as const, icon: <AlignLeft size={13} /> },
                  { label: 'Top', id: 'top' as const, icon: <ChevronUp size={13} /> },
                  { label: 'Center', id: 'center' as const, icon: <AlignJustify size={13} /> },
                  { label: 'Bot', id: 'bottom' as const, icon: <ChevronDown size={13} /> },
                  { label: 'Right', id: 'right' as const, icon: <AlignRight size={13} /> },
               ].map((btn) => (
                  <button
                     key={btn.id}
                     type="button"
                     onClick={() => addAlignedCollageText(btn.id)}
                     className="h-11 bg-[#1F1F1F] hover:bg-blue-600 border border-[#2C2C2C] hover:border-blue-500 rounded flex flex-col items-center justify-center text-[#8A8A8A] hover:text-white transition-all gap-1 shadow-sm"
                     title={`Add Text Aligned to ${btn.label}`}
                  >
                     {btn.icon}
                     <span className="text-[8px] font-bold font-sans tracking-tight">{btn.label}</span>
                  </button>
               ))}
            </div>
         </div>
      </div>
   );
};
