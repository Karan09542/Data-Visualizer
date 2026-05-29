import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Server, RefreshCw, XCircle, AlertCircle, PlayCircle, Loader2, Edit3 } from 'lucide-react';

interface ApiNodeRendererProps {
  url: string;
  path: string;
  nodeId: string;
  nodeX: number;
  nodeY: number;
  nodeWidth: number;
}

import { createPortal } from 'react-dom';

export function ApiNodeRenderer({ url, path, nodeId, nodeX, nodeY, nodeWidth }: ApiNodeRendererProps) {
  const { 
    apiNodeResponses, 
    apiNodeLoading, 
    apiNodeErrors, 
    setApiNodeResponse, 
    setApiNodeLoading, 
    setApiNodeError,
    removeApiNode,
    inlineApiEditor,
    setInlineApiEditor,
    appTheme,
    apiNodeConfig
  } = useStore();

  const [useProxy, setUseProxy] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);

  // Use the reactive global url if we're currently editing this node
  const isEditing = inlineApiEditor?.path === path;
  const currentUrl = isEditing ? inlineApiEditor.url : url;
  
  const config = apiNodeConfig[path] || { method: 'GET', responseType: 'auto', timeout: 5000 };

  const isLoading = apiNodeLoading[path];
  const error = apiNodeErrors[path];
  const hasData = apiNodeResponses[path] !== undefined;

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
        // Likely CORS error, silently retry with proxy
        handleFetch(true);
        return;
      } else {
        let type = 'Network Error';
        let userMessage = 'Unable to connect to the endpoint.\n\nPossible causes:\n• Server unavailable\n• Network issue\n• CORS restriction';
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

  return (
    <div className="flex flex-col w-full gap-2 mt-2 pointer-events-auto">
      <div className="flex flex-col border border-current/20 rounded-md p-2 relative group shadow-inner" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
            <Server size={12} className={isLoading ? "animate-pulse" : ""} />
            <span className="text-[10px] uppercase font-bold tracking-widest">API Endpoint</span>
          </div>
          <div className="flex items-center gap-2">
            {useProxy && (
               <span className="text-[8px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                 Proxy Active
               </span>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setInlineApiEditor({ url: currentUrl, path, nodeId, x: nodeX, y: nodeY, width: nodeWidth });
              }}
              className="p-1 rounded-sm hover:bg-black/10 text-slate-500 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit API URL"
            >
              <Edit3 size={12} />
            </button>
          </div>
        </div>
        
        <div className="font-mono text-[10px] truncate w-full mb-2 opacity-80" title={currentUrl}>
           {currentUrl}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!hasData && !isLoading && !error && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleFetch(false); }}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors border border-blue-600"
            >
              <PlayCircle size={12} /> Fetch Data
            </button>
          )}

          {isLoading && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              🟡 Fetching...
            </div>
          )}

          {hasData && !isLoading && !error && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              🟢 Connected
            </div>
          )}

          {hasData && !isLoading && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-black/10 hover:bg-black/20 text-current transition-colors border border-current/20"
                title="Refresh"
              >
                <RefreshCw size={10} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); clearData(); }}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors border border-red-500/20"
                title="Clear fetched data"
              >
                <XCircle size={10} />
              </button>
            </>
          )}

          {error && !isLoading && (
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowErrorPopup(!showErrorPopup); setShowAdvancedDiagnostics(false); }}
                className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20"
              >
                🔴 Failed
              </button>

              {showErrorPopup && createPortal(
                <div 
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }}
                >
                  <div 
                    className="w-[400px] max-w-[90vw] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-5 flex flex-col gap-4 font-sans text-slate-200 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                      <h3 className="text-base font-bold flex items-center gap-2">
                         <AlertCircle size={18} className="text-red-500" />
                         API Fetch Error
                      </h3>
                      <button onClick={(e) => { e.stopPropagation(); setShowErrorPopup(false); }} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
                        <XCircle size={18} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 min-w-[70px]">Type:</span>
                        <span className="font-semibold text-red-400">{error.type}</span>
                      </div>
                      {error.code && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 min-w-[70px]">Code:</span>
                          <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-xs">{error.code}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 text-sm whitespace-pre-wrap leading-relaxed mix-blend-plus-lighter shadow-inner">
                      {error.userMessage}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-3 border-t border-slate-700/50 mt-1">
                      <button 
                        onClick={() => { handleFetch(error.requestInfo.proxyUsed); setShowErrorPopup(false); }}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-semibold transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20"
                      >
                        <RefreshCw size={14} /> Retry
                      </button>
                      {!error.requestInfo.proxyUsed && (
                        <button 
                          onClick={() => { handleFetch(true); setShowErrorPopup(false); }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors shadow-lg"
                        >
                          Retry w/ Proxy
                        </button>
                      )}
                    </div>

                    {/* Advanced Diagnostics */}
                    <div className="mt-2">
                      <button 
                        onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
                        className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        {showAdvancedDiagnostics ? '▼' : '▶'} Technical Details
                      </button>
                      {showAdvancedDiagnostics && (
                        <div className="mt-3 text-xs font-mono bg-black/60 p-3 rounded-lg border border-slate-800 text-slate-300 max-h-[250px] overflow-y-auto cursor-text select-text custom-scrollbar break-all shadow-inner">
                          <div className="text-blue-400 mb-1 font-semibold">Request URL:</div>
                          <div className="mb-3 pl-2 border-l-2 border-slate-700/50">{error.requestInfo.url}</div>
                          
                          <div className="text-blue-400 mb-1 font-semibold">Method:</div>
                          <div className="mb-3 pl-2 border-l-2 border-slate-700/50">{error.requestInfo.method}</div>
                          
                          <div className="text-blue-400 mb-1 font-semibold">Proxy Used:</div>
                          <div className="mb-3 pl-2 border-l-2 border-slate-700/50">{error.requestInfo.proxyUsed ? 'Yes' : 'No'}</div>
                          
                          <div className="text-blue-400 mb-1 font-semibold">Raw Message:</div>
                          <div className="mb-3 pl-2 border-l-2 border-slate-700/50">{error.message}</div>
                          
                          {error.details && (
                            <>
                              <div className="text-purple-400 mb-1 font-semibold">Diagnostics / Stack:</div>
                              <div className="whitespace-pre-wrap text-[10px] pl-2 border-l-2 border-slate-700/50 opacity-80">{error.details}</div>
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
          )}
        </div>
      </div>
    </div>
  );
}
