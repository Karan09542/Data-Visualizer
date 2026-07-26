import React, { useState } from 'react';
import { useStore, ProxyServer } from '../store/useStore';
import { X, Plus, Trash2, Check, ArrowUp, ArrowDown, Shield } from 'lucide-react';
import { createPortal } from 'react-dom';

export function ProxySettingsModal() {
  const { 
    isProxyModalOpen, 
    setIsProxyModalOpen, 
    proxyServers, 
    setProxyServers,
    useDefaultProxy,
    setUseDefaultProxy
  } = useStore();
  const [newUrl, setNewUrl] = useState("");
  
  if (!isProxyModalOpen) return null;

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const newProxy: ProxyServer = {
      id: Date.now().toString(),
      url: newUrl.trim(),
      isEnabled: true
    };
    setProxyServers([...proxyServers, newProxy]);
    setNewUrl("");
  };

  const handleToggle = (index: number, e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    const newServers = [...proxyServers];
    
    if (isShift) {
      // Enable all proxies from top (0) to this index
      for (let i = 0; i <= index; i++) {
        newServers[i].isEnabled = true;
      }
    } else {
      // Toggle just this one
      newServers[index].isEnabled = !newServers[index].isEnabled;
    }
    
    setProxyServers(newServers);
  };

  const handleRemove = (id: string) => {
    setProxyServers(proxyServers.filter(p => p.id !== id));
  };

  const moveProxy = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newServers = [...proxyServers];
      const temp = newServers[index - 1];
      newServers[index - 1] = newServers[index];
      newServers[index] = temp;
      setProxyServers(newServers);
    } else if (direction === 'down' && index < proxyServers.length - 1) {
      const newServers = [...proxyServers];
      const temp = newServers[index + 1];
      newServers[index + 1] = newServers[index];
      newServers[index] = temp;
      setProxyServers(newServers);
    }
  };

  const toggleAll = (enable: boolean) => {
    setProxyServers(proxyServers.map(p => ({ ...p, isEnabled: enable })));
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 sm:p-4">
      <div className="bg-white dark:bg-[#0d1117] sm:border border-slate-200 dark:border-slate-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-w-lg flex flex-col overflow-hidden sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22]">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-500" size={18} />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Proxy Servers</h2>
          </div>
          <button 
            onClick={() => setIsProxyModalOpen(false)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Configure fallback proxy servers for cross-origin (CORS) fetch requests in JS and Python nodes. 
            If a fetch fails, the nodes will automatically try each enabled proxy sequentially from top to bottom.
            You can create your own free proxy server easily using a Cloudflare Worker and add it here.
            <br/><br/>
            <strong>Tip:</strong> Hold <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700">Shift</kbd> and click a checkbox to enable it and all proxies above it.
          </p>

          <div className="flex items-center gap-3 p-3 mb-6 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/10">
            <button 
              onClick={() => setUseDefaultProxy(!useDefaultProxy)}
              className={`shrink-0 w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                useDefaultProxy 
                  ? "bg-blue-600 border-blue-600 text-white" 
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0d1117] text-transparent hover:border-blue-500"
              }`}
            >
              <Check size={14} />
            </button>
            <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
              <span className="font-semibold">Use Default Proxy Server</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically use the built-in Data-Visualizer Cloudflare proxy if all other proxies fail. Disable this if you want strict privacy and only wish to route traffic through your own custom servers.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="e.g. https://go.data-visualizer.workers.dev/?url=" 
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Fallback Sequence</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleAll(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Enable All
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button 
                onClick={() => toggleAll(false)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Disable All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {proxyServers.length === 0 ? (
              <div className="text-center p-6 text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                No proxy servers configured. Add one above.
              </div>
            ) : (
              proxyServers.map((proxy, index) => (
                <div 
                  key={proxy.id} 
                  className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-colors ${
                    proxy.isEnabled 
                      ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/10" 
                      : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#161b22]"
                  }`}
                >
                  <button 
                    onClick={(e) => handleToggle(index, e)}
                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                      proxy.isEnabled 
                        ? "bg-blue-600 border-blue-600 text-white" 
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0d1117] text-transparent hover:border-blue-500"
                    }`}
                  >
                    <Check size={14} />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${proxy.isEnabled ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-500 line-through opacity-70"}`}>
                      {proxy.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => moveProxy(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => moveProxy(index, 'down')}
                      disabled={index === proxyServers.length - 1}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                    <button 
                      onClick={() => handleRemove(proxy.id)}
                      className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex justify-end">
          <button 
            onClick={() => setIsProxyModalOpen(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
