import { create } from 'zustand';
import { startTransition } from 'react';
import { persist } from 'zustand/middleware';
import { parseInput } from '../utils/parser';
import { transformToTree } from '../utils/transformer';
import SearchWorker from '../utils/searchWorker?worker';
import { parseSearchQuery, buildSearchContext, evaluateQuery } from '../utils/searchEngine';

let searchWorkerInstance: Worker | null = null;
if (typeof window !== 'undefined') {
  searchWorkerInstance = new SearchWorker();
}

export type LayoutMode = 'vertical' | 'horizontal' | 'radial' | 'force' | 'compact' | 'mindmap';
export type NodeTheme = 'glassmorphism' | 'vscode' | 'github' | 'cyberpunk' | 'minimal' | 'gradient' | 'pastel' | 'terminal' | 'material' | 'blueprint' | 'retro' | 'holographic' | 'notebook' | 'custom' | 'nature' | 'circuit' | 'galaxy' | 'glass' | 'neon' | 'math' | 'neural' | 'river' | 'tree' | 'pixel' | 'hacker' | 'cloud' | 'dna' | 'lava' | 'ocean' | 'rhythm' | 'rune' | 'zen' | 'abstract' | 'architect' | 'ludo' | 'chess' | 'octopus' | 'nature2' | 'hydrogen' | 'seed' | 'banyan' | 'peepal';
export type EdgeStyle = 'curved' | 'bezier' | 'straight' | 'step' | 'animated' | 'dashed' | 'neon' | 'double' | 'pipe' | 'thin' | 'orgChart' | 'circuit' | 'glow' | 'zigzag' | 'pulse' | 'ludo' | 'chess' | 'octopus' | 'nature2' | 'hydrogen' | 'seed' | 'metro' | 'angled-step';
export type NodeShape = 'default' | 'circle' | 'rectangle' | 'triangle' | 'hexagon' | 'pill' | 'diamond' | 'parallelogram';
export type CanvasTheme = 'none' | 'dots' | 'grid' | 'lines';
export type AppTheme = 'dark' | 'light';
export type GradientType = 'linear' | 'radial';
export type VisualizerMode = 'graph' | 'schema';

export type SearchEngineMode = 'strict' | 'permissive';

// Default settings
export const defaultSettings = {
  layoutMode: 'horizontal' as LayoutMode,
  nodeTheme: 'vscode' as NodeTheme,
  edgeStyle: 'curved' as EdgeStyle,
  nodeShape: 'default' as NodeShape,
  canvasTheme: 'none' as CanvasTheme,
  appTheme: 'dark' as AppTheme,
  canvasBackgroundColor: 'rgba(13, 17, 23, 1)',
  canvasPatternColor: 'rgba(148, 163, 184, 0.15)',
  canvasBackgroundImage: '',
  canvasBackgroundBlur: 0,
  nodeSpread: 1.0,
  nodeSize: 1.0,
  edgeWidth: 1.0,
  showMediaPreview: false,
  manuallyRenderedNodes: {} as Record<string, boolean>,
  globalTextExpanded: false,
  activePreviewText: null,
  activePreviewPath: null,
  activePreviewMedia: null,
  nodeColor: 'rgba(30, 41, 59, 1)',
  nodeTextColor: 'rgba(255, 255, 255, 1)',
  nodeGradientColor1: 'rgba(79, 70, 229, 1)',
  nodeGradientColor2: 'rgba(147, 51, 234, 1)',
  useNodeGradient: false,
  nodeGradientAngle: 45,
  nodeGradientType: 'linear' as GradientType,
  searchEngineMode: 'permissive' as SearchEngineMode,
  isAutosaveEnabled: true,
  visualizerMode: 'graph' as VisualizerMode,
};

export type CodeFormat = 'json' | 'yaml' | 'csv';

export type ApiNodeDiagnosticError = {
  type: string;
  code: string;
  message: string;
  userMessage: string;
  details?: string;
  timestamp: string;
  requestInfo: {
    url: string;
    method: string;
    proxyUsed: boolean;
  };
};

