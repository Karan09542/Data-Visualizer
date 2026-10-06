import React, { useEffect, useRef, useState } from "react";
import { EyeOff, Mic, MicOff, RotateCcw } from "lucide-react";
import { VoiceSpirit3D } from "./VoiceSpirit3D";
import { VoiceToast } from "./VoiceToast";
import "./naad.css";
import { VoiceManager } from "../VoiceManager";
import { useVoiceStore } from "../useVoiceStore";
import { useStore } from "../../store/useStore";
import { useDraggable } from "../../hooks/useDraggable";

export const FloatingMic: React.FC = () => {
  const state = useVoiceStore((state) => state.state);
  const feedback = useVoiceStore((state) => state.feedback);
  const errorMessage = useVoiceStore((state) => state.errorMessage);
  const isVoiceEnabled = useVoiceStore((state) => state.isVoiceEnabled);

  // The spirit's options menu: right-click on desktop, press and hold on touch/pen
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLElement | null>(null);

  const {
    targetRef,
    dragProps,
    isDragging,
    docking,
    resetPosition,
  } = useDraggable({
    storageKey: "voice-spirit-position",
    edgePadding: 16,
    defaultPosition: () => ({
      x: typeof window !== "undefined" ? Math.max(16, window.innerWidth - 88) : 24,
      y: typeof window !== "undefined" ? Math.max(16, window.innerHeight - 88) : 24,
    }),
    onLongPress: () => setMenuOpen(true),
    onContextMenu: () => setMenuOpen(true),
  });

  // Close menu when clicking outside or pressing Escape
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

  if (!isVoiceEnabled) return null;

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
      className="pointer-events-auto w-64 overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#0b0a1f]/95 py-2 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.7)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between px-3.5 pb-1.5 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Voice assistant</p>
        <button
          role="menuitem"
          onClick={() => {
            resetPosition();
            setMenuOpen(false);
          }}
          title="Reset to default position"
          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-200 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset position</span>
        </button>
      </div>
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
      <div className="border-t border-cyan-200/10 px-3.5 pt-1.5 pb-0.5 mt-1">
        <p className="text-[10px] text-slate-400">💡 Freely draggable anywhere · Hold or right-click for menu</p>
      </div>
    </div>
  );

  if (!isSupported) {
    return (
      <div
        ref={targetRef}
        {...dragProps}
        style={{
          ...dragProps.style,
          width: 48,
          height: 48,
          zIndex: 9999,
        }}
        className="fixed select-none"
      >
        {menuOpen && (
          <div className={`absolute ${docking.isTop ? "top-full mt-2" : "bottom-full mb-2"} ${docking.isLeft ? "left-0" : "right-0"}`}>
            {menu}
          </div>
        )}
        <div
          ref={(el) => { buttonRef.current = el; }}
          className="flex items-center justify-center w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full shadow-lg opacity-50 cursor-not-allowed group pointer-events-auto"
          title="Voice commands are not supported in this browser. Right-click or hold to hide."
        >
          <MicOff className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    );
  }

  const handleToggle = () => {
    VoiceManager.toggle();
  };

  return (
    <div
      ref={targetRef}
      {...dragProps}
      style={{
        ...dragProps.style,
        width: 64,
        height: 64,
        zIndex: 9999,
      }}
      className="fixed select-none"
    >
      {/* Toast above or below depending on vertical position */}
      {!menuOpen && (
        <div
          className={`absolute ${
            docking.isTop ? "top-full mt-2" : "bottom-full mb-2"
          } ${
            docking.isLeft ? "left-0" : "right-0"
          } pointer-events-auto`}
        >
          <VoiceToast state={state} feedback={feedback} errorMessage={errorMessage} />
        </div>
      )}

      {/* Options Menu */}
      {menuOpen && (
        <div
          className={`absolute ${
            docking.isTop ? "top-full mt-2" : "bottom-full mb-2"
          } ${
            docking.isLeft ? "left-0" : "right-0"
          } pointer-events-auto`}
        >
          {menu}
        </div>
      )}

      {/* Mic Button: the Kailash spirit, whose naad spreads while it listens */}
      <button
        ref={(el) => { buttonRef.current = el; }}
        onClick={handleToggle}
        draggable={false}
        aria-pressed={isActive}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={isActive ? "Stop listening" : "Start voice commands"}
        title={`${isActive ? "Stop listening" : "Start voice commands"} · Drag anywhere · Right-click or hold for menu`}
        className={`
          relative flex items-center justify-center w-16 h-16 rounded-full pointer-events-auto select-none
          cursor-grab active:cursor-grabbing
          ${isDragging ? "" : "transition-[box-shadow,ring,background] duration-300"}
          bg-[radial-gradient(circle_at_50%_40%,#1e1b4b_0%,#0b0a1f_60%,#020205_100%)] text-white shadow-xl hover:scale-105 active:scale-95
          focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50
          ${isDragging ? "scale-105 shadow-[0_0_30px_rgba(34,211,238,0.7)] ring-2 ring-cyan-300" : ""}
          ${isActive
            ? "ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.5)]"
            : isError
              ? "ring-2 ring-amber-400/70 shadow-amber-500/30"
              : "ring-1 ring-indigo-300/20 shadow-[0_0_14px_rgba(99,102,241,0.25)]"
          }
        `}
      >
        {isListening && (
          <span className="absolute inset-0 text-cyan-300 pointer-events-none" aria-hidden>
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
