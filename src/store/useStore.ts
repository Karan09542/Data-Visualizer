import { create } from "zustand";
import { startTransition } from "react";
import { persist } from "zustand/middleware";
import { parseInput } from "../utils/parser";
import { transformToTree, type ApiResponseView } from "../utils/transformer";

import SearchWorker from "../utils/searchWorker?worker";



/**
 * The state after tabs close: an emptied group folds away, and when the main group empties the
 * side group takes its place - VS Code never leaves an empty group beside a full one.
 */
function settleGroups(tabs: WorkspaceTab[], active: string | null, split: EditorSplit | null) {
  let editorSplit = split;
  if (editorSplit && editorSplit.tabs.length === 0) editorSplit = null;
  if (editorSplit && tabs.length === 0) {
    tabs = editorSplit.tabs;
    active = editorSplit.active ?? tabs[tabs.length - 1]?.path ?? null;
    editorSplit = null;
  }
  return {
    workspaceTabs: tabs,
    activeExplorerFile: active,
    selectedExplorerFiles: active ? [active] : [],
    expandedJsNodeId: active,
    editorSplit,
    // With one group left, it is the one being worked in.
    ...(editorSplit ? {} : { activeEditorGroup: "main" as const }),
  };
}

/** The main group with a file open and active in it, as a tab kept open (not a preview). */
function withMainTabOpen(s: { workspaceTabs: WorkspaceTab[]; editorSplit: EditorSplit | null }, path: string) {
  const tabs = s.workspaceTabs.some(t => t.path === path)
    ? s.workspaceTabs
    : [...s.workspaceTabs, { path, isPreview: false, isDirty: !!s.editorSplit?.tabs.find(t => t.path === path)?.isDirty }];
  return { workspaceTabs: tabs, activeExplorerFile: path, selectedExplorerFiles: [path], expandedJsNodeId: path, activeEditorGroup: "main" as const };
}

/**
 * The side group with a file open and active in it. A preview replaces the group's preview tab,
 * as it does in the main group; the main group is left as it is.
 */
function withSideTabOpen(
  s: { workspaceTabs: WorkspaceTab[]; editorSplit: EditorSplit | null; explorerExpandedPaths: Record<string, boolean> },
  path: string,
  asPreview: boolean,
) {
  const split = s.editorSplit!;
  const isDirty = !!s.workspaceTabs.find(t => t.path === path)?.isDirty;
  let tabs = split.tabs;
  const existing = tabs.find(t => t.path === path);
  if (existing) {
    if (!asPreview && existing.isPreview) tabs = tabs.map(t => (t.path === path ? { ...t, isPreview: false } : t));
  } else if (asPreview) {
    const preview = tabs.findIndex(t => t.isPreview);
    const tab = { path, isPreview: true, isDirty };
    tabs = preview !== -1 ? tabs.map((t, i) => (i === preview ? tab : t)) : [...tabs, tab];
  } else {
    tabs = [...tabs, { path, isPreview: false, isDirty }];
  }

  // Its folders open in the explorer, as when a file opens in the main group.
  const explorerExpandedPaths = { ...s.explorerExpandedPaths };
  const parts = path.split(".");
  for (let i = 2; i < parts.length; i++) explorerExpandedPaths[parts.slice(0, i).join(".")] = true;

  return { editorSplit: { ...split, tabs, active: path }, selectedExplorerFiles: [path], explorerExpandedPaths };
}

let searchWorkerInstance: Worker | null = null;
if (typeof window !== "undefined") {
  searchWorkerInstance = new SearchWorker();
}

import { LayoutMode, CodeFormat, NodeTheme, EdgeStyle, NodeShape } from "../constants/visualizer";
export type { LayoutMode, CodeFormat, NodeTheme, EdgeStyle, NodeShape };
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

export interface ProxyServer {
  id: string;
  url: string;
  isEnabled: boolean;
}

export interface WorkspaceTab {
  path: string;
  isPreview: boolean;
  isDirty: boolean;
}

/** The workspace's editor groups: the one it always has, and the one a split adds beside it. */
export type EditorGroupId = "main" | "side";
export type SplitDirection = "right" | "down";

/** A second editor group, VS Code's split editor. It has tabs of its own. */
export interface EditorSplit {
  direction: SplitDirection;
  tabs: WorkspaceTab[];
  active: string | null;
  /** The share of the space the main group takes, 0-1. */
  ratio: number;
}

