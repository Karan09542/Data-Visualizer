import katex from 'katex';
import { Virtuoso } from "react-virtuoso";
import { useExecutionLogs } from "../utils/useExecutionLogs";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMonaco } from "@monaco-editor/react";
import {
  Play,
  Square,
  Trash2,
  AlignLeft,
  Copy,
  Maximize,
  X,
  Loader2,
  Braces,
  Terminal as TerminalIcon,
  LayoutPanelLeft,
  LayoutPanelTop,
  Settings2,
  Check,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  PanelBottomInactive,
  PanelBottom,
  PanelBottomClose,
  PanelRight,
  PanelRightClose,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Hash,
  FolderOpen,
  Info,
  FileCode2,
  FileText,
  CheckSquare
} from "lucide-react";
import SafeEditor from "./SafeEditor";
import { useStore } from "../store/useStore";
import { getVirtualPath } from "../utils/vfs";
import { usePyPackageStore } from "../store/usePyPackageStore";
import { PyPackagesPanel } from "./PyPackagesPanel";
import { appendLogs } from "../utils/executionStore";
import { safeStringify } from "../utils/safeStringify";
import { ExpandableJSON } from "./ExpandableJSON";
import { TodoWorkspace } from "./TodoWorkspace";
import { MatplotlibPlotViewer } from "./MatplotlibPlotViewer";
import { generateTypeScriptSchema, executeTsNode, abortTsNode } from "../utils/tsExecutor";
import { executeJsNode, abortJsNode } from "../utils/jsExecutor";
import { executePyNode, abortPyNode } from "../utils/pyExecutor";
import FileExplorerPanel from "./FileExplorerPanel";
import {
  JavaScriptIcon,
  TypeScriptIcon,
  PythonIcon,
  JsonIcon,
  MarkdownIcon,
  TextIcon,
} from "./FileIcons";
import { getValueAtPath } from "../utils/pathUtils";
import { editorThemes } from "../utils/editorThemes";
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
      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
      title={copied ? "Copied" : "Copy error text"}
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
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
};

