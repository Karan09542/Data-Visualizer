const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const regex = /\n      let canvasObjectsToClone: fabric\.Object\[\] = \[\];[\s\S]*?   \};\n/g;
code = code.replace(regex, '\n');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Deleted rest of duplicateArtboard');
