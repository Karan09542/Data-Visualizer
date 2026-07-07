const fs = require('fs');

const path = "c:/Users/karan/project/Data-Visualizer/src/components/MathNodeRenderer.tsx";
let content = fs.readFileSync(path, "utf-8");

// Replace { ...baseScope, t: tVal }
content = content.replace(
  /const res = f\.compiled\.evaluate\(\{\s*\.\.\.baseScope,\s*t:\s*tVal,?\s*\}\);/g,
  `const scope = Object.create(baseScope);
                                            scope.t = tVal;
                                            const res = f.compiled.evaluate(scope);`
);

// Replace { ...baseScope, t }
content = content.replace(
  /const res = f\.compiled\.evaluate\(\{\s*\.\.\.baseScope,\s*t,?\s*\}\);/g,
  `const scope = Object.create(baseScope);
                                            scope.t = t;
                                            const res = f.compiled.evaluate(scope);`
);

// Replace { ...baseScope, x: t }
content = content.replace(
  /const res = f\.compiled\.evaluate\(\{\s*\.\.\.baseScope,\s*x:\s*t,?\s*\}\);/g,
  `const scope = Object.create(baseScope);
                                            scope.x = t;
                                            const res = f.compiled.evaluate(scope);`
);

// Replace const scope = { ...baseScope }; (Polar)
content = content.replace(
  /const scope = \{\s*\.\.\.baseScope\s*\};/g,
  `const scope = Object.create(baseScope);`
);

fs.writeFileSync(path, content);
console.log("Replaced successfully!");
