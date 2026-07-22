
import React, { useState } from 'react';
import {
  Zap,
  Download,
  RotateCw,
  Info,
  Package,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { ExportSettings, ExportFormat } from '../../types/export';
import { MozjpegSettings } from './MozjpegSettings';
import { WebpSettings } from './WebpSettings';
import { AvifSettings } from './AvifSettings';
import { PngSettings } from './PngSettings';
import { JxlSettings } from './JxlSettings';
import { ResizeSettings } from './ResizeSettings';
import { MetricsPanel } from './MetricsPanel';
import { PRESET_REGISTRY } from '../../lib/imagePresets';

interface Props {
  settings: ExportSettings;
  onChange: (settings: ExportSettings) => void;
  onExport: () => void;
  isExporting: boolean;
  originalSize: number;
  optimizedSize: number;
  originalWidth: number;
  originalHeight: number;
  psnr?: number;
  // Artboard targeting
  artboards: any[];
  activeArtboardId: string;
  setActiveArtboardId: (id: string) => void;
  exportTarget: "current" | "selected" | "all";
  setExportTarget: (target: "current" | "selected" | "all") => void;
  selectedExportIds: Record<string, boolean>;
  setSelectedExportIds: (ids: Record<string, boolean> | ((prev: any) => any)) => void;
}

export const ExportStudio: React.FC<Props> = ({
  settings,
  onChange,
  onExport,
  isExporting,
  originalSize,
  optimizedSize,
  originalWidth,
  originalHeight,
  psnr,
  artboards,
  activeArtboardId,
  setActiveArtboardId,
  exportTarget,
  setExportTarget,
  selectedExportIds,
  setSelectedExportIds
}) => {
  const [uiMode, setUiMode] = useState<'basic' | 'advanced' | 'expert'>('basic');
  const [activeSection, setActiveSection] = useState<'codec' | 'resize' | 'presets'>('codec');
  const [showAdvancedMobile, setShowAdvancedMobile] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  const updateCodecSettings = (codec: 'mozjpeg' | 'webp' | 'avif' | 'png' | 'jxl', newOptions: any) => {
    onChange({
      ...settings,
      [codec]: { ...settings[codec], ...newOptions }
    });
  };

  const setPreset = (presetName: string) => {
    let newSettings = { ...settings };
    switch (presetName) {
      case '100% Original HQ':
      case 'Maximum Quality':
        newSettings.directNativeExport = true;
        newSettings.format = 'png';
        newSettings.png.paletteReduction = false;
        newSettings.png.level = 0;
        newSettings.mozjpeg.quality = 100;
        newSettings.webp.quality = 100;
        break;
      case 'Web Optimized':
        newSettings.directNativeExport = false;
        newSettings.format = 'webp';
        newSettings.webp.quality = 85;
        newSettings.webp.method = 4;
        newSettings.webp.alpha_quality = 90;
        break;
      case 'Extreme Compression':
        newSettings.directNativeExport = false;
        newSettings.format = 'avif';
        newSettings.avif.cqLevel = 35;
        newSettings.avif.speed = 4;
        break;
      case 'Social Media':
        newSettings.directNativeExport = false;
        newSettings.format = 'jpeg';
        newSettings.mozjpeg.quality = 95;
        newSettings.mozjpeg.progressive = true;
        newSettings.resize.enabled = true;
        newSettings.resize.width = 1080;
        newSettings.resize.maintainAspectRatio = true;
        break;
      case 'Thumbnail':
        newSettings.directNativeExport = false;
        newSettings.format = 'webp';
        newSettings.webp.quality = 75;
        newSettings.resize.enabled = true;
        newSettings.resize.width = 300;
        newSettings.resize.maintainAspectRatio = true;
        break;
      case 'Discord/Chat':
        newSettings.directNativeExport = false;
        newSettings.format = 'webp';
        newSettings.webp.quality = 85;
        newSettings.resize.enabled = true;
        newSettings.resize.width = 800;
        newSettings.resize.maintainAspectRatio = true;
        break;
    }
    onChange(newSettings);
  };

  const activeBoard = artboards.find(b => b.id === activeArtboardId);
  const matchedPreset = activeBoard ? PRESET_REGISTRY.find(p => p.name === activeBoard.name) : null;
  const recommendation = matchedPreset?.exportRecommendation;

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] border-l border-[#222] w-full overflow-y-auto custom-scrollbar">
      {/* Header - Desktop Only */}
      <div className="hidden md:flex p-4 border-b border-[#222] bg-[#111] sticky top-0 z-10 items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-blue-500" />
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Export Studio</h2>
        </div>
        <select
          value={uiMode}
          onChange={(e) => setUiMode(e.target.value as any)}
          className="bg-[#1A1A1A] border border-[#333] text-[10px] font-bold text-slate-400 rounded px-2 py-1 outline-none cursor-pointer hover:border-blue-500 transition-colors"
        >
          <option value="basic">BASIC</option>
          <option value="advanced">ADVANCED</option>
          <option value="expert">EXPERT</option>
        </select>
      </div>

      <div className="p-3 md:p-4 space-y-4 md:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Mobile Format & Advanced Settings Block */}
        <div className="md:hidden flex flex-col gap-2 bg-[#111] border border-[#222] p-2 rounded-xl relative">
           <div className="flex items-center justify-between gap-2">
              <div className="flex-1 relative">
                <button 
                  className={`w-full bg-[#1A1A1A] border rounded-lg flex items-center px-2 py-2 transition-colors ${showFormatDropdown ? 'border-blue-500' : 'border-[#2A2A2A]'}`}
                  onClick={() => {
                     setShowFormatDropdown(!showFormatDropdown);
                     setShowTargetDropdown(false);
                  }}
                >
                  <Package size={12} className="text-blue-500 shrink-0 mr-2" />
                  <span className="flex-1 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider">{settings.format}</span>
                  <ChevronDown size={14} className={`text-slate-500 shrink-0 ml-1 transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showFormatDropdown && (
                  <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowFormatDropdown(false)} />
                     <div className="absolute top-full left-0 mt-1 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
                       {(['jpeg', 'png', 'webp', 'avif', 'jxl'] as ExportFormat[]).map(fmt => (
                         <button
                           key={fmt}
                           className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left transition-colors ${settings.format === fmt ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 active:bg-[#222]'}`}
                           onClick={() => {
                             onChange({ ...settings, format: fmt });
                             setShowFormatDropdown(false);
                           }}
                         >
                           {fmt}
                         </button>
                       ))}
                     </div>
                  </>
                )}
              </div>
              
              <button 
                className={`flex items-center justify-center p-2 border rounded-lg transition-colors ${showAdvancedMobile ? 'bg-blue-600/10 border-blue-500/30' : 'bg-[#1A1A1A] border-[#2A2A2A] active:bg-[#222]'}`}
                onClick={() => setShowAdvancedMobile(!showAdvancedMobile)}
              >
                <Settings2 size={16} className={showAdvancedMobile ? "text-blue-400" : "text-slate-400"} />
              </button>
           </div>
        </div>

        {/* Format Selector Desktop */}
        <div className="hidden md:block">
          <div className="flex bg-[#1A1A1A] p-0.5 rounded-xl border border-[#222] gap-0.5 overflow-x-auto no-scrollbar">
            {(['jpeg', 'png', 'webp', 'avif', 'jxl'] as ExportFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => onChange({ ...settings, format: fmt })}
                className={`flex-1 min-h-[36px] py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${settings.format === fmt
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-[#252525]'
                  }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced / Detailed Sections */}
        <div className={`space-y-4 md:space-y-6 ${!showAdvancedMobile ? 'hidden md:block' : 'block'}`}>
          {/* Direct Native High Quality Mode Toggle */}
          <div className={`p-3 md:p-3.5 rounded-xl md:rounded-2xl transition-all duration-300 border ${
            settings.directNativeExport 
            ? 'bg-gradient-to-r from-blue-950/60 via-[#121624] to-[#0E111C] border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
            : 'bg-[#111111] border-[#222222] hover:border-[#333333]'
          }`}>
            <label className="flex items-center justify-between cursor-pointer select-none gap-3">
              {/* Mobile Compact View */}
              <div className="flex md:hidden items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 transition-all ${
                  settings.directNativeExport
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] ring-1 ring-blue-400/30'
                  : 'bg-[#1A1A1A] text-slate-500 border border-[#2A2A2A]'
                }`}>
                  HQ
                </div>
                <div className="text-[11px] font-extrabold text-white tracking-tight flex-1">
                  100% Native Mode
                </div>
              </div>

              {/* Desktop Expanded View */}
              <div className="hidden md:flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                  settings.directNativeExport
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] ring-2 ring-blue-400/30'
                  : 'bg-[#1A1A1A] text-slate-500 border border-[#2A2A2A]'
                }`}>
                  HQ
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Direct High Quality Mode</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider font-mono transition-all ${
                      settings.directNativeExport
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'bg-[#1A1A1A] text-slate-500 border border-[#282828]'
                    }`}>
                      {settings.directNativeExport ? '100% Native' : 'WASM Active'}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-tight">
                    Bypass WASM lossy compression for 100% pixel-perfect original canvas export
                  </div>
                </div>
              </div>

              {/* Custom Modern Animated Toggle Switch */}
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  onChange({ ...settings, directNativeExport: !settings.directNativeExport });
                }}
                className={`w-11 h-6 rounded-full px-1 flex items-center transition-all duration-300 cursor-pointer relative shrink-0 border ${
                  settings.directNativeExport 
                  ? 'bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.4)] justify-end' 
                  : 'bg-[#1A1A1A] border-[#333333] justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center">
                  {settings.directNativeExport && <Check size={10} className="text-blue-600 stroke-[3.5]" />}
                </div>
              </div>
            </label>
          </div>

          {/* Export Range Targeting Selector */}
          <div className="space-y-3 md:space-y-4 bg-[#111111] p-3 md:p-3.5 rounded-xl md:rounded-2xl border border-[#222222]">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={14} className="text-blue-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline Target</span>
            </div>

            {/* Premium segmented control instead of simple select (Desktop) */}
            <div className="hidden md:flex bg-[#161616] p-1 rounded-xl border border-[#222222] gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'current', label: 'Active' },
                { id: 'selected', label: 'Selected' },
                { id: 'all', label: 'All Boards' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setExportTarget(t.id as any)}
                  className={`flex-1 min-w-[65px] min-h-[32px] md:min-h-0 py-1.5 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center whitespace-nowrap ${exportTarget === t.id
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mobile Custom Select */}
            <div className="md:hidden relative">
                <button 
                  className={`w-full bg-[#161616] border rounded-lg flex items-center px-2 py-2 transition-colors ${showTargetDropdown ? 'border-blue-500/50' : 'border-[#222222]'}`}
                  onClick={() => {
                     setShowTargetDropdown(!showTargetDropdown);
                     setShowFormatDropdown(false);
                  }}
                >
                  <span className="flex-1 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                     {exportTarget === 'current' ? 'Active Board' : exportTarget === 'selected' ? 'Selected Boards' : 'All Boards'}
                  </span>
                  <ChevronDown size={14} className={`text-slate-500 shrink-0 ml-1 transition-transform ${showTargetDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showTargetDropdown && (
                  <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowTargetDropdown(false)} />
                     <div className="absolute top-full left-0 mt-1 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
                       {[
                         { id: 'current', label: 'Active Board' },
                         { id: 'selected', label: 'Selected Boards' },
                         { id: 'all', label: 'All Boards' }
                       ].map(t => (
                         <button
                           key={t.id}
                           className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left transition-colors ${exportTarget === t.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 active:bg-[#222]'}`}
                           onClick={() => {
                             setExportTarget(t.id as any);
                             setShowTargetDropdown(false);
                           }}
                         >
                           {t.label}
                         </button>
                       ))}
                     </div>
                  </>
                )}
            </div>

            {(exportTarget === "current" || exportTarget === "selected") && (
              <div className="space-y-1.5 mt-2 md:mt-3 max-h-[150px] md:max-h-[180px] overflow-y-auto border border-[#1F1F1F] p-1.5 rounded-xl bg-[#090909] custom-scrollbar shadow-inner">
                {artboards.map((b) => {
                  const isSelected = exportTarget === "selected" ? !!selectedExportIds[b.id] : activeArtboardId === b.id;
                  const isActive = activeArtboardId === b.id;
                  const isDisabled = exportTarget === "current";

                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg md:rounded-xl cursor-pointer transition-all border ${isActive
                          ? 'bg-blue-600/5 border-blue-500/30 shadow-[0_0_12px_rgba(37,99,235,0.03)]'
                          : isSelected
                            ? 'bg-blue-500/5 border-blue-500/20'
                            : 'hover:bg-[#121212] border-transparent'
                        }`}
                      onClick={() => {
                        if (exportTarget === "selected") {
                          setSelectedExportIds(prev => ({ ...prev, [b.id]: !prev[b.id] }));
                        } else {
                          setActiveArtboardId(b.id);
                        }
                      }}
                    >
                      {/* Modern Custom Checkbox */}
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${isSelected
                            ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]'
                            : 'bg-[#121212] border-[#2A2A2A] hover:border-[#444]'
                          } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isSelected && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
                      </div>

                      {/* Info details */}
                      <div className="flex-1 min-w-0" onClick={(e) => {
                        if (exportTarget === "selected") {
                          setActiveArtboardId(b.id);
                          e.stopPropagation();
                        }
                      }}>
                        <div className={`text-[11px] font-extrabold tracking-tight truncate ${isActive ? 'text-blue-400 font-black' : 'text-slate-300'}`}>
                          {b.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <span className="opacity-50 font-sans font-bold">DIM:</span>
                          <span className="text-slate-400 font-semibold">{b.width} × {b.height}</span>
                        </div>
                      </div>

                      {/* Beautiful active badge status */}
                      {isActive && (
                        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="text-[8px] font-black uppercase text-blue-400 tracking-wider">Active</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resize Section Toggle */}
          <div className="space-y-4">
            <ResizeSettings
              options={settings.resize}
              onChange={(opt) => onChange({ ...settings, resize: { ...settings.resize, ...opt } })}
              originalWidth={originalWidth}
              originalHeight={originalHeight}
              mode={uiMode}
            />
          </div>

          <div className="h-px bg-[#222] hidden md:block" />

          {/* Dynamic Codec Settings */}
          <div className="space-y-4 animate-in fade-in duration-300">
            {settings.format === 'jpeg' && (
              <MozjpegSettings
                options={settings.mozjpeg}
                onChange={(opt) => updateCodecSettings('mozjpeg', opt)}
                mode={uiMode}
              />
            )}
            {settings.format === 'webp' && (
              <WebpSettings
                options={settings.webp}
                onChange={(opt) => updateCodecSettings('webp', opt)}
                mode={uiMode}
              />
            )}
            {settings.format === 'avif' && (
              <AvifSettings
                options={settings.avif}
                onChange={(opt) => updateCodecSettings('avif', opt)}
                mode={uiMode}
              />
            )}
            {settings.format === 'png' && (
              <PngSettings
                options={settings.png}
                onChange={(opt) => updateCodecSettings('png', opt)}
                mode={uiMode}
              />
            )}
            {settings.format === 'jxl' && (
              <JxlSettings
                options={settings.jxl}
                onChange={(opt) => updateCodecSettings('jxl', opt)}
                mode={uiMode}
              />
            )}
          </div>

          <div className="h-px bg-[#222] hidden md:block" />
        </div>

        {/* Presets List */}
        <div className={`space-y-3 ${!showAdvancedMobile ? 'hidden md:block' : 'block'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Package size={14} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Presets</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['100% Original HQ', 'Maximum Quality', 'Web Optimized', 'Extreme Compression', 'Social Media', 'Thumbnail'].map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`p-2 border rounded-lg text-[10px] text-left transition-all min-h-[40px] md:min-h-0 touch-manipulation ${
                  p === '100% Original HQ' 
                  ? 'border-blue-500/60 bg-blue-600/10 text-blue-300 font-bold hover:bg-blue-600/20' 
                  : 'border-[#222] bg-[#141414] hover:border-blue-500/50 hover:bg-[#1A1A1A] text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Display */}
        <div className="pt-0 md:pt-2">
          <MetricsPanel
            originalSize={originalSize}
            optimizedSize={optimizedSize}
            originalWidth={originalWidth}
            originalHeight={originalHeight}
            optimizedWidth={settings.resize.enabled ? settings.resize.width : originalWidth}
            optimizedHeight={settings.resize.enabled ? settings.resize.height : originalHeight}
            format={settings.format}
            psnr={psnr}
          />
        </div>
      </div>

      {/* Footer Export Button */}
      <div className="p-2 md:p-4 bg-[#111] border-t border-[#222] sticky bottom-0 z-20 space-y-1.5 md:space-y-3 shrink-0">
        <label className={`flex items-center gap-2 md:gap-3 cursor-pointer group bg-[#161616] p-2 md:p-2.5 rounded-lg md:rounded-xl border border-[#222] hover:border-blue-500/20 transition-all select-none ${!showAdvancedMobile ? 'hidden md:flex' : 'flex'}`}>
          <div className="relative flex items-center justify-center shrink-0">
            <input
              type="checkbox"
              checked={settings.askForFilename || false}
              onChange={(e) => onChange({ ...settings, askForFilename: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              settings.askForFilename 
              ? 'bg-blue-600 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]' 
              : 'bg-[#121212] border-[#2A2A2A] group-hover:border-[#444]'
            }`}>
              {settings.askForFilename && <Check size={11} className="text-white stroke-[3.5] animate-in zoom-in-50" />}
            </div>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] text-slate-300 md:text-slate-400 group-hover:text-slate-200 transition-colors font-bold uppercase tracking-tight truncate">Ask for Custom Filename</span>
            <span className="text-[8px] md:text-[9px] text-slate-500 md:text-slate-600 truncate">Prompt for name on export (otherwise auto-generates random string)</span>
          </div>
        </label>
        
        <button
          onClick={onExport}
          disabled={isExporting}
          className={`w-full group relative overflow-hidden h-[42px] md:h-12 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 transition-all touch-manipulation ${isExporting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98]'
            }`}
        >
          {isExporting ? <RotateCw className="animate-spin" size={16} /> : <Download size={16} className="md:w-[18px] md:h-[18px] group-hover:-translate-y-1 transition-transform" />}
          <span className="tracking-tight text-[12px]">{isExporting ? 'Processing...' : `Process & Download`}</span>
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
        </button>
      </div>
    </div>
  );
};
