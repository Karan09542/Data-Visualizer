import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useAnnotationStore, DrawingTool, BrushStyle } from '../store/useAnnotationStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PenTool, Highlighter, Type, Square, Circle, Triangle,
  Minus, ArrowRight, Eraser, MousePointer2, Waves, Activity, Pentagon, Hexagon,
  Settings, Zap, CheckSquare, Trash2, GripHorizontal, GripVertical, Undo2, Redo2, MoreHorizontal,
  RotateCcw, ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Move,
  Sigma, X, ChevronUp, Palette, FunctionSquare, Eye, EyeOff, Copy, Check, Plus
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { HexAlphaColorPicker } from 'react-colorful';
import katex from 'katex';
import * as math from 'mathjs';

function Popover({ children, open, onOpenChange }: any) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) {
      setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative inline-block" ref={ref}>
      {React.Children.map(children, child => {
        if (!child) return null;
        if (child.type === PopoverTrigger) {
          return React.cloneElement(child, { onClick: (e: any) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); } });
        }
        if (child.type === PopoverContent && isOpen) {
          return child;
        }
        return null;
      })}
    </div>
  );
}

function PopoverTrigger({ children, onClick, className }: any) {
  return <div onClick={onClick} className={className}>{children}</div>;
}

function PopoverContent({ children, className, side, align, sideOffset }: any) {
  let posClass = "absolute z-[400] ";
  if (side === "top") posClass += "bottom-[100%] mb-2 ";
  else posClass += "top-[100%] mt-2 ";
  
  if (align === "end") posClass += "right-0 ";
  else if (align === "center") posClass += "left-1/2 -translate-x-1/2 ";
  else posClass += "left-0 ";

  return <div className={`${posClass} ${className || ''}`} onClick={e => e.stopPropagation()}>{children}</div>;
}

const LaTeXPreview = React.memo(({ expression, className = "", onSelect }: { expression: string, className?: string, onSelect?: () => void }) => {
  const [tex, setTex] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!expression) {
      setTex('');
      return;
    }
    try {
      let cleanExpr = expression;
      if (cleanExpr.includes('=')) {
        if (cleanExpr.includes(';')) {
          const parts = cleanExpr.split(';');
          const texParts = parts.map(p => {
            try { return math.parse(p.trim()).toTex(); } catch(e) { return ''; }
          }).filter(Boolean);
          setTex(texParts.join(' \\quad '));
          return;
        } else {
          try {
             setTex(math.parse(cleanExpr).toTex());
             return;
          } catch(e) {
             const parts = cleanExpr.split('=');
             const right = parts[1] || parts[0];
             setTex(math.parse(right.trim()).toTex());
             return;
          }
        }
      }
      const node = math.parse(cleanExpr.trim());
      setTex(node.toTex());
    } catch (e) {
      setTex('');
    }
  }, [expression]);

  if (!tex) return null;

  return (
    <div className={`group relative p-3 bg-slate-50 dark:bg-[#121A2F]/80 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-1.5 backdrop-blur-md shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-200 ${className}`}>
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-500/50">LaTeX Preview</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleCopy}
            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500 hover:text-blue-400"
            title="Copy LaTeX"
          >
            {copied ? <Check size={8} className="text-green-500" /> : <Copy size={8} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500 hover:text-blue-400"
            title={isVisible ? "Hide Preview" : "Show Preview"}
          >
            {isVisible ? <Eye size={8} /> : <EyeOff size={8} />}
          </button>
        </div>
      </div>
      
      {isVisible && (
        <div 
          onClick={onSelect}
          className="w-full text-center text-base text-slate-800 dark:text-blue-100 py-1 transition-all cursor-pointer hover:opacity-80 break-words overflow-x-auto custom-scrollbar whitespace-normal min-h-[2em] flex items-center justify-center p-2"
          dangerouslySetInnerHTML={{ 
            __html: katex.renderToString(tex, { 
              throwOnError: false,
              displayMode: false,
              strict: false,
              trust: true
            }) 
          }} 
        />
      )}
    </div>
  );
});

const TOOLS: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 size={14} />, label: 'Select' },
  { id: 'pen', icon: <PenTool size={14} />, label: 'Pen' },
  { id: 'highlighter', icon: <Highlighter size={14} />, label: 'Highlighter' },
  { id: 'straight-line', icon: <Minus size={14} />, label: 'Line' },
  { id: 'arrow', icon: <ArrowRight size={14} />, label: 'Arrow' },
  { id: 'rectangle', icon: <Square size={14} />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle size={14} />, label: 'Circle' },
  { id: 'triangle', icon: <Triangle size={14} />, label: 'Triangle' },
  { id: 'sine-wave', icon: <Waves size={14} />, label: 'Sine Wave' },
  { id: 'function-brush', icon: <Sigma size={14} />, label: 'Function Brush' },
  { id: 'square-wave', icon: <Activity size={14} />, label: 'Square Wave' },
  { id: 'triangle-wave', icon: <Activity size={14} className="rotate-90" />, label: 'Triangle Wave' },
  { id: 'eraser', icon: <Eraser size={14} />, label: 'Eraser' },
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

const ARROW_TIP_PRESETS = [
  { label: 'Leaf', expr: 'size * cos(theta * 2.5)' },
  { label: 'Flower', expr: 'size * abs(sin(theta * 3))' },
  { label: 'Shield', expr: 'size * (0.5 + 0.5 * cos(theta))' },
  { label: 'Spike', expr: 'size * (0.8 + 0.5 * cos(theta * 5))' }
];

const ARROW_LINE_PRESETS = [
  { label: 'Sine Wave', expr: 'sin(t * dist * 0.05) * 10' },
  { label: 'Beads', expr: 'abs(sin(t * dist * 0.1)) * 8' },
  { label: 'ZigZag', expr: '(t * dist % 20 < 10 ? 1 : -1) * 5' },
  { label: 'Decay', expr: 'sin(t * dist * 0.1) * 10 * (1 - t)' }
];

const FUNCTION_PRESETS = [
  { label: 'Sine', expr: 'sin(x)' },
  { label: 'Fourier Heart', expr: 'r = -2 + 2*sin(theta) - sin(theta)*sqrt(abs(cos(theta))) / (sin(theta) + 1.4)' },
  { label: 'Cardioid', expr: 'r = 1 + sin(theta)' },
  { label: 'Rectifier', expr: 'sin(x) > 0 ? 5*sin(x) : 0' },
  { label: 'Dot Modulator', expr: 'dot([sin(x), cos(x)], [cos(x/2), sin(x/2)])' },
  { label: 'Spiral (Par)', expr: 'x(t)=t/5*cos(t); y(t)=t/5*sin(t)' },
  { label: 'Butterfly (Par)', expr: 'x(t)=sin(t)*(exp(cos(t))-2*cos(4*t)-sin(t/12)^5); y(t)=cos(t)*(exp(cos(t))-2*cos(4*t)-sin(t/12)^5)' },
  { label: 'Waves (Field)', expr: 'sin(x*y + t)' },
  { label: 'Star (Polar)', expr: 'r = 1 + 0.5*sin(5*theta)' },
];

const MORE_FUNCTIONS = [
  {
    group: 'Trigonometric',
    items: [
      { label: 'sin(x)', expr: 'sin(x)' },
      { label: 'cos(x)', expr: 'cos(x)' },
      { label: 'tan(x)', expr: 'tan(x)' },
      { label: 'asin(x)', expr: 'asin(x)' },
      { label: 'acos(x)', expr: 'acos(x)' },
      { label: 'atan(x)', expr: 'atan(x)' },
    ]
  },
  {
    group: 'Exponential & Log',
    items: [
      { label: 'exp(x)', expr: 'exp(x)' },
      { label: 'log(x)', expr: 'log(x)' },
      { label: 'log10(x)', expr: 'log10(x)' },
      { label: 'pow(x, y)', expr: 'pow(x, 2)' },
    ]
  },
  {
    group: 'General',
    items: [
      { label: 'sqrt(x)', expr: 'sqrt(x)' },
      { label: 'abs(x)', expr: 'abs(x)' },
      { label: 'sign(x)', expr: 'sign(x)' },
      { label: 'ceil(x)', expr: 'ceil(x)' },
      { label: 'floor(x)', expr: 'floor(x)' },
      { label: 'round(x)', expr: 'round(x)' },
      { label: 'mod(x, y)', expr: 'mod(x, 2)' },
    ]
  },
  {
    group: 'Damped Functions',
    items: [
      { label: 'exp(-0.1x)sin(x)', expr: 'exp(-0.1*x) * sin(x)' },
      { label: 'exp(-0.2x)cos(x)', expr: 'exp(-0.2*x) * cos(x)' },
      { label: 'exp(-x/5)', expr: 'exp(-x/5)' },
      { label: 'Damped Spiral (P)', expr: 'x(t)=t*cos(t)*exp(-0.1*t); y(t)=t*sin(t)*exp(-0.1*t)' },
    ]
  },
  {
    group: 'Functional & Advanced',
    items: [
      { label: 'Fourier Square (Sum)', expr: 'y = sum(map(1:5, f(n)=sin((2n-1)*x)/(2n-1)))' },
      { label: 'Staircase (Filter)', expr: 'y = length(filter(0:10, f(i)=x>i))' },
      { label: 'Harmonic Product', expr: 'y = product(map(1:3, f(k)=sin(k*x)))' },
      { label: 'Dot Modulator', expr: 'dot([sin(x), cos(x)], [cos(x/2), sin(x/2)])' },
      { label: 'Fourier Heart (R)', expr: 'r = -2 + 2*sin(theta) - sin(theta)*sqrt(abs(cos(theta))) / (sin(theta) + 1.4)' },
      { label: 'Rectifier (Y)', expr: 'y = sin(x) > 0 ? 5*sin(x) : 0' },
    ]
  }
];

