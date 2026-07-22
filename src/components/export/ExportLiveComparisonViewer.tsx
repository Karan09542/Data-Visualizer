import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Minus, 
  Plus, 
  ChevronDown, 
  X, 
  RotateCw,
} from 'lucide-react';

export interface ExportLiveComparisonViewerProps {
  comparisonMode: boolean;
  isMobile: boolean;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  handleExport: () => void;
  comparisonPreviewMode: 'split' | 'side-by-side' | 'original' | 'optimized' | 'difference' | 'overlay';
  setComparisonPreviewMode: (mode: any) => void;
  comparisonZoom: number;
  setComparisonZoom: (zoom: number) => void;
  transformComponentRef: React.RefObject<any>;
  sliderRef: React.RefObject<HTMLDivElement | null>;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  artboards: any[];
  activeArtboardId: string;
  isDraggingDivider: boolean;
  originalPreviewDims: { w: number; h: number } | null;
  optimizedPreviewDims: { w: number; h: number } | null;
  optimizedImageUrl: string | null;
  originalImageUrl: string | null;
  comparisonDivider: number;
  handlePointerDown: (e: React.PointerEvent) => void;
  setComparisonDivider: (val: number) => void;
  showDiagnostics: boolean;
  setShowDiagnostics: React.Dispatch<React.SetStateAction<boolean>>;
  originalSize: number | null;
  optimizedSize: number | null;
  exportSettings: any;
  setExportSettings: (settings: any) => void;
  exportTarget: 'current' | 'all' | 'selected';
  psnr: number | null;
  isGeneratingPreview: boolean;
  currentPreviewOp: string | null;
  showMobileCompareSwitcher: boolean;
  setShowMobileCompareSwitcher: (show: boolean) => void;
  showMobileDiagnosticsSheet: boolean;
  setShowMobileDiagnosticsSheet: (show: boolean) => void;
  mobileDetailsExpanded: boolean;
  setMobileDetailsExpanded: (expanded: boolean) => void;
}

const formatFileSize = (bytes: number, _si=false, dp=1) => {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let u = -1;
  const r = 10**dp;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  return bytes.toFixed(dp) + ' ' + units[u];
};

