import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAIStore } from '../../store/useAIStore';
import { useStore } from '../../store/useStore';
import { providerRegistry } from '../../ai/services/ProviderRegistry';
import { providerDiscovery } from '../../ai/services/ProviderDiscovery';
import { AIModel } from '../../ai/providers/IAIProvider';
import { 
  siNvidia, 
  siGoogle, 
  siAnthropic, 
  siOllama,
  siMeta,
  siDeepseek
} from 'simple-icons';
import { 
  Bot, ChevronDown, Check, Search, Cloud, Laptop, 
  Zap, Brain, Eye, Cpu, ShieldCheck, Sparkles
} from 'lucide-react';

const SimpleIcon = ({ icon, color, size = 16 }: { icon: any, color?: string, size?: number }) => (
  <svg 
    role="img" 
    viewBox="0 0 24 24" 
    fill={color || `#${icon.hex}`} 
    width={size} 
    height={size} 
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{icon.title}</title>
    <path d={icon.path} />
  </svg>
);

export const getProviderIcon = (providerId: string, isDark: boolean = true) => {
  switch (providerId) {
    case 'nvidia': return <SimpleIcon icon={siNvidia} color="#76B900" size={16} />;
    case 'openai': return <Bot size={16} className={isDark ? "text-emerald-400" : "text-emerald-600"} />;
    case 'gemini': return <SimpleIcon icon={siGoogle} color="#4285F4" size={16} />;
    case 'anthropic': return <SimpleIcon icon={siAnthropic} color="#D97757" size={16} />;
    case 'ollama': return <SimpleIcon icon={siOllama} color={isDark ? "#FFFFFF" : "#1E293B"} size={16} />;
    default: return <Bot size={16} className={isDark ? "text-slate-400" : "text-slate-500"} />;
  }
};

export const getModelIcon = (modelId: string, providerId: string, isDark: boolean = true) => {
  const lower = (modelId || '').toLowerCase();
  if (lower.includes('gpt') || lower.includes('openai')) {
    return <Bot size={16} className={isDark ? "text-emerald-400" : "text-emerald-600"} />;
  }
  if (lower.includes('llama') || lower.includes('meta')) {
    return <SimpleIcon icon={siMeta} color="#0467DF" size={16} />;
  }
  if (lower.includes('deepseek')) {
    return <SimpleIcon icon={siDeepseek} color="#4D6BFE" size={16} />;
  }
  if (lower.includes('nemotron') || lower.includes('nvidia')) {
    return <SimpleIcon icon={siNvidia} color="#76B900" size={16} />;
  }
  if (lower.includes('gemma') || lower.includes('gemini') || lower.includes('google')) {
    return <SimpleIcon icon={siGoogle} color="#4285F4" size={16} />;
  }
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return <SimpleIcon icon={siAnthropic} color="#D97757" size={16} />;
  }
  return getProviderIcon(providerId, isDark);
};

