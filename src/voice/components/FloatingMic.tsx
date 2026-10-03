import React, { useEffect, useRef, useState } from "react";
import { EyeOff, Mic, MicOff } from "lucide-react";
import { VoiceSpirit3D } from "./VoiceSpirit3D";
import { VoiceToast } from "./VoiceToast";
import "./naad.css";
import { VoiceManager } from "../VoiceManager";
import { useVoiceStore } from "../useVoiceStore";
import { useStore } from "../../store/useStore";

/** How long a press on the spirit has to last to open its menu on a touch screen. */
const LONG_PRESS_MS = 500;
/** A finger that moves further than this is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

export const FloatingMic: React.FC = () => {
  const state = useVoiceStore((state) => state.state);
  const feedback = useVoiceStore((state) => state.feedback);
  const errorMessage = useVoiceStore((state) => state.errorMessage);
  const isVoiceEnabled = useVoiceStore((state) => state.isVoiceEnabled);

  // The spirit's menu: right-click on desktop, press and hold on a touch screen.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLElement | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  // The tap that ends a long press must not also start or stop listening.
  const swallowClick = useRef(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    if (press.current) window.clearTimeout(press.current.timer);
  }, []);

  if (!isVoiceEnabled) return null;

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  /** Opens the menu on right-click, and on press-and-hold with a finger or pen. */
  const menuTriggers = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancelPress();
      setMenuOpen(true);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      cancelPress();
      const timer = window.setTimeout(() => {
        press.current = null;
        swallowClick.current = true;
        navigator.vibrate?.(10);
        setMenuOpen(true);
      }, LONG_PRESS_MS);
      press.current = { timer, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onPointerLeave: cancelPress,
    // No iOS callout or text selection while holding.
    style: { WebkitTouchCallout: "none", userSelect: "none" } as React.CSSProperties,
  };

  const hide = () => {
    setMenuOpen(false);
    VoiceManager.stop();
    useVoiceStore.getState().setIsVoiceEnabled(false);
    useStore.getState().setNotification({
      message: "Voice assistant hidden. Turn it back on in Advanced Options → Voice commands.",
      type: "info",
    });
  };

  const isSupported = VoiceManager.isSupported();
  const isListening = state === "listening";
  const isError = state === "error";
  const isSuccess = state === "success";
  /** Listening, or briefly showing what it heard before listening again. */
  const isActive = isListening || state === "processing" || isSuccess;

  const menu = menuOpen && (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Voice assistant"
      className="pointer-events-auto w-60 overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#0b0a1f]/95 py-1.5 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.65)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
    >
      <p className="px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Voice assistant</p>
      {isSupported && (
        <button
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            VoiceManager.toggle();
          }}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-white/5 focus:bg-white/5 focus:outline-none"
        >
          {isActive ? <MicOff className="h-4 w-4 text-slate-300" /> : <Mic className="h-4 w-4 text-slate-300" />}
          {isActive ? "Stop listening" : "Start listening"}
        </button>
      )}
      <button
        role="menuitem"
        onClick={hide}
        className="flex w-full items-start gap-2.5 px-3.5 py-2 text-left hover:bg-white/5 focus:bg-white/5 focus:outline-none"
      >
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
        <span>
          <span className="block text-sm text-rose-200">Hide voice assistant</span>
          <span className="block text-[11px] leading-snug text-slate-400">Turn it back on in Advanced Options → Voice commands</span>
        </span>
      </button>
    </div>
  );

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
        {menu}
        <div
          ref={(el) => { buttonRef.current = el; }}
          {...menuTriggers}
          className="flex items-center justify-center w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full shadow-lg opacity-50 cursor-not-allowed group"
          title="Voice commands are not supported in this browser. Right-click (or press and hold) to hide."
        >
          <MicOff className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    );
  }

  const handleToggle = () => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    VoiceManager.toggle();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">

      {!menuOpen && <VoiceToast state={state} feedback={feedback} errorMessage={errorMessage} />}
      {menu}

      {/* Mic Button: the Kailash spirit, whose naad spreads while it listens */}
      <button
        ref={(el) => { buttonRef.current = el; }}
        onClick={handleToggle}
        {...menuTriggers}
        aria-pressed={isActive}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={isActive ? "Stop listening" : "Start voice commands"}
        title={`${isActive ? "Stop listening" : "Start voice commands"} · right-click or hold for more`}
        className={`
          relative flex items-center justify-center w-16 h-16 rounded-full pointer-events-auto transition-all duration-300
          bg-[radial-gradient(circle_at_50%_40%,#1e1b4b_0%,#0b0a1f_60%,#020205_100%)] text-white shadow-xl hover:scale-105 active:scale-95
          focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50
          ${isActive
            ? "ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.5)]"
            : isError
              ? "ring-2 ring-amber-400/70 shadow-amber-500/30"
              : "ring-1 ring-indigo-300/20 shadow-[0_0_14px_rgba(99,102,241,0.25)]"
          }
        `}
      >
        {isListening && (
          <span className="absolute inset-0 text-cyan-300" aria-hidden>
            <span className="naad-ring" />
            <span className="naad-ring" />
            <span className="naad-ring" />
          </span>
        )}
        <VoiceSpirit3D mode={state} size={64} />
      </button>
    </div>
  );
};
