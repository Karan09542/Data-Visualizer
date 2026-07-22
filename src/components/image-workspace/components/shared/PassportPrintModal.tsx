import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Download, Image as ImageIcon, Settings2, Grid2X2, 
  Lock, Unlock, RotateCw, ZoomIn, ZoomOut, Maximize2, AlertCircle, Sliders, Eye
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface PassportPrintModalProps {
  sourceImage: string; // Data URL of the generated passport photo
  onClose: () => void;
}

// 300 DPI conversion: pixels = (mm / 25.4) * 300
const MM_TO_PX = (mm: number) => Math.round((mm / 25.4) * 300);

const PAPER_SIZES = {
  a4: { name: 'A4 (210×297 mm)', width: 210, height: 297 },
  a5: { name: 'A5 (148×210 mm)', width: 148, height: 210 },
  letter: { name: 'Letter (8.5×11")', width: 215.9, height: 279.4 },
  legal: { name: 'Legal (8.5×14")', width: 215.9, height: 355.6 },
  r4x6: { name: '4×6" (10×15 cm)', width: 101.6, height: 152.4 },
  r5x7: { name: '5×7" (13×18 cm)', width: 127, height: 177.8 },
  custom: { name: 'Custom Paper Size', width: 210, height: 297 },
};

const PHOTO_SIZES = {
  passport_in: { name: 'Passport (35×45 mm)', width: 35, height: 45 },
  passport_us: { name: 'US Passport / Visa (51×51 mm)', width: 51, height: 51 },
  id_card: { name: 'ID Card (30×40 mm)', width: 30, height: 40 },
  wallet: { name: 'Wallet Size (64×89 mm)', width: 64, height: 89 },
  custom: { name: 'Custom Photo Size', width: 35, height: 45 },
};

