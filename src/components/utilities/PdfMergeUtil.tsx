import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, File, Image as ImageIcon, Loader2, Trash2, Download, Check, X, Maximize2, FileStack, GripVertical, Undo2, Redo2, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, MoreHorizontal, LayoutGrid } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, degrees } from 'pdf-lib';
import { useStore } from '../../store/useStore';
import MediaCarousel from '../MediaCarousel';
import { FileDropzoneUpload } from './FileDropzoneUpload';

// Ensure worker is set for pdfjs
// Bundled with the app, and so precached, rather than fetched from unpkg: PDFs open offline.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type MergeItemType = 'pdf-page' | 'pdf-file' | 'image';

interface MergeItem {
  id: string;
  type: MergeItemType;
  file: File;
  filename: string;
  pageNum?: number;
  thumbnailUrl: string;
  selected: boolean;
  pdfBytes?: ArrayBuffer;
  password?: string;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
}

const GridSizeSelector = ({ value, onChange }: { value: string, onChange: (val: any) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-xs font-semibold px-2 py-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
      >
        <LayoutGrid size={14} />
        <span className="hidden sm:inline">Size: {value.charAt(0).toUpperCase() + value.slice(1)}</span>
      </button>
      
      {isOpen && (
         <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-[100] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 w-28 animate-in fade-in slide-in-from-top-2 duration-150">
            {['small', 'normal', 'medium', 'large'].map(s => (
               <button 
                 key={s} 
                 onClick={() => { onChange(s); setIsOpen(false); }} 
                 className={`block w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                   value === s 
                    ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                 }`}
               >
                 {s.charAt(0).toUpperCase() + s.slice(1)}
               </button>
            ))}
         </div>
      )}
    </div>
  );
};

const SortableThumbnail = React.memo(({ 
  item, 
  onToggleSelect, 
  onRemove, 
  onRotate, 
  onFlip,
  onPreview
}: { 
  item: MergeItem; 
  onToggleSelect: (id: string) => void; 
  onRemove: (id: string) => void;
  onRotate: (id: string, dir: 'cw' | 'ccw') => void;
  onFlip: (id: string, axis: 'x' | 'y') => void;
  onPreview: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [showTools, setShowTools] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const imgStyle = {
    transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipX ? -1 : 1}) scaleY(${item.flipY ? -1 : 1})`
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group select-none">
      <div 
        className={`w-full aspect-[1/1.4] rounded-xl overflow-hidden border-2 shadow-sm transition-all duration-200 bg-white dark:bg-slate-900 relative ${
          item.selected 
            ? 'border-indigo-500 shadow-indigo-500/20 shadow-lg' 
            : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
        }`}
      >
        <img 
          src={item.thumbnailUrl} 
          alt={item.filename} 
          loading="lazy" 
          className="w-full h-full object-cover pointer-events-none transition-transform duration-300" 
          style={imgStyle} 
        />
        
        {/* Preview click target */}
        <div onClick={() => onPreview(item.id)} className="absolute inset-0 cursor-zoom-in z-0" />

        {/* Top gradient for readability */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        
        {/* Transform Tools (Hidden for entire files) */}
        {item.type !== 'pdf-file' && (
          <div className={`absolute inset-0 m-auto w-max h-max flex items-center justify-center gap-1 transition-opacity z-20 ${showTools ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
            <div className={`flex bg-black/70 backdrop-blur-md rounded-lg overflow-hidden shadow-xl border border-white/10 ${showTools ? 'pointer-events-auto' : 'pointer-events-none md:group-hover:pointer-events-auto'}`}>
              <button onClick={(e) => { e.stopPropagation(); onRotate(item.id, 'ccw'); }} className="p-2 text-white hover:bg-white/20 transition-colors" title="Rotate Left">
                <RotateCcw size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRotate(item.id, 'cw'); }} className="p-2 text-white hover:bg-white/20 transition-colors border-r border-white/10" title="Rotate Right">
                <RotateCw size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onFlip(item.id, 'x'); }} className="p-2 text-white hover:bg-white/20 transition-colors" title="Flip Horizontal">
                <FlipHorizontal size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onFlip(item.id, 'y'); }} className="p-2 text-white hover:bg-white/20 transition-colors" title="Flip Vertical">
                <FlipVertical size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Drag handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute top-1 left-1 p-1.5 rounded-lg bg-black/40 text-white cursor-grab active:cursor-grabbing hover:bg-black/60 backdrop-blur-md transition-colors touch-none z-10"
        >
          <GripVertical size={14} />
        </div>

        {/* Mobile Tools Toggle */}
        {item.type !== 'pdf-file' && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowTools(!showTools); }}
            className="absolute top-1 left-9 p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors md:hidden z-10"
          >
            <MoreHorizontal size={14} />
          </button>
        )}

        {/* Selection Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
          className="absolute top-1.5 right-1.5 z-10 transition-transform hover:scale-110"
        >
          {item.selected ? (
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/40">
              <Check size={12} strokeWidth={3} />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-black/40 backdrop-blur-sm hover:border-indigo-400 hover:bg-black/60 transition-colors" />
          )}
        </button>

        {/* Remove Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-red-500/80 text-white opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 backdrop-blur-md z-10"
        >
          <Trash2 size={12} />
        </button>

        {/* Info Label */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-0.5 max-w-[70%]">
          <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[9px] font-bold tracking-wider truncate">
            {item.type === 'pdf-page' ? `P.${item.pageNum}` : item.type === 'pdf-file' ? 'FILE' : 'IMG'}
          </div>
          <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-slate-300 text-[8px] truncate pointer-events-none" title={item.filename}>
            {item.filename}
          </div>
        </div>
      </div>
    </div>
  );
});

