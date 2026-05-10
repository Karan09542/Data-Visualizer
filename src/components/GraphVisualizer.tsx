import { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useStore } from '../store/useStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { computeLayout, getEdgePath } from '../utils/layout';
import { TreeNode } from '../utils/transformer';
import NodeRenderer from './NodeRenderer';
import EdgeRenderer from './EdgeRenderer';
import AnnotationRenderer from './AnnotationRenderer';
import { useDrawingSystem } from '../hooks/useDrawingSystem';
import { Copy, Edit2, Trash2, X, Search, Settings } from 'lucide-react';

export default function GraphVisualizer() {
  const { 
    treeData, collapsedNodes, layoutMode, edgeStyle, 
    searchQuery, searchMatches, searchAncestors,
    selectedNodeId, setSelectedNodeId, dragOverrides,
    nodeShape, nodeSpread, nodeSize, 
    canvasTheme, canvasBackgroundColor, canvasPatternColor,
    canvasBackgroundImage, canvasBackgroundBlur,
    appTheme
  } = useStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgGRef = useRef<SVGGElement>(null);

  useDrawingSystem(wrapperRef);

  const { nodes: originalNodes, links: originalLinks } = useMemo(() => {
    return computeLayout(treeData, collapsedNodes, layoutMode, nodeShape, nodeSpread, nodeSize);
  }, [treeData, collapsedNodes, layoutMode, nodeShape, nodeSpread, nodeSize]);

  const { nodes, links } = useMemo(() => {
    // Check if we have overrides at all
    if (Object.keys(dragOverrides).length === 0) {
       return { nodes: originalNodes, links: originalLinks };
    }

    // Apply drag overrides
    const overridenNodes = originalNodes.map(n => {
      const override = dragOverrides[n.data.id];
      if (override) {
        // Create a shallow copy keeping prototype functions like .ancestors() working
        const copy = Object.assign(Object.create(Object.getPrototypeOf(n)), n);
        copy.x = override.x;
        copy.y = override.y;
        return copy;
      }
      return n;
    });

    const nodeById = new Map(overridenNodes.map(n => [n.data.id, n]));
    
    const overridenLinks = originalLinks.map(l => ({
       source: nodeById.get(l.source.data.id)!,
       target: nodeById.get(l.target.data.id)!
    }));

    return { nodes: overridenNodes, links: overridenLinks };
  }, [originalNodes, originalLinks, dragOverrides]);

  const selectedPathNodes = useMemo(() => {
    const set = new Set<string>();
    if (selectedNodeId) {
      const selected = nodes.find(n => n.data.id === selectedNodeId);
      if (selected) {
        selected.ancestors().forEach(n => set.add(n.data.id));
      }
    }
    return set;
  }, [nodes, selectedNodeId]);

  const selectedPathEdges = useMemo(() => {
    const set = new Set<string>();
    if (selectedNodeId) {
      const selected = nodes.find(n => n.data.id === selectedNodeId);
      if (selected) {
         const ancestors = selected.ancestors();
         for(let i=0; i < ancestors.length - 1; i++) {
            set.add(`${ancestors[i+1].data.id}->${ancestors[i].data.id}`);
         }
      }
    }
    return set;
  }, [nodes, selectedNodeId]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: TreeNode } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const rect = contextMenuRef.current.getBoundingClientRect();
      const x = contextMenu.x;
      const y = contextMenu.y;
      
      let newX = x;
      let newY = y;
      
      if (x + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 10;
      }
      if (y + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 10;
      }
      
      newX = Math.max(10, newX);
      newY = Math.max(10, newY);
      
      if (newX !== x || newY !== y) {
        contextMenuRef.current.style.left = `${newX}px`;
        contextMenuRef.current.style.top = `${newY}px`;
      }
    }
  }, [contextMenu]);

  const [editingNode, setEditingNode] = useState<{ node: TreeNode, value: string, action: 'edit' | 'add', newKey?: string, typeOverride?: string } | null>(null);

  const [localSearch, setLocalSearch] = useState(searchQuery);

  const lastTwoFingerTap = useRef<number>(0);
  const twoFingerTapTimeout = useRef<NodeJS.Timeout | null>(null);

  const processUndoRedoGesture = () => {
    const now = Date.now();
    const isDrawingMode = useAnnotationStore.getState().isToolbarVisible;

    if (now - lastTwoFingerTap.current < 300) {
      // Double tap => redo
      if (twoFingerTapTimeout.current) {
        clearTimeout(twoFingerTapTimeout.current);
        twoFingerTapTimeout.current = null;
      }
      if (isDrawingMode) {
        useAnnotationStore.getState().redo();
      } else {
        useStore.getState().redo();
      }
      lastTwoFingerTap.current = 0; // reset
    } else {
      // Single tap => maybe undo
      lastTwoFingerTap.current = now;
      twoFingerTapTimeout.current = setTimeout(() => {
        if (isDrawingMode) {
          useAnnotationStore.getState().undo();
        } else {
          useStore.getState().undo();
        }
        twoFingerTapTimeout.current = null;
      }, 300);
    }
  };

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onNativeTouchStart = (e: TouchEvent) => {
      // Use capture mode to run before d3 intercepts the event
      if (e.touches.length === 2) {
        processUndoRedoGesture();
      }
    };

    el.addEventListener('touchstart', onNativeTouchStart, { capture: true });
    return () => {
      el.removeEventListener('touchstart', onNativeTouchStart, { capture: true });
    };
  }, []);

  const handleBackgroundContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    processUndoRedoGesture();
  };

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        useStore.getState().setSearchQuery(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery]);

  const hasCentered = useRef(false);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const lastSearchQuery = useRef<string>('');

  useEffect(() => {
    if (!wrapperRef.current || !svgGRef.current) return;

    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .filter((e) => {
        const { activeTool } = useAnnotationStore.getState();
        if (activeTool !== 'select' && e.type !== 'wheel') {
          return false;
        }
        return (!e.ctrlKey || e.type === 'wheel') && !e.button;
      })
      .scaleExtent([0.1, 4])
      .on('zoom', (e) => {
        if (svgGRef.current) {
          const transform = e.transform;
          svgGRef.current.setAttribute('transform', transform.toString());
        }
      });
      
    zoomRef.current = zoom;

    const selection = d3.select(wrapperRef.current);
    selection.call(zoom);

    // Initial centering only once
    if (nodes.length > 0 && !hasCentered.current) {
      if (wrapperRef.current) {
        const xExtent = d3.extent(nodes, d => (d as any).x) as [number, number];
        const yExtent = d3.extent(nodes, d => (d as any).y) as [number, number];
        const width = xExtent[1] - xExtent[0] || 1;
        const height = yExtent[1] - yExtent[0] || 1;
        const cw = wrapperRef.current!.clientWidth;
        const ch = wrapperRef.current!.clientHeight;
        const scale = Math.min(cw / (width + 300), ch / (height + 300), 2);
        const tx = cw / 2 - ((xExtent[0] + xExtent[1]) / 2) * scale;
        const ty = ch / 2 - ((yExtent[0] + yExtent[1]) / 2) * scale;
        
        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        selection.call(zoom.transform, transform);
      }
      hasCentered.current = true;
    }
    
    // Bind fit trigger
    const fitBtn = document.getElementById('fit-graph-btn');
    const onFit = () => {
      if (nodes.length === 0) return;
      const xExtent = d3.extent(nodes, d => (d as any).x) as [number, number];
      const yExtent = d3.extent(nodes, d => (d as any).y) as [number, number];
      const width = xExtent[1] - xExtent[0];
      const height = yExtent[1] - yExtent[0];
      const cw = wrapperRef.current!.clientWidth;
      const ch = wrapperRef.current!.clientHeight;
      const scale = Math.min(cw / (width + 300), ch / (height + 300), 2);
      const tx = cw / 2 - ((xExtent[0] + xExtent[1]) / 2) * scale;
      const ty = ch / 2 - ((yExtent[0] + yExtent[1]) / 2) * scale;
      selection.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };
    if (fitBtn) fitBtn.addEventListener('click', onFit);

    return () => {
      selection.on('.zoom', null);
      if (fitBtn) fitBtn.removeEventListener('click', onFit);
    };
  }, [nodes.length > 0]); // only re-run effect if we transition from 0 to N nodes (or just keep zoom behavior stable)

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const applyJsonChange = (nodePath: string, action: 'edit' | 'add' | 'delete', newValueStr: string, newKeyStr?: string, typeOverride?: string) => {
    try {
      const { code, setCode } = useStore.getState();
      const parsed = JSON.parse(code);
      
      let finalValue: any = newValueStr;
      
      if (action === 'edit' || action === 'add') {
         if (typeOverride && typeOverride !== 'auto') {
            if (typeOverride === 'object') finalValue = {};
            else if (typeOverride === 'array') finalValue = [];
            else if (typeOverride === 'null') finalValue = null;
            else if (typeOverride === 'boolean') finalValue = newValueStr === 'true';
            else if (typeOverride === 'number') {
                const num = Number(newValueStr);
                finalValue = isNaN(num) ? 0 : num;
            }
            else if (typeOverride === 'string') finalValue = newValueStr;
         } else {
             try { finalValue = JSON.parse(newValueStr || '""'); } catch(e) { finalValue = newValueStr; }
         }
      }
      
      if (nodePath === 'root') {
         if (action === 'edit') setCode(JSON.stringify(finalValue, null, 2));
         else if (action === 'delete') setCode('{}');
         else if (action === 'add') {
             if (Array.isArray(parsed)) parsed.push(finalValue);
             else if (typeof parsed === 'object' && parsed !== null) {
                 if (newKeyStr) parsed[newKeyStr] = finalValue;
             }
             setCode(JSON.stringify(parsed, null, 2));
         }
         return;
      }
      
      const parts = nodePath
        .replace(/^root/, '')
        .split(/(?=\[)|(?=\.)/)
        .filter(Boolean)
        .map(p => p.startsWith('.') ? p.substring(1) : p.replace(/[\[\]]/g, ''));
        
      let current = parsed;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      
      const lastKey = parts[parts.length - 1];
      
      if (action === 'edit') {
         // Handle Key Renaming for Objects
         if (newKeyStr && newKeyStr !== lastKey && !Array.isArray(current)) {
            // Delete old key, set new key
            delete current[lastKey];
            current[newKeyStr] = finalValue;
         } else {
            current[lastKey] = finalValue;
         }
      } else if (action === 'delete') {
         if (Array.isArray(current)) {
             current.splice(Number(lastKey), 1);
         } else {
             delete current[lastKey];
         }
      } else if (action === 'add') {
         const target = current[lastKey];
         if (Array.isArray(target)) {
             target.push(finalValue);
         } else if (typeof target === 'object' && target !== null) {
             if (newKeyStr) target[newKeyStr] = finalValue;
         }
      }
      
      setCode(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error("Failed to update JSON", e);
      alert("Invalid JSON format or edit failure. Check if key is empty for object insertions.");
    }
  };

  // Zoom to search matches
  useEffect(() => {
    if (!wrapperRef.current || !zoomRef.current) return;
    if (searchQuery === lastSearchQuery.current) return; // only zoom on new query
    lastSearchQuery.current = searchQuery;

    if (!searchQuery || searchMatches.size === 0) return;

    // Filter node coordinates
    const matchedNodes = nodes.filter(n => searchMatches.has(n.data.id));
    if (matchedNodes.length === 0) return;

    const xValues = matchedNodes.map(d => d.x);
    const yValues = matchedNodes.map(d => d.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const cw = wrapperRef.current.clientWidth;
    const ch = wrapperRef.current.clientHeight;
    
    // Target scale (capped)
    const scale = Math.min(cw / (width + 400), ch / (height + 400), 1.2);
    const tx = cw / 2 - ((minX + maxX) / 2) * scale;
    const ty = ch / 2 - ((minY + maxY) / 2) * scale;

    d3.select(wrapperRef.current)
      .transition()
      .duration(750)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [searchQuery, searchMatches, nodes]);

  const { isToolbarVisible, activeTool } = useAnnotationStore();

  const getCursorClass = () => {
    if (!isToolbarVisible) return 'cursor-grab active:cursor-grabbing';
    
    switch (activeTool) {
      case 'select': return 'cursor-move';
      case 'eraser': return 'cursor-cell';
      case 'pen':
      case 'highlighter':
      case 'rectangle':
      case 'circle':
      case 'ellipse':
      case 'triangle':
      case 'square':
      case 'rounded-rectangle':
      case 'pentagon':
      case 'hexagon':
      case 'heptagon':
      case 'octagon':
      case 'polygon':
      case 'star':
      case 'diamond':
      case 'function-brush':
        return 'cursor-crosshair';
      default: return 'cursor-crosshair';
    }
  };

  return (
    <div id="graph-export-wrapper" ref={wrapperRef} onClick={() => setSelectedNodeId(null)} onContextMenu={handleBackgroundContextMenu} className={`relative w-full h-full overflow-hidden outline-none ${getCursorClass()}`}>
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{ 
          backgroundColor: canvasBackgroundColor, 
          backgroundImage: canvasBackgroundImage ? `url(${canvasBackgroundImage})` : 'none', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          filter: canvasBackgroundBlur > 0 ? `blur(${canvasBackgroundBlur}px)` : 'none',
          transform: canvasBackgroundBlur > 0 ? 'scale(1.1)' : 'none' // Prevent blurred edges from creeping in
        }} 
      />
      <svg className="absolute inset-0 z-10 w-full h-full pointer-events-none graph-svg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <pattern id="theme-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill={canvasPatternColor} />
          </pattern>

          <pattern id="theme-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={canvasPatternColor} strokeWidth="1" />
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke={canvasPatternColor} strokeWidth="2" />
          </pattern>

          <pattern id="theme-lines" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 0 40 L 40 0" fill="none" stroke={canvasPatternColor} strokeWidth="1" />
          </pattern>
        </defs>

        <g ref={svgGRef} className="pointer-events-auto graph-g">
          {/* Background Rect inside zoom group to scale with content */}
          {canvasTheme !== 'none' && (
            <rect x="-100000" y="-100000" width="200000" height="200000" fill={`url(#theme-${canvasTheme})`} className="pointer-events-none" />
          )}

          {links.map((link) => {
            const d = getEdgePath(link.source, link.target, edgeStyle, layoutMode);
            const isMatchPath = !!searchQuery && (searchMatches.has(link.target.data.id) || searchAncestors.has(link.target.data.id));
            const isDimmedPath = !!searchQuery && !isMatchPath;
            const isSelectedEdge = selectedPathEdges.has(`${link.source.data.id}->${link.target.data.id}`);
            return <EdgeRenderer key={`link-${link.source.data.id}-${link.target.data.id}`} d={d} style={edgeStyle} isHighlighted={isMatchPath} isDimmed={isDimmedPath} isSelected={isSelectedEdge} />;
          })}
          {nodes.map(node => (
            <NodeRenderer 
              key={`node-${node.data.id}`} 
              node={node} 
              layoutMode={layoutMode} 
              isSelectedPath={selectedPathNodes.has(node.data.id)} 
              isSelected={selectedNodeId === node.data.id} 
              onContextMenu={(e, treeNode) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, node: treeNode });
              }}
            />
          ))}
          <AnnotationRenderer />
        </g>
      </svg>
      
      {nodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-slate-600 font-mono text-sm pointer-events-none">
           Awaiting input...
         </div>
      )}

      {/* Floating Search & Settings */}
      <div 
        onContextMenu={e => e.stopPropagation()}
        className="no-export absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md p-1.5 rounded-full border border-slate-300 dark:border-slate-700/50 shadow-lg pointer-events-auto"
      >
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 text-slate-500 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search nodes..." 
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="bg-transparent border-none pl-9 pr-4 py-1.5 text-sm outline-none w-48 lg:w-64 focus:ring-0 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
        <div className="w-[1px] h-6 bg-slate-300 dark:bg-slate-700/50"></div>
        <button 
          onClick={() => useStore.getState().setIsAdvancedPanelOpen(true)}
          className="p-1.5 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full transition-colors mr-1"
          title="Advanced Options"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && createPortal(
        <div className={appTheme}>
          <div 
            ref={contextMenuRef}
            className="fixed z-50 bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700/50 shadow-2xl rounded-md py-1 overflow-hidden min-w-[220px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
          <div className="px-3 py-2.5 border-b border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a]/50">
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate block max-w-[200px]" title={contextMenu.node.path}>{contextMenu.node.path}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-1 block">{contextMenu.node.type}</span>
          </div>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
            onClick={() => {
               let valToCopy = "";
               const { code } = useStore.getState();
               // Try to extract original JSON value to copy
               try {
                  const nodePath = contextMenu.node.path;
                  if (nodePath === 'root') { valToCopy = code; } 
                  else {
                    const parts = nodePath.replace(/^root/, '').split(/(?=\[)|(?=\.)/).filter(Boolean).map(p => p.startsWith('.') ? p.substring(1) : p.replace(/[\[\]]/g, ''));
                    let current = JSON.parse(code);
                    for (let i = 0; i < parts.length; i++) { current = current[parts[i]]; }
                    valToCopy = JSON.stringify(current, null, 2);
                  }
               } catch (e) {
                 valToCopy = contextMenu.node.value !== undefined ? String(contextMenu.node.value) : "Could not copy";
               }
               navigator.clipboard.writeText(valToCopy);
               setContextMenu(null);
            }}
          >
            <Copy size={16} className="text-slate-400" />
            Copy Value
          </button>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
            onClick={() => {
               navigator.clipboard.writeText(contextMenu.node.path);
               setContextMenu(null);
            }}
          >
            <Copy size={16} className="text-slate-400" />
            Copy JSON Path
          </button>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
            onClick={() => {
               navigator.clipboard.writeText(contextMenu.node.name);
               setContextMenu(null);
            }}
          >
            <Copy size={16} className="text-slate-400" />
            Copy Key
          </button>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors border-t border-slate-300 dark:border-slate-700/50"
            onClick={() => {
               let valToEdit = "";
               let currentKey = "";
               const { code } = useStore.getState();
               try {
                  const nodePath = contextMenu.node.path;
                  if (nodePath === 'root') { 
                    valToEdit = code; 
                  } else {
                    const parts = nodePath.replace(/^root/, '').split(/(?=\[)|(?=\.)/).filter(Boolean).map(p => p.startsWith('.') ? p.substring(1) : p.replace(/[\[\]]/g, ''));
                    currentKey = parts[parts.length - 1];
                    let current = JSON.parse(code);
                    for (let i = 0; i < parts.length; i++) { current = current[parts[i]]; }
                    valToEdit = typeof current === 'object' ? JSON.stringify(current, null, 2) : String(current);
                  }
               } catch (e) {
                 valToEdit = contextMenu.node.value !== undefined ? String(contextMenu.node.value) : "";
               }
               
               setEditingNode({ node: contextMenu.node, value: valToEdit, action: 'edit', typeOverride: 'auto', newKey: currentKey });
               setContextMenu(null);
            }}
          >
            <Edit2 size={16} className="text-blue-400" />
            Edit Content
          </button>
          
          {(contextMenu.node.type === 'object' || contextMenu.node.type === 'array') && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors border-t border-slate-300 dark:border-slate-700/50"
              onClick={() => {
                 setEditingNode({ node: contextMenu.node, value: "", action: 'add', typeOverride: 'auto' });
                 setContextMenu(null);
              }}
            >
              <Edit2 size={16} className="text-green-400" />
              Add {contextMenu.node.type === 'array' ? 'Item' : 'Property'}
            </button>
          )}

          {contextMenu.node.path !== 'root' && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-3 transition-colors border-t border-slate-300 dark:border-slate-700/50"
              onClick={() => {
                 applyJsonChange(contextMenu.node.path, 'delete', "");
                 setContextMenu(null);
              }}
            >
              <Trash2 size={16} />
              Delete Node
            </button>
          )}
          </div>
        </div>,
        document.body
      )}

      {/* Editing Modal */}
      {editingNode && createPortal(
        <div className={appTheme}>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingNode(null)}>
            <div className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 rounded-xl p-4 w-full max-w-md shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-slate-700/50 pb-2">
              <h3 className="text-slate-800 dark:text-slate-100 font-medium text-sm flex items-center gap-2">
                 <Edit2 size={16} className={editingNode.action === 'add' ? "text-green-500 dark:text-green-400" : "text-blue-500 dark:text-blue-400"}/>
                 {editingNode.action === 'add' ? 'Add to Node' : 'Edit Node Value'}
              </h3>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => setEditingNode(null)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
               <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Node Path</label>
               <div className="text-xs font-mono text-blue-600 dark:text-blue-300 bg-slate-50 dark:bg-[#0f172a] p-2 rounded-md max-w-full overflow-x-auto border border-blue-200 dark:border-blue-900/30 truncate" title={editingNode.node.path}>
                 {editingNode.node.path}
               </div>
            </div>

            <div className="flex gap-3">
              {(editingNode.action === 'add' && editingNode.node.type === 'object') || 
               (editingNode.action === 'edit' && editingNode.node.path !== 'root' && !editingNode.node.path.endsWith(']')) ? (
                <div className="flex flex-col gap-1 flex-1">
                   <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                     {editingNode.action === 'add' ? 'New Key' : 'Key Name'}
                   </label>
                   <input 
                     type="text"
                     value={editingNode.newKey || ''}
                     onChange={(e) => setEditingNode({ ...editingNode, newKey: e.target.value })}
                     className="bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700/80 rounded-md p-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:border-blue-500 outline-none"
                     placeholder={editingNode.action === 'add' ? "e.g. keyName" : "Key name"}
                   />
                </div>
              ) : null}

              <div className="flex flex-col gap-1 flex-1">
                 <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Type</label>
                 <select 
                   value={editingNode.typeOverride || 'auto'} 
                   onChange={(e) => setEditingNode({ ...editingNode, typeOverride: e.target.value })}
                   className="bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700/80 rounded-md p-1.5 text-slate-800 dark:text-slate-200 text-xs focus:border-blue-500 outline-none min-h-[30px]"
                 >
                   <option value="auto">Auto Parse</option>
                   <option value="string">String</option>
                   <option value="number">Number</option>
                   <option value="boolean">Boolean</option>
                   <option value="object">Object {}</option>
                   <option value="array">Array []</option>
                   <option value="null">Null</option>
                 </select>
              </div>
            </div>

            {!['object', 'array', 'null'].includes(editingNode.typeOverride || 'auto') && (
              <div className="flex flex-col gap-1 flex-1">
                 <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Content</label>
                 <textarea 
                   value={editingNode.value}
                   onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })}
                   className="bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700/80 rounded-md p-2 text-slate-800 dark:text-slate-200 font-mono text-xs h-32 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y shadow-inner"
                   placeholder={editingNode.typeOverride === 'boolean' ? "true or false" : editingNode.typeOverride === 'number' ? "123.45" : "Enter value..."}
                 />
                 <span className="text-[10px] text-slate-500 leading-tight">
                   {editingNode.typeOverride === 'auto' ? "Valid JSON parsed automatically." : `Forced type: ${editingNode.typeOverride}`}
                 </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button 
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-xs font-medium border border-slate-300 dark:border-slate-700"
                onClick={() => setEditingNode(null)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 text-xs font-medium"
                onClick={() => {
                   applyJsonChange(editingNode.node.path, editingNode.action, editingNode.value, editingNode.newKey, editingNode.typeOverride);
                   setEditingNode(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
        </div>,
        document.body
      )}
    </div>
  );
}
