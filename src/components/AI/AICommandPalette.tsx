import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { aiProviderManager } from '../../ai/services/AIProviderManager';
import { providerRegistry } from '../../ai/services/ProviderRegistry';
import { providerDiscovery } from '../../ai/services/ProviderDiscovery';
import { useAIStore } from '../../store/useAIStore';
import { useStore } from '../../store/useStore';
import { aiEventBus } from '../../ai/events/AIEventBus';
import { responseParser } from '../../ai/parsers/ResponseParser';
import { getProviderIcon, getModelIcon } from './AIModelSelector';
import { AIParameters } from './AISettingsPanel';
import { applyPatchSmart } from '../../utils/patchUtils';
import { AIModel } from '../../ai/providers/IAIProvider';
import { CommandPalettePromptV1 } from '../../ai/prompts/CommandPalettePrompt.v1';
import {
  Sparkles,
  SlidersHorizontal,
  X,
  Search,
  Copy,
  Check,
  Code,
  Wand2,
  Brain,
  Layers,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  Key,
  Square,
  FileJson,
  Calendar,
  Globe,
  FileCode,
  Zap,
  Eye,
  EyeOff,
  GitMerge,
  RefreshCw,
} from 'lucide-react';

interface AICommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyContext?: (patch: any, mode: 'merge' | 'replace') => void;
  contextData?: any; // The selected JSON/Document context
}

const QUICK_COMMANDS = [
  {
    id: 'generate_json',
    label: 'Generate JSON',
    icon: <FileJson size={13} className="text-amber-400" />,
    prompt: 'Generate a clean JSON dataset containing 5 realistic sample user profiles with name, email, role, and status.',
  },
  {
    id: 'explain',
    label: 'Explain Structure',
    icon: <Brain size={13} className="text-purple-400" />,
    prompt: 'Explain the structural design, data types, and key relationships of this JSON document.',
  },
  {
    id: 'fix_json',
    label: 'Fix & Validate',
    icon: <Wand2 size={13} className="text-amber-400" />,
    prompt: 'Fix syntax errors, normalize missing keys, and return valid JSON with proper indentation.',
  },
  {
    id: 'normalize_dates',
    label: 'ISO Dates',
    icon: <Calendar size={13} className="text-sky-400" />,
    prompt: 'Convert all timestamp and date fields into standard ISO 8601 strings (YYYY-MM-DDTHH:mm:ssZ).',
  },
  {
    id: 'snake_case',
    label: 'snake_case Keys',
    icon: <Code size={13} className="text-emerald-400" />,
    prompt: 'Convert all key names in this JSON object from camelCase or TitleCase into snake_case format.',
  },
  {
    id: 'generate_schema',
    label: 'JSON Schema',
    icon: <FileCode size={13} className="text-indigo-400" />,
    prompt: 'Generate a complete JSON Schema draft-07 specification that validates this data structure.',
  },
  {
    id: 'translate',
    label: 'Translate Values',
    icon: <Globe size={13} className="text-teal-400" />,
    prompt: 'Translate all user-facing string values in this document to Hindi while leaving key names untouched.',
  },
];

