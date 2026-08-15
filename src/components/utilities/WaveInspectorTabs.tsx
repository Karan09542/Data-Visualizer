import React from 'react';
import { Sparkles, SlidersHorizontal, Video, Image as ImageIcon, PenTool, Type } from 'lucide-react';

export type InspectorTabType = 'effects' | 'controls' | 'export' | 'current' | 'mask' | 'text';

const INSPECTOR_TABS = [
   { id: 'effects', label: 'Effects', icon: Sparkles, activeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' },
   { id: 'mask', label: 'Mask', icon: PenTool, activeClass: 'bg-green-500/20 text-green-300 border border-green-500/40 shadow-sm' },
   { id: 'text', label: 'Text', icon: Type, activeClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm' },
   { id: 'controls', label: 'Sliders', icon: SlidersHorizontal, activeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' },
   { id: 'current', label: 'Image', icon: ImageIcon, activeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm' },
   { id: 'export', label: 'Export', icon: Video, activeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' },
] as const;

interface WaveInspectorTabsProps {
   activeTab: InspectorTabType;
   onTabChange: (tab: InspectorTabType) => void;
}

export function WaveInspectorTabs({ activeTab, onTabChange }: WaveInspectorTabsProps) {
   return (
      <div className="w-full p-2 bg-[#131824] border-b border-white/10 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
         {INSPECTOR_TABS.map((tab) => (
            <button
               key={tab.id}
               onClick={() => onTabChange(tab.id as InspectorTabType)}
               className={`shrink-0 py-2 px-3 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === tab.id
                     ? tab.activeClass
                     : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
            >
               <tab.icon size={13} className="shrink-0" />
               <span>{tab.label}</span>
            </button>
         ))}
      </div>
   );
}
