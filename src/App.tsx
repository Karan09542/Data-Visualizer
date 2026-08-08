import React, { useState, useRef, useCallback, useEffect, Suspense, useMemo } from "react";
import { Loader2, Maximize, Minimize, Maximize2, Undo2, Redo2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import EditorPanel from "./components/EditorPanel";
import GraphVisualizer from "./components/GraphVisualizer";
import Toolbar from "./components/Toolbar";
import AutosaveManager from "./components/AutosaveManager";
import { NotificationToast } from "./components/NotificationToast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useStore } from "./store/useStore";
import { useAnnotationStore } from "./store/useAnnotationStore";
import { parseShareUrl } from "./utils/shareUtils";
import { initDexieSync } from "./store/dexieSync";
import { setupSyncSubscribers } from "./store/syncSubscribers";
import { ServiceWorkerUpdater } from "./components/ServiceWorkerUpdater";
import { OfflineBanner } from "./components/OfflineBanner";
import { useKeyboardMediaShortcuts } from "./audio/hooks/useKeyboardMediaShortcuts";
import { lazyWithRetry } from "./utils/lazyWithRetry";

const ImportModal = lazyWithRetry(() => import("./components/ImportModal").then(module => ({ default: module.ImportModal })), 'ImportModal');
const IsolatedNodeView = lazyWithRetry(() => import("./components/IsolatedNodeView").then(module => ({ default: module.IsolatedNodeView })), 'IsolatedNodeView');
const SchemaVisualizer = lazyWithRetry(() => import("./components/SchemaVisualizer"), 'SchemaVisualizer');
const DrawingToolbar = lazyWithRetry(() => import("./components/DrawingToolbar"), 'DrawingToolbar');
const AdvancedPanel = lazyWithRetry(() => import("./components/AdvancedPanel"), 'AdvancedPanel');
const AISettingsSidebar = lazyWithRetry(() => import("./components/AI/AISettingsSidebar"), 'AISettingsSidebar');
const ShortcutsPopup = lazyWithRetry(() => import("./components/ShortcutsPopup"), 'ShortcutsPopup');
const MathHelpPopup = lazyWithRetry(() => import("./components/MathHelpPopup"), 'MathHelpPopup');
import { AICommandPalette } from "./components/AI/AICommandPalette";
import { applyPatchSmart, mergeJSON } from "./utils/patchUtils";
const YoutubeSearchPanel = lazyWithRetry(() => import("./components/YoutubeSearchPanel"), 'YoutubeSearchPanel');
const ShareDialog = lazyWithRetry(() => import("./components/ShareDialog"), 'ShareDialog');
const SavedDocumentsModal = lazyWithRetry(() => import("./components/SavedDocumentsModal"), 'SavedDocumentsModal');
const TextPreviewPopup = lazyWithRetry(() => import("./components/TextPreviewPopup"), 'TextPreviewPopup');
const MediaPreviewPopup = lazyWithRetry(() => import("./components/MediaPreviewPopup"), 'MediaPreviewPopup');
const CodeWorkspace = lazyWithRetry(() => import("./components/CodeWorkspace").then(module => ({ default: module.CodeWorkspace })), 'CodeWorkspace');
const PyMissingPromptModal = lazyWithRetry(() => import("./components/PyMissingPromptModal").then(module => ({ default: module.PyMissingPromptModal })), 'PyMissingPromptModal');
const ProductivityLayer = lazyWithRetry(() => import("./components/ProductivityLayer"), 'ProductivityLayer');
const StickyNotesManager = lazyWithRetry(() => import("./components/StickyNotesManager"), 'StickyNotesManager');
const AudioPlayerModal = lazyWithRetry(() => import("./audio/components/AudioPlayerModal"), 'AudioPlayerModal');
const MiniPlayer = lazyWithRetry(() => import("./audio/components/MiniPlayer"), 'MiniPlayer');
import { FloatingMic } from "./voice/components/FloatingMic";
import { useVoice } from "./voice/useVoice";


class GlobalErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("TOP LEVEL REACT ERROR:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong: {this.state.error?.message}</h1>;
    }
    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
}
function App() {
  const [editorWidth, setEditorWidth] = useState(30); // percentage

  const isEditorPanelOpen = useStore((state) => state.isEditorPanelOpen);
  const setIsEditorPanelOpen = useStore((state) => state.setIsEditorPanelOpen);
  const appTheme = useStore((state) => state.appTheme);
  const isMathHelpOpen = useStore((state) => state.isMathHelpOpen);
  const setIsMathHelpOpen = useStore((state) => state.setIsMathHelpOpen);
  const isSavedDocsOpen = useStore((state) => state.isSavedDocsOpen);
  const setIsSavedDocsOpen = useStore((state) => state.setIsSavedDocsOpen);
  const visualizerMode = useStore((state) => state.visualizerMode);
  const isFileProcessing = useStore((state) => state.isFileProcessing);
  const undoStack = useStore((state) => state.undoStack);
  const redoStack = useStore((state) => state.redoStack);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);

  useKeyboardMediaShortcuts();
  useVoice();

  // JS Node Workspace States
  const expandedJsNodeId = useStore((state) => state.expandedJsNodeId);
  const parsedData = useStore((state) => state.parsedData);

  const [searchParams] = useSearchParams();
  const focusNodePath = searchParams.get('focusNode');
  const forceWorkspace = searchParams.get('forceWorkspace');

  const { setExpandedJsNodeId, setCode, isAIPaletteOpen, setIsAIPaletteOpen } = useStore();

  const handleApplyAIPatch = useCallback(async (patch: any, mode: 'merge' | 'replace' = 'merge') => {
    try {
      const currentParsedData = useStore.getState().parsedData;
      const baseDoc = (currentParsedData !== null && typeof currentParsedData === 'object')
        ? currentParsedData
        : {};

      const res = applyPatchSmart(baseDoc, patch);
      let finalDoc: any;

      if (mode === 'replace') {
        finalDoc = res.newDocument;
      } else {
        finalDoc = mergeJSON(baseDoc, res.newDocument);
      }

      const codeFormat = useStore.getState().codeFormat;
      let newCode = "";
      if (codeFormat === 'yaml') {
        try {
          const yaml = (await import('js-yaml')).default;
          newCode = yaml.dump(finalDoc);
        } catch {
          newCode = JSON.stringify(finalDoc, null, 2);
        }
      } else {
        newCode = JSON.stringify(finalDoc, null, 2);
      }

      setCode(newCode);
    } catch (e: any) {
      alert("Failed to apply patch: " + (e.message || String(e)));
    }
  }, [setCode]);

  // We determine if focusNode is a "workspace" node based on naming conventions used by NodeRenderer
  const focusNodeType = useMemo(() => {
    if (!focusNodePath) return null;
    if (forceWorkspace === 'true') return 'workspace';

    const name = String(focusNodePath.split('.').pop() || '');

    // Check if it's a workspace-supported node
    const isJsNode = name.endsWith("_js_node");
    const isTsNode = name.endsWith("_ts_node");
    const isPyNode = name.endsWith("_py_node");
    const isTodoNode = name.endsWith("_todo_node") || name.endsWith(".todo");
    const isSearchNode = name.endsWith("_search_node") || name.endsWith(".search");

    // CodeWorkspace handles these generically if we set expandedJsNodeId
    if (isJsNode || isTsNode || isPyNode || isTodoNode || isSearchNode || name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".py") || name.endsWith(".json") || name.endsWith(".md") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp") || name.endsWith(".gif")) {
      return 'workspace';
    }

    return 'isolated';
  }, [focusNodePath]);

  useEffect(() => {
    if (focusNodeType === 'workspace' && focusNodePath) {
      setExpandedJsNodeId(focusNodePath);
    }
  }, [focusNodeType, focusNodePath, setExpandedJsNodeId]);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragSplitting, setIsDragSplitting] = useState(false);
  const isDragging = useRef(false);

  // Restore state from URL on load
  useEffect(() => {
    const cleanupSync = setupSyncSubscribers();
    initDexieSync();

    let gcTimeout: number | null = null;
    const unsub = useStore.subscribe((state, prevState) => {
      if (state.parsedData !== prevState.parsedData) {
        if (gcTimeout) clearTimeout(gcTimeout);
        gcTimeout = window.setTimeout(async () => {
          try {
            const historyCodes = [...state.undoStack, ...state.redoStack].map(s => s.code);
            const { deleteUnusedAssets } = await import("./utils/assetManager");
            await deleteUnusedAssets(state.parsedData, historyCodes);

            const { discoverAudio } = await import("./audio/services/audioDiscovery");
            const tracks = await discoverAudio();
            window.dispatchEvent(new CustomEvent('audio-library-updated', { detail: tracks }));
          } catch (err) {
            console.error("GC/Audio sync failed", err);
          }
        }, 1000);
      }
    });

    return () => {
      cleanupSync();
      unsub();
      if (gcTimeout) clearTimeout(gcTimeout);
    };
  }, []);

  useEffect(() => {

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

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      // Only react to file drops
      if ((window as any).__isInternalDrag) return;
      if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) return;

      e.preventDefault();
      dragCounter++;

      const isCustomZone = (e.target as Element)?.closest?.('.custom-dropzone');
      if (isCustomZone) {
        setIsDragOver(false);
      } else {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if ((window as any).__isInternalDrag) return;
      if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();

      const isCustomZone = (e.target as Element)?.closest?.('.custom-dropzone');
      if (isCustomZone) {
        setIsDragOver(false);
      } else {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if ((window as any).__isInternalDrag) return;
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      if ((window as any).__isInternalDrag) return;

      // Always reset state on drop
      dragCounter = 0;
      setIsDragOver(false);

      const isCustomZone = (e.target as Element)?.closest?.('.custom-dropzone');
      if (isCustomZone) {
        return; // The custom zone will handle the file import itself
      }

      if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      try {
        const { processFiles } = await import("./utils/fileProcessor");
        processFiles(files);
      } catch (err) {
        console.error("Failed to import file processor or process files:", err);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
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
      <OfflineBanner />
      <ServiceWorkerUpdater />
      <AutosaveManager />
      <NotificationToast />

      <AICommandPalette
        isOpen={isAIPaletteOpen}
        onClose={() => setIsAIPaletteOpen(false)}
        contextData={parsedData}
        onApplyContext={handleApplyAIPatch}
      />

      {focusNodePath ? (
        <div className="w-full h-full relative">
          {focusNodeType === 'workspace' ? (
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}>
              <CodeWorkspace
                path={focusNodePath}
                onClose={() => {
                  window.close(); // Attempt to close tab if standalone
                  setExpandedJsNodeId(null);
                }}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}>
              <IsolatedNodeView path={focusNodePath} />
            </Suspense>
          )}
          <Toolbar onOpenShare={() => setIsShareDialogOpen(true)} />
        </div>
      ) : (
        <>
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
                <div className="md:hidden absolute top-0 bottom-0 left-0 w-full z-[300] shadow-2xl bg-white dark:bg-[#0d1117]">
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
              <Suspense fallback={null}><DrawingToolbar /></Suspense>
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
                  <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}>
                    <SchemaVisualizer />
                  </Suspense>
                ) : (
                  <GraphVisualizer />
                )}
              </ErrorBoundary>

              {/* Mobile Canvas Floating Controls (Bottom-Left) */}
              {!isEditorPanelOpen && (
                <div className="lg:hidden absolute bottom-4 left-4 z-[350] flex items-center bg-white/90 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-1 shadow-lg opacity-60 hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    className="p-1.5 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 size={14} className={undoStack.length > 0 ? "text-red-500 dark:text-red-400" : ""} />
                    <span className="text-[11px]">Undo</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700/40" />
                  <button
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    className="p-1.5 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 size={14} className={redoStack.length > 0 ? "text-red-500 dark:text-red-400" : ""} />
                    <span className="text-[11px]">Redo</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700/40" />
                  <button
                    onClick={() => {
                      const btnId = document.getElementById("fit-graph-btn");
                      if (btnId) btnId.click();
                    }}
                    className="p-1.5 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Fit View"
                  >
                    <Maximize2 size={14} />
                    <span className="text-[11px]">Fit</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700/40" />
                  <button
                    onClick={() => {
                      useStore.getState().setCollapsedNodes(new Set());
                      window.dispatchEvent(new CustomEvent("schema-expand-all"));
                    }}
                    className="p-1.5 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Expand All"
                  >
                    <Maximize size={14} />
                    <span className="text-[11px]">Expand</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700/40" />
                  <button
                    onClick={() => {
                      const treeData = useStore.getState().treeData;
                      const allIds = new Set<string>();
                      const traverse = (node: any) => {
                        if (node?.children) {
                          allIds.add(node.id);
                          node.children.forEach(traverse);
                        }
                      };
                      if (treeData) traverse(treeData);
                      useStore.getState().setCollapsedNodes(allIds);
                      window.dispatchEvent(new CustomEvent("schema-collapse-all"));
                    }}
                    className="p-1.5 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Collapse All"
                  >
                    <Minimize size={14} />
                    <span className="text-[11px]">Collapse</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <Suspense fallback={null}>
        <AdvancedPanel />
        <AISettingsSidebar />
        <YoutubeSearchPanel />
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
        <StickyNotesManager />
      </Suspense>

      <Suspense fallback={null}>
        <AudioPlayerModal />
        <MiniPlayer />
      </Suspense>

      <FloatingMic />

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

      {(!focusNodePath && expandedJsNodeId) && (
        <Suspense fallback={null}>
          <CodeWorkspace
            path={expandedJsNodeId}
            onClose={() => setExpandedJsNodeId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
