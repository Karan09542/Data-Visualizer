const fs = require('fs');
const code = fs.readFileSync('temp_original.tsx', 'utf16le');
const lines = code.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') balance--;
  }
}
console.log('Original brace balance:', balance);
