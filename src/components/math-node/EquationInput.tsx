import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import katex from "katex";
import { Calculator } from "lucide-react";

import { useStore } from "../../store/useStore";
import { MATH_COMPLETIONS, getVarColor } from "./mathTypes";
import { useMathWorker } from "../../hooks/useMathWorker";
import { MathKeyboard } from "../MathKeyboard";
import { CaretOverlay } from "../math-input/components/CaretOverlay";

const MARKDOWN_REMARK_PLUGINS = [remarkMath, remarkGfm];
const MARKDOWN_REHYPE_PLUGINS = [rehypeKatex];

interface EquationInputProps {
  value: string;
  onChange: (v: string) => void;
  variables: any[];
  hoveredVar?: string | null;
  error?: string;
  warning?: string;
  onAddEnter?: () => void;
  onBlur?: () => void;
  globalTime?: number;
  forceEditMode?: boolean;
  showKeyboard?: boolean;
  onToggleKeyboard?: () => void;
  onCloseKeyboard?: () => void;
}

const EquationInputBase: React.FC<EquationInputProps> = ({
  value,
  onChange,
  variables,
  hoveredVar,
  error,
  warning,
  onAddEnter,
  onBlur,
  globalTime = 1,
  forceEditMode = false,
  showKeyboard = false,
  onToggleKeyboard,
  onCloseKeyboard,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selIndex, setSelIndex] = useState(0);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const [latexResult, setLatexResult] = useState<{ latex?: string; evalResult?: string }>({});
  const [isComputingLatex, setIsComputingLatex] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appTheme = useStore((state) => state.appTheme);
  const { expressionToLatexWithEval } = useMathWorker();

  const effectiveMode = showKeyboard ? "virtual" : "native";

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [effectiveMode, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      setSuggestions([]);
      return;
    }
    const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
    if (match) {
      const search = match[0].toLowerCase();
      const dynamicCompletions = [
        ...MATH_COMPLETIONS,
        ...variables.map((v: any) => ({
          name: v.name,
          desc: v.displayName || `Variable ${v.name}`,
          insert: v.name,
        })),
        { name: "theta", desc: "Polar angle", insert: "theta" },
      ];

      const filtered = dynamicCompletions.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.desc.toLowerCase().includes(search),
      );

      const sorted = [...filtered].sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(search);
        const bStarts = b.name.toLowerCase().startsWith(search);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });

      setSuggestions(sorted.slice(0, 8));
      setSelIndex(0);
    } else {
      setSuggestions([]);
    }
    if (containerRef.current) {
      setInputRect(containerRef.current.getBoundingClientRect());
    }
  }, [value, cursorPos, isFocused, variables]);

  useEffect(() => {
    if (isFocused || forceEditMode || error || !value.trim()) {
      setLatexResult({});
      setIsComputingLatex(false);
      return;
    }

    let cancelled = false;
    let timeoutId: any;
    let safetyTimeoutId: any;

    const computeLatex = async () => {
      const coloredVars: Record<string, string> = {};
      variables.forEach((v) => {
        coloredVars[v.name] = getVarColor(v.name);
      });
      coloredVars["x"] = "#10b981";
      coloredVars["y"] = "#3b82f6";
      coloredVars["t"] = "#8b5cf6";
      coloredVars["time"] = "#8b5cf6";
      coloredVars["theta"] = "#f59e0b";

      const scope: Record<string, any> = {};
      variables.forEach((v) => {
        scope[v.name] = v.value;
      });
      scope.x = 1;
      scope.y = 1;
      scope.t = globalTime;
      scope.time = globalTime;
      scope.theta = 1;

      try {
        const result = await expressionToLatexWithEval(value, coloredVars, scope);
        if (!cancelled) {
          setLatexResult({ latex: result.latex, evalResult: result.evalResult });
          setIsComputingLatex(false);
          clearTimeout(safetyTimeoutId);
        }
      } catch (e) {
        if (!cancelled) {
          setLatexResult({});
          setIsComputingLatex(false);
          clearTimeout(safetyTimeoutId);
        }
      }
    };

    timeoutId = setTimeout(() => {
      if (!cancelled) {
        setIsComputingLatex(true);
        computeLatex();
        // Add a safety timeout to avoid permanent skeleton if worker hangs
        safetyTimeoutId = setTimeout(() => {
          if (!cancelled) {
            setIsComputingLatex(false);
          }
        }, 1500);
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(safetyTimeoutId);
    };
  }, [value, isFocused, forceEditMode, error, variables, expressionToLatexWithEval]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>,
  ) => {
    const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
    const search = match ? match[0].toLowerCase() : "";

    const dynamicCompletions = [
      ...MATH_COMPLETIONS,
      ...variables.map((v: any) => ({
        name: v.name,
        desc: v.displayName || `Variable ${v.name}`,
        insert: v.name,
      })),
      { name: "theta", desc: "Polar angle", insert: "theta" },
    ];

    const filtered = dynamicCompletions.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.desc.toLowerCase().includes(search),
    );

    const sortedCompletions = [...filtered]
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(search);
        const bStarts = b.name.toLowerCase().startsWith(search);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);

    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      setSuggestions(sortedCompletions);
      setSelIndex(0);
      return;
    }

    if (suggestions.length > 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelIndex((i) => (i + 1) % suggestions.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const match = value.slice(0, cursorPos).match(/[a-zA-Z_]\w*$/);
        const before = match
          ? value.slice(0, cursorPos - match[0].length)
          : value.slice(0, cursorPos);
        const after = value.slice(cursorPos);
        const s = suggestions[selIndex];
        onChange(before + s.insert + after);
        setSuggestions([]);
        setTimeout(() => {
          if (inputRef.current) {
            const newPos = before.length + s.insert.length;
            inputRef.current.selectionStart = newPos;
            inputRef.current.selectionEnd = newPos;
            setCursorPos(newPos);
          }
        }, 0);
      }
    } else if (e.key === "Enter" && !e.shiftKey && onAddEnter) {
      e.preventDefault();
      onAddEnter();
    }
  };

  const handleKeyboardInsert = (
    insertStr: string,
    isTemplate: boolean = false,
  ) => {
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    let newExpr = before + insertStr + after;
    let newPos = cursorPos + insertStr.length;

    if (isTemplate) {
      const parenIndex = insertStr.indexOf("(");
      if (parenIndex !== -1) {
        newPos = cursorPos + parenIndex + 1;
      }
    }

    onChange(newExpr);
    setCursorPos(newPos);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = newPos;
        inputRef.current.selectionEnd = newPos;
      }
    }, 0);
  };

  const handleKeyboardDelete = () => {
    if (cursorPos > 0) {
      const before = value.slice(0, cursorPos - 1);
      const after = value.slice(cursorPos);
      onChange(before + after);
      const newPos = cursorPos - 1;
      setCursorPos(newPos);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.selectionStart = newPos;
          inputRef.current.selectionEnd = newPos;
        }
      }, 0);
    }
  };

  const handleKeyboardMoveCursor = (dir: "left" | "right") => {
    let newPos = cursorPos;
    if (dir === "left" && cursorPos > 0) newPos--;
    if (dir === "right" && cursorPos < value.length) newPos++;
    setCursorPos(newPos);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = newPos;
        inputRef.current.selectionEnd = newPos;
      }
    }, 0);
  };

  const handleKeyboardAction = (
    action: "enter" | "undo" | "redo" | "space",
  ) => {
    if (action === "space") {
      handleKeyboardInsert(" ");
    } else if (action === "enter" && onAddEnter) {
      onAddEnter();
    }
  };

  const getColoredText = () => {
    if (!value) return <span className="opacity-0">placeholder</span>;
    const tokens = value.split(/([a-zA-Z_]\w*)/);
    const isDark = appTheme === "dark";
    return tokens.map((tok: string, i: number) => {
      if (/^[a-zA-Z_]\w*$/.test(tok)) {
        const isVar =
          variables.some((v: any) => v.name === tok) ||
          ["x", "y", "t", "time", "theta"].includes(tok) ||
          tok.startsWith("t_");
        if (isVar) {
          const color =
            tok === "x"
              ? "#10b981"
              : (["t", "time"].includes(tok) || tok.startsWith("t_"))
                ? "#8b5cf6"
                : tok === "y"
                  ? "#3b82f6"
                  : tok === "theta"
                    ? "#f59e0b"
                    : getVarColor(tok);
          return (
            <span
              key={i}
              style={{
                color,
                textShadow: hoveredVar === tok ? `0 0 8px ${color}` : "none",
                fontWeight: hoveredVar === tok ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {tok}
            </span>
          );
        }
        if (MATH_COMPLETIONS.some((c) => c.name === tok)) {
          return (
            <span key={i} style={{ color: isDark ? "#eab308" : "#b45309" }}>
              {tok}
            </span>
          );
        }
      }
      return (
        <span key={i} style={{ color: isDark ? "#cbd5e1" : "#334155" }}>
          {tok}
        </span>
      );
    });
  };

  let renderedContent = null;

  if (!isFocused && !forceEditMode && !error && value.trim()) {
    if (isComputingLatex) {
      // Skeleton shimmer while computing LaTeX in worker
      renderedContent = (
        <div className="w-full px-2 py-2 flex items-center overflow-x-hidden">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse"></div>
        </div>
      );
    } else if (latexResult.latex) {
      try {
        const fullTex = latexResult.latex + (latexResult.evalResult ? ` \\mathbf{ = ${latexResult.evalResult.replace(/ /g, "\\ ")}}` : "");
        renderedContent = (
          <div className="w-full px-2 py-2 flex items-center overflow-x-auto custom-scrollbar relative pr-20 group/preview block">
            <span
              className="math-rendered-block block w-full text-xs sm:text-sm pointer-events-none text-slate-805 dark:text-slate-200 [&_.katex]:text-[14px] [&_.katex-display]:m-0"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(fullTex, {
                  throwOnError: true,
                  displayMode: true,
                  strict: "ignore",
                  trust: true,
                }),
              }}
            />
          </div>
        );
      } catch (e) {
        // Fallback if KaTeX fails
        renderedContent = null;
      }
    }

    if (!renderedContent) {
      // Fallback to Markdown
      renderedContent = (
        <div className="markdown-body p-2 font-sans w-full text-sm text-slate-800 dark:text-slate-200">
          <Markdown
            remarkPlugins={MARKDOWN_REMARK_PLUGINS}
            rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
          >
            {value}
          </Markdown>
        </div>
      );
    }
  }

  return (
    <div className="relative flex-1 group/preview" ref={containerRef}>
      <div
        className={`relative w-full rounded border group-hover/preview:border-slate-350 dark:group-hover/preview:border-slate-700/50 transition-colors cursor-text min-h-[36px] ${isFocused || forceEditMode ? "bg-white dark:bg-slate-900 border-blue-500 dark:border-slate-500 shadow-sm" : "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-transparent"}`}
        onClick={() => {
          if (!isFocused) setIsFocused(true);
          setTimeout(() => inputRef.current?.focus(), 10);
        }}
      >
        <div
          className={`relative w-full ${isFocused || forceEditMode || error || (!isComputingLatex && !latexResult.latex) ? "block" : "hidden"}`}
        >
          <div className="px-2 py-1.5 font-mono text-sm whitespace-pre-wrap break-all pointer-events-none opacity-0 select-none z-0 w-full min-h-[28px]">
            {value + "\n."}
          </div>

          <div className="absolute inset-0 px-2 py-1.5 pointer-events-none font-mono text-sm whitespace-pre-wrap break-all z-0">
            {getColoredText()}
          </div>

          {effectiveMode === "virtual" && (
            <CaretOverlay
              value={value}
              cursorPos={cursorPos}
              isFocused={isFocused}
              getColoredText={getColoredText}
            />
          )}

          {effectiveMode === "native" ? (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setCursorPos(e.target.selectionStart || 0);
              }}
              onSelect={(e) =>
                setCursorPos(e.currentTarget.selectionStart || 0)
              }
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsFocused(false), 200);
                if (onBlur) onBlur();
              }}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full bg-transparent outline-none caret-blue-550 dark:caret-blue-400 font-mono text-sm px-2 py-1.5 z-20 resize-none text-transparent whitespace-pre-wrap break-all"
              placeholder={isFocused ? "e.g. a * sin(b*x + c)" : ""}
              spellCheck={false}
              autoComplete="off"
              style={{ overflow: "hidden" }}
            />
          ) : (
            <div
              ref={inputRef as any}
              tabIndex={0}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsFocused(false), 200);
                if (onBlur) onBlur();
              }}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full bg-transparent outline-none caret-transparent font-mono text-sm px-2 py-1.5 z-20 resize-none text-transparent whitespace-pre-wrap break-all"
              style={{ overflow: "hidden" }}
            />
          )}

          {(isFocused || forceEditMode) && onToggleKeyboard && (
            <button
              title="Visual Math Composer"
              className={`absolute right-1 top-1/2 -translate-y-1/2 z-30 p-1.5 md:hidden rounded transition-colors shrink-0 flex items-center justify-center ${showKeyboard ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-700 opacity-60 hover:opacity-100"}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleKeyboard();
              }}
            >
              <Calculator size={14} />
            </button>
          )}
        </div>

        {!(isFocused || forceEditMode) && !error && renderedContent}
      </div>

      {error && (
        <div className="text-[10px] text-red-400 mt-1 ml-1 flex items-center gap-1 opacity-80">
          <span className="w-1 h-1 rounded-full bg-red-400 block" />
          {error}
        </div>
      )}

      {!error && warning && (
        <div className="text-[10px] text-amber-500 mt-1 ml-1 flex items-center gap-1 opacity-80">
          <span className="w-1 h-1 rounded-full bg-amber-500 block" />
          {warning}
        </div>
      )}

      {suggestions.length > 0 &&
        inputRect &&
        createPortal(
          <div
            className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl rounded-lg overflow-hidden z-[99999] flex flex-col py-1 text-slate-800 dark:text-slate-200"
            style={{
              top: inputRect.bottom + 4,
              left: inputRect.left,
              width: Math.max(256, inputRect.width),
            }}
          >
            {suggestions.map((s, idx) => (
              <div
                key={s.name}
                className={`px-3 py-1.5 flex flex-col cursor-pointer transition-colors ${idx === selIndex ? "bg-slate-100 dark:bg-slate-700" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                onClick={() => {
                  const match = value
                    .slice(0, cursorPos)
                    .match(/[a-zA-Z_]\w*$/);
                  if (match) {
                    const before = value.slice(0, cursorPos - match[0].length);
                    const after = value.slice(cursorPos);
                    onChange(before + s.insert + after);
                  }
                }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-blue-600 dark:text-blue-400 text-sm font-semibold">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-slate-550 dark:text-slate-500">
                    {idx === selIndex ? "Tab to insert" : ""}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {s.desc}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}

      {showKeyboard && (
        <>
          <div className="hidden md:block mt-2 w-full animate-in fade-in slide-in-from-top-2 duration-200">
            <MathKeyboard
              onInsert={handleKeyboardInsert}
              onDelete={handleKeyboardDelete}
              onMoveCursor={handleKeyboardMoveCursor}
              onAction={handleKeyboardAction}
              onClose={onCloseKeyboard}
              variables={variables}
            />
          </div>
          {createPortal(
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100000] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-2">
              <MathKeyboard
                onInsert={handleKeyboardInsert}
                onDelete={handleKeyboardDelete}
                onMoveCursor={handleKeyboardMoveCursor}
                onAction={handleKeyboardAction}
                onClose={onCloseKeyboard}
                variables={variables}
              />
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  );
};

export const EquationInput = React.memo(EquationInputBase, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.error === next.error &&
    prev.hoveredVar === next.hoveredVar &&
    prev.forceEditMode === next.forceEditMode &&
    prev.showKeyboard === next.showKeyboard &&
    prev.variables === next.variables
  );
});
