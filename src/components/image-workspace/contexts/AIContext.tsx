import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AITask, AIProgressEvent, AIProgressState, AIExecutionOptions } from '../../../ai/types';
import { ai } from '../../../ai';

interface AIJobState {
  jobId: string;
  task: AITask;
  state: AIProgressState;
  progress: number;
}

interface AIContextType {
  activeJobs: Record<string, AIJobState>;
  executeAITask: (task: AITask, image: ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement, options?: AIExecutionOptions) => Promise<any>;
  cancelJob: (jobId: string) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeJobs, setActiveJobs] = useState<Record<string, AIJobState>>({});

  const executeAITask = useCallback(async (
    task: AITask,
    image: ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement,
    options?: AIExecutionOptions
  ) => {
    // Process the image for the ai service
    let processImage: ImageBitmap | ImageData;

    if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      processImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      processImage = image;
    }

    const { jobId, promise } = ai.execute(task, processImage, options);

    setActiveJobs(prev => ({
      ...prev,
      [jobId]: { jobId, task, state: 'queued', progress: 0 }
    }));

    const unsubscribe = ai.subscribe(jobId, (event) => {
      setActiveJobs(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], state: event.state, progress: event.progress || 0 }
      }));
      if (options?.onProgress) {
        options.onProgress(event);
      }
    });

    try {
      const result = await promise;
      return result;
    } finally {
      unsubscribe();
      // Remove from active jobs shortly after completion so the UI can show 100%
      setTimeout(() => {
        setActiveJobs(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }, 1000);
    }
  }, []);

  const cancelJob = useCallback((jobId: string) => {
    ai.cancel(jobId);
    setActiveJobs(prev => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, []);

  return (
    <AIContext.Provider value={{ activeJobs, executeAITask, cancelJob }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAIContext = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAIContext must be used within an AIProvider');
  }
  return context;
};
