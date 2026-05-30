import React, { useState, useRef, useCallback, useEffect } from "react";
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
import { useStore } from "./store/useStore";
import { useAnnotationStore } from "./store/useAnnotationStore";
import { parseShareUrl } from "./utils/shareUtils";

export default function App() {
  const [editorWidth, setEditorWidth] = useState(30); // percentage
  
  const isEditorPanelOpen = useStore(state => state.isEditorPanelOpen);
  const setIsEditorPanelOpen = useStore(state => state.setIsEditorPanelOpen);
  const appTheme = useStore(state => state.appTheme);
  const setCode = useStore(state => state.setCode);
  const isMathHelpOpen = useStore(state => state.isMathHelpOpen);
  const setIsMathHelpOpen = useStore(state => state.setIsMathHelpOpen);
  const isSavedDocsOpen = useStore(state => state.isSavedDocsOpen);
  const setIsSavedDocsOpen = useStore(state => state.setIsSavedDocsOpen);
  const visualizerMode = useStore(state => state.visualizerMode);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Restore state from URL on load
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
        if (s.canvasBackgroundColor) store.setCanvasBackgroundColor(s.canvasBackgroundColor);
        if (s.canvasPatternColor) store.setCanvasPatternColor(s.canvasPatternColor);
      }

      if (sharedState.annotations) {
        useAnnotationStore.getState().clearAnnotations();
        sharedState.annotations.forEach(a => useAnnotationStore.getState().addAnnotation(a));
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
      document.body.style.cursor = "col-resize";
    },
    [],
  );

  const stopDragging = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.cursor = "default";
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
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (isInputFocused) {
        return;
      }

      const isDrawingMode = useAnnotationStore.getState().isToolbarVisible;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (isDrawingMode) useAnnotationStore.getState().redo();
          else useStore.getState().redo();
        } else {
          if (isDrawingMode) useAnnotationStore.getState().undo();
          else useStore.getState().undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (isDrawingMode) useAnnotationStore.getState().redo();
        else useStore.getState().redo();
      } else if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        const { isToolbarVisible, setIsToolbarVisible } = useAnnotationStore.getState();
        setIsToolbarVisible(!isToolbarVisible);
      } else if (isDrawingMode && (e.key === 'Backspace' || e.key === 'Delete')) {
        const selected = useAnnotationStore.getState().selectedAnnotationIds;
        if (selected.length > 0) {
          useAnnotationStore.getState().removeAnnotations(selected);
          useAnnotationStore.getState().commitAction();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (appTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appTheme]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    
    // We hand off to our new intelligent file service
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // We will dynamically import the handler so App.tsx stays lean
    const { processFiles } = await import('./utils/fileProcessor');
    processFiles(files);
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={e => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${appTheme} flex flex-col h-screen w-screen bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 font-sans overflow-hidden transition-colors relative`}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-white/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200 pointer-events-none">
          <div className="flex flex-col items-center justify-center p-12 bg-white/20 dark:bg-black/30 border-2 border-dashed border-indigo-500/50 rounded-3xl shadow-2xl backdrop-blur-xl animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400 mb-4 drop-shadow-lg"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m16 16-4-4-4 4"></path></svg>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight drop-shadow-md">Drop Files Here</h2>
            <p className="text-slate-600 dark:text-indigo-200 font-medium tracking-wide text-center">Upload JSON, CSV, Excel, PDF,<br />Images, Videos & More</p>
          </div>
        </div>
      )}
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
            <div
              className="md:hidden absolute top-0 bottom-0 left-0 w-[85%] z-[300] shadow-2xl bg-white dark:bg-[#0d1117]"
            >
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
          <DrawingToolbar />
          {visualizerMode === 'schema' ? <SchemaVisualizer /> : <GraphVisualizer />}
        </div>
      </div>
      <AdvancedPanel />
      <ShortcutsPopup />
      <MathHelpPopup isOpen={isMathHelpOpen} onClose={() => setIsMathHelpOpen(false)} />
      <ImportModal />
      <SavedDocumentsModal isOpen={isSavedDocsOpen} onClose={() => setIsSavedDocsOpen(false)} />
      <ShareDialog isOpen={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)} />
      <TextPreviewPopup />
      <MediaPreviewPopup />
    </div>
  );
}
