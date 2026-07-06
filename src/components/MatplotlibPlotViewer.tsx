import { formatFileSize } from "../lib/formatFileSize";
import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Image, FileText, ChevronDown, LineChart, RefreshCw, Layers } from "lucide-react";

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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showFormatsDropdown, setShowFormatsDropdown] = useState(false);

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

  // Handle zooming & panning via trackpad/mousewheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Trackpad pinch-to-zoom is signaled by Ctrl key in wheel events
      const isPinch = e.ctrlKey;
      let scaleChange = 1;

      if (isPinch) {
        scaleChange = -e.deltaY * 0.015;
      } else {
        scaleChange = -e.deltaY * 0.002;
      }

      setZoom((prevZoom) => {
        const nextZoom = Math.max(0.15, Math.min(6.0, prevZoom + scaleChange * prevZoom));

        // Pan toward pointer coordinate so zoom is centered around hover point
        setPan((prevPan) => {
          const ratio = nextZoom / prevZoom;
          const x = mouseX - (mouseX - prevPan.x) * ratio;
          const y = mouseY - (mouseY - prevPan.y) * ratio;
          return { x, y };
        });

        return nextZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(prev + 0.15, 6.0);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.15, 0.15);
      return next;
    });
  };

  const handleReset = () => {
    setZoom(0.95); // fitted aspect ratio
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Mobile multi-touch pinch gestures
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchMidpoint = (t1: React.Touch, t2: React.Touch, rect: DOMRect) => {
    return {
      x: (t1.clientX + t2.clientX) / 2 - rect.left,
      y: (t1.clientY + t2.clientY) / 2 - rect.top,
    };
  };

  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialTouchZoomRef = useRef<number>(1);
  const initialTouchPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    if (e.touches.length === 2) {
      const rect = container.getBoundingClientRect();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      initialTouchDistanceRef.current = dist;
      initialTouchZoomRef.current = zoom;
      initialTouchPanRef.current = { ...pan };
      initialMidpointRef.current = getTouchMidpoint(e.touches[0], e.touches[1], rect);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    if (e.touches.length === 2 && initialTouchDistanceRef.current !== null) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const currentMid = getTouchMidpoint(e.touches[0], e.touches[1], rect);

      const scaleChange = dist / initialTouchDistanceRef.current;
      const targetZoom = Math.max(0.15, Math.min(6.0, initialTouchZoomRef.current * scaleChange));

      const ratio = targetZoom / initialTouchZoomRef.current;
      const origin = initialMidpointRef.current;

      const px = currentMid.x - (origin.x - initialTouchPanRef.current.x) * ratio;
      const py = currentMid.y - (origin.y - initialTouchPanRef.current.y) * ratio;

      setZoom(targetZoom);
      setPan({ x: px, y: py });
    } else if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistanceRef.current = null;
    setIsDragging(false);
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
      <div className="flex items-center justify-center p-8 text-neutral-400 italic text-xs bg-neutral-900 rounded-lg border border-neutral-800">
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

  return (
    <div id="matplotlib-viewer-root" className="my-3 bg-[#111113] border border-[#222225] rounded-lg overflow-hidden shadow-lg flex flex-col w-full max-w-[620px] font-sans select-none text-neutral-200">
      
      {/* 1. Header Toolbar (Re-created beautifully from reference image, made compact) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e0e10] border-b border-[#212124] h-10">
        {/* Left: Plot symbol and text view */}
        <div className="flex items-center gap-2">
          <LineChart className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-300 text-xs font-semibold tracking-wide">
            Plot Viewer
          </span>
        </div>

        {/* Center: Interactive action controllers */}
        <div className="flex items-center gap-0.5">
          
          {/* Zoom In Button inside custom tooltipped frame */}
          <div className="group relative">
            <button
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all outline-none"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[#0b0b0c] text-neutral-200 text-[10px] rounded border border-neutral-800 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0b0b0c] border-t border-l border-neutral-800 rotate-45" />
              <span className="relative z-10 font-medium">Zoom In (Ctrl++)</span>
            </div>
          </div>

          {/* Zoom Out Button inside custom tooltipped frame */}
          <div className="group relative">
            <button
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all outline-none"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[#0b0b0c] text-neutral-200 text-[10px] rounded border border-neutral-800 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0b0b0c] border-t border-l border-neutral-800 rotate-45" />
              <span className="relative z-10 font-medium">Zoom Out (Ctrl+-)</span>
            </div>
          </div>

          {/* Reset Fit Target Square Box */}
          <div className="group relative">
            <button
              id="btn-fit-canvas"
              onClick={handleReset}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all outline-none"
              aria-label="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[#0b0b0c] text-neutral-200 text-[10px] rounded border border-neutral-800 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-center">
              <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0b0b0c] border-t border-l border-neutral-800 rotate-45" />
              <span className="relative z-10 font-medium">Reset View & Pan (Ctrl+0)</span>
            </div>
          </div>

          {/* Live Zoom scale indicator value style */}
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-neutral-500 select-none">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Right: Modern premium design "Export" action dropdown button */}
        <div className="relative">
          <button
            id="btn-export-dropdown"
            onClick={() => setShowFormatsDropdown(!showFormatsDropdown)}
            className="h-7 px-2.5 rounded bg-[#202023] hover:bg-[#28282b] text-neutral-100 border border-[#303034]/60 shadow transition-all duration-150 flex items-center justify-center gap-1 font-semibold text-[10px] select-none outline-none active:scale-95"
          >
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {showFormatsDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFormatsDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-52 bg-neutral-950 border border-neutral-800 rounded shadow-2xl py-1 z-20 text-neutral-200 animate-in fade-in duration-100">
                <div className="px-3 py-1 text-[9px] text-neutral-500 uppercase tracking-wider font-extrabold">
                  Download Options
                </div>
                
                {payload.svg && (
                  <button
                    onClick={() => handleDownload("svg")}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#161618] flex items-center justify-between text-[11px] transition"
                  >
                    <span className="flex items-center gap-2 font-medium text-neutral-200">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      Save as Vector SVG
                    </span>
                    <span className="text-[8px] bg-emerald-950/75 text-emerald-300 px-1 py-0.2 rounded font-extrabold border border-emerald-800/40">Vector</span>
                  </button>
                )}

                <button
                  onClick={() => handleDownload("png")}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#161618] flex items-center justify-between text-[11px] transition"
                >
                  <span className="flex items-center gap-2 font-medium text-neutral-200">
                    <Image className="w-3.5 h-3.5 text-sky-400" />
                    Save as PNG Image
                  </span>
                  <span className="text-[8px] bg-neutral-900 text-neutral-500 px-1 py-0.2 rounded border border-neutral-800 font-bold">300dpi</span>
                </button>

                {payload.jpeg && (
                  <button
                    onClick={() => handleDownload("jpeg")}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#161618] flex items-center justify-between text-[11px] transition"
                  >
                    <span className="flex items-center gap-2 font-medium text-neutral-200">
                      <Image className="w-3.5 h-3.5 text-amber-500" />
                      Save as JPEG Image
                    </span>
                  </button>
                )}

                {payload.pdf && (
                  <button
                    onClick={() => handleDownload("pdf")}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#161618] flex items-center justify-between text-[11px] transition"
                  >
                    <span className="flex items-center gap-2 font-medium text-neutral-200">
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      Save as printable PDF
                    </span>
                    <span className="text-[8px] bg-neutral-900 text-slate-400 px-1 py-0.2 rounded border border-neutral-800 font-extrabold">PDF</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Plot Canvas Box: Compact height centering the paper sheet */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleReset}
        className={`relative flex items-center justify-center bg-[#070708] p-3.5 min-h-[250px] md:min-h-[280px] max-h-[320px] overflow-hidden select-none transition-all ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ touchAction: "none" }}
      >
        {/* Soft grid/dots background accent with very subtle low opacity */}
        <div className="absolute inset-0 bg-[#060607] bg-[radial-gradient(#1e1e24_1px,transparent_1px)] bg-[size:18px_18px] pointer-events-none opacity-30" />

        {/* Neatly styled rectangular white board containing the plot */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center",
            transition: isDragging ? "none" : "transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="relative block bg-white rounded shadow-md border border-neutral-200 p-2 select-none pointer-events-none flex items-center justify-center w-full max-w-[420px] aspect-[4/3] max-h-[270px] hover:border-neutral-300 transition-colors"
        >
          {/* Matplotlib image element centered perfectly inside card */}
          <img
            src={displaySrc}
            alt="Centering Matplotlib Plot Output"
            className="max-w-full max-h-full h-auto w-auto object-contain select-none pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* 3. Footer Bar: Metadata Specifications */}
      <div className="flex items-center justify-between px-3 h-8 bg-[#0e0e10] border-t border-[#212124] text-[10px] font-mono text-neutral-400">
        
        {/* Active render format options */}
        <div className="flex items-center gap-1.55">
          <button
            onClick={() => setActiveFormat("svg")}
            className={`px-1.5 py-0.5 rounded text-[9px] transition ${
              activeFormat === "svg"
                ? "bg-neutral-800 text-neutral-100 font-bold"
                : "hover:text-neutral-200"
            }`}
            title="Switch display to infinite SVG vectors"
          >
            SVG
          </button>
          
          <span className="text-neutral-700/80 text-[9px] select-none">|</span>
          
          <button
            onClick={() => setActiveFormat("png")}
            className={`px-1.5 py-0.5 rounded text-[9px] transition ${
              activeFormat === "png"
                ? "bg-neutral-800 text-neutral-100 font-bold"
                : "hover:text-neutral-200"
            }`}
            title="Switch display to exact High-Res standard PNG output"
          >
            PNG
          </button>
        </div>

        {/* Right metadata log values */}
        <div className="flex items-center gap-2">
          <span>800×600</span>
          <span className="text-neutral-700/80 select-none">|</span>
          <span className="flex items-center gap-1 text-[9px]">
            <Layers className="w-2.5 h-2.5 text-neutral-500" />
            {activeFormat === "svg" ? "Vector" : "Grid (300dpi)"}
          </span>
          <span className="text-neutral-700/80 select-none">|</span>
          <span className="font-semibold text-neutral-300">{getFileSizeString()}</span>
        </div>
      </div>
    </div>
  );
}
