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
        throw new Error(`HTTP error! status: ${res.status}`);
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
        } catch (e) {
          data = { _rawText: text };
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
      if (e.name === 'AbortError') {
        setApiNodeError(path, 'Request timed out');
      } else if (!forceProxy && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
        // Likely CORS error, silently retry with proxy
        handleFetch(true);
        return;
      } else {
        setApiNodeError(path, e.message || 'Fetch failed');
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
      <div className="flex flex-col border border-current/20 rounded-md p-2 relative overflow-hidden group shadow-inner" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
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
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 dark:text-blue-400">
              <Loader2 size={12} className="animate-spin" /> Fetching...
            </div>
          )}

          {hasData && !isLoading && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-black/10 hover:bg-black/20 text-current transition-colors border border-current/20"
                title="Refresh"
              >
                <RefreshCw size={10} /> Refresh
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); clearData(); }}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors border border-red-500/20"
                title="Clear fetched data"
              >
                <XCircle size={10} /> Clear
              </button>
            </>
          )}

          {error && !isLoading && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500">
              <AlertCircle size={12} /> <span className="truncate max-w-[100px]" title={error}>{error}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleFetch(useProxy); }}
                className="ml-1 underline hover:text-red-400"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
