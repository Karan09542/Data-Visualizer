import React from 'react';
import { Check } from 'lucide-react';
import { JxlOptions } from '../../types/export';

interface JxlSettingsProps {
  options: JxlOptions;
  onChange: (options: JxlOptions) => void;
  mode?: 'panel' | 'dialog' | 'basic' | 'advanced' | 'expert';
}

export const JxlSettings: React.FC<JxlSettingsProps> = ({
  options,
  onChange,
  mode = 'panel'
}) => {
  return (
    <div className={`space-y-4 animate-in fade-in duration-300 ${mode === 'panel' ? 'p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50' : ''}`}>
      <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Encoding Effort</span>
          <span className="text-[10px] font-mono font-black text-slate-500 bg-white dark:bg-slate-800 px-1.5 rounded">{options.effort}</span>
        </div>
        <input
          type="range"
          min="1"
          max="9"
          value={options.effort}
          onChange={(e) => onChange({ ...options, effort: parseInt(e.target.value) })}
          className="w-full h-1 bg-white dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 border border-slate-200 dark:border-slate-700/50"
        />
        <div className="flex justify-between text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">
          <span>Fastest</span>
          <span>Smallest Size</span>
        </div>
      </div>

      <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Quality</span>
          <span className="text-[10px] font-mono font-black text-slate-500 bg-white dark:bg-slate-800 px-1.5 rounded">{options.quality}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={options.quality}
          onChange={(e) => onChange({ ...options, quality: parseInt(e.target.value) })}
          disabled={options.lossless}
          className={`w-full h-1 rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-slate-700/50 ${
            options.lossless ? 'bg-white dark:bg-slate-800 accent-slate-600 opacity-40' : 'bg-white dark:bg-slate-800 accent-blue-600'
          }`}
        />
        <div className="flex justify-between text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">
          <span>Smaller File</span>
          <span>Higher Quality</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-3 cursor-pointer group bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 select-none">
          <div className="relative flex items-center justify-center shrink-0">
            <input
              type="checkbox"
              checked={options.lossless}
              onChange={(e) => onChange({ ...options, lossless: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              options.lossless 
              ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:hover:border-slate-500'
            }`}>
              {options.lossless && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
            </div>
          </div>
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tight group-hover:text-slate-800 dark:text-slate-200 transition-colors">
            Lossless
          </span>
        </label>
        
        <label className="flex items-center gap-3 cursor-pointer group bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 select-none">
          <div className="relative flex items-center justify-center shrink-0">
            <input
              type="checkbox"
              checked={options.progressive}
              onChange={(e) => onChange({ ...options, progressive: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              options.progressive 
              ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:hover:border-slate-500'
            }`}>
              {options.progressive && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
            </div>
          </div>
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tight group-hover:text-slate-800 dark:text-slate-200 transition-colors">
            Progressive
          </span>
        </label>
      </div>
    </div>
  );
};
