import { useStore } from "../store/useStore";
import SafeEditor from "./SafeEditor";
import CustomSelect from "./CustomSelect";
import MergeConfigDialog from "./MergeConfigDialog";
import React, { useEffect, useRef, useState, Suspense } from "react";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import {
  Play,
  Code,
  Loader2,
  Globe,
  CheckCircle2,
  SlidersHorizontal,
  FolderOpen,
} from "lucide-react";
import {
  smartJsonFetch,
  SmartFetchOptions,
  SmartFetchResult,
  normalizeUrl,
  proxyRoutesFromSettings,
} from "../utils/smartJsonFetch";

/** Each method's colour, as API tools usually show them: a dot on the picker and in its menu. */
const METHOD_DOT: Record<string, string> = {
  GET: "bg-emerald-400",
  POST: "bg-amber-400",
  PUT: "bg-sky-300",
  PATCH: "bg-violet-400",
  DELETE: "bg-rose-400",
  HEAD: "bg-slate-300",
  OPTIONS: "bg-slate-300",
};

const methodDot = (method: string) => (
  <span className={`inline-block h-2 w-2 rounded-full ring-2 ring-white/25 ${METHOD_DOT[method]}`} />
);

const METHOD_OPTIONS = [
  { value: "GET", label: "GET", description: "Read data" },
  { value: "POST", label: "POST", description: "Send data, create something" },
  { value: "PUT", label: "PUT", description: "Replace something" },
  { value: "PATCH", label: "PATCH", description: "Change part of something" },
  { value: "DELETE", label: "DELETE", description: "Remove something" },
  { value: "HEAD", label: "HEAD", description: "Status and headers only" },
  { value: "OPTIONS", label: "OPTIONS", description: "What the server allows" },
].map((option) => ({ ...option, icon: methodDot(option.value) }));

/** Methods whose request may carry a body. */
const BODY_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const FORMAT_LABEL: Record<string, string> = {
  json: "JSON",
  ndjson: "NDJSON as an array",
  yaml: "YAML as JSON",
  csv: "CSV as rows",
  text: "text (in body)",
  empty: "empty body",
  head: "status and headers",
};

const SmartFetchErrorUI = lazyWithRetry(() => import("./SmartFetchErrorUI"), "SmartFetchErrorUI");
const GuiEditorPanel = lazyWithRetry(() => import("./GuiEditorPanel"), "GuiEditorPanel");
const FileExplorerPanel = lazyWithRetry(() => import("./FileExplorerPanel"), "FileExplorerPanel");
import { applyPatchSmart, mergeJSON } from "../utils/patchUtils";
import { maskCodeString, unmaskCodeString, SHOW_MORE_MARKERS, markAsExpanded, markAsCollapsed } from "../utils/masker";

