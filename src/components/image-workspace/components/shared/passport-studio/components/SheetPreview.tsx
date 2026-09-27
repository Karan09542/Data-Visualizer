import React, { useMemo } from 'react';
import { Image as ImageIcon, Maximize, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { FileDropzoneUpload } from '../../../../../utilities/FileDropzoneUpload';
import type { PanZoomState } from '../hooks/usePanZoom';
import type { ImageFitMode, ImagePosition, Orientation, SheetLayout } from '../types';
import { MM_TO_PX } from '../utils/units';
import { Divider, IconButton, cx } from '../ui/primitives';

type Props = {
  isDark: boolean;
  visible: boolean;
  layout: SheetLayout;
  view: PanZoomState;
  orientation: Orientation;
  printDPI: number;
  spacing: number;
  drawCropMarks: boolean;
  imageFit: ImageFitMode;
  imagePosition: ImagePosition;
  photoScale: number;
  filterCss: string;
  getCellImageSrc: (index: number) => string | null;
  onReplaceCell: (cellIndex: number) => void;
  onFileSelected: (file: File) => void;
};

/** Live, pannable/zoomable paper sheet preview with a floating zoom toolbar and status bar. */
export const SheetPreview: React.FC<Props> = ({
  isDark, visible, layout, view, orientation, printDPI, spacing, drawCropMarks,
  imageFit, imagePosition, photoScale, filterCss, getCellImageSrc, onReplaceCell, onFileSelected,
}) => {
  // Build array of active photo indices for preview grid
  const photoIndices = useMemo(() => {
    const indices: { r: number; c: number }[] = [];
    let count = 0;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        if (count < layout.activePhotoCount) {
          indices.push({ r, c });
          count++;
        }
      }
    }
    return indices;
  }, [layout.rows, layout.cols, layout.activePhotoCount]);

  return (
    <main className={cx(
      'flex-1 flex-col relative overflow-hidden min-w-0 bg-slate-100 dark:bg-[#0B0B0C]',
      visible ? 'flex' : 'hidden sm:flex',
    )}>
      {/* Canvas Viewport Area */}
      <div
        ref={view.viewportRef}
        onWheel={view.handleWheel}
        onMouseDown={view.handleMouseDown}
        onDoubleClick={view.handleDoubleClick}
        className={cx(
          'flex-1 relative overflow-hidden select-none touch-none flex items-center justify-center',
          view.isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        {/* Background dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDark
              ? 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)'
              : 'radial-gradient(rgba(15,23,42,0.09) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Paper info */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded-lg border text-[11px] font-mono backdrop-blur-md bg-white/85 border-slate-200 text-slate-600 dark:bg-[#161618]/85 dark:border-white/[0.08] dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {layout.pWidth} × {layout.pHeight} mm
            <span className="text-slate-300 dark:text-zinc-600">·</span>
            <span className="capitalize">{orientation}</span>
          </div>
        </div>

        {/* Interactive Transform Container (Always Centered + Smooth Pan Offset + Center Zoom) */}
        <div
          className="absolute flex items-center justify-center will-change-transform"
          style={{
            transform: `translate3d(${view.panOffset.x}px, ${view.panOffset.y}px, 0px) scale(${view.zoomLevel / 100})`,
            transformOrigin: 'center center',
            transition: view.isDragging ? 'none' : 'transform 75ms cubic-bezier(0.1, 0.9, 0.2, 1.0)',
          }}
        >
          {/* Paper Sheet */}
          <div
            className="relative bg-white shrink-0 rounded-[2px]"
            style={{
              width: `${view.basePaperWidthPx}px`,
              height: `${(view.basePaperWidthPx * layout.pHeight) / layout.pWidth}px`,
              boxShadow: isDark
                ? '0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px -12px rgba(0,0,0,0.8)'
                : '0 0 0 1px rgba(15,23,42,0.06), 0 20px 50px -12px rgba(15,23,42,0.25)'
            }}
          >
            {/* Empty Grid Dropzone Upload */}
            {layout.activePhotoCount === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-6 z-10 pointer-events-auto">
                <FileDropzoneUpload
                  onFileSelected={onFileSelected}
                  accept="image/*"
                  title="Add Photo to Grid"
                  subtitle="Drop image, paste or snap camera photo"
                  accentColor="blue"
                  enableCamera={true}
                  className="w-full max-w-xs"
                />
              </div>
            )}

            {photoIndices.map(({ r, c }) => {
              const cellIndex = r * layout.cols + c;
              const cellSrc = getCellImageSrc(cellIndex);

              const left = layout.actualMarginLeft + c * (layout.phWidth + spacing);
              const top = layout.actualMarginTop + r * (layout.phHeight + spacing);
              return (
                <div
                  key={`${r}-${c}`}
                  onDoubleClick={() => onReplaceCell(cellIndex)}
                  className="absolute overflow-visible cursor-pointer group hover:z-20"
                  style={{
                    left: `${(left / layout.pWidth) * 100}%`,
                    top: `${(top / layout.pHeight) * 100}%`,
                    width: `${(layout.phWidth / layout.pWidth) * 100}%`,
                    height: `${(layout.phHeight / layout.pHeight) * 100}%`,
                  }}
                  title="Double-click to replace this photo"
                >
                  <div
                    className="w-full h-full relative overflow-hidden flex items-center justify-center bg-white transition-shadow group-hover:ring-2 group-hover:ring-blue-500"
                    style={{ border: drawCropMarks ? '1px dashed #94A3B8' : 'none' }}
                  >
                    {cellSrc ? (
                      <div
                        className="w-full h-full transition-transform duration-100"
                        style={{
                          backgroundImage: `url(${cellSrc})`,
                          backgroundSize: imageFit === 'fill' ? '100% 100%' : imageFit,
                          backgroundPosition: imagePosition,
                          backgroundRepeat: 'no-repeat',
                          transform: `scale(${photoScale / 100})`,
                          transformOrigin: 'center center',
                          filter: filterCss,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-300">
                        <ImageIcon size={20} />
                      </div>
                    )}

                    {/* Hover hint */}
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 bg-white text-slate-900 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow">
                        <RefreshCw size={9} /> Replace
                      </span>
                    </div>
                  </div>

                  {/* Scissor cut guideline mark */}
                  {drawCropMarks && (c === 0 || r === 0 || spacing >= 2) && (
                    <div
                      className="absolute -top-2.5 -left-2.5 z-10 text-slate-500 select-none pointer-events-none -rotate-45"
                      style={{ fontSize: '10px' }}
                    >
                      ✂
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating zoom toolbar */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 p-1 rounded-xl border shadow-lg backdrop-blur-md bg-white/90 border-slate-200 dark:bg-[#1A1A1D]/90 dark:border-white/[0.08] cursor-default"
        >
          <IconButton size="sm" onClick={() => view.zoomBy(-15)} title="Zoom Out">
            <ZoomOut size={15} />
          </IconButton>
          <button
            type="button"
            onClick={view.resetView}
            title="Reset Zoom to 100% & Recenter"
            className="min-w-[52px] h-7 px-1.5 rounded-lg text-[11px] font-mono font-semibold tabular-nums text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-white/[0.06] transition-colors"
          >
            {view.zoomLevel}%
          </button>
          <IconButton size="sm" onClick={() => view.zoomBy(15)} title="Zoom In">
            <ZoomIn size={15} />
          </IconButton>
          <Divider vertical className="mx-0.5 h-4" />
          <IconButton size="sm" onClick={view.resetView} active={view.isTransformed} title="Recenter & Reset Zoom">
            <Maximize size={14} />
          </IconButton>
        </div>
      </div>

      {/* Status bar */}
      <footer className="min-h-[32px] shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 py-1.5 border-t text-[11px] font-mono pb-[max(0.375rem,env(safe-area-inset-bottom))] bg-white border-slate-200 text-slate-500 dark:bg-[#111113] dark:border-white/[0.06] dark:text-zinc-500">
        <div className="truncate">
          <span className="hidden sm:inline">Grid {layout.cols} × {layout.rows} ({layout.maxCapacity} max) · </span>
          {layout.activePhotoCount} {layout.activePhotoCount === 1 ? 'photo' : 'photos'}
        </div>
        <div className="shrink-0 text-right">
          {MM_TO_PX(layout.pWidth, printDPI)} × {MM_TO_PX(layout.pHeight, printDPI)} px @ {printDPI} DPI
        </div>
      </footer>
    </main>
  );
};
