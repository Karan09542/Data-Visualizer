import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Type } from 'lucide-react';
import { loadGoogleFont, FONTS } from '../utils/fontRegistry';
import { TYPOGRAPHY_PRESETS as PRESETS, Preset } from '../utils/typographyPresets';
import { usePreviewHold } from './image-workspace/hooks/usePreviewHold';

/**
 * Whether a preset's typeface can actually render Devanagari.
 *
 * Half of these are Latin-only, and a Hindi layer set in one of them renders as empty boxes. The
 * badge says so before the preset is applied rather than after.
 */
const SCRIPT_BY_FAMILY = new Map(FONTS.map(f => [f.fontFamily, f.supportsHindi]));

interface TypographyPresetsProps {
  onApplyPreset: (props: any) => void;
  /**
   * Called with a preset while it is hovered or held, and with null on release. A preset changes
   * seven properties at once, so its name says very little - seeing it on the actual words is the
   * only honest description.
   */
  onPreviewPreset?: (props: any | null) => void;
}

export function TypographyPresets({ onApplyPreset, onPreviewPreset }: TypographyPresetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { bind, stop, consumeHoldClick } = usePreviewHold<Preset>({
    preview: (preset) => {
      // Without the webfont the preview silently falls back to a system face, which is the one
      // thing about a type preset the user most needs to see.
      loadGoogleFont(preset.props.fontFamily);
      onPreviewPreset?.(preset.props);
    },
    revert: () => onPreviewPreset?.(null)
  });

  useEffect(() => { if (!isOpen) stop(); }, [isOpen, stop]);

  // Each row is set in its own typeface, which only means anything once that face has arrived.
  // Done on open rather than at mount so a user who never opens the menu never pays for it.
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || preloadedRef.current) return;
    preloadedRef.current = true;
    Object.values(PRESETS).flat().forEach(preset => loadGoogleFont(preset.props.fontFamily));
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleApply = (preset: Preset) => {
    // A hold was a request to look, not to choose.
    if (consumeHoldClick()) return;
    stop();
    loadGoogleFont(preset.props.fontFamily);
    onApplyPreset(preset.props);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors bg-slate-100 dark:bg-[#1e1e1e] hover:bg-slate-200 dark:hover:bg-[#2c2c2c] border border-slate-200 dark:border-[#3a3a3a] text-slate-600 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-white"
      >
        <Type size={12} />
        Presets
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 rounded-lg shadow-2xl z-50 overflow-hidden text-left flex flex-col max-h-80 animate-in fade-in zoom-in-95 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#3A3A3A]">
          <div className="overflow-y-auto no-scrollbar py-1">
            {Object.entries(PRESETS).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-3 py-1 text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-[#6A6A6A] bg-slate-50 dark:bg-[#111]">
                  {category}
                </div>
                {items.map(preset => (
                  <button
                    key={preset.name}
                    {...(onPreviewPreset ? bind(preset) : {})}
                    title={preset.hint}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-blue-500/10 dark:hover:bg-blue-600/20 active:bg-blue-500/20 dark:active:bg-blue-600/40"
                    onClick={() => handleApply(preset)}
                  >
                    {/* The name is set in the preset's own face, so the list previews itself. */}
                    <span
                      className="flex-1 min-w-0 truncate text-[13px] leading-tight"
                      style={{ fontFamily: preset.props.fontFamily }}
                    >
                      {preset.name}
                    </span>
                    <span
                      title={SCRIPT_BY_FAMILY.get(preset.props.fontFamily)
                        ? 'Supports Hindi and English'
                        : 'Latin only - Devanagari will not render'}
                      className={`shrink-0 w-5 h-4 flex items-center justify-center rounded text-[9px] font-bold border ${SCRIPT_BY_FAMILY.get(preset.props.fontFamily)
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-slate-400 dark:text-slate-500 border-slate-300/50 dark:border-white/10'}`}
                    >
                      {SCRIPT_BY_FAMILY.get(preset.props.fontFamily) ? 'अ' : 'A'}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
