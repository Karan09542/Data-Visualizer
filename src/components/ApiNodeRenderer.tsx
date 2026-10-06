import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { resolveApiResponseView } from '../utils/transformer';
import { buildCurl, detectCandidatePaths } from '../utils/curlParser';
import {
  Activity,
  AlertCircle,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Copy,
  FileCode,
  FileJson,
  Globe,
  Key,
  KeyRound,
  ListTree,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  TimerOff,
  Trash2,
  X,
} from 'lucide-react';

interface ApiNodeRendererProps {
  url: string;
  path: string;
  nodeId: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
}

type StatusMeta = {
  label: string;
  title: string;
  dotClass: string;
  textClass: string;
};

const methodClassMap: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const getMethodClass = (method: string) =>
  methodClassMap[method] || 'bg-slate-500/10 text-slate-600 dark:text-slate-300';

const formatResponseType = (responseType: string) =>
  responseType === 'auto' ? 'Auto' : responseType.toUpperCase();

const formatTimeout = (timeout?: number) => {
  if (timeout === undefined || timeout === null || !Number.isFinite(timeout) || timeout <= 0) {
    return 'No timeout';
  }
  if (timeout < 1000) return `${timeout}ms`;

  const seconds = timeout / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
};

const getEndpointHost = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'No endpoint yet';

  try {
    return new URL(trimmed).host || 'Endpoint';
  } catch {
    return 'Custom endpoint';
  }
};

const formatSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusBadgeClass = (status?: number) => {
  if (!status) return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  if (status >= 300 && status < 400) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
  if (status >= 400 && status < 500) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
};

export const isLocalOrLoopbackUrl = (urlStr: string): boolean => {
  try {
    const u = new URL(urlStr, window.location.origin);
    const host = u.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
    );
  } catch {
    return urlStr.includes('localhost') || urlStr.includes('127.0.0.1');
  }
};

