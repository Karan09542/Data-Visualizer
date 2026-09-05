import katex from "katex";
import { Virtuoso } from "react-virtuoso";
import { useExecutionLogs } from "../utils/useExecutionLogs";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Square,
  Trash2,
  Copy,
  Maximize,
  X,
  Loader2,
  Terminal as TerminalIcon,
  Settings2,
  Check,
  ChevronRight,
  PanelBottom,
  PanelRight,
  PanelLeft,
  Clock,
  FolderOpen,
  FileText,
  CheckSquare,
  Image as ImageIcon,
  Sun,
  Moon,
  Info,
  ClipboardPaste,
  Plus,
  Minus,
} from "lucide-react";
import SafeEditor from "./SafeEditor";
import { useStore } from "../store/useStore";
import { getVirtualPath } from "../utils/vfs";
import { usePyPackageStore } from "../store/usePyPackageStore";
import { PyPackagesPanel } from "./PyPackagesPanel";
import { appendLogs } from "../utils/executionStore";
import { safeStringify } from "../utils/safeStringify";
import { TodoWorkspace } from "./TodoWorkspace";
import { ProxySettingsModal } from "./ProxySettingsModal";
import { GlobalAlertModal } from "./GlobalAlertModal";
import { lazyWithRetry } from "../utils/lazyWithRetry";
const ImageWorkspace = lazyWithRetry(() => import("./image-workspace/ImageWorkspace"), 'ImageWorkspace');
import { SearchNodeWorkspace } from "./SearchNodeWorkspace";
import { MatplotlibPlotViewer } from "./MatplotlibPlotViewer";
import { useAssistantStore } from "../programming-assistant/stores/useAssistantStore";
import {
  generateTypeScriptSchema,
  executeTsNode,
  abortTsNode,
} from "../utils/tsExecutor";
import { executeJsNode, abortJsNode } from "../utils/jsExecutor";
import { executePyNode, abortPyNode } from "../utils/pyExecutor";
import { formatPythonCode } from "../utils/pythonFormatter";
import { insertTextIntoEditor } from "../utils/clipboardHelper";
import {
  registerWorkspaceIntelliSense,
  syncWorkspaceModelsToMonaco,
} from "../utils/workspaceIntelliSense";
import { ProgrammingKeyboard } from "../programming-assistant/components/ProgrammingKeyboard";
import { getMediaType } from "./NodeRenderer";
import FileExplorerPanel from "./FileExplorerPanel";
import WorkspaceSash from "./WorkspaceSash";
import {
  JavaScriptIcon,
  TypeScriptIcon,
  PythonIcon,
  JsonIcon,
  MarkdownIcon,
} from "./FileIcons";
import { getValueAtPath } from "../utils/pathUtils";
import { editorThemes } from "../utils/editorThemes";
import {
  buildShellPalette,
  buildMonacoColors,
  DEFAULT_SHELL,
} from "../utils/vscShellTheme";
import { renderClickableErrorText } from "../utils/errorParser";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="p-1 hover:bg-[var(--vsc-hover)] rounded-[4px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] transition-colors cursor-pointer shrink-0"
      title={copied ? "Copied" : "Copy error text"}
    >
      {copied ? (
        <Check size={11} className="text-emerald-500" />
      ) : (
        <Copy size={11} />
      )}
    </button>
  );
}

interface CodeWorkspaceProps {
  path: string; // The main root node path representing this workspace context
  onClose: () => void;
}

interface WorkspaceSettings {
  enabled: boolean;
  renderCharacters: boolean;
  verticalSize: "small" | "medium" | "large" | "fit";
  showSlider: "always" | "mouseover";
  side: "right" | "left";
  editorTheme:
  | "default"
  | "one-dark-pro"
  | "dracula"
  | "night-owl"
  | "github-dark"
  | "synthwave-84";
  sidebarWidth?: number;
  isSidebarOpen?: boolean;
  fontSize?: number;
  wordWrap?: "on" | "off";
}

const defaultWorkspaceSettings: WorkspaceSettings = {
  enabled: true,
  renderCharacters: true,
  verticalSize: "medium",
  showSlider: "mouseover",
  side: "right",
  editorTheme: "default",
  sidebarWidth: 260,
  isSidebarOpen: true,
  wordWrap: "on",
};

