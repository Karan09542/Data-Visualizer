import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { resolveApiResponseView } from '../utils/transformer';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileJson,
  Globe,
  ListTree,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
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

const formatTimeout = (timeout: number) => {
  if (!Number.isFinite(timeout) || timeout <= 0) return '5s';
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
  const setApiNodeConfig = useStore((state) => state.setApiNodeConfig);

  const [useProxy, setUseProxy] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const endpointHost = getEndpointHost(currentUrl);
  const responseLabel = formatResponseType(config.responseType);
  const timeoutLabel = formatTimeout(config.timeout);

  const statusMeta: StatusMeta = isLoading
    ? { label: 'Fetching…', title: 'Request in progress', dotClass: 'bg-amber-500 animate-pulse', textClass: 'text-amber-600 dark:text-amber-400' }
    : error
      ? { label: 'Failed', title: 'Show error details', dotClass: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400' }
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">API request</div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${getMethodClass(config.method)}`}>
                  {config.method}
                </span>
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={endpointHost}>
                  {endpointHost}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={openEditor}
            className={`${iconButtonClass} ${isEditing ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''}`}
            title="Edit request"
            aria-label="Edit request"
          >
            <Pencil size={14} />
          </button>
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
            <span className="truncate text-slate-400 dark:text-slate-500">
              {responseLabel} · {timeoutLabel}
            </span>
            {useProxy && (
              <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-px text-[10px] font-medium text-orange-600 dark:text-orange-400" title="Fetched through the proxy">
                Proxy
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
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
