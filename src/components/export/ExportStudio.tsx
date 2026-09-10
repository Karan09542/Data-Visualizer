
import React, { useCallback, useState } from 'react';
import {
  Zap,
  Download,
  RotateCw,
  Layers,
  Check,
  ChevronDown,
  FileImage,
  Sliders,
  Maximize2,
  Sparkles,
  BarChart3
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
import { getNativeScaleForBoard } from '../image-workspace/services/exportUtils';
import { ToggleSwitch } from '../image-workspace/components/shared/PanelPrimitives';

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
  /** Used to work out how much detail the placed images still hold. */
  fabricCanvas?: any;
}

type SectionId = 'format' | 'quality' | 'size' | 'boards' | 'presets' | 'stats';

const SECTIONS_KEY = 'export_studio_sections_v2';
const DEFAULT_OPEN: SectionId[] = ['format', 'quality', 'size'];

const FORMATS: { id: ExportFormat; hint: string }[] = [
  { id: 'jpeg', hint: 'Photos · small files, no transparency' },
  { id: 'png', hint: 'Lossless · keeps transparency' },
  { id: 'webp', hint: 'Web · small files with transparency' },
  { id: 'avif', hint: 'Smallest files · slower to encode' },
  { id: 'jxl', hint: 'Next-gen · lossless or lossy' }
];

const PRESETS = ['100% Original HQ', 'Maximum Quality', 'Web Optimized', 'Extreme Compression', 'Social Media', 'Thumbnail'];

const TARGETS: { id: "current" | "selected" | "all"; label: string }[] = [
  { id: 'current', label: 'Active' },
  { id: 'selected', label: 'Selected' },
  { id: 'all', label: 'All Boards' }
];

const formatBytes = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Collapsible block. Each header keeps a one-line summary of what the section is set to, so a
 * closed section still answers "what will I get" and the column stays short enough that the export
 * button is never more than a scroll away on a phone.
 */
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon, title, summary, open, onToggle, children }) => (
  <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161616] overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full h-11 px-3 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors touch-manipulation"
    >
      <span className="shrink-0 text-blue-500">{icon}</span>
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</span>
      <span className="flex-1 min-w-0 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
        {!open && summary}
      </span>
      <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && (
      <div className="px-3 pb-3 pt-2.5 space-y-3 border-t border-slate-100 dark:border-white/5">
        {children}
      </div>
    )}
  </section>
);

