import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Scissors, Upload, Download, X, MousePointerClick, LayoutGrid, RotateCcw, Info, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Check } from "lucide-react";
import JSZip from "jszip";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import CustomSelect from "../CustomSelect";
import MediaCarousel from "../MediaCarousel";

interface SlicePreview {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_PREVIEWS = 50;

export const ImageSlicerUtil: React.FC = () => {
  // ── State ────────────────────────────────────────────
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"fixed" | "gui">("fixed");
  const [direction, setDirection] = useState<"horizontal" | "vertical" | "grid">("horizontal");
  const [sliceSizeX, setSliceSizeX] = useState<number | "">(200);
  const [sliceSizeY, setSliceSizeY] = useState<number | "">(200);
  const [sliceCountX, setSliceCountX] = useState<number | "">(2);
  const [sliceCountY, setSliceCountY] = useState<number | "">(2);
  const [fixedUnit, setFixedUnit] = useState<"px" | "count">("px");
  const [cutLinesX, setCutLinesX] = useState<number[]>([]);
  const [cutLinesY, setCutLinesY] = useState<number[]>([]);
  const [dragging, setDragging] = useState<{ axis: "x" | "y"; idx: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [slicePreviews, setSlicePreviews] = useState<SlicePreview[]>([]);
  const [deselectedIndices, setDeselectedIndices] = useState<Set<number>>(new Set());
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const [showChrome, setShowChrome] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");

  // ── Refs ─────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const justDraggedRef = useRef(false);
  const carouselCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);

  // ── Computed ─────────────────────────────────────────
  const { displayWidth, displayHeight, scale } = useMemo(() => {
    if (!imageEl || containerWidth <= 0) return { displayWidth: 0, displayHeight: 0, scale: 1 };
    const maxW = containerWidth;
    const s = Math.min(1, maxW / imageEl.width);
    return {
      displayWidth: Math.round(imageEl.width * s),
      displayHeight: Math.round(imageEl.height * s),
      scale: s,
    };
  }, [imageEl, containerWidth]);

  const effectiveCutLinesX = useMemo(() => {
    if (!imageEl || direction === "horizontal") return []; // "horizontal" slices run across Y, X cuts are empty
    if (mode === "fixed") {
      const lines: number[] = [];
      if (fixedUnit === "px") {
        const size = sliceSizeX === "" ? 200 : sliceSizeX;
        if (size <= 0 || size >= imageEl.width) return [];
        for (let p = size; p < imageEl.width; p += size) lines.push(p);
      } else {
        const count = sliceCountX === "" ? 2 : sliceCountX;
        if (count <= 1) return [];
        const step = imageEl.width / count;
        for (let i = 1; i < count; i++) lines.push(Math.round(step * i));
      }
      return lines;
    }
    return [...cutLinesX].sort((a, b) => a - b);
  }, [mode, direction, sliceSizeX, sliceCountX, fixedUnit, cutLinesX, imageEl]);

  const effectiveCutLinesY = useMemo(() => {
    if (!imageEl || direction === "vertical") return []; // "vertical" slices run across X, Y cuts are empty
    if (mode === "fixed") {
      const lines: number[] = [];
      if (fixedUnit === "px") {
        const size = sliceSizeY === "" ? 200 : sliceSizeY;
        if (size <= 0 || size >= imageEl.height) return [];
        for (let p = size; p < imageEl.height; p += size) lines.push(p);
      } else {
        const count = sliceCountY === "" ? 2 : sliceCountY;
        if (count <= 1) return [];
        const step = imageEl.height / count;
        for (let i = 1; i < count; i++) lines.push(Math.round(step * i));
      }
      return lines;
    }
    return [...cutLinesY].sort((a, b) => a - b);
  }, [mode, direction, sliceSizeY, sliceCountY, fixedUnit, cutLinesY, imageEl]);

  const validSlices = useMemo(() => {
    if (!imageEl) return [];
    const sortedX = [0, ...effectiveCutLinesX, imageEl.width];
    const sortedY = [0, ...effectiveCutLinesY, imageEl.height];
    const slices = [];
    for (let r = 0; r < sortedY.length - 1; r++) {
      const startY = sortedY[r], endY = sortedY[r + 1];
      if (endY <= startY) continue;
      const sh = endY - startY;
      for (let c = 0; c < sortedX.length - 1; c++) {
        const startX = sortedX[c], endX = sortedX[c + 1];
        if (endX <= startX) continue;
        const sw = endX - startX;
        slices.push({ startX, startY, sw, sh });
      }
    }
    return slices;
  }, [imageEl, effectiveCutLinesX, effectiveCutLinesY]);

  const totalSliceCount = validSlices.length;

  const selectedSliceCount = useMemo(() => {
    if (validSlices.length === 0) return 0;
    return validSlices.filter((_, i) => !deselectedIndices.has(i)).length;
  }, [validSlices, deselectedIndices]);

  const isAllSelected = selectedSliceCount === validSlices.length && validSlices.length > 0;

  // ── Effects ──────────────────────────────────────────

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    setContainerWidth(el.getBoundingClientRect().width - paddingX);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!imageEl]);

  // Draw canvas (Retina-aware)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !imageEl || !displayWidth) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = displayWidth * dpr;
    c.height = displayHeight * dpr;
    c.style.width = `${displayWidth}px`;
    c.style.height = `${displayHeight}px`;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(imageEl, 0, 0, displayWidth, displayHeight);
  }, [imageEl, displayWidth, displayHeight]);

  // Generate slice previews (debounced)
  useEffect(() => {
    if (!imageEl || validSlices.length === 0) {
      setSlicePreviews([]);
      return;
    }
    const t = setTimeout(() => {
      const previews: SlicePreview[] = [];
      const limit = Math.min(validSlices.length, MAX_PREVIEWS);
      for (let i = 0; i < limit; i++) {
        const slice = validSlices[i];
        const ts = Math.min(1, 200 / Math.max(slice.sw, slice.sh));
        const tw = Math.max(1, Math.round(slice.sw * ts));
        const th = Math.max(1, Math.round(slice.sh * ts));
        const cv = document.createElement("canvas");
        cv.width = tw;
        cv.height = th;
        cv.getContext("2d")!.drawImage(imageEl, slice.startX, slice.startY, slice.sw, slice.sh, 0, 0, tw, th);
        previews.push({ index: i, dataUrl: cv.toDataURL("image/png"), width: slice.sw, height: slice.sh });
      }
      setSlicePreviews(previews);
    }, 200);
    return () => clearTimeout(t);
  }, [imageEl, validSlices]);

  // Draw carousel preview
  useEffect(() => {
    if (carouselIndex === null || !imageEl || !carouselCanvasRef.current || !validSlices[carouselIndex]) return;
    const slice = validSlices[carouselIndex];
    const c = carouselCanvasRef.current;
    c.width = slice.sw;
    c.height = slice.sh;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(imageEl, slice.startX, slice.startY, slice.sw, slice.sh, 0, 0, slice.sw, slice.sh);
  }, [carouselIndex, imageEl, validSlices]);

  // Carousel chrome auto-hide
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (carouselIndex !== null && showChrome) {
      timeout = setTimeout(() => setShowChrome(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [carouselIndex, showChrome]);

  const handlePointerMoveChrome = () => {
    if (!showChrome) setShowChrome(true);
  };

  // Drag tracking
  useEffect(() => {
    if (!dragging || !imageEl) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const w = wrapperRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      const isX = dragging.axis === "x";
      const raw = isX ? e.clientX - rect.left : e.clientY - rect.top;
      const trueScale = isX ? rect.width / imageEl.width : rect.height / imageEl.height;
      const originalDim = isX ? imageEl.width : imageEl.height;
      const pos = Math.max(1, Math.min(originalDim - 1, Math.round(raw / trueScale)));
      
      if (isX) {
        setCutLinesX((prev) => { const n = [...prev]; n[dragging.idx] = pos; return n; });
      } else {
        setCutLinesY((prev) => { const n = [...prev]; n[dragging.idx] = pos; return n; });
      }
    };
    const onUp = () => {
      setDragging(null);
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 200);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [dragging, scale, imageEl]);

  // ── Handlers ─────────────────────────────────────────

  const loadImage = useCallback(
    (file: File) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setError("");
      setCutLinesX([]);
      setCutLinesY([]);
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setImageUrl(url);
        setSliceSizeX(Math.max(50, Math.round(img.width / 3)));
        setSliceSizeY(Math.max(50, Math.round(img.height / 3)));
      };
      img.onerror = () => {
        setError("Failed to load image. Try another file.");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [imageUrl],
  );

  const clearImage = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageEl(null);
    setImageUrl("");
    setFileName("");
    setCutLinesX([]);
    setCutLinesY([]);
    setSlicePreviews([]);
    setDeselectedIndices(new Set());
    setCarouselIndex(null);
    setError("");
  }, [imageUrl]);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f?.type.startsWith("image/")) loadImage(f);
      if (e.target) e.target.value = "";
    },
    [loadImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith("image/")) loadImage(f);
    },
    [loadImage],
  );

  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging !== null || justDraggedRef.current) return;
      if ((e.target as HTMLElement).closest(".slicer-btn")) return;
      const w = wrapperRef.current;
      if (!w || !imageEl) return;
      const rect = w.getBoundingClientRect();
      
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const trueScaleX = rect.width / imageEl.width;
      const trueScaleY = rect.height / imageEl.height;
      const posX = Math.max(1, Math.min(imageEl.width - 1, Math.round(rawX / trueScaleX)));
      const posY = Math.max(1, Math.min(imageEl.height - 1, Math.round(rawY / trueScaleY)));

      if (mode === "fixed") {
        if (direction === "horizontal" || direction === "grid") setCutLinesY([...effectiveCutLinesY, posY]);
        if (direction === "vertical" || direction === "grid") setCutLinesX([...effectiveCutLinesX, posX]);
        setMode("gui");
      } else {
        if (direction === "horizontal" || direction === "grid") setCutLinesY((prev) => [...prev, posY]);
        if (direction === "vertical" || direction === "grid") setCutLinesX((prev) => [...prev, posX]);
      }
    },
    [mode, dragging, direction, scale, imageEl, effectiveCutLinesX, effectiveCutLinesY],
  );

  const onCanvasMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging !== null) return;
      const w = wrapperRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      const zoom = rect.width / w.offsetWidth;
      setMousePos({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
    },
    [dragging],
  );

  const toggleSliceSelection = useCallback((idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeselectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setDeselectedIndices(new Set());
  }, []);

  const deselectAll = useCallback(() => {
    setDeselectedIndices(new Set(validSlices.map((_, i) => i)));
  }, [validSlices]);

  const scrollThumbnails = (dir: "left" | "right") => {
    if (thumbnailsContainerRef.current) {
      const scrollAmount = dir === "left" ? -240 : 240;
      thumbnailsContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const exportFormatMime = useMemo(() => {
    return exportFormat === "jpeg" ? "image/jpeg" : exportFormat === "webp" ? "image/webp" : "image/png";
  }, [exportFormat]);

  const exportFormatExt = useMemo(() => {
    return exportFormat === "jpeg" ? "jpg" : exportFormat;
  }, [exportFormat]);

  const renderSliceBlob = useCallback(async (slice: { startX: number; startY: number; sw: number; sh: number }): Promise<Blob> => {
    const cv = document.createElement("canvas");
    cv.width = slice.sw;
    cv.height = slice.sh;
    const ctx = cv.getContext("2d")!;
    if (exportFormat === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.sw, slice.sh);
    }
    ctx.drawImage(imageEl!, slice.startX, slice.startY, slice.sw, slice.sh, 0, 0, slice.sw, slice.sh);
    return new Promise<Blob>((resolve) => cv.toBlob((b) => resolve(b!), exportFormatMime, 0.92));
  }, [imageEl, exportFormat, exportFormatMime]);

  const downloadZip = useCallback(async () => {
    if (!imageEl || validSlices.length === 0) return;
    const slicesToDownload = validSlices
      .map((slice, idx) => ({ slice, idx }))
      .filter(({ idx }) => !deselectedIndices.has(idx));

    if (slicesToDownload.length === 0) return;

    setIsDownloading(true);
    try {
      const baseName = fileName.replace(/\.[^/.]+$/, "") || "image";

      if (slicesToDownload.length === 1) {
        const { slice, idx } = slicesToDownload[0];
        const blob = await renderSliceBlob(slice);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const fileNameNum = String(idx + 1).padStart(2, "0");
        a.download = `${baseName}_slice_${fileNameNum}.${exportFormatExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        const pad = String(validSlices.length).length;
        
        for (let i = 0; i < slicesToDownload.length; i++) {
          const { slice, idx } = slicesToDownload[i];
          const blob = await renderSliceBlob(slice);
          const fileNameNum = String(idx + 1).padStart(Math.max(3, pad), "0");
          zip.file(`slice_${fileNameNum}.${exportFormatExt}`, blob);
        }
        
        const zb = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(zb);
        a.download = `${baseName}_slices_${exportFormatExt}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [imageEl, validSlices, deselectedIndices, fileName, renderSliceBlob, exportFormatExt]);

  // ── Render Helpers ────────────────────────────────────

  const renderCutLine = (pos: number, i: number, axis: "x" | "y") => {
    const isX = axis === "x";
    const dp = pos * scale;
    const isDragging = dragging?.axis === axis && dragging?.idx === i;
    
    return (
      <div
        key={`${axis}-${i}`}
        className={`absolute z-[5] pointer-events-none ${isX ? "top-0 bottom-0" : "left-0 right-0"}`}
        style={isX ? { left: dp } : { top: dp }}
      >
        {/* Visible line */}
        <div
          className={`absolute ${isX ? "top-0 bottom-0 w-[2px] -left-[1px]" : "left-0 right-0 h-[2px] -top-[1px]"}`}
          style={{
            background: isDragging ? "#ea580c" : "#f97316",
            boxShadow: `0 0 ${isDragging ? 10 : 6}px rgba(249,115,22,${isDragging ? 0.7 : 0.4})`,
          }}
        />

        {/* Controls Container (Grouped for mobile accessibility) */}
        <div
          className="absolute flex items-center justify-center pointer-events-auto"
          style={{
            ...(isX
              ? { top: 0, left: -14, width: 28, height: 44, flexDirection: "column", gap: 6 }
              : { left: 0, top: -14, height: 28, width: 44, flexDirection: "row", gap: 6 }),
          }}
        >
          {/* Drag handle */}
          <div
            className={`slicer-btn shrink-0 rounded-full border-2 border-white dark:border-slate-900 shadow-md transition-transform ${
              isDragging ? "scale-125 bg-orange-600" : "bg-orange-500 hover:scale-110"
            } ${isX ? "cursor-ew-resize" : "cursor-ns-resize"}`}
            style={{ width: 14, height: 14, touchAction: "none" }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (mode === "fixed") {
                setCutLinesX([...effectiveCutLinesX]);
                setCutLinesY([...effectiveCutLinesY]);
                setMode("gui");
              }
              setDragging({ axis, idx: i });
            }}
          />

          {/* Delete button */}
          <button
            className={`slicer-btn shrink-0 w-[14px] h-[14px] rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all ${
              isDragging ? "scale-110 opacity-100" : "opacity-90 hover:opacity-100 hover:scale-110"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === "fixed") {
                const nx = [...effectiveCutLinesX];
                const ny = [...effectiveCutLinesY];
                if (isX) nx.splice(i, 1);
                else ny.splice(i, 1);
                setCutLinesX(nx);
                setCutLinesY(ny);
                setMode("gui");
              } else {
                if (isX) setCutLinesX((p) => p.filter((_, j) => j !== i));
                else setCutLinesY((p) => p.filter((_, j) => j !== i));
              }
            }}
          >
            <X size={8} strokeWidth={4} />
          </button>
        </div>

        {/* Position label */}
        <div
          className={`absolute pointer-events-none text-[9px] font-mono leading-none px-1.5 py-1 rounded shadow-sm whitespace-nowrap transition-opacity ${
            isDragging ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: "rgba(249,115,22,0.9)",
            color: "#fff",
            ...(isX ? { left: 16, top: 12 } : { left: 12, top: 16 }),
          }}
        >
          {Math.round(pos)}px
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileInput} className="hidden" />

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-3 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg text-xs flex items-center gap-2">
          <Info size={12} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {!imageEl ? (
        /* ── Upload screen (with header) ── */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-orange-200/60 dark:border-orange-800/40">
              <Scissors size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Image Slicer</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Slice images by fixed size or interactive grid points</p>
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`w-full max-w-md h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group ${
              isDragOver
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10 scale-[1.01]"
                : "border-slate-300 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 bg-slate-50/50 dark:bg-[#161b22]/50"
            }`}
          >
            <Upload
              size={28}
              className={`mb-2 transition-colors ${isDragOver ? "text-orange-500" : "text-slate-400 group-hover:text-orange-500"}`}
            />
            <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">
              {isDragOver ? "Drop image here" : "Click or drag to upload"}
            </span>
            <span className="text-slate-400 text-xs mt-1">PNG, JPG, WEBP, and more</span>
          </div>
        </div>
      ) : (
        /* ── Image loaded: compact toolbar + full canvas ── */
        <>
          {/* ── Compact toolbar (all controls in one bar) ── */}
          <div className="flex items-center overflow-x-auto scrollbar-none gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-sm shrink-0 whitespace-nowrap">
            {/* File name + dimensions */}
            <div className="flex items-center gap-2 min-w-0 mr-1">
              <Scissors size={13} className="text-orange-500 shrink-0" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{fileName}</span>
              <span className="text-[10px] text-slate-400 font-mono shrink-0">{imageEl.width}×{imageEl.height}</span>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Mode toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-md p-0.5">
              {(
                [
                  ["fixed", "Fixed", LayoutGrid],
                  ["gui", "Interactive", MousePointerClick],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => setMode(m as "fixed" | "gui")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                    mode === m
                      ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            {/* Direction toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-md p-0.5">
              {(["horizontal", "vertical", "grid"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDirection(d);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all capitalize ${
                    direction === d
                      ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {d === "horizontal" ? "Rows" : d === "vertical" ? "Cols" : "Grid"}
                </button>
              ))}
            </div>

            {/* Fixed-size inputs */}
            {mode === "fixed" && (
              <div className="flex items-center gap-2">
                {/* Unit toggle */}
                <CustomSelect
                  value={fixedUnit}
                  onChange={(val) => setFixedUnit(val as "px" | "count")}
                  options={[
                    { label: "Pixels", value: "px" },
                    { label: "Count", value: "count" }
                  ]}
                  variant="toolbar"
                />

                <div className="flex items-center gap-1.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-md px-2 h-[26px]">
                  {(direction === "vertical" || direction === "grid") && (
                    <>
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fixedUnit === "px" ? "W:" : "Cols:"}
                      </label>
                      <input
                        type="text"
                        value={fixedUnit === "px" ? sliceSizeX : sliceCountX}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            if (fixedUnit === "px") setSliceSizeX("");
                            else setSliceCountX("");
                            return;
                          }
                          if (!/^\d+$/.test(v)) return;
                          const val = parseInt(v, 10);
                          if (fixedUnit === "px") setSliceSizeX(val);
                          else setSliceCountX(val);
                        }}
                        onBlur={() => {
                          if (fixedUnit === "px" && sliceSizeX === "") setSliceSizeX(200);
                          if (fixedUnit === "count" && sliceCountX === "") setSliceCountX(2);
                        }}
                        className="w-10 bg-transparent text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                      />
                      {direction === "grid" && <span className="text-slate-300 mx-1">×</span>}
                    </>
                  )}
                  {(direction === "horizontal" || direction === "grid") && (
                    <>
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fixedUnit === "px" ? "H:" : "Rows:"}
                      </label>
                      <input
                        type="text"
                        value={fixedUnit === "px" ? sliceSizeY : sliceCountY}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            if (fixedUnit === "px") setSliceSizeY("");
                            else setSliceCountY("");
                            return;
                          }
                          if (!/^\d+$/.test(v)) return;
                          const val = parseInt(v, 10);
                          if (fixedUnit === "px") setSliceSizeY(val);
                          else setSliceCountY(val);
                        }}
                        onBlur={() => {
                          if (fixedUnit === "px" && sliceSizeY === "") setSliceSizeY(200);
                          if (fixedUnit === "count" && sliceCountY === "") setSliceCountY(2);
                        }}
                        className="w-10 bg-transparent text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                      />
                    </>
                  )}
                  <span className="text-[10px] text-slate-400 ml-0.5">{fixedUnit === "px" ? "px" : ""}</span>
                </div>
              </div>
            )}

            {/* Slice count badge */}
            {(effectiveCutLinesX.length > 0 || effectiveCutLinesY.length > 0) && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {(direction === "vertical" || direction === "grid") && `${effectiveCutLinesX.length} cols`}
                {direction === "grid" && ` · `}
                {(direction === "horizontal" || direction === "grid") && `${effectiveCutLinesY.length} rows`}
                {' → '}
                <span className="text-orange-600 dark:text-orange-400 font-bold">{totalSliceCount} slices</span>
              </span>
            )}

            {/* GUI: hint + clear */}
            {mode === "gui" && (cutLinesX.length > 0 || cutLinesY.length > 0) && (
              <button
                onClick={() => { setCutLinesX([]); setCutLinesY([]); }}
                className="text-[10px] text-red-500 hover:text-red-600 font-semibold transition-colors ml-2"
              >
                Clear
              </button>
            )}

            {/* Separator */}
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Change image */}
            <button
              onClick={clearImage}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-500 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <RotateCcw size={11} />
              Change
            </button>
          </div>

          {/* ── Canvas viewport (fills all remaining space) ── */}
          <div 
            ref={containerRef} 
            className="flex-1 p-0 overflow-hidden relative touch-none select-none"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
              backgroundColor: "#f3f4f6",
            }}
          >
            {/* Dark mode overlay for checkerboard */}
            <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-900/90 pointer-events-none mix-blend-overlay" />
            
            <TransformWrapper
              minScale={0.05}
              maxScale={10}
              initialScale={1}
              centerOnInit={true}
              limitToBounds={false}
              wheel={{
                step: 0.015,
                wheelDisabled: false,
                touchPadDisabled: false,
              }}
              pinch={{
                step: 5,
                disabled: false,
              }}
              panning={{
                disabled: dragging !== null,
                velocityDisabled: true,
              }}
              doubleClick={{
                disabled: false,
                step: 1.5,
                mode: "toggle",
              }}
              autoAlignment={{
                disabled: true,
              }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Floating Zoom Controls */}
                  <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-xl rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => zoomIn(0.25)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/70 rounded text-slate-700 dark:text-slate-200 transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomOut(0.25)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/70 rounded text-slate-700 dark:text-slate-200 transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => resetTransform()}
                      className="px-2 py-1 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/70 rounded text-slate-700 dark:text-slate-200 transition-colors"
                      title="Reset View"
                    >
                      Reset
                    </button>
                  </div>

                  <TransformComponent wrapperClass="!w-full !h-full touch-none select-none" contentClass="!w-max !h-max flex items-center justify-center p-4 sm:p-6 md:p-8 touch-none select-none">
                    <div
                      ref={wrapperRef}
                      className="relative mx-auto select-none shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
                      style={{
                        width: displayWidth,
                        height: displayHeight,
                        cursor: "crosshair",
                        touchAction: "none",
                      }}
                      onClick={onCanvasClick}
                      onMouseMove={onCanvasMove}
                      onMouseLeave={() => setMousePos(null)}
                    >
                      {/* Image canvas */}
                      <canvas ref={canvasRef} className="block relative z-[1] pointer-events-none w-full h-full" />

                      {/* Ghost lines (hover indicator) */}
                      {mousePos && dragging === null && (
                        <>
                          {(direction === "horizontal" || direction === "grid") && (
                            <div
                              className="absolute pointer-events-none z-[2]"
                              style={{ top: mousePos.y, left: 0, right: 0, height: 2, background: "rgba(249,115,22,0.25)", transform: "translateY(-1px)" }}
                            />
                          )}
                          {(direction === "vertical" || direction === "grid") && (
                            <div
                              className="absolute pointer-events-none z-[2]"
                              style={{ left: mousePos.x, top: 0, bottom: 0, width: 2, background: "rgba(249,115,22,0.25)", transform: "translateX(-1px)" }}
                            />
                          )}
                        </>
                      )}

                      {/* Onboarding overlay */}
                      {effectiveCutLinesX.length === 0 && effectiveCutLinesY.length === 0 && (
                        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                          <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg shadow-lg">
                            Click anywhere to add a cut line
                          </span>
                        </div>
                      )}

                      {/* Cut lines Y (Horizontal cuts) */}
                      {effectiveCutLinesY.map((pos, i) => renderCutLine(pos, i, "y"))}
                      
                      {/* Cut lines X (Vertical cuts) */}
                      {effectiveCutLinesX.map((pos, i) => renderCutLine(pos, i, "x"))}
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

            {/* ── Inline preview + download (below canvas, fixed at bottom) ── */}
            {slicePreviews.length > 1 && (
              <div className="w-full shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md px-3 py-2.5 min-w-0 z-10">
                <div className="max-w-4xl mx-auto min-w-0">
                  {/* Preview row */}
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {selectedSliceCount} of {totalSliceCount} Selected
                    </h3>
                    {totalSliceCount > MAX_PREVIEWS && (
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">(showing first {MAX_PREVIEWS})</span>
                    )}

                    <div className="flex items-center gap-1.5 ml-1">
                      <button
                        type="button"
                        onClick={isAllSelected ? deselectAll : selectAll}
                        className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline px-1 py-0.5 rounded transition-colors whitespace-nowrap"
                      >
                        {isAllSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    {/* Scroll buttons for desktop */}
                    <div className="hidden sm:flex items-center gap-1 ml-auto mr-1">
                      <button
                        type="button"
                        onClick={() => scrollThumbnails("left")}
                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Scroll Left"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollThumbnails("right")}
                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Scroll Right"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Format selector */}
                    <div className="flex items-center gap-1 ml-auto sm:ml-0">
                      <CustomSelect
                        value={exportFormat}
                        onChange={(val) => setExportFormat(val as "png" | "jpeg" | "webp")}
                        options={[
                          { label: "PNG", value: "png" },
                          { label: "JPG", value: "jpeg" },
                          { label: "WEBP", value: "webp" },
                        ]}
                        variant="toolbar"
                        className="h-[28px] text-[11px] font-bold"
                      />
                    </div>

                    {/* Download button inline */}
                    <button
                      onClick={downloadZip}
                      disabled={isDownloading || selectedSliceCount === 0}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-white text-xs transition-all whitespace-nowrap ${
                        selectedSliceCount === 0 || isDownloading
                          ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400 ml-auto sm:ml-0"
                          : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] ml-auto sm:ml-0"
                      }`}
                    >
                      {isDownloading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      {isDownloading
                        ? "Generating..."
                        : selectedSliceCount === 1
                        ? "Download Slice"
                        : `Download ${selectedSliceCount > 0 ? `(${selectedSliceCount})` : "ZIP"}`}
                    </button>
                  </div>

                  {/* Thumbnails (Horizontally Scrollable Container) */}
                  <div
                    ref={thumbnailsContainerRef}
                    className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 pt-0.5 w-full min-w-0 custom-scrollbar select-none touch-pan-x cursor-grab active:cursor-grabbing"
                    style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
                    onWheel={(e) => {
                      if (e.deltaY !== 0) {
                        e.currentTarget.scrollLeft += e.deltaY;
                      }
                    }}
                  >
                    {slicePreviews.map((p) => {
                      const isSelected = !deselectedIndices.has(p.index);
                      return (
                        <div key={p.index} className="relative shrink-0 group">
                          <button
                            type="button"
                            onClick={() => setCarouselIndex(p.index)}
                            className={`w-[76px] flex flex-col items-center bg-white dark:bg-[#161b22] border rounded-md overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                              isSelected
                                ? "border-orange-500/80 dark:border-orange-500/80 shadow-sm"
                                : "border-slate-200 dark:border-slate-800 opacity-50 grayscale hover:opacity-80"
                            }`}
                          >
                            <div className="w-full h-14 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-1 overflow-hidden pointer-events-none">
                              <img
                                src={p.dataUrl}
                                alt={`Slice ${p.index + 1}`}
                                className="max-w-full max-h-full object-contain"
                                draggable={false}
                              />
                            </div>
                            <div className="px-1 py-0.5 text-center w-full border-t border-slate-100 dark:border-slate-800/60">
                              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">#{p.index + 1}</span>
                              <span className="text-[8px] text-slate-400 font-mono ml-1">{p.width}×{p.height}</span>
                            </div>
                          </button>

                          {/* Selection Checkbox on Top-Right */}
                          <button
                            type="button"
                            onClick={(e) => toggleSliceSelection(p.index, e)}
                            className={`absolute top-1 right-1 z-10 w-4 h-4 rounded flex items-center justify-center transition-all shadow-sm ${
                              isSelected
                                ? "bg-orange-500 text-white hover:bg-orange-600 scale-100"
                                : "bg-black/40 text-transparent border border-white/60 hover:bg-black/60 hover:border-white"
                            }`}
                            title={isSelected ? "Deselect slice" : "Select slice"}
                          >
                            <Check size={10} strokeWidth={3.5} className={isSelected ? "opacity-100" : "opacity-0 hover:opacity-50 text-white"} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
        </>
      )}

      {/* ── Carousel Modal ── */}
      {/* ── Carousel Modal ── */}
      <MediaCarousel
        isOpen={carouselIndex !== null}
        onClose={() => setCarouselIndex(null)}
        items={validSlices}
        selectedIndex={carouselIndex || 0}
        onIndexChange={setCarouselIndex}
        keepMounted={false}
        renderHeaderMiddle={(slice, index, total) => (
          <>
            <p className="text-sm sm:text-base font-black mb-0.5 truncate w-full px-4">
              {fileName ? `${fileName} (Slice ${index + 1})` : `Slice ${index + 1}`}
            </p>
            <div className="flex items-center gap-2 opacity-80 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="hidden sm:inline">
                {slice.sw} × {slice.sh} px
              </span>
              <span className="w-1 h-1 rounded-full bg-white/50 shrink-0 hidden sm:inline" />
              <span>
                {index + 1} / {total}
              </span>
            </div>
          </>
        )}
        renderHeaderRight={(slice, index) => (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const blob = await renderSliceBlob(slice);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              const baseName = fileName.replace(/\.[^/.]+$/, "") || "image";
              a.download = `${baseName}_slice_${index + 1}.${exportFormatExt}`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-3 bg-orange-600 rounded-full hover:bg-orange-700 text-white transition-all backdrop-blur-md flex items-center justify-center shadow-lg"
            title={`Download Slice as ${exportFormat.toUpperCase()}`}
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        renderItem={(slice, isSelected) => (
          <canvas
            ref={carouselCanvasRef}
            className="max-w-full max-h-full object-contain pointer-events-auto"
          />
        )}
      />
    </div>
  );
};
