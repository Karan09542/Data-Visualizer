/**
 * Telling "this part of the app could not be downloaded" apart from a real bug, and saying so in
 * words a user can act on.
 *
 * An installed app is regularly opened without a connection. Anything fetched on first use - a
 * lazily loaded screen, a dynamically imported package, a script from a CDN - then fails with a
 * browser-specific message ("Failed to fetch dynamically imported module: https://...") that means
 * nothing to the person holding the phone. Everything here exists so that failure reads as
 * "not downloaded yet, connect once" instead of a crash.
 */
import { useStore } from '../store/useStore';

/** Browser wordings for a module or chunk that could not be fetched. */
const MODULE_LOAD_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /failed to load module script/i,
  /unable to preload css/i, // Vite's preload helper
  /loading (css )?chunk [\w-]+ failed/i,
  /chunkloaderror/i,
];

/** Wordings for a plain request that never reached the server. */
const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /^typeerror load failed$/i, // Safari
  /failed to load (script|resource)/i,
];

const messageOf = (err: unknown): string => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return `${err.name} ${err.message}`;
  const e = err as { message?: unknown; reason?: unknown };
  return String(e.message ?? e.reason ?? '');
};

export const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Turns component names like "PropertiesTab" or "AISettingsSidebar" into "Properties Tab" / "AI Settings Sidebar". */
export const humanizeFeatureName = (name?: string): string | undefined =>
  name
    ? name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
    : undefined;

export const describeLoadFailure = (feature?: string, offline = isOffline()) => {
  const what = feature ? `“${feature}”` : 'This part of the app';
  return offline
    ? {
        title: 'Not available offline yet',
        message: `${what} hasn’t been saved to this device yet. Connect to the internet once and it will work offline after that.`,
      }
    : {
        title: 'Couldn’t load',
        message: `${what} couldn’t be downloaded. Check your connection and try again.`,
      };
};

/** A download that failed, carrying a message fit to show the user as it is. */
export class FeatureUnavailableError extends Error {
  readonly feature?: string;
  readonly offline: boolean;

  constructor(feature?: string, cause?: unknown) {
    const offline = isOffline();
    super(describeLoadFailure(feature, offline).message);
    this.name = 'FeatureUnavailableError';
    this.feature = feature;
    this.offline = offline;
    (this as { cause?: unknown }).cause = cause;
  }
}

export const isModuleLoadError = (err: unknown): boolean =>
  err instanceof FeatureUnavailableError || MODULE_LOAD_PATTERNS.some(p => p.test(messageOf(err)));

export const isNetworkError = (err: unknown): boolean => NETWORK_PATTERNS.some(p => p.test(messageOf(err)));

/**
 * Whether an error means "something could not be downloaded" rather than a bug. A plain network
 * error only counts while offline; online it may well be an API problem worth reporting as is.
 */
export const isLoadFailure = (err: unknown): boolean => isModuleLoadError(err) || (isOffline() && isNetworkError(err));

let lastToast = { message: '', at: 0 };

/**
 * Shows the failure as a toast. One missing chunk often fails several imports at the same moment,
 * so the same message is shown once per few seconds rather than stacked.
 */
export const notifyLoadFailure = (feature?: string): void => {
  const offline = isOffline();
  const { message } = describeLoadFailure(feature, offline);
  const now = Date.now();
  if (lastToast.message === message && now - lastToast.at < 5000) return;
  lastToast = { message, at: now };
  try {
    useStore.getState().setNotification({ message, type: offline ? 'warning' : 'error' });
  } catch {
    // The store is not up yet; the caller's own handling still applies.
  }
};

/** A dynamic import whose download failure surfaces as a FeatureUnavailableError with a readable message. */
export async function importFeature<T>(feature: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (isLoadFailure(err)) throw new FeatureUnavailableError(feature, err);
    throw err;
  }
}

const scriptLoads = new Map<string, Promise<void>>();

/**
 * Loads a classic script from a URL, once. A tag that failed is taken out again so that the next
 * attempt really fetches - leaving it in place made every later call "succeed" without the library.
 */
export const loadExternalScript = (src: string, feature: string): Promise<void> => {
  const pending = scriptLoads.get(src);
  if (pending) return pending;

  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptLoads.delete(src);
      reject(new FeatureUnavailableError(feature));
    };
    document.head.appendChild(script);
  });
  scriptLoads.set(src, load);
  return load;
};
