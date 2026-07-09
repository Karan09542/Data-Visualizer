const fs = require('fs');
const code = fs.readFileSync('src/components/ImageWorkspace.tsx', 'utf8');
const start = code.indexOf('const updateLayersList = useCallback');
const match = code.substring(start).match(/const updateLayersList = useCallback[\s\S]*?\}, \[\]\);/);
if (match) {
    fs.writeFileSync('missing_code.txt', match[0]);
    console.log('Found missing code, length:', match[0].length);
} else {
    console.log('Not found');
}
