import { memo } from "react";
import { ArrowLeftRight, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

interface LetterKeyboardProps {
  /** Letters beyond A–Z that the puzzle needs, e.g. from non-English words. */
  extraLetters: string[];
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onToggleDirection: () => void;
}

/**
 * An on-screen keyboard for touch devices. The system keyboard would cover half the board and
 * resize the viewport on every focus change; this one stays put and never steals focus.
 */
export const LetterKeyboard = memo(function LetterKeyboard({ extraLetters, onLetter, onBackspace, onToggleDirection }: LetterKeyboardProps) {
  const key =
    "lg-key flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg bg-white text-[17px] font-semibold text-slate-900 shadow-[0_1px_0_rgb(15_23_42/0.12)] transition-colors active:bg-slate-200 dark:bg-slate-700 dark:text-white dark:shadow-none dark:active:bg-slate-600";
  const noFocus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

  return (
    <div role="group" aria-label="Letter keyboard" className="space-y-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900">
      {extraLetters.length > 0 && (
        <div className="flex gap-1.5">
          {extraLetters.map((l) => (
            <button key={l} type="button" className={key} onMouseDown={noFocus} onClick={() => onLetter(l)}>
              {l}
            </button>
          ))}
        </div>
      )}
      {ROWS.map((row, i) => (
        <div key={row} className={cn("flex gap-1.5", i === 1 && "px-[5%]")}>
          {i === 2 && (
            <button
              type="button"
              className={cn(key, "flex-[1.5] bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}
              onMouseDown={noFocus}
              onClick={onToggleDirection}
              aria-label="Switch direction"
            >
              <ArrowLeftRight size={18} />
            </button>
          )}
          {[...row].map((l) => (
            <button key={l} type="button" className={key} onMouseDown={noFocus} onClick={() => onLetter(l)}>
              {l}
            </button>
          ))}
          {i === 2 && (
            <button
              type="button"
              className={cn(key, "flex-[1.5] bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}
              onMouseDown={noFocus}
              onClick={onBackspace}
              aria-label="Delete letter"
            >
              <Delete size={19} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
});
