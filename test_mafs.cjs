const fs = require('fs');
const code = fs.readFileSync('node_modules/mafs/dist/index.d.ts', 'utf8');
const lines = code.split('\n');
const transformLines = lines.filter((l, i) => lines.slice(Math.max(0, i-5), i+5).some(x => x.includes('TransformProps')));
console.log(transformLines.join('\n'));
