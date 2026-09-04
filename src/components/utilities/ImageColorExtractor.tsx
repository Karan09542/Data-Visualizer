import React, { useState, useRef, useEffect } from "react";
import { Pipette, Upload, Copy, Check, Image as ImageIcon } from "lucide-react";
import { getColorSync, getPaletteSync, getSwatchesSync } from "colorthief";

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

export const ImageColorExtractor = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<ColorData | null>(null);
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [swatches, setSwatches] = useState<Swatches | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const formatPercentage = (proportion?: number) => {
    if (proportion === undefined) return "";
    return `${Math.round(proportion * 100)}%`;
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Image Upload & Preview */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 dark:hover:border-fuchsia-500 rounded-xl bg-slate-50 dark:bg-[#161b22]/50 flex flex-col items-center justify-center cursor-pointer transition-colors group overflow-hidden relative shadow-sm"
          >
            {imageSrc ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Uploaded"
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                onLoad={extractColors}
              />
            ) : (
              <>
                <Upload
                  size={32}
                  className="text-slate-400 group-hover:text-fuchsia-500 mb-3 transition-colors"
                />
                <span className="text-slate-600 dark:text-slate-300 font-medium text-sm mb-1 text-center px-4">
                  Drop an image<br/>or click to browse
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {imageSrc && (
            <button
              onClick={() => {
                setImageSrc(null);
                setDominantColor(null);
                setPalette([]);
                setSwatches(null);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors"
            >
              Clear Image
            </button>
          )}
        </div>

        {/* Right Column: Colors */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {isProcessing ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Extracting colors...
            </div>
          ) : !dominantColor ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-[#161b22]/20">
              <ImageIcon size={48} className="opacity-20" />
              <p>Upload an image to see its colors</p>
            </div>
          ) : (
            <>
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
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Palette
                  </h3>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {palette.map((color, idx) => (
                      <div
                        key={idx}
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
                    ))}
                  </div>
                </div>
              )}

              {/* Semantic Swatches */}
              {swatches && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Semantic Swatches
                  </h3>
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
    </div>
  );
};
