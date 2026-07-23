import { create } from "zustand";
import { startTransition } from "react";
import { persist } from "zustand/middleware";
import { parseInput } from "../utils/parser";
import { transformToTree } from "../utils/transformer";

import { sanitizeWorkspaceData } from "../utils/workspaceSanitizer";
import SearchWorker from "../utils/searchWorker?worker";



let searchWorkerInstance: Worker | null = null;
if (typeof window !== "undefined") {
  searchWorkerInstance = new SearchWorker();
}

export type LayoutMode =
  | "vertical"
  | "horizontal"
  | "radial"
  | "force"
  | "compact"
  | "mindmap";
export type NodeTheme =
  | "glassmorphism"
  | "vscode"
  | "github"
  | "cyberpunk"
  | "minimal"
  | "gradient"
  | "pastel"
  | "terminal"
  | "material"
  | "blueprint"
  | "retro"
  | "holographic"
  | "notebook"
  | "custom"
  | "nature"
  | "circuit"
  | "galaxy"
  | "glass"
  | "neon"
  | "math"
  | "neural"
  | "river"
  | "tree"
  | "pixel"
  | "hacker"
  | "cloud"
  | "dna"
  | "lava"
  | "ocean"
  | "rhythm"
  | "rune"
  | "zen"
  | "abstract"
  | "architect"
  | "ludo"
  | "chess"
  | "octopus"
  | "nature2"
  | "hydrogen"
  | "seed"
  | "banyan"
  | "peepal";
export type EdgeStyle =
  | "curved"
  | "bezier"
  | "straight"
  | "step"
  | "animated"
  | "dashed"
  | "neon"
  | "double"
  | "pipe"
  | "thin"
  | "orgChart"
  | "circuit"
  | "glow"
  | "zigzag"
  | "pulse"
  | "ludo"
  | "chess"
  | "octopus"
  | "nature2"
  | "hydrogen"
  | "seed"
  | "metro"
  | "angled-step";
export type NodeShape =
  | "default"
  | "circle"
  | "rectangle"
  | "triangle"
  | "hexagon"
  | "pill"
  | "diamond"
  | "parallelogram";
export type CanvasTheme = "none" | "dots" | "grid" | "lines";
export type AppTheme = "dark" | "light";
export type GradientType = "linear" | "radial";
export type VisualizerMode = "graph" | "schema";

export type SearchEngineMode = "strict" | "permissive";

// Default settings
export const defaultSettings = {
  layoutMode: "horizontal" as LayoutMode,
  nodeTheme: "vscode" as NodeTheme,
  edgeStyle: "curved" as EdgeStyle,
  nodeShape: "default" as NodeShape,
  canvasTheme: "none" as CanvasTheme,
  appTheme: "dark" as AppTheme,
  canvasBackgroundColor: "rgba(13, 17, 23, 1)",
  canvasPatternColor: "rgba(148, 163, 184, 0.15)",
  canvasBackgroundImage: "",
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
  nodeColor: "rgba(30, 41, 59, 1)",
  nodeTextColor: "rgba(255, 255, 255, 1)",
  nodeGradientColor1: "rgba(79, 70, 229, 1)",
  nodeGradientColor2: "rgba(147, 51, 234, 1)",
  useNodeGradient: false,
  nodeGradientAngle: 45,
  nodeGradientType: "linear" as GradientType,
  searchEngineMode: "permissive" as SearchEngineMode,
  isAutosaveEnabled: true,
  visualizerMode: "graph" as VisualizerMode,
  activeDocumentId: null as number | null,
  activeDocumentName: null as string | null,
  isDirty: false,
  lastSavedCode: null as string | null,
  stickyNotesEnabled: false,
};

export type CodeFormat = "json" | "yaml";

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

export interface WorkspaceTab {
  path: string;
  isPreview: boolean;
  isDirty: boolean;
}

export interface StoreState {
  codeFormat: CodeFormat;
  setCodeFormat: (format: CodeFormat) => void;
  convertFormat: (targetFormat: CodeFormat) => Promise<void>;
  
  // Workspace Tabs mapping
  workspaceTabs: WorkspaceTab[];
  setWorkspaceTabs: (tabs: WorkspaceTab[]) => void;
  openWorkspaceTab: (path: string, asPreview?: boolean) => void;
  closeWorkspaceTab: (path: string) => void;
  markWorkspaceTabDirty: (path: string, dirty: boolean) => void;
  
  // Multi-select Explorer State
  updateWorkspaceTabPath: (oldPath: string, newPath: string) => void;
  closeWorkspaceTabs: (paths: string[]) => void;

  selectedExplorerFiles: string[];
  setSelectedExplorerFiles: (paths: string[] | ((prev: string[]) => string[])) => void;

