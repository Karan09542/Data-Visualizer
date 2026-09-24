import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Layers,
  Sparkles,
  Copy,
  Download,
  Check,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Box,
  CircleDot,
  Palette,
  Droplet,
  Sun,
  Cloud,
  Gauge,
} from "lucide-react";
import { FileDropzoneUpload, SampleImageItem } from "./FileDropzoneUpload";
import CustomSelect from "../CustomSelect";
import { ai } from "../../ai";
import { AIProgressEvent, DepthEstimationResult } from "../../ai/types";

/** Photos with clear near and far subjects, where a depth map is easy to read. */
const SAMPLE_IMAGES: SampleImageItem[] = [
  {
    label: "Portrait",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80&auto=format&fit=crop",
    badge: "People",
    description: "A face close to the camera, background falling away",
  },
  {
    label: "Mountain Vista",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700&q=80&auto=format&fit=crop",
    badge: "Landscape",
    description: "Ridges receding into the distance",
  },
  {
    label: "Street",
    url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=700&q=80&auto=format&fit=crop",
    badge: "City",
    description: "Buildings and road stretching away",
  },
];

type DepthMode = "grayscale" | "colored" | "portrait-blur" | "relighting" | "fog";
type ViewMode = "split" | "side-by-side" | "result";
type ExportFormat = "png" | "jpeg" | "webp";

interface DepthLook {
  id: DepthMode;
  label: string;
  hint: string;
  icon: React.ReactNode;
  /** Whether the Strength control does anything for this look. */
  usesStrength: boolean;
}

const LOOKS: DepthLook[] = [
  { id: "colored", label: "Colour Map", hint: "Distance as colour, near to far", icon: <Palette size={15} />, usesStrength: false },
  { id: "grayscale", label: "Depth Map", hint: "Plain grey depth, white is nearest", icon: <CircleDot size={15} />, usesStrength: false },
  { id: "portrait-blur", label: "Portrait Blur", hint: "Subject sharp, background soft", icon: <Droplet size={15} />, usesStrength: true },
  { id: "relighting", label: "Studio Light", hint: "Light shaped by the scene's surfaces", icon: <Sun size={15} />, usesStrength: true },
  { id: "fog", label: "Fog", hint: "Haze that thickens with distance", icon: <Cloud size={15} />, usesStrength: true },
];

const STRENGTHS: { label: string; value: number }[] = [
  { label: "Soft", value: 0.6 },
  { label: "Normal", value: 1 },
  { label: "Strong", value: 1.7 },
];

const MODEL_OPTIONS = [
  { label: "Balanced", value: "depth_anything_v2", description: "28 MB · recommended" },
  { label: "Best quality", value: "depth_anything_v2_fp32", description: "100 MB · slower" },
];

const EXPORT_FORMAT_OPTIONS = [
  { label: "PNG", value: "png", description: "Lossless quality" },
  { label: "JPG", value: "jpeg", description: "Standard photo" },
  { label: "WEBP", value: "webp", description: "High compression" },
];

