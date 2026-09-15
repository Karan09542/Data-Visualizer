import {
  X, Image as ImageIcon, RotateCcw, Keyboard, PenTool, HelpCircle, ChevronDown, AlignLeft,
  Youtube, Mic, Shield, SlidersHorizontal, StickyNote, Search, Check, Music, Sparkles, type LucideIcon,
} from 'lucide-react';
import { useStore, defaultSettings, NodeTheme, EdgeStyle } from '../store/useStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { useVoiceStore } from '../voice/useVoiceStore';
import { VoiceHelpModal } from '../voice/components/VoiceHelpModal';
import { ProxySettingsModal } from './ProxySettingsModal';
import { RgbaColorPicker } from 'react-colorful';
import {
  useState, useRef, useEffect, useLayoutEffect, forwardRef,
  type CSSProperties, type ReactNode, type RefObject, type Dispatch, type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

const canvasThemes = ['none', 'dots', 'grid', 'lines'] as const;
const nodeThemes: NodeTheme[] = ['vscode', 'github', 'glassmorphism', 'cyberpunk', 'minimal', 'gradient', 'pastel', 'terminal', 'material', 'blueprint', 'retro', 'holographic', 'notebook', 'custom', 'nature', 'circuit', 'galaxy', 'glass', 'neon', 'math', 'neural', 'river', 'tree', 'pixel', 'hacker', 'cloud', 'dna', 'lava', 'ocean', 'rhythm', 'rune', 'zen', 'abstract', 'architect', 'ludo', 'chess', 'octopus', 'nature2', 'hydrogen', 'seed', 'banyan', 'peepal', 'chalk'];
const edgeStyles: EdgeStyle[] = ['curved', 'bezier', 'straight', 'step', 'animated', 'dashed', 'neon', 'double', 'pipe', 'thin', 'orgChart', 'circuit', 'glow', 'zigzag', 'pulse', 'ludo', 'chess', 'octopus', 'nature2', 'hydrogen', 'seed', 'metro', 'angled-step'];

const FILL_PRESETS = [
  'rgba(30, 41, 59, 1)', 'rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)', 'rgba(79, 70, 229, 1)',
  'rgba(147, 51, 234, 1)', 'rgba(236, 72, 153, 1)', 'rgba(244, 63, 94, 1)', 'rgba(245, 158, 11, 1)',
  'rgba(20, 184, 166, 1)', 'rgba(255, 255, 255, 1)', 'rgba(10, 10, 10, 1)',
];
const NODE_PICKER_PRESETS = ['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)', 'rgba(239, 68, 68, 1)', 'rgba(139, 92, 246, 1)', 'rgba(236, 72, 153, 1)', 'rgba(20, 184, 166, 1)', 'rgba(100, 116, 139, 1)', 'rgba(255, 255, 255, 1)', 'rgba(0, 0, 0, 1)'];
const TEXT_PICKER_PRESETS = ['rgba(255, 255, 255, 1)', 'rgba(241, 245, 249, 1)', 'rgba(148, 163, 184, 1)', 'rgba(71, 85, 105, 1)', 'rgba(15, 23, 42, 1)', 'rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)', 'rgba(16, 185, 129, 1)', 'rgba(236, 72, 153, 1)'];

const HIDDEN_PICKER: CSSProperties = { position: 'fixed', top: -9999, left: -9999, opacity: 0 };
const PICKER_CLASS = 'rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-[#121A2F] z-[10000]';

const NAME_OVERRIDES: Record<string, string> = { vscode: 'VS Code', github: 'GitHub', dna: 'DNA' };

/** "orgChart" → "Org Chart", "nature2" → "Nature 2", "angled-step" → "Angled Step" */
const formatName = (value: string) =>
  NAME_OVERRIDES[value] ??
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const parseRgba = (color: string) => {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
};

const toHex = (n: number) => n.toString(16).padStart(2, '0');

/** "#3b82f6", plus the opacity when it isn't fully opaque */
const colorLabel = (color: string) => {
  const { r, g, b, a } = parseRgba(color);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? ` · ${Math.round(a * 100)}%` : ''}`;
};

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-2 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ children, divided = false }: { children: ReactNode; divided?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 ${divided ? 'divide-y divide-slate-200 dark:divide-slate-800' : ''}`}
    >
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, activeClass = 'bg-blue-500' }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${checked ? activeClass : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function SettingRow({ icon: Icon, iconClass, title, description, children }: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</div>
        {description && <div className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

function RowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}

function SliderRow({ label, display, value, min, max, step, onChange, onReset, accentClass = 'accent-blue-500', ends, className = 'px-3 py-3' }: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  accentClass?: string;
  ends?: [string, string];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {display}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title={`Reset ${label.toLowerCase()}`}
              aria-label={`Reset ${label.toLowerCase()}`}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700 ${accentClass}`}
      />
      {ends && (
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange, activeTextClass = 'text-blue-600 dark:text-blue-400', label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  activeTextClass?: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950/60">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${active
              ? `bg-white shadow-sm dark:bg-slate-800 ${activeTextClass}`
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Collapsible, searchable list of named options (node themes, link styles) */
function ChoicePicker<T extends string>({ label, value, options, onChange, open, onToggle }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((option) => formatName(option).toLowerCase().includes(needle)) : options;

  return (
    <div className="px-3 py-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            {formatName(value)}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <div className="relative mb-2">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${options.length} ${label.toLowerCase()}s`}
                  aria-label={`Search ${label.toLowerCase()}`}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
                />
              </div>
              <div className="custom-scrollbar grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                {filtered.map((option) => {
                  const active = option === value;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onChange(option)}
                      aria-pressed={active}
                      className={`flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${active
                        ? 'border-blue-500/50 bg-blue-500/10 font-medium text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                        }`}
                    >
                      <span className="truncate">{formatName(option)}</span>
                      {active && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-2 py-4 text-center text-xs text-slate-400">No matches for “{query}”</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Color swatch that opens a picker; shows the color and its hex value */
const SwatchButton = forwardRef<HTMLButtonElement, {
  color: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}>(({ color, label, onClick, active = false, disabled = false, className = '' }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={`${label} color`}
    aria-expanded={active}
    className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active
      ? 'border-blue-500/60 bg-blue-500/5'
      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
      } ${className}`}
  >
    <span className="h-7 w-7 shrink-0 rounded-md shadow-inner ring-1 ring-black/10 dark:ring-white/10" style={{ backgroundColor: color }} />
    <span className="min-w-0">
      <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="block truncate font-mono text-[10px] uppercase text-slate-400">{colorLabel(color)}</span>
    </span>
  </button>
));
SwatchButton.displayName = 'SwatchButton';

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function AdvancedPanel() {
  const isAdvancedPanelOpen = useStore((state) => state.isAdvancedPanelOpen);
  const setIsAdvancedPanelOpen = useStore((state) => state.setIsAdvancedPanelOpen);
  const showMediaPreview = useStore((state) => state.showMediaPreview);
  const setShowMediaPreview = useStore((state) => state.setShowMediaPreview);
  const globalTextExpanded = useStore((state) => state.globalTextExpanded);
  const setGlobalTextExpanded = useStore((state) => state.setGlobalTextExpanded);
  const nodeSpread = useStore((state) => state.nodeSpread);
  const setNodeSpread = useStore((state) => state.setNodeSpread);
  const nodeSize = useStore((state) => state.nodeSize);
  const setNodeSize = useStore((state) => state.setNodeSize);
  const nodeTheme = useStore((state) => state.nodeTheme);
  const setNodeTheme = useStore((state) => state.setNodeTheme);
  const edgeStyle = useStore((state) => state.edgeStyle);
  const setEdgeStyle = useStore((state) => state.setEdgeStyle);
  const nodeColor = useStore((state) => state.nodeColor);
  const setNodeColor = useStore((state) => state.setNodeColor);
  const nodeTextColor = useStore((state) => state.nodeTextColor);
  const setNodeTextColor = useStore((state) => state.setNodeTextColor);
  const nodeGradientColor1 = useStore((state) => state.nodeGradientColor1);
  const setNodeGradientColor1 = useStore((state) => state.setNodeGradientColor1);
  const nodeGradientColor2 = useStore((state) => state.nodeGradientColor2);
  const setNodeGradientColor2 = useStore((state) => state.setNodeGradientColor2);
  const useNodeGradient = useStore((state) => state.useNodeGradient);
  const setUseNodeGradient = useStore((state) => state.setUseNodeGradient);
  const nodeGradientAngle = useStore((state) => state.nodeGradientAngle);
  const setNodeGradientAngle = useStore((state) => state.setNodeGradientAngle);
  const nodeGradientType = useStore((state) => state.nodeGradientType);
  const setNodeGradientType = useStore((state) => state.setNodeGradientType);
  const canvasTheme = useStore((state) => state.canvasTheme);
  const setCanvasTheme = useStore((state) => state.setCanvasTheme);
  const canvasBackgroundColor = useStore((state) => state.canvasBackgroundColor);
  const setCanvasBackgroundColor = useStore((state) => state.setCanvasBackgroundColor);
  const canvasPatternColor = useStore((state) => state.canvasPatternColor);
  const setCanvasPatternColor = useStore((state) => state.setCanvasPatternColor);
  const canvasBackgroundImage = useStore((state) => state.canvasBackgroundImage);
  const setCanvasBackgroundImage = useStore((state) => state.setCanvasBackgroundImage);
  const canvasBackgroundBlur = useStore((state) => state.canvasBackgroundBlur);
  const setCanvasBackgroundBlur = useStore((state) => state.setCanvasBackgroundBlur);
  const resetAllSettings = useStore((state) => state.resetAllSettings);
  const setIsShortcutsOpen = useStore((state) => state.setIsShortcutsOpen);
  const setIsMathHelpOpen = useStore((state) => state.setIsMathHelpOpen);
  const stickyNotesEnabled = useStore((state) => state.stickyNotesEnabled);
  const setStickyNotesEnabled = useStore((state) => state.setStickyNotesEnabled);
  const setIsYoutubeSearchOpen = useStore((state) => state.setIsYoutubeSearchOpen);
  const setIsProxyModalOpen = useStore((state) => state.setIsProxyModalOpen);

  const isToolbarVisible = useAnnotationStore((state) => state.isToolbarVisible);
  const setIsToolbarVisible = useAnnotationStore((state) => state.setIsToolbarVisible);
  const toolbarOpacity = useAnnotationStore((state) => state.toolbarOpacity);
  const setToolbarOpacity = useAnnotationStore((state) => state.setToolbarOpacity);
  const toolbarOrientation = useAnnotationStore((state) => state.toolbarOrientation);
  const setToolbarOrientation = useAnnotationStore((state) => state.setToolbarOrientation);
  const toolbarScale = useAnnotationStore((state) => state.toolbarScale);
  const setToolbarScale = useAnnotationStore((state) => state.setToolbarScale);
  const resetPreferences = useAnnotationStore((state) => state.resetPreferences);

  const isVoiceEnabled = useVoiceStore((state) => state.isVoiceEnabled);
  const setIsVoiceEnabled = useVoiceStore((state) => state.setIsVoiceEnabled);
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);

  // Resizable panel width (desktop only)
  const [panelWidth, setPanelWidth] = useState(380);
  const isResizing = useRef(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 320 && newWidth <= 800) {
      setPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [showNodeColorPicker, setShowNodeColorPicker] = useState(false);
  const [showNodeTextColorPicker, setShowNodeTextColorPicker] = useState(false);
  const [showNodeGradient1Picker, setShowNodeGradient1Picker] = useState(false);
  const [showNodeGradient2Picker, setShowNodeGradient2Picker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const bgPickerRef = useRef<HTMLDivElement>(null);
  const patternPickerRef = useRef<HTMLDivElement>(null);
  const nodeColorPickerRef = useRef<HTMLDivElement>(null);
  const nodeTextColorPickerRef = useRef<HTMLDivElement>(null);
  const nodeGradient1PickerRef = useRef<HTMLDivElement>(null);
  const nodeGradient2PickerRef = useRef<HTMLDivElement>(null);

  const bgButtonRef = useRef<HTMLButtonElement>(null);
  const patternButtonRef = useRef<HTMLButtonElement>(null);
  const nodeColorButtonRef = useRef<HTMLButtonElement>(null);
  const nodeTextColorButtonRef = useRef<HTMLButtonElement>(null);
  const nodeGradient1ButtonRef = useRef<HTMLButtonElement>(null);
  const nodeGradient2ButtonRef = useRef<HTMLButtonElement>(null);

  const [bgPickerStyle, setBgPickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);
  const [patternPickerStyle, setPatternPickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);
  const [nodeColorPickerStyle, setNodeColorPickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);
  const [nodeTextColorPickerStyle, setNodeTextColorPickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);
  const [nodeGradient1PickerStyle, setNodeGradient1PickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);
  const [nodeGradient2PickerStyle, setNodeGradient2PickerStyle] = useState<CSSProperties>(HIDDEN_PICKER);

  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isLinkStyleExpanded, setIsLinkStyleExpanded] = useState(false);

  const togglePicker = (picker: string) => {
    setShowBgPicker(picker === 'bg' ? !showBgPicker : false);
    setShowPatternPicker(picker === 'pattern' ? !showPatternPicker : false);
    setShowNodeColorPicker(picker === 'node' ? !showNodeColorPicker : false);
    setShowNodeTextColorPicker(picker === 'text' ? !showNodeTextColorPicker : false);
    setShowNodeGradient1Picker(picker === 'g1' ? !showNodeGradient1Picker : false);
    setShowNodeGradient2Picker(picker === 'g2' ? !showNodeGradient2Picker : false);

    // Reset positions for the pickers being closed
    if (picker !== 'bg') setBgPickerStyle(HIDDEN_PICKER);
    if (picker !== 'pattern') setPatternPickerStyle(HIDDEN_PICKER);
    if (picker !== 'node') setNodeColorPickerStyle(HIDDEN_PICKER);
    if (picker !== 'text') setNodeTextColorPickerStyle(HIDDEN_PICKER);
    if (picker !== 'g1') setNodeGradient1PickerStyle(HIDDEN_PICKER);
    if (picker !== 'g2') setNodeGradient2PickerStyle(HIDDEN_PICKER);
  };

  useLayoutEffect(() => {
    const updatePosition = (buttonRef: RefObject<HTMLButtonElement | null>, setStyle: Dispatch<SetStateAction<CSSProperties>>) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const pickerWidth = 240;
      const pickerHeight = 280;

      let top = rect.bottom + 8;
      let left = rect.right - pickerWidth;

      if (top + pickerHeight > window.innerHeight) {
        top = rect.top - pickerHeight - 8;
      }
      if (left < 10) {
        left = 10;
      }

      setStyle({ position: 'fixed', top, left, zIndex: 9999, opacity: 1 });
    };

    const updateAll = () => {
      if (showBgPicker) updatePosition(bgButtonRef, setBgPickerStyle);
      if (showPatternPicker) updatePosition(patternButtonRef, setPatternPickerStyle);
      if (showNodeColorPicker) updatePosition(nodeColorButtonRef, setNodeColorPickerStyle);
      if (showNodeTextColorPicker) updatePosition(nodeTextColorButtonRef, setNodeTextColorPickerStyle);
      if (showNodeGradient1Picker) updatePosition(nodeGradient1ButtonRef, setNodeGradient1PickerStyle);
      if (showNodeGradient2Picker) updatePosition(nodeGradient2ButtonRef, setNodeGradient2PickerStyle);
    };

    updateAll();
    window.addEventListener('resize', updateAll);
    const scroller = scrollRef.current;
    scroller?.addEventListener('scroll', updateAll);

    return () => {
      window.removeEventListener('resize', updateAll);
      scroller?.removeEventListener('scroll', updateAll);
    };
  }, [showBgPicker, showPatternPicker, showNodeColorPicker, showNodeTextColorPicker, showNodeGradient1Picker, showNodeGradient2Picker, panelWidth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isPickerClick = [
        bgPickerRef, patternPickerRef,
        nodeColorPickerRef, nodeTextColorPickerRef, nodeGradient1PickerRef, nodeGradient2PickerRef,
      ].some((ref) => ref.current?.contains(target));
      const isButtonClick = [
        bgButtonRef, patternButtonRef,
        nodeColorButtonRef, nodeTextColorButtonRef, nodeGradient1ButtonRef, nodeGradient2ButtonRef,
      ].some((ref) => ref.current?.contains(target));

      if (isPickerClick || isButtonClick) return;

      setShowBgPicker(false);
      setShowPatternPicker(false);
      setShowNodeColorPicker(false);
      setShowNodeTextColorPicker(false);
      setShowNodeGradient1Picker(false);
      setShowNodeGradient2Picker(false);

      setBgPickerStyle(HIDDEN_PICKER);
      setPatternPickerStyle(HIDDEN_PICKER);
      setNodeColorPickerStyle(HIDDEN_PICKER);
      setNodeTextColorPickerStyle(HIDDEN_PICKER);
      setNodeGradient1PickerStyle(HIDDEN_PICKER);
      setNodeGradient2PickerStyle(HIDDEN_PICKER);
    };

    if (showBgPicker || showPatternPicker || showNodeColorPicker || showNodeTextColorPicker || showNodeGradient1Picker || showNodeGradient2Picker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBgPicker, showPatternPicker, showNodeColorPicker, showNodeTextColorPicker, showNodeGradient1Picker, showNodeGradient2Picker]);

  const handleColorChange = (rgba: { r: number; g: number; b: number; a: number }, setter: (val: string) => void) => {
    setter(`rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`);
  };

  const resetCanvas = () => {
    setCanvasTheme(defaultSettings.canvasTheme);
    setCanvasBackgroundColor(defaultSettings.canvasBackgroundColor);
    setCanvasPatternColor(defaultSettings.canvasPatternColor);
    setCanvasBackgroundImage(defaultSettings.canvasBackgroundImage);
    setCanvasBackgroundBlur(defaultSettings.canvasBackgroundBlur);
  };

  const gradientPreview = nodeGradientType === 'linear'
    ? `linear-gradient(${nodeGradientAngle}deg, ${nodeGradientColor1}, ${nodeGradientColor2})`
    : `radial-gradient(circle at center, ${nodeGradientColor1}, ${nodeGradientColor2})`;

  const footerButtonClass = 'flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isAdvancedPanelOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setIsAdvancedPanelOpen(false)}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Advanced options"
        aria-hidden={!isAdvancedPanelOpen}
        className={`fixed bottom-0 right-0 top-0 z-[610] flex flex-col border-l border-slate-200 bg-slate-50 text-slate-900 shadow-2xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-[#0b1120] dark:text-slate-100 ${isAdvancedPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: windowWidth < 640 ? '100%' : `${panelWidth}px` }}
      >
        {/* Resize handle */}
        <div
          className="group absolute -left-1 bottom-0 top-0 z-10 hidden w-2 cursor-col-resize justify-center sm:flex"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <div className="h-full w-0.5 bg-transparent transition-colors group-hover:bg-blue-500" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0b1120]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <SlidersHorizontal size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">Advanced Options</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Appearance, layout and canvas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancedPanelOpen(false)}
            aria-label="Close advanced options"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {/* Appearance */}
          <Section title="Appearance">
            <Card divided>
              <ChoicePicker
                label="Node theme"
                value={nodeTheme}
                options={nodeThemes}
                onChange={setNodeTheme}
                open={isThemeExpanded}
                onToggle={() => setIsThemeExpanded((open) => !open)}
              />
              <ChoicePicker
                label="Link style"
                value={edgeStyle}
                options={edgeStyles}
                onChange={setEdgeStyle}
                open={isLinkStyleExpanded}
                onToggle={() => setIsLinkStyleExpanded((open) => !open)}
              />
            </Card>
          </Section>

          {/* Custom colors */}
          <Section
            title="Custom colors"
            action={
              <span className={`text-[11px] ${nodeTheme === 'custom' ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {nodeTheme === 'custom' ? 'In use' : 'Applies the Custom theme'}
              </span>
            }
          >
            <Card>
              <div className="space-y-3 p-3">
                <Segmented
                  label="Fill type"
                  options={[{ value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }]}
                  value={useNodeGradient ? 'gradient' : 'solid'}
                  onChange={(type) => {
                    setUseNodeGradient(type === 'gradient');
                    setNodeTheme('custom');
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  {!useNodeGradient ? (
                    <SwatchButton ref={nodeColorButtonRef} color={nodeColor} label="Fill" active={showNodeColorPicker} onClick={() => togglePicker('node')} />
                  ) : (
                    <>
                      <SwatchButton ref={nodeGradient1ButtonRef} color={nodeGradientColor1} label="Start" active={showNodeGradient1Picker} onClick={() => togglePicker('g1')} />
                      <SwatchButton ref={nodeGradient2ButtonRef} color={nodeGradientColor2} label="End" active={showNodeGradient2Picker} onClick={() => togglePicker('g2')} />
                    </>
                  )}
                  <SwatchButton
                    ref={nodeTextColorButtonRef}
                    color={nodeTextColor}
                    label="Text"
                    active={showNodeTextColorPicker}
                    onClick={() => togglePicker('text')}
                    className={useNodeGradient ? 'col-span-2' : ''}
                  />
                </div>

                {useNodeGradient && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="h-10 w-full rounded-lg shadow-inner ring-1 ring-black/5 dark:ring-white/10" style={{ background: gradientPreview }} />
                    <Segmented
                      label="Gradient type"
                      activeTextClass="text-purple-600 dark:text-purple-400"
                      options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]}
                      value={nodeGradientType}
                      onChange={(type) => {
                        setNodeGradientType(type);
                        setNodeTheme('custom');
                      }}
                    />
                    {nodeGradientType === 'linear' && (
                      <SliderRow
                        className=""
                        label="Angle"
                        display={`${nodeGradientAngle}°`}
                        value={nodeGradientAngle}
                        min={0}
                        max={360}
                        step={45}
                        accentClass="accent-purple-500"
                        onChange={(angle) => {
                          setNodeGradientAngle(angle);
                          setNodeTheme('custom');
                        }}
                      />
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Quick {useNodeGradient ? 'start color' : 'fill'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FILL_PRESETS.map((c) => {
                      const selected = (useNodeGradient ? nodeGradientColor1 : nodeColor) === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setNodeTheme('custom');
                            if (useNodeGradient) setNodeGradientColor1(c);
                            else setNodeColor(c);
                          }}
                          title={colorLabel(c)}
                          aria-label={`Use ${colorLabel(c)}`}
                          aria-pressed={selected}
                          className={`h-7 w-7 rounded-lg shadow-sm transition-transform hover:scale-110 active:scale-95 ${selected
                            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                            : 'ring-1 ring-black/10 dark:ring-white/10'
                            }`}
                          style={{ backgroundColor: c }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </Section>

          {/* Layout */}
          <Section title="Layout">
            <Card divided>
              <SliderRow
                label="Node spread"
                display={`${nodeSpread.toFixed(1)}x`}
                value={nodeSpread}
                min={0.5}
                max={5}
                step={0.1}
                ends={['0.5x', '5.0x']}
                onChange={setNodeSpread}
                onReset={() => setNodeSpread(defaultSettings.nodeSpread)}
              />
              <SliderRow
                label="Node size"
                display={`${nodeSize.toFixed(1)}x`}
                value={nodeSize}
                min={0.5}
                max={2}
                step={0.1}
                ends={['0.5x', '2.0x']}
                accentClass="accent-emerald-500"
                onChange={setNodeSize}
                onReset={() => setNodeSize(defaultSettings.nodeSize)}
              />
            </Card>
          </Section>

          {/* Canvas */}
          <Section
            title="Canvas"
            action={
              <button
                type="button"
                onClick={resetCanvas}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={11} /> Reset
              </button>
            }
          >
            <Card>
              <div className="space-y-3 p-3">
                <Segmented
                  label="Canvas pattern"
                  activeTextClass="text-pink-600 dark:text-pink-400"
                  options={canvasThemes.map((t) => ({ value: t, label: formatName(t) }))}
                  value={canvasTheme}
                  onChange={setCanvasTheme}
                />

                <div className="grid grid-cols-2 gap-2">
                  <SwatchButton ref={bgButtonRef} color={canvasBackgroundColor} label="Background" active={showBgPicker} onClick={() => togglePicker('bg')} />
                  <SwatchButton
                    ref={patternButtonRef}
                    color={canvasPatternColor}
                    label="Pattern"
                    active={showPatternPicker}
                    disabled={canvasTheme === 'none'}
                    onClick={() => togglePicker('pattern')}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <ImageIcon size={13} className="text-slate-400" /> Background image
                    </span>
                    <input
                      type="text"
                      value={canvasBackgroundImage}
                      onChange={(e) => setCanvasBackgroundImage(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600"
                    />
                  </label>
                  <SliderRow
                    className=""
                    label="Image blur"
                    display={`${canvasBackgroundBlur}px`}
                    value={canvasBackgroundBlur}
                    min={0}
                    max={20}
                    step={1}
                    accentClass="accent-purple-500"
                    onChange={setCanvasBackgroundBlur}
                  />
                </div>
              </div>
            </Card>
          </Section>

          {/* Features */}
          <Section title="Features">
            <Card divided>
              <SettingRow icon={ImageIcon} iconClass="bg-blue-500/10 text-blue-500" title="Media preview" description="Show images, audio and video from URLs or Base64">
                <Toggle label="Media preview" checked={showMediaPreview} onChange={setShowMediaPreview} />
              </SettingRow>
              <SettingRow icon={StickyNote} iconClass="bg-amber-500/10 text-amber-500" title="Sticky notes" description="Floating workspace notes, stored locally">
                <Toggle label="Sticky notes" checked={stickyNotesEnabled} onChange={setStickyNotesEnabled} activeClass="bg-amber-500" />
              </SettingRow>
              <SettingRow icon={AlignLeft} iconClass="bg-indigo-500/10 text-indigo-500" title="Expand all text" description="Show the full content of multiline text nodes">
                <Toggle label="Expand all text" checked={globalTextExpanded} onChange={setGlobalTextExpanded} />
              </SettingRow>
              <SettingRow icon={Mic} iconClass="bg-violet-500/10 text-violet-500" title="Voice commands" description="Mic and voice control">
                <button
                  type="button"
                  onClick={() => setIsVoiceHelpOpen(true)}
                  title="View available voice commands"
                  aria-label="View available voice commands"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-500 dark:hover:bg-slate-800"
                >
                  <HelpCircle size={16} />
                </button>
                <Toggle label="Voice commands" checked={isVoiceEnabled} onChange={setIsVoiceEnabled} activeClass="bg-violet-500" />
              </SettingRow>
              <div>
                <SettingRow icon={PenTool} iconClass="bg-purple-500/10 text-purple-500" title="Drawing toolbar" description="Annotation and overlay tools">
                  <button
                    type="button"
                    onClick={() => setIsMathHelpOpen(true)}
                    title="How to use the math canvas"
                    aria-label="How to use the math canvas"
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-slate-800"
                  >
                    <HelpCircle size={16} />
                  </button>
                  <Toggle label="Drawing toolbar" checked={isToolbarVisible} onChange={setIsToolbarVisible} activeClass="bg-purple-500" />
                </SettingRow>
                <AnimatePresence initial={false}>
                  {isToolbarVisible && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/30">
                        <SliderRow
                          className=""
                          label="Opacity"
                          display={`${Math.round(toolbarOpacity * 100)}%`}
                          value={toolbarOpacity}
                          min={0.1}
                          max={1}
                          step={0.05}
                          accentClass="accent-purple-500"
                          onChange={setToolbarOpacity}
                        />
                        <SliderRow
                          className=""
                          label="Scale"
                          display={`${toolbarScale.toFixed(1)}x`}
                          value={toolbarScale}
                          min={0.5}
                          max={2}
                          step={0.1}
                          accentClass="accent-purple-500"
                          onChange={setToolbarScale}
                        />
                        <div>
                          <div className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">Orientation</div>
                          <Segmented
                            label="Toolbar orientation"
                            activeTextClass="text-purple-600 dark:text-purple-400"
                            options={[{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }]}
                            value={toolbarOrientation}
                            onChange={setToolbarOrientation}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </Section>

          {/* Integrations */}
          <Section title="Integrations">
            <Card divided>
              <SettingRow icon={Sparkles} iconClass="bg-blue-500/10 text-blue-500" title="AI platform" description="Providers, models and parameters">
                <RowButton
                  onClick={() => {
                    setIsAdvancedPanelOpen(false);
                    useStore.getState().setIsAISettingsPanelOpen(true);
                  }}
                >
                  Configure
                </RowButton>
              </SettingRow>
              <SettingRow icon={Youtube} iconClass="bg-red-500/10 text-red-500" title="YouTube search" description="Search and embed YouTube videos">
                <RowButton onClick={() => setIsYoutubeSearchOpen(true)}>Open</RowButton>
              </SettingRow>
              <SettingRow icon={Shield} iconClass="bg-emerald-500/10 text-emerald-500" title="Proxy" description="Route remote requests through a proxy">
                <RowButton onClick={() => setIsProxyModalOpen(true)}>Settings</RowButton>
              </SettingRow>
            </Card>
          </Section>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#0b1120]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                import('../audio/stores/audioStore').then((m) => m.useAudioStore.getState().togglePlayer());
                setIsAdvancedPanelOpen(false);
              }}
              className={footerButtonClass}
            >
              <Music size={15} className="text-indigo-500" />
              Audio player
            </button>
            <button type="button" onClick={() => setIsShortcutsOpen(true)} className={footerButtonClass}>
              <Keyboard size={15} className="text-blue-500" />
              Shortcuts
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAllSettings();
              resetPreferences();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
          >
            <RotateCcw size={15} />
            Reset all settings
          </button>
        </div>
      </aside>

      {/* Color pickers (portaled so the panel's scroll container doesn't clip them) */}
      {showNodeColorPicker && createPortal(
        <div style={nodeColorPickerStyle} ref={nodeColorPickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(nodeColor)}
            onChange={(color) => {
              handleColorChange(color, setNodeColor);
              setNodeTheme('custom');
            }}
          />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {NODE_PICKER_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setNodeColor(c); setNodeTheme('custom'); }}
                aria-label={`Use ${colorLabel(c)}`}
                className="h-8 w-8 rounded-md ring-1 ring-black/10 transition-transform hover:scale-110 dark:ring-white/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}

      {showNodeTextColorPicker && createPortal(
        <div style={nodeTextColorPickerStyle} ref={nodeTextColorPickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(nodeTextColor)}
            onChange={(color) => {
              handleColorChange(color, setNodeTextColor);
              setNodeTheme('custom');
            }}
          />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {TEXT_PICKER_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setNodeTextColor(c); setNodeTheme('custom'); }}
                aria-label={`Use ${colorLabel(c)}`}
                className="h-8 w-8 rounded-md ring-1 ring-black/10 transition-transform hover:scale-110 dark:ring-white/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}

      {showNodeGradient1Picker && createPortal(
        <div style={nodeGradient1PickerStyle} ref={nodeGradient1PickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(nodeGradientColor1)}
            onChange={(color) => {
              handleColorChange(color, setNodeGradientColor1);
              setNodeTheme('custom');
            }}
          />
        </div>,
        document.body
      )}

      {showNodeGradient2Picker && createPortal(
        <div style={nodeGradient2PickerStyle} ref={nodeGradient2PickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(nodeGradientColor2)}
            onChange={(color) => {
              handleColorChange(color, setNodeGradientColor2);
              setNodeTheme('custom');
            }}
          />
        </div>,
        document.body
      )}

      {showBgPicker && createPortal(
        <div style={bgPickerStyle} ref={bgPickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(canvasBackgroundColor)}
            onChange={(color) => handleColorChange(color, setCanvasBackgroundColor)}
          />
        </div>,
        document.body
      )}

      {showPatternPicker && createPortal(
        <div style={patternPickerStyle} ref={patternPickerRef} className={PICKER_CLASS}>
          <RgbaColorPicker
            color={parseRgba(canvasPatternColor)}
            onChange={(color) => handleColorChange(color, setCanvasPatternColor)}
          />
        </div>,
        document.body
      )}

      <VoiceHelpModal isOpen={isVoiceHelpOpen} onClose={() => setIsVoiceHelpOpen(false)} />
      <ProxySettingsModal />
    </>
  );
}
