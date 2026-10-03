/**
 * Fetches a URL for the editor: directly when the browser allows it, through the user's proxies
 * (then the default one) when it does not, and turns whatever comes back into data the editor
 * can hold.
 *
 * - A proxy is only used when the direct request could not be made at all - blocked by CORS, a
 *   network failure, or an http:// URL the https app may not call. A server's own answer, a 404
 *   included, is reported as it is: asking again through a proxy would not change it, and would
 *   send a POST twice.
 * - JSON, NDJSON, YAML and CSV become data. HTML, XML and other text load as
 *   { url, status, contentType, body }, so the editor still holds valid JSON. Images, video, audio
 *   and PDFs are shown as a preview.
 */

export type FetchFormat = 'json' | 'ndjson' | 'yaml' | 'csv' | 'text' | 'empty' | 'head';

export interface SmartFetchResult {
  success: boolean;
  data: any | null;
  rawText: string;
  source: 'native' | 'fallback' | null;
  phase: 'native-fetch' | 'fallback-fetch' | 'json-parse' | 'initial' | null;
  status: number | null;
  reason: string | null;
  errorType: 'invalid-url' | 'cors-blocked' | 'invalid-json' | 'empty-response' | 'timeout' | 'non-json' | 'http-error' | 'generic' | null;
  errorMessage: string;
  // Media Preview properties
  isMedia?: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'pdf' | null;
  mediaUrl?: string | null;
  contentType?: string | null;
  fileSize?: number;
  /** What the body was read as. */
  format?: FetchFormat;
  /** The proxy the answer came through, when it did. */
  proxy?: string;
  /** The URL actually requested, after adding a missing https://. */
  url?: string;
  durationMs?: number;
}

/** A proxy to try: `base` followed by the target URL, encoded or as-is. */
export interface ProxyRoute {
  base: string;
  encode: boolean;
}

export interface SmartFetchOptions extends RequestInit {
  timeout?: number;
  /** Tried in order when the direct request is blocked. */
  proxies?: ProxyRoute[];
  onProgress?: (progress: {
    phase: 'native-fetch' | 'fallback-fetch' | 'json-parse';
    message: string;
    usingFallback: boolean;
  }) => void;
}

export const DEFAULT_PROXY = 'https://go.data-visualizer.workers.dev/?url=';

/**
 * The proxies from the user's settings, in their order, then the default one when it is on.
 * User proxies get the target appended as-is - the form the code nodes use and the Go server
 * expects; the default proxy gets it encoded.
 */
export function proxyRoutesFromSettings(
  proxyServers: { url: string; isEnabled: boolean }[],
  useDefaultProxy: boolean,
): ProxyRoute[] {
  const routes: ProxyRoute[] = proxyServers
    .filter((p) => p.isEnabled && p.url.trim())
    .map((p) => ({ base: p.url.trim(), encode: false }));
  if (useDefaultProxy && !routes.some((r) => r.base === DEFAULT_PROXY)) {
    routes.push({ base: DEFAULT_PROXY, encode: true });
  }
  return routes;
}

/** Adds https:// to a URL typed without a scheme; null when it is not an http(s) URL. */
export function normalizeUrl(input: string): string | null {
  let url = (input || '').trim();
  if (!url) return null;
  if (url.startsWith('//')) url = 'https:' + url;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    parsed.hash = ''; // never sent; would also confuse a proxy given the URL raw
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getMediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  const m = mime.toLowerCase();
  if (m.startsWith('image/') && !m.startsWith('image/svg')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('application/pdf') || m === 'pdf') return 'pdf';
  return null;
}

export function getMediaTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i.test(pathname)) return 'image';
    if (/\.(mp4|webm|mov|m4v)$/i.test(pathname)) return 'video';
    if (/\.(mp3|wav|ogg|aac|m4a|flac|opus)$/i.test(pathname)) return 'audio';
    if (/\.(pdf)$/i.test(pathname)) return 'pdf';
  } catch {}
  return null;
}

