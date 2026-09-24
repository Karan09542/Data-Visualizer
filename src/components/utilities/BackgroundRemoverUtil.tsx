import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  Upload,
  Download,
  Copy,
  Check,
  Camera,
  RotateCcw,
  Sliders,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  Eraser,
  Undo2,
  Redo2,
  Paintbrush,
  Eye,
  AlertCircle,
  RefreshCw,
  Layers,
  GripVertical,
  CheckCircle2,
  PanelRight,
  PanelRightClose,
  SlidersHorizontal,
  Feather,
  Pipette,
} from "lucide-react";
import { getColorSync, getPaletteSync } from "colorthief";
import { ai } from "../../ai";
import { modelRegistry } from "../../ai/registry";
import { modelManager } from "../../ai/manager/ModelManager";
import { EraserEngine } from "../../lib/eraser";
import type { EraseStroke } from "../../lib/eraser";
import { CameraCaptureModal } from "../CameraCaptureModal";
import { useClipboardImages } from "./useQuickUtilsPaste";
import { formatFileSize } from "../../lib/formatFileSize";
import { ColorPickerTrigger } from "../image-workspace/components/shared/ColorPickers";

type ViewMode = "slider" | "cutout" | "retouch" | "sidebyside";
type BgType = "transparent" | "color" | "gradient" | "blur";
type RetouchMode = "erase" | "restore";

interface BackgroundRemoverUtilProps {
  onSelectImageForWorkspace?: (blob: Blob) => void;
}

const PRESET_COLORS = [
  { label: "Pure White", value: "#ffffff" },
  { label: "Studio Light", value: "#f1f5f9" },
  { label: "Pure Black", value: "#000000" },
  { label: "Deep Slate", value: "#0f172a" },
  { label: "Sky Blue", value: "#38bdf8" },
  { label: "Royal Blue", value: "#2563eb" },
  { label: "Emerald", value: "#10b981" },
  { label: "Warm Amber", value: "#f59e0b" },
  { label: "Rose Coral", value: "#f43f5e" },
  { label: "Vibrant Violet", value: "#8b5cf6" },
];

const PRESET_GRADIENTS = [
  { label: "Sunset Glow", from: "#f59e0b", to: "#f43f5e" },
  { label: "Ocean Breeze", from: "#06b6d4", to: "#2563eb" },
  { label: "Midnight Neon", from: "#1e1b4b", to: "#4c1d95" },
  { label: "Pastel Dream", from: "#ffe4e6", to: "#ccfbf1" },
  { label: "Emerald Aura", from: "#064e3b", to: "#059669" },
  { label: "Warm Studio", from: "#f8fafc", to: "#cbd5e1" },
];

const PRESET_SHADOW_COLORS = [
  { label: "Classic Black", value: "#000000" },
  { label: "Cool Slate", value: "#475569" },
  { label: "Warm Charcoal", value: "#292524" },
  { label: "Indigo Glow", value: "#6366f1" },
  { label: "Rose Glow", value: "#f43f5e" },
  { label: "Amber Glow", value: "#f59e0b" },
  { label: "Emerald Glow", value: "#10b981" },
  { label: "Cyan Glow", value: "#06b6d4" },
];

