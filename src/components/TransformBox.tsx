import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { Annotation, useAnnotationStore } from '../store/useAnnotationStore';

export function getAnnotationBounds(anno: Annotation) {
  if (anno.points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, cx: 0, cy: 0, w: 0, h: 0 };
  const xs = anno.points.map(p => p.x);
  const ys = anno.points.map(p => p.y);
  
  const pad = anno.width ? anno.width / 2 : 5;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;

  return { 
    minX, maxX, minY, maxY, 
    cx: (minX + maxX)/2, 
    cy: (minY + maxY)/2,
    w: maxX - minX,
    h: maxY - minY
  };
}

export const TransformBox = ({ anno, onOpenContextMenu, onInteractionStart }: { anno: Annotation; onOpenContextMenu?: (x: number, y: number) => void; onInteractionStart?: () => void }) => {
  const gRef = useRef<SVGGElement>(null);
  const [tooltipAngle, setTooltipAngle] = useState<number | null>(null);
  const [resizingSize, setResizingSize] = useState<{ w: number, h: number } | null>(null);
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation);
  const commitAction = useAnnotationStore(s => s.commitAction);

  const b = getAnnotationBounds(anno);
  const cx = anno.centerX ?? b.cx;
  const cy = anno.centerY ?? b.cy;
  
  const tx = anno.translateX ?? 0;
  const ty = anno.translateY ?? 0;
  const rot = anno.rotation ?? 0;
  const sx = anno.scaleX ?? 1;
  const sy = anno.scaleY ?? 1;

  const w = b.w * sx;
  const h = b.h * sy;

  const handleSize = 8;
  const rotateHandleDist = 30;

  const [toggleOffset, setToggleOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (gRef.current) {
      const boxRect = gRef.current.getBoundingClientRect();
      
      let nx = Math.abs(w) / 2 + handleSize + 20;
      let ny = -Math.abs(h) / 2 - handleSize - 20;

      if (boxRect.right > window.innerWidth - 60) {
        nx = -Math.abs(w) / 2 - handleSize - 20;
      }
      if (boxRect.left < 60 && boxRect.right > window.innerWidth - 60) {
         // if it's very large, just put it inside
         nx = Math.abs(w) / 2 - 20;
      }

      if (boxRect.top < 60) {
        ny = Math.abs(h) / 2 + handleSize + 20;
      }
      if (boxRect.top < 60 && boxRect.bottom > window.innerHeight - 60) {
        // if very large height, put it inside
        ny = Math.abs(h) / 2 - 20;
      }

      setToggleOffset({ x: nx, y: ny });
    }
  }, [w, h, cx, cy, tx, ty, rot, sx, sy]);

  const annoRef = useRef(anno);
  useEffect(() => {
    annoRef.current = anno;
  }, [anno]);

  useEffect(() => {
    if (!gRef.current) return;
    
    const g = d3.select(gRef.current);
    const parent = gRef.current.parentNode as Element;
    if (!parent) return;

    // Stop propagation and prevent default for touch/mouse events on the transform box 
    // to prevent global gestures and browser context menus
    g.on('touchstart mousedown', (e) => {
      e.stopPropagation();
    });

    g.on('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onOpenContextMenu) {
        onOpenContextMenu(e.clientX, e.clientY);
      }
    });

    // 1. Drag to translate
    let dragStartTx = 0;
    let dragStartTy = 0;
    let dragStartPointer: [number, number] = [0, 0];

    const dragBox = d3.drag<SVGRectElement, unknown>()
      .on('start', (e) => {
        e.sourceEvent?.stopPropagation();
        onInteractionStart?.();
        const currentAnno = annoRef.current;
        dragStartTx = currentAnno.translateX ?? 0;
        dragStartTy = currentAnno.translateY ?? 0;
        dragStartPointer = d3.pointer(e, parent);
      })
      .on('drag', (e) => {
        const currentAnno = annoRef.current;
        const currentPointer = d3.pointer(e, parent);
        
        const dx = currentPointer[0] - dragStartPointer[0];
        const dy = currentPointer[1] - dragStartPointer[1];
        
        updateAnnotation(currentAnno.id, { 
          translateX: dragStartTx + dx, 
          translateY: dragStartTy + dy, 
          centerX: cx, 
          centerY: cy 
        });
      })
      .on('end', () => { commitAction(); });
      
    g.select<SVGRectElement>('.tb-bg').call(dragBox);

    // 2. Drag to rotate
    let initialAngle = 0;
    let dragStartRot = 0;
    const dragRotate = d3.drag<SVGCircleElement, unknown>()
      .on('start', (e) => {
        e.sourceEvent?.stopPropagation();
        onInteractionStart?.();
        const currentAnno = annoRef.current;
        dragStartRot = currentAnno.rotation ?? 0;
        
        const [px, py] = d3.pointer(e, parent);
        const globalCx = cx + (currentAnno.translateX ?? 0);
        const globalCy = cy + (currentAnno.translateY ?? 0);
        
        initialAngle = Math.atan2(py - globalCy, px - globalCx) * 180 / Math.PI;
        setTooltipAngle(((dragStartRot % 360) + 360) % 360);
      })
      .on('drag', (e) => {
        const currentAnno = annoRef.current;
        const [px, py] = d3.pointer(e, parent);
        
        const globalCx = cx + (currentAnno.translateX ?? 0);
        const globalCy = cy + (currentAnno.translateY ?? 0);
        
        const currentAngle = Math.atan2(py - globalCy, px - globalCx) * 180 / Math.PI;
        
        let delta = currentAngle - initialAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        let finalRot = dragStartRot + delta;
        if (e.sourceEvent?.shiftKey) {
          finalRot = Math.round(finalRot / 90) * 90;
        }

        const displayAngle = ((finalRot % 360) + 360) % 360;
        setTooltipAngle(Math.round(displayAngle));
        updateAnnotation(currentAnno.id, { rotation: finalRot, centerX: cx, centerY: cy });
      })
      .on('end', () => { 
        setTooltipAngle(null);
        commitAction(); 
      });

    g.select<SVGCircleElement>('.tb-rotate').call(dragRotate);

    // 3. Scale draggers
    const createDragger = (selector: string, xDir: number, yDir: number) => {
      let startSx = 1;
      let startSy = 1;
      let startPointer: [number, number] = [0, 0];

      g.select<SVGRectElement>(selector).call(
        d3.drag<SVGRectElement, unknown>()
          .on('start', (e) => {
            e.sourceEvent?.stopPropagation();
            onInteractionStart?.();
            startSx = annoRef.current.scaleX ?? 1;
            startSy = annoRef.current.scaleY ?? 1;
            startPointer = d3.pointer(e, parent);
          })
          .on('drag', (e) => {
        const currentAnno = annoRef.current;
        const currentPointer = d3.pointer(e, parent);
        
        // Mouse diff in graph space
        const dx = currentPointer[0] - startPointer[0];
        const dy = currentPointer[1] - startPointer[1];
        
        // Project diff into local rotated space
        const rad = (currentAnno.rotation ?? 0) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // Local diff (relative to the box rotation)
        const localDx = dx * cos + dy * sin;
        const localDy = -dx * sin + dy * cos;
        
        // Scale change (grow from center means * 2)
        let dsx = xDir !== 0 ? (xDir * localDx * 2) / Math.max(1, b.w) : 0;
        let dsy = yDir !== 0 ? (yDir * localDy * 2) / Math.max(1, b.h) : 0;
        
        if (e.sourceEvent?.shiftKey && xDir !== 0 && yDir !== 0) {
          const factorX = Math.abs(dsx);
          const factorY = Math.abs(dsy);
          if (factorX > factorY) {
            dsy = (dsx * startSy) / startSx;
          } else {
            dsx = (dsy * startSx) / startSy;
          }
        }
        
        const nextSx = startSx + dsx;
        const nextSy = startSy + dsy;

        setResizingSize({ 
          w: Math.abs(b.w * nextSx), 
          h: Math.abs(b.h * nextSy) 
        });

        updateAnnotation(currentAnno.id, { 
          scaleX: nextSx, 
          scaleY: nextSy, 
          centerX: cx, 
          centerY: cy 
        });
      })
      .on('end', () => { 
        setResizingSize(null);
        commitAction(); 
      })
      );
    };

    createDragger('.tb-handle-tl', -1, -1);
    createDragger('.tb-handle-tr', 1, -1);
    createDragger('.tb-handle-bl', -1, 1);
    createDragger('.tb-handle-br', 1, 1);
    createDragger('.tb-handle-t', 0, -1);
    createDragger('.tb-handle-b', 0, 1);
    createDragger('.tb-handle-l', -1, 0);
    createDragger('.tb-handle-r', 1, 0);

  }, [anno.id, cx, cy, b.w, b.h, updateAnnotation, commitAction]);

  return (
    <g 
      ref={gRef}
      className="transform-box pointer-events-auto"
      transform={`translate(${cx + tx}, ${cy + ty}) rotate(${rot})`}
    >
      {/* Box */}
      <rect 
        className="tb-bg pointer-events-auto"
        x={-Math.abs(w)/2} y={-Math.abs(h)/2} width={Math.abs(w)} height={Math.abs(h)}
        fill="transparent"
        stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4"
        style={{ cursor: 'move' }}
      />
      {/* Rotation line */}
      <line x1={0} y1={-Math.abs(h)/2} x2={0} y2={-Math.abs(h)/2 - rotateHandleDist} stroke="#3b82f6" strokeWidth={1} />
      {/* Rotation handle */}
      <circle 
        className="tb-rotate pointer-events-auto"
        cx={0} cy={-Math.abs(h)/2 - rotateHandleDist} r={5}
        fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5}
        style={{ cursor: 'grab' }}
      />

      {tooltipAngle !== null && (
        <g transform={`translate(0, ${-Math.abs(h)/2 - rotateHandleDist - 40})`}>
          <rect x="-35" y="-20" width="70" height="32" rx="6" fill="#1e293b" />
          <text 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="white" 
            fontSize="18" 
            fontWeight="bold"
            pointerEvents="none"
          >
            {tooltipAngle}°
          </text>
        </g>
      )}

      {resizingSize && (
        <g transform={`translate(0, ${Math.abs(h)/2 + 40})`}>
          <rect x="-65" y="-20" width="130" height="32" rx="6" fill="#1e293b" />
          <text 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="white" 
            fontSize="16" 
            fontWeight="bold"
            pointerEvents="none"
          >
            {Math.round(resizingSize.w)} × {Math.round(resizingSize.h)} px
          </text>
        </g>
      )}
      
      {/* Scale Handles */}
      <rect className="tb-handle-tl pointer-events-auto" x={-w/2 - handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'nwse-resize' }} />
      <rect className="tb-handle-tr pointer-events-auto" x={w/2 - handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'nesw-resize' }} />
      <rect className="tb-handle-bl pointer-events-auto" x={-w/2 - handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'nesw-resize' }} />
      <rect className="tb-handle-br pointer-events-auto" x={w/2 - handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'nwse-resize' }} />
      
      {/* Edge Handles */}
      <rect className="tb-handle-t pointer-events-auto" x={-handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'ns-resize' }} />
      <rect className="tb-handle-b pointer-events-auto" x={-handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'ns-resize' }} />
      <rect className="tb-handle-l pointer-events-auto" x={-w/2 - handleSize/2} y={-handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'ew-resize' }} />
      <rect className="tb-handle-r pointer-events-auto" x={w/2 - handleSize/2} y={-handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} style={{ cursor: 'ew-resize' }} />

      {/* Mobile Menu Toggle (Three dots) */}
      <g 
        className="tb-menu-toggle pointer-events-auto group"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenContextMenu) {
            onOpenContextMenu(e.clientX, e.clientY);
          }
        }}
        transform={`translate(${toggleOffset.x || Math.abs(w)/2 + handleSize + 20}, ${toggleOffset.y || -Math.abs(h)/2 - handleSize - 20})`}
      >
        <rect x="-16" y="-12" width="32" height="24" rx="6" className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-700 transition-colors group-hover:stroke-blue-400 dark:group-hover:stroke-slate-500" strokeWidth="1" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
        <circle cx="-6" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500 dark:group-hover:fill-slate-200 transition-colors" />
        <circle cx="0" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500 dark:group-hover:fill-slate-200 transition-colors" />
        <circle cx="6" cy="0" r="1.5" className="fill-slate-500 dark:fill-slate-400 group-hover:fill-blue-500 dark:group-hover:fill-slate-200 transition-colors" />
      </g>
    </g>
  );
}

