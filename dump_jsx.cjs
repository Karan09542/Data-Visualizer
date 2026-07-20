const fs = require('fs');
const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// Find the start of the return statement
const returnIdx = code.indexOf('return (');
console.log('Return starts at', returnIdx);

if (returnIdx > -1) {
  const jsx = code.substring(returnIdx, returnIdx + 5000);
  console.log(jsx);
}