  inlineApiEditor: {
    url: string;
    path: string;
    nodeId: string;
    x: number;
    y: number;
    width: number;
  } | null;
  setInlineApiEditor: (
    editor: {
      url: string;
      path: string;
      nodeId: string;
      x: number;
      y: number;
      width: number;
    } | null,
  ) => void;
  apiNodeConfig: Record<
    string,
    { method: string; responseType: string; timeout: number }
  >;
  setApiNodeConfig: (
    path: string,
    config: { method: string; responseType: string; timeout: number },
  ) => void;
  apiNodeResponses: Record<string, any>;
  apiNodeLoading: Record<string, boolean>;
  apiNodeErrors: Record<string, ApiNodeDiagnosticError | null>;
  setApiNodeResponse: (path: string, data: any) => void;
  setApiNodeLoading: (path: string, loading: boolean) => void;
  setApiNodeError: (path: string, error: ApiNodeDiagnosticError | null) => void;
  removeApiNode: (path: string) => void;

  jsNodeResponses: Record<string, any>;
  jsNodeLoading: Record<string, boolean>;
  jsNodeErrors: Record<string, string | null>;
  jsNodeDurations: Record<string, number>;
  jsNodeLastRuns: Record<string, string>;
  nodeSizes: Record<string, { width: number; height: number }>;
  setCustomNodeSize: (id: string, width: number, height: number) => void;
  autoClearLogs: boolean;
  setAutoClearLogs: (val: boolean) => void;
  jsNodeLogs: Record<string, any[]>;
  jsNodeVisibility: Record<string, { code: boolean; terminal: boolean }>;
  jsNodeCodeOverrides: Record<string, string>;
  jsNodeFocusLine: { path: string; line: number; column?: number } | null;
  setJsNodeFocusLine: (path: string | null, line?: number, column?: number) => void;
  setJsNodeResponse: (path: string, data: any) => void;
  setJsNodeLoading: (path: string, loading: boolean) => void;
  setJsNodeError: (path: string, error: string | null) => void;
  setJsNodeLogs: (path: string, logs: any[] | ((prev: any[]) => any[])) => void;
  setJsNodeRunMetadata: (path: string, duration: number, lastRun: string) => void;
  toggleJsNodeVisibility: (
    path: string,
    type: "code" | "terminal",
    forceState?: boolean,
  ) => void;
  setJsNodeCodeOverride: (path: string, code: string) => void;
  removeJsNode: (path: string) => void;
  expandedJsNodeId: string | null;
  setExpandedJsNodeId: (id: string | null) => void;

  activePrompts: Record<string, { sessionId: string; promptText?: string; defaultValue?: string; type: "input" | "prompt" | "confirm" | "alert" } | null>;
  setActivePrompt: (
    path: string,
    prompt: { sessionId: string; promptText?: string; defaultValue?: string; type: "input" | "prompt" | "confirm" | "alert" } | null,
  ) => void;

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
  isYoutubeSearchOpen: boolean;
  activeDocumentId: number | null;
  activeDocumentName: string | null;
  isDirty: boolean;
  lastSavedCode: string | null;
  setActiveDocumentId: (id: number | null) => void;
  setActiveDocumentName: (name: string | null) => void;
  setIsDirty: (isDirty: boolean) => void;
  setLastSavedCode: (code: string | null) => void;
  showMediaPreview: boolean;
  manuallyRenderedNodes: Record<string, boolean>;
  globalTextExpanded: boolean;
  activePreviewText: string | null;
  activePreviewPath: string | null;
  activePreviewMedia: {
    url: string;
    type: "image" | "video" | "audio" | "smart" | "pdf" | "3d-model";
  } | null;
  knownDataUrls: Record<string, "json" | "xml" | "csv">;
  setKnownDataUrl: (url: string, type: "json" | "xml" | "csv") => void;
  apiMethod: string;
  apiUrl: string;
  apiHeaders: string;
  apiBody: string;
  activeTab: "raw" | "gui" | "api" | "explorer";
  dragOverrides: Record<string, { x: number; y: number }>;
  undoStack: { code: string; format: CodeFormat }[];
  redoStack: { code: string; format: CodeFormat }[];

  setCode: (code: string, skipHistory?: boolean) => void;
  setApiMethod: (method: string) => void;
  setApiUrl: (url: string) => void;
  setApiHeaders: (headers: string) => void;
  setApiBody: (body: string) => void;
  setActiveTab: (tab: "raw" | "gui" | "api" | "explorer") => void;
  explorerExpandedPaths: Record<string, boolean>;
  setExplorerExpandedPath: (path: string, isExpanded: boolean) => void;
  setAllExplorerExpandedPaths: (paths: Record<string, boolean>) => void;
  activeExplorerFile: string | null;
  setActiveExplorerFile: (path: string | null) => void;
  explorerSearchQuery: string;
  setExplorerSearchQuery: (q: string) => void;
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
  setIsYoutubeSearchOpen: (isOpen: boolean) => void;
  setShowMediaPreview: (show: boolean) => void;
  toggleManualMediaRender: (nodeId: string) => void;
  setGlobalTextExpanded: (expanded: boolean) => void;
  setActivePreviewText: (text: string | null, path?: string | null) => void;
  setActivePreviewMedia: (
    media: {
      url: string;
      type: "image" | "video" | "audio" | "smart" | "pdf" | "3d-model";
    } | null,
  ) => void;
  updateNodeValue: (path: string, newValue: any) => Promise<void>;
  setDragOverride: (id: string, pos: { x: number; y: number } | null) => void;
  setMultipleDragOverrides: (
    overrides: Record<string, { x: number; y: number } | null>,
  ) => void;
  clearDragOverrides: () => void;
  autoOrganizeTrigger: number;
  triggerAutoOrganize: () => void;

