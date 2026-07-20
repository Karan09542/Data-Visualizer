const fs = require('fs');

// 1. Fix ExportController.ts
let cCode = fs.readFileSync('src/components/image-workspace/services/ExportController.ts', 'utf8');
cCode = cCode.replace(/await generateArtboardPixelBuffer\(board\);/g, "await generateArtboardPixelBuffer(canvas, board);");
fs.writeFileSync('src/components/image-workspace/services/ExportController.ts', cCode);

// 2. Remove generateArtboardPixelBuffer and optimizePixelBuffer from ImageWorkspace.tsx
let iwCode = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const genStartIdx = iwCode.indexOf("   const generateArtboardPixelBuffer = async (board: Artboard): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {");
if (genStartIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = genStartIdx; i < iwCode.length; i++) {
        if (iwCode[i] === '{') braceCount++;
        else if (iwCode[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    const fullEndIdx = iwCode.indexOf(';\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 2 : endIdx + 1;
    iwCode = iwCode.substring(0, genStartIdx) + iwCode.substring(finalEnd);
}

const optStartIdx = iwCode.indexOf("   const optimizePixelBuffer = async (");
if (optStartIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = optStartIdx; i < iwCode.length; i++) {
        if (iwCode[i] === '{') braceCount++;
        else if (iwCode[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    const fullEndIdx = iwCode.indexOf(';\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 2 : endIdx + 1;
    iwCode = iwCode.substring(0, optStartIdx) + iwCode.substring(finalEnd);
}

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', iwCode);
console.log("Fixed export functions.");
