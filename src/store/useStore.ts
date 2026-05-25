import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseInput } from '../utils/parser';
import { transformToTree } from '../utils/transformer';
import { parseSearchQuery, buildSearchContext, evaluateQuery } from '../utils/searchEngine';

export type LayoutMode = 'vertical' | 'horizontal' | 'radial' | 'force' | 'compact' | 'mindmap';
export type NodeTheme = 'glassmorphism' | 'vscode' | 'github' | 'cyberpunk' | 'minimal' | 'gradient' | 'pastel' | 'terminal' | 'material' | 'blueprint' | 'retro' | 'holographic' | 'notebook' | 'custom' | 'nature' | 'circuit' | 'galaxy' | 'glass' | 'neon' | 'math' | 'neural' | 'river' | 'tree' | 'pixel' | 'hacker' | 'cloud' | 'dna' | 'lava' | 'ocean' | 'rhythm' | 'rune' | 'zen' | 'abstract' | 'architect' | 'ludo' | 'chess' | 'octopus' | 'nature2' | 'hydrogen' | 'seed';
export type EdgeStyle = 'curved' | 'bezier' | 'straight' | 'step' | 'animated' | 'dashed' | 'neon' | 'double' | 'pipe' | 'thin' | 'orgChart' | 'circuit' | 'glow' | 'zigzag' | 'pulse' | 'ludo' | 'chess' | 'octopus' | 'nature2' | 'hydrogen' | 'seed';
export type NodeShape = 'default' | 'circle' | 'rectangle' | 'triangle' | 'hexagon' | 'pill' | 'diamond' | 'parallelogram';
export type CanvasTheme = 'none' | 'dots' | 'grid' | 'lines';
export type AppTheme = 'dark' | 'light';
export type GradientType = 'linear' | 'radial';

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
  showMediaPreview: false,
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
};

export interface StoreState {
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
  selectedNodeId: string | null;
  isEditorPanelOpen: boolean;
  isAdvancedPanelOpen: boolean;
  isMobileMenuOpen: boolean;
  isShortcutsOpen: boolean;
  isMathHelpOpen: boolean;
  showMediaPreview: boolean;
  globalTextExpanded: boolean;
  activePreviewText: string | null;
  activePreviewPath: string | null;
  activePreviewMedia: { url: string; type: 'image' | 'video' | 'audio' | 'smart' | 'pdf' } | null;
  apiMethod: string;
  apiUrl: string;
  apiHeaders: string;
  apiBody: string;
  activeTab: 'raw' | 'api';
  dragOverrides: Record<string, { x: number, y: number }>;
  undoStack: string[];
  redoStack: string[];
  
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
  setGlobalTextExpanded: (expanded: boolean) => void;
  setActivePreviewText: (text: string | null, path?: string | null) => void;
  setActivePreviewMedia: (media: { url: string; type: 'image' | 'video' | 'audio' | 'smart' | 'pdf' } | null) => void;
  updateNodeValue: (path: string, newValue: any) => Promise<void>;
  setDragOverride: (id: string, pos: { x: number, y: number } | null) => void;
  clearDragOverrides: () => void;
  
  isSavedDocsOpen: boolean;
  setIsSavedDocsOpen: (isOpen: boolean) => void;
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
      selectedNodeId: null,
      isEditorPanelOpen: true,
      isAdvancedPanelOpen: false,
      isMobileMenuOpen: false,
      isShortcutsOpen: false,
      isMathHelpOpen: false,
      isSavedDocsOpen: false,
      apiMethod: 'GET',
      apiUrl: 'https://jsonplaceholder.typicode.com/todos/1',
      apiHeaders: '{\n  "Accept": "application/json"\n}',
      apiBody: '',
      activeTab: 'raw',
      dragOverrides: {},
      undoStack: [],
      redoStack: [],

