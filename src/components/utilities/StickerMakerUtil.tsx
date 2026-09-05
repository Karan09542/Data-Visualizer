import React, { useState, useRef, useEffect } from 'react';
import {
  Sticker,
  ImagePlus,
  UploadCloud,
  Download,
  Settings,
  Palette,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crop,
  Square,
  Circle,
  PenTool,
  Maximize2,
  Scissors,
  Undo2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Hand,
  Sparkles,
  Copy,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ai } from '../../ai';
import { ColorPickerTrigger } from '../image-workspace/components/shared/ColorPickers';
import * as d3 from 'd3';

export type SelectionTool = 'full' | 'pan' | 'rect' | 'circle' | 'pen';

export interface RectSelection {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleSelection {
  type: 'circle';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PenSelection {
  type: 'pen';
  points: Array<{ x: number; y: number }>;
  isClosed?: boolean;
}

export type SelectionData = RectSelection | CircleSelection | PenSelection | null;

const PREDEFINED_PATTERNS = [
  { id: 'rainbow', name: 'Rainbow', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6B6B"/><stop offset="25%" stop-color="#FECA57"/><stop offset="50%" stop-color="#48DBFB"/><stop offset="75%" stop-color="#FF9FF3"/><stop offset="100%" stop-color="#54A0FF"/></linearGradient></defs><rect width="20" height="20" fill="url(#r)"/></svg>`)}` },
  { id: 'hearts', name: 'Hearts', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#FFE8F0"/><path d="M12,8 C12,5 9,3 7,5 C5,7 5,9 12,14 C19,9 19,7 17,5 C15,3 12,5 12,8Z" fill="#FF6B9D"/><path d="M22,18 C22,15 19,13 17,15 C15,17 15,19 22,24 C29,19 29,17 27,15 C25,13 22,15 22,18Z" fill="#FF9DBB" opacity="0.6"/></svg>`)}` },
  { id: 'stars', name: 'Stars', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#FFF3CD"/><path d="M12,2 L14,8 L20,9 L15.5,13 L17,19 L12,16 L7,19 L8.5,13 L4,9 L10,8Z" fill="#FFD93D"/><path d="M22,16 L23,19 L26,19.5 L23.5,21.5 L24.5,24.5 L22,23 L19.5,24.5 L20.5,21.5 L18,19.5 L21,19Z" fill="#FF9500" opacity="0.5"/></svg>`)}` },
  { id: 'confetti', name: 'Confetti', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="#F0F0FF"/><rect x="2" y="3" width="3" height="3" rx="0.5" fill="#FF6B6B" transform="rotate(25 3.5 4.5)"/><rect x="12" y="2" width="3" height="3" rx="0.5" fill="#48DBFB" transform="rotate(-15 13.5 3.5)"/><rect x="7" y="12" width="3" height="3" rx="0.5" fill="#FECA57" transform="rotate(40 8.5 13.5)"/><circle cx="16" cy="14" r="1.5" fill="#FF9FF3"/><circle cx="5" cy="8" r="1" fill="#54A0FF"/></svg>`)}` },
  { id: 'holographic', name: 'Holographic', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8edea"/><stop offset="33%" stop-color="#fed6e3"/><stop offset="66%" stop-color="#d4fc79"/><stop offset="100%" stop-color="#96e6a1"/></linearGradient></defs><rect width="20" height="20" fill="url(#h)"/><rect x="0" y="0" width="20" height="2" fill="white" opacity="0.3"/><rect x="0" y="8" width="20" height="1" fill="white" opacity="0.2"/><rect x="0" y="15" width="20" height="1.5" fill="white" opacity="0.15"/></svg>`)}` },
  { id: 'sparkle', name: 'Sparkle', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="#2D1B69"/><path d="M10,2 L11,7 L10,12 L9,7Z" fill="#FFD700"/><path d="M5,7 L10,8 L15,7 L10,6Z" fill="#FFD700"/><path d="M17,14 L18,16.5 L17,19 L16,16.5Z" fill="#FFD700" opacity="0.6"/><path d="M14.5,16.5 L17,17 L19.5,16.5 L17,16Z" fill="#FFD700" opacity="0.6"/><circle cx="4" cy="16" r="0.7" fill="#FFF" opacity="0.5"/></svg>`)}` },
  { id: 'floral', name: 'Floral', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#FFF0F5"/><circle cx="12" cy="12" r="2.5" fill="#FFB6C1"/><circle cx="12" cy="7" r="3" fill="#FF69B4" opacity="0.7"/><circle cx="16" cy="10" r="3" fill="#FF1493" opacity="0.5"/><circle cx="15" cy="15" r="3" fill="#FF69B4" opacity="0.6"/><circle cx="9" cy="15" r="3" fill="#DB7093" opacity="0.5"/><circle cx="8" cy="10" r="3" fill="#FF69B4" opacity="0.6"/><circle cx="12" cy="12" r="1.5" fill="#FFD700"/></svg>`)}` },
  { id: 'waves', name: 'Ocean Waves', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient></defs><rect width="20" height="20" fill="url(#w)"/><path d="M0,8 Q5,4 10,8 Q15,12 20,8" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/><path d="M0,14 Q5,10 10,14 Q15,18 20,14" fill="none" stroke="white" stroke-width="1.5" opacity="0.3"/></svg>`)}` },
  { id: 'paisley', name: 'Paisley', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" fill="#FFF8E7"/><path d="M14,4 C8,4 4,10 4,16 C4,22 8,24 14,20 C12,18 10,14 14,10 C18,6 20,10 16,14 C14,16 16,20 14,20" fill="none" stroke="#C0392B" stroke-width="1.8" stroke-linecap="round"/><circle cx="11" cy="14" r="1" fill="#E67E22"/><circle cx="14" cy="10" r="0.8" fill="#F1C40F"/><path d="M22,22 C20,22 19,24 20,26" fill="none" stroke="#E67E22" stroke-width="1" opacity="0.5"/></svg>`)}` },
  { id: 'rangoli', name: 'Rangoli', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs><radialGradient id="rg"><stop offset="0%" stop-color="#FF9933"/><stop offset="100%" stop-color="#FFE0B2"/></radialGradient></defs><rect width="24" height="24" fill="url(#rg)"/><circle cx="12" cy="12" r="4" fill="none" stroke="#C0392B" stroke-width="1.2"/><circle cx="12" cy="12" r="8" fill="none" stroke="#8E44AD" stroke-width="0.8" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="1.5" fill="#E74C3C"/><path d="M12,4 L14,10 L12,8 L10,10Z" fill="#F39C12" opacity="0.7"/><path d="M12,20 L14,14 L12,16 L10,14Z" fill="#F39C12" opacity="0.7"/><path d="M4,12 L10,10 L8,12 L10,14Z" fill="#F39C12" opacity="0.7"/><path d="M20,12 L14,10 L16,12 L14,14Z" fill="#F39C12" opacity="0.7"/></svg>`)}` },
  { id: 'mandala', name: 'Mandala', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#1A0A2E"/><circle cx="12" cy="12" r="10" fill="none" stroke="#FFD700" stroke-width="0.5" opacity="0.4"/><circle cx="12" cy="12" r="6" fill="none" stroke="#FFD700" stroke-width="0.7" opacity="0.6"/><circle cx="12" cy="12" r="2.5" fill="#FFD700" opacity="0.3"/><circle cx="12" cy="12" r="1" fill="#FFD700"/><path d="M12,2 L12,22 M2,12 L22,12 M4.5,4.5 L19.5,19.5 M19.5,4.5 L4.5,19.5" stroke="#FFD700" stroke-width="0.4" opacity="0.3"/><circle cx="12" cy="6" r="1" fill="#FF6B35" opacity="0.7"/><circle cx="12" cy="18" r="1" fill="#FF6B35" opacity="0.7"/><circle cx="6" cy="12" r="1" fill="#FF6B35" opacity="0.7"/><circle cx="18" cy="12" r="1" fill="#FF6B35" opacity="0.7"/></svg>`)}` },
  { id: 'mehendi', name: 'Mehendi', url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#FDEBD0"/><path d="M12,2 C12,2 8,6 8,12 C8,18 12,22 12,22 C12,22 16,18 16,12 C16,6 12,2 12,2Z" fill="none" stroke="#8B4513" stroke-width="1"/><circle cx="12" cy="8" r="1.5" fill="none" stroke="#D35400" stroke-width="0.8"/><circle cx="12" cy="12" r="1" fill="#D35400"/><circle cx="12" cy="16" r="1.5" fill="none" stroke="#D35400" stroke-width="0.8"/><path d="M8,12 Q6,10 4,12 Q6,14 8,12" fill="none" stroke="#8B4513" stroke-width="0.8"/><path d="M16,12 Q18,10 20,12 Q18,14 16,12" fill="none" stroke="#8B4513" stroke-width="0.8"/><circle cx="4" cy="4" r="0.5" fill="#D35400" opacity="0.4"/><circle cx="20" cy="20" r="0.5" fill="#D35400" opacity="0.4"/></svg>`)}` },
];

type SizeMode = 'original' | 'small' | 'medium' | 'custom';

export function StickerMakerUtil() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [maskImageData, setMaskImageData] = useState<ImageData | null>(null);

  const [modelId, setModelId] = useState<'ormbg' | 'u2netp'>('ormbg');
  const [isProcessing, setIsProcessing] = useState(false);

  const [strokeWidth, setStrokeWidth] = useState<number>(10);
  const [strokeColor, setStrokeColor] = useState<string>('#ffffff');
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);
  const [patternScale, setPatternScale] = useState<number>(1);

  const [selectionTool, setSelectionTool] = useState<SelectionTool>('full');
  const [selection, setSelection] = useState<SelectionData>(null);
  const [isDrawingSelection, setIsDrawingSelection] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [isNearStart, setIsNearStart] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  const [sizeMode, setSizeMode] = useState<SizeMode>('original');
  const [customWidth, setCustomWidth] = useState<number>(512);

  const [isCopying, setIsCopying] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Splitbar resizing state for mobile (vertical) and desktop (horizontal)
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(360, Math.max(180, Math.round(window.innerHeight * 0.45)));
    }
    return 320;
  });
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState<number>(320);
  const [isResizingSplitter, setIsResizingSplitter] = useState(false);
  const isResizingSplitterRef = useRef(false);
  const dragSplitterStartRef = useRef<{ x: number; y: number; startH: number; startW: number }>({ x: 0, y: 0, startH: 320, startW: 320 });
  const rootContainerRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageDisplayRef = useRef<HTMLImageElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const clampZoom = (z: number) => Math.min(Math.max(z, 0.1), 5);

  const getFitZoom = () => {
    const container = previewContainerRef.current;
    const canvas = canvasRef.current;
    if (!container) return 1;
    const cw = container.clientWidth - 32;
    const ch = container.clientHeight - 32;
    let iw: number, ih: number;
    if (canvas && maskImageData) {
      iw = canvas.width;
      ih = canvas.height;
    } else if (originalImage) {
      iw = originalImage.naturalWidth;
      ih = originalImage.naturalHeight;
    } else return 1;
    if (!iw || !ih) return 1;
    return Math.min(cw / iw, ch / ih, 1);
  };

  // Wheel zoom
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => clampZoom(prev + delta));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pinch-to-zoom & two-finger pan
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const getDistance = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const getCenter = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastPinchDistRef.current = getDistance(e.touches);
        lastPinchCenterRef.current = getCenter(e.touches);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistRef.current !== null && lastPinchCenterRef.current !== null) {
        e.preventDefault();
        const dist = getDistance(e.touches);
        const center = getCenter(e.touches);
        const scale = dist / lastPinchDistRef.current;
        setZoom(prev => clampZoom(prev * scale));

        const dx = center.x - lastPinchCenterRef.current.x;
        const dy = center.y - lastPinchCenterRef.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));

        lastPinchDistRef.current = dist;
        lastPinchCenterRef.current = center;
      }
    };
    const onTouchEnd = () => {
      lastPinchDistRef.current = null;
      lastPinchCenterRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Spacebar pan detection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Window resize detection for mobile layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Splitbar drag handlers
  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) { }
    setIsResizingSplitter(true);
    isResizingSplitterRef.current = true;
    dragSplitterStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startH: mobilePanelHeight,
      startW: desktopSidebarWidth
    };
  };

  useEffect(() => {
    if (!isResizingSplitter) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!isResizingSplitterRef.current) return;
      const isMobile = window.innerWidth < 768;
      const root = rootContainerRef.current;

      if (isMobile) {
        const containerH = root ? root.clientHeight : (window.innerHeight || 600);
        // Dragging UP (smaller clientY) -> increase bottom panel height
        // Dragging DOWN (larger clientY) -> decrease bottom panel height
        const deltaY = e.clientY - dragSplitterStartRef.current.y;
        const targetH = dragSplitterStartRef.current.startH - deltaY;
        const minH = 100;
        const maxH = Math.max(minH, containerH - 120);
        setMobilePanelHeight(Math.min(Math.max(targetH, minH), maxH));
      } else {
        const deltaX = e.clientX - dragSplitterStartRef.current.x;
        const targetW = dragSplitterStartRef.current.startW + deltaX;
        const minW = 240;
        const maxW = 500;
        setDesktopSidebarWidth(Math.min(Math.max(targetW, minW), maxW));
      }
    };

    const onPointerUp = () => {
      setIsResizingSplitter(false);
      isResizingSplitterRef.current = false;
    };

    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = window.innerWidth < 768 ? 'row-resize' : 'col-resize';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isResizingSplitter]);

  useEffect(() => {
    if (maskImageData && originalImage && canvasRef.current) {
      renderSticker();
    }
  }, [maskImageData, strokeWidth, strokeColor, patternImage, patternScale, sizeMode, customWidth]);

  useEffect(() => {
    if (maskImageData) {
      const timer = setTimeout(() => {
        setZoom(getFitZoom());
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [maskImageData]);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setSelectedImage(url);
    setMaskImageData(null);
    setSelection(null);
    setSelectionTool('full');
    setHoverPoint(null);
    setIsNearStart(false);
    setPan({ x: 0, y: 0 });

    const img = new Image();
    img.onload = () => {
      setOriginalImage(img);
      if (previewContainerRef.current) {
        const cw = previewContainerRef.current.clientWidth - 48;
        const ch = previewContainerRef.current.clientHeight - 48;
        const fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1);
        setZoom(Math.max(0.05, fit));
      }
    };
    img.src = url;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handlePatternFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setPatternImage(img);
    img.src = url;
  };

  const handlePatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePatternFile(file);
  };

  const getImageCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    const wrapper = imageWrapperRef.current;
    if (!wrapper || !originalImage) return null;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, relX));
    const clampedY = Math.max(0, Math.min(1, relY));
    return {
      x: clampedX * originalImage.naturalWidth,
      y: clampedY * originalImage.naturalHeight
    };
  };

  const undoLastPenPoint = () => {
    if (selection && selection.type === 'pen') {
      if (selection.points.length <= 1) {
        setSelection(null);
        setHoverPoint(null);
        setIsNearStart(false);
      } else {
        setSelection({
          type: 'pen',
          points: selection.points.slice(0, -1),
          isClosed: false
        });
      }
    }
  };

  const closePenPath = () => {
    if (selection && selection.type === 'pen' && selection.points.length >= 3) {
      setSelection({
        type: 'pen',
        points: selection.points,
        isClosed: true
      });
      setHoverPoint(null);
      setIsNearStart(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectionTool === 'pen' && selection && selection.type === 'pen' && !selection.isClosed) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          undoLastPenPoint();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          closePenPath();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSelection(null);
          setHoverPoint(null);
          setIsNearStart(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionTool, selection]);

  const startPan = (clientX: number, clientY: number, pointerId?: number) => {
    setIsPanning(true);
    panStartRef.current = { x: clientX, y: clientY };
    panOriginRef.current = { ...pan };
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, select, [role="button"]')) {
      return;
    }
    const isMiddleClick = e.button === 1;
    const isBackgroundClick = e.target === previewContainerRef.current || (e.target as HTMLElement)?.classList.contains('pointer-events-none');

    if (isMiddleClick || isSpacePressed || isBackgroundClick || maskImageData || selectionTool === 'full' || selectionTool === 'pan') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch (_) { }
      startPan(e.clientX, e.clientY, e.pointerId);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement | HTMLCanvasElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panOriginRef.current.x + dx,
        y: panOriginRef.current.y + dy
      });
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement | HTMLCanvasElement>) => {
    if (isPanning) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) { }
      setIsPanning(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!originalImage) return;

    // Pan when in full/pan tool, or holding space, or middle click
    if (e.button === 1 || isSpacePressed || selectionTool === 'full' || selectionTool === 'pan') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch (_) { }
      startPan(e.clientX, e.clientY, e.pointerId);
      return;
    }

    const pt = getImageCoords(e);
    if (!pt) return;

    if (selectionTool === 'pen') {
      // Pen Tool: Click to place dot / anchor
      if (selection && selection.type === 'pen' && !selection.isClosed) {
        const firstPt = selection.points[0];
        const wrapper = imageWrapperRef.current;
        let isClosing = isNearStart && selection.points.length >= 3;
        if (!isClosing && wrapper && selection.points.length >= 3) {
          const rect = wrapper.getBoundingClientRect();
          const screenPtX = rect.left + (firstPt.x / originalImage.naturalWidth) * rect.width;
          const screenPtY = rect.top + (firstPt.y / originalImage.naturalHeight) * rect.height;
          const dist = Math.hypot(e.clientX - screenPtX, e.clientY - screenPtY);
          if (dist < 24) {
            isClosing = true;
          }
        }

        if (isClosing) {
          setSelection({
            type: 'pen',
            points: selection.points,
            isClosed: true
          });
          setHoverPoint(null);
          setIsNearStart(false);
          return;
        }

        // Close if clicking at or very close to the last dot when >= 3 points exist
        const lastPt = selection.points[selection.points.length - 1];
        const distToLast = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
        if (distToLast < 6 && selection.points.length >= 3) {
          setSelection({
            type: 'pen',
            points: selection.points,
            isClosed: true
          });
          setHoverPoint(null);
          setIsNearStart(false);
          return;
        }

        // Place next anchor dot
        setSelection({
          type: 'pen',
          points: [...selection.points, pt],
          isClosed: false
        });
      } else if (selection && selection.type === 'pen' && selection.isClosed) {
        // Shape is already closed! Do not overwrite on accidental click.
        return;
      } else {
        // Start new pen path
        setSelection({
          type: 'pen',
          points: [pt],
          isClosed: false
        });
      }
      return;
    }

    // Square and Circle click-and-drag
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) { }

    setIsDrawingSelection(true);
    setDrawStartPoint(pt);

    if (selectionTool === 'rect') {
      setSelection({ type: 'rect', x: pt.x, y: pt.y, width: 0, height: 0 });
    } else if (selectionTool === 'circle') {
      setSelection({ type: 'circle', cx: pt.x, cy: pt.y, rx: 0, ry: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panOriginRef.current.x + dx,
        y: panOriginRef.current.y + dy
      });
      return;
    }

    if (!originalImage) return;
    const curr = getImageCoords(e);
    if (!curr) return;

    if (selectionTool === 'pen') {
      if (selection && selection.type === 'pen' && !selection.isClosed) {
        setHoverPoint(curr);
        if (selection.points.length >= 3) {
          const firstPt = selection.points[0];
          const wrapper = imageWrapperRef.current;
          if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            const screenPtX = rect.left + (firstPt.x / originalImage.naturalWidth) * rect.width;
            const screenPtY = rect.top + (firstPt.y / originalImage.naturalHeight) * rect.height;
            const dist = Math.hypot(e.clientX - screenPtX, e.clientY - screenPtY);
            setIsNearStart(dist < 24);
          }
        } else {
          setIsNearStart(false);
        }
      } else {
        setHoverPoint(null);
        setIsNearStart(false);
      }
      return;
    }

    if (!isDrawingSelection) return;

    if (selectionTool === 'rect' && drawStartPoint) {
      const x = Math.min(drawStartPoint.x, curr.x);
      const y = Math.min(drawStartPoint.y, curr.y);
      const width = Math.abs(curr.x - drawStartPoint.x);
      const height = Math.abs(curr.y - drawStartPoint.y);
      setSelection({ type: 'rect', x, y, width, height });
    } else if (selectionTool === 'circle' && drawStartPoint) {
      const cx = (drawStartPoint.x + curr.x) / 2;
      const cy = (drawStartPoint.y + curr.y) / 2;
      const rx = Math.abs(curr.x - drawStartPoint.x) / 2;
      const ry = Math.abs(curr.y - drawStartPoint.y) / 2;
      setSelection({ type: 'circle', cx, cy, rx, ry });
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectionTool === 'pen' && selection && selection.type === 'pen' && selection.points.length >= 3) {
      e.preventDefault();
      e.stopPropagation();
      setSelection({
        type: 'pen',
        points: selection.points,
        isClosed: true
      });
      setHoverPoint(null);
      setIsNearStart(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) { }
      setIsPanning(false);
      return;
    }

    if (selectionTool === 'pen') return;
    if (!isDrawingSelection) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) { }
    setIsDrawingSelection(false);
    setDrawStartPoint(null);

    // Cancel unintentional micro-clicks
    if (selection) {
      if (selection.type === 'rect' && (selection.width < 12 || selection.height < 12)) {
        setSelection(null);
      } else if (selection.type === 'circle' && (selection.rx < 6 || selection.ry < 6)) {
        setSelection(null);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  };

  const processImage = async () => {
    if (!originalImage) return;

    if (selectionTool !== 'full' && selectionTool !== 'pan' && (!selection || (selection.type === 'pen' && selection.points.length < 3))) {
      alert('Please select a specific portion of the image first using the selection tool.');
      return;
    }

    setIsProcessing(true);
    try {
      let cropX = 0;
      let cropY = 0;
      let cropW = originalImage.naturalWidth;
      let cropH = originalImage.naturalHeight;
      const hasCustomSelection = selectionTool !== 'full' && selectionTool !== 'pan' && selection !== null;

      if (hasCustomSelection && selection) {
        if (selection.type === 'rect') {
          const x1 = Math.max(0, Math.min(originalImage.naturalWidth, Math.min(selection.x, selection.x + selection.width)));
          const y1 = Math.max(0, Math.min(originalImage.naturalHeight, Math.min(selection.y, selection.y + selection.height)));
          const x2 = Math.max(0, Math.min(originalImage.naturalWidth, Math.max(selection.x, selection.x + selection.width)));
          const y2 = Math.max(0, Math.min(originalImage.naturalHeight, Math.max(selection.y, selection.y + selection.height)));
          cropX = Math.round(x1);
          cropY = Math.round(y1);
          cropW = Math.round(Math.max(1, x2 - x1));
          cropH = Math.round(Math.max(1, y2 - y1));
        } else if (selection.type === 'circle') {
          const x1 = Math.max(0, Math.min(originalImage.naturalWidth, selection.cx - selection.rx));
          const y1 = Math.max(0, Math.min(originalImage.naturalHeight, selection.cy - selection.ry));
          const x2 = Math.max(0, Math.min(originalImage.naturalWidth, selection.cx + selection.rx));
          const y2 = Math.max(0, Math.min(originalImage.naturalHeight, selection.cy + selection.ry));
          cropX = Math.round(x1);
          cropY = Math.round(y1);
          cropW = Math.round(Math.max(1, x2 - x1));
          cropH = Math.round(Math.max(1, y2 - y1));
        } else if (selection.type === 'pen' && selection.points.length > 2) {
          const xs = selection.points.map(p => p.x);
          const ys = selection.points.map(p => p.y);
          const x1 = Math.max(0, Math.min(originalImage.naturalWidth, Math.min(...xs)));
          const y1 = Math.max(0, Math.min(originalImage.naturalHeight, Math.min(...ys)));
          const x2 = Math.max(0, Math.min(originalImage.naturalWidth, Math.max(...xs)));
          const y2 = Math.max(0, Math.min(originalImage.naturalHeight, Math.max(...ys)));
          cropX = Math.round(x1);
          cropY = Math.round(y1);
          cropW = Math.round(Math.max(1, x2 - x1));
          cropH = Math.round(Math.max(1, y2 - y1));
        }
      }

      if (cropW <= 0 || cropH <= 0) {
        cropX = 0;
        cropY = 0;
        cropW = originalImage.naturalWidth;
        cropH = originalImage.naturalHeight;
      }

      // Offscreen canvas for cropping the source image
      const offscreen = new OffscreenCanvas(cropW, cropH);
      const ctx = offscreen.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(originalImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Create a precise binary pixel mask of the selection
      let maskPixels: Uint8ClampedArray | null = null;
      if (hasCustomSelection && selection) {
        const maskCanvas = new OffscreenCanvas(cropW, cropH);
        const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
        mCtx.clearRect(0, 0, cropW, cropH);
        mCtx.fillStyle = '#ffffff';
        mCtx.beginPath();
        if (selection.type === 'circle') {
          mCtx.ellipse(selection.cx - cropX, selection.cy - cropY, Math.max(1, selection.rx), Math.max(1, selection.ry), 0, 0, Math.PI * 2);
        } else if (selection.type === 'pen' && selection.points.length > 2) {
          selection.points.forEach((p, idx) => {
            if (idx === 0) mCtx.moveTo(p.x - cropX, p.y - cropY);
            else mCtx.lineTo(p.x - cropX, p.y - cropY);
          });
          mCtx.closePath();
        } else if (selection.type === 'rect') {
          mCtx.rect(0, 0, cropW, cropH);
        }
        mCtx.fill();
        maskPixels = mCtx.getImageData(0, 0, cropW, cropH).data;

        // Strictly eliminate everything outside the selection BEFORE AI processing
        const preData = ctx.getImageData(0, 0, cropW, cropH);
        for (let i = 0; i < cropW * cropH; i++) {
          const mAlpha = maskPixels[i * 4 + 3];
          if (mAlpha === 0) {
            preData.data[i * 4] = 0;
            preData.data[i * 4 + 1] = 0;
            preData.data[i * 4 + 2] = 0;
            preData.data[i * 4 + 3] = 0;
          } else if (mAlpha < 255) {
            preData.data[i * 4 + 3] = Math.round((preData.data[i * 4 + 3] * mAlpha) / 255);
          }
        }
        ctx.putImageData(preData, 0, 0);
      }

      // Pass only the isolated selected portion to AI background removal
      const imageData = ctx.getImageData(0, 0, cropW, cropH);
      const { promise } = ai.execute('background-removal', imageData, { modelId }, 1);
      const result = await promise;

      if (result && result.output instanceof ImageData) {
        const finalOutput = result.output;

        // Strictly eliminate any unselected pixels on the AI output
        if (maskPixels) {
          for (let i = 0; i < cropW * cropH; i++) {
            const mAlpha = maskPixels[i * 4 + 3];
            if (mAlpha === 0) {
              finalOutput.data[i * 4] = 0;
              finalOutput.data[i * 4 + 1] = 0;
              finalOutput.data[i * 4 + 2] = 0;
              finalOutput.data[i * 4 + 3] = 0;
            } else if (mAlpha < 255) {
              finalOutput.data[i * 4 + 3] = Math.round((finalOutput.data[i * 4 + 3] * mAlpha) / 255);
            }
          }
        }

        setMaskImageData(finalOutput);
      }
    } catch (err) {
      console.error(err);
      alert('Error processing image. Please make sure the model is downloaded.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSticker = () => {
    if (!maskImageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    let outW = maskImageData.width;
    let outH = maskImageData.height;

    if (sizeMode === 'small') {
      const scale = Math.min(512 / outW, 512 / outH);
      outW *= scale; outH *= scale;
    } else if (sizeMode === 'medium') {
      const scale = Math.min(1024 / outW, 1024 / outH);
      outW *= scale; outH *= scale;
    } else if (sizeMode === 'custom') {
      const scale = customWidth / outW;
      outW = customWidth;
      outH *= scale;
    }

    outW = Math.round(outW);
    outH = Math.round(outH);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskImageData.width;
    maskCanvas.height = maskImageData.height;
    const mCtx = maskCanvas.getContext('2d')!;
    mCtx.putImageData(maskImageData, 0, 0);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = outW;
    resizedCanvas.height = outH;
    const rCtx = resizedCanvas.getContext('2d')!;
    rCtx.imageSmoothingEnabled = true;
    rCtx.imageSmoothingQuality = 'high';
    rCtx.drawImage(maskCanvas, 0, 0, outW, outH);

    const padding = strokeWidth * 2;
    canvas.width = outW + padding;
    canvas.height = outH + padding;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Extract alpha values from the resized mask for contouring
    const resizedMaskData = rCtx.getImageData(0, 0, outW, outH);
    const alphaValues = new Float32Array(outW * outH);
    for (let i = 0, j = 3; i < outW * outH; ++i, j += 4) {
      alphaValues[i] = resizedMaskData.data[j];
    }

    // Use D3 to find contours for the white die-cut bleed border
    const contours = d3.contours()
      .size([outW, outH])
      .thresholds([128]) // 50% opacity threshold
      (alphaValues as unknown as number[]);

    // Set up D3 geoPath to render to canvas
    const pathRenderer = d3.geoPath().context(ctx);

    ctx.save();
    ctx.translate(strokeWidth, strokeWidth);

    // Render the contour as a stroke/bleed border
    if (contours.length > 0) {
      ctx.beginPath();
      // Only one contour multipolygon should be generated for the threshold
      pathRenderer(contours[0]);

      // Setup the fill/stroke style
      if (patternImage) {
        const pattern = ctx.createPattern(patternImage, 'repeat');
        if (pattern) {
          if (patternScale !== 1 && typeof pattern.setTransform === 'function') {
            const matrix = new DOMMatrix().scale(patternScale, patternScale);
            pattern.setTransform(matrix);
          }
          ctx.fillStyle = pattern;
          ctx.strokeStyle = pattern;
        } else {
          ctx.fillStyle = strokeColor;
          ctx.strokeStyle = strokeColor;
        }
      } else {
        ctx.fillStyle = strokeColor;
        ctx.strokeStyle = strokeColor;
      }

      // Fill the inside shape
      ctx.fill();

      // Expand boundary path outwards by fixed padding
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // Draw masked cut-out image on top
    ctx.drawImage(resizedCanvas, 0, 0);
    ctx.restore();
  };

  const getOutputDimensions = () => {
    if (!maskImageData) return null;
    let outW = maskImageData.width;
    let outH = maskImageData.height;
    if (sizeMode === 'small') {
      const scale = Math.min(512 / outW, 512 / outH);
      outW *= scale;
      outH *= scale;
    } else if (sizeMode === 'medium') {
      const scale = Math.min(1024 / outW, 1024 / outH);
      outW *= scale;
      outH *= scale;
    } else if (sizeMode === 'custom') {
      const scale = customWidth / outW;
      outW = customWidth;
      outH *= scale;
    }
    const padding = strokeWidth * 2;
    const finalW = Math.round(outW) + padding;
    const finalH = Math.round(outH) + padding;
    return `${finalW} × ${finalH} px`;
  };

  const showToast = (type: 'success' | 'error', message: string, duration = 2600) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, duration);
  };

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    try {
      const fileName = `sticker_${Date.now()}.png`;
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('success', `Download complete — ${fileName}`, 3200);
    } catch (err) {
      console.error(err);
      showToast('error', 'Download failed. Please try again.');
    }
  };

  const handleCopyToClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      showToast('error', 'Copying images is not supported in this browser.');
      return;
    }

    setIsCopying(true);
    try {
      const blobPromise = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode PNG'))),
          'image/png'
        );
      });
      // Hand the promise straight to ClipboardItem so Safari keeps the user gesture alive
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise as unknown as Blob })
      ]);
      showToast('success', 'Sticker copied to clipboard as PNG');
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not copy to clipboard.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div
      ref={rootContainerRef}
      className="custom-dropzone relative flex h-full w-full bg-white dark:bg-[#0c0f16] flex-col md:flex-row overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="w-full border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 order-3 md:order-1"
        style={{
          height: isMobileView ? `${mobilePanelHeight}px` : undefined,
          width: !isMobileView ? `${desktopSidebarWidth}px` : undefined,
        }}
      >
        {/* Header with Compact Upload / Change */}
        <div className="pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <Sticker className="text-purple-500" size={16} /> Sticker Maker
            </h2>
            {selectedImage && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                title="Change Photo"
              >
                <UploadCloud size={12} /> Change Photo
              </button>
            )}
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

          {!selectedImage && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full mt-3 py-4 px-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${isDraggingOver
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 shadow-lg shadow-purple-500/10 scale-[1.01]'
                  : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
            >
              <UploadCloud className={`transition-colors ${isDraggingOver ? 'text-purple-500 animate-bounce' : 'text-slate-400'}`} size={24} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isDraggingOver ? "Drop Photo Here" : "Upload or Drop Photo"}
              </span>
              <span className="text-[10px] text-slate-400">PNG, JPG, WEBP</span>
            </button>
          )}
        </div>

        {selectedImage && (
          <>
            {/* Selection Tool Mode Controls */}
            {!maskImageData && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Crop size={11} className="text-purple-500" /> Subject Focus
                  </span>
                  {selection && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/50">
                        {selection.type === 'rect'
                          ? `${Math.round(selection.width)}×${Math.round(selection.height)}`
                          : selection.type === 'circle'
                            ? `${Math.round(selection.rx * 2)}×${Math.round(selection.ry * 2)}`
                            : `${selection.points.length} dots`}
                      </span>
                      <button
                        onClick={() => {
                          setSelection(null);
                          setSelectionTool('full');
                        }}
                        className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {/* Sleek Segmented Switcher */}
                <div className="grid grid-cols-5 gap-0.5 p-0.5 bg-slate-200/60 dark:bg-black/50 rounded-lg border border-slate-300/40 dark:border-slate-800/70">
                  <button
                    onClick={() => {
                      setSelectionTool('full');
                      setSelection(null);
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${selectionTool === 'full'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    title="Full Image"
                  >
                    <Maximize2 size={12} />
                    <span>Full</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectionTool('pan');
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${selectionTool === 'pan'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    title="Move / Pan image"
                  >
                    <Hand size={12} />
                    <span>Move</span>
                  </button>

                  <button
                    onClick={() => {
                      if (selectionTool !== 'rect') {
                        setSelectionTool('rect');
                        setSelection(null);
                        setHoverPoint(null);
                        setIsNearStart(false);
                      }
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${selectionTool === 'rect'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    title="Square / Box Selection"
                  >
                    <Square size={12} />
                    <span>Box</span>
                  </button>

                  <button
                    onClick={() => {
                      if (selectionTool !== 'circle') {
                        setSelectionTool('circle');
                        setSelection(null);
                        setHoverPoint(null);
                        setIsNearStart(false);
                      }
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${selectionTool === 'circle'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    title="Circle Selection"
                  >
                    <Circle size={12} />
                    <span>Circle</span>
                  </button>

                  <button
                    onClick={() => {
                      if (selectionTool !== 'pen') {
                        setSelectionTool('pen');
                        setSelection(null);
                        setHoverPoint(null);
                        setIsNearStart(false);
                      }
                    }}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${selectionTool === 'pen'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    title="Dot-by-Dot Pen Tool"
                  >
                    <PenTool size={12} />
                    <span>Pen</span>
                  </button>
                </div>

                {/* Contextual Action / Status Bar */}
                {selectionTool === 'pen' ? (
                  selection && selection.type === 'pen' && selection.points.length > 0 ? (
                    <div className="flex items-center justify-between gap-1.5 bg-purple-500/10 dark:bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-500/30 text-[11px]">
                      <span className="font-semibold text-purple-600 dark:text-purple-300 flex items-center gap-1 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${selection.isClosed ? 'bg-green-400' : 'bg-purple-400 animate-pulse'}`} />
                        {selection.points.length} dot{selection.points.length !== 1 ? 's' : ''} {selection.isClosed ? '(Ready)' : ''}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!selection.isClosed && (
                          <>
                            <button
                              onClick={undoLastPenPoint}
                              className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium flex items-center gap-0.5 transition-colors"
                              title="Undo last dot (Backspace)"
                            >
                              <Undo2 size={10} /> Undo
                            </button>
                            {selection.points.length >= 3 && (
                              <button
                                onClick={closePenPath}
                                className="px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-500 text-white text-[10px] font-medium flex items-center gap-0.5 transition-colors shadow-sm"
                                title="Close shape (Enter)"
                              >
                                <Check size={10} /> Close
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => { setSelection(null); setHoverPoint(null); setIsNearStart(false); }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Clear dots"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 px-1">
                      <PenTool size={11} className="text-purple-400 shrink-0" />
                      <span>Click on preview to place dots. Click #1 to close.</span>
                    </div>
                  )
                ) : selectionTool === 'pan' ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 px-1">
                    <Hand size={11} className="text-purple-400 shrink-0" />
                    <span>Drag anywhere to move image • Scroll to zoom</span>
                  </div>
                ) : selectionTool !== 'full' && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                    <span>{selection ? '✓ Area selected' : '💡 Drag on preview to select region'}</span>
                    {selection && (
                      <button
                        onClick={() => { setSelection(null); setSelectionTool('full'); }}
                        className="text-red-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {maskImageData && (
              <div>
                <button
                  onClick={() => setMaskImageData(null)}
                  className="w-full py-1.5 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold rounded-lg text-xs transition-colors border border-purple-200 dark:border-purple-800/40 flex items-center justify-center gap-1.5"
                >
                  <Crop size={13} /> Re-select Subject / Area
                </button>
              </div>
            )}

            {/* AI Background Removal & Generation Bar */}
            <div className="space-y-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} className="text-purple-400" /> AI Removal Model
                </span>
                <div className="flex bg-slate-200/70 dark:bg-black/40 p-0.5 rounded-lg border border-slate-300/40 dark:border-slate-800/80">
                  <button
                    onClick={() => setModelId('ormbg')}
                    className={`px-2 py-0.5 text-[11px] rounded font-medium transition-all ${modelId === 'ormbg'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    title="ORMBG (High quality)"
                  >
                    ORMBG
                  </button>
                  <button
                    onClick={() => setModelId('u2netp')}
                    className={`px-2 py-0.5 text-[11px] rounded font-medium transition-all ${modelId === 'u2netp'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    title="U2Net-P (Fast)"
                  >
                    U2Net-P
                  </button>
                </div>
              </div>

              <button
                onClick={processImage}
                disabled={isProcessing || (selectionTool !== 'full' && selectionTool !== 'pan' && (!selection || (selection.type === 'pen' && selection.points.length < 3)))}
                className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : selection && selectionTool !== 'full' ? (
                  <Scissors size={15} />
                ) : (
                  <Sticker size={15} />
                )}
                <span>
                  {isProcessing
                    ? 'Processing...'
                    : selectionTool === 'pen' && selection && selection.type === 'pen' && selection.points.length > 0 && selection.points.length < 3
                      ? 'Place at least 3 dots'
                      : selectionTool !== 'full' && selectionTool !== 'pan' && !selection
                        ? 'Select area on preview'
                        : selection && selectionTool !== 'full'
                          ? 'Generate from Selection'
                          : 'Generate Sticker'}
                </span>
              </button>
            </div>

            {maskImageData && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold flex items-center gap-2 dark:text-slate-300">
                  <Palette size={16} /> Stroke Settings
                </h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs dark:text-slate-400">
                    <span>Width</span>
                    <span>{strokeWidth}px</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:shadow-sm hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95 [&::-moz-range-thumb]:transition-transform"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs dark:text-slate-400">Stroke Color</label>
                  <div className="flex gap-2 items-center">
                    <div className="shrink-0 relative h-10 w-10">
                      <ColorPickerTrigger
                        color={strokeColor}
                        onChange={(c: string) => {
                          setStrokeColor(c);
                          setPatternImage(null);
                        }}
                        className="absolute inset-0 w-full h-full rounded border border-slate-300 dark:border-slate-700 shadow-inner cursor-pointer transition-transform active:scale-95 block"
                      />
                    </div>
                    <input
                      type="text" value={strokeColor}
                      onChange={(e) => {
                        setStrokeColor(e.target.value);
                        setPatternImage(null);
                      }}
                      className="flex-1 px-3 py-2 h-10 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c0f16] dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs dark:text-slate-400">
                    <label>Or use Pattern</label>
                    {patternImage && (
                      <button
                        onClick={() => setPatternImage(null)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        Clear Pattern
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_PATTERNS.map(pattern => {
                      const isSelected = patternImage?.src === pattern.url;
                      return (
                        <button
                          key={pattern.id}
                          onClick={() => {
                            const img = new Image();
                            img.onload = () => setPatternImage(img);
                            img.src = pattern.url;
                          }}
                          className={`w-10 h-10 rounded-lg border transition-all shadow-sm cursor-pointer shrink-0 ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-slate-300 dark:border-slate-700 hover:border-purple-400'}`}
                          title={pattern.name}
                          style={{
                            backgroundImage: `url("${pattern.url}")`,
                            backgroundRepeat: 'repeat',
                            backgroundSize: '16px 16px',
                            backgroundColor: 'white'
                          }}
                        />
                      );
                    })}

                    <input type="file" ref={patternInputRef} className="hidden" accept="image/*" onChange={handlePatternUpload} />
                    <button
                      onClick={() => patternInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          handlePatternFile(file);
                        }
                      }}
                      className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-400 transition-all flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 active:scale-95"
                      title="Upload or Drop Custom Pattern"
                    >
                      <ImagePlus size={16} />
                    </button>
                  </div>

                  {patternImage && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-xs dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Pattern Size</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold text-xs">
                            {Math.round(patternScale * 100)}%
                          </span>
                          {patternScale !== 1 && (
                            <button
                              onClick={() => setPatternScale(1)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                              title="Reset to 100%"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="4"
                        step="0.05"
                        value={patternScale}
                        onChange={(e) => setPatternScale(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:shadow-sm hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95 [&::-moz-range-thumb]:transition-transform"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
                        <span>10% (Dense)</span>
                        <span>100%</span>
                        <span>400% (Large)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {maskImageData && (
              <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ImagePlus size={11} className="text-purple-400" /> Output Size
                  </span>
                  {getOutputDimensions() && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-black/40 text-slate-600 dark:text-slate-400 font-medium border border-slate-300/40 dark:border-slate-800/80">
                      {getOutputDimensions()}
                    </span>
                  )}
                </div>

                {/* Sleek Segmented Switcher */}
                <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-200/60 dark:bg-black/50 rounded-lg border border-slate-300/40 dark:border-slate-800/70">
                  {[
                    { id: 'original', label: 'Original' },
                    { id: 'medium', label: '1024px' },
                    { id: 'small', label: '512px' },
                    { id: 'custom', label: 'Custom' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSizeMode(opt.id as SizeMode)}
                      className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center transition-all ${sizeMode === opt.id
                          ? 'bg-purple-600 text-white shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5'
                        }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {sizeMode === 'custom' && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="64"
                        max="8192"
                        step="32"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(32, parseInt(e.target.value) || 512))}
                        className="w-full h-8 pl-2.5 pr-7 border border-slate-300 dark:border-slate-700/80 rounded-lg bg-white dark:bg-[#0c0f16] text-xs dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-mono"
                        placeholder="Width"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 select-none pointer-events-none">px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[256, 512, 1024, 2048].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCustomWidth(preset)}
                          className={`px-1.5 py-1 text-[10px] font-mono rounded transition-colors ${customWidth === preset
                              ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold border border-purple-500/30'
                              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modern Ultra-Polished Download Button */}
                <button
                  onClick={handleDownload}
                  className="w-full mt-2 py-2.5 px-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 dark:shadow-emerald-950/40 border border-emerald-400/30 transition-all flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Download size={13} className="text-white group-hover:translate-y-0.5 transition-transform" />
                    </div>
                    <span className="font-semibold text-white tracking-wide">Download Sticker</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getOutputDimensions() && (
                      <span className="text-[10px] font-mono opacity-80">{getOutputDimensions()}</span>
                    )}
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/20 text-white/95 border border-white/10">PNG</span>
                  </div>
                </button>

                {/* Copy PNG to Clipboard */}
                <button
                  onClick={handleCopyToClipboard}
                  disabled={isCopying}
                  className="w-full py-2 px-3.5 bg-white dark:bg-[#0c0f16] hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700/80 hover:border-purple-400 dark:hover:border-purple-500/60 transition-all flex items-center justify-between group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Copy sticker to clipboard as PNG"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-300 group-hover:scale-110 transition-transform">
                      {isCopying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    </div>
                    <span className="tracking-wide">{isCopying ? 'Copying…' : 'Copy to Clipboard'}</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700">PNG</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Splitbar Divider for Mobile and Desktop */}
      <div
        onPointerDown={handleSplitterPointerDown}
        onDoubleClick={() => {
          if (isMobileView) setMobilePanelHeight(320);
          else setDesktopSidebarWidth(320);
        }}
        className={`order-2 relative z-30 shrink-0 select-none flex items-center justify-center transition-colors group touch-none ${isMobileView
            ? 'w-full h-5 cursor-row-resize bg-slate-100 dark:bg-[#111622] border-y border-slate-200/80 dark:border-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/20 active:bg-purple-100/50 dark:active:bg-purple-900/30'
            : 'h-full w-2.5 cursor-col-resize bg-slate-100/80 dark:bg-[#111622]/80 border-r border-slate-200/80 dark:border-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/20 active:bg-purple-100/50 dark:active:bg-purple-900/30'
          }`}
        title={isMobileView ? "Drag to resize preview and controls (Double-tap to reset)" : "Drag to resize sidebar (Double-click to reset)"}
      >
        {isMobileView ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-purple-500 group-active:bg-purple-400 group-hover:w-16 transition-all shadow-sm" />
          </div>
        ) : (
          <div className="w-1 h-8 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-purple-500 group-active:bg-purple-400 group-hover:h-12 transition-all shadow-sm" />
        )}
      </div>

      <div className="flex-1 min-h-0 bg-slate-100/50 dark:bg-[#080b11] p-4 flex items-center justify-center overflow-hidden relative order-1 md:order-3">
        <div
          ref={previewContainerRef}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerCancel={handleContainerPointerUp}
          className={`w-full h-full border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden bg-white/50 dark:bg-black/20 touch-none ${isPanning
              ? 'cursor-grabbing'
              : isSpacePressed || selectionTool === 'full' || selectionTool === 'pan' || maskImageData
                ? 'cursor-grab'
                : 'cursor-default'
            }`}
        >
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: 'conic-gradient(rgba(128,128,128,0.3) 90deg, transparent 90deg 180deg, rgba(128,128,128,0.3) 180deg 270deg, transparent 270deg)', backgroundSize: '20px 20px' }}
          />

          {/* Floating Selection Tool Bar in Preview when Image is loaded and sticker not generated */}
          {selectedImage && !maskImageData && (
            isToolbarCollapsed ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsToolbarCollapsed(false)}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-1.5 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all select-none animate-in fade-in zoom-in-95 duration-150 group"
                title="Expand Selection Toolbar"
              >
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tool:</span>
                {selectionTool === 'full' && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                    <Maximize2 size={12} /> Full
                  </span>
                )}
                {selectionTool === 'pan' && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                    <Hand size={12} /> Move
                  </span>
                )}
                {selectionTool === 'rect' && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                    <Square size={12} /> Square
                  </span>
                )}
                {selectionTool === 'circle' && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                    <Circle size={12} /> Circle
                  </span>
                )}
                {selectionTool === 'pen' && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                    <PenTool size={12} /> Pen
                  </span>
                )}
                <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <ChevronDown size={13} className="text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </button>
            ) : (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-1 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl rounded-full px-2 py-1 select-none animate-in fade-in zoom-in-95 duration-150"
              >
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-1.5">Tool:</span>
                <button
                  onClick={() => { setSelectionTool('full'); setSelection(null); setHoverPoint(null); setIsNearStart(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${selectionTool === 'full' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Full Image (Click & drag to move)"
                >
                  <Maximize2 size={13} /> Full
                </button>
                <button
                  onClick={() => { setSelectionTool('pan'); setHoverPoint(null); setIsNearStart(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${selectionTool === 'pan' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Move / Pan Image (Drag in any direction)"
                >
                  <Hand size={13} /> Move
                </button>
                <button
                  onClick={() => {
                    if (selectionTool !== 'rect') {
                      setSelectionTool('rect');
                      setSelection(null);
                      setHoverPoint(null);
                      setIsNearStart(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${selectionTool === 'rect' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Square / Box Selection"
                >
                  <Square size={13} /> Square
                </button>
                <button
                  onClick={() => {
                    if (selectionTool !== 'circle') {
                      setSelectionTool('circle');
                      setSelection(null);
                      setHoverPoint(null);
                      setIsNearStart(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${selectionTool === 'circle' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Circle Selection"
                >
                  <Circle size={13} /> Circle
                </button>
                <button
                  onClick={() => {
                    if (selectionTool !== 'pen') {
                      setSelectionTool('pen');
                      setSelection(null);
                      setHoverPoint(null);
                      setIsNearStart(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${selectionTool === 'pen' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Dot-by-Dot Pen Tool"
                >
                  <PenTool size={13} /> Pen
                </button>

                {selection && (
                  <>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                    <button
                      onClick={() => { setSelection(null); setHoverPoint(null); setIsNearStart(false); setSelectionTool('full'); }}
                      className="px-2 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                      title="Clear Selection"
                    >
                      Clear
                    </button>
                  </>
                )}

                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <button
                  onClick={() => setIsToolbarCollapsed(true)}
                  className="p-1 rounded-full text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                  title="Collapse Toolbar"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
            )
          )}

          {/* Floating Pen In-Progress Helper Pill */}
          {selectedImage && !maskImageData && selectionTool === 'pen' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-1.5 bg-slate-900/90 dark:bg-[#161b22]/95 text-white backdrop-blur-xl border border-purple-500/40 shadow-xl rounded-full px-3 py-1 text-xs select-none animate-in fade-in slide-in-from-top-1 duration-150 whitespace-nowrap"
            >
              {selection && selection.type === 'pen' && selection.points.length > 0 ? (
                <>
                  <span className="flex items-center gap-1.5 font-medium text-purple-300">
                    <span className={`w-2 h-2 rounded-full ${selection.isClosed ? 'bg-green-400' : 'bg-purple-400 animate-pulse'}`} />
                    {selection.points.length} dot{selection.points.length !== 1 ? 's' : ''} {selection.isClosed ? '(Closed)' : ''}
                  </span>

                  {!selection.isClosed && (
                    <>
                      <div className="w-px h-3.5 bg-slate-700 mx-0.5" />
                      <button
                        onClick={undoLastPenPoint}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-[11px]"
                        title="Undo last dot (Backspace)"
                      >
                        <Undo2 size={11} /> Undo
                      </button>
                      {selection.points.length >= 3 && (
                        <button
                          onClick={closePenPath}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600 hover:bg-green-500 text-white font-medium transition-colors shadow-sm text-[11px]"
                          title="Close shape (Enter or click first dot)"
                        >
                          <Check size={11} /> Close
                        </button>
                      )}
                    </>
                  )}

                  <div className="w-px h-3.5 bg-slate-700 mx-0.5" />
                  <button
                    onClick={() => { setSelection(null); setHoverPoint(null); setIsNearStart(false); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors text-[11px]"
                    title="Clear dots (Esc)"
                  >
                    <X size={11} /> Clear
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <PenTool size={11} className="text-purple-400" />
                  Click anywhere on the image to place dots
                </span>
              )}
            </div>
          )}

          {maskImageData ? (
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.button !== 1) return;
                try {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                } catch (_) { }
                startPan(e.clientX, e.clientY, e.pointerId);
              }}
              onPointerMove={handleContainerPointerMove}
              onPointerUp={handleContainerPointerUp}
              onPointerCancel={handleContainerPointerUp}
              className={`object-contain relative z-10 filter drop-shadow-2xl ${isPanning ? 'transition-none cursor-grabbing' : 'transition-transform duration-150 ease-out cursor-grab'} max-w-none`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center'
              }}
            />
          ) : selectedImage && originalImage ? (
            <div
              ref={imageWrapperRef}
              className={`relative z-10 select-none max-w-none ${isPanning ? 'transition-none' : 'transition-transform duration-150 ease-out'}`}
              style={{
                width: originalImage.naturalWidth,
                height: originalImage.naturalHeight,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center'
              }}
            >
              <img
                ref={imageDisplayRef}
                src={selectedImage}
                alt="Selected"
                className="w-full h-full block select-none pointer-events-none"
                draggable={false}
              />

              {/* Selection Interactive Overlay */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => {
                  if (!isPanning) {
                    setHoverPoint(null);
                    setIsNearStart(false);
                  }
                }}
                onDoubleClick={handleDoubleClick}
                className={`absolute inset-0 touch-none select-none z-20 ${isPanning
                    ? 'cursor-grabbing'
                    : isSpacePressed || selectionTool === 'full' || selectionTool === 'pan'
                      ? 'cursor-grab'
                      : selectionTool === 'pen'
                        ? (isNearStart ? 'cursor-pointer' : 'cursor-crosshair')
                        : 'cursor-crosshair'
                  }`}
              >
                <svg
                  viewBox={`0 0 ${originalImage.naturalWidth} ${originalImage.naturalHeight}`}
                  className="w-full h-full pointer-events-none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="sticker-selection-mask">
                      <rect x="0" y="0" width="100%" height="100%" fill="white" />
                      {selection && selection.type === 'rect' && (
                        <rect x={selection.x} y={selection.y} width={selection.width} height={selection.height} fill="black" />
                      )}
                      {selection && selection.type === 'circle' && (
                        <ellipse cx={selection.cx} cy={selection.cy} rx={selection.rx} ry={selection.ry} fill="black" />
                      )}
                      {selection && selection.type === 'pen' && (selection.isClosed ? selection.points.length > 2 : false) && (
                        <polygon points={selection.points.map(p => `${p.x},${p.y}`).join(' ')} fill="black" />
                      )}
                    </mask>
                  </defs>

                  {/* Dimmed Background Overlay */}
                  {selection && selectionTool !== 'full' && (selection.type !== 'pen' || selection.isClosed) && (
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      fill="rgba(0, 0, 0, 0.55)"
                      mask="url(#sticker-selection-mask)"
                    />
                  )}

                  {/* Highlight Boundaries */}
                  {selection && selection.type === 'rect' && (
                    <rect
                      x={selection.x}
                      y={selection.y}
                      width={selection.width}
                      height={selection.height}
                      fill="rgba(168, 85, 247, 0.08)"
                      stroke="#a855f7"
                      strokeWidth={Math.max(2, originalImage.naturalWidth / 400)}
                      strokeDasharray="6 4"
                    />
                  )}
                  {selection && selection.type === 'circle' && (
                    <ellipse
                      cx={selection.cx}
                      cy={selection.cy}
                      rx={selection.rx}
                      ry={selection.ry}
                      fill="rgba(168, 85, 247, 0.08)"
                      stroke="#a855f7"
                      strokeWidth={Math.max(2, originalImage.naturalWidth / 400)}
                      strokeDasharray="6 4"
                    />
                  )}
                  {selection && selection.type === 'pen' && (
                    <g>
                      {/* Polygon shaded area */}
                      {selection.points.length > 2 && (
                        <polygon
                          points={selection.points.map(p => `${p.x},${p.y}`).join(' ')}
                          fill={selection.isClosed ? "rgba(168, 85, 247, 0.15)" : "rgba(168, 85, 247, 0.06)"}
                          stroke="none"
                        />
                      )}

                      {/* Connecting lines */}
                      {selection.points.length > 1 && (
                        selection.isClosed ? (
                          <polygon
                            points={selection.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth={Math.max(2, originalImage.naturalWidth / 350)}
                            strokeDasharray="6 4"
                            strokeLinejoin="round"
                          />
                        ) : (
                          <polyline
                            points={selection.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth={Math.max(2, originalImage.naturalWidth / 350)}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        )
                      )}

                      {/* Rubber-band dynamic line to cursor */}
                      {!selection.isClosed && hoverPoint && selection.points.length > 0 && !isNearStart && (
                        <line
                          x1={selection.points[selection.points.length - 1].x}
                          y1={selection.points[selection.points.length - 1].y}
                          x2={hoverPoint.x}
                          y2={hoverPoint.y}
                          stroke="#c084fc"
                          strokeWidth={Math.max(2, originalImage.naturalWidth / 350)}
                          strokeDasharray="5 3"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Dynamic closing line when hovering near start dot */}
                      {!selection.isClosed && isNearStart && selection.points.length >= 3 && (
                        <line
                          x1={selection.points[selection.points.length - 1].x}
                          y1={selection.points[selection.points.length - 1].y}
                          x2={selection.points[0].x}
                          y2={selection.points[0].y}
                          stroke="#22c55e"
                          strokeWidth={Math.max(2.5, originalImage.naturalWidth / 300)}
                          strokeDasharray="4 2"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Anchor dots (Vertices) */}
                      {selection.points.map((p, idx) => {
                        const isStartDot = idx === 0;
                        const canClose = isStartDot && !selection.isClosed && selection.points.length >= 3;
                        const dotR = Math.max(6, originalImage.naturalWidth / 90);
                        const strokeW = Math.max(2, originalImage.naturalWidth / 350);

                        if (canClose && isNearStart) {
                          return (
                            <g key={idx}>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={dotR * 2.2}
                                fill="rgba(34, 197, 94, 0.25)"
                                stroke="#22c55e"
                                strokeWidth={strokeW}
                              />
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={dotR * 1.4}
                                fill="#22c55e"
                                stroke="#ffffff"
                                strokeWidth={strokeW * 1.2}
                              />
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={dotR * 0.5}
                                fill="#ffffff"
                              />
                              <g transform={`translate(${p.x}, ${p.y - dotR * 2.4})`}>
                                <rect
                                  x={-34}
                                  y={-12}
                                  width={68}
                                  height={18}
                                  rx={9}
                                  fill="#22c55e"
                                  stroke="#ffffff"
                                  strokeWidth={Math.max(1, strokeW * 0.5)}
                                />
                                <text
                                  x={0}
                                  y={0}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#ffffff"
                                  fontSize={Math.max(10, Math.min(13, dotR * 1.1))}
                                  fontWeight="bold"
                                  fontFamily="sans-serif"
                                >
                                  Close Path
                                </text>
                              </g>
                            </g>
                          );
                        }

                        if (isStartDot && !selection.isClosed && selection.points.length >= 3) {
                          return (
                            <g key={idx}>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={dotR * 1.3}
                                fill="#a855f7"
                                stroke="#ffffff"
                                strokeWidth={strokeW * 1.2}
                              />
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={dotR * 0.45}
                                fill="#ffffff"
                              />
                            </g>
                          );
                        }

                        return (
                          <g key={idx}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={dotR}
                              fill="#ffffff"
                              stroke="#9333ea"
                              strokeWidth={strokeW}
                            />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={dotR * 0.4}
                              fill="#9333ea"
                            />
                          </g>
                        );
                      })}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 dark:text-slate-600 relative z-10">
              <Sticker size={64} className="mx-auto mb-4 opacity-50" />
              <p>Upload or drop an image to start making stickers</p>
            </div>
          )}

          {/* Drag Overlay Indicator */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-30 bg-purple-500/10 dark:bg-purple-950/40 backdrop-blur-sm border-2 border-dashed border-purple-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150 m-2">
              <div className="p-5 bg-white/95 dark:bg-[#161b22]/95 rounded-2xl shadow-2xl border border-purple-500/30 flex flex-col items-center gap-2 text-center max-w-xs">
                <UploadCloud className="text-purple-500 animate-bounce" size={40} />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Drop photo to make sticker</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Supports PNG, JPG, WEBP</span>
              </div>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        {(maskImageData || selectedImage) && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-white/90 dark:bg-[#1e1e2e]/90 backdrop-blur-xl rounded-full border border-slate-200/80 dark:border-slate-600/40 shadow-xl shadow-black/10 dark:shadow-black/30 px-1.5 py-1"
          >
            <button
              onClick={() => setZoom(prev => clampZoom(prev - 0.25))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-300 transition-all active:scale-90"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-semibold font-mono text-slate-600 dark:text-slate-300 w-9 text-center select-none tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(prev => clampZoom(prev + 0.25))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-300 transition-all active:scale-90"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-0.5" />
            <button
              onClick={() => {
                setZoom(getFitZoom());
                setPan({ x: 0, y: 0 });
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-300 transition-all active:scale-90"
              title="Fit to View & Center"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Status Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-4 right-4 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-xl backdrop-blur-xl border text-xs font-semibold ${toast.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-300/70 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50/95 dark:bg-red-950/80 border-red-300/70 dark:border-red-800/60 text-red-700 dark:text-red-200'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-red-500 dark:text-red-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
