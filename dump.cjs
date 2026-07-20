const fs = require('fs');
const text = fs.readFileSync('temp_original.tsx', 'utf16le');
const lines = text.split('\n');
const start = 2320;
const end = Math.min(2395, lines.length);
let out = '';
for(let i=start; i<end; i++) out += lines[i] + '\n';
fs.writeFileSync('dump.txt', out, 'utf8');
