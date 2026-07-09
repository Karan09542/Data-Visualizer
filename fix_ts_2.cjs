const fs = require('fs');

let iw = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
iw = iw.replace(/\.\.\/\.\.\/image-import\/clipboard\/clipboardImporter/g, '../image-import/clipboard/clipboardImporter');
iw = iw.replace(/\.\/image-import\/clipboard\/clipboardImporter/g, '../image-import/clipboard/clipboardImporter');
fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', iw);

let apc = fs.readFileSync('src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts', 'utf8');
if (!apc.includes('import { setOpacityOnHex }')) {
  apc = 'import { setOpacityOnHex } from "../../utils/color";\n' + apc;
  fs.writeFileSync('src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts', apc);
}

let brushes = fs.readFileSync('src/components/image-workspace/fabric/brushes.ts', 'utf8');
brushes = brushes.replace('const createPatternSource', 'export const createPatternSource');
fs.writeFileSync('src/components/image-workspace/fabric/brushes.ts', brushes);

console.log('Fixed TS 2');
