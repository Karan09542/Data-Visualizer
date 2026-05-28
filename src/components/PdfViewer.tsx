import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink, Download, Loader2, AlertCircle } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// Initialize the pdf.js worker using the bundled asset url from Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF.js document using local bundled package
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const cleanUrl = url.replace(/#.*$/, "");
    const loadingTask = pdfjsLib.getDocument({
      url: cleanUrl,
      withCredentials: false
    });

    loadingTask.promise
      .then((pdf) => {
        if (!active || !pdf) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("PDF.js loading error:", err);
        setError(err.message || "Failed to load and render PDF document. This might be due to CORS blocks.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [url]);

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

      // Handle scaling to device pixel ratio for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

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
  }, [pdfDoc, currentPage, scale]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-64 bg-slate-900/30 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Rendering PDF content...</p>
        <p className="text-xs text-slate-400 mt-1">Caching pages directly in the viewer</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-rose-500/5 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-900/30">
        <AlertCircle className="h-8 w-8 text-rose-500 mb-3" />
        <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">PDF Rendering Blocked</h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
          Embedding files directly inside the app sandbox may be restricted by security policies or CORS settings.
        </p>
        <div className="flex gap-2 mt-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            <ExternalLink size={12} />
            Open in New Tab
          </a>
          <button
            onClick={downloadFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-250 text-xs font-semibold rounded-lg transition border border-slate-700"
          >
            <Download size={12} />
            Download PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/20 dark:bg-slate-950/60 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-850">
      {/* PDF Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 z-10">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || rendering}
            className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-mono px-2 font-medium">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || rendering}
            className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || rendering}
            className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono font-medium min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || rendering}
            className="p-1.5 rounded bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {rendering && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-blue-500 mr-2">
              <Loader2 size={12} className="animate-spin" /> Rendering...
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
            title="Open in New Tab"
          >
            <ExternalLink size={15} />
          </a>
          <button
            onClick={downloadFile}
            className="p-1.5 rounded hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
            title="Download PDF"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* Canvas container with scrollbars */}
      <div className="flex-1 w-full overflow-auto custom-scrollbar p-6 bg-slate-800 dark:bg-slate-900/40 flex items-start justify-center min-h-[300px]">
        <div className="shadow-xl border border-slate-350 dark:border-slate-800 rounded bg-white overflow-hidden">
          <canvas ref={canvasRef} className="block max-w-full" />
        </div>
      </div>
    </div>
  );
};