export function CodeWorkspace({ path, onClose }: CodeWorkspaceProps) {
  const {
    appTheme,
    jsNodeFocusLine,
    setJsNodeFocusLine,
    autoClearLogs,
    setAutoClearLogs,
    activeExplorerFile,
    setActiveExplorerFile,
    jsNodeCodeOverrides,
    setJsNodeCodeOverride,
    updateNodeValue,
    parsedData,
    jsNodeLoading,
    jsNodeErrors,
    jsNodeResponses,
    setApiNodeLoading,
    setApiNodeError,
    setApiNodeResponse,
    apiNodeResponses,
    apiNodeLoading,
    apiNodeErrors,
    workspaceTabs,
    openWorkspaceTab,
    closeWorkspaceTab,
    markWorkspaceTabDirty,
    setWorkspaceTabs,
    activePrompts,
    setActivePrompt,
  } = useStore();
  const [copied, setCopied] = useState(false);
  const [monaco, setMonaco] = useState<any>(null);

  // Active open file in the workspace
  const currentFilePath = activeExplorerFile || path;
  
  const isEditingOtherFile = useMemo(() => {
    return !!(activeExplorerFile && activeExplorerFile !== path);
  }, [activeExplorerFile, path]);

  // Read code content dynamically for the active open file
  const code = useMemo(() => {
    const val = jsNodeCodeOverrides[currentFilePath] ?? getValueAtPath(parsedData, currentFilePath) ?? "";
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }, [jsNodeCodeOverrides, parsedData, currentFilePath]);

  const otherFileValue = useMemo(() => {
    if (!isEditingOtherFile) return undefined;
    const val = jsNodeCodeOverrides[currentFilePath] ?? getValueAtPath(parsedData, currentFilePath);
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
    return currentFilePath.split('.').pop()?.replace(/\[[0-9]+\]$/, '').toLowerCase() || "";
  }, [currentFilePath]);

  const isTs = useMemo(() => fileExt.endsWith('_ts_node') || fileExt === 'ts', [fileExt]);
  const isJs = useMemo(() => fileExt.endsWith('_js_node') || fileExt === 'js', [fileExt]);
  const isPy = useMemo(() => fileExt.endsWith('_py_node') || fileExt === 'py', [fileExt]);
  const isApi = useMemo(() => fileExt.endsWith('_api_node') || fileExt === 'api', [fileExt]);
  const isTodo = useMemo(() => fileExt.endsWith('_todo_node') || fileExt === 'todo', [fileExt]);
  const isJson = useMemo(() => fileExt.endsWith('_json') || fileExt === 'json', [fileExt]);
  const isYaml = useMemo(() => fileExt.endsWith('_yaml') || fileExt === 'yaml' || fileExt.endsWith('_yml') || fileExt === 'yml', [fileExt]);
  const isCsv = useMemo(() => fileExt.endsWith('_csv') || fileExt === 'csv', [fileExt]);
  const isXml = useMemo(() => fileExt.endsWith('_xml') || fileExt === 'xml', [fileExt]);
  const isMd = useMemo(() => fileExt.endsWith('_md') || fileExt === 'md', [fileExt]);
  const isTxt = useMemo(() => fileExt.endsWith('_txt') || fileExt === 'txt', [fileExt]);

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
    if (typeof filePath !== 'string') return <FileText size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />;
    
    const lowerPath = filePath.toLowerCase();
    const isPy = lowerPath.endsWith('_py_node') || lowerPath.endsWith('.py');
    const isTs = lowerPath.endsWith('_ts_node') || lowerPath.endsWith('.ts');
    const isJs = lowerPath.endsWith('_js_node') || lowerPath.endsWith('.js');
    const isJson = lowerPath.endsWith('_json') || lowerPath.endsWith('.json');
    const isTodo = lowerPath.endsWith('_todo_node') || lowerPath.endsWith('.todo');
    const isMd = lowerPath.endsWith('_md') || lowerPath.endsWith('.md');
    
    if (isPy) return <PythonIcon />;
    if (isTs) return <TypeScriptIcon />;
    if (isJs) return <JavaScriptIcon />;
    if (isJson) return <JsonIcon />;
    if (isTodo) return <CheckSquare size={13} className="text-blue-500 shrink-0" />;
    if (isMd) return <MarkdownIcon />;

    return <FileText size={13} className={isActive ? "text-yellow-500 shrink-0" : "text-slate-400 dark:text-slate-500 shrink-0"} />;
  };

  const getCleanName = (filePath: string) => {
    if (typeof filePath !== 'string') return "";
    const rawName = filePath.split('.').pop() || "";
    if (rawName.endsWith("_ts_node")) return rawName.replace("_ts_node", ".ts");
    if (rawName.endsWith("_js_node")) return rawName.replace("_js_node", ".js");
    if (rawName.endsWith("_py_node")) return rawName.replace("_py_node", ".py");
    if (rawName.endsWith("_api_node")) return rawName.replace("_api_node", ".api");
    if (rawName.endsWith("_todo_node")) return rawName.replace("_todo_node", ".todo");
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
  const activeCleanName = useMemo(() => getCleanName(currentFilePath), [currentFilePath]);

  // Run button visibility check: Show ONLY for .js, .ts, .py files
  const isExecutable = useMemo(() => {
    return isTs || isJs || isPy;
  }, [isTs, isJs, isPy]);

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

  const inputData = useMemo(() => getJsNodeInputData(parsedData, currentFilePath), [parsedData, currentFilePath]);

  // Read status and inputs/outputs dynamically
  const isLoading = jsNodeLoading[currentFilePath] || apiNodeLoading[currentFilePath] || false;
  const lastError = jsNodeErrors[currentFilePath] || apiNodeErrors[currentFilePath] || null;
  const resultData = jsNodeResponses[currentFilePath] || apiNodeResponses[currentFilePath];
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
      const tab = workspaceTabs.find(t => t.path === currentFilePath);
      if (tab && !tab.isDirty) {
        markWorkspaceTabDirty(currentFilePath, true);
      }
      // handleUpdateGlobalCode(currentFilePath, value); // Don't auto-save to JSON if we use explicit save
    }
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
        }
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
        type: 'STDIN_SUBMIT',
        sessionId: currentPrompt.sessionId,
        value: valueToSend
      });
    }

    // 2. Append standard terminal log of the input
    let logText = String(valueToSend);
    if (currentPrompt.type === 'confirm') {
      logText = valueToSend ? "Yes" : "No";
    } else if (currentPrompt.type === 'alert') {
      logText = "[Dismissed Alert]";
    }

    await appendLogs(currentFilePath, [{
      type: 'log',
      args: [logText],
      time: new Date().toISOString()
    }]);

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
      if (currentPrompt.type === 'confirm') {
        const normalized = terminalInput.trim().toLowerCase();
        // If empty or y/yes/true/ok/1, it means affirmative. Otherwise negative.
        const isYes = normalized === "" || normalized === "y" || normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "ok";
        finalValue = isYes;
      } else if (currentPrompt.type === 'alert') {
        finalValue = null;
      }

      await submitActivePrompt(finalValue);
      return;
    }

    const command = terminalInput.trim();
    if (!command) return;

    setTerminalInput("");

    await appendLogs(currentFilePath, [{
      type: "log",
      args: [`$ ${command}`],
      time: new Date().toISOString()
    }]);

    const parts = command.split(/\s+/);
    const cmd = parts[0];

    if (cmd === "pip") {
      const action = parts[1];
      if (action === "install") {
        const pkgs = parts.slice(2);
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [{
            type: "error",
            args: ["ERROR: You must specify at least one package to install."],
            time: new Date().toISOString()
          }]);
          return;
        }

        for (const pkg of pkgs) {
          const cleanPkg = pkg.trim();
          if (cleanPkg) {
            await usePyPackageStore.getState().installPackage(cleanPkg, currentFilePath);
          }
        }
      } else if (action === "uninstall" || action === "remove") {
        const pkgs = parts.slice(2);
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [{
            type: "error",
            args: ["ERROR: You must specify a package to uninstall."],
            time: new Date().toISOString()
          }]);
          return;
        }

        for (const pkg of pkgs) {
          const cleanPkg = pkg.trim();
          if (cleanPkg) {
            await usePyPackageStore.getState().uninstallPackage(cleanPkg, currentFilePath);
          }
        }
      } else if (action === "list") {
        const pkgs = usePyPackageStore.getState().installedPackages;
        if (pkgs.length === 0) {
          await appendLogs(currentFilePath, [{
            type: "log",
            args: ["No packages installed in this workspace."],
            time: new Date().toISOString()
          }]);
          return;
        }

        let output = "Package        Version\n";
        output += "-------------- -------\n";
        pkgs.forEach(p => {
          output += `${p.name.padEnd(14)} ${p.version}\n`;
        });

        await appendLogs(currentFilePath, [{
          type: "log",
          args: [output],
          time: new Date().toISOString()
        }]);
      } else {
        await appendLogs(currentFilePath, [{
          type: "error",
          args: [`ERROR: Unknown pip command "pip ${action}". Try: pip install, pip uninstall, pip list`],
          time: new Date().toISOString()
        }]);
      }
    } else if (cmd === "python") {
      const activeCodeValue = jsNodeCodeOverrides[currentFilePath] || getValueAtPath(parsedData, currentFilePath) || "";
      onExecute(activeCodeValue);
    } else if (cmd === "clear") {
      clearLogs();
    } else if (cmd === "help") {
      await appendLogs(currentFilePath, [{
        type: "log",
        args: [
          "Interactive Python Console Shell Commands:\n" +
          "  pip install <pkgs>   - Install libraries from Pyodide prebuilds or PyPI\n" +
          "  pip uninstall <pkg>  - Delete a package from the persisted workspace\n" +
          "  pip list             - Display installed dependencies\n" +
          "  python               - Run the active Python workbook file\n" +
          "  clear                - Erase all terminal text"
        ],
        time: new Date().toISOString()
      }]);
    } else {
      await appendLogs(currentFilePath, [{
        type: "error",
        args: [`Command error: "${cmd}" is not recognized. Type "help" for a list of valid commands.`],
        time: new Date().toISOString()
      }]);
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
  useEffect(() => {
    if (monaco && (editorLanguage === "typescript" || editorLanguage === "javascript")) {
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

      let disposable: { dispose(): void } | null = null;
      try {
        if (
          monaco.languages &&
          (monaco.languages as any).typescript &&
          (monaco.languages as any).typescript.typescriptDefaults
        ) {
          disposable = (monaco.languages as any).typescript.typescriptDefaults.addExtraLib(
            libSource,
            libUri
          );
        }
      } catch (err) {
        console.warn("Failed to mount type definitions to Monaco service", err);
      }

      return () => {
        if (disposable) {
          try {
            disposable.dispose();
          } catch (e) {
            // ignore
          }
        }
      };
    }
  }, [monaco, inputData, editorLanguage]);

  // Configure Monaco globally to prevent name clashes
  useEffect(() => {
    if (monaco) {
      try {
        if (monaco.languages && (monaco.languages as any).typescript) {
          if ((window as any).__monacoCompilerConfigured) return;
          (window as any).__monacoCompilerConfigured = true;

          const tsDefaults = (monaco.languages as any).typescript.typescriptDefaults;
          const jsDefaults = (monaco.languages as any).typescript.javascriptDefaults;

          [tsDefaults, jsDefaults].forEach((defaults) => {
            if (!defaults) return;
            const currentOptions = defaults.getCompilerOptions();
            defaults.setCompilerOptions({
              ...currentOptions,
              target: (monaco.languages as any).typescript.ScriptTarget?.Latest ?? 99,
              module: (monaco.languages as any).typescript.ModuleKind?.ESNext ?? 99,
              moduleResolution: (monaco.languages as any).typescript.ModuleResolutionKind?.NodeJs ?? 2,
              allowNonTsExtensions: false,
              isolatedModules: true,
              moduleDetection: 3,
            });
            defaults.setDiagnosticsOptions({
              diagnosticCodesToIgnore: [2451, 2300]
            });
          });
        }
      } catch (err) {
        console.warn("Failed to configure Monaco compiler settings", err);
      }
    }
  }, [monaco]);

  const { logCount, getLog, clearLogs, startOffset } = useExecutionLogs(currentFilePath);

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
        <span key={index} style={currentStyle} className="whitespace-pre-wrap break-all">
          {part}
        </span>
      );
    });
  };

  const renderArgElement = (arg: any, index: number) => {
    if (typeof arg === "string") {
      if (arg.startsWith("__MATPLOTLIB_IMAGE__:") || arg.startsWith("__MATPLOTLIB_IMAGE_JSON__:")) {
        return (
          <MatplotlibPlotViewer key={index} imageData={arg} />
        );
      }
      
      // Auto-detect LaTeX patterns
      const isLatex = /^[\s\n]*\\(mathrm|frac|sqrt|begin|sum|int|mathbf|left|right|alpha|beta|gamma|Delta|pi|mu|sigma|theta|omega|rho|lambda)/.test(arg) || 
                      /^[\s\n]*\$\$.*\$\$[\s\n]*$/s.test(arg) || 
                      /^[\s\n]*\\\[.*\\\][\s\n]*$/s.test(arg);
                      
      if (isLatex) {
        try {
           let tex = arg.trim();
           if (tex.startsWith('$$') && tex.endsWith('$$')) {
              tex = tex.slice(2, -2);
           } else if (tex.startsWith('\\[') && tex.endsWith('\\]')) {
              tex = tex.slice(2, -2);
           }
           return (
              <div key={index} className="w-full overflow-x-auto py-2 katex-display-wrapper">
                <div dangerouslySetInnerHTML={{ __html: katex.renderToString(tex, { displayMode: true, throwOnError: false }) }} />
              </div>
           );
        } catch (e) {
           // Fallback to text if error
        }
      }

      const colorized = renderColorizedOutput(arg);
      return <span key={index} className="whitespace-pre-wrap break-all">{colorized}</span>;
    }
    if (typeof arg === "undefined") {
      return (
        <span key={index} className="text-slate-400 dark:text-slate-500 italic whitespace-pre-wrap break-all">
          undefined
        </span>
      );
    }
    if (arg === null) {
      return (
        <span key={index} className="text-cyan-500 dark:text-cyan-400 font-bold whitespace-pre-wrap break-all">
          null
        </span>
      );
    }
    if (typeof arg === "number") {
      return (
        <span key={index} className="text-amber-600 dark:text-amber-400 whitespace-pre-wrap break-all">
          {arg}
        </span>
      );
    }
    if (typeof arg === "boolean") {
      return (
        <span key={index} className="text-purple-500 dark:text-purple-400 whitespace-pre-wrap break-all">
          {String(arg)}
        </span>
      );
    }
    if (typeof arg === "object") {
      const displayed = safeStringify(arg, 2);
      return (
        <span key={index} className="text-blue-600 dark:text-blue-400 whitespace-pre-wrap break-all font-mono">
          {displayed}
        </span>
      );
    }
    return <span key={index} className="whitespace-pre-wrap break-all">{String(arg)}</span>;
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
  const [terminalState, setTerminalState] = useState<"normal" | "maximized" | "hidden">("normal");
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");

  const terminalInputRef = useRef<HTMLInputElement>(null);
  const currentPrompt = activePrompts[currentFilePath];

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
        setTerminalState(prev => prev === "hidden" ? "normal" : "hidden");
      }
      // Toggle Word Wrap: Alt + Z
      if (e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setWordWrap(prev => prev === "on" ? "off" : "on");
      }
      // Save all modified tabs: Ctrl+Shift+S / Cmd+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const state = useStore.getState();
        state.workspaceTabs.forEach(tab => {
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
    if (jsNodeFocusLine !== null && jsNodeFocusLine.path === path && editorRef.current) {
      try {
        editorRef.current.revealLineInCenter(jsNodeFocusLine.line);
        editorRef.current.setPosition({ lineNumber: jsNodeFocusLine.line, column: jsNodeFocusLine.column || 1 });
        editorRef.current.focus();
      } catch (err) {
        // ignore errors gracefully
      }
      setJsNodeFocusLine(null);
    }
  }, [jsNodeFocusLine, path, setJsNodeFocusLine]);

  // Code editor options properties
  const codeEditorOptions = useMemo(() => {
    return {
      minimap: { enabled: settings.enabled },
      lineNumbers: "on" as const,
      scrollBeyondLastLine: false,
      fontSize: 13,
      fontFamily: "Fira Code, SFMono-Regular, Consolas, Menlo, monospace",
      automaticLayout: true,
      tabSize: 2,
      wordWrap: wordWrap,
      folding: true,
      lineDecorationsWidth: 10,
      renderWhitespace: settings.renderCharacters ? ("all" as const) : ("none" as const),
      scrollbar: {
        verticalSliderSize: settings.verticalSize === "fit" ? 8 : settings.verticalSize === "large" ? 14 : settings.verticalSize === "small" ? 4 : 8,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        horizontal: "auto" as const,
        vertical: "auto" as const,
        arrowSize: 11,
        useShadows: true,
        horizontalSliderSize: 8,
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
      theme: settings.editorTheme === "default" ? (appTheme === "dark" ? "customDark" : "customLight") : settings.editorTheme,
    };
  }, [settings, appTheme, wordWrap]);

  // Resizing hooks and listeners
  const consolePanelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = layoutMode === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }, [layoutMode]);

  const handleTouchStart = useCallback(() => {
    isResizing.current = true;
  }, []);

  const handleDoubleClickSplitter = useCallback(() => {
    setPanelSize(320);
    try {
      localStorage.setItem("workspace_panel_size", "320");
    } catch {}
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      let newSize = 320;
      if (layoutMode === "bottom") {
        const h = window.innerHeight;
        newSize = Math.max(100, Math.min(h - 120, h - e.clientY));
      } else {
        const w = window.innerWidth;
        newSize = Math.max(180, Math.min(w - 300, w - e.clientX));
      }
      setPanelSize(newSize);
      try {
        localStorage.setItem("workspace_panel_size", String(newSize));
      } catch {}
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing.current || !e.touches[0]) return;
      const t = e.touches[0];
      let newSize = 320;
      if (layoutMode === "bottom") {
        const h = window.innerHeight;
        newSize = Math.max(100, Math.min(h - 120, h - t.clientY));
      } else {
        const w = window.innerWidth;
        newSize = Math.max(180, Math.min(w - 300, w - t.clientX));
      }
      setPanelSize(newSize);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [layoutMode]);

  // Go to Line functionality
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState("");
  const editorRef = useRef<any>(null);

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
  const [activeSubmenu, setActiveSubmenu] = useState<"size" | "slider" | "side" | "theme" | null>(null);
  const minimapMenuRef = useRef<HTMLDivElement>(null);
  const minimapBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
        colors: {
          "editor.background": "#0d1117",
          "editor.lineHighlightBackground": "#161b22",
        },
      });
      m.editor.defineTheme("customLight", {
        base: "vs",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#ffffff",
          "editor.lineHighlightBackground": "#f1f5f9",
        },
      });
      Object.entries(editorThemes).forEach(([id, themeData]) => {
        m.editor.defineTheme(id, themeData);
      });
    } catch {
      // ignores already defined
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 nodrag">
      <div
        className="w-full md:w-[95vw] h-full md:h-[95vh] bg-white dark:bg-[#0d1117] rounded-none md:rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-100 md:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex justify-between items-center px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] select-none shrink-0">
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden mr-2">
            <div className="p-1 px-1.5 bg-[#fbd38d]/20 text-[#dd6b20] dark:bg-yellow-500/10 dark:text-yellow-400 rounded border border-yellow-200/30 font-mono text-xs hidden md:flex items-center gap-1 shrink-0">
              <FolderOpen size={13} />
              <span>Workspace</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-mono text-xs md:text-sm font-semibold truncate">
                <span>{mainCleanName}</span>
                {isEditingOtherFile && (
                  <>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    <span className="text-blue-500 font-medium truncate">{activeCleanName}</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
                {currentFilePath}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => saveSettings({ ...settings, isSidebarOpen: settings.isSidebarOpen === false ? true : false })}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              title="Toggle Sidebar"
            >
              <PanelLeft size={15} className={settings.isSidebarOpen === false ? "opacity-60" : ""} />
            </button>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 hidden sm:block mx-0.5" />

            {/* Run Button (Executable files only) */}
            {isExecutable && (
              <div className="flex items-center rounded-md bg-slate-200/60 dark:bg-slate-800/80 p-0.5 border border-slate-300 dark:border-slate-700">
                <button
                  disabled={isLoading}
                  onClick={() => onExecute(editorRef.current ? editorRef.current.getValue() : code)}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors whitespace-nowrap ${
                    isLoading
                      ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-[#2ea44f] text-white hover:bg-[#2c974b] active:bg-[#2a8f47]"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-white shrink-0" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} fill="currentColor" className="shrink-0" />
                      <span>{isApi ? "Fetch" : "Run"}</span>
                    </>
                  )}
                </button>

                {onAbort && (
                  <button
                    disabled={!isLoading}
                    onClick={onAbort}
                    className={`p-1 rounded ml-1 transition-colors cursor-pointer ${
                      isLoading
                        ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        : "text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    }`}
                    title="Stop Execution"
                  >
                    <Square size={13} fill={isLoading ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            )}

            {/* Layout Customizer Buttons */}
            <div className="flex items-center border-l border-slate-300 dark:border-slate-700 pl-2 gap-1">
              {/* Go to Line Shortcut button */}
              <button
                onClick={() => {
                  setIsGoToLineOpen(true);
                  setGoToLineValue("");
                }}
                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer text-xs font-mono font-bold transition-colors hidden sm:block"
                title="Go to line (Ctrl+G)"
              >
                Line
              </button>

              <button
                onClick={() => {
                  if (editorRef.current) {
                    try {
                      editorRef.current.getAction("editor.action.formatDocument").run();
                    } catch (err) {
                      console.warn("Monaco document formatting error:", err);
                    }
                  }
                }}
                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer text-xs font-bold transition-colors"
                title="Format Document (Shift+Alt+F)"
              >
                Format
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(editorRef.current ? editorRef.current.getValue() : code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-1.5 flex items-center justify-center min-w-[28px] rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
                title="Copy Contents"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>

              {/* Advanced Minimap/Editor Config */}
              <div className="relative shrink-0">
                <button
                  ref={minimapBtnRef}
                  onClick={() => setIsMinimapMenuOpen(!isMinimapMenuOpen)}
                  className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors ${isMinimapMenuOpen ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200" : ""}`}
                  title="Editor Options & Themes"
                >
                  <Settings2 size={14} />
                </button>

                {isMinimapMenuOpen && (
                  <div
                    ref={minimapMenuRef}
                    className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#161b22] border border-slate-300 dark:border-slate-800 shadow-xl rounded-md pt-1 pb-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs select-none"
                  >
                    <div className="px-3 py-1.5 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500 select-none">
                      Editor Preferences
                    </div>

                    <button
                      onClick={() => saveSettings({ ...settings, enabled: !settings.enabled })}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 flex justify-between items-center transition-colors"
                    >
                      <span>Show Minimap</span>
                      {settings.enabled && <Check size={12} className="text-blue-500" />}
                    </button>

                    <button
                      onClick={() => saveSettings({ ...settings, renderCharacters: !settings.renderCharacters })}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 flex justify-between items-center transition-colors"
                    >
                      <span>Show Whitespace</span>
                      {settings.renderCharacters && <Check size={12} className="text-blue-500" />}
                    </button>

                    {/* Editor Themes Nested Options */}
                    <div className="border-t border-slate-200 dark:border-slate-800 my-1" />
                    <button
                      onClick={() => setActiveSubmenu(activeSubmenu === "theme" ? null : "theme")}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 flex justify-between items-center transition-colors font-medium text-blue-600 dark:text-blue-400"
                    >
                      <span>Select Theme</span>
                      <ChevronRight size={13} className={`transform transition-transform ${activeSubmenu === "theme" ? "rotate-90" : ""}`} />
                    </button>

                    {activeSubmenu === "theme" && (
                      <div className="bg-slate-50 dark:bg-[#0d1117] border-y border-slate-200 dark:border-slate-800/80 max-h-40 overflow-auto scrollbar-thin">
                        {(["default", "one-dark-pro", "dracula", "night-owl", "github-dark", "synthwave-84"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => saveSettings({ ...settings, editorTheme: t })}
                            className="w-full text-left px-4 py-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/30 flex justify-between items-center transition-colors font-mono text-[10px]"
                          >
                            <span>{t}</span>
                            {settings.editorTheme === t && <Check size={10} className="text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-red-500 hover:text-white text-slate-500 dark:text-slate-400 cursor-pointer transition-colors ml-1"
              title="Close Workspace"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Workspace Panels Main body */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-100 dark:bg-[#0c0f16] relative">
          
          {/* Mobile Sidebar Backdrop */}
          {settings.isSidebarOpen !== false && (
            <div 
              className="absolute inset-0 bg-black/50 z-30 md:hidden" 
              onClick={() => saveSettings({ ...settings, isSidebarOpen: false })} 
            />
          )}

          {/* Side Drawer Panel */}
          {settings.isSidebarOpen !== false && (
          <div 
            style={{ width: `${settings.sidebarWidth || 260}px` }}
            className="absolute md:relative top-0 bottom-0 left-0 max-w-[85vw] md:max-w-none border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex flex-col overflow-hidden select-none shrink-0 z-40 md:z-30 transition-[width]"
          >
            {/* Elegant Header Sidebar Tabs to switch between Files Explorer and Python Packages Panel */}
            {isPy ? (
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 p-2 bg-slate-100/50 dark:bg-[#161b22]/50 shrink-0 select-none">
                <button 
                  onClick={() => setSidebarTab("files")}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition ${sidebarTab === "files" ? "bg-white dark:bg-[#21262d] text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  Explorer
                </button>
                <button 
                  onClick={() => setSidebarTab("packages")}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition ${sidebarTab === "packages" ? "bg-white dark:bg-[#21262d] text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  Packages
                </button>
              </div>
            ) : (
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 bg-slate-100/50 dark:bg-[#161b22]/50 shrink-0 select-none">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Explorer</span>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
              {sidebarTab === "files" ? (
                <FileExplorerPanel />
              ) : (
                <PyPackagesPanel />
              )}
            </div>
            
            {/* Draggable Resizer */}
            <div 
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = settings.sidebarWidth || 260;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientX - startX;
                  const newWidth = Math.max(160, Math.min(600, startWidth + delta));
                  saveSettings({...settings, sidebarWidth: newWidth});
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                  document.body.style.cursor = "";
                };
                
                document.body.style.cursor = "col-resize";
                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
              className="absolute top-0 right-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 transition-colors"
            />
          </div>
          )}

          {/* Code Editor and Output Split Panels Area */}
          <div
            className={`flex-1 flex overflow-hidden h-full relative ${layoutMode === "bottom" ? "flex-col" : "flex-col lg:flex-row"}`}
          >
            <div
              className={`flex-1 z-10 relative min-w-[200px] min-h-[100px] flex flex-col bg-white dark:bg-[#0d1117] overflow-hidden ${terminalState === "maximized" ? "hidden" : "flex"}`}
            >
              {/* Tabs list (Editor header) */}
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-[#f8fafc]/80 dark:bg-[#0c0f16]/40 overflow-x-auto select-none shrink-0 scrollbar-none">
                {workspaceTabs.length === 0 && (
                  <div className="px-4 py-2 text-xs font-mono text-slate-400 dark:text-slate-500 italic">No files open</div>
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
                        e.dataTransfer.setData('text/plain', idx.toString());
                        e.dataTransfer.effectAllowed = 'move';
                        e.currentTarget.classList.add('opacity-50');
                      }}
                      onDragEnd={(e) => {
                        (window as any).__isInternalDrag = false;
                        e.currentTarget.classList.remove('opacity-50');
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        if (isLeft) {
                          e.currentTarget.classList.add('border-l-[3px]', 'border-l-blue-500', 'pl-[13px]');
                          e.currentTarget.classList.remove('border-r-[3px]', 'border-r-blue-500', 'pr-[13px]');
                          // maintain normal px-4 padding minus 3px border
                        } else {
                          e.currentTarget.classList.add('border-r-[3px]', 'border-r-blue-500', 'pr-[13px]');
                          e.currentTarget.classList.remove('border-l-[3px]', 'border-l-blue-500', 'pl-[13px]');
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-l-[3px]', 'border-l-blue-500', 'pl-[13px]', 'border-r-[3px]', 'border-r-blue-500', 'pr-[13px]');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        e.currentTarget.classList.remove('border-l-[3px]', 'border-l-blue-500', 'pl-[13px]', 'border-r-[3px]', 'border-r-blue-500', 'pr-[13px]');
                        
                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
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
                      className={`flex items-center gap-1.5 px-4 py-2 border-r border-r-slate-200 dark:border-r-slate-800 text-xs font-mono transition-colors cursor-pointer shrink-0 group border-t-2 ${
                        isActive
                          ? "bg-white dark:bg-[#0d1117] !border-t-blue-500 font-semibold text-slate-800 dark:text-slate-100"
                          : "border-t-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {getTabIcon(tab.path, isActive)}
                      <span className={`truncate max-w-[120px] ${tab.isPreview ? "italic" : ""}`}>{cleanName}</span>
                      
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          closeWorkspaceTab(tab.path);
                        }}
                        className={`ml-1 flex items-center justify-center w-4 h-4 rounded-md transition-colors ${tab.isDirty ? "" : "opacity-0 group-hover:opacity-100"} hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200`}
                      >
                        {tab.isDirty ? (
                          <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:hidden" />
                        ) : null}
                        <X size={12} className={tab.isDirty ? "hidden group-hover:block" : ""} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Editor Component frame */}
              <div className="flex-1 relative flex flex-col min-h-0">
                {isGoToLineOpen && (
                  <div className="absolute top-2 right-4 z-50 bg-slate-50 dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 shadow-xl rounded-md p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono pl-1 shrink-0">Go to:</span>
                    <input
                      type="text"
                      placeholder="line:col (e.g. 10:5)"
                      value={goToLineValue}
                      onChange={(e) => setGoToLineValue(e.target.value)}
                      className="bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono w-40"
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
                      className="px-3 py-1 bg-[#3178C6] hover:bg-[#2762a4] text-white text-xs font-bold rounded transition-colors whitespace-nowrap"
                    >
                      Go
                    </button>
                    <button
                      onClick={() => {
                        setIsGoToLineOpen(false);
                        if (editorRef.current) editorRef.current.focus();
                      }}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors block"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                {isTodo ? (
                  <TodoWorkspace path={currentFilePath} />
                ) : (
                <SafeEditor
                  path={currentFilePath}
                  height="100%"
                  defaultLanguage="javascript"
                  language={editorLanguage}
                  theme={
                    codeEditorOptions.theme ||
                    (appTheme === "dark" ? "customDark" : "customLight")
                  }
                  value={isEditingOtherFile && typeof otherFileValue === "string" ? otherFileValue : code}
                  onChange={handleEditorChange}
                  options={codeEditorOptions}
                  beforeMount={handleEditorWillMount}
                  onMount={(editor, m) => {
                    editorRef.current = editor;
                    try {
                      editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyG, () => {
                        latestRefs.current.setIsGoToLineOpen(true);
                        latestRefs.current.setGoToLineValue("");
                      });
                    } catch (err) {
                      console.warn("Could not register Ctrl+G command in Monaco", err);
                    }
                    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => {
                      if (latestRefs.current.isExecutable) {
                        latestRefs.current.onExecute(editor.getValue());
                        if (latestRefs.current.terminalState === "hidden") {
                          latestRefs.current.setTerminalState("normal");
                        }
                      }
                    });
                    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
                      const val = editor.getValue();
                      latestRefs.current.updateNodeValue(latestRefs.current.currentFilePath, val);
                      latestRefs.current.markWorkspaceTabDirty(latestRefs.current.currentFilePath, false);
                      // Visual confirmation can be added here if needed
                    });

                    // Ctrl+Click to open imported file
                    editor.onMouseDown((e) => {
                      if (e.event.ctrlKey || e.event.metaKey) {
                        const position = e.target.position;
                        if (!position) return;
                        const model = editor.getModel();
                        if (!model) return;
                        const lineContent = model.getLineContent(position.lineNumber);
                        
                        let packageName = "";
                        const importMatch = lineContent.match(/from\s+['"]?([a-zA-Z0-9_.\/-]+)['"]?\s+import/);
                        const importMatch2 = lineContent.match(/import\s+['"]?([a-zA-Z0-9_.\/-]+)['"]?/);
                        if (importMatch && lineContent.includes("from")) {
                          packageName = importMatch[1];
                        } else if (importMatch2 && lineContent.includes("import")) {
                          packageName = importMatch2[1];
                        }
                        
                        if (packageName) {
                          const state = useStore.getState();
                          if (!state.parsedData) return;
                          
                          const currentVirtualPath = getVirtualPath(latestRefs.current.currentFilePath, state.parsedData);
                          const currentDir = currentVirtualPath.substring(0, currentVirtualPath.lastIndexOf('/')) || '/';
                          
                          let resolvedPackage = packageName;
                          if (packageName.startsWith('.')) {
                             const dotGroups = packageName.match(/^(\.+)(.*)/);
                             if (dotGroups) {
                               const dots = dotGroups[1].length;
                               const rest = dotGroups[2];
                               const parts = currentDir.split('/').filter(Boolean);
                               const back = dots - 1; // . = same, .. = up 1, ... = up 2
                               const resolvedParts = parts.slice(0, parts.length - back);
                               if (rest) {
                                 resolvedPackage = [...resolvedParts, ...rest.split('.')].join('/');
                               } else {
                                 resolvedPackage = resolvedParts.join('/');
                               }
                             }
                          } else {
                             resolvedPackage = packageName.split('.').join('/');
                          }
                          
                          if (!resolvedPackage.startsWith('/')) {
                             resolvedPackage = '/' + resolvedPackage;
                          }
                          
                          const possibleVFSPaths = [
                             `${resolvedPackage}.py`,
                             `${resolvedPackage}/__init__.py`,
                             `${resolvedPackage}.ts`,
                             `${resolvedPackage}.js`
                          ];

                          let foundFsPath = "";
                          let foundObjectPath = "";
                          
                          function traverseFind(obj: any, parentFsPath: string, parentObjPath: string) {
                            if (typeof obj !== 'object' || obj === null) return;
                            for (const [key, val] of Object.entries(obj)) {
                              const currObjPath = parentObjPath ? `${parentObjPath}.${key}` : `root.${key}`;
                              if (typeof val === 'string') {
                                let ext = '';
                                if (key.endsWith('.ts') || key.endsWith('_ts_node')) ext = '.ts';
                                else if (key.endsWith('.js') || key.endsWith('_js_node')) ext = '.js';
                                else if (key.endsWith('.py') || key.endsWith('_py_node')) ext = '.py';
                                else if (key.endsWith('.json') || key.endsWith('_json_node')) ext = '.json';
                                
                                if (ext) {
                                   let baseName = key;
                                   if (baseName.endsWith('_ts_node')) baseName = baseName.replace(/_ts_node$/, '');
                                   else if (baseName.endsWith('_js_node')) baseName = baseName.replace(/_js_node$/, '');
                                   else if (baseName.endsWith('_py_node')) baseName = baseName.replace(/_py_node$/, '');
                                   if (!baseName.endsWith(ext)) baseName += ext;
                                   
                                   const fsPath = parentFsPath ? `${parentFsPath}/${baseName}` : `/${baseName}`;
                                   if (possibleVFSPaths.includes(fsPath)) {
                                      foundFsPath = fsPath;
                                      foundObjectPath = currObjPath;
                                   }
                                }
                              } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                const nextPath = parentFsPath ? `${parentFsPath}/${key}` : `/${key}`;
                                traverseFind(val, nextPath, currObjPath);
                              }
                            }
                          }
                          
                          traverseFind(state.parsedData, '', '');
                          if (foundObjectPath) {
                            latestRefs.current.openWorkspaceTab(foundObjectPath, false);
                          }
                        }
                      }
                    });
                  }}
                />
                )}
              </div>
            </div>

            {/* Output Split Console and Results Panel */}
            <div
              ref={consolePanelRef}
              className={`${layoutMode === "bottom" ? "border-t" : "border-l"} border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex-col relative z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] ${terminalState === "hidden" ? "hidden" : "flex"}`}
              style={
                terminalState === "maximized"
                  ? { flex: 1, width: "100%", height: "100%" }
                  : {
                      [layoutMode === "bottom" ? "height" : "width"]: panelSize,
                    }
              }
            >
              {/* Panel Resizer Drag Bar Handle */}
              {terminalState !== "maximized" && (
                <div
                  className={`absolute z-30 group ${layoutMode === "bottom" ? "top-0 left-0 right-0 h-2 -translate-y-1/2 cursor-row-resize" : "left-0 top-0 bottom-0 w-2 -translate-x-1/2 cursor-col-resize"}`}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onDoubleClick={handleDoubleClickSplitter}
                >
                  <div className="w-full h-full bg-transparent group-hover:bg-blue-500/30 transition-colors flex items-center justify-center">
                    {layoutMode === "bottom" ? (
                      <div className="w-8 h-1 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-blue-500 shadow-sm" />
                    ) : (
                      <div className="w-1 h-8 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-blue-500 shadow-sm" />
                    )}
                  </div>
                </div>
              )}

              {/* Console/Result Pane tabs header */}
              <div className="flex justify-between items-center bg-slate-100/80 dark:bg-[#11161d] border-b border-slate-200 dark:border-slate-800 select-none shrink-0 overflow-x-auto scrollbar-none">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("console")}
                    className={`px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-medium border-r border-r-slate-200 dark:border-r-slate-800 transition-colors shrink-0 flex items-center gap-1.5 ${activeTab === "console" ? "bg-white dark:bg-[#0d1117] text-blue-600 dark:text-blue-400 border-t-2 !border-t-blue-500 font-semibold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-t-2 border-t-transparent hover:text-slate-800 dark:hover:text-slate-200"}`}
                  >
                    <TerminalIcon size={13} className="shrink-0" />
                    <span>Console</span>
                    {logCount > 0 && (
                      <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {logCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("result")}
                    className={`px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-medium border-r border-r-slate-200 dark:border-r-slate-800 transition-colors shrink-0 ${activeTab === "result" ? "bg-white dark:bg-[#0d1117] text-blue-600 dark:text-blue-400 border-t-2 !border-t-blue-500 font-semibold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-t-2 border-t-transparent hover:text-slate-800 dark:hover:text-slate-200"}`}
                  >
                    Output Result
                  </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center px-3 border-l border-slate-200 dark:border-slate-800 gap-2 py-1">
                  {activeTab === "console" && (
                    <button
                      onClick={async () => {
                        try {
                          const logsToCopy = [];
                          for (let i = 0; i < logCount; i++) {
                            const lg = getLog(i);
                            if (lg && lg.args) {
                              logsToCopy.push(lg.args.map((a: any) => typeof a === "object" ? safeStringify(a) : String(a)).join(" "));
                            }
                          }
                          await navigator.clipboard.writeText(logsToCopy.join("\n"));
                          setCopiedConsole(true);
                          setTimeout(() => setCopiedConsole(false), 2000);
                        } catch (err) {
                          console.error("Failed to copy console logs", err);
                        }
                      }}
                      className={`py-1 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 outline-none ${
                        copiedConsole
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 font-semibold"
                          : logCount > 0
                            ? "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
                            : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                      }`}
                      title="Copy all console logs"
                      disabled={logCount === 0}
                    >
                      {copiedConsole ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      <span className="hidden sm:inline">{copiedConsole ? "Copied" : "Copy Output"}</span>
                    </button>
                  )}

                  {activeTab === "console" && (
                    <button
                      onClick={clearLogs}
                      className={`py-1 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 outline-none ${
                        logCount > 0
                          ? "text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 cursor-pointer"
                          : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                      }`}
                      title="Clear console logs"
                      disabled={logCount === 0}
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}

                  {/* Toggle clear logs setting */}
                  {activeTab === "console" && (
                    <button
                      onClick={() => setAutoClearLogs(!autoClearLogs)}
                      className={`py-1 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 outline-none ${
                        autoClearLogs
                          ? "text-blue-600 dark:text-blue-400 bg-blue-550/10 hover:bg-blue-550/20"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
                      }`}
                      title="Auto clear logs on execution run"
                    >
                      <Clock size={13} />
                      <span className="hidden sm:inline">Auto-Clear</span>
                    </button>
                  )}

                  {/* Toggle terminal State buttons */}
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

                  <div className="flex gap-0.5 items-center">
                    <button
                      onClick={() => setLayoutMode(layoutMode === "bottom" ? "right" : "bottom")}
                      className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors hidden sm:block outline-none"
                      title={layoutMode === "bottom" ? "Layout to Right Side" : "Layout to Bottom"}
                    >
                      {layoutMode === "bottom" ? <PanelRight size={13} /> : <PanelBottom size={13} />}
                    </button>
                    <button
                      onClick={() => setTerminalState(terminalState === "maximized" ? "normal" : "maximized")}
                      className={`p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors outline-none ${terminalState === "maximized" ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200" : ""}`}
                      title={terminalState === "maximized" ? "Restore Pane Size" : "Maximize Console View"}
                    >
                      <Maximize size={13} />
                    </button>
                    <button
                      onClick={() => setTerminalState("hidden")}
                      className="p-1 rounded text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 transition-colors outline-none"
                      title="Hide Output Pane"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab views content area */}
              <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white dark:bg-[#0d1117] relative">
                {activeTab === "result" && (
                  <div className="p-4 h-full">
                    {lastError ? (
                      <div className="p-4 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-mono whitespace-pre-wrap rounded-r flex justify-between items-start gap-2 group/err">
                        <span className="flex-1 min-w-0">
                          {typeof lastError === "object" && lastError !== null
                            ? (lastError as any).userMessage || (lastError as any).message
                            : String(lastError)}
                        </span>
                        <CopyButton
                          text={
                            typeof lastError === "object" && lastError !== null
                              ? (lastError as any).userMessage || (lastError as any).message
                              : String(lastError)
                          }
                        />
                      </div>
                    ) : hasData ? (
                      <pre className="font-mono text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {(() => {
                          try {
                            return JSON.stringify(resultData, null, 2);
                          } catch {
                            return "[Unserializable Result Data]";
                          }
                        })()}
                      </pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-600 italic text-sm">
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
                      <div className="h-full flex items-center justify-center text-slate-500 italic text-sm absolute inset-0">
                        No console output.
                      </div>
                    ) : (
                      <div className="font-mono text-[13px] bg-white dark:bg-[#0d1117] h-full overflow-hidden custom-scrollbar">
                        <Virtuoso
                          totalCount={logCount + (lastError ? 1 : 0)}
                          firstItemIndex={startOffset}
                          className="h-full custom-scrollbar overflow-x-hidden w-full"
                          followOutput="auto"
                          itemContent={(index) => {
                            if (index === logCount && lastError) {
                              const errorStr = typeof lastError === "object" && lastError !== null ? (lastError as any).message : String(lastError);
                              return (
                                <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex justify-between items-start gap-4 w-full group/err">
                                  <div className="flex-1 min-w-0 font-bold whitespace-pre-wrap flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">✖</span>
                                    <span>{renderClickableErrorText(errorStr, currentFilePath, setJsNodeFocusLine)}</span>
                                  </div>
                                  <CopyButton text={errorStr} />
                                </div>
                              );
                            }
                            const log = getLog(index);
                            if (!log) {
                              return <div className="px-4 py-0 text-slate-400 text-xs italic">Loading...</div>;
                            }
                            return (
                              <div
                                className={`px-4 py-0.5 flex items-start gap-4 w-full group/log ${log.type === "error" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : log.type === "warn" ? "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"}`}
                              >
                                <div className="flex-1 min-w-0 font-mono">
                                  <div className="flex flex-wrap items-start gap-2 w-full text-[13px]">
                                    {log.args.map((arg: any, argIdx: number) =>
                                      renderArgElement(arg, argIdx)
                                    )}
                                  </div>
                                </div>
                                {log.type === "error" && (
                                  <div className="opacity-0 group-hover/log:opacity-100 focus-within:opacity-100 transition-opacity self-start shrink-0">
                                    <CopyButton text={log.args.map((arg: any) => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ")} />
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
                      className={`border-t px-4 py-2 flex items-center gap-3 font-mono text-xs shrink-0 select-text transition-colors duration-200 ${
                        currentPrompt
                          ? "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/20"
                          : "bg-slate-50 dark:bg-[#161b22] border-slate-200 dark:border-slate-800 text-slate-455"
                      }`}
                    >
                      {currentPrompt ? (
                        <span className="text-amber-500 font-bold select-none shrink-0 flex items-center gap-1.5 animate-pulse">
                          {currentPrompt.type === 'confirm' ? 'Confirm (y/n) ›' : currentPrompt.type === 'alert' ? 'Alert ›' : 'Input ›'}
                        </span>
                      ) : (
                        <span className="text-emerald-500 font-bold select-none shrink-0">$</span>
                      )}

                      <input
                        ref={terminalInputRef}
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        placeholder={
                          currentPrompt
                            ? currentPrompt.type === 'confirm'
                              ? "Type 'y' or 'n' (or click controls) and press Enter..."
                              : currentPrompt.type === 'alert'
                                ? "Press Enter (or click OK) to acknowledge..."
                                : "Type response and press Enter... " + (currentPrompt.promptText && currentPrompt.promptText !== "Python input requested" ? `(${currentPrompt.promptText})` : "")
                            : "pip install <package>, pip list, clear, help, python..."
                        }
                        className="flex-1 bg-transparent border-0 outline-none p-0 focus:outline-none focus:ring-0 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-normal text-xs font-mono"
                        autoComplete="off"
                      />

                      {currentPrompt && currentPrompt.type === 'confirm' && (
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

                      {currentPrompt && currentPrompt.type === 'alert' && (
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
                            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                              navigator.serviceWorker.controller.postMessage({
                                type: 'STDIN_CANCEL',
                                sessionId: currentPrompt.sessionId
                              });
                            }
                            await appendLogs(currentFilePath, [{
                              type: 'warn',
                              args: ['[Cancelled]'],
                              time: new Date().toISOString()
                            }]);
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
        </div>
      </div>
    </div>,
    document.body
  );
}
