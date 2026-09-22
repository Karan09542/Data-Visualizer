import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Copy, Check, RotateCcw, Bug, Terminal, ChevronDown, ChevronRight, RefreshCw, Layers } from "lucide-react";

export interface AppErrorPopupProps {
  error: Error | any;
  errorInfo?: React.ErrorInfo | any;
  onReset?: () => void;
  onReload?: () => void;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false);
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text)
    );
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  }
}

export const AppErrorPopup: React.FC<AppErrorPopupProps> = ({
  error,
  errorInfo,
  onReset,
  onReload = () => window.location.reload(),
}) => {
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isStackOpen, setIsStackOpen] = useState(false);
  const [isCompStackOpen, setIsCompStackOpen] = useState(false);

  const errorMessage = error?.message || (typeof error === "string" ? error : "Unknown application error");
  const stackTrace = error?.stack || "";
  const componentStack = errorInfo?.componentStack || "";

  const buildFullReport = () => {
    return [
      `=== APPLICATION ERROR REPORT ===`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "N/A"}`,
      `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}`,
      ``,
      `Error Message:`,
      errorMessage,
      ``,
      `Stack Trace:`,
      stackTrace || "No stack trace available",
      ``,
      `Component Stack:`,
      componentStack || "No component stack available",
      `================================`,
    ].join("\n");
  };

  const handleCopyFull = async () => {
    const report = buildFullReport();
    const ok = await copyToClipboard(report);
    if (ok) {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    }
  };

  const handleCopyMessage = async () => {
    const ok = await copyToClipboard(errorMessage);
    if (ok) {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 1800);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div 
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-error-title"
        className="w-full max-w-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Subtle Top Error Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" />

        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-[#0d1117]/80 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="app-error-title" className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Application Error
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                An unexpected error occurred in the component hierarchy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyFull}
            title="Copy full diagnostics error report"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shrink-0 ${copiedFull
              ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm"
              }`}
          >
            {copiedFull ? <Check size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedFull ? "Copied Report" : "Copy Report"}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          {/* Error Message Box */}
          <div className="relative group bg-rose-50/50 dark:bg-[#0d1117] border border-rose-200/80 dark:border-rose-500/20 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-200/50 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Bug size={12} /> Error Message
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                title="Copy error message text"
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-100/50 dark:hover:bg-white/5 cursor-pointer"
              >
                {copiedMessage ? (
                  <>
                    <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-mono text-rose-900 dark:text-rose-300 leading-relaxed break-words whitespace-pre-wrap selection:bg-rose-200 dark:selection:bg-rose-950">
              {errorMessage}
            </p>
          </div>

          {/* Stack Trace Collapsible */}
          {stackTrace && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#0d1117]/50">
              <button
                type="button"
                onClick={() => setIsStackOpen(!isStackOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Terminal size={13} className="text-slate-400 dark:text-slate-500" />
                  <span>Stack Trace</span>
                </span>
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {stackTrace.split("\n").length} lines
                  </span>
                  {isStackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>
              {isStackOpen && (
                <div className="p-3 bg-[#0d1117] border-t border-slate-200 dark:border-white/5 max-h-[170px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-700">
                    {stackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Component Stack Collapsible */}
          {componentStack && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#0d1117]/50">
              <button
                type="button"
                onClick={() => setIsCompStackOpen(!isCompStackOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Layers size={13} className="text-slate-400 dark:text-slate-500" />
                  <span>Component Stack</span>
                </span>
                {isCompStackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isCompStackOpen && (
                <div className="p-3 bg-[#0d1117] border-t border-slate-200 dark:border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-700">
                    {componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#0d1117]/80 flex items-center justify-between gap-2.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
            You can copy the report to inspect or reload.
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RefreshCw size={13} />
                <span>Try Recover</span>
              </button>
            )}

            <button
              type="button"
              onClick={onReload}
              className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
            >
              <RotateCcw size={13} />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export interface GlobalErrorBoundaryProps {
  children?: React.ReactNode;
}

export interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | any;
  errorInfo: React.ErrorInfo | any;
}

export class GlobalErrorBoundary extends React.Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: any): Partial<GlobalErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("TOP LEVEL REACT ERROR:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorPopup
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

export default AppErrorPopup;
