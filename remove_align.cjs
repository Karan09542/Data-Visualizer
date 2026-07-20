const fs = require('fs');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const alignStartIdx = code.indexOf("   const alignSelection = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'fit' | 'fill' | 'stretch' | 'fitWidth' | 'fitHeight' | 'utils_fitInside' | 'utils_centerInside' | 'matchWidth' | 'matchHeight' | 'distributeH' | 'distributeV') => {");

if (alignStartIdx === -1) {
    console.error("alignSelection not found");
    process.exit(1);
}

// Manually count braces
let braceCount = 0;
let endIdx = -1;

for (let i = alignStartIdx; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            endIdx = i;
            break;
        }
    }
}

if (endIdx !== -1) {
    // Also include `};\n` if it exists
    const fullEndIdx = code.indexOf(';\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 2 ? fullEndIdx + 2 : endIdx + 1;
    
    const newCode = code.substring(0, alignStartIdx) + code.substring(finalEnd);
    fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', newCode);
    console.log("Successfully removed alignSelection with brace matching.");
} else {
    console.error("Could not match braces for alignSelection");
}
