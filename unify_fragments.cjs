const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/<React\.Fragment>/g, '<>');
code = code.replace(/<React\.Fragment key=\{/g, '<React.Fragment key={'); // keep the ones with keys!
code = code.replace(/<\/React\.Fragment>/g, '</>');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