  pendingImport: {
    filename: string;
    text?: string;
    dataExcel?: any;
    fileContext?: "media" | "data" | "unknown";
    mimeType?: string;
    blobUrl?: string;
    fileSize?: number;
    assetId?: string;
    thumbnailId?: string;
  } | null;
  setPendingImport: (
    importData: {
      filename: string;
      text?: string;
      dataExcel?: any;
      fileContext?: "media" | "data" | "unknown";
      mimeType?: string;
      blobUrl?: string;
      fileSize?: number;
      assetId?: string;
      thumbnailId?: string;
    } | null,
  ) => void;

  isFileProcessing: boolean;
  setFileProcessing: (processing: boolean) => void;

  uploadedMediaMetadata: Record<
    string,
    { filename: string; mimeType: string; size: number }
  >;
  registerMediaMetadata: (
    url: string,
    metadata: { filename: string; mimeType: string; size: number },
  ) => void;

  notification: { message: string; type: "error" | "success" | "info" | "warning" } | null;
  setNotification: (
    notification: {
      message: string;
      type: "error" | "success" | "info" | "warning";
    } | null,
  ) => void;
  isSavedDocsOpen: boolean;
  setIsSavedDocsOpen: (isOpen: boolean) => void;
  stickyNotesEnabled: boolean;
  setStickyNotesEnabled: (enabled: boolean) => void;
  schemaExportActive: boolean;
  setSchemaExportActive: (active: boolean) => void;
  // Resets
  resetAllSettings: () => void;
  clearCode: () => void;
}

const initialCode = `{
  "project": "JSON Visual Node Engine",
  "version": "2.0.0",
  "dataSources": {
     "my_data_api_node": "https://api.github.com/users",
     "transform_users_js_node": "// JS calculation node executing!\\n// Namaste",
     "typescript_filtering_ts_node": "const greet: string = 'Hello from TypeSafe compiling!';\\n// greet\\n// Namaste"
  },
  "settings": {
    "theme": "dark",
    "advancedPipelines": true
  }
}`;

