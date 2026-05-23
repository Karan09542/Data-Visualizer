import React, { useState, useEffect } from 'react';

// Cache parsed HTML or 'failed' to prevent infinite retries and optimize memory
export const mediaCache = new Map<string, string | 'failed'>();

export default function SmartMediaRenderer({ url, onMediaFailed, onResolvedType }: { url: string, onMediaFailed?: () => void, onResolvedType?: (type: string, actualUrl: string) => void }) {
  const [cachedHtml, setCachedHtml] = useState<string | null>(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') return null;
    return cached || null;
  });
  
  const [isLoading, setIsLoading] = useState(!mediaCache.has(url));

  useEffect(() => {
    const cached = mediaCache.get(url);
    if (cached === 'failed') {
      setIsLoading(false);
      if (onMediaFailed) onMediaFailed();
      return;
    } else if (cached) {
      setCachedHtml(cached);
      setIsLoading(false);
      // We don't have the original strategy stored in cache right now easily, 
      // but we can infer it from the cached html
      if (onResolvedType) {
        let actualUrl = url;
        const srcMatch = cached.match(/src="([^"]+)"/);
        if (srcMatch && srcMatch[1]) actualUrl = srcMatch[1];
        
        if (cached.startsWith('<img') || cached.includes('<img')) onResolvedType('image', actualUrl);
        else if (cached.startsWith('<video') || cached.includes('<video')) onResolvedType('video', actualUrl);
        else if (cached.startsWith('<audio') || cached.includes('<audio')) onResolvedType('audio', actualUrl);
        else onResolvedType('iframe', actualUrl);
      }
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
        if (data.success && data.data && data.data.render && (data.data.render.html || data.data.render.strategy === 'img')) {
          const htmlToCache = data.data.render.html || `<img src="${url}" alt="Preview" referrerPolicy="no-referrer" />`;
          mediaCache.set(url, htmlToCache);
          setCachedHtml(htmlToCache);
          setIsLoading(false);
          if (onResolvedType) {
            let detected = 'iframe';
            let actualUrl = url;
            const srcMatch = htmlToCache.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) actualUrl = srcMatch[1];

            if (data.data.render.strategy === 'img' || htmlToCache.startsWith('<img')) detected = 'image';
            else if (data.data.render.strategy === 'video' || htmlToCache.startsWith('<video')) detected = 'video';
            else if (data.data.render.strategy === 'audio' || htmlToCache.startsWith('<audio')) detected = 'audio';
            onResolvedType(detected, actualUrl);
          }
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
  }, [url, onMediaFailed, onResolvedType]);

  if (isLoading) {
    return <div className="text-[10px] text-slate-400 p-2 opacity-60 rounded flex justify-center items-center h-full w-full italic">Inspecting...</div>;
  }

  if (!cachedHtml) {
    return null;
  }

  return (
    <div 
      className="w-full h-full flex justify-center items-center [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:rounded [&>iframe]:border-0 [&>img]:max-w-full [&>img]:max-h-full [&>img]:object-contain [&>img]:rounded [&>video]:max-w-full [&>video]:max-h-full [&>video]:rounded [&>video]:focus:outline-none [&>audio]:w-full [&>audio]:h-10 [&>audio]:outline-none"
      dangerouslySetInnerHTML={{ __html: cachedHtml }}
    />
  );
}
