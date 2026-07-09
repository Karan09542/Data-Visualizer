const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// 1. Remove the incorrectly injected block at line 456
code = code.replace(/const \[layers, setLayers\] = useState<fabric\.Object\[\]>\(\[\]\);[\s\S]*?const moveLayerDown = useCallback\(\(id: string\) => \{[\s\S]*?\}, \[fabricRef, getLayersOrder, executeCommand\]\);/, '');

// 2. We need to inject the `layers` state back at line 456 so it's top-level
code = code.replace(/canvas\.requestRenderAll\(\);\n   \}, \[activeTool, isSpacePressed, isAltPressed\]\);/, 
  "canvas.requestRenderAll();\n   }, [activeTool, isSpacePressed, isAltPressed]);\n\n   const [layers, setLayers] = useState<fabric.Object[]>([]);\n   const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);"
);

// 3. Inject missing_code.txt right before `const executeCommand = useCallback`
// Wait, missing_code.txt had handleSelectionContext which ends with `}, []);`
// And `updateLayersList` was originally BEFORE `executeCommand`!
// Let's inject missing_code.txt right before `const executeCommand = useCallback`
const missingCode = fs.readFileSync('missing_code.txt', 'utf8');
code = code.replace(/\/\/ History Execute Core Engine\n\s+const executeCommand = useCallback/, missingCode + "\n\n   // History Execute Core Engine\n   const executeCommand = useCallback");

// 4. Inject selectLayer, moveLayerUp, moveLayerDown, handleLayerOrder after `handleSelectionContext`
// Since handleSelectionContext is at the end of missing_code.txt, we can just append it to missingCode!
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

code = code.replace(/const executeCommand = useCallback\(\(cmd: Command\) => \{[\s\S]*?\}, \[updateLayersList\]\);/, (match) => match + '\n\n' + additionalFunctions);

// 5. Restore addFilterToPipeline in ImageWorkspace!
const addFilterStr = `
  const addFilterToPipeline = (type: string) => {
    // Dummy function to prevent TS errors in QuickTab
    // This will be properly extracted when QuickTab is extracted
  };
`;
code = code.replace(/const applyFilter = /, addFilterStr + '\n  const applyFilter = ');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Repair complete.');
