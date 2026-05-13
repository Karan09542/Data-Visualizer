import React, { useMemo } from 'react';
import { useAnnotationStore, Annotation, Point } from '../store/useAnnotationStore';
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
    
    if (['pen', 'highlighter', 'eraser', 'polygon', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'star', 'diamond'].includes(anno.tool)) {
      if (!['pen', 'highlighter', 'eraser'].includes(anno.tool)) {
        return lineGenerator([...anno.points, anno.points[0]]) || '';
      }
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
      // Calculate arrowhead
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const angle = Math.atan2(dy, dx);
      const headlen = 15;
      const x3 = p2.x - headlen * Math.cos(angle - Math.PI / 6);
      const y3 = p2.y - headlen * Math.sin(angle - Math.PI / 6);
      const x4 = p2.x - headlen * Math.cos(angle + Math.PI / 6);
      const y4 = p2.y - headlen * Math.sin(angle + Math.PI / 6);
      return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} M ${x3},${y3} L ${p2.x},${p2.y} L ${x4},${y4}`;
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

    if (anno.tool === 'triangle') {
      const p1 = anno.points[0];
      const p2 = anno.points[anno.points.length - 1];
      if (!p1 || !p2) return '';
      const topY = Math.min(p1.y, p2.y);
      const bottomY = Math.max(p1.y, p2.y);
      const leftX = Math.min(p1.x, p2.x);
      const rightX = Math.max(p1.x, p2.x);
      const cx = (leftX + rightX) / 2;
      return `M ${cx},${topY} L ${rightX},${bottomY} L ${leftX},${bottomY} Z`;
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
  if (anno.brushStyle === 'dashed') strokeDasharray = '10, 10';
  
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
        <BaseAnnotationShape key={anno.id} anno={anno} />
      ))}
    </g>
  );
}
