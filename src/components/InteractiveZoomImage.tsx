import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface InteractiveZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  rotation?: number;
}

export function InteractiveZoomImage({ src, alt, className = "", rotation = 0 }: InteractiveZoomImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef(0);
  const touchStartScaleRef = useRef(1);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // Reset zoom on src change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  // Handle Ctrl + Mouse Wheel & Trackpad Pinch
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Pinches on trackpad and Ctrl + Mouse Wheel show ctrlKey = true
      if (e.ctrlKey || Math.abs(e.deltaY) < 50) {
        e.preventDefault();
        const zoomFactor = 0.08;
        // Scroll up to zoom in, scroll down to zoom out
        const factor = e.deltaY < 0 ? 1 + zoomFactor : 1 - zoomFactor;
        setScale((prev) => {
          const next = Math.max(1, Math.min(6, prev * factor));
          if (next === 1) {
            setPosition({ x: 0, y: 0 });
          }
          return next;
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Desktop Mouse Drag/Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1) return;
    const nextX = e.clientX - dragStartRef.current.x;
    const nextY = e.clientY - dragStartRef.current.y;
    setPosition(boundPosition(nextX, nextY));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Mobile Touch Gestures
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Pinch Gestures
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
      lastPositionRef.current = { ...position };
    } else if (e.touches.length === 1) {
      // Pan/Drag
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      // Handle Zoom In / Out
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      const nextScale = Math.max(1, Math.min(6, touchStartScaleRef.current * factor));
      setScale(nextScale);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Drag & Pan while zoomed
      const nextX = e.touches[0].clientX - dragStartRef.current.x;
      const nextY = e.touches[0].clientY - dragStartRef.current.y;
      setPosition(boundPosition(nextX, nextY));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = 0;
    }
    setIsDragging(false);

    // Double Tap detection
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault();
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2.5);
        setPosition({ x: 0, y: 0 }); // center zoom
      }
    }
    lastTapRef.current = now;
  };

  // Helper to bound translation within container overflow limits
  const boundPosition = (x: number, y: number) => {
    if (!containerRef.current) return { x, y };
    const rect = containerRef.current.getBoundingClientRect();
    
    // Limits of pan are proportional to image zoom overflow size
    const limitX = (scale - 1) * (rect.width / 2);
    const limitY = (scale - 1) * (rect.height / 2);

    return {
      x: Math.max(-limitX, Math.min(limitX, x)),
      y: Math.max(-limitY, Math.min(limitY, y)),
    };
  };

  const incrementZoom = () => {
    setScale((prev) => {
      const next = Math.min(6, prev * 1.5);
      return next;
    });
  };

  const decrementZoom = () => {
    setScale((prev) => {
      const next = Math.max(1, prev / 1.5);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-100 dark:bg-black/20 rounded-2xl flex items-center justify-center
        ${scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}
      `}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        draggable={false}
        className={`max-w-full max-h-full object-contain shadow-md transition-transform duration-75 ease-out select-none pointer-events-none ${className}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      />

      {/* Floating control buttons */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 text-white z-20">
        <button 
          onClick={decrementZoom} 
          disabled={scale === 1}
          className="p-1 hover:text-blue-400 active:scale-95 disabled:opacity-40 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <div className="text-[10px] font-mono font-bold w-10 text-center text-slate-300">
          {Math.round(scale * 100)}%
        </div>
        <button 
          onClick={incrementZoom} 
          disabled={scale >= 6}
          className="p-1 hover:text-blue-400 active:scale-95 disabled:opacity-40 transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        {scale > 1 && (
          <button 
            onClick={resetZoom} 
            className="p-1 border-l border-white/20 pl-2 hover:text-rose-450 active:scale-95 transition-colors"
            title="Reset Zoom"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {scale > 1 && (
        <span className="absolute top-3 left-3 bg-blue-500/80 backdrop-blur-md text-[10px] text-white font-bold px-2 py-0.5 rounded-full animate-pulse z-25 pointer-events-none">
          Panned / Zoomed
        </span>
      )}
    </div>
  );
}
