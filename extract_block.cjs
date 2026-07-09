const fs = require('fs');
const path = require('path');

const srcFile = 'src/components/ImageWorkspace.tsx';

function extractBlock(startRegexStr, endRegexStr, outPath, imports = '') {
    let code = fs.readFileSync(srcFile, 'utf-8');
    const startRegex = new RegExp(startRegexStr, 'm');
    const endRegex = new RegExp(endRegexStr, 'm');

    const startMatch = code.match(startRegex);
    if (!startMatch) {
        console.error('Could not find start match for:', startRegexStr);
        return;
    }
    const startIndex = startMatch.index;

    const remainingCode = code.substring(startIndex);
    const endMatch = remainingCode.match(endRegex);
    if (!endMatch) {
        console.error('Could not find end match for:', endRegexStr);
        return;
    }
    
    // endIndex should be the end of the matched string
    const endIndex = startIndex + endMatch.index + endMatch[0].length;

    const block = code.substring(startIndex, endIndex);
    
    // Ensure the output directory exists
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outPath, (imports ? imports + '\n\n' : '') + block + '\n');
    
    // Let's not remove the block automatically yet unless we are sure.
    // Actually, we WANT to remove it to refactor.
    // Replace the block with an import or just remove it if it's exported and imported at the top.
    
    // For now, let's just extract it. We will remove it separately using replace_file_content or we can replace it here with a placeholder.
    console.log(`Extracted block to ${outPath} (${block.split('\\n').length} lines)`);
}

const action = process.argv[2];
if (action === 'run') {
    const start = process.argv[3];
    const end = process.argv[4];
    const out = process.argv[5];
    const imps = process.argv[6] || '';
    extractBlock(start, end, out, imps);
}
