import React, { lazy, ComponentType, LazyExoticComponent } from 'react';
import { ModuleLoadBoundary } from '../components/ModuleLoadBoundary';
import { isModuleLoadError, isOffline } from './offlineErrors';

const RELOAD_KEY = 'page-has-been-force-refreshed';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const readReloaded = (): boolean => {
  try {
    return JSON.parse(window.sessionStorage.getItem(RELOAD_KEY) || 'false');
  } catch {
    return false;
  }
};

const writeReloaded = (value: boolean) => {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: at worst the one-off reload is skipped.
  }
};

/**
 * React.lazy for parts of the app that are downloaded on first use, made safe for an installed
 * app that is often opened offline.
 *
 * - A failed download is retried twice, with a short pause, while online - flaky connections.
 * - Online, a module missing from the server usually means a new version was deployed under the
 *   open tab, so the page reloads once to pick it up. Offline a reload cannot fetch anything and
 *   would only throw away the user's work, so it never happens there.
 * - Whatever still fails is caught where the component sits and explained, with a retry, instead
 *   of unmounting the whole app. Coming back online retries by itself.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  name?: string
): LazyExoticComponent<T> {
  const load = async (): Promise<{ default: T }> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        if (isOffline()) break;
        await wait(400 * attempt);
      }
      try {
        const component = await componentImport();
        writeReloaded(false);
        return component;
      } catch (error) {
        lastError = error;
        // An error thrown while the module runs is a bug, not a download problem; retrying
        // would only repeat it.
        if (!isModuleLoadError(error)) break;
      }
    }

    console.warn(`[lazyWithRetry] Failed to load module ${name || 'unknown'}:`, lastError);

    if (!isOffline() && isModuleLoadError(lastError) && !readReloaded()) {
      writeReloaded(true);
      window.location.reload();
      // Never resolves: the page is going away.
      return new Promise<{ default: T }>(() => {});
    }

    throw lastError;
  };

  // React.lazy remembers a rejection for good, so a retry needs a fresh one.
  let current = lazy(load);
  const renew = () => {
    current = lazy(load);
  };

  function LazyWithFallback(props: any) {
    // `ref` arrives as an ordinary prop in React 19 and is passed along with the rest.
    return React.createElement(ModuleLoadBoundary, {
      name,
      onRetry: renew,
      render: () => React.createElement(current, props),
    });
  }
  LazyWithFallback.displayName = `Lazy(${name || 'Component'})`;

  return LazyWithFallback as unknown as LazyExoticComponent<T>;
}
