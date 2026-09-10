import React, { useMemo, useRef, useState } from 'react';
import {
  SquareDashed, Circle, PenTool, Trash2, Scissors, PaintBucket, Frame, X, Bookmark,
  Move, RotateCw, RotateCcw, Maximize2, Minimize2, Wand2, CopyPlus, Layers2,
  Sparkles, Loader2, AlertTriangle, Focus, Contrast, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Minus, Plus, Lock, CheckCircle2, Brush, Shapes, PlusCircle, MinusCircle, Eraser
} from 'lucide-react';
import { SelectionToolId, SavedSelection, RegionFilter, SelectionShape } from '../../selection/types';
import { AutoSelectDetail, AutoSelectRequest, AutoSelectStage } from '../../selection/useImageSelection';
import { getShapeBBox } from '../../selection/geometry';
import { PanelSection, Label, RangeSlider } from '../shared/PanelPrimitives';
import { ColorPickerTrigger } from '../shared/ColorPickers';
import { ModelDownloadGate } from '../shared/ModelDownloadGate';
import CustomSelect from '../../../CustomSelect';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { useModelDownload } from '../../../../ai/hooks/useModelDownload';

interface Props {
  activeSelectionTool: SelectionToolId | null;
  setActiveSelectionTool: (t: SelectionToolId | null) => void;
  hasSelection: boolean;
  /** The live shape, for the status readout. */
  selection?: SelectionShape | null;
  clearSelection: () => void;
  commitPenPath: () => boolean;
  savedShapes: SavedSelection[];
  saveCurrentShape: (name?: string) => void;
  loadSavedShape: (id: string) => void;
  deleteSavedShape: (id: string) => void;
  deleteSelectedPixels: () => void;
  fillSelection: (color: string) => void;
  replaceSelection: (image: CanvasImageSource, fit?: 'cover' | 'contain' | 'stretch') => void;
  filterSelection: (filter: RegionFilter, value: number) => void;
  copySelectionToLayer: () => void;
  moveSelection: (dx: number, dy: number) => void;
  scaleSelection: (factor: number) => void;
  expandSelection: (amount: number) => void;
  rotateSelection: (degrees: number) => void;
  fillColor: string;
  setFillColor: (c: string) => void;
  /** Swaps the selected region for everything else on the layer. Calling it again restores. */
  invertSelection: () => boolean;
  /** True while the selection is showing the inverse of what was drawn. */
  isInverted: boolean;
  /** Which way a swipe pushes the selection; follows the armed tool. */
  brushMode: 'add' | 'subtract';
  /** Brush width in screen pixels. */
  brushSize: number;
  setBrushSize: (px: number) => void;
  minBrushSize: number;
  maxBrushSize: number;
  /** Turns the object selected on the canvas into a selection. */
  convertObjectToSelection: (mode?: 'add' | 'subtract') => boolean;
  /** Segments an object and turns the result into a selection. */
  autoSelectObject: (request?: AutoSelectRequest) => Promise<boolean>;
  cancelAutoSelect: () => void;
  isAutoSelecting: boolean;
  autoSelectStage: AutoSelectStage | null;
  autoSelectError: string | null;
  clearAutoSelectError: () => void;
  autoSelectModelId: string;
  setAutoSelectModelId: (id: string) => void;
}

const TOOLS: { id: SelectionToolId; label: string; icon: React.ReactNode; hint: string; ai?: boolean }[] = [
  { id: 'sel-rect', label: 'Marquee', icon: <SquareDashed size={17} />, hint: 'Drag a rectangular region' },
  { id: 'sel-ellipse', label: 'Ellipse', icon: <Circle size={17} />, hint: 'Drag an elliptical region' },
  { id: 'sel-pen', label: 'Pen', icon: <PenTool size={17} />, hint: 'Click points, then Alt+Enter or click the first point to close' },
  { id: 'sel-object', label: 'Object', icon: <Wand2 size={17} />, hint: 'Tap an object, or drag a box around it, and the AI traces its outline', ai: true },
  { id: 'sel-brush', label: 'Brush', icon: <Brush size={17} />, hint: 'Paint to grow the selection. Hold Alt to erase for one stroke' },
  { id: 'sel-erase', label: 'Erase', icon: <Eraser size={17} />, hint: 'Paint to cut away part of the selection. Hold Alt to add for one stroke' }
];