export interface StoreState {
  proxyServers: ProxyServer[];
  setProxyServers: (proxies: ProxyServer[] | ((prev: ProxyServer[]) => ProxyServer[])) => void;
  isProxyModalOpen: boolean;
  setIsProxyModalOpen: (isOpen: boolean) => void;
  useDefaultProxy: boolean;
  setUseDefaultProxy: (use: boolean) => void;

  globalAlert: { title: string; message: string; codeSnippet?: string } | null;
  setGlobalAlert: (alert: { title: string; message: string; codeSnippet?: string } | null) => void;

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

  editorSplit: EditorSplit | null;
  /**
   * The group being worked in. With the editor split, files open there, and running, the console
   * and the title bar follow its active tab - as in VS Code.
   */
  activeEditorGroup: EditorGroupId;
  setActiveEditorGroup: (group: EditorGroupId) => void;
  /**
   * Shows a file in the other group - VS Code's split. From the main group it opens the file in
   * the side group (making one when there is none); from the side group, in the main one.
   */
  splitEditorTab: (path: string, options?: { from?: EditorGroupId; direction?: SplitDirection }) => void;
  activateGroupTab: (group: EditorGroupId, path: string) => void;
  /**
   * Closes some of a group's tabs. `focus` is the tab the reader acted on: it becomes the active
   * one if the active tab went. A group left empty folds away, as in VS Code.
   */
  closeGroupTabs: (group: EditorGroupId, paths: string[], focus?: string) => void;
  setGroupTabs: (group: EditorGroupId, tabs: WorkspaceTab[]) => void;
  keepGroupTabOpen: (group: EditorGroupId, path: string) => void;
  moveTabToOtherGroup: (group: EditorGroupId, path: string) => void;
  setEditorSplitLayout: (layout: Partial<Pick<EditorSplit, "direction" | "ratio">>) => void;
  closeEditorSplit: () => void;

  selectedExplorerFiles: string[];
  setSelectedExplorerFiles: (paths: string[] | ((prev: string[]) => string[])) => void;

