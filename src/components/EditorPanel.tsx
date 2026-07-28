import { useStore } from "../store/useStore";
import SafeEditor from "./SafeEditor";
import { useEffect, useRef, useState, Suspense } from "react";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import {
  Play,
  Code,
  Loader2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  SlidersHorizontal,
  FolderOpen,
} from "lucide-react";
import {
  smartJsonFetch,
  SmartFetchOptions,
  SmartFetchResult,
} from "../utils/smartJsonFetch";

const SmartFetchErrorUI = lazyWithRetry(() => import("./SmartFetchErrorUI"), "SmartFetchErrorUI");
const GuiEditorPanel = lazyWithRetry(() => import("./GuiEditorPanel"), "GuiEditorPanel");
const FileExplorerPanel = lazyWithRetry(() => import("./FileExplorerPanel"), "FileExplorerPanel");

export default function EditorPanel() {
  const {
    code,
    setCode,
    clearCode,
    error,
    parsedData,
    appTheme,
    codeFormat,
    apiMethod,
    setApiMethod,
    apiUrl,
    setApiUrl,
    apiHeaders,
    setApiHeaders,
    apiBody,
    setApiBody,
    activeTab,
    setActiveTab,
    resetApiConfig,
    setIsEditorPanelOpen,
  } = useStore();
  const editorRef = useRef<any>(null);
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
      if (activeTab === "raw") {
        const { codeFormat, code, setCode } = useStore.getState();
        if (codeFormat === "json") {
          try {
            const parsed = JSON.parse(code);
            setCode(JSON.stringify(parsed, null, 2));
          } catch (e) {
            // Do not format if invalid
          }
        } else if (codeFormat === "yaml") {
          try {
            const yaml = (await import("js-yaml")).default;
            const parsed = yaml.load(code);
            if (typeof parsed === "object") {
              setCode(yaml.dump(parsed));
            }
          } catch (e) {
            // Do not format if invalid
          }
        }
      }
    };
    window.addEventListener("format-editor", handleFormat);
    return () => window.removeEventListener("format-editor", handleFormat);
  }, [activeTab]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const abortFetch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleFetch = async () => {
    if (!apiUrl) {
      setApiError("URL is required");
      setFetchResult(null);
      return;
    }

    if (apiUrl.startsWith("http://") || (apiUrl && !apiUrl.includes("://"))) {
      setApiError(
        "Secure Connection Required: To protect your data, only HTTPS sources are supported. Please use a secure (https://) URL.",
      );
      setFetchResult(null);
      return;
    }

    setIsLoading(true);
    setApiError("");
    setFetchResult(null);
    setFetchProgress({
      phase: "native-fetch",
      message: "Attempting to fetch directly from the source API...",
      usingFallback: false,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let headers = {};
      try {
        if (apiHeaders.trim()) {
          headers = JSON.parse(apiHeaders);
        }
      } catch (e) {
        throw new Error(
          "Invalid JSON in Headers: Please check that your headers use standard double-quoted JSON formatting.",
        );
      }

      const options: SmartFetchOptions = {
        method: apiMethod,
        headers,
        signal: controller.signal,
        onProgress: (p) => {
          setFetchProgress(p);
        },
      };

      if (apiMethod !== "GET" && apiMethod !== "HEAD" && apiBody.trim()) {
        options.body = apiBody;
      }

      const result = await smartJsonFetch(apiUrl, options);
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
      } else {
        setApiError(result.errorMessage);
      }
    } catch (e: any) {
      setApiError(e.message || "Fetch failed");
      setFetchResult({
        success: false,
        data: null,
        rawText: "",
        source: null,
        phase: "initial",
        status: null,
        reason: e.message,
        errorType: "generic",
        errorMessage: e.message || "Fetch failed",
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
            onClick={() => setIsEditorPanelOpen(false)}
            className="md:hidden flex shrink-0 items-center justify-center w-11 h-10 text-slate-500 border-r border-slate-300 dark:border-slate-800 hover:text-red-500 transition-colors bg-slate-100 dark:bg-slate-900/50"
            title="Close Editor"
          >
            <X size={18} />
          </button>
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
              value={code}
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
                wordWrap: "on",
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
                <select
                  value={apiMethod}
                  onChange={(e) => setApiMethod(e.target.value)}
                  className="bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium outline-none text-blue-600 dark:text-blue-400"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com/data"
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
                    } catch {}
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

            {["POST", "PUT", "PATCH"].includes(apiMethod) && (
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
                      } catch {}
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
                        ? "Securing Fallback Connection..."
                        : "Connecting..."}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    {fetchProgress.message}
                  </p>
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
                  <div>
                    {apiError}
                    <a
                      href="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 font-bold underline hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                    >
                      Learn more about secure connections
                    </a>
                  </div>
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

      {/* Merge Configuration Modal */}
      {pendingMergeResult && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Merge Configuration
              </h3>
              <button
                onClick={() => setPendingMergeResult(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target Key Strategy
                </label>

                <div className="flex flex-col gap-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mergeStrategy === "default" ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-500/30" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                  >
                    <input
                      type="radio"
                      name="mergeStrategy"
                      checked={mergeStrategy === "default"}
                      onChange={() => setMergeStrategy("default")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Default Key
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        "fetched_data"
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mergeStrategy === "url" ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-500/30" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                  >
                    <input
                      type="radio"
                      name="mergeStrategy"
                      checked={mergeStrategy === "url"}
                      onChange={() => setMergeStrategy("url")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Generate from URL
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        "{generateUrlKey(apiUrl)}"
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${mergeStrategy === "custom" ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-500/30" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="mergeStrategy"
                        checked={mergeStrategy === "custom"}
                        onChange={() => setMergeStrategy("custom")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Custom Key
                      </span>
                    </div>
                    {mergeStrategy === "custom" && (
                      <input
                        type="text"
                        value={customMergeKey}
                        onChange={(e) => setCustomMergeKey(e.target.value)}
                        placeholder="e.g. analytics_data"
                        className="mt-1 ml-7 bg-white dark:bg-[#0d1117] border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 font-mono"
                      />
                    )}
                  </label>
                </div>
              </div>

              {checkCollision(getActiveMergeKey()) && (
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                  <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-500">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        Key Collision Detected
                      </span>
                      <span className="text-xs mt-0.5">
                        The key "
                        <span className="font-mono font-bold">
                          {getActiveMergeKey()}
                        </span>
                        " already exists in your root structure. How would you
                        like to handle this?
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${conflictAction === "replace" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-500/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                    >
                      <input
                        type="radio"
                        name="conflictAction"
                        checked={conflictAction === "replace"}
                        onChange={() => setConflictAction("replace")}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Replace existing data
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${conflictAction === "rename" ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-500/30" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                    >
                      <input
                        type="radio"
                        name="conflictAction"
                        checked={conflictAction === "rename"}
                        onChange={() => setConflictAction("rename")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Auto-rename (e.g. {getActiveMergeKey()}_2)
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${conflictAction === "deep-merge" ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-500/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                    >
                      <input
                        type="radio"
                        name="conflictAction"
                        checked={conflictAction === "deep-merge"}
                        onChange={() => setConflictAction("deep-merge")}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Deep merge (objects only)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Live Preview
                </span>
                <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">
                    root.
                  </span>
                  <span
                    className={
                      checkCollision(getActiveMergeKey())
                        ? conflictAction === "replace"
                          ? "text-amber-600 dark:text-amber-400 font-bold"
                          : conflictAction === "rename"
                            ? "text-blue-600 dark:text-blue-400 font-bold"
                            : "text-indigo-600 dark:text-indigo-400 font-bold"
                        : "text-green-600 dark:text-green-400 font-bold"
                    }
                  >
                    {checkCollision(getActiveMergeKey()) &&
                    conflictAction === "rename"
                      ? `${getActiveMergeKey()}_2`
                      : getActiveMergeKey()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setPendingMergeResult(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  executeMerge(
                    pendingMergeResult.data,
                    true,
                    getActiveMergeKey(),
                  )
                }
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#161b22]"
              >
                <Check size={16} /> Merge Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