const getGridColumns = (width: number, size: 'small' | 'normal' | 'medium' | 'large') => {
  const w = width || 800;
  if (size === 'small') {
    if (w < 640) return 3;
    if (w < 768) return 4;
    if (w < 1024) return 6;
    if (w < 1280) return 8;
    return 10;
  }
  if (size === 'medium') {
    if (w < 640) return 2;
    if (w < 1024) return 3;
    return 4;
  }
  if (size === 'large') {
    if (w < 640) return 1;
    if (w < 1024) return 2;
    return 3;
  }
  // normal
  if (w < 640) return 2;
  if (w < 768) return 3;
  if (w < 1024) return 4;
  if (w < 1280) return 5;
  return 6;
};

export const PdfMergeUtil = () => {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [past, setPast] = useState<MergeItem[][]>([]);
  const [future, setFuture] = useState<MergeItem[][]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [gridSize, setGridSize] = useState<'small' | 'normal' | 'medium' | 'large'>('normal');
  const [mergeMode, setMergeMode] = useState<'pages' | 'files'>('pages');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{ filename: string, resolve: (pwd: string | null) => void } | null>(null);

  const abortRef = useRef<boolean>(false);
  const activeOpIdRef = useRef<number>(0);
  const activeLoadingTaskRef = useRef<any>(null);
  const activeRenderTaskRef = useRef<any>(null);
  const activePageRef = useRef<any>(null);
  const carouselLoadingTaskRef = useRef<any>(null);
  const carouselRenderTaskRef = useRef<any>(null);
  const carouselPageRef = useRef<any>(null);
  const sourceFilesRef = useRef<File[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const parentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setNotification = useStore(state => state.setNotification);

  const [highResUrls, setHighResUrls] = useState<Record<string, string>>({});
  const highResUrlsRef = useRef<Record<string, string>>({});
  highResUrlsRef.current = highResUrls;
  const pdfDocCacheRef = useRef<Map<string, any>>(new Map());
  const carouselFetchOpRef = useRef<number>(0);

  // Centralized abort helper: terminates active worker tasks, render tasks, and frees memory
  const abortAllWorkers = useCallback(() => {
    abortRef.current = true;
    activeOpIdRef.current++;
    carouselFetchOpRef.current++;

    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
      } catch {}
      activeRenderTaskRef.current = null;
    }
    if (carouselRenderTaskRef.current) {
      try {
        carouselRenderTaskRef.current.cancel();
      } catch {}
      carouselRenderTaskRef.current = null;
    }
    if (activeLoadingTaskRef.current) {
      try {
        activeLoadingTaskRef.current.destroy();
      } catch {}
      activeLoadingTaskRef.current = null;
    }
    if (carouselLoadingTaskRef.current) {
      try {
        carouselLoadingTaskRef.current.destroy();
      } catch {}
      carouselLoadingTaskRef.current = null;
    }
    if (activePageRef.current) {
      try {
        activePageRef.current.cleanup();
      } catch {}
      activePageRef.current = null;
    }
    if (carouselPageRef.current) {
      try {
        carouselPageRef.current.cleanup();
      } catch {}
      carouselPageRef.current = null;
    }

    pdfDocCacheRef.current.forEach(pdf => {
      try {
        pdf.destroy?.();
      } catch {}
    });
    pdfDocCacheRef.current.clear();
  }, []);

  // Clean up and abort immediately when user switches tabs or closes modal
  useEffect(() => {
    return () => {
      abortAllWorkers();

      Object.values(highResUrlsRef.current).forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [abortAllWorkers]);

  const fetchHighResPage = useCallback(async (item: MergeItem): Promise<string | null> => {
    if (item.type === 'image') {
      return URL.createObjectURL(item.file);
    }

    const pageNum = item.pageNum || 1;

    try {
      let pdf = pdfDocCacheRef.current.get(item.filename);
      if (!pdf) {
        const bytes = item.pdfBytes || (await item.file.arrayBuffer());
        if (abortRef.current) return null;
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0), password: item.password });
        carouselLoadingTaskRef.current = loadingTask;
        try {
          pdf = await loadingTask.promise;
        } finally {
          carouselLoadingTaskRef.current = null;
        }
        if (abortRef.current) {
          pdf?.destroy?.();
          return null;
        }
        pdfDocCacheRef.current.set(item.filename, pdf);
      }

      if (abortRef.current) return null;
      const page = await pdf.getPage(pageNum);
      carouselPageRef.current = page;
      if (abortRef.current) {
        page.cleanup?.();
        carouselPageRef.current = null;
        return null;
      }

      // Scale 2.2 provides sharp, crystal-clear text and photos in carousel
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup?.();
        carouselPageRef.current = null;
        return null;
      }

      const renderTask = page.render({ canvasContext: ctx, viewport } as any);
      carouselRenderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (err: any) {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup?.();
        carouselPageRef.current = null;
        if (err?.name === 'RenderingCancelledException' || abortRef.current) return null;
        throw err;
      } finally {
        carouselRenderTaskRef.current = null;
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup?.();
      carouselPageRef.current = null;

      if (abortRef.current || !blob) return null;
      return URL.createObjectURL(blob);
    } catch (err: any) {
      if (abortRef.current || err?.name === 'RenderingCancelledException') return null;
      console.warn(`Could not render high-res preview for ${item.filename} p.${pageNum}:`, err);
    }
    return null;
  }, []);

  // Window prefetching: fetch current page + fixed window (±2 pages) for smooth browsing
  useEffect(() => {
    if (!isPreviewOpen || items.length === 0) return;

    const currentOp = ++carouselFetchOpRef.current;
    const WINDOW_RADIUS = 2; // Fixed window size: current page ±2 left/right (5 pages total)

    const queue: number[] = [previewIndex];
    for (let r = 1; r <= WINDOW_RADIUS; r++) {
      if (previewIndex + r < items.length) queue.push(previewIndex + r);
      if (previewIndex - r >= 0) queue.push(previewIndex - r);
    }

    const loadWindow = async () => {
      for (const idx of queue) {
        if (carouselFetchOpRef.current !== currentOp) break;
        const targetItem = items[idx];
        if (!targetItem) continue;

        if (highResUrlsRef.current[targetItem.id]) continue;

        const highResUrl = await fetchHighResPage(targetItem);

        if (carouselFetchOpRef.current !== currentOp) {
          if (highResUrl && highResUrl.startsWith('blob:')) {
            URL.revokeObjectURL(highResUrl);
          }
          break;
        }

        if (highResUrl) {
          setHighResUrls(prev => ({ ...prev, [targetItem.id]: highResUrl }));
        }

        await new Promise(r => setTimeout(r, 15));
      }
    };

    loadWindow();

    return () => {
      carouselFetchOpRef.current++;
    };
  }, [isPreviewOpen, previewIndex, items, fetchHighResPage]);

  const [parentWidth, setParentWidth] = useState<number>(0);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    setParentWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setParentWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length > 0]);

  const columns = useMemo(() => getGridColumns(parentWidth, gridSize), [parentWidth, gridSize]);
  const rowCount = Math.ceil(items.length / columns);

  const estimatedRowHeight = useMemo(() => {
    const w = parentWidth || 800;
    const padding = w >= 768 ? 48 : 32;
    const gap = w >= 640 ? 16 : 12;
    const availableWidth = Math.max(200, w - padding);
    const cardWidth = Math.max(80, (availableWidth - (columns - 1) * gap) / columns);
    return Math.round(cardWidth * 1.4 + gap);
  }, [parentWidth, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 2,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, parentWidth, gridSize, rowVirtualizer]);

  const handleAbort = useCallback(() => {
    abortAllWorkers();
    setIsProcessing(false);
    setIsMerging(false);
    setProgress({ current: 0, total: 0, message: '' });
  }, [abortAllWorkers]);

  const setItemsWithHistory = useCallback((action: MergeItem[] | ((prev: MergeItem[]) => MergeItem[])) => {
    setItems(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      setPast(p => [...p, prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(prevPast => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setItems(currentItems => {
        setFuture(f => [currentItems, ...f]);
        return previous;
      });
      return prevPast.slice(0, prevPast.length - 1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setItems(currentItems => {
        setPast(p => [...p, currentItems]);
        return next;
      });
      return prevFuture.slice(1);
    });
  }, []);

  const handlePreview = useCallback((id: string) => {
    const idx = itemsRef.current.findIndex(i => i.id === id);
    if (idx !== -1) {
      setPreviewIndex(idx);
      setIsPreviewOpen(true);
    }
  }, []);

  const requestPassword = useCallback((filename: string): Promise<string | null> => {
    return new Promise(resolve => {
      setPasswordPrompt({ filename, resolve });
    });
  }, []);

  const rotateItem = useCallback((id: string, dir: 'cw' | 'ccw') => {
    setItemsWithHistory(prev => prev.map(item => {
      if (item.id === id) {
        const r = item.rotation || 0;
        return { ...item, rotation: dir === 'cw' ? (r + 90) % 360 : (r - 90 + 360) % 360 };
      }
      return item;
    }));
  }, [setItemsWithHistory]);

  const flipItem = useCallback((id: string, axis: 'x' | 'y') => {
    setItemsWithHistory(prev => prev.map(item => {
      if (item.id === id) {
        return axis === 'x' ? { ...item, flipX: !item.flipX } : { ...item, flipY: !item.flipY };
      }
      return item;
    }));
  }, [setItemsWithHistory]);

  const toggleSelect = useCallback((id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItemsWithHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      if (updated.length === 0) {
        sourceFilesRef.current = [];
      } else {
        const remainingFileNames = new Set(updated.map(i => i.filename));
        sourceFilesRef.current = sourceFilesRef.current.filter(f => remainingFileNames.has(f.name));
      }
      return updated;
    });
  }, [setItemsWithHistory]);

  const clearAll = useCallback(() => {
    abortAllWorkers();
    sourceFilesRef.current = [];
    setItemsWithHistory([]);
    setIsProcessing(false);
    setIsMerging(false);
    setProgress({ current: 0, total: 0, message: '' });
    Object.values(highResUrlsRef.current).forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setHighResUrls({});
  }, [abortAllWorkers, setItemsWithHistory]);

  const selectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const addSourceFiles = (newFiles: File[]) => {
    const existing = sourceFilesRef.current;
    const merged = [...existing];
    for (const f of newFiles) {
      if (!merged.some(e => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified)) {
        merged.push(f);
      }
    }
    sourceFilesRef.current = merged;
  };

  const generatePdfThumbnails = async (
    file: File, 
    mode: 'pages' | 'files',
    opId: number,
    onPageExtracted: (item: MergeItem) => void
  ): Promise<void> => {
    if (abortRef.current || opId !== activeOpIdRef.current) throw new Error('ABORTED');
    const arrayBuffer = await file.arrayBuffer();
    if (abortRef.current || opId !== activeOpIdRef.current) throw new Error('ABORTED');
    
    let pdf;
    let currentPassword = '';

    while (!pdf) {
      if (abortRef.current || opId !== activeOpIdRef.current) throw new Error('ABORTED');
      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0), password: currentPassword });
        activeLoadingTaskRef.current = loadingTask;
        try {
          pdf = await loadingTask.promise;
        } finally {
          activeLoadingTaskRef.current = null;
        }
        if (abortRef.current || opId !== activeOpIdRef.current) {
          pdf?.destroy?.();
          throw new Error('ABORTED');
        }
        pdfDocCacheRef.current.set(file.name, pdf);
      } catch (e: any) {
        if (abortRef.current || opId !== activeOpIdRef.current || e?.name === 'RenderingCancelledException') {
          throw new Error('ABORTED');
        }
        if (e.name === 'PasswordException') {
          const input = await requestPassword(file.name);
          if (input === null) {
            throw new Error('Password prompt cancelled');
          }
          currentPassword = input;
        } else {
          throw e;
        }
      }
    }

    const numPagesToExtract = mode === 'files' ? 1 : pdf.numPages;
    const timestamp = Date.now();
    
    for (let i = 1; i <= numPagesToExtract; i++) {
      if (abortRef.current || opId !== activeOpIdRef.current) throw new Error('ABORTED');
      if (mode === 'pages') {
        setProgress({ current: i, total: pdf.numPages, message: `Extracting page ${i} of ${pdf.numPages}...` });
      } else {
        setProgress({ current: 1, total: 1, message: `Generating thumbnail...` });
      }

      let page: any = null;
      try {
        page = await pdf.getPage(i);
        activePageRef.current = page;
      } catch (e: any) {
        if (abortRef.current || opId !== activeOpIdRef.current) throw new Error('ABORTED');
        throw e;
      }

      if (abortRef.current || opId !== activeOpIdRef.current) {
        page?.cleanup?.();
        activePageRef.current = null;
        throw new Error('ABORTED');
      }

      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      if (ctx) {
        const renderTask = page.render({ canvasContext: ctx, viewport } as any);
        activeRenderTaskRef.current = renderTask;
        try {
          await renderTask.promise;
        } catch (err: any) {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup?.();
          activePageRef.current = null;
          if (err?.name === 'RenderingCancelledException' || abortRef.current || opId !== activeOpIdRef.current) {
            throw new Error('ABORTED');
          }
          throw err;
        } finally {
          activeRenderTaskRef.current = null;
        }

        if (abortRef.current || opId !== activeOpIdRef.current) {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup?.();
          activePageRef.current = null;
          throw new Error('ABORTED');
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        onPageExtracted({
          id: mode === 'files' 
            ? `${file.name}-file-${timestamp}-${Math.random().toString(36).slice(2, 7)}` 
            : `${file.name}-page-${i}-${timestamp}`,
          type: mode === 'files' ? 'pdf-file' : 'pdf-page',
          file,
          filename: file.name,
          pageNum: mode === 'files' ? undefined : i,
          thumbnailUrl: dataUrl,
          selected: true,
          pdfBytes: arrayBuffer,
          password: currentPassword,
        });
      }

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup?.();
      activePageRef.current = null;

      // Yield control so UI stays responsive and handles any user interaction immediately
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  const processFiles = async (files: File[], mode: 'pages' | 'files') => {
    const opId = ++activeOpIdRef.current;
    abortRef.current = false;
    setIsProcessing(true);

    addSourceFiles(files);

    // Save history once for the whole import
    setItems(prev => {
      setPast(p => [...p, prev]);
      setFuture([]);
      return prev;
    });

    let batchBuffer: MergeItem[] = [];
    let lastFlush = Date.now();
    let flushTimer: any = null;
    let totalExtracted = 0;

    const flush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (batchBuffer.length === 0) return;
      if (opId !== activeOpIdRef.current || abortRef.current) return;
      const toFlush = [...batchBuffer];
      batchBuffer = [];
      lastFlush = Date.now();
      setItems(prev => [...prev, ...toFlush]);
    };

    const handlePageExtracted = (item: MergeItem) => {
      if (opId !== activeOpIdRef.current || abortRef.current) return;
      batchBuffer.push(item);
      totalExtracted++;
      const now = Date.now();
      if (totalExtracted <= 4 || batchBuffer.length >= 4 || now - lastFlush >= 80) {
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, 80);
      }
    };

    try {
      for (let i = 0; i < files.length; i++) {
        if (opId !== activeOpIdRef.current || abortRef.current) break;
        const file = files[i];
        try {
          if (file.type === 'application/pdf') {
            setProgress({ current: 0, total: 0, message: `Reading PDF: ${file.name}` });
            await generatePdfThumbnails(file, mode, opId, handlePageExtracted);
          } else if (file.type.startsWith('image/')) {
            setProgress({ current: 0, total: 0, message: `Processing image: ${file.name}` });
            const item: MergeItem = {
              id: `image-${file.name}-${Date.now()}-${i}`,
              type: 'image',
              file,
              filename: file.name,
              thumbnailUrl: URL.createObjectURL(file),
              selected: true,
            };
            handlePageExtracted(item);
          }
        } catch (error: any) {
          if (error.message === 'ABORTED' || opId !== activeOpIdRef.current || abortRef.current) {
            break;
          }
          console.error(`Failed to process ${file.name}:`, error);
          setNotification({ message: `Skipped ${file.name}: Failed to load or password cancelled.`, type: 'error' });
        }
      }

      flush();
    } finally {
      if (opId === activeOpIdRef.current) {
        setIsProcessing(false);
        setProgress({ current: 0, total: 0, message: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleModeChange = useCallback((newMode: 'pages' | 'files') => {
    if (newMode === mergeMode) return;

    // 1. Immediately cancel active background extraction, worker tasks, and carousel prefetch
    abortAllWorkers();
    setIsProcessing(false);
    setProgress({ current: 0, total: 0, message: '' });
    setMergeMode(newMode);

    // Clean up high-res carousel cache
    Object.values(highResUrlsRef.current).forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setHighResUrls({});

    // 2. Identify source files to re-process in new mode
    let filesToProcess = [...sourceFilesRef.current];
    if (filesToProcess.length === 0 && itemsRef.current.length > 0) {
      filesToProcess = Array.from(new Set(itemsRef.current.map(i => i.file)));
      sourceFilesRef.current = filesToProcess;
    }

    // 3. Clear existing items and undo history
    setItems([]);
    setPast([]);
    setFuture([]);

    // 4. Start processing with new mode if source files exist
    if (filesToProcess.length > 0) {
      setTimeout(() => {
        processFiles(filesToProcess, newMode);
      }, 10);
    }
  }, [mergeMode]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files), mergeMode);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItemsWithHistory((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === active.id);
        const newIndex = prevItems.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prevItems;
        return arrayMove(prevItems, oldIndex, newIndex);
      });
    }
  }, [setItemsWithHistory]);

  // Convert image file to JPEG ArrayBuffer for pdf-lib embedding
  // We do this to support WebP/PNG formats reliably
  const convertImageToJpegBytes = async (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');
        ctx.fillStyle = '#FFFFFF'; // White background for transparent images
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject('Blob failed');
          blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
        }, 'image/jpeg', 0.95);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => reject('Image load failed');
      img.src = url;
    });
  };

  const transformImageFile = async (file: File, rot: number, fx: boolean, fy: boolean): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const isRotated = rot === 90 || rot === 270;
        canvas.width = isRotated ? img.height : img.width;
        canvas.height = isRotated ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        canvas.toBlob(blob => {
          if (!blob) return reject('No blob');
          blob.arrayBuffer().then(resolve);
        }, 'image/jpeg', 0.95);
        URL.revokeObjectURL(url);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleMerge = async () => {
    setIsMerging(true);
    abortRef.current = false;
    try {
      const selectedItems = items.filter(i => i.selected);
      if (selectedItems.length === 0) return;
      
      const mergedPdf = await PDFDocument.create();
      
      // Cache loaded PDFDocuments to avoid parsing the same PDF file multiple times
      const loadedPdfs: Record<string, PDFDocument> = {};

      for (let i = 0; i < selectedItems.length; i++) {
        if (abortRef.current) throw new Error('ABORTED');
        const item = selectedItems[i];
        setProgress({ current: i + 1, total: selectedItems.length, message: `Merging item ${i + 1} of ${selectedItems.length}...` });

        if (item.type === 'pdf-file') {
          try {
            if (!loadedPdfs[item.filename]) {
              const freshBuffer = await item.file.arrayBuffer();
              loadedPdfs[item.filename] = await PDFDocument.load(freshBuffer, { ignoreEncryption: true });
            }
            const srcDoc = loadedPdfs[item.filename];
            const pageIndices = srcDoc.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach((page) => {
              if (abortRef.current) throw new Error('ABORTED');
              mergedPdf.addPage(page);
            });
          } catch (err: any) {
            if (err.message === 'ABORTED' || abortRef.current) throw err;
            console.warn(`Could not copy pdf-file natively, rasterizing all pages instead: ${err}`);
            const freshBuffer = await item.file.arrayBuffer();
            if (abortRef.current) throw new Error('ABORTED');
            const loadingTask = pdfjsLib.getDocument({ data: freshBuffer, password: item.password });
            activeLoadingTaskRef.current = loadingTask;
            let pdf: any;
            try {
              pdf = await loadingTask.promise;
            } finally {
              activeLoadingTaskRef.current = null;
            }
            try {
              for (let p = 1; p <= pdf.numPages; p++) {
                if (abortRef.current) throw new Error('ABORTED');
                setProgress({ current: p, total: pdf.numPages, message: `Rasterizing page ${p} of ${pdf.numPages}...` });
                const page = await pdf.getPage(p);
                activePageRef.current = page;
                const viewport = page.getViewport({ scale: 2.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const renderTask = page.render({ canvasContext: ctx, viewport } as any);
                  activeRenderTaskRef.current = renderTask;
                  try {
                    await renderTask.promise;
                  } catch (renderErr: any) {
                    canvas.width = 0;
                    canvas.height = 0;
                    page.cleanup?.();
                    activePageRef.current = null;
                    if (renderErr?.name === 'RenderingCancelledException' || abortRef.current) {
                      throw new Error('ABORTED');
                    }
                    throw renderErr;
                  } finally {
                    activeRenderTaskRef.current = null;
                  }
                  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                  canvas.width = 0;
                  canvas.height = 0;
                  page.cleanup?.();
                  activePageRef.current = null;
                  if (abortRef.current) throw new Error('ABORTED');
                  if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
                    const { width, height } = embeddedImage.scale(1);
                    const copiedPage = mergedPdf.addPage([width, height]);
                    copiedPage.drawImage(embeddedImage, { x: 0, y: 0, width, height });
                  }
                } else {
                  canvas.width = 0;
                  canvas.height = 0;
                  page.cleanup?.();
                  activePageRef.current = null;
                }
              }
            } finally {
              pdf.destroy?.();
            }
          }
        } else if (item.type === 'pdf-page') {
          let copiedPage = null;
          let requiresFallback = !!(item.flipX || item.flipY);
          
          if (!requiresFallback) {
            try {
              if (!loadedPdfs[item.filename]) {
                const freshBuffer = await item.file.arrayBuffer();
                loadedPdfs[item.filename] = await PDFDocument.load(freshBuffer, { ignoreEncryption: true });
              }
              const srcDoc = loadedPdfs[item.filename];
              const [page] = await mergedPdf.copyPages(srcDoc, [item.pageNum! - 1]);
              copiedPage = page;
            } catch (err) {
              console.warn(`Could not copy page natively, rasterizing instead: ${err}`);
              requiresFallback = true;
            }
          }

          if (requiresFallback) {
            if (abortRef.current) throw new Error('ABORTED');
            const freshBuffer = await item.file.arrayBuffer();
            if (abortRef.current) throw new Error('ABORTED');
            const loadingTask = pdfjsLib.getDocument({ data: freshBuffer, password: item.password });
            activeLoadingTaskRef.current = loadingTask;
            let pdf: any;
            try {
              pdf = await loadingTask.promise;
            } finally {
              activeLoadingTaskRef.current = null;
            }
            try {
              if (abortRef.current) throw new Error('ABORTED');
              const page = await pdf.getPage(item.pageNum!);
              activePageRef.current = page;
              const viewport = page.getViewport({ scale: 2.5 });
              
              const isRotated = (item.rotation || 0) === 90 || (item.rotation || 0) === 270;
              const canvas = document.createElement('canvas');
              canvas.width = isRotated ? viewport.height : viewport.width;
              canvas.height = isRotated ? viewport.width : viewport.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                const tempCtx = tempCanvas.getContext('2d');
                const renderTask = page.render({ canvasContext: tempCtx, viewport } as any);
                activeRenderTaskRef.current = renderTask;
                try {
                  await renderTask.promise;
                } catch (renderErr: any) {
                  tempCanvas.width = 0;
                  tempCanvas.height = 0;
                  canvas.width = 0;
                  canvas.height = 0;
                  page.cleanup?.();
                  activePageRef.current = null;
                  if (renderErr?.name === 'RenderingCancelledException' || abortRef.current) {
                    throw new Error('ABORTED');
                  }
                  throw renderErr;
                } finally {
                  activeRenderTaskRef.current = null;
                }
                
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
                ctx.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
                ctx.drawImage(tempCanvas, -viewport.width / 2, -viewport.height / 2);
                tempCanvas.width = 0;
                tempCanvas.height = 0;

                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                canvas.width = 0;
                canvas.height = 0;
                page.cleanup?.();
                activePageRef.current = null;
                if (abortRef.current) throw new Error('ABORTED');
                if (blob) {
                  const arrayBuffer = await blob.arrayBuffer();
                  const embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
                  const { width, height } = embeddedImage.scale(1);
                  copiedPage = mergedPdf.addPage([width, height]);
                  copiedPage.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                  });
                }
              } else {
                canvas.width = 0;
                canvas.height = 0;
                page.cleanup?.();
                activePageRef.current = null;
              }
            } finally {
              pdf.destroy?.();
            }
          } else if (copiedPage) {
            if (item.rotation) {
              const currentRot = copiedPage.getRotation().angle;
              copiedPage.setRotation(degrees((currentRot + item.rotation) % 360));
            }
            mergedPdf.addPage(copiedPage);
          }
        } else if (item.type === 'image') {
          const imageBytes = await transformImageFile(item.file, item.rotation || 0, !!item.flipX, !!item.flipY);
          const embeddedImage = await mergedPdf.embedJpg(imageBytes);
          const { width, height } = embeddedImage.scale(1);
          
          // Fit into standard A4 size, or use image size if smaller
          const A4_WIDTH = 595.28;
          const A4_HEIGHT = 841.89;
          
          // Calculate scale to fit within A4 while preserving aspect ratio
          const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height, 1);
          const finalWidth = width * scale;
          const finalHeight = height * scale;

          const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
          page.drawImage(embeddedImage, {
            x: (A4_WIDTH - finalWidth) / 2,
            y: (A4_HEIGHT - finalHeight) / 2,
            width: finalWidth,
            height: finalHeight,
          });
        }
      }

      if (abortRef.current) throw new Error('ABORTED');
      setProgress({ current: selectedItems.length, total: selectedItems.length, message: 'Saving PDF...' });
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({ message: 'Successfully merged and downloaded!', type: 'success' });
    } catch (error: any) {
      if (error.message === 'ABORTED') {
        setNotification({ message: 'Operation cancelled by user.', type: 'info' });
      } else {
        console.error("Merge error:", error);
        setNotification({ message: 'An error occurred during merging.', type: 'error' });
      }
    } finally {
      setIsMerging(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };

  const selectedCount = useMemo(() => items.filter(i => i.selected).length, [items]);
  const itemIds = useMemo(() => items.map(item => item.id), [items]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#0c0f16] font-sans">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-3 md:p-6 border-b border-slate-200 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
        <div className="flex flex-col gap-0 md:gap-1">
          <h2 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileStack className="text-indigo-500 w-5 h-5 md:w-6 md:h-6" />
            PDF & Image Merger
          </h2>
          <p className="hidden md:block text-sm text-slate-500 dark:text-slate-400 font-medium">
            Upload PDFs or Images, reorder, and select pages to merge into a single PDF.
          </p>
          <div className="flex bg-slate-200/50 dark:bg-slate-800 p-0.5 rounded-lg w-fit mt-1 border border-slate-300/50 dark:border-slate-700">
            <button onClick={() => handleModeChange('pages')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mergeMode === 'pages' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>Pages</button>
            <button onClick={() => handleModeChange('files')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mergeMode === 'files' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>Files</button>
          </div>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isMerging}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all shrink-0 active:scale-95 whitespace-nowrap"
              title="Add more PDFs or Images"
            >
              <UploadCloud size={16} className="text-indigo-500 shrink-0" />
              <span className="hidden sm:inline">Add Files</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging || isProcessing || selectedCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:shadow-none whitespace-nowrap active:scale-95 shrink-0"
            >
              {isMerging ? (
                <><Loader2 size={16} className="animate-spin" /> Merging...</>
              ) : (
                <><Download size={16} /> Merge ({selectedCount})</>
              )}
            </button>
          </div>
        )}
      </div>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-hidden flex flex-col p-4 md:p-6 relative transition-colors duration-300 ${isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) processFiles(Array.from(e.target.files), mergeMode);
          }}
        />

        {/* Processing Indicator */}
        <AnimatePresence>
          {(isProcessing || isMerging) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-2xl flex items-center gap-4 min-w-[300px]"
            >
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  <span>{progress.message}</span>
                  {progress.total > 0 && <span>{Math.round((progress.current / progress.total) * 100)}%</span>}
                </div>
                {progress.total > 0 && (
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <button 
                onClick={handleAbort} 
                className="p-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                title="Cancel Operation"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {items.length === 0 && !isProcessing && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <FileDropzoneUpload
              onFilesSelected={(files) => processFiles(files, mergeMode)}
              onFileSelected={(file) => processFiles([file], mergeMode)}
              multiple={true}
              accept=".pdf,image/png,image/jpeg,image/webp"
              title="Drop PDFs & Images Here"
              subtitle="Drag & drop multiple files to extract pages • PDF, PNG, JPG, WEBP"
              accentColor="indigo"
              className="max-w-xl"
            />
          </div>
        )}

        {items.length === 0 && isProcessing && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-400">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-medium">{progress.message || 'Extracting...'}</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
            {isDraggingOver && (
              <div className="absolute inset-0 z-50 bg-indigo-50/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none rounded-2xl border-2 border-dashed border-indigo-500 m-2">
                <UploadCloud className="w-12 h-12 text-indigo-500 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-400">Drop to Add More Files</h3>
              </div>
            )}
            <div className="px-3 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-40">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-400 hidden sm:block">
                {items.length} {mergeMode === 'pages' ? 'Pages' : 'Files'}/Images ({selectedCount} selected)
              </span>
              
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap flex-1 sm:flex-none justify-center sm:justify-end">
                <GridSizeSelector value={gridSize} onChange={setGridSize} />
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1" />

                <button onClick={undo} disabled={past.length === 0} className="text-xs font-semibold px-2 py-1 text-slate-500 disabled:opacity-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"><Undo2 size={14}/> Undo</button>
                <button onClick={redo} disabled={future.length === 0} className="text-xs font-semibold px-2 py-1 text-slate-500 disabled:opacity-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"><Redo2 size={14}/> Redo</button>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1" />
                <button 
                  onClick={selectAll} 
                  disabled={items.length === 0 || selectedCount === items.length}
                  className="text-xs font-semibold px-2 py-1 text-slate-500 disabled:opacity-40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Select All
                </button>
                <button 
                  onClick={deselectAll} 
                  disabled={selectedCount === 0}
                  className="text-xs font-semibold px-2 py-1 text-slate-500 disabled:opacity-40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Deselect All
                </button>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1" />
                <button onClick={clearAll} className="text-xs font-semibold px-2 py-1 text-red-500 hover:text-red-700 transition-colors">Clear All</button>
              </div>
            </div>
            
            <div 
              ref={parentRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar"
            >
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const startIdx = virtualRow.index * columns;
                      const rowItems = items.slice(startIdx, startIdx + columns);
                      const gapPx = parentWidth >= 640 ? 16 : 12;

                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: `${gapPx}px`,
                          }}
                        >
                          <div
                            className="grid"
                            style={{
                              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                              gap: `${gapPx}px`,
                            }}
                          >
                            {rowItems.map((item) => (
                              <SortableThumbnail 
                                key={item.id} 
                                item={item} 
                                onToggleSelect={toggleSelect} 
                                onRemove={removeItem} 
                                onRotate={rotateItem} 
                                onFlip={flipItem} 
                                onPreview={handlePreview} 
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {passwordPrompt && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Password Required</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                "{passwordPrompt.filename}" is password protected.
              </p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = new FormData(e.currentTarget).get('password') as string;
                passwordPrompt.resolve(input);
                setPasswordPrompt(null);
              }}>
                <input
                  type="password"
                  name="password"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter password"
                />
                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      passwordPrompt.resolve(null);
                      setPasswordPrompt(null);
                    }}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-md shadow-indigo-600/20 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MediaCarousel
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        items={items}
        selectedIndex={previewIndex}
        onIndexChange={setPreviewIndex}
        renderItem={(item) => {
          const displaySrc = highResUrls[item.id] || item.thumbnailUrl;

          return (
            <div className="relative max-w-full max-h-[90vh] flex items-center justify-center p-2">
              <img 
                src={displaySrc} 
                alt={item.filename} 
                className="max-w-full max-h-[88vh] object-contain transition-all duration-300 drop-shadow-2xl rounded-sm select-none" 
                style={{
                  transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipX ? -1 : 1}) scaleY(${item.flipY ? -1 : 1})`
                }}
              />
            </div>
          );
        }}
        renderHeaderMiddle={(item, idx, total) => (
          <div className="flex flex-col items-center">
            <span className="font-semibold text-white">
              {item.type === 'pdf-page' ? `Page ${item.pageNum}` : 'Image'} ({idx + 1} of {total})
            </span>
            <span className="text-xs text-white/70 truncate max-w-[200px]">{item.filename}</span>
          </div>
        )}
        renderHeaderRight={(item) => (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/20 bg-white/10 text-white/90 backdrop-blur-md">
              {highResUrls[item.id] ? 'Ultra HD' : 'HD'}
            </span>
          </div>
        )}
      />
    </div>
  );
};
