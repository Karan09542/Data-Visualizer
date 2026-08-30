import * as snapdom from "@zumer/snapdom";
import {
  useStore,
  NodeTheme,
  EdgeStyle,
  NodeShape,
} from "../store/useStore";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Minimize,
  Maximize,
  Maximize2,
  RotateCcw,
  Paintbrush,
  PanelLeft,
  Menu,
  X,
  Sun,
  Moon,
  Undo2,
  Redo2,
  Share2,
  FolderOpen,
  ChevronDown,
  Loader2,
  CloudOff,
  Cloud,
  SlidersHorizontal,
  Network,
  Database,
  Save,
  Check,
  FileImage,
  FileType,
  Barcode,
  Wrench,
  Camera,
  ClipboardPaste,
  Sparkles,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import { estimateShareSize } from "../utils/shareUtils";
import { useAnnotationStore } from "../store/useAnnotationStore";
import { db } from "../lib/db";
import NodeHelpModal from "./NodeHelpModal";
import BarcodeGeneratorModal from "./BarcodeGeneratorModal";
import { QuickUtilsModal } from "./utilities/QuickUtilsModal";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { PromptModal } from "./PromptModal";
import UserMenu, { AuthModals } from "./UserMenu";
import { LAYOUT_MODES, CODE_FORMATS, NODE_THEMES, EDGE_STYLES, NODE_SHAPES } from "../constants/visualizer";

