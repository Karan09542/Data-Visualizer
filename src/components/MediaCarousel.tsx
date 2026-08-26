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
}: MediaCarouselProps<T>) {
  const [showChrome, setShowChrome] = useState(true);
  const touchStartXRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);
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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && selectedIndex > 0) {
        onIndexChange(selectedIndex - 1);
        handlePointerMoveChrome();
      } else if (e.key === "ArrowRight" && selectedIndex < items.length - 1) {
        onIndexChange(selectedIndex + 1);
        handlePointerMoveChrome();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, items.length, onClose, onIndexChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndXRef.current = e.changedTouches[0].screenX;
    if (touchEndXRef.current < touchStartXRef.current - 50 && selectedIndex < items.length - 1) {
      onIndexChange(selectedIndex + 1);
    } else if (touchEndXRef.current > touchStartXRef.current + 50 && selectedIndex > 0) {
      onIndexChange(selectedIndex - 1);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/98 backdrop-blur-3xl nodrag nowheel"
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
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTouchEnd(e);
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
                className="absolute top-0 inset-x-0 z-[12010] flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto"
              >
                <div className="flex items-center gap-3 w-1/3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                  >
                    <ChevronLeft className="w-5 h-5 sm:hidden" />
                    <X className="w-5 h-5 hidden sm:block" />
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center text-white max-w-[calc(100%-100px)] w-1/3 text-center">
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
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 rounded-full bg-black/40 hover:bg-black/80 text-white z-[12010] transition-all border border-white/10 shadow-xl backdrop-blur-md pointer-events-auto"
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
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 rounded-full bg-black/40 hover:bg-black/80 text-white z-[12010] transition-all border border-white/10 shadow-xl backdrop-blur-md pointer-events-auto"
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
