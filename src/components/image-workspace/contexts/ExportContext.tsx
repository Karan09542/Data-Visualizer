import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as fabric from 'fabric';
import { ExportController } from '../services/ExportController';
import { Artboard, ExportSettings } from '../../../types/export';

interface ExportContextValue {
   isExporting: boolean;
   exportSettings: ExportSettings;
   setExportSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
   handleExport: () => Promise<void>;
   initializeExport: (
      fabricRef: React.RefObject<fabric.Canvas | null>,
      artboards: Artboard[],
      activeArtboardId: string | null,
      activeTab: string | null
   ) => void;
   updateExportState: (
      artboards: Artboard[],
      activeArtboardId: string | null,
      activeTab: string | null
   ) => void;
   
   comparisonMode: boolean;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export function ExportProvider({ children }: { children: React.ReactNode }) {
   const [isExporting, setIsExporting] = useState(false);
   const [exportSettings, setExportSettings] = useState<ExportSettings>({
      format: "png",
      quality: 0.8,
      effort: 4,
      resize: { enabled: false, width: 1920, height: 1080 }
   });

   const [comparisonMode, setComparisonMode] = useState(false);
   const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
   const [optimizedImageUrl, setOptimizedImageUrl] = useState<string | null>(null);
   const [psnr, setPsnr] = useState<number | null>(null);
   const [originalSize, setOriginalSize] = useState<number | null>(null);
   const [optimizedSize, setOptimizedSize] = useState<number | null>(null);
   const [currentPreviewOp, setCurrentPreviewOp] = useState<string>("");
   const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
   const [originalPreviewDims, setOriginalPreviewDims] = useState<{w: number, h: number}>({w: 0, h: 0});
   const [optimizedPreviewDims, setOptimizedPreviewDims] = useState<{w: number, h: number}>({w: 0, h: 0});

   const stateRef = useRef({
      fabricRef: { current: null as fabric.Canvas | null } as React.RefObject<fabric.Canvas | null>,
      artboards: [] as Artboard[],
      activeArtboardId: null as string | null,
      activeTab: null as string | null,
   });

   const controller = useMemo(() => new ExportController(), []);

   const initializeExport = useCallback((
      fabricRef: React.RefObject<fabric.Canvas | null>,
      artboards: Artboard[],
      activeArtboardId: string | null,
      activeTab: string | null
   ) => {
      stateRef.current = { fabricRef, artboards, activeArtboardId, activeTab };
   }, []);

   const updateExportState = useCallback((
      artboards: Artboard[],
      activeArtboardId: string | null,
      activeTab: string | null
   ) => {
      stateRef.current = { ...stateRef.current, artboards, activeArtboardId, activeTab };
   }, []);

   const handleExport = async () => {
      const { fabricRef, artboards, activeArtboardId } = stateRef.current;
      if (!fabricRef.current || artboards.length === 0) return;
      setIsExporting(true);
      try {
         await controller.export(
            fabricRef.current,
            artboards,
            activeArtboardId,
            exportTarget,
            selectedExportIds,
            exportSettings
         );
      } catch (err: any) {
         console.error("Export Failed", err);
         alert(err.message || "Export Failed");
      } finally {
         setIsExporting(false);
      }
   };

   const generateLivePreview = async () => {
      const { fabricRef, artboards, activeArtboardId } = stateRef.current;
      if (!fabricRef.current || artboards.length === 0) return;
      
      setIsGeneratingPreview(true);
      try {
         const data = await controller.generateLivePreview(
            fabricRef.current,
            artboards,
            activeArtboardId,
            exportTarget,
            exportSettings,
            (op) => setCurrentPreviewOp(op)
         );
         
         if (data) {
            setOriginalImageUrl(data.originalUrl);
            setOptimizedImageUrl(prev => {
               if (prev) URL.revokeObjectURL(prev);
               return data.optimizedUrl;
            });
            setOriginalSize(data.origSize);
            setOptimizedSize(data.optSize);
            setPsnr(data.psnr);
            setOriginalPreviewDims({ w: data.origTargetW, h: data.origTargetH });
            setOptimizedPreviewDims({ w: data.optTargetW, h: data.optTargetH });
         }
      } catch (err: any) {
         console.error("Live comparison preview optimization failed:", err);
      } finally {
         setIsGeneratingPreview(false);
         setCurrentPreviewOp("");
      }
   };

   // Sync tab open/close to active comparison mode
   useEffect(() => {
      const activeTab = stateRef.current.activeTab;
      if (activeTab === "export") {
         setComparisonMode(true);
         generateLivePreview();
      } else {
         setComparisonMode(false);
      }
   }, [stateRef.current.activeTab]);

   // Debounced live regeneration hook responding to setting changes
   useEffect(() => {
      if (!comparisonMode) return;

      setCurrentPreviewOp("Throttling live settings changes...");
      const timer = setTimeout(() => {
         generateLivePreview();
      }, 250);

      return () => clearTimeout(timer);
   }, [
      comparisonMode,
      stateRef.current.activeArtboardId,
      exportTarget,
      exportSettings
   ]);

   const value: ExportContextValue = {
      exportTarget, setExportTarget,
      selectedExportIds, setSelectedExportIds,
      exportSettings, setExportSettings,
      isExporting, handleExport,
      
      comparisonMode, setComparisonMode,
      originalImageUrl, optimizedImageUrl,
      psnr, originalSize, optimizedSize,
      currentPreviewOp, isGeneratingPreview,
      originalPreviewDims, optimizedPreviewDims,
      generateLivePreview,
      initializeExport,
      updateExportState
   };

   return (
      <ExportContext.Provider value={value}>
         {children}
      </ExportContext.Provider>
   );
}

export function useExport() {
   const context = useContext(ExportContext);
   if (!context) {
      throw new Error("useExport must be used within a ExportProvider");
   }
   return context;
}
