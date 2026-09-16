import React from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Plus, Shuffle, Compass, Sparkles, Check, Palette, RotateCcw, SlidersHorizontal, RefreshCw, Film, Download, Pause, Image as ImageIcon, ArrowRightLeft, ArrowUpDown, Move, Clock, Zap, X, PenTool, Circle, Square, Triangle, Trash2, Eraser, MousePointer2, Brush, Undo, Redo, Type, Waves } from 'lucide-react';
import { FilterMode, FILTER_PRESETS, QUICK_ANGLES, DISPLACEMENT_FUNCTIONS, QUICK_LOOKS, QuickLook } from './WaveDisplacementShaders';
import type { PoolImage } from './WaveDisplacementStudio';
import { FontPicker } from '../FontPicker';
import { ColorPickerTrigger } from '../image-workspace/components/shared/ColorPickers';
import { FilterSlider } from '../image-workspace/components/shared/FilterSlider';
import CustomSelect from '../CustomSelect';

// ----------------------------------------------------------------------
// EFFECTS TAB
// ----------------------------------------------------------------------
/**
 * Compass for the wave direction. Drag it, click a spot on it, or nudge it with the arrow keys.
 * 0° sends the ripples left to right; 90° sends them downward.
 */
function AngleDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
   const ref = React.useRef<HTMLDivElement>(null);
   const [dragging, setDragging] = React.useState(false);

   const angleFromPointer = (clientX: number, clientY: number) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return null;
      const dx = clientX - (box.left + box.width / 2);
      const dy = clientY - (box.top + box.height / 2);
      if (Math.hypot(dx, dy) < 4) return null;
      const degrees = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      return (degrees + 360) % 360;
   };

   const setFromPointer = (clientX: number, clientY: number) => {
      const next = angleFromPointer(clientX, clientY);
      if (next !== null) onChange(next);
   };

   React.useEffect(() => {
      if (!dragging) return;
      const move = (e: PointerEvent) => setFromPointer(e.clientX, e.clientY);
      const up = () => setDragging(false);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      return () => {
         window.removeEventListener('pointermove', move);
         window.removeEventListener('pointerup', up);
         window.removeEventListener('pointercancel', up);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [dragging]);

   const radians = (value * Math.PI) / 180;
   const needleX = 50 + Math.cos(radians) * 30;
   const needleY = 50 + Math.sin(radians) * 30;

   return (
      <div
         ref={ref}
         role="slider"
         tabIndex={0}
         aria-label="Wave direction"
         aria-valuemin={0}
         aria-valuemax={359}
         aria-valuenow={value}
         aria-valuetext={value + " degrees"}
         onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
            setFromPointer(e.clientX, e.clientY);
         }}
         onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange((value + 355) % 360); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange((value + 5) % 360); }
         }}
         className={`relative h-[76px] w-[76px] shrink-0 cursor-grab touch-none select-none rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${dragging ? 'cursor-grabbing border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-[#0d1119] hover:border-white/20'}`}
      >
         <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((tick) => {
               const a = (tick * Math.PI) / 180;
               const inner = tick % 90 === 0 ? 30 : 34;
               return (
                  <line
                     key={tick}
                     x1={50 + Math.cos(a) * inner}
                     y1={50 + Math.sin(a) * inner}
                     x2={50 + Math.cos(a) * 38}
                     y2={50 + Math.sin(a) * 38}
                     stroke="rgba(148,163,184,0.35)"
                     strokeWidth={tick % 90 === 0 ? 2 : 1}
                     strokeLinecap="round"
                  />
               );
            })}
            <line x1="50" y1="50" x2={needleX} y2={needleY} stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
            <circle cx={needleX} cy={needleY} r="6" fill="#22d3ee" />
            <circle cx="50" cy="50" r="3" fill="rgba(148,163,184,0.6)" />
         </svg>
      </div>
   );
}
export interface WaveEffectsTabProps {
   waveAngle: number;
   setWaveAngle: (v: number) => void;
   filterMode: string;
   setFilterMode: (v: FilterMode) => void;
   displacementFunc: number;
   setDisplacementFunc: (v: number) => void;
   globalFilters: { brightness: number; contrast: number; exposure: number; hue: number; sepia: number };
   setGlobalFilters: React.Dispatch<React.SetStateAction<{ brightness: number; contrast: number; exposure: number; hue: number; sepia: number }>>;
   applyQuickLook: (look: QuickLook) => void;
   applyMixedLooks: () => void;
   imageCount: number;
   mixedLooksActive: boolean;
}

