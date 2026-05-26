/**
 * Reusable Smart JSON Fetching Helper with Automatic Cloudflare Worker Fallback
 */

export interface SmartFetchResult {
  success: boolean;
  data: any | null;
  rawText: string;
  source: 'native' | 'fallback' | null;
  phase: 'native-fetch' | 'fallback-fetch' | 'json-parse' | 'initial' | null;
  status: number | null;
  reason: string | null;
  errorType: 'invalid-url' | 'cors-blocked' | 'invalid-json' | 'empty-response' | 'timeout' | 'non-json' | 'generic' | null;
  errorMessage: string;
  // Media Preview properties
  isMedia?: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'pdf' | null;
  mediaUrl?: string | null;
  contentType?: string | null;
  fileSize?: number;
}

export interface SmartFetchOptions extends RequestInit {
  timeout?: number;
  onProgress?: (progress: {
    phase: 'native-fetch' | 'fallback-fetch' | 'json-parse';
    message: string;
    usingFallback: boolean;
  }) => void;
}

/**
 * Validates whether a URL has a correct protocol and structure
 */
function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getMediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('application/pdf') || m === 'pdf') return 'pdf';
  return null;
}

export function getMediaTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(pathname)) return 'image';
    if (/\.(mp4|webm|ogg|mov)$/i.test(pathname)) return 'video';
    if (/\.(mp3|wav|ogg|aac|m4a)$/i.test(pathname)) return 'audio';
    if (/\.(pdf)$/i.test(pathname)) return 'pdf';
  } catch {}
  return null;
}

/**
 * Smart JSON Fetcher: attempts browser direct fetch first, and falls back to
 * a Cloudflare Worker proxy if CORS limits, status failures, or network errors persist.
 */
