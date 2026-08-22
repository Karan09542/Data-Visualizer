import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useStore } from '../../store/useStore';
import { providerRegistry } from '../../ai/services/ProviderRegistry';
import { AIModelSelector, getProviderIcon } from './AIModelSelector';
import {
  Key, Copy, ClipboardPaste, Info,
  Eye, EyeOff, CheckCircle2, AlertCircle, Trash2
} from 'lucide-react';

export const ParameterSlider = ({ label, tooltip, min, max, step, ticks, value, onChange, isDark }: any) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
        {label}
        {tooltip && <span title={tooltip} className="cursor-help"><Info size={13} className={isDark ? 'text-neutral-500' : 'text-neutral-500'} /></span>}
      </label>
    </div>

    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1">
        <input
          type="range" min={min} max={max} step={step}
          value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`w-full h-1.5 rounded-none appearance-none cursor-pointer ${isDark ? 'accent-white bg-neutral-800' : 'accent-black bg-neutral-200'}`}
        />
        {ticks && (
          <div className={`flex justify-between text-[10px] font-mono ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
            {ticks.map((t: string | number, idx: number) => (
              <span key={idx}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <input
        type="number"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-20 p-2 text-xs font-mono text-center font-bold rounded-none border outline-none transition-colors ${isDark
            ? 'bg-neutral-900 border-neutral-800 text-white focus:border-white'
            : 'bg-neutral-50 border-neutral-200 text-black focus:border-black'
          }`}
      />
    </div>
  </div>
);

export const AISettingsPanel: React.FC = () => {
  const activeProviderId = useAIStore((state) => state.activeProviderId);
  const apiKeys = useAIStore((state) => state.apiKeys);
  const setApiKey = useAIStore((state) => state.setApiKey);
  const removeApiKey = useAIStore((state) => state.removeApiKey);

  const appTheme = useStore(state => state.appTheme);
  const isDark = appTheme === 'dark';

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showKey, setShowKey] = useState(false);

  const provider = providerRegistry.getProvider(activeProviderId);
  const currentKey = apiKeys[activeProviderId] || '';

  const handleTestConnection = async () => {
    if (!provider) return;
    setTestStatus('testing');
    try {
      const isAuth = await provider.authenticate(currentKey);
      if (isAuth) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    } catch {
      setTestStatus('error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentKey);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(activeProviderId, text);
    } catch { }
  };

  return (
    <div className={`flex flex-col gap-6 max-w-2xl mx-auto pb-8 ${isDark ? 'text-neutral-100' : 'text-black'}`}>

      {/* Provider & Model Selector */}
      <div className="space-y-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <AIModelSelector />
      </div>

      {/* Authentication & API Key */}
      {provider?.isCloud && (
        <div className="space-y-2 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-1">
            <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
              <Key size={13} className={isDark ? "text-white" : "text-black"} />
              API Key
              <span title={`Required to use cloud models from ${provider.name}`} className="cursor-help"><Info size={13} className={isDark ? 'text-neutral-500' : 'text-neutral-500'} /></span>
            </label>
            <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>Stored locally</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3 flex items-center justify-center">
                {getProviderIcon(activeProviderId, isDark)}
              </div>
              <input
                type={showKey ? "text" : "password"}
                className={`w-full pl-10 pr-24 py-2 text-xs font-mono rounded-none outline-none transition-colors border ${isDark
                    ? 'bg-neutral-900 border-neutral-800 text-white focus:border-white'
                    : 'bg-neutral-50 border-neutral-200 text-black focus:border-black'
                  }`}
                value={currentKey}
                onChange={(e) => setApiKey(activeProviderId, e.target.value)}
                placeholder={`Paste ${provider.name} API key...`}
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  onClick={() => setShowKey(!showKey)}
                  className={`p-1 rounded-none transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-black hover:bg-neutral-200'
                    }`}
                  title="Toggle visibility"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {currentKey ? (
                  <>
                    <button
                      onClick={handleCopy}
                      className={`p-1 rounded-none transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-black hover:bg-neutral-200'
                        }`}
                    >
                      <span title="Copy Key"><Copy size={14} /></span>
                    </button>
                    <button
                      onClick={() => removeApiKey(activeProviderId)}
                      className="p-1 hover:bg-red-500/20 rounded-none text-red-500 transition-colors"
                    >
                      <span title="Clear Key"><Trash2 size={14} /></span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handlePaste}
                    className={`p-1 rounded-none transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-black hover:bg-neutral-200'
                      }`}
                  >
                    <span title="Paste from clipboard"><ClipboardPaste size={14} /></span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !currentKey}
              className="px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-none disabled:opacity-50 text-xs font-bold transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5"
            >
              {testStatus === 'testing' ? (
                <>
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
          </div>

          {testStatus === 'success' && (
            <div className={`flex items-center gap-2 p-2 rounded-none text-xs font-semibold border mt-2 ${isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
              }`}>
              <CheckCircle2 size={15} /> API Key validated successfully!
            </div>
          )}
          {testStatus === 'error' && (
            <div className={`flex items-center gap-2 p-2 rounded-none text-xs font-semibold border mt-2 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
              <AlertCircle size={15} /> Connection failed. Please check your key.
            </div>
          )}
        </div>
      )}

      <AIParameters />
    </div>
  );
};

export const AIParameters: React.FC = () => {
  const temperature = useAIStore((state) => state.temperature);
  const topP = useAIStore((state) => state.topP);
  const maxTokens = useAIStore((state) => state.maxTokens);
  const reasoningEffort = useAIStore((state) => state.reasoningEffort);
  const seed = useAIStore((state) => state.seed);
  const streamingEnabled = useAIStore((state) => state.streamingEnabled);
  const updateSettings = useAIStore((state) => state.updateSettings);

  const appTheme = useStore(state => state.appTheme);
  const isDark = appTheme === 'dark';

  return (
    <div className="flex flex-col gap-6 w-full pb-8">

      {/* Realtime Stream Toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={streamingEnabled}
            onChange={(e) => updateSettings({ streamingEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className={`w-9 h-5 rounded-none peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white dark:peer-checked:after:bg-black dark:peer-checked:after:border-black ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-300 border-neutral-300'
            }`}></div>
        </label>
        <span className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
          Stream
          <span title="Stream response tokens in real-time as they generate" className="cursor-help"><Info size={13} className={isDark ? 'text-neutral-500' : 'text-neutral-500'} /></span>
        </span>
      </div>

      {/* Modern Custom Radio Selector (none, low, medium, high) */}
      <div className="space-y-2">
        <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
          Reasoning Effort
          <span title="Controls chain-of-thought reasoning depth" className="cursor-help"><Info size={13} className={isDark ? 'text-neutral-500' : 'text-neutral-500'} /></span>
        </label>
        <div className="flex flex-wrap items-center gap-5">
          {(['none', 'low', 'medium', 'high'] as const).map((effort) => {
            const isSelected = reasoningEffort === effort;
            return (
              <button
                key={effort}
                type="button"
                onClick={() => updateSettings({ reasoningEffort: effort })}
                className="flex items-center gap-2 cursor-pointer group select-none outline-none focus:outline-none"
              >
                <div className={`w-3.5 h-3.5 rounded-none border flex items-center justify-center transition-all ${isSelected
                    ? (isDark ? 'border-white bg-white' : 'border-black bg-black')
                    : (isDark ? 'border-neutral-600 group-hover:border-neutral-400 bg-neutral-900' : 'border-neutral-400 group-hover:border-neutral-600 bg-white')
                  }`}>
                  {isSelected && <div className={`w-1.5 h-1.5 rounded-none ${isDark ? 'bg-black' : 'bg-white'}`} />}
                </div>
                <span className={`text-xs font-semibold tracking-wide capitalize ${isSelected
                    ? (isDark ? 'text-white font-bold' : 'text-black font-bold')
                    : (isDark ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-neutral-500 group-hover:text-black')
                  }`}>
                  {effort}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Temperature Slider */}
      <ParameterSlider
        label="Temperature"
        tooltip="Controls creativity vs determinism (0.0 = exact, 1.0 = creative)"
        min={0} max={1} step={0.01}
        ticks={['0.01', '0.26', '0.51', '0.76', '1']}
        value={temperature}
        onChange={(val: number) => updateSettings({ temperature: val })}
        isDark={isDark}
      />

      {/* Top P Slider */}
      <ParameterSlider
        label="Top P"
        tooltip="Probability mass cutoff for token sampling (Nucleus Sampling)"
        min={0.01} max={1} step={0.01}
        ticks={['0.01', '0.26', '0.51', '0.76', '1']}
        value={topP}
        onChange={(val: number) => updateSettings({ topP: val })}
        isDark={isDark}
      />

      {/* Max Tokens Slider */}
      <ParameterSlider
        label="Max Tokens"
        tooltip="Maximum response tokens to generate"
        min={1} max={16000} step={1}
        ticks={['1', '4,100', '8,200', '12,000', '16,000']}
        value={maxTokens}
        onChange={(val: number) => updateSettings({ maxTokens: val })}
        isDark={isDark}
      />

      {/* Seed Input Number Box */}
      <div className="space-y-1.5">
        <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
          Seed
          <span title="Seed value for deterministic output generation" className="cursor-help"><Info size={13} className={isDark ? 'text-neutral-500' : 'text-neutral-500'} /></span>
        </label>
        <input
          type="number"
          value={seed ?? ''}
          placeholder="42"
          onChange={(e) => updateSettings({ seed: e.target.value ? parseInt(e.target.value) : null })}
          className={`w-full p-3 text-xs font-mono font-bold rounded-none border outline-none transition-colors ${isDark
              ? 'bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500 focus:border-white'
              : 'bg-neutral-50 border-neutral-200 text-black placeholder-neutral-400 focus:border-black'
            }`}
        />
      </div>

    </div>
  );
};