const DETAIL_LEVELS: { id: AutoSelectDetail; label: string; hint: string }[] = [
  { id: 'smooth', label: 'Smooth', hint: 'Fewest points - soft, rounded outline' },
  { id: 'balanced', label: 'Balanced', hint: 'Follows the object without chasing noise' },
  { id: 'detailed', label: 'Detailed', hint: 'Hugs the mask exactly, including its rough edges' }
];

const REGION_FILTERS: { id: RegionFilter; label: string; value: number }[] = [
  { id: 'grayscale', label: 'B&W', value: 100 },
  { id: 'blur', label: 'Blur', value: 6 },
  { id: 'brightness', label: 'Bright', value: 135 },
  { id: 'contrast', label: 'Contrast', value: 145 },
  { id: 'saturate', label: 'Vivid', value: 180 },
  { id: 'sepia', label: 'Sepia', value: 90 },
  { id: 'invert', label: 'Invert', value: 100 }
];

const SCALE_STEPS = [0.5, 1.5, 2];

const SHAPE_ICON: Record<string, React.ReactNode> = {
  rect: <SquareDashed size={12} />,
  ellipse: <Circle size={12} />,
  path: <PenTool size={12} />
};

/**
 * Whether one model is on the device, shown against its row in the picker so the cost of
 * switching is visible before the switch, not after.
 */
const ModelStatusDot: React.FC<{ modelId: string }> = ({ modelId }) => {
  const { status, progress } = useModelDownload(modelId);
  const tone = status === 'ready' ? 'bg-emerald-500'
    : status === 'downloading' ? 'bg-blue-500 animate-pulse'
      : status === 'error' ? 'bg-red-500'
        : status === 'checking' ? 'bg-slate-300 dark:bg-zinc-600 animate-pulse'
          : 'bg-amber-400';
  const title = status === 'ready' ? 'On this device'
    : status === 'downloading' ? `Downloading ${progress}%`
      : status === 'error' ? 'Unavailable'
        : status === 'checking' ? 'Checking…'
          : 'Not downloaded yet';
  return <span title={title} aria-label={title} className={`inline-block w-2 h-2 rounded-full ${tone}`} />;
};

/** Plain words for the stage a run is at; a bare spinner cannot distinguish a 176 MB download. */
const stageLabel = (stage: AutoSelectStage | null): string => {
  switch (stage?.state) {
    case 'queued': return 'Queued…';
    case 'downloading': return `Downloading model… ${Math.round(stage.progress)}%`;
    case 'loading-model': return 'Loading model…';
    case 'preparing-image': return 'Preparing pixels…';
    case 'inference': return 'Finding the object…';
    case 'post-processing':
    case 'encoding': return 'Tracing the outline…';
    default: return 'Working…';
  }
};

/**
 * A section whose controls need a live selection.
 *
 * Dimming alone reads as a rendering fault, so the header says why the body is inert. The controls
 * stay mounted rather than disappearing, which keeps the panel from reflowing every time a
 * selection appears or goes away.
 */
const GatedSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  locked?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, locked, children }) => (
  <PanelSection
    icon={icon}
    title={
      <div className="flex items-center justify-between w-full gap-2">
        <span>{title}</span>
        {locked && (
          <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-white/10 normal-case">
            <Lock size={9} /> Needs a selection
          </span>
        )}
      </div>
    }
  >
    <div className={locked ? 'opacity-40 pointer-events-none select-none' : ''} aria-disabled={locked}>
      {children}
    </div>
  </PanelSection>
);

