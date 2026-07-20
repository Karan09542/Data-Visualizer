const fs = require('fs');

let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

const functionsCode = `
   const [layers, setLayers] = useState<fabric.Object[]>([]);
   const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

   const updateLayersList = useCallback(() => {
      if (!fabricRef.current) return;
      const items = fabricRef.current.getObjects();
      setLayers([...items].reverse());
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
   }, []);

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
code = code.replace(/const layersPanel = useLayersPanel\(fabricRef, executeCommand\);\n   const \{ layers, selectedLayerId, updateLayersList, handleLayerOrder \} = layersPanel;/, functionsCode); 
code = code.replace(/<LayersProvider value=\{layersPanel\}>/, '<LayersProvider value={{ layers, setLayers, selectedLayerId, setSelectedLayerId, updateLayersList, getLayersOrder, handleLayerOrder, selectLayer, moveLayerUp, moveLayerDown }}>');
code = code.replace(/import \{ useLayersPanel \} from '\.\/hooks\/useLayersPanel';\n/, '');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Restoration complete.');
