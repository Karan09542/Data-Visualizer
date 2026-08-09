import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: any;
  onChange: (val: any) => void;
  options: { value: any; label: string }[];
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, disabled }) => {
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

  const selectedOption = options.find(o => o.value == value) || options[0];

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#2D2D2D] hover:border-slate-300 dark:hover:border-[#444] rounded-lg text-[12px] p-2.5 text-slate-800 dark:text-white outline-none transition-all focus:ring-1 focus:ring-blue-500/50"
      >
        <span className="truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333] rounded-lg shadow-xl shadow-black/10 dark:shadow-black/40 py-1 max-h-48 overflow-y-auto overflow-x-hidden transform origin-top animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt) => (
            <div
              key={opt.value.toString()}
              className={`px-3 py-2 text-[12px] cursor-pointer transition-colors ${
                opt.value == value 
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2A2A2A] hover:text-slate-900 dark:hover:text-white'
              }`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
