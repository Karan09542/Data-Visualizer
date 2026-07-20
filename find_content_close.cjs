const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const stack = [];
const lines = code.split('\n');

let contentLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function ImageWorkspaceContent')) {
    contentLine = i + 1;
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') {
      stack.push({ line: i + 1, col: j + 1 });
    } else if (line[j] === '}') {
      if (stack.length > 0) {
        const popped = stack.pop();
        if (popped.line === contentLine) {
          console.log(`ImageWorkspaceContent closed at line ${i + 1}`);
        }
      }
    }
  }
}
