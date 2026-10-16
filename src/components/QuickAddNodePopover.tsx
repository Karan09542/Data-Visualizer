import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useStore, getEffectiveTheme } from "../store/useStore";
import {
  X,
  Plus,
  Braces,
  Brackets,
  Sparkles,
  KeyRound,
} from "lucide-react";
import {
  SIMPLE_CHILD_TYPES,
  ADVANCED_NODE_TYPES,
  SimpleNodeType,
  AdvancedNodeType,
  getValueAtNodePath,
  getUniqueKey,
  applyJsonNodeChange,
} from "../utils/nodeChangeUtils";

interface QuickAddNodePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: {
    id: string;
    name: string;
    type: string;
    path: string;
  };
  anchorRect: DOMRect | null;
}

function computePopoverCoordinates(
  anchorRect: DOMRect | null,
  element: HTMLElement | null
): { top: number; left: number } {
  const margin = 12;
  const vpW = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 800;

  // Measure actual rendered dimensions if available
  const popWidth = element ? element.offsetWidth : 316;
  const popHeight = element ? element.offsetHeight : 280;

  // Mobile layout (< 640px or small height): Always center on screen to prevent clipping
  const isMobile = vpW < 640 || vpH < 520;
  if (isMobile || !anchorRect) {
    const safeW = Math.min(popWidth, vpW - 2 * margin);
    const safeH = Math.min(popHeight, vpH - 2 * margin);
    return {
      left: Math.max(margin, Math.round((vpW - safeW) / 2)),
      top: Math.max(margin, Math.round((vpH - safeH) / 2)),
    };
  }

  // Desktop layout: Prefer right of anchor button
  let left: number;
  if (anchorRect.right + popWidth + margin <= vpW) {
    left = anchorRect.right + 10;
  } else if (anchorRect.left - popWidth - margin >= 0) {
    left = anchorRect.left - popWidth - 10;
  } else {
    left = Math.max(margin, Math.round((vpW - popWidth) / 2));
  }

  // Center vertically relative to anchor button, clamped within viewport margins
  const targetTop = anchorRect.top + anchorRect.height / 2 - popHeight / 2;
  const maxTop = Math.max(margin, vpH - popHeight - margin);
  const top = Math.max(margin, Math.min(targetTop, maxTop));

  return { top: Math.round(top), left: Math.round(left) };
}