export default function EditorPanel() {
  const code = useStore((state) => state.code);
  const setCode = useStore((state) => state.setCode);
  const clearCode = useStore((state) => state.clearCode);
  const error = useStore((state) => state.error);
  const parsedData = useStore((state) => state.parsedData);
  const appTheme = useStore((state) => state.appTheme);
  const codeFormat = useStore((state) => state.codeFormat);
  const apiMethod = useStore((state) => state.apiMethod);
  const setApiMethod = useStore((state) => state.setApiMethod);
  const apiUrl = useStore((state) => state.apiUrl);
  const setApiUrl = useStore((state) => state.setApiUrl);
  const apiHeaders = useStore((state) => state.apiHeaders);
  const setApiHeaders = useStore((state) => state.setApiHeaders);
  const apiBody = useStore((state) => state.apiBody);
  const setApiBody = useStore((state) => state.setApiBody);
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const resetApiConfig = useStore((state) => state.resetApiConfig);
  const proxyServers = useStore((state) => state.proxyServers);
  const useDefaultProxy = useStore((state) => state.useDefaultProxy);
  const isAIPaletteOpen = useStore((state) => state.isAIPaletteOpen);
  const setIsAIPaletteOpen = useStore((state) => state.setIsAIPaletteOpen);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const showMoreWidgetsRef = useRef<any[]>([]);
  const decorationsRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fetchProgress, setFetchProgress] = useState<{
    phase: "native-fetch" | "fallback-fetch" | "json-parse" | "initial";
    message: string;
    usingFallback: boolean;
  } | null>(null);
  const [fetchResult, setFetchResult] = useState<SmartFetchResult | null>(null);
  const [appendData, setAppendData] = useState(false);
  const [expandTrigger, setExpandTrigger] = useState(0);
  const [wordWrapMode, setWordWrapMode] = useState<"on" | "off">("on");

  useEffect(() => {
    // Other effects
  }, []);

  // Merge modal states
  const [pendingMergeResult, setPendingMergeResult] =
    useState<SmartFetchResult | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<
    "default" | "url" | "custom"
  >("url");
  const [customMergeKey, setCustomMergeKey] = useState("");
  const [conflictAction, setConflictAction] = useState<
    "replace" | "rename" | "deep-merge"
  >("rename");

  function generateUrlKey(url: string) {
    try {
      const urlObj = new URL(url);
      const hostParts = urlObj.hostname.split(".");
      let domain =
        hostParts.length > 1 ? hostParts[hostParts.length - 2] : hostParts[0];
      if (domain === "typicode" && hostParts[0] === "jsonplaceholder")
        domain = "jsonplaceholder";
      let path = urlObj.pathname
        .replace(/^\/+|\/+$/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_");
      path = path.replace(/_+/g, "_");
      let key = path ? `${domain}_${path}` : domain;
      if (key.length > 50) key = key.substring(0, 50);
      if (key.endsWith("_")) key = key.slice(0, -1);
      return key || "fetched_data";
    } catch (e) {
      return "fetched_data";
    }
  }

  function getActiveMergeKey() {
    if (mergeStrategy === "default") return "fetched_data";
    if (mergeStrategy === "url") return generateUrlKey(apiUrl);
    let key = customMergeKey.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!key || ["__proto__", "constructor", "prototype"].includes(key))
      return "fetched_data";
    return key;
  }

  /** The key a rename gives: key_2, key_3... the first not taken - as executeMerge picks it. */
  function nextFreeKey(key: string) {
    const taken =
      parsedData !== null && typeof parsedData === "object" && !Array.isArray(parsedData)
        ? (parsedData as Record<string, unknown>)
        : {};
    let counter = 2;
    while (`${key}_${counter}` in taken) counter++;
    return `${key}_${counter}`;
  }

  function checkCollision(key: string) {
    return (
      parsedData !== null &&
      typeof parsedData === "object" &&
      !Array.isArray(parsedData) &&
      key in parsedData
    );
  }

  useEffect(() => {
    const handleFormat = async () => {
      // existing handleFormat logic
      if (activeTab === "raw") {
        const { codeFormat, code, setCode } = useStore.getState();
        if (codeFormat === "json") {
          try {
            const parsed = JSON.parse(code);
            setCode(JSON.stringify(parsed, null, 2));
          } catch (e) { }
        } else if (codeFormat === "yaml") {
          try {
            const yaml = (await import("js-yaml")).default;
            const parsed = yaml.load(code);
            if (typeof parsed === "object") {
              setCode(yaml.dump(parsed));
            }
          } catch (e) { }
        }
      }
    };
    window.addEventListener("format-editor", handleFormat);
    return () => window.removeEventListener("format-editor", handleFormat);
  }, [activeTab]);

  const handleApplyAIPatch = async (patch: any, mode: 'merge' | 'replace' = 'merge') => {
    try {
      const currentParsedData = useStore.getState().parsedData;
      const baseDoc = (currentParsedData !== null && typeof currentParsedData === 'object')
        ? currentParsedData
        : {};

      const res = applyPatchSmart(baseDoc, patch);
      let finalDoc: any;

      if (mode === 'replace') {
        finalDoc = res.newDocument;
      } else {
        finalDoc = mergeJSON(baseDoc, res.newDocument);
      }

      const codeFormat = useStore.getState().codeFormat;
      let newCode = "";
      if (codeFormat === 'yaml') {
        try {
          const yaml = (await import('js-yaml')).default;
          newCode = yaml.dump(finalDoc);
        } catch {
          newCode = JSON.stringify(finalDoc, null, 2);
        }
      } else {
        newCode = JSON.stringify(finalDoc, null, 2);
      }

      setCode(newCode);
    } catch (e: any) {
      alert("Failed to apply patch: " + (e.message || String(e)));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAIPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(unmaskCodeString(value));
    }
  };

  const maskedCode = React.useMemo(() => maskCodeString(code), [code, expandTrigger]);

  // Set up "Show more" / "Show less" content widgets on lines with truncated values
  const setupShowMoreWidgets = React.useCallback((editor: any, monaco: any) => {
    // Remove existing widgets
    for (const widget of showMoreWidgetsRef.current) {
      try { editor.removeContentWidget(widget); } catch { /* ignore */ }
    }
    showMoreWidgetsRef.current = [];

    // Remove existing decorations
    if (decorationsRef.current) {
      try { decorationsRef.current.clear(); } catch { /* ignore */ }
      decorationsRef.current = null;
    }

    const model = editor.getModel();
    if (!model) return;

    const morePrefix = SHOW_MORE_MARKERS.PREFIX;
    const moreSuffix = SHOW_MORE_MARKERS.SUFFIX;
    const lessPrefix = SHOW_MORE_MARKERS.LESS_PREFIX;
    const lessSuffix = SHOW_MORE_MARKERS.LESS_SUFFIX;
    const lineCount = model.getLineCount();
    const newDecorations: any[] = [];

    for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
      const lineContent = model.getLineContent(lineNum);

      // Check for SHOW_MORE marker (collapsed/truncated value)
      let markerStart = lineContent.indexOf(morePrefix);
      let isShowLess = false;

      if (markerStart === -1) {
        // Check for SHOW_LESS marker (expanded value)
        markerStart = lineContent.indexOf(lessPrefix);
        if (markerStart === -1) continue;
        isShowLess = true;
      }

      const prefix = isShowLess ? lessPrefix : morePrefix;
      const suffix = isShowLess ? lessSuffix : moreSuffix;

      const markerEnd = lineContent.indexOf(suffix, markerStart + prefix.length);
      if (markerEnd === -1) continue;

      // Extract id and size from the marker
      const markerBody = lineContent.slice(markerStart + prefix.length, markerEnd);
      const colonIdx = markerBody.indexOf(':');
      if (colonIdx === -1) continue;

      const id = parseInt(markerBody.slice(0, colonIdx), 10);
      const sizeLabel = markerBody.slice(colonIdx + 1);

      if (isNaN(id)) continue;

      // Column positions (1-indexed)
      const startCol = markerStart + 1;
      const endCol = markerEnd + suffix.length + 1; // +length for suffix, +1 for 1-indexing

      // Hide the raw marker text via decoration
      newDecorations.push({
        range: new monaco.Range(lineNum, startCol, lineNum, endCol),
        options: {
          inlineClassName: 'show-more-marker-hidden',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Create the widget DOM
      const widgetId = `show-${isShowLess ? 'less' : 'more'}-widget-${lineNum}-${id}`;
      const widgetDom = document.createElement('span');
      widgetDom.className = isShowLess ? 'show-less-widget' : 'show-more-widget';
      widgetDom.textContent = isShowLess ? `Show less (${sizeLabel})` : `Show more (${sizeLabel})`;
      widgetDom.title = isShowLess
        ? `Click to collapse this value (${sizeLabel})`
        : `Click to show the full value (${sizeLabel})`;
      widgetDom.setAttribute('data-mask-id', String(id));

      const handleInteraction = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        if (isShowLess) {
          markAsCollapsed(id);
        } else {
          markAsExpanded(id);
        }
        setExpandTrigger(prev => prev + 1);
      };

      widgetDom.addEventListener('click', handleInteraction);
      widgetDom.addEventListener('pointerdown', handleInteraction);

      const contentWidget = {
        getId: () => widgetId,
        getDomNode: () => widgetDom,
        getPosition: () => ({
          position: { lineNumber: lineNum, column: startCol },
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
        }),
      };

      editor.addContentWidget(contentWidget);
      showMoreWidgetsRef.current.push(contentWidget);
    }

    // Apply decorations
    if (newDecorations.length > 0) {
      decorationsRef.current = editor.createDecorationsCollection(newDecorations);
    }
  }, []);

  // Update widgets when the masked code changes
  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (editor && monaco && activeTab === 'raw') {
      // Small delay to ensure the model is updated
      const timer = setTimeout(() => setupShowMoreWidgets(editor, monaco), 50);
      return () => clearTimeout(timer);
    }
  }, [maskedCode, activeTab, setupShowMoreWidgets]);

  const handleEditorDidMount = (editor: any, monaco?: any) => {
    editorRef.current = editor;
    if (monaco) {
      monacoRef.current = monaco;
      
      // Add Alt+Z word wrap toggle action
      editor.addAction({
        id: 'toggle-word-wrap',
        label: 'Toggle Word Wrap',
        keybindings: [
          monaco.KeyMod.Alt | monaco.KeyCode.KeyZ,
        ],
        run: function () {
          setWordWrapMode((prev) => prev === "on" ? "off" : "on");
        }
      });

      // Initial widget setup
      setTimeout(() => setupShowMoreWidgets(editor, monaco), 100);
    }
  };

  const abortFetch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleFetch = async () => {
    if (isLoading) return;
    const url = normalizeUrl(apiUrl);
    if (!url) {
      setApiError(apiUrl.trim() ? "That is not a valid http(s) URL." : "Enter a URL to fetch.");
      setFetchResult(null);
      return;
    }
    // Show what is actually requested: "api.x.com/a" becomes "https://api.x.com/a".
    if (url !== apiUrl.trim()) setApiUrl(url);

    const headers: Record<string, string> = {};
    try {
      const parsed = apiHeaders.trim() ? JSON.parse(apiHeaders) : {};
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      for (const [name, value] of Object.entries(parsed)) {
        if (value === undefined || value === null) continue;
        headers[name] = typeof value === "string" ? value : JSON.stringify(value);
      }
    } catch {
      setApiError('Headers must be a JSON object, e.g. { "Authorization": "Bearer <token>" }.');
      setFetchResult(null);
      return;
    }

    const hasHeader = (name: string) =>
      Object.keys(headers).some((h) => h.toLowerCase() === name.toLowerCase());
    let body: string | undefined;
    if (BODY_METHODS.includes(apiMethod) && apiBody.trim()) {
      body = apiBody;
      // A JSON body without a declared type would go out as text/plain, which most APIs reject.
      if (!hasHeader("Content-Type")) {
        try {
          JSON.parse(apiBody);
          headers["Content-Type"] = "application/json";
        } catch {
          headers["Content-Type"] = "text/plain;charset=UTF-8";
        }
      }
    }

    setIsLoading(true);
    setApiError("");
    setFetchResult(null);
    setFetchProgress({
      phase: "native-fetch",
      message: `Requesting ${url}...`,
      usingFallback: false,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const options: SmartFetchOptions = {
        method: apiMethod,
        headers,
        body,
        signal: controller.signal,
        proxies: proxyRoutesFromSettings(proxyServers, useDefaultProxy),
        onProgress: (p) => setFetchProgress(p),
      };

      const result = await smartJsonFetch(url, options);
      setFetchResult(result);

      if (result.success && result.data !== undefined) {
        if (
          appendData &&
          parsedData !== null &&
          typeof parsedData === "object" &&
          !Array.isArray(parsedData)
        ) {
          // Wait before merging, show modal
          setPendingMergeResult(result);
          setCustomMergeKey("");
          setMergeStrategy("url");
        } else {
          await executeMerge(result.data, appendData, null);
        }
      }
    } catch (e: any) {
      setFetchResult({
        success: false,
        data: null,
        rawText: "",
        source: null,
        phase: "initial",
        status: null,
        reason: e?.message || String(e),
        errorType: "generic",
        errorMessage: e?.message || "The request failed.",
      });
    } finally {
      setIsLoading(false);
      setFetchProgress(null);
      abortControllerRef.current = null;
    }
  };

  const executeMerge = async (
    dataToMerge: any,
    shouldAppend: boolean,
    targetKey: string | null,
  ) => {
    let dumpFn = (data: any) => JSON.stringify(data, null, 2);
    if (codeFormat === "yaml") {
      try {
        const yaml = (await import("js-yaml")).default;
        dumpFn = (data: any) => yaml.dump(data);
      } catch (e) {
        // fallback
      }
    }

    if (shouldAppend) {
      if (parsedData !== null) {
        let mergedData;
        if (
          targetKey &&
          typeof parsedData === "object" &&
          !Array.isArray(parsedData)
        ) {
          mergedData = { ...parsedData };

          if (conflictAction === "replace" || !(targetKey in mergedData)) {
            mergedData[targetKey] = dataToMerge;
          } else if (
            conflictAction === "deep-merge" &&
            typeof mergedData[targetKey] === "object" &&
            typeof dataToMerge === "object" &&
            !Array.isArray(mergedData[targetKey]) &&
            !Array.isArray(dataToMerge)
          ) {
            mergedData[targetKey] = {
              ...mergedData[targetKey],
              ...dataToMerge,
            };
          } else {
            // rename
            let counter = 2;
            let newKey = `${targetKey}_${counter}`;
            while (newKey in mergedData) {
              counter++;
              newKey = `${targetKey}_${counter}`;
            }
            mergedData[newKey] = dataToMerge;
          }
        } else if (Array.isArray(parsedData) && Array.isArray(dataToMerge)) {
          mergedData = [...parsedData, ...dataToMerge];
        } else if (Array.isArray(parsedData)) {
          mergedData = [...parsedData, dataToMerge];
        } else if (
          typeof parsedData === "object" &&
          !Array.isArray(parsedData) &&
          typeof dataToMerge === "object" &&
          !Array.isArray(dataToMerge)
        ) {
          mergedData = { ...parsedData, ...dataToMerge };
        } else {
          mergedData = [parsedData, dataToMerge];
        }
        setCode(dumpFn(mergedData));
      } else if (code.trim() !== "") {
        setCode(
          code +
          "\n" +
          (typeof dataToMerge === "string"
            ? dataToMerge
            : dumpFn(dataToMerge)),
        );
      } else {
        setCode(
          typeof dataToMerge === "string" ? dataToMerge : dumpFn(dataToMerge),
        );
      }
    } else {
      setCode(
        typeof dataToMerge === "string" ? dataToMerge : dumpFn(dataToMerge),
      );
    }

    setPendingMergeResult(null);
    setActiveTab("raw");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0d1117] sticky top-0 z-10">
        <div className="flex flex-1 overflow-x-auto scrollbar-none items-center">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === "explorer" ? "bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            title="File Explorer"
          >
            <FolderOpen size={14} />{" "}
            <span className="hidden sm:inline">Files</span>
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === "raw" ? "bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            title="Editor"
          >
            <Code size={14} /> <span className="hidden sm:inline">Editor</span>
          </button>
          <button
            onClick={() => setActiveTab("gui")}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === "gui" ? "bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            title="GUI Editor"
          >
            <SlidersHorizontal size={14} />{" "}
            <span className="hidden sm:inline">GUI Editor</span>
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === "api" ? "bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            title="Fetch API"
          >
            <Globe size={14} />{" "}
            <span className="hidden sm:inline">Fetch API</span>
          </button>
        </div>
        <div className="pr-4 flex items-center gap-2 sm:gap-3">
          <button
            id="editor-clear-button"
            onClick={() => {
              if (window.confirm("Are you sure you want to clear the editor contents?")) {
                clearCode();
                // Force monaco to update immediately if ref is available
                if (editorRef.current) {
                  editorRef.current.setValue("");
                }
              }
            }}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer px-1.5 py-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
            title="Clear direct editor contents"
          >
            Clear
          </button>
          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-800" />
          {error && (activeTab === "raw" || activeTab === "gui" || activeTab === "explorer") && (
            <span
              className="text-[10px] sm:text-xs text-red-400 bg-red-400/10 px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[120px] sm:max-w-[200px]"
              title={error}
            >
              {error}
            </span>
          )}
          {!error &&
            parsedData &&
            (activeTab === "raw" || activeTab === "gui" || activeTab === "explorer") && (
              <span className="text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-400/10 px-1.5 sm:px-2 border border-green-200 dark:border-green-400/20 py-0.5 rounded font-mono">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Valid </span>JSON/YAML
              </span>
            )}
        </div>
      </div>

      <div className="flex-1 w-full relative">
        {activeTab === "raw" && (
          <div className="h-full pt-2">
            <SafeEditor
              key="raw-editor"
              height="100%"
              defaultLanguage={codeFormat}
              language={codeFormat}
              value={maskedCode}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              beforeMount={(m) => {
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
                } catch {
                  // ignore
                }
              }}
              theme={appTheme === "dark" ? "customDark" : "customLight"}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                wordWrap: wordWrapMode,
                scrollBeyondLastLine: false,
                folding: true,
                lineNumbersMinChars: 3,
                formatOnPaste: true,
                padding: { top: 10, bottom: 10 },
                dragAndDrop: false,
                dropIntoEditor: { enabled: false },
              }}
            />
          </div>
        )}

        {activeTab === "explorer" && (
          <div className="absolute inset-0">
            <Suspense fallback={<div className="flex items-center justify-center p-8 h-full w-full"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
              <FileExplorerPanel />
            </Suspense>
          </div>
        )}

        {activeTab === "gui" && (
          <Suspense fallback={<div className="flex items-center justify-center p-8 h-full w-full"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
            <GuiEditorPanel />
          </Suspense>
        )}

        {activeTab === "api" && (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 text-slate-800 dark:text-slate-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Request URL
              </label>
              <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                <CustomSelect
                  value={apiMethod}
                  onChange={setApiMethod}
                  options={METHOD_OPTIONS}
                  variant="inline"
                  className="shrink-0 w-[116px] border-r border-blue-700 bg-blue-600 text-white font-mono"
                />
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFetch();
                    }
                  }}
                  placeholder="https://api.example.com/data"
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 bg-white dark:bg-[#0f172a] px-3 py-2 text-sm outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 h-32">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Headers (JSON)
              </label>
              <div className="flex-1 w-full border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-col relative z-0">
                <SafeEditor
                  key="api-headers-editor"
                  height="100%"
                  defaultLanguage="json"
                  value={apiHeaders}
                  onChange={(val) => setApiHeaders(val || "")}
                  beforeMount={(m) => {
                    try {
                      m.editor.defineTheme("customDark", {
                        base: "vs-dark", inherit: true, rules: [], colors: { "editor.background": "#0d1117", "editor.lineHighlightBackground": "#161b22" },
                      });
                      m.editor.defineTheme("customLight", {
                        base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff", "editor.lineHighlightBackground": "#f1f5f9" },
                      });
                    } catch { }
                  }}
                  theme={appTheme === "dark" ? "customDark" : "customLight"}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    folding: false,
                    lineNumbersMinChars: 2,
                    padding: { top: 8, bottom: 8 },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    scrollbar: { vertical: "hidden" },
                    renderLineHighlight: "none",
                  }}
                />
              </div>
            </div>

            {BODY_METHODS.includes(apiMethod) && (
              <div className="flex flex-col gap-1 h-40">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Body Request
                </label>
                <div className="flex-1 w-full border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-col relative z-0">
                  <SafeEditor
                    key="api-body-editor"
                    height="100%"
                    defaultLanguage="json"
                    value={apiBody}
                    onChange={(val) => setApiBody(val || "")}
                    beforeMount={(m) => {
                      try {
                        m.editor.defineTheme("customDark", {
                          base: "vs-dark", inherit: true, rules: [], colors: { "editor.background": "#0d1117", "editor.lineHighlightBackground": "#161b22" },
                        });
                        m.editor.defineTheme("customLight", {
                          base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff", "editor.lineHighlightBackground": "#f1f5f9" },
                        });
                      } catch { }
                    }}
                    theme={appTheme === "dark" ? "customDark" : "customLight"}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      folding: true,
                      lineNumbersMinChars: 2,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {isLoading && fetchProgress && (
                <div className="p-3.5 rounded-xl border border-blue-500/10 dark:border-blue-550/25 bg-blue-500/5 dark:bg-blue-950/15 flex flex-col gap-2.5 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <Loader2 size={15} className="text-blue-500 animate-spin" />
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {fetchProgress.usingFallback
                        ? "Retrying through a proxy..."
                        : fetchProgress.phase === "json-parse"
                          ? "Reading the response..."
                          : "Connecting..."}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    {fetchProgress.message}
                  </p>
                </div>
              )}

              {fetchResult && fetchResult.success && (
                <div className="text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 animate-in fade-in duration-200">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={13} />
                    {fetchResult.status} OK
                  </span>
                  {fetchResult.format && (
                    <span className="text-slate-600 dark:text-slate-400">
                      Loaded as {FORMAT_LABEL[fetchResult.format] || fetchResult.format}
                    </span>
                  )}
                  {fetchResult.contentType && (
                    <span className="font-mono text-slate-500 truncate max-w-[220px]" title={fetchResult.contentType}>
                      {fetchResult.contentType.split(";")[0]}
                    </span>
                  )}
                  <span className="text-slate-500">
                    {fetchResult.source === "fallback"
                      ? `via proxy ${fetchResult.proxy || ""}`.trim()
                      : "direct"}
                    {typeof fetchResult.durationMs === "number" ? ` · ${fetchResult.durationMs} ms` : ""}
                    {fetchResult.rawText ? ` · ${(new Blob([fetchResult.rawText]).size / 1024).toFixed(1)} KB` : ""}
                  </span>
                </div>
              )}

              {fetchResult && !fetchResult.success && (
                <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}>
                  <SmartFetchErrorUI result={fetchResult} onRetry={handleFetch} />
                </Suspense>
              )}

              {apiError && !fetchResult && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="mt-0.5 min-w-[14px]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <div>{apiError}</div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between mt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Merge with existing data
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Append fetched payload into the current editor state
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={appendData}
                  onClick={() => setAppendData(!appendData)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${appendData ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appendData ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    resetApiConfig();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-widest font-semibold transition-colors focus:outline-none"
                >
                  Reset Config
                </button>
                <div className="flex items-center gap-4">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={abortFetch}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      <Loader2 size={16} className="animate-spin" />
                      Cancel Request
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFetch}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      <Play size={16} />
                      Send Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Where fetched data goes when added to the current document */}
      {pendingMergeResult && (() => {
        const activeKey = getActiveMergeKey();
        return (
          <MergeConfigDialog
            data={pendingMergeResult.data}
            urlKey={generateUrlKey(apiUrl)}
            activeKey={activeKey}
            renamedKey={nextFreeKey(activeKey)}
            existing={checkCollision(activeKey) ? (parsedData as any)[activeKey] : undefined}
            hasCollision={checkCollision(activeKey)}
            strategy={mergeStrategy}
            onStrategyChange={setMergeStrategy}
            customKey={customMergeKey}
            onCustomKeyChange={setCustomMergeKey}
            conflictAction={conflictAction}
            onConflictActionChange={setConflictAction}
            onCancel={() => setPendingMergeResult(null)}
            onConfirm={() => executeMerge(pendingMergeResult.data, true, activeKey)}
          />
        );
      })()}

    </div>
  );
}
