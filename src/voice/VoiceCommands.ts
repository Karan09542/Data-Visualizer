import { CommandRegistry } from "./CommandRegistry";
import { useStore } from "../store/useStore";
import { useAnnotationStore } from "../store/useAnnotationStore";
import { useAudioStore } from "../audio/stores/audioStore";
import { TreeNode } from "../utils/transformer";
import { LAYOUT_MODES, CODE_FORMATS, NODE_THEMES, EDGE_STYLES, NODE_SHAPES, LayoutMode, CodeFormat, NodeTheme, EdgeStyle, NodeShape } from "../constants/visualizer";

// Helper to search for a node in the treeData
const findNodeByKeyword = (treeData: TreeNode | null, keyword: string): TreeNode | null => {
  if (!treeData || !keyword) return null;

  const kw = keyword.toLowerCase();

  let bestMatch: TreeNode | null = null;
  let bestScore = -1;

  const traverse = (node: TreeNode) => {
    let score = -1;
    // Check key
    if (node.name) {
      const keyStr = String(node.name).toLowerCase();
      if (keyStr === kw) score = 100;
      else if (keyStr.includes(kw)) score = 50;
    }
    // Check value
    if (node.value && typeof node.value === 'string') {
      const valStr = node.value.toLowerCase();
      if (valStr === kw && score < 100) score = 90;
      else if (valStr.includes(kw) && score < 50) score = 40;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = node;
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(treeData);

  return bestMatch;
};

// Expand all parents of a node using its path
const expandParents = (node: TreeNode) => {
  const store = useStore.getState();
  const currentCollapsed = new Set(store.collapsedNodes);

  if (node.id) {
    const parts = node.id.split(".");
    for (let i = 1; i < parts.length; i++) {
      const parentId = parts.slice(0, i).join(".");
      currentCollapsed.delete(parentId);
    }
  }

  store.setCollapsedNodes(currentCollapsed);
};

let autoMatchInterval: NodeJS.Timeout | null = null;

const stopAutoMatch = (quiet = false) => {
  if (autoMatchInterval) {
    clearInterval(autoMatchInterval);
    autoMatchInterval = null;
    if (!quiet) {
      useStore.getState().setNotification({ message: 'Auto-match stopped', type: 'info' });
    }
  }
};

export const registerAllVoiceCommands = () => {
  CommandRegistry.clear();

  // Navigation commands
  CommandRegistry.register({
    phrases: ["go to *node", "focus on *node", "navigate to *node", "find *node", "select *node"],
    execute: (args?: any[]) => {
      const store = useStore.getState();
      let target = args?.[0] as string;
      if (!target || !store.treeData) return;

      // Strip punctuation if any
      target = target.replace(/[.,!?]/g, '').trim();

      // Update the search bar
      store.setSearchQuery(target);

      const matchedNode = findNodeByKeyword(store.treeData, target);
      if (matchedNode && matchedNode.id) {
        expandParents(matchedNode);
        store.setSelectedNodeId(matchedNode.id);
        store.setNotification({ message: `Navigated to ${target}`, type: 'success' });

        // Trigger fit graph to make it visible if needed
        setTimeout(() => {
          const fitBtn = document.getElementById("fit-graph-btn");
          if (fitBtn) fitBtn.click();
        }, 100);
      } else {
        store.setNotification({ message: `Could not find node matching "${target}"`, type: 'error' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["deselect", "clear selection", "unselect"],
    execute: () => {
      stopAutoMatch(true);
      const store = useStore.getState();
      store.setSelectedNodeId(null);
      store.setSearchQuery(''); // Also clear the search query
      store.setNotification({ message: 'Selection cleared', type: 'info' });
    }
  });

  // Tree Controls
  CommandRegistry.register({
    phrases: ["expand all", "open all"],
    execute: () => {
      useStore.getState().setCollapsedNodes(new Set());
      window.dispatchEvent(new CustomEvent("schema-expand-all"));
    }
  });

  CommandRegistry.register({
    phrases: ["collapse all", "close all"],
    execute: () => {
      const store = useStore.getState();
      const allIds = new Set<string>();
      const traverse = (node: TreeNode) => {
        if (node.id) allIds.add(node.id);
        if (node.children) node.children.forEach(traverse);
      };
      if (store.treeData) traverse(store.treeData);
      store.setCollapsedNodes(allIds);
      window.dispatchEvent(new CustomEvent("schema-collapse-all"));
    }
  });

  // Search Commands
  CommandRegistry.register({
    phrases: ["search for *query", "search *query"],
    execute: (args?: any[]) => {
      const store = useStore.getState();
      let query = args?.[0] as string;
      if (!query) return;

      // Strip punctuation if any
      query = query.replace(/[.,!?]/g, '').trim();

      store.setSearchQuery(query);
    }
  });

  const parseMoveArgs = (args?: any[]) => {
    let factor = 1;
    let direction = "";

    if (args && args.length > 0 && typeof args[0] === 'string') {
      const argStr = args[0].toLowerCase().replace(/[.,!?]/g, '').trim();

      const wordToNum: Record<string, number> = {
        'one': 1, 'won': 1, 'two': 2, 'to': 2, 'too': 2,
        'three': 3, 'tree': 3, 'four': 4, 'for': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'ate': 8,
        'nine': 9, 'ten': 10, 'half': 0.5
      };

      const numMatch = argStr.match(/([\d.]+)x/);
      if (numMatch && numMatch[1]) {
        factor = parseFloat(numMatch[1]);
      } else if (argStr.includes('double')) {
        factor = 2;
      } else if (argStr.includes('twice')) {
        factor = 2;
      } else {
        const standaloneMatch = argStr.match(/(?:^|\s)([\d.]+)\s*(times|time)?(?:\s|$)/);
        if (standaloneMatch && standaloneMatch[1]) {
          factor = parseFloat(standaloneMatch[1]);
        } else {
          const words = argStr.split(/\s+/);
          for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (wordToNum[w] !== undefined) {
              factor = wordToNum[w];
              break;
            }
          }
        }
      }

      const dirMatches = [...argStr.matchAll(/(left|right|top|bottom)/g)];
      if (dirMatches.length > 0) {
        direction = dirMatches.map(m => m[1]).join('-');
      }
    }

    return { factor, direction };
  };

  CommandRegistry.register({
    phrases: ["move *args", "pan *args"],
    execute: (args?: any[]) => {
      const { factor, direction } = parseMoveArgs(args);
      if (direction) {
        window.dispatchEvent(new CustomEvent("voice-move", { detail: { factor, direction } }));
      }
    }
  });

  // View Controls
  const parseZoomArgs = (args?: any[]) => {
    let factor = 1.5;
    let direction = "";

    if (args && args.length > 0 && typeof args[0] === 'string') {
      const argStr = args[0].toLowerCase().replace(/[.,!?]/g, '').trim();

      const wordToNum: Record<string, number> = {
        'one': 1, 'won': 1,
        'two': 2, 'to': 2, 'too': 2,
        'three': 3, 'tree': 3,
        'four': 4, 'for': 4,
        'five': 5,
        'six': 6,
        'seven': 7,
        'eight': 8, 'ate': 8,
        'nine': 9,
        'ten': 10,
        'half': 0.5
      };

      const numMatch = argStr.match(/([\d.]+)x/);
      if (numMatch && numMatch[1]) {
        factor = parseFloat(numMatch[1]);
      } else if (argStr.includes('double')) {
        factor = 2;
      } else if (argStr.includes('twice')) {
        factor = Math.pow(1.5, 2);
      } else {
        // Check for standalone digits like "2" or "2 times"
        const standaloneMatch = argStr.match(/(?:^|\s)([\d.]+)\s*(times|time)?(?:\s|$)/);
        if (standaloneMatch && standaloneMatch[1]) {
          const val = parseFloat(standaloneMatch[1]);
          if (standaloneMatch[2]) {
            factor = Math.pow(1.5, val); // Repeated zooms
          } else {
            factor = val;
          }
        } else {
          // Check for word numbers
          const words = argStr.split(/\s+/);
          for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (wordToNum[w] !== undefined) {
              const val = wordToNum[w];
              if (i + 1 < words.length && (words[i + 1] === 'times' || words[i + 1] === 'time')) {
                factor = Math.pow(1.5, val);
              } else {
                factor = val;
              }
              break;
            }
          }
        }
      }

      const dirMatch = argStr.match(/(left|right|top|bottom)/);
      if (dirMatch && dirMatch[1]) {
        direction = dirMatch[1];
      }
    }

    return { factor, direction };
  };

  CommandRegistry.register({
    phrases: ["zoom in *args", "zoom in"],
    execute: (args?: any[]) => {
      const { factor, direction } = parseZoomArgs(args);
      window.dispatchEvent(new CustomEvent("voice-zoom", { detail: { op: 'in', factor, direction } }));
    }
  });

  CommandRegistry.register({
    phrases: ["zoom out *args", "zoom out"],
    execute: (args?: any[]) => {
      const { factor, direction } = parseZoomArgs(args);
      window.dispatchEvent(new CustomEvent("voice-zoom", { detail: { op: 'out', factor, direction } }));
    }
  });
  CommandRegistry.register({
    phrases: ["export as *format", "download as *format", "save as *format"],
    execute: (args?: any[]) => {
      let format = args?.[0] as string;
      if (!format) return;

      format = format.toLowerCase().trim().replace(/[.,!?]/g, '');
      let mappedFormat = "";

      if (format.includes("png transparent") || format.includes("transparent png")) mappedFormat = "png-transparent";
      else if (format.includes("png")) mappedFormat = "png";
      else if (format.includes("jpg") || format.includes("jpeg")) mappedFormat = "jpeg";
      else if (format.includes("webp") || format.includes("web p")) mappedFormat = "webp";
      else if (format.includes("svg transparent") || format.includes("transparent svg")) mappedFormat = "svg-transparent";
      else if (format.includes("svg")) mappedFormat = "svg";
      else {
        useStore.getState().setNotification({ message: `Unsupported export format: ${format}`, type: 'error' });
        return;
      }

      window.dispatchEvent(new CustomEvent("voice-export", { detail: { format: mappedFormat } }));
    }
  });

  CommandRegistry.register({
    phrases: ["reset zoom", "fit graph", "center graph", "fit into center", "zoom into center", "fit to screen", "reset view", "zoom to fit"],
    execute: () => {
      const fitBtn = document.getElementById("fit-graph-btn");
      if (fitBtn) fitBtn.click();
    }
  });

  CommandRegistry.register({
    phrases: ["show schema", "toggle schema", "switch to schema"],
    execute: () => {
      const store = useStore.getState();
      store.setVisualizerMode(store.visualizerMode === 'schema' ? 'graph' : 'schema');
    }
  });

  // Theme Commands
  CommandRegistry.register({
    phrases: ["enable dark mode", "switch to dark mode", "dark mode", "turn on dark mode", "go dark"],
    execute: () => {
      const store = useStore.getState();
      store.setAppTheme("dark");
      store.setCanvasBackgroundColor("#0d1117");
      store.setCanvasPatternColor("rgba(148, 163, 184, 0.15)");
      store.setNotification({ message: 'Switched to dark mode', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["enable light mode", "switch to light mode", "light mode", "turn on light mode", "go light"],
    execute: () => {
      const store = useStore.getState();
      store.setAppTheme("light");
      store.setCanvasBackgroundColor("#f8fafc");
      store.setCanvasPatternColor("rgba(51, 65, 85, 0.15)");
      store.setNotification({ message: 'Switched to light mode', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["toggle dark mode", "toggle theme", "toggle themes", "switch theme", "switch themes", "change theme", "change themes", "toggle light mode"],
    execute: () => {
      const store = useStore.getState();
      if (store.appTheme === "dark") {
        store.setAppTheme("light");
        store.setCanvasBackgroundColor("#f8fafc");
        store.setCanvasPatternColor("rgba(51, 65, 85, 0.15)");
        store.setNotification({ message: 'Switched to light mode', type: 'info' });
      } else {
        store.setAppTheme("dark");
        store.setCanvasBackgroundColor("#0d1117");
        store.setCanvasPatternColor("rgba(148, 163, 184, 0.15)");
        store.setNotification({ message: 'Switched to dark mode', type: 'info' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["show tree", "show graph", "switch to graph"],
    execute: () => {
      const store = useStore.getState();
      store.setVisualizerMode('graph');
    }
  });

  // Workspace Commands
  CommandRegistry.register({
    phrases: ["open settings", "show settings", "open config", "show config"],
    execute: () => {
      const store = useStore.getState() as any;
      if (store.setIsAdvancedPanelOpen) {
        store.setIsAdvancedPanelOpen(true);
      }
    }
  });

  CommandRegistry.register({
    phrases: ["close settings", "hide settings", "close config", "hide config"],
    execute: () => {
      const store = useStore.getState() as any;
      if (store.setIsAdvancedPanelOpen) {
        store.setIsAdvancedPanelOpen(false);
      }
    }
  });

  // Format Commands
  CommandRegistry.register({
    phrases: ["change format to *fmt", "set format to *fmt", "format as *fmt", "switch to *fmt format"],
    execute: (args?: any[]) => {
      let fmt = args?.[0] as string;
      if (!fmt) return;

      fmt = fmt.toLowerCase().trim().replace(/[.,!?]/g, '');
      if ((CODE_FORMATS as readonly string[]).includes(fmt)) {
        useStore.getState().convertFormat(fmt as CodeFormat);
        useStore.getState().setNotification({ message: `Format changed to ${fmt.toUpperCase()}`, type: 'success' });
      } else {
        useStore.getState().setNotification({ message: `Unknown format: ${fmt}. Available: ${CODE_FORMATS.join(', ')}`, type: 'error' });
      }
    }
  });

  // Layout Commands
  CommandRegistry.register({
    phrases: ["change layout to *layout", "set layout to *layout", "use *layout layout", "switch to *layout layout", "layout *layout"],
    execute: (args?: any[]) => {
      let layout = args?.[0] as string;
      if (!layout) return;

      layout = layout.toLowerCase().trim().replace(/[.,!?]/g, '');
      if ((LAYOUT_MODES as readonly string[]).includes(layout)) {
        useStore.getState().setLayoutMode(layout as LayoutMode);
        useStore.getState().clearDragOverrides();
        useStore.getState().setNotification({ message: `Layout changed to ${layout}`, type: 'success' });
      } else {
        useStore.getState().setNotification({ message: `Unknown layout: ${layout}. Available: ${LAYOUT_MODES.join(', ')}`, type: 'error' });
      }
    }
  });

  // Info and Upload Commands
  CommandRegistry.register({
    phrases: ["open info", "show info", "info popup", "help popup", "open help"],
    execute: () => {
      const infoBtn = document.getElementById("main-info-btn");
      if (infoBtn) {
        infoBtn.click();
        useStore.getState().setNotification({ message: 'Opened Info Popup', type: 'info' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["upload file", "upload files", "open upload", "upload data", "import file", "import data", "open import"],
    execute: () => {
      const uploadBtn = document.getElementById("main-file-upload");
      if (uploadBtn) {
        uploadBtn.click();
        useStore.getState().setNotification({ message: 'Opened File Upload', type: 'info' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["confirm import", "import data", "import media", "save import", "finish import", "apply import"],
    execute: () => {
      const confirmBtn = document.getElementById("confirm-import-btn");
      if (confirmBtn) {
        confirmBtn.click();
      } else {
        useStore.getState().setNotification({ message: 'No active import to confirm', type: 'error' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["cancel import", "close import", "stop import", "abort import"],
    execute: () => {
      const cancelBtn = document.getElementById("cancel-import-btn");
      if (cancelBtn) {
        cancelBtn.click();
      }
    }
  });

  // Advanced Panel Toggles
  CommandRegistry.register({
    phrases: ["toggle drawing toolbar", "enable drawing toolbar", "disable drawing toolbar", "show drawing toolbar", "hide drawing toolbar", "drawing toolbar"],
    execute: (args?: any[], phrase?: string) => {
      const store = useAnnotationStore.getState();
      const p = phrase?.toLowerCase() || "";
      const newState = p.includes("enable") || p.includes("show") ? true : p.includes("disable") || p.includes("hide") ? false : !store.isToolbarVisible;
      store.setIsToolbarVisible(newState);
      useStore.getState().setNotification({ message: `${newState ? 'Enabled' : 'Disabled'} Drawing Toolbar`, type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["toggle media preview", "enable media preview", "disable media preview", "show media preview", "hide media preview", "media preview"],
    execute: (args?: any[], phrase?: string) => {
      const store = useStore.getState();
      const p = phrase?.toLowerCase() || "";
      const newState = p.includes("enable") || p.includes("show") ? true : p.includes("disable") || p.includes("hide") ? false : !store.showMediaPreview;
      store.setShowMediaPreview(newState);
      store.setNotification({ message: `${newState ? 'Enabled' : 'Disabled'} Media Preview`, type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["toggle sticky notes", "enable sticky notes", "disable sticky notes", "show sticky notes", "hide sticky notes", "sticky notes", "workspace notes"],
    execute: (args?: any[], phrase?: string) => {
      const store = useStore.getState();
      const p = phrase?.toLowerCase() || "";
      const newState = p.includes("enable") || p.includes("show") ? true : p.includes("disable") || p.includes("hide") ? false : !store.stickyNotesEnabled;
      store.setStickyNotesEnabled(newState);
      store.setNotification({ message: `${newState ? 'Enabled' : 'Disabled'} Sticky Notes`, type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["open youtube search", "show youtube search", "youtube search", "youtube video"],
    execute: () => {
      useStore.getState().setIsYoutubeSearchOpen(true);
      useStore.getState().setNotification({ message: 'Opened YouTube Search', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["toggle expand all text", "enable expand all text", "disable expand all text", "expand all text", "collapse all text"],
    execute: (args?: any[], phrase?: string) => {
      const store = useStore.getState();
      const p = phrase?.toLowerCase() || "";
      const newState = p.includes("enable") || p.includes("expand") ? true : p.includes("disable") || p.includes("collapse") ? false : !store.globalTextExpanded;
      store.setGlobalTextExpanded(newState);
      store.setNotification({ message: `${newState ? 'Expanded' : 'Collapsed'} all text`, type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["toggle audio player", "enable audio player", "disable audio player", "show audio player", "hide audio player", "open audio player", "close audio player", "audio player", "music player"],
    execute: (args?: any[], phrase?: string) => {
      const store = useAudioStore.getState();
      const p = phrase?.toLowerCase() || "";
      const newState = p.includes("enable") || p.includes("show") || p.includes("open") ? true : p.includes("disable") || p.includes("hide") || p.includes("close") ? false : !store.isPlayerOpen;
      store.setIsPlayerOpen(newState);
      useStore.getState().setNotification({ message: `${newState ? 'Opened' : 'Closed'} Audio Player`, type: 'info' });
    }
  });

  // Organize Command
  CommandRegistry.register({
    phrases: ["auto organize", "organize nodes", "organize graph", "clean up graph"],
    execute: () => {
      useStore.getState().triggerAutoOrganize();
      useStore.getState().clearDragOverrides();
      useStore.getState().setNotification({ message: `Graph organized`, type: 'success' });
    }
  });

  // Theme, Edge, and Shape Commands
  CommandRegistry.register({
    phrases: ["change theme to *theme", "set theme to *theme", "use *theme theme", "switch to *theme theme", "theme *theme"],
    execute: (args?: any[]) => {
      let theme = args?.[0] as string;
      if (!theme) return;

      theme = theme.toLowerCase().trim().replace(/[.,!?]/g, '');
      if ((NODE_THEMES as readonly string[]).includes(theme)) {
        useStore.getState().setNodeTheme(theme as NodeTheme);
        useStore.getState().setNotification({ message: `Theme changed to ${theme}`, type: 'success' });
      } else {
        useStore.getState().setNotification({ message: `Unknown theme: ${theme}.`, type: 'error' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["change edge to *edge", "set edge to *edge", "use *edge edge", "switch to *edge edge", "edge *edge", "change edge style to *edge", "set edge style to *edge"],
    execute: (args?: any[]) => {
      let edge = args?.[0] as string;
      if (!edge) return;

      edge = edge.toLowerCase().trim().replace(/[.,!?]/g, '');
      if ((EDGE_STYLES as readonly string[]).includes(edge)) {
        useStore.getState().setEdgeStyle(edge as EdgeStyle);
        useStore.getState().setNotification({ message: `Edge style changed to ${edge}`, type: 'success' });
      } else {
        useStore.getState().setNotification({ message: `Unknown edge style: ${edge}.`, type: 'error' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["change shape to *shape", "set shape to *shape", "use *shape shape", "switch to *shape shape", "shape *shape", "change node shape to *shape", "set node shape to *shape"],
    execute: (args?: any[]) => {
      let shape = args?.[0] as string;
      if (!shape) return;

      shape = shape.toLowerCase().trim().replace(/[.,!?]/g, '');
      if ((NODE_SHAPES as readonly string[]).includes(shape)) {
        useStore.getState().setNodeShape(shape as NodeShape);
        useStore.getState().setNotification({ message: `Node shape changed to ${shape}`, type: 'success' });
      } else {
        useStore.getState().setNotification({ message: `Unknown shape: ${shape}.`, type: 'error' });
      }
    }
  });

  // Editor Panel Commands
  CommandRegistry.register({
    phrases: ["toggle editor panel", "toggle editor", "open editor panel", "close editor panel", "show editor panel", "hide editor panel", "hide editor", "show editor", "open editor", "close editor"],
    execute: () => {
      const store = useStore.getState();
      const newState = !store.isEditorPanelOpen;
      store.setIsEditorPanelOpen(newState);
      store.setNotification({ message: `${newState ? 'Opened' : 'Closed'} editor panel`, type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["switch to gui editor", "open gui editor", "show gui editor", "gui editor"],
    execute: () => {
      const store = useStore.getState();
      store.setActiveTab("gui");
      if (!store.isEditorPanelOpen) store.setIsEditorPanelOpen(true);
      store.setNotification({ message: 'Switched to GUI Editor', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["switch to file explorer", "open file explorer", "show file explorer", "file explorer", "explorer"],
    execute: () => {
      const store = useStore.getState();
      store.setActiveTab("explorer");
      if (!store.isEditorPanelOpen) store.setIsEditorPanelOpen(true);
      store.setNotification({ message: 'Switched to File Explorer', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["switch to raw editor", "open raw editor", "show raw editor", "raw editor", "code editor", "switch to code editor"],
    execute: () => {
      const store = useStore.getState();
      store.setActiveTab("raw");
      if (!store.isEditorPanelOpen) store.setIsEditorPanelOpen(true);
      store.setNotification({ message: 'Switched to Raw Editor', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["switch to api panel", "open api panel", "show api panel", "api panel"],
    execute: () => {
      const store = useStore.getState();
      store.setActiveTab("api");
      if (!store.isEditorPanelOpen) store.setIsEditorPanelOpen(true);
      store.setNotification({ message: 'Switched to API Panel', type: 'info' });
    }
  });

  CommandRegistry.register({
    phrases: ["open code workspace", "show code workspace", "code workspace", "open workspace", "workspace"],
    execute: () => {
      const store = useStore.getState();
      const selectedId = store.selectedNodeId;
      if (selectedId) {
        store.setExpandedJsNodeId(selectedId);
        store.setNotification({ message: `Opened Code Workspace for node`, type: 'info' });
      } else {
        store.setNotification({ message: `Please select a node first to open its Code Workspace`, type: 'warning' });
      }
    }
  });

  // Selection Commands


  const parseMatchArgs = (args?: any[]) => {
    if (!args || args.length === 0 || typeof args[0] !== 'string') return 0;
    const str = args[0].toLowerCase();

    // Check word numbers
    const wordToNum: Record<string, number> = {
      'one': 1, 'won': 1, 'two': 2, 'to': 2, 'too': 2,
      'three': 3, 'tree': 3, 'four': 4, 'for': 4,
      'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'ate': 8,
      'nine': 9, 'ten': 10
    };

    let val = 0;
    const match = str.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      val = parseFloat(match[1]);
    } else {
      const words = str.split(/\s+/);
      for (const w of words) {
        if (wordToNum[w]) {
          val = wordToNum[w];
          break;
        }
      }
    }

    if (val > 0) {
      if (str.includes('m') && !str.includes('match') && !str.includes('mode') && !str.includes('move')) {
        // just a heuristic for minutes, though seconds is more common
      }
      return val * 1000;
    }
    return 0;
  };

  CommandRegistry.register({
    phrases: ["next match *args", "next node *args", "next match", "next node"],
    execute: (args?: any[]) => {
      const delay = parseMatchArgs(args);
      stopAutoMatch(true); // Stop any existing interval silently
      useStore.getState().nextMatch();

      if (delay > 0) {
        autoMatchInterval = setInterval(() => {
          useStore.getState().nextMatch();
        }, delay);
        useStore.getState().setNotification({ message: `Auto-advancing next match every ${delay / 1000}s`, type: 'info' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["previous match *args", "previous node *args", "previous match", "previous node"],
    execute: (args?: any[]) => {
      const delay = parseMatchArgs(args);
      stopAutoMatch(true);
      useStore.getState().prevMatch();

      if (delay > 0) {
        autoMatchInterval = setInterval(() => {
          useStore.getState().prevMatch();
        }, delay);
        useStore.getState().setNotification({ message: `Auto-advancing previous match every ${delay / 1000}s`, type: 'info' });
      }
    }
  });

  CommandRegistry.register({
    phrases: ["stop preview", "stop match", "stop auto match", "stop auto", "stop slideshow", "stop matching", "stop node"],
    execute: () => {
      stopAutoMatch();
    }
  });
};
