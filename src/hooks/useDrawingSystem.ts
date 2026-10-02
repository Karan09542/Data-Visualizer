import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAnnotationStore, Point, Annotation, DrawingTool } from '../store/useAnnotationStore';
import { detectShape } from '../utils/shapeDetection';
import { annotationsInRect } from '../utils/annotationSelection';

function simplifyPath(points: Point[], tolerance = 1): Point[] {
  if (points.length <= 2) return points;
  // basic Douglas-Peucker simplification could go here, 
  // but for simplicity we can just filter points that are too close
  const result = [points[0]];
  let lastPoint = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const dx = pt.x - lastPoint.x;
    const dy = pt.y - lastPoint.y;
    if (dx * dx + dy * dy > tolerance * tolerance) {
      result.push(pt);
      lastPoint = pt;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

export function useDrawingSystem(
  wrapperRef: React.RefObject<HTMLElement | null>,
  isReactFlow: boolean = false,
  reactFlowViewportRef?: React.RefObject<{ x: number; y: number; zoom: number } | null>
) {
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);


  const isDrawing = useRef(false);
  const currentAnnotationId = useRef<string | null>(null);
  const currentPoints = useRef<Point[]>([]);
  /**
   * A Box select gesture: dragging out a box (`base` is the selection kept from before, with
   * Shift), or moving the selected annotations together.
   */
  const boxGesture = useRef<
    | { mode: 'box'; origin: Point; base: string[] }
    | { mode: 'move'; last: Point; moved: boolean }
    | null
  >(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const getGraphPos = (e: PointerEvent): Point => {
      // Get pointer position relative to wrapper
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (isReactFlow && reactFlowViewportRef?.current) {
        const vp = reactFlowViewportRef.current;
        return {
          x: (px - vp.x) / vp.zoom,
          y: (py - vp.y) / vp.zoom
        };
      }

      // Apply inverse D3 transform
      const transform = d3.zoomTransform(el);
      return {
        x: (px - transform.x) / transform.k,
        y: (py - transform.y) / transform.k
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const state = useAnnotationStore.getState();
      const el = wrapperRef.current;
      if (!el || e.button !== 0) return;

      // If toolbar is hidden and user is NOT holding Ctrl, only allow 'select' tool
      if (!state.isToolbarVisible && !e.ctrlKey && state.activeTool !== 'select') {
        return;
      }

      // Controls floating on the canvas (marked data-canvas-ui) are not the canvas. This listener is
      // native, so it runs before React's: a React stopPropagation there can't keep it out.
      if ((e.target as Element).closest?.('[data-canvas-ui]')) return;

      const pt = getGraphPos(e);

      if (state.activeTool === 'box-select') {
        const target = e.target as Element;
        // The selection's handles (one shape's TransformBox, or the group box) run their own
        // drags, started from mousedown: preventDefault below would suppress that mousedown.
        if (target.closest?.('.transform-box')) return;

        // The canvas is locked for this tool (see the visualizers), so every drag selects or moves.
        e.preventDefault();
        const hitId = target.closest?.('[data-anno-id]')?.getAttribute('data-anno-id') ?? null;
        const selected = state.selectedAnnotationIds;

        if (hitId && e.shiftKey) {
          // Shift-tap adds or removes one annotation.
          state.setSelectedAnnotations(selected.includes(hitId) ? selected.filter(id => id !== hitId) : [...selected, hitId]);
          return;
        }
        if (hitId) {
          // On a shape outside the selection's box: select it and move it straight away.
          if (!selected.includes(hitId)) state.setSelectedAnnotations([hitId]);
          boxGesture.current = { mode: 'move', last: pt, moved: false };
          return;
        }
        // On empty canvas: drag out a box. Shift keeps what is already selected.
        const base = e.shiftKey ? selected : [];
        if (!e.shiftKey) state.setSelectedAnnotations([]);
        boxGesture.current = { mode: 'box', origin: pt, base };
        state.setSelectionRect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
        return;
      }

      if (state.activeTool === 'select') {
        const target = e.target as SVGElement;
        const idMatch = target.id?.match(/^anno-(.+)$/);
        const isTransformBox = target.closest('.transform-box');

        if (idMatch || isTransformBox) {
          if (idMatch) {
            const id = idMatch[1];
            // Start dragging the annotation
            isDrawing.current = true;
            currentAnnotationId.current = id;
            currentPoints.current = [pt]; // Store starting drag point
            if (!state.selectedAnnotationIds.includes(id)) {
              state.setSelectedAnnotations([id]);
            }
          }
          e.stopPropagation(); // prevent background click
        } else {
          // Click on background, maybe clear selection
          state.setSelectedAnnotations([]);
        }
        return;
      }

      if (state.activeTool === 'eraser') {
        const target = e.target as SVGElement;
        const idMatch = target.id?.match(/^anno-(.+)$/);
        if (idMatch) {
          useAnnotationStore.getState().removeAnnotations([idMatch[1]]);
          useAnnotationStore.getState().commitAction();
        }
        return;
      }

      isDrawing.current = true;
      e.preventDefault();

      currentPoints.current = [pt];
      const id = 'anno_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      currentAnnotationId.current = id;

      const newAnno: Annotation = {
        id,
        tool: state.activeTool,
        brushStyle: state.brushStyle,
        color: state.color,
        width: state.width,
        opacity: state.opacity,
        glowIntensity: state.glowIntensity,
        smoothing: state.smoothing,
        points: currentPoints.current,
        blinkDuration: state.blinkDuration,
        blinkFrequency: state.blinkFrequency,
        fadeOutDuration: state.fadeOutDuration,
        fadeEasing: state.fadeEasing,
        autoRemove: state.autoRemove,
        isHighlighter: state.activeTool === 'highlighter',
        createdAt: Date.now(),
        waveAmplitude: state.waveAmplitude,
        waveLength: state.waveLength,
        polygonSides: state.polygonSides,
        fillEnabled: state.fillEnabled,
        fillOpacity: state.fillOpacity,
        fillColor: state.fillColor,
        functionExpression: state.functionExpression,
        functionAmplitude: state.functionAmplitude,
        functionFrequency: state.functionFrequency,
        functionPhase: state.functionPhase,
        functionSmoothness: state.functionSmoothness,
        arrowTipStyle: state.arrowTipStyle,
        arrowTipSize: state.arrowTipSize,
        arrowLineStyle: state.arrowLineStyle,
        customArrowLineEquation: state.customArrowLineEquation,
        customArrowTipEquation: state.customArrowTipEquation,
      };

      addAnnotation(newAnno);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;

      const gesture = boxGesture.current;
      if (gesture) {
        const state = useAnnotationStore.getState();
        const pt = getGraphPos(e);
        if (gesture.mode === 'box') {
          const rect = { x1: gesture.origin.x, y1: gesture.origin.y, x2: pt.x, y2: pt.y };
          state.setSelectionRect(rect);
          // Select live, so the user sees what the box will take before letting go.
          const ids = [...new Set([...gesture.base, ...annotationsInRect(state.annotations, rect)])];
          const current = state.selectedAnnotationIds;
          if (ids.length !== current.length || ids.some(id => !current.includes(id))) state.setSelectedAnnotations(ids);
        } else {
          const dx = pt.x - gesture.last.x;
          const dy = pt.y - gesture.last.y;
          if (dx !== 0 || dy !== 0) {
            state.moveAnnotations(state.selectedAnnotationIds, dx, dy);
            gesture.last = pt;
            gesture.moved = true;
          }
        }
        return;
      }

      if (!isDrawing.current || !currentAnnotationId.current) return;

      const state = useAnnotationStore.getState();
      let pt = getGraphPos(e);

      if (state.activeTool === 'select' && currentAnnotationId.current) {
        // Dragging existing annotation
        const startPt = currentPoints.current[0];
        const dx = pt.x - startPt.x;
        const dy = pt.y - startPt.y;

        const anno = state.annotations.find(a => a.id === currentAnnotationId.current);
        if (anno) {
          const newPoints = anno.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
          updateAnnotation(anno.id, { points: newPoints });
        }
        currentPoints.current = [pt]; // Reset drag start
        return;
      }

      // Shift constraints logic
      if (e.shiftKey && currentPoints.current.length > 0) {
        const startPt = currentPoints.current[0];
        const dx = pt.x - startPt.x;
        const dy = pt.y - startPt.y;
        const angle = Math.atan2(dy, dx);

        // Snap to nearest 45 degrees (PI / 4)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);

        pt = {
          x: startPt.x + Math.cos(snapAngle) * dist,
          y: startPt.y + Math.sin(snapAngle) * dist
        };
      }

      currentPoints.current.push(pt);

      if (currentPoints.current.length % 2 === 0) {
        updateAnnotation(currentAnnotationId.current, {
          points: [...currentPoints.current]
        });
      }
    };

    // Highlighter strokes with a stay time get a fade deadline; the store fades and removes them
    const getFadeAt = (state: { activeTool: DrawingTool; blinkDuration: number }) =>
      state.activeTool === 'highlighter' && state.blinkDuration > 0
        ? { fadeAt: Date.now() + state.blinkDuration * 1000 }
        : {};

    const handlePointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;

      const gesture = boxGesture.current;
      if (gesture) {
        boxGesture.current = null;
        if (gesture.mode === 'box') {
          // A tap without a drag selects what is under it: the box test already did that.
          useAnnotationStore.getState().setSelectionRect(null);
        } else if (gesture.moved) {
          useAnnotationStore.getState().commitAction();
        }
        return;
      }

      if (!isDrawing.current) return;
      isDrawing.current = false;

      if (currentAnnotationId.current) {
        // Finalize drawing
        const state = useAnnotationStore.getState();

        if (state.activeTool === 'select') {
          // Finished dragging
          currentAnnotationId.current = null;
          useAnnotationStore.getState().commitAction();
          return;
        }

        let pts = simplifyPath(currentPoints.current, state.smoothing * 10);
        let finalTool: DrawingTool = state.activeTool;
        let finalPoints = pts;

        if (state.autoShapeDetection && (state.activeTool === 'pen' || state.activeTool === 'highlighter') && currentPoints.current.length > 5) {
          const detected = detectShape(currentPoints.current);
          if (detected.type !== 'none' && detected.confidence >= 0.65) {

            if (detected.pathPoints) {
              const startPoints = [...currentPoints.current];
              const targetPoints = detected.pathPoints;
              const targetTool = detected.type as DrawingTool;
              const annId = currentAnnotationId.current;

              const duration = 250; // ms
              const startTime = performance.now();

              const ease = (t: number) => 1 - Math.pow(1 - t, 3);

              const animate = (time: number) => {
                let t = (time - startTime) / duration;
                if (t > 1) t = 1;
                t = ease(t);

                const currentPts = startPoints.map((sp, i) => {
                  const tp = targetPoints[i] || targetPoints[targetPoints.length - 1];
                  return {
                    x: sp.x + (tp.x - sp.x) * t,
                    y: sp.y + (tp.y - sp.y) * t
                  };
                });

                useAnnotationStore.getState().updateAnnotation(annId, {
                  points: currentPts,
                });

                if (t < 1) {
                  requestAnimationFrame(animate);
                } else {
                  useAnnotationStore.getState().updateAnnotation(annId, {
                    points: detected.points,
                    tool: targetTool,
                    isFading: false,
                    ...getFadeAt(state)
                  });
                  useAnnotationStore.getState().commitAction();
                }
              };
              requestAnimationFrame(animate);
              currentAnnotationId.current = null;
              return; // Skip normal finalize
            } else {
              // No pathPoints to morph, just snap instantly
              finalTool = detected.type as DrawingTool;
              finalPoints = detected.points;
            }
          }
        }

        updateAnnotation(currentAnnotationId.current, {
          points: finalPoints,
          tool: finalTool,
          isFading: false,
          ...getFadeAt(state)
        });

        useAnnotationStore.getState().commitAction();

        currentAnnotationId.current = null;
      }
    };

    const handleCancelDrawing = () => {
      if (isDrawing.current && currentAnnotationId.current) {
        useAnnotationStore.getState().removeAnnotations([currentAnnotationId.current]);
      }
      isDrawing.current = false;
      currentAnnotationId.current = null;
      if (boxGesture.current?.mode === 'box') useAnnotationStore.getState().setSelectionRect(null);
      boxGesture.current = null;
    };

    const handleDrawingKeyDown = (e: KeyboardEvent) => {
      const state = useAnnotationStore.getState();
      // Esc with Box select: drop the selection (and any box being dragged).
      if (e.key === 'Escape' && state.activeTool === 'box-select' && (state.selectedAnnotationIds.length > 0 || boxGesture.current)) {
        boxGesture.current = null;
        state.setSelectionRect(null);
        state.setSelectedAnnotations([]);
        return;
      }

      if (isDrawing.current && currentAnnotationId.current && e.key === 'Tab') {
        e.preventDefault();
        const state = useAnnotationStore.getState();
        const anno = state.annotations.find(a => a.id === currentAnnotationId.current);
        if (anno) {
          if (['triangle', 'rectangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon'].includes(anno.tool)) {
            let currentSides = 3;
            if (anno.tool === 'triangle') currentSides = 3;
            else if (anno.tool === 'rectangle') currentSides = 4;
            else if (anno.tool === 'pentagon') currentSides = 5;
            else if (anno.tool === 'hexagon') currentSides = 6;
            else if (anno.tool === 'heptagon') currentSides = 7;
            else if (anno.tool === 'octagon') currentSides = 8;
            else if (anno.tool === 'polygon') currentSides = anno.polygonSides || 9;

            let nextSides = currentSides + (e.shiftKey ? -1 : 1);
            if (nextSides < 3) nextSides = 3;

            let newTool: import('../store/useAnnotationStore').DrawingTool = 'polygon';
            if (nextSides === 3) newTool = 'triangle';
            else if (nextSides === 4) newTool = 'rectangle';
            else if (nextSides === 5) newTool = 'pentagon';
            else if (nextSides === 6) newTool = 'hexagon';
            else if (nextSides === 7) newTool = 'heptagon';
            else if (nextSides === 8) newTool = 'octagon';

            state.setActiveTool(newTool); // Updates UI toolbar
            state.setPolygonSides(nextSides); // Keep setting synced
            updateAnnotation(currentAnnotationId.current, { tool: newTool, polygonSides: nextSides }); // Updates active drawing
          }
        }
      }
    };

    el.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    // Capture phase + pointercancel so a stroke is always finalized, even if the canvas
    // stops the event or the browser cancels the pointer
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerUp, true);
    window.addEventListener('cancel-drawing', handleCancelDrawing);
    window.addEventListener('keydown', handleDrawingKeyDown);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerUp, true);
      window.removeEventListener('cancel-drawing', handleCancelDrawing);
      window.removeEventListener('keydown', handleDrawingKeyDown);
    };
  }, [addAnnotation, updateAnnotation, isReactFlow, reactFlowViewportRef]);
}
