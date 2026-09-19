import React from 'react';
import { Check, Droplets, Eye, Hand, ImageIcon, Loader2, Move, RotateCcw, RotateCw, Scan, SlidersHorizontal, Sparkles } from 'lucide-react';
import { PanelSection, RangeSlider, ToggleSwitch } from '../shared/PanelPrimitives';
import type { BlurStudioApi } from '../../hooks/useBlurStudio';
import type { BlurType } from '../../services/image/blurStudio';

/**
 * Blur Studio's panel: pick a kind of blur, shape it on the canvas or with the sliders, compare,
 * apply. Everything it shows comes from `useBlurStudio`.
 */

const MODES: { id: BlurType; label: string; caption: string }[] = [
  { id: 'gaussian', label: 'Gaussian', caption: 'Even, all over' },
  { id: 'radial', label: 'Iris', caption: 'Sharp circle' },
  { id: 'linear', label: 'Tilt-shift', caption: 'Sharp band' },
];

/** A small picture of each blur: what stays sharp, and what goes soft. */
const ModeGlyph: React.FC<{ mode: BlurType; active: boolean }> = ({ mode, active }) => {
  const id = `blur-glyph-${mode}`;
  const line = active ? '#ffffff' : 'currentColor';
  return (
    <svg viewBox="0 0 48 32" className="w-12 h-8" aria-hidden="true">
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect x="1" y="1" width="46" height="30" rx="5" fill="none" stroke={line} strokeOpacity="0.35" />
      {/* The same little scene each time, blurred where the mode blurs it. */}
      <g filter={mode === 'gaussian' ? `url(#${id})` : undefined} opacity="0.9">
        <circle cx="14" cy="12" r="4" fill={active ? '#fde68a' : '#f59e0b'} />
        <path d="M4 27 L16 17 L24 23 L32 14 L44 27 Z" fill={active ? '#bfdbfe' : '#60a5fa'} />
      </g>
      {mode === 'radial' && (
        <>
          <circle cx="24" cy="16" r="8" fill="none" stroke={line} strokeWidth="1.4" />
          <circle cx="24" cy="16" r="12" fill="none" stroke={line} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.8" />
          <circle cx="24" cy="16" r="1.6" fill={line} />
        </>
      )}
      {mode === 'linear' && (
        <>
          <line x1="2" y1="13" x2="46" y2="13" stroke={line} strokeWidth="1.4" />
          <line x1="2" y1="19" x2="46" y2="19" stroke={line} strokeWidth="1.4" />
          <line x1="2" y1="9" x2="46" y2="9" stroke={line} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.8" />
          <line x1="2" y1="23" x2="46" y2="23" stroke={line} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.8" />
        </>
      )}
    </svg>
  );
};

/** One line of "how to" for the on-canvas controls. */
const Tip: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <li className="flex items-start gap-2">
    <span className="mt-px shrink-0 text-blue-500 dark:text-blue-400">{icon}</span>
    <span>{children}</span>
  </li>
);

