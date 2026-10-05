import { isModuleLoadError } from "../../../utils/offlineErrors";

/** The URL a failed dynamic import was for, when the browser says (Chrome and Firefox do). */
function failedModuleUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/https?:\/\/[^\s'"]+/)?.[0] ?? null;
}

/**
 * Imports a module for React.lazy. A browser remembers a failed module download for the life
 * of the page, so trying the same import again fails at once without asking the server; when
 * that happens, the module is asked for again under a fresh URL, which really downloads it.
 */
export async function importFresh<M, T>(load: () => Promise<M>, pick: (m: M) => T): Promise<{ default: T }> {
  try {
    return { default: pick(await load()) };
  } catch (error) {
    const url = isModuleLoadError(error) ? failedModuleUrl(error) : null;
    if (!url) throw error;
    const fresh = `${url}${url.includes("?") ? "&" : "?"}retry=${Date.now()}`;
    return { default: pick((await import(/* @vite-ignore */ fresh)) as M) };
  }
}
