const fs = require('fs');
const path = require('path');

const srcFile = 'src/components/ImageWorkspace.tsx';
let code = fs.readFileSync(srcFile, 'utf-8');

function extractAndReplace(startRegex, endRegex, outPath, imports = '', replaceWith = '') {
    const startMatch = code.match(startRegex);
    if (!startMatch) {
        console.log(`Failed to find start match: ${startRegex}`);
        return false;
    }
    const startIndex = startMatch.index;
    
    const remainingCode = code.substring(startIndex);
    const endMatch = remainingCode.match(endRegex);
    if (!endMatch) {
        console.log(`Failed to find end match: ${endRegex}`);
        return false;
    }
    
    const endIndex = startIndex + endMatch.index + endMatch[0].length;
    let block = code.substring(startIndex, endIndex);
    
    // Add "export " to const/function declarations
    block = block.replace(/^(const|let|function|class) /gm, 'export $1 ');
    
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    
    fs.writeFileSync(outPath, (imports ? imports + '\n\n' : '') + block + '\n');
    
    code = code.substring(0, startIndex) + code.substring(endIndex);
    
    // add import to top
    code = replaceWith + code;
    return true;
}

const extractions = [
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/panels\/BrushPreview\.tsx\nconst BrushPreview =/m,
        end: /^  \);\n\};\n/m,
        out: 'src/components/image-workspace/components/panels/BrushPreview.tsx',
        imports: 'import React from "react";',
        replace: 'import { BrushPreview } from "./image-workspace/components/panels/BrushPreview";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/panels\/ObjectDimensionsPanel\.tsx\nconst ObjectDimensionsPanel =/m,
        end: /^\};\n\n/m,
        out: 'src/components/image-workspace/components/panels/ObjectDimensionsPanel.tsx',
        imports: 'import React, { useState, useEffect } from "react";\nimport * as fabric from "fabric";\nimport { AlignLeft, AlignCenter, AlignRight, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";',
        replace: 'import { ObjectDimensionsPanel } from "./image-workspace/components/panels/ObjectDimensionsPanel";\n'
    }
];

for (const ext of extractions) {
    if (extractAndReplace(ext.start, ext.end, ext.out, ext.imports, ext.replace)) {
        console.log(`Extracted ${ext.out}`);
    } else {
        console.log(`Failed to extract ${ext.out}`);
    }
}

fs.writeFileSync(srcFile, code);
console.log('Phase 5 panels extracted.');