const initialParsedData = JSON.parse(initialCode);

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      // Expose for debugging
      if (typeof window !== "undefined") {
        (window as any).useStore = { getState: get, setState: set };
      }
      return {
      ...defaultSettings,
      code: initialCode,
      globalSearchErrors: [],
      globalSearchSuggestions: [],
      parsedData: initialParsedData,
      treeData: transformToTree(initialParsedData, "root", "root", {}, {}, {}),
      error: null,
      searchQuery: "",
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
      isYoutubeSearchOpen: false,
      isSavedDocsOpen: false,
      pendingImport: null,
      setPendingImport: (importData) => set({ pendingImport: importData }),

      isFileProcessing: false,
      setFileProcessing: (processing) => set({ isFileProcessing: processing }),

      uploadedMediaMetadata: {},
      registerMediaMetadata: (url, metadata) =>
        set((state) => ({
          uploadedMediaMetadata: {
            ...state.uploadedMediaMetadata,
            [url]: metadata,
          },
        })),

      notification: null,
      setNotification: (notification) => set({ notification }),

      schemaExportActive: false,
      setSchemaExportActive: (active: boolean) =>
        set({ schemaExportActive: active }),
      apiMethod: "GET",
      apiUrl: "https://jsonplaceholder.typicode.com/todos/1",
      apiHeaders: '{\n  "Accept": "application/json"\n}',
      apiBody: "",
      activeTab: "raw",
      explorerExpandedPaths: {},
      activeExplorerFile: null,

      workspaceTabs: [],
      setWorkspaceTabs: (tabs) => set({ workspaceTabs: tabs }),
      openWorkspaceTab: (path, asPreview = true) =>
        set((s) => {
          let tabs = [...s.workspaceTabs];
          const existing = tabs.find(t => t.path === path);
          if (existing) {
            if (!asPreview) existing.isPreview = false;
          } else {
            // If adding preview, replace any existing preview tab
            if (asPreview) {
              const previewIndex = tabs.findIndex(t => t.isPreview);
              if (previewIndex !== -1) {
                tabs[previewIndex] = { path, isPreview: true, isDirty: false };
              } else {
                tabs.push({ path, isPreview: true, isDirty: false });
              }
            } else {
              tabs.push({ path, isPreview: false, isDirty: false });
            }
          }

          // Expand contains/parent folders for the path
          const explorerExpandedPaths = { ...s.explorerExpandedPaths };
          if (path) {
            const parts = path.split(".");
            if (parts.length > 2) {
              for (let i = 2; i < parts.length; i++) {
                const parentPath = parts.slice(0, i).join(".");
                explorerExpandedPaths[parentPath] = true;
              }
            }
          }

          return { workspaceTabs: tabs, activeExplorerFile: path, selectedExplorerFiles: [path], explorerExpandedPaths };
        }),
      closeWorkspaceTab: (path) =>
        set((s) => {
          const tabs = s.workspaceTabs.filter(t => t.path !== path);
          let active = s.activeExplorerFile;
          // If closing the active tab, pick the adjacent one
          if (active === path) {
            if (tabs.length > 0) active = tabs[tabs.length - 1].path;
            else active = null;
          }
          return { workspaceTabs: tabs, activeExplorerFile: active, selectedExplorerFiles: active ? [active] : [], expandedJsNodeId: active };
        }),
      markWorkspaceTabDirty: (path, dirty) =>
        set((s) => {
          const tabs = s.workspaceTabs.map(t => {
            if (t.path === path) {
              return { ...t, isDirty: dirty, isPreview: dirty ? false : t.isPreview };
            }
            return t;
          });
          return { workspaceTabs: tabs };
        }),
      updateWorkspaceTabPath: (oldPath, newPath) =>
        set((s) => {
          const tabs = s.workspaceTabs.map(t => {
            if (t.path === oldPath) {
              return { ...t, path: newPath };
            } else if (t.path.startsWith(oldPath + ".")) {
              return { ...t, path: t.path.replace(oldPath, newPath) };
            }
            return t;
          });
          let active = s.activeExplorerFile;
          if (active === oldPath) active = newPath;
          else if (active?.startsWith(oldPath + ".")) active = active.replace(oldPath, newPath);
          
          let expandedJsNodeId = s.expandedJsNodeId;
          if (expandedJsNodeId === oldPath) expandedJsNodeId = newPath;
          else if (expandedJsNodeId?.startsWith(oldPath + ".")) expandedJsNodeId = expandedJsNodeId.replace(oldPath, newPath);
          
          return { workspaceTabs: tabs, activeExplorerFile: active, selectedExplorerFiles: active ? [active] : [], expandedJsNodeId };
        }),
      closeWorkspaceTabs: (paths) =>
        set((s) => {
          const pathSet = new Set(paths);
          const tabs = s.workspaceTabs.filter(t => !pathSet.has(t.path) && !paths.some(p => t.path.startsWith(p + ".")));
          let active = s.activeExplorerFile;
          if (active && (pathSet.has(active) || paths.some(p => active!.startsWith(p + ".")))) {
            if (tabs.length > 0) active = tabs[tabs.length - 1].path;
            else active = null;
          }
          return { workspaceTabs: tabs, activeExplorerFile: active, selectedExplorerFiles: active ? [active] : [], expandedJsNodeId: active };
        }),

      selectedExplorerFiles: [],
      setSelectedExplorerFiles: (paths) =>
        set((s) => ({
          selectedExplorerFiles: typeof paths === 'function' ? paths(s.selectedExplorerFiles) : paths
        })),

      explorerSearchQuery: "",
      dragOverrides: {},
      undoStack: [],
      redoStack: [],
      inlineApiEditor: null,
      setInlineApiEditor: (editor) => set({ inlineApiEditor: editor }),
      apiNodeConfig: {},
      setApiNodeConfig: (path, config) =>
        set((s) => ({ apiNodeConfig: { ...s.apiNodeConfig, [path]: config } })),

      apiNodeResponses: {},
      apiNodeLoading: {},
      apiNodeErrors: {},
      setApiNodeResponse: (path: string, data: any) => {
        set((s) => {
          const res = { ...s.apiNodeResponses, [path]: data };
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(
              s.parsedData,
              "root",
              "root",
              res,
              s.jsNodeResponses,
            );
          }
          return { apiNodeResponses: res, treeData };
        });
      },
      setApiNodeLoading: (path: string, loading: boolean) =>
        set((s) => ({
          apiNodeLoading: { ...s.apiNodeLoading, [path]: loading },
        })),
      setApiNodeError: (path: string, error: ApiNodeDiagnosticError | null) =>
        set((s) => ({ apiNodeErrors: { ...s.apiNodeErrors, [path]: error } })),
      removeApiNode: (path: string) =>
        set((s) => {
          const res = { ...s.apiNodeResponses };
          delete res[path];
          const loading = { ...s.apiNodeLoading };
          delete loading[path];
          const errors = { ...s.apiNodeErrors };
          delete errors[path];
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(
              s.parsedData,
              "root",
              "root",
              res,
              s.jsNodeResponses,
              s.jsNodeVisibility,
            );
          }
          return {
            apiNodeResponses: res,
            apiNodeLoading: loading,
            apiNodeErrors: errors,
            treeData,
          };
        }),

      jsNodeResponses: {},
      jsNodeLoading: {},
      jsNodeErrors: {},
      jsNodeDurations: {},
      jsNodeLastRuns: {},
      nodeSizes: {},
      autoClearLogs: true,
      setAutoClearLogs: (val) => set({ autoClearLogs: val }),
      setCustomNodeSize: (id, width, height) =>
        set((state) => ({
          nodeSizes: { ...state.nodeSizes, [id]: { width, height } },
        })),
      jsNodeLogs: {},
      jsNodeVisibility: {},
      jsNodeCodeOverrides: {},
      jsNodeFocusLine: null,
      setJsNodeFocusLine: (path, line, column) =>
        set({ jsNodeFocusLine: path ? { path, line: line!, column } : null }),
      expandedJsNodeId: null,
      setExpandedJsNodeId: (id: string | null) =>
        set((s) => {
          const stateUpdate: any = { expandedJsNodeId: id };
          if (id) {
            let tabs = [...s.workspaceTabs];
            const existing = tabs.find(t => t.path === id);
            if (!existing) {
              // Add a preview tab
              const previewIndex = tabs.findIndex(t => t.isPreview);
              if (previewIndex !== -1) {
                tabs[previewIndex] = { path: id, isPreview: true, isDirty: false };
              } else {
                tabs.push({ path: id, isPreview: true, isDirty: false });
              }
            }
            stateUpdate.workspaceTabs = tabs;
            stateUpdate.activeExplorerFile = id;
            stateUpdate.selectedExplorerFiles = [id];

            // Automatically expand parent folders
            const explorerExpandedPaths = { ...s.explorerExpandedPaths };
            const parts = id.split(".");
            if (parts.length > 2) {
              for (let i = 2; i < parts.length; i++) {
                const parentPath = parts.slice(0, i).join(".");
                explorerExpandedPaths[parentPath] = true;
              }
            }
            stateUpdate.explorerExpandedPaths = explorerExpandedPaths;
          }
          return stateUpdate;
        }),
      activePrompts: {},
      setActivePrompt: (path, prompt) =>
        set((s) => ({
          activePrompts: { ...s.activePrompts, [path]: prompt },
        })),
      setJsNodeRunMetadata: (path: string, duration: number, lastRun: string) => {
        set((s) => ({
          jsNodeDurations: { ...s.jsNodeDurations, [path]: duration },
          jsNodeLastRuns: { ...s.jsNodeLastRuns, [path]: lastRun },
        }));
      },
      setJsNodeResponse: (path: string, data: any) => {
        set((s) => {
          const res = { ...s.jsNodeResponses, [path]: data };
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(
              s.parsedData,
              "root",
              "root",
              s.apiNodeResponses,
              res,
              s.jsNodeVisibility,
            );
          }
          return { jsNodeResponses: res, treeData };
        });
      },
      setJsNodeLoading: (path: string, loading: boolean) =>
        set((s) => ({
          jsNodeLoading: { ...s.jsNodeLoading, [path]: loading },
        })),
      setJsNodeError: (path: string, error: string | null) =>
        set((s) => ({ jsNodeErrors: { ...s.jsNodeErrors, [path]: error } })),
      setJsNodeLogs: (
        path: string,
        logsAction: any[] | ((prev: any[]) => any[]),
      ) =>
        set((s) => ({
          jsNodeLogs: {
            ...s.jsNodeLogs,
            [path]:
              typeof logsAction === "function"
                ? logsAction(s.jsNodeLogs[path] || [])
                : logsAction,
          },
        })),
      toggleJsNodeVisibility: (
        path: string,
        type: "code" | "terminal",
        forceState?: boolean,
      ) =>
        set((s) => {
          const current = s.jsNodeVisibility[path] || {
            code: true,
            terminal: true,
          };
          const nextState =
            forceState !== undefined ? forceState : !current[type];
          if (current[type] === nextState) return {}; // no change
          const nextVis = {
            ...s.jsNodeVisibility,
            [path]: { ...current, [type]: nextState },
          };
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(
              s.parsedData,
              "root",
              "root",
              s.apiNodeResponses,
              s.jsNodeResponses,
              nextVis,
            );
          }
          return { jsNodeVisibility: nextVis, treeData };
        }),
      setJsNodeCodeOverride: (path: string, code: string) =>
        set((s) => ({
          jsNodeCodeOverrides: { ...s.jsNodeCodeOverrides, [path]: code },
        })),
      removeJsNode: (path: string) =>
        set((s) => {
          const res = { ...s.jsNodeResponses };
          delete res[path];
          const loading = { ...s.jsNodeLoading };
          delete loading[path];
          const errors = { ...s.jsNodeErrors };
          delete errors[path];
          const logs = { ...s.jsNodeLogs };
          delete logs[path];
          let treeData = null;
          if (s.parsedData !== null) {
            treeData = transformToTree(
              s.parsedData,
              "root",
              "root",
              s.apiNodeResponses,
              res,
              s.jsNodeVisibility,
            );
          }
          return {
            jsNodeResponses: res,
            jsNodeLoading: loading,
            jsNodeErrors: errors,
            jsNodeLogs: logs,
            treeData,
          };
        }),

      codeFormat: "json",
      setCodeFormat: (format: CodeFormat) => set({ codeFormat: format }),
      convertFormat: async (targetFormat: CodeFormat) => {
        const { parsedData, codeFormat, setCode } = get();
        if (!parsedData || codeFormat === targetFormat) return;

        let newCode = "";
        if (targetFormat === "yaml") {
          try {
            const yaml = (await import("js-yaml")).default;
            newCode = yaml.dump(parsedData);
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
        const {
          apiNodeResponses,
          jsNodeResponses,
          jsNodeVisibility,
          codeFormat,
        } = get();
        const { data, error } = parseInput(code);
        let treeData = null;
        if (data !== null) {
          treeData = transformToTree(
            data,
            "root",
            "root",
            apiNodeResponses,
            jsNodeResponses,
            jsNodeVisibility,
          );
        }

        if (!skipHistory && code !== currentCode) {
          set((state) => ({
            undoStack: [
              ...state.undoStack,
              { code: currentCode, format: codeFormat },
            ].slice(-50),
            redoStack: [],
          }));
        }

        const isDirtyComputed = get().lastSavedCode !== null ? code !== get().lastSavedCode : true;

        set({ code, parsedData: data, error, treeData, isDirty: isDirtyComputed });
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
          redoStack: [{ code, format: codeFormat }, ...state.redoStack].slice(
            0,
            50,
          ),
          codeFormat: previousState.format,
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
          undoStack: [...state.undoStack, { code, format: codeFormat }].slice(
            -50,
          ),
          codeFormat: nextState.format,
        }));

        get().setCode(nextState.code, true);
      },
      setLayoutMode: (mode: LayoutMode) =>
        set({ layoutMode: mode, dragOverrides: {} }),
      setNodeTheme: (theme: NodeTheme) => set({ nodeTheme: theme }),
      setEdgeStyle: (style: EdgeStyle) => set({ edgeStyle: style }),
      setNodeShape: (shape: NodeShape) =>
        set({ nodeShape: shape, dragOverrides: {} }),
      setCanvasTheme: (theme: CanvasTheme) => set({ canvasTheme: theme }),
      setAppTheme: (theme: AppTheme) => set({ appTheme: theme }),
      setCanvasBackgroundColor: (color: string) =>
        set({ canvasBackgroundColor: color }),
      setCanvasPatternColor: (color: string) =>
        set({ canvasPatternColor: color }),
      setCanvasBackgroundImage: (url: string) =>
        set({ canvasBackgroundImage: url }),
      setCanvasBackgroundBlur: (blur: number) =>
        set({ canvasBackgroundBlur: blur }),
      setNodeSpread: (spread: number) =>
        set({ nodeSpread: spread, dragOverrides: {} }),
      setNodeSize: (size: number) => set({ nodeSize: size, dragOverrides: {} }),
      setEdgeWidth: (width: number) => set({ edgeWidth: width }),
      setNodeColor: (color: string) => set({ nodeColor: color }),
      setNodeTextColor: (color: string) => set({ nodeTextColor: color }),
      setNodeGradientColor1: (color: string) =>
        set({ nodeGradientColor1: color }),
      setNodeGradientColor2: (color: string) =>
        set({ nodeGradientColor2: color }),
      setUseNodeGradient: (use: boolean) => set({ useNodeGradient: use }),
      setNodeGradientAngle: (angle: number) =>
        set({ nodeGradientAngle: angle }),
      setNodeGradientType: (type: GradientType) =>
        set({ nodeGradientType: type }),
      setVisualizerMode: (mode: VisualizerMode) =>
        set({ visualizerMode: mode }),
      setIsAutosaveEnabled: (enabled: boolean) =>
        set({ isAutosaveEnabled: enabled }),
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
              activeMatchId: null,
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
                e.data.newCollapsedPaths.forEach((p: string) =>
                  newCollapsed.delete(p),
                );

                set({
                  searchQuery: query,
                  collapsedNodes: newCollapsed,
                  searchMatches: new Set(e.data.matches),
                  searchAncestors: new Set(e.data.ancestors),
                  globalSearchErrors: e.data.globalErrors,
                  globalSearchSuggestions: e.data.globalSuggestions,
                  activeMatchIndex: e.data.activeIndex,
                  activeMatchId: e.data.activeId,
                });
              });
            }
          };

          searchWorkerInstance.postMessage({
            query: query,
            treeData: state.treeData,
            searchEngineMode: state.searchEngineMode,
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
      setActiveTab: (tab: "raw" | "gui" | "api" | "explorer") => set({ activeTab: tab }),
      setExplorerExpandedPath: (path: string, isExpanded: boolean) =>
        set((state) => ({
          explorerExpandedPaths: {
            ...state.explorerExpandedPaths,
            [path]: isExpanded,
          },
        })),
      setAllExplorerExpandedPaths: (paths: Record<string, boolean>) =>
        set({ explorerExpandedPaths: paths }),
      setActiveExplorerFile: (path: string | null) =>
        set({ activeExplorerFile: path }),
      setExplorerSearchQuery: (q: string) =>
        set({ explorerSearchQuery: q }),
      resetApiConfig: () =>
        set({
          apiMethod: "GET",
          apiUrl: "https://jsonplaceholder.typicode.com/todos/1",
          apiHeaders: '{\n  "Accept": "application/json"\n}',
          apiBody: "",
        }),
      setIsEditorPanelOpen: (isOpen: boolean) =>
        set({ isEditorPanelOpen: isOpen }),
      setIsAdvancedPanelOpen: (isOpen: boolean) =>
        set({ isAdvancedPanelOpen: isOpen }),
      setIsMobileMenuOpen: (isOpen: boolean) =>
        void set({ isMobileMenuOpen: isOpen }),
      setIsShortcutsOpen: (isOpen: boolean) =>
        void set({ isShortcutsOpen: isOpen }),
      setIsMathHelpOpen: (isOpen: boolean) => set({ isMathHelpOpen: isOpen }),
      setIsYoutubeSearchOpen: (isOpen: boolean) => set({ isYoutubeSearchOpen: isOpen }),
      setIsSavedDocsOpen: (isOpen: boolean) => set({ isSavedDocsOpen: isOpen }),
      setStickyNotesEnabled: (enabled: boolean) => set({ stickyNotesEnabled: enabled }),
      setActiveDocumentId: (id: number | null) => set({ activeDocumentId: id }),
      setActiveDocumentName: (name: string | null) => set({ activeDocumentName: name }),
      setIsDirty: (isDirty: boolean) => set({ isDirty }),
      setLastSavedCode: (code: string | null) => set({ lastSavedCode: code }),
      setShowMediaPreview: (show: boolean) => set({ showMediaPreview: show, manuallyRenderedNodes: {} }),
      toggleManualMediaRender: (nodeId: string) =>
        set((state) => {
          const currentVal =
            state.manuallyRenderedNodes[nodeId] !== undefined
              ? state.manuallyRenderedNodes[nodeId]
              : state.showMediaPreview;
          return {
            manuallyRenderedNodes: {
              ...state.manuallyRenderedNodes,
              [nodeId]: !currentVal,
            },
          };
        }),
      setGlobalTextExpanded: (expanded: boolean) =>
        set({ globalTextExpanded: expanded }),
      setActivePreviewText: (text, path = null) =>
        set({ activePreviewText: text, activePreviewPath: path }),
      setActivePreviewMedia: (media) => set({ activePreviewMedia: media }),
      knownDataUrls: {},
      setKnownDataUrl: (url, type) =>
        set((state) => ({
          knownDataUrls: { ...state.knownDataUrls, [url]: type },
        })),

      updateNodeValue: async (path, newValue) => {
        const { parsedData, code, setCode, codeFormat } = get();
        if (!parsedData) return;

        // Path is like 'root.key.subkey' or 'root[0].key'
        const parts = path
          .replace(/^root\.?/, "")
          .split(/\.|(?=\[)/)
          .filter(Boolean);

        // Verify if the path actually exists in the original parsedData first:
        let checkCurrent = parsedData;
        let exists = true;
        for (let i = 0; i < parts.length; i++) {
          let part = parts[i];
          if (part.startsWith("[")) {
            part = part.slice(1, -1);
            if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
              part = part.slice(1, -1);
            }
          }
          if (checkCurrent === null || checkCurrent === undefined || typeof checkCurrent !== "object" || !(part in checkCurrent)) {
            exists = false;
            break;
          }
          checkCurrent = (checkCurrent as any)[part];
        }

        if (!exists) {
          console.warn("updateNodeValue: Path does not exist in parsedData, ignoring update to prevent resurrection or errors.", path);
          return;
        }

        // Clone parsedData
        let newData = JSON.parse(JSON.stringify(parsedData));

        let current = newData;
        for (let i = 0; i < parts.length - 1; i++) {
          let part = parts[i];
          if (part.startsWith("[")) {
            part = part.slice(1, -1);
            if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
              part = part.slice(1, -1);
            }
          }
          current = current[part];
        }

        if (parts.length > 0) {
          let lastPart = parts[parts.length - 1];
          if (lastPart.startsWith("[")) {
            lastPart = lastPart.slice(1, -1);
            if ((lastPart.startsWith('"') && lastPart.endsWith('"')) || (lastPart.startsWith("'") && lastPart.endsWith("'"))) {
              lastPart = lastPart.slice(1, -1);
            }
          }

          let finalVal = newValue;
          if (typeof newValue === "string") {
            if (newValue === "true") finalVal = true;
            else if (newValue === "false") finalVal = false;
            else if (newValue === "null") finalVal = null;
            else if (!isNaN(Number(newValue)) && newValue.trim() !== "") {
              finalVal = Number(newValue);
            }
            if (typeof finalVal === "string" && (finalVal.trim().startsWith("{") || finalVal.trim().startsWith("["))) {
              try {
                finalVal = JSON.parse(finalVal);
              } catch (e) {}
            }
          }

          current[lastPart] = finalVal;
        } else {
          let finalVal = newValue;
          if (typeof newValue === "string") {
            if (newValue === "true") finalVal = true;
            else if (newValue === "false") finalVal = false;
            else if (newValue === "null") finalVal = null;
            else if (!isNaN(Number(newValue)) && newValue.trim() !== "") {
              finalVal = Number(newValue);
            }
            if (typeof finalVal === "string" && (finalVal.trim().startsWith("{") || finalVal.trim().startsWith("["))) {
              try {
                finalVal = JSON.parse(finalVal);
              } catch (e) {}
            }
          }
          newData = finalVal;
        }

        // Enforce Search Node data validation before serialization
        sanitizeWorkspaceData(newData);

        // Detect format
        const isYaml = codeFormat === "yaml";

        let newCode = "";
        if (isYaml) {
          try {
            const yaml = (await import("js-yaml")).default;
            newCode = yaml.dump(newData);
          } catch {
            newCode = JSON.stringify(newData, null, 2);
          }
        } else {
          newCode = JSON.stringify(newData, null, 2);
        }

        // Asset garbage collection is handled centrally in App.tsx observer

        setCode(newCode);
      },

      setDragOverride: (id, pos) => {
        set((state) => {
          const newOverrides = { ...state.dragOverrides };
          if (pos) {
            newOverrides[id] = pos;
          } else {
            delete newOverrides[id];
          }
          return { dragOverrides: newOverrides };
        });
        import('./dexieSync').then(m => m.persistPositionsToDexie());
      },
      setMultipleDragOverrides: (overrides) => {
        set((state) => {
          const newOverrides = { ...state.dragOverrides };
          for (const [id, pos] of Object.entries(overrides)) {
            if (pos) {
              newOverrides[id] = pos;
            } else {
              delete newOverrides[id];
            }
          }
          return { dragOverrides: newOverrides };
        });
        import('./dexieSync').then(m => m.persistPositionsToDexie());
      },
      clearDragOverrides: () => {
        set({ dragOverrides: {} });
        import('./dexieSync').then(m => m.clearPositionsInDexie());
      },
      autoOrganizeTrigger: 0,
      triggerAutoOrganize: () => set(state => ({ autoOrganizeTrigger: state.autoOrganizeTrigger + 1 })),

      nextMatch: () =>
        set((state) => {
          if (state.searchMatches.size === 0) return state;
          const matches = Array.from(state.searchMatches);
          const i = state.activeMatchIndex;
          const nextIndex =
            i === null || i === undefined || i >= matches.length - 1
              ? 0
              : i + 1;
          const activeId = matches[nextIndex];

          return { activeMatchIndex: nextIndex, activeMatchId: activeId };
        }),

      prevMatch: () =>
        set((state) => {
          if (state.searchMatches.size === 0) return state;
          const matches = Array.from(state.searchMatches);
          const i = state.activeMatchIndex;
          const prevIndex =
            i === null || i === undefined || i <= 0
              ? matches.length - 1
              : i - 1;
          const activeId = matches[prevIndex];

          return { activeMatchIndex: prevIndex, activeMatchId: activeId };
        }),

      clearCode: () => {
        const { code: currentCode, setCode } = get();
        // Use setCode to ensure all derived search states are cleared
        setCode("", false);
        set({ dragOverrides: {}, selectedNodeId: null });
        import('./dexieSync').then(m => m.clearPositionsInDexie());
      },

      resetAllSettings: () => {
        set({ ...defaultSettings, dragOverrides: {} });
        import('./dexieSync').then(m => m.clearPositionsInDexie());
      },
    };
  },
    {
      name: "json-graph-viewer-settings",
      partialize: (state) => {
        const persistedKeys = [
          ...Object.keys(defaultSettings),
          "code",
          "codeFormat",
          "isEditorPanelOpen",
          "isAdvancedPanelOpen",
          "apiMethod",
          "apiUrl",
          "apiHeaders",
          "apiBody",
          "activeTab",
          "globalTextExpanded",
          "activePreviewPath",
          "workspaceTabs",
          "activeExplorerFile",
          "explorerExpandedPaths",
          "selectedExplorerFiles",
          "apiNodeConfig",
          "jsNodeVisibility",
          "jsNodeCodeOverrides",
          "expandedJsNodeId",
          "activeDocumentId",
          "activeDocumentName",
          "isDirty",
          "lastSavedCode",
          "stickyNotesEnabled",
        ];
        return Object.fromEntries(
          Object.entries(state).filter(([key]) => persistedKeys.includes(key)),
        );
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.code) {
          // Re-parse the hydrated code to reconstruct parsedData and treeData
          // We use setTimeout to ensure Zustand finishes initializing first
          setTimeout(() => {
            useStore.getState().setCode(state.code, true);
          }, 0);
        }
      },
    },
  ),
);
