import React, { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import SafeEditor from "./SafeEditor";
import {
  Play,
  Square,
  RotateCcw,
  Maximize2,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { executeTsNode, abortTsNode } from "../utils/tsExecutor";
import { ExpandableJSON } from "./ExpandableJSON";
import { Virtuoso } from "react-virtuoso";
import { useExecutionLogs } from "../utils/useExecutionLogs";
import { TerminalInputPrompt } from "./TerminalInputPrompt";

interface TsNodeRendererProps {
  path: string;
  code: string;
  width?: number;
  height?: number;
}

export function TsNodeRenderer({ path, code, width, height }: TsNodeRendererProps) {
  const {
    jsNodeResponses,
    jsNodeErrors,
    jsNodeLoading,
    jsNodeLogs,
    jsNodeVisibility,
    jsNodeCodeOverrides,
    jsNodeDurations,
    jsNodeLastRuns,
    toggleJsNodeVisibility,
    expandedJsNodeId,
    setExpandedJsNodeId,
    setJsNodeCodeOverride,
    updateNodeValue,
    setCustomNodeSize,
    appTheme,
  } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const isExpanded = expandedJsNodeId === path;
  const isLoading = jsNodeLoading[path];
  const error = jsNodeErrors[path];
  const hasData = jsNodeResponses[path] !== undefined;

  const isPromptActive = !!useStore(state => state.activePrompts[path]);
  const visibility = jsNodeVisibility[path] || { code: true, terminal: true };
  const activeCode = jsNodeCodeOverrides[path] ?? code;
  const { logCount, getLog, clearLogs, startOffset } = useExecutionLogs(path);

  const handleRun = () => {
    toggleJsNodeVisibility(path, "terminal", true);
    executeTsNode(path, activeCode);
  };

  const updateGlobalCode = useCallback(
    (newCode: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNodeValue(path, newCode);
      }, 1000);
    },
    [path, updateNodeValue],
  );

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setJsNodeCodeOverride(path, value);
      updateGlobalCode(value);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      const obs = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const target = entry.target as HTMLDivElement;
          const w = target.offsetWidth;
          const h = target.offsetHeight;
          if (w > 0 && h > 0) {
            window.requestAnimationFrame(() => {
              setCustomNodeSize(path, w, h);
            });
          }
        }
      });
      obs.observe(containerRef.current);
      return () => obs.disconnect();
    }
  }, [path, setCustomNodeSize]);

  // Compute footer metadata
  const responseData = jsNodeResponses[path];
  const duration = jsNodeDurations?.[path];
  const lastRun = jsNodeLastRuns?.[path];

  let responseTypeChar = "{}";
  let responseSummary = "No Output";
  let detailsText = "";
  if (responseData !== undefined) {
    if (responseData === null) {
      responseTypeChar = "∅";
      responseSummary = "null";
    } else if (Array.isArray(responseData)) {
      responseTypeChar = "[]";
      responseSummary = "Array";
      detailsText = `${responseData.length} items`;
    } else if (typeof responseData === "object") {
      responseTypeChar = "{}";
      responseSummary = "Object";
      const keys = Object.keys(responseData);
      detailsText = `${keys.length} keys`;
    } else {
      responseTypeChar = "A";
      responseSummary = "String";
      detailsText = `${String(responseData).length} chars`;
    }
  }

  const durationStr = duration !== undefined ? `${duration}ms` : "";
  const lastRunStr = lastRun !== undefined ? lastRun : "Idle";

  // Gradient border effect wrapping the main container
  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-[#3178C6]/40 via-[#1e2330] to-[#794bff]/40 shadow-2xl pointer-events-auto select-none group resize overflow-hidden nodrag"
      style={{
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "100%",
        minWidth: "360px",
        minHeight: "340px",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Only stop propagation if we are clicking on the resize handle
        // in bottom right corner (approximate 20x20 area)
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (rect.width - x < 24 && rect.height - y < 24) {
          e.stopPropagation();
        }
      }}
    >
      <div className="flex-1 flex flex-col w-full h-full bg-white dark:bg-[#0d1218] rounded-[14px] overflow-hidden text-slate-800 dark:text-slate-300">
        {/* Top Title Bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 drag-handle cursor-move">
          <div className="flex items-center gap-3">
            <span className="text-white font-mono text-sm font-semibold tracking-wide">
              {path.split(".").pop() || "use_ts_node"}
            </span>
            <span className="text-slate-500 font-mono text-xs uppercase tracking-wider font-semibold">
              {error ? "ERROR" : hasData ? "STRING" : "NODE"}
            </span>
          </div>
          <button className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
            <MoreVertical size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col px-5 pb-5 gap-4 overflow-y-auto custom-scrollbar">
          {/* Identity & Status */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-[42px] h-[42px] shrink-0 rounded-[10px] bg-[#3178C6] text-white font-bold flex items-center justify-center text-lg shadow-sm">
                TS
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold text-[15px] text-white truncate">
                  TS Transformer
                </span>
                <span className="text-xs text-slate-500 dark:text-[#8b949e] truncate mt-0.5">
                  Transform incoming typescript data
                </span>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#161b22] shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1c2128] transition-colors`}>
              <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-[#3178C6]" : error ? "bg-[#f85149]" : hasData ? "bg-[#3178C6]" : "bg-[#d29922]"}`} />
              <span className={`text-xs font-semibold ${isLoading ? "text-[#3178C6]" : error ? "text-red-500 dark:text-[#f85149]" : hasData ? "text-[#3fb950]" : "text-[#d29922]"}`}>
                {isLoading ? "Running" : error ? "Error" : hasData ? "Success" : "Idle"}
              </span>
              <ChevronDown size={14} className="text-slate-500 dark:text-[#8b949e]" />
            </div>
          </div>

          {/* Code Editor */}
          {visibility.code && (
            <div className="flex-1 min-h-[120px] relative border border-slate-200 dark:border-[#30363d] rounded-xl overflow-hidden bg-slate-50 dark:bg-[#0a0c10] shadow-inner group/editor flex flex-col shrink-0">
              <div className="absolute top-3 right-3 z-10 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                <button
                  onClick={() => setExpandedJsNodeId(path)}
                  className="p-1.5 rounded-md bg-slate-200 dark:bg-[#21262d] text-slate-500 dark:text-[#8b949e] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#30363d] shadow-sm transition-all"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="flex-1 w-full relative pt-2 pb-2">
                <SafeEditor
                  height="100%"
                  language="typescript"
                  theme={appTheme === "dark" ? "vs-dark" : "light"}
                  value={activeCode}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineHeight: 22,
                    lineNumbers: "on",
                    folding: false,
                    scrollbar: { vertical: "auto", horizontal: "auto" },
                    readOnly: false,
                    scrollBeyondLastLine: false,
                    padding: { top: 8, bottom: 8 },
                    renderLineHighlight: "none",
                    contextmenu: false,
                    fixedOverflowWidgets: false,
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-[#30363d]/50 shrink-0">
            <div className="flex items-center gap-5 pl-1">
              <button onClick={handleRun} disabled={isLoading} title="Run" className="text-[#3fb950] hover:text-[#56d364] transition-colors disabled:opacity-50 cursor-pointer">
                <Play fill="currentColor" size={20} />
              </button>
              <button onClick={() => abortTsNode(path)} disabled={!isLoading} title="Stop execution" className="text-slate-500 dark:text-[#8b949e] hover:text-slate-700 dark:hover:text-[#c9d1d9] transition-colors disabled:opacity-50 cursor-pointer">
                <Square fill="currentColor" size={18} />
              </button>
              <button onClick={handleRun} title="Re-run" className="text-slate-500 dark:text-[#8b949e] hover:text-slate-700 dark:hover:text-[#c9d1d9] transition-colors cursor-pointer">
                <RotateCcw size={18} />
              </button>
              <div className="w-px h-5 bg-slate-300 dark:bg-[#30363d]" />
              <button onClick={() => toggleJsNodeVisibility(path, "terminal")} className={`font-mono font-bold text-[17px] leading-none transition-colors cursor-pointer ${visibility.terminal ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-[#8b949e] hover:text-slate-700 dark:hover:text-[#c9d1d9]"}`}>
                &gt;_
              </button>
            </div>
          </div>

          {/* Terminal Output */}
          {visibility.terminal && (
            <div className="flex flex-col min-h-[120px] bg-slate-50 dark:bg-[#0a0c10] border border-slate-200 dark:border-[#30363d] rounded-xl overflow-hidden shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-[#30363d] text-slate-500 dark:text-[#8b949e]">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#3178C6] font-bold">$</span>
                  <span>ts-node execution started</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={clearLogs} className="p-1 hover:text-slate-700 dark:hover:text-[#c9d1d9] transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => toggleJsNodeVisibility(path, "terminal")} className="p-1 hover:text-slate-700 dark:hover:text-[#c9d1d9] transition-colors cursor-pointer">
                    <ChevronUp size={16} />
                  </button>
                </div>
              </div>
              
              <div className={`p-3 font-mono text-[12px] text-slate-800 dark:text-[#e6edf3] flex flex-col gap-2 ${isPromptActive ? "h-[300px]" : "h-[160px]"} transition-all duration-200`}>
                <div className="flex-1 min-h-0 relative">
                  {logCount === 0 && !error ? (
                    <div className="text-slate-500 dark:text-[#8b949e] italic overflow-y-auto h-full max-h-full custom-scrollbar">Ready...</div>
                  ) : (
                    <Virtuoso
                      totalCount={logCount + (error ? 1 : 0)}
                      firstItemIndex={startOffset}
                      className="h-full w-full custom-scrollbar overflow-x-hidden"
                      followOutput="auto"
                      itemContent={(index) => {
                        if (index === logCount && error) {
                          return (
                            <div className="text-red-500 dark:text-[#f85149] mt-2 flex gap-1.5 border-l-2 border-red-500 dark:border-[#f85149] pl-2 w-full whitespace-pre-wrap break-all">
                               <span className="shrink-0">&gt;</span>
                               <span className="break-all">{error}</span>
                            </div>
                          );
                        }
                        const log = getLog(index);
                        if (!log) return <div className="text-slate-500 dark:text-[#8b949e]">...</div>;
                        return (
                          <div className="flex flex-col mb-1.5 w-full">
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-500 dark:text-[#8b949e] shrink-0">&gt;</span>
                              <div className="flex-1 whitespace-pre-wrap break-all">
                                {log.args.map((a: any, idx: number) => (
                                  <span key={idx} className="mr-1 whitespace-pre-wrap break-all">
                                    {typeof a === 'string' ? (
                                       <span className={`${a.includes('Output') ? "text-[#58a6ff] font-semibold" : ""} whitespace-pre-wrap break-all`}>{a}</span>
                                    ) : (
                                       <span className="text-[#d2a8ff] whitespace-pre-wrap break-all">{JSON.stringify(a)}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-[#8b949e]">&gt;</span>
                    <div className="w-1.5 h-3 bg-[#e6edf3] animate-pulse" />
                  </div>
                  <TerminalInputPrompt path={path} />
                </div>
              </div>
            </div>
          )}

          {/* Footer Summary */}
          <div className="flex items-center justify-between px-1 py-1 text-xs font-mono shrink-0 mt-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[#3178C6] font-bold text-sm tracking-widest">{responseTypeChar}</span>
                <span className="text-slate-800 dark:text-[#e6edf3] font-semibold">{responseSummary}</span>
                {detailsText && <span className="text-slate-500 dark:text-[#8b949e] ml-1">{detailsText}</span>}
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-500 dark:text-[#8b949e]">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>{durationStr || "0ms"}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-[#30363d] pl-4">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                 <span>{lastRunStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
