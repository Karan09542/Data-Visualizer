import React from "react";

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
