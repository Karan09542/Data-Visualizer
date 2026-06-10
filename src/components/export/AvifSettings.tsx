
import React from 'react';
import { Sliders } from 'lucide-react';
import { AvifOptions } from '../../types/export';

interface Props {
  options: AvifOptions;
  onChange: (options: Partial<AvifOptions>) => void;
  mode: 'basic' | 'advanced' | 'expert';
}

export const AvifSettings: React.FC<Props> = ({ options, onChange, mode }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
          <Sliders size={14} className="text-purple-400" />
        </div>
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">AVIF Next-Gen Engine</span>
      </div>

      {/* Quality - Map CQ level to 0-100% to look consistent */}
      <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Quality</label>
            <span className="text-[9px] text-slate-600 font-medium">Mapped CQ {options.cqLevel}</span>
          </div>
          <span className="text-xs font-mono font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
            {Math.round(((63 - options.cqLevel) / 63) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="63"
          step="1"
          value={options.cqLevel}
          onChange={(e) => onChange({ cqLevel: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-purple-600 border border-[#222]"
          style={{ direction: 'rtl' }} // Reverse direction so 0(best) is on the right
        />
        <div className="flex justify-between text-[8px] text-slate-700 font-black tracking-tighter">
          <span>MIN SIZE</span>
          <span>BEST QUALITY</span>
        </div>
      </div>

      {(mode === 'advanced' || mode === 'expert') && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encoder Speed</label>
              <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.speed}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={options.speed}
              onChange={(e) => onChange({ speed: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-purple-600 border border-[#222]"
            />
          </div>
        </div>
      )}

      {mode === 'expert' && (
        <div className="space-y-4 pt-2 border-t border-[#222] animate-in fade-in duration-500">
          <div className="space-y-4">
             <div className="space-y-2 bg-[#111] p-3 rounded-xl border border-[#222]">
               <div className="flex justify-between items-center mb-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chroma Subsampling</label>
               </div>
               <select
                 value={options.subsample}
                 onChange={(e) => onChange({ subsample: parseInt(e.target.value) })}
                 className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-2 text-xs text-slate-300 outline-none focus:border-purple-500/50 appearance-none cursor-pointer font-bold"
               >
                 <option value={1}>4:2:0 (Web Standard)</option>
                 <option value={2}>4:2:2 (High Accuracy)</option>
                 <option value={3}>4:4:4 (Professional Master)</option>
               </select>
             </div>

            <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Film Grain / Denoise</label>
                <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.denoiseLevel}</span>
              </div>
              <input
                type="range"
                min="0"
                max="63"
                value={options.denoiseLevel}
                onChange={(e) => onChange({ denoiseLevel: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-purple-600 border border-[#222]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5 bg-[#111] p-2.5 rounded-xl border border-[#222]">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tile Rows</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={options.tileRowsLog2}
                  onChange={(e) => onChange({ tileRowsLog2: parseInt(e.target.value) })}
                  className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 font-mono outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="space-y-1.5 bg-[#111] p-2.5 rounded-xl border border-[#222]">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tile Cols</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={options.tileColsLog2}
                  onChange={(e) => onChange({ tileColsLog2: parseInt(e.target.value) })}
                  className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 font-mono outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Internal Sharpness</label>
                <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.sharpness}</span>
              </div>
              <input
                type="range"
                min="0"
                max="7"
                value={options.sharpness}
                onChange={(e) => onChange({ sharpness: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-purple-600 border border-[#222]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
