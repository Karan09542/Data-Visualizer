import React, { useState } from 'react';
import { getProxiedUrl } from '../utils/mediaUtils';

interface SmartFallbackMediaProps extends React.HTMLAttributes<HTMLElement> {
  type: 'image' | 'video' | 'audio';
  src: string;
  alt?: string;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  draggable?: boolean;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  [key: string]: any;
}

export function SmartFallbackMedia({ 
  type, 
  src, 
  alt, 
  ...props 
}: SmartFallbackMediaProps) {
  const [renderState, setRenderState] = useState<'direct' | 'proxied' | 'failed'>('direct');
  
  const currentUrl = renderState === 'proxied' ? getProxiedUrl(src) : src;
  const isExternal = currentUrl.startsWith('http') && !currentUrl.includes(window.location.host);
  const crossOrigin = isExternal ? 'anonymous' : undefined;

  const handleError = () => {
    if (renderState === 'direct') {
      console.warn(`Direct rendering failed for ${src}, falling back to proxy.`);
      setRenderState('proxied');
    } else {
      setRenderState('failed');
    }
  };

  if (renderState === 'failed') {
    return <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900 w-full text-center">Failed to load media</div>;
  }

  if (type === 'image') {
    return (
      <img
        src={currentUrl}
        alt={alt}
        crossOrigin={crossOrigin as any}
        onError={handleError}
        {...(props as any)}
      />
    );
  }

  if (type === 'video') {
    return (
      <video
        src={currentUrl}
        crossOrigin={crossOrigin as any}
        onError={handleError}
        {...(props as any)}
      />
    );
  }

  if (type === 'audio') {
    return (
      <audio
        src={currentUrl}
        crossOrigin={crossOrigin as any}
        onError={handleError}
        {...(props as any)}
      />
    );
  }

  return null;
}
