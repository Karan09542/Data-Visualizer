import React from 'react';
import { SlidersHorizontal, Image as ImageIcon, Crop, FileText, Check, ArrowLeft, RefreshCcw, RotateCw, Scan } from 'lucide-react';
import { FilterOptions } from '../../../utils/image/ImageFilters';

interface ToolbarBottomProps {
  currentTab: 'crop' | 'adjust';
  setTab: (tab: 'crop' | 'adjust') => void;
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  onSave: () => void;
  onCancel: () => void;
  onResetCrop: () => void;
  isProcessing: boolean;
  onSetAspect: (aspect?: number) => void;
  aspect: number | undefined;
  onRotate90: () => void;
  rotation: number;
  onRotateCustom: (deg: number) => void;
  cropMode: 'perspective' | 'rectangle';
  onToggleCropMode: () => void;
}

export function ToolbarBottom({
  currentTab, setTab, filters, setFilters, onSave, onCancel, onResetCrop, isProcessing,
  onSetAspect, aspect, onRotate90, rotation, onRotateCustom, cropMode, onToggleCropMode
}: ToolbarBottomProps) {

  const handleOcrPrep = () => {
    setFilters(f => ({ ...f, type: 'threshold', brightness: 20, contrast: 40 }));
  };

  const handleResetFilters = () => {
    setFilters({ type: 'none', brightness: 0, contrast: 0 });
  };

  return (
    <div className="w-full bg-slate-950 border-t border-white/10 flex flex-col shrink-0 pb-safe pb-4">

      {/* Dynamic Settings Area */}
      <div className="h-32 p-4 flex flex-col justify-center">
        {currentTab === 'crop' && (
          <div className="flex flex-col h-full gap-3 overflow-y-auto no-scrollbar justify-center">
            <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 px-2 pb-1">
              {[
                { label: 'Free', value: undefined },
                { label: '1:1', value: 1 },
                { label: '4:3', value: 4 / 3 },
                { label: '16:9', value: 16 / 9 },
                { label: '3:4', value: 3 / 4 }
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => onSetAspect(preset.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors border ${aspect === preset.value ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-1 shrink-0 self-center" />
              <button 
                onClick={onToggleCropMode}
                className={`px-3 py-1.5 rounded-full flex items-center justify-center shrink-0 transition-colors border ${cropMode === 'rectangle' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-transparent'}`}
                title={cropMode === 'perspective' ? "Perspective Mode (Free)" : "Straight Crop Mode"}
              >
                {cropMode === 'perspective' ? <Scan size={14} /> : <Crop size={14} />}
                <span className="ml-1 text-[10px] uppercase font-bold">{cropMode}</span>
              </button>
              <button
                onClick={onRotate90}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center shrink-0"
                title="Rotate 90°"
              >
                <RotateCw size={14} />
              </button>
              <button
                onClick={onResetCrop}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center shrink-0"
                title="Reset Frame"
              >
                <RefreshCcw size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3 px-3">
              <span className="text-xs text-slate-400 font-medium">Angle</span>
              <input
                type="range" min="-45" max="45" value={rotation > 180 ? rotation - 360 : rotation} // Simplified visual for slider
                onChange={e => {
                  // Keep within a standard visual range or let DocumentWorkspace handle absolute
                  onRotateCustom(Number(e.target.value));
                }}
                className="flex-1 h-1 bg-slate-800 rounded-full appearance-none accent-blue-500"
              />
              <span className="text-xs text-slate-400 w-8 text-right">{rotation > 180 ? rotation - 360 : rotation}°</span>
            </div>
          </div>
        )}

        {currentTab === 'adjust' && (
          <div className="flex flex-col h-full gap-3 overflow-y-auto no-scrollbar">
            {/* Presets */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 pb-1">
              <button
                onClick={handleOcrPrep}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold whitespace-nowrap"
              >
                <FileText size={14} /> OCR Prep (B&W)
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, type: 'grayscale' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${filters.type === 'grayscale' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10'}`}
              >
                Grayscale
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, type: 'none' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${filters.type === 'none' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10'}`}
              >
                Original
              </button>
              <div className="w-px h-6 bg-white/10 mx-1 shrink-0 self-center" />
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full text-xs font-semibold whitespace-nowrap"
              >
                Reset All
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-3 px-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-16">Brightness</span>
                <input
                  type="range" min="-100" max="100" value={filters.brightness}
                  onChange={e => setFilters(f => ({ ...f, brightness: Number(e.target.value) }))}
                  className="flex-1 h-1 bg-slate-800 rounded-full appearance-none accent-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-16">Contrast</span>
                <input
                  type="range" min="-100" max="100" value={filters.contrast}
                  onChange={e => setFilters(f => ({ ...f, contrast: Number(e.target.value) }))}
                  className="flex-1 h-1 bg-slate-800 rounded-full appearance-none accent-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Bottom Tabs */}
      <div className="flex items-center justify-between px-4 pt-2">
        <button onClick={onCancel} className="p-3 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10">
          <ArrowLeft size={18} />
        </button>

        <div className="flex bg-white/10 rounded-full p-1 border border-white/5">
          <button
            onClick={() => setTab('crop')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${currentTab === 'crop' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
          >
            <Crop size={14} /> Crop
          </button>
          <button
            onClick={() => setTab('adjust')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${currentTab === 'adjust' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
          >
            <SlidersHorizontal size={14} /> Adjust
          </button>
        </div>

        <button
          onClick={onSave}
          disabled={isProcessing}
          className="p-3 text-white bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center disabled:opacity-50"
        >
          {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
        </button>
      </div>

    </div>
  );
}
