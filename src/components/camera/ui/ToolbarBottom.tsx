import React from 'react';
import { SlidersHorizontal, Crop, FileText, Check, ArrowLeft, RotateCcw, RotateCw, Scan, Square } from 'lucide-react';
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
  /** The photo's own width / height, for the "Original" shape. */
  originalAspect?: number;
  onRotate90: () => void;
  /** The fine straightening angle, -45° to 45°. */
  rotation: number;
  onRotateCustom: (deg: number) => void;
  cropMode: 'perspective' | 'rectangle';
  onSetCropMode: (mode: 'perspective' | 'rectangle') => void;
}

const chip = (on: boolean) =>
  `h-8 px-3 rounded-full text-xs font-semibold shrink-0 transition-colors ${
    on ? 'bg-white text-slate-900' : 'bg-white/[0.07] text-slate-300 hover:bg-white/[0.12] hover:text-white'
  }`;
const iconBtn =
  'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-white/[0.07] text-slate-300 hover:bg-white/[0.12] hover:text-white transition-colors';

/** The crop screen's controls: shape, mode and straightening, or the adjustments. */
export function ToolbarBottom({
  currentTab, setTab, filters, setFilters, onSave, onCancel, onResetCrop, isProcessing,
  onSetAspect, aspect, originalAspect, onRotate90, rotation, onRotateCustom, cropMode, onSetCropMode,
}: ToolbarBottomProps) {
  const presets: { label: string; value: number | undefined }[] = [
    { label: 'Free', value: undefined },
    ...(originalAspect ? [{ label: 'Original', value: originalAspect }] : []),
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
  ];
  const isOn = (v: number | undefined) => (v === undefined ? aspect === undefined : aspect !== undefined && Math.abs(aspect - v) < 1e-6);
  const angle = Math.round(rotation * 10) / 10;
  const pct = ((angle + 45) / 90) * 100;

  return (
    <div className="w-full bg-[#0b0f17] border-t border-white/[0.08] flex flex-col shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="px-3 pt-3 pb-2 min-h-[8.5rem] flex flex-col justify-center gap-3">
        {currentTab === 'crop' && (
          <>
            {/* Shape */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="radiogroup" aria-label="Crop shape">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  role="radio"
                  aria-checked={isOn(p.value)}
                  onClick={() => onSetAspect(p.value)}
                  disabled={cropMode === 'perspective' && p.value !== undefined}
                  className={`${chip(isOn(p.value) && cropMode === 'rectangle')} disabled:opacity-35 disabled:pointer-events-none`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Mode, quarter turn, reset */}
            <div className="flex items-center gap-2">
              <div className="flex p-0.5 rounded-full bg-white/[0.07]" role="radiogroup" aria-label="Crop mode">
                {(
                  [
                    ['rectangle', 'Straight', Square],
                    ['perspective', 'Perspective', Scan],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={cropMode === mode}
                    onClick={() => onSetCropMode(mode)}
                    title={mode === 'rectangle' ? 'A straight rectangle' : 'Drag each corner: straightens a page shot at an angle'}
                    className={`h-7 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
                      cropMode === mode ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              <button type="button" onClick={onRotate90} className={iconBtn} title="Turn 90°" aria-label="Turn 90 degrees">
                <RotateCw size={15} />
              </button>
              <button type="button" onClick={onResetCrop} className={iconBtn} title="Reset crop and angle" aria-label="Reset crop and angle">
                <RotateCcw size={15} />
              </button>
            </div>

            {/* Straighten */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-slate-400 w-16 shrink-0">Straighten</span>
              <div className="relative flex-1 h-8 flex items-center">
                {/* the centre mark */}
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-px bg-white/35 pointer-events-none" />
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={0.5}
                  value={angle}
                  onChange={(e) => onRotateCustom(Number(e.target.value))}
                  onDoubleClick={() => onRotateCustom(0)}
                  aria-label="Straighten angle in degrees"
                  className="cam-range w-full"
                  style={{ ['--pct' as string]: `${pct}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => onRotateCustom(0)}
                title="Back to 0°"
                className={`w-12 h-7 shrink-0 rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
                  angle ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-white/[0.07] text-slate-400'
                }`}
              >
                {angle > 0 ? '+' : ''}
                {angle}°
              </button>
            </div>
          </>
        )}

        {currentTab === 'adjust' && (
          <>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, type: 'threshold', brightness: 20, contrast: 40 }))}
                className={`${chip(filters.type === 'threshold')} inline-flex items-center gap-1.5`}
              >
                <FileText size={13} /> Document (B&amp;W)
              </button>
              <button type="button" onClick={() => setFilters((f) => ({ ...f, type: 'grayscale' }))} className={chip(filters.type === 'grayscale')}>
                Grayscale
              </button>
              <button type="button" onClick={() => setFilters((f) => ({ ...f, type: 'none' }))} className={chip(filters.type === 'none')}>
                Original
              </button>
              <button
                type="button"
                onClick={() => setFilters({ type: 'none', brightness: 0, contrast: 0 })}
                className={`${iconBtn} ml-auto`}
                title="Reset adjustments"
                aria-label="Reset adjustments"
              >
                <RotateCcw size={15} />
              </button>
            </div>
            {(
              [
                ['brightness', 'Brightness'],
                ['contrast', 'Contrast'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-slate-400 w-16 shrink-0">{label}</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  onDoubleClick={() => setFilters((f) => ({ ...f, [key]: 0 }))}
                  aria-label={label}
                  className="cam-range flex-1"
                  style={{ ['--pct' as string]: `${((filters[key] + 100) / 200) * 100}%` }}
                />
                <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-slate-300">{filters[key]}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Back, the two tabs, done */}
      <div className="flex items-center justify-between px-3 pt-1">
        <button type="button" onClick={onCancel} className="h-11 w-11 inline-flex items-center justify-center text-slate-300 hover:text-white rounded-full bg-white/[0.07] hover:bg-white/[0.12]" aria-label="Back: retake">
          <ArrowLeft size={18} />
        </button>
        <div className="flex p-1 rounded-full bg-white/[0.07]" role="tablist">
          {(
            [
              ['crop', 'Crop', Crop],
              ['adjust', 'Adjust', SlidersHorizontal],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={currentTab === id}
              onClick={() => setTab(id)}
              className={`h-9 px-4 inline-flex items-center gap-2 rounded-full text-xs font-bold transition-colors ${
                currentTab === id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={isProcessing}
          className="h-11 w-11 inline-flex items-center justify-center text-white bg-blue-600 hover:bg-blue-500 rounded-full disabled:opacity-50"
          aria-label="Save"
        >
          {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
        </button>
      </div>

      <style>{`
        .cam-range{-webkit-appearance:none;appearance:none;height:28px;background:transparent;cursor:pointer;touch-action:none}
        .cam-range:focus{outline:none}
        .cam-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,rgba(255,255,255,.18) 0,rgba(255,255,255,.18) 100%)}
        .cam-range::-moz-range-track{height:4px;border-radius:999px;background:rgba(255,255,255,.18)}
        .cam-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-8px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px rgba(59,130,246,.35),0 2px 6px rgba(0,0,0,.5)}
        .cam-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px rgba(59,130,246,.35),0 2px 6px rgba(0,0,0,.5)}
      `}</style>
    </div>
  );
}
