import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrawingTool = 
  | 'select' | 'eraser' | 'pen' | 'highlighter' 
  | 'straight-line' | 'arrow' | 'rectangle' | 'rounded-rectangle' | 'square' | 'circle' | 'ellipse' | 'triangle'
  | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'polygon' | 'star' | 'diamond'
  | 'sine-wave' | 'square-wave' | 'triangle-wave' | 'sawtooth-wave' | 'pulse-wave' | 'zigzag-wave'
  | 'function-brush';

export type BrushStyle = 
  | 'smooth-ink' | 'marker' | 'neon-glow' | 'pencil' 
  | 'dashed' | 'rough-handdrawn' | 'calligraphy' | 'soft-highlighter';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  tool: DrawingTool;
  brushStyle: BrushStyle;
  points: Point[]; // For paths, it's many. For shapes/lines, it's [start, end]
  color: string;
  width: number;
  opacity: number;
  glowIntensity: number;
  smoothing: number;
  blinkDuration: number;
  blinkFrequency?: number;
  fadeOutDuration: number;
  fadeEasing?: string;
  autoRemove: boolean;
  createdAt: number;
  waveAmplitude?: number; // Only for waves
  waveLength?: number; // Only for waves
  isFading?: boolean;
  isHighlighter?: boolean;
  fillEnabled?: boolean;
  fillOpacity?: number;
  fillColor?: string;
  functionExpression?: string;
  functionAmplitude?: number;
  functionFrequency?: number;
  functionPhase?: number;
  functionSmoothness?: number;
}

interface AnnotationState {
  // Tools and Settings
  activeTool: DrawingTool;
  brushStyle: BrushStyle;
  color: string;
  width: number;
  opacity: number;
  glowIntensity: number;
  smoothing: number;
  blinkDuration: number;
  blinkFrequency: number;
  fadeOutDuration: number;
  fadeEasing: string;
  autoRemove: boolean;
  autoShapeDetection: boolean;
  waveAmplitude: number;
  waveLength: number;
  fillEnabled: boolean;
  fillOpacity: number;
  fillColor: string;
  functionExpression: string;
  functionAmplitude: number;
  functionFrequency: number;
  functionPhase: number;
  functionSmoothness: number;
  selectedAnnotationIds: string[];
  
  // UI Settings
  isToolbarVisible: boolean;
  toolbarOpacity: number;
  toolbarOrientation: 'horizontal' | 'vertical';
  toolbarPosition: { x: number; y: number };
  toolbarPlacement: 'drag' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  toolbarScale: number;
  optionsPanelWidth: number;
  optionsPanelHeight: number;
  functionPanelWidth: number;
  functionPanelHeight: number;

  // Data
  annotations: Annotation[];
  
  // History
  history: Annotation[][];
  historyIndex: number;

  // Actions
  setActiveTool: (tool: DrawingTool) => void;
  setBrushStyle: (style: BrushStyle) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setGlowIntensity: (intensity: number) => void;
  setSmoothing: (smoothing: number) => void;
  setBlinkDuration: (duration: number) => void;
  setBlinkFrequency: (freq: number) => void;
  setFadeOutDuration: (duration: number) => void;
  setFadeEasing: (easing: string) => void;
  setAutoRemove: (auto: boolean) => void;
  setAutoShapeDetection: (auto: boolean) => void;
  setWaveAmplitude: (amp: number) => void;
  setWaveLength: (len: number) => void;
  setFillEnabled: (enabled: boolean) => void;
  setFillOpacity: (opacity: number) => void;
  setFillColor: (color: string) => void;
  setFunctionExpression: (expr: string) => void;
  setFunctionAmplitude: (amp: number) => void;
  setFunctionFrequency: (freq: number) => void;
  setFunctionPhase: (phase: number) => void;
  setFunctionSmoothness: (smoothness: number) => void;

