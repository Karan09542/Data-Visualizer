import React, { useState, useRef, useCallback, useEffect } from 'react';
import EditorPanel from './components/EditorPanel';
import GraphVisualizer from './components/GraphVisualizer';
import Toolbar from './components/Toolbar';
import AdvancedPanel from './components/AdvancedPanel';
import { useStore } from './store/useStore';

export default function App() {
  const [editorWidth, setEditorWidth] = useState(30); // percentage
  const { isEditorPanelOpen } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const startDragging = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopDragging = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  }, []);

  const onDrag = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    if (newWidth > 15 && newWidth < 85) {
      setEditorWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDragging);
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [onDrag, stopDragging]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-slate-300 font-sans overflow-hidden">
      <Toolbar />
      <div ref={containerRef} className="flex-1 w-full overflow-hidden flex relative">
          {isEditorPanelOpen && (
            <>
              <div style={{ width: `${editorWidth}%` }} className="h-full flex-shrink-0">
                <EditorPanel />
              </div>
              
              <div 
                className="w-1.5 h-full bg-[#0d1117] border-x border-slate-800 hover:bg-blue-600 transition-colors cursor-col-resize z-20 flex items-center justify-center group flex-shrink-0"
                onMouseDown={startDragging}
              >
                <div className="h-8 w-0.5 bg-slate-600 group-hover:bg-blue-300 rounded-full transition-colors" />
              </div>
            </>
          )}

          <div className="flex-1 h-full min-w-0">
            <GraphVisualizer />
          </div>
      </div>
      <AdvancedPanel />
    </div>
  );
}
