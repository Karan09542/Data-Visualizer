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
    
    code = code.substring(0, startIndex) + replaceWith + code.substring(endIndex);
    return true;
}

const extractions = [
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ModernCheckbox\.tsx\nconst ModernCheckbox =/m,
        end: /^\);\n\n/m,
        out: 'src/components/image-workspace/components/shared/ModernCheckbox.tsx',
        imports: 'import React from "react";\nimport { Check } from "lucide-react";',
        replace: 'import { ModernCheckbox } from "./image-workspace/components/shared/ModernCheckbox";\n\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/services\/export\/presets\.ts\nconst ARTBOARD_PRESETS/m,
        end: /^];/m,
        out: 'src/components/image-workspace/services/export/presets.ts',
        imports: '',
        replace: 'import { ARTBOARD_PRESETS } from "./image-workspace/services/export/presets";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ContextMenuItem\.tsx\nconst ContextMenuItem =/m,
        end: /^\);\n\n/m,
        out: 'src/components/image-workspace/components/shared/ContextMenuItem.tsx',
        imports: 'import React from "react";',
        replace: 'import { ContextMenuItem } from "./image-workspace/components/shared/ContextMenuItem";\n\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ToolBtn\.tsx\nconst ToolBtn =/m,
        end: /^\};\n\n/m,
        out: 'src/components/image-workspace/components/shared/ToolBtn.tsx',
        imports: 'import React from "react";',
        replace: 'import { ToolBtn } from "./image-workspace/components/shared/ToolBtn";\n\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/TabBtn\.tsx\nconst TabBtn =/m,
        end: /^\};\n\n/m,
        out: 'src/components/image-workspace/components/shared/TabBtn.tsx',
        imports: 'import React from "react";',
        replace: 'import { TabBtn } from "./image-workspace/components/shared/TabBtn";\n\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/BtnSelect\.tsx\nconst BtnSelect =/m,
        end: /^\);\n\n/m,
        out: 'src/components/image-workspace/components/shared/BtnSelect.tsx',
        imports: 'import React from "react";',
        replace: 'import { BtnSelect } from "./image-workspace/components/shared/BtnSelect";\n\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/FilterSlider\.tsx\nconst FilterSlider =/m,
        end: /^\}\n\n/m,
        out: 'src/components/image-workspace/components/shared/FilterSlider.tsx',
        imports: 'import React, { useState, useEffect } from "react";',
        replace: 'import { FilterSlider } from "./image-workspace/components/shared/FilterSlider";\n\n'
    }
];

// Combine ColorPickers
const cpStart = /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ColorPickers\.tsx\nconst ColorPickerPortal =/m;
const cpEndMatch = code.match(/^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ColorPickers\.tsx\nconst ColorPickerTrigger =/m);

for (const ext of extractions) {
    if (extractAndReplace(ext.start, ext.end, ext.out, ext.imports, ext.replace)) {
        console.log(`Extracted ${ext.out}`);
    } else {
        console.log(`Failed to extract ${ext.out}`);
    }
}

// Extract ColorPickers
let cpStartIndex = code.match(cpStart);
if (cpStartIndex) {
    let cpStartIndexPos = cpStartIndex.index;
    let remaining = code.substring(cpStartIndexPos);
    let endMatch = remaining.match(/^};\n/m); // End of ColorPickerTrigger
    if (!endMatch) endMatch = remaining.match(/^}\n/m);
    
    // Actually ColorPickerTrigger is a component: const ColorPickerTrigger = ... => ( ... ) or { return ... };
    // Let's find `const ContextMenuItem` as the end boundary because it comes right after.
    const nextComponentMatch = remaining.match(/^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/components\/shared\/ContextMenuItem/m);
    if (nextComponentMatch) {
        let block = remaining.substring(0, nextComponentMatch.index);
        block = block.replace(/^(const|let|function|class) /gm, 'export $1 ');
        fs.writeFileSync('src/components/image-workspace/components/shared/ColorPickers.tsx', 'import React, { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";\nimport { RgbaStringColorPicker } from "react-colorful";\nimport { Pipette } from "lucide-react";\n\n' + block + '\n');
        
        code = code.substring(0, cpStartIndexPos) + 'import { ColorPickerPortal, ColorPickerTrigger } from "./image-workspace/components/shared/ColorPickers";\n\n' + code.substring(cpStartIndexPos + block.length);
        console.log('Extracted ColorPickers');
    } else {
        console.log('Failed to find end of ColorPickers block');
    }
} else {
    console.log('Failed to find start of ColorPickers block');
}

fs.writeFileSync(srcFile, code);
console.log('Phase 4 UI extractions completed.');
