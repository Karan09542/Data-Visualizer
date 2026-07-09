const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Delete duplicate moveLayerDown
const moveLayerDownStr = \`   const moveLayerDown = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         const beforeOrder = getLayersOrder();
         fabricRef.current.sendObjectBackwards(obj);
         const afterOrder = getLayersOrder();

         fabricRef.current.bringObjectForward(obj);
         const cmd = new LayerReorderCommand("Move Layer Down", beforeOrder, afterOrder);
         executeCommand(cmd);
      }
   };\`;

const f1 = code.indexOf('const moveLayerDown = (id: string)');
const f2 = code.indexOf('const moveLayerDown = (id: string)', f1 + 1);
if (f2 !== -1) {
    const endStr = 'executeCommand(cmd);\n      }\n   };';
    const endIdx = code.indexOf(endStr, f2) + endStr.length;
    code = code.substring(0, f2 - 4) + code.substring(endIdx); // -4 to include leading spaces
}

// 2. Move executeCommand up
const execStart = code.indexOf('   // History Execute Core Engine');
const execEndStr = 'setHistoryNames(commandsListRef.current.map(c => c.name));\n   }, [updateLayersList]);';
const execEnd = code.indexOf(execEndStr, execStart) + execEndStr.length;

if (execStart !== -1 && execEnd !== -1) {
    const execBlock = code.substring(execStart, execEnd);
    code = code.substring(0, execStart) + code.substring(execEnd);
    
    const insertIdx = code.indexOf('   const getLayersOrder = useCallback');
    if (insertIdx !== -1) {
        code = code.substring(0, insertIdx) + execBlock + '\n\n' + code.substring(insertIdx);
    }
}

// 3. Fix unknown types
code = code.replace(/Array\.from\\(files\\)\.map\\(file => \\{/g, 'Array.from(files).map((file: any) => {');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Final TS fixes applied.');
