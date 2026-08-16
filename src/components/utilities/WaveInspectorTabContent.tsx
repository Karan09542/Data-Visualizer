import React from 'react';
import { Compass, Sparkles, Check, Palette, RotateCcw, SlidersHorizontal, RefreshCw, Film, Download, Pause, Image as ImageIcon, ArrowRightLeft, ArrowUpDown, Move, Clock, Zap, X, PenTool, Circle, Square, Triangle, Trash2, Eraser, MousePointer2, Brush, Undo, Redo, Type, Waves } from 'lucide-react';
import { FilterMode, FILTER_PRESETS, QUICK_ANGLES, DISPLACEMENT_FUNCTIONS } from './WaveDisplacementShaders';
import type { PoolImage } from './WaveDisplacementStudio';
import { FontPicker } from '../FontPicker';
import { ColorPickerTrigger } from '../image-workspace/components/shared/ColorPickers';
import { FilterSlider } from '../image-workspace/components/shared/FilterSlider';
import CustomSelect from '../CustomSelect';

// ----------------------------------------------------------------------
// EFFECTS TAB
// ----------------------------------------------------------------------
export interface WaveEffectsTabProps {
   waveAngle: number;
   setWaveAngle: (v: number) => void;
   filterMode: string;
   setFilterMode: (v: FilterMode) => void;
   displacementFunc: number;
   setDisplacementFunc: (v: number) => void;
   globalFilters: { brightness: number; contrast: number; exposure: number; hue: number; sepia: number };
   setGlobalFilters: React.Dispatch<React.SetStateAction<{ brightness: number; contrast: number; exposure: number; hue: number; sepia: number }>>;
}