export function ImageDepthUtil() {
  // Source photo
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState("photo");
  const [sourceFileSize, setSourceFileSize] = useState(0);

  // What is being made, and how strongly
  const [look, setLook] = useState<DepthMode>("colored");
  const [strength, setStrength] = useState(1);
  const [modelId, setModelId] = useState(MODEL_OPTIONS[0].value);

  // The rendered result
  const [resultCanvas, setResultCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const runTokenRef = useRef(0);

  // Progress
  const [isWorking, setIsWorking] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** The job now running, so a download the user did not want can be stopped. */
  const activeJobRef = useRef<string | null>(null);

  // Viewing
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mobileTab, setMobileTab] = useState<"canvas" | "controls">("canvas");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  // Split comparison slider
  const splitBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef(false);
  const [splitPos, setSplitPos] = useState(50);

  const activeLook = useMemo(() => LOOKS.find(l => l.id === look) || LOOKS[0], [look]);

  // ── Hold space to peek at the original ───────────────────────────────────
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

  // ── Split slider drag ────────────────────────────────────────────────────
  const updateSplitFromClientX = useCallback((clientX: number) => {
    const container = splitBoxRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.max(0, Math.min(100, Math.round(pos * 10) / 10)));
  }, []);

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    isDraggingSplitRef.current = true;
    updateSplitFromClientX(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplitRef.current) return;
    e.preventDefault();
    updateSplitFromClientX(e.clientX);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplitRef.current) return;
    isDraggingSplitRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (isDraggingSplitRef.current) updateSplitFromClientX(e.clientX);
    };
    const onEnd = () => { isDraggingSplitRef.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [updateSplitFromClientX]);

  // ── Run the depth model ──────────────────────────────────────────────────
  const runDepth = useCallback(
    async (img: HTMLImageElement, mode: DepthMode, effectStrength: number, model: string) => {
      const token = ++runTokenRef.current;
      const isStale = () => runTokenRef.current !== token;
      const jobIdForRun = { current: null as string | null };

      setIsWorking(true);
      setErrorMsg(null);
      setProgressStatus("Reading the photo…");
      setProgressPercent(8);

      try {
        const source = document.createElement("canvas");
        source.width = img.naturalWidth;
        source.height = img.naturalHeight;
        source.getContext("2d")!.drawImage(img, 0, 0);
        const imageData = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);

        const { jobId, promise } = ai.execute(
          "depth-estimation",
          imageData,
          { modelId: model, metadata: { depthMode: mode, effectStrength } } as any,
          5
        );
        activeJobRef.current = jobId;
        jobIdForRun.current = jobId;

        const unsub = ai.subscribe(jobId, (ev: AIProgressEvent & { jobId: string }) => {
          if (isStale()) return;
          if (ev.state === "downloading") {
            setProgressStatus(`Downloading the depth model… ${Math.round(ev.progress || 0)}%`);
            setProgressPercent(Math.round((ev.progress || 0) * 0.6));
          } else if (ev.state === "loading-model") {
            setProgressStatus("Preparing the model…");
            setProgressPercent(65);
          } else if (ev.state === "preparing-image") {
            setProgressStatus("Fitting the photo…");
            setProgressPercent(72);
          } else if (ev.state === "inference") {
            setProgressStatus("Reading depth…");
            setProgressPercent(80);
          } else if (ev.state === "post-processing") {
            setProgressStatus("Rendering…");
            setProgressPercent(92);
          }
        });

        let result: any = null;
        try {
          result = await promise;
        } finally {
          unsub();
        }
        if (isStale()) return;

        const depth = result?.output as DepthEstimationResult | undefined;
        if (!depth?.depthMap) throw new Error("The model did not return a depth map.");

        const canvas = document.createElement("canvas");
        canvas.width = depth.depthMap.width;
        canvas.height = depth.depthMap.height;
        canvas.getContext("2d")!.putImageData(depth.depthMap, 0, 0);

        setResultCanvas(canvas);
        setProgressPercent(100);
      } catch (err: any) {
        if (isStale()) return;
        // Stopping on purpose is not a failure: leave the photo as it was and say nothing.
        if (err?.message === "AbortError") return;
        console.error("[ImageDepth] Failed:", err);
        setErrorMsg(err?.message || "Could not read depth from this photo.");
      } finally {
        if (activeJobRef.current === jobIdForRun.current) activeJobRef.current = null;
        if (!isStale()) setIsWorking(false);
      }
    },
    []
  );

  // The preview is what gets shown and exported.
  useEffect(() => {
    if (!resultCanvas) {
      setPreviewUrl("");
      return;
    }
    setPreviewUrl(resultCanvas.toDataURL("image/jpeg", 0.92));
  }, [resultCanvas]);

  // ── Picking a photo ──────────────────────────────────────────────────────
  const openImage = useCallback(
    (img: HTMLImageElement, name: string, size: number) => {
      setSourceImage(img);
      setSourceFileName(name);
      setSourceFileSize(size);
      setResultCanvas(null);
      setMobileTab("canvas");
      runDepth(img, look, strength, modelId);
    },
    [runDepth, look, strength, modelId]
  );

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => openImage(img, file.name.replace(/\.[^/.]+$/, ""), file.size);
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [openImage]
  );

  const handleSample = useCallback(
    (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => openImage(img, "depth-sample", 0);
      img.src = url;
    },
    [openImage]
  );

  // ── Changing the look re-renders from the model ──────────────────────────
  const chooseLook = (mode: DepthMode) => {
    setLook(mode);
    if (sourceImage) runDepth(sourceImage, mode, strength, modelId);
  };

  const chooseStrength = (value: number) => {
    setStrength(value);
    if (sourceImage && activeLook.usesStrength) runDepth(sourceImage, look, value, modelId);
  };

  const chooseModel = (value: string) => {
    setModelId(value);
    if (sourceImage) runDepth(sourceImage, look, strength, value);
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const copyToClipboard = async () => {
    if (!resultCanvas) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => resultCanvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Could not copy the image", err);
      setErrorMsg("Your browser would not let the image be copied. Use Save instead.");
    }
  };

  const downloadImage = () => {
    if (!resultCanvas) return;
    const mime = exportFormat === "png" ? "image/png" : exportFormat === "jpeg" ? "image/jpeg" : "image/webp";
    const ext = exportFormat === "png" ? "png" : exportFormat === "jpeg" ? "jpg" : "webp";
    resultCanvas.toBlob(
      blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sourceFileName}-${look}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      mime,
      0.95
    );
  };

  /** Stops the run, and with it the model download it may still be in the middle of. */
  const cancelRun = useCallback(() => {
    const jobId = activeJobRef.current;
    runTokenRef.current++;
    activeJobRef.current = null;
    if (jobId) ai.cancel(jobId);
    setIsWorking(false);
    setProgressPercent(0);
    setProgressStatus("");
  }, []);

  const resetAll = () => {
    runTokenRef.current++;
    setSourceImage(null);
    setResultCanvas(null);
    setPreviewUrl("");
    setIsWorking(false);
    setErrorMsg(null);
  };

  const viewButton = (mode: ViewMode, label: string, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === mode
        ? "bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs"
        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        }`}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0f16] text-slate-900 dark:text-slate-100">
      {/* ── Header ── */}
      <header className="px-2.5 sm:px-5 py-1.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 shrink-0">
            <Layers className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Image Depth
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0 hidden sm:flex items-center gap-1">
                <Sparkles size={9} /> Depth AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              See how far away everything is, then blur, light or fog the photo by distance
            </p>
          </div>
        </div>

        {sourceImage && (
          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            <div className="hidden sm:flex items-center rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#12161f]">
              {viewButton("split", "Split", <SlidersHorizontal size={13} />, "Split comparison slider")}
              {viewButton("side-by-side", "Dual", <Eye size={13} />, "Side by side")}
              {viewButton("result", "Result", <Check size={13} />, "Result only")}
            </div>

            <button
              type="button"
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border transition-colors ${isHoldingOriginal
                ? "bg-cyan-500 text-white border-cyan-500"
                : "bg-white dark:bg-[#12161f] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                }`}
              title="Hold to see the original photo (or hold Space)"
            >
              <Eye size={13} />
              <span>Original</span>
            </button>

            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!resultCanvas}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all shadow-xs border disabled:opacity-40 ${copyFeedback
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-cyan-500"
                }`}
              title="Copy the result as a PNG"
            >
              {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copyFeedback ? "Copied PNG!" : "Copy PNG"}</span>
            </button>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-[78px] sm:w-[95px]">
                <CustomSelect
                  value={exportFormat}
                  onChange={v => setExportFormat(v as ExportFormat)}
                  options={EXPORT_FORMAT_OPTIONS}
                  variant="toolbar"
                  className="text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={downloadImage}
                disabled={!resultCanvas}
                className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                title={`Save the result (${exportFormat.toUpperCase()})`}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Open a different photo"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      {!sourceImage ? (
        <div className="flex-1 flex flex-col items-center sm:justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <FileDropzoneUpload
            onFileSelected={handleFile}
            accept="image/*"
            title="Drop a Photo to Map Its Depth"
            subtitle="JPG, PNG, WEBP • or paste from the clipboard"
            pasteNotice="Paste a Photo"
            accentColor="cyan"
            enableCamera={true}
            sampleImages={SAMPLE_IMAGES}
            onSampleSelect={handleSample}
            className="w-full max-w-2xl"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
          {/* Mobile tabs */}
          <div className="md:hidden flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161f] p-1 shrink-0 z-10">
            <button
              type="button"
              onClick={() => setMobileTab("canvas")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "canvas"
                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("controls")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mobileTab === "controls"
                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
                }`}
            >
              Looks & Model
            </button>
          </div>

          {/* Viewport */}
          <div
            className={`flex-1 bg-slate-900/95 dark:bg-[#070a0f] flex items-center justify-center overflow-hidden relative select-none ${mobileTab === "canvas" ? "flex" : "hidden md:flex"
              }`}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{ backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />

            {isWorking && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
                <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center mb-3 animate-pulse">
                    <Box size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Measuring Depth</h3>
                  <p className="text-xs text-slate-400 mt-1">{progressStatus}</p>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                    <div className="bg-cyan-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={cancelRun}
                    className="mt-3.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-white/10 transition-colors active:scale-95"
                  >
                    <X size={13} /> Cancel
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">Stops the download too. What is already saved is kept.</p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-lg max-w-sm">
                <AlertCircle size={15} className="shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}

            {previewUrl && (
              <div
                className="relative max-w-full max-h-full flex items-center justify-center p-4 transition-transform duration-100"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {viewMode === "split" && !isHoldingOriginal && (
                  <div
                    ref={splitBoxRef}
                    onPointerDown={handleSplitPointerDown}
                    onPointerMove={handleSplitPointerMove}
                    onPointerUp={handleSplitPointerUp}
                    onPointerCancel={handleSplitPointerUp}
                    className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-700/60 max-w-[90vw] max-h-[75vh] cursor-ew-resize select-none touch-none"
                  >
                    <img
                      src={previewUrl}
                      alt="Depth result"
                      className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                      draggable={false}
                    />
                    <div
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                    >
                      <img
                        src={sourceImage.src}
                        alt="Original photo"
                        className="w-auto h-auto max-w-[85vw] max-h-[70vh] object-contain select-none pointer-events-none block"
                        draggable={false}
                      />
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs">
                        Original
                      </div>
                    </div>
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-cyan-600/90 backdrop-blur-xs text-[10px] font-bold tracking-wider uppercase text-white shadow-xs pointer-events-none">
                      {activeLook.label}
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none z-20 flex items-center justify-center -translate-x-1/2"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 text-cyan-500 shadow-xl border-2 border-cyan-500 flex items-center justify-center pointer-events-auto">
                        <SlidersHorizontal size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === "side-by-side" && !isHoldingOriginal && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 max-w-[90vw] max-h-[75vh]">
                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-slate-700/60">
                      <img src={sourceImage.src} alt="Original" className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        Original
                      </div>
                    </div>
                    <div className="relative rounded-xl overflow-hidden shadow-xl border border-cyan-500/40">
                      <img src={previewUrl} alt="Depth result" className="w-auto h-auto max-w-[42vw] max-h-[35vh] sm:max-h-[70vh] object-contain block" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-cyan-600/90 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-white">
                        {activeLook.label}
                      </div>
                    </div>
                  </div>
                )}

                {(viewMode === "result" || isHoldingOriginal) && (
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700/60 max-w-[85vw] max-h-[75vh]">
                    <img
                      src={isHoldingOriginal ? sourceImage.src : previewUrl}
                      alt={isHoldingOriginal ? "Original" : "Depth result"}
                      className="w-auto h-auto max-w-[85vw] max-h-[75vh] object-contain select-none block"
                    />
                    <div
                      className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase text-white shadow-xs ${isHoldingOriginal ? "bg-black/70" : "bg-cyan-600/90"
                        }`}
                    >
                      {isHoldingOriginal ? "Original" : activeLook.label}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs">
              <div className="sm:hidden flex items-center mr-1 pr-1 border-r border-white/20">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "split" ? "side-by-side" : viewMode === "side-by-side" ? "result" : "split")}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/30 text-cyan-300"
                >
                  {viewMode === "split" ? "Split" : viewMode === "side-by-side" ? "Dual" : "Result"}
                </button>
              </div>
              <button type="button" onClick={() => setZoomLevel(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} className="p-1 hover:text-cyan-400 transition-colors" title="Zoom out">
                <ZoomOut size={14} />
              </button>
              <span className="font-mono text-[11px] w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button type="button" onClick={() => setZoomLevel(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))} className="p-1 hover:text-cyan-400 transition-colors" title="Zoom in">
                <ZoomIn size={14} />
              </button>
              <div className="w-px h-3.5 bg-white/20 mx-0.5" />
              <button type="button" onClick={() => setZoomLevel(1)} className="text-[10px] font-semibold text-slate-300 hover:text-white px-1">
                Fit
              </button>
            </div>
          </div>

          {/* Controls */}
          <div
            className={`w-full md:w-80 lg:w-88 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col p-4 overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y min-h-0 ${mobileTab === "controls" ? "flex flex-1 h-full max-h-full" : "hidden md:flex md:h-full md:max-h-full"
              }`}
          >
            {/* Looks */}
            <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-500" /> What to Make
                </span>
                <span className="text-[10px] text-slate-400">1-click</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {LOOKS.map(item => {
                  const isActive = look === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseLook(item.id)}
                      disabled={isWorking}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all disabled:opacity-60 ${isActive
                        ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/40 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-[#12161f]"
                        }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-cyan-500 text-white" : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                        {item.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-bold truncate ${isActive ? "text-cyan-700 dark:text-cyan-300" : "text-slate-800 dark:text-slate-200"}`}>
                          {item.label}
                        </span>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.hint}</span>
                      </span>
                      {isActive && <Check size={14} className="ml-auto text-cyan-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strength */}
            <div className="space-y-2.5 py-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Gauge size={13} className="text-cyan-500" /> Strength
              </span>
              <div className="flex items-center gap-1.5">
                {STRENGTHS.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => chooseStrength(item.value)}
                    disabled={!activeLook.usesStrength || isWorking}
                    aria-pressed={strength === item.value}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 ${strength === item.value
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-300"
                      : "bg-white dark:bg-[#12161f] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                {activeLook.usesStrength
                  ? `How strong the ${activeLook.label.toLowerCase()} is.`
                  : "Applies to Portrait Blur, Studio Light and Fog."}
              </p>
            </div>

            {/* Model */}
            <div className="space-y-2.5 py-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-500" /> Model
              </span>
              <CustomSelect
                value={modelId}
                onChange={chooseModel}
                options={MODEL_OPTIONS}
                className="text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-400 leading-snug">
                Downloaded once, then kept on this device. Everything runs here — no photo leaves the browser.
              </p>
            </div>

            {/* Details */}
            <div className="pt-4 pb-24 md:pb-8 space-y-2 text-xs mt-2 shrink-0">
              <div className="flex items-center justify-between text-slate-400">
                <span>Photo size:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceImage.naturalWidth} × {sourceImage.naturalHeight} px
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>File size:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {sourceFileSize > 0 ? `${Math.round(sourceFileSize / 1024)} KB` : "Sample"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Showing:</span>
                <span className="font-mono font-medium text-cyan-600 dark:text-cyan-400 truncate max-w-[140px]">
                  {activeLook.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
