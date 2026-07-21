import { useState, useCallback } from 'react';
import { AITask, AIBackend, AIProgressState, AIExecutionResult } from '../types';
import { aiService } from '../services/AIService';

export function useAI() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<AIProgressState>('idle');
  const [progressValue, setProgressValue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    task: AITask, 
    image: ImageBitmap | ImageData,
    preferredBackend?: AIBackend
  ): Promise<AIExecutionResult> => {
    setIsProcessing(true);
    setProgressState('idle');
    setProgressValue(0);
    setError(null);

    try {
      const { promise } = aiService.execute(task, image, {
        preferredBackend,
        onProgress: (event) => {
          setProgressState(event.state);
          setProgressValue(event.progress || 0);
        }
      });
      
      const result = await promise;
      
      setProgressState('completed');
      setProgressValue(100);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgressState('error');
      throw e;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    execute,
    isProcessing,
    progressState,
    progressValue,
    error
  };
}
