import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that retries imports if they fail,
 * commonly due to ChunkLoadError when a new version of the app is deployed
 * and old cached chunks are missing from the server.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  name?: string
) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error: any) {
      console.warn(`[lazyWithRetry] Failed to load module ${name || 'unknown'}:`, error);

      if (!pageHasAlreadyBeenForceRefreshed) {
        // We only retry once to prevent infinite loops
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        // Return a never-resolving promise so React waits for reload
        return new Promise<{ default: T }>(() => {});
      }

      // If we already refreshed and it still failed, throw the error
      throw error;
    }
  });
}