/** Primary/secondary/destructive action, on a consistent 36px row. */
const Action: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: 'default' | 'danger' | 'primary' | 'ai';
  title?: string;
  className?: string;
}> = ({ onClick, icon, label, tone = 'default', title, className = '' }) => {
  const tones = {
    default: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-500/50',
    primary: 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/25 hover:bg-blue-500',
    ai: 'bg-gradient-to-r from-violet-600 to-blue-600 border-violet-500/30 text-white shadow-sm shadow-violet-500/25 hover:from-violet-500 hover:to-blue-500'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className={`h-9 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] touch-manipulation ${tones[tone]} ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
};

/** Icon button, optionally captioned so a row of bare glyphs still reads unambiguously. */
const PadButton: React.FC<{
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  caption?: string;
}> = ({ onClick, title, icon, caption }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`${caption ? 'h-12 flex-col gap-0.5' : 'h-9'} rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center transition-all active:scale-[0.97] touch-manipulation`}
  >
    {icon}
    {caption && <span className="text-[8px] font-bold uppercase tracking-wide">{caption}</span>}
  </button>
);

/** Segmented control matching the one the other inspector panels use. */
const Segmented: React.FC<{
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string; title?: string }[];
}> = ({ value, onChange, options }) => (
  <div
    className="grid gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5"
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    role="group"
  >
    {options.map(o => {
      const active = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={active}
          onClick={() => onChange(o.id)}
          className={`h-7 rounded-md text-[10px] font-semibold transition-all active:scale-95 ${active
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
            : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export const SelectionTab: React.FC<Props> = ({
  activeSelectionTool, setActiveSelectionTool, hasSelection, selection, clearSelection, commitPenPath,
  savedShapes, saveCurrentShape, loadSavedShape, deleteSavedShape,
  deleteSelectedPixels, fillSelection, replaceSelection, filterSelection, copySelectionToLayer,
  moveSelection, scaleSelection, expandSelection, rotateSelection,
  fillColor, setFillColor,
  invertSelection, isInverted,
  brushMode, brushSize, setBrushSize, minBrushSize, maxBrushSize,
  convertObjectToSelection,
  autoSelectObject, cancelAutoSelect, isAutoSelecting, autoSelectStage, autoSelectError,
  clearAutoSelectError, autoSelectModelId, setAutoSelectModelId
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [nudge, setNudge] = useState(10);
  const [detail, setDetail] = useState<AutoSelectDetail>('balanced');
  // The matting models double as object segmenters: their alpha output is the mask being traced.
  const segModels = useMemo(() => modelRegistry.getForTask('background-removal'), []);
  const modelOptions = useMemo(
    () => segModels.map(m => ({ value: m.id, label: m.name, icon: <ModelStatusDot modelId={m.id} /> })),
    [segModels]
  );
  const objectToolArmed = activeSelectionTool === 'sel-object';
  const brushArmed = activeSelectionTool === 'sel-brush' || activeSelectionTool === 'sel-erase';
  const box = selection ? getShapeBBox(selection) : null;
  // Only surfaced when the conversion finds nothing to convert, which is otherwise silent.
  const [convertNote, setConvertNote] = useState<string | null>(null);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => replaceSelection(img, 'cover');
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  return (
    <div className="p-4 space-y-3 text-slate-700 dark:text-[#C0C0C0] font-sans">

      {/* Tool strip. Deliberately not boxed like the sections below it: this is the one control
          that is always live, so it should read as a toolbar rather than as another setting. */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5">
          {TOOLS.map(t => {
            const active = activeSelectionTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                aria-pressed={active}
                onClick={() => setActiveSelectionTool(active ? null : t.id)}
                className={`h-14 px-0.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide transition-all active:scale-[0.96] touch-manipulation ${active
                  ? t.ai
                    // Violet for the AI tool, matching the tint the canvas shows while it thinks.
                    ? 'bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25'
                    // Red for erase, the same colour its brush trail paints on the canvas.
                    : t.id === 'sel-erase'
                      ? 'bg-red-600 text-white shadow-md shadow-red-500/25'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {activeSelectionTool === 'sel-pen' && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30">
            <p className="flex-1 text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
              Click to place points, then close with{' '}
              <kbd className="px-1 py-0.5 rounded bg-white/70 dark:bg-black/30 font-mono text-[9px]">Alt</kbd>
              <span className="mx-0.5">+</span>
              <kbd className="px-1 py-0.5 rounded bg-white/70 dark:bg-black/30 font-mono text-[9px]">Enter</kbd>
            </p>
            <button
              type="button"
              onClick={() => commitPenPath()}
              className="shrink-0 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-colors active:scale-95"
            >
              Close Path
            </button>
          </div>
        )}

        {objectToolArmed && (
          <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/30">
            <p className="text-[10px] text-violet-700 dark:text-violet-300 leading-relaxed">
              <b>Tap an object</b> to select just that one, or <b>drag a box</b> around it to tell the
              model where to look. The box is never kept — only the outline it finds.
            </p>
          </div>
        )}

        {brushArmed && (
          <div className="p-2.5 space-y-2.5 rounded-xl bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2A2A2A] shadow-sm">
            {/* A second way to reach the same two tools, next to the size they share. */}
            <div className="grid grid-cols-2 gap-1">
              {([
                { tool: 'sel-brush', mode: 'add', label: 'Add', icon: <PlusCircle size={13} />, hint: 'Paint to grow the selection' },
                { tool: 'sel-erase', mode: 'subtract', label: 'Deselect', icon: <MinusCircle size={13} />, hint: 'Paint to cut away part of the selection' }
              ] as const).map(m => {
                const on = activeSelectionTool === m.tool;
                return (
                  <button
                    key={m.tool}
                    type="button"
                    title={m.hint}
                    aria-pressed={on}
                    onClick={() => setActiveSelectionTool(m.tool)}
                    className={`h-9 rounded-lg border flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all active:scale-[0.97] touch-manipulation ${on
                      ? m.mode === 'add'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/25'
                        : 'bg-red-600 border-red-500 text-white shadow-sm shadow-red-500/25'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'}`}
                  >
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>

            <RangeSlider
              label="Brush Size"
              valueDisplay={brushSize}
              displayUnit="px"
              min={minBrushSize}
              max={maxBrushSize}
              step={1}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />

            <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-relaxed">
              {brushMode === 'add'
                ? 'Paint over the image to grow the selection.'
                : 'Paint over the selection to cut parts of it away.'}{' '}
              Hold{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-black/30 font-mono text-[9px]">Alt</kbd>{' '}
              to use the other brush for a single stroke — on touch, tap the buttons above instead.
            </p>
          </div>
        )}

        {/* Always available: on touch there is no Alt+Enter, and a painted shape is the one thing
            here that comes from a different tool entirely. */}
        <button
          type="button"
          onClick={() => {
            if (!convertObjectToSelection()) {
              setConvertNote('Select a shape on the canvas first — a brush stroke, path or any drawn object.');
              window.setTimeout(() => setConvertNote(null), 4000);
            } else {
              setConvertNote(null);
            }
          }}
          title="Turn the object selected on the canvas into a selection"
          className="w-full h-9 px-2.5 rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/60 dark:bg-white/[0.03] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/30 flex items-center justify-center gap-2 text-[11px] font-semibold transition-all active:scale-[0.98] touch-manipulation"
        >
          <Shapes size={14} className="shrink-0" />
          <span className="truncate">Drawn Shape → Selection</span>
          <kbd className="shrink-0 px-1 py-0.5 rounded bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 font-mono text-[9px]">Alt+↵</kbd>
        </button>

        {convertNote && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">{convertNote}</span>
          </div>
        )}

        {/* Status line: what is selected, and the three actions that act on the region itself. */}
        <div className="flex items-center gap-2 h-11 pl-3 pr-1.5 rounded-xl border bg-white dark:bg-[#181818] border-slate-200 dark:border-[#2A2A2A] shadow-sm">
          {hasSelection ? (
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
          ) : (
            <span className="shrink-0 w-3.5 flex justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-700" />
            </span>
          )}

          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">
              {hasSelection ? 'Region selected' : 'No selection'}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 truncate">
                {box
                  ? `${selection?.kind} · ${Math.round(box.width)} × ${Math.round(box.height)} px`
                  : 'Pick a tool above to draw one'}
              </span>
              {hasSelection && isInverted && (
                <span className="shrink-0 px-1.5 rounded-full text-[8px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  Inverted
                </span>
              )}
            </div>
          </div>

          {hasSelection && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => invertSelection()}
                aria-pressed={isInverted}
                title={isInverted
                  ? 'Inverted — click to go back to the region you drew'
                  : 'Invert — select everything on the layer except this region'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors active:scale-95 touch-manipulation ${isInverted
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 hover:bg-amber-400'
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Contrast size={14} className={isInverted ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              <button
                type="button"
                onClick={() => saveCurrentShape()}
                title="Save this shape for later"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors active:scale-95 touch-manipulation"
              >
                <Bookmark size={14} />
              </button>
              <button
                type="button"
                onClick={clearSelection}
                title="Deselect"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors active:scale-95 touch-manipulation"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto selection. Whatever the model finds becomes an ordinary path selection, so every
          other section of this panel operates on it exactly as on a hand-drawn one. */}
      <PanelSection
        icon={<Sparkles size={14} className="text-violet-500 dark:text-violet-400" />}
        title={
          <div className="flex items-center justify-between w-full gap-2">
            <span>AI Object Select</span>
            <CustomSelect
              variant="toolbar"
              value={autoSelectModelId}
              options={modelOptions}
              onChange={(id) => { setAutoSelectModelId(id); clearAutoSelectError(); }}
              disabled={isAutoSelecting}
              className="shrink-0 max-w-[150px] normal-case"
              placeholder="Model"
            />
          </div>
        }
      >
        {/* Deliberately outside the gate below: tapping the canvas with the Object tool runs
            without ever passing through it, and a model that has to be fetched at that moment
            must still say so here rather than downloading in silence. */}
        {isAutoSelecting ? (
          <div className="p-2.5 space-y-2 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-950/30">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="shrink-0 animate-spin text-violet-600 dark:text-violet-400" />
              <span className="flex-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 truncate">
                {stageLabel(autoSelectStage)}
              </span>
              <button
                type="button"
                onClick={cancelAutoSelect}
                className="shrink-0 h-7 px-2.5 rounded-md border border-red-300 dark:border-red-500/40 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition-colors touch-manipulation"
              >
                Cancel
              </button>
            </div>
            {autoSelectStage?.state === 'downloading' && (
              <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-500/15 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(autoSelectStage.progress, 2)}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <ModelDownloadGate modelId={autoSelectModelId} label="Object Segmentation">
            <div className="space-y-2">
              <Action
                onClick={() => { clearAutoSelectError(); void autoSelectObject({ detail }); }}
                icon={<Sparkles size={14} />}
                label="Select Subject"
                tone="ai"
                title="Trace the main subject of this layer"
                className="w-full h-10"
              />
              <Action
                onClick={() => setActiveSelectionTool(objectToolArmed ? null : 'sel-object')}
                icon={<Focus size={14} />}
                label={objectToolArmed ? 'Picking on canvas…' : 'Pick an Object on Canvas'}
                title="Then tap an object on the canvas, or drag a box around it"
                className={`w-full ${objectToolArmed ? 'border-violet-400 dark:border-violet-500/60 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30' : ''}`}
              />
            </div>
          </ModelDownloadGate>
        )}

        <div>
          <Label>Edge Detail</Label>
          <Segmented
            value={detail}
            onChange={(id) => setDetail(id as AutoSelectDetail)}
            options={DETAIL_LEVELS.map(l => ({ id: l.id, label: l.label, title: l.hint }))}
          />
        </div>

        {autoSelectError && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">{autoSelectError}</span>
            <button
              type="button"
              onClick={clearAutoSelectError}
              title="Dismiss"
              className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </PanelSection>

      {/* Moves the region itself. No pixels change until a section further down is used. */}
      <GatedSection
        title="Transform Selection"
        icon={<Move size={14} className="text-slate-500 dark:text-zinc-400" />}
        locked={!hasSelection}
      >
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">Nudge</span>
              <div className="flex items-center h-6 rounded-md border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNudge(n => Math.max(1, n - 1))}
                  title="Smaller step"
                  className="w-6 h-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  <Minus size={10} />
                </button>
                <input
                  type="number"
                  min={1}
                  value={nudge}
                  onChange={(e) => setNudge(Math.max(1, Number(e.target.value) || 1))}
                  title="Step size in pixels"
                  aria-label="Step size in pixels"
                  className="w-9 h-full bg-transparent text-center text-[10px] font-mono font-semibold text-slate-800 dark:text-white outline-none"
                />
                <span className="pr-1 text-[9px] font-mono text-slate-400 dark:text-zinc-500">px</span>
                <button
                  type="button"
                  onClick={() => setNudge(n => n + 1)}
                  title="Larger step"
                  className="w-6 h-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <span />
              <PadButton onClick={() => moveSelection(0, -nudge)} title={`Move up ${nudge}px`} icon={<ArrowUp size={14} />} />
              <span />
              <PadButton onClick={() => moveSelection(-nudge, 0)} title={`Move left ${nudge}px`} icon={<ArrowLeft size={14} />} />
              <div className="h-9 rounded-lg border border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-300 dark:text-zinc-700">
                <Move size={13} />
              </div>
              <PadButton onClick={() => moveSelection(nudge, 0)} title={`Move right ${nudge}px`} icon={<ArrowRight size={14} />} />
              <span />
              <PadButton onClick={() => moveSelection(0, nudge)} title={`Move down ${nudge}px`} icon={<ArrowDown size={14} />} />
              <span />
            </div>
          </div>

          <div>
            <Label>Grow &amp; Rotate</Label>
            <div className="grid grid-cols-4 gap-1.5">
              <PadButton onClick={() => expandSelection(nudge)} title={`Grow by ${nudge}px`} icon={<Maximize2 size={14} />} caption="Grow" />
              <PadButton onClick={() => expandSelection(-nudge)} title={`Shrink by ${nudge}px`} icon={<Minimize2 size={14} />} caption="Shrink" />
              <PadButton onClick={() => rotateSelection(-15)} title="Rotate 15 degrees left" icon={<RotateCcw size={14} />} caption="-15°" />
              <PadButton onClick={() => rotateSelection(15)} title="Rotate 15 degrees right" icon={<RotateCw size={14} />} caption="+15°" />
            </div>
          </div>

          <div>
            <Label>Scale</Label>
            {/* No persistent value: each press scales the current shape, it is not a mode. */}
            <Segmented
              value=""
              onChange={(id) => scaleSelection(Number(id))}
              options={SCALE_STEPS.map(f => ({
                id: String(f),
                label: `${f * 100}%`,
                title: `Scale the selection to ${f * 100}% about its centre`
              }))}
            />
          </div>
        </div>
      </GatedSection>

      <GatedSection
        title="Apply to Selection"
        icon={<Wand2 size={14} className="text-slate-500 dark:text-zinc-400" />}
        locked={!hasSelection}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Action onClick={deleteSelectedPixels} icon={<Scissors size={14} />} label="Cut Out" tone="danger" title="Erase the selected pixels, leaving transparency" />
            <Action onClick={copySelectionToLayer} icon={<CopyPlus size={14} />} label="To Layer" title="Lift the region onto its own layer" />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-2 h-9 flex-1 min-w-0 pl-1.5 pr-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div
                className="w-6 h-6 rounded-md shrink-0 border border-black/10 dark:border-white/20 shadow-inner relative overflow-hidden"
                style={{ backgroundColor: fillColor }}
              >
                <ColorPickerTrigger
                  color={fillColor}
                  onChange={setFillColor}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  label="Fill colour"
                />
              </div>
              <span className="font-mono text-[10px] uppercase text-slate-600 dark:text-zinc-400 truncate">{fillColor}</span>
            </div>
            <Action onClick={() => fillSelection(fillColor)} icon={<PaintBucket size={14} />} label="Fill" className="w-24 shrink-0" title="Fill the region with the chosen colour" />
          </div>

          <Action onClick={() => fileRef.current?.click()} icon={<Frame size={14} />} label="Mask in an Image" className="w-full" title="Use the region as a window onto another image" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
      </GatedSection>

      {/* Region filters. The Filters tab acts on a whole object; these touch only the selection. */}
      <GatedSection
        title="Filter the Region"
        icon={<Layers2 size={14} className="text-slate-500 dark:text-zinc-400" />}
        locked={!hasSelection}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {REGION_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => filterSelection(f.id, f.value)}
                title={`Apply ${f.label} to the selected region only`}
                className="h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-all active:scale-[0.97] touch-manipulation"
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 dark:text-zinc-500 leading-relaxed">
            These bake into the image so the region keeps its own look. The Filters tab still applies
            to the whole layer.
          </p>
        </div>
      </GatedSection>

      <PanelSection
        icon={<Bookmark size={14} className="text-slate-500 dark:text-zinc-400" />}
        title={
          <div className="flex items-center justify-between w-full gap-2">
            <span>Saved Shapes</span>
            <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
              {savedShapes.length}
            </span>
          </div>
        }
      >
        {savedShapes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
            <Bookmark size={18} className="text-slate-300 dark:text-zinc-700" />
            <p className="px-4 text-[10px] text-center text-slate-400 dark:text-zinc-500 leading-relaxed">
              Nothing saved yet. Draw a region and press the bookmark above to keep it here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {savedShapes.map(s => {
              const saved = getShapeBBox(s.shape);
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadSavedShape(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSavedShape(s.id); } }}
                  className="group flex items-center gap-2.5 h-12 px-2 rounded-lg border border-transparent bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 cursor-pointer transition-all outline-none focus-visible:border-blue-500"
                >
                  <span className="w-7 h-7 shrink-0 rounded-md bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                    {SHAPE_ICON[s.shape.kind]}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-semibold capitalize truncate text-slate-800 dark:text-zinc-200">{s.name}</span>
                    <span className="block text-[9px] font-mono text-slate-400 dark:text-zinc-500">
                      {Math.round(saved.width)} × {Math.round(saved.height)} px
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSavedShape(s.id); }}
                    title="Remove saved shape"
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors touch-manipulation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </div>
  );
};
