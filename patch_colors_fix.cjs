const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// Fix the syntax mess
code = code.replace(/\/ style=\{\{ stroke: pColor \}\}>/g, 'style={{ stroke: pColor }} />');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
console.log("Syntax fixed.");
