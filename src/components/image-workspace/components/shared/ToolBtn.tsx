import React from "react";

export const ToolBtn = ({ icon: Icon, tool, current, set, title }: any) => {
   const active = current === tool;
   return (
      <button 
         className={`p-1.5 rounded transition-colors ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2A2A2A] hover:text-slate-900 dark:hover:text-white'}`}
         onClick={() => set(tool)}
         title={title}
      >
         {Icon && <Icon size={18} strokeWidth={active ? 2.5 : 2} />}
      </button>
   );
};