/** Segmented control shared by every either/or row. */
function Segmented<T extends string | number>({
  value, options, onChange, size = 'md'
}: {
  value: T;
  options: { id: T; label: React.ReactNode; title?: string }[];
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className="grid gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="group"
    >
      {options.map(o => {
        const active = value === o.id;
        return (
          <button
            key={String(o.id)}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`${size === 'sm' ? 'h-7' : 'h-8'} rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors touch-manipulation truncate px-1 ${active
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
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
  setSelectedExportIds,
  fabricCanvas
}) => {
  const [uiMode, setUiMode] = useState<'basic' | 'advanced' | 'expert'>('basic');

  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => {
    try {
      const stored = localStorage.getItem(SECTIONS_KEY);
      if (stored) return new Set(JSON.parse(stored) as SectionId[]);
    } catch { /* fall back to the defaults */ }
    return new Set<SectionId>(DEFAULT_OPEN);
  });

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify([...next])); } catch { /* storage may be unavailable */ }
      return next;
    });
  }, []);

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
  const exportScale = settings.exportScale || 1;
  // How far the sharpest placed image is being scaled down for display.
  const nativeScale = React.useMemo(
    () => (fabricCanvas && activeBoard ? getNativeScaleForBoard(fabricCanvas, activeBoard) : 1),
    [fabricCanvas, activeBoard, settings.format]
  );
  const matchedPreset = activeBoard ? PRESET_REGISTRY.find(p => p.name === activeBoard.name) : null;
  const recommendation = matchedPreset?.exportRecommendation;
  void recommendation;

  // ---------------------------------------------------------------- read-only summaries
  const formatLabel = settings.format.toUpperCase();
  const formatHint = FORMATS.find(f => f.id === settings.format)?.hint || '';

  const outputDims = settings.resize.enabled
    ? `${settings.resize.width} × ${settings.resize.height}`
    : activeBoard
      ? `${Math.round(activeBoard.width * exportScale)} × ${Math.round(activeBoard.height * exportScale)}`
      : '—';

  const selectedCount = Object.values(selectedExportIds).filter(Boolean).length;
  const boardCount = exportTarget === 'all' ? artboards.length : exportTarget === 'selected' ? selectedCount : 1;
  const targetSummary =
    exportTarget === 'all' ? `All ${artboards.length} boards`
      : exportTarget === 'selected' ? `${selectedCount} selected`
        : (activeBoard?.name || 'Active board');

  const sizeText = formatBytes(optimizedSize);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50 dark:bg-[#0D0D0D] border-l border-slate-200 dark:border-white/10">

      {/* ------------------------------------------------------------ header */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 space-y-2.5 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Zap size={15} />
            </span>
            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-900 dark:text-white truncate">Export</h2>
          </div>
          <div className="shrink-0 w-[168px]">
            <Segmented
              size="sm"
              value={uiMode}
              onChange={(m) => setUiMode(m)}
              options={[
                { id: 'basic', label: 'Basic', title: 'Only the essentials' },
                { id: 'advanced', label: 'Adv', title: 'More encoder controls' },
                { id: 'expert', label: 'Pro', title: 'Every encoder control' }
              ]}
            />
          </div>
        </div>

        {/* What you will get, before opening anything. */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold">
          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white tracking-wider">{formatLabel}</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-mono">{outputDims}</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 truncate max-w-[140px]">{targetSummary}</span>
          {settings.directNativeExport && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">Pixel-perfect</span>
          )}
          {sizeText && (
            <span className="ml-auto px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400 font-mono">≈ {sizeText}</span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2">

        <Section
          icon={<FileImage size={13} />}
          title="Format"
          summary={`${formatLabel}${settings.directNativeExport ? ' · pixel-perfect' : ''}`}
          open={openSections.has('format')}
          onToggle={() => toggleSection('format')}
        >
          <Segmented
            value={settings.format}
            onChange={(fmt) => onChange({ ...settings, format: fmt })}
            options={FORMATS.map(f => ({ id: f.id, label: f.id, title: f.hint }))}
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">{formatHint}</p>

          <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${settings.directNativeExport
            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10'}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-800 dark:text-white">Pixel-perfect export</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Skip lossy compression and export the canvas pixels exactly (Direct High Quality Mode).
              </div>
            </div>
            <ToggleSwitch
              checked={!!settings.directNativeExport}
              onChange={(next) => onChange({ ...settings, directNativeExport: next })}
              title="Direct High Quality Mode"
            />
          </div>
        </Section>

        <Section
          icon={<Sliders size={13} />}
          title="Quality"
          summary={`${formatLabel} settings`}
          open={openSections.has('quality')}
          onToggle={() => toggleSection('quality')}
        >
          <div className="animate-in fade-in duration-200">
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
        </Section>

        <Section
          icon={<Maximize2 size={13} />}
          title="Size"
          summary={outputDims}
          open={openSections.has('size')}
          onToggle={() => toggleSection('size')}
        >
          {/* Output resolution. The artboard is a layout size, not a resolution cap - without
              this a 2048px photo on an 800x600 board exported at 800px wide. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resolution</span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {activeBoard ? `${Math.round(activeBoard.width * exportScale)} × ${Math.round(activeBoard.height * exportScale)}` : '-'}
              </span>
            </div>

            <Segmented
              value={exportScale}
              onChange={(mult) => onChange({ ...settings, exportScale: mult })}
              options={[1, 2, 3, 4].map(mult => ({ id: mult, label: `${mult}x` }))}
            />

            {nativeScale > 1.01 && (
              <button
                type="button"
                onClick={() => onChange({ ...settings, exportScale: nativeScale })}
                className="w-full h-9 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-600/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold transition-colors hover:bg-blue-100 dark:hover:bg-blue-600/20 touch-manipulation"
              >
                Match source detail ({nativeScale.toFixed(2)}x)
              </button>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
              {nativeScale > 1.01
                ? `Your highest-resolution image is being displayed at ${Math.round(100 / nativeScale)}% of its native size. Exporting at 1x throws that detail away.`
                : 'Renders the artboard at a multiple of its pixel size. Disabled while a manual resize is set.'}
            </p>
          </div>

          <div className="h-px bg-slate-100 dark:bg-white/5" />

          <ResizeSettings
            options={settings.resize}
            targetSize={settings.targetSize}
            format={settings.format}
            onChange={(opt) => onChange({ ...settings, resize: { ...settings.resize, ...opt } })}
            onTargetSizeChange={(opt) => onChange({ ...settings, targetSize: opt })}
            originalWidth={originalWidth}
            originalHeight={originalHeight}
            mode={uiMode}
          />
        </Section>

        <Section
          icon={<Layers size={13} />}
          title="Boards"
          summary={targetSummary}
          open={openSections.has('boards')}
          onToggle={() => toggleSection('boards')}
        >
          <Segmented
            value={exportTarget}
            onChange={(t) => setExportTarget(t)}
            options={TARGETS.map(t => ({ id: t.id, label: t.label }))}
          />

          {exportTarget === 'all' && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Every artboard ({artboards.length}) is exported with these settings.
            </p>
          )}

          {(exportTarget === "current" || exportTarget === "selected") && (
            <>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">
                {exportTarget === 'selected'
                  ? 'Tick the boards to export. Tap a name to make it the active board.'
                  : 'Tap a board to export it.'}
              </p>
              <div className="space-y-1 max-h-[190px] overflow-y-auto custom-scrollbar pr-0.5">
                {artboards.map((b) => {
                  const isSelected = exportTarget === "selected" ? !!selectedExportIds[b.id] : activeArtboardId === b.id;
                  const isActive = activeArtboardId === b.id;
                  const isDisabled = exportTarget === "current";

                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (exportTarget === "selected") {
                          setSelectedExportIds(prev => ({ ...prev, [b.id]: !prev[b.id] }));
                        } else {
                          setActiveArtboardId(b.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        if (exportTarget === "selected") {
                          setSelectedExportIds(prev => ({ ...prev, [b.id]: !prev[b.id] }));
                        } else {
                          setActiveArtboardId(b.id);
                        }
                      }}
                      className={`flex items-center gap-2.5 h-11 px-2 rounded-lg cursor-pointer border transition-colors outline-none focus-visible:border-blue-500 touch-manipulation ${isSelected
                        ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-300 dark:border-blue-500/30'
                        : 'bg-slate-50 dark:bg-white/[0.03] border-transparent hover:border-slate-300 dark:hover:border-white/15'}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white dark:bg-[#121212] border-slate-300 dark:border-white/15'} ${isDisabled ? 'opacity-40' : ''}`}
                      >
                        {isSelected && <Check size={10} strokeWidth={4} />}
                      </span>

                      {/* In Selected mode this inner region switches which board is active,
                          independently of the tick - preserved from the previous layout. */}
                      <div
                        className="flex-1 min-w-0"
                        onClick={(e) => {
                          if (exportTarget === "selected") {
                            setActiveArtboardId(b.id);
                            e.stopPropagation();
                          }
                        }}
                      >
                        <div className={`text-[11px] font-bold truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {b.name}
                        </div>
                        <div className="text-[9px] font-mono text-slate-500 truncate">{b.width} × {b.height}</div>
                      </div>

                      {isActive && (
                        <span className="shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20">
                          Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Section>

        <Section
          icon={<Sparkles size={13} />}
          title="Presets"
          summary="One-tap setups"
          open={openSections.has('presets')}
          onToggle={() => toggleSection('presets')}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`min-h-[38px] px-2.5 rounded-lg border text-[10px] font-semibold text-left transition-colors touch-manipulation ${p === '100% Original HQ'
                  ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-600/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-600/20'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500/50 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={<BarChart3 size={13} />}
          title="Stats"
          summary={sizeText ? `≈ ${sizeText}` : 'Not estimated yet'}
          open={openSections.has('stats')}
          onToggle={() => toggleSection('stats')}
        >
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
        </Section>
      </div>

      {/* ------------------------------------------------------------ footer */}
      <div className="shrink-0 p-2.5 space-y-2 bg-white dark:bg-[#121212] border-t border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Ask for a file name</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Otherwise a name is generated automatically</div>
          </div>
          <ToggleSwitch
            checked={!!settings.askForFilename}
            onChange={(next) => onChange({ ...settings, askForFilename: next })}
            showState={false}
            title="Prompt for a file name on export"
          />
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation ${isExporting
            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 active:scale-[0.98]'}`}
        >
          {isExporting ? <RotateCw className="animate-spin" size={16} /> : <Download size={16} />}
          <span className="text-[12px] font-bold tracking-tight">
            {isExporting
              ? 'Processing...'
              : `Export ${formatLabel}${boardCount > 1 ? ` · ${boardCount} boards` : ''}`}
          </span>
        </button>
      </div>
    </div>
  );
};
