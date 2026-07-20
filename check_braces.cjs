const fs = require('fs');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
const lines = code.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') balance--;
  }
}
console.log('Final brace balance:', balance);
