import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  Archive,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  FileDown,
  FileImage,
  FileText,
  GalleryVertical,
  ListChecks,
  Lock,
  Maximize2,
  Minimize2,
  PanelLeft,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useDebounce } from "use-debounce";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import CustomSelect from "./CustomSelect";
import { PdfPage, PdfPagePlaceholder, MAX_PIXELS_CONTINUOUS, MAX_PIXELS_SINGLE } from "./pdf-viewer/PdfPage";
import { ThumbnailGrid } from "./pdf-viewer/PdfThumbnails";
import { PdfSearch } from "./pdf-viewer/PdfSearch";
import { createPdfWorkerClient, type PdfWorkerClient, type SearchRect, type SearchResult } from "./pdf-viewer/pdfWorkerClient";
import {
  buildPdf,
  documentTitle,
  downloadBlob,
  renderPageImage,
  zipFiles,
  type ExportImageFormat,
} from "./pdf-viewer/pdfExport";
import { ICON_BUTTON, pdfPalette } from "./pdf-viewer/pdfTheme";

export type { ExportImageFormat } from "./pdf-viewer/pdfExport";

// Bundled with the app, and so precached, rather than fetched from unpkg: PDFs open offline.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  url: string;
  /** The document's name, for downloads; otherwise taken from the URL */
  fileName?: string;
  alignment?: "top" | "center";
  isDark?: boolean;
}

