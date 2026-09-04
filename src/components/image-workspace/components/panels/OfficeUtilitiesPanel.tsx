import React, { useState } from 'react';
import { Settings, Crop, User, Shield, Target, Image as ImageIcon, BoxSelect, Loader2 } from 'lucide-react';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { ColorPickerTrigger } from '../shared/ColorPickers';
import { FilterSlider } from '../shared/FilterSlider';
import { PassportBackgroundPicker, PassportBackground } from '../shared/PassportBackgroundPicker';
import { CustomSelect } from '../shared/CustomSelect';


const STATE_LABELS: Record<string, string> = {
  'queued': 'Queued…',
  'downloading': 'Downloading model…',
  'loading-model': 'Loading model…',
  'preparing-image': 'Preparing image…',
  'inference': 'Running AI…',
  'post-processing': 'Post-processing…',
  'encoding': 'Encoding output…',
  'completed': 'Done!',
  'failed': 'Failed',
  'cancelled': 'Cancelled'
};

interface Props {
  onExecute: (effectId: string, options: any) => void;
  onPrintSheet?: () => void;
  disabled?: boolean;
  isActive?: boolean;
  jobState?: string;
  progress?: number;
  onCancel?: () => void;
}

export const OfficeUtilitiesPanel: React.FC<Props> = ({ onExecute, onPrintSheet, disabled, isActive, jobState, progress, onCancel }) => {
  const [activeTab, setActiveTab] = useState<string>('auto-crop');
  const [modelId, setModelId] = useState<string>('blaze_face_short_range');
  
  // Options state
  const [blurRadius, setBlurRadius] = useState(20);
  const [blurStrength, setBlurStrength] = useState(100);
  const [blurStyle, setBlurStyle] = useState('blur');
  const [avatarShape, setAvatarShape] = useState('circle');
  const [highlightColor, setHighlightColor] = useState('rgba(59, 130, 246, 1)');
  const [highlightThickness, setHighlightThickness] = useState(4);
  const [passportBg, setPassportBg] = useState<PassportBackground>({ type: 'color', color: 'rgba(255, 255, 255, 1)' });
  const [thumbRatio, setThumbRatio] = useState(16/9);

  const faceModels = modelRegistry.getForTask('face-detection');
  const bgModels = modelRegistry.getForTask('background-removal');
  const [bgModelId, setBgModelId] = useState<string>(bgModels.length > 0 ? bgModels[0].id : 'ormbg');

  const handleRun = (effectId: string, options: any) => {
    onExecute(effectId, { ...options, modelId });
  };

  return (
    <div className="space-y-4 relative">
      {/* Compact Active Progress Banner */}
      {isActive && (
        <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={15} className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-blue-900 dark:text-blue-200 text-[11px] truncate">
              {STATE_LABELS[jobState || ''] || jobState || 'Processing AI...'}
            </span>
            {progress !== undefined && progress > 0 && (
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-[10px]">
                {Math.round(progress)}%
              </span>
            )}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-md border border-red-200 dark:border-red-500/30 transition-colors shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider flex items-center gap-2">
          <Settings size={12} /> Model
        </label>
        <CustomSelect 
          value={modelId}
          onChange={setModelId}
          options={faceModels.map(m => ({ value: m.id, label: m.name }))}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <UtilityBtn active={activeTab === 'auto-crop'} onClick={() => setActiveTab('auto-crop')} icon={<Crop size={15} />} label="Auto Crop" disabled={disabled} />
        <UtilityBtn active={activeTab === 'avatar-crop'} onClick={() => setActiveTab('avatar-crop')} icon={<User size={15} />} label="Avatar" disabled={disabled} />
        <UtilityBtn active={activeTab === 'passport-crop'} onClick={() => setActiveTab('passport-crop')} icon={<BoxSelect size={15} />} label="Passport" disabled={disabled} />
        <UtilityBtn active={activeTab === 'face-blur'} onClick={() => setActiveTab('face-blur')} icon={<Shield size={15} />} label="Face Blur" disabled={disabled} />
        <UtilityBtn active={activeTab === 'face-highlight'} onClick={() => setActiveTab('face-highlight')} icon={<Target size={15} />} label="Highlight" disabled={disabled} />
        <UtilityBtn active={activeTab === 'thumbnail-crop'} onClick={() => setActiveTab('thumbnail-crop')} icon={<ImageIcon size={15} />} label="Thumbnail" disabled={disabled} />
      </div>

      {/* Options Panel based on active tab */}
      <div className="bg-white dark:bg-[#141414] rounded-xl p-3.5 border border-slate-200 dark:border-[#2D2D2D] mt-4 min-h-[120px]">
        
        {activeTab === 'auto-crop' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 dark:text-[#8A8A8A] leading-relaxed">Intelligently crops image keeping face and shoulders perfectly framed.</p>
            <ActionButton onClick={() => handleRun('auto-crop', {})} disabled={disabled} label="Apply Auto Crop" isLoading={isActive} />
          </div>
        )}

        {activeTab === 'avatar-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider">Shape</label>
              <CustomSelect 
                value={avatarShape} 
                onChange={setAvatarShape} 
                options={[
                  { value: 'circle', label: 'Circle' },
                  { value: 'rounded', label: 'Rounded Square' },
                  { value: 'square', label: 'Square' }
                ]}
                disabled={disabled}
              />
            </div>
            <ActionButton onClick={() => handleRun('avatar-crop', { shape: avatarShape })} disabled={disabled} label="Generate Avatar" isLoading={isActive} />
          </div>
        )}

        {activeTab === 'passport-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider flex items-center gap-2">
                <Settings size={12} /> BG Removal Model
              </label>
              <CustomSelect 
                value={bgModelId}
                onChange={setBgModelId}
                options={bgModels.map(m => ({ value: m.id, label: m.name }))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider">Background</label>
              <PassportBackgroundPicker value={passportBg} onChange={setPassportBg} disabled={disabled} />
            </div>
            <ActionButton 
              onClick={() => handleRun('passport-crop', { 
                backgroundColor: passportBg.type === 'color' ? passportBg.color : undefined,
                backgroundImage: passportBg.type === 'image' ? passportBg.imageEl : undefined,
                bgModelId: bgModelId
              })} 
              disabled={disabled} 
              label="Apply Passport Layout" isLoading={isActive} 
            />
            {onPrintSheet && (
              <button 
                onClick={onPrintSheet}
                disabled={disabled}
                className="w-full mt-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#2E2E2E] dark:hover:bg-[#3A3A3A] text-slate-800 dark:text-white border border-slate-200 dark:border-[#444] rounded-lg py-2.5 text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Create Print Sheet
              </button>
            )}
          </div>
        )}

        {activeTab === 'face-blur' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider">Style</label>
              <CustomSelect 
                value={blurStyle} 
                onChange={setBlurStyle} 
                options={[
                  { value: 'blur', label: 'Gaussian Blur' },
                  { value: 'pixelate', label: 'Pixelate' }
                ]}
                disabled={disabled}
              />
            </div>
            <FilterSlider 
              label={blurStyle === 'pixelate' ? "Pixel Size" : "Blur Radius"}
              min={5}
              max={100}
              step={1}
              value={blurRadius}
              onChange={setBlurRadius}
            />
            <FilterSlider 
              label={blurStyle === 'pixelate' ? "Intensity" : "Blur Strength"}
              min={10}
              max={300}
              step={10}
              value={blurStrength}
              onChange={setBlurStrength}
            />
            <ActionButton onClick={() => handleRun('face-blur', { blurRadius, blurStrength, style: blurStyle })} disabled={disabled} label={blurStyle === 'pixelate' ? "Pixelate Faces" : "Blur Faces"} isLoading={isActive} />
          </div>
        )}

        {activeTab === 'face-highlight' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider">Highlight Color</label>
              <div className="flex items-center gap-2.5">
                <ColorPickerTrigger 
                  color={highlightColor} 
                  onChange={setHighlightColor}
                  className="w-8 h-8 rounded-lg border border-slate-300 dark:border-[#333] shadow-inner cursor-pointer transition active:scale-95 hover:border-slate-400 shrink-0"
                />
                <span className="text-[11px] font-mono text-slate-700 dark:text-[#8A8A8A] bg-slate-100 dark:bg-[#1A1A1A] px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-[#2D2D2D] flex-1 truncate">{highlightColor}</span>
              </div>
            </div>
            <FilterSlider 
              label="Line Thickness"
              min={1}
              max={10}
              step={1}
              value={highlightThickness}
              onChange={setHighlightThickness}
            />
            <ActionButton onClick={() => handleRun('face-highlight', { color: highlightColor, thickness: highlightThickness })} disabled={disabled} label="Highlight Faces" isLoading={isActive} />
          </div>
        )}

        {activeTab === 'thumbnail-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-[#8A8A8A] uppercase tracking-wider">Aspect Ratio</label>
              <CustomSelect 
                value={thumbRatio} 
                onChange={setThumbRatio} 
                options={[
                  { value: 16/9, label: '16:9 (YouTube)' },
                  { value: 4/3, label: '4:3 (Classic)' },
                  { value: 1, label: '1:1 (Square)' }
                ]}
                disabled={disabled}
              />
            </div>
            <ActionButton onClick={() => handleRun('thumbnail-crop', { ratio: thumbRatio, align: 'right' })} disabled={disabled} label="Generate Thumbnail" isLoading={isActive} />
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButton = ({ onClick, disabled, label, isLoading, jobState, progress }: { onClick: () => void; disabled?: boolean; label: string; isLoading?: boolean; jobState?: string; progress?: number }) => (
  <button 
    onClick={onClick}
    disabled={disabled || isLoading}
    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2.5 text-[12px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
  >
    {isLoading ? (
      <>
        <Loader2 size={14} className="animate-spin shrink-0" />
        <span>{STATE_LABELS[jobState || ''] || jobState || 'Processing AI...'} {progress ? `(${Math.round(progress)}%)` : ''}</span>
      </>
    ) : (
      <span>{label}</span>
    )}
  </button>
);

const UtilityBtn = ({ active, icon, label, onClick, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 p-2.5 rounded-lg border text-[12px] font-medium transition-all active:scale-[0.97] ${
      active 
        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5' 
        : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-[#2D2D2D] text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-100 dark:hover:bg-[#222] hover:border-slate-300 dark:hover:border-[#444] hover:text-slate-900 dark:hover:text-white'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