// Helper: Convert hex or rgb string to rgba with target alpha opacity
function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  if (hex.startsWith("rgba")) return hex;
  if (hex.startsWith("rgb")) {
    return hex.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 0, 0, ${alpha})`;
}

// Helper: Extract dominant color and palette from an image using colorthief
function extractImageColors(img: HTMLImageElement): { dominant: string; palette: string[] } | null {
  try {
    const dominant = getColorSync(img);
    const palette = getPaletteSync(img, { colorCount: 10 });
    const domHex = dominant ? dominant.hex() : null;
    const palHexes = palette ? (palette as any[]).map((c) => c.hex?.() || c).filter(Boolean) : [];
    if (!domHex && palHexes.length === 0) return null;
    const unique = Array.from(new Set(palHexes.length > 0 ? palHexes : [domHex])).filter(Boolean) as string[];
    return {
      dominant: domHex || unique[0] || "#3b82f6",
      palette: unique,
    };
  } catch {
    // If CORS or decoding error occurs when accessing img directly, try drawing to an in-memory canvas
    try {
      const c = document.createElement("canvas");
      const w = Math.min(250, img.naturalWidth || img.width || 250);
      const h = Math.min(250, img.naturalHeight || img.height || 250);
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const dominant = getColorSync(c);
        const palette = getPaletteSync(c, { colorCount: 10 });
        const domHex = dominant ? dominant.hex() : null;
        const palHexes = palette ? (palette as any[]).map((col) => col.hex?.() || col).filter(Boolean) : [];
        const unique = Array.from(new Set(palHexes.length > 0 ? palHexes : [domHex])).filter(Boolean) as string[];
        return {
          dominant: domHex || unique[0] || "#3b82f6",
          palette: unique,
        };
      }
    } catch (e2) {
      console.warn("ColorThief extraction fallback failed:", e2);
    }
    return null;
  }
}

const SAMPLE_IMAGES = [
  {
    name: "Model Portrait",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    badge: "Portrait",
  },
  {
    name: "Sneaker Product",
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    badge: "Product",
  },
  {
    name: "Cute Puppy",
    url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
    badge: "Pet",
  },
];

export function BackgroundRemoverUtil({ onSelectImageForWorkspace }: BackgroundRemoverUtilProps) {
  // Image state
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("image.png");
  const [imageSize, setImageSize] = useState<number | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [maskImageData, setMaskImageData] = useState<ImageData | null>(null);

  // AI Model State
  const bgModels = useMemo(() => modelRegistry.getForTask("background-removal"), []);
  // Default to u2netp because it is local and instantly available
  const [modelId, setModelId] = useState<string>("u2netp");
  const [modelReady, setModelReady] = useState<Record<string, boolean>>({});
  const [modelDownloadProgress, setModelDownloadProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiStage, setAiStage] = useState<{ state: string; progress: number } | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // View & Canvas State
  const [viewMode, setViewMode] = useState<ViewMode>("slider");
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Background Options
  const [bgType, setBgType] = useState<BgType>("transparent");
  const [solidColor, setSolidColor] = useState<string>("#ffffff");
  const [selectedGradient, setSelectedGradient] = useState<{ from: string; to: string }>(PRESET_GRADIENTS[0]);

  // Enhancements
  const [shadowEnabled, setShadowEnabled] = useState<boolean>(false);
  const [shadowBlur, setShadowBlur] = useState<number>(20);
  const [shadowOpacity, setShadowOpacity] = useState<number>(0.35);
  const [shadowColor, setShadowColor] = useState<string>("#000000");

  // Extracted Colors from Image (ColorThief)
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
  const [extractedDominant, setExtractedDominant] = useState<string | null>(null);
  const [isExtractingColors, setIsExtractingColors] = useState<boolean>(false);

  // Retouch / EraserEngine state
  const [retouchMode, setRetouchMode] = useState<RetouchMode>("erase");
  const [brushSize, setBrushSize] = useState<number>(36);
  const [brushHardness, setBrushHardness] = useState<number>(85); // 0 to 100 scale (85 = slightly soft, 100 = hard)
  const [brushOpacity, setBrushOpacity] = useState<number>(100); // 10 to 100 scale
  const [undoCount, setUndoCount] = useState<number>(0);
  const [redoCount, setRedoCount] = useState<number>(0);
  const [isTouchUpExpanded, setIsTouchUpExpanded] = useState<boolean>(false);

  // Responsive Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<"canvas" | "studio">("canvas");

  // Modals & Feedback
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eraserRef = useRef<EraserEngine | null>(null);
  const customCursorRef = useRef<HTMLDivElement>(null);
  const redoStrokesRef = useRef<EraseStroke[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const isSliderDraggingRef = useRef<boolean>(false);
  const sliderBarRef = useRef<HTMLDivElement>(null);

  // Check which models are already cached
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        bgModels.map(async (m) => {
          try {
            return [m.id, await modelManager.isDownloaded(m.id)] as const;
          } catch {
            return [m.id, false] as const;
          }
        })
      );
      if (!cancelled) setModelReady(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [bgModels]);

  // Load and process an image file
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageName(file.name);
    setImageSize(file.size);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedImageSrc(dataUrl);

      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        // Start background removal automatically with chosen model
        triggerBackgroundRemoval(img, modelId);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [modelId]);

  // Automatically extract colors with ColorThief whenever originalImage is loaded
  useEffect(() => {
    if (!originalImage) {
      setExtractedPalette([]);
      setExtractedDominant(null);
      return;
    }

    const runExtraction = () => {
      setIsExtractingColors(true);
      try {
        const result = extractImageColors(originalImage);
        if (result) {
          if (result.dominant) setExtractedDominant(result.dominant);
          if (result.palette && result.palette.length > 0) {
            setExtractedPalette(result.palette);
          }
        }
      } finally {
        setIsExtractingColors(false);
      }
    };

    if (originalImage.complete && originalImage.naturalWidth > 0) {
      runExtraction();
    } else {
      originalImage.addEventListener("load", runExtraction, { once: true });
    }
  }, [originalImage]);

  // Compute smart image-matched two-tone gradients from extracted palette
  const imageMatchedGradients = useMemo(() => {
    if (!extractedPalette || extractedPalette.length === 0) return [];
    const list: { label: string; from: string; to: string }[] = [];
    if (extractedDominant && extractedPalette[0]) {
      list.push({
        label: "Image Mood",
        from: extractedDominant,
        to: extractedPalette[0] === extractedDominant && extractedPalette[1] ? extractedPalette[1] : (extractedPalette[0] || "#ffffff"),
      });
    }
    for (let i = 0; i < extractedPalette.length - 1; i += 2) {
      if (list.length >= 6) break;
      list.push({
        label: `Tone ${Math.floor(i / 2) + 1}`,
        from: extractedPalette[i],
        to: extractedPalette[i + 1] || extractedPalette[0],
      });
    }
    // Also add a soft ambient gradient (dominant to studio light)
    if (extractedDominant) {
      list.push({
        label: "Ambient",
        from: extractedDominant,
        to: "#f8fafc",
      });
    }
    return list;
  }, [extractedPalette, extractedDominant]);

  // Handle Clipboard Paste using useClipboardImages
  useClipboardImages(
    (images) => {
      if (images[0]) handleImageFile(images[0]);
    },
    { enabled: !isCameraOpen }
  );

  // Initialize EraserEngine once a new cut-out is produced
  const initEraserEngine = (cutout: ImageData, original: HTMLImageElement) => {
    const width = cutout.width;
    const height = cutout.height;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sCtx = sourceCanvas.getContext("2d")!;
    sCtx.drawImage(original, 0, 0, width, height);
    const origData = sCtx.getImageData(0, 0, width, height);

    // Create baseMask: Opaque where the model removed the background, clear where it kept the subject
    const mask = new ImageData(width, height);
    for (let i = 3; i < cutout.data.length; i += 4) {
      const kept = cutout.data[i];
      const originalAlpha = origData.data[i];
      mask.data[i] = originalAlpha === 0 ? 0 : 255 - Math.min(255, Math.round((kept * 255) / originalAlpha));
    }

    const baseMask = document.createElement("canvas");
    baseMask.width = width;
    baseMask.height = height;
    baseMask.getContext("2d")!.putImageData(mask, 0, 0);

    eraserRef.current?.destroy();
    eraserRef.current = new EraserEngine(sourceCanvas, width, height, baseMask);
    redoStrokesRef.current = [];
    setUndoCount(0);
    setRedoCount(0);
  };

  // Run AI Background Removal
  const triggerBackgroundRemoval = async (img: HTMLImageElement, chosenModelId: string) => {
    setIsProcessing(true);
    setAiStage({ state: "preparing-image", progress: 0 });

    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const { jobId, promise } = ai.execute("background-removal", imageData, { modelId: chosenModelId }, 1);
      activeJobIdRef.current = jobId;

      const unsubscribe = ai.subscribe(jobId, (event) => {
        setAiStage({ state: event.state, progress: Math.round(event.progress ?? 0) });
      });

      let result;
      try {
        result = await promise;
      } finally {
        unsubscribe();
        setAiStage(null);
        activeJobIdRef.current = null;
      }

      if (result && result.output instanceof ImageData) {
        setMaskImageData(result.output);
        initEraserEngine(result.output, img);
        setModelReady((prev) => ({ ...prev, [chosenModelId]: true }));
      }
    } catch (err: any) {
      if (err?.message !== "AbortError") {
        console.error("Background removal error:", err);
        setCopyError("Failed to remove background. Please try again or switch model.");
        setTimeout(() => setCopyError(null), 4000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAi = () => {
    if (activeJobIdRef.current) {
      ai.cancel(activeJobIdRef.current);
      activeJobIdRef.current = null;
      setIsProcessing(false);
      setAiStage(null);
    }
  };

  // Redraw the main display canvas
  const renderCompositeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;

    const width = originalImage.naturalWidth || originalImage.width;
    const height = originalImage.naturalHeight || originalImage.height;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    // Source cutout canvas from eraser or maskImageData
    const cutoutCanvas = eraserRef.current ? eraserRef.current.canvas : null;

    if (!cutoutCanvas && !maskImageData) {
      ctx.drawImage(originalImage, 0, 0);
      return;
    }

    const drawCutoutLayer = (targetCtx: CanvasRenderingContext2D) => {
      if (cutoutCanvas) {
        targetCtx.drawImage(cutoutCanvas, 0, 0);
      } else if (maskImageData) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext("2d")!.putImageData(maskImageData, 0, 0);
        targetCtx.drawImage(tempCanvas, 0, 0);
      }
    };

    // If holding space/button to peek at original
    if (isHoldingOriginal) {
      ctx.drawImage(originalImage, 0, 0);
      return;
    }

    // Helper: Draw background on target context
    const drawBackground = (targetCtx: CanvasRenderingContext2D) => {
      if (bgType === "color") {
        targetCtx.fillStyle = solidColor;
        targetCtx.fillRect(0, 0, width, height);
      } else if (bgType === "gradient") {
        const grad = targetCtx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, selectedGradient.from);
        grad.addColorStop(1, selectedGradient.to);
        targetCtx.fillStyle = grad;
        targetCtx.fillRect(0, 0, width, height);
      } else if (bgType === "blur") {
        targetCtx.save();
        targetCtx.filter = "blur(28px)";
        targetCtx.drawImage(originalImage, -20, -20, width + 40, height + 40);
        targetCtx.restore();
      }
    };

    // Helper: Draw drop shadow on target context
    const drawShadowAndCutout = (targetCtx: CanvasRenderingContext2D) => {
      if (shadowEnabled) {
        targetCtx.save();
        targetCtx.shadowColor = hexToRgba(shadowColor, shadowOpacity);
        targetCtx.shadowBlur = shadowBlur;
        targetCtx.shadowOffsetX = 0;
        targetCtx.shadowOffsetY = shadowBlur / 2;
        drawCutoutLayer(targetCtx);
        targetCtx.restore();
      }
      drawCutoutLayer(targetCtx);
    };

    if (viewMode === "slider") {
      // Split Before/After:
      // Left side: Original Image
      // Right side: Background-removed Cutout
      const splitX = Math.round((sliderPos / 100) * width);

      // Draw original on left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, height);
      ctx.clip();
      ctx.drawImage(originalImage, 0, 0);
      ctx.restore();

      // Draw processed on right
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, width - splitX, height);
      ctx.clip();
      drawBackground(ctx);
      drawShadowAndCutout(ctx);
      ctx.restore();

      // Divider line
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, Math.round(width / 500));
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();
      ctx.restore();
    } else if (viewMode === "sidebyside") {
      // Draw standard cutout with background
      drawBackground(ctx);
      drawShadowAndCutout(ctx);
    } else {
      // "cutout" or "retouch"
      drawBackground(ctx);
      drawShadowAndCutout(ctx);
    }
  }, [
    originalImage,
    maskImageData,
    viewMode,
    sliderPos,
    isHoldingOriginal,
    bgType,
    solidColor,
    selectedGradient,
    shadowEnabled,
    shadowBlur,
    shadowOpacity,
    shadowColor,
  ]);

  // Trigger composite render when state changes
  useEffect(() => {
    renderCompositeCanvas();
  }, [renderCompositeCanvas]);

  // Generate a standalone canvas for exporting / copying
  const generateExportCanvas = (transparentOnly = false): HTMLCanvasElement | null => {
    if (!originalImage) return null;
    const width = originalImage.naturalWidth || originalImage.width;
    const height = originalImage.naturalHeight || originalImage.height;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext("2d")!;

    const cutoutCanvas = eraserRef.current ? eraserRef.current.canvas : null;

    const drawCutoutLayer = () => {
      if (cutoutCanvas) {
        ctx.drawImage(cutoutCanvas, 0, 0);
      } else if (maskImageData) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext("2d")!.putImageData(maskImageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    if (!transparentOnly && bgType !== "transparent") {
      if (bgType === "color") {
        ctx.fillStyle = solidColor;
        ctx.fillRect(0, 0, width, height);
      } else if (bgType === "gradient") {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, selectedGradient.from);
        grad.addColorStop(1, selectedGradient.to);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (bgType === "blur") {
        ctx.save();
        ctx.filter = "blur(28px)";
        ctx.drawImage(originalImage, -20, -20, width + 40, height + 40);
        ctx.restore();
      }
    }

    if (!transparentOnly && shadowEnabled) {
      ctx.save();
      ctx.shadowColor = hexToRgba(shadowColor, shadowOpacity);
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowBlur / 2;
      drawCutoutLayer();
      ctx.restore();
    }

    drawCutoutLayer();
    return outCanvas;
  };

  // Copy Cutout to Clipboard as PNG
  const handleCopyPNG = async () => {
    if (!maskImageData) return;
    try {
      const exportCanvas = generateExportCanvas(bgType === "transparent");
      if (!exportCanvas) return;

      const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not export blob");

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2200);
    } catch (err) {
      console.error("Clipboard write error:", err);
      setCopyError("Clipboard permission denied or not supported in this browser.");
      setTimeout(() => setCopyError(null), 3500);
    }
  };

  // Download Cutout as PNG file
  const handleDownloadPNG = (transparentOnly = false) => {
    const exportCanvas = generateExportCanvas(transparentOnly);
    if (!exportCanvas) return;

    const link = document.createElement("a");
    const baseName = imageName.replace(/\.[^/.]+$/, "");
    link.download = transparentOnly || bgType === "transparent" ? `${baseName}-cutout.png` : `${baseName}-composite.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  // Local Undo / Redo for EraserEngine
  const handleUndo = useCallback(() => {
    const engine = eraserRef.current;
    if (!engine) return;
    const strokes = engine.getStrokes();
    if (strokes.length === 0) return;

    const last = strokes[strokes.length - 1];
    engine.removeStroke(last.id);
    redoStrokesRef.current.push(last);
    setUndoCount(strokes.length - 1);
    setRedoCount(redoStrokesRef.current.length);
    renderCompositeCanvas();
  }, [renderCompositeCanvas]);

  const handleRedo = useCallback(() => {
    const engine = eraserRef.current;
    if (!engine) return;
    const stroke = redoStrokesRef.current.pop();
    if (!stroke) return;

    engine.applyStroke(stroke);
    setUndoCount(engine.getStrokes().length);
    setRedoCount(redoStrokesRef.current.length);
    renderCompositeCanvas();
  }, [renderCompositeCanvas]);

  // Reset all touch-ups
  const handleResetRetouch = useCallback(() => {
    if (originalImage && maskImageData) {
      initEraserEngine(maskImageData, originalImage);
      renderCompositeCanvas();
    }
  }, [originalImage, maskImageData, renderCompositeCanvas]);

  // KEYBOARD SHORTCUTS: Strictly isolated to prevent triggering global app undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey));

      if (isUndo) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleUndo();
        return;
      }

      if (isRedo) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRedo();
        return;
      }

      // Ctrl + C to copy PNG
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !e.shiftKey && !e.altKey) {
        if (maskImageData) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleCopyPNG();
          return;
        }
      }

      // Spacebar to peek original
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsHoldingOriginal(false);
      }
    };

    // Capture phase listeners ensure events are caught and stopped before reaching background listeners
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [handleUndo, handleRedo, maskImageData]);

  // Retouch Pointer Handlers on the canvas with exact coordinate and brush size mapping
  const getCanvasPointAndScale = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));

    // Scale brush size from display screen pixels to canvas bitmap pixels so that visual size matches exactly
    const canvasBrushSize = Math.max(1, brushSize * scaleX);

    return {
      point: { x, y },
      canvasBrushSize,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "retouch") return;
    if (e.button !== 0) return; // Only primary button
    const engine = eraserRef.current;
    if (!engine) return;

    const result = getCanvasPointAndScale(e);
    if (!result) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;

    // Defensively clamp opacity & hardness on 0-100 scale (protecting against stale fast-refresh fractional state)
    const effectiveOpacity = Math.max(10, Math.min(100, brushOpacity <= 1 ? 100 : brushOpacity));
    const effectiveHardness = Math.max(0, Math.min(100, brushHardness <= 1 ? 85 : brushHardness));

    engine.beginStroke(result.point, {
      mode: retouchMode,
      size: result.canvasBrushSize,
      hardness: effectiveHardness,
      opacity: effectiveOpacity,
    });
    renderCompositeCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 1. Position custom cursor ring directly at exact mouse clientX, clientY
    if (customCursorRef.current) {
      if (viewMode === "retouch") {
        customCursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
        customCursorRef.current.style.display = "block";
      } else {
        customCursorRef.current.style.display = "none";
      }
    }

    // 2. Extend drawing stroke if pointer is pressed
    if (viewMode !== "retouch" || !isPointerDownRef.current) return;
    const engine = eraserRef.current;
    if (!engine) return;

    const result = getCanvasPointAndScale(e);
    if (!result) return;

    engine.extendStroke(result.point);
    renderCompositeCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "retouch" || !isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const engine = eraserRef.current;
    if (!engine) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }

    const stroke = engine.endStroke();
    if (stroke) {
      redoStrokesRef.current = [];
      setUndoCount(engine.getStrokes().length);
      setRedoCount(0);
    }
    renderCompositeCanvas();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (customCursorRef.current && viewMode === "retouch") {
      customCursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      customCursorRef.current.style.display = "block";
    }
  };

  const handlePointerLeave = () => {
    if (customCursorRef.current && !isPointerDownRef.current) {
      customCursorRef.current.style.display = "none";
    }
  };

  // Slider pointer handlers for Split Slider view mode
  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isSliderDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderPosFromEvent(e);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSliderDraggingRef.current) return;
    updateSliderPosFromEvent(e);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSliderDraggingRef.current) return;
    isSliderDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  const updateSliderPosFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const clientX = e.clientX;
    const newPos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(Math.round(newPos));
  };

  // Drag & drop on the upload zone
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  // Load sample image
  const handleLoadSample = async (url: string, name: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const file = new File([blob], `${name.toLowerCase().replace(/\s+/g, "-")}.jpg`, { type: blob.type || "image/jpeg" });
      handleImageFile(file);
    } catch {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImageName(`${name.toLowerCase().replace(/\s+/g, "-")}.jpg`);
        setImageSize(null);
        setSelectedImageSrc(url);
        setOriginalImage(img);
        triggerBackgroundRemoval(img, modelId);
      };
      img.src = url;
    }
  };

  // Model download helper
  const handleModelChange = async (newId: string) => {
    setModelId(newId);
    if (!originalImage) return;

    if (!modelReady[newId]) {
      setModelDownloadProgress(0);
      try {
        await modelManager.download(newId, (p) => setModelDownloadProgress(Math.round(p)));
        setModelReady((prev) => ({ ...prev, [newId]: true }));
      } catch (err) {
        console.error("Failed to download model:", err);
      } finally {
        setModelDownloadProgress(null);
      }
    }

    triggerBackgroundRemoval(originalImage, newId);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0f16] select-none relative"
      onPointerLeave={handlePointerLeave}
    >
      {/* Floating Precision Brush Ring Cursor for Retouch Mode */}
      <div
        ref={customCursorRef}
        className="pointer-events-none fixed top-0 left-0 rounded-full z-[9999] transition-none hidden select-none"
        style={{
          width: `${brushSize}px`,
          height: `${brushSize}px`,
          transform: "translate(-50%, -50%)",
          border: `2px ${brushHardness < 95 ? "dashed" : "solid"} ${retouchMode === "erase" ? "#ef4444" : "#10b981"}`,
          boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Inner solid core indicator when soft brush is active */}
        {brushHardness < 95 && (
          <div
            className="absolute top-1/2 left-1/2 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: `${Math.max(4, Math.round(brushSize * (brushHardness / 100)))}px`,
              height: `${Math.max(4, Math.round(brushSize * (brushHardness / 100)))}px`,
              border: `1.5px solid ${retouchMode === "erase" ? "#f87171" : "#34d399"}`,
              backgroundColor: retouchMode === "erase" ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.18)",
            }}
          />
        )}
        {/* Precision Aiming Center Dot */}
        <div
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            backgroundColor: retouchMode === "erase" ? "#ef4444" : "#10b981",
            boxShadow: "0 0 2px rgba(0,0,0,0.8)",
          }}
        />
      </div>

      {/* Top Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="p-1 sm:p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg sm:rounded-xl text-white shadow-sm shadow-emerald-500/20 shrink-0">
            <Sparkles size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                AI Background Remover
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                Instant • High Quality
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate hidden xs:block">
              One-click cutout, manual retouch & restore, and custom studio backgrounds
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {maskImageData && (
            <>
              {/* Copy PNG Button */}
              <button
                type="button"
                onClick={handleCopyPNG}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-medium text-xs shadow-sm transition-all ${copyFeedback
                  ? "bg-emerald-600 text-white shadow-emerald-500/25"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50"
                  }`}
                title="Copy transparent PNG to clipboard (Ctrl + C)"
              >
                {copyFeedback ? <Check size={13} className="stroke-[2.5]" /> : <Copy size={13} />}
                <span className="hidden sm:inline">{copyFeedback ? "Copied PNG!" : "Copy PNG"}</span>
              </button>

              {/* Download PNG Button */}
              <button
                type="button"
                onClick={() => handleDownloadPNG(false)}
                className="flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg font-medium text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
                title="Download high-resolution image"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
              </button>

              {/* Replace image button */}
              <label className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg font-medium text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors" title="Replace current image">
                <RefreshCw size={12} />
                <span className="hidden md:inline">Replace</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                  className="hidden"
                />
              </label>

              {/* Studio Sidebar Toggle Button (Desktop only) */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors border ${isSidebarOpen
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  }`}
                title={isSidebarOpen ? "Collapse Studio Panel" : "Expand Studio Panel"}
              >
                {isSidebarOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
                <span className="inline">{isSidebarOpen ? "Hide Studio" : "Studio"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      {!selectedImageSrc ? (
        /* Empty / Upload State */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex-1 flex flex-col items-center justify-center p-6 transition-all ${isDraggingOver ? "bg-emerald-500/5 ring-2 ring-emerald-500 ring-inset" : ""
            }`}
        >
          <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6">
            {/* Drop Zone Box */}
            <div className="w-full relative border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 sm:p-10 transition-all bg-white/80 dark:bg-[#12161f]/80 shadow-sm hover:shadow-md group flex flex-col items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform shadow-inner mb-4">
                <Upload size={32} />
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Drag & Drop Image Here
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1.5">
                Supports PNG, JPG, WEBP, AVIF, BMP. Or click anywhere in the box to browse.
              </p>

              {/* Action Badges / Shortcuts */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Copy size={12} className="text-emerald-500" />
                  Paste from clipboard (Ctrl + V)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCameraOpen(true);
                  }}
                  className="relative z-20 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <Camera size={12} className="text-emerald-500" />
                  Take Photo
                </button>
              </div>
            </div>

            {/* Quick Test Samples */}
            <div className="w-full pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                Or Try Sample Images
              </div>
              <div className="grid grid-cols-3 gap-3">
                {SAMPLE_IMAGES.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => handleLoadSample(sample.url, sample.name)}
                    className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 hover:shadow-md transition-all text-left flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {sample.name}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {sample.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active Image Studio */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Mobile Tab Switcher (Modern Segmented Pill Track - Compact) */}
          <div className="flex md:hidden border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0e131d]/90 px-2 py-1 shrink-0 backdrop-blur-md">
            <div className="grid grid-cols-2 w-full p-0.5 bg-slate-200/70 dark:bg-[#171e2c] rounded-lg border border-slate-300/50 dark:border-slate-800/80 shadow-inner gap-1">
              <button
                type="button"
                onClick={() => setMobileTab("canvas")}
                className={`relative flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-semibold transition-all duration-200 select-none ${mobileTab === "canvas"
                    ? "bg-white dark:bg-[#222c3d] text-slate-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
              >
                <span
                  className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${mobileTab === "canvas"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-transparent text-slate-400 dark:text-slate-500"
                    }`}
                >
                  <Eye size={12} strokeWidth={2.2} />
                </span>
                <span className="truncate">Canvas & Touch-up</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("studio")}
                className={`relative flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-semibold transition-all duration-200 select-none ${mobileTab === "studio"
                    ? "bg-white dark:bg-[#222c3d] text-slate-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
              >
                <span
                  className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${mobileTab === "studio"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-transparent text-slate-400 dark:text-slate-500"
                    }`}
                >
                  <SlidersHorizontal size={12} strokeWidth={2.2} />
                </span>
                <span className="truncate">Studio & Backdrop</span>
              </button>
            </div>
          </div>

          {/* Main Visualizer Area (Center) */}
          <div
            className={`flex-1 flex flex-col relative overflow-hidden bg-slate-200/50 dark:bg-[#07090e] ${mobileTab === "canvas" ? "flex" : "hidden md:flex"
              }`}
          >
            {/* View Mode Switcher Toolbar (Single scrollable line on mobile) */}
            <div className="flex items-center justify-between gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-sm z-10 shrink-0 overflow-x-auto no-scrollbar">
              {/* Modes: Slider, Cutout, Retouch, Side by Side */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("slider")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${viewMode === "slider"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  title="Drag divider to compare original vs cutout"
                >
                  <Sliders size={12} />
                  <span>Split Slider</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cutout")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${viewMode === "cutout"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  title="View cutout only"
                >
                  <Eye size={12} />
                  <span>Cutout</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("retouch")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${viewMode === "retouch"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  title="Manual retouch: Erase leftover background or restore missing parts"
                >
                  <Eraser size={12} />
                  <span>Touch-up</span>
                  {(undoCount > 0 || redoCount > 0) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("sidebyside")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${viewMode === "sidebyside"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  title="Side by side comparison"
                >
                  <Layers size={12} />
                  <span className="hidden sm:inline">Side-by-Side</span>
                  <span className="sm:hidden">Compare</span>
                </button>
              </div>

              {/* Zoom & Hold Original Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onMouseDown={() => setIsHoldingOriginal(true)}
                  onMouseUp={() => setIsHoldingOriginal(false)}
                  onTouchStart={() => setIsHoldingOriginal(true)}
                  onTouchEnd={() => setIsHoldingOriginal(false)}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-all select-none whitespace-nowrap ${isHoldingOriginal
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
                    }`}
                  title="Hold to see original (or hold Spacebar)"
                >
                  Hold
                </button>
                <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
                  title="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[10px] sm:text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 min-w-[28px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
                  title="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
                  title="Reset Zoom"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            {/* DOCKED CONTEXTUAL TOUCH-UP TOOLBAR (Compact & Expandable) */}
            {viewMode === "retouch" && (
              <div className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 sm:py-2 z-10 shrink-0 shadow-xs transition-all">
                {/* Primary Compact Row */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                  {/* Mode: Erase vs Restore */}
                  <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRetouchMode("erase")}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${retouchMode === "erase"
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      title="Erase remaining unwanted background"
                    >
                      <Eraser size={13} />
                      <span>Erase</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetouchMode("restore")}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${retouchMode === "restore"
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      title="Restore accidentally cut-out subject pixels"
                    >
                      <Paintbrush size={13} />
                      <span>Restore</span>
                    </button>
                  </div>

                  {/* Size Slider (Always Accessible) */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[150px] sm:max-w-[200px]" title="Brush diameter">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      {brushSize}px
                    </span>
                    <input
                      type="range"
                      min="4"
                      max="140"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Quick S/M/L buttons on larger screens */}
                  <div className="hidden lg:flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBrushSize(16)}
                      className={`px-1.5 py-0.5 text-[10px] rounded border ${brushSize === 16 ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-200 dark:border-slate-700 text-slate-500"
                        }`}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrushSize(36)}
                      className={`px-1.5 py-0.5 text-[10px] rounded border ${brushSize === 36 ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-200 dark:border-slate-700 text-slate-500"
                        }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrushSize(72)}
                      className={`px-1.5 py-0.5 text-[10px] rounded border ${brushSize === 72 ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-200 dark:border-slate-700 text-slate-500"
                        }`}
                    >
                      L
                    </button>
                  </div>

                  {/* Right Actions: Undo, Redo, Tune / Expand */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoCount === 0}
                      className="p-1 sm:p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Undo stroke (Ctrl + Z)"
                    >
                      <Undo2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={redoCount === 0}
                      className="p-1 sm:p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Redo stroke (Ctrl + Y)"
                    >
                      <Redo2 size={14} />
                    </button>

                    {/* Tune Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsTouchUpExpanded((prev) => !prev)}
                      className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${isTouchUpExpanded
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60"
                        }`}
                      title="Toggle Hardness, Softness, & Strength controls"
                    >
                      <SlidersHorizontal size={12} />
                      <span className="hidden xs:inline">Tune</span>
                      {brushHardness < 95 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Secondary Row for Hardness, Strength, Presets, and Reset */}
                {isTouchUpExpanded && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-1.5 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          setBrushHardness(100);
                          setBrushOpacity(100);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${brushHardness >= 95
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        Hard Brush
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushHardness(25)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${brushHardness < 95
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        <Feather size={11} className="text-emerald-500" />
                        <span>Light Brush</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5" title="Edge softness (0% = feathered, 100% = hard edge)">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Hardness: {brushHardness}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={brushHardness}
                          onChange={(e) => setBrushHardness(Number(e.target.value))}
                          className="w-14 sm:w-18 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5" title="Brush strength / opacity">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Strength: {brushOpacity}%
                        </span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={brushOpacity}
                          onChange={(e) => setBrushOpacity(Number(e.target.value))}
                          className="w-14 sm:w-18 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleResetRetouch}
                        className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ml-auto"
                        title="Reset all touch-ups back to initial cutout"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Canvas Viewport (Center) */}
            <div className={`flex-1 w-full h-full min-h-0 min-w-0 relative flex items-center justify-center p-3 sm:p-5 select-none ${viewMode === "sidebyside" ? "overflow-y-auto overscroll-y-contain touch-pan-y" : "overflow-hidden"
              }`}>
              {/* Background transparency checkerboard pattern container */}
              <div
                className={`relative shadow-xl rounded-xl flex items-center justify-center transition-transform duration-75 max-w-full max-h-full ${viewMode === "sidebyside" ? "overflow-visible w-full" : "overflow-hidden"
                  }`}
                style={{
                  transform: viewMode === "sidebyside" ? undefined : `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                }}
              >
                {/* Checkerboard layer */}
                <div
                  className="absolute inset-0 z-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] bg-[size:16px_16px] bg-slate-100 dark:bg-[#10141d]"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, rgba(0,0,0,0.06) 25%, transparent 25%),
                      linear-gradient(-45deg, rgba(0,0,0,0.06) 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.06) 75%),
                      linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.06) 75%)
                    `,
                    backgroundSize: "20px 20px",
                    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  }}
                />

                {/* Primary Canvas */}
                {viewMode === "sidebyside" ? (
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-start md:justify-center gap-3 sm:gap-6 p-2 w-full max-w-full">
                    {/* Top / Left: Original Photo */}
                    <div className="flex-1 flex flex-col items-center justify-center min-w-0 max-w-full w-full">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                        <ImageIcon size={12} />
                        Original Photo
                      </span>
                      <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-sm flex items-center justify-center bg-black/5 dark:bg-black/20 p-1 w-full max-w-sm md:max-w-none">
                        <img
                          src={selectedImageSrc}
                          alt="Original"
                          className="object-contain mx-auto max-h-[34vh] sm:max-h-[42vh] md:max-h-[min(56vh,calc(100vh-300px))]"
                          style={{
                            display: "block",
                            maxWidth: "100%",
                            width: "auto",
                            height: "auto",
                          }}
                        />
                      </div>
                    </div>

                    {/* Bottom / Right: Cutout Canvas */}
                    <div className="flex-1 flex flex-col items-center justify-center min-w-0 max-w-full w-full">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                        <Sparkles size={12} />
                        Cutout Result
                      </span>
                      <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-sm flex items-center justify-center bg-black/5 dark:bg-black/20 p-1 w-full max-w-sm md:max-w-none">
                        <canvas
                          ref={canvasRef}
                          className="mx-auto max-h-[34vh] sm:max-h-[42vh] md:max-h-[min(56vh,calc(100vh-300px))]"
                          style={{
                            display: "block",
                            maxWidth: "100%",
                            width: "auto",
                            height: "auto",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 flex items-center justify-center max-w-full max-h-full">
                    <canvas
                      ref={canvasRef}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerEnter={handlePointerEnter}
                      onPointerLeave={handlePointerLeave}
                      className={`mx-auto max-h-[min(calc(100dvh-295px),calc(100%-16px))] sm:max-h-[calc(100dvh-280px)] md:max-h-[calc(100vh-280px)] ${viewMode === "retouch" ? "cursor-none touch-none" : ""}`}
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                      }}
                    />

                    {/* Split Slider Draggable Divider */}
                    {viewMode === "slider" && (
                      <div
                        ref={sliderBarRef}
                        onPointerDown={handleSliderPointerDown}
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                        className="absolute inset-0 cursor-ew-resize select-none touch-none"
                      >
                        {/* Vertical line indicator */}
                        <div
                          className="absolute top-0 bottom-0 -ml-3 w-6 flex items-center justify-center pointer-events-auto"
                          style={{ left: `${sliderPos}%` }}
                        >
                          <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <GripVertical size={14} />
                          </div>
                        </div>

                        {/* Labels: Full pill with safe margin to guarantee zero clipping */}
                        <div className="absolute top-3.5 left-3.5 pointer-events-none z-20 flex items-center bg-black/80 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-lg select-none leading-tight">
                          Before
                        </div>
                        <div className="absolute top-3.5 right-3.5 pointer-events-none z-20 flex items-center bg-black/80 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-lg select-none leading-tight">
                          After
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Processing Overlay with Progress */}
                {isProcessing && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white p-6">
                    <div className="relative mb-3">
                      <Loader2 size={36} className="animate-spin text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold tracking-wide">
                      {aiStage?.state === "downloading"
                        ? `Downloading AI Weights (${aiStage.progress}%)...`
                        : aiStage?.state === "preparing-image"
                          ? "Preparing Image..."
                          : aiStage?.state === "inference"
                            ? "Running Neural Segmentation..."
                            : aiStage?.state === "post-processing"
                              ? "Refining Edges & Matte..."
                              : "Removing Background..."}
                    </p>
                    {aiStage && aiStage.progress > 0 && (
                      <div className="w-48 bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-200"
                          style={{ width: `${aiStage.progress}%` }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleCancelAi}
                      className="mt-4 px-3 py-1 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar Controls Panel (Smooth Desktop Drawer & Mobile Tab View) */}
          <div
            className={`border-t md:border-t-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col min-h-0 h-full overflow-y-auto overscroll-y-contain touch-pan-y overflow-x-hidden custom-scrollbar transition-all duration-300 ease-in-out ${mobileTab === "studio"
                ? "flex-1 w-full p-4 md:flex-none"
                : "hidden md:flex md:flex-none"
              } ${isSidebarOpen
                ? "md:w-80 md:min-w-[320px] md:max-w-[320px] md:opacity-100 md:p-4 md:border-l md:pointer-events-auto"
                : "md:w-0 md:min-w-0 md:max-w-0 md:opacity-0 md:p-0 md:border-l-0 md:overflow-hidden md:pointer-events-none"
              }`}
          >
            {/* Inner Responsive Wrapper (Fixed 288px on desktop drawer, responsive on mobile) */}
            <div className="w-full max-w-md mx-auto md:w-[288px] shrink-0 space-y-5 pb-8 md:pb-2">
              {/* AI Model Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    AI Model
                  </span>
                  {modelReady[modelId] && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={11} /> Ready
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {bgModels.map((m) => {
                    const isSelected = modelId === m.id;
                    const isLocal = m.sources[0]?.type === "local";

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleModelChange(m.id)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white ring-1 ring-emerald-500/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600"
                            }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold truncate">{m.name}</span>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                              {isLocal ? "Local • 4.6MB" : m.size ? `${formatFileSize(m.size, 'B')}` : "Online"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {m.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {modelDownloadProgress !== null && (
                  <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1">
                      <span>Downloading model weights...</span>
                      <span>{modelDownloadProgress}%</span>
                    </div>
                    <div className="w-full bg-emerald-200 dark:bg-emerald-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-200"
                        style={{ width: `${modelDownloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Background Backdrop Selector */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Background Backdrop
                </span>

                {/* Tab Selector */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => setBgType("transparent")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${bgType === "transparent"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgType("color")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${bgType === "color"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgType("gradient")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${bgType === "gradient"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    Gradient
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgType("blur")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${bgType === "blur"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    Blur
                  </button>
                </div>

                {/* Solid Color Presets & Advanced ColorPicker */}
                {bgType === "color" && (
                  <div className="space-y-3">
                    {/* Extracted Colors from Image (ColorThief) */}
                    {extractedPalette.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Sparkles size={12} />
                            Extracted from Image
                          </span>
                          {extractedDominant && (
                            <button
                              type="button"
                              onClick={() => setSolidColor(extractedDominant)}
                              className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                              title="Apply dominant color"
                            >
                              <Pipette size={10} />
                              Dominant ({extractedDominant})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {extractedPalette.map((col, idx) => (
                            <button
                              key={`color-ext-${col}-${idx}`}
                              type="button"
                              onClick={() => setSolidColor(col)}
                              className={`w-7 h-7 rounded-lg border transition-transform ${solidColor.toLowerCase() === col.toLowerCase()
                                  ? "scale-110 ring-2 ring-emerald-500 border-white"
                                  : "border-black/10 dark:border-white/10 hover:scale-110"
                                }`}
                              style={{ backgroundColor: col }}
                              title={`Extracted: ${col}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard Presets */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                        Presets
                      </span>
                      <div className="grid grid-cols-5 gap-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setSolidColor(c.value)}
                            className={`h-8 rounded-lg border transition-transform ${solidColor === c.value
                                ? "scale-105 border-emerald-500 ring-2 ring-emerald-500/20"
                                : "border-black/10 dark:border-white/10 hover:scale-105"
                              }`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Advanced ColorPicker Trigger & Code Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <ColorPickerTrigger
                        color={solidColor}
                        onChange={(newColor: string) => setSolidColor(newColor)}
                        className="w-9 h-9 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer transition hover:scale-105 shrink-0 flex items-center justify-center relative overflow-hidden group"
                        label="Open color picker"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shadow-xs border border-white/40 ring-1 ring-black/10 group-hover:scale-110 transition-transform"
                          style={{
                            background: "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)",
                          }}
                        >
                          <Pipette size={10} className="text-white drop-shadow-xs" strokeWidth={2.6} />
                        </div>
                      </ColorPickerTrigger>
                      <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-emerald-500 transition-colors">
                        <input
                          type="text"
                          value={solidColor}
                          onChange={(e) => setSolidColor(e.target.value)}
                          className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                          placeholder="#ffffff or rgba(...)"
                        />
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase ml-1 shrink-0">
                          Pick
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gradient Presets & Custom Stops */}
                {bgType === "gradient" && (
                  <div className="space-y-3">
                    {/* Image-Matched Gradients from ColorThief */}
                    {imageMatchedGradients.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                          <Sparkles size={12} />
                          Image-Matched Gradients
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {imageMatchedGradients.map((g, idx) => {
                            const isSelected = selectedGradient.from === g.from && selectedGradient.to === g.to;
                            return (
                              <button
                                key={`img-grad-${idx}`}
                                type="button"
                                onClick={() => setSelectedGradient(g)}
                                className={`h-10 rounded-xl border flex items-end p-1 transition-all ${isSelected
                                    ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-105"
                                    : "border-black/10 dark:border-white/10 hover:scale-105"
                                  }`}
                                style={{
                                  background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                                }}
                              >
                                <span className="text-[9px] font-bold text-white drop-shadow-sm truncate">
                                  {g.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Curated Preset Gradients */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                        Curated Styles
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_GRADIENTS.map((g) => {
                          const isSelected = selectedGradient.from === g.from && selectedGradient.to === g.to;
                          return (
                            <button
                              key={g.label}
                              type="button"
                              onClick={() => setSelectedGradient(g)}
                              className={`h-10 rounded-xl border flex items-end p-1 transition-all ${isSelected
                                  ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-105"
                                  : "border-black/10 dark:border-white/10 hover:scale-105"
                                }`}
                              style={{
                                background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                              }}
                            >
                              <span className="text-[9px] font-bold text-white drop-shadow-sm truncate">
                                {g.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Gradient Stops with ColorPicker & Quick Palette Swatches */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Custom Gradient Stops
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                          <ColorPickerTrigger
                            color={selectedGradient.from}
                            onChange={(c: string) => setSelectedGradient((prev) => ({ ...prev, from: c, label: "Custom" }))}
                            className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs cursor-pointer transition hover:scale-105 shrink-0 flex items-center justify-center relative overflow-hidden group"
                            label="Gradient start color"
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-white/40 ring-1 ring-black/10 group-hover:scale-110 transition-transform"
                              style={{
                                background: "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)",
                              }}
                            >
                              <Pipette size={7} className="text-white drop-shadow-xs" strokeWidth={2.5} />
                            </div>
                          </ColorPickerTrigger>
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] font-bold uppercase text-slate-400">Start</div>
                            <div className="font-mono text-[10px] truncate text-slate-700 dark:text-slate-300">{selectedGradient.from}</div>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                          <ColorPickerTrigger
                            color={selectedGradient.to}
                            onChange={(c: string) => setSelectedGradient((prev) => ({ ...prev, to: c, label: "Custom" }))}
                            className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs cursor-pointer transition hover:scale-105 shrink-0 flex items-center justify-center relative overflow-hidden group"
                            label="Gradient end color"
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-white/40 ring-1 ring-black/10 group-hover:scale-110 transition-transform"
                              style={{
                                background: "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)",
                              }}
                            >
                              <Pipette size={7} className="text-white drop-shadow-xs" strokeWidth={2.5} />
                            </div>
                          </ColorPickerTrigger>
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] font-bold uppercase text-slate-400">End</div>
                            <div className="font-mono text-[10px] truncate text-slate-700 dark:text-slate-300">{selectedGradient.to}</div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Extracted Palette Chips for Stops */}
                      {extractedPalette.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                          <span className="text-[9px] font-semibold text-slate-400 shrink-0">Quick Apply:</span>
                          {extractedPalette.slice(0, 8).map((col, idx) => (
                            <div key={`stop-apply-${col}-${idx}`} className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedGradient((prev) => ({ ...prev, from: col, label: "Custom" }))}
                                className="w-4 h-4 rounded-l-md border border-r-0 border-black/10 dark:border-white/10 hover:opacity-80"
                                style={{ backgroundColor: col }}
                                title={`Set Start Stop to ${col}`}
                              />
                              <button
                                type="button"
                                onClick={() => setSelectedGradient((prev) => ({ ...prev, to: col, label: "Custom" }))}
                                className="w-4 h-4 rounded-r-md border border-black/10 dark:border-white/10 hover:opacity-80"
                                style={{ backgroundColor: col }}
                                title={`Set End Stop to ${col}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Blurred Photo Description */}
                {bgType === "blur" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    Draws a smooth 28px Gaussian blur of your original photograph behind the cutout subject. Great for portrait and product showcases.
                  </p>
                )}
              </div>

              {/* Drop Shadow Control */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Subject Drop Shadow
                  </span>
                  <button
                    type="button"
                    onClick={() => setShadowEnabled(!shadowEnabled)}
                    className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center ${shadowEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${shadowEnabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                    />
                  </button>
                </div>

                {shadowEnabled && (
                  <div className="space-y-3 pt-1 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                    {/* Shadow Color Selector */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                        <span>Shadow Color / Tint</span>
                        <span className="font-mono text-[10px] text-slate-400">{shadowColor}</span>
                      </div>

                      {/* Presets Grid */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESET_SHADOW_COLORS.map((sc) => (
                          <button
                            key={sc.value}
                            type="button"
                            onClick={() => setShadowColor(sc.value)}
                            className={`w-6 h-6 rounded-lg border transition-all ${
                              shadowColor.toLowerCase() === sc.value.toLowerCase()
                                ? "scale-110 ring-2 ring-emerald-500 border-white dark:border-slate-800"
                                : "border-black/10 dark:border-white/10 hover:scale-105"
                            }`}
                            style={{ backgroundColor: sc.value }}
                            title={sc.label}
                          />
                        ))}
                      </div>

                      {/* Unique & Clear Custom Color Picker Control */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                        <ColorPickerTrigger
                          color={shadowColor}
                          onChange={(c: string) => setShadowColor(c)}
                          style={{}}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 shadow-xs cursor-pointer transition-all hover:scale-[1.02] shrink-0 group select-none ring-1 ring-black/5 dark:ring-white/5"
                          label="Open custom color picker"
                        >
                          {/* Rainbow Chromatic Conic-Gradient Ring with Pipette Icon */}
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs border border-white/40 ring-1 ring-black/10"
                            style={{
                              background: "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)",
                            }}
                          >
                            <Pipette size={10} className="text-white drop-shadow-xs" strokeWidth={2.6} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            Color Picker
                          </span>
                          {/* Real-time active shadow color dot */}
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shadow-xs shrink-0 ml-0.5"
                            style={{ backgroundColor: shadowColor }}
                            title={`Current: ${shadowColor}`}
                          />
                        </ColorPickerTrigger>

                        {/* Direct Hex Input for exact values */}
                        <div className="flex-1 flex items-center px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-emerald-500 transition-colors">
                          <span className="text-[10px] font-mono text-slate-400 mr-1 select-none">#</span>
                          <input
                            type="text"
                            value={shadowColor.replace("#", "")}
                            onChange={(e) => setShadowColor(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
                            className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                            placeholder="000000"
                          />
                        </div>
                      </div>

                      {/* Extracted Colors for Shadow Match */}
                      {extractedPalette.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Sparkles size={11} />
                              Match Image Palette
                            </span>
                            <span className="text-[9px] text-slate-400">Ambient Lighting</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {extractedPalette.map((col, idx) => (
                              <button
                                key={`shadow-ext-${col}-${idx}`}
                                type="button"
                                onClick={() => setShadowColor(col)}
                                className={`w-5 h-5 rounded-md border transition-transform ${shadowColor.toLowerCase() === col.toLowerCase()
                                    ? "scale-110 ring-2 ring-emerald-500 border-white"
                                    : "border-black/10 dark:border-white/10 hover:scale-110"
                                  }`}
                                style={{ backgroundColor: col }}
                                title={`Shadow from image: ${col}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shadow Softness */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>Shadow Softness</span>
                        <span>{shadowBlur}px</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="60"
                        value={shadowBlur}
                        onChange={(e) => setShadowBlur(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    {/* Shadow Opacity */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>Shadow Opacity</span>
                        <span>{Math.round(shadowOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.9"
                        step="0.05"
                        value={shadowOpacity}
                        onChange={(e) => setShadowOpacity(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Details Card */}
              {originalImage && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Dimensions</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {originalImage.naturalWidth || originalImage.width} × {originalImage.naturalHeight || originalImage.height} px
                    </span>
                  </div>
                  {imageSize && (
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>Original Size</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatFileSize(imageSize, 'B')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Export & Copy Actions */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyPNG}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${copyFeedback
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                    }`}
                >
                  {copyFeedback ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copyFeedback ? "Copied PNG to Clipboard!" : "Copy Image as PNG (Ctrl+C)"}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPNG(true)}
                    className="py-2 px-2.5 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={13} />
                    <span>Cutout PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPNG(false)}
                    className="py-2 px-2.5 rounded-xl font-semibold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={13} />
                    <span>Composite</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Error Toast */}
      {copyError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-lg">
          <AlertCircle size={15} />
          <span>{copyError}</span>
        </div>
      )}

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={(file) => {
            setIsCameraOpen(false);
            handleImageFile(file);
          }}
        />
      )}
    </div>
  );
}