export function ApiNodeRenderer({ url, path, nodeId, nodeX, nodeY, nodeWidth }: ApiNodeRendererProps) {
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const apiNodeMeta = useStore((state) => state.apiNodeMeta);
  const setApiNodeMeta = useStore((state) => state.setApiNodeMeta);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeErrors = useStore((state) => state.apiNodeErrors);
  const setApiNodeResponse = useStore((state) => state.setApiNodeResponse);
  const setApiNodeLoading = useStore((state) => state.setApiNodeLoading);
  const setApiNodeError = useStore((state) => state.setApiNodeError);
  const removeApiNode = useStore((state) => state.removeApiNode);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);

  const [useProxy, setUseProxy] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserAbortedRef = useRef<boolean>(false);

  // Manual abort handler for signal aborting
  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      isUserAbortedRef.current = true;
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.warn('Failed to abort request:', err);
      }
    }
  }, []);

  // Cancel any active request on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        isUserAbortedRef.current = true;
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Listen for specific abort trigger from InlineApiEditor or canvas actions
  useEffect(() => {
    const handleSpecificAbort = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail && detail.path === path) {
        handleAbort();
      }
    };
    window.addEventListener('abort-api-node', handleSpecificAbort);
    return () => window.removeEventListener('abort-api-node', handleSpecificAbort);
  }, [handleAbort, path]);

  // Use the reactive global URL if we're currently editing this node.
  const isEditing = inlineApiEditor?.path === path;
  const currentUrl = isEditing ? inlineApiEditor.url : url;
  const normalizedUrl = currentUrl.trim();

  const config = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };

  const isLoading = apiNodeLoading[path];
  const error = apiNodeErrors[path];
  const meta = apiNodeMeta[path];
  const hasData = apiNodeResponses[path] !== undefined;
  const canFetch = normalizedUrl.length > 0;
  const errorRequestUrl = error?.requestInfo.url;

  const detectedCandidates = useMemo(() => {
    if (!hasData || config.extractPath) return [];
    return detectCandidatePaths(apiNodeResponses[path]);
  }, [hasData, config.extractPath, apiNodeResponses, path]);

  const topCandidate = detectedCandidates.length > 0 ? detectedCandidates[0] : null;

  const isLocalEndpoint = isLocalOrLoopbackUrl(currentUrl);
  const isHttpsOnLocal = isLocalEndpoint && currentUrl.toLowerCase().startsWith('https://');
  const hasOllamaPortTypo = isLocalEndpoint && currentUrl.includes(':11343');
  const suggestedFixedUrl = currentUrl
    .replace(/^https:\/\//i, 'http://')
    .replace(':11343', ':11434');

  useEffect(() => {
    if (!errorRequestUrl || errorRequestUrl === currentUrl) return;

    setApiNodeError(path, null);
    setShowErrorPopup(false);
    setShowAdvancedDiagnostics(false);
  }, [currentUrl, errorRequestUrl, path, setApiNodeError]);

  const handleFetch = useCallback(async (forceProxy = false) => {
    // If a request is already running for this node, cancel it first
    if (abortControllerRef.current) {
      try {
        isUserAbortedRef.current = true;
        abortControllerRef.current.abort();
      } catch {}
    }

    isUserAbortedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setApiNodeLoading(path, true);
    setApiNodeError(path, null);

    const startTime = performance.now();
    let resolvedUrl = currentUrl;
    let isLocalTarget = isLocalOrLoopbackUrl(currentUrl);
    let timeoutId: any = null;

    try {
      // 1. Build Target URL (include query params and auth query param if configured)
      try {
        const parsed = new URL(resolvedUrl, window.location.origin);
        if (config.params && Array.isArray(config.params)) {
          for (const p of config.params) {
            if (p.enabled !== false && p.key.trim() && !parsed.searchParams.has(p.key.trim())) {
              parsed.searchParams.append(p.key.trim(), p.value);
            }
          }
        }
        if (config.auth?.type === 'apiKey' && config.auth.apiKeyName && config.auth.apiKeyLocation === 'query') {
          parsed.searchParams.set(config.auth.apiKeyName, config.auth.apiKeyValue || '');
        }
        resolvedUrl = parsed.toString();
      } catch {
        // keep resolvedUrl as is
      }

      isLocalTarget = isLocalOrLoopbackUrl(resolvedUrl);

      // A remote cloud proxy cannot reach local machine loopback addresses!
      const shouldProxy = forceProxy && !isLocalTarget;

      const targetUrl = shouldProxy
        ? `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(resolvedUrl)}`
        : resolvedUrl;

      // 2. Assemble Request Headers
      const reqHeaders: Record<string, string> = {};
      if (config.responseType === 'json') {
        reqHeaders['Accept'] = 'application/json';
      }

      if (config.headers && Array.isArray(config.headers)) {
        for (const h of config.headers) {
          if (h.enabled !== false && h.key.trim()) {
            reqHeaders[h.key.trim()] = h.value;
          }
        }
      }

      if (config.auth) {
        if (config.auth.type === 'bearer' && config.auth.bearerToken) {
          reqHeaders['Authorization'] = `Bearer ${config.auth.bearerToken}`;
        } else if (config.auth.type === 'basic' && (config.auth.basicUsername || config.auth.basicPassword)) {
          try {
            const creds = btoa(`${config.auth.basicUsername || ''}:${config.auth.basicPassword || ''}`);
            reqHeaders['Authorization'] = `Basic ${creds}`;
          } catch {}
        } else if (config.auth.type === 'apiKey' && config.auth.apiKeyName && config.auth.apiKeyLocation !== 'query') {
          reqHeaders[config.auth.apiKeyName] = config.auth.apiKeyValue || '';
        }
      }

      // 3. Assemble Request Body
      let reqBody: any = undefined;
      const methodUpper = (config.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper) && config.body) {
        if (config.body.type === 'json' && config.body.rawJson) {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'application/json';
          }
          let jsonContent = config.body.rawJson;
          if (typeof config.streamEnabled === 'boolean') {
            try {
              const parsed = JSON.parse(jsonContent);
              if (parsed && typeof parsed === 'object') {
                parsed.stream = config.streamEnabled;
                jsonContent = JSON.stringify(parsed, null, 2);
              }
            } catch {}
          }
          reqBody = jsonContent;
        } else if (config.body.type === 'x-www-form-urlencoded' && config.body.urlEncoded) {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          }
          const usp = new URLSearchParams();
          for (const item of config.body.urlEncoded) {
            if (item.enabled !== false && item.key.trim()) {
              usp.append(item.key.trim(), item.value);
            }
          }
          reqBody = usp.toString();
        } else if (config.body.type === 'formData' && config.body.formData) {
          const fd = new FormData();
          for (const item of config.body.formData) {
            if (item.enabled !== false && item.key.trim()) {
              fd.append(item.key.trim(), item.value);
            }
          }
          reqBody = fd;
          delete reqHeaders['Content-Type'];
          delete reqHeaders['content-type'];
        } else if (config.body.type === 'raw' && config.body.rawText) {
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'text/plain';
          }
          reqBody = config.body.rawText;
        }
      }

      // Only schedule timeout if explicitly configured and greater than 0
      // If empty or <= 0, do NOT apply any timeout (allows indefinite streaming or long tasks)
      if (typeof config.timeout === 'number' && config.timeout > 0) {
        timeoutId = setTimeout(() => {
          isUserAbortedRef.current = false;
          controller.abort();
        }, config.timeout);
      }

      const res = await fetch(targetUrl, {
        method: config.method,
        headers: Object.keys(reqHeaders).length > 0 ? reqHeaders : undefined,
        body: reqBody,
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const duration = Math.round(performance.now() - startTime);
      const responseHeadersRecord: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeadersRecord[key] = val;
      });

      if (!res.ok) {
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch (e) {}

        setApiNodeMeta(path, {
          status: res.status,
          statusText: res.statusText || 'Error',
          duration,
          size: errorBody.length,
          headers: responseHeadersRecord,
        });

        let type = 'Server Error';
        let userMessage = 'The server encountered an unexpected condition.';
        if (res.status === 401) {
          type = 'Authentication Error';
          userMessage = 'Authentication credentials required.';
        } else if (res.status === 403) {
          type = 'Permission Error';
          userMessage = 'Access denied by server.';
        } else if (res.status === 404) {
          type = 'Not Found';
          userMessage = 'Requested endpoint does not exist.';
        } else if (res.status === 405) {
          type = 'Method Not Allowed';
          const allowHdr = res.headers.get('allow') || 'POST';
          userMessage = `The server rejected ${config.method} with 405 Method Not Allowed.\nThis endpoint requires ${allowHdr}.\n\nClick "Switch to ${allowHdr} & Retry" to update the method automatically.`;
        } else if (res.status >= 500) {
          type = 'Server Error';
          userMessage = 'The server encountered an unexpected condition.';
        } else {
          type = 'HTTP Error';
          userMessage = `Server returned ${res.status} ${res.statusText}.`;
        }

        throw {
          isDiagnostic: true,
          type,
          code: `${res.status}`,
          message: res.statusText || 'HTTP Error',
          userMessage: `${res.status} ${type}\n${userMessage}`,
          details: errorBody ? `Response body:\n${errorBody}` : undefined,
        };
      }

      let data;
      let dataSize = 0;
      const cl = res.headers.get('content-length');
      if (cl) {
        dataSize = parseInt(cl, 10) || 0;
      }

      const contentType = res.headers.get('content-type') || '';
      const isPdf = contentType.includes('application/pdf') || (config.responseType === 'auto' && currentUrl.match(/\.pdf(\?.*)?$/i));
      const isImage = contentType.includes('image/');
      const isAudio = contentType.includes('audio/');
      const isVideo = contentType.includes('video/');
      const isModel = contentType.includes('model/') || (config.responseType === 'auto' && currentUrl.match(/\.(glb|gltf|obj)(\?.*)?$/i));
      const hasMedia = isPdf || isImage || isAudio || isVideo || isModel;

      if (config.responseType === 'blob' || (config.responseType === 'auto' && hasMedia)) {
        const blob = await res.blob();
        dataSize = blob.size;
        if (isPdf) {
          const objectUrl = URL.createObjectURL(blob) + '#pdf';
          data = { _pdfUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isImage) {
          const objectUrl = URL.createObjectURL(blob) + '#image';
          data = { _imageUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isAudio) {
          const objectUrl = URL.createObjectURL(blob) + '#audio';
          data = { _audioUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isVideo) {
          const objectUrl = URL.createObjectURL(blob) + '#video';
          data = { _videoUrl: objectUrl, type: contentType, size: blob.size };
        } else if (isModel) {
          const objectUrl = URL.createObjectURL(blob) + '#model';
          data = { _modelUrl: objectUrl, type: contentType || 'model/gltf', size: blob.size };
        } else {
          data = { _blobSize: blob.size, type: contentType };
        }
      } else if (config.streamEnabled === true && res.body) {
        // Active stream consumer for real-time streaming chunks
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamAccumulated = '';
        const chunks: any[] = [];
        let combinedMessage = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkStr = decoder.decode(value, { stream: true });
            streamAccumulated += chunkStr;

            const lines = streamAccumulated.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
              const rawLine = lines[i].trim();
              if (!rawLine) continue;
              const lineContent = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine;
              if (lineContent === '[DONE]') continue;
              try {
                const parsed = JSON.parse(lineContent);
                chunks.push(parsed);
                const chunkText = parsed?.message?.content ?? parsed?.response ?? parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? '';
                if (chunkText) combinedMessage += chunkText;
              } catch {}
            }
            streamAccumulated = lines[lines.length - 1];

            if (combinedMessage || chunks.length > 0) {
              setApiNodeResponse(path, {
                _combinedMessage: combinedMessage || undefined,
                _chunksCount: chunks.length,
                chunks,
                _isStreaming: true,
              });
            }
          }
        } catch (streamErr: any) {
          // If aborted by user during streaming, preserve all received chunks and messages
          if (isUserAbortedRef.current && (combinedMessage || chunks.length > 0)) {
            setApiNodeResponse(path, {
              _combinedMessage: combinedMessage || undefined,
              _chunksCount: chunks.length,
              chunks,
              _isStreaming: false,
              _abortedEarly: true,
            });
            setApiNodeMeta(path, {
              status: 200,
              statusText: 'CANCELLED (PARTIAL)',
              duration: Math.round(performance.now() - startTime),
              size: new Blob([combinedMessage || streamAccumulated]).size,
              headers: responseHeadersRecord,
            });
            return;
          }
          throw streamErr;
        }

        if (streamAccumulated.trim()) {
          const rawLine = streamAccumulated.trim();
          const lineContent = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine;
          if (lineContent !== '[DONE]') {
            try {
              const parsed = JSON.parse(lineContent);
              chunks.push(parsed);
              const chunkText = parsed?.message?.content ?? parsed?.response ?? parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? '';
              if (chunkText) combinedMessage += chunkText;
            } catch {}
          }
        }

        dataSize = new Blob([combinedMessage || streamAccumulated]).size;
        data = combinedMessage ? {
          _combinedMessage: combinedMessage,
          _chunksCount: chunks.length,
          chunks,
        } : (chunks.length > 0 ? {
          _chunksCount: chunks.length,
          chunks,
        } : {
          _rawText: streamAccumulated,
        });
      } else if (config.responseType === 'json' || (config.responseType === 'auto' && contentType.includes('application/json'))) {
        const text = await res.text();
        if (!dataSize) dataSize = new Blob([text]).size;
        try {
          data = JSON.parse(text);
        } catch (e: any) {
          // Check for newline-delimited JSON (NDJSON, e.g. streaming Ollama responses or SSE)
          const lines = text.trim().split('\n').filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            try {
              const parsedChunks = lines.map((line) => {
                const cleaned = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : line.trim();
                return JSON.parse(cleaned);
              });
              const combinedText = parsedChunks
                .map((c) => c?.message?.content ?? c?.response ?? c?.choices?.[0]?.delta?.content ?? c?.choices?.[0]?.text ?? '')
                .join('');
              data = {
                _combinedMessage: combinedText || undefined,
                _chunksCount: parsedChunks.length,
                chunks: parsedChunks,
              };
            } catch {
              if (config.responseType === 'json') {
                throw {
                  isDiagnostic: true,
                  type: 'JSON Parse Error',
                  code: 'PARSE_ERR',
                  message: e.message,
                  userMessage: 'Response was received but could not be parsed as valid JSON.',
                  details: text.slice(0, 500) + (text.length > 500 ? '...' : '')
                };
              } else {
                data = { _rawText: text };
              }
            }
          } else if (config.responseType === 'json') {
            throw {
              isDiagnostic: true,
              type: 'JSON Parse Error',
              code: 'PARSE_ERR',
              message: e.message,
              userMessage: 'Response was received but could not be parsed as valid JSON.',
              details: text.slice(0, 500) + (text.length > 500 ? '...' : '')
            };
          } else {
            data = { _rawText: text };
          }
        }
      } else {
        const text = await res.text();
        if (!dataSize) dataSize = new Blob([text]).size;
        if (config.responseType === 'auto') {
          try {
            data = JSON.parse(text);
          } catch {
            data = { _rawText: text };
          }
        } else {
          data = { _rawText: text };
        }
      }

      setApiNodeMeta(path, {
        status: res.status,
        statusText: res.statusText || 'OK',
        duration,
        size: dataSize,
        headers: responseHeadersRecord,
      });

      setApiNodeResponse(path, data);
      if (forceProxy) setUseProxy(true);
    } catch (e: any) {
      const duration = Math.round(performance.now() - startTime);
      const baseRequestInfo = {
        url: currentUrl,
        method: config.method,
        proxyUsed: forceProxy
      };

      if (e.isDiagnostic) {
        setApiNodeError(path, {
          ...e,
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo
        });
        return;
      }

      if (e.name === 'AbortError') {
        if (isUserAbortedRef.current) {
          setApiNodeMeta(path, {
            status: 499,
            statusText: 'CANCELLED',
            duration,
          });
          setApiNodeError(path, {
            type: 'Request Cancelled',
            code: 'CANCELLED',
            message: 'Request was cancelled by user.',
            userMessage: 'The API request was stopped before completing.',
            timestamp: new Date().toISOString(),
            requestInfo: baseRequestInfo
          });
        } else {
          setApiNodeMeta(path, {
            status: 408,
            statusText: 'TIMEOUT',
            duration,
          });
          setApiNodeError(path, {
            type: 'Timeout',
            code: 'TIMEOUT',
            message: 'Request exceeded timeout limit.',
            userMessage: `Request exceeded timeout limit${config.timeout ? ` (${formatTimeout(config.timeout)})` : ''}.`,
            timestamp: new Date().toISOString(),
            requestInfo: baseRequestInfo
          });
        }
        return;
      } else if (!forceProxy && !isLocalTarget && (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError'))) {
        // Likely CORS error on public endpoint, retry with proxy.
        handleFetch(true);
        return;
      } else {
        setApiNodeMeta(path, {
          status: 0,
          statusText: 'ERR',
          duration,
        });

        let type = 'Network Error';
        let code = 'FETCH_ERR';
        let userMessage = 'Unable to connect to the endpoint.\n\nPossible causes:\n- Server unavailable\n- Network issue\n- CORS restriction';

        if (isLocalTarget) {
          const isHttpsLocal = resolvedUrl.toLowerCase().startsWith('https://');
          const hasPortTypo = resolvedUrl.includes(':11343');

          type = 'Local Server Connection Error';
          code = 'LOCAL_ERR';
          userMessage = `Unable to connect to local server at ${resolvedUrl}.\n\n`;

          if (isHttpsLocal) {
            userMessage += `⚠️ Protocol Issue: You are requesting "https://" on localhost. Local servers (like Ollama) run on plain HTTP, not HTTPS.\n\n`;
          }
          if (hasPortTypo) {
            userMessage += `💡 Port Typo: Port 11343 was requested. The default port for Ollama is 11434.\n\n`;
          }
          userMessage += `Troubleshooting Checklist:\n1. Ensure Ollama is running (check terminal or system tray)\n2. Change URL to: http://localhost:11434/api/chat\n3. If CORS is blocked, set OLLAMA_ORIGINS=* before starting Ollama`;
        } else if (forceProxy) {
          type = 'Proxy Error';
          userMessage = 'Proxy fetch failed.\nWorker endpoint returned an error.';
        }

        setApiNodeError(path, {
          type,
          code,
          message: e.message || 'Fetch failed',
          userMessage,
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo,
          details: e.stack
        });
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      abortControllerRef.current = null;
      setApiNodeLoading(path, false);
    }
  }, [path, currentUrl, config, setApiNodeLoading, setApiNodeError, setApiNodeResponse, setApiNodeMeta]);

  useEffect(() => {
    const handleGlobalRefetch = () => {
      handleFetch(useProxy);
    };
    window.addEventListener('refetch-all-api-nodes', handleGlobalRefetch);
    return () => window.removeEventListener('refetch-all-api-nodes', handleGlobalRefetch);
  }, [handleFetch, useProxy]);

  // Listen for specific trigger from InlineApiEditor "Send" button
  useEffect(() => {
    const handleSpecificFetch = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail && detail.path === path) {
        handleFetch(useProxy);
      }
    };
    window.addEventListener('fetch-api-node', handleSpecificFetch);
    return () => window.removeEventListener('fetch-api-node', handleSpecificFetch);
  }, [handleFetch, path, useProxy]);

  const clearData = () => {
    removeApiNode(path);
    setUseProxy(false);
  };

  // Which way the response is currently attached (child nodes or a single file node)
  const currentView = hasData ? resolveApiResponseView(apiNodeResponses[path], config.view) : null;
  const toggleResponseView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setApiNodeConfig(path, { ...config, view: currentView === 'file' ? 'nodes' : 'file' });
  };

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineApiEditor({
      url: currentUrl,
      path,
      nodeId,
      x: nodeX,
      y: nodeY,
      width: nodeWidth,
      // The node wrapper adds 6px padding above and below the card
      height: (cardRef.current?.offsetHeight ?? 128) + 12,
    });
  };

  const handleCopyCurl = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const curl = buildCurl(
        currentUrl,
        config.method || 'GET',
        config.params || [],
        config.headers || [],
        config.auth || { type: 'none' },
        config.body || { type: 'none' }
      );
      navigator.clipboard.writeText(curl);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch (err) {
      console.error('Failed to copy cURL', err);
    }
  };

  const endpointHost = getEndpointHost(currentUrl);
  const responseLabel = formatResponseType(config.responseType);
  const timeoutLabel = formatTimeout(config.timeout);

  const allowHeader = meta?.headers
    ? (meta.headers['allow'] || meta.headers['Allow'])
    : undefined;
  const suggestedMethod = allowHeader ? allowHeader.split(',')[0].trim().toUpperCase() : 'POST';

  const statusMeta: StatusMeta = isLoading
    ? {
        label: config.streamEnabled ? 'Streaming…' : 'Fetching…',
        title: 'Request in progress (click Cancel to abort)',
        dotClass: 'bg-amber-500 animate-pulse',
        textClass: 'text-amber-600 dark:text-amber-400',
      }
    : error
      ? {
          label: error.code === 'CANCELLED' ? 'Cancelled' : 'Failed',
          title: error.userMessage || 'Show error details',
          dotClass: error.code === 'CANCELLED' ? 'bg-slate-400' : 'bg-red-500',
          textClass: error.code === 'CANCELLED' ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400',
        }
      : hasData
        ? { label: 'Connected', title: 'API data loaded', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600 dark:text-emerald-400' }
        : canFetch
          ? { label: 'Ready', title: 'Ready to fetch data', dotClass: 'bg-blue-500', textClass: 'text-blue-600 dark:text-blue-400' }
          : { label: 'No URL', title: 'Add an endpoint URL', dotClass: 'bg-slate-400 dark:bg-slate-600', textClass: 'text-slate-500 dark:text-slate-400' };

  const iconButtonClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';

  const openErrorPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowErrorPopup(!showErrorPopup);
    setShowAdvancedDiagnostics(false);
  };

  const statusContent = (
    <>
      <span className={`h-2 w-2 shrink-0 rounded-full ${statusMeta.dotClass}`} />
      <span className={`font-medium ${statusMeta.textClass}`}>{statusMeta.label}</span>
      {error && !isLoading && <ChevronRight size={12} className={statusMeta.textClass} />}
    </>
  );

  return (
    <div className="flex h-full w-full min-w-0 pointer-events-auto">
      <div
        ref={cardRef}
        className={`relative flex h-full min-h-[128px] w-full max-w-[340px] flex-col overflow-hidden rounded-xl border bg-white text-slate-900 shadow-sm transition-colors dark:bg-[#0f172a] dark:text-slate-100 ${isEditing
          ? 'border-blue-500/60 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800'
          }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 relative group">
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-blue-500 group-hover:opacity-0 transition-opacity" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbort();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                    title="Click to cancel active request"
                    aria-label="Cancel active request"
                  >
                    <Square size={10} className="fill-current" />
                  </button>
                </>
              ) : (
                <Globe size={16} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">API request</div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <select
                  value={config.method}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newMethod = e.target.value;
                    setApiNodeConfig(path, { ...config, method: newMethod });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold cursor-pointer border-0 outline-none uppercase tracking-wide transition-opacity hover:opacity-85 ${getMethodClass(config.method)}`}
                  title="Click to switch HTTP method"
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m} value={m} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-semibold text-xs">
                      {m}
                    </option>
                  ))}
                </select>
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={endpointHost}>
                  {endpointHost}
                </span>
                {/* Auth Chip */}
                {config.auth && config.auth.type !== 'none' && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-violet-500/10 pl-1 pr-0.5 py-px text-[9px] font-medium text-violet-600 dark:text-violet-400 group transition-all"
                    title={`Auth: ${config.auth.type} (click × to disable)`}
                  >
                    <Key size={9} className="shrink-0" />
                    <span>{config.auth.type}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, auth: { type: 'none' } });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-violet-500/20 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
                      title="Disable authentication"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Body Chip */}
                {config.body && config.body.type !== 'none' && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 pl-1 pr-0.5 py-px text-[9px] font-medium text-amber-600 dark:text-amber-400 group transition-all"
                    title={`Body: ${config.body.type} (click × to remove body)`}
                  >
                    <FileCode size={9} className="shrink-0" />
                    <span>{config.body.type}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, body: { type: 'none' } });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                      title="Disable / remove request body"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Streaming Chip (stream: true / stream: false) */}
                {config.streamEnabled !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded pl-1 pr-0.5 py-px text-[9px] font-medium transition-all ${
                      config.streamEnabled
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                    title={`Streaming: ${config.streamEnabled ? 'stream: true' : 'stream: false'} (click text to toggle, × to disable)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, streamEnabled: !config.streamEnabled });
                      }}
                      className="cursor-pointer hover:underline flex items-center gap-0.5"
                      title="Click to toggle between Single and Stream"
                    >
                      {config.streamEnabled ? <Activity size={9} /> : <span className="text-[10px]">⚡</span>}
                      <span>{config.streamEnabled ? 'stream' : 'single'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, streamEnabled: undefined });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      title="Disable stream mode (revert to Auto)"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Key Extraction Chip */}
                {config.extractPath && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 pl-1 pr-0.5 py-px text-[9px] font-medium text-indigo-600 dark:text-indigo-400 transition-all max-w-[150px]"
                    title={`Extracting key: ${config.extractPath} (click text to edit, × to clear)`}
                  >
                    <button
                      type="button"
                      onClick={openEditor}
                      className="cursor-pointer hover:underline flex items-center gap-0.5 min-w-0 truncate"
                      title={`Edit extraction path: ${config.extractPath}`}
                    >
                      <KeyRound size={9} className="shrink-0" />
                      <span className="truncate">{config.extractPath}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, extractPath: undefined });
                      }}
                      className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                      title="Disable extraction (show full response)"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}

                {/* Response Format Chip (MARKDOWN / JSON / TEXT) */}
                {config.responseFormat && config.responseFormat !== 'auto' && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-fuchsia-500/10 pl-1.5 pr-0.5 py-px text-[9px] font-semibold text-fuchsia-600 dark:text-fuchsia-400 uppercase transition-all"
                    title={`Format: ${config.responseFormat} (click text to cycle, × to disable)`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextFormatMap: Record<string, 'auto' | 'json' | 'markdown' | 'text'> = {
                          markdown: 'json',
                          json: 'text',
                          text: 'auto',
                          auto: 'markdown',
                        };
                        const next = nextFormatMap[config.responseFormat || 'auto'] || 'auto';
                        setApiNodeConfig(path, { ...config, responseFormat: next });
                      }}
                      className="cursor-pointer hover:underline"
                      title="Click to cycle format (Markdown → JSON → Text → Auto)"
                    >
                      {config.responseFormat}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApiNodeConfig(path, { ...config, responseFormat: 'auto' });
                      }}
                      className="ml-0.5 rounded p-0.5 hover:bg-fuchsia-500/20 hover:text-fuchsia-800 dark:hover:text-fuchsia-200 transition-colors"
                      title="Reset format to Auto"
                    >
                      <X size={8} />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handleCopyCurl}
              className={iconButtonClass}
              title={copiedCurl ? "Copied cURL command!" : "Copy as cURL command"}
              aria-label="Copy cURL"
            >
              {copiedCurl ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            <button
              onClick={openEditor}
              className={`${iconButtonClass} ${isEditing ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''}`}
              title="Edit request (Postman / Apidog style)"
              aria-label="Edit request"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>

        {/* URL */}
        {canFetch ? (
          <div
            className="mx-3 mt-2.5 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
            title={currentUrl}
          >
            {currentUrl}
          </div>
        ) : (
          <button
            onClick={openEditor}
            className="mx-3 mt-2.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-left text-[11px] text-slate-500 transition-colors hover:border-blue-500/60 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400"
          >
            + Add an endpoint URL
          </button>
        )}

        {/* Response Metrics Strip (Status, Latency, Size) */}
        {meta?.status !== undefined && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/70 px-2 py-1 text-[10px] font-mono dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 font-semibold border ${getStatusBadgeClass(meta.status)}`}>
                {meta.status} {meta.statusText || ''}
              </span>
              {meta.duration !== undefined && (
                <span className="text-slate-500 dark:text-slate-400" title="Response latency">
                  ⚡ {meta.duration}ms
                </span>
              )}
            </div>
            {meta.size !== undefined && meta.size > 0 && (
              <span className="text-slate-500 dark:text-slate-400" title="Response size">
                📦 {formatSize(meta.size)}
              </span>
            )}
          </div>
        )}

        {/* Quick Suggestion: One-Click Extract for LLM / Structured Responses */}
        {topCandidate && hasData && !isLoading && !config.extractPath && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs dark:bg-indigo-500/15">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium truncate">
              <Sparkles size={13} className="shrink-0 text-indigo-500" />
              <span className="truncate">Extract <strong>{topCandidate.path}</strong></span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApiNodeConfig(path, {
                  ...config,
                  extractPath: topCandidate.path,
                  responseFormat: 'markdown',
                  view: 'file'
                });
              }}
              className="shrink-0 ml-2 rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-indigo-500 active:scale-95"
              title={`Extract ${topCandidate.path} and format response`}
            >
              Extract & Format
            </button>
          </div>
        )}

        {/* Local Server Protocol or Port Auto-Fix */}
        {error && isLocalEndpoint && (isHttpsOnLocal || hasOllamaPortTypo) && (
          <div className="mx-3 mt-2 flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs dark:bg-amber-500/15">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              <AlertCircle size={14} className="shrink-0 text-amber-500" />
              <span>
                {isHttpsOnLocal && hasOllamaPortTypo
                  ? 'Localhost requires http:// and port 11434'
                  : isHttpsOnLocal
                    ? 'Localhost requires http://, not https://'
                    : 'Ollama uses port 11434 (not 11343)'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="truncate font-mono text-[10px] text-amber-600 dark:text-amber-400" title={suggestedFixedUrl}>
                → {suggestedFixedUrl}
              </span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isEditing && inlineApiEditor) {
                    setInlineApiEditor({ ...inlineApiEditor, url: suggestedFixedUrl });
                  }
                  await updateNodeValue(path, suggestedFixedUrl);
                  setApiNodeError(path, null);
                  setTimeout(() => handleFetch(false), 50);
                }}
                className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-amber-500 active:scale-95"
                title={`Fix URL to ${suggestedFixedUrl} and retry`}
              >
                Fix URL & Retry
              </button>
            </div>
          </div>
        )}

        {/* 405 Method Not Allowed Quick Resolution */}
        {(meta?.status === 405 || error?.code === '405') && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs dark:bg-amber-500/15">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
              <AlertCircle size={13} className="shrink-0 text-amber-500" />
              <span>Requires <strong>{suggestedMethod}</strong></span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApiNodeConfig(path, { ...config, method: suggestedMethod });
                setTimeout(() => handleFetch(useProxy), 50);
              }}
              className="shrink-0 ml-2 rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-amber-500 active:scale-95"
              title={`Switch method to ${suggestedMethod} and retry request`}
            >
              Switch to {suggestedMethod} & Retry
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-2.5 pt-2.5">
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            {error && !isLoading ? (
              <button
                onClick={openErrorPopup}
                className="-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-red-500/10"
                title={statusMeta.title}
              >
                {statusContent}
              </button>
            ) : (
              <span className="flex items-center gap-1.5" title={statusMeta.title}>
                {statusContent}
              </span>
            )}
            <span className="truncate text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span>{responseLabel}</span>
              <span>·</span>
              {!config.timeout || config.timeout <= 0 ? (
                <span className="inline-flex items-center gap-0.5 text-slate-400" title="No timeout applied (runs until complete or cancelled)">
                  <TimerOff size={10} className="shrink-0" />
                  <span>∞</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5" title={`Timeout: ${timeoutLabel}`}>
                  <Timer size={10} className="shrink-0" />
                  <span>{timeoutLabel}</span>
                </span>
              )}
            </span>
            {useProxy && (
              <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-px text-[10px] font-medium text-orange-600 dark:text-orange-400" title="Fetched through the proxy">
                Proxy
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isLoading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAbort();
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 px-2 text-[11px] font-semibold transition-all active:scale-95 shadow-xs cursor-pointer"
                title="Cancel in-flight request signal"
                aria-label="Cancel request"
              >
                <Square size={10} className="fill-current text-rose-500" />
                <span>Cancel</span>
              </button>
            )}

            {!hasData && !isLoading && !error && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(false); }}
                disabled={!canFetch}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                title={canFetch ? 'Fetch data' : 'Add an API URL first'}
              >
                <Play size={12} className="fill-current" />
                Fetch
              </button>
            )}

            {error && !isLoading && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(error.requestInfo.proxyUsed); }}
                className={iconButtonClass}
                title="Retry"
                aria-label="Retry"
              >
                <RefreshCw size={14} />
              </button>
            )}

            {hasData && !isLoading && !error && (
              <>
                <button
                  onClick={toggleResponseView}
                  className={iconButtonClass}
                  title={currentView === 'file' ? 'Show response as child nodes' : 'Show response as a file'}
                  aria-label={currentView === 'file' ? 'Show response as child nodes' : 'Show response as a file'}
                >
                  {currentView === 'file' ? <ListTree size={14} /> : <FileJson size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                  className={iconButtonClass}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); clearData(); }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                  title="Clear fetched data"
                  aria-label="Clear fetched data"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {error && !isLoading && showErrorPopup && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
          >
            <div
              role="dialog"
              aria-label="API fetch error"
              className="flex w-[420px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white font-sans text-slate-900 shadow-2xl pointer-events-auto dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight">Request failed</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-red-600 dark:text-red-400">{error.type}</span>
                      {error.code && (
                        <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {error.code}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Close"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 py-4">
                <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  {error.userMessage}
                </div>

                <div>
                  <button
                    onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {showAdvancedDiagnostics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Technical details
                  </button>

                  {showAdvancedDiagnostics && (
                    <div className="custom-scrollbar mt-2 max-h-[250px] overflow-y-auto break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                      <div className="mb-1 font-semibold text-blue-300">Request URL</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.url}</div>

                      <div className="mb-1 font-semibold text-blue-300">Method</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.method}</div>

                      <div className="mb-1 font-semibold text-blue-300">Proxy used</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.requestInfo.proxyUsed ? 'Yes' : 'No'}</div>

                      <div className="mb-1 font-semibold text-blue-300">Raw message</div>
                      <div className="mb-3 border-l-2 border-slate-700 pl-2">{error.message}</div>

                      {error.details && (
                        <>
                          <div className="mb-1 font-semibold text-violet-300">Diagnostics / stack</div>
                          <div className="whitespace-pre-wrap border-l-2 border-slate-700 pl-2 text-[10px] opacity-85">{error.details}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                {(error.code === '405' || meta?.status === 405) && (
                  <button
                    onClick={() => {
                      setApiNodeConfig(path, { ...config, method: suggestedMethod });
                      setShowErrorPopup(false);
                      setTimeout(() => handleFetch(error.requestInfo.proxyUsed), 50);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-500"
                  >
                    Switch to {suggestedMethod} & Retry
                  </button>
                )}
                {!error.requestInfo.proxyUsed && (
                  <button
                    onClick={() => { handleFetch(true); setShowErrorPopup(false); }}
                    className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    Retry with proxy
                  </button>
                )}
                <button
                  onClick={() => { handleFetch(error.requestInfo.proxyUsed); setShowErrorPopup(false); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
