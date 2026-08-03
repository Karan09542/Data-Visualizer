import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink, Download, Loader2, AlertCircle, Search, LayoutGrid, Sidebar, X, Play } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Initialize the pdf.js worker using unpkg CDN to bypass Vite bundling issues with .mjs workers
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
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
  const [showControls, setShowControls] = useState(true);
  
  const [baseViewportWidth, setBaseViewportWidth] = useState<number>(0);
  const [baseViewportHeight, setBaseViewportHeight] = useState<number>(0);

  // New features state
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'search'>('thumbnails');
  const [pageInput, setPageInput] = useState<string>("1");
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
  const [thumbnailsGenerating, setThumbnailsGenerating] = useState(false);
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pdfBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfPasswordRef = useRef<string | undefined>(undefined);
  const prevScaleRef = useRef<number>(scale);

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

  // Load PDF.js document using local bundled package with CORS proxy backup attempts
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setUseIframeFallback(false);
    setThumbnails({});
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
          setCurrentPage(1);
          setPageInput("1");
          setLoading(false);
          setPasswordRequired(false);
          
          // Auto-fit initial scale based on container width
          pdf.getPage(1).then((page: any) => {
            if (!active) return;
            const baseViewport = page.getViewport({ scale: 1.0 });
            if (containerRef.current) {
              const containerWidth = containerRef.current.clientWidth;
              const isMobile = containerWidth < 640;
              const desiredWidth = isMobile ? containerWidth : Math.max(containerWidth - 32, 200);
              const newScale = desiredWidth / baseViewport.width;
              setScale(Math.min(Math.max(newScale, 0.4), 2.5));
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

  // Render current page
  useEffect(() => {
    if (!pdfDoc) return;

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

      // Render at a high fixed scale for crispness
      const renderScale = 2.5;
      const viewport = page.getViewport({ scale: renderScale });
      
      const baseViewport = page.getViewport({ scale: 1.0 });
      setBaseViewportWidth(baseViewport.width);
      setBaseViewportHeight(baseViewport.height);
      
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
  }, [pdfDoc, currentPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setPageInput(String(page));
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
      <div className="flex flex-col h-full w-full bg-slate-950/20 dark:bg-slate-950/60 overflow-hidden shadow-none border-0">
        <div className="flex-1 w-full bg-slate-800 dark:bg-slate-900/40 flex items-stretch justify-stretch min-h-[500px]">
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
          <div className="fixed inset-y-0 left-0 z-[30000] w-[80%] max-w-[320px] sm:absolute sm:inset-auto sm:left-0 sm:top-0 sm:bottom-0 sm:z-20 sm:w-72 bg-slate-900 border-r border-slate-700/80 shadow-2xl flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between p-2 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-lg">
              <button
                onClick={() => setSidebarTab('thumbnails')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  sidebarTab === 'thumbnails' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={14} />
                Pages
              </button>
              <button
                onClick={() => setSidebarTab('search')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  sidebarTab === 'search' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Search size={14} />
                Search
              </button>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-500/20 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative">
            {sidebarTab === 'thumbnails' && (
              <div className="flex flex-col gap-4">
                {Object.keys(thumbnails).length === 0 && !thumbnailsGenerating && (
                  <div className="flex flex-col items-center justify-center p-6 text-center h-48 border border-slate-800 rounded-lg bg-slate-950/30">
                    <LayoutGrid size={24} className="text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400 mb-4">Generate thumbnails for faster visual navigation.</p>
                    <button
                      onClick={startThumbnailGeneration}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2 transition-colors active:scale-95"
                    >
                      <Play size={14} /> Generate Now
                    </button>
                  </div>
                )}
                
                {thumbnailsGenerating && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-2 justify-center bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                    <Loader2 size={14} className="animate-spin" />
                    Generating in background...
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(thumbnails).map(([pageNum, url]) => (
                    <div
                      key={pageNum}
                      onClick={() => goToPage(Number(pageNum))}
                      className={`flex flex-col gap-1 cursor-pointer group ${currentPage === Number(pageNum) ? 'opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity`}
                    >
                      <div className={`border-2 rounded overflow-hidden aspect-[1/1.4] bg-white ${currentPage === Number(pageNum) ? 'border-indigo-500 shadow-md shadow-indigo-500/20' : 'border-transparent group-hover:border-slate-500'}`}>
                        <img src={url} alt={`Page ${pageNum}`} className="w-full h-full object-contain bg-white" loading="lazy" />
                      </div>
                      <span className={`text-[10px] text-center font-semibold ${currentPage === Number(pageNum) ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                        Page {pageNum}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sidebarTab === 'search' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHasSearched(false);
                    }}
                    placeholder="Search in PDF..."
                    className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                      className="p-3 bg-slate-950/50 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="text-[10px] font-bold text-indigo-400 mb-1">Page {result.pageNumber}</div>
                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{result.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

      {/* Main Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full overflow-auto custom-scrollbar pt-2 pb-16 px-0 sm:pt-4 sm:pb-20 sm:px-4 touch-pan-x touch-pan-y relative z-0" 
        style={{ overscrollBehavior: 'contain' }}
      >
        <div 
          className="shadow-md sm:border border-slate-700/30 bg-white overflow-hidden flex-shrink-0 relative mx-auto"
          style={{
             width: baseViewportWidth ? `${baseViewportWidth * scale}px` : 'auto',
             height: baseViewportHeight ? `${baseViewportHeight * scale}px` : 'auto',
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full block max-w-none" />
        </div>
      </div>

      {/* Floating Controls */}
      <div
        className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-3 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-slate-200 z-10 shadow-2xl transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className={`p-1.5 rounded-md sm:rounded-lg transition-colors flex-shrink-0 ${showSidebar ? 'bg-indigo-500 text-white' : 'hover:bg-slate-800'}`}
          title="Toggle Sidebar"
        >
          <Sidebar size={15} />
        </button>
        
        <div className="w-px h-5 bg-slate-700 flex-shrink-0 hidden sm:block" />

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || rendering}
            className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 transition-colors"
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
              className="w-8 sm:w-11 bg-slate-900 border border-slate-700 text-center text-[11px] sm:text-xs font-mono font-bold rounded px-0.5 py-0.5 sm:py-1 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <span className="text-[11px] sm:text-xs font-mono font-medium select-none text-slate-400">
              /{totalPages}
            </span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || rendering}
            className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 transition-colors"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-700 flex-shrink-0 hidden sm:block" />
        
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || rendering}
            className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] sm:text-xs font-mono font-medium min-w-[28px] sm:min-w-[36px] text-center select-none text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || rendering}
            className="p-1 sm:p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
