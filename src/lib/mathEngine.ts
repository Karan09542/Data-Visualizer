import * as d3 from 'd3';
import { Point } from '../store/useAnnotationStore';

export interface Frame {
  origin: Point;
  tangent: Point;
  normal: Point;
  arcLength: number;
}

/**
 * Computes arc-length parameterized frames along a set of points.
 * Uses Parallel Transport to maintain stable orientation.
 */
export function computeFrames(points: Point[]): Frame[] {
  if (points.length < 2) return [];

  const frames: Frame[] = [];
  let totalLength = 0;

  // 1. Compute segments and lengths
  const segments: { p1: Point; p2: Point; length: number; tangent: Point }[] = [];
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
      segments.push({ p1, p2, length, tangent: { x: dx / length, y: dy / length } });
      totalLength += length;
    }
  }

  if (segments.length === 0) return [];

  // 2. Initialize first frame
  let currentNormal = { x: -segments[0].tangent.y, y: segments[0].tangent.x };
  let currentArcLength = 0;

  frames.push({
    origin: segments[0].p1,
    tangent: segments[0].tangent,
    normal: currentNormal,
    arcLength: 0
  });

  // 3. Parallel Transport along segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextTangent = (i < segments.length - 1) ? segments[i + 1].tangent : seg.tangent;
    
    // Simple Parallel Transport: wrap normal to stay perpendicular to next tangent
    // We rotate the current frame to align tangent with nextTangent
    const dot = seg.tangent.x * nextTangent.x + seg.tangent.y * nextTangent.y;
    if (dot < 0.9999) {
      // Find rotation between tangents
      const angle = Math.atan2(
        seg.tangent.x * nextTangent.y - seg.tangent.y * nextTangent.x,
        seg.tangent.x * nextTangent.x + seg.tangent.y * nextTangent.y
      );
      // Rotate normal by the same angle
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = currentNormal.x * cos - currentNormal.y * sin;
      const ny = currentNormal.x * sin + currentNormal.y * cos;
      currentNormal = { x: nx, y: ny };
    }

    currentArcLength += seg.length;
    frames.push({
      origin: seg.p2,
      tangent: nextTangent,
      normal: currentNormal,
      arcLength: currentArcLength
    });
  }

  return frames;
}

/**
 * Interpolates a frame at a specific arc length.
 */
export function interpolateFrame(frames: Frame[], s: number): Frame {
  if (frames.length === 0) throw new Error("Empty frames");
  if (s <= 0) return frames[0];
  if (s >= frames[frames.length - 1].arcLength) return frames[frames.length - 1];

  let low = 0;
  let high = frames.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].arcLength < s) low = mid + 1;
    else high = mid - 1;
  }
  
  const i = low;
  const f1 = frames[i - 1];
  const f2 = frames[i];
  const t = (s - f1.arcLength) / (f2.arcLength - f1.arcLength);

  return {
    origin: {
      x: f1.origin.x + (f2.origin.x - f1.origin.x) * t,
      y: f1.origin.y + (f2.origin.y - f1.origin.y) * t
    },
    tangent: {
      x: f1.tangent.x + (f2.tangent.x - f1.tangent.x) * t,
      y: f1.tangent.y + (f2.tangent.y - f1.tangent.y) * t
    },
    normal: {
      x: f1.normal.x + (f2.normal.x - f1.normal.x) * t,
      y: f1.normal.y + (f2.normal.y - f1.normal.y) * t
    },
    arcLength: s
  };
}

/**
 * Pre-processes mathematical expressions into math.js compatible syntax.
 */
