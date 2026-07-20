const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const startStr = 'const [layers, setLayers] = useState<fabric.Object[]>([]);';
const endStr = '   // UI Panels';
const start = code.indexOf(startStr);
const end = code.indexOf(endStr, start);

if (start !== -1 && end !== -1) {
    const block = code.substring(start, end);
    console.log('Removing block of length:', block.length);
    code = code.replace(block, 'const [layers, setLayers] = useState<fabric.Object[]>([]);\n   const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);\n\n');
    fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
    console.log('Done');
} else {
    console.log('Could not find bounds');
}
