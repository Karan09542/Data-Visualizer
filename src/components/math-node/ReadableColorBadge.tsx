import React, { useState } from "react";
import { Copy } from "lucide-react";

export const ReadableColorBadge = ({ color }: { color: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy color", err);
    }
  };

  return (
    <span
      onClick={handleCopy}
      className="group/hex relative inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer font-mono text-[10px] text-slate-700 dark:text-slate-300 font-semibold select-none transition-all hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-200 dark:hover:border-blue-800"
      title="Click to copy HEX color"
    >
      <span
        className="w-2.5 h-2.5 rounded-sm border border-slate-300 dark:border-slate-650 shrink-0 shadow-xs"
        style={{ backgroundColor: color }}
      />
      <span>{color}</span>
      <span className="inline-flex items-center opacity-0 group-hover/hex:opacity-100 transition-opacity">
        {copied ? (
          <span className="text-green-500 font-bold scale-110">✓</span>
        ) : (
          <Copy className="w-2.5 h-2.5 text-slate-400 group-hover/hex:text-blue-500 dark:group-hover/hex:text-blue-400" />
        )}
      </span>
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/hex:block bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none font-sans font-normal opacity-95">
        {copied ? "Copied!" : "Copy color"}
      </span>
    </span>
  );
};