export interface StoreState {
  codeFormat: CodeFormat;
  setCodeFormat: (format: CodeFormat) => void;
  convertFormat: (targetFormat: CodeFormat) => Promise<void>;
  inlineApiEditor: { url: string; path: string; nodeId: string; x: number; y: number; width: number } | null;
  setInlineApiEditor: (editor: { url: string; path: string; nodeId: string; x: number; y: number; width: number } | null) => void;
  apiNodeConfig: Record<string, { method: string; responseType: string; timeout: number }>;
  setApiNodeConfig: (path: string, config: { method: string; responseType: string; timeout: number }) => void;
  apiNodeResponses: Record<string, any>;
  apiNodeLoading: Record<string, boolean>;
  apiNodeErrors: Record<string, ApiNodeDiagnosticError | null>;
  setApiNodeResponse: (path: string, data: any) => void;
  setApiNodeLoading: (path: string, loading: boolean) => void;
  setApiNodeError: (path: string, error: ApiNodeDiagnosticError | null) => void;
  removeApiNode: (path: string) => void;
  isAutosaveEnabled: boolean;
  setIsAutosaveEnabled: (enabled: boolean) => void;
  visualizerMode: VisualizerMode;
  setVisualizerMode: (mode: VisualizerMode) => void;
  searchEngineMode: SearchEngineMode;
  globalSearchErrors: string[];
  globalSearchSuggestions: string[];
  code: string;
  parsedData: any | null;
  treeData: any | null;
  error: string | null;
  layoutMode: LayoutMode;
  nodeTheme: NodeTheme;
  edgeStyle: EdgeStyle;
  nodeShape: NodeShape;
  canvasTheme: CanvasTheme;
  appTheme: AppTheme;
  canvasBackgroundColor: string;
  canvasPatternColor: string;
  canvasBackgroundImage: string;
  canvasBackgroundBlur: number;
  nodeSpread: number;
  nodeSize: number;
  edgeWidth: number;
  nodeColor: string;
  nodeTextColor: string;
  nodeGradientColor1: string;
  nodeGradientColor2: string;
  useNodeGradient: boolean;
  nodeGradientAngle: number;
  nodeGradientType: GradientType;
  searchQuery: string;
  collapsedNodes: Set<string>;
  searchMatches: Set<string>;
  searchAncestors: Set<string>;
  activeMatchIndex: number | null;
  activeMatchId: string | null;
  nextMatch: () => void;
  prevMatch: () => void;
  selectedNodeId: string | null;
  isEditorPanelOpen: boolean;
  isAdvancedPanelOpen: boolean;
  isMobileMenuOpen: boolean;
  isShortcutsOpen: boolean;
  isMathHelpOpen: boolean;
  showMediaPreview: boolean;
  manuallyRenderedNodes: Record<string, boolean>;
  globalTextExpanded: boolean;
  activePreviewText: string | null;
  activePreviewPath: string | null;
  activePreviewMedia: { url: string; type: 'image' | 'video' | 'audio' | 'smart' | 'pdf' | '3d-model' } | null;
  knownDataUrls: Record<string, 'json' | 'xml' | 'csv'>;
  setKnownDataUrl: (url: string, type: 'json' | 'xml' | 'csv') => void;
  apiMethod: string;
  apiUrl: string;
  apiHeaders: string;
  apiBody: string;
  activeTab: 'raw' | 'api';
  dragOverrides: Record<string, { x: number, y: number }>;
  undoStack: { code: string, format: CodeFormat }[];
  redoStack: { code: string, format: CodeFormat }[];
  
