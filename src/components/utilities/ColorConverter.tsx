import React, { useEffect, useMemo, useState } from "react";
import { Palette, Copy, Check, Pipette, Shuffle, Code2, ImageDown, Download } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { getColorSync } from "colorthief";
import { useClipboardImages } from "./useQuickUtilsPaste";

type Rgb = { r: number; g: number; b: number };

// The seven colours of the rainbow, as most people learn them
const BASIC_COLORS = [
  { name: "Red", hex: "#FF0000" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Green", hex: "#008000" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Indigo", hex: "#4B0082" },
  { name: "Violet", hex: "#8F00FF" },
];

// 0% is the colour itself, then it moves step by step towards white (tints) or black (shades)
const MIX_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

// Helper functions for color conversion
const hexToRgb = (hex: string): Rgb | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = ({ r, g, b }: Rgb) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Accepts "#abc", "abc", "#aabbcc" or "aabbcc" and returns "#AABBCC", or null if it isn't a colour yet */
const normalizeHex = (value: string) => {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return ("#" + raw.split("").map((c) => c + c).join("")).toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return ("#" + raw).toUpperCase();
  return null;
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

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

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: Math.round(max === 0 ? 0 : (d / max) * 100), v: Math.round(max * 100) };
};

const rgbToCmyk = (r: number, g: number, b: number) => {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const part = (v: number) => Math.round(((1 - v / 255 - k) / (1 - k)) * 100);
  return { c: part(r), m: part(g), y: part(b), k: Math.round(k * 100) };
};

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});

