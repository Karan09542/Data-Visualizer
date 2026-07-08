
const fs = require('fs');
let content = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// Fix 1: Parametric xy
content = content.replace(
  /xy=\{\(t: number\) => \{\s*try \{\s*const loopScope = \{ \.\.\.baseScope \};\s*loopScope\.t = t;\s*const res = f\.compiled\.evaluate\(loopScope\);/g,
  'xy={(() => {\n  const loopScope = { ...baseScope };\n  return (t: number) => {\n    try {\n      loopScope.t = t;\n      const res = f.compiled.evaluate(loopScope);'
);

// Fix 2: Polar xy
content = content.replace(
  /xy=\{\(tVal: number\) => \{\s*try \{\s*const loopScope = \{ \.\.\.baseScope \};\s*const useThetaAsAngle =[^}]*\}\s*const r = Number\(\s*f\.compiled\.evaluate\(loopScope\),\s*\);/g,
  'xy={(() => {\n  const loopScope = { ...baseScope };\n  return (tVal: number) => {\n    try {\n      const useThetaAsAngle = /\\\\btheta\\\\b/.test(f.expr);\n      if (useThetaAsAngle) {\n        loopScope.theta = tVal;\n        loopScope.x = tVal;\n      } else {\n        loopScope.t = tVal;\n        loopScope.x = tVal;\n        loopScope.theta = tVal;\n      }\n      const r = Number(f.compiled.evaluate(loopScope));'
);

// Fix 3: Function xy
content = content.replace(
  /xy=\{\(t\) => \{\s*try \{\s*const scope = \{ \.\.\.baseScope \};\s*scope\.x = t;\s*const res = f\.compiled\.evaluate\(scope\);/g,
  'xy={(() => {\n  const loopScope = { ...baseScope };\n  return (t) => {\n    try {\n      loopScope.x = t;\n      const res = f.compiled.evaluate(loopScope);'
);

// Fix 4: If there is any remaining const scope = { ...baseScope }; inside xy
content = content.replace(
  /xy=\{\(t\) => \{\s*try \{\s*const loopScope = \{ \.\.\.baseScope \};\s*loopScope\.x = t;\s*const res = f\.compiled\.evaluate\(loopScope\);/g,
  'xy={(() => {\n  const loopScope = { ...baseScope };\n  return (t) => {\n    try {\n      loopScope.x = t;\n      const res = f.compiled.evaluate(loopScope);'
);


fs.writeFileSync('src/components/MathNodeRenderer.tsx', content);
console.log('Fixed xy functions');

