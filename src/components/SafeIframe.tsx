import React from 'react';
import { useRenderableIframeUrl } from '../utils/iframeFallbackHelper';

interface SafeIframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  src: string;
  renderData?: any;
}

export default function SafeIframe({ src, renderData, onLoad, onError, ...props }: SafeIframeProps) {
  const { url, handleLoad, handleError } = useRenderableIframeUrl(src, renderData);

  const onIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    handleLoad(e);
    if (onLoad) onLoad(e);
  };

  const onIframeError = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    handleError(e);
    if (onError) onError(e);
  };

  return (
    <iframe
      src={url}
      onLoad={onIframeLoad}
      onError={onIframeError}
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      {...props}
    />
  );
}
