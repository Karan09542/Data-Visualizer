import React, { useState } from "react";
import katex from "katex";
import { Check, Copy } from "lucide-react";
import { calculate, type CalcNotation } from "../../lib/math/calculator";

const NOTATIONS: { id: CalcNotation; label: string; title: string }[] = [
  { id: "auto", label: "Auto", title: "Normal digits, switching to ×10ⁿ for very big or very small numbers" },
  { id: "normal", label: "123", title: "Always normal digits" },
  { id: "scientific", label: "×10ⁿ", title: "Always scientific notation" },
];

const DIGITS = [4, 6, 8, 12, 16, 32];

export const DEFAULT_CALC_DIGITS = 12;

interface CalculatorResultProps {
  expr: string;
  /** The graph's scope, so sliders and named values can be used. */
  scope: Record<string, any>;
  notation?: CalcNotation;
  digits?: number;
  onChange: (settings: { calcNotation?: CalcNotation; calcDigits?: number }) => void;
}

function Tex({ tex, className }: { tex: string; className?: string }) {
  let html = "";
  try {
    html = katex.renderToString(tex, { throwOnError: true, strict: "ignore", displayMode: false });
  } catch {
    return <span className={className}>{tex}</span>;
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * The answer under a calculator row, updated on every keystroke.
 */
export const CalculatorResult: React.FC<CalculatorResultProps> = ({
  expr,
  scope,
  notation = "auto",
  digits = DEFAULT_CALC_DIGITS,
  onChange,
}) => {
  const [copied, setCopied] = useState(false);
  const result = calculate(expr, scope, notation, digits);

  const copyText = result.kind === "number" ? result.primary.copy : result.kind === "text" ? result.copy : "";
  const copy = () => {
    if (!copyText) return;
    navigator.clipboard?.writeText(copyText).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };

  return (
    <div
      className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 px-3 py-2 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2 min-h-[28px]">
        <div className="flex-1 min-w-0 text-slate-800 dark:text-slate-100" aria-live="polite">
          {result.kind === "number" && (
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 text-base">=</span>
              {result.primary.notation === "normal" ? (
                // Long numbers wrap between digit groups instead of running off the panel.
                <span
                  className="text-[17px] leading-snug min-w-0 [overflow-wrap:anywhere]"
                  style={{ fontFamily: "KaTeX_Main, 'Times New Roman', serif" }}
                >
                  {result.primary.text.replace(/,/g, ",\u200b")}
                </span>
              ) : (
                <Tex tex={result.primary.tex} className="text-[17px] whitespace-nowrap [&_.katex]:text-[17px]" />
              )}
            </div>
          )}
          {result.kind === "text" && (
            <div className="flex items-baseline gap-1.5 overflow-x-auto custom-scrollbar">
              <span className="text-slate-400 dark:text-slate-500 text-base">=</span>
              <span className="font-mono text-[15px] break-all">{result.text}</span>
            </div>
          )}
          {result.kind === "error" && (
            <span className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">{result.message}</span>
          )}
          {result.kind === "empty" && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Type a calculation, e.g. 2^64, 6.022e23 * 3, 5 km to mi
            </span>
          )}
          {result.kind === "number" && result.alternate && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 [overflow-wrap:anywhere]">
              ={" "}
              {result.alternate.notation === "normal" ? (
                result.alternate.text.replace(/,/g, ",\u200b")
              ) : (
                <Tex tex={result.alternate.tex} className="whitespace-nowrap" />
              )}
            </div>
          )}
          {(result.kind === "number" || result.kind === "text") && result.approximate && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              Worked out in ordinary precision: the last digits may be rounded.
            </div>
          )}
        </div>
        {copyText && (
          <button
            type="button"
            onClick={copy}
            title="Copy the result"
            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div
          role="radiogroup"
          aria-label="Number format"
          className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80"
        >
          {NOTATIONS.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={notation === n.id}
              title={n.title}
              onClick={() => onChange({ calcNotation: n.id })}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                notation === n.id
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <select
            value={digits}
            onChange={(e) => onChange({ calcDigits: Number(e.target.value) })}
            className="bg-slate-100 dark:bg-slate-800/80 rounded px-1 py-0.5 text-[10px] outline-none cursor-pointer"
            title="Significant digits (whole numbers are always shown in full in 123 mode)"
          >
            {DIGITS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          significant digits
        </label>
      </div>
    </div>
  );
};