export async function smartJsonFetch(
  url: string,
  options: SmartFetchOptions = {}
): Promise<SmartFetchResult> {
  const { timeout = 10000, onProgress, ...fetchOptions } = options;

  // 1. Validate URL
  if (!url || !url.trim()) {
    return {
      success: false,
      data: null,
      rawText: '',
      source: null,
      phase: 'initial',
      status: null,
      reason: 'Empty URL',
      errorType: 'invalid-url',
      errorMessage: 'Please enter a valid API URL.'
    };
  }

  const trimmedUrl = url.trim();
  if (!isValidUrl(trimmedUrl)) {
    return {
      success: false,
      data: null,
      rawText: '',
      source: null,
      phase: 'initial',
      status: null,
      reason: 'Malformed URL',
      errorType: 'invalid-url',
      errorMessage: 'Please enter a valid API URL.'
    };
  }

  let nativeFetchError: any = null;
  let responseText = '';
  let responseStatus: number | null = null;
  let success = false;
  let responseData: any = null;
  let fetchSource: 'native' | 'fallback' | null = null;
  let currentPhase: 'native-fetch' | 'fallback-fetch' | 'json-parse' | 'initial' = 'initial';

  // Helper helper to check for timeout abort
  const createAbortController = () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return { controller, cleanup: () => clearTimeout(id) };
  };

  // 2. Try Native Browser Fetch
  currentPhase = 'native-fetch';
  if (onProgress) {
    onProgress({
      phase: 'native-fetch',
      message: 'Attempting to fetch directly from the source API...',
      usingFallback: false,
    });
  }

  const nativeAbort = createAbortController();
  try {
    const nativeOptions: RequestInit = {
      ...fetchOptions,
      signal: nativeAbort.controller.signal,
    };

    const response = await fetch(trimmedUrl, nativeOptions);
    responseStatus = response.status;

    const contentType = response.headers.get('content-type') || '';
    const mediaType = getMediaTypeFromMime(contentType) || getMediaTypeFromUrl(trimmedUrl);

    if (mediaType) {
      const blob = await response.blob();
      const mediaUrl = URL.createObjectURL(blob);
      nativeAbort.cleanup();
      return {
        success: false,
        data: null,
        rawText: `[Binary ${mediaType} content, Content-Type: ${contentType}, Size: ${blob.size} bytes]`,
        source: 'native',
        phase: 'native-fetch',
        status: response.status,
        reason: `Endpoint returned direct media of type ${mediaType}`,
        errorType: 'non-json',
        errorMessage: `This endpoint returned ${contentType || mediaType} content instead of JSON.`,
        isMedia: true,
        mediaType,
        mediaUrl,
        contentType,
        fileSize: blob.size
      };
    }

    responseText = await response.text();
    nativeAbort.cleanup();

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    // Attempt JSON Parse
    currentPhase = 'json-parse';
    if (onProgress) {
      onProgress({
        phase: 'json-parse',
        message: 'Parsing and validating JSON response...',
        usingFallback: false,
      });
    }

    const parseResult = validateAndParseJson(responseText);
    if (!parseResult.success) {
      throw parseResult.error; // triggers fallback to see if proxy works or gives better endpoint result
    }

    responseData = parseResult.data;
    success = true;
    fetchSource = 'native';

  } catch (err: any) {
    nativeAbort.cleanup();
    nativeFetchError = err;
    
    // Check for explicit timeout abort
    if (err.name === 'AbortError') {
      return {
        success: false,
        data: null,
        rawText: '',
        source: 'native',
        phase: 'native-fetch',
        status: null,
        reason: 'Request Timed Out',
        errorType: 'timeout',
        errorMessage: 'The request took too long to respond.'
      };
    }
  }

  // 3. Fallback to Cloudflare Worker if native fails
  if (!success) {
    currentPhase = 'fallback-fetch';
    if (onProgress) {
      onProgress({
        phase: 'fallback-fetch',
        message: 'We couldn’t access this API directly. Retrying securely through our cloud fetch layer...',
        usingFallback: true,
      });
    }

    const fallbackUrl = `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(trimmedUrl)}`;
    const fallbackAbort = createAbortController();

    try {
      const fallbackOptions: RequestInit = {
        ...fetchOptions,
        // Cloudflare proxies typically expect simpler option handling
        headers: {
          ...fetchOptions.headers,
          'Accept': 'application/json',
        },
        signal: fallbackAbort.controller.signal,
      };

      const response = await fetch(fallbackUrl, fallbackOptions);
      responseStatus = response.status;

      const contentType = response.headers.get('content-type') || '';
      const mediaType = getMediaTypeFromMime(contentType) || getMediaTypeFromUrl(trimmedUrl);

      if (mediaType) {
        const blob = await response.blob();
        const mediaUrl = URL.createObjectURL(blob);
        fallbackAbort.cleanup();
        return {
          success: false,
          data: null,
          rawText: `[Binary ${mediaType} content, Content-Type: ${contentType}, Size: ${blob.size} bytes]`,
          source: 'fallback',
          phase: 'fallback-fetch',
          status: response.status,
          reason: `Endpoint returned media of type ${mediaType} through fallback`,
          errorType: 'non-json',
          errorMessage: `This endpoint returned ${contentType || mediaType} content instead of JSON.`,
          isMedia: true,
          mediaType,
          mediaUrl,
          contentType,
          fileSize: blob.size
        };
      }

      responseText = await response.text();
      fallbackAbort.cleanup();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          rawText: responseText,
          source: 'fallback',
          phase: 'fallback-fetch',
          status: response.status,
          reason: `Proxy HTTP-${response.status}`,
          errorType: 'cors-blocked',
          errorMessage: 'This API blocked external access or is currently unavailable.'
        };
      }

      // Try to parse JSON from the proxy's response
      currentPhase = 'json-parse';
      const parseResult = validateAndParseJson(responseText);
      if (!parseResult.success) {
        // Return structured non-JSON error
        return {
          success: false,
          data: null,
          rawText: responseText,
          source: 'fallback',
          phase: 'json-parse',
          status: responseStatus,
          reason: parseResult.reason,
          errorType: parseResult.errorType,
          errorMessage: parseResult.errorMessage
        };
      }

      responseData = parseResult.data;
      success = true;
      fetchSource = 'fallback';

    } catch (err: any) {
      fallbackAbort.cleanup();
      
      if (err.name === 'AbortError') {
        return {
          success: false,
          data: null,
          rawText: '',
          source: 'fallback',
          phase: 'fallback-fetch',
          status: null,
          reason: 'Proxy Request Timed Out',
          errorType: 'timeout',
          errorMessage: 'The request took too long to respond.'
        };
      }

      // If native failed and proxy fell back and failed too, we reportblocked/unavailable
      return {
        success: false,
        data: null,
        rawText: '',
        source: 'fallback',
        phase: 'fallback-fetch',
        status: responseStatus,
        reason: err.message || 'CORS / Proxy Failure',
        errorType: 'cors-blocked',
        errorMessage: 'This API blocked external access or is currently unavailable.'
      };
    }
  }

  // Double check success
  if (success) {
    return {
      success: true,
      data: responseData,
      rawText: responseText,
      source: fetchSource,
      phase: currentPhase,
      status: responseStatus,
      reason: null,
      errorType: null,
      errorMessage: ''
    };
  }

  return {
    success: false,
    data: null,
    rawText: responseText,
    source: fetchSource,
    phase: currentPhase,
    status: responseStatus,
    reason: 'Fetch failed unexpectedly',
    errorType: 'generic',
    errorMessage: 'An unexpected connection issue occurred.'
  };
}

/**
 * Validates string content, verifying if it is empty, matches HTML structures, or parses correctly.
 */
function validateAndParseJson(text: string): {
  success: boolean;
  data?: any;
  reason?: string;
  error?: Error;
  errorType?: 'empty-response' | 'non-json' | 'invalid-json';
  errorMessage?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      reason: 'Empty body',
      errorType: 'empty-response',
      errorMessage: 'The API returned an empty response.'
    };
  }

  // Detect HTML response body proxy errors or fallback errors
  if (trimmed.startsWith('<!DOCTYPE html') || trimmed.toLowerCase().startsWith('<html') || trimmed.startsWith('<div')) {
    return {
      success: false,
      reason: 'HTML content instead of JSON',
      errorType: 'non-json',
      errorMessage: 'This endpoint returned HTML or unsupported content instead of JSON.'
    };
  }

  try {
    const data = JSON.parse(trimmed);
    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err,
      reason: err.message || 'JSON parsing failed',
      errorType: 'invalid-json',
      errorMessage: 'This endpoint did not return valid JSON data.'
    };
  }
}