export function CodeWorkspace({ path, onClose }: CodeWorkspaceProps) {
  const appTheme = useStore((state) => state.appTheme);
  const jsNodeFocusLine = useStore((state) => state.jsNodeFocusLine);
  const setJsNodeFocusLine = useStore((state) => state.setJsNodeFocusLine);
  const autoClearLogs = useStore((state) => state.autoClearLogs);
  const setAutoClearLogs = useStore((state) => state.setAutoClearLogs);
  const activeExplorerFile = useStore((state) => state.activeExplorerFile);
  const setActiveExplorerFile = useStore((state) => state.setActiveExplorerFile);
  const jsNodeCodeOverrides = useStore((state) => state.jsNodeCodeOverrides);
  const setJsNodeCodeOverride = useStore((state) => state.setJsNodeCodeOverride);
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const parsedData = useStore((state) => state.parsedData);
  const jsNodeLoading = useStore((state) => state.jsNodeLoading);
  const jsNodeErrors = useStore((state) => state.jsNodeErrors);
  const setJsNodeError = useStore((state) => state.setJsNodeError);
  const jsNodeResponses = useStore((state) => state.jsNodeResponses);
  const setApiNodeLoading = useStore((state) => state.setApiNodeLoading);
  const setApiNodeError = useStore((state) => state.setApiNodeError);
  const setApiNodeResponse = useStore((state) => state.setApiNodeResponse);
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeErrors = useStore((state) => state.apiNodeErrors);
  const workspaceTabs = useStore((state) => state.workspaceTabs);
  const openWorkspaceTab = useStore((state) => state.openWorkspaceTab);
  const closeWorkspaceTab = useStore((state) => state.closeWorkspaceTab);
  const markWorkspaceTabDirty = useStore((state) => state.markWorkspaceTabDirty);
  const setWorkspaceTabs = useStore((state) => state.setWorkspaceTabs);
  const activePrompts = useStore((state) => state.activePrompts);
  const setActivePrompt = useStore((state) => state.setActivePrompt);
  const setAppTheme = useStore((state) => state.setAppTheme);
  const uploadedMediaMetadata = useStore((state) => state.uploadedMediaMetadata);
  const setIsProxyModalOpen = useStore((state) => state.setIsProxyModalOpen);
  const setGlobalAlert = useStore((state) => state.setGlobalAlert);
  const isAssistantEnabled = useAssistantStore((s) => s.isEnabled);
  const setIsAssistantEnabled = useAssistantStore((s) => s.setIsEnabled);
  const [copied, setCopied] = useState(false);
  const [monaco, setMonaco] = useState<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInputValue, setPasteInputValue] = useState("");
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handlePasteFallback = () => {
      setIsPasteModalOpen(true);
      setPasteInputValue("");
      setTimeout(() => {
        pasteTextareaRef.current?.focus();
      }, 50);
    };

    window.addEventListener("monaco-request-paste-fallback", handlePasteFallback);
    return () => {
      window.removeEventListener("monaco-request-paste-fallback", handlePasteFallback);
    };
  }, []);

  // Active open file in the workspace
  const currentFilePath = activeExplorerFile || path;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('focusNode') && currentFilePath) {
      if (searchParams.get('focusNode') !== currentFilePath) {
        searchParams.set('focusNode', currentFilePath);
        const newUrl = `${window.location.pathname}?${searchParams.toString()}${window.location.hash}`;
        window.history.replaceState(null, '', newUrl);
      }
    }
  }, [currentFilePath]);

  const isEditingOtherFile = useMemo(() => {
    return !!(activeExplorerFile && activeExplorerFile !== path);
  }, [activeExplorerFile, path]);

  // Read code content dynamically for the active open file
  const code = useMemo(() => {
    const val =
      jsNodeCodeOverrides[currentFilePath] ??
      getValueAtPath(parsedData, currentFilePath) ??
      "";
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }, [jsNodeCodeOverrides, parsedData, currentFilePath]);

  const otherFileValue = useMemo(() => {
    if (!isEditingOtherFile) return undefined;
    const val =
      jsNodeCodeOverrides[currentFilePath] ??
      getValueAtPath(parsedData, currentFilePath);
    if (typeof val === "string") return val;
    if (val === undefined || val === null) return "";
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }, [isEditingOtherFile, currentFilePath, jsNodeCodeOverrides, parsedData]);

  // Determine file type and language dynamically
  const fileExt = useMemo(() => {
    return (
      currentFilePath
        .split(".")
        .pop()
        ?.replace(/\[[0-9]+\]$/, "")
        .toLowerCase() || ""
    );
  }, [currentFilePath]);

  const isTs = useMemo(
    () => fileExt.endsWith("_ts_node") || fileExt === "ts",
    [fileExt],
  );
  const isJs = useMemo(
    () => fileExt.endsWith("_js_node") || fileExt === "js",
    [fileExt],
  );
  const isPy = useMemo(
    () => fileExt.endsWith("_py_node") || fileExt === "py",
    [fileExt],
  );
  const isApi = useMemo(
    () => fileExt.endsWith("_api_node") || fileExt === "api",
    [fileExt],
  );
  const isTodo = useMemo(
    () => fileExt.endsWith("_todo_node") || fileExt === "todo",
    [fileExt],
  );
  const isSearch = useMemo(
    () => fileExt.endsWith("_search_node") || fileExt === "search",
    [fileExt],
  );
  const isImg = useMemo(() => {
    const ext = fileExt.toLowerCase();
    if (
      ext.endsWith("_image_node") ||
      ext === "img" ||
      ext === "image" ||
      ext === "png" ||
      ext === "jpg" ||
      ext === "jpeg" ||
      ext === "gif" ||
      ext === "webp"
    ) {
      return true;
    }

    const nodeVal = typeof code === "string" ? code : "";
    const rawVal = getValueAtPath(parsedData, currentFilePath);
    const rawObj =
      typeof rawVal === "object" && rawVal !== null ? (rawVal as any) : null;
    const assetIdToCheck = rawObj?.url || rawObj?.filename || nodeVal;

    let assetMimeType = "";
    if (assetIdToCheck && typeof assetIdToCheck === "string") {
      const assetMeta = uploadedMediaMetadata[assetIdToCheck];
      if (assetMeta && assetMeta.mimeType) {
        assetMimeType = assetMeta.mimeType.toLowerCase();
      }
    }

    if (
      assetMimeType.startsWith("image/") ||
      getMediaType(nodeVal) === "image"
    ) {
      return true;
    }

    return false;
  }, [fileExt, code, parsedData, currentFilePath, uploadedMediaMetadata]);
  const isJson = useMemo(
    () => fileExt.endsWith("_json") || fileExt === "json",
    [fileExt],
  );
  const isYaml = useMemo(
    () =>
      fileExt.endsWith("_yaml") ||
      fileExt === "yaml" ||
      fileExt.endsWith("_yml") ||
      fileExt === "yml",
    [fileExt],
  );
  const isCsv = useMemo(
    () => fileExt.endsWith("_csv") || fileExt === "csv",
    [fileExt],
  );
  const isXml = useMemo(
    () => fileExt.endsWith("_xml") || fileExt === "xml",
    [fileExt],
  );
  const isMd = useMemo(
    () => fileExt.endsWith("_md") || fileExt === "md",
    [fileExt],
  );
  const isTxt = useMemo(
    () => fileExt.endsWith("_txt") || fileExt === "txt",
    [fileExt],
  );

  const editorLanguage = useMemo(() => {
    if (isPy) return "python";
    if (isTs) return "typescript";
    if (isJs) return "javascript";
    if (isJson || isTodo) return "json";
    if (isYaml) return "yaml";
    if (isXml) return "xml";
    if (isMd) return "markdown";
    return "plaintext";
  }, [isPy, isTs, isJs, isJson, isYaml, isXml, isMd, isTodo]);

  const getTabIcon = (filePath: string, isActive: boolean) => {
    if (typeof filePath !== "string")
      return (
        <FileText
          size={13}
          className="text-slate-400 dark:text-slate-500 shrink-0"
        />
      );

    const lowerPath = filePath.toLowerCase();
    const isPy = lowerPath.endsWith("_py_node") || lowerPath.endsWith(".py");
    const isTs = lowerPath.endsWith("_ts_node") || lowerPath.endsWith(".ts");
    const isJs = lowerPath.endsWith("_js_node") || lowerPath.endsWith(".js");
    const isJson = lowerPath.endsWith("_json") || lowerPath.endsWith(".json");
    const isTodo =
      lowerPath.endsWith("_todo_node") || lowerPath.endsWith(".todo");
    const isMd = lowerPath.endsWith("_md") || lowerPath.endsWith(".md");

    let isImgIcon = false;
    if (lowerPath.match(/_image_node$|\.(img|image|png|jpe?g|gif|webp)$/i)) {
      isImgIcon = true;
    } else {
      const rawVal = getValueAtPath(parsedData, filePath);
      const nodeVal =
        typeof rawVal === "string"
          ? rawVal
          : typeof jsNodeCodeOverrides[filePath] === "string"
            ? jsNodeCodeOverrides[filePath]
            : "";
      const rawObj =
        typeof rawVal === "object" && rawVal !== null ? (rawVal as any) : null;
      const assetIdToCheck = rawObj?.url || rawObj?.filename || nodeVal;

      let assetMimeType = "";
      if (assetIdToCheck && typeof assetIdToCheck === "string") {
        const assetMeta = uploadedMediaMetadata[assetIdToCheck];
        if (assetMeta && assetMeta.mimeType) {
          assetMimeType = assetMeta.mimeType.toLowerCase();
        }
      }

      if (
        assetMimeType.startsWith("image/") ||
        getMediaType(nodeVal) === "image"
      ) {
        isImgIcon = true;
      }
    }

    if (isPy) return <PythonIcon />;
    if (isTs) return <TypeScriptIcon />;
    if (isJs) return <JavaScriptIcon />;
    if (isJson) return <JsonIcon />;
    if (isTodo)
      return <CheckSquare size={13} className="text-blue-500 shrink-0" />;
    if (isImgIcon)
      return <ImageIcon size={13} className="text-purple-500 shrink-0" />;
    if (isMd) return <MarkdownIcon />;

    return (
      <FileText
        size={13}
        className={
          isActive
            ? "text-yellow-500 shrink-0"
            : "text-slate-400 dark:text-slate-500 shrink-0"
        }
      />
    );
  };

  const getCleanName = (filePath: string) => {
    if (typeof filePath !== "string") return "";
    const rawName = filePath.split(".").pop() || "";
    if (rawName.endsWith("_ts_node")) return rawName.replace("_ts_node", ".ts");
    if (rawName.endsWith("_js_node")) return rawName.replace("_js_node", ".js");
    if (rawName.endsWith("_py_node")) return rawName.replace("_py_node", ".py");
    if (rawName.endsWith("_api_node"))
      return rawName.replace("_api_node", ".api");
    if (rawName.endsWith("_todo_node"))
      return rawName.replace("_todo_node", ".todo");
    if (rawName.endsWith("_json")) return rawName.replace("_json", ".json");
    if (rawName.endsWith("_yaml")) return rawName.replace("_yaml", ".yaml");
    if (rawName.endsWith("_yml")) return rawName.replace("_yml", ".yml");
    if (rawName.endsWith("_csv")) return rawName.replace("_csv", ".csv");
    if (rawName.endsWith("_xml")) return rawName.replace("_xml", ".xml");
    if (rawName.endsWith("_md")) return rawName.replace("_md", ".md");
    if (rawName.endsWith("_txt")) return rawName.replace("_txt", ".txt");
    return rawName;
  };

  const mainCleanName = useMemo(() => getCleanName(path), [path]);
  const activeCleanName = useMemo(
    () => getCleanName(currentFilePath),
    [currentFilePath],
  );

  // Breadcrumb trail under the tab bar, mirroring the VS Code editor header.
  const breadcrumbs = useMemo(() => {
    if (typeof currentFilePath !== "string") return [];
    const parts = currentFilePath.split(".").filter(Boolean);
    return parts.map((part, i) => {
      const segPath = parts.slice(0, i + 1).join(".");
      return {
        path: segPath,
        label: i === parts.length - 1 ? getCleanName(segPath) : part,
        isFile: i === parts.length - 1,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilePath]);

  // Run button visibility check: Show ONLY for .js, .ts, .py files
  const isExecutable = useMemo(() => {
    return isTs || isJs || isPy;
  }, [isTs, isJs, isPy]);

  // True when the tab is backed by the Monaco editor (so a caret exists).
  const hasTextEditor = !isTodo && !isImg && !isSearch;

  // Input data check
  const getJsNodeInputData = (pData: any, nPath: string): any => {
    if (!pData || !nPath) return null;
    const parts = nPath.split(".");
    if (parts.length > 1) {
      const parentParts = [...parts];
      parentParts.pop();
      const parentPath = parentParts.join(".");
      return getValueAtPath(pData, parentPath);
    }
    return pData;
  };

  const inputData = useMemo(
    () => getJsNodeInputData(parsedData, currentFilePath),
    [parsedData, currentFilePath],
  );

  // Read status and inputs/outputs dynamically
  const isLoading =
    jsNodeLoading[currentFilePath] || apiNodeLoading[currentFilePath] || false;
  const lastError =
    jsNodeErrors[currentFilePath] || apiNodeErrors[currentFilePath] || null;
  const resultData =
    jsNodeResponses[currentFilePath] || apiNodeResponses[currentFilePath];
  const hasData = resultData !== undefined;
  const executionTime = null;

  // Save changes locally and set in the store
  const debounceMap = useRef<Record<string, NodeJS.Timeout>>({});
  const handleUpdateGlobalCode = (fPath: string, newCode: string) => {
    if (debounceMap.current[fPath]) {
      clearTimeout(debounceMap.current[fPath]);
    }
    debounceMap.current[fPath] = setTimeout(() => {
      updateNodeValue(fPath, newCode);
    }, 1000);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setJsNodeCodeOverride(currentFilePath, value);
      const tab = workspaceTabs.find((t) => t.path === currentFilePath);
      if (tab && !tab.isDirty) {
        markWorkspaceTabDirty(currentFilePath, true);
      }
      // handleUpdateGlobalCode(currentFilePath, value); // Don't auto-save to JSON if we use explicit save
    }
  };

  const handleClearAllCode = () => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        editorRef.current.executeEdits("clear-all-code", [
          {
            range: model.getFullModelRange(),
            text: "",
          },
        ]);
        editorRef.current.pushUndoStop();
      } else {
        editorRef.current.setValue("");
      }
    }
    setJsNodeCodeOverride(currentFilePath, "");
    updateNodeValue(currentFilePath, "");
    const tab = workspaceTabs.find((t) => t.path === currentFilePath);
    if (tab && !tab.isDirty) {
      markWorkspaceTabDirty(currentFilePath, true);
    }
    setIsMinimapMenuOpen(false);
    useStore.getState().setNotification({
      message: "Cleared all code (Ctrl+Z / Cmd+Z to undo)",
      type: "info",
    });
  };

  // API fetching execution logic
  const fetchApiNode = async (targetPath: string, url: string) => {
    setApiNodeLoading(targetPath, true);
    setApiNodeError(targetPath, null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { _rawText: text };
      }
      setApiNodeResponse(targetPath, data);
    } catch (err: any) {
      setApiNodeError(targetPath, {
        type: "Fetch Error",
        code: "FETCH_ERR",
        message: err.message || "Fetch failed",
        userMessage: `Failed to fetch: ${err.message || "Fetch failed"}`,
        timestamp: new Date().toISOString(),
        requestInfo: {
          url,
          method: "GET",
          proxyUsed: false,
        },
      });
    } finally {
      setApiNodeLoading(targetPath, false);
    }
  };

  // Execution engine switch router
  const onExecute = (activeCodeValue: string) => {
    if (autoClearLogs) {
      clearLogs();
    }
    // Automatically make terminal visible when executing, and activate the Console tab
    if (terminalState === "hidden") {
      setTerminalState("normal");
    }
    setActiveTab("console");

    if (isTs) {
      setJsNodeCodeOverride(currentFilePath, activeCodeValue);
      updateNodeValue(currentFilePath, activeCodeValue);
      executeTsNode(currentFilePath, activeCodeValue);
    } else if (isJs) {
      setJsNodeCodeOverride(currentFilePath, activeCodeValue);
      updateNodeValue(currentFilePath, activeCodeValue);
      executeJsNode(currentFilePath, activeCodeValue);
    } else if (isPy) {
      setJsNodeCodeOverride(currentFilePath, activeCodeValue);
      updateNodeValue(currentFilePath, activeCodeValue);
      executePyNode(currentFilePath, activeCodeValue);
    } else if (isApi) {
      setJsNodeCodeOverride(currentFilePath, activeCodeValue);
      updateNodeValue(currentFilePath, activeCodeValue);
      fetchApiNode(currentFilePath, activeCodeValue);
    }
  };

  const submitActivePrompt = async (valueToSend: any) => {
    const currentPrompt = activePrompts[currentFilePath];
    if (!currentPrompt) return;

    // 1. Post to the Service Worker Synchronous I/O Bridge
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "STDIN_SUBMIT",
        sessionId: currentPrompt.sessionId,
        value: valueToSend,
      });
    }

    // 2. Append standard terminal log of the input
    let logText = String(valueToSend);
    if (currentPrompt.type === "confirm") {
      logText = valueToSend ? "Yes" : "No";
    } else if (currentPrompt.type === "alert") {
      logText = "[Dismissed Alert]";
    }

    await appendLogs(currentFilePath, [
      {
        type: "log",
        args: [logText],
        time: new Date().toISOString(),
      },
    ]);

    setTerminalInput("");
    // 3. Clear prompt state to dismiss expectations
    setActivePrompt(currentFilePath, null);
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if there is an active running prompt awaiting input for the current file
    const currentPrompt = activePrompts[currentFilePath];
    if (currentPrompt) {
      let finalValue: any = terminalInput;
      if (currentPrompt.type === "confirm") {
        const normalized = terminalInput.trim().toLowerCase();
        // If empty or y/yes/true/ok/1, it means affirmative. Otherwise negative.
        const isYes =
          normalized === "" ||
          normalized === "y" ||
          normalized === "yes" ||
          normalized === "true" ||
          normalized === "1" ||
          normalized === "ok";
        finalValue = isYes;
      } else if (currentPrompt.type === "alert") {
        finalValue = null;
      }

      await submitActivePrompt(finalValue);
      return;
    }

    const command = terminalInput.trim();
    if (!command) return;

    setTerminalInput("");

    await appendLogs(currentFilePath, [
      {
        type: "log",
        args: [`$ ${command}`],
        time: new Date().toISOString(),
      },
    ]);

    const parts = command.split(/\s+/);
    const cmd = parts[0];

    if (cmd === "pip") {
      const action = parts[1];
      if (action === "install") {
        const pkgs = parts.slice(2);
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [
            {
              type: "error",
              args: [
                "ERROR: You must specify at least one package to install.",
              ],
              time: new Date().toISOString(),
            },
          ]);
          return;
        }

        for (const pkg of pkgs) {
          const cleanPkg = pkg.trim();
          if (cleanPkg) {
            await usePyPackageStore
              .getState()
              .installPackage(cleanPkg, currentFilePath);
          }
        }
      } else if (action === "uninstall" || action === "remove") {
        const pkgs = parts.slice(2);
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [
            {
              type: "error",
              args: ["ERROR: You must specify a package to uninstall."],
              time: new Date().toISOString(),
            },
          ]);
          return;
        }

        for (const pkg of pkgs) {
          const cleanPkg = pkg.trim();
          if (cleanPkg) {
            await usePyPackageStore
              .getState()
              .uninstallPackage(cleanPkg, currentFilePath);
          }
        }
      } else if (action === "list") {
        const pkgs = usePyPackageStore.getState().installedPackages;
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [
            {
              type: "log",
              args: ["No packages installed in this workspace."],
              time: new Date().toISOString(),
            },
          ]);
          return;
        }

        let output = "Package        Version\n";
        output += "-------------- -------\n";
        pkgs.forEach((p) => {
          output += `${p.name.padEnd(14)} ${p.version}\n`;
        });

        await appendLogs(currentFilePath, [
          {
            type: "log",
            args: [output],
            time: new Date().toISOString(),
          },
        ]);
      } else {
        await appendLogs(currentFilePath, [
          {
            type: "error",
            args: [
              `ERROR: Unknown pip command "pip ${action}". Try: pip install, pip uninstall, pip list`,
            ],
            time: new Date().toISOString(),
          },
        ]);
      }
    } else if (cmd === "python") {
      const activeCodeValue =
        jsNodeCodeOverrides[currentFilePath] ||
        getValueAtPath(parsedData, currentFilePath) ||
        "";
      onExecute(activeCodeValue);
    } else if (cmd === "clear") {
      clearLogs();
    } else if (cmd === "help") {
      await appendLogs(currentFilePath, [
        {
          type: "log",
          args: [
            "Interactive Python Console Shell Commands:\n" +
            "  pip install <pkgs>   - Install libraries from Pyodide prebuilds or PyPI\n" +
            "  pip uninstall <pkg>  - Delete a package from the persisted workspace\n" +
            "  pip list             - Display installed dependencies\n" +
            "  python               - Run the active Python workbook file\n" +
            "  clear                - Erase all terminal text",
          ],
          time: new Date().toISOString(),
        },
      ]);
    } else {
      await appendLogs(currentFilePath, [
        {
          type: "error",
          args: [
            `Command error: "${cmd}" is not recognized. Type "help" for a list of valid commands.`,
          ],
          time: new Date().toISOString(),
        },
      ]);
    }
  };

  const onAbort = () => {
    if (isTs) {
      abortTsNode(currentFilePath);
    } else if (isJs) {
      abortJsNode(currentFilePath);
    } else if (isPy) {
      abortPyNode(currentFilePath);
    }
  };

  // TypeScript schema auto-generation for Monaco typescript compiler
  const extraLibRef = useRef<{ dispose(): void } | null>(null);
  const lastExtraLibSourceRef = useRef<string>("");

  // TypeScript schema auto-generation for Monaco typescript compiler
  useEffect(() => {
    if (!monaco) return;

    try {
      const tsDefaults = (monaco.languages as any)?.typescript?.typescriptDefaults;
      if (!tsDefaults) return;

      const { types, entry } = generateTypeScriptSchema(inputData, "Input");
      const libUri = "ts:globals/schema.d.ts";

      const libSource = `
/**
 * Auto-generated Types from surrounding Pipeline State
 */
${types}

${entry}

declare const console: {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  clear(): void;
};
      `;

      // Only re-mount extraLib if the schema content actually changed
      if (lastExtraLibSourceRef.current !== libSource) {
        lastExtraLibSourceRef.current = libSource;
        if (extraLibRef.current) {
          try {
            extraLibRef.current.dispose();
          } catch {}
        }
        extraLibRef.current = tsDefaults.addExtraLib(libSource, libUri);
      }
    } catch (err) {
      console.warn("Failed to mount type definitions to Monaco service", err);
    }
  }, [monaco, inputData]);

  // Clean up extraLib only when CodeWorkspace is unmounted
  useEffect(() => {
    return () => {
      if (extraLibRef.current) {
        try {
          extraLibRef.current.dispose();
          extraLibRef.current = null;
          lastExtraLibSourceRef.current = "";
        } catch {}
      }
    };
  }, []);

  // Configure Monaco globally to prevent name clashes
  useEffect(() => {
    if (monaco) {
      try {
        if (monaco.languages && (monaco.languages as any).typescript) {
          if ((window as any).__monacoCompilerConfigured) return;
          (window as any).__monacoCompilerConfigured = true;

          const tsDefaults = (monaco.languages as any).typescript
            .typescriptDefaults;
          const jsDefaults = (monaco.languages as any).typescript
            .javascriptDefaults;

          [tsDefaults, jsDefaults].forEach((defaults) => {
            if (!defaults) return;
            const currentOptions = defaults.getCompilerOptions();
            defaults.setCompilerOptions({
              ...currentOptions,
              target:
                (monaco.languages as any).typescript.ScriptTarget?.Latest ?? 99,
              module:
                (monaco.languages as any).typescript.ModuleKind?.ESNext ?? 99,
              moduleResolution:
                (monaco.languages as any).typescript.ModuleResolutionKind
                  ?.NodeJs ?? 2,
              allowNonTsExtensions: true,
              allowJs: true,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              isolatedModules: true,
              resolveJsonModule: true,
              moduleDetection: 3,
            });
            defaults.setDiagnosticsOptions({
              diagnosticCodesToIgnore: [2451, 2300, 2307, 7016],
            });
          });
        }
      } catch (err) {
        console.warn("Failed to configure Monaco compiler settings", err);
      }
    }
  }, [monaco]);

  const { logCount, getLog, clearLogs, startOffset } =
    useExecutionLogs(currentFilePath);

  const formatConsoleArg = (arg: any): string => {
    if (typeof arg === "string") return arg;
    if (typeof arg === "undefined") return "\x1b[90mundefined\x1b[0m"; // grey
    if (arg === null) return "\x1b[1m\x1b[36mnull\x1b[0m"; // bold cyan
    if (typeof arg === "number") return `\x1b[33m${arg}\x1b[0m`; // yellow
    if (typeof arg === "boolean") return `\x1b[35m${arg}\x1b[0m`; // magenta
    if (typeof arg === "object") {
      return safeStringify(arg);
    }
    return String(arg);
  };

  const renderColorizedOutput = (text: string) => {
    const parts = text.split(/(\x1b\[[0-9;]*m)/g);
    let currentStyle: React.CSSProperties = {};
    return parts.map((part, index) => {
      if (part.startsWith("\x1b[")) {
        if (part === "\x1b[0m") {
          currentStyle = {};
        } else if (part === "\x1b[90m") {
          currentStyle = { color: "#6e7681" };
        } else if (part === "\x1b[1m\x1b[36m" || part === "\x1b[36m") {
          currentStyle = { color: "#56b6c2", fontWeight: "bold" };
        } else if (part === "\x1b[33m") {
          currentStyle = { color: "#d19a66" };
        } else if (part === "\x1b[35m") {
          currentStyle = { color: "#c678dd" };
        }
        return null;
      }
      return (
        <span
          key={index}
          style={currentStyle}
          className="whitespace-pre-wrap break-all"
        >
          {part}
        </span>
      );
    });
  };

  const renderArgElement = (arg: any, index: number) => {
    if (typeof arg === "string") {
      if (
        arg.startsWith("__MATPLOTLIB_IMAGE__:") ||
        arg.startsWith("__MATPLOTLIB_IMAGE_JSON__:")
      ) {
        return <MatplotlibPlotViewer key={index} imageData={arg} />;
      }

      // Auto-detect LaTeX patterns
      const isLatex =
        /^[\s\n]*\\(mathrm|frac|sqrt|begin|sum|int|mathbf|left|right|alpha|beta|gamma|Delta|pi|mu|sigma|theta|omega|rho|lambda)/.test(
          arg,
        ) ||
        /^[\s\n]*\$\$.*\$\$[\s\n]*$/s.test(arg) ||
        /^[\s\n]*\\\[.*\\\][\s\n]*$/s.test(arg);

      if (isLatex) {
        try {
          let tex = arg.trim();
          if (tex.startsWith("$$") && tex.endsWith("$$")) {
            tex = tex.slice(2, -2);
          } else if (tex.startsWith("\\[") && tex.endsWith("\\]")) {
            tex = tex.slice(2, -2);
          }
          return (
            <div
              key={index}
              className="w-full overflow-x-auto py-2 katex-display-wrapper"
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(tex, {
                    displayMode: true,
                    throwOnError: false,
                  }),
                }}
              />
            </div>
          );
        } catch (e) {
          // Fallback to text if error
        }
      }

      const colorized = renderColorizedOutput(arg);
      return (
        <span key={index} className="whitespace-pre-wrap break-all">
          {colorized}
        </span>
      );
    }
    if (typeof arg === "undefined") {
      return (
        <span
          key={index}
          className="text-slate-400 dark:text-slate-500 italic whitespace-pre-wrap break-all"
        >
          undefined
        </span>
      );
    }
    if (arg === null) {
      return (
        <span
          key={index}
          className="text-cyan-500 dark:text-cyan-400 font-bold whitespace-pre-wrap break-all"
        >
          null
        </span>
      );
    }
    if (typeof arg === "number") {
      return (
        <span
          key={index}
          className="text-amber-600 dark:text-amber-400 whitespace-pre-wrap break-all"
        >
          {arg}
        </span>
      );
    }
    if (typeof arg === "boolean") {
      return (
        <span
          key={index}
          className="text-purple-500 dark:text-purple-400 whitespace-pre-wrap break-all"
        >
          {String(arg)}
        </span>
      );
    }
    if (typeof arg === "object") {
      const displayed = safeStringify(arg, 2);
      return (
        <span
          key={index}
          className="text-blue-600 dark:text-blue-400 whitespace-pre-wrap break-all font-mono"
        >
          {displayed}
        </span>
      );
    }
    return (
      <span key={index} className="whitespace-pre-wrap break-all">
        {String(arg)}
      </span>
    );
  };

  // Settings
  const [settings, setSettings] = useState<WorkspaceSettings>(() => {
    try {
      const saved = localStorage.getItem("workspace_layout_settings");
      return saved ? JSON.parse(saved) : defaultWorkspaceSettings;
    } catch {
      return defaultWorkspaceSettings;
    }
  });

  const saveSettings = (newStg: WorkspaceSettings) => {
    setSettings(newStg);
    try {
      localStorage.setItem("workspace_layout_settings", JSON.stringify(newStg));
    } catch (e) {
      // ignore
    }
  };

  // Patch a single setting from the latest state. Sash drags fire many times a
  // second, so they must not close over a stale `settings` object.
  const updateSettings = useCallback((patch: Partial<WorkspaceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("workspace_layout_settings", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const [isLayoutSettingsOpen, setIsLayoutSettingsOpen] = useState(false);
  const [panelSize, setPanelSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("workspace_panel_size");
      return saved ? parseInt(saved, 10) : 320;
    } catch {
      return 320;
    }
  });

  const [activeTab, setActiveTab] = useState<"result" | "console">("console");
  const [sidebarTab, setSidebarTab] = useState<"files" | "packages">("files");
  const [terminalInput, setTerminalInput] = useState("");
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"bottom" | "right">("bottom");
  const [terminalState, setTerminalState] = useState<
    "normal" | "maximized" | "hidden"
  >("normal");
  const [wordWrap, setWordWrap] = useState<"on" | "off">(
    () => settings.wordWrap || "on"
  );

  const toggleWordWrap = (target?: "on" | "off") => {
    const next = target ?? (wordWrap === "on" ? "off" : "on");
    setWordWrap(next);
    saveSettings({ ...settings, wordWrap: next });
  };

  const [cursorPos, setCursorPos] = useState({
    line: 1,
    column: 1,
    selected: 0,
  });

  // Viewport tracking: the three panes have to stay usable down to phone width.
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const isMobile = viewport.w < 768;
  // A side-by-side console needs real estate, so narrow screens always stack it.
  const effectiveLayout: "bottom" | "right" =
    viewport.w < 1024 ? "bottom" : layoutMode;
  const sidebarOpen = settings.isSidebarOpen !== false;
  const sidebarWidth = Math.max(
    170,
    Math.min(settings.sidebarWidth || 260, 640),
  );

  // Editor zoom. Unset means "follow the responsive default", so a phone still
  // starts a point smaller until the reader picks a size of their own.
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 32;
  const defaultFontSizeRef = useRef(13);
  defaultFontSizeRef.current = isMobile ? 12 : 13;

  const editorFontSize = Math.min(
    MAX_FONT_SIZE,
    Math.max(MIN_FONT_SIZE, settings.fontSize || defaultFontSizeRef.current),
  );

  // Stable so the keyboard shortcuts below can call it without stale state.
  const changeFontSize = useCallback((delta: number) => {
    setSettings((prev) => {
      const next: WorkspaceSettings = { ...prev };
      if (delta === 0) {
        delete next.fontSize;
      } else {
        const base = prev.fontSize || defaultFontSizeRef.current;
        next.fontSize = Math.min(32, Math.max(8, base + delta));
      }
      try {
        localStorage.setItem("workspace_layout_settings", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const terminalInputRef = useRef<HTMLInputElement>(null);
  const currentPrompt = activePrompts[currentFilePath];

  useEffect(() => {
    if (isTodo || isImg || isSearch) {
      setTerminalState("hidden");
    }
  }, [isTodo, isImg, isSearch]);

  // Auto-focus terminal input whenever a STDIN or alert/prompt/confirm prompt details are activated
  useEffect(() => {
    if (currentPrompt) {
      setTimeout(() => {
        if (terminalInputRef.current) {
          terminalInputRef.current.focus();
          terminalInputRef.current.select();
        }
      }, 50);
    }
  }, [currentPrompt]);

  // Reset sidebar tab back to explorer files when not looking at a Python workbook file
  useEffect(() => {
    if (!isPy && sidebarTab !== "files") {
      setSidebarTab("files");
    }
  }, [isPy, sidebarTab]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Terminal: Alt + `, Ctrl + `, Cmd + `
      if ((e.altKey || e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setTerminalState((prev) => (prev === "hidden" ? "normal" : "hidden"));
      }
      // Editor zoom: Ctrl/Cmd with + / - / 0
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          changeFontSize(1);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          changeFontSize(-1);
        } else if (e.key === "0") {
          e.preventDefault();
          changeFontSize(0);
        }
      }
      // Toggle Word Wrap: Alt + Z
      if (e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        toggleWordWrap();
      }
      // Save all modified tabs: Ctrl+Shift+S / Cmd+Shift+S
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        const state = useStore.getState();
        state.workspaceTabs.forEach((tab) => {
          if (tab.isDirty) {
            const unsavedVal = state.jsNodeCodeOverrides[tab.path];
            if (unsavedVal !== undefined) {
              state.updateNodeValue(tab.path, unsavedVal);
              state.markWorkspaceTabDirty(tab.path, false);
            }
          }
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep focus settings
  useEffect(() => {
    if (jsNodeFocusLine !== null) {
      if (jsNodeFocusLine.path === currentFilePath && editorRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              if (editorRef.current) {
                editorRef.current.revealLineInCenter(jsNodeFocusLine.line);
                editorRef.current.setPosition({
                  lineNumber: jsNodeFocusLine.line,
                  column: jsNodeFocusLine.column || 1,
                });
                editorRef.current.focus();
              }
            } catch (err) {
              // ignore errors gracefully
            }
          }, 50);
        });
        setJsNodeFocusLine(null);
      } else if (jsNodeFocusLine.path !== currentFilePath) {
        openWorkspaceTab(jsNodeFocusLine.path, false);
      }
    }
  }, [jsNodeFocusLine, currentFilePath, setJsNodeFocusLine, openWorkspaceTab]);

  useEffect(() => {
    if (monaco && parsedData) {
      syncWorkspaceModelsToMonaco(monaco, parsedData);
    }
  }, [monaco, parsedData]);

  // Code editor options properties
  const codeEditorOptions = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);
    const defaultScrollbarSize = isMobile ? 12 : 8;
    return {
      minimap: { enabled: isMobile ? false : settings.enabled },
      fixedOverflowWidgets: true,
      contextmenu: true,
      lineNumbers: "on" as const,
      scrollBeyondLastLine: isMobile ? true : false,
      fontSize: editorFontSize,
      fontFamily: "Fira Code, SFMono-Regular, Consolas, Menlo, monospace",
      automaticLayout: true,
      tabSize: 2,
      wordWrap: wordWrap,
      folding: true,
      lineDecorationsWidth: 10,
      renderWhitespace: settings.renderCharacters
        ? ("all" as const)
        : ("none" as const),
      padding: { top: 8, bottom: isMobile ? 60 : 8 },
      scrollbar: {
        verticalSliderSize:
          settings.verticalSize === "fit"
            ? defaultScrollbarSize
            : settings.verticalSize === "large"
              ? 14
              : settings.verticalSize === "small"
                ? (isMobile ? 10 : 4)
                : defaultScrollbarSize,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        horizontal: "auto" as const,
        vertical: "auto" as const,
        arrowSize: 11,
        useShadows: true,
        horizontalSliderSize: defaultScrollbarSize,
        verticalScrollbarSize: defaultScrollbarSize,
        horizontalScrollbarSize: defaultScrollbarSize,
      },
      theme:
        settings.editorTheme === "default"
          ? appTheme === "dark"
            ? "customDark"
            : "customLight"
          : settings.editorTheme,
    };
  }, [settings, appTheme, wordWrap]);

  // --- Pane resizing -------------------------------------------------------
  // Every splitter is a <WorkspaceSash>: pointer (mouse/touch/pen) drag,
  // arrow-key nudges and double-click reset. The corner sash drives both the
  // sidebar and the panel at once.
  const consolePanelRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const workspaceBodyRef = useRef<HTMLDivElement>(null);

  const panelSizeRef = useRef(panelSize);
  panelSizeRef.current = panelSize;

  const clampSidebar = useCallback(
    (w: number) => {
      const available = workspaceBodyRef.current?.clientWidth || viewport.w;
      return Math.round(
        Math.max(170, Math.min(w, Math.max(200, available - 240))),
      );
    },
    [viewport.w],
  );

  const clampPanel = useCallback(
    (v: number) => {
      const box = workspaceBodyRef.current;
      if (effectiveLayout === "bottom") {
        const h = box?.clientHeight || viewport.h;
        return Math.round(Math.max(90, Math.min(v, Math.max(120, h - 140))));
      }
      const w =
        (box?.clientWidth || viewport.w) -
        (sidebarOpen && !isMobile ? sidebarWidth : 0);
      return Math.round(Math.max(180, Math.min(v, Math.max(220, w - 260))));
    },
    [effectiveLayout, viewport.h, viewport.w, sidebarOpen, isMobile, sidebarWidth],
  );

  const writePanelSize = useCallback((v: number) => {
    try {
      localStorage.setItem("workspace_panel_size", String(v));
    } catch {
      // ignore
    }
  }, []);

  // Keep both panes inside the frame when the window rotates or resizes.
  useEffect(() => {
    setPanelSize((prev) => {
      const next = clampPanel(prev);
      return next === prev ? prev : next;
    });
    const current = settings.sidebarWidth || 260;
    const nextSidebar = clampSidebar(current);
    if (nextSidebar !== current) updateSettings({ sidebarWidth: nextSidebar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.w, viewport.h, effectiveLayout]);

  const dragBase = useRef({ sidebar: 260, panel: 320 });
  const liveSidebar = useRef(260);
  const livePanel = useRef(320);

  const beginPaneDrag = useCallback(() => {
    dragBase.current = {
      sidebar: settings.sidebarWidth || 260,
      panel: panelSizeRef.current,
    };
    liveSidebar.current = dragBase.current.sidebar;
    livePanel.current = dragBase.current.panel;
  }, [settings.sidebarWidth]);

  // Drags write straight to the DOM - a React round trip per pointermove would
  // re-render Monaco and the log list on every frame.
  const resizeSidebar = useCallback(
    (dx: number) => {
      const w = clampSidebar(dragBase.current.sidebar + dx);
      liveSidebar.current = w;
      sidebarRef.current?.style.setProperty("--sidebar-width", `${w}px`);
      workspaceBodyRef.current?.style.setProperty("--sash-x", `${w}px`);
    },
    [clampSidebar],
  );

  const endSidebarDrag = useCallback(() => {
    updateSettings({ sidebarWidth: liveSidebar.current });
  }, [updateSettings]);

  const resizePanel = useCallback(
    (dx: number, dy: number) => {
      // The sash sits before the panel, so dragging towards it shrinks the pane.
      const delta = effectiveLayout === "bottom" ? -dy : -dx;
      const v = clampPanel(dragBase.current.panel + delta);
      livePanel.current = v;
      const el = consolePanelRef.current;
      if (el) {
        if (effectiveLayout === "bottom") {
          el.style.height = `${v}px`;
        } else {
          el.style.width = `${v}px`;
        }
      }
      workspaceBodyRef.current?.style.setProperty("--sash-y", `${v}px`);
    },
    [clampPanel, effectiveLayout],
  );

  const endPanelDrag = useCallback(() => {
    setPanelSize(livePanel.current);
    writePanelSize(livePanel.current);
  }, [writePanelSize]);

  const resizeBoth = useCallback(
    (dx: number, dy: number) => {
      resizeSidebar(dx);
      resizePanel(dx, dy);
    },
    [resizeSidebar, resizePanel],
  );

  const endBothDrag = useCallback(() => {
    endSidebarDrag();
    endPanelDrag();
  }, [endSidebarDrag, endPanelDrag]);

  const resetSidebar = useCallback(() => {
    updateSettings({ sidebarWidth: 260 });
  }, [updateSettings]);

  const resetPanel = useCallback(() => {
    const next = clampPanel(320);
    setPanelSize(next);
    writePanelSize(next);
  }, [clampPanel, writePanelSize]);

  const resetLayout = useCallback(() => {
    resetSidebar();
    resetPanel();
  }, [resetSidebar, resetPanel]);


  // Go to Line functionality
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState("");
  const editorRef = useRef<any>(null);

  const handleFormatDocument = async () => {
    if (!editorRef.current) return;
    try {
      if (editorLanguage === "python") {
        const current = editorRef.current.getValue();
        const formatted = formatPythonCode(current);
        if (formatted !== current) {
          const model = editorRef.current.getModel();
          if (model) {
            editorRef.current.executeEdits("python-formatter", [
              { range: model.getFullModelRange(), text: formatted },
            ]);
            editorRef.current.pushUndoStop();
          }
        }
      } else {
        await editorRef.current
          .getAction("editor.action.formatDocument")
          ?.run();
      }
    } catch (err) {
      console.warn("Monaco document formatting error:", err);
    }
  };

  const handleCopyContents = () => {
    navigator.clipboard.writeText(
      editorRef.current ? editorRef.current.getValue() : code,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteGoToLine = () => {
    if (!goToLineValue.trim()) return;
    const parts = goToLineValue.split(":");
    const line = parseInt(parts[0], 10);
    const col = parts[1] ? parseInt(parts[1], 10) : 1;
    if (editorRef.current && !isNaN(line)) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: col });
      editorRef.current.focus();
    }
    setIsGoToLineOpen(false);
  };

  const [isMinimapMenuOpen, setIsMinimapMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<
    "size" | "slider" | "side" | "theme" | null
  >(null);
  const minimapMenuRef = useRef<HTMLDivElement>(null);
  const minimapBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (
        minimapMenuRef.current &&
        !minimapMenuRef.current.contains(e.target as Node) &&
        minimapBtnRef.current &&
        !minimapBtnRef.current.contains(e.target as Node)
      ) {
        setIsMinimapMenuOpen(false);
        setActiveSubmenu(null);
      }
    };
    if (isMinimapMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside, {
        capture: true,
      });
      document.addEventListener("touchstart", handleClickOutside, {
        capture: true,
      });
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, {
        capture: true,
      });
      document.removeEventListener("touchstart", handleClickOutside, {
        capture: true,
      });
    };
  }, [isMinimapMenuOpen]);

  const latestRefs = useRef({
    onExecute,
    onClose,
    isExecutable,
    updateNodeValue,
    markWorkspaceTabDirty,
    currentFilePath,
    setTerminalState,
    terminalState,
    setIsGoToLineOpen,
    setGoToLineValue,
    openWorkspaceTab,
  });

  useEffect(() => {
    latestRefs.current = {
      onExecute,
      onClose,
      isExecutable,
      updateNodeValue,
      markWorkspaceTabDirty,
      currentFilePath,
      setTerminalState,
      terminalState,
      setIsGoToLineOpen,
      setGoToLineValue,
      openWorkspaceTab,
    };
  });

  const handleEditorWillMount = (m: any) => {
    setMonaco(m);
    try {
      m.editor.defineTheme("customDark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: buildMonacoColors(DEFAULT_SHELL.dark.bg, DEFAULT_SHELL.dark.fg),
      });
      m.editor.defineTheme("customLight", {
        base: "vs",
        inherit: true,
        rules: [],
        colors: buildMonacoColors(
          DEFAULT_SHELL.light.bg,
          DEFAULT_SHELL.light.fg,
        ),
      });
      Object.entries(editorThemes).forEach(([id, themeData]) => {
        const colors = (themeData as any)?.colors || {};
        m.editor.defineTheme(id, {
          ...(themeData as any),
          colors: {
            ...buildMonacoColors(
              colors["editor.background"],
              colors["editor.foreground"],
            ),
            ...colors,
          },
        });
      });
    } catch {
      // ignores already defined
    }
  };

  // The shell (side bar, tabs, panel, status bar) is tinted from the active
  // editor theme, so the chrome never clashes with the code surface.
  const shellBase = useMemo(() => {
    const chosen = settings.editorTheme;
    if (chosen && chosen !== "default") {
      const colors = (editorThemes as any)[chosen]?.colors;
      if (colors?.["editor.background"] && colors?.["editor.foreground"]) {
        return {
          bg: colors["editor.background"] as string,
          fg: colors["editor.foreground"] as string,
        };
      }
    }
    return appTheme === "dark" ? DEFAULT_SHELL.dark : DEFAULT_SHELL.light;
  }, [settings.editorTheme, appTheme]);

  const shellPalette = useMemo(
    () => buildShellPalette(shellBase.bg, shellBase.fg),
    [shellBase],
  );

  // Dialogs that portal to document.body (proxy settings, alerts) sit outside
  // this subtree, so publish the palette on the document root while the
  // workspace is open and take it back down on close.
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(shellPalette).forEach(([key, value]) =>
      root.style.setProperty(key, value),
    );
    return () => {
      Object.keys(shellPalette).forEach((key) =>
        root.style.removeProperty(key),
      );
    };
  }, [shellPalette]);

  // Shared VS Code style control classes
  const iconBtn =
    "p-1.5 rounded-[4px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--vsc-accent)]";
  const iconBtnOn = "bg-[var(--vsc-active)] text-[var(--vsc-fg)]";
  const menuItem =
    "w-full text-left px-3 py-1.5 hover:bg-[var(--vsc-hover)] flex justify-between items-center gap-3 transition-colors cursor-pointer";
  const panelTab = (active: boolean) =>
    `relative flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap shrink-0 transition-colors cursor-pointer outline-none border-b-2 ${active
      ? "text-[var(--vsc-fg)] border-[var(--vsc-accent)]"
      : "text-[var(--vsc-fg-muted)] border-transparent hover:text-[var(--vsc-fg)]"
    }`;

  return createPortal(
    <div
      style={shellPalette as React.CSSProperties}
      className="vsc-root fixed inset-0 z-[1000] bg-[var(--vsc-editor)] text-[var(--vsc-fg)] flex items-center justify-center p-0 nodrag"
    >
      <div
        className="w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex justify-between items-center gap-1 px-2 md:px-3 min-h-[38px] border-b border-[var(--vsc-border)] bg-[var(--vsc-titlebar)] select-none shrink-0">
          {/* Workspace identity */}
          <div className="flex items-center gap-2 min-w-0 flex-1 basis-0">
            <div className="hidden md:flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium text-[var(--vsc-fg-muted)] bg-[var(--vsc-hover)] shrink-0">
              <FolderOpen size={13} />
              <span>Workspace</span>
            </div>
            <div
              className="flex items-center gap-1 min-w-0 text-[13px] text-[var(--vsc-fg)]"
              title={currentFilePath}
            >
              <span className="truncate font-medium">{mainCleanName}</span>
              {isEditingOtherFile && (
                <>
                  <ChevronRight
                    size={13}
                    className="text-[var(--vsc-fg-muted)] shrink-0"
                  />
                  <span className="truncate text-[var(--vsc-accent)]">
                    {activeCleanName}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Command centre: shows the open file, opens Go to Line */}
          <button
            onClick={() => {
              setIsGoToLineOpen(true);
              setGoToLineValue("");
            }}
            title={`${currentFilePath} - Go to Line (Ctrl+G)`}
            className="hidden lg:flex items-center justify-center gap-2 h-[26px] flex-[0_1_440px] min-w-0 px-3 mx-2 rounded-[6px] border border-[var(--vsc-border-strong)] bg-[var(--vsc-input)] text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer"
          >
            {getTabIcon(currentFilePath, true)}
            <span className="shrink-0 text-[12px] text-[var(--vsc-fg)]">
              {activeCleanName}
            </span>
            <span className="truncate min-w-0 text-[11px] text-[var(--vsc-fg-muted)]">
              {currentFilePath}
            </span>
          </button>

          <div className="flex items-center justify-end gap-1 flex-1 basis-0">
            {/* Run Button (Executable files only) */}
            {isExecutable && (
              <div className="flex items-center rounded-[4px] bg-[var(--vsc-hover)] p-0.5 mr-1">
                <button
                  disabled={isLoading}
                  onClick={() =>
                    onExecute(
                      editorRef.current ? editorRef.current.getValue() : code,
                    )
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-[3px] cursor-pointer transition-colors whitespace-nowrap ${isLoading
                    ? "text-[var(--vsc-fg-muted)] cursor-not-allowed"
                    : "bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] hover:opacity-90"
                    }`}
                  title="Run (Ctrl+Enter)"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      <span className="hidden sm:inline">Running...</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} fill="currentColor" className="shrink-0" />
                      <span className="hidden sm:inline">
                        {isApi ? "Fetch" : "Run"}
                      </span>
                    </>
                  )}
                </button>

                {onAbort && (
                  <button
                    disabled={!isLoading}
                    onClick={onAbort}
                    className={`p-1 rounded-[3px] ml-0.5 transition-colors cursor-pointer ${isLoading
                      ? "text-red-500 hover:bg-red-500/15"
                      : "text-[var(--vsc-fg-muted)] opacity-50 cursor-not-allowed"
                      }`}
                    title="Stop Execution"
                  >
                    <Square size={12} fill={isLoading ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            )}

            {/* Editor actions - folded into the settings menu on phones */}
            <button
              onClick={() => {
                setIsGoToLineOpen(true);
                setGoToLineValue("");
              }}
              className={`${iconBtn} hidden sm:block text-xs font-mono font-semibold`}
              title="Go to line (Ctrl+G)"
            >
              Line
            </button>

            <button
              onClick={handleFormatDocument}
              className={`${iconBtn} hidden sm:block text-xs font-semibold`}
              title="Format Document (Shift+Alt+F)"
            >
              Format
            </button>

            <button
              onClick={handleCopyContents}
              className={`${iconBtn} hidden sm:flex items-center justify-center min-w-[28px]`}
              title="Copy Contents"
            >
              {copied ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>

            {/* Advanced Minimap/Editor Config */}
            <div className="relative shrink-0">
              <button
                ref={minimapBtnRef}
                onClick={() => setIsMinimapMenuOpen(!isMinimapMenuOpen)}
                className={`${iconBtn} ${isMinimapMenuOpen ? iconBtnOn : ""}`}
                title="Editor Options & Themes"
              >
                <Settings2 size={14} />
              </button>

              {isMinimapMenuOpen && (
                <div
                  ref={minimapMenuRef}
                  className="absolute right-0 mt-1.5 w-60 bg-[var(--vsc-widget)] border border-[var(--vsc-border-strong)] shadow-[0_4px_18px_var(--vsc-widget-shadow)] rounded-[6px] py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs select-none"
                >
                  {/* Phone-only duplicates of the toolbar actions */}
                  <div className="sm:hidden">
                    <div className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider text-[var(--vsc-fg-muted)]">
                      Actions
                    </div>
                    <button
                      onClick={() => {
                        setIsMinimapMenuOpen(false);
                        setIsGoToLineOpen(true);
                        setGoToLineValue("");
                      }}
                      className={menuItem}
                    >
                      <span>Go to Line...</span>
                      <span className="text-[10px] text-[var(--vsc-fg-muted)]">
                        Ctrl+G
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMinimapMenuOpen(false);
                        handleFormatDocument();
                      }}
                      className={menuItem}
                    >
                      <span>Format Document</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMinimapMenuOpen(false);
                        handleCopyContents();
                      }}
                      className={menuItem}
                    >
                      <span>Copy Contents</span>
                    </button>
                    <div className="border-t border-[var(--vsc-border)] my-1" />
                  </div>

                  <div className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider text-[var(--vsc-fg-muted)]">
                    Editor Preferences
                  </div>

                  <button
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        enabled: !settings.enabled,
                      })
                    }
                    className={menuItem}
                  >
                    <span>Show Minimap</span>
                    {settings.enabled && (
                      <Check size={12} className="text-[var(--vsc-accent)]" />
                    )}
                  </button>

                  <button
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        renderCharacters: !settings.renderCharacters,
                      })
                    }
                    className={menuItem}
                  >
                    <span>Show Whitespace</span>
                    {settings.renderCharacters && (
                      <Check size={12} className="text-[var(--vsc-accent)]" />
                    )}
                  </button>

                  <button
                    onClick={() => toggleWordWrap()}
                    className={menuItem}
                  >
                    <span>Text Wrap</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--vsc-fg-muted)]">
                        Alt+Z
                      </span>
                      {wordWrap === "on" && (
                        <Check size={12} className="text-[var(--vsc-accent)]" />
                      )}
                    </span>
                  </button>

                  <button
                    onClick={() => setIsAssistantEnabled(!isAssistantEnabled)}
                    className={menuItem}
                  >
                    <span>Programming Keyboard</span>
                    {isAssistantEnabled && (
                      <Check size={12} className="text-[var(--vsc-accent)]" />
                    )}
                  </button>

                  <div className="border-t border-[var(--vsc-border)] my-1" />
                  <div className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider text-[var(--vsc-fg-muted)]">
                    Layout
                  </div>

                  <button
                    onClick={() =>
                      setLayoutMode(layoutMode === "bottom" ? "right" : "bottom")
                    }
                    className={menuItem}
                    title={
                      viewport.w < 1024
                        ? "Applies on wider screens - narrow layouts always stack the panel"
                        : undefined
                    }
                  >
                    <span>
                      {layoutMode === "bottom"
                        ? "Move Panel Right"
                        : "Move Panel Bottom"}
                    </span>
                    {layoutMode === "bottom" ? (
                      <PanelRight size={12} />
                    ) : (
                      <PanelBottom size={12} />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      resetLayout();
                      setIsMinimapMenuOpen(false);
                    }}
                    className={menuItem}
                  >
                    <span>Reset Panel Sizes</span>
                  </button>

                  <div className="border-t border-[var(--vsc-border)] my-1" />
                  <div className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider text-[var(--vsc-fg-muted)]">
                    Tools
                  </div>

                  <button
                    onClick={() => {
                      setIsMinimapMenuOpen(false);
                      setIsProxyModalOpen(true);
                    }}
                    className={`${menuItem} text-[var(--vsc-accent)] font-medium`}
                  >
                    <span>Manage Proxy Servers...</span>
                  </button>

                  {(isTs || isJs) && (
                    <button
                      onClick={() => {
                        setIsMinimapMenuOpen(false);
                        setGlobalAlert({
                          title: "Async / Fetch Guidelines for JS/TS Nodes",
                          message: "Since the entire node's code runs inside an asynchronous wrapper function, you MUST use `await` for any async operations like `fetch()` or `setTimeout()`.\n\nIf you use `.then().catch()` without `await`ing or returning the Promise, the main execution function will finish and clean up immediately, terminating your background network requests before they complete!",
                          codeSnippet: "await fetch(\"https://jsonplaceholder.typicode.com/todos/1\")\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(console.log);"
                        });
                      }}
                      className={`${menuItem} text-amber-600 dark:text-amber-400 font-medium`}
                    >
                      <span className="flex items-center gap-2">
                        <Info size={13} />
                        Async / Fetch Rules
                      </span>
                    </button>
                  )}

                  <button
                    onClick={handleClearAllCode}
                    className={`${menuItem} text-red-600 dark:text-red-400 font-medium`}
                    title="Clear all code in current tab (Ctrl+Z to undo)"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 size={12} className="shrink-0" />
                      Clear All Code
                    </span>
                  </button>

                  <div className="border-t border-[var(--vsc-border)] my-1" />
                  <div className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wider text-[var(--vsc-fg-muted)]">
                    Appearance
                  </div>

                  <button
                    onClick={() =>
                      setAppTheme(appTheme === "dark" ? "light" : "dark")
                    }
                    className={menuItem}
                  >
                    <div className="flex items-center gap-2">
                      {appTheme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
                      <span>
                        {appTheme === "dark"
                          ? "Switch to Light Mode"
                          : "Switch to Dark Mode"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setActiveSubmenu(activeSubmenu === "theme" ? null : "theme")
                    }
                    className={`${menuItem} text-[var(--vsc-accent)] font-medium`}
                  >
                    <span>Color Theme</span>
                    <ChevronRight
                      size={13}
                      className={`transform transition-transform ${activeSubmenu === "theme" ? "rotate-90" : ""}`}
                    />
                  </button>

                  {activeSubmenu === "theme" && (
                    <div className="bg-[var(--vsc-hover)] border-y border-[var(--vsc-border)] max-h-40 overflow-auto custom-scrollbar">
                      {(
                        [
                          "default",
                          "one-dark-pro",
                          "dracula",
                          "night-owl",
                          "github-dark",
                          "synthwave-84",
                        ] as const
                      ).map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            saveSettings({ ...settings, editorTheme: t })
                          }
                          className="w-full text-left px-4 py-1.5 hover:bg-[var(--vsc-active)] flex justify-between items-center transition-colors font-mono text-[10px] cursor-pointer"
                        >
                          <span>{t}</span>
                          {settings.editorTheme === t && (
                            <Check size={10} className="text-[var(--vsc-accent)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[var(--vsc-border)] mx-0.5" />

            {/* Layout toggles, mirroring the VS Code title bar */}
            <button
              onClick={() =>
                saveSettings({ ...settings, isSidebarOpen: !sidebarOpen })
              }
              className={`${iconBtn} ${sidebarOpen ? iconBtnOn : ""}`}
              title="Toggle Primary Side Bar (Explorer)"
            >
              <PanelLeft size={15} />
            </button>

            <button
              onClick={() =>
                setTerminalState(terminalState === "hidden" ? "normal" : "hidden")
              }
              className={`${iconBtn} ${terminalState !== "hidden" ? iconBtnOn : ""}`}
              title="Toggle Panel (Ctrl+`)"
            >
              {effectiveLayout === "bottom" ? (
                <PanelBottom size={15} />
              ) : (
                <PanelRight size={15} />
              )}
            </button>

            <button
              onClick={onClose}
              className={`${iconBtn} hover:!bg-red-500 hover:!text-white`}
              title="Close Workspace"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Workspace Panels Main body */}
        <div
          ref={workspaceBodyRef}
          style={
            {
              "--sash-x": `${sidebarWidth}px`,
              "--sash-y": `${panelSize}px`,
            } as React.CSSProperties
          }
          className="flex-1 flex overflow-hidden min-h-0 bg-[var(--vsc-editor)] relative"
        >
          {/* Mobile Sidebar Backdrop */}
          {sidebarOpen && isMobile && (
            <div
              className="absolute inset-0 bg-black/50 z-40 animate-in fade-in duration-150"
              onClick={() => saveSettings({ ...settings, isSidebarOpen: false })}
            />
          )}

          {/* Side Drawer Panel */}
          {sidebarOpen && (
            <div
              ref={(el) => { (sidebarRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
              style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
              className={`bg-[var(--vsc-sidebar)] flex flex-col overflow-hidden select-none shrink-0 ${isMobile
                ? "absolute top-0 bottom-0 left-0 z-50 w-[min(320px,85vw)] border-r border-[var(--vsc-border)] shadow-2xl animate-in slide-in-from-left duration-200"
                : "relative z-20 w-[var(--sidebar-width)]"
                }`}
            >
              {/* View title, as in the VS Code side bar */}
              <div className="flex items-center justify-between gap-2 h-[35px] pl-5 pr-2 shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--vsc-fg)] truncate">
                  Explorer
                </span>
                <button
                  onClick={() =>
                    saveSettings({ ...settings, isSidebarOpen: false })
                  }
                  className={iconBtn}
                  title="Hide Explorer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Explorer / Packages switch for Python workspaces */}
              {isPy && (
                <div className="flex items-center gap-1 px-2 pb-2 shrink-0">
                  <button
                    onClick={() => setSidebarTab("files")}
                    className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-[4px] transition-colors cursor-pointer ${sidebarTab === "files"
                      ? "bg-[var(--vsc-active)] text-[var(--vsc-fg)]"
                      : "text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)]"
                      }`}
                  >
                    Files
                  </button>
                  <button
                    onClick={() => setSidebarTab("packages")}
                    className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-[4px] transition-colors cursor-pointer ${sidebarTab === "packages"
                      ? "bg-[var(--vsc-active)] text-[var(--vsc-fg)]"
                      : "text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)]"
                      }`}
                  >
                    Packages
                  </button>
                </div>
              )}

              <div className="flex-1 flex flex-col overflow-hidden">
                {sidebarTab === "files" ? (
                  <FileExplorerPanel />
                ) : (
                  <PyPackagesPanel />
                )}
              </div>

            </div>
          )}

          {/* Explorer / editor sash */}
          {sidebarOpen && !isMobile && (
            <WorkspaceSash
              orientation="vertical"
              label="Resize explorer"
              onStart={beginPaneDrag}
              onDelta={(dx) => resizeSidebar(dx)}
              onEnd={endSidebarDrag}
              onReset={resetSidebar}
            />
          )}

          {/* Code Editor and Output Split Panels Area */}
          <div
            className={`flex-1 flex overflow-hidden h-full relative min-w-0 ${effectiveLayout === "bottom" ? "flex-col" : "flex-row"}`}
          >
            <div
              className={`flex-1 z-10 relative min-w-[120px] min-h-[80px] flex-col bg-[var(--vsc-editor)] overflow-hidden ${terminalState === "maximized" ? "hidden" : "flex"}`}
            >
              {/* Tabs list (Editor header) */}
              <div className="flex items-stretch bg-[var(--vsc-tabbar)] overflow-x-auto select-none shrink-0 scrollbar-none h-[35px] border-b border-[var(--vsc-border)]">
                {workspaceTabs.length === 0 && (
                  <div className="px-4 flex items-center text-xs font-mono text-[var(--vsc-fg-muted)] italic">
                    No files open
                  </div>
                )}

                {workspaceTabs.map((tab, idx) => {
                  const isActive = currentFilePath === tab.path;
                  const cleanName = getCleanName(tab.path);

                  return (
                    <button
                      key={tab.path}
                      draggable
                      onDragStart={(e) => {
                        (window as any).__isInternalDrag = true;
                        e.dataTransfer.setData("text/plain", idx.toString());
                        e.dataTransfer.effectAllowed = "move";
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        (window as any).__isInternalDrag = false;
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        if (isLeft) {
                          e.currentTarget.classList.add(
                            "border-l-[3px]",
                            "border-l-blue-500",
                            "pl-[13px]",
                          );
                          e.currentTarget.classList.remove(
                            "border-r-[3px]",
                            "border-r-blue-500",
                            "pr-[13px]",
                          );
                          // maintain normal px-4 padding minus 3px border
                        } else {
                          e.currentTarget.classList.add(
                            "border-r-[3px]",
                            "border-r-blue-500",
                            "pr-[13px]",
                          );
                          e.currentTarget.classList.remove(
                            "border-l-[3px]",
                            "border-l-blue-500",
                            "pl-[13px]",
                          );
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove(
                          "border-l-[3px]",
                          "border-l-blue-500",
                          "pl-[13px]",
                          "border-r-[3px]",
                          "border-r-blue-500",
                          "pr-[13px]",
                        );
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        e.currentTarget.classList.remove(
                          "border-l-[3px]",
                          "border-l-blue-500",
                          "pl-[13px]",
                          "border-r-[3px]",
                          "border-r-blue-500",
                          "pr-[13px]",
                        );

                        const fromIdx = parseInt(
                          e.dataTransfer.getData("text/plain"),
                        );
                        if (isNaN(fromIdx)) return;
                        let toIdx = isLeft ? idx : idx + 1;
                        if (fromIdx < toIdx) toIdx--; // adjust for removing from original position

                        if (fromIdx !== toIdx) {
                          const newTabs = [...workspaceTabs];
                          const [moved] = newTabs.splice(fromIdx, 1);
                          newTabs.splice(toIdx, 0, moved);
                          setWorkspaceTabs(newTabs);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (tab.isPreview) {
                          const newTabs = [...workspaceTabs];
                          newTabs[idx] = { ...tab, isPreview: false };
                          setWorkspaceTabs(newTabs);
                        }
                      }}
                      onClick={() => openWorkspaceTab(tab.path, tab.isPreview)}
                      className={`relative flex items-center gap-1.5 px-3 h-full text-[13px] border-r border-[var(--vsc-border)] transition-colors cursor-pointer shrink-0 group ${isActive
                        ? "bg-[var(--vsc-tab-active)] text-[var(--vsc-fg)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--vsc-accent)] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[var(--vsc-tab-active)]"
                        : "text-[var(--vsc-tab-inactive-fg)] hover:bg-[var(--vsc-hover)]"
                        }`}
                    >
                      {getTabIcon(tab.path, isActive)}
                      <span
                        className={`truncate max-w-[100px] sm:max-w-[160px] ${tab.isPreview ? "italic" : ""}`}
                      >
                        {cleanName}
                      </span>

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          closeWorkspaceTab(tab.path);
                        }}
                        className={`ml-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] transition-colors cursor-pointer ${tab.isDirty ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"} hover:bg-[var(--vsc-active)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)]`}
                      >
                        {tab.isDirty ? (
                          <div className="w-2 h-2 rounded-full bg-[var(--vsc-fg)] group-hover:hidden" />
                        ) : null}
                        <X
                          size={12}
                          className={
                            tab.isDirty ? "hidden group-hover:block" : ""
                          }
                        />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Breadcrumbs */}
              {workspaceTabs.length > 0 && (
                <div className="flex items-center h-[22px] px-3 shrink-0 bg-[var(--vsc-editor)] text-[11px] text-[var(--vsc-fg-muted)] overflow-x-auto scrollbar-none whitespace-nowrap">
                  {breadcrumbs.map((crumb, i) => (
                    <span
                      key={crumb.path}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {i > 0 && (
                        <ChevronRight size={11} className="opacity-60 mx-0.5" />
                      )}
                      <span
                        className={`flex items-center gap-1 ${crumb.isFile ? "text-[var(--vsc-fg)]" : ""}`}
                      >
                        {crumb.isFile && getTabIcon(currentFilePath, true)}
                        {crumb.label}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Editor Component frame */}
              <div className="flex-1 relative flex flex-col min-h-0">
                {isGoToLineOpen && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 w-[min(420px,92%)] bg-[var(--vsc-widget)] border border-[var(--vsc-border-strong)] shadow-[0_4px_18px_var(--vsc-widget-shadow)] rounded-[6px] p-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-100">
                    <span className="text-[11px] font-semibold text-[var(--vsc-fg-muted)] shrink-0">
                      Go to:
                    </span>
                    <input
                      type="text"
                      placeholder="line:col (e.g. 10:5)"
                      value={goToLineValue}
                      onChange={(e) => setGoToLineValue(e.target.value)}
                      className="flex-1 min-w-0 bg-[var(--vsc-input)] text-[var(--vsc-fg)] text-xs px-2 py-1 rounded-[3px] border border-[var(--vsc-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent)] font-mono"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleExecuteGoToLine();
                        } else if (e.key === "Escape") {
                          setIsGoToLineOpen(false);
                          if (editorRef.current) editorRef.current.focus();
                        }
                      }}
                    />
                    <button
                      onClick={handleExecuteGoToLine}
                      className="px-3 py-1 bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] hover:opacity-90 text-xs font-semibold rounded-[3px] transition-opacity whitespace-nowrap cursor-pointer"
                    >
                      Go
                    </button>
                    <button
                      onClick={() => {
                        setIsGoToLineOpen(false);
                        if (editorRef.current) editorRef.current.focus();
                      }}
                      className="p-1 hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] rounded-[3px] transition-colors block cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                {isSearch ? (
                  <SearchNodeWorkspace
                    key={currentFilePath}
                    path={currentFilePath}
                  />
                ) : isTodo ? (
                  <TodoWorkspace key={currentFilePath} path={currentFilePath} />
                ) : isImg ? (
                  <React.Suspense fallback={<div className="flex items-center justify-center w-full h-full text-slate-400">Loading Image Workspace...</div>}>
                    <ImageWorkspace
                      key={currentFilePath}
                      path={currentFilePath}
                    />
                  </React.Suspense>
                ) : (
                  <SafeEditor
                    path={currentFilePath}
                    height="100%"
                    defaultLanguage={editorLanguage}
                    language={editorLanguage}
                    theme={
                      codeEditorOptions.theme ||
                      (appTheme === "dark" ? "customDark" : "customLight")
                    }
                    value={
                      isEditingOtherFile && typeof otherFileValue === "string"
                        ? otherFileValue
                        : code
                    }
                    onChange={handleEditorChange}
                    options={codeEditorOptions}
                    beforeMount={handleEditorWillMount}
                    onMount={(editor, m) => {
                      editorRef.current = editor;
                      setEditorInstance(editor);
                      registerWorkspaceIntelliSense(m, editor);
                      try {
                        const pos = editor.getPosition();
                        if (pos)
                          setCursorPos((prev) => ({
                            ...prev,
                            line: pos.lineNumber,
                            column: pos.column,
                          }));
                        editor.onDidChangeCursorPosition((ev: any) =>
                          setCursorPos((prev) => ({
                            ...prev,
                            line: ev.position.lineNumber,
                            column: ev.position.column,
                          })),
                        );
                        editor.onDidChangeCursorSelection((ev: any) => {
                          const model = editor.getModel();
                          const selected = model
                            ? model.getValueInRange(ev.selection).length
                            : 0;
                          setCursorPos((prev) => ({ ...prev, selected }));
                        });
                      } catch (err) {
                        console.warn("Could not track the caret position", err);
                      }
                      try {
                        editor.addCommand(
                          m.KeyMod.CtrlCmd | m.KeyCode.KeyG,
                          () => {
                            latestRefs.current.setIsGoToLineOpen(true);
                            latestRefs.current.setGoToLineValue("");
                          },
                        );
                      } catch (err) {
                        console.warn(
                          "Could not register Ctrl+G command in Monaco",
                          err,
                        );
                      }
                      editor.addCommand(
                        m.KeyMod.CtrlCmd | m.KeyCode.Enter,
                        () => {
                          if (latestRefs.current.isExecutable) {
                            latestRefs.current.onExecute(editor.getValue());
                            if (latestRefs.current.terminalState === "hidden") {
                              latestRefs.current.setTerminalState("normal");
                            }
                          }
                        },
                      );
                      editor.addCommand(
                        m.KeyMod.CtrlCmd | m.KeyCode.KeyS,
                        () => {
                          const val = editor.getValue();
                          latestRefs.current.updateNodeValue(
                            latestRefs.current.currentFilePath,
                            val,
                          );
                          latestRefs.current.markWorkspaceTabDirty(
                            latestRefs.current.currentFilePath,
                            false,
                          );
                          // Visual confirmation can be added here if needed
                        },
                      );

                      // Ctrl+Click to open imported file
                      editor.onMouseDown((e) => {
                        if (e.event.ctrlKey || e.event.metaKey) {
                          const position = e.target.position;
                          if (!position) return;
                          const model = editor.getModel();
                          if (!model) return;
                          const lineContent = model.getLineContent(
                            position.lineNumber,
                          );

                          let packageName = "";
                          const importMatch = lineContent.match(
                            /from\s+['"]?([a-zA-Z0-9_.\/-]+)['"]?\s+import/,
                          );
                          const importMatch2 = lineContent.match(
                            /import\s+['"]?([a-zA-Z0-9_.\/-]+)['"]?/,
                          );
                          if (importMatch && lineContent.includes("from")) {
                            packageName = importMatch[1];
                          } else if (
                            importMatch2 &&
                            lineContent.includes("import")
                          ) {
                            packageName = importMatch2[1];
                          }

                          if (packageName) {
                            const state = useStore.getState();
                            if (!state.parsedData) return;

                            const currentVirtualPath = getVirtualPath(
                              latestRefs.current.currentFilePath,
                              state.parsedData,
                            );
                            const currentDir =
                              currentVirtualPath.substring(
                                0,
                                currentVirtualPath.lastIndexOf("/"),
                              ) || "/";

                            let resolvedPackage = packageName;
                            if (packageName.startsWith(".")) {
                              const dotGroups = packageName.match(/^(\.+)(.*)/);
                              if (dotGroups) {
                                const dots = dotGroups[1].length;
                                const rest = dotGroups[2];
                                const parts = currentDir
                                  .split("/")
                                  .filter(Boolean);
                                const back = dots - 1; // . = same, .. = up 1, ... = up 2
                                const resolvedParts = parts.slice(
                                  0,
                                  parts.length - back,
                                );
                                if (rest) {
                                  resolvedPackage = [
                                    ...resolvedParts,
                                    ...rest.split("."),
                                  ].join("/");
                                } else {
                                  resolvedPackage = resolvedParts.join("/");
                                }
                              }
                            } else {
                              resolvedPackage = packageName
                                .split(".")
                                .join("/");
                            }

                            if (!resolvedPackage.startsWith("/")) {
                              resolvedPackage = "/" + resolvedPackage;
                            }

                            const possibleVFSPaths = [
                              `${resolvedPackage}.py`,
                              `${resolvedPackage}/__init__.py`,
                              `${resolvedPackage}.ts`,
                              `${resolvedPackage}.js`,
                            ];

                            let foundFsPath = "";
                            let foundObjectPath = "";

                            function traverseFind(
                              obj: any,
                              parentFsPath: string,
                              parentObjPath: string,
                            ) {
                              if (typeof obj !== "object" || obj === null)
                                return;
                              for (const [key, val] of Object.entries(obj)) {
                                const currObjPath = parentObjPath
                                  ? `${parentObjPath}.${key}`
                                  : `root.${key}`;
                                if (typeof val === "string") {
                                  let ext = "";
                                  if (
                                    key.endsWith(".ts") ||
                                    key.endsWith("_ts_node")
                                  )
                                    ext = ".ts";
                                  else if (
                                    key.endsWith(".js") ||
                                    key.endsWith("_js_node")
                                  )
                                    ext = ".js";
                                  else if (
                                    key.endsWith(".py") ||
                                    key.endsWith("_py_node")
                                  )
                                    ext = ".py";
                                  else if (
                                    key.endsWith(".json") ||
                                    key.endsWith("_json_node")
                                  )
                                    ext = ".json";

                                  if (ext) {
                                    let baseName = key;
                                    if (baseName.endsWith("_ts_node"))
                                      baseName = baseName.replace(
                                        /_ts_node$/,
                                        "",
                                      );
                                    else if (baseName.endsWith("_js_node"))
                                      baseName = baseName.replace(
                                        /_js_node$/,
                                        "",
                                      );
                                    else if (baseName.endsWith("_py_node"))
                                      baseName = baseName.replace(
                                        /_py_node$/,
                                        "",
                                      );
                                    if (!baseName.endsWith(ext))
                                      baseName += ext;

                                    const fsPath = parentFsPath
                                      ? `${parentFsPath}/${baseName}`
                                      : `/${baseName}`;
                                    if (possibleVFSPaths.includes(fsPath)) {
                                      foundFsPath = fsPath;
                                      foundObjectPath = currObjPath;
                                    }
                                  }
                                } else if (
                                  typeof val === "object" &&
                                  val !== null &&
                                  !Array.isArray(val)
                                ) {
                                  const nextPath = parentFsPath
                                    ? `${parentFsPath}/${key}`
                                    : `/${key}`;
                                  traverseFind(val, nextPath, currObjPath);
                                }
                              }
                            }

                            traverseFind(state.parsedData, "", "");
                            if (foundObjectPath) {
                              latestRefs.current.openWorkspaceTab(
                                foundObjectPath,
                                false,
                              );
                            }
                          }
                        }
                      });
                    }}
                  />
                )}
                {/* Programming Keyboard */}
                {isExecutable && editorLanguage && (
                  <div className="absolute bottom-0 left-0 right-0 z-50">
                    <ProgrammingKeyboard
                      editor={editorInstance}
                      language={editorLanguage}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Editor / panel sash */}
            {terminalState === "normal" && (
              <WorkspaceSash
                orientation={
                  effectiveLayout === "bottom" ? "horizontal" : "vertical"
                }
                label="Resize panel"
                onStart={beginPaneDrag}
                onDelta={resizePanel}
                onEnd={endPanelDrag}
                onReset={resetPanel}
              />
            )}

            {/* Output Split Console and Results Panel */}
            <div
              ref={consolePanelRef}
              className={`bg-[var(--vsc-panel)] flex-col relative z-20 min-w-0 min-h-0 ${terminalState === "hidden" ? "hidden" : "flex"}`}
              style={
                terminalState === "maximized"
                  ? { flex: 1, width: "100%", height: "100%" }
                  : {
                    flex: "0 0 auto",
                    [effectiveLayout === "bottom" ? "height" : "width"]:
                      panelSize,
                  }
              }
            >
              {/* Console/Result Pane tabs header */}
              <div className="flex justify-between items-center gap-2 h-[35px] bg-[var(--vsc-panel)] border-b border-[var(--vsc-border)] select-none shrink-0 w-full overflow-hidden">
                <div className="flex flex-1 items-stretch gap-4 px-3 overflow-x-auto scrollbar-none min-w-0">
                  <button
                    onClick={() => setActiveTab("console")}
                    className={panelTab(activeTab === "console")}
                  >
                    <TerminalIcon size={12} className="shrink-0" />
                    <span>Console</span>
                    {logCount > 0 && (
                      <span className="bg-[var(--vsc-badge)] text-[var(--vsc-badge-fg)] text-[10px] font-semibold px-1.5 rounded-full shrink-0 normal-case">
                        {logCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("result")}
                    className={panelTab(activeTab === "result")}
                  >
                    Output Result
                  </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center px-1 md:px-2 gap-0.5 shrink-0">
                  {activeTab === "console" && (
                    <button
                      onClick={async () => {
                        try {
                          const logsToCopy = [];
                          for (let i = 0; i < logCount; i++) {
                            const lg = getLog(i);
                            if (lg && lg.args) {
                              logsToCopy.push(
                                lg.args
                                  .map((a: any) =>
                                    typeof a === "object"
                                      ? safeStringify(a)
                                      : String(a),
                                  )
                                  .join(" "),
                              );
                            }
                          }
                          await navigator.clipboard.writeText(
                            logsToCopy.join("\n"),
                          );
                          setCopiedConsole(true);
                          setTimeout(() => setCopiedConsole(false), 2000);
                        } catch (err) {
                          console.error("Failed to copy console logs", err);
                        }
                      }}
                      className={`py-1 px-1.5 md:px-2 text-[11px] font-medium rounded-[4px] flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shrink-0 outline-none ${copiedConsole
                        ? "text-emerald-500 bg-emerald-500/10 font-semibold"
                        : logCount > 0
                          ? "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]"
                          : "text-[var(--vsc-fg-muted)] cursor-not-allowed opacity-40"
                        }`}
                      title="Copy all console logs"
                      disabled={logCount === 0}
                    >
                      {copiedConsole ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                      <span className="hidden sm:inline">
                        {copiedConsole ? "Copied" : "Copy Output"}
                      </span>
                    </button>
                  )}

                  {activeTab === "console" && (
                    <button
                      onClick={() => {
                        clearLogs();
                        if (setJsNodeError) {
                          setJsNodeError(currentFilePath, null);
                        }
                        if (setApiNodeError) {
                          setApiNodeError(currentFilePath, null);
                        }
                      }}
                      className={`py-1 px-1.5 md:px-2 text-[11px] font-medium rounded-[4px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 outline-none ${logCount > 0 || lastError
                        ? "text-[var(--vsc-fg-muted)] hover:text-red-500 hover:bg-[var(--vsc-hover)] cursor-pointer"
                        : "text-[var(--vsc-fg-muted)] cursor-not-allowed opacity-40"
                        }`}
                      title="Clear console logs and errors"
                      disabled={logCount === 0 && !lastError}
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}

                  {/* Toggle clear logs setting */}
                  {activeTab === "console" && (
                    <button
                      onClick={() => setAutoClearLogs(!autoClearLogs)}
                      className={`py-1 px-1.5 md:px-2 text-[11px] font-medium rounded-[4px] flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shrink-0 outline-none ${autoClearLogs
                        ? "text-[var(--vsc-accent)] bg-[var(--vsc-hover)]"
                        : "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]"
                        }`}
                      title="Auto clear logs on execution run"
                    >
                      <Clock size={13} />
                      <span className="hidden sm:inline">Auto-Clear</span>
                    </button>
                  )}

                  {/* Toggle terminal State buttons */}
                  <div className="h-4 w-px bg-[var(--vsc-border)] mx-1 hidden sm:block" />

                  <div className="flex gap-0.5 items-center">
                    <button
                      onClick={() =>
                        setLayoutMode(
                          layoutMode === "bottom" ? "right" : "bottom",
                        )
                      }
                      className={`${iconBtn} hidden lg:block !p-1`}
                      title={
                        layoutMode === "bottom"
                          ? "Layout to Right Side"
                          : "Layout to Bottom"
                      }
                    >
                      {layoutMode === "bottom" ? (
                        <PanelRight size={13} />
                      ) : (
                        <PanelBottom size={13} />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setTerminalState(
                          terminalState === "maximized"
                            ? "normal"
                            : "maximized",
                        )
                      }
                      className={`${iconBtn} !p-1 ${terminalState === "maximized" ? iconBtnOn : ""}`}
                      title={
                        terminalState === "maximized"
                          ? "Restore Pane Size"
                          : "Maximize Console View"
                      }
                    >
                      <Maximize size={13} />
                    </button>
                    <button
                      onClick={() => setTerminalState("hidden")}
                      className={`${iconBtn} !p-1 hover:!bg-red-500/15 hover:!text-red-500`}
                      title="Hide Output Pane"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab views content area */}
              <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-[var(--vsc-panel-body)] relative">
                {activeTab === "result" && (
                  <div className="p-4 h-full">
                    {lastError ? (
                      <div className="p-4 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-mono whitespace-pre-wrap rounded-r flex justify-between items-start gap-2 group/err">
                        <span className="flex-1 min-w-0">
                          {typeof lastError === "object" && lastError !== null
                            ? (lastError as any).userMessage ||
                            (lastError as any).message
                            : String(lastError)}
                        </span>
                        <CopyButton
                          text={
                            typeof lastError === "object" && lastError !== null
                              ? (lastError as any).userMessage ||
                              (lastError as any).message
                              : String(lastError)
                          }
                        />
                      </div>
                    ) : hasData ? (
                      <pre className="font-mono text-[13px] text-[var(--vsc-fg)] whitespace-pre-wrap">
                        {(() => {
                          try {
                            return JSON.stringify(resultData, null, 2);
                          } catch {
                            return "[Unserializable Result Data]";
                          }
                        })()}
                      </pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[var(--vsc-fg-muted)] italic text-sm">
                        Run the script to see results here.
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`absolute inset-0 select-text ${activeTab === "console" ? "flex flex-col" : "hidden"}`}
                >
                  <div className="flex-1 min-h-0 relative overflow-hidden">
                    {logCount === 0 && !lastError ? (
                      <div className="h-full flex items-center justify-center text-[var(--vsc-fg-muted)] italic text-sm absolute inset-0">
                        No console output.
                      </div>
                    ) : (
                      <div className="font-mono text-[13px] bg-[var(--vsc-panel-body)] h-full overflow-hidden custom-scrollbar">
                        <Virtuoso
                          totalCount={logCount + (lastError ? 1 : 0)}
                          firstItemIndex={startOffset}
                          className="h-full custom-scrollbar overflow-x-hidden w-full"
                          followOutput="auto"
                          itemContent={(index) => {
                            if (index === logCount && lastError) {
                              const errorStr =
                                typeof lastError === "object" &&
                                  lastError !== null
                                  ? (lastError as any).message
                                  : String(lastError);
                              return (
                                <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex justify-between items-start gap-4 w-full group/err">
                                  <div className="flex-1 min-w-0 font-bold whitespace-pre-wrap flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">✖</span>
                                    <span>
                                      {renderClickableErrorText(
                                        errorStr,
                                        currentFilePath,
                                        setJsNodeFocusLine,
                                      )}
                                    </span>
                                  </div>
                                  <CopyButton text={errorStr} />
                                </div>
                              );
                            }
                            const log = getLog(index);
                            if (!log) {
                              return (
                                <div className="px-4 py-0 text-[var(--vsc-fg-muted)] text-xs italic">
                                  Loading...
                                </div>
                              );
                            }
                            return (
                              <div
                                className={`px-4 py-0.5 flex items-start gap-4 w-full group/log ${log.type === "error" ? "bg-red-500/10 text-red-500" : log.type === "warn" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "hover:bg-[var(--vsc-hover)] text-[var(--vsc-fg)]"}`}
                              >
                                <div className="flex-1 min-w-0 font-mono">
                                  <div className="flex flex-wrap items-start gap-2 w-full text-[13px]">
                                    {log.args.map((arg: any, argIdx: number) =>
                                      renderArgElement(arg, argIdx),
                                    )}
                                  </div>
                                </div>
                                {log.type === "error" && (
                                  <div className="opacity-0 group-hover/log:opacity-100 focus-within:opacity-100 transition-opacity self-start shrink-0">
                                    <CopyButton
                                      text={log.args
                                        .map((arg: any) =>
                                          typeof arg === "string"
                                            ? arg
                                            : JSON.stringify(arg),
                                        )
                                        .join(" ")}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Terminal CLI Shell Prompt line for execution environments and unified native prompt input */}
                  {(isPy || !!currentPrompt) && (
                    <form
                      onSubmit={handleTerminalSubmit}
                      className={`border-t px-4 py-2 flex items-center gap-3 font-mono text-xs shrink-0 select-text transition-colors duration-200 ${currentPrompt
                        ? "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/20"
                        : "bg-[var(--vsc-panel)] border-[var(--vsc-border)] text-[var(--vsc-fg)]"
                        }`}
                    >
                      {currentPrompt ? (
                        <span className="text-amber-500 font-bold select-none shrink-0 flex items-center gap-1.5 animate-pulse">
                          {currentPrompt.type === "confirm"
                            ? "Confirm (y/n) ›"
                            : currentPrompt.type === "alert"
                              ? "Alert ›"
                              : "Input ›"}
                        </span>
                      ) : (
                        <span className="text-emerald-500 font-bold select-none shrink-0">
                          $
                        </span>
                      )}

                      <input
                        ref={terminalInputRef}
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        placeholder={
                          currentPrompt
                            ? currentPrompt.type === "confirm"
                              ? "Type 'y' or 'n' (or click controls) and press Enter..."
                              : currentPrompt.type === "alert"
                                ? "Press Enter (or click OK) to acknowledge..."
                                : "Type response and press Enter... " +
                                (currentPrompt.promptText &&
                                  currentPrompt.promptText !==
                                  "Python input requested"
                                  ? `(${currentPrompt.promptText})`
                                  : "")
                            : "pip install <package>, pip list, clear, help, python..."
                        }
                        className="flex-1 bg-transparent border-0 outline-none p-0 focus:outline-none focus:ring-0 text-[var(--vsc-fg)] placeholder-[var(--vsc-fg-muted)] leading-normal text-xs font-mono"
                        autoComplete="off"
                      />

                      {currentPrompt && currentPrompt.type === "confirm" && (
                        <div className="flex gap-1.5 shrink-0 select-none items-center">
                          <button
                            type="button"
                            onClick={() => submitActivePrompt(true)}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-600 dark:text-emerald-450 font-semibold active:scale-95 transition-all cursor-pointer text-[10px] uppercase tracking-wider font-sans"
                          >
                            Yes [y]
                          </button>
                          <button
                            type="button"
                            onClick={() => submitActivePrompt(false)}
                            className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-600 dark:text-red-450 font-semibold active:scale-95 transition-all cursor-pointer text-[10px] uppercase tracking-wider font-sans"
                          >
                            No [n]
                          </button>
                        </div>
                      )}

                      {currentPrompt && currentPrompt.type === "alert" && (
                        <button
                          type="button"
                          onClick={() => submitActivePrompt(null)}
                          className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-405 font-semibold active:scale-95 transition-all cursor-pointer text-[10px] uppercase tracking-wider font-sans shrink-0 select-none"
                        >
                          OK [Enter]
                        </button>
                      )}

                      {currentPrompt && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              navigator.serviceWorker &&
                              navigator.serviceWorker.controller
                            ) {
                              navigator.serviceWorker.controller.postMessage({
                                type: "STDIN_CANCEL",
                                sessionId: currentPrompt.sessionId,
                              });
                            }
                            await appendLogs(currentFilePath, [
                              {
                                type: "warn",
                                args: ["[Cancelled]"],
                                time: new Date().toISOString(),
                              },
                            ]);
                            setActivePrompt(currentFilePath, null);
                          }}
                          className="p-1 px-2.5 hover:bg-red-500/10 hover:text-red-600 text-slate-400 dark:hover:text-red-400 cursor-pointer shrink-0 border border-dashed border-slate-350 dark:border-slate-800 hover:border-red-500/40 rounded text-[10px] font-bold uppercase tracking-wider font-sans select-none"
                          title="Cancel input/abort prompt"
                        >
                          Abort
                        </button>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Corner sash: drags the explorer and the panel at the same time */}
          {sidebarOpen &&
            !isMobile &&
            terminalState === "normal" &&
            effectiveLayout === "bottom" && (
              <WorkspaceSash
                orientation="corner"
                label="Resize explorer and panel together"
                cursor="crosshair"
                onStart={beginPaneDrag}
                onDelta={resizeBoth}
                onEnd={endBothDrag}
                onReset={resetLayout}
                style={{
                  left: "calc(var(--sash-x) - 7px)",
                  bottom: "calc(var(--sash-y) - 7px)",
                }}
                className="z-[60]"
              />
            )}
        </div>

        {/* Status bar - editor-only readouts, so tabs that render their own
            workspace (todo / image / search) get no empty strip. */}
        {hasTextEditor && (
        <div className="flex items-center justify-between gap-2 h-[22px] shrink-0 px-1 text-[11px] bg-[var(--vsc-statusbar)] border-t border-[var(--vsc-border)] text-[var(--vsc-fg-muted)] select-none">
          <div className="flex items-center gap-0.5 min-w-0">
            {/* Console summary: only meaningful for runnable files, and the
                panel is not worth a toggle on a phone-sized screen. */}
            {isExecutable && !isMobile && (
              <button
                onClick={() => {
                  if (terminalState === "hidden") {
                    setTerminalState("normal");
                    setActiveTab("console");
                  } else {
                    setTerminalState("hidden");
                  }
                }}
                className={`flex items-center gap-2 px-1.5 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer shrink-0 ${terminalState !== "hidden" ? "text-[var(--vsc-fg)]" : ""}`}
                title={
                  terminalState === "hidden"
                    ? "Show panel (Ctrl+`)"
                    : "Hide panel (Ctrl+`)"
                }
              >
                <span
                  className={`flex items-center gap-1 ${lastError ? "text-red-500" : ""}`}
                >
                  <X size={11} />
                  {lastError ? 1 : 0}
                </span>
                <span className="flex items-center gap-1">
                  <TerminalIcon size={11} />
                  {logCount}
                </span>
              </button>
            )}
            {isLoading && (
              <span className="flex items-center gap-1.5 px-1.5 text-[var(--vsc-accent)] shrink-0">
                <Loader2 size={11} className="animate-spin" />
                <span className="hidden sm:inline">Running</span>
              </span>
            )}
            <span className="px-1.5 truncate hidden md:inline">
              {mainCleanName}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {hasTextEditor && !isMobile && (
              <button
                onClick={() => {
                  setIsGoToLineOpen(true);
                  setGoToLineValue("");
                }}
                className="px-1.5 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer whitespace-nowrap"
                title="Go to Line (Ctrl+G)"
              >
                Ln {cursorPos.line}, Col {cursorPos.column}
                {cursorPos.selected > 0 ? ` (${cursorPos.selected} sel)` : ""}
              </button>
            )}
            {hasTextEditor && (
              <>
                <span className="px-1.5 hidden lg:inline">Spaces: 2</span>
                <span className="px-1.5 hidden xl:inline">UTF-8</span>
              </>
            )}
            {/* Editor zoom */}
            <span className="flex items-center shrink-0">
              <button
                onClick={() => changeFontSize(-1)}
                disabled={editorFontSize <= MIN_FONT_SIZE}
                className="px-1 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Decrease font size (Ctrl+-)"
              >
                <Minus size={11} />
              </button>
              <button
                onClick={() => changeFontSize(0)}
                className="px-1 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer tabular-nums whitespace-nowrap"
                title="Reset font size (Ctrl+0)"
              >
                {editorFontSize}px
              </button>
              <button
                onClick={() => changeFontSize(1)}
                disabled={editorFontSize >= MAX_FONT_SIZE}
                className="px-1 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Increase font size (Ctrl+=)"
              >
                <Plus size={11} />
              </button>
            </span>

            <button
              onClick={() => toggleWordWrap()}
              className="px-1.5 h-full rounded-[3px] hover:bg-[var(--vsc-hover)] cursor-pointer whitespace-nowrap hidden sm:block"
              title="Toggle Text Wrap (Alt+Z)"
            >
              Wrap: {wordWrap}
            </button>
            <span className="px-1.5 capitalize hidden md:inline">
              {editorLanguage}
            </span>
          </div>
        </div>
        )}
      </div>
      <ProxySettingsModal />
      <GlobalAlertModal />

      {/* Fallback Paste Modal for browsers that block direct clipboard read */}
      {isPasteModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[999999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#161b22] border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
                <ClipboardPaste size={16} className="text-emerald-500" />
                <span>Paste into Editor</span>
              </div>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Browser blocked direct clipboard access. Press{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">
                Ctrl+V
              </kbd>{" "}
              (or{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">
                Cmd+V
              </kbd>
              ) into the box below:
            </p>

            <textarea
              ref={pasteTextareaRef}
              autoFocus
              placeholder="Paste your text here (Ctrl+V / Cmd+V)..."
              value={pasteInputValue}
              onChange={(e) => setPasteInputValue(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData("text/plain");
                if (pasted && editorRef.current) {
                  e.preventDefault();
                  insertTextIntoEditor(editorRef.current, pasted);
                  setIsPasteModalOpen(false);
                  setPasteInputValue("");
                }
              }}
              rows={4}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                💡 Tip: Set Clipboard to "Allow" in site settings for 1-click paste.
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (pasteInputValue && editorRef.current) {
                      insertTextIntoEditor(editorRef.current, pasteInputValue);
                    }
                    setIsPasteModalOpen(false);
                    setPasteInputValue("");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
