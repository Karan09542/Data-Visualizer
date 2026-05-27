import React, { useState, useEffect, useRef } from 'react';
import { getProxiedUrl } from '../utils/mediaUtils';

export const mediaCache = new Map<string, any>();

type RenderState = 'loading' | 'direct' | 'proxied' | 'failed';

export default function SmartMediaRenderer({ url, onMediaFailed, onResolvedType }: { url: string, onMediaFailed?: () => void, onResolvedType?: (type: string, actualUrl: string) => void }) {
  const [mediaData, setMediaData] = useState<any>(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') return null;
    return cached || null;
  });
  
  const [isLoading, setIsLoading] = useState(!mediaCache.has(url));
  const [renderState, setRenderState] = useState<RenderState>('direct');
  const [actualUrl, setActualUrl] = useState<string>(url);

  useEffect(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') {
      setIsLoading(false);
      if (onMediaFailed) onMediaFailed();
      return;
    } else if (cached) {
      setMediaData(cached);
      setIsLoading(false);
      extractAndSetUrl(cached);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(`https://api.urlmediainspector.dev/api/v1/inspect?profile=embed&expand=html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.success && data.data && data.data.render) {
          mediaCache.set(url, data.data.render);
          setMediaData(data.data.render);
          setIsLoading(false);
          extractAndSetUrl(data.data.render);
        } else {
          mediaCache.set(url, 'failed');
          setIsLoading(false);
          if (onMediaFailed) onMediaFailed();
        }
      })
      .catch(e => {
        if (!isMounted) return;
        console.error('Inspector error', e);
        mediaCache.set(url, 'failed');
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
  } else if (mediaData.html) {
    content = <div className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:rounded [&>iframe]:border-0" dangerouslySetInnerHTML={{ __html: mediaData.html }} />;
  } else {
    content = <iframe src={currentUrl} className="w-full h-full rounded border-0" />;
  }

  return (
    <div className="w-full h-full flex justify-center items-center">
      {content}
    </div>
  );
}
