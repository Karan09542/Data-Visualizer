import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Palette, Sun, Moon, Check, Sparkles, ChevronDown, X } from "lucide-react";
import {
  ColorVariationMode,
  generateTints,
  generateShades,
  harmonizeFunctions,
} from "./colorVariations";
import { COLORS, MathFunction } from "./mathTypes";
import { PortalColorPicker } from "./PortalColorPicker";

interface ColorVariationMenuProps {
  mode: ColorVariationMode;
  setMode: (mode: ColorVariationMode) => void;
  baseColor?: string;
  setBaseColor: (color: string) => void;
  functions: MathFunction[];
  setFunctions: React.Dispatch<React.SetStateAction<MathFunction[]>>;
}

export const ColorVariationMenu: React.FC<ColorVariationMenuProps> = ({
  mode,
  setMode,
  baseColor,
  setBaseColor,
  functions,
  setFunctions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const effectiveBaseColor = baseColor || (functions[0]?.color) || COLORS[0];

  const currentPalette =
    mode === "tint"
      ? generateTints(effectiveBaseColor)
      : mode === "shade"
        ? generateShades(effectiveBaseColor)
        : COLORS;

  // Calculate coordinates when open
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      const trigger = containerRef.current;
      const popover = popoverRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverWidth = popover ? popover.offsetWidth : 270;
      const popoverHeight = popover ? popover.offsetHeight : 340;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = triggerRect.bottom + 6;
      let left = triggerRect.left;

      if (top + popoverHeight > viewportHeight - 10) {
        const spaceAbove = triggerRect.top - 6 - popoverHeight;
        if (spaceAbove > 10) {
          top = spaceAbove;
        } else {
          top = Math.max(10, viewportHeight - popoverHeight - 10);
        }
      }

      if (left + popoverWidth > viewportWidth - 10) {
        left = Math.max(10, viewportWidth - popoverWidth - 10);
      }
      if (left < 10) left = 10;

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleHarmonize = () => {
    if (mode === "none") return;
    setFunctions((prev) => harmonizeFunctions(prev, mode, effectiveBaseColor));
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Segmented Control for 1-click switching */}
      <div
        role="radiogroup"
        aria-label="Color Variation Mode"
        className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/50 dark:border-slate-700/60 shadow-2xs"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "none"}
          onClick={() => setMode("none")}
          title="None: Assigns random/cyclic colors from default palette"
          className={`px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold rounded transition-all shrink-0 ${
            mode === "none"
              ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          None
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={mode === "tint"}
          onClick={() => setMode("tint")}
          title="Tint: New, duplicated or inserted functions receive lighter tints of the same color"
          className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold rounded transition-all shrink-0 ${
            mode === "tint"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Sun size={11} className={mode === "tint" ? "text-amber-200" : ""} />
          <span>Tint</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={mode === "shade"}
          onClick={() => setMode("shade")}
          title="Shade: New, duplicated or inserted functions receive darker shades of the same color"
          className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold rounded transition-all shrink-0 ${
            mode === "shade"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Moon size={11} className={mode === "shade" ? "text-indigo-200" : ""} />
          <span>Shade</span>
        </button>

        {/* Dropdown trigger for extra palette settings */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`ml-0.5 p-1 rounded transition-colors ${
            isOpen
              ? "bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
          title="Color Settings & Palette Swatches"
          aria-expanded={isOpen}
        >
          <ChevronDown
            size={11}
            className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Expanded Popover portal */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className="w-72 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-2.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Palette size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Color Variation Option
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider ${
                    mode === "tint"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                      : mode === "shade"
                        ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {mode}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              When you duplicate a function, insert above/below, or add a new input,
              new functions will have the selected color tint or shade.
            </p>

            {/* Mode Selection Cards */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setMode("none")}
                className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-all ${
                  mode === "none"
                    ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs"
                    : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px]">None (Random / Cycle)</span>
                  <span className="text-[10px] text-slate-400">Cycles distinct rainbow colors (current behaviour)</span>
                </div>
                {mode === "none" && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setMode("tint")}
                className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-all ${
                  mode === "tint"
                    ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs"
                    : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Sun size={12} className="text-amber-500" /> Tint (Lighter variations)
                  </span>
                  <span className="text-[10px] text-slate-400">Keeps the same color with progressive tints</span>
                </div>
                {mode === "tint" && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setMode("shade")}
                className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-all ${
                  mode === "shade"
                    ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs"
                    : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Moon size={12} className="text-indigo-400" /> Shade (Darker variations)
                  </span>
                  <span className="text-[10px] text-slate-400">Keeps the same color with progressive shades</span>
                </div>
                {mode === "shade" && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            </div>

            {/* Swatches preview */}
            {mode !== "none" && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Palette Preview ({mode}):
                  </span>
                  <button
                    ref={pickerTriggerRef}
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 shadow-2xs"
                      style={{ backgroundColor: effectiveBaseColor }}
                    />
                    <span>Change base</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 overflow-x-auto">
                  {currentPalette.map((col, idx) => (
                    <div
                      key={idx}
                      className="w-5 h-5 rounded-md border border-slate-300/60 dark:border-slate-600/60 shrink-0 shadow-2xs flex items-center justify-center text-[8px] font-bold text-white drop-shadow-sm"
                      style={{ backgroundColor: col }}
                      title={`Step ${idx}: ${col}`}
                    >
                      {idx === 0 && "•"}
                    </div>
                  ))}
                </div>

                {/* Base Color presets */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-slate-400 mr-0.5">Presets:</span>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBaseColor(c)}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        effectiveBaseColor === c
                          ? "scale-125 ring-2 ring-blue-500"
                          : "hover:scale-110 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                      title={`Set base to ${c}`}
                    />
                  ))}
                </div>

                {/* Harmonize Button */}
                {functions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleHarmonize}
                    className="mt-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-[11px] font-medium transition-all"
                    title="Apply this tint/shade progression to all currently existing functions"
                  >
                    <Sparkles size={12} />
                    <span>Apply to all {functions.length} functions</span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Portal Color Picker for custom base color */}
      {showColorPicker && (
        <PortalColorPicker
          isOpen={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          color={effectiveBaseColor}
          onChange={(newColor) => {
            setBaseColor(newColor);
          }}
          title="Choose Base Color for Tint / Shade"
          triggerEl={pickerTriggerRef.current}
        />
      )}
    </div>
  );
};
