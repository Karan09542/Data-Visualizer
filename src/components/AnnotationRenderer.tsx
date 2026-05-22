import React, { useMemo, useState, useEffect } from 'react';
import { useAnnotationStore, Annotation, Point } from '../store/useAnnotationStore';
import { getAnnotationBounds, TransformBox } from './TransformBox';
import { AnnotationContextMenu, ManualResizeModal } from './AnnotationControls';
import * as d3 from 'd3';
import { create, all } from 'mathjs';
import { 
  computeFrames, 
  interpolateFrame, 
  normalizeExpression, 
  detectExpressionType,
  marchingSquares
} from '../lib/mathEngine';

const math = create(all);
math.import({
  signum: math.sign
}, { override: true });

// Simple cache for compiled math expressions to avoid recompiling on every render
const compilationCache = new Map<string, any>();

function getCompiledExpression(expr: string) {
  if (compilationCache.has(expr)) return compilationCache.get(expr);
  try {
    const compiled = math.compile(expr);
    compilationCache.set(expr, compiled);
    return compiled;
  } catch (e) {
    return null;
  }
}

const BaseAnnotationShape = ({ anno }: { anno: Annotation }) => {
  const lineGenerator = useMemo(() => {
    const lg = d3.line<Point>()
      .x(d => d.x)
      .y(d => d.y);

    if (anno.brushStyle === 'smooth-ink' || anno.brushStyle === 'soft-highlighter' || anno.smoothing > 0.5) {
      lg.curve(d3.curveCatmullRom.alpha(0.5));
    } else if (anno.brushStyle === 'rough-handdrawn') {
      lg.curve(d3.curveBasis);
    } else {
      lg.curve(d3.curveLinear);
    }
    return lg;
  }, [anno.brushStyle, anno.smoothing]);

  const pathData = useMemo(() => {
    if (anno.points.length === 0) return '';
    
    if (['pen', 'highlighter', 'eraser'].includes(anno.tool)) {
      return lineGenerator(anno.points) || '';
    }
    
    if (anno.tool === 'straight-line') {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      return `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
    }

    if (anno.tool === 'arrow') {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const headlen = anno.arrowTipSize || 15;
      const tipStyle = anno.arrowTipStyle || 'triangle';
      const lineStyle = anno.arrowLineStyle || 'solid';

      let linePath = '';
      if (lineStyle === 'custom-math') {
        const segments = Math.max(10, Math.floor(dist / 5));
        linePath = `M ${p1.x},${p1.y}`;
        try {
          const node = math.parse(anno.customArrowLineEquation || '0');
          const compiled = node.compile();
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const px = p1.x + dx * t;
            const py = p1.y + dy * t;
            let offset = 0;
            try {
              offset = compiled.evaluate({ t, dist }) as number;
            } catch (e) {}
            const perpX = -Math.sin(angle) * offset;
            const perpY = Math.cos(angle) * offset;
            linePath += ` L ${px + perpX},${py + perpY}`;
          }
        } catch (e) {
          linePath = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
        }
      } else if (lineStyle === 'curly') {
        const segments = Math.max(1, Math.floor(dist / 20));
        const segDist = dist / segments;
        linePath = `M ${p1.x},${p1.y}`;
        for (let i = 1; i <= segments; i++) {
          const t = i / segments;
          const px = p1.x + dx * t;
          const py = p1.y + dy * t;
          const midT = (i - 0.5) / segments;
          const midX = p1.x + dx * midT;
          const midY = p1.y + dy * midT;
          
          const perpX = -Math.sin(angle) * 10;
          const perpY = Math.cos(angle) * 10;
          
          linePath += ` Q ${midX + perpX},${midY + perpY} ${px},${py}`;
        }
      } else {
        linePath = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
      }

      let tipPath = '';
      if (tipStyle === 'custom-math') {
        try {
          const segments = 30;
          const node = math.parse(anno.customArrowTipEquation || 'size');
          const compiled = node.compile();
          
          let path = '';
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            let r = headlen;
            try {
              r = compiled.evaluate({ theta, size: headlen }) as number;
            } catch(e) {}
            
            const px = p2.x + r * Math.cos(angle + Math.PI + theta);
            const py = p2.y + r * Math.sin(angle + Math.PI + theta);
            
            if (i === 0) path += ` M ${px},${py}`;
            else path += ` L ${px},${py}`;
          }
          path += ' Z';
          tipPath = path;
        } catch(e) {}
      } else if (tipStyle === 'none') {
         // no tip
      } else if (tipStyle === 'default') {
        const x3 = p2.x - headlen * Math.cos(angle - Math.PI / 6);
        const y3 = p2.y - headlen * Math.sin(angle - Math.PI / 6);
        const x4 = p2.x - headlen * Math.cos(angle + Math.PI / 6);
        const y4 = p2.y - headlen * Math.sin(angle + Math.PI / 6);
        tipPath = ` M ${x3},${y3} L ${p2.x},${p2.y} L ${x4},${y4}`;
      } else if (tipStyle === 'triangle') {
        const x3 = p2.x - headlen * Math.cos(angle - Math.PI / 6);
        const y3 = p2.y - headlen * Math.sin(angle - Math.PI / 6);
        const x4 = p2.x - headlen * Math.cos(angle + Math.PI / 6);
        const y4 = p2.y - headlen * Math.sin(angle + Math.PI / 6);
        tipPath = ` M ${p2.x},${p2.y} L ${x3},${y3} L ${x4},${y4} Z`;
      } else if (tipStyle === 'stealth') {
        const x3 = p2.x - headlen * Math.cos(angle - Math.PI / 6);
        const y3 = p2.y - headlen * Math.sin(angle - Math.PI / 6);
        const x4 = p2.x - headlen * Math.cos(angle + Math.PI / 6);
        const y4 = p2.y - headlen * Math.sin(angle + Math.PI / 6);
        const invHead = headlen * 0.5;
        const x5 = p2.x - invHead * Math.cos(angle);
        const y5 = p2.y - invHead * Math.sin(angle);
        tipPath = ` M ${p2.x},${p2.y} L ${x3},${y3} L ${x5},${y5} L ${x4},${y4} Z`;
      } else if (tipStyle === 'diamond') {
        const x3 = p2.x - (headlen/2) * Math.cos(angle - Math.PI / 4);
        const y3 = p2.y - (headlen/2) * Math.sin(angle - Math.PI / 4);
        const x4 = p2.x - headlen * Math.cos(angle);
        const y4 = p2.y - headlen * Math.sin(angle);
        const x5 = p2.x - (headlen/2) * Math.cos(angle + Math.PI / 4);
        const y5 = p2.y - (headlen/2) * Math.sin(angle + Math.PI / 4);
        tipPath = ` M ${p2.x},${p2.y} L ${x3},${y3} L ${x4},${y4} L ${x5},${y5} Z`;
      } else if (tipStyle === 'circle') {
        const cx = p2.x - (headlen/2) * Math.cos(angle);
        const cy = p2.y - (headlen/2) * Math.sin(angle);
        const r = headlen / 2;
        tipPath = ` M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx},${cy + r} A ${r},${r} 0 1,1 ${cx},${cy - r}`;
      }
      
      return linePath + tipPath;
    }

    if (['rectangle', 'square', 'rounded-rectangle'].includes(anno.tool)) {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      let w = Math.abs(p2.x - p1.x);
      let h = Math.abs(p2.y - p1.y);
      
      if (anno.tool === 'square') {
        const size = Math.max(w, h);
        w = size; h = size;
      }
      
      if (anno.tool === 'rounded-rectangle') {
        const r = Math.min(20, w / 4, h / 4);
        return `M ${x + r},${y} h ${w - 2 * r} a ${r},${r} 0 0 1 ${r},${r} v ${h - 2 * r} a ${r},${r} 0 0 1 ${-r},${r} h ${-(w - 2 * r)} a ${r},${r} 0 0 1 ${-r},${-r} v ${-(h - 2 * r)} a ${r},${r} 0 0 1 ${r},${-r} Z`;
      }
      return `M ${x},${y} h ${w} v ${h} h ${-w} Z`;
    }

    if (['circle', 'ellipse'].includes(anno.tool)) {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      if (anno.tool === 'ellipse') {
        const rx = Math.abs(dx);
        const ry = Math.abs(dy);
        return `M ${p1.x},${p1.y - ry} A ${rx},${ry} 0 1,1 ${p1.x},${p1.y + ry} A ${rx},${ry} 0 1,1 ${p1.x},${p1.y - ry}`;
      }
      const r = Math.sqrt(dx * dx + dy * dy);
      return `M ${p1.x},${p1.y - r} A ${r},${r} 0 1,1 ${p1.x},${p1.y + r} A ${r},${r} 0 1,1 ${p1.x},${p1.y - r}`;
    }

    if (['triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon', 'star', 'diamond'].includes(anno.tool)) {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      
      const leftX = Math.min(p1.x, p2.x);
      const rightX = Math.max(p1.x, p2.x);
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const cx = (leftX + rightX) / 2;
      const cy = (topY + bottomY) / 2;
      const rx = (rightX - leftX) / 2;
      const ry = (bottomY - topY) / 2;
      
      let sides = 3;
      if (anno.tool === 'triangle') sides = 3;
      else if (anno.tool === 'diamond') sides = 4;
      else if (anno.tool === 'pentagon') sides = 5;
      else if (anno.tool === 'hexagon') sides = 6;
      else if (anno.tool === 'heptagon') sides = 7;
      else if (anno.tool === 'octagon') sides = 8;
      else if (anno.tool === 'polygon') sides = anno.polygonSides || 5;

      if (anno.tool === 'star') {
        let path = '';
        const points = 5;
        const innerRadiusRatio = 0.4;
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? 1 : innerRadiusRatio;
          const angle = -Math.PI / 2 + (i * Math.PI) / points;
          const x = cx + Math.cos(angle) * (rx * r);
          const y = cy + Math.sin(angle) * (ry * r);
          if (i === 0) path += `M ${x},${y} `;
          else path += `L ${x},${y} `;
        }
        return path + ' Z';
      }

      // For standard regular polygons
      let path = '';
      for (let i = 0; i < sides; i++) {
        // Start from top center (like triangle pointing up)
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
        // Distort by rx and ry to fit within bounds
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        if (i === 0) path += `M ${x},${y} `;
        else path += `L ${x},${y} `;
      }
      return path + ' Z';
    }

    if (['sine-wave', 'square-wave', 'triangle-wave', 'sawtooth-wave', 'pulse-wave', 'zigzag-wave'].includes(anno.tool)) {
      let path = '';
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const amp = anno.waveAmplitude || 20;
      const freq = anno.waveLength ? (Math.PI * 2) / anno.waveLength : 0.1;
      
      for (let i = 0; i <= dist; i+= 5) {
        const x = i;
        let y = 0;
        
        if (anno.tool === 'sine-wave') {
          y = Math.sin(i * freq) * amp;
        } else if (anno.tool === 'square-wave') {
          y = Math.sign(Math.sin(i * freq)) * amp;
        } else if (anno.tool === 'triangle-wave') {
          y = (Math.asin(Math.sin(i * freq)) / (Math.PI / 2)) * amp;
        } else if (anno.tool === 'sawtooth-wave') {
          y = -amp + (2 * amp / Math.PI) * Math.atan(Math.tan((i * freq) / 2));
        } else if (anno.tool === 'pulse-wave') {
          y = Math.sin(i * freq) > 0.5 ? amp : -amp;
        } else if (anno.tool === 'zigzag-wave') {
          y = (Math.abs((((i * freq) / Math.PI) % 2) - 1) * 2 - 1) * amp;
        }
        
        const rx = p1.x + x * Math.cos(angle) - y * Math.sin(angle);
        const ry = p1.y + x * Math.sin(angle) + y * Math.cos(angle);
        
        if (i === 0) path += `M ${rx},${ry} `;
        else path += `L ${rx},${ry} `;
      }
      return path;
    }

    if (anno.tool === 'function-brush') {
      if (anno.points.length < 2) return '';
      
      const rawExpr = anno.functionExpression || 'sin(x)';
      const normalizedExpr = normalizeExpression(rawExpr);
      const exprType = detectExpressionType(normalizedExpr);
      
      const compiled = getCompiledExpression(normalizedExpr);
      if (!compiled) return '';

      const amp = anno.functionAmplitude ?? 20;
      const freq = anno.functionFrequency ?? 0.1;
      const phase = anno.functionPhase ?? 0;
      const smoothness = anno.functionSmoothness ?? 5;
      const frames = computeFrames(anno.points);
      if (frames.length < 2) return '';
      const totalDist = frames[frames.length - 1].arcLength;
      
      // Update: use static time or specific interval for performance instead of Date.now() on every render if possible
      // But for animations we need time. Let's use a stable time for now or assume rerender handles it.
      const timeOffset = (Date.now() - anno.createdAt) / 1000;

      if (exprType === 'explicit') {
        const generatedPoints: Point[][] = [];
        const strands = 3;
        
        for (let strand = 0; strand < strands; strand++) {
          const strandPoints: Point[] = [];
          const strandOffset = (strand - (strands - 1) / 2) * 2;
          
          for (let s = 0; s <= totalDist; s += smoothness) {
            const frame = interpolateFrame(frames, s);
            
            let offset = 0;
            try {
              offset = compiled.evaluate({ 
                x: s * freq,
                t: timeOffset, 
                p: phase + strand * 0.2,
                q: freq,
                r: amp,
                theta: Math.atan2(frame.tangent.y, frame.tangent.x),
                s: s
              }) * amp;
            } catch(e) {}

            strandPoints.push({
              x: frame.origin.x + frame.normal.x * (offset + strandOffset),
              y: frame.origin.y + frame.normal.y * (offset + strandOffset)
            });
          }
          generatedPoints.push(strandPoints);
        }
        
        const funcLineGen = d3.line<Point>()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveCatmullRom.alpha(0.5));
          
        if (anno.fillEnabled) {
          const fillPoints = [...generatedPoints[0], ...frames.map(f => f.origin).reverse()];
          return funcLineGen(fillPoints) + ' Z';
        }

        return generatedPoints.map(pts => funcLineGen(pts)).join(' ');
      }

      if (exprType === 'implicit' || exprType === 'field') {
        const sRes = Math.ceil(totalDist / Math.max(smoothness * 0.5, 1));
        const nRes = 50;
        const nRange = amp * 1.5;
        
        // Caching inner compiled parts if useful
        let leftCompiled = compiled;
        let rightCompiled: any = null;

        if (normalizedExpr.includes('=')) {
          const parts = normalizedExpr.split(/={1,2}/);
          leftCompiled = getCompiledExpression(parts[0]);
          if (parts[1] && parts[1].trim()) {
            rightCompiled = getCompiledExpression(parts[1]);
          }
        }

        if (!leftCompiled) return '';

        const grid: number[][] = [];
        for (let j = 0; j <= nRes; j++) {
          const n = -nRange + (j / nRes) * 2 * nRange;
          const row: number[] = [];
          for (let i = 0; i <= sRes; i++) {
            const s = (i / sRes) * totalDist;
            
            let val = 0;
            try {
              const scope = {
                x: s * freq,
                y: n / amp,
                t: timeOffset,
                s, n,
                p: phase
              };
              
              const leftVal = leftCompiled.evaluate(scope);
              const rightVal = rightCompiled ? rightCompiled.evaluate(scope) : 0;
              val = leftVal - rightVal;
            } catch(e) {}
            row.push(val);
          }
          grid.push(row);
        }

        const levels = exprType === 'implicit' ? [0] : [-0.5, 0, 0.5];
        let fullPath = '';
        
        for (const level of levels) {
          const isolineSegments = marchingSquares(grid, level, 1, 0, 0);
          
          isolineSegments.forEach(seg => {
            const worldSeg = seg.map(p => {
              const s = (p.x / sRes) * totalDist;
              const nIdx = p.y;
              const n = -nRange + (nIdx / nRes) * 2 * nRange;
              const frame = interpolateFrame(frames, s);
              return {
                x: frame.origin.x + frame.normal.x * n,
                y: frame.origin.y + frame.normal.y * n
              };
            });
            
            fullPath += `M ${worldSeg[0].x},${worldSeg[0].y} L ${worldSeg[1].x},${worldSeg[1].y} `;
          });
        }
        return fullPath;
      }

      if (exprType === 'polar') {
        const generatedPoints: Point[] = [];
        const res = 500;
        
        let polarExpr = normalizedExpr;
        if (polarExpr.includes('=')) {
          const parts = polarExpr.split(/={1,2}/);
          // If expression was "r = ...", we take the second part
          if (parts[0].trim().toLowerCase() === 'r') polarExpr = parts[1];
          // If expression was "... = r", we take the first part
          else if (parts[1].trim().toLowerCase() === 'r') polarExpr = parts[0];
          // Otherwise take the first part after the equals sign just in case
          else polarExpr = parts[1] || parts[0];
        }

        try {
          const polarCompiled = getCompiledExpression(polarExpr);
          if (!polarCompiled) return '';
          const start = anno.points[0];

          for (let i = 0; i <= res; i++) {
            const thetaValue = (i / res) * Math.PI * 2; 
            let rValue = 0;
            try {
              // Provide multiple aliases for the angle to be user-friendly
              rValue = polarCompiled.evaluate({ 
                theta: thetaValue, 
                th: thetaValue,
                t: thetaValue, 
                angle: thetaValue,
                time: timeOffset,
                p: phase 
              }) * amp;
            } catch(e) {
              if (i === 0) console.warn("Math evaluate error:", e);
              rValue = 0;
            }
            
            generatedPoints.push({
              x: start.x + rValue * Math.cos(thetaValue),
              y: start.y + rValue * Math.sin(thetaValue)
            });
          }
        } catch (e) { return ''; }

        return d3.line<Point>().x(d => d.x).y(d => d.y).curve(d3.curveBasisClosed)(generatedPoints) || '';
      }

      if (exprType === 'parametric') {
        const generatedPoints: Point[] = [];
        const res = 1000;
        const tRange = Math.PI * 24;

        // Correctly split multiple parametric equations separated by semicolon
        const parts = rawExpr.split(';');
        let xExpr = normalizedExpr;
        let yExpr = normalizedExpr;

        if (parts.length >= 2) {
          // Normalize individual parts while preserving identity
          const extractExpr = (s: string) => {
            const p = s.split('=');
            return normalizeExpression(p[1] || p[0]);
          };
          xExpr = extractExpr(parts[0]);
          yExpr = extractExpr(parts[1]);
        }

        try {
          const xCompiled = getCompiledExpression(xExpr);
          const yCompiled = getCompiledExpression(yExpr);
          if (!xCompiled || !yCompiled) return '';
          const start = anno.points[0];

          for (let i = 0; i <= res; i++) {
            const t = (i / res) * tRange;
            const scope = { t, x: t, y: t, theta: t, p: phase, time: timeOffset };
            let vx = 0;
            let vy = 0;
            try {
              vx = xCompiled.evaluate(scope) * amp;
              vy = yCompiled.evaluate(scope) * amp;
            } catch(e) {}
            
            generatedPoints.push({ x: start.x + vx, y: start.y + vy });
          }
        } catch (e) {
          return '';
        }

        return d3.line<Point>().x(d => d.x).y(d => d.y).curve(d3.curveCatmullRom.alpha(0.5))(generatedPoints) || '';
      }
    }

    return '';
  }, [anno, lineGenerator]);

  let strokeDasharray = 'none';
  if (anno.brushStyle === 'dashed' || anno.arrowLineStyle === 'dashed') strokeDasharray = '10, 10';
  if (anno.arrowLineStyle === 'dotted') strokeDasharray = '2, 6';
  
  let className = 'transition-opacity';
  if (anno.isFading) {
    className += ' opacity-0';
  }

  const groupStyle: React.CSSProperties = {
    transitionDuration: `${anno.fadeOutDuration}s`,
    transitionTimingFunction: anno.fadeEasing || 'ease',
  };

  // Blinking/pulse animation for highlighter
  const isHighlighter = anno.tool === 'highlighter' || anno.isHighlighter;
  const pathStyle: React.CSSProperties = {
    opacity: anno.opacity,
    color: anno.color,
  };

  if (anno.brushStyle === 'marker') {
    pathStyle.mixBlendMode = 'multiply';
  } else if (anno.brushStyle === 'neon-glow') {
    pathStyle.filter = 'url(#neon-glow-filter)';
  } else if (anno.brushStyle === 'pencil') {
    pathStyle.filter = 'url(#pencil-filter)';
  } else if (anno.brushStyle === 'calligraphy') {
    pathStyle.filter = 'url(#calligraphy-filter)';
  } else if (anno.brushStyle === 'soft-highlighter') {
    pathStyle.filter = 'blur(4px)';
    pathStyle.opacity = anno.opacity * 0.6;
  }
  
  if (isHighlighter && anno.isFading === false && (anno.blinkFrequency && anno.blinkFrequency > 0)) {
     const cycleDuration = 1 / anno.blinkFrequency;
     pathStyle.animation = `blink ${cycleDuration}s infinite cubic-bezier(0, 0, 0, 1.04)`;
  }

  const strokeLinecap = (anno.brushStyle === 'marker' || anno.brushStyle === 'calligraphy') ? 'butt' : 'round';
  const strokeLinejoin = (anno.brushStyle === 'marker' || anno.brushStyle === 'calligraphy') ? 'miter' : 'round';

  const b = getAnnotationBounds(anno);
  const cx = anno.centerX ?? b.cx;
  const cy = anno.centerY ?? b.cy;
  const tx = anno.translateX ?? 0;
  const ty = anno.translateY ?? 0;
  const rot = anno.rotation ?? 0;
  const sx = anno.scaleX ?? 1;
  const sy = anno.scaleY ?? 1;

  if (anno.translateX !== undefined || anno.translateY !== undefined || anno.rotation !== undefined || anno.scaleX !== undefined || anno.scaleY !== undefined) {
    groupStyle.transformOrigin = `${cx}px ${cy}px`;
    groupStyle.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
  }

  return (
    <g className={className} style={groupStyle}>
      {(anno.glowIntensity > 0 || anno.brushStyle === 'neon-glow') && (

        <path
          d={pathData}
          fill="none"
          stroke={anno.color}
          strokeWidth={anno.width + (anno.brushStyle === 'neon-glow' ? 10 : anno.glowIntensity * 5)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={anno.brushStyle === 'neon-glow' ? 0.4 : anno.opacity * 0.3}
          style={{ filter: `blur(${anno.brushStyle === 'neon-glow' ? 6 : anno.glowIntensity * 2}px)` }}
          pointerEvents="none"
        />
      )}

      {anno.brushStyle === 'rough-handdrawn' && (
        <>
          <path
            d={pathData}
            fill="none"
            stroke={anno.color}
            strokeWidth={anno.width * 0.8}
            strokeOpacity={anno.opacity * 0.4}
            strokeLinecap="round"
            style={{ transform: 'translate(2px, 1px)' }}
            pointerEvents="none"
          />
          <path
            d={pathData}
            fill="none"
            stroke={anno.color}
            strokeWidth={anno.width * 0.6}
            strokeOpacity={anno.opacity * 0.3}
            strokeLinecap="round"
            style={{ transform: 'translate(-1px, 2px)' }}
            pointerEvents="none"
          />
        </>
      )}
      
      <path
        id={`anno-${anno.id}`}
        d={pathData}
        fill={anno.fillEnabled ? (anno.fillColor ?? anno.color) : (['rectangle', 'circle', 'ellipse', 'triangle', 'square', 'rounded-rectangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'polygon', 'star', 'diamond'].includes(anno.tool) ? (isHighlighter ? anno.color : "transparent") : 'none')}
        fillOpacity={anno.fillEnabled ? (anno.fillOpacity ?? 0.3) : (isHighlighter ? 0.2 : 0)}
        stroke={anno.color}
        strokeWidth={anno.brushStyle === 'pencil' ? Math.max(1, anno.width * 0.5) : anno.width}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        strokeDasharray={strokeDasharray}
        style={pathStyle}
        pointerEvents={anno.tool === 'eraser' ? 'none' : 'visibleStroke'}
        onClick={(e) => {
          if (useAnnotationStore.getState().activeTool === 'eraser') {
            useAnnotationStore.getState().removeAnnotations([anno.id]);
          } else if (useAnnotationStore.getState().activeTool === 'select') {
            useAnnotationStore.getState().setSelectedAnnotations([anno.id]);
            e.stopPropagation();
          }
        }}
      />
    </g>
  );
};

export default function AnnotationRenderer() {
  const annotations = useAnnotationStore(state => state.annotations);
  const activeTool = useAnnotationStore(state => state.activeTool);
  const selectedAnnotationIds = useAnnotationStore(state => state.selectedAnnotationIds);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, anno: Annotation } | null>(null);
  const [manualResizeAnno, setManualResizeAnno] = useState<Annotation | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <g className="annotation-layer">
      <defs>
        <filter id="pencil-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
        <filter id="neon-glow-filter">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="calligraphy-filter">
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {annotations.map(anno => (
        <g 
          key={anno.id} 
          onContextMenu={(e) => {
            if (activeTool === 'select') {
              e.preventDefault(); // Always prevent browser menu in select mode
              e.stopPropagation(); // Always stop propagation on shapes to prevent global gestures
              // Only allow menu if already selected (as per user request)
              if (selectedAnnotationIds.includes(anno.id)) {
                setContextMenu({ x: e.clientX, y: e.clientY, anno });
              } else {
                // If not selected, we just select it
                useAnnotationStore.getState().setSelectedAnnotations([anno.id]);
              }
            }
          }}
          onClick={(e) => {
            if (activeTool === 'select' && selectedAnnotationIds.includes(anno.id)) {
              e.stopPropagation(); // Prevent bubbling if already selected
            }
          }}
          onTouchStart={(e) => {
            if (activeTool === 'select' && selectedAnnotationIds.includes(anno.id)) {
              // Don't preventDefault here as it might break some things, but stop propagation
              // to avoid global gestures if possible (though gestures often on container)
              e.stopPropagation();
            }
          }}
        >
          <BaseAnnotationShape anno={anno} />
        </g>
      ))}
      {activeTool === 'select' && annotations
        .filter(anno => selectedAnnotationIds.includes(anno.id))
        .map(anno => (
          <TransformBox 
            key={`tb-${anno.id}`} 
            anno={anno} 
            onOpenContextMenu={(x, y) => setContextMenu({ x, y, anno })}
            onInteractionStart={() => setContextMenu(null)}
          />
        ))}

      {contextMenu && (
        <AnnotationContextMenu 
          anno={contextMenu.anno} 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)}
          onShowManualResize={() => setManualResizeAnno(contextMenu.anno)}
        />
      )}

      {manualResizeAnno && (
        <ManualResizeModal 
          anno={manualResizeAnno} 
          baseWidth={getAnnotationBounds(manualResizeAnno).w}
          baseHeight={getAnnotationBounds(manualResizeAnno).h}
          onClose={() => setManualResizeAnno(null)}
        />
      )}
    </g>
  );
}
