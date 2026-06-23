import React, { useState, useRef, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import EditorPanel from "./components/EditorPanel";
import GraphVisualizer from "./components/GraphVisualizer";
import SchemaVisualizer from "./components/SchemaVisualizer";
import { ImportModal } from "./components/ImportModal";
import Toolbar from "./components/Toolbar";
import DrawingToolbar from "./components/DrawingToolbar";
import AdvancedPanel from "./components/AdvancedPanel";
import ShortcutsPopup from "./components/ShortcutsPopup";
import MathHelpPopup from "./components/MathHelpPopup";
import ShareDialog from "./components/ShareDialog";
import SavedDocumentsModal from "./components/SavedDocumentsModal";
import TextPreviewPopup from "./components/TextPreviewPopup";
import MediaPreviewPopup from "./components/MediaPreviewPopup";
import AutosaveManager from "./components/AutosaveManager";
import { NotificationToast } from "./components/NotificationToast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useStore } from "./store/useStore";
import { useAnnotationStore } from "./store/useAnnotationStore";
import { parseShareUrl } from "./utils/shareUtils";
import { CodeWorkspace } from "./components/CodeWorkspace";
import { initDexieSync } from "./store/dexieSync";
import { PyMissingPromptModal } from "./components/PyMissingPromptModal";
import ProductivityLayer from "./components/ProductivityLayer";
import { ServiceWorkerUpdater } from "./components/ServiceWorkerUpdater";

function getValueByPath(parsedData: any, path: string): string {
  if (!parsedData || !path) return "";
  const parts = path
    .replace(/root\.?/, "")
    .split(/\.|(?=\[)/)
    .filter(Boolean);

  let current = parsedData;
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return "";
    let part = parts[i];
    if (part.startsWith("[")) {
      part = part.slice(1, -1);
    }
    current = current[part];
  }
  return typeof current === "string" ? current : "";
}

function getJsNodeInputData(parsedData: any, path: string): any {
  if (!parsedData || !path) return null;
  const parts = path.split(".");
  if (parts.length > 1) {
    const parentParts = [...parts];
    parentParts.pop(); // remove last key

    let current = parsedData;
    const startIdx = parentParts[0] === "root" ? 1 : 0;

    for (let i = startIdx; i < parentParts.length; i++) {
      if (current === undefined || current === null) return null;
      let part = parentParts[i];
      if (part.startsWith("[")) {
        part = part.slice(1, -1);
      }
      current = current[part];
    }

    if (typeof current === "object" && current !== null) {
      const cloned = Array.isArray(current) ? [...current] : { ...current };
      const lastKey = parts[parts.length - 1];
      if (lastKey && !Array.isArray(cloned)) {
        delete (cloned as any)[lastKey];
      }
      return cloned;
    }
    return current;
  }
  return parsedData;
}

export default function App() {
  const [editorWidth, setEditorWidth] = useState(30); // percentage

  const isEditorPanelOpen = useStore((state) => state.isEditorPanelOpen);
  const setIsEditorPanelOpen = useStore((state) => state.setIsEditorPanelOpen);
  const appTheme = useStore((state) => state.appTheme);
  const setCode = useStore((state) => state.setCode);
  const isMathHelpOpen = useStore((state) => state.isMathHelpOpen);
  const setIsMathHelpOpen = useStore((state) => state.setIsMathHelpOpen);
  const isSavedDocsOpen = useStore((state) => state.isSavedDocsOpen);
  const setIsSavedDocsOpen = useStore((state) => state.setIsSavedDocsOpen);
  const visualizerMode = useStore((state) => state.visualizerMode);
  const isFileProcessing = useStore((state) => state.isFileProcessing);

  // JS Node Workspace States
  const expandedJsNodeId = useStore((state) => state.expandedJsNodeId);
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);
  const jsNodeCodeOverrides = useStore((state) => state.jsNodeCodeOverrides);
  const setJsNodeCodeOverride = useStore((state) => state.setJsNodeCodeOverride);
  const jsNodeLoading = useStore((state) => state.jsNodeLoading);
  const jsNodeErrors = useStore((state) => state.jsNodeErrors);
  const jsNodeResponses = useStore((state) => state.jsNodeResponses);
  const parsedData = useStore((state) => state.parsedData);

  const debounceMap = useRef<Record<string, NodeJS.Timeout>>({});
  const handleUpdateGlobalCode = useCallback((path: string, newCode: string) => {
    if (debounceMap.current[path]) {
      clearTimeout(debounceMap.current[path]);
    }
    debounceMap.current[path] = setTimeout(() => {
      useStore.getState().updateNodeValue(path, newCode);
    }, 1000);
  }, []);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragSplitting, setIsDragSplitting] = useState(false);
  const isDragging = useRef(false);

  // Restore state from URL on load
  useEffect(() => {
    initDexieSync();
    
    const sharedState = parseShareUrl();
    if (sharedState) {
      if (sharedState.code) setCode(sharedState.code);

      if (sharedState.settings) {
        const s = sharedState.settings;
        const store = useStore.getState();
        if (s.layoutMode) store.setLayoutMode(s.layoutMode);
        if (s.nodeTheme) store.setNodeTheme(s.nodeTheme);
        if (s.edgeStyle) store.setEdgeStyle(s.edgeStyle);
        if (s.nodeShape) store.setNodeShape(s.nodeShape);
        if (s.appTheme) store.setAppTheme(s.appTheme);
        if (s.canvasBackgroundColor)
          store.setCanvasBackgroundColor(s.canvasBackgroundColor);
        if (s.canvasPatternColor)
          store.setCanvasPatternColor(s.canvasPatternColor);
      }

      if (sharedState.annotations) {
        useAnnotationStore.getState().clearAnnotations();
        sharedState.annotations.forEach((a) =>
          useAnnotationStore.getState().addAnnotation(a),
        );
        useAnnotationStore.getState().commitAction();
      }
      // Clear hash after restore to keep URL clean (optional)
      // window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [setCode]);

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const startDragging = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      isDragging.current = true;
      setIsDragSplitting(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      window.getSelection()?.removeAllRanges();
    },
    [],
  );

  const stopDragging = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      setIsDragSplitting(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    }
  }, []);

  const onDrag = useCallback(
    (e: globalThis.MouseEvent | globalThis.TouchEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      let clientX = 0;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((clientX - containerRect.left) / containerRect.width) * 100;
      if (newWidth > 15 && newWidth < 85) {
        setEditorWidth(newWidth);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchmove", onDrag, { passive: false });
    window.addEventListener("touchend", stopDragging);
    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", onDrag);
      window.removeEventListener("touchend", stopDragging);
    };
  }, [onDrag, stopDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputFocused) {
        return;
      }

      const isDrawingMode = useAnnotationStore.getState().isToolbarVisible;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          if (isDrawingMode) useAnnotationStore.getState().redo();
          else useStore.getState().redo();
        } else {
          if (isDrawingMode) useAnnotationStore.getState().undo();
          else useStore.getState().undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        if (isDrawingMode) useAnnotationStore.getState().redo();
        else useStore.getState().redo();
      } else if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        const { isToolbarVisible, setIsToolbarVisible } =
          useAnnotationStore.getState();
        setIsToolbarVisible(!isToolbarVisible);
      } else if (
        isDrawingMode &&
        (e.key === "Backspace" || e.key === "Delete")
      ) {
        const selected = useAnnotationStore.getState().selectedAnnotationIds;
        if (selected.length > 0) {
          useAnnotationStore.getState().removeAnnotations(selected);
          useAnnotationStore.getState().commitAction();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (appTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [appTheme]);

  const handleDragEnter = (e: React.DragEvent) => {
    // Only react to file drops
    if ((window as any).__isInternalDrag) return;
    if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes("Files")) return;
    
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if ((window as any).__isInternalDrag) return;
    if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes("Files")) return;
    
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if ((window as any).__isInternalDrag) return;
    if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes("Files")) return;
    
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);

    // We hand off to our new intelligent file service
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    try {
      // We will dynamically import the handler so App.tsx stays lean
      const { processFiles } = await import("./utils/fileProcessor");
      processFiles(files);
    } catch (err) {
      console.error("Failed to import file processor or process files:", err);
    }
  }, []);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Ignore if user is typing in an input or textarea or monaco editor
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || e.target.closest(".monaco-editor"))
      ) {
        return;
      }

      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const files = Array.from(e.clipboardData.files);
        try {
          const { processFiles } = await import("./utils/fileProcessor");
          processFiles(files);
        } catch (err) {
          console.error("Failed to handle global paste:", err);
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        if ((window as any).__isInternalDrag) return;
        e.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${appTheme} flex flex-col h-screen w-screen bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 font-sans overflow-hidden transition-colors relative`}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-white/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200 pointer-events-none">
          <div className="flex flex-col items-center justify-center p-12 bg-white/20 dark:bg-black/30 border-2 border-dashed border-indigo-500/50 rounded-3xl shadow-2xl backdrop-blur-xl animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-indigo-600 dark:text-indigo-400 mb-4 drop-shadow-lg"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m16 16-4-4-4 4"></path>
            </svg>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight drop-shadow-md">
              Drop Files Here
            </h2>
            <p className="text-slate-600 dark:text-indigo-200 font-medium tracking-wide text-center">
              Upload JSON, CSV, Excel, PDF,
              <br />
              Images, Videos, 3D Models & More
            </p>
          </div>
        </div>
      )}
      <ServiceWorkerUpdater />
      <AutosaveManager />
      <NotificationToast />

      <Toolbar onOpenShare={() => setIsShareDialogOpen(true)} />
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-hidden flex relative z-0"
      >
        {isEditorPanelOpen && (
          <>
            {/* Desktop Editor */}
            <div
              style={{ width: `${editorWidth}%` }}
              className="hidden md:block h-full flex-shrink-0 relative z-10"
            >
              <EditorPanel />
            </div>

            {/* Mobile Editor Overlay */}
            <div className="md:hidden absolute top-0 bottom-0 left-0 w-[85%] z-[300] shadow-2xl bg-white dark:bg-[#0d1117]">
              <EditorPanel />
            </div>

            {/* Mobile Backdrop */}
            <div
              className="md:hidden absolute inset-0 z-[290] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
              onClick={() => setIsEditorPanelOpen(false)}
            />

            {/* Desktop Resizer */}
            <div
              className="hidden md:flex w-1.5 h-full bg-slate-200 dark:bg-[#0d1117] border-x border-slate-300 dark:border-slate-800 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors cursor-col-resize z-20 items-center justify-center group flex-shrink-0 touch-none"
              onMouseDown={startDragging}
              onTouchStart={startDragging}
            >
              <div className="h-8 w-0.5 bg-slate-400 dark:bg-slate-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-300 rounded-full transition-colors" />
            </div>
          </>
        )}

        <div className="flex-1 h-full min-w-0 relative">
          {/* Overlay to catch pointer events during resize so iframes don't steal mouse hover events */}
          {isDragSplitting && (
            <div className="absolute inset-0 z-[1000] bg-transparent cursor-col-resize" />
          )}
          <DrawingToolbar />
          <ErrorBoundary fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md z-50 text-white p-6">
              <div className="max-w-md text-center">
                <svg className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <h3 className="text-xl font-bold mb-2">Visualizer Render Interrupted</h3>
                <p className="text-sm text-slate-400 mb-6">
                  An unexpected layout error occurred while rendering the interactive visualization. Do you want to reload the application to reset the layout state?
                </p>
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition duration-150 ease-in-out cursor-pointer"
                >
                  Reload Application
                </button>
              </div>
            </div>
          }>
            {visualizerMode === "schema" ? (
              <SchemaVisualizer />
            ) : (
              <GraphVisualizer />
            )}
          </ErrorBoundary>
        </div>
      </div>
      <AdvancedPanel />
      <ShortcutsPopup />
      <MathHelpPopup
        isOpen={isMathHelpOpen}
        onClose={() => setIsMathHelpOpen(false)}
      />
      <ImportModal />
      <SavedDocumentsModal
        isOpen={isSavedDocsOpen}
        onClose={() => setIsSavedDocsOpen(false)}
      />
      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
      />
      <TextPreviewPopup />
      <MediaPreviewPopup />
      <PyMissingPromptModal />
      <ProductivityLayer />

      {isFileProcessing && (
        <div id="file-processing-loader" className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-white/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex flex-col items-center justify-center p-8 bg-white/90 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl">
            <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-1">
              Processing Uploaded File...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analyzing contents and formatting structure
            </p>
          </div>
        </div>
      )}

      {expandedJsNodeId && (
        <CodeWorkspace
          path={expandedJsNodeId}
          onClose={() => setExpandedJsNodeId(null)}
        />
      )}
    </div>
  );
}
