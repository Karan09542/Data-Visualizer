import React, { useState, useEffect } from 'react';
import { getProxiedUrl } from '../utils/mediaUtils';
import { resolveAssetUrl } from '../utils/assetManager';
import CustomAudioPlayer from './CustomAudioPlayer';

interface SmartFallbackMediaProps extends React.HTMLAttributes<HTMLElement> {
  type: 'image' | 'video' | 'audio';
  src: string;
  alt?: string;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  draggable?: boolean;
  isDark?: boolean;
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
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  const isAsset = src && (src.startsWith('img_') || src.startsWith('thumb_'));

  useEffect(() => {
    if (isAsset) {
      let active = true;
      resolveAssetUrl(src).then(url => {
        if (active) {
          setResolvedUrl(url);
        }
      }).catch(() => {
        if (active) {
          setRenderState('failed');
        }
      });
      return () => {
        active = false;
      };
    } else {
      setResolvedUrl('');
    }
  }, [src, isAsset]);

  const rawUrl = isAsset ? resolvedUrl : src;
  const currentUrl = renderState === 'proxied' && type === 'image' ? getProxiedUrl(rawUrl) : rawUrl;
  const isExternal = currentUrl.startsWith('http') && !currentUrl.includes(window.location.host);
  const crossOrigin = (isExternal && type === 'image') ? 'anonymous' : undefined;

  const handleError = (e: React.SyntheticEvent) => {
    if (isAsset) {
      setRenderState('failed');
      return;
    }
    if (renderState === 'direct' && type === 'image') {
      console.warn(`Direct rendering failed for ${src}, falling back to proxy.`, e);
      setRenderState('proxied');
    } else {
      setRenderState('failed');
    }
  };

  if (renderState === 'failed' || (isAsset && !resolvedUrl)) {
    if (isAsset && !resolvedUrl) {
      // Show light loading placeholder for lazy loading
      return <div className="text-[10px] text-[#8a8a8a] bg-black/10 px-3 py-4 rounded border border-dashed border-[#2c2c2c] w-full text-center">Loading asset...</div>;
    }
    return <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900 w-full text-center font-sans">Failed to load media</div>;
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
        playsInline={true}
        webkit-playsinline="true"
        {...(props as any)}
      />
    );
  }

  if (type === 'audio') {
    return (
      <CustomAudioPlayer
        src={currentUrl}
        isDark={props.isDark}
        className={(props as any).className || "w-full justify-center"}
        {...(props as any)}
      />
    );
  }

  return null;
}
