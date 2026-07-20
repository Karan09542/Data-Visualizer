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
    
    // Add "export " to const/function/let declarations
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
        start: /^\/\/ Cache to prevent multiple compilations/m,
        end: /^\s*return await threads\(\);\n\s*\} catch \{\n\s*return false;\n\s*\}\n\};/m,
        out: 'src/components/image-workspace/services/export/jsquash.ts',
        imports: '',
        replace: 'import { isPngInitialised, isResizeInitialised, isJpegInitialised, isWebpInitialised, isAvifInitialised, loadWasmModule, hasSimd, hasThreads, pngWasmUrl, jpegWasmUrl, webpWasmUrl, webpSimdWasmUrl, avifWasmUrl, avifMtWasmUrl, resizeWasmUrl } from "./image-workspace/services/export/jsquash";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/utils\/color\.ts\nconst setOpacityOnHex/m,
        end: /^\};/m,
        out: 'src/components/image-workspace/utils/color.ts',
        imports: '',
        replace: 'import { setOpacityOnHex } from "./image-workspace/utils/color";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/fabric\/brushes\.ts\nconst getBrushName/m,
        end: /^\};/m, // Wait, createPatternSource is right after it. Let's do both.
        out: 'src/components/image-workspace/fabric/brushes.ts',
        imports: '',
        replace: 'import { getBrushName, createPatternSource } from "./image-workspace/fabric/brushes";\n'
    },
    {
        start: /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/utils\/file\.ts\nfunction dataURLtoFile/m,
        end: /^\}/m,
        out: 'src/components/image-workspace/utils/file.ts',
        imports: '',
        replace: 'import { dataURLtoFile } from "./image-workspace/utils/file";\n'
    }
];

// Combine brush extractions
const brushStart = /^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/fabric\/brushes\.ts\nconst getBrushName/m;
const brushEndMatch = code.match(/^\/\/ TODO\(Refactor\): Move to src\/components\/image-workspace\/fabric\/brushes\.ts\nconst createPatternSource/m);

for (const ext of extractions) {
    if (ext.start === brushStart) {
        // Find the end of createPatternSource
        let startIndex = code.match(brushStart).index;
        let remaining = code.substring(startIndex);
        // createPatternSource is a function that ends with `return canvas; \n}`
        let endIdx = remaining.indexOf('return canvas;\n};');
        if (endIdx === -1) endIdx = remaining.indexOf('return canvas;\n}');
        if (endIdx !== -1) {
            let block = remaining.substring(0, endIdx + 'return canvas;\n}'.length);
            block = block.replace(/^(const|let|function|class) /gm, 'export $1 ');
            fs.writeFileSync(ext.out, block + '\n');
            code = code.substring(0, startIndex) + ext.replace + code.substring(startIndex + block.length);
            console.log(`Extracted ${ext.out}`);
        } else {
             console.log('Failed to extract brushes');
        }
    } else {
        if (extractAndReplace(ext.start, ext.end, ext.out, ext.imports, ext.replace)) {
            console.log(`Extracted ${ext.out}`);
        } else {
            console.log(`Failed to extract ${ext.out}`);
        }
    }
}

// Since isPngInitialised etc need to be mutated in ImageWorkspace, but they are imported, TypeScript will complain because imported variables are read-only!
// Actually, `ImageWorkspace.tsx` mutates them: `isPngInitialised = true;`
// We need to either export setter functions or use an object for state. Let's fix this later, for now we let it be extracted.

fs.writeFileSync(srcFile, code);
console.log('Phase 3 & 4 (partial) extractions completed.');