const failure = (fields: Partial<SmartFetchResult> & Pick<SmartFetchResult, 'errorType' | 'errorMessage'>): SmartFetchResult => ({
  success: false,
  data: null,
  rawText: '',
  source: null,
  phase: 'initial',
  status: null,
  reason: null,
  ...fields,
});

/** Whether a failed request was blocked or never reached a server (rather than answered). */
const isNetworkError = (err: any) => err && err.name === 'TypeError';

/**
 * A proxy's own refusal or failure, rather than the target's answer: worth trying the next one.
 * The Go proxy marks these with X-Proxy-Error. For other proxies, only requests that are safe to
 * repeat move on after a gateway-style status.
 */
function isProxyFailure(response: Response, method: string): boolean {
  if (response.headers.get('x-proxy-error')) return true;
  const repeatable = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  return repeatable && [401, 403, 407, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(response.status);
}

export async function smartJsonFetch(
  url: string,
  options: SmartFetchOptions = {}
): Promise<SmartFetchResult> {
  const { timeout = 30000, onProgress, proxies = [], signal: parentSignal, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const started = performance.now();

  const target = normalizeUrl(url);
  if (!target) {
    return failure({
      reason: url && url.trim() ? 'Malformed URL' : 'Empty URL',
      errorType: 'invalid-url',
      errorMessage: 'Please enter a valid http(s) URL, e.g. https://api.example.com/data',
    });
  }

  /** One request with its own timeout, cancelled with the caller's signal too. */
  const attempt = async (requestUrl: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
    const onParentAbort = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', onParentAbort);
    try {
      const response = await fetch(requestUrl, { ...fetchOptions, method, signal: controller.signal });
      return { response, done: () => { clearTimeout(timer); parentSignal?.removeEventListener('abort', onParentAbort); } };
    } catch (err) {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
      throw err;
    }
  };

  const aborted = (err: any, source: 'native' | 'fallback'): SmartFetchResult | null => {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') return null;
    const byUser = parentSignal?.aborted;
    return failure({
      source,
      phase: source === 'native' ? 'native-fetch' : 'fallback-fetch',
      reason: byUser ? 'Aborted' : 'Request Timed Out',
      errorType: byUser ? 'generic' : 'timeout',
      errorMessage: byUser
        ? 'The request was cancelled.'
        : `No answer within ${Math.round(timeout / 1000)} seconds.`,
    });
  };

  // An https page may not call http:// directly (mixed content): straight to the proxies.
  const pageIsHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const directBlocked = pageIsHttps && target.startsWith('http://');
  let directError: any = null;

  if (!directBlocked) {
    onProgress?.({ phase: 'native-fetch', message: `Requesting ${target} directly...`, usingFallback: false });
    try {
      const { response, done } = await attempt(target);
      try {
        return await readResponse(response, { target, method, source: 'native', started, onProgress });
      } finally {
        done();
      }
    } catch (err: any) {
      const stopped = aborted(err, 'native');
      if (stopped) return stopped;
      if (!isNetworkError(err)) {
        return failure({ source: 'native', phase: 'native-fetch', reason: err?.message || String(err), errorType: 'generic', errorMessage: err?.message || 'The request failed.' });
      }
      directError = err; // blocked by CORS or the network: try the proxies
    }
  }

  if (proxies.length === 0) {
    return failure({
      source: 'native',
      phase: 'native-fetch',
      reason: directBlocked ? 'http:// from an https page' : directError?.message || 'Failed to fetch',
      errorType: 'cors-blocked',
      errorMessage: directBlocked
        ? 'This page is served over https, so the browser does not allow requests to http:// URLs. Turn on a proxy in Proxy settings to reach it.'
        : 'The browser blocked this request (CORS), or the server could not be reached. Turn on a proxy in Proxy settings to retry through it.',
    });
  }

  let lastResult: SmartFetchResult | null = null;
  let lastError: any = directError;
  for (const proxy of proxies) {
    const host = proxyLabel(proxy.base);
    onProgress?.({
      phase: 'fallback-fetch',
      message: directBlocked
        ? `http:// URLs go through a proxy. Requesting via ${host}...`
        : `The browser blocked the direct request. Retrying via ${host}...`,
      usingFallback: true,
    });
    try {
      const { response, done } = await attempt(proxy.base + (proxy.encode ? encodeURIComponent(target) : target));
      try {
        if (isProxyFailure(response, method)) {
          lastResult = await readResponse(response, { target, method, source: 'fallback', started, onProgress, proxy: host });
          continue;
        }
        return await readResponse(response, { target, method, source: 'fallback', started, onProgress, proxy: host });
      } finally {
        done();
      }
    } catch (err: any) {
      const stopped = aborted(err, 'fallback');
      if (stopped && parentSignal?.aborted) return stopped;
      lastError = err; // this proxy is down or refused us: the next one
    }
  }

  if (lastResult) return lastResult;
  return failure({
    source: 'fallback',
    phase: 'fallback-fetch',
    reason: lastError?.message || 'All proxies failed',
    errorType: 'cors-blocked',
    errorMessage: `The request was blocked, and none of the ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'} could reach it either. Check Proxy settings, or whether the server is up.`,
  });
}

const proxyLabel = (base: string) => {
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
};

interface ReadContext {
  target: string;
  method: string;
  source: 'native' | 'fallback';
  started: number;
  proxy?: string;
  onProgress?: SmartFetchOptions['onProgress'];
}

const headersObject = (headers: Headers) => {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => (out[key] = value));
  return out;
};

/** Turns a response into a result: data in the best format the body allows. */
async function readResponse(response: Response, ctx: ReadContext): Promise<SmartFetchResult> {
  const contentType = response.headers.get('content-type') || '';
  const phase = ctx.source === 'native' ? 'native-fetch' : 'fallback-fetch';
  const base = {
    source: ctx.source,
    status: response.status,
    contentType,
    proxy: ctx.proxy,
    url: ctx.target,
  } as const;
  const elapsed = () => Math.round(performance.now() - ctx.started);
  const meta = () => ({ url: ctx.target, status: response.status, statusText: response.statusText, headers: headersObject(response.headers) });

  // No body to read: the answer is its status and headers.
  if (ctx.method === 'HEAD' || response.status === 204 || response.status === 205 || response.status === 304) {
    return {
      ...base, success: response.ok || response.status === 304, data: meta(), rawText: '', phase, reason: null,
      errorType: response.ok || response.status === 304 ? null : 'http-error',
      errorMessage: response.ok || response.status === 304 ? '' : `The server answered ${response.status} ${response.statusText}.`,
      format: 'head', durationMs: elapsed(),
    };
  }

  const mediaType = getMediaTypeFromMime(contentType) || (response.ok && !contentType ? getMediaTypeFromUrl(ctx.target) : null);
  if (mediaType && response.ok) {
    const blob = await response.blob();
    return {
      ...base, success: false, data: null, phase, durationMs: elapsed(),
      rawText: `[Binary ${mediaType} content, Content-Type: ${contentType}, Size: ${blob.size} bytes]`,
      reason: `Endpoint returned ${mediaType} content`,
      errorType: 'non-json',
      errorMessage: `This endpoint returned ${contentType || mediaType} content instead of data.`,
      isMedia: true, mediaType, mediaUrl: URL.createObjectURL(blob), fileSize: blob.size,
    };
  }

  if (/^(application\/(octet-stream|zip|gzip|x-tar|x-7z|vnd\.)|font\/)/i.test(contentType) && !/json|xml|csv|yaml/i.test(contentType)) {
    const blob = await response.blob();
    return {
      ...base, success: false, data: null, phase, durationMs: elapsed(), fileSize: blob.size,
      rawText: `[Binary content, Content-Type: ${contentType}, Size: ${blob.size} bytes]`,
      reason: 'Binary response', errorType: 'non-json',
      errorMessage: `This endpoint returned a binary file (${contentType}, ${blob.size} bytes), which cannot be loaded as data.`,
    };
  }

  const text = await response.text();

  if (!response.ok) {
    return {
      ...base, success: false, data: null, rawText: text, phase, durationMs: elapsed(),
      reason: `HTTP ${response.status} ${response.statusText}`.trim(),
      errorType: 'http-error',
      errorMessage: `The server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${ctx.proxy ? ` (via ${ctx.proxy})` : ''}.`,
    };
  }

  ctx.onProgress?.({ phase: 'json-parse', message: 'Reading the response...', usingFallback: ctx.source === 'fallback' });
  const parsed = await parseBody(text, contentType, ctx.target);
  if (!parsed.ok) {
    const bad = parsed as Extract<Parsed, { ok: false }>;
    return {
      ...base, success: false, data: null, rawText: text, phase: 'json-parse', durationMs: elapsed(),
      reason: bad.reason, errorType: bad.errorType, errorMessage: bad.message,
    };
  }
  return {
    ...base, success: true, data: parsed.format === 'text' || parsed.format === 'empty'
      ? { ...meta(), body: text }
      : parsed.data,
    rawText: text, phase: 'json-parse', reason: null, errorType: null, errorMessage: '',
    format: parsed.format, durationMs: elapsed(),
  };
}

type Parsed =
  | { ok: true; data: any; format: FetchFormat }
  | { ok: false; reason: string; errorType: 'invalid-json'; message: string };

/** Reads a body as the format its Content-Type, URL or content says it is. */
async function parseBody(text: string, contentType: string, url: string): Promise<Parsed> {
  // A BOM, and the anti-hijacking prefixes some APIs put before JSON.
  const body = text.replace(/^﻿/, '').replace(/^\)\]\}',?\s*\n?/, '').replace(/^while\s*\(1\);\s*/, '');
  const trimmed = body.trim();
  const type = contentType.toLowerCase();
  const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();

  if (!trimmed) return { ok: true, data: null, format: 'empty' };

  const declaredNdjson = /ndjson|jsonl|json-seq|jsonlines/.test(type) || /\.(ndjson|jsonl)$/.test(path);
  const declaredJson = !declaredNdjson && (/[/+]json\b/.test(type) || /\.json$/.test(path));
  const looksJson = /^[[{"]/.test(trimmed) || /^(-?\d|true$|false$|null$)/.test(trimmed);

  if (declaredNdjson) {
    const lines = parseNdjson(trimmed);
    if (lines) return { ok: true, data: lines, format: 'ndjson' };
  }

  if (declaredJson || looksJson) {
    try {
      return { ok: true, data: JSON.parse(trimmed), format: 'json' };
    } catch (err: any) {
      const lines = parseNdjson(trimmed);
      if (lines) return { ok: true, data: lines, format: 'ndjson' };
      if (declaredJson) {
        return { ok: false, reason: err?.message || 'JSON parsing failed', errorType: 'invalid-json', message: 'The server said this is JSON, but it is not valid JSON.' };
      }
      // Looked like JSON but is something else (text starting with "{"): falls through to text.
    }
  }

  if (/yaml|yml/.test(type) || /\.(ya?ml)$/.test(path)) {
    try {
      const yaml = (await import('js-yaml')).default;
      const data = yaml.load(trimmed);
      if (data !== undefined && typeof data === 'object') return { ok: true, data, format: 'yaml' };
    } catch {
      // Not valid YAML after all: kept as text.
    }
  }

  if (/text\/csv|text\/tab-separated|application\/csv/.test(type) || /\.(csv|tsv)$/.test(path)) {
    try {
      const Papa = (await import('papaparse')).default;
      const result = Papa.parse(trimmed, { header: true, dynamicTyping: true, skipEmptyLines: true });
      if (Array.isArray(result.data) && result.data.length > 0 && (result.meta.fields?.length ?? 0) > 0) {
        return { ok: true, data: result.data, format: 'csv' };
      }
    } catch {
      // Kept as text.
    }
  }

  // HTML, XML, plain text and anything else readable.
  return { ok: true, data: null, format: 'text' };
}

/** Newline-delimited JSON: every non-empty line a JSON value. Null when it is not. */
function parseNdjson(text: string): any[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const out: any[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  return out;
}
