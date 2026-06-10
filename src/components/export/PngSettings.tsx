
import React from 'react';
import { Sliders, Palette, Check } from 'lucide-react';
import { PngOptions } from '../../types/export';

interface Props {
  options: PngOptions;
  onChange: (options: Partial<PngOptions>) => void;
  mode: 'basic' | 'advanced' | 'expert';
}

export const PngSettings: React.FC<Props> = ({ options, onChange, mode }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
          <Sliders size={14} className="text-orange-400" />
        </div>
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">PNG Engine (OxiPNG)</span>
      </div>

      {/* Compression Level - Always visible for context */}
      <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Optimization Effort</label>
            <span className="text-[9px] text-slate-600 font-medium">Parallel WASM passes</span>
          </div>
          <span className="text-xs font-mono font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">Level {options.level}</span>
        </div>
        <input
          type="range"
          min="0"
          max={mode === 'basic' ? 3 : 6}
          value={options.level}
          onChange={(e) => onChange({ level: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-orange-600 border border-[#222]"
        />
        <div className="flex justify-between text-[8px] text-slate-700 font-black tracking-tighter">
          <span>INSTANT</span>
          <span>MAXIMUM</span>
        </div>
      </div>

      {mode !== 'basic' && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-300">
           <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-3 rounded-xl border border-[#222] hover:border-orange-500/20 transition-all select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={options.interlace}
                onChange={(e) => onChange({ interlace: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                options.interlace 
                ? 'bg-orange-600 border-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.3)]' 
                : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
              }`}>
                {options.interlace && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-300 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight">Interlacing (Adam7)</span>
              <span className="text-[9px] text-slate-600">Progressive loading for web</span>
            </div>
          </label>
        </div>
      )}

      {/* Palette Reduction Section */}
      <div className={`mt-2 pt-4 border-t border-[#222] space-y-4 ${mode === 'basic' ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-pink-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efficiency Layer</span>
        </div>

        <label className="flex items-center gap-3 cursor-pointer group select-none">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              checked={options.paletteReduction}
              onChange={(e) => onChange({ paletteReduction: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              options.paletteReduction 
              ? 'bg-pink-600 border-pink-500 shadow-[0_0_8px_rgba(219,39,119,0.3)]' 
              : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
            }`}>
              {options.paletteReduction && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors font-black uppercase tracking-tight">8-Bit Indexed Transfer</span>
            <span className="text-[9px] text-slate-600">Massive savings, slight fidelity loss</span>
          </div>
        </label>

        {options.paletteReduction && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-slate-400">Colors</label>
                <span className="text-[11px] font-mono font-bold text-pink-400">{options.paletteColors}</span>
              </div>
              <select
                value={options.paletteColors}
                onChange={(e) => onChange({ paletteColors: parseInt(e.target.value) })}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-pink-500"
              >
                <option value={256}>256 Colors</option>
                <option value={128}>128 Colors</option>
                <option value={64}>64 Colors</option>
                <option value={32}>32 Colors</option>
                <option value={16}>16 Colors</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-slate-400">Dithering Strength</label>
                <span className="text-[11px] font-mono text-slate-500">{(options.ditherLevel * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={options.ditherLevel}
                onChange={(e) => onChange({ ditherLevel: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
