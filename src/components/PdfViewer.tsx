import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink, Loader2, AlertCircle, Search, LayoutGrid, Sidebar, X, Play, Archive, FileDown, Maximize2, Minimize2, Check, FileImage, FileText, ChevronDown, BookOpen, Layers, Download, RotateCw, RotateCcw, AlignStartVertical, AlignCenterVertical } from "lucide-react";
import { useDebounce } from "use-debounce";
import * as pdfjsLib from "pdfjs-dist";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, MouseSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PDFDocument, degrees } from 'pdf-lib';


export type ExportImageFormat = 'png' | 'jpeg' | 'webp';

interface SortableThumbnailProps {
  pageNum: number;
  url: string;
  currentPage: number;
  selectionMode: boolean;
  isSelected: boolean;
  defaultFormat: ExportImageFormat;
  isDownloadingThisPage?: boolean;
  isFormatMenuOpen?: boolean;
  onSelect: (pageNum: number) => void;
  onGoToPage: (pageNum: number) => void;
  onLongPress: (pageNum: number) => void;
  onDownloadPage: (pageNum: number, format: ExportImageFormat) => void;
  onOpenFormatMenu: (pageNum: number) => void;
  onCloseFormatMenu: () => void;
}

interface ThumbnailCardProps {
  pageNum: number;
  url: string;
  currentPage: number;
  selectionMode: boolean;
  isSelected: boolean;
  defaultFormat: ExportImageFormat;
  isDownloadingThisPage?: boolean;
  isFormatMenuOpen?: boolean;
  onSelect?: (pageNum: number) => void;
  onGoToPage?: (pageNum: number) => void;
  onLongPress?: (pageNum: number) => void;
  onDownloadPage?: (pageNum: number, format: ExportImageFormat) => void;
  onOpenFormatMenu?: (pageNum: number) => void;
  onCloseFormatMenu?: () => void;
  isOverlay?: boolean;
  isDark?: boolean;
}

interface FormatMenuPortalProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  defaultFormat: ExportImageFormat;
  pageNum: number;
  onSelectFormat: (pageNum: number, format: ExportImageFormat) => void;
  onClose: () => void;
}

const FormatMenuPortal: React.FC<FormatMenuPortalProps> = ({
  buttonRef,
  defaultFormat,
  pageNum,
  onSelectFormat,
  onClose,
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 152;
    const menuHeight = 155;

    let top = rect.bottom + 6;
    let left = rect.left;

    // Flip vertically above button if near screen bottom edge
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - menuHeight - 6);
    }

    // Shift horizontally left if near screen right edge
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }

    // Clamp to left screen edge
    if (left < 12) {
      left = 12;
    }

    setCoords({ top, left });
  }, [buttonRef]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      onClose();
    };

    const handleScroll = () => onClose();

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [buttonRef, onClose]);

  if (!coords) return null;

  return createPortal(
    <div
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed w-38 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-[999999] p-1.5 divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-150 font-sans"
    >
      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 select-none flex items-center justify-between">
        <span>Format Options</span>
        <span className="text-[8px] font-mono text-indigo-400 font-bold">P.{pageNum}</span>
      </div>

      <div className="py-1 flex flex-col gap-0.5">
        {[
          { id: 'png' as const, label: 'PNG Image', ext: '.png', desc: 'Lossless 3x HD' },
          { id: 'jpeg' as const, label: 'JPEG Image', ext: '.jpg', desc: 'High quality' },
          { id: 'webp' as const, label: 'WEBP Image', ext: '.webp', desc: 'Modern compact' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelectFormat(pageNum, item.id);
              onClose();
            }}
            className={`w-full px-2 py-1.5 text-left text-xs font-semibold rounded-xl flex items-center justify-between transition-colors ${
              defaultFormat === item.id
                ? 'bg-indigo-600/35 text-indigo-200 font-bold border border-indigo-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-indigo-600 hover:text-white border border-transparent'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold flex items-center gap-1">
                {item.label}
                {defaultFormat === item.id && <Check size={10} className="text-indigo-400" />}
              </div>
              <div className="text-[9px] text-slate-400 font-normal">{item.desc}</div>
            </div>
            <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
              {item.ext}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

const ThumbnailCard: React.FC<ThumbnailCardProps> = React.memo(({
  pageNum,
  url,
  currentPage,
  selectionMode,
  isSelected,
  defaultFormat,
  isDownloadingThisPage = false,
  isFormatMenuOpen = false,
  onSelect,
  onGoToPage,
  onLongPress,
  onDownloadPage,
  onOpenFormatMenu,
  onCloseFormatMenu,
  isOverlay,
  isDark = false
}) => {
  const downloadHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement | null>(null);

  const clearHoldTimer = () => {
    if (downloadHoldTimerRef.current) {
      clearTimeout(downloadHoldTimerRef.current);
      downloadHoldTimerRef.current = null;
    }
  };

  const handleDownloadPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    clearHoldTimer();
    downloadHoldTimerRef.current = setTimeout(() => {
      onOpenFormatMenu?.(pageNum);
      downloadHoldTimerRef.current = null;
    }, 350);
  };

  const handleDownloadPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    clearHoldTimer();
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearHoldTimer();
    onDownloadPage?.(pageNum, defaultFormat);
  };

  return (
    <div
      onClick={(e) => {
        if (!isOverlay) {
          onGoToPage?.(pageNum);
        }
      }}
      className={`relative flex flex-col gap-1.5 cursor-pointer group select-none ${
        isOverlay
          ? 'scale-105 shadow-2xl z-50 pointer-events-none'
          : selectionMode
            ? ''
            : (currentPage === pageNum ? 'opacity-100' : 'opacity-85 hover:opacity-100')
      }`}
    >
      <div
        className={`rounded-xl overflow-hidden aspect-[1/1.4] relative border shadow-md transition-colors duration-150 ${isDark ? "bg-slate-950" : "bg-white"} ${
          isSelected
            ? isDark ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/15' : 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/20'
            : (currentPage === pageNum && !selectionMode
              ? isDark ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/15' : 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20'
              : isDark ? 'border-slate-800/80 group-hover:border-slate-600/80' : 'border-slate-200 group-hover:border-slate-300')
        }`}
      >
        <img
          src={url}
          alt={`Page ${pageNum}`}
          className="w-full h-full object-contain bg-white pointer-events-none select-none"
          loading="lazy"
          draggable={false}
        />

        {/* Soft top gradient */}
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-950/40 to-transparent pointer-events-none" />

        {/* Download Button (Top-Left Corner) */}
        {!isOverlay && (
          <div className="absolute top-1.5 left-1.5 z-20">
            <button
              ref={downloadButtonRef}
              type="button"
              onPointerDown={handleDownloadPointerDown}
              onPointerUp={handleDownloadPointerUp}
              onPointerCancel={clearHoldTimer}
              onPointerLeave={clearHoldTimer}
              onClick={handleDownloadClick}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900/85 hover:bg-indigo-600 backdrop-blur-md border border-slate-700/80 hover:border-indigo-500 text-slate-200 hover:text-white shadow-md transition-all ${
                selectionMode ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
              }`}
              title={`Click to download ${defaultFormat.toUpperCase()} • Hold for format options`}
            >
              {isDownloadingThisPage ? (
                <Loader2 size={11} className="animate-spin text-indigo-400" />
              ) : (
                <Download size={11} className="shrink-0" />
              )}
              <span className="text-[9px] font-mono font-bold uppercase tracking-tight text-indigo-300 group-hover:text-white">
                {defaultFormat}
              </span>
            </button>

            {/* Portal-based Format Picker Popover Menu */}
            {isFormatMenuOpen && (
              <FormatMenuPortal
                buttonRef={downloadButtonRef}
                defaultFormat={defaultFormat}
                pageNum={pageNum}
                onSelectFormat={(p, fmt) => onDownloadPage?.(p, fmt)}
                onClose={() => onCloseFormatMenu?.()}
              />
            )}
          </div>
        )}

        {/* Checkbox Button (Top-Right Corner) */}
        <button
          className={`absolute top-1.5 right-1.5 z-10 transition-all duration-200 ${
            selectionMode
              ? 'opacity-100 scale-100'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-90 sm:group-hover:scale-100'
          }`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!selectionMode) {
              onLongPress?.(pageNum);
            } else {
              onSelect?.(pageNum);
            }
          }}
          title={isSelected ? 'Deselect Page' : 'Select Page'}
        >
          {isSelected ? (
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/40 scale-100 transition-transform">
              <Check size={12} strokeWidth={3} />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-400/70 bg-slate-900/60 backdrop-blur-sm shadow-sm hover:border-indigo-400 hover:bg-slate-800 transition-all" />
          )}
        </button>

        {/* Active Page Pill */}
        {currentPage === pageNum && !selectionMode && (
          <div className="absolute bottom-1.5 left-1.5 z-10 px-2 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold tracking-wider backdrop-blur-md shadow-sm">
            ACTIVE
          </div>
        )}
      </div>

      <span
        className={`text-[11px] text-center font-medium tracking-tight select-none transition-colors ${
          isSelected
            ? 'text-indigo-300 font-semibold'
            : (currentPage === pageNum && !selectionMode
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 group-hover:text-slate-200')
        }`}
      >
        Page {pageNum}
      </span>
    </div>
  );
});

