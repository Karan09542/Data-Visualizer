import { useState, useEffect, useCallback } from 'react';
import { getProxiedUrl } from './mediaUtils';

export function getRenderableIframeUrl(mediaUrl: string, useFallback: boolean): string {
  if (useFallback) {
    return getProxiedUrl(mediaUrl);
  }
  return mediaUrl;
}

interface UseRenderableIframeResult {
  url: string;
  isFallback: boolean;
  handleLoad: (e?: any) => void;
  handleError: (e?: any) => void;
}

export function useRenderableIframeUrl(initialUrl: string, renderData?: any): UseRenderableIframeResult {
  const [useFallback, setUseFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setLoaded(false);
  }, [initialUrl]);

  // Fallback on timeout if direct rendering takes too long (common for blocked PDFs/CORS issues)
  useEffect(() => {
    if (!useFallback && !loaded && initialUrl && !initialUrl.startsWith('data:') && !initialUrl.startsWith('blob:')) {
      const timer = setTimeout(() => {
        console.warn(`[Iframe Render] Timeout waiting for ${initialUrl}. Falling back...`);
        setUseFallback(true);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [useFallback, loaded, initialUrl]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    if (!useFallback && !initialUrl.startsWith('data:') && !initialUrl.startsWith('blob:')) {
      console.warn(`[Iframe Render] Error detected for ${initialUrl}. Falling back...`);
      setUseFallback(true);
    }
  }, [useFallback, initialUrl]);

  const finalUrl = getRenderableIframeUrl(initialUrl, useFallback);

  return {
    url: finalUrl,
    isFallback: useFallback,
    handleLoad,
    handleError
  };
}
