const fs = require('fs');
const file = 'src/components/Toolbar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import\s+\*\s+as\s+snapdom\s+from\s+"@zumer\/snapdom";\s*/g, '');
content = content.replace(/Promise\.resolve\(snapdom\)\.then\(\(\{\s*preCache\s*\}\) => \{/g, `import("@zumer/snapdom").then(({ preCache }) => {`);
content = content.replace(/\/\/\s*statically\s*imported\s*snapdom/g, `const { snapdom } = await import("@zumer/snapdom");`);

fs.writeFileSync(file, content);
console.log('Update complete');
