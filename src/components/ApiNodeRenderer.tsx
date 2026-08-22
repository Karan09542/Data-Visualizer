import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Loader2,
  PlayCircle,
  RefreshCw,
  Server,
  XCircle,
  type LucideIcon,
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
  icon: LucideIcon;
  className: string;
  iconClassName?: string;
};

const methodClassMap: Record<string, string> = {
  GET: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  POST: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  PUT: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  PATCH: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300',
  DELETE: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300',
};

const getMethodClass = (method: string) =>
  methodClassMap[method] || 'border-zinc-400/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300';

const formatResponseType = (responseType: string) =>
  responseType === 'auto' ? 'Auto' : responseType.toUpperCase();

const formatTimeout = (timeout: number) => {
  if (!Number.isFinite(timeout) || timeout <= 0) return '5s';
  if (timeout < 1000) return `${timeout}ms`;

  const seconds = timeout / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
};

const getEndpointHost = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'No endpoint';

  try {
    return new URL(trimmed).host || 'Endpoint';
  } catch {
    return 'Custom endpoint';
  }
};

export function ApiNodeRenderer({ url, path, nodeId, nodeX, nodeY, nodeWidth }: ApiNodeRendererProps) {
  const apiNodeResponses = useStore((state) => state.apiNodeResponses);
  const apiNodeLoading = useStore((state) => state.apiNodeLoading);
  const apiNodeErrors = useStore((state) => state.apiNodeErrors);
  const setApiNodeResponse = useStore((state) => state.setApiNodeResponse);
  const setApiNodeLoading = useStore((state) => state.setApiNodeLoading);
  const setApiNodeError = useStore((state) => state.setApiNodeError);
  const removeApiNode = useStore((state) => state.removeApiNode);
  const inlineApiEditor = useStore((state) => state.inlineApiEditor);
  const setInlineApiEditor = useStore((state) => state.setInlineApiEditor);
  const apiNodeConfig = useStore((state) => state.apiNodeConfig);

  const [useProxy, setUseProxy] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);

  // Use the reactive global URL if we're currently editing this node.
  const isEditing = inlineApiEditor?.path === path;
  const currentUrl = isEditing ? inlineApiEditor.url : url;
  const normalizedUrl = currentUrl.trim();

  const config = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };

  const isLoading = apiNodeLoading[path];
  const error = apiNodeErrors[path];
  const hasData = apiNodeResponses[path] !== undefined;
  const canFetch = normalizedUrl.length > 0;
  const errorRequestUrl = error?.requestInfo.url;

  useEffect(() => {
    if (!errorRequestUrl || errorRequestUrl === currentUrl) return;

    setApiNodeError(path, null);
    setShowErrorPopup(false);
    setShowAdvancedDiagnostics(false);
  }, [currentUrl, errorRequestUrl, path, setApiNodeError]);

  const handleFetch = useCallback(async (forceProxy = false) => {
    setApiNodeLoading(path, true);
    setApiNodeError(path, null);

    try {
      const targetUrl = forceProxy
        ? `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(currentUrl)}`
        : currentUrl;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const res = await fetch(targetUrl, {
        method: config.method,
        headers: config.responseType === 'json' ? { 'Accept': 'application/json' } : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch (e) {}

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
      const contentType = res.headers.get('content-type') || '';

      const isPdf = contentType.includes('application/pdf') || (config.responseType === 'auto' && currentUrl.match(/\.pdf(\?.*)?$/i));
      const isImage = contentType.includes('image/');
      const isAudio = contentType.includes('audio/');
      const isVideo = contentType.includes('video/');
      const isModel = contentType.includes('model/') || (config.responseType === 'auto' && currentUrl.match(/\.(glb|gltf|obj)(\?.*)?$/i));
      const hasMedia = isPdf || isImage || isAudio || isVideo || isModel;

      if (config.responseType === 'blob' || (config.responseType === 'auto' && hasMedia)) {
        const blob = await res.blob();
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
      } else if (config.responseType === 'json' || (config.responseType === 'auto' && contentType.includes('application/json'))) {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (e: any) {
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
      } else {
        const text = await res.text();
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

      setApiNodeResponse(path, data);
      if (forceProxy) setUseProxy(true);
    } catch (e: any) {
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
        setApiNodeError(path, {
          type: 'Timeout',
          code: 'TIMEOUT',
          message: 'Request exceeded timeout limit.',
          userMessage: 'Request exceeded timeout limit.',
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo
        });
      } else if (!forceProxy && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
        // Likely CORS error, silently retry with proxy.
        handleFetch(true);
        return;
      } else {
        let type = 'Network Error';
        let userMessage = 'Unable to connect to the endpoint.\n\nPossible causes:\n- Server unavailable\n- Network issue\n- CORS restriction';
        if (forceProxy) {
          type = 'Proxy Error';
          userMessage = 'Proxy fetch failed.\nWorker endpoint returned an error.';
        }

        setApiNodeError(path, {
          type,
          code: 'FETCH_ERR',
          message: e.message || 'Fetch failed',
          userMessage,
          timestamp: new Date().toISOString(),
          requestInfo: baseRequestInfo,
          details: e.stack
        });
      }
    } finally {
      setApiNodeLoading(path, false);
    }
  }, [path, currentUrl, config.method, config.responseType, config.timeout, setApiNodeLoading, setApiNodeError, setApiNodeResponse]);

  useEffect(() => {
    const handleGlobalRefetch = () => {
      handleFetch(useProxy);
    };
    window.addEventListener('refetch-all-api-nodes', handleGlobalRefetch);
    return () => window.removeEventListener('refetch-all-api-nodes', handleGlobalRefetch);
  }, [handleFetch, useProxy]);

  const clearData = () => {
    removeApiNode(path);
    setUseProxy(false);
  };

  const endpointHost = getEndpointHost(currentUrl);
  const responseLabel = formatResponseType(config.responseType);
  const timeoutLabel = formatTimeout(config.timeout);

  const statusMeta: StatusMeta = isLoading
    ? {
        label: 'Fetching',
        title: 'Request in progress',
        icon: Loader2,
        iconClassName: 'animate-spin',
        className: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
      }
    : error
      ? {
          label: 'Failed',
          title: 'Open API error details',
          icon: AlertCircle,
          className: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300',
        }
      : hasData
        ? {
            label: 'Connected',
            title: 'API data loaded',
            icon: CheckCircle2,
            className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
          }
        : {
            label: canFetch ? 'Ready' : 'No URL',
            title: canFetch ? 'Ready to fetch data' : 'Add an endpoint URL',
            icon: PlayCircle,
            className: canFetch
              ? 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300'
              : 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
          };

  const StatusIcon = statusMeta.icon;
  const iconButtonClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200/80 bg-white/85 text-zinc-500 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100';
  const statusPillClass = `inline-flex h-7 max-w-[138px] items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold ${statusMeta.className}`;

  const openErrorPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowErrorPopup(!showErrorPopup);
    setShowAdvancedDiagnostics(false);
  };

  return (
    <div className="flex h-full w-full min-w-0 pointer-events-auto">
      <div className="relative flex h-full min-h-[128px] w-full max-w-[340px] flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white/95 text-zinc-900 shadow-[0_14px_36px_-24px_rgba(24,24,27,0.65),0_1px_0_rgba(255,255,255,0.75)_inset] backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-950/95 dark:text-zinc-100 dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)_inset]">
        <div className={`h-0.5 w-full ${error ? 'bg-red-500' : hasData ? 'bg-emerald-500' : isLoading ? 'bg-amber-500' : 'bg-blue-500'}`} />

        <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <Server size={15} className={isLoading ? 'animate-pulse' : ''} />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-200">
                  API Endpoint
                </span>
                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-none ${getMethodClass(config.method)}`}>
                  {config.method}
                </span>
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-500">
                <span className="truncate">{responseLabel}</span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span className="shrink-0">{timeoutLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {useProxy && (
              <span className="rounded-md border border-orange-500/25 bg-orange-500/10 px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-orange-600 dark:text-orange-300">
                Proxy
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInlineApiEditor({ url: currentUrl, path, nodeId, x: nodeX, y: nodeY, width: nodeWidth });
              }}
              className={iconButtonClass}
              title="Edit API URL"
            >
              <Edit3 size={13} />
            </button>
          </div>
        </div>

        <div className="mx-3 mt-2 flex min-h-[32px] min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 shadow-inner dark:border-zinc-800 dark:bg-black/30">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[10px] font-semibold text-zinc-600 dark:text-zinc-300" title={endpointHost}>
              {endpointHost}
            </div>
            <div className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-500" title={currentUrl}>
              {currentUrl || 'https://api.example.com/data'}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-200/80 px-3 py-2 dark:border-white/10">
          {error && !isLoading ? (
            <button
              onClick={openErrorPopup}
              className={`${statusPillClass} transition-colors hover:bg-red-500/15`}
              title={statusMeta.title}
            >
              <StatusIcon size={12} className={statusMeta.iconClassName} />
              <span className="truncate">{statusMeta.label}</span>
            </button>
          ) : (
            <div className={statusPillClass} title={statusMeta.title}>
              <StatusIcon size={12} className={statusMeta.iconClassName} />
              <span className="truncate">{statusMeta.label}</span>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {!hasData && !isLoading && !error && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(false); }}
                disabled={!canFetch}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[11px] font-bold text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                title={canFetch ? 'Fetch data' : 'Add an API URL first'}
              >
                <PlayCircle size={13} />
                Fetch Data
              </button>
            )}

            {error && !isLoading && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(error.requestInfo.proxyUsed); }}
                className={iconButtonClass}
                title="Retry"
              >
                <RefreshCw size={13} />
              </button>
            )}

            {hasData && !isLoading && !error && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                  className={iconButtonClass}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); clearData(); }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 text-red-600 shadow-sm transition-colors hover:bg-red-500/15 dark:text-red-300"
                  title="Clear fetched data"
                >
                  <XCircle size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {error && !isLoading && showErrorPopup && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
          >
            <div
              className="flex w-[420px] max-w-[92vw] flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 font-sans text-zinc-900 shadow-2xl pointer-events-auto dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-white/10">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <AlertCircle size={18} className="text-red-500" />
                  API Fetch Error
                </h3>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
                  className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                  title="Close"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Type</span>
                <span className="font-semibold text-red-600 dark:text-red-300">{error.type}</span>

                {error.code && (
                  <>
                    <span className="text-zinc-500 dark:text-zinc-400">Code</span>
                    <span className="w-fit rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
                      {error.code}
                    </span>
                  </>
                )}
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 shadow-inner dark:border-zinc-800 dark:bg-black/30 dark:text-zinc-200">
                {error.userMessage}
              </div>

              <div className="flex gap-2 border-t border-zinc-200 pt-3 dark:border-white/10">
                <button
                  onClick={() => { handleFetch(error.requestInfo.proxyUsed); setShowErrorPopup(false); }}
                  className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-blue-500"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
                {!error.requestInfo.proxyUsed && (
                  <button
                    onClick={() => { handleFetch(true); setShowErrorPopup(false); }}
                    className="flex h-9 flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
                  >
                    Retry With Proxy
                  </button>
                )}
              </div>

              <div>
                <button
                  onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {showAdvancedDiagnostics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Technical Details
                </button>

                {showAdvancedDiagnostics && (
                  <div className="mt-3 max-h-[250px] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 shadow-inner custom-scrollbar break-all">
                    <div className="mb-1 font-semibold text-blue-300">Request URL</div>
                    <div className="mb-3 border-l-2 border-zinc-700 pl-2">{error.requestInfo.url}</div>

                    <div className="mb-1 font-semibold text-blue-300">Method</div>
                    <div className="mb-3 border-l-2 border-zinc-700 pl-2">{error.requestInfo.method}</div>

                    <div className="mb-1 font-semibold text-blue-300">Proxy Used</div>
                    <div className="mb-3 border-l-2 border-zinc-700 pl-2">{error.requestInfo.proxyUsed ? 'Yes' : 'No'}</div>

                    <div className="mb-1 font-semibold text-blue-300">Raw Message</div>
                    <div className="mb-3 border-l-2 border-zinc-700 pl-2">{error.message}</div>

                    {error.details && (
                      <>
                        <div className="mb-1 font-semibold text-violet-300">Diagnostics / Stack</div>
                        <div className="border-l-2 border-zinc-700 pl-2 text-[10px] opacity-85 whitespace-pre-wrap">{error.details}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}


