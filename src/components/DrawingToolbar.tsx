import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useAnnotationStore, DrawingTool, BrushStyle } from '../store/useAnnotationStore';
import { 
  PenTool, Highlighter, Type, Square, Circle, Triangle,
  Minus, ArrowRight, Eraser, MousePointer2, Waves, Activity,
  Settings, Zap, CheckSquare, Trash2, GripHorizontal, GripVertical, Undo2, Redo2, MoreHorizontal,
  RotateCcw, ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Move,
  Sigma
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { HexColorPicker } from 'react-colorful';

const TOOLS: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 size={16} />, label: 'Select' },
  { id: 'pen', icon: <PenTool size={16} />, label: 'Pen' },
  { id: 'highlighter', icon: <Highlighter size={16} />, label: 'Highlighter' },
  { id: 'straight-line', icon: <Minus size={16} />, label: 'Line' },
  { id: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
  { id: 'rectangle', icon: <Square size={16} />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle size={16} />, label: 'Circle' },
  { id: 'triangle', icon: <Triangle size={16} />, label: 'Triangle' },
  { id: 'sine-wave', icon: <Waves size={16} />, label: 'Sine Wave' },
  { id: 'function-brush', icon: <Sigma size={16} />, label: 'Function Brush' },
  { id: 'square-wave', icon: <Activity size={16} />, label: 'Square Wave' },
  { id: 'triangle-wave', icon: <Activity size={16} className="rotate-90" />, label: 'Triangle Wave' },
  { id: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
];

const BRUSHES: { id: BrushStyle; label: string }[] = [
  { id: 'smooth-ink', label: 'Smooth Ink' },
  { id: 'marker', label: 'Marker' },
  { id: 'neon-glow', label: 'Neon Glow' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'rough-handdrawn', label: 'Rough' },
  { id: 'calligraphy', label: 'Calligraphy' },
  { id: 'soft-highlighter', label: 'Soft Highlighter' },
];

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#8b5cf6', // Violet
  '#ffffff', // White
  '#000000', // Black
  'transparent', // Transparent
];

const FUNCTION_PRESETS = [
  { label: 'Sine', expr: 'sin(x)' },
  { label: 'Lissajous (Par)', expr: 'x(t)=sin(3*t+p); y(t)=sin(2*t)' },
  { label: 'Spiral (Par)', expr: 'x(t)=t/5*cos(t); y(t)=t/5*sin(t)' },
  { label: 'Butterfly (Par)', expr: 'x(t)=sin(t)*(exp(cos(t))-2*cos(4*t)-sin(t/12)^5); y(t)=cos(t)*(exp(cos(t))-2*cos(4*t)-sin(t/12)^5)' },
  { label: 'Waves (Field)', expr: 'sin(x*y + t)' },
  { label: 'Star (Polar)', expr: 'r = 1 + 0.5*sin(5*theta)' },
];

