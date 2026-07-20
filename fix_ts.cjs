const fs = require('fs');

function replaceInFile(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}

replaceInFile('src/components/image-workspace/types/artboards.ts', 'interface Artboard', 'export interface Artboard');
replaceInFile('src/components/image-workspace/commands/base/Command.ts', 'interface Command', 'export interface Command');

let iw = fs.readFileSync('src/components/ImageWorkspace.tsx', 'utf8');
iw = iw.replace(/import \{ (.*?) \} from "\.\/commands/g, 'import { $1 } from "./image-workspace/commands');
iw = iw.replace(/import \{ (.*?) \} from "\.\/types/g, 'import { $1 } from "./image-workspace/types');
iw = iw.replace(/import \{ (.*?) \} from "\.\/services/g, 'import { $1 } from "./image-workspace/services');
fs.writeFileSync('src/components/ImageWorkspace.tsx', iw);

const addFabric = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import * as fabric')) {
    fs.writeFileSync(file, 'import * as fabric from "fabric";\n' + content);
  }
};

addFabric('src/components/image-workspace/commands/artboard/ArtboardStateCommand.ts');
addFabric('src/components/image-workspace/commands/artboard/DuplicateArtboardCommand.ts');
addFabric('src/components/image-workspace/commands/artboard/DeleteArtboardCommand.ts');
addFabric('src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts');
addFabric('src/components/image-workspace/services/filters/rebuildFabricFilters.ts');

console.log('Fixed TS errors.');