export const QuickAddNodePopover: React.FC<QuickAddNodePopoverProps> = ({
  isOpen,
  onClose,
  targetNode,
  anchorRect,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const rawAppTheme = useStore((s) => s.appTheme);
  const systemTheme = useStore((s) => s.systemTheme);
  const appTheme = getEffectiveTheme(rawAppTheme, systemTheme);
  const expandNode = useStore((s) => s.expandNode);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const setNotification = useStore((s) => s.setNotification);

  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");
  const [customKey, setCustomKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isArray = targetNode.type === "array";
  const parentValue = getValueAtNodePath(targetNode.path);
  const arrayLength = Array.isArray(parentValue) ? parentValue.length : 0;

  // useLayoutEffect runs synchronously before browser paint to measure actual dimensions and position accurately
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!popoverRef.current) return;
      const computed = computePopoverCoordinates(anchorRect, popoverRef.current);
      setPosition(computed);
      setIsPositioned(true);
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, anchorRect, activeTab]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const handleAddSimpleNode = async (simple: SimpleNodeType) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const targetPath = targetNode.path;
      let finalKey = customKey.trim();

      if (isArray) {
        let valueStr = "";
        if (simple.type === "object") valueStr = "{}";
        else if (simple.type === "array") valueStr = "[]";
        else if (simple.type === "number") valueStr = "0";
        else if (simple.type === "boolean") valueStr = "false";
        else if (simple.type === "null") valueStr = "null";
        else valueStr = "new_item";

        await applyJsonNodeChange(targetPath, "add", valueStr, undefined, simple.type);

        const newPath = `${targetPath}[${arrayLength}]`;
        expandNode(targetPath);
        setSelectedNodeId(newPath);
      } else {
        if (!finalKey) {
          finalKey = getUniqueKey(parentValue, simple.type);
        }

        let valueStr = "";
        if (simple.type === "object") valueStr = "{}";
        else if (simple.type === "array") valueStr = "[]";
        else if (simple.type === "number") valueStr = "0";
        else if (simple.type === "boolean") valueStr = "false";
        else if (simple.type === "null") valueStr = "null";
        else valueStr = "";

        await applyJsonNodeChange(targetPath, "add", valueStr, finalKey, simple.type);

        const newPath = targetPath === "root" ? `root.${finalKey}` : `${targetPath}.${finalKey}`;
        expandNode(targetPath);
        setSelectedNodeId(newPath);
      }

      setNotification({
        message: `Added ${simple.label} node to ${targetNode.name}`,
        type: "success",
      });
      onClose();
    } catch (err) {
      console.error("Failed to add simple node", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdvancedNode = async (advanced: AdvancedNodeType) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const targetPath = targetNode.path;

      if (isArray) {
        const specialKey = getUniqueKey({}, advanced.suffix);
        const objValue = { [specialKey]: advanced.value };

        await applyJsonNodeChange(
          targetPath,
          "add",
          JSON.stringify(objValue),
          undefined,
          "object"
        );

        const newPath = `${targetPath}[${arrayLength}]`;
        expandNode(targetPath);
        setSelectedNodeId(newPath);
      } else {
        let finalKey = customKey.trim();
        if (!finalKey) {
          finalKey = getUniqueKey(parentValue, advanced.suffix);
        } else if (!finalKey.endsWith(`_${advanced.suffix}`)) {
          finalKey = `${finalKey}_${advanced.suffix}`;
        }

        await applyJsonNodeChange(
          targetPath,
          "add",
          advanced.value,
          finalKey,
          advanced.type
        );

        const newPath = targetPath === "root" ? `root.${finalKey}` : `${targetPath}.${finalKey}`;
        expandNode(targetPath);
        setSelectedNodeId(newPath);
      }

      setNotification({
        message: `Added ${advanced.label} to ${targetNode.name}`,
        type: "success",
      });
      onClose();
    } catch (err) {
      console.error("Failed to add advanced node", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className={appTheme === "dark" ? "dark" : ""}>
      {/* Backdrop matching app theme (NodeEditingModal.tsx style) */}
      <div
        className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-100"
        onClick={onClose}
        onTouchStart={onClose}
      />

      {/* Popover Card matching Visualizer App Theme (Slate Palette) */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add child node to ${targetNode.name}`}
        className="fixed z-[9999] w-[316px] max-w-[calc(100vw-20px)] max-h-[min(480px,82dvh)] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-2xl shadow-slate-950/40 overflow-hidden font-sans"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          visibility: isPositioned ? "visible" : "hidden",
          opacity: isPositioned ? 1 : 0,
          transform: isPositioned ? "scale(1)" : "scale(0.96)",
          transition: "opacity 120ms ease-out, transform 120ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header - matching app's NodeContextMenu & NodeEditingModal header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Plus size={12} strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                Add to {targetNode.name}
              </span>
              <span
                className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${isArray
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20"
                    : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20"
                  }`}
              >
                {targetNode.type}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body - with smooth touch scroll */}
        <div className="p-2 space-y-2 overflow-y-auto overscroll-contain custom-scrollbar">
          {/* Key Input (Object) or Array Notification */}
          {!isArray ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/70">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
                <KeyRound size={12} className="text-indigo-500" />
                <span>Key:</span>
              </div>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="auto-generated if empty"
                className="flex-1 min-w-0 text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {customKey && (
                <button
                  type="button"
                  onClick={() => setCustomKey("")}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300">
              <Brackets size={13} className="shrink-0 text-indigo-500" />
              <span>Appends item at index <b className="font-mono font-bold">[{arrayLength}]</b></span>
            </div>
          )}

          {/* Segmented Tab Switcher (matching NodeContextMenu radiogroup styling) */}
          <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("basic")}
              className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "basic"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
            >
              <Braces size={12} className={activeTab === "basic" ? "text-indigo-500 dark:text-indigo-400" : ""} />
              <span>Basic Types</span>
              <span className="text-[10px] opacity-60 font-mono">(6)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advanced")}
              className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "advanced"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
            >
              <Sparkles size={12} className={activeTab === "advanced" ? "text-amber-500" : ""} />
              <span>Advanced</span>
              <span className="text-[10px] opacity-60 font-mono">(8)</span>
            </button>
          </div>

          {/* Tab 1: Basic Types (6 items in compact 3x2 grid matching app node colors) */}
          {activeTab === "basic" && (
            <div className="grid grid-cols-3 gap-1.5 animate-in fade-in duration-100">
              {SIMPLE_CHILD_TYPES.map((simple) => {
                const Icon = simple.icon;
                return (
                  <button
                    key={simple.type}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAddSimpleNode(simple)}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-500/60 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all group text-center cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    <div
                      className={`w-5 h-5 rounded ${simple.bg} ${simple.color} flex items-center justify-center mb-0.5 group-hover:scale-110 transition-transform`}
                    >
                      <Icon size={12} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {simple.label}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                      {simple.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Advanced Nodes (8 items in compact 2x4 grid matching app icon badges) */}
          {activeTab === "advanced" && (
            <div className="grid grid-cols-2 gap-1.5 animate-in fade-in duration-100">
              {ADVANCED_NODE_TYPES.map((advanced) => {
                const Icon = advanced.icon;
                return (
                  <button
                    key={advanced.suffix}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAddAdvancedNode(advanced)}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-500/60 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all text-left group cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    <div
                      className={`w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${advanced.iconClass}`}
                    >
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {advanced.label}
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                        {advanced.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-3.5 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>1-click insert &amp; focus</span>
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[9px] font-mono text-slate-500 dark:text-slate-400">
            Esc
          </kbd>
        </div>
      </div>
    </div>,
    document.body
  );
};
