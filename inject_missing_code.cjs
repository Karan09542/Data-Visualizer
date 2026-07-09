const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');
const missingCode = fs.readFileSync('missing_code.txt', 'utf8');

const targetStr = '// History Execute Core Engine';
const idx = code.indexOf(targetStr);

if (idx !== -1) {
    code = code.substring(0, idx) + missingCode + '\n\n   ' + code.substring(idx);
    
    // Now also inject additional functions at the end of missing_code
    // Actually wait, let's just inject additional functions AFTER handleSelectionContext
    
    const additionalFunctions = `
   const getLayersOrder = useCallback(() => {
      if (!fabricRef.current) return [];
      return fabricRef.current.getObjects().map((obj: any, idx) => ({
         id: obj.id as string,
         idx
      }));
   }, []);

   const handleLayerOrder = useCallback((action: 'front' | 'forward' | 'backward' | 'back') => {
      if (!fabricRef.current) return;
      const activeObjects = fabricRef.current.getActiveObjects();
      if (!activeObjects || activeObjects.length === 0) return;

      const beforeOrder = getLayersOrder();

      if (action === 'front') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(a) - fabricRef.current.getObjects().indexOf(b));
         sorted.forEach(obj => fabricRef.current.bringObjectToFront(obj));
      } else if (action === 'back') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(b) - fabricRef.current.getObjects().indexOf(a));
         sorted.forEach(obj => fabricRef.current.sendObjectToBack(obj));
      } else if (action === 'forward') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(b) - fabricRef.current.getObjects().indexOf(a));
         sorted.forEach(obj => fabricRef.current.bringObjectForward(obj));
      } else if (action === 'backward') {
         const sorted = [...activeObjects].sort((a: any, b: any) => fabricRef.current.getObjects().indexOf(a) - fabricRef.current.getObjects().indexOf(b));
         sorted.forEach(obj => fabricRef.current.sendObjectBackwards(obj));
      }

      const afterOrder = getLayersOrder();
      if (JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)) return;

      const cmdName = action === 'front' ? 'Bring to Front' : action === 'back' ? 'Send to Back' : action === 'forward' ? 'Bring Forward' : 'Send Backward';
      const cmd = new LayerReorderCommand(cmdName, beforeOrder, afterOrder);
      
      cmd.undo(fabricRef.current, updateLayersList);
      executeCommand(cmd);
      updateLayersList();
   }, [getLayersOrder, executeCommand, updateLayersList]);

   const selectLayer = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         fabricRef.current.setActiveObject(obj);
         fabricRef.current.renderAll();
      }
   };

   const moveLayerUp = (id: string) => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      const obj = items.find((o: any) => o.id === id);
      if (obj) {
         const beforeOrder = getLayersOrder();
         fabricRef.current.bringObjectForward(obj);
         const afterOrder = getLayersOrder();

         fabricRef.current.sendObjectBackwards(obj);
         const cmd = new LayerReorderCommand("Move Layer Up", beforeOrder, afterOrder);
         executeCommand(cmd);
      }
   };

   const moveLayerDown = (id: string) => {
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
   };
`;
    // We will inject additionalFunctions before "// 4. Event Listeners" or similar.
    const evtIdx = code.indexOf('   // 4. Event Listeners');
    if (evtIdx !== -1) {
        code = code.substring(0, evtIdx) + additionalFunctions + '\n\n' + code.substring(evtIdx);
    } else {
        // Just inject at the end of missing_code
        const hscEnd = code.indexOf('handleSelectionContext');
        const hscEndBracket = code.indexOf('  }, []);', hscEnd);
        if (hscEndBracket !== -1) {
            code = code.substring(0, hscEndBracket + 9) + '\n' + additionalFunctions + '\n' + code.substring(hscEndBracket + 9);
        }
    }
    
    // Add addFilterToPipeline
    const dummyFilter = `
  const addFilterToPipeline = (type: string) => {
  };
`;
    const quickIdx = code.indexOf('const applyFilter =');
    if (quickIdx !== -1) {
        code = code.substring(0, quickIdx) + dummyFilter + '\n' + code.substring(quickIdx);
    }
    
    fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
    console.log('Injected successfully');
} else {
    console.log('Failed to find target');
}
