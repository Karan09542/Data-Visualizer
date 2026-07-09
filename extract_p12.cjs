const fs = require('fs');
const path = require('path');

const srcFile = 'src/components/ImageWorkspace.tsx';
let code = fs.readFileSync(srcFile, 'utf-8');

function extractAndReplace(startRegex, endRegex, outPath, imports = '', replaceWith = '') {
    const startMatch = code.match(startRegex);
    if (!startMatch) return false;
    const startIndex = startMatch.index;
    
    const remainingCode = code.substring(startIndex);
    const endMatch = remainingCode.match(endRegex);
    if (!endMatch) return false;
    
    const endIndex = startIndex + endMatch.index + endMatch[0].length;
    const block = code.substring(startIndex, endIndex);
    
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    
    fs.writeFileSync(outPath, (imports ? imports + '\n\n' : '') + block + '\n');
    
    code = code.substring(0, startIndex) + replaceWith + code.substring(endIndex);
    return true;
}

// Phase 1 & 2
const extractions = [
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/base\/Command\.ts\ninterface Command \{/m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/base/Command.ts',
        imports: 'import * as fabric from "fabric";',
        replace: 'import { Command } from "./commands/base/Command";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/base\/MacroCommand\.ts\nclass MacroCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/base/MacroCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "./Command";',
        replace: 'import { MacroCommand } from "./commands/base/MacroCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/object\/AddObjectCommand\.ts\nclass AddObjectCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/object/AddObjectCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { AddObjectCommand } from "./commands/object/AddObjectCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/object\/DeleteObjectCommand\.ts\nclass DeleteObjectCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/object/DeleteObjectCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { DeleteObjectCommand } from "./commands/object/DeleteObjectCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/object\/TransformCommand\.ts\nclass TransformObjectsCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/object/TransformCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { TransformObjectsCommand } from "./commands/object/TransformCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/object\/PropertyCommand\.ts\nclass PropertyChangeCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/object/PropertyCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { PropertyChangeCommand } from "./commands/object/PropertyCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/object\/PropertyCommand\.ts\nclass StyleChangeCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/object/StyleChangeCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { StyleChangeCommand } from "./commands/object/StyleChangeCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/layer\/LayerReorderCommand\.ts\nclass LayerReorderCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/layer/LayerReorderCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { LayerReorderCommand } from "./commands/layer/LayerReorderCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/filter\/FilterPipelineCommand\.ts\nclass FilterChangeCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/filter/FilterChangeCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";',
        replace: 'import { FilterChangeCommand } from "./commands/filter/FilterChangeCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/filter\/FilterPipelineCommand\.ts\nclass FilterPipelineCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/filter/FilterPipelineCommand.ts',
        imports: 'import * as fabric from "fabric";\nimport { Command } from "../base/Command";\nimport { rebuildFabricFilters } from "../../services/filters/rebuildFabricFilters";\nimport { FilterConfig } from "../../types/filters";',
        replace: 'import { FilterPipelineCommand } from "./commands/filter/FilterPipelineCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/types\/filters\.ts\nexport interface FilterConfig /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/types/filters.ts',
        imports: '',
        replace: 'import { FilterConfig } from "./types/filters";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/services\/filters\/rebuildFabricFilters\.ts\nexport function rebuildFabricFilters/m,
        end: /^\}/m,
        out: 'src/components/image-workspace/services/filters/rebuildFabricFilters.ts',
        imports: 'import { FilterConfig } from "../../types/filters";',
        replace: 'import { rebuildFabricFilters } from "./services/filters/rebuildFabricFilters";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/types\/artboards\.ts\ninterface Artboard /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/types/artboards.ts',
        imports: '',
        replace: 'import { Artboard } from "./types/artboards";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/artboard\/ArtboardStateCommand\.ts\nclass ArtboardStateCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/artboard/ArtboardStateCommand.ts',
        imports: 'import { Command } from "../base/Command";\nimport { Artboard } from "../../types/artboards";',
        replace: 'import { ArtboardStateCommand } from "./commands/artboard/ArtboardStateCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/artboard\/DuplicateArtboardCommand\.ts\nclass DuplicateArtboardCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/artboard/DuplicateArtboardCommand.ts',
        imports: 'import { Command } from "../base/Command";\nimport { Artboard } from "../../types/artboards";',
        replace: 'import { DuplicateArtboardCommand } from "./commands/artboard/DuplicateArtboardCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/artboard\/DeleteArtboardCommand\.ts\nclass DeleteArtboardCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/artboard/DeleteArtboardCommand.ts',
        imports: 'import { Command } from "../base/Command";\nimport { Artboard } from "../../types/artboards";',
        replace: 'import { DeleteArtboardCommand } from "./commands/artboard/DeleteArtboardCommand";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/commands\/artboard\/ArtboardStateCommand\.ts\nclass ArtboardPropertyCommand /m,
        end: /^\}/m,
        out: 'src/components/image-workspace/commands/artboard/ArtboardPropertyCommand.ts',
        imports: 'import { Command } from "../base/Command";\nimport { Artboard } from "../../types/artboards";',
        replace: 'import { ArtboardPropertyCommand } from "./commands/artboard/ArtboardPropertyCommand";\n'
    }
];

for (const ext of extractions) {
    if (extractAndReplace(ext.start, ext.end, ext.out, ext.imports, ext.replace)) {
        console.log(`Extracted ${ext.out}`);
    } else {
        console.log(`Failed to extract ${ext.out}`);
    }
}

// Write the modified code back
fs.writeFileSync(srcFile, code);
console.log('Phase 1 & 2 extractions completed.');
