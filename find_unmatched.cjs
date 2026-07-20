const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const stack = [];
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') {
      stack.push({ line: i + 1, col: j + 1 });
    } else if (line[j] === '}') {
      if (stack.length === 0) {
        console.log(`Unmatched } at line ${i + 1}, col ${j + 1}:`, line);
      } else {
        stack.pop();
      }
    }
  }
}

if (stack.length > 0) {
  console.log('Unmatched { at:');
  for (const item of stack) {
    console.log(`Line ${item.line}, col ${item.col}:`, lines[item.line - 1]);
  }
} else {
  console.log('All matched perfectly!?');
}
