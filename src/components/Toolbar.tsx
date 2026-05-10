import { useStore, LayoutMode, NodeTheme, EdgeStyle, NodeShape, AppTheme } from '../store/useStore';
import { Download, Minimize, Maximize, Search, Maximize2, RotateCcw, Paintbrush, Settings, PanelLeft, Menu, X, Sun, Moon, Undo2, Redo2, Share2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { estimateShareSize } from '../utils/shareUtils';
import { useAnnotationStore } from '../store/useAnnotationStore';

export default function Toolbar({ onOpenShare }: { onOpenShare: () => void }) {
  const { 
    layoutMode, setLayoutMode, 
    nodeTheme, setNodeTheme, 
    edgeStyle, setEdgeStyle,
    nodeShape, setNodeShape,
    searchQuery, setSearchQuery,
    treeData,
    setCollapsedNodes,
    isEditorPanelOpen,
    setIsEditorPanelOpen,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    appTheme,
    setAppTheme,
    setCanvasBackgroundColor,
    setCanvasPatternColor,
    canvasBackgroundColor,
    canvasPatternColor,
    undo,
    redo,
    undoStack,
    redoStack,
    code
  } = useStore();

  const { annotations } = useAnnotationStore();

  const shareSizeInfo = useMemo(() => {
    return estimateShareSize(code, {
      layoutMode,
      nodeTheme,
      edgeStyle,
      nodeShape,
      appTheme,
      canvasBackgroundColor,
      canvasPatternColor
    }, annotations);
  }, [code, layoutMode, nodeTheme, edgeStyle, nodeShape, appTheme, canvasBackgroundColor, canvasPatternColor, annotations]);

  const shareIndicator = useMemo(() => {
    switch (shareSizeInfo.status) {
      case 'safe': return { color: 'bg-green-500', label: 'Small' };
      case 'moderate': return { color: 'bg-yellow-500', label: 'Medium' };
      case 'large': return { color: 'bg-orange-500', label: 'Large' };
      case 'unsafe': return { color: 'bg-red-500', label: 'Too Large' };
    }
  }, [shareSizeInfo.status]);

  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        setSearchQuery(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery, searchQuery]);

  const toggleTheme = () => {
    if (appTheme === 'dark') {
      setAppTheme('light');
      setCanvasBackgroundColor('#f8fafc');
      setCanvasPatternColor('rgba(51, 65, 85, 0.15)');
    } else {
      setAppTheme('dark');
      setCanvasBackgroundColor('#0d1117');
      setCanvasPatternColor('rgba(148, 163, 184, 0.15)');
    }
  };

  const layoutModes: LayoutMode[] = ['vertical', 'horizontal', 'radial', 'force', 'compact', 'mindmap'];
  const nodeThemes: NodeTheme[] = ['vscode', 'github', 'glassmorphism', 'cyberpunk', 'minimal', 'gradient', 'pastel', 'terminal', 'material', 'blueprint', 'retro', 'holographic', 'notebook'];
  const edgeStyles: EdgeStyle[] = ['curved', 'bezier', 'straight', 'step', 'animated', 'dashed', 'neon', 'double', 'pipe', 'thin', 'orgChart', 'circuit', 'glow', 'zigzag', 'pulse'];
  const nodeShapes: NodeShape[] = ['default', 'circle', 'rectangle', 'triangle', 'hexagon', 'pill', 'diamond', 'parallelogram'];

  const expandAll = () => {
    setCollapsedNodes(new Set());
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
  };

  const formatCode = () => {
    window.dispatchEvent(new CustomEvent('format-editor'));
  };

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const exportHDImage = async (type: 'png' | 'svg' = 'png') => {
    const sourceEl = document.getElementById('graph-export-wrapper');
    const svgEl = document.querySelector('.graph-svg') as SVGSVGElement | null;
    const gEl = document.querySelector('.graph-g') as SVGGElement | null;
    
    if (!sourceEl || !svgEl || !gEl) return;
    
    setIsExporting(true);
    try {
      const htmlToImage = await import('html-to-image');
      
      // Temporarily remove transition to prevent animation during snapshot
      sourceEl.style.transition = 'none';
      gEl.style.transition = 'none';

      const bbox = gEl.getBBox();
      const padding = 60;
      
      const fullWidth = Math.max(bbox.width + padding * 2, 800);
      const fullHeight = Math.max(bbox.height + padding * 2, 600);

      // Save original styles to restore later
      const originalPos = sourceEl.style.position;
      const originalW = sourceEl.style.width;
      const originalH = sourceEl.style.height;
      const originalZ = sourceEl.style.zIndex;
      const originalTransform = gEl.getAttribute('transform');

      // Temporarily modify the live DOM so html-to-image reads computed styles accurately
      // We make it slightly cover the screen, but z-index it so it overlays or works underneath
      sourceEl.style.position = 'fixed';
      sourceEl.style.top = '0';
      sourceEl.style.left = '0';
      sourceEl.style.width = `${fullWidth}px`;
      sourceEl.style.height = `${fullHeight}px`;
      sourceEl.style.zIndex = '-9999';

      gEl.setAttribute('transform', `translate(${padding - bbox.x}, ${padding - bbox.y}) scale(1)`);

      // Hide no-export elements
      const noExportEls = Array.from(sourceEl.querySelectorAll('.no-export'));
      const originalDisplays = noExportEls.map((el) => (el as HTMLElement).style.display);
      noExportEls.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

      // Give browser a frame to layout
      await new Promise(resolve => setTimeout(resolve, 100));

      const filter = (node: HTMLElement) => {
        if (node.classList && typeof node.classList.contains === 'function') {
           return !node.classList.contains('no-export');
        }
        return true;
      };

      const options = {
        filter: filter as any,
        pixelRatio: type === 'png' ? 2 : 1,
        quality: 1,
        backgroundColor: useStore.getState().canvasBackgroundColor,
        width: fullWidth,
        height: fullHeight,
        style: {
          transform: 'none',
        }
      };

      const dataUrl = type === 'png' 
        ? await htmlToImage.toPng(sourceEl, options)
        : await htmlToImage.toSvg(sourceEl, options);
        
      // Restore everything
      sourceEl.style.position = originalPos;
      sourceEl.style.width = originalW;
      sourceEl.style.height = originalH;
      sourceEl.style.zIndex = originalZ;
      sourceEl.style.transition = '';
      gEl.style.transition = '';

      if (originalTransform) {
        gEl.setAttribute('transform', originalTransform);
      } else {
        gEl.removeAttribute('transform');
      }

      noExportEls.forEach((el, index) => {
        (el as HTMLElement).style.display = originalDisplays[index];
      });
      
      const link = document.createElement("a");
      link.download = `json-graph-hd.${type}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export graph.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-[#0d1117] border-b border-slate-300 dark:border-slate-800 text-sm shadow-sm select-none z-40 relative transition-colors">
        <div className="flex items-center gap-3 mr-2 lg:border-r border-slate-300 dark:border-slate-800 lg:pr-4 flex-shrink-0">
          <button 
            onClick={() => setIsEditorPanelOpen(!isEditorPanelOpen)}
            className={`p-1.5 rounded transition-colors ${isEditorPanelOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
            title="Toggle Editor Panel"
          >
            <PanelLeft size={18} />
          </button>
          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            JSON Graph Viewer
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-1 xl:gap-4 lg:gap-2">
            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <label className="text-slate-500 dark:text-slate-400">Layout</label>
              <select 
                value={layoutMode} 
                onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 transition-colors"
              >
                {layoutModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <label className="text-slate-500 dark:text-slate-400">Theme</label>
              <select 
                value={nodeTheme} 
                onChange={(e) => setNodeTheme(e.target.value as NodeTheme)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 transition-colors"
              >
                {nodeThemes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <label className="text-slate-500 dark:text-slate-400">Edge</label>
              <select 
                value={edgeStyle} 
                onChange={(e) => setEdgeStyle(e.target.value as EdgeStyle)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 transition-colors"
              >
                {edgeStyles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <label className="text-slate-500 dark:text-slate-400">Shape</label>
              <select 
                value={nodeShape} 
                onChange={(e) => setNodeShape(e.target.value as NodeShape)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 transition-colors"
              >
                {nodeShapes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 xl:gap-4 lg:gap-2">
            <div className="flex items-center space-x-2 border-r border-slate-300 dark:border-slate-800 pr-2 xl:pr-4 flex-shrink-0">
              <button onClick={expandAll} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Expand All">
                <Maximize size={16} />
              </button>
              <button onClick={collapseAll} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Collapse All">
                <Minimize size={16} />
              </button>
              <button id="fit-graph-btn" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Fit to Screen">
                <Maximize2 size={16} />
              </button>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 border-r border-slate-300 dark:border-slate-800 pr-2">
              <button 
                onClick={undo} 
                disabled={undoStack.length === 0}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button 
                onClick={redo} 
                disabled={redoStack.length === 0}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 border-r border-slate-300 dark:border-slate-800 pr-4">
              <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Toggle Theme">
                {appTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button 
                onClick={onOpenShare} 
                className="flex items-center gap-2 p-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-all shadow-sm shadow-blue-500/20 active:scale-95" 
                title="Share via URL"
              >
                <Share2 size={16} />
                <span>Share</span>
                <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[9px] uppercase tracking-tighter">
                  <div className={`w-1.5 h-1.5 rounded-full ${shareIndicator?.color}`} />
                  {shareIndicator?.label}
                </div>
              </button>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <button onClick={formatCode} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Format JSON/YAML">
                <Paintbrush size={16} />
              </button>
              <button disabled={isExporting} onClick={() => exportHDImage('png')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors flex items-center space-x-1" title="Export High-Res PNG">
                <Download size={16} />
                <span className="text-xs font-semibold">{isExporting ? '...' : 'PNG'}</span>
              </button>
              <button disabled={isExporting} onClick={() => exportHDImage('svg')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors flex items-center space-x-1" title="Export Vector SVG">
                <Download size={16} />
                <span className="text-xs font-semibold">{isExporting ? '...' : 'SVG'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:hidden">
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
            className="lg:hidden fixed inset-0 z-20" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="lg:hidden absolute top-[57px] left-0 right-0 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-300 dark:border-slate-800 z-30 shadow-xl overflow-y-auto max-h-[80vh]">
            <div className="p-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Layout</label>
              <select 
                value={layoutMode} 
                onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 text-sm"
              >
                {layoutModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Theme</label>
              <select 
                value={nodeTheme} 
                onChange={(e) => setNodeTheme(e.target.value as NodeTheme)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 text-sm"
              >
                {nodeThemes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Edge Style</label>
              <select 
                value={edgeStyle} 
                onChange={(e) => setEdgeStyle(e.target.value as EdgeStyle)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 text-sm"
              >
                {edgeStyles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Node Shape</label>
              <select 
                value={nodeShape} 
                onChange={(e) => setNodeShape(e.target.value as NodeShape)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 text-sm"
              >
                {nodeShapes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="col-span-2 mt-2 pt-4 border-t border-slate-300 dark:border-slate-800 grid grid-cols-2 gap-3">
               <button 
                 onClick={undo} 
                 disabled={undoStack.length === 0}
                 className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-30"
               >
                 <Undo2 size={16} /> Undo
               </button>
               <button 
                 onClick={redo} 
                 disabled={redoStack.length === 0}
                 className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-30"
               >
                 <Redo2 size={16} /> Redo
               </button>
            </div>

            <div className="col-span-2 mt-2 pt-4 border-t border-slate-300 dark:border-slate-800 grid grid-cols-2 gap-3">
               <button onClick={expandAll} className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                 <Maximize size={16} /> Expand All
               </button>
               <button onClick={collapseAll} className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                 <Minimize size={16} /> Collapse All
               </button>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-3">
               <button onClick={() => { const btnId=document.getElementById('fit-graph-btn'); if(btnId) btnId.click(); }} className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                 <Maximize2 size={16} /> Fit View
               </button>
               <button onClick={formatCode} className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                 <Paintbrush size={16} /> Format
               </button>
            </div>

            <div className="col-span-2 mt-1 -mb-1">
               <button onClick={toggleTheme} className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                 {appTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} 
                 {appTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
               </button>
            </div>
            
            <div className="col-span-2 mt-1 grid grid-cols-2 gap-3">
               <button disabled={isExporting} onClick={() => exportHDImage('png')} className="w-full flex items-center justify-center gap-2 p-2.5 bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-600/30 transition-colors text-sm font-medium">
                 <Download size={16} /> {isExporting ? '...' : 'PNG (HD)'}
               </button>
               <button disabled={isExporting} onClick={() => exportHDImage('svg')} className="w-full flex items-center justify-center gap-2 p-2.5 bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-md hover:bg-purple-600/30 transition-colors text-sm font-medium">
                 <Download size={16} /> {isExporting ? '...' : 'SVG'}
               </button>
            </div>
          </div>
        </div>
        </>
      )}
    </>
  );
}
