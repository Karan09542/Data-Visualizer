import { useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { LayerReorderCommand } from '../commands/layer/LayerReorderCommand';

export const useLayersPanel = (
  fabricRef: React.RefObject<fabric.Canvas | null>,
  executeCommand: (cmd: any) => void
) => {
  const [layers, setLayers] = useState<fabric.Object[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const updateLayersList = useCallback(() => {
    if (!fabricRef.current) return;
    const items = fabricRef.current.getObjects();
    setLayers([...items].reverse()); // Top layer first
  }, [fabricRef]);

  const getLayersOrder = useCallback(() => {
    if (!fabricRef.current) return [];
    return fabricRef.current.getObjects().map((obj: any, idx) => ({
      id: obj.id as string,
      idx
    }));
  }, [fabricRef]);

  const handleLayerOrder = useCallback((action: 'front' | 'forward' | 'backward' | 'back') => {
    if (!fabricRef.current) return;
    const activeObjects = fabricRef.current.getActiveObjects();
    if (!activeObjects || activeObjects.length === 0) return;

    const beforeOrder = getLayersOrder();

    if (action === 'front') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxA - idxB;
      });
      sorted.forEach(obj => fabricRef.current?.bringObjectToFront(obj));
    } else if (action === 'back') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxB - idxA;
      });
      sorted.forEach(obj => fabricRef.current?.sendObjectToBack(obj));
    } else if (action === 'forward') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxB - idxA;
      });
      sorted.forEach(obj => fabricRef.current?.bringObjectForward(obj));
    } else if (action === 'backward') {
      const sorted = [...activeObjects].sort((a: any, b: any) => {
         const idxA = fabricRef.current!.getObjects().indexOf(a);
         const idxB = fabricRef.current!.getObjects().indexOf(b);
         return idxA - idxB;
      });
      sorted.forEach(obj => fabricRef.current?.sendObjectBackwards(obj));
    }

    const afterOrder = getLayersOrder();
    if (JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)) return;

    const cmdName = action === 'front' ? 'Bring to Front' : action === 'back' ? 'Send to Back' : action === 'forward' ? 'Bring Forward' : 'Send Backward';
    const cmd = new LayerReorderCommand(cmdName, beforeOrder, afterOrder);
    
    cmd.undo(fabricRef.current, () => {});
    
    executeCommand(cmd);
    updateLayersList();
  }, [fabricRef, getLayersOrder, executeCommand, updateLayersList]);

  const selectLayer = useCallback((id: string) => {
    if (!fabricRef.current) return;
    const items = fabricRef.current.getObjects();
    const obj = items.find((o: any) => o.id === id);
    if (obj) {
       fabricRef.current.setActiveObject(obj);
       fabricRef.current.renderAll();
    }
  }, [fabricRef]);

  const moveLayerUp = useCallback((id: string) => {
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
  }, [fabricRef, getLayersOrder, executeCommand]);

  const moveLayerDown = useCallback((id: string) => {
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
  }, [fabricRef, getLayersOrder, executeCommand]);

  return {
    layers,
    setLayers,
    selectedLayerId,
    setSelectedLayerId,
    updateLayersList,
    getLayersOrder,
    handleLayerOrder,
    selectLayer,
    moveLayerUp,
    moveLayerDown
  };
};