  inlineApiEditor: {
    url: string;
    path: string;
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height?: number;
  } | null;
  setInlineApiEditor: (
    editor: {
      url: string;
      path: string;
      nodeId: string;
      x: number;
      y: number;
      width: number;
      height?: number;
    } | null,
  ) => void;
  apiNodeConfig: Record<
    string,
    { method: string; responseType: string; timeout: number; view?: ApiResponseView }
  >;
  setApiNodeConfig: (
    path: string,
    config: { method: string; responseType: string; timeout: number; view?: ApiResponseView },
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

  /** Media files opened as a plain preview rather than their editor - a double-click, or the menu. */
  mediaViewOnly: Record<string, boolean>;
  setMediaViewOnly: (path: string, viewOnly: boolean) => void;

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
  isolatedNodeId: string | null;
  isEditorPanelOpen: boolean;
  isAdvancedPanelOpen: boolean;
  isAISettingsPanelOpen: boolean;
  isAIPaletteOpen: boolean;
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
  draggingNodeIds: Set<string>;
  setDraggingNodeIds: (ids: Set<string>) => void;
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
  expandNode: (id: string) => void;
  collapseNode: (id: string) => void;
  isNodeCollapsed: (id: string) => boolean;
  setSelectedNodeId: (id: string | null) => void;
  setIsolatedNodeId: (id: string | null) => void;
  setIsEditorPanelOpen: (isOpen: boolean) => void;
  setIsAdvancedPanelOpen: (isOpen: boolean) => void;
  setIsAISettingsPanelOpen: (isOpen: boolean) => void;
  setIsAIPaletteOpen: (isOpen: boolean) => void;
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
  /**
   * Writes a value into the workspace tree. A value typed at a node is read loosely - "42" becomes
   * the number, "{...}" becomes an object - which is what editing a data node should do. Pass
   * `{ fromEditor: true }` for an editor's contents: a file's text then stays text, since "42" or
   * "null" is simply what the file says, while a node the editor showed as JSON is read back.
   */
  updateNodeValue: (path: string, newValue: any, options?: { fromEditor?: boolean }) => Promise<void>;
  setDragOverride: (id: string, pos: { x: number; y: number } | null) => void;
  setMultipleDragOverrides: (
    overrides: Record<string, { x: number; y: number } | null>,
  ) => void;
  clearDragOverrides: () => void;
  activeNodes: string[];
  bringNodeToFront: (id: string) => void;
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
  "app": "DataVisualizer",
  "description": "Visual Node Engine for JSON & YAML",
  "features": [
    "Interactive graphs",
    "Real-time editing",
    "Offline PWA support"
  ],
  "settings": {
    "theme": "dark",
    "layout": "auto"
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
        isolatedNodeId: null,
        isEditorPanelOpen: true,
        isAdvancedPanelOpen: false,
        isAISettingsPanelOpen: false,
        isAIPaletteOpen: false,
        isMobileMenuOpen: false,
        isShortcutsOpen: false,
        isMathHelpOpen: false,
        isYoutubeSearchOpen: false,
        isSavedDocsOpen: false,
        proxyServers: [],
        setProxyServers: (proxies) =>
          set((s) => ({
            proxyServers: typeof proxies === 'function' ? proxies(s.proxyServers) : proxies
          })),
        isProxyModalOpen: false,
        setIsProxyModalOpen: (isOpen) => set({ isProxyModalOpen: isOpen }),
        setIsAISettingsPanelOpen: (isOpen) => set({ isAISettingsPanelOpen: isOpen }),
        setIsAIPaletteOpen: (isOpen) => set({ isAIPaletteOpen: isOpen }),
        useDefaultProxy: true,
        setUseDefaultProxy: (use) => set({ useDefaultProxy: use }),
        globalAlert: null,
        setGlobalAlert: (alert) => set({ globalAlert: alert }),
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
            if (s.editorSplit && s.activeEditorGroup === "side") {
              return withSideTabOpen(s, path, asPreview);
            }
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
            return settleGroups(tabs, active, s.editorSplit);
          }),
        markWorkspaceTabDirty: (path, dirty) =>
          set((s) => {
            // A file open in both groups is one file: saving it in one saves it in the other.
            const mark = (list: WorkspaceTab[]) => list.map(t => {
              if (t.path === path) {
                return { ...t, isDirty: dirty, isPreview: dirty ? false : t.isPreview };
              }
              return t;
            });
            const tabs = mark(s.workspaceTabs);
            if (!s.editorSplit) return { workspaceTabs: tabs };
            return { workspaceTabs: tabs, editorSplit: { ...s.editorSplit, tabs: mark(s.editorSplit.tabs) } };
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

            // A renamed or moved file keeps its tab in the side group as well.
            const moved = (p: string) =>
              p === oldPath ? newPath : p.startsWith(oldPath + ".") ? p.replace(oldPath, newPath) : p;
            const editorSplit = s.editorSplit
              ? {
                ...s.editorSplit,
                tabs: s.editorSplit.tabs.map(t => ({ ...t, path: moved(t.path) })),
                active: s.editorSplit.active ? moved(s.editorSplit.active) : null,
              }
              : null;

            return { workspaceTabs: tabs, activeExplorerFile: active, selectedExplorerFiles: active ? [active] : [], expandedJsNodeId, editorSplit };
          }),
        closeWorkspaceTabs: (paths) =>
          set((s) => {
            // Files that went away: their tabs close in both groups.
            const gone = (p: string) => paths.includes(p) || paths.some(q => p.startsWith(q + "."));
            const tabs = s.workspaceTabs.filter(t => !gone(t.path));
            let active = s.activeExplorerFile;
            if (active && gone(active)) {
              if (tabs.length > 0) active = tabs[tabs.length - 1].path;
              else active = null;
            }
            let split = s.editorSplit;
            if (split) {
              const sideTabs = split.tabs.filter(t => !gone(t.path));
              const sideActive = split.active && gone(split.active) ? sideTabs[sideTabs.length - 1]?.path ?? null : split.active;
              split = { ...split, tabs: sideTabs, active: sideActive };
            }
            return settleGroups(tabs, active, split);
          }),

