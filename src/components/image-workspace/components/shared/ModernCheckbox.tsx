import React from "react";

export const ModernCheckbox = ({ checked, onChange, label, labelLeft, className }: any) => (
  <label className={`flex items-center gap-2.5 cursor-pointer group select-none active:scale-95 transition-transform ${labelLeft ? 'justify-between w-full p-2 bg-slate-50 dark:bg-[#1C1C1C] rounded-lg border border-slate-200 dark:border-[#2D2D2D]/60 hover:bg-slate-100 dark:hover:bg-[#222222] hover:border-slate-300 dark:hover:border-[#3D3D3D]' : ''} ${className || ''}`} onClick={(e) => e.stopPropagation()}>
    {label && labelLeft && <span className="text-[11px] text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors font-semibold tracking-tight">{label}</span>}
    <div className="relative flex items-center justify-center">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
        className="peer appearance-none w-4 h-4 rounded-[4px] border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#121212] checked:border-blue-500 checked:bg-blue-500 hover:border-slate-400 dark:hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
      <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    {label && !labelLeft && <span className="text-[11px] text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors font-semibold tracking-tight">{label}</span>}
  </label>
);
