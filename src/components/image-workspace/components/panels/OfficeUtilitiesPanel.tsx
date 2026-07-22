import React, { useState } from 'react';
import { Settings, Crop, User, Shield, Target, Image as ImageIcon, BoxSelect } from 'lucide-react';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { ColorPickerTrigger } from '../shared/ColorPickers';
import { FilterSlider } from '../shared/FilterSlider';
import { PassportBackgroundPicker, PassportBackground } from '../shared/PassportBackgroundPicker';
import { CustomSelect } from '../shared/CustomSelect';

interface Props {
  onExecute: (effectId: string, options: any) => void;
  disabled?: boolean;
}

export const OfficeUtilitiesPanel: React.FC<Props> = ({ onExecute, disabled }) => {
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

  const handleRun = (effectId: string, options: any) => {
    onExecute(effectId, { ...options, modelId });
  };

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider flex items-center gap-2">
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
      <div className="bg-[#141414] rounded-xl p-3.5 border border-[#2D2D2D] mt-4 min-h-[120px]">
        
        {activeTab === 'auto-crop' && (
          <div className="space-y-3">
            <p className="text-[11px] text-[#8A8A8A] leading-relaxed">Intelligently crops image keeping face and shoulders perfectly framed.</p>
            <ActionButton onClick={() => handleRun('auto-crop', {})} disabled={disabled} label="Apply Auto Crop" />
          </div>
        )}

        {activeTab === 'avatar-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Shape</label>
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
            <ActionButton onClick={() => handleRun('avatar-crop', { shape: avatarShape })} disabled={disabled} label="Generate Avatar" />
          </div>
        )}

        {activeTab === 'passport-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Background</label>
              <PassportBackgroundPicker value={passportBg} onChange={setPassportBg} disabled={disabled} />
            </div>
            <ActionButton 
              onClick={() => handleRun('passport-crop', { 
                backgroundColor: passportBg.type === 'color' ? passportBg.color : undefined,
                backgroundImage: passportBg.type === 'image' ? passportBg.imageEl : undefined
              })} 
              disabled={disabled} 
              label="Apply Passport Layout" 
            />
          </div>
        )}

        {activeTab === 'face-blur' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Style</label>
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
            <ActionButton onClick={() => handleRun('face-blur', { blurRadius, blurStrength, style: blurStyle })} disabled={disabled} label={blurStyle === 'pixelate' ? "Pixelate Faces" : "Blur Faces"} />
          </div>
        )}

        {activeTab === 'face-highlight' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Highlight Color</label>
              <div className="flex items-center gap-2.5">
                <ColorPickerTrigger 
                  color={highlightColor} 
                  onChange={setHighlightColor}
                  className="w-8 h-8 rounded-lg border border-[#333] shadow-inner cursor-pointer transition active:scale-95 hover:border-slate-400 shrink-0"
                />
                <span className="text-[11px] font-mono text-[#8A8A8A] bg-[#1A1A1A] px-2.5 py-1.5 rounded-md border border-[#2D2D2D] flex-1 truncate">{highlightColor}</span>
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
            <ActionButton onClick={() => handleRun('face-highlight', { color: highlightColor, thickness: highlightThickness })} disabled={disabled} label="Highlight Faces" />
          </div>
        )}

        {activeTab === 'thumbnail-crop' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Aspect Ratio</label>
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
            <ActionButton onClick={() => handleRun('thumbnail-crop', { ratio: thumbRatio, align: 'right' })} disabled={disabled} label="Generate Thumbnail" />
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButton = ({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2.5 text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-blue-500/10"
  >
    {label}
  </button>
);

const UtilityBtn = ({ active, icon, label, onClick, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 p-2.5 rounded-lg border text-[12px] font-medium transition-all active:scale-[0.97] ${
      active 
        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5' 
        : 'bg-[#1A1A1A] border-[#2D2D2D] text-[#A0A0A0] hover:bg-[#222] hover:border-[#444] hover:text-white'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
