import React, { useRef, useEffect } from "react";
import { useInputMode } from "../stores/useInputMode";

export interface EquationInputProps {
  value: string;
  onChange: (val: string) => void;
  variables: any[];
  hoveredVar?: string | null;
  error?: boolean;
  onAddEnter?: () => void;
  onBlur?: () => void;
  globalTime?: number;
  forceEditMode?: boolean;
  showKeyboard?: boolean;
  onToggleKeyboard?: () => void;
  onCloseKeyboard?: () => void;
  getColoredText: () => React.ReactNode;
  cursorPos: number;
  setCursorPos: (pos: number) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLDivElement>;
  handleKeyDown: (e: React.KeyboardEvent<any>) => void;
  isFocused: boolean;
  setIsFocused: (focused: boolean) => void;
}

export const EquationInput: React.FC<EquationInputProps> = ({
  value,
  onChange,
  variables,
  hoveredVar,
  error,
  onAddEnter,
  onBlur,
  globalTime = 1,
  forceEditMode = false,
  showKeyboard = false,
  onToggleKeyboard,
  onCloseKeyboard,
  getColoredText,
  cursorPos,
  setCursorPos,
  inputRef,
  handleKeyDown,
  isFocused,
  setIsFocused,
}) => {
  const { inputMode, isTouchDevice } = useInputMode();
  const effectiveMode =
    inputMode === "auto" ? (isTouchDevice ? "virtual" : "native") : inputMode;

  useEffect(() => {
    // Keep focus when mode switches
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [effectiveMode, isFocused, inputRef]);

  // Synthetic caret for virtual mode
  const renderVirtualCaret = () => {
    if (!isFocused || effectiveMode !== "virtual") return null;

    // We can simulate caret position by rendering invisible text up to cursor, then the caret
    const beforeCursor = value.slice(0, cursorPos);

    return (
      <div className="absolute inset-0 px-2 py-1.5 pointer-events-none font-mono text-sm whitespace-pre-wrap break-all z-20 overflow-hidden text-transparent">
        <span>{beforeCursor}</span>
        <span className="inline-block w-[2px] h-[1.1em] bg-blue-500 animate-pulse align-text-bottom -ml-[1px]" />
      </div>
    );
  };

  return (
    <>
      <div className="px-2 py-1.5 font-mono text-sm whitespace-pre-wrap break-all pointer-events-none opacity-0 select-none z-0 w-full min-h-[28px]">
        {value + "\n."}
      </div>

      <div className="absolute inset-0 px-2 py-1.5 pointer-events-none font-mono text-sm whitespace-pre-wrap break-all z-0">
        {getColoredText()}
      </div>

      {renderVirtualCaret()}

      {effectiveMode === "native" ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursorPos(e.target.selectionStart || 0);
          }}
          onSelect={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
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
          ref={inputRef as React.RefObject<HTMLDivElement>}
          tabIndex={0}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200);
            if (onBlur) onBlur();
          }}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full bg-transparent outline-none font-mono text-sm px-2 py-1.5 z-20 resize-none text-transparent whitespace-pre-wrap break-all"
          style={{ overflow: "hidden" }}
        >
          {/* We keep the div empty but focusable */}
        </div>
      )}

      {(isFocused || forceEditMode) && onToggleKeyboard && (
        <button
          title="Visual Math Composer"
          className={`absolute right-1 top-1/2 -translate-y-1/2 z-30 p-1.5 md:hidden rounded transition-colors shrink-0 flex items-center justify-center ${showKeyboard ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-700 opacity-60 hover:opacity-100"}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleKeyboard();
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 19H5c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2z" />
            <path d="M6 10h.01" />
            <path d="M10 10h.01" />
            <path d="M14 10h.01" />
            <path d="M18 10h.01" />
            <path d="M6 14h.01" />
            <path d="M10 14h.01" />
            <path d="M14 14h.01" />
            <path d="M18 14h.01" />
          </svg>
        </button>
      )}
    </>
  );
};
