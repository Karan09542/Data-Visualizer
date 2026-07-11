const fs = require('fs');

const code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const snapStartIdx = code.indexOf("   const handleSnapping = useCallback((e: any) => {");

if (snapStartIdx === -1) {
    console.error("handleSnapping not found");
    process.exit(1);
}

// Manually count braces
let braceCount = 0;
let endIdx = -1;

for (let i = snapStartIdx; i < code.length; i++) {
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
    // Also include `}, []);\n` if it exists
    const fullEndIdx = code.indexOf(', []);\n', endIdx);
    const finalEnd = fullEndIdx !== -1 && fullEndIdx - endIdx <= 3 ? fullEndIdx + 7 : endIdx + 1;
    
    let newCode = code.substring(0, snapStartIdx) + code.substring(finalEnd);
    fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', newCode);
    console.log("Successfully removed handleSnapping with brace matching.");
} else {
    console.error("Could not match braces for handleSnapping");
}
