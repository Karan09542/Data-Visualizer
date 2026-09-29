import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddToCanvasButton, canvasToBlob } from "../../../../utilities/AddToCanvasButton";
import { createPortal } from 'react-dom';
import { Eye, Frame, Image as ImageIcon, LayoutGrid, SlidersHorizontal, Wand2 } from 'lucide-react';
import { useStore } from '../../../../../store/useStore';
import { CameraCaptureModal } from '../../../../CameraCaptureModal';
import { DOCUMENT_PRESETS, PAPER_SIZES, type DocPresetKey, type PaperSizeKey } from './constants';
import type { ExportFormat, ImageFitMode, ImagePosition, Orientation, PhotoQueueItem } from './types';
import { setJpegDPI, setPngDPI } from './utils/dpiMetadata';
import { compressToTargetKB, computeSheetLayout, printImageViaIframe, renderPrintSheet } from './utils/printSheet';
import { useDimensionState } from './hooks/useDimensionState';
import { usePanZoom } from './hooks/usePanZoom';
import { useImageFilters } from './hooks/useImageFilters';
import { usePassportAI } from './hooks/usePassportAI';
import { StudioHeader } from './components/StudioHeader';
import { CapacitySummary } from './components/CapacitySummary';
import { SheetPreview } from './components/SheetPreview';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { DocumentSizeSection } from './sections/DocumentSizeSection';
import { PhotoQueueSection } from './sections/PhotoQueueSection';
import { AutoAdjustSection } from './sections/AutoAdjustSection';
import { PhotoFitSection } from './sections/PhotoFitSection';
import { FiltersSection } from './sections/FiltersSection';
import { FileSizeSection, ResolutionSection } from './sections/OutputSection';
import { PaperSection, SpacingSection } from './sections/PaperSection';
import { Segmented, cx } from './ui/primitives';

interface PassportPrintModalProps {
  sourceImage: string; // Data URL of the generated passport photo
  onClose: () => void;
  initialAutoAdjust?: boolean;
  /** Offer to put the finished sheet on the canvas as an image node. */
  showAddToCanvas?: boolean;
}

type SidebarTab = 'photo' | 'adjust' | 'layout' | 'output';

const SIDEBAR_TABS: { value: SidebarTab; label: React.ReactNode }[] = [
  { value: 'photo', label: <><ImageIcon size={13} />Photo</> },
  { value: 'adjust', label: <><Wand2 size={13} />Adjust</> },
  { value: 'layout', label: <><LayoutGrid size={13} />Layout</> },
  { value: 'output', label: <><Frame size={13} />Output</> },
];

