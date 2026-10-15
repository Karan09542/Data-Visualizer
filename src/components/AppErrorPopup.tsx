import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Bug,
  Terminal,
  Layers,
  Monitor,
  RefreshCw,
  X,
  Smartphone,
  Globe,
  Clock,
} from "lucide-react";

export interface AppErrorPopupProps {
  error: Error | any;
  errorInfo?: React.ErrorInfo | any;
  onReset?: () => void;
  onReload?: () => void;
  onClose?: () => void;
}

/**
 * Bulletproof clipboard copy utility supporting:
 * - Modern navigator.clipboard.writeText
 * - iOS Safari selection range (createRange + selectNodeContents)
 * - Android & mobile webview virtual keyboard prevention
 * - Non-secure contexts and iframe execution
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API first
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // 2. Cross-browser fallback using hidden textarea
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.width = "2em";
    textarea.style.height = "2em";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    textarea.style.fontSize = "16px"; // Prevents iOS Safari automatic zoom on focus
    textarea.style.opacity = "0.01";
    textarea.style.zIndex = "-9999";
    document.body.appendChild(textarea);

    // iOS Safari selection quirk
    if (typeof navigator !== "undefined" && navigator.userAgent.match(/ipad|ipod|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, 999999);
    } else {
      textarea.focus();
      textarea.select();
    }

    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (success) return true;
  } catch (err) {
    console.warn("Fallback copy failed:", err);
  }

  return false;
}

type TabType = "message" | "stack" | "component" | "env";

export const AppErrorPopup: React.FC<AppErrorPopupProps> = ({
  error,
  errorInfo,
  onReset,
  onReload = () => window.location.reload(),
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("message");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const errorMessage = error?.message || (typeof error === "string" ? error : "Unknown application error");
  const stackTrace = error?.stack || "";
  const componentStack = errorInfo?.componentStack || "";

  const systemInfo = {
    timestamp: new Date().toLocaleString(),
    url: typeof window !== "undefined" ? window.location.href : "N/A",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
    screen:
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight} (devicePixelRatio: ${window.devicePixelRatio || 1})`
        : "N/A",
  };

  const buildFullReport = () => {
    return [
      `================ APPLICATION ERROR REPORT ================\n`,
      `Time: ${systemInfo.timestamp}`,
      `URL: ${systemInfo.url}`,
      `Screen: ${systemInfo.screen}`,
      `User Agent: ${systemInfo.userAgent}`,
      `\n------------------- ERROR MESSAGE -------------------`,
      errorMessage,
      `\n------------------- STACK TRACE ---------------------`,
      stackTrace || "No stack trace available",
      `\n----------------- COMPONENT STACK -------------------`,
      componentStack || "No component stack available",
      `\n==========================================================`,
    ].join("\n");
  };

  const handleCopy = async (key: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-error-title"
        className="w-full max-w-2xl bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200 animate-in zoom-in-95 duration-150"
      >
        {/* Subtle Top Accent */}
        <div className="h-0.5 w-full bg-rose-500" />

        {/* Flat Modern Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-[#111622] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="app-error-title" className="text-sm font-semibold text-slate-100 truncate">
                  Application Error
                </h2>
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  Crash Handled
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                An unexpected exception was caught in the component hierarchy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Copy Error Button */}
            <button
              type="button"
              onClick={() => handleCopy("quick", errorMessage)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${copiedKey === "quick"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200"
                }`}
              title="Quick copy error message"
            >
              {copiedKey === "quick" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedKey === "quick" ? "Copied" : "Copy Error"}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                title="Dismiss dialog"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Flat Modern Tab Bar */}
        <div className="flex items-center gap-1 px-4 sm:px-5 pt-3 pb-2 bg-[#0c1017] border-b border-slate-800/80 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("message")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${activeTab === "message"
                ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
          >
            <Bug size={13} className={activeTab === "message" ? "text-rose-400" : "text-slate-500"} />
            <span>Message</span>
          </button>

          {stackTrace && (
            <button
              type="button"
              onClick={() => setActiveTab("stack")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${activeTab === "stack"
                  ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
            >
              <Terminal size={13} className={activeTab === "stack" ? "text-cyan-400" : "text-slate-500"} />
              <span>Stack Trace</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300">
                {stackTrace.split("\n").length}
              </span>
            </button>
          )}

          {componentStack && (
            <button
              type="button"
              onClick={() => setActiveTab("component")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${activeTab === "component"
                  ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
            >
              <Layers size={13} className={activeTab === "component" ? "text-indigo-400" : "text-slate-500"} />
              <span>Component Tree</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("env")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${activeTab === "env"
                ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
          >
            <Monitor size={13} className={activeTab === "env" ? "text-amber-400" : "text-slate-500"} />
            <span>Environment</span>
          </button>
        </div>

        {/* Content Body Area */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 select-text">
          {activeTab === "message" && (
            <div className="space-y-3">
              <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 text-xs text-slate-400 select-none">
                  <span className="font-semibold text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Error Description
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("tab-msg", errorMessage)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 transition-colors cursor-pointer"
                  >
                    {copiedKey === "tab-msg" ? (
                      <>
                        <Check size={11} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-xs sm:text-[13px] font-mono text-rose-300 leading-relaxed break-words whitespace-pre-wrap selection:bg-rose-950/70">
                  {errorMessage}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-2 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>You can copy this error or inspect the call stack before choosing to reload or recover.</span>
              </div>
            </div>
          )}

          {activeTab === "stack" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 select-none">
                <span className="text-[11px] text-slate-400">Call stack frames:</span>
                <button
                  type="button"
                  onClick={() => handleCopy("tab-stack", stackTrace)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  {copiedKey === "tab-stack" ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy Stack</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-800">
                  {stackTrace || "No stack trace recorded."}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "component" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 select-none">
                <span className="text-[11px] text-slate-400">React component hierarchy at crash:</span>
                <button
                  type="button"
                  onClick={() => handleCopy("tab-comp", componentStack)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 transition-colors cursor-pointer"
                >
                  {copiedKey === "tab-comp" ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy Tree</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words selection:bg-slate-800">
                  {componentStack || "No component stack recorded."}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "env" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-500" /> Timestamp
                  </span>
                  <span className="text-xs font-mono text-slate-200">{systemInfo.timestamp}</span>
                </div>

                <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone size={12} className="text-slate-500" /> Viewport & Scale
                  </span>
                  <span className="text-xs font-mono text-slate-200">{systemInfo.screen}</span>
                </div>
              </div>

              <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={12} className="text-slate-500" /> Current URL
                </span>
                <span className="text-xs font-mono text-slate-200 break-all select-all">{systemInfo.url}</span>
              </div>

              <div className="bg-[#070a10] border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <Monitor size={12} className="text-slate-500" /> User Agent
                </span>
                <span className="text-xs font-mono text-slate-300 break-words leading-relaxed select-all">
                  {systemInfo.userAgent}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Flat Modern Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#111622] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => handleCopy("full", buildFullReport())}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer w-full sm:w-auto justify-center ${copiedKey === "full"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200"
              }`}
          >
            {copiedKey === "full" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedKey === "full" ? "Copied Diagnostics Report" : "Copy Full Report"}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} />
                <span>Try Recover</span>
              </button>
            )}

            <button
              type="button"
              onClick={onReload}
              className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
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

