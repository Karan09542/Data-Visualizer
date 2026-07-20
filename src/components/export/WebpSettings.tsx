
import React from 'react';
import { Sliders, Zap, Check } from 'lucide-react';
import { WebpOptions } from '../../types/export';

interface Props {
  options: WebpOptions;
  onChange: (options: Partial<WebpOptions>) => void;
  mode: 'basic' | 'advanced' | 'expert';
}

export const WebpSettings: React.FC<Props> = ({ options, onChange, mode }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Sliders size={14} className="text-emerald-400" />
        </div>
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">WebP V1 Engine</span>
      </div>

      {/* Quality - Always visible */}
      <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visual Logic</label>
            <span className="text-[9px] text-slate-600 font-medium">Brotli-style quantization</span>
          </div>
          <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{options.quality}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={options.quality}
          onChange={(e) => onChange({ quality: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600 border border-[#222]"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-3 rounded-xl border border-[#222] hover:border-emerald-500/20 transition-all select-none">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            checked={options.lossless === 1}
            onChange={(e) => onChange({ lossless: e.target.checked ? 1 : 0 })}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
            options.lossless === 1 
            ? 'bg-emerald-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
            : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
          }`}>
            {options.lossless === 1 && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight">Pure Lossless</span>
          <span className="text-[9px] text-slate-600">Disable Huffman/Entropy loss</span>
        </div>
      </label>

      {(mode === 'advanced' || mode === 'expert') && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compression Effort</label>
              <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.method}</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              value={options.method}
              onChange={(e) => onChange({ method: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600 border border-[#222]"
            />
          </div>

          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alpha Quality</label>
              <span className="text-[10px] font-mono font-black text-emerald-400">{options.alpha_quality}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={options.alpha_quality}
              onChange={(e) => onChange({ alpha_quality: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600 border border-[#222]"
            />
          </div>
        </div>
      )}

      {mode === 'expert' && (
        <div className="space-y-4 pt-2 border-t border-[#222] animate-in fade-in duration-500">
          <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1.5 bg-[#111] p-2.5 rounded-xl border border-[#222]">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Segments</label>
              <input
                type="number"
                min="1"
                max="4"
                value={options.segments}
                onChange={(e) => onChange({ segments: parseInt(e.target.value) })}
                className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 font-mono outline-none focus:border-emerald-500/50"
              />
            </div>
             <div className="space-y-1.5 bg-[#111] p-2.5 rounded-xl border border-[#222]">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Passes</label>
              <input
                type="number"
                min="1"
                max="10"
                value={options.pass}
                onChange={(e) => onChange({ pass: parseInt(e.target.value) })}
                className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-1.5 text-[11px] text-slate-200 font-mono outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SNS Strength</label>
              <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.sns_strength}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={options.sns_strength}
              onChange={(e) => onChange({ sns_strength: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600 border border-[#222]"
            />
          </div>

          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtering Strength</label>
              <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.filter_strength}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={options.filter_strength}
              onChange={(e) => onChange({ filter_strength: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600 border border-[#222]"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.use_sharp_yuv === 1}
                  onChange={(e) => onChange({ use_sharp_yuv: e.target.checked ? 1 : 0 })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.use_sharp_yuv === 1 
                  ? 'bg-emerald-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.use_sharp_yuv === 1 && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Sharp YUV Rendering</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.near_lossless < 100}
                  onChange={(e) => onChange({ near_lossless: e.target.checked ? 60 : 100 })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.near_lossless < 100 
                  ? 'bg-emerald-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.near_lossless < 100 && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Near Lossless Toggle</span>
            </label>
          </div>

          {options.near_lossless < 100 && (
             <div className="space-y-3 p-3 bg-[#0A0A0A] rounded-xl border border-[#222]">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Near Lossless Factor</label>
                <span className="text-[10px] font-mono font-black text-emerald-400">{options.near_lossless}</span>
              </div>
              <input
                type="range"
                min="0"
                max="99"
                value={options.near_lossless}
                onChange={(e) => onChange({ near_lossless: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
