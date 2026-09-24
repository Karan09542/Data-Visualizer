import React, { useState, useRef, useEffect } from "react";
import { Pipette, Upload, Copy, Check, Image as ImageIcon, Camera, Code2, ImageDown, Download } from "lucide-react";
import { getColorSync, getPaletteSync, getSwatchesSync } from "colorthief";
import { CameraCaptureModal } from "../CameraCaptureModal";
import { useClipboardImages } from "./useQuickUtilsPaste";
import { FileDropzoneUpload } from "./FileDropzoneUpload";
import clsx from "clsx";

interface ColorData {
  hex: string;
  rgb: string;
  oklch: string;
  textColor: string;
  proportion?: number;
}

interface Swatches {
  [key: string]: {
    color: ColorData;
    titleTextColor: ColorData;
    bodyTextColor: ColorData;
  } | null;
}

// "DarkVibrant" -> "dark-vibrant", so swatch roles make tidy CSS variable names
const toKebab = (value: string) =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();

const PNG_WIDTH = 1200;
const PNG_PADDING = 48;
const PNG_GAP = 16;
const PNG_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** Draws every extracted colour onto one card-style image */
const drawPaletteImage = (
  dominant: ColorData,
  palette: ColorData[],
  swatches: Swatches | null,
  formatPercentage: (p?: number) => string,
) => {
  const swatchList = swatches
    ? Object.entries(swatches).filter((entry): entry is [string, NonNullable<Swatches[string]>] => !!entry[1])
    : [];

  const inner = PNG_WIDTH - PNG_PADDING * 2;
  const titleH = 34;
  const dominantH = 140;
  const tileH = 120;
  const labelH = 48;
  const sectionGap = 36;

  let height = PNG_PADDING + titleH + dominantH;
  if (palette.length) height += sectionGap + titleH + tileH + labelH;
  if (swatchList.length) height += sectionGap + titleH + tileH + labelH;
  height += PNG_PADDING;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = PNG_WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PNG_WIDTH, height);

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  const title = (text: string, y: number) => {
    ctx.fillStyle = "#64748b";
    ctx.font = `700 15px ${PNG_FONT}`;
    ctx.textBaseline = "top";
    ctx.fillText(text.toUpperCase(), PNG_PADDING, y);
  };

  const row = (items: { hex: string; top: string; bottom: string; textOnColor: string }[], y: number) => {
    const count = items.length;
    const tileW = (inner - PNG_GAP * (count - 1)) / count;
    items.forEach((item, i) => {
      const x = PNG_PADDING + i * (tileW + PNG_GAP);
      ctx.fillStyle = item.hex;
      roundRect(x, y, tileW, tileH, 12);
      ctx.strokeStyle = "rgba(15,23,42,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (item.top) {
        ctx.fillStyle = item.textOnColor;
        ctx.font = `600 13px ${PNG_FONT}`;
        ctx.textBaseline = "bottom";
        ctx.fillText(item.top, x + 10, y + tileH - 10, tileW - 20);
      }

      ctx.fillStyle = "#0f172a";
      ctx.font = `600 14px ui-monospace, "Cascadia Mono", Consolas, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(item.hex.toUpperCase(), x + 2, y + tileH + 10, tileW - 4);
      if (item.bottom) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = `500 12px ${PNG_FONT}`;
        ctx.fillText(item.bottom, x + 2, y + tileH + 28, tileW - 4);
      }
    });
  };

  let y = PNG_PADDING;

  title("Dominant colour", y);
  y += titleH;
  ctx.fillStyle = dominant.hex;
  roundRect(PNG_PADDING, y, inner, dominantH, 16);
  ctx.fillStyle = dominant.textColor || "#ffffff";
  ctx.textBaseline = "bottom";
  ctx.font = `700 36px ${PNG_FONT}`;
  ctx.fillText(dominant.hex.toUpperCase(), PNG_PADDING + 24, y + dominantH - 42);
  ctx.font = `500 16px ${PNG_FONT}`;
  ctx.fillText(dominant.rgb, PNG_PADDING + 24, y + dominantH - 18);
  const share = formatPercentage(dominant.proportion);
  if (share) {
    ctx.textAlign = "right";
    ctx.font = `700 28px ${PNG_FONT}`;
    ctx.fillText(share, PNG_PADDING + inner - 24, y + dominantH - 18);
    ctx.textAlign = "left";
  }
  y += dominantH;

  if (palette.length) {
    y += sectionGap;
    title("Palette", y);
    y += titleH;
    row(
      palette.map((c) => ({ hex: c.hex, top: "", bottom: formatPercentage(c.proportion), textOnColor: c.textColor })),
      y,
    );
    y += tileH + labelH;
  }

  if (swatchList.length) {
    y += sectionGap;
    title("Swatches", y);
    y += titleH;
    row(
      swatchList.map(([role, s]) => ({ hex: s.color.hex, top: role, bottom: "", textOnColor: s.titleTextColor.hex })),
      y,
    );
  }

  return canvas;
};

export const ImageColorExtractor = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<ColorData | null>(null);
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [swatches, setSwatches] = useState<Swatches | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageSrc(url);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setImageSrc(URL.createObjectURL(file));
      }
    }
  };

  const extractColors = () => {
    if (!imgRef.current) return;
    setIsProcessing(true);

    try {
      const img = imgRef.current;

      // Extract Dominant Color
      const dominant = getColorSync(img);
      if (dominant) {
        setDominantColor({
          hex: dominant.hex(),
          rgb: dominant.css("rgb"),
          oklch: dominant.css("oklch"),
          textColor: dominant.textColor,
          proportion: dominant.proportion,
        });
      }

      // Extract Palette
      const extractedPalette = getPaletteSync(img, { colorCount: 10 });
      if (extractedPalette) {
        setPalette(
          extractedPalette.map((c: any) => ({
            hex: c.hex(),
            rgb: c.css("rgb"),
            oklch: c.css("oklch"),
            textColor: c.textColor,
            proportion: c.proportion,
          }))
        );
      }

      // Extract Swatches
      const extractedSwatches = getSwatchesSync(img);
      if (extractedSwatches) {
        const parsedSwatches: Swatches = {};
        for (const [key, swatch] of Object.entries(extractedSwatches)) {
          if (swatch) {
            parsedSwatches[key] = {
              color: {
                hex: (swatch as any).color.hex(),
                rgb: (swatch as any).color.css("rgb"),
                oklch: (swatch as any).color.css("oklch"),
                textColor: (swatch as any).color.textColor,
              },
              titleTextColor: {
                hex: (swatch as any).titleTextColor.hex(),
                rgb: "",
                oklch: "",
                textColor: "",
              },
              bodyTextColor: {
                hex: (swatch as any).bodyTextColor.hex(),
                rgb: "",
                oklch: "",
                textColor: "",
              },
            };
          } else {
            parsedSwatches[key] = null;
          }
        }
        setSwatches(parsedSwatches);
      }
    } catch (err) {
      console.error("Failed to extract colors:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  useClipboardImages((images) => setImageSrc(URL.createObjectURL(images[0])), { enabled: !isCameraOpen && imageSrc !== null });

  const formatPercentage = (proportion?: number) => {
    if (proportion === undefined) return "";
    return `${Math.round(proportion * 100)}%`;
  };

  const buildCss = (include: { dominant?: boolean; palette?: boolean; swatches?: boolean }) => {
    const lines: string[] = [];
    if (include.dominant && dominantColor) {
      lines.push(`  --color-dominant: ${dominantColor.hex};`);
    }
    if (include.palette && palette.length) {
      if (lines.length) lines.push("");
      palette.forEach((c, i) => lines.push(`  --palette-${i + 1}: ${c.hex};`));
    }
    if (include.swatches && swatches) {
      const entries = Object.entries(swatches).filter(([, s]) => s);
      if (entries.length && lines.length) lines.push("");
      entries.forEach(([role, s]) => lines.push(`  --swatch-${toKebab(role)}: ${s!.color.hex};`));
    }
    return `:root {\n${lines.join("\n")}\n}`;
  };

  const renderPng = () => {
    if (!dominantColor) return null;
    return drawPaletteImage(dominantColor, palette, swatches, formatPercentage);
  };

  const downloadPng = () => {
    const canvas = renderPng();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "color-palette.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setCopied("png-download");
    setTimeout(() => setCopied(null), 2000);
  };

  const copyPng = async () => {
    const canvas = renderPng();
    if (!canvas) return;
    const blob = new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image"))), "image/png"),
    );
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("Image copy not supported");
      // Handing over the promise keeps Safari happy, it wants the write to start right away
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied("png");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.warn("Copying the image failed, downloading it instead", err);
      downloadPng();
    }
  };

  const exportButtonClass =
    "flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161b22] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-fuchsia-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors";
  const sectionCopyClass =
    "flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors";

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-fuchsia-200 dark:border-fuchsia-800/50">
          <Pipette size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Image Color Extractor
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Extract dominant colors, palettes, and semantic swatches from any image.
        </p>
      </div>

      <div className={clsx("grid grid-cols-1 gap-8", imageSrc
        && "lg:grid-cols-3 "
      )}>
        {/* Left Column: Image Upload & Preview */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {!imageSrc ? (
            <FileDropzoneUpload
              onFileSelected={(file) => {
                const url = URL.createObjectURL(file);
                setImageSrc(url);
              }}
              accept="image/*"
              title="Drop Image for Palette"
              subtitle="Supports PNG, JPG, WEBP • or tap to browse"
              accentColor="fuchsia"
              compact={true}
              className="w-full"
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="w-full aspect-square border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-[#161b22]/50 flex items-center justify-center overflow-hidden relative shadow-sm">
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Uploaded"
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                  onLoad={extractColors}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-fuchsia-50 hover:bg-fuchsia-100 dark:bg-fuchsia-900/20 dark:hover:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800/50 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Camera size={14} /> Retake
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImageSrc(null);
                    setDominantColor(null);
                    setPalette([]);
                    setSwatches(null);
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Colors */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {isProcessing ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Extracting colors...
            </div>
          ) : !dominantColor ? null : (
            <>
              {/* Export everything at once */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22]/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Export all colors</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Dominant color, palette and swatches together</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildCss({ dominant: true, palette: true, swatches: true }), "css-all")}
                    className={exportButtonClass}
                  >
                    {copied === "css-all" ? <Check size={14} className="text-emerald-500" /> : <Code2 size={14} />}
                    {copied === "css-all" ? "Copied" : "Copy as CSS"}
                  </button>
                  <button type="button" onClick={copyPng} className={exportButtonClass}>
                    {copied === "png" ? <Check size={14} className="text-emerald-500" /> : <ImageDown size={14} />}
                    {copied === "png" ? "Copied" : "Copy as PNG"}
                  </button>
                  <button type="button" onClick={downloadPng} className={exportButtonClass} title="Download as PNG">
                    {copied === "png-download" ? <Check size={14} className="text-emerald-500" /> : <Download size={14} />}
                    <span className="sr-only sm:not-sr-only">{copied === "png-download" ? "Saved" : "Download"}</span>
                  </button>
                </div>
              </div>

              {/* Dominant Color */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Dominant Color
                </h3>
                <div
                  className="w-full h-32 rounded-xl shadow-inner flex items-end justify-between p-4 group relative overflow-hidden transition-transform hover:scale-[1.01]"
                  style={{
                    backgroundColor: dominantColor.hex,
                    color: dominantColor.textColor,
                  }}
                >
                  <div className="flex flex-col z-10">
                    <span className="text-2xl font-bold shadow-sm">{dominantColor.hex}</span>
                    <span className="text-sm opacity-90">{dominantColor.rgb}</span>
                  </div>
                  <div className="flex flex-col items-end z-10">
                    <span className="text-xl font-bold bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm">
                      {formatPercentage(dominantColor.proportion)}
                    </span>
                  </div>

                  {/* Copy overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => copyToClipboard(dominantColor.hex, "dominant")}
                      className="bg-white/90 text-slate-800 px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all"
                    >
                      {copied === "dominant" ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      {copied === "dominant" ? "Copied!" : "Copy HEX"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Palette */}
              {palette.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Palette
                    </h3>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(buildCss({ palette: true }), "css-palette")}
                      className={sectionCopyClass}
                    >
                      {copied === "css-palette" ? <Check size={13} className="text-emerald-500" /> : <Code2 size={13} />}
                      {copied === "css-palette" ? "Copied" : "Copy as CSS"}
                    </button>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-2 gap-y-3">
                    {palette.map((color, idx) => (
                      <div key={idx} className="flex flex-col gap-1 min-w-0">
                        <div
                          onClick={() => copyToClipboard(color.hex, `palette-${idx}`)}
                          className="aspect-square rounded-lg shadow-inner cursor-pointer relative group overflow-hidden"
                          style={{ backgroundColor: color.hex }}
                          title={`${color.hex} (${formatPercentage(color.proportion)})`}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 backdrop-blur-[2px] transition-all">
                            {copied === `palette-${idx}` ? (
                              <Check size={16} className="text-white drop-shadow-md" />
                            ) : (
                              <Copy size={16} className="text-white drop-shadow-md" />
                            )}
                            {color.proportion && (
                              <span className="text-[10px] text-white font-bold mt-1 drop-shadow-md">
                                {formatPercentage(color.proportion)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {copied === `palette-${idx}` ? "Copied" : color.hex.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Semantic Swatches */}
              {swatches && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Semantic Swatches
                    </h3>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(buildCss({ swatches: true }), "css-swatches")}
                      className={sectionCopyClass}
                    >
                      {copied === "css-swatches" ? <Check size={13} className="text-emerald-500" /> : <Code2 size={13} />}
                      {copied === "css-swatches" ? "Copied" : "Copy as CSS"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(swatches).map(([role, swatch]) => {
                      if (!swatch) return null;
                      return (
                        <div
                          key={role}
                          onClick={() => copyToClipboard(swatch.color.hex, `swatch-${role}`)}
                          className="flex flex-col rounded-xl overflow-hidden shadow-sm cursor-pointer group border border-slate-200 dark:border-slate-700/50 hover:border-fuchsia-500 transition-colors"
                        >
                          <div
                            className="h-16 flex items-center justify-center relative"
                            style={{ backgroundColor: swatch.color.hex }}
                          >
                            <span
                              className="font-bold text-sm z-10"
                              style={{ color: swatch.titleTextColor.hex }}
                            >
                              {role}
                            </span>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Copy size={16} className="text-white drop-shadow-md" />
                            </div>
                          </div>
                          <div className="bg-white dark:bg-[#161b22] p-2 flex justify-between items-center text-xs">
                            <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">
                              {copied === `swatch-${role}` ? "COPIED" : swatch.color.hex}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={(file) => {
            if (file.type.startsWith("image/")) setImageSrc(URL.createObjectURL(file));
          }}
        />
      )}
    </div>
  );
};
