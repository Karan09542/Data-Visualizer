import { Point, DrawingTool } from '../store/useAnnotationStore';

export type DetectedShapeInfo = {
  type: DrawingTool | 'none';
  points: Point[];
  pathPoints?: Point[]; // Points along the perfect shape for morphing
  confidence: number;
};

// --- Math & Geometry Utils ---
function getSqDist(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x, dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt(getSqDist(p1, p2));
}

function getSqSegDist(p: Point, p1: Point, p2: Point): number {
  let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = p2.x; y = p2.y; } 
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  return getSqDist(p, {x, y});
}

function simplifyDPStep(points: Point[], first: number, last: number, sqTolerance: number, simplified: Point[]) {
  let maxSqDist = sqTolerance, index = -1;
  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
  }
  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

function simplifyDouglasPeucker(points: Point[], sqTolerance: number): Point[] {
  if (points.length <= 2) return points;
  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);
  return simplified;
}

function smoothPoints(points: Point[], iterations = 1): Point[] {
  if (points.length < 3) return points;
  let current = [...points];
  for (let iter = 0; iter < iterations; iter++) {
    const next = [current[0]];
    for (let i = 1; i < current.length - 1; i++) {
      next.push({
        x: current[i - 1].x * 0.25 + current[i].x * 0.5 + current[i + 1].x * 0.25,
        y: current[i - 1].y * 0.25 + current[i].y * 0.5 + current[i + 1].y * 0.25
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function getBoundingBox(points: Point[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function getPerimeterAndArea(points: Point[]) {
  let perimeter = 0, area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    perimeter += distance(p1, p2);
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  return { perimeter, area: Math.abs(area) / 2 };
}

function sampleLine(p1: Point, p2: Point, count: number): Point[] {
  const res: Point[] = [];
  if (count <= 1) return [p2];
  for (let i = 0; i < count; i++) res.push({ x: p1.x + (p2.x - p1.x) * (i / (count - 1)), y: p1.y + (p2.y - p1.y) * (i / (count - 1)) });
  return res;
}

function generatePolygonMap(origCount: number, cornerPoints: Point[], closed = true): Point[] {
  const pathPoints: Point[] = [];
  let totalPerim = 0;
  const segments = [];
  for (let i = 0; i < (closed ? cornerPoints.length : cornerPoints.length - 1); i++) {
    const p1 = cornerPoints[i];
    const p2 = cornerPoints[(i + 1) % cornerPoints.length];
    const d = Math.max(0.0001, distance(p1, p2));
    segments.push({ p1, p2, len: d, start: totalPerim });
    totalPerim += d;
  }
  
  if (totalPerim === 0) return Array(origCount).fill(cornerPoints[0]);

  for (let i = 0; i < origCount; i++) {
    const t = (i / (origCount - 1)) * totalPerim;
    let seg = segments.find((s, idx) => t <= s.start + s.len || idx === segments.length - 1)!;
    const localT = Math.min(1, Math.max(0, (t - seg.start) / seg.len));
    pathPoints.push({ x: seg.p1.x + (seg.p2.x - seg.p1.x) * localT, y: seg.p1.y + (seg.p2.y - seg.p1.y) * localT });
  }
  return pathPoints;
}

function leastSquaresFit(points: Point[]) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let p of points) { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x; }
  const n = points.length;
  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) return { slope: Infinity, intercept: sumX / n, error: 0 };
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  let error = 0;
  for (let p of points) error += Math.abs(p.y - (slope * p.x + intercept));
  return { slope, intercept, error: error / n };
}

// ----------------------------------------------------
// MULTI-STAGE RECOGNITION PIPELINE
// ----------------------------------------------------

export function detectShape(points: Point[], zoomLevel: number = 1): DetectedShapeInfo {
  const origCount = points.length;
  if (origCount < 5) return { type: 'none', points, confidence: 0 };

  // Determine drawing physical lengths
  const strokeLength = points.reduce((acc, p, i) => acc + (i > 0 ? distance(points[i-1], p) : 0), 0);
  
  // 1. Noise Filtering & Stroke Smoothing
  const processed = smoothPoints(points, 2);
  
  const box = getBoundingBox(processed);
  const maxDim = Math.max(box.width, box.height);
  
  // 2. Open vs Closed Classification
  const start = processed[0];
  const end = processed[processed.length - 1];
  const distStartEnd = distance(start, end);
  
  // Use adaptive closure threshold max(width, height) * 0.12
  const closeThreshold = Math.max(maxDim * 0.12, 12);
  const isClosed = distStartEnd < closeThreshold || distStartEnd < strokeLength * 0.15;

  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const aspect = box.width > 0 && box.height > 0 ? box.width / box.height : 1;

  // -- BASE CONFIDENCE RESOLUTION
  let bestMatch: DetectedShapeInfo = { type: 'none', points: processed, confidence: 0 };
  
  function updateBestMatch(match: DetectedShapeInfo) {
    if (match.confidence > bestMatch.confidence) {
      bestMatch = match;
    }
  }

  // ---------------------------------------
  // 3. CLOSED SHAPE PIPELINE
  // ---------------------------------------
  if (isClosed) {
    const { perimeter, area } = getPerimeterAndArea(processed);
    const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
    
    // -- Radial Variance Analysis (Circles / Ellipses)
    let radialSum = 0;
    const radii = [];
    for (const p of processed) {
      const r = distance(p, {x: cx, y: cy});
      radii.push(r);
      radialSum += r;
    }
    const meanRadius = radialSum / processed.length;
    let rVariance = 0;
    for (const r of radii) rVariance += Math.pow(r - meanRadius, 2);
    rVariance /= processed.length;
    const normalizedVariance = meanRadius > 0 ? rVariance / (meanRadius * meanRadius) : 1;

    // Detect radial peaks for stars
    let radialPeaks = 0;
    for (let i = 1; i < radii.length - 1; i++) {
       if (radii[i] > radii[i-1] && radii[i] > radii[i+1] && radii[i] > meanRadius * 1.1) radialPeaks++;
    }

    if (normalizedVariance < 0.08 && circularity > 0.75) {
      const confidence = Math.min(0.98, 0.8 + (0.08 - normalizedVariance) * 2.5);
      const isEllipse = aspect < 0.8 || aspect > 1.25;
      const type = isEllipse ? 'ellipse' : 'circle';
      const mapPts = [];
      const startAngle = Math.atan2(points[0].y - cy, points[0].x - cx);
      for (let i = 0; i < origCount; i++) {
        const t = startAngle + (i / origCount) * Math.PI * 2;
        if (isEllipse) mapPts.push({ x: cx + (box.width/2) * Math.cos(t), y: cy + (box.height/2) * Math.sin(t) });
        else mapPts.push({ x: cx + meanRadius * Math.cos(t), y: cy + meanRadius * Math.sin(t) });
      }
      updateBestMatch({
        type,
        points: type === 'ellipse' 
          ? [{ x: cx, y: cy }, { x: cx + box.width, y: cy + box.height }] // bounding box info for renderer
          : [{ x: cx, y: cy }, { x: cx + Math.min(box.width, box.height)/2, y: cy }],
        pathPoints: mapPts,
        confidence
      });
    }

    // -- Star Analysis (Centroid Radial Oscillation)
    if (radialPeaks >= 4 && radialPeaks <= 10 && circularity < 0.7 && normalizedVariance > 0.1) {
      const confidence = 0.82 + Math.min(0.1, radialPeaks * 0.01);
      const outerR = meanRadius + Math.sqrt(rVariance);
      const innerR = meanRadius - Math.sqrt(rVariance) * 0.6;
      const starPts = [];
      const numPoints = radialPeaks * 2;
      const startAngle = Math.atan2(points[0].y - cy, points[0].x - cx);
      for (let i = 0; i < numPoints; i++) {
         const r = i % 2 === 0 ? outerR : innerR;
         const a = startAngle + (i / numPoints) * Math.PI * 2;
         starPts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      starPts.push(starPts[0]); // close the path mathematically for the map
      updateBestMatch({
        type: 'star',
        points: starPts.slice(0, -1),
        pathPoints: generatePolygonMap(origCount, starPts, false),
        confidence
      });
    }

    // -- Polygon Analysis (Topological)
    let closedPts = [...processed];
    closedPts[closedPts.length - 1] = closedPts[0]; // ensure mathematically closed
    let eps = perimeter * 0.04; // Adaptive corner strictness
    let polyPts = simplifyDouglasPeucker(closedPts, eps * eps);
    polyPts.pop(); // remove duplicate
    
    let nCorners = polyPts.length;

    // Retry with stricter threshold if too many corners
    if (nCorners > 8) {
      eps = perimeter * 0.07;
      polyPts = simplifyDouglasPeucker(closedPts, eps * eps);
      polyPts.pop();
      nCorners = polyPts.length;
    }

    if (nCorners >= 3 && nCorners <= 8 && bestMatch.confidence < 0.9) {
      const boxArea = box.width * box.height;
      let finalTool: DrawingTool = 'polygon';
      let confidence = 0.82;
      
      if (nCorners === 3) {
        finalTool = 'triangle';
        confidence = 0.88;
      }
      else if (nCorners === 4) {
        // Rectangle vs Diamond vs Square
        const rectFill = area / boxArea;
        
        // Edge vector angles
        const angles = [];
        for (let i=0; i<4; i++) {
          const p1 = polyPts[i];
          const p2 = polyPts[(i+1)%4];
          angles.push(Math.atan2(p2.y - p1.y, p2.x - p1.x));
        }
        
        // Check orthogonality (roughly 90 deg differences)
        const angleDiff1 = Math.abs((angles[1] - angles[0]) % (Math.PI/2));
        const isOrthogonal = Math.min(angleDiff1, Math.PI/2 - angleDiff1) < 0.25;
        
        if (rectFill > 0.75 && isOrthogonal) {
          finalTool = (aspect > 0.85 && aspect < 1.15) ? 'square' : 'rectangle';
          confidence = 0.85 + (rectFill - 0.75);
          // Auto-align
          polyPts = [
            { x: box.minX, y: box.minY },
            { x: box.maxX, y: box.minY },
            { x: box.maxX, y: box.maxY },
            { x: box.minX, y: box.maxY }
          ];
          
          // Re-align so that polyPts[0] is closest to start
          let bestIdx = 0;
          let bestD = Infinity;
          for (let i = 0; i < 4; i++) {
            const d = distance(start, polyPts[i]);
            if (d < bestD) { bestD = d; bestIdx = i; }
          }
          polyPts = [...polyPts.slice(bestIdx), ...polyPts.slice(0, bestIdx)];

          if (circularity > 0.78 && finalTool === 'rectangle') {
            finalTool = 'rounded-rectangle';
          }
          
          updateBestMatch({
            type: finalTool,
            points: [ { x: box.minX, y: box.minY }, { x: box.maxX, y: box.maxY } ],
            pathPoints: generatePolygonMap(origCount, polyPts),
            confidence
          });
          
        } else if (rectFill < 0.65) {
          finalTool = 'diamond';
          confidence = 0.86;
          polyPts = [
            { x: cx, y: box.minY },
            { x: box.maxX, y: cy },
            { x: cx, y: box.maxY },
            { x: box.minX, y: cy }
          ];
          
          let bestIdx = 0;
          let bestD = Infinity;
          for (let i = 0; i < 4; i++) {
            const d = distance(start, polyPts[i]);
            if (d < bestD) { bestD = d; bestIdx = i; }
          }
          polyPts = [...polyPts.slice(bestIdx), ...polyPts.slice(0, bestIdx)];
        }
      }
      else if (nCorners === 5) { finalTool = 'pentagon'; confidence = 0.85; }
      else if (nCorners === 6) { finalTool = 'hexagon'; confidence = 0.85; }
      else if (nCorners === 7) { finalTool = 'heptagon'; confidence = 0.82; }
      else if (nCorners === 8) { finalTool = 'octagon'; confidence = 0.82; }

      if (finalTool !== 'rectangle' && finalTool !== 'square' && finalTool !== 'rounded-rectangle') {
        if (bestMatch.type === 'none' || confidence > bestMatch.confidence) {
          updateBestMatch({
            type: finalTool,
            points: polyPts,
            pathPoints: generatePolygonMap(origCount, [...polyPts, polyPts[0]]), // close it
            confidence
          });
        }
      }
    }
  } 
  // ---------------------------------------
  // 4. OPEN SHAPE PIPELINE
  // ---------------------------------------
  else {
    const lineLen = distance(start, end);
    
    // -- Straight Line Analysis
    if (strokeLength < lineLen * 1.15) {
      const fit = leastSquaresFit(processed);
      if (fit.error < 15) {
        updateBestMatch({ 
          type: 'straight-line', 
          points: [start, end], 
          pathPoints: sampleLine(start, end, origCount), 
          confidence: Math.max(0.7, 0.95 - (strokeLength / lineLen - 1))
        });
      }
    }

    // -- Arrow Analysis
    if (strokeLength > 40 && distStartEnd > 30 && bestMatch.confidence < 0.8) {
       const epsLine = strokeLength * 0.05;
       const simplified = simplifyDouglasPeucker(processed, epsLine * epsLine);
       // if there's a hook at the end
       if (simplified.length >= 3 && simplified.length <= 6) {
          const l1 = simplified[simplified.length-1];
          const l2 = simplified[simplified.length-2];
          const l3 = simplified[simplified.length-3];
          
          const a1 = Math.atan2(l1.y - l2.y, l1.x - l2.x);
          const a2 = Math.atan2(l2.y - l3.y, l2.x - l3.x);
          const angleDiff = Math.abs(a1 - a2);
          
          if (angleDiff > Math.PI * 0.7 && angleDiff < Math.PI * 1.3) {
             updateBestMatch({ 
               type: 'arrow', 
               points: [start, l2], // Pointing tip to tip
               pathPoints: sampleLine(start, l2, origCount), 
               confidence: 0.86 
             });
          }
       }
    }

    // -- Waveform Analysis (ISOLATED to open shapes)
    if (processed.length > 20 && bestMatch.confidence < 0.85) {
      let upSlopes = 0, downSlopes = 0;
      let verticalDrops = 0;
      let flatPlateaus = 0;
      let inflections = 0;
      
      for (let i = 2; i < processed.length; i++) {
         const dy = processed[i].y - processed[i-1].y;
         const dx = processed[i].x - processed[i-1].x;
         const dt = Math.abs(dx) > 0.01 ? Math.abs(dy/dx) : 100;
         
         if (dt > 3) verticalDrops++;
         else if (dt < 0.25) flatPlateaus++;
         else if (dy > 0) downSlopes++;
         else if (dy < 0) upSlopes++;

         if (Math.sign(dy) !== Math.sign(processed[i-1].y - processed[i-2].y)) inflections++;
      }
      
      if (inflections >= 3) {
        let waveType: any = 'none';
        let confidence = 0;

        // Square Wave: plateau -> vertical drop -> plateau
        if (flatPlateaus > verticalDrops && verticalDrops >= 2 && flatPlateaus > (upSlopes+downSlopes)*0.5) {
          waveType = 'square-wave';
          confidence = 0.88;
        }
        // Sawtooth Wave: gradual slope -> vertical drop -> gradual slope
        else if (verticalDrops >= 2 && flatPlateaus < verticalDrops*2 && (upSlopes > downSlopes*2 || downSlopes > upSlopes*2)) {
          waveType = 'sawtooth-wave';
          confidence = 0.86;
        }
        // Triangle/Sine/Pulse/Zigzag
        else if (upSlopes > 0 && downSlopes > 0) {
           const symmetry = Math.abs(upSlopes - downSlopes) / (upSlopes + downSlopes);
           if (symmetry < 0.3) { // reasonably symmetric
             if (flatPlateaus < 5 && inflections > 8 && verticalDrops < 3) waveType = 'zigzag-wave';
             else if (flatPlateaus < 10) waveType = 'triangle-wave';
             else waveType = 'sine-wave';
             confidence = 0.85;
           } else {
             waveType = 'pulse-wave';
             confidence = 0.8;
           }
        }

        if (waveType !== 'none') {
           updateBestMatch({ type: waveType, points: processed, confidence });
        }
      }
    }
  }

  // 14. Ambiguity Resolution (preserve freehand if uncertain)
  const confidenceThreshold = 0.65; // Lowered to allow more soft snapping
  if (bestMatch.confidence < confidenceThreshold) {
    return { type: 'none', points, confidence: bestMatch.confidence };
  }

  // 15. Soft Shape Assistance (Organic Blending)
  // Default strength 0.35, scales up with very high confidence
  let strength = 0.35 + Math.max(0, (bestMatch.confidence - 0.85) * 1.5);
  strength = Math.min(0.9, Math.max(0.1, strength)); // Cap at 0.9 to always retain some hand-drawn feel
  
  if (bestMatch.pathPoints && bestMatch.pathPoints.length === origCount) {
    const blended = [];
    for (let i = 0; i < origCount; i++) {
       const u = processed[i];
       const v = bestMatch.pathPoints[i];
       blended.push({
         x: u.x + (v.x - u.x) * strength,
         y: u.y + (v.y - u.y) * strength
       });
    }
    // Set both to the organic blended path. 
    // useDrawingSystem will animate to this, then set the tool type natively.
    bestMatch.pathPoints = blended;
    bestMatch.points = blended;
  }

  return bestMatch;
}
