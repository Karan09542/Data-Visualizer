import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import type { SearchRect } from "./pdfWorkerClient";

/**
 * Canvas pixels allowed per page. Above this a page is drawn a little softer instead of using
 * hundreds of megabytes; iOS refuses canvases over 16.7M pixels outright.
 */
export const MAX_PIXELS_SINGLE = 16_000_000;
export const MAX_PIXELS_CONTINUOUS = 8_000_000;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * Where a match starts and ends along its text run, as fractions of the run's width. Measured
 * with a similar font, which is far closer than assuming every character is equally wide.
 */
function matchSpan(rect: SearchRect): [number, number] {
  const even: [number, number] = [rect.overlapStart / rect.totalLen, rect.overlapEnd / rect.totalLen];
  if (!rect.str) return even;
  if (measurer === undefined) measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) return even;
  measurer.font = `100px ${rect.fontFamily || "sans-serif"}`;
  const total = measurer.measureText(rect.str).width;
  if (!total) return even;
  return [
    measurer.measureText(rect.str.slice(0, rect.overlapStart)).width / total,
    measurer.measureText(rect.str.slice(0, rect.overlapEnd)).width / total,
  ];
}

/** Search-match rectangles in page units (scale 1), from the text positions the worker found */
export function highlightBoxes(viewport: any, rects: SearchRect[]): Box[] {
  const boxes: Box[] = [];
  for (const rect of rects.slice(0, 500)) {
    try {
      const [from, to] = matchSpan(rect);
      const x = rect.transform[4] + rect.width * from;
      const y = rect.transform[5];
      const fontSize = Math.abs(rect.transform[3]) || rect.height || 12;
      const [x1, y1] = viewport.convertToViewportPoint(x, y);
      const [, yTop] = viewport.convertToViewportPoint(x, y + fontSize);
      const [x2] = viewport.convertToViewportPoint(x + rect.width * (to - from), y);
      boxes.push({
        left: Math.min(x1, x2),
        top: Math.min(y1, yTop),
        width: Math.max(Math.abs(x2 - x1), 2),
        height: Math.max(Math.abs(y1 - yTop), 5),
      });
    } catch {
      // A malformed text position: skip that one highlight
    }
  }
  return boxes;
}

interface PdfPageProps {
  pdfDoc: any;
  pageNum: number;
  scale: number;
  /** Extra rotation chosen in the viewer, on top of the page's own */
  rotation: number;
  /** Size to reserve before this page's own size is known */
  fallbackSize: { width: number; height: number };
  maxPixels: number;
  highlights?: SearchRect[];
  className?: string;
}

export const PdfPage: React.FC<PdfPageProps> = React.memo(
  ({ pdfDoc, pageNum, scale, rotation, fallbackSize, maxPixels, highlights, className = "" }) => {
    const holderRef = useRef<HTMLDivElement>(null);
    const [base, setBase] = useState<{ width: number; height: number; viewport: any } | null>(null);
    const [drawn, setDrawn] = useState(false);
    const [failed, setFailed] = useState(false);
    // Redraw only once zooming settles; until then the last drawing is stretched to fit
    const [renderScale] = useDebounce(scale, 180);

    useEffect(() => {
      let cancelled = false;
      let task: any = null;

      (async () => {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;
        const rotate = ((page.rotate || 0) + rotation) % 360;
        const unit = page.getViewport({ scale: 1, rotation: rotate });
        setBase({ width: unit.width, height: unit.height, viewport: unit });

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const fit = Math.sqrt(maxPixels / (unit.width * unit.height));
        const viewport = page.getViewport({ scale: Math.min(renderScale * dpr, fit), rotation: rotate });

        // Drawn off-screen and swapped in, so the old drawing stays up until the new one is ready
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "block h-full w-full";
        const context = canvas.getContext("2d")!;
        task = page.render({ canvas, canvasContext: context, viewport });
        await task.promise;
        if (cancelled || !holderRef.current) return;

        const old = holderRef.current.querySelector("canvas");
        holderRef.current.replaceChildren(canvas);
        if (old) old.width = old.height = 0; // release its memory now
        setDrawn(true);
        setFailed(false);
      })().catch((err) => {
        if (cancelled || err?.name === "RenderingCancelledException") return;
        console.error(`PDF page ${pageNum} failed to draw:`, err);
        setFailed(true);
      });

      return () => {
        cancelled = true;
        task?.cancel();
      };
    }, [pdfDoc, pageNum, rotation, renderScale, maxPixels]);

    // Free the canvas when the page leaves the render window
    useEffect(() => {
      const holder = holderRef.current;
      return () => {
        const canvas = holder?.querySelector("canvas");
        if (canvas) canvas.width = canvas.height = 0;
      };
    }, []);

    const boxes = useMemo(
      () => (base && highlights?.length ? highlightBoxes(base.viewport, highlights) : null),
      [base, highlights],
    );

    const width = (base?.width ?? fallbackSize.width) * scale;
    const height = (base?.height ?? fallbackSize.height) * scale;

    return (
      <div
        data-page={pageNum}
        className={`relative shrink-0 overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_-12px_rgba(0,0,0,0.35)] ${className}`}
        style={{ width, height }}
      >
        <div ref={holderRef} className="absolute inset-0" />

        {!drawn && !failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-500">
            This page could not be displayed
          </div>
        )}

        {boxes && base && (
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{ width: base.width, height: base.height, transform: `scale(${scale})` }}
          >
            {boxes.map((b, i) => (
              <div
                key={i}
                className="absolute rounded-[1px] bg-amber-300/45 ring-1 ring-amber-500/60 mix-blend-multiply"
                style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

/** Stands in for a page outside the render window, at the size it will have */
export const PdfPagePlaceholder: React.FC<{ pageNum: number; width: number; height: number }> = React.memo(
  ({ pageNum, width, height }) => (
    <div
      data-page={pageNum}
      className="flex shrink-0 items-center justify-center rounded-[3px] bg-white/90 text-xs font-medium text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
      style={{ width, height }}
    >
      {pageNum}
    </div>
  ),
);
