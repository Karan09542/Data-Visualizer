import React, { useState } from "react";
import { AlertTriangle, Copy, Check, RotateCcw, Bug, Terminal, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

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
      setTimeout(() => setCopiedFull(false), 2200);
    }
  };

  const handleCopyMessage = async () => {
    const ok = await copyToClipboard(errorMessage);
    if (ok) {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0a0e17]/90 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#111827] border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-red-300 flex items-center gap-2">
                Application Error
              </h2>
              <p className="text-[11px] text-red-400/80 truncate">
                An unexpected error occurred in the component hierarchy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyFull}
            title="Copy full diagnostics error report"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${copiedFull
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
              }`}
          >
            {copiedFull ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedFull ? "Copied Report" : "Copy Report"}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          {/* Error Message Box */}
          <div className="relative group bg-[#0d1117] border border-red-500/20 rounded-xl p-3.5 shadow-inner">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/80 flex items-center gap-1.5">
                <Bug size={11} /> Error Message
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                title="Copy error message text"
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer"
              >
                {copiedMessage ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-mono text-red-300 leading-relaxed break-words whitespace-pre-wrap selection:bg-red-900/50">
              {errorMessage}
            </p>
          </div>

          {/* Stack Trace Collapsible */}
          {stackTrace && (
            <div className="border border-white/10 rounded-xl bg-[#0d1117]/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsStackOpen(!isStackOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal size={12} className="text-slate-400" />
                  <span>Stack Trace</span>
                </span>
                {isStackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isStackOpen && (
                <div className="px-3.5 pb-3 pt-1 border-t border-white/5 max-h-[160px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-700">
                    {stackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Component Stack Collapsible */}
          {componentStack && (
            <div className="border border-white/10 rounded-xl bg-[#0d1117]/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCompStackOpen(!isCompStackOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Bug size={12} className="text-slate-400" />
                  <span>Component Stack</span>
                </span>
                {isCompStackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isCompStackOpen && (
                <div className="px-3.5 pb-3 pt-1 border-t border-white/5 max-h-[140px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-700">
                    {componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-slate-900/40 flex items-center justify-end gap-2.5">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Try Recover</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyFull}
            className={`px-4 py-2 border text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${copiedFull
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
              }`}
          >
            {copiedFull ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span>Copied Error Details!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Error Details</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm shadow-red-500/20"
          >
            <RotateCcw size={13} />
            <span>Reload App</span>
          </button>
        </div>
      </div>
    </div>
  );
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