export default function Toolbar({ onOpenShare }: { onOpenShare: () => void }) {
  const layoutMode = useStore((state) => state.layoutMode);
  const setLayoutMode = useStore((state) => state.setLayoutMode);
  const nodeTheme = useStore((state) => state.nodeTheme);
  const setNodeTheme = useStore((state) => state.setNodeTheme);
  const edgeStyle = useStore((state) => state.edgeStyle);
  const setEdgeStyle = useStore((state) => state.setEdgeStyle);
  const edgeWidth = useStore((state) => state.edgeWidth ?? 1.0);
  const setEdgeWidth = useStore((state) => state.setEdgeWidth);
  const nodeShape = useStore((state) => state.nodeShape);
  const setNodeShape = useStore((state) => state.setNodeShape);
  const treeData = useStore((state) => state.treeData);
  const setCollapsedNodes = useStore((state) => state.setCollapsedNodes);
  const isEditorPanelOpen = useStore((state) => state.isEditorPanelOpen);
  const setIsEditorPanelOpen = useStore((state) => state.setIsEditorPanelOpen);
  const isMobileMenuOpen = useStore((state) => state.isMobileMenuOpen);
  const setIsMobileMenuOpen = useStore((state) => state.setIsMobileMenuOpen);
  const appTheme = useStore((state) => state.appTheme);
  const setAppTheme = useStore((state) => state.setAppTheme);
  const setCanvasBackgroundColor = useStore((state) => state.setCanvasBackgroundColor);
  const setCanvasPatternColor = useStore((state) => state.setCanvasPatternColor);
  const canvasBackgroundColor = useStore((state) => state.canvasBackgroundColor);
  const canvasPatternColor = useStore((state) => state.canvasPatternColor);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const undoStack = useStore((state) => state.undoStack);
  const redoStack = useStore((state) => state.redoStack);
  const code = useStore((state) => state.code);
  const setIsSavedDocsOpen = useStore((state) => state.setIsSavedDocsOpen);
  const setGlobalTextExpanded = useStore((state) => state.setGlobalTextExpanded);
  const isAutosaveEnabled = useStore((state) => state.isAutosaveEnabled);
  const setIsAutosaveEnabled = useStore((state) => state.setIsAutosaveEnabled);
  const visualizerMode = useStore((state) => state.visualizerMode);
  const setVisualizerMode = useStore((state) => state.setVisualizerMode);
  const codeFormat = useStore((state) => state.codeFormat);
  const convertFormat = useStore((state) => state.convertFormat);
  const activeDocumentId = useStore((state) => state.activeDocumentId);
  const activeDocumentName = useStore((state) => state.activeDocumentName);
  const isDirty = useStore((state) => state.isDirty);
  const setIsDirty = useStore((state) => state.setIsDirty);
  const setLastSavedCode = useStore((state) => state.setLastSavedCode);
  const setNotification = useStore((state) => state.setNotification);

  const annotations = useAnnotationStore((state) => state.annotations);

  const shareSizeInfo = useMemo(() => {
    return estimateShareSize(
      code,
      {
        layoutMode,
        nodeTheme,
        edgeStyle,
        nodeShape,
        appTheme,
        canvasBackgroundColor,
        canvasPatternColor,
      },
      annotations,
    );
  }, [
    code,
    layoutMode,
    nodeTheme,
    edgeStyle,
    nodeShape,
    appTheme,
    canvasBackgroundColor,
    canvasPatternColor,
    annotations,
  ]);

  const shareIndicator = useMemo(() => {
    switch (shareSizeInfo.status) {
      case "safe":
        return { color: "bg-green-500", label: "Small" };
      case "moderate":
        return { color: "bg-yellow-500", label: "Medium" };
      case "large":
        return { color: "bg-orange-500", label: "Large" };
      case "unsafe":
        return { color: "bg-red-500", label: "Too Large" };
    }
  }, [shareSizeInfo.status]);

  const [isApiHelpOpen, setIsApiHelpOpen] = useState(false);
  const [isBarcodeGeneratorOpen, setIsBarcodeGeneratorOpen] = useState(false);
  const [isQuickUtilsOpen, setIsQuickUtilsOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [pendingCameraFile, setPendingCameraFile] = useState<File | null>(null);

  const handleCameraCapture = (file: File) => {
    setIsCameraModalOpen(false);
    setPendingCameraFile(file);
  };

  const processCameraCapture = async (file: File, userInput: string) => {
    const defaultKey = `capture_${Date.now()}`;
    const keyName = userInput ? userInput.trim() : defaultKey;

    try {
      const { importFile } = await import("../utils/assetManager");
      const { assetId } = await importFile(file);

      const currentData = JSON.parse(code || "{}");
      if (typeof currentData === "object" && currentData !== null && !Array.isArray(currentData)) {
        currentData[keyName] = assetId;
        useStore.getState().setCode(JSON.stringify(currentData, null, 2));
      } else {
        const newData = { _previousData: currentData, [keyName]: assetId };
        useStore.getState().setCode(JSON.stringify(newData, null, 2));
      }

      useStore.getState().setSelectedNodeId(`root.${keyName}`);
      setNotification({ message: `Successfully embedded under key '${keyName}'`, type: "success" });
    } catch (err) {
      console.error("Camera capture import failed", err);
      // Fallback to dataUrl if IndexedDB fails
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        try {
          const currentData = JSON.parse(code || "{}");
          if (typeof currentData === "object" && currentData !== null && !Array.isArray(currentData)) {
            currentData[keyName] = dataUrl;
            useStore.getState().setCode(JSON.stringify(currentData, null, 2));
          } else {
            const newData = { _previousData: currentData, [keyName]: dataUrl };
            useStore.getState().setCode(JSON.stringify(newData, null, 2));
          }
          useStore.getState().setSelectedNodeId(`root.${keyName}`);
          setNotification({ message: `Successfully embedded under key '${keyName}'`, type: "success" });
        } catch (parseErr) {
          const currentData = { _raw: code, [keyName]: dataUrl };
          useStore.getState().setCode(JSON.stringify(currentData, null, 2));
          useStore.getState().setSelectedNodeId(`root.${keyName}`);
          setNotification({ message: `Code was invalid JSON. Embedded under key '${keyName}'`, type: "success" });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const exportHDImageRef = useRef<((type?: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const handleVoiceExport = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.format && exportHDImageRef.current) {
        exportHDImageRef.current(detail.format);
      }
    };
    window.addEventListener("voice-export", handleVoiceExport);
    return () => window.removeEventListener("voice-export", handleVoiceExport);
  }, []);

  useEffect(() => {
    // Warm up SnapDOM cache without blocking the main thread
    if (typeof window !== "undefined") {
      const warmUp = () => {
        Promise.resolve(snapdom).then(({ preCache }) => {
          preCache(document, { embedFonts: true }).catch((e) =>
            console.warn("SnapDOM precache failed:", e),
          );
        })
          .catch((err) => console.warn("Failed to load SnapDOM module:", err));
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(warmUp);
      } else {
        setTimeout(warmUp, 2000);
      }
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      // We will dynamically import the handler for file processing
      const { processFiles } = await import("../utils/fileProcessor");
      processFiles(Array.from(files));
    } catch (err) {
      console.error("Failed to process file upload:", err);
    }

    // Clear input so same file can be selected again
    e.target.value = "";
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        useStore.getState().setPendingImport({
          filename: 'clipboard_paste.txt',
          text: text,
          fileContext: 'data',
          fileSize: text.length
        });
      } else {
        useStore.getState().setNotification({ message: 'Clipboard is empty', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      useStore.getState().setNotification({ message: 'Failed to access clipboard. Please check permissions.', type: 'error' });
    }
  };

  const toggleTheme = () => {
    if (appTheme === "dark") {
      setAppTheme("light");
      setCanvasBackgroundColor("#f8fafc");
      setCanvasPatternColor("rgba(51, 65, 85, 0.15)");
    } else {
      setAppTheme("dark");
      setCanvasBackgroundColor("#0d1117");
      setCanvasPatternColor("rgba(148, 163, 184, 0.15)");
    }
  };


  const expandAll = () => {
    setCollapsedNodes(new Set());
    window.dispatchEvent(new CustomEvent("schema-expand-all"));
  };

  const collapseAll = () => {
    const allIds = new Set<string>();
    const traverse = (node: any) => {
      if (node.children) {
        allIds.add(node.id);
        node.children.forEach(traverse);
      }
    };
    if (treeData) traverse(treeData);
    setCollapsedNodes(allIds);
    window.dispatchEvent(new CustomEvent("schema-collapse-all"));
  };

  const formatCode = () => {
    window.dispatchEvent(new CustomEvent("format-editor"));
  };

  const [showEdgeWidthPopover, setShowEdgeWidthPopover] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [showExportPopover, setShowExportPopover] = useState(false);
  const [exportPopoverCoords, setExportPopoverCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleExportClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setExportPopoverCoords({
      top: rect.bottom + window.scrollY + 4,
      left: Math.max(10, Math.min(rect.right - 220, window.innerWidth - 230)),
    });
    setShowExportPopover(!showExportPopover);
  };

  const handleEdgeWidthButtonClick = (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Position below button; make sure it does not overflow viewport width
    const leftVal = Math.max(
      10,
      Math.min(rect.left - 100, window.innerWidth - 240),
    );
    setPopoverCoords({
      top: rect.bottom + window.scrollY + 6,
      left: leftVal,
    });
    setShowEdgeWidthPopover(!showEdgeWidthPopover);
  };
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string>(
    "Preparing graph snapshot...",
  );

  const exportHDImage = async (rawType: string = "png") => {
    let type = rawType;
    let isTransparent = false;

    if (rawType.endsWith("-transparent")) {
      isTransparent = true;
      type = rawType.replace("-transparent", "");
    }

    setIsExporting(true);
    setExportStatus("Preparing export...");

    // Wait for React to render the loader UI
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 50)),
    );

    if (visualizerMode === "schema") {
      const sourceEl = document.getElementById("schema-export-wrapper");
      if (!sourceEl) {
        setIsExporting(false);
        return;
      }

      // Store variables to restore in finally
      let originalPos = "";
      let originalW = "";
      let originalH = "";
      let originalZ = "";
      let originalViewportTransform = "";
      let originalViewportTransition = "";
      let originalDrawingTransform = "";
      let originalBgColor = "";
      let originalReactFlowBg = "";
      let hadBgClassLight = false;
      let hadBgClassDark = false;
      let viewportEl: HTMLElement | null = null;
      let drawingGEl: HTMLElement | null = null;
      let reactFlowEl: HTMLElement | null = null;
      let noExportEls: Element[] = [];
      let originalDisplays: string[] = [];
      let overrideApplied = false;

      try {
        setExportStatus("Expanding schema fields...");
        // Expand all fields for export
        useStore.getState().setSchemaExportActive(true);
        // Wait for React to render and update layout sizes
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve, 350)),
        );

        setExportStatus("Preparing viewport layout...");
        viewportEl = sourceEl.querySelector(
          ".react-flow__viewport",
        ) as HTMLElement | null;
        drawingGEl = sourceEl.querySelector(
          "#schema-drawing-g",
        ) as HTMLElement | null;
        reactFlowEl = sourceEl.querySelector(
          ".react-flow",
        ) as HTMLElement | null;

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        const nodeElements = Array.from(
          sourceEl.querySelectorAll(".react-flow__node"),
        ) as HTMLElement[];

        const hasNodes = nodeElements.length > 0 && !!viewportEl;
        let fullWidth = 1200;
        let fullHeight = 800;
        const padding = 60;

        if (hasNodes && viewportEl) {
          nodeElements.forEach((nodeEl) => {
            const transformStr = nodeEl.style.transform || "";
            let match = transformStr.match(
              /translate(?:3d)?\(([-.\d]+)px,\s*([-.\d]+)px/,
            );
            let x = 0;
            let y = 0;
            if (match) {
              x = parseFloat(match[1]);
              y = parseFloat(match[2]);
            }
            const w = nodeEl.offsetWidth || 340;
            const h = nodeEl.offsetHeight || 200;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
          });

          fullWidth = Math.max(maxX - minX + padding * 2, 800);
          fullHeight = Math.max(maxY - minY + padding * 2, 600);
        } else {
          const rect = sourceEl.getBoundingClientRect();
          fullWidth = rect.width || 1200;
          fullHeight = rect.height || 800;
        }

        // Save original styles to restore later
        originalPos = sourceEl.style.position;
        originalW = sourceEl.style.width;
        originalH = sourceEl.style.height;
        originalZ = sourceEl.style.zIndex;

        originalBgColor = sourceEl.style.backgroundColor;
        hadBgClassLight = sourceEl.classList.contains("bg-slate-50");
        hadBgClassDark = sourceEl.classList.contains("dark:bg-[#07090e]");

        if (reactFlowEl) {
          originalReactFlowBg = reactFlowEl.style.backgroundColor;
        }

        if (viewportEl) {
          originalViewportTransform = viewportEl.style.transform;
          originalViewportTransition = viewportEl.style.transition;
          viewportEl.style.transition = "none";
        }

        if (drawingGEl) {
          originalDrawingTransform = drawingGEl.getAttribute("transform") || "";
          drawingGEl.style.transition = "none";
        }

        // Hide no-export elements
        let queryStr =
          ".no-export, [data-capture-exclude], .react-flow__controls, .react-flow__panel, .react-flow__minimap";
        if (isTransparent) {
          queryStr += ", .react-flow__background";
        }
        noExportEls = Array.from(sourceEl.querySelectorAll(queryStr));
        originalDisplays = noExportEls.map(
          (el) => (el as HTMLElement).style.display,
        );
        noExportEls.forEach((el) => {
          (el as HTMLElement).style.display = "none";
        });

        sourceEl.classList.add("export-mode-override");

        // Apply temporary layout at full size and 1:1 scale
        sourceEl.style.position = "fixed";
        sourceEl.style.top = "0";
        sourceEl.style.left = "0";
        sourceEl.style.width = `${fullWidth}px`;
        sourceEl.style.height = `${fullHeight}px`;
        sourceEl.style.zIndex = "-9999";

        if (isTransparent) {
          sourceEl.classList.remove("bg-slate-50", "dark:bg-[#07090e]");
          sourceEl.style.backgroundColor = "transparent";
          if (reactFlowEl) {
            reactFlowEl.style.backgroundColor = "transparent";
          }
        }

        if (hasNodes && viewportEl) {
          viewportEl.style.transform = `translate(${padding - minX}px, ${padding - minY}px) scale(1)`;
          if (drawingGEl) {
            drawingGEl.setAttribute(
              "transform",
              `translate(${padding - minX}, ${padding - minY}) scale(1)`,
            );
          }
        }

        overrideApplied = true;

        // Give browser a frame to layout
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve, 200)),
        );

        setExportStatus("Rendering Snapshot...");
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve, 50)),
        );

        // statically imported snapdom

        const options = {
          exclude: [
            ".no-export",
            ".node-query-engine",
            "[data-capture-exclude]",
            ".react-flow__controls",
            ".react-flow__panel",
            ".react-flow__minimap",
          ],
          compress: true,
          scale: type === "svg" ? 1 : 2,
          quality: 1,
          backgroundColor:
            type === "jpeg" &&
              (useStore.getState().canvasBackgroundColor === "transparent" ||
                !useStore.getState().canvasBackgroundColor)
              ? "#ffffff"
              : isTransparent
                ? "transparent"
                : useStore.getState().canvasBackgroundColor ||
                (useStore.getState().appTheme === "dark"
                  ? "#07090e"
                  : "#f8fafc"),
          width: fullWidth,
          height: fullHeight,
          format: type === "jpeg" ? "jpg" : type,
          filename: `schema-visualizer-hd${isTransparent ? "-transparent" : ""}`,
        };

        await (snapdom.snapdom as any).download(sourceEl, options);

        setExportStatus("Finalizing export...");
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve, 50)),
        );
      } catch (err) {
        console.error("Schema Export failed:", err);
        useStore
          .getState()
          .setNotification({
            message: "Failed to export schema visualizer.",
            type: "error",
          });
      } finally {
        if (overrideApplied) {
          // Restore
          sourceEl.style.position = originalPos;
          sourceEl.style.width = originalW;
          sourceEl.style.height = originalH;
          sourceEl.style.zIndex = originalZ;

          if (isTransparent) {
            if (hadBgClassLight) sourceEl.classList.add("bg-slate-50");
            if (hadBgClassDark) sourceEl.classList.add("dark:bg-[#07090e]");
            sourceEl.style.backgroundColor = originalBgColor;
            if (reactFlowEl) {
              reactFlowEl.style.backgroundColor = originalReactFlowBg;
            }
          }

          if (viewportEl) {
            viewportEl.style.transform = originalViewportTransform;
            viewportEl.style.transition = originalViewportTransition;
          }

          if (drawingGEl) {
            if (originalDrawingTransform) {
              drawingGEl.setAttribute("transform", originalDrawingTransform);
            } else {
              drawingGEl.removeAttribute("transform");
            }
            drawingGEl.style.transition = "";
          }

          sourceEl.classList.remove("export-mode-override");

          noExportEls.forEach((el, index) => {
            (el as HTMLElement).style.display = originalDisplays[index];
          });
        }
        useStore.getState().setSchemaExportActive(false);
        setIsExporting(false);
      }
      return;
    }

    const sourceEl = document.getElementById("graph-export-wrapper");
    const svgEl = document.querySelector(".graph-svg") as SVGSVGElement | null;
    const gEl = document.querySelector(".graph-g") as SVGGElement | null;

    if (!sourceEl || !svgEl || !gEl) {
      setIsExporting(false);
      return;
    }

    let originalExpanded = useStore.getState().globalTextExpanded;

    try {
      if (!originalExpanded) {
        setExportStatus("Expanding geometry...");
        setGlobalTextExpanded(true);
        // Wait for React update and D3 bounds recalculation
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve, 350)),
        );
      }

      setExportStatus("Optimizing capture...");
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 50)),
      );

      // statically imported snapdom

      // Temporarily remove transition to prevent animation during snapshot
      sourceEl.style.transition = "none";
      gEl.style.transition = "none";

      const themeRect = gEl.querySelector(
        ".canvas-theme-rect",
      ) as SVGRectElement | null;
      if (themeRect) themeRect.style.display = "none";

      const bbox = gEl.getBBox();
      const padding = 60;

      if (themeRect) themeRect.style.display = "";

      const fullWidth = Math.max(bbox.width + padding * 2, 800);
      const fullHeight = Math.max(bbox.height + padding * 2, 600);

      const originalThemeRectX = themeRect?.getAttribute("x") || "-100000";
      const originalThemeRectY = themeRect?.getAttribute("y") || "-100000";
      const originalThemeRectW = themeRect?.getAttribute("width") || "200000";
      const originalThemeRectH = themeRect?.getAttribute("height") || "200000";

      if (themeRect) {
        themeRect.setAttribute("x", String(bbox.x - padding));
        themeRect.setAttribute("y", String(bbox.y - padding));
        themeRect.setAttribute("width", String(fullWidth));
        themeRect.setAttribute("height", String(fullHeight));
      }

      // Save original styles to restore later
      const originalPos = sourceEl.style.position;
      const originalW = sourceEl.style.width;
      const originalH = sourceEl.style.height;
      const originalZ = sourceEl.style.zIndex;
      const originalTransform = gEl.getAttribute("transform");

      // Temporarily modify the live DOM so snapdom reads computed styles accurately
      // We make it slightly cover the screen, but z-index it so it overlays or works underneath
      sourceEl.style.position = "fixed";
      sourceEl.style.top = "0";
      sourceEl.style.left = "0";
      sourceEl.style.width = `${fullWidth}px`;
      sourceEl.style.height = `${fullHeight}px`;
      sourceEl.style.zIndex = "-9999";

      gEl.setAttribute(
        "transform",
        `translate(${padding - bbox.x}, ${padding - bbox.y}) scale(1)`,
      );

      // Hide no-export elements
      let queryStr = ".no-export, [data-capture-exclude]";
      if (isTransparent) {
        queryStr += ", #graph-background-layer";
      }
      const noExportEls = Array.from(sourceEl.querySelectorAll(queryStr));
      const originalDisplays = noExportEls.map(
        (el) => (el as HTMLElement).style.display,
      );
      noExportEls.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });

      sourceEl.classList.add("export-mode-override");

      // Give browser a frame to layout and fetch images
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 200)),
      );

      setExportStatus("Rendering Snapshot...");
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 50)),
      );

      const options = {
        exclude: [".no-export", ".node-query-engine", "[data-capture-exclude]"],
        compress: true,
        scale: type === "svg" ? 1 : 2,
        quality: 1,
        backgroundColor:
          type === "jpeg" &&
            (useStore.getState().canvasBackgroundColor === "transparent" ||
              !useStore.getState().canvasBackgroundColor)
            ? "#ffffff"
            : isTransparent
              ? "transparent"
              : useStore.getState().canvasBackgroundColor ||
              (useStore.getState().appTheme === "dark"
                ? "#0d1117"
                : "#ffffff"),
        width: fullWidth,
        height: fullHeight,
        format: type === "jpeg" ? "jpg" : type,
        filename: `json-graph-hd${isTransparent ? "-transparent" : ""}`,
      };

      await (snapdom.snapdom as any).download(sourceEl, options);

      setExportStatus("Finalizing export...");
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 50)),
      );

      // Restore everything
      sourceEl.style.position = originalPos;
      sourceEl.style.width = originalW;
      sourceEl.style.height = originalH;
      sourceEl.style.zIndex = originalZ;
      sourceEl.style.transition = "";
      gEl.style.transition = "";

      if (originalTransform) {
        gEl.setAttribute("transform", originalTransform);
      } else {
        gEl.removeAttribute("transform");
      }

      if (themeRect) {
        themeRect.setAttribute("x", originalThemeRectX);
        themeRect.setAttribute("y", originalThemeRectY);
        themeRect.setAttribute("width", originalThemeRectW);
        themeRect.setAttribute("height", originalThemeRectH);
      }

      sourceEl.classList.remove("export-mode-override");

      noExportEls.forEach((el, index) => {
        (el as HTMLElement).style.display = originalDisplays[index];
      });
    } catch (err) {
      console.error("Export failed:", err);
      useStore
        .getState()
        .setNotification({ message: "Failed to export graph.", type: "error" });
    } finally {
      if (!originalExpanded) {
        setGlobalTextExpanded(false);
      }
      setIsExporting(false);
    }
  };

  useEffect(() => {
    exportHDImageRef.current = exportHDImage;
  }, [exportHDImage]);

  return (
    <>
      {isExporting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 flex flex-col items-center max-w-sm w-full mx-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              Exporting...
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center">
              {exportStatus}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 py-2 px-3 bg-white dark:bg-[#0d1117] border-b border-slate-300 dark:border-slate-800 text-sm shadow-sm select-none z-[500] relative transition-colors h-[48px]">
        <div className="flex items-center gap-3 mr-2 lg:border-r border-slate-300 dark:border-slate-800 lg:pr-4 flex-shrink-0">
          <button
            onClick={() => setIsEditorPanelOpen(!isEditorPanelOpen)}
            className={`p-1.5 rounded transition-colors ${isEditorPanelOpen ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"}`}
            title="Toggle Editor Panel"
          >
            <PanelLeft size={18} />
          </button>
          <Link
            to="/"
            className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 hover:text-blue-500 transition-colors"
          >
            <svg
              className="w-5 h-5 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            Data Visualizer
          </Link>
          <div className="hidden xl:flex items-center gap-4 ml-4 text-xs font-semibold">
            <Link
              to="/about"
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              About
            </Link>
            <Link
              to="/examples"
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              Examples
            </Link>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-2 xl:gap-5 lg:gap-3">
            <CustomSelect
              label="Mode"
              variant="toolbar"
              value={visualizerMode}
              onChange={(val) => setVisualizerMode(val as any)}
              options={[
                { label: "Graph", value: "graph", icon: <Network size={12} /> },
                { label: "Schema", value: "schema", icon: <Database size={12} /> },
              ]}
              className="border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0"
            />

            <CustomSelect
              label="Format"
              variant="toolbar"
              value={codeFormat}
              onChange={(val) => convertFormat(val as any)}
              options={CODE_FORMATS.map(f => ({ label: f.toUpperCase(), value: f, icon: <FileType size={12} /> }))}
              className="border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0"
            />

            <CustomSelect
              label="Layout"
              variant="toolbar"
              value={layoutMode}
              onChange={(val) => {
                setLayoutMode(val as any);
                useStore.getState().clearDragOverrides();
              }}
              options={[...LAYOUT_MODES]}
              className="border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0"
            />
            <button
              onClick={() => {
                useStore.getState().triggerAutoOrganize();
                useStore.getState().clearDragOverrides();
              }}
              className="ml-0 hover:bg-blue-100 bg-blue-50/50 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-1 rounded-md transition-colors shadow-sm border border-blue-200 dark:border-blue-800/60 tooltip-trigger relative group/btn mr-3"
              title="Auto Organize Layout"
            >
              <Network size={14} />
            </button>

            <CustomSelect
              label="Theme"
              variant="toolbar"
              value={nodeTheme}
              onChange={(val) => setNodeTheme(val as NodeTheme)}
              options={[...NODE_THEMES]}
              className="border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0"
            />

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <CustomSelect
                label="Edge"
                variant="toolbar"
                value={edgeStyle}
                onChange={(val) => setEdgeStyle(val as EdgeStyle)}
                options={[...EDGE_STYLES]}
              />
              <button
                onClick={handleEdgeWidthButtonClick}
                className={`p-1 rounded border border-slate-200 dark:border-slate-800/60 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 ${showEdgeWidthPopover ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100" : ""}`}
                title="Adjust edge/link line width"
              >
                <SlidersHorizontal size={13} />
              </button>
            </div>

            <CustomSelect
              label="Shape"
              variant="toolbar"
              value={nodeShape}
              onChange={(val) => setNodeShape(val as NodeShape)}
              options={[...NODE_SHAPES]}
              className="border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0"
            />
          </div>

          <div className="flex items-center gap-1 xl:gap-4 lg:gap-2">
            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-2 xl:pr-4 flex-shrink-0">
              <button
                onClick={() => useStore.getState().setIsAIPaletteOpen(true)}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white transition-all cursor-pointer text-xs font-bold shadow-sm shadow-purple-500/20 active:scale-95 border border-purple-400/30"
                title="Open AI Command Palette (Ctrl+J)"
              >
                <Sparkles size={13} className="text-white group-hover:scale-110 transition-transform" />
                <span className="truncate text-white font-black tracking-wide">Ask AI</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-black/20 text-[9px] font-mono font-bold text-white/90 border border-white/20">
                  ⌘J
                </kbd>
              </button>
            </div>
            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <button
                onClick={expandAll}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Expand All"
              >
                <Maximize size={16} />
              </button>
              <button
                onClick={collapseAll}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Collapse All"
              >
                <Minimize size={16} />
              </button>
              <button
                id="fit-graph-btn"
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Fit to Screen"
              >
                <Maximize2 size={16} />
              </button>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 border-r border-slate-300 dark:border-slate-800 pr-2">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border ${undoStack.length > 0
                  ? "border-red-400 text-red-500 bg-red-500/10 hover:bg-red-500/20 shadow-sm"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border ${redoStack.length > 0
                  ? "border-red-400 text-red-500 bg-red-500/10 hover:bg-red-500/20 shadow-sm"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
              <button
                onClick={handlePasteClipboard}
                className="p-1.5 rounded transition-colors border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800"
                title="Paste from Clipboard"
              >
                <ClipboardPaste size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 border-r border-slate-300 dark:border-slate-800 pr-4">
              <button
                onClick={() => setIsSavedDocsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors border border-slate-300 dark:border-slate-700"
                title="Open Document Manager"
              >
                <FolderOpen size={14} className="text-blue-500" />
                <span className="text-sm font-semibold max-w-[150px] truncate">
                  {activeDocumentName || "Unnamed Document"}
                </span>
              </button>

              <div className="flex items-center gap-1.5 mr-2">
                <button
                  onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                  className={`p-1.5 rounded-md transition-colors border ${isAutosaveEnabled ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-800/40" : "bg-transparent text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"}`}
                  title={isAutosaveEnabled ? "Autosave is On" : "Turn On Autosave"}
                >
                  {isAutosaveEnabled ? <Cloud size={14} /> : <CloudOff size={14} />}
                </button>

                {!isAutosaveEnabled && isDirty && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Unsaved Changes
                  </span>
                )}
                {!isAutosaveEnabled && !isDirty && activeDocumentId && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Check size={10} strokeWidth={3} />
                    Saved
                  </span>
                )}
              </div>

              {(isDirty && activeDocumentId && !isAutosaveEnabled) && (
                <button
                  onClick={async () => {
                    await db.documents.update(activeDocumentId, {
                      code,
                      updatedAt: Date.now()
                    });
                    setLastSavedCode(code);
                    setIsDirty(false);
                    setNotification({ message: 'Document saved', type: 'success' });
                  }}
                  className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors border border-transparent shadow-sm"
                  title="Save Current Document"
                >
                  <Save size={14} />
                  <span className="text-xs font-semibold">Save</span>
                </button>
              )}
              {(!activeDocumentId && isDirty) && (
                <button
                  onClick={() => setIsSavedDocsOpen(true)}
                  className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors border border-transparent shadow-sm"
                  title="Save as new document"
                >
                  <Save size={14} />
                  <span className="text-xs font-semibold">Save New</span>
                </button>
              )}

              <label
                className="cursor-pointer flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition-colors border border-indigo-500/25 hover:-translate-y-px mr-2"
                title="Upload JSON/CSV/Excel"
              >
                <Database size={14} />
                <span className="text-xs font-semibold hidden lg:inline">
                  Upload File
                </span>
                <input
                  id="main-file-upload"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".json,.csv,.xlsx,.xls,.yaml,.yml,.txt,image/*,video/*,audio/*,application/pdf"
                  onChange={handleFileUpload}
                />
              </label>

              <button
                id="main-info-btn"
                onClick={() => setIsApiHelpOpen(true)}
                className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/25 hover:-translate-y-px mr-2 relative overflow-hidden group/info-btn"
                title="Interactive Nodes Integrations Guide"
              >
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -translate-x-full group-hover/info-btn:animate-[shimmer_2s_infinite]" />
                <span className="font-bold text-sm leading-none flex items-center justify-center w-[14px] h-[14px] border border-current rounded-full text-[10px]">?</span>
                <span className="text-xs font-semibold">Info</span>
                <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </button>
              <button
                onClick={() => setIsQuickUtilsOpen(true)}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Quick Utilities"
              >
                <Wrench size={16} />
              </button>
              <button
                onClick={() => setIsBarcodeGeneratorOpen(true)}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Barcode Generator"
              >
                <Barcode size={16} />
              </button>
              <button
                onClick={() => setIsCameraModalOpen(true)}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Camera"
              >
                <Camera size={16} />
              </button>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title="Toggle Theme"
              >
                {appTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={onOpenShare}
                className="flex items-center gap-2 p-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-all shadow-sm shadow-blue-500/20 active:scale-95"
                title="Share via URL"
              >
                <Share2 size={16} />
                <span>Share</span>
                <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[9px] uppercase tracking-tighter">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${shareIndicator?.color}`}
                  />
                  {shareIndicator?.label}
                </div>
              </button>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="flex items-center pr-2 border-r border-slate-300 dark:border-slate-800">
                <button
                  onClick={formatCode}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                  title="Format JSON/YAML"
                >
                  <Paintbrush size={16} />
                </button>
              </div>
              <div className="flex items-center gap-1 pl-1">
                <button
                  onClick={handleExportClick}
                  disabled={isExporting}
                  className={`flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded border transition-all outline-none ${showExportPopover ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10" : "border-slate-200 dark:border-slate-800/60 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"} text-slate-800 dark:text-slate-200 ${isExporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Download size={14} className="text-slate-400" />
                  <span>Export</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showExportPopover ? "rotate-180" : ""}`} />
                </button>
              </div>
              <div className="hidden lg:flex items-center pl-2">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={() => useStore.getState().setIsAIPaletteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
            title="Ask AI Command Palette"
          >
            <Sparkles size={13} className="animate-pulse" />
            <span>Ask AI</span>
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-[490]"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed top-[48px] left-0 right-0 bottom-0 bg-slate-50 dark:bg-[#0f172a] z-[510] shadow-2xl overflow-y-auto custom-scrollbar flex flex-col">
            <div className="p-4 pb-16 grid grid-cols-2 gap-4">
              {/* Account / User Section for Mobile */}
              <div className="col-span-2">
                <UserMenu variant="row" onAction={() => setIsMobileMenuOpen(false)} />
              </div>

              {/* AI Features Section */}
              <div className="col-span-2 p-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-slate-900/40 border border-purple-200 dark:border-purple-800/40 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                    <Sparkles size={14} className="text-purple-500" />
                    <span>AI Intelligence</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      useStore.getState().setIsAIPaletteOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Sparkles size={14} /> Ask AI
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      useStore.getState().setIsAISettingsPanelOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all"
                  >
                    <SlidersHorizontal size={14} className="text-purple-500" /> AI Settings
                  </button>
                </div>
              </div>
              <CustomSelect
                label="Mode"
                value={visualizerMode}
                onChange={(val) => setVisualizerMode(val as any)}
                options={[
                  { label: "Graph", value: "graph" },
                  { label: "Schema", value: "schema" },
                ]}
                className="flex flex-col items-start gap-2 col-span-1"
              />

              <CustomSelect
                label="Format"
                value={codeFormat}
                onChange={(val) => convertFormat(val as any)}
                options={[
                  { label: "JSON", value: "json" },
                  { label: "YAML", value: "yaml" },
                ]}
                className="flex flex-col items-start gap-2 col-span-1"
              />

              <div className="flex flex-col gap-2 col-span-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Layout
                  </label>
                  <button
                    onClick={() => {
                      useStore.getState().triggerAutoOrganize();
                      useStore.getState().clearDragOverrides();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md transition-colors"
                  >
                    <Network size={12} /> Organize
                  </button>
                </div>
                <CustomSelect
                  value={layoutMode}
                  onChange={(val) => {
                    setLayoutMode(val as any);
                    useStore.getState().clearDragOverrides();
                  }}
                  options={[...LAYOUT_MODES]}
                />
              </div>

              <CustomSelect
                label="Theme"
                value={nodeTheme}
                onChange={(val) => setNodeTheme(val as NodeTheme)}
                options={[...NODE_THEMES]}
                className="flex flex-col items-start gap-2 col-span-1"
              />

              <CustomSelect
                label="Edge Style"
                value={edgeStyle}
                onChange={(val) => setEdgeStyle(val as EdgeStyle)}
                options={[...EDGE_STYLES]}
                className="flex flex-col items-start gap-2 col-span-1"
              />

              <div className="flex flex-col gap-2 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/60 col-span-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span>Edge Line Width</span>
                  <div className="flex items-center gap-1.5 normal-case font-mono text-xs text-blue-500 font-bold">
                    <span>{edgeWidth.toFixed(1)}x</span>
                    <button
                      onClick={() => setEdgeWidth(1.0)}
                      title="Reset edge width"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                </div>
                <div className="pt-1.5 flex flex-col gap-1">
                  <input
                    type="range"
                    min="0.2"
                    max="4.0"
                    step="0.1"
                    value={edgeWidth}
                    onChange={(e) => setEdgeWidth(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                    <span>0.2x</span>
                    <span>1.0x (Default)</span>
                    <span>4.0x</span>
                  </div>
                </div>
              </div>

              <CustomSelect
                label="Node Shape"
                value={nodeShape}
                onChange={(val) => setNodeShape(val as NodeShape)}
                options={[...NODE_SHAPES]}
                className="flex flex-col items-start gap-2 col-span-1"
              />

              {/* Document & File Management Grid */}
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block">
                  Document & Storage
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${isAutosaveEnabled
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                      : "bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {isAutosaveEnabled ? <Cloud size={16} className="text-blue-500" /> : <CloudOff size={16} />}
                      <span>Autosave</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isAutosaveEnabled ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}>
                      {isAutosaveEnabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSavedDocsOpen(true);
                    }}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <FolderOpen size={16} className="text-blue-500" />
                    <span className="truncate">Saved Docs</span>
                  </button>

                  {activeDocumentId ? (
                    <button
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
                        await db.documents.update(activeDocumentId, {
                          code,
                          updatedAt: Date.now()
                        });
                        setLastSavedCode(code);
                        setIsDirty(false);
                        setNotification({ message: 'Document updated successfully', type: 'success' });
                      }}
                      className="flex items-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-blue-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm"
                    >
                      <Save size={16} />
                      <span>Quick Save</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsSavedDocsOpen(true);
                      }}
                      className="flex items-center gap-2 p-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border border-amber-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm"
                    >
                      <Save size={16} />
                      <span>Save New</span>
                    </button>
                  )}

                  <label className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer">
                    <Database size={16} />
                    <span className="truncate">Upload File</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".json,.xlsx,.xls,.yaml,.yml,.txt,image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => {
                        setIsMobileMenuOpen(false);
                        handleFileUpload(e);
                      }}
                    />
                  </label>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handlePasteClipboard();
                    }}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer"
                  >
                    <ClipboardPaste size={16} />
                    <span className="truncate">Paste Clipboard</span>
                  </button>
                </div>
              </div>

              {/* Tools & Preferences Grid */}
              <div className="col-span-2 mt-1 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block">
                  Tools & Options
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsApiHelpOpen(true);
                    }}
                    className="flex items-center gap-2 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-all relative overflow-hidden group"
                  >
                    <span className="font-bold text-xs leading-none flex items-center justify-center w-4 h-4 border border-current rounded-full">?</span>
                    <span>Info Guide</span>
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsQuickUtilsOpen(true);
                    }}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <Wrench size={16} className="text-gray-500" />
                    <span>Utilities</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsBarcodeGeneratorOpen(true);
                    }}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <Barcode size={16} className="text-blue-500" />
                    <span>Barcode</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsCameraModalOpen(true);
                    }}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <Camera size={16} className="text-rose-500" />
                    <span>Camera</span>
                  </button>

                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    {appTheme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-500" />}
                    <span>{appTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </button>

                  <button
                    onClick={formatCode}
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <Paintbrush size={16} className="text-purple-500" />
                    <span>Format</span>
                  </button>
                </div>
              </div>

              {/* Share & Export */}
              <div className="col-span-2 mt-1 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenShare();
                  }}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mb-1"
                >
                  <div className="flex items-center gap-2">
                    <Share2 size={16} />
                    <span>Share Workspace</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/20 text-[9px] uppercase tracking-wider">
                    <div className={`w-1.5 h-1.5 rounded-full ${shareIndicator?.color}`} />
                    {shareIndicator?.label}
                  </div>
                </button>
              </div>

              <div className="col-span-2 mt-2 pt-4 border-t border-slate-300 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">
                  Download & Export
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { exportHDImage("png"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                      <FileImage size={16} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">PNG Image</span>
                  </button>
                  <button onClick={() => { exportHDImage("png-transparent"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                      <div className="relative">
                        <FileImage size={16} />
                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-3 h-3 bg-slate-100 dark:bg-[#0f172a] group-hover:bg-indigo-50 dark:group-hover:bg-[#1e1b4b] transition-colors rounded-full">
                          <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px' }}></div>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">PNG (Transp.)</span>
                  </button>
                  <button onClick={() => { exportHDImage("jpeg"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                      <FileImage size={16} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">JPEG Image</span>
                  </button>
                  <button onClick={() => { exportHDImage("webp"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-110 transition-transform">
                      <FileImage size={16} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">WebP Image</span>
                  </button>
                  <button onClick={() => { exportHDImage("svg"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                      <FileType size={16} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">SVG Vector</span>
                  </button>
                  <button onClick={() => { exportHDImage("svg-transparent"); setIsMobileMenuOpen(false); }} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group">
                    <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg group-hover:scale-110 transition-transform">
                      <div className="relative">
                        <FileType size={16} />
                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-3 h-3 bg-slate-100 dark:bg-[#0f172a] group-hover:bg-rose-50 dark:group-hover:bg-[#4c0519] transition-colors rounded-full">
                          <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px' }}></div>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">SVG (Transp.)</span>
                  </button>
                </div>
              </div>

              <div className="col-span-2 mt-4 pt-4 border-t border-slate-300 dark:border-slate-800 grid grid-cols-2 gap-2 text-center text-sm font-medium">
                <Link
                  to="/about"
                  className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  About
                </Link>
                <Link
                  to="/examples"
                  className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  Examples
                </Link>
                <Link
                  to="/privacy"
                  className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {showExportPopover && exportPopoverCoords && (
        <>
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setShowExportPopover(false)}
          />
          <div
            style={{
              top: `${exportPopoverCoords.top}px`,
              left: `${exportPopoverCoords.left}px`,
            }}
            className="fixed w-[220px] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-[1010] flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Export As</h3>
            </div>
            <div className="p-1.5 flex flex-col gap-0.5">
              <button onClick={() => { exportHDImage("png"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <FileImage size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">PNG Image</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">High quality raster</span>
                </div>
              </button>

              <button onClick={() => { exportHDImage("png-transparent"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <div className="relative flex items-center justify-center">
                    <FileImage size={14} />
                    <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-3 h-3 bg-white dark:bg-[#0f172a] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors rounded-full">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px' }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">PNG Transparent</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">No background</span>
                </div>
              </button>

              <button onClick={() => { exportHDImage("jpeg"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <FileImage size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">JPEG Image</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Smaller file size</span>
                </div>
              </button>

              <button onClick={() => { exportHDImage("webp"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                  <FileImage size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">WebP Image</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Optimized for web</span>
                </div>
              </button>

              <div className="h-px bg-slate-200 dark:bg-slate-800/60 my-0.5 mx-2"></div>

              <button onClick={() => { exportHDImage("svg"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <FileType size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">SVG Vector</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Scalable graphics</span>
                </div>
              </button>

              <button onClick={() => { exportHDImage("svg-transparent"); setShowExportPopover(false); }} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg text-left group transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                  <div className="relative flex items-center justify-center">
                    <FileType size={14} />
                    <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-3 h-3 bg-white dark:bg-[#0f172a] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors rounded-full">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px' }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">SVG Transparent</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Vector w/o background</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {showEdgeWidthPopover && popoverCoords && (
        <>
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setShowEdgeWidthPopover(false)}
          />
          <div
            style={{
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
            }}
            className="fixed p-3.5 w-56 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-[1010] flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                Edge Line Width
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs text-blue-500 font-bold">
                <span>{edgeWidth.toFixed(1)}x</span>
                <button
                  onClick={() => setEdgeWidth(1.0)}
                  title="Reset to default 1x width"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0.2"
              max="4.0"
              step="0.1"
              value={edgeWidth}
              onChange={(e) => setEdgeWidth(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-tight">
              <span>Thin (0.2x)</span>
              <span>Default (1.0x)</span>
              <span>Thick (4.0x)</span>
            </div>
          </div>
        </>
      )}

      <NodeHelpModal
        isOpen={isApiHelpOpen}
        onClose={() => setIsApiHelpOpen(false)}
      />

      <BarcodeGeneratorModal
        isOpen={isBarcodeGeneratorOpen}
        onClose={() => setIsBarcodeGeneratorOpen(false)}
      />
      <QuickUtilsModal
        isOpen={isQuickUtilsOpen}
        onClose={() => setIsQuickUtilsOpen(false)}
      />
      {isCameraModalOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraModalOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}
      <PromptModal
        isOpen={!!pendingCameraFile}
        title="Embed Image"
        message="Enter a key name to embed the capture (leave blank for random):"
        defaultValue={`capture_${Date.now()}`}
        onClose={() => setPendingCameraFile(null)}
        onConfirm={(value) => {
          if (pendingCameraFile) {
            processCameraCapture(pendingCameraFile, value);
          }
        }}
      />
      <AuthModals />
    </>
  );
}
