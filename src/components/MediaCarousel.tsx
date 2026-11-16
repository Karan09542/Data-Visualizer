import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface MediaCarouselProps<T> {
  isOpen: boolean;
  onClose: () => void;
  items: T[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderHeaderMiddle?: (item: T, index: number, total: number) => React.ReactNode;
  renderHeaderRight?: (item: T, index: number) => React.ReactNode;
  keepMounted?: boolean;
  isDark?: boolean;
}

export default function MediaCarousel<T>({
  isOpen,
  onClose,
  items,
  selectedIndex,
  onIndexChange,
  renderItem,
  renderHeaderMiddle,
  renderHeaderRight,
  keepMounted = false,
  isDark = true,
}: MediaCarouselProps<T>) {
  const [showChrome, setShowChrome] = useState(true);
  /** The finger that may become a swipe: where it started, and whether something else owns it. */
  const swipe = useRef<{ x: number; y: number; blocked: boolean } | null>(null);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setViewedIndices((prev) => {
        const next = new Set(prev);
        next.add(selectedIndex);
        return next;
      });
    } else {
      setViewedIndices(new Set());
    }
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isOpen && showChrome) {
      timeout = setTimeout(() => setShowChrome(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [isOpen, showChrome, selectedIndex]);

  const handlePointerMoveChrome = () => {
    if (!showChrome) setShowChrome(true);
  };

  // Keyboard navigation. One listener while open, reading the latest values: re-adding it on every
  // change could let a single key press be handled twice.
  const live = useRef({ selectedIndex, count: items.length, onClose, onIndexChange });
  live.current = { selectedIndex, count: items.length, onClose, onIndexChange };
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing in a field (a PDF search box, say) keeps its keys; an open dropdown takes Esc.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape" && document.querySelector('[role="listbox"]')) return;
      const { selectedIndex: i, count, onClose: close, onIndexChange: go } = live.current;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && i > 0) go(i - 1);
      else if (e.key === "ArrowRight" && i < count - 1) go(i + 1);
      else return;
      if (e.key !== "Escape") setShowChrome(true);
      // Handled here: nothing behind the viewer (a panel, a full-screen chat) acts on it too.
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    // Captured: whatever had focus before (a node that stops its key events, say) can't hide them.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  /**
   * A one-finger, clearly sideways swipe moves to the next or previous item - unless the content
   * under the finger uses the drag itself: a zoomed-in picture being panned, a 3D model being
   * turned, a slider, a text field. Such content marks itself with data-carousel-noswipe.
   * A second finger (a pinch) cancels the swipe.
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as Element | null;
    const owned = !!target?.closest?.(
      "[data-carousel-noswipe], model-viewer, input, textarea, select, [contenteditable='true']",
    );
    if (e.touches.length > 1) {
      if (swipe.current) swipe.current.blocked = true;
      return;
    }
    swipe.current = { x: t.clientX, y: t.clientY, blocked: owned };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1 && swipe.current) swipe.current.blocked = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    if (e.touches.length > 0) return; // other fingers still down
    swipe.current = null;
    if (!s || s.blocked) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && selectedIndex < items.length - 1) onIndexChange(selectedIndex + 1);
    else if (dx > 0 && selectedIndex > 0) onIndexChange(selectedIndex - 1);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[12000] flex items-center justify-center backdrop-blur-3xl nodrag nowheel ${isDark ? "bg-black/98" : "bg-white/95"}`}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            e.stopPropagation();
            handlePointerMoveChrome();
            handleTouchStart(e);
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            handleTouchMove(e);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTouchEnd(e);
          }}
          onTouchCancel={() => {
            swipe.current = null;
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            handlePointerMoveChrome();
          }}
          onClick={(e) => {
            e.stopPropagation();
            handlePointerMoveChrome();
          }}
        >
          <AnimatePresence>
            {showChrome && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className={`absolute top-0 inset-x-0 z-[12010] flex items-center justify-between p-4 bg-gradient-to-b pointer-events-auto ${isDark ? "from-black/80 to-transparent" : "from-white/90 to-transparent"}`}
              >
                <div className="flex items-center gap-3 w-1/3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className={`p-3 rounded-full transition-all backdrop-blur-md ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-200/60 hover:bg-slate-300 text-slate-800"}`}
                  >
                    <ChevronLeft className="w-5 h-5 sm:hidden" />
                    <X className="w-5 h-5 hidden sm:block" />
                  </button>
                </div>

                <div className={`flex flex-col items-center justify-center max-w-[calc(100%-100px)] w-1/3 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                  {renderHeaderMiddle && renderHeaderMiddle(items[selectedIndex], selectedIndex, items.length)}
                </div>

                <div className="flex items-center justify-end gap-2 w-1/3">
                  {renderHeaderRight && renderHeaderRight(items[selectedIndex], selectedIndex)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showChrome && selectedIndex > 0 && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(selectedIndex - 1);
                }}
                className={`absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 rounded-full z-[12010] transition-all border shadow-xl backdrop-blur-md pointer-events-auto ${isDark ? "bg-black/40 hover:bg-black/80 text-white border-white/10" : "bg-white/60 hover:bg-white/90 text-slate-800 border-slate-200/50"}`}
              >
                <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showChrome && selectedIndex < items.length - 1 && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(selectedIndex + 1);
                }}
                className={`absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 rounded-full z-[12010] transition-all border shadow-xl backdrop-blur-md pointer-events-auto ${isDark ? "bg-black/40 hover:bg-black/80 text-white border-white/10" : "bg-white/60 hover:bg-white/90 text-slate-800 border-slate-200/50"}`}
              >
                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="w-full h-full flex items-center justify-center p-0 sm:p-0 z-[12005]">
            {keepMounted ? (
              items.map((item, idx) => {
                if (!viewedIndices.has(idx)) return null;
                const isSelected = idx === selectedIndex;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.95, pointerEvents: isSelected ? "auto" : "none" }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-full h-full absolute inset-0 flex items-center justify-center p-0 sm:p-0"
                    style={{ display: isSelected ? "flex" : "none" }}
                  >
                    {renderItem(item, isSelected)}
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-full h-full absolute inset-0 flex items-center justify-center p-0 sm:p-0"
              >
                {renderItem(items[selectedIndex], true)}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
