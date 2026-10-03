import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code2, Copy, Link2, Maximize2, X } from "lucide-react";
import { detectBaseUrl, prepareHtml, type HtmlOutput } from "../../utils/htmlOutputs";

interface HtmlPreviewProps {
  outputs: HtmlOutput[];
}

const btn =
  "py-1 px-1.5 text-[11px] font-medium rounded-[4px] flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shrink-0 outline-none";
const btnOff = "text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)]";
const btnOn = "text-[var(--vsc-accent)] bg-[var(--vsc-hover)]";

const outputLabel = (output: HtmlOutput, n: number) => {
  if (output.source === "result") return `#${n} · Return value`;
  const time = output.time ? new Date(output.time) : null;
  const at = time && !isNaN(time.getTime()) ? time.toLocaleTimeString() : output.time || "";
  return `#${n} · Console${at ? ` · ${at}` : ""}`;
};

/**
 * Renders HTML a run printed. The page is sandboxed: it never gets the app's origin, so even with
 * scripts on it cannot read the app's storage or reach into the editor. Scripts are off until
 * asked for, and links open in a new tab.
 */
export function HtmlPreview({ outputs }: HtmlPreviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scripts, setScripts] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // The newest output unless another was picked (and still exists).
  const current = outputs.find((o) => o.id === selectedId) ?? outputs[outputs.length - 1];
  const currentIndex = current ? outputs.indexOf(current) : -1;

  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => {
    setBaseUrl(current ? detectBaseUrl(current.html) : "");
  }, [current?.id, current?.html]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const srcDoc = useMemo(() => (current ? prepareHtml(current.html, baseUrl) : ""), [current, baseUrl]);
  // Never allow-same-origin: together with allow-scripts it would let the page out of the sandbox.
  const sandbox = ["allow-popups", "allow-popups-to-escape-sandbox", ...(scripts ? ["allow-scripts", "allow-forms", "allow-modals"] : [])].join(" ");

  if (!current) return null;

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(current.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused: nothing to do.
    }
  };

  const toolbar = (inFullscreen: boolean) => (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 shrink-0 flex-wrap border-b ${inFullscreen
        ? "bg-[#1f1f1f] border-[#333] text-[#ccc]"
        : "bg-[var(--vsc-panel)] border-[var(--vsc-border)] text-[var(--vsc-fg)]"
        }`}
    >
      {outputs.length > 1 && (
        <select
          value={current.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-transparent border border-[var(--vsc-border)] rounded px-1 py-0.5 text-[11px] font-mono outline-none max-w-[220px] cursor-pointer"
          title="Which HTML output to show"
        >
          {outputs.map((o, i) => (
            <option key={o.id} value={o.id} className="text-black">
              {outputLabel(o, i + 1)}
            </option>
          ))}
        </select>
      )}
      {outputs.length === 1 && (
        <span className="text-[11px] text-[var(--vsc-fg-muted)] font-mono whitespace-nowrap">
          {outputLabel(current, currentIndex + 1)}
        </span>
      )}

      <label
        className="flex items-center gap-1 flex-1 min-w-[140px] max-w-[420px] border border-[var(--vsc-border)] rounded px-1.5 py-0.5"
        title="Relative links and images load from this address"
      >
        <Link2 size={12} className="shrink-0 opacity-60" />
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value.trim())}
          placeholder="Base URL for relative links (https://…)"
          className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono placeholder-[var(--vsc-fg-muted)]"
          spellCheck={false}
        />
      </label>

      <div className="flex items-center gap-0.5 ml-auto">
        <button
          onClick={() => setScripts((s) => !s)}
          className={`${btn} ${scripts ? btnOn : btnOff}`}
          title={scripts ? "Scripts run (sandboxed, without access to this app)" : "Scripts are off - click to run them"}
        >
          <Code2 size={13} />
          <span className="hidden sm:inline">{scripts ? "Scripts on" : "Scripts off"}</span>
        </button>
        <button onClick={copyHtml} className={`${btn} ${copied ? "text-emerald-500" : btnOff}`} title="Copy the HTML">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy HTML"}</span>
        </button>
        {inFullscreen ? (
          <button onClick={() => setFullscreen(false)} className={`${btn} ${btnOff}`} title="Exit full screen (Esc)">
            <X size={14} />
            <span className="hidden sm:inline">Close</span>
          </button>
        ) : (
          <button onClick={() => setFullscreen(true)} className={`${btn} ${btnOff}`} title="Full screen">
            <Maximize2 size={13} />
            <span className="hidden sm:inline">Full screen</span>
          </button>
        )}
      </div>
    </div>
  );

  // A changed sandbox only applies to a fresh frame.
  const frame = (
    <iframe
      key={`${current.id}-${scripts}`}
      title="HTML preview"
      srcDoc={srcDoc}
      sandbox={sandbox}
      referrerPolicy="no-referrer"
      className="flex-1 w-full min-h-0 border-0 bg-white"
    />
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      {toolbar(false)}
      {fullscreen ? (
        <div className="flex-1 flex items-center justify-center text-[var(--vsc-fg-muted)] italic text-sm">
          Showing in full screen.
        </div>
      ) : (
        frame
      )}
      {fullscreen &&
        createPortal(
          <div className="fixed inset-0 z-[2147483000] flex flex-col bg-[#1f1f1f]" role="dialog" aria-label="HTML preview">
            {toolbar(true)}
            {frame}
          </div>,
          document.body,
        )}
    </div>
  );
}
