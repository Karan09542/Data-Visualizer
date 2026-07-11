const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
try {
  acorn.Parser.extend(jsx()).parse(code, { ecmaVersion: 2020, sourceType: 'module' });
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax Error at line', e.loc ? e.loc.line : e, ':', e.message);
}
