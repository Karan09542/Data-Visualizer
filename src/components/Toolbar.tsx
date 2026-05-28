import { useStore, LayoutMode, NodeTheme, EdgeStyle, NodeShape, AppTheme } from '../store/useStore';
import { Download, Minimize, Maximize, Search, Maximize2, RotateCcw, Paintbrush, Settings, PanelLeft, Menu, X, Sun, Moon, Undo2, Redo2, Share2, FolderOpen, ChevronDown, Loader2, Save, CloudOff, Cloud, Sliders, SlidersHorizontal, Network } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { estimateShareSize } from '../utils/shareUtils';
import { useAnnotationStore } from '../store/useAnnotationStore';
import ApiNodeHelpModal from './ApiNodeHelpModal';

export default function Toolbar({ onOpenShare }: { onOpenShare: () => void }) {
  const { 
    layoutMode, setLayoutMode, 
    nodeTheme, setNodeTheme, 
    edgeStyle, setEdgeStyle,
    edgeWidth = 1.0, setEdgeWidth,
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
    code,
    setIsSavedDocsOpen,
    globalTextExpanded,
    setGlobalTextExpanded,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    visualizerMode,
    setVisualizerMode,
    codeFormat,
    convertFormat
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

  const [isApiHelpOpen, setIsApiHelpOpen] = useState(false);

  useEffect(() => {
    // Warm up SnapDOM cache without blocking the main thread
    if (typeof window !== 'undefined') {
      const warmUp = () => {
        import('@zumer/snapdom').then(({ preCache }) => {
          preCache(document, { embedFonts: true }).catch((e) => console.warn('SnapDOM precache failed:', e));
        });
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(warmUp);
      } else {
        setTimeout(warmUp, 2000);
      }
    }
  }, []);

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
  const nodeThemes: NodeTheme[] = ['vscode', 'github', 'glassmorphism', 'cyberpunk', 'minimal', 'gradient', 'pastel', 'terminal', 'material', 'blueprint', 'retro', 'holographic', 'notebook', 'custom', 'nature', 'circuit', 'galaxy', 'glass', 'neon', 'math', 'neural', 'river', 'tree', 'pixel', 'hacker', 'cloud', 'dna', 'lava', 'ocean', 'rhythm', 'rune', 'zen', 'abstract', 'architect', 'ludo', 'chess', 'octopus', 'nature2', 'hydrogen', 'seed', 'banyan', 'peepal'];
  const edgeStyles: EdgeStyle[] = ['curved', 'bezier', 'straight', 'step', 'animated', 'dashed', 'neon', 'double', 'pipe', 'thin', 'orgChart', 'circuit', 'glow', 'zigzag', 'pulse', 'metro', 'angled-step'];
  const nodeShapes: NodeShape[] = ['default', 'circle', 'rectangle', 'triangle', 'hexagon', 'pill', 'diamond', 'parallelogram'];

  const expandAll = () => {
    setCollapsedNodes(new Set());
    window.dispatchEvent(new CustomEvent('schema-expand-all'));
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
    window.dispatchEvent(new CustomEvent('schema-collapse-all'));
  };

  const formatCode = () => {
    window.dispatchEvent(new CustomEvent('format-editor'));
  };

  const [showEdgeWidthPopover, setShowEdgeWidthPopover] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number } | null>(null);

  const handleEdgeWidthButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Position below button; make sure it does not overflow viewport width
    const leftVal = Math.max(10, Math.min(rect.left - 100, window.innerWidth - 240));
    setPopoverCoords({
      top: rect.bottom + window.scrollY + 6,
      left: leftVal
    });
    setShowEdgeWidthPopover(!showEdgeWidthPopover);
  };
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string>('Preparing graph snapshot...');

  const exportHDImage = async (rawType: string = 'png') => {
    let type = rawType;
    let isTransparent = false;
    
    if (rawType.endsWith('-transparent')) {
      isTransparent = true;
      type = rawType.replace('-transparent', '');
    }

    setIsExporting(true);
    setExportStatus('Preparing export...');

    // Wait for React to render the loader UI
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

    if (visualizerMode === 'schema') {
      const sourceEl = document.getElementById('schema-export-wrapper');
      if (!sourceEl) {
        setIsExporting(false);
        return;
      }

      // Store variables to restore in finally
      let originalPos = '';
      let originalW = '';
      let originalH = '';
      let originalZ = '';
      let originalViewportTransform = '';
      let originalViewportTransition = '';
      let originalDrawingTransform = '';
      let originalBgColor = '';
      let originalReactFlowBg = '';
      let hadBgClassLight = false;
      let hadBgClassDark = false;
      let viewportEl: HTMLElement | null = null;
      let drawingGEl: HTMLElement | null = null;
      let reactFlowEl: HTMLElement | null = null;
      let noExportEls: Element[] = [];
      let originalDisplays: string[] = [];
      let overrideApplied = false;

      try {
        setExportStatus('Expanding schema fields...');
        // Expand all fields for export
        useStore.getState().setSchemaExportActive(true);
        // Wait for React to render and update layout sizes
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 350)));

        setExportStatus('Preparing viewport layout...');
        viewportEl = sourceEl.querySelector('.react-flow__viewport') as HTMLElement | null;
        drawingGEl = sourceEl.querySelector('#schema-drawing-g') as HTMLElement | null;
        reactFlowEl = sourceEl.querySelector('.react-flow') as HTMLElement | null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const nodeElements = Array.from(sourceEl.querySelectorAll('.react-flow__node')) as HTMLElement[];
        
        const hasNodes = nodeElements.length > 0 && !!viewportEl;
        let fullWidth = 1200;
        let fullHeight = 800;
        const padding = 60;

        if (hasNodes && viewportEl) {
          nodeElements.forEach(nodeEl => {
            const transformStr = nodeEl.style.transform || '';
            let match = transformStr.match(/translate(?:3d)?\(([-.\d]+)px,\s*([-.\d]+)px/);
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
        hadBgClassLight = sourceEl.classList.contains('bg-slate-50');
        hadBgClassDark = sourceEl.classList.contains('dark:bg-[#07090e]');

        if (reactFlowEl) {
          originalReactFlowBg = reactFlowEl.style.backgroundColor;
        }

        if (viewportEl) {
          originalViewportTransform = viewportEl.style.transform;
          originalViewportTransition = viewportEl.style.transition;
          viewportEl.style.transition = 'none';
        }

        if (drawingGEl) {
          originalDrawingTransform = drawingGEl.getAttribute('transform') || '';
          drawingGEl.style.transition = 'none';
        }

        // Hide no-export elements
        let queryStr = '.no-export, [data-capture-exclude], .react-flow__controls, .react-flow__panel, .react-flow__minimap';
        if (isTransparent) {
          queryStr += ', .react-flow__background';
        }
        noExportEls = Array.from(sourceEl.querySelectorAll(queryStr));
        originalDisplays = noExportEls.map((el) => (el as HTMLElement).style.display);
        noExportEls.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        sourceEl.classList.add('export-mode-override');

        // Apply temporary layout at full size and 1:1 scale
        sourceEl.style.position = 'fixed';
        sourceEl.style.top = '0';
        sourceEl.style.left = '0';
        sourceEl.style.width = `${fullWidth}px`;
        sourceEl.style.height = `${fullHeight}px`;
        sourceEl.style.zIndex = '-9999';

        if (isTransparent) {
          sourceEl.classList.remove('bg-slate-50', 'dark:bg-[#07090e]');
          sourceEl.style.backgroundColor = 'transparent';
          if (reactFlowEl) {
            reactFlowEl.style.backgroundColor = 'transparent';
          }
        }

        if (hasNodes && viewportEl) {
          viewportEl.style.transform = `translate(${padding - minX}px, ${padding - minY}px) scale(1)`;
          if (drawingGEl) {
            drawingGEl.setAttribute('transform', `translate(${padding - minX}, ${padding - minY}) scale(1)`);
          }
        }

        overrideApplied = true;

        // Give browser a frame to layout
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 200)));

        setExportStatus('Rendering Snapshot...');
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

        const { snapdom } = await import('@zumer/snapdom');

        const options = {
          exclude: ['.no-export', '.node-query-engine', '[data-capture-exclude]', '.react-flow__controls', '.react-flow__panel', '.react-flow__minimap'],
          compress: true,
          scale: type === 'svg' ? 1 : 2,
          quality: 1,
          backgroundColor: (type === 'jpeg' && (useStore.getState().canvasBackgroundColor === 'transparent' || !useStore.getState().canvasBackgroundColor)) 
            ? '#ffffff' 
            : isTransparent ? 'transparent' : (useStore.getState().canvasBackgroundColor || (useStore.getState().appTheme === 'dark' ? '#07090e' : '#f8fafc')),
          width: fullWidth,
          height: fullHeight,
          format: type === 'jpeg' ? 'jpg' : type,
          filename: `schema-visualizer-hd${isTransparent ? '-transparent' : ''}`,
        };

        await snapdom.download(sourceEl, options);

        setExportStatus('Finalizing export...');
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

      } catch (err) {
        console.error('Schema Export failed:', err);
        alert('Failed to export schema visualizer.');
      } finally {
        if (overrideApplied) {
          // Restore
          sourceEl.style.position = originalPos;
          sourceEl.style.width = originalW;
          sourceEl.style.height = originalH;
          sourceEl.style.zIndex = originalZ;

          if (isTransparent) {
            if (hadBgClassLight) sourceEl.classList.add('bg-slate-50');
            if (hadBgClassDark) sourceEl.classList.add('dark:bg-[#07090e]');
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
              drawingGEl.setAttribute('transform', originalDrawingTransform);
            } else {
              drawingGEl.removeAttribute('transform');
            }
            drawingGEl.style.transition = '';
          }

          sourceEl.classList.remove('export-mode-override');

          noExportEls.forEach((el, index) => {
            (el as HTMLElement).style.display = originalDisplays[index];
          });
        }
        useStore.getState().setSchemaExportActive(false);
        setIsExporting(false);
      }
      return;
    }

    const sourceEl = document.getElementById('graph-export-wrapper');
    const svgEl = document.querySelector('.graph-svg') as SVGSVGElement | null;
    const gEl = document.querySelector('.graph-g') as SVGGElement | null;
    
    if (!sourceEl || !svgEl || !gEl) {
      setIsExporting(false);
      return;
    }
    
    let originalExpanded = useStore.getState().globalTextExpanded;

    try {
      if (!originalExpanded) {
        setExportStatus('Expanding geometry...');
        setGlobalTextExpanded(true);
        // Wait for React update and D3 bounds recalculation
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 350)));
      }

      setExportStatus('Optimizing capture...');
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

      const { snapdom } = await import('@zumer/snapdom');
      
      // Temporarily remove transition to prevent animation during snapshot
      sourceEl.style.transition = 'none';
      gEl.style.transition = 'none';

      const themeRect = gEl.querySelector('.canvas-theme-rect') as SVGRectElement | null;
      if (themeRect) themeRect.style.display = 'none';
      
      const bbox = gEl.getBBox();
      const padding = 60;
      
      if (themeRect) themeRect.style.display = '';

      const fullWidth = Math.max(bbox.width + padding * 2, 800);
      const fullHeight = Math.max(bbox.height + padding * 2, 600);

      const originalThemeRectX = themeRect?.getAttribute('x') || '-100000';
      const originalThemeRectY = themeRect?.getAttribute('y') || '-100000';
      const originalThemeRectW = themeRect?.getAttribute('width') || '200000';
      const originalThemeRectH = themeRect?.getAttribute('height') || '200000';

      if (themeRect) {
        themeRect.setAttribute('x', String(bbox.x - padding));
        themeRect.setAttribute('y', String(bbox.y - padding));
        themeRect.setAttribute('width', String(fullWidth));
        themeRect.setAttribute('height', String(fullHeight));
      }

      // Save original styles to restore later
      const originalPos = sourceEl.style.position;
      const originalW = sourceEl.style.width;
      const originalH = sourceEl.style.height;
      const originalZ = sourceEl.style.zIndex;
      const originalTransform = gEl.getAttribute('transform');

      // Temporarily modify the live DOM so snapdom reads computed styles accurately
      // We make it slightly cover the screen, but z-index it so it overlays or works underneath
      sourceEl.style.position = 'fixed';
      sourceEl.style.top = '0';
      sourceEl.style.left = '0';
      sourceEl.style.width = `${fullWidth}px`;
      sourceEl.style.height = `${fullHeight}px`;
      sourceEl.style.zIndex = '-9999';

      gEl.setAttribute('transform', `translate(${padding - bbox.x}, ${padding - bbox.y}) scale(1)`);

      // Hide no-export elements
      let queryStr = '.no-export, [data-capture-exclude]';
      if (isTransparent) {
        queryStr += ', #graph-background-layer';
      }
      const noExportEls = Array.from(sourceEl.querySelectorAll(queryStr));
      const originalDisplays = noExportEls.map((el) => (el as HTMLElement).style.display);
      noExportEls.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      
      sourceEl.classList.add('export-mode-override');

      // Give browser a frame to layout and fetch images
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 200)));

      setExportStatus('Rendering Snapshot...');
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

      const options = {
        exclude: ['.no-export', '.node-query-engine', '[data-capture-exclude]'],
        compress: true,
        scale: type === 'svg' ? 1 : 2,
        quality: 1,
        backgroundColor: (type === 'jpeg' && (useStore.getState().canvasBackgroundColor === 'transparent' || !useStore.getState().canvasBackgroundColor)) 
          ? '#ffffff' 
          : isTransparent ? 'transparent' : (useStore.getState().canvasBackgroundColor || (useStore.getState().appTheme === 'dark' ? '#0d1117' : '#ffffff')),
        width: fullWidth,
        height: fullHeight,
        format: type === 'jpeg' ? 'jpg' : type,
        filename: `json-graph-hd${isTransparent ? '-transparent' : ''}`,
      };

      await snapdom.download(sourceEl, options);
      
      setExportStatus('Finalizing export...');
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
        
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

      if (themeRect) {
        themeRect.setAttribute('x', originalThemeRectX);
        themeRect.setAttribute('y', originalThemeRectY);
        themeRect.setAttribute('width', originalThemeRectW);
        themeRect.setAttribute('height', originalThemeRectH);
      }

      sourceEl.classList.remove('export-mode-override');

      noExportEls.forEach((el, index) => {
        (el as HTMLElement).style.display = originalDisplays[index];
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export graph.');
    } finally {
      if (!originalExpanded) {
        setGlobalTextExpanded(false);
      }
      setIsExporting(false);
    }
  };

  return (
    <>
      {isExporting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 flex flex-col items-center max-w-sm w-full mx-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Exporting...</h3>
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
          <div className="flex items-center gap-2 xl:gap-5 lg:gap-3">
            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Mode</label>
              <select 
                value={visualizerMode} 
                onChange={(e) => setVisualizerMode(e.target.value as any)}
                className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
              >
                <option value="graph">Graph</option>
                <option value="schema">Schema</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Format</label>
              <select 
                value={codeFormat} 
                onChange={(e) => convertFormat(e.target.value as any)}
                className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
              >
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Layout</label>
              <select 
                value={layoutMode} 
                onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
              >
                {layoutModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Theme</label>
              <select 
                value={nodeTheme} 
                onChange={(e) => setNodeTheme(e.target.value as NodeTheme)}
                className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
              >
                {nodeThemes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Edge</label>
              <div className="flex items-center gap-1.5">
                <select 
                  value={edgeStyle} 
                  onChange={(e) => setEdgeStyle(e.target.value as EdgeStyle)}
                  className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
                >
                  {edgeStyles.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button
                  onClick={handleEdgeWidthButtonClick}
                  className={`p-1 rounded border border-slate-200 dark:border-slate-800/60 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 ${showEdgeWidthPopover ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : ''}`}
                  title="Adjust edge/link line width"
                >
                  <SlidersHorizontal size={13} />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800/80 pr-3 lg:pr-5 flex-shrink-0 group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Shape</label>
              <select 
                value={nodeShape} 
                onChange={(e) => setNodeShape(e.target.value as NodeShape)}
                className="bg-transparent font-semibold shadow-sm border border-slate-200 dark:border-slate-800/60 cursor-pointer rounded px-1.5 py-0.5 outline-none text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-1 focus:ring-blue-500/30 text-xs"
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
              <button 
                onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                className={`flex items-center gap-1.5 p-1.5 px-2.5 rounded-md transition-colors border hover:-translate-y-px mr-1 ${isAutosaveEnabled ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' : 'bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`} 
                title={isAutosaveEnabled ? "Autosave is On" : "Turn On Autosave"}
              >
                {isAutosaveEnabled ? <Cloud size={14} /> : <CloudOff size={14} />}
                <span className="text-xs font-semibold">{isAutosaveEnabled ? 'Autosave On' : 'Autosave Off'}</span>
              </button>
              <button 
                onClick={() => setIsSavedDocsOpen(true)}
                className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border border-slate-300 dark:border-slate-700 hover:-translate-y-px mr-2" 
                title="Saved Documents"
              >
                <FolderOpen size={14} />
                <span className="text-xs font-semibold">Saved</span>
              </button>
              <button 
                onClick={() => setIsApiHelpOpen(true)}
                className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/25 hover:-translate-y-px mr-2 relative overflow-hidden group/api-btn" 
                title="Interactive API Nodes Integrations Guide"
              >
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -translate-x-full group-hover/api-btn:animate-[shimmer_2s_infinite]" />
                <Network size={14} className="animate-pulse" />
                <span className="text-xs font-semibold">API Nodes</span>
                <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </button>
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
               <div className="flex items-center pr-2 border-r border-slate-300 dark:border-slate-800">
                 <button onClick={formatCode} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors" title="Format JSON/YAML">
                   <Paintbrush size={16} />
                 </button>
               </div>
               <div className="flex items-center gap-1 pl-1">
                 <div className="relative inline-flex group hover:-translate-y-px transition-transform">
                   <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-md bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors pointer-events-none border border-slate-300 dark:border-slate-700">
                     <Download size={14} />
                     <span className="text-xs font-semibold">{isExporting ? '...' : 'Export'}</span>
                     <ChevronDown size={14} className="opacity-50" />
                   </div>
                   <select
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                     onChange={(e) => {
                       if (e.target.value) {
                         exportHDImage(e.target.value as any);
                         e.target.value = '';
                       }
                     }}
                     value=""
                     disabled={isExporting}
                   >
                     <option value="" disabled className="hidden">{isExporting ? 'Exporting...' : 'Select Format'}</option>
                     <option value="png" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">PNG (HD)</option>
<option value="png-transparent" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">PNG (Transparent)</option>
<option value="jpeg" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">JPEG (HD)</option>
<option value="svg" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Vector SVG</option>
<option value="svg-transparent" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Vector SVG (Transparent)</option>
<option value="webp" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">WebP</option>
                   </select>
                 </div>
               </div>
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
            className="lg:hidden fixed inset-0 z-[490]" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="lg:hidden absolute top-[57px] left-0 right-0 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-300 dark:border-slate-800 z-[495] shadow-xl overflow-y-auto max-h-[80vh] custom-scrollbar">
            <div className="p-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Format</label>
              <select 
                value={codeFormat} 
                onChange={(e) => convertFormat(e.target.value as any)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-300 text-sm"
              >
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </select>
            </div>

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

            <div className="col-span-2 mt-4 pt-4 border-t border-slate-300 dark:border-slate-800 flex flex-col gap-3">
               <button 
                 onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                 className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-md transition-colors text-sm font-medium ${isAutosaveEnabled ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-m shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
               >
                 {isAutosaveEnabled ? <Cloud size={16} /> : <CloudOff size={16} />} 
                 {isAutosaveEnabled ? 'Autosave is On' : 'Turn On Autosave'}
               </button>
               <button 
                 onClick={() => { setIsMobileMenuOpen(false); setIsSavedDocsOpen(true); }} 
                 className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
               >
                 <FolderOpen size={16} /> Saved Documents
               </button>
            </div>

            <div className="col-span-2 mt-4 pt-4 border-t border-slate-300 dark:border-slate-800">
               <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Appearance & Sharing</label>
               <div className="flex flex-col gap-3">
                  <button onClick={toggleTheme} className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                    {appTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} 
                    {appTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <button 
                    onClick={() => { setIsMobileMenuOpen(false); onOpenShare(); }} 
                    className="w-full flex items-center justify-center gap-2 p-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-m shadow-blue-500/20 active:scale-95"
                  >
                    <Share2 size={16} /> Share Tool
                    <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[9px] uppercase tracking-tighter">
                      <div className={`w-1.5 h-1.5 rounded-full ${shareIndicator?.color}`} />
                      {shareIndicator?.label}
                    </div>
                  </button>
               </div>
            </div>
            
            <div className="col-span-2 mt-2 pt-4 border-t border-slate-300 dark:border-slate-800">
               <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Download & Export</label>
               <div className="relative flex group">
                 <div className="flex w-full items-center justify-between p-2.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors pointer-events-none border border-transparent">
                   <div className="flex items-center gap-2">
                      <Download size={16} />
                      <span className="text-sm font-medium">{isExporting ? 'Exporting...' : 'Export Image'}</span>
                   </div>
                   <ChevronDown size={16} className="opacity-50" />
                 </div>
                 <select
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                   onChange={(e) => {
                     if (e.target.value) {
                       exportHDImage(e.target.value as any);
                       e.target.value = '';
                     }
                   }}
                   value=""
                   disabled={isExporting}
                 >
                   <option value="" disabled className="hidden">{isExporting ? 'Exporting...' : 'Select Format to Download'}</option>
                   <option value="png" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">PNG (HD)</option>
<option value="png-transparent" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">PNG (Transparent)</option>
<option value="jpeg" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">JPEG (HD)</option>
<option value="svg" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Vector SVG</option>
<option value="svg-transparent" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Vector SVG (Transparent)</option>
<option value="webp" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">WebP</option>
                 </select>
               </div>
            </div>
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
              left: `${popoverCoords.left}px` 
            }}
            className="fixed p-3.5 w-56 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-[1010] flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span className="text-slate-800 dark:text-slate-200 font-semibold">Edge Line Width</span>
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

      <ApiNodeHelpModal isOpen={isApiHelpOpen} onClose={() => setIsApiHelpOpen(false)} />
    </>
  );
}
