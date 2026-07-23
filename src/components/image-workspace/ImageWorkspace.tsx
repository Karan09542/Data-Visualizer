import { ExportLiveComparisonViewer } from '../export/ExportLiveComparisonViewer';
import { WorkspaceHeader } from './components/layout/WorkspaceHeader';
import { LeftToolbar } from './components/layout/LeftToolbar';
import { PropertiesTab } from './components/panels/PropertiesTab';
import { ArtboardsTab } from './components/panels/ArtboardsTab';
import { HistoryProvider } from './contexts/HistoryContext';
import { WorkspaceUIProvider } from './contexts/WorkspaceUIContext';
import { LayersProvider } from './contexts/LayersContext';
import { LayersTab } from './components/panels/LayersTab';
import { ToolProvider } from './contexts/ToolContext';
import { CanvasProvider } from './contexts/CanvasContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { AIProvider } from './contexts/AIContext';
import { AIToolsPanel } from './components/panels/AIToolsPanel';
import { AIProgressModal } from './components/shared/AIProgressModal';
import { ARTBOARD_PRESETS } from './types/artboards';
import { useArtboardState } from "./hooks/useArtboardState";
import { useShapePropertiesState, ShapePropertiesProvider } from "./hooks/useShapeProperties";
import { useCollageConfigState, CollageConfigProvider } from "./hooks/useCollageConfig";
import { ColorPickerPortal, ColorPickerTrigger } from "./components/shared/ColorPickers";
import { TabBtn } from "./components/shared/TabBtn";
import { ToolBtn } from "./components/shared/ToolBtn";
import { ContextMenuItem } from "./components/shared/ContextMenuItem";
import { ModernCheckbox } from "./components/shared/ModernCheckbox";
import { dataURLtoFile } from "./utils/file";
import { BrushPreview } from "./components/panels/BrushPreview";
import { ObjectDimensionsPanel } from "./components/panels/ObjectDimensionsPanel";
import { formatFileSize } from "../../lib/formatFileSize";
import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as fabric from "fabric";
import { loadFromDexie, saveToDexie } from "../../utils/fabricDexieSync";
import { useStore } from "../../store/useStore";
import { resolveAssetUrl, importFile } from "../../utils/assetManager";
import { getValueAtPath } from "../../utils/pathUtils";
import {
   Type, Upload, Download, Undo, Redo,
   Layers, MousePointer2, Brush, Circle, Square, Minus, Triangle, Edit2, RotateCw, RotateCcw, Image as ImageIcon,
   SquareDashed, X, Crop, History, Settings, Trash2, Copy, Move, FlipHorizontal, FlipVertical, BringToFront, SendToBack, ArrowUp, ArrowDown,
   Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline,
   Sparkles, ChevronUp, ChevronDown, Plus, Power, Activity, Bookmark, Sliders, Check, Grid, Expand, Maximize, Focus, Target,
   AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
   Pipette, Star, MoreHorizontal, Hand, LayoutGrid, ZoomIn, ChevronLeft, Droplets, Image as LucideImage, Layout, Printer, Palette, Settings2, FileText, Instagram, ShoppingBag, Images, Info, Keyboard, Clipboard, Library, Link,
   Zap
} from "lucide-react";
import JSZip from "jszip";
import { RgbaStringColorPicker } from "react-colorful";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ImageWorker from "../../utils/imageWorker?worker";
import { ExportSettings, DEFAULT_EXPORT_SETTINGS } from "../../types/export";
import { FontPicker } from "../FontPicker";
import { TypographyPresets } from "../TypographyPresets";
import { ExportStudio } from "../export/ExportStudio";
import { PRESET_REGISTRY, getDimensionsInPixels, ImagePreset, PresetCategory } from "../../lib/imagePresets";
import { useImageImport } from "../image-import/hooks/useImageImport";
import { processPasteEvent } from "../image-import/clipboard/clipboardImporter";
import { AssetGallery } from "../image-import/gallery/AssetGallery";

import './fabric/overrides';

import { isPngInitialised, isResizeInitialised, isJpegInitialised, isWebpInitialised, isAvifInitialised, loadWasmModule, hasSimd, hasThreads, pngWasmUrl, jpegWasmUrl, webpWasmUrl, webpSimdWasmUrl, avifWasmUrl, avifMtWasmUrl, resizeWasmUrl, jxlWasmUrl } from "./services/export/jsquash";


interface ImageWorkspaceProps {
   path: string;
}

import { setOpacityOnHex } from "./utils/color";


import { getBrushName, createPatternSource } from "./fabric/brushes";


// ==========================================
// Command Architecture Interfaces & Classes
// ==========================================
import { Command } from "./commands/base/Command";


import { MacroCommand } from "./commands/base/MacroCommand";


import { AddObjectCommand } from "./commands/object/AddObjectCommand";


import { DeleteObjectCommand } from "./commands/object/DeleteObjectCommand";


import { TransformObjectsCommand } from "./commands/object/TransformCommand";


import { PropertyChangeCommand } from "./commands/object/PropertyCommand";


import { StyleChangeCommand } from "./commands/object/StyleChangeCommand";


import { LayerReorderCommand } from "./commands/layer/LayerReorderCommand";


import { FilterChangeCommand } from "./commands/filter/FilterChangeCommand";


import { FilterConfig } from "./types/filters";


import { rebuildFabricFilters } from "./services/filters/rebuildFabricFilters";


import { FilterPipelineCommand } from "./commands/filter/FilterPipelineCommand";



import { Artboard } from "./types/artboards";


import { ArtboardStateCommand } from "./commands/artboard/ArtboardStateCommand";


import { DuplicateArtboardCommand } from "./commands/artboard/DuplicateArtboardCommand";


import { DeleteArtboardCommand } from "./commands/artboard/DeleteArtboardCommand";


import { ArtboardPropertyCommand } from "./commands/artboard/ArtboardPropertyCommand";
import { FilterStudioTab } from './components/panels/FilterStudioTab';
import { QuickActionsTab } from './components/panels/QuickActionsTab';


// Modern Checkbox Component
interface ImageWorkspaceProps {
   path: string;
}

