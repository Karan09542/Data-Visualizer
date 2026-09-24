import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Moon,
  Sun,
  Sparkles,
  Sliders,
  Copy,
  Download,
  Check,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  Wand2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Palette,
  SunMedium,
  Flame,
  Zap,
} from "lucide-react";
import { FileDropzoneUpload, SampleImageItem } from "./FileDropzoneUpload";
import CustomSelect from "../CustomSelect";
import { ai } from "../../ai";
import { AIProgressEvent } from "../../ai/types";

const EXPORT_FORMAT_OPTIONS = [
  { label: "PNG", value: "png", description: "Lossless quality" },
  { label: "JPG", value: "jpeg", description: "Standard photo" },
  { label: "WEBP", value: "webp", description: "High compression" },
];

// Curated sample low-light photos for instant 1-click test
const SAMPLE_LOWLIGHT_IMAGES: SampleImageItem[] = [
  {
    label: "Night Street",
    url: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&q=80&auto=format&fit=crop",
    badge: "Night City",
    description: "Dark urban street with neon highlights",
  },
  {
    label: "Dim Portrait",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80&auto=format&fit=crop",
    badge: "Portrait",
    description: "Underexposed face in ambient light",
  },
  {
    label: "Night Landscape",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop",
    badge: "Landscape",
    description: "Dusk skyline with dark foreground",
  },
  {
    label: "Candlelight Dinner",
    url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&q=80&auto=format&fit=crop",
    badge: "Atmosphere",
    description: "Warm shadows and dim highlights",
  },
];

export interface LowLightEnhanceParams {
  boost: number; // 0 - 200 (AI curve intensity)
  exposure: number; // -50 - 100 (Brightness offset)
  shadowLift: number; // 0 - 100 (Shadow recovery)
  highlightProtection: number; // 0 - 100
  contrast: number; // 50 - 150
  saturation: number; // 50 - 180
  warmth: number; // -50 - 50
  denoise: number; // 0 - 100
  sharpness: number; // 0 - 100
}

const DEFAULT_PARAMS: LowLightEnhanceParams = {
  boost: 100,
  exposure: 20,
  shadowLift: 40,
  highlightProtection: 25,
  contrast: 105,
  saturation: 115,
  warmth: 0,
  denoise: 20,
  sharpness: 25,
};

interface PresetOption {
  id: string;
  name: string;
  badge: string;
  icon: React.ReactNode;
  desc: string;
  params: LowLightEnhanceParams;
}

const PRESETS: PresetOption[] = [
  {
    id: "night_sight_ai",
    name: "Night Sight AI",
    badge: "Zero-DCE",
    icon: <Moon size={14} className="text-amber-500" />,
    desc: "Deep neural curve recovery for night captures",
    params: {
      boost: 110,
      exposure: 25,
      shadowLift: 45,
      highlightProtection: 30,
      contrast: 105,
      saturation: 120,
      warmth: 0,
      denoise: 25,
      sharpness: 30,
    },
  },
  {
    id: "shadow_recovery",
    name: "Shadow Lift",
    badge: "Dynamic",
    icon: <SunMedium size={14} className="text-orange-500" />,
    desc: "Restores deep shadows while preserving highlights",
    params: {
      boost: 85,
      exposure: 15,
      shadowLift: 70,
      highlightProtection: 45,
      contrast: 100,
      saturation: 110,
      warmth: 0,
      denoise: 15,
      sharpness: 20,
    },
  },
  {
    id: "hdr_balanced",
    name: "HDR Balanced",
    badge: "Even Light",
    icon: <Sparkles size={14} className="text-yellow-500" />,
    desc: "Evenly balances exposure across dark and bright zones",
    params: {
      boost: 90,
      exposure: 30,
      shadowLift: 50,
      highlightProtection: 35,
      contrast: 110,
      saturation: 115,
      warmth: 5,
      denoise: 20,
      sharpness: 25,
    },
  },
  {
    id: "warm_candle",
    name: "Warm Atmosphere",
    badge: "Golden Glow",
    icon: <Flame size={14} className="text-amber-600" />,
    desc: "Low-light boost with cozy golden-hour tones",
    params: {
      boost: 95,
      exposure: 20,
      shadowLift: 35,
      highlightProtection: 25,
      contrast: 108,
      saturation: 125,
      warmth: 28,
      denoise: 20,
      sharpness: 20,
    },
  },
  {
    id: "ultra_bright",
    name: "Ultra Boost",
    badge: "Max Light",
    icon: <Zap size={14} className="text-yellow-400" />,
    desc: "Maximum illumination for pitch-black photos",
    params: {
      boost: 160,
      exposure: 55,
      shadowLift: 80,
      highlightProtection: 20,
      contrast: 98,
      saturation: 130,
      warmth: 0,
      denoise: 40,
      sharpness: 35,
    },
  },
];