        editorSplit: null,
        activeEditorGroup: "main",
        setActiveEditorGroup: (group) =>
          set((s) => (s.activeEditorGroup === group ? {} : { activeEditorGroup: group })),
        splitEditorTab: (path, options) =>
          set((s) => {
            if (options?.from === "side") {
              return withMainTabOpen(s, path);
            }
            const direction = options?.direction ?? s.editorSplit?.direction ?? "right";
            const split = s.editorSplit ?? { direction, tabs: [], active: null, ratio: 0.5 };
            const tabs = split.tabs.some(t => t.path === path)
              ? split.tabs
              : [...split.tabs, { path, isPreview: false, isDirty: !!s.workspaceTabs.find(t => t.path === path)?.isDirty }];
            // The new group is where the reader carries on, as in VS Code.
            return { editorSplit: { ...split, direction, tabs, active: path }, activeEditorGroup: "side" as const };
          }),
        activateGroupTab: (group, path) =>
          set((s) => {
            if (group === "main") return withMainTabOpen(s, path);
            if (!s.editorSplit) return {};
            return { editorSplit: { ...s.editorSplit, active: path }, activeEditorGroup: "side" as const };
          }),
        closeGroupTabs: (group, paths, focus) =>
          set((s) => {
            const closing = new Set(paths);
            const pick = (tabs: WorkspaceTab[], active: string | null) => {
              const left = tabs.filter(t => !closing.has(t.path));
              if (active && !closing.has(active) && left.some(t => t.path === active)) return { left, active };
              if (focus && !closing.has(focus)) return { left, active: focus };
              // The nearest tab that stays: to the right of the one that went, else to its left.
              const from = Math.max(0, tabs.findIndex(t => t.path === active));
              const next =
                tabs.slice(from).find(t => !closing.has(t.path)) ??
                tabs.slice(0, from).reverse().find(t => !closing.has(t.path));
              return { left, active: next?.path ?? null };
            };
            if (group === "main") {
              const { left, active } = pick(s.workspaceTabs, s.activeExplorerFile);
              return settleGroups(left, active, s.editorSplit);
            }
            if (!s.editorSplit) return {};
            const { left, active } = pick(s.editorSplit.tabs, s.editorSplit.active);
            return settleGroups(s.workspaceTabs, s.activeExplorerFile, { ...s.editorSplit, tabs: left, active });
          }),
        setGroupTabs: (group, tabs) =>
          set((s) => {
            if (group === "main") return { workspaceTabs: tabs };
            if (!s.editorSplit) return {};
            return { editorSplit: { ...s.editorSplit, tabs } };
          }),
        keepGroupTabOpen: (group, path) =>
          set((s) => {
            const keep = (tabs: WorkspaceTab[]) => tabs.map(t => (t.path === path ? { ...t, isPreview: false } : t));
            if (group === "main") return { workspaceTabs: keep(s.workspaceTabs) };
            if (!s.editorSplit) return {};
            return { editorSplit: { ...s.editorSplit, tabs: keep(s.editorSplit.tabs) } };
          }),
        moveTabToOtherGroup: (group, path) => {
          if (group === "main") {
            get().splitEditorTab(path, { from: "main" });
            get().closeGroupTabs("main", [path]);
          } else if (get().editorSplit) {
            get().splitEditorTab(path, { from: "side" });
            get().closeGroupTabs("side", [path]);
          }
        },
        setEditorSplitLayout: (layout) =>
          set((s) => {
            if (!s.editorSplit) return {};
            const ratio = layout.ratio === undefined ? s.editorSplit.ratio : Math.min(0.85, Math.max(0.15, layout.ratio));
            return { editorSplit: { ...s.editorSplit, ...layout, ratio } };
          }),
        closeEditorSplit: () => set({ editorSplit: null, activeEditorGroup: "main" }),

        selectedExplorerFiles: [],
        setSelectedExplorerFiles: (paths) =>
          set((s) => ({
            selectedExplorerFiles: typeof paths === 'function' ? paths(s.selectedExplorerFiles) : paths
          })),

