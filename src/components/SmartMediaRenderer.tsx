import React, { useState, useEffect } from 'react';

// Cache parsed HTML or 'failed' to prevent infinite retries and optimize memory
const mediaCache = new Map<string, string | 'failed'>();

export default function SmartMediaRenderer({ url, onMediaFailed }: { url: string, onMediaFailed?: () => void }) {
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

  if (isLoading) {
    return <div className="text-[10px] text-slate-400 p-2 opacity-60 rounded flex justify-center items-center h-full w-full italic">Inspecting...</div>;
  }

  if (!cachedHtml) {
    return null;
  }

  return (
    <div 
      className="w-full h-full flex justify-center items-center [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:min-h-[160px] [&>iframe]:rounded [&>iframe]:border-0 [&>img]:max-w-full [&>img]:max-h-[160px] [&>img]:object-contain [&>img]:rounded [&>video]:max-w-full [&>video]:max-h-[160px] [&>video]:rounded [&>video]:focus:outline-none [&>audio]:w-full [&>audio]:h-8 [&>audio]:outline-none"
      dangerouslySetInnerHTML={{ __html: cachedHtml }}
    />
  );
}