/**
 * Renders a lightweight, flat, modern error card for window.onerror and unhandledrejections,
 * with reliable copy-to-clipboard functionality and collapsible stack trace.
 */
export function showGlobalErrorCard(options: {
  title?: string;
  message: string;
  location?: string;
  stack?: string;
  duration?: number;
}) {
  if (typeof document === "undefined") return;

  // Remove existing toast if any
  const existing = document.getElementById("global-error-card-toast");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "global-error-card-toast";
  container.className =
    "fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-[480px] z-[999999] font-sans transition-all duration-200";

  const card = document.createElement("div");
  card.className =
    "bg-[#0e1320] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200";

  // Flat accent strip
  const accent = document.createElement("div");
  accent.className = "h-0.5 w-full bg-rose-500";
  card.appendChild(accent);

  // Header
  const header = document.createElement("div");
  header.className =
    "px-4 py-3 bg-[#111624] border-b border-slate-800/80 flex items-center justify-between gap-2.5";

  const titleWrap = document.createElement("div");
  titleWrap.className = "flex items-center gap-2.5 min-w-0";

  const iconWrap = document.createElement("div");
  iconWrap.className =
    "w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0";
  iconWrap.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  const titleText = document.createElement("div");
  titleText.className = "min-w-0";
  titleText.innerHTML = `<span class="text-xs font-semibold text-slate-100">${options.title || "Application Error"}</span>`;

  titleWrap.appendChild(iconWrap);
  titleWrap.appendChild(titleText);

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1.5 shrink-0";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className =
    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer";
  copyBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> <span>Copy Error</span>';

  copyBtn.onclick = async () => {
    const fullText = [
      options.message,
      options.location ? `Location: ${options.location}` : "",
      options.stack ? `\n${options.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const ok = await copyToClipboard(fullText);
    if (ok) {
      copyBtn.className =
        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 transition-colors cursor-pointer";
      copyBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> <span>Copied!</span>';
      setTimeout(() => {
        copyBtn.className =
          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer";
        copyBtn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> <span>Copy Error</span>';
      }, 2000);
    }
  };

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className =
    "p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer";
  closeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  closeBtn.onclick = () => container.remove();

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);

  header.appendChild(titleWrap);
  header.appendChild(actions);
  card.appendChild(header);

  // Content body
  const body = document.createElement("div");
  body.className = "p-3.5 space-y-2.5 select-text";

  const msgBox = document.createElement("div");
  msgBox.className =
    "bg-[#070a10] border border-slate-800/80 rounded-xl p-3 font-mono text-xs text-rose-300 leading-relaxed whitespace-pre-wrap break-words max-h-[160px] overflow-y-auto";
  msgBox.textContent = options.message;
  body.appendChild(msgBox);

  if (options.location) {
    const locBox = document.createElement("div");
    locBox.className = "text-[11px] font-mono text-slate-400 truncate";
    locBox.textContent = `Location: ${options.location}`;
    body.appendChild(locBox);
  }

  if (options.stack) {
    const stackToggle = document.createElement("details");
    stackToggle.className =
      "border border-slate-800 rounded-lg overflow-hidden text-xs bg-[#070a10]/50 select-none";

    const summary = document.createElement("summary");
    summary.className =
      "px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer transition-colors";
    summary.textContent = "View Stack Trace";

    const stackContent = document.createElement("pre");
    stackContent.className =
      "p-2.5 border-t border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-[140px] overflow-y-auto select-text";
    stackContent.textContent = options.stack;

    stackToggle.appendChild(summary);
    stackToggle.appendChild(stackContent);
    body.appendChild(stackToggle);
  }

  card.appendChild(body);
  container.appendChild(card);
  document.body.appendChild(container);

  if (options.duration !== 0) {
    const timeout = setTimeout(() => {
      if (document.body.contains(container)) container.remove();
    }, options.duration || 15000);

    container.onmouseenter = () => clearTimeout(timeout);
  }
}

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
