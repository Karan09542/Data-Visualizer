const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Cut the History Execute Core Engine block
const executeStart = code.indexOf('   // History Execute Core Engine');
const executeEndStr = '      setCommandIndex(nextIndex);\n      setHistoryNames(commandsListRef.current.map(c => c.name));\n   }, [updateLayersList]);\n';
const executeEnd = code.indexOf(executeEndStr, executeStart) + executeEndStr.length;

if (executeStart !== -1 && executeEnd !== -1) {
    const executeBlock = code.substring(executeStart, executeEnd);
    code = code.substring(0, executeStart) + code.substring(executeEnd);
    
    // 2. Paste it right before getLayersOrder
    const insertIdx = code.indexOf('   const getLayersOrder = useCallback');
    if (insertIdx !== -1) {
        code = code.substring(0, insertIdx) + executeBlock + '\n\n' + code.substring(insertIdx);
        console.log('Swapped successfully!');
    }
}

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
