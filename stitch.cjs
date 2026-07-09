const fs = require('fs');
const lines = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8').split('\n');

const topPart = lines.slice(0, 1506); // 1506 is the line with "  }, []);"
const bottomPart = lines.slice(4683); // 4684 is the line with "   const getLayersOrder = useCallback(() => {"

const newCode = [...topPart, ...bottomPart].join('\n');
fs.writeFileSync('src/components/image-workspace/ImageWorkspace_fixed.tsx', newCode);
console.log('Stitched! Length:', newCode.length);