/** A dashed or solid sample of the line the tip talks about. */
const LineSample: React.FC<{ dashed?: boolean; round?: boolean }> = ({ dashed, round }) => (
  <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" aria-hidden="true">
    {round
      ? <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray={dashed ? '2 2' : undefined} />
      : <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.8" strokeDasharray={dashed ? '2.5 2' : undefined} />}
  </svg>
);

const ANGLE_PRESETS = [0, 45, 90, -45];

export const BlurStudioTab: React.FC<{ studio: BlurStudioApi }> = ({ studio }) => {
  const {
    activeBlurType, setActiveBlurType,
    blurAmount, setBlurAmount,
    focusSize, setFocusSize, radialFeather, setRadialFeather,
    bandWidth, setBandWidth, bandAngle, setBandAngle, linearFeather, setLinearFeather,
    hasTarget, targetName, hasSelection, limitToSelection, setLimitToSelection,
    comparing, setComparing, previewPaused, isApplying, applyBlur, resetBlur,
  } = studio;

  const angleDeg = Math.round((bandAngle * 180) / Math.PI);
  // Holding Compare shows the image as it is; letting go anywhere brings the preview back.
  const compareProps = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); setComparing(true); },
    onPointerUp: () => setComparing(false),
    onPointerLeave: () => setComparing(false),
    onPointerCancel: () => setComparing(false),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') setComparing(true); },
    onKeyUp: () => setComparing(false),
  };

  if (!hasTarget) {
    return (
      <div className="p-4 text-slate-700 dark:text-[#C0C0C0] font-sans">
        <div className="flex flex-col items-center text-center gap-3 px-4 py-10 rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/10 text-blue-500">
            <Droplets size={22} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-800 dark:text-white">Pick an image to blur</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              Click an image on the canvas. You will see the blur on it as you adjust, before anything is applied.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full text-slate-700 dark:text-[#C0C0C0] font-sans">
      <div className="p-4 space-y-4 flex-1">
        {/* ── Which image ── */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
          <span className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-500 shrink-0">
            <ImageIcon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Blurring</p>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-white truncate">{targetName}</p>
          </div>
          {previewPaused
            ? <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Applied</span>
            : <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">Preview</span>}
        </div>

        {/* ── Kind of blur ── */}
        <div role="radiogroup" aria-label="Blur type" className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5">
          {MODES.map((m) => {
            const on = activeBlurType === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setActiveBlurType(m.id)}
                className={`flex flex-col items-center gap-1 pt-2 pb-1.5 rounded-lg transition-all active:scale-[0.97] cursor-pointer ${on
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`}
              >
                <ModeGlyph mode={m.id} active={on} />
                <span className="text-[11px] font-semibold leading-none">{m.label}</span>
                <span className={`text-[9px] leading-none ${on ? 'text-blue-100' : 'text-slate-400 dark:text-zinc-500'}`}>{m.caption}</span>
              </button>
            );
          })}
        </div>

        {/* ── How to shape it on the canvas ── */}
        {activeBlurType !== 'gaussian' && (
          <ul className="space-y-1.5 px-3 py-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-500/[0.06] border border-blue-100 dark:border-blue-500/15 text-[10.5px] leading-snug text-slate-600 dark:text-zinc-300">
            {activeBlurType === 'radial' ? (
              <>
                <Tip icon={<Move size={13} />}>Drag the centre, or anywhere on the image, to move the sharp spot.</Tip>
                <Tip icon={<LineSample round />}>Drag the solid ring to size it.</Tip>
                <Tip icon={<LineSample round dashed />}>Drag the dashed ring to soften its edge.</Tip>
              </>
            ) : (
              <>
                <Tip icon={<Move size={13} />}>Drag the centre, or anywhere on the image, to move the band.</Tip>
                <Tip icon={<RotateCw size={13} />}>Drag the round knob to turn it. Hold Shift to snap.</Tip>
                <Tip icon={<LineSample />}>Drag a solid line to set the band's width.</Tip>
                <Tip icon={<LineSample dashed />}>Drag a dashed line to soften its edges.</Tip>
              </>
            )}
          </ul>
        )}

        {/* ── Settings ── */}
        <PanelSection icon={<SlidersHorizontal size={14} />} title="Adjust">
          <div className="space-y-4">
            <RangeSlider
              label="Strength"
              valueDisplay={blurAmount}
              displayUnit="px"
              min={0}
              max={100}
              step={1}
              value={blurAmount}
              onChange={(e) => setBlurAmount(Number(e.target.value))}
            />

            {activeBlurType === 'radial' && (
              <>
                <RangeSlider
                  label="Sharp area"
                  valueDisplay={Math.round(focusSize * 100)}
                  displayUnit="%"
                  min={2}
                  max={90}
                  step={1}
                  value={Math.round(focusSize * 100)}
                  onChange={(e) => setFocusSize(Number(e.target.value) / 100)}
                />
                <RangeSlider
                  label="Softness"
                  valueDisplay={Math.round(radialFeather * 100)}
                  displayUnit="%"
                  min={1}
                  max={80}
                  step={1}
                  value={Math.round(radialFeather * 100)}
                  onChange={(e) => setRadialFeather(Number(e.target.value) / 100)}
                />
              </>
            )}

            {activeBlurType === 'linear' && (
              <>
                <RangeSlider
                  label="Band width"
                  valueDisplay={Math.round(bandWidth * 200)}
                  displayUnit="%"
                  min={1}
                  max={120}
                  step={1}
                  value={Math.round(bandWidth * 200)}
                  onChange={(e) => setBandWidth(Number(e.target.value) / 200)}
                />
                <RangeSlider
                  label="Softness"
                  valueDisplay={Math.round(linearFeather * 100)}
                  displayUnit="%"
                  min={1}
                  max={60}
                  step={1}
                  value={Math.round(linearFeather * 100)}
                  onChange={(e) => setLinearFeather(Number(e.target.value) / 100)}
                />
                <div>
                  <RangeSlider
                    label="Angle"
                    valueDisplay={angleDeg}
                    displayUnit="°"
                    min={-180}
                    max={180}
                    step={1}
                    value={angleDeg}
                    onChange={(e) => setBandAngle((Number(e.target.value) * Math.PI) / 180)}
                  />
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {ANGLE_PRESETS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setBandAngle((a * Math.PI) / 180)}
                        className={`py-1 text-[10px] font-semibold rounded-md border transition-colors cursor-pointer ${angleDeg === a
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                      >
                        {a}°
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </PanelSection>

        {/* ── Selection ── */}
        {hasSelection && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <Scan size={14} className="text-violet-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-white">Only inside selection</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">Blur the selected area, keep the rest.</p>
              </div>
            </div>
            <ToggleSwitch checked={limitToSelection} onChange={setLimitToSelection} showState={false} />
          </div>
        )}

        {previewPaused && (
          <p className="flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-zinc-400">
            <Sparkles size={13} className="text-emerald-500 shrink-0" />
            Blur applied. Change any setting to add more on top.
          </p>
        )}
      </div>

      {/* ── Actions, kept in reach at the bottom ── */}
      <div className="sticky bottom-0 p-3 flex items-center gap-2 bg-white/95 dark:bg-[#111]/95 backdrop-blur border-t border-slate-200 dark:border-white/10">
        <button
          type="button"
          title="Hold to see the image without the blur"
          aria-pressed={comparing}
          disabled={previewPaused}
          {...compareProps}
          className={`h-9 px-3 flex items-center gap-1.5 rounded-lg border text-[11px] font-semibold select-none touch-none transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${comparing
            ? 'bg-slate-800 border-slate-700 text-white dark:bg-white dark:text-slate-900'
            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'}`}
        >
          {comparing ? <Eye size={14} /> : <Hand size={14} />}
          Compare
        </button>
        <button
          type="button"
          title="Back to the default settings"
          onClick={resetBlur}
          className="h-9 w-9 flex items-center justify-center rounded-lg border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Reset settings"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={() => applyBlur()}
          disabled={isApplying || previewPaused || blurAmount === 0}
          className="flex-1 h-9 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isApplying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isApplying ? 'Applying…' : 'Apply blur'}
        </button>
      </div>
    </div>
  );
};
