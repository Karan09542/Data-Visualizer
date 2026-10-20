import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAnnotationStore } from '../store/useAnnotationStore';

const PULL_THRESHOLD = 65; // pixels required to trigger reload
const MAX_PULL = 85; // maximum visual pull travel

/**
 * Returns the bottom Y coordinate (in viewport space) of the top header.
 * Defaults to 48px if header is not yet rendered.
 */
function getHeaderBottom(): number {
  if (typeof document === 'undefined') return 48;
  const header =
    document.getElementById('app-header') ||
    document.querySelector('header, [data-app-header="true"]');
  if (header) {
    const rect = header.getBoundingClientRect();
    if (rect.bottom > 0) {
      return rect.bottom;
    }
  }
  return 48; // Standard 48px top header height
}

export function MobilePullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isPrimed, setIsPrimed] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isHorizontalRef = useRef(false);
  const hasVibratedRef = useRef(false);

  useEffect(() => {
    // Only bind on touch-enabled devices
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    if (!isTouchDevice) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isReloading || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;

      // 1. Don't trigger if touching inside inputs, textareas, sliders, dialogs, modals, or editors
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"], .modal, .monaco-editor, [data-drawing-toolbar], .drawing-toolbar, [data-mobile-menu]'
        )
      ) {
        return;
      }

      // 2. Don't trigger if touching drawing canvases, annotation elements, or transform boxes
      if (
        target?.closest(
          'canvas, svg.drawing-canvas, [data-anno-id], .transform-box, .annotation-layer, [data-drawing-layer]'
        )
      ) {
        return;
      }

      // 3. Strictly require swipe to initiate from the top header height:
      // Either touch.clientY must be within the top header bounds, or touch starts directly on the top header element.
      const headerBottom = getHeaderBottom();
      const isHeaderTarget = Boolean(
        target?.closest?.('#app-header, header, [data-app-header="true"]')
      );
      const startsWithinHeaderHeight = touch.clientY <= headerBottom;

      // If swipe starts from any height below the top header, ignore completely
      if (!startsWithinHeaderHeight && !isHeaderTarget) {
        return;
      }

      // 4. When drawing toolbar or drawing mode is active, strictly require the touch
      // to be on the header element itself to avoid accidental triggers while drawing near top
      const isDrawingToolbarVisible = useAnnotationStore.getState().isToolbarVisible;
      if (isDrawingToolbarVisible && !isHeaderTarget) {
        return;
      }

      // 5. Must be at the top of the page / scrollable container
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollY > 0) return;

      const scrollableParent = target?.closest('.overflow-y-auto, .overflow-auto');
      if (scrollableParent && scrollableParent.scrollTop > 0) return;

      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isTrackingRef.current = true;
      isHorizontalRef.current = false;
      hasVibratedRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || isReloading || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // If user is swiping horizontally, cancel vertical pull tracking
      if (!isHorizontalRef.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isHorizontalRef.current = true;
        isTrackingRef.current = false;
        setPullDistance(0);
        return;
      }

      if (isHorizontalRef.current) return;

      // Only vertical swiping downwards (top to bottom) increases pull
      if (deltaY > 0) {
        // Apply rubber-band damping
        const damped = Math.min(Math.pow(deltaY, 0.85) * 1.4, MAX_PULL);
        setPullDistance(damped);

        if (damped >= PULL_THRESHOLD) {
          setIsPrimed(true);
          if (!hasVibratedRef.current) {
            try {
              navigator.vibrate?.(15);
            } catch {
              // Ignore vibration errors if not permitted
            }
            hasVibratedRef.current = true;
          }
        } else {
          setIsPrimed(false);
          hasVibratedRef.current = false;
        }
      } else {
        setPullDistance(0);
        setIsPrimed(false);
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current || isReloading) return;
      isTrackingRef.current = false;

      setPullDistance((currentDistance) => {
        if (currentDistance >= PULL_THRESHOLD) {
          setIsReloading(true);
          // Keep spinner visible for brief feedback then trigger native reload
          setTimeout(() => {
            window.location.reload();
          }, 250);
          return PULL_THRESHOLD;
        }
        setIsPrimed(false);
        return 0;
      });
    };

    const handleTouchCancel = () => {
      isTrackingRef.current = false;
      if (!isReloading) {
        setPullDistance(0);
        setIsPrimed(false);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isReloading]);

  if (pullDistance <= 0 && !isReloading) return null;

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = isReloading ? 0 : progress * 360;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[99999] pointer-events-none select-none transition-all duration-150 ease-out"
      style={{
        top: `${Math.max(12, pullDistance - 20)}px`,
        opacity: Math.min(progress + 0.2, 1),
      }}
    >
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-md border transition-colors ${
          isPrimed || isReloading
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/30 ring-4 ring-indigo-500/20'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-black/20'
        }`}
      >
        <RefreshCw
          className={`w-5 h-5 transition-transform duration-75 ${
            isReloading ? 'animate-spin' : ''
          }`}
          style={{
            transform: isReloading ? undefined : `rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
}