const SUGGESTED_MATH_FUNCTIONS = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sec', 'csc', 'cot',
  'exp', 'log', 'log10', 'log2', 'pow', 'sqrt', 'cbrt', 'abs', 'ceil', 'floor', 'round', 'fix', 'mod', 'sign',
  'min', 'max', 'mean', 'median', 'std', 'erf', 'gamma', 'factorial'
];

function MobileDrawingToolbar({ isInitialLoad }: { isInitialLoad: boolean }) {
  const store = useAnnotationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expressionCopied, setExpressionCopied] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const mobileMainInputRef = useRef<HTMLInputElement>(null);

  const handleCopyExpression = () => {
    navigator.clipboard.writeText(store.functionExpression);
    setExpressionCopied(true);
    setTimeout(() => setExpressionCopied(false), 2000);
  };
  
  if (!store.isToolbarVisible) return null;

  const currentToolLabel = TOOLS.find(t => t.id === store.activeTool)?.label || 'Tool';
  const currentToolIcon = TOOLS.find(t => t.id === store.activeTool)?.icon;

  const scrollbarClasses = "custom-scrollbar";

  const handleClear = () => {
    store.clearAnnotations();
    store.commitAction();
  };

  const activeToolObj = TOOLS.find(t => t.id === store.activeTool);

  return (
    <>
      <div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2"
        style={{ opacity: store.toolbarOpacity, visibility: store.toolbarOpacity < 0.05 ? 'hidden' : 'visible' }}
      >
        <div className="flex items-center gap-1.5 bg-white/90 dark:bg-[#0d131f]/90 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-2xl rounded-full p-2 origin-bottom transition-all">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 pl-3.5 pr-4 py-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full font-semibold text-[14px] transition-transform active:scale-95 border border-blue-100 dark:border-blue-500/30"
          >
            {currentToolIcon && React.cloneElement(currentToolIcon as React.ReactElement<any>, { size: 16 })}
            <span className="max-md:hidden">{currentToolLabel}</span>
            <ChevronUp size={14} className="opacity-50" />
          </button>
          
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          
          <button
            disabled={store.historyIndex <= 0}
            onClick={() => store.undo()}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 rounded-full transition-transform active:scale-95"
          >
            <Undo2 size={16} />
          </button>
          
          <button
            disabled={store.historyIndex >= store.history.length - 1}
            onClick={() => store.redo()}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 rounded-full transition-transform active:scale-95"
          >
            <Redo2 size={16} />
          </button>

          <button
            onClick={handleClear}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-transform active:scale-95"
            title="Clear All"
          >
            <Trash2 size={16} />
          </button>

          <button 
            onClick={() => store.setIsToolbarVisible(false)}
            className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-transform active:scale-95 ml-0.5"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-white dark:bg-[#0b1120] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-slate-200 dark:border-slate-800 pointer-events-auto relative z-10 flex flex-col max-h-[75vh] text-slate-800 dark:text-slate-200 font-sans"
            >
              <div 
                className="shrink-0 pt-4 pb-2 cursor-pointer flex justify-center"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
              </div>

              <div className={`flex-1 overflow-y-auto px-5 pb-12 ${scrollbarClasses}`}>
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6 mt-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#E2E8F0]">Drawing Tools</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => store.undo()}
                      disabled={store.historyIndex <= 0}
                      className="text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      onClick={() => store.redo()}
                      disabled={store.historyIndex >= store.history.length - 1}
                      className="text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <Redo2 size={16} />
                    </button>
                    <div className="w-[1px] h-5 bg-slate-700 mx-1"></div>
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase font-bold tracking-wider text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors border border-red-500/30"
                    >
                      <Trash2 size={12} />
                      Clear
                    </button>
                  </div>
                </div>

                {/* Tools category */}
                <div className="mb-4">
                  <div className={`flex gap-2 overflow-x-auto pb-3 pt-1 snap-x ${scrollbarClasses}`}>
                    {TOOLS.map((t, idx) => {
                      const isActive = store.activeTool === t.id || (t.id === 'triangle' && ['pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon'].includes(store.activeTool));
                      return (
                          <button
                            key={t.id}
                            onClick={() => store.setActiveTool(t.id)}
                            className={`flex flex-col items-center justify-center gap-1 w-[60px] h-[64px] rounded-xl transition-all shrink-0 snap-start border ${
                              isActive 
                                ? 'text-blue-500 border-blue-600 bg-blue-50 dark:bg-[#0F1C3F] shadow-[0_0_15px_rgba(37,99,235,0.15)] scale-100' 
                                : 'text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121A2F] hover:bg-slate-100 dark:hover:bg-[#162038]'
                            }`}
                          >
                          <div className={`p-0.5 flex items-center justify-center`}>
                            {t.id === 'triangle' && isActive && !['triangle', 'rectangle', 'square'].includes(store.activeTool) ? (
                              store.activeTool === 'pentagon' ? <Pentagon size={18} /> : 
                              store.activeTool === 'hexagon' ? <Hexagon size={18} /> : 
                              <div className="flex items-center justify-center w-[18px] h-[18px] font-bold text-[10px] rounded border border-current">{store.polygonSides}</div>
                            ) : (
                              t.icon && React.cloneElement(t.icon as React.ReactElement<any>, { size: 18 })
                            )}
                          </div>
                          <span className="text-[9px] font-medium">
                            {t.id === 'triangle' && isActive && !['triangle', 'rectangle', 'square'].includes(store.activeTool) 
                               ? (store.activeTool === 'polygon' ? 'Polygon' : store.activeTool.charAt(0).toUpperCase() + store.activeTool.slice(1)) 
                               : t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Options Section */}
                {store.activeTool !== 'eraser' && (store.activeTool !== 'select' || store.selectedAnnotationIds.length > 0) && (
                  <div className="flex flex-col gap-6 mb-8">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Properties</h3>
                    
                    {/* Colors */}
                     <div className="flex flex-col gap-3">
                       <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Color</span>
                       <div className={`flex items-center gap-4 overflow-x-auto py-2 px-2 -mx-2 ${scrollbarClasses}`}>
                         {COLORS.map(c => (
                           <button
                             key={c}
                             onClick={() => store.setColor(c)}
                             className={`w-7 h-7 rounded-full shrink-0 transition-all relative ${store.color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-[#0b1120] ring-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border border-slate-700'}`}
                             style={{ 
                               backgroundColor: c === 'transparent' ? 'rgba(255,255,255,0.05)' : c,
                               backgroundImage: c === 'transparent' ? 'linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee)' : 'none',
                               backgroundSize: c === 'transparent' ? '8px 8px' : 'auto',
                               backgroundPosition: c === 'transparent' ? '0 0, 4px 4px' : 'auto',
                             }}
                           />
                         ))}
                         <Popover>
                           <PopoverTrigger className="relative shrink-0 w-7 h-7 rounded-full border border-slate-700 overflow-hidden flex items-center justify-center bg-[conic-gradient(from_90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] hover:scale-110 transition-transform">
                             <div className="absolute inset-1 rounded-full bg-[#0b1120] flex items-center justify-center"></div>
                           </PopoverTrigger>
                           <PopoverContent side="top" sideOffset={10} className="w-auto p-3 bg-slate-900 border-slate-800 rounded-2xl z-[300]">
                              <HexAlphaColorPicker color={store.color} onChange={store.setColor} />
                           </PopoverContent>
                         </Popover>
                       </div>
                     </div>
                    
                    {/* Values grouping */}
                    <div className="flex flex-col gap-6 bg-slate-50 dark:bg-[#121A2F] p-5 rounded-[24px] border border-slate-200 dark:border-slate-800/80">
                      <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                           <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-300 uppercase">Stroke Width</span>
                           <span className="text-[11px] text-slate-800 dark:text-slate-100 font-mono font-medium bg-slate-200 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">{store.width}px</span>
                         </div>
                         <Slider min={1} max={50} value={store.width} onValueChange={v => store.setWidth(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                      </div>
                      
                      <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                           <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">Opacity</span>
                           <span className="text-[11px] text-slate-100 font-mono font-medium bg-slate-800/80 px-2 py-0.5 rounded-md">{Math.round(store.opacity * 100)}%</span>
                         </div>
                         <Slider min={0.1} max={1} step={0.05} value={store.opacity} onValueChange={v => store.setOpacity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                      </div>
                      
                      <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                           <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">Glow</span>
                           <span className="text-[11px] text-slate-100 font-mono font-medium bg-slate-800/80 px-2 py-0.5 rounded-md">{store.glowIntensity}%</span>
                         </div>
                         <Slider min={0} max={20} value={store.glowIntensity} onValueChange={v => store.setGlowIntensity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                      </div>
                      
                      <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                           <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">Smoothing</span>
                           <span className="text-[11px] text-slate-100 font-mono font-medium bg-slate-800/80 px-2 py-0.5 rounded-md">{Math.round(store.smoothing * 100)}%</span>
                         </div>
                         <Slider min={0} max={1} step={0.1} value={store.smoothing} onValueChange={v => store.setSmoothing(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                      </div>
                      
                      <div className="flex flex-col gap-4 pt-4 border-t border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id="mobile-auto-shape"
                            checked={store.autoShapeDetection} 
                            onCheckedChange={(checked) => store.setAutoShapeDetection(checked === true)} 
                            className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 bg-transparent h-5 w-5 rounded-[4px]"
                          />
                          <label 
                            htmlFor="mobile-auto-shape" 
                            className="text-[11px] font-semibold text-slate-400 uppercase cursor-pointer transition-colors"
                          >
                            Auto Shape
                          </label>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                id="mobile-fill-enabled"
                                checked={store.fillEnabled} 
                                onCheckedChange={(checked) => store.setFillEnabled(checked === true)} 
                                className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 bg-transparent h-5 w-5 rounded-[4px]"
                              />
                              <label 
                                htmlFor="mobile-fill-enabled" 
                                className="text-[11px] font-semibold text-slate-400 uppercase cursor-pointer transition-colors"
                              >
                                Fill Shape
                              </label>
                            </div>
                            {store.fillEnabled && (
                              <Popover>
                                <PopoverTrigger className="w-5 h-5 rounded-full border-[1.5px] border-white shadow-[0_0_0_2px_rgba(255,255,255,0.1)] transition-transform hover:scale-110" style={{ backgroundColor: store.fillColor }} />
                                <PopoverContent className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[9999] pointer-events-none" align="end" side="top" sideOffset={10}>
                                  <div 
                                    className="flex flex-col gap-3 p-4 bg-[#121A2F] border border-slate-700 shadow-xl rounded-2xl transition-transform origin-bottom-right pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <HexAlphaColorPicker color={store.fillColor} onChange={(c) => store.setFillColor(c)} className="!w-full" />
                                    <div className="flex items-center gap-1.5 flex-wrap max-w-[200px]">
                                      {COLORS.map(c => (
                                        <button key={c} onClick={() => store.setFillColor(c)} className="w-5 h-5 rounded-full border border-transparent hover:border-white shadow-sm" style={{ backgroundColor: c }} />
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          {store.fillEnabled && (
                            <div className="flex flex-col gap-4 pl-8 animate-in slide-in-from-top-1 duration-200">
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Fill Opacity</span>
                                 <span className="text-[10px] text-slate-300 font-mono font-medium bg-slate-800/80 px-2 py-0.5 rounded-md">{Math.round(store.fillOpacity * 100)}%</span>
                               </div>
                               <Slider min={0.05} max={1} step={0.05} value={store.fillOpacity} onValueChange={v => store.setFillOpacity(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Function Brush special settings inside drawer */}
                    {store.activeTool === 'function-brush' && (
                      <div className="flex flex-col gap-4 mb-4">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#3B82F6]">Function Math</h3>
                            {store.functionExpression && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={handleCopyExpression}
                                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors border border-blue-500/20"
                                  title="Copy Expression"
                                >
                                  {expressionCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                  {expressionCopied ? 'Copied' : 'Copy'}
                                </button>
                                <button 
                                  onClick={() => store.setFunctionExpression('')}
                                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors border border-red-500/20"
                                  title="Clear"
                                >
                                  <Trash2 size={12} />
                                  Clear
                                </button>
                              </div>
                            )}
                         </div>
                         
                         <div className="flex items-center bg-[#121A2F] border border-slate-800 rounded-xl overflow-hidden p-1 shadow-inner">
                            <span className="text-blue-500 font-mono font-bold px-3">{"f(x) ="}</span>
                            <div className="w-[1px] h-6 bg-slate-800"></div>
                            <input 
                              ref={mobileMainInputRef}
                              type="text" 
                              className="flex-1 bg-transparent px-3 py-2 text-[13px] font-mono focus:outline-none text-slate-200 w-full"
                              placeholder="sin(x)"
                              value={store.functionExpression}
                              onChange={(e) => store.setFunctionExpression(e.target.value)}
                            />
                            <div className="flex items-center gap-1 px-2">
                               <div className="text-slate-600 ml-1 pr-2"><Sigma size={14} /></div>
                            </div>
                         </div>
                         
                         <LaTeXPreview 
                           expression={store.functionExpression} 
                           className="mb-2" 
                           onSelect={() => mobileMainInputRef.current?.focus()}
                         />
                         
                         <div className="flex flex-wrap gap-2">
                           {FUNCTION_PRESETS.map((preset) => {
                             const isSelected = store.functionExpression === preset.expr;
                             return (
                               <button
                                 key={preset.label}
                                 onClick={() => store.setFunctionExpression(preset.expr)}
                                 className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 border ${
                                   isSelected 
                                     ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20 active:scale-95' 
                                     : 'bg-[#121A2F] text-slate-300 hover:bg-[#1A2540] border-slate-800/80 hover:border-slate-700'
                                 }`}
                               >
                                 {preset.label}
                               </button>
                             );
                           })}
                           
                           <Popover open={isMoreOpen} onOpenChange={(open) => { setIsMoreOpen(open); if(!open) setSearchQuery(''); }}>
                             <PopoverTrigger className="px-2 py-1 text-[10px] font-semibold rounded-md bg-[#121A2F] text-blue-400 hover:bg-[#1A2540] border border-blue-500/30 transition-colors flex items-center gap-1">
                               More <ChevronUp size={12} className="rotate-180" />
                             </PopoverTrigger>
                             <PopoverContent className="w-[min(260px,85vw)] p-3 bg-[#0b1120] border-slate-800 rounded-xl z-[300] max-h-[350px] overflow-y-auto custom-scrollbar">
                               <div className="flex flex-col gap-3">
                                 <div className="flex flex-col gap-1.5">
                                   <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Search or Custom</span>
                                   <div className="flex flex-col gap-2">
                                     <input 
                                       ref={mobileSearchRef}
                                       type="text"
                                       placeholder="Search functions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                       className="flex-1 px-2.5 py-2 text-[11px] bg-[#121A2F] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 font-mono ring-offset-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                       onKeyDown={(e) => {
                                         if (e.key === 'Enter') {
                                           const val = searchQuery.trim();
                                           if (val) {
                                             store.setFunctionExpression(val);
                                             setIsMoreOpen(false);
                                           }
                                         }
                                       }}
                                     />
                                     <LaTeXPreview 
                                       expression={searchQuery} 
                                       onSelect={() => mobileSearchRef.current?.focus()}
                                     />
                                   </div>
                                 </div>

                                  {MORE_FUNCTIONS.map((group) => {
                                    const filteredItems = group.items.filter(item => 
                                      item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      item.expr.toLowerCase().includes(searchQuery.toLowerCase())
                                    );
                                    if (filteredItems.length === 0) return null;
                                    
                                    return (
                                      <div key={group.group} className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{group.group}</span>
                                        <div className="grid grid-cols-2 gap-1">
                                          {filteredItems.map((item) => (
                                            <button
                                              key={item.label}
                                              onClick={() => {
                                                store.setFunctionExpression(item.expr);
                                                setIsMoreOpen(false);
                                              }}
                                              className={`px-1.5 py-1 text-[9px] text-left rounded transition-all font-mono border ${
                                                 store.functionExpression === item.expr
                                                   ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                                   : 'bg-[#121A2F] text-slate-300 hover:bg-blue-600/20 hover:text-blue-400 border-slate-800 hover:border-blue-500/30'
                                               }`}
                                            >
                                              {item.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Dynamic suggestions from a larger list */}
                                  {searchQuery.length >= 1 && (
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70">Suggestions</span>
                                      <div className="flex flex-wrap gap-1">
                                        {SUGGESTED_MATH_FUNCTIONS
                                          .filter(fn => fn.toLowerCase().includes(searchQuery.toLowerCase()))
                                          .filter(fn => !MORE_FUNCTIONS.some(g => g.items.some(i => i.expr.includes(fn))))
                                          .slice(0, 10)
                                          .map(fn => (
                                            <button
                                              key={fn}
                                              onClick={() => {
                                                store.setFunctionExpression(`${fn}(x)`);
                                                setIsMoreOpen(false);
                                              }}
                                              className="px-2 py-0.5 text-[9px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-mono"
                                            >
                                              {fn}(x)
                                            </button>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}

                                  {searchQuery && !MORE_FUNCTIONS.some(g => g.items.some(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()))) && (
                                    <button 
                                      onClick={() => {
                                        store.setFunctionExpression(searchQuery);
                                        setIsMoreOpen(false);
                                      }}
                                      className="mt-2 w-full py-2 text-[10px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-lg hover:bg-blue-600/30 transition-all"
                                    >
                                      Use "{searchQuery}"
                                    </button>
                                  )}
                               </div>
                             </PopoverContent>
                           </Popover>
                         </div>
                         
                         {/* Function specific sliders grid */}
                         <div className="grid grid-cols-2 gap-3 mt-2">
                           {[
                             { label: 'Amplitude', value: store.functionAmplitude, setter: store.setFunctionAmplitude, max: 200, step: 1 },
                             { label: 'Frequency', value: store.functionFrequency, setter: store.setFunctionFrequency, max: 1, step: 0.01 },
                             { label: 'Phase', value: store.functionPhase, setter: store.setFunctionPhase, max: 6.28, step: 0.1 },
                             { label: 'Smoothness', value: store.functionSmoothness, setter: store.setFunctionSmoothness, max: 20, step: 0.5 },
                           ].map(item => (
                             <div key={item.label} className="bg-[#121A2F] p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3">
                               <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase">{item.label}</span>
                                 <span className="text-[10px] text-slate-200 font-mono font-medium">{typeof item.value === 'number' ? item.value.toFixed(item.step < 1 ? 2 : 0) : item.value}</span>
                               </div>
                               <Slider min={item.step === 0.01 ? 0.01 : 0} max={item.max} step={item.step} value={item.value} onValueChange={v => item.setter(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                             </div>
                           ))}
                         </div>
                      </div>
                    )}

                    {/* Highlighter specifics */}
                    {store.activeTool === 'highlighter' && (
                      <div className="flex flex-col gap-4 px-2 bg-yellow-500/10 p-4 rounded-2xl border border-yellow-500/20">
                         <span className="text-[11px] font-bold tracking-wider text-yellow-500 uppercase">Fading Options</span>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="flex flex-col gap-2">
                             <span className="text-[10px] text-yellow-600/80">Wait (s)</span>
                             <input type="number" min="0" step="0.5" value={store.blinkDuration} onChange={e => store.setBlinkDuration(Number(e.target.value))} className="w-full bg-[#121A2F] px-3 py-2 rounded-lg outline-none border border-slate-800 text-sm text-slate-200" />
                           </div>
                           <div className="flex flex-col gap-2">
                             <span className="text-[10px] text-yellow-600/80">Fade (s)</span>
                             <input type="number" min="0" step="0.5" value={store.fadeOutDuration} onChange={e => store.setFadeOutDuration(Number(e.target.value))} className="w-full bg-[#121A2F] px-3 py-2 rounded-lg outline-none border border-slate-800 text-sm text-slate-200" />
                           </div>
                         </div>
                      </div>
                    )}

                    {/* Arrow specifics */}
                    {store.activeTool === 'arrow' && (
                      <div className="flex flex-col gap-6 bg-slate-50 dark:bg-[#121A2F] p-5 rounded-[24px] border border-slate-200 dark:border-slate-800/80 mt-4">
                        <div className="flex flex-col gap-2 w-full">
                          <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-300 uppercase flex justify-between gap-4">
                            Tip Shape 
                          </span>
                           <select 
                             value={store.arrowTipStyle} 
                             onChange={e => store.setArrowTipStyle(e.target.value as any)}
                             className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 outline-none text-xs rounded-lg px-2 py-2 text-slate-700 dark:text-slate-300 w-full font-medium"
                           >
                              <option value="triangle">Triangle</option>
                              <option value="default">Open</option>
                              <option value="stealth">Stealth</option>
                              <option value="diamond">Diamond</option>
                              <option value="circle">Circle</option>
                              <option value="none">None</option>
                              <option value="custom-math">Custom Math</option>
                           </select>
                           {store.arrowTipStyle === 'custom-math' && (
                             <div className="flex flex-col gap-2 w-full mt-2">
                               <div className="relative group">
                                 <input
                                   type="text"
                                   value={store.customArrowTipEquation}
                                   onChange={e => store.setCustomArrowTipEquation(e.target.value)}
                                   className="w-full bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                                   placeholder="e.g. size * cos(theta)"
                                 />
                               </div>
                               <LaTeXPreview expression={store.customArrowTipEquation} className="!p-1.5 !rounded-lg bg-white dark:bg-[#0b1120]" />
                               
                               <div className="flex flex-wrap gap-1 mt-1">
                                 {ARROW_TIP_PRESETS.map((preset) => (
                                   <button
                                     key={preset.label}
                                     onClick={() => store.setCustomArrowTipEquation(preset.expr)}
                                     className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all border ${
                                       store.customArrowTipEquation === preset.expr 
                                         ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                                         : 'bg-white dark:bg-[#0b1120] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                     }`}
                                   >
                                     {preset.label}
                                   </button>
                                 ))}
                               </div>
                             </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                          <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-300 uppercase flex justify-between gap-4">
                            Line Style 
                          </span>
                           <select 
                             value={store.arrowLineStyle} 
                             onChange={e => store.setArrowLineStyle(e.target.value as any)}
                             className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 outline-none text-xs rounded-lg px-2 py-2 text-slate-700 dark:text-slate-300 w-full font-medium"
                           >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                              <option value="curly">Curly</option>
                              <option value="custom-math">Custom Math</option>
                           </select>
                           {store.arrowLineStyle === 'custom-math' && (
                             <div className="flex flex-col gap-2 w-full mt-2">
                               <div className="relative group">
                                 <input
                                   type="text"
                                   value={store.customArrowLineEquation}
                                   onChange={e => store.setCustomArrowLineEquation(e.target.value)}
                                   className="w-full bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                                   placeholder="e.g. sin(t * dist)"
                                 />
                               </div>
                               <LaTeXPreview expression={store.customArrowLineEquation} className="!p-1.5 !rounded-lg bg-white dark:bg-[#0b1120]" />
                               
                               <div className="flex flex-wrap gap-1 mt-1">
                                 {ARROW_LINE_PRESETS.map((preset) => (
                                   <button
                                     key={preset.label}
                                     onClick={() => store.setCustomArrowLineEquation(preset.expr)}
                                     className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all border ${
                                       store.customArrowLineEquation === preset.expr 
                                         ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                                         : 'bg-white dark:bg-[#0b1120] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                     }`}
                                   >
                                     {preset.label}
                                   </button>
                                 ))}
                               </div>
                             </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-4">
                           <div className="flex items-center justify-between">
                             <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-300 uppercase">Tip Size</span>
                             <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-200">{store.arrowTipSize}px</span>
                           </div>
                           <Slider min={5} max={50} value={store.arrowTipSize} onValueChange={v => store.setArrowTipSize(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-4 mt-2">
                       <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#3B82F6]">Brush Style</h3>
                       <div className={`flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x ${scrollbarClasses}`}>
                         {BRUSHES.map(b => (
                           <button
                             key={b.id}
                             title={b.label}
                             onClick={() => store.setBrushStyle(b.id)}
                             className={`shrink-0 flex items-center justify-center w-[72px] h-[48px] rounded-xl transition-all border snap-start ${
                               store.brushStyle === b.id
                                 ? 'bg-[#121A2F] border-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.2)] text-blue-400'
                                 : 'bg-transparent border-slate-800 hover:bg-[#121A2F]/50 text-slate-500'
                             }`}
                           >
                              {/* Simple brush preview SVG */}
                              <svg width="48" height="24" viewBox="0 0 48 24">
                                <path 
                                  d="M 4 12 Q 12 4 24 12 T 44 12" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  style={{
                                    strokeDasharray: b.id === 'dashed' ? '4 4' : 'none',
                                    filter: b.id === 'neon-glow' ? 'drop-shadow(0px 0px 3px currentColor)' : 'none',
                                    opacity: b.id === 'soft-highlighter' ? 0.6 : 1
                                  }}
                                />
                                {b.id === 'rough-handdrawn' && (
                                  <path d="M 4 11.5 Q 12 3 24 11 T 44 11.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
                                )}
                              </svg>
                           </button>
                         ))}
                         <button className="shrink-0 flex items-center justify-center w-[48px] h-[48px] rounded-xl border border-slate-800 text-slate-400 hover:bg-[#121A2F]/50 transition-colors">
                           <span className="text-xl leading-none font-light">+</span>
                         </button>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function InternalScaleSlider({ 
  initialScale, 
  toolbarRef, 
  popoverContentRef, 
  onScaleCommitted,
  onAdjusting
}: { 
  initialScale: number;
  toolbarRef: React.RefObject<HTMLDivElement>;
  popoverContentRef: React.RefObject<HTMLDivElement>;
  onScaleCommitted: (val: number) => void;
  onAdjusting: (adjusting: boolean) => void;
}) {
  const [val, setVal] = useState(initialScale);
  
  useEffect(() => {
    setVal(initialScale);
  }, [initialScale]);

  return (
    <Slider 
      min={0.5} 
      max={2} 
      step={0.01} 
      value={[val]} 
      onValueChange={(v) => {
        const n = Array.isArray(v) ? v[0] : (v as number);
        setVal(n);
        onAdjusting(true);
        if (toolbarRef.current) {
          toolbarRef.current.style.setProperty('--toolbar-scale', n.toString());
        }
        if (popoverContentRef.current) {
          popoverContentRef.current.style.transform = `scale(${n})`;
        }
      }} 
      onValueCommitted={(v) => {
        const n = Array.isArray(v) ? v[0] : (v as number);
        onScaleCommitted(n);
        onAdjusting(false);
      }} 
    />
  );
}

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
  const [isDragging, setIsDragging] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isToolbarVisible) {
      const timer = setTimeout(() => setIsInitialLoad(false), 500);
      return () => clearTimeout(timer);
    } else {
      setIsInitialLoad(true);
    }
  }, [isToolbarVisible]);

  const [resizingMode, setResizingMode] = useState<'none' | 'scale' | 'options' | 'function' | 'arrow'>('none');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expressionCopied, setExpressionCopied] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const desktopMainInputRef = useRef<HTMLInputElement>(null);

  const handleCopyExpression = () => {
    navigator.clipboard.writeText(store.functionExpression);
    setExpressionCopied(true);
    setTimeout(() => setExpressionCopied(false), 2000);
  };

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

  const [localOptionsSize, setLocalOptionsSize] = useState({ w: store.optionsPanelWidth, h: store.optionsPanelHeight });
  const [localFunctionSize, setLocalFunctionSize] = useState({ w: store.functionPanelWidth, h: store.functionPanelHeight });
  const [localArrowSize, setLocalArrowSize] = useState({ w: store.arrowPanelWidth, h: store.arrowPanelHeight });
  const [localScale, setLocalScale] = useState(store.toolbarScale);
  const [isAdjustingScale, setIsAdjustingScale] = useState(false);

  const scaleRef = useRef(localScale);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const optionsSizeRef = useRef(localOptionsSize);
  const functionSizeRef = useRef(localFunctionSize);
  const arrowSizeRef = useRef(localArrowSize);

  useLayoutEffect(() => {
    scaleRef.current = localScale;
  }, [localScale]);

  useLayoutEffect(() => {
    optionsSizeRef.current = localOptionsSize;
  }, [localOptionsSize]);

  useLayoutEffect(() => {
    functionSizeRef.current = localFunctionSize;
  }, [localFunctionSize]);

  useLayoutEffect(() => {
    arrowSizeRef.current = localArrowSize;
  }, [localArrowSize]);

  // Sync store -> local only when NOT interacting
  useEffect(() => {
    if (resizingMode === 'none' && !isDragging) {
      setLocalScale(store.toolbarScale);
      if (toolbarRef.current) {
        toolbarRef.current.style.setProperty('--toolbar-scale', store.toolbarScale.toString());
      }
    }
  }, [store.toolbarScale, resizingMode, isDragging]);

  useEffect(() => {
    if (resizingMode === 'none' && !isDragging) {
      setLocalOptionsSize({ w: store.optionsPanelWidth, h: store.optionsPanelHeight });
      if (toolbarRef.current) {
        toolbarRef.current.style.setProperty('--options-w', `${store.optionsPanelWidth}px`);
        toolbarRef.current.style.setProperty('--options-h', `${store.optionsPanelHeight}px`);
      }
    }
  }, [store.optionsPanelWidth, store.optionsPanelHeight, resizingMode, isDragging]);

  useEffect(() => {
    if (resizingMode === 'none' && !isDragging) {
      setLocalFunctionSize({ w: store.functionPanelWidth, h: store.functionPanelHeight });
      if (toolbarRef.current) {
        toolbarRef.current.style.setProperty('--function-w', `${store.functionPanelWidth}px`);
        toolbarRef.current.style.setProperty('--function-h', `${store.functionPanelHeight}px`);
      }
    }
  }, [store.functionPanelWidth, store.functionPanelHeight, resizingMode, isDragging]);

  useEffect(() => {
    if (resizingMode === 'none' && !isDragging) {
      setLocalArrowSize({ w: store.arrowPanelWidth, h: store.arrowPanelHeight });
      if (toolbarRef.current) {
        toolbarRef.current.style.setProperty('--arrow-w', `${store.arrowPanelWidth}px`);
        toolbarRef.current.style.setProperty('--arrow-h', `${store.arrowPanelHeight}px`);
      }
    }
  }, [store.arrowPanelWidth, store.arrowPanelHeight, resizingMode, isDragging]);

  useLayoutEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Use the stable scaleRef to avoid re-binding this listener on every scale change
      const currentScale = scaleRef.current;

      if (resizingMode === 'options') {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newW = Math.max(200, Math.min(1200, dragRef.current.initX + dx / currentScale));
        const newH = Math.max(150, Math.min(800, dragRef.current.initY + dy / currentScale));
        
        optionsSizeRef.current = { w: newW, h: newH };
        if (toolbarRef.current) {
          toolbarRef.current.style.setProperty('--options-w', `${newW}px`);
          toolbarRef.current.style.setProperty('--options-h', `${newH}px`);
        }
        
        if (document.body.style.cursor !== 'nwse-resize') {
          document.body.style.cursor = 'nwse-resize';
        }
      } else if (resizingMode === 'function') {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newW = Math.max(240, Math.min(1200, dragRef.current.initX + dx / currentScale));
        const newH = Math.max(200, Math.min(1000, dragRef.current.initY + dy / currentScale));
        
        functionSizeRef.current = { w: newW, h: newH };
        if (toolbarRef.current) {
          toolbarRef.current.style.setProperty('--function-w', `${newW}px`);
          toolbarRef.current.style.setProperty('--function-h', `${newH}px`);
        }
        
        if (document.body.style.cursor !== 'nwse-resize') {
          document.body.style.cursor = 'nwse-resize';
        }
      } else if (resizingMode === 'arrow') {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newW = Math.max(240, Math.min(1200, dragRef.current.initX + dx / currentScale));
        const newH = Math.max(200, Math.min(1000, dragRef.current.initY + dy / currentScale));
        
        arrowSizeRef.current = { w: newW, h: newH };
        if (toolbarRef.current) {
          toolbarRef.current.style.setProperty('--arrow-w', `${newW}px`);
          toolbarRef.current.style.setProperty('--arrow-h', `${newH}px`);
        }
        
        if (document.body.style.cursor !== 'nwse-resize') {
          document.body.style.cursor = 'nwse-resize';
        }
      } else if (resizingMode === 'scale') {
        // We use the start position to calculate distance instead of rect to avoid jumping
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        
        // Use diagonal delta for more natural scaling feel
        const sensitivity = 0.004;
        const diagonalDelta = (dx + dy) / 1.414;
        const newScale = Math.max(0.4, Math.min(2.5, dragRef.current.initX + (diagonalDelta * sensitivity)));
        
        scaleRef.current = newScale;
        if (toolbarRef.current) {
          toolbarRef.current.style.setProperty('--toolbar-scale', newScale.toString());
        }
        
        if (document.body.style.cursor !== 'nwse-resize') {
          document.body.style.cursor = 'nwse-resize';
        }
      } else if (dragRef.current.isDragging) {
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
        if (document.body.style.cursor !== 'move') {
          document.body.style.cursor = 'move';
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      // Sync everything back to store and local state on release
      if (resizingMode === 'scale') {
        setToolbarScale(scaleRef.current);
        setLocalScale(scaleRef.current);
      } else if (resizingMode === 'options') {
        store.setOptionsPanelWidth(optionsSizeRef.current.w);
        store.setOptionsPanelHeight(optionsSizeRef.current.h);
        setLocalOptionsSize(optionsSizeRef.current);
      } else if (resizingMode === 'function') {
        store.setFunctionPanelWidth(functionSizeRef.current.w);
        store.setFunctionPanelHeight(functionSizeRef.current.h);
        setLocalFunctionSize(functionSizeRef.current);
      } else if (resizingMode === 'arrow') {
        store.setArrowPanelWidth(arrowSizeRef.current.w);
        store.setArrowPanelHeight(arrowSizeRef.current.h);
        setLocalArrowSize(arrowSizeRef.current);
      }
      
      // Cleanup
      document.body.style.cursor = '';
      document.body.classList.remove('select-none');
      dragRef.current.isDragging = false;
      setIsDragging(false);
      setResizingMode('none');
    };

    if (resizingMode !== 'none' || isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingMode, isDragging, isVert, setToolbarPosition, setToolbarScale]);

  // The effects above handle bidirectional synchronization correctly by checking interaction state.
  // We don't need a separate effect that might trigger infinite loops.

  if (!isToolbarVisible) return null;

  let placementClass = '';
  let placementStyle = {};
  if (toolbarPlacement === 'drag') {
    placementStyle = { left: toolbarPosition.x, top: toolbarPosition.y };
    placementClass = 'flex-row items-start';
  } else {
    switch (toolbarPlacement) {
      case 'top-left': placementClass = isVert ? 'top-4 left-4 flex-row items-start' : 'top-4 left-4 flex-col items-start'; break;
      case 'top-center': placementClass = isVert ? 'top-4 left-1/2 -translate-x-1/2 flex-row items-start' : 'top-4 left-1/2 -translate-x-1/2 flex-col items-center'; break;
      case 'top-right': placementClass = isVert ? 'top-4 right-4 flex-row-reverse items-start' : 'top-4 right-4 flex-col items-end'; break;
      case 'bottom-left': placementClass = isVert ? 'bottom-4 left-4 flex-row items-start' : 'bottom-4 left-4 flex-col-reverse items-start'; break;
      case 'bottom-center': placementClass = isVert ? 'bottom-4 left-1/2 -translate-x-1/2 flex-row items-start' : 'bottom-4 left-1/2 -translate-x-1/2 flex-col-reverse items-center'; break;
      case 'bottom-right': placementClass = isVert ? 'bottom-4 right-4 flex-row-reverse items-start' : 'bottom-4 right-4 flex-col-reverse items-end'; break;
    }
  }

  const onPlacementChange = (placement: typeof toolbarPlacement) => {
    setToolbarPlacement(placement);
    setShowConfig(false);
  };

  const transformOrigin = (() => {
    if (toolbarPlacement === 'drag') return 'center center';
    const parts = toolbarPlacement.split('-');
    if (parts.length === 2) {
      const vert = parts[0] === 'top' ? 'top' : (parts[0] === 'bottom' ? 'bottom' : 'center');
      const horiz = parts[1] === 'left' ? 'left' : (parts[1] === 'right' ? 'right' : 'center');
      return `${vert} ${horiz}`;
    }
    return 'center center';
  })();

  if (isMobile) {
    return <MobileDrawingToolbar isInitialLoad={isInitialLoad} />;
  }

  return (
    <div 
      ref={toolbarRef}
      className={`absolute flex z-[100] gap-2 ${isInitialLoad ? 'animate-in fade-in zoom-in-95 duration-200' : ''} ${placementClass} pointer-events-none`}
      style={{ 
        ...placementStyle, 
        opacity: toolbarOpacity, 
        visibility: toolbarOpacity < 0.05 ? 'hidden' : 'visible',
        '--toolbar-scale': store.toolbarScale.toString(),
        '--options-w': `${localOptionsSize.w}px`,
        '--options-h': `${localOptionsSize.h}px`,
        '--function-w': `${localFunctionSize.w}px`,
        '--function-h': `${localFunctionSize.h}px`,
        '--arrow-w': `${localArrowSize.w}px`,
        '--arrow-h': `${localArrowSize.h}px`,
        transform: `scale(var(--toolbar-scale))`,
        transformOrigin: transformOrigin,
        transition: isDragging || resizingMode !== 'none' || isAdjustingScale ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: (resizingMode !== 'none' || isDragging || isAdjustingScale) ? 'transform' : 'auto'
      } as React.CSSProperties}
    >
      {/* Main Toolbelt */}
      <div className={`pointer-events-auto flex ${isVert ? 'flex-col' : 'flex-row'} items-center gap-1.5 p-1 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/80 relative group ${isDragging || resizingMode !== 'none' ? 'cursor-grabbing transition-none' : 'transition-all duration-300'}`}>
        <div className="flex gap-1 p-1">
           <button 
             onClick={() => store.setIsToolbarVisible(false)}
             className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
             title="Close Toolbar"
           >
             <X size={12} />
           </button>
           {toolbarPlacement === 'drag' && (
             <div 
               className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg"
               onPointerDown={(e) => {
                 e.currentTarget.setPointerCapture(e.pointerId);
                 setIsDragging(true);
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
                 setIsDragging(false);
                 dragRef.current.isDragging = false;
               }}
             >
               {isVert ? <GripHorizontal size={12} /> : <GripVertical size={12} />}
             </div>
           )}
           <Popover open={showConfig} onOpenChange={setShowConfig}>
             <PopoverTrigger 
               className={`p-1.5 rounded-lg transition-colors ${showConfig ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
               title="Toolbar Configuration"
             >
               <MoreHorizontal size={12} />
             </PopoverTrigger>
             <PopoverContent 
               className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[110] pointer-events-none" 
               align="start" 
               sideOffset={10}
             >
               <div 
                 className="w-[180px] p-3 text-xs flex flex-col gap-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl text-slate-900 dark:text-slate-200 transition-transform origin-top-left pointer-events-auto"
                 style={{ 
                   transform: `scale(${localScale})`
                 }}
               >
                <div className="flex items-center justify-between px-2 py-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Scale</span>
                  <button 
                    onClick={() => setToolbarScale(1)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-blue-500 transition-colors"
                    title="Reset Scale"
                  >
                    <RotateCcw size={8} />
                  </button>
                </div>
                <div className="px-2 pb-2">
                  <InternalScaleSlider 
                    initialScale={store.toolbarScale}
                    toolbarRef={toolbarRef}
                    popoverContentRef={popoverContentRef}
                    onScaleCommitted={(val) => {
                      setToolbarScale(val);
                      setLocalScale(val);
                    }}
                    onAdjusting={setIsAdjustingScale}
                  />
                </div>
                <div className="h-[1px] bg-slate-200 dark:bg-slate-700 my-0.5" />
                <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5">Position</span>
                <div className="grid grid-cols-3 gap-1 px-1">
                  <button onClick={() => onPlacementChange('top-left')} title="Top Left" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-left' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUpLeft size={12} /></button>
                  <button onClick={() => onPlacementChange('top-center')} title="Top Center" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-center' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUp size={12} /></button>
                  <button onClick={() => onPlacementChange('top-right')} title="Top Right" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'top-right' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowUpRight size={12} /></button>
                  <button onClick={() => onPlacementChange('bottom-left')} title="Bottom Left" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-left' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDownLeft size={12} /></button>
                  <button onClick={() => onPlacementChange('bottom-center')} title="Bottom Center" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-center' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDown size={12} /></button>
                  <button onClick={() => onPlacementChange('bottom-right')} title="Bottom Right" className={`p-1.5 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'bottom-right' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}><ArrowDownRight size={12} /></button>
                </div>
                <button onClick={() => onPlacementChange('drag')} className={`flex items-center gap-2 px-2 py-1.5 mx-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${toolbarPlacement === 'drag' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-500'}`}>
                  <Move size={10} />
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
                   <RotateCcw size={10} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Reset Defaults</span>
                 </button>
               </div>
             </PopoverContent>
           </Popover>
        </div>
        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <div className={`grid ${isVert ? 'grid-cols-2' : 'grid-rows-2 grid-flow-col'} gap-1 p-0.5`}>
          {TOOLS.map(t => {
            const isActive = store.activeTool === t.id || (t.id === 'triangle' && ['pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon'].includes(store.activeTool));
            return (
              <button
                key={t.id}
                onClick={() => store.setActiveTool(t.id)}
                title={t.id === 'triangle' && isActive && !['triangle', 'rectangle', 'square'].includes(store.activeTool) ? (store.activeTool === 'polygon' ? 'Polygon' : store.activeTool.charAt(0).toUpperCase() + store.activeTool.slice(1)) : t.label}
                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                  isActive 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.id === 'triangle' && isActive && !['triangle', 'rectangle', 'square'].includes(store.activeTool) ? (
                  store.activeTool === 'pentagon' ? <Pentagon size={14} /> : 
                  store.activeTool === 'hexagon' ? <Hexagon size={14} /> :
                  <div className="flex items-center justify-center w-[14px] h-[14px] font-bold text-[8px] rounded-sm border border-current">{store.polygonSides}</div>
                ) : (
                  t.icon
                )}
              </button>
            );
          })}
        </div>
        
        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <div className="grid grid-cols-2 gap-1 p-0.5">
          <button
            disabled={store.historyIndex <= 0}
            onClick={() => store.undo()}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            disabled={store.historyIndex >= store.history.length - 1}
            onClick={() => store.redo()}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className={isVert ? "w-8 h-[1px] bg-slate-200 dark:bg-slate-700" : "w-[1px] h-8 bg-slate-200 dark:bg-slate-700"} />
        
        <button
          onClick={handleClear}
          className="p-2 m-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
          title="Clear All"
        >
          <Trash2 size={14} />
        </button>

        {/* Resize Handle */}
        <div 
          className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-all flex items-end justify-end p-1 z-20 touch-none active:scale-90"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setResizingMode('scale');
            dragRef.current = {
              isDragging: false,
              startX: e.clientX,
              startY: e.clientY,
              initX: scaleRef.current,
              initY: scaleRef.current
            };
            document.body.style.cursor = 'nwse-resize';
            document.body.classList.add('select-none');
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="flex flex-col gap-[3px] items-end pr-1 pb-1 opacity-20 group-hover:opacity-40 transition-opacity">
            <div className="w-1 h-1 rounded-full bg-slate-500" />
            <div className="flex gap-[3px]">
              <div className="w-1 h-1 rounded-full bg-slate-500" />
              <div className="w-1 h-1 rounded-full bg-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Options Panel depending on tool */}
      {store.activeTool !== 'eraser' && (store.activeTool !== 'select' || store.selectedAnnotationIds.length > 0) && (
        <div 
          className={`pointer-events-auto flex flex-col p-0 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 relative group/options will-change-[width,height] overflow-hidden animate-in fade-in duration-300 ${resizingMode !== 'none' ? 'select-none transition-none shadow-2xl ring-2 ring-blue-500/10' : ''}`}
          style={{ 
            width: 'var(--options-w)',
            height: 'var(--options-h)',
            minWidth: '200px',
            minHeight: '150px',
            maxHeight: 'min(90vh, 800px)'
          } as React.CSSProperties}
        >
          {/* Top Notch Decor */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-b-full pointer-events-none" />
          
          {/* Bottom Notch Decor */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-t-full pointer-events-none" />

          {/* Resize Handle for Options Panel */}
          <div 
            className="absolute bottom-0 right-0 w-10 h-10 cursor-nwse-resize opacity-40 hover:opacity-100 transition-all flex items-end justify-end p-2 z-50 touch-none active:scale-90"
            style={{ 
              transform: `scale(${1 / localScale})`,
              transformOrigin: 'bottom right'
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizingMode('options');
              dragRef.current = {
                isDragging: false,
                startX: e.clientX,
                startY: e.clientY,
                initX: localOptionsSize.w,
                initY: localOptionsSize.h
              };
              document.body.style.cursor = 'nwse-resize';
              document.body.classList.add('select-none');
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-[3px] items-end pr-1.5 pb-1.5 opacity-20 hover:opacity-40 transition-opacity">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="flex gap-[3px]">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pr-5 scroll-smooth min-h-0 bg-white dark:bg-[#0b1120]">
            <div className={`flex ${isVert ? 'flex-col gap-6' : 'flex-wrap gap-x-8 gap-y-6 w-full'}`}>
              {/* Colors Section */}
              <div className={`flex flex-col gap-3 ${isVert ? 'pb-6 border-b border-slate-800' : 'pr-8 border-r border-slate-800/50'}`}>
                <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase mb-1">Colors</span>
                <div className={`grid ${isVert ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-3'} gap-3 w-fit relative`}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => store.setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${store.color === c ? 'scale-110 ring-2 ring-white/50 ring-offset-2 ring-offset-[#0b1120] shadow-lg' : 'hover:scale-105 opacity-90 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <Popover>
                    <PopoverTrigger 
                      className="w-7 h-7 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer hover:border-slate-500 transition-colors"
                      title="Custom Color"
                    >
                      <Plus size={14} className="text-slate-500" />
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[9999] pointer-events-none" 
                      align="center" 
                      side="top" 
                      sideOffset={10}
                    >
                      <div 
                        className="flex flex-col gap-3 p-4 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl transition-transform origin-bottom-center pointer-events-auto"
                        style={{ transform: `scale(${localScale})` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HexAlphaColorPicker color={store.color} onChange={(c) => store.setColor(c)} className="!w-full" />
                        <div className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
                          <div className="w-6 h-6 rounded-md shadow-inner" style={{ backgroundColor: store.color }} />
                          <input 
                            type="text" 
                            value={store.color}
                            onChange={(e) => store.setColor(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs font-mono w-24 uppercase text-slate-200"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Sliders Section 1: Width & Opacity */}
              <div className={`flex flex-col gap-6 ${isVert ? 'pb-6 border-b border-slate-800' : 'flex-1 pr-8 border-r border-slate-800/50'}`}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">Width</span>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 min-w-[36px] text-center">
                      {store.width}px
                    </div>
                  </div>
                  <Slider 
                    min={1} 
                    max={50} 
                    value={store.width} 
                    onValueChange={v => store.setWidth(Array.isArray(v) ? v[0] : (v as number))} 
                    className="w-full"
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">Opacity</span>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 min-w-[36px] text-center">
                      {Math.round(store.opacity * 100)}%
                    </div>
                  </div>
                  <Slider 
                    min={0.1} 
                    max={1} 
                    step={0.05} 
                    value={store.opacity} 
                    onValueChange={v => store.setOpacity(Array.isArray(v) ? v[0] : (v as number))} 
                    className="w-full"
                  />
                </div>
              </div>

              {/* Sliders Section 2: Glow & Smoothing */}
              <div className={`flex flex-col gap-6 ${isVert ? 'pb-6 border-b border-slate-800' : 'flex-1 pr-8 border-r border-slate-800/50'}`}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">Glow</span>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 min-w-[36px] text-center">
                      {store.glowIntensity}
                    </div>
                  </div>
                  <Slider 
                    min={0} 
                    max={20} 
                    value={store.glowIntensity} 
                    onValueChange={v => store.setGlowIntensity(Array.isArray(v) ? v[0] : (v as number))} 
                    className="w-full"
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">Smoothing</span>
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 min-w-[36px] text-center">
                      {Math.round(store.smoothing * 100)}%
                    </div>
                  </div>
                  <Slider 
                    min={0} 
                    max={1} 
                    step={0.1} 
                    value={store.smoothing} 
                    onValueChange={v => store.setSmoothing(Array.isArray(v) ? v[0] : (v as number))} 
                    className="w-full"
                  />
                </div>
              </div>

              {/* Options Section */}
              <div className={`flex flex-col gap-4 min-w-[140px] ${isVert ? 'pt-2' : ''}`}>
                <span className="text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">Style</span>
                <select 
                  value={store.brushStyle} 
                  onChange={e => store.setBrushStyle(e.target.value as BrushStyle)}
                  className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-xs rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%205%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[position:right_10px_center] bg-no-repeat pr-8"
                >
                  {BRUSHES.map(b => (
                    <option key={b.id} value={b.id} className="bg-white dark:bg-[#0b1120] text-slate-900 dark:text-slate-100">{b.label}</option>
                  ))}
                </select>
                
                <div className="flex items-center gap-3 mt-2 group cursor-pointer" onClick={() => store.setAutoShapeDetection(!store.autoShapeDetection)}>
                  <Checkbox 
                    id="auto-shape"
                    checked={store.autoShapeDetection} 
                    onCheckedChange={(checked) => store.setAutoShapeDetection(checked === true)}
                    className="border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                  />
                  <label 
                    htmlFor="auto-shape" 
                    className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer group-hover:text-slate-300 transition-colors"
                  >
                    Auto Shape
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between group cursor-pointer" onClick={() => store.setFillEnabled(!store.fillEnabled)}>
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="fill-enabled"
                        checked={store.fillEnabled} 
                        onCheckedChange={(checked) => store.setFillEnabled(checked === true)}
                        className="border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                      />
                      <label 
                        htmlFor="fill-enabled" 
                        className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer group-hover:text-slate-300 transition-colors"
                      >
                        Fill Shape
                      </label>
                    </div>
                    {store.fillEnabled && (
                      <Popover>
                        <PopoverTrigger 
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded-full border border-slate-700 shadow-inner group-hover:border-slate-500 transition-all" 
                          style={{ backgroundColor: store.fillColor }} 
                        />
                        <PopoverContent className="w-auto p-0 bg-transparent border-none shadow-none ring-0 z-[9999] pointer-events-none" align="end" side="top" sideOffset={10}>
                          <div 
                            className="flex flex-col gap-3 p-4 bg-[#0b1120] border border-slate-700 shadow-2xl rounded-2xl transition-transform origin-bottom-right pointer-events-auto"
                            style={{ transform: `scale(${localScale})` }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <HexAlphaColorPicker color={store.fillColor} onChange={(c) => store.setFillColor(c)} className="!w-full" />
                            <div className="flex items-center gap-2 flex-wrap max-w-[200px]">
                              {COLORS.map(c => (
                                <button 
                                  key={c} 
                                  onClick={() => store.setFillColor(c)} 
                                  className={`w-5 h-5 rounded-full border-2 transition-all ${store.fillColor === c ? 'border-white' : 'border-transparent hover:scale-110'}`} 
                                  style={{ backgroundColor: c }} 
                                />
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {store.fillEnabled && (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase pr-1">Fill Opacity</span>
                        <div className="flex items-center gap-1.5">
                          <div className="bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded text-[9px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 min-w-[36px] text-center">
                            {Math.round(store.fillOpacity * 100)}%
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              store.setFillColor(store.color);
                              store.setFillOpacity(0.3);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title="Reset"
                          >
                            <RotateCcw size={8} />
                          </button>
                        </div>
                      </div>
                      <Slider 
                        min={0.05} 
                        max={1} 
                        step={0.05} 
                        value={store.fillOpacity} 
                        onValueChange={v => store.setFillOpacity(Array.isArray(v) ? v[0] : (v as number))} 
                        className="w-full" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Highlighter Settings */}
      {store.activeTool === 'highlighter' && (
        <div 
          className={`pointer-events-auto flex ${isVert ? 'flex-col items-start gap-1.5' : 'items-center gap-2'} p-1.5 px-2 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-800 text-slate-900 dark:text-slate-100`}
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

      {/* Arrow Settings */}
      {store.activeTool === 'arrow' && (
        <div 
          className={`pointer-events-auto flex flex-col p-0 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 animate-in fade-in duration-300 relative group/func will-change-[width,height] overflow-hidden ${resizingMode !== 'none' ? 'select-none transition-none shadow-2xl ring-2 ring-blue-500/10' : ''}`}
          style={{ 
            width: 'var(--arrow-w)',
            height: 'var(--arrow-h)',
            minWidth: '240px',
            minHeight: '220px',
            maxHeight: 'min(90vh, 800px)'
          } as React.CSSProperties}
        >
          {/* Top Notch Decor */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-b-full pointer-events-none" />
          
          {/* Bottom Notch Decor */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-t-full pointer-events-none" />

          {/* Resize Handle for Arrow Panel */}
          <div 
            className="absolute bottom-0 right-0 w-10 h-10 cursor-nwse-resize opacity-40 hover:opacity-100 transition-all flex items-end justify-end p-2 z-50 touch-none active:scale-90"
            style={{ 
              transform: `scale(${1 / localScale})`,
              transformOrigin: 'bottom right'
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizingMode('arrow');
              dragRef.current = {
                isDragging: false,
                startX: e.clientX,
                startY: e.clientY,
                initX: localArrowSize.w,
                initY: localArrowSize.h
              };
              document.body.style.cursor = 'nwse-resize';
              document.body.classList.add('select-none');
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-[3px] items-end pr-1.5 pb-1.5 opacity-20 hover:opacity-40 transition-opacity">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="flex gap-[3px]">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pr-5 scroll-smooth flex flex-col gap-5 min-h-0 bg-white dark:bg-[#0b1120]">

            <div className="flex flex-col gap-2 w-full">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between gap-4">
                Tip Shape 
              </span>
               <select 
                 value={store.arrowTipStyle} 
                 onChange={e => store.setArrowTipStyle(e.target.value as any)}
                 className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-xs rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 w-full"
               >
                  <option value="triangle">Triangle</option>
                  <option value="default">Open</option>
                  <option value="stealth">Stealth</option>
                  <option value="diamond">Diamond</option>
                  <option value="circle">Circle</option>
                  <option value="none">None</option>
                  <option value="custom-math">Custom Math</option>
               </select>
               {store.arrowTipStyle === 'custom-math' && (
                 <div className="flex flex-col gap-1 w-full mt-1">
                   <div className="relative group">
                     <input
                       type="text"
                       value={store.customArrowTipEquation}
                       onChange={e => store.setCustomArrowTipEquation(e.target.value)}
                       className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-3 pr-8 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                       placeholder="e.g. size * cos(theta)"
                       title="Variables: size, theta"
                     />
                     <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
                       <div className="p-1 px-1.5 text-slate-400 group-hover:text-blue-500 transition-colors">
                         <Sigma size={12} />
                       </div>
                     </div>
                   </div>
                   <LaTeXPreview expression={store.customArrowTipEquation} className="!p-1.5 !rounded-lg" />
                   
                   <div className="flex flex-wrap gap-1 mt-1">
                     {ARROW_TIP_PRESETS.map((preset) => (
                       <button
                         key={preset.label}
                         onClick={() => store.setCustomArrowTipEquation(preset.expr)}
                         className={`px-1.5 py-1 text-[9px] font-semibold rounded-md transition-all border ${
                           store.customArrowTipEquation === preset.expr 
                             ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                             : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                         }`}
                       >
                         {preset.label}
                       </button>
                     ))}
                   </div>
                   <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800">
                     <p className="font-semibold mb-1">Variables:</p>
                     <ul className="list-disc pl-3 mt-0.5 space-y-0.5 opacity-80">
                       <li><code>theta</code> (0 to 2π)</li>
                       <li><code>size</code> (px)</li>
                     </ul>
                   </div>
                 </div>
               )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between gap-4">
                Line Style 
              </span>
               <select 
                 value={store.arrowLineStyle} 
                 onChange={e => store.setArrowLineStyle(e.target.value as any)}
                 className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 outline-none text-xs rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 w-full"
               >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="curly">Curly</option>
                  <option value="custom-math">Custom Math</option>
               </select>
               {store.arrowLineStyle === 'custom-math' && (
                 <div className="flex flex-col gap-1 w-full mt-1">
                   <div className="relative group">
                     <input
                       type="text"
                       value={store.customArrowLineEquation}
                       onChange={e => store.setCustomArrowLineEquation(e.target.value)}
                       className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-3 pr-8 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                       placeholder="e.g. sin(t * dist)"
                       title="Variables: t, dist"
                     />
                     <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
                       <div className="p-1 px-1.5 text-slate-400 group-hover:text-blue-500 transition-colors">
                         <Sigma size={12} />
                       </div>
                     </div>
                   </div>
                   <LaTeXPreview expression={store.customArrowLineEquation} className="!p-1.5 !rounded-lg" />
                   
                   <div className="flex flex-wrap gap-1 mt-1">
                     {ARROW_LINE_PRESETS.map((preset) => (
                       <button
                         key={preset.label}
                         onClick={() => store.setCustomArrowLineEquation(preset.expr)}
                         className={`px-1.5 py-1 text-[9px] font-semibold rounded-md transition-all border ${
                           store.customArrowLineEquation === preset.expr 
                             ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                             : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                         }`}
                       >
                         {preset.label}
                       </button>
                     ))}
                   </div>
                   <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800">
                     <p className="font-semibold mb-1">Variables:</p>
                     <ul className="list-disc pl-3 mt-0.5 space-y-0.5 opacity-80">
                       <li><code>t</code> (0.0 to 1.0 along line)</li>
                       <li><code>dist</code> (total length px)</li>
                     </ul>
                   </div>
                 </div>
               )}
            </div>
            <div className="flex flex-col gap-2 w-full pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex justify-between gap-4">
                Tip Size <span>{store.arrowTipSize}px</span>
              </span>
              <Slider min={5} max={50} value={store.arrowTipSize} onValueChange={v => store.setArrowTipSize(Array.isArray(v) ? v[0] : (v as number))} className="w-full" />
            </div>

          </div>
        </div>
      )}

      {/* Waves Settings */}
      {(store.activeTool === 'sine-wave' || store.activeTool === 'square-wave' || store.activeTool === 'triangle-wave') && (
        <div className={`pointer-events-auto flex ${isVert ? 'flex-col gap-3 min-w-[150px]' : 'items-center gap-4'} p-2.5 px-4 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-800 text-slate-900 dark:text-slate-100`}>
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
          className={`pointer-events-auto flex flex-col p-0 bg-white/95 dark:bg-[#0b1120] backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 animate-in fade-in duration-300 relative group/func will-change-[width,height] overflow-hidden ${resizingMode !== 'none' ? 'select-none transition-none shadow-2xl ring-2 ring-blue-500/10' : ''}`}
          style={{ 
            width: 'var(--function-w)',
            height: 'var(--function-h)',
            minWidth: '240px',
            minHeight: '200px',
            maxHeight: 'min(90vh, 800px)'
          } as React.CSSProperties}
        >
          {/* Top Notch Decor */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-b-full pointer-events-none" />
          
          {/* Bottom Notch Decor */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-slate-200/40 dark:bg-slate-700/40 rounded-t-full pointer-events-none" />

          {/* Resize Handle for Function Panel */}
          <div 
            className="absolute bottom-0 right-0 w-10 h-10 cursor-nwse-resize opacity-40 hover:opacity-100 transition-all flex items-end justify-end p-2 z-50 touch-none active:scale-90"
            style={{ 
              transform: `scale(${1 / localScale})`,
              transformOrigin: 'bottom right'
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizingMode('function');
              dragRef.current = {
                isDragging: false,
                startX: e.clientX,
                startY: e.clientY,
                initX: localFunctionSize.w,
                initY: localFunctionSize.h
              };
              document.body.style.cursor = 'nwse-resize';
              document.body.classList.add('select-none');
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-[3px] items-end pr-1.5 pb-1.5 opacity-20 hover:opacity-40 transition-opacity">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="flex gap-[3px]">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pr-5 scroll-smooth flex flex-col gap-4 min-h-0 bg-white dark:bg-[#0b1120]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Expression
                </span>
                {store.functionExpression && (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCopyExpression}
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/5 hover:bg-blue-500/10 rounded border border-blue-500/20 transition-colors"
                      title="Copy Expression"
                    >
                      {expressionCopied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                      <span className="ml-1">{expressionCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => store.setFunctionExpression('')}
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded border border-red-500/20 transition-colors"
                      title="Clear"
                    >
                      <Trash2 size={10} />
                      <span className="ml-1">Clear</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="relative group">
                <input 
                  ref={desktopMainInputRef}
                  type="text" 
                  value={store.functionExpression} 
                  onChange={(e) => store.setFunctionExpression(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-3 pr-10 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="e.g. sin(x) + cos(x/2)"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <div className="p-1 px-1.5 text-slate-400 group-hover:text-blue-500 transition-colors">
                    <Sigma size={12} />
                  </div>
                </div>
              </div>
              <LaTeXPreview 
                expression={store.functionExpression} 
                className="mt-1" 
                onSelect={() => desktopMainInputRef.current?.focus()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Presets</span>
              <div className="flex flex-wrap gap-1.5">
                {FUNCTION_PRESETS.map(p => {
                  const isSelected = store.functionExpression === p.expr;
                  return (
                    <button 
                      key={p.label}
                      onClick={() => store.setFunctionExpression(p.expr)}
                      className={`px-2.5 py-1.5 rounded-md text-[10px] transition-all flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-500/20' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected && <Check size={10} />}
                      {p.label}
                    </button>
                  );
                })}
                
                <Popover open={isMoreOpen} onOpenChange={(open) => { setIsMoreOpen(open); if(!open) setSearchQuery(''); }}>
                  <PopoverTrigger className="px-2 py-1 rounded-md text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                    More <ChevronUp size={10} className="rotate-180" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-4 bg-white dark:bg-[#0b1120] border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-[300] max-h-[350px] overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Search or Custom</span>
                        <div className="flex flex-col gap-2">
                          <input 
                            ref={desktopSearchRef}
                            type="text"
                            placeholder="Search math functions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 px-2.5 py-2 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = searchQuery.trim();
                                if (val) {
                                  store.setFunctionExpression(val);
                                  setIsMoreOpen(false);
                                }
                              }
                            }}
                          />
                          <LaTeXPreview 
                            expression={searchQuery} 
                            onSelect={() => desktopSearchRef.current?.focus()}
                          />
                        </div>
                      </div>

                      {MORE_FUNCTIONS.map((group) => {
                        const filteredItems = group.items.filter(item => 
                          item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.expr.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        if (filteredItems.length === 0) return null;
                        
                        return (
                          <div key={group.group} className="flex flex-col gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{group.group}</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {filteredItems.map((item) => (
                                <button
                                  key={item.label}
                                  onClick={() => {
                                    store.setFunctionExpression(item.expr);
                                    setIsMoreOpen(false);
                                  }}
                                  className={`px-2 py-1.5 text-[10px] text-left rounded transition-all font-mono border ${
                                     store.functionExpression === item.expr
                                       ? 'bg-blue-500 text-white border-blue-400 shadow-md ring-2 ring-blue-500/20'
                                       : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 border-slate-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800'
                                   }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Dynamic suggestions from a larger list for Desktop */}
                      {searchQuery.length >= 1 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-500/70">Suggestions</span>
                          <div className="flex flex-wrap gap-1.5">
                            {SUGGESTED_MATH_FUNCTIONS
                              .filter(fn => fn.toLowerCase().includes(searchQuery.toLowerCase()))
                              .filter(fn => !MORE_FUNCTIONS.some(g => g.items.some(i => i.expr.includes(fn))))
                              .slice(0, 12)
                              .map(fn => (
                                <button
                                  key={fn}
                                  onClick={() => {
                                    store.setFunctionExpression(`${fn}(x)`);
                                    setIsMoreOpen(false);
                                  }}
                                  className="px-2 py-1 text-[10px] rounded-full bg-blue-500/5 text-blue-500 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 transition-all font-mono"
                                >
                                  {fn}(x)
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      )}

                      {searchQuery && !MORE_FUNCTIONS.some(g => g.items.some(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()))) && (
                        <button 
                          onClick={() => {
                            store.setFunctionExpression(searchQuery);
                            setIsMoreOpen(false);
                          }}
                          className="mt-2 w-full py-2.5 text-[11px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                        >
                          Use Custom: "{searchQuery}"
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
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
        </div>
      )}
    </div>
  );
}


