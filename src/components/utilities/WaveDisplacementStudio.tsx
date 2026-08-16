import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
   Upload, Play, Pause, Layers, Trash2, Waves,
   Plus, Ratio, Clock, Maximize, Minimize, Sliders, X
} from 'lucide-react';
import { FilterMode, AspectRatioMode, FILTER_PRESETS, ASPECT_PRESETS, VERTEX_SHADER, FRAGMENT_SHADER } from './WaveDisplacementShaders';
import { WaveInspectorTabs, InspectorTabType } from './WaveInspectorTabs';
import { WaveEffectsTab, WaveControlsTab, WaveExportTab, WaveImageTab, WaveMaskTab, WaveTextTab } from './WaveInspectorTabContent';

const NATIVE_RAF = typeof window !== 'undefined' ? window.requestAnimationFrame.bind(window) : ((cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number);
const NATIVE_CAF = typeof window !== 'undefined' ? window.cancelAnimationFrame.bind(window) : clearTimeout;

export type MaskTool = 'select' | 'brush' | 'pen' | 'eraser' | 'circle' | 'square' | 'triangle' | 'text';
export type TransformHandle = 'rotate' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'resize-l' | 'resize-r' | 'resize-t' | 'resize-b';

export interface BezierPoint {
   x: number;
   y: number;
   handleIn?: { x: number; y: number };
   handleOut?: { x: number; y: number };
}

export interface MaskObject {
   id: string;
   type: 'path' | 'circle' | 'square' | 'triangle' | 'bezier' | 'text';
   isEraser: boolean;
   x: number;
   y: number;
   size: number;
   rotation: number;
   points?: { x: number, y: number }[];
   bezierPoints?: BezierPoint[];
   closed?: boolean;
   // Text specific
   textContent?: string;
   fontFamily?: string;
   color?: string;
   affectedByWaves?: boolean;
}

export interface PoolImage {
   id: string;
   url: string;
   name: string;
   scale: number;
   dispIntensity: number;
   rotation: number;
   translateX: number;
   translateY: number;
   flipX: boolean;
   flipY: boolean;
   filterOverride: FilterMode | null;
   holdDurationOverride: number | null;
   filters: {
      brightness: number;
      contrast: number;
      exposure: number;
      hue: number;
      sepia: number;
   } | null;
   maskDataUrl?: string;
   maskObjects?: MaskObject[];
}

// Fallback for crypto.randomUUID which requires secure context (HTTPS)
const generateId = (): string => {
   if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
   }
   // Fallback using crypto.getRandomValues (works on HTTP too)
   const arr = new Uint8Array(16);
   crypto.getRandomValues(arr);
   arr[6] = (arr[6] & 0x0f) | 0x40;
   arr[8] = (arr[8] & 0x3f) | 0x80;
   const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
   return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

const SortableThumbnail = ({ id, img, index, currentIndex, onSelect, onRemove }: any) => {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
   const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : 1,
   };
   const isActive = index === currentIndex;

   return (
      <div
         ref={setNodeRef}
         style={style}
         {...attributes}
         {...listeners}
         onPointerUp={(e) => {
            // Only select if it wasn't a drag (DnD sets isDragging)
            if (!isDragging) onSelect(index);
         }}
         className={`relative group shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl border overflow-hidden transition-all cursor-grab active:cursor-grabbing touch-none ${isActive
            ? 'border-cyan-400 ring-2 ring-cyan-500/40 scale-105 shadow-md shadow-cyan-500/20'
            : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
            }`}
      >
         <img src={img.url} alt={img.name} className="w-full h-full object-cover pointer-events-none" />
         {/* Delete button: always visible on active thumbnail, hover-only on desktop for others */}
         <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
               e.stopPropagation();
               onRemove(img.id);
            }}
            className={`absolute -top-0.5 -right-0.5 p-0.5 md:p-1 bg-black/90 text-red-400 hover:text-red-300 rounded-full md:rounded-md transition-opacity z-10 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            title="Remove Image"
         >
            <Trash2 size={8} className="md:w-2.5 md:h-2.5" />
         </button>
      </div>
   );
};

export function WaveDisplacementStudio() {
   // Canvas & WebGL References
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const sceneRef = useRef<THREE.Scene | null>(null);
   const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
   const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
   const materialRef = useRef<THREE.ShaderMaterial | null>(null);
   const texturesMapRef = useRef<Map<string, THREE.Texture>>(new Map());

   // Tabbed Inspector State
   const [inspectorTab, setInspectorTab] = useState<InspectorTabType>('effects');

   // Image Pool Items & Aspect Ratios
   const [images, setImages] = useState<PoolImage[]>([]);
   const imagesRef = useRef<PoolImage[]>([]);
   const [currentIndex, setCurrentIndex] = useState<number>(0);
   const currentIndexRef = useRef<number>(0);

   const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>('auto');
   const [detectedImageAspect, setDetectedImageAspect] = useState<number>(1.0);
   const viewportRef = useRef<HTMLDivElement | null>(null);
   const [viewportSize, setViewportSize] = useState<{ w: number, h: number }>({ w: 600, h: 400 });

   const [isFullscreen, setIsFullscreen] = useState(false);
   const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
   const [sheetHeight, setSheetHeight] = useState(50); // percentage (vh)
   const isDraggingSheetRef = useRef(false);

   useEffect(() => {
      const handleFullscreenChange = () => {
         setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      return () => {
         document.removeEventListener('fullscreenchange', handleFullscreenChange);
         document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      };
   }, []);

   const toggleFullscreen = () => {
      const doc = document as any;
      const fsElement = document.fullscreenElement || doc.webkitFullscreenElement;
      if (!fsElement) {
         const el = viewportRef.current as any;
         if (!el) return;
         if (el.requestFullscreen) {
            el.requestFullscreen().catch((err: Error) => console.error(`Fullscreen error: ${err.message}`));
         } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
         }
      } else {
         if (document.exitFullscreen) {
            document.exitFullscreen();
         } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
         }
      }
   };

   // DND Sensors
   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   // Sync images state to ref for callback access without triggering dependency updates
   useEffect(() => {
      imagesRef.current = images;
   }, [images]);

   // Handle Drag End for Thumbnail Reordering
   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
         setImages((items) => {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over.id);
            const newItems = arrayMove(items, oldIndex, newIndex);

            imagesRef.current = newItems;

            let newCurrent = currentIndexRef.current;
            if (newCurrent === oldIndex) {
               newCurrent = newIndex;
            } else if (newCurrent > oldIndex && newCurrent <= newIndex) {
               newCurrent--;
            } else if (newCurrent < oldIndex && newCurrent >= newIndex) {
               newCurrent++;
            }

            currentIndexRef.current = newCurrent;
            setCurrentIndex(newCurrent);
            bindTexturesForIndex(newCurrent);

            return newItems;
         });
      }
   };

   // Shader Control States
   const [filterMode, setFilterMode] = useState<FilterMode>('directional');
   const [displacementFunc, setDisplacementFunc] = useState<number>(0);
   const [waveAngle, setWaveAngle] = useState<number>(45);
   const [waveSpeed, setWaveSpeed] = useState<number>(0.6);
   const [waveFrequency, setWaveFrequency] = useState<number>(0.6);
   const [waveAmplitude, setWaveAmplitude] = useState<number>(0.4);
   const [transitionDuration, setTransitionDuration] = useState<number>(2.0);
   const [autoTransition, setAutoTransition] = useState<boolean>(true);
   const [isPlaying, setIsPlaying] = useState<boolean>(true);
   const [manualProgress, setManualProgress] = useState<number>(0.0);

   // Masking State
   const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
   const uiOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
   const [isMaskMode, setIsMaskMode] = useState<boolean>(false);
   const [maskTool, setMaskTool] = useState<MaskTool>('pen');
   const [maskBrushSize, setMaskBrushSize] = useState<number>(30);
   const [maskRotation, setMaskRotation] = useState<number>(0);
   const isDrawingRef = useRef<boolean>(false);
   const maskTextureRef = useRef<THREE.CanvasTexture | null>(null);
   const maskStartX = useRef<number>(0);
   const maskStartY = useRef<number>(0);

   // Vector Mask Data
   const currentMaskObjectsRef = useRef<MaskObject[]>([]);
   const [activeMaskObjectId, setActiveMaskObjectId] = useState<string | null>(null);
   const isDraggingObjectRef = useRef<boolean>(false);
   const activeBezierPathIdRef = useRef<string | null>(null);
   const isDraggingAnchorRef = useRef<boolean>(false);

   const prevMaskBrushSizeRef = useRef(20);
   const prevMaskRotationRef = useRef(0);

   const penPreviewCoordsRef = useRef<{ x: number, y: number } | null>(null);

   // Text Tool State
   const [textToolContent, setTextToolContent] = useState<string>("Text");
   const [textToolFontFamily, setTextToolFontFamily] = useState<string>("Inter");
   const [textToolColor, setTextToolColor] = useState<string>("#ffffff");
   const [textToolAffectedByWaves, setTextToolAffectedByWaves] = useState<boolean>(true);
   const textCanvasDisplacedRef = useRef<HTMLCanvasElement | null>(null);
   const textCanvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
   const textTextureDisplacedRef = useRef<THREE.CanvasTexture | null>(null);
   const textTextureOverlayRef = useRef<THREE.CanvasTexture | null>(null);

   const maskHistoryRef = useRef<string[]>([]);
   const maskHistoryIndexRef = useRef<number>(-1);
   const [canUndo, setCanUndo] = useState(false);
   const [canRedo, setCanRedo] = useState(false);

   // Transform Handle State
   const [hoverHandle, setHoverHandle] = useState<TransformHandle | null>(null);
   const dragHandleRef = useRef<TransformHandle | null>(null);
   const initialTransformRef = useRef<{
      size: number; rotation: number; mouseX: number; mouseY: number; objX: number; objY: number;
      points?: { x: number, y: number }[];
      bezierPoints?: BezierPoint[];
      bounds?: { minX: number, minY: number, maxX: number, maxY: number, centerX: number, centerY: number, width: number, height: number };
   } | null>(null);

   // Sync Active Object with UI
   useEffect(() => {
      if (activeMaskObjectId && inspectorTab === 'text') {
         const obj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (obj && obj.type === 'text') {
            setTextToolContent(obj.textContent || "");
            setTextToolFontFamily(obj.fontFamily || "Inter");
            setTextToolColor(obj.color || "#ffffff");
            setTextToolAffectedByWaves(obj.affectedByWaves !== false);
            setMaskBrushSize(Math.round(obj.size || 30));
            setMaskRotation(Math.round(obj.rotation || 0));
         }
      }
   }, [activeMaskObjectId, inspectorTab]);

   useEffect(() => {
      if (activeMaskObjectId && inspectorTab === 'text') {
         const obj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (obj && obj.type === 'text') {
            if (obj.textContent !== textToolContent ||
               obj.fontFamily !== textToolFontFamily ||
               obj.color !== textToolColor ||
               obj.affectedByWaves !== textToolAffectedByWaves ||
               Math.round(obj.size) !== maskBrushSize ||
               Math.round(obj.rotation) !== maskRotation) {

               obj.textContent = textToolContent;
               obj.fontFamily = textToolFontFamily;
               obj.color = textToolColor;
               obj.affectedByWaves = textToolAffectedByWaves;
               obj.size = maskBrushSize;
               obj.rotation = maskRotation;

               renderTextObjects();
               renderUIOverlay();
               // We don't save to history immediately to avoid rapid changes, just sync visually
            }
         }
      }
   }, [textToolContent, textToolFontFamily, textToolColor, textToolAffectedByWaves, maskBrushSize, maskRotation]);

   // Missing State Variables
   const [globalFilters, setGlobalFilters] = useState({ brightness: 1.0, contrast: 1.0, exposure: 1.0, hue: 0.0, sepia: 0.0 });
   const globalFiltersRef = useRef(globalFilters);
   useEffect(() => { globalFiltersRef.current = globalFilters; }, [globalFilters]);
   const [holdDuration, setHoldDuration] = useState<number>(3.0);

   // Recording & Export State
   const [isRecording, setIsRecording] = useState<boolean>(false);
   const [exportFormat, setExportFormat] = useState<string>('webm');
   const [recordFramerate, setRecordFramerate] = useState<number>(30);
   const [recordDuration, setRecordDuration] = useState<number>(4);
   const [recordProgress, setRecordProgress] = useState<number>(0);
   const [exportSize, setExportSize] = useState<'viewport' | '360p' | '480p' | '720p' | '1080p' | '4k'>('viewport');
   const [exportQuality, setExportQuality] = useState<number>(80);
   const [exportLoop, setExportLoop] = useState<boolean>(false);
   const [loopRestartToggle, setLoopRestartToggle] = useState<boolean>(false);
   const [statusMessage, setStatusMessage] = useState<string>('');
   const [compressQuality, setCompressQuality] = useState<number>(0.8);
   const exportLoopRef = useRef<boolean>(false);
   useEffect(() => { exportLoopRef.current = exportLoop; }, [exportLoop]);

   // Animation Loop References
   const animFrameIdRef = useRef<number | null>(null);
   const capturerRef = useRef<any>(null);
   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const jszipRef = useRef<any>(null);
   const oldSizeRef = useRef<{ w: number, h: number } | null>(null);
   const isRecordingRef = useRef<boolean>(false);
   const recordStartTimeRef = useRef<number>(0);
   const framesRecordedRef = useRef<number>(0);
   const transitionProgressRef = useRef<number>(0);
   const targetAspectRef = useRef<number>(1.0);
   const handleResizeRef = useRef<(() => void) | null>(null);
   const effectiveFPSRef = useRef<number>(30);

   // Helper: Load HTMLImageElement with cross-origin safety
   const loadHTMLImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
         const img = new Image();
         img.crossOrigin = 'anonymous';
         img.onload = () => resolve(img);
         img.onerror = (err) => reject(err);
         img.src = url;
      });
   };

   // Dynamic Script Loader for CCapture
   const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
         if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
         }
         const script = document.createElement('script');
         script.src = src;
         script.onload = () => resolve();
         script.onerror = () => reject(new Error(`Failed to load ${src}`));
         document.head.appendChild(script);
      });
   };

   // Bind textures to material uniforms for a given image index
   const bindTexturesForIndex = useCallback((index: number) => {
      const pool = imagesRef.current;
      const texMap = texturesMapRef.current;
      if (!materialRef.current || pool.length === 0) return;

      const idx1 = index % pool.length;
      const idx2 = (index + 1) % pool.length;

      const img1 = pool[idx1] || pool[0];
      const img2 = pool.length > 1 ? pool[idx2] : img1;

      const tex1 = texMap.get(img1.id) || null;
      const tex2 = texMap.get(img2.id) || tex1;

      const mat = materialRef.current;

      const maskModeActive = mat.uniforms.uIsMaskMode ? mat.uniforms.uIsMaskMode.value : false;
      const mask1 = maskModeActive ? maskTextureRef.current : (texMap.get(`mask_${img1.id}`) || null);
      const mask2 = texMap.get(`mask_${img2.id}`) || null;

      mat.uniforms.uTexture1.value = tex1;
      mat.uniforms.uMaskTexture1.value = mask1;
      mat.uniforms.uHasTexture1.value = !!tex1;
      mat.uniforms.uHasMask1.value = !!mask1;
      mat.uniforms.uScale1.value = img1.scale ?? 1.0;
      mat.uniforms.uDispIntensity1.value = img1.dispIntensity ?? 1.0;

      const globalMode = mat.uniforms.uFilterMode ? mat.uniforms.uFilterMode.value : 0;
      const getFilterIndex = (override: string | null) => {
         if (!override) return globalMode;
         const idx = FILTER_PRESETS.findIndex(p => p.id === override);
         return idx >= 0 ? idx : globalMode;
      };

      mat.uniforms.uFilterMode1.value = getFilterIndex(img1.filterOverride);
      mat.uniforms.uRotation1.value = (img1.rotation || 0) * (Math.PI / 180.0);
      mat.uniforms.uFlip1.value.set(img1.flipX ? -1.0 : 1.0, img1.flipY ? -1.0 : 1.0);
      mat.uniforms.uTranslate1.value.set(img1.translateX || 0, img1.translateY || 0);

      const gF = globalFiltersRef.current;
      mat.uniforms.uColorSettings1.value.set(img1.filters?.brightness ?? gF.brightness, img1.filters?.contrast ?? gF.contrast, img1.filters?.exposure ?? gF.exposure, img1.filters?.hue ?? gF.hue);
      mat.uniforms.uSepia1.value = img1.filters?.sepia ?? gF.sepia;
      if (tex1 && tex1.image) mat.uniforms.uImageRes1.value.set(tex1.image.width || 1, tex1.image.height || 1);

      mat.uniforms.uTexture2.value = tex2;
      mat.uniforms.uMaskTexture2.value = mask2;
      mat.uniforms.uHasTexture2.value = !!tex2;
      mat.uniforms.uHasMask2.value = !!mask2;
      mat.uniforms.uScale2.value = img2.scale ?? 1.0;
      mat.uniforms.uDispIntensity2.value = img2.dispIntensity ?? 1.0;

      mat.uniforms.uFilterMode2.value = getFilterIndex(img2.filterOverride);
      mat.uniforms.uRotation2.value = (img2.rotation || 0) * (Math.PI / 180.0);
      mat.uniforms.uFlip2.value.set(img2.flipX ? -1.0 : 1.0, img2.flipY ? -1.0 : 1.0);
      mat.uniforms.uTranslate2.value.set(img2.translateX || 0, img2.translateY || 0);

      mat.uniforms.uColorSettings2.value.set(img2.filters?.brightness ?? gF.brightness, img2.filters?.contrast ?? gF.contrast, img2.filters?.exposure ?? gF.exposure, img2.filters?.hue ?? gF.hue);
      mat.uniforms.uSepia2.value = img2.filters?.sepia ?? gF.sepia;
      if (tex2 && tex2.image) mat.uniforms.uImageRes2.value.set(tex2.image.width || 1, tex2.image.height || 1);
   }, []);

   // Update bind when global filters change
   useEffect(() => {
      bindTexturesForIndex(currentIndexRef.current);
   }, [globalFilters, bindTexturesForIndex]);

   // Load Three.js Texture Objects incrementally
   const updateTextures = useCallback(async (imgList: PoolImage[]) => {
      if (imgList.length === 0) {
         texturesMapRef.current.forEach(t => t.dispose());
         texturesMapRef.current.clear();
         if (materialRef.current) {
            materialRef.current.uniforms.uHasTexture1.value = false;
            materialRef.current.uniforms.uHasTexture2.value = false;
            materialRef.current.uniforms.uImageRes1.value.set(1, 1);
            materialRef.current.uniforms.uImageRes2.value.set(1, 1);
         }
         return;
      }

      const map = texturesMapRef.current;
      const validIds = new Set(imgList.map(img => img.id));

      // Cleanup removed textures
      for (const [id, tex] of map.entries()) {
         const baseId = id.startsWith('mask_') ? id.replace('mask_', '') : id;
         if (!validIds.has(baseId)) {
            tex.dispose();
            map.delete(id);
         }
      }

      // Load missing textures
      const missing = imgList.filter(img => !map.has(img.id));
      const loadedPromises = missing.map(async (item) => {
         try {
            const imgEl = await loadHTMLImage(item.url);
            const tex = new THREE.Texture(imgEl);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            return { id: item.id, tex };
         } catch (e) {
            console.warn('Failed loading image texture:', item.url, e);
            return null;
         }
      });

      const loadedResults = await Promise.all(loadedPromises);
      let newTextureAdded = false;

      loadedResults.forEach(result => {
         if (result) {
            map.set(result.id, result.tex);
            newTextureAdded = true;
         }
      });

      if (newTextureAdded && map.size > 0) {
         const firstTex = map.values().next().value;
         if (firstTex && firstTex.image) {
            setDetectedImageAspect(firstTex.image.width / firstTex.image.height);
         }
      }

      // Only force reset to index 0 if the current index is now out of bounds
      if (currentIndexRef.current >= imgList.length) {
         currentIndexRef.current = 0;
         setCurrentIndex(0);
         transitionProgressRef.current = 0.0;
         setManualProgress(0.0);
         setLoopRestartToggle(prev => !prev);
      }
      bindTexturesForIndex(currentIndexRef.current);
   }, [bindTexturesForIndex]);

   // Switch preview active index when clicking a pool thumbnail
   const selectPoolImage = (idx: number) => {
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      transitionProgressRef.current = 0.0;
      setManualProgress(0.0);
      bindTexturesForIndex(idx);
      setLoopRestartToggle(prev => !prev);
   };

   // Initialize Three.js WebGL Scene
   useEffect(() => {
      if (!canvasRef.current) return;

      const container = canvasRef.current.parentElement;
      const width = container ? container.clientWidth : 600;
      const height = container ? container.clientHeight : 450;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;

      const renderer = new THREE.WebGLRenderer({
         canvas: canvasRef.current,
         preserveDrawingBuffer: true,
         antialias: true,
         alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);

      const material = new THREE.ShaderMaterial({
         vertexShader: VERTEX_SHADER,
         fragmentShader: FRAGMENT_SHADER,
         uniforms: {
            uMaskTexture1: { value: null },
            uHasMask1: { value: false },
            uMaskTexture2: { value: null },
            uHasMask2: { value: false },
            uIsMaskMode: { value: false },
            uTime: { value: 0.0 },
            uWaveSpeed: { value: waveSpeed },
            uWaveFrequency: { value: waveFrequency },
            uWaveAmplitude: { value: waveAmplitude },
            uWaveAngle: { value: (waveAngle * Math.PI) / 180.0 },
            uTransitionProgress: { value: 0.0 },
            uFilterMode: { value: 0 },
            uTexture1: { value: null },
            uTexture2: { value: null },
            uHasTexture1: { value: false },
            uHasTexture2: { value: false },
            uResolution: { value: new THREE.Vector2(width, height) },
            uImageRes1: { value: new THREE.Vector2(1, 1) },
            uImageRes2: { value: new THREE.Vector2(1, 1) },
            uTextTextureDisplaced: { value: null },
            uTextTextureOverlay: { value: null },
            uHasTextDisplaced: { value: false },
            uHasTextOverlay: { value: false },
            uScale1: { value: 1.0 },
            uScale2: { value: 1.0 },
            uDispIntensity1: { value: 1.0 },
            uDispIntensity2: { value: 1.0 },
            uRotation1: { value: 0.0 },
            uRotation2: { value: 0.0 },
            uFlip1: { value: new THREE.Vector2(1.0, 1.0) },
            uFlip2: { value: new THREE.Vector2(1.0, 1.0) },
            uTranslate1: { value: new THREE.Vector2(0.0, 0.0) },
            uTranslate2: { value: new THREE.Vector2(0.0, 0.0) },
            uFilterMode1: { value: 0 },
            uFilterMode2: { value: 0 },
            uDisplacementFunc: { value: 0 },
            uColorSettings1: { value: new THREE.Vector4(1.0, 1.0, 1.0, 0.0) },
            uSepia1: { value: 0.0 },
            uColorSettings2: { value: new THREE.Vector4(1.0, 1.0, 1.0, 0.0) },
            uSepia2: { value: 0.0 },
         },
         depthWrite: false,
         depthTest: false,
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      materialRef.current = material;

      const handleResize = () => {
         if (isRecordingRef.current) return; // Prevent resizing WebGL buffer during active export!
         if (!canvasRef.current || !rendererRef.current || !materialRef.current) return;
         const parent = canvasRef.current.parentElement;
         if (!parent) return;
         const pw = parent.clientWidth;
         const ph = parent.clientHeight;
         if (pw === 0 || ph === 0) return;

         const aspect = targetAspectRef.current;
         let w = pw;
         let h = pw / aspect;
         if (h > ph) {
            h = ph;
            w = ph * aspect;
         }

         canvasRef.current.style.width = `${w}px`;
         canvasRef.current.style.height = `${h}px`;
         rendererRef.current.setSize(w, h);
         materialRef.current.uniforms.uResolution.value.set(w, h);

         if (maskCanvasRef.current) {
            const mCvs = maskCanvasRef.current;
            const ctx = mCvs.getContext('2d');
            let oldData: HTMLCanvasElement | null = null;
            if (ctx && mCvs.width > 0 && mCvs.height > 0) {
               oldData = document.createElement('canvas');
               oldData.width = mCvs.width;
               oldData.height = mCvs.height;
               oldData.getContext('2d')?.drawImage(mCvs, 0, 0);
            }
            mCvs.width = w;
            mCvs.height = h;
            mCvs.style.width = `${w}px`;
            mCvs.style.height = `${h}px`;
            if (ctx) {
               ctx.fillStyle = 'black';
               ctx.fillRect(0, 0, w, h);
               if (oldData) {
                  ctx.drawImage(oldData, 0, 0, w, h);
               }
            }
            // Recreate CanvasTexture to prevent glCopySubTextureCHROMIUM dimension mismatch
            if (maskTextureRef.current) {
               maskTextureRef.current.dispose();
               maskTextureRef.current = new THREE.CanvasTexture(mCvs);
               maskTextureRef.current.minFilter = THREE.NearestFilter;
               maskTextureRef.current.magFilter = THREE.NearestFilter;
               if (materialRef.current && materialRef.current.uniforms.uIsMaskMode.value) {
                  materialRef.current.uniforms.uMaskTexture1.value = maskTextureRef.current;
               }
            }
         }

         // Handle text canvases
         const setupTextCanvas = (cvsRef: React.MutableRefObject<HTMLCanvasElement | null>, texRef: React.MutableRefObject<THREE.CanvasTexture | null>, uniformName: string) => {
            if (cvsRef.current) {
               const tCvs = cvsRef.current;
               const dpr = window.devicePixelRatio || 1;
               tCvs.width = w * dpr;
               tCvs.height = h * dpr;

               if (texRef.current) {
                  texRef.current.dispose();
               }
               texRef.current = new THREE.CanvasTexture(tCvs);
               texRef.current.minFilter = THREE.LinearFilter;
               texRef.current.magFilter = THREE.LinearFilter;
               texRef.current.generateMipmaps = false;
               if (materialRef.current) {
                  materialRef.current.uniforms[uniformName].value = texRef.current;
               }
            }
         };

         setupTextCanvas(textCanvasDisplacedRef, textTextureDisplacedRef, 'uTextTextureDisplaced');
         setupTextCanvas(textCanvasOverlayRef, textTextureOverlayRef, 'uTextTextureOverlay');

         // Re-render text objects on resize to fit new canvas bounds
         // We must defer this slightly to ensure react state is consistent
         setTimeout(() => renderTextObjects(), 0);

         if (uiOverlayCanvasRef.current) {
            uiOverlayCanvasRef.current.width = w;
            uiOverlayCanvasRef.current.height = h;
            uiOverlayCanvasRef.current.style.width = `${w}px`;
            uiOverlayCanvasRef.current.style.height = `${h}px`;
         }
      };

      handleResizeRef.current = handleResize;

      const resizeObserver = new ResizeObserver(() => {
         handleResize();
      });

      if (container) {
         resizeObserver.observe(container);
      }

      handleResize();

      return () => {
         resizeObserver.disconnect();
         if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
         renderer.dispose();
         geometry.dispose();
         material.dispose();
      };
   }, []);

   // Update Shader Uniforms
   useEffect(() => {
      if (!materialRef.current) return;
      materialRef.current.uniforms.uWaveSpeed.value = waveSpeed;
      materialRef.current.uniforms.uWaveFrequency.value = waveFrequency;
      materialRef.current.uniforms.uWaveAmplitude.value = waveAmplitude;
      materialRef.current.uniforms.uWaveAngle.value = (waveAngle * Math.PI) / 180.0;
      materialRef.current.uniforms.uDisplacementFunc.value = displacementFunc;

      const modeIndex = FILTER_PRESETS.findIndex(p => p.id === filterMode);
      materialRef.current.uniforms.uFilterMode.value = modeIndex >= 0 ? modeIndex : 0;

      // Update specific currently active textures with the new global filter index if they aren't overridden
      bindTexturesForIndex(currentIndexRef.current);
   }, [waveSpeed, waveFrequency, waveAmplitude, waveAngle, filterMode, displacementFunc, bindTexturesForIndex]);

   // Main Animation Loop - Multi-Image Synchronized Pipeline
   useEffect(() => {
      let lastTime = performance.now();

      const animate = (time: number) => {
         const currentTime = time || performance.now();
         let realDelta = (currentTime - lastTime) / 1000;
         if (isNaN(realDelta) || realDelta < 0 || realDelta > 0.5) realDelta = 0.016;

         // CCapture (GIF/PNG) needs fixed time steps for perfect frame-by-frame rendering
         // MediaRecorder (WebM) records in real-time, so we MUST use real time steps, 
         // otherwise heavy 4K renders play in slow-motion and don't finish before the timeout.
         const isFrameByFrame = isRecordingRef.current && !!capturerRef.current;
         const deltaTime = isFrameByFrame ? (1.0 / effectiveFPSRef.current) : realDelta;

         lastTime = currentTime;

         if (materialRef.current && (isPlaying || isRecordingRef.current)) {
            materialRef.current.uniforms.uTime.value += deltaTime;

            const textures = imagesRef.current;
            if (textures.length > 1) {
               // Pause transition completely if user is actively in mask mode
               const maskModeActive = materialRef.current.uniforms.uIsMaskMode ? materialRef.current.uniforms.uIsMaskMode.value : false;

               if (autoTransition && !maskModeActive) {
                  // Calculate dynamic transition speed during recording to fit ALL images into recordDuration
                  let totalTransitions = textures.length;
                  if (isRecordingRef.current && !exportLoopRef.current) {
                     totalTransitions = Math.max(1, textures.length - 1);
                  }
                  const effectiveDuration = isRecordingRef.current
                     ? (recordDuration / totalTransitions)
                     : transitionDuration;

                  transitionProgressRef.current += deltaTime / Math.max(0.1, effectiveDuration);

                  if (transitionProgressRef.current >= 1.0) {
                     transitionProgressRef.current = 0.0;
                     const nextRaw = currentIndexRef.current + 1;

                     // No-loop mode during recording: stop after one complete pass
                     if (isRecordingRef.current && !exportLoopRef.current && nextRaw >= Math.max(1, textures.length - 1)) {
                        // Hold on last image, auto-stop will be triggered by duration timer or frame counter at the bottom of the loop
                        currentIndexRef.current = textures.length - 1;
                        materialRef.current.uniforms.uTransitionProgress.value = 0.0;
                     } else {
                        const nextIdx = nextRaw % textures.length;
                        currentIndexRef.current = nextIdx;
                        setCurrentIndex(nextIdx);
                        bindTexturesForIndex(nextIdx);
                     }
                  }

                  materialRef.current.uniforms.uTransitionProgress.value = transitionProgressRef.current;
                  if (!isRecordingRef.current) setManualProgress(transitionProgressRef.current);
               } else {
                  materialRef.current.uniforms.uTransitionProgress.value = manualProgress;
               }
            } else {
               materialRef.current.uniforms.uTransitionProgress.value = 0.0;
            }
         }

         if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);

            if (isRecordingRef.current) {
               if (capturerRef.current && canvasRef.current) {
                  try {
                     // CCapture frame-by-frame progress
                     capturerRef.current.capture(canvasRef.current);
                     framesRecordedRef.current += 1;
                     const elapsed = framesRecordedRef.current / effectiveFPSRef.current;
                     const progress = Math.min(100, Math.round((elapsed / recordDuration) * 100));
                     setRecordProgress(progress);

                     // > instead of >= captures 1 extra frame, ensuring the final video's timestamp reaches EXACTLY recordDuration
                     if (elapsed > recordDuration) {
                        stopRecording();
                     }
                  } catch (e) {
                     console.error("CCapture capture error:", e);
                     stopRecording(true);
                  }
               }
            }
         }

         animFrameIdRef.current = NATIVE_RAF(animate);
      };

      animFrameIdRef.current = NATIVE_RAF(animate);

      return () => {
         if (animFrameIdRef.current) NATIVE_CAF(animFrameIdRef.current);
      };
   }, [isPlaying, autoTransition, transitionDuration, manualProgress, recordDuration, bindTexturesForIndex, loopRestartToggle]);

   // Masking Logic
   useEffect(() => {
      if (!maskCanvasRef.current) return;
      const cvs = maskCanvasRef.current;
      const ctx = cvs.getContext('2d');
      if (ctx && cvs.width > 0 && cvs.height > 0) {
         ctx.fillStyle = 'black';
         ctx.fillRect(0, 0, cvs.width, cvs.height);
         if (!maskTextureRef.current) {
            maskTextureRef.current = new THREE.CanvasTexture(cvs);
            maskTextureRef.current.minFilter = THREE.NearestFilter;
            maskTextureRef.current.magFilter = THREE.NearestFilter;
            if (materialRef.current) {
               materialRef.current.uniforms.uMaskTexture1.value = maskTextureRef.current;
               materialRef.current.uniforms.uHasMask1.value = true;
            }
         }
         maskTextureRef.current.needsUpdate = true;
      }
   }, []);

   useEffect(() => {
      if (materialRef.current) {
         materialRef.current.uniforms.uIsMaskMode.value = isMaskMode;
         if (isMaskMode) {
            // Bind live canvas to active texture
            materialRef.current.uniforms.uMaskTexture1.value = maskTextureRef.current;
            materialRef.current.uniforms.uHasMask1.value = true;
         } else {
            // Rebind standard cached textures when exiting mask mode
            bindTexturesForIndex(currentIndexRef.current);
         }
      }
   }, [isMaskMode, bindTexturesForIndex]);

   // Tab switching disables mask mode
   useEffect(() => {
      if (inspectorTab !== 'mask' && isMaskMode) {
         setIsMaskMode(false);
      }
   }, [inspectorTab, isMaskMode]);


   // Clear selection when switching tools
   useEffect(() => {
      setActiveMaskObjectId(null);
      // Wait for next tick to ensure renderUIOverlay sees the null state
      setTimeout(() => renderUIOverlay(), 0);
   }, [maskTool]);

   const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = e.currentTarget.width / rect.width;
      const scaleY = e.currentTarget.height / rect.height;
      return {
         x: (e.clientX - rect.left) * scaleX,
         y: (e.clientY - rect.top) * scaleY
      };
   };

   const updateMask = () => {
      if (maskTextureRef.current) maskTextureRef.current.needsUpdate = true;
   };

   const renderTextObjects = useCallback(() => {
      if (!textCanvasDisplacedRef.current || !textCanvasOverlayRef.current) return;

      const cw = textCanvasDisplacedRef.current.width;
      const ch = textCanvasDisplacedRef.current.height;

      const ctxDisp = textCanvasDisplacedRef.current.getContext('2d');
      const ctxOver = textCanvasOverlayRef.current.getContext('2d');
      if (!ctxDisp || !ctxOver) return;

      ctxDisp.clearRect(0, 0, cw, ch);
      ctxOver.clearRect(0, 0, cw, ch);

      const dpr = window.devicePixelRatio || 1;

      const objs = currentMaskObjectsRef.current;
      let hasDisp = false;
      let hasOver = false;

      objs.forEach(obj => {
         if (obj.type !== 'text' || !obj.textContent) return;
         const ctx = obj.affectedByWaves ? ctxDisp : ctxOver;
         if (obj.affectedByWaves) hasDisp = true;
         else hasOver = true;

         ctx.save();
         ctx.translate(obj.x * dpr, obj.y * dpr);
         ctx.rotate((obj.rotation * Math.PI) / 180);
         ctx.font = `${Math.round(obj.size * dpr)}px "${obj.fontFamily}", sans-serif`;
         ctx.fillStyle = obj.color || '#fff';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText(obj.textContent, 0, 0);
         ctx.restore();
      });

      if (textTextureDisplacedRef.current) {
         textTextureDisplacedRef.current.needsUpdate = true;
      }
      if (textTextureOverlayRef.current) {
         textTextureOverlayRef.current.needsUpdate = true;
      }

      if (materialRef.current) {
         materialRef.current.uniforms.uHasTextDisplaced.value = hasDisp;
         materialRef.current.uniforms.uHasTextOverlay.value = hasOver;
      }
   }, []);

   const renderMaskObjects = useCallback(() => {
      if (!maskCanvasRef.current) return;
      const cvs = maskCanvasRef.current;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      const objs = currentMaskObjectsRef.current;
      for (const obj of objs) {
         if (obj.type === 'text') continue;
         ctx.save();
         ctx.fillStyle = obj.isEraser ? 'black' : 'white';
         ctx.strokeStyle = obj.isEraser ? 'black' : 'white';
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.lineWidth = obj.size;

         if (obj.type === 'path' && obj.points && obj.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for (let i = 1; i < obj.points.length; i++) {
               ctx.lineTo(obj.points[i].x, obj.points[i].y);
            }
            ctx.stroke();
         } else if (obj.type === 'bezier' && obj.bezierPoints && obj.bezierPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(obj.bezierPoints[0].x, obj.bezierPoints[0].y);
            for (let i = 1; i < obj.bezierPoints.length; i++) {
               const p0 = obj.bezierPoints[i - 1];
               const p1 = obj.bezierPoints[i];
               if (p0.handleOut && p1.handleIn) {
                  ctx.bezierCurveTo(p0.handleOut.x, p0.handleOut.y, p1.handleIn.x, p1.handleIn.y, p1.x, p1.y);
               } else if (p0.handleOut) {
                  ctx.quadraticCurveTo(p0.handleOut.x, p0.handleOut.y, p1.x, p1.y);
               } else if (p1.handleIn) {
                  ctx.quadraticCurveTo(p1.handleIn.x, p1.handleIn.y, p1.x, p1.y);
               } else {
                  ctx.lineTo(p1.x, p1.y);
               }
            }
            // Always close and fill the path to show live masking preview
            ctx.closePath();
            ctx.fillStyle = obj.isEraser ? 'black' : 'white';
            ctx.fill();
         } else if (obj.type !== 'path') {
            ctx.translate(obj.x, obj.y);
            ctx.rotate((obj.rotation * Math.PI) / 180);

            if (obj.type === 'circle') {
               ctx.beginPath(); ctx.arc(0, 0, obj.size, 0, Math.PI * 2); ctx.fill();
            } else if (obj.type === 'square') {
               ctx.fillRect(-obj.size, -obj.size, obj.size * 2, obj.size * 2);
            } else if (obj.type === 'triangle') {
               ctx.beginPath(); ctx.moveTo(0, -obj.size); ctx.lineTo(obj.size, obj.size); ctx.lineTo(-obj.size, obj.size); ctx.closePath(); ctx.fill();
            }
         }
         ctx.restore();
      }
      if (maskTextureRef.current) maskTextureRef.current.needsUpdate = true;
   }, []);

   const computeBounds = useCallback((obj: MaskObject) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      if (obj.type === 'path' && obj.points && obj.points.length > 0) {
         obj.points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
         });
      } else if (obj.type === 'bezier' && obj.bezierPoints && obj.bezierPoints.length > 0) {
         obj.bezierPoints.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
            if (pt.handleIn) {
               if (pt.handleIn.x < minX) minX = pt.handleIn.x;
               if (pt.handleIn.y < minY) minY = pt.handleIn.y;
               if (pt.handleIn.x > maxX) maxX = pt.handleIn.x;
               if (pt.handleIn.y > maxY) maxY = pt.handleIn.y;
            }
            if (pt.handleOut) {
               if (pt.handleOut.x < minX) minX = pt.handleOut.x;
               if (pt.handleOut.y < minY) minY = pt.handleOut.y;
               if (pt.handleOut.x > maxX) maxX = pt.handleOut.x;
               if (pt.handleOut.y > maxY) maxY = pt.handleOut.y;
            }
         });
      } else if (obj.type === 'text' && obj.textContent) {
         // Text approximate bounds
         const width = obj.textContent.length * obj.size * 0.6;
         const height = obj.size * 1.2;
         minX = -width / 2 - 4; maxX = width / 2 + 4;
         minY = -height / 2 - 4; maxY = height / 2 + 4;
         return { minX, minY, maxX, maxY, centerX: obj.x, centerY: obj.y, width: maxX - minX, height: maxY - minY, isLocal: true };
      } else {
         let s = obj.size + 4;
         if (obj.type === 'triangle') s += 2;
         minX = -s; maxX = s;
         minY = -s; maxY = s;
         return { minX, minY, maxX, maxY, centerX: obj.x, centerY: obj.y, width: maxX - minX, height: maxY - minY, isLocal: true };
      }

      const pad = (obj.size || maskBrushSize) / 2 + 4;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;

      return {
         minX, minY, maxX, maxY,
         centerX: (minX + maxX) / 2,
         centerY: (minY + maxY) / 2,
         width: maxX - minX,
         height: maxY - minY,
         isLocal: false
      };
   }, [maskBrushSize]);

   const renderUIOverlay = useCallback((cursorPos?: { x: number, y: number }) => {
      if (!uiOverlayCanvasRef.current) return;
      const cvs = uiOverlayCanvasRef.current;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Draw active object outline
      const targetId = (maskTool === 'pen' && activeBezierPathIdRef.current) ? activeBezierPathIdRef.current : activeMaskObjectId;
      if (targetId) {
         const obj = currentMaskObjectsRef.current.find(o => o.id === targetId);
         if (obj) {
            const bounds = computeBounds(obj);

            ctx.save();
            if (bounds.isLocal) {
               ctx.translate(obj.x, obj.y);
               ctx.rotate((obj.rotation * Math.PI) / 180);
            }

            ctx.strokeStyle = '#06b6d4'; // Cyan-400
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);

            // Draw shape outline (for geometric shapes)
            if (obj.type === 'text') {
               ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
            } else if (obj.type === 'circle') {
               const s = obj.size + 4;
               ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
            } else if (obj.type === 'square') {
               const s = obj.size + 4;
               ctx.strokeRect(-s, -s, s * 2, s * 2);
            } else if (obj.type === 'triangle') {
               const s = obj.size + 6;
               ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s - 2); ctx.lineTo(-s, s - 2); ctx.closePath(); ctx.stroke();
            } else {
               // For paths/beziers, draw the bounding box
               ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
            }

            // Draw handles if in select mode
            if (maskTool === 'select' && obj.type !== 'path') {
               // Wait, user wants handles for path and bezier as well.
               // We will draw handles for all!
            }
            if (maskTool === 'select') {
               ctx.setLineDash([]);
               ctx.fillStyle = '#ffffff';
               const hs = 4;

               const cx = bounds.isLocal ? 0 : bounds.centerX;
               const cy = bounds.isLocal ? 0 : bounds.centerY;

               const corners = [
                  { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
                  { x: bounds.minX, y: bounds.maxY }, { x: bounds.maxX, y: bounds.maxY },
                  { x: cx, y: bounds.minY }, { x: cx, y: bounds.maxY },
                  { x: bounds.minX, y: cy }, { x: bounds.maxX, y: cy }
               ];

               corners.forEach(h => {
                  ctx.fillRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
                  ctx.strokeRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
               });

               // Rotate Handle
               ctx.beginPath(); ctx.moveTo(cx, bounds.minY); ctx.lineTo(cx, bounds.minY - 20); ctx.stroke();
               ctx.beginPath(); ctx.arc(cx, bounds.minY - 20, hs, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }

            ctx.restore();
         }

         if (obj && (obj.type === 'path' || obj.type === 'bezier')) {
            if (obj.type === 'bezier' && obj.bezierPoints) {
               ctx.save();

               // Draw the actual path line
               ctx.beginPath();
               ctx.moveTo(obj.bezierPoints[0].x, obj.bezierPoints[0].y);
               for (let i = 1; i < obj.bezierPoints.length; i++) {
                  const p0 = obj.bezierPoints[i - 1];
                  const p1 = obj.bezierPoints[i];
                  if (p0.handleOut && p1.handleIn) {
                     ctx.bezierCurveTo(p0.handleOut.x, p0.handleOut.y, p1.handleIn.x, p1.handleIn.y, p1.x, p1.y);
                  } else if (p0.handleOut) {
                     ctx.quadraticCurveTo(p0.handleOut.x, p0.handleOut.y, p1.x, p1.y);
                  } else if (p1.handleIn) {
                     ctx.quadraticCurveTo(p1.handleIn.x, p1.handleIn.y, p1.x, p1.y);
                  } else {
                     ctx.lineTo(p1.x, p1.y);
                  }
               }
               if (obj.closed) ctx.closePath();
               ctx.strokeStyle = '#06b6d4';
               ctx.lineWidth = 1.5;
               ctx.stroke();

               // Draw points and handles
               ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
               ctx.fillStyle = '#ffffff';
               ctx.lineWidth = 1;

               obj.bezierPoints.forEach(pt => {
                  ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                  if (pt.handleIn) {
                     ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.handleIn.x, pt.handleIn.y); ctx.stroke();
                     ctx.beginPath(); ctx.arc(pt.handleIn.x, pt.handleIn.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                  }
                  if (pt.handleOut) {
                     ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.handleOut.x, pt.handleOut.y); ctx.stroke();
                     ctx.beginPath(); ctx.arc(pt.handleOut.x, pt.handleOut.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                  }
               });

               // Draw live preview line
               if (!obj.closed && penPreviewCoordsRef.current) {
                  const lastPt = obj.bezierPoints[obj.bezierPoints.length - 1];
                  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
                  ctx.setLineDash([4, 4]);
                  ctx.beginPath();
                  ctx.moveTo(lastPt.x, lastPt.y);
                  if (lastPt.handleOut) {
                     ctx.quadraticCurveTo(lastPt.handleOut.x, lastPt.handleOut.y, penPreviewCoordsRef.current.x, penPreviewCoordsRef.current.y);
                  } else {
                     ctx.lineTo(penPreviewCoordsRef.current.x, penPreviewCoordsRef.current.y);
                  }
                  ctx.stroke();
               }
               ctx.restore();
            }
         }
      }

      // Draw custom brush cursor
      if (cursorPos && (maskTool === 'brush' || maskTool === 'eraser')) {
         ctx.save();
         ctx.translate(cursorPos.x, cursorPos.y);
         ctx.rotate((maskRotation * Math.PI) / 180);
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
         ctx.lineWidth = 1.5;

         const size = maskBrushSize / 2;
         ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
         ctx.restore();
      }
   }, [activeMaskObjectId, maskTool, maskBrushSize, maskRotation]);

   const getHitHandle = useCallback((x: number, y: number, obj: MaskObject): TransformHandle | null => {
      const bounds = computeBounds(obj);
      let lx = x, ly = y;

      if (bounds.isLocal) {
         const dx = x - bounds.centerX;
         const dy = y - bounds.centerY;
         const rot = (-obj.rotation * Math.PI) / 180;
         lx = dx * Math.cos(rot) - dy * Math.sin(rot);
         ly = dx * Math.sin(rot) + dy * Math.cos(rot);
      }

      const { minX, minY, maxX, maxY } = bounds;
      const ht = 6; // Hit tolerance

      // Rotate
      if (Math.hypot(lx - ((minX + maxX) / 2), ly - (minY - 20)) <= ht) return 'rotate';

      // Corners
      if (Math.abs(lx - minX) <= ht && Math.abs(ly - minY) <= ht) return 'resize-tl';
      if (Math.abs(lx - maxX) <= ht && Math.abs(ly - minY) <= ht) return 'resize-tr';
      if (Math.abs(lx - minX) <= ht && Math.abs(ly - maxY) <= ht) return 'resize-bl';
      if (Math.abs(lx - maxX) <= ht && Math.abs(ly - maxY) <= ht) return 'resize-br';

      // Edges
      if (Math.abs(lx - minX) <= ht && ly >= minY && ly <= maxY) return 'resize-l';
      if (Math.abs(lx - maxX) <= ht && ly >= minY && ly <= maxY) return 'resize-r';
      if (Math.abs(ly - minY) <= ht && lx >= minX && lx <= maxX) return 'resize-t';
      if (Math.abs(ly - maxY) <= ht && lx >= minX && lx <= maxX) return 'resize-b';

      return null;
   }, [computeBounds]);

   const getHitObject = useCallback((x: number, y: number): MaskObject | null => {
      const objs = currentMaskObjectsRef.current;
      for (let i = objs.length - 1; i >= 0; i--) {
         const obj = objs[i];
         if (obj.type === 'path' && obj.points) {
            for (const pt of obj.points) {
               if (Math.hypot(pt.x - x, pt.y - y) <= obj.size / 2) return obj;
            }
         } else if (obj.type === 'bezier' && obj.bezierPoints) {
            // Hit test bounding box for closed bezier shape
            if (obj.closed) {
               let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
               obj.bezierPoints.forEach(pt => {
                  if (pt.x < minX) minX = pt.x;
                  if (pt.y < minY) minY = pt.y;
                  if (pt.x > maxX) maxX = pt.x;
                  if (pt.y > maxY) maxY = pt.y;
               });
               if (x >= minX && x <= maxX && y >= minY && y <= maxY) return obj;
            }
            for (const pt of obj.bezierPoints) {
               if (Math.hypot(pt.x - x, pt.y - y) <= 15) return obj;
            }
         } else {
            const dx = x - obj.x;
            const dy = y - obj.y;
            const rot = (-obj.rotation * Math.PI) / 180;
            const ux = dx * Math.cos(rot) - dy * Math.sin(rot);
            const uy = dx * Math.sin(rot) + dy * Math.cos(rot);

            if (obj.type === 'text' && obj.textContent) {
               const width = obj.textContent.length * obj.size * 0.6;
               const height = obj.size * 1.2;
               if (Math.abs(ux) <= width / 2 + 4 && Math.abs(uy) <= height / 2 + 4) return obj;
            } else if (obj.type === 'circle') {
               if (Math.hypot(ux, uy) <= obj.size) return obj;
            } else if (obj.type === 'square' || obj.type === 'triangle') {
               if (Math.abs(ux) <= obj.size && Math.abs(uy) <= obj.size) return obj;
            }
         }
      }
      return null;
   }, []);

   const updateUndoRedoState = useCallback(() => {
      setCanUndo(maskHistoryIndexRef.current > 0);
      setCanRedo(maskHistoryIndexRef.current < maskHistoryRef.current.length - 1);
   }, []);

   const pushMaskHistory = useCallback(() => {
      const str = JSON.stringify(currentMaskObjectsRef.current);
      const history = maskHistoryRef.current;
      const idx = maskHistoryIndexRef.current;

      if (idx >= 0 && history[idx] === str) return; // no change

      const newHistory = history.slice(0, idx + 1);
      newHistory.push(str);
      if (newHistory.length > 20) newHistory.shift();

      maskHistoryRef.current = newHistory;
      maskHistoryIndexRef.current = newHistory.length - 1;
      updateUndoRedoState();
   }, [updateUndoRedoState]);

   const saveCurrentMask = useCallback((skipHistory: boolean = false) => {
      if (!maskCanvasRef.current) return;

      if (!skipHistory) {
         pushMaskHistory();
      }

      const dataUrl = maskCanvasRef.current.toDataURL('image/png');
      const imgId = imagesRef.current[currentIndexRef.current]?.id;
      if (!imgId) return;

      const objectsCopy = JSON.parse(JSON.stringify(currentMaskObjectsRef.current));

      const img = new Image();
      img.onload = () => {
         const tex = new THREE.Texture(img);
         tex.minFilter = THREE.NearestFilter;
         tex.magFilter = THREE.NearestFilter;
         tex.needsUpdate = true;
         texturesMapRef.current.set(`mask_${imgId}`, tex);
      };
      img.src = dataUrl;

      setImages(prev => {
         const copy = [...prev];
         if (copy[currentIndexRef.current]) {
            copy[currentIndexRef.current] = { ...copy[currentIndexRef.current], maskDataUrl: dataUrl, maskObjects: objectsCopy };
         }
         return copy;
      });
   }, [pushMaskHistory]);

   const undoMask = useCallback(() => {
      if (maskHistoryIndexRef.current > 0) {
         maskHistoryIndexRef.current--;
         const str = maskHistoryRef.current[maskHistoryIndexRef.current];
         currentMaskObjectsRef.current = JSON.parse(str);
         renderMaskObjects();
         renderTextObjects();
         renderUIOverlay();
         saveCurrentMask(true);
         updateUndoRedoState();
      }
   }, [renderMaskObjects, renderUIOverlay, saveCurrentMask, updateUndoRedoState]);

   const redoMask = useCallback(() => {
      if (maskHistoryIndexRef.current < maskHistoryRef.current.length - 1) {
         maskHistoryIndexRef.current++;
         const str = maskHistoryRef.current[maskHistoryIndexRef.current];
         currentMaskObjectsRef.current = JSON.parse(str);
         renderMaskObjects();
         renderTextObjects();
         renderUIOverlay();
         saveCurrentMask(true);
         updateUndoRedoState();
      }
   }, [renderMaskObjects, renderUIOverlay, saveCurrentMask, updateUndoRedoState]);

   // Load specific image mask when switching images
   useEffect(() => {
      const img = imagesRef.current[currentIndex];
      currentMaskObjectsRef.current = img?.maskObjects ? JSON.parse(JSON.stringify(img.maskObjects)) : [];
      renderMaskObjects();
      renderTextObjects();

      // Initialize history for this image
      maskHistoryRef.current = [JSON.stringify(currentMaskObjectsRef.current)];
      maskHistoryIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
   }, [currentIndex, renderMaskObjects]);

   // Real-time updates for selected object size/rotation
   useEffect(() => {
      const sizeChanged = prevMaskBrushSizeRef.current !== maskBrushSize;
      const rotationChanged = prevMaskRotationRef.current !== maskRotation;

      prevMaskBrushSizeRef.current = maskBrushSize;
      prevMaskRotationRef.current = maskRotation;

      if ((sizeChanged || rotationChanged) && maskTool === 'select' && activeMaskObjectId) {
         const obj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (obj && obj.type !== 'path' && obj.type !== 'bezier') {
            obj.size = maskBrushSize;
            obj.rotation = maskRotation;
            renderMaskObjects();
            renderTextObjects();
            renderUIOverlay();
            saveCurrentMask(true); // Don't flood history with slider changes
         }
      }
   }, [maskBrushSize, maskRotation, maskTool, activeMaskObjectId, renderMaskObjects, renderUIOverlay, saveCurrentMask]);

   // Keyboard Shortcuts
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         // Prevent shortcuts if typing in an input
         if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
         }

         if (isMaskMode && maskTool === 'pen' && (e.key === 'Enter' || e.key === 'Escape')) {
            if (activeBezierPathIdRef.current) {
               activeBezierPathIdRef.current = null;
               saveCurrentMask();
               renderMaskObjects();
               renderUIOverlay();
            }
            return;
         }

         if ((isMaskMode || inspectorTab === 'text') && activeMaskObjectId && maskTool === 'select' && (e.key === 'Delete' || e.key === 'Backspace')) {
            currentMaskObjectsRef.current = currentMaskObjectsRef.current.filter(o => o.id !== activeMaskObjectId);
            setActiveMaskObjectId(null);
            saveCurrentMask();
            renderMaskObjects();
            renderTextObjects();
            renderUIOverlay();
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
         }

         // Undo / Redo
         if (isMaskMode && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            undoMask();
         } else if (isMaskMode && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            redoMask();
         }
      };
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
   }, [isMaskMode, maskTool, activeMaskObjectId, saveCurrentMask, renderMaskObjects, renderUIOverlay, undoMask, redoMask]);

   const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const isInteractionAllowed = isMaskMode || inspectorTab === 'text';
      if (!isInteractionAllowed || !maskCanvasRef.current) return;
      isDrawingRef.current = true;
      const { x, y } = getPointerPos(e);
      maskStartX.current = x;
      maskStartY.current = y;

      if (maskTool === 'select') {
         if (activeMaskObjectId) {
            const activeObj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
            if (activeObj) {
               const handle = getHitHandle(x, y, activeObj);
               if (handle) {
                  dragHandleRef.current = handle;

                  // Deep clone points to prevent float drift during drag
                  let clonedPoints = undefined;
                  let clonedBezier = undefined;
                  if (activeObj.points) {
                     clonedPoints = activeObj.points.map(p => ({ ...p }));
                  }
                  if (activeObj.bezierPoints) {
                     clonedBezier = activeObj.bezierPoints.map(p => ({
                        x: p.x, y: p.y,
                        handleIn: p.handleIn ? { ...p.handleIn } : undefined,
                        handleOut: p.handleOut ? { ...p.handleOut } : undefined
                     }));
                  }

                  initialTransformRef.current = {
                     size: activeObj.size,
                     rotation: activeObj.rotation,
                     mouseX: x, mouseY: y,
                     objX: activeObj.x, objY: activeObj.y,
                     points: clonedPoints,
                     bezierPoints: clonedBezier,
                     bounds: computeBounds(activeObj)
                  };
                  return; // Skip normal selection, we are dragging a handle
               }
            }
         }

         const hit = getHitObject(x, y);
         if (hit) {
            setActiveMaskObjectId(hit.id);
            if (hit.type !== 'path' && hit.type !== 'bezier') {
               setMaskBrushSize(hit.size);
               setMaskRotation(hit.rotation);
            }
            isDraggingObjectRef.current = true;
         } else {
            setActiveMaskObjectId(null);
            isDraggingObjectRef.current = false;
         }
         renderUIOverlay({ x, y });
         return;
      }

      if (maskTool === 'pen') {
         const activeId = activeBezierPathIdRef.current;
         let obj = currentMaskObjectsRef.current.find(o => o.id === activeId);

         if (obj && !obj.closed && obj.bezierPoints) {
            // Check if clicking near start point to close
            const startPt = obj.bezierPoints[0];
            if (Math.hypot(startPt.x - x, startPt.y - y) < 15) {
               obj.closed = true;
               activeBezierPathIdRef.current = null;
               isDrawingRef.current = false;
               saveCurrentMask();
               renderMaskObjects();
               renderUIOverlay({ x, y });
               return;
            }
            obj.bezierPoints.push({ x, y });
         } else {
            // Start new bezier path
            const newObj: MaskObject = {
               id: generateId(),
               type: 'bezier',
               isEraser: false,
               x, y, size: maskBrushSize, rotation: 0,
               bezierPoints: [{ x, y }],
               closed: false
            };
            currentMaskObjectsRef.current.push(newObj);
            activeBezierPathIdRef.current = newObj.id;
            setActiveMaskObjectId(newObj.id);
            obj = newObj;
         }
         isDraggingAnchorRef.current = true;
         renderMaskObjects();
         renderUIOverlay({ x, y });
         return;
      }

      // Drawing a new object (brush, eraser, shapes, text)
      const newObj: MaskObject = {
         id: generateId(),
         type: (maskTool === 'brush' || maskTool === 'eraser' || maskTool === 'text') ? (maskTool === 'text' ? 'text' : 'path') : maskTool as any,
         isEraser: maskTool === 'eraser',
         x: x,
         y: y,
         size: (maskTool === 'brush' || maskTool === 'eraser') ? maskBrushSize : (maskTool === 'text' ? maskBrushSize : 1), // Will expand on move for shapes, but text is fixed size
         rotation: maskRotation,
         points: (maskTool === 'brush' || maskTool === 'eraser') ? [{ x, y }, { x: x + 0.1, y }] : undefined,
         textContent: maskTool === 'text' ? textToolContent : undefined,
         fontFamily: maskTool === 'text' ? textToolFontFamily : undefined,
         color: maskTool === 'text' ? textToolColor : undefined,
         affectedByWaves: maskTool === 'text' ? textToolAffectedByWaves : undefined,
      };

      currentMaskObjectsRef.current.push(newObj);
      setActiveMaskObjectId(newObj.id);
      if (maskTool === 'text') {
         renderTextObjects();
      } else {
         renderMaskObjects();
      }
      renderUIOverlay({ x, y });
   };

   const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const isInteractionAllowed = isMaskMode || inspectorTab === 'text';
      if (!isInteractionAllowed || !maskCanvasRef.current) return;
      const { x, y } = getPointerPos(e);

      if (maskTool === 'pen') {
         penPreviewCoordsRef.current = { x, y };
      } else {
         penPreviewCoordsRef.current = null;
      }

      // Handle hover cursors for transform handles
      if (maskTool === 'select' && activeMaskObjectId && !isDrawingRef.current) {
         const activeObj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (activeObj) {
            const handle = getHitHandle(x, y, activeObj);
            if (hoverHandle !== handle) {
               setHoverHandle(handle);
            }
         }
      } else if (hoverHandle !== null && !isDrawingRef.current) {
         setHoverHandle(null);
      }

      renderUIOverlay({ x, y }); // Always update cursor overlay

      if (!isDrawingRef.current) return;

      if (maskTool === 'select' && dragHandleRef.current && initialTransformRef.current && activeMaskObjectId) {
         const obj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (obj) {
            const init = initialTransformRef.current;

            if (obj.type !== 'path' && obj.type !== 'bezier') {
               if (dragHandleRef.current === 'rotate') {
                  const angle = Math.atan2(y - obj.y, x - obj.x);
                  let deg = (angle + Math.PI / 2) * (180 / Math.PI);
                  if (deg < 0) deg += 360;
                  obj.rotation = deg;
                  setMaskRotation(Math.round(deg));
               } else if (obj.type === 'text' && obj.textContent) {
                  let newSize = obj.size;
                  const dxWorld = x - obj.x;
                  const dyWorld = y - obj.y;
                  const rot = (-init.rotation * Math.PI) / 180;
                  const lx = dxWorld * Math.cos(rot) - dyWorld * Math.sin(rot);
                  const ly = dxWorld * Math.sin(rot) + dyWorld * Math.cos(rot);
                  const dx = Math.abs(lx);
                  const dy = Math.abs(ly);

                  if (dragHandleRef.current.startsWith('resize-l') || dragHandleRef.current.startsWith('resize-r')) {
                     // dx is half width = obj.size * length * 0.3 + 4
                     const len = Math.max(1, obj.textContent.length * 0.3);
                     newSize = (dx - 4) / len;
                  } else {
                     // dy is half height = obj.size * 0.6 + 4
                     newSize = (dy - 4) / 0.6;
                  }

                  if (newSize < 10) newSize = 10;
                  if (newSize > 1000) newSize = 1000;
                  obj.size = newSize;
                  setMaskBrushSize(Math.round(newSize));
               } else {
                  let newSize = obj.size;

                  // Compute dx, dy in local space to correctly size rotated objects
                  const dxWorld = x - obj.x;
                  const dyWorld = y - obj.y;
                  const rot = (-init.rotation * Math.PI) / 180;
                  const lx = dxWorld * Math.cos(rot) - dyWorld * Math.sin(rot);
                  const ly = dxWorld * Math.sin(rot) + dyWorld * Math.cos(rot);

                  const dx = Math.abs(lx);
                  const dy = Math.abs(ly);

                  if (dragHandleRef.current.startsWith('resize-t') || dragHandleRef.current.startsWith('resize-b')) {
                     newSize = dragHandleRef.current.length > 8 ? Math.hypot(dx, dy) / Math.SQRT2 - 4 : dy - 4;
                  } else if (dragHandleRef.current.startsWith('resize-l') || dragHandleRef.current.startsWith('resize-r')) {
                     newSize = dx - 4;
                  }

                  if (newSize < 1) newSize = 1;
                  obj.size = newSize;
                  setMaskBrushSize(Math.round(newSize));
               }
            } else if (init.bounds && (init.points || init.bezierPoints)) {
               // Handle Path and Bezier Transform
               const cx = init.bounds.centerX;
               const cy = init.bounds.centerY;

               let scaleX = 1;
               let scaleY = 1;
               let rotDelta = 0;

               if (dragHandleRef.current === 'rotate') {
                  const angleInit = Math.atan2(init.mouseY - cy, init.mouseX - cx);
                  const angleCurr = Math.atan2(y - cy, x - cx);
                  rotDelta = angleCurr - angleInit;
               } else {
                  const dxInit = init.mouseX - cx;
                  const dyInit = init.mouseY - cy;
                  const dxCurr = x - cx;
                  const dyCurr = y - cy;

                  if (dragHandleRef.current.includes('l') || dragHandleRef.current.includes('r')) {
                     scaleX = Math.abs(dxInit) > 0.1 ? dxCurr / dxInit : 1;
                  }
                  if (dragHandleRef.current.includes('t') || dragHandleRef.current.includes('b')) {
                     scaleY = Math.abs(dyInit) > 0.1 ? dyCurr / dyInit : 1;
                  }
               }

               const applyTransform = (pt: { x: number, y: number }) => {
                  // Translate to origin
                  let px = pt.x - cx;
                  let py = pt.y - cy;

                  // Scale
                  px *= scaleX;
                  py *= scaleY;

                  // Rotate
                  if (rotDelta !== 0) {
                     const nx = px * Math.cos(rotDelta) - py * Math.sin(rotDelta);
                     const ny = px * Math.sin(rotDelta) + py * Math.cos(rotDelta);
                     px = nx;
                     py = ny;
                  }

                  // Translate back
                  return { x: px + cx, y: py + cy };
               };

               if (obj.points && init.points) {
                  obj.points = init.points.map(pt => applyTransform(pt));
               }
               if (obj.bezierPoints && init.bezierPoints) {
                  obj.bezierPoints = init.bezierPoints.map(pt => {
                     const newPt: BezierPoint = { ...pt, ...applyTransform(pt) };
                     if (pt.handleIn) newPt.handleIn = applyTransform(pt.handleIn);
                     if (pt.handleOut) newPt.handleOut = applyTransform(pt.handleOut);
                     return newPt;
                  });
               }
            }

            renderMaskObjects();
            renderTextObjects();
            renderUIOverlay({ x, y });
            // We don't save to history on every move to avoid flooding, handled on PointerUp
         }
         return;
      }

      if (maskTool === 'select' && isDraggingObjectRef.current && activeMaskObjectId) {
         const obj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
         if (obj) {
            const dx = x - maskStartX.current;
            const dy = y - maskStartY.current;
            obj.x += dx;
            obj.y += dy;
            if (obj.points) obj.points.forEach(pt => { pt.x += dx; pt.y += dy; });
            if (obj.bezierPoints) {
               obj.bezierPoints.forEach(pt => {
                  pt.x += dx; pt.y += dy;
                  if (pt.handleIn) { pt.handleIn.x += dx; pt.handleIn.y += dy; }
                  if (pt.handleOut) { pt.handleOut.x += dx; pt.handleOut.y += dy; }
               });
            }
            maskStartX.current = x;
            maskStartY.current = y;
            renderMaskObjects();
            renderTextObjects();
            renderUIOverlay({ x, y });
         }
         return;
      }

      if (maskTool === 'pen') {
         if (isDraggingAnchorRef.current && activeBezierPathIdRef.current) {
            const obj = currentMaskObjectsRef.current.find(o => o.id === activeBezierPathIdRef.current);
            if (obj && obj.bezierPoints) {
               const pt = obj.bezierPoints[obj.bezierPoints.length - 1];
               const dx = x - pt.x;
               const dy = y - pt.y;
               pt.handleOut = { x: pt.x + dx, y: pt.y + dy };
               pt.handleIn = { x: pt.x - dx, y: pt.y - dy };
               renderMaskObjects();
            }
         }
         return;
      }

      const activeObj = currentMaskObjectsRef.current.find(o => o.id === activeMaskObjectId);
      if (!activeObj) return;

      if (activeObj.type === 'path' && activeObj.points) {
         activeObj.points.push({ x, y });
      } else if (activeObj.type !== 'bezier') {
         const dx = x - activeObj.x;
         const dy = y - activeObj.y;
         activeObj.size = Math.sqrt(dx * dx + dy * dy);
      }
      renderMaskObjects();
   };

   const handlePointerUp = () => {
      if (dragHandleRef.current) {
         dragHandleRef.current = null;
         initialTransformRef.current = null;
         isDrawingRef.current = false;
         saveCurrentMask();
         updateUndoRedoState();
         return;
      }

      if (isDrawingRef.current) {
         if (maskTool === 'pen') {
            isDraggingAnchorRef.current = false;
            // Don't save mask yet, path is still open!
         } else {
            isDrawingRef.current = false;
            isDraggingObjectRef.current = false;
            saveCurrentMask();
         }
      }
   };

   const clearMask = () => {
      currentMaskObjectsRef.current = [];
      setActiveMaskObjectId(null);
      renderMaskObjects();
      renderTextObjects();
      renderUIOverlay();
      saveCurrentMask();
   };

   // Handle Image File Uploads
   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;

      const files = Array.from(e.target.files);
      const newItems: PoolImage[] = files.map(file => ({
         id: Math.random().toString(36).substring(2, 9),
         name: file.name,
         url: URL.createObjectURL(file),
         scale: 1.0,
         dispIntensity: 1.0,
         rotation: 0,
         translateX: 0,
         translateY: 0,
         flipX: false,
         flipY: false,
         filterOverride: null,
         holdDurationOverride: null,
         filters: null
      }));

      const updatedList = [...images, ...newItems];
      setImages(updatedList);
      updateTextures(updatedList);
   };

   // Prevent Global Drag and Drop
   const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      const newItems: PoolImage[] = files.map(file => ({
         id: Math.random().toString(36).substring(2, 9),
         name: file.name,
         url: URL.createObjectURL(file),
         scale: 1.0,
         dispIntensity: 1.0,
         rotation: 0,
         translateX: 0,
         translateY: 0,
         flipX: false,
         flipY: false,
         filterOverride: null,
         holdDurationOverride: null,
         filters: null
      }));

      const updatedList = [...images, ...newItems];
      setImages(updatedList);
      updateTextures(updatedList);
   };

   const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
   };

   // Remove Image
   const removeImage = (id: string) => {
      const updatedList = images.filter(img => img.id !== id);
      setImages(updatedList);
      updateTextures(updatedList);
   };

   // Update single image property
   const updateImageProperty = (property: keyof PoolImage, value: any) => {
      if (images.length === 0 || currentIndex >= images.length) return;
      const updated = [...images];
      updated[currentIndex] = { ...updated[currentIndex], [property]: value };
      setImages(updated);
      imagesRef.current = updated;
      bindTexturesForIndex(currentIndex);
   };

   const updateImageFilter = (filterName: keyof NonNullable<PoolImage['filters']>, value: number) => {
      if (images.length === 0 || currentIndex >= images.length) return;
      const updated = [...images];
      const currentFilters = updated[currentIndex].filters || { ...globalFilters };

      updated[currentIndex] = {
         ...updated[currentIndex],
         filters: { ...currentFilters, [filterName]: value }
      };
      setImages(updated);
      imagesRef.current = updated;
      bindTexturesForIndex(currentIndex);
   };

   const resetImageFilters = () => {
      if (images.length === 0 || currentIndex >= images.length) return;
      const updated = [...images];
      updated[currentIndex] = { ...updated[currentIndex], filters: undefined };
      setImages(updated);
      imagesRef.current = updated;
      bindTexturesForIndex(currentIndex);
   };

   const resetImageGeometry = () => {
      if (images.length === 0 || currentIndex >= images.length) return;
      const updated = [...images];
      updated[currentIndex] = {
         ...updated[currentIndex],
         scale: 1.0,
         dispIntensity: 1.0,
         rotation: 0,
         flipX: false,
         flipY: false,
         translateX: 0,
         translateY: 0
      };
      setImages(updated);
      imagesRef.current = updated;
      bindTexturesForIndex(currentIndex);
   };

   // CCapture Recording Engine with Multi-Image Cycle Reset

   const doCompress = async () => {
      if (images.length === 0) return;
      const quality = compressQuality;
      const updated = [...images];

      try {
         for (let i = 0; i < updated.length; i++) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = updated[i].url;
            await new Promise((resolve, reject) => {
               img.onload = resolve;
               img.onerror = reject;
            });

            const cvs = document.createElement('canvas');
            cvs.width = img.width;
            cvs.height = img.height;
            const ctx = cvs.getContext('2d');
            if (ctx) {
               ctx.drawImage(img, 0, 0);
               updated[i] = { ...updated[i], url: cvs.toDataURL('image/webp', quality) };
            }
         }
         setImages(updated);
         imagesRef.current = updated;
         updateTextures(updated);
      } catch (e) {
         console.error('Global compression failed', e);
      }
   };

   const startRecording = async () => {
      if (isRecording) return;

      // Reset animation state to 0 so export starts clean at Image 1 and loops through ALL pool images!
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      transitionProgressRef.current = 0.0;
      framesRecordedRef.current = 0;
      if (materialRef.current) {
         materialRef.current.uniforms.uTime.value = 0.0;
         bindTexturesForIndex(0);
      }
      setLoopRestartToggle(prev => !prev);

      setStatusMessage('Initializing multi-image capture engine...');

      try {
         // Determine effective export resolution
         // Auto-cap: GIF max 480p, WebM max 720p when set to "viewport" to avoid enormous files
         const aspect = getTargetAspect();
         if (canvasRef.current && rendererRef.current) {
            oldSizeRef.current = { w: canvasRef.current.clientWidth, h: canvasRef.current.clientHeight };

            let targetWidth: number;
            if (exportSize !== 'viewport') {
               targetWidth = exportSize === '4k' ? 3840 :
                  exportSize === '1080p' ? 1920 :
                     exportSize === '720p' ? 1280 :
                        exportSize === '480p' ? 854 : 640;
            } else {
               // Auto-cap viewport resolution for manageable file sizes
               const viewportWidth = canvasRef.current.clientWidth;
               if (exportFormat === 'gif') {
                  targetWidth = Math.min(viewportWidth, 480); // GIF: max 480px wide
               } else if (exportFormat === 'webm') {
                  targetWidth = Math.min(viewportWidth, 720); // WebM: max 720px wide
               } else {
                  targetWidth = viewportWidth; // PNG sequence: keep full resolution
               }
            }

            const targetHeight = Math.round(targetWidth / aspect);
            rendererRef.current.setSize(targetWidth, targetHeight, false);
            // FIX FOR MOBILE: Force pixel ratio to 1 during export to avoid CCapture memory crash
            rendererRef.current.setPixelRatio(1);
            if (materialRef.current) {
               materialRef.current.uniforms.uResolution.value.set(targetWidth, targetHeight);
            }
         }

         // Effective framerate — cap GIF to 10fps to avoid massive file sizes
         const effectiveFPS = exportFormat === 'gif' ? Math.min(recordFramerate, 10) : recordFramerate;
         effectiveFPSRef.current = effectiveFPS;

         if (exportFormat === 'png') {
            setStatusMessage('Loading JSZip module...');
            const JSZip = (await import('jszip')).default;
            jszipRef.current = new JSZip();
         } else {
            // Frame-by-frame export via CCapture (guarantees perfect framerate for WebM/GIF)
            if (!(window as any).CCapture) {
               setStatusMessage('Loading CCapture module...');
               await loadScript('https://cdn.jsdelivr.net/npm/ccapture.js@1.1.0/build/CCapture.all.min.js');
            }
            const CCaptureClass = (window as any).CCapture;
            if (!CCaptureClass) throw new Error('CCapture engine unavailable');

            const options: any = {
               format: exportFormat === 'webm' ? 'webm' : 'gif',
               framerate: effectiveFPS,
               quality: exportFormat === 'webm' ? (exportQuality / 100) : Math.max(1, Math.round(31 - (exportQuality / 100) * 30)),
               name: `wave_displacement_${Date.now()}`,
               verbose: false,
               workersPath: '/',
            };

            const capturer = new CCaptureClass(options);
            capturerRef.current = capturer;
            capturer.start();
         }

         isRecordingRef.current = true;
         recordStartTimeRef.current = performance.now();
         setIsRecording(true);
         setRecordProgress(0);
         const resInfo = rendererRef.current ? `${rendererRef.current.domElement.width}×${rendererRef.current.domElement.height}` : '';
         setStatusMessage(`Recording ${exportFormat.toUpperCase()} (${recordDuration}s, ${resInfo})...`);
      } catch (err: any) {
         setStatusMessage('Recording error: ' + err.message);
         setIsRecording(false);
         isRecordingRef.current = false;
      }
   };

   // Stop Recording & Export
   const stopRecording = async (abort = false) => {
      if (!isRecordingRef.current) return;

      // Permanently drop the recording lock
      isRecordingRef.current = false;
      setIsRecording(false);
      
      // Detach the capturer instantly so the native render loop stops feeding it frames!
      const capturer = capturerRef.current;
      capturerRef.current = null;

      // Now we can safely restore the viewport size
      if (handleResizeRef.current) {
         if (rendererRef.current) rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
         handleResizeRef.current();
      }
      
      oldSizeRef.current = null;
      setStatusMessage(abort ? 'Recording cancelled.' : 'Packaging exported multi-image animation... Please wait.');

      if (exportFormat === 'png' && jszipRef.current) {
         const zip = jszipRef.current;
         jszipRef.current = null;
         setLoopRestartToggle(prev => !prev);

         if (abort || framesRecordedRef.current === 0) {
            setStatusMessage(abort ? 'Recording cancelled.' : 'Recording aborted (0 frames captured).');
            return;
         }

         const blob = await zip.generateAsync({ type: 'blob' });
         const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `wave_sequence_${Date.now()}.zip`;
         a.click();
         setStatusMessage(`Export complete! (${sizeMB} MB ZIP)`);
         isRecordingRef.current = false;
         setIsRecording(false);
      } else if (capturer) {
         capturer.stop();
         setLoopRestartToggle(prev => !prev);

         if (abort || framesRecordedRef.current === 0) {
            setStatusMessage(abort ? 'Recording cancelled.' : 'Recording aborted (0 frames captured).');
            isRecordingRef.current = false;
            setIsRecording(false);
         } else {
            try {
               // Safety timeout: if processing hangs for more than 60s, unlock the UI
               const timeoutId = setTimeout(() => {
                  setStatusMessage('Processing timed out.');
                  isRecordingRef.current = false;
                  setIsRecording(false);
               }, 60000);

               capturer.save((blob: Blob) => {
                  clearTimeout(timeoutId);
                  const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const ext = exportFormat === 'gif' ? 'gif' : 'webm';
                  a.download = `wave_displacement_animation.${ext}`;
                  a.click();
                  setStatusMessage(`Export complete! (${sizeMB} MB ${ext.toUpperCase()})`);
                  isRecordingRef.current = false;
                  setIsRecording(false);
               });
            } catch (err: any) {
               console.error('Export save error:', err);
               setStatusMessage(`Export Error: ${err.message || 'Unknown error'}`);
               isRecordingRef.current = false;
               setIsRecording(false);
            }
         }
      } else {
         isRecordingRef.current = false;
         setIsRecording(false);
      }
   };

   const activePreset = FILTER_PRESETS.find(p => p.id === filterMode);

   // Determine target Canvas Aspect Ratio Style
   const getTargetAspect = () => {
      const found = ASPECT_PRESETS.find(p => p.id === aspectRatioMode);
      if (found && found.ratio) return found.ratio;
      return detectedImageAspect || 1.0;
   };

   const targetAspect = getTargetAspect();

   useEffect(() => {
      targetAspectRef.current = targetAspect;
      if (handleResizeRef.current) handleResizeRef.current();
   }, [targetAspect]);

   // Calculate total sequence duration
   const totalSequenceDuration = images.reduce((acc, img) => {
      const hold = img.holdDurationOverride ?? holdDuration;
      return acc + hold + transitionDuration;
   }, 0);

   return (
      <div
         className="w-full h-[100dvh] flex flex-col md:flex-row bg-[#080b11] text-slate-100 overflow-hidden font-sans select-none min-w-0"
         onDrop={handleDrop}
         onDragOver={handleDragOver}
         onDragEnter={handleDragOver}
      >
         {/* LEFT WORKSPACE: Viewport & Canvas Area */}
         <div className="flex flex-col relative bg-[#0d111a] border-b md:border-b-0 md:border-r border-white/10 min-w-0 min-h-0 flex-1">
            {/* Top Studio Header Toolbar */}
            <div className="px-2.5 py-2 md:px-4 md:py-3 bg-[#111622]/90 border-b border-white/10 flex items-center justify-between backdrop-blur-md shrink-0 gap-2">
               <div className="flex items-center gap-2 min-w-0">
                  <div className="hidden sm:flex w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 items-center justify-center text-cyan-400 shadow-inner shrink-0">
                     <Waves size={18} />
                  </div>
                  <div className="min-w-0">
                     <div className="flex items-center gap-1.5">
                        <h2 className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-100 truncate">Wave Studio</h2>
                        <span className="hidden sm:inline px-2 py-0.5 text-[9px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">PRO SHADER</span>
                     </div>
                     <p className="text-[10px] text-slate-400 hidden sm:block">Multi-texture GLSL wave displacement &amp; transition pipeline</p>
                  </div>
               </div>

               {/* Header Actions */}
               <div className="flex items-center gap-1.5 shrink-0">
                  <label className="hidden sm:flex px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer transition-all items-center gap-1.5 active:scale-95">
                     <Upload size={14} className="text-cyan-400" />
                     <span>Add Images</span>
                     <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <button
                     onClick={() => setIsPlaying(!isPlaying)}
                     className={`p-1.5 md:px-3 md:py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${isPlaying ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                        }`}
                  >
                     {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                     <span className="hidden md:inline">{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  {/* Mobile Settings Toggle */}
                  <button
                     onClick={() => setIsMobileSheetOpen(!isMobileSheetOpen)}
                     className={`md:hidden p-1.5 rounded-lg transition-all active:scale-95 ${isMobileSheetOpen ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-slate-300 border border-white/10'}`}
                  >
                     {isMobileSheetOpen ? <X size={16} /> : <Sliders size={16} />}
                  </button>
               </div>
            </div>

            {/* Viewport Aspect Ratio Selector Toolbar - hidden on mobile when sheet is open to save space */}
            <div className={`px-4 py-2 bg-[#090d15] border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 ${isMobileSheetOpen ? 'hidden md:flex' : ''}`}>
               <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 shrink-0 mr-1">
                  <Ratio size={13} className="text-cyan-400" />
                  <span>Ratio:</span>
               </div>
               {ASPECT_PRESETS.map((ap) => (
                  <button
                     key={ap.id}
                     onClick={() => setAspectRatioMode(ap.id)}
                     className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap border ${aspectRatioMode === ap.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                  >
                     {ap.label}
                  </button>
               ))}
            </div>

            {/* Canvas Viewport Box - Dynamically Shrinkwraps Aspect Ratio */}
            <div className="flex-1 relative flex items-center justify-center p-3 md:p-6 overflow-hidden min-h-0 bg-[#06080d]">
               <div ref={viewportRef} className="relative w-full h-full shadow-2xl flex items-center justify-center group bg-black border border-white/10 overflow-hidden rounded-xl">
                  <canvas ref={canvasRef} className="block shadow-xl" />
                  <canvas
                     ref={maskCanvasRef}
                     className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none opacity-0 ${isMaskMode ? 'block' : 'hidden'}`}
                  />
                  {/* Offscreen Text Canvases for WebGL Compositing */}
                  <canvas
                     ref={textCanvasDisplacedRef}
                     style={{ display: 'none' }}
                  />
                  <canvas
                     ref={textCanvasOverlayRef}
                     style={{ display: 'none' }}
                  />
                  {/* UI Overlay Canvas (Handles, Cursor) */}
                  <canvas
                     ref={uiOverlayCanvasRef}
                     className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto ${(isMaskMode || inspectorTab === 'text')
                        ? (maskTool === 'brush' || maskTool === 'eraser'
                           ? 'block cursor-none'
                           : (hoverHandle === 'rotate' ? 'block cursor-alias'
                              : (hoverHandle === 'resize-tl' || hoverHandle === 'resize-br' ? 'block cursor-nwse-resize'
                                 : (hoverHandle === 'resize-tr' || hoverHandle === 'resize-bl' ? 'block cursor-nesw-resize'
                                    : (hoverHandle === 'resize-l' || hoverHandle === 'resize-r' ? 'block cursor-ew-resize'
                                       : (hoverHandle === 'resize-t' || hoverHandle === 'resize-b' ? 'block cursor-ns-resize'
                                          : (maskTool === 'text' ? 'block cursor-text' : 'block cursor-crosshair')))))))
                        : 'hidden'
                        }`}
                     onPointerDown={handlePointerDown}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerLeave={handlePointerUp}
                     style={{ touchAction: 'none' }}
                  />

                  {/* Empty Dropzone Overlay when no images uploaded */}
                  {images.length === 0 && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-6 text-center z-10">
                        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 animate-pulse">
                           <Upload size={28} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-100">Drag & Drop or Click to Upload Images</h3>
                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                           Procedural GLSL shader demo active. Upload 2+ images to experience directional ocean wave cross-fading.
                        </p>
                        <label className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95">
                           Browse Image Pool
                           <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                     </div>
                  )}

                  {/* Floating Viewport Status Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                     <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                        <span>{activePreset?.icon}</span>
                        <span>{activePreset?.name}</span>
                        <span className="text-cyan-400 font-mono">({waveAngle}°)</span>
                     </span>

                     {images.length > 1 && (
                        <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-300 flex items-center gap-1.5 shadow-lg">
                           <Clock size={12} className="text-amber-400" />
                           <span className="font-mono">{totalSequenceDuration.toFixed(1)}s</span>
                           <span className="text-slate-400 font-sans">Total</span>
                        </span>
                     )}

                     {isRecording && (
                        <span className="px-2.5 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-extrabold flex items-center gap-1.5 animate-pulse shadow-lg">
                           <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                           <span>REC {exportFormat.toUpperCase()} {isRecordingRef.current ? `${recordProgress}%` : 'ENCODING...'}</span>
                        </span>
                     )}
                  </div>

                  {/* Fullscreen Button */}
                  {!isRecording && (
                     <button
                        onClick={toggleFullscreen}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-slate-200 hover:text-cyan-400 hover:bg-black/90 transition-all z-40 opacity-100 md:opacity-0 md:group-hover:opacity-100 active:scale-90"
                        title="Toggle Fullscreen"
                     >
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                     </button>
                  )}
               </div>
            </div>

            {/* Bottom Image Sequence Rail */}
            <div className="px-2.5 py-1.5 md:px-4 md:py-3 bg-[#111622]/90 border-t border-white/10 flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-thin shrink-0 min-w-0">
               <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                  <Layers size={10} className="text-cyan-400 md:w-3 md:h-3" />
                  <span>{images.length}</span>
               </div>

               <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map(img => img.id)} strategy={horizontalListSortingStrategy} children={
                     images.map((img, idx) => (
                        <SortableThumbnail
                           key={img.id}
                           id={img.id}
                           img={img}
                           index={idx}
                           currentIndex={currentIndex}
                           onSelect={selectPoolImage}
                           onRemove={removeImage}
                        />
                     ))
                  } />
               </DndContext>

               {/* Quick Add Button */}
               <label className="shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl border border-dashed border-white/20 hover:border-cyan-400/60 bg-white/5 hover:bg-cyan-500/10 flex flex-col items-center justify-center text-slate-400 hover:text-cyan-300 cursor-pointer transition-all">
                  <Plus size={14} />
                  <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
               </label>
            </div>
         </div>

         {/* MOBILE DRAG HANDLE — must be OUTSIDE the scrollable sidebar */}
         {isMobileSheetOpen && (
            <div 
               className="md:hidden w-full flex justify-center items-center py-2 cursor-ns-resize bg-[#0c1018] border-t border-white/10 flex-none z-10"
               onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isDraggingSheetRef.current = true;
               }}
               onPointerMove={(e) => {
                  if (isDraggingSheetRef.current) {
                     e.preventDefault();
                     const percent = 100 - (e.clientY / window.innerHeight) * 100;
                     setSheetHeight(Math.max(20, Math.min(80, percent)));
                  }
               }}
               onPointerUp={(e) => {
                  isDraggingSheetRef.current = false;
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err){}
               }}
               onPointerCancel={(e) => {
                  isDraggingSheetRef.current = false;
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err){}
               }}
               style={{ touchAction: 'none' }}
            >
               <div className="w-10 h-1 bg-white/25 hover:bg-white/50 rounded-full transition-colors pointer-events-none" />
            </div>
         )}

         {/* RIGHT INSPECTOR SIDEBAR */}
         <div 
            className={`w-full md:w-80 lg:w-96 xl:w-[380px] bg-[#0c1018] flex flex-col flex-none overflow-y-auto md:shrink-0 border-t md:border-t-0 border-white/10 min-w-0 md:h-full ${isMobileSheetOpen ? 'md:h-full' : 'hidden md:flex'}`}
            style={isMobileSheetOpen ? { height: `${sheetHeight}dvh` } : {}}  
         >

            {/* Inspector Navigation Tabs */}
            <WaveInspectorTabs activeTab={inspectorTab} onTabChange={setInspectorTab} />


            {/* TAB CONTENT 1: EFFECTS & ANGLE PRESETS */}
            {inspectorTab === 'effects' && (
               <WaveEffectsTab
                  waveAngle={waveAngle} setWaveAngle={setWaveAngle}
                  filterMode={filterMode} setFilterMode={setFilterMode}
                  displacementFunc={displacementFunc} setDisplacementFunc={setDisplacementFunc}
                  globalFilters={globalFilters} setGlobalFilters={setGlobalFilters}
               />
            )}

            {/* TAB CONTENT 2: SLIDERS & FINE TUNING */}
            {inspectorTab === 'controls' && (
               <WaveControlsTab
                  waveSpeed={waveSpeed} setWaveSpeed={setWaveSpeed}
                  waveFrequency={waveFrequency} setWaveFrequency={setWaveFrequency}
                  waveAmplitude={waveAmplitude} setWaveAmplitude={setWaveAmplitude}
                  transitionDuration={transitionDuration} setTransitionDuration={setTransitionDuration}
                  holdDuration={holdDuration} setHoldDuration={setHoldDuration}
                  autoTransition={autoTransition} setAutoTransition={setAutoTransition}
                  manualProgress={manualProgress} setManualProgress={setManualProgress}
               />
            )}

            {/* TAB CONTENT 3: EXPORT PIPELINE */}
            {inspectorTab === 'export' && (
               <WaveExportTab
                  exportFormat={exportFormat} setExportFormat={setExportFormat}
                  recordDuration={recordDuration} setRecordDuration={setRecordDuration}
                  recordFramerate={recordFramerate} setRecordFramerate={setRecordFramerate}
                  exportSize={exportSize} setExportSize={setExportSize}
                  exportQuality={exportQuality} setExportQuality={setExportQuality}
                  exportLoop={exportLoop} setExportLoop={setExportLoop}
                  isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
                  statusMessage={statusMessage}
               />
            )}

            {/* TAB CONTENT 4: CURRENT IMAGE SETTINGS */}
            {inspectorTab === 'current' && (
               <WaveImageTab
                  images={images} currentIndex={currentIndex}
                  updateImageProperty={updateImageProperty} updateImageFilter={updateImageFilter}
                  resetImageFilters={resetImageFilters} resetImageGeometry={resetImageGeometry} globalFilters={globalFilters}
                  holdDuration={holdDuration} compressQuality={compressQuality}
                  setCompressQuality={setCompressQuality} doCompress={doCompress}
               />
            )}

            {/* TAB CONTENT 5: MASKING & SELECTION */}
            {inspectorTab === 'mask' && (
               <WaveMaskTab
                  isMaskMode={isMaskMode}
                  setIsMaskMode={setIsMaskMode}
                  maskTool={maskTool}
                  setMaskTool={setMaskTool}
                  maskBrushSize={maskBrushSize}
                  setMaskBrushSize={setMaskBrushSize}
                  maskRotation={maskRotation}
                  setMaskRotation={setMaskRotation}
                  clearMask={clearMask}
                  undoMask={undoMask}
                  redoMask={redoMask}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  activeMaskObjectId={activeMaskObjectId}
                  deleteActiveObject={() => {
                     if (activeMaskObjectId) {
                        currentMaskObjectsRef.current = currentMaskObjectsRef.current.filter(o => o.id !== activeMaskObjectId);
                        setActiveMaskObjectId(null);
                        saveCurrentMask();
                        renderMaskObjects();
                        renderTextObjects();
                        renderUIOverlay();
                     }
                  }}
               />
            )}

            {/* TAB CONTENT 6: TEXT */}
            {inspectorTab === 'text' && (
               <WaveTextTab
                  maskTool={maskTool}
                  setMaskTool={setMaskTool}
                  textToolContent={textToolContent}
                  setTextToolContent={setTextToolContent}
                  textToolFontFamily={textToolFontFamily}
                  setTextToolFontFamily={setTextToolFontFamily}
                  textToolColor={textToolColor}
                  setTextToolColor={setTextToolColor}
                  textToolAffectedByWaves={textToolAffectedByWaves}
                  setTextToolAffectedByWaves={setTextToolAffectedByWaves}
                  maskBrushSize={maskBrushSize}
                  setMaskBrushSize={setMaskBrushSize}
                  maskRotation={maskRotation}
                  setMaskRotation={setMaskRotation}
                  clearMask={clearMask}
                  undoMask={undoMask}
                  redoMask={redoMask}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  activeMaskObjectId={activeMaskObjectId}
                  deleteActiveObject={() => {
                     if (activeMaskObjectId) {
                        currentMaskObjectsRef.current = currentMaskObjectsRef.current.filter(o => o.id !== activeMaskObjectId);
                        setActiveMaskObjectId(null);
                        saveCurrentMask();
                        renderMaskObjects();
                        renderTextObjects();
                        renderUIOverlay();
                     }
                  }}
               />
            )}
         </div>
      </div>
   );
}
