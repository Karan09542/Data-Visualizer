import React, { useState } from 'react';
import { useStore, ProxyServer } from '../store/useStore';
import { X, Plus, Trash2, Check, ArrowUp, ArrowDown, Shield } from 'lucide-react';
import { createPortal } from 'react-dom';

const checkbox = (checked: boolean) =>
  `shrink-0 w-[16px] h-[16px] flex items-center justify-center rounded-[3px] border transition-colors cursor-pointer ${
    checked
      ? "bg-[var(--vsc-accent,#005fb8)] border-[var(--vsc-accent,#005fb8)] text-white"
      : "border-[var(--vsc-border-strong,#cecece)] bg-[var(--vsc-input,#ffffff)] text-transparent hover:border-[var(--vsc-accent,#005fb8)]"
  }`;

const iconBtn =
  "p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed";

export function ProxySettingsModal() {
  const isProxyModalOpen = useStore((state) => state.isProxyModalOpen);
  const setIsProxyModalOpen = useStore((state) => state.setIsProxyModalOpen);
  const proxyServers = useStore((state) => state.proxyServers);
  const setProxyServers = useStore((state) => state.setProxyServers);
  const useDefaultProxy = useStore((state) => state.useDefaultProxy);
  const setUseDefaultProxy = useStore((state) => state.setUseDefaultProxy);
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
      <div className="bg-[var(--vsc-widget,#ffffff)] text-[var(--vsc-fg,#3b3b3b)] sm:border border-[var(--vsc-border-strong,#cecece)] sm:rounded-[6px] shadow-[0_8px_28px_var(--vsc-widget-shadow,rgba(0,0,0,0.16))] w-full h-full sm:h-auto sm:max-w-lg flex flex-col overflow-hidden sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 h-[38px] shrink-0 border-b border-[var(--vsc-border,#e5e5e5)] bg-[var(--vsc-panel,#f8f8f8)]">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="text-[var(--vsc-accent,#005fb8)] shrink-0" size={15} />
            <h2 className="text-[13px] font-semibold truncate">Proxy Servers</h2>
          </div>
          <button
            onClick={() => setIsProxyModalOpen(false)}
            className={iconBtn}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex-1 overflow-y-auto custom-scrollbar">
          <p className="text-[12px] text-[var(--vsc-fg-muted,#616161)] mb-3 leading-relaxed">
            Configure fallback proxy servers for cross-origin (CORS) fetch requests in JS and Python nodes.
            If a fetch fails, the nodes will automatically try each enabled proxy sequentially from top to bottom.
            You can create your own free proxy server easily using a Cloudflare Worker and add it here.
          </p>
          <p className="text-[12px] text-[var(--vsc-fg-muted,#616161)] mb-4">
            <strong className="font-medium text-[var(--vsc-fg,#3b3b3b)]">Tip:</strong> Hold{" "}
            <kbd className="bg-[var(--vsc-input,#ffffff)] text-[var(--vsc-fg,#3b3b3b)] px-1 rounded-[3px] border border-[var(--vsc-border-strong,#cecece)] text-[11px]">Shift</kbd>{" "}
            and click a checkbox to enable it and all proxies above it.
          </p>

          {/* Default proxy: a settings row, not a tinted card */}
          <label className="flex items-start gap-2.5 px-1 py-1.5 mb-5 rounded-[3px] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors cursor-pointer">
            <button
              onClick={() => setUseDefaultProxy(!useDefaultProxy)}
              className={`${checkbox(useDefaultProxy)} mt-px`}
              type="button"
            >
              <Check size={12} strokeWidth={3} />
            </button>
            <span className="min-w-0">
              <span className="block text-[13px] leading-tight">Use Default Proxy Server</span>
              <span className="block text-[12px] text-[var(--vsc-fg-muted,#616161)] leading-snug mt-1">
                Automatically use the built-in Data-Visualizer Cloudflare proxy if all other proxies fail. Disable this if you want strict privacy and only wish to route traffic through your own custom servers.
              </span>
            </span>
          </label>

          <div className="flex gap-2 mb-5">
            <input
              type="text"
              placeholder="e.g. https://go.data-visualizer.workers.dev/?url="
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 min-w-0 bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] rounded-[3px] px-2.5 py-1.5 text-[13px] text-[var(--vsc-fg,#3b3b3b)] placeholder-[var(--vsc-fg-muted,#616161)] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent,#005fb8)] focus:border-[var(--vsc-accent,#005fb8)] transition"
            />
            <button
              onClick={handleAdd}
              disabled={!newUrl.trim()}
              className="bg-[var(--vsc-accent,#005fb8)] text-[var(--vsc-accent-fg,#ffffff)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-[3px] flex items-center gap-1 text-[13px] font-medium transition shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-[11px] font-semibold text-[var(--vsc-fg-muted,#616161)] uppercase tracking-wide">Fallback Sequence</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="text-[11px] text-[var(--vsc-accent,#005fb8)] hover:underline cursor-pointer"
              >
                Enable All
              </button>
              <span className="text-[var(--vsc-border-strong,#cecece)]">|</span>
              <button
                onClick={() => toggleAll(false)}
                className="text-[11px] text-[var(--vsc-fg-muted,#616161)] hover:underline cursor-pointer"
              >
                Disable All
              </button>
            </div>
          </div>

          {proxyServers.length === 0 ? (
            <div className="text-center py-6 px-4 text-[12px] text-[var(--vsc-fg-muted,#616161)] border border-dashed border-[var(--vsc-border,#e5e5e5)] rounded-[4px]">
              No proxy servers configured. Add one above.
            </div>
          ) : (
            <div className="border border-[var(--vsc-border,#e5e5e5)] rounded-[4px] overflow-hidden divide-y divide-[var(--vsc-border,#e5e5e5)]">
              {proxyServers.map((proxy, index) => (
                <div
                  key={proxy.id}
                  className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors group"
                >
                  <button
                    onClick={(e) => handleToggle(index, e)}
                    className={checkbox(proxy.isEnabled)}
                    title={proxy.isEnabled ? "Disable this proxy" : "Enable this proxy (hold Shift to enable all above)"}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] truncate font-mono ${proxy.isEnabled ? "text-[var(--vsc-fg,#3b3b3b)]" : "text-[var(--vsc-fg-muted,#616161)] line-through"}`} title={proxy.url}>
                      {proxy.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => moveProxy(index, 'up')}
                      disabled={index === 0}
                      className={iconBtn}
                      title="Move up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveProxy(index, 'down')}
                      disabled={index === proxyServers.length - 1}
                      className={iconBtn}
                      title="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <div className="w-px h-4 bg-[var(--vsc-border,#e5e5e5)] mx-1"></div>
                    <button
                      onClick={() => handleRemove(proxy.id)}
                      className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove proxy"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 shrink-0 border-t border-[var(--vsc-border,#e5e5e5)] bg-[var(--vsc-panel,#f8f8f8)] flex justify-end">
          <button
            onClick={() => setIsProxyModalOpen(false)}
            className="px-4 py-1.5 bg-[var(--vsc-accent,#005fb8)] text-[var(--vsc-accent-fg,#ffffff)] hover:opacity-90 rounded-[3px] text-[13px] font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
