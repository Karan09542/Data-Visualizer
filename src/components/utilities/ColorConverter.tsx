import React, { useState, useEffect } from "react";
import { Palette, Copy, Check } from "lucide-react";
import { HexColorPicker } from "react-colorful";

// Helper functions for color conversion
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const ColorConverter = () => {
  const [color, setColor] = useState("#3b82f6");
  const [copied, setCopied] = useState<string | null>(null);

  const rgb = hexToRgb(color);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;

  const colorFormats = [
    { label: "HEX", value: color.toUpperCase() },
    { label: "RGB", value: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "" },
    { label: "HSL", value: hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : "" },
  ];

  const copyToClipboard = async (content: string, format: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-pink-200 dark:border-pink-800/50">
          <Palette size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Color Converter
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Pick a color to instantly get its HEX, RGB, and HSL values.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
        {/* Color Picker */}
        <div className="flex flex-col items-center gap-4 bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <HexColorPicker color={color} onChange={setColor} />
          <div className="flex items-center gap-2 mt-2 w-full">
            <div
              className="w-8 h-8 rounded-full shadow-inner border border-slate-200 dark:border-slate-700"
              style={{ backgroundColor: color }}
            />
            <input
              type="text"
              value={color.toUpperCase()}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-F]{0,6}$/i.test(val)) setColor(val);
              }}
              className="flex-1 bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 text-sm font-mono px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500/50 uppercase"
            />
          </div>
        </div>

        {/* Formats List */}
        <div className="flex-1 w-full flex flex-col gap-4">
          {colorFormats.map((format) => (
            <div key={format.label} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {format.label}
                </span>
                <button
                  onClick={() => copyToClipboard(format.value, format.label)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {copied === format.label ? (
                    <><Check size={12} className="text-pink-500" /> Copied</>
                  ) : (
                    <><Copy size={12} /> Copy</>
                  )}
                </button>
              </div>
              <div className="font-mono text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0d1117] px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
                {format.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
