const fs = require('fs');
const file = 'src/components/Toolbar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace dynamic import with static import usage
content = content.replace(/import\("@zumer\/snapdom"\)\s*\.then\(\(\{\s*preCache\s*\}\) => \{/g, `Promise.resolve(snapdom).then(({ preCache }) => {`);

content = content.replace(/const\s+\{\s*snapdom\s*\}\s*=\s*await\s+import\("@zumer\/snapdom"\);/g, `// statically imported snapdom`);

fs.writeFileSync(file, content);
console.log('Update complete');
