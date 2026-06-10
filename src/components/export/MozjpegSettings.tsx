
import React from 'react';
import { Sliders, Info, Zap, Shield, AlertCircle, Check } from 'lucide-react';
import { MozJpegOptions } from '../../types/export';

interface Props {
  options: MozJpegOptions;
  onChange: (options: Partial<MozJpegOptions>) => void;
  mode: 'basic' | 'advanced' | 'expert';
}

export const MozjpegSettings: React.FC<Props> = ({ options, onChange, mode }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Sliders size={14} className="text-blue-400" />
        </div>
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">MozJPEG Architecture</span>
      </div>

      {/* Quality - Always Basic */}
      <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Quality</label>
            <span className="text-[9px] text-slate-600 font-medium">JPEG compression factor</span>
          </div>
          <span className="text-xs font-mono font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{options.quality}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={options.quality}
          onChange={(e) => onChange({ quality: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-blue-600 border border-[#222]"
        />
      </div>

      {(mode === 'advanced' || mode === 'expert') && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
           <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] hover:border-blue-500/20 transition-all select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.progressive}
                  onChange={(e) => onChange({ progressive: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.progressive 
                  ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.progressive && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight">Progressive</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] hover:border-blue-500/20 transition-all select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.baseline}
                  onChange={(e) => onChange({ baseline: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.baseline 
                  ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.baseline && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight">Baseline</span>
            </label>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-3 rounded-xl border border-[#222] hover:border-blue-500/20 transition-all select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={options.arithmetic}
                onChange={(e) => onChange({ arithmetic: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                options.arithmetic 
                ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
              }`}>
                {options.arithmetic && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight">Arithmetic Coding</span>
              <span className="text-[9px] text-slate-600">Advanced entropy (Safari restricted)</span>
            </div>
          </label>

          <div className="space-y-2 bg-[#111] p-3 rounded-xl border border-[#222]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chroma Subsampling</label>
            </div>
            <select
              value={options.chroma_subsample}
              onChange={(e) => onChange({ chroma_subsample: parseInt(e.target.value) })}
              className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg px-2 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer font-bold"
            >
              <option value={1}>4:4:4 (No Color Loss)</option>
              <option value={2}>4:2:0 (Web Standard)</option>
            </select>
          </div>
        </div>
      )}

      {mode === 'expert' && (
        <div className="space-y-4 pt-2 border-t border-[#222] animate-in fade-in duration-500">
          <div className="space-y-3 bg-[#111] p-3 rounded-xl border border-[#222]">
             <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smoothing</label>
              <span className="text-[10px] font-mono font-black text-slate-500 bg-[#1A1A1A] px-1.5 rounded">{options.smoothing}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={options.smoothing}
              onChange={(e) => onChange({ smoothing: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-blue-600 border border-[#222]"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.optimize_coding}
                  onChange={(e) => onChange({ optimize_coding: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.optimize_coding 
                  ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.optimize_coding && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Optimize Huffman Tables</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.trellis_multipass}
                  onChange={(e) => onChange({ trellis_multipass: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.trellis_multipass 
                  ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.trellis_multipass && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Trellis Quantization</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group bg-[#111] p-2.5 rounded-xl border border-[#222] select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={options.separate_chroma_quality}
                  onChange={(e) => onChange({ separate_chroma_quality: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  options.separate_chroma_quality 
                  ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                }`}>
                  {options.separate_chroma_quality && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Sync Chroma Quality</span>
            </label>
          </div>

          {options.separate_chroma_quality && (
            <div className="space-y-3 p-3 bg-[#0A0A0A] rounded-xl border border-[#222]">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chroma Quality Override</label>
                <span className="text-[10px] font-mono font-black text-blue-400">{options.chroma_quality}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={options.chroma_quality}
                onChange={(e) => onChange({ chroma_quality: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          )}

          <div className="p-2 bg-blue-900/10 border border-blue-500/20 rounded-md">
            <p className="text-[9px] text-blue-300 leading-relaxed">
              Expert note: MozJPEG's Trellis optimization can significantly improve compression efficiency at the cost of processing time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
