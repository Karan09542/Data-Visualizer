import React, { useState, useEffect, useCallback } from 'react';
import { ai } from '../../../../ai';
import { AITask, AIProgressState } from '../../../../ai/types';
import { aiEventBus } from '../../../../ai/events/AIEventBus';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { SegmentationCommand } from '../../commands/ai/SegmentationCommand';
import { Scissors, Settings2, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon, UserSquare2, Layers, Eraser, X } from 'lucide-react';
import { PassportBackgroundPicker, PassportBackground } from '../shared/PassportBackgroundPicker';
import { ColorPickerTrigger } from '../shared/ColorPickers';

interface SegmentationUIProps {
  isActive: boolean;
  jobState?: string;
  progress?: number;
  onExecute: (effectId: string, options?: any) => void;
  onCancel: () => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
}

const EFFECT_UI_CONFIG = [
  { id: 'remove', label: 'Remove Background', icon: <Eraser size={14} />, desc: 'Creates a transparent PNG' },
  { id: 'portrait', label: 'Portrait Mode', icon: <UserSquare2 size={14} />, desc: 'DSLR blur effect', options: { blurRadius: 8 } },
  { id: 'passport', label: 'Passport Photo', icon: <ImageIcon size={14} />, desc: 'Solid professional color' },
  { id: 'change-bg', label: 'Change Background', icon: <Layers size={14} />, desc: 'Composite over new image' }
];

const PASSPORT_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Light Blue', value: '#7dd3fc' },
  { label: 'Gray', value: '#9ca3af' }
];

