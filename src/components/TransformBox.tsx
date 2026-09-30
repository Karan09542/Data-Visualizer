import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { Annotation, useAnnotationStore } from '../store/useAnnotationStore';

const WAVE_TOOLS = ['sine-wave', 'square-wave', 'triangle-wave', 'sawtooth-wave', 'pulse-wave', 'zigzag-wave'];
// Shapes drawn from the first and last point only; the points in between are just the drag trail
const TWO_POINT_TOOLS = ['straight-line', 'rectangle', 'rounded-rectangle', 'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon', 'star', 'diamond'];

// Bounds of the shape as it is actually drawn (see the path builders in AnnotationRenderer),
// which for most tools is not the bounds of the raw pointer points.
export function getAnnotationBounds(anno: Annotation) {
  if (anno.points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, cx: 0, cy: 0, w: 0, h: 0 };

  const p1 = anno.points[0];
  const p2 = anno.points[anno.points.length - 1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let pad = anno.width ? anno.width / 2 : 5;
  let box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const boxOf = (pts: { x: number; y: number }[]) => {
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };

  if (anno.tool === 'circle' || anno.tool === 'ellipse') {
    // Drawn around the first point
    const r = Math.sqrt(dx * dx + dy * dy);
    const rx = anno.tool === 'ellipse' ? Math.abs(dx) : r;
    const ry = anno.tool === 'ellipse' ? Math.abs(dy) : r;
    box = { minX: p1.x - rx, maxX: p1.x + rx, minY: p1.y - ry, maxY: p1.y + ry };
  } else if (anno.tool === 'square') {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    box = { minX: x, maxX: x + size, minY: y, maxY: y + size };
  } else if (WAVE_TOOLS.includes(anno.tool)) {
    // The wave swings +/- amplitude perpendicular to the line between the two points
    const amp = anno.waveAmplitude || 20;
    const angle = Math.atan2(dy, dx);
    const nx = -Math.sin(angle) * amp;
    const ny = Math.cos(angle) * amp;
    box = boxOf([
      { x: p1.x + nx, y: p1.y + ny }, { x: p1.x - nx, y: p1.y - ny },
      { x: p2.x + nx, y: p2.y + ny }, { x: p2.x - nx, y: p2.y - ny },
    ]);
  } else if (anno.tool === 'arrow') {
    box = boxOf([p1, p2]);
    const tipStyle = anno.arrowTipStyle || 'triangle';
    const tipSize = anno.arrowTipSize || 15;
    const tipPad = tipStyle === 'none' ? 0 : tipStyle === 'custom-math' ? tipSize : tipSize / 2;
    const linePad = anno.arrowLineStyle === 'curly' || anno.arrowLineStyle === 'custom-math' ? 10 : 0;
    pad = Math.max(pad, tipPad, linePad);
  } else if (anno.tool === 'function-brush') {
    // Generated from an expression: measure the rendered path, fall back to the stroke +/- amplitude
    box = boxOf(anno.points);
    const el = typeof document !== 'undefined' ? document.getElementById(`anno-${anno.id}`) : null;
    let measured = false;
    if (el && 'getBBox' in el) {
      try {
        const bb = (el as unknown as SVGGraphicsElement).getBBox();
        if (bb.width > 0 || bb.height > 0) {
          box = { minX: bb.x, maxX: bb.x + bb.width, minY: bb.y, maxY: bb.y + bb.height };
          measured = true;
        }
      } catch (e) {}
    }
    if (!measured) pad += anno.functionAmplitude ?? 20;
  } else if (TWO_POINT_TOOLS.includes(anno.tool)) {
    box = boxOf([p1, p2]);
  } else {
    box = boxOf(anno.points);
  }

  const minX = box.minX - pad;
  const maxX = box.maxX + pad;
  const minY = box.minY - pad;
  const maxY = box.maxY + pad;

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

  // The shape is transformed around (cx, cy), which may be a pivot saved from older bounds.
  // Offset the box so it stays on the shape when the pivot is not the bounds' center.
  const ox = (b.cx - cx) * sx;
  const oy = (b.cy - cy) * sy;

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
    const dragRotate = d3.drag<SVGGElement, unknown>()
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
      .on('drag.rotate-end', () => { // Using specific namespace just in case
      })
      .on('end', () => { 
        setTooltipAngle(null);
        commitAction(); 
      });

    g.select<SVGGElement>('.tb-rotate').call(dragRotate);

    // 3. Scale draggers
    const createDragger = (selector: string, xDir: number, yDir: number) => {
      let startSx = 1;
      let startSy = 1;
      let startPointer: [number, number] = [0, 0];

      g.select<SVGGElement>(selector).call(
        d3.drag<SVGGElement, unknown>()
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
      transform={`translate(${cx + tx}, ${cy + ty}) rotate(${rot}) translate(${ox}, ${oy})`}
    >
      {/* Box */}
      <rect 
        className="tb-bg pointer-events-auto"
        x={-Math.abs(w)/2} y={-Math.abs(h)/2} width={Math.abs(w)} height={Math.abs(h)}
        fill="transparent"
        stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4"
        style={{ cursor: 'move', touchAction: 'none' }}
      />
      {/* Rotation line */}
      <line x1={0} y1={-Math.abs(h)/2} x2={0} y2={-Math.abs(h)/2 - rotateHandleDist} stroke="#3b82f6" strokeWidth={1} />
      {/* Rotation handle */}
      <g className="tb-rotate pointer-events-auto" style={{ cursor: 'grab', touchAction: 'none' }}>
        <circle cx={0} cy={-Math.abs(h)/2 - rotateHandleDist} r={15} fill="transparent" />
        <circle cx={0} cy={-Math.abs(h)/2 - rotateHandleDist} r={5} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>

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
      <g className="tb-handle-tl pointer-events-auto" style={{ cursor: 'nwse-resize', touchAction: 'none' }}>
        <rect x={-w/2 - 12} y={-h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={-w/2 - handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-tr pointer-events-auto" style={{ cursor: 'nesw-resize', touchAction: 'none' }}>
        <rect x={w/2 - 12} y={-h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={w/2 - handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-bl pointer-events-auto" style={{ cursor: 'nesw-resize', touchAction: 'none' }}>
        <rect x={-w/2 - 12} y={h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={-w/2 - handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-br pointer-events-auto" style={{ cursor: 'nwse-resize', touchAction: 'none' }}>
        <rect x={w/2 - 12} y={h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={w/2 - handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      
      {/* Edge Handles */}
      <g className="tb-handle-t pointer-events-auto" style={{ cursor: 'ns-resize', touchAction: 'none' }}>
        <rect x={-12} y={-h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={-handleSize/2} y={-h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-b pointer-events-auto" style={{ cursor: 'ns-resize', touchAction: 'none' }}>
        <rect x={-12} y={h/2 - 12} width={24} height={24} fill="transparent" />
        <rect x={-handleSize/2} y={h/2 - handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-l pointer-events-auto" style={{ cursor: 'ew-resize', touchAction: 'none' }}>
        <rect x={-w/2 - 12} y={-12} width={24} height={24} fill="transparent" />
        <rect x={-w/2 - handleSize/2} y={-handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>
      <g className="tb-handle-r pointer-events-auto" style={{ cursor: 'ew-resize', touchAction: 'none' }}>
        <rect x={w/2 - 12} y={-12} width={24} height={24} fill="transparent" />
        <rect x={w/2 - handleSize/2} y={-handleSize/2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5} />
      </g>

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