type ViewMode = "single" | "continuous";
type ZoomMode = "auto" | "fit-width" | "fit-page" | "custom";
type Busy = null | "pdf" | "zip-images" | "zip-pdf";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
/** Pages drawn either side of the current one in continuous mode; the rest are placeholders */
const RENDER_WINDOW = 2;
/** "Automatic" zoom fits the width, but not beyond this on a large screen */
const AUTO_MAX_SCALE = 1.25;
const PROXY = "https://go.data-visualizer.workers.dev/?url=";

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Downloads a URL, reporting progress when the size is known */
async function fetchBytes(url: string, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / total));
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, fileName, alignment = "top", isDark = true }) => {
  /* ── Document ───────────────────────────────────────────────────────── */
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [firstPageSize, setFirstPageSize] = useState({ width: 612, height: 792 });
  const [status, setStatus] = useState<"loading" | "ready" | "password" | "error" | "embed">("loading");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const bufferUrlRef = useRef<string | null>(null);
  const passwordRef = useRef<string | undefined>(undefined);

  /* ── View ───────────────────────────────────────────────────────────── */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [alignMode, setAlignMode] = useState<"top" | "center">(alignment);
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("auto");
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [controlsVisible, setControlsVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState<null | "zoom" | "more" | "zip">(null);

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"pages" | "search">("pages");
  const [sidebarWide, setSidebarWide] = useState(false);
  const [gridRoot, setGridRoot] = useState<HTMLDivElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  /* ── Pages: order, selection, export ────────────────────────────────── */
  const [orderedPages, setOrderedPages] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);
  const [defaultFormat, setDefaultFormat] = useState<ExportImageFormat>("png");
  const cancelExportRef = useRef(false);

  /* ── Search ─────────────────────────────────────────────────────────── */
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeMatch, setActiveMatch] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const programmaticScroll = useRef(false);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  /* ── Worker for thumbnails and search, started only when first needed ─ */
  const [client, setClient] = useState<PdfWorkerClient | null>(null);
  const workerLoadedRef = useRef(false);
  useEffect(() => {
    const c = createPdfWorkerClient();
    setClient(c);
    return () => c.destroy();
  }, []);
  const ensureWorker = useCallback(() => {
    if (!client || !bufferRef.current || workerLoadedRef.current) return;
    workerLoadedRef.current = true;
    client.load(bufferRef.current, passwordRef.current);
  }, [client]);

  /* ── Loading ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const controller = new AbortController();
    let doc: any = null;
    const cleanUrl = url.replace(/#.*$/, "");
    setStatus("loading");
    setError(null);
    setProgress(null);
    workerLoadedRef.current = false;

    (async () => {
      // Reuse the bytes when only the password changed
      let buffer = bufferUrlRef.current === cleanUrl ? bufferRef.current : null;
      const failures: string[] = [];
      if (!buffer) {
        try {
          buffer = await fetchBytes(cleanUrl, setProgress, controller.signal);
        } catch (err: any) {
          if (controller.signal.aborted) return;
          failures.push(`Direct: ${err?.message || err}`);
        }
      }
      if (!buffer && /^https?:/i.test(cleanUrl)) {
        try {
          setProgress(null);
          buffer = await fetchBytes(PROXY + encodeURIComponent(cleanUrl), setProgress, controller.signal);
        } catch (err: any) {
          if (controller.signal.aborted) return;
          failures.push(`Proxy: ${err?.message || err}`);
        }
      }
      if (!buffer) throw new Error(failures.join("\n") || "The file could not be downloaded");
      bufferRef.current = buffer;
      bufferUrlRef.current = cleanUrl;

      try {
        // pdf.js takes ownership of what it is given, so it gets a copy
        doc = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          useSystemFonts: true,
          password: passwordRef.current,
        }).promise;
      } catch (err: any) {
        if (err?.name === "PasswordException") {
          if (controller.signal.aborted) return;
          setPasswordError(!!passwordRef.current);
          setStatus("password");
          return;
        }
        throw err;
      }
      if (controller.signal.aborted) {
        doc.destroy();
        return;
      }

      const first = await doc.getPage(1);
      const size = first.getViewport({ scale: 1 });
      setFirstPageSize({ width: size.width, height: size.height });
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setOrderedPages(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      setRotations({});
      setSelected(new Set());
      setSelectionMode(false);
      setCurrentPage(1);
      setPageInput("1");
      setZoomMode("auto");
      setPasswordError(false);
      setStatus("ready");
    })().catch((err: any) => {
      if (controller.signal.aborted) return;
      console.error("PDF failed to open:", err);
      setError(String(err?.message || err));
      setStatus("error");
    });

    return () => {
      controller.abort();
      doc?.destroy();
    };
  }, [url, reloadKey]);

  // A new document means new search results and thumbnails
  useEffect(() => {
    setResults([]);
    setActiveMatch(-1);
  }, [pdfDoc]);

  /* ── Zoom ───────────────────────────────────────────────────────────── */
  const pageSize = useCallback(
    async (page: number) => {
      const p = await pdfDoc.getPage(page);
      const vp = p.getViewport({ scale: 1, rotation: ((p.rotate || 0) + (rotations[page] || 0)) % 360 });
      return { width: vp.width, height: vp.height };
    },
    [pdfDoc, rotations],
  );

  const fitScale = useCallback(
    async (mode: Exclude<ZoomMode, "custom">) => {
      const el = scrollRef.current;
      if (!el || !pdfDoc) return null;
      const size = await pageSize(currentPageRef.current);
      const narrow = el.clientWidth < 640;
      const padX = narrow ? 16 : 64;
      const width = (el.clientWidth - padX) / size.width;
      if (mode === "fit-page") return clampScale(Math.min(width, (el.clientHeight - 112) / size.height));
      if (mode === "auto") return clampScale(narrow ? width : Math.min(width, AUTO_MAX_SCALE));
      return clampScale(width);
    },
    [pdfDoc, pageSize],
  );

  const applyZoomMode = useCallback(
    async (mode: ZoomMode) => {
      setZoomMode(mode);
      if (mode === "custom") return;
      const next = await fitScale(mode);
      if (next) setScale(next);
    },
    [fitScale],
  );

  // Fitted zoom follows the viewer's size: window resizes, the sidebar opening, rotation
  useEffect(() => {
    if (status !== "ready" || zoomMode === "custom") return;
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(async () => {
        const next = await fitScale(zoomMode);
        if (next) setScale(next);
      });
    };
    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [status, zoomMode, fitScale, viewMode === "single" ? currentPage : 0]);

  const anchorZoom = useRef(false);
  const setCustomScale = useCallback((next: number | ((s: number) => number)) => {
    anchorZoom.current = true;
    setZoomMode("custom");
    setScale((s) => clampScale(typeof next === "function" ? next(s) : next));
  }, []);
  const zoomIn = () => setCustomScale((s) => ZOOM_STEPS.find((z) => z > s + 0.001) ?? MAX_SCALE);
  const zoomOut = () => setCustomScale((s) => [...ZOOM_STEPS].reverse().find((z) => z < s - 0.001) ?? MIN_SCALE);

  // Keep the middle of the view steady while zooming
  const prevScale = useRef(scale);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScale.current === scale) return;
    if (!anchorZoom.current) {
      prevScale.current = scale;
      return;
    }
    anchorZoom.current = false;
    const ratio = scale / prevScale.current;
    const cx = el.scrollLeft + el.clientWidth / 2;
    const cy = el.scrollTop + el.clientHeight / 2;
    el.scrollLeft = cx * ratio - el.clientWidth / 2;
    el.scrollTop = cy * ratio - el.clientHeight / 2;
    prevScale.current = scale;
  }, [scale]);

  // Ctrl + wheel (and trackpad pinch) zooms the document rather than the page
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setCustomScale((s) => s * (1 - e.deltaY * 0.01));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status, setCustomScale]);

  /* ── Navigation ─────────────────────────────────────────────────────── */
  const scrollToPage = useCallback((page: number, smooth: boolean) => {
    const el = scrollRef.current;
    const target = pagesRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!el || !target) return;
    programmaticScroll.current = true;
    el.scrollTo({ top: target.offsetTop - 16, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => (programmaticScroll.current = false), smooth ? 600 : 80);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;
      const next = Math.min(numPages, Math.max(1, page));
      const far = Math.abs(next - currentPageRef.current) > 3;
      setCurrentPage(next);
      setPageInput(String(next));
      if (viewMode === "continuous") requestAnimationFrame(() => scrollToPage(next, !far));
      else scrollRef.current?.scrollTo({ top: 0 });
    },
    [numPages, viewMode, scrollToPage],
  );

  // In continuous mode, the page under the reading line becomes the current one
  const scrollFrame = useRef(0);
  const handleScroll = () => {
    if (viewMode !== "continuous" || programmaticScroll.current || scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      const el = scrollRef.current;
      const list = pagesRef.current;
      if (!el || !list) return;
      const line = el.scrollTop + el.clientHeight * 0.35 - list.offsetTop;
      const nodes = list.children as HTMLCollectionOf<HTMLElement>;
      let lo = 0;
      let hi = nodes.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (nodes[mid].offsetTop <= line) lo = mid;
        else hi = mid - 1;
      }
      const page = Number(nodes[lo]?.dataset.page);
      if (page && page !== currentPageRef.current) {
        setCurrentPage(page);
        setPageInput(String(page));
      }
    });
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "continuous") requestAnimationFrame(() => requestAnimationFrame(() => scrollToPage(currentPageRef.current, false)));
  };

  const rotate = (delta: number) =>
    setRotations((r) => ({ ...r, [currentPage]: (((r[currentPage] || 0) + delta) % 360 + 360) % 360 }));

  /* ── Touch: swipe between pages, pinch to zoom, auto-hiding controls ── */
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const hideTimer = useRef<number | null>(null);
  const isCoarse = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches, []);

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (!isCoarse) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3500);
  }, [isCoarse]);
  useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    pokeControls();
    if (e.touches.length === 2) {
      touch.current = null;
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
    } else if (e.touches.length === 1) {
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinch.current) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const ratio = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.dist;
    setCustomScale(pinch.current.scale * ratio);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
    const start = touch.current;
    touch.current = null;
    if (!start || viewMode !== "single" || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - start.t > 500) return;
    // Only swipe pages when the page itself isn't scrolled sideways
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth + 2) {
      if (dx > 0 && el.scrollLeft > 4) return;
      if (dx < 0 && el.scrollLeft < el.scrollWidth - el.clientWidth - 4) return;
    }
    goToPage(currentPage + (dx < 0 ? 1 : -1));
  };

  // The sidebar is a drawer over the page on narrow screens and sits beside it on wide ones
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setIsNarrow(entry.contentRect.width < 720));
    observer.observe(el);
    return () => observer.disconnect();
  }, [status]);

  /* ── Search ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!client || status !== "ready") return;
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      setActiveMatch(-1);
      return;
    }
    ensureWorker();
    setResults([]);
    setActiveMatch(-1);
    setIsSearching(true);
    // Results stream in; batch them per frame so a common word doesn't re-render thousands of times
    let pending: SearchResult[] = [];
    let frame = 0;
    const flush = () => {
      frame = 0;
      const batch = pending;
      pending = [];
      setResults((prev) => prev.concat(batch));
    };
    client.search(
      debouncedQuery,
      (r) => {
        pending.push(r);
        if (!frame) frame = requestAnimationFrame(flush);
      },
      () => {
        cancelAnimationFrame(frame);
        flush();
        setIsSearching(false);
      },
    );
    return () => cancelAnimationFrame(frame);
  }, [debouncedQuery, client, status, ensureWorker]);

  const highlightsByPage = useMemo(() => {
    const map = new Map<number, SearchRect[]>();
    if (!query.trim()) return map;
    for (const r of results) {
      const list = map.get(r.pageNumber);
      if (list) list.push(...r.rects);
      else map.set(r.pageNumber, [...r.rects]);
    }
    return map;
  }, [results, query]);

  const pickMatch = (index: number) => {
    setActiveMatch(index);
    const r = results[index];
    if (r) goToPage(r.pageNumber);
    if (isNarrow) setSidebarOpen(false);
  };

  const openSearch = () => {
    setSidebarOpen(true);
    setSidebarTab("search");
  };

  /* ── Thumbnails, selection, export ──────────────────────────────────── */
  useEffect(() => {
    if (sidebarOpen) ensureWorker();
  }, [sidebarOpen, ensureWorker]);

  const toggleSelect = useCallback((page: number) => {
    setSelectionMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }, []);
  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };
  const onThumbGoTo = useCallback(
    (page: number) => {
      goToPage(page);
      if (isNarrow) setSidebarOpen(false);
    },
    [goToPage, isNarrow],
  );

  const isReordered = useMemo(() => orderedPages.some((p, i) => p !== i + 1), [orderedPages]);
  const hasRotations = Object.values(rotations).some(Boolean);
  const pagesToExport = () => (selectionMode && selected.size ? orderedPages.filter((p) => selected.has(p)) : orderedPages);
  const title = documentTitle(url, fileName);

  const downloadPageImage = useCallback(
    async (page: number, format: ExportImageFormat) => {
      if (!pdfDoc) return;
      setDefaultFormat(format);
      setDownloadingPage(page);
      try {
        const blob = await renderPageImage(pdfDoc, page, rotations[page] || 0, format);
        downloadBlob(blob, `${title}_page_${page}.${format === "jpeg" ? "jpg" : format}`);
      } catch (err) {
        console.error(`Could not save page ${page}:`, err);
      } finally {
        setDownloadingPage(null);
      }
    },
    [pdfDoc, rotations, title],
  );

  const downloadPdf = async () => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const pages = pagesToExport();
    const unchanged = pages.length === numPages && !isReordered && !hasRotations;
    if (unchanged) {
      downloadBlob(new Blob([buffer], { type: "application/pdf" }), `${title}.pdf`);
      return;
    }
    setBusy("pdf");
    try {
      downloadBlob(await buildPdf(buffer, pages, rotations), `${title}${pages.length < numPages ? `_${pages.length}_pages` : ""}.pdf`);
      if (selectionMode) exitSelection();
    } catch (err) {
      console.error("Could not build the PDF:", err);
    } finally {
      setBusy(null);
    }
  };

  const downloadZip = async (kind: "images" | "pdf") => {
    const buffer = bufferRef.current;
    if (!buffer || !pdfDoc) return;
    const pages = pagesToExport();
    cancelExportRef.current = false;
    setBusy(kind === "images" ? "zip-images" : "zip-pdf");
    try {
      const files: { file: Blob; path: string }[] = [];
      if (kind === "images") {
        for (let i = 0; i < pages.length; i++) {
          if (cancelExportRef.current) return;
          setExportProgress(`${i + 1}/${pages.length}`);
          files.push({ file: await renderPageImage(pdfDoc, pages[i], rotations[pages[i]] || 0, "png"), path: `page_${pages[i]}.png` });
        }
      } else {
        files.push({ file: await buildPdf(buffer, pages, rotations), path: `${title}.pdf` });
      }
      setExportProgress("Zipping…");
      const zip = await zipFiles(files, title, (p) => setExportProgress(`Zipping ${Math.round(p)}%`));
      downloadBlob(zip, `${title}.zip`);
      if (selectionMode) exitSelection();
    } catch (err) {
      console.error("Could not build the ZIP:", err);
    } finally {
      setBusy(null);
      setExportProgress(null);
    }
  };

  /* ── Keyboard ───────────────────────────────────────────────────────── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openSearch();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable=true]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const single = viewMode === "single";
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        if (!single && e.key === "PageDown") return;
        e.preventDefault();
        goToPage(currentPage + 1);
        break;
      case "ArrowLeft":
      case "PageUp":
        if (!single && e.key === "PageUp") return;
        e.preventDefault();
        goToPage(currentPage - 1);
        break;
      case "Home":
        e.preventDefault();
        goToPage(1);
        break;
      case "End":
        e.preventDefault();
        goToPage(numPages);
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomIn();
        break;
      case "-":
        e.preventDefault();
        zoomOut();
        break;
      case "0":
        e.preventDefault();
        void applyZoomMode("fit-width");
        break;
      case "Escape":
        if (selectionMode) {
          e.stopPropagation();
          exitSelection();
        } else if (sidebarOpen && isNarrow) {
          e.stopPropagation();
          setSidebarOpen(false);
        }
        break;
    }
  };

  /* ── States other than a readable document ──────────────────────────── */
  const palette = pdfPalette(isDark);
  const shell = (children: React.ReactNode) => (
    <div style={palette} className="flex h-full w-full items-center justify-center overflow-auto bg-(--pv-canvas) p-6 text-(--pv-text)">
      <div className="flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </div>
  );

  if (status === "loading") {
    return shell(
      <>
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-(--pv-line) border-t-(--pv-accent)" />
        <p className="text-sm font-medium">Opening document…</p>
        {progress !== null && (
          <div className="mt-4 w-48">
            <div className="h-1 overflow-hidden rounded-full bg-(--pv-line)">
              <div className="h-full rounded-full bg-(--pv-accent) transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-(--pv-muted)">{Math.round(progress * 100)}%</p>
          </div>
        )}
      </>,
    );
  }

  if (status === "password") {
    return shell(
      <form
        className="flex w-full flex-col items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!password) return;
          passwordRef.current = password;
          setReloadKey((k) => k + 1);
        }}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--pv-accent-soft) text-(--pv-accent)">
          <Lock size={22} />
        </div>
        <h3 className="text-base font-semibold">This PDF is password protected</h3>
        <p className="mt-1 text-sm text-(--pv-muted)">Enter the password to open it.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          aria-invalid={passwordError}
          className={`mt-5 h-10 w-full rounded-lg border bg-(--pv-panel) px-3 text-sm outline-none transition-colors focus:border-(--pv-accent) ${passwordError ? "border-red-500" : "border-(--pv-line)"}`}
        />
        {passwordError && <p className="mt-2 self-start text-xs text-red-500">That password didn't work. Try again.</p>}
        <button
          type="submit"
          disabled={!password}
          className="mt-4 h-10 w-full rounded-lg bg-(--pv-accent) text-sm font-semibold text-(--pv-on-accent) transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Unlock
        </button>
      </form>,
    );
  }

  if (status === "error") {
    const isWeb = /^https?:/i.test(url);
    return shell(
      <>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <AlertCircle size={22} />
        </div>
        <h3 className="text-base font-semibold">This PDF couldn't be opened</h3>
        <p className="mt-1 text-sm text-(--pv-muted)">
          {isWeb ? "The site may block other apps from reading it, or the file may be damaged." : "The file may be damaged or not a PDF."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--pv-accent) px-3.5 text-[13px] font-semibold text-(--pv-on-accent) hover:opacity-90"
          >
            <RefreshCw size={14} /> Try again
          </button>
          {isWeb && (
            <button
              onClick={() => setStatus("embed")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--pv-line) px-3.5 text-[13px] font-medium hover:bg-(--pv-hover)"
            >
              Use Google's viewer
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--pv-line) px-3.5 text-[13px] font-medium hover:bg-(--pv-hover)"
          >
            <ExternalLink size={14} /> Open in new tab
          </a>
        </div>
        {error && (
          <details className="mt-5 w-full text-left">
            <summary className="cursor-pointer text-xs text-(--pv-muted)">Technical details</summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-(--pv-chip) p-2.5 text-[11px] text-(--pv-muted)">
              {error}
            </pre>
          </details>
        )}
      </>,
    );
  }

  if (status === "embed") {
    return (
      <div style={palette} className="h-full w-full bg-(--pv-canvas)">
        <iframe
          src={`https://docs.google.com/gview?url=${encodeURIComponent(url.replace(/#.*$/, ""))}&embedded=true`}
          className="h-full min-h-125 w-full border-0 bg-white"
          title="PDF document"
        />
      </div>
    );
  }

  /* ── The viewer ─────────────────────────────────────────────────────── */
  const currentIndex = orderedPages.indexOf(currentPage);
  const pageInputWidth = `${Math.max(2, String(numPages).length) + 1.5}ch`;
  const columns = sidebarWide ? (isNarrow ? 3 : 4) : 2;
  const pill =
    "pointer-events-auto flex items-center gap-0.5 rounded-full border border-(--pv-line) bg-(--pv-elevated)/95 p-1 shadow-(--pv-shadow) backdrop-blur-md";
  const divider = <span className="mx-1 h-5 w-px shrink-0 bg-(--pv-line)" />;

  const zoomOptions = [
    { value: "auto", label: "Automatic", description: "Fit the width, up to 125%" },
    { value: "fit-width", label: "Fit width" },
    { value: "fit-page", label: "Fit page", description: "Whole page on screen" },
    ...[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((z) => ({ value: String(z), label: `${Math.round(z * 100)}%` })),
  ];
  const zoomValue = zoomMode !== "custom" ? zoomMode : zoomOptions.find((o) => Number(o.value) === scale)?.value ?? "";

  const moreOptions = [
    { value: "single", label: "Single page", description: "One page at a time", icon: <BookOpen size={15} /> },
    { value: "continuous", label: "Continuous scroll", description: "All pages in a column", icon: <GalleryVertical size={15} /> },
    { value: "rotate-ccw", label: "Rotate left", description: `Page ${currentPage}`, icon: <RotateCcw size={15} /> },
    { value: "rotate-cw", label: "Rotate right", description: `Page ${currentPage}`, icon: <RotateCw size={15} /> },
    ...(viewMode === "single"
      ? [
          alignMode === "top"
            ? { value: "align", label: "Center vertically", description: "Middle of the view", icon: <AlignVerticalJustifyCenter size={15} /> }
            : { value: "align", label: "Align to top", description: "Start at the top", icon: <AlignStartVertical size={15} /> },
        ]
      : []),
    { value: "search", label: "Find in document", description: "Ctrl+F", icon: <Search size={15} /> },
    { value: "download", label: "Download PDF", description: hasRotations || isReordered ? "With your changes" : "Original file", icon: <FileDown size={15} /> },
    { value: "page-image", label: "Save page as image", description: `Page ${currentPage}, ${defaultFormat.toUpperCase()}`, icon: <FileImage size={15} /> },
  ];
  const onMore = (value: string) => {
    if (value === "single" || value === "continuous") switchViewMode(value);
    else if (value === "rotate-ccw") rotate(-90);
    else if (value === "rotate-cw") rotate(90);
    else if (value === "align") setAlignMode((a) => (a === "top" ? "center" : "top"));
    else if (value === "search") openSearch();
    else if (value === "download") void downloadPdf();
    else if (value === "page-image") void downloadPageImage(currentPage, defaultFormat);
  };

  const sidebar = sidebarOpen && (
    <>
      {isNarrow && <div className="absolute inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} aria-hidden />}
      <aside
        className={`flex min-h-0 flex-col border-r border-(--pv-line) bg-(--pv-panel) ${
          isNarrow ? "absolute inset-y-0 left-0 z-40 w-[min(88%,360px)] shadow-(--pv-shadow)" : `relative shrink-0 ${sidebarWide ? "w-130" : "w-68"}`
        }`}
        aria-label="Pages and search"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-(--pv-line) px-3">
          <div className="flex rounded-lg bg-(--pv-chip) p-0.5" role="tablist">
            {(["pages", "search"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={sidebarTab === tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors ${
                  sidebarTab === tab ? "bg-(--pv-elevated) text-(--pv-text) shadow-sm" : "text-(--pv-muted) hover:text-(--pv-text)"
                }`}
              >
                {tab === "pages" ? "Pages" : "Search"}
                {tab === "search" && results.length > 0 && (
                  <span className="rounded-full bg-(--pv-accent-soft) px-1.5 text-[10px] font-semibold tabular-nums text-(--pv-accent)">
                    {results.length > 999 ? "999+" : results.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center">
            {sidebarTab === "pages" && (
              <button
                onClick={() => setSidebarWide((w) => !w)}
                className={ICON_BUTTON}
                title={sidebarWide ? "Fewer columns" : "More columns"}
                aria-label={sidebarWide ? "Fewer columns" : "More columns"}
              >
                {sidebarWide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button onClick={() => setSidebarOpen(false)} className={ICON_BUTTON} aria-label="Close panel" title="Close panel">
              <X size={17} />
            </button>
          </div>
        </div>

        {sidebarTab === "pages" ? (
          <>
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-(--pv-line) px-3 text-xs">
              {selectionMode ? (
                <>
                  <span className="font-medium">{selected.size} selected</span>
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => setSelected(selected.size === orderedPages.length ? new Set() : new Set(orderedPages))}
                      className="rounded-md px-2 py-1 font-medium text-(--pv-accent) hover:bg-(--pv-hover)"
                    >
                      {selected.size === orderedPages.length ? "Select none" : "Select all"}
                    </button>
                    <button onClick={exitSelection} className="rounded-md px-2 py-1 font-medium text-(--pv-muted) hover:bg-(--pv-hover) hover:text-(--pv-text)">
                      Done
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-(--pv-muted)">
                    {numPages.toLocaleString()} {numPages === 1 ? "page" : "pages"}
                  </span>
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-(--pv-muted) hover:bg-(--pv-hover) hover:text-(--pv-text)"
                  >
                    <ListChecks size={14} /> Select
                  </button>
                </>
              )}
            </div>

            <div ref={setGridRoot} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {client && (
                <ThumbnailGrid
                  client={client}
                  scrollRoot={gridRoot}
                  pages={orderedPages}
                  currentPage={currentPage}
                  selectionMode={selectionMode}
                  selected={selected}
                  rotations={rotations}
                  columns={columns}
                  isDark={isDark}
                  defaultFormat={defaultFormat}
                  downloadingPage={downloadingPage}
                  onReorder={setOrderedPages}
                  onGoToPage={onThumbGoTo}
                  onToggleSelect={toggleSelect}
                  onDownloadPage={downloadPageImage}
                />
              )}
            </div>

            {(selectionMode || isReordered) && (
              <div className="shrink-0 space-y-2 border-t border-(--pv-line) p-3">
                {!selectionMode && isReordered && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-(--pv-muted)">Pages reordered</span>
                    <button
                      onClick={() => setOrderedPages(Array.from({ length: numPages }, (_, i) => i + 1))}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-(--pv-accent) hover:bg-(--pv-hover)"
                    >
                      <Undo2 size={12} /> Reset order
                    </button>
                  </div>
                )}
                {busy ? (
                  <div className="flex h-9 items-center justify-between gap-2 rounded-lg bg-(--pv-chip) px-3 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-(--pv-line) border-t-(--pv-accent)" />
                      {busy === "pdf" ? "Building PDF…" : busy === "zip-images" ? `Rendering ${exportProgress ?? ""}` : exportProgress ?? "Preparing…"}
                    </span>
                    {busy === "zip-images" && (
                      <button onClick={() => (cancelExportRef.current = true)} className="font-medium text-(--pv-muted) hover:text-(--pv-text)">
                        Cancel
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadPdf}
                      disabled={selectionMode && selected.size === 0}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--pv-accent) text-[13px] font-semibold text-(--pv-on-accent) transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <FileDown size={15} />
                      {selectionMode ? `PDF (${selected.size})` : "Download PDF"}
                    </button>
                    <CustomSelect
                      value=""
                      options={[
                        { value: "images", label: "PNG images", description: "One image per page", icon: <FileImage size={15} /> },
                        { value: "pdf", label: "Single PDF", description: "The PDF, zipped", icon: <FileText size={15} /> },
                      ]}
                      onChange={(v) => void downloadZip(v as "images" | "pdf")}
                      menuTitle="Download as ZIP"
                      open={openMenu === "zip"}
                      onOpenChange={(o) => setOpenMenu(o ? "zip" : null)}
                      className="flex-1"
                      disabled={selectionMode && selected.size === 0}
                      renderTrigger={({ ref, props }) => (
                        <button
                          ref={ref}
                          type="button"
                          {...props}
                          disabled={selectionMode && selected.size === 0}
                          onClick={() => setOpenMenu((m) => (m === "zip" ? null : "zip"))}
                          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-(--pv-line) text-[13px] font-medium transition-colors hover:bg-(--pv-hover) disabled:opacity-40"
                        >
                          <Archive size={14} /> ZIP <ChevronDown size={13} className="text-(--pv-muted)" />
                        </button>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <PdfSearch
            query={query}
            onQueryChange={setQuery}
            results={results}
            isSearching={isSearching}
            activeIndex={activeMatch}
            onPick={pickMatch}
            autoFocus={sidebarTab === "search"}
          />
        )}
      </aside>
    </>
  );

  return (
    <div
      ref={rootRef}
      style={palette}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerMove={(e) => e.pointerType === "mouse" && !controlsVisible && pokeControls()}
      className="relative flex h-full w-full overflow-hidden bg-(--pv-canvas) text-(--pv-text) outline-none"
    >
      {sidebar}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => isCoarse && pokeControls()}
          className="custom-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <div
            ref={pagesRef}
            className={`relative mx-auto flex w-max min-w-full flex-col items-center gap-4 px-2 pb-24 pt-4 sm:px-8 sm:pt-6 ${
              viewMode === "single" && alignMode === "center" ? "min-h-full justify-center" : ""
            }`}
          >
            {pdfDoc &&
              (viewMode === "single" ? (
                <PdfPage
                  pdfDoc={pdfDoc}
                  pageNum={currentPage}
                  scale={scale}
                  rotation={rotations[currentPage] || 0}
                  fallbackSize={firstPageSize}
                  maxPixels={MAX_PIXELS_SINGLE}
                  highlights={highlightsByPage.get(currentPage)}
                />
              ) : (
                orderedPages.map((page, index) => {
                  if (Math.abs(index - currentIndex) <= RENDER_WINDOW) {
                    return (
                      <PdfPage
                        key={page}
                        pdfDoc={pdfDoc}
                        pageNum={page}
                        scale={scale}
                        rotation={rotations[page] || 0}
                        fallbackSize={firstPageSize}
                        maxPixels={MAX_PIXELS_CONTINUOUS}
                        highlights={highlightsByPage.get(page)}
                      />
                    );
                  }
                  const turned = (rotations[page] || 0) % 180 !== 0;
                  return (
                    <PdfPagePlaceholder
                      key={page}
                      pageNum={page}
                      width={(turned ? firstPageSize.height : firstPageSize.width) * scale}
                      height={(turned ? firstPageSize.width : firstPageSize.height) * scale}
                    />
                  );
                })
              ))}
          </div>
        </div>

        {/* Toolbar */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-2 transition-all duration-300 sm:bottom-5 ${
            controlsVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div className={pill} role="toolbar" aria-label="Document controls">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className={`${ICON_BUTTON} ${sidebarOpen ? "bg-(--pv-accent-soft) text-(--pv-accent) hover:text-(--pv-accent)" : ""}`}
              aria-pressed={sidebarOpen}
              aria-label="Pages and search"
              title="Pages and search"
            >
              <PanelLeft size={17} />
            </button>
            {divider}
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className={ICON_BUTTON} aria-label="Previous page" title="Previous page (←)">
              <ChevronLeft size={18} />
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseInt(pageInput, 10);
                if (Number.isNaN(n)) setPageInput(String(currentPage));
                else goToPage(n);
                (e.currentTarget.elements[0] as HTMLInputElement)?.blur();
              }}
              className="flex items-center gap-1 px-0.5 text-[13px] tabular-nums"
            >
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => setPageInput(String(currentPage))}
                inputMode="numeric"
                aria-label="Page number"
                style={{ width: pageInputWidth }}
                className="h-8 rounded-md border border-(--pv-line) bg-(--pv-chip) text-center font-medium text-(--pv-text) outline-none focus:border-(--pv-accent)"
              />
              <span className="whitespace-nowrap text-(--pv-muted)">/ {numPages.toLocaleString()}</span>
            </form>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} className={ICON_BUTTON} aria-label="Next page" title="Next page (→)">
              <ChevronRight size={18} />
            </button>
            {divider}
            <button onClick={zoomOut} disabled={scale <= MIN_SCALE} className={`${ICON_BUTTON} max-sm:hidden`} aria-label="Zoom out" title="Zoom out (−)">
              <ZoomOut size={16} />
            </button>
            <CustomSelect
              value={zoomValue}
              options={zoomOptions}
              onChange={(v) => {
                if (v === "auto" || v === "fit-width" || v === "fit-page") void applyZoomMode(v);
                else setCustomScale(Number(v));
              }}
              menuTitle="Zoom"
              open={openMenu === "zoom"}
              onOpenChange={(o) => setOpenMenu(o ? "zoom" : null)}
              renderTrigger={({ ref, isOpen, props }) => (
                <button
                  ref={ref}
                  type="button"
                  {...props}
                  onClick={() => setOpenMenu((m) => (m === "zoom" ? null : "zoom"))}
                  className={`h-8 min-w-15 rounded-full px-2 text-[13px] font-medium tabular-nums transition-colors hover:bg-(--pv-hover) ${isOpen ? "bg-(--pv-hover)" : ""}`}
                  aria-label={`Zoom ${Math.round(scale * 100)}%`}
                  title="Zoom"
                >
                  {Math.round(scale * 100)}%
                </button>
              )}
            />
            <button onClick={zoomIn} disabled={scale >= MAX_SCALE} className={`${ICON_BUTTON} max-sm:hidden`} aria-label="Zoom in" title="Zoom in (+)">
              <ZoomIn size={16} />
            </button>
            {divider}
            <CustomSelect
              value={viewMode}
              options={moreOptions}
              onChange={onMore}
              menuTitle="View and export"
              open={openMenu === "more"}
              onOpenChange={(o) => setOpenMenu(o ? "more" : null)}
              renderTrigger={({ ref, isOpen, props }) => (
                <button
                  ref={ref}
                  type="button"
                  {...props}
                  onClick={() => setOpenMenu((m) => (m === "more" ? null : "more"))}
                  className={`${ICON_BUTTON} ${isOpen ? "bg-(--pv-hover) text-(--pv-text)" : ""}`}
                  aria-label="More options"
                  title="More options"
                >
                  <Ellipsis size={18} />
                </button>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
