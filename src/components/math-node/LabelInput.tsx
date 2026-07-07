import React, { useState, useRef, useEffect } from "react";
import katex from "katex";
import { useMathWorker } from "../../hooks/useMathWorker";

interface LabelInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export const LabelInput: React.FC<LabelInputProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [renderedLatex, setRenderedLatex] = useState<React.ReactNode>(null);
  const { expressionToLatex } = useMathWorker();

  // Compute LaTeX preview asynchronously when unfocused
  useEffect(() => {
    if (isFocused || !value.trim()) {
      setRenderedLatex(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let latexStr = value;

        // Try equation form first
        const eqIndex = value.indexOf("=");
        if (
          eqIndex !== -1 &&
          !value.includes("==") &&
          !value.includes(">=") &&
          !value.includes("<=") &&
          !value.includes("!=")
        ) {
          const lhs = value.slice(0, eqIndex).trim();
          const rhs = value.slice(eqIndex + 1).trim();
          if (lhs && rhs) {
            const [lhsRes, rhsRes] = await Promise.all([
              expressionToLatex(lhs),
              expressionToLatex(rhs),
            ]);
            if (!cancelled && lhsRes.latex && rhsRes.latex) {
              latexStr = `${lhsRes.latex} = ${rhsRes.latex}`;
            }
          }
        } else {
          const res = await expressionToLatex(value);
          if (!cancelled && res.latex) {
            latexStr = res.latex;
          }
        }

        if (cancelled) return;

        // Render with KaTeX
        try {
          const html = katex.renderToString(latexStr, {
            throwOnError: true,
            displayMode: false,
            strict: "ignore",
            trust: true,
          });
          if (!cancelled) {
            setRenderedLatex(
              <span dangerouslySetInnerHTML={{ __html: html }} />,
            );
          }
        } catch (e) {
          if (!cancelled) {
            setRenderedLatex(<span className="font-mono">{value}</span>);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setRenderedLatex(<span className="font-mono">{value}</span>);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, value, expressionToLatex]);

  return (
    <div
      className={`relative w-full rounded-md border transition-colors cursor-text min-h-[36px] overflow-hidden ${isFocused ? "bg-white dark:bg-slate-900 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]" : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}
      onClick={() => {
        if (!isFocused) setIsFocused(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }}
    >
      <div
        className={`relative w-full ${isFocused || !renderedLatex ? "block" : "hidden"}`}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent outline-none caret-blue-550 dark:caret-blue-400 font-mono text-xs px-2.5 py-1.5 resize-y text-slate-800 dark:text-slate-200 custom-scrollbar min-h-[36px] block"
          placeholder={isFocused ? placeholder : ""}
          spellCheck={false}
          autoComplete="off"
          rows={Math.min(4, Math.max(1, value.split("\n").length))}
        />
      </div>

      {!isFocused && renderedLatex && (
        <div className="w-full px-2.5 py-1.5 flex flex-wrap items-center overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="text-slate-800 dark:text-slate-200 text-[12px] [&_.katex]:text-[13px] [&_.katex-display]:m-0 min-w-min">
            {renderedLatex}
          </div>
        </div>
      )}
    </div>
  );
};
