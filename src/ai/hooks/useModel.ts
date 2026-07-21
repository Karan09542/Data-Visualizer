import { useState, useEffect, useMemo } from 'react';
import { opfsStorage } from '../manager/OPFSStorage';
import { modelRegistry } from '../registry/ModelRegistry';
import { aiService } from '../services/AIService';

export function useModel(modelId: string) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelSize, setModelSize] = useState(0);

  const manifest = useMemo(() => modelRegistry.get(modelId), [modelId]);

  useEffect(() => {
    if (!manifest) return;
    
    setIsChecking(true);
    
    if (manifest.sources[0]?.type === 'local') {
      setIsDownloaded(true);
      setModelSize(0);
      setIsChecking(false);
      return;
    }
    
    opfsStorage.hasModel(manifest).then(setIsDownloaded);
    opfsStorage.getModelSize(manifest).then(size => {
      setModelSize(size || 0);
      setIsChecking(false);
    });
  }, [manifest]);

  const preload = async () => {
    setIsDownloading(true);
    try {
      const { promise } = aiService.preloadModel(modelId);
      await promise;
      setIsDownloaded(true);
      const size = await opfsStorage.getModelSize(manifest!);
      setModelSize(size || 0);
    } catch (e) {
      console.error('Failed to preload model:', e);
      throw e;
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteModel = async () => {
    if (!manifest) return;
    try {
      await opfsStorage.deleteModel(manifest);
      setIsDownloaded(false);
      setModelSize(0);
    } catch (e) {
      console.error('Failed to delete model:', e);
    }
  };

  return { isDownloaded, isChecking, isDownloading, modelSize, preload, deleteModel };
}
