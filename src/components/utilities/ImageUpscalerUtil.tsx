import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Sparkles,
  Copy,
  Download,
  Check,
  RefreshCw,
  Eye,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings2,
  ArrowUpRight,
} from "lucide-react";
import { FileDropzoneUpload, SampleImageItem } from "./FileDropzoneUpload";
import { ai } from "../../ai";
import { AIProgressEvent } from "../../ai/types";

// Curated sample images for instant 1-click testing
const SAMPLE_IMAGES: SampleImageItem[] = [
  {
    label: "Portrait",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=70&auto=format&fit=crop",
    description: "Low-res face detail",
    badge: "Portrait",
  },
  {
    label: "Bird Wildlife",
    url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&q=70&auto=format&fit=crop",
    description: "Feather & macro texture",
    badge: "Nature",
  },
  {
    label: "Architecture",
    url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=70&auto=format&fit=crop",
    description: "Geometric lines & edges",
    badge: "Lines",
  },
  {
    label: "Vintage Car",
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=70&auto=format&fit=crop",
    description: "Metallic reflections",
    badge: "Vehicle",
  },
];

type ScaleFactor = 2 | 4;
type ExportFormat = "png" | "jpeg" | "webp";
type ViewMode = "split" | "side-by-side" | "result";

export function ImageUpscalerUtil() {
  // ── Source & result ──
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState("image");
  const [sourceFileSize, setSourceFileSize] = useState(0);
  const [upscaledCanvas, setUpscaledCanvas] = useState<HTMLCanvasElement | null>(null);
  const [upscaledDimensions, setUpscaledDimensions] = useState({ width: 0, height: 0 });

  // ── Settings ──
  const [scaleFactor, setScaleFactor] = useState<ScaleFactor>(4);

  // ── Processing ──
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState("Ready");
  /** The job now running, so a download the user did not want can be stopped. */
  const activeJobRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  /** Set when a run is stopped, so the automatic first run does not simply start it again. */
  const [wasCancelled, setWasCancelled] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── View ──
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // ── Export ──
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  // ── Mobile controls panel ──
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  // ── DOM refs ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const splitHandleRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef(false);
  const splitPosRef = useRef(50);

  // ═════════════════════════════════════════════════════════════
  //  CACHED PREVIEW URLS — the fix for the lag
  //  toDataURL() is called ONCE when the canvas changes, not on
  //  every render or every split-handle drag frame.
  // ═════════════════════════════════════════════════════════════
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>("");
  const [upscaledPreviewUrl, setUpscaledPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (sourceImage) setSourcePreviewUrl(sourceImage.src);
  }, [sourceImage]);

  useEffect(() => {
    if (!upscaledCanvas) {
      setUpscaledPreviewUrl("");
      return;
    }
    // Generate a display-size preview (max 2048px on longest side) for the
    // viewport. This avoids encoding a 28 MP canvas on every state change.
    const maxSide = 2048;
    const { width: cw, height: ch } = upscaledCanvas;
    let pw = cw, ph = ch;
    if (cw > maxSide || ch > maxSide) {
      const ratio = Math.min(maxSide / cw, maxSide / ch);
      pw = Math.round(cw * ratio);
      ph = Math.round(ch * ratio);
    }
    const preview = document.createElement("canvas");
    preview.width = pw;
    preview.height = ph;
    const ctx = preview.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(upscaledCanvas, 0, 0, pw, ph);
    setUpscaledPreviewUrl(preview.toDataURL("image/jpeg", 0.92));
  }, [upscaledCanvas]);

  // ═════════════════════════════════════════════════════════════
  //  SPLIT HANDLE — ref-based, zero React re-renders during drag
  // ═════════════════════════════════════════════════════════════
  const updateSplitVisual = useCallback(() => {
    const container = viewportRef.current;
    const handle = splitHandleRef.current;
    if (!container || !handle) return;
    const clipEl = container.querySelector<HTMLElement>("[data-split-clip]");
    const pct = splitPosRef.current;
    handle.style.left = `${pct}%`;
    if (clipEl) clipEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingSplitRef.current) return;
      e.preventDefault();
      const container = viewportRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      splitPosRef.current = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      requestAnimationFrame(updateSplitVisual);
    };
    const onUp = () => { isDraggingSplitRef.current = false; };
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateSplitVisual]);

  const startSplitDrag = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingSplitRef.current = true;
    const container = viewportRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    splitPosRef.current = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    requestAnimationFrame(updateSplitVisual);
  };

  // ═════════════════════════════════════════════════════════════
  //  LOAD IMAGE
  // ═════════════════════════════════════════════════════════════
  const loadImageFromFile = useCallback((file: File) => {
    setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
    setSourceFileSize(file.size);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { setSourceImage(img); setUpscaledCanvas(null); };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const loadImageFromUrl = useCallback((url: string) => {
    setErrorMsg(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setSourceImage(img);
      setSourceFileName("sample-image");
      setSourceFileSize(Math.round(img.naturalWidth * img.naturalHeight * 0.4));
      setUpscaledCanvas(null);
    };
    img.onerror = () => setErrorMsg("Failed to load sample image.");
    img.src = url;
  }, []);

  // ═════════════════════════════════════════════════════════════
  //  SPACEBAR PEEK
  // ═════════════════════════════════════════════════════════════
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault(); setIsHoldingOriginal(true);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setIsHoldingOriginal(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ═════════════════════════════════════════════════════════════
  //  AI ESRGAN UPSCALE (Real-ESRGAN x4 Super-Resolution)
  // ═════════════════════════════════════════════════════════════
  const processAIUpscale = useCallback(
    async (img: HTMLImageElement) => {
      setIsProcessing(true); setErrorMsg(null);
      cancelledRef.current = false;
      setWasCancelled(false);
      setProgressState("Initializing AI..."); setProgressPercent(10);
      try {
        const tc = document.createElement("canvas");
        tc.width = img.naturalWidth; tc.height = img.naturalHeight;
        tc.getContext("2d")!.drawImage(img, 0, 0);
        const inputData = tc.getContext("2d")!.getImageData(0, 0, tc.width, tc.height);

        const { jobId, promise } = ai.execute("upscale", inputData, { modelId: "realesrgan_x4" }, 5);
        activeJobRef.current = jobId;

        const unsub = ai.subscribe(jobId, (ev: AIProgressEvent & { jobId: string }) => {
          if (ev.state === "downloading") { setProgressState(`Downloading AI model (${ev.progress || 0}%)...`); setProgressPercent(Math.round((ev.progress || 0) * 0.4)); }
          else if (ev.state === "loading-model") { setProgressState("Loading neural runtime..."); setProgressPercent(45); }
          else if (ev.state === "preparing-image") { setProgressState("Preparing image tiles..."); setProgressPercent(55); }
          else if (ev.state === "inference") { setProgressState(`AI super-resolution (${ev.progress || 0}%)...`); setProgressPercent(55 + Math.round((ev.progress || 0) * 0.4)); }
        });

        let result: any;
        try {
          result = await promise;
        } catch (err: any) {
          // Stopping on purpose is not a failure.
          if (err?.message === "AbortError" || cancelledRef.current) return;
          throw err;
        } finally {
          unsub();
        }
        if (cancelledRef.current) return;

        if (result?.output) {
          const out = result.output;
          let oc: HTMLCanvasElement;
          if (out instanceof ImageBitmap) {
            oc = document.createElement("canvas"); oc.width = out.width; oc.height = out.height;
            oc.getContext("2d")!.drawImage(out, 0, 0);
          } else if (out instanceof ImageData) {
            oc = document.createElement("canvas"); oc.width = out.width; oc.height = out.height;
            oc.getContext("2d")!.putImageData(out, 0, 0);
          } else { throw new Error("Unexpected output format"); }

          // If user wants 2x but model outputs 4x, downscale the result
          if (scaleFactor < 4) {
            const targetW = Math.round(img.naturalWidth * scaleFactor);
            const targetH = Math.round(img.naturalHeight * scaleFactor);
            const ds = document.createElement("canvas"); ds.width = targetW; ds.height = targetH;
            const dsCtx = ds.getContext("2d")!;
            dsCtx.imageSmoothingEnabled = true; dsCtx.imageSmoothingQuality = "high";
            dsCtx.drawImage(oc, 0, 0, targetW, targetH);
            setUpscaledCanvas(ds);
            setUpscaledDimensions({ width: targetW, height: targetH });
          } else {
            setUpscaledCanvas(oc);
            setUpscaledDimensions({ width: oc.width, height: oc.height });
          }
          setProgressState("Complete"); setProgressPercent(100);
        } else { throw new Error("AI model returned empty result"); }
      } catch (err: any) {
        console.error("[ImageUpscalerUtil] AI upscale failed:", err);
        setErrorMsg(`Upscale failed: ${err?.message || "Unknown error"}. Please try again or use a smaller image.`);
        setProgressState("Failed"); setProgressPercent(0);
      } finally { activeJobRef.current = null; setIsProcessing(false); }
    }, [scaleFactor]
  );

  // ═════════════════════════════════════════════════════════════
  //  TRIGGER UPSCALE
  // ═════════════════════════════════════════════════════════════
  const triggerUpscale = useCallback(() => {
    if (!sourceImage) return;
    processAIUpscale(sourceImage);
  }, [sourceImage, processAIUpscale]);

  /** Stops the run, and with it the model download it may still be in the middle of. */
  const cancelUpscale = useCallback(() => {
    const jobId = activeJobRef.current;
    cancelledRef.current = true;
    activeJobRef.current = null;
    if (jobId) ai.cancel(jobId);
    setWasCancelled(true);
    setIsProcessing(false);
    setProgressState("Cancelled"); setProgressPercent(0);
  }, []);

  // Auto-run on first load - but never again after the user has stopped one.
  useEffect(() => {
    if (sourceImage && !upscaledCanvas && !isProcessing && !wasCancelled) triggerUpscale();
  }, [sourceImage, upscaledCanvas, isProcessing, wasCancelled, triggerUpscale]);

  // ═════════════════════════════════════════════════════════════
  //  EXPORT: COPY & DOWNLOAD
  // ═════════════════════════════════════════════════════════════
  const handleCopyPNG = async () => {
    if (!upscaledCanvas) return;
    try {
      const blob = await new Promise<Blob | null>((r) => upscaledCanvas.toBlob((b) => r(b), "image/png"));
      if (!blob) throw new Error("Blob creation failed");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2200);
    } catch { alert("Unable to copy. Please use Download instead."); }
  };

  const handleDownload = () => {
    if (!upscaledCanvas) return;
    const mime = exportFormat === "jpeg" ? "image/jpeg" : exportFormat === "webp" ? "image/webp" : "image/png";
    const q = exportFormat === "png" ? undefined : 0.95;
    const url = upscaledCanvas.toDataURL(mime, q);
    const a = document.createElement("a");
    a.download = `${sourceFileName}_upscaled_${scaleFactor}x.${exportFormat}`;
    a.href = url; a.click();
  };

  const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const k = 1024, s = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
  };

  const estimatedSize = useMemo(
    () => (upscaledDimensions.width ? Math.round(upscaledDimensions.width * upscaledDimensions.height * 0.75) : 0),
    [upscaledDimensions]
  );

  // ═════════════════════════════════════════════════════════════
  //  CONTROLS PANEL (shared between sidebar & mobile bottom sheet)
  // ═════════════════════════════════════════════════════════════
  const ControlsContent = () => (
    <div className="space-y-4">
      {/* AI Engine Badge */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30">
        <Sparkles size={16} className="text-indigo-500 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Real-ESRGAN (x4)</div>
          <div className="text-[10px] text-indigo-500/70 dark:text-indigo-400/60">Deep neural super-resolution</div>
        </div>
      </div>

      {/* Scale Factor */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Output Scale</label>
          <span className="text-[11px] font-bold text-indigo-500">{scaleFactor}x</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([2, 4] as ScaleFactor[]).map((f) => (
            <button key={f} type="button" onClick={() => setScaleFactor(f)}
              className={`py-1.5 rounded-lg font-bold text-xs border transition-all ${scaleFactor === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >{f}x{f === 4 ? " (native)" : ""}</button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Model outputs 4x natively. 2x downscales the result for smaller files.</p>
      </div>

      {/* Info Card */}
      {sourceImage && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b24] p-2.5 text-[11px] space-y-1">
          <div className="flex justify-between text-slate-500">
            <span>Original</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{sourceImage.naturalWidth}×{sourceImage.naturalHeight} ({formatBytes(sourceFileSize)})</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Upscaled ({scaleFactor}x)</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{upscaledDimensions.width}×{upscaledDimensions.height} (~{formatBytes(estimatedSize)})</span>
          </div>
          <div className="flex justify-between text-slate-500 text-[10px]">
            <span>Total</span>
            <span className="font-mono">{((upscaledDimensions.width * upscaledDimensions.height) / 1e6).toFixed(1)} MP</span>
          </div>
        </div>
      )}

      {/* Export format */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">Export Format</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["png", "webp", "jpeg"] as ExportFormat[]).map((f) => (
            <button key={f} type="button" onClick={() => setExportFormat(f)}
              className={`py-1 rounded-lg text-[11px] font-bold uppercase border transition-all ${exportFormat === f
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Re-run button */}
      <button type="button" onClick={triggerUpscale} disabled={!sourceImage || isProcessing}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        <Sparkles size={14} />
        {isProcessing ? "Processing..." : "Re-Upscale"}
      </button>
    </div>
  );

  // ═════════════════════════════════════════════════════════════
  //  RENDER — EMPTY STATE
  // ═════════════════════════════════════════════════════════════
  if (!sourceImage) {
    return (
      <div className="flex-1 flex flex-col sm:items-center sm:justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0c1017]">
        {/* Header */}
        <div className="w-full max-w-xl mb-5 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl text-white shadow-sm">
              <ArrowUpRight size={20} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Image Upscaler</h2>
            <span className="text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              <Sparkles size={10} className="inline mr-0.5" /> AI Powered
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scale up to 4x resolution with AI neural super-resolution & lossless PNG export
          </p>
        </div>
        <FileDropzoneUpload
          onImageSelected={loadImageFromFile}
          accept="image/*"
          title="Drop Image to Upscale"
          subtitle="Supports PNG, JPG, WEBP, AVIF, BMP • or click to browse"
          pasteNotice="Paste Image"
          accentColor="indigo"
          sampleImages={SAMPLE_IMAGES}
          onSampleSelect={loadImageFromUrl}
          className="max-w-xl"
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  //  RENDER — ACTIVE WORKSPACE
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0c1017] overflow-hidden select-none">
      {/* ─── Top toolbar ─── */}
      <header className="flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg text-white shadow-sm shrink-0">
            <ArrowUpRight size={14} />
          </div>
          <div className="min-w-0 hidden xs:block">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">Image Upscaler & Super-Resolution</h2>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Hold to peek */}
          <button type="button" onMouseDown={() => setIsHoldingOriginal(true)} onMouseUp={() => setIsHoldingOriginal(false)}
            onTouchStart={() => setIsHoldingOriginal(true)} onTouchEnd={() => setIsHoldingOriginal(false)}
            className={`p-1.5 rounded-lg border text-xs transition-all ${isHoldingOriginal ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            title="Hold to see original"
          ><Eye size={14} /></button>

          {/* Copy PNG */}
          {upscaledCanvas && (
            <button type="button" onClick={handleCopyPNG}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${copyFeedback
                ? "bg-emerald-600 text-white" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/50"}`}
            >
              {copyFeedback ? <Check size={13} /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copyFeedback ? "Copied!" : "Copy PNG"}</span>
            </button>
          )}

          {/* Download */}
          {upscaledCanvas && (
            <button type="button" onClick={handleDownload}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg font-semibold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
            ><Download size={13} /><span className="hidden sm:inline">Download</span></button>
          )}

          {/* Replace image */}
          <label className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors" title="Replace image">
            <RefreshCw size={13} />
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImageFromFile(f); }} className="sr-only" />
          </label>

          {/* Mobile settings toggle */}
          <button type="button" onClick={() => setMobileControlsOpen(!mobileControlsOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          ><Settings2 size={14} /></button>
        </div>
      </header>

      {/* ─── Main body: viewport + sidebar ─── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ─── Image Viewport ─── */}
        <div className="flex-1 flex flex-col h-full bg-[#080b10] relative overflow-hidden">
          {/* View mode bar */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-black/40 border-b border-white/10 z-10 shrink-0">
            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-md border border-white/10">
              {(["split", "side-by-side", "result"] as ViewMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setViewMode(m)}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${viewMode === m ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >{m === "split" ? "Split" : m === "side-by-side" ? "Compare" : "Result"}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <button type="button" onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="p-0.5 hover:bg-white/10 rounded"><ZoomOut size={13} /></button>
              <span className="w-10 text-center text-[10px] font-mono text-slate-300">{Math.round(zoomLevel * 100)}%</span>
              <button type="button" onClick={() => setZoomLevel(z => Math.min(3, +(z + 0.25).toFixed(2)))} className="p-0.5 hover:bg-white/10 rounded"><ZoomIn size={13} /></button>
              <button type="button" onClick={() => setZoomLevel(1)} className="p-0.5 hover:bg-white/10 rounded ml-0.5"><RotateCcw size={12} /></button>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-[11px] flex items-center justify-between z-10 shrink-0">
              <span className="flex items-center gap-1"><AlertCircle size={12} />{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-xs font-bold px-1">✕</button>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-2.5">
              <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl text-indigo-400 animate-pulse"><Loader2 size={28} className="animate-spin" /></div>
              <div className="text-center space-y-1">
                <div className="text-xs font-bold text-white">{progressState}</div>
                <div className="w-40 bg-white/10 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <button
                type="button"
                onClick={cancelUpscale}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 border border-white/10 transition-colors active:scale-95"
              >
                <X size={13} /> Cancel
              </button>
              <p className="text-[10px] text-white/40">Stops the download too. What is already saved is kept.</p>
            </div>
          )}

          {/* ─── Canvas viewport ─── */}
          <div
            ref={viewportRef}
            className="flex-1 relative flex items-center justify-center overflow-auto p-2 sm:p-4"
            style={{
              backgroundImage: "linear-gradient(45deg,#10141d 25%,transparent 25%),linear-gradient(-45deg,#10141d 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#10141d 75%),linear-gradient(-45deg,transparent 75%,#10141d 75%)",
              backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            }}
          >
            {/* ── SPLIT VIEW ── */}
            {viewMode === "split" && (
              <div className="relative max-w-full max-h-full" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center" }}
                onMouseDown={startSplitDrag} onTouchStart={startSplitDrag}
              >
                {/* After (upscaled) — base layer */}
                <img
                  src={isHoldingOriginal ? sourcePreviewUrl : (upscaledPreviewUrl || sourcePreviewUrl)}
                  alt="Upscaled"
                  className="max-h-[calc(100dvh-200px)] max-w-full object-contain rounded-md shadow-2xl pointer-events-none"
                  draggable={false}
                />
                {/* Before (original) — clipped overlay */}
                {!isHoldingOriginal && upscaledPreviewUrl && (
                  <div data-split-clip className="absolute inset-0 overflow-hidden rounded-md pointer-events-none" style={{ clipPath: `inset(0 50% 0 0)` }}>
                    <img src={sourcePreviewUrl} alt="Original" className="w-full h-full object-contain" draggable={false} />
                  </div>
                )}
                {/* Handle bar */}
                {!isHoldingOriginal && upscaledPreviewUrl && (
                  <div ref={splitHandleRef}
                    className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-20 flex items-center justify-center cursor-ew-resize shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                    style={{ left: "50%", transform: "translateX(-50%)" }}
                  >
                    <div className="w-6 h-6 bg-white text-slate-800 rounded-full flex items-center justify-center shadow-md border border-slate-200 text-[9px] font-bold select-none pointer-events-none">◀▶</div>
                  </div>
                )}
                {/* Labels */}
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/70 text-white border border-white/10 pointer-events-none">
                  Before
                </span>
                {upscaledPreviewUrl && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600/90 text-white border border-indigo-400/30 pointer-events-none">
                    {scaleFactor}x Upscaled
                  </span>
                )}
              </div>
            )}

            {/* ── SIDE BY SIDE VIEW ── */}
            {viewMode === "side-by-side" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-full max-h-full overflow-auto items-center p-1" style={{ transform: `scale(${zoomLevel})` }}>
                <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/50 p-1 flex flex-col items-center">
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/80 text-white border border-white/10 z-10">
                    Original ({sourceImage.naturalWidth}×{sourceImage.naturalHeight})
                  </span>
                  <img src={sourcePreviewUrl} alt="Original" className="max-h-[300px] sm:max-h-[400px] object-contain rounded" draggable={false} />
                </div>
                <div className="relative rounded-lg overflow-hidden border border-indigo-500/30 bg-black/50 p-1 flex flex-col items-center">
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white z-10">
                    {scaleFactor}x ({upscaledDimensions.width}×{upscaledDimensions.height})
                  </span>
                  {upscaledPreviewUrl ? (
                    <img src={upscaledPreviewUrl} alt="Upscaled" className="max-h-[300px] sm:max-h-[400px] object-contain rounded" draggable={false} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-500 text-xs">Processing...</div>
                  )}
                </div>
              </div>
            )}

            {/* ── RESULT ONLY VIEW ── */}
            {viewMode === "result" && (
              <div className="relative max-w-full max-h-full flex items-center justify-center" style={{ transform: `scale(${zoomLevel})` }}>
                <img
                  src={isHoldingOriginal ? sourcePreviewUrl : (upscaledPreviewUrl || sourcePreviewUrl)}
                  alt={isHoldingOriginal ? "Original" : "Upscaled"}
                  className="max-h-[calc(100dvh-200px)] max-w-full object-contain rounded-md shadow-2xl"
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── Desktop Sidebar (hidden on mobile) ─── */}
        <aside className="hidden md:flex w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] flex-col shrink-0 overflow-y-auto custom-scrollbar p-3.5">
          <ControlsContent />
        </aside>

        {/* ─── Mobile Bottom Sheet ─── */}
        {mobileControlsOpen && (
          <div className="md:hidden absolute inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-200">
            <div className="bg-white dark:bg-[#121620] border-t border-slate-200 dark:border-slate-800 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Drag pill & close */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#121620] z-10">
                <span className="text-xs font-bold text-slate-500">Settings</span>
                <button type="button" onClick={() => setMobileControlsOpen(false)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Done</button>
              </div>
              <div className="p-3.5">
                <ControlsContent />
              </div>
            </div>
          </div>
        )}

        {/* Mobile backdrop for bottom sheet */}
        {mobileControlsOpen && (
          <div className="md:hidden absolute inset-0 bg-black/40 z-30" onClick={() => setMobileControlsOpen(false)} />
        )}
      </div>
    </div>
  );
}