      setCode: (code: string, skipHistory = false) => {
        const currentCode = get().code;
        const { data, error } = parseInput(code);
        let treeData = null;
        if (data !== null) {
            treeData = transformToTree(data);
        }

        if (!skipHistory && code !== currentCode) {
          set((state) => ({
            undoStack: [...state.undoStack, currentCode].slice(-50),
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
        const { undoStack, code } = get();
        if (undoStack.length === 0) return;

        const previousCode = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);

        set((state) => ({
          undoStack: newUndoStack,
          redoStack: [code, ...state.redoStack].slice(0, 50)
        }));

        get().setCode(previousCode, true);
      },

      redo: () => {
        const { redoStack, code } = get();
        if (redoStack.length === 0) return;

        const nextCode = redoStack[0];
        const newRedoStack = redoStack.slice(1);

        set((state) => ({
          redoStack: newRedoStack,
          undoStack: [...state.undoStack, code].slice(-50)
        }));

        get().setCode(nextCode, true);
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
      setNodeColor: (color: string) => set({ nodeColor: color }),
      setNodeTextColor: (color: string) => set({ nodeTextColor: color }),
      setNodeGradientColor1: (color: string) => set({ nodeGradientColor1: color }),
      setNodeGradientColor2: (color: string) => set({ nodeGradientColor2: color }),
      setUseNodeGradient: (use: boolean) => set({ useNodeGradient: use }),
      setNodeGradientAngle: (angle: number) => set({ nodeGradientAngle: angle }),
      setNodeGradientType: (type: GradientType) => set({ nodeGradientType: type }),
      setSearchEngineMode: (mode: SearchEngineMode) => {
        set({ searchEngineMode: mode });
        get().setSearchQuery(get().searchQuery); // trigger re-evaluation
      },
      setSearchQuery: (query: string) => {
        set((state) => {
          const q = query.trim();
          const newCollapsed = new Set(state.collapsedNodes);
          const matches = new Set<string>();
          const ancestors = new Set<string>();
          
          if (!q || !state.treeData) {
            return { searchQuery: query, searchMatches: matches, searchAncestors: ancestors, globalSearchErrors: [], globalSearchSuggestions: [] };
          }
          
          const parseRes = parseSearchQuery(q);
          if (parseRes.syntaxError) {
             return { searchQuery: query, searchMatches: matches, searchAncestors: ancestors, globalSearchErrors: [parseRes.syntaxError], globalSearchSuggestions: [] };
          }
          
          const globalErrors = new Set<string>();
          const globalSuggestions = new Set<string>();
          
          const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
            let isMatch = false;
            let handledMatches = false;
            
            if (parseRes.ast) {
               const context = buildSearchContext(node, depth);
               context.mode = get().searchEngineMode;
               const evalRes = evaluateQuery(parseRes.ast, context);
               isMatch = evalRes.isMatch;
               
               if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
                   handledMatches = true;
                   for (const p of evalRes.matchedPaths) {
                       matches.add(p);
                       
                       const parts = p.match(/root|\[\d+\]|[^.\[]+/g) || [];
                       let temp = '';
                       for (let i = 0; i < parts.length; i++) {
                           let part = parts[i];
                           if (i > 0 && part !== 'root' && !part.startsWith('[')) {
                               temp += '.' + part;
                           } else {
                               temp += part;
                           }
                           ancestors.add(temp);
                           newCollapsed.delete(temp);
                       }
                   }
                   for (const c of currentAncestors) {
                       ancestors.add(c);
                       newCollapsed.delete(c);
                   }
                   ancestors.add(node.id);
                   newCollapsed.delete(node.id);
               }
               
               // Only collect suggestions from AST evaluation, not strict traversal errors
               // Strict traversal errors on partial structural mismatches are too noisy for global search
               for (const sug of evalRes.suggestions) globalSuggestions.add(sug);
            } else {
               // Fallback basic exact
               const qLower = q.toLowerCase();
               const matchName = node.name.toLowerCase().includes(qLower);
               const matchVal = node.value !== undefined && String(node.value).toLowerCase().includes(qLower);
               isMatch = matchName || matchVal;
            }
            
            let hasMatchingDescendant = false;
            
            if (node.children) {
               for (const child of node.children) {
                  if (checkNode(child, [...currentAncestors, node.id], depth + 1)) {
                     hasMatchingDescendant = true;
                  }
               }
            }
            
            if (isMatch && !handledMatches) {
               matches.add(node.id);
               for (const id of currentAncestors) {
                  ancestors.add(id);
                  newCollapsed.delete(id); // auto expand
               }
            } else if (hasMatchingDescendant) {
               ancestors.add(node.id);
               newCollapsed.delete(node.id); // ensure path is open
            }
            
            return isMatch || hasMatchingDescendant;
          };
          
          checkNode(state.treeData, [], 0);
          
          return { 
             searchQuery: query, 
             collapsedNodes: newCollapsed, 
             searchMatches: matches, 
             searchAncestors: ancestors,
             globalSearchErrors: Array.from(globalErrors),
             globalSearchSuggestions: Array.from(globalSuggestions)
          };
        });
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
      setGlobalTextExpanded: (expanded: boolean) => set({ globalTextExpanded: expanded }),
      setActivePreviewText: (text, path = null) => set({ activePreviewText: text, activePreviewPath: path }),
      setActivePreviewMedia: (media) => set({ activePreviewMedia: media }),
      
      updateNodeValue: async (path, newValue) => {
        const { parsedData, code, setCode } = get();
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
        const isYaml = code.trim().startsWith('{') === false && code.trim().startsWith('[') === false;

        let newCode = '';
        if (isYaml) {
          try {
            const yaml = (await import('js-yaml')).default;
            newCode = yaml.dump(newData);
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
      clearDragOverrides: () => set({ dragOverrides: {} }),
      
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