const SortableThumbnail: React.FC<SortableThumbnailProps> = React.memo(({
  pageNum,
  url,
  currentPage,
  selectionMode,
  isSelected,
  defaultFormat,
  isDownloadingThisPage,
  isFormatMenuOpen,
  onSelect,
  onGoToPage,
  onLongPress,
  onDownloadPage,
  onOpenFormatMenu,
  onCloseFormatMenu
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pageNum.toString() });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.25 : 1,
    touchAction: 'pan-y',
    willChange: 'transform',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <ThumbnailCard
        pageNum={pageNum}
        url={url}
        currentPage={currentPage}
        selectionMode={selectionMode}
        isSelected={isSelected}
        defaultFormat={defaultFormat}
        isDownloadingThisPage={isDownloadingThisPage}
        isFormatMenuOpen={isFormatMenuOpen}
        onSelect={onSelect}
        onGoToPage={onGoToPage}
        onLongPress={onLongPress}
        onDownloadPage={onDownloadPage}
        onOpenFormatMenu={onOpenFormatMenu}
        onCloseFormatMenu={onCloseFormatMenu}
      />
    </div>
  );
});

interface VirtualizedThumbnailSlotProps {
  pageNum: number;
  thumbnailUrl: string | null;
  currentPage: number;
  selectionMode: boolean;
  isSelected: boolean;
  defaultFormat: ExportImageFormat;
  isDownloadingThisPage?: boolean;
  isFormatMenuOpen?: boolean;
  isDark?: boolean;
  onRequestThumbnail: (pageNum: number) => void;
  onSelect: (pageNum: number) => void;
  onGoToPage: (pageNum: number) => void;
  onLongPress: (pageNum: number) => void;
  onDownloadPage: (pageNum: number, format: ExportImageFormat) => void;
  onOpenFormatMenu: (pageNum: number) => void;
  onCloseFormatMenu: () => void;
}

/**
 * Virtualized thumbnail slot that uses IntersectionObserver to lazily request
 * thumbnail generation only when the placeholder enters the visible viewport.
 * This prevents rendering all thumbnails at once for large PDFs.
 */
const VirtualizedThumbnailSlot: React.FC<VirtualizedThumbnailSlotProps> = React.memo(({
  pageNum,
  thumbnailUrl,
  currentPage,
  selectionMode,
  isSelected,
  defaultFormat,
  isDownloadingThisPage,
  isFormatMenuOpen,
  onRequestThumbnail,
  onSelect,
  onGoToPage,
  onLongPress,
  onDownloadPage,
  onOpenFormatMenu,
  onCloseFormatMenu,
  isDark = false,
}) => {
  const observerElRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasRequestedRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pageNum.toString() });

  // Merge the sortable ref with our observer ref
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    observerElRef.current = node;
  }, [setNodeRef]);

  useEffect(() => {
    const el = observerElRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Request thumbnail generation if not already loaded or requested
            if (!thumbnailUrl && !hasRequestedRef.current) {
              hasRequestedRef.current = true;
              onRequestThumbnail(pageNum);
            }
          } else {
            setIsVisible(false);
          }
        }
      },
      {
        // Use a generous rootMargin to pre-load thumbnails slightly before they enter viewport
        rootMargin: '200px 0px 200px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNum, thumbnailUrl, onRequestThumbnail]);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.25 : 1,
    touchAction: 'pan-y',
    willChange: 'transform',
  };

  // If the thumbnail URL is available, render the full card with sortable wrapper
  if (thumbnailUrl) {
    return (
      <div ref={mergedRef} style={sortableStyle} {...attributes} {...listeners}>
        <ThumbnailCard
          pageNum={pageNum}
          url={thumbnailUrl}
          currentPage={currentPage}
          selectionMode={selectionMode}
          isSelected={isSelected}
          defaultFormat={defaultFormat}
          isDownloadingThisPage={isDownloadingThisPage}
          isFormatMenuOpen={isFormatMenuOpen}
          onSelect={onSelect}
          onGoToPage={onGoToPage}
          onLongPress={onLongPress}
          onDownloadPage={onDownloadPage}
          onOpenFormatMenu={onOpenFormatMenu}
          onCloseFormatMenu={onCloseFormatMenu}
          isDark={isDark}
        />
      </div>
    );
  }

  // Placeholder for thumbnails that haven't loaded yet (also sortable)
  return (
    <div
      ref={mergedRef}
      style={sortableStyle}
      {...attributes}
      {...listeners}
      className="relative flex flex-col gap-1.5 select-none"
    >
      <div className={`rounded-xl overflow-hidden aspect-[1/1.4] relative border shadow-md flex items-center justify-center ${isDark ? "bg-slate-950 border-slate-800/80" : "bg-slate-50 border-slate-200"}`}>
        {isVisible ? (
          <div className="flex flex-col items-center gap-1.5 text-slate-500">
            <Loader2 size={16} className={`animate-spin ${isDark ? "text-indigo-500/70" : "text-indigo-400"}`} />
            <span className={`text-[9px] font-mono font-medium tracking-wide ${isDark ? "" : "text-slate-400"}`}>Loading...</span>
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            <LayoutGrid size={14} className={isDark ? "text-slate-700" : "text-slate-300"} />
            <span className="text-[9px] font-mono font-medium tracking-wide">Page {pageNum}</span>
          </div>
        )}
      </div>
      <span className="text-[11px] text-center font-medium tracking-tight select-none text-slate-500">
        Page {pageNum}
      </span>
    </div>
  );
});