export const AICommandPalette: React.FC<AICommandPaletteProps> = ({
  isOpen,
  onClose,
  onApplyContext,
  contextData,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [parsedPatch, setParsedPatch] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'response' | 'diff'>('response');
  const [copied, setCopied] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);

  // Popover State (Model, Parameters, API Key, Suggestions)
  const [activePopover, setActivePopover] = useState<'model' | 'params' | 'apikey' | 'suggestions' | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [providersReady, setProvidersReady] = useState(false);

  // Local Key editing state
  const [tempApiKey, setTempApiKey] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [keySavedStatus, setKeySavedStatus] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    activeProviderId,
    activeModelId,
    setActiveProvider,
    setActiveModel,
    apiKeys,
    setApiKey,
    temperature,
    maxTokens,
    topP,
    streamingEnabled,
    systemPrompt,
  } = useAIStore();

  const appTheme = useStore((state) => state.appTheme);
  const isDark = appTheme === 'dark';

  // Discover and register providers on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await providerDiscovery.discoverAndRegister();
      if (!cancelled) setProvidersReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute registered providers & current active provider
  const providers = useMemo(() => {
    return providerRegistry.getAllProviders();
  }, [providersReady]);

  const activeProvider = useMemo(() => {
    return providerRegistry.getProvider(activeProviderId) || providers[0] || null;
  }, [activeProviderId, providers]);

  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (activeProvider) {
      activeProvider
        .listModels()
        .then((models) => {
          if (isMounted) setAvailableModels(models);
        })
        .catch(() => {
          if (isMounted) setAvailableModels([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [activeProvider]);

  const activeModel = useMemo(() => {
    return availableModels.find((m) => m.id === activeModelId) || availableModels[0] || null;
  }, [availableModels, activeModelId]);

  // Sync current API key when active provider changes
  useEffect(() => {
    setTempApiKey(apiKeys[activeProviderId] || '');
  }, [activeProviderId, apiKeys]);

  const isKeyConfigured = useMemo(() => {
    if (!activeProvider) return false;
    if (!activeProvider.isCloud) return true;
    return !!apiKeys[activeProviderId];
  }, [activeProvider, activeProviderId, apiKeys]);

  // Filtered models for search picker
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels;
    const query = modelSearch.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.displayName.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
    );
  }, [availableModels, modelSearch]);

  // Calculate JSON Patch before/after preview
  const patchedResult = useMemo(() => {
    if (!parsedPatch || !contextData || typeof contextData !== 'object') return null;
    try {
      const res = applyPatchSmart(contextData, parsedPatch);
      return res.newDocument;
    } catch {
      return null;
    }
  }, [parsedPatch, contextData]);

  // Escape key & shortcut handling
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (activePopover) {
          setActivePopover(null);
        } else {
          onClose();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose, activePopover, prompt]);

  // Stream chunk subscriber
  useEffect(() => {
    const onChunk = (e: { chunk: string }) => setOutput((prev) => prev + e.chunk);
    const onError = (e: { error: Error }) => setError(e.error.message);

    aiEventBus.on('tokenReceived', onChunk);
    aiEventBus.on('error', onError);

    return () => {
      aiEventBus.off('tokenReceived', onChunk);
      aiEventBus.off('error', onError);
    };
  }, []);

  // Parse patch on stream update or completion
  useEffect(() => {
    if (output) {
      const parsed = responseParser.parse(output);
      if (parsed.jsonPatch) {
        setParsedPatch(parsed.jsonPatch);
        if (!isGenerating && activeTab !== 'diff') {
          setActiveTab('diff');
        }
      }
    }
  }, [isGenerating, output]);

  const handleSubmit = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || prompt;
    if (!promptToUse.trim()) return;

    if (activeProvider?.isCloud && !isKeyConfigured) {
      setError(`Please enter your ${activeProvider.name} API key before sending requests.`);
      setActivePopover('apikey');
      return;
    }

    setActivePopover(null);
    setIsGenerating(true);
    setOutput('');
    setParsedPatch(null);
    setError('');
    setActiveTab('response');

    abortControllerRef.current = new AbortController();

    try {
      const fullPrompt = CommandPalettePromptV1(contextData, promptToUse);

      const options = {
        modelId: activeModelId || aiProviderManager.getActiveModelId() || '',
        temperature,
        maxTokens,
        topP,
        systemPrompt,
      };

      if (streamingEnabled) {
        await aiProviderManager.stream(fullPrompt, options, () => { }, abortControllerRef.current.signal);
      } else {
        const result = await aiProviderManager.generate(fullPrompt, options, abortControllerRef.current.signal);
        setOutput(result.text);
        const parsed = responseParser.parse(result.text);
        if (parsed.jsonPatch) {
          setParsedPatch(parsed.jsonPatch);
          setActiveTab('diff');
        }
      }
    } catch (err: any) {
      if (err.message !== 'Request cancelled') {
        setError(err.message || 'An error occurred during generation.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSaveApiKey = () => {
    if (!activeProviderId) return;
    setApiKey(activeProviderId, tempApiKey.trim());
    setKeySavedStatus('API Key saved successfully!');
    setTimeout(() => {
      setKeySavedStatus(null);
      setActivePopover(null);
    }, 1200);
  };

  const handleCopyOutput = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPatch = () => {
    if (!parsedPatch) return;
    navigator.clipboard.writeText(JSON.stringify(parsedPatch, null, 2));
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 pointer-events-none transition-all">
      {/* Outer Wrapper */}
      <div className="w-full max-w-2xl flex flex-col gap-3 pointer-events-auto">
        {/* SLEEK PROMPT BOX */}
        <div
          className={`relative z-50 rounded-none border p-4 shadow-2xl transition-all duration-300 ${isDark
            ? 'bg-[#0a0a0a] border-neutral-800 text-white'
            : 'bg-white border-neutral-300 text-black shadow-xl'
            }`}
        >
          {/* Top Row: Auto-expanding Textarea */}
          <textarea
            ref={textareaRef}
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI anything to generate, transform, fix, or explain JSON..."
            disabled={isGenerating}
            className={`w-full bg-transparent border-none outline-none font-sans text-sm leading-relaxed resize-none ${isDark ? 'text-neutral-100 placeholder-neutral-600' : 'text-neutral-900 placeholder-neutral-400'
              }`}
          />

          {/* Bottom Bar inside prompt box */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 mt-1">

            {/* Top/Left Group: Model Selector & Settings */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Provider & Model Selector Badge */}
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-none border text-xs font-semibold transition-all cursor-pointer ${activePopover === 'model'
                  ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                  : isDark
                    ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300'
                  }`}
              >
                {getProviderIcon(activeProviderId, isDark)}
                <span className="truncate max-w-[150px] font-mono text-[11px]">
                  {activeProvider?.name} / {activeModel?.displayName || activeModelId}
                </span>
                <ChevronDown size={12} className={activePopover === 'model' ? 'opacity-70' : 'opacity-40'} />
              </button>

              {/* Parameters Button */}
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === 'params' ? null : 'params')}
                className={`p-1.5 rounded-none border transition-all cursor-pointer ${activePopover === 'params'
                  ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                  : isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                title="Generation Parameters"
              >
                <SlidersHorizontal size={13} />
              </button>

              {/* API Key Credentials Button */}
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === 'apikey' ? null : 'apikey')}
                className={`p-1.5 rounded-none border transition-all cursor-pointer relative ${activePopover === 'apikey'
                  ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                  : isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                title="API Credentials Settings"
              >
                <Key size={13} />
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white dark:border-black ${isKeyConfigured ? 'bg-neutral-800 dark:bg-neutral-300' : 'bg-red-500 animate-pulse'
                    }`}
                />
              </button>
            </div>

            {/* Bottom/Right Group: Actions & Submit */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                {/* Quick Actions Suggestions Button */}
                <button
                  type="button"
                  onClick={() => setActivePopover(activePopover === 'suggestions' ? null : 'suggestions')}
                  className={`p-1.5 rounded-none border transition-all cursor-pointer ${activePopover === 'suggestions'
                    ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                    : isDark
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  title="Quick Prompt Suggestions"
                >
                  <Sparkles size={13} />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-1.5 rounded-none border transition-all cursor-pointer ${isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-red-500 hover:border-red-500'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-red-500 hover:text-white hover:border-red-500'
                    }`}
                  title="Close AI Palette (Esc)"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Sharp Submit Button */}
              <div>
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-8 h-8 rounded-none bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-white text-white dark:text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    title="Cancel Generation"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!prompt.trim()}
                    className="w-8 h-8 rounded-none bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-30 text-white dark:text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    title="Send Prompt (⌘↵)"
                  >
                    <ArrowUp size={15} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Click-Outside Overlay for Popovers */}
          {activePopover && (
            <div
              className="fixed inset-0 z-[9990]"
              onClick={(e) => { e.stopPropagation(); setActivePopover(null); }}
            />
          )}

          {/* FLOATING POPOVER 1: MODEL & PROVIDER SELECTOR */}
          {activePopover === 'model' && (
            <div
              className={`fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75vh] max-sm:rounded-t-none max-sm:border-t max-sm:border-x max-sm:p-5 sm:absolute sm:top-full sm:left-0 sm:mt-3 sm:w-96 sm:rounded-none border p-4 shadow-2xl z-[10000] space-y-4 overflow-y-auto ${isDark ? 'bg-black/80 backdrop-blur-xl border-neutral-800 text-white' : 'bg-white/90 backdrop-blur-xl border-neutral-300 text-black'
                }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                  <Layers size={14} />
                  <span>Choose Provider & Model</span>
                </div>
                <button onClick={() => setActivePopover(null)} className="text-neutral-500 hover:text-black dark:hover:text-white">
                  <X size={14} />
                </button>
              </div>

              {/* Providers Grid */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">AI Providers</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {providers.map((p) => {
                    const isSelected = p.id === activeProviderId;
                    const hasKey = !!apiKeys[p.id] || !!p.isLocal || !p.isCloud;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveProvider(p.id);
                          setModelSearch('');
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-none border text-xs font-semibold transition-all cursor-pointer truncate ${isSelected
                          ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                          : isDark
                            ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-black'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getProviderIcon(p.id, isDark)}
                          <span className="truncate">{p.name}</span>
                        </div>
                        {hasKey ? (
                          <CheckCircle2 size={12} className={isSelected ? 'opacity-80' : 'text-neutral-400 dark:text-neutral-500'} />
                        ) : (
                          <AlertCircle size={12} className={isSelected ? 'opacity-80' : 'text-neutral-400 dark:text-neutral-500'} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Models Search & List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  <span>Available Models ({filteredModels.length})</span>
                  <span className="text-neutral-900 dark:text-neutral-100 capitalize">{activeProvider?.name}</span>
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Search models..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-none border text-xs outline-none font-mono ${isDark ? 'bg-neutral-900 border-neutral-800 text-white focus:border-white' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-black'
                      }`}
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-6 text-neutral-500 text-xs">No models found for query</div>
                  ) : (
                    filteredModels.map((m) => {
                      const isSelected = m.id === activeModelId;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setActiveModel(m.id);
                            setActivePopover(null);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-none border text-xs transition-all cursor-pointer text-left ${isSelected
                            ? (isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                            : isDark
                              ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-black'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 truncate max-w-[85%]">
                            <div className="shrink-0 flex items-center justify-center opacity-90">
                              {getModelIcon(m.id, activeProvider?.id || '', isSelected ? !isDark : isDark)}
                            </div>
                            <div className="flex flex-col truncate">
                              <div className="font-bold text-xs truncate flex items-center gap-1.5">
                                <span className={isSelected ? 'text-current' : 'text-neutral-900 dark:text-neutral-100'}>{m.displayName}</span>
                              </div>
                              <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${isSelected ? 'opacity-80' : 'text-neutral-500'}`}>
                                <span className={`px-1.5 py-0.2 rounded-none font-mono font-bold border ${isSelected ? 'border-current' : 'border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                  }`}>
                                  {Math.round(m.contextLength / 1000)}K Context
                                </span>
                                {m.capabilities.reasoning && (
                                  <span className="font-semibold flex items-center gap-0.5">
                                    <Brain size={10} /> Reasoning
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && <Check size={16} className="shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FLOATING POPOVER 2: GENERATION PARAMETERS */}
          {activePopover === 'params' && (
            <div
              className={`fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75vh] max-sm:rounded-t-none max-sm:border-t max-sm:border-x max-sm:p-5 sm:absolute sm:top-full sm:left-0 sm:mt-3 sm:w-80 sm:rounded-none border p-4 shadow-2xl z-[10000] space-y-3 overflow-y-auto ${isDark ? 'bg-black/80 backdrop-blur-xl border-neutral-800 text-white' : 'bg-white/90 backdrop-blur-xl border-neutral-300 text-black'
                }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <SlidersHorizontal size={14} />
                  <span>Parameters & Config</span>
                </span>
                <button onClick={() => setActivePopover(null)} className="text-neutral-500 hover:text-black dark:hover:text-white">
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                <AIParameters />
              </div>
            </div>
          )}

          {/* FLOATING POPOVER 3: API KEY SETTINGS */}
          {activePopover === 'apikey' && (
            <div
              className={`fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75vh] max-sm:rounded-t-none max-sm:border-t max-sm:border-x max-sm:p-5 sm:absolute sm:top-full sm:left-0 sm:mt-3 sm:w-85 sm:rounded-none border p-4 shadow-2xl z-[10000] space-y-3 overflow-y-auto ${isDark ? 'bg-black/80 backdrop-blur-xl border-neutral-800 text-white' : 'bg-white/90 backdrop-blur-xl border-neutral-300 text-black'
                }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <Key size={14} />
                  <span>{activeProvider?.name} Credentials</span>
                </span>
                <button onClick={() => setActivePopover(null)} className="text-neutral-500 hover:text-black dark:hover:text-white">
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Current Provider:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 capitalize">{activeProvider?.name}</span>
                </div>

                <div className="relative">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder={`Enter ${activeProvider?.name} API key...`}
                    className={`w-full p-2.5 pr-9 rounded-none border text-xs outline-none font-mono ${isDark
                      ? 'bg-neutral-900 border-neutral-800 text-white focus:border-white'
                      : 'bg-neutral-50 border-neutral-200 text-black focus:border-black'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-3.5 text-neutral-500 hover:text-black dark:hover:text-white"
                  >
                    {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {keySavedStatus && (
                  <div className="text-[11px] text-green-500 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} /> {keySavedStatus}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="w-full py-2 bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black font-bold text-xs rounded-none transition-all cursor-pointer active:scale-95"
                >
                  Save API Key
                </button>
              </div>
            </div>
          )}

          {/* FLOATING POPOVER 4: QUICK ACTION SUGGESTIONS */}
          {activePopover === 'suggestions' && (
            <div
              className={`fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[75vh] max-sm:rounded-t-none max-sm:border-t max-sm:border-x max-sm:p-5 sm:absolute sm:top-full sm:left-0 sm:mt-3 sm:w-80 sm:rounded-none border p-3 shadow-2xl z-[10000] space-y-2 overflow-y-auto ${isDark ? 'bg-black/80 backdrop-blur-xl border-neutral-800 text-white' : 'bg-white/90 backdrop-blur-xl border-neutral-300 text-black'
                }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2 px-1">
                <span className="font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap size={14} />
                  <span>Quick Actions</span>
                </span>
                <button onClick={() => setActivePopover(null)} className="text-neutral-500 hover:text-black dark:hover:text-white">
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      setPrompt(cmd.prompt);
                      handleSubmit(cmd.prompt);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-none border text-xs font-semibold transition-all cursor-pointer text-left ${isDark
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:text-black hover:border-neutral-400'
                      }`}
                  >
                    {cmd.icon}
                    <span>{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* OUTPUT / RESPONSE DISPLAY CARD */}
        {(output || isGenerating || error || parsedPatch) && (
          <div
            className={`rounded-none border p-4 shadow-xl flex flex-col max-h-[55vh] overflow-hidden transition-all animate-fadeIn ${isDark ? 'bg-[#0a0a0a] border-neutral-800 text-white' : 'bg-white border-neutral-300 text-black shadow-lg'
              }`}
          >
            {/* Header / Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-neutral-200 dark:border-neutral-800 pb-2.5 mb-3 text-xs font-semibold uppercase tracking-wider">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('response')}
                  className={`whitespace-nowrap px-3 py-1 rounded-none transition-all font-bold cursor-pointer ${activeTab === 'response'
                    ? (isDark ? 'bg-white text-black border border-white' : 'bg-black text-white border border-black')
                    : 'text-neutral-500 hover:text-black dark:hover:text-white border border-transparent'
                    }`}
                >
                  Response Output
                </button>

                {parsedPatch && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('diff')}
                    className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-none transition-all font-bold cursor-pointer ${activeTab === 'diff'
                      ? 'bg-green-500 text-black border border-green-500'
                      : 'text-neutral-500 hover:text-black dark:hover:text-white border border-transparent'
                      }`}
                  >
                    <FileCode size={13} />
                    <span>Diff Preview ({parsedPatch.length} ops)</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {output && (
                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    className="whitespace-nowrap flex items-center gap-1 text-neutral-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}

                {parsedPatch && onApplyContext && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyContext(parsedPatch, 'merge');
                        onClose();
                      }}
                      className="whitespace-nowrap px-3 py-1 bg-green-500 hover:bg-green-600 text-black font-bold text-xs rounded-none transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                      title="Deeply merge AI data into existing document preserving un-targeted fields"
                    >
                      <GitMerge size={13} />
                      <span>Merge</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onApplyContext(parsedPatch, 'replace');
                        onClose();
                      }}
                      className="whitespace-nowrap px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-none transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                      title="Replace current document structure completely with AI response"
                    >
                      <RefreshCw size={13} />
                      <span>Replace</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Output Body */}
            <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed pr-1 custom-scrollbar">
              {error && (
                <div className="p-3 rounded-none border border-red-500 text-red-500 flex items-start gap-2 mb-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {activeTab === 'response' ? (
                <div className="whitespace-pre-wrap">
                  {output}
                  {isGenerating && (
                    <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse align-middle rounded-none" />
                  )}
                </div>
              ) : (
                /* Diff View Tab */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 text-[10px] sm:text-xs font-semibold text-neutral-500 border-b border-neutral-200 dark:border-neutral-800 pb-1.5 uppercase tracking-wider">
                    <span className="truncate">RFC 6902 JSON Patch Operations</span>
                    <button
                      type="button"
                      onClick={handleCopyPatch}
                      className="hover:text-black dark:hover:text-white cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                    >
                      {copiedPatch ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      <span>{copiedPatch ? 'Copied' : 'Copy Patch'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Original Context */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Original Document</div>
                      <pre className={`p-3 rounded-none border overflow-x-auto text-[11px] max-h-48 ${isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                        }`}>
                        {JSON.stringify(contextData || {}, null, 2)}
                      </pre>
                    </div>

                    {/* Patched Result */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Patched Preview</div>
                      <pre className={`p-3 rounded-none border border-green-500 overflow-x-auto text-[11px] max-h-48 ${isDark ? 'bg-green-950/20 text-green-400' : 'bg-green-50 text-green-700'
                        }`}>
                        {patchedResult ? JSON.stringify(patchedResult, null, 2) : 'Invalid Patch Result'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
