import { formatFileSize } from "../lib/formatFileSize";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Image,
  FileText,
  ChevronDown,
  LineChart,
  RefreshCw,
  Layers,
  X,
} from "lucide-react";

interface MatplotlibPlotViewerProps {
  imageData: string; // "data:image/png;base64,..." OR "__MATPLOTLIB_IMAGE_JSON__:..."
}

interface PlotPayload {
  png: string;
  jpeg?: string;
  svg?: string;
  pdf?: string;
}

export function MatplotlibPlotViewer({ imageData }: MatplotlibPlotViewerProps) {
  const [payload, setPayload] = useState<PlotPayload | null>(null);
  const [activeFormat, setActiveFormat] = useState<"svg" | "png" | "jpeg">("svg");
  const [zoom, setZoom] = useState(0.95); // compact default fit
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showFormatsDropdown, setShowFormatsDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const interactTimeoutRef = useRef<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse payload from schema string
  useEffect(() => {
    if (imageData.startsWith("__MATPLOTLIB_IMAGE_JSON__:")) {
      try {
        const jsonStr = imageData.substring(26);
        const parsed = JSON.parse(jsonStr) as PlotPayload;
        setPayload(parsed);
        if (parsed.svg) {
          setActiveFormat("svg");
        } else {
          setActiveFormat("png");
        }
      } catch (err) {
        console.error("Failed to parse Matplotlib JSON payload:", err);
        setPayload({ png: imageData });
        setActiveFormat("png");
      }
    } else if (imageData.startsWith("data:")) {
      setPayload({ png: imageData });
      setActiveFormat("png");
    } else {
      setPayload({ png: `data:image/png;base64,${imageData}` });
      setActiveFormat("png");
    }
  }, [imageData]);

  // Handle zooming & panning via trackpad, mousewheel, and mobile multi-touch gestures
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartDist = 0;
    let touchStartZoom = 1;
    let touchStartPan = { x: 0, y: 0 };
    let touchStartMid = { x: 0, y: 0 };
    let isTouchPinching = false;
    let isTouchDragging = false;
    let touchDragStart = { x: 0, y: 0 };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setIsInteracting(true);

      const rect = container.getBoundingClientRect();
      // Calculate mouse position relative to the center of the container
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      let factor = 1;
      let isPanGesture = false;

      if (e.ctrlKey) {
        // Trackpad pinch-to-zoom gesture (exponential scaling for smooth responsiveness)
        factor = Math.exp(-e.deltaY * 0.012);
      } else if (Math.abs(e.deltaX) > 0 || (Math.abs(e.deltaY) < 50 && e.deltaMode === 0)) {
        // Trackpad 2-finger scroll/pan
        isPanGesture = true;
      } else {
        // Standard physical mouse wheel notch
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 33;
        factor = dy > 0 ? 0.88 : 1.14;
      }

      if (isPanGesture) {
        const newPanX = currentPan.x - e.deltaX;
        const newPanY = currentPan.y - e.deltaY;
        panRef.current = { x: newPanX, y: newPanY };
        setPan({ x: newPanX, y: newPanY });
      } else {
        const nextZoom = Math.max(0.15, Math.min(8.0, currentZoom * factor));
        const zoomRatio = nextZoom / currentZoom;

        // Zoom centered around the exact mouse pointer position
        const newPanX = mouseX - (mouseX - currentPan.x) * zoomRatio;
        const newPanY = mouseY - (mouseY - currentPan.y) * zoomRatio;

        zoomRef.current = nextZoom;
        panRef.current = { x: newPanX, y: newPanY };
        setZoom(nextZoom);
        setPan({ x: newPanX, y: newPanY });
      }

      if (interactTimeoutRef.current) clearTimeout(interactTimeoutRef.current);
      interactTimeoutRef.current = setTimeout(() => {
        setIsInteracting(false);
      }, 120);
    };

    // Native touch handlers with { passive: false } to allow e.preventDefault()
    const handleNativeTouchStart = (e: TouchEvent) => {
      setIsInteracting(true);

      if (e.touches.length === 2) {
        e.preventDefault();
        isTouchPinching = true;
        isTouchDragging = false;

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchStartZoom = zoomRef.current;
        touchStartPan = { ...panRef.current };

        const rect = container.getBoundingClientRect();
        touchStartMid = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2,
          y: (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2,
        };
      } else if (e.touches.length === 1) {
        isTouchPinching = false;
        isTouchDragging = true;
        const t = e.touches[0];
        touchDragStart = {
          x: t.clientX - panRef.current.x,
          y: t.clientY - panRef.current.y,
        };
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isTouchPinching && touchStartDist > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const scale = currentDist / touchStartDist;

        const nextZoom = Math.max(0.15, Math.min(8.0, touchStartZoom * scale));
        const zoomRatio = nextZoom / touchStartZoom;

        const rect = container.getBoundingClientRect();
        const currentMidX = (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2;
        const currentMidY = (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2;

        const newPanX = currentMidX - (touchStartMid.x - touchStartPan.x) * zoomRatio;
        const newPanY = currentMidY - (touchStartMid.y - touchStartPan.y) * zoomRatio;

        zoomRef.current = nextZoom;
        panRef.current = { x: newPanX, y: newPanY };
        setZoom(nextZoom);
        setPan({ x: newPanX, y: newPanY });
      } else if (e.touches.length === 1 && isTouchDragging) {
        e.preventDefault();
        const t = e.touches[0];
        const newPanX = t.clientX - touchDragStart.x;
        const newPanY = t.clientY - touchDragStart.y;
        panRef.current = { x: newPanX, y: newPanY };
        setPan({ x: newPanX, y: newPanY });
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isTouchPinching = false;
        isTouchDragging = false;
        touchStartDist = 0;
        setIsInteracting(false);
      } else if (e.touches.length === 1) {
        // Transition seamlessly to single-finger drag
        isTouchPinching = false;
        isTouchDragging = true;
        touchStartDist = 0;
        const t = e.touches[0];
        touchDragStart = {
          x: t.clientX - panRef.current.x,
          y: t.clientY - panRef.current.y,
        };
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleNativeTouchStart, { passive: false });
    container.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    container.addEventListener("touchend", handleNativeTouchEnd);
    container.addEventListener("touchcancel", handleNativeTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleNativeTouchStart);
      container.removeEventListener("touchmove", handleNativeTouchMove);
      container.removeEventListener("touchend", handleNativeTouchEnd);
      container.removeEventListener("touchcancel", handleNativeTouchEnd);
      if (interactTimeoutRef.current) clearTimeout(interactTimeoutRef.current);
    };
  }, [isFullscreen]);

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(prev + 0.15, 6.0);
      zoomRef.current = next;
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.15, 0.15);
      zoomRef.current = next;
      return next;
    });
  };

  const handleReset = () => {
    const initZoom = isFullscreen ? 1.0 : 0.95;
    zoomRef.current = initZoom;
    panRef.current = { x: 0, y: 0 };
    setZoom(initZoom);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      const initZoom = next ? 1.0 : 0.95;
      zoomRef.current = initZoom;
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
      setZoom(initZoom);
      return next;
    });
  };

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        zoomRef.current = 0.95;
        panRef.current = { x: 0, y: 0 };
        setPan({ x: 0, y: 0 });
        setZoom(0.95);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Lock body scroll during fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setIsInteracting(true);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const newPanX = e.clientX - dragStartRef.current.x;
    const newPanY = e.clientY - dragStartRef.current.y;
    panRef.current = { x: newPanX, y: newPanY };
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    setIsInteracting(false);
    isDraggingRef.current = false;
  };

  const handleDownload = (format: "png" | "jpeg" | "svg" | "pdf") => {
    if (!payload) return;
    let dataUrl = "";
    let extension = format;

    if (format === "png") {
      dataUrl = payload.png;
    } else if (format === "jpeg" && payload.jpeg) {
      dataUrl = payload.jpeg;
    } else if (format === "svg" && payload.svg) {
      dataUrl = payload.svg;
    } else if (format === "pdf" && payload.pdf) {
      dataUrl = payload.pdf;
    } else {
      dataUrl = payload.png;
      extension = "png";
    }

    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `matplotlib_plot.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowFormatsDropdown(false);
  };

  if (!payload) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--vsc-fg-muted)] italic text-xs bg-[var(--vsc-panel-body)] rounded-[4px] border border-[var(--vsc-border)]">
        <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin text-indigo-500" />
        Processing plot representation...
      </div>
    );
  }

  // Get active format source
  let displaySrc = payload.png;
  if (activeFormat === "svg" && payload.svg) {
    displaySrc = payload.svg;
  } else if (activeFormat === "jpeg" && payload.jpeg) {
    displaySrc = payload.jpeg;
  }

  // Dynamic file size calculations from standard base64 encoding limits
  const getFileSizeString = () => {
    try {
      const src = displaySrc || "";
      const base64Length = src.split(",")[1]?.length || src.length;
      const estimatedBytes = base64Length * 0.75;
      return formatFileSize(estimatedBytes || 32768, 'B', 1);
    } catch {
      return formatFileSize(32768, 'B', 1);
    }
  };

  const renderViewer = (inFullscreen: boolean) => (
    <div
      id={inFullscreen ? "matplotlib-viewer-fullscreen" : "matplotlib-viewer-root"}
      className={
        inFullscreen
          ? "fixed inset-0 z-[9999999] bg-[var(--vsc-editor)] flex flex-col w-screen h-screen m-0 p-0 overflow-hidden font-sans select-none text-[var(--vsc-fg)] animate-in fade-in duration-150"
          : "my-3 bg-[var(--vsc-panel-body)] border border-[var(--vsc-border)] rounded-[4px] overflow-hidden flex flex-col w-full max-w-[620px] font-sans select-none text-[var(--vsc-fg)]"
      }
    >
      {/* 1. Header Toolbar */}
      <div
        className={`flex items-center justify-between bg-[var(--vsc-panel)] border-b border-[var(--vsc-border)] ${
          inFullscreen ? "h-11 px-4" : "h-10 px-3 py-1.5"
        }`}
      >
        {/* Left: Plot symbol and title */}
        <div className="flex items-center gap-2">
          <LineChart className="w-3.5 h-3.5 text-[var(--vsc-fg-muted)]" />
          <span
            className={`font-semibold tracking-wide ${
              inFullscreen
                ? "text-sm text-[var(--vsc-fg)]"
                : "text-xs text-[var(--vsc-fg)]"
            }`}
          >
            Plot Viewer
          </span>
        </div>

        {/* Center: Interactive action controllers */}
        <div className="flex items-center gap-0.5">
          {/* Zoom In Button */}
          <div className="group relative">
            <button
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="p-1.5 rounded text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] active:scale-95 transition-all outline-none cursor-pointer"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[var(--vsc-widget)] text-[var(--vsc-fg)] text-[10px] rounded border border-[var(--vsc-border-strong)] opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--vsc-widget)] border-t border-l border-[var(--vsc-border-strong)] rotate-45" />
              <span className="relative z-10 font-medium">Zoom In (Ctrl++)</span>
            </div>
          </div>

          {/* Zoom Out Button */}
          <div className="group relative">
            <button
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="p-1.5 rounded text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] active:scale-95 transition-all outline-none cursor-pointer"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[var(--vsc-widget)] text-[var(--vsc-fg)] text-[10px] rounded border border-[var(--vsc-border-strong)] opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--vsc-widget)] border-t border-l border-[var(--vsc-border-strong)] rotate-45" />
              <span className="relative z-10 font-medium">Zoom Out (Ctrl+-)</span>
            </div>
          </div>

          {/* Reset Fit Target Square Box */}
          <div className="group relative">
            <button
              id="btn-fit-canvas"
              onClick={handleReset}
              className="p-1.5 rounded text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] active:scale-95 transition-all outline-none cursor-pointer"
              aria-label="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[var(--vsc-widget)] text-[var(--vsc-fg)] text-[10px] rounded border border-[var(--vsc-border-strong)] opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--vsc-widget)] border-t border-l border-[var(--vsc-border-strong)] rotate-45" />
              <span className="relative z-10 font-medium">Reset View & Pan (Ctrl+0)</span>
            </div>
          </div>

          {/* Live Zoom scale indicator value style */}
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-[var(--vsc-fg-muted)] select-none">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Right: Square Box Fullscreen Icon Button & Export action dropdown button */}
        <div className="flex items-center gap-1.5">
          {/* Square box icon-only Fullscreen button */}
          <button
            id="btn-header-fullscreen"
            onClick={handleToggleFullscreen}
            className="h-7 w-7 rounded bg-[var(--vsc-input)] hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg)] hover:text-[var(--vsc-fg)] border border-[var(--vsc-border-strong)] shadow transition-all duration-150 flex items-center justify-center select-none outline-none active:scale-95 cursor-pointer"
            title={inFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F)"}
            aria-label={inFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {inFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-[var(--vsc-fg)]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[var(--vsc-fg)]" />
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              id="btn-export-dropdown"
              onClick={() => setShowFormatsDropdown(!showFormatsDropdown)}
              className="h-7 px-2.5 rounded bg-[var(--vsc-input)] hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg)] border border-[var(--vsc-border-strong)] shadow transition-all duration-150 flex items-center justify-center gap-1 font-semibold text-[10px] select-none outline-none active:scale-95 cursor-pointer"
            >
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-[var(--vsc-fg-muted)]" />
            </button>

            {showFormatsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowFormatsDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-[var(--vsc-widget)] border border-[var(--vsc-border-strong)] rounded shadow-2xl py-1 z-50 text-[var(--vsc-fg)] animate-in fade-in duration-100">
                  <div className="px-3 py-1 text-[9px] text-[var(--vsc-fg-muted)] uppercase tracking-wider font-extrabold">
                    Download Options
                  </div>

                  {payload.svg && (
                    <button
                      onClick={() => handleDownload("svg")}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] flex items-center justify-between text-[11px] transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium text-[var(--vsc-fg)]">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        Save as Vector SVG
                      </span>
                      <span className="text-[8px] bg-emerald-950/75 text-emerald-300 px-1 py-0.2 rounded font-extrabold border border-emerald-800/40">
                        Vector
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownload("png")}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] flex items-center justify-between text-[11px] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium text-[var(--vsc-fg)]">
                      <Image className="w-3.5 h-3.5 text-sky-400" />
                      Save as PNG Image
                    </span>
                    <span className="text-[8px] bg-[var(--vsc-input)] text-[var(--vsc-fg-muted)] px-1 py-0.2 rounded border border-[var(--vsc-border-strong)] font-bold">
                      300dpi
                    </span>
                  </button>

                  {payload.jpeg && (
                    <button
                      onClick={() => handleDownload("jpeg")}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] flex items-center justify-between text-[11px] transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium text-[var(--vsc-fg)]">
                        <Image className="w-3.5 h-3.5 text-amber-500" />
                        Save as JPEG Image
                      </span>
                    </button>
                  )}

                  {payload.pdf && (
                    <button
                      onClick={() => handleDownload("pdf")}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] flex items-center justify-between text-[11px] transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium text-[var(--vsc-fg)]">
                        <FileText className="w-3.5 h-3.5 text-rose-400" />
                        Save as printable PDF
                      </span>
                      <span className="text-[8px] bg-[var(--vsc-input)] text-slate-400 px-1 py-0.2 rounded border border-[var(--vsc-border-strong)] font-extrabold">
                        PDF
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Plot Canvas Box */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onDoubleClick={handleReset}
        className={`relative flex items-center justify-center bg-[var(--vsc-editor)] overflow-hidden select-none transition-all ${
          inFullscreen
            ? "flex-1 w-full h-full min-h-0 p-6"
            : "p-3.5 min-h-[250px] md:min-h-[280px] max-h-[320px]"
        } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
      >
        {/* Soft grid/dots background accent with subtle opacity */}
        <div
          className={`absolute inset-0 bg-[var(--vsc-editor)] bg-[radial-gradient(var(--vsc-border)_1px,transparent_1px)] pointer-events-none opacity-30 ${
            inFullscreen ? "bg-[size:24px_24px]" : "bg-[size:18px_18px]"
          }`}
        />

        {/* Scaled rectangular white board containing the plot */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center",
            transition:
              isInteracting || isDragging
                ? "none"
                : "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className={`relative block bg-white rounded-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.35)] border border-neutral-200 select-none pointer-events-none flex items-center justify-center transition-colors ${
            inFullscreen
              ? "max-w-[94vw] max-h-[82vh] w-auto h-auto p-4 rounded-lg hover:border-neutral-300"
              : "w-full max-w-[420px] aspect-[4/3] max-h-[270px] p-2 hover:border-neutral-300"
          }`}
        >
          {/* Matplotlib image element centered perfectly inside card */}
          <img
            src={displaySrc}
            alt="Centering Matplotlib Plot Output"
            className={`object-contain select-none pointer-events-none ${
              inFullscreen
                ? "max-w-full max-h-[78vh] h-auto w-auto"
                : "max-w-full max-h-full h-auto w-auto"
            }`}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* 3. Footer Bar: Metadata Specifications */}
      <div
        className={`flex items-center justify-between px-3 bg-[var(--vsc-panel)] border-t border-[var(--vsc-border)] text-[10px] font-mono text-[var(--vsc-fg-muted)] ${
          inFullscreen ? "h-9 px-4 text-xs" : "h-8"
        }`}
      >
        {/* Active render format options */}
        <div className="flex items-center gap-1.55">
          <button
            onClick={() => setActiveFormat("svg")}
            className={`px-1.5 py-0.5 rounded text-[9px] transition cursor-pointer ${
              activeFormat === "svg"
                ? "bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] font-semibold"
                : "hover:text-[var(--vsc-fg)]"
            }`}
            title="Switch display to infinite SVG vectors"
          >
            SVG
          </button>

          <span className="text-[var(--vsc-border-strong)] text-[9px] select-none">|</span>

          <button
            onClick={() => setActiveFormat("png")}
            className={`px-1.5 py-0.5 rounded text-[9px] transition cursor-pointer ${
              activeFormat === "png"
                ? "bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] font-semibold"
                : "hover:text-[var(--vsc-fg)]"
            }`}
            title="Switch display to exact High-Res standard PNG output"
          >
            PNG
          </button>
        </div>

        {/* In Fullscreen mode: show handy navigation hints */}
        {inFullscreen && (
          <div className="hidden sm:flex items-center gap-2.5 text-[var(--vsc-fg-muted)] text-[11px]">
            <span>Drag to Pan</span>
            <span>•</span>
            <span>Scroll/Pinch to Zoom</span>
            <span>•</span>
            <span>Double-click to Reset</span>
            <span>•</span>
            <span>
              Press{" "}
              <kbd className="text-[var(--vsc-fg)] bg-[var(--vsc-input)] px-1 py-0.2 rounded border border-[var(--vsc-border-strong)]">
                Esc
              </kbd>{" "}
              to Exit
            </span>
          </div>
        )}

        {/* Right metadata log values */}
        <div className="flex items-center gap-2">
          <span>800×600</span>
          <span className="text-[var(--vsc-border-strong)] select-none">|</span>
          <span className="flex items-center gap-1 text-[9px]">
            <Layers className="w-2.5 h-2.5 text-[var(--vsc-fg-muted)]" />
            {activeFormat === "svg" ? "Vector" : "Grid (300dpi)"}
          </span>
          <span className="text-[var(--vsc-border-strong)] select-none">|</span>
          <span className="font-semibold text-[var(--vsc-fg)]">
            {getFileSizeString()}
          </span>
        </div>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return (
      <>
        {/* Inline placeholder while fullscreen view is active */}
        <div className="my-3 p-3 bg-[var(--vsc-panel-body)] border border-[var(--vsc-border)] rounded-[4px] text-xs text-[var(--vsc-fg-muted)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineChart className="w-3.5 h-3.5 text-[var(--vsc-fg-muted)]" />
            <span className="text-[var(--vsc-fg)] font-medium">
              Plot Viewer is active in Fullscreen
            </span>
          </div>
          <button
            onClick={handleToggleFullscreen}
            className="h-7 w-7 rounded bg-[var(--vsc-input)] hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg)] hover:text-[var(--vsc-fg)] border border-[var(--vsc-border-strong)] flex items-center justify-center transition-colors cursor-pointer"
            title="Exit Fullscreen (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5 text-[var(--vsc-fg)]" />
          </button>
        </div>

        {/* Fullscreen modal mounted directly to document.body */}
        {createPortal(renderViewer(true), document.body)}
      </>
    );
  }

  return renderViewer(false);
}