export default function DrawingToolbar() {
  const store = useAnnotationStore();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initX: number; initY: number }>({
    isDragging: false, startX: 0, startY: 0, initX: 0, initY: 0
  });
  
  const { 
    isToolbarVisible, toolbarOpacity, toolbarOrientation, 
    toolbarPosition, toolbarPlacement, toolbarScale,
    setToolbarScale, setToolbarPosition, setToolbarPlacement,
    setToolbarOrientation
  } = store;

  const isVert = toolbarOrientation === 'vertical';
  const [showConfig, setShowConfig] = useState(false);
  const [resizingMode, setResizingMode] = useState<'none' | 'scale' | 'options' | 'function'>('none');

  const handleClear = () => {
    store.clearAnnotations();
    store.commitAction();
  };

  useEffect(() => {
    if (!isToolbarVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input, don't trigger shortcuts
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      
      // Shift + [Key] for Tools
      if (e.shiftKey) {
        switch (key) {
          case 'v': store.setActiveTool('select'); break;
          case 'p': store.setActiveTool('pen'); break;
          case 'f': store.setActiveTool('function-brush'); break;
          case 'h': store.setActiveTool('highlighter'); break;
          case 'e': store.setActiveTool('eraser'); break;
        }
      }

      // Alt + [Key] for Colors
      if (e.altKey) {
        switch (key) {
          case 'r': store.setColor('#ef4444'); break;
          case 'o': store.setColor('#f97316'); break;
          case 'y': store.setColor('#eab308'); break;
          case 'g': store.setColor('#22c55e'); break;
          case 's': store.setColor('#0ea5e9'); break;
          case 'b': store.setColor('#3b82f6'); break;
          case 'p': store.setColor('#a855f7'); break;
          case 'v': store.setColor('#8b5cf6'); break;
          case 'w': store.setColor('#ffffff'); break;
          case 'k': store.setColor('#000000'); break;
          case 't': store.setColor('transparent'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isToolbarVisible, store]);

  useLayoutEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (dragRef.current.isDragging) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        
        const rect = toolbarRef.current?.getBoundingClientRect();
        const w = rect?.width || 0;
        const h = rect?.height || 0;

        let newX = dragRef.current.initX + dx;
        let newY = dragRef.current.initY + dy;
        
        // Clamp to viewport bounds
        newX = Math.max(0, Math.min(window.innerWidth - w, newX));
        newY = Math.max(0, Math.min(window.innerHeight - h, newY));
        
        setToolbarPosition({ x: newX, y: newY });
      } else if (resizingMode === 'scale') {
        const rect = toolbarRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;
        
        const baseSize = (isVert ? 350 : 500) * toolbarScale;
        const newScale = Math.max(0.5, Math.min(2, Math.max(dx, dy) / (baseSize / toolbarScale)));
        setToolbarScale(newScale);
      } else if (resizingMode === 'options' || resizingMode === 'function') {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        
        if (resizingMode === 'options') {
          store.setOptionsPanelWidth(Math.max(200, Math.min(800, dragRef.current.initX + dx)));
          store.setOptionsPanelHeight(Math.max(150, Math.min(600, dragRef.current.initY + dy)));
        } else {
          store.setFunctionPanelWidth(Math.max(200, Math.min(800, dragRef.current.initX + dx)));
          store.setFunctionPanelHeight(Math.max(200, Math.min(800, dragRef.current.initY + dy)));
        }
      }
    };

    const handlePointerUp = () => {
      dragRef.current.isDragging = false;
      setResizingMode('none');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [store, resizingMode, isVert, setToolbarPosition, setToolbarScale]);

  if (!isToolbarVisible) return null;

  let placementClass = '';
  let placementStyle = {};
  if (toolbarPlacement === 'drag') {
    placementStyle = { left: toolbarPosition.x, top: toolbarPosition.y };
    placementClass = isVert ? 'flex-row items-start' : 'flex-col items-center';
  } else {
    switch (toolbarPlacement) {
      case 'top-left': placementClass = isVert ? 'top-4 left-4 flex-row items-start' : 'top-4 left-4 flex-col items-center'; break;
      case 'top-center': placementClass = isVert ? 'top-4 left-1/2 -translate-x-1/2 flex-row items-start' : 'top-4 left-1/2 -translate-x-1/2 flex-col items-center'; break;
      case 'top-right': placementClass = isVert ? 'top-4 right-4 flex-row-reverse items-start' : 'top-4 right-4 flex-col items-center'; break;
      case 'bottom-left': placementClass = isVert ? 'bottom-4 left-4 flex-row items-end' : 'bottom-4 left-4 flex-col-reverse items-center'; break;
      case 'bottom-center': placementClass = isVert ? 'bottom-4 left-1/2 -translate-x-1/2 flex-row items-end' : 'bottom-4 left-1/2 -translate-x-1/2 flex-col-reverse items-center'; break;
      case 'bottom-right': placementClass = isVert ? 'bottom-4 right-4 flex-row-reverse items-end' : 'bottom-4 right-4 flex-col-reverse items-center'; break;
    }
  }

  const onPlacementChange = (placement: typeof toolbarPlacement) => {
    setToolbarPlacement(placement);
    setShowConfig(false);
  };

  return (
    <div 
      ref={toolbarRef}
      className={`absolute flex z-[100] gap-2 animate-in fade-in zoom-in-95 duration-200 ${placementClass} pointer-events-none`}
      style={{ 
        ...placementStyle, 
        opacity: toolbarOpacity, 
        visibility: toolbarOpacity < 0.05 ? 'hidden' : 'visible',
        transform: `scale(${toolbarScale})`,
        transformOrigin: 'top left'
      }}
    >
      {/* Main Toolbelt */}
      <div className={`pointer-events-auto flex ${isVert ? 'flex-col' : 'flex-row'} items-center gap-1.5 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 relative group`}>
        <div className="flex gap-1 p-1">
           {toolbarPlacement === 'drag' && (
             <div 
               className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg"
               onPointerDown={(e) => {
                 e.currentTarget.setPointerCapture(e.pointerId);
                 dragRef.current = {
                   isDragging: true,
                   startX: e.clientX,
                   startY: e.clientY,
                   initX: toolbarPosition.x,
                   initY: toolbarPosition.y
                 };
                 e.preventDefault();
               }}
               onPointerUp={(e) => {
                 e.currentTarget.releasePointerCapture(e.pointerId);
                 dragRef.current.isDragging = false;
               }}
             >
               {isVert ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
             </div>
           )}
           <Popover open={showConfig} onOpenChange={setShowConfig}>
             <PopoverTrigger 
               className={`p-1.5 rounded-lg transition-colors ${showConfig ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
               title="Toolbar Configuration"
             >
               <MoreHorizontal size={14} />
             </PopoverTrigger>
             <PopoverContent 
               className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[110] pointer-events-none" 
               align="start" 
               sideOffset={10}
             >
               <div 
                 className="w-[180px] p-3 text-xs flex flex-col gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl text-slate-900 dark:text-slate-200 transition-transform origin-top-left pointer-events-auto"
                 style={{ 
                   transform: `scale(${toolbarScale})`
                 }}
               >
                <div className="flex items-center justify-between px-2 py-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Scale</span>
                  <button 
                    onClick={() => setToolbarScale(1)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-blue-500 transition-colors"
                    title="Reset Scale"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
                <div className="px-2 pb-2">
                  <Slider 
                    min={0.5} 
                    max={2} 
                    step={0.1} 
                    value={toolbarScale} 
                    onValueChange={(v) => setToolbarScale(Array.isArray(v) ? v[0] : (v as number))} 
                  />
                </div>
                <div className="h-[1px] bg-slate-200 dark:bg-slate-700 my-0.5" />
                <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5">Position</span>
                <div className="grid grid-cols-3 gap-1 px-1">
                  <button onClick={() => onPlacementChange('top-left')} title="Top Left" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-left' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUpLeft size={14} /></button>
                  <button onClick={() => onPlacementChange('top-center')} title="Top Center" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-center' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUp size={14} /></button>
                  <button onClick={() => onPlacementChange('top-right')} title="Top Right" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-right' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUpRight size={14} /></button>
                  <button onClick={() => onPlacementChange('bottom-left')} title="Bottom Left" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-left' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDownLeft size={14} /></button>
                  <button onClick={() => onPlacementChange('bottom-center')} title="Bottom Center" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-center' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDown size={14} /></button>
                  <button onClick={() => onPlacementChange('bottom-right')} title="Bottom Right" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-right' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDownRight size={14} /></button>
                </div>
                <button onClick={() => onPlacementChange('drag')} className={`flex items-center gap-2 px-2 py-1.5 mx-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'drag' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}>
                  <Move size={12} />
                  <span className="text-[10px]">Free Drag</span>
                </button>
                 <div className="h-[1px] bg-slate-200 dark:bg-slate-700 my-1" />
                 <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Orientation</span>
                 <button onClick={() => { setToolbarOrientation('horizontal'); setShowConfig(false); }} className={`text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarOrientation === 'horizontal' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}>Horizontal</button>
                 <button onClick={() => { setToolbarOrientation('vertical'); setShowConfig(false); }} className={`text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarOrientation === 'vertical' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}>Vertical</button>
                 
                 <div className="h-[1px] bg-slate-200 dark:bg-slate-700 my-1" />
                 <button 
                   onClick={() => {
                     store.resetPreferences();
                     setShowConfig(false);
                   }} 
                   className="flex items-center gap-2 px-2 py-2 mx-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                 >
                   <RotateCcw size={12} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Reset Defaults</span>
                 </button>
               </div>
             </PopoverContent>
           </Popover>
        </div>
        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <div className={`grid ${isVert ? 'grid-cols-2' : 'grid-rows-2 grid-flow-col'} gap-1 p-0.5`}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => store.setActiveTool(t.id)}
              title={t.label}
              className={`p-2 rounded-xl transition-all ${
                store.activeTool === t.id 
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
        
        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <div className="grid grid-cols-2 gap-1 p-0.5">
          <button
            disabled={store.historyIndex <= 0}
            onClick={() => store.undo()}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            disabled={store.historyIndex >= store.history.length - 1}
            onClick={() => store.redo()}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <button
          onClick={handleClear}
          className="p-2 m-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
          title="Clear All"
        >
          <Trash2 size={16} />
        </button>

        {/* Resize Handle */}
        <div 
          className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setResizingMode('scale');
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500" />
        </div>
      </div>

      {/* Options Panel depending on tool */}
      {store.activeTool !== 'eraser' && (store.activeTool !== 'select' || store.selectedAnnotationIds.length > 0) && (
        <div 
          className={`pointer-events-auto flex ${isVert ? 'flex-col' : 'gap-4 w-full max-w-2xl px-5'} p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 relative group/options`}
          style={{ 
            width: isVert ? store.optionsPanelWidth : 'auto',
            height: isVert ? 'auto' : store.optionsPanelHeight,
            minWidth: isVert ? '200px' : 'auto',
            minHeight: isVert ? 'auto' : '150px'
          }}
        >
          {/* Resize Handle for Options Panel */}
          <div 
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize opacity-0 group-hover/options:opacity-100 transition-opacity flex items-center justify-center p-1 z-10"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizingMode('options');
              dragRef.current = {
                isDragging: false,
                startX: e.clientX,
                startY: e.clientY,
                initX: isVert ? store.optionsPanelWidth : 0,
                initY: isVert ? 0 : store.optionsPanelHeight
              };
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500" />
          </div>

          <div className={`flex flex-col gap-1 ${isVert ? 'pb-3 border-b border-slate-200 dark:border-slate-800' : 'pr-4 border-r border-slate-200 dark:border-slate-800'}`}>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Colors</span>
            <div className={`grid ${isVert ? 'grid-cols-4' : 'grid-cols-2'} gap-1.5 w-full relative`}>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => store.setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${store.color === c ? 'scale-125 border-white dark:border-slate-800 shadow-sm' : 'border-transparent hover:scale-110'} justify-self-center`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Popover>
                <PopoverTrigger 
                  className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-slate-500 transition-colors justify-self-center"
                  title="Custom Color"
                >
                  <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: Object.values(COLORS).includes(store.color) ? 'transparent' : store.color }} />
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[9999] pointer-events-none" 
                  align="center" 
                  side="top" 
                  sideOffset={10}
                >
                  <div 
                    className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl transition-transform origin-bottom-center pointer-events-auto"
                    style={{ 
                      transform: `scale(${toolbarScale})`
                    }}
                  >
                    <HexColorPicker
                      color={store.color}
                      onChange={(c) => store.setColor(c)}
                      className="!w-full"
                    />
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600 shadow-sm" style={{ backgroundColor: store.color }} />
                      <input 
                        type="text" 
                        value={store.color}
                        onChange={(e) => store.setColor(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs font-mono w-full uppercase"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className={`flex-1 flex ${isVert ? 'flex-col gap-3 pt-3' : 'gap-6 px-2'}`}>
            <div className="flex flex-col gap-2 flex-1">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Width <span>{store.width}px</span>
              </span>
              <Slider min={1} max={50} value={store.width} onValueChange={v => store.setWidth(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />

              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between mt-1">
                Opacity <span>{Math.round(store.opacity * 100)}%</span>
              </span>
              <Slider min={0.1} max={1} step={0.05} value={store.opacity} onValueChange={v => store.setOpacity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Glow <span>{store.glowIntensity}</span>
              </span>
              <Slider min={0} max={20} value={store.glowIntensity} onValueChange={v => store.setGlowIntensity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />

              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between mt-1">
                Smoothing <span>{Math.round(store.smoothing * 100)}%</span>
              </span>
              <Slider min={0} max={1} step={0.1} value={store.smoothing} onValueChange={v => store.setSmoothing(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
            </div>
          </div>

          <div className={`flex flex-col gap-1 ${isVert ? 'pt-3 border-t border-slate-200 dark:border-slate-800' : 'pl-4 border-l border-slate-200 dark:border-slate-800'}`}>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Style</span>
            <select 
              value={store.brushStyle} 
              onChange={e => store.setBrushStyle(e.target.value as BrushStyle)}
              className="mt-1 bg-slate-100 dark:bg-slate-800 border-none outline-none text-xs rounded-md px-2 py-1.5 min-w-[120px] text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {BRUSHES.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            
            <div className="flex items-center gap-2 mt-2 group">
              <Checkbox 
                id="auto-shape"
                checked={store.autoShapeDetection} 
                onCheckedChange={(checked) => store.setAutoShapeDetection(checked === true)} 
              />
              <label 
                htmlFor="auto-shape" 
                className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors"
              >
                Auto Shape
              </label>
            </div>

            <div className={`flex flex-col gap-1 mt-3 ${isVert ? 'pt-3 border-t border-slate-200 dark:border-slate-800' : 'pl-4 border-l border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between group mb-1">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="fill-enabled"
                    checked={store.fillEnabled} 
                    onCheckedChange={(checked) => store.setFillEnabled(checked === true)} 
                  />
                  <label 
                    htmlFor="fill-enabled" 
                    className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors"
                  >
                    Fill Shape
                  </label>
                </div>
                {store.fillEnabled && (
                  <Popover>
                    <PopoverTrigger className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: store.fillColor }} />
                    <PopoverContent className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[9999] pointer-events-none" align="end" side="top" sideOffset={10}>
                      <div 
                        className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl transition-transform origin-bottom-right pointer-events-auto"
                        style={{ transform: `scale(${toolbarScale})` }}
                      >
                        <HexColorPicker color={store.fillColor} onChange={(c) => store.setFillColor(c)} className="!w-full" />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {COLORS.map(c => (
                            <button key={c} onClick={() => store.setFillColor(c)} className="w-4 h-4 rounded-full border border-transparent hover:border-white shadow-sm" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {store.fillEnabled && (
                <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-200">
                  <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      Fill Opacity <span>{Math.round(store.fillOpacity * 100)}%</span>
                    </div>
                    <button 
                      onClick={() => {
                        store.setFillColor(store.color);
                        store.setFillOpacity(0.3);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-blue-500 transition-colors"
                      title="Reset Fill to Ink Color & 30%"
                    >
                      <RotateCcw size={10} />
                    </button>
                  </span>
                  <Slider min={0.05} max={1} step={0.05} value={store.fillOpacity} onValueChange={v => store.setFillOpacity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Highlighter Settings */}
      {store.activeTool === 'highlighter' && (
        <div 
          className={`pointer-events-auto flex ${isVert ? 'flex-col items-start gap-1.5' : 'items-center gap-2'} p-1.5 px-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100`}
          style={{ transitionTimingFunction: 'cubic-bezier(0, 0, 0, 1.04)' }}
        >
          <div className={`flex ${isVert ? 'flex-col' : 'flex-wrap items-center'} gap-1.5 text-[10px] w-full text-slate-600 dark:text-slate-400`}>
            <div className="flex items-center gap-1 justify-between w-full hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <span>Wait (s):</span>
              <input type="number" min="0" step="0.5" value={store.blinkDuration} onChange={e => store.setBlinkDuration(Number(e.target.value))} className="w-10 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded outline-none border border-slate-200 dark:border-slate-700 text-center transition-colors focus:border-blue-500" title="Time to stay before disappearing (0 to stay forever)" />
            </div>
            <div className="flex items-center gap-1 justify-between w-full hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <span>Hz:</span>
              <input type="number" min="0" step="0.5" value={store.blinkFrequency} onChange={e => store.setBlinkFrequency(Number(e.target.value))} className="w-10 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded outline-none border border-slate-200 dark:border-slate-700 text-center transition-colors focus:border-blue-500" title="How fast to blink (0 to disable)" />
            </div>
            <div className="flex items-center gap-1 justify-between w-full hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <span>Fade (s):</span>
              <input type="number" min="0" step="0.5" value={store.fadeOutDuration} onChange={e => store.setFadeOutDuration(Number(e.target.value))} className="w-10 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded outline-none border border-slate-200 dark:border-slate-700 text-center transition-colors focus:border-blue-500" title="Duration of disappear transition" />
            </div>
          </div>
        </div>
      )}

      {/* Waves Settings */}
      {(store.activeTool === 'sine-wave' || store.activeTool === 'square-wave' || store.activeTool === 'triangle-wave') && (
        <div className={`pointer-events-auto flex ${isVert ? 'flex-col gap-3 min-w-[150px]' : 'items-center gap-4'} p-2.5 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100`}>
          <div className="flex flex-col gap-2 w-full">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between gap-4">
              Amplitude <span>{store.waveAmplitude}px</span>
            </span>
            <Slider min={5} max={100} value={store.waveAmplitude} onValueChange={v => store.setWaveAmplitude(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
          </div>
          <div className={`flex flex-col gap-2 w-full ${isVert ? 'pt-3 border-t' : 'pl-4 border-l'} border-slate-200 dark:border-slate-800`}>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between gap-4">
              Wavelength <span>{store.waveLength}px</span>
            </span>
            <Slider min={10} max={200} value={store.waveLength} onValueChange={v => store.setWaveLength(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
          </div>
        </div>
      )}

      {/* Function Brush Settings */}
      {store.activeTool === 'function-brush' && (
        <div 
          className={`pointer-events-auto flex flex-col gap-3 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 animate-in slide-in-from-left-2 duration-300 relative group/func`}
          style={{ 
            width: store.functionPanelWidth,
            height: store.functionPanelHeight,
            minWidth: '240px',
            minHeight: '200px'
          }}
        >
          {/* Resize Handle for Function Panel */}
          <div 
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize opacity-0 group-hover/func:opacity-100 transition-opacity flex items-center justify-center p-1 z-10"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizingMode('function');
              dragRef.current = {
                isDragging: false,
                startX: e.clientX,
                startY: e.clientY,
                initX: store.functionPanelWidth,
                initY: store.functionPanelHeight
              };
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500" />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
              Expression
            </span>
            <div className="relative group">
              <input 
                type="text" 
                value={store.functionExpression} 
                onChange={(e) => store.setFunctionExpression(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="e.g. sin(x) + cos(x/2)"
              />
              <Sigma className="absolute right-2 top-1.5 text-slate-400 group-hover:text-blue-500 transition-colors" size={14} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Presets</span>
            <div className="flex flex-wrap gap-1.5">
              {FUNCTION_PRESETS.map(p => (
                <button 
                  key={p.label}
                  onClick={() => store.setFunctionExpression(p.expr)}
                  className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                    store.functionExpression === p.expr 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Amplitude <span>{store.functionAmplitude}</span>
              </span>
              <Slider min={0} max={200} value={store.functionAmplitude} onValueChange={v => store.setFunctionAmplitude(Array.isArray(v) ? v[0] : (v as number))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Frequency <span>{store.functionFrequency.toFixed(2)}</span>
              </span>
              <Slider min={0.01} max={1} step={0.01} value={store.functionFrequency} onValueChange={v => store.setFunctionFrequency(Array.isArray(v) ? v[0] : (v as number))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Phase <span>{store.functionPhase.toFixed(2)}</span>
              </span>
              <Slider min={0} max={Math.PI * 2} step={0.1} value={store.functionPhase} onValueChange={v => store.setFunctionPhase(Array.isArray(v) ? v[0] : (v as number))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between">
                Smoothness <span>{store.functionSmoothness}</span>
              </span>
              <Slider min={0.5} max={20} step={0.5} value={store.functionSmoothness} onValueChange={v => store.setFunctionSmoothness(Array.isArray(v) ? v[0] : (v as number))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


