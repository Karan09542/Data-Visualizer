import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Orientation } from '../types';
import { ZOOM_MAX, ZOOM_MIN } from '../constants';

/**
 * Preview viewport zoom + 360° panning: mouse drag, trackpad scroll, Ctrl/⌘+wheel zoom,
 * one-finger pan, two-finger pinch zoom and double-click toggle.
 */
export function usePanZoom(orientation: Orientation) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0, y: 0, panX: 0, panY: 0
  });

  const touchStateRef = useRef<{
    startDist: number | null;
    startZoom: number;
    startPan: { x: number; y: number };
    startTouch1: { x: number; y: number };
    startTouch2?: { x: number; y: number };
    isMultiTouch: boolean;
  }>({
    startDist: null,
    startZoom: 100,
    startPan: { x: 0, y: 0 },
    startTouch1: { x: 0, y: 0 },
    isMultiTouch: false
  });

  // Reset Viewport Zoom & Pan to Exact Center
  const resetView = useCallback(() => {
    setZoomLevel(100);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setZoomLevel(prev => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta)));
  }, []);

  // Responsive window width tracking for mobile viewport fitting
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive base paper preview width for 100% zoom
  const basePaperWidthPx = useMemo(() => {
    const isMobile = windowWidth < 640;
    if (isMobile) {
      // Fit mobile screen width with container padding
      const maxMobileW = Math.max(260, windowWidth - 40);
      return orientation === 'portrait'
        ? Math.min(340, maxMobileW)
        : Math.min(480, maxMobileW);
    }
    return orientation === 'portrait' ? 520 : 680;
  }, [windowWidth, orientation]);

  // Mouse Drag Panning Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Trackpad 2D scroll panning & Ctrl+Wheel pinch zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 12 : -12;
      zoomBy(delta);
    } else {
      // Direct 360 degree panning for touchpad & mouse scroll wheels
      setPanOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Mobile Touch Gestures: 1-finger smooth 360° pan & 2-finger pinch zoom + pan
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStateRef.current = {
          startDist: null,
          startZoom: zoomLevel,
          startPan: { ...panOffset },
          startTouch1: { x: e.touches[0].clientX, y: e.touches[0].clientY },
          isMultiTouch: false
        };
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchStateRef.current = {
          startDist: dist,
          startZoom: zoomLevel,
          startPan: { ...panOffset },
          startTouch1: { x: t1.clientX, y: t1.clientY },
          startTouch2: { x: t2.clientX, y: t2.clientY },
          isMultiTouch: true
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 1 && !touchStateRef.current.isMultiTouch) {
        // 1-finger 360° pan in any direction
        const dx = e.touches[0].clientX - touchStateRef.current.startTouch1.x;
        const dy = e.touches[0].clientY - touchStateRef.current.startTouch1.y;
        setPanOffset({
          x: touchStateRef.current.startPan.x + dx,
          y: touchStateRef.current.startPan.y + dy
        });
      } else if (e.touches.length === 2 && touchStateRef.current.startDist) {
        // 2-finger pinch zoom + pan simultaneously
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const scaleRatio = currentDist / touchStateRef.current.startDist;
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(touchStateRef.current.startZoom * scaleRatio)));
        setZoomLevel(newZoom);

        // Pinch center shift
        const currentMidX = (t1.clientX + t2.clientX) / 2;
        const currentMidY = (t1.clientY + t2.clientY) / 2;
        const startMidX = touchStateRef.current.startTouch2
          ? (touchStateRef.current.startTouch1.x + touchStateRef.current.startTouch2.x) / 2
          : touchStateRef.current.startTouch1.x;
        const startMidY = touchStateRef.current.startTouch2
          ? (touchStateRef.current.startTouch1.y + touchStateRef.current.startTouch2.y) / 2
          : touchStateRef.current.startTouch1.y;

        const dx = currentMidX - startMidX;
        const dy = currentMidY - startMidY;

        setPanOffset({
          x: touchStateRef.current.startPan.x + dx,
          y: touchStateRef.current.startPan.y + dy
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchStateRef.current.startDist = null;
        touchStateRef.current.isMultiTouch = false;
      } else if (e.touches.length === 1) {
        touchStateRef.current.isMultiTouch = false;
        touchStateRef.current.startPan = { ...panOffset };
        touchStateRef.current.startTouch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);
    viewport.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoomLevel, panOffset]);

  // Double click / tap to toggle zoom between 100% and 160%
  const handleDoubleClick = () => {
    if (zoomLevel === 100 && panOffset.x === 0 && panOffset.y === 0) {
      setZoomLevel(160);
    } else {
      resetView();
    }
  };

  const isTransformed = zoomLevel !== 100 || panOffset.x !== 0 || panOffset.y !== 0;

  return {
    viewportRef, zoomLevel, panOffset, isDragging, isTransformed, basePaperWidthPx,
    zoomBy, resetView, handleMouseDown, handleWheel, handleDoubleClick,
  };
}

export type PanZoomState = ReturnType<typeof usePanZoom>;