// TODO(Refactor): Extract hooks, leaving only the main orchestration here
export default function ImageWorkspace({ path }: ImageWorkspaceProps) {
   console.log('[ImageWorkspace] Component rendering, path:', path);
   const { parsedData, updateNodeValue, setNotification } = useStore();
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const fabricRef = useRef<fabric.Canvas | null>(null);
   const containerRef = useRef<HTMLDivElement>(null);

   // Artboards State
   const {
      artboards, setArtboards,
      isLoaded, setIsLoaded,
      activeArtboardId, setActiveArtboardId
   } = useArtboardState(path);

   // Collage configurations
   const collageProps = useCollageConfigState();
   const {
      collagePaddingPercent, setCollagePaddingPercent,
      collageGapPercent, setCollageGapPercent,
      collageBgColor, setCollageBgColor,
      collageBorderColor, setCollageBorderColor,
      collageBorderWidth, setCollageBorderWidth,
      collageCornerRadius, setCollageCornerRadius,
      useIndividualCorners, setUseIndividualCorners,
      collageCornerTL, setCollageCornerTL,
      collageCornerTR, setCollageCornerTR,
      collageCornerBR, setCollageCornerBR,
      collageCornerBL, setCollageCornerBL,
      collageBorderStyle, setCollageBorderStyle
   } = collageProps;

   // Shape Properties states
   const shapeProps = useShapePropertiesState();
   const {
      shapeFillColor, setShapeFillColor,
      shapeStrokeColor, setShapeStrokeColor,
      shapeStrokeWidth, setShapeStrokeWidth,
      shapeBorderStyle, setShapeBorderStyle,
      shapeCornerRadius, setShapeCornerRadius,
      shapeUseIndividualCorners, setShapeUseIndividualCorners,
      shapeCornerTL, setShapeCornerTL,
      shapeCornerTR, setShapeCornerTR,
      shapeCornerBL, setShapeCornerBL,
      shapeCornerBR, setShapeCornerBR,
      shapeOpacity, setShapeOpacity,
      shapeBlendMode, setShapeBlendMode,
      shapeStrokeLineJoin, setShapeStrokeLineJoin,
      shapeStrokeLineCap, setShapeStrokeLineCap
   } = shapeProps;

   const [zoomPercent, setZoomPercent] = useState(100);
   const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
   const [snapTolerance, setSnapTolerance] = useState(10);
   const [isCropping, setIsCropping] = useState(false);
   const cropSessionRef = useRef<{
      origObj: fabric.Image | null;
      fullImg: fabric.Image | null;
      cropRect: fabric.Rect | null;
      dimRect: fabric.Rect | null;
   }>({ origObj: null, fullImg: null, cropRect: null, dimRect: null });
   const [activeContextMenu, setActiveContextMenu] = useState<{
      x: number;
      y: number;
      obj: fabric.Object | null;
      targets: fabric.Object[];
   } | null>(null);
   const contextMenuRef = useRef<HTMLDivElement>(null);
   const [showShortcuts, setShowShortcuts] = useState(false);

   useLayoutEffect(() => {
      if (activeContextMenu && contextMenuRef.current) {
         const el = contextMenuRef.current;
         const rect = el.getBoundingClientRect();
         const padding = 8;

         let newX = activeContextMenu.x;
         let newY = activeContextMenu.y;

         if (newX + rect.width > window.innerWidth) {
            newX = window.innerWidth - rect.width - padding;
         }
         if (newY + rect.height > window.innerHeight) {
            newY = window.innerHeight - rect.height - padding;
         }

         // additional check in case menu is huge
         if (newX < padding) newX = padding;
         if (newY < padding) newY = padding;

         el.style.left = `${newX}px`;
         el.style.top = `${newY}px`;
         el.style.visibility = 'visible';
      }
   }, [activeContextMenu]);

   const [artboardDropdown, setArtboardDropdown] = useState<{ id: string, x: number, y: number } | null>(null);
   const [renamingArtboard, setRenamingArtboard] = useState<{ id: string; name: string } | null>(null);
   const [isAltPressed, setIsAltPressed] = useState(false);
   const [isShiftPressed, setIsShiftPressed] = useState(false);
   const [isCtrlPressed, setIsCtrlPressed] = useState(false);
   const [isSpacePressed, setIsSpacePressed] = useState(false);
   const [guides, setGuides] = useState<{ type: 'v' | 'h'; pos: number }[]>([]);
   const [exportTarget, setExportTarget] = useState<"current" | "selected" | "all">("current");
   const [selectedExportIds, setSelectedExportIds] = useState<Record<string, boolean>>(() => ({
      "artboard_default": true
   }));
   const [selectionType, setSelectionType] = useState<string | null>(null);
   const [parentAlignmentObj, setParentAlignmentObj] = useState<fabric.Object | null>(null);
   const parentAlignmentObjRef = useRef<fabric.Object | null>(null);

   const getAbsoluteBoundingRect = (obj: fabric.Object) => {
      if (!obj.group) {
         return (obj as any).getBoundingRect();
      }
      const halfWidth = (obj.width || 0) / 2;
      const halfHeight = (obj.height || 0) / 2;
      const localCorners = [
         new fabric.Point(-halfWidth, -halfHeight),
         new fabric.Point(halfWidth, -halfHeight),
         new fabric.Point(halfWidth, halfHeight),
         new fabric.Point(-halfWidth, halfHeight)
      ];
      const matrix = obj.calcTransformMatrix();
      const worldCorners = localCorners.map(corner =>
         fabric.util.transformPoint(corner, matrix)
      );
      const xs = worldCorners.map(p => p.x);
      const ys = worldCorners.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
         left: minX,
         top: minY,
         width: maxX - minX,
         height: maxY - minY
      };
   };

   const artboardsRef = useRef(artboards);
   const activeArtboardIdRef = useRef(activeArtboardId);
   const viewportTransformRef = useRef<number[]>([1, 0, 0, 1, 0, 0] as any);

   // Mobile / Responsive states (Moved to top of component)
   const [isMobile, setIsMobile] = useState(false);
   const isMobileRef = useRef(false);
   const [showMobilePanel, setShowMobilePanel] = useState(false);
   const [mobilePanelHeight, setMobilePanelHeight] = useState(40); // Percentage of screen height


   const [showMobileArtboardsGallery, setShowMobileArtboardsGallery] = useState(false);
   const [showMobileToolbox, setShowMobileToolbox] = useState(false);
   const [showMobileDiagnosticsSheet, setShowMobileDiagnosticsSheet] = useState(false);
   const [showAdvancedMobileExport, setShowAdvancedMobileExport] = useState(false);
   const [mobileSettingsTab, setMobileSettingsTab] = useState<'format' | 'resize' | 'metadata'>('format');
   const [showMobileCompareSwitcher, setShowMobileCompareSwitcher] = useState(false);

   useEffect(() => {
      const handleResize = () => {
         const m = window.innerWidth < 768;
         setIsMobile(m);
         isMobileRef.current = m;
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
   }, []);

   React.useLayoutEffect(() => {
      artboardsRef.current = artboards;
      if (fabricRef.current) {
         fabricRef.current.requestRenderAll();
      }
   }, [artboards]);

   useEffect(() => {
      activeArtboardIdRef.current = activeArtboardId;
   }, [activeArtboardId]);

   useEffect(() => {
      if (artboards.length > 0 && !artboards.find(b => b.id === activeArtboardId)) {
         setActiveArtboardId(artboards[0].id);
      }
   }, [artboards, activeArtboardId]);

   useEffect(() => {
      if (isLoaded && fabricRef.current) {
         saveToDexie(path, artboards, fabricRef.current).catch(err => {
            console.error("Failed to save artboards to dexie:", err);
         });
      }
   }, [artboards, path, isLoaded]);


   const fitView = useCallback(() => {
      if (!fabricRef.current || artboardsRef.current.length === 0) return;
      const canvas = fabricRef.current;

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      const boards = isMobileRef.current
         ? artboardsRef.current.filter(b => b.id === activeArtboardIdRef.current)
         : artboardsRef.current;
      const activeBoardsToFit = boards.length > 0 ? boards : [artboardsRef.current[0]];

      activeBoardsToFit.forEach(b => {
         minX = Math.min(minX, b.x);
         minY = Math.min(minY, b.y);
         maxX = Math.max(maxX, b.x + b.width);
         maxY = Math.max(maxY, b.y + b.height);
      });

      // Add some padding
      const padding = isMobileRef.current ? 32 : 100;
      minX -= padding; minY -= padding;
      maxX += padding; maxY += padding;

      const w = maxX - minX;
      const h = maxY - minY;
      const cw = canvas.width!;
      const ch = canvas.height!;
      if (cw <= 0 || h <= 0) return;

      // Calculate optimal zoom
      const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
      const vpt = canvas.viewportTransform!;

      vpt[0] = zoom;
      vpt[3] = zoom;
      vpt[4] = cw / 2 - zoom * (minX + w / 2);
      vpt[5] = ch / 2 - zoom * (minY + h / 2);

      canvas.setViewportTransform(vpt);
      canvas.requestRenderAll();
      setZoomPercent(Math.round(zoom * 100));

      if (!isMobileRef.current) {
         viewportTransformRef.current = vpt.slice();
      }
   }, []);

   const validateViewport = useCallback(() => {
      // Intentionally left blank to prevent jarring "bounce back" 
      // effect when zooming/panning near or outside artboard bounds.
   }, []);

   // Core Tools & State
   const [activeTool, setActiveTool] = useState("select");
   const activeToolRef = useRef(activeTool);
   const isSpacePressedRef = useRef(false);
   const isAltPressedRef = useRef(false);

   useEffect(() => {
      activeToolRef.current = activeTool;
   }, [activeTool]);

   useEffect(() => {
      isSpacePressedRef.current = isSpacePressed;
   }, [isSpacePressed]);

   useEffect(() => {
      isAltPressedRef.current = isAltPressed;
   }, [isAltPressed]);

   const snapToleranceRef = useRef(10);
   const isSnappingEnabledRef = useRef(true);

   useEffect(() => {
      snapToleranceRef.current = snapTolerance;
      isSnappingEnabledRef.current = isSnappingEnabled;
   }, [snapTolerance, isSnappingEnabled]);

   useEffect(() => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;

      if (activeTool === 'pan' || isSpacePressed || isAltPressed) {
         canvas.defaultCursor = 'grab';
         canvas.hoverCursor = 'grab';
         canvas.moveCursor = 'grabbing';
      } else if (activeTool === 'brush' || activeTool === 'eraser') {
         canvas.defaultCursor = 'crosshair';
         canvas.hoverCursor = 'crosshair';
      } else {
         canvas.defaultCursor = 'default';
         canvas.hoverCursor = 'default';
      }
      canvas.requestRenderAll();
   }, [activeTool, isSpacePressed, isAltPressed]);

   const [layers, setLayers] = useState<fabric.Object[]>([]);
   const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

   // UI Panels
   const [activeTab, setActiveTab] = useState<"properties" | "layers" | "history" | "filters" | "export" | "artboards" | "quick">("properties");

   useEffect(() => {
      if (activeTab === 'export') {
         setMobilePanelHeight(30);
      } else {
         setMobilePanelHeight(45);
      }
   }, [activeTab]);

   // Panel sizing
   const MIN_PANEL_WIDTH = 280;
   const MAX_PANEL_WIDTH = 700;
   const DEFAULT_PANEL_WIDTH = 300;
   const [panelWidth, setPanelWidth] = useState(() => {
      try {
         const stored = localStorage.getItem("image_workspace_panel_width");
         if (stored) {
            const w = parseInt(stored, 10);
            if (!isNaN(w) && w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) return w;
         }
      } catch (e) { }
      return DEFAULT_PANEL_WIDTH;
   });
   const [isResizingPanel, setIsResizingPanel] = useState(false);
   const panelWidthRef = useRef(panelWidth);

   useEffect(() => {
      panelWidthRef.current = panelWidth;
      localStorage.setItem("image_workspace_panel_width", panelWidth.toString());
   }, [panelWidth]);

   useEffect(() => {
      if (!isResizingPanel) return;

      const handlePointerMove = (e: PointerEvent) => {
         if (!containerRef.current) return;
         const containerRect = containerRef.current.getBoundingClientRect();

         if (isMobileRef.current) {
            const newHeightPx = containerRect.bottom - e.clientY;
            const percentage = Math.max(20, Math.min(80, (newHeightPx / containerRect.height) * 100));
            setMobilePanelHeight(percentage);
         } else {
            // Calculate width from the right edge
            const newWidth = containerRect.right - e.clientX;
            const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, MAX_PANEL_WIDTH));
            setPanelWidth(clampedWidth);

            // Live resize of canvas during drag
            if (fabricRef.current) {
               const w = containerRect.width - clampedWidth;
               const h = containerRect.height - 48; // header height approx 48px
               fabricRef.current.setDimensions({
                  width: w > 100 ? w : 100,
                  height: h > 100 ? h : 100
               });
               fabricRef.current.requestRenderAll();
            }
         }
      };

      const handlePointerUp = () => {
         setIsResizingPanel(false);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);

      // Ensure we don't accidentally select things on the page while dragging
      document.body.style.cursor = isMobileRef.current ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
         window.removeEventListener('pointermove', handlePointerMove);
         window.removeEventListener('pointerup', handlePointerUp);
         document.body.style.cursor = '';
         document.body.style.userSelect = '';

         // Snap view to fit the new viewport
         setTimeout(() => fitView(), 50);
      };
   }, [isResizingPanel]);



   // Filter Studio State
   const [imageFilters, setImageFilters] = useState<FilterConfig[]>([]);
   const [customPresets, setCustomPresets] = useState<{ name: string; stack: FilterConfig[] }[]>([]);
   const [newPresetName, setNewPresetName] = useState("");
   const [showSavePresetModal, setShowSavePresetModal] = useState(false);
   const [benchmarkInfo, setBenchmarkInfo] = useState<any>(null);

   // History Command stacks
   const [commandsList, setCommandsList] = useState<Command[]>([]);
   const [commandIndex, setCommandIndex] = useState(-1);
   const [historyNames, setHistoryNames] = useState<string[]>([]);
   const isInternalChange = useRef(false);
   const saveTimeoutRef = useRef<any>(null);

   const [draggedArtboardIdx, setDraggedArtboardIdx] = useState<number | null>(null);
   const [dragOverArtboardIdx, setDragOverArtboardIdx] = useState<number | null>(null);

   // Command control references to prevent stale closures
   const commandIndexRef = useRef(-1);
   const commandsListRef = useRef<Command[]>([]);

   // Brush / Styling
   const [brushType, setBrushType] = useState<string>("pencil");
   const [brushColor, setBrushColor] = useState("#ff0000");
   const [brushSize, setBrushSize] = useState(10);
   const [brushOpacity, setBrushOpacity] = useState<number>(100);
   const [brushFlow, setBrushFlow] = useState<number>(100);
   const [brushHardness, setBrushHardness] = useState<number>(100);
   const [brushSpacing, setBrushSpacing] = useState<number>(25);
   const [brushSmoothing, setBrushSmoothing] = useState<number>(40);

   // Dynamic Photoshop-style Brush Adjustment gesture states & refs
   const [showHud, setShowHud] = useState(false);
   const [hudPosition, setHudPosition] = useState<{ x: number, y: number } | null>(null);
   const [activeBrushProperty, setActiveBrushProperty] = useState<'size' | 'opacity' | 'hardness'>('size');
   const [hudFadingOut, setHudFadingOut] = useState(false);

   const isAdjustingBrushRef = useRef(false);
   const activeBrushPropertyRef = useRef<'size' | 'opacity' | 'hardness'>('size');
   const hasLockedPropertyRef = useRef<boolean>(false);

   const startBrushSizeRef = useRef(10);
   const startBrushOpacityRef = useRef(100);
   const startBrushHardnessRef = useRef(100);
   const startMouseXRef = useRef(0);
   const startMouseYRef = useRef(0);

   const isAdjustingBrushTouchRef = useRef(false);
   const startBrushTouchSizeRef = useRef(10);
   const startBrushTouchOpacityRef = useRef(100);
   const startBrushTouchHardnessRef = useRef(100);
   const startTouchXRef = useRef(0);
   const startTouchYRef = useRef(0);

   const hudTimeoutRef = useRef<any>(null);

   // Keyboard and styling refs to prevent stale closure traps in events
   const isShiftPressedRef = useRef(false);
   const isCtrlPressedRef = useRef(false);
   const brushSizeRef = useRef(brushSize);
   const brushOpacityRef = useRef(brushOpacity);
   const brushHardnessRef = useRef(brushHardness);
   const brushTypeRef = useRef(brushType);
   const brushColorRef = useRef(brushColor);
   const brushFlowRef = useRef(brushFlow);
   const brushSmoothingRef = useRef(brushSmoothing);

   useEffect(() => {
      isShiftPressedRef.current = isShiftPressed;
   }, [isShiftPressed]);

   useEffect(() => {
      isCtrlPressedRef.current = isCtrlPressed;
   }, [isCtrlPressed]);

   useEffect(() => {
      brushSizeRef.current = brushSize;
   }, [brushSize]);

   useEffect(() => {
      brushOpacityRef.current = brushOpacity;
   }, [brushOpacity]);

   useEffect(() => {
      brushHardnessRef.current = brushHardness;
   }, [brushHardness]);

   useEffect(() => {
      brushTypeRef.current = brushType;
   }, [brushType]);

   useEffect(() => {
      brushColorRef.current = brushColor;
   }, [brushColor]);

   useEffect(() => {
      brushFlowRef.current = brushFlow;
   }, [brushFlow]);

   useEffect(() => {
      brushSmoothingRef.current = brushSmoothing;
   }, [brushSmoothing]);

   // Consolidated Export Settings
   const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

   // Before / After Comparison Workspace Settings
   const [comparisonMode, setComparisonMode] = useState(false);
   const [showDiagnostics, setShowDiagnostics] = useState(true);
   const [mobileDetailsExpanded, setMobileDetailsExpanded] = useState(false);
   const [comparisonPreviewMode, setComparisonPreviewMode] = useState<"split" | "side-by-side" | "original" | "optimized">("split");
   const [comparisonDivider, setComparisonDivider] = useState(50);
   const [comparisonZoom, setComparisonZoom] = useState(1);
   const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
   const [optimizedImageUrl, setOptimizedImageUrl] = useState<string | null>(null);
   const [originalPreviewDims, setOriginalPreviewDims] = useState<{ w: number, h: number } | null>(null);
   const [optimizedPreviewDims, setOptimizedPreviewDims] = useState<{ w: number, h: number } | null>(null);
   const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
   const [currentPreviewOp, setCurrentPreviewOp] = useState<string>("");
   const [originalSize, setOriginalSize] = useState<number>(0);
   const [optimizedSize, setOptimizedSize] = useState<number>(0);
   const [psnr, setPsnr] = useState<number | undefined>(undefined);

   // Sync export dimensions when tab opens, artboard changes
   const lastSyncedArtboardId = useRef<string | null>(null);
   useEffect(() => {
      if (activeTab === 'export') {
         const activeBoard = artboards.find(b => b.id === activeArtboardId);
         if (activeBoard && (activeBoard.id !== lastSyncedArtboardId.current)) {
            setExportSettings(prev => ({
               ...prev,
               resize: {
                  ...prev.resize,
                  width: activeBoard.width,
                  height: activeBoard.height
               }
            }));
            lastSyncedArtboardId.current = activeBoard.id;
         }
      } else {
         // Clear tracking so it re-syncs correctly when returning to the export tab
         lastSyncedArtboardId.current = null;
      }
   }, [activeTab, activeArtboardId, artboards]);

   const [isDraggingDivider, setIsDraggingDivider] = useState(false);
   const sliderRef = useRef<HTMLDivElement>(null);

   const handlePointerDown = (e: React.PointerEvent) => {
      setIsDraggingDivider(true);
      if (sliderRef.current) {
         try {
            sliderRef.current.setPointerCapture(e.pointerId);
         } catch (err) {
            // ignore polyfill fallback issues
         }
      }
   };

   const handlePointerUp = (e: React.PointerEvent) => {
      setIsDraggingDivider(false);
      if (sliderRef.current) {
         try {
            sliderRef.current.releasePointerCapture(e.pointerId);
         } catch (err) {
            // ignore fallback issues
         }
      }
   };

   const transformComponentRef = useRef<any>(null);

   const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingDivider) return;
      const rect = sliderRef.current?.getBoundingClientRect();
      if (rect) {
         const clientX = e.clientX;
         const offset = clientX - rect.left;
         const percentage = Math.max(0, Math.min(100, (offset / rect.width) * 100));
         setComparisonDivider(percentage);
      }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      let step = 1;
      if (e.shiftKey) step = 5;
      if (e.key === "ArrowLeft") {
         setComparisonDivider(p => Math.max(0, p - step));
         e.preventDefault();
      } else if (e.key === "ArrowRight") {
         setComparisonDivider(p => Math.min(100, p + step));
         e.preventDefault();
      }
   };

   const guidesRef = useRef<{ type: 'v' | 'h', pos: number }[]>([]);

   const getTargetArtboard = (obj: fabric.Object): Artboard => {
      const placement = (obj as any).artboardId;
      const board = artboardsRef.current.find(b => b.id === placement) ||
         artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) ||
         artboardsRef.current[0];
      return board;
   };

   const updateLayersList = useCallback(() => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      setLayers([...items].reverse()); // Top layer first

      if (saveTimeoutRef.current) {
         clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
         if (!fabricRef.current) return;
         try {
            await saveToDexie(path, artboardsRef.current, fabricRef.current).catch(err => {
               console.error("Dexie save failed", err);
            });

            const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
            let dataUrl = "";

            if (activeBoard) {
               const tempCanvas = document.createElement('canvas');
               tempCanvas.width = activeBoard.width;
               tempCanvas.height = activeBoard.height;
               const ctx = tempCanvas.getContext('2d');
               if (ctx) {
                  if (!activeBoard.transparent) {
                     ctx.fillStyle = activeBoard.backgroundColor || "#ffffff";
                     ctx.fillRect(0, 0, activeBoard.width, activeBoard.height);
                  } else {
                     ctx.clearRect(0, 0, activeBoard.width, activeBoard.height);
                  }

                  ctx.save();
                  ctx.translate(-activeBoard.x, -activeBoard.y);
                  fabricRef.current.getObjects().forEach((obj) => {
                     if (!obj.visible || obj.type === 'activeSelection') return;
                     if ((obj as any).artboardId === activeBoard.id) obj.render(ctx);
                  });
                  ctx.restore();
                  dataUrl = tempCanvas.toDataURL('image/png');
               } else {
                  dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
               }
            } else {
               dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
            }
            const name = path.split('.').pop() || "edited_image";
            const file = dataURLtoFile(dataUrl, `${name}.png`);

            importFile(file).then(({ assetId }) => {
               updateNodeValue(path, assetId);
            }).catch(err => {
               console.error("Failed to save edited canvas as asset:", err);
               updateNodeValue(path, dataUrl); // fallback
            });
         } catch (err) {
            console.error("Error serializing image canvas:", err);
         }
      }, 850);
   }, [path, updateNodeValue]);

   // History Execute Core Engine
   const executeCommand = useCallback((cmd: Command) => {
      isInternalChange.current = true;
      if (fabricRef.current) {
         cmd.execute(fabricRef.current, updateLayersList);
      }
      isInternalChange.current = false;

      const nextIndex = commandIndexRef.current + 1;
      commandsListRef.current = commandsListRef.current.slice(0, nextIndex);
      commandsListRef.current.push(cmd);
      commandIndexRef.current = nextIndex;

      setCommandIndex(nextIndex);
      setHistoryNames(commandsListRef.current.map(c => c.name));
   }, [updateLayersList]);

   const alignSelection = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight' | 'utils_fitInside' | 'utils_centerInside' | 'matchWidth' | 'matchHeight' | 'distributeH' | 'distributeV' | 'center') => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (!activeObject) return;

      const objects = activeObject.type === 'activeSelection'
         ? (activeObject as fabric.ActiveSelection).getObjects()
         : [activeObject];

      const parentObj = parentAlignmentObjRef.current;
      const hasParent = parentObj && objects.includes(parentObj);
      const refArea = hasParent ? getAbsoluteBoundingRect(parentObj) : null;

      const refX = refArea ? refArea.left : 0;
      const refY = refArea ? refArea.top : 0;
      const refW = refArea ? refArea.width : 0;
      const refH = refArea ? refArea.height : 0;

      const originalBoard = getTargetArtboard(activeObject);
      const board = {
         ...originalBoard,
         x: refArea ? refArea.left : originalBoard.x,
         y: refArea ? refArea.top : originalBoard.y,
         width: refArea ? refArea.width : originalBoard.width,
         height: refArea ? refArea.height : originalBoard.height,
      };

      const beforeStates = objects.map(o => ({
         obj: o,
         before: {
            left: o.left,
            top: o.top,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
            angle: o.angle,
            width: o.width,
            height: o.height,
         }
      }));

      // Handle Distribution modes directly first
      if (mode === 'distributeH' || mode === 'distributeV') {
         const children = hasParent ? objects.filter(o => o !== parentObj) : objects;
         if (children.length >= 2) {
            const childrenWithBounds = children.map(c => ({
               obj: c,
               bounds: getAbsoluteBoundingRect(c)
            }));

            const groupScaleX = activeObject.scaleX || 1;
            const groupScaleY = activeObject.scaleY || 1;

            if (mode === 'distributeH') {
               childrenWithBounds.sort((a, b) => a.bounds.left - b.bounds.left);

               const minLeft = refArea ? refX : childrenWithBounds[0].bounds.left;
               const maxRight = refArea ? (refX + refW) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.left + childrenWithBounds[childrenWithBounds.length - 1].bounds.width);
               const totalWidth = maxRight - minLeft;

               const totalChildrenWidth = childrenWithBounds.reduce((sum, item) => sum + item.bounds.width, 0);
               const totalSpacing = totalWidth - totalChildrenWidth;
               const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

               let currentLeft = minLeft;
               childrenWithBounds.forEach((item) => {
                  const deltaX = currentLeft - item.bounds.left;
                  item.obj.set({ left: item.obj.left! + (deltaX / groupScaleX) });
                  item.obj.setCoords();
                  currentLeft += item.bounds.width + gap;
               });
            } else {
               childrenWithBounds.sort((a, b) => a.bounds.top - b.bounds.top);

               const minTop = refArea ? refY : childrenWithBounds[0].bounds.top;
               const maxBottom = refArea ? (refY + refH) : (childrenWithBounds[childrenWithBounds.length - 1].bounds.top + childrenWithBounds[childrenWithBounds.length - 1].bounds.height);
               const totalHeight = maxBottom - minTop;

               const totalChildrenHeight = childrenWithBounds.reduce((sum, item) => sum + item.bounds.height, 0);
               const totalSpacing = totalHeight - totalChildrenHeight;
               const gap = children.length > 1 ? (totalSpacing / (children.length - 1)) : 0;

               let currentTop = minTop;
               childrenWithBounds.forEach((item) => {
                  const deltaY = currentTop - item.bounds.top;
                  item.obj.set({ top: item.obj.top! + (deltaY / groupScaleY) });
                  item.obj.setCoords();
                  currentTop += item.bounds.height + gap;
               });
            }
         }
         if (fabricRef.current) {
            if (activeObject) {
               activeObject.setCoords();
               if (activeObject.type === 'activeSelection') {
                  (activeObject as any)._calcBounds?.(true);
               }
            }
            fabricRef.current.requestRenderAll();
            // Fire custom modified events for undo state as standard
            const afterStatesDis = objects.map(o => ({
               obj: o,
               before: beforeStates.find(s => s.obj === o)!.before,
               after: {
                  left: o.left,
                  top: o.top,
                  scaleX: o.scaleX,
                  scaleY: o.scaleY,
                  angle: o.angle,
                  width: o.width,
                  height: o.height,
               }
            }));
            const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStatesDis);
            executeCommand(cmd);
         }
         return;
      }

      objects.forEach(obj => {
         // Skip parent object since it acts as the key reference anchor
         if (refArea && obj === parentObj) {
            return;
         }

         const currentAbsBounds = getAbsoluteBoundingRect(obj);
         const currentScaleX = obj.scaleX || 1;
         const currentScaleY = obj.scaleY || 1;

         let targetScaleX = currentScaleX;
         let targetScaleY = currentScaleY;

         switch (mode) {
            case 'stretch':
               targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
               targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
               break;
            case 'fit': {
               const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fill': {
               const scale = Math.max(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fitWidth': {
               const scale = board.width / currentAbsBounds.width;
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'fitHeight': {
               const scale = board.height / currentAbsBounds.height;
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'utils_fitInside': {
               const scale = Math.min(board.width / currentAbsBounds.width, board.height / currentAbsBounds.height);
               targetScaleX = currentScaleX * scale;
               targetScaleY = currentScaleY * scale;
               break;
            }
            case 'matchWidth':
               targetScaleX = currentScaleX * (board.width / currentAbsBounds.width);
               break;
            case 'matchHeight':
               targetScaleY = currentScaleY * (board.height / currentAbsBounds.height);
               break;
         }

         obj.set({
            scaleX: targetScaleX,
            scaleY: targetScaleY
         });
         obj.setCoords();

         const newAbsBounds = getAbsoluteBoundingRect(obj);

         let targetAbsLeft = newAbsBounds.left;
         let targetAbsTop = newAbsBounds.top;

         switch (mode) {
            case 'left':
            case 'stretch':
            case 'matchWidth':
               targetAbsLeft = board.x;
               break;
            case 'centerH':
            case 'center':
            case 'fit':
            case 'fill':
            case 'fitWidth':
            case 'utils_fitInside':
            case 'utils_centerInside':
               targetAbsLeft = board.x + (board.width - newAbsBounds.width) / 2;
               break;
            case 'right':
               targetAbsLeft = board.x + board.width - newAbsBounds.width;
               break;
         }

         switch (mode) {
            case 'top':
            case 'stretch':
            case 'matchHeight':
               targetAbsTop = board.y;
               break;
            case 'centerV':
            case 'center':
            case 'fit':
            case 'fill':
            case 'fitHeight':
            case 'utils_fitInside':
            case 'utils_centerInside':
               targetAbsTop = board.y + (board.height - newAbsBounds.height) / 2;
               break;
            case 'bottom':
               targetAbsTop = board.y + board.height - newAbsBounds.height;
               break;
         }

         const deltaX = targetAbsLeft - newAbsBounds.left;
         const deltaY = targetAbsTop - newAbsBounds.top;

         const groupScaleX = obj.group ? (obj.group.scaleX || 1) : 1;
         const groupScaleY = obj.group ? (obj.group.scaleY || 1) : 1;

         obj.set({
            left: obj.left! + (deltaX / groupScaleX),
            top: obj.top! + (deltaY / groupScaleY)
         });
         obj.setCoords();
      });

      if (activeObject) {
         activeObject.setCoords();
         if (activeObject.type === 'activeSelection') {
            (activeObject as any)._calcBounds?.(true);
         }
      }

      const afterStates = objects.map(o => ({
         obj: o,
         before: beforeStates.find(s => s.obj === o)!.before,
         after: {
            left: o.left,
            top: o.top,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
            angle: o.angle,
            width: o.width,
            height: o.height,
         }
      }));

      const cmd = new TransformObjectsCommand(`Align Selection: ${mode}`, afterStates);
      executeCommand(cmd);
      fabricRef.current.requestRenderAll();
      updateLayersList();
   };

   const resizeArtboardToSelection = (mode: 'both' | 'width' | 'height' | 'bounds') => {
      if (!fabricRef.current) return;
      const activeSelection = fabricRef.current.getActiveObject();
      if (!activeSelection) return;

      const targetArtboard = getTargetArtboard(activeSelection);
      if (!targetArtboard) return;

      const br = activeSelection.getBoundingRect();

      const commands: Command[] = [];

      let newWidth = targetArtboard.width;
      let newHeight = targetArtboard.height;
      let newX = targetArtboard.x;
      let newY = targetArtboard.y;

      if (mode === 'both' || mode === 'bounds') {
         newWidth = br.width;
         newHeight = br.height;
         newX = br.left;
         newY = br.top;
      } else if (mode === 'width') {
         newWidth = br.width;
         newX = br.left;
      } else if (mode === 'height') {
         newHeight = br.height;
         newY = br.top;
      }

      newWidth = Math.max(10, Math.round(newWidth));
      newHeight = Math.max(10, Math.round(newHeight));
      newX = Math.round(newX);
      newY = Math.round(newY);

      if (newWidth !== targetArtboard.width) {
         commands.push(new ArtboardPropertyCommand(`Resize Width to Selection`, targetArtboard.id, 'width', targetArtboard.width, newWidth, setArtboards));
      }
      if (newHeight !== targetArtboard.height) {
         commands.push(new ArtboardPropertyCommand(`Resize Height to Selection`, targetArtboard.id, 'height', targetArtboard.height, newHeight, setArtboards));
      }
      if (newX !== targetArtboard.x) {
         commands.push(new ArtboardPropertyCommand(`Move Artboard X`, targetArtboard.id, 'x', targetArtboard.x, newX, setArtboards));
      }
      if (newY !== targetArtboard.y) {
         commands.push(new ArtboardPropertyCommand(`Move Artboard Y`, targetArtboard.id, 'y', targetArtboard.y, newY, setArtboards));
      }

      if (commands.length > 0) {
         const macro = new MacroCommand(`Resize Artboard to Selection`, commands);
         executeCommand(macro);
         updateLayersList();
         fabricRef.current.requestRenderAll();
      }
   };

   const handleSnapping = useCallback((e: any) => {
      if (!fabricRef.current || !isSnappingEnabledRef.current || isAltPressedRef.current) {
         guidesRef.current = [];
         return;
      }

      const obj = e.target;
      if (!obj) return;

      const canvas = fabricRef.current;
      const tolerance = snapToleranceRef.current;
      const bounds = obj.getBoundingRect();
      const objWidth = bounds.width;
      const objHeight = bounds.height;
      const objLeft = bounds.left;
      const objTop = bounds.top;
      const objRight = objLeft + objWidth;
      const objBottom = objTop + objHeight;
      const objCenterX = objLeft + objWidth / 2;
      const objCenterY = objTop + objHeight / 2;

      const newGuides: { type: 'v' | 'h', pos: number }[] = [];
      let snappedX = false;
      let snappedY = false;

      // --- ARTBOARD SNAPPING ---
      artboardsRef.current.forEach(board => {
         const bL = board.x;
         const bT = board.y;
         const bR = board.x + board.width;
         const bB = board.y + board.height;
         const bCX = board.x + board.width / 2;
         const bCY = board.y + board.height / 2;

         // X-axis snapping
         if (!snappedX) {
            if (Math.abs(objLeft - bL) < tolerance) {
               obj.set({ left: bL + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bL });
               snappedX = true;
            } else if (Math.abs(objRight - bR) < tolerance) {
               obj.set({ left: bR - objWidth + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bR });
               snappedX = true;
            } else if (Math.abs(objCenterX - bCX) < tolerance) {
               obj.set({ left: bCX - objWidth / 2 + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bCX });
               snappedX = true;
            } else if (Math.abs(objLeft - bR) < tolerance) {
               obj.set({ left: bR + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bR });
               snappedX = true;
            } else if (Math.abs(objRight - bL) < tolerance) {
               obj.set({ left: bL - objWidth + (obj.left! - objLeft) });
               newGuides.push({ type: 'v', pos: bL });
               snappedX = true;
            }
         }

         // Y-axis snapping
         if (!snappedY) {
            if (Math.abs(objTop - bT) < tolerance) {
               obj.set({ top: bT + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bT });
               snappedY = true;
            } else if (Math.abs(objBottom - bB) < tolerance) {
               obj.set({ top: bB - objHeight + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bB });
               snappedY = true;
            } else if (Math.abs(objCenterY - bCY) < tolerance) {
               obj.set({ top: bCY - objHeight / 2 + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bCY });
               snappedY = true;
            } else if (Math.abs(objTop - bB) < tolerance) {
               obj.set({ top: bB + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bB });
               snappedY = true;
            } else if (Math.abs(objBottom - bT) < tolerance) {
               obj.set({ top: bT - objHeight + (obj.top! - objTop) });
               newGuides.push({ type: 'h', pos: bT });
               snappedY = true;
            }
         }

         // Safe Areas & Margins
         if (board.showSafeArea || board.showMargins) {
            const m = board.showMargins ? 0.1 : 0.05;
            const sL = bL + board.width * m;
            const sT = bT + board.height * m;
            const sR = bR - board.width * m;
            const sB = bB - board.height * m;

            if (!snappedX) {
               if (Math.abs(objLeft - sL) < tolerance) {
                  obj.set({ left: sL + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: sL });
                  snappedX = true;
               } else if (Math.abs(objRight - sR) < tolerance) {
                  obj.set({ left: sR - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: sR });
                  snappedX = true;
               }
            }
            if (!snappedY) {
               if (Math.abs(objTop - sT) < tolerance) {
                  obj.set({ top: sT + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: sT });
                  snappedY = true;
               } else if (Math.abs(objBottom - sB) < tolerance) {
                  obj.set({ top: sB - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: sB });
                  snappedY = true;
               }
            }
         }
      });

      // --- OBJECT SNAPPING ---
      if (!snappedX || !snappedY) {
         const otherObjects = canvas.getObjects().filter(o => o !== obj && o.visible && o.selectable);
         for (const other of otherObjects) {
            const oBounds = other.getBoundingRect();
            const oL = oBounds.left;
            const oT = oBounds.top;
            const oR = oL + oBounds.width;
            const oB = oT + oBounds.height;
            const oCX = oL + oBounds.width / 2;
            const oCY = oT + oBounds.height / 2;

            if (!snappedX) {
               if (Math.abs(objLeft - oL) < tolerance) {
                  obj.set({ left: oL + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oL });
                  snappedX = true;
               } else if (Math.abs(objRight - oR) < tolerance) {
                  obj.set({ left: oR - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oR });
                  snappedX = true;
               } else if (Math.abs(objCenterX - oCX) < tolerance) {
                  obj.set({ left: oCX - objWidth / 2 + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oCX });
                  snappedX = true;
               } else if (Math.abs(objLeft - oR) < tolerance) {
                  obj.set({ left: oR + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oR });
                  snappedX = true;
               } else if (Math.abs(objRight - oL) < tolerance) {
                  obj.set({ left: oL - objWidth + (obj.left! - objLeft) });
                  newGuides.push({ type: 'v', pos: oL });
                  snappedX = true;
               }
            }

            if (!snappedY) {
               if (Math.abs(objTop - oT) < tolerance) {
                  obj.set({ top: oT + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oT });
                  snappedY = true;
               } else if (Math.abs(objBottom - oB) < tolerance) {
                  obj.set({ top: oB - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oB });
                  snappedY = true;
               } else if (Math.abs(objCenterY - oCY) < tolerance) {
                  obj.set({ top: oCY - objHeight / 2 + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oCY });
                  snappedY = true;
               } else if (Math.abs(objTop - oB) < tolerance) {
                  obj.set({ top: oB + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oB });
                  snappedY = true;
               } else if (Math.abs(objBottom - oT) < tolerance) {
                  obj.set({ top: oT - objHeight + (obj.top! - objTop) });
                  newGuides.push({ type: 'h', pos: oT });
                  snappedY = true;
               }
            }
            if (snappedX && snappedY) break;
         }
      }

      guidesRef.current = newGuides;
      if (newGuides.length > 0) {
         canvas.requestRenderAll();
      }
   }, []);
   const [textProps, setTextProps] = useState({
      textContent: "",
      fontFamily: "Arial",
      fontSize: 40,
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "left" as any,
      underline: false,
      overline: false,
      linethrough: false,
      charSpacing: 0,
      lineHeight: 1.16,
      angle: 0,
      flipX: false,
      flipY: false,
   });
   const [frameBorderWidth, setFrameBorderWidth] = useState(20);

   const fontSizeStartRef = useRef<number>(40);
   const textStartValueRef = useRef<string>("");



   // Sync canvas state back to workspace document
   const [showAssetGallery, setShowAssetGallery] = useState(false);
   const [showUrlPrompt, setShowUrlPrompt] = useState(false);
   const [urlInput, setUrlInput] = useState("");
   const { importAssets } = useImageImport(fabricRef, artboardsRef, activeArtboardId, (objects) => {
      if (objects.length > 0) {
         objects.forEach(obj => {
            const cmd = new AddObjectCommand('Import Asset', obj);
            executeCommand(cmd);
         });
      }
   });

   useEffect(() => {
      const handlePaste = async (e: ClipboardEvent) => {
         // Don't intercept if user is typing in an input/textarea
         const target = e.target as HTMLElement;
         if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
         }

         let isInternal = false;
         try {
             const txt = e.clipboardData?.getData('text/plain');
             if (txt && txt.includes('__fabricInternalClipboard')) {
                 isInternal = true;
             }
         } catch(err) {}

         if (isInternal && (window as any)._fabricInternalClipboard) {
             const cloned = (window as any)._fabricInternalClipboard;
             cloned.clone().then((clonedObj: any) => {
                 fabricRef.current?.discardActiveObject();
                 let newLeft = (clonedObj.left || 0) + 20;
                 let newTop = (clonedObj.top || 0) + 20;
                 const canvas = fabricRef.current;
                 if (canvas && canvas.vptCoords) {
                     const { tl, br } = canvas.vptCoords;
                     if (newLeft < tl.x || newLeft > br.x || newTop < tl.y || newTop > br.y) {
                         const center = canvas.getVpCenter();
                         newLeft = clonedObj.originX === 'center' ? center.x : center.x - ((clonedObj.width || 0) * (clonedObj.scaleX || 1)) / 2;
                         newTop = clonedObj.originY === 'center' ? center.y : center.y - ((clonedObj.height || 0) * (clonedObj.scaleY || 1)) / 2;
                     }
                 }
                 clonedObj.set({
                    left: newLeft,
                    top: newTop,
                    id: Date.now().toString() + Math.random().toString(),
                    artboardId: activeArtboardId || undefined
                 });
                 
                 if (clonedObj.type === 'activeSelection') {
                     clonedObj.canvas = fabricRef.current;
                     clonedObj.forEachObject((obj: any) => {
                         obj.id = Date.now().toString() + Math.random().toString();
                         obj.artboardId = activeArtboardId || undefined;
                         fabricRef.current?.add(obj);
                     });
                     clonedObj.setCoords();
                 } else {
                     fabricRef.current?.add(clonedObj);
                 }
                 
                 const cmd = new AddObjectCommand("Paste Object", clonedObj);
                 executeCommand(cmd);
                 fabricRef.current?.setActiveObject(clonedObj);
                 fabricRef.current?.requestRenderAll();
                 updateLayersList();
             });
             e.preventDefault();
             return;
         }

         const results = await processPasteEvent(e);
         if (results.length > 0) {
            importAssets(results);
         }
      };
      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
   }, [importAssets]);


   const handleSelectionContext = useCallback((e: any) => {
      const active = fabricRef.current?.getActiveObject();
      if (active) {
         if (active.type === 'activeSelection') {
            const selObjects = (active as fabric.ActiveSelection).getObjects();
            if (parentAlignmentObjRef.current && !selObjects.includes(parentAlignmentObjRef.current)) {
               parentAlignmentObjRef.current = null;
               setParentAlignmentObj(null);
            }
         } else {
            parentAlignmentObjRef.current = null;
            setParentAlignmentObj(null);
         }

         setSelectedLayerId((active as any).id);
         const selType = active.get('isFrameGroup') ? 'frameGroup' : active.type;
         setSelectionType(selType);

         if (['rect', 'circle', 'triangle', 'line'].includes(selType || '')) {
            setShapeFillColor(active.get('fill') as string || 'transparent');
            const strokeVal = active.get('stroke') as string || '#000000';
            setShapeStrokeColor(strokeVal === 'transparent' ? '#000000' : strokeVal);
            setShapeStrokeWidth(active.get('strokeWidth') as number ?? 2);
            setShapeOpacity(Math.round((active.get('opacity') ?? 1) * 100));
            setShapeBlendMode(active.get('globalCompositeOperation') as string || 'source-over');
            setShapeStrokeLineJoin((active.get('strokeLineJoin') as 'miter' | 'round' | 'bevel') || 'miter');
            setShapeStrokeLineCap((active.get('strokeLineCap') as 'butt' | 'round' | 'square') || 'butt');

            const dashArray = active.get('strokeDashArray');
            if (!active.get('stroke') || active.get('stroke') === 'transparent' || active.get('strokeWidth') === 0) {
               setShapeBorderStyle('none');
            } else if (dashArray && dashArray.length > 0) {
               setShapeBorderStyle('dashed');
            } else {
               setShapeBorderStyle('solid');
            }

            if (selType === 'rect') {
               const obj = active as any;
               const w = obj.width ?? 100;
               const h = obj.height ?? 100;
               const maxR = Math.min(w, h) / 2;

               const uPercent = obj.cornerRoundingPercent !== undefined ? obj.cornerRoundingPercent : Math.round(((obj.rx || 0) / (maxR || 1)) * 100);
               const tlPercent = obj.cornerTopLeftPercent !== undefined ? obj.cornerTopLeftPercent : uPercent;
               const trPercent = obj.cornerTopRightPercent !== undefined ? obj.cornerTopRightPercent : uPercent;
               const brPercent = obj.cornerBottomRightPercent !== undefined ? obj.cornerBottomRightPercent : uPercent;
               const blPercent = obj.cornerBottomLeftPercent !== undefined ? obj.cornerBottomLeftPercent : uPercent;
               const isIndiv = obj.useIndividualCorners ?? false;

               setShapeCornerRadius(uPercent);
               setShapeUseIndividualCorners(isIndiv);
               setShapeCornerTL(tlPercent);
               setShapeCornerTR(trPercent);
               setShapeCornerBR(brPercent);
               setShapeCornerBL(blPercent);
            }
         } else if (['image', 'i-text', 'textbox'].includes(selType || '')) {
            setShapeOpacity(Math.round((active.get('opacity') ?? 1) * 100));
            setShapeBlendMode(active.get('globalCompositeOperation') as string || 'source-over');
         }

         if ((active as any).isCollageBlock) {
            setCollageBgColor(active.get('fill') as string || '#333333');
            const stroke = active.get('stroke') as string || '#555555';
            setCollageBorderColor(stroke === 'transparent' ? '#555555' : stroke);
            setCollageBorderWidth(active.get('strokeWidth') as number || 2);

            const obj = active as any;
            const w = obj.width ?? 100;
            const h = obj.height ?? 100;
            const maxR = Math.min(w, h) / 2;

            const uPercent = obj.cornerRoundingPercent !== undefined ? obj.cornerRoundingPercent : Math.round(((obj.rx || 0) / (maxR || 1)) * 100);
            const tlPercent = obj.cornerTopLeftPercent !== undefined ? obj.cornerTopLeftPercent : uPercent;
            const trPercent = obj.cornerTopRightPercent !== undefined ? obj.cornerTopRightPercent : uPercent;
            const brPercent = obj.cornerBottomRightPercent !== undefined ? obj.cornerBottomRightPercent : uPercent;
            const blPercent = obj.cornerBottomLeftPercent !== undefined ? obj.cornerBottomLeftPercent : uPercent;
            const isIndiv = obj.useIndividualCorners ?? false;

            setCollageCornerRadius(uPercent);
            setUseIndividualCorners(isIndiv);
            setCollageCornerTL(tlPercent);
            setCollageCornerTR(trPercent);
            setCollageCornerBR(brPercent);
            setCollageCornerBL(blPercent);

            const dash = active.get('strokeDashArray');
            if (stroke === 'transparent' || active.get('strokeWidth') === 0) {
               setCollageBorderStyle('none');
            } else if (dash && dash.length > 0) {
               setCollageBorderStyle('dashed');
            } else {
               setCollageBorderStyle('solid');
            }
         }

         if (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox') {
            const textObj = active as any;
            setTextProps({
               textContent: textObj.text || "",
               fontFamily: textObj.fontFamily || "Arial",
               fontSize: textObj.fontSize || 40,
               fontWeight: textObj.fontWeight || "normal",
               fontStyle: textObj.fontStyle || "normal",
               textAlign: textObj.textAlign || "left",
               underline: textObj.underline || false,
               overline: textObj.overline || false,
               linethrough: textObj.linethrough || false,
               charSpacing: textObj.charSpacing || 0,
               lineHeight: textObj.lineHeight || 1.16,
               angle: textObj.angle || 0,
               flipX: textObj.flipX || false,
               flipY: textObj.flipY || false,
            });
         } else if (active.type === 'image' || active.get('isFrameGroup')) {
            let imgObj = active as any;
            if (imgObj.get('isFrameGroup')) {
               const frameType = imgObj.get('frameType');
               const items = imgObj.getObjects();

               const rectObj = items.find((i: any) => i.type === 'rect');
               if (rectObj) {
                  if (frameType === 'polaroid') {
                     const contentObj = items.find((i: any) => i.type === 'image');
                     if (contentObj) {
                        setFrameBorderWidth(Math.round(rectObj.top - contentObj.getCenterPoint().y));
                     }
                  } else {
                     setFrameBorderWidth(Math.round(rectObj.strokeWidth || 20));
                  }
               }

               imgObj = items.find((i: any) => i.type === 'image') || imgObj;
            }
            setImageFilters(imgObj.customFilters || []);
            if (imgObj.lastFilterBenchmark) {
               setBenchmarkInfo(imgObj.lastFilterBenchmark);
            } else {
               setBenchmarkInfo({
                  backend: "WebGL",
                  filterTimeMs: "0.0",
                  outputWidth: imgObj.width ? Math.round(imgObj.width * (imgObj.scaleX || 1)) : 0,
                  outputHeight: imgObj.height ? Math.round(imgObj.height * (imgObj.scaleY || 1)) : 0
               });
            }
         }
      } else {
         parentAlignmentObjRef.current = null;
         setParentAlignmentObj(null);
         setSelectedLayerId(null);
         setSelectionType(null);
      }
   }, []);

   const getLayersOrder = useCallback(() => {
      if (!fabricRef.current) return [];
      return fabricRef.current.getObjects().map((obj: any, idx) => ({
         id: obj.id as string,
         idx
      }));
   }, []);

   const handleLayerOrder = useCallback((action: 'front' | 'forward' | 'backward' | 'back') => {
      if (!fabricRef.current) return;
      const activeObjects = fabricRef.current.getActiveObjects();
      if (!activeObjects || activeObjects.length === 0) return;

      const beforeOrder = getLayersOrder();

      if (action === 'front') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(a) - fabricRef.current.getObjects().indexOf(b));
         sorted.forEach(obj => fabricRef.current.bringObjectToFront(obj));
      } else if (action === 'back') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(b) - fabricRef.current.getObjects().indexOf(a));
         sorted.forEach(obj => fabricRef.current.sendObjectToBack(obj));
      } else if (action === 'forward') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(b) - fabricRef.current.getObjects().indexOf(a));
         sorted.forEach(obj => fabricRef.current.bringObjectForward(obj));
      } else if (action === 'backward') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(a) - fabricRef.current.getObjects().indexOf(b));
         sorted.forEach(obj => fabricRef.current.sendObjectBackwards(obj));
      }

      const afterOrder = getLayersOrder();
      if (JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)) return;

      const cmdName = action === 'front' ? 'Bring to Front' : action === 'back' ? 'Send to Back' : action === 'forward' ? 'Bring Forward' : 'Send Backward';
      const cmd = new LayerReorderCommand(cmdName, beforeOrder, afterOrder);

      cmd.undo(fabricRef.current, updateLayersList);
      executeCommand(cmd);
      updateLayersList();
   }, [getLayersOrder, executeCommand, updateLayersList]);

   const selectLayer = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         fabricRef.current.setActiveObject(obj);
         fabricRef.current.renderAll();
      }
   };

   const moveLayerUp = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         const beforeOrder = getLayersOrder();
         fabricRef.current.bringObjectForward(obj);
         const afterOrder = getLayersOrder();

         fabricRef.current.sendObjectBackwards(obj);
         const cmd = new LayerReorderCommand("Move Layer Up", beforeOrder, afterOrder);
         executeCommand(cmd);
      }
   };

   const moveLayerDown = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         const beforeOrder = getLayersOrder();
         fabricRef.current.sendObjectBackwards(obj);
         const afterOrder = getLayersOrder();

         fabricRef.current.bringObjectForward(obj);
         const cmd = new LayerReorderCommand("Move Layer Down", beforeOrder, afterOrder);
         executeCommand(cmd);
      }
   };


   const performUndo = useCallback(() => {
      if (commandIndexRef.current >= 0 && fabricRef.current) {
         isInternalChange.current = true;
         const cmd = commandsListRef.current[commandIndexRef.current];
         cmd.undo(fabricRef.current, updateLayersList);
         commandIndexRef.current -= 1;
         setCommandIndex(commandIndexRef.current);
         isInternalChange.current = false;
         handleSelectionContext(null);
      }
   }, [updateLayersList, handleSelectionContext]);

   const performRedo = useCallback(() => {
      const nextIndex = commandIndexRef.current + 1;
      if (nextIndex < commandsListRef.current.length && fabricRef.current) {
         isInternalChange.current = true;
         const cmd = commandsListRef.current[nextIndex];
         cmd.redo(fabricRef.current, updateLayersList);
         commandIndexRef.current = nextIndex;
         setCommandIndex(nextIndex);
         isInternalChange.current = false;
         handleSelectionContext(null);
      }
   }, [updateLayersList, handleSelectionContext]);

   const jumpToHistory = useCallback((idx: number) => {
      if (!fabricRef.current) return;
      isInternalChange.current = true;

      while (commandIndexRef.current > idx) {
         const cmd = commandsListRef.current[commandIndexRef.current];
         cmd.undo(fabricRef.current, updateLayersList);
         commandIndexRef.current -= 1;
      }

      while (commandIndexRef.current < idx) {
         const nextIdx = commandIndexRef.current + 1;
         const cmd = commandsListRef.current[nextIdx];
         cmd.redo(fabricRef.current, updateLayersList);
         commandIndexRef.current = nextIdx;
      }

      setCommandIndex(idx);
      isInternalChange.current = false;
      handleSelectionContext(null);
   }, [updateLayersList, handleSelectionContext]);

   const artboardFocusValueRef = useRef<any>(null);

   const onArtboardPropStart = (val: any) => {
      artboardFocusValueRef.current = val;
   };

   const onArtboardPropCommit = (id: string, prop: keyof Artboard, finalVal: any) => {
      const beforeVal = artboardFocusValueRef.current;
      if (beforeVal !== null && beforeVal !== undefined && beforeVal !== finalVal) {
         const labelMap: Record<string, string> = {
            name: "Rename Artboard",
            width: "Change Artboard Width",
            height: "Change Artboard Height",
            backgroundColor: "Change Artboard Background Color",
            borderColor: "Change Artboard Border Color",
         };
         const cmdName = labelMap[prop] || `Change Artboard ${String(prop)}`;
         const cmd = new ArtboardPropertyCommand(cmdName, id, prop, beforeVal, finalVal, setArtboards);

         const nextIndex = commandIndexRef.current + 1;
         commandsListRef.current = commandsListRef.current.slice(0, nextIndex);
         commandsListRef.current.push(cmd);
         commandIndexRef.current = nextIndex;
         setCommandIndex(nextIndex);
         setHistoryNames(commandsListRef.current.map(c => c.name));
      }
      artboardFocusValueRef.current = null;
   };

   const createArtboardFromPreset = (presetId: string) => {
      const preset = PRESET_REGISTRY.find(p => p.id === presetId);
      if (!preset) return;
      const dims = getDimensionsInPixels(preset);

      if (!activeArtboardId || artboards.length === 0 || !artboards.find(b => b.id === activeArtboardId)) {
         createArtboard(preset.name, dims.width, dims.height);
         return;
      }

      const canvas = fabricRef.current;
      const boardIndex = artboards.findIndex(b => b.id === activeArtboardId);
      if (boardIndex === -1) return;
      const board = artboards[boardIndex];

      let targetImage = canvas ? canvas.getActiveObject() : null;
      if (canvas && (!targetImage || (targetImage.type !== 'image' && !targetImage.get('isFrameGroup')))) {
         const objects = canvas.getObjects().filter(o => (o as any).artboardId === activeArtboardId);
         const images = objects.filter(o => o.type === 'image' || o.get('isFrameGroup'));
         if (images.length > 0) {
            targetImage = images[0];
            canvas.setActiveObject(targetImage);
         } else {
            targetImage = null;
         }
      }

      const newBoards = [...artboards];
      newBoards[boardIndex] = {
         ...board,
         width: dims.width,
         height: dims.height,
         name: preset.name,
         showGrid: false,
         showSafeArea: preset.category === 'document' || preset.category === 'print',
         showMargins: preset.category === 'document' || preset.category === 'print'
      };

      const commands: Command[] = [];
      commands.push(new ArtboardStateCommand(
         `Format Document: ${preset.name}`,
         [...artboards],
         newBoards,
         activeArtboardId,
         activeArtboardId,
         setArtboards,
         setActiveArtboardId
      ));

      if (targetImage) {
         const scaleX = dims.width / targetImage.getScaledWidth();
         const scaleY = dims.height / targetImage.getScaledHeight();
         const scale = Math.min(scaleX, scaleY) * 0.95; // 95% fit to preserve safe margins

         const nScaleX = (targetImage.scaleX || 1) * scale;
         const nScaleY = (targetImage.scaleY || 1) * scale;

         const beforeState = {
            left: targetImage.left, top: targetImage.top,
            scaleX: targetImage.scaleX, scaleY: targetImage.scaleY,
            angle: targetImage.angle, originX: targetImage.originX, originY: targetImage.originY
         };

         targetImage.set({ scaleX: nScaleX, scaleY: nScaleY });
         targetImage.setCoords();

         const center = targetImage.getCenterPoint();
         const dx = (board.x + dims.width / 2) - center.x;
         const dy = (board.y + dims.height / 2) - center.y;

         targetImage.set({
            left: (targetImage.left || 0) + dx,
            top: (targetImage.top || 0) + dy
         });
         targetImage.setCoords();

         const afterState = {
            left: targetImage.left, top: targetImage.top,
            scaleX: nScaleX, scaleY: nScaleY,
            angle: targetImage.angle, originX: targetImage.originX, originY: targetImage.originY
         };

         targetImage.set(beforeState);
         targetImage.setCoords();

         commands.push(new TransformObjectsCommand(
            "Format Image",
            [{ obj: targetImage, before: beforeState, after: afterState }]
         ));
      }

      const macro = new MacroCommand(`Convert to ${preset.name}`, commands);
      executeCommand(macro);
   };

   const generateSmartCollage = (type: string) => {
      if (!fabricRef.current || !activeArtboardId) return;
      const canvas = fabricRef.current;
      const board = artboards.find(b => b.id === activeArtboardId);
      if (!board) return;

      // We will save to history before we do this
      const commands: Command[] = [];
      const padding = Math.min(board.width, board.height) * (collagePaddingPercent / 100);
      const innerW = board.width - padding * 2;
      const innerH = board.height - padding * 2;
      const gap = Math.min(board.width, board.height) * (collageGapPercent / 100);

      const items: fabric.Rect[] = [];

      const createPlaceholder = (x: number, y: number, w: number, h: number) => {
         const isNone = collageBorderStyle === 'none';
         const isDashed = collageBorderStyle === 'dashed';
         const rect = new fabric.Rect({
            left: board.x + padding + x,
            top: board.y + padding + y,
            width: w,
            height: h,
            fill: collageBgColor,
            stroke: isNone ? 'transparent' : collageBorderColor,
            strokeWidth: isNone ? 0 : collageBorderWidth,
            strokeDashArray: isDashed ? [5, 5] : undefined,
            rx: 0, // we use custom drawing properties
            ry: 0,
            cornerRoundingPercent: collageCornerRadius,
            useIndividualCorners: useIndividualCorners,
            cornerTopLeftPercent: collageCornerTL,
            cornerTopRightPercent: collageCornerTR,
            cornerBottomLeftPercent: collageCornerBL,
            cornerBottomRightPercent: collageCornerBR,
            opacity: 0.9,
            cornerColor: '#00aaff',
            transparentCorners: false,
            id: 'collage_' + Date.now().toString() + '_' + Math.random().toString().slice(2, 6)
         } as any);
         (rect as any).artboardId = board.id;
         (rect as any).isCollageBlock = true;
         return rect;
      };

      if (type === '2x') {
         const cellW = (innerW - gap) / 2;
         items.push(createPlaceholder(0, 0, cellW, innerH));
         items.push(createPlaceholder(cellW + gap, 0, cellW, innerH));
      } else if (type === '3x') {
         const cellW = (innerW - gap * 2) / 3;
         items.push(createPlaceholder(0, 0, cellW, innerH));
         items.push(createPlaceholder(cellW + gap, 0, cellW, innerH));
         items.push(createPlaceholder((cellW + gap) * 2, 0, cellW, innerH));
      } else if (type === '4x') {
         const cellW = (innerW - gap) / 2;
         const cellH = (innerH - gap) / 2;
         items.push(createPlaceholder(0, 0, cellW, cellH));
         items.push(createPlaceholder(cellW + gap, 0, cellW, cellH));
         items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
         items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
      } else if (type === '1-2') {
         const cellW = (innerW - gap) / 2;
         const cellH = (innerH - gap) / 2;
         items.push(createPlaceholder(0, 0, cellW, innerH));
         items.push(createPlaceholder(cellW + gap, 0, cellW, cellH));
         items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
      } else if (type === '2-1') {
         const cellW = (innerW - gap) / 2;
         const cellH = (innerH - gap) / 2;
         items.push(createPlaceholder(0, 0, innerW, cellH));
         items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
         items.push(createPlaceholder(cellW + gap, cellH + gap, cellW, cellH));
      } else if (type === 'film') {
         const cellW = innerW;
         const cellH = (innerH - gap * 2) / 3;
         items.push(createPlaceholder(0, 0, cellW, cellH));
         items.push(createPlaceholder(0, cellH + gap, cellW, cellH));
         items.push(createPlaceholder(0, (cellH + gap) * 2, cellW, cellH));
      }

      if (items.length > 0) {
         canvas.discardActiveObject();
         items.forEach(item => {
            canvas.add(item);
            commands.push(new AddObjectCommand("Add Collage Block", item));
         });
         const sel = new fabric.ActiveSelection(items, { canvas });
         canvas.setActiveObject(sel);
         canvas.requestRenderAll();

         const macro = new MacroCommand(`Generate ${type} Collage`, commands);
         executeCommand(macro);
         updateLayersList();

         // Automatically fit collage to artboard upon generation
         setTimeout(() => {
            fitCollageToArtboard();
         }, 50);
      }
   };

   const addAlignedCollageText = (alignment: 'top' | 'center' | 'bottom' | 'left' | 'right') => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const active = canvas.getActiveObject();
      if (!active || !(active as any).isCollageBlock) {
         return;
      }

      const rect = active as fabric.Rect;
      const bounds = rect.getBoundingRect();
      const scaledW = bounds.width;
      const scaledH = bounds.height;
      const textWidth = Math.min(scaledW * 0.8, 200);
      const textHeight = 30;

      let left = bounds.left + (scaledW - textWidth) / 2;
      let top = bounds.top + (scaledH - textHeight) / 2;
      let textAlign: fabric.TextboxProps['textAlign'] = 'center';

      if (alignment === 'top') {
         top = bounds.top + scaledH * 0.15;
      } else if (alignment === 'bottom') {
         top = bounds.top + scaledH * 0.85 - textHeight;
      } else if (alignment === 'left') {
         left = bounds.left + scaledW * 0.1;
         textAlign = 'left';
      } else if (alignment === 'right') {
         left = bounds.left + scaledW * 0.9 - textWidth;
         textAlign = 'right';
      }

      const text = new fabric.Textbox('Heading Text', {
         left,
         top,
         width: textWidth,
         fill: brushColor || '#FFFFFF',
         fontFamily: textProps.fontFamily,
         fontSize: Math.min(scaledH * 0.18, 24),
         fontWeight: 'bold',
         fontStyle: textProps.fontStyle,
         textAlign: textAlign,
         id: Date.now().toString() + '_' + Math.random().toString().slice(2, 6),
         artboardId: (rect as any).artboardId
      } as any);

      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
      updateLayersList();

      const cmd = new AddObjectCommand("Add Collage Text", text);
      executeCommand(cmd);
   };

   const fitCollageToArtboard = () => {
      if (!fabricRef.current || !activeArtboardId) return;
      const canvas = fabricRef.current;
      const board = artboards.find(b => b.id === activeArtboardId);
      if (!board) return;

      const items = canvas.getObjects().filter(o => (o as any).isCollageBlock && (o as any).artboardId === activeArtboardId);
      if (items.length === 0) return;

      const padding = Math.min(board.width, board.height) * (collagePaddingPercent / 100);
      const innerW = board.width - padding * 2;
      const innerH = board.height - padding * 2;

      // Find bounding box of all collage blocks
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      items.forEach(o => {
         const br = o.getBoundingRect();
         if (br.left < minX) minX = br.left;
         if (br.top < minY) minY = br.top;
         if (br.left + br.width > maxX) maxX = br.left + br.width;
         if (br.top + br.height > maxY) maxY = br.top + br.height;
      });

      const currentW = maxX - minX;
      const currentH = maxY - minY;
      if (currentW <= 0 || currentH <= 0) return;

      const scaleX = innerW / currentW;
      const scaleY = innerH / currentH;
      const scale = Math.min(scaleX, scaleY);

      const targetCenterX = board.x + board.width / 2;
      const targetCenterY = board.y + board.height / 2;
      const currentCenterX = minX + currentW / 2;
      const currentCenterY = minY + currentH / 2;

      const dx = targetCenterX - currentCenterX;
      const dy = targetCenterY - currentCenterY;

      const commands: Command[] = [];
      items.forEach(item => {
         const beforeState = { left: item.left, top: item.top, scaleX: item.scaleX, scaleY: item.scaleY };

         // Transform relative to current center
         const relX = item.left - currentCenterX;
         const relY = item.top - currentCenterY;

         const newLeft = targetCenterX + relX * scale;
         const newTop = targetCenterY + relY * scale;
         const newScaleX = item.scaleX * scale;
         const newScaleY = item.scaleY * scale;

         const afterState = { left: newLeft, top: newTop, scaleX: newScaleX, scaleY: newScaleY };
         item.set(afterState);
         item.setCoords();

         commands.push(new TransformObjectsCommand(
            "Auto-Fit Collage Block",
            [{ obj: item, before: beforeState, after: afterState }]
         ));
      });

      canvas.requestRenderAll();
      if (commands.length > 0) {
         executeCommand(new MacroCommand("Auto-Fit Collage", commands));
      }
   };

   const fillCollageBlockWithImage = (imageFile: File) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const active = canvas.getActiveObject();
      if (!active || !(active as any).isCollageBlock) {
         return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
         const dataUrl = e.target?.result as string;
         const rect = active as fabric.Rect;

         const beforeState = { collageImageSrc: (rect as any).collageImageSrc };
         const afterState = { collageImageSrc: dataUrl };

         (rect as any).collageImageSrc = dataUrl;
         canvas.requestRenderAll();

         const cmd = new StyleChangeCommand("Fill Block with Image", rect, beforeState, afterState);
         executeCommand(cmd);
      };
      reader.readAsDataURL(imageFile);
   };

   const updateCollageBlockStyleProperty = (prop: string, value: any) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const active = canvas.getActiveObject();
      if (!active) return;

      const items: fabric.Object[] = [];
      if (active.type === 'activeSelection') {
         (active as fabric.ActiveSelection).getObjects().forEach(o => {
            if ((o as any).isCollageBlock) items.push(o);
         });
      } else if ((active as any).isCollageBlock) {
         items.push(active);
      }

      if (items.length === 0) return;

      const commands: Command[] = [];
      items.forEach(item => {
         const before: any = {};
         const after: any = {};

         if (prop === 'fill') {
            before.fill = item.get('fill');
            after.fill = value;
            setCollageBgColor(value);
         } else if (prop === 'stroke') {
            before.stroke = item.get('stroke');
            before.strokeWidth = item.get('strokeWidth');
            before.strokeDashArray = item.get('strokeDashArray');

            after.stroke = value;
            setCollageBorderColor(value);

            // Auto-activate the outline if thickness is 0 or style is none
            const currentWidth = item.get('strokeWidth') ?? 0;
            const currentStroke = item.get('stroke');
            if (collageBorderStyle === 'none' || currentWidth === 0 || currentStroke === 'transparent') {
               const newWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
               after.strokeWidth = newWidth;
               after.strokeDashArray = null;
               setCollageBorderWidth(newWidth);
               setCollageBorderStyle('solid');
            }
         } else if (prop === 'strokeWidth') {
            before.strokeWidth = item.get('strokeWidth');
            before.stroke = item.get('stroke');
            before.strokeDashArray = item.get('strokeDashArray');

            after.strokeWidth = value;
            setCollageBorderWidth(value);

            // Auto-set border color and style if outline gains thickness
            const currentStroke = item.get('stroke');
            if (value > 0 && (collageBorderStyle === 'none' || currentStroke === 'transparent' || !currentStroke)) {
               after.stroke = collageBorderColor || '#555555';
               after.strokeDashArray = null;
               setCollageBorderStyle('solid');
            } else if (value === 0) {
               after.stroke = 'transparent';
               after.strokeDashArray = null;
               setCollageBorderStyle('none');
            }
         } else if (prop === 'rx') {
            before.cornerRoundingPercent = (item as any).cornerRoundingPercent;
            before.rx = (item as fabric.Rect).rx || 0;
            before.ry = (item as fabric.Rect).ry || 0;
            after.cornerRoundingPercent = value;
            after.rx = value;
            after.ry = value;
            setCollageCornerRadius(value);
         } else if (prop === 'rx_tl') {
            before.cornerTopLeftPercent = (item as any).cornerTopLeftPercent;
            after.cornerTopLeftPercent = value;
            setCollageCornerTL(value);
         } else if (prop === 'rx_tr') {
            before.cornerTopRightPercent = (item as any).cornerTopRightPercent;
            after.cornerTopRightPercent = value;
            setCollageCornerTR(value);
         } else if (prop === 'rx_bl') {
            before.cornerBottomLeftPercent = (item as any).cornerBottomLeftPercent;
            after.cornerBottomLeftPercent = value;
            setCollageCornerBL(value);
         } else if (prop === 'rx_br') {
            before.cornerBottomRightPercent = (item as any).cornerBottomRightPercent;
            after.cornerBottomRightPercent = value;
            setCollageCornerBR(value);
         } else if (prop === 'useIndividualCorners') {
            before.useIndividualCorners = (item as any).useIndividualCorners;
            after.useIndividualCorners = value;
            setUseIndividualCorners(value);
         } else if (prop === 'borderStyle') {
            before.stroke = item.get('stroke');
            before.strokeWidth = item.get('strokeWidth');
            before.strokeDashArray = item.get('strokeDashArray');

            setCollageBorderStyle(value);
            if (value === 'none') {
               after.stroke = 'transparent';
               after.strokeWidth = 0;
               after.strokeDashArray = null;
            } else if (value === 'dashed') {
               after.stroke = collageBorderColor || '#555555';
               after.strokeWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
               after.strokeDashArray = [5, 5];
            } else {
               after.stroke = collageBorderColor || '#555555';
               after.strokeWidth = collageBorderWidth > 0 ? collageBorderWidth : 2;
               after.strokeDashArray = null;
            }
         } else {
            // Support for generic properties (e.g., collageImageFit, collageImageZoom, collageImagePanX)
            before[prop] = item.get(prop as any) ?? (item as any)[prop];
            after[prop] = value;
         }

         item.set(after);
         item.dirty = true;
         commands.push(new StyleChangeCommand("Update Collage Block Style", item, before, after));
      });

      if (commands.length > 0) {
         const macro = new MacroCommand("Apply Collage Custom Style", commands);
         executeCommand(macro);
         canvas.requestRenderAll();
      }
   };

   const updateSelectedShapeProperty = (prop: string, value: any) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const active = canvas.getActiveObject();
      if (!active) return;

      const items: fabric.Object[] = [];
      const allowedTypes = ['rect', 'circle', 'triangle', 'line', 'image', 'i-text', 'textbox', 'path'];

      if (active.type === 'activeSelection') {
         (active as fabric.ActiveSelection).getObjects().forEach(o => {
            if (allowedTypes.includes(o.type || '')) items.push(o);
         });
      } else if (allowedTypes.includes(active.type || '')) {
         items.push(active);
      }

      if (items.length === 0) return;

      const commands: Command[] = [];
      items.forEach(item => {
         const before: any = {};
         const after: any = {};

         if (prop === 'fill') {
            before.fill = item.get('fill');
            after.fill = value;
            setShapeFillColor(value);
         } else if (prop === 'stroke') {
            before.stroke = item.get('stroke');
            before.strokeWidth = item.get('strokeWidth');
            before.strokeDashArray = item.get('strokeDashArray');

            after.stroke = value;
            setShapeStrokeColor(value);

            const currentWidth = item.get('strokeWidth') ?? 0;
            const currentStroke = item.get('stroke');
            if (shapeBorderStyle === 'none' || currentWidth === 0 || currentStroke === 'transparent') {
               const newWidth = shapeStrokeWidth > 0 ? shapeStrokeWidth : 2;
               after.strokeWidth = newWidth;
               after.strokeDashArray = null;
               setShapeStrokeWidth(newWidth);
               setShapeBorderStyle('solid');
            }
         } else if (prop === 'strokeWidth') {
            before.strokeWidth = item.get('strokeWidth');
            before.stroke = item.get('stroke');
            before.strokeDashArray = item.get('strokeDashArray');

            after.strokeWidth = value;
            setShapeStrokeWidth(value);

            const currentStroke = item.get('stroke');
            if (value > 0 && (shapeBorderStyle === 'none' || currentStroke === 'transparent' || !currentStroke)) {
               after.stroke = shapeStrokeColor || '#000000';
               after.strokeDashArray = null;
               setShapeBorderStyle('solid');
            } else if (value === 0) {
               after.stroke = 'transparent';
               after.strokeDashArray = null;
               setShapeBorderStyle('none');
            }
         } else if (prop === 'opacity') {
            before.opacity = item.get('opacity');
            after.opacity = value / 100;
            setShapeOpacity(value);
         } else if (prop === 'globalCompositeOperation') {
            before.globalCompositeOperation = item.get('globalCompositeOperation');
            after.globalCompositeOperation = value;
            setShapeBlendMode(value);
         } else if (prop === 'strokeLineJoin') {
            before.strokeLineJoin = item.get('strokeLineJoin');
            after.strokeLineJoin = value;
            setShapeStrokeLineJoin(value);
         } else if (prop === 'strokeLineCap') {
            before.strokeLineCap = item.get('strokeLineCap');
            after.strokeLineCap = value;
            setShapeStrokeLineCap(value);
         } else if (prop === 'borderStyle') {
            before.stroke = item.get('stroke');
            before.strokeWidth = item.get('strokeWidth');
            before.strokeDashArray = item.get('strokeDashArray');

            setShapeBorderStyle(value);
            if (value === 'none') {
               after.stroke = 'transparent';
               after.strokeWidth = 0;
               after.strokeDashArray = null;
            } else if (value === 'dashed') {
               after.stroke = shapeStrokeColor || '#000000';
               after.strokeWidth = shapeStrokeWidth > 0 ? shapeStrokeWidth : 2;
               after.strokeDashArray = [5, 5];
            } else {
               after.stroke = shapeStrokeColor || '#000000';
               after.strokeWidth = shapeStrokeWidth > 0 ? shapeStrokeWidth : 2;
               after.strokeDashArray = null;
            }
         } else if (item.type === 'rect') {
            if (prop === 'rx') {
               before.cornerRoundingPercent = (item as any).cornerRoundingPercent;
               before.rx = (item as fabric.Rect).rx || 0;
               before.ry = (item as fabric.Rect).ry || 0;
               after.cornerRoundingPercent = value;
               after.rx = value;
               after.ry = value;
               setShapeCornerRadius(value);
            } else if (prop === 'rx_tl') {
               before.cornerTopLeftPercent = (item as any).cornerTopLeftPercent;
               after.cornerTopLeftPercent = value;
               setShapeCornerTL(value);
            } else if (prop === 'rx_tr') {
               before.cornerTopRightPercent = (item as any).cornerTopRightPercent;
               after.cornerTopRightPercent = value;
               setShapeCornerTR(value);
            } else if (prop === 'rx_bl') {
               before.cornerBottomLeftPercent = (item as any).cornerBottomLeftPercent;
               after.cornerBottomLeftPercent = value;
               setShapeCornerBL(value);
            } else if (prop === 'rx_br') {
               before.cornerBottomRightPercent = (item as any).cornerBottomRightPercent;
               after.cornerBottomRightPercent = value;
               setShapeCornerBR(value);
            } else if (prop === 'useIndividualCorners') {
               before.useIndividualCorners = (item as any).useIndividualCorners;
               after.useIndividualCorners = value;
               setShapeUseIndividualCorners(value);
            }
         }

         item.set(after);
         item.dirty = true;
         commands.push(new StyleChangeCommand("Update Shape Style", item, before, after));
      });

      if (commands.length > 0) {
         const macro = new MacroCommand("Apply Shape Style", commands);
         executeCommand(macro);
         canvas.requestRenderAll();
      }
   };

   const generateBleed = (isNegative?: boolean) => {
      if (!activeArtboardId) return;
      const board = artboards.find(b => b.id === activeArtboardId);
      if (!board) return;

      // 0.125 inch at 300 DPI = 37.5px. At 72 DPI (web default) = 9px. Let's use 9px for standard screens.
      const bleedAmount = 18; // 9px per side
      const bleedPx = isNegative ? -bleedAmount : bleedAmount;

      const commands: Command[] = [];

      const newWidth = Math.max(1, board.width + bleedPx);
      const newHeight = Math.max(1, board.height + bleedPx);

      // Update artboard props
      commands.push(new ArtboardPropertyCommand("Adjust width for bleed", board.id, 'width', board.width, newWidth, setArtboards));
      commands.push(new ArtboardPropertyCommand("Adjust height for bleed", board.id, 'height', board.height, newHeight, setArtboards));

      if (!isNegative) {
         commands.push(new ArtboardPropertyCommand("Enable bleed guide", board.id, 'showBleed', board.showBleed, true, setArtboards));
      }

      const macro = new MacroCommand(`${isNegative ? 'Remove' : 'Generate'} Bleed`, commands);
      executeCommand(macro);
   };

   const createArtboard = (presetName?: string, customW = 800, customH = 600) => {
      let w = customW;
      let h = customH;
      let name = "Custom Artboard";

      if (presetName) {
         const preset = ARTBOARD_PRESETS.find(p => p.name === presetName);
         if (preset) {
            w = preset.width;
            h = preset.height;
            name = preset.name;
         }
      }

      let maxX = 0;
      artboards.forEach((board) => {
         maxX = Math.max(maxX, board.x + board.width);
      });
      const x = maxX + 100;
      const y = 100;

      const count = artboards.filter(b => b.name.startsWith(name)).length;
      const finalName = count > 0 ? `${name} ${count + 1}` : name;

      const newBoard: Artboard = {
         id: "board_" + Date.now().toString() + Math.random().toString().substring(2, 6),
         name: finalName,
         x,
         y,
         width: w,
         height: h,
         backgroundColor: "#ffffff",
         transparent: false,
         dpi: 72,
         orientation: w >= h ? "landscape" : "portrait",
         showGrid: false,
         showSafeArea: false,
         showMargins: false,
         showBleed: false,
         showCenter: false,
      };

      const beforeBoards = [...artboards];
      const afterBoards = [...artboards, newBoard];
      const beforeActiveId = activeArtboardId;
      const afterActiveId = newBoard.id;

      const cmd = new ArtboardStateCommand("Create Artboard", beforeBoards, afterBoards, beforeActiveId, afterActiveId, setArtboards, setActiveArtboardId);
      executeCommand(cmd);

      setSelectedExportIds(prev => ({ ...prev, [newBoard.id]: true }));

      if (fabricRef.current) {
         const cw = fabricRef.current.width!;
         const ch = fabricRef.current.height!;
         const vpt = fabricRef.current.viewportTransform!;
         vpt[0] = 1.0;
         vpt[3] = 1.0;
         vpt[4] = cw / 2 - (newBoard.x + newBoard.width / 2);
         vpt[5] = ch / 2 - (newBoard.y + newBoard.height / 2);
         fabricRef.current.requestRenderAll();
      }
   };

   const addArtboard = createArtboard; // Alias for context menu

   const duplicateArtboard = (board: Artboard) => {
      let maxX = 0;
      artboards.forEach((b) => {
         maxX = Math.max(maxX, b.x + b.width);
      });
      const x = maxX + 100;

      const duplicated: Artboard = {
         ...board,
         id: "board_" + Date.now().toString() + Math.random().toString().substring(2, 6),
         name: `${board.name} Copy`,
         x,
         y: board.y,
      };

      let canvasObjectsToClone: fabric.Object[] = [];
      if (fabricRef.current) {
         const activeObjs = fabricRef.current.getObjects();
         activeObjs.forEach((o) => {
            if ((o as any).artboardId === board.id) {
               canvasObjectsToClone.push(o);
            }
         });
      }

      const cmd = new DuplicateArtboardCommand(
         board,
         duplicated,
         canvasObjectsToClone,
         setArtboards,
         setActiveArtboardId,
         updateLayersList
      );
      executeCommand(cmd);
      setSelectedExportIds(prev => ({ ...prev, [duplicated.id]: true }));

      // Center viewport on new board
      if (fabricRef.current) {
         const canvas = fabricRef.current;
         const cw = canvas.width!;
         const ch = canvas.height!;
         const vpt = canvas.viewportTransform!;
         vpt[4] = cw / 2 - (duplicated.x + duplicated.width / 2) * vpt[0];
         vpt[5] = ch / 2 - (duplicated.y + duplicated.height / 2) * vpt[3];
         canvas.requestRenderAll();
      }
   };

   const deleteArtboard = (id: string) => {
      const idx = artboards.findIndex(b => b.id === id);
      if (idx === -1) return;
      const boardToDelete = artboards[idx];
      const prevActiveId = activeArtboardId;
      let newActiveId = activeArtboardId;
      if (activeArtboardId === id) {
         const updated = artboards.filter(b => b.id !== id);
         const nextActive = updated.length > 0 ? updated[idx === 0 ? 0 : idx - 1] : null;
         newActiveId = nextActive ? nextActive.id : "artboard_default";
      }

      const cmd = new DeleteArtboardCommand(
         boardToDelete,
         prevActiveId,
         newActiveId,
         idx,
         setArtboards,
         setActiveArtboardId
      );
      executeCommand(cmd);
   };

   const updateArtboardProp = (id: string, prop: keyof Artboard, val: any) => {
      setArtboards((prev) => {
         return prev.map((board) => {
            if (board.id !== id) return board;
            let updated = { ...board, [prop]: val };

            // Update orientation if dimensions change
            if (prop === "width" || prop === "height") {
               const w = prop === "width" ? val : board.width;
               const h = prop === "height" ? val : board.height;
               updated.orientation = w >= h ? "landscape" : "portrait";
            }

            // Handle explicit orientation change via swap
            if (prop === "orientation") {
               const newOrientation = val as "portrait" | "landscape";
               if (newOrientation === "portrait" && board.width > board.height) {
                  updated.width = board.height;
                  updated.height = board.width;
               } else if (newOrientation === "landscape" && board.width < board.height) {
                  updated.width = board.height;
                  updated.height = board.width;
               }
            }

            // Sync transparent checkbox with background alpha
            if (prop === "backgroundColor") {
               const color = val as string;
               if (color.startsWith('rgba(')) {
                  const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
                  if (parts && parts[4] && parseFloat(parts[4]) === 0) {
                     updated.transparent = true;
                  } else {
                     updated.transparent = false;
                  }
               } else {
                  updated.transparent = false;
               }
            }

            if (prop === "transparent") {
               const isTransparent = val as boolean;
               const currentColor = board.backgroundColor || "#ffffff";
               if (isTransparent) {
                  updated.backgroundColor = setOpacityOnHex(currentColor, 0);
               } else {
                  const parts = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
                  if (parts && parts[4] && parseFloat(parts[4]) === 0) {
                     updated.backgroundColor = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, 1)`;
                  }
               }
            }

            return updated;
         });
      });

      if (fabricRef.current) {
         fabricRef.current.requestRenderAll();
      }
   };

   const updateArtboardPropDirect = (id: string, prop: keyof Artboard, val: any, commitOption = false) => {
      const board = artboards.find(b => b.id === id);
      if (!board) return;
      const beforeVal = board[prop];
      if (beforeVal === val) return;

      if (commitOption) {
         const labelMap: Record<string, string> = {
            transparent: "Toggle Transparency",
            showGrid: "Toggle Grid",
            showSafeArea: "Toggle Safe Area",
            showMargins: "Toggle Margins",
            showBleed: "Toggle Bleed",
            showCenter: "Toggle Center Guides",
            orientation: "Change Orientation"
         };
         const cmdName = labelMap[prop] || `Change Artboard ${String(prop)}`;
         const cmd = new ArtboardPropertyCommand(cmdName, id, prop, beforeVal, val, setArtboards);
         executeCommand(cmd);
      } else {
         updateArtboardProp(id, prop, val);
      }
   };

   const moveArtboard = (sourceIndex: number, destIndex: number) => {
      if (sourceIndex === destIndex) return;
      const newArtboards = [...artboards];
      const [removed] = newArtboards.splice(sourceIndex, 1);
      newArtboards.splice(destIndex, 0, removed);

      // Command history integration
      const cmd: Command = {
         name: "Reorder Artboards",
         execute: () => { setArtboards(newArtboards); },
         undo: () => {
            const revertArtboards = [...newArtboards];
            const [popped] = revertArtboards.splice(destIndex, 1);
            revertArtboards.splice(sourceIndex, 0, popped);
            setArtboards(revertArtboards);
         },
         redo: () => { setArtboards(newArtboards); }
      };
      executeCommand(cmd);
   };

   // Dynamic Brush Settings Configurator
   const applyBrushSettings = useCallback((
      type = brushType,
      color = brushColor,
      size = brushSize,
      opt = brushOpacity,
      fl = brushFlow,
      hd = brushHardness,
      smooth = brushSmoothing
   ) => {
      if (!fabricRef.current) return;

      // Combine base opacity and flow to determine final pixel paint density
      const calculatedOpacity = (opt / 100) * (fl / 100) * 100;
      const colorWithOpacity = setOpacityOnHex(color, calculatedOpacity);

      if (activeTool === "eraser") {
         const brush = new fabric.PencilBrush(fabricRef.current);
         brush.color = '#1e1e1e';
         brush.width = size * 2;
         fabricRef.current.freeDrawingBrush = brush;
         fabricRef.current.isDrawingMode = true;
         return;
      }

      if (activeTool !== "brush") {
         fabricRef.current.isDrawingMode = false;
         return;
      }

      fabricRef.current.isDrawingMode = true;
      let brush: fabric.BaseBrush;

      if (type === 'airbrush') {
         const b = new fabric.SprayBrush(fabricRef.current);
         b.width = size;
         b.color = colorWithOpacity;
         b.density = Math.round(fl / 1.5);
         b.dotWidth = Math.max(1, size / 12);
         brush = b;
      } else if (type === 'spray') {
         const b = new fabric.SprayBrush(fabricRef.current);
         b.width = size * 1.5;
         b.color = colorWithOpacity;
         b.density = Math.round(fl / 3.5);
         b.dotWidth = Math.max(1, size / 9);
         brush = b;
      } else if (type === 'chalk') {
         const b = new fabric.PatternBrush(fabricRef.current);
         const chalkCanvas = document.createElement('canvas');
         chalkCanvas.width = 12;
         chalkCanvas.height = 12;
         const ctx = chalkCanvas.getContext('2d')!;
         ctx.fillStyle = colorWithOpacity;
         for (let i = 0; i < 11; i++) {
            ctx.fillRect(Math.random() * 12, Math.random() * 12, 1.5, 1.5);
         }
         b.getPatternSrc = () => chalkCanvas;
         b.width = size;
         brush = b;
      } else if (type === 'pattern_dots' || type === 'pattern_dashed' || type === 'pattern_texture' || type === 'pattern_decorative' || type === 'pattern_repeating_shapes') {
         const b = new fabric.PatternBrush(fabricRef.current);
         const patType = type.replace("pattern_", "");
         const patternSource = createPatternSource(patType, colorWithOpacity, size);
         b.getPatternSrc = () => patternSource;
         b.width = size * 2;
         brush = b;
      } else if (type === 'watercolor') {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = size;
         b.color = setOpacityOnHex(color, opt * (fl / 100) * 0.15);
         b.shadow = new fabric.Shadow({
            color: setOpacityOnHex(color, opt * (fl / 100) * 0.4),
            blur: size * 0.7,
            offsetX: 0,
            offsetY: 0
         });
         brush = b;
      } else if (type === 'ink') {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = size;
         b.color = colorWithOpacity;
         b.shadow = new fabric.Shadow({
            color: setOpacityOnHex(color, opt * (fl / 100) * 0.2),
            blur: 1,
            offsetX: 0.5,
            offsetY: 0.5
         });
         brush = b;
      } else if (type === 'highlighter') {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = size * 1.5;
         b.color = setOpacityOnHex(color, 40 * (fl / 100));
         b.strokeLineCap = 'square';
         brush = b;
      } else if (type === 'calligraphy') {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = size;
         b.color = colorWithOpacity;
         b.strokeLineCap = 'square';
         brush = b;
      } else if (type === 'pixel') {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = Math.max(1, size);
         b.color = colorWithOpacity;
         brush = b;
      } else {
         const b = new fabric.PencilBrush(fabricRef.current);
         b.width = size;
         b.color = colorWithOpacity;

         if (type === 'pencil') {
            b.strokeLineCap = 'round';
         } else if (type === 'brush') {
            b.shadow = new fabric.Shadow({
               color: setOpacityOnHex(color, calculatedOpacity * 0.5),
               blur: (1 - (hd / 100)) * (size / 1.2),
               offsetX: 0,
               offsetY: 0
            });
         } else if (type === 'marker') {
            b.strokeLineCap = 'square';
            b.strokeLineJoin = 'miter';
         }
         brush = b;
      }

      // Fallback to brush-wide soft shading if hardness is low and type supports shadows
      if (hd < 100 && brush instanceof fabric.PencilBrush && type !== 'highlighter' && type !== 'watercolor' && type !== 'ink') {
         brush.shadow = new fabric.Shadow({
            color: setOpacityOnHex(color, calculatedOpacity),
            blur: (1 - (hd / 100)) * size * 1.5,
            offsetX: 0,
            offsetY: 0
         });
      }

      if ((brush as any).decimate !== undefined) {
         (brush as any).decimate = (smooth / 100) * 12;
      }

      fabricRef.current.freeDrawingBrush = brush;
   }, [activeTool, brushType, brushColor, brushSize, brushOpacity, brushFlow, brushHardness, brushSmoothing]);

   // Synchronise settings triggered on state changes
   useEffect(() => {
      applyBrushSettings();
   }, [activeTool, brushType, brushColor, brushSize, brushOpacity, brushFlow, brushHardness, brushSmoothing, applyBrushSettings]);

   // Load custom presets on launch
   useEffect(() => {
      try {
         const saved = localStorage.getItem("workspace_custom_filters_presets");
         if (saved) {
            setCustomPresets(JSON.parse(saved));
         }
      } catch (e) {
         console.error("Error loading presets from store:", e);
      }
   }, []);

   // File loading
   const storedData = getValueAtPath(parsedData, path);

   useEffect(() => {
      if (!canvasRef.current || !containerRef.current) return;

      // Initialize Fabric Canvas
      const canvas = new fabric.Canvas(canvasRef.current, {
         width: containerRef.current.clientWidth - panelWidthRef.current,
         height: containerRef.current.clientHeight - 48, // minus header
         preserveObjectStacking: true,
         selection: true,
         stopContextMenu: false,
      });
      fabricRef.current = canvas;

      // Initial load State
      isInternalChange.current = true;

      const initImg = async () => {
         let resolveUrl = "";
         if (typeof storedData === 'string') {
            if (storedData.startsWith('data:image') || storedData.startsWith('blob:') || storedData.startsWith('http')) {
               resolveUrl = storedData;
            } else if (storedData.startsWith('img_') || storedData.startsWith('thumb_')) {
               resolveUrl = await resolveAssetUrl(storedData);
            }
         } else if (storedData && typeof storedData === 'object') {
            const id = (storedData as any).assetId || (storedData as any).assetRef || ((storedData as any)._type === "media" ? (storedData as any).assetId : null);
            if (id) {
               resolveUrl = await resolveAssetUrl(id);
            } else if ((storedData as any).url) {
               const urlStr = (storedData as any).url;
               if (urlStr.startsWith('img_') || urlStr.startsWith('thumb_')) {
                  resolveUrl = await resolveAssetUrl(urlStr);
               } else {
                  resolveUrl = urlStr;
               }
            }
         }

         if (resolveUrl) {
            fabric.Image.fromURL(resolveUrl).then((img) => {
               if (img) {
                  (img as any).id = Date.now().toString() + Math.random().toString();

                  // Center inside default artboard
                  const board = artboardsRef.current[0];
                  if (board) {
                     img.left = board.x + (board.width - (img.width! * (img.scaleX ?? 1))) / 2;
                     img.top = board.y + (board.height - (img.height! * (img.scaleY ?? 1))) / 2;
                  }

                  canvas.add(img);
                  canvas.setActiveObject(img);

                  setTimeout(fitView, 50);
                  canvas.renderAll();
                  updateLayersList();
               }
            }).catch(err => {
               console.error("Failed to load fabric image from source:", err);
               fitView();
               updateLayersList();
            });
         } else {
            fitView();
            updateLayersList();
         }
         isInternalChange.current = false;
      };

      loadFromDexie(path, canvas).then((loadedArtboards) => {
         if (loadedArtboards && loadedArtboards.length > 0) {
            setArtboards(loadedArtboards);
         } else {
            setArtboards([{
               id: "artboard_default",
               name: "Artboard 1",
               x: 100,
               y: 100,
               width: 800,
               height: 600,
               backgroundColor: "#ffffff",
               borderColor: "rgba(100, 116, 139, 0.5)",
               transparent: false,
               dpi: 72,
               orientation: "landscape",
               showGrid: false,
               showSafeArea: false,
               showMargins: false,
               showBleed: false,
               showCenter: false,
            }]);
         }

         const rebuildRecursively = (objs: any[]) => {
            const filtersObj = (fabric as any).Image?.filters || (fabric as any).filters;
            objs.forEach(o => {
               if (o.type === 'group' || o.get?.('isFrameGroup') || o.objects) {
                  if (typeof o.getObjects === 'function') {
                     rebuildRecursively(o.getObjects());
                  } else if (Array.isArray(o.objects)) {
                     rebuildRecursively(o.objects);
                  }
               }
               if (o.customFilters && o.customFilters.length > 0) {
                  rebuildFabricFilters(o, filtersObj);
               }
            });
         };
         if (fabricRef.current) rebuildRecursively(fabricRef.current.getObjects());
         fabricRef.current?.requestRenderAll();

         setIsLoaded(true);

         if (fabricRef.current && fabricRef.current.getObjects().length === 0) {
            initImg();
         } else {
            setTimeout(fitView, 100);
            updateLayersList();
            isInternalChange.current = false;
         }
      }).catch(err => {
         console.error("Dexie load error", err);
         setIsLoaded(true);
         initImg();
      });

      // Window resize handler
      let initialFitDone = false;
      const resizeObserver = new ResizeObserver((entries) => {
         for (const entry of entries) {
            if (entry.target === containerRef.current && fabricRef.current) {
               const isMob = isMobileRef.current;
               const w = entry.contentRect.width - (isMob ? 0 : panelWidthRef.current);
               const h = entry.contentRect.height - (isMob ? (48 + 40 + 56) : (48 + 40));

               fabricRef.current.setDimensions({
                  width: w > 100 ? w : 100,
                  height: h > 100 ? h : 100
               });
               fabricRef.current.renderAll();

               if (!initialFitDone && w > 150 && h > 150) {
                  initialFitDone = true;
                  // Delay slightly to ensure browser rendering cycles completed
                  setTimeout(() => {
                     fitView();
                  }, 80);
               }
            }
         }
      });
      resizeObserver.observe(containerRef.current);

      // Render and background rules
      canvas.on('before:render', (opt) => {
         const ctx = opt.ctx;
         const vpt = canvas.viewportTransform;
         // Only draw on the lower canvas to avoid ghosting on cache/top canvases
         if (!ctx || !vpt || ctx !== canvas.getContext()) return;

         // 1. Clear workspace background (raw pixels)
         ctx.save();
         ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure identity
         ctx.fillStyle = "#121212";
         ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
         ctx.restore();

         let boards = artboardsRef.current || [];
         if (isMobileRef.current) {
            boards = boards.filter(b => b.id === activeArtboardIdRef.current);
         }

         // 2. Draw shadows (raw pixels for consistent blur)
         ctx.save();
         ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
         ctx.shadowBlur = 15;
         ctx.shadowOffsetX = 0;
         ctx.shadowOffsetY = 8;
         ctx.fillStyle = "#121212"; // Match workspace to avoid ghosting

         boards.forEach((board) => {
            const x = board.x * vpt[0] + vpt[4];
            const y = board.y * vpt[3] + vpt[5];
            const w = board.width * vpt[0];
            const h = board.height * vpt[3];
            ctx.fillRect(x, y, w, h);
         });
         ctx.restore();

         // 3. Draw backgrounds (transformed)
         ctx.save();
         ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

         boards.forEach((board) => {
            if (!board.transparent) {
               ctx.fillStyle = board.backgroundColor || "#ffffff";
               ctx.fillRect(board.x, board.y, board.width, board.height);
            } else {
               ctx.save();
               ctx.beginPath();
               ctx.rect(board.x, board.y, board.width, board.height);
               ctx.clip();

               const patSize = 8;
               ctx.fillStyle = "#e2e8f0";
               const rows = Math.ceil(board.height / patSize);
               const cols = Math.ceil(board.width / patSize);
               for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                     if ((r + c) % 2 === 0) {
                        ctx.fillRect(board.x + c * patSize, board.y + r * patSize, patSize, patSize);
                     }
                  }
               }
               ctx.restore();
            }
         });
         ctx.restore();
      });

      canvas.on('after:render', (opt) => {
         const ctx = opt.ctx;
         const vpt = canvas.viewportTransform;
         if (!vpt || !ctx || ctx !== canvas.getContext()) return;

         let boards = artboardsRef.current || [];
         if (isMobileRef.current) {
            boards = boards.filter(b => b.id === activeArtboardIdRef.current);
         }

         // 1. Draw outer dimmask (in raw pixels)
         ctx.save();
         ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
         ctx.beginPath();
         // Use logical coordinates since ctx is already scaled by dpr
         ctx.rect(0, 0, canvas.width, canvas.height);

         boards.forEach((board) => {
            const x = (board.x * vpt[0] + vpt[4]);
            const y = (board.y * vpt[3] + vpt[5]);
            const w = (board.width * vpt[0]);
            const h = (board.height * vpt[3]);
            ctx.rect(x, y, w, h);
         });
         ctx.fill("evenodd");
         ctx.restore();

         // 2. Draw snapping guides
         if (guidesRef.current.length > 0) {
            ctx.save();
            ctx.strokeStyle = "#4ade80"; // Bright green for guides
            ctx.lineWidth = 1;

            guidesRef.current.forEach(guide => {
               if (guide.type === 'v') {
                  const x = guide.pos * vpt[0] + vpt[4];
                  ctx.beginPath();
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, canvas.height);
                  ctx.stroke();
               } else {
                  const y = guide.pos * vpt[3] + vpt[5];
                  ctx.beginPath();
                  ctx.moveTo(0, y);
                  ctx.lineTo(canvas.width, y);
                  ctx.stroke();
               }
            });
            ctx.restore();
         }

         // 3. Draw borders & labels (transformed)
         ctx.save();
         ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

         boards.forEach((board) => {
            const isActive = activeArtboardIdRef.current === board.id;

            // Base border (user defined border color)
            ctx.strokeStyle = board.borderColor || "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1 / vpt[0];
            ctx.strokeRect(board.x, board.y, board.width, board.height);

            // Active highlight (rendered outside/around the base border)
            if (isActive) {
               ctx.strokeStyle = "#6366f1";
               ctx.lineWidth = 2 / vpt[0];
               const offset = 1 / vpt[0];
               ctx.strokeRect(board.x - offset, board.y - offset, board.width + offset * 2, board.height + offset * 2);
            }

            if (board.showSafeArea) {
               ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
               ctx.lineWidth = 1 / vpt[0];
               ctx.setLineDash([4 / vpt[0], 4 / vpt[0]]);
               const dx = board.width * 0.05;
               const dy = board.height * 0.05;
               ctx.strokeRect(board.x + dx, board.y + dy, board.width - dx * 2, board.height - dy * 2);
               ctx.setLineDash([]);
            }

            if (board.showMargins) {
               ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
               ctx.lineWidth = 1 / vpt[0];
               ctx.setLineDash([2 / vpt[0], 2 / vpt[0]]);
               const dx = board.width * 0.1;
               const dy = board.height * 0.1;
               ctx.strokeRect(board.x + dx, board.y + dy, board.width - dx * 2, board.height - dy * 2);
               ctx.setLineDash([]);
            }

            if (board.showBleed) {
               ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
               ctx.lineWidth = 1.2 / vpt[0];
               const dx = board.width * 0.03;
               const dy = board.height * 0.03;
               ctx.strokeRect(board.x - dx, board.y - dy, board.width + dx * 2, board.height + dy * 2);
            }

            if (board.showCenter) {
               ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
               ctx.lineWidth = 0.5 / vpt[0];
               ctx.beginPath();
               ctx.moveTo(board.x + board.width / 2, board.y);
               ctx.lineTo(board.x + board.width / 2, board.y + board.height);
               ctx.moveTo(board.x, board.y + board.height / 2);
               ctx.lineTo(board.x + board.width, board.y + board.height / 2);
               ctx.stroke();
            }

            if (board.showGrid) {
               const step = 20;
               ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
               ctx.lineWidth = 0.5 / vpt[0];
               for (let gx = board.x; gx < board.x + board.width; gx += step) {
                  ctx.beginPath();
                  ctx.moveTo(gx, board.y);
                  ctx.lineTo(gx, board.y + board.height);
                  ctx.stroke();
               }
               for (let gy = board.y; gy < board.y + board.height; gy += step) {
                  ctx.beginPath();
                  ctx.moveTo(board.x, gy);
                  ctx.lineTo(board.x + board.width, gy);
                  ctx.stroke();
               }
            }
         });

         ctx.restore();

         // Draw Parent Alignment Object highlight if active
         if (parentAlignmentObjRef.current && fabricRef.current) {
            const activeObj = fabricRef.current.getActiveObject();
            // Check if the parent object is part of the current active selection
            if (activeObj && activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().includes(parentAlignmentObjRef.current)) {
               ctx.save();
               ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

               const bounds = getAbsoluteBoundingRect(parentAlignmentObjRef.current);

               // Draw a clear blue, thick line around the parent object
               ctx.strokeStyle = "#3b82f6";
               ctx.lineWidth = 3 / vpt[0];
               ctx.setLineDash([]);
               ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

               // Draw the PARENT text badge
               const badgeHeight = 16 / vpt[3];
               const badgeWidth = 48 / vpt[0];
               const badgeX = bounds.left;
               const badgeY = bounds.top - badgeHeight - (4 / vpt[3]);

               ctx.fillStyle = "#3b82f6";
               if (ctx.roundRect) {
                  ctx.beginPath();
                  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4 / vpt[0]);
                  ctx.fill();
               } else {
                  ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
               }

               ctx.fillStyle = "#ffffff";
               ctx.font = `bold ${8 / vpt[3]}px sans-serif`;
               ctx.textAlign = "center";
               ctx.textBaseline = "middle";
               ctx.fillText("PARENT", badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

               ctx.restore();
            }
         }

         const overlay = document.getElementById('artboard-ui-overlay');
         if (overlay) {
            const children = overlay.children;
            for (let i = 0; i < children.length; i++) {
               const el = children[i] as HTMLElement;
               const id = el.getAttribute('data-board-id');
               const board = boards.find(b => b.id === id);
               if (board) {
                  const x = board.x * vpt[0] + vpt[4];
                  const y = board.y * vpt[3] + vpt[5];
                  const visualWidth = board.width * vpt[0];
                  el.style.transform = `translate(${x}px, ${y}px)`;
                  el.style.width = `${visualWidth}px`;
               }
            }
         }
      });    // Panning & Zooming events
      // Touch / Pinch-to-zoom support
      let initialPinchDistance = 0;
      let initialZoom = 1;
      let initialPanX = 0;
      let initialPanY = 0;
      let initialMidpoint = { x: 0, y: 0 };

      // Dynamic brush size / opacity modification handlers
      const handleBrushAdjustMousemove = (e: MouseEvent) => {
         if (!isAdjustingBrushRef.current) return;
         e.preventDefault();
         e.stopPropagation();
         e.stopImmediatePropagation();

         const deltaX = e.clientX - startMouseXRef.current;
         const deltaY = e.clientY - startMouseYRef.current;

         const isCtrl = e.ctrlKey || isCtrlPressedRef.current;

         // Lock property based on first movement direction
         if (!hasLockedPropertyRef.current) {
            const distance = Math.hypot(deltaX, deltaY);
            if (distance < 5) return; // Wait for a non-trivial movement

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
               activeBrushPropertyRef.current = 'size';
               setActiveBrushProperty('size');
            } else {
               activeBrushPropertyRef.current = 'opacity';
               setActiveBrushProperty('opacity');
            }
            hasLockedPropertyRef.current = true;
         }

         let newSize = brushSizeRef.current;
         let newOpacity = brushOpacityRef.current;
         let newHardness = brushHardnessRef.current;

         if (activeBrushPropertyRef.current === 'size') {
            // Horizontal adjusts size (Drag right increases, Drag left decreases)
            newSize = Math.max(1, Math.min(500, Math.round(startBrushSizeRef.current + deltaX * 1.0)));
            setBrushSize(newSize);
            brushSizeRef.current = newSize;

         } else if (activeBrushPropertyRef.current === 'opacity') {
            // Vertical adjusts opacity (Drag up increases, Drag down decreases)
            newOpacity = Math.max(1, Math.min(100, Math.round(startBrushOpacityRef.current - deltaY * 0.7)));
            setBrushOpacity(newOpacity);
            brushOpacityRef.current = newOpacity;
         } else if (activeBrushPropertyRef.current === 'hardness') {
            // Vertical adjusts hardness (Drag up increases, Drag down decreases)
            newHardness = Math.max(0, Math.min(100, Math.round(startBrushHardnessRef.current - deltaY * 0.7)));
            setBrushHardness(newHardness);
            brushHardnessRef.current = newHardness;
         }

         applyBrushSettings(
            brushTypeRef.current,
            brushColorRef.current,
            newSize,
            newOpacity,
            brushFlowRef.current,
            newHardness,
            brushSmoothingRef.current
         );

         setShowHud(true);

         canvas.requestRenderAll();
      };

      const handleBrushAdjustMouseup = (e: MouseEvent) => {
         if (isAdjustingBrushRef.current) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            isAdjustingBrushRef.current = false;

            setHudFadingOut(true);
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => {
               setShowHud(false);
               setHudFadingOut(false);
            }, 500);
         }
         window.removeEventListener('mousemove', handleBrushAdjustMousemove, { capture: true });
         window.removeEventListener('mouseup', handleBrushAdjustMouseup, { capture: true });
      };

      const handleBrushAdjustMousedown = (e: MouseEvent) => {
         const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
         if (!isBrushActive) return;

         const isCtrl = e.ctrlKey || isCtrlPressedRef.current;

         if (isCtrl && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            isAdjustingBrushRef.current = true;
            hasLockedPropertyRef.current = false;

            // Sensible initial active property based on modifier keys
            const initialProp = 'size';
            activeBrushPropertyRef.current = initialProp;
            setActiveBrushProperty(initialProp);

            startBrushSizeRef.current = brushSizeRef.current;
            startBrushOpacityRef.current = brushOpacityRef.current;
            startBrushHardnessRef.current = brushHardnessRef.current;
            startMouseXRef.current = e.clientX;
            startMouseYRef.current = e.clientY;
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            setHudFadingOut(false);
            const rect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
            setHudPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setShowHud(true);

            window.addEventListener('mousemove', handleBrushAdjustMousemove, { capture: true });
            window.addEventListener('mouseup', handleBrushAdjustMouseup, { capture: true });
         }
      };

      const touchStartHandler = (e: TouchEvent) => {
         const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
         const hasModifier = isCtrlPressedRef.current;

         if (e.touches.length === 2 && isBrushActive && hasModifier) {
            e.preventDefault();
            e.stopPropagation();
            isAdjustingBrushTouchRef.current = true;
            hasLockedPropertyRef.current = false;

            const isCtrl = isCtrlPressedRef.current;

            // Initial setup
            const initialProp = 'size';
            activeBrushPropertyRef.current = initialProp;
            setActiveBrushProperty(initialProp);

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentMidX = (touch1.clientX + touch2.clientX) / 2;
            const currentMidY = (touch1.clientY + touch2.clientY) / 2;

            startBrushTouchSizeRef.current = brushSizeRef.current;
            startBrushTouchOpacityRef.current = brushOpacityRef.current;
            startBrushTouchHardnessRef.current = brushHardnessRef.current;
            startTouchXRef.current = currentMidX;
            startTouchYRef.current = currentMidY;

            const rect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
            setHudPosition({ x: currentMidX - rect.left, y: currentMidY - rect.top });
            setShowHud(true);
            canvas.selection = false;
            return;
         }

         if (e.touches.length === 2 && canvas.viewportTransform) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            initialPinchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            initialZoom = canvas.getZoom();

            initialMidpoint = {
               x: (touch1.clientX + touch2.clientX) / 2,
               y: (touch1.clientY + touch2.clientY) / 2
            };
            initialPanX = canvas.viewportTransform[4];
            initialPanY = canvas.viewportTransform[5];
            canvas.selection = false;
         }
      };

      const touchMoveHandler = (e: TouchEvent) => {
         if (isAdjustingBrushTouchRef.current && e.touches.length === 2) {
            e.preventDefault();
            e.stopPropagation();

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentMidX = (touch1.clientX + touch2.clientX) / 2;
            const currentMidY = (touch1.clientY + touch2.clientY) / 2;

            const deltaX = currentMidX - startTouchXRef.current;
            const deltaY = currentMidY - startTouchYRef.current;

            const isCtrl = isCtrlPressedRef.current;

            // Auto-lock axis on touch gesture
            if (!hasLockedPropertyRef.current) {
               const distance = Math.hypot(deltaX, deltaY);
               if (distance >= 5) {
                  if (Math.abs(deltaX) > Math.abs(deltaY)) {
                     activeBrushPropertyRef.current = 'size';
                     setActiveBrushProperty('size');
                  } else {
                     activeBrushPropertyRef.current = 'opacity';
                     setActiveBrushProperty('opacity');
                  }
                  hasLockedPropertyRef.current = true;
               }
            }

            let newSize = brushSizeRef.current;
            let newOpacity = brushOpacityRef.current;
            let newHardness = brushHardnessRef.current;

            if (activeBrushPropertyRef.current === 'size') {
               newSize = Math.max(1, Math.min(500, Math.round(startBrushTouchSizeRef.current + deltaX * 1.0)));
               setBrushSize(newSize);
               brushSizeRef.current = newSize;
            } else if (activeBrushPropertyRef.current === 'opacity') {
               newOpacity = Math.max(1, Math.min(100, Math.round(startBrushTouchOpacityRef.current - deltaY * 0.7)));
               setBrushOpacity(newOpacity);
               brushOpacityRef.current = newOpacity;
            } else if (activeBrushPropertyRef.current === 'hardness') {
               newHardness = Math.max(0, Math.min(100, Math.round(startBrushTouchHardnessRef.current - deltaY * 0.7)));
               setBrushHardness(newHardness);
               brushHardnessRef.current = newHardness;
            }

            applyBrushSettings(
               brushTypeRef.current,
               brushColorRef.current,
               newSize,
               newOpacity,
               brushFlowRef.current,
               newHardness,
               brushSmoothingRef.current
            );

            setShowHud(true);
            canvas.requestRenderAll();
            return;
         }

         if (e.touches.length === 2 && canvas.viewportTransform) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

            const scale = currentDistance / initialPinchDistance;
            let zoom = initialZoom * scale;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.05) zoom = 0.05;

            // Calculate current midpoint
            const currentMidpoint = {
               x: (touch1.clientX + touch2.clientX) / 2,
               y: (touch1.clientY + touch2.clientY) / 2
            };

            // We want to zoom into the midpoint
            const wrapperRect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
            const pt = new fabric.Point(
               currentMidpoint.x - wrapperRect.left,
               currentMidpoint.y - wrapperRect.top
            );

            canvas.zoomToPoint(pt, zoom);

            // Also add pan delta
            const vpt = canvas.viewportTransform;
            const newVpt = vpt.slice() as any;
            newVpt[4] += (currentMidpoint.x - initialMidpoint.x);
            newVpt[5] += (currentMidpoint.y - initialMidpoint.y);
            canvas.setViewportTransform(newVpt);

            setZoomPercent(Math.round(zoom * 100));

            initialMidpoint = currentMidpoint;
         }
      };

      const touchEndHandler = (e: TouchEvent) => {
         if (isAdjustingBrushTouchRef.current) {
            isAdjustingBrushTouchRef.current = false;
            setHudFadingOut(false);
            setShowHud(true);
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => {
               setHudFadingOut(true);
               hudTimeoutRef.current = setTimeout(() => {
                  setShowHud(false);
                  setHudFadingOut(false);
               }, 500);
            }, 800);
            canvas.selection = true;
            validateViewport();
            return;
         }

         if (e.touches.length < 2) {
            canvas.selection = true;
         }
         validateViewport();
      };

      const handleMousedownCapture = (e: MouseEvent) => {
         if (e.ctrlKey || e.metaKey) {
            const activeObj = canvas.getActiveObject();
            if (activeObj && activeObj.type === 'activeSelection') {
               const pointer = (canvas as any).getPointer(e);
               const selObjects = (activeObj as fabric.ActiveSelection).getObjects();
               let clickedSubObject: fabric.Object | null = null;

               for (let i = selObjects.length - 1; i >= 0; i--) {
                  const obj = selObjects[i];

                  // Calculate point in local coordinates using inverse transform matrix
                  const matrix = obj.calcTransformMatrix();
                  const inverted = fabric.util.invertTransform(matrix);
                  const localPt = fabric.util.transformPoint(pointer, inverted);

                  const halfW = (obj.width || 0) / 2;
                  const halfH = (obj.height || 0) / 2;

                  const inside = (localPt.x >= -halfW && localPt.x <= halfW && localPt.y >= -halfH && localPt.y <= halfH);

                  if (inside) {
                     clickedSubObject = obj;
                     break;
                  }
               }

               if (clickedSubObject) {
                  e.preventDefault();
                  e.stopPropagation();

                  if (parentAlignmentObjRef.current === clickedSubObject) {
                     parentAlignmentObjRef.current = null;
                     setParentAlignmentObj(null);
                  } else {
                     parentAlignmentObjRef.current = clickedSubObject;
                     setParentAlignmentObj(clickedSubObject);
                  }

                  canvas.requestRenderAll();
               }
            }
         }
      };

      // Attach native events to wrapper
      const upperCanvas = canvas.upperCanvasEl;
      if (upperCanvas) {
         upperCanvas.addEventListener('touchstart', touchStartHandler as any, { passive: false });
         upperCanvas.addEventListener('touchmove', touchMoveHandler as any, { passive: false });
         upperCanvas.addEventListener('touchend', touchEndHandler as any);
         upperCanvas.addEventListener('mousedown', handleMousedownCapture, true);
         upperCanvas.addEventListener('mousedown', handleBrushAdjustMousedown, true);
      }

      canvas.on('mouse:wheel', (opt) => {
         const e = opt.e;
         const isBrushActive = activeToolRef.current === 'brush' || activeToolRef.current === 'eraser';
         if (isBrushActive && (e.ctrlKey || isCtrlPressedRef.current)) {
            e.preventDefault();
            e.stopPropagation();

            let delta = -e.deltaY;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
               delta = -e.deltaX;
            }

            const step = Math.sign(delta) * 1.5; // Scale slightly for zoom speed parity
            const currentSize = brushSizeRef.current;
            const newSize = Math.max(1, Math.min(500, Math.round(currentSize + step)));
            setBrushSize(newSize);
            brushSizeRef.current = newSize;
            activeBrushPropertyRef.current = 'size';
            setActiveBrushProperty('size');

            applyBrushSettings(
               brushTypeRef.current,
               brushColorRef.current,
               newSize,
               brushOpacityRef.current,
               brushFlowRef.current,
               brushHardnessRef.current,
               brushSmoothingRef.current
            );

            const wrapperRect = (canvas.getElement().parentElement as HTMLElement).getBoundingClientRect();
            const posX = (e.clientX !== undefined) ? (e.clientX - wrapperRect.left) : (wrapperRect.width / 2);
            const posY = (e.clientY !== undefined) ? (e.clientY - wrapperRect.top) : (wrapperRect.height / 2);

            setHudPosition({ x: posX, y: posY });
            setShowHud(true);

            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => setShowHud(false), 800);

            canvas.requestRenderAll();
            return;
         } else {
            e.preventDefault();
            e.stopPropagation();
            let zoom = canvas.getZoom();
            const delta = e.deltaY;

            // More consistent zoom formula
            const zoomStep = 0.05;
            const factor = 1 + (delta > 0 ? -zoomStep * 2 : zoomStep * 2);
            zoom *= factor;

            if (zoom > 20) zoom = 20;
            if (zoom < 0.05) zoom = 0.05;

            const point = new fabric.Point(e.offsetX, e.offsetY);
            canvas.zoomToPoint(point, zoom);
            setZoomPercent(Math.round(zoom * 100));
            canvas.requestRenderAll();

            if (!isMobileRef.current) {
               viewportTransformRef.current = canvas.viewportTransform!.slice();
            }
            validateViewport();
         }
      });

      let isPanning = false;
      let lastX = 0;
      let lastY = 0;

      canvas.on('mouse:down', (opt) => {
         const e = opt.e as any;
         if (!e) return;

         if (activeToolRef.current === 'pan' || e.button === 1 || isSpacePressedRef.current || isAltPressedRef.current) {
            isPanning = true;
            lastX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            lastY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
            canvas.selection = false;
         }
      });

      canvas.on('mouse:dblclick', (opt) => {
         if (opt.target && opt.target.type === 'image' && !opt.target.isType?.('activeSelection') && !(opt.target as any).isCropHelper) {
            enterCropMode(opt.target as fabric.Image);
         }
      });

      canvas.on('mouse:move', (opt) => {
         if (isPanning) {
            const e = opt.e as any;
            if (!e) return;
            const vpt = canvas.viewportTransform;
            if (vpt) {
               const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
               const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

               // Fabric requires updating the internal matrix and firing boundary calcs properly
               const newVpt = vpt.slice() as any;
               newVpt[4] += clientX - lastX;
               newVpt[5] += clientY - lastY;
               canvas.setViewportTransform(newVpt);

               lastX = clientX;
               lastY = clientY;
            }
         }
      });

      canvas.on('object:moving', handleSnapping);

      canvas.on('mouse:up', () => {
         guidesRef.current = [];
         if (isPanning) {
            canvas.setViewportTransform(canvas.viewportTransform!);
            isPanning = false;
            canvas.selection = true;

            if (!isMobileRef.current) {
               viewportTransformRef.current = canvas.viewportTransform!.slice();
            }
         }
         canvas.requestRenderAll();
         validateViewport();
      });

      // Mobile Swipe Navigation and Double Tap / Long Press Context Menu
      let touchStartX = 0;
      let touchStartY = 0;
      let lastTapTime = 0;
      let twoFingerTouchTimer: any = null;

      const handleTouchStart = (e: TouchEvent) => {
         if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
         } else if (e.touches.length === 2 && fabricRef.current) {
            // Detect logic for two-finger context menu
            const evt = e.touches[0];
            twoFingerTouchTimer = setTimeout(() => {
               if (!fabricRef.current) return;

               // Pass the original touch event which has e.touches
               const targetInfo = fabricRef.current.findTarget(e as any);
               const target = targetInfo?.target;

               let activeObjects = fabricRef.current.getActiveObjects();

               if (target && !activeObjects.includes(target as any)) {
                  fabricRef.current.setActiveObject(target as any);
                  fabricRef.current.requestRenderAll();
                  activeObjects = [target as any];
               }

               setActiveContextMenu({
                  x: evt.clientX,
                  y: evt.clientY,
                  obj: (target as any) || null,
                  targets: activeObjects
               });
            }, 400); // 400ms hold
         }
      };

      const handleTouchMove = (e: TouchEvent) => {
         if (twoFingerTouchTimer && e.touches.length < 2) {
            clearTimeout(twoFingerTouchTimer);
            twoFingerTouchTimer = null;
         }
      };

      const handleTouchEnd = (e: TouchEvent) => {
         if (twoFingerTouchTimer) {
            clearTimeout(twoFingerTouchTimer);
            twoFingerTouchTimer = null;
         }
         if (!isMobileRef.current) return;


         // Handle Swipe
         if (e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;

            // Must be mostly horizontal and long enough (threshold > 80px)
            if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
               const boards = artboardsRef.current;
               if (boards && boards.length > 1) {
                  const currentIdx = boards.findIndex(b => b.id === activeArtboardIdRef.current);
                  if (currentIdx !== -1) {
                     if (dx < 0 && currentIdx < boards.length - 1) {
                        // Swipe Left -> Next Artboard
                        setActiveArtboardId(boards[currentIdx + 1].id);
                     } else if (dx > 0 && currentIdx > 0) {
                        // Swipe Right -> Prev Artboard
                        setActiveArtboardId(boards[currentIdx - 1].id);
                     }
                  }
               }
            }
         }

         // Handle Double Tap to Fit
         const now = Date.now();
         if (now - lastTapTime < 300) {
            const boards = artboardsRef.current;
            const activeBoard = boards.find(b => b.id === activeArtboardIdRef.current);
            if (activeBoard) {
               const cw = canvas.width!;
               const ch = canvas.height!;
               if (cw > 0 && ch > 0) {
                  const padding = isMobileRef.current ? 32 : 100;
                  const zoom = Math.min(cw / (activeBoard.width + padding), ch / (activeBoard.height + padding), 2.5);
                  canvas.setZoom(zoom);
                  const vpt = canvas.viewportTransform!;
                  const newVpt = vpt.slice() as any;
                  newVpt[4] = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
                  newVpt[5] = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;
                  canvas.setViewportTransform(newVpt);
               }
            }
         }
         lastTapTime = now;
      };

      if (canvas.upperCanvasEl) {
         canvas.upperCanvasEl.addEventListener('touchstart', handleTouchStart as any, { passive: true });
         canvas.upperCanvasEl.addEventListener('touchmove', handleTouchMove as any, { passive: true });
         canvas.upperCanvasEl.addEventListener('touchend', handleTouchEnd as any, { passive: true });
      }

      // Initial load State
      isInternalChange.current = true;

      // Canvas Events Binding
      const handleObjectAdded = (e: any) => {
         if (!isInternalChange.current) {
            if (e.target && !e.target.id) {
               e.target.id = Date.now().toString() + Math.random().toString();
            }

            const obj = e.target;
            if (obj && obj.type === 'image' && !isInternalChange.current) {
               const board = getTargetArtboard(obj);
               // Removed suggestion toast logic
            }
         }
         updateLayersList();
      };

      const handleObjectModified = (e: any) => {
         if (isInternalChange.current) return;

         const target = e.target;
         if (!target) return;

         const transform = e.transform;
         if (transform) {
            const before = {
               left: transform.original.left ?? target.left,
               top: transform.original.top ?? target.top,
               scaleX: transform.original.scaleX ?? target.scaleX,
               scaleY: transform.original.scaleY ?? target.scaleY,
               angle: transform.original.angle ?? target.angle,
               width: transform.original.width ?? target.width,
               height: transform.original.height ?? target.height,
            };
            const after = {
               left: target.left,
               top: target.top,
               scaleX: target.scaleX,
               scaleY: target.scaleY,
               angle: target.angle,
               width: target.width,
               height: target.height,
            };

            let actionName = "Modify Layer";
            if (transform.action === "drag") {
               actionName = "Move " + (target.type === "image" ? "Image" : "Shape");
            } else if (transform.action?.startsWith("scale")) {
               actionName = "Resize " + (target.type === "image" ? "Image" : "Shape");
            } else if (transform.action === "rotate") {
               actionName = "Rotate " + (target.type === "image" ? "Image" : "Shape");
            }

            const cmd = new TransformObjectsCommand(actionName, [{ obj: target, before, after }]);
            executeCommand(cmd);
         }
         updateLayersList();
      };

      const handleObjectRemoved = (e: any) => {
         updateLayersList();
      };

      const handlePathCreated = (e: any) => {
         if (isInternalChange.current) return;
         const pathObj = e.path;
         if (pathObj) {
            if (!pathObj.id) {
               pathObj.id = Date.now().toString() + Math.random().toString();
            }
            pathObj.artboardId = activeArtboardIdRef.current;

            // Keep visual characteristics of selected brush engine on final path object
            if (brushType === 'marker') {
               pathObj.set({
                  strokeLineCap: 'square',
                  strokeLineJoin: 'miter'
               });
            } else if (brushType === 'highlighter') {
               pathObj.set({
                  strokeLineCap: 'square',
                  strokeLineJoin: 'miter',
                  opacity: 0.4
               });
            } else if (brushType === 'calligraphy') {
               pathObj.set({
                  strokeLineCap: 'square',
                  strokeLineJoin: 'miter'
               });
            } else if (brushType === 'brush') {
               pathObj.set({
                  shadow: new fabric.Shadow({
                     color: setOpacityOnHex(brushColor, brushOpacity * 0.3),
                     blur: (1 - (brushHardness / 100)) * (brushSize / 2),
                     offsetX: 0,
                     offsetY: 0
                  })
               });
            } else if (brushType === 'watercolor') {
               pathObj.set({
                  stroke: setOpacityOnHex(brushColor, brushOpacity * 0.15),
                  shadow: new fabric.Shadow({
                     color: setOpacityOnHex(brushColor, brushOpacity * 0.4),
                     blur: brushSize * 0.7,
                     offsetX: 0,
                     offsetY: 0
                  })
               });
            } else if (brushType === 'ink') {
               pathObj.set({
                  shadow: new fabric.Shadow({
                     color: setOpacityOnHex(brushColor, brushOpacity * 0.2),
                     blur: 1,
                     offsetX: 0.5,
                     offsetY: 0.5
                  })
               });
            }

            pathObj.customName = getBrushName(brushType);
            fabricRef.current?.requestRenderAll();

            const cmd = new AddObjectCommand(pathObj.customName, pathObj);
            executeCommand(cmd);
         }
      };

      const handleEditingEntered = (e: any) => {
         if (e.target) {
            textStartValueRef.current = e.target.text || "";
         }
      };

      const handleEditingExited = (e: any) => {
         if (e.target && e.target.text !== textStartValueRef.current) {
            const cmd = new PropertyChangeCommand(
               "Edit Text",
               e.target,
               "text",
               textStartValueRef.current,
               e.target.text
            );
            executeCommand(cmd);
         }
         updateLayersList();
      };

      canvas.on('object:added', handleObjectAdded);
      canvas.on('object:modified', handleObjectModified);
      canvas.on('object:removed', handleObjectRemoved);
      canvas.on('path:created', handlePathCreated);
      (canvas as any).on('editing:entered', handleEditingEntered);
      (canvas as any).on('editing:exited', handleEditingExited);
      canvas.on('selection:created', handleSelectionContext);
      canvas.on('selection:updated', handleSelectionContext);
      canvas.on('selection:cleared', handleSelectionContext);

      return () => {
         if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
         }

         const upperCanvasEl = canvas.upperCanvasEl;
         if (upperCanvasEl) {
            upperCanvasEl.removeEventListener('touchstart', touchStartHandler as any);
            upperCanvasEl.removeEventListener('touchmove', touchMoveHandler as any);
            upperCanvasEl.removeEventListener('touchend', touchEndHandler as any);
            upperCanvasEl.removeEventListener('touchstart', handleTouchStart as any);
            upperCanvasEl.removeEventListener('touchmove', handleTouchMove as any);
            upperCanvasEl.removeEventListener('touchend', handleTouchEnd as any);
            upperCanvasEl.removeEventListener('mousedown', handleMousedownCapture, true);
            upperCanvasEl.removeEventListener('mousedown', handleBrushAdjustMousedown, true);
         }

         resizeObserver.disconnect();
         canvas.dispose();
         fabricRef.current = null;
      };
   }, [path, updateLayersList, handleSelectionContext, executeCommand]);

   // Global Keyboard Isolation Phase
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.altKey) setIsAltPressed(true);
         if (e.shiftKey) setIsShiftPressed(true);
         if (e.ctrlKey) setIsCtrlPressed(true);
         if (e.code === 'Space') setIsSpacePressed(true);

         const ctrlOrCmd = e.ctrlKey || e.metaKey;
         const isRedo = ctrlOrCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey));
         const isUndo = ctrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey;
         const isDelete = e.key === 'Delete' || e.key === 'Backspace';
         const isBringForward = ctrlOrCmd && e.key === ']' && !e.shiftKey;
         const isBringToFront = ctrlOrCmd && e.key === ']' && e.shiftKey;
         const isSendBackward = ctrlOrCmd && e.key === '[' && !e.shiftKey;
         const isSendToBack = ctrlOrCmd && e.key === '[' && e.shiftKey;
         const isLayerAction = isBringForward || isBringToFront || isSendBackward || isSendToBack;

         if (e.key.toLowerCase() === 'c' && !ctrlOrCmd && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
            if (!isCropping) {
               const activeObj = fabricRef.current?.getActiveObject();
               if (activeObj && activeObj.type === 'image') {
                  enterCropMode(activeObj as fabric.Image);
               }
            }
         }
         
         if (e.key.toLowerCase() === 'c' && ctrlOrCmd && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
            if (!isCropping) {
               const activeObj = fabricRef.current?.getActiveObject();
               if (activeObj) {
                  navigator.clipboard.writeText(JSON.stringify({ __fabricInternalClipboard: true })).catch(()=>{});
                  activeObj.clone(['id', 'artboardId']).then((cloned) => {
                     (window as any)._fabricInternalClipboard = cloned;
                     setNotification({ message: 'Object copied', type: 'success' });
                  });
               }
            }
         }

         if (e.key === 'Enter' && isCropping) {
            applyCrop();
            e.preventDefault();
         }

         if (e.key === 'Escape') {
            if (isCropping) {
               cancelCrop();
            }
            closeContextMenu();
         }

         if (isUndo || isRedo || isDelete || isLayerAction) {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
               return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (isUndo) {
               performUndo();
            } else if (isRedo) {
               performRedo();
            } else if (isDelete) {
               deleteActiveObject();
            } else if (isBringToFront) {
               handleLayerOrder('front');
            } else if (isBringForward) {
               handleLayerOrder('forward');
            } else if (isSendBackward) {
               handleLayerOrder('backward');
            } else if (isSendToBack) {
               handleLayerOrder('back');
            }
         } else if (!ctrlOrCmd) {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
               return;
            }

            if (e.code === 'Space') {
               // If not in input, prevent default to avoid scrolling
               e.preventDefault();
            }

            if (e.key.toLowerCase() === 'v') {
               setActiveTool('select');
               if (fabricRef.current) {
                  fabricRef.current.isDrawingMode = false;
               }
            } else if (e.key.toLowerCase() === 'b') {
               setActiveTool('brush');
               if (fabricRef.current) {
                  fabricRef.current.discardActiveObject();
                  fabricRef.current.renderAll();
               }
               applyBrushSettings(brushType);
            } else if (e.key.toLowerCase() === 't') {
               addText();
            } else if (e.key.toLowerCase() === 'h') {
               setActiveTool('pan');
               if (fabricRef.current) {
                  fabricRef.current.isDrawingMode = false;
               }
            }
         }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
         if (!e.altKey) setIsAltPressed(false);
         if (!e.shiftKey) setIsShiftPressed(false);
         if (!e.ctrlKey) setIsCtrlPressed(false);
         if (e.code === 'Space') setIsSpacePressed(false);
      };

      window.addEventListener('keydown', handleKeyDown, { capture: true });
      window.addEventListener('keyup', handleKeyUp, { capture: true });
      return () => {
         window.removeEventListener('keydown', handleKeyDown, { capture: true });
         window.removeEventListener('keyup', handleKeyUp, { capture: true });
      };
   }, [performUndo, performRedo, brushType, applyBrushSettings, handleLayerOrder]);

   const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fabricRef.current) return;

      const pointer = fabricRef.current.getScenePoint(e.nativeEvent as any);
      const targetInfo = fabricRef.current.findTarget(e.nativeEvent as any);
      const target = targetInfo?.target;

      let activeObjects = fabricRef.current.getActiveObjects();

      // If right clicked on an object that isn't selected, select it first
      if (target && !activeObjects.includes(target as any)) {
         fabricRef.current.setActiveObject(target as any);
         fabricRef.current.requestRenderAll();
         activeObjects = [target as any];
      }

      setActiveContextMenu({
         x: e.clientX,
         y: e.clientY,
         obj: (target as any) || null,
         targets: activeObjects
      });
   };

   const handleImportImageClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('img-upload')?.click();
   };

   const closeContextMenu = () => setActiveContextMenu(null);

   useEffect(() => {
      const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
         const target = e.target as HTMLElement;
         if (!target) return;

         // Check if click/touch was inside activeContextMenu
         const clickedInContextMenu = target.closest('.context-menu-container');
         const clickedImportToggleButton = target.closest('[title="Import Image"]');

         if (!clickedInContextMenu && !clickedImportToggleButton) {
            closeContextMenu();
         }

         // Check if click/touch was inside artboardDropdown
         const clickedInArtboardDropdown = target.closest('.artboard-dropdown-container');
         const clickedArtboardDropdownToggle = target.closest('.artboard-dropdown-toggle');

         if (!clickedInArtboardDropdown && !clickedArtboardDropdownToggle) {
            setArtboardDropdown(null);
         }
      };

      window.addEventListener('mousedown', handleOutsideClick, true);
      window.addEventListener('touchstart', handleOutsideClick, true);
      return () => {
         window.removeEventListener('mousedown', handleOutsideClick, true);
         window.removeEventListener('touchstart', handleOutsideClick, true);
      };
   }, []);
   const setTool = (tool: string) => {
      setActiveTool(tool);
      if (!fabricRef.current) return;
      if (tool === "brush" || tool === "eraser") {
         fabricRef.current.discardActiveObject();
         fabricRef.current.renderAll();
      } else if (tool === "crop") {
         // Don't discard active object yet, we might be transitioning into crop with a selection
      } else if (isCropping) {
         cancelCrop(); // automatically exit crop when switching tools
      }
      fabricRef.current.isDrawingMode = (tool === "brush" || tool === "eraser");
      applyBrushSettings(brushType);
   };

   const extractImageFromFrame = async (frameGroup: any) => {
      isInternalChange.current = true;
      const canvas = fabricRef.current;
      if (!canvas) return null;

      const artboardId = frameGroup.artboardId;
      const layerId = frameGroup.id || frameGroup.layerId;

      const clonedGroup = await frameGroup.clone([]);
      canvas.add(clonedGroup);

      let items: any[] = [];
      if (typeof clonedGroup.toActiveSelection === 'function') {
         const sel = clonedGroup.toActiveSelection();
         items = sel.getObjects();
      } else {
         items = (clonedGroup as any).removeAll();
         canvas.remove(clonedGroup);
         items.forEach((i: any) => canvas.add(i));
      }

      const img = items.find((o: any) => o.type === 'image');
      const rect = items.find((o: any) => o.type === 'rect');

      if (rect) canvas.remove(rect);
      if (img) canvas.remove(img);

      if (img) {
         if (artboardId) (img as any).artboardId = artboardId;
         if (layerId) (img as any).id = layerId;
         img.set('isFrameGroup', false);
         img.set('frameType', undefined);

         canvas.add(img);
         canvas.setActiveObject(img);

         const cmd = new MacroCommand("Remove Frame for Crop", [
            new DeleteObjectCommand("Remove Group", [frameGroup]),
            new AddObjectCommand("Add Extracted Image", img)
         ]);
         executeCommand(cmd);
         canvas.requestRenderAll();
         updateLayersList();
      }
      isInternalChange.current = false;
      return img;
   };

   const enterCropMode = async (target?: any) => {
      let imgTarget = target;
      let canvas = fabricRef.current;
      if (!canvas) return;

      if (!imgTarget) {
         let activeObj = canvas.getActiveObject();
         if (activeObj && activeObj.get('isFrameGroup')) {
            const img = await extractImageFromFrame(activeObj);
            if (img) imgTarget = img as fabric.Image;
         } else {
            const activeObjects = activeObj ? [activeObj] : [];
            if (activeObjects?.length === 1 && activeObjects[0].type === 'image') {
               imgTarget = activeObjects[0] as fabric.Image;
            }
         }
      } else {
         if (imgTarget && imgTarget.get('isFrameGroup')) {
            const img = await extractImageFromFrame(imgTarget);
            if (img) imgTarget = img as fabric.Image;
         }
      }

      if (!imgTarget || imgTarget.type !== 'image') {
         alert("Please select a single image to crop.");
         return;
      }

      const el = imgTarget.getElement() as HTMLImageElement;
      if (!el) return;

      imgTarget.setCoords();
      const matrix = imgTarget.calcTransformMatrix();

      const origCenterH = imgTarget.originX === 'center' ? imgTarget.width! / 2 : 0;
      const origCenterV = imgTarget.originY === 'center' ? imgTarget.height! / 2 : 0;

      const localFullTl = new fabric.Point(
         -origCenterH - (imgTarget.cropX || 0),
         -origCenterV - (imgTarget.cropY || 0)
      );
      const canvasFullTl = fabric.util.transformPoint(localFullTl, matrix);

      const fullImg = new fabric.Image(el, {
         left: canvasFullTl.x,
         top: canvasFullTl.y,
         originX: 'left',
         originY: 'top',
         scaleX: imgTarget.scaleX,
         scaleY: imgTarget.scaleY,
         angle: imgTarget.angle,
         opacity: 1, // Fixed: don't make the background totally transparent
         selectable: true,
         evented: true,
         lockRotation: true,
         lockScalingX: true,
         lockScalingY: true,
      });

      (fullImg as any).isCropHelper = true;

      const cropRect = new fabric.Rect({
         left: imgTarget.left,
         top: imgTarget.top,
         originX: imgTarget.originX,
         originY: imgTarget.originY,
         width: imgTarget.width,
         height: imgTarget.height,
         scaleX: imgTarget.scaleX,
         scaleY: imgTarget.scaleY,
         angle: imgTarget.angle,
         fill: 'transparent',
         stroke: '#3b82f6',
         strokeWidth: 2 / fabricRef.current!.getZoom() || 1,
         strokeDashArray: [6, 6],
         cornerColor: '#ffffff',
         cornerStrokeColor: '#3b82f6',
         cornerSize: 12,
         transparentCorners: false,
         lockRotation: true,
         borderColor: '#3b82f6',
      });
      (cropRect as any).isCropHelper = true;

      imgTarget.set('visible', false);

      fabricRef.current!.add(fullImg);
      fabricRef.current!.add(cropRect);
      fabricRef.current!.setActiveObject(cropRect);
      fabricRef.current!.renderAll();

      cropSessionRef.current = {
         origObj: imgTarget,
         fullImg: fullImg,
         cropRect: cropRect,
         dimRect: null
      };

      setIsCropping(true);
      setActiveTool('crop');
   };

   const applyCrop = () => {
      const { origObj, fullImg, cropRect } = cropSessionRef.current;
      if (!origObj || !fullImg || !cropRect || !fabricRef.current) {
         cancelCrop();
         return;
      }

      const imgEl = fullImg.getElement() as HTMLImageElement;
      if (!imgEl) {
         cancelCrop();
         return;
      }
      const imgWidth = imgEl.width || imgEl.naturalWidth;
      const imgHeight = imgEl.height || imgEl.naturalHeight;

      // Calculate unscaled crop dimensions by mapping from canvas space back to the source image space
      const cropWCanvas = cropRect.width! * Math.abs(cropRect.scaleX!);
      const cropHCanvas = cropRect.height! * Math.abs(cropRect.scaleY!);

      // original scale values of the full image
      const fullImgScaleX = Math.abs(fullImg.scaleX!);
      const fullImgScaleY = Math.abs(fullImg.scaleY!);

      let cropW = cropWCanvas / fullImgScaleX;
      let cropH = cropHCanvas / fullImgScaleY;

      // Calculate center offsets in source image space using reverse projection
      const fullImgMatrix = fullImg.calcTransformMatrix();
      const fullImgInverse = fabric.util.invertTransform(fullImgMatrix);

      const cropCenterCanvas = cropRect.getCenterPoint();
      const fullImgCenterCanvas = fullImg.getCenterPoint();

      const cropCenterLocal = fabric.util.transformPoint(cropCenterCanvas, fullImgInverse);
      const fullImgCenterLocal = fabric.util.transformPoint(fullImgCenterCanvas, fullImgInverse);

      const dx = cropCenterLocal.x - fullImgCenterLocal.x;
      const dy = cropCenterLocal.y - fullImgCenterLocal.y;

      // Compute top-left of crop in source image space
      let cropX = (imgWidth / 2) + dx - (cropW / 2);
      let cropY = (imgHeight / 2) + dy - (cropH / 2);

      // Bounds / Safety constraints to prevent NaN or blank imagery
      if (cropX < 0) { cropW += cropX; cropX = 0; }
      if (cropY < 0) { cropH += cropY; cropY = 0; }
      if (cropX + cropW > imgWidth) cropW = imgWidth - cropX;
      if (cropY + cropH > imgHeight) cropH = imgHeight - cropY;

      if (cropW <= 1 || cropH <= 1) {
         cancelCrop();
         return;
      }

      origObj.set('visible', true);

      const beforeState = {
         left: origObj.left,
         top: origObj.top,
         scaleX: origObj.scaleX,
         scaleY: origObj.scaleY,
         angle: origObj.angle,
         width: origObj.width,
         height: origObj.height,
         cropX: origObj.cropX || 0,
         cropY: origObj.cropY || 0,
         originX: origObj.originX,
         originY: origObj.originY,
      };

      const afterState = {
         left: cropRect.left,
         top: cropRect.top,
         scaleX: fullImg.scaleX,
         scaleY: fullImg.scaleY,
         angle: cropRect.angle,
         width: cropW,
         height: cropH,
         cropX: cropX,
         cropY: cropY,
         originX: cropRect.originX,
         originY: cropRect.originY,
      };

      const cmd = new TransformObjectsCommand("Crop Image", [{
         obj: origObj,
         before: beforeState,
         after: afterState
      }]);

      executeCommand(cmd);

      fabricRef.current.remove(fullImg);
      fabricRef.current.remove(cropRect);
      fabricRef.current.setActiveObject(origObj);
      fabricRef.current.renderAll();

      updateLayersList();

      cropSessionRef.current = { origObj: null, fullImg: null, cropRect: null, dimRect: null };
      setIsCropping(false);
      setActiveTool('select');
   };

   const cancelCrop = () => {
      const { origObj, fullImg, cropRect } = cropSessionRef.current;
      if (origObj) {
         origObj.set('visible', true);
         fabricRef.current?.setActiveObject(origObj);
      }
      if (fullImg) fabricRef.current?.remove(fullImg);
      if (cropRect) fabricRef.current?.remove(cropRect);
      fabricRef.current?.renderAll();

      cropSessionRef.current = { origObj: null, fullImg: null, cropRect: null, dimRect: null };
      setIsCropping(false);
      setActiveTool('select');
   };

   const resetCrop = () => {
      let activeObjects = fabricRef.current?.getActiveObjects();
      if (!activeObjects || activeObjects.length !== 1) return;
      let origObj = activeObjects[0] as any;

      if (origObj.get('isFrameGroup')) {
         const items = origObj.getObjects();
         const img = items.find((i: any) => i.type === 'image');
         if (img) origObj = img;
      }

      if (origObj.type !== 'image') return;

      const el = origObj.getElement() as HTMLImageElement;
      if (!el) return;

      origObj.setCoords();
      const matrix = origObj.calcTransformMatrix();
      const origCenterH = origObj.originX === 'center' ? origObj.width! / 2 : 0;
      const origCenterV = origObj.originY === 'center' ? origObj.height! / 2 : 0;

      const localFullTl = new fabric.Point(
         -origCenterH - (origObj.cropX || 0),
         -origCenterV - (origObj.cropY || 0)
      );
      const canvasFullTl = fabric.util.transformPoint(localFullTl, matrix);

      const beforeState = {
         left: origObj.left,
         top: origObj.top,
         scaleX: origObj.scaleX,
         scaleY: origObj.scaleY,
         angle: origObj.angle,
         width: origObj.width,
         height: origObj.height,
         cropX: origObj.cropX || 0,
         cropY: origObj.cropY || 0,
         originX: origObj.originX,
         originY: origObj.originY,
      };

      const afterState = {
         left: canvasFullTl.x,
         top: canvasFullTl.y,
         scaleX: origObj.scaleX,
         scaleY: origObj.scaleY,
         angle: origObj.angle,
         width: el.width,
         height: el.height,
         cropX: 0,
         cropY: 0,
         originX: 'left',
         originY: 'top',
      };

      const cmd = new TransformObjectsCommand("Reset Crop", [{
         obj: origObj,
         before: beforeState,
         after: afterState
      }]);

      executeCommand(cmd);
      updateLayersList();
      fabricRef.current?.setActiveObject(origObj);
   };

   const addRect = () => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
      const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
      const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

      const rect = new fabric.Rect({
         left: viewCenterX,
         top: viewCenterY,
         width: 100,
         height: 100,
         fill: 'transparent',
         stroke: brushColor,
         strokeWidth: brushSize > 0 ? brushSize : 2,
         originX: 'center',
         originY: 'center',
         id: Date.now().toString() + Math.random().toString(),
         artboardId: activeArtboardIdRef.current
      } as any);
      const cmd = new AddObjectCommand("Add Rectangle", rect);
      executeCommand(cmd);
   };

   const addCircle = () => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
      const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
      const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

      const circle = new fabric.Circle({
         left: viewCenterX,
         top: viewCenterY,
         radius: 50,
         fill: 'transparent',
         stroke: brushColor,
         strokeWidth: brushSize > 0 ? brushSize : 2,
         originX: 'center',
         originY: 'center',
         id: Date.now().toString() + Math.random().toString(),
         artboardId: activeArtboardIdRef.current
      } as any);
      const cmd = new AddObjectCommand("Add Circle", circle);
      executeCommand(cmd);
   };

   const addTriangle = () => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
      const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
      const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

      const triangle = new fabric.Triangle({
         left: viewCenterX,
         top: viewCenterY,
         width: 100,
         height: 100,
         fill: 'transparent',
         stroke: brushColor || '#00aaff',
         strokeWidth: brushSize > 0 ? brushSize : 2,
         originX: 'center',
         originY: 'center',
         id: Date.now().toString() + Math.random().toString(),
         artboardId: activeArtboardIdRef.current
      } as any);
      const cmd = new AddObjectCommand("Add Triangle", triangle);
      executeCommand(cmd);
   };

   const addLine = () => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
      const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
      const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

      const line = new fabric.Line([viewCenterX - 50, viewCenterY, viewCenterX + 50, viewCenterY], {
         stroke: brushColor || '#00aaff',
         strokeWidth: brushSize > 0 ? brushSize : 2,
         originX: 'center',
         originY: 'center',
         id: Date.now().toString() + Math.random().toString(),
         artboardId: activeArtboardIdRef.current
      } as any);
      const cmd = new AddObjectCommand("Add Line", line);
      executeCommand(cmd);
   };

   const addText = () => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const vpt = canvas.viewportTransform || ([1, 0, 0, 1, 0, 0] as any);
      const viewCenterX = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
      const viewCenterY = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];

      const text = new fabric.Textbox('Double-click to type...', {
         left: viewCenterX,
         top: viewCenterY,
         width: 250,
         fill: brushColor,
         fontFamily: textProps.fontFamily,
         fontSize: textProps.fontSize,
         fontWeight: textProps.fontWeight,
         fontStyle: textProps.fontStyle,
         textAlign: textProps.textAlign,
         underline: textProps.underline,
         overline: textProps.overline,
         linethrough: textProps.linethrough,
         charSpacing: textProps.charSpacing,
         lineHeight: textProps.lineHeight || 1.16,
         originX: 'center',
         originY: 'center',
         id: Date.now().toString() + Math.random().toString(),
         artboardId: activeArtboardIdRef.current
      } as any);
      const cmd = new AddObjectCommand("Add Text", text);
      executeCommand(cmd);
   };

   const addImageFromUrl = (url: string) => {
      fabric.Image.fromURL(url).then((img) => {
         if (img) {
            (img as any).id = Date.now().toString() + Math.random().toString();
            (img as any).artboardId = activeArtboardIdRef.current;

            if (fabricRef.current) {
               const canvas = fabricRef.current;
               const activeBoard = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
               const left = activeBoard.x + activeBoard.width / 2;
               const top = activeBoard.y + activeBoard.height / 2;

               let scaleX = 1;
               let scaleY = 1;
               if (activeBoard) {
                  if (img.width! > activeBoard.width || img.height! > activeBoard.height) {
                     const scale = Math.min(activeBoard.width / img.width!, activeBoard.height / img.height!);
                     scaleX = scale;
                     scaleY = scale;
                  }
               }

               img.set({
                  left: left,
                  top: top,
                  scaleX: scaleX,
                  scaleY: scaleY,
                  originX: 'center',
                  originY: 'center'
               });

               canvas.add(img);
               canvas.setActiveObject(img);
               canvas.renderAll();

               const cmd = new AddObjectCommand("Add Image", img);
               executeCommand(cmd);
               setTimeout(() => {
                  fitView();
               }, 50);
            }
         }
      }).catch(err => {
         console.error("Failed to load image from URL:", err);
      });
   };

   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const promises = Array.from(files).map(file => {
         return new Promise<{ url: string, type: 'svg' | 'image', name: string }>(async (resolve) => {
            if (file.name.toLowerCase().endsWith('.jxl') || file.type === 'image/jxl') {
               try {
                  const arrayBuffer = await file.arrayBuffer();
                  const decodeJxlModule = await import('@jsquash/jxl/decode') as any;
                  const jxlModule = await loadWasmModule("https://unpkg.com/@jsquash/jxl@1.3.0/codec/dec/jxl_dec.wasm");
                  await decodeJxlModule.init(jxlModule);
                  const decodedData = await decodeJxlModule.default(arrayBuffer);

                  const canvas = document.createElement('canvas');
                  canvas.width = decodedData.width;
                  canvas.height = decodedData.height;
                  const ctx = canvas.getContext('2d')!;
                  const imgData = new ImageData(decodedData.data, decodedData.width, decodedData.height);
                  ctx.putImageData(imgData, 0, 0);
                  const dataUrl = canvas.toDataURL("image/png");
                  resolve({ url: dataUrl, type: 'image', name: file.name });
                  return;
               } catch (err) {
                  console.error("Failed to decode JXL file on import:", err);
               }
            }

            const reader = new FileReader();
            reader.onload = (event) => {
               const dataUrl = event.target?.result as string;
               if (file.type === 'image/svg+xml') {
                  resolve({ url: dataUrl, type: 'svg', name: file.name });
               } else {
                  resolve({ url: dataUrl, type: 'image', name: file.name });
               }
            };
            reader.readAsDataURL(file);
         });
      });

      const results = await Promise.all(promises);

      if (results.length > 0) {
         importAssets(results);
      }

      e.target.value = '';
   };

   const deleteActiveObject = () => {
      const active = fabricRef.current?.getActiveObjects();
      if (active && active.length > 0) {
         const cmd = new DeleteObjectCommand("Delete Layer(s)", active);
         executeCommand(cmd);
      }
   };

   const copyActiveObjectAsFormat = async (format: 'png' | 'jpeg' | 'svg' = 'png') => {
      const activeObj = fabricRef.current?.getActiveObject();
      if (!activeObj) return;

      try {
         if (format === 'svg') {
            const clone = await activeObj.clone([]);
            const bounds = clone.getBoundingRect();

            const elElement = document.createElement('canvas');
            const tempCanvas = new fabric.StaticCanvas(elElement, {
               width: bounds.width,
               height: bounds.height
            });

            clone.set({
               left: (clone.left || 0) - bounds.left,
               top: (clone.top || 0) - bounds.top
            });
            clone.setCoords();
            tempCanvas.add(clone);

            const svg = tempCanvas.toSVG();
            tempCanvas.dispose();

            await navigator.clipboard.writeText(svg);
            setNotification({ message: 'Copied as SVG', type: 'success' });
         } else {
            const dataUrl = activeObj.toDataURL({ format });
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([
               new ClipboardItem({ [blob.type]: blob })
            ]);
            setNotification({ message: `Copied as ${format.toUpperCase()}`, type: 'success' });
         }
      } catch (e) {
         console.error('Failed to copy', e);
         setNotification({ message: 'Failed to copy', type: 'error' });
      }
   };

   const duplicateActiveObject = () => {
      const activeObj = fabricRef.current?.getActiveObject();
      if (activeObj) {
         activeObj.clone(['id', 'artboardId']).then((cloned) => {
            fabricRef.current?.discardActiveObject();
            let newLeft = (cloned.left || 0) + 20;
            let newTop = (cloned.top || 0) + 20;
            const canvas = fabricRef.current;
            if (canvas && canvas.vptCoords) {
                const { tl, br } = canvas.vptCoords;
                if (newLeft < tl.x || newLeft > br.x || newTop < tl.y || newTop > br.y) {
                    const center = canvas.getVpCenter();
                    newLeft = cloned.originX === 'center' ? center.x : center.x - ((cloned.width || 0) * (cloned.scaleX || 1)) / 2;
                    newTop = cloned.originY === 'center' ? center.y : center.y - ((cloned.height || 0) * (cloned.scaleY || 1)) / 2;
                }
            }
            cloned.set({
               left: newLeft,
               top: newTop,
               id: Date.now().toString() + Math.random().toString(),
               artboardId: (activeObj as any).artboardId || activeArtboardIdRef.current
            });
            if (cloned.type === 'activeSelection') {
               cloned.canvas = fabricRef.current!;
               (cloned as any).forEachObject((obj: any) => {
                  obj.id = Date.now().toString() + Math.random().toString();
                  obj.artboardId = obj.artboardId || activeArtboardIdRef.current;
                  fabricRef.current?.add(obj);
               });
               cloned.setCoords();
            } else {
               fabricRef.current?.add(cloned);
            }
            const cmd = new AddObjectCommand("Duplicate Layer", cloned);
            executeCommand(cmd);
         });
      }
   };

   const flipX = () => {
      const obj = fabricRef.current?.getActiveObject();
      if (obj) {
         const beforeVal = obj.flipX;
         const cmd = new PropertyChangeCommand("Flip Horizontal", obj, "flipX", beforeVal, !beforeVal);
         executeCommand(cmd);
      }
   };

   const flipY = () => {
      const obj = fabricRef.current?.getActiveObject();
      if (obj) {
         const beforeVal = obj.flipY;
         const cmd = new PropertyChangeCommand("Flip Vertical", obj, "flipY", beforeVal, !beforeVal);
         executeCommand(cmd);
      }
   };

   const updateFrameBorderWidth = (width: number) => {
      setFrameBorderWidth(width);
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const activeObj = canvas.getActiveObject();

      if (activeObj && activeObj.get('isFrameGroup')) {
         const frameType = activeObj.get('frameType');
         const group = activeObj as fabric.Group;
         const items = group.getObjects();
         const rectObj = items.find((i: any) => i.type === 'rect');
         const imgObj = items.find((i: any) => i.type === 'image');

         if (rectObj && imgObj) {
            if (frameType === 'polaroid') {
               const w = imgObj.getScaledWidth();
               const h = imgObj.getScaledHeight();

               let cx = imgObj.left!;
               let cy = imgObj.top!;

               if (imgObj.originX !== 'center') cx += w / 2;
               if (imgObj.originY !== 'center') cy += h / 2;

               rectObj.set({
                  left: cx,
                  top: cy + width,
                  width: w + (width * 2),
                  height: h + (width * 4)
               });
            } else {
               rectObj.set('strokeWidth', width);
            }

            // Re-calculate group bounds properly to prevent visual tearing / selection box issues
            const groupAny = group as any;
            if (groupAny.removeWithUpdate && groupAny.addWithUpdate) {
               groupAny.removeWithUpdate(rectObj);
               groupAny.removeWithUpdate(imgObj);
               groupAny.addWithUpdate(rectObj);
               groupAny.addWithUpdate(imgObj);
            } else {
               group.remove(rectObj);
               group.remove(imgObj);
               group.add(rectObj);
               group.add(imgObj);
            }

            groupAny.setDirty?.();
            group.fire('modified');
            canvas.requestRenderAll();
         }
      }
   };

   const applyFrame = async (frameType: string, customWidth?: number) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      let activeObj = canvas.getActiveObject();

      if (!activeObj) {
         alert("Please select an image to apply a frame.");
         return;
      }

      isInternalChange.current = true;

      let baseImageObj: any = activeObj;
      let objectToRemove: any = activeObj;

      if (activeObj.get('isFrameGroup')) {
         const prevFrameType = activeObj.get('frameType');

         // Safely clone the group to extract the image without destroying the original (for history undo)
         const clonedGroup = await activeObj.clone([]);
         canvas.add(clonedGroup);

         let items: any[] = [];
         const groupAsAny = clonedGroup as any;
         if (typeof groupAsAny.toActiveSelection === 'function') {
            const sel = groupAsAny.toActiveSelection();
            items = sel.getObjects();
         } else {
            items = (clonedGroup as any).removeAll();
            canvas.remove(clonedGroup);
            items.forEach((i: any) => canvas.add(i));
         }

         const img = items.find((o: any) => o.type === 'image');
         const rect = items.find((o: any) => o.type === 'rect');

         if (rect) canvas.remove(rect); // Clean up temp rect
         if (img) canvas.remove(img);   // Temporarily remove temp img

         if (!img) {
            alert("Could not extract image from frame.");
            isInternalChange.current = false;
            return;
         }

         baseImageObj = img;

         if (prevFrameType === frameType && customWidth === undefined) {
            // Toggle off identical frame
            canvas.add(baseImageObj);
            canvas.setActiveObject(baseImageObj);

            const cmd = new MacroCommand("Remove Frame", [
               new DeleteObjectCommand("Remove Group", [objectToRemove]),
               new AddObjectCommand("Add Extracted Image", baseImageObj)
            ]);
            executeCommand(cmd);
            canvas.requestRenderAll();
            updateLayersList();
            isInternalChange.current = false;
            return;
         }
      }

      if (baseImageObj.type !== 'image') {
         alert("Please select an image to apply a frame.");
         isInternalChange.current = false;
         return;
      }

      // Default Frame Settings
      let strokeColor = "#ffffff";
      let strokeWidth = customWidth !== undefined ? customWidth : 20;
      let strokeUniform = true;

      switch (frameType) {
         case 'polaroid':
            strokeColor = "#F9F9F9";
            if (customWidth === undefined) strokeWidth = 30; // base boundary
            break;
         case 'black':
            strokeColor = "#111111";
            if (customWidth === undefined) strokeWidth = 15;
            break;
         case 'white':
            strokeColor = "#FFFFFF";
            if (customWidth === undefined) strokeWidth = 15;
            break;
         case 'metallic':
            strokeColor = "#D4AF37";
            if (customWidth === undefined) strokeWidth = 12;
            break;
         case 'vintage':
            strokeColor = "#8B5A2B";
            if (customWidth === undefined) strokeWidth = 20;
            break;
      }

      const originalAngle = baseImageObj.angle || 0;
      baseImageObj.set({ angle: 0 }); // temporarily straighten to get clean bounds
      baseImageObj.setCoords();

      const center = baseImageObj.getCenterPoint();
      const w = baseImageObj.getScaledWidth();
      const h = baseImageObj.getScaledHeight();

      const rect = new fabric.Rect({
         originX: 'center',
         originY: 'center',
         left: center.x,
         top: center.y + (frameType === 'polaroid' ? strokeWidth : 0),
         width: w + (frameType === 'polaroid' ? strokeWidth * 2 : 0),
         height: h + (frameType === 'polaroid' ? strokeWidth * 3.5 : 0),
         fill: 'transparent',
         stroke: strokeColor,
         strokeWidth: frameType === 'polaroid' ? 0 : strokeWidth,
         strokeUniform: strokeUniform,
         shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.3)',
            blur: 10,
            offsetX: 5,
            offsetY: 5
         }),
         evented: true,
         selectable: true,
         artboardId: (baseImageObj as any).artboardId
      });

      if (frameType === 'polaroid') {
         rect.set('fill', '#F9F9F9');
         rect.set('strokeWidth', 0);
      }

      // Group them
      const objs = frameType === 'polaroid' ? [rect, baseImageObj] : [baseImageObj, rect];
      const group = new fabric.Group(objs);

      group.set({
         id: `frame_${Date.now()}`,
         customName: `${frameType.charAt(0).toUpperCase() + frameType.slice(1)} Frame`,
         artboardId: (baseImageObj as any).artboardId,
         angle: originalAngle, // restore original angle
         isFrameGroup: true, // special flag to allow formats and quick actions to identify this
         frameType: frameType
      } as any);

      // We add the newly created frame group, and delete the original object/group
      canvas.discardActiveObject();
      canvas.add(group);
      canvas.setActiveObject(group);

      const macroCmd = new MacroCommand(
         `Apply ${frameType} frame`,
         [
            new DeleteObjectCommand("Remove Base", [objectToRemove]),
            new AddObjectCommand("Add Frame Group", group)
         ]
      );

      executeCommand(macroCmd);
      canvas.requestRenderAll();
      updateLayersList();
      isInternalChange.current = false;
   };

   const changeTextProp = (property: string, value: any, actionName: string) => {
      setTextProps(p => ({ ...p, [property]: value }));
      const active = fabricRef.current?.getActiveObject();
      if (active && (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox')) {
         const before = active.get(property as any);
         active.set(property as any, value);

         active.dirty = true;
         if (typeof active.setCoords === 'function') {
            active.setCoords();
         }
         fabricRef.current?.renderAll();

         const cmd = new PropertyChangeCommand(actionName, active, property, before, value);
         executeCommand(cmd);
      }
   };

   // Layer CRUD
   const changeCurrentColor = (newColor: string) => {
      setBrushColor(newColor);

      // Sync alpha with brushOpacity if newColor is RGBA
      if (newColor.startsWith('rgba(')) {
         const parts = newColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
         if (parts && parts[4]) {
            const alphaNum = Math.round(parseFloat(parts[4]) * 100);
            setBrushOpacity(alphaNum);
         }
      }

      if (activeTool === 'brush' && fabricRef.current?.freeDrawingBrush) {
         fabricRef.current.freeDrawingBrush.color = newColor;
      }
      const active = fabricRef.current?.getActiveObject();
      if (active) {
         if (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox') {
            const cmd = new PropertyChangeCommand("Change Text Color", active, "fill", active.get('fill'), newColor);
            executeCommand(cmd);
         } else if (active.type === 'path') {
            const cmd = new PropertyChangeCommand("Change Path Color", active, "stroke", active.get('stroke'), newColor);
            executeCommand(cmd);
         } else if (active.type !== 'image') {
            const cmd = new StyleChangeCommand(
               "Change Shape Color",
               active,
               { fill: active.get('fill'), stroke: active.get('stroke') },
               { fill: newColor, stroke: newColor }
            );
            executeCommand(cmd);
         }
      }
   };

   // Advanced Filters
   const getTargetImageForFilters = () => {
      let obj = fabricRef.current?.getActiveObject() as any;
      if (obj && obj.get('isFrameGroup')) {
         // Find the image inside the group
         const items = obj.getObjects();
         obj = items.find((i: any) => i.type === 'image') || obj;
      }
      return obj;
   };


   const addFilterToPipeline = (type: string) => {
      // Dummy function to prevent TS errors in QuickTab
      // This will be properly extracted when QuickTab is extracted
   };




   const applyFilter = (filterType: string, value: number) => {
      const obj = getTargetImageForFilters();
      if (obj && (obj.type === 'image' || obj.isCollageBlock)) {
         const filters = (fabric as any).Image?.filters || (fabric as any).filters;
         if (!filters) return;


         let filterIndex = -1;
         let beforeValue = 0;
         if (filterType === 'brightness') {
            filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Brightness);
            if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].brightness;
         } else if (filterType === 'contrast') {
            filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Contrast);
            if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].contrast;
         } else if (filterType === 'saturation') {
            filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
            if (filterIndex >= 0) beforeValue = obj.filters[filterIndex].saturation;
         } else if (filterType === 'grayscale') {
            filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
            if (filterIndex >= 0) beforeValue = -obj.filters[filterIndex].saturation;
         }

         const cmd = new FilterChangeCommand(`Apply ${filterType} Filter`, obj, filterType, beforeValue, value);
         executeCommand(cmd);
      }
   };

   // Filter Studio Pipeline Controls
   // jSquash Export Pipeline running on a high-compatibility Background Web Worker
   const [isExporting, setIsExporting] = useState(false);

   const generateArtboardPixelBuffer = async (board: Artboard): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
      if (!fabricRef.current) throw new Error("Canvas not ready");

      // Create an offscreen canvas of the exact artboard dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = board.width;
      tempCanvas.height = board.height;
      const ctx = tempCanvas.getContext('2d')!;

      // 1. Draw background
      if (!board.transparent) {
         ctx.fillStyle = board.backgroundColor || "#ffffff";
         ctx.fillRect(0, 0, board.width, board.height);
      } else {
         ctx.clearRect(0, 0, board.width, board.height);
      }

      // 2. Draw elements assigned to this artboard
      ctx.save();
      ctx.translate(-board.x, -board.y);

      const objs = fabricRef.current.getObjects();
      objs.forEach((obj) => {
         if (!obj.visible || obj.type === 'activeSelection') return;

         const assignedId = (obj as any).artboardId;
         if (assignedId === board.id) {
            obj.render(ctx);
         }
      });

      ctx.restore();

      const imgData = ctx.getImageData(0, 0, board.width, board.height);
      return {
         buffer: imgData.data.buffer,
         width: board.width,
         height: board.height
      };
   };

   const optimizePixelBuffer = async (
      pixelBuffer: ArrayBuffer,
      width: number,
      height: number,
      settings: ExportSettings,
      isLivePreview: boolean = false
   ): Promise<{ buffer: ArrayBuffer, psnr?: number, decodedPixels?: ArrayBuffer, decodedWidth?: number, decodedHeight?: number }> => {
      const hasSimdResult = await hasSimd();
      const hasThreadsResult = await hasThreads();

      const worker = new ImageWorker();

      return await new Promise<{ buffer: ArrayBuffer, psnr?: number, decodedPixels?: ArrayBuffer, decodedWidth?: number, decodedHeight?: number }>((resolve, reject) => {
         worker.onmessage = (e) => {
            if (e.data.success) {
               resolve({ buffer: e.data.resultBuffer, psnr: e.data.psnr, decodedPixels: e.data.decodedPixels, decodedWidth: e.data.decodedWidth, decodedHeight: e.data.decodedHeight });
            } else {
               reject(new Error(e.data.error || "Background processing failed"));
            }
            worker.terminate();
         };
         worker.onerror = (err) => {
            reject(err);
            worker.terminate();
         };

         worker.postMessage({
            pixelBuffer,
            width,
            height,
            exportWidth: settings.resize.enabled ? settings.resize.width : width,
            exportHeight: settings.resize.enabled ? settings.resize.height : height,
            exportResizeMethod: settings.resize.method,
            exportResizePremul: settings.resize.premul,
            exportResizeLinearRGB: settings.resize.linearRGB,
            exportFormat: settings.format,
            exportQuality: settings.format === 'jpeg' ? settings.mozjpeg.quality : settings.webp.quality,

            calculateMetrics: isLivePreview,

            wasmUrls: {
               png: pngWasmUrl,
               jpeg: jpegWasmUrl,
               webp: webpWasmUrl,
               webpSimd: webpSimdWasmUrl,
               avif: avifWasmUrl,
               avifMt: avifMtWasmUrl,
               resize: resizeWasmUrl,
               jxl: jxlWasmUrl,
               // Decoder URLs
               jpegDecode: "https://unpkg.com/@jsquash/jpeg@1.6.0/codec/dec/mozjpeg_dec.wasm",
               webpDecode: "https://unpkg.com/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm",
               avifDecode: "https://unpkg.com/@jsquash/avif@2.1.1/codec/dec/avif_dec.wasm",
               jxlDecode: "https://unpkg.com/@jsquash/jxl@1.3.0/codec/dec/jxl_dec.wasm",
            },
            hasSimdResult,
            hasThreadsResult,

            // Advanced Settings
            mozjpeg: settings.mozjpeg,
            webp: settings.webp,
            avif: settings.avif,
            jxl: settings.jxl,
            pngLevel: settings.png.level,
            pngInterlace: settings.png.interlace,
            paletteReduction: settings.png.paletteReduction,
            paletteColors: settings.png.paletteColors,
            ditherLevel: settings.png.ditherLevel,
         }, [pixelBuffer]);
      });
   };

   const handleExport = async () => {
      if (!fabricRef.current || artboards.length === 0) return;
      setIsExporting(true);
      try {
         let targets: Artboard[] = [];
         if (exportTarget === "current") {
            const curr = artboards.find(b => b.id === activeArtboardId) || artboards[0];
            targets = [curr];
         } else if (exportTarget === "selected") {
            targets = artboards.filter(b => selectedExportIds[b.id]);
            if (targets.length === 0) {
               alert("No artboards selected to export!");
               setIsExporting(false);
               return;
            }
         } else {
            targets = artboards;
         }

         if (targets.length === 1) {
            const board = targets[0];
            const { buffer, width, height } = await generateArtboardPixelBuffer(board);

            const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, exportSettings);
            const blob = new Blob([rawBuffer], { type: `image/${exportSettings.format}` });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            let fileName = board.name.toLowerCase().replace(/\s+/g, '_');
            if (exportSettings.askForFilename) {
               const custom = window.prompt("Enter filename for export:", fileName);
               if (custom) fileName = custom.replace(/\s+/g, '_');
            } else {
               fileName = Math.random().toString(36).substring(2, 10);
            }

            a.download = `${fileName}.${exportSettings.format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
         } else {
            const zip = new JSZip();
            for (const board of targets) {
               const { buffer, width, height } = await generateArtboardPixelBuffer(board);
               // In batch mode, we disable custom resize per image for consistency unless explicitly architecture changed
               const { buffer: rawBuffer } = await optimizePixelBuffer(buffer, width, height, {
                  ...exportSettings,
                  resize: { ...exportSettings.resize, enabled: false }
               });

               let fileName = board.name.toLowerCase().replace(/\s+/g, '_');
               if (exportSettings.askForFilename) {
                  const custom = window.prompt(`Enter filename for artboard '${board.name}':`, fileName);
                  if (custom) fileName = custom.replace(/\s+/g, '_');
               } else {
                  fileName = Math.random().toString(36).substring(2, 10);
               }

               zip.file(`${fileName}.${exportSettings.format}`, rawBuffer);
            }
            const zipContent = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipContent);
            const a = document.createElement('a');
            a.href = url;

            let zipName = "artboards_export";
            if (exportSettings.askForFilename) {
               const customZip = window.prompt("Enter filename for ZIP archive:", zipName);
               if (customZip) zipName = customZip.replace(/\s+/g, '_');
            } else {
               zipName = "export_" + Math.random().toString(36).substring(2, 10);
            }

            a.download = `${zipName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
         }
      } catch (err) {
         console.error("Export Failed", err);
      } finally {
         setIsExporting(false);
      }
   };

   // Helper to format bytes cleanly
   const formatBytes = (bytes: number): string => formatFileSize(bytes, 'B', 1);

   // Live preview generator for Squoosh-like image comparison
   const generateLivePreview = async () => {
      if (!fabricRef.current || artboards.length === 0) return;

      const board = artboards.find(b => b.id === activeArtboardId) || artboards[0];
      if (!board) return;

      setIsGeneratingPreview(true);
      setCurrentPreviewOp("Extracting active composite elements...");

      try {
         // 1. Get raw pixel buffer
         const { buffer, width, height } = await generateArtboardPixelBuffer(board);

         // 1. Determine Preview Resolutions
         // The Original ALWAYS uses the active artboard bounds (board.width, board.height).
         let origTargetW = board.width;
         let origTargetH = board.height;

         // The Optimized ALWAYS uses the final output bounds (taking resize into account).
         let optTargetW = origTargetW;
         let optTargetH = origTargetH;
         if (exportTarget === "current" && exportSettings.resize.enabled) {
            optTargetW = exportSettings.resize.width;
            optTargetH = exportSettings.resize.height;
         }

         setOriginalPreviewDims({ w: origTargetW, h: origTargetH });
         setOptimizedPreviewDims({ w: optTargetW, h: optTargetH });

         // We downscale ONLY for internal preview performance if dimensions are massive,
         // but we maintain the relative scale between Original and Optimized.
         let previewScale = 1;
         const maxTargetDim = Math.max(origTargetW, origTargetH, optTargetW, optTargetH);
         if (maxTargetDim > 1200) {
            previewScale = 1200 / maxTargetDim;
         }

         const origPreviewW = Math.max(1, Math.round(origTargetW * previewScale));
         const origPreviewH = Math.max(1, Math.round(origTargetH * previewScale));

         const optPreviewW = Math.max(1, Math.round(optTargetW * previewScale));
         const optPreviewH = Math.max(1, Math.round(optTargetH * previewScale));

         // 2. Original URL extraction & original lossless blob measurement
         setCurrentPreviewOp("Rendering before/after viewport...");
         const originalCanvas = document.createElement('canvas');
         originalCanvas.width = origPreviewW;
         originalCanvas.height = origPreviewH;
         const oCtx = originalCanvas.getContext('2d')!;

         const sourceImage = new ImageData(new Uint8ClampedArray(buffer), width, height); // width/height is board.width/height
         const offscreenOriginal = document.createElement('canvas');
         offscreenOriginal.width = width;
         offscreenOriginal.height = height;
         offscreenOriginal.getContext('2d')!.putImageData(sourceImage, 0, 0);
         oCtx.drawImage(offscreenOriginal, 0, 0, origPreviewW, origPreviewH);

         const originalUrl = originalCanvas.toDataURL("image/png");
         setOriginalImageUrl(originalUrl);

         // Measure real original file size by generating a PNG blob
         setCurrentPreviewOp("Analyzing baseline image color & size...");
         const originalBlob = await new Promise<Blob | null>(r => offscreenOriginal.toBlob(r, 'image/png'));
         const origSize = originalBlob ? originalBlob.size : buffer.byteLength;
         setOriginalSize(origSize);

         // 3. Run WASM optimization
         const formatLabel = exportSettings.format.toUpperCase();
         setCurrentPreviewOp(`Running jSquash WASM optimization (${formatLabel})...`);

         const previewSettings: ExportSettings = {
            ...exportSettings,
            resize: {
               ...exportSettings.resize,
               enabled: true,
               width: optPreviewW,
               height: optPreviewH
            }
         };

         const { buffer: optimizedBuffer, psnr: calculatedPsnr, decodedPixels, decodedWidth, decodedHeight } = await optimizePixelBuffer(
            buffer.slice(0),
            width,
            height,
            previewSettings,
            true
         );

         const optimizedBlob = new Blob([optimizedBuffer], { type: `image/${exportSettings.format}` });

         // Calculate projected optimized size since we might have downscaled for preview performance
         const projectedOptimizedSize = previewScale < 1 ? Math.round(optimizedBlob.size / (previewScale * previewScale)) : optimizedBlob.size;
         setOptimizedSize(projectedOptimizedSize);
         setPsnr(calculatedPsnr);

         let optUrl = '';
         if (decodedPixels && decodedWidth && decodedHeight) {
            const rawCanvas = document.createElement('canvas');
            rawCanvas.width = decodedWidth;
            rawCanvas.height = decodedHeight;
            const rctx = rawCanvas.getContext('2d')!;
            const imgData = new ImageData(new Uint8ClampedArray(decodedPixels), decodedWidth, decodedHeight);
            rctx.putImageData(imgData, 0, 0);
            optUrl = rawCanvas.toDataURL("image/png");
         } else {
            optUrl = URL.createObjectURL(optimizedBlob);
         }
         setOptimizedImageUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return optUrl;
         });

      } catch (err: any) {
         console.error("Live comparison preview optimization failed:", err);
      } finally {
         setIsGeneratingPreview(false);
         setCurrentPreviewOp("");
      }
   };

   // Sync tab open/close to active comparison mode
   useEffect(() => {
      if (activeTab === "export") {
         setComparisonMode(true);
         generateLivePreview();
      } else {
         setComparisonMode(false);
      }
   }, [activeTab]);

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
      activeArtboardId,
      exportTarget,
      exportSettings.format,
      exportSettings.resize,
      exportSettings.mozjpeg,
      exportSettings.webp,
      exportSettings.avif,
      exportSettings.png,
      exportSettings.jxl
   ]);

   // Hide objects of inactive artboards on mobile
   useEffect(() => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      if (!canvas) return;
      const objects = canvas.getObjects();
      let madeChanges = false;

      objects.forEach(obj => {
         // Don't hide crop overlays etc.
         if ((obj as any).id === 'crop-overlay' || (obj as any).id === 'crop-dimmask') return;

         const objArtboardId = (obj as any).artboardId;
         if (!objArtboardId) return; // skip if no artboard

         const shouldBeVisible = isMobile ? objArtboardId === activeArtboardId : true;
         if (obj.visible !== shouldBeVisible) {
            obj.visible = shouldBeVisible;
            madeChanges = true;
         }
      });

      if (madeChanges) {
         canvas.requestRenderAll();
      }

      // Fit to screen on mobile whenever active artboard changes, or restore desktop state on return
      if (isMobile) {
         const activeBoard = artboards.find(b => b.id === activeArtboardId) || artboards[0];
         if (activeBoard) {
            const cw = canvas.width!;
            const ch = canvas.height!;
            if (cw > 0 && ch > 0) {
               const padding = 32;
               const zoom = Math.min(cw / (activeBoard.width + padding), ch / (activeBoard.height + padding), 2.5);
               canvas.setZoom(zoom);

               const vpt = canvas.viewportTransform!;
               const newVpt = vpt.slice() as any;
               newVpt[4] = cw / 2 - (activeBoard.x + activeBoard.width / 2) * zoom;
               newVpt[5] = ch / 2 - (activeBoard.y + activeBoard.height / 2) * zoom;
               canvas.setViewportTransform(newVpt);
               setZoomPercent(Math.round(zoom * 100));
            }
         }
      } else {
         if (viewportTransformRef.current) {
            canvas.setViewportTransform(viewportTransformRef.current.slice() as any);
            const zoom = canvas.getZoom();
            setZoomPercent(Math.round(zoom * 100));
            canvas.requestRenderAll();
         } else {
            fitView();
         }
      }
   }, [isMobile, activeArtboardId, artboards]);

   return (
      <CollageConfigProvider value={collageProps}>
         <AIProvider>
            <ShapePropertiesProvider value={shapeProps}>
               <ToolProvider value={{
                  activeTool, setTool, brushColor, changeCurrentColor,
                  brushSize, setBrushSize, brushOpacity, setBrushOpacity,
                  brushHardness, setBrushHardness, brushFlow, setBrushFlow,
                  brushSmoothing, setBrushSmoothing, brushType, setBrushType,
                  textProps, setTextProps
               }}>
                  <CanvasProvider value={{
                     fabricRef, enterCropMode, resetCrop, addText, addRect, addCircle, addTriangle, addLine,
                     flipX, flipY, addAlignedCollageText, updateSelectedShapeProperty, changeTextProp,
                     applyFilter, alignSelection, duplicateActiveObject, deleteActiveObject,
                     updateArtboardPropDirect, generateSmartCollage, generateBleed,
                     updateCollageBlockStyleProperty, fillCollageBlockWithImage, fitCollageToArtboard,
                     setZoomPercent
                  }}>
                     <SelectionProvider value={{
                        activeObj: fabricRef.current?.getActiveObject() || null,
                        activeObjs: fabricRef.current?.getActiveObjects() || [],
                        activeSelection: !!fabricRef.current?.getActiveObject(),
                        isCollageBlock: fabricRef.current?.getActiveObject()?.type === 'rect' && (fabricRef.current?.getActiveObject() as any)?.id?.startsWith('collage-block-'),
                        isCollageSelected: !!fabricRef.current?.getActiveObject() && ((fabricRef.current?.getActiveObject() as any)?.isCollageBlock || (fabricRef.current?.getActiveObject()?.type === 'activeSelection' && (fabricRef.current?.getActiveObject() as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock))),
                        parentAlignmentObj, setParentAlignmentObj,
                        selectionType, setSelectionType,
                        textObj: fabricRef.current?.getActiveObject() as any,
                        textContent: (fabricRef.current?.getActiveObject() as any)?.text || ''
                     }}>
                        <HistoryProvider value={{ commandIndex, historyNames, performUndo, performRedo, executeCommand }}>
                           <WorkspaceUIProvider value={{
                              isMobile, setShowShortcuts, setActiveTab, handleImportImageClick, handleFileUpload,
                              artboards, setArtboards, activeArtboardId, setActiveArtboardId,
                              imageFilters, setImageFilters, benchmarkInfo, setBenchmarkInfo,
                              createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
                              updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
                           }}>
                              <LayersProvider value={{ layers, setLayers, selectedLayerId, setSelectedLayerId, updateLayersList, getLayersOrder, handleLayerOrder, selectLayer, moveLayerUp, moveLayerDown }}>
                                 <div
                                    className="w-full h-full flex flex-col bg-[#121212] text-[#E0E0E0] select-none"
                                    ref={containerRef}
                                 >

                                    {/* Top Toolbar */}
                                    <WorkspaceHeader />

                                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

                                       {/* Left Toolbar - Tools (Desktop) */}
                                       <LeftToolbar />

                                       {/* Center Canvas & Artboard Area */}
                                       <div className="flex-1 flex flex-col min-w-0 bg-[#121212] overflow-hidden relative">

                                          {/* Artboard Bar */}
                                          {activeTab !== 'export' && !isMobile && (
                                             <div className="h-10 bg-[#1E1E1E] border-b border-[#2C2C2C] flex items-center px-1.5 shrink-0 overflow-x-auto no-scrollbar gap-1 relative z-20 shadow-sm select-none">
                                                {isMobile && (
                                                   <button
                                                      onClick={() => setShowMobileArtboardsGallery(true)}
                                                      className="h-[30px] w-[30px] shrink-0 sticky left-0 z-10 bg-[#292929] border border-[#3C3C3C] shadow flex items-center justify-center rounded-md mr-1 text-[#C0C0C0] hover:text-white"
                                                   >
                                                      <SquareDashed size={14} />
                                                   </button>
                                                )}
                                                {artboards.map(b => {
                                                   const isActive = b.id === activeArtboardId;
                                                   return (
                                                      <div
                                                         key={b.id}
                                                         className={`h-[30px] flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-all border border-transparent group ${isActive ? 'bg-[#292929] border-[#3C3C3C] shadow-sm' : 'hover:bg-[#202020] text-[#808080]'}`}
                                                         onClick={() => {
                                                            setActiveArtboardId(b.id);
                                                            if (fabricRef.current) {
                                                               const cw = fabricRef.current.width!;
                                                               const ch = fabricRef.current.height!;
                                                               const vpt = fabricRef.current.viewportTransform!;
                                                               const newVpt = vpt.slice() as any;
                                                               newVpt[4] = cw / 2 - (b.x + b.width / 2) * newVpt[0];
                                                               newVpt[5] = ch / 2 - (b.y + b.height / 2) * newVpt[3];
                                                               fabricRef.current.setViewportTransform(newVpt);
                                                            }
                                                         }}
                                                      >
                                                         <span className={`text-[11px] font-semibold whitespace-nowrap outline-none flex items-center gap-1.5 ${isActive ? 'text-[#E0E0E0]' : ''}`}>
                                                            {isActive && <div className="w-[4px] h-[4px] rounded-full bg-blue-500" />}
                                                            {b.name}
                                                         </span>

                                                         <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                               className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3A3A3A] text-[#A0A0A0] transition-colors artboard-dropdown-toggle"
                                                               onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  const rect = e.currentTarget.getBoundingClientRect();
                                                                  setArtboardDropdown(artboardDropdown?.id === b.id ? null : { id: b.id, x: rect.left, y: rect.bottom + 6 });
                                                               }}
                                                            >
                                                               <MoreHorizontal size={12} />
                                                            </button>
                                                         </div>
                                                      </div>
                                                   );
                                                })}

                                                <div className="w-px h-5 bg-[#333] mx-1 shrink-0" />

                                                <button
                                                   className="h-[30px] px-3 flex items-center gap-1.5 rounded-md hover:bg-[#252525] text-[#808080] hover:text-[#C0C0C0] transition-colors shrink-0"
                                                   onClick={() => createArtboard()}
                                                >
                                                   <Plus size={13} />
                                                   <span className="text-[11px] font-semibold">New</span>
                                                </button>
                                             </div>
                                          )}

                                          {/* Dropdown Menu Portal */}
                                          {artboardDropdown && (
                                             <div
                                                className="fixed inset-0 z-50 pointer-events-auto"
                                                onClick={() => setArtboardDropdown(null)}
                                             >
                                                <div
                                                   onClick={(e) => e.stopPropagation()}
                                                   style={{ left: Math.min(artboardDropdown.x, window.innerWidth - 180), top: artboardDropdown.y }}
                                                   className="absolute bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg shadow-2xl py-1 min-w-[170px] artboard-dropdown-container"
                                                >
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#666] border-b border-[#252525] mb-1">Artboard</div>
                                                   <ContextMenuItem icon={Type} label="Rename Artboard" onClick={() => {
                                                      const board = artboards.find(b => b.id === artboardDropdown.id);
                                                      if (board) {
                                                         setRenamingArtboard({ id: board.id, name: board.name });
                                                      }
                                                      setArtboardDropdown(null);
                                                   }} />
                                                   <ContextMenuItem icon={Copy} label="Duplicate Artboard" onClick={() => {
                                                      const board = artboards.find(b => b.id === artboardDropdown.id);
                                                      if (board) {
                                                         createArtboard(board.name + " Copy", board.width, board.height);
                                                      }
                                                      setArtboardDropdown(null);
                                                   }} />
                                                   <ContextMenuItem icon={Expand} label="Resize Options" onClick={() => {
                                                      setActiveArtboardId(artboardDropdown.id);
                                                      setActiveTab("artboards");
                                                      setArtboardDropdown(null);
                                                   }} />
                                                   <ContextMenuItem icon={Download} label="Export Artboard" onClick={() => {
                                                      setActiveArtboardId(artboardDropdown.id);
                                                      setExportTarget("current");
                                                      setActiveTab("export");
                                                      setArtboardDropdown(null);
                                                   }} />
                                                   {artboards.length > 1 && (
                                                      <>
                                                         <div className="h-px bg-[#252525] my-1" />
                                                         <ContextMenuItem icon={Trash2} label="Delete Artboard" danger onClick={() => {
                                                            deleteArtboard(artboardDropdown.id);
                                                            setArtboardDropdown(null);
                                                         }} />
                                                      </>
                                                   )}
                                                </div>
                                             </div>
                                          )}

                                          {/* Canvas Container */}
                                          <div
                                             className="custom-dropzone flex-1 overflow-hidden flex items-center justify-center relative touch-none bg-[#121212]"
                                             onContextMenu={handleContextMenu}
                                             onPointerDown={(e) => {
                                                // Mobile panel is now a permanent split view, no tap-to-close needed
                                             }}
                                             onDragEnter={(e) => { e.preventDefault(); }}
                                             onDragLeave={(e) => { e.preventDefault(); }}
                                             onDragOver={(e) => { e.preventDefault(); }}
                                             onDrop={async (e) => {
                                                e.preventDefault();
                                                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                   const files = Array.from(e.dataTransfer.files);
                                                   const imageFiles = files.filter(f => f.type.startsWith('image/'));

                                                   // Check if dropped over a collage block
                                                   const canvas = fabricRef.current;
                                                   let droppedOnBlock = false;

                                                   if (canvas && imageFiles.length > 0) {
                                                      const target = canvas.findTarget(e.nativeEvent as any);
                                                      if (target && (target as any).isCollageBlock) {
                                                         const file = imageFiles[0];
                                                         const reader = new FileReader();
                                                         reader.onload = (event) => {
                                                            const dataUrl = event.target?.result as string;
                                                            const beforeState = { collageImageSrc: (target as any).collageImageSrc };
                                                            const afterState = { collageImageSrc: dataUrl };
                                                            (target as any).collageImageSrc = dataUrl;
                                                            canvas.requestRenderAll();

                                                            const cmd = new StyleChangeCommand("Fill Block with Image", target as unknown as fabric.Object, beforeState, afterState);
                                                            executeCommand(cmd);
                                                         };
                                                         reader.readAsDataURL(file);
                                                         droppedOnBlock = true;
                                                      }
                                                   }

                                                   if (!droppedOnBlock) {
                                                      const promises = imageFiles.map(file => {
                                                         return new Promise<{ url: string, type: 'svg' | 'image', name: string }>((resolve) => {
                                                            const reader = new FileReader();
                                                            reader.onload = (event) => {
                                                               const dataUrl = event.target?.result as string;
                                                               if (file.type === 'image/svg+xml') {
                                                                  resolve({ url: dataUrl, type: 'svg', name: file.name });
                                                               } else {
                                                                  resolve({ url: dataUrl, type: 'image', name: file.name });
                                                               }
                                                            };
                                                            reader.readAsDataURL(file);
                                                         });
                                                      });

                                                      const results = await Promise.all(promises);
                                                      if (results.length > 0) {
                                                         importAssets(results);
                                                      }
                                                   }
                                                }
                                             }}
                                          >
                                             {/* subtle grid background */}
                                             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                             {/* Main Fabric Canvas Wrapper (hidden during comparison mode) */}
                                             <div className={`shadow-2xl ring-1 ring-white/5 relative ${comparisonMode ? 'hidden' : 'block'}`}>
                                                <canvas ref={canvasRef} className="block" />
                                             </div>

                                             {/* Dynamic Photoshop-style Brush Adjustment floating HUD and diameter preview */}
                                             {showHud && hudPosition && (() => {
                                                const getRgba = (hex: string, alpha: number) => {
                                                   let c = hex.replace('#', '');
                                                   if (c.length === 3) {
                                                      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
                                                   }
                                                   const r = parseInt(c.substring(0, 2), 16) || 0;
                                                   const g = parseInt(c.substring(2, 4), 16) || 0;
                                                   const b = parseInt(c.substring(4, 6), 16) || 0;
                                                   return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                                };

                                                const zoom = fabricRef.current?.getZoom() || 1;
                                                const size = brushSize * zoom;

                                                const strokeWidth = 3;
                                                const ringDiameter = Math.max(size, 48);
                                                const radius = (ringDiameter / 2) + 6;
                                                const padding = 12;
                                                const svgSize = ringDiameter + (padding * 2);
                                                const center = svgSize / 2;
                                                const circumference = 2 * Math.PI * radius;

                                                let percentage = 100;
                                                let strokeColor = '#3b82f6'; // Size: Blue

                                                if (activeBrushProperty === 'opacity') {
                                                   percentage = brushOpacity;
                                                   strokeColor = '#a855f7'; // Opacity: Purple/Magenta
                                                } else if (activeBrushProperty === 'hardness') {
                                                   percentage = brushHardness;
                                                   strokeColor = '#f59e0b'; // Hardness: Amber/Yellow
                                                } else {
                                                   percentage = (brushSize / 500) * 100;
                                                   strokeColor = '#3b82f6'; // Size: Blue
                                                }

                                                const strokeDashoffset = circumference - (percentage / 100) * circumference;

                                                let previewStyle: React.CSSProperties = {
                                                   width: `${size}px`,
                                                   height: `${size}px`,
                                                   maxWidth: '450px',
                                                   maxHeight: '450px',
                                                   minWidth: '6px',
                                                   minHeight: '6px',
                                                   borderRadius: '9999px',
                                                   border: '1.5px solid rgba(255, 255, 255, 0.9)',
                                                   boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.55), 0 12px 28px rgba(0, 0, 0, 0.45)',
                                                   display: 'flex',
                                                   alignItems: 'center',
                                                   justifyContent: 'center',
                                                   overflow: 'hidden',
                                                   backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='8' height='8' fill='%231D1E24'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%231D1E24'/%3E%3Crect x='8' width='8' height='8' fill='%230D0F13'/%3E%3Crect y='8' width='8' height='8' fill='%230D0F13'/%3E%3C/svg%3E")`,
                                                   boxSizing: 'border-box',
                                                   transition: 'width 75ms ease-out, height 75ms ease-out'
                                                };

                                                const baseColor = brushColor || '#ef4444';
                                                const opacity = brushOpacity / 100;
                                                const hPercent = brushHardness;

                                                const previewCoreStyle: React.CSSProperties = {
                                                   width: '100%',
                                                   height: '100%',
                                                   borderRadius: '9999px',
                                                   background: `radial-gradient(circle, ${getRgba(baseColor, opacity)} 0%, ${getRgba(baseColor, opacity * (hPercent / 100))} ${hPercent}%, transparent 100%)`,
                                                   transition: 'all 50ms ease-out'
                                                };

                                                return (
                                                   <div
                                                      id="brush-hud-overlay"
                                                      className="absolute pointer-events-none z-[100] flex flex-col items-center justify-center select-none"
                                                      style={{
                                                         left: hudPosition.x,
                                                         top: hudPosition.y,
                                                         transform: `translate(-50%, -50%) scale(${hudFadingOut ? 0.92 : 1})`,
                                                         opacity: hudFadingOut ? 0 : 1,
                                                         transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                                                      }}
                                                   >
                                                      {/* Circle Wrapper with SVG Progress Dial */}
                                                      <div className="relative flex items-center justify-center" style={{ width: `${svgSize}px`, height: `${svgSize}px` }}>

                                                         <svg
                                                            width={svgSize}
                                                            height={svgSize}
                                                            className="absolute top-0 left-0 pointer-events-none"
                                                         >
                                                            {/* Contrast dark dropshadow circle */}
                                                            <circle
                                                               cx={center}
                                                               cy={center}
                                                               r={radius}
                                                               fill="none"
                                                               stroke="rgba(0, 0, 0, 0.5)"
                                                               strokeWidth={strokeWidth + 2}
                                                            />
                                                            {/* Empty track */}
                                                            <circle
                                                               cx={center}
                                                               cy={center}
                                                               r={radius}
                                                               fill="none"
                                                               stroke="rgba(255, 255, 255, 0.15)"
                                                               strokeWidth={strokeWidth}
                                                            />
                                                            {/* Dynamic trace progress segment */}
                                                            <circle
                                                               cx={center}
                                                               cy={center}
                                                               r={radius}
                                                               fill="none"
                                                               stroke={strokeColor}
                                                               strokeWidth={strokeWidth}
                                                               strokeDasharray={circumference}
                                                               strokeDashoffset={strokeDashoffset}
                                                               strokeLinecap="round"
                                                               transform={`rotate(-90 ${center} ${center})`}
                                                               className="transition-[stroke-dashoffset] duration-75 ease"
                                                               style={{
                                                                  filter: `drop-shadow(0 0 3px ${strokeColor}cc)`,
                                                               }}
                                                            />
                                                         </svg>

                                                         {/* Center circle brush tip container with checkerboard bg */}
                                                         <div style={previewStyle as React.CSSProperties}>
                                                            <div style={previewCoreStyle} />
                                                         </div>
                                                      </div>

                                                      {/* Floating HUD Information Pill */}
                                                      <div className="mt-4 bg-[#0B0D13]/95 backdrop-blur-xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-full px-5 py-2.5 flex items-center gap-3 select-none animate-in fade-in duration-100 ease-out">
                                                         {activeBrushProperty === 'size' && (
                                                            <>
                                                               <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                                                  <Brush size={12} className="text-blue-400" />
                                                                  <span>Size</span>
                                                               </div>
                                                               <div className="w-px h-3.5 bg-white/15" />
                                                               <div className="text-sm font-mono font-extrabold text-white">
                                                                  {brushSize}px
                                                               </div>
                                                            </>
                                                         )}
                                                         {activeBrushProperty === 'opacity' && (
                                                            <>
                                                               <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                                                  <Droplets size={12} className="text-purple-400" />
                                                                  <span>Opacity</span>
                                                               </div>
                                                               <div className="w-px h-3.5 bg-white/15" />
                                                               <div className="text-sm font-mono font-extrabold text-white">
                                                                  {brushOpacity}%
                                                               </div>
                                                            </>
                                                         )}
                                                         {activeBrushProperty === 'hardness' && (
                                                            <>
                                                               <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 uppercase tracking-widest font-black">
                                                                  <Circle size={12} className="text-amber-400 fill-amber-400/10" />
                                                                  <span>Hardness</span>
                                                               </div>
                                                               <div className="w-px h-3.5 bg-white/15" />
                                                               <div className="text-sm font-mono font-extrabold text-white">
                                                                  {brushHardness}%
                                                               </div>
                                                            </>
                                                         )}
                                                      </div>
                                                   </div>
                                                );
                                             })()}

                                             {/* Empty State Overlay */}
                                             {isLoaded && artboards.length === 0 && (
                                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#121212]/80 backdrop-blur-sm pointer-events-auto p-4 md:p-6">
                                                   <div className="flex flex-col items-center gap-3 md:gap-4 p-5 md:p-8 bg-[#1A1A1A] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-[320px] md:max-w-sm text-center mx-auto relative overflow-hidden">
                                                      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(45deg,transparent_25%,white_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
                                                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 mb-1 shadow-inner relative z-10 ring-1 ring-blue-500/20">
                                                         <SquareDashed size={24} className="w-5 h-5 md:w-7 md:h-7" />
                                                      </div>
                                                      <div className="relative z-10 w-full">
                                                         <h3 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-white mb-1.5 md:mb-2">No active project</h3>
                                                         <p className="text-[10px] md:text-xs text-slate-400 mb-4 md:mb-6 leading-relaxed px-2">Create a new artboard to start placing elements and building your composition.</p>
                                                      </div>
                                                      <button
                                                         onClick={() => createArtboard()}
                                                         className="relative z-10 w-full flex items-center justify-center gap-2 px-5 md:px-6 h-10 md:h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition shadow-lg shadow-blue-600/20 active:scale-95"
                                                      >
                                                         <Plus size={16} /> Create Artboard
                                                      </button>
                                                   </div>
                                                </div>
                                             )}

                                             {isCropping && (
                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm sm:max-w-none sm:w-auto z-[50]">
                                                   <div className="bg-[#1A1A1A]/95 backdrop-blur-xl border border-[#2D2D2D] p-1.5 rounded-xl shadow-[0_16px_32px_rgba(0,0,0,0.6)] flex items-center justify-between sm:justify-start gap-2 overflow-x-auto no-scrollbar">
                                                      <div className="hidden sm:flex px-3 items-center gap-1.5 border-r border-[#333] pr-3 shrink-0">
                                                         <Crop size={14} className="text-blue-400" />
                                                         <span className="text-[11px] font-bold text-slate-200">Crop</span>
                                                      </div>

                                                      <select
                                                         className="bg-[#252525] hover:bg-[#333] text-slate-200 text-[10px] sm:text-[11px] px-2 py-1.5 rounded-md border border-[#3A3A3A] outline-none cursor-pointer appearance-none pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%205%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[position:right_6px_center] bg-no-repeat w-24 sm:w-auto shrink-0"
                                                         defaultValue="free"
                                                         onChange={(e) => {
                                                            const val = e.target.value;
                                                            const { cropRect, origObj } = cropSessionRef.current;
                                                            if (!cropRect || !origObj) return;

                                                            if (val === 'free') {
                                                               cropRect.set({ lockUniScaling: false });
                                                            } else {
                                                               let ratio = 1;
                                                               if (val === 'original') {
                                                                  ratio = origObj.width! / origObj.height!;
                                                               } else {
                                                                  ratio = parseFloat(val);
                                                               }

                                                               const center = cropRect.getCenterPoint();
                                                               const curW = cropRect.getScaledWidth();
                                                               const curH = cropRect.getScaledHeight();

                                                               let newW = curW;
                                                               let newH = newW / ratio;

                                                               // Keep it somewhat within original bounds logic (simplified)
                                                               if (newH > origObj.getScaledHeight()) {
                                                                  newH = origObj.getScaledHeight();
                                                                  newW = newH * ratio;
                                                               }
                                                               if (newW > origObj.getScaledWidth()) {
                                                                  newW = origObj.getScaledWidth();
                                                                  newH = newW / ratio;
                                                               }

                                                               cropRect.set({
                                                                  width: newW,
                                                                  height: newH,
                                                                  scaleX: 1,
                                                                  scaleY: 1,
                                                                  lockUniScaling: true,
                                                               });

                                                               cropRect.setPositionByOrigin(center, 'center', 'center');
                                                               cropRect.setCoords();
                                                            }
                                                            fabricRef.current?.renderAll();
                                                         }}
                                                      >
                                                         <option value="free">Free Crop</option>
                                                         <option value="original">Original Ratio</option>
                                                         <optgroup label="Standard Dimensions">
                                                            <option value="1">1:1 Square</option>
                                                            <option value={4 / 3}>4:3 (Landscape)</option>
                                                            <option value={16 / 9}>16:9 (Widescreen)</option>
                                                            <option value={9 / 16}>9:16 (Vertical)</option>
                                                            <option value={3 / 2}>3:2 (Classic)</option>
                                                            <option value={210 / 297}>A4 (210x297mm)</option>
                                                            <option value={8.5 / 11}>Letter (8.5x11")</option>
                                                         </optgroup>
                                                         <optgroup label="Document Presets">
                                                            <option value={35 / 45}>India Passport (35x45mm)</option>
                                                            <option value={1}>US Passport (2x2")</option>
                                                            <option value={1}>Visa Photo (2x2")</option>
                                                            <option value={86 / 54}>ID Card (86x54mm)</option>
                                                            <option value={35 / 45}>Student Photo (35x45)</option>
                                                            <option value={1}>Profile Pic (1:1)</option>
                                                         </optgroup>
                                                         <optgroup label="Social Media Presets">
                                                            <option value={1}>Ig Post (1080x1080)</option>
                                                            <option value={1080 / 1920}>Ig Story (1080x1920)</option>
                                                            <option value={16 / 9}>YT Thumb (1280x720)</option>
                                                            <option value={1}>LinkedIn (400x400)</option>
                                                            <option value={820 / 312}>Fb Cover (820x312)</option>
                                                         </optgroup>
                                                      </select>

                                                      <div className="hidden sm:block h-4 w-px bg-[#333] ml-1 mr-1"></div>

                                                      <div className="flex items-center gap-1.5 shrink-0">
                                                         <button onClick={applyCrop} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap"><Check size={12} /> <span className="hidden sm:inline">Apply</span></button>
                                                         <button onClick={cancelCrop} className="px-3 py-1.5 bg-[#252525] hover:bg-[#333] text-slate-300 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 whitespace-nowrap"><X size={12} /> <span className="hidden sm:inline">Cancel</span></button>
                                                      </div>
                                                   </div>
                                                </div>
                                             )}

                                             {/* Squoosh-like image comparison viewer component */}
                                             <ExportLiveComparisonViewer
                                                comparisonMode={comparisonMode}
                                                isMobile={isMobile}
                                                activeTab={activeTab}
                                                setActiveTab={setActiveTab}
                                                handleExport={handleExport}
                                                comparisonPreviewMode={comparisonPreviewMode}
                                                setComparisonPreviewMode={setComparisonPreviewMode}
                                                comparisonZoom={comparisonZoom}
                                                setComparisonZoom={setComparisonZoom}
                                                transformComponentRef={transformComponentRef}
                                                sliderRef={sliderRef}
                                                handlePointerMove={handlePointerMove}
                                                handlePointerUp={handlePointerUp}
                                                handleKeyDown={handleKeyDown}
                                                artboards={artboards}
                                                activeArtboardId={activeArtboardId}
                                                isDraggingDivider={isDraggingDivider}
                                                originalPreviewDims={originalPreviewDims}
                                                optimizedPreviewDims={optimizedPreviewDims}
                                                optimizedImageUrl={optimizedImageUrl}
                                                originalImageUrl={originalImageUrl}
                                                comparisonDivider={comparisonDivider}
                                                handlePointerDown={handlePointerDown}
                                                setComparisonDivider={setComparisonDivider}
                                                showDiagnostics={showDiagnostics}
                                                setShowDiagnostics={setShowDiagnostics}
                                                originalSize={originalSize}
                                                optimizedSize={optimizedSize}
                                                exportSettings={exportSettings}
                                                setExportSettings={setExportSettings}
                                                exportTarget={exportTarget}
                                                psnr={psnr}
                                                isGeneratingPreview={isGeneratingPreview}
                                                currentPreviewOp={currentPreviewOp}
                                                showMobileCompareSwitcher={showMobileCompareSwitcher}
                                                setShowMobileCompareSwitcher={setShowMobileCompareSwitcher}
                                                showMobileDiagnosticsSheet={showMobileDiagnosticsSheet}
                                                setShowMobileDiagnosticsSheet={setShowMobileDiagnosticsSheet}
                                                mobileDetailsExpanded={mobileDetailsExpanded}
                                                setMobileDetailsExpanded={setMobileDetailsExpanded}
                                             />

                                             {/* Floating Canvas Navigation & Zoom Controller */}
                                             <div className={`absolute ${isMobile ? 'top-3 left-1/2 -translate-x-1/2 scale-[0.85] origin-top' : 'bottom-4 left-6'} bg-[#1A1A1A]/90 hover:bg-[#1A1A1A] text-slate-300 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2D2D2D] shadow-xl items-center gap-3 text-xs select-none z-20 ${comparisonMode ? 'hidden' : 'flex'}`}>
                                                <button
                                                   className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400"
                                                   onClick={() => {
                                                      if (!fabricRef.current) return;
                                                      let z = fabricRef.current.getZoom();
                                                      z = Math.max(0.1, z - 0.15);
                                                      fabricRef.current.setZoom(z);
                                                      setZoomPercent(Math.round(z * 100));
                                                      fabricRef.current.requestRenderAll();
                                                   }}
                                                   title="Zoom Out"
                                                >
                                                   <Minus size={13} />
                                                </button>

                                                <span className="font-mono text-[11px] font-bold min-w-[36px] text-center text-slate-200">
                                                   {zoomPercent}%
                                                </span>

                                                <button
                                                   className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400"
                                                   onClick={() => {
                                                      if (!fabricRef.current) return;
                                                      let z = fabricRef.current.getZoom();
                                                      z = Math.min(10, z + 0.15);
                                                      fabricRef.current.setZoom(z);
                                                      setZoomPercent(Math.round(z * 100));
                                                      fabricRef.current.requestRenderAll();
                                                   }}
                                                   title="Zoom In"
                                                >
                                                   <Plus size={13} />
                                                </button>

                                                <div className="w-px h-4 bg-[#2D2D2D]" />

                                                <button
                                                   className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400"
                                                   onClick={() => {
                                                      if (!fabricRef.current) return;
                                                      const activeB = artboardsRef.current.find(b => b.id === activeArtboardIdRef.current) || artboardsRef.current[0];
                                                      if (!activeB) return;
                                                      const vpt = fabricRef.current.viewportTransform!;
                                                      const newVpt = vpt.slice() as any;
                                                      newVpt[0] = 1.0;
                                                      newVpt[3] = 1.0;
                                                      const cw = fabricRef.current.width!;
                                                      const ch = fabricRef.current.height!;
                                                      newVpt[4] = cw / 2 - (activeB.x + activeB.width / 2);
                                                      newVpt[5] = ch / 2 - (activeB.y + activeB.height / 2);
                                                      fabricRef.current.setViewportTransform(newVpt);
                                                      setZoomPercent(100);
                                                   }}
                                                   title="Recenter Camera on Active Artboard"
                                                >
                                                   <Target size={14} />
                                                </button>

                                                <button
                                                   className="p-1 hover:bg-[#2C2C2C] hover:text-white rounded transition-colors text-slate-400"
                                                   onClick={() => {
                                                      if (!fabricRef.current || artboardsRef.current.length === 0) return;
                                                      let minX = Infinity, minY = Infinity;
                                                      let maxX = -Infinity, maxY = -Infinity;
                                                      artboardsRef.current.forEach(b => {
                                                         minX = Math.min(minX, b.x);
                                                         minY = Math.min(minY, b.y);
                                                         maxX = Math.max(maxX, b.x + b.width);
                                                         maxY = Math.max(maxY, b.y + b.height);
                                                      });
                                                      minX -= 60; minY -= 60;
                                                      maxX += 60; maxY += 60;

                                                      const w = maxX - minX;
                                                      const h = maxY - minY;
                                                      const cw = fabricRef.current.width!;
                                                      const ch = fabricRef.current.height!;

                                                      const zoom = Math.max(0.1, Math.min(4, Math.min(cw / w, ch / h)));
                                                      const vpt = fabricRef.current.viewportTransform!;
                                                      const newVpt = vpt.slice() as any;
                                                      newVpt[0] = zoom;
                                                      newVpt[3] = zoom;
                                                      newVpt[4] = cw / 2 - zoom * (minX + w / 2);
                                                      newVpt[5] = ch / 2 - zoom * (minY + h / 2);

                                                      fabricRef.current.setViewportTransform(newVpt);
                                                      setZoomPercent(Math.round(zoom * 100));
                                                   }}
                                                   title="Fit All Artboards in Viewport"
                                                >
                                                   <Expand size={14} />
                                                </button>
                                             </div>
                                          </div>
                                       </div>

                                       {/* Resize Handle (Desktop Only) */}
                                       {(!isMobile) && (
                                          <div
                                             onPointerDown={(e) => {
                                                setIsResizingPanel(true);
                                                e.preventDefault();
                                             }}
                                             className="relative z-20 w-1.5 -ml-[1px] -mr-[5px] h-full cursor-col-resize flex items-stretch justify-center group"
                                          >
                                             <div className={`h-full w-[2px] transition-colors duration-150 ${isResizingPanel ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-x-150' : 'bg-[#2C2C2C] group-hover:bg-blue-500'}`} />
                                          </div>
                                       )}

                                       {/* Mobile Filter / Bottom Bar */}
                                       {isMobile && !showMobilePanel && (
                                          <div className="flex h-14 bg-[#1A1A1A] border-t border-[#2C2C2C] z-30 shrink-0 w-full px-2 items-center justify-between overflow-x-auto no-scrollbar relative shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
                                             <ToolBtn icon={MousePointer2} tool="select" current={activeTool} set={setTool} title="Move" />
                                             <ToolBtn icon={Hand} tool="pan" current={activeTool} set={setTool} title="Pan" />
                                             <ToolBtn icon={Brush} tool="brush" current={activeTool} set={setTool} title="Brush" />
                                             <ToolBtn icon={Type} tool="text" current={activeTool} set={addText} title="Text" />
                                             <ToolBtn icon={Crop} tool="crop" current={activeTool} set={() => enterCropMode()} title="Crop" />

                                             <div className="flex-1" />

                                             <div className="relative shrink-0 flex items-center justify-center w-10">
                                                <ColorPickerTrigger
                                                   color={brushColor || "#ffffff"}
                                                   onChange={changeCurrentColor}
                                                   className="w-7 h-7 rounded-full border border-white/20 shadow-inner relative overflow-hidden"
                                                />
                                             </div>

                                             <div className="w-px h-8 bg-[#3A3A3A] mx-2 shrink-0" />

                                             <button
                                                onClick={() => setShowMobilePanel(true)}
                                                className="h-10 w-10 shrink-0 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl flex items-center justify-center transition-colors shadow-sm ml-auto"
                                             >
                                                <Layers size={18} />
                                             </button>
                                          </div>
                                       )}



                                       {/* Right Sidebar / Bottom Panel - Logic Panels */}
                                       {(!isMobile || showMobilePanel) && (
                                          <div
                                             style={isMobile ? {
                                                width: '100%',
                                                height: `${mobilePanelHeight}vh`,
                                             } : { width: `${panelWidth}px` }}
                                             className={`border-t md:border-t-0 md:border-l ${isResizingPanel ? 'border-blue-500/50' : 'border-[#2C2C2C]'} bg-[#1E1E1E] flex flex-col shrink-0 overflow-hidden md:shadow-[-4px_0_12px_rgba(0,0,0,0.2)] transition-colors duration-150 relative`}
                                          >
                                             {/* Mobile Resize Pill Handle */}
                                             {isMobile && (
                                                <div 
                                                   className="w-full h-4 bg-[#1A1A1A] flex items-center justify-center shrink-0 cursor-row-resize z-10 active:bg-[#1A1A1A]/80 transition-colors"
                                                   onPointerDown={(e) => {
                                                      setIsResizingPanel(true);
                                                      e.preventDefault();
                                                   }}
                                                >
                                                   <div className={`w-12 h-1 rounded-full transition-colors ${isResizingPanel ? 'bg-blue-500' : 'bg-[#444] hover:bg-[#666]'}`} />
                                                </div>
                                             )}

                                             <div
                                                className="flex w-full bg-[#1A1A1A] border-b border-[#2C2C2C] select-none shrink-0 relative"
                                                onTouchStart={(e) => {
                                                   if (!isMobile) return;
                                                   const startY = e.touches[0].clientY;
                                                   const handleEnd = (eEnd: TouchEvent) => {
                                                      if (eEnd.changedTouches[0].clientY - startY > 50) setShowMobilePanel(false);
                                                      document.removeEventListener('touchend', handleEnd);
                                                   };
                                                   document.addEventListener('touchend', handleEnd);
                                                }}
                                             >
                                                <div className={`flex-1 overflow-x-auto flex no-scrollbar ${isMobile ? 'pr-10' : ''}`}>
                                                   <TabBtn tab="properties" active={activeTab} set={setActiveTab} label="Props" icon={Settings} />
                                                   <TabBtn tab="artboards" active={activeTab} set={setActiveTab} label="Boards" icon={SquareDashed} />
                                                   <TabBtn tab="quick" active={activeTab} set={setActiveTab} label="Quick" icon={Activity} />
                                                   <TabBtn tab="ai" active={activeTab} set={setActiveTab} label="AI Tools" icon={Zap} />
                                                   <TabBtn tab="filters" active={activeTab} set={setActiveTab} label="Filters" icon={Sparkles} />
                                                   <TabBtn tab="layers" active={activeTab} set={setActiveTab} label="Layers" icon={Layers} />
                                                   <TabBtn tab="history" active={activeTab} set={setActiveTab} label="History" icon={History} />
                                                   <TabBtn tab="export" active={activeTab} set={setActiveTab} label="Export" icon={Download} />
                                                </div>
                                                {isMobile && (
                                                   <button
                                                      onClick={() => setShowMobilePanel(false)}
                                                      className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-[#1A1A1A] border-l border-[#2C2C2C] text-[#8C8C8C] hover:text-white shadow-[-4px_0_8px_rgba(0,0,0,0.2)] z-10 bg-gradient-to-l from-[#1A1A1A] via-[#1A1A1A] to-transparent"
                                                   >
                                                      <ChevronDown size={18} />
                                                   </button>
                                                )}
                                             </div>

                                             <div className="flex-1 overflow-y-auto overflow-x-hidden">

                                                {/* PROPERTIES PANEL */}
                                                {activeTab === 'properties' && (
                                                   <PropertiesTab />
                                                )}
                                                {/* ARTBOARDS PANEL */}
                                                {activeTab === 'artboards' && (
                                                   <ArtboardsTab />

                                                )}
                                                {/* QUICK ACTIONS PANEL */}
                                                {activeTab === 'quick' && (
                                                   <QuickActionsTab
                                                      selectionType={selectionType}
                                                      addFilterToPipeline={addFilterToPipeline}
                                                      applyFilter={applyFilter}
                                                      resetCrop={resetCrop}
                                                      alignSelection={alignSelection}
                                                      applyFrame={applyFrame}
                                                      frameBorderWidth={frameBorderWidth}
                                                      updateFrameBorderWidth={updateFrameBorderWidth}
                                                      createArtboardFromPreset={createArtboardFromPreset}
                                                   />
                                                )}

                                                {/* AI PANEL */}
                                                {(activeTab as string) === 'ai' && (
                                                   <AIToolsPanel
                                                      selectionType={selectionType}
                                                      executeCommand={executeCommand}
                                                   />
                                                )}

                                                {/* FILTERS PANEL */}
                                                {activeTab === 'filters' && <FilterStudioTab />}

                                                {/* LAYERS PANEL */}
                                                {activeTab === 'layers' && <LayersTab />}

                                                {/* HISTORY PANEL */}
                                                {activeTab === 'history' && (
                                                   <div className="p-2">
                                                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] mb-3 ml-2 mt-2">Action History</div>
                                                      <div className="space-y-1">
                                                         {historyNames.map((name, idx) => {
                                                            const isCurrent = idx === commandIndex;
                                                            const isFuture = idx > commandIndex;
                                                            return (
                                                               <div key={idx} onClick={() => jumpToHistory(idx)} className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-xs transition-colors ${isCurrent ? 'bg-blue-600/20 text-blue-300 font-medium' : isFuture ? 'text-[#6A6A6A] hover:bg-[#2C2C2C]' : 'text-[#C0C0C0] hover:bg-[#2C2C2C]'}`}>
                                                                  <div className={`w-2 h-2 rounded-full mr-3 ${isCurrent ? 'bg-blue-500' : isFuture ? 'bg-[#3A3A3A]' : 'bg-[#6A6A6A]'}`} />
                                                                  {name}
                                                               </div>
                                                            );
                                                         })}
                                                         {historyNames.length === 0 && (
                                                            <div className="p-4 text-xs text-[#8A8A8A] text-center italic mt-10">No history track found.</div>
                                                         )}
                                                      </div>
                                                   </div>
                                                )}

                                                {/* EXPORT WORKSPACE (jSquash with Artboards) */}
                                                {activeTab === 'export' && (
                                                   <ExportStudio
                                                      settings={exportSettings}
                                                      onChange={setExportSettings}
                                                      onExport={handleExport}
                                                      isExporting={isExporting}
                                                      originalSize={originalSize}
                                                      optimizedSize={optimizedSize}
                                                      originalWidth={artboards.find(b => b.id === activeArtboardId)?.width || 800}
                                                      originalHeight={artboards.find(b => b.id === activeArtboardId)?.height || 600}
                                                      psnr={psnr}
                                                      artboards={artboards}
                                                      activeArtboardId={activeArtboardId}
                                                      setActiveArtboardId={setActiveArtboardId}
                                                      exportTarget={exportTarget}
                                                      setExportTarget={setExportTarget}
                                                      selectedExportIds={selectedExportIds}
                                                      setSelectedExportIds={setSelectedExportIds}
                                                   />
                                                )}
                                             </div>
                                          </div>
                                       )}

                                       {/* Context Menu Portal */}
                                       {activeContextMenu && createPortal(
                                          <div
                                             ref={contextMenuRef}
                                             className="fixed z-[9999] w-52 bg-[#1A1A1A] border border-[#2D2D2D] shadow-[0_12px_48px_rgba(0,0,0,0.7)] rounded-xl overflow-y-auto custom-scrollbar max-h-[85vh] py-1 context-menu-container"
                                             style={{ left: activeContextMenu.x, top: activeContextMenu.y, visibility: 'hidden' }}
                                             onClick={(e) => e.stopPropagation()}
                                          >
                                             {activeContextMenu.obj ? (
                                                <>
                                                   {(activeContextMenu.obj as any)?.isCollageBlock && (
                                                      <>
                                                         <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-blue-500 border-b border-[#252525] mb-1">Smart Collage</div>
                                                         <ContextMenuItem icon={LucideImage} label={(activeContextMenu.obj as any).collageImageSrc ? "Replace Image..." : "Add Image..."} onClick={() => {
                                                            const input = document.createElement('input');
                                                            input.type = 'file';
                                                            input.accept = 'image/*';
                                                            input.onchange = (e: any) => {
                                                               const file = e.target.files?.[0];
                                                               if (file) {
                                                                  fabricRef.current?.setActiveObject(activeContextMenu.obj!);
                                                                  fillCollageBlockWithImage(file);
                                                               }
                                                            };
                                                            input.click();
                                                            closeContextMenu();
                                                         }} />
                                                         {(activeContextMenu.obj as any).collageImageSrc && (
                                                            <ContextMenuItem icon={Trash2} label="Remove Image" onClick={() => {
                                                               const rect = activeContextMenu.obj as fabric.Rect;
                                                               const beforeState = { collageImageSrc: (rect as any).collageImageSrc };
                                                               const afterState = { collageImageSrc: null };
                                                               (rect as any).collageImageSrc = null;
                                                               fabricRef.current?.requestRenderAll();
                                                               executeCommand(new StyleChangeCommand("Remove Image", rect, beforeState, afterState));
                                                               closeContextMenu();
                                                            }} />
                                                         )}
                                                         <ContextMenuItem icon={Copy} label="Duplicate Block" onClick={() => { duplicateActiveObject(); closeContextMenu(); }} />
                                                         <ContextMenuItem icon={Trash2} label="Delete Block" danger onClick={() => { deleteActiveObject(); closeContextMenu(); }} />
                                                         <div className="h-px bg-[#252525] my-1" />
                                                      </>
                                                   )}
                                                   {(activeContextMenu.targets?.filter(t => (t as any).isCollageBlock).length > 0 && activeContextMenu.targets?.filter(t => t.type === 'image' && !(t as any).isCollageBlock).length > 0) && (
                                                      <>
                                                         <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-green-500 border-b border-[#252525] mb-1">Bulk Assignment</div>
                                                         {activeContextMenu.targets.filter(t => (t as any).isCollageBlock).length === 1 && activeContextMenu.targets.filter(t => t.type === 'image' && !(t as any).isCollageBlock).length === 1 ? (
                                                            <ContextMenuItem icon={LucideImage} label="Fit Image into Block" onClick={() => {
                                                               const block = activeContextMenu.targets.find(t => (t as any).isCollageBlock) as fabric.Rect;
                                                               const img = activeContextMenu.targets.find(t => t.type === 'image' && !(t as any).isCollageBlock) as fabric.Image;

                                                               const beforeState = { collageImageSrc: (block as any).collageImageSrc };
                                                               const afterState = { collageImageSrc: img.getSrc() };
                                                               (block as any).collageImageSrc = img.getSrc();
                                                               fabricRef.current?.requestRenderAll();
                                                               executeCommand(new StyleChangeCommand("Fit Image into Block", block, beforeState, afterState));
                                                               closeContextMenu();
                                                            }} />
                                                         ) : (
                                                            <>
                                                               <ContextMenuItem icon={LucideImage} label="Fill Blocks Sequentially" onClick={() => {
                                                                  const blocks = activeContextMenu.targets.filter(t => (t as any).isCollageBlock);
                                                                  const imgs = activeContextMenu.targets.filter(t => t.type === 'image' && !(t as any).isCollageBlock) as fabric.Image[];
                                                                  const commands: Command[] = [];
                                                                  blocks.forEach((block, i) => {
                                                                     const img = imgs[i % imgs.length];
                                                                     const beforeState = { collageImageSrc: (block as any).collageImageSrc };
                                                                     const afterState = { collageImageSrc: img.getSrc() };
                                                                     (block as any).collageImageSrc = img.getSrc();
                                                                     commands.push(new StyleChangeCommand("Fill Block", block as fabric.Object, beforeState, afterState));
                                                                  });
                                                                  fabricRef.current?.requestRenderAll();
                                                                  executeCommand(new MacroCommand("Fill Blocks Sequentially", commands));
                                                                  closeContextMenu();
                                                               }} />
                                                               <ContextMenuItem icon={LucideImage} label="Fill Blocks Randomly" onClick={() => {
                                                                  const blocks = activeContextMenu.targets.filter(t => (t as any).isCollageBlock);
                                                                  const imgs = activeContextMenu.targets.filter(t => t.type === 'image' && !(t as any).isCollageBlock) as fabric.Image[];
                                                                  const commands: Command[] = [];
                                                                  blocks.forEach((block) => {
                                                                     const img = imgs[Math.floor(Math.random() * imgs.length)];
                                                                     const beforeState = { collageImageSrc: (block as any).collageImageSrc };
                                                                     const afterState = { collageImageSrc: img.getSrc() };
                                                                     (block as any).collageImageSrc = img.getSrc();
                                                                     commands.push(new StyleChangeCommand("Fill Block", block as fabric.Object, beforeState, afterState));
                                                                  });
                                                                  fabricRef.current?.requestRenderAll();
                                                                  executeCommand(new MacroCommand("Fill Blocks Randomly", commands));
                                                                  closeContextMenu();
                                                               }} />
                                                            </>
                                                         )}
                                                         <div className="h-px bg-[#252525] my-1" />
                                                      </>
                                                   )}
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Align To Artboard</div>
                                                   {(activeContextMenu.obj?.type === 'image' || (activeContextMenu.obj as any)?.isFrameGroup) && (
                                                      <>
                                                         <ContextMenuItem icon={Crop} label="Crop Image" onClick={() => { enterCropMode(activeContextMenu.obj as fabric.Image); closeContextMenu(); }} />
                                                         <div className="h-px bg-[#252525] my-1" />
                                                      </>
                                                   )}
                                                   <ContextMenuItem icon={AlignLeft} label="Align Left" onClick={() => { alignSelection('left'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={AlignCenter} label="Align Center H" onClick={() => { alignSelection('centerH'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={AlignRight} label="Align Right" onClick={() => { alignSelection('right'); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <ContextMenuItem icon={Move} label="Fit To Artboard" onClick={() => { alignSelection('fit'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={SquareDashed} label="Fill Artboard" onClick={() => { alignSelection('fill'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Expand} label="Stretch to Artboard" onClick={() => { alignSelection('stretch'); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <ContextMenuItem icon={ImageIcon} label="Fit Width" onClick={() => { alignSelection('fitWidth'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={ImageIcon} label="Fit Height" onClick={() => { alignSelection('fitHeight'); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <ContextMenuItem icon={Crop} label="Resize Artboard to Selection" onClick={() => { resizeArtboardToSelection('both'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Crop} label="Resize Artboard Width to Selection" onClick={() => { resizeArtboardToSelection('width'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Crop} label="Resize Artboard Height to Selection" onClick={() => { resizeArtboardToSelection('height'); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Crop} label="Resize Artboard to Selection Bounds" onClick={() => { resizeArtboardToSelection('bounds'); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <ContextMenuItem icon={Copy} label="Copy to Clipboard (PNG)" onClick={() => { copyActiveObjectAsFormat('png'); closeContextMenu(); }} />
                                                   {activeContextMenu.obj?.type !== 'image' && (
                                                      <ContextMenuItem icon={Copy} label="Copy to Clipboard (SVG)" onClick={() => { copyActiveObjectAsFormat('svg'); closeContextMenu(); }} />
                                                   )}
                                                   <ContextMenuItem icon={Copy} label="Copy Object" shortcut="Ctrl+C" onClick={() => { 
                                                      const active = fabricRef.current?.getActiveObject();
                                                      if (active) {
                                                         active.clone(['id', 'artboardId']).then((cloned) => {
                                                            (window as any)._fabricInternalClipboard = cloned;
                                                            setNotification({ message: 'Object copied', type: 'success' });
                                                         });
                                                      }
                                                      closeContextMenu(); 
                                                   }} />
                                                   <ContextMenuItem icon={Clipboard} label="Paste Object" shortcut="Ctrl+V" onClick={() => { 
                                                      const cloned = (window as any)._fabricInternalClipboard;
                                                      if (cloned) {
                                                         cloned.clone().then((clonedObj: any) => {
                                                            fabricRef.current?.discardActiveObject();
                                                            let newLeft = (clonedObj.left || 0) + 20;
                                                            let newTop = (clonedObj.top || 0) + 20;
                                                            const canvas = fabricRef.current;
                                                            if (canvas && canvas.vptCoords) {
                                                                const { tl, br } = canvas.vptCoords;
                                                                if (newLeft < tl.x || newLeft > br.x || newTop < tl.y || newTop > br.y) {
                                                                    const center = canvas.getVpCenter();
                                                                    newLeft = clonedObj.originX === 'center' ? center.x : center.x - ((clonedObj.width || 0) * (clonedObj.scaleX || 1)) / 2;
                                                                    newTop = clonedObj.originY === 'center' ? center.y : center.y - ((clonedObj.height || 0) * (clonedObj.scaleY || 1)) / 2;
                                                                }
                                                            }
                                                            clonedObj.set({
                                                               left: newLeft,
                                                               top: newTop,
                                                               id: Date.now().toString() + Math.random().toString(),
                                                               evented: true,
                                                            });
                                                            if (clonedObj.type === 'activeSelection') {
                                                               clonedObj.canvas = fabricRef.current;
                                                               clonedObj.forEachObject((obj: any) => {
                                                                  obj.id = Date.now().toString() + Math.random().toString();
                                                                  fabricRef.current?.add(obj);
                                                               });
                                                               clonedObj.setCoords();
                                                            } else {
                                                               fabricRef.current?.add(clonedObj);
                                                            }
                                                            fabricRef.current?.setActiveObject(clonedObj);
                                                            fabricRef.current?.requestRenderAll();
                                                            updateLayersList();
                                                         });
                                                      }
                                                      closeContextMenu(); 
                                                   }} />
                                                   <ContextMenuItem icon={Copy} label="Duplicate" shortcut="Ctrl+D" onClick={() => { duplicateActiveObject(); closeContextMenu(); }} />
                                                   {activeContextMenu.obj?.type === 'group' && (
                                                      <ContextMenuItem icon={Images} label="Ungroup Frame" onClick={() => {
                                                         const group = activeContextMenu.obj as any;
                                                         if (group && typeof group.toActiveSelection === 'function') {
                                                            const sel = group.toActiveSelection();
                                                            fabricRef.current?.setActiveObject(sel);
                                                         } else {
                                                            const items = (group as any).removeAll();
                                                            fabricRef.current?.remove(group as fabric.Group);
                                                            items.forEach(i => fabricRef.current?.add(i));
                                                            const sel = new fabric.ActiveSelection(items, { canvas: fabricRef.current });
                                                            fabricRef.current?.setActiveObject(sel);
                                                         }
                                                         fabricRef.current?.requestRenderAll();
                                                         updateLayersList();
                                                         closeContextMenu();
                                                      }} />
                                                   )}
                                                   <ContextMenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={() => { deleteActiveObject(); closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />

                                                   {(() => {
                                                      let maxIdx = -1;
                                                      let minIdx = Number.MAX_SAFE_INTEGER;
                                                      const totalObjs = fabricRef.current?.getObjects().length || 0;
                                                      activeContextMenu.targets.forEach(t => {
                                                         const idx = fabricRef.current?.getObjects().indexOf(t) ?? -1;
                                                         if (idx > maxIdx) maxIdx = idx;
                                                         if (idx !== -1 && idx < minIdx) minIdx = idx;
                                                      });
                                                      const canBringForward = maxIdx !== -1 && maxIdx < totalObjs - 1;
                                                      const canSendBackward = minIdx !== -1 && minIdx > 0;

                                                      return (
                                                         <>
                                                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Layer Order</div>
                                                            <ContextMenuItem icon={BringToFront} label="Bring to Front" shortcut="Ctrl+Shift+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('front'); closeContextMenu(); }} />
                                                            <ContextMenuItem icon={ArrowUp} label="Bring Forward" shortcut="Ctrl+]" disabled={!canBringForward} onClick={() => { handleLayerOrder('forward'); closeContextMenu(); }} />
                                                            <ContextMenuItem icon={ArrowDown} label="Send Backward" shortcut="Ctrl+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('backward'); closeContextMenu(); }} />
                                                            <ContextMenuItem icon={SendToBack} label="Send to Back" shortcut="Ctrl+Shift+[" disabled={!canSendBackward} onClick={() => { handleLayerOrder('back'); closeContextMenu(); }} />
                                                            <div className="h-px bg-[#252525] my-1" />
                                                         </>
                                                      );
                                                   })()}

                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Move To Artboard</div>
                                                   {artboards.map(b => (
                                                      <ContextMenuItem
                                                         key={b.id}
                                                         icon={SquareDashed}
                                                         label={b.name}
                                                         onClick={() => {
                                                            if (!fabricRef.current) return;
                                                            const activeSelection = fabricRef.current.getActiveObject();
                                                            if (!activeSelection) return;

                                                            let objectsToProcess: any[] = [];
                                                            if (activeSelection.type === 'activeSelection') {
                                                               objectsToProcess = (activeSelection as any).getObjects();
                                                               fabricRef.current.discardActiveObject();
                                                            } else {
                                                               objectsToProcess = [activeSelection];
                                                            }

                                                            objectsToProcess.forEach(obj => {
                                                               const prevArtboardId = obj.artboardId;
                                                               if (prevArtboardId !== b.id) {
                                                                  const prevBoard = artboards.find(x => x.id === prevArtboardId) || artboards[0];
                                                                  const dx = b.x - prevBoard.x;
                                                                  const dy = b.y - prevBoard.y;

                                                                  obj.artboardId = b.id;
                                                                  if (typeof obj.set === 'function') {
                                                                     obj.set({
                                                                        left: (obj.left ?? 0) + dx,
                                                                        top: (obj.top ?? 0) + dy
                                                                     });
                                                                     if (typeof obj.setCoords === 'function') obj.setCoords();
                                                                  }
                                                               }
                                                            });

                                                            if (objectsToProcess.length > 1) {
                                                               const sel = new fabric.ActiveSelection(objectsToProcess, { canvas: fabricRef.current });
                                                               fabricRef.current.setActiveObject(sel);
                                                            } else if (objectsToProcess.length === 1) {
                                                               fabricRef.current.setActiveObject(objectsToProcess[0]);
                                                            }

                                                            fabricRef.current.renderAll();
                                                            updateLayersList();
                                                            closeContextMenu();
                                                         }}
                                                      />
                                                   ))}
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Import</div>
                                                   <ContextMenuItem icon={Upload} label="Upload Files..." onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Clipboard} label="Paste from Clipboard" onClick={async () => {
                                                      try {
                                                         const items = await navigator.clipboard.read();
                                                         const results = await processPasteEvent({ clipboardData: { items: items as any } } as any);
                                                         if (results.length > 0) importAssets(results);
                                                      } catch (e) { }
                                                      closeContextMenu();
                                                   }} />
                                                   <ContextMenuItem icon={Library} label="Import Local Assets..." onClick={() => { setShowAssetGallery(true); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Link} label="Import from URL..." onClick={() => {
                                                      setShowUrlPrompt(true);
                                                      closeContextMenu();
                                                   }} />
                                                </>
                                             ) : (
                                                <>
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Canvas Actions</div>
                                                   <ContextMenuItem icon={Plus} label="New Artboard" onClick={() => { createArtboard(); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Type} label="Add Text" onClick={() => { addText(); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Grid} label="Toggle Grid" onClick={() => { closeContextMenu(); }} />
                                                   <div className="h-px bg-[#252525] my-1" />
                                                   <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-[#252525] mb-1">Import</div>
                                                   <ContextMenuItem icon={Upload} label="Upload Files..." onClick={() => { document.getElementById('img-upload')?.click(); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Clipboard} label="Paste from Clipboard" onClick={async () => {
                                                      try {
                                                         const items = await navigator.clipboard.read();
                                                         // This uses a hacky adapter to pass to our processPasteEvent which expects a standard PasteEvent
                                                         const dataItems = Array.from(items).flatMap((item: any) =>
                                                            item.types.map((type: string) => ({
                                                               type,
                                                               getType: () => item.getType(type),
                                                            }))
                                                         );
                                                         // We actually already have a processClipboardItems function for exactly this!
                                                         const { processClipboardItems } = await import('../image-import/clipboard/clipboardImporter');
                                                         const results = await processClipboardItems(items as any);
                                                         if (results.length > 0) importAssets(results);
                                                      } catch (e) { }
                                                      closeContextMenu();
                                                   }} />
                                                   <ContextMenuItem icon={Library} label="Import Local Assets..." onClick={() => { setShowAssetGallery(true); closeContextMenu(); }} />
                                                   <ContextMenuItem icon={Link} label="Import from URL..." onClick={() => {
                                                      setShowUrlPrompt(true);
                                                      closeContextMenu();
                                                   }} />
                                                </>
                                             )}
                                          </div>,
                                          document.body
                                       )}

                                       {/* Mobile Artboard Gallery Modal */}
                                       {isMobile && showMobileArtboardsGallery && (
                                          <div className="fixed inset-0 z-[100] bg-[#121212] overflow-y-auto w-full h-full animate-in fade-in zoom-in-95 duration-200">
                                             <div className="sticky top-0 bg-[#1A1A1A] border-b border-[#2C2C2C] p-4 flex justify-between items-center z-10 shadow-md">
                                                <h2 className="text-white font-bold tracking-tight text-lg flex items-center gap-2">
                                                   <SquareDashed size={18} className="text-blue-500" />
                                                   Select Artboard
                                                </h2>
                                                <button
                                                   onClick={() => setShowMobileArtboardsGallery(false)}
                                                   className="w-8 h-8 flex items-center justify-center rounded-full bg-[#333] text-white hover:bg-[#444]"
                                                >
                                                   <X size={18} />
                                                </button>
                                             </div>

                                             <div className="p-4 grid grid-cols-2 gap-4 pb-20">
                                                {artboards.map(b => {
                                                   const isActive = b.id === activeArtboardId;
                                                   return (
                                                      <div
                                                         key={b.id}
                                                         onClick={() => {
                                                            setActiveArtboardId(b.id);
                                                            setShowMobileArtboardsGallery(false);
                                                         }}
                                                         className={`flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-blue-600/10 border-blue-500' : 'bg-[#1E1E1E] border-[#333] hover:border-gray-500'}`}
                                                      >
                                                         <div className="w-full aspect-square bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                                                            <div
                                                               className="w-16 h-16 rounded-sm shadow-sm opacity-80"
                                                               style={{
                                                                  backgroundColor: b.backgroundColor || '#fff',
                                                                  aspectRatio: `${b.width}/${b.height}`,
                                                                  width: b.orientation === 'landscape' ? '60%' : undefined,
                                                                  height: b.orientation === 'portrait' ? '60%' : undefined,
                                                                  ...(b.transparent ? { backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVORK5CYII=")' } : {})
                                                               }}
                                                            />
                                                            {isActive && (
                                                               <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
                                                            )}
                                                         </div>
                                                         <div className="flex flex-col">
                                                            <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-400' : 'text-white'}`}>{b.name}</span>
                                                            <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{b.width} × {b.height}</span>
                                                         </div>
                                                      </div>
                                                   )
                                                })}

                                                <div
                                                   onClick={() => {
                                                      createArtboard();
                                                      setShowMobileArtboardsGallery(false);
                                                   }}
                                                   className="flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all bg-[#1E1E1E] border border-dashed border-[#444] hover:border-gray-400 items-center justify-center group"
                                                >
                                                   <div className="w-10 h-10 rounded-full bg-blue-600 group-hover:bg-blue-500 flex items-center justify-center text-white shadow-lg transition-colors">
                                                      <Plus size={20} />
                                                   </div>
                                                   <span className="text-xs font-bold text-gray-400 group-hover:text-white mt-1">New Artboard</span>
                                                </div>
                                             </div>
                                          </div>
                                       )}

                                       {/* Rename Artboard Modal Dialog */}
                                       {renamingArtboard && createPortal(
                                          <div
                                             className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                                             onClick={() => setRenamingArtboard(null)}
                                          >
                                             <div
                                                className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
                                                onClick={(e) => e.stopPropagation()}
                                             >
                                                <div className="px-5 py-4 border-b border-[#2C2C2C] flex items-center justify-between">
                                                   <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                                                      <Edit2 size={14} className="text-blue-500" />
                                                      Rename Artboard
                                                   </h3>
                                                   <button
                                                      onClick={() => setRenamingArtboard(null)}
                                                      className="text-gray-500 hover:text-white transition-colors"
                                                   >
                                                      <X size={16} />
                                                   </button>
                                                </div>
                                                <div className="p-5 space-y-4">
                                                   <div className="space-y-1.5">
                                                      <label className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Artboard Name</label>
                                                      <input
                                                         type="text"
                                                         autoFocus
                                                         className="w-full h-9 bg-black border border-[#2C2C2C] rounded-lg px-3 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
                                                         value={renamingArtboard.name}
                                                         onChange={(e) => setRenamingArtboard({ ...renamingArtboard, name: e.target.value })}
                                                         onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                               const trimmed = renamingArtboard.name.trim();
                                                               if (trimmed) {
                                                                  updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                                                               }
                                                               setRenamingArtboard(null);
                                                            } else if (e.key === "Escape") {
                                                               setRenamingArtboard(null);
                                                            }
                                                         }}
                                                      />
                                                   </div>
                                                   <div className="flex justify-end gap-2 pt-1">
                                                      <button
                                                         onClick={() => setRenamingArtboard(null)}
                                                         className="h-8 px-4 text-xs font-semibold border border-[#2D2D2D] text-[#808080] hover:text-white rounded-lg transition-colors"
                                                      >
                                                         Cancel
                                                      </button>
                                                      <button
                                                         onClick={() => {
                                                            const trimmed = renamingArtboard.name.trim();
                                                            if (trimmed) {
                                                               updateArtboardPropDirect(renamingArtboard.id, "name", trimmed, true);
                                                            }
                                                            setRenamingArtboard(null);
                                                         }}
                                                         className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                                      >
                                                         Save
                                                      </button>
                                                   </div>
                                                </div>
                                             </div>
                                          </div>,
                                          document.body
                                       )}

                                       {showShortcuts && createPortal(
                                          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
                                             <div className="bg-[#181818] border border-[#2c2c2c] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c] bg-[#1a1a1a]">
                                                   <div className="font-semibold text-sm text-white flex items-center gap-2">
                                                      <Keyboard size={16} className="text-blue-400" /> Image Node Shortcuts
                                                   </div>
                                                   <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white transition">
                                                      <X size={16} />
                                                   </button>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                   <div className="flex items-center justify-between">
                                                      <span className="text-xs text-slate-300">Bring Forward</span>
                                                      <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
                                                   </div>
                                                   <div className="flex items-center justify-between">
                                                      <span className="text-xs text-slate-300">Send Backward</span>
                                                      <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
                                                   </div>
                                                   <div className="flex items-center justify-between">
                                                      <span className="text-xs text-slate-300">Bring to Front</span>
                                                      <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">]</span></div>
                                                   </div>
                                                   <div className="flex items-center justify-between">
                                                      <span className="text-xs text-slate-300">Send to Back</span>
                                                      <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">Ctrl+Shift</span><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">[</span></div>
                                                   </div>
                                                   <div className="flex items-center justify-between">
                                                      <span className="text-xs text-slate-300">Context Menu (Mobile)</span>
                                                      <div className="flex gap-1"><span className="px-1.5 py-0.5 bg-[#2c2c2c] rounded text-[10px] font-mono border border-[#3a3a3a] text-slate-300">2-Finger Hold</span></div>
                                                   </div>
                                                </div>
                                             </div>
                                          </div>,
                                          document.body
                                       )}

                                       {showUrlPrompt && (
                                          <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowUrlPrompt(false)}>
                                             <div className="bg-[#111] border border-[#222] rounded-xl w-full max-w-md p-6 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                                                   <Link size={18} className="text-blue-500" />
                                                   Import from URL
                                                </h3>
                                                <div className="space-y-4">
                                                   <div>
                                                      <label className="text-xs text-[#8A8A8A] font-bold uppercase tracking-wider mb-2 block">Image or SVG URL</label>
                                                      <input
                                                         type="text"
                                                         value={urlInput}
                                                         onChange={e => setUrlInput(e.target.value)}
                                                         placeholder="https://example.com/image.png"
                                                         className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                                         autoFocus
                                                         onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && urlInput) {
                                                               importAssets([{ url: urlInput, type: urlInput.includes('.svg') ? 'svg' : 'image', name: 'URL Import' }]);
                                                               setShowUrlPrompt(false);
                                                               setUrlInput("");
                                                            } else if (e.key === 'Escape') {
                                                               setShowUrlPrompt(false);
                                                            }
                                                         }}
                                                      />
                                                   </div>
                                                   <div className="flex justify-end gap-3 pt-2">
                                                      <button
                                                         onClick={() => setShowUrlPrompt(false)}
                                                         className="px-4 py-2 rounded-lg text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-[#222] transition-colors"
                                                      >
                                                         Cancel
                                                      </button>
                                                      <button
                                                         onClick={() => {
                                                            if (urlInput) {
                                                               importAssets([{ url: urlInput, type: urlInput.includes('.svg') ? 'svg' : 'image', name: 'URL Import' }]);
                                                               setShowUrlPrompt(false);
                                                               setUrlInput("");
                                                            }
                                                         }}
                                                         disabled={!urlInput}
                                                         className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                         Import
                                                      </button>
                                                   </div>
                                                </div>
                                             </div>
                                          </div>
                                       )}

                                       {showAssetGallery && (
                                          <AssetGallery
                                             onClose={() => setShowAssetGallery(false)}
                                             onImport={(assets) => {
                                                importAssets(assets);
                                                setShowAssetGallery(false);
                                             }}
                                          />
                                       )}
                                       <AIProgressModal />
                                    </div>
                                 </div>
                              </LayersProvider>
                           </WorkspaceUIProvider>
                        </HistoryProvider>
                     </SelectionProvider>
                  </CanvasProvider>
               </ToolProvider>
            </ShapePropertiesProvider>
         </AIProvider>

      </CollageConfigProvider >
   );

}