export function WaveEffectsTab({ waveAngle, setWaveAngle, filterMode, setFilterMode, displacementFunc, setDisplacementFunc, globalFilters, setGlobalFilters }: WaveEffectsTabProps) {
   const categories = ['Trigonometric', 'Wave Shapes', 'Physics', 'Mathematical'] as const;
   return (
      <div className="p-4 space-y-5 overflow-x-hidden min-w-0">
         {/* Direction & Angle Controller */}
         <div className="space-y-3 bg-[#131824]/60 border border-white/10 p-3.5 rounded-2xl min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Compass size={14} className="text-cyan-400" />
                  Wave Direction Angle
               </span>
               <div className="flex items-center gap-1.5">
                  <span className="font-mono text-cyan-400 text-xs font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">{waveAngle}°</span>
                  <button
                     onClick={() => setWaveAngle(45)}
                     className="p-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                     title="Reset Angle to 45°"
                  >
                     <RotateCcw size={12} />
                  </button>
               </div>
            </div>

            {/* Quick Angle Direction Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
               {QUICK_ANGLES.map((qa) => (
                  <button
                     key={qa.angle}
                     onClick={() => setWaveAngle(qa.angle)}
                     className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all border flex items-center justify-center gap-1 min-w-0 ${waveAngle === qa.angle
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                  >
                     <span>{qa.arrow}</span>
                     <span className="truncate">{qa.label}</span>
                  </button>
               ))}
            </div>

            {/* Smooth Angle Dial Slider */}
            <div className="space-y-1 pt-1">
               <input
                  type="range" min="0" max="360" step="5"
                  value={waveAngle}
                  onChange={(e) => setWaveAngle(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
               />
               <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>0° (H)</span>
                  <span>90° (V)</span>
                  <span>180°</span>
                  <span>360°</span>
               </div>
            </div>
         </div>

         {/* Filter Mode Presets */}
         <div className="space-y-3 min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
               <Sparkles size={14} className="text-yellow-400" />
               Displacement Filter Preset
            </span>

            <div className="grid grid-cols-1 gap-2">
               {FILTER_PRESETS.map((preset) => (
                  <button
                     key={preset.id}
                     onClick={() => setFilterMode(preset.id)}
                     className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between min-w-0 ${filterMode === preset.id
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/10'
                        : 'bg-[#131824]/60 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                  >
                     <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                           {preset.icon}
                        </div>
                        <div className="min-w-0">
                           <div className="text-xs font-bold text-slate-100 truncate">{preset.name}</div>
                           <div className="text-[10px] text-slate-400 mt-0.5 truncate">{preset.description}</div>
                        </div>
                     </div>
                     {filterMode === preset.id && (
                        <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 ml-2">
                           <Check size={12} strokeWidth={3} />
                        </div>
                     )}
                  </button>
               ))}
            </div>
         </div>

         {/* Displacement Math Function Selector */}
         <div className="space-y-3 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-violet-400" />
                  Displacement Function
               </span>
               {displacementFunc !== 0 && (
                  <button
                     onClick={() => setDisplacementFunc(0)}
                     className="p-1 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
                     title="Reset to Sin/Cos"
                  >
                     <RotateCcw size={12} />
                  </button>
               )}
            </div>

            {categories.map((cat) => {
               const funcs = DISPLACEMENT_FUNCTIONS.filter(f => f.category === cat);
               if (funcs.length === 0) return null;
               return (
                  <div key={cat} className="space-y-1.5">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">{cat}</span>
                     <div className="grid grid-cols-2 gap-1.5">
                        {funcs.map((fn) => (
                           <button
                              key={fn.id}
                              onClick={() => setDisplacementFunc(fn.id)}
                              className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 min-w-0 ${displacementFunc === fn.id
                                    ? 'bg-violet-500/15 border-violet-400 text-violet-200 shadow-md shadow-violet-500/10'
                                    : 'bg-[#131824]/60 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                 }`}
                           >
                              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                                 {fn.icon}
                              </div>
                              <div className="min-w-0">
                                 <div className="text-[10px] font-bold text-slate-100 truncate">{fn.name}</div>
                                 <div className="text-[9px] text-slate-500 truncate">{fn.description}</div>
                              </div>
                              {displacementFunc === fn.id && (
                                 <div className="w-4 h-4 rounded-full bg-violet-400 text-slate-950 flex items-center justify-center shrink-0 ml-auto">
                                    <Check size={10} strokeWidth={3} />
                                 </div>
                              )}
                           </button>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         {/* Global Color Correction Filters */}
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center mb-1">
               <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
                  <Palette size={14} className="text-fuchsia-400" />
                  Global Color Correction
               </span>
               <button
                  onClick={() => setGlobalFilters({ brightness: 1.0, contrast: 1.0, exposure: 1.0, hue: 0.0, sepia: 0.0 })}
                  className="p-1 rounded bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors"
                  title="Reset Global Colors"
               >
                  <RotateCcw size={12} />
               </button>
            </div>

            {[{ label: 'Brightness', key: 'brightness', min: 0.0, max: 3.0, step: 0.1 },
            { label: 'Contrast', key: 'contrast', min: 0.0, max: 3.0, step: 0.1 },
            { label: 'Exposure', key: 'exposure', min: 0.0, max: 3.0, step: 0.1 },
            { label: 'Hue Shift', key: 'hue', min: -180, max: 180, step: 1 },
            { label: 'Sepia', key: 'sepia', min: 0.0, max: 1.0, step: 0.1 }].map(f => (
               <div key={f.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                     <span>{f.label}</span>
                     <span className="font-mono text-fuchsia-400 text-[11px] font-bold">
                        {f.key === 'hue'
                           ? `${globalFilters[f.key as keyof typeof globalFilters].toFixed(0)}°`
                           : globalFilters[f.key as keyof typeof globalFilters].toFixed(2)}
                     </span>
                  </div>
                  <input
                     type="range" min={f.min} max={f.max} step={f.step}
                     value={globalFilters[f.key as keyof typeof globalFilters]}
                     onChange={(e) => setGlobalFilters(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) }))}
                     className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
                  />
               </div>
            ))}
         </div>
      </div>
   );
}

// ----------------------------------------------------------------------
// CONTROLS TAB
// ----------------------------------------------------------------------
export interface WaveControlsTabProps {
   waveSpeed: number;
   setWaveSpeed: (v: number) => void;
   waveFrequency: number;
   setWaveFrequency: (v: number) => void;
   waveAmplitude: number;
   setWaveAmplitude: (v: number) => void;
   transitionDuration: number;
   setTransitionDuration: (v: number) => void;
   holdDuration: number;
   setHoldDuration: (v: number) => void;
   autoTransition: boolean;
   setAutoTransition: (v: boolean) => void;
   manualProgress: number;
   setManualProgress: (v: number) => void;
}

export function WaveControlsTab({ waveSpeed, setWaveSpeed, waveFrequency, setWaveFrequency, waveAmplitude, setWaveAmplitude, transitionDuration, setTransitionDuration, holdDuration, setHoldDuration, autoTransition, setAutoTransition, manualProgress, setManualProgress }: WaveControlsTabProps) {
   return (
      <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center mb-1">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-emerald-400" />
                  Shader Parameters
               </span>
               <button
                  onClick={() => { setWaveSpeed(1.0); setWaveFrequency(1.0); setWaveAmplitude(1.0); }}
                  className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  title="Reset Shader Parameters"
               >
                  <RotateCcw size={12} />
               </button>
            </div>

            {/* Wave Speed */}
            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Wave Speed</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">{waveSpeed.toFixed(1)}x</span>
               </div>
               <input
                  type="range" min="0.1" max="5.0" step="0.1"
                  value={waveSpeed}
                  onChange={(e) => setWaveSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
               />
            </div>

            {/* Wave Frequency */}
            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Wave Frequency</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">{waveFrequency.toFixed(1)}</span>
               </div>
               <input
                  type="range" min="0.2" max="5.0" step="0.1"
                  value={waveFrequency}
                  onChange={(e) => setWaveFrequency(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
               />
            </div>

            {/* Wave Amplitude */}
            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Wave Amplitude</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">{waveAmplitude.toFixed(2)}</span>
               </div>
               <input
                  type="range" min="0.0" max="3.0" step="0.05"
                  value={waveAmplitude}
                  onChange={(e) => setWaveAmplitude(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
               />
            </div>
         </div>

         {/* Transition Sliders */}
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center mb-1">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <RefreshCw size={14} className="text-blue-400" />
                  Transition Cross-Fade
               </span>
               <button
                  onClick={() => { setTransitionDuration(2.5); setHoldDuration(2.0); setAutoTransition(true); setManualProgress(0.0); }}
                  className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  title="Reset Transition Defaults"
               >
                  <RotateCcw size={12} />
               </button>
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Cross-fade Speed</span>
                  <span className="font-mono text-blue-400 text-[11px] font-bold">{transitionDuration.toFixed(1)}s</span>
               </div>
               <input
                  type="range" min="0.5" max="8.0" step="0.5"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Hold Duration</span>
                  <span className="font-mono text-blue-400 text-[11px] font-bold">{holdDuration.toFixed(1)}s</span>
               </div>
               <input
                  type="range" min="0.0" max="10.0" step="0.5"
                  value={holdDuration}
                  onChange={(e) => setHoldDuration(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
               />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
               <span className="text-xs text-slate-300 font-medium">Auto Loop Cross-fade</span>
               <button
                  onClick={() => setAutoTransition(!autoTransition)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${autoTransition ? 'bg-cyan-500' : 'bg-slate-800'}`}
               >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${autoTransition ? 'left-5.5' : 'left-0.5'}`} />
               </button>
            </div>

            {!autoTransition && (
               <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                     <span>Manual Blend Progress</span>
                     <span className="font-mono text-blue-400 text-[11px] font-bold">{(manualProgress * 100).toFixed(0)}%</span>
                  </div>
                  <input
                     type="range" min="0.0" max="1.0" step="0.01"
                     value={manualProgress}
                     onChange={(e) => setManualProgress(parseFloat(e.target.value))}
                     className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
                  />
               </div>
            )}
         </div>
      </div>
   );
}

// ----------------------------------------------------------------------
// EXPORT TAB
// ----------------------------------------------------------------------
export interface WaveExportTabProps {
   exportFormat: string;
   setExportFormat: (v: string) => void;
   recordDuration: number;
   setRecordDuration: (v: number) => void;
   recordFramerate: number;
   setRecordFramerate: (v: number) => void;
   exportSize: 'viewport' | '360p' | '480p' | '720p' | '1080p' | '4k';
   setExportSize: (v: 'viewport' | '360p' | '480p' | '720p' | '1080p' | '4k') => void;
   exportQuality: number;
   setExportQuality: (v: number) => void;
   exportLoop: boolean;
   setExportLoop: (v: boolean) => void;
   isRecording: boolean;
   startRecording: () => void;
   stopRecording: (abort?: boolean) => void;
   statusMessage: string;
}

export function WaveExportTab({ exportFormat, setExportFormat, recordDuration, setRecordDuration, recordFramerate, setRecordFramerate, exportSize, setExportSize, exportQuality, setExportQuality, exportLoop, setExportLoop, isRecording, startRecording, stopRecording, statusMessage }: WaveExportTabProps) {
   return (
      <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
               <Film size={14} className="text-purple-400" />
               Dual Export Engine (CCapture.js)
            </span>

            <div className="flex gap-2 pt-1">
               <button
                  onClick={() => setExportFormat('webm')}
                  className={`flex-1 p-2 rounded-xl border text-center transition-all bg-purple-500/20 border-purple-400 text-purple-200 font-bold shadow-md shadow-purple-500/10`}
               >
                  <div className="text-[11px] font-bold truncate">WebM Video</div>
                  <div className="text-[9px] text-purple-300 mt-0.5 truncate">Fast, High Quality, Small Size</div>
               </button>
            </div>

            {/* Record Parameters */}
            <div className="grid grid-cols-2 gap-3 pt-1">
               <div>
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Duration (Sec)</label>
                  <input
                     type="number" min="1" max="15"
                     value={recordDuration}
                     onChange={(e) => setRecordDuration(Math.max(1, parseInt(e.target.value) || 1))}
                     className="w-full bg-slate-900 border border-white/10 text-xs text-slate-100 p-2 rounded-xl font-mono outline-none focus:border-purple-400"
                  />
               </div>
               <div>
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">FPS Target</label>
                  <CustomSelect
                     value={recordFramerate.toString()}
                     onChange={(val) => setRecordFramerate(parseInt(val))}
                     options={[
                        { value: '10', label: '10 FPS (Smallest File)' },
                        { value: '15', label: '15 FPS' },
                        { value: '24', label: '24 FPS (Cinematic)' },
                        { value: '30', label: '30 FPS' },
                        { value: '60', label: '60 FPS' }
                     ]}
                     className="w-full font-mono"
                  />
               </div>

               <div>
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Resolution Size</label>
                  <CustomSelect
                     value={exportSize}
                     onChange={(val) => setExportSize(val as any)}
                     options={[
                        { value: 'viewport', label: 'Match Viewport' },
                        { value: '360p', label: '360p (Web)' },
                        { value: '480p', label: '480p (SD)' },
                        { value: '720p', label: '720p (HD)' },
                        { value: '1080p', label: '1080p (FHD)' },
                        { value: '4k', label: '4K (UHD)' }
                     ]}
                     className="w-full"
                  />
               </div>
               <div>
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">
                     Export Quality — <span className="text-purple-400">{exportQuality}%</span>
                  </label>
                  <input
                     type="range" min="10" max="100" step="5"
                     value={exportQuality}
                     onChange={(e) => setExportQuality(parseInt(e.target.value))}
                     className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                     <span>10% (tiny)</span>
                     <span>{exportQuality}%</span>
                     <span>100% (max)</span>
                  </div>
                  {exportFormat === 'webm' && (
                     <p className="mt-2 text-[9px] text-slate-500 leading-relaxed">
                        💡 WebM uses per-frame encoding — files are larger than MP4. Lower <strong className="text-purple-400">FPS</strong> or <strong className="text-purple-400">Quality</strong> to reduce size.
                     </p>
                  )}
               </div>
            </div>

            {/* Loop Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
               <div>
                  <span className="text-xs text-slate-300 font-medium block">Loop Images</span>
                  <span className="text-[9px] text-slate-500">{exportLoop ? 'Cycle all images repeatedly for full duration' : 'Play through all images once, then stop'}</span>
               </div>
               <button
                  onClick={() => setExportLoop(!exportLoop)}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${exportLoop ? 'bg-purple-500' : 'bg-slate-800'}`}
               >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${exportLoop ? 'left-5.5' : 'left-0.5'}`} />
               </button>
            </div>

            {/* Record Start/Stop Action */}
            {!isRecording ? (
               <button
                  onClick={startRecording}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white rounded-xl font-extrabold text-xs shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
               >
                  <Download size={15} />
                  <span>Export Animation ({exportFormat.toUpperCase()})</span>
               </button>
            ) : (
               <div className="flex gap-2">
                  <button
                     onClick={() => stopRecording(true)}
                     className="flex-[1] py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-extrabold text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                     title="Cancel Recording"
                  >
                     <X size={15} />
                     <span>Cancel</span>
                  </button>
                  <button
                     onClick={() => stopRecording(false)}
                     className="flex-[2] py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-extrabold text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                     <Pause size={15} />
                     <span>Stop & Download</span>
                  </button>
               </div>
            )}

            {statusMessage && (
               <p className="text-[10px] text-cyan-300 bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 font-mono text-center truncate">
                  {statusMessage}
               </p>
            )}
         </div>
      </div>
   );
}

// ----------------------------------------------------------------------
// IMAGE TAB
// ----------------------------------------------------------------------
export interface WaveImageTabProps {
   images: PoolImage[];
   currentIndex: number;
   updateImageProperty: (property: keyof PoolImage, value: any) => void;
   updateImageFilter: (property: keyof NonNullable<PoolImage['filters']>, value: number) => void;
   resetImageFilters: () => void;
   resetImageGeometry?: () => void;
   globalFilters: { brightness: number; contrast: number; exposure: number; hue: number; sepia: number };
   holdDuration: number;
   compressQuality: number;
   setCompressQuality: (v: number) => void;
   doCompress: () => void;
}

export function WaveImageTab({ images, currentIndex, updateImageProperty, updateImageFilter, resetImageFilters, resetImageGeometry, globalFilters, holdDuration, compressQuality, setCompressQuality, doCompress }: WaveImageTabProps) {
   if (images.length === 0 || !images[currentIndex]) {
      return (
         <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-white/5 rounded-2xl bg-[#131824]/30">
               <ImageIcon size={32} className="text-slate-600 mb-3" />
               <h3 className="text-xs font-bold text-slate-300">No Image Selected</h3>
               <p className="text-[10px] text-slate-500 mt-1">Upload and select an image from the pool to customize its specific properties.</p>
            </div>
         </div>
      );
   }

   const handleResetGeometry = () => {
      if (resetImageGeometry) {
         resetImageGeometry();
      } else {
         updateImageProperty('scale', 1.0);
         updateImageProperty('dispIntensity', 1.0);
         updateImageProperty('rotation', 0);
         updateImageProperty('flipX', false);
         updateImageProperty('flipY', false);
         updateImageProperty('translateX', 0);
         updateImageProperty('translateY', 0);
      }
   };

   return (
      <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-fuchsia-400" />
                  Image Geometry
               </span>
               <button
                  onClick={handleResetGeometry}
                  className="p-1 rounded bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors"
                  title="Reset Image Geometry"
               >
                  <RotateCcw size={12} />
               </button>
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Scale</span>
                  <span className="font-mono text-fuchsia-400 text-[11px] font-bold">{(images[currentIndex].scale ?? 1.0).toFixed(2)}x</span>
               </div>
               <input
                  type="range" min="0.5" max="2.0" step="0.05"
                  value={images[currentIndex].scale ?? 1.0}
                  onChange={(e) => updateImageProperty('scale', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Displacement Intensity</span>
                  <span className="font-mono text-fuchsia-400 text-[11px] font-bold">{(images[currentIndex].dispIntensity ?? 1.0).toFixed(2)}x</span>
               </div>
               <input
                  type="range" min="0.0" max="2.0" step="0.05"
                  value={images[currentIndex].dispIntensity ?? 1.0}
                  onChange={(e) => updateImageProperty('dispIntensity', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Rotation</span>
                  <span className="font-mono text-fuchsia-400 text-[11px] font-bold">{Math.round(images[currentIndex].rotation ?? 0)}°</span>
               </div>
               <input
                  type="range" min="-180" max="180" step="1"
                  value={images[currentIndex].rotation ?? 0}
                  onChange={(e) => updateImageProperty('rotation', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
               />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
               <button
                  onClick={() => updateImageProperty('flipX', !images[currentIndex].flipX)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all truncate border ${images[currentIndex].flipX
                     ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 shadow-sm'
                     : 'bg-[#131824] text-slate-400 hover:text-slate-200 border-white/10'
                     }`}
               >
                  <ArrowRightLeft size={13} className="shrink-0" />
                  <span className="truncate">Flip X</span>
               </button>
               <button
                  onClick={() => updateImageProperty('flipY', !images[currentIndex].flipY)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all truncate border ${images[currentIndex].flipY
                     ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 shadow-sm'
                     : 'bg-[#131824] text-slate-400 hover:text-slate-200 border-white/10'
                     }`}
               >
                  <ArrowUpDown size={13} className="shrink-0" />
                  <span className="truncate">Flip Y</span>
               </button>
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1"><Move size={12} className="text-fuchsia-400" /> Translate X</span>
                  <span className="font-mono text-fuchsia-400 text-[11px] font-bold">{((images[currentIndex].translateX ?? 0) * 100).toFixed(0)}%</span>
               </div>
               <input
                  type="range" min="-0.5" max="0.5" step="0.01"
                  value={images[currentIndex].translateX ?? 0}
                  onChange={(e) => updateImageProperty('translateX', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1"><Move size={12} className="text-fuchsia-400" /> Translate Y</span>
                  <span className="font-mono text-fuchsia-400 text-[11px] font-bold">{((images[currentIndex].translateY ?? 0) * 100).toFixed(0)}%</span>
               </div>
               <input
                  type="range" min="-0.5" max="0.5" step="0.01"
                  value={images[currentIndex].translateY ?? 0}
                  onChange={(e) => updateImageProperty('translateY', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
               />
            </div>
         </div>

         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-400" />
                  Custom Hold Duration
               </span>
            </div>

            <div className="flex items-center gap-3">
               <input
                  type="range" min="0.1" max="10.0" step="0.1"
                  value={images[currentIndex].holdDurationOverride ?? holdDuration}
                  onChange={(e) => updateImageProperty('holdDurationOverride', parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
               />
               <span className="text-xs font-mono font-bold text-amber-400 min-w-[3rem] text-right">
                  {(images[currentIndex].holdDurationOverride ?? holdDuration).toFixed(1)}s
               </span>
            </div>

            <div className="flex justify-between items-center mt-2">
               <button
                  onClick={() => updateImageProperty('holdDurationOverride', null)}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${images[currentIndex].holdDurationOverride !== null ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-white/5 text-slate-500 border-white/10 cursor-not-allowed'}`}
                  disabled={images[currentIndex].holdDurationOverride === null}
               >
                  Reset to Global
               </button>
               <span className="text-[9px] text-slate-500">Global: {holdDuration.toFixed(1)}s</span>
            </div>
         </div>

         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  Displacement Override
               </span>
               {images[currentIndex].filterOverride && (
                  <button
                     onClick={() => updateImageProperty('filterOverride', null)}
                     className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                     title="Remove Override (Use Global)"
                  >
                     <X size={12} />
                  </button>
               )}
            </div>
            <p className="text-[10px] text-slate-400">Select a filter below to override the global displacement effect for this specific image.</p>

            <div className="grid grid-cols-2 gap-2">
               {FILTER_PRESETS.map((preset) => (
                  <button
                     key={preset.id}
                     onClick={() => updateImageProperty('filterOverride', images[currentIndex].filterOverride === preset.id ? null : preset.id)}
                     className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between min-w-0 ${images[currentIndex].filterOverride === preset.id
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                        : 'bg-[#131824] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                  >
                     <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                           {React.cloneElement(preset.icon as React.ReactElement<any>, { size: 12, className: 'text-amber-400' })}
                        </div>
                        <div className="text-[10px] font-bold truncate">{preset.name}</div>
                     </div>
                  </button>
               ))}
            </div>
         </div>

         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Palette size={14} className="text-rose-400" />
                  Color Override
               </span>
               <button
                  onClick={resetImageFilters}
                  className={`p-1 rounded transition-colors ${images[currentIndex].filters ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                  disabled={!images[currentIndex].filters}
                  title="Reset to Global Colors"
               >
                  <RotateCcw size={12} />
               </button>
            </div>

            <p className="text-[10px] text-slate-400">Override the global color settings for this specific image.</p>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Brightness</span>
                  <span className="font-mono text-rose-400 text-[11px] font-bold">{(images[currentIndex].filters?.brightness ?? globalFilters.brightness).toFixed(2)}</span>
               </div>
               <input
                  type="range" min="0.0" max="3.0" step="0.1"
                  value={images[currentIndex].filters?.brightness ?? globalFilters.brightness}
                  onChange={(e) => updateImageFilter('brightness', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Contrast</span>
                  <span className="font-mono text-rose-400 text-[11px] font-bold">{(images[currentIndex].filters?.contrast ?? globalFilters.contrast).toFixed(2)}</span>
               </div>
               <input
                  type="range" min="0.0" max="3.0" step="0.1"
                  value={images[currentIndex].filters?.contrast ?? globalFilters.contrast}
                  onChange={(e) => updateImageFilter('contrast', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Exposure</span>
                  <span className="font-mono text-rose-400 text-[11px] font-bold">{(images[currentIndex].filters?.exposure ?? globalFilters.exposure).toFixed(2)}</span>
               </div>
               <input
                  type="range" min="0.0" max="3.0" step="0.1"
                  value={images[currentIndex].filters?.exposure ?? globalFilters.exposure}
                  onChange={(e) => updateImageFilter('exposure', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Hue Shift</span>
                  <span className="font-mono text-rose-400 text-[11px] font-bold">{(images[currentIndex].filters?.hue ?? globalFilters.hue).toFixed(0)}°</span>
               </div>
               <input
                  type="range" min="-180" max="180" step="1"
                  value={images[currentIndex].filters?.hue ?? globalFilters.hue}
                  onChange={(e) => updateImageFilter('hue', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
               />
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Sepia</span>
                  <span className="font-mono text-rose-400 text-[11px] font-bold">{(images[currentIndex].filters?.sepia ?? globalFilters.sepia).toFixed(2)}</span>
               </div>
               <input
                  type="range" min="0.0" max="1.0" step="0.1"
                  value={images[currentIndex].filters?.sepia ?? globalFilters.sepia}
                  onChange={(e) => updateImageFilter('sepia', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
               />
            </div>
         </div>

         {/* Native Compression Tool */}
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
               <Zap size={14} className="text-emerald-400" />
               Global Image Compression
            </span>
            <p className="text-[10px] text-slate-400">Losslessly (or lossy) compress all pool images in-browser to save memory and reduce export file size.</p>

            <div className="flex justify-between text-xs text-slate-300 font-medium">
               <span>Quality</span>
               <span className="font-mono text-emerald-400 text-[11px] font-bold">{Math.round(compressQuality * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
               <input
                  type="range" min="0.1" max="1.0" step="0.1"
                  value={compressQuality}
                  onChange={(e) => setCompressQuality(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
               />
            </div>

            <button
               onClick={doCompress}
               className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all"
            >
               Compress All to WebP
            </button>
         </div>
      </div>
   );
}

// ----------------------------------------------------------------------
// MASK TAB
// ----------------------------------------------------------------------
export type MaskTool = 'select' | 'brush' | 'pen' | 'eraser' | 'circle' | 'square' | 'triangle' | 'text';

export interface WaveMaskTabProps {
   isMaskMode: boolean;
   setIsMaskMode: (v: boolean) => void;
   maskTool: MaskTool;
   setMaskTool: (v: MaskTool) => void;
   maskBrushSize: number;
   setMaskBrushSize: (v: number) => void;
   maskRotation: number;
   setMaskRotation: (v: number) => void;
   clearMask: () => void;
   undoMask: () => void;
   redoMask: () => void;
   canUndo: boolean;
   canRedo: boolean;
   activeMaskObjectId?: string | null;
   deleteActiveObject?: () => void;
}

export function WaveMaskTab({
   isMaskMode, setIsMaskMode, maskTool, setMaskTool, maskBrushSize, setMaskBrushSize, maskRotation, setMaskRotation, clearMask,
   undoMask, redoMask, canUndo, canRedo, activeMaskObjectId, deleteActiveObject
}: WaveMaskTabProps) {
   return (
      <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
         <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                  <PenTool size={14} className="text-green-400" />
                  Masking Mode
               </span>
               <button
                  onClick={() => setIsMaskMode(!isMaskMode)}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${isMaskMode ? 'bg-green-500' : 'bg-slate-800'}`}
               >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${isMaskMode ? 'left-5.5' : 'left-0.5'}`} />
               </button>
            </div>

            <p className="text-[10px] text-slate-400">
               Enable masking mode to draw custom shapes where the displacement effect should apply. Draw directly on the preview.
            </p>
         </div>

         <div className={`transition-opacity ${isMaskMode ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-4 min-w-0">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Palette size={14} className="text-cyan-400" />
                  Drawing Tools
               </span>

               <div className="grid grid-cols-7 gap-2">
                  <button onClick={() => setMaskTool('select')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'select' ? 'bg-orange-500/20 border-orange-400 text-orange-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Select/Move"><MousePointer2 size={16} /></button>
                  <button onClick={() => setMaskTool('brush')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'brush' ? 'bg-green-500/20 border-green-400 text-green-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Brush"><Brush size={16} /></button>
                  <button onClick={() => setMaskTool('pen')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'pen' ? 'bg-teal-500/20 border-teal-400 text-teal-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Pen"><PenTool size={16} /></button>
                  <button onClick={() => setMaskTool('eraser')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'eraser' ? 'bg-red-500/20 border-red-400 text-red-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Eraser"><Eraser size={16} /></button>
                  <button onClick={() => setMaskTool('circle')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'circle' ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Circle"><Circle size={16} /></button>
                  <button onClick={() => setMaskTool('square')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'square' ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Square"><Square size={16} /></button>
                  <button onClick={() => setMaskTool('triangle')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'triangle' ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Triangle"><Triangle size={16} /></button>
               </div>

               {(maskTool === 'select' || maskTool === 'brush' || maskTool === 'pen' || maskTool === 'eraser') && (
                  <div className="space-y-1.5 pt-2">
                     <div className="flex justify-between text-xs text-slate-300 font-medium">
                        <span>Size / Stroke</span>
                        <span className="font-mono text-cyan-400 text-[11px] font-bold">{maskBrushSize}px</span>
                     </div>
                     <input
                        type="range" min="1" max="200" step="1"
                        value={maskBrushSize}
                        onChange={(e) => setMaskBrushSize(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                     />
                  </div>
               )}

               {(maskTool === 'square' || maskTool === 'triangle' || maskTool === 'select') && (
                  <div className="space-y-1.5">
                     <div className="flex justify-between text-xs text-slate-300 font-medium">
                        <span>Rotation</span>
                        <span className="font-mono text-cyan-400 text-[11px] font-bold">{maskRotation}°</span>
                     </div>
                     <input
                        type="range" min="0" max="360" step="1"
                        value={maskRotation}
                        onChange={(e) => setMaskRotation(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                     />
                  </div>
               )}

               {maskTool === 'pen' && (
                  <div className="pt-2 text-xs text-slate-400 text-center font-medium bg-white/5 py-2 rounded-xl border border-white/10">
                     Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">Enter</kbd> to finish path
                  </div>
               )}
            </div>

            <div className={`grid ${activeMaskObjectId && maskTool === 'select' ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-4`}>
               <button onClick={undoMask} disabled={!canUndo} className={`py-2 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1.5 ${canUndo ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'}`} title="Undo">
                  <Undo size={14} /> {!(activeMaskObjectId && maskTool === 'select') && 'Undo'}
               </button>
               <button onClick={redoMask} disabled={!canRedo} className={`py-2 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1.5 ${canRedo ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'}`} title="Redo">
                  <Redo size={14} /> {!(activeMaskObjectId && maskTool === 'select') && 'Redo'}
               </button>
               {activeMaskObjectId && maskTool === 'select' && deleteActiveObject && (
                  <button onClick={deleteActiveObject} className="py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1.5" title="Delete Selected">
                     <X size={14} /> Del
                  </button>
               )}
               <button onClick={clearMask} className="py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1.5" title="Clear All">
                  <Trash2 size={14} /> {!(activeMaskObjectId && maskTool === 'select') && 'Clear'}
               </button>
            </div>
         </div>
      </div>
   );
}

// ----------------------------------------------------------------------
// TEXT TAB
// ----------------------------------------------------------------------

export interface WaveTextTabProps {
   maskTool: MaskTool;
   setMaskTool: (tool: MaskTool) => void;
   textToolContent: string;
   setTextToolContent: (c: string) => void;
   textToolFontFamily: string;
   setTextToolFontFamily: (f: string) => void;
   textToolColor: string;
   setTextToolColor: (c: string) => void;
   textToolAffectedByWaves: boolean;
   setTextToolAffectedByWaves: (v: boolean) => void;
   maskBrushSize: number;
   setMaskBrushSize: (s: number) => void;
   maskRotation: number;
   setMaskRotation: (r: number) => void;
   clearMask: () => void;
   canUndo: boolean;
   canRedo: boolean;
   undoMask: () => void;
   redoMask: () => void;
   activeMaskObjectId?: string | null;
   deleteActiveObject?: () => void;
}

export function WaveTextTab({
   maskTool,
   setMaskTool,
   textToolContent,
   setTextToolContent,
   textToolFontFamily,
   setTextToolFontFamily,
   textToolColor,
   setTextToolColor,
   textToolAffectedByWaves,
   setTextToolAffectedByWaves,
   maskBrushSize,
   setMaskBrushSize,
   maskRotation,
   setMaskRotation,
   clearMask,
   canUndo,
   canRedo,
   undoMask,
   redoMask,
   activeMaskObjectId,
   deleteActiveObject
}: WaveTextTabProps) {
   return (
      <div className="p-4 space-y-5 min-w-0">
         {/* Top Controls */}
         <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
               <Type size={14} className="text-indigo-400" />
               Text Tool
            </span>
            <div className="flex gap-1.5">
               <button
                  onClick={undoMask}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${canUndo
                     ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                     : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed'
                     }`}
                  title="Undo"
               >
                  <Undo size={14} />
               </button>
               <button
                  onClick={redoMask}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${canRedo
                     ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                     : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed'
                     }`}
                  title="Redo"
               >
                  <Redo size={14} />
               </button>
               <button
                  onClick={clearMask}
                  className="p-1.5 rounded-lg border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all ml-2"
                  title="Clear All Text & Masks"
               >
                  <Trash2 size={14} />
               </button>
               {activeMaskObjectId && maskTool === 'select' && deleteActiveObject && (
                  <button
                     onClick={deleteActiveObject}
                     className="p-1.5 rounded-lg border bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 transition-all"
                     title="Delete Selected Object"
                  >
                     <X size={14} />
                  </button>
               )}
            </div>
         </div>

         {/* Tool Selection */}
         <div className="grid grid-cols-2 gap-2">
            {[
               { id: 'select', label: 'Select & Move', icon: MousePointer2 },
               { id: 'text', label: 'Add Text', icon: Type }
            ].map((t) => (
               <button
                  key={t.id}
                  onClick={() => setMaskTool(t.id as MaskTool)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${maskTool === t.id
                     ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-sm'
                     : 'bg-[#131824] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                     }`}
               >
                  <t.icon size={14} />
                  {t.label}
               </button>
            ))}
         </div>

         {/* Text Properties */}
         <div className="space-y-4 bg-[#131824]/60 border border-white/10 p-3.5 rounded-2xl min-w-0">
            {/* Content Input */}
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Text Content</span>
               </div>
               <textarea
                  value={textToolContent}
                  onChange={(e) => setTextToolContent(e.target.value)}
                  placeholder="Enter text to add..."
                  rows={3}
                  className="w-full bg-[#1e2433] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-y min-h-[80px]"
               />
            </div>

            {/* Font Picker */}
            <div className="space-y-2 relative z-50">
               <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Font Family</span>
               </div>
               <FontPicker
                  value={textToolFontFamily}
                  onChange={setTextToolFontFamily}
                  className="w-full text-sm font-medium z-50"
               />
            </div>

            {/* Font Size, Rotation & Color */}
            <div className="flex gap-4 items-center">
               <div className="flex-1 space-y-3">
                  <FilterSlider
                     label="FONT SIZE"
                     min={10} max={200} step={1}
                     value={maskBrushSize}
                     onChange={(val: number) => setMaskBrushSize(val)}
                  />
                  <FilterSlider
                     label="ROTATION"
                     min={0} max={360} step={1}
                     value={maskRotation}
                     onChange={(val: number) => setMaskRotation(val)}
                  />
               </div>
               <div className="space-y-2 shrink-0 pt-1">
                  <div className="flex justify-between items-center">
                     <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Color</span>
                  </div>
                  <div className="flex items-center justify-center">
                     <ColorPickerTrigger
                        color={textToolColor}
                        onChange={(val: string) => setTextToolColor(val)}
                        className="w-7 h-7 rounded-lg border border-[#3A3A3A] shadow-inner cursor-pointer transition active:scale-95 hover:border-slate-400 relative z-[9999]"
                     />
                  </div>
               </div>
            </div>

            {/* Displacement Toggle */}
            <div className="pt-2 border-t border-white/10">
               <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2">
                     <Waves size={14} className={textToolAffectedByWaves ? "text-indigo-400" : "text-slate-500"} />
                     <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Affected by Waves</span>
                  </div>
                  <button
                     type="button"
                     onClick={() => setTextToolAffectedByWaves(!textToolAffectedByWaves)}
                     className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${textToolAffectedByWaves ? 'bg-indigo-500' : 'bg-slate-800'}`}
                  >
                     <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${textToolAffectedByWaves ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
               </label>
               <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  If enabled, text behaves like part of the image and gets distorted by the displacement waves. If disabled, it stays perfectly still as a flat overlay.
               </p>
            </div>
         </div>
      </div>
   );
}
