import React, { useState, useEffect, useRef } from 'react';

export interface Point {
  x: number;
  y: number;
}

interface PerspectiveOverlayProps {
  imageSrc: string;
  corners: Point[];
  onChange: (newCorners: Point[]) => void;
  containerWidth: number;
  containerHeight: number;
  cropMode?: 'perspective' | 'rectangle';
}

export function PerspectiveOverlay({ imageSrc, corners, onChange, containerWidth, containerHeight, cropMode = 'perspective' }: PerspectiveOverlayProps) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [draggingAll, setDraggingAll] = useState<{ startX: number; startY: number; startCorners: Point[] } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageRect, setImageRect] = useState<{ width: number; height: number; x: number; y: number }>({ width: 0, height: 0, x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Calculate object-fit: contain dimensions
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;
      let w, h, x, y;
      
      if (imgAspect > containerAspect) {
        w = containerWidth;
        h = containerWidth / imgAspect;
        x = 0;
        y = (containerHeight - h) / 2;
      } else {
        h = containerHeight;
        w = containerHeight * imgAspect;
        y = 0;
        x = (containerWidth - w) / 2;
      }
      setImageRect({ width: w, height: h, x, y });
    };
  }, [imageSrc, containerWidth, containerHeight]);

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
  };

  const handlePolygonPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    setDraggingAll({
      startX: e.clientX,
      startY: e.clientY,
      startCorners: [...corners]
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if ((draggingIdx === null && draggingAll === null) || !containerRef.current || imageRect.width === 0) return;
    
    if (draggingAll) {
      const dx = (e.clientX - draggingAll.startX) / imageRect.width;
      const dy = (e.clientY - draggingAll.startY) / imageRect.height;

      // Constrain dragging bounds
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const c of draggingAll.startCorners) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      }

      const allowedDx = Math.max(-minX, Math.min(1 - maxX, dx));
      const allowedDy = Math.max(-minY, Math.min(1 - maxY, dy));

      const newCorners = draggingAll.startCorners.map(c => ({
        x: c.x + allowedDx,
        y: c.y + allowedDy
      }));

      onChange(newCorners);
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    // Raw coordinates relative to container
    let px = e.clientX - rect.left;
    let py = e.clientY - rect.top;

    // Constrain to image bounds
    px = Math.max(imageRect.x, Math.min(px, imageRect.x + imageRect.width));
    py = Math.max(imageRect.y, Math.min(py, imageRect.y + imageRect.height));

    // Convert to normalized [0,1] relative to the image itself
    const normX = (px - imageRect.x) / imageRect.width;
    const normY = (py - imageRect.y) / imageRect.height;

    const newCorners = [...corners];
    newCorners[draggingIdx] = { x: normX, y: normY };

    if (cropMode === 'rectangle') {
      if (draggingIdx === 0) { // TL
        newCorners[1].y = normY;
        newCorners[3].x = normX;
      } else if (draggingIdx === 1) { // TR
        newCorners[0].y = normY;
        newCorners[2].x = normX;
      } else if (draggingIdx === 2) { // BR
        newCorners[3].y = normY;
        newCorners[1].x = normX;
      } else if (draggingIdx === 3) { // BL
        newCorners[2].y = normY;
        newCorners[0].x = normX;
      }
    }

    onChange(newCorners);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIdx !== null) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err){}
      setDraggingIdx(null);
    }
    if (draggingAll !== null) {
      try { 
        if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
          containerRef.current.releasePointerCapture(e.pointerId);
        }
      } catch(err){}
      setDraggingAll(null);
    }
  };

  // Convert normalized corners [0,1] to actual pixels in the container
  const displayCorners = corners.map(c => ({
    x: imageRect.x + c.x * imageRect.width,
    y: imageRect.y + c.y * imageRect.height
  }));

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full select-none touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Background Image */}
      <div 
        className="absolute"
        style={{
          left: imageRect.x, top: imageRect.y, width: imageRect.width, height: imageRect.height,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.5
        }}
      />

      {/* Clipped Image (inside crop region) */}
      {imageRect.width > 0 && (
        <div 
          className="absolute"
          style={{
            left: imageRect.x, top: imageRect.y, width: imageRect.width, height: imageRect.height,
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            clipPath: `polygon(${corners.map(c => `${c.x * 100}% ${c.y * 100}%`).join(', ')})`
          }}
        />
      )}

      {/* Lines connecting corners and draggable area */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        {imageRect.width > 0 && (
          <polygon
            points={displayCorners.map(c => `${c.x},${c.y}`).join(' ')}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.8)"
            strokeWidth="2"
            strokeDasharray="4 4"
            style={{ pointerEvents: 'auto', cursor: 'move', touchAction: 'none' }}
            onPointerDown={handlePolygonPointerDown}
          />
        )}
      </svg>

      {/* Corner Handles */}
      {imageRect.width > 0 && displayCorners.map((c, i) => (
        <div
          key={i}
          onPointerDown={(e) => handlePointerDown(i, e)}
          className="absolute w-8 h-8 -ml-4 -mt-4 bg-white border-2 border-blue-500 rounded-full shadow-lg cursor-move flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
          style={{ left: c.x, top: c.y, touchAction: 'none' }}
        >
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        </div>
      ))}
    </div>
  );
}
