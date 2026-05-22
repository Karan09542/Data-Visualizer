import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAnnotationStore, Annotation } from '../store/useAnnotationStore';
import { 
  Link, 
  Link2Off, 
  FlipHorizontal, 
  FlipVertical, 
  RotateCw, 
  Maximize, 
  Trash2,
  Square,
  ChevronsUp,
  ChevronsDown
} from 'lucide-react';

const PX_PER_INCH = 96;
const PX_PER_CM = 37.8;
const PX_PER_MM = 3.78;

type Unit = 'px' | 'in' | 'cm' | 'mm';

const convertFromPx = (val: number, unit: Unit) => {
  if (unit === 'in') return val / PX_PER_INCH;
  if (unit === 'cm') return val / PX_PER_CM;
  if (unit === 'mm') return val / PX_PER_MM;
  return val;
};

const convertToPx = (val: number, unit: Unit) => {
  if (unit === 'in') return val * PX_PER_INCH;
  if (unit === 'cm') return val * PX_PER_CM;
  if (unit === 'mm') return val * PX_PER_MM;
  return val;
};

export const ManualResizeModal = ({ 
  anno, 
  onClose, 
  baseWidth, 
  baseHeight 
}: { 
  anno: Annotation; 
  onClose: () => void;
  baseWidth: number;
  baseHeight: number;
}) => {
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation);
  const commitAction = useAnnotationStore(s => s.commitAction);
  
  const [unit, setUnit] = useState<Unit>('px');
  const [w, setW] = useState(convertFromPx(baseWidth * (anno.scaleX ?? 1), unit));
  const [h, setH] = useState(convertFromPx(baseHeight * (anno.scaleY ?? 1), unit));
  
  type ResizeMode = 'free' | 'proportional' | 'square';
  const [resizeMode, setResizeMode] = useState<ResizeMode>('proportional');

  const handleResize = () => {
    const nextSx = convertToPx(w, unit) / baseWidth;
    const nextSy = convertToPx(h, unit) / baseHeight;
    updateAnnotation(anno.id, { scaleX: nextSx, scaleY: nextSy });
    commitAction();
    onClose();
  };

  const updateWidth = (val: number) => {
    setW(val);
    if (resizeMode === 'proportional') {
      setH(val * (baseHeight / baseWidth));
    } else if (resizeMode === 'square') {
      setH(val);
    }
  };

  const updateHeight = (val: number) => {
    setH(val);
    if (resizeMode === 'proportional') {
      setW(val * (baseWidth / baseHeight));
    } else if (resizeMode === 'square') {
      setW(val);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl w-80 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-wider">Manual Resize</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Width</label>
              <input 
                type="number" 
                value={Math.round(w * 100) / 100} 
                onChange={e => updateWidth(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1 mt-5">
              <button 
                onClick={() => setResizeMode(resizeMode === 'proportional' ? 'free' : 'proportional')}
                className={`p-1.5 rounded transition-colors ${resizeMode === 'proportional' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}
                title="Maintain Aspect Ratio"
              >
                {resizeMode === 'proportional' ? <Link size={14} /> : <Link2Off size={14} />}
              </button>
              <button 
                onClick={() => {
                  if (resizeMode === 'square') {
                    setResizeMode('free');
                  } else {
                    setResizeMode('square');
                    setH(w);
                  }
                }}
                className={`p-1.5 rounded transition-colors ${resizeMode === 'square' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}
                title="Make Square (Set Height = Width)"
              >
                <Square size={14} />
              </button>
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Height</label>
              <input 
                type="number" 
                value={Math.round(h * 100) / 100} 
                onChange={e => updateHeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Unit</label>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1">
              {(['px', 'in', 'cm', 'mm'] as Unit[]).map(u => (
                <button
                  key={u}
                  onClick={() => {
                    const currentWInPx = convertToPx(w, unit);
                    const currentHInPx = convertToPx(h, unit);
                    setUnit(u);
                    setW(convertFromPx(currentWInPx, u));
                    setH(convertFromPx(currentHInPx, u));
                  }}
                  className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${unit === u ? 'bg-white dark:bg-slate-700 text-blue-500 shadow-sm' : 'text-slate-400'}`}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleResize}
              className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-500 uppercase tracking-wider hover:bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const AnnotationContextMenu = ({ 
  anno, 
  x, 
  y, 
  onClose,
  onShowManualResize
}: { 
  anno: Annotation; 
  x: number; 
  y: number; 
  onClose: () => void;
  onShowManualResize: () => void;
}) => {
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation);
  const commitAction = useAnnotationStore(s => s.commitAction);
  const removeAnnotations = useAnnotationStore(s => s.removeAnnotations);
  const reorderAnnotation = useAnnotationStore(s => s.reorderAnnotation);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });
  const [isMeasured, setIsMeasured] = useState(false);

  useLayoutEffect(() => {
    if (menuRef.current) {
      // Use offsetWidth/Height instead of getBoundingClientRect() 
      // because getBoundingClientRect() is affected by CSS transforms (e.g., zoom-in animation)
      const width = menuRef.current.offsetWidth;
      const height = menuRef.current.offsetHeight;
      const { innerWidth, innerHeight } = window;
      
      let nextLeft = x;
      let nextTop = y;

      if (x + width > innerWidth) {
        nextLeft = innerWidth - width - 10;
      }
      if (y + height > innerHeight) {
        nextTop = innerHeight - height - 10;
      }

      if (nextLeft < 10) nextLeft = 10;
      if (nextTop < 10) nextTop = 10;

      setPos({ left: nextLeft, top: nextTop });
      setIsMeasured(true);
    }
  }, [x, y]);

  const flipH = () => {
    updateAnnotation(anno.id, { scaleX: -(anno.scaleX ?? 1) });
    commitAction();
    onClose();
  };

  const flipV = () => {
    updateAnnotation(anno.id, { scaleY: -(anno.scaleY ?? 1) });
    commitAction();
    onClose();
  };

  const rotate = (deg: number) => {
    updateAnnotation(anno.id, { rotation: deg });
    commitAction();
    onClose();
  };

  const reorder = (action: 'forward' | 'backward' | 'front' | 'back') => {
    reorderAnnotation(anno.id, action);
    commitAction();
    onClose();
  };

  const remove = () => {
    removeAnnotations([anno.id]);
    commitAction();
    onClose();
  };

  return createPortal(
    <div 
      ref={menuRef}
      className="fixed z-[1000] w-48 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 overflow-hidden animate-in fade-in zoom-in duration-100"
      style={{ 
        top: pos.top, 
        left: pos.left,
        visibility: isMeasured ? 'visible' : 'hidden'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-0.5">Annotation</span>
        <span className="text-[11px] font-mono text-slate-500 truncate block">{anno.id}</span>
      </div>

      <div className="group relative">
        <button onClick={flipH} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white flex items-center gap-2 transition-colors">
          <FlipHorizontal size={14} />
          Flip Horizontal
        </button>
        <button onClick={flipV} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white flex items-center gap-2 transition-colors">
          <FlipVertical size={14} />
          Flip Vertical
        </button>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

      <div className="grid grid-cols-2 gap-0.5 px-2 mb-1">
        {[0, 90, 180, 270].map(deg => (
          <button 
            key={deg}
            onClick={() => rotate(deg)}
            className="px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-center gap-1 transition-colors"
          >
            <RotateCw size={10} />
            {deg}°
          </button>
        ))}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
      
      <div className="group relative">
        <button onClick={() => reorder('front')} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white flex items-center gap-2 transition-colors">
          <ChevronsUp size={14} />
          Bring to Front
        </button>
        <button onClick={() => reorder('back')} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white flex items-center gap-2 transition-colors">
          <ChevronsDown size={14} />
          Send to Back
        </button>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

      <button onClick={() => { onShowManualResize(); onClose(); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white flex items-center gap-2 transition-colors">
        <Maximize size={14} />
        Manual Resize
      </button>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

      <button onClick={remove} className="w-full text-left px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:text-white flex items-center gap-2 transition-colors">
        <Trash2 size={14} />
        Delete Shape
      </button>
    </div>,
    document.body
  );
};
