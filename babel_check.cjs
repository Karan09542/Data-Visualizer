const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });
  console.log('Babel parsed successfully!');
} catch (e) {
  console.log(`Syntax Error at line ${e.loc?.line}, col ${e.loc?.column}: ${e.message}`);
}