export function WaveEffectsTab({ waveAngle, setWaveAngle, filterMode, setFilterMode, displacementFunc, setDisplacementFunc, globalFilters, setGlobalFilters, applyQuickLook, applyMixedLooks, imageCount, mixedLooksActive }: WaveEffectsTabProps) {
   const categories = ['Trigonometric', 'Wave Shapes', 'Physics', 'Mathematical'] as const;
   return (
      <div className="p-4 space-y-5 overflow-x-hidden min-w-0">
         {/* One tap sets the effect, the wave shape and the sliders together */}
         <div className="space-y-2.5 bg-[#131824]/60 border border-white/10 p-3.5 rounded-2xl min-w-0">
            <div className="flex items-center justify-between gap-2">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-yellow-400" />
                  Quick looks
               </span>
               <button
                  onClick={applyMixedLooks}
                  disabled={imageCount < 2}
                  title={imageCount < 2 ? "Add more photos to mix effects" : "Give each photo a different effect"}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${mixedLooksActive
                     ? 'bg-yellow-500/20 text-yellow-300'
                     : 'bg-white/5 text-slate-400 hover:text-slate-200'
                     } disabled:opacity-40 disabled:cursor-not-allowed`}
               >
                  <Shuffle size={11} />
                  Mix per photo
               </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
               {QUICK_LOOKS.map((look) => {
                  const active = !mixedLooksActive && filterMode === look.mode && displacementFunc === look.func;
                  return (
                     <button
                        key={look.id}
                        onClick={() => applyQuickLook(look)}
                        title={look.description}
                        className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-all min-w-0 ${active
                           ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                           : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                           }`}
                     >
                        <span className="shrink-0">{look.icon}</span>
                        <span className="min-w-0">
                           <span className={`block truncate text-[11px] font-bold ${active ? 'text-cyan-200' : 'text-slate-200'}`}>{look.name}</span>
                           <span className="block truncate text-[9px] text-slate-400">{look.description}</span>
                        </span>
                     </button>
                  );
               })}
            </div>

            <p className="text-[10px] leading-relaxed text-slate-500">
               {mixedLooksActive
                  ? "Each photo has its own effect right now. Pick a look above to use one everywhere."
                  : "Sets the effect, the wave shape and the sliders below in one go."}
            </p>
         </div>
         {/* Which way the ripples travel: drag the dial, or pick a direction */}
         <div className="space-y-3 bg-[#131824]/60 border border-white/10 p-3.5 rounded-2xl min-w-0">
            <div className="flex justify-between items-center">
               <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Compass size={14} className="text-cyan-400" />
                  Wave direction
               </span>
               <div className="flex items-center gap-1.5">
                  <span className="font-mono text-cyan-400 text-xs font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">{waveAngle}°</span>
                  <button
                     onClick={() => setWaveAngle(45)}
                     className="p-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                     title="Back to 45°"
                     aria-label="Back to 45 degrees"
                  >
                     <RotateCcw size={12} />
                  </button>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <AngleDial value={waveAngle} onChange={setWaveAngle} />

               {/* Straight-to-the-point directions */}
               <div className="grid flex-1 grid-cols-3 gap-1 min-w-0">
                  {QUICK_ANGLES.map((qa) => {
                     const active = waveAngle === qa.angle;
                     return (
                        <button
                           key={qa.angle}
                           onClick={() => setWaveAngle(qa.angle)}
                           title={qa.label + " (" + qa.angle + "°)"}
                           aria-label={qa.label}
                           aria-pressed={active}
                           className={`flex h-9 items-center justify-center rounded-lg border transition-all ${active
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                              }`}
                        >
                           {qa.arrow}
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* Fine tuning */}
            <div className="space-y-1">
               <input
                  type="range" min="0" max="360" step="5"
                  value={waveAngle}
                  onChange={(e) => setWaveAngle(parseInt(e.target.value))}
                  aria-label="Wave direction in degrees"
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
               />
               <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>0° across</span>
                  <span>90° down</span>
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
   compressQuality: number;
   setCompressQuality: (v: number) => void;
   doCompress: () => void;
   isCompressing: boolean;
   compressionInfo: string | null;
}

export function WaveExportTab({ exportFormat, setExportFormat, recordDuration, setRecordDuration, recordFramerate, setRecordFramerate, exportSize, setExportSize, exportQuality, setExportQuality, exportLoop, setExportLoop, isRecording, startRecording, stopRecording, statusMessage, compressQuality, setCompressQuality, doCompress, isCompressing, compressionInfo }: WaveExportTabProps) {
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
                        💡 Encoded by your device's video encoder — WebM on Chrome/Android, MP4 on Safari/iOS. Lower <strong className="text-purple-400">FPS</strong>, <strong className="text-purple-400">Quality</strong> or <strong className="text-purple-400">Size</strong> for smaller files and smoother recording on phones.
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

            {/* Shrink the source photos: lighter preview and a smaller exported video */}
            <div className="bg-[#131824]/60 border border-white/10 p-4 rounded-2xl space-y-3 min-w-0">
               <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Zap size={14} className="text-emerald-400" />
                  Shrink source photos
               </span>
               <p className="text-[10px] text-slate-400">
                  Re-saves every photo in the pool as WebP. Lower quality means a lighter preview and a smaller exported video.
               </p>

               <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Photo quality</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">{Math.round(compressQuality * 100)}%</span>
               </div>
               <input
                  type="range" min="0.1" max="1.0" step="0.1"
                  value={compressQuality}
                  onChange={(e) => setCompressQuality(parseFloat(e.target.value))}
                  disabled={isCompressing}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-50"
               />

               <button
                  onClick={doCompress}
                  disabled={isCompressing}
                  className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
               >
                  {isCompressing ? "Compressing..." : "Shrink all photos"}
               </button>

               {compressionInfo && (
                  <p className="text-[10px] text-emerald-400/90 text-center">{compressionInfo}</p>
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
}

export function WaveImageTab({ images, currentIndex, updateImageProperty, updateImageFilter, resetImageFilters, resetImageGeometry, globalFilters, holdDuration }: WaveImageTabProps) {
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
   /** Pixels one nudge moves the selection */
   nudgeStep: number;
   setNudgeStep: (v: number) => void;
   nudgeActiveObject: (dx: number, dy: number) => void;
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
   undoMask, redoMask, canUndo, canRedo, activeMaskObjectId, deleteActiveObject,
   nudgeStep, setNudgeStep, nudgeActiveObject,
}: WaveMaskTabProps) {
   return (
      <div className="p-4 space-y-4 overflow-x-hidden min-w-0">
         {/* Move the selection a step at a time: arrow keys on a keyboard, these on a screen */}
         {activeMaskObjectId && (
            <div className="space-y-2 bg-[#131824]/60 border border-white/10 p-3 rounded-2xl">
               <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nudge</span>
                  <div className="flex gap-1">
                     {[1, 5, 10].map((step) => (
                        <button
                           key={step}
                           onClick={() => setNudgeStep(step)}
                           className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${nudgeStep === step
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                        >
                           {step}px
                        </button>
                     ))}
                  </div>
               </div>

               <div className="mx-auto grid w-[132px] grid-cols-3 gap-1">
                  <span />
                  <button
                     onClick={() => nudgeActiveObject(0, -nudgeStep)}
                     aria-label="Move up"
                     className="flex h-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition-colors hover:bg-white/10 active:scale-95"
                  >
                     <ChevronUp size={16} />
                  </button>
                  <span />
                  <button
                     onClick={() => nudgeActiveObject(-nudgeStep, 0)}
                     aria-label="Move left"
                     className="flex h-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition-colors hover:bg-white/10 active:scale-95"
                  >
                     <ChevronLeft size={16} />
                  </button>
                  <span className="flex h-9 items-center justify-center rounded-lg bg-white/5 font-mono text-[10px] text-slate-500">
                     {nudgeStep}px
                  </span>
                  <button
                     onClick={() => nudgeActiveObject(nudgeStep, 0)}
                     aria-label="Move right"
                     className="flex h-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition-colors hover:bg-white/10 active:scale-95"
                  >
                     <ChevronRight size={16} />
                  </button>
                  <span />
                  <button
                     onClick={() => nudgeActiveObject(0, nudgeStep)}
                     aria-label="Move down"
                     className="flex h-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition-colors hover:bg-white/10 active:scale-95"
                  >
                     <ChevronDown size={16} />
                  </button>
                  <span />
               </div>

               <p className="text-[10px] leading-relaxed text-slate-500">
                  Arrow keys move it too, and holding Shift moves it five steps at a time.
               </p>
            </div>
         )}
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
                  <button onClick={() => setMaskTool('select')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'select' ? 'bg-orange-500/20 border-orange-400 text-orange-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Move (V)"><MousePointer2 size={16} /></button>
                  <button onClick={() => setMaskTool('brush')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'brush' ? 'bg-green-500/20 border-green-400 text-green-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Brush (B)"><Brush size={16} /></button>
                  <button onClick={() => setMaskTool('pen')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'pen' ? 'bg-teal-500/20 border-teal-400 text-teal-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Pen (P)"><PenTool size={16} /></button>
                  <button onClick={() => setMaskTool('eraser')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'eraser' ? 'bg-red-500/20 border-red-400 text-red-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Eraser (E)"><Eraser size={16} /></button>
                  <button onClick={() => setMaskTool('circle')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'circle' ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Circle (C)"><Circle size={16} /></button>
                  <button onClick={() => setMaskTool('square')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'square' ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Square (S)"><Square size={16} /></button>
                  <button onClick={() => setMaskTool('triangle')} className={`p-2 rounded-xl border flex justify-center items-center ${maskTool === 'triangle' ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-white/5 border-white/10 text-slate-400'}`} title="Triangle (T)"><Triangle size={16} /></button>
               </div>

               <p className="text-[10px] text-slate-500">Keys: V move, B brush, P pen, E eraser, C circle, S square, T triangle.</p>

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
   textFontWeight: number;
   setTextFontWeight: (v: number) => void;
   /** Weights this font family really has */
   availableWeights: number[];
   familyHasItalic: boolean;
   textItalic: boolean;
   setTextItalic: (v: boolean) => void;
   textUnderline: boolean;
   setTextUnderline: (v: boolean) => void;
   textOverline: boolean;
   setTextOverline: (v: boolean) => void;
   textLineThrough: boolean;
   setTextLineThrough: (v: boolean) => void;
   textGradientEnabled: boolean;
   setTextGradientEnabled: (v: boolean) => void;
   textGradientColor: string;
   setTextGradientColor: (v: string) => void;
   textGradientStops: GradientStop[];
   setTextGradientStops: (v: GradientStop[]) => void;
   textGradientAngle: number;
   setTextGradientAngle: (v: number) => void;
   /** Seconds after the photo appears before this text shows up */
   textAppearAt: number;
   setTextAppearAt: (v: number) => void;
   /** Seconds the text stays on screen; 0 keeps it until the photo ends */
   textVisibleFor: number;
   setTextVisibleFor: (v: number) => void;
   frameIndex: number;
   frameCount: number;
   frameStartTime: number;
   frameEndTime: number;
   frameDuration: number;
   remainingDuration: number;
}

const TEXT_SWATCHES = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ec4899'];

/** Friendlier names than the raw numbers */
export interface GradientStop {
   color: string;
   /** 0 at the start of the letters, 1 at the end */
   pos: number;
}

/** Ready-made colour blends, in the order they read best on light photos */
const GRADIENT_PRESETS: { name: string; stops: GradientStop[] }[] = [
   { name: "Sunset", stops: [{ color: "#fbbf24", pos: 0 }, { color: "#f97316", pos: 0.5 }, { color: "#db2777", pos: 1 }] },
   { name: "Ocean", stops: [{ color: "#a5f3fc", pos: 0 }, { color: "#38bdf8", pos: 0.5 }, { color: "#1d4ed8", pos: 1 }] },
   { name: "Fire", stops: [{ color: "#fde047", pos: 0 }, { color: "#f97316", pos: 0.45 }, { color: "#b91c1c", pos: 1 }] },
   { name: "Gold", stops: [{ color: "#fff7cc", pos: 0 }, { color: "#f2c14e", pos: 0.45 }, { color: "#a16207", pos: 1 }] },
   { name: "Neon", stops: [{ color: "#22d3ee", pos: 0 }, { color: "#a855f7", pos: 0.55 }, { color: "#ec4899", pos: 1 }] },
   { name: "Mint", stops: [{ color: "#ecfeff", pos: 0 }, { color: "#5eead4", pos: 0.5 }, { color: "#0f766e", pos: 1 }] },
   { name: "Candy", stops: [{ color: "#fbcfe8", pos: 0 }, { color: "#f472b6", pos: 0.5 }, { color: "#7c3aed", pos: 1 }] },
   { name: "Steel", stops: [{ color: "#ffffff", pos: 0 }, { color: "#94a3b8", pos: 0.5 }, { color: "#1e293b", pos: 1 }] },
   { name: "Rainbow", stops: [{ color: "#ef4444", pos: 0 }, { color: "#f59e0b", pos: 0.25 }, { color: "#22c55e", pos: 0.5 }, { color: "#3b82f6", pos: 0.75 }, { color: "#a855f7", pos: 1 }] },
   { name: "Fade out", stops: [{ color: "#ffffff", pos: 0 }, { color: "#ffffff", pos: 0.45 }, { color: "#64748b", pos: 1 }] },
];
/**
 * Photoshop-style gradient strip: drag the markers to move colours, tap one to edit it,
 * double-tap the bar to add another.
 */
function GradientEditor({ stops, onChange, angle }: { stops: GradientStop[]; onChange: (next: GradientStop[]) => void; angle: number }) {
   const barRef = React.useRef<HTMLDivElement>(null);
   const [selected, setSelected] = React.useState(0);
   const [dragging, setDragging] = React.useState<number | null>(null);

   const ordered = [...stops].sort((a, b) => a.pos - b.pos);
   const preview = ordered.map(s => `${s.color} ${Math.round(s.pos * 100)}%`).join(", ");
   const safeIndex = Math.min(selected, stops.length - 1);
   const current = stops[safeIndex];

   const posFromEvent = (clientX: number) => {
      const box = barRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
   };

   React.useEffect(() => {
      if (dragging === null) return;
      const move = (e: PointerEvent) => {
         const pos = posFromEvent(e.clientX);
         if (pos === null) return;
         onChange(stops.map((s, i) => (i === dragging ? { ...s, pos: Math.round(pos * 100) / 100 } : s)));
      };
      const up = () => setDragging(null);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      return () => {
         window.removeEventListener('pointermove', move);
         window.removeEventListener('pointerup', up);
         window.removeEventListener('pointercancel', up);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [dragging, stops]);

   const addStopAt = (pos: number) => {
      // Take the colour the bar already shows there, so the look does not jump
      const before = [...ordered].reverse().find(s => s.pos <= pos) || ordered[0];
      onChange([...stops, { color: before.color, pos: Math.round(pos * 100) / 100 }]);
      setSelected(stops.length);
   };

   const updateCurrent = (patch: Partial<GradientStop>) => {
      onChange(stops.map((s, i) => (i === safeIndex ? { ...s, ...patch } : s)));
   };

   const removeCurrent = () => {
      if (stops.length <= 2) return;
      onChange(stops.filter((_, i) => i !== safeIndex));
      setSelected(0);
   };

   return (
      <div className="space-y-3.5">
         {/* Ready-made blends */}
         <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Ready-made</span>
            <div className="grid grid-cols-4 gap-1.5">
            {GRADIENT_PRESETS.map((preset) => {
               const swatch = preset.stops.map(s => `${s.color} ${Math.round(s.pos * 100)}%`).join(", ");
               const isActive = JSON.stringify(preset.stops) === JSON.stringify(stops);
               return (
                  <button
                     key={preset.name}
                     onClick={() => { onChange(preset.stops.map(s => ({ ...s }))); setSelected(0); }}
                     title={preset.name}
                     aria-pressed={isActive}
                     className={`group flex flex-col gap-1 rounded-lg p-1 transition-colors ${isActive ? 'bg-indigo-500/15' : 'hover:bg-white/5'}`}
                  >
                     <span
                        className={`block h-7 w-full rounded-md transition-transform group-hover:scale-[1.03] ${isActive
                           ? 'ring-2 ring-indigo-400'
                           : 'ring-1 ring-white/15'
                           }`}
                        style={{ background: `linear-gradient(90deg, ${swatch})` }}
                     />
                     <span className={`block truncate text-center text-[9px] font-semibold ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {preset.name}
                     </span>
                  </button>
               );
            })}
            </div>
         </div>

         {/* The strip, with a marker per colour */}
         <div className="relative pt-1 pb-4">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Your blend</span>
            <div
               ref={barRef}
               onDoubleClick={(e) => {
                  const pos = posFromEvent(e.clientX);
                  if (pos !== null) addStopAt(pos);
               }}
               title="Double-tap to add a colour"
               className="h-7 w-full rounded-md border border-white/10 cursor-copy"
               style={{ background: `linear-gradient(90deg, ${preview})` }}
            />
            {stops.map((stop, index) => (
               <button
                  key={index}
                  onPointerDown={(e) => {
                     e.preventDefault();
                     setSelected(index);
                     setDragging(index);
                  }}
                  title={`${stop.color.toUpperCase()} at ${Math.round(stop.pos * 100)}%`}
                  aria-label={`Colour ${index + 1} at ${Math.round(stop.pos * 100)} percent`}
                  className={`absolute top-[22px] h-9 w-3 -translate-x-1/2 touch-none rounded-sm border-2 transition-colors ${index === safeIndex
                     ? 'border-indigo-400 shadow-md shadow-indigo-500/30'
                     : 'border-white/70 hover:border-white'
                     }`}
                  style={{ left: `${stop.pos * 100}%`, backgroundColor: stop.color }}
               />
            ))}
         </div>

         {/* The colour that is selected */}
         <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
               Colour {safeIndex + 1} of {stops.length}
            </span>
            <div className="flex items-center gap-1">
               <button
                  onClick={() => addStopAt(0.5)}
                  title="Add another colour"
                  className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10"
               >
                  <Plus size={11} /> Add
               </button>
               <button
                  onClick={removeCurrent}
                  disabled={stops.length <= 2}
                  title={stops.length <= 2 ? "Keep at least two colours" : "Remove this colour"}
                  className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
               >
                  <Trash2 size={11} /> Remove
               </button>
            </div>
         </div>

         <div className="flex items-center gap-1.5 flex-wrap">
            {TEXT_SWATCHES.map((swatch) => (
               <button
                  key={swatch}
                  onClick={() => updateCurrent({ color: swatch })}
                  title={swatch.toUpperCase()}
                  aria-pressed={current?.color.toLowerCase() === swatch}
                  className={`h-5 w-5 rounded-md transition-transform hover:scale-110 active:scale-95 ${current?.color.toLowerCase() === swatch
                     ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#131824]'
                     : 'ring-1 ring-white/15'
                     }`}
                  style={{ backgroundColor: swatch }}
               />
            ))}
            <ColorPickerTrigger
               color={current?.color || "#ffffff"}
               onChange={(val: string) => updateCurrent({ color: val })}
               className="h-5 w-5 rounded-md border border-dashed border-slate-500 cursor-pointer transition active:scale-95 hover:border-slate-300 relative z-[9999]"
            />
         </div>

         <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Position</span>
               <span className="rounded border border-white/10 bg-[#181818] px-2 py-0.5 font-mono text-[10px] text-white">
                  {Math.round((current?.pos ?? 0) * 100)}%
               </span>
            </div>
            <input
               type="range" min="0" max="100" step="1"
               value={Math.round((current?.pos ?? 0) * 100)}
               onChange={(e) => updateCurrent({ pos: Number(e.target.value) / 100 })}
               aria-label="Position of the selected colour"
               className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
         </div>
      </div>
   );
}
const WEIGHT_NAMES: Record<number, string> = {
   100: "Thin",
   200: "Light",
   300: "Book",
   400: "Normal",
   500: "Medium",
   600: "Semi",
   700: "Bold",
   800: "Extra",
   900: "Black",
};

const formatSeconds = (value: number) => {
   const rounded = Math.round(value * 10) / 10;
   return (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)) + "s";
};

/** Seconds typed by hand: digits and one dot only, and an empty box counts as 0 */
function SecondsField({ label, value, max, placeholder, onCommit }: { label: string; value: number; max: number; placeholder?: string; onCommit: (v: number) => void }) {
   const [draft, setDraft] = React.useState<string>(value ? String(value) : "");

   React.useEffect(() => {
      setDraft(value ? String(value) : "");
   }, [value]);

   const commit = (rawValue: string) => {
      const parsed = rawValue.trim() === "" ? 0 : parseFloat(rawValue);
      const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      const capped = max > 0 ? Math.min(safe, Math.round(max * 10) / 10) : safe;
      onCommit(Math.round(capped * 10) / 10);
   };

   return (
      <label className="block">
         <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
         <span className="relative block">
            <input
               type="text"
               inputMode="decimal"
               value={draft}
               placeholder={placeholder || "0"}
               onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^[0-9]*[.]?[0-9]*$/.test(next)) setDraft(next);
               }}
               onBlur={() => commit(draft)}
               onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
               }}
               className="w-full rounded-lg border border-white/10 bg-[#1e2433] py-1.5 pl-2.5 pr-6 text-xs font-mono text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">s</span>
         </span>
      </label>
   );
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
   deleteActiveObject,
   textFontWeight,
   setTextFontWeight,
   availableWeights,
   familyHasItalic,
   textItalic,
   setTextItalic,
   textUnderline,
   setTextUnderline,
   textOverline,
   setTextOverline,
   textLineThrough,
   setTextLineThrough,
   textGradientEnabled,
   setTextGradientEnabled,
   textGradientColor,
   setTextGradientColor,
   textGradientStops,
   setTextGradientStops,
   textGradientAngle,
   setTextGradientAngle,
   textAppearAt,
   setTextAppearAt,
   textVisibleFor,
   setTextVisibleFor,
   frameIndex,
   frameCount,
   frameStartTime,
   frameEndTime,
   frameDuration,
   remainingDuration,
}: WaveTextTabProps) {
   // With something selected the fields edit that text; otherwise they set up the next one
   const isEditingSelection = !!activeMaskObjectId && maskTool === 'select';
   const isPlacing = maskTool === 'text';

   // Trying a font: apply it straight away, and put the old one back on the way out
   const fontBeforePreview = React.useRef<string | null>(null);
   const previewFont = (font: string | null) => {
      if (font) {
         if (fontBeforePreview.current === null) fontBeforePreview.current = textToolFontFamily;
         setTextToolFontFamily(font);
      } else if (fontBeforePreview.current !== null) {
         setTextToolFontFamily(fontBeforePreview.current);
         fontBeforePreview.current = null;
      }
   };

   return (
      <div className="p-4 space-y-4 min-w-0">
         {/* Title and history */}
         <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
               <Type size={14} className="text-indigo-400" />
               Text
            </span>
            <div className="flex items-center gap-1">
               <button
                  onClick={undoMask}
                  disabled={!canUndo}
                  title="Undo"
                  aria-label="Undo"
                  className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${canUndo
                     ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                     : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed'
                     }`}
               >
                  <Undo size={14} />
               </button>
               <button
                  onClick={redoMask}
                  disabled={!canRedo}
                  title="Redo"
                  aria-label="Redo"
                  className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${canRedo
                     ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                     : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed'
                     }`}
               >
                  <Redo size={14} />
               </button>
            </div>
         </div>

         {/* What a tap on the canvas does */}
         <div className="space-y-2">
            <div role="radiogroup" aria-label="Text tool" className="flex rounded-xl border border-white/10 bg-[#131824] p-1">
               {[
                  { id: 'select', label: 'Select', icon: MousePointer2 },
                  { id: 'text', label: 'Add text', icon: Type },
               ].map((tool) => {
                  const active = maskTool === tool.id;
                  return (
                     <button
                        key={tool.id}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMaskTool(tool.id as MaskTool)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${active
                           ? 'bg-indigo-500/20 text-indigo-200 shadow-sm'
                           : 'text-slate-400 hover:text-slate-200'
                           }`}
                     >
                        <tool.icon size={13} />
                        {tool.label}
                     </button>
                  );
               })}
            </div>
            <p className="px-0.5 text-[10px] leading-relaxed text-slate-500">
               {isPlacing
                  ? 'Tap the picture to drop your text there.'
                  : 'Tap a text on the picture to edit it, or drag it to move it.'}
            </p>
         </div>

         {/* Text settings */}
         <div className="space-y-5 bg-[#131824]/60 border border-white/10 p-3.5 rounded-2xl min-w-0">
            <div className="flex items-center justify-between gap-2">
               <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isEditingSelection ? 'Editing selected text' : 'Settings for new text'}
               </span>
               {isEditingSelection && deleteActiveObject && (
                  <button
                     onClick={deleteActiveObject}
                     title="Delete the selected text"
                     className="flex items-center gap-1 rounded-lg border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-400 transition-all hover:bg-orange-500/20 hover:text-orange-300"
                  >
                     <X size={12} />
                     Delete
                  </button>
               )}
            </div>

            {/* Words */}
            <div className="space-y-1.5">
               <label htmlFor="wave-text-content" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Words
               </label>
               <textarea
                  id="wave-text-content"
                  value={textToolContent}
                  onChange={(e) => setTextToolContent(e.target.value)}
                  placeholder="Type the words to show..."
                  rows={2}
                  className="w-full bg-[#1e2433] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-y min-h-[64px]"
               />
            </div>

            {/* Font: hovering a name (or holding it on touch) shows it on the picture right away */}
            <div className="space-y-1.5 relative z-50">
               <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Font</span>
               <FontPicker
                  value={textToolFontFamily}
                  selectedText={textToolContent}
                  onHover={previewFont}
                  onChange={(font) => {
                     fontBeforePreview.current = null;
                     setTextToolFontFamily(font);
                  }}
                  className="w-full text-sm font-medium z-50"
                  triggerSurfaceClass="bg-[#1e2433] border-white/10 rounded-lg"
                  menuSurfaceClass="bg-[#131824] border-white/10"
               />
            </div>

            {/* Weight: only what this family actually provides */}
            <div className="space-y-1.5">
               <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thickness</span>
               <div role="radiogroup" aria-label="Thickness" className="flex flex-wrap gap-1">
                  {availableWeights.map((weight) => {
                     const active = textFontWeight === weight;
                     return (
                        <button
                           key={weight}
                           role="radio"
                           aria-checked={active}
                           onClick={() => setTextFontWeight(weight)}
                           title={WEIGHT_NAMES[weight] || String(weight)}
                           style={{ fontWeight: weight }}
                           className={`rounded-md px-2 py-1 text-[11px] transition-colors ${active
                              ? 'bg-indigo-500/20 text-indigo-200'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                        >
                           {WEIGHT_NAMES[weight] || weight}
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* Italic and the three rules */}
            <div className="space-y-1.5">
               <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Style</span>
               <div className="flex gap-1">
                  {[
                     { key: 'italic', label: 'I', title: familyHasItalic ? 'Italic' : 'This font has no italic', className: 'italic', on: textItalic, toggle: () => setTextItalic(!textItalic), disabled: !familyHasItalic },
                     { key: 'underline', label: 'U', title: 'Underline', className: 'underline', on: textUnderline, toggle: () => setTextUnderline(!textUnderline), disabled: false },
                     { key: 'overline', label: 'O', title: 'Line above', className: 'overline', on: textOverline, toggle: () => setTextOverline(!textOverline), disabled: false },
                     { key: 'linethrough', label: 'S', title: 'Line through', className: 'line-through', on: textLineThrough, toggle: () => setTextLineThrough(!textLineThrough), disabled: false },
                  ].map((style) => (
                     <button
                        key={style.key}
                        onClick={style.toggle}
                        disabled={style.disabled}
                        title={style.title}
                        aria-pressed={style.on}
                        className={`h-8 flex-1 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${style.className} ${style.on
                           ? 'bg-indigo-500/20 text-indigo-200'
                           : 'bg-white/5 text-slate-400 hover:text-slate-200'
                           }`}
                     >
                        {style.label}
                     </button>
                  ))}
               </div>
            </div>

            {/* Colour: quick swatches plus a full picker */}
            <div className="space-y-2">
               <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Colour</span>
               <div className="flex items-center gap-1.5 flex-wrap pb-1">
                  {TEXT_SWATCHES.map((swatch) => {
                     const active = textToolColor.toLowerCase() === swatch;
                     return (
                        <button
                           key={swatch}
                           onClick={() => setTextToolColor(swatch)}
                           title={swatch.toUpperCase()}
                           aria-label={'Use ' + swatch.toUpperCase()}
                           aria-pressed={active}
                           className={`h-6 w-6 rounded-lg transition-transform hover:scale-110 active:scale-95 ${active
                              ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#131824]'
                              : 'ring-1 ring-white/15'
                              }`}
                           style={{ backgroundColor: swatch }}
                        />
                     );
                  })}
                  <ColorPickerTrigger
                     color={textToolColor}
                     onChange={(val: string) => setTextToolColor(val)}
                     className="h-6 w-6 rounded-lg border border-dashed border-slate-500 shadow-inner cursor-pointer transition active:scale-95 hover:border-slate-300 relative z-[9999]"
                  />
               </div>

               {/* Second colour blended across the letters */}
               <div className="mt-1 rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                     <span className="text-[11px] font-bold text-slate-300">Colour blend</span>
                     <button
                        type="button"
                        role="switch"
                        aria-checked={textGradientEnabled}
                        aria-label="Colour blend"
                        onClick={() => setTextGradientEnabled(!textGradientEnabled)}
                        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${textGradientEnabled ? 'bg-indigo-500' : 'bg-slate-800'}`}
                     >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${textGradientEnabled ? 'left-4.5' : 'left-0.5'}`} />
                     </button>
                  </div>

                  {textGradientEnabled && (
                     <>
                        <GradientEditor
                           stops={textGradientStops}
                           onChange={setTextGradientStops}
                           angle={textGradientAngle}
                        />
                        <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                           <div
                              className="h-5 rounded-md border border-white/10"
                              style={{
                                 background: `linear-gradient(${textGradientAngle}deg, ${[...textGradientStops]
                                    .sort((a, b) => a.pos - b.pos)
                                    .map(s => s.color + ' ' + Math.round(s.pos * 100) + '%')
                                    .join(', ')})`,
                              }}
                              title="How the blend will sit on the letters"
                           />
                           <FilterSlider
                              label="BLEND ANGLE"
                              min={0} max={360} step={5}
                              value={textGradientAngle}
                              onChange={(val: number) => setTextGradientAngle(val)}
                           />
                        </div>
                     </>
                  )}
               </div>
            </div>

            {/* Size and rotation */}
            <div className="space-y-1">
               <FilterSlider
                  label="SIZE"
                  min={10} max={200} step={1}
                  value={maskBrushSize}
                  onChange={(val: number) => setMaskBrushSize(val)}
               />
               <div>
                  <FilterSlider
                     label="TILT"
                     min={0} max={360} step={1}
                     value={maskRotation}
                     onChange={(val: number) => setMaskRotation(val)}
                  />
                  <div className="mt-1 flex items-center gap-1">
                     {[0, 90, 180, 270].map((angle) => (
                        <button
                           key={angle}
                           onClick={() => setMaskRotation(angle)}
                           className={`flex-1 rounded-md py-1 text-[10px] font-bold transition-colors ${maskRotation === angle
                              ? 'bg-indigo-500/20 text-indigo-200'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                        >
                           {angle}°
                        </button>
                     ))}
                     <button
                        onClick={() => setMaskRotation(0)}
                        title="Straighten"
                        aria-label="Straighten"
                        className="rounded-md bg-white/5 p-1 text-slate-400 transition-colors hover:text-slate-200"
                     >
                        <RotateCcw size={12} />
                     </button>
                  </div>
               </div>
            </div>

            {/* Ride the waves or stay still */}
            <div className="pt-2 border-t border-white/10">
               <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                     <Waves size={14} className={textToolAffectedByWaves ? 'text-indigo-400' : 'text-slate-500'} />
                     <span className="text-xs font-bold text-slate-300">Ripple with the waves</span>
                  </div>
                  <button
                     type="button"
                     role="switch"
                     aria-checked={textToolAffectedByWaves}
                     aria-label="Ripple with the waves"
                     onClick={() => setTextToolAffectedByWaves(!textToolAffectedByWaves)}
                     className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${textToolAffectedByWaves ? 'bg-indigo-500' : 'bg-slate-800'}`}
                  >
                     <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${textToolAffectedByWaves ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
               </div>
               <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  {textToolAffectedByWaves
                     ? 'The text bends along with the picture.'
                     : 'The text stays sharp and still on top of the picture.'}
               </p>
            </div>

            {/* When the text comes and goes, counted from the moment this photo starts */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
               <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                     <Clock size={12} className="text-indigo-400" />
                     Timing
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                     Photo {frameIndex + 1}/{frameCount} · {formatSeconds(frameStartTime)}–{formatSeconds(frameEndTime)}
                  </span>
               </div>

               <div className="grid grid-cols-2 gap-2">
                  <SecondsField
                     label="Appears after"
                     value={textAppearAt}
                     max={frameDuration}
                     onCommit={setTextAppearAt}
                  />
                  <SecondsField
                     label="Stays for"
                     value={textVisibleFor}
                     max={remainingDuration}
                     placeholder="whole photo"
                     onCommit={setTextVisibleFor}
                  />
               </div>

               <div className="flex flex-wrap gap-1">
                  {[
                     { label: 'Quarter', value: frameDuration / 4 },
                     { label: 'Third', value: frameDuration / 3 },
                     { label: 'Half', value: frameDuration / 2 },
                     { label: 'Whole photo', value: 0 },
                     { label: 'Rest of video', value: Math.max(0, remainingDuration - textAppearAt) },
                  ].map((preset) => {
                     const active = Math.abs(textVisibleFor - Math.round(preset.value * 10) / 10) < 0.05;
                     return (
                        <button
                           key={preset.label}
                           onClick={() => setTextVisibleFor(Math.round(preset.value * 10) / 10)}
                           className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${active
                              ? 'bg-indigo-500/20 text-indigo-200'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                        >
                           {preset.label}
                        </button>
                     );
                  })}
               </div>

               <p className="text-[10px] leading-relaxed text-slate-500">
                  {textAppearAt > 0 || textVisibleFor > 0
                     ? "Shows " + formatSeconds(frameStartTime + textAppearAt) + " to " +
                       formatSeconds(textVisibleFor > 0
                          ? Math.min(frameStartTime + textAppearAt + textVisibleFor, frameStartTime + remainingDuration)
                          : frameEndTime) + " in the finished video."
                     : "Shows for this whole photo. Leave “Stays for” empty to keep it until the photo ends."}
               </p>
            </div>
         </div>

         {/* Start over */}
         <button
            onClick={clearMask}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-[11px] font-bold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
         >
            <Trash2 size={13} />
            Remove all text and masks
         </button>
      </div>
   );
}
