import React from "react";

export const ContextMenuItem = ({ icon: Icon, label, onClick, danger, shortcut, disabled }: any) => (
   <button 
     className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${danger && !disabled ? 'text-red-400 hover:bg-red-500/10' : !disabled ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-300'}`}
     onClick={(e) => { e.stopPropagation(); if(!disabled) onClick(); }}
     disabled={disabled}
   >
      <div className="flex items-start gap-2 text-left">
         {Icon && <Icon size={14} className="shrink-0 mt-[1px]" />}
         <span className="leading-tight pt-[1px]">{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-600 font-mono tracking-tighter shrink-0 ml-4 pt-[2px]">{shortcut}</span>}
   </button>
);
