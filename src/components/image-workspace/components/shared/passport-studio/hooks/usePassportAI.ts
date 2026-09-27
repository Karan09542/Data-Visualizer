import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useModelDownload } from '../../../../../../ai/hooks/useModelDownload';
import { ai } from '../../../../../../ai';
import { aiEngine } from '../../../../../../ai/manager/AIEngine';
import { modelRegistry } from '../../../../../../ai/registry/ModelRegistry';
import { aiInferenceCache } from '../../../../../../ai/manager/AIInferenceCache';
import type { PassportBackground } from '../../PassportBackgroundPicker';
import type { PhotoQueueItem } from '../types';

type Options = {
  photoQueue: PhotoQueueItem[];
  setPhotoQueue: React.Dispatch<React.SetStateAction<PhotoQueueItem[]>>;
  initialAutoAdjust: boolean;
};

/**
 * AI auto-adjust pipeline: face detection -> background removal -> passport crop, with per-photo
 * caching so that changing only the background re-renders instantly.
 */
export function usePassportAI({ photoQueue, setPhotoQueue, initialAutoAdjust }: Options) {
  const [autoAdjust, setAutoAdjust] = useState(initialAutoAdjust);
  const [hasAppliedAI, setHasAppliedAI] = useState(false);
  const [applyTargetMode, setApplyTargetMode] = useState<'all' | 'specific'>('all');
  const [applyTargetIds, setApplyTargetIds] = useState<string[]>([]);
  const aiResultsCache = useRef<Record<string, {
    imageData: ImageData,
    detectionResult: any,
    bgResult: any,
    faceModel: string,
    bgModel: string
  }>>({});

  const faceModels = useMemo(() => modelRegistry.getForTask('face-detection'), []);
  const bgModels = useMemo(() => modelRegistry.getForTask('background-removal'), []);
  const [faceModel, setFaceModel] = useState<string>(faceModels.length > 0 ? faceModels[0].id : 'blaze_face_short_range');
  const [bgModel, setBgModel] = useState<string>('u2netp');
  const [background, setBackground] = useState<PassportBackground>({ type: 'color', color: 'rgba(255, 255, 255, 1)' });
  const [aiError, setAiError] = useState<string | null>(null);
  // Auto-Adjust runs face detection and background removal, so both have to be on the device.
  const faceModelState = useModelDownload(faceModel);
  const bgModelState = useModelDownload(bgModel);
  const aiModelsReady = faceModelState.isReady && bgModelState.isReady;
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Process photo through AI pipeline (Face Detection -> Background Removal -> Crop)
  const processPhotoWithAI = async (dataUrl: string, hideOverlay = false): Promise<string | null> => {
    if (!hideOverlay) {
      setIsProcessingAI(true);
      setProcessingStatus('Preparing Image...');
    }
    setAiError(null);
    try {
      let imageData: ImageData;
      let detectionResult: any;
      let bgResult: any;

      console.log("[processPhotoWithAI] Start processing:", dataUrl.substring(0, 50), "hideOverlay:", hideOverlay);

      const cache = aiResultsCache.current[dataUrl];
      const isSameFaceModel = cache?.faceModel === faceModel;
      const isSameBgModel = cache?.bgModel === bgModel;

      if (cache && isSameFaceModel && isSameBgModel) {
        // Fast path: Reuse previously extracted image data and AI outputs
        imageData = cache.imageData;
        detectionResult = cache.detectionResult;
        bgResult = cache.bgResult;
      } else {
        // Slow path: Process image, run models, update cache
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (!hideOverlay) setProcessingStatus('Detecting Face...');
        const imageHash = await aiInferenceCache.hashImage(imageData);
        const faceCacheKey = aiInferenceCache.getCacheKey(imageHash, faceModel);
        detectionResult = aiInferenceCache.get(faceCacheKey)?.result;
        if (!detectionResult) {
          const { promise } = ai.execute('face-detection', imageData, { modelId: faceModel });
          const faceRes = await promise;
          detectionResult = faceRes.output;
          aiInferenceCache.set(faceCacheKey, faceModel, imageHash, detectionResult);
        }

        if (!hideOverlay) setProcessingStatus('Removing Background...');
        const bgCacheKey = aiInferenceCache.getCacheKey(imageHash, bgModel);
        bgResult = aiInferenceCache.get(bgCacheKey)?.result;
        if (!bgResult) {
          const { promise } = ai.execute('background-removal', imageData, { modelId: bgModel });
          const bgRes = await promise;
          bgResult = bgRes.output;
          aiInferenceCache.set(bgCacheKey, bgModel, imageHash, bgResult);
        }

        aiResultsCache.current[dataUrl] = {
          imageData,
          detectionResult,
          bgResult,
          faceModel,
          bgModel
        };
      }

      let finalSourceImageData = imageData;
      if (bgResult instanceof ImageData) {
        finalSourceImageData = bgResult;
      }

      setProcessingStatus('Applying Passport Layout...');
      const workerInstance = aiEngine.effectPool.getAvailableWorker();
      if (!workerInstance) throw new Error('No available workers');

      aiEngine.effectPool.setWorkerBusy(workerInstance.id, true);

      const transferables: Transferable[] = [];
      const imageBitmap = await createImageBitmap(finalSourceImageData);
      transferables.push(imageBitmap);

      const safeOptions: any = {};
      console.log("[processPhotoWithAI] Applying bg:", background.type, background.color);
      if (background.type === 'color') safeOptions.backgroundColor = background.color;
      if (background.type === 'image' && background.imageEl) {
        safeOptions.backgroundImage = await createImageBitmap(background.imageEl);
        transferables.push(safeOptions.backgroundImage);
      }

      const finalImage = await new Promise<ImageBitmap | ImageData | null>((resolve, reject) => {
        const messageId = Math.random().toString(36).substring(7);
        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === messageId) {
            workerInstance.worker.removeEventListener('message', handleMessage);
            aiEngine.effectPool.setWorkerBusy(workerInstance.id, false);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
          }
        };
        workerInstance.worker.addEventListener('message', handleMessage);
        workerInstance.worker.postMessage({
          id: messageId,
          effectId: 'passport-crop',
          sourceImage: imageBitmap,
          faceDetection: detectionResult,
          options: safeOptions
        }, transferables);
      });

      if (!finalImage) return null;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = finalImage.width;
      outCanvas.height = finalImage.height;
      const outCtx = outCanvas.getContext('2d')!;
      if (finalImage instanceof ImageData) {
        outCtx.putImageData(finalImage, 0, 0);
      } else {
        outCtx.drawImage(finalImage, 0, 0);
      }

      return outCanvas.toDataURL();
    } catch (e) {
      // Returning dataUrl here made a failure indistinguishable from success: the caller counted
      // the unchanged image as "applied", flipped hasAppliedAI and showed nothing. On mobile,
      // where model fetch/inference fails far more often, that reads as "AI silently does nothing".
      console.error('[PassportPrintModal] AI Auto-Adjust failed', e);
      setAiError(e instanceof Error ? e.message : 'The AI model could not be run on this device.');
      return null;
    } finally {
      if (!hideOverlay) {
        setIsProcessingAI(false);
        setProcessingStatus('');
      }
    }
  };

  const applyToTargets = async () => {
    if (photoQueue.length === 0) {
      alert("Queue is empty. Please upload a photo first.");
      return;
    }

    const targets = applyTargetMode === 'all'
      ? photoQueue
      : photoQueue.filter(p => applyTargetIds.includes(p.id));

    if (targets.length === 0) {
      alert("Please select at least one photo to adjust.");
      return;
    }

    let appliedCount = 0;
    let nextQueue = [...photoQueue];

    for (const target of targets) {
      const srcToProcess = target.originalSrc || target.src;
      const aiResult = await processPhotoWithAI(srcToProcess);
      if (aiResult) {
        const idx = nextQueue.findIndex(p => p.id === target.id);
        if (idx !== -1) {
          nextQueue[idx] = { ...nextQueue[idx], src: aiResult, originalSrc: srcToProcess };
        }
        appliedCount++;
      }
    }

    if (appliedCount > 0) {
      setPhotoQueue(nextQueue);
      setHasAppliedAI(true);
    } else {
      // Every target failed. Leave hasAppliedAI alone so the toggle does not claim success.
      setAiError(prev => prev || 'AI could not process the selected photo(s) on this device.');
    }
  };

  // Auto-run only when the modal was opened with Auto-Adjust already on (from QuickUtilsModal),
  // which is the case where the user has already opted in elsewhere and expects it to just run.
  // Seeded from the prop so flipping the toggle inside the modal does NOT fire it: doing so ran
  // the models immediately on whatever defaults happened to be selected, giving no chance to
  // choose a face/background model first.
  const hasTriggeredInitialAI = useRef(!initialAutoAdjust);
  useEffect(() => {
    if (initialAutoAdjust && autoAdjust && aiModelsReady && !hasTriggeredInitialAI.current && photoQueue.length > 0 && !hasAppliedAI) {
      hasTriggeredInitialAI.current = true;
      applyToTargets();
    }
  }, [initialAutoAdjust, autoAdjust, aiModelsReady, photoQueue, hasAppliedAI]);

  // Instant Auto-Apply when settings change if AI is already applied
  useEffect(() => {
    if (autoAdjust && hasAppliedAI && photoQueue.length > 0) {
      const targets = applyTargetMode === 'all'
        ? photoQueue
        : photoQueue.filter(p => applyTargetIds.includes(p.id));

      if (targets.length === 0) return;

      console.log("[Auto-Apply] Dependencies changed. Targets:", targets.length);

      const isInstant = targets.every(t => {
        const src = t.originalSrc || t.src;
        const cache = aiResultsCache.current[src];
        return cache && cache.faceModel === faceModel && cache.bgModel === bgModel;
      });
      console.log("[Auto-Apply] isInstant:", isInstant);

      if (isInstant) {
        Promise.all(targets.map(async t => {
          const src = t.originalSrc || t.src;
          const res = await processPhotoWithAI(src, true);
          return { id: t.id, src: res, originalSrc: src };
        })).then(results => {
          setPhotoQueue(prev => {
            const next = [...prev];
            results.forEach(res => {
              if (res.src) {
                const idx = next.findIndex(p => p.id === res.id);
                if (idx !== -1) next[idx] = { ...next[idx], src: res.src, originalSrc: res.originalSrc };
              }
            });
            console.log("[Auto-Apply] Updated queue with new bg results", next.length);
            return next;
          });
        });
      } else {
        console.log("[Auto-Apply] Running handleApplyAIToCurrent");
        applyToTargets();
      }
    }
  }, [faceModel, bgModel, background]);

  const toggleAutoAdjust = () => {
    const next = !autoAdjust;
    setAutoAdjust(next);
    if (!next && hasAppliedAI) {
      setPhotoQueue(prev => prev.map(p => p.originalSrc ? { ...p, src: p.originalSrc } : p));
      setHasAppliedAI(false);
    }
  };

  const selectAllTargets = () => {
    if (applyTargetMode !== 'all') {
      setApplyTargetMode('all');
      // Instantly apply AI to any photos that were not in target ids
      photoQueue.forEach(photo => {
        if (!applyTargetIds.includes(photo.id)) {
          const src = photo.originalSrc || photo.src;
          processPhotoWithAI(src, true).then(aiResult => {
            if (aiResult) {
              setPhotoQueue(prev => prev.map(p => p.id === photo.id ? { ...p, src: aiResult } : p));
              setHasAppliedAI(true);
            }
          });
        }
      });
    }
  };

  const selectSpecificTargets = () => {
    setApplyTargetMode('specific');
    if (applyTargetIds.length === 0) {
      setApplyTargetIds(photoQueue.map(p => p.id));
    }
  };

  const toggleTargetPhoto = (photo: PhotoQueueItem) => {
    const isSelected = applyTargetIds.includes(photo.id);
    if (isSelected) {
      // Deselect -> Revert this photo
      setApplyTargetIds(prev => prev.filter(id => id !== photo.id));
      if (photo.originalSrc) {
        setPhotoQueue(prev => prev.map(p => p.id === photo.id ? { ...p, src: photo.originalSrc! } : p));
      }
    } else {
      // Select -> Apply AI instantly
      setApplyTargetIds(prev => [...prev, photo.id]);
      const srcToProcess = photo.originalSrc || photo.src;
      processPhotoWithAI(srcToProcess, true).then(aiResult => {
        if (aiResult) {
          setPhotoQueue(prev => prev.map(p => p.id === photo.id ? { ...p, src: aiResult } : p));
          setHasAppliedAI(true);
        }
      });
    }
  };

  const revertTargets = () => {
    const targets = applyTargetMode === 'all' ? photoQueue : photoQueue.filter(p => applyTargetIds.includes(p.id));
    let revertedCount = 0;
    const newPhotoQueue = photoQueue.map(p => {
      if (targets.find(t => t.id === p.id) && p.originalSrc) {
        revertedCount++;
        return { ...p, src: p.originalSrc };
      }
      return p;
    });
    if (revertedCount > 0) {
      setPhotoQueue(newPhotoQueue);
      if (applyTargetMode === 'all' || applyTargetIds.length === photoQueue.length) setHasAppliedAI(false);
    }
  };

  return {
    autoAdjust, toggleAutoAdjust, setHasAppliedAI,
    faceModels, bgModels, faceModel, setFaceModel, bgModel, setBgModel, background, setBackground,
    faceModelState, bgModelState, aiModelsReady,
    applyTargetMode, applyTargetIds, selectAllTargets, selectSpecificTargets, toggleTargetPhoto,
    applyToTargets, revertTargets, processPhotoWithAI,
    aiError, dismissError: () => setAiError(null),
    isProcessingAI, processingStatus,
  };
}

export type PassportAIState = ReturnType<typeof usePassportAI>;
