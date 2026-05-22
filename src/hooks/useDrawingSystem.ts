import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnnotationStore, Point, Annotation, DrawingTool } from '../store/useAnnotationStore';
import { detectShape } from '../utils/shapeDetection';

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

export function useDrawingSystem(wrapperRef: React.RefObject<HTMLElement | null>) {
  const { 
    activeTool, color, width, opacity, glowIntensity, brushStyle, 
    smoothing, addAnnotation, updateAnnotation, blinkDuration, fadeOutDuration, autoRemove
  } = useAnnotationStore();
  
  const isDrawing = useRef(false);
  const currentAnnotationId = useRef<string | null>(null);
  const currentPoints = useRef<Point[]>([]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const getGraphPos = (e: PointerEvent): Point => {
      // Get pointer position relative to wrapper
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Apply inverse D3 transform
      const transform = d3.zoomTransform(el);
      return {
        x: (x - transform.x) / transform.k,
        y: (y - transform.y) / transform.k
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

      const pt = getGraphPos(e);
      
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
      const id = 'anno_' + Date.now() + '_' + Math.floor(Math.random()*1000);
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

    const handlePointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
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
          if (detected.type !== 'none' && detected.confidence > 0.75) {
            
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
                  });
                  useAnnotationStore.getState().commitAction();
                  
                  if (state.activeTool === 'highlighter' && state.blinkDuration > 0) {
                    setTimeout(() => {
                      useAnnotationStore.getState().updateAnnotation(annId, { isFading: true });
                      setTimeout(() => {
                        useAnnotationStore.getState().removeAnnotations([annId]);
                        useAnnotationStore.getState().commitAction();
                      }, state.fadeOutDuration * 1000);
                    }, state.blinkDuration * 1000);
                  }
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
          isFading: false
        });

        useAnnotationStore.getState().commitAction();

        // Trigger auto remove if highlighter has a stay time > 0
        if (state.activeTool === 'highlighter' && state.blinkDuration > 0) {
          const id = currentAnnotationId.current;
          setTimeout(() => {
            // Start the fade out CSS transition
            useAnnotationStore.getState().updateAnnotation(id, { isFading: true });
            
            // Remove the annotation from state after the fade duration
            setTimeout(() => {
              useAnnotationStore.getState().removeAnnotations([id]);
              useAnnotationStore.getState().commitAction();
            }, state.fadeOutDuration * 1000);
          }, state.blinkDuration * 1000);
        }

        currentAnnotationId.current = null;
      }
    };

    const handleCancelDrawing = () => {
      if (isDrawing.current && currentAnnotationId.current) {
        useAnnotationStore.getState().removeAnnotations([currentAnnotationId.current]);
      }
      isDrawing.current = false;
      currentAnnotationId.current = null;
    };

    const handleDrawingKeyDown = (e: KeyboardEvent) => {
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
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('cancel-drawing', handleCancelDrawing);
    window.addEventListener('keydown', handleDrawingKeyDown);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('cancel-drawing', handleCancelDrawing);
      window.removeEventListener('keydown', handleDrawingKeyDown);
    };
  }, [addAnnotation, updateAnnotation]);
}
