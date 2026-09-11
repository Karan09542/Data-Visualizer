/**
 * Copying a line of console output: right-click it, or hold it on a touch screen.
 *
 * A line can hold text and values at once, so the menu offers both the line as a terminal would
 * print it and its values as JSON, plus the whole output. The menu is positioned at the pointer
 * and kept inside the window.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Braces, Check, ClipboardList, Copy } from "lucide-react";
import { copyToClipboard } from "../AppErrorPopup";
// @ts-ignore - plain JavaScript, shared with the worker
import { __dvJson as toJson, __dvIsCapture as isCapture } from "../../utils/consoleValue.js";
import { logArgsToText } from "./ConsoleValue";

/** How long a touch must be held before the menu opens. */
const HOLD_MS = 500;
/** Moving further than this during a hold means the reader is scrolling, not holding. */
const MOVE_CANCEL_PX = 10;
const MENU_WIDTH = 208;

interface OpenMenu {
  x: number;
  y: number;
  args: any[];
}

interface HoldState {
  timer: number;
  x: number;
  y: number;
  args: any[];
  opened: boolean;
}

const itemClass =
  "w-full text-left px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer";

export function useLineCopyMenu(options?: { onCopyAll?: () => void | Promise<void> }) {
  const [target, setTarget] = useState<OpenMenu | null>(null);
  const [copiedAt, setCopiedAt] = useState<{ x: number; y: number } | null>(null);
  const hold = useRef<HoldState | null>(null);

  const close = useCallback(() => setTarget(null), []);

  const cancelHold = useCallback(() => {
    if (!hold.current) return;
    clearTimeout(hold.current.timer);
    hold.current = null;
  }, []);

  // Anywhere else, Escape, scrolling or resizing closes it.
  useEffect(() => {
    if (!target) return;
    const onPointerDown = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.("[data-console-copy-menu]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("touchstart", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("touchstart", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [target, close]);

  useEffect(() => cancelHold, [cancelHold]);

  /** Handlers for one line. Spread onto the row. */
  const bind = useCallback(
    (args: any[]) => ({
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setTarget({ x: e.clientX, y: e.clientY, args });
      },
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        cancelHold();
        const state: HoldState = {
          x: touch.clientX,
          y: touch.clientY,
          args,
          opened: false,
          timer: window.setTimeout(() => {
            if (!hold.current) return;
            hold.current.opened = true;
            setTarget({ x: hold.current.x, y: hold.current.y, args });
          }, HOLD_MS),
        };
        hold.current = state;
      },
      onTouchMove: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        const state = hold.current;
        if (!touch || !state || state.opened) return;
        if (Math.hypot(touch.clientX - state.x, touch.clientY - state.y) > MOVE_CANCEL_PX) cancelHold();
      },
      onTouchEnd: (e: React.TouchEvent) => {
        const opened = hold.current?.opened;
        cancelHold();
        // The hold already did something; don't let it turn into a tap as well.
        if (opened) e.preventDefault();
      },
      onTouchCancel: cancelHold,
    }),
    [cancelHold],
  );

  const copy = useCallback(
    async (text: string) => {
      const at = target;
      close();
      if (await copyToClipboard(text)) {
        setCopiedAt(at ? { x: at.x, y: at.y } : null);
        setTimeout(() => setCopiedAt(null), 1200);
      }
    },
    [target, close],
  );

  const hasValues = useMemo(
    () => !!target?.args?.some((arg) => isCapture(arg) || (arg && typeof arg === "object")),
    [target],
  );

  const menu = (
    <>
      {target &&
        createPortal(
          <div
            data-console-copy-menu
            className="fixed z-[99999] bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700/50 shadow-2xl rounded-md py-1 overflow-hidden no-export"
            style={{
              width: MENU_WIDTH,
              left: Math.max(8, Math.min(target.x, window.innerWidth - MENU_WIDTH - 8)),
              top: Math.max(8, Math.min(target.y, window.innerHeight - 150)),
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button type="button" className={itemClass} onClick={() => copy(logArgsToText(target.args))}>
              <Copy size={14} className="text-slate-400 shrink-0" />
              Copy line
            </button>
            {hasValues && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  const values = target.args.map((arg) => toJson(arg));
                  copy(JSON.stringify(values.length === 1 ? values[0] : values, null, 2));
                }}
              >
                <Braces size={14} className="text-slate-400 shrink-0" />
                Copy as JSON
              </button>
            )}
            {options?.onCopyAll && (
              <button
                type="button"
                className={itemClass}
                onClick={async () => {
                  close();
                  await options.onCopyAll!();
                }}
              >
                <ClipboardList size={14} className="text-slate-400 shrink-0" />
                Copy all output
              </button>
            )}
          </div>,
          document.body,
        )}
      {copiedAt &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-900/90 text-white shadow-lg"
            style={{
              left: Math.max(8, Math.min(copiedAt.x, window.innerWidth - 90)),
              top: Math.max(8, copiedAt.y - 28),
            }}
          >
            <Check size={11} className="text-emerald-400" />
            Copied
          </div>,
          document.body,
        )}
    </>
  );

  return { bind, menu, close };
}
