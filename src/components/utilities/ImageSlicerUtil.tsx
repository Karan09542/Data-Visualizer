import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Scissors, Upload, Download, X, MousePointerClick, LayoutGrid, RotateCcw, Info } from "lucide-react";
import JSZip from "jszip";

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
  const [direction, setDirection] = useState<"horizontal" | "vertical">("horizontal");
  const [sliceSize, setSliceSize] = useState(200);
  const [cutLines, setCutLines] = useState<number[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [slicePreviews, setSlicePreviews] = useState<SlicePreview[]>([]);
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

  const isH = direction === "horizontal";

  // ── Computed ─────────────────────────────────────────
  const { displayWidth, displayHeight, scale } = useMemo(() => {
    if (!imageEl || containerWidth <= 0) return { displayWidth: 0, displayHeight: 0, scale: 1 };
    const maxW = containerWidth - 4;
    const s = Math.min(1, maxW / imageEl.width);
    return {
      displayWidth: Math.round(imageEl.width * s),
      displayHeight: Math.round(imageEl.height * s),
      scale: s,
    };
  }, [imageEl, containerWidth]);

  const effectiveCutLines = useMemo(() => {
    if (!imageEl) return [];
    if (mode === "fixed") {
      const dim = isH ? imageEl.height : imageEl.width;
      if (sliceSize <= 0 || sliceSize >= dim) return [];
      const lines: number[] = [];
      for (let p = sliceSize; p < dim; p += sliceSize) lines.push(p);
      return lines;
    }
    return [...cutLines].sort((a, b) => a - b);
  }, [mode, isH, sliceSize, cutLines, imageEl]);

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
    if (!imageEl) {
      setSlicePreviews([]);
      return;
    }
    const t = setTimeout(() => {
      const dim = isH ? imageEl.height : imageEl.width;
      const sorted = [0, ...effectiveCutLines, dim];
      const previews: SlicePreview[] = [];
      const limit = Math.min(sorted.length - 1, MAX_PREVIEWS);
      for (let i = 0; i < limit; i++) {
        const start = sorted[i],
          end = sorted[i + 1];
        if (end <= start) continue;
        const sx = isH ? 0 : start,
          sy = isH ? start : 0;
        const sw = isH ? imageEl.width : end - start;
        const sh = isH ? end - start : imageEl.height;
        const ts = Math.min(1, 200 / Math.max(sw, sh));
        const tw = Math.max(1, Math.round(sw * ts));
        const th = Math.max(1, Math.round(sh * ts));
        const cv = document.createElement("canvas");
        cv.width = tw;
        cv.height = th;
        cv.getContext("2d")!.drawImage(imageEl, sx, sy, sw, sh, 0, 0, tw, th);
        previews.push({ index: i, dataUrl: cv.toDataURL("image/png"), width: sw, height: sh });
      }
      setSlicePreviews(previews);
    }, 200);
    return () => clearTimeout(t);
  }, [imageEl, effectiveCutLines, isH]);

  // Drag tracking
  useEffect(() => {
    if (draggingIdx === null || !imageEl) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const w = wrapperRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      const raw = isH ? e.clientY - rect.top : e.clientX - rect.left;
      const dim = isH ? imageEl.height : imageEl.width;
      const pos = Math.max(1, Math.min(dim - 1, Math.round(raw / scale)));
      setCutLines((prev) => {
        const n = [...prev];
        n[draggingIdx] = pos;
        return n;
      });
    };
    const onUp = () => {
      setDraggingIdx(null);
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
  }, [draggingIdx, isH, scale, imageEl]);

  // ── Handlers ─────────────────────────────────────────

  const loadImage = useCallback(
    (file: File) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setError("");
      setCutLines([]);
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setImageUrl(url);
        const dim = isH ? img.height : img.width;
        setSliceSize(Math.max(50, Math.round(dim / 4)));
      };
      img.onerror = () => {
        setError("Failed to load image. Try another file.");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [imageUrl, isH],
  );

  const clearImage = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageEl(null);
    setImageUrl("");
    setFileName("");
    setCutLines([]);
    setSlicePreviews([]);
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
      if (draggingIdx !== null || justDraggedRef.current) return;
      if ((e.target as HTMLElement).closest(".slicer-btn")) return;
      const w = wrapperRef.current;
      if (!w || !imageEl) return;
      const rect = w.getBoundingClientRect();
      const raw = isH ? e.clientY - rect.top : e.clientX - rect.left;
      const dim = isH ? imageEl.height : imageEl.width;
      const newPos = Math.max(1, Math.min(dim - 1, Math.round(raw / scale)));
      if (mode === "fixed") {
        setCutLines([...effectiveCutLines, newPos]);
        setMode("gui");
      } else {
        setCutLines((prev) => [...prev, newPos]);
      }
    },
    [mode, draggingIdx, isH, scale, imageEl, effectiveCutLines],
  );

  const onCanvasMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingIdx !== null) return;
      const w = wrapperRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [draggingIdx],
  );

  const downloadZip = useCallback(async () => {
    if (!imageEl || slicePreviews.length < 2) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const dim = isH ? imageEl.height : imageEl.width;
      const sorted = [0, ...effectiveCutLines, dim];
      for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i],
          end = sorted[i + 1];
        if (end <= start) continue;
        const sx = isH ? 0 : start,
          sy = isH ? start : 0;
        const sw = isH ? imageEl.width : end - start;
        const sh = isH ? end - start : imageEl.height;
        const cv = document.createElement("canvas");
        cv.width = sw;
        cv.height = sh;
        cv.getContext("2d")!.drawImage(imageEl, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), "image/png"));
        zip.file(`slice_${String(i + 1).padStart(3, "0")}.png`, blob);
      }
      const zb = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zb);
      a.download = `${fileName.replace(/\.[^/.]+$/, "") || "image"}_slices.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      setError("Failed to generate ZIP. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [imageEl, slicePreviews, effectiveCutLines, isH, fileName]);

  const totalSliceCount = effectiveCutLines.length + 1;

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
            <p className="text-sm text-slate-500 dark:text-slate-400">Slice images by fixed size or interactive cut points</p>
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
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-sm shrink-0">
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
              {(["horizontal", "vertical"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDirection(d);
                    setCutLines([]);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all capitalize ${
                    direction === d
                      ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {d.slice(0, 5)}.
                </button>
              ))}
            </div>

            {/* Fixed-size input */}
            {mode === "fixed" && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{isH ? "H" : "W"}:</label>
                <input
                  type="number"
                  value={sliceSize}
                  onChange={(e) => setSliceSize(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-16 bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            )}

            {/* Slice count badge */}
            {effectiveCutLines.length > 0 && (
              <span className="text-[10px] text-slate-400 font-medium ml-auto whitespace-nowrap">
                {effectiveCutLines.length} cut{effectiveCutLines.length !== 1 ? "s" : ""} → {totalSliceCount} slice{totalSliceCount !== 1 ? "s" : ""}
              </span>
            )}

            {/* GUI: hint + clear */}
            {mode === "gui" && cutLines.length > 0 && (
              <button
                onClick={() => setCutLines([])}
                className="text-[10px] text-red-500 hover:text-red-600 font-semibold transition-colors"
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
          <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100/50 dark:bg-[#0a0d12] p-4 sm:p-6 md:p-8" style={{ scrollbarWidth: "thin" }}>
            <div
              ref={wrapperRef}
              className="relative mx-auto select-none"
              style={{
                width: displayWidth,
                height: displayHeight,
                cursor: "crosshair",
                backgroundImage:
                  "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
                backgroundColor: "#f3f4f6",
              }}
              onClick={onCanvasClick}
              onMouseMove={onCanvasMove}
              onMouseLeave={() => setMousePos(null)}
            >
              {/* Image canvas */}
              <canvas ref={canvasRef} className="block relative z-[1] pointer-events-none" />

              {/* Ghost line (hover indicator) */}
              {mousePos && draggingIdx === null && (
                <div
                  className="absolute pointer-events-none z-[2]"
                  style={
                    isH
                      ? { top: mousePos.y, left: 0, right: 0, height: 2, background: "rgba(249,115,22,0.25)", transform: "translateY(-1px)" }
                      : { left: mousePos.x, top: 0, bottom: 0, width: 2, background: "rgba(249,115,22,0.25)", transform: "translateX(-1px)" }
                  }
                />
              )}

              {/* Onboarding overlay */}
              {mode === "gui" && cutLines.length === 0 && (
                <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                  <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg shadow-lg">
                    Click anywhere to add a cut line
                  </span>
                </div>
              )}

              {/* Cut lines */}
              {effectiveCutLines.map((pos, i) => {
                const dp = pos * scale;
                const dragging = draggingIdx === i;
                return (
                  <div
                    key={`${direction}-${i}-${mode}`}
                    className={`absolute z-[5] group ${isH ? "left-0 right-0" : "top-0 bottom-0"}`}
                    style={isH ? { top: dp } : { left: dp }}
                  >
                    {/* Visible line */}
                    <div
                      className={`absolute ${isH ? "left-0 right-0 h-[2px] -top-[1px]" : "top-0 bottom-0 w-[2px] -left-[1px]"}`}
                      style={{
                        background: dragging ? "#ea580c" : "#f97316",
                        boxShadow: `0 0 ${dragging ? 10 : 6}px rgba(249,115,22,${dragging ? 0.7 : 0.4})`,
                      }}
                    />

                    {/* Drag handle (always shown — converts to GUI on drag in fixed mode) */}
                    <div
                      className={`slicer-btn absolute z-10 rounded-full border-2 border-white dark:border-slate-900 shadow-lg transition-transform ${
                        dragging ? "scale-125 bg-orange-600" : "bg-orange-500 hover:scale-110"
                      } ${isH ? "cursor-ns-resize" : "cursor-ew-resize"}`}
                      style={{
                        width: 14,
                        height: 14,
                        touchAction: "none",
                        ...(isH ? { left: "50%", marginLeft: -7, top: -7 } : { top: "50%", marginTop: -7, left: -7 }),
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (mode === "fixed") {
                          setCutLines([...effectiveCutLines]);
                          setMode("gui");
                        }
                        setDraggingIdx(i);
                      }}
                    />

                    {/* Position label (shows on hover) */}
                    <div
                      className={`absolute pointer-events-none text-[9px] font-mono leading-none px-1.5 py-1 rounded shadow-sm whitespace-nowrap transition-opacity ${
                        dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{
                        background: "rgba(249,115,22,0.9)",
                        color: "#fff",
                        ...(isH ? { left: 8, top: -18 } : { left: 4, top: -20 }),
                      }}
                    >
                      {Math.round(pos)}px
                    </div>

                    {/* Delete button (always shown — converts to GUI on delete in fixed mode) */}
                    <button
                      className={`slicer-btn absolute z-10 w-[18px] h-[18px] rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all ${
                        dragging ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
                      }`}
                      style={isH ? { right: 6, top: -9 } : { left: -9, top: 6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (mode === "fixed") {
                          const lines = [...effectiveCutLines];
                          lines.splice(i, 1);
                          setCutLines(lines);
                          setMode("gui");
                        } else {
                          setCutLines((p) => p.filter((_, j) => j !== i));
                        }
                      }}
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Inline preview + download (below canvas, inside scroll) ── */}
            {slicePreviews.length > 1 && (
              <div className="max-w-4xl mx-auto px-3 py-3">
                {/* Preview row */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {totalSliceCount} Slice{totalSliceCount !== 1 ? "s" : ""}
                  </h3>
                  {totalSliceCount > MAX_PREVIEWS && (
                    <span className="text-[10px] text-slate-400">(showing first {MAX_PREVIEWS})</span>
                  )}

                  {/* Download button inline */}
                  <button
                    onClick={downloadZip}
                    disabled={isDownloading}
                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-white text-xs transition-all ${
                      isDownloading
                        ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98]"
                    }`}
                  >
                    {isDownloading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {isDownloading ? "Generating..." : "Download ZIP"}
                  </button>
                </div>

                {/* Thumbnails */}
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                  {slicePreviews.map((p) => (
                    <div
                      key={p.index}
                      className="shrink-0 flex flex-col items-center bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden hover:border-orange-300 dark:hover:border-orange-700/60 transition-colors"
                      style={{ width: 72 }}
                    >
                      <div className="w-full h-14 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-1 overflow-hidden">
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
