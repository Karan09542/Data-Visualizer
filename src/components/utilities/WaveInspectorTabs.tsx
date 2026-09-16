import React from 'react';
import { Sparkles, Waves, Video, Image as ImageIcon, PenTool, Type } from 'lucide-react';

export type InspectorTabType = 'effects' | 'controls' | 'export' | 'current' | 'mask' | 'text';

/**
 * Ordered the way a clip is actually made: start from the photo, choose the look, set how it
 * moves, limit it to an area, add words, then save it out. Export sits last, after a divider.
 */
const INSPECTOR_TABS = [
   { id: 'current', label: 'Image', hint: 'Adjust the selected photo: size, rotation, colours', icon: ImageIcon, activeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm' },
   { id: 'effects', label: 'Effects', hint: 'Wave shape, direction and colour look', icon: Sparkles, activeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' },
   { id: 'controls', label: 'Motion', hint: 'Wave speed, strength and how photos change over', icon: Waves, activeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm' },
   { id: 'mask', label: 'Mask', hint: 'Paint where the effect should apply', icon: PenTool, activeClass: 'bg-green-500/20 text-green-300 border border-green-500/40 shadow-sm' },
   { id: 'text', label: 'Text', hint: 'Add words on top of the animation', icon: Type, activeClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm' },
   { id: 'export', label: 'Export', hint: 'Save the animation as a video', icon: Video, activeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm', startsGroup: true },
] as const;

interface WaveInspectorTabsProps {
   activeTab: InspectorTabType;
   onTabChange: (tab: InspectorTabType) => void;
}

export function WaveInspectorTabs({ activeTab, onTabChange }: WaveInspectorTabsProps) {
   return (
      <div
         role="tablist"
         aria-label="Studio panels"
         className="w-full p-2 bg-[#131824] border-b border-white/10 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none"
      >
         {INSPECTOR_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
               <React.Fragment key={tab.id}>
                  {'startsGroup' in tab && tab.startsGroup && (
                     <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/10" />
                  )}
                  <button
                     role="tab"
                     aria-selected={isActive}
                     title={tab.hint}
                     onClick={() => onTabChange(tab.id as InspectorTabType)}
                     className={`shrink-0 py-2 px-3 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${isActive
                        ? tab.activeClass
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                        }`}
                  >
                     <tab.icon size={13} className="shrink-0" />
                     <span>{tab.label}</span>
                  </button>
               </React.Fragment>
            );
         })}
      </div>
   );
}
