const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const regexPlotParametric = /<Plot\.Parametric\s+minSamplingDepth=\{samplingDepth\}\s+maxSamplingDepth=\{samplingDepth\}\s+t=\{([^}]+)\}\s+xy=\{\((.*?)\)\s*=>\s*\{([\s\S]*?)try\s*\{([\s\S]*?)return\s*\[(.*?)\];\s*\}\s*catch\s*\{\s*return\s*\[0,\s*0\];\s*\}\s*\}\}/g;

// Instead of regex matching the entire body, let's inject a wrapper function `applyForwardTransform` right at the output of xy:

const wrapperCode = `
const applyForwardTransform = (pt: [number, number]): [number, number] => {
  if (isNaN(pt[0]) || isNaN(pt[1])) return pt;
  let lx = pt[0] - px;
  let ly = pt[1] - py;
  
  lx *= (sx || 1);
  ly *= (sy || 1);
  
  const c1 = Math.cos(rot + (f.transformBaseAngle || 0));
  const s1 = Math.sin(rot + (f.transformBaseAngle || 0));
  const c2 = Math.cos(-(f.transformBaseAngle || 0));
  const s2 = Math.sin(-(f.transformBaseAngle || 0));
  
  let tx1 = lx * c2 - ly * s2;
  let ty1 = lx * s2 + ly * c2;
  
  let tx2 = tx1 * c1 - ty1 * s1;
  let ty2 = tx1 * s1 + ty1 * c1;
  
  return [tx2 + px + tx, ty2 + py + ty];
};
`;

// Insert the wrapper code right before we map over functions
code = code.replace(/const isPointBased = f\.type === "point"/, wrapperCode + '\nconst isPointBased = f.type === "point"');

// And we can just remove all SVG <Transform> wraps for curves!!
// BUT wait, we need SVG Transforms for Vectors, Polygons, Points, Lines!
// How about we apply BOTH?
// NO! If we apply BOTH, it will double. 
// So, the `<Transform>` hierarchy will ONLY wrap `isPointBased` components.
// For continuous components (which use applyForwardTransform), they will be OUTSIDE the `<Transform>` hierarchy, but still logically inside the same map body.

// Let's manually refactor the render tree:
fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