type ViewMode = "split" | "side-by-side" | "result";
type ExportFormat = "png" | "jpeg" | "webp";

export function LowLightEnhancerUtil() {
  // Source Image state
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState("photo");
  const [sourceFileSize, setSourceFileSize] = useState(0);

  // Model & Processing state
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [progressStatus, setProgressStatus] = useState("Ready");
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** The job now running, so a download the user did not want can be stopped. */
  const activeJobRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  // Raw neural enhanced canvas cache
  const aiEnhancedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Final adjusted canvas (rendered in viewport)
  const [finalCanvas, setFinalCanvas] = useState<HTMLCanvasElement | null>(null);

  // Controls & Presets
  const [activePreset, setActivePreset] = useState<string>("night_sight_ai");
  const [params, setParams] = useState<LowLightEnhanceParams>(DEFAULT_PARAMS);

  // Viewport comparison state
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mobileTab, setMobileTab] = useState<"canvas" | "controls">("canvas");

  // Export state
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  // DOM refs
  const viewportRef = useRef<HTMLDivElement>(null);
  const splitBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef(false);
  const [splitPos, setSplitPos] = useState(50); // percentage 0 - 100

  // ═════════════════════════════════════════════════════════════
  // Spacebar Peek Original
  // ═════════════════════════════════════════════════════════════
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsHoldingOriginal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Adaptive High-Dynamic-Range Fallback Curve Engine
  // ═════════════════════════════════════════════════════════════
  const generateAdaptiveCurveCanvas = useCallback((img: HTMLImageElement): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imgData.data;

    // Apply multi-iteration quadratic curve expansion: I_next = I + alpha * I * (1 - I)
    // Similar to Zero-DCE formulation
    const iterations = 4;
    const alpha = 0.55;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      for (let it = 0; it < iterations; it++) {
        r = r + alpha * r * (1.0 - r);
        g = g + alpha * g * (1.0 - g);
        b = b + alpha * b * (1.0 - b);
      }

      data[i] = Math.min(255, Math.max(0, Math.round(r * 255)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
    }

    ctx.putImageData(imgData, 0, 0);
    return c;
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Run AI Zero-DCE Neural Enhancement Pipeline
  // ═════════════════════════════════════════════════════════════
  const processLowLightAI = useCallback(
    async (img: HTMLImageElement) => {
      setIsProcessingAI(true);
      setErrorMsg(null);
      cancelledRef.current = false;
      setProgressStatus("Initializing Neural Model...");
      setProgressPercent(15);

      try {
        const tc = document.createElement("canvas");
        tc.width = img.naturalWidth;
        tc.height = img.naturalHeight;
        tc.getContext("2d")!.drawImage(img, 0, 0);
        const inputData = tc.getContext("2d")!.getImageData(0, 0, tc.width, tc.height);

        // Execute task 'low-light' via ai service
        const { jobId, promise } = ai.execute(
          "low-light",
          inputData,
          { modelId: "zero_dce", preferredBackend: "wasm" },
          5
        );

        activeJobRef.current = jobId;

        const unsub = ai.subscribe(jobId, (ev: AIProgressEvent & { jobId: string }) => {
          if (ev.state === "downloading") {
            setProgressStatus(`Downloading Zero-DCE Model (${ev.progress || 0}%)...`);
            setProgressPercent(Math.round((ev.progress || 0) * 0.45));
          } else if (ev.state === "loading-model") {
            setProgressStatus("Compiling Neural Runtime...");
            setProgressPercent(50);
          } else if (ev.state === "preparing-image") {
            setProgressStatus("Preparing Input Tensors...");
            setProgressPercent(65);
          } else if (ev.state === "inference") {
            setProgressStatus(`AI Curve Estimation (${ev.progress || 0}%)...`);
            setProgressPercent(65 + Math.round((ev.progress || 0) * 0.3));
          }
        });

        let result: any = null;
        try {
          result = await promise;
        } catch (execErr: any) {
          if (execErr?.message === "AbortError" || cancelledRef.current) return;
          console.warn("[LowLightEnhancer] AI execution fallback to adaptive curve", execErr);
        } finally {
          unsub();
        }
        if (cancelledRef.current) return;

        let aiCanvas: HTMLCanvasElement;
        if (result?.output) {
          const out = result.output;
          aiCanvas = document.createElement("canvas");
          aiCanvas.width = out.width;
          aiCanvas.height = out.height;
          const oCtx = aiCanvas.getContext("2d")!;
          if (out instanceof ImageBitmap) {
            oCtx.drawImage(out, 0, 0);
          } else if (out instanceof ImageData) {
            oCtx.putImageData(out, 0, 0);
          }
        } else {
          // Graceful fallback to adaptive HDR algorithm
          aiCanvas = generateAdaptiveCurveCanvas(img);
        }

        aiEnhancedCanvasRef.current = aiCanvas;
        setProgressPercent(100);
        setProgressStatus("Finished");
      } catch (err: any) {
        // Stopping on purpose is not a failure, and must not leave a result behind.
        if (err?.message === "AbortError" || cancelledRef.current) return;
        console.error("[LowLightEnhancer] Pipeline error:", err);
        // Ensure user still gets instant enhanced result
        aiEnhancedCanvasRef.current = generateAdaptiveCurveCanvas(img);
        setErrorMsg(err.message || "Failed to run neural model. Applied adaptive HDR enhancement.");
      } finally {
        activeJobRef.current = null;
        setIsProcessingAI(false);
      }
    },
    [generateAdaptiveCurveCanvas]
  );

  /** Stops the run, and with it the model download it may still be in the middle of. */
  const cancelAiRun = useCallback(() => {
    const jobId = activeJobRef.current;
    cancelledRef.current = true;
    activeJobRef.current = null;
    if (jobId) ai.cancel(jobId);
    setIsProcessingAI(false);
    setProgressPercent(0);
    setProgressStatus("Ready");
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Real-time Canvas Rendering with Sliders & Color Balancing
  // ═════════════════════════════════════════════════════════════
  const renderAdjustedImage = useCallback(() => {
    if (!sourceImage) return;

    const baseCanvas = aiEnhancedCanvasRef.current || generateAdaptiveCurveCanvas(sourceImage);
    const { naturalWidth: w, naturalHeight: h } = sourceImage;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext("2d")!;

    // 1. Draw source and blend with AI/adaptive curve canvas based on boost
    ctx.drawImage(sourceImage, 0, 0);

    const boostFactor = Math.min(2, Math.max(0, params.boost / 100));
    ctx.globalAlpha = Math.min(1, boostFactor);
    ctx.drawImage(baseCanvas, 0, 0);

    // If boost > 100%, blend an extra layer of curve enhancement
    if (boostFactor > 1.0) {
      ctx.globalAlpha = boostFactor - 1.0;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(baseCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.globalAlpha = 1.0;

    // 2. Pixel-level fine-tuning: Shadow lift, highlight protection, warmth, contrast
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    const exposureMult = 1.0 + params.exposure / 100;
    const shadowMult = params.shadowLift / 100;
    const highlightProtect = params.highlightProtection / 100;
    const contrastFactor = params.contrast / 100;
    const saturationFactor = params.saturation / 100;
    const warmthShift = params.warmth * 0.7;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      // 1. Exposure
      r *= exposureMult;
      g *= exposureMult;
      b *= exposureMult;

      // 2. Shadow lift & Highlight recovery
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 140) {
        // Deep shadow boost
        const lift = (1.0 - lum / 140) * shadowMult * 75;
        r += lift;
        g += lift;
        b += lift;
      } else if (lum > 180 && highlightProtect > 0) {
        // Highlight recovery (prevent blowout)
        const suppress = ((lum - 180) / 75) * highlightProtect * 35;
        r -= suppress;
        g -= suppress;
        b -= suppress;
      }

      // 3. Contrast around midtone 128
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      // 4. Color Warmth / Balance
      if (warmthShift !== 0) {
        r += warmthShift;
        b -= warmthShift;
      }

      // 5. Saturation / Vibrance
      if (saturationFactor !== 1.0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * saturationFactor;
        g = gray + (g - gray) * saturationFactor;
        b = gray + (b - gray) * saturationFactor;
      }

      d[i] = Math.max(0, Math.min(255, Math.round(r)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }

    ctx.putImageData(imgData, 0, 0);

    // 3. Optional Sharpness / Clarity pass
    if (params.sharpness > 0) {
      const sharpAlpha = (params.sharpness / 100) * 0.35;
      ctx.globalAlpha = sharpAlpha;
      ctx.globalCompositeOperation = "overlay";
      ctx.drawImage(outCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
    }

    setFinalCanvas(outCanvas);
  }, [sourceImage, params, generateAdaptiveCurveCanvas]);

  // Re-render when parameters or source image change
  useEffect(() => {
    renderAdjustedImage();
  }, [renderAdjustedImage]);

  // Load new file
  const handleImageFile = useCallback((file: File) => {
    setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
    setSourceFileSize(file.size);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setSourceImage(img);
        aiEnhancedCanvasRef.current = null;
        processLowLightAI(img);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [processLowLightAI]);

  // Launch from sample URL
  const launchWithUrl = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setSourceImage(img);
      setSourceFileName("sample-low-light");
      setSourceFileSize(120000);
      aiEnhancedCanvasRef.current = null;
      processLowLightAI(img);
    };
    img.src = url;
  }, [processLowLightAI]);

  // Preset Selection
  const applyPreset = (preset: PresetOption) => {
    setActivePreset(preset.id);
    setParams(preset.params);
  };

  // ═════════════════════════════════════════════════════════════
  // Split Slider Drag Handlers (Accurate on All Screens)
  // ═════════════════════════════════════════════════════════════
  const updateSplitFromClientX = useCallback((clientX: number) => {
    const container = splitBoxRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPos = ((clientX - rect.left) / rect.width) * 100;
    const pos = Math.max(0, Math.min(100, Math.round(rawPos * 10) / 10));
    setSplitPos(pos);
  }, []);

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    isDraggingSplitRef.current = true;
    updateSplitFromClientX(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplitRef.current) return;
    e.preventDefault();
    updateSplitFromClientX(e.clientX);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplitRef.current) {
      isDraggingSplitRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent | MouseEvent) => {
      if (!isDraggingSplitRef.current) return;
      updateSplitFromClientX(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingSplitRef.current || e.touches.length === 0) return;
      updateSplitFromClientX(e.touches[0].clientX);
    };
    const onEnd = () => {
      isDraggingSplitRef.current = false;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [updateSplitFromClientX]);

  // ═════════════════════════════════════════════════════════════
  // Copy & Download Actions
  // ═════════════════════════════════════════════════════════════
  const copyToClipboard = async () => {
    if (!finalCanvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        finalCanvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to copy image to clipboard", err);
    }
  };

  const downloadImage = () => {
    if (!finalCanvas) return;
    const mime =
      exportFormat === "png"
        ? "image/png"
        : exportFormat === "jpeg"
          ? "image/jpeg"
          : "image/webp";
    const ext = exportFormat === "png" ? "png" : exportFormat === "jpeg" ? "jpg" : "webp";

    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sourceFileName}-enhanced.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      mime,
      0.95
    );
  };

  // Convert canvases to cached data URLs for high-perf render
  const finalPreviewUrl = useMemo(() => {
    return finalCanvas ? finalCanvas.toDataURL("image/jpeg", 0.9) : "";
  }, [finalCanvas]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0f16] text-slate-900 dark:text-slate-100">
      {/* ── Top Header Bar ── */}
      <header className="px-2.5 sm:px-5 py-1.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
            <Moon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Low Light Enhance
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0 hidden sm:flex items-center gap-1">
                <Sparkles size={9} /> Zero-DCE AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Brighten dark shadows, recover colors and restore clarity in low-light photos
            </p>
          </div>
        </div>

        {sourceImage && (
          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            {/* View Mode Controls (Desktop) */}
            <div className="hidden sm:flex items-center rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#12161f]">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "split"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Split comparison slider"
              >
                <SlidersHorizontal size={13} />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("side-by-side")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "side-by-side"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Side-by-side view"
              >
                <Eye size={13} />
                <span>Dual</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("result")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "result"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                title="Enhanced result only"
              >
                <Check size={13} />
                <span>Result</span>
              </button>
            </div>

            {/* Hold to Peek Button */}
            <button
              type="button"
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border transition-colors ${isHoldingOriginal
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white dark:bg-[#12161f] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                }`}
              title="Hold to see original dark photo (or press Spacebar)"
            >
              <Eye size={13} />
              <span>Original</span>
            </button>

            {/* Copy PNG Button */}
            <button
              type="button"
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all shadow-xs border ${copyFeedback
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-500"
                }`}
              title="Copy enhanced image as PNG to clipboard"
            >
              {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copyFeedback ? "Copied PNG!" : "Copy PNG"}</span>
            </button>

            {/* Export Format Selector & Download Button with CustomSelect */}
            <div className="flex items-center gap-1.5">
              <div className="w-[78px] sm:w-[95px]">
                <CustomSelect
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v as ExportFormat)}
                  options={EXPORT_FORMAT_OPTIONS}
                  variant="toolbar"
                  className="text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={downloadImage}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                title={`Download enhanced image (${exportFormat.toUpperCase()})`}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>

            {/* Reset / New Button */}
            <button
              type="button"
              onClick={() => {
                setSourceImage(null);
                setFinalCanvas(null);
                aiEnhancedCanvasRef.current = null;
              }}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Open different photo"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        )}
      </header>

      {/* ── Main Workspace Body ── */}
      {!sourceImage ? (
        /* Empty / Upload State */
        <div className="flex-1 flex flex-col items-center sm:justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <FileDropzoneUpload
            onFileSelected={handleImageFile}
            accept="image/*"
            title="Drop Dark or Low-Light Photo Here"
            subtitle="JPG, PNG, WEBP high-res photo • or tap to browse"
            pasteNotice="Paste Dark Photo"
            accentColor="amber"
            enableCamera={true}
            sampleImages={SAMPLE_LOWLIGHT_IMAGES}
            onSampleSelect={launchWithUrl}
            className="w-full max-w-2xl"
          />
        </div>
      ) : (
        /* Active Workspace: Viewport & Adjustment Panel */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161f] p-1 shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab("canvas")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "canvas"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("controls")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "controls"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Adjust & Presets
            </button>
          </div>

          {/* ── Center Viewport Canvas ── */}
          <div
            ref={viewportRef}
            className={`flex-1 bg-slate-900/95 dark:bg-[#070a0f] flex items-center justify-center overflow-hidden relative select-none ${mobileTab === "canvas" ? "flex" : "hidden md:flex"
              }`}
          >
            {/* Background grid dots */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: "radial-gradient(#475569 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* AI Progress Overlay */}
            {isProcessingAI && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
                <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-3 animate-pulse">
                    <Moon size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Enhancing Low Light
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{progressStatus}</p>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={cancelAiRun}
                    className="mt-3.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-white/10 transition-colors active:scale-95"
                  >
                    <X size={13} /> Cancel
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">Stops the download too. What is already saved is kept.</p>
                </div>
              </div>
            )}

            {/* Error Message Toast */}
            {errorMsg && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-lg max-w-sm">
                <AlertCircle size={15} className="shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}

            {/* Visualizer Display Area */}
            {sourceImage && finalPreviewUrl && (
              <div
                className="relative max-w-full max-h-full flex items-center justify-center p-4 transition-transform duration-100"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {/* ── Mode 1: Split Slider Comparison ── */}
                {viewMode === "split" && !isHoldingOriginal && (
                  <div
                    ref={splitBoxRef}
                    onPointerDown={handleSplitPointerDown}
                    onPointerMove={handleSplitPointerMove}
                    onPointerUp={handleSplitPointerUp}
                    onPointerCancel={handleSplitPointerUp}
                    className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-700/60 max-w-[90vw] max-h-[75vh] cursor-ew-resize select-none touch-none"
                  >
                    {/* Enhanced Base Image */}
                    <img
                      src={finalPreviewUrl}
                      alt="Enhanced"
                      className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                      draggable={false}
                    />

                    {/* Original Clip (Left Side) */}
                    <div
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                    >
                      <img
                        src={sourceImage.src}
                        alt="Original"
                        className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                        draggable={false}
                      />
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
                        Original (Dark)
                      </div>
                    </div>

                    {/* Enhanced Label (Right Side) */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-500/80 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs pointer-events-none">
                      Enhanced (AI)
                    </div>

                    {/* Split Divider Line & Draggable Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none z-20 flex items-center justify-center -translate-x-1/2"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 text-amber-500 shadow-xl border-2 border-amber-500 flex items-center justify-center active:scale-110 transition-transform pointer-events-auto">
                        <SlidersHorizontal size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Mode 2: Side-by-Side Dual View ── */}
                {viewMode === "side-by-side" && !isHoldingOriginal && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 max-w-[90vw] max-h-[75vh]">
                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-slate-700/60 max-h-[35vh] sm:max-h-[70vh]">
                      <img
                        src={sourceImage.src}
                        alt="Original"
                        className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        Original
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-amber-500/40 max-h-[35vh] sm:max-h-[70vh]">
                      <img
                        src={finalPreviewUrl}
                        alt="Enhanced"
                        className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500/90 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        Enhanced
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Mode 3: Result Only or Hold Spacebar ── */}
                {(viewMode === "result" || isHoldingOriginal) && (
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700/60 max-w-[85vw] max-h-[75vh]">
                    <img
                      src={isHoldingOriginal ? sourceImage.src : finalPreviewUrl}
                      alt={isHoldingOriginal ? "Original" : "Enhanced"}
                      className="w-auto h-auto max-w-[85vw] max-h-[75vh] object-contain select-none block"
                    />
                    <div
                      className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase text-white shadow-xs ${isHoldingOriginal ? "bg-black/70" : "bg-amber-500/90"
                        }`}
                    >
                      {isHoldingOriginal ? "Original (Holding Space)" : "Enhanced Result"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Zoom & View Controls */}
            {sourceImage && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs">
                {/* Mobile View Mode Switcher */}
                <div className="sm:hidden flex items-center mr-1 pr-1 border-r border-white/20">
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode(
                        viewMode === "split"
                          ? "side-by-side"
                          : viewMode === "side-by-side"
                          ? "result"
                          : "split"
                      )
                    }
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/30 text-amber-300"
                  >
                    {viewMode === "split" ? "Split" : viewMode === "side-by-side" ? "Dual" : "Result"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                  className="p-1 hover:text-amber-400 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="font-mono text-[11px] w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                  className="p-1 hover:text-amber-400 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <div className="w-px h-3.5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="text-[10px] font-semibold text-slate-300 hover:text-white px-1"
                >
                  Fit
                </button>
              </div>
            )}
          </div>

          {/* ── Right / Mobile Controls & Presets Drawer ── */}
          <div
            className={`w-full md:w-80 lg:w-88 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col p-4 overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y min-h-0 ${
              mobileTab === "controls"
                ? "flex flex-1 h-full max-h-full"
                : "hidden md:flex md:h-full md:max-h-full"
            }`}
          >
            {/* Section 1: Presets */}
            <div className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Wand2 size={13} className="text-amber-500" /> Enhancement Presets
                </span>
                <span className="text-[10px] text-slate-400">1-click tuning</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
                {PRESETS.map((preset) => {
                  const isActive = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${isActive
                          ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-[#12161f]"
                        }`}
                    >
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0 mt-0.5">
                        {preset.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {preset.name}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                          {preset.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Fine-Tuning Sliders */}
            <div className="space-y-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Sliders size={13} className="text-amber-500" /> Fine Adjustments
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActivePreset("custom");
                    setParams(DEFAULT_PARAMS);
                  }}
                  className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Reset
                </button>
              </div>

              {/* Slider 1: AI Boost Strength */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Sparkles size={12} className="text-amber-500" /> Light Boost
                  </span>
                  <span className="font-mono text-slate-400">{params.boost}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={params.boost}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, boost: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 2: Shadow Recovery */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Shadows Lift</span>
                  <span className="font-mono text-slate-400">+{params.shadowLift}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={params.shadowLift}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, shadowLift: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 3: Exposure / Brightness */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Exposure</span>
                  <span className="font-mono text-slate-400">
                    {params.exposure >= 0 ? `+${params.exposure}%` : `${params.exposure}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="80"
                  step="5"
                  value={params.exposure}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, exposure: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 4: Highlight Protection */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Highlight Protect</span>
                  <span className="font-mono text-slate-400">{params.highlightProtection}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={params.highlightProtection}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, highlightProtection: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 5: Contrast */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Contrast</span>
                  <span className="font-mono text-slate-400">{params.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="140"
                  step="2"
                  value={params.contrast}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, contrast: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 6: Color Vibrance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Palette size={12} className="text-amber-500" /> Color Vibrance
                  </span>
                  <span className="font-mono text-slate-400">{params.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  step="5"
                  value={params.saturation}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, saturation: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 7: Color Warmth */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Warmth</span>
                  <span className="font-mono text-slate-400">
                    {params.warmth >= 0 ? `+${params.warmth}` : `${params.warmth}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="2"
                  value={params.warmth}
                  onChange={(e) => {
                    setActivePreset("custom");
                    setParams((p) => ({ ...p, warmth: parseInt(e.target.value) }));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Section 3: Photo Metadata Card */}
            <div className="pt-4 pb-24 md:pb-8 space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/60 mt-2 shrink-0">
              <div className="flex items-center justify-between text-slate-400">
                <span>Original Dimensions:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceImage.naturalWidth} × {sourceImage.naturalHeight} px
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>File Size:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceFileSize > 0 ? `${Math.round(sourceFileSize / 1024)} KB` : "Embedded"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Engine:</span>
                <span className="font-mono font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> On-Device LiteRT
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