export const PassportPrintModal: React.FC<PassportPrintModalProps> = ({ sourceImage, onClose }) => {
  const [paperSize, setPaperSize] = useState<keyof typeof PAPER_SIZES>('a4');
  const [photoSize, setPhotoSize] = useState<keyof typeof PHOTO_SIZES>('passport_in');
  
  const [customPaperW, setCustomPaperW] = useState(210);
  const [customPaperH, setCustomPaperH] = useState(297);
  const [lockPaperRatio, setLockPaperRatio] = useState(false);
  const [paperRatio, setPaperRatio] = useState(210 / 297);

  const [customPhotoW, setCustomPhotoW] = useState(35);
  const [customPhotoH, setCustomPhotoH] = useState(45);
  const [lockPhotoRatio, setLockPhotoRatio] = useState(false);
  const [photoRatio, setPhotoRatio] = useState(35 / 45);

  const [marginTop, setMarginTop] = useState(10);
  const [marginLeft, setMarginLeft] = useState(10);
  const [spacing, setSpacing] = useState(5);
  const [drawCropMarks, setDrawCropMarks] = useState(true);
  
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Mobile View Toggle: 'preview' | 'settings'
  const [mobileTab, setMobileTab] = useState<'preview' | 'settings'>('preview');
  
  // Preview Zoom Scale
  const [zoomLevel, setZoomLevel] = useState(100);

  // Handle custom paper size switches
  const handleSelectPaperSize = (key: keyof typeof PAPER_SIZES) => {
    setPaperSize(key);
    if (key !== 'custom') {
      const preset = PAPER_SIZES[key];
      setCustomPaperW(preset.width);
      setCustomPaperH(preset.height);
      setPaperRatio(preset.width / preset.height);
    }
  };

  // Handle custom photo size switches
  const handleSelectPhotoSize = (key: keyof typeof PHOTO_SIZES) => {
    setPhotoSize(key);
    if (key !== 'custom') {
      const preset = PHOTO_SIZES[key];
      setCustomPhotoW(preset.width);
      setCustomPhotoH(preset.height);
      setPhotoRatio(preset.width / preset.height);
    }
  };

  const handlePaperWChange = (val: number) => {
    const safeW = Math.max(1, val);
    setCustomPaperW(safeW);
    if (lockPaperRatio && paperRatio) {
      setCustomPaperH(Math.round((safeW / paperRatio) * 10) / 10);
    }
  };

  const handlePaperHChange = (val: number) => {
    const safeH = Math.max(1, val);
    setCustomPaperH(safeH);
    if (lockPaperRatio && paperRatio) {
      setCustomPaperW(Math.round((safeH * paperRatio) * 10) / 10);
    }
  };

  const togglePaperLock = () => {
    if (!lockPaperRatio) setPaperRatio(customPaperW / (customPaperH || 1));
    setLockPaperRatio(!lockPaperRatio);
  };

  const handlePhotoWChange = (val: number) => {
    const safeW = Math.max(1, val);
    setCustomPhotoW(safeW);
    if (lockPhotoRatio && photoRatio) {
      setCustomPhotoH(Math.round((safeW / photoRatio) * 10) / 10);
    }
  };

  const handlePhotoHChange = (val: number) => {
    const safeH = Math.max(1, val);
    setCustomPhotoH(safeH);
    if (lockPhotoRatio && photoRatio) {
      setCustomPhotoW(Math.round((safeH * photoRatio) * 10) / 10);
    }
  };

  const togglePhotoLock = () => {
    if (!lockPhotoRatio) setPhotoRatio(customPhotoW / (customPhotoH || 1));
    setLockPhotoRatio(!lockPhotoRatio);
  };

  // Load the source image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImageObj(img);
    img.src = sourceImage;
  }, [sourceImage]);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Grid Calculation (in mm)
  const layout = useMemo(() => {
    const pWBase = paperSize === 'custom' ? (customPaperW || 210) : PAPER_SIZES[paperSize].width;
    const pHBase = paperSize === 'custom' ? (customPaperH || 297) : PAPER_SIZES[paperSize].height;

    const pWidth = orientation === 'portrait' ? pWBase : pHBase;
    const pHeight = orientation === 'portrait' ? pHBase : pWBase;
    
    const phWidth = photoSize === 'custom' ? (customPhotoW || 35) : PHOTO_SIZES[photoSize].width;
    const phHeight = photoSize === 'custom' ? (customPhotoH || 45) : PHOTO_SIZES[photoSize].height;

    // Available space
    const availWidth = Math.max(0, pWidth - (marginLeft * 2));
    const availHeight = Math.max(0, pHeight - (marginTop * 2));

    // How many can fit?
    let cols = phWidth > 0 ? Math.floor((availWidth + spacing) / (phWidth + spacing)) : 0;
    let rows = phHeight > 0 ? Math.floor((availHeight + spacing) / (phHeight + spacing)) : 0;

    cols = Math.max(0, cols);
    rows = Math.max(0, rows);

    // Center grid inside paper
    const consumedWidth = (cols * phWidth) + Math.max(0, cols - 1) * spacing;
    const consumedHeight = (rows * phHeight) + Math.max(0, rows - 1) * spacing;
    
    const actualMarginLeft = marginLeft + Math.max(0, (availWidth - consumedWidth) / 2);
    const actualMarginTop = marginTop + Math.max(0, (availHeight - consumedHeight) / 2);

    return { pWidth, pHeight, phWidth, phHeight, cols, rows, actualMarginLeft, actualMarginTop };
  }, [paperSize, photoSize, marginTop, marginLeft, spacing, orientation, customPaperW, customPaperH, customPhotoW, customPhotoH]);

  const generatePrintCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!imageObj || layout.cols === 0 || layout.rows === 0) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas to 300 DPI size
    canvas.width = MM_TO_PX(layout.pWidth);
    canvas.height = MM_TO_PX(layout.pHeight);

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = MM_TO_PX(layout.actualMarginLeft);
    const startY = MM_TO_PX(layout.actualMarginTop);
    const pW = MM_TO_PX(layout.phWidth);
    const pH = MM_TO_PX(layout.phHeight);
    const gap = MM_TO_PX(spacing);

    // Draw photos and crop marks
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const x = startX + c * (pW + gap);
        const y = startY + r * (pH + gap);

        // Draw Image
        ctx.drawImage(imageObj, x, y, pW, pH);

        // Draw stroke around image to help cutting if requested
        if (drawCropMarks) {
          ctx.strokeStyle = '#D1D5DB'; // Light gray outline
          ctx.lineWidth = MM_TO_PX(0.5); // 0.5mm line
          ctx.strokeRect(x, y, pW, pH);
        }
      }
    }

    return canvas;
  };

  const handleExportPNG = async () => {
    const canvas = await generatePrintCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = dataUrl;
    const sizeLabel = paperSize === 'custom' ? `${layout.pWidth}x${layout.pHeight}mm` : PAPER_SIZES[paperSize].name.split(' ')[0];
    link.download = `print_sheet_${sizeLabel}_${layout.cols * layout.rows}photos.png`;
    link.click();
  };

  const handleExportPDF = async () => {
    const canvas = await generatePrintCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    // Create an invisible iframe to print from
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <style>
            @page {
              size: ${layout.pWidth}mm ${layout.pHeight}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              width: ${layout.pWidth}mm;
              height: ${layout.pHeight}mm;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
  };

  const totalPhotos = layout.rows * layout.cols;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-[#0A0A0A] text-white flex flex-col h-[100dvh] w-full overflow-hidden font-sans select-none animate-in fade-in duration-200">
      
      {/* Studio Top Header Navigation */}
      <header className="h-14 sm:h-16 border-b border-[#222] bg-[#111111] px-2 sm:px-6 flex items-center justify-between shrink-0 z-20 shadow-md">
        
        {/* Left: Branding & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-lg sm:rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
            <Printer size={18} className="sm:w-[20px] sm:h-[20px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-base font-bold text-white tracking-tight truncate">
                <span className="sm:hidden">Print Sheet</span>
                <span className="hidden sm:inline">Print Sheet Studio</span>
              </h1>
              <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full shrink-0">
                300 DPI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden lg:block truncate">Commercial passport photo printing & grid layout engine</p>
          </div>
        </div>

        {/* Right: Action Controls */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button
            onClick={handleExportPNG}
            title="Export High-Res PNG"
            className="flex items-center gap-1 sm:gap-1.5 bg-[#1C1C1C] hover:bg-[#282828] border border-[#333] text-white p-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 shadow-sm"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export PNG</span>
          </button>

          <button
            onClick={handleExportPDF}
            title="Print or Save PDF"
            className="flex items-center gap-1 sm:gap-1.5 bg-blue-600 hover:bg-blue-500 text-white p-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print / Save PDF</span>
          </button>

          <div className="w-px h-5 sm:h-6 bg-[#2B2B2B] mx-0.5 sm:mx-1" />

          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-[#222] rounded-lg sm:rounded-xl transition-colors shrink-0"
            title="Exit Studio"
          >
            <X size={18} className="sm:w-[20px] sm:h-[20px]" />
          </button>
        </div>
      </header>

      {/* Dedicated Mobile Tab Switcher Bar */}
      <div className="flex sm:hidden items-center justify-center p-2 border-b border-[#222] bg-[#141414] shrink-0 z-10">
        <div className="flex items-center bg-[#1F1F1F] p-1 rounded-xl border border-[#2D2D2D] w-full max-w-[280px]">
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${mobileTab === 'preview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Eye size={13} /> Preview Canvas
          </button>
          <button
            onClick={() => setMobileTab('settings')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${mobileTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Sliders size={13} /> Layout Settings
          </button>
        </div>
      </div>

      {/* Main Studio Workspace Split */}
      <div className="flex-1 flex overflow-hidden relative bg-[#090909]">

        {/* Left Sidebar: Controls & Inspector (Hidden on mobile if preview tab active) */}
        <aside className={`w-full sm:w-80 md:w-96 border-r border-[#222] bg-[#0F0F0F] flex flex-col shrink-0 overflow-hidden transition-all z-10 ${mobileTab === 'settings' ? 'block' : 'hidden sm:flex'}`}>
          
          {/* Photos Fit Indicator Bar */}
          <div className="p-4 border-b border-[#222] bg-[#141414]">
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${totalPhotos > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${totalPhotos > 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                  <Grid2X2 size={20} />
                </div>
                <div>
                  <div className="text-xl font-black tracking-tight flex items-baseline gap-1.5">
                    {totalPhotos}
                    <span className="text-xs font-normal opacity-80">photos fit</span>
                  </div>
                  <div className="text-[11px] opacity-75 font-medium">
                    {layout.cols} cols × {layout.rows} rows grid
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] font-mono opacity-80">
                {layout.phWidth}×{layout.phHeight}mm
              </div>
            </div>

            {totalPhotos === 0 && (
              <div className="mt-2.5 text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20">
                <AlertCircle size={14} className="shrink-0" />
                <span>Dimensions or margins exceed available paper space.</span>
              </div>
            )}
          </div>

          {/* Scrollable Settings Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
            
            {/* Paper Settings Group */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 size={13} /> Paper Format
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {layout.pWidth} × {layout.pHeight} mm
                </span>
              </div>

              <div className="space-y-2">
                <CustomSelect 
                  value={paperSize} 
                  onChange={handleSelectPaperSize} 
                  options={Object.entries(PAPER_SIZES).map(([k, v]) => ({ value: k, label: v.name }))} 
                />

                {paperSize === 'custom' && (
                  <div className="p-3 bg-[#161616] border border-[#2B2B2B] rounded-xl space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                    <div className="text-[11px] font-semibold text-slate-300">Custom Paper Dimensions</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Width (mm)</label>
                        <input 
                          type="number" min="20" max="1000" 
                          value={customPaperW} 
                          onChange={e => handlePaperWChange(Number(e.target.value))} 
                          className="w-full bg-[#202020] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono transition-colors"
                        />
                      </div>
                      
                      <button 
                        onClick={togglePaperLock} 
                        title={lockPaperRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'} 
                        className={`p-2 mt-4 rounded-lg border transition-all ${lockPaperRatio ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-[#202020] border-[#333] text-slate-400 hover:text-white'}`}
                      >
                        {lockPaperRatio ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Height (mm)</label>
                        <input 
                          type="number" min="20" max="1000" 
                          value={customPaperH} 
                          onChange={e => handlePaperHChange(Number(e.target.value))} 
                          className="w-full bg-[#202020] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Orientation Selector */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${orientation === 'portrait' ? 'bg-blue-600/15 border-blue-500/40 text-blue-400' : 'bg-[#161616] border-[#262626] text-slate-400 hover:text-white'}`}
                  >
                    <div className="w-3 h-4 border-2 border-current rounded-sm" />
                    Portrait
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${orientation === 'landscape' ? 'bg-blue-600/15 border-blue-500/40 text-blue-400' : 'bg-[#161616] border-[#262626] text-slate-400 hover:text-white'}`}
                  >
                    <div className="w-4 h-3 border-2 border-current rounded-sm" />
                    Landscape
                  </button>
                </div>
              </div>
            </section>

            <div className="w-full h-px bg-[#222]" />

            {/* Photo Format Settings Group */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={13} /> Photo Target Size
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {layout.phWidth} × {layout.phHeight} mm
                </span>
              </div>

              <div className="space-y-2">
                <CustomSelect 
                  value={photoSize} 
                  onChange={handleSelectPhotoSize} 
                  options={Object.entries(PHOTO_SIZES).map(([k, v]) => ({ value: k, label: v.name }))} 
                />

                {photoSize === 'custom' && (
                  <div className="p-3 bg-[#161616] border border-[#2B2B2B] rounded-xl space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                    <div className="text-[11px] font-semibold text-slate-300">Custom Photo Dimensions</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Width (mm)</label>
                        <input 
                          type="number" min="5" max="300" 
                          value={customPhotoW} 
                          onChange={e => handlePhotoWChange(Number(e.target.value))} 
                          className="w-full bg-[#202020] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono transition-colors"
                        />
                      </div>
                      
                      <button 
                        onClick={togglePhotoLock} 
                        title={lockPhotoRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'} 
                        className={`p-2 mt-4 rounded-lg border transition-all ${lockPhotoRatio ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-[#202020] border-[#333] text-slate-400 hover:text-white'}`}
                      >
                        {lockPhotoRatio ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Height (mm)</label>
                        <input 
                          type="number" min="5" max="300" 
                          value={customPhotoH} 
                          onChange={e => handlePhotoHChange(Number(e.target.value))} 
                          className="w-full bg-[#202020] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="w-full h-px bg-[#222]" />

            {/* Layout Spacing & Margins */}
            <section className="space-y-3">
              <h2 className="text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wider flex items-center gap-1.5">
                <Grid2X2 size={13} /> Margins & Spacing (mm)
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Photo Gap</label>
                  <input 
                    type="number" min="0" max="50" 
                    value={spacing} 
                    onChange={e => setSpacing(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#161616] border border-[#2B2B2B] rounded-xl px-2.5 py-2 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Top Margin</label>
                  <input 
                    type="number" min="0" max="100" 
                    value={marginTop} 
                    onChange={e => setMarginTop(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#161616] border border-[#2B2B2B] rounded-xl px-2.5 py-2 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400">Side Margin</label>
                  <input 
                    type="number" min="0" max="100" 
                    value={marginLeft} 
                    onChange={e => setMarginLeft(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#161616] border border-[#2B2B2B] rounded-xl px-2.5 py-2 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Crop Mark Toggle */}
              <div 
                className="flex items-center justify-between p-3 bg-[#161616] border border-[#2B2B2B] rounded-xl cursor-pointer hover:bg-[#1F1F1F] transition-colors"
                onClick={() => setDrawCropMarks(!drawCropMarks)}
              >
                <span className="text-xs font-medium text-slate-200">Draw Cut Guidelines</span>
                <div className={`relative w-[34px] h-[18px] rounded-full transition-colors duration-200 ${drawCropMarks ? 'bg-blue-600' : 'bg-[#333]'}`}>
                  <div className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200 shadow ${drawCropMarks ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                </div>
              </div>
            </section>

          </div>
        </aside>

        {/* Right Canvas Area: Center interactive view (Hidden on mobile if settings tab active) */}
        <main className={`flex-1 flex-col relative bg-[#090909] overflow-hidden ${mobileTab === 'preview' ? 'flex' : 'hidden sm:flex'}`}>
          
          {/* Top Canvas Toolbar */}
          <div className="h-10 border-b border-[#1F1F1F] bg-[#0D0D0D] px-4 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200">Paper Canvas View</span>
              <span className="text-[10px] font-mono bg-[#1A1A1A] px-2 py-0.5 rounded border border-[#2A2A2A]">
                {layout.pWidth} × {layout.pHeight} mm ({orientation})
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(40, prev - 15))}
                className="p-1 hover:bg-[#202020] hover:text-white rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] font-mono w-10 text-center">{zoomLevel}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
                className="p-1 hover:bg-[#202020] hover:text-white rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button 
                onClick={() => setZoomLevel(100)}
                className="p-1 hover:bg-[#202020] hover:text-white rounded transition-colors"
                title="Reset Zoom to Fit"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* Interactive Workspace Canvas Centering Area */}
          <div className="flex-1 relative flex items-center justify-center p-4 sm:p-10 overflow-auto bg-[#080808]">
            {/* Grid dot pattern background */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.15]" 
              style={{ 
                backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', 
                backgroundSize: '24px 24px' 
              }} 
            />

            {/* Paper Sheet Preview Element */}
            <div 
              className="relative bg-white shadow-2xl transition-all duration-200 shrink-0"
              style={{ 
                aspectRatio: `${layout.pWidth} / ${layout.pHeight}`,
                // Dynamic scaling based on viewport size and user zoom
                maxHeight: `${78 * (zoomLevel / 100)}vh`,
                maxWidth: `${85 * (zoomLevel / 100)}%`,
                height: `${78 * (zoomLevel / 100)}vh`,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
              }}
            >
              {/* Photos rendering */}
              {Array.from({ length: layout.rows }).map((_, r) => (
                Array.from({ length: layout.cols }).map((_, c) => {
                  const left = layout.actualMarginLeft + c * (layout.phWidth + spacing);
                  const top = layout.actualMarginTop + r * (layout.phHeight + spacing);
                  return (
                    <div 
                      key={`${r}-${c}`}
                      className="absolute transition-all duration-150 overflow-hidden"
                      style={{
                        left: `${(left / layout.pWidth) * 100}%`,
                        top: `${(top / layout.pHeight) * 100}%`,
                        width: `${(layout.phWidth / layout.pWidth) * 100}%`,
                        height: `${(layout.phHeight / layout.pHeight) * 100}%`,
                        backgroundImage: imageObj ? `url(${imageObj.src})` : 'none',
                        backgroundSize: '100% 100%',
                        border: drawCropMarks ? '0.5px solid rgba(0,0,0,0.15)' : 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                      }}
                    >
                      {!imageObj && (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                  );
                })
              ))}

              {/* Crop guideline corners for full sheet */}
              {drawCropMarks && totalPhotos > 0 && (
                <div className="absolute inset-0 pointer-events-none border border-slate-300/40 border-dashed" />
              )}
            </div>

          </div>

          {/* Bottom Footer Info Bar */}
          <footer className="h-8 border-t border-[#1F1F1F] bg-[#0D0D0D] px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0 font-mono">
            <div>
              Grid: {layout.cols} × {layout.rows} | Margins: Top {marginTop}mm, Side {marginLeft}mm
            </div>
            <div>
              Output: {MM_TO_PX(layout.pWidth)} × {MM_TO_PX(layout.pHeight)} px @ 300 DPI
            </div>
          </footer>
        </main>

      </div>
    </div>,
    document.body
  );
};
