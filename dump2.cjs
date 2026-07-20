const fs = require('fs');
const text = fs.readFileSync('temp_original.tsx', 'utf16le');
const lines = text.split('\n');
const start = 4570;
const end = Math.min(4640, lines.length);
let out = '';
for(let i=start; i<end; i++) out += lines[i] + '\n';
fs.writeFileSync('dump2.txt', out, 'utf8');