export const ExportLiveComparisonViewer: React.FC<ExportLiveComparisonViewerProps> = ({
  comparisonMode,
  isMobile,
  setActiveTab,
  handleExport,
  comparisonPreviewMode,
  setComparisonPreviewMode,
  comparisonZoom,
  setComparisonZoom,
  artboards,
  activeArtboardId,
  optimizedImageUrl,
  originalImageUrl,
  comparisonDivider,
  setComparisonDivider,
  originalSize,
  optimizedSize,
  exportSettings,
  exportTarget,
  psnr,
  isGeneratingPreview,
  currentPreviewOp
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const optimizedImgRef = useRef<HTMLImageElement | null>(null);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  const activeArtboard = artboards.find((x: any) => x.id === activeArtboardId) || artboards[0];
  const artboardW = activeArtboard?.width || 800;
  const artboardH = activeArtboard?.height || 600;

  // Load Images
  useEffect(() => {
    if (originalImageUrl) {
      const img = new Image();
      img.src = originalImageUrl;
      img.onload = () => { originalImgRef.current = img; };
    }
  }, [originalImageUrl]);

  useEffect(() => {
    if (optimizedImageUrl) {
      const img = new Image();
      img.src = optimizedImageUrl;
      img.onload = () => { optimizedImgRef.current = img; };
    }
  }, [optimizedImageUrl]);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const padding = 40;
    
    let targetW = artboardW;
    let targetH = artboardH;
    if (comparisonPreviewMode === 'side-by-side') {
      targetW = artboardW * 2 + 20; // 20px gap
    }

    const scaleX = (width - padding * 2) / targetW;
    const scaleY = (height - padding * 2) / targetH;
    const scale = Math.min(scaleX, scaleY, 1);
    
    setComparisonZoom(scale);
    setPan({ x: width / 2, y: height / 2 });
  }, [artboardW, artboardH, comparisonPreviewMode, setComparisonZoom]);

  // Initial fit
  useEffect(() => {
    if (comparisonMode) {
      // small delay to ensure container is measured
      setTimeout(fitToScreen, 50);
    }
  }, [comparisonMode, fitToScreen]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); // optimize for difference mode
    if (!ctx) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    
    // Setup high-DPI canvas
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = comparisonZoom <= 1;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw checkerboard
    const drawCheckerboard = (x: number, y: number, w: number, h: number) => {
       ctx.save();
       ctx.beginPath();
       ctx.rect(x, y, w, h);
       ctx.clip();
       
       const s = 16 * comparisonZoom;
       ctx.fillStyle = '#111';
       ctx.fillRect(x, y, w, h);
       ctx.fillStyle = '#1A1A1A';
       
       const startX = Math.floor(x / s) * s;
       const startY = Math.floor(y / s) * s;
       
       for (let i = startX; i < x + w; i += s) {
         for (let j = startY; j < y + h; j += s) {
           if (Math.abs((i / s) % 2) === Math.abs((j / s) % 2)) {
             ctx.fillRect(i, j, s, s);
           }
         }
       }
       ctx.restore();
    };

    const drawImageCentered = (img: HTMLImageElement, offsetX = 0) => {
      const drawW = (img as any).naturalWidth * comparisonZoom;
      const drawH = (img as any).naturalHeight * comparisonZoom;
      const drawX = pan.x - drawW / 2 + offsetX;
      const drawY = pan.y - drawH / 2;

      drawCheckerboard(drawX, drawY, drawW, drawH);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      
      // Outline
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      
      return { drawX, drawY, drawW, drawH };
    };

    if (comparisonPreviewMode === 'original' && originalImgRef.current) {
      drawImageCentered(originalImgRef.current);
    } 
    else if (comparisonPreviewMode === 'optimized' && optimizedImgRef.current) {
      drawImageCentered(optimizedImgRef.current);
    }
    else if (comparisonPreviewMode === 'side-by-side' && originalImgRef.current && optimizedImgRef.current) {
      const gap = 20 * comparisonZoom;
      const w = (originalImgRef.current as any).naturalWidth * comparisonZoom;
      drawImageCentered(originalImgRef.current, -w/2 - gap/2);
      drawImageCentered(optimizedImgRef.current, w/2 + gap/2);
    }
    else if (comparisonPreviewMode === 'split' && originalImgRef.current && optimizedImgRef.current) {
      // Draw optimized (after) as base
      const bounds = drawImageCentered(optimizedImgRef.current);
      
      // Draw original (before) clipped
      ctx.save();
      ctx.beginPath();
      const splitX = bounds.drawX + (bounds.drawW * (comparisonDivider / 100));
      ctx.rect(bounds.drawX, bounds.drawY, splitX - bounds.drawX, bounds.drawH);
      ctx.clip();
      
      ctx.drawImage(originalImgRef.current, bounds.drawX, bounds.drawY, bounds.drawW, bounds.drawH);
      ctx.restore();

      // Draw Split Line
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.strokeStyle = '#3b82f6'; // blue-500
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Handle
      ctx.beginPath();
      ctx.arc(splitX, height / 2, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#18181b'; // zinc-900
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Handle arrows
      ctx.fillStyle = '#60a5fa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◀ ▶', splitX, height / 2);
    }
    else if (comparisonPreviewMode === 'overlay' && originalImgRef.current && optimizedImgRef.current) {
      drawImageCentered(originalImgRef.current);
      ctx.globalAlpha = 0.5;
      const drawW = (optimizedImgRef.current as any).naturalWidth * comparisonZoom;
      const drawH = (optimizedImgRef.current as any).naturalHeight * comparisonZoom;
      const drawX = pan.x - drawW / 2;
      const drawY = pan.y - drawH / 2;
      ctx.drawImage(optimizedImgRef.current, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1.0;
    }
    else if (comparisonPreviewMode === 'difference' && originalImgRef.current && optimizedImgRef.current) {
      const drawW = (originalImgRef.current as any).naturalWidth * comparisonZoom;
      const drawH = (originalImgRef.current as any).naturalHeight * comparisonZoom;
      const drawX = pan.x - drawW / 2;
      const drawY = pan.y - drawH / 2;

      // For difference mode, we want a solid black background, not a checkerboard, so difference math is clean
      ctx.fillStyle = '#000';
      ctx.fillRect(drawX, drawY, drawW, drawH);

      // Draw original
      ctx.drawImage(originalImgRef.current, drawX, drawY, drawW, drawH);
      
      // Calculate difference
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(optimizedImgRef.current, drawX, drawY, drawW, drawH);

      // Boost the difference to make it visible to the human eye (since compression diffs are often < 5/255)
      // By using 'lighter', we add the pixels to themselves, doubling the brightness 4 times (16x boost)
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'contrast(200%) brightness(200%)';
      
      // Draw the region over itself multiple times to amplify the faint difference signals
      for (let i = 0; i < 4; i++) {
         ctx.drawImage(
            canvasRef.current, 
            drawX * dpr, drawY * dpr, drawW * dpr, drawH * dpr, // source (in physical pixels)
            drawX, drawY, drawW, drawH // dest (in logical pixels)
         );
      }
      
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      
      // Outline
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, drawY, drawW, drawH);

      // Informative text overlay
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(drawX + 10, drawY + 10, 260, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (psnr && psnr >= 99) {
         ctx.fillStyle = '#4ade80'; // emerald-400
         ctx.fillText('Perfect Match (No Difference)', drawX + 20, drawY + 25);
      } else {
         ctx.fillText('Difference Map (Boosted 16x)', drawX + 20, drawY + 25);
      }
    }

    ctx.restore();
  }, [pan, comparisonZoom, comparisonPreviewMode, comparisonDivider]);

  // Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  // Event Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.min(Math.max(0.05, comparisonZoom * (1 + delta)), 20);
      
      // Zoom to cursor
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        
        const scaleChange = newZoom / comparisonZoom;
        setPan(prev => ({
          x: cursorX - (cursorX - prev.x) * scaleChange,
          y: cursorY - (cursorY - prev.y) * scaleChange
        }));
      }
      
      setComparisonZoom(newZoom);
    } else {
      // Pan
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handlePointerDownLocal = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left click only
    
    // Check if clicking on slider
    if (comparisonPreviewMode === 'split' && originalImgRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cursorX = e.clientX - rect.left;
      
      const drawW = (originalImgRef.current as any).naturalWidth * comparisonZoom;
      const drawX = pan.x - drawW / 2;
      const splitX = drawX + (drawW * (comparisonDivider / 100));
      
      const hitRadius = isMobile ? 40 : 20;
      if (Math.abs(cursorX - splitX) < hitRadius) {
        setIsDraggingSlider(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    if (isSpaceDown) {
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMoveLocal = (e: React.PointerEvent) => {
    if (isDraggingSlider && containerRef.current && originalImgRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      
      const drawW = (originalImgRef.current as any).naturalWidth * comparisonZoom;
      const drawX = pan.x - drawW / 2;
      
      let newDiv = ((cursorX - drawX) / drawW) * 100;
      newDiv = Math.min(Math.max(0, newDiv), 100);
      setComparisonDivider(newDiv);
    } else if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handlePointerUpLocal = (e: React.PointerEvent) => {
    setIsPanning(false);
    setIsDraggingSlider(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClickLocal = (e: React.MouseEvent) => {
    if (comparisonPreviewMode === 'split' && Math.abs(comparisonDivider - 50) > 1) {
      // If clicking near center, reset slider
      setComparisonDivider(50);
    }
  };

  // Global Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(true);
      if (e.key === '0') fitToScreen();
      if (e.key === '1') setComparisonZoom(1);
      if (e.key === '2') setComparisonZoom(2);
      if (e.key.toLowerCase() === 's') setComparisonPreviewMode('split');
      if (e.key.toLowerCase() === 'b') setComparisonPreviewMode('original'); // Before
      if (e.key.toLowerCase() === 'a') setComparisonPreviewMode('optimized'); // After
      if (e.key.toLowerCase() === 'd') setComparisonPreviewMode('difference');
      if (e.key === 'Escape') setActiveTab('properties'); // Close
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fitToScreen, setComparisonPreviewMode, setComparisonZoom, setActiveTab]);

  if (!comparisonMode) return null;

  return (
    <div className="absolute inset-0 z-50 bg-[#09090b] flex flex-col overflow-hidden text-slate-200 select-none font-sans">
      
      {/* --- TOP TOOLBAR --- */}
      <div className="h-14 shrink-0 flex items-center justify-between px-2 sm:px-4 border-b border-white/5 bg-[#121214] shadow-sm relative z-50">
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <button 
            onClick={() => setActiveTab('properties')}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
          
          <div className="h-4 w-px bg-white/10 shrink-0" />
          
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
            {(['original', 'split', 'side-by-side', 'overlay', 'difference'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setComparisonPreviewMode(mode)}
                className={`relative px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs whitespace-nowrap font-semibold rounded-lg transition-colors ${comparisonPreviewMode === mode ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {comparisonPreviewMode === mode && (
                  <motion.div 
                    layoutId="active-mode-bg"
                    className="absolute inset-0 bg-[#27272a] border border-white/10 rounded-lg -z-10 shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                {mode === 'side-by-side' ? 'Side by Side' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 relative shrink-0">
          <div className="flex items-center bg-black/40 border border-white/5 rounded-lg p-0.5">
            <button 
              onClick={() => setComparisonZoom(Math.max(0.05, comparisonZoom - 0.2))}
              className="w-8 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
            >
              <Minus size={14} />
            </button>
            
            <button
              onClick={() => setShowZoomMenu(!showZoomMenu)}
              className="px-3 h-7 text-xs font-mono font-bold hover:bg-white/10 rounded-md transition-colors flex items-center gap-1 min-w-[70px] justify-center"
            >
              {Math.round(comparisonZoom * 100)}%
              <ChevronDown size={12} className="opacity-50" />
            </button>
            
            <button 
              onClick={() => setComparisonZoom(Math.min(20, comparisonZoom + 0.2))}
              className="w-8 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          
          <AnimatePresence>
            {showZoomMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute top-full mt-2 right-0 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-1 w-32 z-50"
              >
                {[
                  { label: 'Fit', action: fitToScreen },
                  { label: '50%', action: () => setComparisonZoom(0.5) },
                  { label: '100%', action: () => setComparisonZoom(1) },
                  { label: '200%', action: () => setComparisonZoom(2) },
                  { label: '400%', action: () => setComparisonZoom(4) },
                  { label: '800%', action: () => setComparisonZoom(8) },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); setShowZoomMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* --- CANVAS WORKSPACE --- */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden outline-none ${isSpaceDown ? 'cursor-grab' : 'cursor-default'} ${isPanning ? 'cursor-grabbing' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDownLocal}
        onPointerMove={handlePointerMoveLocal}
        onPointerUp={handlePointerUpLocal}
        onPointerLeave={handlePointerUpLocal}
        onDoubleClick={handleDoubleClickLocal}
      >
        <canvas ref={canvasRef} className="absolute inset-0 touch-none pointer-events-none" />
        
        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {(!comparisonPreviewMode.includes('optimized') && comparisonPreviewMode !== 'difference' && comparisonPreviewMode !== 'overlay') || comparisonPreviewMode === 'split' || comparisonPreviewMode === 'side-by-side' ? (
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold shadow-lg text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Original • {formatFileSize(originalSize || 0)}
            </div>
          ) : null}
        </div>
        
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {comparisonPreviewMode !== 'original' ? (
            <div className="bg-blue-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/30 text-[10px] font-bold shadow-lg text-blue-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              {exportSettings.format.toUpperCase()} • {formatFileSize(optimizedSize || 0)}
            </div>
          ) : null}
        </div>

        {/* Loading overlay */}
        <AnimatePresence>
          {isGeneratingPreview && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <RotateCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <div className="bg-[#121212] px-4 py-2 rounded-full border border-white/10 text-xs font-semibold shadow-xl">
                {currentPreviewOp || "Optimizing..."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- BOTTOM STATUS BAR --- */}
      <div className="h-12 shrink-0 bg-[#121214] border-t border-white/5 flex items-center justify-between px-2 sm:px-4 z-10 gap-2">
        <div className="flex items-center gap-3 sm:gap-6 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-400 overflow-x-auto no-scrollbar min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <span className="text-slate-500 hidden sm:inline">Format</span>
            <span className="text-white font-mono">{exportSettings.format}</span>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <span className="text-slate-500 hidden sm:inline">Dimensions</span>
            <span className="text-white font-mono">
              {exportTarget === 'current' ? exportSettings.resize.width || artboardW : artboardW}×{exportTarget === 'current' ? exportSettings.resize.height || artboardH : artboardH}
            </span>
          </div>
          
          {originalSize && optimizedSize && originalSize > optimizedSize && (
            <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
              <span className="text-slate-500 hidden sm:inline">Savings</span>
              <span className="text-emerald-400 font-mono">
                {parseFloat(((originalSize - optimizedSize) / originalSize * 100).toFixed(1))}%
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <span className="text-slate-500 hidden sm:inline">PSNR</span>
            <span className="text-blue-400 font-mono">{psnr ? `${psnr.toFixed(1)} dB` : '-'}</span>
          </div>
        </div>
        
        <button 
          onClick={() => {
            handleExport();
          }}
          className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-5 py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 transition-colors active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.3)] whitespace-nowrap"
        >
          <Download size={14} /> <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
};