/** Picks black or white text, whichever reads better on the colour */
const readableText = ({ r, g, b }: Rgb) => {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.4 ? "#0f172a" : "#ffffff";
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

const cardClass =
  "bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm";
const sectionTitleClass =
  "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const PNG_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const PNG_MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

/** Draws the base colour with its tint and shade rows onto one image */
const drawScaleImage = (base: string, tints: { step: number; hex: string }[], shades: { step: number; hex: string }[]) => {
  const width = 1200;
  const padding = 48;
  const gap = 12;
  const inner = width - padding * 2;
  const bannerH = 120;
  const titleH = 32;
  const tileH = 96;
  const labelH = 44;
  const sectionGap = 32;
  const height = padding + bannerH + (sectionGap + titleH + tileH + labelH) * 2 + padding;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const fillRound = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  let y = padding;

  // Base colour banner
  const baseRgb = hexToRgb(base) ?? BLACK;
  fillRound(padding, y, inner, bannerH, 16, base);
  ctx.fillStyle = readableText(baseRgb);
  ctx.textBaseline = "top";
  ctx.font = `600 14px ${PNG_FONT}`;
  ctx.fillText("BASE COLOUR", padding + 24, y + 22);
  ctx.textBaseline = "bottom";
  ctx.font = `700 36px ${PNG_MONO}`;
  ctx.fillText(base, padding + 24, y + bannerH - 20);
  ctx.textAlign = "right";
  ctx.font = `500 16px ${PNG_FONT}`;
  ctx.fillText(`rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`, padding + inner - 24, y + bannerH - 24);
  ctx.textAlign = "left";
  y += bannerH;

  const section = (title: string, hint: string, items: { step: number; hex: string }[]) => {
    y += sectionGap;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#334155";
    ctx.font = `700 16px ${PNG_FONT}`;
    ctx.fillText(title, padding, y);
    const titleW = ctx.measureText(title).width;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 13px ${PNG_FONT}`;
    ctx.fillText(hint, padding + titleW + 10, y + 2);
    y += titleH;

    const tileW = (inner - gap * (items.length - 1)) / items.length;
    items.forEach((item, i) => {
      const x = padding + i * (tileW + gap);
      fillRound(x, y, tileW, tileH, 10, item.hex);
      ctx.textBaseline = "top";
      ctx.fillStyle = "#0f172a";
      ctx.font = `600 13px ${PNG_MONO}`;
      ctx.fillText(item.hex, x + 2, y + tileH + 8, tileW - 4);
      ctx.fillStyle = "#94a3b8";
      ctx.font = `500 12px ${PNG_FONT}`;
      ctx.fillText(item.step === 0 ? "Base" : `${item.step}%`, x + 2, y + tileH + 26, tileW - 4);
    });
    y += tileH + labelH;
  };

  section("Tints", "mixed with white", tints);
  section("Shades", "mixed with black", shades);

  return canvas;
};

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

export const ColorConverter = () => {
  const [color, setColor] = useState("#3B82F6");
  const [hexDraft, setHexDraft] = useState("#3B82F6");
  const [copied, setCopied] = useState<string | null>(null);

  const eyeDropper = typeof window !== "undefined"
    ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
    : undefined;

  // Keep the text box in step when the colour changes from anywhere else
  useEffect(() => {
    setHexDraft(color.toUpperCase());
  }, [color]);

  // Remembers the colour taken from a pasted image, so the banner can say where it came from
  const [pastedColor, setPastedColor] = useState<string | null>(null);

  useClipboardImages((images) => {
    const url = URL.createObjectURL(images[0]);
    const img = new Image();
    img.onload = () => {
      try {
        const main = getColorSync(img);
        if (main) {
          const hex = main.hex().toUpperCase();
          setColor(hex);
          setPastedColor(hex);
        }
      } catch (err) {
        console.error("Could not read a colour from the pasted image", err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });

  const selectColor = (hex: string) => {
    const normalized = normalizeHex(hex);
    if (normalized) setColor(normalized);
  };

  const rgb = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const textOnColor = readableText(rgb);

  const colorFormats = [
    { label: "HEX", value: color.toUpperCase() },
    { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
    { label: "HSV", value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
    { label: "CMYK", value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
  ];

  const { tints, shades } = useMemo(() => {
    const base = hexToRgb(color) ?? BLACK;
    return {
      tints: MIX_STEPS.map((step) => ({ step, hex: rgbToHex(mix(base, WHITE, step / 100)) })),
      shades: MIX_STEPS.map((step) => ({ step, hex: rgbToHex(mix(base, BLACK, step / 100)) })),
    };
  }, [color]);

  const copyToClipboard = async (content: string, key: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const pickFromScreen = async () => {
    if (!eyeDropper) return;
    try {
      const result = await new eyeDropper().open();
      selectColor(result.sRGBHex);
    } catch {
      // Closing the eyedropper with Esc lands here, nothing to do
    }
  };

  const randomColor = () => {
    const value = Math.floor(Math.random() * 0xffffff);
    setColor("#" + value.toString(16).padStart(6, "0").toUpperCase());
  };

  const copyScaleAsCss = () => {
    const lines = [
      ...tints.slice(1).map((t) => `  --color-tint-${t.step}: ${t.hex};`),
      `  --color-base: ${color.toUpperCase()};`,
      ...shades.slice(1).map((s) => `  --color-shade-${s.step}: ${s.hex};`),
    ];
    copyToClipboard(`:root {\n${lines.join("\n")}\n}`, "css-scale");
  };

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
  };

  const downloadScalePng = () => {
    const canvas = drawScaleImage(color.toUpperCase(), tints, shades);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `tints-shades-${color.replace("#", "").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    flash("png-download");
  };

  const copyScaleAsPng = async () => {
    const canvas = drawScaleImage(color.toUpperCase(), tints, shades);
    if (!canvas) return;
    const blob = new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image"))), "image/png"),
    );
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("Image copy not supported");
      // Handing over the promise keeps Safari happy, it wants the write to start right away
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("png-scale");
    } catch (err) {
      console.warn("Copying the image failed, downloading it instead", err);
      downloadScalePng();
    }
  };

  const scaleButtonClass =
    "flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";

  const renderScale = (title: string, hint: string, items: { step: number; hex: string }[], prefix: string) => (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {items.map((item) => {
          const key = `${prefix}-${item.step}`;
          const isCopied = copied === key;
          const text = readableText(hexToRgb(item.hex) ?? BLACK);
          return (
            <button
              key={key}
              type="button"
              onClick={() => copyToClipboard(item.hex, key)}
              onDoubleClick={() => selectColor(item.hex)}
              title={`${item.hex} — click to copy, double-click to use`}
              className="group flex flex-col items-stretch gap-1 text-left focus:outline-none"
            >
              <span
                className="relative flex aspect-square w-full items-center justify-center rounded-lg border border-black/5 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-pink-500"
                style={{ backgroundColor: item.hex, color: text }}
              >
                {isCopied ? (
                  <Check size={14} />
                ) : (
                  <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-80" />
                )}
                {item.step === 0 && (
                  <span
                    className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: text }}
                    aria-label="Selected colour"
                  />
                )}
              </span>
              <span className="font-mono text-[10px] leading-tight text-slate-600 dark:text-slate-300 truncate">
                {isCopied ? "Copied" : item.hex}
              </span>
              <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                {item.step === 0 ? "Base" : `${item.step}%`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 shrink-0 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center border border-pink-200 dark:border-pink-800/50">
            <Palette size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Color Converter</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick a colour to get its codes, plus lighter and darker versions of it. Paste an image to use its main colour.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6">
          {/* Picker */}
          <div className={`${cardClass} p-4 flex flex-col gap-4`}>
            <div className="color-converter-picker">
              <HexColorPicker color={color} onChange={(c) => setColor(c.toUpperCase())} style={{ width: "100%", height: 220 }} />
            </div>

            <div className="flex items-center gap-2">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Hex code</span>
                <span
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md border border-black/10 dark:border-white/15"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="text"
                  value={hexDraft}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (!/^#?[0-9A-F]{0,6}$/.test(val)) return;
                    setHexDraft(val.startsWith("#") ? val : "#" + val);
                    const normalized = normalizeHex(val);
                    if (normalized && val.replace("#", "").length === 6) setColor(normalized);
                  }}
                  onBlur={() => {
                    const normalized = normalizeHex(hexDraft);
                    if (normalized) setColor(normalized);
                    else setHexDraft(color.toUpperCase());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 text-sm font-mono pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </label>
              {eyeDropper && (
                <button
                  type="button"
                  onClick={pickFromScreen}
                  title="Pick a colour from your screen"
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Pipette size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={randomColor}
                title="Random colour"
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Shuffle size={16} />
              </button>
            </div>
          </div>

          {/* Preview + codes */}
          <div className="flex flex-col gap-4 min-w-0">
            <div
              className="rounded-2xl p-5 min-h-32 flex flex-col justify-between border border-black/5 dark:border-white/10 shadow-sm transition-colors"
              style={{ backgroundColor: color, color: textOnColor }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{pastedColor === color ? "Main colour of pasted image" : "Selected colour"}</span>
              <div className="flex items-end justify-between gap-3">
                <span className="font-mono text-3xl font-bold tracking-tight">{color.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(color.toUpperCase(), "hero")}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors"
                  style={{ backgroundColor: textOnColor === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)" }}
                >
                  {copied === "hero" ? <Check size={14} /> : <Copy size={14} />}
                  {copied === "hero" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className={`${cardClass} divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden`}>
              {colorFormats.map((format) => {
                const isCopied = copied === format.label;
                return (
                  <button
                    key={format.label}
                    type="button"
                    onClick={() => copyToClipboard(format.value, format.label)}
                    className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/3 transition-colors"
                  >
                    <span className="w-12 shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {format.label}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-mono text-sm text-slate-800 dark:text-slate-200">
                      {format.value}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${isCopied ? "text-pink-600 dark:text-pink-400" : "text-slate-400 group-hover:text-pink-600 dark:group-hover:text-pink-400"}`}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      <span className="hidden sm:inline">{isCopied ? "Copied" : "Copy"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Basic colours */}
        <div className={`${cardClass} p-4 sm:p-5 flex flex-col gap-3`}>
          <div>
            <h3 className={sectionTitleClass}>Basic colours</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Click a colour to select it and see its tints and shades.</p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
            {BASIC_COLORS.map((basic) => {
              const isActive = basic.hex === color.toUpperCase();
              return (
                <button
                  key={basic.hex}
                  type="button"
                  onClick={() => selectColor(basic.hex)}
                  aria-pressed={isActive}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${isActive ? "border-pink-500 ring-2 ring-pink-500/30" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"}`}
                >
                  <span className="relative h-12 w-full" style={{ backgroundColor: basic.hex, color: readableText(hexToRgb(basic.hex) ?? BLACK) }}>
                    {isActive && <Check size={14} className="absolute top-1.5 right-1.5" />}
                  </span>
                  <span className="px-2 py-1.5 bg-white dark:bg-[#0d1117]">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{basic.name}</span>
                    <span className="block font-mono text-[10px] text-slate-400 dark:text-slate-500">{basic.hex}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tints and shades */}
        <div className={`${cardClass} p-4 sm:p-5 flex flex-col gap-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={sectionTitleClass}>Tints &amp; shades</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Click to copy a code. Double-click to make it the selected colour.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyScaleAsCss} className={scaleButtonClass}>
                {copied === "css-scale" ? <Check size={13} /> : <Code2 size={13} />}
                {copied === "css-scale" ? "Copied" : "Copy as CSS"}
              </button>
              <button type="button" onClick={copyScaleAsPng} className={scaleButtonClass}>
                {copied === "png-scale" ? <Check size={13} /> : <ImageDown size={13} />}
                {copied === "png-scale" ? "Copied" : "Copy as PNG"}
              </button>
              <button type="button" onClick={downloadScalePng} className={scaleButtonClass} title="Download as PNG">
                {copied === "png-download" ? <Check size={13} /> : <Download size={13} />}
                <span className="sr-only sm:not-sr-only">{copied === "png-download" ? "Saved" : "Download"}</span>
              </button>
            </div>
          </div>

          {renderScale("Tints", "mixed with white", tints, "tint")}
          {renderScale("Shades", "mixed with black", shades, "shade")}
        </div>
      </div>
    </div>
  );
};