  // UI Actions
  setIsToolbarVisible: (visible: boolean) => void;
  setToolbarOpacity: (opacity: number) => void;
  setToolbarOrientation: (orientation: 'horizontal' | 'vertical') => void;
  setToolbarPosition: (pos: { x: number; y: number }) => void;
  setToolbarPlacement: (placement: 'drag' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void;
  setToolbarScale: (scale: number) => void;
  setOptionsPanelWidth: (w: number) => void;
  setOptionsPanelHeight: (h: number) => void;
  setFunctionPanelWidth: (w: number) => void;
  setFunctionPanelHeight: (h: number) => void;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotations: (ids: string[]) => void;
  clearAnnotations: () => void;
  setSelectedAnnotations: (ids: string[]) => void;
  commitAction: () => void;
  undo: () => void;
  redo: () => void;
  resetPreferences: () => void;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      activeTool: 'select',
  brushStyle: 'smooth-ink',
  color: '#eab308', // Yellow for highlighter typically
  width: 4,
  opacity: 1,
  glowIntensity: 0,
  smoothing: 0.5,
  blinkDuration: 3, // 3 seconds total
  blinkFrequency: 2, // 2 times per second (Hz)
  fadeOutDuration: 1, // 1 second fade
  fadeEasing: 'cubic-bezier(0, 0, 0, 1.04)',
  autoRemove: false,
  autoShapeDetection: false,
  waveAmplitude: 20,
  waveLength: 40,
  fillEnabled: false,
  fillOpacity: 0.3,
  fillColor: '#eab308',
  functionExpression: 'sin(x)',
  functionAmplitude: 20,
  functionFrequency: 0.1,
  functionPhase: 0,
  functionSmoothness: 2,
  selectedAnnotationIds: [],
  isToolbarVisible: false,
  toolbarOpacity: 1,
  toolbarOrientation: 'vertical',
  toolbarPosition: { x: typeof window !== 'undefined' ? window.innerWidth / 2 - 250 : 200, y: 20 },
  toolbarPlacement: 'top-left',
  toolbarScale: 1,
  optionsPanelWidth: 200,
  optionsPanelHeight: 280,
  functionPanelWidth: 240,
  functionPanelHeight: 300,
  annotations: [],
  history: [[]],
  historyIndex: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => {
    const prevState = get();
    const shouldSyncFill = prevState.fillColor === prevState.color;
    set({ color, ...(shouldSyncFill ? { fillColor: color } : {}) });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ 
        annotations: annotations.map(a => 
          selectedAnnotationIds.includes(a.id) 
            ? { ...a, color, ...(shouldSyncFill ? { fillColor: color } : {}) } 
            : a
        ) 
      });
    }
  },
  setWidth: (width) => {
    set({ width });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, width } : a) });
    }
  },
  setOpacity: (opacity) => {
    set({ opacity });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, opacity } : a) });
    }
  },
  setGlowIntensity: (glowIntensity) => {
    set({ glowIntensity });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, glowIntensity } : a) });
    }
  },
  setBrushStyle: (style) => {
    set({ brushStyle: style });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, brushStyle: style } : a) });
    }
  },
  setSmoothing: (smoothing) => set({ smoothing }),
  setBlinkDuration: (blinkDuration) => set({ blinkDuration }),
  setBlinkFrequency: (blinkFrequency) => set({ blinkFrequency }),
  setFadeOutDuration: (fadeOutDuration) => set({ fadeOutDuration }),
  setFadeEasing: (fadeEasing) => set({ fadeEasing }),
  setAutoRemove: (autoRemove) => set({ autoRemove }),
  setAutoShapeDetection: (autoShapeDetection) => set({ autoShapeDetection }),
  setWaveAmplitude: (waveAmplitude) => set({ waveAmplitude }),
  setWaveLength: (waveLength) => set({ waveLength }),
  setFillEnabled: (fillEnabled) => {
    set({ fillEnabled });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, fillEnabled } : a) });
    }
  },
  setFillOpacity: (fillOpacity) => {
    set({ fillOpacity });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, fillOpacity } : a) });
    }
  },
  setFillColor: (fillColor) => {
    set({ fillColor });
    const { selectedAnnotationIds, annotations } = get();
    if (selectedAnnotationIds.length > 0) {
      set({ annotations: annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, fillColor } : a) });
    }
  },
  setFunctionExpression: (functionExpression) => set({ functionExpression }),
  setFunctionAmplitude: (functionAmplitude) => set({ functionAmplitude }),
  setFunctionFrequency: (functionFrequency) => set({ functionFrequency }),
  setFunctionPhase: (functionPhase) => set({ functionPhase }),
  setFunctionSmoothness: (functionSmoothness) => set({ functionSmoothness }),

  setIsToolbarVisible: (isToolbarVisible) => set({ isToolbarVisible }),
  setToolbarOpacity: (toolbarOpacity) => set({ toolbarOpacity }),
  setToolbarOrientation: (toolbarOrientation) => set({ toolbarOrientation }),
  setToolbarPosition: (toolbarPosition) => set({ toolbarPosition }),
  setToolbarPlacement: (toolbarPlacement) => set({ toolbarPlacement }),
  setToolbarScale: (toolbarScale) => set({ toolbarScale }),
  setOptionsPanelWidth: (optionsPanelWidth) => set({ optionsPanelWidth }),
  setOptionsPanelHeight: (optionsPanelHeight) => set({ optionsPanelHeight }),
  setFunctionPanelWidth: (functionPanelWidth) => set({ functionPanelWidth }),
  setFunctionPanelHeight: (functionPanelHeight) => set({ functionPanelHeight }),

  addAnnotation: (annotation) => set((state) => ({ annotations: [...state.annotations, annotation] })),
  updateAnnotation: (id, updates) => set((state) => ({
    annotations: state.annotations.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  removeAnnotations: (ids) => set((state) => ({
    annotations: state.annotations.filter(a => !ids.includes(a.id)),
    selectedAnnotationIds: state.selectedAnnotationIds.filter(id => !ids.includes(id))
  })),
  clearAnnotations: () => set({ annotations: [], selectedAnnotationIds: [] }),
  setSelectedAnnotations: (ids) => {
    set({ selectedAnnotationIds: ids });
    const { annotations } = get();
    if (ids.length === 1) {
      const anno = annotations.find(a => a.id === ids[0]);
      if (anno) {
        set({ 
          color: anno.color, 
          width: anno.width, 
          opacity: anno.opacity, 
          glowIntensity: anno.glowIntensity, 
          brushStyle: anno.brushStyle,
          fillEnabled: anno.fillEnabled ?? false,
          fillOpacity: anno.fillOpacity ?? 0.3,
          fillColor: anno.fillColor ?? anno.color,
          functionExpression: anno.functionExpression ?? 'sin(x)',
          functionAmplitude: anno.functionAmplitude ?? 20,
          functionFrequency: anno.functionFrequency ?? 0.1,
          functionPhase: anno.functionPhase ?? 0,
          functionSmoothness: anno.functionSmoothness ?? 5
        });
      }
    }
  },
  
  commitAction: () => {
    const { history, historyIndex, annotations } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...annotations]);
    
    // limit history size to 50
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({ annotations: [...history[newIndex]], historyIndex: newIndex, selectedAnnotationIds: [] });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({ annotations: [...history[newIndex]], historyIndex: newIndex, selectedAnnotationIds: [] });
    }
  },
  resetPreferences: () => {
    set({
      activeTool: 'select',
      brushStyle: 'smooth-ink',
      color: '#eab308',
      width: 4,
      opacity: 1,
      glowIntensity: 0,
      smoothing: 0.5,
      blinkDuration: 3,
      blinkFrequency: 2,
      fadeOutDuration: 1,
      fadeEasing: 'cubic-bezier(0, 0, 0, 1.04)',
      autoRemove: false,
      autoShapeDetection: false,
      waveAmplitude: 20,
      waveLength: 40,
      fillEnabled: false,
      fillOpacity: 0.3,
      fillColor: '#eab308',
      functionExpression: 'sin(x)',
      functionAmplitude: 20,
      functionFrequency: 0.1,
      functionPhase: 0,
      functionSmoothness: 2,
      toolbarOpacity: 1,
      toolbarOrientation: 'vertical',
      toolbarScale: 1,
      optionsPanelWidth: 200,
      optionsPanelHeight: 280,
      functionPanelWidth: 240,
      functionPanelHeight: 300,
      toolbarPlacement: 'top-left',
    });
  },
}),
{
  name: 'drawing-app-storage',
  partialize: (state) => {
    const { history, historyIndex, ...rest } = state;
    return rest;
  },
}
)
);