  setCode: (code: string, skipHistory?: boolean) => void;
  setApiMethod: (method: string) => void;
  setApiUrl: (url: string) => void;
  setApiHeaders: (headers: string) => void;
  setApiBody: (body: string) => void;
  setActiveTab: (tab: 'raw' | 'api') => void;
  resetApiConfig: () => void;
  undo: () => void;
  redo: () => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setNodeTheme: (theme: NodeTheme) => void;
  setEdgeStyle: (style: EdgeStyle) => void;
  setNodeShape: (shape: NodeShape) => void;
  setCanvasTheme: (theme: CanvasTheme) => void;
  setAppTheme: (theme: AppTheme) => void;
  setCanvasBackgroundColor: (color: string) => void;
  setCanvasPatternColor: (color: string) => void;
  setCanvasBackgroundImage: (url: string) => void;
  setCanvasBackgroundBlur: (blur: number) => void;
  setNodeSpread: (spread: number) => void;
  setNodeSize: (size: number) => void;
  setEdgeWidth: (width: number) => void;
  setNodeColor: (color: string) => void;
  setNodeTextColor: (color: string) => void;
  setNodeGradientColor1: (color: string) => void;
  setNodeGradientColor2: (color: string) => void;
  setUseNodeGradient: (use: boolean) => void;
  setNodeGradientAngle: (angle: number) => void;
  setNodeGradientType: (type: GradientType) => void;
  setSearchEngineMode: (mode: SearchEngineMode) => void;
  setSearchQuery: (query: string) => void;
  toggleNodeCollapse: (id: string) => void;
  setCollapsedNodes: (nodes: Set<string>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsEditorPanelOpen: (isOpen: boolean) => void;
  setIsAdvancedPanelOpen: (isOpen: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setIsShortcutsOpen: (isOpen: boolean) => void;
  setIsMathHelpOpen: (isOpen: boolean) => void;
  setShowMediaPreview: (show: boolean) => void;
  toggleManualMediaRender: (nodeId: string) => void;
  setGlobalTextExpanded: (expanded: boolean) => void;
  setActivePreviewText: (text: string | null, path?: string | null) => void;
  setActivePreviewMedia: (media: { url: string; type: 'image' | 'video' | 'audio' | 'smart' | 'pdf' | '3d-model' } | null) => void;
  updateNodeValue: (path: string, newValue: any) => Promise<void>;
  setDragOverride: (id: string, pos: { x: number, y: number } | null) => void;
  setMultipleDragOverrides: (overrides: Record<string, { x: number, y: number } | null>) => void;
  clearDragOverrides: () => void;
  
  pendingImport: { 
    filename: string; 
    text?: string; 
    dataExcel?: any; 
    fileContext?: 'media' | 'data' | 'unknown';
    mimeType?: string;
    blobUrl?: string;
    fileSize?: number;
  } | null;
  setPendingImport: (importData: { 
    filename: string; 
    text?: string; 
    dataExcel?: any; 
    fileContext?: 'media' | 'data' | 'unknown';
    mimeType?: string;
    blobUrl?: string;
    fileSize?: number;
  } | null) => void;
  
  uploadedMediaMetadata: Record<string, { filename: string, mimeType: string, size: number }>;
  registerMediaMetadata: (url: string, metadata: { filename: string, mimeType: string, size: number}) => void;

  notification: { message: string, type: 'error' | 'success' | 'info' } | null;
  setNotification: (notification: { message: string, type: 'error' | 'success' | 'info' } | null) => void;
  isSavedDocsOpen: boolean;
  setIsSavedDocsOpen: (isOpen: boolean) => void;
  schemaExportActive: boolean;
  setSchemaExportActive: (active: boolean) => void;
  // Resets
  resetAllSettings: () => void;
  clearCode: () => void;
}

const initialCode = `{
  "project": "JSON Graph Viewer",
  "version": "1.0.0",
  "features": [
    "Many Theme Options",
    "Different Edges Style",
    "Media Preview"
  ],
  "settings": {
    "theme": "dark",
    "isBeta": true,
    "maxNodes": 10000
  },
  "metadata": null
}`;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      code: initialCode,
      globalSearchErrors: [],
      globalSearchSuggestions: [],
      parsedData: null,
      treeData: null,
      error: null,
      searchQuery: '',
      collapsedNodes: new Set<string>(),
      searchMatches: new Set<string>(),
      searchAncestors: new Set<string>(),
      activeMatchIndex: null,
      activeMatchId: null,
      selectedNodeId: null,
      isEditorPanelOpen: true,
      isAdvancedPanelOpen: false,
      isMobileMenuOpen: false,
      isShortcutsOpen: false,
      isMathHelpOpen: false,
      isSavedDocsOpen: false,
      pendingImport: null,
      setPendingImport: (importData) => set({ pendingImport: importData }),
      
      uploadedMediaMetadata: {},
      registerMediaMetadata: (url, metadata) => set((state) => ({ 
          uploadedMediaMetadata: { ...state.uploadedMediaMetadata, [url]: metadata } 
      })),

      notification: null,
      setNotification: (notification) => set({ notification }),

      schemaExportActive: false,
      setSchemaExportActive: (active: boolean) => set({ schemaExportActive: active }),
      apiMethod: 'GET',
      apiUrl: 'https://jsonplaceholder.typicode.com/todos/1',
      apiHeaders: '{\n  "Accept": "application/json"\n}',
      apiBody: '',
      activeTab: 'raw',
      dragOverrides: {},
      undoStack: [],
      redoStack: [],
      inlineApiEditor: null,
      setInlineApiEditor: (editor) => set({ inlineApiEditor: editor }),
      apiNodeConfig: {},
      setApiNodeConfig: (path, config) => set((s) => ({ apiNodeConfig: { ...s.apiNodeConfig, [path]: config } })),

      apiNodeResponses: {},
      apiNodeLoading: {},
      apiNodeErrors: {},
      setApiNodeResponse: (path: string, data: any) => {
        set((s) => {
          const res = { ...s.apiNodeResponses, [path]: data };
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(s.parsedData, 'root', 'root', res);
          }
          return { apiNodeResponses: res, treeData };
        });
      },
      setApiNodeLoading: (path: string, loading: boolean) => set((s) => ({ apiNodeLoading: { ...s.apiNodeLoading, [path]: loading } })),
      setApiNodeError: (path: string, error: ApiNodeDiagnosticError | null) => set((s) => ({ apiNodeErrors: { ...s.apiNodeErrors, [path]: error } })),
      removeApiNode: (path: string) => set((s) => {
        const res = { ...s.apiNodeResponses };
        delete res[path];
        const loading = { ...s.apiNodeLoading };
        delete loading[path];
        const errors = { ...s.apiNodeErrors };
        delete errors[path];
        let treeData = null;
        if (s.parsedData !== null) {
          treeData = transformToTree(s.parsedData, 'root', 'root', res);
        }
        return { apiNodeResponses: res, apiNodeLoading: loading, apiNodeErrors: errors, treeData };
      }),

