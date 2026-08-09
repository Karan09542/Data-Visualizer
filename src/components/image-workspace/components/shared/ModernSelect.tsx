import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
   value: string;
   label: string;
}

export interface SelectGroup {
   label: string;
   options: SelectOption[];
}

interface ModernSelectProps {
   value: string;
   onChange: (value: string) => void;
   groups: SelectGroup[];
}

export const ModernSelect: React.FC<ModernSelectProps> = ({ value, onChange, groups }) => {
   const [isOpen, setIsOpen] = useState(false);
   const containerRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const getSelectedLabel = () => {
      for (const group of groups) {
         const option = group.options.find(o => o.value === value);
         if (option) return option.label;
      }
      return value;
   };

   return (
      <div className="relative w-full" ref={containerRef}>
         <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full h-9 flex items-center justify-between bg-slate-100 dark:bg-[#111] border ${
               isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            } rounded-lg text-[11px] px-3 outline-none text-slate-900 dark:text-white transition-all shadow-sm`}
         >
            <span className="font-semibold">{getSelectedLabel()}</span>
            <ChevronDown size={14} className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
         </button>

         {isOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[300px]">
               <div className="overflow-y-auto overflow-x-hidden custom-scrollbar py-1">
                  {groups.map((group, groupIdx) => (
                     <div key={group.label} className={groupIdx > 0 ? 'mt-1 pt-1 border-t border-slate-100 dark:border-white/5' : ''}>
                        <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                           {group.label}
                        </div>
                        {group.options.map(option => {
                           const isActive = option.value === value;
                           return (
                              <button
                                 key={option.value}
                                 type="button"
                                 onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                 }}
                                 className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors ${
                                    isActive 
                                       ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold' 
                                       : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                 }`}
                              >
                                 <span>{option.label}</span>
                                 {isActive && <Check size={12} className="text-blue-600 dark:text-blue-400" />}
                              </button>
                           );
                        })}
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
};
