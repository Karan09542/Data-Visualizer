
import React from 'react';
import { Maximize2, Link2, Link2Off, Check } from 'lucide-react';
import { ResizeMethod } from '../../types/export';

interface Props {
  options: {
    enabled: boolean;
    width: number;
    height: number;
    maintainAspectRatio: boolean;
    method: ResizeMethod;
    premul: boolean;
    linearRGB: boolean;
  };
  onChange: (options: any) => void;
  originalWidth: number;
  originalHeight: number;
  mode: 'basic' | 'advanced' | 'expert';
}

export const ResizeSettings: React.FC<Props> = ({ options, onChange, originalWidth, originalHeight, mode }) => {
  const handleWidthChange = (val: number) => {
    if (options.maintainAspectRatio) {
      const ratio = originalWidth / originalHeight;
      onChange({ width: val, height: Math.round(val / ratio) });
    } else {
      onChange({ width: val });
    }
  };

  const handleHeightChange = (val: number) => {
    if (options.maintainAspectRatio) {
      const ratio = originalWidth / originalHeight;
      onChange({ height: val, width: Math.round(val * ratio) });
    } else {
      onChange({ height: val });
    }
  };

  const handlePercentageChange = (pct: number) => {
    const w = Math.round(originalWidth * (pct / 100));
    const h = Math.round(originalHeight * (pct / 100));
    onChange({ width: w, height: h });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Maximize2 size={14} className="text-blue-400" />
          </div>
          <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Resize Optimization</span>
        </div>
        <button 
          type="button"
          onClick={() => onChange({ enabled: !options.enabled })}
          className={`relative w-8 h-4.5 rounded-full transition-all duration-300 ${options.enabled ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-[#222]'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 shadow-sm ${options.enabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
        </button>
      </div>

      {options.enabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300 border border-[#222222] bg-[#111111] p-3.5 rounded-2xl shadow-inner">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-[#161616] p-2.5 rounded-xl border border-[#222222]">
            {/* Width */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block pl-1">Width</label>
              <div className="relative group flex items-center">
                <input
                  type="number"
                  value={options.width}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-0 rounded-lg py-1 text-sm text-blue-400 font-mono outline-none font-bold placeholder-slate-700 min-w-0 pr-1 pl-1"
                />
                <span className="text-[9px] text-slate-600 font-mono font-bold select-none pr-1">PX</span>
              </div>
            </div>

            {/* Link Anchor */}
            <div className="flex items-center justify-center px-1">
              <button 
                type="button"
                onClick={() => onChange({ maintainAspectRatio: !options.maintainAspectRatio })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                  options.maintainAspectRatio 
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                  : 'bg-[#181818] border-[#2A2A2A] text-slate-600 grayscale opacity-40 hover:opacity-100'
                }`}
                title={options.maintainAspectRatio ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
              >
                {options.maintainAspectRatio ? <Link2 size={13} strokeWidth={2.5} /> : <Link2Off size={13} strokeWidth={2.5} />}
              </button>
            </div>

            {/* Height */}
            <div className="space-y-1 text-right">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block pr-1">Height</label>
              <div className="relative group flex items-center justify-end">
                <input
                  type="number"
                  value={options.height}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-0 rounded-lg py-1 text-sm text-blue-400 font-mono outline-none font-bold text-right placeholder-slate-700 min-w-0 pr-1 pl-1"
                />
                <span className="text-[9px] text-slate-600 font-mono font-bold select-none pl-1 pr-1">PX</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scale Percentage</label>
              <span className="font-mono text-blue-400 font-black text-[10px] bg-blue-500/10 px-1.5 rounded">{Math.round((options.width / originalWidth) * 100)}%</span>
            </div>
            <input 
              type="range"
              min="10"
              max="200"
              value={Math.round((options.width / originalWidth) * 100)}
              onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-blue-600 border border-[#222]"
            />
            <div className="grid grid-cols-5 gap-1.5">
              {[25, 50, 75, 100, 150].map(pct => (
                <button
                  key={pct}
                  onClick={() => handlePercentageChange(pct)}
                  className={`py-1.5 border rounded-lg text-[9px] font-black tracking-tighter transition-all ${
                    Math.round((options.width/originalWidth)*100) === pct 
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.2)]' 
                    : 'bg-[#181818] border-[#2A2A2A] text-slate-600 hover:text-slate-400 hover:border-[#333]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {mode !== 'basic' && (
            <div className="space-y-2 pt-1 border-t border-[#222]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Interpolation Algorithm</label>
              <select
                value={options.method}
                onChange={(e) => onChange({ method: e.target.value })}
                className="w-full bg-[#181818] border border-[#2A2A2A] rounded-lg px-2 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                <option value="lanczos3">High-Fidelity (Lanczos3)</option>
                <option value="lanczos2">Balanced (Lanczos2)</option>
                <option value="catmullRom">Sharp (Catmull-Rom)</option>
                <option value="mitchell">Smooth (Mitchell)</option>
                <option value="triangle">Bilinear (Triangle)</option>
                <option value="nearest">Pixel-Perfect (Nearest)</option>
              </select>
            </div>
          )}

           {(mode === 'advanced' || mode === 'expert') && (
             <div className="grid grid-cols-1 gap-2 pt-1 border-t border-[#222]">
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={options.premul}
                    onChange={(e) => onChange({ premul: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    options.premul 
                    ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                    : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                  }`}>
                    {options.premul && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 uppercase tracking-tight">Premultiply Alpha</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={options.linearRGB}
                    onChange={(e) => onChange({ linearRGB: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    options.linearRGB 
                    ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
                    : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
                  }`}>
                    {options.linearRGB && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 uppercase tracking-tight">Resample in Linear RGB</span>
              </label>
            </div>
           )}
        </div>
      )}
    </div>
  );
};