        explorerSearchQuery: "",
        dragOverrides: {},
        draggingNodeIds: new Set<string>(),
        setDraggingNodeIds: (ids) => set({ draggingNodeIds: ids }),
        activeNodes: [],
        undoStack: [],
        redoStack: [],
        inlineApiEditor: null,
        setInlineApiEditor: (editor) => set({ inlineApiEditor: editor }),
        apiNodeConfig: {},
        setApiNodeConfig: (path, config) =>
          set((s) => {
            const apiNodeConfig = { ...s.apiNodeConfig, [path]: config };
            const viewChanged = (s.apiNodeConfig[path]?.view ?? "auto") !== (config.view ?? "auto");
            // Switching between child nodes and the file view reshapes the tree
            if (!viewChanged || s.parsedData === null || s.apiNodeResponses[path] === undefined) {
              return { apiNodeConfig };
            }
            return {
              apiNodeConfig,
              treeData: transformToTree(
                s.parsedData,
                "root",
                "root",
                s.apiNodeResponses,
                s.jsNodeResponses,
                s.jsNodeVisibility,
                apiNodeConfig,
              ),
            };
          }),

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
                s.jsNodeVisibility,
                s.apiNodeConfig,
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
                s.apiNodeConfig,
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
            // Closing the workspace: opening it again starts in the main group.
            if (!id) stateUpdate.activeEditorGroup = "main";
            // The side group being worked in: the file is there, the main group keeps its own.
            if (id && s.editorSplit && s.activeEditorGroup === "side") {
              return { ...withSideTabOpen(s, id, true), expandedJsNodeId: id };
            }
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
                s.apiNodeConfig,
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
                s.apiNodeConfig,
              );
            }
            return { jsNodeVisibility: nextVis, treeData };
          }),
        setJsNodeCodeOverride: (path: string, code: string) =>
          set((s) => ({
            jsNodeCodeOverrides: { ...s.jsNodeCodeOverrides, [path]: code },
          })),
        mediaViewOnly: {},
        setMediaViewOnly: (path: string, viewOnly: boolean) =>
          set((s) => ({ mediaViewOnly: { ...s.mediaViewOnly, [path]: viewOnly } })),
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
                s.apiNodeConfig,
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
            apiNodeConfig,
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
              apiNodeConfig,
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
        setCollapsedNodes: (nodes: Set<string>) => set({ collapsedNodes: new Set(nodes) }),
        expandNode: (id: string) => {
          set((state) => {
            if (!state.collapsedNodes.has(id)) return state;
            const newCollapsed = new Set(state.collapsedNodes);
            newCollapsed.delete(id);
            return { collapsedNodes: newCollapsed };
          });
        },
        collapseNode: (id: string) => {
          set((state) => {
            if (state.collapsedNodes.has(id)) return state;
            const newCollapsed = new Set(state.collapsedNodes);
            newCollapsed.add(id);
            return { collapsedNodes: newCollapsed };
          });
        },
        isNodeCollapsed: (id: string) => {
          return get().collapsedNodes.has(id);
        },
        setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),
        setIsolatedNodeId: (id: string | null) => set({ isolatedNodeId: id }),
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

        updateNodeValue: async (path, newValue, options) => {
          const { parsedData, code, setCode, codeFormat } = get();

          // Decided once the current value is known: a file's text saved from an editor is kept
          // exactly as written; anything else is read loosely.
          let keepText = false;
          const readValue = (value: any) => {
            if (keepText || typeof value !== "string") return value;
            if (value === "true") return true;
            if (value === "false") return false;
            if (value === "null") return null;
            if (!isNaN(Number(value)) && value.trim() !== "") return Number(value);
            if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
              try {
                return JSON.parse(value);
              } catch (e) {
                return value;
              }
            }
            return value;
          };
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
          keepText = !!options?.fromEditor && (parts.length === 0 ? typeof parsedData : typeof checkCurrent) === "string";

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

            current[lastPart] = readValue(newValue);
          } else {
            newData = readValue(newValue);
          }

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
        bringNodeToFront: (id: string) => {
          set((state) => {
            const newActiveNodes = state.activeNodes.filter((nodeId) => nodeId !== id);
            newActiveNodes.push(id);
            // keep max 50 items to avoid memory leak
            if (newActiveNodes.length > 50) {
              newActiveNodes.shift();
            }
            return { activeNodes: newActiveNodes };
          });
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
          set({ dragOverrides: {}, selectedNodeId: null, collapsedNodes: new Set() });
          import('./dexieSync').then(m => m.clearPositionsInDexie());
        },

        resetAllSettings: () => {
          set({ ...defaultSettings, dragOverrides: {}, collapsedNodes: new Set() });
          import('./dexieSync').then(m => m.clearPositionsInDexie());
        },
      };
    },
    {
      name: "json-graph-viewer-settings",
      partialize: (state) => {
        // Prevent localStorage QuotaExceededError and massive JSON.stringify lag on every frame
        const isCodeMassive = state.code && state.code.length > 1024 * 1024;
        const isLastSavedMassive = state.lastSavedCode && state.lastSavedCode.length > 1024 * 1024;

        const persistedKeys = [
          ...Object.keys(defaultSettings),
          ...(isCodeMassive ? [] : ["code"]),
          ...(isLastSavedMassive ? [] : ["lastSavedCode"]),
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
          "editorSplit",
          "activeEditorGroup",
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
          "stickyNotesEnabled",
        ];
        const persistedEntries = Object.fromEntries(
          Object.entries(state).filter(([key]) => persistedKeys.includes(key)),
        );
        return {
          ...persistedEntries,
          collapsedNodes: Array.from(state.collapsedNodes || []),
        };
      },
      merge: (persistedState: unknown, currentState: StoreState): StoreState => {
        const p = (persistedState || {}) as any;
        let collapsedNodes = currentState.collapsedNodes;
        if (Array.isArray(p?.collapsedNodes)) {
          collapsedNodes = new Set(p.collapsedNodes);
        } else if (p?.collapsedNodes instanceof Set) {
          collapsedNodes = p.collapsedNodes;
        } else {
          collapsedNodes = new Set();
        }
        return {
          ...currentState,
          ...p,
          collapsedNodes,
        };
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
