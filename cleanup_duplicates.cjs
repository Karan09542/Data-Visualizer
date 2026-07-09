const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const firstIdx = code.indexOf('const getLayersOrder = useCallback');
const secondIdx = code.indexOf('const getLayersOrder = useCallback', firstIdx + 1);
if (secondIdx !== -1) {
    const endStr = 'executeCommand(cmd);\n      }\n   };';
    const endIdx = code.indexOf(endStr, secondIdx) + endStr.length;
    console.log('Removing duplicate layers logic');
    code = code.substring(0, secondIdx) + code.substring(endIdx);
}

const addFilterStr = 'const addFilterToPipeline = (type: string) => {';
const f1 = code.indexOf(addFilterStr);
const f2 = code.indexOf(addFilterStr, f1 + 1);
if (f2 !== -1) {
   const endIdx = code.indexOf('};', f2) + 2;
   console.log('Removing duplicate addFilterToPipeline');
   code = code.substring(0, f2) + code.substring(endIdx);
}

// Fix Property 'type' does not exist on type 'unknown' at 4631
code = code.replace(/\(obj: unknown\)/g, '(obj: any)');
code = code.replace(/e\.target\.files\[0\]/g, '(e.target.files as any)[0]');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Duplicates cleaned.');