// Initialize the pdf.js worker using unpkg CDN to bypass Vite bundling issues with .mjs workers
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  alignment?: 'top' | 'center';
  isDark?: boolean;
}

interface PdfPageCanvasProps {
  pdfDoc: any;
  pageNum: number;
  scale: number;
  rotation?: number;
  onVisible?: (pageNum: number) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({ pdfDoc, pageNum, scale, rotation = 0, onVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const renderTaskRef = useRef<any>(null);
  const [debouncedScale] = useDebounce(scale, 300);

  useEffect(() => {
    if (!pdfDoc) return;
    let active = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && onVisible) {
            onVisible(pageNum);
          }
        });
      },
      { threshold: 0.25 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    pdfDoc.getPage(pageNum).then((page: any) => {
      if (!active) return;
      const baseRotation = page.rotate || 0;
      const finalRotation = (baseRotation + rotation) % 360;
      const baseViewport = page.getViewport({ scale: 1.0, rotation: finalRotation });
      setViewportSize({ width: baseViewport.width, height: baseViewport.height });

      const canvas = canvasRef.current;
      if (!canvas) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      // Dynamic crisp render resolution based on debounced zoom scale
      const renderScale = Math.max(debouncedScale * 2.0, 2.0);
      const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      renderTask.promise
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error(`Page ${pageNum} render error:`, err);
          }
        });
    });

    return () => {
      active = false;
      observer.disconnect();
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, debouncedScale, rotation]);

  return (
    <div
      id={`pdf-page-${pageNum}`}
      ref={containerRef}
      className="shadow-md border border-slate-700/30 bg-white overflow-hidden relative flex-shrink-0 mx-auto transition-shadow rounded-sm"
      style={{
        width: viewportSize.width ? `${viewportSize.width * scale}px` : 'auto',
        height: viewportSize.height ? `${viewportSize.height * scale}px` : 'auto',
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block relative z-0" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold select-none z-10 opacity-70">
        Page {pageNum}
      </div>
    </div>
  );
};

interface PdfPlaceholderCanvasProps {
  pageNum: number;
  width: number;
  height: number;
  onVisible?: (pageNum: number) => void;
}

const PdfPlaceholderCanvas: React.FC<PdfPlaceholderCanvasProps> = ({ pageNum, width, height, onVisible }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && onVisible && active) {
            onVisible(pageNum);
          }
        });
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [pageNum, onVisible]);

  return (
    <div
      id={`pdf-page-${pageNum}`}
      ref={containerRef}
      className="shadow-sm border border-slate-800/40 bg-slate-950/40 rounded-sm flex items-center justify-center flex-shrink-0 mx-auto transition-colors relative select-none"
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '600px',
      }}
    >
      <div className="flex flex-col items-center gap-1.5 text-slate-500">
        <Loader2 size={18} className="animate-spin text-indigo-500/70 mb-0.5" />
        <span className="text-xs font-mono font-medium tracking-wide">Page {pageNum}</span>
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, alignment = 'top', isDark = true }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [useIframeFallback, setUseIframeFallback] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const [showControls, setShowControls] = useState(true);

  const [baseViewportWidth, setBaseViewportWidth] = useState<number>(0);
  const [baseViewportHeight, setBaseViewportHeight] = useState<number>(0);
  const [currentViewport, setCurrentViewport] = useState<any>(null);

  const [alignMode, setAlignMode] = useState<'top' | 'center'>(alignment);

  // Pinch to zoom state
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState<number | null>(null);

  // New features state
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'search'>('thumbnails');
  const [pageInput, setPageInput] = useState<string>("1");
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
  const [thumbnailsGenerating, setThumbnailsGenerating] = useState(false);
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);
  const [thumbnailsRequested, setThumbnailsRequested] = useState<Set<number>>(new Set());
  const [thumbnailsReady, setThumbnailsReady] = useState(false); // true once PDF buffer is loaded & worker is initialized
  const thumbnailGridRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingType, setDownloadingType] = useState<'pdf' | 'zip-images' | 'zip-pdfs' | null>(null);

  // View Mode State: 'single' (one page) or 'vertical' (all pages stacked)
  const [viewMode, setViewMode] = useState<'single' | 'vertical'>('single');
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Selection and Ordering State
  const [orderedPages, setOrderedPages] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [rotations, setRotations] = useState<{ [page: number]: number }>({});

  const handleRotateCw = () => {
    setRotations(prev => ({
      ...prev,
      [currentPage]: ((prev[currentPage] || 0) + 90) % 360
    }));
  };

  const handleRotateCcw = () => {
    setRotations(prev => ({
      ...prev,
      [currentPage]: ((prev[currentPage] || 0) - 90 + 360) % 360
    }));
  };

  const [activeId, setActiveId] = useState<number | null>(null);
  const [zipMenuOpen, setZipMenuOpen] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  const [defaultDownloadFormat, setDefaultDownloadFormat] = useState<ExportImageFormat>('png');
  const [downloadingPageNum, setDownloadingPageNum] = useState<number | null>(null);
  const [formatMenuPageNum, setFormatMenuPageNum] = useState<number | null>(null);
  const zipMenuRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadSinglePageImage = async (pageNum: number, format: ExportImageFormat = defaultDownloadFormat) => {
    if (!pdfDoc || downloadingPageNum !== null) return;

    setDefaultDownloadFormat(format);
    setFormatMenuPageNum(null);
    setDownloadingPageNum(pageNum);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const renderScale = 3.0;

      const baseRotation = page.rotate || 0;
      const currentRotation = rotations[pageNum] || 0;
      const finalRotation = (baseRotation + currentRotation) % 360;

      const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport } as any).promise;

        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        const ext = format === 'jpeg' ? 'jpg' : format;

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), mimeType, 0.95)
        );

        if (blob) {
          const docTitle = url.split('/').pop()?.replace(/#.*$/, '').replace(/\.pdf$/i, '') || 'document';
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${docTitle}_page_${pageNum}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }
      }
    } catch (err) {
      console.error(`Error downloading page ${pageNum} image:`, err);
    } finally {
      setDownloadingPageNum(null);
    }
  };

  const workerRef = useRef<Worker | null>(null);
  const pdfBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfPasswordRef = useRef<string | undefined>(undefined);
  const prevScaleRef = useRef<number>(scale);

  // Close zip menu on outside click
  useEffect(() => {
    if (!zipMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (zipMenuRef.current && !zipMenuRef.current.contains(e.target as Node)) {
        setZipMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [zipMenuOpen]);

  // Preserve center focus when scale changes (Zoom in/out towards center)
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const prevScale = prevScaleRef.current;
    if (prevScale !== scale) {
      const container = containerRef.current;
      const ratio = scale / prevScale;

      const centerX = container.scrollLeft + container.clientWidth / 2;
      const centerY = container.scrollTop + container.clientHeight / 2;

      container.scrollLeft = centerX * ratio - container.clientWidth / 2;
      container.scrollTop = centerY * ratio - container.clientHeight / 2;

      prevScaleRef.current = scale;
    }
  }, [scale]);

  // Handle trackpad pinch to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); // Prevent browser zoom
        const zoomSensitivity = 0.01;
        const delta = -e.deltaY * zoomSensitivity;
        setScale((prev) => Math.min(Math.max(prev * (1 + delta), 0.4), 3.0));
      }
    };

    // Must be non-passive to preventDefault on wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    // Setup worker (lightweight – no PDF loaded yet)
    const worker = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { action, payload } = e.data;
      if (action === 'THUMBNAIL_GENERATED') {
        const blob = new Blob([payload.buffer], { type: 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        setThumbnails(prev => ({ ...prev, [payload.pageNumber]: objectUrl }));
      } else if (action === 'THUMBNAILS_COMPLETE') {
        setThumbnailsGenerating(false);
        setThumbnailsGenerated(true);
      } else if (action === 'SEARCH_RESULT_FOUND') {
        setSearchResults(prev => [...prev, payload]);
      } else if (action === 'SEARCH_COMPLETE') {
        setIsSearching(false);
      } else if (action === 'ERROR') {
        console.error('PDF Worker error:', payload);
        setThumbnailsGenerating(false);
        setIsSearching(false);
      }
    };

    worker.onerror = (err) => {
      console.error('PDF Worker fatal error:', err);
      setThumbnailsGenerating(false);
      setIsSearching(false);
    };

    return () => {
      worker.terminate();
      setThumbnails((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL);
        return {};
      });
    };
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showControls) {
      timeout = setTimeout(() => setShowControls(false), 4000);
    }
    return () => clearTimeout(timeout);
  }, [showControls, scale, currentPage]);

  const handlePointerMoveControls = () => {
    setShowControls(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handlePointerMoveControls();
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    } else if (e.touches.length === 2) {
      touchStartRef.current = null;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(dist);
      setInitialScale(scale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null && initialScale !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDistance;
      const newScale = Math.min(Math.max(initialScale * ratio, 0.4), 3.0);
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDistance(null);
      setInitialScale(null);
    }

    if (e.changedTouches.length === 1 && touchStartRef.current) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartRef.current.x;
      const dy = touchEndY - touchStartRef.current.y;
      const timeDiff = Date.now() - touchStartRef.current.time;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50 && timeDiff < 500) {
        const container = containerRef.current;
        let canSwipe = true;

        if (container && container.scrollWidth > container.clientWidth) {
          if (dx > 0 && container.scrollLeft > 10) {
            canSwipe = false;
          } else if (dx < 0 && container.scrollLeft < container.scrollWidth - container.clientWidth - 10) {
            canSwipe = false;
          }
        }

        if (canSwipe) {
          if (dx > 0 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
            setPageInput(String(currentPage - 1));
          } else if (dx < 0 && currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            setPageInput(String(currentPage + 1));
          }
        }
      }
      touchStartRef.current = null;
    }
  };

  // Load PDF.js document using local bundled package with CORS proxy backup attempts
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setUseIframeFallback(false);
    setThumbnails({});
    setThumbnailsReady(false);
    setThumbnailsRequested(new Set());
    setSearchResults([]);
    pdfBufferRef.current = null;

    const cleanUrl = url.replace(/#.*$/, "");

    const loadPdfDoc = async (currentPassword?: string) => {
      let arrayBuffer: ArrayBuffer | null = null;
      let lastErrorMsg = "";

      // Attempt 1: Direct Fetch
      try {
        const response = await fetch(cleanUrl);
        if (response.ok) {
          arrayBuffer = await response.arrayBuffer();
        } else {
          throw new Error(`Server returned status code: ${response.status} (${response.statusText || "Forbidden/CORS Block"})`);
        }
      } catch (err: any) {
        lastErrorMsg = `Direct Fetch: ${err.message || err.toString()}`;
        console.warn("Direct fetch failed, trying proxy...", err);
      }

      // Attempt 2: Workers.dev proxy
      if (!arrayBuffer && active) {
        try {
          const proxyUrl = `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(cleanUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            arrayBuffer = await response.arrayBuffer();
          } else {
            throw new Error(`Workers proxy returned status code: ${response.status} (${response.statusText})`);
          }
        } catch (err: any) {
          lastErrorMsg += `\nWorkers Proxy: ${err.message || err.toString()}`;
          console.warn("Workers proxy failed.", err);
        }
      }

      // If we successfully received the byte buffer, let's load it in PDF.js
      if (arrayBuffer && active) {
        try {
          // Store the buffer for later lazy use by the worker (thumbnails/search)
          pdfBufferRef.current = arrayBuffer.slice(0);
          pdfPasswordRef.current = currentPassword;

          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useSystemFonts: true,
            password: currentPassword
          });

          const pdf = await loadingTask.promise;
          if (!active) return;
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setOrderedPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
          setCurrentPage(1);
          setPageInput("1");
          setLoading(false);
          setPasswordRequired(false);

          // Auto-fit initial scale based on container width & set base viewport
          pdf.getPage(1).then((page: any) => {
            if (!active) return;
            const baseViewport = page.getViewport({ scale: 1.0 });
            setBaseViewportWidth(baseViewport.width);
            setBaseViewportHeight(baseViewport.height);
            if (containerRef.current) {
              const containerWidth = containerRef.current.clientWidth;
              const isMobile = containerWidth < 640;
              const desiredWidth = isMobile ? containerWidth : Math.max(containerWidth - 32, 200);
              const newScale = desiredWidth / baseViewport.width;
              // Cap initial scale to 1.25 on desktop to prevent absurdly large zooming on ultra-wide screens
              const maxInitialScale = isMobile ? 2.5 : 1.25;
              setScale(Math.min(Math.max(newScale, 0.4), maxInitialScale));
            }
          });

          return;
        } catch (err: any) {
          if (err.name === "PasswordException") {
            if (active) {
              setPasswordRequired(true);
              setLoading(false);
              if (currentPassword) {
                setError("Incorrect password. Please try again.");
              }
            }
            return;
          }
          console.error("PDF.js parsing error:", err);
          lastErrorMsg += `\nPDFJS Parsing Error: ${err.message || err.toString()}`;
        }
      }

      // If all attempts failed, set the dynamic error to inform the user
      if (active) {
        setError(lastErrorMsg || "Failed to fetch or parse the PDF document due to CORS or security restrictions.");
        setLoading(false);
      }
    };

    loadPdfDoc(password);

    return () => {
      active = false;
    };
  }, [url, reloadKey]);

  // Render current page (Single Page Mode)
  useEffect(() => {
    if (!pdfDoc || viewMode !== 'single') return;

    let active = true;
    setRendering(true);

    pdfDoc.getPage(currentPage).then((page: any) => {
      if (!active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancel previous render task if in progress
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const context = canvas.getContext("2d");
      if (!context) return;

      const currentRotation = rotations[currentPage] || 0;
      const baseRotation = page.rotate || 0;
      const finalRotation = (baseRotation + currentRotation) % 360;

      // Render at a high fixed scale for crispness
      const renderScale = 2.5;
      const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });

      const baseViewport = page.getViewport({ scale: 1.0, rotation: finalRotation });
      setBaseViewportWidth(baseViewport.width);
      setBaseViewportHeight(baseViewport.height);
      setCurrentViewport(baseViewport);

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      renderTask.promise
        .then(() => {
          if (!active) return;
          setRendering(false);
          renderTaskRef.current = null;
        })
        .catch((err: any) => {
          if (err?.name === "RenderingCancelledException") {
            return; // Ignore safe cancellations
          }
          if (!active) return;
          console.error("Page render error:", err);
          setRendering(false);
        });
    });

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, viewMode, rotations]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setPageInput(String(page));
      if (viewMode === 'vertical') {
        isProgrammaticScrollRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const el = document.getElementById(`pdf-page-${page}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 750);
      }
    }
  };

  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);

  const handlePageSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (!isNaN(page)) {
      if (page < 1) goToPage(1);
      else if (page > totalPages) goToPage(totalPages);
      else goToPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const downloadFile = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || "document.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) setReloadKey(prev => prev + 1);
  };

  const submitPassword = () => {
    if (password) setReloadKey(prev => prev + 1);
  };

  const startThumbnailGeneration = () => {
    if (!workerRef.current || thumbnailsGenerating || !pdfBufferRef.current) return;
    setThumbnailsGenerating(true);
    // Send data to worker without transferring ownership to prevent React DevTools crash
    workerRef.current.postMessage({
      action: 'GENERATE_THUMBNAILS',
      payload: { data: pdfBufferRef.current, password: pdfPasswordRef.current }
    });
  };

  // Initialize the worker with the PDF buffer so it's ready for on-demand thumbnail requests
  // (No separate init needed; requestThumbnail sends the PDF data with each request)

  // Request a single thumbnail on-demand (called by IntersectionObserver when a placeholder scrolls into view)
  const requestThumbnail = useCallback((pageNum: number) => {
    if (!workerRef.current || !pdfBufferRef.current) return;
    if (thumbnails[pageNum] || thumbnailsRequested.has(pageNum)) return;

    setThumbnailsRequested(prev => {
      const next = new Set(prev);
      next.add(pageNum);
      return next;
    });

    workerRef.current.postMessage({
      action: 'GENERATE_THUMBNAIL_SINGLE',
      payload: { data: pdfBufferRef.current, password: pdfPasswordRef.current, pageNumber: pageNum }
    });
  }, [thumbnails, thumbnailsRequested]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerRef.current || !searchQuery.trim() || !pdfBufferRef.current) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    // Send data to worker without transferring ownership to prevent React DevTools crash
    workerRef.current.postMessage({
      action: 'SEARCH_TEXT',
      payload: { query: searchQuery, data: pdfBufferRef.current, password: pdfPasswordRef.current }
    });
  };

  const renderedHighlights = React.useMemo(() => {
    if (!currentViewport || !searchQuery.trim()) return null;

    const highlights = searchResults.filter(r => r.pageNumber === currentPage);
    if (highlights.length === 0) return null;

    // Flatten all rects and limit to 500 to prevent performance issues (DOM overload)
    const allRects = highlights.flatMap(h => h.rects || []).slice(0, 500);

    return allRects.map((rect: any, index: number) => {
      try {
        const charWidth = rect.width / Math.max(1, rect.totalLen);
        const startX = rect.transform[4] + rect.overlapStart * charWidth;
        const startY = rect.transform[5];

        // Use standard viewport method to convert coordinates safely
        const pt = currentViewport.convertToViewportPoint(startX, startY);

        // Try to derive font size from matrix or height
        const fontSizePdf = Math.abs(rect.transform[3]) || rect.height || 12;
        const topPt = currentViewport.convertToViewportPoint(startX, startY + fontSizePdf);

        const highlightWidth = (rect.overlapEnd - rect.overlapStart) * charWidth;
        // Vector conversion for width to handle scale accurately
        const endPt = currentViewport.convertToViewportPoint(startX + highlightWidth, startY);
        const cssWidth = Math.abs(endPt[0] - pt[0]);
        const cssHeight = Math.abs(pt[1] - topPt[1]);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: pt[0],
              top: Math.min(pt[1], topPt[1]),
              width: Math.max(cssWidth, 2), // Minimum width
              height: Math.max(cssHeight, 5), // Minimum height
              backgroundColor: 'rgba(250, 204, 21, 0.4)',
              borderBottom: '2px solid rgba(234, 179, 8, 0.8)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        );
      } catch (e) {
        return null;
      }
    });
  }, [currentViewport, searchResults, currentPage, searchQuery]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedPages((items) => {
        const oldIndex = items.indexOf(Number(active.id));
        const newIndex = items.indexOf(Number(over.id));
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const getPagesToProcess = () => {
    if (selectionMode && selectedPages.size > 0) {
      return orderedPages.filter(p => selectedPages.has(p));
    }
    return orderedPages;
  };

  const downloadAsPdf = async () => {
    const pages = getPagesToProcess();
    if (pages.length === 0 || !pdfBufferRef.current) return;
    setDownloadingType('pdf');

    try {
      // Load the original PDF using pdf-lib (clone buffer to avoid detach)
      const srcDoc = await PDFDocument.load(pdfBufferRef.current.slice(0), {
        ignoreEncryption: true,
      });
      const newDoc = await PDFDocument.create();

      // Copy selected pages (pdf-lib uses 0-based page indices)
      const pageIndices = pages.map(p => p - 1);
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach((page, index) => {
        const originalPageNum = pages[index];
        const rot = rotations[originalPageNum] || 0;
        if (rot) {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees((currentRot + rot) % 360));
        }
        newDoc.addPage(page);
      });

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloadingType(null);
    }

    if (selectionMode) {
      setSelectionMode(false);
      setSelectedPages(new Set());
    }
  };

  const downloadAsZip = async (mode: 'images' | 'pdfs') => {
    const pages = getPagesToProcess();
    if (pages.length === 0 || !pdfBufferRef.current) return;
    setZipMenuOpen(false);
    setDownloadingType(mode === 'images' ? 'zip-images' : 'zip-pdfs');

    try {
      const filesToZip: { file: File | Blob; path: string }[] = [];

      if (mode === 'images') {
        // High-quality images: render each page at 3x scale via pdfjs-dist (clone buffer to avoid detach)
        const pdfDoc = await pdfjsLib.getDocument({
          data: new Uint8Array(pdfBufferRef.current.slice(0)),
          useSystemFonts: true,
          password: pdfPasswordRef.current,
        }).promise;

        for (let i = 0; i < pages.length; i++) {
          const pageNum = pages[i];
          const page = await pdfDoc.getPage(pageNum);
          const renderScale = 3.0;

          const baseRotation = page.rotate || 0;
          const currentRotation = rotations[pageNum] || 0;
          const finalRotation = (baseRotation + currentRotation) % 360;

          const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport } as any).promise;

          const blob: Blob = await new Promise((resolve) =>
            canvas.toBlob((b) => resolve(b!), 'image/png')
          );
          filesToZip.push({ file: blob, path: `page_${pageNum}.png` });
        }
      } else {
        // PDFs: combine all selected pages into a single PDF, then zip it (clone buffer to avoid detach)
        const srcDoc = await PDFDocument.load(pdfBufferRef.current.slice(0), {
          ignoreEncryption: true,
        });
        const newDoc = await PDFDocument.create();

        const pageIndices = pages.map(p => p - 1);
        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((page, index) => {
          const originalPageNum = pages[index];
          const rot = rotations[originalPageNum] || 0;
          if (rot) {
            const currentRot = page.getRotation().angle;
            page.setRotation(degrees((currentRot + rot) % 360));
          }
          newDoc.addPage(page);
        });

        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        filesToZip.push({ file: blob, path: 'document.pdf' });
      }

      await new Promise<void>((resolve, reject) => {
        const worker = new Worker(new URL("../workers/zipWorker.ts", import.meta.url), {
          type: "module",
        });

        worker.onmessage = (e) => {
          const { zipFile, error } = e.data;
          if (error) {
            worker.terminate();
            reject(new Error(error));
          } else if (zipFile) {
            const url = URL.createObjectURL(zipFile);
            const link = document.createElement("a");
            link.href = url;
            link.download = "pages.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            worker.terminate();
            resolve();
          }
        };

        worker.postMessage({
          id: "pdf-zip",
          files: filesToZip,
          folderName: "pages"
        });
      });
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setDownloadingType(null);
    }

    if (selectionMode) {
      setSelectionMode(false);
      setSelectedPages(new Set());
    }
  };

  if (passwordRequired) {
    return (
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 h-full w-full bg-slate-950">
        <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Password Protected PDF</h3>
        <p className="text-sm text-slate-400 mb-6 text-center max-w-xs">
          This document is encrypted. Please enter the password to view the content.
        </p>
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter PDF password"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            autoFocus
          />
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          <button
            type="submit"
            onClick={submitPassword}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98]"
          >
            Unlock PDF
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950">
        <Loader2 className="h-8 w-8 text-rose-500/80 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 h-full w-full text-center bg-slate-950 overflow-auto">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-4 flex-shrink-0" />
        <h4 className="text-base font-bold text-rose-400">PDF Rendering Blocked</h4>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          Failed to fetch or render the PDF file directly due to CORS settings or target server blocks.
        </p>
        <div className="mt-2.5 max-w-sm w-full font-mono bg-slate-950/20 dark:bg-slate-950/40 p-2.5 rounded border border-rose-500/20 break-all text-left overflow-auto max-h-32">
          <span className="font-sans font-semibold text-rose-500/80 dark:text-rose-400/80 block text-xs mb-1">Error details:</span>
          <span className="text-[10px] text-slate-600 dark:text-slate-300">{error}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          <button
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            Retry Parse
          </button>
          <button
            onClick={() => {
              setError(null);
              setUseIframeFallback(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            Google Docs Fallback
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition border border-slate-700 shadow-sm"
          >
            <ExternalLink size={12} />
            Open Tab
          </a>
        </div>
      </div>
    );
  }

  if (useIframeFallback) {
    const cleanUrl = url.replace(/#.*$/, "");
    return (
      <div className={`flex flex-col h-full w-full overflow-hidden shadow-none border-0 ${isDark ? "bg-slate-950/20" : "bg-slate-100"}`}>
        <div className={`flex-1 w-full flex items-stretch justify-stretch min-h-[500px] ${isDark ? "bg-slate-800" : "bg-slate-200/50"}`}>
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(cleanUrl)}&embedded=true`}
            className="w-full h-full border-0 bg-white"
            style={{ minHeight: "550px" }}
            title="PDF Document Embed"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full bg-transparent overflow-hidden relative"
      onPointerMove={handlePointerMoveControls}
      onClick={handlePointerMoveControls}
      onTouchStart={handlePointerMoveControls}
    >
      {/* Sidebar for Thumbnails / Search */}
      {showSidebar && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-[29999] bg-black/60 backdrop-blur-xs sm:hidden"
            onClick={() => setShowSidebar(false)}
          />
          <div className={`fixed inset-y-0 left-0 z-[30000] sm:absolute sm:inset-auto sm:left-0 sm:top-0 sm:bottom-0 sm:z-20 border-r shadow-2xl flex flex-col ${isDark ? "bg-slate-900 border-slate-800/90" : "bg-slate-50 border-slate-200"} ${isSidebarExpanded ? 'w-full sm:w-[540px] md:w-[640px]' : 'w-[85%] max-w-[340px] sm:w-80'}`}>
            <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? "border-slate-800/90 bg-slate-950/40" : "border-slate-200 bg-white"}`}>
              <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-inner ${isDark ? "bg-slate-950/80 border-slate-800/80" : "bg-slate-200/50 border-slate-300/50"}`}>
                <button
                  onClick={() => setSidebarTab('thumbnails')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${sidebarTab === 'thumbnails'
                      ? isDark ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm' : 'bg-white text-indigo-600 border border-slate-200 shadow-sm'
                      : isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                >
                  <LayoutGrid size={14} />
                  Pages
                </button>
                <button
                  onClick={() => setSidebarTab('search')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${sidebarTab === 'search'
                      ? isDark ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm' : 'bg-white text-indigo-600 border border-slate-200 shadow-sm'
                      : isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                >
                  <Search size={14} />
                  Search
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Expand / Fullscreen Toggle Button */}
                <button
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800/80" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
                  title={isSidebarExpanded ? 'Collapse Panel' : 'Expand Panel'}
                >
                  {isSidebarExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors"
                  title="Close Sidebar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative">
              {sidebarTab === 'thumbnails' && (
                <div className="flex flex-col gap-3">
                  {(thumbnailsReady || Object.keys(thumbnails).length > 0) && (
                    <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-800/60">
                      <span className="text-xs font-medium text-slate-400">
                        {orderedPages.length} Pages {selectionMode ? `(${selectedPages.size} selected)` : ''}
                      </span>
                      <button
                        onClick={() => {
                          if (selectionMode && selectedPages.size === orderedPages.length) {
                            setSelectionMode(false);
                            setSelectedPages(new Set());
                          } else {
                            setSelectionMode(true);
                            setSelectedPages(new Set(orderedPages));
                          }
                        }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border ${selectionMode && selectedPages.size === orderedPages.length
                            ? 'bg-slate-800 border-indigo-500/50 text-indigo-300 hover:bg-slate-700'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                          }`}
                      >
                        {selectionMode && selectedPages.size === orderedPages.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  )}

                  {Object.keys(thumbnails).length === 0 && !thumbnailsGenerating && !thumbnailsReady && (
                    <div className={`flex flex-col items-center justify-center p-6 text-center h-52 border rounded-2xl backdrop-blur-sm ${isDark ? "bg-slate-950/40 border-slate-800/80" : "bg-white border-slate-200"}`}>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                        <LayoutGrid size={22} />
                      </div>
                      <p className="text-xs font-medium text-slate-400 mb-4 max-w-xs">Generate page thumbnails for visual navigation, reordering, and multi-page export.</p>
                      <button
                        onClick={() => {
                          setThumbnailsReady(true);
                        }}
                        className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Play size={14} /> Generate Thumbnails
                      </button>
                    </div>
                  )}

                  {thumbnailsGenerating && (
                    <div className="flex items-center gap-2.5 text-xs text-indigo-300 font-semibold mb-2 justify-center bg-indigo-500/15 p-2.5 rounded-xl border border-indigo-500/30 backdrop-blur-sm">
                      <Loader2 size={15} className="animate-spin text-indigo-400" />
                      Generating page previews...
                    </div>
                  )}

                  <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                  >
                    <SortableContext items={orderedPages.map(String)} strategy={rectSortingStrategy}>
                      <div ref={thumbnailGridRef} className={`grid gap-2.5 sm:gap-3.5 pb-4 ${isSidebarExpanded ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-2'}`}>
                        {thumbnailsReady && orderedPages.map((pageNum) => (
                          <VirtualizedThumbnailSlot
                            key={pageNum}
                            pageNum={pageNum}
                            isDark={isDark}
                            thumbnailUrl={thumbnails[pageNum] || null}
                            currentPage={currentPage}
                            selectionMode={selectionMode}
                            isSelected={selectedPages.has(pageNum)}
                            defaultFormat={defaultDownloadFormat}
                            isDownloadingThisPage={downloadingPageNum === pageNum}
                            isFormatMenuOpen={formatMenuPageNum === pageNum}
                            onRequestThumbnail={requestThumbnail}
                            onSelect={(p) => {
                              setSelectedPages(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(p)) newSet.delete(p);
                                else newSet.add(p);
                                return newSet;
                              });
                            }}
                            onGoToPage={goToPage}
                            onLongPress={(p) => {
                              if (!selectionMode) {
                                setSelectionMode(true);
                                setSelectedPages(new Set([p]));
                              }
                            }}
                            onDownloadPage={handleDownloadSinglePageImage}
                            onOpenFormatMenu={(p) => setFormatMenuPageNum(p)}
                            onCloseFormatMenu={() => setFormatMenuPageNum(null)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                      {activeId ? (
                        <ThumbnailCard
                          pageNum={activeId}
                          isDark={isDark}
                          url={thumbnails[activeId]}
                          currentPage={currentPage}
                          selectionMode={selectionMode}
                          isSelected={selectedPages.has(activeId)}
                          defaultFormat={defaultDownloadFormat}
                          isOverlay
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}

              {sidebarTab === 'search' && (
                <div className="flex flex-col gap-4">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        setHasSearched(false);
                        if (val.trim() === '') {
                          setSearchResults([]);
                        }
                      }}
                      placeholder="Search in PDF..."
                      className={`flex-1 border text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${isDark ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                    />
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                    >
                      {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </form>

                  <div className="flex flex-col gap-2 pb-4">
                    {hasSearched && searchResults.length === 0 && !isSearching && (
                      <p className="text-xs text-slate-500 text-center py-4">No results found.</p>
                    )}
                    {searchResults.map((result, i) => (
                      <div
                        key={`${result.pageNumber}-${i}`}
                        onClick={() => goToPage(result.pageNumber)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${isDark ? "bg-slate-950/50 hover:bg-indigo-500/10 border-slate-800 hover:border-indigo-500/30" : "bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 shadow-sm"}`}
                      >
                        <div className={`text-[10px] font-bold mb-1 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>Page {result.pageNumber}</div>
                        <p className={`text-xs line-clamp-3 leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>{result.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Bottom Action Bar */}
            {(selectionMode || orderedPages.some((p, i) => p !== i + 1)) && (thumbnailsReady || Object.keys(thumbnails).length > 0) && sidebarTab === 'thumbnails' && (
              <div className={`flex-none p-3.5 backdrop-blur-xl border-t flex flex-col gap-2.5 z-20 shadow-2xl ${isDark ? "bg-slate-950/95 border-slate-800/90" : "bg-white/95 border-slate-200"}`}>
                {selectionMode && (
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-xs font-medium text-slate-300">
                      {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => { setSelectionMode(false); setSelectedPages(new Set()); }}
                      className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {!selectionMode && orderedPages.some((p, i) => p !== i + 1) && (
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-xs font-medium text-slate-300">Custom page order active</span>
                    <button
                      onClick={() => setOrderedPages(Array.from({ length: totalPages }, (_, i) => i + 1))}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      Reset Order
                    </button>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button
                    onClick={downloadAsPdf}
                    disabled={(selectionMode && selectedPages.size === 0) || downloadingType !== null}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    {downloadingType === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                    {downloadingType === 'pdf' ? 'Generating...' : (selectionMode ? `PDF (${selectedPages.size})` : 'Download PDF')}
                  </button>
                  <div className="flex-1 relative" ref={zipMenuRef}>
                    <button
                      onClick={() => setZipMenuOpen(!zipMenuOpen)}
                      disabled={(selectionMode && selectedPages.size === 0) || downloadingType !== null}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/90 border border-slate-700/80 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      {downloadingType?.startsWith('zip-') ? <Loader2 size={14} className="animate-spin text-indigo-400" /> : <Archive size={14} className="text-slate-400" />}
                      <span>{downloadingType?.startsWith('zip-') ? 'Zipping...' : (selectionMode ? `ZIP (${selectedPages.size})` : 'Download ZIP')}</span>
                      {!downloadingType?.startsWith('zip-') && <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${zipMenuOpen ? 'rotate-180' : ''}`} />}
                    </button>
                    {zipMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-52 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-30 p-1 divide-y divide-slate-800/80 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <button
                          onClick={() => downloadAsZip('images')}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors group"
                        >
                          <FileImage size={15} className="text-emerald-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs leading-tight">PNG Images</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-indigo-100 transition-colors">Individual page files</span>
                          </div>
                        </button>
                        <button
                          onClick={() => downloadAsZip('pdfs')}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center gap-2.5 rounded-lg transition-colors group"
                        >
                          <FileText size={15} className="text-indigo-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs leading-tight">Single PDF</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-indigo-100 transition-colors">Combined PDF inside ZIP</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className={`flex-1 w-full h-full overflow-auto custom-scrollbar touch-pan-x touch-pan-y relative z-0 flex flex-col ${alignMode === 'top' ? 'items-center pt-2 sm:pt-4' : ''} px-0 sm:px-4 pb-16 sm:pb-20`}
        style={{ overscrollBehavior: 'contain' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {viewMode === 'vertical' ? (
          <div className="flex flex-col gap-6 py-4 items-center w-full min-h-full">
            {orderedPages.map((pageNum) => {
              // Fixed window virtualization: render active canvases only for currentPage ± 2 pages
              const renderWindow = 2;
              const isWithinWindow = Math.abs(pageNum - currentPage) <= renderWindow;

              if (isWithinWindow) {
                return (
                  <PdfPageCanvas
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    scale={scale}
                    rotation={rotations[pageNum] || 0}
                    onVisible={(p) => {
                      if (!isProgrammaticScrollRef.current) {
                        setCurrentPage(p);
                        setPageInput(String(p));
                      }
                    }}
                  />
                );
              }

              const isRotated = (rotations[pageNum] || 0) % 180 !== 0;
              const pWidth = isRotated ? baseViewportHeight : baseViewportWidth;
              const pHeight = isRotated ? baseViewportWidth : baseViewportHeight;

              return (
                <PdfPlaceholderCanvas
                  key={pageNum}
                  pageNum={pageNum}
                  width={pWidth ? pWidth * scale : 0}
                  height={pHeight ? pHeight * scale : 600}
                  onVisible={(p) => {
                    if (!isProgrammaticScrollRef.current) {
                      setCurrentPage(p);
                      setPageInput(String(p));
                    }
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div
            className={`shadow-md sm:border border-slate-700/30 bg-white overflow-hidden flex-shrink-0 relative ${alignMode === 'center' ? 'm-auto' : 'mx-auto'}`}
            style={{
              width: baseViewportWidth ? `${baseViewportWidth * scale}px` : 'auto',
              height: baseViewportHeight ? `${baseViewportHeight * scale}px` : 'auto',
            }}
          >
            <canvas ref={canvasRef} className="w-full h-full block max-w-none relative z-0" />

            {baseViewportWidth > 0 && (
              <div
                className="absolute top-0 left-0 origin-top-left pointer-events-none z-10"
                style={{
                  width: `${baseViewportWidth}px`,
                  height: `${baseViewportHeight}px`,
                  transform: `scale(${scale})`
                }}
              >
                {renderedHighlights}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Controls */}
      <div
        className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-3 backdrop-blur-md border px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl z-10 shadow-2xl transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"} ${isDark ? "bg-slate-950/85 border-slate-700/80 text-slate-200" : "bg-white/90 border-slate-200 text-slate-800"}`}
      >
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className={`p-1.5 rounded-md sm:rounded-lg transition-colors flex-shrink-0 ${showSidebar ? 'bg-indigo-500 text-white' : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
          title="Toggle Sidebar"
        >
          <Sidebar size={15} />
        </button>

        <div className={`w-px h-5 flex-shrink-0 hidden sm:block ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />

        {/* View Mode Toggle Button (Single vs Continuous Vertical) */}
        <button
          onClick={() => {
            const nextMode = viewMode === 'single' ? 'vertical' : 'single';
            setViewMode(nextMode);
            if (nextMode === 'vertical') {
              setTimeout(() => {
                const el = document.getElementById(`pdf-page-${currentPage}`);
                if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
              }, 60);
            }
          }}
          className={`p-1.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 ${viewMode === 'vertical' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'}`}
          title={viewMode === 'vertical' ? "Switch to Single Page View" : "Switch to Continuous Vertical Scroll View"}
        >
          {viewMode === 'vertical' ? <Layers size={15} /> : <BookOpen size={15} />}
          <span className="hidden sm:inline text-[11px] font-semibold">{viewMode === 'vertical' ? 'Vertical' : 'Single'}</span>
        </button>

        {/* Alignment Toggle Button (Top vs Center) */}
        <button
          onClick={() => setAlignMode(alignMode === 'top' ? 'center' : 'top')}
          className={`p-1.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'}`}
          title={alignMode === 'top' ? "Switch to Center Alignment" : "Switch to Top Alignment"}
        >
          {alignMode === 'top' ? <AlignStartVertical size={15} /> : <AlignCenterVertical size={15} />}
          <span className="hidden sm:inline text-[11px] font-semibold">{alignMode === 'top' ? 'Top' : 'Center'}</span>
        </button>

        <div className={`w-px h-5 flex-shrink-0 hidden sm:block ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || (viewMode === 'single' && rendering)}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center gap-0.5">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              className={`w-8 sm:w-11 border text-center text-[11px] sm:text-xs font-mono font-bold rounded px-0.5 py-0.5 sm:py-1 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300 text-slate-800"}`}
            />
            <span className={`text-[11px] sm:text-xs font-mono font-medium select-none ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              /{totalPages}
            </span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || (viewMode === 'single' && rendering)}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={`w-px h-5 flex-shrink-0 hidden sm:block ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleRotateCcw}
            disabled={viewMode === 'single' && rendering}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Rotate Counter-Clockwise"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleRotateCw}
            disabled={viewMode === 'single' && rendering}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Rotate Clockwise"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.4 || (viewMode === 'single' && rendering)}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] sm:text-xs font-mono font-medium min-w-[28px] sm:min-w-[36px] text-center select-none text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || (viewMode === 'single' && rendering)}
            className={`p-1 sm:p-1.5 rounded-md disabled:opacity-40 transition-colors ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-200"}`}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
