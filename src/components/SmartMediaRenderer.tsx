import React, { useState, useEffect, useRef } from 'react';
import { getProxiedUrl } from '../utils/mediaUtils';
import SafeIframe from './SafeIframe';
import { useStore } from '../store/useStore';

export const mediaCache = new Map<string, any>();
export const failedCache = new Map<string, { error?: any, errorType?: string, message?: string, timestamp: number, expiresAt: number }>();
const FAILED_CACHE_TTL = 30000; // 30 seconds

const ongoingRequests = new Map<string, Promise<any>>();

type RenderState = 'loading' | 'direct' | 'proxied' | 'failed';

export default function SmartMediaRenderer({ url, onMediaFailed, onResolvedType }: { url: string, onMediaFailed?: () => void, onResolvedType?: (type: string, actualUrl: string) => void }) {
  const [mediaData, setMediaData] = useState<any>(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') return null; // Legacy cleanup
    if (cached) return cached;
    const failed = failedCache.get(url);
    if (failed && failed.expiresAt > Date.now()) return null;
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    if (mediaCache.has(url) && mediaCache.get(url) !== 'failed') return false;
    const failed = failedCache.get(url);
    if (failed && failed.expiresAt > Date.now()) return false;
    return true;
  });
  
  const [renderState, setRenderState] = useState<RenderState>('direct');
  const [actualUrl, setActualUrl] = useState<string>(url);

  useEffect(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') mediaCache.delete(url); // Clean up legacy entry
    
    if (cached && cached !== 'failed') {
      setMediaData(cached);
      setIsLoading(false);
      extractAndSetUrl(cached);
      return;
    }

    const failed = failedCache.get(url);
    if (failed && failed.expiresAt > Date.now()) {
      setIsLoading(false);
      if (onMediaFailed) onMediaFailed();
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    let fetchPromise = ongoingRequests.get(url);
    if (!fetchPromise) {
      console.log("New Inspector Request", url);
      fetchPromise = fetch(`https://api.urlmediainspector.dev/api/v1/inspect?profile=embed&expand=html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      .then(res => res.json())
      .finally(() => {
        ongoingRequests.delete(url);
      });
      ongoingRequests.set(url, fetchPromise);
    } else {
      console.log("Reusing Existing Promise", url);
    }

    fetchPromise
      .then(data => {
        if (!isMounted) return;
        if (data.success && data.data && data.data.render) {
          const mime = data.data.mime || '';
          const isDataResponse = mime.includes('json') || mime.includes('xml') || mime.includes('csv') || url.includes('{') || url.includes('}');
          
          if (isDataResponse || (mime === 'application/octet-stream' && data.data.verification?.networkVerified === false)) {
            if (isDataResponse && !url.includes('{')) {
              let type = 'json';
              if (mime.includes('xml')) type = 'xml';
              if (mime.includes('csv')) type = 'csv';
              useStore.getState().setKnownDataUrl(url, type as any);
            }
            failedCache.set(url, { 
              error: 'Not a renderable media', 
              errorType: 'INVALID_MEDIA_TYPE',
              message: 'The component returned data, not renderable media. Skipping preview.',
              timestamp: Date.now(),
              expiresAt: Date.now() + FAILED_CACHE_TTL 
            });
            setIsLoading(false);
            if (onMediaFailed) onMediaFailed();
            return;
          }

          mediaCache.set(url, data.data.render);
          setMediaData(data.data.render);
          setIsLoading(false);
          extractAndSetUrl(data.data.render);
        } else {
          failedCache.set(url, { 
            error: 'Invalid response', 
            errorType: 'INVALID_RESPONSE',
            message: 'Target server returned an invalid or unparseable response',
            timestamp: Date.now(),
            expiresAt: Date.now() + FAILED_CACHE_TTL 
          });
          setIsLoading(false);
          if (onMediaFailed) onMediaFailed();
        }
      })
      .catch(e => {
        if (!isMounted) return;
        console.error('Inspector error', e);
        failedCache.set(url, { 
          error: e, 
          errorType: 'NETWORK_ERROR',
          message: e?.message || 'Network error occurred during media inspection',
          timestamp: Date.now(),
          expiresAt: Date.now() + FAILED_CACHE_TTL 
        });
        setIsLoading(false);
        if (onMediaFailed) onMediaFailed();
      });

    return () => { isMounted = false; };
  }, [url, onMediaFailed]);

  const extractAndSetUrl = (renderData: any) => {
    let resolvedUrl = url;
    let detectedType = renderData.strategy || 'iframe';
    
    if (renderData.html) {
      const srcMatch = renderData.html.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) resolvedUrl = srcMatch[1];
      
      if (renderData.html.startsWith('<img')) detectedType = 'image';
      else if (renderData.html.startsWith('<video')) detectedType = 'video';
      else if (renderData.html.startsWith('<audio')) detectedType = 'audio';
    } else if (renderData.strategy === 'img') {
      detectedType = 'image';
    }
    
    setActualUrl(resolvedUrl);
    
    if (onResolvedType) {
      onResolvedType(detectedType, resolvedUrl);
    }
  };

  const handleError = () => {
    if (renderState === 'direct') {
      console.warn(`Direct rendering failed for ${actualUrl}, falling back to proxy.`);
      setRenderState('proxied');
    } else {
      setRenderState('failed');
      if (onMediaFailed) onMediaFailed();
    }
  };

  if (isLoading) {
    return <div className="text-[10px] text-slate-400 p-2 opacity-60 rounded flex justify-center items-center h-full w-full italic">Inspecting...</div>;
  }

  if (!mediaData || renderState === 'failed') {
    return null;
  }

  const currentUrl = renderState === 'proxied' ? getProxiedUrl(actualUrl) : actualUrl;
  
  const isExternal = currentUrl.startsWith('http') && !currentUrl.includes(window.location.host);
  const crossOrigin = isExternal ? 'anonymous' : undefined;

  let content;
  
  if (mediaData.strategy === 'img' || (mediaData.html && mediaData.html.startsWith('<img'))) {
    content = (
       <img 
        src={currentUrl} 
        alt="Preview" 
        referrerPolicy="no-referrer" 
        crossOrigin={crossOrigin as any}
        onError={handleError}
        className="max-w-full max-h-full object-contain rounded"
      />
    );
  } else if (mediaData.strategy === 'video' || (mediaData.html && mediaData.html.startsWith('<video'))) {
    content = (
      <video 
        src={currentUrl} 
        controls 
        muted 
        loop
        crossOrigin={crossOrigin as any}
        onError={handleError}
        className="max-w-full max-h-full rounded focus:outline-none"
      />
    );
  } else if (mediaData.strategy === 'audio' || (mediaData.html && mediaData.html.startsWith('<audio'))) {
    content = (
      <audio 
        src={currentUrl} 
        controls 
        crossOrigin={crossOrigin as any}
        onError={handleError}
        className="w-full h-10 outline-none"
      />
    );
  } else if (mediaData.strategy === 'iframe' || (mediaData.html && mediaData.html.includes('<iframe'))) {
    content = (
      <SafeIframe
        src={actualUrl}
        className="w-full h-full rounded border-0 bg-white"
        title="preview"
      />
    );
  } else if (mediaData.html) {
    content = <div className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:rounded [&>iframe]:border-0" dangerouslySetInnerHTML={{ __html: mediaData.html }} />;
  } else {
    content = (
      <SafeIframe
        src={currentUrl}
        className="w-full h-full rounded border-0 bg-white"
        title="preview"
      />
    );
  }

  return (
    <div className="w-full h-full flex justify-center items-center">
      {content}
    </div>
  );
}