      codeFormat: 'json',
      setCodeFormat: (format: CodeFormat) => set({ codeFormat: format }),
      convertFormat: async (targetFormat: CodeFormat) => {
        const { parsedData, codeFormat, setCode } = get();
        if (!parsedData || codeFormat === targetFormat) return;
        
        let newCode = '';
        if (targetFormat === 'yaml') {
          try {
            const yaml = (await import('js-yaml')).default;
            newCode = yaml.dump(parsedData);
          } catch {
            return;
          }
        } else if (targetFormat === 'csv') {
          try {
            const Papa = (await import('papaparse')).default;
            newCode = Papa.unparse(parsedData);
          } catch {
            return;
          }
        } else {
          newCode = JSON.stringify(parsedData, null, 2);
        }
        
        set({ codeFormat: targetFormat });
        setCode(newCode);
      },

      setCode: (code: string, skipHistory = false) => {
        const currentCode = get().code;
        const { apiNodeResponses, codeFormat } = get();
        const { data, error } = parseInput(code);
        let treeData = null;
        if (data !== null) {
            treeData = transformToTree(data, 'root', 'root', apiNodeResponses);
        }

        if (!skipHistory && code !== currentCode) {
          set((state) => ({
            undoStack: [...state.undoStack, { code: currentCode, format: codeFormat }].slice(-50),
            redoStack: []
          }));
        }

        set({ code, parsedData: data, error, treeData, dragOverrides: {} });
        if (get().searchQuery && treeData) {
          get().setSearchQuery(get().searchQuery);
        } else {
          set({ searchMatches: new Set(), searchAncestors: new Set() });
        }
      },

