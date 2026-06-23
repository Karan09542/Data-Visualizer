const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/<React\.Fragment>\s*<MovablePoint/g, '<>\n<MovablePoint');
fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
