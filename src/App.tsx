import React, { useState, useRef, useCallback, useEffect } from "react";
import EditorPanel from "./components/EditorPanel";
import GraphVisualizer from "./components/GraphVisualizer";
import Toolbar from "./components/Toolbar";
import DrawingToolbar from "./components/DrawingToolbar";
import AdvancedPanel from "./components/AdvancedPanel";
import ShortcutsPopup from "./components/ShortcutsPopup";
import ShareDialog from "./components/ShareDialog";
import { useStore } from "./store/useStore";
import { useAnnotationStore } from "./store/useAnnotationStore";
import { parseShareUrl } from "./utils/shareUtils";

export default function App() {
  const [editorWidth, setEditorWidth] = useState(30); // percentage
  const { isEditorPanelOpen, setIsEditorPanelOpen, appTheme, setCode } = useStore();
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

  return (
    <div
      className={`${appTheme} flex flex-col h-screen w-screen bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 font-sans overflow-hidden transition-colors`}
    >
      <Toolbar onOpenShare={() => setIsShareDialogOpen(true)} />
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-hidden flex relative"
      >
        {isEditorPanelOpen && (
          <>
            {/* Desktop Editor */}
            <div
              style={{ width: `${editorWidth}%` }}
              className="hidden md:block h-full flex-shrink-0"
            >
              <EditorPanel />
            </div>

            {/* Mobile Editor Overlay */}
            <div
              className="md:hidden absolute top-0 bottom-0 left-0 w-[85%] z-30 shadow-2xl bg-white dark:bg-[#0d1117]"
            >
              <EditorPanel />
            </div>

            {/* Mobile Backdrop */}
            <div 
              className="md:hidden absolute inset-0 z-20 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
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
          <GraphVisualizer />
        </div>
      </div>
      <AdvancedPanel />
      <ShortcutsPopup />
      <ShareDialog isOpen={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)} />
    </div>
  );
}
