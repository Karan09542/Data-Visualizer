const fs = require('fs');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const fitViewStartIdx = code.indexOf("   const fitView = useCallback(() => {");
const validateViewportStartIdx = code.indexOf("   const validateViewport = useCallback(() => {");

if (fitViewStartIdx === -1 || validateViewportStartIdx === -1) {
    console.error("fitView or validateViewport not found");
    process.exit(1);
}

// Remove fitView
let braceCount = 0;
let endIdx = -1;
for (let i = fitViewStartIdx; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            endIdx = i;
            break;
        }
    }
}
const fullEndIdx = code.indexOf(', []);\n', endIdx);
const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 7 : endIdx + 1;
const newCode1 = code.substring(0, fitViewStartIdx) + code.substring(finalEnd);

// Remove validateViewport
const valStartIdx = newCode1.indexOf("   const validateViewport = useCallback(() => {");
braceCount = 0;
endIdx = -1;
for (let i = valStartIdx; i < newCode1.length; i++) {
    if (newCode1[i] === '{') braceCount++;
    else if (newCode1[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            endIdx = i;
            break;
        }
    }
}
const fullValEndIdx = newCode1.indexOf(', [fitView]);\n', endIdx);
const finalValEnd = fullValEndIdx !== -1 && fullValEndIdx - endIdx <= 3 ? fullValEndIdx + 14 : endIdx + 1;
const newCode2 = newCode1.substring(0, valStartIdx) + newCode1.substring(finalValEnd);

// Write back
fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', newCode2);
console.log("Successfully removed fitView and validateViewport.");
