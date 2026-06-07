import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { Terminal as TerminalIcon, Trash2, Copy, Check } from "lucide-react";
import { ExpandableJSON } from "./ExpandableJSON";
import { renderClickableErrorText } from "../utils/errorParser";
import { Virtuoso } from "react-virtuoso";
import { ErrorBoundary } from "./ErrorBoundary";
import { useExecutionLogs } from "../utils/useExecutionLogs";

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

interface TsNodeTerminalRendererProps {
  path: string; // The parent path
  width?: number;
  height?: number;
}

export function TsNodeTerminalRenderer({
  path,
  width,
  height,
}: TsNodeTerminalRendererProps) {
  const {
    jsNodeErrors,
    setJsNodeFocusLine,
    setCustomNodeSize,
  } = useStore();
  
  const { logCount, getLog, clearLogs, startOffset } = useExecutionLogs(path);
  const containerRef = useRef<HTMLDivElement>(null);

  const error = jsNodeErrors[path];

  useEffect(() => {
    if (containerRef.current) {
      const obs = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const target = entry.target as HTMLDivElement;
          const width = target.offsetWidth;
          const height = target.offsetHeight;
          if (width > 0 && height > 0) {
            window.requestAnimationFrame(() => {
              setCustomNodeSize(path + ".__ts_terminal", width, height);
            });
          }
        }
      });
      obs.observe(containerRef.current);
      return () => obs.disconnect();
    }
  }, [path, setCustomNodeSize]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col nodrag group resize overflow-hidden rounded-md bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 shadow-lg relative pointer-events-auto pb-[14px] pr-[14px]"
      style={{
        minHeight: "80px",
        minWidth: "200px",
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "100%",
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] overflow-hidden min-h-0 w-full rounded border-0 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] drag-handle cursor-move">
          <div className="flex items-center gap-1.5">
            <TerminalIcon size={12} className="text-slate-500" />
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              Logs
            </span>
          </div>
          {logCount > 0 && (
            <button
              onClick={clearLogs}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors"
              title="Clear Logs"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative p-0 min-h-0">
          {logCount === 0 && !error ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-600 italic text-[11px]">
              No terminal output.
            </div>
          ) : (
            <div className="font-mono text-[11px] h-full overflow-hidden custom-scrollbar">
              <ErrorBoundary fallback={<div className="p-3 text-red-500 italic text-[11px]">Error rendering terminal logs</div>}>
                <Virtuoso
                  totalCount={logCount + (error ? 1 : 0)}
                  firstItemIndex={startOffset}
                  className="h-full custom-scrollbar overflow-x-hidden w-full"
                  followOutput="auto"
                  itemContent={(index) => {
                    if (index === startOffset + logCount && error) {
                      return (
                        <div className="px-2 py-2 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex justify-between items-start gap-2 w-full group/err">
                          <div className="flex-1 min-w-0 font-bold whitespace-pre-wrap flex items-start gap-1.5 break-all">
                            <span className="shrink-0 mt-0.5 text-[9px]">✖</span>
                            <span>{renderClickableErrorText(error, path, setJsNodeFocusLine)}</span>
                          </div>
                          <div className="shrink-0 flex items-center">
                            <CopyButton text={error} />
                          </div>
                        </div>
                      );
                    }
                    
                    const log = getLog(index);
                    if (!log) {
                       return <div className="px-2 py-0 text-slate-400 italic">Loading...</div>;
                    }

                    return (
                      <div
                        className={`px-2 py-0.5 flex items-start gap-2 w-full group/log ${log.type === "error" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : log.type === "warn" ? "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start gap-1.5 w-full">
                            {log.args.map((arg: any, argIdx: number) =>
                              typeof arg === "string" ? (
                                <span
                                  key={argIdx}
                                  className="whitespace-pre-wrap break-all font-medium text-slate-800 dark:text-slate-300 leading-[1.2]"
                                >
                                  {arg}
                                </span>
                              ) : (
                                <ExpandableJSON
                                  key={argIdx}
                                  value={arg}
                                  defaultExpanded={log.type === "error"}
                                  level={0}
                                />
                              ),
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 self-start mt-0.5">
                          {log.type === "error" && (
                            <div className="opacity-0 group-hover/log:opacity-100 focus-within:opacity-100 transition-opacity">
                              <CopyButton text={log.args.map((arg: any) => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ")} />
                            </div>
                          )}
                          {log.pos && (
                            <div
                              onClick={() => setJsNodeFocusLine(path, log.pos.line)}
                              className="text-[9px] text-slate-400 hover:underline cursor-pointer select-none"
                            >
                              Ln {log.pos.line}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