      undo: () => {
        const { undoStack, code, codeFormat } = get();
        if (undoStack.length === 0) return;

        const previousState = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);

        set((state) => ({
          undoStack: newUndoStack,
          redoStack: [{ code, format: codeFormat }, ...state.redoStack].slice(0, 50),
          codeFormat: previousState.format
        }));

        get().setCode(previousState.code, true);
      },

      redo: () => {
        const { redoStack, code, codeFormat } = get();
        if (redoStack.length === 0) return;

        const nextState = redoStack[0];
        const newRedoStack = redoStack.slice(1);

        set((state) => ({
          redoStack: newRedoStack,
          undoStack: [...state.undoStack, { code, format: codeFormat }].slice(-50),
          codeFormat: nextState.format
        }));

        get().setCode(nextState.code, true);
      },
      setLayoutMode: (mode: LayoutMode) => set({ layoutMode: mode, dragOverrides: {} }),
      setNodeTheme: (theme: NodeTheme) => set({ nodeTheme: theme }),
      setEdgeStyle: (style: EdgeStyle) => set({ edgeStyle: style }),
      setNodeShape: (shape: NodeShape) => set({ nodeShape: shape, dragOverrides: {} }),
      setCanvasTheme: (theme: CanvasTheme) => set({ canvasTheme: theme }),
      setAppTheme: (theme: AppTheme) => set({ appTheme: theme }),
      setCanvasBackgroundColor: (color: string) => set({ canvasBackgroundColor: color }),
      setCanvasPatternColor: (color: string) => set({ canvasPatternColor: color }),
      setCanvasBackgroundImage: (url: string) => set({ canvasBackgroundImage: url }),
      setCanvasBackgroundBlur: (blur: number) => set({ canvasBackgroundBlur: blur }),
      setNodeSpread: (spread: number) => set({ nodeSpread: spread, dragOverrides: {} }),
      setNodeSize: (size: number) => set({ nodeSize: size, dragOverrides: {} }),
      setEdgeWidth: (width: number) => set({ edgeWidth: width }),
      setNodeColor: (color: string) => set({ nodeColor: color }),
      setNodeTextColor: (color: string) => set({ nodeTextColor: color }),
      setNodeGradientColor1: (color: string) => set({ nodeGradientColor1: color }),
      setNodeGradientColor2: (color: string) => set({ nodeGradientColor2: color }),
      setUseNodeGradient: (use: boolean) => set({ useNodeGradient: use }),
      setNodeGradientAngle: (angle: number) => set({ nodeGradientAngle: angle }),
      setNodeGradientType: (type: GradientType) => set({ nodeGradientType: type }),
      setVisualizerMode: (mode: VisualizerMode) => set({ visualizerMode: mode }),
      setIsAutosaveEnabled: (enabled: boolean) => set({ isAutosaveEnabled: enabled }),
      setSearchEngineMode: (mode: SearchEngineMode) => {
        set({ searchEngineMode: mode });
        get().setSearchQuery(get().searchQuery); // trigger re-evaluation
      },
      setSearchQuery: (query: string) => {
        const state = get();
        const q = query.trim();
        
        if (!q || !state.treeData) {
          startTransition(() => {
            set({ 
              searchQuery: query,
              searchMatches: new Set(), 
              searchAncestors: new Set(), 
              globalSearchErrors: [], 
              globalSearchSuggestions: [], 
              activeMatchIndex: null, 
              activeMatchId: null 
            });
          });
          return;
        }

        if (searchWorkerInstance) {
          searchWorkerInstance.onmessage = (e) => {
            if (e.data.query === query) {
              startTransition(() => {
                const currentState = get();
                const newCollapsed = new Set(currentState.collapsedNodes);
                
                // Open paths returned by worker
                e.data.newCollapsedPaths.forEach((p: string) => newCollapsed.delete(p));
                
                set({
                  searchQuery: query,
                  collapsedNodes: newCollapsed,
                  searchMatches: new Set(e.data.matches),
                  searchAncestors: new Set(e.data.ancestors),
                  globalSearchErrors: e.data.globalErrors,
                  globalSearchSuggestions: e.data.globalSuggestions,
                  activeMatchIndex: e.data.activeIndex,
                  activeMatchId: e.data.activeId
                });
              });
            }
          };

          searchWorkerInstance.postMessage({
            query: query,
            treeData: state.treeData,
            searchEngineMode: state.searchEngineMode
          });
        }
      },
      toggleNodeCollapse: (id: string) => {
        set((state) => {
          const newCollapsed = new Set(state.collapsedNodes);
          if (newCollapsed.has(id)) {
            newCollapsed.delete(id);
          } else {
            newCollapsed.add(id);
          }
          return { collapsedNodes: newCollapsed };
        });
      },
      setCollapsedNodes: (nodes: Set<string>) => set({ collapsedNodes: nodes }),
      setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),
      setApiMethod: (method: string) => set({ apiMethod: method }),
      setApiUrl: (url: string) => set({ apiUrl: url }),
      setApiHeaders: (headers: string) => set({ apiHeaders: headers }),
      setApiBody: (body: string) => set({ apiBody: body }),
      setActiveTab: (tab: 'raw' | 'api') => set({ activeTab: tab }),
      resetApiConfig: () => set({ 
        apiMethod: 'GET',
        apiUrl: 'https://jsonplaceholder.typicode.com/todos/1',
        apiHeaders: '{\n  "Accept": "application/json"\n}',
        apiBody: ''
      }),
      setIsEditorPanelOpen: (isOpen: boolean) => set({ isEditorPanelOpen: isOpen }),
      setIsAdvancedPanelOpen: (isOpen: boolean) => set({ isAdvancedPanelOpen: isOpen }),
      setIsMobileMenuOpen: (isOpen: boolean) => void set({ isMobileMenuOpen: isOpen }),
      setIsShortcutsOpen: (isOpen: boolean) => void set({ isShortcutsOpen: isOpen }),
      setIsMathHelpOpen: (isOpen: boolean) => set({ isMathHelpOpen: isOpen }),
      setIsSavedDocsOpen: (isOpen: boolean) => set({ isSavedDocsOpen: isOpen }),
      setShowMediaPreview: (show: boolean) => set({ showMediaPreview: show }),
      toggleManualMediaRender: (nodeId: string) => set((state) => ({
        manuallyRenderedNodes: {
          ...state.manuallyRenderedNodes,
          [nodeId]: !state.manuallyRenderedNodes[nodeId],
        }
      })),
      setGlobalTextExpanded: (expanded: boolean) => set({ globalTextExpanded: expanded }),
      setActivePreviewText: (text, path = null) => set({ activePreviewText: text, activePreviewPath: path }),
      setActivePreviewMedia: (media) => set({ activePreviewMedia: media }),
      knownDataUrls: {},
      setKnownDataUrl: (url, type) => set((state) => ({ knownDataUrls: { ...state.knownDataUrls, [url]: type } })),
      
      updateNodeValue: async (path, newValue) => {
        const { parsedData, code, setCode, codeFormat } = get();
        if (!parsedData) return;

        // Clone parsedData
        const newData = JSON.parse(JSON.stringify(parsedData));
        
        // Path is like 'root.key.subkey' or 'root[0].key'
        const parts = path.replace(/root\.?/, '').split(/\.|(?=\[)/).filter(Boolean);
        
        let current = newData;
        for (let i = 0; i < parts.length - 1; i++) {
          let part = parts[i];
          if (part.startsWith('[')) {
            part = part.slice(1, -1);
          }
          current = current[part];
        }
        
        if (parts.length > 0) {
          let lastPart = parts[parts.length - 1];
          if (lastPart.startsWith('[')) {
            lastPart = lastPart.slice(1, -1);
          }
          
          // Try to cast to number/boolean if applicable
          let finalVal = newValue;
          if (newValue === 'true') finalVal = true;
          else if (newValue === 'false') finalVal = false;
          else if (newValue === 'null') finalVal = null;
          else if (!isNaN(Number(newValue)) && newValue.trim() !== '') {
            finalVal = Number(newValue);
          }

          current[lastPart] = finalVal;
        } else {
          // It's the root itself being edited? (Unlikely with this transformer)
        }

        // Detect format
        const isYaml = codeFormat === 'yaml';
        const isCsv = codeFormat === 'csv';

        let newCode = '';
        if (isYaml) {
          try {
            const yaml = (await import('js-yaml')).default;
            newCode = yaml.dump(newData);
          } catch {
            newCode = JSON.stringify(newData, null, 2);
          }
        } else if (isCsv) {
          try {
            const Papa = (await import('papaparse')).default;
            newCode = Papa.unparse(newData);
          } catch {
             newCode = JSON.stringify(newData, null, 2);
          }
        } else {
          newCode = JSON.stringify(newData, null, 2);
        }

        setCode(newCode);
      },

      setDragOverride: (id, pos) => set((state) => {
        const newOverrides = { ...state.dragOverrides };
        if (pos) {
          newOverrides[id] = pos;
        } else {
          delete newOverrides[id];
        }
        return { dragOverrides: newOverrides };
      }),
      setMultipleDragOverrides: (overrides) => set((state) => {
        const newOverrides = { ...state.dragOverrides };
        for (const [id, pos] of Object.entries(overrides)) {
          if (pos) {
            newOverrides[id] = pos;
          } else {
            delete newOverrides[id];
          }
        }
        return { dragOverrides: newOverrides };
      }),
      clearDragOverrides: () => set({ dragOverrides: {} }),
      
      nextMatch: () => set((state) => {
          if (state.searchMatches.size === 0) return state;
          const matches = Array.from(state.searchMatches);
          const i = state.activeMatchIndex;
          const nextIndex = (i === null || i === undefined || i >= matches.length - 1) ? 0 : i + 1;
          const activeId = matches[nextIndex];
          
          return { activeMatchIndex: nextIndex, activeMatchId: activeId };
      }),
      
      prevMatch: () => set((state) => {
          if (state.searchMatches.size === 0) return state;
          const matches = Array.from(state.searchMatches);
          const i = state.activeMatchIndex;
          const prevIndex = (i === null || i === undefined || i <= 0) ? matches.length - 1 : i - 1;
          const activeId = matches[prevIndex];
          
          return { activeMatchIndex: prevIndex, activeMatchId: activeId };
      }),

      clearCode: () => {
        const { code: currentCode, setCode } = get();
        // Use setCode to ensure all derived search states are cleared
        setCode('', false);
        set({ dragOverrides: {}, selectedNodeId: null });
      },
      
      resetAllSettings: () => set({ ...defaultSettings, dragOverrides: {} })
    }),
    {
      name: 'json-graph-viewer-settings',
      partialize: (state) => {
        const persistedKeys = [
          ...Object.keys(defaultSettings),
          'codeFormat',
          'isEditorPanelOpen',
          'isAdvancedPanelOpen',
          'apiMethod',
          'apiUrl',
          'apiHeaders',
          'apiBody',
          'activeTab',
          'globalTextExpanded',
          'activePreviewPath'
        ];
        return Object.fromEntries(
          Object.entries(state).filter(([key]) => persistedKeys.includes(key))
        );
      }
    }
  )
);

// Initialize the store immediately
useStore.getState().setCode(useStore.getState().code || initialCode);
