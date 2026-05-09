import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseInput } from '../utils/parser';
import { transformToTree } from '../utils/transformer';

export type LayoutMode = 'vertical' | 'horizontal' | 'radial' | 'force' | 'compact' | 'mindmap';
export type NodeTheme = 'glassmorphism' | 'vscode' | 'github' | 'cyberpunk' | 'minimal' | 'gradient' | 'pastel' | 'terminal' | 'material' | 'blueprint' | 'retro' | 'holographic' | 'notebook';
export type EdgeStyle = 'curved' | 'bezier' | 'straight' | 'step' | 'animated' | 'dashed' | 'neon' | 'double' | 'pipe' | 'thin' | 'orgChart' | 'circuit' | 'glow' | 'zigzag' | 'pulse';
export type NodeShape = 'default' | 'circle' | 'rectangle' | 'triangle' | 'hexagon' | 'pill' | 'diamond' | 'parallelogram';
export type CanvasTheme = 'none' | 'dots' | 'grid' | 'lines';
export type AppTheme = 'dark' | 'light';

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
};

export interface StoreState {
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
  searchQuery: string;
  collapsedNodes: Set<string>;
  searchMatches: Set<string>;
  searchAncestors: Set<string>;
  selectedNodeId: string | null;
  isEditorPanelOpen: boolean;
  isAdvancedPanelOpen: boolean;
  isMobileMenuOpen: boolean;
  isShortcutsOpen: boolean;
  showMediaPreview: boolean;
  dragOverrides: Record<string, { x: number, y: number }>;
  undoStack: string[];
  redoStack: string[];
  
  setCode: (code: string, skipHistory?: boolean) => void;
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
  setSearchQuery: (query: string) => void;
  toggleNodeCollapse: (id: string) => void;
  setCollapsedNodes: (nodes: Set<string>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsEditorPanelOpen: (isOpen: boolean) => void;
  setIsAdvancedPanelOpen: (isOpen: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setIsShortcutsOpen: (isOpen: boolean) => void;
  setShowMediaPreview: (show: boolean) => void;
  setDragOverride: (id: string, pos: { x: number, y: number } | null) => void;
  clearDragOverrides: () => void;
  
  // Resets
  resetAllSettings: () => void;
}

const initialCode = `{
  "project": "JSON Graph Viewer",
  "version": "1.0.0",
  "features": [
    "D3 Integration",
    "React Hooks",
    "Zustand State"
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
      setSearchQuery: (query: string) => {
        set((state) => {
          const q = query.toLowerCase();
          const newCollapsed = new Set(state.collapsedNodes);
          const matches = new Set<string>();
          const ancestors = new Set<string>();
          
          if (!q || !state.treeData) {
            return { searchQuery: query, searchMatches: matches, searchAncestors: ancestors };
          }
          
          const checkNode = (node: any, currentAncestors: string[]): boolean => {
            const matchName = node.name.toLowerCase().includes(q);
            const matchVal = node.value !== undefined && String(node.value).toLowerCase().includes(q);
            const isMatch = matchName || matchVal;
            
            let hasMatchingDescendant = false;
            
            if (node.children) {
               for (const child of node.children) {
                  if (checkNode(child, [...currentAncestors, node.id])) {
                     hasMatchingDescendant = true;
                  }
               }
            }
            
            if (isMatch) {
               matches.add(node.id);
               for (const id of currentAncestors) {
                  ancestors.add(id);
                  newCollapsed.delete(id); // auto expand
               }
            } else if (hasMatchingDescendant) {
               ancestors.add(node.id);
               newCollapsed.delete(node.id);
            }
            
            return isMatch || hasMatchingDescendant;
          };
          
          checkNode(state.treeData, []);
          
          return { searchQuery: query, collapsedNodes: newCollapsed, searchMatches: matches, searchAncestors: ancestors };
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
      setIsEditorPanelOpen: (isOpen: boolean) => set({ isEditorPanelOpen: isOpen }),
      setIsAdvancedPanelOpen: (isOpen: boolean) => set({ isAdvancedPanelOpen: isOpen }),
      setIsMobileMenuOpen: (isOpen: boolean) => set({ isMobileMenuOpen: isOpen }),
      setIsShortcutsOpen: (isOpen: boolean) => set({ isShortcutsOpen: isOpen }),
      setShowMediaPreview: (show: boolean) => set({ showMediaPreview: show }),
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
      
      resetAllSettings: () => set({ ...defaultSettings, dragOverrides: {} })
    }),
    {
      name: 'json-graph-viewer-settings',
      partialize: (state) => {
        const persistedKeys = [
          ...Object.keys(defaultSettings),
          'code',
          'isEditorPanelOpen',
          'isAdvancedPanelOpen'
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