export const PassportPrintModal: React.FC<PassportPrintModalProps> = ({ sourceImage, onClose, initialAutoAdjust = false, showAddToCanvas = false }) => {
  const appTheme = useStore((state) => state.appTheme);
  const setAppTheme = useStore((state) => state.setAppTheme);
  const isDark = appTheme === 'dark';

  // Paper & photo sizing
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('a4');
  const [docPreset, setDocPreset] = useState<DocPresetKey>('indian_passport');
  const paperDims = useDimensionState(210, 297);
  // Default to standard Indian Passport 35x45 mm
  const photoDims = useDimensionState(35, 45);
  const [orientation, setOrientation] = useState<Orientation>('portrait');

  // Photo Queue & Cell Overrides
  const [photoQueue, setPhotoQueue] = useState<PhotoQueueItem[]>([]);
  const [cellOverrides, setCellOverrides] = useState<Record<number, string>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [overrideTargetCell, setOverrideTargetCell] = useState<number | null>(null);

  // Spacing & Guidelines
  const [marginTop, setMarginTop] = useState(10);
  const [marginLeft, setMarginLeft] = useState(10);
  const [spacing, setSpacing] = useState(5);
  const [drawCropMarks, setDrawCropMarks] = useState(true);

  // Framing
  const [photoScale, setPhotoScale] = useState(100); // 70% - 130%
  const [imageFit, setImageFit] = useState<ImageFitMode>('cover');
  const [imagePosition, setImagePosition] = useState<ImagePosition>('center center');
  const filters = useImageFilters();

  // Output
  const [maxFileKB, setMaxFileKB] = useState<number>(0); // 0 = no limit
  const [printDPI, setPrintDPI] = useState<number>(300);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');

  // UI
  const [mobileTab, setMobileTab] = useState<'preview' | 'settings'>('preview');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('photo');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const view = usePanZoom(orientation);
  const ai = usePassportAI({ photoQueue, setPhotoQueue, initialAutoAdjust });

  const getCellImageSrc = useCallback((index: number): string | null => {
    if (cellOverrides[index]) return cellOverrides[index];
    let currentIndex = 0;
    for (const item of photoQueue) {
      if (index < currentIndex + item.quantity) {
        return item.src;
      }
      currentIndex += item.quantity;
    }
    return null;
  }, [cellOverrides, photoQueue]);

  const handleSelectDocPreset = (key: DocPresetKey) => {
    setDocPreset(key);
    if (key !== 'custom') {
      const preset = DOCUMENT_PRESETS[key];
      photoDims.applyPreset(preset.widthMM, preset.heightMM);
    }
  };

  const handleSelectPaperSize = (key: PaperSizeKey) => {
    setPaperSize(key);
    if (key !== 'custom') {
      const preset = PAPER_SIZES[key];
      paperDims.applyPreset(preset.width, preset.height);
    }
  };

  // Load unique images for rendering
  useEffect(() => {
    const uniqueSrcs = new Set<string>();
    photoQueue.forEach(p => uniqueSrcs.add(p.src));
    Object.values(cellOverrides).forEach(src => uniqueSrcs.add(src));

    uniqueSrcs.forEach(src => {
      if (!loadedImages[src]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setLoadedImages(prev => ({ ...prev, [src]: img }));
        img.src = src;
      }
    });
  }, [photoQueue, cellOverrides, loadedImages]);

  // Initialize initial photoQueue on mount/sourceImage change
  useEffect(() => {
    setPhotoQueue([{ id: 'initial-' + Date.now(), src: sourceImage, originalSrc: sourceImage, quantity: 20 }]); // maxCapacity handles clipping
    setCellOverrides({});
    ai.setHasAppliedAI(false);
  }, [sourceImage]);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  /** Runs AI (when enabled) on a new photo, then places it in the targeted cell or the queue. */
  const addPhotoFromDataUrl = async (dataUrl: string, quantityFor: (queueLength: number) => number) => {
    let newSrc = dataUrl;
    const original = newSrc;
    ai.setHasAppliedAI(false);

    if (ai.autoAdjust) {
      const aiResult = await ai.processPhotoWithAI(newSrc);
      if (aiResult) {
        newSrc = aiResult;
        ai.setHasAppliedAI(true);
      }
    }

    if (overrideTargetCell !== null) {
      setCellOverrides(prev => ({ ...prev, [overrideTargetCell]: newSrc }));
      setOverrideTargetCell(null);
    } else {
      setPhotoQueue(prev => [...prev, { id: Date.now().toString(), src: newSrc, originalSrc: original, quantity: quantityFor(prev.length) }]);
    }
  };

  // Handle adding photo file from device or dropzone
  const handlePhotoFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await addPhotoFromDataUrl(reader.result, (len) => len === 0 ? 8 : 1);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await addPhotoFromDataUrl(reader.result, () => 1);
      }
      setIsCameraOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePhotoFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = () => fileInputRef.current?.click();

  // Grid Layout Calculation (in MM)
  const layout = useMemo(() => computeSheetLayout({
    paperSize, docPreset, orientation,
    customPaperWMM: paperDims.wMM, customPaperHMM: paperDims.hMM,
    photoWMM: photoDims.wMM, photoHMM: photoDims.hMM,
    marginTop, marginLeft, spacing, photoQueue, cellOverrides,
  }), [paperSize, docPreset, marginTop, marginLeft, spacing, orientation, paperDims.wMM, paperDims.hMM, photoDims.wMM, photoDims.hMM, photoQueue, cellOverrides]);

  const generatePrintCanvas = () => renderPrintSheet({
    layout, dpi: printDPI, spacing, drawCropMarks, imageFit, imagePosition, photoScale,
    filterCss: filters.filterCss, getCellImageSrc, loadedImages,
  });

  const handleExportImage = async (format: ExportFormat = exportFormat) => {
    setExportFormat(format);
    const canvas = generatePrintCanvas();
    if (!canvas) return;

    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    let dataUrl = canvas.toDataURL(mimeType, 0.95);

    if (maxFileKB > 0 && format !== 'png') {
      const bestUrl = compressToTargetKB(canvas, mimeType, maxFileKB);
      if (bestUrl) {
        dataUrl = bestUrl;
      }
    }

    // Embed DPI resolution metadata into image headers for OS & Photoshop file details
    if (format === 'jpeg') {
      dataUrl = setJpegDPI(dataUrl, printDPI);
    } else if (format === 'png') {
      dataUrl = setPngDPI(dataUrl, printDPI);
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    const docLabel = docPreset === 'custom' ? `${layout.phWidth}x${layout.phHeight}mm` : DOCUMENT_PRESETS[docPreset].name.split(' ')[0];
    const kbLabel = maxFileKB > 0 ? `_${maxFileKB}kb` : '';
    link.download = `passport_studio_${docLabel}_${layout.activePhotoCount}photos_${printDPI}dpi${kbLabel}.${format}`;
    link.click();
  };

  const handleExportPDF = async () => {
    const canvas = generatePrintCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    printImageViaIframe(dataUrl, layout.pWidth, layout.pHeight);
  };

  const renderSidebarTab = () => {
    switch (sidebarTab) {
      case 'photo':
        return (
          <>
            <DocumentSizeSection docPreset={docPreset} onSelect={handleSelectDocPreset} photoDims={photoDims} />
            <PhotoQueueSection
              photoQueue={photoQueue}
              setPhotoQueue={setPhotoQueue}
              maxCapacity={layout.maxCapacity}
              onClearAll={() => { setPhotoQueue([]); setCellOverrides({}); }}
              onAddPhoto={() => { setOverrideTargetCell(null); openFilePicker(); }}
              onFileSelected={handlePhotoFileSelected}
            />
            <AutoAdjustSection ai={ai} photoQueue={photoQueue} />
          </>
        );
      case 'adjust':
        return (
          <>
            <PhotoFitSection
              photoScale={photoScale}
              setPhotoScale={setPhotoScale}
              imageFit={imageFit}
              setImageFit={setImageFit}
              imagePosition={imagePosition}
              setImagePosition={setImagePosition}
            />
            <FiltersSection filters={filters} />
          </>
        );
      case 'layout':
        return (
          <>
            <PaperSection
              paperSize={paperSize}
              onSelectPaperSize={handleSelectPaperSize}
              paperDims={paperDims}
              orientation={orientation}
              setOrientation={setOrientation}
              layout={layout}
            />
            <SpacingSection
              spacing={spacing} setSpacing={setSpacing}
              marginTop={marginTop} setMarginTop={setMarginTop}
              marginLeft={marginLeft} setMarginLeft={setMarginLeft}
              drawCropMarks={drawCropMarks} setDrawCropMarks={setDrawCropMarks}
            />
          </>
        );
      case 'output':
        return (
          <>
            <ResolutionSection printDPI={printDPI} setPrintDPI={setPrintDPI} layout={layout} />
            <FileSizeSection maxFileKB={maxFileKB} setMaxFileKB={setMaxFileKB} />
          </>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen max-h-screen flex flex-col overflow-hidden font-sans select-none touch-manipulation animate-in fade-in duration-200 bg-slate-100 text-slate-900 dark:bg-[#0B0B0C] dark:text-zinc-100">
      {/* Hidden file input for Upload Photo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        id="passport-studio-file-upload"
      />

      <StudioHeader
        isDark={isDark}
        printDPI={printDPI}
        exportFormat={exportFormat}
        onToggleTheme={() => setAppTheme(isDark ? 'light' : 'dark')}
        onOpenCamera={() => setIsCameraOpen(true)}
        onUpload={openFilePicker}
        onExport={handleExportImage}
        onPrint={handleExportPDF}
        onClose={onClose}
        extraActions={showAddToCanvas && (
          <AddToCanvasButton
            getImages={async () => {
              const canvas = generatePrintCanvas();
              if (!canvas) return null;
              const mime = exportFormat === "jpeg" ? "image/jpeg" : exportFormat === "webp" ? "image/webp" : "image/png";
              const blob = await canvasToBlob(canvas, mime, 0.95);
              const docLabel = docPreset === "custom" ? `${layout.phWidth}x${layout.phHeight}mm` : DOCUMENT_PRESETS[docPreset].name.split(" ")[0];
              return blob && { blob, name: `passport_${docLabel}_${layout.activePhotoCount}photos` };
            }}
            label="Canvas"
            compactLabel
            iconSize={15}
            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          />
        )}
      />

      {/* Mobile: switch between preview and controls */}
      <div className="sm:hidden shrink-0 px-3 py-2 border-b bg-white border-slate-200 dark:bg-[#111113] dark:border-white/[0.06]">
        <Segmented<'preview' | 'settings'>
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'preview', label: <><Eye size={13} />Preview</> },
            { value: 'settings', label: <><SlidersHorizontal size={13} />Controls</> },
          ]}
        />
      </div>

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <aside className={cx(
          'w-full sm:w-[340px] lg:w-[380px] shrink-0 flex-col overflow-hidden border-r z-10',
          'bg-white border-slate-200 dark:bg-[#111113] dark:border-white/[0.06]',
          mobileTab === 'settings' ? 'flex h-full' : 'hidden sm:flex',
        )}>
          <CapacitySummary layout={layout} />

          <div className="px-4 pt-3 pb-3 border-b border-slate-200 dark:border-white/[0.06]">
            <Segmented<SidebarTab> value={sidebarTab} onChange={setSidebarTab} options={SIDEBAR_TABS} size="sm" />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-50/60 dark:bg-transparent">
            {renderSidebarTab()}
          </div>
        </aside>

        <SheetPreview
          isDark={isDark}
          visible={mobileTab === 'preview'}
          layout={layout}
          view={view}
          orientation={orientation}
          printDPI={printDPI}
          spacing={spacing}
          drawCropMarks={drawCropMarks}
          imageFit={imageFit}
          imagePosition={imagePosition}
          photoScale={photoScale}
          filterCss={filters.filterCss}
          getCellImageSrc={getCellImageSrc}
          onReplaceCell={(cellIndex) => { setOverrideTargetCell(cellIndex); openFilePicker(); }}
          onFileSelected={handlePhotoFileSelected}
        />
      </div>

      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}

      {ai.isProcessingAI && <ProcessingOverlay status={ai.processingStatus} />}
    </div>,
    document.body
  );
};
