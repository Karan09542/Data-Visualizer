
const fs = require('fs');
let content = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// 1. Parametric
content = content.replace(
  /xy=\{\(t: number\) => \{\s*try \{\s*const res = f\.compiled\.evaluate\(\{\s*\.\.\.baseScope,\s*t,\s*\}\);/gs,
  'xy={(() => { const loopScope = { ...baseScope }; return (t: number) => { try { loopScope.t = t; const res = f.compiled.evaluate(loopScope);'
);

// 2. Parametric close braces
content = content.replace(
  /return \[0, 0\];\s*\} catch \{\s*return \[0, 0\];\s*\}\s*\}\}/gs,
  'return [0, 0]; } catch { return [0, 0]; } } })()}'
);

// 3. Function
content = content.replace(
  /xy=\{\(t\) => \{\s*try \{\s*const res = f\.compiled\.evaluate\(\{\s*\.\.\.baseScope,\s*x: t,\s*\}\);/gs,
  'xy={(() => { const loopScope = { ...baseScope }; return (t) => { try { loopScope.x = t; const res = f.compiled.evaluate(loopScope);'
);

// 4. Polar xy callback
content = content.replace(
  /xy=\{\(tVal: number\) => \{\s*try \{\s*const useThetaAsAngle =[^}]*\}\s*const scope = \{ \.\.\.baseScope \};\s*if \(useThetaAsAngle\) \{/gs,
  'xy={(() => { const loopScope = { ...baseScope }; return (tVal: number) => { try { const useThetaAsAngle = /\\\\btheta\\\\b/.test(f.expr); if (useThetaAsAngle) { loopScope.theta = tVal; loopScope.x = tVal; } else { loopScope.t = tVal; loopScope.x = tVal; loopScope.theta = tVal; } const r = Number(f.compiled.evaluate(loopScope)); //'
);
content = content.replace(
  /const r = Number\(\s*f\.compiled\.evaluate\(scope\),\s*\);/gs,
  ''
);


fs.writeFileSync('src/components/MathNodeRenderer.tsx', content);
console.log('Fixed');