export const AIModelSelector: React.FC = () => {
  const activeProviderId = useAIStore((state) => state.activeProviderId);
  const activeModelId = useAIStore((state) => state.activeModelId);
  const setActiveProvider = useAIStore((state) => state.setActiveProvider);
  const setActiveModel = useAIStore((state) => state.setActiveModel);
  const apiKeys = useAIStore((state) => state.apiKeys);
  const appTheme = useStore(state => state.appTheme);
  const isDark = appTheme === 'dark';

  const [models, setModels] = useState<AIModel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [providersReady, setProvidersReady] = useState(false);

  const providerBtnRef = useRef<HTMLButtonElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const [providerRect, setProviderRect] = useState<DOMRect | null>(null);
  const [modelRect, setModelRect] = useState<DOMRect | null>(null);

  // Discover and register providers on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await providerDiscovery.discoverAndRegister();
      if (!cancelled) setProvidersReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const providers = providerRegistry.getAllProviders();
  const activeProvider = providerRegistry.getProvider(activeProviderId);

  useEffect(() => {
    if (!providersReady) return;
    let active = true;
    const fetchModels = async () => {
      const provider = providerRegistry.getProvider(activeProviderId);
      if (provider) {
        try {
          const fetchedModels = await provider.listModels();
          if (active) setModels(fetchedModels);
        } catch {
          if (active) setModels([]);
        }
      }
    };
    fetchModels();
    return () => { active = false; };
  }, [activeProviderId, providersReady]);

  const filteredModels = useMemo(() => {
    if (!searchQuery) return models;
    return models.filter(m => 
      m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [models, searchQuery]);

  const activeModel = models.find(m => m.id === activeModelId) || models[0];

  useEffect(() => {
    if (models.length > 0 && !models.find(m => m.id === activeModelId)) {
      setActiveModel(models[0].id);
    }
  }, [models, activeModelId, setActiveModel]);

  const hasApiKey = !!apiKeys[activeProviderId];
  const isLocal = activeProvider && !activeProvider.isCloud;
  const isConnected = isLocal || hasApiKey;

  const toggleProviderDropdown = () => {
    if (isProviderDropdownOpen) {
      setIsProviderDropdownOpen(false);
    } else {
      if (providerBtnRef.current) {
        setProviderRect(providerBtnRef.current.getBoundingClientRect());
      }
      setIsProviderDropdownOpen(true);
      setIsModelDropdownOpen(false);
    }
  };

  const toggleModelDropdown = () => {
    if (isModelDropdownOpen) {
      setIsModelDropdownOpen(false);
    } else {
      if (modelBtnRef.current) {
        setModelRect(modelBtnRef.current.getBoundingClientRect());
      }
      setIsModelDropdownOpen(true);
      setIsProviderDropdownOpen(false);
    }
  };

  // Close dropdowns on scroll or window resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isProviderDropdownOpen && providerBtnRef.current) {
        setProviderRect(providerBtnRef.current.getBoundingClientRect());
      }
      if (isModelDropdownOpen && modelBtnRef.current) {
        setModelRect(modelBtnRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isProviderDropdownOpen, isModelDropdownOpen]);

  return (
    <div className="space-y-4">
      
      {/* Provider Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
            <Cpu size={13} /> AI Provider
          </label>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-none flex items-center gap-1.5 border ${
            isConnected 
              ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200') 
              : (isDark ? 'bg-neutral-800 text-white border-neutral-700' : 'bg-neutral-100 text-black border-neutral-200')
          }`}>
            <span className={`w-1.5 h-1.5 rounded-none ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-black dark:bg-white'}`} />
            {isLocal ? 'Local Device' : (isConnected ? 'Connected' : 'API Key Required')}
          </span>
        </div>

        <button 
          ref={providerBtnRef}
          className={`w-full flex items-center justify-between p-3 rounded-none transition-all border text-left ${
            isDark 
              ? 'bg-[#0a0a0a] border-neutral-800 hover:border-white text-white' 
              : 'bg-white border-neutral-200 hover:border-black text-black'
          }`}
          onClick={toggleProviderDropdown}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-none flex items-center justify-center ${isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-50 border border-neutral-200'}`}>
              {getProviderIcon(activeProviderId, isDark)}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide">
                {activeProvider?.name || 'Select Provider'}
              </span>
              <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                {isLocal ? <Laptop size={11} /> : <Cloud size={11} />}
                {activeProvider?.description || 'Select an AI engine'}
              </span>
            </div>
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isDark ? 'text-neutral-500' : 'text-neutral-500'} ${isProviderDropdownOpen ? 'rotate-180 text-black dark:text-white' : ''}`} />
        </button>

        {/* Provider Portal Dropdown */}
        {isProviderDropdownOpen && providerRect && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setIsProviderDropdownOpen(false)} />
            <div 
              className={`fixed z-[99999] rounded-none shadow-2xl overflow-hidden backdrop-blur-xl border animate-in fade-in duration-100 ${
                isDark 
                  ? 'bg-[#0a0a0a] border-neutral-800 text-white' 
                  : 'bg-white border-neutral-200 text-black'
              }`}
              style={{
                top: providerRect.bottom + 6,
                left: providerRect.left,
                width: providerRect.width,
                maxHeight: 320,
              }}
            >
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProvider(p.id);
                    setIsProviderDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 transition-colors border-b last:border-0 text-left ${
                    isDark ? 'border-neutral-800 hover:bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'
                  } ${p.id === activeProviderId ? (isDark ? 'bg-white text-black font-semibold' : 'bg-black text-white font-semibold') : ''}`}
                >
                  <div className={`p-2 rounded-none flex items-center justify-center ${isDark ? (p.id === activeProviderId ? 'bg-neutral-200' : 'bg-neutral-900') : (p.id === activeProviderId ? 'bg-neutral-800' : 'bg-neutral-100')}`}>
                    {getProviderIcon(p.id, p.id === activeProviderId ? !isDark : isDark)}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span className={`text-[11px] ${isDark ? (p.id === activeProviderId ? 'text-neutral-700' : 'text-neutral-500') : (p.id === activeProviderId ? 'text-neutral-300' : 'text-neutral-500')}`}>{p.isCloud ? 'Cloud API' : 'On-Device Engine'}</span>
                  </div>
                  {p.id === activeProviderId && <Check size={16} className={isDark ? "text-black" : "text-white"} />}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      </div>

      {/* Model Selector */}
      <div className="space-y-1.5">
        <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
          <Sparkles size={13} /> AI Model
        </label>
        
        <button 
          ref={modelBtnRef}
          className={`w-full flex items-center justify-between p-3 rounded-none transition-all border text-left ${
            isDark 
              ? 'bg-[#0a0a0a] border-neutral-800 hover:border-white text-white' 
              : 'bg-white border-neutral-200 hover:border-black text-black'
          }`}
          onClick={toggleModelDropdown}
        >
          <div className="flex items-center gap-3 truncate max-w-[85%]">
            <div className={`p-2 rounded-none shrink-0 flex items-center justify-center ${isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-50 border border-neutral-200'}`}>
              {getModelIcon(activeModel?.id || '', activeProviderId, isDark)}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm truncate">
                {activeModel?.displayName || (models.length === 0 ? 'No models available' : 'Loading models...')}
              </span>
              {activeModel ? (
                <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  <span className={`font-mono px-1.5 py-0.5 rounded-none font-bold border ${isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-neutral-100 border-neutral-300 text-black'}`}>
                    {Math.round(activeModel.contextLength / 1000)}K Context
                  </span>
                  {activeModel.capabilities.reasoning && <span className="flex items-center gap-1 font-semibold"><Brain size={11} /> Reasoning</span>}
                </div>
              ) : (
                <div className={`text-[10px] mt-0.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  {models.length === 0 ? 'No model weights loaded' : 'Select model'}
                </div>
              )}
            </div>
          </div>
          <ChevronDown size={16} className={`shrink-0 ml-2 transition-transform duration-200 ${isDark ? 'text-neutral-500' : 'text-neutral-500'} ${isModelDropdownOpen ? 'rotate-180 text-black dark:text-white' : ''}`} />
        </button>

        {/* Model Portal Dropdown */}
        {isModelDropdownOpen && modelRect && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setIsModelDropdownOpen(false)} />
            <div 
              className={`fixed z-[99999] rounded-none shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border animate-in fade-in duration-100 ${
                isDark 
                  ? 'bg-[#0a0a0a] border-neutral-800 text-white' 
                  : 'bg-white border-neutral-200 text-black'
              }`}
              style={{
                top: modelRect.bottom + 6,
                left: modelRect.left,
                width: modelRect.width,
                maxHeight: 340,
              }}
            >
              <div className={`p-2.5 border-b relative ${isDark ? 'bg-[#0a0a0a] border-neutral-800' : 'bg-white border-neutral-200'}`}>
                <Search size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`} />
                <input 
                  type="text" 
                  placeholder="Search models by name or capability..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-none outline-none transition-colors ${
                    isDark 
                      ? 'bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:border-white' 
                      : 'bg-neutral-50 border border-neutral-200 text-black placeholder-neutral-400 focus:border-black'
                  }`}
                />
              </div>
              <div className="overflow-y-auto custom-scrollbar">
                {filteredModels.length === 0 ? (
                  <div className={`p-4 text-center text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    {models.length === 0 ? 'No model weights loaded' : 'No matching models found'}
                  </div>
                ) : (
                  filteredModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 p-3 transition-colors border-b last:border-0 text-left ${
                        isDark ? 'border-neutral-800 hover:bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'
                      } ${m.id === activeModelId ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : ''}`}
                    >
                      <div className={`p-1.5 rounded-none shrink-0 mt-0.5 ${isDark ? (m.id === activeModelId ? 'bg-neutral-200' : 'bg-neutral-900') : (m.id === activeModelId ? 'bg-neutral-800' : 'bg-neutral-100')}`}>
                        {getModelIcon(m.id, activeProviderId, m.id === activeModelId ? !isDark : isDark)}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs truncate">{m.displayName}</span>
                          {m.id === activeModelId && <Check size={14} className="shrink-0 ml-2" />}
                        </div>
                        <span className={`text-[11px] line-clamp-1 mt-0.5 ${isDark ? (m.id === activeModelId ? 'text-neutral-700' : 'text-neutral-500') : (m.id === activeModelId ? 'text-neutral-300' : 'text-neutral-500')}`}>{m.description}</span>
                        
                        {/* Capability Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-semibold">
                          <span className={`px-1.5 py-0.5 rounded-none font-mono ${isDark ? (m.id === activeModelId ? 'bg-neutral-300 text-black' : 'bg-neutral-900 border border-neutral-800 text-white') : (m.id === activeModelId ? 'bg-neutral-800 text-white' : 'bg-neutral-100 border border-neutral-200 text-black')}`}>
                            {Math.round(m.contextLength / 1000)}K Ctx
                          </span>
                          {m.capabilities.reasoning && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-none border ${isDark ? (m.id === activeModelId ? 'border-black text-black' : 'border-neutral-700 text-white') : (m.id === activeModelId ? 'border-white text-white' : 'border-neutral-300 text-black')}`}>
                              <Brain size={10} /> Reasoning
                            </span>
                          )}
                          {m.capabilities.streaming && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-none border ${isDark ? (m.id === activeModelId ? 'border-black text-black' : 'border-neutral-700 text-white') : (m.id === activeModelId ? 'border-white text-white' : 'border-neutral-300 text-black')}`}>
                              <Zap size={10} /> Streaming
                            </span>
                          )}
                          {m.capabilities.vision && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-none border ${isDark ? (m.id === activeModelId ? 'border-black text-black' : 'border-neutral-700 text-white') : (m.id === activeModelId ? 'border-white text-white' : 'border-neutral-300 text-black')}`}>
                              <Eye size={10} /> Vision
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* Model Capabilities Summary Grid */}
      {activeModel && (
        <div className={`p-3.5 rounded-none border flex flex-col gap-2.5 ${
          isDark ? 'bg-[#0a0a0a] border-neutral-800' : 'bg-white border-neutral-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
            <div className="flex items-center gap-2">
              {getModelIcon(activeModel.id, activeProviderId, isDark)}
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>Model Capabilities</span>
            </div>
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-none border ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-neutral-100 border-neutral-200 text-black'
            }`} title={activeModel.id}>
              {activeModel.id}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs">
              {activeModel.capabilities.reasoning ? <ShieldCheck size={14} className="text-current" /> : <span className={`w-3 h-px ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />}
              <span className={activeModel.capabilities.reasoning ? (isDark ? 'text-white font-semibold' : 'text-black font-semibold') : (isDark ? 'text-neutral-500' : 'text-neutral-500')}>Reasoning Mode</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {activeModel.capabilities.jsonMode ? <ShieldCheck size={14} className="text-current" /> : <span className={`w-3 h-px ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />}
              <span className={activeModel.capabilities.jsonMode ? (isDark ? 'text-white font-semibold' : 'text-black font-semibold') : (isDark ? 'text-neutral-500' : 'text-neutral-500')}>JSON Mode</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {activeModel.capabilities.vision ? <ShieldCheck size={14} className="text-current" /> : <span className={`w-3 h-px ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />}
              <span className={activeModel.capabilities.vision ? (isDark ? 'text-white font-semibold' : 'text-black font-semibold') : (isDark ? 'text-neutral-500' : 'text-neutral-500')}>Vision Support</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {activeModel.capabilities.functionCalling ? <ShieldCheck size={14} className="text-current" /> : <span className={`w-3 h-px ${isDark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />}
              <span className={activeModel.capabilities.functionCalling ? (isDark ? 'text-white font-semibold' : 'text-black font-semibold') : (isDark ? 'text-neutral-500' : 'text-neutral-500')}>Tools & Actions</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
