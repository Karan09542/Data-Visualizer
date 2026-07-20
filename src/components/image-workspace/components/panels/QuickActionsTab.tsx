import React, { useState } from 'react';
import {
   Activity, Sparkles, Eye, Palette, Settings2, ImageIcon, FileText, Instagram, ShoppingBag, ArrowRight
} from 'lucide-react';
import { PRESET_REGISTRY } from '../../../../lib/imagePresets';

interface QuickActionsTabProps {
   selectionType: string | null;
   addFilterToPipeline: (type: string) => void;
   applyFilter: (type: string, val: any) => void;
   resetCrop: () => void;
   alignSelection: (target: string) => void;
   applyFrame: (type: string) => void;
   frameBorderWidth: number;
   updateFrameBorderWidth: (w: number) => void;
   createArtboardFromPreset: (id: string) => void;
}

import { useSelection } from '../../contexts/SelectionContext';

export const QuickActionsTab: React.FC<QuickActionsTabProps> = ({
   selectionType,
   addFilterToPipeline,
   applyFilter,
   resetCrop,
   alignSelection,
   applyFrame,
   frameBorderWidth,
   updateFrameBorderWidth,
   createArtboardFromPreset
}) => {
   const [formatCategory, setFormatCategory] = useState<'all' | 'document' | 'social' | 'ecommerce'>('all');
   const [isAutoEnhance, setIsAutoEnhance] = useState(false);
   const [isAutoSharpen, setIsAutoSharpen] = useState(false);
   const [isAutoColorCorrect, setIsAutoColorCorrect] = useState(false);
   
   const { activeObj } = useSelection();

   React.useEffect(() => {
      setIsAutoEnhance(false);
      setIsAutoSharpen(false);
      setIsAutoColorCorrect(false);
   }, [activeObj]);

   const isCollageBlockWithImage = activeObj && (activeObj as any).isCollageBlock && !!(activeObj as any).collageImageSrc;

   if (selectionType !== 'image' && selectionType !== 'frameGroup' && !isCollageBlockWithImage) {
      return (
         <div className="flex flex-col items-center justify-center py-20 text-center opacity-60 font-sans">
            <Activity size={32} className="mb-4 text-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-white">Quick Actions</span>
            <span className="text-[11px] mt-2 w-48 text-[#8A8A8A]">Select an Image layer or a filled Smart Collage Cell to access one-click utilities and fixes.</span>
         </div>
      );
   }

   const filteredPresets = PRESET_REGISTRY.filter(p => {
      if (formatCategory === 'all') {
         return p.category === 'document' || p.category === 'social' || p.category === 'ecommerce';
      }
      return p.category === formatCategory;
   });

   return (
      <div className="p-4 space-y-6 text-[#C0C0C0] font-sans">
         {/* One-Click Quick Fixes */}
         <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
               <Sparkles size={11} className="text-yellow-400" /> Quick Fixes
            </div>
            <div className="grid grid-cols-1 gap-2">
               <button
                  onClick={() => {
                     if (isAutoEnhance) {
                        applyFilter('brightness', 0);
                        applyFilter('contrast', 0);
                        setIsAutoEnhance(false);
                     } else {
                        applyFilter('brightness', 0.1);
                        applyFilter('contrast', 0.15);
                        setIsAutoEnhance(true);
                     }
                  }}
                  className={`p-2 border rounded-xl text-left text-[11px] font-medium transition duration-150 group flex items-center gap-3 active:scale-[0.98] ${isAutoEnhance ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'border-[#2D2D2D] hover:border-emerald-500/50 hover:bg-emerald-950/20 bg-[#1A1A1A]'}`}
               >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isAutoEnhance ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20'}`}>
                     <Sparkles size={13} />
                  </div>
                  <div>
                     <div className={`font-semibold transition-colors ${isAutoEnhance ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'}`}>Auto Enhance</div>
                     <div className="text-[9px] text-[#8A8A8A] mt-0.5">Smart contrast, brightness, and vibrance</div>
                  </div>
               </button>

               <button
                  onClick={() => {
                     if (isAutoSharpen) {
                        applyFilter('sharpen', 0);
                        setIsAutoSharpen(false);
                     } else {
                        applyFilter('sharpen', 0.3);
                        setIsAutoSharpen(true);
                     }
                  }}
                  className={`p-2 border rounded-xl text-left text-[11px] font-medium transition duration-150 group flex items-center gap-3 active:scale-[0.98] ${isAutoSharpen ? 'border-blue-500 bg-blue-950/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'border-[#2D2D2D] hover:border-blue-500/50 hover:bg-blue-950/20 bg-[#1A1A1A]'}`}
               >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isAutoSharpen ? 'bg-blue-500/30 text-blue-300 border-blue-500/50' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20'}`}>
                     <Eye size={13} />
                  </div>
                  <div>
                     <div className={`font-semibold transition-colors ${isAutoSharpen ? 'text-blue-400' : 'text-white group-hover:text-blue-400'}`}>Auto Sharpen</div>
                     <div className="text-[9px] text-[#8A8A8A] mt-0.5">Enhance edge detail and clarity</div>
                  </div>
               </button>

               <button
                  onClick={() => {
                     if (isAutoColorCorrect) {
                        applyFilter('saturation', 0);
                        setIsAutoColorCorrect(false);
                     } else {
                        applyFilter('saturation', 0.2);
                        setIsAutoColorCorrect(true);
                     }
                  }}
                  className={`p-2 border rounded-xl text-left text-[11px] font-medium transition duration-150 group flex items-center gap-3 active:scale-[0.98] ${isAutoColorCorrect ? 'border-violet-500 bg-violet-950/40 shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'border-[#2D2D2D] hover:border-violet-500/50 hover:bg-violet-950/20 bg-[#1A1A1A]'}`}
               >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isAutoColorCorrect ? 'bg-violet-500/30 text-violet-300 border-violet-500/50' : 'bg-violet-500/10 text-violet-400 border-violet-500/20 group-hover:bg-violet-500/20'}`}>
                     <Palette size={13} />
                  </div>
                  <div>
                     <div className={`font-semibold transition-colors ${isAutoColorCorrect ? 'text-violet-400' : 'text-white group-hover:text-violet-400'}`}>Auto Color Correct</div>
                     <div className="text-[9px] text-[#8A8A8A] mt-0.5">Boost missing saturation and colors</div>
                  </div>
               </button>
            </div>
         </div>

         {/* Transform Utilities */}
         <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
               <Settings2 size={11} className="text-slate-400" /> Transform Utilities
            </div>
            <div className="grid grid-cols-2 gap-2">
               {[
                  { label: 'Fit to Artboard', target: 'fit' },
                  { label: 'Fill Artboard', target: 'fill' },
                  { label: 'Center', target: 'center' },
                  { label: 'Reset Crop', target: 'reset' }
               ].map(u => (
                  <button
                     key={u.label}
                     onClick={() => {
                        if (u.target === 'reset') resetCrop();
                        else if (u.target === 'center') {
                           alignSelection('centerH');
                           alignSelection('centerV');
                        } else {
                           alignSelection(u.target as any);
                        }
                     }}
                     className="py-1.5 px-2 border border-[#2D2D2D] hover:border-slate-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] rounded-lg text-center text-[10px] font-semibold transition duration-150 active:scale-95"
                  >
                     {u.label}
                  </button>
               ))}
            </div>
         </div>

         {/* Digital Frames */}
         <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] flex items-center gap-1.5 font-sans">
               <ImageIcon size={11} className="text-orange-400" /> Digital Frames
            </div>
            <div className="grid grid-cols-2 gap-2">
               {[
                  { label: 'Polaroid', target: 'polaroid' },
                  { label: 'Classic White', target: 'white' },
                  { label: 'Gallery Black', target: 'black' },
                  { label: 'Metallic Gold', target: 'metallic' },
                  { label: 'Vintage Brown', target: 'vintage' }
               ].map(u => {
                  const isActive = selectionType === 'frameGroup' && activeObj && (activeObj as any).get('frameType') === u.target;
                  return (
                     <button
                        key={u.label}
                        onClick={() => applyFrame(u.target)}
                        className={`py-1.5 px-2 border ${isActive ? 'border-orange-500 bg-orange-500/10 text-white' : 'border-[#2D2D2D] hover:border-orange-500/50 hover:text-white bg-[#1A1A1A] hover:bg-[#252525]'} rounded-lg text-center text-[10px] font-semibold transition duration-150 active:scale-95`}
                     >
                        {u.label}
                     </button>
                  );
               })}
            </div>
         </div>

         {selectionType === 'frameGroup' && (
            <div className="space-y-2 mt-3 p-3 bg-[#161616] rounded-xl border border-[#2C2C2C]">
               <div className="flex justify-between items-center text-[10px] text-[#A0A0A0] font-semibold">
                  <span>Border Width</span>
                  <span className="bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#3A3A3A] text-[10px] text-white font-mono">{frameBorderWidth}px</span>
               </div>
               <input
                  type="range" min="1" max="150" step="1" value={frameBorderWidth}
                  onChange={(e) => updateFrameBorderWidth(Number(e.target.value))}
                  className="w-full accent-orange-500 h-1 cursor-pointer bg-[#2E2E2E] rounded-lg appearance-none"
               />
            </div>
         )}

         {/* Document Prep */}
         <div className="space-y-3">
            <div className="text-[10px] uppercase font-black tracking-wider text-[#A0A0A0] flex items-center gap-1.5 font-sans">
               <FileText size={11} className="text-red-400" /> Formatting Utilities
            </div>

            <div className="text-[9px] text-[#6E6E6E] leading-relaxed">
               Instantly crop and fit open imagery strictly into standardized viewport proportions.
            </div>
            <div className='p-4 bg-[#141414] border border-[#282828] rounded-2xl shadow-inner'>

               {/* Premium Category Filters */}
               <div className="flex bg-[#1E1E1E] p-0.5 rounded-lg border border-[#2D2D2D] text-[9px] font-semibold mb-3">
                  {[
                     { id: 'all', label: 'All' },
                     { id: 'document', label: 'Docs' },
                     { id: 'social', label: 'Social' },
                     { id: 'ecommerce', label: 'Shop' }
                  ].map(tab => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFormatCategory(tab.id as any)}
                        className={`flex-1 py-1 rounded-md text-center transition-all ${formatCategory === tab.id ? 'bg-[#2E2E2E] text-white shadow-sm' : 'text-[#8A8A8A] hover:text-[#C0C0C0]'}`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>

               {/* List with rich aesthetics & thin scrollbar */}
               <div className="h-[280px] overflow-y-auto pr-1.5 space-y-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#3A3A3A] [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:#3A3A3A_transparent]">
                  {filteredPresets.map((preset) => {
                     let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                     let icon = <FileText size={12} />;

                     if (preset.category === 'social') {
                        badgeColor = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
                        icon = <Instagram size={12} />;
                     } else if (preset.category === 'ecommerce') {
                        badgeColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                        icon = <ShoppingBag size={12} />;
                     }

                     return (
                        <button
                           key={preset.id}
                           onClick={() => createArtboardFromPreset(preset.id)}
                           className="w-full flex items-center justify-between p-2.5 bg-[#1C1C1C] hover:bg-[#222] border border-[#2D2D2D] hover:border-blue-500/30 rounded-xl text-left transition-all duration-200 group active:scale-[0.99] relative overflow-hidden"
                        >
                           {/* Hover glow effect */}
                           <div className="absolute inset-y-0 left-0 w-[2px] bg-transparent group-hover:bg-blue-500 transition-colors" />

                           <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${badgeColor} border flex items-center justify-center shrink-0`}>
                                 {icon}
                              </div>
                              <div>
                                 <div className="text-[10px] font-bold text-white group-hover:text-blue-400 transition-colors">
                                    Convert to {preset.name}
                                 </div>
                                 <div className="text-[9px] text-[#6A6A6A] mt-0.5 capitalize">
                                    {preset.category === 'social' ? 'Social Preset' : preset.category === 'ecommerce' ? 'E-Commerce Preset' : 'Document Format'}
                                 </div>
                              </div>
                           </div>

                           {/* Specs badge */}
                           <div className="flex items-center gap-1.5">
                              <div className="text-[9px] text-right font-mono bg-[#161616] px-2 py-0.5 rounded border border-[#282828] text-slate-300">
                                 {preset.width}×{preset.height} <span className="text-[8px] opacity-60 uppercase">{preset.unit}</span>
                              </div>
                              <ArrowRight size={10} className="text-[#444] group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>

         </div>
      </div>
   );
};
