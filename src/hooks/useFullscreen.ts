import { useCallback, useEffect, useState } from 'react';

/**
 * The browser's own fullscreen, for the whole page.
 *
 * Safari still ships this behind a webkit prefix, and iPhones do not offer it for elements at
 * all, so support is reported back and the caller can leave the control out where it would do
 * nothing.
 */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const currentFullscreenElement = () => {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => !!currentFullscreenElement());

  useEffect(() => {
    // Covers leaving fullscreen by Escape or F11, which never reaches our own handler
    const sync = () => setIsFullscreen(!!currentFullscreenElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    };
  }, []);

  const isSupported =
    typeof document !== 'undefined' &&
    !!(document.fullscreenEnabled || (document as FullscreenDocument).webkitFullscreenEnabled);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (currentFullscreenElement()) {
        await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
      } else {
        const root = document.documentElement as FullscreenElement;
        await (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.());
      }
    } catch (err) {
      // Refused, usually because the click was not treated as a user gesture
      console.warn('Could not switch fullscreen', err);
    }
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
}