export function normalizeExpression(expr: string): string {
  if (!expr) return '';
  
  // Basic cleanup
  let normalized = expr.replace(/\s+/g, '');
  
  // Handle implicit multiplication: 2x -> 2*x, 10sin -> 10*sin
  // We look for a number followed by a letter or a parenthesis
  normalized = normalized.replace(/(\d+)([a-zA-Z(])/g, '$1*$2');
  
  // Handle implicit multiplication between groups: (x+1)x -> (x+1)*x, (x+1)(x+2) -> (x+1)*(x+2)
  normalized = normalized.replace(/\)([\d(a-zA-Z])/g, ')*$1');

  // Handle case like x(y) -> x*(y) if x is not a known function
  // For simplicity, we just assume any letter before ( is a function for now, 
  // but if it's a number followed by ( it's already handled.
  
  // Common substitutions
  normalized = normalized.replace(/²/g, '^2');
  normalized = normalized.replace(/³/g, '^3');
  normalized = normalized.replace(/π/g, 'pi');
  normalized = normalized.replace(/\|([^|]+)\|/g, 'abs($1)');
  
  // Replace Greek theta with latin theta just in case
  normalized = normalized.replace(/θ/g, 'theta');
  
  return normalized;
}

/**
 * Basic Marching Squares implementation for contour extraction.
 */
export function marchingSquares(
  field: number[][],
  threshold: number,
  cellSize: number,
  offsetX: number,
  offsetY: number
): Point[][] {
  const isolines: Point[][] = [];
  const rows = field.length;
  if (rows < 2) return [];
  const cols = field[0].length;
  if (cols < 2) return [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const v0 = field[r][c] > threshold ? 1 : 0;
      const v1 = field[r][c + 1] > threshold ? 1 : 0;
      const v2 = field[r + 1][c + 1] > threshold ? 1 : 0;
      const v3 = field[r + 1][c] > threshold ? 1 : 0;
      const index = v0 | (v1 << 1) | (v2 << 2) | (v3 << 3);

      if (index === 0 || index === 15) continue;

      // Simplistic linear interpolation or mid-point
      const p0 = { x: offsetX + c * cellSize, y: offsetY + r * cellSize };
      const p1 = { x: offsetX + (c + 1) * cellSize, y: offsetY + r * cellSize };
      const p2 = { x: offsetX + (c + 1) * cellSize, y: offsetY + (r + 1) * cellSize };
      const p3 = { x: offsetX + c * cellSize, y: offsetY + (r + 1) * cellSize };

      // Improved interpolation based on threshold
      const getLerp = (vA: number, vB: number, pA: Point, pB: Point) => {
        const t = (threshold - vA) / (vB - vA);
        if (isNaN(t) || !isFinite(t)) return { x: (pA.x + pB.x)/2, y: (pA.y + pB.y)/2 };
        return {
          x: pA.x + (pB.x - pA.x) * t,
          y: pA.y + (pB.y - pA.y) * t
        };
      };

      const m0 = { x: (p0.x + p1.x) / 2, y: p0.y };
      const m1 = { x: p1.x, y: (p1.y + p2.y) / 2 };
      const m2 = { x: (p2.x + p3.x) / 2, y: p2.y };
      const m3 = { x: p3.x, y: (p3.y + p0.y) / 2 };

      switch (index) {
        case 1: case 14: isolines.push([m3, m0]); break;
        case 2: case 13: isolines.push([m0, m1]); break;
        case 3: case 12: isolines.push([m3, m1]); break;
        case 4: case 11: isolines.push([m1, m2]); break;
        case 5: isolines.push([m3, m0], [m1, m2]); break;
        case 6: case 9: isolines.push([m0, m2]); break;
        case 7: case 8: isolines.push([m3, m2]); break;
        case 10: isolines.push([m0, m1], [m2, m3]); break;
      }
    }
  }

  return isolines;
}

/**
 * Detects the type of expression to determine rendering strategy.
 */
export function detectExpressionType(expr: string): 'explicit' | 'parametric' | 'implicit' | 'polar' | 'field' {
  if (!expr) return 'explicit';
  const clean = expr.toLowerCase().replace(/\s/g, '');
  
  // Parametric: x(t)=...; y(t)=... or just containing semicolon
  if (clean.includes('x(') || clean.includes('y(') || clean.includes(';')) return 'parametric';
  
  // Polar: r=... or contains theta
  if (clean.startsWith('r=') || clean.includes('=r') || clean.includes('theta') || clean.includes('phi')) return 'polar';
  
  // Implicit: contains equals sign but not caught by above
  if (clean.includes('=') || clean.includes('==')) return 'implicit';
  
  // Field: contains y as a variable or noise
  if (/\by\b/.test(expr) || clean.includes('noise')) return 'field';
  
  return 'explicit';
}
