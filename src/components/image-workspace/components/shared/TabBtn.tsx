import React from "react";

export const TabBtn = ({ tab, active, set, label, icon: Icon }: any) => {
   const isActive = active === tab;
   return (
      <button 
         className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2 ${isActive ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
         onClick={() => set(tab)}
      >
         <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
         <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
      </button>
   );
};

export const BtnSelect = ({ active, set, label, value, icon: Icon }: any) => {
   const isActive = active === value;
   return (
      <button 
         className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all text-xs font-medium ${isActive ? 'bg-[#2A2A2A] border-blue-500/50 text-blue-400 shadow-inner' : 'bg-[#1E1E1E] border-[#333333] text-slate-300 hover:bg-[#252525] hover:border-[#444444]'}`}
         onClick={(e) => { e.stopPropagation(); set(value); }}
      >
         {Icon && <Icon size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />}
         <span>{label}</span>
      </button>
   );
};