export const SegmentationPanel: React.FC<SegmentationUIProps> = ({
  isActive, jobState, progress, onExecute, onCancel, selectedModel, setSelectedModel
}) => {
  const models = modelRegistry.getForTask('background-removal');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [activeEffectConfig, setActiveEffectConfig] = useState<string | null>(null);
  const [customPassportColor, setCustomPassportColor] = useState<string>('#ffffff');
  const [changeBgConfig, setChangeBgConfig] = useState<PassportBackground>({ type: 'color', color: '#ffffff' });
  const activeModel = models.find(m => m.id === selectedModel);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl overflow-hidden flex flex-col transition-all">
      {/* Header & Model Selector */}
      <div className="p-3 border-b border-[#2D2D2D] flex items-center justify-between bg-[#151515]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
            <Scissors size={12} />
          </div>
          <span className="text-sm font-semibold text-white">Segmentation</span>
        </div>

        <div className="relative">
          <button
            onClick={() => !isActive && setIsModelOpen(!isModelOpen)}
            disabled={isActive}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md border ${isModelOpen ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-400' : 'border-[#333] bg-black/40 text-[#888] hover:text-white hover:border-[#555]'} transition-all`}
          >
            {activeModel?.name || selectedModel} <Settings2 size={10} />
          </button>

          {isModelOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden">
              {models.map(m => (
                <div
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setIsModelOpen(false); }}
                  className={`px-3 py-2 text-[11px] cursor-pointer hover:bg-[#222] border-b border-[#222] last:border-0 ${m.id === selectedModel ? 'text-fuchsia-400 font-bold' : 'text-[#AAA]'}`}
                >
                  <div className="uppercase tracking-widest text-[9px] mb-0.5">{m.id}</div>
                  <div className="leading-tight">{m.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Effects Grid */}
      <div className="p-2 grid grid-cols-2 gap-2 relative">
        {/* Loading Overlay */}
        {isActive && (
          <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-b-xl border-t border-white/5">
            <Loader2 className="animate-spin text-fuchsia-500 mb-2" size={24} />
            <div className="text-xs font-bold text-white uppercase tracking-wider">{jobState}</div>
            {progress !== undefined && progress > 0 && (
              <div className="w-32 h-1 bg-[#333] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <button
              onClick={onCancel}
              className="mt-3 text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest px-3 py-1 border border-red-500/30 rounded-md bg-red-500/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {EFFECT_UI_CONFIG.map(effect => {
          const isSupported = activeModel?.supports?.includes(effect.id) ?? true;
          const isPassport = effect.id === 'passport';

          return (
            <div key={effect.id} className="relative group/effect flex flex-col h-[90px]">
              <button
                onClick={() => {
                  if (effect.id === 'change-bg') {
                    setActiveEffectConfig(prev => prev === 'change-bg' ? null : 'change-bg');
                  } else if (effect.id === 'passport') {
                    onExecute('passport', { backgroundColor: customPassportColor });
                  } else {
                    onExecute(effect.id, effect.options);
                  }
                }}
                disabled={!isSupported || isActive}
                className={`p-3 rounded-xl border text-left transition-all duration-300 h-full ${!isSupported
                    ? 'opacity-40 border-transparent bg-transparent cursor-not-allowed'
                    : 'border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent hover:from-white/[0.08] hover:to-white/[0.02] hover:border-white/20 hover:shadow-lg hover:shadow-fuchsia-500/10 active:scale-[0.98]'
                  } flex flex-col gap-2 relative`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-white/10 text-white shadow-sm ${!isSupported ? 'grayscale' : 'group-hover/effect:text-fuchsia-400 group-hover/effect:bg-fuchsia-500/20 transition-colors duration-300'}`}>
                  {effect.icon}
                </div>
                <div className="flex flex-col gap-0.5 mt-auto pr-6">
                  <div className="font-semibold text-[11px] text-white leading-tight">{effect.label}</div>
                  <div className="text-[9px] text-[#888] leading-tight truncate">{effect.desc}</div>
                </div>
              </button>

              {/* Inline Custom Color Picker for Passport */}
              {isPassport && isSupported && !isActive && (
                <div className="absolute bottom-2.5 right-2.5 z-20" onClick={e => e.stopPropagation()}>
                  <ColorPickerTrigger
                    color={customPassportColor}
                    onChange={(c: string) => setCustomPassportColor(c)}
                    className="w-5 h-5 rounded-full border border-white/30 shadow-inner hover:scale-110 hover:border-white/50 transition-all cursor-pointer flex items-center justify-center bg-transparent"
                    label="Pick Passport Background Color"
                  />
                </div>
              )}

              {/* Indicator if config is open */}
              {effect.id === 'change-bg' && activeEffectConfig === 'change-bg' && !isActive && (
                <div className="absolute inset-0 border-2 border-fuchsia-500/50 rounded-xl pointer-events-none" />
              )}
            </div>
          )
        })}

        {/* Hidden File Input for Change Background */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const img = new Image();
            img.onload = () => {
              onExecute('change-bg', { image: img, fit: 'cover' });
            };
            img.src = URL.createObjectURL(file);
            // Reset input
            e.target.value = '';
          }}
        />
      </div>

      {/* Change Background Configuration Section */}
      {activeEffectConfig === 'change-bg' && (
        <div className="px-2 pb-2">
          <div className="bg-[#111] border border-[#2D2D2D] rounded-lg p-3 space-y-3 mt-1">
            <div className="text-[10px] uppercase font-bold text-[#888] flex items-center justify-between">
              Background Options
            </div>
            <PassportBackgroundPicker
              value={changeBgConfig}
              onChange={setChangeBgConfig}
              disabled={isActive}
            />
            <button
              onClick={() => {
                if (changeBgConfig.type === 'color') {
                  onExecute('passport', { backgroundColor: changeBgConfig.color || '#ffffff' });
                } else if (changeBgConfig.type === 'image' && changeBgConfig.imageEl) {
                  onExecute('change-bg', { image: changeBgConfig.imageEl, fit: 'cover' });
                }
              }}
              disabled={isActive}
              className={`w-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-500 text-white rounded-lg py-2 text-[11px] font-bold transition-all shadow-lg shadow-fuchsia-500/10 ${isActive ? 'opacity-50 cursor-not-allowed' : 'hover:from-fuchsia-500 hover:to-fuchsia-400 active:scale-[0.98]'}`}
            >
              {isActive ? 'Processing...' : 'Apply Background'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
